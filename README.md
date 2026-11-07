# Qualif-AI — AI Interview Simulator

![Tests](https://github.com/theprakhar211/qualif-ai/actions/workflows/test.yml/badge.svg)

> **Practice interviews with an AI that actually listens.**

Qualif-AI is a full-stack voice-first mock interview simulator. Speak your answers aloud, get evaluated by AI, and track your progress over time — with a skill graph that shows exactly what to work on next.

**Live:** [qualif-smart-ai.vercel.app](https://qualif-smart-ai.vercel.app)

---

## Screenshots

| Landing | Login |
|---|---|
| ![Landing page](docs/screenshots/landing.png) | ![Login page](docs/screenshots/login.png) |

| Interview | Dashboard |
|---|---|
| ![Interview screen](docs/screenshots/interview.png) | ![Dashboard](docs/screenshots/dashboard.png) |

| Skill Graph | Session Detail |
|---|---|
| ![Skill graph](docs/screenshots/skill-graph.png) | ![Session detail](docs/screenshots/session-detail.png) |

---

## What Makes It Different

Most mock interview tools give you a list of questions and a text box. Qualif-AI conducts an actual interview:

- **Speaks the question aloud** using browser TTS — you respond by voice
- **Asks follow-up questions** based on what you said, not a fixed script
- **Resume-aware** — upload your CV and the Complete Interview asks about your specific projects and experience
- **Hybrid scoring** — every answer is scored by both Groq LLM and a deterministic layer (keyword matching, answer structure, depth detection) for consistent, explainable results
- **Skill graph** — mastery per skill updates after every session, and the next question targets your weakest area

---

## Features

### Two Interview Modes
- **Quick Practice** — 8 adaptive technical questions, follow-ups every other question, no resume needed
- **Complete Interview** — structured 4-phase flow: Introduction → Resume Review → Technical → Behavioural

### Voice-First Experience
- Browser Web Speech API for both STT and TTS — zero setup, works on Chrome/Edge
- Switch to typed input at any time
- WPM tracking, filler word detection, vocabulary diversity (TTR), hedging ratio

### AI Evaluation
- A single Groq batch call evaluates all answers at once
- Phase-aware scoring rubrics — intro scored on communication, technical on accuracy, behavioural on STAR format
- STT error correction built into evaluation prompt

### Hybrid Scoring Engine
- LLM score (gpt-oss-120b) blended with deterministic signals
- Keyword bank per topic — checks for expected technical terms
- Structure detection — intro / explanation / conclusion patterns
- Depth penalty — penalises genuinely thin or vague answers
- Blend ratios are phase-aware (LLM / deterministic): Introduction 80/20, Behavioural 80/20, Resume 75/25, Technical and Quick Practice 72/28

### Answer Benchmarking
- Ideal answer generated once per question by Groq, cached in MongoDB
- Your answer compared against ideal: covered concepts ✓, missing ✗, extras +
- Similarity score, improvement tip, common mistakes

### Skill Graph
- 42 skills across 7 categories: Data Structures, Algorithms, System Design, Languages, Concepts, Communication, Behavioural
- Mastery per skill is an exponentially weighted average of its last 5 scores (recent scores count more)
- Adaptive targeting — next question targets weakest unpractised skill
- Dashboard shows category breakdown, weakest areas, next target

### Question Deduplication
- Each asked question is fingerprinted (8-character SHA-256 prefix of the normalised text)
- The last 200 fingerprints per user are remembered and the question generator is told to avoid repeating earlier topics

### Guest Access
- One-click guest login (2-hour token) limited to 3 questions per session

### Dashboard
- Score trend chart across sessions
- Weak areas — concepts most frequently missed
- Performance by topic
- Per-session detail with collapsible answer breakdown

---

## How Scoring Works

Every answer goes through 4 stages before a score is committed:

**Stage 1 — Injection sanitisation**
`_sanitise_answer()` runs regex over the raw transcript before it reaches any LLM. Detected injection attempts are replaced with a flagged placeholder so they can't influence evaluation.

**Stage 2 — LLM batch evaluation**
All answers are sent to gpt-oss-120b (via Groq) in a single prompt. XML delimiters (`<candidate_answer>` tags) wrap each answer to separate data from instructions. Returns per-answer: score, reasoning, keywords mentioned, missing concepts, corrected transcript.

**Stage 3 — Hybrid deterministic scoring**
For each answer, a local scorer runs in parallel:
- Keyword scoring against a per-topic bank
- Structure detection via regex (intro / explanation / conclusion)
- Depth penalty: −35% under 20 words, −10% under 50 words, −15% for vague language
- Hard score floor: if keywords = 0% AND structure = 0% AND word count < 30, cap at 25 regardless of LLM score

Final score = LLM score × LLM weight + deterministic score × deterministic weight, with the weights set per phase (LLM / deterministic): Introduction 80/20, Behavioural 80/20, Resume 75/25, Technical 72/28, Quick Practice 72/28.

**Stage 4 — Scores committed immediately**
Scores are written to MongoDB before benchmarking begins. A crash during benchmarking never zeroes a session's scores.

---

## Security

**Prompt injection defence — 5 layers:**
1. `_sanitise_answer()` regex replaces injection patterns before any LLM sees the input
2. XML delimiters (`<candidate_answer>` tags) separate candidate data from prompt instructions
3. Explicit SECURITY rule in the system prompt instructs the LLM to ignore embedded instructions
4. Hard score floor in the deterministic layer — a manipulated LLM score can't survive keyword=0% + structure=0% + word_count<30
5. Typed answers (5+ words) get an additional LLM classification check (GENUINE vs INJECTION) at submission time; flagged answers are rejected before evaluation. The check fails open so an API error never blocks a real answer

**Auth:** JWT with bcrypt password hashing. JWT_SECRET enforced at 32+ characters.

**Rate limiting:** Per-user JWT-keyed rate limiting via slowapi — falls back to IP for unauthenticated routes.

**Error monitoring:** Sentry with FastAPI, Starlette, and asyncio integrations. Captures 20% of transactions, never sends PII.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + Vite, deployed on Vercel |
| Backend | FastAPI (Python 3.11), deployed on Render |
| Database | MongoDB Atlas (M0 free tier) |
| AI | Groq API — gpt-oss-20b (fast) + gpt-oss-120b (smart) |
| Voice | Browser Web Speech API (SpeechRecognition + SpeechSynthesis) |
| Auth | JWT (PyJWT) + bcrypt |
| Monitoring | Sentry (error tracking + performance) |
| Rate Limiting | slowapi (per-user JWT key, IP fallback) |
| Containerisation | Docker + docker-compose |
| Testing & CI | pytest, Playwright, ruff, mypy, GitHub Actions |

---

## Architecture

```
┌─────────────────┐     HTTPS      ┌─────────────────────────┐
│   React (Vite)  │ ─────────────► │   FastAPI (Python 3.11) │
│   Vercel        │                │   Render / Docker       │
└─────────────────┘                └────────────┬────────────┘
                                                │
                              ┌─────────────────┼─────────────────┐
                              │                 │                 │
                    ┌─────────▼──────┐  ┌───────▼──────┐  ┌──────▼──────┐
                    │  MongoDB Atlas │  │  Groq API    │  │  Hybrid     │
                    │  Sessions      │  │  gpt-oss-20b │  │  Evaluator  │
                    │  Users         │  │  gpt-oss-120b│  │  (local)    │
                    │  Skill Graphs  │  └──────────────┘  └─────────────┘
                    │  Ideal Answers │
                    └────────────────┘
```

### Key Architecture Decisions

**Batch evaluation** — all answers are evaluated in a single Groq API call at the end of the interview instead of one call per answer.

**Hybrid scoring** — pure LLM scoring is fast but inconsistent. The deterministic layer adds stability: the same answer always produces the same keyword score regardless of LLM variance.

**Ideal answer caching** — ideal answers are generated once per question (fingerprinted by question + role + difficulty) and cached in MongoDB, so repeat questions need no extra API call.

**Browser TTS/STT** — tried MeloTTS and Coqui TTS. Browser Web Speech API: zero setup, works everywhere Chrome/Edge supports it. Groq corrects obvious STT errors during evaluation.

**Score commit before benchmarking** — scores are written to the database before the benchmarking step runs. This means a Groq timeout or crash during benchmarking never loses the evaluation results.

**Containerised local stack** — multi-stage Docker build (builder + runtime) keeps the final image lean. docker-compose wires the FastAPI backend and MongoDB together with a healthcheck so the backend never starts before the database is ready.

---

## Project Structure

```
qualif-ai/
├── .github/workflows/test.yml   # CI: ruff, mypy, pytest, Playwright E2E
├── docker-compose.yml           # Wires backend + MongoDB containers
├── e2e/                         # Playwright E2E specs (4)
├── backend/
│   ├── Dockerfile               # Multi-stage build: builder → runtime
│   ├── .env.example             # Environment variable template
│   ├── main.py                  # FastAPI entry, CORS, Sentry, rate limiting, routers
│   ├── config.py                # Pydantic settings, reads .env
│   ├── ruff.toml / mypy.ini / pytest.ini
│   ├── database.py              # Motor async MongoDB connection + indexes
│   ├── routers/
│   │   ├── auth.py              # register, login, /me — JWT
│   │   ├── interview.py         # start, submit-answer, next-question, evaluate, end
│   │   ├── evaluation.py        # evaluation pipeline
│   │   ├── dashboard.py         # sessions, stats, insights, skill graph, reset
│   │   ├── tts.py               # text-to-speech endpoint
│   │   ├── resume.py            # PDF upload → Groq parse → store on user
│   │   └── share.py             # shareable result card links
│   ├── services/
│   │   ├── groq_service.py      # ask_groq(), batch_evaluate()
│   │   ├── hybrid_evaluator.py  # keyword scoring, structure detection, blend
│   │   ├── skill_graph.py       # SkillNode, SkillGraph, mastery, adaptive targeting
│   │   ├── answer_benchmark.py  # ideal answer generation + comparison
│   │   ├── question_engine.py   # generate_question(), adaptive wrapper
│   │   ├── resume_parser.py     # PyMuPDF extraction + Groq structured parse
│   │   ├── rate_limiter.py      # slowapi limiter keyed by JWT user ID
│   │   ├── auth_service.py      # hash_password, create_token, decode_token
│   │   └── dependencies.py      # get_current_user FastAPI dependency
│   ├── data/
│   │   ├── questions_seed.json  # seed data
│   │   └── seed.py              # one-time DB seeder
│   └── tests/
│       ├── conftest.py
│       ├── test_hybrid_evaluator.py
│       ├── test_skill_graph.py
│       ├── test_groq_service.py
│       ├── test_guest_auth.py
│       ├── test_interview_router.py
│       ├── test_rate_limiter.py
│       ├── test_resume_parser.py
│       ├── test_answer_quality.py
│       ├── test_answer_benchmark.py
│       └── test_question_difficulty.py
├── frontend/
│   └── src/
│       ├── pages/
│       │   ├── Landing.jsx
│       │   ├── Login.jsx
│       │   ├── Register.jsx
│       │   ├── Setup.jsx
│       │   ├── Interview.jsx    # State machine, voice flow, TTS/STT
│       │   └── Dashboard.jsx    # Charts, skill graph, session detail
│       ├── hooks/
│       │   ├── useSpeechRecognition.js
│       │   └── useSpeechSynthesis.js
│       └── services/
│           └── api.js           # Axios client, retry on cold start
└── README.md
```

---

## Local Setup

### Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop) — that's it. No Python, no Node, no MongoDB required.

### 1. Clone and configure

```bash
git clone https://github.com/theprakhar211/qualif-ai.git
cd qualif-ai
cp backend/.env.example backend/.env
```

Open `backend/.env` and fill in two values:
```env
GROQ_API_KEY=gsk_...
JWT_SECRET=any_random_string_that_is_32_characters_or_longer
```

Everything else can stay as-is for local development.

### 2. Start the stack

```bash
docker compose up --build
```

First run takes 3–5 minutes (downloads images and installs dependencies). Subsequent runs take ~10 seconds.

Wait for:
```
qualifai-backend  | INFO:     Application startup complete.
```

### 3. Seed the database (first time only)

Open a second terminal and run:

```powershell
docker compose exec backend bash -c "PYTHONPATH=/app python /app/data/seed.py"
```

```
Cleared 0 existing questions.
Seeded 20 fallback questions.
```

### 4. Verify

| URL | What you should see |
|---|---|
| http://localhost:8000/docs | FastAPI Swagger UI |
| http://localhost:8000/health | `{"status": "ok"}` |

### Useful commands

```bash
docker compose up          # start stack (no rebuild)
docker compose up --build  # rebuild after requirements.txt changes
docker compose down        # stop everything
docker compose down -v     # stop + wipe database volume (full reset)
docker compose logs -f backend   # tail backend logs only
```

### Frontend (optional — only if developing the UI)

The live frontend at [qualif-smart-ai.vercel.app](https://qualif-smart-ai.vercel.app) already points at the production backend. To run the frontend locally against your Docker backend:

```bash
cd frontend
npm install
```

Create `frontend/.env`:
```env
VITE_API_URL=http://localhost:8000
```

```bash
npm run dev
# App running at http://localhost:5173
```

### Tests

```bash
docker compose exec backend bash -c "PYTHONPATH=/app pytest tests/ -v"
# 281 backend tests across 10 test files (plus 4 Playwright E2E specs in e2e/)
```

### CI

GitHub Actions (`.github/workflows/test.yml`) runs on every push and pull request:

1. **Backend job** — `ruff check`, `mypy` on `services/`, then `pytest`
2. **E2E job** (after the backend job passes) — starts the backend and frontend dev server, then runs the Playwright specs in `e2e/`

---

## Deployment

| Service | What | URL |
|---|---|---|
| Vercel | Frontend | qualif-smart-ai.vercel.app |
| Render | Backend | qualifai-backend.onrender.com |
| MongoDB Atlas | Database | M0 free cluster |

**Render build command:**
```
pip install -r requirements.txt
```

**Render start command:**
```
python -m uvicorn main:app --host 0.0.0.0 --port $PORT
```

Python version: set `PYTHON_VERSION=3.11.9` in the Render service's environment variables, to match Docker and CI.

---

## Environment Variables

### Backend (Render / Docker)
| Variable | Description |
|---|---|
| `MONGO_URI` | MongoDB URI — Atlas SRV for production, `mongodb://mongo:27017/qualifai` for Docker |
| `DB_NAME` | Database name (`qualifai`) |
| `JWT_SECRET` | Random string, 32+ characters |
| `JWT_EXPIRE_HOURS` | Token expiry (`24`) |
| `GROQ_API_KEY` | Groq API key (`gsk_...`) |
| `GROQ_FAST_MODEL` | `openai/gpt-oss-20b` |
| `GROQ_SMART_MODEL` | `openai/gpt-oss-120b` |
| `FRONTEND_URL` | Allowed CORS origin |
| `SENTRY_DSN` | Sentry DSN (optional — Sentry skips init if blank) |
| `ENVIRONMENT` | `development` or `production` |

### Frontend (Vercel)
| Variable | Description |
|---|---|
| `VITE_API_URL` | Render backend URL |

---

## Known Limitations & Roadmap

- **Browser STT only** — no Whisper integration. Technical terms sometimes misrecognised; Groq corrects obvious errors during evaluation. Whisper via Groq API is a planned upgrade.
- **Render cold start** — free tier sleeps after 15 min idle (~30s wake). Mitigated with UptimeRobot pinging `/health` every 5 minutes.
- **Groq free tier** — rate limits apply. Sufficient for personal use and portfolio demos.
- **Voice requires Chrome/Edge** — Firefox does not support Web Speech API. A fallback to typed-only mode is available.
- **Question deduplication cap** — only the last 200 question fingerprints per user are remembered, so older questions can repeat. A larger cap or smarter rotation is planned.
- **In-memory rate limiting** — slowapi state is not shared across multiple instances. Acceptable for single Render instance; would need Redis backend for horizontal scaling.

---

## Author

**Prakhar Sharma**
GitHub: [@theprakhar211](https://github.com/theprakhar211)

---

## License

MIT