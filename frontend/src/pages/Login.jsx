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
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Geist:wght@600;700;800;900&family=Inter:wght@400;500;600&display=swap');

        .login-input:focus {
          outline: none;
          border-color: rgba(37,99,235,0.5) !important;
          box-shadow: 0 0 0 3px rgba(37,99,235,0.12);
        }
        .login-btn-hover:hover {
          background: #1d4ed8 !important;
          box-shadow: 0 0 40px rgba(37,99,235,0.45) !important;
          transform: translateY(-1px);
        }
        .login-btn-hover:active { transform: scale(0.98); }
        .back-link:hover { color: #e2e8f0 !important; }

        /* Grid pattern on left panel */
        .login-left::before {
          content: '';
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(rgba(148,163,184,0.025) 1px, transparent 1px),
            linear-gradient(90deg, rgba(148,163,184,0.025) 1px, transparent 1px);
          background-size: 80px 80px;
          pointer-events: none;
        }

        /* Floating orbs */
        .login-orb-1 {
          position: absolute;
          width: 500px; height: 500px;
          border-radius: 50%;
          background: rgba(37,99,235,0.04);
          filter: blur(100px);
          top: -100px; left: -100px;
          animation: orbFloat1 12s ease-in-out infinite alternate;
          pointer-events: none;
        }
        .login-orb-2 {
          position: absolute;
          width: 500px; height: 500px;
          border-radius: 50%;
          background: rgba(37,99,235,0.03);
          filter: blur(100px);
          bottom: 5%; right: -150px;
          animation: orbFloat2 15s ease-in-out infinite alternate;
          pointer-events: none;
        }
        @keyframes orbFloat1 {
          0%   { transform: scale(1)   translate(0, 0);      opacity: 0.3; }
          100% { transform: scale(1.3) translate(50px,-40px); opacity: 0.6; }
        }
        @keyframes orbFloat2 {
          0%   { transform: scale(1)   translate(0, 0);       opacity: 0.3; }
          100% { transform: scale(1.2) translate(-40px,30px); opacity: 0.5; }
        }

        /* Mobile */
        @media (max-width: 768px) {
          .login-left  { min-height: 40vh !important; padding: 2rem 1.25rem !important; }
          .login-right { padding: 2rem 1.25rem !important; }
          .login-tagline { font-size: 32px !important; }
        }
      `}</style>

      {/* ── Left panel ── */}
      <div style={s.left} className="login-left">
        <div className="login-orb-1" />
        <div className="login-orb-2" />

        <div style={s.leftInner}>
          <img
            src="/logo.png"
            alt="Qualif-AI"
            style={{ height: '64px', objectFit: 'contain', marginBottom: '3.5rem', cursor: 'pointer' }}
            onClick={() => navigate('/')}
          />

          <h2 style={s.tagline} className="login-tagline">
            <span style={{ color: '#fff', display: 'block' }}>Practice interviews.</span>
            <span style={{ color: '#94A3B8' }}>Land the job.</span>
          </h2>

          <p style={s.taglineSub}>
            AI-powered mock interviews with real-time voice, adaptive questions, and detailed feedback.
          </p>

          <div style={s.bullets}>
            {[
              'AI-generated questions every session',
              'Voice-first interview experience',
              'Detailed score breakdown after each session',
            ].map(b => (
              <div key={b} style={s.bullet}>
                <span style={s.bulletDot} />
                <span style={s.bulletText}>{b}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right panel ── */}
      <div style={s.right} className="login-right">
        {/* Bottom glow */}
        <div style={s.bottomGlow} />

        <div style={s.card}>
          <h1 style={s.title}>Welcome back</h1>
          <p style={s.sub}>Sign in to continue your interview prep</p>

          <form onSubmit={handleSubmit} style={s.form}>
            <div style={s.field}>
              <label style={s.label}>EMAIL ADDRESS</label>
              <input
                style={s.input}
                className="login-input"
                type="email"
                name="email"
                placeholder="you@example.com"
                value={form.email}
                onChange={handleChange}
                required
              />
            </div>

            <div style={s.field}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={s.label}>PASSWORD</label>
              </div>
              <input
                style={s.input}
                className="login-input"
                type="password"
                name="password"
                placeholder="••••••••"
                value={form.password}
                onChange={handleChange}
                required
              />
            </div>

            {error && <div style={s.error}>{error}</div>}

            <button
              style={{ ...s.btn, opacity: loading ? 0.7 : 1 }}
              type="submit"
              disabled={loading}
              className="login-btn-hover"
            >
              {loading ? (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                  <span style={s.spinner} /> Signing in...
                </span>
              ) : 'Sign in to Dashboard'}
            </button>
          </form>

          <div style={s.footerGroup}>
            <p style={s.footer}>
              Don't have an account?{' '}
              <Link to="/register" style={s.link}>Create one free</Link>
            </p>
            <Link to="/" style={s.backLink} className="back-link">
              ← BACK TO HOME
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

const s = {
  page: {
    display: 'flex',
    minHeight: '100vh',
    width: '100%',
    background: '#030308',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    flexWrap: 'wrap',
  },

  // Left
  left: {
    position: 'relative',
    flex: '1 1 300px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#030308',
    backgroundImage: 'radial-gradient(circle at top left, rgba(37,99,235,0.08) 0%, transparent 60%)',
    padding: '2.5rem 2rem',
    borderRight: '1px solid rgba(255,255,255,0.05)',
    overflow: 'hidden',
  },
  leftInner: { maxWidth: '420px', width: '100%', position: 'relative', zIndex: 2 },
  tagline: {
    fontFamily: "'Geist', sans-serif",
    fontSize: '44px', fontWeight: '800',
    lineHeight: 1.1, letterSpacing: '-0.02em',
    marginBottom: '1.5rem',
  },
  taglineSub: {
    color: '#94A3B8', fontSize: '16px',
    lineHeight: '1.7', marginBottom: '2.5rem',
    maxWidth: '360px',
  },
  bullets: { display: 'flex', flexDirection: 'column', gap: '1.25rem' },
  bullet:  { display: 'flex', alignItems: 'center', gap: '1rem' },
  bulletDot: {
    width: '8px', height: '8px', borderRadius: '50%',
    background: '#2563eb', flexShrink: 0,
    boxShadow: '0 0 12px rgba(37,99,235,0.8)',
  },
  bulletText: { color: '#94A3B8', fontSize: '15px', fontWeight: '500' },

  // Right
  right: {
    position: 'relative',
    flex: '1 1 300px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#05050a',
    padding: '2.5rem 2rem',
    overflow: 'hidden',
  },
  bottomGlow: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: '384px',
    background: 'linear-gradient(to top, rgba(37,99,235,0.05), transparent)',
    pointerEvents: 'none',
  },
  card: {
    width: '100%', maxWidth: '480px',
    background: 'rgba(13,13,21,0.4)',
    backdropFilter: 'blur(24px)',
    border: '1px solid rgba(255,255,255,0.05)',
    borderRadius: '24px',
    padding: '3rem',
    boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
    position: 'relative', zIndex: 2,
  },
  title: {
    fontFamily: "'Geist', sans-serif",
    fontSize: '28px', fontWeight: '700',
    color: '#fff', marginBottom: '0.5rem',
    letterSpacing: '-0.01em',
  },
  sub: { color: '#64748B', fontSize: '15px', marginBottom: '2rem' },

  form: { display: 'flex', flexDirection: 'column', gap: '1.5rem' },
  field: { display: 'flex', flexDirection: 'column', gap: '0.5rem' },
  label: {
    fontSize: '11px', color: '#64748B',
    fontWeight: '700', letterSpacing: '0.1em',
    textTransform: 'uppercase',
  },
  input: {
    background: 'rgba(13,13,21,0.3)',
    border: '1px solid rgba(255,255,255,0.05)',
    borderRadius: '9999px',
    padding: '1rem 1.5rem',
    color: '#e4e1ed', fontSize: '15px',
    width: '100%',
    transition: 'border-color 0.2s, box-shadow 0.2s',
  },
  error: {
    background: 'rgba(239,68,68,0.08)',
    border: '1px solid rgba(239,68,68,0.25)',
    color: '#fca5a5',
    padding: '0.75rem 1rem',
    borderRadius: '12px',
    fontSize: '13px', lineHeight: '1.5',
  },
  btn: {
    background: '#2563eb', color: '#fff',
    border: 'none', borderRadius: '9999px',
    padding: '1.125rem',
    fontSize: '15px', fontWeight: '600',
    cursor: 'pointer', marginTop: '0.5rem',
    width: '100%',
    boxShadow: '0 10px 40px rgba(37,99,235,0.2)',
    transition: 'all 0.2s',
    fontFamily: "'Geist', sans-serif",
    letterSpacing: '0.01em',
  },
  spinner: {
    width: '14px', height: '14px',
    border: '2px solid rgba(255,255,255,0.3)',
    borderTop: '2px solid #fff',
    borderRadius: '50%', display: 'inline-block',
    animation: 'spin 0.8s linear infinite',
  },

  footerGroup: { textAlign: 'center', marginTop: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem' },
  footer: { fontSize: '14px', color: '#64748B' },
  link:   { color: '#2563eb', fontWeight: '600', textDecoration: 'none' },
  backLink: {
    display: 'inline-flex', alignItems: 'center', gap: '6px',
    color: 'rgba(148,163,184,0.5)', fontSize: '11px',
    fontWeight: '700', letterSpacing: '0.15em',
    textDecoration: 'none', transition: 'color 0.2s',
  },
}