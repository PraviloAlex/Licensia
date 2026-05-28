const SEEN_KEY = "licencia_ar_seen_questions";

function readIds(key: string): string[] {
  if (typeof window === "undefined") {
    return [];
  }

  const raw = window.localStorage.getItem(key);
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

export function getSeenQuestionIds(): string[] {
  return readIds(SEEN_KEY);
}

export function markQuestionSeen(questionId: string): void {
  const ids = new Set(getSeenQuestionIds());
  ids.add(questionId);
  window.localStorage.setItem(SEEN_KEY, JSON.stringify(Array.from(ids)));
}
