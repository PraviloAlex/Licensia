const WORD_STATUS_KEY = "licencia_ar_word_status";
const KNOWN_SESSIONS_KEY = "licencia_ar_known_sessions";
const SESSION_ID_KEY = "licencia_ar_session_id";
const REVIEW_SRS_KEY = "licencia_ar_review_srs";
const REVIEW_LEGACY_KEY = "licencia_ar_review_words";
const DATA_VERSION_KEY = "licencia_ar_data_version";
const CURRENT_DATA_VERSION = 2;

// Simple click counter (replaces session-based mastering)
const KNOWN_CLICKS_KEY = "licencia_ar_known_clicks";
// Tracks when each word was added to review (for NEW badge)
const REVIEW_ADDED_AT_KEY = "licencia_ar_review_added_at";
// Tracks word reviews done today (for daily mission counter)
const REVIEWED_TODAY_KEY = "licencia_ar_reviewed_today";
// Tracks last time each word's click was counted (for 24h cooldown)
const KNOWN_LAST_COUNTED_KEY = "licencia_ar_known_last_counted";

const MASTERED_THRESHOLD = 4; // clicks of "Знаю" to master a word
const KNOWN_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24h between counted clicks

const SRS_DAYS = [1, 3, 7, 14] as const;

export type WordStatus = "known" | "repeat";
export type WordStatusMap = Record<string, WordStatus>;
export type KnownSessionsMap = Record<string, string[]>;

type ReviewSrsState = {
  intervalIndex: number;
  dueAt: number;
  lastReviewedAt: number | null;
};

type ReviewSrsMap = Record<string, ReviewSrsState>;

function nowMs(): number {
  return Date.now();
}

function daysToMs(days: number): number {
  return days * 24 * 60 * 60 * 1000;
}

function ensureVocabularyStorageVersion(): void {
  if (typeof window === "undefined") return;

  const raw = window.localStorage.getItem(DATA_VERSION_KEY);
  const current = raw ? Number(raw) : null;
  if (current === CURRENT_DATA_VERSION) return;

  window.localStorage.removeItem(REVIEW_SRS_KEY);
  window.localStorage.removeItem(WORD_STATUS_KEY);
  window.localStorage.removeItem(KNOWN_SESSIONS_KEY);
  window.localStorage.removeItem(REVIEW_LEGACY_KEY);
  window.localStorage.setItem(DATA_VERSION_KEY, String(CURRENT_DATA_VERSION));
}

export function resetVocabularyState(): void {
  if (typeof window === "undefined") return;

  window.localStorage.removeItem(REVIEW_SRS_KEY);
  window.localStorage.removeItem(WORD_STATUS_KEY);
  window.localStorage.removeItem(KNOWN_SESSIONS_KEY);
  window.localStorage.removeItem(REVIEW_LEGACY_KEY);
  window.localStorage.setItem(DATA_VERSION_KEY, String(CURRENT_DATA_VERSION));
}

function getSessionId(): string {
  if (typeof window === "undefined") return "server";

  const existing = window.sessionStorage.getItem(SESSION_ID_KEY);
  if (existing) return existing;

  const next = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  window.sessionStorage.setItem(SESSION_ID_KEY, next);
  return next;
}

// ─── Known clicks (replaces session-based mastering) ─────────

export function getKnownClicksMap(): Record<string, number> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(KNOWN_CLICKS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const result: Record<string, number> = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof v === "number") result[k] = v;
    }
    return result;
  } catch { return {}; }
}

function setKnownClicksMap(map: Record<string, number>): void {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(KNOWN_CLICKS_KEY, JSON.stringify(map));
  }
}

export function getKnownClickCount(wordId: string): number {
  return getKnownClicksMap()[wordId] ?? 0;
}

// ─── 24h cooldown between counted clicks ─────────────────────

function getKnownLastCountedMap(): Record<string, number> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(KNOWN_LAST_COUNTED_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const result: Record<string, number> = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof v === "number") result[k] = v;
    }
    return result;
  } catch { return {}; }
}

function setKnownLastCountedMap(map: Record<string, number>): void {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(KNOWN_LAST_COUNTED_KEY, JSON.stringify(map));
  }
}

/** Returns true if the word can be counted as "known" (calendar day cooldown: one click per calendar day) */
export function canCountKnownClick(wordId: string): boolean {
  const lastCounted = getKnownLastCountedMap()[wordId];
  if (!lastCounted) return true;
  return new Date(lastCounted).toISOString().slice(0, 10) !== todayStr();
}

/** Returns ms remaining until next counted click is allowed (0 if ready) */
export function knownClickCooldownMs(wordId: string): number {
  const lastCounted = getKnownLastCountedMap()[wordId];
  if (!lastCounted) return 0;
  return Math.max(0, KNOWN_COOLDOWN_MS - (nowMs() - lastCounted));
}

// ─── Review added-at timestamps (for NEW badge) ───────────────

function getReviewAddedAtMap(): Record<string, number> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(REVIEW_ADDED_AT_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const result: Record<string, number> = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof v === "number") result[k] = v;
    }
    return result;
  } catch { return {}; }
}

/** Returns true if word was added to review within the last 24 hours */
export function isWordNew(wordId: string): boolean {
  const addedAt = getReviewAddedAtMap()[wordId];
  if (!addedAt) return false;
  return nowMs() - addedAt < 24 * 60 * 60 * 1000;
}

// ─── Reviewed today counter (for daily mission) ───────────────

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

type ReviewedTodayData = { date: string; count: number };

function getReviewedTodayData(): ReviewedTodayData {
  if (typeof window === "undefined") return { date: todayStr(), count: 0 };
  try {
    const raw = window.localStorage.getItem(REVIEWED_TODAY_KEY);
    if (!raw) return { date: todayStr(), count: 0 };
    const parsed = JSON.parse(raw) as ReviewedTodayData;
    if (parsed.date !== todayStr()) return { date: todayStr(), count: 0 };
    return parsed;
  } catch { return { date: todayStr(), count: 0 }; }
}

function incrementReviewedToday(): void {
  const data = getReviewedTodayData();
  const next: ReviewedTodayData = { date: todayStr(), count: data.count + 1 };
  if (typeof window !== "undefined") {
    window.localStorage.setItem(REVIEWED_TODAY_KEY, JSON.stringify(next));
  }
}

/** How many words were reviewed (Знаю or Повторить) today */
export function getReviewedTodayCount(): number {
  return getReviewedTodayData().count;
}

export function getWordStatusMap(): WordStatusMap {
  ensureVocabularyStorageVersion();
  if (typeof window === "undefined") return {};
  const raw = window.localStorage.getItem(WORD_STATUS_KEY);
  if (!raw) return {};

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const result: WordStatusMap = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (value === "known" || value === "repeat") result[key] = value;
    }
    return result;
  } catch {
    return {};
  }
}

function setWordStatusMap(map: WordStatusMap): WordStatusMap {
  ensureVocabularyStorageVersion();
  if (typeof window !== "undefined") {
    window.localStorage.setItem(WORD_STATUS_KEY, JSON.stringify(map));
  }
  return map;
}

function getReviewSrsMap(): ReviewSrsMap {
  ensureVocabularyStorageVersion();
  if (typeof window === "undefined") return {};
  const raw = window.localStorage.getItem(REVIEW_SRS_KEY);
  if (!raw) return {};

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const result: ReviewSrsMap = {};

    for (const [wordId, value] of Object.entries(parsed)) {
      if (!value || typeof value !== "object") continue;
      const v = value as Record<string, unknown>;
      const intervalIndex = typeof v.intervalIndex === "number" ? v.intervalIndex : 0;
      const dueAt = typeof v.dueAt === "number" ? v.dueAt : nowMs();
      const lastReviewedAt = typeof v.lastReviewedAt === "number" ? v.lastReviewedAt : null;
      result[wordId] = {
        intervalIndex: Math.max(0, Math.min(intervalIndex, SRS_DAYS.length - 1)),
        dueAt,
        lastReviewedAt,
      };
    }

    return result;
  } catch {
    return {};
  }
}

function setReviewSrsMap(map: ReviewSrsMap): ReviewSrsMap {
  ensureVocabularyStorageVersion();
  if (typeof window !== "undefined") {
    window.localStorage.setItem(REVIEW_SRS_KEY, JSON.stringify(map));
  }
  return map;
}

export function getReviewWordIds(): string[] {
  ensureVocabularyStorageVersion();
  return Object.keys(getReviewSrsMap());
}

export function getDueReviewWordIds(): string[] {
  ensureVocabularyStorageVersion();
  const now = nowMs();
  const srs = getReviewSrsMap();
  const mastered = new Set(getMasteredWordIds());
  return Object.entries(srs)
    .filter(([wordId, state]) => !mastered.has(wordId) && state.dueAt <= now)
    .map(([wordId]) => wordId);
}

function upsertReviewWord(wordId: string, partial?: Partial<ReviewSrsState>): ReviewSrsMap {
  const srs = getReviewSrsMap();
  const current = srs[wordId] ?? {
    intervalIndex: 0,
    dueAt: nowMs(),
    lastReviewedAt: null,
  };

  srs[wordId] = {
    ...current,
    ...(partial ?? {}),
  };

  return setReviewSrsMap(srs);
}

export function addWordToReview(wordId: string): string[] {
  ensureVocabularyStorageVersion();
  upsertReviewWord(wordId, {
    intervalIndex: 0,
    dueAt: nowMs(),
    lastReviewedAt: null,
  });
  // Record when this word was added (for NEW badge)
  if (typeof window !== "undefined") {
    const addedAt = getReviewAddedAtMap();
    if (!addedAt[wordId]) { // only set once (first add)
      addedAt[wordId] = nowMs();
      window.localStorage.setItem(REVIEW_ADDED_AT_KEY, JSON.stringify(addedAt));
    }
  }
  return getReviewWordIds();
}

export function addWordsToReview(wordIds: string[]): string[] {
  ensureVocabularyStorageVersion();
  for (const id of wordIds) {
    addWordToReview(id);
  }
  return getReviewWordIds();
}

function getKnownSessionsMap(): KnownSessionsMap {
  ensureVocabularyStorageVersion();
  if (typeof window === "undefined") return {};
  const raw = window.localStorage.getItem(KNOWN_SESSIONS_KEY);
  if (!raw) return {};

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const result: KnownSessionsMap = {};

    for (const [wordId, value] of Object.entries(parsed)) {
      if (Array.isArray(value)) {
        result[wordId] = value.filter((v): v is string => typeof v === "string");
      }
    }

    return result;
  } catch {
    return {};
  }
}

function setKnownSessionsMap(map: KnownSessionsMap): KnownSessionsMap {
  ensureVocabularyStorageVersion();
  if (typeof window !== "undefined") {
    window.localStorage.setItem(KNOWN_SESSIONS_KEY, JSON.stringify(map));
  }
  return map;
}

export function getMasteredWordIds(): string[] {
  ensureVocabularyStorageVersion();
  const clicks = getKnownClicksMap();
  // Also check legacy sessions map for backwards compat
  const sessions = getKnownSessionsMap();
  const allIds = new Set([...Object.keys(clicks), ...Object.keys(sessions)]);
  const result: string[] = [];
  for (const wordId of allIds) {
    const clickCount = clicks[wordId] ?? 0;
    const sessionCount = (sessions[wordId] ?? []).length;
    if (clickCount >= MASTERED_THRESHOLD || sessionCount >= MASTERED_THRESHOLD) {
      result.push(wordId);
    }
  }
  return result;
}

export function isWordMastered(wordId: string): boolean {
  ensureVocabularyStorageVersion();
  const clicks = getKnownClicksMap()[wordId] ?? 0;
  if (clicks >= MASTERED_THRESHOLD) return true;
  const sessions = getKnownSessionsMap()[wordId] ?? [];
  return sessions.length >= MASTERED_THRESHOLD;
}

export function markWordKnown(wordId: string): { statusMap: WordStatusMap; reviewIds: string[]; counted: boolean } {
  ensureVocabularyStorageVersion();

  // Only count click if 24h cooldown has passed
  const counted = canCountKnownClick(wordId);
  const clicks = getKnownClicksMap();

  if (counted) {
    clicks[wordId] = (clicks[wordId] ?? 0) + 1;
    setKnownClicksMap(clicks);
    // Record timestamp for cooldown
    const lastCounted = getKnownLastCountedMap();
    lastCounted[wordId] = nowMs();
    setKnownLastCountedMap(lastCounted);
    incrementReviewedToday();
  }

  const mastered = (clicks[wordId] ?? 0) >= MASTERED_THRESHOLD;

  const statusMap = setWordStatusMap({
    ...getWordStatusMap(),
    [wordId]: "known",
  });

  if (!mastered) {
    const current = getReviewSrsMap()[wordId] ?? {
      intervalIndex: 0,
      dueAt: nowMs(),
      lastReviewedAt: null,
    };
    const nextIndex = Math.min(current.intervalIndex + 1, SRS_DAYS.length - 1);
    upsertReviewWord(wordId, {
      intervalIndex: nextIndex,
      lastReviewedAt: nowMs(),
      dueAt: nowMs() + daysToMs(SRS_DAYS[nextIndex]),
    });
  } else {
    const srs = getReviewSrsMap();
    delete srs[wordId];
    setReviewSrsMap(srs);
  }

  return { statusMap, reviewIds: getReviewWordIds(), counted };
}

export function markWordRepeat(wordId: string): { statusMap: WordStatusMap; reviewIds: string[] } {
  ensureVocabularyStorageVersion();
  incrementReviewedToday();

  // Penalty: subtract 1 click (minimum 0)
  const clicks = getKnownClicksMap();
  if ((clicks[wordId] ?? 0) > 0) {
    clicks[wordId] = clicks[wordId] - 1;
    setKnownClicksMap(clicks);
  }

  const statusMap = setWordStatusMap({
    ...getWordStatusMap(),
    [wordId]: "repeat",
  });
  const current = getReviewSrsMap()[wordId] ?? {
    intervalIndex: 0,
    dueAt: nowMs(),
    lastReviewedAt: null,
  };
  upsertReviewWord(wordId, {
    intervalIndex: Math.max(0, current.intervalIndex - 1),
    lastReviewedAt: nowMs(),
    dueAt: nowMs() + daysToMs(SRS_DAYS[0]),
  });
  return { statusMap, reviewIds: getReviewWordIds() };
}

export function getKnownSessionCount(wordId: string): number {
  ensureVocabularyStorageVersion();
  const clicks = getKnownClicksMap()[wordId];
  if (clicks !== undefined) return clicks;
  return (getKnownSessionsMap()[wordId] ?? []).length;
}

/** Remove a word from the review queue entirely */
export function removeWordFromReview(wordId: string): string[] {
  ensureVocabularyStorageVersion();
  const srs = getReviewSrsMap();
  delete srs[wordId];
  setReviewSrsMap(srs);
  return getReviewWordIds();
}

/** Get the dueAt timestamp for a word (0 if not in queue) */
export function getWordDueAt(wordId: string): number {
  const srs = getReviewSrsMap();
  return srs[wordId]?.dueAt ?? 0;
}

/** Returns true if the word was marked "known" today (lastCounted timestamp is today) */
export function wasKnownToday
(wordId: string): boolean {
  const lastCounted = getKnownLastCountedMap()[wordId];
  if (!lastCounted) return false;
  return todayStr() === new Date(lastCounted).toISOString().slice(0, 10);
}
