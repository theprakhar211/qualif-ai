from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime
from bson import ObjectId
from loguru import logger
import random

from models.session import SessionCreate, SessionStatus
from services.dependencies import get_current_user
from services.question_engine import (
    generate_question, generate_followup,
    generate_intro_question, generate_resume_question,
    generate_behavioural_question
)
from services.groq_service import batch_evaluate
from database import db_instance, serialize_doc

router = APIRouter()

MAX_QUESTIONS = 8


def get_phase(question_number: int, interview_type: str) -> str:
    """Determine which phase we're in based on question number and interview type."""
    if interview_type == 'quick':
        return 'technical'
    # Complete interview phases
    if question_number <= 2:
        return 'intro'
    if question_number <= 4:
        return 'resume'
    if question_number <= 7:
        return 'technical'
    return 'behavioural'


PHASE_LABELS = {
    'intro':       'Introduction',
    'resume':      'Resume Review',
    'technical':   'Technical',
    'behavioural': 'Behavioural',
}


@router.post("/start")
async def start_interview(
    data: SessionCreate,
    current_user: dict = Depends(get_current_user)
):
    user_id = str(current_user["_id"])

    # Fetch user's resume if available
    user = await db_instance.users_col.find_one({"_id": current_user["_id"]})
    resume_data = user.get("resume", {}) if user else {}

    interview_type = getattr(data, 'interview_type', 'quick') or 'quick'
    phase = get_phase(1, interview_type)

    # Generate first question based on type
    if phase == 'intro':
        first_question = await generate_intro_question(data.role, 1)
    else:
        topic = data.topics[0] if data.topics else "General"
        first_question = await generate_question(
            role=data.role,
            topic=topic,
            difficulty=data.difficulty,
            asked_questions=[],
            resume_data=resume_data
        )

    session_doc = {
        "user_id":          user_id,
        "role":             data.role,
        "topics":           data.topics,
        "difficulty":       data.difficulty,
        "interview_type":   interview_type,
        "current_phase":    phase,
        "status":           SessionStatus.active,
        "current_question": first_question,
        "asked_questions":  [first_question],
        "answers":          [],
        "resume_data":      resume_data,
        "evaluated":        False,
        "overall_score":    0,
        "created_at":       datetime.utcnow()
    }

    result     = await db_instance.sessions_col.insert_one(session_doc)
    session_id = str(result.inserted_id)

    logger.info(f"Session started: {session_id} | type={interview_type} | phase={phase}")

    return {
        "session_id":     session_id,
        "first_question": first_question,
        "role":           data.role,
        "difficulty":     data.difficulty,
        "interview_type": interview_type,
        "phase":          phase,
        "phase_label":    PHASE_LABELS.get(phase, 'Interview'),
    }


@router.get("/session/{session_id}")
async def get_session(
    session_id: str,
    current_user: dict = Depends(get_current_user)
):
    session = await db_instance.sessions_col.find_one({"_id": ObjectId(session_id)})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return serialize_doc(session)


@router.post("/end/{session_id}")
async def end_interview(
    session_id: str,
    current_user: dict = Depends(get_current_user)
):
    await db_instance.sessions_col.update_one(
        {"_id": ObjectId(session_id)},
        {"$set": {"status": SessionStatus.completed, "ended_at": datetime.utcnow()}}
    )
    return {"message": "Session ended", "session_id": session_id}


@router.post("/next-question/{session_id}")
async def next_question(
    session_id: str,
    current_user: dict = Depends(get_current_user)
):
    session = await db_instance.sessions_col.find_one({"_id": ObjectId(session_id)})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    asked         = session.get("asked_questions", [])
    answers       = session.get("answers", [])
    role          = session["role"]
    difficulty    = session["difficulty"]
    topics        = session.get("topics", ["General"])
    resume_data   = session.get("resume_data", {})
    interview_type = session.get("interview_type", "quick")

    # Current question number is answers count + 1 (since we just submitted one)
    # Next question will be answers count + 2
    next_q_number = len(answers) + 2

    # Adaptive difficulty for technical phase
    if answers:
        recent    = answers[-3:]
        avg_words = sum(a.get("word_count", 50) for a in recent) / len(recent)
        if avg_words >= 80:    difficulty = "hard"
        elif avg_words >= 30:  difficulty = "medium"
        else:                  difficulty = "easy"

    phase = get_phase(next_q_number, interview_type)

    logger.info(f"Next question: session={session_id} | q={next_q_number} | phase={phase} | type={interview_type}")

    question = None

    if phase == 'intro':
        question = await generate_intro_question(role, next_q_number)

    elif phase == 'resume':
        question = await generate_resume_question(role, resume_data, asked)

    elif phase == 'behavioural':
        question = await generate_behavioural_question(asked)

    else:
        # Technical phase — alternate between new questions and follow-ups
        use_followup = len(answers) > 0 and len(answers) % 2 != 0

        if use_followup and answers:
            last     = answers[-1]
            question = await generate_followup(
                role=role,
                previous_question=last["question_text"],
                previous_answer=last["transcript"],
                difficulty=difficulty,
                resume_data=resume_data
            )
        else:
            topic    = random.choice(topics)
            question = await generate_question(
                role=role,
                topic=topic,
                difficulty=difficulty,
                asked_questions=asked,
                resume_data=resume_data
            )

    await db_instance.sessions_col.update_one(
        {"_id": ObjectId(session_id)},
        {
            "$push": {"asked_questions": question},
            "$set":  {
                "current_question":   question,
                "current_phase":      phase,
                "current_difficulty": difficulty
            }
        }
    )

    return {
        "question":    question,
        "difficulty":  difficulty,
        "phase":       phase,
        "phase_label": PHASE_LABELS.get(phase, 'Interview'),
        "q_number":    next_q_number,
    }


@router.post("/submit-answer/{session_id}")
async def submit_answer(
    session_id: str,
    data: dict,
    current_user: dict = Depends(get_current_user)
):
    """Fast answer storage — no AI call. Full evaluation at end."""
    transcript = data.get("transcript", "").strip()
    question   = data.get("question_text", "")
    duration   = data.get("duration_seconds", 0)
    input_mode = data.get("input_mode", "voice")
    phase      = data.get("phase", "technical")

    if not transcript:
        raise HTTPException(status_code=400, detail="Empty transcript")

    words      = transcript.split()
    word_count = len(words)
    wpm        = round((word_count / max(duration, 1)) * 60) if input_mode == "voice" else 0

    filler_list = ["um", "uh", "like", "basically", "literally",
                   "you know", "sort of", "kind of", "actually"]
    fillers = [w for w in words if w.lower() in filler_list] if input_mode == "voice" else []

    answer_entry = {
        "question_text":    question,
        "transcript":       transcript,
        "input_mode":       input_mode,
        "phase":            phase,
        "duration_seconds": duration,
        "word_count":       word_count,
        "filler_words":     fillers,
        "wpm":              wpm,
        "submitted_at":     datetime.utcnow().isoformat()
    }

    await db_instance.sessions_col.update_one(
        {"_id": ObjectId(session_id)},
        {"$push": {"answers": answer_entry}}
    )

    return {
        "stored":       True,
        "word_count":   word_count,
        "wpm":          wpm,
        "filler_words": fillers[:5],
    }


@router.post("/evaluate/{session_id}")
async def evaluate_session(
    session_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Batch evaluate all answers at once using Groq."""
    session = await db_instance.sessions_col.find_one({"_id": ObjectId(session_id)})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    answers = session.get("answers", [])
    if not answers:
        raise HTTPException(status_code=400, detail="No answers to evaluate")

    role           = session.get("role", "Software Engineer")
    interview_type = session.get("interview_type", "quick")

    logger.info(f"Batch evaluating {session_id} — {len(answers)} answers | type={interview_type}")

    evaluations = await batch_evaluate(role, answers, interview_type)

    evaluated_answers = []
    total_score       = 0

    for i, answer in enumerate(answers):
        eval_data  = evaluations[i] if i < len(evaluations) else {}
        score      = max(0, min(100, int(eval_data.get("score", 50))))
        total_score += score

        corrected     = eval_data.get("corrected_transcript", answer["transcript"])
        was_corrected = corrected.strip().lower() != answer["transcript"].strip().lower()

        evaluated_answers.append({
            **answer,
            "quick_score":          score,
            "ai_score":             score,
            "reasoning":            eval_data.get("reasoning", ""),
            "keywords_found":       eval_data.get("keywords_mentioned", []),
            "missing_concepts":     eval_data.get("missing_concepts", []),
            "corrected_transcript": corrected,
            "was_corrected":        was_corrected,
        })

    avg_score = round(total_score / len(answers)) if answers else 0

    await db_instance.sessions_col.update_one(
        {"_id": ObjectId(session_id)},
        {"$set": {
            "answers":       evaluated_answers,
            "overall_score": avg_score,
            "evaluated":     True,
            "status":        SessionStatus.completed,
            "ended_at":      datetime.utcnow()
        }}
    )

    logger.info(f"Evaluation complete — {session_id} | avg={avg_score}")

    return {
        "overall_score": avg_score,
        "answers":       evaluated_answers,
        "session_id":    session_id,
        "interview_type": interview_type,
    }
