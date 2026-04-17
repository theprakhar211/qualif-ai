"""
services/hybrid_evaluator.py
Deterministic scoring layer that runs alongside (and feeds into) Groq LLM evaluation.
"""

import re
from dataclasses import dataclass, field
from typing import Optional
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
    depth_penalty: float          # 0–1: penalty multiplier (1 = no penalty)
    matched_keywords: list[str]
    missing_keywords: list[str]
    structure_flags: dict         # {"has_intro": bool, "has_explanation": bool, "has_conclusion": bool}
    penalties_applied: list[str]  # human-readable list of penalties
    raw_deterministic_score: float  # weighted composite before LLM blend
    word_count: int
    wpm: float                    # words per minute (requires duration_seconds)


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
# Per-question keyword bank  (extend as needed)
# This can be seeded from the LLM "ideal answer" generation step too.
# ---------------------------------------------------------------------------

KEYWORD_BANK: dict[str, list[str]] = {
    # Arrays / Lists
    "array": ["index", "element", "length", "iterate", "dynamic", "static", "contiguous", "O(1)", "O(n)"],
    "linked list": ["node", "pointer", "head", "tail", "next", "singly", "doubly", "traverse"],
    "binary search": ["sorted", "mid", "low", "high", "O(log n)", "divide", "half", "comparison"],
    "sorting": ["comparison", "swap", "pivot", "merge", "divide", "O(n log n)", "stable", "in-place"],
    "hash": ["key", "value", "collision", "bucket", "hash function", "O(1)", "load factor"],
    "tree": ["node", "root", "leaf", "height", "depth", "traversal", "BST", "balanced"],
    "graph": ["vertex", "edge", "directed", "undirected", "BFS", "DFS", "cycle", "weighted"],
    "dynamic programming": ["subproblem", "memoization", "tabulation", "overlapping", "optimal substructure"],
    "recursion": ["base case", "call stack", "stack overflow", "divide", "subproblem"],
    # System design
    "load balancer": ["distribute", "traffic", "round robin", "health check", "sticky session", "horizontal"],
    "caching": ["TTL", "eviction", "LRU", "Redis", "hit rate", "invalidation", "warm"],
    "database": ["index", "query", "schema", "transaction", "ACID", "normalization", "sharding"],
    "api": ["REST", "endpoint", "HTTP", "status code", "request", "response", "rate limit"],
    # Behavioural
    "conflict": ["situation", "action", "result", "communication", "resolution", "compromise"],
    "leadership": ["team", "goal", "delegate", "responsibility", "outcome", "motivate"],
    "failure": ["learned", "mistake", "improved", "reflection", "outcome", "next time"],
}

# ---------------------------------------------------------------------------
# Structure detection patterns
# ---------------------------------------------------------------------------

INTRO_PATTERNS = [
    r"\b(I will|let me|to answer|first|to start|so basically|to begin|to summarise)\b",
    r"\b(my approach|I think|I'd say|I believe)\b",
]

EXPLANATION_PATTERNS = [
    r"\b(because|therefore|this means|which means|for example|such as|specifically)\b",
    r"\b(the reason|this works|this is|this allows|this ensures)\b",
]

CONCLUSION_PATTERNS = [
    r"\b(in summary|overall|to conclude|therefore|in the end|ultimately|so in short)\b",
    r"\b(this is why|that's why|this makes it|this ensures)\b",
]

VAGUE_PATTERNS = [
    r"\b(I don't know|not sure|maybe|sort of|kind of|I think so|probably|might be)\b",
    r"\b(something like|you know|basically basically|um+|uh+)\b",
]

SHORT_ANSWER_THRESHOLD = 30   # words — answers below this get a depth penalty
IDEAL_MIN_WORDS = 60          # below this, minor depth penalty
IDEAL_MAX_WORDS = 300         # above this, no bonus but no penalty either


# ---------------------------------------------------------------------------
# Core scoring logic
# ---------------------------------------------------------------------------

def extract_keywords_for_question(question_text: str, topic: str | None = None) -> list[str]:
    """
    Return required keywords for a question.
    Looks up the KEYWORD_BANK by topic first, then tries to match keywords
    against the question text directly.
    """
    required: list[str] = []
    q_lower = question_text.lower()

    # Topic-based lookup (passed explicitly from question metadata)
    if topic:
        for key, kws in KEYWORD_BANK.items():
            if key.lower() in topic.lower():
                required.extend(kws)

    # Question-text-based lookup
    for key, kws in KEYWORD_BANK.items():
        if key.lower() in q_lower:
            required.extend(kws)

    # Deduplicate, preserve order
    seen: set[str] = set()
    deduped = []
    for k in required:
        if k not in seen:
            seen.add(k)
            deduped.append(k)

    return deduped


def score_keywords(answer: str, required_keywords: list[str]) -> tuple[float, list[str], list[str]]:
    """Returns (score 0–1, matched, missing)."""
    if not required_keywords:
        return 1.0, [], []

    answer_lower = answer.lower()
    matched = [kw for kw in required_keywords if kw.lower() in answer_lower]
    missing = [kw for kw in required_keywords if kw.lower() not in answer_lower]
    score = len(matched) / len(required_keywords)
    return score, matched, missing


def detect_structure(answer: str) -> tuple[float, dict]:
    """Returns (score 0–1, flags dict)."""
    flags = {
        "has_intro": any(re.search(p, answer, re.IGNORECASE) for p in INTRO_PATTERNS),
        "has_explanation": any(re.search(p, answer, re.IGNORECASE) for p in EXPLANATION_PATTERNS),
        "has_conclusion": any(re.search(p, answer, re.IGNORECASE) for p in CONCLUSION_PATTERNS),
    }
    score = sum(flags.values()) / 3
    return score, flags


def compute_depth_penalty(answer: str) -> tuple[float, list[str]]:
    """Returns (penalty_multiplier 0–1, list of penalty reasons)."""
    penalties = []
    words = answer.split()
    wc = len(words)

    multiplier = 1.0

    if wc < SHORT_ANSWER_THRESHOLD:
        multiplier -= 0.40
        penalties.append(f"Answer too short ({wc} words, minimum ~{SHORT_ANSWER_THRESHOLD})")
    elif wc < IDEAL_MIN_WORDS:
        multiplier -= 0.15
        penalties.append(f"Answer lacks depth ({wc} words, aim for {IDEAL_MIN_WORDS}+)")

    vague_hits = sum(
        1 for p in VAGUE_PATTERNS if re.search(p, answer, re.IGNORECASE)
    )
    if vague_hits >= 3:
        multiplier -= 0.20
        penalties.append("Vague language detected (hedging/filler words)")
    elif vague_hits >= 1:
        multiplier -= 0.08
        penalties.append("Some vague or filler language present")

    return max(0.0, multiplier), penalties


def compute_deterministic_score(
    answer: str,
    required_keywords: list[str],
    phase: PhaseType = PhaseType.TECHNICAL,
) -> DeterministicScore:
    """
    Full deterministic scoring pipeline.
    Weights vary by phase.
    """
    words = answer.split()
    wc = len(words)

    kw_score, matched, missing = score_keywords(answer, required_keywords)
    struct_score, struct_flags = detect_structure(answer)
    depth_mult, penalties = compute_depth_penalty(answer)

    # Phase-specific weights
    weights: dict[PhaseType, dict] = {
        PhaseType.INTRO: {"kw": 0.2, "struct": 0.5, "depth": 0.3},
        PhaseType.RESUME: {"kw": 0.3, "struct": 0.3, "depth": 0.4},
        PhaseType.TECHNICAL: {"kw": 0.5, "struct": 0.2, "depth": 0.3},
        PhaseType.BEHAVIOURAL: {"kw": 0.2, "struct": 0.5, "depth": 0.3},
        PhaseType.QUICK: {"kw": 0.45, "struct": 0.25, "depth": 0.3},
    }
    w = weights[phase]

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
        wpm=0.0,  # filled by caller if duration_seconds is available
    )


def blend_scores(
    llm_score: float,          # 0–100 from Groq
    det_score: DeterministicScore,
    phase: PhaseType = PhaseType.TECHNICAL,
) -> float:
    """
    Blend LLM score with deterministic score.
    LLM score is normalised to 0–1 internally.
    Returns final 0–100 score.
    """
    llm_norm = llm_score / 100.0

    # Phase-specific blend ratios (LLM weight, deterministic weight)
    blend: dict[PhaseType, tuple[float, float]] = {
        PhaseType.INTRO: (0.7, 0.3),
        PhaseType.RESUME: (0.65, 0.35),
        PhaseType.TECHNICAL: (0.55, 0.45),
        PhaseType.BEHAVIOURAL: (0.7, 0.3),
        PhaseType.QUICK: (0.60, 0.40),
    }
    lw, dw = blend[phase]

    blended = (llm_norm * lw + det_score.raw_deterministic_score * dw)
    return round(min(100.0, max(0.0, blended * 100)), 1)


def run_hybrid_evaluation(
    answer: str,
    question_text: str,
    llm_result: dict,          # output from existing batch_evaluate()
    phase: PhaseType = PhaseType.TECHNICAL,
    topic: str | None = None,
    duration_seconds: float | None = None,
) -> HybridResult:
    """
    Drop-in replacement for raw LLM score consumption.
    llm_result expected keys: score (0–100), reasoning, stt_corrected_transcript
    """
    required_kws = extract_keywords_for_question(question_text, topic)

    # Merge with LLM-suggested missing keywords if present
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
        stt_corrected_transcript=llm_result.get("stt_corrected_transcript", answer),
        word_count=det.word_count,
        wpm=det.wpm,
    )
