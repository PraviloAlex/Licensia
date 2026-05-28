import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { type UILang, getUILang, setUILang, t } from "../lib/i18n";

const ONBOARDING_KEY = "licencia_ar_onboarding_done";

function markOnboardingDone(): void {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(ONBOARDING_KEY, "1");
  }
}

export function OnboardingPage() {
  const [step, setStep] = useState(0);
  const [lang, setLang] = useState<UILang>(getUILang);
  const navigate = useNavigate();

  function pickLang(l: UILang) {
    setUILang(l);
    setLang(l);
    window.dispatchEvent(new Event("ui-lang-changed"));
  }
  function next()     { setStep((s) => Math.min(s + 1, 3)); }
  function back()     { if (step > 0) setStep(step - 1); }
  function startNow() { markOnboardingDone(); navigate("/practice?quick=1", { replace: true }); }
  function goHome()   { markOnboardingDone(); navigate("/",                  { replace: true }); }
  function skip()     { markOnboardingDone(); navigate("/",                  { replace: true }); }

  const isLast = step === 3;

  const STEPS = [
    {
      badge: t("ob.step1.badge", lang),
      title: t("ob.step1.title", lang),
      subtitle: t("ob.step1.subtitle", lang),
      visual: (
        <div className="ob-visual ob-visual--welcome">
          <img src={`${import.meta.env.BASE_URL}sol-de-mayo.png`} className="ob-flag-img" alt="" aria-hidden="true" />
          <div className="ob-glow-line" />
        </div>
      ),
    },
    {
      badge: t("ob.step2.badge", lang),
      title: t("ob.step2.title", lang),
      subtitle: null,
      features: [
        { icon: "📝", title: t("ob.step2.f1.title", lang), body: t("ob.step2.f1.body", lang) },
        { icon: "🗣️", title: t("ob.step2.f2.title", lang), body: t("ob.step2.f2.body", lang) },
        { icon: "🎯", title: t("ob.step2.f3.title", lang), body: t("ob.step2.f3.body", lang) },
      ],
    },
    {
      badge: t("ob.step3.badge", lang),
      title: t("ob.step3.title", lang),
      subtitle: null,
      roadmap: [
        { label: t("ob.step3.r1.label", lang), desc: t("ob.step3.r1.desc", lang), active: true  },
        { label: t("ob.step3.r2.label", lang), desc: t("ob.step3.r2.desc", lang), active: true  },
        { label: t("ob.step3.r3.label", lang), desc: t("ob.step3.r3.desc", lang), active: false },
        { label: t("ob.step3.r4.label", lang), desc: t("ob.step3.r4.desc", lang), active: false },
      ],
    },
    {
      badge: t("ob.step4.badge", lang),
      title: t("ob.step4.title", lang),
      subtitle: t("ob.step4.subtitle", lang),
    },
  ] as const;

  const s = STEPS[step as 0 | 1 | 2 | 3];

  return (
    <main className="onboarding-wrap">
      <div className="onboarding-inner">

        {/* Language pill toggle */}
        <div className="ob-lang-toggle">
          <button
            type="button"
            className={lang === "ru" ? "ob-lang-toggle-btn ob-lang-toggle-btn--active" : "ob-lang-toggle-btn"}
            onClick={() => pickLang("ru")}
          >RU</button>
          <button
            type="button"
            className={lang === "es" ? "ob-lang-toggle-btn ob-lang-toggle-btn--active" : "ob-lang-toggle-btn"}
            onClick={() => pickLang("es")}
          >ES</button>
        </div>

        {/* Step dots */}
        <div className="ob-step-dots">
          {STEPS.map((_, i) => (
            <div key={i} className={`ob-step-dot${i === step ? " ob-step-dot--active" : ""}`} />
          ))}
        </div>

        {/* Step content */}
        <div className="ob-step" key={step}>
          <div className="ob-hero-badge">{s.badge}</div>
          <h1 className="ob-logo">{s.title}</h1>

          {"subtitle" in s && s.subtitle && (
            <p className="ob-tagline">{s.subtitle}</p>
          )}

          {"visual" in s && s.visual}

          {"features" in s && s.features && (
            <div className="ob-feature-list">
              {s.features.map((f) => (
                <div key={f.title} className="ob-feature glass">
                  <span className="ob-feature-icon">{f.icon}</span>
                  <div>
                    <p className="ob-feature-title">{f.title}</p>
                    <p className="ob-feature-body">{f.body}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {"roadmap" in s && s.roadmap && (
            <div className="ob-roadmap">
              {s.roadmap.map((r, i) => (
                <div key={r.label} className={`ob-roadmap-step${!r.active ? " ob-roadmap-step--inactive" : ""}`}>
                  {r.active
                    ? <div className="ob-roadmap-num ob-roadmap-num--active">{i + 1}</div>
                    : <div className="ob-roadmap-num ob-roadmap-num--inactive"><i className="ti ti-lock" aria-hidden="true" /></div>
                  }
                  <div>
                    <p className={`ob-roadmap-title${!r.active ? " ob-roadmap-title--dim" : ""}`}>{r.label}</p>
                    <p className="ob-roadmap-body">{r.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {isLast && (
            <div className="ob-motive-list">
              {([1, 2, 3] as const).map((n) => (
                <div key={n} className="ob-motive-card">
                  <p className="ob-motive-title">💡 {lang === "ru" ? `Совет ${n}` : `Consejo ${n}`}</p>
                  <p className="ob-motive-body">{t(`ob.motive${n}.body` as Parameters<typeof t>[0], lang)}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="ob-nav">
          <button type="button" className="ob-back" onClick={back}>←</button>
          {isLast ? (
            <div style={{ display: "grid", gap: 8, flex: 1 }}>
              <button type="button" className="cta-primary ob-next" onClick={startNow}>{t("ob.btn.practice", lang)}</button>
              <button type="button" className="cta-secondary ob-next" onClick={goHome}>{t("ob.btn.home", lang)}</button>
            </div>
          ) : (
            <button type="button" className="cta-primary ob-next" onClick={next}>
              {step === 0 ? t("ob.btn.begin", lang) : t("ob.btn.next", lang)}
            </button>
          )}
        </div>

        <button type="button" className="ob-skip" onClick={skip}>{t("ob.btn.skip", lang)}</button>

      </div>
    </main>
  );
}
