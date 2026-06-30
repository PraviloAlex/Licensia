import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  addWordToReview,
  canCountKnownClick,
  getKnownClickCount,
  getReviewedTodayCount,
  getReviewWordIds,
  getWordDueAt,
  getWordStatusMap,
  markWordKnown,
  markWordRepeat,
  removeWordFromReview,
  resetVocabularyState,
  wasKnownToday,
} from "./vocabularyStatus";

function createStorageMock(): Storage {
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
      data = {
        ...data,
        [key]: value,
      };
    },
  };
}

describe("vocabularyStatus", () => {
  beforeEach(() => {
    vi.stubGlobal("window", {
      localStorage: createStorageMock(),
      sessionStorage: createStorageMock(),
    });
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it("marks a word known, counts the review, and schedules it until mastered", () => {
    const result = markWordKnown("word-1");

    expect(result.counted).toBe(true);
    expect(result.statusMap["word-1"]).toBe("known");
    expect(result.reviewIds).toContain("word-1");
    expect(getKnownClickCount("word-1")).toBe(1);
    expect(getReviewedTodayCount()).toBe(1);
    expect(canCountKnownClick("word-1")).toBe(false);
    expect(wasKnownToday("word-1")).toBe(true);
    expect(getWordDueAt("word-1")).toBeGreaterThan(Date.now());
  });

  it("does not count a second known click on the same calendar day", () => {
    markWordKnown("word-1");
    const result = markWordKnown("word-1");

    expect(result.counted).toBe(false);
    expect(getKnownClickCount("word-1")).toBe(1);
    expect(getReviewedTodayCount()).toBe(1);
  });

  it("marks a word for repeat, decrements known clicks, and keeps it in review", () => {
    markWordKnown("word-1");

    const result = markWordRepeat("word-1");

    expect(result.statusMap["word-1"]).toBe("repeat");
    expect(result.reviewIds).toContain("word-1");
    expect(getKnownClickCount("word-1")).toBe(0);
    expect(getReviewedTodayCount()).toBe(2);
    expect(getWordDueAt("word-1")).toBeGreaterThan(Date.now());
  });

  it("removes a word from the review queue without changing its status", () => {
    addWordToReview("word-1");
    expect(getReviewWordIds()).toContain("word-1");

    removeWordFromReview("word-1");

    expect(getReviewWordIds()).not.toContain("word-1");
    expect(getWordStatusMap()).toEqual({});
  });

  it("resets versioned vocabulary state without clearing known click counters", () => {
    markWordKnown("word-1");

    resetVocabularyState();

    expect(getReviewWordIds()).toEqual([]);
    expect(getWordStatusMap()).toEqual({});
    expect(getKnownClickCount("word-1")).toBe(1);
  });
});
