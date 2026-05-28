import { Link, useLocation } from "react-router-dom";
import { useMemo, useEffect, useState, useRef, type ReactNode } from "react";
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
const APP_VERSION = "v0.1";
const REMINDER_DISMISS_KEY = "licencia_ar_reminder_dismissed";

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
  const lang = getUILang();
  const labels = lang === "es" ? DAY_LABELS_ES : DAY_LABELS_RU;
  const getDayLabel = (i: number) => {
    const d = new Date();
    d.setDate(d.getDate() + (i - 6));
    return labels[(d.getDay() + 6) % 7];
  };
  return (
    <div className="week-dots">
      {activity.map((active, i) => {
        const isToday  = i === 6;
        const isPast   = i < 6;
        const isMissed = isPast && !active;
        let cls = "week-dot";
        if (active)   cls += " week-dot--active";
        if (isToday)  cls += " week-dot--today";
        if (isMissed) cls += " week-dot--missed";
        return (
          <div key={i} className="week-dot-col">
            <div className={cls} />
            <span className="week-dot-label">{getDayLabel(i)}</span>
          </div>
        );
      })}
    </div>
  );
}

function DailyRing({ completed, goal, lang }: { completed: number; goal: number; lang: UILang }) {
  const pct = Math.min(1, goal > 0 ? completed / goal : 0);
  const deg = Math.round(pct * 360);
  const color = pct >= 1 ? "#62f4b4" : "#7db8ff";
  return (
    <div className="daily-ring" style={{ background: `conic-gradient(${color} ${deg}deg, rgba(255,255,255,0.08) 0deg)` }}>
      <div className="daily-ring-inner">
        <span className="daily-ring-val">{completed}/{goal}</span>
        <span className="daily-ring-sub">{t("home.ring.sub", lang)}</span>
      </div>
    </div>
  );
}

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
      <span className="mission-card-icon">{done ? "✅" : icon}</span>
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

  // Weak topic computation
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

  // Fresh topic: least covered (fewest seen/total), for left slot when no active mistakes
  const freshTopic = Object.entries(byTopicMap)
    .filter(([, s]) => s.seen < s.total)
    .map(([key, s]) => ({ key, seen: s.seen, total: s.total, coveragePct: Math.round((s.seen / s.total) * 100) }))
    .sort((a, b) => a.coveragePct - b.coveragePct || b.total - a.total)[0] ?? null;

  // Second fresh topic: for right slot when no weakTopic and no mistakes
  const secondFreshTopic = Object.entries(byTopicMap)
    .filter(([, s]) => s.seen < s.total)
    .map(([key, s]) => ({ key, seen: s.seen, total: s.total, coveragePct: Math.round((s.seen / s.total) * 100) }))
    .sort((a, b) => a.coveragePct - b.coveragePct || b.total - a.total)
    .filter(t => !freshTopic || t.key !== freshTopic.key)[0] ?? null;

  const mistakeQuestionCount = getMistakeQuestionCount(questionsData);
  const correctedMistakeCount = getCorrectedMistakeCount(questionsData);
  const readiness      = getReadinessLevel(seenCount, total, totalCorrect, mistakesCount);
  const todayAnswered  = getTodayAnsweredCount();
  const activeSession  = getActivePracticeSessionSummary();
  const dueWordsCount  = getDueWordsCount();
  const duePreview     = getDueWordsPreview(4);
  const weekActivity   = getWeeklyActivity();
  const masteredWords  = getMasteredWordIds();
  const examDoneToday  = getExamCompletedToday();
  const reviewedTodayCount = getReviewedTodayCount();
  return {
    seenCount, mistakesCount, total, readiness,
    todayAnswered, activeSession, dueWordsCount, duePreview,
    weekActivity, masteredWords, examDoneToday, reviewedTodayCount, weakTopic, mistakeQuestionCount, correctedMistakeCount, freshTopic, secondFreshTopic,
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
  const [dismissedWords, setDismissedWords] = useState<Set<string>>(new Set());
  const [reminderDismissed, setReminderDismissed] = useState(() => getReminderDismissedToday());
  const gearRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setData(readHomeData()); }, [location.key]);

  useEffect(() => {
    if (!gearOpen) return;
    const fn = (e: MouseEvent) => {
      if (gearRef.current && !gearRef.current.contains(e.target as Node)) setGearOpen(false);
    };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, [gearOpen]);

  function toggleConfirmMode() {
    const next = !confirmMode;
    setConfirmMode(next);
    if (typeof window !== "undefined") window.localStorage.setItem("practice_confirm_mode", next ? "1" : "0");
  }

  function pickLang(l: UILang) {
    setUILang(l);
    setLang_(l);
    window.dispatchEvent(new Event("ui-lang-changed"));
    window.location.reload();
  }

  function handleWordKnown(wordId: string) {
    markWordKnown(wordId);
    setDismissedWords((prev) => new Set([...prev, wordId]));
    setData(readHomeData());
  }

  const {
    seenCount, mistakesCount, total, readiness, todayAnswered,
    activeSession, dueWordsCount, duePreview, weekActivity,
    masteredWords, examDoneToday, reviewedTodayCount, weakTopic, mistakeQuestionCount, correctedMistakeCount, freshTopic, secondFreshTopic,
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

  function handleDismissReminder() {
    dismissReminderToday();
    setReminderDismissed(true);
  }

  const dailyDone        = todayAnswered >= DAILY_GOAL;
  const toExamRecommend  = Math.max(0, EXAM_RECOMMEND_THRESHOLD - seenCount);
  const seenPercent      = total > 0 ? Math.round((seenCount / total) * 100) : 0;

  const recommendText = activeSession
    ? t("home.rec.continue", lang)
    : dueWordsCount > 0
    ? `${t("home.rec.words", lang)} (${dueWordsCount})`
    : readiness.score >= 80
    ? t("home.rec.exam", lang)
    : t("home.rec.start", lang);

  const continueLabel = activeSession
    ? `${t("home.continue", lang)} ${activeSession.currentIndex + 1}/${activeSession.totalQuestions}`
    : null;

  const missionWordsProgress = reviewedTodayCount > 0
    ? `${t("home.m.reviewed", lang)} ${reviewedTodayCount}`
    : dueWordsCount > 0
    ? `${dueWordsCount} ${t("home.m.waiting", lang)}`
    : undefined;

  const remainingDue = dueWordsCount - visibleWords.length;

  return (
    <PageShell title="Licencia AR" backToHome={false}>

      {showReminder && (
        <div className="home-reminder">
          <span className="home-reminder-icon">🔔</span>
          <span className="home-reminder-text">
            {lang === "ru"
              ? daysSince === 1
                ? "Вчера не занимались — пора повторить!"
                : `Не занимались ${daysSince} дня — пора повторить!`
              : daysSince === 1
                ? "Ayer no practicaste — és hora de repasar!"
                : `Hace ${daysSince} días que no practicás — és hora de repasar!`}
          </span>
          <button
            type="button"
            className="home-reminder-dismiss"
            onClick={handleDismissReminder}
            aria-label="Закрыть"
          >
            <i className="ti ti-x" />
          </button>
        </div>
      )}

      <section className="home-hero glass">
        <div className="home-hero-left">
          <p className="home-recommendation">
            {t("home.recommend", lang)} <strong>{recommendText}</strong>
          </p>

          {continueLabel && (
            <Link to="/practice" className="cta-primary home-continue-btn">{"▶"} {continueLabel}</Link>
          )}

          <p className="home-launch-title">{t("home.launch.title", lang)}</p>
          <div className="home-action-grid">
            {/* Row 1 — always */}
            <Link to="/practice" className="home-action-btn">
              <span className="home-action-icon">{"📝"}</span>
              <span className="home-action-label">{t("home.action.p20", lang)}</span>
            </Link>
            <Link to="/practice?quick=1" className="home-action-btn">
              <span className="home-action-icon">{"⚡"}</span>
              <span className="home-action-label">{t("home.action.q5", lang)}</span>
            </Link>
            {/* Row 2 — always */}
            <Link to="/vocabulary?tab=review" className={`home-action-btn${dueWordsCount > 0 ? " home-action-btn--words" : ""}`}>
              <span className="home-action-icon">{"🗣️"}</span>
              <span className="home-action-label">
                {t("home.action.words", lang)}{dueWordsCount > 0 ? ` (${dueWordsCount})` : ""}
              </span>
            </Link>
            <Link to="/practice?exam=1" className="home-action-btn home-action-btn--exam">
              <span className="home-action-icon"><i className="ti ti-clipboard-check" /></span>
              <span className="home-action-label">{t("home.action.exam", lang)}</span>
            </Link>
            {/* Row 3 — two half-cards, conditional */}
            {(mistakeQuestionCount > 0 || weakTopic || freshTopic) && (
              <div className="home-row3">
                {mistakeQuestionCount > 0 && (
                  <Link to="/practice?mistakes=1" className="home-mistakes-card">
                    <div className="home-weak-top">
                      <span className="home-weak-icon"><i className="ti ti-target" /></span>
                      <span className="home-weak-info">
                        <span className="home-weak-title">{lang === "ru" ? "Ошибки" : "Errores"}</span>
                        <span className="home-weak-meta">{mistakeQuestionCount} {lang === "ru" ? (mistakeQuestionCount === 1 ? "вопрос" : mistakeQuestionCount < 5 ? "вопроса" : "вопросов") : "preguntas"}</span>
                      </span>
                    </div>
                    <div className="home-weak-bar-wrap">
                      <div className="home-weak-bar" style={{ width: (() => { const total = mistakeQuestionCount + correctedMistakeCount; return total > 0 ? `${Math.round(correctedMistakeCount / total * 100)}%` : "0%"; })() }} />
                    </div>
                    <span className="home-weak-cta">{lang === "ru" ? "Отработать →" : "Practicar →"}</span>
                  </Link>
                )}
                {mistakeQuestionCount === 0 && freshTopic && (
                  <Link to={`/practice?subtopic=${freshTopic.key}`} className="home-fresh-card">
                    <div className="home-weak-top">
                      <span className="home-weak-icon home-fresh-icon"><i className="ti ti-books" /></span>
                      <span className="home-weak-info">
                        <span className="home-weak-title">{(t as (k: string, l: UILang) => string)(`subtopic.${freshTopic.key}`, lang)}</span>
                        <span className="home-weak-meta">{freshTopic.seen} {lang === "ru" ? "из" : "de"} {freshTopic.total} · {freshTopic.coveragePct}%</span>
                      </span>
                    </div>
                    <div className="home-fresh-bar-wrap">
                      <div className="home-fresh-bar" style={{ width: `${freshTopic.coveragePct}%` }} />
                    </div>
                    <span className="home-fresh-cta">{lang === "ru" ? "Новая тема →" : "Tema nueva →"}</span>
                  </Link>
                )}
                {!weakTopic && mistakeQuestionCount === 0 && secondFreshTopic && (
                  <Link to={`/practice?subtopic=${secondFreshTopic.key}`} className="home-fresh-card">
                    <div className="home-weak-top">
                      <span className="home-weak-icon home-fresh-icon"><i className="ti ti-books" /></span>
                      <div className="home-weak-info">
                        <span className="home-weak-title">{(t as (k: string, l: UILang) => string)(`subtopic.${secondFreshTopic.key}`, lang)}</span>
                        <span className="home-weak-meta">{secondFreshTopic.seen} {lang === "ru" ? "из" : "de"} {secondFreshTopic.total} · {secondFreshTopic.coveragePct}%</span>
                      </div>
                    </div>
                    <div className="home-fresh-bar-wrap">
                      <div className="home-fresh-bar" style={{ width: `${secondFreshTopic.coveragePct}%` }} />
                    </div>
                    <span className="home-fresh-cta">{lang === "ru" ? "Новая тема →" : "Tema nueva →"}</span>
                  </Link>
                )}
                {weakTopic && (
                  <Link to={`/practice?subtopic=${weakTopic.key}`} className="home-weak-card">
                    <div className="home-weak-top">
                      <span className="home-weak-icon"><i className={`ti ${weakTopicIcon}`} /></span>
                      <span className="home-weak-info">
                        <span className="home-weak-title">{(t as (k: string, l: UILang) => string)(`subtopic.${weakTopic.key}`, lang)}</span>
                        <span className="home-weak-meta">{weakTopic.seen} {lang === "ru" ? "из" : "de"} {weakTopic.total} · {weakTopic.accuracy}%</span>
                      </span>
                    </div>
                    <div className="home-weak-bar-wrap">
                      <div className="home-weak-bar" style={{ width: `${Math.round(weakTopic.seen / weakTopic.total * 100)}%` }} />
                    </div>
                    <span className="home-weak-cta">{lang === "ru" ? "Слабая тема →" : "Tema débil →"}</span>
                  </Link>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="home-hero-right">
          <div className="home-hero-controls">
            <div className="home-gear-row">
              <span className="home-version">{APP_VERSION}</span>
              <div className="home-gear-wrap" ref={gearRef}>
              <button
                type="button"
                className={gearOpen ? "home-gear-btn home-gear-btn--open" : "home-gear-btn"}
                onClick={() => setGearOpen((v) => !v)}
                aria-label={t("pv2.settings", lang)}
                aria-expanded={gearOpen}
              >
                <i className="ti ti-settings" aria-hidden="true" />
              </button>
              {gearOpen && (
                <div className="pv2-gear-menu home-gear-menu" role="dialog">
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
                    <button
                      type="button"
                      className={lang === "ru" ? "pv2-gear-lang-btn pv2-gear-lang-btn--active" : "pv2-gear-lang-btn"}
                      onClick={() => { pickLang("ru"); setGearOpen(false); }}
                    >
                      {"🇷🇺"} {t("pv2.gear.uiRu", lang)}
                    </button>
                    <button
                      type="button"
                      className={lang === "es" ? "pv2-gear-lang-btn pv2-gear-lang-btn--active" : "pv2-gear-lang-btn"}
                      onClick={() => { pickLang("es"); setGearOpen(false); }}
                    >
                      {"🇦🇷"} {t("pv2.gear.uiEs", lang)}
                    </button>
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
                  <button
                    type="button"
                    className="pv2-gear-item"
                    onClick={() => setGearOpen(false)}
                  >
                    <span className="pv2-gear-ico pv2-gear-ico--red"><i className="ti ti-bug" /></span>
                    <span className="pv2-gear-text"><span className="pv2-gear-label">{t("home.gear.bug", lang)}</span></span>
                  </button>
                  <a
                    href="https://ko-fi.com/alexsun99"
                    target="_blank"
                    rel="noreferrer"
                    className="pv2-gear-item home-gear-item-link"
                    onClick={() => setGearOpen(false)}
                  >
                    <span className="pv2-gear-ico pv2-gear-ico--amber"><i className="ti ti-coffee" /></span>
                    <span className="pv2-gear-text"><span className="pv2-gear-label">{t("home.gear.support", lang)}</span></span>
                  </a>
                </div>
              )}
            </div>
            </div>
            <div className="home-lang-toggle">
              <button
                type="button"
                className={lang === "ru" ? "home-lang-btn home-lang-btn--active" : "home-lang-btn"}
                onClick={() => pickLang("ru")}
              >RU</button>
              <button
                type="button"
                className={lang === "es" ? "home-lang-btn home-lang-btn--active" : "home-lang-btn"}
                onClick={() => pickLang("es")}
              >ES</button>
            </div>
          </div>
          <DailyRing completed={todayAnswered} goal={DAILY_GOAL} lang={lang} />
        </div>
      </section>

      <section className="home-section-bare">
        <p className="home-section-label">{t("home.today", lang)}</p>
        <div className="mission-cards-grid">
          <MissionCard icon={"📝"} title={t("home.m.p20", lang)} progress={`${todayAnswered}/${DAILY_GOAL}`} done={dailyDone} to="/practice" />
          <MissionCard icon={"⚡"} title={t("home.m.q5", lang)} done={false} to="/practice?quick=1" />
          <MissionCard icon={"🗣️"} title={t("home.m.words", lang)} progress={missionWordsProgress} done={reviewedTodayCount >= 5} to="/vocabulary?tab=review" />
          <MissionCard icon={<i className="ti ti-clipboard-check" style={{color:"#f5b41e"}} />} title={examDoneToday ? t("home.m.exam.done", lang) : t("home.m.exam", lang)} done={false} to="/practice?exam=1" disabled={examDoneToday} />
        </div>
      </section>

      {visibleWords.length > 0 ? (
        <section className="home-section glass">
          <h3 className="home-section-title">{t("home.words.title", lang)}</h3>
          <div className="home-word-cards">
            {visibleWords.map((w) => (
              <div key={w.id} className="home-word-card">
                <div className="home-word-card-body">
                  <span className="home-word-card-es">{w.term_es}</span>
                  <span className="home-word-card-ru">{w.translation_ru}</span>
                </div>
                <button
                  type="button"
                  className="home-word-card-btn"
                  onClick={() => handleWordKnown(w.id)}
                  title={lang === "es" ? "Lo sé" : "Знаю"}
                >
                  <i className="ti ti-check" />
                </button>
              </div>
            ))}
          </div>
          {remainingDue > 0 && (
            <p className="home-section-meta" style={{ marginBottom: 8 }}>
              {t("home.words.more", lang)} {remainingDue}{"…"}
            </p>
          )}
          <Link to="/vocabulary?tab=review" className="cta-secondary" style={{ marginTop: 6, display: "inline-block" }}>
            {t("home.words.btn", lang)}
          </Link>
        </section>
      ) : (
        <div className="home-words-empty">
          <span>{"✓"}</span> {t("home.words.empty", lang)}
        </div>
      )}

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
