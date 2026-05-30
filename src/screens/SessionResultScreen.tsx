import { useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import { EXAM_PASS_CORRECT, EXAM_PASS_PERCENT } from "../constants/exam";
import type { UILang } from "../lib/i18n";
import type { SessionResult } from "../types/sessionResult";

type Props = {
  result: SessionResult;
  lang: UILang;
  onRetryMistakes: () => void;
  onNewPractice: () => void;
  onQuickPractice: () => void;
  onRepeatExam: () => void;
  onTopicPractice: () => void;
  onProgress: () => void;
  onHome: () => void;
};

export function SessionResultScreen({
  result,
  lang,
  onRetryMistakes,
  onNewPractice,
  onQuickPractice,
  onRepeatExam,
  onTopicPractice,
  onProgress,
  onHome,
}: Props) {
  const isExam = result.mode === "exam";
  const passed = isExam && result.correctAnswers >= EXAM_PASS_CORRECT;
  const copy = getResultCopy(lang);
  const status = getResultStatus(result, lang);
  const title = isExam ? copy.examTitle : copy.practiceTitle;
  const mainActionLabel = isExam
    ? copy.reviewExamMistakes
    : `${copy.practiceMistakes} (${result.wrongAnswers})`;

  return (
    <section className={`sr-screen sr-screen--${result.mode}`}>
      <header className="sr-topbar">
        <button type="button" className="sr-icon-btn" onClick={onHome} aria-label={copy.back}>
          <i className="ti ti-arrow-left" />
        </button>
        <span>{title}</span>
        <button type="button" className="sr-icon-btn" onClick={onProgress} aria-label={copy.progress}>
          <i className="ti ti-chart-bar" />
        </button>
      </header>

      <article className="sr-card">
        <div className="sr-hero">
          <ProgressRing
            value={result.percentage}
            label={status.short}
            variant={isExam ? (passed ? "success" : "danger") : "warning"}
          />
          <div className="sr-hero-text">
            <h1>{copy.score(result.correctAnswers, result.totalQuestions)}</h1>
            <p className="sr-subtitle">{copy.errors(result.wrongAnswers)}</p>
            <p className="sr-description">{status.description}</p>
          </div>
        </div>

        {isExam ? (
          <ExamProtocol result={result} passed={passed} lang={lang} />
        ) : (
          <>
            <PracticeStats result={result} lang={lang} />
            <PracticeDiagnosis result={result} lang={lang} />
          </>
        )}

        <div className="sr-actions">
          <button
            type="button"
            className={isExam ? "sr-primary sr-primary--success" : "sr-primary"}
            onClick={onRetryMistakes}
            disabled={result.wrongAnswers === 0}
          >
            <i className={isExam ? "ti ti-shield-check" : "ti ti-flame"} />
            {result.wrongAnswers === 0 ? copy.noMistakes : mainActionLabel}
          </button>

          <div className="sr-secondary-grid">
            {isExam ? (
              <>
                <button type="button" className="sr-secondary" onClick={onRepeatExam}>
                  <i className="ti ti-refresh" />
                  {copy.repeatExam}
                </button>
                <button type="button" className="sr-secondary" onClick={onTopicPractice}>
                  <i className="ti ti-layout-grid" />
                  {copy.topicPractice}
                </button>
              </>
            ) : (
              <>
                <button type="button" className="sr-secondary" onClick={onQuickPractice}>
                  <i className="ti ti-clock" />
                  {copy.moreFive}
                </button>
                <button type="button" className="sr-secondary" onClick={onNewPractice}>
                  <i className="ti ti-player-play" />
                  {copy.newPractice20}
                </button>
              </>
            )}
          </div>

          <Link to="/" className="sr-home">
            <i className="ti ti-home" />
            {copy.home}
          </Link>
        </div>

        <MistakesList mistakes={result.mistakes} mode={result.mode} lang={lang} />
      </article>
    </section>
  );
}

function ProgressRing({
  value,
  label,
  variant,
}: {
  value: number;
  label: string;
  variant: "success" | "warning" | "danger";
}) {
  return (
    <div
      className={`sr-ring sr-ring--${variant}`}
      style={{ "--value": `${value}%` } as CSSProperties}
    >
      <div className="sr-ring-inner">
        <strong>{value}%</strong>
        <span>{label}</span>
      </div>
    </div>
  );
}

function PracticeStats({ result, lang }: { result: SessionResult; lang: UILang }) {
  const copy = getResultCopy(lang);

  return (
    <div className="sr-stats">
      <div className="sr-stat">
        <i className="ti ti-circle-check" />
        <b>{result.correctAnswers}</b>
        <span>{copy.correct}</span>
      </div>
      <div className="sr-stat">
        <i className="ti ti-circle-x" />
        <b>{result.wrongAnswers}</b>
        <span>{copy.mistakes}</span>
      </div>
      <div className="sr-stat">
        <i className="ti ti-clock" />
        <b>{result.durationMinutes ?? 8} {copy.min}</b>
        <span>{copy.toReinforce}</span>
      </div>
    </div>
  );
}

function PracticeDiagnosis({ result, lang }: { result: SessionResult; lang: UILang }) {
  const copy = getResultCopy(lang);
  const mainWeakTopic = result.weakTopics?.[0]?.name || copy.weakTopics;
  const isPerfect = result.wrongAnswers === 0;

  return (
    <div className={isPerfect ? "sr-diagnosis sr-diagnosis--success" : "sr-diagnosis sr-diagnosis--warning"}>
      <i className={isPerfect ? "ti ti-sparkles" : "ti ti-flame"} />
      <div>
        <strong>{isPerfect ? copy.perfectTitle : copy.mainWeakTopic(mainWeakTopic)}</strong>
        <span>
          {isPerfect
            ? copy.perfectText
            : copy.weakText}
        </span>
      </div>
    </div>
  );
}

function ExamProtocol({ result, passed, lang }: { result: SessionResult; passed: boolean; lang: UILang }) {
  const copy = getResultCopy(lang);
  const passQuestions = Math.ceil(result.totalQuestions * (EXAM_PASS_PERCENT / 100));

  return (
    <div className="sr-exam-block">
      <div className="sr-pass-card">
        <span>{copy.passResult}</span>
        <strong>{result.correctAnswers} / {result.totalQuestions}</strong>
        <div className="sr-pass-track">
          <b style={{ width: `${Math.min(100, result.percentage)}%` }} />
          <i style={{ left: `${EXAM_PASS_PERCENT}%` }} />
        </div>
        <small>{copy.minimum(passQuestions, result.totalQuestions, EXAM_PASS_PERCENT)}</small>
      </div>

      {result.weakTopics && result.weakTopics.length > 0 && (
        <div className="sr-weak-card">
          <span className="sr-section-label">{copy.topicsWithMistakes}</span>
          {result.weakTopics.slice(0, 3).map((topic) => (
            <div className="sr-weak-row" key={topic.name}>
              <span>{topic.name}</span>
              <b>{copy.errors(topic.mistakes)}</b>
            </div>
          ))}
        </div>
      )}

      <div className={passed ? "sr-diagnosis sr-diagnosis--success" : "sr-diagnosis sr-diagnosis--warning"}>
        <i className={passed ? "ti ti-shield-check" : "ti ti-alert-triangle"} />
        <div>
          <strong>{copy.recommendation}</strong>
          <span>
            {passed
              ? copy.examPassedRecommendation
              : copy.examFailedRecommendation}
          </span>
        </div>
      </div>
    </div>
  );
}

function MistakesList({ mistakes, mode, lang }: { mistakes: SessionResult["mistakes"]; mode: SessionResult["mode"]; lang: UILang }) {
  const [expanded, setExpanded] = useState(false);
  const copy = getResultCopy(lang);

  if (mistakes.length === 0) return null;

  const canExpand = mistakes.length > 3;
  const visibleMistakes = expanded ? mistakes : mistakes.slice(0, 3);

  return (
    <section className="sr-mistakes">
      <div className="sr-mistakes-head">
        <h2>{copy.mistakeReview} ({mistakes.length})</h2>
        {canExpand && (
          <button type="button" onClick={() => setExpanded((value) => !value)}>
            {expanded ? copy.collapse : copy.seeAll}
          </button>
        )}
      </div>
      <div className="sr-mistake-list">
        {visibleMistakes.map((mistake, index) => (
          <button className="sr-mistake-item" type="button" key={mistake.questionId}>
            <span className="sr-mistake-num">{mistake.number ?? index + 1}</span>
            <span className="sr-mistake-text">
              <strong>{mistake.title}</strong>
              <span className="sr-mistake-chips">
                <span className="sr-mistake-chip sr-mistake-chip--wrong">
                  <i aria-hidden="true">×</i>
                  <small>{copy.youChose}</small>
                  <b>{mistake.selectedAnswer}</b>
                </span>
                <span className="sr-mistake-chip sr-mistake-chip--correct">
                  <i aria-hidden="true">✓</i>
                  <small>{copy.correctAnswer}</small>
                  <b>{mistake.correctAnswer}</b>
                </span>
              </span>
            </span>
            <i className="ti ti-chevron-right" />
          </button>
        ))}
      </div>
      {mode === "exam" && canExpand && !expanded && <p className="sr-more">{copy.moreExamMistakes(mistakes.length - 3)}</p>}
    </section>
  );
}

function getResultStatus(result: SessionResult, lang: UILang) {
  const copy = getResultCopy(lang);

  if (result.mode === "exam") {
    if (result.correctAnswers >= EXAM_PASS_CORRECT) {
      return {
        short: copy.examPassShort,
        description: copy.examPassDescription,
      };
    }
    return {
      short: copy.repeatShort,
      description: copy.examFailDescription,
    };
  }

  if (result.wrongAnswers === 0) {
    return {
      short: copy.excellentShort,
      description: copy.practicePerfectDescription,
    };
  }

  return {
    short: copy.repeatPracticeShort,
    description: copy.practiceRetryDescription,
  };
}

function getResultCopy(lang: UILang) {
  if (lang === "es") {
    return {
      back: "Atrás",
      progress: "Progreso",
      practiceTitle: "Resultado de práctica",
      examTitle: "Protocolo de examen",
      reviewExamMistakes: "Revisar errores del examen",
      practiceMistakes: "Practicar errores",
      noMistakes: "Sin errores",
      repeatExam: "Repetir examen",
      topicPractice: "Práctica por temas",
      moreFive: "5 preguntas más",
      newPractice20: "Práctica de 20 preguntas",
      home: "Inicio",
      correct: "correctas",
      mistakes: "errores",
      min: "min",
      toReinforce: "para reforzar",
      weakTopics: "Temas débiles",
      perfectTitle: "Resultado excelente",
      perfectText: "No hubo errores. Podés pasar al siguiente bloque de preguntas.",
      mainWeakTopic: (topic: string) => `Tema débil principal: ${topic}`,
      weakText: "La app propone el siguiente mejor paso, no solo una lista de errores.",
      passResult: "Resultado mínimo",
      topicsWithMistakes: "Temas con errores",
      recommendation: "Recomendación",
      examPassedRecommendation: "Reforzá los temas débiles antes del examen real para llegar con más seguridad.",
      examFailedRecommendation: "Empezá con la revisión de errores del examen y una práctica corta por temas débiles.",
      mistakeReview: "Revisión de errores",
      seeAll: "Ver todo →",
      collapse: "Contraer ↑",
      youChose: "Elegiste:",
      correctAnswer: "Correcto:",
      examPassShort: "aprobaría",
      repeatShort: "repetir",
      excellentShort: "excelente",
      repeatPracticeShort: "repasar",
      examPassDescription: "El nivel ya es aprobatorio, pero los errores muestran temas que conviene reforzar antes del examen real.",
      examFailDescription: "Todavía es pronto para el examen. Empezá por revisar errores y hacer prácticas cortas.",
      practicePerfectDescription: "Todas las respuestas fueron correctas. Podés seguir con otra práctica o pasar al examen.",
      practiceRetryDescription: "Tus errores ya están listos para una práctica corta. Conviene reforzarlos ahora, mientras están frescos.",
      score: (correct: number, total: number) => `${correct} de ${total} correctas`,
      errors: (count: number) => `${count} ${count === 1 ? "error" : "errores"}`,
      minimum: (passQuestions: number, total: number, percent: number) => `Mínimo para aprobar: ${passQuestions} de ${total} (${percent}%)`,
      moreExamMistakes: (count: number) => `Y ${count} más en la revisión del examen`,
    };
  }

  return {
    back: "Назад",
    progress: "Прогресс",
    practiceTitle: "Итог тренировки",
    examTitle: "Экзаменационный протокол",
    reviewExamMistakes: "Разобрать ошибки экзамена",
    practiceMistakes: "Отработать ошибки",
    noMistakes: "Ошибок нет",
    repeatExam: "Повторить экзамен",
    topicPractice: "Тренировка по темам",
    moreFive: "Ещё 5 вопросов",
    newPractice20: "Тренировка 20 вопросов",
    home: "На главную",
    correct: "верно",
    mistakes: "ошибки",
    min: "мин",
    toReinforce: "до закрепления",
    weakTopics: "Слабые темы",
    perfectTitle: "Отличный результат",
    perfectText: "Ошибок нет. Можно переходить к следующему блоку вопросов.",
    mainWeakTopic: (topic: string) => `Главная слабая зона: ${topic}`,
    weakText: "Приложение предлагает следующий лучший шаг, а не просто список ошибок.",
    passResult: "Проходной результат",
    topicsWithMistakes: "Темы с ошибками",
    recommendation: "Рекомендация",
    examPassedRecommendation: "Закрепите слабые темы перед реальным экзаменом, чтобы увереннее сдать с первого раза.",
    examFailedRecommendation: "Начните с разбора ошибок экзамена и короткой тренировки по слабым темам.",
    mistakeReview: "Разбор ошибок",
    seeAll: "Смотреть все →",
    collapse: "Свернуть ↑",
    youChose: "Вы выбрали:",
    correctAnswer: "Правильно:",
    examPassShort: "сдал бы",
    repeatShort: "повторить",
    excellentShort: "отлично",
    repeatPracticeShort: "нужно повторить",
    examPassDescription: "Уровень уже проходной, но ошибки показывают темы, которые стоит закрепить перед реальным экзаменом.",
    examFailDescription: "Пока рано идти на экзамен. Начните с разбора ошибок и коротких тренировок.",
    practicePerfectDescription: "Все ответы верные. Можно переходить к следующей тренировке или экзамену.",
    practiceRetryDescription: "Ошибки уже собраны в короткую тренировку. Лучше сейчас закрепить их, пока свежо.",
    score: (correct: number, total: number) => `${correct} из ${total} верно`,
    errors: (count: number) => `${count} ${pluralize(count, "ошибка", "ошибки", "ошибок")}`,
    minimum: (passQuestions: number, total: number, percent: number) => `Минимум для сдачи: ${passQuestions} из ${total} (${percent}%)`,
    moreExamMistakes: (count: number) => `И ещё ${count} в разборе экзамена`,
  };
}

function pluralize(count: number, one: string, few: string, many: string) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}
