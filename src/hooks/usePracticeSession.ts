import { useMemo, useState } from "react";
import { questionsData } from "../lib/data";
import { resolveQuestionGlossaryIds } from "../lib/glossaryLinkage";
import {
  buildHardestQuestionIds,
  buildMistakesPracticeQuestionIds,
  buildPracticeQuestionIds,
  buildQuickSessionQuestionIds,
  buildSubtopicSessionQuestionIds,
  buildWeakTopicQuestionIds,
  createPracticeSession,
  getCurrentPracticeSession,
  PRACTICE_SESSION_SIZE,
  QUICK_SESSION_SIZE,
  saveCurrentPracticeSession,
  shuffle,
  updateQuestionProgress,
  type PracticeSession,
} from "../lib/questionProgress";
import { addWordsToReview } from "../lib/vocabularyStatus";
import type { UILang } from "../lib/i18n";
import type { VerifiedQuestion } from "../types/question";
import { buildSessionResult, type AnsweredQuestion } from "../utils/buildSessionResult";

type BuildAnsweredQuestion = (params: {
  question: VerifiedQuestion;
  index: number;
  selectedOptionId?: string;
  isCorrect: boolean;
  lang: UILang;
}) => AnsweredQuestion;

type UsePracticeSessionParams = {
  useMistakesOnly: boolean;
  useQuick: boolean;
  useHardest: boolean;
  useWeak: boolean;
  subtopicFilter?: string;
  uiLang: UILang;
  buildAnsweredQuestion: BuildAnsweredQuestion;
  pickQuestionById: (id: string | undefined) => VerifiedQuestion | null;
  onCorrectAnswer: () => void;
  onEnterPracticeMode: () => void;
  onQuestionReset: () => void;
  onSessionStartReset: () => void;
};

function getInitialPracticeSession(useMistakesOnly: boolean, useQuick: boolean, useHardest: boolean, useWeak: boolean, subtopicFilter?: string): PracticeSession {
  const persisted = getCurrentPracticeSession();
  const expectedSize = useQuick ? QUICK_SESSION_SIZE : PRACTICE_SESSION_SIZE;
  if (
    !useMistakesOnly &&
    !useHardest &&
    !useWeak &&
    !subtopicFilter &&
    persisted &&
    !persisted.completedAt &&
    persisted.currentIndex < persisted.questionIds.length &&
    persisted.questionIds.length === expectedSize
  ) {
    return persisted;
  }

  const questionIds = useQuick
    ? buildQuickSessionQuestionIds(questionsData)
    : useMistakesOnly ? buildMistakesPracticeQuestionIds(questionsData)
    : useHardest ? buildHardestQuestionIds(questionsData)
    : useWeak ? buildWeakTopicQuestionIds(questionsData)
    : subtopicFilter ? buildSubtopicSessionQuestionIds(questionsData, subtopicFilter)
    : buildPracticeQuestionIds(questionsData);
  const session = createPracticeSession(questionIds);
  saveCurrentPracticeSession(session);
  return session;
}

export function usePracticeSession({
  useMistakesOnly,
  useQuick,
  useHardest,
  useWeak,
  subtopicFilter,
  uiLang,
  buildAnsweredQuestion,
  pickQuestionById,
  onCorrectAnswer,
  onEnterPracticeMode,
  onQuestionReset,
  onSessionStartReset,
}: UsePracticeSessionParams) {
  const [practiceSession, setPracticeSession] = useState<PracticeSession>(() =>
    getInitialPracticeSession(useMistakesOnly, useQuick, useHardest, useWeak, subtopicFilter),
  );
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(() => {
    const qid = practiceSession.questionIds[practiceSession.currentIndex];
    return practiceSession.answers?.[qid]?.selectedOptionId ?? null;
  });
  const [showResult, setShowResult] = useState<boolean>(() => {
    const qid = practiceSession.questionIds[practiceSession.currentIndex];
    return Boolean(practiceSession.answers?.[qid]);
  });

  const practiceResult = useMemo(() => {
    const answeredQuestions = practiceSession.questionIds
      .map((qid, index) => {
        const q = pickQuestionById(qid);
        const answer = practiceSession.answers?.[qid];
        if (!q || !answer) return null;
        return buildAnsweredQuestion({
          question: q,
          index,
          selectedOptionId: answer.selectedOptionId,
          isCorrect: answer.isCorrect,
          lang: uiLang,
        });
      })
      .filter((q): q is AnsweredQuestion => q !== null);

    return buildSessionResult({
      mode: "practice",
      answeredQuestions,
      durationMinutes: useQuick ? 8 : Math.max(8, Math.round(answeredQuestions.length * 1.6)),
    });
  }, [buildAnsweredQuestion, pickQuestionById, practiceSession.answers, practiceSession.questionIds, uiLang, useQuick]);

  function startPracticeSession(useMistakesOnlySession: boolean, useQuickSession = false, specificIds?: string[]): void {
    const nextIds = specificIds ? shuffle(specificIds)
      : useQuickSession ? buildQuickSessionQuestionIds(questionsData)
      : useMistakesOnlySession ? buildMistakesPracticeQuestionIds(questionsData) : buildPracticeQuestionIds(questionsData);
    const nextSession = createPracticeSession(nextIds);
    saveCurrentPracticeSession(nextSession);
    setPracticeSession(nextSession);
    setSelectedOptionId(null);
    setShowResult(false);
    onSessionStartReset();
    onEnterPracticeMode();
  }

  function handlePracticeAnswer(optionId: string): void {
    if (showResult || practiceSession.completedAt) return;
    const qid = practiceSession.questionIds[practiceSession.currentIndex];
    if (!qid) return;
    const q = pickQuestionById(qid);
    if (!q) return;
    const correct = optionId === q.correctOptionId;
    setSelectedOptionId(optionId);
    setShowResult(true);
    if (correct) onCorrectAnswer();
    updateQuestionProgress(q.id, correct);
    if (!correct) addWordsToReview(resolveQuestionGlossaryIds(q));
    const answers = { ...(practiceSession.answers ?? {}), [q.id]: { selectedOptionId: optionId, isCorrect: correct } };
    const nextSession: PracticeSession = {
      ...practiceSession,
      answers,
      correctCount: (practiceSession.correctCount ?? 0) + (correct ? 1 : 0),
      wrongCount: (practiceSession.wrongCount ?? 0) + (correct ? 0 : 1),
    };
    setPracticeSession(nextSession);
    saveCurrentPracticeSession(nextSession);
  }

  function goNextPracticeQuestion(): void {
    if (!showResult || practiceSession.completedAt) return;
    const isLast = practiceSession.currentIndex >= practiceSession.questionIds.length - 1;
    const nextSession: PracticeSession = isLast
      ? { ...practiceSession, completedAt: new Date().toISOString() }
      : { ...practiceSession, currentIndex: practiceSession.currentIndex + 1 };
    setPracticeSession(nextSession);
    saveCurrentPracticeSession(nextSession);
    onQuestionReset();
    const nextQid = nextSession.questionIds[nextSession.currentIndex];
    const nextAnswered = Boolean(nextSession.answers?.[nextQid]);
    setShowResult(nextAnswered);
    setSelectedOptionId(nextAnswered ? nextSession.answers?.[nextQid]?.selectedOptionId ?? null : null);
  }

  function goToPracticeQuestion(index: number): void {
    if (index >= practiceSession.currentIndex || !!practiceSession.completedAt) return;
    const nextSession: PracticeSession = { ...practiceSession, currentIndex: index };
    setPracticeSession(nextSession);
    saveCurrentPracticeSession(nextSession);
    onQuestionReset();
    const qid = nextSession.questionIds[index];
    const answered = Boolean(nextSession.answers?.[qid]);
    setShowResult(answered);
    setSelectedOptionId(answered ? nextSession.answers?.[qid]?.selectedOptionId ?? null : null);
  }

  return {
    goNextPracticeQuestion,
    goToPracticeQuestion,
    handlePracticeAnswer,
    practiceResult,
    practiceSession,
    selectedOptionId,
    showResult,
    startPracticeSession,
  };
}
