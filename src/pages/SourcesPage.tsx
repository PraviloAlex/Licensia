import { PageShell } from "../components/PageShell";
import { getUILang } from "../lib/i18n";
import { LEGAL_SOURCES } from "../legal/sources";

export function SourcesPage() {
  const lang = getUILang();
  const isRu = lang === "ru";

  return (
    <PageShell title={isRu ? "Источники" : "Fuentes"}>
      <section className="legal-page">
        <article className="legal-card glass">
          <p className="legal-eyebrow">{isRu ? "Источники и материалы" : "Fuentes y materiales"}</p>
          {isRu ? (
            <>
              <p>
                Licencia AR — независимый учебный инструмент для подготовки. Материалы могут быть
                основаны на публичной информации и официальных источниках, доступных гражданам.
              </p>
              <p>
                Перед сдачей экзамена всегда проверяйте актуальные требования, даты, формат экзамена
                и материалы на официальных сайтах.
              </p>
            </>
          ) : (
            <>
              <p>
                Licencia AR es una herramienta independiente de estudio. Los materiales pueden basarse
                en información pública y fuentes oficiales disponibles para la ciudadanía.
              </p>
              <p>
                Antes de rendir el examen, verificá siempre los requisitos, fechas, formato del examen
                y materiales en los sitios oficiales.
              </p>
            </>
          )}
          <p className="legal-verification-date">
            {isRu
              ? "Последняя проверка источников: 29 мая 2026"
              : "Última verificación de fuentes: 29 de mayo de 2026"}
          </p>
        </article>

        <div className="legal-source-list" aria-label={isRu ? "Основные источники" : "Fuentes principales"}>
          {LEGAL_SOURCES.map((source) => {
            const hasVerifiedUrl = Boolean(source.url && source.verified);
            return (
              <article className="legal-source-card glass" key={source.id}>
                <div>
                  <h2>{source.title}</h2>
                  <p>{source.organization}</p>
                  <small>{isRu ? source.descriptionRu : source.descriptionEs}</small>
                </div>
                {hasVerifiedUrl ? (
                  <a href={source.url} target="_blank" rel="noreferrer" className="legal-source-url">
                    {isRu ? "Открыть источник" : "Abrir fuente"}
                    <i className="ti ti-external-link" aria-hidden="true" />
                  </a>
                ) : (
                  <small className="legal-source-pending">
                    {isRu
                      ? "Ссылка будет добавлена после финальной проверки"
                      : "El enlace se añadirá después de la verificación final"}
                  </small>
                )}
              </article>
            );
          })}
        </div>
      </section>
    </PageShell>
  );
}
