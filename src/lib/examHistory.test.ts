import { beforeEach, describe, expect, it, vi } from "vitest";
import { EXAM_ATTEMPTS_KEY, getExamAttempts, recordExamAttempt } from "./examHistory";

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

describe("examHistory", () => {
  beforeEach(() => {
    vi.stubGlobal("window", { localStorage: createLocalStorageMock() });
    window.localStorage.clear();
  });

  it("records an attempt with a computed percentage", () => {
    const attempt = recordExamAttempt(34, 40);
    expect(attempt.pct).toBe(85);
    expect(attempt.correct).toBe(34);
    expect(attempt.total).toBe(40);
    expect(getExamAttempts()).toHaveLength(1);
  });

  it("appends attempts oldest to newest and caps at 50", () => {
    for (let i = 0; i < 55; i += 1) {
      recordExamAttempt(i % 41, 40);
    }
    const attempts = getExamAttempts();
    expect(attempts).toHaveLength(50);
    // The very last recorded attempt (i = 54 → 54 % 41 = 13 correct) survives.
    expect(attempts[attempts.length - 1].correct).toBe(13);
  });

  it("drops malformed persisted records", () => {
    window.localStorage.setItem(
      EXAM_ATTEMPTS_KEY,
      JSON.stringify([
        { pct: 90, correct: 36, total: 40, date: "2026-01-01T00:00:00.000Z" },
        { correct: 10 }, // missing total → dropped
        null,
        { correct: 5, total: 0 }, // total <= 0 → dropped
      ]),
    );
    const attempts = getExamAttempts();
    expect(attempts).toHaveLength(1);
    expect(attempts[0].pct).toBe(90);
  });

  it("guards against a zero total", () => {
    const attempt = recordExamAttempt(0, 0);
    expect(attempt.total).toBe(1);
    expect(Number.isFinite(attempt.pct)).toBe(true);
  });
});
