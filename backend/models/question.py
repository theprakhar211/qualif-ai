from pydantic import BaseModel, Field
from typing import Optional, List
from enum import Enum

class Difficulty(str, Enum):
    easy   = "easy"
    medium = "medium"
    hard   = "hard"

class QuestionType(str, Enum):
    technical    = "technical"
    behavioural  = "behavioural"
    situational  = "situational"

class Question(BaseModel):
    id: Optional[str] = None
    role: str                        # e.g. "Software Engineer"
    topic: str                       # e.g. "System Design"
    difficulty: Difficulty
    type: QuestionType
    text: str
    ideal_keywords: List[str] = []   # for keyword scoring
    ideal_answer: Optional[str] = None  # for semantic scoring

class QuestionResponse(BaseModel):
    id: str
    role: str
    topic: str
    difficulty: Difficulty
    type: QuestionType
    text: str