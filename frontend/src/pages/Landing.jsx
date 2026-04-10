import { useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'

const FEATURES = [
  {
    icon: '🎙',
    title: 'Voice-first interviews',
    desc: 'Speak your answers naturally. Real-time transcription captures every word as you talk.'
  },
  {
    icon: '🤖',
    title: 'AI-generated questions',
    desc: 'Llama 3 generates fresh, role-specific questions every session. No two interviews are the same.'
  },
  {
    icon: '📄',
    title: 'Resume-aware prep',
    desc: 'Upload your CV and questions adapt to your background, skills, and past experience.'
  },
  {
    icon: '📈',
    title: 'Adaptive difficulty',
    desc: 'Nailing every answer? Questions get harder. Struggling? They ease up. Just like a real interview.'
  },
  {
    icon: '🧠',
    title: 'Deep AI evaluation',
    desc: 'Every answer scored on content, structure, and confidence. Concepts covered, concepts missed — all listed.'
  },
  {
    icon: '📊',
    title: 'Progress dashboard',
    desc: 'Track your score trend across sessions. See your weak areas and which topics need more work.'
  },
]

const STEPS = [
  {
    number: '01',
    title: 'Set up your interview',
    desc: 'Choose your role, pick topics to practice, set difficulty, and optionally upload your resume for personalized questions.'
  },
  {
    number: '02',
    title: 'Answer out loud',
    desc: 'The AI asks questions and reads them aloud. You speak your answers. Your transcript appears in real time.'
  },
  {
    number: '03',
    title: 'Get your results',
    desc: 'After all questions, AI evaluates every answer — scoring content, identifying gaps, and correcting STT errors.'
  },
]

const ROLES = [
  'Software Engineer', 'Frontend Developer', 'Backend Developer',
  'Data Scientist', 'ML Engineer', 'DevOps Engineer',
  'Full Stack Developer', 'Product Manager'
]

export default function Landing() {
  const navigate = useNavigate()
  const isLoggedIn = !!localStorage.getItem('token')
  const [scrolled, setScrolled] = useState(false)
  const [roleIndex, setRoleIndex] = useState(0)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    const interval = setInterval(() => {
      setRoleIndex(prev => (prev + 1) % ROLES.length)
    }, 2000)
    return () => clearInterval(interval)
  }, [])

  const handleCTA = () => {
    if (isLoggedIn) navigate('/app')
    else navigate('/register')
  }

  return (
    <div style={styles.page}>
      {/* Navbar */}
      <nav style={{
        ...styles.nav,
        background: scrolled ? 'rgba(10,10,10,0.95)' : 'transparent',
        borderBottom: scrolled ? '1px solid #1e1e1e' : '1px solid transparent',
      }}>
        <img src="/logo.png" alt="Qualif-AI" style={{ height: '44px', objectFit: 'contain' }} />
        <div style={styles.navRight}>
          {isLoggedIn ? (
            <>
              <button onClick={() => navigate('/app')} style={styles.navGhost}>Dashboard</button>
              <button onClick={() => navigate('/app')} style={styles.navPrimary}>Go to app</button>
            </>
          ) : (
            <>
              <button onClick={() => navigate('/login')} style={styles.navGhost}>Sign in</button>
              <button onClick={() => navigate('/register')} style={styles.navPrimary}>Try free</button>
            </>
          )}
        </div>
      </nav>

      {/* Hero */}
      <section style={styles.hero}>
        <div style={styles.heroBadge}>100% free · No credit card · Powered by Llama 3</div>
        <h1 style={styles.heroTitle}>
          Practice interviews<br />
          with an AI that<br />
          <span style={styles.heroAccent}>actually listens</span>
        </h1>
        <p style={styles.heroSub}>
          Qualif-AI conducts full mock interviews by voice — asking dynamic follow-up questions,
          evaluating your answers with AI, and telling you exactly what you missed.
        </p>

        {/* Rotating role pill */}
        <div style={styles.rolePill}>
          Interviewing for:{' '}
          <span style={styles.rolePillRole} key={roleIndex}>
            {ROLES[roleIndex]}
          </span>
        </div>

        <div style={styles.heroButtons}>
          <button onClick={handleCTA} style={styles.heroCTA}>
            Start practicing free →
          </button>
          <button
            onClick={() => document.getElementById('how').scrollIntoView({ behavior: 'smooth' })}
            style={styles.heroSecondary}
          >
            See how it works
          </button>
        </div>

        <p style={styles.heroNote}>
          No signup required to explore · Takes 2 minutes to set up
        </p>
      </section>

      {/* Stats bar */}
      <div style={styles.statsBar}>
        {[
          { value: '8', label: 'Questions per session' },
          { value: '8', label: 'Job roles supported' },
          { value: '< 2s', label: 'Question generation' },
          { value: '100%', label: 'Free forever' },
        ].map(s => (
          <div key={s.label} style={styles.statItem}>
            <div style={styles.statValue}>{s.value}</div>
            <div style={styles.statLabel}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* How it works */}
      <section id="how" style={styles.section}>
        <div style={styles.sectionInner}>
          <div style={styles.sectionTag}>How it works</div>
          <h2 style={styles.sectionTitle}>Three steps to a better interview</h2>
          <div style={styles.stepsGrid}>
            {STEPS.map((step, i) => (
              <div key={i} style={styles.stepCard}>
                <div style={styles.stepNumber}>{step.number}</div>
                <h3 style={styles.stepTitle}>{step.title}</h3>
                <p style={styles.stepDesc}>{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section style={{ ...styles.section, background: '#080808' }}>
        <div style={styles.sectionInner}>
          <div style={styles.sectionTag}>Features</div>
          <h2 style={styles.sectionTitle}>Everything you need to prep properly</h2>
          <div style={styles.featuresGrid}>
            {FEATURES.map((f, i) => (
              <div key={i} style={styles.featureCard}>
                <div style={styles.featureIcon}>{f.icon}</div>
                <h3 style={styles.featureTitle}>{f.title}</h3>
                <p style={styles.featureDesc}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Tech stack */}
      <section style={styles.section}>
        <div style={styles.sectionInner}>
          <div style={styles.sectionTag}>Built with</div>
          <h2 style={styles.sectionTitle}>Modern, production-grade stack</h2>
          <div style={styles.techGrid}>
            {[
              { name: 'React', color: '#61dafb', desc: 'Frontend' },
              { name: 'FastAPI', color: '#009688', desc: 'Backend' },
              { name: 'MongoDB', color: '#4db33d', desc: 'Database' },
              { name: 'Groq', color: '#f55036', desc: 'LLM API' },
              { name: 'Llama 3', color: '#7c3aed', desc: 'AI Model' },
              { name: 'Vercel', color: '#ffffff', desc: 'Hosting' },
            ].map(t => (
              <div key={t.name} style={styles.techCard}>
                <div style={{ ...styles.techDot, background: t.color }} />
                <div style={styles.techName}>{t.name}</div>
                <div style={styles.techDesc}>{t.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Roles section */}
      <section style={{ ...styles.section, background: '#080808' }}>
        <div style={styles.sectionInner}>
          <div style={styles.sectionTag}>Roles</div>
          <h2 style={styles.sectionTitle}>Prep for the role you want</h2>
          <div style={styles.rolesGrid}>
            {ROLES.map(r => (
              <button
                key={r}
                onClick={handleCTA}
                style={styles.roleChip}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* CTA section */}
      <section style={styles.ctaSection}>
        <div style={styles.sectionInner}>
          <h2 style={styles.ctaTitle}>
            Your next interview<br />starts here
          </h2>
          <p style={styles.ctaSub}>
            Free to use. No account required to explore.
            AI-powered feedback in under 10 minutes.
          </p>
          <button onClick={handleCTA} style={styles.ctaButton}>
            Start your mock interview →
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer style={styles.footer}>
        <div style={styles.footerInner}>
          <img src="/logo.png" alt="Qualif-AI" style={{ height: '36px', objectFit: 'contain' }} />
          <div style={styles.footerLinks}>
            <span style={styles.footerText}>Built by Prakhar Sharma</span>
            <span style={styles.footerDivider}>·</span>
            <a
              href="https://github.com/yourusername/qualif-ai"
              target="_blank"
              rel="noreferrer"
              style={styles.footerLink}
            >
              GitHub
            </a>
            <span style={styles.footerDivider}>·</span>
            <button onClick={() => navigate('/login')} style={styles.footerBtn}>Sign in</button>
          </div>
          <div style={styles.footerCopy}>
            © 2026 Prakhar Sharma · All Rights Reserved
          </div>
        </div>
      </footer>
    </div>
  )
}

const styles = {
  page: {
    background: '#0a0a0a',
    color: '#fff',
    minHeight: '100vh',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  nav: {
    position: 'fixed',
    top: 0, left: 0, right: 0,
    zIndex: 100,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '1rem 2rem',
    transition: 'background 0.3s, border-color 0.3s',
  },
  navRight:    { display: 'flex', alignItems: 'center', gap: '0.75rem' },
  navGhost:    { background: 'transparent', border: '1px solid #2a2a2a', color: '#aaa', padding: '0.45rem 1rem', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' },
  navPrimary:  { background: '#6366f1', border: 'none', color: '#fff', padding: '0.45rem 1.1rem', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: '500' },

  hero: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    padding: '8rem 1.5rem 4rem',
    maxWidth: '860px',
    margin: '0 auto',
  },
  heroBadge: {
    background: '#1a1a2e',
    border: '1px solid #6366f1',
    color: '#a5b4fc',
    padding: '0.35rem 1rem',
    borderRadius: '20px',
    fontSize: '13px',
    marginBottom: '2rem',
  },
  heroTitle: {
    fontSize: 'clamp(42px, 7vw, 80px)',
    fontWeight: '700',
    lineHeight: '1.1',
    marginBottom: '1.5rem',
    letterSpacing: '-0.02em',
  },
  heroAccent: {
    background: 'linear-gradient(135deg, #6366f1, #a855f7)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  },
  heroSub: {
    fontSize: '18px',
    color: '#888',
    lineHeight: '1.7',
    maxWidth: '580px',
    marginBottom: '2rem',
  },
  rolePill: {
    background: '#111',
    border: '1px solid #2a2a2a',
    borderRadius: '20px',
    padding: '0.5rem 1.25rem',
    fontSize: '14px',
    color: '#666',
    marginBottom: '2rem',
  },
  rolePillRole: {
    color: '#6366f1',
    fontWeight: '600',
    transition: 'opacity 0.3s',
  },
  heroButtons: {
    display: 'flex',
    gap: '1rem',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginBottom: '1.5rem',
  },
  heroCTA: {
    background: '#6366f1',
    color: '#fff',
    border: 'none',
    borderRadius: '10px',
    padding: '0.9rem 2rem',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  heroSecondary: {
    background: 'transparent',
    color: '#888',
    border: '1px solid #2a2a2a',
    borderRadius: '10px',
    padding: '0.9rem 2rem',
    fontSize: '16px',
    cursor: 'pointer',
  },
  heroNote: { color: '#444', fontSize: '13px' },

  statsBar: {
    display: 'flex',
    justifyContent: 'center',
    gap: '0',
    borderTop: '1px solid #1a1a1a',
    borderBottom: '1px solid #1a1a1a',
    background: '#0d0d0d',
    flexWrap: 'wrap',
  },
  statItem: {
    padding: '1.5rem 3rem',
    textAlign: 'center',
    borderRight: '1px solid #1a1a1a',
  },
  statValue: { fontSize: '28px', fontWeight: '700', color: '#fff', marginBottom: '4px' },
  statLabel: { fontSize: '13px', color: '#555' },

  section: { padding: '6rem 1.5rem', background: '#0a0a0a' },
  sectionInner: { maxWidth: '900px', margin: '0 auto' },
  sectionTag: {
    display: 'inline-block',
    background: '#1a1a2e',
    border: '1px solid #6366f1',
    color: '#a5b4fc',
    padding: '0.25rem 0.875rem',
    borderRadius: '20px',
    fontSize: '12px',
    fontWeight: '500',
    marginBottom: '1rem',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  sectionTitle: {
    fontSize: 'clamp(28px, 4vw, 42px)',
    fontWeight: '700',
    marginBottom: '3rem',
    lineHeight: '1.2',
  },

  stepsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem' },
  stepCard: {
    background: '#111',
    border: '1px solid #1e1e1e',
    borderRadius: '12px',
    padding: '2rem',
  },
  stepNumber: { fontSize: '36px', fontWeight: '700', color: '#6366f1', marginBottom: '1rem', opacity: 0.8 },
  stepTitle:  { fontSize: '18px', fontWeight: '600', marginBottom: '0.75rem' },
  stepDesc:   { fontSize: '14px', color: '#666', lineHeight: '1.6' },

  featuresGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' },
  featureCard: {
    background: '#111',
    border: '1px solid #1e1e1e',
    borderRadius: '12px',
    padding: '1.75rem',
    transition: 'border-color 0.2s',
  },
  featureIcon:  { fontSize: '28px', marginBottom: '1rem' },
  featureTitle: { fontSize: '16px', fontWeight: '600', marginBottom: '0.5rem' },
  featureDesc:  { fontSize: '14px', color: '#666', lineHeight: '1.6' },

  techGrid: { display: 'flex', flexWrap: 'wrap', gap: '1rem' },
  techCard: {
    background: '#111',
    border: '1px solid #1e1e1e',
    borderRadius: '10px',
    padding: '1rem 1.5rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  },
  techDot:  { width: '10px', height: '10px', borderRadius: '50%', flexShrink: 0 },
  techName: { fontSize: '15px', fontWeight: '600' },
  techDesc: { fontSize: '12px', color: '#555', marginLeft: '0.25rem' },

  rolesGrid: { display: 'flex', flexWrap: 'wrap', gap: '0.75rem' },
  roleChip: {
    background: '#111',
    border: '1px solid #2a2a2a',
    color: '#ccc',
    padding: '0.6rem 1.25rem',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    transition: 'border-color 0.2s, color 0.2s',
  },

  ctaSection: {
    padding: '8rem 1.5rem',
    textAlign: 'center',
    background: '#0a0a0a',
    borderTop: '1px solid #1a1a1a',
  },
  ctaTitle: {
    fontSize: 'clamp(32px, 5vw, 56px)',
    fontWeight: '700',
    lineHeight: '1.15',
    marginBottom: '1.5rem',
  },
  ctaSub: {
    fontSize: '17px',
    color: '#666',
    marginBottom: '2.5rem',
    lineHeight: '1.6',
  },
  ctaButton: {
    background: '#6366f1',
    color: '#fff',
    border: 'none',
    borderRadius: '12px',
    padding: '1rem 2.5rem',
    fontSize: '17px',
    fontWeight: '600',
    cursor: 'pointer',
  },

  footer: {
    borderTop: '1px solid #1a1a1a',
    padding: '2.5rem 1.5rem',
    background: '#080808',
  },
  footerInner: {
    maxWidth: '900px',
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '1rem',
  },
  footerLinks: { display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' },
  footerText:    { color: '#555', fontSize: '14px' },
  footerDivider: { color: '#333' },
  footerLink:    { color: '#555', fontSize: '14px', textDecoration: 'none' },
  footerBtn:     { background: 'none', border: 'none', color: '#555', fontSize: '14px', cursor: 'pointer', padding: 0 },
  footerCopy:    { color: '#333', fontSize: '12px' },
}
