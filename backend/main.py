from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from database import connect_db, close_db
from routers import auth, interview, evaluation, dashboard, tts, resume
from routers.share import router as share_router
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from services.rate_limiter import limiter
import os
import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.starlette import StarletteIntegration
from sentry_sdk.integrations.asyncio import AsyncioIntegration


sentry_sdk.init(
    dsn=os.getenv("SENTRY_DSN"),
    integrations=[
        StarletteIntegration(transaction_style="url"),
        FastApiIntegration(transaction_style="url"),
        AsyncioIntegration(),
    ],
    traces_sample_rate=0.2,   # capture 20% of transactions for performance
    send_default_pii=False,   # never send personal data
    environment=os.getenv("ENVIRONMENT", "production"),
)


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
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

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
app.add_middleware(SlowAPIMiddleware)

app.include_router(auth.router,       prefix="/auth",       tags=["Auth"])
app.include_router(interview.router,  tags=["Interview"])
app.include_router(evaluation.router, prefix="/evaluation",
                   tags=["Evaluation"])
app.include_router(dashboard.router,  prefix="/dashboard",  tags=["Dashboard"])
app.include_router(tts.router,        prefix="/tts",        tags=["TTS"])
app.include_router(resume.router, prefix="/resume", tags=["Resume"])
app.include_router(share_router, prefix="/share", tags=["Share"])


@app.api_route("/health", methods=["GET", "HEAD"])
async def health():
    return {"status": "ok", "service": "Qualif-AI"}
