import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { authAPI } from '../services/api'

export default function Login() {
  const navigate = useNavigate()
  const [form,    setForm]    = useState({ email: '', password: '' })
  const [error,   setError]   = useState('')
  const [loading, setLoading] = useState(false)

  const handleChange = e => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
    setError('')
  }

  const handleSubmit = async e => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await authAPI.login(form)
      localStorage.setItem('token', res.data.token)
      localStorage.setItem('user',  JSON.stringify(res.data.user))
      navigate('/app')
    } catch (err) {
      if (!err.response || err.code === 'ECONNABORTED') {
        setError('Server is waking up — this can take 30 seconds on first visit. Please try again.')
      } else {
        setError(err.response?.data?.detail || 'Login failed. Try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={s.page}>
      <div style={s.left}>
        <div style={s.leftInner}>
          <img src="/logo.png" alt="Qualif-AI" style={{ height: '56px', objectFit: 'contain', marginBottom: '2rem', cursor: 'pointer' }} onClick={() => navigate('/')}/>
          <h2 style={s.tagline}>Practice interviews.<br />Land the job.</h2>
          <p style={s.taglineSub}>AI-powered mock interviews with real-time voice, adaptive questions, and detailed feedback.</p>
          <div style={s.bullets}>
            {['AI-generated questions every session', 'Voice-first interview experience', 'Detailed score breakdown after each session'].map(b => (
              <div key={b} style={s.bullet}>
                <span style={s.bulletDot} />
                <span style={s.bulletText}>{b}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={s.right}>
        <div style={s.card} className="scale-in">
          <h1 style={s.title}>Welcome back</h1>
          <p style={s.sub}>Sign in to continue your interview prep</p>

          <form onSubmit={handleSubmit} style={s.form}>
            <div style={s.field}>
              <label style={s.label}>Email</label>
              <input
                style={s.input}
                type="email"
                name="email"
                placeholder="you@example.com"
                value={form.email}
                onChange={handleChange}
                required
              />
            </div>

            <div style={s.field}>
              <label style={s.label}>Password</label>
              <input
                style={s.input}
                type="password"
                name="password"
                placeholder="••••••••"
                value={form.password}
                onChange={handleChange}
                required
              />
            </div>

            {error && <div style={s.error}>{error}</div>}

            <button style={{ ...s.btn, opacity: loading ? 0.7 : 1 }} type="submit" disabled={loading} className="btn-press">
              {loading ? (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                  <span style={s.spinner} /> Signing in...
                </span>
              ) : 'Sign in'}
            </button>
          </form>

          <p style={s.footer}>
            Don't have an account?{' '}
            <Link to="/register" style={s.link}>Create one free</Link>
          </p>
          <p style={s.footer}>
            <Link to="/" style={{ ...s.link, color: '#555' }}>← Back to home</Link>
          </p>
        </div>
      </div>
    </div>
  )
}

const s = {
  page: { display: 'flex', minHeight: '100vh', background: '#0a0a0a' },
  left: {
    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'linear-gradient(135deg, #0f0f1a 0%, #1a0f2e 100%)',
    padding: '3rem', borderRight: '1px solid #1e1e1e',
  },
  leftInner: { maxWidth: '380px' },
  tagline: { fontSize: '32px', fontWeight: '700', lineHeight: '1.2', marginBottom: '1rem', color: '#fff' },
  taglineSub: { color: '#888', fontSize: '15px', lineHeight: '1.7', marginBottom: '2rem' },
  bullets: { display: 'flex', flexDirection: 'column', gap: '0.75rem' },
  bullet: { display: 'flex', alignItems: 'center', gap: '0.75rem' },
  bulletDot: { width: '6px', height: '6px', borderRadius: '50%', background: '#6366f1', flexShrink: 0 },
  bulletText: { color: '#aaa', fontSize: '14px' },
  right: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' },
  card: { width: '100%', maxWidth: '400px' },
  title: { fontSize: '26px', fontWeight: '700', marginBottom: '0.5rem', color: '#6366f1' },
  sub: { color: '#666', fontSize: '14px', marginBottom: '2rem' },
  form: { display: 'flex', flexDirection: 'column', gap: '1.25rem' },
  field: { display: 'flex', flexDirection: 'column', gap: '0.5rem' },
  label: { fontSize: '13px', color: '#aaa', fontWeight: '500' },
  input: {
    background: '#111', border: '1px solid #2a2a2a', borderRadius: '8px',
    padding: '0.75rem 1rem', color: '#fff', fontSize: '15px', outline: 'none',
    transition: 'border-color 0.2s',
  },
  error: {
    background: '#2a1515', border: '1px solid #5a1a1a', color: '#ff6b6b',
    padding: '0.75rem 1rem', borderRadius: '8px', fontSize: '13px', lineHeight: '1.5',
  },
  btn: {
    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    color: '#fff', border: 'none', borderRadius: '8px',
    padding: '0.875rem', fontSize: '15px', fontWeight: '600',
    cursor: 'pointer', marginTop: '0.5rem', transition: 'transform 0.1s',
  },
  spinner: {
    width: '14px', height: '14px',
    border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid #fff',
    borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite',
  },
  footer: { textAlign: 'center', marginTop: '1.25rem', fontSize: '14px', color: '#666' },
  link: { color: '#6366f1', fontWeight: '500' },
}
