import { useState, useEffect } from "react";
import { NavLink } from "react-router-dom";
import { getUILang, type UILang, t } from "../lib/i18n";

export function Navigation() {
  const [lang, setLang] = useState<UILang>(getUILang);

  useEffect(() => {
    const handler = () => setLang(getUILang());
    window.addEventListener("storage", handler);
    window.addEventListener("ui-lang-changed", handler);
    return () => {
      window.removeEventListener("storage", handler);
      window.removeEventListener("ui-lang-changed", handler);
    };
  }, []);

  const items = [
    { to: "/",               label: t("nav.home",       lang), icon: "🏠", end: true  },
    { to: "/practice",       label: t("nav.practice",   lang), icon: "📝", end: false },
    { to: "/vocabulary",     label: t("nav.vocabulary", lang), icon: "🗣️", end: false },
    { to: "/progress",       label: t("nav.progress",   lang), icon: "📊", end: false },
    { to: "/signs",          label: t("nav.signs",      lang), icon: "🚦", end: false },
    { to: "/practical-exam", label: t("nav.checklist",  lang), icon: "📋", end: false },
  ];

  return (
    <nav className="bottom-nav" aria-label="Navigation">
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) => (isActive ? "nav-item active" : "nav-item")}
        >
          <span className="nav-icon">{item.icon}</span>
          <span className="nav-label">{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
