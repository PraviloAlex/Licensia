import { beforeEach, describe, expect, it, vi } from "vitest";
import { EXAM_TOTAL_QUESTIONS } from "../constants/exam";
import type { VerifiedQuestion } from "../types/question";
import {
  CURRENT_PRACTICE_SESSION_KEY,
  PRACTICE_SESSION_SIZE,
  QUESTION_PROGRESS_KEY,
  buildExamQuestionIds,
  buildPracticeQuestionIds,
  getCurrentPracticeSession,
  getQuestionProgressMap,
  saveCurrentPracticeSession,
  updateQuestionProgress,
} from "./questionProgress";

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
      data = {
        ...data,
        [key]: value,
      };
    },
  };
}

function makeQuestion(id: string): VerifiedQuestion {
  return {
    id,
    source: {
      name: "test",
      url: "https://example.com",
      page: null,
      collectedAt: "2026-01-01T00:00:00.000Z",
      verified: true,
    },
    region: "ar",
    licenseCategory: "B",
    topic: "test",
    question_es: `Pregunta ${id}`,
    question_ru: `Question ${id}`,
    image: null,
    options: [
      { id: "a", text_es: "A", text_ru: "A" },
      { id: "b", text_es: "B", text_ru: "B" },
    ],
    correctOptionId: "a",
    explanation_ru: "",
    memoryHint_ru: "",
    glossaryIds: [],
    isExactOriginal: true,
  };
}

describe("questionProgress", () => {
  beforeEach(() => {
    vi.stubGlobal("window", {
      localStorage: createLocalStorageMock(),
    });
    window.localStorage.clear();
  });

  it("sanitizes malformed persisted progress records", () => {
    window.localStorage.setItem(
      QUESTION_PROGRESS_KEY,
      JSON.stringify({
        q1: {
          seenCount: "bad",
          correctCount: 2,
          wrongCount: Number.NaN,
          lastSeenAt: 123,
          lastAnswerCorrect: 1,
        },
        q2: null,
      }),
    );

    expect(getQuestionProgressMap()).toEqual({
      q1: {
        seenCount: 0,
        correctCount: 2,
        wrongCount: 0,
        lastSeenAt: "",
        lastAnswerCorrect: true,
      },
    });
  });

  it("updates question progress without dropping existing questions", () => {
    window.localStorage.setItem(
      QUESTION_PROGRESS_KEY,
      JSON.stringify({
        q1: {
          seenCount: 1,
          correctCount: 0,
          wrongCount: 1,
          lastSeenAt: "2026-01-01T00:00:00.000Z",
          lastAnswerCorrect: false,
        },
      }),
    );

    const updated = updateQuestionProgress("q2", true);
    const progress = getQuestionProgressMap();

    expect(updated).toMatchObject({
      seenCount: 1,
      correctCount: 1,
      wrongCount: 0,
      lastAnswerCorrect: true,
    });
    expect(progress.q1?.wrongCount).toBe(1);
    expect(progress.q2).toMatchObject(updated);
  });

  it("caps exam sessions at the configured exam size", () => {
    const questions = Array.from({ length: EXAM_TOTAL_QUESTIONS + 5 }, (_, index) =>
      makeQuestion(`q${index}`),
    );

    expect(buildExamQuestionIds(questions)).toHaveLength(EXAM_TOTAL_QUESTIONS);
  });

  it("caps practice sessions at the configured practice size", () => {
    const questions = Array.from({ length: PRACTICE_SESSION_SIZE + 5 }, (_, index) =>
      makeQuestion(`q${index}`),
    );

    expect(buildPracticeQuestionIds(questions)).toHaveLength(PRACTICE_SESSION_SIZE);
  });

  it("returns null for malformed persisted practice sessions", () => {
    window.localStorage.setItem(CURRENT_PRACTICE_SESSION_KEY, JSON.stringify({ id: 123 }));

    expect(getCurrentPracticeSession()).toBeNull();
  });

  it("normalizes optional practice session fields", () => {
    saveCurrentPracticeSession({
      id: "practice_1",
      questionIds: ["q1"],
      currentIndex: Number.NaN,
      startedAt: "2026-01-01T00:00:00.000Z",
      completedAt: null,
    });

    expect(getCurrentPracticeSession()).toMatchObject({
      id: "practice_1",
      currentIndex: 0,
      answers: {},
      correctCount: 0,
      wrongCount: 0,
    });
  });
});
