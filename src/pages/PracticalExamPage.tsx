import { useState } from "react";
import { PageShell } from "../components/PageShell";
import { practicalExamData } from "../lib/data";
import { getUILang } from "../lib/i18n";
import { t } from "../lib/i18n";

const CHECKLIST_KEY = "licencia_ar_checklist_v1";

type StepItem = { ru: string; es: string };

type Step = {
  id: string;
  icon: string;
  titleRu: string;
  titleEs: string;
  descRu: string;
  descEs: string;
  items: StepItem[];
  tipRu?: string;
  tipEs?: string;
};

const STEPS: Step[] = [
  {
    id: "turno",
    icon: "📅",
    titleRu: "Записаться на приём",
    titleEs: "Sacar turno online",
    descRu: "Запишитесь через сайт правительства Буэнос-Айреса. Без записи не примут.",
    descEs: "Reservá turno en el sitio del Gobierno de la Ciudad. Sin turno no te atienden.",
    items: [
      { ru: "Открыть сайт: turnosba.com.ar", es: "Entrar a: turnosba.com.ar" },
      { ru: 'Выбрать «Licencia de conducir — Primera vez»', es: 'Elegir «Licencia de conducir — Primera vez»' },
      { ru: "Выбрать ближайший CESVI или центр выдачи прав", es: "Elegir el CESVI o centro de emisión más cercano" },
      { ru: "Выбрать удобную дату и время", es: "Elegir fecha y horario disponible" },
      { ru: "Записать или сохранить номер записи", es: "Anotar o guardar el número de turno" },
    ],
    tipRu: "Записи могут быть заняты на 2–4 недели вперёд — бронируйте заранее.",
    tipEs: "Los turnos pueden estar ocupados 2–4 semanas — reservá con anticipación.",
  },
  {
    id: "documentos",
    icon: "📄",
    titleRu: "Подготовить документы",
    titleEs: "Reunir documentación",
    descRu: "Принесите все оригиналы. Фотокопии могут попросить дополнительно.",
    descEs: "Llevá todos los originales. Pueden pedirte fotocopias también.",
    items: [
      { ru: "DNI с актуальной пропиской в CABA", es: "DNI con domicilio actualizado en CABA" },
      { ru: "Grupo sanguíneo — справка о группе крови или запись в DNI", es: "Certificado de grupo sanguíneo o constancia" },
      { ru: "CUIL / CUIT (аналог ИНН)", es: "CUIL o CUIT vigente" },
      { ru: "Comprobante de domicilio — квитанция за коммуналку не старше 60 дней", es: "Comprobante de domicilio (no mayor a 60 días)" },
      { ru: "Квитанция об оплате сбора (tasa)", es: "Comprobante de pago de la tasa" },
    ],
    tipRu: "DNI с пропиской в CABA обязателен. Без него придётся менять адрес заранее.",
    tipEs: "El DNI debe tener domicilio en CABA. Sin eso no podés tramitar la licencia aquí.",
  },
  {
    id: "pago",
    icon: "💳",
    titleRu: "Оплатить сбор (tasa)",
    titleEs: "Pagar la tasa",
    descRu: "Стоимость зависит от категории прав и срока действия.",
    descEs: "El costo varía según la categoría y vigencia de la licencia.",
    items: [
      { ru: "Открыть: buenosaires.gob.ar/licencias", es: "Ingresar a: buenosaires.gob.ar/licencias" },
      { ru: "Найти раздел «Pagar tasa»", es: "Buscar la sección «Pagar tasa»" },
      { ru: "Выбрать категорию B (легковые автомобили)", es: "Seleccionar categoría B (automóviles particulares)" },
      { ru: "Оплатить картой или через Rapipago / Pago Fácil", es: "Pagar con tarjeta o por Rapipago / Pago Fácil" },
      { ru: "Сохранить квитанцию об оплате", es: "Guardar el comprobante de pago" },
    ],
    tipRu: "Актуальную стоимость проверяйте на официальном сайте — цены часто меняются.",
    tipEs: "Verificá el monto actualizado en el sitio oficial — los precios cambian seguido.",
  },
  {
    id: "medico",
    icon: "🏥",
    titleRu: "Медицинский экзамен",
    titleEs: "Examen psicofísico",
    descRu: "Проверка зрения, слуха и реакции. Проводится прямо в центре в день визита.",
    descEs: "Revisación de vista, audición y reflejos. Se hace en el centro el día del turno.",
    items: [
      { ru: "Проверка остроты зрения (с очками или линзами — если носите)", es: "Agudeza visual (con anteojos o lentes si usás)" },
      { ru: "Проверка поля зрения", es: "Campo visual" },
      { ru: "Проверка слуха", es: "Audición" },
      { ru: "Тест на реакцию (на компьютере)", es: "Test de reflejos (en computadora)" },
      { ru: "Психотест — базовые когнитивные и ситуационные вопросы", es: "Test psicológico — preguntas cognitivas y situacionales básicas" },
    ],
    tipRu: "Если носите очки или линзы — обязательно приходите в них. Это будет отмечено в правах.",
    tipEs: "Si usás anteojos o lentes de contacto — vení con ellos puestos. Quedará registrado en la licencia.",
  },
  {
    id: "teorico",
    icon: "💻",
    titleRu: "Теоретический экзамен",
    titleEs: "Examen teórico",
    descRu: "30 вопросов на компьютере. Нужно ответить правильно на 28 из 30 (93%).",
    descEs: "30 preguntas en computadora. Hay que responder bien 28 de 30 (93%).",
    items: [
      { ru: "Тест на компьютере, 30 вопросов с вариантами", es: "Test en computadora, 30 preguntas de opción múltiple" },
      { ru: "Все вопросы на испанском языке", es: "Las preguntas son en español" },
      { ru: "Порог прохождения: 28 из 30 правильных ответов", es: "Puntaje mínimo: 28 de 30 respuestas correctas" },
      { ru: "Темы: знаки, светофоры, ПДД, безопасность, спирт за рулём", es: "Temas: señales, semáforos, tránsito, seguridad, alcohol" },
      { ru: "При провале — записаться заново (новый turno)", es: "Si desaprobás — sacar nuevo turno para repetir" },
    ],
    tipRu: "Это приложение поможет подготовиться — 460 вопросов из официального банка.",
    tipEs: "Esta app te ayuda a prepararte — 460 preguntas del banco oficial.",
  },
  {
    id: "practico",
    icon: "🚗",
    titleRu: "Практический экзамен",
    titleEs: "Examen práctico",
    descRu: "Вождение с инспектором по маршруту ~15–20 минут.",
    descEs: "Manejo con el inspector por un recorrido de ~15–20 minutos.",
    items: [
      { ru: "Автомобиль предоставляет школа вождения или частный инструктор", es: "El vehículo lo provee la autoescuela o instructor particular" },
      { ru: "Маршрут: трогание с места, повороты, проезд перекрёстков, парковка", es: "Recorrido: arranque, giros, cruces de bocacalles, estacionamiento" },
      { ru: "Параллельная парковка обязательна", es: "Estacionamiento en paralelo es obligatorio" },
      { ru: "Разворот в разрешённом месте без заезда на бордюр", es: "Giro en U en lugar habilitado, sin subir al cordón" },
      { ru: "Ремень пристёгнут, зеркала настроены, спокойная реакция на замечания", es: "Cinturón puesto, espejos ajustados, reaccionar calmadamente" },
    ],
    tipRu: "Частые ошибки: не посмотреть в зеркало, не уступить дорогу, резко тормозить.",
    tipEs: "Errores frecuentes: no mirar el espejo, no ceder el paso, frenar bruscamente.",
  },
  {
    id: "retiro",
    icon: "🎉",
    titleRu: "Получить права",
    titleEs: "Retirar la licencia",
    descRu: "После сдачи всех экзаменов права выдают в тот же день.",
    descEs: "Tras aprobar todos los exámenes, la licencia se entrega el mismo día.",
    items: [
      { ru: "Сфотографируют на месте (биометрическое фото)", es: "Te sacan la foto biométrica en el acto" },
      { ru: "Подпись и данные проверяются при оформлении", es: "Se verifican firma y datos personales" },
      { ru: "Категория B: срок действия 5 лет (до 70 лет)", es: "Categoría B: vigencia 5 años (hasta los 70 años)" },
      { ru: "Права действительны во всей Аргентине", es: "La licencia es válida en todo el territorio nacional" },
      { ru: "Для иностранцев — нужен DNI с резидентурой (временной или постоянной)", es: "Para extranjeros — DNI con residencia (temporaria o permanente)" },
    ],
    tipRu: "Права на временном DNI действуют до истечения резиденции. После ПМЖ — обновите.",
    tipEs: "Con DNI temporario la licencia vence con la residencia. Al obtener radicación definitiva, renovála.",
  },
];

function readChecklist(): Record<string, boolean> {
  try {
    const raw = window.localStorage.getItem(CHECKLIST_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, boolean>;
  } catch {
    return {};
  }
}

function writeChecklist(data: Record<string, boolean>): void {
  window.localStorage.setItem(CHECKLIST_KEY, JSON.stringify(data));
}

export function PracticalExamPage() {
  const lang = getUILang();
  const [checked, setChecked] = useState<Record<string, boolean>>(() => readChecklist());
  const [openId, setOpenId] = useState<string | null>("turno");

  const doneCount = STEPS.filter((s) => checked[s.id]).length;
  const progressPct = Math.round((doneCount / STEPS.length) * 100);

  function toggle(id: string) {
    const next = { ...checked, [id]: !checked[id] };
    setChecked(next);
    writeChecklist(next);
  }

  function toggleOpen(id: string) {
    setOpenId((prev) => (prev === id ? null : id));
  }

  return (
    <PageShell title={t("nav.checklist", lang)}>
      {/* Progress bar */}
      <div className="cl-progress-wrap glass">
        <div className="cl-progress-top">
          <span className="cl-progress-label">
            {lang === "ru"
              ? `${doneCount} из ${STEPS.length} шагов выполнено`
              : `${doneCount} de ${STEPS.length} pasos completados`}
          </span>
          <span className="cl-progress-pct">{progressPct}%</span>
        </div>
        <div className="cl-progress-track">
          <div
            className="cl-progress-bar"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Steps */}
      <div style={{ display: "grid", gap: "var(--sp-2)" }}>
        {STEPS.map((step, idx) => {
          const isOpen = openId === step.id;
          const isDone = Boolean(checked[step.id]);
          return (
            <article
              key={step.id}
              className={`cl-step glass${isDone ? " cl-step--done" : ""}${isOpen ? " cl-step--open" : ""}`}
            >
              {/* Header row */}
              <div className="cl-step-head">
                {/* Checkbox — stops propagation so it doesn't toggle accordion */}
                <button
                  type="button"
                  className={`cl-check${isDone ? " cl-check--done" : ""}`}
                  onClick={(e) => { e.stopPropagation(); toggle(step.id); }}
                  aria-label={isDone ? "Отметить невыполненным" : "Отметить выполненным"}
                >
                  {isDone && <i className="ti ti-check" />}
                </button>

                {/* Title area — toggles accordion */}
                <button
                  type="button"
                  className="cl-step-title-btn"
                  onClick={() => toggleOpen(step.id)}
                >
                  <span className="cl-step-num">{idx + 1}</span>
                  <span className="cl-step-icon">{step.icon}</span>
                  <span className="cl-step-titles">
                    <span className="cl-step-title-main">
                      {lang === "ru" ? step.titleRu : step.titleEs}
                    </span>
                    <span className="cl-step-title-sub">
                      {lang === "ru" ? step.titleEs : step.titleRu}
                    </span>
                  </span>
                  <i className={`ti ${isOpen ? "ti-chevron-up" : "ti-chevron-down"} cl-step-chevron`} />
                </button>
              </div>

              {/* Body */}
              {isOpen && (
                <div className="cl-step-body">
                  <p className="cl-step-desc">
                    {lang === "ru" ? step.descRu : step.descEs}
                  </p>
                  <ul className="cl-step-items">
                    {step.items.map((item, i) => (
                      <li key={i} className="cl-step-item">
                        <i className="ti ti-point-filled cl-step-bullet" />
                        <span>
                          <span className="cl-item-main">
                            {lang === "ru" ? item.ru : item.es}
                          </span>
                          <span className="cl-item-sub">
                            {lang === "ru" ? item.es : item.ru}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                  {(step.tipRu || step.tipEs) && (
                    <div className="cl-step-tip">
                      <i className="ti ti-bulb" />
                      <span>
                        {lang === "ru" ? step.tipRu : step.tipEs}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </article>
          );
        })}
      </div>

      {/* Practical exam tips section */}
      {practicalExamData.length > 0 && (
        <section style={{ display: "grid", gap: "var(--sp-2)", marginTop: "var(--sp-2)" }}>
          <p className="progress-section-title">
            {lang === "ru" ? "Советы: практический экзамен" : "Consejos: examen práctico"}
          </p>
          <div style={{ display: "grid", gap: 8 }}>
            {practicalExamData.map((item) => (
              <article key={item.id} className="cl-exam-tip-card glass">
                <p className="cl-exam-tip-title">
                  {lang === "ru" ? item.title_ru : item.title_es}
                </p>
                <div className="cl-exam-tip-row">
                  <i className="ti ti-check cl-exam-tip-ico" style={{ color: "var(--green)" }} />
                  <span>{item.whatExaminerChecks_ru}</span>
                </div>
                <div className="cl-exam-tip-row" style={{ color: "var(--red)" }}>
                  <i className="ti ti-alert-triangle cl-exam-tip-ico" />
                  <span>{item.commonMistake_ru}</span>
                </div>
                <p className="cl-exam-tip-hint">
                  <i className="ti ti-bulb" style={{ marginRight: 4 }} />
                  {item.correctAction_ru}
                </p>
              </article>
            ))}
          </div>
        </section>
      )}
    </PageShell>
  );
}
