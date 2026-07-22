import { readStorageString, writeStorageString, removeStorageItem } from "./storage";

export const EXAM_DATE_KEY = "licencia_ar_exam_date";

const DEFAULT_DAILY_TARGET = 20;
const MIN_DAILY_TARGET = 10;
const MAX_DAILY_TARGET = 40;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export type DailyPlan = {
  /** Whole days until the exam, or null when no (valid) date is set. */
  daysLeft: number | null;
  /** Recommended questions to answer today, clamped to [MIN, MAX]. */
  targetQuestions: number;
};

/** Persist the planned exam date (ISO `YYYY-MM-DD`), or clear it with null. */
export function setExamDate(iso: string | null): void {
  if (iso === null || iso === "") {
    removeStorageItem(EXAM_DATE_KEY);
    return;
  }
  writeStorageString(EXAM_DATE_KEY, iso);
}

export function getExamDate(): string | null {
  return readStorageString(EXAM_DATE_KEY);
}

/**
 * Days from the user's local "today" until the exam date. Past → 0, missing/invalid → null.
 * Compares calendar days: the exam date's Y/M/D vs `now`'s LOCAL Y/M/D, so an evening in a
 * negative-UTC timezone (e.g. Argentina, UTC-3) does not drift the count by a day. Date.UTC
 * is used only as a stable day-arithmetic base, never as a timezone.
 */
export function getDaysUntilExam(now: Date = new Date()): number | null {
  const raw = getExamDate();
  if (!raw) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  if (!match) return null;

  const startOfTarget = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const startOfToday = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.round((startOfTarget - startOfToday) / MS_PER_DAY);
  return Math.max(0, diffDays);
}

/**
 * Daily study plan. Pure — caller passes totals (e.g. questionsData.length and
 * getUniqueSeenCount()) so this module stays free of the heavy question data import.
 */
export function getDailyPlan(total: number, seen: number, now: Date = new Date()): DailyPlan {
  const daysLeft = getDaysUntilExam(now);
  const remaining = Math.max(0, total - seen);

  if (daysLeft === null || daysLeft <= 0) {
    return { daysLeft, targetQuestions: DEFAULT_DAILY_TARGET };
  }

  const perDay = Math.ceil(remaining / daysLeft);
  const targetQuestions = Math.min(MAX_DAILY_TARGET, Math.max(MIN_DAILY_TARGET, perDay));
  return { daysLeft, targetQuestions };
}
