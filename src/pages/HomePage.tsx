import { Link, useLocation } from "react-router-dom";
import { createPortal } from "react-dom";
import { useMemo, useCallback, useEffect, useState, useRef, type CSSProperties, type ReactNode } from "react";
import { PageShell } from "../components/PageShell";
import { glossaryData, questionsData } from "../lib/data";
import { getQuestionProgressMap, getUniqueSeenCount, getTotalWrongAnswersCount, getMistakeQuestionCount, getCorrectedMistakeCount } from "../lib/questionProgress";
import { getMasteredWordIds, getReviewedTodayCount, markWordKnown } from "../lib/vocabularyStatus";
import {
  getTodayAnsweredCount, getActivePracticeSessionSummary, getDueWordsPreview,
  getDueWordsCount, getReadinessLevel, getWeeklyActivity, getExamCompletedToday,
} from "../lib/homeStats";
import { getUILang, setUILang, t, type UILang } from "../lib/i18n";
import { getFontSizePref, setFontSizePref, type FontSizePref } from "../lib/fontSizePref";

const DAILY_GOAL = 25;
const APP_VERSION = "v0.05";
const REMINDER_DISMISS_KEY = "licencia_ar_reminder_dismissed";
const PRIVACY_URL = `${import.meta.env.BASE_URL}privacy.html`;
const SETTINGS_MENU_WIDTH = 330;

function getDaysSinceLastPractice(): number | null {
  const map = getQuestionProgressMap();
  const dates = Object.values(map)
    .map((p) => p.lastSeenAt)
    .filter(Boolean)
    .map((d) => new Date(d).getTime())
    .filter((t) => !isNaN(t));
  if (dates.length === 0) return null;
  const lastMs = Math.max(...dates);
  const diffMs = Date.now() - lastMs;
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

function getReminderDismissedToday(): boolean {
  try {
    const v = window.localStorage.getItem(REMINDER_DISMISS_KEY);
    if (!v) return false;
    return v === new Date().toISOString().slice(0, 10);
  } catch { return false; }
}

function dismissReminderToday(): void {
  try {
    window.localStorage.setItem(REMINDER_DISMISS_KEY, new Date().toISOString().slice(0, 10));
  } catch { /* noop */ }
}
const EXAM_RECOMMEND_THRESHOLD = 120;

const DAY_LABELS_RU = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const DAY_LABELS_ES = ["Lu", "Ma", "Mi", "Ju", "Vi", "Sá", "Do"];

function WeekDots({ activity }: { activity: boolean[] }) {
  const completed = activity.filter(Boolean).length;
  const todayDone = activity[6];
  const trackPct  = Math.round((completed / 7) * 100);
  return (
    <div className="week-progress">
      <div className="week-progress-header">
        <span className="week-progress-meta">{completed}/7</span>
      </div>
      <div className="week-progress-track-wrap">
        <div className="week-progress-track">
          <div className="week-progress-track-fill" style={{ width: `${trackPct}%` }} />
        </div>
        <div className="week-progress-dots">
          {Array.from({ length: 7 }, (_, i) => {
            let cls = "week-dot";
            if (i < completed) {
              cls += " week-dot--active";
              if (i === completed - 1 && todayDone) cls += " week-dot--today";
            } else if (i === completed && !todayDone) {
              cls += " week-dot--today";
            }
            return <div key={i} className={cls} />;
          })}
        </div>
      </div>
    </div>
  );
}

function DailyRing({ completed, goal }: { completed: number; goal: number }) {
  const pct = Math.min(1, goal > 0 ? completed / goal : 0);
  const deg = Math.round(pct * 360);
  const fillColor = pct >= 1 ? "#4ee8a4" : "#FF7A1A";
  const trackColor = "var(--ring-track-color, rgba(255,255,255,0.09))";
  return (
    <div className="hd-daily-ring" style={{ background: `conic-gradient(${fillColor} ${deg}deg, ${trackColor} 0deg)` }}>
      <div className="hd-daily-ring-inner">
        <span className="hd-daily-ring-pct">{Math.round(pct * 100)}%</span>
        <span className="hd-daily-ring-sub">goal</span>
      </div>
    </div>
  );
}

// MissionCard kept for potential reuse
function MissionCard({ icon, title, progress, done, to, disabled }: {
  icon: ReactNode; title: string; progress?: string; done: boolean; to: string; disabled?: boolean;
}) {
  if (disabled) {
    return (
      <div className="mission-card mission-card--disabled">
        <span className="mission-card-icon">{icon}</span>
        <span className="mission-card-title">{title}</span>
      </div>
    );
  }
  return (
    <Link to={to} className={`mission-card${done ? " mission-card--done" : ""}`}>
      <span className="mission-card-icon">{done ? "✓" : icon}</span>
      <span className="mission-card-title">{title}</span>
      {progress && !done && <span className="mission-card-progress">{progress}</span>}
    </Link>
  );
}

function readHomeData() {
  const seenCount      = getUniqueSeenCount();
  const mistakesCount  = getTotalWrongAnswersCount();
  const total          = questionsData.length;
  const progressMap    = getQuestionProgressMap();
  const totalCorrect   = Object.values(progressMap).reduce((s, p) => s + p.correctCount, 0);

  const byTopicMap: Record<string, { total: number; seen: number; correct: number; answered: number }> = {};
  for (const q of questionsData) {
    const st = (q as { subtopic?: string }).subtopic ?? "otros";
    if (!byTopicMap[st]) byTopicMap[st] = { total: 0, seen: 0, correct: 0, answered: 0 };
    byTopicMap[st].total++;
    const p = progressMap[q.id];
    if (p && (p.correctCount + p.wrongCount) > 0) {
      byTopicMap[st].seen++;
      byTopicMap[st].correct  += p.correctCount;
      byTopicMap[st].answered += p.correctCount + p.wrongCount;
    }
  }
  const weakTopic = Object.entries(byTopicMap)
    .filter(([, s]) => s.answered >= 1)
    .map(([key, s]) => ({ key, seen: s.seen, total: s.total, accuracy: Math.round((s.correct / s.answered) * 100) }))
    .sort((a, b) => a.accuracy - b.accuracy || b.seen - a.seen)[0] ?? null;

  const freshTopic = Object.entries(byTopicMap)
    .filter(([, s]) => s.seen < s.total)
    .map(([key, s]) => ({ key, seen: s.seen, total: s.total, coveragePct: Math.round((s.seen / s.total) * 100) }))
    .sort((a, b) => a.coveragePct - b.coveragePct || b.total - a.total)[0] ?? null;

  const mistakeQuestionCount = getMistakeQuestionCount(questionsData);
  const correctedMistakeCount = getCorrectedMistakeCount(questionsData);
  const readiness      = getReadinessLevel(seenCount, total, totalCorrect, mistakesCount);
  const todayAnswered  = getTodayAnsweredCount();
  const activeSession  = getActivePracticeSessionSummary();
  const dueWordsCount  = getDueWordsCount();
  const duePreview     = getDueWordsPreview(3);
  const weekActivity   = getWeeklyActivity();
  const masteredWords  = getMasteredWordIds();
  const examDoneToday  = getExamCompletedToday();
  const reviewedTodayCount = getReviewedTodayCount();
  return {
    seenCount, mistakesCount, total, readiness,
    todayAnswered, activeSession, dueWordsCount, duePreview,
    weekActivity, masteredWords, examDoneToday, reviewedTodayCount,
    weakTopic, mistakeQuestionCount, correctedMistakeCount, freshTopic,
  };
}

export function HomePage() {
  const location = useLocation();
  const [data, setData] = useState(() => readHomeData());
  const [lang, setLang_] = useState<UILang>(getUILang);
  const [gearOpen, setGearOpen] = useState(false);
  const [fontSizePref, setFontSizePref_] = useState<FontSizePref>(getFontSizePref);
  const [confirmMode, setConfirmMode] = useState(() =>
    typeof window !== "undefined" && (function(){ const v = window.localStorage.getItem("practice_confirm_mode"); return v === null ? true : v === "1"; })()
  );
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    try { return (window.localStorage.getItem("ui_theme") as "dark" | "light") || "dark"; } catch { return "dark"; }
  });
  const [dismissedWords, setDismissedWords] = useState<Set<string>>(new Set());
  const [reminderDismissed, setReminderDismissed] = useState(() => getReminderDismissedToday());
  const gearRef = useRef<HTMLDivElement>(null);
  const gearButtonRef = useRef<HTMLButtonElement>(null);
  const gearMenuRef = useRef<HTMLDivElement>(null);
  const [gearMenuStyle, setGearMenuStyle] = useState<CSSProperties>({});

  useEffect(() => { setData(readHomeData()); }, [location.key]);

  const recalculateGearMenuPosition = useCallback(() => {
    if (typeof window === "undefined") return;
    const gear = gearButtonRef.current ?? document.querySelector<HTMLButtonElement>("[data-settings-gear]");
    if (!gear) {
      setGearMenuStyle({
        "--settings-menu-top": "96px",
        "--settings-menu-left": `calc(100vw - ${SETTINGS_MENU_WIDTH + 96}px)`,
      } as CSSProperties);
      return;
    }
    const rect = gear.getBoundingClientRect();
    const menuWidth = Math.min(SETTINGS_MENU_WIDTH, window.innerWidth - 24);
    const top = Math.max(12, Math.min(rect.bottom + 10, window.innerHeight - 32));
    const left = Math.max(12, Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - 12));
    setGearMenuStyle({
      "--settings-menu-top": `${top}px`,
      "--settings-menu-left": `${left}px`,
    } as CSSProperties);
  }, []);

  const toggleGearMenu = useCallback(() => {
    if (gearOpen) { setGearOpen(false); return; }
    requestAnimationFrame(() => { recalculateGearMenuPosition(); setGearOpen(true); });
  }, [gearOpen, recalculateGearMenuPosition]);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try { window.localStorage.setItem("ui_theme", theme); } catch { /* noop */ }
  }, [theme]);

  useEffect(() => {
    if (!gearOpen) return;
    const fn = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!gearRef.current?.contains(target) && !gearMenuRef.current?.contains(target)) setGearOpen(false);
    };
    const keyFn = (e: KeyboardEvent) => { if (e.key === "Escape") setGearOpen(false); };
    document.addEventListener("mousedown", fn);
    document.addEventListener("keydown", keyFn);
    return () => { document.removeEventListener("mousedown", fn); document.removeEventListener("keydown", keyFn); };
  }, [gearOpen]);

  useEffect(() => {
    if (!gearOpen || typeof window === "undefined") return;
    const update = () => requestAnimationFrame(recalculateGearMenuPosition);
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => { window.removeEventListener("resize", update); window.removeEventListener("scroll", update, true); };
  }, [gearOpen, recalculateGearMenuPosition]);

  useEffect(() => {
    if (!gearOpen) return;
    const frame = requestAnimationFrame(recalculateGearMenuPosition);
    return () => cancelAnimationFrame(frame);
  }, [gearOpen, lang, theme, fontSizePref, location.key, recalculateGearMenuPosition]);

  function toggleConfirmMode() {
    const next = !confirmMode;
    setConfirmMode(next);
    if (typeof window !== "undefined") window.localStorage.setItem("practice_confirm_mode", next ? "1" : "0");
  }
  function pickLang(l: UILang) { setUILang(l); setLang_(l); window.dispatchEvent(new Event("ui-lang-changed")); }
  function toggleTheme() { setTheme(t => t === "dark" ? "light" : "dark"); }
  function handleWordKnown(wordId: string) { markWordKnown(wordId); setDismissedWords((prev) => new Set([...prev, wordId])); setData(readHomeData()); }

  const {
    seenCount, mistakesCount, total, readiness, todayAnswered,
    activeSession, dueWordsCount, duePreview, weekActivity,
    masteredWords, examDoneToday, reviewedTodayCount,
    weakTopic, mistakeQuestionCount, correctedMistakeCount, freshTopic,
  } = data;

  const visibleWords = duePreview.filter((w) => !dismissedWords.has(w.id));

  const TOPIC_ICONS: Record<string, string> = {
    semaforos: "ti-traffic-lights", prioridad: "ti-arrows-exchange",
    intersecciones: "ti-road", senales: "ti-sign-left",
    velocidad: "ti-gauge", adelantamiento: "ti-car",
    estacionamiento: "ti-parking", peatones: "ti-walk",
    ciclistas: "ti-bike", alcohol: "ti-glass-off",
    cinturon_ninos: "ti-armchair", luces: "ti-bulb",
    documentos: "ti-id", mecanico: "ti-tool",
    seguridad_vial: "ti-shield-check", demarcacion: "ti-line",
    ferroviario: "ti-train", fatiga: "ti-zzz", otros: "ti-dots",
  };
  const weakTopicIcon = weakTopic ? (TOPIC_ICONS[weakTopic.key] ?? "ti-alert-circle") : "ti-alert-circle";

  const daysSince = getDaysSinceLastPractice();
  const showReminder = !reminderDismissed && seenCount > 0 && daysSince !== null && daysSince >= 1;
  function handleDismissReminder() { dismissReminderToday(); setReminderDismissed(true); }

  const dailyDone       = todayAnswered >= DAILY_GOAL;
  const dailyPercent    = Math.round((Math.min(todayAnswered, DAILY_GOAL) / DAILY_GOAL) * 100);
  const toExamRecommend = Math.max(0, EXAM_RECOMMEND_THRESHOLD - seenCount);
  const seenPercent     = total > 0 ? Math.round((seenCount / total) * 100) : 0;

  const continueLabel = activeSession
    ? `${t("home.continue", lang)} ${activeSession.currentIndex + 1}/${activeSession.totalQuestions}`
    : null;

  const recommendText = activeSession
    ? t("home.rec.continue", lang)
    : dueWordsCount > 0
    ? `${t("home.rec.words", lang)} (${dueWordsCount})`
    : readiness.score >= 80
    ? t("home.rec.exam", lang)
    : t("home.rec.start", lang);

  const heroLink = activeSession
    ? "/practice"
    : dueWordsCount > 0
    ? "/vocabulary?tab=review"
    : readiness.score >= 80
    ? "/practice?exam=1"
    : "/practice";

  const missionWordsProgress = reviewedTodayCount > 0
    ? `${t("home.m.reviewed", lang)} ${reviewedTodayCount}`
    : dueWordsCount > 0
    ? `${dueWordsCount} ${t("home.m.waiting", lang)}`
    : undefined;

  const remainingDue = dueWordsCount - visibleWords.length;

  const isRu = lang === "ru";

  return (
    <PageShell title={<>Licencia <span style={{color:"var(--s-accent)"}}>AR</span></>} backToHome={false} headerRight={
      <div className="home-header-controls">
        <div className="home-lang-toggle">
          <button type="button" className={lang === "ru" ? "home-lang-btn home-lang-btn--active" : "home-lang-btn"} onClick={() => pickLang("ru")}>RU</button>
          <button type="button" className={lang === "es" ? "home-lang-btn home-lang-btn--active" : "home-lang-btn"} onClick={() => pickLang("es")}>ES</button>
        </div>
        <div className="home-theme-toggle">
          <button type="button" className={theme === "dark" ? "home-theme-btn home-theme-btn--active" : "home-theme-btn"} onClick={toggleTheme} aria-label="Dark"><i className="ti ti-moon" /></button>
          <button type="button" className={theme === "light" ? "home-theme-btn home-theme-btn--active" : "home-theme-btn"} onClick={toggleTheme} aria-label="Light"><i className="ti ti-sun" /></button>
        </div>
        <div className="home-gear-wrap" ref={gearRef}>
          <button type="button" ref={gearButtonRef} data-settings-gear
            className={gearOpen ? "home-gear-btn home-gear-btn--open" : "home-gear-btn"}
            onClick={toggleGearMenu} aria-label={t("pv2.settings", lang)}
            aria-expanded={gearOpen} aria-controls="home-settings-menu">
            <i className="ti ti-settings" aria-hidden="true" />
          </button>
          {gearOpen && createPortal(
            <>
              <button type="button" className="home-settings-backdrop"
                aria-label={isRu ? "Закрыть" : "Cerrar"}
                onClick={() => setGearOpen(false)} />
              <div id="home-settings-menu" ref={gearMenuRef}
                className="pv2-gear-menu home-gear-menu" role="dialog" aria-modal="true" style={gearMenuStyle}>
                <div className="pv2-gear-section-label">{t("pv2.gear.answers", lang)}</div>
                <button type="button" className="pv2-gear-item" onClick={toggleConfirmMode}>
                  <span className="pv2-gear-ico pv2-gear-ico--blue"><i className="ti ti-hand-finger" /></span>
                  <span className="pv2-gear-text">
                    <span className="pv2-gear-label">{confirmMode ? t("pv2.gear.standardLabel", lang) : t("pv2.gear.quickLabel", lang)}</span>
                    <span className="pv2-gear-sub">{confirmMode ? t("pv2.gear.confirmOn", lang) : t("pv2.gear.confirmOff", lang)}</span>
                  </span>
                  <span className={confirmMode ? "pv2-toggle" : "pv2-toggle pv2-toggle--on"} aria-hidden="true"><span className="pv2-toggle-thumb" /></span>
                </button>
                <div className="pv2-gear-section-label">{t("pv2.gear.uiLang", lang)}</div>
                <div className="pv2-gear-lang-row">
                  <button type="button" className={lang === "ru" ? "pv2-gear-lang-btn pv2-gear-lang-btn--active" : "pv2-gear-lang-btn"} onClick={() => { pickLang("ru"); setGearOpen(false); }}>RU {t("pv2.gear.uiRu", lang)}</button>
                  <button type="button" className={lang === "es" ? "pv2-gear-lang-btn pv2-gear-lang-btn--active" : "pv2-gear-lang-btn"} onClick={() => { pickLang("es"); setGearOpen(false); }}>ES {t("pv2.gear.uiEs", lang)}</button>
                </div>
                <div className="pv2-gear-section-label" style={{padding:"4px 12px 2px"}}>{t("pv2.gear.fontSize", lang)}</div>
                <div className="pv2-gear-font-row">
                  {(["normal","large","huge"] as FontSizePref[]).map((p, i) => (
                    <button key={p} type="button"
                      className={fontSizePref === p ? "pv2-font-pill pv2-font-pill--active" : "pv2-font-pill"}
                      onClick={() => { setFontSizePref(p); setFontSizePref_(p); }}
                      style={{ fontSize: ["0.72rem","1.0rem","1.38rem"][i] }}>A</button>
                  ))}
                </div>
                <div className="pv2-gear-divider" />
                <div className="pv2-gear-section-label">{isRu ? "Правовая информация" : "Legal"}</div>
                <Link to="/legal" className="pv2-gear-item home-gear-item-link" onClick={() => setGearOpen(false)}>
                  <span className="pv2-gear-ico pv2-gear-ico--teal"><i className="ti ti-info-circle" /></span>
                  <span className="pv2-gear-text"><span className="pv2-gear-label">{isRu ? "Дисклеймер" : "Disclaimer"}</span></span>
                </Link>
                <Link to="/sources" className="pv2-gear-item home-gear-item-link" onClick={() => setGearOpen(false)}>
                  <span className="pv2-gear-ico pv2-gear-ico--blue"><i className="ti ti-list-search" /></span>
                  <span className="pv2-gear-text"><span className="pv2-gear-label">{isRu ? "Источники" : "Fuentes"}</span></span>
                </Link>
                <a href={PRIVACY_URL} className="pv2-gear-item home-gear-item-link" onClick={() => setGearOpen(false)}>
                  <span className="pv2-gear-ico pv2-gear-ico--amber"><i className="ti ti-shield-lock" /></span>
                  <span className="pv2-gear-text"><span className="pv2-gear-label">{isRu ? "Политика конфиденциальности" : "Política de privacidad"}</span></span>
                </a>
                <div className="pv2-gear-divider" />
                <a href="mailto:pravilo.ar@gmail.com?subject=Licencia%20AR%20bug%20report" className="pv2-gear-item home-gear-item-link" onClick={() => setGearOpen(false)}>
                  <span className="pv2-gear-ico pv2-gear-ico--red"><i className="ti ti-bug" /></span>
                  <span className="pv2-gear-text"><span className="pv2-gear-label">{t("home.gear.bug", lang)}</span></span>
                </a>
                <a href="https://ko-fi.com/alexsun99" target="_blank" rel="noreferrer" className="pv2-gear-item home-gear-item-link" onClick={() => setGearOpen(false)}>
                  <span className="pv2-gear-ico pv2-gear-ico--amber"><i className="ti ti-coffee" /></span>
                  <span className="pv2-gear-text"><span className="pv2-gear-label">{t("home.gear.support", lang)}</span></span>
                </a>
              </div>
            </>,
            document.body
          )}
        </div>
        <span className="home-version">{APP_VERSION}</span>
      </div>
    }>

      {/* Reminder */}
      {showReminder && (
        <div className="home-reminder">
          <span className="home-reminder-icon">&#128276;</span>
          <span className="home-reminder-text">
            {isRu
              ? daysSince === 1 ? "Вчера не занимались — пора повторить!" : `Не занимались ${daysSince} дня — пора повторить!`
              : daysSince === 1 ? "Ayer no practicaste — es hora de repasar!" : `Hace ${daysSince} días que no practicas!`}
          </span>
          <button type="button" className="home-reminder-dismiss" onClick={handleDismissReminder} aria-label="Cerrar">
            <i className="ti ti-x" />
          </button>
        </div>
      )}

      {/* ── 1. Hero ────────────────────────────────────────────── */}
      <section className="hd-hero glass">
        <div className="hd-hero-left">
          <p className="hd-hero-label">{isRu ? "Лучшее действие сейчас" : "La mejor acción ahora"}</p>
          <p className="hd-hero-title">{continueLabel ?? recommendText}</p>
          <Link to={heroLink} className="hd-cta-btn">
            <i className="ti ti-player-play-filled" aria-hidden="true" />
            {continueLabel ?? (isRu ? "Начать тренировку" : "Comenzar práctica")}
          </Link>
        </div>
        <div className="hd-hero-right">
          <div className="hd-daily-card-head">
            <p className="hd-daily-label">{isRu ? "Сегодня" : "Hoy"}</p>
            <p className="hd-daily-pct-label">{dailyPercent}%</p>
          </div>
          <p className="hd-daily-fraction">{todayAnswered} / {DAILY_GOAL} {isRu ? "вопросов" : "preguntas"}</p>
          <div className="hd-daily-progress" aria-hidden="true">
            <span style={{ width: `${dailyPercent}%` }} />
          </div>
        </div>
      </section>

      {/* ── 2. Quick Start ─────────────────────────────────────── */}
      <section>
        <p className="hd-section-title">{isRu ? "Быстрый старт" : "Inicio rápido"}</p>
        <div className="home-action-grid">
          <Link to="/practice" className="home-action-btn main-action-card main-action-card--practice">
            <span className="home-action-ico-wrap home-action-ico-wrap--blue"><i className="ti ti-books" /></span>
            <span className="home-action-body">
              <span className="home-action-title">{t("home.action.p20", lang)}</span>
              <span className="home-action-sub">{t("home.action.p20.sub", lang)}</span>
            </span>
            <span className="home-action-right">20 <i className="ti ti-chevron-right" /></span>
          </Link>
          <Link to="/practice?quick=1" className="home-action-btn main-action-card main-action-card--quick">
            <span className="home-action-ico-wrap home-action-ico-wrap--orange"><i className="ti ti-bolt" /></span>
            <span className="home-action-body">
              <span className="home-action-title">{t("home.action.q5", lang)}</span>
              <span className="home-action-sub">{t("home.action.q5.sub", lang)}</span>
            </span>
            <span className="home-action-right">5 <i className="ti ti-chevron-right" /></span>
          </Link>
          <Link to="/vocabulary?tab=review" className={`home-action-btn main-action-card main-action-card--words${dueWordsCount > 0 ? " home-action-btn--words" : ""}`}>
            <span className="home-action-ico-wrap home-action-ico-wrap--violet"><i className="ti ti-language" /></span>
            <span className="home-action-body">
              <span className="home-action-title">{t("home.action.words", lang)}</span>
              <span className="home-action-sub">
                {dueWordsCount > 0
                  ? `${dueWordsCount} ${isRu ? "слов ждут" : "palabras pendientes"}`
                  : t("home.action.words.sub", lang)}
              </span>
            </span>
            <span className="home-action-right">{dueWordsCount > 0 ? dueWordsCount : 12} <i className="ti ti-chevron-right" /></span>
          </Link>
          <Link to="/practice?exam=1" className="home-action-btn main-action-card main-action-card--exam home-action-btn--exam">
            <span className="home-action-ico-wrap home-action-ico-wrap--amber"><i className="ti ti-clipboard-check" /></span>
            <span className="home-action-body">
              <span className="home-action-title">{t("home.action.exam", lang)}</span>
              <span className="home-action-sub">{t("home.action.exam.sub", lang)}</span>
            </span>
            <span className="home-action-right">40 <i className="ti ti-chevron-right" /></span>
          </Link>
        </div>
      </section>

      <section className="mobile-today-card glass" aria-label={isRu ? "Сегодня" : "Hoy"}>
        <div className="mobile-today-head">
          <p className="mobile-today-title">{isRu ? "Сегодня" : "Hoy"}</p>
          <p className="mobile-today-main">{todayAnswered} / {DAILY_GOAL} {isRu ? "вопросов" : "preguntas"}</p>
        </div>
        <p className="mobile-today-sub">{dailyPercent}% {isRu ? "цели" : "meta"}</p>
        <div className="mobile-today-track" aria-hidden="true">
          <span style={{ width: `${dailyPercent}%` }} />
        </div>
      </section>

      {/* ── 3. Focus Today ─────────────────────────────────────── */}
      {(mistakeQuestionCount > 0 || freshTopic || weakTopic) && (
        <section>
          <p className="hd-section-title">{isRu ? "Фокус сегодня" : "Foco hoy"}</p>
          <div className="hd-focus-grid">
            {mistakeQuestionCount > 0 ? (
              <Link to="/practice?mistakes=1" className="hd-focus-card hd-focus-card--red">
                <span className="hd-focus-icon hd-focus-icon--red" aria-hidden="true"><i className="ti ti-target" /></span>
                <span className="hd-focus-body">
                  <span className="hd-focus-title">{isRu ? "Ошибки" : "Errores"}</span>
                  <span className="hd-focus-meta">{mistakeQuestionCount} {isRu ? "вопросов ждут повторения" : "preguntas pendientes"}</span>
                </span>
                <i className="ti ti-chevron-right hd-focus-chev" aria-hidden="true" />
              </Link>
            ) : freshTopic ? (
              <Link to={`/practice?subtopic=${freshTopic.key}`} className="hd-focus-card hd-focus-card--blue">
                <span className="hd-focus-icon hd-focus-icon--blue" aria-hidden="true"><i className="ti ti-books" /></span>
                <span className="hd-focus-body">
                  <span className="hd-focus-title">{(t as (k: string, l: UILang) => string)(`subtopic.${freshTopic.key}`, lang)} — {isRu ? "новая тема" : "tema nueva"}</span>
                  <span className="hd-focus-meta">{freshTopic.seen} {isRu ? "из" : "de"} {freshTopic.total} · {freshTopic.coveragePct}%</span>
                </span>
                <i className="ti ti-chevron-right hd-focus-chev" aria-hidden="true" />
              </Link>
            ) : null}
            {weakTopic && (
              <Link to={`/practice?subtopic=${weakTopic.key}`} className="hd-focus-card hd-focus-card--orange">
                <span className="hd-focus-icon hd-focus-icon--orange" aria-hidden="true"><i className={`ti ${weakTopicIcon}`} /></span>
                <span className="hd-focus-body">
                  <span className="hd-focus-title">{(t as (k: string, l: UILang) => string)(`subtopic.${weakTopic.key}`, lang)} — {isRu ? "слабая тема" : "tema débil"}</span>
                  <span className="hd-focus-meta">{weakTopic.seen} {isRu ? "из" : "de"} {weakTopic.total} · {weakTopic.accuracy}%</span>
                </span>
                <i className="ti ti-chevron-right hd-focus-chev" aria-hidden="true" />
              </Link>
            )}
          </div>
        </section>
      )}

      {/* ── Due words ──────────────────────────────────────────── */}
      {visibleWords.length > 0 ? (
        <section className="home-section glass home-words-panel">
          <div className="home-words-header">
            <h3 className="home-section-title" style={{ margin: 0 }}>{t("home.words.title", lang)}</h3>
            <div className="home-words-header-right">
              {dueWordsCount > 0 && (
                <span className="home-words-count">{dueWordsCount}</span>
              )}
              <Link to="/vocabulary?tab=review" className="home-words-btn">
                {t("home.words.btn", lang)} <i className="ti ti-arrow-right" />
              </Link>
            </div>
          </div>
          <div className={`home-word-cards${visibleWords.length === 1 ? " home-word-cards--single" : ""}`}>
            {visibleWords.map((w) => (
              <div key={w.id} className="home-word-card">
                <div className="home-word-card-body">
                  <span className="home-word-card-es">{w.term_es}</span>
                  <span className="home-word-card-ru">{w.translation_ru}</span>
                </div>
                <button type="button" className="home-word-card-btn" onClick={() => handleWordKnown(w.id)} title={isRu ? "Знаю" : "Lo sé"}>
                  <i className="ti ti-check" />
                </button>
              </div>
            ))}
          </div>
          {remainingDue > 0 && (
            <p className="home-section-meta" style={{ margin: "4px 0 0" }}>
              {isRu ? `И ещё ${remainingDue}…` : `Y ${remainingDue} más…`}
            </p>
          )}
        </section>
      ) : (
        <div className="home-words-empty">
          <span>{"&#10003;"}</span> {t("home.words.empty", lang)}
        </div>
      )}

      {/* ── 4+5. Readiness + Week side by side ─────────────────── */}
      <div className="hd-bottom-row">
        <section className="home-section glass home-readiness">
          <h3 className="home-section-title">{t("home.ready.title", lang)}</h3>
          <div className="readiness-header">
            <span className="readiness-pct" style={{ color: readiness.color }}>{readiness.score}%</span>
            {readiness.label && (
              <span className="readiness-label" style={{ color: readiness.color }}>{readiness.label}</span>
            )}
          </div>
          <div className="progress-track readiness-track">
            <span style={{ width: `${Math.max(readiness.score, 1)}%`, background: readiness.color }} />
          </div>
          <p className="home-section-meta" style={{ marginTop: 6 }}>
            {toExamRecommend > 0
              ? `${t("home.ready.more", lang)} ${toExamRecommend} ${t("home.ready.questions", lang)}`
              : t("home.ready.go", lang)}
          </p>
          <p className="home-section-meta">{seenCount} / {total} {t("home.ready.seen", lang)}</p>
        </section>

        <section className="home-section glass">
          <h3 className="home-section-title">{t("home.week.title", lang)}</h3>
          <WeekDots activity={weekActivity} />
        </section>
      </div>

      {/* ── Stats row ──────────────────────────────────────────── */}
      <section className="home-stats-row">
        <div className="home-stat">
          <span className="home-stat-val">{seenCount}</span>
          <span className="home-stat-label">{t("home.stat.questions", lang)}</span>
        </div>
        <div className="home-stat">
          <span className="home-stat-val">{mistakesCount}</span>
          <span className="home-stat-label">{t("home.stat.mistakes", lang)}</span>
        </div>
        <div className="home-stat">
          <span className="home-stat-val">{masteredWords.length}/{glossaryData.length}</span>
          <span className="home-stat-label">{t("home.stat.words", lang)}</span>
        </div>
      </section>

    </PageShell>
  );
}
