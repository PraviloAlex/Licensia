import { useMemo, useState, useEffect, useRef } from "react";
import { Confetti } from "../components/Confetti";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { glossaryData, questionsData } from "../lib/data";
import { resolveQuestionGlossaryIds } from "../lib/glossaryLinkage";
import {
  buildExamQuestionIds,
  buildMistakesPracticeQuestionIds,
  buildPracticeQuestionIds,
  buildQuickSessionQuestionIds,
  buildSubtopicSessionQuestionIds,
  createPracticeSession,
  getCurrentPracticeSession,
  saveCurrentPracticeSession,
  updateQuestionProgress,
  PRACTICE_SESSION_SIZE,
  QUICK_SESSION_SIZE,
  shuffle,
  type PracticeSession,
} from "../lib/questionProgress";
import { addWordToReview, addWordsToReview } from "../lib/vocabularyStatus";
import { markExamCompletedToday } from "../lib/homeStats";
import type { VerifiedQuestion } from "../types/question";
import { getUILang, setUILang, t, type UILang } from "../lib/i18n";
import { getFontSizePref, setFontSizePref, type FontSizePref } from "../lib/fontSizePref";
import { EXAM_PASS_CORRECT, EXAM_PASS_PERCENT } from "../constants/exam";
import { SessionResultScreen } from "../screens/SessionResultScreen";
import { buildSessionResult, type AnsweredQuestion } from "../utils/buildSessionResult";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
function imgSrc(src: string): string {
  return BASE + (src.startsWith("/") ? src : "/" + src);
}


type LanguageMode = "both" | "es" | "ru";
type PracticeMode = "practice" | "exam";

const STORAGE_LANGUAGE  = "practice_language_mode";
const STORAGE_MODE      = "practice_mode";
const STORAGE_CONFIRM   = "practice_confirm_mode";
const STORAGE_EXAM_HIST = "exam_history_v1";
const EXAM_TIME_LIMIT   = 2700;

interface ExamHistoryData { attempts: number; bestPct: number; lastPct: number; lastDate: string; }

function readLanguageMode(): LanguageMode {
  if (typeof window === "undefined") return "both";
  const v = window.localStorage.getItem(STORAGE_LANGUAGE);
  return v === "es" || v === "ru" || v === "both" ? v : "both";
}
function readPracticeMode(): PracticeMode {
  if (typeof window === "undefined") return "practice";
  const v = window.localStorage.getItem(STORAGE_MODE);
  return v === "exam" || v === "practice" ? v : "practice";
}
function readConfirmMode(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(STORAGE_CONFIRM) === "1";
}
function getExamHistory(): ExamHistoryData {
  if (typeof window === "undefined") return { attempts: 0, bestPct: 0, lastPct: 0, lastDate: "" };
  try { const v = window.localStorage.getItem(STORAGE_EXAM_HIST); if (v) return JSON.parse(v); } catch {}
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
function pickQuestionById(id: string | undefined): VerifiedQuestion | null {
  if (!id) return null;
  return questionsData.find((q) => q.id === id) ?? null;
}

function getSubtopicLabel(subtopic: string | undefined, lang: UILang): string {
  const key = subtopic ?? "otros";
  const ru: Record<string, string> = {
    prioridad: "Приоритет",
    seguridad_vial: "Безопасность",
    senales: "Знаки",
    señales: "Знаки",
    estacionamiento: "Парковка",
    velocidad: "Скорость",
    mecanico: "Механика",
    documentos: "Документы",
    alcohol: "Алкоголь",
    otros: "Разное",
  };
  const es: Record<string, string> = {
    prioridad: "Prioridad",
    seguridad_vial: "Seguridad",
    senales: "Señales",
    señales: "Señales",
    estacionamiento: "Estacionamiento",
    velocidad: "Velocidad",
    mecanico: "Mecánica",
    documentos: "Documentos",
    alcohol: "Alcohol",
    otros: "General",
  };
  return (lang === "ru" ? ru : es)[key] ?? key.replace(/_/g, " ");
}

function getTopWrongTopics(questions: VerifiedQuestion[], lang: UILang): Array<{ label: string; count: number; pct: number }> {
  const map = new Map<string, number>();
  questions.forEach((q) => {
    const label = getSubtopicLabel(q.subtopic, lang);
    map.set(label, (map.get(label) ?? 0) + 1);
  });
  const max = Math.max(1, ...Array.from(map.values()));
  return Array.from(map.entries())
    .map(([label, count]) => ({ label, count, pct: Math.max(18, Math.round((count / max) * 100)) }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);
}

function buildAnsweredQuestion(params: {
  question: VerifiedQuestion;
  index: number;
  selectedOptionId?: string;
  isCorrect: boolean;
  lang: UILang;
}): AnsweredQuestion {
  const { question, index, selectedOptionId, isCorrect, lang } = params;
  const selectedOption = question.options.find((o) => o.id === selectedOptionId);
  const correctOption = question.options.find((o) => o.id === question.correctOptionId);

  return {
    id: question.id,
    number: index + 1,
    topic: getSubtopicLabel(question.subtopic, lang),
    question: question.question_es,
    selectedAnswer: selectedOption?.text_es ?? "Sin respuesta",
    correctAnswer: correctOption?.text_es ?? "",
    isCorrect,
  };
}
function getInitialPracticeSession(useMistakesOnly: boolean, useQuick: boolean, subtopicFilter?: string): PracticeSession {
  const persisted = getCurrentPracticeSession();
  const expectedSize = useQuick ? QUICK_SESSION_SIZE : PRACTICE_SESSION_SIZE;
  // For mistakes mode — never restore old session, always rebuild with current mistakes
  if (!useMistakesOnly && !subtopicFilter && persisted && !persisted.completedAt && persisted.currentIndex < persisted.questionIds.length && persisted.questionIds.length === expectedSize) return persisted;
  const questionIds = useQuick
    ? buildQuickSessionQuestionIds(questionsData)
    : useMistakesOnly ? buildMistakesPracticeQuestionIds(questionsData)
    : subtopicFilter ? buildSubtopicSessionQuestionIds(questionsData, subtopicFilter)
    : buildPracticeQuestionIds(questionsData);
  const session = createPracticeSession(questionIds);
  saveCurrentPracticeSession(session);
  return session;
}

export function PracticePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const explicitExam = searchParams.get("exam")     === "1";
  const mistakesOnly = searchParams.get("mistakes") === "1";
  const quickMode      = searchParams.get("quick")    === "1";
  const topicMode      = searchParams.get("topics")   === "1";
  const subtopicFilter = searchParams.get("subtopic") ?? undefined;

  // ── ALL useState ──────────────────────────────────────────────────────
  const [uiLang,           setUILang_]          = useState<UILang>(getUILang);
  const [languageMode,     setLanguageMode]      = useState<LanguageMode>(readLanguageMode);
  const [practiceMode,     setPracticeMode]      = useState<PracticeMode>(() => explicitExam ? "exam" : "practice");
  const [confirmMode,      setConfirmMode]       = useState<boolean>(readConfirmMode);
  const [fontSizePref,     setFontSizePref_]     = useState<FontSizePref>(getFontSizePref);
  const [imageBrokenForQId,setImageBrokenForQId] = useState<string | null>(null);
  const [imageModalSrc,    setImageModalSrc]     = useState<string | null>(null);
  const [practiceSession,  setPracticeSession]   = useState<PracticeSession>(() => getInitialPracticeSession(mistakesOnly, quickMode, subtopicFilter));
  const [selectedOptionId, setSelectedOptionId]  = useState<string | null>(() => {
    const qid = practiceSession.questionIds[practiceSession.currentIndex];
    return practiceSession.answers?.[qid]?.selectedOptionId ?? null;
  });
  const [showResult,       setShowResult]        = useState<boolean>(() => {
    const qid = practiceSession.questionIds[practiceSession.currentIndex];
    return Boolean(practiceSession.answers?.[qid]);
  });
  const [examQuestionIds,  setExamQuestionIds]   = useState<string[]>(() => buildExamQuestionIds(questionsData));
  const [examIndex,        setExamIndex]         = useState(0);
  const [examAnswers,      setExamAnswers]       = useState<Record<string, boolean>>({});
  const [examSelAnswers,   setExamSelAnswers]    = useState<Record<string, string>>({});
  const [examStarted,      setExamStarted]       = useState(false);
  const [showExitConfirm,  setShowExitConfirm]   = useState(false);
  const [examHistory,      setExamHistory]       = useState<ExamHistoryData>(getExamHistory);
  const [showConfetti,     setShowConfetti]      = useState(false);
  const [accordionOpen,    setAccordionOpen]     = useState<Record<string, boolean>>({ explain: true, memo: false, words: false });
  const [addedWordIds,     setAddedWordIds]      = useState<Set<string>>(new Set());
  const [gearOpen,         setGearOpen]          = useState(false);
  const [selectingOptionId,setSelectingOptionId] = useState<string | null>(null);
  const [pendingOptionId,  setPendingOptionId]   = useState<string | null>(null);
  const [examElapsed,      setExamElapsed]       = useState(0);
  const [examForceEnd,     setExamForceEnd]      = useState(false);

  // ── ALL useRef ────────────────────────────────────────────────────
  const confettiTimer = useRef<ReturnType<typeof setTimeout>  | null>(null);
  const gearRef       = useRef<HTMLDivElement>(null);
  const examTimerRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const touchStartX   = useRef<number | null>(null);
  const liveRef       = useRef({
    isExam: false, question: null as VerifiedQuestion | null,
    showAnswerState: false, showPracticeSummary: false, showExamSummary: false,
    selectingOptionId: null as string | null, confirmMode: false, pendingOptionId: null as string | null,
  });

  // ── Derived values ────────────────────────────────────────────────
  const isExam            = practiceMode === "exam";
  const practiceTotal     = practiceSession.questionIds.length;
  const examTotal         = examQuestionIds.length;
  const examAnsweredCount = Object.keys(examAnswers).length;
  const examCorrectCount  = Object.values(examAnswers).filter(Boolean).length;
  const showPracticeSummary = !isExam && practiceSession.completedAt !== null;
  const showExamSummary     = isExam && examStarted && (examAnsweredCount >= examTotal || examForceEnd);
  const practiceQuestion  = pickQuestionById(practiceSession.questionIds[practiceSession.currentIndex]);
  const examQuestion      = pickQuestionById(examQuestionIds[examIndex]);
  const question          = isExam ? examQuestion : practiceQuestion;
  const selectedId        = isExam ? null : selectedOptionId;
  const showAnswerState   = isExam ? false : showResult;

  const linkedGlossaryIds = question ? resolveQuestionGlossaryIds(question) : [];
  const isCorrect         = question ? selectedId === question.correctOptionId : false;
  const visualAnalysisRu  = question ? ((question as unknown as { visualAnalysis_ru?: string }).visualAnalysis_ru ?? "").trim() : "";

  // ── ALL useMemo — before any conditional return ───────────────────────────────────
  const selectedOption = useMemo(
    () => question?.options.find((o) => o.id === selectedId) ?? null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [question?.id, selectedId],
  );
  const correctOption = useMemo(
    () => question?.options.find((o) => o.id === question?.correctOptionId) ?? null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [question?.id, question?.correctOptionId],
  );
  const relatedWords = useMemo(
    () => glossaryData.filter((word) => linkedGlossaryIds.includes(word.id)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [linkedGlossaryIds.join(",")],
  );

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
      durationMinutes: quickMode ? 8 : Math.max(8, Math.round(answeredQuestions.length * 1.6)),
    });
  }, [practiceSession.answers, practiceSession.questionIds, quickMode, uiLang]);

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
  }, [examAnswers, examElapsed, examQuestionIds, examSelAnswers, uiLang]);

  liveRef.current = { isExam, question, showAnswerState, showPracticeSummary, showExamSummary, selectingOptionId, confirmMode, pendingOptionId };

  const examRemaining = Math.max(0, EXAM_TIME_LIMIT - examElapsed);
  const timerMin      = Math.floor(examRemaining / 60);
  const timerSec      = examRemaining % 60;
  const timerStr      = `${timerMin}:${timerSec.toString().padStart(2, "0")}`;
  const timerPct      = examRemaining / EXAM_TIME_LIMIT;
  const timerCritical = timerPct < 0.1;
  const timerWarning  = !timerCritical && timerPct < 0.25;
  const timerBarColor = timerCritical ? "rgba(163,45,45,0.85)" : timerWarning ? "rgba(186,117,23,0.75)" : "rgba(91,159,255,0.6)";

  const showSpanish   = languageMode === "both" || languageMode === "es" || isExam;
  const showRussian   = !isExam && (languageMode === "both" || languageMode === "ru");
  const resultLang: UILang = isExam || languageMode === "es" ? "es" : languageMode === "ru" ? "ru" : uiLang;
  const practiceTitleKey = mistakesOnly ? "pv2.title.mistakes" : topicMode ? "pv2.title.topics" : "pv2.title.practice";
  const optionLetters = ["A", "B", "C", "D", "E"];
  const practiceDots  = practiceSession.questionIds.map((qid, i) => {
    if (i < practiceSession.currentIndex) return practiceSession.answers?.[qid]?.isCorrect ? "ok" : "err";
    if (i === practiceSession.currentIndex) return "cur";
    return "empty";
  });

  const nextBtnActive    = showAnswerState || (confirmMode && !!pendingOptionId);
  const nextBtnIsConfirm = confirmMode && !showAnswerState && !!pendingOptionId;
  const nextBtnLabel     = nextBtnIsConfirm ? t("pv2.confirm", uiLang) : t("pv2.next", uiLang);

  // ── ALL useEffect — unconditional ───────────────────────────────────────
  useEffect(() => () => { if (confettiTimer.current) clearTimeout(confettiTimer.current); }, []);
  useEffect(() => () => { if (examTimerRef.current)  clearInterval(examTimerRef.current);  }, []);

  useEffect(() => {
    if (!gearOpen) return;
    const fn = (e: MouseEvent) => { if (gearRef.current && !gearRef.current.contains(e.target as Node)) setGearOpen(false); };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, [gearOpen]);

  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      const s = liveRef.current;
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || e.metaKey || e.ctrlKey || e.altKey) return;
      if (s.showPracticeSummary || s.showExamSummary) return;
      if ((e.key === " " || e.key === "Enter") && s.showAnswerState) { e.preventDefault(); goNextPracticeQuestion(); return; }
      if ((e.key === " " || e.key === "Enter") && s.confirmMode && s.pendingOptionId && !s.showAnswerState) { e.preventDefault(); handleConfirmOrNext(); return; }
      if (!s.showAnswerState && !s.isExam && !s.selectingOptionId && s.question) {
        const idx = ({ a:0,b:1,c:2,d:3,e:4 } as Record<string,number>)[e.key.toLowerCase()];
        if (idx !== undefined) { const opt = s.question.options[idx]; if (opt) handleOptionClick(opt.id); }
      }
    };
    document.addEventListener("keydown", fn);
    return () => document.removeEventListener("keydown", fn);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isExam || !examStarted || showExamSummary) {
      if (examTimerRef.current) { clearInterval(examTimerRef.current); examTimerRef.current = null; }
      return;
    }
    examTimerRef.current = setInterval(() => setExamElapsed((p) => Math.min(p + 1, EXAM_TIME_LIMIT)), 1000);
    return () => { if (examTimerRef.current) { clearInterval(examTimerRef.current); examTimerRef.current = null; } };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isExam, examStarted, showExamSummary]);

  useEffect(() => {
    if (isExam && examStarted && examElapsed >= EXAM_TIME_LIMIT && !showExamSummary) {
      setExamForceEnd(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examElapsed, isExam, examStarted]);

  useEffect(() => {
    if (showExamSummary) {
      markExamCompletedToday();
      const pct = examTotal > 0 ? Math.round((examCorrectCount / examTotal) * 100) : 0;
      saveExamHistory(pct);
      setExamHistory(getExamHistory());
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showExamSummary]);

  // ── Static early guard only ───────────────────────────────────────────────
  if (questionsData.length === 0) return (
    <main className="page-wrap"><section className="page practice-v2-page"><article className={isExam && examStarted ? "practice-v2 practice-v2--exam" : "practice-v2"}>
      <h2>Нет проверенных вопросов. Запустите импорт.</h2>
    </article></section></main>
  );

  // ── Session / answer functions ────────────────────────────────────────────────────
  function setLanguage(next: LanguageMode) {
    setLanguageMode(next);
    if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_LANGUAGE, next);
  }
  function setMode(next: PracticeMode) {
    setPracticeMode(next);
    // practice_mode not saved to localStorage — prevents exam mode from sticking
  }
  function toggleConfirmMode() {
    const next = !confirmMode; setConfirmMode(next); setPendingOptionId(null);
    if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_CONFIRM, next ? "1" : "0");
  }
  function handleUILangChange(lang: UILang) {
    setUILang(lang);
    setUILang_(lang);
    window.dispatchEvent(new Event("ui-lang-changed"));
    window.location.reload();
  }
  function startPracticeSession(useMistakesOnly: boolean, useQuick = false, specificIds?: string[]) {
    const nextIds = specificIds ? shuffle(specificIds)
      : useQuick ? buildQuickSessionQuestionIds(questionsData)
      : useMistakesOnly ? buildMistakesPracticeQuestionIds(questionsData) : buildPracticeQuestionIds(questionsData);
    const nextSession = createPracticeSession(nextIds);
    saveCurrentPracticeSession(nextSession);
    setPracticeSession(nextSession);
    setSelectedOptionId(null); setShowResult(false); setPendingOptionId(null); setImageBrokenForQId(null);
    setMode("practice");
  }
  function handleStartExam() {
    const ids = buildExamQuestionIds(questionsData);
    setExamQuestionIds(ids);
    setExamIndex(0);
    setExamAnswers({});
    setExamSelAnswers({});
    setExamElapsed(0);
    setExamForceEnd(false);
    setPendingOptionId(null);
    setLanguageMode("es"); // exam-only: don't persist to localStorage
    setMode("exam");
    setExamStarted(true);
  }
  function exitExam() {
    setExamStarted(false); setShowExitConfirm(false);
    setExamAnswers({}); setExamSelAnswers({}); setExamIndex(0); setExamElapsed(0); setExamForceEnd(false);
    navigate("/", { replace: true });
  }
  function handleOptionClick(optionId: string) {
    if (isExam) {
      const currentQid = examQuestionIds[examIndex];
      if (examAnswers[currentQid] !== undefined || !!selectingOptionId) return;
      setSelectingOptionId(optionId);
      setTimeout(() => { setSelectingOptionId(null); handleExamAnswer(optionId); }, 120);
      return;
    }
    if (showAnswerState || selectingOptionId) return;
    if (confirmMode) { setPendingOptionId((p) => p === optionId ? null : optionId); return; }
    setSelectingOptionId(optionId);
    setTimeout(() => { setSelectingOptionId(null); handlePracticeAnswer(optionId); }, 150);
  }
  function handleConfirmOrNext() {
    if (confirmMode && !showAnswerState && pendingOptionId) {
      const id = pendingOptionId; setPendingOptionId(null); setSelectingOptionId(id);
      setTimeout(() => { setSelectingOptionId(null); handlePracticeAnswer(id); }, 150);
      return;
    }
    if (showAnswerState) goNextPracticeQuestion();
  }
  function handlePracticeAnswer(optionId: string) {
    if (showResult || practiceSession.completedAt) return;
    const qid = practiceSession.questionIds[practiceSession.currentIndex];
    if (!qid) return;
    const q = pickQuestionById(qid);
    if (!q) return;
    const correct = optionId === q.correctOptionId;
    setSelectedOptionId(optionId); setShowResult(true);
    if (correct) { setShowConfetti(true); confettiTimer.current = setTimeout(() => setShowConfetti(false), 1400); }
    updateQuestionProgress(q.id, correct);
    if (!correct) addWordsToReview(resolveQuestionGlossaryIds(q));
    const answers = { ...(practiceSession.answers ?? {}), [q.id]: { selectedOptionId: optionId, isCorrect: correct } };
    const nextSession: PracticeSession = { ...practiceSession, answers, correctCount: (practiceSession.correctCount ?? 0) + (correct ? 1 : 0), wrongCount: (practiceSession.wrongCount ?? 0) + (correct ? 0 : 1) };
    setPracticeSession(nextSession); saveCurrentPracticeSession(nextSession);
  }
  function goNextPracticeQuestion() {
    if (!showResult || practiceSession.completedAt) return;
    const isLast = practiceSession.currentIndex >= practiceSession.questionIds.length - 1;
    const nextSession: PracticeSession = isLast
      ? { ...practiceSession, completedAt: new Date().toISOString() }
      : { ...practiceSession, currentIndex: practiceSession.currentIndex + 1 };
    setPracticeSession(nextSession); saveCurrentPracticeSession(nextSession);
    setImageBrokenForQId(null); setAccordionOpen({ explain: true, memo: false, words: false });
    setAddedWordIds(new Set()); setPendingOptionId(null);
    const nextQid = nextSession.questionIds[nextSession.currentIndex];
    const nextAnswered = Boolean(nextSession.answers?.[nextQid]);
    setShowResult(nextAnswered);
    setSelectedOptionId(nextAnswered ? nextSession.answers?.[nextQid]?.selectedOptionId ?? null : null);
  }
  function goToPracticeQuestion(index: number) {
    if (index >= practiceSession.currentIndex || !!practiceSession.completedAt) return;
    const nextSession: PracticeSession = { ...practiceSession, currentIndex: index };
    setPracticeSession(nextSession); saveCurrentPracticeSession(nextSession);
    setImageBrokenForQId(null); setAccordionOpen({ explain: true, memo: false, words: false });
    setAddedWordIds(new Set()); setPendingOptionId(null);
    const qid = nextSession.questionIds[index];
    const answered = Boolean(nextSession.answers?.[qid]);
    setShowResult(answered);
    setSelectedOptionId(answered ? nextSession.answers?.[qid]?.selectedOptionId ?? null : null);
  }
  function handleExamAnswer(optionId: string) {
    if (showExamSummary) return;
    const q = pickQuestionById(examQuestionIds[examIndex]);
    if (!q || examAnswers[q.id] !== undefined) return;
    const correct = optionId === q.correctOptionId;
    setExamAnswers((p) => ({ ...p, [q.id]: correct }));
    setExamSelAnswers((p) => ({ ...p, [q.id]: optionId }));
    updateQuestionProgress(q.id, correct);
    if (examIndex < examQuestionIds.length - 1) setExamIndex((p) => p + 1);
  }
  function toggleAccordion(key: string) { setAccordionOpen((p) => ({ ...p, [key]: !p[key] })); }
  function handleAddChipWord(wordId: string) { addWordToReview(wordId); setAddedWordIds((p) => new Set([...p, wordId])); }
  function handleTouchStart(e: React.TouchEvent) { touchStartX.current = e.touches[0].clientX; }
  function handleTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null) return;
    const dx = touchStartX.current - e.changedTouches[0].clientX;
    touchStartX.current = null;
    if (dx < -60 && showAnswerState) goNextPracticeQuestion();
  }

  // ── JSX ───────────────────────────────────────────────────────────────────────────────────
  return (
    <main className="page-wrap" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      <section className="page practice-v2-page">
        <article className={isExam && examStarted ? "practice-v2 practice-v2--exam" : "practice-v2"}>

          {/* EXAM START SCREEN */}
          {isExam && !examStarted && !showExamSummary && (
            <div className="pv2-exam-start">
              <Link to="/" className="pv2-back pv2-exam-start-back" aria-label={t("pv2.home", uiLang)}>
                <i className="ti ti-arrow-left" aria-hidden="true" />
              </Link>
              <div className="pv2-exam-start-hero">
                <div className="pv2-exam-start-emblem"><i className="ti ti-clipboard-check" /></div>
                <h1 className="pv2-exam-start-title">{t("pv2.title.exam", uiLang)}</h1>
                <p className="pv2-exam-start-subtitle">{t("pv2.exam.subtitle", uiLang)}</p>
              </div>
              <div className="pv2-exam-start-params">
                <div className="pv2-esp-row">
                  <div className="pv2-esp-item"><i className="ti ti-list-numbers" /><span>{examTotal} {t("pv2.exam.questions", uiLang)}</span></div>
                  <div className="pv2-esp-item"><i className="ti ti-clock" /><span>{t("pv2.exam.minutes", uiLang)}</span></div>
                </div>
                <div className="pv2-esp-row">
                  <div className="pv2-esp-item"><i className="ti ti-language" /><span>{t("pv2.exam.lang", uiLang)}</span></div>
                  <div className="pv2-esp-item"><i className="ti ti-trophy" /><span>{t("pv2.exam.pass", uiLang)}</span></div>
                </div>
                <div className="pv2-esp-row pv2-esp-row--warn">
                  <div className="pv2-esp-item pv2-esp-item--warn"><i className="ti ti-eye-off" /><span>{t("pv2.exam.resultEnd", uiLang)}</span></div>
                </div>
              </div>
              {examHistory.attempts > 0 && (
                <div className="pv2-exam-start-history">
                  <div className="pv2-esh-item"><span className="pv2-esh-label">{t("pv2.exam.attempts", uiLang)}</span><span className="pv2-esh-val">{examHistory.attempts}</span></div>
                  <div className="pv2-esh-sep" />
                  <div className="pv2-esh-item"><span className="pv2-esh-label">{t("pv2.exam.best", uiLang)}</span><span className={examHistory.bestPct >= EXAM_PASS_PERCENT ? "pv2-esh-val pv2-esh-val--pass" : "pv2-esh-val pv2-esh-val--fail"}>{examHistory.bestPct}%</span></div>
                  <div className="pv2-esh-sep" />
                  <div className="pv2-esh-item"><span className="pv2-esh-label">{t("pv2.exam.last", uiLang)}</span><span className={examHistory.lastPct >= EXAM_PASS_PERCENT ? "pv2-esh-val pv2-esh-val--pass" : "pv2-esh-val pv2-esh-val--fail"}>{examHistory.lastPct}%</span></div>
                </div>
              )}
              <button type="button" className="pv2-exam-start-btn" onClick={handleStartExam}>
                {t("pv2.exam.startBtn", uiLang)}
              </button>
              <button type="button" className="pv2-exam-start-practice" onClick={() => { setMode("practice"); navigate("/practice", { replace: true }); }}>
                {t("pv2.exam.toPractice", uiLang)}
              </button>
            </div>
          )}

          {/* EXAM ACTIVE */}
          {isExam && examStarted && !showExamSummary && (
            <>
              {gearOpen && <div className="pv2-gear-backdrop" onClick={() => setGearOpen(false)} aria-hidden="true" />}
              {showExitConfirm && (
                <div className="pv2-exit-overlay" role="dialog" aria-modal="true">
                  <div className="pv2-exit-dialog">
                    <div className="pv2-exit-icon"><i className="ti ti-alert-triangle" /></div>
                    <h3 className="pv2-exit-title">{t("pv2.exit.title", uiLang)}</h3>
                    <p className="pv2-exit-sub">{t("pv2.exit.sub", uiLang)}</p>
                    <div className="pv2-exit-actions">
                      <button type="button" className="pv2-exit-btn-leave" onClick={exitExam}>{t("pv2.exit.leave", uiLang)}</button>
                      <button type="button" className="pv2-exit-btn-stay"  onClick={() => setShowExitConfirm(false)}>{t("pv2.exit.stay", uiLang)}</button>
                    </div>
                  </div>
                </div>
              )}
              <div className="pv2-timer-bar">
                <div className="pv2-timer-fill" style={{ width: `${timerPct * 100}%`, background: timerBarColor }} />
              </div>
              <div className="pv2-toolbar">
                <div className="pv2-tb-left">
                  <button type="button" className="pv2-back" aria-label={t("pv2.exitExam", uiLang)} onClick={() => setShowExitConfirm(true)}>
                    <i className="ti ti-x" aria-hidden="true" />
                  </button>
                </div>
                <div className="pv2-exam-tb-center">
                  <span className="pv2-title">{t("pv2.title.exam", uiLang)}</span>
                  <span className={["pv2-exam-timer", timerCritical ? "pv2-exam-timer--critical" : timerWarning ? "pv2-exam-timer--warning" : ""].filter(Boolean).join(" ")}>
                    <i className="ti ti-clock" aria-hidden="true" /> {timerStr}
                  </span>
                </div>
                <div className="pv2-tb-right">
                  <span className="pv2-counter">{Math.min(examIndex + 1, examTotal)} / {examTotal}</span>
                </div>
              </div>
              {question && (
                <>
                  <div className="pv2-dots">
                    {examQuestionIds.map((qid, i) => {
                      const done  = examAnswers[qid] !== undefined;
                      const state = done ? "done" : i === examIndex ? "cur" : "empty";
                      return <span key={i} className={`pv2-dot pv2-dot--${state}`} />;
                    })}
                  </div>
                  <div className="pv2-badge-row">
                    <span className="pv2-badge">{question.topic}</span>
                    <span className="pv2-exam-tag"><i className="ti ti-clipboard-check" /> {t("pv2.exam.tag", uiLang)}</span>
                  </div>
                  <h2 className="pv2-question-es">{question.question_es}</h2>
                  {question.image?.src && imageBrokenForQId !== question.id && (
                    <div className="pv2-image-wrap">
                      <img src={imgSrc(question.image.src)} alt="Imagen de la pregunta" className="pv2-image"
                        onError={() => setImageBrokenForQId(question.id)}
                        onClick={() => setImageModalSrc(question.image?.src ? imgSrc(question.image.src) : null)}
                      />
                    </div>
                  )}
                  <div className="pv2-options">
                    {question.options.map((option, idx) => {
                      const isSelecting     = selectingOptionId === option.id;
                      const alreadyAnswered = examAnswers[examQuestionIds[examIndex]] !== undefined;
                      const cls = ["pv2-option", isSelecting ? "pv2-option--selecting" : "", alreadyAnswered ? "pv2-option--frozen" : ""].filter(Boolean).join(" ");
                      return (
                        <button key={option.id} type="button" className={cls}
                          onClick={() => handleOptionClick(option.id)}
                          disabled={alreadyAnswered || !!selectingOptionId}
                        >
                          <span className="pv2-option-letter">{optionLetters[idx] ?? String(idx + 1)}</span>
                          <span className="pv2-option-content">
                            <span className="pv2-option-es">{option.text_es}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </>
          )}

          {/* PRACTICE ACTIVE */}
          {!isExam && (
            <>
              {!showPracticeSummary && gearOpen && <div className="pv2-gear-backdrop" onClick={() => setGearOpen(false)} aria-hidden="true" />}
              {!showPracticeSummary && <div className="pv2-toolbar">
                <div className="pv2-tb-left">
                  <Link to="/" className="pv2-back" aria-label={t("pv2.home", uiLang)}><i className="ti ti-arrow-left" aria-hidden="true" /></Link>
                  <div className="pv2-lang-group" role="group">
                    <button type="button" className={languageMode === "both" ? "pv2-lang-btn pv2-lang-btn--active" : "pv2-lang-btn"} onClick={() => setLanguage("both")}>ES·RU</button>
                    <button type="button" className={languageMode === "es"   ? "pv2-lang-btn pv2-lang-btn--active" : "pv2-lang-btn"} onClick={() => setLanguage("es")}>ES</button>
                    <button type="button" className={languageMode === "ru"   ? "pv2-lang-btn pv2-lang-btn--active" : "pv2-lang-btn"} onClick={() => setLanguage("ru")}>RU</button>
                  </div>
                </div>
                <span className="pv2-title">{t(practiceTitleKey, uiLang)}</span>
                <div className="pv2-tb-right">
                  <span className="pv2-counter">{Math.min(practiceSession.currentIndex + 1, practiceTotal)} / {practiceTotal}</span>
                  <div className="pv2-gear-wrap" ref={gearRef}>
                    <button type="button" className={gearOpen ? "pv2-gear-btn pv2-gear-btn--open" : "pv2-gear-btn"} onClick={() => setGearOpen((v) => !v)} aria-label={t("pv2.settings", uiLang)} aria-expanded={gearOpen}>
                      <i className="ti ti-settings" aria-hidden="true" />
                    </button>
                    {gearOpen && (
                      <div className="pv2-gear-menu" role="dialog" aria-label={t("pv2.settings", uiLang)}>
                        <div className="pv2-gear-section-label">{t("pv2.gear.answers", uiLang)}</div>
                        <button type="button" className="pv2-gear-item" onClick={toggleConfirmMode}>
                          <span className="pv2-gear-ico pv2-gear-ico--blue"><i className="ti ti-hand-finger" /></span>
                          <span className="pv2-gear-text">
                            <span className="pv2-gear-label">{confirmMode ? t("pv2.gear.standardLabel", uiLang) : t("pv2.gear.quickLabel", uiLang)}</span>
                            <span className="pv2-gear-sub">{confirmMode ? t("pv2.gear.confirmOn", uiLang) : t("pv2.gear.confirmOff", uiLang)}</span>
                          </span>
                          <span className={confirmMode ? "pv2-toggle" : "pv2-toggle pv2-toggle--on"} aria-hidden="true"><span className="pv2-toggle-thumb" /></span>
                        </button>
                        <div className="pv2-gear-section-label">{t("pv2.gear.mode", uiLang)}</div>
                        <button type="button" className="pv2-gear-item" onClick={() => setGearOpen(false)}>
                          <span className="pv2-gear-ico pv2-gear-ico--teal"><i className="ti ti-book" /></span>
                          <span className="pv2-gear-text"><span className="pv2-gear-label">{t("pv2.gear.practice", uiLang)}</span><span className="pv2-gear-sub">{t("pv2.gear.practiceHint", uiLang)}</span></span>
                          <span className="pv2-gear-badge pv2-gear-badge--on">{t("pv2.gear.on", uiLang)}</span>
                        </button>
                        <button type="button" className="pv2-gear-item" onClick={() => { setMode("exam"); setExamStarted(false); setGearOpen(false); navigate("/practice?exam=1", { replace: true }); }}>
                          <span className="pv2-gear-ico pv2-gear-ico--amber"><i className="ti ti-clipboard-check" /></span>
                          <span className="pv2-gear-text"><span className="pv2-gear-label">{t("pv2.gear.exam", uiLang)}</span><span className="pv2-gear-sub">{t("pv2.gear.examHint", uiLang)}</span></span>
                        </button>
                        <div className="pv2-gear-section-label">{t("pv2.gear.uiLang", uiLang)}</div>
                        <div className="pv2-gear-lang-row">
                          <button type="button" className={uiLang === "ru" ? "pv2-gear-lang-btn pv2-gear-lang-btn--active" : "pv2-gear-lang-btn"} onClick={() => handleUILangChange("ru")}>
                            🇷🇺 {t("pv2.gear.uiRu", uiLang)}
                          </button>
                          <button type="button" className={uiLang === "es" ? "pv2-gear-lang-btn pv2-gear-lang-btn--active" : "pv2-gear-lang-btn"} onClick={() => handleUILangChange("es")}>
                            🇦🇷 {t("pv2.gear.uiEs", uiLang)}
                          </button>
                        </div>
                        <div className="pv2-gear-section-label">{t("pv2.gear.fontSize", uiLang)}</div>
                        <div className="pv2-gear-font-row">
                          {(["normal","large","huge"] as FontSizePref[]).map((p, i) => (
                            <button key={p} type="button"
                              className={fontSizePref === p ? "pv2-font-pill pv2-font-pill--active" : "pv2-font-pill"}
                              onClick={() => { setFontSizePref(p); setFontSizePref_(p); }}
                              style={{ fontSize: ["0.72rem","1.0rem","1.38rem"][i] }}>A</button>
                          ))}
                        </div>
                        <div className="pv2-gear-divider" />
                        <button type="button" className="pv2-gear-item pv2-gear-item--danger" onClick={() => { startPracticeSession(false); setGearOpen(false); }}>
                          <span className="pv2-gear-ico pv2-gear-ico--red"><i className="ti ti-refresh" /></span>
                          <span className="pv2-gear-text"><span className="pv2-gear-label">{t("pv2.gear.reset", uiLang)}</span></span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>}

              {!showPracticeSummary && question && (
                <>
                  <div className="pv2-dots" role="progressbar">
                    {practiceDots.map((state, i) => {
                      const clickable = (state === "ok" || state === "err") && i < practiceSession.currentIndex;
                      return (
                        <span key={i}
                          className={`pv2-dot pv2-dot--${state}${clickable ? " pv2-dot--clickable" : ""}`}
                          onClick={clickable ? () => goToPracticeQuestion(i) : undefined}
                          title={clickable ? `${t("pv2.dot.q", uiLang)} ${i + 1}` : undefined}
                        />
                      );
                    })}
                  </div>
                  <div className="pv2-q-layout">
                  <div className="pv2-q-left">
                  <div className="pv2-badge-row"><span className="pv2-badge">{question.topic}</span></div>
                  {showSpanish && <h2 className="pv2-question-es">{question.question_es}</h2>}
                  {showRussian && <p className="pv2-question-ru">{question.question_ru}</p>}
                  {question.image?.src && imageBrokenForQId !== question.id && (
                    <div className={showAnswerState ? "pv2-image-wrap pv2-image-wrap--frozen" : "pv2-image-wrap"}>
                      <img src={imgSrc(question.image.src)} alt="Imagen de la pregunta" className="pv2-image"
                        onError={() => setImageBrokenForQId(question.id)}
                        onClick={() => setImageModalSrc(question.image?.src ? imgSrc(question.image.src) : null)}
                      />
                    </div>
                  )}
                  </div>
                  <div className="pv2-q-right">
                  <div className="pv2-options">
                    {question.options.map((option, idx) => {
                      const isSelected  = selectedId === option.id;
                      const isRight     = showAnswerState && option.id === question.correctOptionId;
                      const isWrong     = showAnswerState && isSelected && option.id !== question.correctOptionId;
                      const frozen      = showAnswerState && !isRight && !isWrong;
                      const isSelecting = selectingOptionId === option.id;
                      const isPending   = !showAnswerState && confirmMode && pendingOptionId === option.id;
                      const cls = ["pv2-option", isRight ? "pv2-option--correct" : "", isWrong ? "pv2-option--wrong" : "", frozen ? "pv2-option--frozen" : "", isSelecting ? "pv2-option--selecting" : "", isPending ? "pv2-option--pending" : ""].filter(Boolean).join(" ");
                      return (
                        <button key={option.id} type="button" className={cls}
                          onClick={() => handleOptionClick(option.id)}
                          disabled={showAnswerState || !!selectingOptionId}
                        >
                          <span className={["pv2-option-letter", isRight ? "pv2-option-letter--correct" : "", isWrong ? "pv2-option-letter--wrong" : "", isPending ? "pv2-option-letter--pending" : ""].filter(Boolean).join(" ")}>
                            {optionLetters[idx] ?? String(idx + 1)}
                          </span>
                          <span className="pv2-option-content">
                            {showSpanish && <span className="pv2-option-es">{option.text_es}</span>}
                            {showRussian && <span className="pv2-option-ru">{option.text_ru}</span>}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <button type="button"
                    className={["pv2-next", nextBtnActive ? "pv2-next--active" : "pv2-next--disabled", nextBtnIsConfirm ? "pv2-next--confirm" : ""].filter(Boolean).join(" ")}
                    onClick={handleConfirmOrNext} disabled={!nextBtnActive}
                  >{nextBtnLabel}</button>
                  {showAnswerState && (
                    <div className={isCorrect ? "pv2-sheet pv2-sheet--correct result-enter" : "pv2-sheet pv2-sheet--wrong result-enter"}>
                      <div className="pv2-sheet-result">
                        <span className="pv2-sheet-label">{isCorrect ? t("pv2.correct", uiLang) : t("pv2.wrong", uiLang)}</span>
                        {correctOption && <p className="pv2-sheet-answer">{correctOption.text_es}</p>}
                        {!isCorrect && correctOption?.text_ru && <p className="pv2-sheet-sub">{correctOption.text_ru}</p>}
                      </div>
                      <div className="pv2-accordion">
                        {((question as unknown as { whyCorrect_ru?: string }).whyCorrect_ru || (question.image?.src && visualAnalysisRu)) && (
                          <div className="pv2-acc-item">
                            <button type="button" className="pv2-acc-header" onClick={() => toggleAccordion("explain")}>
                              <span className="pv2-acc-icon pv2-acc-icon--teal"><i className="ti ti-book-2" /></span>
                              <span className="pv2-acc-title">{t("pv2.acc.explain", uiLang)}</span>
                              <span className={accordionOpen.explain ? "pv2-acc-chev pv2-acc-chev--open" : "pv2-acc-chev"}><i className="ti ti-chevron-right" /></span>
                            </button>
                            {accordionOpen.explain && (
                              <div className="pv2-acc-body">
                                {question.image?.src && visualAnalysisRu && <p>{visualAnalysisRu}</p>}
                                {(question as unknown as { whyCorrect_ru?: string }).whyCorrect_ru && <p>{(question as unknown as { whyCorrect_ru?: string }).whyCorrect_ru}</p>}
                              </div>
                            )}
                          </div>
                        )}
                        {question.memoryHint_ru && (
                          <div className="pv2-acc-item">
                            <button type="button" className="pv2-acc-header" onClick={() => toggleAccordion("memo")}>
                              <span className="pv2-acc-icon pv2-acc-icon--amber"><i className="ti ti-bulb" /></span>
                              <span className="pv2-acc-title">{t("pv2.acc.memo", uiLang)}</span>
                              <span className={accordionOpen.memo ? "pv2-acc-chev pv2-acc-chev--open" : "pv2-acc-chev"}><i className="ti ti-chevron-right" /></span>
                            </button>
                            {accordionOpen.memo && <div className="pv2-acc-body"><p>{question.memoryHint_ru}</p></div>}
                          </div>
                        )}
                        {relatedWords.length > 0 && (
                          <div className="pv2-acc-item">
                            <button type="button" className="pv2-acc-header" onClick={() => toggleAccordion("words")}>
                              <span className="pv2-acc-icon pv2-acc-icon--purple"><i className="ti ti-vocabulary" /></span>
                              <span className="pv2-acc-title">{t("pv2.acc.words", uiLang)}</span>
                              <span className="pv2-acc-badge">{relatedWords.length}</span>
                              <span className={accordionOpen.words ? "pv2-acc-chev pv2-acc-chev--open" : "pv2-acc-chev"}><i className="ti ti-chevron-right" /></span>
                            </button>
                            {accordionOpen.words && (
                              <div className="pv2-acc-body">
                                {!isCorrect && <p className="pv2-acc-note">{t("pv2.acc.wordsAuto", uiLang)}</p>}
                                <div className="pv2-chips">
                                  {relatedWords.map((word) => {
                                    const added = addedWordIds.has(word.id) || !isCorrect;
                                    return (
                                      <div key={word.id} className="pv2-chip">
                                        <span className="pv2-chip-term">{word.term_es}</span>
                                        <span className="pv2-chip-sep">·</span>
                                        <span className="pv2-chip-trans">{word.translation_ru}</span>
                                        <button type="button" className={added ? "pv2-chip-btn pv2-chip-btn--added" : "pv2-chip-btn"} onClick={() => !added && handleAddChipWord(word.id)}>
                                          {added ? "✓" : "+"}
                                        </button>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  </div>
                  </div>
                </>
              )}

              {showPracticeSummary && (() => {
                const correct = practiceSession.correctCount ?? 0;
                const wrong   = practiceSession.wrongCount   ?? 0;
                const isPerfect = wrong === 0 && correct > 0;
                const mistakeIds = Object.entries(practiceSession.answers ?? {}).filter(([, a]) => !a.isCorrect).map(([id]) => id);
                const mistakeQuestions = questionsData.filter((q) => mistakeIds.includes(q.id));
                const topTopics = getTopWrongTopics(mistakeQuestions, uiLang);
                // In mistakes mode: ring shows completion (always 100% when done); else accuracy
                const pct = mistakesOnly
                  ? 100
                  : practiceTotal > 0 ? Math.round((correct / practiceTotal) * 100) : 0;
                const scoreColor = mistakesOnly ? "#62f4b4" : pct >= 80 ? "#62f4b4" : pct >= 60 ? "#7db8ff" : "#ffb869";
                const scoreLabel = mistakesOnly
                  ? t("pv2.sum.mistakesDone", uiLang)
                  : pct >= 80 ? t("pv2.sum.excellent", uiLang) : pct >= 60 ? t("pv2.sum.good", uiLang) : t("pv2.sum.retry", uiLang);
                const isRu = uiLang === "ru";
                const reviewLead = wrong > 0
                  ? isRu ? "Ошибки уже собраны в короткую тренировку. Лучше закрепить их сейчас, пока свежо." : "Tus errores ya están listos para una práctica corta. Conviene reforzarlos ahora."
                  : isRu ? "Серия закрыта чисто. Можно продолжить темп или перейти к новой тренировке." : "Serie limpia. Podés mantener el ritmo o empezar una nueva práctica.";
                const diagnosisTitle = wrong > 0
                  ? `${isRu ? "Главная слабая зона" : "Zona débil principal"}: ${topTopics[0]?.label ?? (isRu ? "разбор ошибок" : "repaso")}`
                  : isRu ? "Ошибок нет: закрепляем темп" : "Sin errores: mantené el ritmo";
                const diagnosisText = wrong > 0
                  ? isRu ? "Приложение предлагает следующий лучший шаг, а не просто список ошибок." : "La app propone el siguiente paso útil, no solo una lista de errores."
                  : isRu ? "Следующий блок поможет не потерять уверенность и добрать стабильность." : "El siguiente bloque ayuda a mantener confianza y estabilidad.";
                return (
                  <SessionResultScreen
                    result={practiceResult}
                    lang={resultLang}
                    onRetryMistakes={() => {
                      if (mistakeIds.length > 0) {
                        startPracticeSession(false, false, mistakeIds);
                        navigate("/practice?mistakes=1");
                      }
                    }}
                    onNewPractice={() => {
                      startPracticeSession(false);
                      navigate("/practice");
                    }}
                    onQuickPractice={() => {
                      startPracticeSession(false, true);
                      navigate("/practice?quick=1");
                    }}
                    onRepeatExam={handleStartExam}
                    onTopicPractice={() => {
                      navigate("/progress#topics");
                    }}
                    onProgress={() => navigate("/progress")}
                    onHome={() => navigate("/")}
                  />
                );
                return (
                  <section className="session-summary session-summary--practice glass result-enter">
                    <div className="summary-hero">
                      <div className="summary-score-ring" style={{ background: `conic-gradient(${scoreColor} ${pct * 3.6}deg, rgba(255,255,255,0.07) 0deg)` }}>
                        <div className="summary-score-inner">
                          <span className="summary-pct">{pct}%</span>
                          <span className="summary-label" style={{ color: scoreColor }}>{scoreLabel}</span>
                        </div>
                      </div>
                      <div className="summary-headline">
                        <p className="summary-eyebrow">{mistakesOnly ? (isRu ? "Отработка ошибок" : "Repaso de errores") : (isRu ? "Итог тренировки" : "Resultado de práctica")}</p>
                        <h2>{correct} / {practiceTotal} {isRu ? "верно" : "correctas"}</h2>
                        <p>{reviewLead}</p>
                      </div>
                    </div>

                    <div className="summary-stats-row">
                      <div className="summary-stat"><span className="summary-stat-val status-green">{correct}</span><span className="meta">{t("pv2.sum.correct", uiLang)}</span></div>
                      <div className="summary-stat"><span className="summary-stat-val status-warm">{wrong}</span><span className="meta">{t("pv2.sum.wrong", uiLang)}</span></div>
                      <div className="summary-stat"><span className="summary-stat-val">{practiceTotal}</span><span className="meta">{t("pv2.sum.questions", uiLang)}</span></div>
                    </div>

                    <div className={wrong > 0 ? "summary-diagnosis" : "summary-diagnosis summary-diagnosis--good"}>
                      <strong>{diagnosisTitle}</strong>
                      <span>{diagnosisText}</span>
                    </div>

                    {topTopics.length > 0 && (
                      <div className="summary-topic-list" aria-label={isRu ? "Слабые темы" : "Temas débiles"}>
                        {topTopics.map((topic) => (
                          <div key={topic.label} className="summary-topic">
                            <span>{topic.label}</span>
                            <i><b style={{ width: `${topic.pct}%` }} /></i>
                            <em>{topic.count}</em>
                          </div>
                        ))}
                      </div>
                    )}

                    {isPerfect && !mistakesOnly && <p className="summary-perfect">{t("pv2.sum.perfect", uiLang)}</p>}
                    {mistakeQuestions.length > 0 && (
                      <div className="pv2-exam-review">
                        <p className="pv2-exam-review-head">{t("pv2.exam.sum.review", uiLang)}</p>
                        {mistakeQuestions.slice(0, 3).map((q) => {
                          const selOptId = practiceSession.answers?.[q.id]?.selectedOptionId;
                          const selOpt   = q.options.find((o) => o.id === selOptId);
                          const corOpt   = q.options.find((o) => o.id === q.correctOptionId);
                          return (
                            <div key={q.id} className="pv2-exam-review-item">
                              <p className="pv2-exam-review-q">{q.question_es}</p>
                              {q.question_ru && <p className="pv2-exam-review-q-ru">{q.question_ru}</p>}
                              {selOpt && <p className="pv2-exam-review-wrong">× {selOpt.text_es}</p>}
                              {corOpt && <p className="pv2-exam-review-correct">✓ {corOpt.text_es}</p>}
                            </div>
                          );
                        })}
                        {mistakeQuestions.length > 3 && <p className="summary-review-more">{isRu ? `И ещё ${mistakeQuestions.length - 3} в отработке ошибок` : `Y ${mistakeQuestions.length - 3} más en práctica de errores`}</p>}
                      </div>
                    )}

                    <div className="summary-actions">
                      {wrong > 0 ? (
                        <button type="button" className="cta-primary" onClick={() => { startPracticeSession(false, false, mistakeIds); navigate("/practice?mistakes=1", { replace: true }); }}>
                          {t("pv2.sum.mistakes", uiLang)} ({wrong})
                        </button>
                      ) : (
                        <button type="button" className="cta-primary" onClick={() => { startPracticeSession(false); navigate("/practice", { replace: true }); }}>{mistakesOnly ? t("pv2.sum.toPractice", uiLang) : t("pv2.sum.newSession", uiLang)}</button>
                      )}
                      <button type="button" className="cta-quick" onClick={() => { startPracticeSession(false, true); navigate("/practice?quick=1", { replace: true }); }}>{t("pv2.sum.more5", uiLang)}</button>
                      {wrong > 0 && <button type="button" className="cta-secondary" onClick={() => { startPracticeSession(false); navigate("/practice", { replace: true }); }}>{t("pv2.sum.newSession", uiLang)}</button>}
                      <Link to="/" className="cta-secondary">{t("pv2.sum.home", uiLang)}</Link>
                    </div>
                  </section>
                );
                return (
                  <section className="session-summary glass result-enter">
                    <div className="summary-score-ring" style={{ background: `conic-gradient(${scoreColor} ${pct * 3.6}deg, rgba(255,255,255,0.07) 0deg)` }}>
                      <div className="summary-score-inner">
                        <span className="summary-pct">{pct}%</span>
                        {!mistakesOnly && <span className="summary-label" style={{ color: scoreColor }}>{scoreLabel}</span>}
                      </div>
                    </div>
                    {mistakesOnly && <p className="summary-mistakes-done" style={{ color: scoreColor }}>{scoreLabel}</p>}
                    <div className="summary-stats-row">
                      <div className="summary-stat"><span className="summary-stat-val status-green">{"✅"} {correct}</span><span className="meta">{t("pv2.sum.correct", uiLang)}</span></div>
                      <div className="summary-stat"><span className="summary-stat-val status-warm">{"❌"} {wrong}</span><span className="meta">{t("pv2.sum.wrong", uiLang)}</span></div>
                      <div className="summary-stat"><span className="summary-stat-val">{practiceTotal}</span><span className="meta">{t("pv2.sum.questions", uiLang)}</span></div>
                    </div>
                    {isPerfect && !mistakesOnly && <p className="summary-perfect">{"✨"} {t("pv2.sum.perfect", uiLang)}</p>}
                    {mistakeQuestions.length > 0 && (
                      <div className="pv2-exam-review">
                        <p className="pv2-exam-review-head">{t("pv2.exam.sum.review", uiLang)}</p>
                        {mistakeQuestions.map((q) => {
                          const selOptId = practiceSession.answers?.[q.id]?.selectedOptionId;
                          const selOpt   = q.options.find((o) => o.id === selOptId);
                          const corOpt   = q.options.find((o) => o.id === q.correctOptionId);
                          return (
                            <div key={q.id} className="pv2-exam-review-item">
                              <p className="pv2-exam-review-q">{q.question_es}</p>
                              {q.question_ru && <p className="pv2-exam-review-q-ru">{q.question_ru}</p>}
                              {selOpt && <p className="pv2-exam-review-wrong">{"✗"} {selOpt.text_es}</p>}
                              {corOpt && <p className="pv2-exam-review-correct">{"✓"} {corOpt.text_es}</p>}
                            </div>
                          );
                        })}
                      </div>
                    )}
                    <div className="summary-actions">
                      <button type="button" className="cta-primary" onClick={() => { startPracticeSession(false); navigate("/practice", { replace: true }); }}>{mistakesOnly ? t("pv2.sum.toPractice", uiLang) : t("pv2.sum.newSession", uiLang)}</button>
                      <button type="button" className="cta-quick" onClick={() => { startPracticeSession(false, true); navigate("/practice?quick=1", { replace: true }); }}>{t("pv2.sum.more5", uiLang)}</button>
                      {wrong > 0 && (
                        <button type="button" className="cta-secondary" onClick={() => { startPracticeSession(false, false, mistakeIds); navigate("/practice?mistakes=1", { replace: true }); }}>
                          {t("pv2.sum.mistakes", uiLang)} ({wrong})
                        </button>
                      )}
                      <Link to="/" className="cta-secondary">{t("pv2.sum.home", uiLang)}</Link>
                    </div>
                  </section>
                );
              })()}
            </>
          )}

          {/* EXAM SUMMARY */}
          {showExamSummary && (() => {
            const pct       = examTotal > 0 ? Math.round((examCorrectCount / examTotal) * 100) : 0;
            const passed     = examCorrectCount >= EXAM_PASS_CORRECT;
            const scoreColor = passed ? "#62f4b4" : "#ff9c9c";
            const scoreLabel = passed ? t("pv2.exam.sum.passed", uiLang) : t("pv2.exam.sum.failed", uiLang);
            const timeSpent  = `${Math.floor(examElapsed / 60)}:${(examElapsed % 60).toString().padStart(2, "0")}`;
            const wrongQids  = examQuestionIds.filter((qid) => examAnswers[qid] === false);
            const wrongQs    = questionsData.filter((q) => wrongQids.includes(q.id));
            const topTopics  = getTopWrongTopics(wrongQs, uiLang);
            const isRu       = uiLang === "ru";
            const missingToPass = Math.max(0, EXAM_PASS_CORRECT - examCorrectCount);
            const examLead = passed
              ? isRu ? "Уровень уже проходной, но слабые темы лучше закрепить перед реальным экзаменом." : "El nivel ya es aprobatorio, pero conviene reforzar los temas débiles antes del examen real."
              : isRu ? `До проходного уровня не хватило ${missingToPass} правильных ответов.` : `Faltaron ${missingToPass} respuestas correctas para aprobar.`;
            const recommendationTitle = passed
              ? isRu ? "Рекомендация: закрепить слабые темы" : "Recomendación: reforzar temas débiles"
              : isRu ? "Рекомендация: разобрать ошибки экзамена" : "Recomendación: revisar errores del examen";
            const recommendationText = wrongQs.length > 0
              ? isRu ? "Не повторяй весь экзамен сразу: сначала добей вопросы, которые могут стоить попытки." : "No repitas todo enseguida: primero reforzá las preguntas que pueden costar el intento."
              : isRu ? "Ошибок нет. Можно закрепить результат ещё одной короткой тренировкой." : "Sin errores. Podés consolidar el resultado con una práctica corta.";
            return (
              <SessionResultScreen
                result={examResult}
                lang={resultLang}
                onRetryMistakes={() => {
                  if (wrongQids.length > 0) {
                    startPracticeSession(false, false, wrongQids);
                    navigate("/practice?mistakes=1");
                  }
                }}
                onNewPractice={() => {
                  startPracticeSession(false);
                  navigate("/practice");
                }}
                onQuickPractice={() => {
                  startPracticeSession(false, true);
                  navigate("/practice?quick=1");
                }}
                onRepeatExam={handleStartExam}
                onTopicPractice={() => {
                  navigate("/progress#topics");
                }}
                onProgress={() => navigate("/progress")}
                onHome={() => navigate("/")}
              />
            );
            return (
              <section className="session-summary session-summary--exam glass result-enter">
                <div className="pv2-exam-summary-toolbar">
                  <Link to="/" className="pv2-back" aria-label={t("pv2.home", uiLang)}><i className="ti ti-arrow-left" /></Link>
                </div>
                <div className="summary-hero">
                  <div className="summary-score-ring" style={{ background: `conic-gradient(${scoreColor} ${pct * 3.6}deg, rgba(255,255,255,0.07) 0deg)` }}>
                    <div className="summary-score-inner">
                      <span className="summary-pct">{pct}%</span>
                      <span className="summary-label" style={{ color: scoreColor }}>{scoreLabel}</span>
                    </div>
                  </div>
                  <div className="summary-headline">
                    <p className="summary-eyebrow">{isRu ? "Экзаменационный протокол" : "Protocolo de examen"}</p>
                    <h2>{examCorrectCount} / {examTotal} {isRu ? "верно" : "correctas"}</h2>
                    <p>{examLead}</p>
                  </div>
                </div>

                <div className="summary-exam-protocol">
                  <div className="summary-protocol-row">
                    <span>{isRu ? "Проходной уровень" : "Nivel de aprobación"}</span>
                    <i><b style={{ width: `${Math.min(100, Math.round((examCorrectCount / Math.max(1, EXAM_PASS_CORRECT)) * 100))}%`, background: scoreColor }} /></i>
                    <em>{examCorrectCount}/{EXAM_PASS_CORRECT}</em>
                  </div>
                  <div className="summary-stats-row summary-stats-row--exam">
                    <div className="summary-stat"><span className="summary-stat-val status-green">{examCorrectCount}</span><span className="meta">{t("pv2.sum.correct", uiLang)}</span></div>
                    <div className="summary-stat"><span className="summary-stat-val status-warm">{examAnsweredCount - examCorrectCount}</span><span className="meta">{t("pv2.sum.wrong", uiLang)}</span></div>
                    <div className="summary-stat"><span className="summary-stat-val">{timeSpent}</span><span className="meta">{t("pv2.sum.spent", uiLang)}</span></div>
                  </div>
                  {topTopics.length > 0 && (
                    <div className="summary-topic-list">
                      {topTopics.map((topic) => (
                        <div key={topic.label} className="summary-topic">
                          <span>{topic.label}</span>
                          <i><b style={{ width: `${topic.pct}%` }} /></i>
                          <em>{topic.count}</em>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className={passed ? "summary-diagnosis summary-diagnosis--good" : "summary-diagnosis"}>
                  <strong>{recommendationTitle}</strong>
                  <span>{recommendationText}</span>
                </div>

                {wrongQs.length > 0 && (
                  <div className="pv2-exam-review">
                    <p className="pv2-exam-review-head">{t("pv2.exam.sum.review", uiLang)}</p>
                    {wrongQs.slice(0, 3).map((q) => {
                      const selOpt = q.options.find((o) => o.id === examSelAnswers[q.id]);
                      const corOpt = q.options.find((o) => o.id === q.correctOptionId);
                      return (
                        <div key={q.id} className="pv2-exam-review-item">
                          <p className="pv2-exam-review-q">{q.question_es}</p>
                          {selOpt && <p className="pv2-exam-review-wrong">× {selOpt.text_es}</p>}
                          {corOpt && <p className="pv2-exam-review-correct">✓ {corOpt.text_es}</p>}
                        </div>
                      );
                    })}
                    {wrongQs.length > 3 && <p className="summary-review-more">{isRu ? `И ещё ${wrongQs.length - 3} ошибок в разборе` : `Y ${wrongQs.length - 3} errores más en el repaso`}</p>}
                  </div>
                )}

                <div className="summary-actions">
                  {wrongQs.length > 0 && (
                    <button type="button" className="cta-primary" onClick={() => { startPracticeSession(false, false, wrongQids); navigate("/practice?mistakes=1", { replace: true }); }}>
                      {isRu ? "Разобрать ошибки экзамена" : "Revisar errores del examen"} ({wrongQs.length})
                    </button>
                  )}
                  <button type="button" className={wrongQs.length > 0 ? "cta-secondary" : "cta-primary"} onClick={handleStartExam}>{t("pv2.exam.sum.retry", uiLang)}</button>
                  <button type="button" className="cta-secondary" onClick={() => { startPracticeSession(false); navigate("/practice", { replace: true }); }}>{t("pv2.exam.sum.practice", uiLang)}</button>
                  <Link to="/" className="cta-secondary">{t("pv2.sum.home", uiLang)}</Link>
                </div>
              </section>
            );
            return (
              <section className="session-summary glass result-enter">
                <div className="pv2-exam-summary-toolbar">
                  <Link to="/" className="pv2-back" aria-label={t("pv2.home", uiLang)}><i className="ti ti-arrow-left" /></Link>
                </div>
                <div className="summary-score-ring" style={{ background: `conic-gradient(${scoreColor} ${pct * 3.6}deg, rgba(255,255,255,0.07) 0deg)` }}>
                  <div className="summary-score-inner">
                    <span className="summary-pct">{pct}%</span>
                    <span className="summary-label" style={{ color: scoreColor }}>{scoreLabel}</span>
                  </div>
                </div>
                <div className="summary-stats-row">
                  <div className="summary-stat"><span className="summary-stat-val status-green">{"✅"} {examCorrectCount}</span><span className="meta">{t("pv2.sum.correct", uiLang)}</span></div>
                  <div className="summary-stat"><span className="summary-stat-val status-warm">{"❌"} {examAnsweredCount - examCorrectCount}</span><span className="meta">{t("pv2.sum.wrong", uiLang)}</span></div>
                  <div className="summary-stat"><span className="summary-stat-val">{"⏱"} {timeSpent}</span><span className="meta">{t("pv2.sum.spent", uiLang)}</span></div>
                </div>
                {wrongQs.length > 0 && (
                  <div className="pv2-exam-review">
                    <p className="pv2-exam-review-head">{t("pv2.exam.sum.review", uiLang)}</p>
                    {wrongQs.map((q) => {
                      const selOpt = q.options.find((o) => o.id === examSelAnswers[q.id]);
                      const corOpt = q.options.find((o) => o.id === q.correctOptionId);
                      return (
                        <div key={q.id} className="pv2-exam-review-item">
                          <p className="pv2-exam-review-q">{q.question_es}</p>
                          {selOpt && <p className="pv2-exam-review-wrong">{"✗"} {selOpt.text_es}</p>}
                          {corOpt && <p className="pv2-exam-review-correct">{"✓"} {corOpt.text_es}</p>}
                        </div>
                      );
                    })}
                  </div>
                )}
                <div className="summary-actions">
                  <button type="button" className="cta-primary" onClick={handleStartExam}>{t("pv2.exam.sum.retry", uiLang)}</button>
                  <button type="button" className="cta-secondary" onClick={() => { startPracticeSession(false); navigate("/practice", { replace: true }); }}>{t("pv2.exam.sum.practice", uiLang)}</button>
                  <Link to="/" className="cta-secondary">{t("pv2.sum.home", uiLang)}</Link>
                </div>
              </section>
            );
          })()}

        </article>
      </section>

      {imageModalSrc && (
        <div className="image-modal" role="dialog" aria-modal="true" onClick={() => setImageModalSrc(null)}>
          <button type="button" className="image-modal-close" onClick={() => setImageModalSrc(null)}>{t("pv2.modal.close", uiLang)}</button>
          <img src={imageModalSrc} alt="" className="image-modal-img" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
      <Confetti active={showConfetti} originX={50} originY={35} />
    </main>
  );
}
