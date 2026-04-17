// components/AnswerBenchmark.jsx
// Shows Your Answer vs Ideal Answer with concept gap analysis
// Used in the post-interview evaluation view

import { useState } from "react";

function ConceptTag({ label, type }) {
  const styles = {
    covered:  { bg: "rgba(34,197,94,0.12)",  border: "rgba(34,197,94,0.35)",  color: "#4ade80",  icon: "✓" },
    missing:  { bg: "rgba(239,68,68,0.12)",  border: "rgba(239,68,68,0.35)",  color: "#f87171",  icon: "✗" },
    extra:    { bg: "rgba(99,102,241,0.12)", border: "rgba(99,102,241,0.35)", color: "#a5b4fc",  icon: "+" },
  };
  const s = styles[type] || styles.extra;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "3px 9px", borderRadius: 20, fontSize: 11, fontWeight: 600,
      background: s.bg, border: `1px solid ${s.border}`, color: s.color,
      margin: "0 4px 4px 0",
    }}>
      <span style={{ opacity: 0.7 }}>{s.icon}</span>
      {label}
    </span>
  );
}

function SimilarityMeter({ value }) {
  const color = value >= 70 ? "#4ade80" : value >= 45 ? "#fbbf24" : "#f87171";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{
        flex: 1, height: 6, background: "rgba(255,255,255,0.06)",
        borderRadius: 3, overflow: "hidden",
      }}>
        <div style={{
          height: "100%", width: `${value}%`,
          background: color, borderRadius: 3,
          transition: "width 1s cubic-bezier(0.34,1.56,0.64,1) 0.3s",
        }} />
      </div>
      <span style={{ fontSize: 13, fontWeight: 700, color, minWidth: 36 }}>{value}%</span>
      <span style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>similarity to ideal</span>
    </div>
  );
}

function RubricBadge({ score }) {
  const bands = [
    { min: 90, label: "Excellent", color: "#4ade80" },
    { min: 70, label: "Good",      color: "#a3e635" },
    { min: 50, label: "Fair",      color: "#fbbf24" },
    { min: 0,  label: "Poor",      color: "#f87171" },
  ];
  const band = bands.find(b => score >= b.min) || bands[bands.length - 1];
  return (
    <span style={{
      display: "inline-block", padding: "2px 10px",
      borderRadius: 4, fontSize: 11, fontWeight: 700,
      background: `${band.color}20`, color: band.color,
      border: `1px solid ${band.color}40`,
      textTransform: "uppercase", letterSpacing: "0.08em",
    }}>
      {band.label}
    </span>
  );
}

function AnswerPanel({ title, text, accentColor, badge }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = text?.length > 300;
  const displayText = isLong && !expanded ? `${text.slice(0, 300)}…` : text;

  return (
    <div style={{
      borderRadius: 10,
      border: `1px solid ${accentColor}25`,
      overflow: "hidden",
    }}>
      <div style={{
        padding: "10px 14px",
        background: `${accentColor}12`,
        display: "flex", justifyContent: "space-between", alignItems: "center",
        borderBottom: `1px solid ${accentColor}15`,
      }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: accentColor, textTransform: "uppercase", letterSpacing: "0.1em" }}>
          {title}
        </span>
        {badge}
      </div>
      <div style={{
        padding: "12px 14px",
        fontSize: 13, lineHeight: 1.7, color: "rgba(255,255,255,0.75)",
      }}>
        {displayText || <span style={{ color: "rgba(255,255,255,0.2)", fontStyle: "italic" }}>No answer recorded.</span>}
        {isLong && (
          <button
            onClick={() => setExpanded(!expanded)}
            style={{
              marginLeft: 8, fontSize: 11, color: accentColor,
              background: "none", border: "none", cursor: "pointer", padding: 0,
            }}
          >
            {expanded ? "Show less" : "Read more"}
          </button>
        )}
      </div>
    </div>
  );
}

export default function AnswerBenchmark({ answerData, questionNumber }) {
  const [showIdeal, setShowIdeal] = useState(false);

  if (!answerData) return null;

  const {
    question_text,
    stt_corrected_transcript,
    answer_text,
    ideal_answer,
    key_concepts = [],
    scoring_rubric,
    common_mistakes = [],
    comparison = {},
    score,
    matched_keywords = [],
    missing_keywords = [],
    penalties_applied = [],
    structure_flags = {},
    keyword_score,
    structure_score,
    word_count,
    wpm,
  } = answerData;

  const candidateText = stt_corrected_transcript || answer_text || "";
  const {
    covered_concepts = [],
    missing_concepts = [],
    extra_concepts = [],
    comparison_feedback = "",
    improvement_tip = "",
    similarity_score = 0,
  } = comparison;

  return (
    <div style={{
      background: "rgba(255,255,255,0.025)",
      border: "1px solid rgba(255,255,255,0.07)",
      borderRadius: 14,
      overflow: "hidden",
      fontFamily: "'DM Mono', 'Fira Code', monospace",
    }}>
      {/* Question header */}
      <div style={{
        padding: "14px 18px",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12,
      }}>
        <div>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>
            Q{questionNumber}
          </div>
          <div style={{ fontSize: 14, color: "rgba(255,255,255,0.85)", lineHeight: 1.5 }}>
            {question_text}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: score >= 70 ? "#4ade80" : score >= 50 ? "#fbbf24" : "#f87171", fontVariantNumeric: "tabular-nums" }}>
            {Math.round(score)}
          </div>
          <RubricBadge score={score} />
        </div>
      </div>

      <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 14 }}>

        {/* Quick stats row */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {[
            { label: "Keywords", value: `${Math.round(keyword_score || 0)}%`, ok: keyword_score >= 60 },
            { label: "Structure", value: `${Math.round(structure_score || 0)}%`, ok: structure_score >= 60 },
            { label: "Words", value: word_count, ok: word_count >= 60 },
            wpm > 0 && { label: "WPM", value: Math.round(wpm), ok: wpm >= 100 && wpm <= 180 },
          ].filter(Boolean).map(s => (
            <div key={s.label} style={{
              padding: "6px 12px", borderRadius: 8, fontSize: 12,
              background: s.ok ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)",
              border: `1px solid ${s.ok ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)"}`,
              color: s.ok ? "#86efac" : "#fca5a5",
            }}>
              <span style={{ opacity: 0.6 }}>{s.label}: </span>
              <span style={{ fontWeight: 700 }}>{s.value}</span>
            </div>
          ))}
        </div>

        {/* Similarity meter */}
        <SimilarityMeter value={similarity_score} />

        {/* Concept coverage */}
        {(covered_concepts.length > 0 || missing_concepts.length > 0 || extra_concepts.length > 0) && (
          <div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>
              Concept Coverage
            </div>
            <div>
              {covered_concepts.map(c => <ConceptTag key={c} label={c} type="covered" />)}
              {missing_concepts.map(c => <ConceptTag key={c} label={c} type="missing" />)}
              {extra_concepts.map(c => <ConceptTag key={c} label={c} type="extra" />)}
            </div>
          </div>
        )}

        {/* Penalties */}
        {penalties_applied.length > 0 && (
          <div style={{
            padding: "10px 12px", borderRadius: 8,
            background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)",
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#f87171", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Penalties Applied
            </div>
            {penalties_applied.map((p, i) => (
              <div key={i} style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", marginBottom: 2 }}>
                — {p}
              </div>
            ))}
          </div>
        )}

        {/* Feedback & tip */}
        {comparison_feedback && (
          <div style={{
            padding: "10px 12px", borderRadius: 8,
            background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.2)",
          }}>
            <p style={{ margin: "0 0 6px", fontSize: 13, color: "rgba(255,255,255,0.7)", lineHeight: 1.6 }}>
              {comparison_feedback}
            </p>
            {improvement_tip && (
              <div style={{ display: "flex", gap: 8, alignItems: "flex-start", marginTop: 8 }}>
                <span style={{ fontSize: 14 }}>💡</span>
                <p style={{ margin: 0, fontSize: 12, color: "#a5b4fc", lineHeight: 1.5 }}>
                  {improvement_tip}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Answer panels */}
        <AnswerPanel
          title="Your Answer"
          text={candidateText}
          accentColor="#38bdf8"
        />

        {ideal_answer && (
          <div>
            <button
              onClick={() => setShowIdeal(!showIdeal)}
              style={{
                width: "100%", padding: "9px", borderRadius: 8,
                background: showIdeal ? "rgba(251,191,36,0.08)" : "rgba(255,255,255,0.03)",
                border: `1px solid ${showIdeal ? "rgba(251,191,36,0.3)" : "rgba(255,255,255,0.08)"}`,
                color: showIdeal ? "#fbbf24" : "rgba(255,255,255,0.4)",
                fontSize: 12, fontWeight: 600, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                transition: "all 0.2s",
              }}
            >
              <span>{showIdeal ? "▲" : "▼"}</span>
              {showIdeal ? "Hide" : "Show"} Ideal Answer
            </button>
            {showIdeal && (
              <div style={{ marginTop: 10 }}>
                <AnswerPanel
                  title="Ideal Answer"
                  text={ideal_answer}
                  accentColor="#fbbf24"
                />

                {/* Key concepts expected */}
                {key_concepts.length > 0 && (
                  <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 4 }}>
                    <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", alignSelf: "center", marginRight: 4 }}>
                      Must cover:
                    </span>
                    {key_concepts.map(c => (
                      <span key={c} style={{
                        padding: "3px 8px", borderRadius: 4, fontSize: 11,
                        background: "rgba(251,191,36,0.08)", color: "#fcd34d",
                        border: "1px solid rgba(251,191,36,0.2)",
                      }}>{c}</span>
                    ))}
                  </div>
                )}

                {/* Common mistakes */}
                {common_mistakes.length > 0 && (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                      Common Mistakes
                    </div>
                    {common_mistakes.map((m, i) => (
                      <div key={i} style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", marginBottom: 4 }}>
                        ⚠ {m}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
