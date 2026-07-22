import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDailyPlan, getDaysUntilExam, setExamDate } from "./studyPlan";

function createLocalStorageMock(): Storage {
  let data: Record<string, string> = {};
  return {
    get length() {
      return Object.keys(data).length;
    },
    clear: () => {
      data = {};
    },
    getItem: (key: string) => data[key] ?? null,
    key: (index: number) => Object.keys(data)[index] ?? null,
    removeItem: (key: string) => {
      const { [key]: _removed, ...rest } = data;
      data = rest;
    },
    setItem: (key: string, value: string) => {
      data = { ...data, [key]: value };
    },
  };
}

// Local-calendar construction keeps getDaysUntilExam deterministic across runner timezones.
const NOW = new Date(2026, 6, 22, 12, 0, 0);

describe("studyPlan", () => {
  beforeEach(() => {
    vi.stubGlobal("window", { localStorage: createLocalStorageMock() });
    window.localStorage.clear();
  });

  it("returns null days when no date is set", () => {
    expect(getDaysUntilExam(NOW)).toBeNull();
  });

  it("counts whole days until a future exam date", () => {
    setExamDate("2026-07-31");
    expect(getDaysUntilExam(NOW)).toBe(9);
  });

  it("clamps a past exam date to zero", () => {
    setExamDate("2026-07-01");
    expect(getDaysUntilExam(NOW)).toBe(0);
  });

  it("returns null for an invalid date string", () => {
    setExamDate("not-a-date");
    expect(getDaysUntilExam(NOW)).toBeNull();
  });

  it("derives a daily target from remaining questions and days left", () => {
    setExamDate("2026-07-31"); // 9 days
    // remaining = 460 - 100 = 360; 360 / 9 = 40 → clamped to max 40
    const plan = getDailyPlan(460, 100, NOW);
    expect(plan.daysLeft).toBe(9);
    expect(plan.targetQuestions).toBe(40);
  });

  it("clamps the daily target to the minimum", () => {
    setExamDate("2026-08-30"); // ~39 days
    const plan = getDailyPlan(460, 440, NOW); // remaining 20 over 39 days → 1 → min 10
    expect(plan.targetQuestions).toBe(10);
  });

  it("falls back to the default target with no date (no divide-by-zero)", () => {
    const plan = getDailyPlan(460, 0, NOW);
    expect(plan.daysLeft).toBeNull();
    expect(plan.targetQuestions).toBe(20);
  });
});
