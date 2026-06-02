"""
services/answer_benchmark.py
Generates, caches, and compares ideal answers per question.
Ideal answers are generated once by Groq and stored in MongoDB.
"""

import hashlib
import json
from datetime import datetime, timezone
from loguru import logger

# Import directly — no injected client needed
from services.groq_service import ask_groq, ask_groq_smart, _sanitise_answer


IDEAL_ANSWER_PROMPT = """You are a senior software engineer and technical interviewer.

Given this interview question:
<question>{question}</question>

Role: {role}
Topic: {topic}
Difficulty: {difficulty}

Generate an ideal interview answer. Return ONLY a JSON object with these exact keys:
{{
  "ideal_answer": "<2-4 paragraph ideal answer a strong candidate would give>",
  "key_concepts": ["concept1", "concept2"],
  "scoring_rubric": {{
    "excellent": "<what a 90-100 answer includes>",
    "good": "<what a 70-89 answer includes>",
    "fair": "<what a 50-69 answer includes>",
    "poor": "<what a 0-49 answer looks like>"
  }},
  "common_mistakes": ["mistake1", "mistake2"]
}}

Return only valid JSON, no markdown backticks, no preamble."""


COMPARISON_PROMPT = """You are an expert technical interviewer.

Interview question:
<question>{question}</question>

Candidate's answer:
<candidate_answer>{candidate_answer}</candidate_answer>

Ideal answer (reference only — do not reveal verbatim):
<ideal_answer>{ideal_answer}</ideal_answer>

Key concepts that should be covered: {key_concepts}

Return ONLY a JSON object:
{{
  "covered_concepts": ["concept1"],
  "missing_concepts": ["concept2"],
  "extra_concepts": ["concept3"],
  "comparison_feedback": "<2-3 sentence personalised gap analysis>",
  "improvement_tip": "<one specific, actionable tip>",
  "similarity_score": <0-100>
}}
Return only valid JSON, no markdown backticks."""


def question_fingerprint(question_text: str, role: str, difficulty: str) -> str:
    """Stable SHA-256 hash used as cache key."""
    raw = f"{question_text.lower().strip()}|{role.lower()}|{difficulty.lower()}"
    return hashlib.sha256(raw.encode()).hexdigest()[:16]


def _parse_json_response(raw: str | None) -> dict | None:
    """Safely parse a JSON response, stripping markdown fences if present."""
    if not raw:
        return None
    clean = raw.strip()
    if clean.startswith("```"):
        parts = clean.split("```")
        clean = next((p for p in parts if p.strip()
                     and not p.lower().startswith("json")), parts[0])
    try:
        return json.loads(clean.strip())
    except Exception:
        import re
        m = re.search(r'\{.*\}', clean, re.DOTALL)
        if m:
            try:
                return json.loads(m.group())
            except Exception:
                pass
    return None


async def get_or_generate_ideal_answer(
    db,
    question_text: str,
    role: str = "software engineer",
    topic: str = "",
    difficulty: str = "medium",
) -> dict:
    """
    Returns cached ideal answer if present, otherwise generates via Groq 70B and caches.
    Collection: ideal_answers (indexed on fingerprint — created in database.py)
    """
    fp = question_fingerprint(question_text, role, difficulty)

    # 1. Cache hit
    try:
        cached = await db.ideal_answers_col.find_one({"fingerprint": fp})
        if cached:
            logger.info(f"Ideal answer cache hit: {fp}")
            return {
                "ideal_answer":    cached["ideal_answer"],
                "key_concepts":    cached.get("key_concepts", []),
                "scoring_rubric":  cached.get("scoring_rubric", {}),
                "common_mistakes": cached.get("common_mistakes", []),
                "cached": True,
            }
    except Exception as e:
        logger.warning(f"Cache lookup failed: {e}")

    # 2. Generate via Groq 70B
    prompt = IDEAL_ANSWER_PROMPT.format(
        question=question_text,
        role=role,
        topic=topic or "general",
        difficulty=difficulty,
    )

    raw = await ask_groq_smart(prompt, temperature=0.3, max_tokens=2048)
    data = _parse_json_response(raw)

    if not data:
        logger.warning(
            f"Could not parse ideal answer for: {question_text[:60]}")
        data = {
            "ideal_answer":    raw or "",
            "key_concepts":    [],
            "scoring_rubric":  {"excellent": "", "good": "", "fair": "", "poor": ""},
            "common_mistakes": [],
        }

    # 3. Cache it
    try:
        await db.ideal_answers_col.insert_one({
            "fingerprint":   fp,
            "question_text": question_text,
            "role":          role,
            "topic":         topic,
            "difficulty":    difficulty,
            "created_at":    datetime.now(timezone.utc).isoformat(),
            **data,
        })
    except Exception as e:
        logger.warning(f"Cache write failed (non-fatal): {e}")

    return {**data, "cached": False}


async def benchmark_answer(
    question_text: str,
    candidate_answer: str,
    ideal_data: dict,
) -> dict:
    """
    Compare candidate answer against ideal using Groq 8B (fast).
    """
    prompt = COMPARISON_PROMPT.format(
        question=question_text,
        candidate_answer=candidate_answer,
        ideal_answer=ideal_data.get("ideal_answer", ""),
        key_concepts=", ".join(ideal_data.get("key_concepts", [])),
    )

    raw = await ask_groq(prompt, model=None, temperature=0.2, max_tokens=1024)
    parsed = _parse_json_response(raw)

    if not parsed:
        logger.warning(
            f"Could not parse benchmark comparison for: {question_text[:60]}")
        return {
            "covered_concepts":    [],
            "missing_concepts":    ideal_data.get("key_concepts", []),
            "extra_concepts":      [],
            "comparison_feedback": raw or "",
            "improvement_tip":     "",
            "similarity_score":    0,
        }

    return parsed


async def benchmark_session_answers(
    db,
    evaluated_answers: list[dict],
    role: str,
    groq_client=None,   # kept for signature compatibility — not used
) -> list[dict]:
    """
    For each answer: get/generate ideal answer, run comparison, attach results.
    Non-fatal: if anything fails the answer is returned unchanged.
    """
    enriched = []
    for ans in evaluated_answers:
        q_text = ans.get("question_text", "")
        a_text_raw = (ans.get("stt_corrected_transcript")
                      or ans.get("corrected_transcript")
                      or ans.get("transcript", ""))
        # Sanitise before benchmarking — same defence as batch_evaluate
        a_text = _sanitise_answer(a_text_raw)
        topic = ans.get("topic", "")
        difficulty = ans.get("difficulty", "medium")

        # Skip benchmarking entirely for flagged answers — no point comparing
        # injection text against an ideal answer
        if a_text.startswith("[FLAGGED"):
            enriched.append({
                **ans,
                "ideal_answer":    "",
                "key_concepts":    [],
                "scoring_rubric":  {},
                "common_mistakes": [],
                "comparison": {
                    "covered_concepts":    [],
                    "missing_concepts":    [],
                    "extra_concepts":      [],
                    "comparison_feedback": "Answer was flagged and removed — no comparison available.",
                    "improvement_tip":     "",
                    "similarity_score":    0,
                },
            })
            continue

        try:
            ideal = await get_or_generate_ideal_answer(
                db,
                question_text=q_text,
                role=role,
                topic=topic,
                difficulty=difficulty,
            )

            comparison = await benchmark_answer(q_text, a_text, ideal)

            enriched.append({
                **ans,
                "ideal_answer":    ideal.get("ideal_answer", ""),
                "key_concepts":    ideal.get("key_concepts", []),
                "scoring_rubric":  ideal.get("scoring_rubric", {}),
                "common_mistakes": ideal.get("common_mistakes", []),
                "comparison":      comparison,
            })

        except Exception as e:
            logger.warning(f"Benchmark failed for Q '{q_text[:40]}': {e}")
            enriched.append(ans)

    return enriched
