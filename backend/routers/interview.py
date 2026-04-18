from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime
from bson import ObjectId
from loguru import logger
import random

from models.session import SessionCreate, SessionStatus
from services.dependencies import get_current_user
from services.question_engine import (
    generate_question, generate_question_adaptive, generate_followup,
    generate_intro_question, generate_resume_question,
    generate_behavioural_question
)
from services.groq_service import batch_evaluate
from services.hybrid_evaluator import run_hybrid_evaluation, PhaseType
from services.skill_graph import update_skill_graph_from_session, infer_skill
from services.answer_benchmark import benchmark_session_answers
from database import db_instance, serialize_doc

router = APIRouter()

MAX_QUESTIONS = 4

PHASE_MAP = {
    "intro":       PhaseType.INTRO,
    "resume":      PhaseType.RESUME,
    "technical":   PhaseType.TECHNICAL,
    "behavioural": PhaseType.BEHAVIOURAL,
    "quick":       PhaseType.QUICK,
}


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

    interview_type = getattr(data, 'interview_type', 'quick') or 'quick'

    # Only fetch resume for complete interviews — quick practice is topic-based only
    resume_data = {}
    if interview_type == 'complete':
        user = await db_instance.users_col.find_one({"_id": current_user["_id"]})
        resume_data = user.get("resume", {}) if user else {}

    phase = get_phase(1, interview_type)

    # Generate first question based on type
    if phase == 'intro':
        first_question = await generate_intro_question(data.role, 1)
        first_topic = "intro"
    else:
        topic = data.topics[0] if data.topics else "General"
        first_question, first_topic = await generate_question_adaptive(
            role=data.role,
            topic=topic,
            difficulty=data.difficulty,
            asked_questions=[],
            resume_data=resume_data,
            user_id=user_id,
            session_skills_covered=[],
        )

    session_doc = {
        "user_id":               user_id,
        "role":                  data.role,
        "topics":                data.topics,
        "difficulty":            data.difficulty,
        "interview_type":        interview_type,
        "current_phase":         phase,
        "status":                SessionStatus.active,
        "current_question":      first_question,
        "asked_questions":       [first_question],
        "session_skills_covered": [first_topic] if first_topic != "intro" else [],
        "answers":               [],
        "resume_data":           resume_data,
        "evaluated":             False,
        "overall_score":         0,
        "created_at":            datetime.utcnow()
    }

    result = await db_instance.sessions_col.insert_one(session_doc)
    session_id = str(result.inserted_id)

    logger.info(
        f"Session started: {session_id} | type={interview_type} | phase={phase}")

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

    asked = session.get("asked_questions", [])
    answers = session.get("answers", [])
    role = session["role"]
    difficulty = session["difficulty"]
    topics = session.get("topics", ["General"])
    resume_data = session.get("resume_data", {})
    interview_type = session.get("interview_type", "quick")
    user_id = str(current_user["_id"])
    session_skills_covered = session.get("session_skills_covered", [])

    next_q_number = len(answers) + 2

    # Adaptive difficulty for technical phase
    if answers:
        recent = answers[-3:]
        avg_words = sum(a.get("word_count", 50) for a in recent) / len(recent)
        if avg_words >= 80:
            difficulty = "hard"
        elif avg_words >= 30:
            difficulty = "medium"
        else:
            difficulty = "easy"

    phase = get_phase(next_q_number, interview_type)

    logger.info(
        f"Next question: session={session_id} | q={next_q_number} | phase={phase} | type={interview_type}")

    question = None
    resolved_topic = None

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
            last = answers[-1]
            question = await generate_followup(
                role=role,
                previous_question=last["question_text"],
                previous_answer=last["transcript"],
                difficulty=difficulty,
                resume_data=resume_data
            )
            resolved_topic = last.get("topic")
        else:
            topic = random.choice(topics)
            question, resolved_topic = await generate_question_adaptive(
                role=role,
                topic=topic,
                difficulty=difficulty,
                asked_questions=asked,
                resume_data=resume_data,
                user_id=user_id,
                session_skills_covered=session_skills_covered,
            )

    # Track skill coverage for adaptive targeting
    update_fields = {
        "current_question":   question,
        "current_phase":      phase,
        "current_difficulty": difficulty,
    }
    push_fields = {"asked_questions": question}

    if resolved_topic:
        skill = infer_skill(question, resolved_topic)
        if skill and skill not in session_skills_covered:
            push_fields["session_skills_covered"] = skill

    await db_instance.sessions_col.update_one(
        {"_id": ObjectId(session_id)},
        {
            "$push": push_fields,
            "$set":  update_fields,
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
    question = data.get("question_text", "")
    duration = data.get("duration_seconds", 0)
    input_mode = data.get("input_mode", "voice")
    phase = data.get("phase", "technical")
    topic = data.get("topic", "")

    if not transcript:
        raise HTTPException(status_code=400, detail="Empty transcript")

    words = transcript.split()
    word_count = len(words)
    wpm = round((word_count / max(duration, 1)) *
                60) if input_mode == "voice" else 0

    filler_list = ["um", "uh", "like", "basically", "literally",
                   "you know", "sort of", "kind of", "actually"]
    fillers = [w for w in words if w.lower(
    ) in filler_list] if input_mode == "voice" else []

    answer_entry = {
        "question_text":    question,
        "transcript":       transcript,
        "input_mode":       input_mode,
        "phase":            phase,
        "topic":            topic,
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
    """Batch evaluate all answers at once using Groq + hybrid deterministic scoring."""
    session = await db_instance.sessions_col.find_one({"_id": ObjectId(session_id)})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    answers = session.get("answers", [])
    if not answers:
        raise HTTPException(status_code=400, detail="No answers to evaluate")

    role = session.get("role", "Software Engineer")
    interview_type = session.get("interview_type", "quick")
    user_id = str(current_user["_id"])

    logger.info(
        f"Batch evaluating {session_id} — {len(answers)} answers | type={interview_type}")

    # ── Step 1: LLM batch evaluation (unchanged) ──────────────────────────
    evaluations = await batch_evaluate(role, answers, interview_type)

    # ── Step 2: Hybrid scoring pass ───────────────────────────────────────
    evaluated_answers = []
    skill_graph_input = []
    total_score = 0

    for i, answer in enumerate(answers):
        eval_data = evaluations[i] if i < len(evaluations) else {}
        phase_str = answer.get(
            "phase", "technical" if interview_type == "quick" else "technical")
        phase_type = PHASE_MAP.get(
            phase_str, PhaseType.QUICK if interview_type == "quick" else PhaseType.TECHNICAL)
        topic = answer.get("topic", "")

        # Build llm_result dict matching what run_hybrid_evaluation expects
        llm_result = {
            "score":                   max(0, min(100, int(eval_data.get("score", 50)))),
            "reasoning":               eval_data.get("reasoning", ""),
            "missing_concepts":        eval_data.get("missing_concepts", []),
            "stt_corrected_transcript": eval_data.get("corrected_transcript", answer["transcript"]),
        }

        hybrid = run_hybrid_evaluation(
            answer=answer["transcript"],
            question_text=answer["question_text"],
            llm_result=llm_result,
            phase=phase_type,
            topic=topic,
            duration_seconds=answer.get("duration_seconds"),
        )

        score = hybrid.final_score
        total_score += score
        corrected = hybrid.stt_corrected_transcript
        was_corrected = corrected.strip().lower(
        ) != answer["transcript"].strip().lower()

        enriched_answer = {
            **answer,
            # Existing fields (kept for frontend compatibility)
            "quick_score":          round(score),
            "ai_score":             hybrid.llm_score,
            "reasoning":            hybrid.reasoning,
            "keywords_found":       hybrid.matched_keywords,
            "missing_concepts":     hybrid.missing_keywords,
            "corrected_transcript": corrected,
            "was_corrected":        was_corrected,
            # New hybrid scoring fields
            "final_score":          score,
            "llm_score":            hybrid.llm_score,
            "deterministic_score":  hybrid.deterministic_score,
            "keyword_score":        hybrid.keyword_score,
            "structure_score":      hybrid.structure_score,
            "depth_penalty":        hybrid.depth_penalty,
            "matched_keywords":     hybrid.matched_keywords,
            "missing_keywords":     hybrid.missing_keywords,
            "penalties_applied":    hybrid.penalties_applied,
            "structure_flags":      hybrid.structure_flags,
            "wpm":                  hybrid.wpm if hybrid.wpm > 0 else answer.get("wpm", 0),
        }

        evaluated_answers.append(enriched_answer)
        skill_graph_input.append({
            "question_text": answer["question_text"],
            "topic":         topic,
            "final_score":   score,
        })

    avg_score = round(total_score / len(answers)) if answers else 0

    # ── Step 3: Commit scores immediately ────────────────────────────────
    # Do this BEFORE benchmarking so a benchmark crash never leaves
    # overall_score = 0 in the database.
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
    logger.info(f"Scores committed — {session_id} | avg={avg_score}")

    # ── Step 4: Update skill graph ────────────────────────────────────────
    try:
        await update_skill_graph_from_session(db_instance, user_id, skill_graph_input)
        logger.info(f"Skill graph updated — {session_id}")
    except Exception as e:
        logger.warning(f"Skill graph update failed (non-fatal): {e}")

    # ── Step 5: Answer benchmarking — enriches answers with ideal answer ──
    # Runs after score commit so failure here is truly non-critical.
    try:
        enriched = await benchmark_session_answers(
            db=db_instance,
            evaluated_answers=evaluated_answers,
            role=role,
            groq_client=None,
        )
        # Write enriched answers back (adds ideal_answer, comparison, etc.)
        await db_instance.sessions_col.update_one(
            {"_id": ObjectId(session_id)},
            {"$set": {"answers": enriched}}
        )
        evaluated_answers = enriched
        logger.info(f"Benchmarking complete — {session_id}")
    except Exception as e:
        logger.warning(
            f"Benchmarking failed (non-fatal, scores unaffected): {e}")

    return {
        "overall_score":  avg_score,
        "answers":        evaluated_answers,
        "session_id":     session_id,
        "interview_type": interview_type,
    }
