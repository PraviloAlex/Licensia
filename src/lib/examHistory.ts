import { readJson, writeJson } from "./storage";

export const EXAM_ATTEMPTS_KEY = "exam_attempts_v1";
const MAX_ATTEMPTS = 50;

/** One recorded mock-exam attempt. Series feeds pass-probability (readiness) and the evolution chart. */
export type ExamAttempt = {
  pct: number;
  correct: number;
  total: number;
  date: string;
};

function sanitizeAttempt(value: unknown): ExamAttempt | null {
  if (!value || typeof value !== "object") return null;
  const rec = value as Partial<ExamAttempt>;
  const correct = Number.isFinite(rec.correct) ? Number(rec.correct) : null;
  const total = Number.isFinite(rec.total) ? Number(rec.total) : null;
  if (correct === null || total === null || total <= 0) return null;
  const pct = Number.isFinite(rec.pct) ? Number(rec.pct) : Math.round((correct / total) * 100);
  const date = typeof rec.date === "string" ? rec.date : "";
  return { pct, correct, total, date };
}

/** Number of attempts recorded within the last `days` (rolling window). */
export function countExamAttemptsSince(days: number, now: Date = new Date()): number {
  const cutoff = now.getTime() - days * 24 * 60 * 60 * 1000;
  return getExamAttempts().filter((a) => {
    const ts = Date.parse(a.date);
    return Number.isFinite(ts) && ts >= cutoff;
  }).length;
}

/** All recorded attempts, oldest → newest, malformed records dropped. */
export function getExamAttempts(): ExamAttempt[] {
  const raw = readJson<unknown[]>(EXAM_ATTEMPTS_KEY, []);
  if (!Array.isArray(raw)) return [];
  return raw
    .map(sanitizeAttempt)
    .filter((a): a is ExamAttempt => a !== null);
}

/** Append one attempt (capped to the most recent MAX_ATTEMPTS) and return it. */
export function recordExamAttempt(correct: number, total: number): ExamAttempt {
  const safeTotal = total > 0 ? total : 1;
  const attempt: ExamAttempt = {
    pct: Math.round((correct / safeTotal) * 100),
    correct,
    total: safeTotal,
    date: new Date().toISOString(),
  };
  const next = [...getExamAttempts(), attempt].slice(-MAX_ATTEMPTS);
  writeJson(EXAM_ATTEMPTS_KEY, next);
  return attempt;
}
