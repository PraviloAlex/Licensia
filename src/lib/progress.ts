import { readStringArray, writeJson } from "./storage";

const SEEN_KEY = "licencia_ar_seen_questions";

export function getSeenQuestionIds(): string[] {
  return readStringArray(SEEN_KEY);
}

export function markQuestionSeen(questionId: string): void {
  const ids = new Set(getSeenQuestionIds());
  ids.add(questionId);
  writeJson(SEEN_KEY, Array.from(ids));
}
