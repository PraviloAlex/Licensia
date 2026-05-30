import { useState, useCallback } from "react";
import { questionsData } from "../lib/data";

const STORAGE_KEY = "licencia_ar_editor_patches";
const REVIEWED_KEY = "licencia_ar_editor_reviewed";

type Patch = {
  question_ru?: string;
  explanation_ru?: string;
  memoryHint_ru?: string;
  whyCorrect_ru?: string;
  commonMistake_ru?: string;
  keyRule_ru?: string;
  options_ru?: Record<string, string>;
};

function loadPatches(): Record<string, Patch> {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); }
  catch { return {}; }
}
function loadReviewed(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(REVIEWED_KEY) || "[]")); }
  catch { return new Set(); }
}
function savePatches(p: Record<string, Patch>) { localStorage.setItem(STORAGE_KEY, JSON.stringify(p)); }
function saveReviewed(r: Set<string>) { localStorage.setItem(REVIEWED_KEY, JSON.stringify([...r])); }

const FIELDS: { key: keyof Omit<Patch, "options_ru">; label: string; rows: number }[] = [
  { key: "question_ru",      label: "Вопрос RU",        rows: 3 },
  { key: "explanation_ru",   label: "Объяснение",        rows: 4 },
  { key: "whyCorrect_ru",    label: "Почему верно",      rows: 3 },
  { key: "commonMistake_ru", label: "Частая ошибка",     rows: 3 },
  { key: "keyRule_ru",       label: "Ключевое правило",  rows: 2 },
  { key: "memoryHint_ru",    label: "Подсказка памяти",  rows: 2 },
];

const CSV_FIELDS = ["question_ru","explanation_ru","whyCorrect_ru","commonMistake_ru","keyRule_ru","memoryHint_ru"] as const;

function escapeCSV(s: string) {
  return '"' + (s ?? "").replace(/"/g, '""').replace(/\n/g, " ") + '"';
}

function parseCSVRow(line: string): string[] {
  const result: string[] = [];
  let current = "", inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"' && line[i+1] === '"') { current += '"'; i++; }
    else if (c === '"') { inQuotes = !inQuotes; }
    else if (c === ',' && !inQuotes) { result.push(current); current = ""; }
    else { current += c; }
  }
  result.push(current);
  return result;
}

function findCol(headers: string[], name: string): number {
  const i = headers.indexOf(name);
  if (i !== -1) return i;
  return headers.indexOf('"' + name + '"');
}

export function EditorPage() {
  const [idx, setIdx]           = useState(0);
  const [patches, setPatches]   = useState<Record<string, Patch>>(loadPatches);
  const [reviewed, setReviewed] = useState<Set<string>>(loadReviewed);
  const [jumpVal, setJumpVal]   = useState("");
  const [saved, setSaved]       = useState(false);
  const [filter, setFilter]     = useState<"all"|"unreviewed">("unreviewed");

  const questions = filter === "unreviewed"
    ? questionsData.filter(q => !reviewed.has(q.id))
    : questionsData;

  const q = questions[idx] ?? questionsData[0];
  if (!q) return <div style={{padding:32,color:"#fff"}}>Все вопросы проверены!</div>;

  const patch  = patches[q.id] ?? {};
  const val    = (key: keyof Omit<Patch, "options_ru">) => patch[key] ?? (q as Record<string,unknown>)[key] as string ?? "";
  const optVal = (id: string) => patch.options_ru?.[id] ?? q.options.find(o => o.id === id)?.text_ru ?? "";

  const update = useCallback((key: keyof Omit<Patch, "options_ru">, value: string) => {
    setPatches(prev => { const n = { ...prev, [q.id]: { ...prev[q.id], [key]: value } }; savePatches(n); return n; });
  }, [q.id]);

  const updateOpt = useCallback((optId: string, value: string) => {
    setPatches(prev => {
      const n = { ...prev, [q.id]: { ...prev[q.id], options_ru: { ...(prev[q.id]?.options_ru ?? {}), [optId]: value } } };
      savePatches(n); return n;
    });
  }, [q.id]);

  const markReviewed = () => {
    const next = new Set(reviewed); next.add(q.id); setReviewed(next); saveReviewed(next);
    setSaved(true); setTimeout(() => setSaved(false), 1200);
    if (idx < questions.length - 1) setIdx(i => i + 1);
  };

  const exportJSON = () => {
    const merged = questionsData.map(question => {
      const p = patches[question.id]; if (!p) return question;
      const r = { ...question } as Record<string, unknown>;
      if (p.question_ru)      r.question_ru      = p.question_ru;
      if (p.explanation_ru)   r.explanation_ru   = p.explanation_ru;
      if (p.memoryHint_ru)    r.memoryHint_ru    = p.memoryHint_ru;
      if (p.whyCorrect_ru)    r.whyCorrect_ru    = p.whyCorrect_ru;
      if (p.commonMistake_ru) r.commonMistake_ru = p.commonMistake_ru;
      if (p.keyRule_ru)       r.keyRule_ru       = p.keyRule_ru;
      if (p.options_ru) {
        r.options = question.options.map(opt => ({ ...opt, text_ru: p.options_ru?.[opt.id] ?? opt.text_ru }));
      }
      return r;
    });
    const blob = new Blob([JSON.stringify(merged, null, 2)], { type: "application/json" });
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: "questions.verified.json" });
    a.click(); URL.revokeObjectURL(a.href);
  };

  const exportCSV = () => {
    const header = [
      "id", "has_image", "correct_option", "options_es", "question_es",
      ...CSV_FIELDS.flatMap(f => [f + "_OLD", f + "_NEW"])
    ].map(escapeCSV).join(",");

    const rows = questionsData.map(question => {
      const p  = patches[question.id] ?? {};
      const q2 = question as Record<string, unknown>;
      const optionsEs     = question.options.map(o => o.id.toUpperCase() + ": " + o.text_es).join(" | ");
      const correctLetter = (question.options.find(o => o.id === question.correctOptionId)?.id ?? "?").toUpperCase();
      const hasImage      = question.image?.src ? "yes" : "no";
      return [
        question.id, hasImage, correctLetter, optionsEs, question.question_es,
        ...CSV_FIELDS.flatMap(f => [String(p[f as keyof typeof p] ?? q2[f] ?? ""), ""])
      ].map(v => escapeCSV(String(v))).join(",");
    });

    const csv = "﻿" + [header, ...rows].join("\n");
    const a = Object.assign(document.createElement("a"), {
      href: URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" })),
      download: "questions_for_review.csv"
    });
    a.click(); URL.revokeObjectURL(a.href);
  };

  const importCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = (ev.target?.result as string).replace(/^﻿/, "");
      const lines = text.split("\n").filter(l => l.trim());
      if (lines.length < 2) return;
      const headers = parseCSVRow(lines[0]);
      const newPatches = { ...patches }; let applied = 0;
      for (let i = 1; i < lines.length; i++) {
        const cols = parseCSVRow(lines[i]);
        const id = cols[findCol(headers, "id")]?.trim();
        if (!id) continue;
        const patch: Patch = { ...newPatches[id] }; let changed = false;
        for (const field of CSV_FIELDS) {
          const newIdx = findCol(headers, field + "_NEW");
          if (newIdx === -1) continue;
          const newVal = cols[newIdx]?.trim();
          if (newVal) { (patch as Record<string,unknown>)[field] = newVal; changed = true; }
        }
        if (changed) { newPatches[id] = patch; applied++; }
      }
      setPatches(newPatches); savePatches(newPatches);
      alert("Импортировано правок: " + applied + " вопросов");
    };
    reader.readAsText(file, "utf-8"); e.target.value = "";
  };

  const patchedCount  = Object.keys(patches).length;
  const reviewedCount = reviewed.size;
  const progress      = Math.round((reviewedCount / questionsData.length) * 100);

  return (
    <div className="editor-page">
      <div className="editor-header">
        <div className="editor-header-left">
          <span className="editor-title">Редактор вопросов</span>
          <span className="editor-stats">{reviewedCount}/{questionsData.length} проверено ({progress}%) · {patchedCount} правок</span>
        </div>
        <div className="editor-header-right">
          <select className="editor-filter" value={filter} onChange={e => { setFilter(e.target.value as "all"|"unreviewed"); setIdx(0); }}>
            <option value="unreviewed">Непроверенные ({questionsData.length - reviewedCount})</option>
            <option value="all">Все ({questionsData.length})</option>
          </select>
          <button className="editor-btn editor-btn--csv" onClick={exportCSV}>Экспорт CSV</button>
          <label className="editor-btn editor-btn--import" style={{cursor:"pointer"}}>
            Импорт CSV
            <input type="file" accept=".csv" onChange={importCSV} style={{display:"none"}} />
          </label>
          <button className="editor-btn editor-btn--export" onClick={exportJSON}>Экспорт JSON</button>
        </div>
      </div>

      <div className="editor-progress-bar">
        <div className="editor-progress-fill" style={{ width: progress + "%" }} />
      </div>

      <div className="editor-nav">
        <button className="editor-btn" onClick={() => setIdx(i => Math.max(0, i-1))} disabled={idx === 0}>Назад</button>
        <div className="editor-nav-center">
          <span className="editor-qnum">{idx + 1} / {questions.length}</span>
          <span className="editor-qid">{q.id}</span>
        </div>
        <input className="editor-jump" type="number" placeholder="N" value={jumpVal}
          onChange={e => setJumpVal(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") { const n = parseInt(jumpVal)-1; if (n >= 0 && n < questions.length) { setIdx(n); setJumpVal(""); } } }}
        />
        <button className="editor-btn" onClick={() => setIdx(i => Math.min(questions.length-1, i+1))} disabled={idx >= questions.length-1}>Вперёд</button>
      </div>

      <div className="editor-body">
        <div className="editor-col editor-col--es">
          <div className="editor-col-label">Испанский оригинал</div>
          {q.image && <img src={q.image.src} alt="" className="editor-image" />}
          <div className="editor-field-group">
            <div className="editor-field-label">Вопрос ES</div>
            <div className="editor-readonly">{q.question_es}</div>
          </div>
          <div className="editor-field-label">Варианты ES</div>
          {q.options.map(opt => (
            <div key={opt.id} className={"editor-option-row" + (opt.id === q.correctOptionId ? " editor-option-row--correct" : "")}>
              <span className="editor-option-letter">{opt.id.toUpperCase()}</span>
              <span className="editor-readonly">{opt.text_es}</span>
            </div>
          ))}
        </div>

        <div className="editor-col editor-col--ru">
          <div className="editor-col-label">Русский — редактирование</div>
          {FIELDS.map(({ key, label, rows }) => (
            <div key={key} className="editor-field-group">
              <div className="editor-field-label">{label}</div>
              <textarea className="editor-textarea" rows={rows} value={val(key)}
                onChange={e => update(key, e.target.value)} placeholder={"— " + label + " —"} />
            </div>
          ))}
          <div className="editor-field-label">Варианты RU</div>
          {q.options.map(opt => (
            <div key={opt.id} className={"editor-option-row" + (opt.id === q.correctOptionId ? " editor-option-row--correct" : "")}>
              <span className="editor-option-letter">{opt.id.toUpperCase()}</span>
              <textarea className="editor-textarea editor-textarea--opt" rows={2}
                value={optVal(opt.id)} onChange={e => updateOpt(opt.id, e.target.value)} />
            </div>
          ))}
          <button className={"editor-btn editor-btn--done" + (saved ? " editor-btn--saved" : "")} onClick={markReviewed}>
            {saved ? "Сохранено!" : "Проверено — следующий"}
          </button>
        </div>
      </div>
    </div>
  );
}
