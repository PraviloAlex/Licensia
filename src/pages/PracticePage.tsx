import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { Confetti } from "../components/Confetti";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { glossaryData, questionsData } from "../lib/data";
import { resolveQuestionGlossaryIds } from "../lib/glossaryLinkage";
import { addWordToReview } from "../lib/vocabularyStatus";
import type { VerifiedQuestion } from "../types/question";
import { getUILang, setUILang, t, type UILang } from "../lib/i18n";
import { getFontSizePref, setFontSizePref, type FontSizePref } from "../lib/fontSizePref";
import { SessionResultScreen } from "../screens/SessionResultScreen";
import { ProGate } from "../components/ProGate";
import { getAccessTier, FREE_WEEKLY_EXAM_LIMIT } from "../lib/entitlement";
import { countExamAttemptsSince } from "../lib/examHistory";
import type { AnsweredQuestion } from "../utils/buildSessionResult";
import { useExamSession } from "../hooks/useExamSession";
import { usePracticeSession } from "../hooks/usePracticeSession";
import { ExamStart } from "../components/practice/ExamStart";
import { PracticeSettings } from "../components/practice/PracticeSettings";
import { QuestionCard } from "../components/practice/QuestionCard";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
function imgSrc(src: string): string {
  return BASE + (src.startsWith("/") ? src : "/" + src);
}

const OPTION_LETTERS = ["A", "B", "C", "D", "E"];
const ANSWER_KEY_INDEX: Record<string, number> = { a: 0, b: 1, c: 2, d: 3, e: 4 };

type LanguageMode = "both" | "es" | "ru";
type PracticeMode = "practice" | "exam";

const STORAGE_LANGUAGE  = "practice_language_mode";
const STORAGE_CONFIRM   = "practice_confirm_mode";

function readLanguageMode(): LanguageMode {
  if (typeof window === "undefined") return "both";
  const v = window.localStorage.getItem(STORAGE_LANGUAGE);
  return v === "es" || v === "ru" || v === "both" ? v : "both";
}
function readConfirmMode(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(STORAGE_CONFIRM) === "1";
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

export function PracticePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const explicitExam = searchParams.get("exam")     === "1";
  const mistakesOnly = searchParams.get("mistakes") === "1";
  const quickMode      = searchParams.get("quick")    === "1";
  const topicMode      = searchParams.get("topics")   === "1";
  const subtopicFilter = searchParams.get("subtopic") ?? undefined;
  const hardestMode    = searchParams.get("hard")     === "1";
  const weakMode       = searchParams.get("weak")     === "1";

  // ── ALL useState ──────────────────────────────────────────────────────
  const [uiLang,           setUILang_]          = useState<UILang>(getUILang);
  const [languageMode,     setLanguageMode]      = useState<LanguageMode>(readLanguageMode);
  const [practiceMode,     setPracticeMode]      = useState<PracticeMode>(() => explicitExam ? "exam" : "practice");
  const [confirmMode,      setConfirmMode]       = useState<boolean>(readConfirmMode);
  const [fontSizePref,     setFontSizePref_]     = useState<FontSizePref>(getFontSizePref);
  const [imageBrokenForQId,setImageBrokenForQId] = useState<string | null>(null);
  const [imageModalSrc,    setImageModalSrc]     = useState<string | null>(null);
  const [showConfetti,     setShowConfetti]      = useState(false);
  const [accordionOpen,    setAccordionOpen]     = useState<Record<string, boolean>>({ explain: true, mistake: false, memo: false, words: false });
  const [addedWordIds,     setAddedWordIds]      = useState<Set<string>>(new Set());
  const [gearOpen,         setGearOpen]          = useState(false);
  const [selectingOptionId,setSelectingOptionId] = useState<string | null>(null);
  const [pendingOptionId,  setPendingOptionId]   = useState<string | null>(null);

  // ── ALL useRef ────────────────────────────────────────────────────
  const confettiTimer = useRef<ReturnType<typeof setTimeout>  | null>(null);
  const gearRef       = useRef<HTMLDivElement>(null);
  const touchStartX   = useRef<number | null>(null);
  const liveRef       = useRef({
    isExam: false, question: null as VerifiedQuestion | null,
    showAnswerState: false, showPracticeSummary: false, showExamSummary: false,
    selectingOptionId: null as string | null, confirmMode: false, pendingOptionId: null as string | null,
  });
  const handleCorrectPracticeAnswer = useCallback(() => {
    setShowConfetti(true);
    confettiTimer.current = setTimeout(() => setShowConfetti(false), 1400);
  }, []);
  const resetPracticeQuestionUi = useCallback(() => {
    setImageBrokenForQId(null);
    setAccordionOpen({ explain: true, memo: false, words: false });
    setAddedWordIds(new Set());
    setPendingOptionId(null);
  }, []);
  const resetPracticeSessionUi = useCallback(() => {
    setPendingOptionId(null);
    setImageBrokenForQId(null);
  }, []);
  const onEnterPracticeMode = useCallback(() => {
    setMode("practice");
  }, []);
  const {
    goNextPracticeQuestion,
    goToPracticeQuestion,
    handlePracticeAnswer,
    practiceResult,
    practiceSession,
    selectedOptionId,
    showResult,
    startPracticeSession,
  } = usePracticeSession({
    useMistakesOnly: mistakesOnly,
    useQuick: quickMode,
    useHardest: hardestMode,
    useWeak: weakMode,
    subtopicFilter,
    uiLang,
    buildAnsweredQuestion,
    pickQuestionById,
    onCorrectAnswer: handleCorrectPracticeAnswer,
    onEnterPracticeMode,
    onQuestionReset: resetPracticeQuestionUi,
    onSessionStartReset: resetPracticeSessionUi,
  });

  // ── Derived values ────────────────────────────────────────────────
  const isExam            = practiceMode === "exam";
  const practiceTotal     = practiceSession.questionIds.length;
  const showPracticeSummary = !isExam && practiceSession.completedAt !== null;
  const practiceQuestion  = pickQuestionById(practiceSession.questionIds[practiceSession.currentIndex]);
  const onEnterExamMode = useCallback(() => {
    setPendingOptionId(null);
    setLanguageMode("es"); // exam-only: don't persist to localStorage
    setMode("exam");
  }, []);
  const onExitExam = useCallback(() => {
    navigate("/", { replace: true });
  }, [navigate]);
  const {
    examAnswers,
    examHistory,
    examIndex,
    examQuestion,
    examQuestionIds,
    examResult,
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
  } = useExamSession({
    isExam,
    uiLang,
    pickQuestionById,
    buildAnsweredQuestion,
    onEnterExamMode,
    onExitExam,
  });
  const question          = isExam ? examQuestion : practiceQuestion;
  const selectedId        = isExam ? null : selectedOptionId;
  const showAnswerState   = isExam ? false : showResult;

  const linkedGlossaryIds = question ? resolveQuestionGlossaryIds(question) : [];
  const isCorrect         = question ? selectedId === question.correctOptionId : false;
  const visualAnalysisRu  = question ? (question.visualAnalysis_ru ?? "").trim() : "";
  const keyRuleRu         = question ? (question.keyRule_ru ?? "").trim() : "";

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

  liveRef.current = { isExam, question, showAnswerState, showPracticeSummary, showExamSummary, selectingOptionId, confirmMode, pendingOptionId };

  const showSpanish   = languageMode === "both" || languageMode === "es" || isExam;
  const showRussian   = !isExam && (languageMode === "both" || languageMode === "ru");
  const resultLang: UILang = isExam || languageMode === "es" ? "es" : languageMode === "ru" ? "ru" : uiLang;
  const practiceTitleKey = mistakesOnly ? "pv2.title.mistakes" : hardestMode ? "pv2.title.hard" : weakMode ? "pv2.title.weak" : topicMode ? "pv2.title.topics" : "pv2.title.practice";
  const examLocked = getAccessTier() === "free" && countExamAttemptsSince(7) >= FREE_WEEKLY_EXAM_LIMIT;
  const practiceDots  = practiceSession.questionIds.map((qid, i) => {
    if (i < practiceSession.currentIndex) return practiceSession.answers?.[qid]?.isCorrect ? "ok" : "err";
    if (i === practiceSession.currentIndex) return "cur";
    return "empty";
  });

  const nextBtnActive    = showAnswerState || (confirmMode && !!pendingOptionId);
  const nextBtnIsConfirm = confirmMode && !showAnswerState && !!pendingOptionId;
  const nextBtnLabel     = nextBtnIsConfirm ? t("pv2.confirm", uiLang) : t("pv2.next", uiLang);

  const hasExplainContent = !!(question && (question.whyCorrect_ru || (question.image?.src && visualAnalysisRu)));
  const hasMistakeContent = !!question?.commonMistake_ru;
  const hasMemoContent    = !!question?.memoryHint_ru;
  const hasSheetContent   = !!keyRuleRu || hasExplainContent || hasMistakeContent || hasMemoContent || relatedWords.length > 0;
  /* Explanation fields are authored in Russian only — mark them in the ES UI. */
  const isEsUi            = uiLang === "es";

  // ── ALL useEffect — unconditional ───────────────────────────────────────
  useEffect(() => () => { if (confettiTimer.current) clearTimeout(confettiTimer.current); }, []);

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
        const idx = ANSWER_KEY_INDEX[e.key.toLowerCase()];
        if (idx !== undefined) { const opt = s.question.options[idx]; if (opt) handleOptionClick(opt.id); }
      }
    };
    document.addEventListener("keydown", fn);
    return () => document.removeEventListener("keydown", fn);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
  function handlePracticeFromExamStart() {
    setMode("practice");
    navigate("/practice", { replace: true });
  }
  function handleStartExamModeFromSettings() {
    setMode("exam");
    resetExamStartScreen();
    setGearOpen(false);
    navigate("/practice?exam=1", { replace: true });
  }
  function handleFontSizeChange(next: FontSizePref) {
    setFontSizePref(next);
    setFontSizePref_(next);
  }
  function handleResetPracticeFromSettings() {
    startPracticeSession(false);
    setGearOpen(false);
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
            <ExamStart
              uiLang={uiLang}
              examTotal={examTotal}
              examHistory={examHistory}
              examLocked={examLocked}
              onStartExam={handleStartExam}
              onPractice={handlePracticeFromExamStart}
            />
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
                  <QuestionCard
                    mode="exam"
                    question={question}
                    optionLetters={OPTION_LETTERS}
                    imageBrokenForQId={imageBrokenForQId}
                    selectingOptionId={selectingOptionId}
                    alreadyAnswered={examAnswers[examQuestionIds[examIndex]] !== undefined}
                    examTagLabel={t("pv2.exam.tag", uiLang)}
                    onImageError={setImageBrokenForQId}
                    onImageOpen={setImageModalSrc}
                    onOptionClick={handleOptionClick}
                    resolveImageSrc={imgSrc}
                  />
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
                </div>
                <span className="pv2-title">{t(practiceTitleKey, uiLang)}</span>
                <div className="pv2-tb-right">
                  <span className="pv2-counter">{Math.min(practiceSession.currentIndex + 1, practiceTotal)} / {practiceTotal}</span>
                  <PracticeSettings
                    settingsRef={gearRef}
                    gearOpen={gearOpen}
                    uiLang={uiLang}
                    languageMode={languageMode}
                    confirmMode={confirmMode}
                    fontSizePref={fontSizePref}
                    onToggleOpen={() => setGearOpen((v) => !v)}
                    onClose={() => setGearOpen(false)}
                    onSetLanguage={setLanguage}
                    onToggleConfirmMode={toggleConfirmMode}
                    onStartExamMode={handleStartExamModeFromSettings}
                    onSetUILang={handleUILangChange}
                    onSetFontSize={handleFontSizeChange}
                    onResetPractice={handleResetPracticeFromSettings}
                  />
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
                  <QuestionCard
                    mode="practice"
                    question={question}
                    optionLetters={OPTION_LETTERS}
                    imageBrokenForQId={imageBrokenForQId}
                    selectingOptionId={selectingOptionId}
                    selectedOptionId={selectedId}
                    showAnswerState={showAnswerState}
                    showSpanish={showSpanish}
                    showRussian={showRussian}
                    confirmMode={confirmMode}
                    pendingOptionId={pendingOptionId}
                    onImageError={setImageBrokenForQId}
                    onImageOpen={setImageModalSrc}
                    onOptionClick={handleOptionClick}
                    resolveImageSrc={imgSrc}
                  >
                  {showAnswerState && (
                    <div className={isCorrect ? "pv2-verdict pv2-verdict--correct result-enter" : "pv2-verdict pv2-verdict--wrong result-enter"} role="status">
                      <i className={isCorrect ? "ti ti-circle-check" : "ti ti-circle-x"} aria-hidden="true" />
                      <span className="pv2-verdict-text">
                        <span className="pv2-verdict-label">{isCorrect ? t("pv2.correct", uiLang) : t("pv2.wrong", uiLang)}</span>
                        {!isCorrect && correctOption && (
                          <span className="pv2-verdict-answer">
                            {correctOption.text_es}
                            {correctOption.text_ru ? ` — ${correctOption.text_ru}` : ""}
                          </span>
                        )}
                      </span>
                    </div>
                  )}
                  <button type="button"
                    className={["pv2-next", nextBtnActive ? "pv2-next--active" : "pv2-next--disabled", nextBtnIsConfirm ? "pv2-next--confirm" : ""].filter(Boolean).join(" ")}
                    onClick={handleConfirmOrNext} disabled={!nextBtnActive}
                  >{nextBtnLabel}</button>
                  {showAnswerState && hasSheetContent && (
                    <div className="pv2-sheet result-enter">
                      <div className="pv2-accordion">
                        {keyRuleRu && (
                          <div className="pv2-keyrule">
                            <span className="pv2-keyrule-ico" aria-hidden="true"><i className="ti ti-bookmark" /></span>
                            <span className="pv2-keyrule-text">
                              <b className="pv2-keyrule-label">{t("pv2.keyRule", uiLang)}</b>
                              {keyRuleRu}
                              {isEsUi && <span className="pv2-lang-chip" title={t("lang.ruOnly", uiLang)}>RU</span>}
                            </span>
                          </div>
                        )}
                        {(hasExplainContent || hasMistakeContent || hasMemoContent) && (
                        <ProGate lang={uiLang}>
                        {(question.whyCorrect_ru || (question.image?.src && visualAnalysisRu)) && (
                          <div className="pv2-acc-item">
                            <button type="button" className="pv2-acc-header" onClick={() => toggleAccordion("explain")}>
                              <span className="pv2-acc-icon pv2-acc-icon--teal"><i className="ti ti-book-2" /></span>
                              <span className="pv2-acc-title">{t("pv2.acc.explain", uiLang)}</span>
                              {isEsUi && <span className="pv2-lang-chip" title={t("lang.ruOnly", uiLang)}>RU</span>}
                              <span className={accordionOpen.explain ? "pv2-acc-chev pv2-acc-chev--open" : "pv2-acc-chev"}><i className="ti ti-chevron-right" /></span>
                            </button>
                            {accordionOpen.explain && (
                              <div className="pv2-acc-body">
                                {question.image?.src && visualAnalysisRu && <p>{visualAnalysisRu}</p>}
                                {question.whyCorrect_ru && <p>{question.whyCorrect_ru}</p>}
                              </div>
                            )}
                          </div>
                        )}
                        {question.commonMistake_ru && (
                          <div className="pv2-acc-item">
                            <button type="button" className="pv2-acc-header" onClick={() => toggleAccordion("mistake")}>
                              <span className="pv2-acc-icon pv2-acc-icon--rose"><i className="ti ti-alert-triangle" /></span>
                              <span className="pv2-acc-title">{t("pv2.acc.mistake", uiLang)}</span>
                              {isEsUi && <span className="pv2-lang-chip" title={t("lang.ruOnly", uiLang)}>RU</span>}
                              <span className={accordionOpen.mistake ? "pv2-acc-chev pv2-acc-chev--open" : "pv2-acc-chev"}><i className="ti ti-chevron-right" /></span>
                            </button>
                            {accordionOpen.mistake && <div className="pv2-acc-body"><p>{question.commonMistake_ru}</p></div>}
                          </div>
                        )}
                        {question.memoryHint_ru && (
                          <div className="pv2-acc-item">
                            <button type="button" className="pv2-acc-header" onClick={() => toggleAccordion("memo")}>
                              <span className="pv2-acc-icon pv2-acc-icon--amber"><i className="ti ti-bulb" /></span>
                              <span className="pv2-acc-title">{t("pv2.acc.memo", uiLang)}</span>
                              {isEsUi && <span className="pv2-lang-chip" title={t("lang.ruOnly", uiLang)}>RU</span>}
                              <span className={accordionOpen.memo ? "pv2-acc-chev pv2-acc-chev--open" : "pv2-acc-chev"}><i className="ti ti-chevron-right" /></span>
                            </button>
                            {accordionOpen.memo && <div className="pv2-acc-body"><p>{question.memoryHint_ru}</p></div>}
                          </div>
                        )}
                        </ProGate>
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
                  </QuestionCard>
                </>
              )}

              {showPracticeSummary && (() => {
                const mistakeIds = Object.entries(practiceSession.answers ?? {}).filter(([, a]) => !a.isCorrect).map(([id]) => id);
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
              })()}
            </>
          )}

          {/* EXAM SUMMARY */}
          {showExamSummary && (() => {
            const wrongQids  = examQuestionIds.filter((qid) => examAnswers[qid] === false);
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
