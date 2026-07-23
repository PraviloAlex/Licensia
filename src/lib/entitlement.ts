import { readStorageString, writeStorageString, removeStorageItem } from "./storage";

export const TRIAL_STARTED_KEY = "licencia_ar_trial_started";
export const PRO_OVERRIDE_KEY = "licencia_ar_pro";
/** Set once the user has dismissed the "trial ended" notice. */
export const TRIAL_END_SEEN_KEY = "licencia_ar_trial_end_seen";

export const TRIAL_DAYS = 7;
/** Free tier: mock exams allowed per rolling 7-day window (trial/pro are unlimited). */
export const FREE_WEEKLY_EXAM_LIMIT = 3;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Access tier. NOTE: there is NO real payment — "pro" is only reachable via a local
 * dev/QA override (setProOverride). The gate is presentational: it drives upsell/conversion,
 * not DRM. Free users keep all questions; only depth (full explanations, prognosis,
 * "hardest", unlimited exams) is gated.
 */
export type AccessTier = "pro" | "trial" | "free";

/** Idempotently start the trial clock on first launch. Call once at app boot. */
export function startTrialIfNeeded(now: Date = new Date()): void {
  if (readStorageString(TRIAL_STARTED_KEY)) return;
  writeStorageString(TRIAL_STARTED_KEY, now.toISOString());
}

function trialStartedAt(): Date | null {
  const raw = readStorageString(TRIAL_STARTED_KEY);
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function getAccessTier(now: Date = new Date()): AccessTier {
  if (readStorageString(PRO_OVERRIDE_KEY) === "1") return "pro";
  const started = trialStartedAt();
  if (!started) return "free";
  const elapsedDays = (now.getTime() - started.getTime()) / MS_PER_DAY;
  return elapsedDays < TRIAL_DAYS ? "trial" : "free";
}

/** Whole days remaining in the trial (0 when expired or not started). */
export function getTrialDaysLeft(now: Date = new Date()): number {
  const started = trialStartedAt();
  if (!started) return 0;
  const elapsedDays = (now.getTime() - started.getTime()) / MS_PER_DAY;
  return Math.max(0, Math.ceil(TRIAL_DAYS - elapsedDays));
}

/** Whether paid-depth features are available (pro or active trial). */
export function hasFullAccess(now: Date = new Date()): boolean {
  return getAccessTier(now) !== "free";
}

/** Whether the trial clock was ever started (false only before the very first boot). */
export function hasTrialStarted(): boolean {
  return !!readStorageString(TRIAL_STARTED_KEY);
}

/** The one-time "your trial ended" notice: read + mark-as-seen. */
export function isTrialEndNoticeSeen(): boolean {
  return readStorageString(TRIAL_END_SEEN_KEY) === "1";
}
export function markTrialEndNoticeSeen(): void {
  writeStorageString(TRIAL_END_SEEN_KEY, "1");
}

/** Dev/QA only — flip the local PRO override (no payment involved). */
export function setProOverride(on: boolean): void {
  if (on) writeStorageString(PRO_OVERRIDE_KEY, "1");
  else removeStorageItem(PRO_OVERRIDE_KEY);
}
