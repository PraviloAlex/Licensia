import type { ExamAttempt } from "../lib/examHistory";
import { t, type UILang } from "../lib/i18n";

type Props = {
  attempts: ExamAttempt[];
  passPercent: number;
  lang: UILang;
};

const VIEW_W = 320;
const VIEW_H = 120;
const PAD_X = 10;
const PAD_Y = 12;
const MAX_POINTS = 12;

/** Mock-exam score evolution: a simple SVG line of recent attempts with a pass-threshold guide. */
export function EvolutionChart({ attempts, passPercent, lang }: Props) {
  const pts = attempts.slice(-MAX_POINTS);
  const n = pts.length;
  const innerW = VIEW_W - PAD_X * 2;
  const innerH = VIEW_H - PAD_Y * 2;

  const xAt = (i: number) => (n <= 1 ? PAD_X + innerW / 2 : PAD_X + (i / (n - 1)) * innerW);
  const yAt = (pct: number) => PAD_Y + (1 - Math.max(0, Math.min(100, pct)) / 100) * innerH;

  const linePath = pts
    .map((p, i) => `${i === 0 ? "M" : "L"}${xAt(i).toFixed(1)} ${yAt(p.pct).toFixed(1)}`)
    .join(" ");
  const passY = yAt(passPercent).toFixed(1);

  return (
    <div className="pg-chart">
      <svg
        className="pg-chart-svg"
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        role="img"
        aria-label={t("progress.evolution.aria", lang)}
      >
        <line
          className="pg-chart-pass"
          x1={PAD_X}
          y1={passY}
          x2={VIEW_W - PAD_X}
          y2={passY}
          strokeDasharray="4 4"
        />
        {n > 1 && <path className="pg-chart-line" d={linePath} fill="none" />}
        {pts.map((p, i) => (
          <circle
            key={`${p.date}-${i}`}
            className={p.pct >= passPercent ? "pg-chart-dot pg-chart-dot--pass" : "pg-chart-dot"}
            cx={xAt(i)}
            cy={yAt(p.pct)}
            r={3.5}
          />
        ))}
      </svg>
      <div className="pg-chart-legend">
        <span>{pts[0]?.pct}%</span>
        <span className="pg-chart-pass-label">
          {t("progress.evolution.pass", lang)} {passPercent}%
        </span>
        <span>{pts[n - 1]?.pct}%</span>
      </div>
    </div>
  );
}
