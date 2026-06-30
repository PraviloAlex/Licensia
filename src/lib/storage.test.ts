import { beforeEach, describe, expect, it, vi } from "vitest";
import { readJson, readStringArray, writeJson } from "./storage";

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
      data = {
        ...data,
        [key]: value,
      };
    },
  };
}

describe("storage", () => {
  beforeEach(() => {
    vi.stubGlobal("window", {
      localStorage: createLocalStorageMock(),
    });
    window.localStorage.clear();
  });

  it("returns the fallback when JSON is malformed", () => {
    window.localStorage.setItem("bad-json", "{bad");

    expect(readJson("bad-json", { ok: true })).toEqual({ ok: true });
  });

  it("filters non-string values from string arrays", () => {
    window.localStorage.setItem("ids", JSON.stringify(["a", 1, "b", null]));

    expect(readStringArray("ids")).toEqual(["a", "b"]);
  });

  it("writes JSON values through localStorage", () => {
    writeJson("value", { count: 2 });

    expect(window.localStorage.getItem("value")).toBe(JSON.stringify({ count: 2 }));
  });
});
