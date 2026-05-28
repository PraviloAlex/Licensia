import { useState } from "react";
import { PageShell } from "../components/PageShell";
import { questionsData } from "../lib/data";
import { getQuestionProgressMap } from "../lib/questionProgress";

export function MistakesPage() {
  const [progressMap] = useState(getQuestionProgressMap);
  const questions = questionsData
    .filter((q) => (progressMap[q.id]?.wrongCount ?? 0) > 0)
    .sort((a, b) => (progressMap[b.id]?.wrongCount ?? 0) - (progressMap[a.id]?.wrongCount ?? 0));

  return (
    <PageShell title="Мои ошибки">
      {questions.length === 0 ? (
        <div className="question-card">
          <h2>Пока ошибок нет</h2>
          <p>Когда ошибетесь в практике, вопрос появится здесь.</p>
        </div>
      ) : (
        <div className="stack">
          {questions.map((q) => {
            const p = progressMap[q.id];
            return (
              <article key={q.id} className="question-card glass">
                <p className="meta">{q.topic} · ❌ {p?.wrongCount ?? 0} · ✅ {p?.correctCount ?? 0}</p>
                <h2>{q.question_es}</h2>
                <p className="question-ru">{q.question_ru}</p>
                {q.explanation_ru && <p className="meta">{q.explanation_ru}</p>}
              </article>
            );
          })}
        </div>
      )}
    </PageShell>
  );
}
