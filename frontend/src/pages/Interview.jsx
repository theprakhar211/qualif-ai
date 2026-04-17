import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { interviewAPI } from '../services/api'
import { useSpeechRecognition } from '../hooks/useSpeechRecognition'
import { useSpeechSynthesis } from '../hooks/useSpeechSynthesis'

const MAX_QUESTIONS = 8
const STATES = {
  LOADING:    'loading',
  SPEAKING:   'speaking',
  LISTENING:  'listening',
  PROCESSING: 'processing',
  DONE:       'done',
  ERROR:      'error',
}

const PHASE_COLORS = {
  intro:       '#6366f1',
  resume:      '#8b5cf6',
  technical:   '#06b6d4',
  behavioural: '#22c55e',
}

const PHASE_LABELS = {
  intro:       'Introduction',
  resume:      'Resume Review',
  technical:   'Technical',
  behavioural: 'Behavioural',
}

function ScoreRing({ score, size = 160 }) {
  const [displayed, setDisplayed] = useState(0)
  const radius       = 54
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
      <circle cx="60" cy="60" r={radius} fill="none" stroke="#1e1e1e" strokeWidth="8" />
      <circle
        cx="60" cy="60" r={radius} fill="none"
        stroke={color} strokeWidth="8" strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={dashoffset}
        transform="rotate(-90 60 60)"
        style={{ transition: 'stroke-dashoffset 0.05s linear' }}
      />
      <text x="60" y="56" textAnchor="middle" fill={color} fontSize="24" fontWeight="700" fontFamily="sans-serif">
        {displayed}
      </text>
      <text x="60" y="72" textAnchor="middle" fill="#555" fontSize="11" fontFamily="sans-serif">
        / 100
      </text>
    </svg>
  )
}

export default function Interview() {
  const { sessionId } = useParams()
  const navigate      = useNavigate()

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

  const [evaluating,    setEvaluating]    = useState(false)
  const [evalResults,   setEvalResults]   = useState(null)
  const [evalError,     setEvalError]     = useState(false)

  const timerRef     = useRef(null)
  const startTimeRef = useRef(null)
  const hasAskedRef  = useRef(false)

  const {
    transcript, interimTranscript,
    isListening, error: sttError,
    startListening, stopListening, resetTranscript
  } = useSpeechRecognition()

  const { speak, stop: stopSpeaking } = useSpeechSynthesis()

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
        askQuestion(session.current_question, session.difficulty, session.current_phase)
      } catch (err) {
        setFatalError(err.response?.status === 404
          ? 'Interview session not found.'
          : 'Failed to load interview. Check your connection.')
        setState(STATES.ERROR)
      }
    }
    load()
  }, [sessionId, askQuestion])

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

  useEffect(() => {
    if (state !== STATES.LISTENING) return
    if (inputMode === 'text' && isListening) stopListening()
    else if (inputMode === 'voice' && !isListening) setTimeout(() => startListening(), 300)
  }, [inputMode])

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
      setState(STATES.LISTENING)
      setRetryCount(prev => prev + 1)
    }
  }

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

  const handleEndEarly = async () => {
    stopListening(); stopSpeaking()
    await finishInterview(sessionId)
  }

  const phaseColor = PHASE_COLORS[phase] || '#6366f1'
  const phaseLabel = PHASE_LABELS[phase] || 'Interview'

  // ── Error screen ──
  if (state === STATES.ERROR) return (
    <div style={s.page}>
      <div style={s.centreCard}>
        <div style={{ fontSize: '32px', marginBottom: '1rem' }}>⚠</div>
        <h2 style={{ marginBottom: '0.5rem' }}>Interview interrupted</h2>
        <p style={{ color: '#666', marginBottom: '2rem', lineHeight: '1.6' }}>{fatalError}</p>
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
          <button onClick={() => navigate('/dashboard')} style={s.primaryBtn} className="btn-press">Dashboard</button>
          <button onClick={() => navigate('/app')} style={s.ghostBtn} className="btn-press">New interview</button>
        </div>
      </div>
    </div>
  )

  // ── Done screen ──
  if (state === STATES.DONE) return (
    <div style={s.page}>
      <div style={s.centreCard}>
        {evaluating && (
          <>
            <div style={s.spinner} />
            <h2 style={{ margin: '1.5rem 0 0.5rem', fontSize: '20px' }}>Evaluating your interview...</h2>
            <p style={{ color: '#666', fontSize: '14px', lineHeight: '1.6' }}>
              Groq AI is reviewing all your answers. This takes 5–15 seconds.
            </p>
          </>
        )}
        {!evaluating && evalError && (
          <>
            <div style={{ fontSize: '28px', marginBottom: '1rem' }}>⚠</div>
            <h2 style={{ marginBottom: '0.5rem' }}>Evaluation failed</h2>
            <p style={{ color: '#666', marginBottom: '1.5rem' }}>Your answers were saved. You can retry or check the dashboard.</p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <button onClick={async () => {
                setEvalError(false); setEvaluating(true)
                try { const r = await interviewAPI.evaluate(sessionId); setEvalResults(r.data) }
                catch { setEvalError(true) } finally { setEvaluating(false) }
              }} style={s.primaryBtn} className="btn-press">Retry</button>
              <button onClick={() => navigate('/dashboard')} style={s.ghostBtn} className="btn-press">Dashboard</button>
            </div>
          </>
        )}
        {!evaluating && evalResults && (
          <div className="fade-in">
            <ScoreRing score={evalResults.overall_score} />
            <h2 style={{ margin: '1.5rem 0 0.25rem', fontSize: '22px' }}>Interview complete</h2>
            <p style={{ color: '#555', marginBottom: '0.5rem', fontSize: '13px' }}>
              {interviewType === 'complete' ? 'Complete Interview' : 'Quick Practice'} · {evalResults.answers?.length} questions
            </p>
            <p style={{ color: '#666', marginBottom: '2rem', fontSize: '14px', lineHeight: '1.6' }}>
              {evalResults.overall_score >= 70 ? '🎉 Great performance! Check the dashboard for detailed feedback.' :
               evalResults.overall_score >= 40 ? '📈 Good effort. Review the missed concepts to improve.' :
               '💪 Keep practicing. The dashboard shows exactly what to focus on.'}
            </p>
            <button onClick={() => navigate('/dashboard')} style={s.primaryBtn} className="btn-press">
              View full results →
            </button>
          </div>
        )}
      </div>
    </div>
  )

  // ── Main interview screen ──
  const progressPct = ((qNumber - 1) / MAX_QUESTIONS) * 100

  return (
    <div style={s.page}>
      <div style={s.header}>
        <img src="/logo.png" alt="Qualif-AI" style={{ height: '36px', objectFit: 'contain' }} />
        <div style={s.headerMeta}>
          {/* Phase badge */}
          <span style={{ ...s.phaseBadge, background: `${phaseColor}18`, color: phaseColor, borderColor: `${phaseColor}40` }}>
            {phaseLabel}
          </span>
          <span style={s.qCount}>Q {qNumber} / {MAX_QUESTIONS}</span>
          <button onClick={handleEndEarly} style={s.endBtn} className="btn-press">End</button>
        </div>
      </div>

      {/* Progress bar */}
      <div style={s.progressBg}>
        <div style={{ ...s.progressFill, width: `${progressPct}%`, background: `linear-gradient(90deg, ${phaseColor}, ${phaseColor}aa)` }}/>
      </div>

      {/* Phase strip for complete interviews */}
      {interviewType === 'complete' && (
        <div style={s.phaseStrip}>
          {[
            { id: 'intro',       label: 'Intro',       qs: [1,2] },
            { id: 'resume',      label: 'Resume',      qs: [3,4] },
            { id: 'technical',   label: 'Technical',   qs: [5,6,7] },
            { id: 'behavioural', label: 'Behavioural', qs: [8] },
          ].map((p, i) => {
            const isActive = p.id === phase
            const isDone   = p.qs[p.qs.length - 1] < qNumber
            const color    = PHASE_COLORS[p.id]
            return (
              <div key={p.id} style={s.phaseStripItem}>
                {i > 0 && <div style={{ ...s.phaseConnector, background: isDone ? color : '#2a2a2a' }} />}
                <div style={{
                  ...s.phaseStripDot,
                  background:   isDone ? color : isActive ? color : '#2a2a2a',
                  borderColor:  isActive ? color : 'transparent',
                  boxShadow:    isActive ? `0 0 8px ${color}60` : 'none',
                }}/>
                <span style={{
                  ...s.phaseStripLabel,
                  color: isDone || isActive ? '#ccc' : '#444',
                }}>{p.label}</span>
              </div>
            )
          })}
        </div>
      )}

      <div style={s.content}>
        {/* Question card */}
        <div key={questionKey} style={s.questionCard} className="fade-in">
          <div style={s.questionMeta}>
            <span style={s.questionNum}>Question {qNumber}</span>
            <span style={{ ...s.phasePill, color: phaseColor, borderColor: `${phaseColor}40`, background: `${phaseColor}10` }}>
              {phaseLabel}
            </span>
          </div>
          {state === STATES.LOADING ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div className="skeleton" style={{ height: '24px', width: '100%' }} />
              <div className="skeleton" style={{ height: '24px', width: '65%' }} />
            </div>
          ) : (
            <p style={s.questionText}>{question}</p>
          )}
        </div>

        {/* State indicator */}
        <div style={s.stateRow}>
          <div style={{
            ...s.stateDot,
            background: state === STATES.LISTENING  ? '#22c55e' :
                        state === STATES.SPEAKING   ? phaseColor :
                        state === STATES.PROCESSING ? '#eab308' : '#555',
            animation: state === STATES.LISTENING ? 'micPulse 1.5s ease-in-out infinite' : 'none',
          }}/>
          <span style={s.stateLabel}>
            {state === STATES.LOADING    && 'Loading your question...'}
            {state === STATES.SPEAKING   && 'Interviewer is speaking...'}
            {state === STATES.LISTENING  && (inputMode === 'voice' ? `Listening — ${timer}s` : 'Type your answer below')}
            {state === STATES.PROCESSING && 'Saving your answer...'}
          </span>
        </div>

        {retryCount > 0 && state === STATES.LISTENING && (
          <div style={s.warningBox}>
            Submission failed — please try again.
            {retryCount >= 2 && ' Consider switching to "Type instead".'}
          </div>
        )}

        {state === STATES.LISTENING && (
          <div className="fade-in">
            <div style={s.modeRow}>
              <button onClick={() => setInputMode('voice')} style={{ ...s.modeBtn, ...(inputMode === 'voice' ? s.modeBtnActive : {}) }} className="btn-press">
                🎙 Voice
              </button>
              <button onClick={() => setInputMode('text')} style={{ ...s.modeBtn, ...(inputMode === 'text' ? s.modeBtnActive : {}) }} className="btn-press">
                ⌨ Type instead
              </button>
            </div>

            {inputMode === 'voice' && (
              <div style={{
                ...s.transcriptBox,
                borderColor: transcript || interimTranscript ? '#22c55e' : '#2a2a2a',
                animation: transcript || interimTranscript ? 'glowPulse 2s ease-in-out infinite' : 'none',
              }}>
                <div style={s.transcriptLabel}>
                  <span>Your answer</span>
                  {(transcript || interimTranscript) && (
                    <span style={{ color: '#22c55e', fontSize: '11px' }}>● Capturing</span>
                  )}
                </div>
                <p style={s.transcriptText}>
                  {transcript}
                  <span style={s.interim}>{interimTranscript}</span>
                  {!transcript && !interimTranscript && (
                    <span style={s.placeholder}>Start speaking...</span>
                  )}
                </p>
              </div>
            )}

            {inputMode === 'text' && (
              <textarea
                value={typedAnswer}
                onChange={e => setTypedAnswer(e.target.value)}
                placeholder="Type your answer here..."
                style={s.textArea}
                rows={6}
                autoFocus
              />
            )}

            {sttError && sttError !== 'no-speech' && inputMode === 'voice' && (
              <div style={s.errorBox}>Mic issue: {sttError} — switch to "Type instead" if this persists.</div>
            )}

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
              <button
                onClick={() => handleStopAndSubmit(inputMode, typedAnswer)}
                disabled={inputMode === 'text' && !typedAnswer.trim()}
                style={{
                  ...s.submitBtn,
                  opacity: inputMode === 'text' && !typedAnswer.trim() ? 0.4 : 1,
                  cursor:  inputMode === 'text' && !typedAnswer.trim() ? 'not-allowed' : 'pointer',
                }}
                className="btn-press"
              >
                Submit answer
              </button>
              <button onClick={handleSkip} style={s.skipBtn} className="btn-press">Skip</button>
            </div>
          </div>
        )}

        {feedback && (
          <div style={s.feedbackBox} className="fade-in">
            {feedback.skipped ? (
              <p style={{ color: '#666', fontSize: '14px' }}>Question skipped — next question loading...</p>
            ) : feedback.empty ? (
              <p style={{ color: '#666', fontSize: '14px' }}>No answer detected — next question loading...</p>
            ) : (
              <>
                <p style={{ color: '#22c55e', fontSize: '14px', marginBottom: '0.75rem', fontWeight: '600' }}>
                  ✓ Answer recorded
                </p>
                <div style={s.feedbackRow}>
                  <span style={s.feedbackLabel}>Word count</span>
                  <span style={s.feedbackValue}>{feedback.word_count}</span>
                </div>
                {feedback.input_mode === 'voice' && feedback.wpm > 0 && (
                  <div style={s.feedbackRow}>
                    <span style={s.feedbackLabel}>Words per minute</span>
                    <span style={s.feedbackValue}>{feedback.wpm}</span>
                  </div>
                )}
                {feedback.filler_words?.length > 0 && (
                  <div style={s.feedbackRow}>
                    <span style={s.feedbackLabel}>Filler words</span>
                    <span style={{ color: '#ef4444', fontSize: '13px' }}>{feedback.filler_words.join(', ')}</span>
                  </div>
                )}
                <p style={s.feedbackNote}>Full AI evaluation at the end of the interview</p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

const s = {
  page:        { minHeight: '100vh', background: '#0a0a0a', color: '#fff' },
  header:      { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 2rem', borderBottom: '1px solid #1a1a1a' },
  headerMeta:  { display: 'flex', alignItems: 'center', gap: '1rem' },
  phaseBadge:  { fontSize: '12px', padding: '3px 10px', borderRadius: '20px', fontWeight: '500', border: '1px solid' },
  qCount:      { color: '#555', fontSize: '13px', fontWeight: '500' },
  endBtn:      { background: 'transparent', border: '1px solid #2a2a2a', color: '#666', padding: '0.4rem 0.8rem', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', transition: 'all 0.15s' },
  progressBg:  { height: '3px', background: '#1a1a1a' },
  progressFill:{ height: '100%', transition: 'width 0.6s cubic-bezier(0.4, 0, 0.2, 1)' },

  // Phase strip (complete interview only)
  phaseStrip:      { display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0.75rem 2rem', borderBottom: '1px solid #1a1a1a', gap: '0', background: '#080808' },
  phaseStripItem:  { display: 'flex', alignItems: 'center', gap: '6px' },
  phaseConnector:  { width: '32px', height: '2px', margin: '0 4px' },
  phaseStripDot:   { width: '10px', height: '10px', borderRadius: '50%', border: '2px solid transparent', transition: 'all 0.3s', flexShrink: 0 },
  phaseStripLabel: { fontSize: '12px', fontWeight: '500', transition: 'color 0.3s' },

  content:      { maxWidth: '680px', margin: '0 auto', padding: '2.5rem 1.5rem' },
  questionCard: { background: 'linear-gradient(135deg, #111 0%, #0f0f1a 100%)', border: '1px solid #2a2a2a', borderRadius: '16px', padding: '2rem', marginBottom: '1.5rem' },
  questionMeta: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' },
  questionNum:  { fontSize: '12px', color: '#555', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: '500' },
  phasePill:    { fontSize: '11px', padding: '2px 8px', borderRadius: '10px', border: '1px solid', fontWeight: '500' },
  questionText: { fontSize: '20px', lineHeight: '1.6', color: '#fff', fontWeight: '500' },

  stateRow:    { display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' },
  stateDot:    { width: '8px', height: '8px', borderRadius: '50%', transition: 'background 0.3s', flexShrink: 0 },
  stateLabel:  { fontSize: '13px', color: '#666' },
  warningBox:  { background: '#2a1f00', border: '1px solid #5a4500', color: '#fbbf24', padding: '0.75rem 1rem', borderRadius: '8px', fontSize: '13px', marginBottom: '1rem' },
  modeRow:     { display: 'flex', gap: '0.5rem', marginBottom: '1rem' },
  modeBtn:     { background: '#111', border: '1px solid #2a2a2a', color: '#666', padding: '0.5rem 1rem', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', transition: 'all 0.15s' },
  modeBtnActive:{ border: '1px solid #6366f1', color: '#a5b4fc', background: '#1e1b4b' },
  transcriptBox:{ background: '#111', border: '1px solid #2a2a2a', borderRadius: '12px', padding: '1.25rem', marginBottom: '0.75rem', minHeight: '100px', transition: 'border-color 0.3s, box-shadow 0.3s' },
  transcriptLabel:{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: '#555', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' },
  transcriptText: { fontSize: '15px', lineHeight: '1.7', color: '#ddd' },
  interim:     { color: '#555', fontStyle: 'italic' },
  placeholder: { color: '#333', fontStyle: 'italic' },
  textArea:    { background: '#111', border: '1px solid #2a2a2a', borderRadius: '12px', padding: '1rem', color: '#ddd', fontSize: '15px', width: '100%', resize: 'vertical', outline: 'none', lineHeight: '1.6', marginBottom: '0.75rem', boxSizing: 'border-box' },
  errorBox:    { background: '#2a1515', border: '1px solid #5a1a1a', color: '#ff6b6b', padding: '0.75rem 1rem', borderRadius: '8px', fontSize: '13px', marginBottom: '0.75rem' },
  feedbackBox: { background: '#111', border: '1px solid #1e3a1e', borderRadius: '12px', padding: '1.25rem', marginTop: '1rem' },
  feedbackRow: { display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '14px' },
  feedbackLabel:{ color: '#666' },
  feedbackValue:{ color: '#fff', fontWeight: '500' },
  feedbackNote: { color: '#444', fontSize: '12px', marginTop: '0.75rem' },
  submitBtn:   { background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff', border: 'none', borderRadius: '10px', padding: '1rem 2rem', fontSize: '16px', fontWeight: '600', flex: 1, transition: 'transform 0.1s' },
  skipBtn:     { background: 'transparent', color: '#555', border: '1px solid #2a2a2a', borderRadius: '10px', padding: '1rem 1.5rem', fontSize: '15px', fontWeight: '500', cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.15s' },
  centreCard:  { maxWidth: '420px', margin: '12vh auto', background: 'linear-gradient(135deg, #111 0%, #0f0f1a 100%)', border: '1px solid #2a2a2a', borderRadius: '20px', padding: '3rem', textAlign: 'center' },
  primaryBtn:  { background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff', border: 'none', borderRadius: '8px', padding: '0.875rem 1.5rem', fontSize: '15px', fontWeight: '600', cursor: 'pointer', transition: 'transform 0.1s' },
  ghostBtn:    { background: 'transparent', border: '1px solid #2a2a2a', color: '#888', padding: '0.875rem 1.5rem', borderRadius: '8px', cursor: 'pointer', fontSize: '15px', transition: 'all 0.15s' },
  spinner:     { width: '44px', height: '44px', border: '3px solid #2a2a2a', borderTop: '3px solid #6366f1', borderRadius: '50%', margin: '0 auto', animation: 'spin 0.9s linear infinite' },
}
