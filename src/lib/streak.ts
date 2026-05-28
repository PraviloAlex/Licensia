import { getQuestionProgressMap } from "./questionProgress";

const STREAK_KEY = "licencia_ar_streak";

type StreakData = {
  current: number;
  best: number;
  lastActiveDate: string;
};

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function yesterdayStr(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

function readStreak(): StreakData {
  if (typeof window === "undefined") return { current: 0, best: 0, lastActiveDate: "" };
  try {
    const raw = window.localStorage.getItem(STREAK_KEY);
    if (!raw) return { current: 0, best: 0, lastActiveDate: "" };
    return JSON.parse(raw) as StreakData;
  } catch {
    return { current: 0, best: 0, lastActiveDate: "" };
  }
}

function writeStreak(data: StreakData): void {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STREAK_KEY, JSON.stringify(data));
  }
}

/**
 * Called once per session to update streak based on activity today.
 * Checks questionProgress for any answer recorded today.
 */
export function refreshStreak(): StreakData {
  const today = todayStr();
  const yesterday = yesterdayStr();
  const stored = readStreak();

  const progress = getQuestionProgressMap();
  const activeDates = new Set(
    Object.values(progress)
      .filter((p) => p.lastSeenAt)
      .map((p) => p.lastSeenAt.slice(0, 10))
  );

  const activeToday = activeDates.has(today);
  if (!activeToday) {
    const broken = stored.lastActiveDate !== yesterday && stored.lastActiveDate !== today;
    if (broken && stored.current > 0) {
      const reset: StreakData = { current: 0, best: stored.best, lastActiveDate: stored.lastActiveDate };
      writeStreak(reset);
      return reset;
    }
    return stored;
  }

  if (stored.lastActiveDate === today) return stored;

  const newCurrent = stored.lastActiveDate === yesterday ? stored.current + 1 : 1;
  const updated: StreakData = {
    current: newCurrent,
    best: Math.max(newCurrent, stored.best),
    lastActiveDate: today,
  };
  writeStreak(updated);
  return updated;
}

export function getStreak(): StreakData {
  return refreshStreak();
}
