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

export default function Interview() {
  const { sessionId } = useParams()
  const navigate      = useNavigate()

  const [state,        setState]        = useState(STATES.LOADING)
  const [question,     setQuestion]     = useState('')
  const [difficulty,   setDifficulty]   = useState('medium')
  const [qNumber,      setQNumber]      = useState(1)
  const [feedback,     setFeedback]     = useState(null)
  const [timer,        setTimer]        = useState(0)
  const [role,         setRole]         = useState('')
  const [inputMode,    setInputMode]    = useState('voice')
  const [typedAnswer,  setTypedAnswer]  = useState('')
  const [fatalError,   setFatalError]   = useState('')
  const [retryCount,   setRetryCount]   = useState(0)

  // Done screen state
  const [evaluating,   setEvaluating]   = useState(false)
  const [evalResults,  setEvalResults]  = useState(null)
  const [evalError,    setEvalError]    = useState(false)

  const timerRef      = useRef(null)
  const startTimeRef  = useRef(null)
  const hasAskedRef   = useRef(false)
  const retryTimerRef = useRef(null)

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
    } catch (err) {
      console.error('Evaluation error:', err)
      setEvalError(true)
    } finally {
      setEvaluating(false)
    }
  }, [])

  const askQuestion = useCallback((q, diff) => {
    setQuestion(q)
    if (diff) setDifficulty(diff)
    setFeedback(null)
    setFatalError('')
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

  // Load session on mount
  useEffect(() => {
    if (hasAskedRef.current) return
    hasAskedRef.current = true

    const load = async () => {
      try {
        const res     = await interviewAPI.getSession(sessionId)
        const session = res.data
        setRole(session.role)
        setDifficulty(session.difficulty)
        askQuestion(session.current_question, session.difficulty)
      } catch (err) {
        if (err.response?.status === 404) {
          setFatalError('Interview session not found. It may have expired.')
        } else if (err.response?.status === 401) {
          navigate('/login')
        } else {
          setFatalError('Failed to load interview. Check your connection and try again.')
        }
        setState(STATES.ERROR)
      }
    }
    load()
  }, [sessionId, askQuestion, navigate])

  // Timer
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

  // Handle input mode switch
  useEffect(() => {
    if (state !== STATES.LISTENING) return
    if (inputMode === 'text' && isListening) {
      stopListening()
    } else if (inputMode === 'voice' && !isListening) {
      setTimeout(() => startListening(), 300)
    }
  }, [inputMode])

  const handleStopAndSubmit = async (mode = inputMode, typed = typedAnswer) => {
    if (mode === 'voice') stopListening()
    setState(STATES.PROCESSING)

    await new Promise(resolve => setTimeout(resolve, 300))

    const finalTranscript = mode === 'text' ? typed.trim() : transcript.trim()
    const duration = mode === 'text'
      ? 60
      : startTimeRef.current
        ? Math.floor((Date.now() - startTimeRef.current) / 1000)
        : 10

    if (!finalTranscript) {
      setFeedback({ empty: true })
      setTimeout(async () => {
        const next = qNumber + 1
        if (next > MAX_QUESTIONS) { await finishInterview(sessionId); return }
        setQNumber(next)
        try {
          const nq = await interviewAPI.nextQuestion(sessionId)
          askQuestion(nq.data.question, nq.data.difficulty)
        } catch { setState(STATES.LISTENING) }
      }, 1000)
      return
    }

    try {
      const res = await interviewAPI.submitAnswer(sessionId, {
        question_text:    question,
        transcript:       finalTranscript,
        duration_seconds: duration,
        role:             role,
        input_mode:       mode,
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
          askQuestion(nq.data.question, nq.data.difficulty)
        } catch (err) {
          console.error('Next question error:', err)
          // Retry once automatically
          setTimeout(async () => {
            try {
              const nq = await interviewAPI.nextQuestion(sessionId)
              askQuestion(nq.data.question, nq.data.difficulty)
            } catch {
              setFatalError('Failed to load next question. You can end the interview and view your results.')
              setState(STATES.ERROR)
            }
          }, 3000)
        }
      }, 1500)

    } catch (err) {
      console.error('Submit error:', err)
      if (err.response?.status === 401) {
        navigate('/login')
        return
      }
      // Don't block — let them retry
      setState(STATES.LISTENING)
      setRetryCount(prev => prev + 1)
    }
  }

  const handleSkip = async () => {
    stopListening()
    stopSpeaking()
    setState(STATES.PROCESSING)
    resetTranscript()
    setTypedAnswer('')
    setFeedback({ skipped: true })

    const next = qNumber + 1
    if (next > MAX_QUESTIONS) {
      setTimeout(() => finishInterview(sessionId), 800)
      return
    }

    setQNumber(next)
    setTimeout(async () => {
      try {
        const nq = await interviewAPI.nextQuestion(sessionId)
        askQuestion(nq.data.question, nq.data.difficulty)
      } catch {
        setState(STATES.LISTENING)
      }
    }, 1000)
  }

  const handleEndEarly = async () => {
    stopListening()
    stopSpeaking()
    clearTimeout(retryTimerRef.current)
    await finishInterview(sessionId)
  }

  const handleRetryEval = async () => {
    setEvalError(false)
    setEvaluating(true)
    try {
      const res = await interviewAPI.evaluate(sessionId)
      setEvalResults(res.data)
    } catch {
      setEvalError(true)
    } finally {
      setEvaluating(false)
    }
  }

  // ── Fatal error screen ──────────────────────────────────────────────
  if (state === STATES.ERROR) {
    return (
      <div style={styles.page}>
        <div style={styles.centreCard}>
          <div style={{ fontSize: '28px', marginBottom: '1rem' }}>⚠</div>
          <h2 style={{ marginBottom: '0.5rem' }}>Interview interrupted</h2>
          <p style={{ color: '#888', marginBottom: '2rem', lineHeight: '1.6' }}>
            {fatalError || 'Something went wrong.'}
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
            <button onClick={() => navigate('/dashboard')} style={styles.primaryBtn}>
              View dashboard
            </button>
            <button onClick={() => navigate('/app')} style={styles.ghostBtn}>
              New interview
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Done / evaluation screen ────────────────────────────────────────
  if (state === STATES.DONE) {
    return (
      <div style={styles.page}>
        <div style={styles.centreCard}>
          {evaluating && (
            <>
              <div style={styles.spinner} />
              <h2 style={{ margin: '1.5rem 0 0.5rem', fontSize: '20px' }}>
                Evaluating your interview...
              </h2>
              <p style={{ color: '#888', fontSize: '14px', lineHeight: '1.6' }}>
                Groq AI is reviewing all your answers at once.
                This takes 5–15 seconds.
              </p>
            </>
          )}

          {!evaluating && evalError && (
            <>
              <div style={{ fontSize: '28px', marginBottom: '1rem' }}>⚠</div>
              <h2 style={{ marginBottom: '0.5rem' }}>Evaluation failed</h2>
              <p style={{ color: '#888', marginBottom: '1.5rem', lineHeight: '1.6' }}>
                Your answers were saved but AI evaluation failed.
                You can retry or view your raw answers in the dashboard.
              </p>
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
                <button onClick={handleRetryEval} style={styles.primaryBtn}>
                  Retry evaluation
                </button>
                <button onClick={() => navigate('/dashboard')} style={styles.ghostBtn}>
                  Go to dashboard
                </button>
              </div>
            </>
          )}

          {!evaluating && evalResults && (
            <>
              <div style={styles.doneScore}>{evalResults.overall_score}</div>
              <div style={styles.doneLabel}>Overall score</div>
              <h2 style={{ margin: '1rem 0 0.5rem' }}>Interview complete</h2>
              <p style={{ color: '#888', marginBottom: '2rem', fontSize: '14px' }}>
                {evalResults.answers?.length} questions evaluated by AI
              </p>
              <button onClick={() => navigate('/dashboard')} style={styles.primaryBtn}>
                View full results
              </button>
            </>
          )}
        </div>
      </div>
    )
  }

  // ── Main interview screen ───────────────────────────────────────────
  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <img src="/logo.png" alt="Qualif-AI" style={{ height: '70px', objectFit: 'contain' }} />
        <div style={styles.headerMeta}>
          <span style={diffStyle(difficulty)}>{difficulty}</span>
          <span style={styles.qCount}>Q {qNumber} / {MAX_QUESTIONS}</span>
          <button onClick={handleEndEarly} style={styles.endBtn}>End</button>
        </div>
      </div>

      <div style={styles.progressBg}>
        <div style={{
          ...styles.progressFill,
          width: `${((qNumber - 1) / MAX_QUESTIONS) * 100}%`
        }}/>
      </div>

      <div style={styles.content}>
        {/* Question card */}
        <div style={styles.questionCard}>
          <div style={styles.questionLabel}>Question {qNumber}</div>
          {state === STATES.LOADING ? (
            <div style={styles.questionSkeleton}>
              <div style={styles.skeletonLine} />
              <div style={{ ...styles.skeletonLine, width: '75%' }} />
            </div>
          ) : (
            <p style={styles.questionText}>{question}</p>
          )}
        </div>

        {/* State indicator */}
        <div style={styles.stateRow}>
          <div style={{
            ...styles.stateDot,
            background:
              state === STATES.LISTENING  ? '#22c55e' :
              state === STATES.SPEAKING   ? '#6366f1' :
              state === STATES.PROCESSING ? '#eab308' : '#555',
            animation: state === STATES.LISTENING ? 'pulse 2s infinite' : 'none'
          }}/>
          <span style={styles.stateLabel}>
            {state === STATES.LOADING    && 'Loading your question...'}
            {state === STATES.SPEAKING   && 'Interviewer is speaking...'}
            {state === STATES.LISTENING  && (inputMode === 'voice' ? `Listening — ${timer}s` : 'Type your answer below')}
            {state === STATES.PROCESSING && 'Saving your answer...'}
          </span>
        </div>

        {/* Retry warning */}
        {retryCount > 0 && state === STATES.LISTENING && (
          <div style={styles.warningBox}>
            Answer submission failed — please try again.
            {retryCount >= 2 && ' Consider switching to "Type instead".'}
          </div>
        )}

        {state === STATES.LISTENING && (
          <div>
            {/* Mode toggle */}
            <div style={styles.modeRow}>
              <button
                onClick={() => setInputMode('voice')}
                style={{ ...styles.modeBtn, ...(inputMode === 'voice' ? styles.modeBtnActive : {}) }}
              >
                Voice
              </button>
              <button
                onClick={() => setInputMode('text')}
                style={{ ...styles.modeBtn, ...(inputMode === 'text' ? styles.modeBtnActive : {}) }}
              >
                Type instead
              </button>
            </div>

            {/* Voice transcript */}
            {inputMode === 'voice' && (
              <div style={styles.transcriptBox}>
                <div style={styles.transcriptLabel}>Your answer</div>
                <p style={styles.transcriptText}>
                  {transcript}
                  <span style={styles.interim}>{interimTranscript}</span>
                  {!transcript && !interimTranscript && (
                    <span style={styles.placeholder}>Start speaking...</span>
                  )}
                </p>
              </div>
            )}

            {/* Text input */}
            {inputMode === 'text' && (
              <div>
                <div style={{ fontSize: '11px', color: '#555', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Your answer — confidence analysis not available for typed answers
                </div>
                <textarea
                  value={typedAnswer}
                  onChange={e => setTypedAnswer(e.target.value)}
                  placeholder="Type your answer here..."
                  style={styles.textArea}
                  rows={6}
                  autoFocus
                />
              </div>
            )}

            {/* STT error */}
            {sttError && sttError !== 'no-speech' && inputMode === 'voice' && (
              <div style={styles.errorBox}>
                Mic issue: {sttError} — switch to "Type instead" if this persists.
              </div>
            )}

            {/* Buttons */}
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
              <button
                onClick={() => handleStopAndSubmit(inputMode, typedAnswer)}
                disabled={inputMode === 'text' && !typedAnswer.trim()}
                style={{
                  ...styles.submitBtn,
                  opacity: inputMode === 'text' && !typedAnswer.trim() ? 0.5 : 1,
                  cursor:  inputMode === 'text' && !typedAnswer.trim() ? 'not-allowed' : 'pointer',
                }}
              >
                Submit answer
              </button>
              <button onClick={handleSkip} style={styles.skipBtn}>
                Skip
              </button>
            </div>
          </div>
        )}

        {/* Lightweight feedback */}
        {feedback && (
          <div style={styles.feedbackBox}>
            {feedback.skipped ? (
              <p style={{ color: '#888', fontSize: '14px' }}>
                Question skipped — next question loading...
              </p>
            ) : feedback.empty ? (
              <p style={{ color: '#888', fontSize: '14px' }}>
                No answer detected — next question loading...
              </p>
            ) : (
              <>
                <p style={{ color: '#22c55e', fontSize: '14px', marginBottom: '0.75rem', fontWeight: '500' }}>
                  Answer recorded
                </p>
                <div style={styles.feedbackRow}>
                  <span style={styles.feedbackLabel}>Word count</span>
                  <span style={styles.feedbackValue}>{feedback.word_count}</span>
                </div>
                {feedback.input_mode === 'voice' && feedback.wpm > 0 && (
                  <div style={styles.feedbackRow}>
                    <span style={styles.feedbackLabel}>Words per minute</span>
                    <span style={styles.feedbackValue}>{feedback.wpm}</span>
                  </div>
                )}
                {feedback.filler_words?.length > 0 && (
                  <div style={styles.feedbackRow}>
                    <span style={styles.feedbackLabel}>Filler words</span>
                    <span style={{ color: '#ef4444', fontSize: '13px' }}>
                      {feedback.filler_words.join(', ')}
                    </span>
                  </div>
                )}
                <p style={styles.feedbackNote}>
                  Full AI evaluation at the end of the interview
                </p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

const diffStyle = (d) => ({
  fontSize: '12px', padding: '3px 10px', borderRadius: '20px', fontWeight: '500',
  background: d === 'easy' ? '#0f2a1a' : d === 'hard' ? '#2a0f0f' : '#1a1a0f',
  color:      d === 'easy' ? '#86efac' : d === 'hard' ? '#fca5a5' : '#fde047',
  border:     `1px solid ${d === 'easy' ? '#22c55e' : d === 'hard' ? '#ef4444' : '#eab308'}`,
})

const styles = {
  page:           { minHeight: '100vh', background: '#0f0f0f', color: '#fff' },
  header:         { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 2rem', borderBottom: '1px solid #1e1e1e' },
  logo:           { fontSize: '18px', fontWeight: '700' },
  ai:             { color: '#6366f1' },
  headerMeta:     { display: 'flex', alignItems: 'center', gap: '1rem' },
  qCount:         { color: '#888', fontSize: '14px' },
  endBtn:         { background: 'transparent', border: '1px solid #2a2a2a', color: '#888', padding: '0.4rem 0.8rem', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' },
  progressBg:     { height: '3px', background: '#1e1e1e' },
  progressFill:   { height: '100%', background: '#6366f1', transition: 'width 0.5s ease' },
  content:        { maxWidth: '700px', margin: '0 auto', padding: '2.5rem 1.5rem' },
  questionCard:   { background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '12px', padding: '1.75rem', marginBottom: '1.5rem', minHeight: '100px' },
  questionLabel:  { fontSize: '12px', color: '#555', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' },
  questionText:   { fontSize: '18px', lineHeight: '1.6', color: '#fff' },
  questionSkeleton:{ display: 'flex', flexDirection: 'column', gap: '0.75rem', paddingTop: '0.25rem' },
  skeletonLine:   { height: '20px', background: '#2a2a2a', borderRadius: '4px', width: '100%', animation: 'pulse 1.5s ease-in-out infinite' },
  stateRow:       { display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' },
  stateDot:       { width: '8px', height: '8px', borderRadius: '50%', transition: 'background 0.3s', flexShrink: 0 },
  stateLabel:     { fontSize: '13px', color: '#888' },
  warningBox:     { background: '#2a1f00', border: '1px solid #5a4500', color: '#fbbf24', padding: '0.75rem 1rem', borderRadius: '8px', fontSize: '13px', marginBottom: '1rem' },
  modeRow:        { display: 'flex', gap: '0.5rem', marginBottom: '1rem' },
  modeBtn:        { background: 'transparent', border: '1px solid #2a2a2a', color: '#888', padding: '0.4rem 1rem', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' },
  modeBtnActive:  { border: '1px solid #6366f1', color: '#a5b4fc', background: '#1e1b4b' },
  transcriptBox:  { background: '#141414', border: '1px solid #2a2a2a', borderRadius: '10px', padding: '1.25rem', marginBottom: '0.75rem', minHeight: '100px' },
  transcriptLabel:{ fontSize: '11px', color: '#555', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' },
  transcriptText: { fontSize: '15px', lineHeight: '1.7', color: '#ddd' },
  interim:        { color: '#555', fontStyle: 'italic' },
  placeholder:    { color: '#333', fontStyle: 'italic' },
  textArea:       { background: '#141414', border: '1px solid #2a2a2a', borderRadius: '10px', padding: '1rem', color: '#ddd', fontSize: '15px', width: '100%', resize: 'vertical', outline: 'none', lineHeight: '1.6', marginBottom: '0.75rem', boxSizing: 'border-box' },
  errorBox:       { background: '#2a1515', border: '1px solid #5a1a1a', color: '#ff6b6b', padding: '0.75rem 1rem', borderRadius: '8px', fontSize: '13px', marginBottom: '0.75rem' },
  feedbackBox:    { background: '#111', border: '1px solid #1e3a1e', borderRadius: '10px', padding: '1.25rem', marginTop: '1rem' },
  feedbackRow:    { display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '14px' },
  feedbackLabel:  { color: '#888' },
  feedbackValue:  { color: '#fff' },
  feedbackNote:   { color: '#555', fontSize: '12px', marginTop: '0.75rem' },
  submitBtn:      { background: '#6366f1', color: '#fff', border: 'none', borderRadius: '10px', padding: '1rem 2rem', fontSize: '16px', fontWeight: '600', flex: 1 },
  skipBtn:        { background: 'transparent', color: '#888', border: '1px solid #2a2a2a', borderRadius: '10px', padding: '1rem 1.5rem', fontSize: '15px', fontWeight: '500', cursor: 'pointer', whiteSpace: 'nowrap' },
  centreCard:     { maxWidth: '420px', margin: '12vh auto', background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '16px', padding: '3rem', textAlign: 'center' },
  doneScore:      { fontSize: '72px', fontWeight: '700', color: '#22c55e', lineHeight: 1 },
  doneLabel:      { color: '#888', fontSize: '14px', marginTop: '0.5rem' },
  primaryBtn:     { background: '#6366f1', color: '#fff', border: 'none', borderRadius: '8px', padding: '0.875rem 1.5rem', fontSize: '15px', fontWeight: '600', cursor: 'pointer' },
  ghostBtn:       { background: 'transparent', border: '1px solid #2a2a2a', color: '#aaa', padding: '0.875rem 1.5rem', borderRadius: '8px', cursor: 'pointer', fontSize: '15px' },
  spinner:        { width: '44px', height: '44px', border: '3px solid #2a2a2a', borderTop: '3px solid #6366f1', borderRadius: '50%', margin: '0 auto', animation: 'spin 0.9s linear infinite' },
}
