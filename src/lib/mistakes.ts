import { readStringArray, writeJson } from "./storage";

const STORAGE_KEY = "licencia_ar_mistakes";

export function getMistakeIds(): string[] {
  return readStringArray(STORAGE_KEY);
}

export function getLatestMistakeId(): string | null {
  const ids = getMistakeIds();
  return ids.length > 0 ? ids[ids.length - 1] : null;
}

export function saveMistake(questionId: string): void {
  const ids = getMistakeIds();
  if (ids.includes(questionId)) {
    return;
  }

  writeJson(STORAGE_KEY, [...ids, questionId]);
}
