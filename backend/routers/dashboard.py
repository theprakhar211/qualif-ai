from fastapi import APIRouter, Depends
from bson import ObjectId
from loguru import logger
from services.dependencies import get_current_user
from database import db_instance, serialize_doc

router = APIRouter()


@router.get("/sessions")
async def get_sessions(current_user: dict = Depends(get_current_user)):
    user_id = str(current_user["_id"])
    cursor = db_instance.sessions_col.find(
        {"user_id": user_id},
        sort=[("created_at", -1)]
    )
    sessions = await cursor.to_list(length=50)

    result = []
    for s in sessions:
        s["id"] = str(s["_id"])
        del s["_id"]
        answers = s.get("answers", [])
        avg_score = (
            round(sum(a.get("quick_score", 0) for a in answers) / len(answers))
            if answers else 0
        )
        result.append({
            "id":           s["id"],
            "role":         s.get("role", ""),
            "difficulty":   s.get("difficulty", ""),
            "status":       s.get("status", ""),
            "created_at":   s.get("created_at", "").isoformat() if s.get("created_at") else "",
            "answer_count": len(answers),
            "avg_score":    avg_score,
            "topics":       s.get("topics", []),
        })

    return result


@router.get("/session/{session_id}")
async def get_session_detail(
    session_id: str,
    current_user: dict = Depends(get_current_user)
):
    session = await db_instance.sessions_col.find_one({
        "_id": ObjectId(session_id),
        "user_id": str(current_user["_id"])
    })
    if not session:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Session not found")

    session["id"] = str(session["_id"])
    del session["_id"]

    answers = session.get("answers", [])
    avg_score = (
        round(sum(a.get("quick_score", 0) for a in answers) / len(answers))
        if answers else 0
    )
    session["avg_score"] = avg_score
    return session


@router.get("/stats")
async def get_stats(current_user: dict = Depends(get_current_user)):
    user_id = str(current_user["_id"])
    cursor = db_instance.sessions_col.find({"user_id": user_id})
    sessions = await cursor.to_list(length=200)

    total = len(sessions)
    completed = [s for s in sessions if s.get("status") == "completed"]
    all_answers = [a for s in sessions for a in s.get("answers", [])]
    avg_score = (
        round(sum(a.get("quick_score", 0)
              for a in all_answers) / len(all_answers))
        if all_answers else 0
    )
    best_score = (
        max(a.get("quick_score", 0) for a in all_answers)
        if all_answers else 0
    )

    return {
        "total_sessions":     total,
        "completed_sessions": len(completed),
        "total_answers":      len(all_answers),
        "avg_score":          avg_score,
        "best_score":         best_score,
    }


@router.get("/insights")
async def get_insights(current_user: dict = Depends(get_current_user)):
    user_id = str(current_user["_id"])
    cursor = db_instance.sessions_col.find(
        {"user_id": user_id, "evaluated": True},
        sort=[("created_at", 1)]
    )
    sessions = await cursor.to_list(length=100)

    if not sessions:
        return {
            "score_trend":    [],
            "weak_areas":     [],
            "topic_scores":   [],
            "total_evaluated": 0
        }

    # Score trend — one point per session
    score_trend = []
    for s in sessions:
        score_trend.append({
            "date":  s["created_at"].strftime("%b %d") if hasattr(s["created_at"], "strftime") else str(s["created_at"])[:10],
            "score": round(s.get("overall_score") or 0),
            "role":  s.get("role", "")
        })

    # Weak areas — aggregate missing keywords/concepts across all sessions
    concept_misses = {}
    for s in sessions:
        for answer in s.get("answers", []):
            # Prefer richer missing_keywords from hybrid evaluator
            missing = answer.get("missing_keywords") or answer.get(
                "missing_concepts", [])
            for concept in missing:
                concept = concept.strip().lower()
                if concept:
                    concept_misses[concept] = concept_misses.get(
                        concept, 0) + 1

    weak_areas = sorted(
        [{"concept": k, "count": v} for k, v in concept_misses.items()],
        key=lambda x: x["count"],
        reverse=True
    )[:10]

    # Topic scores — avg score per topic across all sessions
    topic_data = {}
    for s in sessions:
        topics = s.get("topics", [])
        score = s.get("overall_score", 0)
        for topic in topics:
            if topic not in topic_data:
                topic_data[topic] = []
            topic_data[topic].append(score)

    topic_scores = [
        {
            "topic":     topic,
            "avg_score": round(sum(scores) / len(scores)),
            "sessions":  len(scores)
        }
        for topic, scores in topic_data.items()
    ]
    topic_scores.sort(key=lambda x: x["avg_score"])

    return {
        "score_trend":     score_trend,
        "weak_areas":      weak_areas,
        "topic_scores":    topic_scores,
        "total_evaluated": len(sessions)
    }


@router.get("/skills")
async def get_skills(current_user: dict = Depends(get_current_user)):
    """
    Returns full skill graph breakdown for the dashboard.
    Includes category mastery, per-skill scores, weakest skills, and adaptive target.
    """
    try:
        from services.skill_graph import load_skill_graph
        graph = await load_skill_graph(db_instance, str(current_user["_id"]))
        return {
            "skill_graph":        graph.to_dict(),
            "category_breakdown": graph.category_breakdown(),
            "weakest_skills":     graph.get_weakest_skills(n=5),
            "target_skill":       graph.get_target_skill(),
        }
    except Exception as e:
        logger.warning(f"Skill graph load failed: {e}")
        return {
            "skill_graph":        {},
            "category_breakdown": {},
            "weakest_skills":     [],
            "target_skill":       None,
        }
