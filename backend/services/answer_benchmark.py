"""
services/answer_benchmark.py
Generates, caches, and compares ideal answers per question.
Ideal answers are generated once by Groq and stored in MongoDB.
"""

import hashlib
import json
from datetime import datetime, timezone
from typing import Optional
from services.groq_service import ask_groq

# ---------------------------------------------------------------------------
# Ideal answer generation (one-time per question fingerprint)
# ---------------------------------------------------------------------------

IDEAL_ANSWER_PROMPT = """You are a senior software engineer and technical interviewer.

Given this interview question:
<question>{question}</question>

Role: {role}
Topic: {topic}
Difficulty: {difficulty}

Generate an ideal interview answer. Return ONLY a JSON object with these exact keys:
{{
  "ideal_answer": "<2–4 paragraph ideal answer a strong candidate would give>",
  "key_concepts": ["concept1", "concept2", ...],  // 4–8 must-cover concepts
  "scoring_rubric": {{
    "excellent": "<what an 90–100 answer includes>",
    "good": "<what a 70–89 answer includes>",
    "fair": "<what a 50–69 answer includes>",
    "poor": "<what a 0–49 answer looks like>"
  }},
  "common_mistakes": ["mistake1", "mistake2"]  // top 3 mistakes candidates make
}}

Return only valid JSON, no markdown, no preamble."""


def question_fingerprint(question_text: str, role: str, difficulty: str) -> str:
    """Stable hash for cache key."""
    raw = f"{question_text.lower().strip()}|{role.lower()}|{difficulty.lower()}"
    return hashlib.sha256(raw.encode()).hexdigest()[:16]


async def get_or_generate_ideal_answer(
    db,
    question_text: str,
    role: str = "software engineer",
    topic: str = "",
    difficulty: str = "medium",
    groq_client=None,
) -> dict:
    """
    Returns cached ideal answer if present, otherwise generates and caches it.
    Collection: ideal_answers  (indexed on fingerprint)
    """
    fp = question_fingerprint(question_text, role, difficulty)

    # 1. Try cache
    cached = await db.ideal_answers.find_one({"fingerprint": fp})
    if cached:
        return {
            "ideal_answer": cached["ideal_answer"],
            "key_concepts": cached["key_concepts"],
            "scoring_rubric": cached["scoring_rubric"],
            "common_mistakes": cached["common_mistakes"],
            "cached": True,
        }

    # 2. Generate via Groq
    if groq_client is None:
        raise RuntimeError("groq_client required for ideal answer generation")

    prompt = IDEAL_ANSWER_PROMPT.format(
        question=question_text,
        role=role,
        topic=topic,
        difficulty=difficulty,
    )

    # use 70B for ideal answers
    raw = await ask_groq(prompt, model="smart")
    try:
        clean = raw.strip().lstrip("```json").lstrip("```").rstrip("```").strip()
        data = json.loads(clean)
    except Exception:
        # Fallback — return empty structure so the app doesn't crash
        data = {
            "ideal_answer": raw,
            "key_concepts": [],
            "scoring_rubric": {"excellent": "", "good": "", "fair": "", "poor": ""},
            "common_mistakes": [],
        }

    # 3. Cache
    await db.ideal_answers.insert_one({
        "fingerprint": fp,
        "question_text": question_text,
        "role": role,
        "topic": topic,
        "difficulty": difficulty,
        "created_at": datetime.now(timezone.utc).isoformat(),
        **data,
    })

    return {**data, "cached": False}


# ---------------------------------------------------------------------------
# Answer comparison / benchmarking
# ---------------------------------------------------------------------------

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
  "covered_concepts": ["concept1", ...],   // concepts the candidate actually covered
  "missing_concepts": ["concept2", ...],   // concepts from key_concepts not covered
  "extra_concepts": ["concept3", ...],     // good additions the candidate mentioned
  "comparison_feedback": "<2–3 sentence personalised gap analysis>",
  "improvement_tip": "<one specific, actionable tip>",
  "similarity_score": <0–100>              // how close to ideal (not the quality score)
}}
Return only valid JSON."""


async def benchmark_answer(
    question_text: str,
    candidate_answer: str,
    ideal_data: dict,
    groq_client,
) -> dict:
    """
    Compare candidate answer against ideal using Groq.
    Returns structured comparison.
    """
    prompt = COMPARISON_PROMPT.format(
        question=question_text,
        candidate_answer=candidate_answer,
        ideal_answer=ideal_data["ideal_answer"],
        key_concepts=", ".join(ideal_data.get("key_concepts", [])),
    )

    # 8B is fine for comparison
    raw = await ask_groq(prompt, model="fast")
    try:
        clean = raw.strip().lstrip("```json").lstrip("```").rstrip("```").strip()
        return json.loads(clean)
    except Exception:
        return {
            "covered_concepts": [],
            "missing_concepts": ideal_data.get("key_concepts", []),
            "extra_concepts": [],
            "comparison_feedback": raw,
            "improvement_tip": "",
            "similarity_score": 0,
        }


# ---------------------------------------------------------------------------
# Convenience: run full benchmark for a completed session
# ---------------------------------------------------------------------------

async def benchmark_session_answers(
    db,
    evaluated_answers: list[dict],  # from batch_evaluate output
    role: str,
    groq_client,
) -> list[dict]:
    """
    For each answer in a completed session:
    1. Get/generate ideal answer
    2. Run comparison
    3. Attach results

    Returns enriched answer list.
    """
    enriched = []
    for ans in evaluated_answers:
        q_text = ans.get("question_text", "")
        a_text = ans.get("stt_corrected_transcript") or ans.get(
            "answer_text", "")
        topic = ans.get("topic", "")
        difficulty = ans.get("difficulty", "medium")

        ideal = await get_or_generate_ideal_answer(
            db,
            question_text=q_text,
            role=role,
            topic=topic,
            difficulty=difficulty,
            groq_client=groq_client,
        )

        comparison = await benchmark_answer(q_text, a_text, ideal, groq_client)

        enriched.append({
            **ans,
            "ideal_answer": ideal["ideal_answer"],
            "key_concepts": ideal["key_concepts"],
            "scoring_rubric": ideal["scoring_rubric"],
            "common_mistakes": ideal.get("common_mistakes", []),
            "comparison": comparison,
        })

    return enriched
