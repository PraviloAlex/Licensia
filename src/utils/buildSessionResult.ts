import type { SessionMode, SessionMistake, SessionResult, WeakTopic } from "../types/sessionResult";

export type AnsweredQuestion = {
  id: string;
  number?: number;
  topic?: string;
  question: string;
  selectedAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
};

export function buildSessionResult(params: {
  mode: SessionMode;
  answeredQuestions: AnsweredQuestion[];
  durationMinutes?: number;
}): SessionResult {
  const { mode, answeredQuestions, durationMinutes } = params;
  const totalQuestions = answeredQuestions.length;
  const correctAnswers = answeredQuestions.filter((q) => q.isCorrect).length;
  const wrongAnswers = totalQuestions - correctAnswers;
  const percentage = totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0;

  const mistakes: SessionMistake[] = answeredQuestions
    .filter((q) => !q.isCorrect)
    .map((q) => ({
      questionId: q.id,
      number: q.number,
      topic: q.topic,
      title: q.question,
      selectedAnswer: q.selectedAnswer,
      correctAnswer: q.correctAnswer,
    }));

  const topicMap = new Map<string, number>();
  mistakes.forEach((mistake) => {
    const topicName = mistake.topic || "Разное";
    topicMap.set(topicName, (topicMap.get(topicName) || 0) + 1);
  });

  const maxMistakes = Math.max(1, ...Array.from(topicMap.values()));
  const weakTopics: WeakTopic[] = Array.from(topicMap.entries())
    .map(([name, mistakes]) => ({
      name,
      mistakes,
      progress: Math.max(18, Math.round((mistakes / maxMistakes) * 100)),
    }))
    .sort((a, b) => b.mistakes - a.mistakes);

  return {
    mode,
    totalQuestions,
    correctAnswers,
    wrongAnswers,
    percentage,
    durationMinutes,
    mistakes,
    weakTopics,
  };
}
