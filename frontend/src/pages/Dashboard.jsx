import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { dashboardAPI } from '../services/api'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, BarChart, Bar, Cell
} from 'recharts'

export default function Dashboard() {
  const navigate = useNavigate()
  const user     = JSON.parse(localStorage.getItem('user') || '{}')

  const [sessions,  setSessions]  = useState([])
  const [stats,     setStats]     = useState(null)
  const [insights,  setInsights]  = useState(null)
  const [selected,  setSelected]  = useState(null)
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState('')
  const [activeTab, setActiveTab] = useState('overview')
  const [detailLoading, setDetailLoading] = useState(false)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError('')
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
        if (err.response?.status === 401) {
          navigate('/login')
          return
        }
        setError('Failed to load dashboard data. Check your connection.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [navigate])

  const loadDetail = async (id) => {
    setDetailLoading(true)
    setSelected(null)
    setActiveTab('detail')
    try {
      const res = await dashboardAPI.getSession(id)
      setSelected(res.data)
    } catch (err) {
      setSelected({ error: 'Failed to load session details.' })
    } finally {
      setDetailLoading(false)
    }
  }

  const logout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    navigate('/login')
  }

  const scoreColor = (s) =>
    s >= 70 ? '#22c55e' : s >= 40 ? '#eab308' : '#ef4444'

  const diffColor = (d) =>
    d === 'easy' ? '#22c55e' : d === 'hard' ? '#ef4444' : '#eab308'

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null
    return (
      <div style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '8px', padding: '0.75rem 1rem', fontSize: '13px' }}>
        <p style={{ color: '#888', marginBottom: '4px' }}>{label}</p>
        <p style={{ color: '#22c55e', fontWeight: '600' }}>{payload[0].value}/100</p>
        {payload[0].payload?.role && (
          <p style={{ color: '#555', fontSize: '12px' }}>{payload[0].payload.role}</p>
        )}
      </div>
    )
  }

  if (loading) {
    return (
      <div style={styles.page}>
        <div style={styles.header}>
          <img src="/logo.png" alt="Qualif-AI" style={{ height: '70px', objectFit: 'contain' }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', flexDirection: 'column', gap: '1rem' }}>
          <div style={styles.spinner} />
          <p style={{ color: '#555', fontSize: '14px' }}>Loading your dashboard...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div style={styles.page}>
        <div style={styles.header}>
          <div style={styles.logo}>Qualif<span style={styles.ai}>AI</span></div>
          <button onClick={logout} style={styles.ghostBtn}>Logout</button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', flexDirection: 'column', gap: '1rem', textAlign: 'center' }}>
          <div style={{ fontSize: '28px' }}>⚠</div>
          <p style={{ color: '#888' }}>{error}</p>
          <button onClick={() => window.location.reload()} style={styles.primaryBtn}>
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div style={styles.logo}>Qualif<span style={styles.ai}>AI</span></div>
        <div style={styles.headerRight}>
          <span style={styles.userName}>{user.name}</span>
          <button onClick={() => navigate('/')} style={styles.ghostBtn}>New interview</button>
          <button onClick={logout} style={styles.ghostBtn}>Logout</button>
        </div>
      </div>

      <div style={styles.content}>
        {/* Stats */}
        {stats && (
          <div style={styles.statsRow}>
            {[
              { label: 'Total sessions',  value: stats.total_sessions },
              { label: 'Completed',       value: stats.completed_sessions },
              { label: 'Answers given',   value: stats.total_answers },
              { label: 'Average score',   value: `${stats.avg_score}/100` },
              { label: 'Best score',      value: `${stats.best_score}/100` },
            ].map(s => (
              <div key={s.label} style={styles.statCard}>
                <div style={styles.statValue}>{s.value}</div>
                <div style={styles.statLabel}>{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div style={styles.tabRow}>
          {['overview', 'history', 'detail'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{ ...styles.tab, ...(activeTab === tab ? styles.tabActive : {}) }}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
              {tab === 'detail' && selected && !selected.error && (
                <span style={{ color: '#555', fontSize: '11px', marginLeft: '6px' }}>
                  — {selected.role}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Overview ── */}
        {activeTab === 'overview' && insights && (
          <div>
            {insights.score_trend?.length > 1 ? (
              <div style={styles.chartCard}>
                <h3 style={styles.chartTitle}>Score trend</h3>
                <p style={{ ...styles.muted, fontSize: '12px', marginBottom: '1rem' }}>
                  Your performance across {insights.total_evaluated} evaluated sessions
                </p>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={insights.score_trend} margin={{ top: 10, right: 20, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e1e1e" />
                    <XAxis dataKey="date" tick={{ fill: '#555', fontSize: 12 }} axisLine={{ stroke: '#2a2a2a' }} tickLine={false} />
                    <YAxis domain={[0, 100]} tick={{ fill: '#555', fontSize: 12 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Line type="monotone" dataKey="score" stroke="#6366f1" strokeWidth={2} dot={{ fill: '#6366f1', r: 4 }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div style={styles.emptyChart}>
                <p style={styles.muted}>Complete at least 2 interviews to see your score trend.</p>
                <button onClick={() => navigate('/')} style={{ ...styles.primaryBtn, marginTop: '1rem', fontSize: '13px', padding: '0.6rem 1.25rem' }}>
                  Start an interview
                </button>
              </div>
            )}

            <div style={styles.twoCol}>
              {/* Weak areas */}
              <div style={styles.chartCard}>
                <h3 style={styles.chartTitle}>Weak areas</h3>
                <p style={{ ...styles.muted, fontSize: '12px', marginBottom: '1rem' }}>
                  Concepts you most frequently miss
                </p>
                {!insights.weak_areas?.length ? (
                  <p style={styles.muted}>No data yet — complete some evaluated interviews.</p>
                ) : (
                  insights.weak_areas.map((w, i) => (
                    <div key={w.concept} style={styles.weakRow}>
                      <div style={styles.weakBar}>
                        <div style={{
                          ...styles.weakBarFill,
                          width: `${Math.min(100, (w.count / (insights.weak_areas[0]?.count || 1)) * 100)}%`,
                          background: i < 3 ? '#ef4444' : i < 6 ? '#eab308' : '#555'
                        }}/>
                      </div>
                      <div style={styles.weakLabel}>
                        <span style={{ color: '#ccc', textTransform: 'capitalize' }}>{w.concept}</span>
                        <span style={styles.muted}>{w.count}x missed</span>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Topic scores */}
              <div style={styles.chartCard}>
                <h3 style={styles.chartTitle}>Performance by topic</h3>
                <p style={{ ...styles.muted, fontSize: '12px', marginBottom: '1rem' }}>
                  Average score per topic
                </p>
                {!insights.topic_scores?.length ? (
                  <p style={styles.muted}>No data yet.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={Math.max(160, insights.topic_scores.length * 36)}>
                    <BarChart data={insights.topic_scores} layout="vertical" margin={{ top: 0, right: 20, left: 80, bottom: 0 }}>
                      <XAxis type="number" domain={[0, 100]} tick={{ fill: '#555', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="topic" tick={{ fill: '#888', fontSize: 12 }} axisLine={false} tickLine={false} width={80} />
                      <Tooltip
                        formatter={(v) => [`${v}/100`, 'Avg score']}
                        contentStyle={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '8px', fontSize: '13px' }}
                        labelStyle={{ color: '#888' }}
                      />
                      <Bar dataKey="avg_score" radius={[0, 4, 4, 0]}>
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
          <div>
            <h2 style={styles.sectionTitle}>Interview history</h2>
            {sessions.length === 0 ? (
              <div style={styles.emptyState}>
                <p style={styles.muted}>No interviews yet.</p>
                <button onClick={() => navigate('/')} style={styles.primaryBtn}>
                  Start your first interview
                </button>
              </div>
            ) : (
              <div style={styles.sessionGrid}>
                {sessions.map(s => (
                  <div
                    key={s.id}
                    onClick={() => loadDetail(s.id)}
                    style={styles.sessionCard}
                  >
                    <div style={styles.sessionTop}>
                      <span style={styles.sessionRole}>{s.role}</span>
                      <span style={{ ...styles.scoreBadge, color: scoreColor(s.avg_score), borderColor: scoreColor(s.avg_score) }}>
                        {s.avg_score}/100
                      </span>
                    </div>
                    <div style={styles.sessionMeta}>
                      <span style={{ color: diffColor(s.difficulty), fontSize: '12px', fontWeight: '500' }}>
                        {s.difficulty}
                      </span>
                      <span style={styles.muted}>{s.answer_count} answers</span>
                      <span style={styles.muted}>{new Date(s.created_at).toLocaleDateString()}</span>
                    </div>
                    {s.topics?.length > 0 && (
                      <div style={styles.topicTags}>
                        {s.topics.slice(0, 3).map(t => (
                          <span key={t} style={styles.topicTag}>{t}</span>
                        ))}
                      </div>
                    )}
                    <div style={{ ...styles.muted, fontSize: '12px', marginTop: '0.5rem' }}>
                      Click to view breakdown →
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Detail ── */}
        {activeTab === 'detail' && (
          <div>
            {detailLoading && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '2rem 0' }}>
                <div style={{ ...styles.spinner, width: '24px', height: '24px', borderWidth: '2px' }} />
                <span style={styles.muted}>Loading session details...</span>
              </div>
            )}

            {!detailLoading && !selected && (
              <div style={styles.emptyState}>
                <p style={styles.muted}>Select an interview from History to see details.</p>
                <button onClick={() => setActiveTab('history')} style={styles.primaryBtn}>
                  Go to history
                </button>
              </div>
            )}

            {!detailLoading && selected?.error && (
              <div style={{ background: '#2a1515', border: '1px solid #5a1a1a', color: '#ff6b6b', padding: '1rem', borderRadius: '8px' }}>
                {selected.error}
              </div>
            )}

            {!detailLoading && selected && !selected.error && (
              <>
                <div style={styles.detailHeader}>
                  <div>
                    <h2 style={styles.detailRole}>{selected.role}</h2>
                    <p style={styles.muted}>
                      {new Date(selected.created_at).toLocaleString()} · {selected.difficulty}
                    </p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '48px', fontWeight: '700', color: scoreColor(selected.avg_score), lineHeight: 1 }}>
                      {selected.avg_score}
                    </div>
                    <div style={{ ...styles.muted, fontSize: '13px' }}>overall score</div>
                  </div>
                </div>

                <div style={styles.answersList}>
                  {selected.answers?.length === 0 && (
                    <p style={styles.muted}>No answers recorded.</p>
                  )}
                  {selected.answers?.map((a, i) => (
                    <div key={i} style={styles.answerCard}>
                      <div style={styles.answerTop}>
                        <span style={styles.answerQ}>Q{i + 1}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <span style={{ fontSize: '12px', color: '#555' }}>
                            {a.input_mode === 'text' ? 'Typed' : 'Voice'}
                          </span>
                          <span style={{ fontSize: '15px', fontWeight: '600', color: scoreColor(a.quick_score ?? 0) }}>
                            {a.quick_score != null ? `${a.quick_score}/100` : 'Not evaluated'}
                          </span>
                        </div>
                      </div>

                      <p style={styles.answerQuestion}>{a.question_text}</p>

                      {a.reasoning && (
                        <div style={styles.reasoningBox}>{a.reasoning}</div>
                      )}

                      {a.keywords_found?.length > 0 && (
                        <div style={styles.conceptRow}>
                          <span style={styles.muted}>Covered:</span>
                          <div style={styles.tagWrap}>
                            {a.keywords_found.map(k => (
                              <span key={k} style={styles.tagGreen}>{k}</span>
                            ))}
                          </div>
                        </div>
                      )}

                      {a.missing_concepts?.length > 0 && (
                        <div style={styles.conceptRow}>
                          <span style={styles.muted}>Missed:</span>
                          <div style={styles.tagWrap}>
                            {a.missing_concepts.map(k => (
                              <span key={k} style={styles.tagRed}>{k}</span>
                            ))}
                          </div>
                        </div>
                      )}

                      <p style={styles.answerTranscript}>
                        {a.corrected_transcript || a.transcript}
                        {a.was_corrected && (
                          <span style={{ color: '#555', fontSize: '11px', marginLeft: '6px' }}>
                            (STT corrected)
                          </span>
                        )}
                      </p>

                      <div style={styles.answerMeta}>
                        {a.wpm > 0 && <span style={styles.muted}>{a.wpm} WPM</span>}
                        <span style={styles.muted}>{a.word_count} words</span>
                        {a.filler_words?.length > 0 && (
                          <span style={{ color: '#ef4444', fontSize: '12px' }}>
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

const styles = {
  page:          { minHeight: '100vh', background: '#0f0f0f', color: '#fff' },
  header:        { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem 2rem', borderBottom: '1px solid #1e1e1e' },
  logo:          { fontSize: '20px', fontWeight: '700' },
  ai:            { color: '#6366f1' },
  headerRight:   { display: 'flex', alignItems: 'center', gap: '1rem' },
  userName:      { color: '#888', fontSize: '14px' },
  ghostBtn:      { background: 'transparent', border: '1px solid #2a2a2a', color: '#aaa', padding: '0.4rem 0.9rem', borderRadius: '8px', cursor: 'pointer', fontSize: '13px' },
  content:       { maxWidth: '1000px', margin: '0 auto', padding: '2rem 1.5rem' },
  statsRow:      { display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' },
  statCard:      { flex: 1, minWidth: '130px', background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '10px', padding: '1.25rem', textAlign: 'center' },
  statValue:     { fontSize: '26px', fontWeight: '700', color: '#fff' },
  statLabel:     { fontSize: '12px', color: '#888', marginTop: '0.25rem' },
  tabRow:        { display: 'flex', gap: '0', marginBottom: '1.5rem', borderBottom: '1px solid #1e1e1e' },
  tab:           { background: 'transparent', border: 'none', color: '#555', padding: '0.6rem 1.25rem', cursor: 'pointer', fontSize: '14px', borderBottom: '2px solid transparent', marginBottom: '-1px' },
  tabActive:     { color: '#fff', borderBottom: '2px solid #6366f1' },
  chartCard:     { background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '12px', padding: '1.5rem', marginBottom: '1rem' },
  chartTitle:    { fontSize: '15px', fontWeight: '600', color: '#ccc', marginBottom: '0.25rem' },
  emptyChart:    { background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '12px', padding: '2.5rem', textAlign: 'center', marginBottom: '1rem' },
  twoCol:        { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' },
  weakRow:       { marginBottom: '0.75rem' },
  weakBar:       { height: '6px', background: '#222', borderRadius: '3px', marginBottom: '4px', overflow: 'hidden' },
  weakBarFill:   { height: '100%', borderRadius: '3px', transition: 'width 0.4s' },
  weakLabel:     { display: 'flex', justifyContent: 'space-between', fontSize: '13px' },
  sectionTitle:  { fontSize: '16px', fontWeight: '600', marginBottom: '1rem', color: '#ccc' },
  emptyState:    { textAlign: 'center', padding: '3rem 0' },
  sessionGrid:   { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.75rem' },
  sessionCard:   { background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '10px', padding: '1rem 1.25rem', cursor: 'pointer', transition: 'border-color 0.15s' },
  sessionTop:    { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' },
  sessionRole:   { fontSize: '14px', fontWeight: '600', color: '#fff' },
  scoreBadge:    { fontSize: '13px', fontWeight: '600', border: '1px solid', borderRadius: '20px', padding: '2px 8px' },
  sessionMeta:   { display: 'flex', gap: '0.75rem', fontSize: '12px', marginBottom: '0.5rem' },
  topicTags:     { display: 'flex', gap: '0.4rem', flexWrap: 'wrap' },
  topicTag:      { background: '#222', border: '1px solid #333', borderRadius: '4px', padding: '2px 7px', fontSize: '11px', color: '#888' },
  detailHeader:  { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '1px solid #2a2a2a' },
  detailRole:    { fontSize: '20px', fontWeight: '600', marginBottom: '0.25rem' },
  answersList:   { display: 'flex', flexDirection: 'column', gap: '1rem' },
  answerCard:    { background: '#141414', border: '1px solid #222', borderRadius: '10px', padding: '1.25rem' },
  answerTop:     { display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' },
  answerQ:       { fontSize: '12px', color: '#555', fontWeight: '600' },
  answerQuestion:    { fontSize: '14px', color: '#aaa', marginBottom: '0.75rem', lineHeight: '1.5' },
  answerTranscript:  { fontSize: '14px', color: '#ddd', lineHeight: '1.6', marginBottom: '0.75rem' },
  reasoningBox:  { background: '#0a0a0a', border: '1px solid #222', borderRadius: '6px', padding: '0.75rem', marginBottom: '0.75rem', fontSize: '13px', color: '#aaa', lineHeight: '1.5', fontStyle: 'italic' },
  conceptRow:    { display: 'flex', alignItems: 'flex-start', gap: '0.75rem', marginBottom: '0.5rem', fontSize: '13px' },
  tagWrap:       { display: 'flex', flexWrap: 'wrap', gap: '4px' },
  tagGreen:      { background: '#0f2a1a', border: '1px solid #22c55e', color: '#86efac', fontSize: '11px', padding: '2px 8px', borderRadius: '4px' },
  tagRed:        { background: '#2a0f0f', border: '1px solid #ef4444', color: '#fca5a5', fontSize: '11px', padding: '2px 8px', borderRadius: '4px' },
  answerMeta:    { display: 'flex', gap: '1rem', fontSize: '12px' },
  primaryBtn:    { background: '#6366f1', color: '#fff', border: 'none', borderRadius: '8px', padding: '0.75rem 1.5rem', fontSize: '14px', fontWeight: '600', cursor: 'pointer' },
  spinner:       { width: '44px', height: '44px', border: '3px solid #2a2a2a', borderTop: '3px solid #6366f1', borderRadius: '50%', animation: 'spin 0.9s linear infinite' },
  muted:         { color: '#555', fontSize: '13px' },
}
