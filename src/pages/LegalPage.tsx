import { Link } from "react-router-dom";
import { PageShell } from "../components/PageShell";
import { getUILang } from "../lib/i18n";

const PRIVACY_URL = `${import.meta.env.BASE_URL}privacy.html`;

export function LegalPage() {
  const lang = getUILang();
  const isRu = lang === "ru";

  return (
    <PageShell title={isRu ? "Правовая информация" : "Información legal"}>
      <section className="legal-page">
        <article className="legal-card glass">
          <p className="legal-eyebrow">{isRu ? "Дисклеймер" : "Disclaimer"}</p>
          {isRu ? (
            <>
              <h2>Независимый учебный инструмент</h2>
              <p>
                Licencia AR не является официальным приложением Gobierno de la Ciudad de Buenos Aires,
                Agencia Nacional de Seguridad Vial или другого государственного органа.
              </p>
              <h2>Учебная цель</h2>
              <p>
                Приложение предназначено для тренировки, повторения и самопроверки перед
                теоретическим экзаменом. Оно не оформляет водительскую лицензию, не записывает на
                экзамен и не гарантирует успешную сдачу.
              </p>
              <h2>Актуальность информации</h2>
              <p>
                Формат экзамена, требования, даты, материалы и правила могут изменяться. Перед сдачей
                экзамена всегда проверяйте актуальную информацию в официальных источниках.
              </p>
              <h2>Источники</h2>
              <p>
                Список использованных и рекомендуемых источников доступен в разделе «Источники».
              </p>
            </>
          ) : (
            <>
              <h2>Herramienta de estudio independiente</h2>
              <p>
                Licencia AR no es una aplicación oficial del Gobierno de la Ciudad de Buenos Aires,
                de la Agencia Nacional de Seguridad Vial ni de ningún otro organismo gubernamental.
              </p>
              <h2>Finalidad educativa</h2>
              <p>
                La app está pensada para practicar, repasar y autoevaluarte antes del examen teórico.
                No emite licencias de conducir, no gestiona turnos y no garantiza la aprobación del
                examen.
              </p>
              <h2>Actualización de la información</h2>
              <p>
                El formato del examen, los requisitos, fechas, materiales y reglas pueden cambiar.
                Antes de rendir, verificá siempre la información actualizada en fuentes oficiales.
              </p>
              <h2>Fuentes</h2>
              <p>
                La lista de fuentes utilizadas y recomendadas está disponible en la sección “Fuentes”.
              </p>
            </>
          )}
        </article>

        <article className="legal-card legal-card--links glass">
          <p className="legal-eyebrow">{isRu ? "Документы" : "Documentos"}</p>
          <div className="legal-link-list">
            <Link to="/sources" className="legal-link-row">
              <span><i className="ti ti-list-search" aria-hidden="true" /></span>
              <strong>{isRu ? "Источники" : "Fuentes"}</strong>
              <i className="ti ti-chevron-right" aria-hidden="true" />
            </Link>
            <a href={PRIVACY_URL} className="legal-link-row">
              <span><i className="ti ti-shield-lock" aria-hidden="true" /></span>
              <strong>{isRu ? "Политика конфиденциальности" : "Política de privacidad"}</strong>
              <i className="ti ti-external-link" aria-hidden="true" />
            </a>
          </div>
        </article>
      </section>
    </PageShell>
  );
}
