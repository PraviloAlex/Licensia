import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { t, type UILang } from "../lib/i18n";

const FEATURES = [
  { icon: "ti-clipboard-check", key: "pro.feat.simulator" },
  { icon: "ti-target",          key: "pro.feat.mistakes" },
  { icon: "ti-cloud-off",       key: "pro.feat.offline" },
] as const;

export function ProCard({ lang }: { lang: UILang }) {
  const [open, setOpen] = useState(false);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeBtnRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button type="button" className="pro-card" onClick={() => setOpen(true)}
        aria-haspopup="dialog" aria-expanded={open}>
        <span className="pro-card-ico" aria-hidden="true"><i className="ti ti-crown" /></span>
        <span className="pro-card-body">
          <span className="pro-card-title">
            {t("pro.title", lang)}
            <span className="pro-card-badge">{t("pro.badge", lang)}</span>
          </span>
          <span className="pro-card-sub">{t("pro.subtitle", lang)}</span>
        </span>
        <i className="ti ti-chevron-right pro-card-chev" aria-hidden="true" />
      </button>

      {open && createPortal(
        <div className="pro-modal-wrap">
          <button type="button" className="pro-modal-backdrop"
            aria-label={t("pro.close", lang)} onClick={() => setOpen(false)} />
          <div className="pro-modal" role="dialog" aria-modal="true" aria-labelledby="pro-modal-title">
            <span className="pro-modal-ico" aria-hidden="true"><i className="ti ti-crown" /></span>
            <h2 className="pro-modal-title" id="pro-modal-title">{t("pro.modal.title", lang)}</h2>
            <p className="pro-modal-lead">{t("pro.modal.lead", lang)}</p>
            <ul className="pro-feat-list">
              {FEATURES.map((f) => (
                <li key={f.key} className="pro-feat">
                  <span className="pro-feat-ico" aria-hidden="true"><i className={`ti ${f.icon}`} /></span>
                  <span className="pro-feat-text">{t(f.key, lang)}</span>
                </li>
              ))}
            </ul>
            <p className="pro-modal-note">{t("pro.modal.note", lang)}</p>
            <button type="button" className="pro-modal-close" ref={closeBtnRef}
              onClick={() => setOpen(false)}>{t("pro.close", lang)}</button>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
