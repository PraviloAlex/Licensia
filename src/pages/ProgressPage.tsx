import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PageShell } from "../components/PageShell";
import { ReadinessRing } from "../components/ReadinessRing";
import { EvolutionChart } from "../components/EvolutionChart";
import { getExamAttempts } from "../lib/examHistory";
import { EXAM_PASS_PERCENT } from "../constants/exam";
import { questionsData, glossaryData } from "../lib/data";
import {
  getQuestionProgressMap,
  getUniqueSeenCount,
  getTotalWrongAnswersCount,
  type QuestionProgressItem,
} from "../lib/questionProgress";
import { getMasteredWordIds, getReviewWordIds } from "../lib/vocabularyStatus";
import { getPassProbability } from "../lib/readiness";
import { getUILang, t, type UILang } from "../lib/i18n";

const PROGRESS_KEYS_TO_CLEAR = [
  "licensia_question_progress",
  "licensia_current_practice_session",
  "licencia_ar_seen_questions",
  "licencia_ar_mistakes",
  "exam_history_v1",
  "licencia_ar_exam_today",
  "licencia_ar_streak",
  "licencia_ar_word_status",
  "licencia_ar_known_sessions",
  "licencia_ar_review_srs",
  "licencia_ar_review_words",
  "licencia_ar_known_clicks",
  "licencia_ar_review_added_at",
  "licencia_ar_reviewed_today",
  "licencia_ar_known_last_counted",
];

function resetProgress() {
  PROGRESS_KEYS_TO_CLEAR.forEach((k) => window.localStorage.removeItem(k));
  window.location.reload();
}

/** Read-only view of the history that useExamSession writes (that hook is protected). */
function readExamHistory(): { attempts: number; bestPct: number } {
  try {
    const raw = window.localStorage.getItem("exam_history_v1");
    if (!raw) return { attempts: 0, bestPct: 0 };
    const data = JSON.parse(raw) as { attempts?: number; bestPct?: number };
    return {
      attempts: Number.isFinite(data.attempts) ? Number(data.attempts) : 0,
      bestPct: Number.isFinite(data.bestPct) ? Number(data.bestPct) : 0,
    };
  } catch {
    return { attempts: 0, bestPct: 0 };
  }
}

const SUBTOPIC_ICONS: Record<string, string> = {
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

/** Above this accuracy a topic is not "weak" — the CTA is hidden instead. */
const WEAK_TOPIC_MAX_ACCURACY = 80;

/** Coverage scale from the design spec: <30 bad, 30-60 gold, >60 good. */
function coverageColor(pct: number): string {
  if (pct > 60) return "var(--green)";
  if (pct >= 30) return "var(--gold)";
  return "var(--red)";
}

function accuracyColor(pct: number): string {
  if (pct >= 80) return "var(--green)";
  if (pct >= 60) return "var(--accent)";
  return "var(--gold)";
}

function Tile({ icon, label, value, sub, subColor }: {
  icon: string; label: string; value: string; sub: string; subColor?: string;
}) {
  return (
    <article className="pg-tile">
      <span className="pg-tile-ico" aria-hidden="true"><i className={`ti ${icon}`} /></span>
      <span className="pg-tile-label">{label}</span>
      <span className="pg-tile-value">{value}</span>
      <span className="pg-tile-sub" style={subColor ? { color: subColor } : undefined}>{sub}</span>
    </article>
  );
}

export function ProgressPage() {
  const lang: UILang = getUILang();
  const [confirmReset, setConfirmReset] = useState(false);
  const progressMap = useMemo(getQuestionProgressMap, []);
  const total         = questionsData.length;
  const seen          = getUniqueSeenCount();
  const totalWrong    = getTotalWrongAnswersCount();
  const masteredWords = getMasteredWordIds();
  const reviewWords   = getReviewWordIds();
  const examHistory   = useMemo(readExamHistory, []);
  const examAttempts  = useMemo(getExamAttempts, []);

  const seenPercent   = total > 0 ? Math.round((seen / total) * 100) : 0;
  const totalCorrect  = useMemo(
    () => Object.values(progressMap).reduce((s, p) => s + p.correctCount, 0),
    [progressMap],
  );
  const totalAnswered = totalCorrect + totalWrong;
  const accuracyPercent = totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 0;
  const passProb = getPassProbability();

  const hardQuestions = useMemo(
    () =>
      questionsData
        .filter((q) => (progressMap[q.id]?.wrongCount ?? 0) > 0)
        .sort((a, b) => (progressMap[b.id]?.wrongCount ?? 0) - (progressMap[a.id]?.wrongCount ?? 0))
        .slice(0, 10),
    [progressMap],
  );

  const wordBarValue = glossaryData.length > 0
    ? Math.round((masteredWords.length / glossaryData.length) * 100)
    : 0;

  // ── By-topic stats ───────────────────────────────────────────
  type SubtopicStats = { total: number; seen: number; correct: number; answered: number };
  const byTopic = useMemo(() => {
    const map: Record<string, SubtopicStats> = {};
    for (const q of questionsData) {
      const st = (q as { subtopic?: string }).subtopic ?? "otros";
      if (!map[st]) map[st] = { total: 0, seen: 0, correct: 0, answered: 0 };
      map[st].total++;
      const p: QuestionProgressItem | undefined = progressMap[q.id];
      if (p && (p.correctCount + p.wrongCount) > 0) {
        map[st].seen++;
        map[st].correct  += p.correctCount;
        map[st].answered += p.correctCount + p.wrongCount;
      }
    }
    return map;
  }, [progressMap]);

  const topics = Object.entries(byTopic)
    .filter(([, s]) => s.total > 0)
    .sort((a, b) => b[1].seen - a[1].seen || a[0].localeCompare(b[0]));

  const weakTopic = useMemo(() => {
    const answered = Object.entries(byTopic).filter(([, s]) => s.answered >= 1);
    if (answered.length === 0) return null;
    const [key, s] = answered
      .map(([k, v]) => [k, v] as const)
      .sort((a, b) => {
        const accA = Math.round((a[1].correct / a[1].answered) * 100);
        const accB = Math.round((b[1].correct / b[1].answered) * 100);
        return accA - accB || b[1].seen - a[1].seen;
      })[0];
    const accuracy = Math.round((s.correct / s.answered) * 100);
    // Nothing is actually weak yet — offering "train the weak topic · 100%" reads wrong.
    if (accuracy >= WEAK_TOPIC_MAX_ACCURACY) return null;
    return { key, accuracy };
  }, [byTopic]);

  const topicLabel = (st: string) => (t as (k: string, l: UILang) => string)(`subtopic.${st}`, lang);

  return (
    <PageShell title={t("progress.title", lang)}>
      {/* ── Hero: готовность ───────────────────────────────────── */}
      <section className="pg-hero glass">
        <ReadinessRing score={passProb.pct} color={passProb.color} caption={t("progress.ready.word", lang)} />
        <div className="pg-hero-text">
          <p className="pg-hero-label">{t("progress.ready", lang)}</p>
          <p className="pg-hero-title" style={{ color: passProb.color }}>{t(passProb.labelKey, lang)}</p>
          <p className="pg-hero-meta">
            {seen} / {total} {t("progress.s.questions", lang).toLowerCase()}
            {totalAnswered > 0 && <> · {accuracyPercent}% {t("progress.t.accuracy", lang).toLowerCase()}</>}
          </p>
        </div>
      </section>

      {/* ── 4 плитки ───────────────────────────────────────────── */}
      <div className="pg-tiles">
        <Tile icon="ti-book" label={t("progress.t.studied", lang)}
          value={`${seen}/${total}`}
          sub={`${seenPercent}% ${t("progress.t.coverage", lang)}`}
          subColor={coverageColor(seenPercent)} />
        <Tile icon="ti-target" label={t("progress.t.accuracy", lang)}
          value={totalAnswered > 0 ? `${accuracyPercent}%` : "—"}
          sub={`${totalCorrect} ${t("progress.s.of", lang)} ${totalAnswered}`}
          subColor={totalAnswered > 0 ? accuracyColor(accuracyPercent) : undefined} />
        <Tile icon="ti-language" label={t("progress.t.words", lang)}
          value={`${masteredWords.length}/${glossaryData.length}`}
          sub={`${Math.max(0, reviewWords.length - masteredWords.length)} ${t("progress.s.onRep", lang)}`}
          subColor={wordBarValue > 0 ? "var(--green)" : undefined} />
        <Tile icon="ti-clipboard-check" label={t("progress.t.exams", lang)}
          value={String(examHistory.attempts)}
          sub={examHistory.attempts > 0
            ? `${t("progress.t.exams.best", lang)} ${examHistory.bestPct}%`
            : t("progress.t.exams.none", lang)}
          subColor={examHistory.attempts > 0 ? accuracyColor(examHistory.bestPct) : undefined} />
      </div>

      {examAttempts.length > 0 && (
        <section className="pg-evolution">
          <p className="progress-section-title">{t("progress.evolution.title", lang)}</p>
          <EvolutionChart attempts={examAttempts} passPercent={EXAM_PASS_PERCENT} lang={lang} />
        </section>
      )}

      {seen === 0 && (
        <section className="glass" style={{ borderRadius: "var(--r-lg)", padding: "var(--sp-3)", textAlign: "center" }}>
          <p style={{ margin: "0 0 12px", color: "var(--text-mid)" }}>{t("progress.empty", lang)}</p>
          <Link to="/practice" className="cta-primary" style={{ display: "inline-block" }}>
            {t("progress.startBtn", lang)}
          </Link>
        </section>
      )}

      {/* ── По темам: полоса = покрытие, цифра справа = точность ─ */}
      {seen > 0 && (
        <section style={{ display: "grid", gap: "var(--sp-2)" }}>
          <p className="progress-section-title">{t("progress.byTopic", lang)}</p>
          <div className="progress-topics-grid">
            {topics.map(([st, s]) => {
              const coveragePct = s.total > 0 ? Math.round((s.seen / s.total) * 100) : 0;
              const accPct      = s.answered > 0 ? Math.round((s.correct / s.answered) * 100) : 0;
              return (
                <Link key={st} to={`/practice?subtopic=${st}`} className="topic-stat-card topic-stat-card--link glass">
                  <div className="topic-stat-head">
                    <span className="topic-stat-icon" aria-hidden="true"><i className={`ti ${SUBTOPIC_ICONS[st] ?? "ti-dots"}`} /></span>
                    <span className="topic-stat-name">{topicLabel(st)}</span>
                  </div>
                  <div className="progress-track" style={{ margin: "6px 0 4px" }}>
                    <span style={{ width: `${coveragePct}%`, background: coverageColor(coveragePct) }} />
                  </div>
                  <div className="topic-stat-meta">
                    <span className="pg-topic-coverage">{s.seen}/{s.total} · {coveragePct}%</span>
                    {s.answered > 0
                      ? <span className="pg-topic-acc" style={{ color: accuracyColor(accPct) }}>{accPct}%</span>
                      : <span className="pg-topic-acc pg-topic-acc--empty">—</span>}
                  </div>
                </Link>
              );
            })}
          </div>
          {weakTopic && (
            <Link to={`/practice?subtopic=${weakTopic.key}`} className="pg-weak-cta">
              <i className="ti ti-flame" aria-hidden="true" />
              <span className="pg-weak-cta-text">
                {t("progress.weakBtn", lang)}
                <span className="pg-weak-cta-sub">{topicLabel(weakTopic.key)} · {weakTopic.accuracy}%</span>
              </span>
              <i className="ti ti-chevron-right" aria-hidden="true" />
            </Link>
          )}
        </section>
      )}

      {hardQuestions.length > 0 && (
        <section id="topics" style={{ display: "grid", gap: "var(--sp-2)" }}>
          <p className="progress-section-title">
            {t("progress.hard", lang)} · {totalWrong} {t("progress.hard.sub", lang)}
          </p>
          <div style={{ display: "grid", gap: 8 }}>
            {hardQuestions.map((q) => {
              const p = progressMap[q.id];
              const wrong   = p?.wrongCount   ?? 0;
              const correct = p?.correctCount ?? 0;
              const acc = wrong + correct > 0 ? Math.round((correct / (correct + wrong)) * 100) : 0;
              return (
                <article key={q.id} className="hard-question-card">
                  <div className="hard-question-stats">
                    <span className="hard-question-stat" style={{ color: "var(--red)" }}>
                      <i className="ti ti-x" aria-hidden="true" /> {wrong}
                    </span>
                    <span className="hard-question-stat" style={{ color: "var(--green)" }}>
                      <i className="ti ti-check" aria-hidden="true" /> {correct}
                    </span>
                    <span className="hard-question-stat">{acc}%</span>
                  </div>
                  <p className="hard-question-es">{q.question_es}</p>
                  <p className="hard-question-ru">{q.question_ru}</p>
                  {q.explanation_ru && <p className="hard-question-exp">{q.explanation_ru}</p>}
                </article>
              );
            })}
          </div>
          <Link to="/practice?mistakes=1" className="cta-secondary" style={{ textAlign: "center" }}>
            {t("progress.mistakesLink", lang)}
          </Link>
        </section>
      )}

      <button
        type="button"
        className={confirmReset ? "cta-reset cta-reset--confirm" : "cta-reset"}
        onClick={() => {
          if (confirmReset) {
            resetProgress();
          } else {
            setConfirmReset(true);
            setTimeout(() => setConfirmReset(false), 4000);
          }
        }}
      >
        <i className={confirmReset ? "ti ti-alert-triangle" : "ti ti-trash"} />
        {confirmReset ? t("progress.reset.confirm2", lang) : t("progress.reset.btn", lang)}
      </button>
    </PageShell>
  );
}
