// components/SkillGraph.jsx
// Skill mastery visualization for the Qualif-AI dashboard
// Hexagonal radar for categories + drill-down bar chart per skill

import { useState, useEffect } from "react";

const CATEGORY_COLORS = {
  "Data Structures": { bg: "#1e3a5f", accent: "#38bdf8", bar: "#0ea5e9" },
  "Algorithms":      { bg: "#1e3d2f", accent: "#4ade80", bar: "#22c55e" },
  "System Design":   { bg: "#3d1e3a", accent: "#c084fc", bar: "#a855f7" },
  "Languages":       { bg: "#3d2e1e", accent: "#fb923c", bar: "#f97316" },
  "Concepts":        { bg: "#1e3d3d", accent: "#2dd4bf", bar: "#14b8a6" },
  "Communication":   { bg: "#3d3d1e", accent: "#facc15", bar: "#eab308" },
  "Behavioural":     { bg: "#3d1e1e", accent: "#f87171", bar: "#ef4444" },
};

function MasteryRing({ value, size = 60, color = "#38bdf8", label }) {
  const r = (size - 8) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (value / 100) * circumference;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={5} />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke={color} strokeWidth={5}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.8s cubic-bezier(0.34,1.56,0.64,1)" }}
        />
      </svg>
      <span style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
        {label}
      </span>
    </div>
  );
}

function SkillBar({ name, mastery, attempts, color, isTarget }) {
  return (
    <div style={{
      padding: "10px 12px",
      borderRadius: 8,
      background: isTarget ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.02)",
      border: isTarget ? `1px solid ${color}40` : "1px solid transparent",
      transition: "all 0.2s",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {isTarget && (
            <span style={{
              fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", color,
              background: `${color}20`, padding: "2px 6px", borderRadius: 3, textTransform: "uppercase"
            }}>TARGET</span>
          )}
          <span style={{ fontSize: 13, color: "rgba(255,255,255,0.85)", fontFamily: "monospace" }}>{name}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>{attempts} attempt{attempts !== 1 ? "s" : ""}</span>
          <span style={{ fontSize: 14, fontWeight: 700, color, fontVariantNumeric: "tabular-nums" }}>
            {mastery != null ? `${Math.round(mastery)}%` : "—"}
          </span>
        </div>
      </div>
      <div style={{ height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 2, overflow: "hidden" }}>
        <div style={{
          height: "100%", width: mastery != null ? `${mastery}%` : "0%",
          background: mastery >= 70 ? color : mastery >= 40 ? `${color}cc` : `${color}80`,
          borderRadius: 2,
          transition: "width 0.8s cubic-bezier(0.34,1.56,0.64,1)",
        }} />
      </div>
    </div>
  );
}

function CategoryCard({ category, data, colors, targetSkill, onClick, isExpanded }) {
  const mastery = data.mastery;
  const skillCount = Object.keys(data.skills || {}).length;

  return (
    <div
      onClick={onClick}
      style={{
        background: `${colors.bg}cc`,
        border: `1px solid ${colors.accent}25`,
        borderRadius: 12,
        padding: "16px",
        cursor: "pointer",
        transition: "all 0.2s",
        boxShadow: isExpanded ? `0 0 0 2px ${colors.accent}60` : "none",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.9)", marginBottom: 2 }}>{category}</div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>
            {skillCount > 0 ? `${skillCount} skill${skillCount !== 1 ? "s" : ""} practiced` : "Not started"}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: colors.accent, fontVariantNumeric: "tabular-nums" }}>
            {mastery != null ? `${Math.round(mastery)}%` : "—"}
          </div>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
            mastery
          </div>
        </div>
      </div>

      {/* Thin mastery bar */}
      <div style={{ height: 3, background: "rgba(255,255,255,0.06)", borderRadius: 2, overflow: "hidden" }}>
        <div style={{
          height: "100%", width: mastery != null ? `${mastery}%` : "0%",
          background: colors.bar,
          borderRadius: 2,
          transition: "width 0.8s ease",
        }} />
      </div>

      {/* Expanded skill drilldown */}
      {isExpanded && skillCount > 0 && (
        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
          {Object.entries(data.skills).map(([skillName, skillData]) => (
            <SkillBar
              key={skillName}
              name={skillName}
              mastery={skillData.mastery}
              attempts={skillData.attempts}
              color={colors.accent}
              isTarget={skillName === targetSkill}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function SkillGraph({ skillData }) {
  const [expanded, setExpanded] = useState(null);

  if (!skillData) {
    return (
      <div style={{ textAlign: "center", padding: "40px 0", color: "rgba(255,255,255,0.3)", fontSize: 14 }}>
        Complete an interview to build your skill profile.
      </div>
    );
  }

  const { category_breakdown = {}, weakest_skills = [], target_skill } = skillData;
  const categories = Object.entries(category_breakdown);
  const hasPracticed = categories.some(([, d]) => d.mastery != null);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Header row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "rgba(255,255,255,0.9)" }}>
            Skill Graph
          </h3>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: "rgba(255,255,255,0.4)" }}>
            Click a category to see individual skills
          </p>
        </div>
        {target_skill && (
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.3)",
            padding: "6px 12px", borderRadius: 8,
          }}>
            <span style={{ fontSize: 14 }}>🎯</span>
            <div>
              <div style={{ fontSize: 10, color: "rgba(251,191,36,0.7)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                Next target
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#fbbf24" }}>{target_skill}</div>
            </div>
          </div>
        )}
      </div>

      {/* Weakest skills strip */}
      {weakest_skills.length > 0 && (
        <div style={{
          display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4,
        }}>
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", whiteSpace: "nowrap", alignSelf: "center" }}>
            Weak areas:
          </span>
          {weakest_skills.map((skill, i) => (
            <span key={skill} style={{
              padding: "4px 10px",
              borderRadius: 20,
              fontSize: 11,
              fontWeight: 600,
              background: i === 0 ? "rgba(239,68,68,0.15)" : "rgba(255,255,255,0.05)",
              color: i === 0 ? "#f87171" : "rgba(255,255,255,0.5)",
              border: i === 0 ? "1px solid rgba(239,68,68,0.3)" : "1px solid rgba(255,255,255,0.08)",
              whiteSpace: "nowrap",
            }}>
              {skill}
            </span>
          ))}
        </div>
      )}

      {/* Category grid */}
      {!hasPracticed ? (
        <div style={{
          padding: "32px 0", textAlign: "center",
          color: "rgba(255,255,255,0.25)", fontSize: 13,
        }}>
          No skills recorded yet — complete a practice session to start building your graph.
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 10 }}>
          {categories
            .filter(([, d]) => d.mastery != null)
            .sort((a, b) => a[1].mastery - b[1].mastery)
            .map(([category, data]) => {
              const colors = CATEGORY_COLORS[category] || { bg: "#1e2a3a", accent: "#64748b", bar: "#64748b" };
              return (
                <CategoryCard
                  key={category}
                  category={category}
                  data={data}
                  colors={colors}
                  targetSkill={target_skill}
                  isExpanded={expanded === category}
                  onClick={() => setExpanded(expanded === category ? null : category)}
                />
              );
            })}
        </div>
      )}
    </div>
  );
}
