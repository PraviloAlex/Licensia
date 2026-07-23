import { useState } from "react";
import { PageShell } from "../components/PageShell";
import { ProGate } from "../components/ProGate";
import { questionsData } from "../lib/data";
import { getQuestionProgressMap } from "../lib/questionProgress";
import { getUILang, t } from "../lib/i18n";

export function MistakesPage() {
  const [progressMap] = useState(getQuestionProgressMap);
  const lang = getUILang();
  /* Explanation fields are authored in Russian only — mark them in the ES UI. */
  const isEsUi = lang === "es";
  const questions = questionsData
    .filter((q) => (progressMap[q.id]?.wrongCount ?? 0) > 0)
    .sort((a, b) => (progressMap[b.id]?.wrongCount ?? 0) - (progressMap[a.id]?.wrongCount ?? 0));

  return (
    <PageShell title={t("more.mistakes", lang)}>
      {questions.length === 0 ? (
        <div className="question-card">
          <h2>{t("mistakes.empty.title", lang)}</h2>
          <p>{t("mistakes.empty.text", lang)}</p>
        </div>
      ) : (
        <div className="stack">
          {questions.map((q) => {
            const p = progressMap[q.id];
            return (
              <article key={q.id} className="question-card glass">
                <p className="meta">
                  {q.topic}
                  {" \u00b7 "}
                  <i className="ti ti-x" aria-hidden="true" /> {p?.wrongCount ?? 0}
                  {" \u00b7 "}
                  <i className="ti ti-check" aria-hidden="true" /> {p?.correctCount ?? 0}
                </p>
                <h2>{q.question_es}</h2>
                <p className="question-ru">{q.question_ru}</p>
                {q.keyRule_ru && (
                  <p className="meta">
                    <b className="pv2-keyrule-label">{t("pv2.keyRule", lang)}</b>
                    {q.keyRule_ru}
                    {isEsUi && <span className="pv2-lang-chip" title={t("lang.ruOnly", lang)}>RU</span>}
                  </p>
                )}
                {q.explanation_ru && (
                  <ProGate lang={lang}>
                    <p className="meta">
                      {q.explanation_ru}
                      {isEsUi && <span className="pv2-lang-chip" title={t("lang.ruOnly", lang)}>RU</span>}
                    </p>
                  </ProGate>
                )}
              </article>
            );
          })}
        </div>
      )}
    </PageShell>
  );
}
