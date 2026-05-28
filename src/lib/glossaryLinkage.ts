import { glossaryData } from "./data";
import type { VerifiedQuestion } from "../types/question";

function normalizeText(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9ñ\s]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const glossaryMatcher = glossaryData.map((entry) => ({
  id: entry.id,
  term: normalizeText(entry.term_es),
}));

export function extractGlossaryIdsFromQuestion(question: VerifiedQuestion): string[] {
  const haystack = normalizeText([
    question.question_es,
    ...question.options.map((o) => o.text_es),
  ].join(" "));

  const matched = glossaryMatcher
    .filter((g) => g.term.length > 0 && haystack.includes(g.term))
    .map((g) => g.id);

  return Array.from(new Set(matched));
}

export function resolveQuestionGlossaryIds(question: VerifiedQuestion): string[] {
  const fromQuestion = Array.isArray(question.glossaryIds) ? question.glossaryIds : [];
  const extracted = extractGlossaryIdsFromQuestion(question);
  return Array.from(new Set([...fromQuestion, ...extracted]));
}
