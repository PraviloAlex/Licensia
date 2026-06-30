import type { RefObject } from "react";
import type { FontSizePref } from "../../lib/fontSizePref";
import { t, type UILang } from "../../lib/i18n";

type LanguageMode = "both" | "es" | "ru";

type PracticeSettingsProps = {
  settingsRef: RefObject<HTMLDivElement | null>;
  gearOpen: boolean;
  uiLang: UILang;
  languageMode: LanguageMode;
  confirmMode: boolean;
  fontSizePref: FontSizePref;
  onToggleOpen: () => void;
  onClose: () => void;
  onSetLanguage: (next: LanguageMode) => void;
  onToggleConfirmMode: () => void;
  onStartExamMode: () => void;
  onSetUILang: (next: UILang) => void;
  onSetFontSize: (next: FontSizePref) => void;
  onResetPractice: () => void;
};

export function PracticeSettings({
  settingsRef,
  gearOpen,
  uiLang,
  languageMode,
  confirmMode,
  fontSizePref,
  onToggleOpen,
  onClose,
  onSetLanguage,
  onToggleConfirmMode,
  onStartExamMode,
  onSetUILang,
  onSetFontSize,
  onResetPractice,
}: PracticeSettingsProps) {
  return (
    <div className="pv2-gear-wrap" ref={settingsRef}>
      <button type="button" className={gearOpen ? "pv2-gear-btn pv2-gear-btn--open" : "pv2-gear-btn"} onClick={onToggleOpen} aria-label={t("pv2.settings", uiLang)} aria-expanded={gearOpen}>
        <i className="ti ti-settings" aria-hidden="true" />
      </button>
      {gearOpen && (
        <div className="pv2-gear-menu" role="dialog" aria-label={t("pv2.settings", uiLang)}>
          <div className="pv2-gear-section-label">{t("pv2.gear.qLang", uiLang)}</div>
          <div className="pv2-gear-lang-row">
            <button type="button" className={languageMode === "both" ? "pv2-gear-lang-btn pv2-gear-lang-btn--active" : "pv2-gear-lang-btn"} onClick={() => { onSetLanguage("both"); onClose(); }}>ES+RU</button>
            <button type="button" className={languageMode === "es"   ? "pv2-gear-lang-btn pv2-gear-lang-btn--active" : "pv2-gear-lang-btn"} onClick={() => { onSetLanguage("es");   onClose(); }}>ES</button>
            <button type="button" className={languageMode === "ru"   ? "pv2-gear-lang-btn pv2-gear-lang-btn--active" : "pv2-gear-lang-btn"} onClick={() => { onSetLanguage("ru");   onClose(); }}>RU</button>
          </div>
          <div className="pv2-gear-section-label">{t("pv2.gear.answers", uiLang)}</div>
          <button type="button" className="pv2-gear-item" onClick={onToggleConfirmMode}>
            <span className="pv2-gear-ico pv2-gear-ico--blue"><i className="ti ti-hand-finger" /></span>
            <span className="pv2-gear-text">
              <span className="pv2-gear-label">{confirmMode ? t("pv2.gear.standardLabel", uiLang) : t("pv2.gear.quickLabel", uiLang)}</span>
              <span className="pv2-gear-sub">{confirmMode ? t("pv2.gear.confirmOn", uiLang) : t("pv2.gear.confirmOff", uiLang)}</span>
            </span>
            <span className={confirmMode ? "pv2-toggle" : "pv2-toggle pv2-toggle--on"} aria-hidden="true"><span className="pv2-toggle-thumb" /></span>
          </button>
          <div className="pv2-gear-section-label">{t("pv2.gear.mode", uiLang)}</div>
          <button type="button" className="pv2-gear-item" onClick={onClose}>
            <span className="pv2-gear-ico pv2-gear-ico--teal"><i className="ti ti-book" /></span>
            <span className="pv2-gear-text"><span className="pv2-gear-label">{t("pv2.gear.practice", uiLang)}</span><span className="pv2-gear-sub">{t("pv2.gear.practiceHint", uiLang)}</span></span>
            <span className="pv2-gear-badge pv2-gear-badge--on">{t("pv2.gear.on", uiLang)}</span>
          </button>
          <button type="button" className="pv2-gear-item" onClick={onStartExamMode}>
            <span className="pv2-gear-ico pv2-gear-ico--amber"><i className="ti ti-clipboard-check" /></span>
            <span className="pv2-gear-text"><span className="pv2-gear-label">{t("pv2.gear.exam", uiLang)}</span><span className="pv2-gear-sub">{t("pv2.gear.examHint", uiLang)}</span></span>
          </button>
          <div className="pv2-gear-section-label">{t("pv2.gear.uiLang", uiLang)}</div>
          <div className="pv2-gear-lang-row">
            <button type="button" className={uiLang === "ru" ? "pv2-gear-lang-btn pv2-gear-lang-btn--active" : "pv2-gear-lang-btn"} onClick={() => onSetUILang("ru")}>
              🇷🇺 {t("pv2.gear.uiRu", uiLang)}
            </button>
            <button type="button" className={uiLang === "es" ? "pv2-gear-lang-btn pv2-gear-lang-btn--active" : "pv2-gear-lang-btn"} onClick={() => onSetUILang("es")}>
              🇦🇷 {t("pv2.gear.uiEs", uiLang)}
            </button>
          </div>
          <div className="pv2-gear-section-label">{t("pv2.gear.fontSize", uiLang)}</div>
          <div className="pv2-gear-font-row">
            {(["normal","large","huge"] as FontSizePref[]).map((p, i) => (
              <button key={p} type="button"
                className={fontSizePref === p ? "pv2-font-pill pv2-font-pill--active" : "pv2-font-pill"}
                onClick={() => onSetFontSize(p)}
                style={{ fontSize: ["0.72rem","1.0rem","1.38rem"][i] }}>A</button>
            ))}
          </div>
          <div className="pv2-gear-divider" />
          <button type="button" className="pv2-gear-item pv2-gear-item--danger" onClick={onResetPractice}>
            <span className="pv2-gear-ico pv2-gear-ico--red"><i className="ti ti-refresh" /></span>
            <span className="pv2-gear-text"><span className="pv2-gear-label">{t("pv2.gear.reset", uiLang)}</span></span>
          </button>
        </div>
      )}
    </div>
  );
}
