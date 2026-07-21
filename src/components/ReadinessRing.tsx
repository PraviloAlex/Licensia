/** Exam-readiness ring. Shared by HomePage hero and ProgressPage hero. */
export function ReadinessRing({ score, color, caption }: { score: number; color: string; caption: string }) {
  const r = 50;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, score));
  return (
    <div className="hb-ring" role="img" aria-label={`${clamped}%`}>
      <svg viewBox="0 0 120 120" aria-hidden="true">
        <circle className="hb-ring-track" cx="60" cy="60" r={r} strokeWidth="11" fill="none" />
        <circle cx="60" cy="60" r={r} stroke={color} strokeWidth="11" fill="none" strokeLinecap="round"
          strokeDasharray={`${(clamped / 100) * c} ${c}`} transform="rotate(-90 60 60)" />
      </svg>
      <div className="hb-ring-center">
        <span className="hb-ring-pct">{clamped}%</span>
        <span className="hb-ring-word">{caption}</span>
      </div>
    </div>
  );
}
