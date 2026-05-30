export type SessionMode = "practice" | "exam";

export type SessionMistake = {
  questionId: string;
  number?: number;
  topic?: string;
  title: string;
  selectedAnswer: string;
  correctAnswer: string;
};

export type WeakTopic = {
  name: string;
  mistakes: number;
  progress?: number;
};

export type SessionResult = {
  mode: SessionMode;
  totalQuestions: number;
  correctAnswers: number;
  wrongAnswers: number;
  percentage: number;
  durationMinutes?: number;
  mistakes: SessionMistake[];
  weakTopics?: WeakTopic[];
};
