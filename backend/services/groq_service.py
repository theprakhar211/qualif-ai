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
    max_tokens: int = 1024,
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
            max_tokens=max_tokens,
        )
        return response.choices[0].message.content.strip()

    except Exception as e:
        logger.error(f"Groq error ({model}): {e}")
        return None


async def ask_groq_smart(
    prompt: str,
    system: str = "",
    temperature: float = 0.3,
    max_tokens: int = 2048,
) -> str | None:
    """Convenience wrapper that always uses the smart (70B) model."""
    return await ask_groq(
        prompt,
        system=system,
        model=settings.GROQ_SMART_MODEL,
        temperature=temperature,
        max_tokens=max_tokens,
    )


async def batch_evaluate(
    role: str,
    answers: list,
    interview_type: str = "quick"
) -> list:
    """
    Evaluate all interview answers in a single Groq API call.
    Scoring criteria adapts based on interview_type and phase.

    Returns list of dicts with keys:
      question_number, score, reasoning,
      keywords_mentioned, missing_concepts, corrected_transcript
    """
    if not answers:
        return []

    answers_text = ""
    for i, a in enumerate(answers, 1):
        phase = a.get("phase", "technical")
        mode = a.get("input_mode", "voice")
        answers_text += f"\nQ{i} [{phase.upper()}]: {a.get('question_text', '')}\nA{i} ({mode}): {a.get('transcript', '')}\n"

    phase_guidance = ""
    if interview_type == "complete":
        phase_guidance = """
Phase-specific scoring:
- INTRO phase: Score on clarity, self-awareness, and communication. NOT on technical depth.
- RESUME phase: Score on how well they explained their actual experience. Penalize vague non-answers.
- TECHNICAL phase: Score strictly on technical accuracy and completeness.
- BEHAVIOURAL phase: Score on STAR format (Situation, Task, Action, Result). Give partial credit for good structure.
"""

    prompt = f"""You are evaluating a {'complete structured' if interview_type == 'complete' else 'technical'} mock interview for a {role} position.
Evaluate ALL questions and answers below.
{phase_guidance}

{answers_text}

Return ONLY a valid JSON array with exactly {len(answers)} objects:
[
  {{
    "question_number": 1,
    "score": <integer 0-100>,
    "reasoning": "<one clear sentence explaining the score>",
    "keywords_mentioned": ["<concept>", "<concept>"],
    "missing_concepts": ["<concept>", "<concept>"],
    "corrected_transcript": "<fix only speech recognition errors, return original if none>"
  }}
]

General scoring guide:
- 0-20:   No answer, completely wrong, or irrelevant
- 21-40:  Very weak, major gaps
- 41-60:  Partial answer, some correct points but missing key concepts
- 61-80:  Good, covers main points with minor gaps
- 81-100: Excellent, comprehensive and well-structured

Rules:
- corrected_transcript: fix ONLY obvious STT errors like "hazmaps"→"hashmaps". Never change meaning.
- Voice answers: be slightly more lenient with structure
- Typed answers: evaluate more strictly on completeness
- Be strict overall. Vague answers score below 50.
- Return ONLY the JSON array, no other text."""

    logger.info(
        f"Batch evaluating {len(answers)} answers | type={interview_type}")
    result = await ask_groq(
        prompt,
        model=settings.GROQ_SMART_MODEL,
        temperature=0.2,
        max_tokens=4096
    )

    if not result:
        logger.warning("Groq batch evaluation returned None")
        return _fallback_evaluations(answers)

    try:
        json_match = re.search(r'\[.*\]', result, re.DOTALL)
        if not json_match:
            logger.warning(f"No JSON array in response: {result[:300]}")
            return _fallback_evaluations(answers)

        parsed = json.loads(json_match.group())

        if len(parsed) != len(answers):
            logger.warning(f"Expected {len(answers)} evals, got {len(parsed)}")
            while len(parsed) < len(answers):
                parsed.append(_fallback_eval(
                    len(parsed) + 1, answers[len(parsed)]))

        logger.info("Batch evaluation parsed successfully")
        return parsed

    except Exception as e:
        logger.error(f"Failed to parse batch evaluation: {e}")
        logger.error(f"Raw response: {result[:500]}")
        return _fallback_evaluations(answers)


def _fallback_eval(index: int, answer: dict) -> dict:
    return {
        "question_number":     index,
        "score":               50,
        "reasoning":           "Evaluation unavailable — Groq API error.",
        "keywords_mentioned":  [],
        "missing_concepts":    [],
        "corrected_transcript": answer.get("transcript", "")
    }


def _fallback_evaluations(answers: list) -> list:
    return [_fallback_eval(i + 1, a) for i, a in enumerate(answers)]
