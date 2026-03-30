from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class ScoreBreakdown(BaseModel):
    keyword_score: float = 0.0      # 0-100: keyword match %
    semantic_score: float = 0.0     # 0-100: cosine similarity
    structure_score: float = 0.0    # 0-100: answer structure
    confidence_score: float = 0.0   # 0-100: fluency / filler words
    final_score: float = 0.0        # weighted average


class AnswerResult(BaseModel):
    question_id: str
    question_text: str
    transcript: str
    scores: ScoreBreakdown
    filler_words_found: list = []
    words_per_minute: float = 0.0
    feedback: str = ""


class ResultInDB(BaseModel):
    id: Optional[str] = None
    session_id: str
    user_id: str
    role: str
    overall_score: float
    answer_results: list[AnswerResult] = []
    created_at: datetime = Field(default_factory=datetime.utcnow)
