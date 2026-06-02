import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { interviewAPI, createShare } from '../services/api'
import { useSpeechRecognition } from '../hooks/useSpeechRecognition'
import { useSpeechSynthesis } from '../hooks/useSpeechSynthesis'

/* ─────────────────────────────────────────────
   Constants
───────────────────────────────────────────── */
const MAX_QUESTIONS = 8

const STATES = {
  LOADING:    'loading',
  READY:      'ready',
  SPEAKING:   'speaking',
  LISTENING:  'listening',
  PROCESSING: 'processing',
  DONE:       'done',
  ERROR:      'error',
}

const PHASE_COLORS = {
  intro:       '#6366f1',
  resume:      '#8b5cf6',
  technical:   '#2563eb',
  behavioural: '#22c55e',
}

const PHASE_LABELS = {
  intro:       'Introduction',
  resume:      'Resume Review',
  technical:   'Technical',
  behavioural: 'Behavioural',
}

/* ─────────────────────────────────────────────
   Tailwind config injected via a style tag
   (mirrors the Stitch config exactly)
───────────────────────────────────────────── */
const STITCH_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Geist:wght@100..900&display=swap');
  @import url('https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap');

  * { box-sizing: border-box; margin: 0; padding: 0; }
  *::before, *::after { box-sizing: border-box; }

  :root {
    --surface:                  #13131b;
    --surface-bright:           #393841;
    --surface-container:        #1f1f27;
    --surface-container-low:    #1b1b23;
    --surface-container-high:   #292932;
    --surface-container-highest:#34343d;
    --surface-container-lowest: #0d0d15;
    --surface-variant:          #34343d;
    --surface-dim:              #13131b;
    --on-surface:               #e4e1ed;
    --on-surface-variant:       #c7c4d7;
    --on-background:            #e4e1ed;
    --background:               #13131b;
    --primary:                  #2563eb;
    --primary-container:        #2563eb;
    --on-primary:               #ffffff;
    --on-primary-container:     #ffffff;
    --primary-fixed:            #dbeafe;
    --primary-fixed-dim:        #93c5fd;
    --secondary:                #60a5fa;
    --secondary-container:      #1d4ed8;
    --on-secondary:             #1e3a8a;
    --on-secondary-container:   #bfdbfe;
    --tertiary:                 #ffb783;
    --tertiary-container:       #d97721;
    --outline:                  #908fa0;
    --outline-variant:          #464554;
    --error:                    #ffb4ab;
    --error-container:          #93000a;
    --inverse-surface:          #e4e1ed;
    --inverse-on-surface:       #303038;
    --inverse-primary:          #3b82f6;
    --surface-tint:             #2563eb;
  }

  html { color-scheme: dark; }

  body {
    font-family: 'Inter', sans-serif;
    background-color: #030308;
    background-image:
      radial-gradient(circle at 50% -20%, rgba(37,99,235,0.15), transparent 50%),
      linear-gradient(rgba(37,99,235,0.05) 1px, transparent 1px),
      linear-gradient(90deg, rgba(37,99,235,0.05) 1px, transparent 1px);
    background-size: 100% 100%, 40px 40px, 40px 40px;
    min-height: 100vh;
    color: var(--on-surface);
    overflow-x: hidden;
  }

  /* ── Glass card ── */
  .glass-card {
    background: rgba(27,27,35,0.6);
    backdrop-filter: blur(16px);
    border: 1px solid rgba(255,255,255,0.08);
    box-shadow: 0 8px 32px 0 rgba(0,0,0,0.4);
    border-radius: 1rem;
  }

  /* ── Atmospheric orbs ── */
  .orb {
    position: fixed;
    border-radius: 50%;
    filter: blur(60px);
    z-index: 0;
    opacity: 0.25;
    pointer-events: none;
  }
  .orb-1 { width: 420px; height: 420px; background: var(--primary-container); top: 20%; left: -120px; }
  .orb-2 { width: 320px; height: 320px; background: var(--secondary-container); bottom: 20%; right: -100px; }

  /* ── Sticky header ── */
  .site-header {
    position: sticky;
    top: 0;
    z-index: 50;
    background: rgba(19,19,27,0.8);
    backdrop-filter: blur(20px);
    border-bottom: 1px solid rgba(255,255,255,0.08);
    box-shadow: 0 0 20px rgba(37,99,235,0.1);
  }
  .header-inner {
    display: flex;
    justify-content: space-between;
    align-items: center;
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 24px;
    height: 80px;
  }

  /* ── Brand ── */
  .brand { display: flex; align-items: center; gap: 8px; text-decoration: none; }
  .brand-icon {
    width: 32px; height: 32px;
    background: linear-gradient(135deg, var(--primary), var(--secondary));
    border-radius: 10px;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
  }
  .brand-name {
    font-family: 'Geist', sans-serif;
    font-size: 24px;
    font-weight: 700;
    color: var(--primary);
    letter-spacing: -0.04em;
  }

  /* ── Header meta pill ── */
  .header-meta { display: flex; align-items: center; gap: 16px; }
  .meta-pill {
    display: none;
    align-items: center;
    gap: 12px;
    padding: 6px 16px;
    background: var(--surface-container);
    border-radius: 9999px;
    border: 1px solid rgba(255,255,255,0.05);
  }
  @media (min-width: 640px) { .meta-pill { display: flex; } }
  .phase-badge {
    font-family: 'Geist', sans-serif;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.05em;
    padding: 3px 10px;
    border-radius: 9999px;
    border: 1px solid;
  }
  .q-count {
    font-family: 'Geist', sans-serif;
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.05em;
    color: var(--on-surface-variant);
  }
  .end-btn {
    font-family: 'Geist', sans-serif;
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.05em;
    padding: 8px 20px;
    border-radius: 9999px;
    border: 1px solid rgba(144,143,160,0.3);
    background: transparent;
    color: var(--on-surface-variant);
    cursor: pointer;
    transition: border-color 0.2s, color 0.2s;
  }
  .end-btn:hover { border-color: var(--primary); color: var(--primary); }
  .end-btn:active { transform: scale(0.97); }

  /* ── Progress bar ── */
  .progress-bg { height: 3px; background: var(--surface-container-low); }
  .progress-fill { height: 100%; transition: width 0.6s cubic-bezier(0.4,0,0.2,1); }

  /* ── Phase strip (complete interviews) ── */
  .phase-strip {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 12px 24px;
    border-bottom: 1px solid rgba(255,255,255,0.05);
    gap: 0;
    background: rgba(8,8,14,0.8);
  }
  .phase-strip-item { display: flex; align-items: center; gap: 6px; }
  .phase-connector { width: 32px; height: 2px; margin: 0 4px; transition: background 0.3s; }
  .phase-dot {
    width: 10px; height: 10px;
    border-radius: 50%;
    border: 2px solid transparent;
    transition: all 0.3s;
    flex-shrink: 0;
  }
  .phase-label {
    font-family: 'Geist', sans-serif;
    font-size: 12px;
    font-weight: 500;
    transition: color 0.3s;
  }

  /* ── Main content ── */
  .main-content {
    max-width: 768px;
    margin: 0 auto;
    padding: 48px 16px;
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    gap: 28px;
  }

  /* ── Question card ── */
  .question-card {
    position: relative;
    overflow: hidden;
    padding: 32px;
  }
  .question-card::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 2px;
    background: linear-gradient(90deg, var(--primary), transparent);
    opacity: 0.6;
  }
  .question-meta {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
  }
  .question-num {
    font-family: 'Geist', sans-serif;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--outline);
  }
  .phase-pill {
    font-family: 'Geist', sans-serif;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.05em;
    padding: 3px 10px;
    border-radius: 9999px;
    border: 1px solid;
  }
  .question-text {
    font-family: 'Geist', sans-serif;
    font-size: 19px;
    font-weight: 700;
    line-height: 1.3;
    color: var(--on-surface);
  }
  @media (min-width: 640px) { .question-text { font-size: 22px; } }

  /* ── State indicator row ── */
  .state-row { display: flex; align-items: center; gap: 10px; padding: 0 2px; }
  .state-dot {
    width: 10px; height: 10px;
    border-radius: 50%;
    flex-shrink: 0;
    transition: background 0.3s;
  }
  .state-dot.listening { animation: pulseDot 2s ease-in-out infinite; }
  .state-label {
    font-family: 'Geist', sans-serif;
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.05em;
    color: var(--outline);
  }
  .state-timer { color: var(--on-surface-variant); font-variant-numeric: tabular-nums; }

  @keyframes pulseDot {
    0%   { transform: scale(0.9); opacity: 0.5; box-shadow: 0 0 0 0 rgba(34,197,94,0.5); }
    50%  { transform: scale(1.1); opacity: 1;   box-shadow: 0 0 10px 3px rgba(34,197,94,0.3); }
    100% { transform: scale(0.9); opacity: 0.5; box-shadow: 0 0 0 0 rgba(34,197,94,0); }
  }
  @keyframes speakPulse {
    0%, 100% { opacity: 0.6; transform: scale(0.95); }
    50%       { opacity: 1;   transform: scale(1.05); }
  }

  /* ── Mode toggle ── */
  .mode-row { display: flex; gap: 12px; }
  .mode-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 20px;
    border-radius: 9999px;
    font-family: 'Geist', sans-serif;
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.05em;
    cursor: pointer;
    transition: all 0.2s;
    border: 1px solid;
  }
  .mode-btn:active { transform: scale(0.97); }
  .mode-btn-active {
    background: var(--primary-container);
    color: var(--on-primary-container);
    border-color: transparent;
    box-shadow: 0 0 20px rgba(37,99,235,0.4);
  }
  .mode-btn-inactive {
    background: transparent;
    color: var(--on-surface-variant);
    border-color: var(--outline-variant);
  }
  .mode-btn-inactive:hover { background: rgba(255,255,255,0.04); border-color: var(--outline); }

  /* ── Answer / transcript box ── */
  .answer-box {
    padding: 24px;
    min-height: 200px;
    transition: border-color 0.3s, box-shadow 0.3s;
  }
  .answer-box.capturing {
    border-color: rgba(34,197,94,0.4) !important;
    box-shadow: 0 0 0 1px rgba(34,197,94,0.15), 0 8px 32px rgba(0,0,0,0.4);
  }
  .answer-label {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-family: 'Geist', sans-serif;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--outline);
    margin-bottom: 16px;
  }
  .capturing-badge { color: #22c55e; font-size: 11px; }
  .transcript-text {
    font-family: 'Inter', sans-serif;
    font-size: 17px;
    line-height: 1.65;
    color: var(--on-surface-variant);
  }
  .interim-text { color: var(--outline); font-style: italic; }
  .placeholder-text { color: var(--outline); font-style: italic; opacity: 0.6; }

  /* ── Textarea ── */
  .type-area {
    width: 100%;
    min-height: 200px;
    padding: 20px;
    background: transparent;
    border: none;
    outline: none;
    resize: vertical;
    font-family: 'Inter', sans-serif;
    font-size: 17px;
    line-height: 1.65;
    color: var(--on-surface-variant);
  }
  .type-area::placeholder { color: var(--outline); opacity: 0.6; font-style: italic; }

  /* ── Footer action row ── */
  .action-row { display: flex; align-items: center; gap: 12px; }
  .submit-btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 20px 32px;
    background: var(--primary-container);
    color: var(--on-primary-container);
    border: none;
    border-radius: 9999px;
    font-family: 'Geist', sans-serif;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    box-shadow: 0 0 20px rgba(37,99,235,0.4);
    transition: filter 0.2s, transform 0.1s, opacity 0.2s;
  }
  .submit-btn:hover:not(:disabled) { filter: brightness(1.15); }
  .submit-btn:active:not(:disabled) { transform: scale(0.98); }
  .submit-btn:disabled { opacity: 0.4; cursor: not-allowed; box-shadow: none; }
  .skip-btn {
    padding: 20px 32px;
    background: transparent;
    color: var(--on-surface-variant);
    border: 1px solid var(--outline-variant);
    border-radius: 9999px;
    font-family: 'Geist', sans-serif;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    white-space: nowrap;
    transition: all 0.15s;
  }
  .skip-btn:hover { background: rgba(255,255,255,0.04); border-color: var(--outline); }
  .skip-btn:active { transform: scale(0.97); }

  /* ── Warning / error boxes ── */
  .warning-box {
    background: rgba(42,31,0,0.7);
    border: 1px solid rgba(90,69,0,0.8);
    color: #fbbf24;
    padding: 12px 16px;
    border-radius: 12px;
    font-size: 13px;
    font-family: 'Inter', sans-serif;
  }
  .error-box {
    background: rgba(42,21,21,0.7);
    border: 1px solid rgba(90,26,26,0.8);
    color: #ff6b6b;
    padding: 12px 16px;
    border-radius: 12px;
    font-size: 13px;
    font-family: 'Inter', sans-serif;
  }

  /* ── Feedback card ── */
  .feedback-card {
    padding: 24px;
    transition: border-color 0.3s;
  }
  .feedback-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 0;
    border-bottom: 1px solid rgba(255,255,255,0.05);
    font-size: 14px;
  }
  .feedback-row:last-of-type { border-bottom: none; }
  .feedback-lbl { color: var(--outline); font-family: 'Inter', sans-serif; }
  .feedback-val { color: var(--on-surface); font-weight: 600; font-family: 'Geist', sans-serif; }
  .feedback-note { color: var(--outline); font-size: 12px; margin-top: 12px; font-family: 'Inter', sans-serif; }

  /* ── Centre card (ready / done / error screens) ── */
  .centre-wrap {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    position: relative;
  }
  .centre-card {
    max-width: 440px;
    width: 100%;
    padding: 48px 40px;
    border-radius: 1.5rem;
    text-align: center;
    position: relative;
    z-index: 1;
  }
  .centre-card h2 {
    font-family: 'Geist', sans-serif;
    font-size: 22px;
    font-weight: 700;
    margin-bottom: 8px;
    color: var(--on-surface);
  }
  .centre-card p {
    font-family: 'Inter', sans-serif;
    font-size: 14px;
    line-height: 1.7;
    color: var(--on-surface-variant);
    margin-bottom: 24px;
  }
  .centre-card .emoji { font-size: 40px; margin-bottom: 20px; display: block; }

  /* ── Buttons in centre card ── */
  .primary-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 14px 28px;
    background: var(--primary-container);
    color: var(--on-primary-container);
    border: none;
    border-radius: 9999px;
    font-family: 'Geist', sans-serif;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    box-shadow: 0 0 20px rgba(37,99,235,0.4);
    transition: filter 0.2s, transform 0.1s;
  }
  .primary-btn:hover { filter: brightness(1.15); }
  .primary-btn:active { transform: scale(0.97); }
  .ghost-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 14px 24px;
    background: transparent;
    color: var(--on-surface-variant);
    border: 1px solid var(--outline-variant);
    border-radius: 9999px;
    font-family: 'Geist', sans-serif;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s;
  }
  .ghost-btn:hover { background: rgba(255,255,255,0.04); border-color: var(--outline); }
  .ghost-btn:active { transform: scale(0.97); }
  .btn-row { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; }

  /* ── Spinner ── */
  .spinner {
    width: 48px; height: 48px;
    border: 3px solid var(--surface-container-high);
    border-top-color: var(--primary);
    border-radius: 50%;
    margin: 0 auto 24px;
    animation: spin 0.9s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  /* ── Skeleton loader ── */
  .skeleton {
    background: linear-gradient(90deg, var(--surface-container) 25%, var(--surface-container-high) 50%, var(--surface-container) 75%);
    background-size: 200% 100%;
    border-radius: 8px;
    animation: shimmer 1.4s infinite;
  }
  @keyframes shimmer { to { background-position: -200% 0; } }

  /* ── Fade-in ── */
  .fade-in { animation: fadeIn 0.35s ease forwards; }
  @keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }

  /* ── Material symbols sizing ── */
  .material-symbols-outlined {
    font-size: 18px;
    vertical-align: middle;
    line-height: 1;
    user-select: none;
  }

`

/* ─────────────────────────────────────────────
   ScoreRing (unchanged from original)
───────────────────────────────────────────── */
function ScoreRing({ score, size = 160 }) {
  const [displayed, setDisplayed] = useState(0)
  const radius = 54
  const circumference = 2 * Math.PI * radius
  const color = score >= 70 ? '#22c55e' : score >= 40 ? '#eab308' : '#ef4444'

  useEffect(() => {
    let start = 0
    const step = score / 60
    const timer = setInterval(() => {
      start += step
      if (start >= score) { setDisplayed(score); clearInterval(timer) }
      else setDisplayed(Math.floor(start))
    }, 16)
    return () => clearInterval(timer)
  }, [score])

  const dashoffset = circumference - (displayed / 100) * circumference

  return (
    <svg width={size} height={size} viewBox="0 0 120 120" style={{ display: 'block', margin: '0 auto' }}>
      <circle cx="60" cy="60" r={radius} fill="none" stroke="#1e1e2e" strokeWidth="8" />
      <circle
        cx="60" cy="60" r={radius} fill="none"
        stroke={color} strokeWidth="8" strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={dashoffset}
        transform="rotate(-90 60 60)"
        style={{ transition: 'stroke-dashoffset 0.05s linear' }}
      />
      <text x="60" y="56" textAnchor="middle" fill={color} fontSize="24" fontWeight="700" fontFamily="Geist, sans-serif">
        {displayed}
      </text>
      <text x="60" y="72" textAnchor="middle" fill="#555" fontSize="11" fontFamily="Inter, sans-serif">
        / 100
      </text>
    </svg>
  )
}

/* ─────────────────────────────────────────────
   Main component
───────────────────────────────────────────── */
export default function Interview() {
  const { sessionId } = useParams()
  const navigate = useNavigate()

  const [state,         setState]         = useState(STATES.LOADING)
  const [question,      setQuestion]      = useState('')
  const [difficulty,    setDifficulty]    = useState('medium')
  const [qNumber,       setQNumber]       = useState(1)
  const [phase,         setPhase]         = useState('technical')
  const [interviewType, setInterviewType] = useState('quick')
  const [feedback,      setFeedback]      = useState(null)
  const [timer,         setTimer]         = useState(0)
  const [role,          setRole]          = useState('')
  const [inputMode,     setInputMode]     = useState('voice')
  const [typedAnswer,   setTypedAnswer]   = useState('')
  const [fatalError,    setFatalError]    = useState('')
  const [retryCount,    setRetryCount]    = useState(0)
  const [questionKey,   setQuestionKey]   = useState(0)

  const [evaluating,  setEvaluating]  = useState(false)
  const [evalResults, setEvalResults] = useState(null)
  const [evalError,   setEvalError]   = useState(false)

  const [shareUrl, setShareUrl] = useState(null);
  const [sharing, setSharing] = useState(false);

  const timerRef           = useRef(null)
  const startTimeRef       = useRef(null)
  const hasAskedRef        = useRef(false)
  const pendingQuestionRef = useRef(null)
  const orb1Ref            = useRef(null)
  const orb2Ref            = useRef(null)

  const {
    transcript, interimTranscript,
    isListening, error: sttError,
    startListening, stopListening, resetTranscript
  } = useSpeechRecognition()

  const { speak, stop: stopSpeaking } = useSpeechSynthesis()

  /* ── finish ── */
  const finishInterview = useCallback(async (sid) => {
    setState(STATES.DONE)
    setEvaluating(true)
    setEvalError(false)
    try {
      const res = await interviewAPI.evaluate(sid)
      setEvalResults(res.data)
    } catch { setEvalError(true) }
    finally { setEvaluating(false) }
  }, [])

  /* ── ask question ── */
  const askQuestion = useCallback((q, diff, ph) => {
    setQuestion(q)
    setQuestionKey(k => k + 1)
    if (diff) setDifficulty(diff)
    if (ph)   setPhase(ph)
    setFeedback(null)
    resetTranscript()
    setTypedAnswer('')
    setInputMode('voice')
    setState(STATES.SPEAKING)
    stopListening()
    speak(q, () => {
      setState(STATES.LISTENING)
      setTimeout(() => startListening(), 800)
    })
  }, [speak, resetTranscript, startListening, stopListening])

  /* ── load session ── */
  useEffect(() => {
    if (hasAskedRef.current) return
    hasAskedRef.current = true
    const load = async () => {
      try {
        const res     = await interviewAPI.getSession(sessionId)
        const session = res.data
        setRole(session.role)
        setDifficulty(session.difficulty)
        setInterviewType(session.interview_type || 'quick')
        setPhase(session.current_phase || 'technical')
        pendingQuestionRef.current = {
          question:   session.current_question,
          difficulty: session.difficulty,
          phase:      session.current_phase,
        }
        setState(STATES.READY)
      } catch (err) {
        setFatalError(err.response?.status === 404
          ? 'Interview session not found.'
          : 'Failed to load interview. Check your connection.')
        setState(STATES.ERROR)
      }
    }
    load()
  }, [sessionId, askQuestion])

  /* ── listening timer ── */
  useEffect(() => {
    if (state === STATES.LISTENING) {
      startTimeRef.current = Date.now()
      timerRef.current = setInterval(() => {
        setTimer(Math.floor((Date.now() - startTimeRef.current) / 1000))
      }, 1000)
    } else {
      clearInterval(timerRef.current)
      setTimer(0)
    }
    return () => clearInterval(timerRef.current)
  }, [state])

  /* ── switch input mode while listening ── */
  useEffect(() => {
    if (state !== STATES.LISTENING) return
    if (inputMode === 'text' && isListening) stopListening()
    else if (inputMode === 'voice' && !isListening) setTimeout(() => startListening(), 300)
  }, [inputMode, state, isListening, startListening, stopListening])

  /* ── Orb parallax on mouse move ── */
  useEffect(() => {
    const handleMouseMove = (e) => {
      const centerX = window.innerWidth / 2
      const centerY = window.innerHeight / 2
      if (orb1Ref.current) {
        const f = 20
        orb1Ref.current.style.transform = `translate(${(e.clientX - centerX) / f}px, ${(e.clientY - centerY) / f}px)`
      }
      if (orb2Ref.current) {
        const f = 40
        orb2Ref.current.style.transform = `translate(${(e.clientX - centerX) / f}px, ${(e.clientY - centerY) / f}px)`
      }
    }
    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [])

  /* ── submit ── */
  const handleStopAndSubmit = async (mode = inputMode, typed = typedAnswer) => {
    if (mode === 'voice') stopListening()
    setState(STATES.PROCESSING)
    await new Promise(resolve => setTimeout(resolve, 300))

    const finalTranscript = mode === 'text' ? typed.trim() : transcript.trim()
    const duration = mode === 'text' ? 60
      : startTimeRef.current ? Math.floor((Date.now() - startTimeRef.current) / 1000) : 10

    if (!finalTranscript) {
      setFeedback({ empty: true })
      setTimeout(async () => {
        const next = qNumber + 1
        if (next > MAX_QUESTIONS) { await finishInterview(sessionId); return }
        setQNumber(next)
        try {
          const nq = await interviewAPI.nextQuestion(sessionId)
          askQuestion(nq.data.question, nq.data.difficulty, nq.data.phase)
        } catch { setState(STATES.LISTENING) }
      }, 1000)
      return
    }

    try {
      const res = await interviewAPI.submitAnswer(sessionId, {
        question_text:    question,
        transcript:       finalTranscript,
        duration_seconds: duration,
        role,
        input_mode:       mode,
        phase,
        topic:            phase === 'technical' ? difficulty : phase,
      })

      setFeedback({ ...res.data, input_mode: mode })
      setTypedAnswer('')
      setRetryCount(0)

      const next = qNumber + 1
      if (next > MAX_QUESTIONS) {
        setTimeout(() => finishInterview(sessionId), 1200)
        return
      }

      setQNumber(next)
      setTimeout(async () => {
        try {
          const nq = await interviewAPI.nextQuestion(sessionId)
          askQuestion(nq.data.question, nq.data.difficulty, nq.data.phase)
        } catch { setState(STATES.LISTENING) }
      }, 1500)

    } catch (err) {
      if (err.response?.status === 401) { navigate('/login'); return }
      if (err.response?.data?.detail === 'INJECTION_ATTEMPT') {
        setState(STATES.LISTENING)
        setFeedback({ injection: true })
        setTypedAnswer('')
        resetTranscript()
        return
      }
      setState(STATES.LISTENING)
      setRetryCount(prev => prev + 1)
    }
  }

  /* ── skip ── */
  const handleSkip = async () => {
    stopListening(); stopSpeaking()
    setState(STATES.PROCESSING)
    resetTranscript(); setTypedAnswer('')
    setFeedback({ skipped: true })
    const next = qNumber + 1
    if (next > MAX_QUESTIONS) { setTimeout(() => finishInterview(sessionId), 800); return }
    setQNumber(next)
    setTimeout(async () => {
      try {
        const nq = await interviewAPI.nextQuestion(sessionId)
        askQuestion(nq.data.question, nq.data.difficulty, nq.data.phase)
      } catch { setState(STATES.LISTENING) }
    }, 1000)
  }

  /* ── end early ── */
  const handleEndEarly = async () => {
    stopListening(); stopSpeaking()
    await finishInterview(sessionId)
  }

  const phaseColor = PHASE_COLORS[phase] || '#2563eb'
  const phaseLabel = PHASE_LABELS[phase] || 'Interview'
  const progressPct = ((qNumber - 1) / MAX_QUESTIONS) * 100

  /* ─────────────────────────────────────────
      Share component
  ───────────────────────────────────────── */
  const getGrade = (score) => {
    if (score >= 90) return 'A+'
    if (score >= 85) return 'A'
    if (score >= 80) return 'A-'
    if (score >= 75) return 'B+'
    if (score >= 70) return 'B'
    if (score >= 65) return 'B-'
    if (score >= 60) return 'C+'
    if (score >= 55) return 'C'
    if (score >= 50) return 'C-'
    if (score >= 40) return 'D'
    return 'F'
  }

  const deriveTopicScores = (answers) => {
    if (!answers?.length) return []
    const map = {}
    answers.forEach(a => {
      const topic = a.topic || a.phase || 'General'
      if (!map[topic]) map[topic] = { total: 0, count: 0 }
      map[topic].total += a.quick_score ?? 0
      map[topic].count += 1
    })
    return Object.entries(map).map(([topic, { total, count }]) => ({
      topic,
      score: Math.round(total / count),
    }))
  }

  const handleShare = async () => {
    setSharing(true);
    try {
      const result = await createShare({
        session_id: sessionId,
        overall_score: evalResults.overall_score,
        grade: getGrade(evalResults.overall_score),
        role: role,
        difficulty: difficulty,
        interview_type: interviewType,
        topic_scores: deriveTopicScores(evalResults.answers),
        total_questions: evalResults.answers?.length ?? 0,
      });
      setShareUrl(result.url);
    } catch (e) {
      console.error(e);
    } finally {
      setSharing(false);
    }
  };
  /* ─────────────────────────────────────────
     Ready screen
  ───────────────────────────────────────── */
  if (state === STATES.READY) {
    const pending = pendingQuestionRef.current
    return (
      <>
        <style>{STITCH_STYLES}</style>
        <div ref={orb1Ref} className="orb orb-1" />
        <div ref={orb2Ref} className="orb orb-2" />
        <div className="centre-wrap">
          <div className="glass-card centre-card">
            <span className="emoji">🎤</span>
            <h2>Ready to start?</h2>
            <p>{role} Interview · {MAX_QUESTIONS} questions</p>
            <p style={{ marginBottom: '32px' }}>
              Make sure your microphone is ready. The interviewer will read each question aloud.
            </p>
            <button
              className="primary-btn"
              onClick={() => { if (pending) askQuestion(pending.question, pending.difficulty, pending.phase) }}
            >
              Begin Interview
              <span className="material-symbols-outlined">arrow_forward</span>
            </button>
          </div>
        </div>
      </>
    )
  }

  /* ─────────────────────────────────────────
     Error screen
  ───────────────────────────────────────── */
  if (state === STATES.ERROR) return (
    <>
      <style>{STITCH_STYLES}</style>
      <div ref={orb1Ref} className="orb orb-1" />
      <div ref={orb2Ref} className="orb orb-2" />
      <div className="centre-wrap">
        <div className="glass-card centre-card">
          <span className="emoji">⚠️</span>
          <h2>Interview interrupted</h2>
          <p>{fatalError}</p>
          <div className="btn-row">
            <button className="primary-btn" onClick={() => navigate('/dashboard')}>Dashboard</button>
            <button className="ghost-btn" onClick={() => navigate('/app')}>New interview</button>
          </div>
        </div>
      </div>
    </>
  )

  /* ─────────────────────────────────────────
     Done screen
  ───────────────────────────────────────── */
  if (state === STATES.DONE) return (
    <>
      <style>{STITCH_STYLES}</style>
      <div ref={orb1Ref} className="orb orb-1" />
      <div ref={orb2Ref} className="orb orb-2" />
      <div className="centre-wrap">
        <div className="glass-card centre-card">
          {evaluating && (
            <>
              <div className="spinner" />
              <h2>Evaluating your interview…</h2>
              <p>Groq AI is reviewing all your answers. This takes 5–15 seconds.</p>
            </>
          )}
          {!evaluating && evalError && (
            <>
              <span className="emoji">⚠️</span>
              <h2>Evaluation failed</h2>
              <p>Your answers were saved. You can retry or check the dashboard.</p>
              <div className="btn-row">
                <button className="primary-btn" onClick={async () => {
                  setEvalError(false); setEvaluating(true)
                  try { const r = await interviewAPI.evaluate(sessionId); setEvalResults(r.data) }
                  catch { setEvalError(true) } finally { setEvaluating(false) }
                }}>Retry</button>
                <button className="ghost-btn" onClick={() => navigate('/dashboard')}>Dashboard</button>
              </div>
            </>
          )}
          {!evaluating && evalResults && (
            <div className="fade-in">
              <ScoreRing score={evalResults.overall_score} />
              <h2 style={{ marginTop: '24px' }}>Interview complete</h2>
              <p style={{ marginBottom: '8px', color: 'var(--outline)', fontSize: '13px' }}>
                {interviewType === 'complete' ? 'Complete Interview' : 'Quick Practice'} · {evalResults.answers?.length} questions
              </p>
              <p>
                {evalResults.overall_score >= 70 ? '🎉 Great performance! Check the dashboard for detailed feedback.' :
                 evalResults.overall_score >= 40 ? '📈 Good effort. Review the missed concepts to improve.' :
                 '💪 Keep practicing. The dashboard shows exactly what to focus on.'}
              </p>
              <button className="primary-btn" onClick={() => navigate('/dashboard')}>
                View full results
                <span className="material-symbols-outlined">arrow_forward</span>
              </button>
              <button onClick={handleShare} disabled={sharing} style={{
                background: "rgba(37,99,235,0.15)", color: "#93c5fd",
                border: "1px solid rgba(37,99,235,0.3)", borderRadius: 9999,
                padding: "10px 24px", fontSize: 14, fontWeight: 500, cursor: "pointer", marginTop: "1rem"
              }}>
                {sharing ? "Creating link..." : "Share result"}
              </button>

              {shareUrl && (
                <div style={{ marginTop: 12, display: "flex", gap: 8, alignItems: "center" }}>
                  <input readOnly value={shareUrl} style={{
                    background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 8, padding: "8px 12px", color: "#94a3b8", fontSize: 12, width: 280
                  }} />
                  <button onClick={() => { navigator.clipboard.writeText(shareUrl); }} style={{
                    background: "#2563eb", color: "#fff", border: "none",
                    borderRadius: 8, padding: "8px 12px", fontSize: 12, cursor: "pointer"
                  }}>Copy</button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  )

  /* ─────────────────────────────────────────
     Main interview screen
  ───────────────────────────────────────── */
  const isCapturing = (transcript || interimTranscript) && inputMode === 'voice'

  return (
    <>
      <style>{STITCH_STYLES}</style>

      {/* Atmospheric orbs */}
      <div ref={orb1Ref} className="orb orb-1" />
      <div ref={orb2Ref} className="orb orb-2" />

      {/* ── Header ── */}
      <header className="site-header">
        <div className="header-inner">
          {/* Brand */}
          <img src="/logo.png" alt="Qualif-AI" style={{ height: '44px', objectFit: 'contain' }} />

          {/* Nav meta */}
          <div className="header-meta">
            <div className="meta-pill">
              <span
                className="phase-badge"
                style={{
                  background: `${phaseColor}18`,
                  color:       phaseColor,
                  borderColor: `${phaseColor}40`,
                }}
              >
                {phaseLabel}
              </span>
              <span className="q-count">Q {qNumber} / {MAX_QUESTIONS}</span>
            </div>
            <button className="end-btn" onClick={handleEndEarly}>End</button>
          </div>
        </div>
      </header>

      {/* ── Progress bar ── */}
      <div className="progress-bg">
        <div
          className="progress-fill"
          style={{ width: `${progressPct}%`, background: `linear-gradient(90deg, ${phaseColor}, ${phaseColor}99)` }}
        />
      </div>

      {/* ── Phase strip (complete interviews only) ── */}
      {interviewType === 'complete' && (
        <div className="phase-strip">
          {[
            { id: 'intro',       label: 'Intro',       qs: [1, 2] },
            { id: 'resume',      label: 'Resume',      qs: [3, 4] },
            { id: 'technical',   label: 'Technical',   qs: [5, 6, 7] },
            { id: 'behavioural', label: 'Behavioural', qs: [8] },
          ].map((p, i) => {
            const isActive = p.id === phase
            const isDone   = p.qs[p.qs.length - 1] < qNumber
            const c        = PHASE_COLORS[p.id]
            return (
              <div key={p.id} className="phase-strip-item">
                {i > 0 && (
                  <div className="phase-connector" style={{ background: isDone ? c : 'var(--surface-container-high)' }} />
                )}
                <div className="phase-dot" style={{
                  background:  isDone ? c : isActive ? c : 'var(--surface-container-high)',
                  borderColor: isActive ? c : 'transparent',
                  boxShadow:   isActive ? `0 0 8px ${c}60` : 'none',
                }} />
                <span className="phase-label" style={{ color: isDone || isActive ? 'var(--on-surface-variant)' : 'var(--outline)' }}>
                  {p.label}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Main content ── */}
      <main className="main-content">

        {/* Question card */}
        <div key={questionKey} className="glass-card question-card fade-in">
          <div className="question-meta">
            <span className="question-num">Question {qNumber}</span>
            <span
              className="phase-pill"
              style={{ color: phaseColor, borderColor: `${phaseColor}40`, background: `${phaseColor}10` }}
            >
              {phaseLabel}
            </span>
          </div>

          {state === STATES.LOADING ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div className="skeleton" style={{ height: '28px', width: '100%' }} />
              <div className="skeleton" style={{ height: '28px', width: '70%' }} />
            </div>
          ) : (
            <p className="question-text">{question}</p>
          )}
        </div>

        {/* State indicator */}
        <div className="state-row">
          <div
            className={`state-dot ${state === STATES.LISTENING ? 'listening' : ''}`}
            style={{
              background:
                state === STATES.LISTENING  ? '#22c55e' :
                state === STATES.SPEAKING   ? phaseColor :
                state === STATES.PROCESSING ? '#eab308' : 'var(--outline)',
              boxShadow: state === STATES.SPEAKING ? `0 0 10px ${phaseColor}60` : 'none',
              animation: state === STATES.SPEAKING ? 'speakPulse 1.2s ease-in-out infinite' : undefined,
            }}
          />
          <span className="state-label">
            {state === STATES.LOADING    && 'Loading your question…'}
            {state === STATES.READY      && 'Ready'}
            {state === STATES.SPEAKING   && 'Interviewer is speaking…'}
            {state === STATES.LISTENING  && (
              inputMode === 'voice'
                ? <>Listening — <span className="state-timer">{timer}s</span></>
                : 'Type your answer below'
            )}
            {state === STATES.PROCESSING && 'Saving your answer…'}
          </span>
        </div>

        {/* Retry warning */}
        {retryCount > 0 && state === STATES.LISTENING && (
          <div className="warning-box">
            Submission failed — please try again.
            {retryCount >= 2 && ' Consider switching to "Type instead".'}
          </div>
        )}

        {/* ── Listening UI ── */}
        {state === STATES.LISTENING && (
          <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

            {/* Mode toggle */}
            <div className="mode-row">
              <button
                className={`mode-btn ${inputMode === 'voice' ? 'mode-btn-active' : 'mode-btn-inactive'}`}
                onClick={() => setInputMode('voice')}
              >
                <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>mic</span>
                Voice
              </button>
              <button
                className={`mode-btn ${inputMode === 'text' ? 'mode-btn-active' : 'mode-btn-inactive'}`}
                onClick={() => setInputMode('text')}
              >
                <span className="material-symbols-outlined">keyboard</span>
                Type instead
              </button>
            </div>

            {/* Voice transcript box */}
            {inputMode === 'voice' && (
              <div className={`glass-card answer-box ${isCapturing ? 'capturing' : ''}`}>
                <div className="answer-label">
                  <span>Your answer</span>
                  {isCapturing && <span className="capturing-badge">● Capturing</span>}
                </div>
                <p className="transcript-text">
                  {transcript}
                  <span className="interim-text">{interimTranscript}</span>
                  {!transcript && !interimTranscript && (
                    <span className="placeholder-text">Start speaking…</span>
                  )}
                </p>
              </div>
            )}

            {/* Text input */}
            {inputMode === 'text' && (
              <div className="glass-card answer-box" style={{ padding: 0, minHeight: '200px' }}>
                <div className="answer-label" style={{ padding: '20px 24px 0' }}>
                  <span>Your answer</span>
                </div>
                <textarea
                  className="type-area"
                  value={typedAnswer}
                  onChange={e => setTypedAnswer(e.target.value)}
                  placeholder="Type your answer here…"
                  rows={6}
                  autoFocus
                />
              </div>
            )}

            {/* STT error */}
            {sttError && sttError !== 'no-speech' && inputMode === 'voice' && (
              <div className="error-box">
                Mic issue: {sttError} — switch to "Type instead" if this persists.
              </div>
            )}

            {/* Action buttons */}
            <div className="action-row">
              <button
                className="submit-btn"
                onClick={() => handleStopAndSubmit(inputMode, typedAnswer)}
                disabled={inputMode === 'text' && !typedAnswer.trim()}
              >
                Submit answer
                <span className="material-symbols-outlined">arrow_forward</span>
              </button>
              <button className="skip-btn" onClick={handleSkip}>Skip</button>
            </div>
          </div>
        )}

        {/* ── Feedback card ── */}
        {feedback && (
          <div
            className="glass-card feedback-card fade-in"
            style={{ borderColor: feedback.injection ? 'rgba(90,26,26,0.6)' : 'rgba(30,58,30,0.6)' }}
          >
            {feedback.injection ? (
              <div>
                <p style={{ color: '#f87171', fontWeight: '600', marginBottom: '8px', fontFamily: 'Geist, sans-serif' }}>
                  ⚠ Answer not accepted
                </p>
                <p style={{ color: 'var(--on-surface-variant)', fontSize: '14px', lineHeight: '1.6', fontFamily: 'Inter, sans-serif' }}>
                  Your answer appears to contain instructions rather than a genuine response. Please answer the question normally.
                </p>
              </div>
            ) : feedback.skipped ? (
              <p style={{ color: 'var(--outline)', fontSize: '14px', fontFamily: 'Inter, sans-serif' }}>
                Question skipped — next question loading…
              </p>
            ) : feedback.empty ? (
              <p style={{ color: 'var(--outline)', fontSize: '14px', fontFamily: 'Inter, sans-serif' }}>
                No answer detected — next question loading…
              </p>
            ) : (
              <>
                <p style={{ color: '#22c55e', fontWeight: '600', marginBottom: '16px', fontFamily: 'Geist, sans-serif' }}>
                  ✓ Answer recorded
                </p>
                <div className="feedback-row">
                  <span className="feedback-lbl">Word count</span>
                  <span className="feedback-val">{feedback.word_count}</span>
                </div>
                {feedback.input_mode === 'voice' && feedback.wpm > 0 && (
                  <div className="feedback-row">
                    <span className="feedback-lbl">Words per minute</span>
                    <span className="feedback-val">{feedback.wpm}</span>
                  </div>
                )}
                {feedback.filler_words?.length > 0 && (
                  <div className="feedback-row">
                    <span className="feedback-lbl">Filler words</span>
                    <span style={{ color: '#ef4444', fontFamily: 'Inter, sans-serif', fontSize: '13px' }}>
                      {feedback.filler_words.join(', ')}
                    </span>
                  </div>
                )}
                <p className="feedback-note">Full AI evaluation at the end of the interview</p>
              </>
            )}
          </div>
        )}
      </main>
    </>
  )
}