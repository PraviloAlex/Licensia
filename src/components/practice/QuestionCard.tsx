import type { ReactNode } from "react";
import type { VerifiedQuestion } from "../../types/question";

type QuestionCardMode = "exam" | "practice";

type QuestionCardProps = {
  mode: QuestionCardMode;
  question: VerifiedQuestion;
  optionLetters: string[];
  imageBrokenForQId: string | null;
  selectingOptionId: string | null;
  onImageError: (questionId: string) => void;
  onImageOpen: (src: string) => void;
  onOptionClick: (optionId: string) => void;
  resolveImageSrc: (src: string) => string;
  alreadyAnswered?: boolean;
  confirmMode?: boolean;
  examTagLabel?: string;
  pendingOptionId?: string | null;
  selectedOptionId?: string | null;
  showAnswerState?: boolean;
  showRussian?: boolean;
  showSpanish?: boolean;
  children?: ReactNode;
};

export function QuestionCard({
  mode,
  question,
  optionLetters,
  imageBrokenForQId,
  selectingOptionId,
  onImageError,
  onImageOpen,
  onOptionClick,
  resolveImageSrc,
  alreadyAnswered = false,
  confirmMode = false,
  examTagLabel,
  pendingOptionId,
  selectedOptionId,
  showAnswerState = false,
  showRussian = false,
  showSpanish = true,
  children,
}: QuestionCardProps) {
  if (mode === "exam") {
    return (
      <>
        <div className="pv2-badge-row">
          <span className="pv2-badge">{question.topic}</span>
          {examTagLabel && <span className="pv2-exam-tag"><i className="ti ti-clipboard-check" /> {examTagLabel}</span>}
        </div>
        <h2 className="pv2-question-es">{question.question_es}</h2>
        {question.image?.src && imageBrokenForQId !== question.id && (
          <div className="pv2-image-wrap">
            <img src={resolveImageSrc(question.image.src)} alt="Imagen de la pregunta" className="pv2-image"
              onError={() => onImageError(question.id)}
              onClick={() => question.image?.src && onImageOpen(resolveImageSrc(question.image.src))}
            />
          </div>
        )}
        <div className="pv2-options">
          {question.options.map((option, idx) => {
            const isSelecting = selectingOptionId === option.id;
            const cls = ["pv2-option", isSelecting ? "pv2-option--selecting" : "", alreadyAnswered ? "pv2-option--frozen" : ""].filter(Boolean).join(" ");
            return (
              <button key={option.id} type="button" className={cls}
                onClick={() => onOptionClick(option.id)}
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
    );
  }

  return (
    <div className="pv2-q-layout">
      <div className="pv2-q-left">
        <div className="pv2-badge-row"><span className="pv2-badge">{question.topic}</span></div>
        {showSpanish && <h2 className="pv2-question-es">{question.question_es}</h2>}
        {showRussian && <p className="pv2-question-ru">{question.question_ru}</p>}
        {question.image?.src && imageBrokenForQId !== question.id && (
          <div className={showAnswerState ? "pv2-image-wrap pv2-image-wrap--frozen" : "pv2-image-wrap"}>
            <img src={resolveImageSrc(question.image.src)} alt="Imagen de la pregunta" className="pv2-image"
              onError={() => onImageError(question.id)}
              onClick={() => question.image?.src && onImageOpen(resolveImageSrc(question.image.src))}
            />
          </div>
        )}
      </div>
      <div className="pv2-q-right">
        <div className="pv2-options">
          {question.options.map((option, idx) => {
            const isSelected = selectedOptionId === option.id;
            const isRight = showAnswerState && option.id === question.correctOptionId;
            const isWrong = showAnswerState && isSelected && option.id !== question.correctOptionId;
            const frozen = showAnswerState && !isRight && !isWrong;
            const isSelecting = selectingOptionId === option.id;
            const isPending = !showAnswerState && confirmMode && pendingOptionId === option.id;
            const cls = ["pv2-option", isRight ? "pv2-option--correct" : "", isWrong ? "pv2-option--wrong" : "", frozen ? "pv2-option--frozen" : "", isSelecting ? "pv2-option--selecting" : "", isPending ? "pv2-option--pending" : ""].filter(Boolean).join(" ");
            return (
              <button key={option.id} type="button" className={cls}
                onClick={() => onOptionClick(option.id)}
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
        {children}
      </div>
    </div>
  );
}
