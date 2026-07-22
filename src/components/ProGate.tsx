import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { t, type UILang } from "../lib/i18n";
import { useEntitlement } from "../hooks/useEntitlement";

type Props = {
  lang: UILang;
  children: ReactNode;
  /** Optional override for the upsell bar text (defaults to the explanation-gate copy). */
  label?: string;
  /** Optional override for the modal lead paragraph. */
  lead?: string;
};

/**
 * Depth gate. Renders `children` for trial/pro users; for free users it renders a compact
 * upsell that opens a "coming soon" PRO modal. NOTE: there is NO real payment — this drives
 * conversion only. Free users keep all questions and correct answers; only the deep
 * explanation is gated.
 */
export function ProGate({ lang, children, label, lead }: Props) {
  const { hasFullAccess } = useEntitlement();
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  if (hasFullAccess) return <>{children}</>;

  return (
    <>
      <button type="button" className="pro-gate" onClick={() => setOpen(true)} aria-haspopup="dialog" aria-expanded={open}>
        <span className="pro-gate-ico" aria-hidden="true"><i className="ti ti-lock" /></span>
        <span className="pro-gate-text">{label ?? t("progate.locked", lang)}</span>
        <span className="pro-gate-cta">{t("progate.unlock", lang)}</span>
      </button>

      {open && createPortal(
        <div className="pro-modal-wrap">
          <button type="button" className="pro-modal-backdrop" aria-label={t("pro.close", lang)} onClick={() => setOpen(false)} />
          <div className="pro-modal" role="dialog" aria-modal="true" aria-labelledby="progate-modal-title">
            <span className="pro-modal-ico" aria-hidden="true"><i className="ti ti-crown" /></span>
            <h2 className="pro-modal-title" id="progate-modal-title">{t("pro.modal.title", lang)}</h2>
            <p className="pro-modal-lead">{lead ?? t("progate.modal.lead", lang)}</p>
            <p className="pro-modal-note">{t("pro.modal.note", lang)}</p>
            <button type="button" className="pro-modal-close" ref={closeRef} onClick={() => setOpen(false)}>{t("pro.close", lang)}</button>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
