from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from loguru import logger
from database import connect_db, close_db
from routers import auth, interview, evaluation, dashboard, tts, resume
from routers.share import router as share_router
import os


@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_db()
    yield
    await close_db()

app = FastAPI(
    title="Qualif-AI",
    version="1.0.0",
    description="AI-powered speech interview simulator",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        "https://qualif-smart-ai.vercel.app",
        os.getenv("FRONTEND_URL", ""),
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router,       prefix="/auth",       tags=["Auth"])
app.include_router(interview.router,  prefix="/interview",  tags=["Interview"])
app.include_router(evaluation.router, prefix="/evaluation",
                   tags=["Evaluation"])
app.include_router(dashboard.router,  prefix="/dashboard",  tags=["Dashboard"])
app.include_router(tts.router,        prefix="/tts",        tags=["TTS"])
app.include_router(resume.router, prefix="/resume", tags=["Resume"])
app.include_router(share_router, prefix="/share", tags=["Share"])


@app.api_route("/health", methods=["GET", "HEAD"])
async def health():
    return {"status": "ok", "service": "Qualif-AI"}
