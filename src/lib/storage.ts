export function isBrowserStorageAvailable(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function readStorageString(key: string): string | null {
  if (!isBrowserStorageAvailable()) {
    return null;
  }

  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeStorageString(key: string, value: string): void {
  if (!isBrowserStorageAvailable()) {
    return;
  }

  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Storage may be unavailable in private mode or when quota is exceeded.
  }
}

export function removeStorageItem(key: string): void {
  if (!isBrowserStorageAvailable()) {
    return;
  }

  try {
    window.localStorage.removeItem(key);
  } catch {
    // Keep storage failures non-fatal for restricted browser contexts.
  }
}

export function readJson<T>(key: string, fallback: T): T {
  const raw = readStorageString(key);
  if (!raw) {
    return fallback;
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeJson<T>(key: string, value: T): void {
  writeStorageString(key, JSON.stringify(value));
}

export function readStringArray(key: string): string[] {
  const parsed = readJson<unknown>(key, []);
  return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : [];
}

export function readEnumValue<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  const raw = readStorageString(key);
  return allowed.includes(raw as T) ? (raw as T) : fallback;
}
