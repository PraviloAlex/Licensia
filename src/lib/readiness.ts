import { getExamAttempts } from "./examHistory";
import { getQuestionProgressMap } from "./questionProgress";
import { EXAM_PASS_PERCENT } from "../constants/exam";

export type PassBasis = "exams" | "practice" | "none";

export type PassProbabilityLabelKey =
  | "prob.lvl.ready"
  | "prob.lvl.close"
  | "prob.lvl.building"
  | "prob.lvl.low"
  | "prob.lvl.none";

export type PassProbability = {
  /** 0–100. Recency-weighted mock score, or practice-accuracy estimate. */
  pct: number;
  labelKey: PassProbabilityLabelKey;
  /** Theme token for the ring/label colour. */
  color: string;
  /** Where the number comes from — surface honestly in UI, never fake a mock estimate. */
  basis: PassBasis;
};

// Most-recent-first weights: the latest attempts dominate the estimate.
const RECENCY_WEIGHTS = [0.5, 0.3, 0.2];

function bucket(pct: number, basis: PassBasis): PassProbability {
  if (pct >= EXAM_PASS_PERCENT) return { pct, basis, labelKey: "prob.lvl.ready", color: "var(--green)" };
  if (pct >= 60) return { pct, basis, labelKey: "prob.lvl.close", color: "var(--accent)" };
  if (pct >= 35) return { pct, basis, labelKey: "prob.lvl.building", color: "var(--gold)" };
  return { pct, basis, labelKey: "prob.lvl.low", color: "var(--red)" };
}

/**
 * Estimated probability of passing the real exam.
 * Prefers recency-weighted mock-exam history; degrades honestly to a practice-accuracy
 * estimate (basis "practice") and to zero (basis "none") when there is no data.
 */
export function getPassProbability(): PassProbability {
  const attempts = getExamAttempts();

  if (attempts.length > 0) {
    const recent = attempts.slice(-RECENCY_WEIGHTS.length).reverse(); // most recent first
    let weighted = 0;
    let weightSum = 0;
    recent.forEach((attempt, i) => {
      const w = RECENCY_WEIGHTS[i];
      weighted += attempt.pct * w;
      weightSum += w;
    });
    const pct = weightSum > 0 ? Math.round(weighted / weightSum) : 0;
    return bucket(pct, "exams");
  }

  const progress = Object.values(getQuestionProgressMap());
  const correct = progress.reduce((sum, p) => sum + p.correctCount, 0);
  const wrong = progress.reduce((sum, p) => sum + p.wrongCount, 0);
  const answered = correct + wrong;
  if (answered === 0) {
    return { pct: 0, basis: "none", labelKey: "prob.lvl.none", color: "var(--s-text-muted)" };
  }

  const pct = Math.round((correct / answered) * 100);
  return bucket(pct, "practice");
}
