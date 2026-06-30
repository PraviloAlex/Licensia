import { Link } from "react-router-dom";
import { EXAM_PASS_PERCENT } from "../../constants/exam";
import { t, type UILang } from "../../lib/i18n";
import type { ExamHistoryData } from "../../hooks/useExamSession";

type ExamStartProps = {
  uiLang: UILang;
  examTotal: number;
  examHistory: ExamHistoryData;
  onStartExam: () => void;
  onPractice: () => void;
};

export function ExamStart({
  uiLang,
  examTotal,
  examHistory,
  onStartExam,
  onPractice,
}: ExamStartProps) {
  return (
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
      <button type="button" className="pv2-exam-start-btn" onClick={onStartExam}>
        {t("pv2.exam.startBtn", uiLang)}
      </button>
      <button type="button" className="pv2-exam-start-practice" onClick={onPractice}>
        {t("pv2.exam.toPractice", uiLang)}
      </button>
    </div>
  );
}
