from groq import AsyncGroq
from loguru import logger
from config import settings
import json
import re

client = AsyncGroq(api_key=settings.GROQ_API_KEY)


async def ask_groq(
    prompt: str,
    system: str = "",
    model: str = None,
    temperature: float = 0.7,
    max_tokens: int = 1024      # ← add this parameter
) -> str | None:
    if model is None:
        model = settings.GROQ_FAST_MODEL
    try:
        messages = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})

        response = await client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,   # ← use it here
        )
        return response.choices[0].message.content.strip()

    except Exception as e:
        logger.error(f"Groq error ({model}): {e}")
        return None


async def batch_evaluate(
    role: str,
    answers: list[dict]
) -> list[dict]:
    """
    Evaluate all interview answers in a single Groq API call.
    Returns a list of evaluation dicts in the same order as the input.
    """
    if not answers:
        return []

    answers_text = ""
    for i, a in enumerate(answers, 1):
        mode = a.get("input_mode", "voice")
        answers_text += f"""
Q{i}: {a.get('question_text', '')}
A{i} ({mode}): {a.get('transcript', '')}
"""

    prompt = f"""You are evaluating a complete mock interview for a {role} position.
Evaluate ALL {len(answers)} answers below and return a JSON array.

{answers_text}

Return ONLY a valid JSON array with exactly {len(answers)} objects in this exact format:
[
  {{
    "question_number": 1,
    "score": <integer 0-100>,
    "reasoning": "<one clear sentence explaining the score>",
    "keywords_mentioned": ["<concept>", "<concept>"],
    "missing_concepts": ["<concept>", "<concept>"],
    "corrected_transcript": "<fix speech recognition errors only, or return the original if no errors>"
  }}
]

Scoring guide:
- 0-20:   No answer, "I don't know", completely wrong or irrelevant
- 21-40:  Very weak, major gaps, mostly incorrect
- 41-60:  Partial, some correct points but missing key concepts
- 61-80:  Good, covers main points with minor gaps
- 81-100: Excellent, comprehensive and accurate

Rules:
- For corrected_transcript: ONLY fix obvious speech recognition errors (e.g. "hazmats" to "hashmaps"). Never change the meaning or add content.
- For voice answers (marked as "voice"): be slightly more lenient on structure since it was spoken
- For typed answers (marked as "text"): evaluate strictly on completeness
- Be strict overall — vague answers score below 50
- Return ONLY the JSON array, no preamble, no explanation"""

    logger.info(
        f"Sending batch evaluation to Groq — {len(answers)} answers, model: {settings.GROQ_SMART_MODEL}")
    result = await ask_groq(prompt, model=settings.GROQ_SMART_MODEL, temperature=0.2, max_tokens=4096)

    if not result:
        logger.warning(
            "Groq batch evaluation returned None — using fallback scores")
        return _fallback_evaluations(answers)

    try:
        json_match = re.search(r'\[.*\]', result, re.DOTALL)
        if not json_match:
            logger.warning(f"No JSON array in Groq response: {result[:300]}")
            return _fallback_evaluations(answers)

        parsed = json.loads(json_match.group())

        if len(parsed) != len(answers):
            logger.warning(
                f"Expected {len(answers)} results, got {len(parsed)} — padding with fallbacks")
            while len(parsed) < len(answers):
                parsed.append(_fallback_eval(
                    len(parsed), answers[len(parsed)]))

        logger.info(
            f"Batch evaluation complete — scores: {[p.get('score') for p in parsed]}")
        return parsed

    except Exception as e:
        logger.error(f"Failed to parse batch evaluation: {e}")
        logger.error(f"Raw response: {result[:500]}")
        return _fallback_evaluations(answers)


def _fallback_eval(index: int, answer: dict) -> dict:
    return {
        "question_number":     index + 1,
        "score":               50,
        "reasoning":           "Evaluation unavailable — please review manually.",
        "keywords_mentioned":  [],
        "missing_concepts":    [],
        "corrected_transcript": answer.get("transcript", "")
    }


def _fallback_evaluations(answers: list[dict]) -> list[dict]:
    return [_fallback_eval(i, a) for i, a in enumerate(answers)]
