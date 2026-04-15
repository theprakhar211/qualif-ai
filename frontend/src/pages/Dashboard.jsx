import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { dashboardAPI } from '../services/api'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, BarChart, Bar, Cell
} from 'recharts'

function ScoreRing({ score, size = 80 }) {
  const [displayed, setDisplayed] = useState(0)
  const radius = 30
  const circumference = 2 * Math.PI * radius
  const color = score >= 70 ? '#22c55e' : score >= 40 ? '#eab308' : '#ef4444'

  useEffect(() => {
    let start = 0
    const step = score / 40
    const timer = setInterval(() => {
      start += step
      if (start >= score) { setDisplayed(score); clearInterval(timer) }
      else setDisplayed(Math.floor(start))
    }, 16)
    return () => clearInterval(timer)
  }, [score])

  const dashoffset = circumference - (displayed / 100) * circumference

  return (
    <svg width={size} height={size} viewBox="0 0 72 72">
      <circle cx="36" cy="36" r={radius} fill="none" stroke="#1e1e1e" strokeWidth="5" />
      <circle
        cx="36" cy="36" r={radius} fill="none"
        stroke={color} strokeWidth="5" strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={dashoffset}
        transform="rotate(-90 36 36)"
        style={{ transition: 'stroke-dashoffset 0.05s linear' }}
      />
      <text x="36" y="40" textAnchor="middle" fill={color} fontSize="14" fontWeight="700" fontFamily="sans-serif">
        {displayed}
      </text>
    </svg>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const user     = JSON.parse(localStorage.getItem('user') || '{}')

  const [sessions,      setSessions]      = useState([])
  const [stats,         setStats]         = useState(null)
  const [insights,      setInsights]      = useState(null)
  const [selected,      setSelected]      = useState(null)
  const [loading,       setLoading]       = useState(true)
  const [error,         setError]         = useState('')
  const [activeTab,     setActiveTab]     = useState('overview')
  const [detailLoading, setDetailLoading] = useState(false)

  useEffect(() => {
    const load = async () => {
      setLoading(true); setError('')
      try {
        const [sessRes, statRes, insRes] = await Promise.all([
          dashboardAPI.getSessions(),
          dashboardAPI.getStats(),
          dashboardAPI.getInsights(),
        ])
        setSessions(sessRes.data)
        setStats(statRes.data)
        setInsights(insRes.data)
      } catch (err) {
        if (err.response?.status === 401) { navigate('/login'); return }
        setError('Failed to load dashboard. Check your connection.')
      } finally { setLoading(false) }
    }
    load()
  }, [navigate])

  const loadDetail = async (id) => {
    setDetailLoading(true); setSelected(null); setActiveTab('detail')
    try {
      const res = await dashboardAPI.getSession(id)
      setSelected(res.data)
    } catch { setSelected({ error: 'Failed to load session.' }) }
    finally { setDetailLoading(false) }
  }

  const logout = () => { localStorage.clear(); navigate('/login') }
  const scoreColor = (s) => s >= 70 ? '#22c55e' : s >= 40 ? '#eab308' : '#ef4444'
  const diffColor  = (d) => d === 'easy' ? '#22c55e' : d === 'hard' ? '#ef4444' : '#eab308'

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null
    return (
      <div style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '8px', padding: '0.75rem 1rem', fontSize: '13px' }}>
        <p style={{ color: '#666', marginBottom: '4px' }}>{label}</p>
        <p style={{ color: '#22c55e', fontWeight: '600' }}>{payload[0].value}/100</p>
        {payload[0].payload?.role && <p style={{ color: '#444', fontSize: '12px' }}>{payload[0].payload.role}</p>}
      </div>
    )
  }

  if (loading) return (
    <div style={s.page}>
      <div style={s.nav}>
        <img src="/logo.png" alt="Qualif-AI" style={{ height: '40px', objectFit: 'contain' }} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', flexDirection: 'column', gap: '1rem' }}>
        <div style={s.spinner} />
        <p style={{ color: '#444', fontSize: '14px' }}>Loading your dashboard...</p>
      </div>
    </div>
  )

  if (error) return (
    <div style={s.page}>
      <div style={s.nav}>
        <img src="/logo.png" alt="Qualif-AI" style={{ height: '40px', objectFit: 'contain' }} />
        <button onClick={logout} style={s.navGhost}>Logout</button>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', flexDirection: 'column', gap: '1rem', textAlign: 'center' }}>
        <div style={{ fontSize: '32px' }}>⚠</div>
        <p style={{ color: '#666' }}>{error}</p>
        <button onClick={() => window.location.reload()} style={s.primaryBtn} className="btn-press">Retry</button>
      </div>
    </div>
  )

  return (
    <div style={s.page}>
      {/* Nav */}
      <nav style={s.nav}>
        <img src="/logo.png" alt="Qualif-AI" style={{ height: '40px', objectFit: 'contain' }} />
        <div style={s.navRight}>
          <span style={s.greeting}>Hey, {user.name?.split(' ')[0]} 👋</span>
          <button onClick={() => navigate('/app')} style={s.navPrimary} className="btn-press">
            + New interview
          </button>
          <button onClick={logout} style={s.navGhost} className="btn-press">Logout</button>
        </div>
      </nav>

      <div style={s.content}>
        {/* Stats row */}
        {stats && (
          <div style={s.statsRow} className="fade-in">
            {[
              { label: 'Total sessions',  value: stats.total_sessions,     icon: '🎯' },
              { label: 'Completed',       value: stats.completed_sessions,  icon: '✅' },
              { label: 'Answers given',   value: stats.total_answers,       icon: '💬' },
              { label: 'Average score',   value: `${stats.avg_score}`,      icon: '📊', suffix: '/100' },
              { label: 'Best score',      value: `${stats.best_score}`,     icon: '🏆', suffix: '/100' },
            ].map(st => (
              <div key={st.label} style={s.statCard}>
                <div style={s.statIcon}>{st.icon}</div>
                <div style={s.statValue}>
                  {st.value}
                  {st.suffix && <span style={s.statSuffix}>{st.suffix}</span>}
                </div>
                <div style={s.statLabel}>{st.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Tab bar */}
        <div style={s.tabBar}>
          {[
            { id: 'overview', label: 'Overview',  icon: '📈' },
            { id: 'history',  label: 'History',   icon: '🕐' },
            { id: 'detail',   label: 'Session',   icon: '🔍' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{ ...s.tab, ...(activeTab === tab.id ? s.tabActive : {}) }}
              className="btn-press"
            >
              <span style={{ fontSize: '14px' }}>{tab.icon}</span>
              {tab.label}
              {tab.id === 'detail' && selected && !selected.error && (
                <span style={{ color: '#444', fontSize: '11px', maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  — {selected.role}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Overview ── */}
        {activeTab === 'overview' && insights && (
          <div className="fade-in">
            {insights.score_trend?.length > 1 ? (
              <div style={s.chartCard}>
                <div style={s.chartHeader}>
                  <div>
                    <h3 style={s.chartTitle}>Score trend</h3>
                    <p style={s.chartSub}>{insights.total_evaluated} evaluated sessions</p>
                  </div>
                  <div style={s.trendBadge}>
                    {insights.score_trend.length > 1 && (() => {
                      const last  = insights.score_trend[insights.score_trend.length - 1]?.score || 0
                      const first = insights.score_trend[0]?.score || 0
                      const diff  = last - first
                      return (
                        <span style={{ color: diff >= 0 ? '#22c55e' : '#ef4444', fontWeight: '600', fontSize: '14px' }}>
                          {diff >= 0 ? '↑' : '↓'} {Math.abs(diff)} pts
                        </span>
                      )
                    })()}
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={insights.score_trend} margin={{ top: 10, right: 20, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#111" />
                    <XAxis dataKey="date" tick={{ fill: '#444', fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis domain={[0, 100]} tick={{ fill: '#444', fontSize: 12 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Line type="monotone" dataKey="score" stroke="url(#lineGradient)" strokeWidth={2.5} dot={{ fill: '#6366f1', r: 4, strokeWidth: 0 }} activeDot={{ r: 6, fill: '#a855f7' }} />
                    <defs>
                      <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#6366f1" />
                        <stop offset="100%" stopColor="#a855f7" />
                      </linearGradient>
                    </defs>
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div style={s.emptyChart}>
                <div style={{ fontSize: '32px', marginBottom: '0.75rem' }}>📈</div>
                <p style={s.muted}>Complete at least 2 interviews to see your score trend.</p>
                <button onClick={() => navigate('/app')} style={{ ...s.primaryBtn, marginTop: '1rem', fontSize: '13px', padding: '0.6rem 1.25rem' }} className="btn-press">
                  Start an interview
                </button>
              </div>
            )}

            <div style={s.twoCol}>
              {/* Weak areas */}
              <div style={s.chartCard}>
                <h3 style={s.chartTitle}>Weak areas</h3>
                <p style={s.chartSub}>Concepts you most frequently miss</p>
                {!insights.weak_areas?.length ? (
                  <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
                    <div style={{ fontSize: '24px', marginBottom: '0.5rem' }}>🎯</div>
                    <p style={s.muted}>Complete evaluated interviews to see weak areas</p>
                  </div>
                ) : insights.weak_areas.map((w, i) => (
                  <div key={w.concept} style={s.weakRow}>
                    <div style={s.weakMeta}>
                      <span style={{ color: '#ccc', textTransform: 'capitalize', fontSize: '13px' }}>{w.concept}</span>
                      <span style={{ ...s.muted, fontSize: '12px' }}>{w.count}×</span>
                    </div>
                    <div style={s.weakBarBg}>
                      <div style={{
                        ...s.weakBarFill,
                        width: `${Math.min(100, (w.count / (insights.weak_areas[0]?.count || 1)) * 100)}%`,
                        background: i < 3
                          ? 'linear-gradient(90deg, #ef4444, #f97316)'
                          : i < 6
                          ? 'linear-gradient(90deg, #eab308, #f59e0b)'
                          : '#333',
                      }}/>
                    </div>
                  </div>
                ))}
              </div>

              {/* Topic scores */}
              <div style={s.chartCard}>
                <h3 style={s.chartTitle}>Performance by topic</h3>
                <p style={s.chartSub}>Average score per topic</p>
                {!insights.topic_scores?.length ? (
                  <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
                    <div style={{ fontSize: '24px', marginBottom: '0.5rem' }}>📊</div>
                    <p style={s.muted}>No topic data yet</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={Math.max(160, insights.topic_scores.length * 38)}>
                    <BarChart data={insights.topic_scores} layout="vertical" margin={{ top: 0, right: 20, left: 90, bottom: 0 }}>
                      <XAxis type="number" domain={[0, 100]} tick={{ fill: '#444', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="topic" tick={{ fill: '#666', fontSize: 12 }} axisLine={false} tickLine={false} width={90} />
                      <Tooltip formatter={(v) => [`${v}/100`, 'Avg score']} contentStyle={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '8px', fontSize: '13px' }} labelStyle={{ color: '#888' }} />
                      <Bar dataKey="avg_score" radius={[0, 6, 6, 0]}>
                        {insights.topic_scores.map(entry => (
                          <Cell key={entry.topic} fill={scoreColor(entry.avg_score)} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── History ── */}
        {activeTab === 'history' && (
          <div className="fade-in">
            <div style={s.historyHeader}>
              <h2 style={s.sectionTitle}>Interview history</h2>
              <span style={s.muted}>{sessions.length} sessions</span>
            </div>
            {sessions.length === 0 ? (
              <div style={s.emptyState}>
                <div style={{ fontSize: '48px', marginBottom: '1rem' }}>🎤</div>
                <h3 style={{ marginBottom: '0.5rem', fontSize: '18px' }}>No interviews yet</h3>
                <p style={{ ...s.muted, marginBottom: '1.5rem' }}>Start your first mock interview to see your results here.</p>
                <button onClick={() => navigate('/app')} style={s.primaryBtn} className="btn-press">
                  Start your first interview →
                </button>
              </div>
            ) : (
              <div style={s.sessionGrid}>
                {sessions.map(session => (
                  <div key={session.id} onClick={() => loadDetail(session.id)} style={s.sessionCard} className="btn-press">
                    <div style={s.sessionCardTop}>
                      <div style={s.sessionLeft}>
                        <ScoreRing score={session.avg_score} size={64} />
                      </div>
                      <div style={s.sessionRight}>
                        <div style={s.sessionRole}>{session.role}</div>
                        <div style={s.sessionMeta}>
                          <span style={{ color: diffColor(session.difficulty), fontSize: '12px', fontWeight: '500' }}>
                            {session.difficulty}
                          </span>
                          <span style={s.metaDot}>·</span>
                          <span style={s.muted}>{session.answer_count} answers</span>
                          <span style={s.metaDot}>·</span>
                          <span style={s.muted}>{new Date(session.created_at).toLocaleDateString()}</span>
                        </div>
                        {session.topics?.length > 0 && (
                          <div style={s.topicTags}>
                            {session.topics.slice(0, 3).map(t => (
                              <span key={t} style={s.topicTag}>{t}</span>
                            ))}
                            {session.topics.length > 3 && (
                              <span style={s.topicTag}>+{session.topics.length - 3}</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <div style={s.sessionFooter}>
                      <span style={{ color: '#444', fontSize: '12px' }}>Click to view full breakdown →</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Detail ── */}
        {activeTab === 'detail' && (
          <div className="fade-in">
            {detailLoading && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '2rem 0' }}>
                <div style={{ ...s.spinner, width: '24px', height: '24px', borderWidth: '2px' }} />
                <span style={s.muted}>Loading session...</span>
              </div>
            )}

            {!detailLoading && !selected && (
              <div style={s.emptyState}>
                <div style={{ fontSize: '48px', marginBottom: '1rem' }}>🔍</div>
                <h3 style={{ marginBottom: '0.5rem', fontSize: '18px' }}>Select a session</h3>
                <p style={{ ...s.muted, marginBottom: '1.5rem' }}>Go to History and click a session to see the full AI breakdown.</p>
                <button onClick={() => setActiveTab('history')} style={s.primaryBtn} className="btn-press">
                  Go to history
                </button>
              </div>
            )}

            {!detailLoading && selected?.error && (
              <div style={{ background: '#2a1515', border: '1px solid #5a1a1a', color: '#ff6b6b', padding: '1rem', borderRadius: '10px' }}>
                {selected.error}
              </div>
            )}

            {!detailLoading && selected && !selected.error && (
              <>
                {/* Detail header */}
                <div style={s.detailHeader}>
                  <div style={s.detailLeft}>
                    <div style={s.detailRole}>{selected.role}</div>
                    <div style={s.detailMeta}>
                      <span style={{ color: diffColor(selected.difficulty), fontWeight: '500' }}>{selected.difficulty}</span>
                      <span style={s.metaDot}>·</span>
                      <span style={s.muted}>{new Date(selected.created_at).toLocaleString()}</span>
                      <span style={s.metaDot}>·</span>
                      <span style={s.muted}>{selected.answers?.length} questions</span>
                    </div>
                    {selected.topics?.length > 0 && (
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '0.75rem' }}>
                        {selected.topics.map(t => <span key={t} style={s.topicTag}>{t}</span>)}
                      </div>
                    )}
                  </div>
                  <div style={s.detailScoreWrap}>
                    <ScoreRing score={selected.avg_score} size={100} />
                    <div style={{ ...s.muted, fontSize: '12px', textAlign: 'center', marginTop: '4px' }}>overall</div>
                  </div>
                </div>

                {/* Answers */}
                <div style={s.answersList}>
                  {selected.answers?.map((a, i) => (
                    <div key={i} style={s.answerCard} className="fade-in">
                      <div style={s.answerHeader}>
                        <div style={s.answerHeaderLeft}>
                          <span style={s.answerQ}>Q{i + 1}</span>
                          <span style={{ fontSize: '12px', color: '#444', background: '#1a1a1a', padding: '2px 8px', borderRadius: '10px' }}>
                            {a.input_mode === 'text' ? '⌨ Typed' : '🎙 Voice'}
                          </span>
                        </div>
                        <span style={{ fontSize: '16px', fontWeight: '700', color: scoreColor(a.quick_score ?? 0) }}>
                          {a.quick_score != null ? `${a.quick_score}/100` : '—'}
                        </span>
                      </div>

                      <p style={s.answerQuestion}>{a.question_text}</p>

                      {a.reasoning && (
                        <div style={s.reasoningBox}>
                          <span style={{ color: '#6366f1', fontSize: '11px', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.05em' }}>AI Feedback</span>
                          <p style={{ color: '#aaa', fontSize: '13px', lineHeight: '1.6', marginTop: '4px', fontStyle: 'italic' }}>{a.reasoning}</p>
                        </div>
                      )}

                      {(a.keywords_found?.length > 0 || a.missing_concepts?.length > 0) && (
                        <div style={s.conceptsRow}>
                          {a.keywords_found?.length > 0 && (
                            <div style={s.conceptGroup}>
                              <span style={{ color: '#22c55e', fontSize: '11px', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Covered</span>
                              <div style={s.tagWrap}>
                                {a.keywords_found.map(k => <span key={k} style={s.tagGreen}>{k}</span>)}
                              </div>
                            </div>
                          )}
                          {a.missing_concepts?.length > 0 && (
                            <div style={s.conceptGroup}>
                              <span style={{ color: '#ef4444', fontSize: '11px', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Missed</span>
                              <div style={s.tagWrap}>
                                {a.missing_concepts.map(k => <span key={k} style={s.tagRed}>{k}</span>)}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      <p style={s.answerTranscript}>
                        {a.corrected_transcript || a.transcript}
                        {a.was_corrected && <span style={{ color: '#444', fontSize: '11px', marginLeft: '6px' }}>(STT corrected)</span>}
                      </p>

                      <div style={s.answerStats}>
                        {a.wpm > 0 && (
                          <span style={s.statPill}>{a.wpm} WPM</span>
                        )}
                        <span style={s.statPill}>{a.word_count} words</span>
                        {a.filler_words?.length > 0 && (
                          <span style={{ ...s.statPill, background: '#2a0f0f', color: '#fca5a5', borderColor: '#5a1a1a' }}>
                            Fillers: {a.filler_words.join(', ')}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
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
  navPrimary: { background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff', border: 'none', padding: '0.4rem 1rem', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '500' },
  content:  { maxWidth: '1000px', margin: '0 auto', padding: '2rem 1.5rem' },

  statsRow: { display: 'flex', gap: '1rem', marginBottom: '2rem', flexWrap: 'wrap' },
  statCard: {
    flex: 1, minWidth: '130px',
    background: 'linear-gradient(135deg, #111 0%, #0f0f1a 100%)',
    border: '1px solid #1e1e1e', borderRadius: '14px',
    padding: '1.25rem', textAlign: 'center',
  },
  statIcon:   { fontSize: '20px', marginBottom: '0.5rem' },
  statValue:  { fontSize: '28px', fontWeight: '700', color: '#fff', lineHeight: 1 },
  statSuffix: { fontSize: '14px', color: '#555', fontWeight: '400' },
  statLabel:  { fontSize: '12px', color: '#444', marginTop: '0.25rem' },

  tabBar:    { display: 'flex', gap: '0', marginBottom: '1.5rem', borderBottom: '1px solid #1a1a1a' },
  tab:       { display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'transparent', border: 'none', color: '#555', padding: '0.7rem 1.25rem', cursor: 'pointer', fontSize: '14px', borderBottom: '2px solid transparent', marginBottom: '-1px', transition: 'color 0.15s' },
  tabActive: { color: '#fff', borderBottom: '2px solid #6366f1' },

  chartCard:   { background: 'linear-gradient(135deg, #111 0%, #0f0f1a 100%)', border: '1px solid #1e1e1e', borderRadius: '16px', padding: '1.75rem', marginBottom: '1rem' },
  chartHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' },
  chartTitle:  { fontSize: '16px', fontWeight: '600', color: '#ccc', marginBottom: '2px' },
  chartSub:    { fontSize: '12px', color: '#444' },
  trendBadge:  { background: '#111', border: '1px solid #2a2a2a', borderRadius: '20px', padding: '4px 12px' },
  emptyChart:  { background: '#111', border: '1px solid #1e1e1e', borderRadius: '16px', padding: '3rem', textAlign: 'center', marginBottom: '1rem' },
  twoCol:      { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' },

  weakRow:    { marginBottom: '0.875rem' },
  weakMeta:   { display: 'flex', justifyContent: 'space-between', marginBottom: '4px' },
  weakBarBg:  { height: '6px', background: '#1a1a1a', borderRadius: '3px', overflow: 'hidden' },
  weakBarFill:{ height: '100%', borderRadius: '3px', transition: 'width 0.5s ease' },

  historyHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' },
  sectionTitle:  { fontSize: '18px', fontWeight: '600', color: '#ccc' },
  emptyState:    { textAlign: 'center', padding: '4rem 0' },

  sessionGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '0.75rem' },
  sessionCard: {
    background: 'linear-gradient(135deg, #111 0%, #0f0f1a 100%)',
    border: '1px solid #1e1e1e', borderRadius: '14px',
    padding: '1.25rem', cursor: 'pointer', transition: 'border-color 0.2s, transform 0.15s',
  },
  sessionCardTop: { display: 'flex', gap: '1rem', marginBottom: '0.75rem' },
  sessionLeft:    { flexShrink: 0 },
  sessionRight:   { flex: 1, minWidth: 0 },
  sessionRole:    { fontSize: '15px', fontWeight: '600', color: '#fff', marginBottom: '0.25rem' },
  sessionMeta:    { display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '12px', marginBottom: '0.5rem', flexWrap: 'wrap' },
  metaDot:        { color: '#333' },
  sessionFooter:  { borderTop: '1px solid #1a1a1a', paddingTop: '0.75rem' },

  topicTags: { display: 'flex', gap: '4px', flexWrap: 'wrap' },
  topicTag:  { background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '4px', padding: '2px 7px', fontSize: '11px', color: '#666' },

  detailHeader:    { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem', background: 'linear-gradient(135deg, #111 0%, #0f0f1a 100%)', border: '1px solid #1e1e1e', borderRadius: '16px', padding: '1.75rem' },
  detailLeft:      { flex: 1 },
  detailRole:      { fontSize: '22px', fontWeight: '700', marginBottom: '0.5rem' },
  detailMeta:      { display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', fontSize: '13px' },
  detailScoreWrap: { flexShrink: 0, marginLeft: '1.5rem' },

  answersList: { display: 'flex', flexDirection: 'column', gap: '1rem' },
  answerCard:  { background: 'linear-gradient(135deg, #111 0%, #0f0f1a 100%)', border: '1px solid #1e1e1e', borderRadius: '14px', padding: '1.5rem' },
  answerHeader:     { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' },
  answerHeaderLeft: { display: 'flex', alignItems: 'center', gap: '0.5rem' },
  answerQ:          { fontSize: '12px', color: '#444', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' },
  answerQuestion:   { fontSize: '15px', color: '#aaa', marginBottom: '1rem', lineHeight: '1.5' },
  answerTranscript: { fontSize: '14px', color: '#ddd', lineHeight: '1.7', marginBottom: '1rem' },

  reasoningBox: { background: '#0d0d0d', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '10px', padding: '1rem', marginBottom: '1rem' },
  conceptsRow:  { display: 'flex', gap: '1.5rem', marginBottom: '1rem', flexWrap: 'wrap' },
  conceptGroup: { display: 'flex', flexDirection: 'column', gap: '6px' },
  tagWrap:      { display: 'flex', flexWrap: 'wrap', gap: '4px' },
  tagGreen:     { background: '#0f2a1a', border: '1px solid rgba(34,197,94,0.3)', color: '#86efac', fontSize: '11px', padding: '2px 8px', borderRadius: '4px' },
  tagRed:       { background: '#2a0f0f', border: '1px solid rgba(239,68,68,0.3)',  color: '#fca5a5', fontSize: '11px', padding: '2px 8px', borderRadius: '4px' },

  answerStats: { display: 'flex', gap: '0.5rem', flexWrap: 'wrap' },
  statPill:    { background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#888', fontSize: '12px', padding: '3px 10px', borderRadius: '20px' },

  primaryBtn: { background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff', border: 'none', borderRadius: '8px', padding: '0.75rem 1.5rem', fontSize: '14px', fontWeight: '600', cursor: 'pointer', transition: 'transform 0.1s' },
  spinner:    { width: '44px', height: '44px', border: '3px solid #1e1e1e', borderTop: '3px solid #6366f1', borderRadius: '50%', animation: 'spin 0.9s linear infinite' },
  muted:      { color: '#444', fontSize: '13px' },
}
