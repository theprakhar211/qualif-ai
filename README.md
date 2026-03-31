# Qualif-AI — AI-Powered Voice Interview Simulator

> Practice job interviews with a real AI interviewer. Speak your answers, get evaluated instantly, track your progress over time.

**Live Demo:** [qualif-smart-ai.vercel.app](https://qualif-smart-ai.vercel.app)

---

## What is Qualif-AI?

Qualif-AI is a full-stack voice-based mock interview simulator built for students and job seekers. Unlike static question banks or basic chatbots, Qualif-AI conducts a dynamic, adaptive interview — asking follow-up questions based on your actual answers, evaluating your responses with AI, and giving you detailed feedback on what you knew and what you missed.

---

## Key Features

**Voice-first interview experience**
Speak your answers naturally. The browser's speech recognition captures your words in real time with a live transcript. A text input fallback is available for technical answers or when the mic is unavailable.

**AI-generated questions with Groq**
Every question is generated fresh by Llama 3 via the Groq API — not pulled from a static database. Questions adapt based on your role, selected topics, and performance. Follow-up questions are contextually generated from your previous answer.

**Resume-aware personalization**
Upload your PDF resume. Groq extracts your skills, technologies, and experience, then personalizes every question to your background. A candidate with React experience gets different questions than one with a data science background.

**Adaptive difficulty**
The interview tracks your performance in real time. Strong answers push the difficulty up. Weak answers bring it down. The system adapts every 3 questions.

**Batch AI evaluation**
At the end of the interview, all answers are sent to Groq in a single batch call. Each answer is scored 0–100 with reasoning, concepts you covered, and concepts you missed. Speech recognition errors are automatically corrected before evaluation.

**Confidence analysis**
Voice answers are analyzed for filler words (um, uh, like, basically), words per minute, and answer length. These signals contribute to your final score alongside content quality.

**Performance dashboard**
A full dashboard tracks every interview session. View your score trend over time, a breakdown of your weakest concepts, and per-topic average scores. Click any session to see the full per-answer AI evaluation with reasoning and concept tags.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, Recharts |
| Backend | FastAPI (Python), async |
| Database | MongoDB Atlas (Motor async driver) |
| AI / LLM | Groq API — Llama 3.1 8B + Llama 3.3 70B |
| Speech Input | Web Speech API (browser-native) |
| Speech Output | Web SpeechSynthesis API (browser-native) |
| Resume Parsing | PyMuPDF + Groq |
| Auth | JWT (PyJWT + bcrypt) |
| Deployment | Vercel (frontend) + Render (backend) |

---

## How It Works

```
User selects role, topics, difficulty → optionally uploads resume
                    ↓
Groq generates first question (personalized to resume if uploaded)
                    ↓
User answers by voice or text
                    ↓
Answer stored instantly (no AI call during interview → fast flow)
                    ↓
Repeat for 8 questions with adaptive difficulty and follow-ups
                    ↓
Interview ends → single Groq batch call evaluates all 8 answers
                    ↓
Scores, reasoning, concepts covered/missed shown on dashboard
```

---

## Screenshots

> Add screenshots here after recording your demo

| Setup | Interview | Dashboard |
|---|---|---|
| *(screenshot)* | *(screenshot)* | *(screenshot)* |

---

## Running Locally

### Prerequisites

- Python 3.11
- Node.js 18+
- MongoDB (local) or MongoDB Atlas account
- Groq API key — free at [console.groq.com](https://console.groq.com)

### Backend setup

```bash
cd backend
python -m venv venv
source venv/Scripts/activate  # Windows
# source venv/bin/activate    # Mac/Linux

pip install -r requirements.txt
python -m spacy download en_core_web_sm
```

Create `backend/.env`:

```
MONGO_URI=mongodb://localhost:27017
DB_NAME=qualifai
JWT_SECRET=your-secret-key
JWT_EXPIRE_HOURS=24
GROQ_API_KEY=gsk_your_key_here
GROQ_FAST_MODEL=llama-3.1-8b-instant
GROQ_SMART_MODEL=llama-3.3-70b-versatile
```

Seed the question bank:

```bash
PYTHONPATH=. python data/seed.py
```

Start the server:

```bash
uvicorn main:app --reload
```

### Frontend setup

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

---

## Project Structure

```
qualif-ai/
├── backend/
│   ├── main.py                  # FastAPI entry point
│   ├── config.py                # Settings and env vars
│   ├── database.py              # MongoDB connection
│   ├── routers/
│   │   ├── auth.py              # Register, login, JWT
│   │   ├── interview.py         # Session management, Q&A flow
│   │   ├── dashboard.py         # Results, stats, insights
│   │   └── resume.py            # PDF upload and parsing
│   ├── services/
│   │   ├── groq_service.py      # Groq API calls + batch evaluation
│   │   ├── question_engine.py   # Question and follow-up generation
│   │   └── resume_parser.py     # PDF text extraction + parsing
│   └── data/
│       └── seed.py              # Question bank seeder
└── frontend/
    └── src/
        ├── pages/
        │   ├── Login.jsx
        │   ├── Register.jsx
        │   ├── Setup.jsx        # Role, topics, resume upload
        │   ├── Interview.jsx    # Voice interview flow
        │   └── Dashboard.jsx    # Results and analytics
        ├── hooks/
        │   ├── useSpeechRecognition.js
        │   └── useSpeechSynthesis.js
        └── services/
            └── api.js           # Axios client
```

---

## Why I Built This

Interview preparation tools either give you static question lists with no feedback, or charge a premium for AI evaluation. I wanted to build something that actually simulates a real interview — dynamic questions, voice interaction, adaptive difficulty, and meaningful AI feedback — completely free to use.

This project was built as part of my third-year Computer Science coursework to explore full-stack development, LLM integration, and voice interfaces.

---

## License

Copyright © 2026 Prakhar. All Rights Reserved.

Unauthorized copying, forking, or distribution of this software is strictly prohibited.
