import { describe, expect, it } from "vitest";
import { buildSessionResult } from "./buildSessionResult";

describe("buildSessionResult", () => {
  it("returns zeroed totals for an empty session", () => {
    const result = buildSessionResult({
      mode: "practice",
      answeredQuestions: [],
    });

    expect(result).toMatchObject({
      mode: "practice",
      totalQuestions: 0,
      correctAnswers: 0,
      wrongAnswers: 0,
      percentage: 0,
      mistakes: [],
      weakTopics: [],
    });
  });

  it("builds mistakes and weak topics from wrong answers", () => {
    const result = buildSessionResult({
      mode: "exam",
      answeredQuestions: [
        {
          id: "q1",
          number: 1,
          topic: "Prioridad",
          question: "Question 1",
          selectedAnswer: "A",
          correctAnswer: "B",
          isCorrect: false,
        },
        {
          id: "q2",
          number: 2,
          topic: "Prioridad",
          question: "Question 2",
          selectedAnswer: "A",
          correctAnswer: "C",
          isCorrect: false,
        },
        {
          id: "q3",
          number: 3,
          topic: "Velocidad",
          question: "Question 3",
          selectedAnswer: "D",
          correctAnswer: "D",
          isCorrect: true,
        },
      ],
      durationMinutes: 12,
    });

    expect(result.percentage).toBe(33);
    expect(result.mistakes).toHaveLength(2);
    expect(result.weakTopics).toEqual([
      { name: "Prioridad", mistakes: 2, progress: 100 },
    ]);
    expect(result.durationMinutes).toBe(12);
  });
});
