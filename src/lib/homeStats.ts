import { getQuestionProgressMap, getCurrentPracticeSession } from "./questionProgress";
import { getDueReviewWordIds, getMasteredWordIds } from "./vocabularyStatus";
import { glossaryData } from "./data";
import type { GlossaryEntry } from "../types/glossary";

// ─── Today helpers ───────────────────────────────────────────

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function dateStrForOffset(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

/** Number of questions answered today (any answer, correct or wrong) */
export function getTodayAnsweredCount(): number {
  const today = todayStr();
  const progress = getQuestionProgressMap();
  return Object.values(progress).filter(
    (p) => p.lastSeenAt && p.lastSeenAt.slice(0, 10) === today
  ).length;
}

// ─── Active session ──────────────────────────────────────────

export type ActiveSessionSummary = {
  currentIndex: number;
  totalQuestions: number;
} | null;

/** Returns summary of current practice session if one is in progress (not completed). */
export function getActivePracticeSessionSummary(): ActiveSessionSummary {
  const session = getCurrentPracticeSession();
  if (!session || session.completedAt !== null) return null;
  if (session.currentIndex >= session.questionIds.length) return null;
  return {
    currentIndex: session.currentIndex,
    totalQuestions: session.questionIds.length,
  };
}

// ─── Due words preview ───────────────────────────────────────

export type WordPreview = {
  id: string;
  term_es: string;
  translation_ru: string;
};

/** Returns up to `limit` due-for-review words as compact previews. */
export function getDueWordsPreview(limit: number): WordPreview[] {
  const masteredIds = new Set(getMasteredWordIds());
  const dueIds = getDueReviewWordIds().filter((id) => !masteredIds.has(id));
  const sliced = dueIds.slice(0, limit);

  const glossaryMap = new Map<string, GlossaryEntry>(
    glossaryData.map((e) => [e.id, e])
  );

  return sliced
    .map((id) => {
      const entry = glossaryMap.get(id);
      if (!entry) return null;
      return { id, term_es: entry.term_es, translation_ru: entry.translation_ru };
    })
    .filter((x): x is WordPreview => x !== null);
}

/** Count of due-for-review words (not mastered). */
export function getDueWordsCount(): number {
  const masteredIds = new Set(getMasteredWordIds());
  return getDueReviewWordIds().filter((id) => !masteredIds.has(id)).length;
}

// ─── Readiness level ─────────────────────────────────────────

export type ReadinessLevel = {
  score: number;
  label: string;
  color: string;
  hint: string;
};

export function getReadinessLevel(
  seenCount: number,
  total: number,
  totalCorrect: number,
  totalWrong: number
): ReadinessLevel {
  if (total === 0) return { score: 0, label: "", color: "rgba(150,185,230,0.55)", hint: "Начни первую тренировку" };
  const coverage = seenCount / total;
  const answered = totalCorrect + totalWrong;
  const accuracy = answered > 0 ? totalCorrect / answered : 0;
  const mistakePenalty = answered > 0 ? Math.min(0.2, (totalWrong / answered) * 0.4) : 0;
  const raw = coverage * 0.4 + accuracy * 0.4 - mistakePenalty + (seenCount > 0 ? 0.2 : 0) * Math.min(1, seenCount / 10);
  const score = Math.min(100, Math.max(0, Math.round(raw * 100)));

  if (score >= 80) return { score, label: "Можно пробовать экзамен", color: "#62f4b4", hint: "Готовность достаточная" };
  if (score >= 51) return { score, label: "Уверенный прогресс", color: "#7db8ff", hint: "Продолжай в том же духе" };
  if (score >= 21) return { score, label: "База формируется", color: "#ffb869", hint: "Продолжай тренировки" };
  return { score, label: "Нужно больше практики", color: "#ffb869", hint: "Продолжай тренировки" };
}

// ─── Weekly activity ─────────────────────────────────────────

/** Returns array of 7 booleans: [6 days ago, ..., today] */
export function getWeeklyActivity(): boolean[] {
  const progress = getQuestionProgressMap();
  const activeDates = new Set(
    Object.values(progress)
      .filter((p) => p.lastSeenAt)
      .map((p) => p.lastSeenAt.slice(0, 10))
  );

  return Array.from({ length: 7 }, (_, i) => {
    const dateStr = dateStrForOffset(i - 6); // -6, -5, ..., 0
    return activeDates.has(dateStr);
  });
}

// ─── Daily mission ───────────────────────────────────────────

const EXAM_TODAY_KEY = "licencia_ar_exam_today";

export function getExamCompletedToday(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = window.localStorage.getItem(EXAM_TODAY_KEY);
    if (!raw) return false;
    const { date } = JSON.parse(raw) as { date: string };
    return date === todayStr();
  } catch {
    return false;
  }
}

export function markExamCompletedToday(): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(EXAM_TODAY_KEY, JSON.stringify({ date: todayStr() }));
}
