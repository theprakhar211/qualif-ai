from services.groq_service import ask_groq
from services.resume_parser import build_resume_context
from database import db_instance
from loguru import logger
import random

SYSTEM_PROMPT = """You are a professional technical interviewer.
Your job is to ask clear, concise interview questions.
Reply with ONLY the question itself — no preamble, no numbering, no explanation."""


async def generate_question(
    role: str,
    topic: str,
    difficulty: str,
    asked_questions: list = [],
    resume_data: dict = None        # ← new parameter
) -> str:
    avoid = ""
    if asked_questions:
        avoid = "\nDo NOT ask any of these already-asked questions:\n" + \
                "\n".join(f"- {q}" for q in asked_questions[-5:])

    # Build resume context if available
    resume_context = ""
    if resume_data:
        ctx = build_resume_context(resume_data)
        if ctx:
            resume_context = f"\nCandidate background: {ctx}"
            resume_context += "\nPersonalize the question to their background where relevant."

    prompt = f"""Generate a {difficulty} difficulty {topic} interview question
for a {role} position.{avoid}{resume_context}

IMPORTANT RULES:
- Ask CONCEPTUAL or DESIGN questions only
- Do NOT ask questions that require writing code
- Do NOT say "write a function", "implement", "code a solution"
- Instead ask: how would you approach, explain how, what is the difference,
  describe the algorithm, walk me through your thinking
- The question should be answerable verbally in 1-2 minutes
"""

    question = await ask_groq(prompt, SYSTEM_PROMPT)

    if not question:
        logger.warning(
            "Groq unavailable for question generation, using fallback.")
        return await get_fallback_question(role, difficulty, asked_questions)

    return question


async def generate_followup(
    role: str,
    previous_question: str,
    previous_answer: str,
    difficulty: str,
    resume_data: dict = None        # ← new parameter
) -> str:
    resume_context = ""
    if resume_data:
        ctx = build_resume_context(resume_data)
        if ctx:
            resume_context = f"\nCandidate background: {ctx}"

    prompt = f"""You are interviewing a {role} candidate.{resume_context}

Previous question: {previous_question}
Candidate's answer: {previous_answer}

Ask ONE sharp follow-up question at {difficulty} difficulty that:
- Probes deeper into something they mentioned
- Or challenges an assumption in their answer
- Or asks for a concrete example if they were vague
- If relevant, connect to their background

IMPORTANT RULES:
- Ask CONCEPTUAL questions only — do NOT ask them to write or implement code
- The question must be answerable verbally in 1-2 minutes

Reply with ONLY the follow-up question."""

    followup = await ask_groq(prompt, SYSTEM_PROMPT)

    if not followup:
        return await generate_question(role, "General", difficulty, [previous_question])

    return followup


async def get_fallback_question(
    role: str,
    difficulty: str,
    asked_questions: list = []
) -> str:
    query = {"role": role, "difficulty": difficulty}
    cursor = db_instance.questions_col.find(query)
    questions = await cursor.to_list(length=50)

    unused = [q for q in questions if q["text"] not in asked_questions]
    if not unused:
        unused = questions

    if not unused:
        return "Tell me about a challenging technical problem you solved recently and how you approached it."

    return random.choice(unused)["text"]
