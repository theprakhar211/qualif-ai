import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { interviewAPI, resumeAPI } from '../services/api'

const ROLES = [
  'Software Engineer',
  'Frontend Developer',
  'Backend Developer',
  'Full Stack Developer',
  'Data Scientist',
  'Machine Learning Engineer',
  'DevOps Engineer',
  'Product Manager',
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

const DIFFICULTIES = ['easy', 'medium', 'hard']

export default function Setup() {
  const navigate = useNavigate()
  const user = JSON.parse(localStorage.getItem('user') || '{}')

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

  const toggleTopic = (topic) => {
    setTopics(prev =>
      prev.includes(topic) ? prev.filter(t => t !== topic) : [...prev, topic]
    )
  }

  const handleRoleChange = (newRole) => {
    setRole(newRole)
    setTopics([])
    setError('')
  }

  const handleResumeUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setResumeError('Only PDF files are supported.')
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      setResumeError('File too large. Maximum size is 5MB.')
      return
    }

    setResume(file)
    setResumeLoading(true)
    setResumeError('')
    setResumeParsed(null)

    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await resumeAPI.upload(formData)
      setResumeParsed(res.data.parsed)
    } catch (err) {
      const msg = err.response?.data?.detail || 'Failed to parse resume. Try again.'
      setResumeError(msg)
      setResume(null)
    } finally {
      setResumeLoading(false)
    }
  }

  const handleStart = async () => {
    if (!role)          { setError('Please select a job role to continue.');        return }
    if (!topics.length) { setError('Please select at least one topic to practice.'); return }

    setLoading(true)
    setError('')

    try {
      const res = await interviewAPI.start({ role, topics, difficulty })
      navigate(`/interview/${res.data.session_id}`)
    } catch (err) {
      const status = err.response?.status
      const detail = err.response?.data?.detail

      if (status === 401) {
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        navigate('/login')
        return
      }

      if (status === 503 || err.code === 'ERR_NETWORK') {
        setError('Cannot connect to server. Make sure the backend is running.')
      } else {
        setError(detail || 'Failed to start interview. Please try again.')
      }
      setLoading(false)
    }
  }

  const logout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    navigate('/login')
  }

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <img src="/logo.png" alt="Qualif-AI" style={{ height: '70px', objectFit: 'contain' }} />
        <div style={styles.headerRight}>
          <span style={styles.userName}>{user.name}</span>
          <button onClick={() => navigate('/dashboard')} style={styles.ghostBtn}>
            Dashboard
          </button>
          <button onClick={logout} style={styles.ghostBtn}>Logout</button>
        </div>
      </div>

      <div style={styles.content}>
        <h1 style={styles.title}>Set up your interview</h1>
        <p style={styles.sub}>Configure your mock interview session</p>

        {/* Role */}
        <div style={styles.section}>
          <label style={styles.sectionLabel}>Job role</label>
          <div style={styles.roleGrid}>
            {ROLES.map(r => (
              <button
                key={r}
                onClick={() => handleRoleChange(r)}
                style={{ ...styles.roleBtn, ...(role === r ? styles.roleBtnActive : {}) }}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        {/* Topics */}
        {role && (
          <div style={styles.section}>
            <label style={styles.sectionLabel}>
              Topics <span style={styles.hint}>(select all that apply)</span>
            </label>
            <div style={styles.topicGrid}>
              {availableTopics.map(t => (
                <button
                  key={t}
                  onClick={() => toggleTopic(t)}
                  style={{ ...styles.topicBtn, ...(topics.includes(t) ? styles.topicBtnActive : {}) }}
                >
                  {topics.includes(t) ? '✓ ' : ''}{t}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Resume */}
        <div style={styles.section}>
          <label style={styles.sectionLabel}>
            Resume <span style={styles.hint}>(optional — personalizes your questions)</span>
          </label>

          <label style={{
            ...styles.uploadBox,
            borderColor: resumeLoading ? '#6366f1' : resume ? '#22c55e' : '#333',
            opacity: resumeLoading ? 0.8 : 1,
          }}>
            <input
              type="file"
              accept=".pdf"
              onChange={handleResumeUpload}
              disabled={resumeLoading}
              style={{ display: 'none' }}
            />
            {resumeLoading ? (
              <span style={{ color: '#6366f1' }}>Parsing resume with AI...</span>
            ) : resume ? (
              <span style={{ color: '#22c55e' }}>✓ {resume.name}</span>
            ) : (
              <span style={{ color: '#555' }}>Click to upload PDF resume (max 5MB)</span>
            )}
          </label>

          {resumeError && (
            <div style={styles.inlineError}>{resumeError}</div>
          )}

          {resumeParsed && (
            <div style={styles.resumePreview}>
              <div style={styles.resumePreviewTitle}>Resume parsed successfully</div>
              {resumeParsed.target_role && (
                <div style={styles.resumeRow}>
                  <span style={styles.resumeLabel}>Role detected</span>
                  <span style={styles.resumeValue}>{resumeParsed.target_role}</span>
                </div>
              )}
              {resumeParsed.years_experience > 0 && (
                <div style={styles.resumeRow}>
                  <span style={styles.resumeLabel}>Experience</span>
                  <span style={styles.resumeValue}>{resumeParsed.years_experience} years</span>
                </div>
              )}
              {resumeParsed.technologies?.length > 0 && (
                <div style={styles.resumeRow}>
                  <span style={styles.resumeLabel}>Technologies</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                    {resumeParsed.technologies.slice(0, 8).map(t => (
                      <span key={t} style={styles.techTag}>{t}</span>
                    ))}
                  </div>
                </div>
              )}
              {resumeParsed.skills?.length > 0 && (
                <div style={styles.resumeRow}>
                  <span style={styles.resumeLabel}>Skills</span>
                  <span style={styles.resumeValue}>
                    {resumeParsed.skills.slice(0, 6).join(', ')}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Difficulty */}
        <div style={styles.section}>
          <label style={styles.sectionLabel}>Difficulty</label>
          <div style={styles.diffRow}>
            {DIFFICULTIES.map(d => (
              <button
                key={d}
                onClick={() => setDifficulty(d)}
                style={{ ...styles.diffBtn, ...(difficulty === d ? styles.diffBtnActive[d] : {}) }}
              >
                {d.charAt(0).toUpperCase() + d.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div style={styles.error}>
            {error}
          </div>
        )}

        <button
          onClick={handleStart}
          disabled={loading || !role || topics.length === 0}
          style={{
            ...styles.startBtn,
            opacity: (loading || !role || topics.length === 0) ? 0.5 : 1,
            cursor:  (loading || !role || topics.length === 0) ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? (
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
              <span style={styles.btnSpinner} /> Generating your first question...
            </span>
          ) : 'Start interview'}
        </button>

        {loading && (
          <p style={styles.loadingNote}>
            AI is generating a personalized question — this takes 2–4 seconds
          </p>
        )}
      </div>
    </div>
  )
}

const styles = {
  page:        { minHeight: '100vh', background: '#0f0f0f', color: '#fff' },
  header:      { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 2rem', borderBottom: '1px solid #1e1e1e' },
  logo:        { fontSize: '20px', fontWeight: '700' },
  ai:          { color: '#6366f1' },
  headerRight: { display: 'flex', alignItems: 'center', gap: '1rem' },
  userName:    { color: '#888', fontSize: '14px' },
  ghostBtn:    { background: 'transparent', border: '1px solid #2a2a2a', color: '#aaa', padding: '0.4rem 0.9rem', borderRadius: '8px', cursor: 'pointer', fontSize: '13px' },
  content:     { maxWidth: '700px', margin: '0 auto', padding: '3rem 1.5rem' },
  title:       { fontSize: '28px', fontWeight: '700', marginBottom: '0.5rem' },
  sub:         { color: '#888', marginBottom: '2.5rem' },
  section:     { marginBottom: '2rem' },
  sectionLabel:{ display: 'block', fontSize: '13px', color: '#aaa', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' },
  hint:        { color: '#555', fontWeight: '400', textTransform: 'none', letterSpacing: 0 },
  roleGrid:    { display: 'flex', flexWrap: 'wrap', gap: '0.5rem' },
  roleBtn:     { background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#ccc', padding: '0.6rem 1rem', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' },
  roleBtnActive:{ background: '#1e1b4b', border: '1px solid #6366f1', color: '#a5b4fc' },
  topicGrid:   { display: 'flex', flexWrap: 'wrap', gap: '0.5rem' },
  topicBtn:    { background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#ccc', padding: '0.5rem 0.9rem', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' },
  topicBtnActive:{ background: '#0f2a1a', border: '1px solid #22c55e', color: '#86efac' },
  uploadBox:   { display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px dashed #333', borderRadius: '8px', padding: '1.25rem', cursor: 'pointer', fontSize: '14px', transition: 'border-color 0.2s' },
  inlineError: { color: '#ff6b6b', fontSize: '13px', marginTop: '0.5rem' },
  resumePreview:     { background: '#141414', border: '1px solid #2a2a2a', borderRadius: '8px', padding: '1rem', marginTop: '0.75rem' },
  resumePreviewTitle:{ fontSize: '12px', color: '#22c55e', fontWeight: '500', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' },
  resumeRow:   { display: 'flex', alignItems: 'flex-start', gap: '1rem', marginBottom: '0.5rem', fontSize: '13px' },
  resumeLabel: { color: '#555', minWidth: '100px' },
  resumeValue: { color: '#ccc' },
  techTag:     { background: '#1e1b4b', border: '1px solid #6366f1', color: '#a5b4fc', fontSize: '11px', padding: '2px 8px', borderRadius: '4px' },
  diffRow:     { display: 'flex', gap: '0.75rem' },
  diffBtn:     { background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#ccc', padding: '0.6rem 1.5rem', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: '500' },
  diffBtnActive: {
    easy:   { background: '#0f2a1a', border: '1px solid #22c55e', color: '#86efac' },
    medium: { background: '#1a1a0f', border: '1px solid #eab308', color: '#fde047' },
    hard:   { background: '#2a0f0f', border: '1px solid #ef4444', color: '#fca5a5' },
  },
  error:       { background: '#2a1515', border: '1px solid #5a1a1a', color: '#ff6b6b', padding: '0.75rem 1rem', borderRadius: '8px', fontSize: '13px', marginBottom: '1rem', lineHeight: '1.5' },
  startBtn:    { background: '#6366f1', color: '#fff', border: 'none', borderRadius: '10px', padding: '1rem 2rem', fontSize: '16px', fontWeight: '600', width: '100%' },
  loadingNote: { textAlign: 'center', color: '#555', fontSize: '13px', marginTop: '1rem' },
  btnSpinner:  { width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid #fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' },
}
