import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { interviewAPI, resumeAPI } from '../services/api'

const ROLES = [
  'Software Engineer', 'Frontend Developer', 'Backend Developer',
  'Full Stack Developer', 'Data Scientist', 'Machine Learning Engineer',
  'DevOps Engineer', 'Product Manager',
]

const TOPICS_BY_ROLE = {
  'Software Engineer':         ['Data Structures', 'Algorithms', 'System Design', 'OOP', 'Databases', 'Behavioural'],
  'Frontend Developer':        ['React', 'JavaScript', 'CSS', 'Performance', 'Accessibility', 'Behavioural'],
  'Backend Developer':         ['APIs', 'Databases', 'System Design', 'Security', 'Caching', 'Behavioural'],
  'Full Stack Developer':      ['React', 'APIs', 'Databases', 'System Design', 'Behavioural'],
  'Data Scientist':            ['Machine Learning', 'Statistics', 'Python', 'SQL', 'Behavioural'],
  'Machine Learning Engineer': ['Deep Learning', 'MLOps', 'Python', 'System Design', 'Behavioural'],
  'DevOps Engineer':           ['CI/CD', 'Docker', 'Kubernetes', 'Cloud', 'Monitoring', 'Behavioural'],
  'Product Manager':           ['Product Strategy', 'Metrics', 'Prioritization', 'Stakeholders', 'Behavioural'],
}

const INTERVIEW_TYPES = [
  {
    id:    'quick',
    label: 'Quick Practice',
    icon:  'bolt',
    desc:  'Focused, single-topic drill sessions designed for speed.',
    requiresResume: false,
  },
  {
    id:    'complete',
    label: 'Complete Interview',
    icon:  'target',
    desc:  'Full-length realistic simulation of a real hiring loop.',
    requiresResume: true,
  },
]

const DIFFICULTY_BARS = { easy: '33%', medium: '66%', hard: '100%' }
const DIFFICULTY_COLORS = { easy: '#22c55e', medium: '#2563eb', hard: '#ef4444' }

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

  const handleTypeChange = (type) => { setInterviewType(type); setError('') }

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
    if (!role)          { setError('Please select a job role.'); return }
    if (!topics.length) { setError('Please select at least one topic.'); return }
    if (isComplete && !resumeParsed) { setError('Complete Interview requires a resume upload.'); return }
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

  // Estimated duration
  const duration = isComplete ? '45–60 minutes' : '20–25 minutes'

  return (
    <div style={s.page} className="setup-page">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Geist:wght@600;700;800;900&family=Inter:wght@400;500;600&display=swap');
        @keyframes fadeUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes shimmerGlow {
          0%, 100% { box-shadow: 0 0 30px -8px rgba(37,99,235,0.6), 0 4px 24px rgba(37,99,235,0.25); }
          50%       { box-shadow: 0 0 50px -4px rgba(37,99,235,0.8), 0 4px 32px rgba(37,99,235,0.35); }
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        html, body {
          max-width: 100% !important;
          overflow-x: hidden !important;
        }

        .setup-fade { animation: fadeUp 0.5s ease-out forwards; }
        .start-glow { animation: shimmerGlow 3s ease-in-out infinite; }
        .pill-hover:hover { background: rgba(255,255,255,0.07) !important; border-color: rgba(255,255,255,0.15) !important; color: #e2e8f0 !important; }
        .type-card-hover:hover { border-color: rgba(255,255,255,0.2) !important; background: rgba(255,255,255,0.04) !important; }
        .diff-hover:hover { border-color: rgba(255,255,255,0.15) !important; }
        .upload-hover:hover { border-color: rgba(37,99,235,0.5) !important; background: rgba(37,99,235,0.04) !important; }

        /* ── Mobile Responsive Adjustments ── */
        @media (max-width: 640px) {
          .setup-page { 
            padding-bottom: 4rem !important; 
            width: 100% !important;
            max-width: 100% !important;
            box-sizing: border-box !important;
          }

          .setup-nav { padding: 0 12px !important; height: 56px !important; box-sizing: border-box !important; }
          .setup-nav-name { display: none !important; }
          .setup-nav-ghost { font-size: 12px !important; padding: 0.3rem 0.6rem !important; }

          .setup-main { 
            padding: 1.5rem 12px !important; 
            width: 100% !important;
            max-width: 100% !important;
            box-sizing: border-box !important;
          }
          .setup-header-title { font-size: clamp(26px, 8vw, 36px) !important; }

          .setup-card { 
            padding: 1.25rem !important; 
            border-radius: 16px !important; 
            width: 100% !important;
            max-width: 100% !important;
            box-sizing: border-box !important;
          }
          .setup-step { padding-bottom: 1.5rem !important; margin-bottom: 1.5rem !important; }
          .setup-step-num { font-size: 24px !important; min-width: 36px !important; }
          .setup-section-title { font-size: 18px !important; }

          .setup-type-grid { 
            grid-template-columns: 1fr !important; 
            gap: 0.75rem !important; 
            width: 100% !important;
            box-sizing: border-box !important;
          }
          .setup-type-card { padding: 1.25rem !important; width: 100% !important; box-sizing: border-box !important; }
          .setup-type-icon { font-size: 26px !important; }
          .setup-type-card-title { font-size: 15px !important; }
          .setup-type-desc { font-size: 12px !important; }

          .setup-role-btn { font-size: 12px !important; padding: 0.45rem 0.75rem !important; }
          .setup-topic-btn { font-size: 11px !important; padding: 0.4rem 0.65rem !important; }

          /* Clean Grid stacking for Phase Previews on mobile screen views */
          .setup-phase-preview {
            display: grid !important;
            grid-template-columns: 1fr 1fr !important;
            gap: 12px !important;
          }
          .setup-phase-connector { display: none !important; }

          .setup-diff-grid { grid-template-columns: 1fr !important; gap: 0.5rem !important; width: 100% !important; }
          .setup-diff-btn { padding: 1rem 0.75rem !important; width: 100% !important; box-sizing: border-box !important; }
          .setup-diff-label { font-size: 12px !important; }

          .setup-start-btn { 
            font-size: 15px !important; 
            padding: 1rem 1.5rem !important; 
            width: 100% !important;
            box-sizing: border-box !important;
          }
        }
      `}</style>

      {/* Background elements */}
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
        <div style={s.bgGlow1} />
        <div style={s.bgGlow2} />
        <div style={s.cardGlow} />
      </div>

      {/* Navbar */}
      <nav style={s.nav} className="setup-nav">
        <img
          src="/logo.png"
          alt="Qualif-AI"
          style={{ height: '40px', objectFit: 'contain', cursor: 'pointer' }}
          onClick={() => navigate('/')}
        />
        <div style={s.navRight}>
          <div style={s.navUser}>
            <div style={s.navAvatar}>{user.name?.charAt(0)?.toUpperCase() || 'U'}</div>
            <span style={s.navName} className="setup-nav-name">{user.name}</span>
          </div>
          <button onClick={() => navigate('/dashboard')} style={s.navGhost} className="setup-nav-ghost">Dashboard</button>
          <button onClick={logout} style={s.navLogout} className="setup-nav-ghost">Logout</button>
        </div>
      </nav>

      <main style={s.main} className="setup-main">
        {/* Page header */}
        <header style={s.header} className="setup-fade">
          <div style={s.headerBadge}>
            <span style={s.headerBadgeDot} />
            <span style={s.headerEyebrow}>SYSTEM CONFIGURATION</span>
          </div>
          <h1 style={s.headerTitle} className="setup-header-title">Set up your interview</h1>
          <p style={s.headerSub}>Configure your session and start practicing in under a minute</p>
        </header>

        {/* Main card */}
        <div style={s.card} className="setup-fade setup-card">
          <div style={s.sections}>

            {/* ── Step 00 — Session Type ── */}
            <section style={s.section}>
              <div style={s.sectionHead}>
                <span style={s.stepNum}>00</span>
                <h2 style={s.sectionTitle}>Choose Session Type</h2>
              </div>
              <div style={s.typeGrid} className="setup-type-grid">
                {INTERVIEW_TYPES.map(t => {
                  const active = interviewType === t.id
                  return (
                    <button
                      key={t.id}
                      onClick={() => handleTypeChange(t.id)}
                      className={`setup-type-card ${active ? '' : 'type-card-hover'}`}
                      style={{
                        ...s.typeCard,
                        ...(active ? s.typeCardActive : {}),
                      }}
                    >
                      {active && <div style={s.typeCardCheck}>✓</div>}
                      <span style={{ fontSize: '32px', marginBottom: '12px', display: 'block' }} className="setup-type-icon">
                        {t.id === 'quick' ? '⚡' : '🎯'}
                      </span>
                      <h3 style={{ ...s.typeCardTitle, color: active ? '#fff' : 'rgba(228,225,237,0.7)' }} className="setup-type-card-title">
                        {t.label}
                      </h3>
                      <p style={s.typeCardDesc} className="setup-type-desc">{t.desc}</p>
                      {t.requiresResume && (
                        <span style={s.typeCardTag}>Requires resume</span>
                      )}
                    </button>
                  )
                })}
              </div>

              {/* Phase preview for Complete Interview */}
              {isComplete && (
                <div style={s.phasePreview} className="setup-phase-preview setup-fade">
                  {[
                    { label: 'Introduction',  qs: 'Q1–Q2', color: '#6366f1' },
                    { label: 'Resume Review', qs: 'Q3–Q4', color: '#8b5cf6' },
                    { label: 'Technical',     qs: 'Q5–Q7', color: '#06b6d4' },
                    { label: 'Behavioural',   qs: 'Q8',    color: '#22c55e' },
                  ].map((p, i) => (
                    <div key={p.label} style={s.phaseRow}>
                      {i > 0 && <div style={s.phaseConnector} className="setup-phase-connector" />}
                      <div style={{ ...s.phaseDot, background: p.color, boxShadow: `0 0 8px ${p.color}60` }} />
                      <span style={s.phaseLabel}>{p.label}</span>
                      <span style={s.phaseQs}>{p.qs}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* ── Step 01 — Role ── */}
            <section style={s.section}>
              <div style={s.sectionHead}>
                <span style={s.stepNum}>01</span>
                <h2 style={s.sectionTitle}>Target Role</h2>
              </div>
              <div style={s.pillWrap}>
                {ROLES.map(r => {
                  const active = role === r
                  return (
                    <button
                      key={r}
                      onClick={() => handleRoleChange(r)}
                      className={`setup-role-btn ${active ? '' : 'pill-hover'}`}
                      style={{
                        ...s.pill,
                        ...(active ? s.pillActive : s.pillInactive),
                      }}
                    >
                      {r}
                    </button>
                  )
                })}
              </div>
            </section>

            {/* ── Step 02 — Topics ── */}
            {role && (
              <section style={s.section} className="setup-fade">
                <div style={s.sectionHead}>
                  <span style={s.stepNum}>02</span>
                  <h2 style={s.sectionTitle}>Select Topics</h2>
                </div>
                <div style={s.pillWrap}>
                  {availableTopics.map(t => {
                    const active = topics.includes(t)
                    return (
                      <button
                        key={t}
                        onClick={() => toggleTopic(t)}
                        className={`setup-topic-btn ${active ? '' : 'pill-hover'}`}
                        style={{
                          ...s.pillSm,
                          ...(active ? s.pillActive : s.pillInactive),
                        }}
                      >
                        {t}
                      </button>
                    )
                  })}
                </div>
              </section>
            )}

            {/* ── Step 03 — Resume ── */}
            <section style={s.section}>
              <div style={s.sectionHead}>
                <span style={s.stepNum}>03</span>
                <h2 style={s.sectionTitle}>
                  Upload Resume
                  {isComplete
                    ? <span style={s.tagRequired}>required</span>
                    : <span style={s.tagOptional}>optional</span>
                  }
                </h2>
              </div>

              <label
                style={{
                  ...s.uploadBox,
                  borderColor: resumeLoading
                    ? 'rgba(37,99,235,0.6)'
                    : resume
                    ? 'rgba(34,197,94,0.4)'
                    : isComplete
                    ? 'rgba(37,99,235,0.35)'
                    : 'rgba(255,255,255,0.08)',
                }}
                className="upload-hover"
              >
                <input
                  type="file"
                  accept=".pdf"
                  onChange={handleResumeUpload}
                  disabled={resumeLoading}
                  style={{ display: 'none' }}
                />
                <div style={s.uploadIcon}>
                  <span style={{ fontSize: '28px' }}>
                    {resumeLoading ? '⏳' : resume ? '✅' : '☁️'}
                  </span>
                </div>
                <div style={s.uploadText}>
                  <p style={s.uploadTitle}>
                    {resumeLoading ? 'Parsing with AI...' : resume ? resume.name : 'Click to upload PDF'}
                  </p>
                  <p style={s.uploadSub}>MAX FILE SIZE 5MB</p>
                </div>
              </label>

              {resumeError && <p style={s.inlineError}>{resumeError}</p>}

              {resumeParsed && (
                <div style={s.resumePreview} className="setup-fade">
                  <p style={s.resumeTitle}>✓ Resume parsed successfully</p>
                  <div style={s.resumeMeta}>
                    {resumeParsed.target_role && (
                      <div style={s.resumeMetaItem}>
                        <span style={s.resumeMetaKey}>Role</span>
                        <span style={s.resumeMetaVal}>{resumeParsed.target_role}</span>
                      </div>
                    )}
                    {resumeParsed.years_experience > 0 && (
                      <div style={s.resumeMetaItem}>
                        <span style={s.resumeMetaKey}>Experience</span>
                        <span style={s.resumeMetaVal}>{resumeParsed.years_experience} yrs</span>
                      </div>
                    )}
                  </div>
                  {resumeParsed.technologies?.length > 0 && (
                    <div style={s.techTags}>
                      {resumeParsed.technologies.slice(0, 8).map(t => (
                        <span key={t} style={s.techTag}>{t}</span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* ── Step 04 — Difficulty ── */}
            <section style={{ ...s.section, borderBottom: 'none', marginBottom: 0, paddingBottom: 0 }}>
              <div style={s.sectionHead}>
                <span style={s.stepNum}>04</span>
                <h2 style={s.sectionTitle}>Difficulty Level</h2>
              </div>
              <div style={s.diffGrid} className="setup-diff-grid">
                {['easy', 'medium', 'hard'].map(d => {
                  const active = difficulty === d
                  const color  = DIFFICULTY_COLORS[d]
                  const bar    = DIFFICULTY_BARS[d]
                  return (
                    <button
                      key={d}
                      onClick={() => setDifficulty(d)}
                      className={`setup-diff-btn ${active ? '' : 'diff-hover'}`}
                      style={{
                        ...s.diffCard,
                        background: active ? `rgba(${d === 'easy' ? '34,197,94' : d === 'medium' ? '37,99,235' : '239,68,68'},0.08)` : 'rgba(255,255,255,0.02)',
                        borderColor: active ? `${color}66` : 'rgba(255,255,255,0.06)',
                        boxShadow: active ? `0 0 20px ${color}22` : 'none',
                      }}
                    >
                      <span style={{ ...s.diffLabel, color: active ? color : 'rgba(228,225,237,0.35)' }} className="setup-diff-label">
                        {d.toUpperCase()}
                      </span>
                      <div style={s.diffBarBg}>
                        <div style={{
                          ...s.diffBarFill,
                          width: bar,
                          background: active ? color : 'rgba(255,255,255,0.1)',
                          boxShadow: active ? `0 0 8px ${color}88` : 'none',
                        }} />
                      </div>
                    </button>
                  )
                })}
              </div>
            </section>

            {/* ── Error ── */}
            {error && (
              <div style={s.errorBox}>{error}</div>
            )}

            {/* ── Start button ── */}
            <div style={{ marginTop: '2rem' }}>
              <button
                onClick={handleStart}
                disabled={!canStart}
                className={`setup-start-btn ${canStart ? 'start-glow' : ''}`}
                style={{
                  ...s.startBtn,
                  opacity:    canStart ? 1 : 0.35,
                  cursor:     canStart ? 'pointer' : 'not-allowed',
                  transform:  'none',
                }}
              >
                {loading ? (
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem' }}>
                    <span style={s.spinner} />
                    Generating your first question...
                  </span>
                ) : (
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                    Start interview
                    <span style={{ fontSize: '20px', fontWeight: '300' }}>›</span>
                  </span>
                )}
              </button>

              {/* Duration hint */}
              <div style={s.durationHint}>
                <span style={{ fontSize: '14px' }}>🕐</span>
                <span>ESTIMATED DURATION: {duration}</span>
              </div>
            </div>

          </div>
        </div>
      </main>
    </div>
  )
}

const s = {
  page: {
    minHeight: '100vh',
    width: '100%',
    background: '#030308',
    backgroundImage: 'radial-gradient(circle at 50% 15%, rgba(37,99,235,0.12) 0%, transparent 50%), radial-gradient(circle at 0% 0%, rgba(37,99,235,0.05) 0%, transparent 40%), radial-gradient(circle at 100% 100%, rgba(37,99,235,0.03) 0%, transparent 40%)',
    color: '#e4e1ed',
    position: 'relative',
    paddingBottom: '6rem',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
  },

  bgGlow1: {
    position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
    width: '800px', height: '400px', pointerEvents: 'none',
    background: 'radial-gradient(ellipse, rgba(37,99,235,0.08) 0%, transparent 70%)',
  },
  bgGlow2: {
    position: 'absolute', bottom: '-100px', left: '-100px',
    width: '500px', height: '500px', pointerEvents: 'none',
    background: 'radial-gradient(circle, rgba(99,102,241,0.05) 0%, transparent 70%)',
  },

  // Navbar
  nav: {
    position: 'sticky', top: 0, zIndex: 100,
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    height: '64px', padding: '0 24px',
    background: 'rgba(3,3,8,0.7)', backdropFilter: 'blur(16px)',
    borderBottom: '1px solid rgba(255,255,255,0.05)',
  },
  navRight:  { display: 'flex', alignItems: 'center', gap: '1rem' },
  navUser:   { display: 'flex', alignItems: 'center', gap: '0.5rem', marginRight: '0.5rem' },
  navAvatar: {
    width: '28px', height: '28px', borderRadius: '50%',
    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '12px', fontWeight: '700', color: '#fff', flexShrink: 0,
  },
  navName:   { fontSize: '14px', color: 'rgba(228,225,237,0.5)', fontWeight: '500' },
  navGhost:  {
    background: 'transparent', border: '1px solid rgba(255,255,255,0.08)',
    color: 'rgba(228,225,237,0.5)', padding: '0.4rem 0.9rem', borderRadius: '8px',
    cursor: 'pointer', fontSize: '13px', fontWeight: '600', transition: 'all 0.15s',
  },
  navLogout: {
    background: 'transparent', border: 'none',
    color: 'rgba(228,225,237,0.3)', padding: '0.4rem 0.5rem',
    cursor: 'pointer', fontSize: '13px', fontWeight: '500', transition: 'color 0.15s',
  },

  // Main layout
  main:   { position: 'relative', zIndex: 1, maxWidth: '760px', margin: '0 auto', padding: '5rem 24px 0' },

  header: { marginBottom: '2.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' },
  headerBadge: {
    display: 'inline-flex', alignItems: 'center', gap: '8px',
    background: 'linear-gradient(180deg, rgba(37,99,235,0.12) 0%, rgba(37,99,235,0.04) 100%)',
    border: '1px solid rgba(37,99,235,0.3)', padding: '5px 14px', borderRadius: '99px',
    marginBottom: '16px', boxShadow: '0 2px 12px rgba(37,99,235,0.15)',
  },
  headerBadgeDot: { width: '6px', height: '6px', borderRadius: '50%', background: '#3b82f6', boxShadow: '0 0 8px #3b82f6' },
  headerEyebrow: {
    fontSize: '11px', fontWeight: '700', letterSpacing: '0.12em',
    background: 'linear-gradient(135deg, #cbd5e1 0%, #94a3b8 100%)',
    WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
  },
  headerTitle: {
    fontSize: 'clamp(36px, 6vw, 52px)', fontWeight: '800', lineHeight: 1.1,
    letterSpacing: '-0.02em', color: '#fff', marginBottom: '14px',
    fontFamily: "'Geist', sans-serif",
  },
  headerSub: { color: 'rgba(228,225,237,0.4)', fontSize: '16px', maxWidth: '520px' },

  cardGlow: {
    position: 'absolute', inset: 0,
    background: 'rgba(37,99,235,0.04)', filter: 'blur(120px)',
    borderRadius: '50%', transform: 'scaleX(1.5) translateY(80px)',
    pointerEvents: 'none',
  },

  card: {
    position: 'relative', zIndex: 1,
    background: 'linear-gradient(180deg, rgba(31,31,39,0.7) 0%, rgba(19,19,27,0.8) 100%)',
    backdropFilter: 'blur(24px)',
    border: '1px solid rgba(37,99,235,0.15)',
    borderRadius: '24px',
    boxShadow: '0 0 40px -10px rgba(0,0,0,0.6), 0 0 20px -5px rgba(37,99,235,0.1)',
    padding: '3rem',
  },

  sections: { display: 'flex', flexDirection: 'column', gap: '0' },

  section: {
    paddingBottom: '3rem',
    marginBottom: '3rem',
    borderBottom: '1px solid rgba(255,255,255,0.05)',
  },
  sectionHead: { display: 'flex', alignItems: 'center', gap: '1.25rem', marginBottom: '1.5rem' },
  stepNum: {
    fontSize: '32px', fontWeight: '800', lineHeight: 1,
    color: '#2563eb',
    textShadow: '0 0 20px rgba(37,99,235,0.6)',
    flexShrink: 0, minWidth: '48px',
    fontFamily: "'Geist', sans-serif",
  },
  sectionTitle: {
    fontSize: '22px', fontWeight: '700', color: '#fff',
    letterSpacing: '-0.01em', display: 'flex', alignItems: 'center', gap: '0',
    fontFamily: "'Geist', sans-serif",
  },

  tagOptional: {
    marginLeft: '10px', fontSize: '11px', fontWeight: '600', letterSpacing: '0.05em',
    color: 'rgba(228,225,237,0.3)', background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.07)', padding: '2px 8px', borderRadius: '10px',
  },
  tagRequired: {
    marginLeft: '10px', fontSize: '11px', fontWeight: '600', letterSpacing: '0.05em',
    color: '#818cf8', background: 'rgba(99,102,241,0.12)',
    border: '1px solid rgba(99,102,241,0.25)', padding: '2px 8px', borderRadius: '10px',
  },

  // Interview type cards
  typeGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' },
  typeCard: {
    position: 'relative',
    background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: '16px', padding: '2rem',
    cursor: 'pointer', textAlign: 'left', transition: 'all 0.25s',
  },
  typeCardActive: {
    background: 'rgba(37,99,235,0.06)',
    border: '2px solid #2563eb',
    boxShadow: '0 0 32px rgba(37,99,235,0.15), inset 0 1px 0 rgba(255,255,255,0.05)',
  },
  typeCardCheck: {
    position: 'absolute', top: '14px', right: '14px',
    width: '24px', height: '24px', borderRadius: '50%',
    background: '#2563eb', color: '#fff',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '13px', fontWeight: '700',
  },
  typeCardTitle: { fontSize: '16px', fontWeight: '700', marginBottom: '8px' },
  typeCardDesc:  { fontSize: '13px', color: 'rgba(228,225,237,0.35)', lineHeight: '1.6', marginBottom: '10px' },
  typeCardTag:   {
    display: 'inline-block', fontSize: '11px', color: '#a5b4fc',
    background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)',
    padding: '2px 10px', borderRadius: '10px',
  },

  // Phase preview
  phasePreview: {
    display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '12px',
    background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)',
    borderRadius: '12px', padding: '1.25rem',
  },
  phaseRow:      { display: 'flex', alignItems: 'center', gap: '8px' },
  phaseConnector:{ width: '12px', height: '2px', background: 'rgba(255,255,255,0.06)', borderRadius: '1px', flexShrink: 0 },
  phaseDot:      { width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0 },
  phaseLabel:    { fontSize: '13px', fontWeight: '500', color: 'rgba(228,225,237,0.7)' },
  phaseQs:       {
    fontSize: '10px', color: 'rgba(228,225,237,0.25)',
    background: 'rgba(255,255,255,0.04)', padding: '1px 6px', borderRadius: '4px',
  },

  // Pills (roles + topics)
  pillWrap: { display: 'flex', flexWrap: 'wrap', gap: '10px' },
  pill: {
    padding: '0.55rem 1.1rem', borderRadius: '9999px',
    cursor: 'pointer', fontSize: '14px', fontWeight: '600',
    border: '1px solid', transition: 'all 0.15s',
  },
  pillSm: {
    padding: '0.45rem 0.9rem', borderRadius: '9999px',
    cursor: 'pointer', fontSize: '13px', fontWeight: '500',
    border: '1px solid', transition: 'all 0.15s',
  },
  pillActive: {
    background: '#2563eb', borderColor: '#2563eb',
    color: '#fff', boxShadow: '0 4px 14px rgba(37,99,235,0.3)',
  },
  pillInactive: {
    background: 'rgba(255,255,255,0.03)',
    borderColor: 'rgba(255,255,255,0.05)',
    color: 'rgba(228,225,237,0.35)',
  },

  // Resume upload
  uploadBox: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    gap: '10px', border: '2px dashed rgba(255,255,255,0.08)',
    borderRadius: '16px', padding: '1.5rem 2rem',
    cursor: 'pointer', transition: 'all 0.2s', textAlign: 'center',
  },
  uploadIcon: {
    width: '44px', height: '44px', borderRadius: '12px',
    background: 'rgba(255,255,255,0.04)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  uploadText:  {},
  uploadTitle: { fontSize: '16px', fontWeight: '600', color: '#e4e1ed', marginBottom: '4px' },
  uploadSub:   { fontSize: '11px', fontWeight: '700', letterSpacing: '0.2em', color: 'rgba(228,225,237,0.2)' },
  inlineError: { color: '#f87171', fontSize: '13px', marginTop: '8px' },

  resumePreview: {
    background: 'rgba(34,197,94,0.04)', border: '1px solid rgba(34,197,94,0.15)',
    borderRadius: '12px', padding: '1rem', marginTop: '12px',
  },
  resumeTitle:   { fontSize: '12px', color: '#22c55e', fontWeight: '600', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' },
  resumeMeta:    { display: 'flex', gap: '1.5rem', flexWrap: 'wrap', marginBottom: '8px' },
  resumeMetaItem:{ display: 'flex', gap: '6px', alignItems: 'center', fontSize: '13px' },
  resumeMetaKey: { color: '#444' },
  resumeMetaVal: { color: '#ccc', fontWeight: '500' },
  techTags:      { display: 'flex', flexWrap: 'wrap', gap: '4px' },
  techTag:       { background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)', color: '#a5b4fc', fontSize: '11px', padding: '2px 8px', borderRadius: '4px' },

  // Difficulty
  diffGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' },
  diffCard: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    gap: '14px', padding: '1.5rem 0.75rem',
    borderRadius: '14px', border: '1px solid', cursor: 'pointer', transition: 'all 0.2s',
  },
  diffLabel:  { fontSize: '11px', fontWeight: '800', letterSpacing: '0.15em', transition: 'color 0.2s' },
  diffBarBg:  { width: '64px', height: '6px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px', overflow: 'hidden' },
  diffBarFill:{ height: '100%', borderRadius: '3px', transition: 'all 0.3s' },

  errorBox: {
    background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
    color: '#f87171', padding: '0.875rem 1rem', borderRadius: '10px',
    fontSize: '13px', marginTop: '1.5rem', lineHeight: '1.5',
  },

  startBtn: {
    width: '100%', padding: '1.25rem 2rem',
    background: '#2563eb', color: '#fff',
    border: 'none', borderRadius: '9999px',
    fontSize: '18px', fontWeight: '700', letterSpacing: '0.01em',
    transition: 'opacity 0.2s, transform 0.1s',
    fontFamily: "'Geist', sans-serif",
  },

  durationHint: {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
    marginTop: '1.5rem', opacity: 0.3,
    fontSize: '11px', fontWeight: '700', letterSpacing: '0.2em', textTransform: 'uppercase',
  },

  spinner: {
    width: '16px', height: '16px',
    border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid #fff',
    borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite',
  },
}