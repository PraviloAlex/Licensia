import { useEffect, useMemo, useRef, useState } from "react";
import { questionsData } from "../lib/data";
import { markExamCompletedToday } from "../lib/homeStats";
import { buildExamQuestionIds, updateQuestionProgress } from "../lib/questionProgress";
import type { UILang } from "../lib/i18n";
import type { VerifiedQuestion } from "../types/question";
import { buildSessionResult, type AnsweredQuestion } from "../utils/buildSessionResult";

const STORAGE_EXAM_HIST = "exam_history_v1";
const EXAM_TIME_LIMIT = 2700;

export interface ExamHistoryData {
  attempts: number;
  bestPct: number;
  lastPct: number;
  lastDate: string;
}

type BuildAnsweredQuestion = (params: {
  question: VerifiedQuestion;
  index: number;
  selectedOptionId?: string;
  isCorrect: boolean;
  lang: UILang;
}) => AnsweredQuestion;

type UseExamSessionParams = {
  isExam: boolean;
  uiLang: UILang;
  pickQuestionById: (id: string | undefined) => VerifiedQuestion | null;
  buildAnsweredQuestion: BuildAnsweredQuestion;
  onEnterExamMode: () => void;
  onExitExam: () => void;
};

function getExamHistory(): ExamHistoryData {
  if (typeof window === "undefined") return { attempts: 0, bestPct: 0, lastPct: 0, lastDate: "" };
  try {
    const v = window.localStorage.getItem(STORAGE_EXAM_HIST);
    if (v) return JSON.parse(v) as ExamHistoryData;
  } catch {
    // Keep a corrupt history record from blocking exam start.
  }
  return { attempts: 0, bestPct: 0, lastPct: 0, lastDate: "" };
}

function saveExamHistory(pct: number): void {
  if (typeof window === "undefined") return;
  const prev = getExamHistory();
  window.localStorage.setItem(STORAGE_EXAM_HIST, JSON.stringify({
    attempts: prev.attempts + 1,
    bestPct: Math.max(prev.bestPct, pct),
    lastPct: pct,
    lastDate: new Date().toISOString(),
  }));
}

export function useExamSession({
  isExam,
  uiLang,
  pickQuestionById,
  buildAnsweredQuestion,
  onEnterExamMode,
  onExitExam,
}: UseExamSessionParams) {
  const [examQuestionIds, setExamQuestionIds] = useState<string[]>(() => buildExamQuestionIds(questionsData));
  const [examIndex, setExamIndex] = useState(0);
  const [examAnswers, setExamAnswers] = useState<Record<string, boolean>>({});
  const [examSelAnswers, setExamSelAnswers] = useState<Record<string, string>>({});
  const [examStarted, setExamStarted] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [examHistory, setExamHistory] = useState<ExamHistoryData>(getExamHistory);
  const [examElapsed, setExamElapsed] = useState(0);
  const [examForceEnd, setExamForceEnd] = useState(false);
  const examTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const examTotal = examQuestionIds.length;
  const examAnsweredCount = Object.keys(examAnswers).length;
  const examCorrectCount = Object.values(examAnswers).filter(Boolean).length;
  const showExamSummary = isExam && examStarted && (examAnsweredCount >= examTotal || examForceEnd);
  const examQuestion = pickQuestionById(examQuestionIds[examIndex]);

  const examResult = useMemo(() => {
    const answeredQuestions = examQuestionIds
      .map((qid, index) => {
        const q = pickQuestionById(qid);
        if (!q) return null;
        return buildAnsweredQuestion({
          question: q,
          index,
          selectedOptionId: examSelAnswers[qid],
          isCorrect: examAnswers[qid] === true,
          lang: uiLang,
        });
      })
      .filter((q): q is AnsweredQuestion => q !== null);

    return buildSessionResult({
      mode: "exam",
      answeredQuestions,
      durationMinutes: Math.max(1, Math.ceil(examElapsed / 60)),
    });
  }, [buildAnsweredQuestion, examAnswers, examElapsed, examQuestionIds, examSelAnswers, pickQuestionById, uiLang]);

  useEffect(() => () => {
    if (examTimerRef.current) clearInterval(examTimerRef.current);
  }, []);

  useEffect(() => {
    if (!isExam || !examStarted || showExamSummary) {
      if (examTimerRef.current) {
        clearInterval(examTimerRef.current);
        examTimerRef.current = null;
      }
      return;
    }
    examTimerRef.current = setInterval(() => setExamElapsed((p) => Math.min(p + 1, EXAM_TIME_LIMIT)), 1000);
    return () => {
      if (examTimerRef.current) {
        clearInterval(examTimerRef.current);
        examTimerRef.current = null;
      }
    };
  }, [isExam, examStarted, showExamSummary]);

  useEffect(() => {
    if (isExam && examStarted && examElapsed >= EXAM_TIME_LIMIT && !showExamSummary) {
      setExamForceEnd(true);
    }
  }, [examElapsed, isExam, examStarted, showExamSummary]);

  useEffect(() => {
    if (showExamSummary) {
      markExamCompletedToday();
      const pct = examTotal > 0 ? Math.round((examCorrectCount / examTotal) * 100) : 0;
      saveExamHistory(pct);
      setExamHistory(getExamHistory());
    }
  }, [examCorrectCount, examTotal, showExamSummary]);

  function handleStartExam(): void {
    const ids = buildExamQuestionIds(questionsData);
    setExamQuestionIds(ids);
    setExamIndex(0);
    setExamAnswers({});
    setExamSelAnswers({});
    setExamElapsed(0);
    setExamForceEnd(false);
    onEnterExamMode();
    setExamStarted(true);
  }

  function exitExam(): void {
    setExamStarted(false);
    setShowExitConfirm(false);
    setExamAnswers({});
    setExamSelAnswers({});
    setExamIndex(0);
    setExamElapsed(0);
    setExamForceEnd(false);
    onExitExam();
  }

  function resetExamStartScreen(): void {
    setExamStarted(false);
  }

  function handleExamAnswer(optionId: string): void {
    if (showExamSummary) return;
    const q = pickQuestionById(examQuestionIds[examIndex]);
    if (!q || examAnswers[q.id] !== undefined) return;
    const correct = optionId === q.correctOptionId;
    setExamAnswers((p) => ({ ...p, [q.id]: correct }));
    setExamSelAnswers((p) => ({ ...p, [q.id]: optionId }));
    updateQuestionProgress(q.id, correct);
    if (examIndex < examQuestionIds.length - 1) setExamIndex((p) => p + 1);
  }

  const examRemaining = Math.max(0, EXAM_TIME_LIMIT - examElapsed);
  const timerMin = Math.floor(examRemaining / 60);
  const timerSec = examRemaining % 60;
  const timerStr = `${timerMin}:${timerSec.toString().padStart(2, "0")}`;
  const timerPct = examRemaining / EXAM_TIME_LIMIT;
  const timerCritical = timerPct < 0.1;
  const timerWarning = !timerCritical && timerPct < 0.25;
  const timerBarColor = timerCritical ? "rgba(163,45,45,0.85)" : timerWarning ? "rgba(186,117,23,0.75)" : "rgba(91,159,255,0.6)";

  return {
    examAnswers,
    examAnsweredCount,
    examCorrectCount,
    examElapsed,
    examHistory,
    examIndex,
    examQuestion,
    examQuestionIds,
    examResult,
    examSelAnswers,
    examStarted,
    examTotal,
    exitExam,
    handleExamAnswer,
    handleStartExam,
    resetExamStartScreen,
    setShowExitConfirm,
    showExamSummary,
    showExitConfirm,
    timerBarColor,
    timerCritical,
    timerPct,
    timerStr,
    timerWarning,
  };
}
