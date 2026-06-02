from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class TopicScore(BaseModel):
    topic: str
    score: float


class ShareCardCreate(BaseModel):
    session_id: str
    overall_score: float
    grade: str
    role: str
    difficulty: str
    interview_type: str
    topic_scores: list[TopicScore]
    total_questions: int
    created_at: Optional[datetime] = None


class ShareCardResponse(BaseModel):
    share_id: str
    url: str
