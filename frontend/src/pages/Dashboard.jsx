import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { dashboardAPI } from '../services/api'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, BarChart, Bar, Cell
} from 'recharts'

// ─── Inline SkillGraph component ─────────────────────────────────────────────

const CATEGORY_COLORS = {
  "Data Structures": { bg: "#0f2a1a", accent: "#4ade80", bar: "#22c55e" },
  "Algorithms":      { bg: "#0f1e2a", accent: "#38bdf8", bar: "#0ea5e9" },
  "System Design":   { bg: "#1e0f2a", accent: "#c084fc", bar: "#a855f7" },
  "Languages":       { bg: "#2a1e0f", accent: "#fb923c", bar: "#f97316" },
  "Concepts":        { bg: "#0f2a2a", accent: "#2dd4bf", bar: "#14b8a6" },
  "Communication":   { bg: "#2a2a0f", accent: "#facc15", bar: "#eab308" },
  "Behavioural":     { bg: "#2a0f0f", accent: "#f87171", bar: "#ef4444" },
}

function SkillGraph({ skillData }) {
  const [expanded, setExpanded] = useState(null)

  const { category_breakdown = {}, weakest_skills = [], target_skill, skill_graph = {} } = skillData || {}
  const practiced = Object.entries(category_breakdown).filter(([, d]) => d.mastery != null)
  const hasAnyData = Object.keys(skill_graph).length > 0

  if (!hasAnyData) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem 0', color: '#444', fontSize: '14px' }}>
        <div style={{ fontSize: '32px', marginBottom: '0.75rem' }}>🧠</div>
        Complete an interview to start building your skill profile.
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#444' }}>
            Click a category to see individual skill breakdown
          </p>
        </div>
        {target_skill && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)',
            padding: '6px 12px', borderRadius: '8px',
          }}>
            <span style={{ fontSize: '14px' }}>🎯</span>
            <div>
              <div style={{ fontSize: '10px', color: 'rgba(251,191,36,0.6)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Next target</div>
              <div style={{ fontSize: '12px', fontWeight: '700', color: '#fbbf24' }}>{target_skill}</div>
            </div>
          </div>
        )}
      </div>

      {/* Weakest skills strip */}
      {weakest_skills.length > 0 && (
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: '11px', color: '#444', whiteSpace: 'nowrap' }}>Weak areas:</span>
          {weakest_skills.map((skill, i) => (
            <span key={skill} style={{
              padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '600',
              background: i === 0 ? 'rgba(239,68,68,0.12)' : 'rgba(255,255,255,0.04)',
              color: i === 0 ? '#f87171' : '#555',
              border: i === 0 ? '1px solid rgba(239,68,68,0.25)' : '1px solid #1e1e1e',
            }}>{skill}</span>
          ))}
        </div>
      )}

      {/* Category grid */}
      {!practiced.length ? (
        <p style={{ color: '#444', fontSize: '13px', textAlign: 'center', padding: '2rem 0' }}>
          No skills recorded yet — complete a practice session first.
        </p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '10px' }}>
          {practiced
            .sort((a, b) => a[1].mastery - b[1].mastery)
            .map(([category, data]) => {
              const colors   = CATEGORY_COLORS[category] || { bg: '#111', accent: '#555', bar: '#555' }
              const isOpen   = expanded === category
              const skillCount = Object.keys(data.skills || {}).length

              return (
                <div
                  key={category}
                  onClick={() => setExpanded(isOpen ? null : category)}
                  style={{
                    background: colors.bg,
                    border: `1px solid ${isOpen ? colors.accent + '50' : '#1e1e1e'}`,
                    borderRadius: '12px', padding: '14px',
                    cursor: 'pointer', transition: 'border-color 0.2s',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: '700', color: '#ddd', marginBottom: '2px' }}>{category}</div>
                      <div style={{ fontSize: '11px', color: '#444' }}>
                        {skillCount > 0 ? `${skillCount} skill${skillCount !== 1 ? 's' : ''}` : 'Not started'}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '20px', fontWeight: '800', color: colors.accent }}>
                        {data.mastery != null ? `${Math.round(data.mastery)}%` : '—'}
                      </div>
                    </div>
                  </div>

                  <div style={{ height: '3px', background: '#1a1a1a', borderRadius: '2px', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', width: data.mastery != null ? `${data.mastery}%` : '0%',
                      background: colors.bar, borderRadius: '2px', transition: 'width 0.8s ease',
                    }} />
                  </div>

                  {/* Per-skill drilldown */}
                  {isOpen && skillCount > 0 && (
                    <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {Object.entries(data.skills).map(([skillName, skillData]) => (
                        <div key={skillName} style={{
                          padding: '7px 10px', borderRadius: '7px',
                          background: skillName === target_skill ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.02)',
                          border: skillName === target_skill ? `1px solid ${colors.accent}40` : '1px solid transparent',
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              {skillName === target_skill && (
                                <span style={{
                                  fontSize: '8px', fontWeight: '700', letterSpacing: '0.1em', color: colors.accent,
                                  background: `${colors.accent}20`, padding: '1px 5px', borderRadius: '3px', textTransform: 'uppercase',
                                }}>TARGET</span>
                              )}
                              <span style={{ fontSize: '12px', color: '#bbb', fontFamily: 'monospace' }}>{skillName}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontSize: '10px', color: '#444' }}>{skillData.attempts}×</span>
                              <span style={{ fontSize: '13px', fontWeight: '700', color: colors.accent }}>
                                {skillData.mastery != null ? `${Math.round(skillData.mastery)}%` : '—'}
                              </span>
                            </div>
                          </div>
                          <div style={{ height: '3px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', overflow: 'hidden' }}>
                            <div style={{
                              height: '100%',
                              width: skillData.mastery != null ? `${skillData.mastery}%` : '0%',
                              background: skillData.mastery >= 70 ? colors.bar : skillData.mastery >= 40 ? `${colors.bar}cc` : `${colors.bar}70`,
                              borderRadius: '2px', transition: 'width 0.8s ease',
                            }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
        </div>
      )}
    </div>
  )
}

// ─── Inline AnswerBenchmark component ────────────────────────────────────────

function ConceptTag({ label, type }) {
  const styles = {
    covered: { bg: '#0f2a1a', border: 'rgba(34,197,94,0.3)',  color: '#86efac', icon: '✓' },
    missing: { bg: '#2a0f0f', border: 'rgba(239,68,68,0.3)',  color: '#fca5a5', icon: '✗' },
    extra:   { bg: '#0f0f2a', border: 'rgba(99,102,241,0.3)', color: '#a5b4fc', icon: '+' },
  }
  const st = styles[type] || styles.extra
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '4px',
      padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: '600',
      background: st.bg, border: `1px solid ${st.border}`, color: st.color,
      margin: '0 3px 3px 0',
    }}>
      <span style={{ opacity: 0.7 }}>{st.icon}</span>
      {label}
    </span>
  )
}

function AnswerBenchmark({ answerData, index }) {
  const [open, setOpen] = useState(false)
  const [showIdeal, setShowIdeal] = useState(false)
  const [expandAnswer, setExpandAnswer] = useState(false)
  const [expandIdeal, setExpandIdeal] = useState(false)

  if (!answerData) return null

  const {
    question_text, stt_corrected_transcript, transcript,
    ideal_answer, key_concepts = [], common_mistakes = [], comparison = {},
    quick_score, keyword_score, structure_score,
    matched_keywords = [], missing_keywords = [],
    penalties_applied = [], word_count, wpm, input_mode,
    filler_words = [], was_corrected, reasoning,
    ttr = 0, hedging_ratio = 0, avg_sentence_len = 0,
  } = answerData

  const score         = quick_score ?? 0
  const candidateText = stt_corrected_transcript || transcript || ''
  const {
    covered_concepts = [], missing_concepts = [], extra_concepts = [],
    comparison_feedback = '', improvement_tip = '', similarity_score = 0,
  } = comparison

  const scoreCol  = score >= 70 ? '#22c55e' : score >= 40 ? '#eab308' : '#ef4444'
  const bandLabel = score >= 90 ? 'Excellent' : score >= 70 ? 'Good' : score >= 50 ? 'Fair' : 'Poor'
  const isLong    = (t) => t?.length > 300
  const preview   = (t) => t?.slice(0, 300) + '…'

  // Which keywords to show in the summary strip (top 4 missing only)
  const topMissing = (missing_concepts.length > 0 ? missing_concepts : missing_keywords).slice(0, 4)
  const hasAnalysis = reasoning || comparison_feedback || covered_concepts.length > 0
    || missing_concepts.length > 0 || penalties_applied.length > 0 || ideal_answer

  return (
    <div style={{ ...s.answerCard, padding: 0, overflow: 'hidden' }} className="fade-in">

      {/* ── Always-visible summary row ── */}
      <div
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: '1rem',
          padding: '1rem 1.25rem', cursor: 'pointer',
          borderBottom: open ? '1px solid #1e1e1e' : 'none',
        }}
      >
        {/* Score ring */}
        <div style={{
          width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
          background: `${scoreCol}15`, border: `2px solid ${scoreCol}40`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexDirection: 'column',
        }}>
          <span style={{ fontSize: '12px', fontWeight: '800', color: scoreCol, lineHeight: 1 }}>{score}</span>
        </div>

        {/* Question + quick summary */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '11px', color: '#444', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Q{index + 1}</span>
            <span style={{
              fontSize: '10px', fontWeight: '700', padding: '1px 7px', borderRadius: '3px',
              background: `${scoreCol}15`, color: scoreCol, border: `1px solid ${scoreCol}30`,
              textTransform: 'uppercase', letterSpacing: '0.06em',
            }}>{bandLabel}</span>
            <span style={{ fontSize: '11px', color: '#333', background: '#1a1a1a', padding: '1px 7px', borderRadius: '10px' }}>
              {input_mode === 'text' ? '⌨' : '🎙'} {word_count}w{wpm > 0 ? ` · ${wpm} wpm` : ''}
            </span>
            {keyword_score != null && (
              <span style={{ fontSize: '11px', color: keyword_score >= 60 ? '#86efac' : '#fca5a5', background: keyword_score >= 60 ? '#0f2a1a' : '#2a0f0f', padding: '1px 7px', borderRadius: '10px', border: `1px solid ${keyword_score >= 60 ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}` }}>
                KW {Math.round(keyword_score)}%
              </span>
            )}
            {similarity_score > 0 && (
              <span style={{ fontSize: '11px', color: similarity_score >= 70 ? '#86efac' : similarity_score >= 45 ? '#fcd34d' : '#fca5a5', background: '#1a1a1a', padding: '1px 7px', borderRadius: '10px' }}>
                ≈{similarity_score}% ideal
              </span>
            )}
          </div>
          <p style={{ margin: 0, fontSize: '13px', color: '#888', lineHeight: '1.4',
            overflow: 'hidden',
            display: '-webkit-box', WebkitLineClamp: open ? 'unset' : 2,
            WebkitBoxOrient: 'vertical',
          }}>
            {question_text}
          </p>
          {/* Top missing keywords always visible */}
          {topMissing.length > 0 && (
            <div style={{ marginTop: '5px', display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
              {topMissing.map(k => (
                <span key={k} style={{ fontSize: '10px', color: '#f87171', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', padding: '1px 6px', borderRadius: '3px' }}>✗ {k}</span>
              ))}
              {(missing_concepts.length > 4 || missing_keywords.length > 4) && (
                <span style={{ fontSize: '10px', color: '#555' }}>+{(missing_concepts.length || missing_keywords.length) - 4} more</span>
              )}
            </div>
          )}
        </div>

        {/* Expand chevron */}
        {hasAnalysis && (
          <span style={{ color: '#333', fontSize: '12px', flexShrink: 0, transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'none' }}>▼</span>
        )}
      </div>

      {/* ── Expandable analysis drawer ── */}
      {open && (
        <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>

          {/* Your answer */}
          <div>
            <div style={{ fontSize: '10px', color: '#444', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '6px' }}>Your Answer</div>
            <p style={{ ...s.answerTranscript, margin: 0 }}>
              {isLong(candidateText) && !expandAnswer ? preview(candidateText) : candidateText}
              {isLong(candidateText) && (
                <button onClick={() => setExpandAnswer(e => !e)} style={{ marginLeft: '6px', fontSize: '11px', color: '#6366f1', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                  {expandAnswer ? 'less' : 'more'}
                </button>
              )}
              {was_corrected && <span style={{ color: '#444', fontSize: '11px', marginLeft: '6px' }}>(STT corrected)</span>}
            </p>
          </div>

          {/* Full concept coverage */}
          {(covered_concepts.length > 0 || missing_concepts.length > 0 || extra_concepts.length > 0) && (
            <div>
              <div style={{ fontSize: '10px', color: '#444', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '7px' }}>Concept Coverage</div>
              <div>
                {covered_concepts.map(c => <ConceptTag key={c} label={c} type="covered" />)}
                {missing_concepts.map(c => <ConceptTag key={c} label={c} type="missing" />)}
                {extra_concepts.map(c => <ConceptTag key={c} label={c} type="extra" />)}
              </div>
            </div>
          )}

          {/* Fallback keyword coverage */}
          {covered_concepts.length === 0 && missing_concepts.length === 0 && (matched_keywords?.length > 0 || missing_keywords?.length > 0) && (
            <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
              {matched_keywords?.length > 0 && (
                <div style={s.conceptGroup}>
                  <span style={{ color: '#22c55e', fontSize: '11px', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Covered</span>
                  <div style={s.tagWrap}>{matched_keywords.map(k => <span key={k} style={s.tagGreen}>{k}</span>)}</div>
                </div>
              )}
              {missing_keywords?.length > 0 && (
                <div style={s.conceptGroup}>
                  <span style={{ color: '#ef4444', fontSize: '11px', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Missed</span>
                  <div style={s.tagWrap}>{missing_keywords.map(k => <span key={k} style={s.tagRed}>{k}</span>)}</div>
                </div>
              )}
            </div>
          )}

          {/* Score breakdown pills */}
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {keyword_score != null && (
              <span style={{ ...s.statPill, background: keyword_score >= 60 ? '#0f2a1a' : '#2a0f0f', color: keyword_score >= 60 ? '#86efac' : '#fca5a5', border: `1px solid ${keyword_score >= 60 ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'}` }}>
                Keywords {Math.round(keyword_score)}%
              </span>
            )}
            {structure_score != null && (
              <span style={{ ...s.statPill, background: structure_score >= 60 ? '#0f2a1a' : '#2a0f0f', color: structure_score >= 60 ? '#86efac' : '#fca5a5', border: `1px solid ${structure_score >= 60 ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'}` }}>
                Structure {Math.round(structure_score)}%
              </span>
            )}
            {wpm > 0 && <span style={s.statPill}>{wpm} WPM</span>}
            <span style={s.statPill}>{word_count} words</span>
            {filler_words?.length > 0 && (
              <span style={{ ...s.statPill, background: '#2a0f0f', color: '#fca5a5', borderColor: '#5a1a1a' }}>
                Fillers: {filler_words.join(', ')}
              </span>
            )}
            {/* Confidence metrics — voice only */}
            {input_mode === 'voice' && ttr > 0 && (
              <span style={{ ...s.statPill, background: ttr >= 0.6 ? '#0f2a1a' : ttr >= 0.45 ? '#1a1a0f' : '#2a0f0f', color: ttr >= 0.6 ? '#86efac' : ttr >= 0.45 ? '#fcd34d' : '#fca5a5', border: `1px solid ${ttr >= 0.6 ? 'rgba(34,197,94,0.25)' : ttr >= 0.45 ? 'rgba(234,179,8,0.25)' : 'rgba(239,68,68,0.25)'}` }}>
                Vocab {Math.round(ttr * 100)}%
              </span>
            )}
            {input_mode === 'voice' && hedging_ratio > 0 && (
              <span style={{ ...s.statPill, background: hedging_ratio <= 0.15 ? '#0f2a1a' : hedging_ratio <= 0.3 ? '#1a1a0f' : '#2a0f0f', color: hedging_ratio <= 0.15 ? '#86efac' : hedging_ratio <= 0.3 ? '#fcd34d' : '#fca5a5', border: `1px solid ${hedging_ratio <= 0.15 ? 'rgba(34,197,94,0.25)' : hedging_ratio <= 0.3 ? 'rgba(234,179,8,0.25)' : 'rgba(239,68,68,0.25)'}` }}>
                Hedging {hedging_ratio > 0 ? (hedging_ratio <= 0.15 ? 'low ✓' : hedging_ratio <= 0.3 ? 'medium' : 'high ✗') : '—'}
              </span>
            )}
            {input_mode === 'voice' && avg_sentence_len > 0 && (
              <span style={s.statPill}>
                ~{avg_sentence_len}w/sentence
              </span>
            )}
          </div>

          {/* Penalties */}
          {penalties_applied?.length > 0 && (
            <div style={{ padding: '8px 12px', borderRadius: '8px', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)' }}>
              <div style={{ fontSize: '10px', fontWeight: '700', color: '#f87171', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Penalties</div>
              {penalties_applied.map((p, i) => <div key={i} style={{ fontSize: '11px', color: '#666', marginBottom: '2px' }}>— {p}</div>)}
            </div>
          )}

          {/* AI feedback + comparison */}
          {(reasoning || comparison_feedback) && (
            <div style={{ background: '#0d0d0d', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '10px', padding: '1rem' }}>
              {reasoning && (
                <>
                  <span style={{ color: '#6366f1', fontSize: '11px', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.05em' }}>AI Feedback</span>
                  <p style={{ color: '#aaa', fontSize: '13px', lineHeight: '1.6', margin: '4px 0 0', fontStyle: 'italic' }}>{reasoning}</p>
                </>
              )}
              {comparison_feedback && (
                <div style={{ marginTop: reasoning ? '10px' : 0, paddingTop: reasoning ? '10px' : 0, borderTop: reasoning ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                  <p style={{ margin: '0 0 6px', fontSize: '13px', color: '#aaa', lineHeight: '1.6' }}>{comparison_feedback}</p>
                  {improvement_tip && (
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', marginTop: '6px' }}>
                      <span style={{ fontSize: '13px' }}>💡</span>
                      <p style={{ margin: 0, fontSize: '12px', color: '#a5b4fc', lineHeight: '1.5' }}>{improvement_tip}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Ideal answer */}
          {ideal_answer && (
            <div>
              <button
                onClick={() => setShowIdeal(v => !v)}
                style={{
                  width: '100%', padding: '8px', borderRadius: '8px',
                  background: showIdeal ? 'rgba(251,191,36,0.07)' : 'rgba(255,255,255,0.02)',
                  border: `1px solid ${showIdeal ? 'rgba(251,191,36,0.25)' : '#1e1e1e'}`,
                  color: showIdeal ? '#fbbf24' : '#444',
                  fontSize: '12px', fontWeight: '600', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                  transition: 'all 0.15s', fontFamily: 'inherit',
                }}
              >
                {showIdeal ? '▲' : '▼'} {showIdeal ? 'Hide' : 'Show'} Ideal Answer
              </button>
              {showIdeal && (
                <div style={{ marginTop: '10px', background: 'rgba(251,191,36,0.04)', border: '1px solid rgba(251,191,36,0.15)', borderRadius: '10px', padding: '1rem' }}>
                  <span style={{ fontSize: '10px', color: 'rgba(251,191,36,0.6)', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: '8px' }}>Ideal Answer</span>
                  <p style={{ fontSize: '13px', color: '#bbb', lineHeight: '1.7', margin: '0 0 10px' }}>
                    {isLong(ideal_answer) && !expandIdeal ? preview(ideal_answer) : ideal_answer}
                    {isLong(ideal_answer) && (
                      <button onClick={() => setExpandIdeal(e => !e)} style={{ marginLeft: '6px', fontSize: '11px', color: '#fbbf24', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                        {expandIdeal ? 'less' : 'more'}
                      </button>
                    )}
                  </p>
                  {key_concepts.length > 0 && (
                    <div style={{ marginBottom: '8px' }}>
                      <span style={{ fontSize: '10px', color: '#555', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: '5px' }}>Must cover</span>
                      {key_concepts.map(c => (
                        <span key={c} style={{ display: 'inline-block', padding: '2px 7px', borderRadius: '4px', fontSize: '11px', background: 'rgba(251,191,36,0.08)', color: '#fcd34d', border: '1px solid rgba(251,191,36,0.15)', margin: '0 3px 3px 0' }}>{c}</span>
                      ))}
                    </div>
                  )}
                  {common_mistakes.length > 0 && (
                    <div>
                      <span style={{ fontSize: '10px', color: '#555', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: '5px' }}>Common mistakes</span>
                      {common_mistakes.map((m, i) => <div key={i} style={{ fontSize: '11px', color: '#555', marginBottom: '3px' }}>⚠ {m}</div>)}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

        </div>
      )}
    </div>
  )
}

// ─── ScoreRing ────────────────────────────────────────────────────────────────

function ScoreRing({ score, size = 80 }) {
  const [displayed, setDisplayed] = useState(0)
  const radius       = 30
  const circumference = 2 * Math.PI * radius
  const color        = score >= 70 ? '#22c55e' : score >= 40 ? '#eab308' : '#ef4444'

  useEffect(() => {
    let start = 0
    const step  = score / 40
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

// ─── Dashboard ────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const navigate = useNavigate()
  const user     = JSON.parse(localStorage.getItem('user') || '{}')

  const [sessions,      setSessions]      = useState([])
  const [stats,         setStats]         = useState(null)
  const [insights,      setInsights]      = useState(null)
  const [skillData,     setSkillData]     = useState(null)
  const [selected,      setSelected]      = useState(null)
  const [loading,       setLoading]       = useState(true)
  const [error,         setError]         = useState('')
  const [activeTab,     setActiveTab]     = useState('overview')
  const [detailLoading, setDetailLoading] = useState(false)
  const [confirmReset,  setConfirmReset]  = useState(false)
  const [resetting,     setResetting]     = useState(false)

  useEffect(() => {
    const load = async () => {
      setLoading(true); setError('')
      try {
        const [sessRes, statRes, insRes, skillRes] = await Promise.all([
          dashboardAPI.getSessions(),
          dashboardAPI.getStats(),
          dashboardAPI.getInsights(),
          dashboardAPI.getSkills(),
        ])
        setSessions(sessRes.data)
        setStats(statRes.data)
        setInsights(insRes.data)
        setSkillData(skillRes.data)
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

  const logout    = () => { localStorage.clear(); navigate('/login') }

  const handleReset = async () => {
    if (!confirmReset) { setConfirmReset(true); return }
    setResetting(true)
    try {
      await dashboardAPI.reset()
      setSessions([]); setStats(null); setInsights(null); setSkillData(null); setSelected(null)
      setConfirmReset(false)
      const [sessRes, statRes, insRes, skillRes] = await Promise.all([
        dashboardAPI.getSessions(), dashboardAPI.getStats(),
        dashboardAPI.getInsights(), dashboardAPI.getSkills(),
      ])
      setSessions(sessRes.data); setStats(statRes.data)
      setInsights(insRes.data);  setSkillData(skillRes.data)
    } catch { setConfirmReset(false) }
    finally { setResetting(false) }
  }
  const scoreColor = (sc) => sc >= 70 ? '#22c55e' : sc >= 40 ? '#eab308' : '#ef4444'
  const diffColor  = (d)  => d === 'easy' ? '#22c55e' : d === 'hard' ? '#ef4444' : '#eab308'

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
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Geist:wght@600;700;800;900&family=Inter:wght@400;500;600&display=swap');
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .fade-in { animation: fadeIn 0.4s ease forwards; }
        .btn-press:active { transform: scale(0.97); }
        .session-card-hover:hover { border-color: rgba(192,193,255,0.2) !important; transform: translateY(-1px); box-shadow: 0 8px 32px rgba(0,0,0,0.3); }
        .stat-card-hover:hover { border-color: rgba(255,255,255,0.12) !important; }
        .nav-ghost-hover:hover { color: rgba(228,225,237,0.8) !important; }
        .chart-card-hover:hover { border-color: rgba(255,255,255,0.1) !important; }

        /* ── Global overflow clamp ── */
        html, body, #root { overflow-x: hidden; max-width: 100vw; }

        /* ── Mobile responsive ── */
        @media (max-width: 640px) {
          .dash-nav-right { gap: 0.35rem !important; flex-wrap: nowrap !important; }
          .dash-greeting  { display: none !important; }
          .dash-nav-reset span { display: none; }
          .dash-nav-reset::before { content: '🗑'; font-size: 14px; }

          .dash-stats-row {
            grid-template-columns: repeat(3, 1fr) !important;
          }
          .dash-stat-value { font-size: 22px !important; }

          .dash-tab-bar {
            width: 100% !important;
            overflow-x: auto !important;
            overflow-y: hidden !important;
            border-radius: 12px !important;
          }
          .dash-tab { padding: 0.4rem 0.65rem !important; font-size: 11px !important; }

          .dash-content { padding: 1rem 12px !important; }
          .dash-title   { font-size: 20px !important; }

          .dash-two-col { grid-template-columns: 1fr !important; }
          .dash-session-grid { grid-template-columns: 1fr !important; }
        }

        @media (max-width: 400px) {
          .dash-stats-row { grid-template-columns: repeat(2, 1fr) !important; }
          .dash-stats-row > div:nth-child(5) { grid-column: span 2; }
          .dash-tab { padding: 0.35rem 0.5rem !important; font-size: 11px !important; }
        }
      `}</style>
      {/* Nav */}
      <nav style={s.nav}>
        <img src="/logo.png" alt="Qualif-AI" style={{ height: '40px', objectFit: 'contain' }} />
        <div style={s.navRight} className="dash-nav-right">
          <span style={{ ...s.greeting, display: 'block' }} className="dash-greeting">Hey, {user.name?.split(' ')[0]} 👋</span>
          <button onClick={() => navigate('/app')} style={s.navPrimary} className="btn-press">
            + New interview
          </button>
          <button
            onClick={handleReset}
            onBlur={() => setTimeout(() => setConfirmReset(false), 200)}
            style={{ ...s.navGhost, ...(confirmReset ? { borderColor: '#ef4444', color: '#ef4444' } : {}) }}
            className="btn-press"
          >
            {resetting ? '...' : confirmReset ? '⚠ Sure? Click again' : '🗑 Reset'}
          </button>
          <button onClick={logout} style={s.navGhost} className="btn-press">Logout</button>
        </div>
      </nav>

      <div style={s.content} className="dash-content">
        {/* Dashboard header */}
        <div style={s.dashHeader}>
          <h1 style={s.dashTitle} className="dash-title">Dashboard Overview</h1>
          <p style={s.dashSub}>Your interview performance metrics and skill progression.</p>
        </div>

        {/* Stats row */}
        {stats && (
          <div style={s.statsRow} className="fade-in dash-stats-row">
            {[
              { label: 'Total sessions',  value: stats.total_sessions,    icon: '🎯' },
              { label: 'Completed',       value: stats.completed_sessions, icon: '✅' },
              { label: 'Answers given',   value: stats.total_answers,      icon: '💬' },
              { label: 'Average score',   value: `${stats.avg_score}`,     icon: '📊', suffix: '/100' },
              { label: 'Best score',      value: `${stats.best_score}`,    icon: '🏆', suffix: '/100' },
            ].map(st => {
              const accent = STAT_ACCENTS[st.label] || { color: '#c0c1ff', glow: 'rgba(192,193,255,0.1)' }
              return (
                <div key={st.label} style={{ ...s.statCard, boxShadow: `0 0 20px -5px ${accent.glow}` }} className="stat-card-hover">
                  <div style={{ ...s.statIcon, filter: 'none' }}>{st.icon}</div>
                  <div style={{ ...s.statValue, color: accent.color }}>
                    {st.value}
                    {st.suffix && <span style={s.statSuffix}>{st.suffix}</span>}
                  </div>
                  <div style={s.statLabel}>{st.label}</div>
                </div>
              )
            })}
          </div>
        )}

        {/* Tab bar */}
        <div style={s.tabBar} className="dash-tab-bar">
          {[
            { id: 'overview', label: 'Overview',   icon: '📈' },
            { id: 'skills',   label: 'Skill Graph', icon: '🧠' },
            { id: 'history',  label: 'History',    icon: '🕐' },
            { id: 'detail',   label: 'Session',    icon: '🔍' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{ ...s.tab, ...(activeTab === tab.id ? s.tabActive : {}) }}
              className="btn-press dash-tab"
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
                        <>
                          <div style={{ ...s.trendDot, background: diff >= 0 ? '#22c55e' : '#ef4444' }} />
                          <span style={{ color: diff >= 0 ? '#22c55e' : '#ef4444', fontWeight: '600', fontSize: '13px' }}>
                            {diff >= 0 ? '↑' : '↓'} {Math.abs(diff)} pts
                          </span>
                        </>
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

            <div style={s.twoCol} className="dash-two-col">
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
                      }} />
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

        {/* ── Skill Graph ── */}
        {activeTab === 'skills' && (
          <div className="fade-in">
            <div style={s.chartCard}>
              <div style={s.chartHeader}>
                <div>
                  <h3 style={s.chartTitle}>Skill Graph</h3>
                  <p style={s.chartSub}>Mastery per skill, updated after every session</p>
                </div>
              </div>
              <SkillGraph skillData={skillData} />
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
              <div style={s.sessionGrid} className="dash-session-grid">
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

                {/* Answers — now using AnswerBenchmark */}
                <div style={s.answersList}>
                  {selected.answers?.map((a, i) => (
                    <AnswerBenchmark key={i} answerData={a} index={i} />
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

const STAT_ACCENTS = {
  'Total sessions':  { color: '#c0c1ff', glow: 'rgba(192,193,255,0.15)' },
  'Completed':       { color: '#86efac', glow: 'rgba(134,239,172,0.12)' },
  'Answers given':   { color: '#7dd3fc', glow: 'rgba(125,211,252,0.12)' },
  'Average score':   { color: '#fde68a', glow: 'rgba(253,230,138,0.12)' },
  'Best score':      { color: '#ddb7ff', glow: 'rgba(221,183,255,0.12)' },
}

const s = {
  page: {
    minHeight: '100vh',
    width: '100%',
    overflowX: 'hidden',
    background: '#080810',
    backgroundImage: 'radial-gradient(circle at 50% -20%, rgba(73,75,214,0.15) 0%, transparent 50%)',
    color: '#e4e1ed',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
  },
  nav: {
    position: 'sticky', top: 0, zIndex: 50,
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '0 24px', height: '64px',
    background: 'rgba(8,8,16,0.8)', backdropFilter: 'blur(16px)',
    borderBottom: '1px solid rgba(255,255,255,0.05)',
    flexWrap: 'wrap', gap: '0.5rem',
  },
  navRight: { display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' },
  greeting: { color: 'rgba(228,225,237,0.4)', fontSize: '13px', fontWeight: '500' },
  navGhost: {
    background: 'transparent', border: 'none',
    color: 'rgba(228,225,237,0.4)', padding: '0.35rem 0.5rem',
    cursor: 'pointer', fontSize: '13px', fontWeight: '500',
    transition: 'color 0.15s', whiteSpace: 'nowrap',
  },
  navPrimary: {
    background: 'rgba(192,193,255,0.15)', color: '#c0c1ff',
    border: '1px solid rgba(192,193,255,0.25)',
    padding: '0.4rem 1rem', borderRadius: '9999px',
    cursor: 'pointer', fontSize: '13px', fontWeight: '600',
    whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '4px',
    boxShadow: '0 4px 16px rgba(192,193,255,0.1)',
    transition: 'all 0.15s',
  },
  content: { maxWidth: '1200px', margin: '0 auto', padding: '2rem 24px' },

  // Dashboard header
  dashHeader: { marginBottom: '2rem' },
  dashTitle: { fontSize: '28px', fontWeight: '700', color: '#fff', marginBottom: '4px', fontFamily: "'Geist', sans-serif", letterSpacing: '-0.02em' },
  dashSub: { color: 'rgba(199,196,215,0.6)', fontSize: '15px' },

  // Stat cards
  statsRow: { display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px', marginBottom: '1.5rem' },
  statCard: {
    background: 'rgba(27,27,35,0.4)', backdropFilter: 'blur(12px)',
    border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px',
    padding: '1.25rem 0.75rem', textAlign: 'center',
    transition: 'all 0.3s',
  },
  statIcon:   { fontSize: '18px', marginBottom: '0.5rem', opacity: 0.6 },
  statValue:  { fontSize: '36px', fontWeight: '800', lineHeight: 1, marginBottom: '2px', fontFamily: "'Geist', sans-serif", letterSpacing: '-0.04em' },
  statSuffix: { fontSize: '14px', fontWeight: '400', opacity: 0.4 },
  statLabel:  { fontSize: '11px', color: 'rgba(199,196,215,0.5)', marginTop: '4px', fontWeight: '600', letterSpacing: '0.03em' },

  // Pill tab bar
  tabBar: {
    display: 'flex', gap: '3px', marginBottom: '1.5rem',
    background: 'rgba(13,13,21,0.5)', border: '1px solid rgba(255,255,255,0.05)',
    borderRadius: '9999px', padding: '4px', width: 'fit-content',
    overflowX: 'hidden', overflowY: 'hidden',
  },
  tab: {
    display: 'flex', alignItems: 'center', gap: '0.3rem',
    background: 'transparent', border: 'none',
    color: 'rgba(199,196,215,0.4)', padding: '0.45rem 1.25rem',
    cursor: 'pointer', fontSize: '13px', fontWeight: '600',
    borderRadius: '9999px', transition: 'all 0.2s',
    whiteSpace: 'nowrap', flexShrink: 0,
  },
  tabActive: {
    background: 'rgba(192,193,255,0.1)',
    border: '1px solid rgba(192,193,255,0.2)',
    color: '#c0c1ff',
  },

  // Cards
  chartCard: {
    background: 'rgba(27,27,35,0.4)', backdropFilter: 'blur(12px)',
    border: '1px solid rgba(255,255,255,0.06)', borderRadius: '20px',
    padding: '1.5rem', marginBottom: '1rem',
    transition: 'border-color 0.3s',
  },
  chartHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' },
  chartTitle:  { fontSize: '18px', fontWeight: '600', color: '#fff', marginBottom: '3px', fontFamily: "'Geist', sans-serif", letterSpacing: '-0.01em' },
  chartSub:    { fontSize: '12px', color: 'rgba(199,196,215,0.4)', fontWeight: '600', letterSpacing: '0.03em' },
  trendBadge:  {
    display: 'flex', alignItems: 'center', gap: '6px',
    background: 'rgba(192,193,255,0.08)', border: '1px solid rgba(192,193,255,0.15)',
    borderRadius: '9999px', padding: '4px 12px',
  },
  trendDot: { width: '6px', height: '6px', borderRadius: '50%', background: '#22c55e' },
  emptyChart: {
    background: 'rgba(27,27,35,0.4)', border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: '20px', padding: '2.5rem 1rem', textAlign: 'center', marginBottom: '1rem',
  },
  twoCol: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' },

  weakRow:     { marginBottom: '1rem' },
  weakMeta:    { display: 'flex', justifyContent: 'space-between', marginBottom: '6px', alignItems: 'center' },
  weakBarBg:   { height: '4px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', overflow: 'hidden' },
  weakBarFill: { height: '100%', borderRadius: '2px', transition: 'width 0.5s ease' },

  historyHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' },
  sectionTitle:  { fontSize: '18px', fontWeight: '600', color: '#fff', fontFamily: "'Geist', sans-serif", letterSpacing: '-0.01em' },
  emptyState:    { textAlign: 'center', padding: '3rem 1rem' },

  sessionGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '0.75rem' },
  sessionCard: {
    background: 'rgba(27,27,35,0.4)', backdropFilter: 'blur(12px)',
    border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px',
    padding: '1rem', cursor: 'pointer',
    transition: 'border-color 0.2s, transform 0.15s, box-shadow 0.2s',
  },
  sessionCardTop: { display: 'flex', gap: '0.75rem', marginBottom: '0.75rem' },
  sessionLeft:    { flexShrink: 0 },
  sessionRight:   { flex: 1, minWidth: 0 },
  sessionRole:    { fontSize: '14px', fontWeight: '700', color: '#fff', marginBottom: '0.2rem', fontFamily: "'Geist', sans-serif", letterSpacing: '-0.01em' },
  sessionMeta:    { display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '11px', marginBottom: '0.4rem', flexWrap: 'wrap' },
  metaDot:        { color: 'rgba(255,255,255,0.15)' },
  sessionFooter:  { borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.6rem' },

  topicTags: { display: 'flex', gap: '4px', flexWrap: 'wrap' },
  topicTag:  { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '4px', padding: '2px 6px', fontSize: '10px', color: 'rgba(199,196,215,0.4)', fontWeight: '600', letterSpacing: '0.03em' },

  detailHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
    marginBottom: '1.25rem',
    background: 'rgba(27,27,35,0.4)', backdropFilter: 'blur(12px)',
    border: '1px solid rgba(255,255,255,0.06)', borderRadius: '20px',
    padding: '1.25rem', flexWrap: 'wrap', gap: '1rem',
  },
  detailLeft:      { flex: 1, minWidth: '200px' },
  detailRole:      { fontSize: '20px', fontWeight: '700', marginBottom: '0.4rem', fontFamily: "'Geist', sans-serif", letterSpacing: '-0.02em' },
  detailMeta:      { display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap', fontSize: '12px' },
  detailScoreWrap: { flexShrink: 0 },

  answersList: { display: 'flex', flexDirection: 'column', gap: '0.75rem' },
  answerCard:  {
    background: 'rgba(27,27,35,0.4)', backdropFilter: 'blur(12px)',
    border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px',
    padding: '1.25rem',
  },
  answerHeader:     { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.875rem' },
  answerHeaderLeft: { display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' },
  answerQ:          { fontSize: '11px', color: 'rgba(199,196,215,0.3)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em' },
  answerQuestion:   { fontSize: '14px', color: 'rgba(228,225,237,0.5)', marginBottom: '0.875rem', lineHeight: '1.5' },
  answerTranscript: { fontSize: '13px', color: '#e4e1ed', lineHeight: '1.7', marginBottom: '0.875rem' },

  reasoningBox: { background: 'rgba(8,8,16,0.6)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '12px', padding: '0.875rem', marginBottom: '0.875rem' },
  conceptsRow:  { display: 'flex', gap: '1rem', marginBottom: '0.875rem', flexWrap: 'wrap' },
  conceptGroup: { display: 'flex', flexDirection: 'column', gap: '5px' },
  tagWrap:      { display: 'flex', flexWrap: 'wrap', gap: '4px' },
  tagGreen:     { background: '#0f2a1a', border: '1px solid rgba(34,197,94,0.3)',  color: '#86efac', fontSize: '11px', padding: '2px 7px', borderRadius: '4px' },
  tagRed:       { background: '#2a0f0f', border: '1px solid rgba(239,68,68,0.3)',  color: '#fca5a5', fontSize: '11px', padding: '2px 7px', borderRadius: '4px' },

  answerStats: { display: 'flex', gap: '0.4rem', flexWrap: 'wrap' },
  statPill:    { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(199,196,215,0.5)', fontSize: '11px', padding: '3px 9px', borderRadius: '20px', fontWeight: '600' },

  primaryBtn: {
    background: 'rgba(192,193,255,0.15)', color: '#c0c1ff',
    border: '1px solid rgba(192,193,255,0.25)',
    borderRadius: '9999px', padding: '0.65rem 1.5rem',
    fontSize: '13px', fontWeight: '600', cursor: 'pointer',
    transition: 'all 0.15s', boxShadow: '0 4px 16px rgba(192,193,255,0.1)',
  },
  spinner: { width: '44px', height: '44px', border: '3px solid rgba(192,193,255,0.1)', borderTop: '3px solid #c0c1ff', borderRadius: '50%', animation: 'spin 0.9s linear infinite' },
  muted:   { color: 'rgba(199,196,215,0.35)', fontSize: '12px' },
}