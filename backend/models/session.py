from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum


class SessionStatus(str, Enum):
    active = "active"
    completed = "completed"
    abandoned = "abandoned"


class AnswerEntry(BaseModel):
    question_id: str
    question_text: str
    transcript: str
    duration_seconds: float
    word_count: int
    submitted_at: datetime = Field(default_factory=datetime.utcnow)


class SessionCreate(BaseModel):
    role: str
    topics: List[str] = []
    difficulty: str = "medium"
    resume_text: Optional[str] = None


class SessionInDB(BaseModel):
    id: Optional[str] = None
    user_id: str
    role: str
    topics: List[str] = []
    difficulty: str = "medium"
    status: SessionStatus = SessionStatus.active
    answers: List[AnswerEntry] = []
    created_at: datetime = Field(default_factory=datetime.utcnow)
    ended_at: Optional[datetime] = None
