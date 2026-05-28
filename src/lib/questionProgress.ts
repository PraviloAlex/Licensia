import type { VerifiedQuestion } from "../types/question";

export const QUESTION_PROGRESS_KEY = "licensia_question_progress";
export const CURRENT_PRACTICE_SESSION_KEY = "licensia_current_practice_session";

export const PRACTICE_SESSION_SIZE = 20;
const PRACTICE_UNSEEN_SHARE = 0.5;
const PRACTICE_MISTAKE_SHARE = 0.3;

export type QuestionProgressItem = {
  seenCount: number;
  correctCount: number;
  wrongCount: number;
  lastSeenAt: string;
  lastAnswerCorrect: boolean;
};

export type QuestionProgressMap = Record<string, QuestionProgressItem>;

export type PracticeSession = {
  id: string;
  questionIds: string[];
  currentIndex: number;
  startedAt: string;
  completedAt: string | null;
  answers?: Record<string, { selectedOptionId: string; isCorrect: boolean }>;
  correctCount?: number;
  wrongCount?: number;
};

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

export function shuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function readJson<T>(key: string, fallback: T): T {
  if (!isBrowser()) {
    return fallback;
  }

  const raw = window.localStorage.getItem(key);
  if (!raw) {
    return fallback;
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T): void {
  if (!isBrowser()) {
    return;
  }

  window.localStorage.setItem(key, JSON.stringify(value));
}

export function getQuestionProgressMap(): QuestionProgressMap {
  const raw = readJson<Record<string, unknown>>(QUESTION_PROGRESS_KEY, {});
  const cleaned: QuestionProgressMap = {};

  for (const [id, value] of Object.entries(raw)) {
    if (!value || typeof value !== "object") {
      continue;
    }

    const rec = value as Partial<QuestionProgressItem>;
    cleaned[id] = {
      seenCount: Number.isFinite(rec.seenCount) ? Number(rec.seenCount) : 0,
      correctCount: Number.isFinite(rec.correctCount) ? Number(rec.correctCount) : 0,
      wrongCount: Number.isFinite(rec.wrongCount) ? Number(rec.wrongCount) : 0,
      lastSeenAt: typeof rec.lastSeenAt === "string" ? rec.lastSeenAt : "",
      lastAnswerCorrect: Boolean(rec.lastAnswerCorrect),
    };
  }

  return cleaned;
}

export function saveQuestionProgressMap(map: QuestionProgressMap): void {
  writeJson(QUESTION_PROGRESS_KEY, map);
}

export function updateQuestionProgress(questionId: string, isCorrect: boolean): QuestionProgressItem {
  const map = getQuestionProgressMap();
  const prev = map[questionId] ?? {
    seenCount: 0,
    correctCount: 0,
    wrongCount: 0,
    lastSeenAt: "",
    lastAnswerCorrect: false,
  };

  const next: QuestionProgressItem = {
    seenCount: prev.seenCount + 1,
    correctCount: prev.correctCount + (isCorrect ? 1 : 0),
    wrongCount: prev.wrongCount + (isCorrect ? 0 : 1),
    lastSeenAt: new Date().toISOString(),
    lastAnswerCorrect: isCorrect,
  };

  map[questionId] = next;
  saveQuestionProgressMap(map);
  return next;
}

export function getUniqueSeenCount(): number {
  const map = getQuestionProgressMap();
  return Object.values(map).filter((item) => item.seenCount > 0).length;
}

export function getTotalWrongAnswersCount(): number {
  const map = getQuestionProgressMap();
  return Object.values(map).reduce((sum, item) => sum + item.wrongCount, 0);
}

export const MISTAKES_SESSION_CAP = 20;

// All questions ever answered wrong (historical)
export function getQuestionIdsWithMistakes(questionIds: string[]): string[] {
  const map = getQuestionProgressMap();
  return questionIds.filter((id) => (map[id]?.wrongCount ?? 0) > 0);
}

// Active mistakes: wrongCount > 0 AND last answer was wrong — still needs practice
export function getActiveMistakeIds(questions: VerifiedQuestion[]): string[] {
  const map = getQuestionProgressMap();
  return questions
    .map((q) => q.id)
    .filter((id) => {
      const p = map[id];
      return p && p.wrongCount > 0 && !p.lastAnswerCorrect;
    });
}

// Count of active (uncorrected) mistakes — used for home card
export function getMistakeQuestionCount(questions: VerifiedQuestion[]): number {
  return getActiveMistakeIds(questions).length;
}

// Questions that had mistakes but last answer was correct — "corrected"
export function getCorrectedMistakeCount(questions: VerifiedQuestion[]): number {
  const map = getQuestionProgressMap();
  return questions.filter((q) => {
    const p = map[q.id];
    return p && p.wrongCount > 0 && p.lastAnswerCorrect;
  }).length;
}

function pickFromPool(pool: string[], targetCount: number, selected: Set<string>): string[] {
  const out: string[] = [];
  for (const id of shuffle(pool)) {
    if (out.length >= targetCount) {
      break;
    }
    if (selected.has(id)) {
      continue;
    }
    selected.add(id);
    out.push(id);
  }
  return out;
}

export function buildPracticeQuestionIds(questions: VerifiedQuestion[]): string[] {
  const allIds = questions.map((q) => q.id);
  const progress = getQuestionProgressMap();

  const unseen = allIds.filter((id) => (progress[id]?.seenCount ?? 0) === 0);
  const mistake = allIds.filter((id) => (progress[id]?.wrongCount ?? 0) > 0);
  const reviewSeen = allIds.filter((id) => (progress[id]?.seenCount ?? 0) > 0 && (progress[id]?.wrongCount ?? 0) === 0);

  const target = Math.min(PRACTICE_SESSION_SIZE, allIds.length);
  const unseenTarget = Math.round(target * PRACTICE_UNSEEN_SHARE);
  const mistakeTarget = Math.round(target * PRACTICE_MISTAKE_SHARE);
  const reviewTarget = target - unseenTarget - mistakeTarget;

  const selected = new Set<string>();
  const picked: string[] = [];

  picked.push(...pickFromPool(unseen, unseenTarget, selected));
  picked.push(...pickFromPool(mistake, mistakeTarget, selected));
  picked.push(...pickFromPool(reviewSeen, reviewTarget, selected));

  if (picked.length < target) {
    picked.push(...pickFromPool(allIds, target - picked.length, selected));
  }

  return shuffle(picked);
}

export function buildMistakesPracticeQuestionIds(questions: VerifiedQuestion[]): string[] {
  const activeIds = getActiveMistakeIds(questions);
  return shuffle(activeIds); // no cap — use all active (uncorrected) mistakes
}

export function buildExamQuestionIds(questions: VerifiedQuestion[]): string[] {
  return shuffle(questions.map((q) => q.id)).slice(0, Math.min(40, questions.length));
}

export function createPracticeSession(questionIds: string[]): PracticeSession {
  return {
    id: `practice_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    questionIds,
    currentIndex: 0,
    startedAt: new Date().toISOString(),
    completedAt: null,
    answers: {},
    correctCount: 0,
    wrongCount: 0,
  };
}

export function getCurrentPracticeSession(): PracticeSession | null {
  const session = readJson<PracticeSession | null>(CURRENT_PRACTICE_SESSION_KEY, null);
  if (!session || typeof session !== "object") {
    return null;
  }

  if (!Array.isArray(session.questionIds) || typeof session.id !== "string") {
    return null;
  }

  return {
    ...session,
    currentIndex: Math.max(0, Number.isFinite(session.currentIndex) ? session.currentIndex : 0),
    answers: session.answers ?? {},
    correctCount: Number.isFinite(session.correctCount) ? Number(session.correctCount) : 0,
    wrongCount: Number.isFinite(session.wrongCount) ? Number(session.wrongCount) : 0,
  };
}

export function saveCurrentPracticeSession(session: PracticeSession): void {
  writeJson(CURRENT_PRACTICE_SESSION_KEY, session);
}

export const QUICK_SESSION_SIZE = 5;

export function buildSubtopicSessionQuestionIds(questions: VerifiedQuestion[], subtopic: string): string[] {
  const filtered = questions.filter((q) => (q.subtopic ?? "otros") === subtopic);
  if (filtered.length === 0) return buildPracticeQuestionIds(questions);
  return buildPracticeQuestionIds(filtered);
}

export function buildQuickSessionQuestionIds(questions: VerifiedQuestion[]): string[] {
  const allIds = questions.map((q) => q.id);
  const progress = getQuestionProgressMap();

  // Prioritise: unseen first, then mistakes, then random
  const unseen = allIds.filter((id) => (progress[id]?.seenCount ?? 0) === 0);
  const mistake = allIds.filter((id) => (progress[id]?.wrongCount ?? 0) > 0);

  const selected = new Set<string>();
  const picked: string[] = [];

  for (const id of shuffle(unseen)) {
    if (picked.length >= QUICK_SESSION_SIZE) break;
    selected.add(id);
    picked.push(id);
  }
  for (const id of shuffle(mistake)) {
    if (picked.length >= QUICK_SESSION_SIZE) break;
    if (!selected.has(id)) { selected.add(id); picked.push(id); }
  }
  for (const id of shuffle(allIds)) {
    if (picked.length >= QUICK_SESSION_SIZE) break;
    if (!selected.has(id)) { selected.add(id); picked.push(id); }
  }

  return shuffle(picked).slice(0, QUICK_SESSION_SIZE);
}
