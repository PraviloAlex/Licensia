const STORAGE_KEY = "licencia_ar_mistakes";

export function getMistakeIds(): string[] {
  if (typeof window === "undefined") {
    return [];
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === "string") : [];
  } catch {
    return [];
  }
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

  ids.push(questionId);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
}
