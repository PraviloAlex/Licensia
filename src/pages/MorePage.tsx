import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PageShell } from "../components/PageShell";
import { ProCard } from "../components/ProCard";
import { getAccessTier, setProOverride } from "../lib/entitlement";
import { useEntitlement } from "../hooks/useEntitlement";
import { questionsData } from "../lib/data";
import { getMistakeQuestionCount } from "../lib/questionProgress";
import { getUILang, setUILang, t, type UILang } from "../lib/i18n";
import { getFontSizePref, setFontSizePref, type FontSizePref } from "../lib/fontSizePref";

const CHECKLIST_KEY = "licencia_ar_checklist_v1";
const CHECKLIST_TOTAL_STEPS = 7; // steps live inside PracticalExamPage; count is stable per CLAUDE.md

function readChecklistDoneCount(): number {
  try {
    const raw = window.localStorage.getItem(CHECKLIST_KEY);
    if (!raw) return 0;
    const data = JSON.parse(raw) as Record<string, boolean>;
    return Math.min(
      CHECKLIST_TOTAL_STEPS,
      Object.values(data).filter(Boolean).length,
    );
  } catch {
    return 0;
  }
}

export function MorePage() {
  const [lang, setLang] = useState<UILang>(getUILang);
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    try { return (window.localStorage.getItem("ui_theme") as "dark" | "light") || "light"; } catch { return "light"; }
  });
  const [fontPref, setFontPref] = useState<FontSizePref>(getFontSizePref);
  const [checklistDone] = useState(readChecklistDoneCount);
  const [mistakeCount] = useState(() => getMistakeQuestionCount(questionsData));
  const [proOn, setProOn] = useState(() => getAccessTier() === "pro");
  const { tier, trialDaysLeft } = useEntitlement();
  const tierLabel = tier === "pro" ? t("tier.pro", lang)
    : tier === "trial" ? `${t("tier.trial", lang)} · ${trialDaysLeft} ${t("trial.days", lang)}`
    : t("tier.free", lang);
  const isDev = typeof window !== "undefined" && ["localhost", "127.0.0.1"].includes(window.location.hostname);
  function toggleProDev() { const next = !proOn; setProOverride(next); setProOn(next); }

  useEffect(() => {
    const handler = () => setLang(getUILang());
    window.addEventListener("storage", handler);
    window.addEventListener("ui-lang-changed", handler);
    return () => {
      window.removeEventListener("storage", handler);
      window.removeEventListener("ui-lang-changed", handler);
    };
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try { window.localStorage.setItem("ui_theme", theme); } catch { /* noop */ }
    const themeColorMeta = document.querySelector('meta[name="theme-color"]');
    if (themeColorMeta) themeColorMeta.setAttribute("content", theme === "light" ? "#EEF3F8" : "#0F161E");
  }, [theme]);

  function pickLang(l: UILang) {
    setUILang(l);
    setLang(l);
    window.dispatchEvent(new Event("ui-lang-changed"));
  }

  const rows = [
    { to: "/signs",          icon: "ti-traffic-lights", label: t("more.signs", lang),     value: null },
    { to: "/practical-exam", icon: "ti-checklist",      label: t("more.checklist", lang), value: `${checklistDone}/${CHECKLIST_TOTAL_STEPS}` },
    { to: "/mistakes",       icon: "ti-target",         label: t("more.mistakes", lang),  value: mistakeCount > 0 ? String(mistakeCount) : null },
    { to: "/sources",        icon: "ti-books",          label: t("more.sources", lang),   value: null },
  ];

  return (
    <PageShell title={t("more.title", lang)}>
      <div className="more-list">
        {rows.map((row) => (
          <Link key={row.to} to={row.to} className="more-row">
            <span className="more-row-ico" aria-hidden="true"><i className={`ti ${row.icon}`} /></span>
            <span className="more-row-label">{row.label}</span>
            {row.value && <span className="more-row-value">{row.value}</span>}
            <i className="ti ti-chevron-right more-row-chev" aria-hidden="true" />
          </Link>
        ))}
      </div>

      <p className="more-section-label">{t("more.settings", lang)}</p>
      <div className="more-set-card">
        <div className="more-set-row">
          <span className="more-set-label">{t("more.lang", lang)}</span>
          <div className="more-seg" role="group" aria-label={t("more.lang", lang)}>
            <button type="button"
              className={lang === "ru" ? "more-seg-btn more-seg-btn--active" : "more-seg-btn"}
              onClick={() => pickLang("ru")}>RU</button>
            <button type="button"
              className={lang === "es" ? "more-seg-btn more-seg-btn--active" : "more-seg-btn"}
              onClick={() => pickLang("es")}>ES</button>
          </div>
        </div>
        <div className="more-set-row">
          <span className="more-set-label">{t("more.theme", lang)}</span>
          <div className="more-seg" role="group" aria-label={t("more.theme", lang)}>
            <button type="button"
              className={theme === "light" ? "more-seg-btn more-seg-btn--active" : "more-seg-btn"}
              onClick={() => setTheme("light")}>
              <i className="ti ti-sun" aria-hidden="true" /> {t("more.theme.light", lang)}
            </button>
            <button type="button"
              className={theme === "dark" ? "more-seg-btn more-seg-btn--active" : "more-seg-btn"}
              onClick={() => setTheme("dark")}>
              <i className="ti ti-moon" aria-hidden="true" /> {t("more.theme.dark", lang)}
            </button>
          </div>
        </div>
        <div className="more-set-row">
          <span className="more-set-label">{t("more.font", lang)}</span>
          <div className="more-seg" role="group" aria-label={t("more.font", lang)}>
            {(["normal", "large", "huge"] as FontSizePref[]).map((p, i) => (
              <button key={p} type="button"
                className={fontPref === p ? "more-seg-btn more-seg-btn--active" : "more-seg-btn"}
                onClick={() => { setFontSizePref(p); setFontPref(p); }}
                aria-label={t(`more.font.${p}` as Parameters<typeof t>[0], lang)}
                style={{ fontSize: ["0.72rem", "0.92rem", "1.12rem"][i] }}>A</button>
            ))}
          </div>
        </div>
        <div className="more-set-row">
          <span className="more-set-label">{t("more.access", lang)}</span>
          <span className={tier === "free" ? "more-tier-badge" : "more-tier-badge more-tier-badge--on"}>{tierLabel}</span>
        </div>
        {isDev && (
          <div className="more-set-row">
            <span className="more-set-label">PRO (dev)</span>
            <button type="button" className={proOn ? "more-seg-btn more-seg-btn--active" : "more-seg-btn"} onClick={toggleProDev}>
              {proOn ? "ON" : "OFF"}
            </button>
          </div>
        )}
      </div>

      <div className="more-pro-slot">
        <ProCard lang={lang} />
      </div>
    </PageShell>
  );
}
