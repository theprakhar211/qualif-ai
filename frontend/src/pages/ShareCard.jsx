import { useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";
import html2canvas from "html2canvas";
import { getShare } from "../services/api";

const GRADE_COLORS = {
  "A+": "#22c55e", A: "#22c55e", "A-": "#22c55e",
  "B+": "#3b82f6", B: "#3b82f6", "B-": "#3b82f6",
  "C+": "#f59e0b", C: "#f59e0b", "C-": "#f59e0b",
  D: "#ef4444", F: "#ef4444",
};

function getGrade(score) {
  if (score >= 90) return "A+";
  if (score >= 85) return "A";
  if (score >= 80) return "A-";
  if (score >= 75) return "B+";
  if (score >= 70) return "B";
  if (score >= 65) return "B-";
  if (score >= 60) return "C+";
  if (score >= 55) return "C";
  if (score >= 50) return "C-";
  if (score >= 40) return "D";
  return "F";
}

export default function ShareCard() {
  const { shareId } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [copying, setCopying] = useState(false);
  const cardRef = useRef(null);

  useEffect(() => {
    getShare(shareId)
      .then(res => setData(res.data))
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [shareId]);

  const handleDownload = async () => {
    if (!cardRef.current) return;
    const canvas = await html2canvas(cardRef.current, {
      backgroundColor: "#030308",
      scale: 2,
      useCORS: true,
    });
    const link = document.createElement("a");
    link.download = `qualifai-result-${shareId}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(window.location.href);
    setCopying(true);
    setTimeout(() => setCopying(false), 2000);
  };

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#030308", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ color: "#94a3b8", fontFamily: "Inter, sans-serif" }}>Loading result...</div>
    </div>
  );

  if (notFound) return (
    <div style={{ minHeight: "100vh", background: "#030308", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ color: "#94a3b8", fontFamily: "Inter, sans-serif" }}>This share link has expired or doesn't exist.</div>
    </div>
  );

  const grade = getGrade(data.overall_score);
  const gradeColor = GRADE_COLORS[grade] || "#3b82f6";
  const maxTopic = Math.max(...data.topic_scores.map(t => t.score), 1);

  return (
    <div style={{ minHeight: "100vh", background: "#030308", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "2rem 1rem", fontFamily: "Inter, sans-serif" }}>

      {/* The card — this is what gets captured as PNG */}
      <div ref={cardRef} style={{
        width: 480,
        background: "linear-gradient(135deg, #0f1120 0%, #0a0e1a 100%)",
        border: "1px solid rgba(37,99,235,0.3)",
        borderRadius: 20,
        padding: "2rem",
        boxShadow: "0 0 60px rgba(37,99,235,0.1)",
      }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem" }}>
          <div>
            <div style={{ fontSize: 11, color: "#2563eb", letterSpacing: "0.12em", fontWeight: 600, textTransform: "uppercase", marginBottom: 4 }}>Qualif-AI</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#f1f5f9", fontFamily: "Geist, Inter, sans-serif" }}>Interview Result</div>
          </div>
          {/* Score ring */}
          <div style={{ position: "relative", width: 72, height: 72 }}>
            <svg width="72" height="72" viewBox="0 0 72 72">
              <circle cx="36" cy="36" r="30" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="6" />
              <circle cx="36" cy="36" r="30" fill="none" stroke={gradeColor} strokeWidth="6"
                strokeDasharray={`${(data.overall_score / 100) * 188.5} 188.5`}
                strokeLinecap="round"
                transform="rotate(-90 36 36)" />
            </svg>
            <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: "#f1f5f9", lineHeight: 1, fontFamily: "Geist, sans-serif" }}>{Math.round(data.overall_score)}</span>
              <span style={{ fontSize: 10, color: "#64748b" }}>/100</span>
            </div>
          </div>
        </div>

        {/* Role + difficulty + grade pills */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: "1.5rem" }}>
          <span style={{ background: "rgba(37,99,235,0.15)", color: "#93c5fd", border: "1px solid rgba(37,99,235,0.25)", borderRadius: 99, padding: "4px 12px", fontSize: 12, fontWeight: 500 }}>
            {data.role}
          </span>
          <span style={{ background: "rgba(255,255,255,0.06)", color: "#94a3b8", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 99, padding: "4px 12px", fontSize: 12 }}>
            {data.difficulty}
          </span>
          <span style={{ background: `${gradeColor}18`, color: gradeColor, border: `1px solid ${gradeColor}40`, borderRadius: 99, padding: "4px 12px", fontSize: 12, fontWeight: 700 }}>
            Grade {grade}
          </span>
          <span style={{ background: "rgba(255,255,255,0.04)", color: "#64748b", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 99, padding: "4px 12px", fontSize: 12 }}>
            {data.total_questions}Q · {data.interview_type}
          </span>
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: "rgba(255,255,255,0.06)", marginBottom: "1.25rem" }} />

        {/* Topic breakdown */}
        <div style={{ marginBottom: "1.5rem" }}>
          <div style={{ fontSize: 11, color: "#64748b", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "0.75rem" }}>Topic breakdown</div>
          {data.topic_scores.map((t) => (
            <div key={t.topic} style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontSize: 12, color: "#cbd5e1" }}>{t.topic}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: t.score >= 70 ? "#22c55e" : t.score >= 50 ? "#f59e0b" : "#ef4444" }}>{Math.round(t.score)}%</span>
              </div>
              <div style={{ height: 4, background: "rgba(255,255,255,0.07)", borderRadius: 99 }}>
                <div style={{
                  height: 4, borderRadius: 99,
                  width: `${(t.score / maxTopic) * 100}%`,
                  background: t.score >= 70 ? "#22c55e" : t.score >= 50 ? "#f59e0b" : "#ef4444",
                  transition: "width 0.5s ease"
                }} />
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 11, color: "#334155" }}>qualif-smart-ai.vercel.app</span>
          <span style={{ fontSize: 11, color: "#334155" }}>AI-powered mock interviews</span>
        </div>
      </div>

      {/* Action buttons — outside card so they don't appear in PNG */}
      <div style={{ display: "flex", gap: 12, marginTop: "1.5rem" }}>
        <button onClick={handleCopyLink} style={{
          background: copying ? "rgba(34,197,94,0.15)" : "rgba(37,99,235,0.15)",
          color: copying ? "#22c55e" : "#93c5fd",
          border: `1px solid ${copying ? "rgba(34,197,94,0.3)" : "rgba(37,99,235,0.3)"}`,
          borderRadius: 99, padding: "10px 20px", fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "Inter, sans-serif"
        }}>
          {copying ? "✓ Link copied!" : "Copy link"}
        </button>
        <button onClick={handleDownload} style={{
          background: "#2563eb", color: "#fff",
          border: "none", borderRadius: 99, padding: "10px 20px",
          fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "Inter, sans-serif"
        }}>
          Download PNG
        </button>
      </div>

      <div style={{ marginTop: "1rem", fontSize: 12, color: "#334155" }}>
        Practice at <a href="https://qualif-smart-ai.vercel.app" style={{ color: "#2563eb" }}>qualif-smart-ai.vercel.app</a>
      </div>
    </div>
  );
}