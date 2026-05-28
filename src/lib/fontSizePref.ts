export type FontSizePref = "normal" | "large" | "huge";

const STORAGE_KEY = "font_size_pref";

export function getFontSizePref(): FontSizePref {
  if (typeof window === "undefined") return "normal";
  const v = window.localStorage.getItem(STORAGE_KEY);
  return (v === "large" || v === "huge") ? v : "normal";
}

export function setFontSizePref(pref: FontSizePref): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, pref);
  applyFontSizePref(pref);
}

export function applyFontSizePref(pref: FontSizePref): void {
  const html = document.documentElement;
  html.classList.remove("font-large", "font-huge");
  if (pref === "large") html.classList.add("font-large");
  if (pref === "huge")  html.classList.add("font-huge");
}
