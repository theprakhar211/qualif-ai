from config import settings
from motor.motor_asyncio import AsyncIOMotorClient
import asyncio
import json
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

FALLBACK_QUESTIONS = [
    {"role": "Software Engineer", "topic": "General", "difficulty": "easy", "type": "technical",
     "text": "What is the difference between a stack and a queue?",
     "ideal_keywords": ["LIFO", "FIFO", "stack", "queue"], "ideal_answer": ""},
    {"role": "Software Engineer", "topic": "General", "difficulty": "medium", "type": "technical",
     "text": "Explain how a hash map works and how it handles collisions.",
     "ideal_keywords": ["hash function", "bucket", "collision", "chaining"], "ideal_answer": ""},
    {"role": "Software Engineer", "topic": "General", "difficulty": "hard", "type": "technical",
     "text": "Design a rate limiter that works across distributed servers.",
     "ideal_keywords": ["Redis", "token bucket", "distributed", "atomic"], "ideal_answer": ""},
    {"role": "Data Scientist", "topic": "General", "difficulty": "easy", "type": "technical",
     "text": "What is the difference between supervised and unsupervised learning?",
     "ideal_keywords": ["labeled", "unlabeled", "classification", "clustering"], "ideal_answer": ""},
    {"role": "Data Scientist", "topic": "General", "difficulty": "medium", "type": "technical",
     "text": "Explain overfitting and how you would prevent it.",
     "ideal_keywords": ["overfitting", "regularization", "cross-validation"], "ideal_answer": ""},
    {"role": "Frontend Developer", "topic": "General", "difficulty": "easy", "type": "technical",
     "text": "What is the difference between state and props in React?",
     "ideal_keywords": ["state", "props", "mutable", "immutable"], "ideal_answer": ""},
    {"role": "Frontend Developer", "topic": "General", "difficulty": "medium", "type": "technical",
     "text": "Explain the useEffect hook and when you would use it.",
     "ideal_keywords": ["useEffect", "side effects", "dependency array"], "ideal_answer": ""},
    {"role": "Backend Developer", "topic": "General", "difficulty": "easy", "type": "technical",
     "text": "What are the core principles of REST?",
     "ideal_keywords": ["stateless", "HTTP", "resource", "uniform interface"], "ideal_answer": ""},
    {"role": "Backend Developer", "topic": "General", "difficulty": "medium", "type": "technical",
     "text": "How would you handle authentication in a REST API?",
     "ideal_keywords": ["JWT", "token", "Bearer", "middleware"], "ideal_answer": ""},
    {"role": "General", "topic": "Behavioural", "difficulty": "easy", "type": "behavioural",
     "text": "Tell me about a time you had to meet a tight deadline.",
     "ideal_keywords": ["prioritize", "communicate", "delivered", "team"], "ideal_answer": ""},
]


async def seed():
    client = AsyncIOMotorClient(settings.MONGO_URI)
    db = client[settings.DB_NAME]
    col = db["questions"]
    deleted = await col.delete_many({})
    print(f"Cleared {deleted.deleted_count} existing questions.")
    result = await col.insert_many(FALLBACK_QUESTIONS)
    print(f"Seeded {len(result.inserted_ids)} fallback questions.")
    client.close()

asyncio.run(seed())
