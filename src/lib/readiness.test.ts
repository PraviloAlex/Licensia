import { beforeEach, describe, expect, it, vi } from "vitest";
import { getPassProbability } from "./readiness";
import { recordExamAttempt } from "./examHistory";
import { updateQuestionProgress } from "./questionProgress";

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

describe("readiness.getPassProbability", () => {
  beforeEach(() => {
    vi.stubGlobal("window", { localStorage: createLocalStorageMock() });
    window.localStorage.clear();
  });

  it("degrades honestly to zero with no data", () => {
    const result = getPassProbability();
    expect(result.basis).toBe("none");
    expect(result.pct).toBe(0);
  });

  it("recency-weights the most recent mock exams", () => {
    recordExamAttempt(28, 40); // 70%  (oldest)
    recordExamAttempt(32, 40); // 80%
    recordExamAttempt(36, 40); // 90%  (newest)
    // weights most-recent-first 0.5/0.3/0.2 → 90*.5 + 80*.3 + 70*.2 = 83
    const result = getPassProbability();
    expect(result.basis).toBe("exams");
    expect(result.pct).toBe(83);
    expect(result.labelKey).toBe("prob.lvl.close");
  });

  it("falls back to practice accuracy when there are no exams", () => {
    updateQuestionProgress("q1", true);
    updateQuestionProgress("q2", true);
    updateQuestionProgress("q3", true);
    updateQuestionProgress("q4", false); // 3/4 = 75%
    const result = getPassProbability();
    expect(result.basis).toBe("practice");
    expect(result.pct).toBe(75);
  });
});
