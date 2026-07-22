import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getAccessTier,
  getTrialDaysLeft,
  setProOverride,
  startTrialIfNeeded,
  TRIAL_DAYS,
} from "./entitlement";

function createLocalStorageMock(): Storage {
  let data: Record<string, string> = {};
  return {
    get length() {
      return Object.keys(data).length;
    },
    clear: () => {
      data = {};
    },
    getItem: (key: string) => data[key] ?? null,
    key: (index: number) => Object.keys(data)[index] ?? null,
    removeItem: (key: string) => {
      const { [key]: _removed, ...rest } = data;
      data = rest;
    },
    setItem: (key: string, value: string) => {
      data = { ...data, [key]: value };
    },
  };
}

const START = new Date("2026-07-22T12:00:00.000Z");
function daysLater(n: number): Date {
  return new Date(START.getTime() + n * 24 * 60 * 60 * 1000);
}

describe("entitlement", () => {
  beforeEach(() => {
    vi.stubGlobal("window", { localStorage: createLocalStorageMock() });
    window.localStorage.clear();
  });

  it("returns free before the trial is started", () => {
    expect(getAccessTier(START)).toBe("free");
  });

  it("grants an active trial for the trial window", () => {
    startTrialIfNeeded(START);
    expect(getAccessTier(START)).toBe("trial");
    expect(getTrialDaysLeft(START)).toBe(TRIAL_DAYS);
    expect(getAccessTier(daysLater(3))).toBe("trial");
  });

  it("expires the trial to free after the window", () => {
    startTrialIfNeeded(START);
    expect(getAccessTier(daysLater(TRIAL_DAYS + 1))).toBe("free");
    expect(getTrialDaysLeft(daysLater(TRIAL_DAYS + 1))).toBe(0);
  });

  it("does not restart an already-started trial", () => {
    startTrialIfNeeded(START);
    startTrialIfNeeded(daysLater(2)); // should be a no-op
    expect(getTrialDaysLeft(START)).toBe(TRIAL_DAYS);
  });

  it("honours the dev PRO override regardless of trial state", () => {
    setProOverride(true);
    expect(getAccessTier(daysLater(999))).toBe("pro");
    setProOverride(false);
    expect(getAccessTier(daysLater(999))).toBe("free");
  });
});
