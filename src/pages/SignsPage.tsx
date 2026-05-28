import { useState, useEffect } from "react";
import { PageShell } from "../components/PageShell";
import { getUILang, type UILang, t } from "../lib/i18n";

type Category = {
  id: string;
  labelKey: string;
  icon: string;
  images: { file: string; captionKey: string }[];
};

const CATEGORIES: Category[] = [
  {
    id: "regulatory",
    labelKey: "signs.cat.regulatory",
    icon: "ti-circle-off",
    images: [
      { file: "prohibicion_reglamentarias", captionKey: "signs.cap.prohibicion" },
      { file: "restriccion_prioridad",      captionKey: "signs.cap.restriccion"  },
    ],
  },
  {
    id: "warning",
    labelKey: "signs.cat.warning",
    icon: "ti-alert-triangle",
    images: [
      { file: "preventivas_caracteristicas", captionKey: "signs.cap.prev_via"     },
      { file: "preventivas_peligro",          captionKey: "signs.cap.prev_peligro" },
    ],
  },
  {
    id: "informative",
    labelKey: "signs.cat.informative",
    icon: "ti-info-circle",
    images: [
      { file: "informativas_via",          captionKey: "signs.cap.inf_via"    },
      { file: "informativas_nomenclatura", captionKey: "signs.cap.inf_nombres" },
      { file: "informativas_turismo",      captionKey: "signs.cap.inf_turismo" },
    ],
  },
  {
    id: "transitory",
    labelKey: "signs.cat.transitory",
    icon: "ti-road",
    images: [
      { file: "transitorias_viales",  captionKey: "signs.cap.transitorias" },
      { file: "peatonales_ciclovias", captionKey: "signs.cap.peatonales"   },
    ],
  },
  {
    id: "markings",
    labelKey: "signs.cat.markings",
    icon: "ti-line-dashed",
    images: [
      { file: "marcas_longitudinales", captionKey: "signs.cap.marcas_long"  },
      { file: "marcas_especiales",     captionKey: "signs.cap.marcas_esp"   },
    ],
  },
  {
    id: "lights",
    labelKey: "signs.cat.lights",
    icon: "ti-traffic-lights",
    images: [
      { file: "semaforos",          captionKey: "signs.cap.semaforos"     },
      { file: "semaforos_especiales", captionKey: "signs.cap.semaforos_esp" },
    ],
  },
];

export function SignsPage() {
  const [lang, setLang] = useState<UILang>(getUILang);
  const [activeId, setActiveId] = useState(CATEGORIES[0].id);
  const [lightbox, setLightbox] = useState<string | null>(null);

  useEffect(() => {
    const handler = () => setLang(getUILang());
    window.addEventListener("storage", handler);
    window.addEventListener("ui-lang-changed", handler);
    return () => {
      window.removeEventListener("storage", handler);
      window.removeEventListener("ui-lang-changed", handler);
    };
  }, []);

  // Close lightbox on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setLightbox(null); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const activeCat = CATEGORIES.find(c => c.id === activeId)!;
  const base = import.meta.env.BASE_URL;

  return (
    <PageShell title={t("signs.title", lang)}>
      {/* Category tabs */}
      <div className="signs-tabs">
        {CATEGORIES.map(cat => (
          <button
            key={cat.id}
            className={`signs-tab${activeId === cat.id ? " signs-tab--active" : ""}`}
            onClick={() => setActiveId(cat.id)}
          >
            <i className={`ti ${cat.icon}`} />
            <span>{t(cat.labelKey as Parameters<typeof t>[0], lang)}</span>
          </button>
        ))}
      </div>

      {/* Images */}
      <div className="signs-images">
        {activeCat.images.map(img => (
          <div key={img.file} className="signs-card">
            <p className="signs-caption">{t(img.captionKey as Parameters<typeof t>[0], lang)}</p>
            <img
              src={`${base}signs/${img.file}.webp`}
              alt={t(img.captionKey as Parameters<typeof t>[0], lang)}
              className="signs-img"
              loading="lazy"
              onClick={() => setLightbox(`${base}signs/${img.file}.webp`)}
            />
          </div>
        ))}
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div className="signs-lightbox" onClick={() => setLightbox(null)}>
          <button className="signs-lb-close" onClick={() => setLightbox(null)}>
            <i className="ti ti-x" />
          </button>
          <img src={lightbox} alt="" className="signs-lb-img" onClick={e => e.stopPropagation()} />
        </div>
      )}
    </PageShell>
  );
}
