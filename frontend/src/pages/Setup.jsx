import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { interviewAPI, resumeAPI } from '../services/api'

const ROLES = [
  'Software Engineer', 'Frontend Developer', 'Backend Developer',
  'Full Stack Developer', 'Data Scientist', 'Machine Learning Engineer',
  'DevOps Engineer', 'Product Manager',
]

const TOPICS_BY_ROLE = {
  'Software Engineer':        ['Data Structures', 'Algorithms', 'System Design', 'OOP', 'Databases', 'Behavioural'],
  'Frontend Developer':       ['React', 'JavaScript', 'CSS', 'Performance', 'Accessibility', 'Behavioural'],
  'Backend Developer':        ['APIs', 'Databases', 'System Design', 'Security', 'Caching', 'Behavioural'],
  'Full Stack Developer':     ['React', 'APIs', 'Databases', 'System Design', 'Behavioural'],
  'Data Scientist':           ['Machine Learning', 'Statistics', 'Python', 'SQL', 'Behavioural'],
  'Machine Learning Engineer':['Deep Learning', 'MLOps', 'Python', 'System Design', 'Behavioural'],
  'DevOps Engineer':          ['CI/CD', 'Docker', 'Kubernetes', 'Cloud', 'Monitoring', 'Behavioural'],
  'Product Manager':          ['Product Strategy', 'Metrics', 'Prioritization', 'Stakeholders', 'Behavioural'],
}

const DIFFICULTIES = [
  { id: 'easy',   label: 'Easy',   desc: 'Fundamentals and concepts' },
  { id: 'medium', label: 'Medium', desc: 'Balanced depth and breadth' },
  { id: 'hard',   label: 'Hard',   desc: 'Senior-level questions' },
]

const INTERVIEW_TYPES = [
  {
    id: 'quick',
    label: 'Quick Practice',
    icon: '⚡',
    desc: '8 technical questions. Fast, focused practice on specific topics.',
    requiresResume: false,
  },
  {
    id: 'complete',
    label: 'Complete Interview',
    icon: '🎯',
    desc: 'Full structured interview — introduction, resume review, technical, and behavioural questions.',
    requiresResume: true,
  },
]

export default function Setup() {
  const navigate = useNavigate()
  const user = JSON.parse(localStorage.getItem('user') || '{}')

  const [interviewType, setInterviewType] = useState('quick')
  const [role,          setRole]          = useState('')
  const [topics,        setTopics]        = useState([])
  const [difficulty,    setDifficulty]    = useState('medium')
  const [loading,       setLoading]       = useState(false)
  const [error,         setError]         = useState('')
  const [resume,        setResume]        = useState(null)
  const [resumeParsed,  setResumeParsed]  = useState(null)
  const [resumeLoading, setResumeLoading] = useState(false)
  const [resumeError,   setResumeError]   = useState('')

  const availableTopics = TOPICS_BY_ROLE[role] || []
  const isComplete      = interviewType === 'complete'

  const toggleTopic = (topic) =>
    setTopics(prev => prev.includes(topic) ? prev.filter(t => t !== topic) : [...prev, topic])

  const handleRoleChange = (newRole) => { setRole(newRole); setTopics([]); setError('') }

  const handleTypeChange = (type) => {
    setInterviewType(type)
    setError('')
    if (type === 'quick') {
      // resume not required for quick
    }
  }

  const handleResumeUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.pdf')) { setResumeError('Only PDF files supported.'); return }
    if (file.size > 5 * 1024 * 1024) { setResumeError('Max file size is 5MB.'); return }
    setResume(file); setResumeLoading(true); setResumeError(''); setResumeParsed(null)
    try {
      const fd = new FormData(); fd.append('file', file)
      const res = await resumeAPI.upload(fd)
      setResumeParsed(res.data.parsed)
    } catch (err) {
      setResumeError(err.response?.data?.detail || 'Failed to parse resume.')
      setResume(null)
    } finally { setResumeLoading(false) }
  }

  const handleStart = async () => {
    if (!role)           { setError('Please select a job role.'); return }
    if (!topics.length)  { setError('Please select at least one topic.'); return }
    if (isComplete && !resumeParsed) { setError('Complete Interview requires a resume upload for personalized questions.'); return }

    setLoading(true); setError('')
    try {
      const res = await interviewAPI.start({ role, topics, difficulty, interview_type: interviewType })
      navigate(`/interview/${res.data.session_id}`)
    } catch (err) {
      if (err.response?.status === 401) { localStorage.clear(); navigate('/login'); return }
      setError(err.response?.data?.detail || 'Failed to start. Please try again.')
      setLoading(false)
    }
  }

  const logout = () => { localStorage.clear(); navigate('/login') }

  const canStart = role && topics.length > 0 && !loading && (!isComplete || resumeParsed)

  return (
    <div style={s.page}>
      <nav style={s.nav}>
        <img src="/logo.png" alt="Qualif-AI" style={{ height: '40px', objectFit: 'contain' }} />
        <div style={s.navRight}>
          <span style={s.greeting}>Hey, {user.name?.split(' ')[0]} 👋</span>
          <button onClick={() => navigate('/dashboard')} style={s.navGhost} className="btn-press">Dashboard</button>
          <button onClick={logout} style={s.navGhost} className="btn-press">Logout</button>
        </div>
      </nav>

      <div style={s.content}>
        <div style={s.hero}>
          <h1 style={s.title}>Set up your interview</h1>
          <p style={s.sub}>Configure your session and start practicing in under a minute</p>
        </div>

        <div style={s.card} className="fade-in">

          {/* Step 0 — Interview Type */}
          <div style={s.step}>
            <div style={s.stepHeader}>
              <span style={s.stepNum}>00</span>
              <div>
                <div style={s.stepTitle}>Choose interview type</div>
                <div style={s.stepSub}>Quick practice or a full structured interview?</div>
              </div>
            </div>
            <div style={s.typeGrid}>
              {INTERVIEW_TYPES.map(t => (
                <button
                  key={t.id}
                  onClick={() => handleTypeChange(t.id)}
                  style={{
                    ...s.typeBtn,
                    ...(interviewType === t.id ? s.typeBtnActive : {})
                  }}
                  className="btn-press"
                >
                  <div style={s.typeTop}>
                    <span style={s.typeIcon}>{t.icon}</span>
                    <span style={s.typeLabel}>{t.label}</span>
                    {interviewType === t.id && (
                      <span style={s.typeCheck}>✓</span>
                    )}
                  </div>
                  <p style={s.typeDesc}>{t.desc}</p>
                  {t.requiresResume && (
                    <span style={s.typeTag}>Requires resume</span>
                  )}
                </button>
              ))}
            </div>

            {/* Complete interview phases preview */}
            {isComplete && (
              <div style={s.phasePreview} className="fade-in">
                {[
                  { phase: 'Introduction', q: 'Q1–Q2', color: '#6366f1', desc: 'Tell me about yourself, your background' },
                  { phase: 'Resume Review', q: 'Q3–Q4', color: '#8b5cf6', desc: 'Questions based on your uploaded resume' },
                  { phase: 'Technical',    q: 'Q5–Q7', color: '#06b6d4', desc: 'Role-specific technical questions' },
                  { phase: 'Behavioural',  q: 'Q8',    color: '#22c55e', desc: 'STAR-format situational questions' },
                ].map(p => (
                  <div key={p.phase} style={s.phaseItem}>
                    <div style={{ ...s.phaseDot, background: p.color }} />
                    <div style={s.phaseInfo}>
                      <span style={s.phaseLabel}>{p.phase}</span>
                      <span style={s.phaseQ}>{p.q}</span>
                    </div>
                    <span style={s.phaseDesc}>{p.desc}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Step 1 — Role */}
          <div style={s.step}>
            <div style={s.stepHeader}>
              <span style={s.stepNum}>01</span>
              <div>
                <div style={s.stepTitle}>Choose your role</div>
                <div style={s.stepSub}>What position are you interviewing for?</div>
              </div>
            </div>
            <div style={s.roleGrid}>
              {ROLES.map(r => (
                <button
                  key={r}
                  onClick={() => handleRoleChange(r)}
                  style={{ ...s.roleBtn, ...(role === r ? s.roleBtnActive : {}) }}
                  className="btn-press"
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {/* Step 2 — Topics */}
          {role && (
            <div style={s.step} className="fade-in">
              <div style={s.stepHeader}>
                <span style={s.stepNum}>02</span>
                <div>
                  <div style={s.stepTitle}>Pick your topics</div>
                  <div style={s.stepSub}>
                    {isComplete
                      ? 'Topics for the technical phase (Q5–Q7)'
                      : 'Select all areas you want to be tested on'}
                  </div>
                </div>
              </div>
              <div style={s.topicGrid}>
                {availableTopics.map(t => (
                  <button
                    key={t}
                    onClick={() => toggleTopic(t)}
                    style={{ ...s.topicBtn, ...(topics.includes(t) ? s.topicBtnActive : {}) }}
                    className="btn-press"
                  >
                    {topics.includes(t) ? '✓ ' : ''}{t}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 3 — Resume */}
          <div style={s.step}>
            <div style={s.stepHeader}>
              <span style={s.stepNum}>03</span>
              <div>
                <div style={s.stepTitle}>
                  Upload resume
                  {isComplete
                    ? <span style={s.required}>required</span>
                    : <span style={s.optional}>optional</span>
                  }
                </div>
                <div style={s.stepSub}>
                  {isComplete
                    ? 'Required for resume review phase — questions will be personalized to your background'
                    : 'Personalizes questions to your background'}
                </div>
              </div>
            </div>

            <label style={{
              ...s.uploadBox,
              borderColor: resumeLoading ? '#6366f1' : resume ? '#22c55e' : isComplete ? '#6366f1' : '#2a2a2a',
              borderStyle: isComplete && !resume ? 'solid' : 'dashed',
            }}>
              <input type="file" accept=".pdf" onChange={handleResumeUpload} disabled={resumeLoading} style={{ display: 'none' }} />
              <span style={{ fontSize: '20px' }}>{resumeLoading ? '⏳' : resume ? '✅' : '📄'}</span>
              <span style={{ color: resumeLoading ? '#6366f1' : resume ? '#22c55e' : '#555', fontSize: '14px' }}>
                {resumeLoading ? 'Parsing with AI...' : resume ? resume.name : 'Click to upload PDF resume (max 5MB)'}
              </span>
            </label>

            {resumeError && <div style={s.inlineError}>{resumeError}</div>}

            {resumeParsed && (
              <div style={s.resumePreview} className="fade-in">
                <div style={s.resumeTitle}>✓ Resume parsed</div>
                <div style={s.resumeGrid}>
                  {resumeParsed.target_role && (
                    <div style={s.resumeItem}>
                      <span style={s.resumeKey}>Role</span>
                      <span style={s.resumeVal}>{resumeParsed.target_role}</span>
                    </div>
                  )}
                  {resumeParsed.years_experience > 0 && (
                    <div style={s.resumeItem}>
                      <span style={s.resumeKey}>Experience</span>
                      <span style={s.resumeVal}>{resumeParsed.years_experience} years</span>
                    </div>
                  )}
                </div>
                {resumeParsed.technologies?.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '0.5rem' }}>
                    {resumeParsed.technologies.slice(0, 8).map(t => (
                      <span key={t} style={s.techTag}>{t}</span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Step 4 — Difficulty */}
          <div style={{ ...s.step, borderBottom: 'none', marginBottom: 0, paddingBottom: 0 }}>
            <div style={s.stepHeader}>
              <span style={s.stepNum}>04</span>
              <div>
                <div style={s.stepTitle}>Set difficulty</div>
                <div style={s.stepSub}>
                  {isComplete
                    ? 'Applies to the technical phase questions'
                    : 'How challenging should the questions be?'}
                </div>
              </div>
            </div>
            <div style={s.diffGrid}>
              {DIFFICULTIES.map(d => (
                <button
                  key={d.id}
                  onClick={() => setDifficulty(d.id)}
                  style={{ ...s.diffBtn, ...(difficulty === d.id ? s.diffBtnActive[d.id] : {}) }}
                  className="btn-press"
                >
                  <span style={s.diffLabel}>{d.label}</span>
                  <span style={s.diffDesc}>{d.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {error && <div style={s.error}>{error}</div>}

          <button
            onClick={handleStart}
            disabled={!canStart}
            style={{
              ...s.startBtn,
              opacity: canStart ? 1 : 0.4,
              cursor:  canStart ? 'pointer' : 'not-allowed',
              marginTop: '2rem',
            }}
            className="btn-press"
          >
            {loading ? (
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                <span style={s.spinner} /> Generating your first question...
              </span>
            ) : (
              `Start ${interviewType === 'complete' ? 'complete ' : ''}interview →`
            )}
          </button>

          {/* Helper hints */}
          {!role && <p style={s.hint}>Select a role above to continue</p>}
          {role && !topics.length && <p style={s.hint}>Select at least one topic to continue</p>}
          {role && topics.length > 0 && isComplete && !resumeParsed && (
            <p style={s.hint}>Upload your resume to unlock Complete Interview</p>
          )}
        </div>
      </div>
    </div>
  )
}

const s = {
  page:     { minHeight: '100vh', background: '#0a0a0a', color: '#fff' },
  nav:      { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 2rem', borderBottom: '1px solid #1a1a1a', background: '#0a0a0a' },
  navRight: { display: 'flex', alignItems: 'center', gap: '1rem' },
  greeting: { color: '#555', fontSize: '14px' },
  navGhost: { background: 'transparent', border: '1px solid #2a2a2a', color: '#888', padding: '0.4rem 0.9rem', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', transition: 'all 0.15s' },
  content:  { maxWidth: '720px', margin: '0 auto', padding: '3rem 1.5rem' },
  hero:     { marginBottom: '2rem' },
  title:    { fontSize: '32px', fontWeight: '700', marginBottom: '0.5rem' },
  sub:      { color: '#555', fontSize: '15px' },
  card:     { background: '#0f0f0f', border: '1px solid #1e1e1e', borderRadius: '20px', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '0' },
  step:     { paddingBottom: '2rem', marginBottom: '2rem', borderBottom: '1px solid #1a1a1a' },
  stepHeader: { display: 'flex', alignItems: 'flex-start', gap: '1rem', marginBottom: '1.25rem' },
  stepNum:  { fontSize: '28px', fontWeight: '700', color: '#6366f1', opacity: 0.6, lineHeight: 1, flexShrink: 0 },
  stepTitle:{ fontSize: '16px', fontWeight: '600', marginBottom: '2px' },
  stepSub:  { fontSize: '13px', color: '#555' },
  optional: { color: '#444', fontWeight: '400', fontSize: '12px', marginLeft: '6px', background: '#1a1a1a', padding: '1px 8px', borderRadius: '10px' },
  required: { color: '#6366f1', fontWeight: '400', fontSize: '12px', marginLeft: '6px', background: '#1e1b4b', padding: '1px 8px', borderRadius: '10px' },

  // Interview type selector
  typeGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' },
  typeBtn: {
    background: '#151515', border: '1px solid #2a2a2a',
    borderRadius: '12px', padding: '1.25rem',
    cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
  },
  typeBtnActive: { background: '#1e1b4b', border: '1px solid #6366f1' },
  typeTop:  { display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' },
  typeIcon: { fontSize: '20px' },
  typeLabel:{ fontSize: '15px', fontWeight: '600', color: '#fff', flex: 1 },
  typeCheck:{ color: '#6366f1', fontWeight: '700' },
  typeDesc: { fontSize: '13px', color: '#666', lineHeight: '1.5', marginBottom: '0.5rem' },
  typeTag:  { fontSize: '11px', color: '#a5b4fc', background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', padding: '2px 8px', borderRadius: '10px' },

  // Phase preview
  phasePreview: { background: '#111', border: '1px solid #1e1e1e', borderRadius: '10px', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' },
  phaseItem:    { display: 'flex', alignItems: 'center', gap: '0.75rem' },
  phaseDot:     { width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0 },
  phaseInfo:    { display: 'flex', gap: '0.5rem', alignItems: 'center', minWidth: '160px' },
  phaseLabel:   { fontSize: '13px', fontWeight: '500', color: '#ccc' },
  phaseQ:       { fontSize: '11px', color: '#444', background: '#1a1a1a', padding: '1px 6px', borderRadius: '4px' },
  phaseDesc:    { fontSize: '12px', color: '#555', flex: 1 },

  roleGrid: { display: 'flex', flexWrap: 'wrap', gap: '0.5rem' },
  roleBtn:  { background: '#151515', border: '1px solid #2a2a2a', color: '#888', padding: '0.6rem 1rem', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', transition: 'all 0.15s' },
  roleBtnActive: { background: '#1e1b4b', border: '1px solid #6366f1', color: '#a5b4fc' },
  topicGrid:{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' },
  topicBtn: { background: '#151515', border: '1px solid #2a2a2a', color: '#888', padding: '0.5rem 0.9rem', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', transition: 'all 0.15s' },
  topicBtnActive: { background: '#0f2a1a', border: '1px solid #22c55e', color: '#86efac' },

  uploadBox: { display: 'flex', alignItems: 'center', gap: '0.75rem', border: '1px dashed #2a2a2a', borderRadius: '10px', padding: '1rem 1.25rem', cursor: 'pointer', transition: 'border-color 0.2s' },
  inlineError:{ color: '#ff6b6b', fontSize: '13px', marginTop: '0.5rem' },
  resumePreview:     { background: '#111', border: '1px solid #1e3a1e', borderRadius: '10px', padding: '1rem', marginTop: '0.75rem' },
  resumeTitle:       { fontSize: '12px', color: '#22c55e', fontWeight: '500', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' },
  resumeGrid: { display: 'flex', gap: '1.5rem', flexWrap: 'wrap' },
  resumeItem: { display: 'flex', gap: '0.5rem', fontSize: '13px', alignItems: 'center' },
  resumeKey:  { color: '#555' },
  resumeVal:  { color: '#ccc', fontWeight: '500' },
  techTag:    { background: '#1e1b4b', border: '1px solid rgba(99,102,241,0.3)', color: '#a5b4fc', fontSize: '11px', padding: '2px 8px', borderRadius: '4px' },

  diffGrid: { display: 'flex', gap: '0.75rem' },
  diffBtn: { flex: 1, display: 'flex', flexDirection: 'column', gap: '4px', background: '#151515', border: '1px solid #2a2a2a', borderRadius: '10px', padding: '0.875rem 1rem', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s' },
  diffBtnActive: {
    easy:   { background: '#0f2a1a', border: '1px solid #22c55e' },
    medium: { background: '#1a1a0f', border: '1px solid #eab308' },
    hard:   { background: '#2a0f0f', border: '1px solid #ef4444' },
  },
  diffLabel: { fontSize: '14px', fontWeight: '600', color: '#fff' },
  diffDesc:  { fontSize: '12px', color: '#555' },

  error:   { background: '#2a1515', border: '1px solid #5a1a1a', color: '#ff6b6b', padding: '0.75rem 1rem', borderRadius: '8px', fontSize: '13px', marginTop: '1.5rem', lineHeight: '1.5' },
  startBtn:{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff', border: 'none', borderRadius: '12px', padding: '1rem 2rem', fontSize: '16px', fontWeight: '600', width: '100%', transition: 'transform 0.1s' },
  hint:    { textAlign: 'center', color: '#333', fontSize: '13px', marginTop: '0.75rem' },
  spinner: { width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid #fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' },
}
