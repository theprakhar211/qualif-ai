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
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Geist:wght@600;700;800;900&family=Inter:wght@400;500;600&display=swap');

        /* ── Fixed background layers ── */
        .landing-bg-grid {
          position: fixed; inset: 0; z-index: 0; pointer-events: none;
          background-image:
            linear-gradient(to right,  rgba(255,255,255,0.025) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255,255,255,0.025) 1px, transparent 1px);
          background-size: 40px 40px;
        }
        .landing-orb-1 {
          position: fixed; z-index: 0; pointer-events: none;
          top: -10%; left: -10%; width: 50%; height: 50%;
          background: radial-gradient(circle at center, rgba(37,99,235,0.12) 0%, transparent 70%);
          animation: orbDrift1 10s ease-in-out infinite;
        }
        .landing-orb-2 {
          position: fixed; z-index: 0; pointer-events: none;
          bottom: -10%; right: -10%; width: 50%; height: 50%;
          background: radial-gradient(circle at center, rgba(37,99,235,0.08) 0%, transparent 70%);
          animation: orbDrift2 10s ease-in-out infinite;
          animation-delay: -5s;
        }
        @keyframes orbDrift1 {
          0%,100% { transform: translate(0,0); }
          50%      { transform: translate(10px,-20px); }
        }
        @keyframes orbDrift2 {
          0%,100% { transform: translate(0,0); }
          50%      { transform: translate(-10px,20px); }
        }

        /* ── Hover effects ── */
        .feature-card-hover:hover {
          border-color: rgba(37,99,235,0.3) !important;
          box-shadow: 0 0 30px rgba(37,99,235,0.08) !important;
          transform: translateY(-2px);
        }
        .role-chip-hover:hover {
          border-color: rgba(37,99,235,0.4) !important;
          color: #93c5fd !important;
        }
        .section-sep {
          width: 100%;
          height: 1px;
          background: linear-gradient(to right, transparent, rgba(37,99,235,0.25) 30%, rgba(255,255,255,0.06) 50%, rgba(37,99,235,0.25) 70%, transparent);
          position: relative; z-index: 1;
        }
        .section-tinted {
          background: rgba(255,255,255,0.015) !important;
        }
      `}</style>

      {/* Background layers */}
      <div className="landing-bg-grid" />
      <div className="landing-orb-1" />
      <div className="landing-orb-2" />
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
          <button onClick={handleCTA} style={styles.heroCTA} className="hero-cta-hover">
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
      <div className="section-sep" />
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
      <div className="section-sep" />
      <section style={{ ...styles.section }} className="section-tinted">
        <div style={styles.sectionInner}>
          <div style={styles.sectionTag}>Features</div>
          <h2 style={styles.sectionTitle}>Everything you need to prep properly</h2>
          <div style={styles.featuresGrid}>
            {FEATURES.map((f, i) => (
              <div key={i} style={styles.featureCard} className="feature-card-hover">
                <div style={styles.featureIcon}>{f.icon}</div>
                <h3 style={styles.featureTitle}>{f.title}</h3>
                <p style={styles.featureDesc}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Tech stack */}
      <div className="section-sep" />
      <section style={styles.section}>
        <div style={styles.sectionInner}>
          <div style={styles.sectionTag}>Built with</div>
          <h2 style={styles.sectionTitle}>Modern, production-grade stack</h2>
          <div style={styles.techGrid}>
            {[
              { name: 'React',    color: '#61dafb', desc: 'Frontend',  icon: 'https://cdn.simpleicons.org/react/61dafb' },
              { name: 'FastAPI',  color: '#009688', desc: 'Backend',   icon: 'https://cdn.simpleicons.org/fastapi/009688' },
              { name: 'MongoDB',  color: '#4db33d', desc: 'Database',  icon: 'https://cdn.simpleicons.org/mongodb/4db33d' },
              { name: 'Groq',     color: '#f55036', desc: 'LLM API',   emoji: '⚡' },
              { name: 'Llama 3',  color: '#7c3aed', desc: 'AI Model',  emoji: '🦙' },
              { name: 'Vercel',   color: '#ffffff', desc: 'Hosting',   icon: 'https://cdn.simpleicons.org/vercel/ffffff' },
            ].map(t => (
              <div key={t.name} style={styles.techCard}>
                {t.emoji
                  ? <span style={{ fontSize: '20px', flexShrink: 0 }}>{t.emoji}</span>
                  : <img src={t.icon} alt={t.name} style={{ width: '20px', height: '20px', objectFit: 'contain', flexShrink: 0 }} onError={e => { e.target.style.display = 'none' }} />
                }
                <div style={styles.techName}>{t.name}</div>
                <div style={styles.techDesc}>{t.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Roles section */}
      <div className="section-sep" />
      <section style={{ ...styles.section }} className="section-tinted">
        <div style={styles.sectionInner}>
          <div style={styles.sectionTag}>Roles</div>
          <h2 style={styles.sectionTitle}>Prep for the role you want</h2>
          <div style={styles.rolesGrid}>
            {ROLES.map(r => (
              <button
                key={r}
                onClick={() => navigate('/app', { state: { preselectedRole: r } })}
                style={styles.roleChip}
                className="role-chip-hover"
              >
                {r}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* CTA section */}
      <div className="section-sep" />
      <section style={styles.ctaSection}>
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: '600px', height: '600px', background: 'rgba(37,99,235,0.08)', filter: 'blur(120px)', borderRadius: '50%', pointerEvents: 'none' }} />
        <div style={styles.sectionInner}>
          <h2 style={styles.ctaTitle}>
            Your next interview<br />starts here
          </h2>
          <p style={styles.ctaSub}>
            Free to use. No account required to explore.
            AI-powered feedback in under 10 minutes.
          </p>
          <button onClick={handleCTA} style={styles.ctaButton} className="cta-btn-hover">
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
              href="https://github.com/theprakhar211/qualif-ai"
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
    background: '#030308',
    color: '#e4e1ed',
    minHeight: '100vh',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    position: 'relative',
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
    backdropFilter: 'blur(16px)',
  },
  navRight:   { display: 'flex', alignItems: 'center', gap: '0.75rem' },
  navGhost:   { background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: '#94A3B8', padding: '0.45rem 1rem', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', transition: 'all 0.15s' },
  navPrimary: { background: '#2563eb', border: 'none', color: '#fff', padding: '0.45rem 1.25rem', borderRadius: '9999px', cursor: 'pointer', fontSize: '14px', fontWeight: '600', boxShadow: '0 4px 16px rgba(37,99,235,0.3)', transition: 'all 0.15s' },

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
    position: 'relative', zIndex: 1,
  },
  heroBadge: {
    background: 'rgba(37,99,235,0.1)',
    border: '1px solid rgba(37,99,235,0.25)',
    color: '#93c5fd',
    padding: '0.35rem 1rem',
    borderRadius: '9999px',
    fontSize: '13px',
    marginBottom: '2rem',
    backdropFilter: 'blur(8px)',
    fontWeight: '500',
  },
  heroTitle: {
    fontFamily: "'Geist', sans-serif",
    fontSize: 'clamp(42px, 7vw, 80px)',
    fontWeight: '800',
    lineHeight: '1.1',
    marginBottom: '1.5rem',
    letterSpacing: '-0.03em',
    color: '#fff',
  },
  heroAccent: {
    color: '#2563eb',
    textShadow: '0 0 30px rgba(37,99,235,0.5)',
  },
  heroSub: {
    fontSize: '18px',
    color: '#94A3B8',
    lineHeight: '1.7',
    maxWidth: '580px',
    marginBottom: '2rem',
  },
  rolePill: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '9999px',
    padding: '0.5rem 1.25rem',
    fontSize: '14px',
    color: '#64748B',
    marginBottom: '2rem',
    backdropFilter: 'blur(8px)',
    display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
  },
  rolePillRole: {
    color: '#2563eb',
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
    background: '#2563eb',
    color: '#fff',
    border: 'none',
    borderRadius: '9999px',
    padding: '0.9rem 2rem',
    fontSize: '16px',
    fontWeight: '700',
    cursor: 'pointer',
    boxShadow: '0 10px 30px rgba(37,99,235,0.25)',
    transition: 'all 0.2s',
    fontFamily: "'Geist', sans-serif",
  },
  heroSecondary: {
    background: 'transparent',
    color: '#94A3B8',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '9999px',
    padding: '0.9rem 2rem',
    fontSize: '16px',
    cursor: 'pointer',
    backdropFilter: 'blur(8px)',
    transition: 'all 0.15s',
  },
  heroNote: { color: '#374151', fontSize: '13px' },

  statsBar: {
    display: 'flex',
    justifyContent: 'center',
    gap: '0',
    borderTop: '1px solid rgba(255,255,255,0.05)',
    borderBottom: '1px solid rgba(255,255,255,0.05)',
    background: 'rgba(13,13,21,0.3)',
    backdropFilter: 'blur(12px)',
    flexWrap: 'wrap',
    position: 'relative', zIndex: 1,
  },
  statItem: {
    padding: '1.5rem 3rem',
    textAlign: 'center',
    borderRight: '1px solid rgba(255,255,255,0.05)',
  },
  statValue: { fontFamily: "'Geist', sans-serif", fontSize: '28px', fontWeight: '800', color: '#c0c1ff', marginBottom: '4px', letterSpacing: '-0.02em' },
  statLabel: { fontSize: '13px', color: '#64748B', fontWeight: '600', letterSpacing: '0.05em', textTransform: 'uppercase' },

  section: { padding: '6rem 1.5rem', background: 'transparent', position: 'relative', zIndex: 1 },
  sectionInner: { maxWidth: '900px', margin: '0 auto' },
  sectionTag: {
    display: 'inline-block',
    background: 'rgba(37,99,235,0.1)',
    border: '1px solid rgba(37,99,235,0.25)',
    color: '#93c5fd',
    padding: '0.25rem 0.875rem',
    borderRadius: '9999px',
    fontSize: '12px',
    fontWeight: '600',
    marginBottom: '1rem',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
  },
  sectionTitle: {
    fontFamily: "'Geist', sans-serif",
    fontSize: 'clamp(28px, 4vw, 42px)',
    fontWeight: '700',
    marginBottom: '3rem',
    lineHeight: '1.2',
    letterSpacing: '-0.02em',
    color: '#fff',
  },

  stepsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem' },
  stepCard: {
    background: 'rgba(13,13,21,0.6)',
    backdropFilter: 'blur(12px)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: '20px',
    padding: '2rem',
    transition: 'all 0.3s',
  },
  stepNumber: { fontFamily: "'Geist', sans-serif", fontSize: '36px', fontWeight: '800', color: '#2563eb', marginBottom: '1rem', textShadow: '0 0 20px rgba(37,99,235,0.4)', letterSpacing: '-0.04em' },
  stepTitle:  { fontFamily: "'Geist', sans-serif", fontSize: '18px', fontWeight: '700', marginBottom: '0.75rem', color: '#fff' },
  stepDesc:   { fontSize: '14px', color: '#94A3B8', lineHeight: '1.6' },

  featuresGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' },
  featureCard: {
    background: 'rgba(13,13,21,0.6)',
    backdropFilter: 'blur(12px)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: '20px',
    padding: '1.75rem',
    transition: 'all 0.3s',
  },
  featureIcon:  { fontSize: '28px', marginBottom: '1rem' },
  featureTitle: { fontFamily: "'Geist', sans-serif", fontSize: '16px', fontWeight: '700', marginBottom: '0.5rem', color: '#fff' },
  featureDesc:  { fontSize: '14px', color: '#94A3B8', lineHeight: '1.6' },

  techGrid: { display: 'flex', flexWrap: 'wrap', gap: '1rem' },
  techCard: {
    background: 'rgba(13,13,21,0.6)',
    backdropFilter: 'blur(12px)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: '12px',
    padding: '1rem 1.5rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  },
  techDot:  { width: '10px', height: '10px', borderRadius: '50%', flexShrink: 0 },
  techName: { fontFamily: "'Geist', sans-serif", fontSize: '15px', fontWeight: '600', color: '#fff' },
  techDesc: { fontSize: '12px', color: '#64748B', marginLeft: '0.25rem' },

  rolesGrid: { display: 'flex', flexWrap: 'wrap', gap: '0.75rem' },
  roleChip: {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.07)',
    color: '#94A3B8',
    padding: '0.6rem 1.25rem',
    borderRadius: '9999px',
    cursor: 'pointer',
    fontSize: '14px',
    transition: 'all 0.2s',
    backdropFilter: 'blur(8px)',
  },

  ctaSection: {
    padding: '8rem 1.5rem',
    textAlign: 'center',
    borderTop: '1px solid rgba(255,255,255,0.05)',
    position: 'relative', zIndex: 1,
    overflow: 'hidden',
  },
  ctaTitle: {
    fontFamily: "'Geist', sans-serif",
    fontSize: 'clamp(32px, 5vw, 56px)',
    fontWeight: '800',
    lineHeight: '1.15',
    marginBottom: '1.5rem',
    letterSpacing: '-0.03em',
    color: '#fff',
  },
  ctaSub: {
    fontSize: '17px',
    color: '#94A3B8',
    marginBottom: '2.5rem',
    lineHeight: '1.6',
  },
  ctaButton: {
    background: '#2563eb',
    color: '#fff',
    border: 'none',
    borderRadius: '9999px',
    padding: '1rem 2.5rem',
    fontSize: '17px',
    fontWeight: '700',
    cursor: 'pointer',
    boxShadow: '0 0 40px rgba(37,99,235,0.3)',
    transition: 'all 0.2s',
    fontFamily: "'Geist', sans-serif",
  },

  footer: {
    borderTop: '1px solid rgba(255,255,255,0.05)',
    padding: '2.5rem 1.5rem',
    background: 'rgba(5,5,10,0.8)',
    backdropFilter: 'blur(12px)',
    position: 'relative', zIndex: 1,
  },
  footerInner: {
    maxWidth: '900px',
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '1rem',
  },
  footerLinks:   { display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' },
  footerText:    { color: '#374151', fontSize: '14px' },
  footerDivider: { color: '#1f2937' },
  footerLink:    { color: '#374151', fontSize: '14px', textDecoration: 'none' },
  footerBtn:     { background: 'none', border: 'none', color: '#374151', fontSize: '14px', cursor: 'pointer', padding: 0 },
  footerCopy:    { color: '#1f2937', fontSize: '12px' },
}