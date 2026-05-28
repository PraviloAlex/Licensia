import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PageShell } from "../components/PageShell";
import { questionsData, glossaryData } from "../lib/data";
import {
  getQuestionProgressMap,
  getUniqueSeenCount,
  getTotalWrongAnswersCount,
  type QuestionProgressItem,
} from "../lib/questionProgress";
import { getMasteredWordIds, getReviewWordIds } from "../lib/vocabularyStatus";
import { getUILang, t } from "../lib/i18n";

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

const SUBTOPIC_ICONS: Record<string, string> = {
  seguridad_vial: "🛡️", velocidad: "⚡", ciclistas: "🚲",
  peatones: "🚶", semaforos: "🚦", ferroviario: "🚂",
  adelantamiento: "↗️", luces: "💡", estacionamiento: "🅿️",
  documentos: "📄", cinturon_ninos: "👶", senales: "🔺",
  demarcacion: "🛣️", prioridad: "⬆️", intersecciones: "✚",
  mecanico: "🔧", alcohol: "🍺", fatiga: "😴", otros: "📋",
};

function StatCard({
  icon, label, value, sub, barValue, barColor,
}: {
  icon: string; label: string; value: string;
  sub?: string; barValue?: number; barColor?: string;
}) {
  return (
    <article className="stat-card glass">
      <div className="stat-head"><span>{icon}</span><p>{label}</p></div>
      <h3 className="stat-value">{value}</h3>
      {barValue !== undefined && (
        <div className="progress-track" style={{ margin: "6px 0 4px" }}>
          <span style={{ width: `${Math.min(100, barValue)}%`, background: barColor ?? "var(--blue)" }} />
        </div>
      )}
      {sub && <p className="meta" style={{ marginTop: 4 }}>{sub}</p>}
    </article>
  );
}

export function ProgressPage() {
  const lang = getUILang();
  const [confirmReset, setConfirmReset] = useState(false);
  const progressMap = useMemo(getQuestionProgressMap, []);
  const total         = questionsData.length;
  const seen          = getUniqueSeenCount();
  const totalWrong    = getTotalWrongAnswersCount();
  const masteredWords = getMasteredWordIds();
  const reviewWords   = getReviewWordIds();

  const seenPercent   = total > 0 ? Math.round((seen / total) * 100) : 0;
  const totalCorrect  = useMemo(
    () => Object.values(progressMap).reduce((s, p) => s + p.correctCount, 0),
    [progressMap],
  );
  const totalAnswered = totalCorrect + totalWrong;
  const accuracyPercent = totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 0;
  const accuracyColor   = accuracyPercent >= 80 ? "var(--green)" : accuracyPercent >= 60 ? "var(--blue)" : "#ffb870";

  const hardQuestions = useMemo(
    () =>
      questionsData
        .filter((q) => (progressMap[q.id]?.wrongCount ?? 0) > 0)
        .sort((a, b) => (progressMap[b.id]?.wrongCount ?? 0) - (progressMap[a.id]?.wrongCount ?? 0))
        .slice(0, 10),
    [progressMap],
  );

  const unseenCount = total - seen;
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

  return (
    <PageShell title={t("progress.title", lang)}>
      <div className="progress-stats-grid">
        <StatCard
          icon="📖" label={t("progress.s.questions", lang)}
          value={`${seen}/${total}`}
          barValue={seenPercent}
          sub={`${unseenCount} ${t("progress.s.unseen", lang)}`}
        />
        <StatCard
          icon="🎯" label={t("progress.s.accuracy", lang)}
          value={`${accuracyPercent}%`}
          barValue={accuracyPercent}
          barColor={accuracyColor}
          sub={`${totalCorrect} ${t("progress.s.of", lang)} ${totalAnswered} ${t("progress.s.answers", lang)}`}
        />
        <StatCard
          icon="⚠️" label={t("progress.s.mistakes", lang)}
          value={String(totalWrong)}
          sub={`${t("progress.s.inQ", lang)} ${hardQuestions.length} ${t("progress.s.inQend", lang)}`}
        />
        <StatCard
          icon="🧠" label={t("progress.s.words", lang)}
          value={`${masteredWords.length}/${glossaryData.length}`}
          barValue={wordBarValue}
          barColor="var(--green)"
          sub={`${Math.max(0, reviewWords.length - masteredWords.length)} ${t("progress.s.onRep", lang)}`}
        />
      </div>

      {seen === 0 && (
        <section className="glass" style={{ borderRadius: "var(--r-lg)", padding: "var(--sp-3)", textAlign: "center" }}>
          <p style={{ margin: "0 0 12px", color: "var(--text-mid)" }}>{t("progress.empty", lang)}</p>
          <Link to="/practice" className="cta-primary" style={{ display: "inline-block" }}>
            {t("progress.startBtn", lang)}
          </Link>
        </section>
      )}

      {hardQuestions.length > 0 && (
        <section style={{ display: "grid", gap: "var(--sp-2)" }}>
          <p className="progress-section-title">{t("progress.hard", lang)}</p>
          <div style={{ display: "grid", gap: 8 }}>
            {hardQuestions.map((q) => {
              const p = progressMap[q.id];
              const wrong   = p?.wrongCount   ?? 0;
              const correct = p?.correctCount ?? 0;
              const acc = wrong + correct > 0 ? Math.round((correct / (correct + wrong)) * 100) : 0;
              return (
                <article key={q.id} className="hard-question-card">
                  <div className="hard-question-stats">
                    <span className="hard-question-stat" style={{ color: "var(--red)" }}>❌ {wrong}</span>
                    <span className="hard-question-stat" style={{ color: "var(--green)" }}>✅ {correct}</span>
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

      {seen > 0 && (
        <section style={{ display: "grid", gap: "var(--sp-2)" }}>
          <p className="progress-section-title">{t("progress.byTopic", lang)}</p>
          <div className="progress-topics-grid">
            {topics.map(([st, s]) => {
              const seenPct  = s.total > 0 ? Math.round((s.seen / s.total) * 100) : 0;
              const accPct   = s.answered > 0 ? Math.round((s.correct / s.answered) * 100) : 0;
              const accColor = accPct >= 80 ? "var(--green)" : accPct >= 60 ? "var(--blue)" : "#ffb870";
              const label = (t as (k: string, l: typeof lang) => string)(`subtopic.${st}`, lang);
              return (
                <Link key={st} to={`/practice?subtopic=${st}`} className="topic-stat-card topic-stat-card--link glass">
                  <div className="topic-stat-head">
                    <span className="topic-stat-icon">{SUBTOPIC_ICONS[st] ?? "📋"}</span>
                    <span className="topic-stat-name">{label}</span>
                  </div>
                  <div className="progress-track" style={{ margin: "6px 0 4px" }}>
                    <span style={{ width: `${seenPct}%`, background: "var(--blue)" }} />
                  </div>
                  <div className="topic-stat-meta">
                    <span style={{ color: "var(--text-low)" }}>{s.seen}/{s.total}</span>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 1 }}>
                      <span style={{ color: seenPct >= 100 ? "var(--green)" : "var(--blue)", fontWeight: 700 }}>{seenPct}%</span>
                      {s.answered > 0 && <span style={{ color: accColor, fontSize: "0.7rem", opacity: 0.8 }}>{accPct}% ✓</span>}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
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
