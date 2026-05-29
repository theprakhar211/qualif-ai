import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { interviewAPI, resumeAPI } from '../services/api'

const ROLES = [
  'Software Engineer', 'Frontend Developer', 'Backend Developer',
  'Full Stack Developer', 'Data Scientist', 'Machine Learning Engineer',
  'DevOps Engineer', 'Product Manager',
]

const TOPICS_BY_ROLE = {
  'Software Engineer':       ['Data Structures', 'Algorithms', 'System Design', 'OOP', 'Databases', 'Behavioural'],
  'Frontend Developer':      ['React', 'JavaScript', 'CSS', 'Performance', 'Accessibility', 'Behavioural'],
  'Backend Developer':       ['APIs', 'Databases', 'System Design', 'Security', 'Caching', 'Behavioural'],
  'Full Stack Developer':    ['React', 'APIs', 'Databases', 'System Design', 'Behavioural'],
  'Data Scientist':          ['Machine Learning', 'Statistics', 'Python', 'SQL', 'Behavioural'],
  'Machine Learning Engineer':['Deep Learning', 'MLOps', 'Python', 'System Design', 'Behavioural'],
  'DevOps Engineer':          ['CI/CD', 'Docker', 'Kubernetes', 'Cloud', 'Monitoring', 'Behavioural'],
  'Product Manager':          ['Product Strategy', 'Metrics', 'Prioritization', 'Stakeholders', 'Behavioural'],
}

const DIFFICULTIES = [
  { id: 'easy',   label: 'Easy',   desc: 'Fundamentals and concepts',   color: '#22c55e', bg: 'rgba(34,197,94,0.05)', glow: 'rgba(34,197,94,0.2)' },
  { id: 'medium', label: 'Medium', desc: 'Balanced depth and breadth',  color: '#eab308', bg: 'rgba(234,179,8,0.05)',  glow: 'rgba(234,179,8,0.2)' },
  { id: 'hard',   label: 'Hard',   desc: 'Senior-level questions',      color: '#ef4444', bg: 'rgba(239,68,68,0.05)',  glow: 'rgba(239,68,68,0.2)' },
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
      {/* Dynamic Keyframes Injector */}
      <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      
      {/* Background glow orbs */}
      <div style={s.orb1} />
      <div style={s.orb2} />

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
          <div style={s.heroBadge}>Interview Setup</div>
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
                    <span style={{ ...s.typeLabel, color: interviewType === t.id ? '#c4b5fd' : '#fff' }}>{t.label}</span>
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
                    <div style={{ ...s.phaseDot, background: p.color, boxShadow: `0 0 6px ${p.color}` }} />
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
                  {role === r && <span style={{ marginRight: '5px', color: '#818cf8' }}>✓</span>}
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
              borderColor: resumeLoading ? '#6366f1' : resume ? '#22c55e' : isComplete && !resume ? '#6366f155' : '#2a2a2a',
              borderStyle: isComplete && !resume ? 'solid' : 'dashed',
              background: resume ? 'rgba(34,197,94,0.04)' : resumeLoading ? 'rgba(99,102,241,0.04)' : 'transparent',
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
                  style={{
                    ...s.diffBtn,
                    ...(difficulty === d.id ? {
                      border: `1px solid ${d.color}55`,
                      background: d.bg,
                      boxShadow: `0 0 16px ${d.glow}`,
                    } : {})
                  }}
                  className="btn-press"
                >
                  {difficulty === d.id && (
                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: d.color, boxShadow: `0 0 6px ${d.color}`, marginBottom: '4px' }} />
                  )}
                  <span style={{ ...s.diffLabel, color: difficulty === d.id ? d.color : '#fff' }}>{d.label}</span>
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
              opacity: canStart ? 1 : 0.35,
              cursor:  canStart ? 'pointer' : 'not-allowed',
              marginTop: '2rem',
              boxShadow: canStart ? '0 4px 24px rgba(99,102,241,0.45), 0 0 0 1px rgba(99,102,241,0.2)' : 'none',
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
  page: {
    minHeight: '100vh',
    background: '#080810',
    backgroundImage: 'radial-gradient(ellipse at 85% 0%, rgba(99,102,241,0.13) 0%, transparent 55%), radial-gradient(ellipse at 5% 95%, rgba(139,92,246,0.07) 0%, transparent 50%)',
    color: '#fff',
    position: 'relative',
    overflow: 'hidden',
  },

  orb1: {
    position: 'fixed', top: '-120px', right: '-80px',
    width: '400px', height: '400px', borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(99,102,241,0.08) 0%, transparent 70%)',
    pointerEvents: 'none', zIndex: 0,
  },
  orb2: {
    position: 'fixed', bottom: '-100px', left: '-60px',
    width: '300px', height: '300px', borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(139,92,246,0.06) 0%, transparent 70%)',
    pointerEvents: 'none', zIndex: 0,
  },

  nav: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '1rem 2rem', borderBottom: '1px solid rgba(255,255,255,0.05)',
    background: 'rgba(8,8,16,0.8)', backdropFilter: 'blur(12px)',
    position: 'sticky', top: 0, zIndex: 100,
  },
  navRight:  { display: 'flex', alignItems: 'center', gap: '1rem' },
  greeting:  { color: '#444', fontSize: '14px' },
  navGhost:  {
    background: 'transparent', border: '1px solid rgba(255,255,255,0.08)',
    color: '#666', padding: '0.4rem 0.9rem', borderRadius: '8px',
    cursor: 'pointer', fontSize: '13px', transition: 'all 0.15s',
  },

  content: { maxWidth: '720px', margin: '0 auto', padding: '3rem 1.5rem', position: 'relative', zIndex: 1 },

  hero: { marginBottom: '2.5rem' },
  heroBadge: {
    display: 'inline-block', fontSize: '11px', fontWeight: '600', letterSpacing: '0.1em',
    textTransform: 'uppercase', color: '#6366f1', background: 'rgba(99,102,241,0.1)',
    border: '1px solid rgba(99,102,241,0.25)', padding: '4px 12px', borderRadius: '20px',
    marginBottom: '1rem',
  },
  title: {
    fontSize: '36px', fontWeight: '800', marginBottom: '0.5rem', lineHeight: 1.1,
    background: 'linear-gradient(135deg, #fff 0%, rgba(255,255,255,0.65) 100%)',
    WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
  },
  sub: { color: '#444', fontSize: '15px' },

  card: {
    background: 'rgba(12,12,20,0.9)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: '24px', padding: '2rem',
    display: 'flex', flexDirection: 'column', gap: '0',
    boxShadow: '0 0 0 1px rgba(99,102,241,0.05), 0 24px 48px rgba(0,0,0,0.5)',
    backdropFilter: 'blur(8px)',
  },

  step: { paddingBottom: '2rem', marginBottom: '2rem', borderBottom: '1px solid rgba(255,255,255,0.05)' },
  stepHeader: { display: 'flex', alignItems: 'flex-start', gap: '1rem', marginBottom: '1.25rem' },
  stepNum: {
    fontSize: '32px', fontWeight: '800', color: '#6366f1',
    textShadow: '0 0 24px rgba(99,102,241,0.6)',
    lineHeight: 1, flexShrink: 0, minWidth: '48px', opacity: 1,
  },
  stepTitle: { fontSize: '16px', fontWeight: '600', marginBottom: '3px', color: '#e2e8f0' },
  stepSub:   { fontSize: '13px', color: '#444' },
  optional:  { color: '#444', fontWeight: '400', fontSize: '12px', marginLeft: '8px', background: 'rgba(255,255,255,0.04)', padding: '1px 8px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.07)' },
  required:  { color: '#818cf8', fontWeight: '400', fontSize: '12px', marginLeft: '8px', background: 'rgba(99,102,241,0.12)', padding: '1px 8px', borderRadius: '10px', border: '1px solid rgba(99,102,241,0.25)' },

  // Interview type
  typeGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' },
  typeBtn: {
    background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: '14px', padding: '1.25rem',
    cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s',
  },
  typeBtnActive: {
    background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.4)',
    boxShadow: '0 0 24px rgba(99,102,241,0.12), inset 0 1px 0 rgba(255,255,255,0.05)',
  },
  typeTop:   { display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' },
  typeIcon:  { fontSize: '20px' },
  typeLabel: { fontSize: '15px', fontWeight: '600', flex: 1, transition: 'color 0.2s' },
  typeCheck: { color: '#818cf8', fontWeight: '700', fontSize: '16px' },
  typeDesc:  { fontSize: '13px', color: '#555', lineHeight: '1.5', marginBottom: '0.5rem' },
  typeTag:   { fontSize: '11px', color: '#a5b4fc', background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', padding: '2px 8px', borderRadius: '10px' },

  // Phase preview
  phasePreview: { background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' },
  phaseItem:    { display: 'flex', alignItems: 'center', gap: '0.75rem' },
  phaseDot:     { width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0 },
  phaseInfo:    { display: 'flex', gap: '0.5rem', alignItems: 'center', minWidth: '160px' },
  phaseLabel:   { fontSize: '13px', fontWeight: '500', color: '#ccc' },
  phaseQ:       { fontSize: '11px', color: '#333', background: 'rgba(255,255,255,0.04)', padding: '1px 6px', borderRadius: '4px' },
  phaseDesc:    { fontSize: '12px', color: '#444', flex: 1 },

  // Role + topic buttons
  roleGrid: { display: 'flex', flexWrap: 'wrap', gap: '0.5rem' },
  roleBtn: {
    background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)',
    color: '#666', padding: '0.6rem 1rem', borderRadius: '8px',
    cursor: 'pointer', fontSize: '14px', transition: 'all 0.15s',
  },
  roleBtnActive: {
    background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.45)',
    color: '#a5b4fc', boxShadow: '0 0 12px rgba(99,102,241,0.18)',
  },

  topicGrid: { display: 'flex', flexWrap: 'wrap', gap: '0.5rem' },
  topicBtn: {
    background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)',
    color: '#555', padding: '0.5rem 0.9rem', borderRadius: '8px',
    cursor: 'pointer', fontSize: '13px', transition: 'all 0.15s',
  },
  topicBtnActive: {
    background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.4)',
    color: '#86efac', boxShadow: '0 0 10px rgba(34,197,94,0.12)',
  },

  // Upload
  uploadBox: {
    display: 'flex', alignItems: 'center', gap: '0.75rem',
    border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '12px',
    padding: '1rem 1.25rem', cursor: 'pointer', transition: 'all 0.2s',
  },
  inlineError: { color: '#f87171', fontSize: '13px', marginTop: '0.5rem' },
  resumePreview: { background: 'rgba(34,197,94,0.04)', border: '1px solid rgba(34,197,94,0.15)', borderRadius: '12px', padding: '1rem', marginTop: '0.75rem' },
  resumeTitle:   { fontSize: '12px', color: '#22c55e', fontWeight: '600', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' },
  resumeGrid:    { display: 'flex', gap: '1.5rem', flexWrap: 'wrap' },
  resumeItem:    { display: 'flex', gap: '0.5rem', fontSize: '13px', alignItems: 'center' },
  resumeKey:     { color: '#444' },
  resumeVal:     { color: '#ccc', fontWeight: '500' },
  techTag:       { background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)', color: '#a5b4fc', fontSize: '11px', padding: '2px 8px', borderRadius: '4px' },

  // Difficulty
  diffGrid: { display: 'flex', gap: '0.75rem' },
  diffBtn: {
    flex: 1, display: 'flex', flexDirection: 'column', gap: '4px',
    background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: '12px', padding: '0.875rem 1rem',
    cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s',
  },
  diffLabel: { fontSize: '14px', fontWeight: '700', transition: 'color 0.2s' },
  diffDesc:  { fontSize: '12px', color: '#444' },

  // Start button
  startBtn: {
    background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
    color: '#fff', border: 'none', borderRadius: '14px',
    padding: '1rem 2rem', fontSize: '16px', fontWeight: '700',
    width: '100%', transition: 'transform 0.1s, box-shadow 0.2s',
    letterSpacing: '0.01em',
  },

  error: { background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171', padding: '0.75rem 1rem', borderRadius: '10px', fontSize: '13px', marginTop: '1.5rem', lineHeight: '1.5' },
  hint:  { textAlign: 'center', color: '#2a2a2a', fontSize: '13px', marginTop: '0.75rem' },
  spinner: { width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid #fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' },
}