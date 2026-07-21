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
    { to: "/",           label: t("nav.home",       lang), icon: "ti-home",      end: true  },
    { to: "/practice",   label: t("nav.practice",   lang), icon: "ti-pencil",    end: false },
    { to: "/vocabulary", label: t("nav.vocabulary", lang), icon: "ti-language",  end: false },
    { to: "/progress",   label: t("nav.progress",   lang), icon: "ti-chart-bar", end: false },
    { to: "/more",       label: t("nav.more",       lang), icon: "ti-dots",      end: false },
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
          <span className="nav-icon"><i className={`ti ${item.icon}`} aria-hidden="true" /></span>
          <span className="nav-label">{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
