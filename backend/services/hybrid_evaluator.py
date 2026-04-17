"""
services/hybrid_evaluator.py
Deterministic scoring layer that runs alongside (and feeds into) Groq LLM evaluation.
"""

import re
from dataclasses import dataclass
from enum import Enum


class PhaseType(str, Enum):
    INTRO = "intro"
    RESUME = "resume"
    TECHNICAL = "technical"
    BEHAVIOURAL = "behavioural"
    QUICK = "quick"


@dataclass
class DeterministicScore:
    keyword_score: float          # 0–1: fraction of required keywords present
    structure_score: float        # 0–1: intro/body/conclusion detected
    depth_penalty: float          # 0–1: multiplier (1.0 = no penalty)
    matched_keywords: list[str]
    missing_keywords: list[str]
    # {"has_intro": bool, "has_explanation": bool, "has_conclusion": bool}
    structure_flags: dict
    penalties_applied: list[str]  # human-readable penalty descriptions
    raw_deterministic_score: float
    word_count: int
    wpm: float


@dataclass
class HybridResult:
    final_score: float            # 0–100 blended score
    llm_score: float
    deterministic_score: float
    keyword_score: float
    structure_score: float
    depth_penalty: float
    matched_keywords: list[str]
    missing_keywords: list[str]
    penalties_applied: list[str]
    structure_flags: dict
    reasoning: str
    stt_corrected_transcript: str
    word_count: int
    wpm: float


# ---------------------------------------------------------------------------
# Per-question keyword bank
# Extend this freely — more topics = better keyword coverage
# ---------------------------------------------------------------------------

KEYWORD_BANK: dict[str, list[str]] = {
    # Data Structures
    "array": ["index", "element", "length", "iterate", "dynamic", "static", "contiguous", "O(1)", "O(n)"],
    "linked list": ["node", "pointer", "head", "tail", "next", "singly", "doubly", "traverse"],
    "stack": ["LIFO", "push", "pop", "overflow", "call stack", "last in"],
    "queue": ["FIFO", "enqueue", "dequeue", "front", "rear", "first in"],
    "hash": ["key", "value", "collision", "bucket", "hash function", "O(1)", "load factor"],
    "tree": ["node", "root", "leaf", "height", "depth", "traversal", "BST", "balanced"],
    "heap": ["parent", "child", "min-heap", "max-heap", "heapify", "priority queue", "O(log n)"],
    "graph": ["vertex", "edge", "directed", "undirected", "BFS", "DFS", "cycle", "weighted"],
    # Algorithms
    "binary search": ["sorted", "mid", "low", "high", "O(log n)", "divide", "half", "comparison"],
    "sorting": ["comparison", "swap", "pivot", "merge", "divide", "O(n log n)", "stable", "in-place"],
    "dynamic programming": ["subproblem", "memoization", "tabulation", "overlapping", "optimal substructure"],
    "recursion": ["base case", "call stack", "stack overflow", "divide", "subproblem"],
    "greedy": ["local optimum", "global optimum", "optimal substructure", "greedy choice"],
    "graph algorithms": ["BFS", "DFS", "Dijkstra", "shortest path", "visited", "adjacency"],
    # System Design
    "load balancer": ["distribute", "traffic", "round robin", "health check", "sticky session", "horizontal"],
    "caching": ["TTL", "eviction", "LRU", "Redis", "hit rate", "invalidation", "warm"],
    "database": ["index", "query", "schema", "transaction", "ACID", "normalization", "sharding"],
    "api": ["REST", "endpoint", "HTTP", "status code", "request", "response", "rate limit"],
    "microservice": ["independent", "service", "API gateway", "fault tolerance", "scalability", "deploy"],
    "message queue": ["async", "producer", "consumer", "broker", "Kafka", "RabbitMQ", "decouple"],
    # Concepts
    "oop": ["class", "object", "inheritance", "encapsulation", "polymorphism", "abstraction", "interface"],
    "concurrency": ["thread", "mutex", "lock", "race condition", "deadlock", "async", "parallel"],
    "memory": ["heap", "stack", "allocation", "garbage collection", "reference", "pointer"],
    "networking": ["TCP", "UDP", "HTTP", "DNS", "latency", "bandwidth", "protocol"],
    # Behavioural / soft skills
    "conflict": ["situation", "action", "result", "communication", "resolution", "compromise"],
    "leadership": ["team", "goal", "delegate", "responsibility", "outcome", "motivate"],
    "failure": ["learned", "mistake", "improved", "reflection", "outcome", "next time"],
    "teamwork": ["collaborate", "communicate", "shared", "goal", "responsibility", "support"],
}

# ---------------------------------------------------------------------------
# Structure detection patterns
# ---------------------------------------------------------------------------

INTRO_PATTERNS = [
    r"\b(I will|let me|to answer|first|to start|so basically|to begin|my approach|I think|I'd say|I believe|great question|the way I|the key here)\b",
]

EXPLANATION_PATTERNS = [
    r"\b(because|therefore|this means|which means|for example|such as|specifically|the reason|this works|this is|this allows|this ensures|for instance)\b",
]

CONCLUSION_PATTERNS = [
    r"\b(in summary|overall|to conclude|therefore|in the end|ultimately|so in short|this is why|that's why|to summarise|to summarize|so overall|so the answer)\b",
]

VAGUE_PATTERNS = [
    r"\b(I don't know|not sure|maybe|sort of|kind of|I think so|you know|basically basically|probably|might be|something like)\b",
    r"\bum{2,}|\buh{2,}",
]

SHORT_ANSWER_THRESHOLD = 20   # below this is genuinely too short — hard penalty
IDEAL_MIN_WORDS = 50          # below this, small soft penalty


# ---------------------------------------------------------------------------
# Core scoring functions
# ---------------------------------------------------------------------------

def extract_keywords_for_question(question_text: str, topic: str | None = None) -> list[str]:
    """
    Return required keywords for a question by matching against KEYWORD_BANK.
    Searches both the topic hint and question text.
    """
    required: list[str] = []
    search_text = ((topic or "") + " " + (question_text or "")).lower()

    for key, kws in KEYWORD_BANK.items():
        if key.lower() in search_text:
            required.extend(kws)

    # Deduplicate while preserving order
    seen: set[str] = set()
    return [k for k in required if not (k in seen or seen.add(k))]


def score_keywords(answer: str, required_keywords: list[str]) -> tuple[float, list[str], list[str]]:
    """Returns (score 0–1, matched keywords, missing keywords)."""
    if not required_keywords:
        return 1.0, [], []
    answer_lower = answer.lower()
    matched = [kw for kw in required_keywords if kw.lower() in answer_lower]
    missing = [kw for kw in required_keywords if kw.lower()
               not in answer_lower]
    return len(matched) / len(required_keywords), matched, missing


def detect_structure(answer: str) -> tuple[float, dict]:
    """
    Checks for intro / explanation / conclusion signals.
    Returns (score 0–1, flags dict).
    Score of 0.33 = one of three present, 0.67 = two, 1.0 = all three.
    """
    flags = {
        "has_intro":       any(re.search(p, answer, re.IGNORECASE) for p in INTRO_PATTERNS),
        "has_explanation": any(re.search(p, answer, re.IGNORECASE) for p in EXPLANATION_PATTERNS),
        "has_conclusion":  any(re.search(p, answer, re.IGNORECASE) for p in CONCLUSION_PATTERNS),
    }
    return sum(flags.values()) / 3, flags


def compute_depth_penalty(answer: str) -> tuple[float, list[str]]:
    """
    Returns (multiplier 0–1, penalty descriptions).
    1.0 = no penalty. Only triggers on genuinely thin or vague answers.
    """
    penalties = []
    words = answer.split()
    wc = len(words)
    multiplier = 1.0

    if wc < SHORT_ANSWER_THRESHOLD:
        multiplier -= 0.35
        penalties.append(
            f"Answer very short ({wc} words — aim for {IDEAL_MIN_WORDS}+)")
    elif wc < IDEAL_MIN_WORDS:
        multiplier -= 0.10
        penalties.append(f"Answer could be more detailed ({wc} words)")

    vague_hits = sum(1 for p in VAGUE_PATTERNS if re.search(
        p, answer, re.IGNORECASE))
    if vague_hits >= 3:
        multiplier -= 0.15
        penalties.append("Multiple vague or filler phrases detected")
    elif vague_hits >= 1:
        # Single "I think" or "maybe" — not penalised, just noted implicitly
        pass

    return max(0.0, multiplier), penalties


def compute_deterministic_score(
    answer: str,
    required_keywords: list[str],
    phase: PhaseType = PhaseType.TECHNICAL,
) -> DeterministicScore:
    """
    Full deterministic scoring pipeline.
    Phase-specific weights control how much each signal counts.
    """
    words = answer.split()
    wc = len(words)

    kw_score, matched, missing = score_keywords(answer, required_keywords)
    struct_score, struct_flags = detect_structure(answer)
    depth_mult, penalties = compute_depth_penalty(answer)

    # ── Phase weights ────────────────────────────────────────────────────
    # kw + struct + depth must sum to 1.0
    # Technical: keywords are the primary signal, structure is soft
    # Intro/Behavioural: structure matters far more than keyword hits
    weights: dict[PhaseType, dict] = {
        PhaseType.INTRO:       {"kw": 0.15, "struct": 0.55, "depth": 0.30},
        PhaseType.RESUME:      {"kw": 0.25, "struct": 0.35, "depth": 0.40},
        PhaseType.TECHNICAL:   {"kw": 0.55, "struct": 0.10, "depth": 0.35},
        PhaseType.BEHAVIOURAL: {"kw": 0.15, "struct": 0.55, "depth": 0.30},
        PhaseType.QUICK:       {"kw": 0.50, "struct": 0.15, "depth": 0.35},
    }
    w = weights[phase]

    # depth contributes its full weight when no penalty applies (depth_mult = 1.0)
    raw = (kw_score * w["kw"] + struct_score * w["struct"] + 1.0 * w["depth"])
    raw_penalised = raw * depth_mult

    return DeterministicScore(
        keyword_score=kw_score,
        structure_score=struct_score,
        depth_penalty=depth_mult,
        matched_keywords=matched,
        missing_keywords=missing,
        structure_flags=struct_flags,
        penalties_applied=penalties,
        raw_deterministic_score=raw_penalised,
        word_count=wc,
        wpm=0.0,   # filled by caller if duration_seconds is available
    )


def blend_scores(
    llm_score: float,
    det_score: DeterministicScore,
    phase: PhaseType = PhaseType.TECHNICAL,
) -> float:
    """
    Blend LLM score (0–100) with deterministic score (normalised 0–1).

    LLM is the primary signal. Deterministic acts as a secondary modifier:
    - Strong keyword coverage → small upward pull on final score
    - Thin / vague answer → small downward pull
    - Maximum deterministic influence is ~28 pts (at dw=0.28, det=1.0 vs llm=0)

    ── Blend ratios (LLM weight : deterministic weight) ──
    """
    blend: dict[PhaseType, tuple[float, float]] = {
        PhaseType.INTRO:       (0.80, 0.20),
        PhaseType.RESUME:      (0.75, 0.25),
        PhaseType.TECHNICAL:   (0.72, 0.28),
        PhaseType.BEHAVIOURAL: (0.80, 0.20),
        PhaseType.QUICK:       (0.72, 0.28),
    }
    lw, dw = blend[phase]

    llm_norm = llm_score / 100.0
    blended = llm_norm * lw + det_score.raw_deterministic_score * dw
    return round(min(100.0, max(0.0, blended * 100)), 1)


def run_hybrid_evaluation(
    answer: str,
    question_text: str,
    llm_result: dict,
    phase: PhaseType = PhaseType.TECHNICAL,
    topic: str | None = None,
    duration_seconds: float | None = None,
) -> HybridResult:
    """
    Main entry point. Drop-in replacement for raw LLM score consumption.

    llm_result expected keys:
      score (0–100), reasoning, missing_concepts, stt_corrected_transcript
    """
    required_kws = extract_keywords_for_question(question_text, topic)

    # Also treat LLM-identified missing concepts as additional keyword targets
    llm_missing = llm_result.get("missing_concepts", [])
    for kw in llm_missing:
        if kw not in required_kws:
            required_kws.append(kw)

    det = compute_deterministic_score(answer, required_kws, phase)

    if duration_seconds and duration_seconds > 0:
        det.wpm = round((det.word_count / duration_seconds) * 60, 1)

    llm_score = float(llm_result.get("score", 50))
    final = blend_scores(llm_score, det, phase)

    return HybridResult(
        final_score=final,
        llm_score=llm_score,
        deterministic_score=round(det.raw_deterministic_score * 100, 1),
        keyword_score=round(det.keyword_score * 100, 1),
        structure_score=round(det.structure_score * 100, 1),
        depth_penalty=round(det.depth_penalty, 2),
        matched_keywords=det.matched_keywords,
        missing_keywords=det.missing_keywords,
        penalties_applied=det.penalties_applied,
        structure_flags=det.structure_flags,
        reasoning=llm_result.get("reasoning", ""),
        stt_corrected_transcript=llm_result.get(
            "stt_corrected_transcript", answer),
        word_count=det.word_count,
        wpm=det.wpm,
    )
