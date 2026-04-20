from services.groq_service import ask_groq
from services.resume_parser import build_resume_context
from database import db_instance
from loguru import logger
import random
import hashlib


def question_hash(question_text: str) -> str:
    """8-character hash to uniquely fingerprint a question for deduplication."""
    return hashlib.sha256(question_text.strip().lower().encode()).hexdigest()[:8]


# ── Answer quality checks ─────────────────────────────────────────────────────

# Option A: known non-answer strings (instant, no API call)
_NON_ANSWER_EXACT = {
    "no", "yes", "idk", "skip", "pass", "next", "none", "nope",
    "i don't know", "i dont know", "not sure", "no idea", "i have no idea",
    "answer here", "no answer", "nothing", "n/a", "na",
}


def _is_empty_answer_local(transcript: str) -> bool:
    """
    Option A — instant local check.
    Returns True if the answer is clearly empty or a non-attempt.
    """
    t = transcript.strip().lower()
    if not t:
        return True
    if t in _NON_ANSWER_EXACT:
        return True
    # Very short answers (under 6 words) that aren't meaningful
    words = t.split()
    if len(words) < 6:
        # Allow short answers that contain substance signals
        substance_signals = ["because", "since", "use",
                             "lifo", "fifo", "o(", "stack", "queue"]
        if not any(sig in t for sig in substance_signals):
            return True
    return False


async def _is_substantive_answer_llm(
    question: str,
    answer: str,
) -> bool:
    """
    Option B — Groq fast model classification.
    Returns True if the answer genuinely attempts to address the question.
    Only called if Option A passes.
    """
    prompt = f"""Interview question: {question}
Candidate answer: {answer}

Does this answer make a genuine attempt to address the question?
Reply with only YES or NO."""

    result = await ask_groq(prompt, model=None, temperature=0.0, max_tokens=5)
    if not result:
        return True  # if API fails, assume answer is ok — don't block flow
    return result.strip().upper().startswith("Y")


async def should_generate_followup(
    question: str,
    answer: str,
) -> bool:
    """
    Combined Option A + B check.
    Returns True only if the answer is substantive enough to follow up on.
    """
    # Option A — instant check
    if _is_empty_answer_local(answer):
        logger.info(f"Follow-up skipped: empty/non-answer detected locally")
        return False

    # Option B — LLM check
    substantive = await _is_substantive_answer_llm(question, answer)
    if not substantive:
        logger.info(
            f"Follow-up skipped: LLM classified answer as non-substantive")
        return False

    return True


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
    resume_data: dict = None,
    seen_question_hashes: list = [],
) -> str:
    """Generate technical questions — core of both Quick Practice and Complete Interview."""

    avoid = ""
    if asked_questions:
        avoid = "\nDo NOT ask any of these already-asked questions:\n" + \
                "\n".join(f"- {q}" for q in asked_questions[-5:])

    # Add cross-session deduplication hint
    seen_note = ""
    if seen_question_hashes:
        seen_note = f"\nThis candidate has already answered {len(seen_question_hashes)} questions across previous sessions. Generate something DIFFERENT — avoid repeating concepts they have already been asked about."

    resume_context = ""
    if resume_data:
        ctx = build_resume_context(resume_data)
        if ctx:
            resume_context = f"\nCandidate background: {ctx}"
            resume_context += "\nPersonalize the question to their background where naturally relevant."

    prompt = f"""Generate a {difficulty} difficulty {topic} interview question
for a {role} position.{avoid}{seen_note}{resume_context}

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


async def generate_question_adaptive(
    role: str,
    topic: str,
    difficulty: str,
    asked_questions: list = [],
    resume_data: dict = None,
    user_id: str = None,
    session_skills_covered: list = None,
    seen_question_hashes: list = [],
) -> tuple[str, str]:
    """
    Adaptive wrapper around generate_question().
    If user_id is provided, targets the user's weakest unpractised skill this session.
    Returns (question_text, resolved_topic).
    """
    resolved_topic = topic

    if user_id and session_skills_covered is not None:
        try:
            from services.skill_graph import load_skill_graph, infer_skill
            graph = await load_skill_graph(db_instance, user_id)
            target_skill = graph.get_target_skill(
                attempted_this_session=session_skills_covered)
            if target_skill:
                resolved_topic = target_skill
                difficulty = _infer_difficulty(graph.mastery_for(target_skill))
                logger.info(
                    f"Adaptive targeting: skill={target_skill} difficulty={difficulty}")
        except Exception as e:
            logger.warning(
                f"Skill graph adaptive targeting failed, using original topic: {e}")

    question = await generate_question(
        role=role,
        topic=resolved_topic,
        difficulty=difficulty,
        asked_questions=asked_questions,
        resume_data=resume_data,
        seen_question_hashes=seen_question_hashes,
    )
    return question, resolved_topic


def _infer_difficulty(mastery: float) -> str:
    """Scale difficulty to current skill mastery."""
    if mastery < 40:
        return "easy"
    if mastery < 70:
        return "medium"
    return "hard"


async def generate_followup(
    role: str,
    previous_question: str,
    previous_answer: str,
    difficulty: str,
    resume_data: dict = None,
    topics: list = None,
    seen_question_hashes: list = [],
) -> tuple[str, bool]:
    """
    Generate a follow-up if the previous answer was substantive.
    Returns (question_text, was_followup).
    If answer wasn't substantive, returns a fresh question instead.
    """
    # Check answer quality before generating follow-up
    if not await should_generate_followup(previous_question, previous_answer):
        # Answer wasn't real — generate a fresh question on a new topic
        topic = random.choice(topics) if topics else "General"
        fresh = await generate_question(
            role=role,
            topic=topic,
            difficulty=difficulty,
            asked_questions=[previous_question],
            seen_question_hashes=seen_question_hashes,
        )
        return fresh, False

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
        fresh = await generate_question(role, "General", difficulty, [previous_question])
        return fresh, False

    return followup, True


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
