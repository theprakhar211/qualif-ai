from services.groq_service import ask_groq
from services.resume_parser import build_resume_context
from database import db_instance
from loguru import logger
import random

SYSTEM_PROMPT = """You are a professional technical interviewer.
Your job is to ask clear, concise interview questions.
Reply with ONLY the question itself — no preamble, no numbering, no explanation."""

INTRO_QUESTIONS = [
    "Tell me about yourself and your background.",
    "Can you walk me through your journey into {role} and what drew you to this field?",
]

BEHAVIOURAL_QUESTIONS = [
    "Tell me about a time you had to learn something new very quickly. How did you approach it?",
    "Describe a situation where you disagreed with a teammate. How did you handle it?",
    "Tell me about a project you're most proud of and why.",
    "Describe a time you faced a difficult technical problem. What was your approach?",
    "Tell me about a time you had to meet a tight deadline. How did you manage it?",
    "Describe a situation where you had to work with someone difficult. What did you do?",
]


async def generate_intro_question(
    role: str,
    question_number: int
) -> str:
    """Generate introduction phase questions (Q1-Q2 of complete interview)."""

    if question_number == 1:
        return f"Tell me about yourself — your background, what you've been working on, and what brings you to interview for a {role} position."

    prompt = f"""You are starting a job interview for a {role} position.
Ask the candidate a warm, open-ended second introduction question.
Good examples:
- "What excites you most about working as a {role}?"
- "Walk me through your most significant project or achievement so far."
- "What do you consider your biggest strength as a {role}?"

Reply with ONLY the question. Keep it conversational and open-ended."""

    result = await ask_groq(prompt, SYSTEM_PROMPT, temperature=0.7)
    return result or f"What excites you most about the {role} field and why did you choose this career path?"


async def generate_resume_question(
    role: str,
    resume_data: dict,
    asked_questions: list = []
) -> str:
    """Generate resume-specific questions (Q3-Q4 of complete interview)."""

    if not resume_data or not any(resume_data.values()):
        return await generate_behavioural_question(asked_questions)

    ctx = build_resume_context(resume_data)

    avoid = ""
    if asked_questions:
        avoid = "\nDo NOT ask any of these already-asked questions:\n" + \
                "\n".join(f"- {q}" for q in asked_questions[-4:])

    prompt = f"""You are interviewing a candidate for a {role} position.
Candidate background: {ctx}

Ask ONE specific question directly referencing something from their background.
Good examples:
- "I see you've worked with [specific technology] — can you tell me about a challenge you faced using it?"
- "You mentioned [specific project/role] — what was the most difficult part of that?"
- "Walk me through your experience with [specific skill from their background]"

Rules:
- Reference something SPECIFIC from their background — don't ask generic questions
- Ask a conceptual/experience question — NOT "write code for X"
- Keep it conversational, like a real interviewer who read their CV{avoid}

Reply with ONLY the question."""

    result = await ask_groq(prompt, SYSTEM_PROMPT, temperature=0.6)
    return result or f"Walk me through the project or role you're most proud of in your background."


async def generate_behavioural_question(
    asked_questions: list = []
) -> str:
    """Generate behavioural questions (Q8 of complete interview)."""
    unused = [q for q in BEHAVIOURAL_QUESTIONS if q not in asked_questions]
    if not unused:
        unused = BEHAVIOURAL_QUESTIONS
    return random.choice(unused)


async def generate_question(
    role: str,
    topic: str,
    difficulty: str,
    asked_questions: list = [],
    resume_data: dict = None
) -> str:
    """Generate technical questions — core of both Quick Practice and Complete Interview."""

    avoid = ""
    if asked_questions:
        avoid = "\nDo NOT ask any of these already-asked questions:\n" + \
                "\n".join(f"- {q}" for q in asked_questions[-5:])

    resume_context = ""
    if resume_data:
        ctx = build_resume_context(resume_data)
        if ctx:
            resume_context = f"\nCandidate background: {ctx}"
            resume_context += "\nPersonalize the question to their background where naturally relevant."

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
        logger.warning("Groq unavailable for question generation, using fallback.")
        return await get_fallback_question(role, difficulty, asked_questions)

    return question


async def generate_followup(
    role: str,
    previous_question: str,
    previous_answer: str,
    difficulty: str,
    resume_data: dict = None
) -> str:
    """Generate contextual follow-up based on the previous answer."""

    resume_context = ""
    if resume_data:
        ctx = build_resume_context(resume_data)
        if ctx:
            resume_context = f"\nCandidate background: {ctx}"

    prompt = f"""You are interviewing a {role} candidate.{resume_context}

Previous question: {previous_question}
Candidate's answer: {previous_answer}

Ask ONE sharp follow-up question that:
- Probes deeper into something they mentioned
- Or challenges an assumption in their answer
- Or asks for a concrete example if they were vague
- If relevant, connect to their background

IMPORTANT RULES:
- Ask CONCEPTUAL questions only — do NOT ask them to write code
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
    query  = {"role": role, "difficulty": difficulty}
    cursor = db_instance.questions_col.find(query)
    questions = await cursor.to_list(length=50)

    unused = [q for q in questions if q["text"] not in asked_questions]
    if not unused:
        unused = questions

    if not unused:
        return "Tell me about a challenging technical problem you solved recently and how you approached it."

    return random.choice(unused)["text"]
