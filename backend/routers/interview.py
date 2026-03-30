from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime
from bson import ObjectId
from loguru import logger
import random

from models.session import SessionCreate, SessionStatus
from services.dependencies import get_current_user
from services.question_engine import generate_question, generate_followup
from services.groq_service import batch_evaluate
from database import db_instance, serialize_doc

router = APIRouter()


@router.post("/start")
async def start_interview(
    data: SessionCreate,
    current_user: dict = Depends(get_current_user)
):
    user_id = str(current_user["_id"])

    # Fetch resume if available
    user = await db_instance.users_col.find_one({"_id": current_user["_id"]})
    resume_data = user.get("resume", {}) if user else {}

    topic = data.topics[0] if data.topics else "General"
    first_question = await generate_question(
        role=data.role,
        topic=topic,
        difficulty=data.difficulty,
        asked_questions=[],
        resume_data=resume_data      # ← pass resume
    )

    session_doc = {
        "user_id":          user_id,
        "role":             data.role,
        "topics":           data.topics,
        "difficulty":       data.difficulty,
        "status":           SessionStatus.active,
        "current_question": first_question,
        "asked_questions":  [first_question],
        "answers":          [],
        "resume_data":      resume_data,   # ← store in session
        "evaluated":        False,
        "overall_score":    0,
        "created_at":       datetime.utcnow()
    }

    result = await db_instance.sessions_col.insert_one(session_doc)
    session_id = str(result.inserted_id)

    logger.info(f"Session started: {session_id} — role: {data.role}")

    return {
        "session_id":     session_id,
        "first_question": first_question,
        "role":           data.role,
        "difficulty":     data.difficulty
    }


@router.get("/session/{session_id}")
async def get_session(
    session_id: str,
    current_user: dict = Depends(get_current_user)
):
    session = await db_instance.sessions_col.find_one({
        "_id": ObjectId(session_id)
    })
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
        {"$set": {
            "status":   SessionStatus.completed,
            "ended_at": datetime.utcnow()
        }}
    )
    return {"message": "Session ended", "session_id": session_id}


@router.post("/next-question/{session_id}")
async def next_question(
    session_id: str,
    current_user: dict = Depends(get_current_user)
):
    session = await db_instance.sessions_col.find_one({
        "_id": ObjectId(session_id)
    })
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    asked = session.get("asked_questions", [])
    answers = session.get("answers", [])
    role = session["role"]
    difficulty = session["difficulty"]
    topics = session.get("topics", ["General"])

    # Adaptive difficulty based on evaluated scores if available
    scored_answers = [a for a in answers if a.get("quick_score") is not None]
    if scored_answers:
        recent = scored_answers[-3:]
        avg = sum(a.get("quick_score", 50) for a in recent) / len(recent)
        if avg >= 70:
            difficulty = "hard"
        elif avg >= 40:
            difficulty = "medium"
        else:
            difficulty = "easy"

    resume_data = session.get("resume_data", {})

    # Alternate between follow-up and new topic question
    use_followup = len(answers) > 0 and len(answers) % 2 != 0

    if use_followup and answers:
        last = answers[-1]
        question = await generate_followup(
            role=role,
            previous_question=last["question_text"],
            previous_answer=last["transcript"],
            difficulty=difficulty,
            resume_data=resume_data
        )
    else:
        topic = random.choice(topics)
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
                "current_difficulty": difficulty
            }
        }
    )

    return {"question": question, "difficulty": difficulty}


@router.post("/submit-answer/{session_id}")
async def submit_answer(
    session_id: str,
    data: dict,
    current_user: dict = Depends(get_current_user)
):
    """
    Fast answer storage — no AI calls here.
    Evaluation happens in batch at the end via /evaluate endpoint.
    """
    transcript = data.get("transcript", "").strip()
    question = data.get("question_text", "")
    duration = data.get("duration_seconds", 0)
    input_mode = data.get("input_mode", "voice")

    if not transcript:
        raise HTTPException(status_code=400, detail="Empty transcript")

    words = transcript.split()
    word_count = len(words)
    wpm = round((word_count / max(duration, 1)) *
                60) if input_mode == "voice" else 0

    filler_list = [
        "um", "uh", "like", "basically", "literally",
        "you know", "sort of", "kind of", "actually"
    ]
    fillers = [w for w in words if w.lower(
    ) in filler_list] if input_mode == "voice" else []

    answer_entry = {
        "question_text":    question,
        "transcript":       transcript,
        "input_mode":       input_mode,
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

    logger.info(f"Answer stored for session {session_id} — {word_count} words")

    # Return basic stats immediately — no score yet
    return {
        "stored":       True,
        "word_count":   word_count,
        "wpm":          wpm,
        "filler_words": fillers[:5],
        "input_mode":   input_mode,
    }


@router.post("/evaluate/{session_id}")
async def evaluate_session(
    session_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Batch evaluate all answers in one Groq API call.
    Called once at the end of the interview.
    """
    session = await db_instance.sessions_col.find_one({
        "_id": ObjectId(session_id)
    })
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    answers = session.get("answers", [])
    if not answers:
        raise HTTPException(status_code=400, detail="No answers to evaluate")

    role = session.get("role", "Software Engineer")

    logger.info(
        f"Starting batch evaluation — session {session_id}, {len(answers)} answers")

    evaluations = await batch_evaluate(role, answers)

    # Merge evaluations into answers
    evaluated_answers = []
    total_score = 0

    for i, answer in enumerate(answers):
        eval_data = evaluations[i] if i < len(evaluations) else {}
        score = max(0, min(100, int(eval_data.get("score", 50))))
        total_score += score

        corrected = eval_data.get("corrected_transcript", answer["transcript"])
        was_corrected = corrected.strip().lower(
        ) != answer["transcript"].strip().lower()

        evaluated_answer = {
            **answer,
            "quick_score":          score,
            "ai_score":             score,
            "reasoning":            eval_data.get("reasoning", ""),
            "keywords_found":       eval_data.get("keywords_mentioned", []),
            "missing_concepts":     eval_data.get("missing_concepts", []),
            "corrected_transcript": corrected,
            "was_corrected":        was_corrected,
        }
        evaluated_answers.append(evaluated_answer)

    overall_score = round(total_score / len(answers)) if answers else 0

    await db_instance.sessions_col.update_one(
        {"_id": ObjectId(session_id)},
        {"$set": {
            "answers":       evaluated_answers,
            "overall_score": overall_score,
            "evaluated":     True,
            "status":        SessionStatus.completed,
            "ended_at":      datetime.utcnow()
        }}
    )

    logger.info(
        f"Evaluation complete — session {session_id}, overall score: {overall_score}")

    return {
        "overall_score": overall_score,
        "answers":       evaluated_answers,
        "session_id":    session_id
    }
