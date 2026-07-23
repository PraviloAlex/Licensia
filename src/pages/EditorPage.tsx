import { useCallback, useMemo, useState } from "react";
import { questionsData } from "../lib/data";
import type { VerifiedQuestion } from "../types/question";

const PATCHES_KEY = "licencia_ar_editor_patches";
const REVIEW_KEY = "licencia_ar_editor_review_status";
const CANDIDATES_KEY = "licencia_ar_editor_candidates";

type EditableField =
  | "question_ru"
  | "explanation_ru"
  | "whyCorrect_ru"
  | "commonMistake_ru"
  | "keyRule_ru"
  | "memoryHint_ru";

type Patch = Partial<Record<EditableField, string>>;
type Candidate = {
  new: Patch;
  old: Patch;
};
type ReviewStatus = "unreviewed" | "accepted" | "keep_old" | "needs_check";
type ReviewMap = Record<string, ReviewStatus>;

const FIELDS: { key: EditableField; label: string; rows: number; safeToImport: boolean }[] = [
  { key: "question_ru", label: "Вопрос RU", rows: 3, safeToImport: false },
  { key: "explanation_ru", label: "Объяснение", rows: 4, safeToImport: true },
  { key: "whyCorrect_ru", label: "Почему верно", rows: 3, safeToImport: true },
  { key: "commonMistake_ru", label: "Частая ошибка", rows: 3, safeToImport: true },
  { key: "keyRule_ru", label: "Ключевое правило", rows: 2, safeToImport: true },
  { key: "memoryHint_ru", label: "Подсказка памяти", rows: 2, safeToImport: true },
];

const CSV_FIELDS = FIELDS.map((field) => field.key);

const MANUAL_REVIEW_IDS = new Set([
  3, 12, 27, 47, 60, 71, 72, 78, 79, 107, 126, 131, 146, 156,
  181, 183, 184, 191, 192, 197, 198, 199, 200, 206, 208, 217,
  230, 243, 246, 247, 248, 253, 255, 286, 295, 297, 307, 308,
  315, 321, 328, 371, 380, 381, 392, 395, 413, 414, 428, 430, 458,
].map((num) => `category-b-${String(num).padStart(4, "0")}`));

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch {
    return fallback;
  }
}

function saveJson(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value));
}

function escapeCSV(value: string) {
  return `"${(value ?? "").replace(/"/g, '""').replace(/\r?\n/g, " ")}"`;
}

function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  const clean = text.replace(/^\uFEFF/, "");

  for (let i = 0; i < clean.length; i += 1) {
    const char = clean[i];
    const next = clean[i + 1];

    if (char === '"' && next === '"') {
      cell += '"';
      i += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(cell);
      if (row.some((value) => value.trim() !== "")) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  row.push(cell);
  if (row.some((value) => value.trim() !== "")) rows.push(row);
  return rows;
}

function getField(question: unknown, field: EditableField): string {
  const value = (question as Record<string, unknown>)[field];
  return typeof value === "string" ? value : "";
}

/* Options are enumerated as A/B/C in the data but as А/Б/В in the Russian text,
   and Cyrillic А/В/С also look identical to Latin A/B/C. Map every form. */
const LETTER_MAP: Record<string, string> = {
  "А": "A", "Б": "B", "В": "C",
  "A": "A", "B": "B", "C": "C",
};

function normalizeLetter(letter: string) {
  const upper = letter.toUpperCase();
  return LETTER_MAP[upper] ?? upper;
}

/* "вариант" is declined (варианта/варианте/варианты), and the text also says
   "ответ B" / "пункт C" — match the stem, not one fixed form. */
function mentionedVariants(text: string) {
  const matches = text.matchAll(/(?:вариант\w*|ответ\w*|пункт\w*)\s+[«"]?([ABCabcАБВабв])(?![\wА-Яа-я])/gi);
  return [...new Set([...matches].map((match) => normalizeLetter(match[1])))];
}

/* True when the correct option is itself "both A and B" — then an explanation
   that talks about A and B is right, and flagging it would be a false alarm. */
function correctOptionMeansBoth(question: VerifiedQuestion) {
  const correct = question.options.find((option) => option.id === question.correctOptionId);
  if (!correct) return false;
  return /оба|обе|ambas|ambos|todas/i.test(`${correct.text_ru} ${correct.text_es}`);
}

/* How many questions share each explanation text. A text used by more than one
   question is a template, not an explanation — that is the bulk of the backlog. */
const TEMPLATE_FIELDS = [
  { key: "keyRule_ru", label: "правило" },
  { key: "commonMistake_ru", label: "типичная ошибка" },
  { key: "memoryHint_ru", label: "мнемоника" },
  { key: "explanation_ru", label: "объяснение" },
] as const;

const duplicateCounts: Record<string, Map<string, number>> = (() => {
  const acc: Record<string, Map<string, number>> = {};
  for (const field of TEMPLATE_FIELDS) {
    const counter = new Map<string, number>();
    for (const question of questionsData) {
      const text = String((question as unknown as Record<string, unknown>)[field.key] ?? "").trim();
      if (text) counter.set(text, (counter.get(text) ?? 0) + 1);
    }
    acc[field.key] = counter;
  }
  return acc;
})();

/** Problems visible in the shipped text of this question (no candidate needed). */
function liveFlags(question: VerifiedQuestion): string[] {
  const flags: string[] = [];
  const correct = (question.correctOptionId ?? "").toUpperCase();

  for (const field of TEMPLATE_FIELDS) {
    const text = String((question as unknown as Record<string, unknown>)[field.key] ?? "").trim();
    if (!text) {
      flags.push(`Пусто: ${field.label}`);
      continue;
    }
    const shared = duplicateCounts[field.key].get(text) ?? 1;
    if (shared > 1) flags.push(`Шаблон: ${field.label} повторяется в ${shared} вопросах`);
  }

  const bothIsCorrect = correctOptionMeansBoth(question);
  for (const key of ["explanation_ru", "whyCorrect_ru"] as const) {
    const text = String((question as unknown as Record<string, unknown>)[key] ?? "");
    const mentioned = mentionedVariants(text);
    if (mentioned.length === 0 || !correct || mentioned.includes(correct)) continue;
    // "Оба ответа А и Б верны": discussing A and B is the correct explanation.
    if (bothIsCorrect && mentioned.every((letter) => letter === "A" || letter === "B")) continue;
    flags.push(`Опасно: ${key === "explanation_ru" ? "объяснение" : "почему верно"} упоминает ${mentioned.join(", ")}, но ключ ${correct}`);
  }

  return flags;
}

function riskFlags(
  id: string,
  correctOptionId: string,
  hasImage: boolean,
  candidate?: Candidate,
) {
  const flags: string[] = [];
  const candidateText = candidate ? Object.values(candidate.new).join(" ") : "";
  const variants = mentionedVariants(candidateText);
  const correct = correctOptionId.toUpperCase();
  const wrongVariants = variants.filter((variant) => variant !== correct);

  if (wrongVariants.length > 0) {
    flags.push(`Опасно: текст упоминает вариант ${wrongVariants.join(", ")}, но ключ ${correct}`);
  }
  if (MANUAL_REVIEW_IDS.has(id)) {
    flags.push("В списке ручной проверки");
  }
  if (hasImage && candidate) {
    flags.push("Есть картинка: сверить глазами перед принятием");
  }
  if (candidateText.includes("ПРОВЕРИТЬ") || candidateText.includes("⚠")) {
    flags.push("AI сам пометил как проверить");
  }

  return flags;
}

function criticalRiskFlags(id: string, correctOptionId: string, candidate?: Candidate) {
  const candidateText = candidate ? Object.values(candidate.new).join(" ") : "";
  const variants = mentionedVariants(candidateText);
  const correct = correctOptionId.toUpperCase();
  const wrongVariants = variants.filter((variant) => variant !== correct);
  const flags: string[] = [];

  if (wrongVariants.length > 0) {
    flags.push(`Опасно: текст упоминает вариант ${wrongVariants.join(", ")}, но ключ ${correct}`);
  }
  if (MANUAL_REVIEW_IDS.has(id)) {
    flags.push("В списке ручной проверки");
  }
  if (candidateText.includes("ПРОВЕРИТЬ") || candidateText.includes("⚠")) {
    flags.push("AI сам пометил как проверить");
  }

  return flags;
}

function candidateHasData(candidate?: Candidate) {
  return Boolean(candidate && Object.values(candidate.new).some((value) => value.trim() !== ""));
}

export function EditorPage() {
  const [idx, setIdx] = useState(0);
  const [patches, setPatches] = useState<Record<string, Patch>>(() => loadJson(PATCHES_KEY, {}));
  const [candidates, setCandidates] = useState<Record<string, Candidate>>(() => loadJson(CANDIDATES_KEY, {}));
  const [reviewStatus, setReviewStatus] = useState<ReviewMap>(() => loadJson(REVIEW_KEY, {}));
  const [filter, setFilter] = useState<"risk" | "manual" | "unreviewed" | "accepted" | "needs_check" | "all">("risk");
  const [jumpVal, setJumpVal] = useState("");
  const [notice, setNotice] = useState("");

  const stats = useMemo(() => {
    const accepted = Object.values(reviewStatus).filter((status) => status === "accepted").length;
    const needsCheck = Object.values(reviewStatus).filter((status) => status === "needs_check").length;
    const keepOld = Object.values(reviewStatus).filter((status) => status === "keep_old").length;
    const withCandidates = Object.values(candidates).filter(candidateHasData).length;
    const risk = questionsData.filter((question) => {
      const flags = [
        ...liveFlags(question),
        ...criticalRiskFlags(question.id, question.correctOptionId, candidates[question.id]),
      ];
      return flags.length > 0;
    }).length;
    return { accepted, needsCheck, keepOld, withCandidates, risk };
  }, [candidates, reviewStatus]);

  const filteredQuestions = useMemo(() => {
    return questionsData.filter((question) => {
      const status = reviewStatus[question.id] ?? "unreviewed";
      const candidate = candidates[question.id];
      const flags = [...liveFlags(question), ...criticalRiskFlags(question.id, question.correctOptionId, candidate)];

      if (filter === "risk") return flags.length > 0 && status !== "accepted" && status !== "keep_old";
      if (filter === "manual") return MANUAL_REVIEW_IDS.has(question.id);
      if (filter === "unreviewed") return status === "unreviewed";
      if (filter === "accepted") return status === "accepted";
      if (filter === "needs_check") return status === "needs_check";
      return true;
    });
  }, [candidates, filter, reviewStatus]);

  const questions = filteredQuestions.length > 0 ? filteredQuestions : questionsData;
  const q = questions[Math.min(idx, questions.length - 1)] ?? questionsData[0];
  const candidate = candidates[q.id];
  const patch = patches[q.id] ?? {};
  const status = reviewStatus[q.id] ?? "unreviewed";
  const flags = [...liveFlags(q), ...riskFlags(q.id, q.correctOptionId, Boolean(q.image?.src), candidate)];

  const showNotice = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 1800);
  };

  const setStatus = (id: string, nextStatus: ReviewStatus) => {
    setReviewStatus((prev) => {
      const next = { ...prev, [id]: nextStatus };
      saveJson(REVIEW_KEY, next);
      return next;
    });
  };

  const goNext = () => {
    setIdx((current) => Math.min(questions.length - 1, current + 1));
  };

  const updatePatch = useCallback((field: EditableField, value: string) => {
    setPatches((prev) => {
      const next = { ...prev, [q.id]: { ...prev[q.id], [field]: value } };
      saveJson(PATCHES_KEY, next);
      return next;
    });
    setStatus(q.id, "needs_check");
  }, [q.id]);

  const acceptCandidate = () => {
    if (!candidateHasData(candidate)) {
      showNotice("Для этого вопроса нет NEW-кандидата");
      return;
    }

    const nextPatch: Patch = {};
    for (const field of FIELDS) {
      const value = candidate?.new[field.key]?.trim();
      if (value && field.safeToImport) nextPatch[field.key] = value;
      if (value && field.key === "question_ru") {
        nextPatch.question_ru = value;
      }
    }

    setPatches((prev) => {
      const next = { ...prev, [q.id]: nextPatch };
      saveJson(PATCHES_KEY, next);
      return next;
    });
    setStatus(q.id, "accepted");
    showNotice("NEW принят");
    goNext();
  };

  const keepOld = () => {
    setPatches((prev) => {
      const next = { ...prev };
      delete next[q.id];
      saveJson(PATCHES_KEY, next);
      return next;
    });
    setStatus(q.id, "keep_old");
    showNotice("Оставлен OLD");
    goNext();
  };

  const markNeedsCheck = () => {
    setStatus(q.id, "needs_check");
    showNotice("Помечено на проверку");
    goNext();
  };

  const exportJSON = () => {
    const merged = questionsData.map((question) => {
      if (reviewStatus[question.id] !== "accepted") return question;
      const patchForQuestion = patches[question.id];
      if (!patchForQuestion) return question;

      return {
        ...question,
        ...Object.fromEntries(
          Object.entries(patchForQuestion).filter(([, value]) => typeof value === "string" && value.trim() !== ""),
        ),
      };
    });

    const blob = new Blob([JSON.stringify(merged, null, 2)], { type: "application/json" });
    const link = Object.assign(document.createElement("a"), {
      href: URL.createObjectURL(blob),
      download: "questions.verified.reviewed.json",
    });
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const exportPatches = () => {
    const acceptedPatches = Object.fromEntries(
      Object.entries(patches).filter(([id]) => reviewStatus[id] === "accepted"),
    );
    const blob = new Blob([JSON.stringify({ patches: acceptedPatches, reviewStatus }, null, 2)], {
      type: "application/json",
    });
    const link = Object.assign(document.createElement("a"), {
      href: URL.createObjectURL(blob),
      download: "licencia-ar-editor-patches.json",
    });
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const exportCSV = () => {
    const header = [
      "id", "has_image", "correct_option", "options_es", "question_es",
      ...CSV_FIELDS.flatMap((field) => [`${field}_OLD`, `${field}_NEW`]),
    ].map(escapeCSV).join(",");

    const rows = questionsData.map((question) => {
      const candidateForQuestion = candidates[question.id];
      const optionsEs = question.options.map((option) => `${option.id.toUpperCase()}: ${option.text_es}`).join(" | ");
      const hasImage = question.image?.src ? "yes" : "no";
      return [
        question.id,
        hasImage,
        question.correctOptionId.toUpperCase(),
        optionsEs,
        question.question_es,
        ...CSV_FIELDS.flatMap((field) => [
          getField(question, field),
          candidateForQuestion?.new[field] ?? "",
        ]),
      ].map((value) => escapeCSV(String(value))).join(",");
    });

    const blob = new Blob(["\uFEFF" + [header, ...rows].join("\n")], { type: "text/csv;charset=utf-8" });
    const link = Object.assign(document.createElement("a"), {
      href: URL.createObjectURL(blob),
      download: "questions_for_review.csv",
    });
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const importCSV = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (readerEvent) => {
      const table = parseCSV(String(readerEvent.target?.result ?? ""));
      if (table.length < 2) return;

      const headers = table[0].map((header) => header.trim());
      const idIndex = headers.indexOf("id");
      if (idIndex === -1) {
        alert("В CSV нет колонки id");
        return;
      }

      const nextCandidates = { ...candidates };
      let imported = 0;

      for (const row of table.slice(1)) {
        const id = row[idIndex]?.trim();
        if (!id) continue;

        const newValues: Patch = {};
        const oldValues: Patch = {};
        for (const field of CSV_FIELDS) {
          const newIndex = headers.indexOf(`${field}_NEW`);
          const oldIndex = headers.indexOf(`${field}_OLD`);
          const newValue = newIndex >= 0 ? row[newIndex]?.trim() : "";
          const oldValue = oldIndex >= 0 ? row[oldIndex]?.trim() : "";
          if (newValue) newValues[field] = newValue;
          if (oldValue) oldValues[field] = oldValue;
        }

        if (Object.keys(newValues).length > 0) {
          nextCandidates[id] = { new: newValues, old: oldValues };
          imported += 1;
        }
      }

      setCandidates(nextCandidates);
      saveJson(CANDIDATES_KEY, nextCandidates);
      showNotice(`Импортировано NEW-кандидатов: ${imported}`);
    };
    reader.readAsText(file, "utf-8");
    event.target.value = "";
  };

  const finalValue = (field: EditableField) => patch[field] ?? candidate?.new[field] ?? getField(q, field);
  const oldValue = (field: EditableField) => candidate?.old[field] ?? getField(q, field);
  const candidateValue = (field: EditableField) => candidate?.new[field] ?? "";

  return (
    <div className="editor-page">
      <div className="editor-header">
        <div className="editor-header-left">
          <span className="editor-title">Редактор объяснений</span>
          <span className="editor-stats">
            NEW: {stats.withCandidates} · риск: {stats.risk} · принято: {stats.accepted} · проверить: {stats.needsCheck} · OLD: {stats.keepOld}
          </span>
        </div>
        <div className="editor-header-right">
          <select
            className="editor-filter"
            value={filter}
            onChange={(event) => { setFilter(event.target.value as typeof filter); setIdx(0); }}
          >
            <option value="risk">Опасные/проверить</option>
            <option value="manual">Ручной список</option>
            <option value="unreviewed">Непроверенные</option>
            <option value="needs_check">Помечены проверить</option>
            <option value="accepted">Принятые</option>
            <option value="all">Все</option>
          </select>
          <button className="editor-btn editor-btn--csv" onClick={exportCSV}>Экспорт CSV</button>
          <label className="editor-btn editor-btn--import">
            Импорт CSV
            <input type="file" accept=".csv" onChange={importCSV} />
          </label>
          <button className="editor-btn editor-btn--csv" onClick={exportPatches}>Экспорт правок</button>
          <button className="editor-btn editor-btn--export" onClick={exportJSON}>Экспорт JSON</button>
        </div>
      </div>

      <div className="editor-progress-bar">
        <div className="editor-progress-fill" style={{ width: `${Math.round((stats.accepted / questionsData.length) * 100)}%` }} />
      </div>

      {notice && <div className="editor-notice">{notice}</div>}

      <div className="editor-nav">
        <button className="editor-btn" onClick={() => setIdx((current) => Math.max(0, current - 1))} disabled={idx === 0}>Назад</button>
        <div className="editor-nav-center">
          <span className="editor-qnum">{idx + 1} / {questions.length}</span>
          <span className="editor-qid">{q.id}</span>
          <span className={`editor-status editor-status--${status}`}>{status}</span>
        </div>
        <input
          className="editor-jump"
          type="number"
          placeholder="N"
          value={jumpVal}
          onChange={(event) => setJumpVal(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              const next = Number.parseInt(jumpVal, 10) - 1;
              if (next >= 0 && next < questions.length) setIdx(next);
              setJumpVal("");
            }
          }}
        />
        <button className="editor-btn" onClick={goNext} disabled={idx >= questions.length - 1}>Вперёд</button>
      </div>

      {flags.length > 0 && (
        <div className="editor-risk-panel">
          {flags.map((flag) => <span key={flag} className="editor-risk-chip">{flag}</span>)}
        </div>
      )}

      <div className="editor-body editor-body--review">
        <div className="editor-col editor-col--es">
          <div className="editor-col-label">Оригинал, не редактировать</div>
          {q.image && <img src={q.image.src} alt="" className="editor-image" />}
          <div className="editor-field-group">
            <div className="editor-field-label">Вопрос ES</div>
            <div className="editor-readonly">{q.question_es}</div>
          </div>
          <div className="editor-field-label">Варианты ES · ключ {q.correctOptionId.toUpperCase()}</div>
          {q.options.map((option) => (
            <div key={option.id} className={`editor-option-row${option.id === q.correctOptionId ? " editor-option-row--correct" : ""}`}>
              <span className="editor-option-letter">{option.id.toUpperCase()}</span>
              <span className="editor-readonly">{option.text_es}</span>
            </div>
          ))}
        </div>

        <div className="editor-col editor-col--ru">
          <div className="editor-col-label">OLD / NEW / финальный текст</div>
          {FIELDS.map(({ key, label, rows }) => (
            <div key={key} className="editor-review-field">
              <div className="editor-field-label">{label}</div>
              <div className="editor-compare-grid">
                <div>
                  <div className="editor-mini-label">OLD</div>
                  <div className="editor-readonly editor-readonly--compact">{oldValue(key) || "—"}</div>
                </div>
                <div>
                  <div className="editor-mini-label">NEW из CSV</div>
                  <div className={`editor-readonly editor-readonly--compact${candidateValue(key) ? " editor-readonly--new" : ""}`}>
                    {candidateValue(key) || "—"}
                  </div>
                </div>
              </div>
              <div className="editor-mini-label">Финальный текст для принятия</div>
              <textarea
                className="editor-textarea"
                rows={rows}
                value={finalValue(key)}
                onChange={(event) => updatePatch(key, event.target.value)}
              />
            </div>
          ))}

          <div className="editor-actions">
            <button className="editor-btn editor-btn--done" onClick={acceptCandidate}>Принять NEW</button>
            <button className="editor-btn" onClick={keepOld}>Оставить OLD</button>
            <button className="editor-btn editor-btn--import" onClick={markNeedsCheck}>Проверить позже</button>
          </div>
        </div>
      </div>
    </div>
  );
}
