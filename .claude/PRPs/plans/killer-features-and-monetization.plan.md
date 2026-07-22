# Plan: Killer Features & Monetization (Licencia AR)

## Summary
Превратить работающий, но «сырой» тренажёр в **тренера с ощущением подготовки**: именованные режимы, план от даты экзамена, прогноз сдачи вместо покрытия, адаптивная тренировка, график эволюции, банк ошибок до мастерства, и пейвол-по-глубине с 7-дневным триалом (без реальной оплаты). Основано на живом тимдауне конкурентов (PracticaTest DGT = эталон, локальные AR = товарный пол) — см. раздел External Documentation.

## User Story
Как русскоязычный эмигрант, готовящийся к теоретическому экзамену на права в Аргентине,
я хочу видеть **план, прогноз сдачи и персональную тренировку слабых мест**,
чтобы чувствовать, что я реально готовлюсь и знаю, когда буду готов сдавать.

## Problem → Solution
Сейчас: приложение отвечает «сколько я прошёл» (покрытие), без цели, плана и адаптивности → ощущение сырости.
Станет: приложение отвечает «**сдам ли я и когда буду готов**» — дата экзамена → дневной план → прогноз сдачи → адаптивная тренировка → момент «Ты готов» → апселл глубины.

## Metadata
- **Complexity**: XL (разбит на 8 фаз P0–P7; каждую можно катить отдельной сессией)
- **Source PRD**: N/A (сформировано из стратегии + живого тимдауна конкурентов в этой сессии)
- **PRD Phase**: standalone
- **Estimated Files**: ~22 (10 CREATE, 12 UPDATE)
- **Branch**: продолжать на `codex/maintainability-refactor` или новую `feat/killer-features`

---

## UX Design

### Before
```
┌──────────────────────────────────────────┐
│  HomePage                                  │
│  ┌ hero ─────────────────────────────┐    │
│  │ «Лучшее действие» + CTA  │ кольцо  │    │
│  │                          │ 0% ПОКР │    │  ← метрика = покрытие
│  └──────────────────────────┴─────────┘    │
│  СЕГОДНЯ: [20][5][слова][экзамен]  ← кнопки │  ← одинаковые, без имён-режимов
│  (нет даты экзамена, нет плана, нет прогноза)│
└──────────────────────────────────────────┘
```

### After
```
┌──────────────────────────────────────────┐
│  «До экзамена 9 дней · сегодня: 20 + 5 слаб.тем» │ ← P2 план-баннер
│  ┌ hero ─────────────────────────────┐    │
│  │ рекомендация + CTA  │ кольцо 78%   │    │
│  │                     │ ВЕРОЯТНОСТЬ  │    │  ← P3 прогноз сдачи
│  │                     │ СДАТЬ        │    │
│  └─────────────────────┴─────────────┘    │
│  РЕЖИМЫ: [Умная][По темам][Экзамен]        │  ← P1/P4 именованные режимы
│          [Ошибки][Самые заваленные 🔒PRO]  │  ← P1 + P7 гейт
│  ЭВОЛЮЦИЯ: ▁▂▄▅▆▇  (мок-баллы во времени)   │  ← P5 (в Прогрессе)
└──────────────────────────────────────────┘
```

### Interaction Changes
| Touchpoint | Before | After | Notes |
|---|---|---|---|
| Онбординг | язык/тема | + шаг «дата экзамена» | P2, необязательный шаг (можно «не знаю») |
| Home hero | кольцо = покрытие | кольцо = прогноз сдачи | P3, формула из мок-истории |
| Home «Сегодня» | 4 кнопки | именованные режимы + план | P1/P2 |
| Практика | practice/quick/mistakes/exam/subtopic | + `hard`, `smart` режимы | P1/P4 |
| Прогресс | 4 плитки | + график эволюции мок-баллов | P5 |
| Объяснения | все поля всем | keyRule free, остальное PRO | P7 гейт-по-глубине |
| ProCard | заглушка-модал | апселл-обёртка `<ProGate>` + триал | P7 |

---

## Mandatory Reading

| Priority | File | Lines | Why |
|---|---|---|---|
| P0 | `src/lib/storage.ts` | 1-67 | Репозиторный слой localStorage — ВСЕ новые ключи через него |
| P0 | `src/lib/questionProgress.ts` | 1-258 | Пер-вопросная статистика + существующие builder'ы (адаптив уже есть) |
| P0 | `src/lib/homeStats.ts` | 79-145 | `getReadinessLevel` (формула счёта), today/weekly хелперы, exam-today |
| P0 | `src/hooks/useExamSession.ts` | 1-56, 130-140 | Форма `ExamHistoryData`, точка записи истории (одна строка на хук) — ЗАЩИЩЁН |
| P1 | `src/constants/exam.ts` | 1-3 | `EXAM_TOTAL_QUESTIONS=40`, `EXAM_PASS_CORRECT=34`, `EXAM_PASS_PERCENT=85` |
| P1 | `src/lib/i18n.ts` | — | Паттерн ключей (`"nav.more"`, `"pro.*"`), добавлять в ОБА блока ru/es |
| P1 | `src/App.tsx` | 26-46 | Роуты + `RequireOnboarding` guard |
| P1 | `src/components/ProCard.tsx` | 1-63 | Паттерн модала (createPortal, Escape, focus) — база для `<ProGate>` |
| P1 | `src/components/ReadinessRing.tsx` | all | Готовое SVG-кольцо — переиспользовать для прогноза (P3) и как основу графика (P5) |
| P1 | `src/pages/OnboardingPage.tsx` | all | Куда вставить шаг «дата экзамена» (P2) |
| P1 | `src/pages/ProgressPage.tsx` | all | Куда вставить график эволюции (P5) и прогноз (P3) |
| P2 | `src/lib/questionProgress.test.ts` | 1-45 | Паттерн теста + `createLocalStorageMock` — копировать для новых lib-тестов |
| P2 | `docs/DESIGN_REVIEW_TASKS.md` | «Что НЕ трогать» | Защищённая механика — не нарушать |
| P2 | `CLAUDE.md` (в `AUTO/`) | localStorage-ключи, emoji-правило | Файлы с emoji/кириллицей править Python-скриптом |

## External Documentation

| Topic | Source | Key Takeaway |
|---|---|---|
| Эталон вертикали | PracticaTest DGT (España), live-тимдаун этой сессии | Платный ров = «Exámenes a medida» (умный генератор из самых заваленных) + «Panel personal» (слабые темы) + объяснение ВСЕХ заваленных + свежайшие тесты. Free даёт распробовать. |
| Глубина через режимы | PracticaTest «Cómo funciona» | Ощущение богатства = много ИМЕНОВАННЫХ режимов (aleatorios, inteligentes, de la semana, por tema, «los imposibles»), а не одна кнопка Practice. |
| Growth-петля | PracticaTest «Ventajas» | «Reta a tus amigos → cuenta PREMIUM gratis» — реферал даёт премиум (P7 опц. под-задача). |
| Товарный пол AR | Play Store «Examen de Conducir Argentina» (Aguilapp 4.6★ и десятки клонов) | Реклама, скрап-вопросы «de fuentes públicas», базовый симулятор + «где ошибся», PDF-мануал. Без объяснений/адаптива/плана. Твоё преимущество: верификация + двуязычие RU/ES + объяснения. |

KEY_INSIGHT: Адаптивный подбор и статистика по вопросам УЖЕ реализованы (`buildPracticeQuestionIds`, `QuestionProgressItem`).
APPLIES_TO: P1 (Самые заваленные), P4 (Умная тренировка) — это в основном surфейсинг существующей логики, а не новая механика.
GOTCHA: `exam_history_v1` хранит только агрегат `{attempts,bestPct,lastPct,lastDate}` — НЕТ серии попыток. Прогноз (P3) и график (P5) требуют серии → сначала P0.

---

## Patterns to Mirror

### STORAGE_REPOSITORY (все чтения/записи localStorage — только так)
```ts
// SOURCE: src/lib/storage.ts:41-56
export function readJson<T>(key: string, fallback: T): T { /* try/catch → fallback */ }
export function writeJson<T>(key: string, value: T): void { writeStorageString(key, JSON.stringify(value)); }
// readEnumValue<T>(key, allowed, fallback) — для строковых enum-ключей
```

### STORAGE_KEY_CONST (именование ключей — модульная константа сверху файла)
```ts
// SOURCE: src/lib/questionProgress.ts:5-6
export const QUESTION_PROGRESS_KEY = "licensia_question_progress";
export const CURRENT_PRACTICE_SESSION_KEY = "licensia_current_practice_session";
// Новые ключи именовать так же: exam_attempts_v1, licencia_ar_exam_date, licencia_ar_trial_started
```

### BUILDER_PATTERN (генератор набора вопросов — чистая функция от questions)
```ts
// SOURCE: src/lib/questionProgress.ts:178-181
export function buildMistakesPracticeQuestionIds(questions: VerifiedQuestion[]): string[] {
  const activeIds = getActiveMistakeIds(questions);
  return shuffle(activeIds).slice(0, MISTAKES_SESSION_CAP);
}
// Новые builder'ы (buildHardestQuestionIds, buildWeakTopicQuestionIds) — той же формы.
```

### PROGRESS_UPDATE (иммутабельное обновление map, дописать поле — additive)
```ts
// SOURCE: src/lib/questionProgress.ts:68-91
const next: QuestionProgressItem = { seenCount: prev.seenCount+1, /* ... */ lastAnswerCorrect: isCorrect };
saveQuestionProgressMap({ ...map, [questionId]: next });
```

### SCORING (детерминированная формула → {score,label,labelKey,color})
```ts
// SOURCE: src/lib/homeStats.ts:97-115
export function getReadinessLevel(seen, total, correct, wrong): ReadinessLevel {
  const coverage = seen/total; const accuracy = correct/(correct+wrong); /* ... */
  if (score >= 80) return { score, label:"...", labelKey:"ready.lvl.exam", color:"var(--green)", hint:"..." };
}
// getPassProbability (P3) — той же формы: число + labelKey + токен-цвет.
```

### I18N (ключ через t(key, lang); добавлять в оба блока ru/es)
```tsx
// SOURCE: src/components/ProCard.tsx:30
{t("pro.title", lang)}
```

### MODAL (createPortal в body + Escape + focus на close)
```tsx
// SOURCE: src/components/ProCard.tsx:15-21,38-60
useEffect(() => { if (!open) return; closeBtnRef.current?.focus();
  const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
  document.addEventListener("keydown", onKey); return () => document.removeEventListener("keydown", onKey); }, [open]);
{open && createPortal(<div className="pro-modal-wrap">…</div>, document.body)}
```

### ROUTE (ленивый импорт + <Route>)
```tsx
// SOURCE: src/App.tsx:32
<Route path="/practice" element={<PracticePage />} />
// Новые режимы — НЕ новые роуты, а query-параметры /practice?hard=1 (см. CLAUDE.md «режимы запуска»)
```

### TEST (vitest + локальный localStorage-мок)
```ts
// SOURCE: src/lib/questionProgress.test.ts:16-39
function createLocalStorageMock(): Storage { let data:Record<string,string>={}; return { getItem:k=>data[k]??null, setItem:(k,v)=>{data={...data,[k]:v}}, /* ... */ }; }
beforeEach(() => { vi.stubGlobal("localStorage", createLocalStorageMock()); });
```

### EXAM_HISTORY (форма + единственная точка записи — ЗАЩИЩЁННЫЙ хук)
```ts
// SOURCE: src/hooks/useExamSession.ts:12-17,47-56,136
export interface ExamHistoryData { attempts:number; bestPct:number; lastPct:number; lastDate:string; }
function saveExamHistory(pct:number){ /* пишет exam_history_v1 */ }
// строка 136: saveExamHistory(pct);  ← сюда добавить recordExamAttempt(...) в P0 (одна строка)
```

---

## Files to Change

| File | Action | Justification |
|---|---|---|
| `src/lib/examHistory.ts` | CREATE | P0: серия попыток `exam_attempts_v1` (кормит P3, P5) |
| `src/hooks/useExamSession.ts` | UPDATE | P0: +1 строка `recordExamAttempt` рядом с `saveExamHistory` (строка ~136) |
| `src/lib/questionProgress.ts` | UPDATE | P1/P4/P6: `buildHardestQuestionIds`, `buildWeakTopicQuestionIds`, поле `correctStreak` |
| `src/pages/PracticePage.tsx` | UPDATE | P1/P4: обработать `?hard=1`, `?smart=1` (по образцу `?mistakes`/`?subtopic`) |
| `src/pages/HomePage.tsx` | UPDATE | P1/P2/P3/P7: сетка режимов, план-баннер, прогноз в кольце, ProGate |
| `src/lib/studyPlan.ts` | CREATE | P2: дата экзамена + дневной план |
| `src/pages/OnboardingPage.tsx` | UPDATE | P2: шаг «дата экзамена» (необязательный) |
| `src/lib/readiness.ts` | CREATE | P3: `getPassProbability` (recency-weighted) |
| `src/pages/ProgressPage.tsx` | UPDATE | P3/P5: прогноз + SVG-график эволюции |
| `src/components/EvolutionChart.tsx` | CREATE | P5: sparkline мок-баллов (по образцу ReadinessRing SVG) |
| `src/lib/entitlement.ts` | CREATE | P7: тир доступа (trial/free/pro) + триал-таймер, БЕЗ оплаты |
| `src/hooks/useEntitlement.ts` | CREATE | P7: реактивный доступ к тиру |
| `src/components/ProGate.tsx` | CREATE | P7: обёртка-гейт (children если доступно, иначе апселл через ProCard-модал) |
| `src/screens/SessionResultScreen.tsx` | UPDATE | P7: полные объяснения под ProGate, keyRule свободно |
| `src/lib/i18n.ts` | UPDATE | все фазы: новые ключи в ru+es |
| `src/styles/23-modes-and-plan.css` | CREATE | P1/P2: стили режимов+плана (только токены, ноль `[data-theme]`) |
| `src/styles/24-evolution-and-prob.css` | CREATE | P3/P5: график+прогноз |
| `src/styles.css` | UPDATE | `@import` новых модулей |
| `src/lib/examHistory.test.ts` | CREATE | P0 тест |
| `src/lib/studyPlan.test.ts` | CREATE | P2 тест |
| `src/lib/readiness.test.ts` | CREATE | P3 тест |
| `src/lib/entitlement.test.ts` | CREATE | P7 тест |

## NOT Building
- **Реальная оплата/чекаут/подписка** — запрещено политикой и вне скоупа. PRO-анлок = локальный флаг (`entitlement.setProOverride` для dev/QA) + будущая внешняя интеграция отдельной задачей. Никаких платёжных SDK, форм карт, внешних скриптов.
- **Бэкенд/аккаунты/синхронизация** — всё остаётся на localStorage (как весь проект). Прогресс не мигрирует между устройствами.
- **Изменение защищённой механики** — `confirmMode`, `practiceMode` init, exam-таймер, SRS-слов, формула `getReadinessLevel` (её не переписываем — прогноз P3 это ОТДЕЛЬНАЯ функция), потоки `useExamSession`/`usePracticeSession` (кроме +1 строки записи истории в P0).
- **`/editor` и структура `questions.verified.json`** — заблокировано ревью вопросов (T6/T22). Гейт объяснений (P7) читает существующие поля, не реструктурирует данные.
- **Агрегатные соц-пруф-метрики** («N человек сдали») — нет бэкенда; отложено.
- **«Los imposibles» на общей статистике всех юзеров** — нет бэкенда; аппроксимируем персональными most-failed (P1).

---

## Step-by-Step Tasks

### Task P0: Серия попыток экзамена (фундамент для P3/P5)
- **ACTION**: Создать `src/lib/examHistory.ts` и подключить запись из `useExamSession`.
- **IMPLEMENT**: Ключ `export const EXAM_ATTEMPTS_KEY = "exam_attempts_v1";`. Тип `ExamAttempt = { pct: number; correct: number; total: number; date: string }`. `recordExamAttempt(correct, total)` → читает массив через `readJson<ExamAttempt[]>(EXAM_ATTEMPTS_KEY, [])`, добавляет запись `{pct: Math.round(correct/total*100), correct, total, date: new Date().toISOString()}`, обрезает до последних 50, пишет `writeJson`. `getExamAttempts(): ExamAttempt[]`. В `useExamSession.ts` рядом со строкой `saveExamHistory(pct)` (~136) добавить `recordExamAttempt(examCorrectCount, examTotal)`.
- **MIRROR**: STORAGE_REPOSITORY, STORAGE_KEY_CONST.
- **IMPORTS**: `import { readJson, writeJson } from "./storage";` в новом файле; в хуке — `import { recordExamAttempt } from "../lib/examHistory";`.
- **GOTCHA**: `useExamSession` защищён — добавить ровно ОДНУ строку записи, ничего в потоке/таймере не трогать. Не мигрировать `exam_history_v1` (оставить как есть, работают параллельно).
- **VALIDATE**: `npx vitest run src/lib/examHistory.test.ts`; пройти экзамен в `run.bat` → в localStorage появился `exam_attempts_v1` с записью.

### Task P1: Именованные режимы + «Самые заваленные»
- **ACTION**: Вывести режимы как сетку карточек на Home; добавить builder «самые заваленные» и режим `?hard=1`.
- **IMPLEMENT**: В `questionProgress.ts` — `buildHardestQuestionIds(questions, size=PRACTICE_SESSION_SIZE)`: среди `getQuestionProgressMap()` брать id с `seenCount>0 && wrongCount>0`, сортировать по `wrongCount/seenCount` desc (tie → `wrongCount` desc), взять `size`; если мало — добить `buildPracticeQuestionIds`. В `PracticePage.tsx` добавить чтение `?hard=1` по образцу существующего `?mistakes=1`/`?subtopic=` (см. CLAUDE.md «режимы запуска») → `startPracticeSession` с этими id. На Home заменить 4 разрозненные кнопки сеткой карточек-режимов с именами+иконками Tabler: `Умная тренировка` (P4), `По темам` (`/practice?subtopic=`… или хаб тем), `Экзамен` (`?exam=1`), `Работа над ошибками` (`?mistakes=1`), `Самые заваленные` (`?hard=1`, PRO-гейт в P7).
- **MIRROR**: BUILDER_PATTERN (buildMistakesPracticeQuestionIds), ROUTE (query-параметры), I18N.
- **IMPORTS**: в PracticePage — существующие `useSearchParams`/логика; в Home — `<Link to="/practice?hard=1">`.
- **GOTCHA**: НЕ создавать новые роуты — только query-параметры (иначе поломается инициализация `practiceMode`, см. CLAUDE.md). Emoji-иконки не использовать — только Tabler (`ti-*`), как в T7/T21.
- **VALIDATE**: `npx tsc --noEmit`; `run.bat` → каждая карточка запускает нужный режим; `/practice?hard=1` даёт вопросы с наибольшей долей ошибок; горизонтального скролла на 320px нет.

### Task P2: Онбординг с датой экзамена + дневной план
- **ACTION**: Спросить дату экзамена в онбординге; считать и показывать дневной план на Home.
- **IMPLEMENT**: `src/lib/studyPlan.ts`: ключ `licencia_ar_exam_date`. `setExamDate(iso|null)`, `getExamDate(): string|null`, `getDaysUntilExam(): number|null` (округл. вверх от сегодня), `getDailyPlan(): { daysLeft:number|null; targetQuestions:number; recommendation:string }` — `targetQuestions` из остатка непройденных вопросов / `daysLeft` (клампить 10..40; если даты нет → дефолт 20). В `OnboardingPage.tsx` добавить необязательный шаг с `<input type="date">` (или пресеты «через 1/2/4 недели» + «пока не знаю»). В Home hero — баннер «До экзамена N дней · сегодня: X вопросов» (если дата задана).
- **MIRROR**: STORAGE_REPOSITORY, homeStats today-хелперы (`getTodayAnsweredCount`), I18N.
- **IMPORTS**: `import { getUniqueSeenCount } from "./questionProgress";` для остатка; `questionsData.length` для total.
- **GOTCHA**: `OnboardingPage.tsx` в emoji-списке CLAUDE.md → править Python-скриптом. Дата — необязательна: «пока не знаю» не блокирует завершение онбординга. Не хранить дату в URL.
- **VALIDATE**: `npx vitest run src/lib/studyPlan.test.ts` (edge: дата в прошлом → daysLeft 0; нет даты → null; 0 дней не делить на ноль); `run.bat` — новый профиль проходит онбординг с датой, баннер считает верно в обеих темах и RU/ES.

### Task P3: Прогноз сдачи вместо покрытия
- **ACTION**: Считать вероятность сдачи из мок-истории + точности по темам; показать в кольце Home и в Прогрессе.
- **IMPLEMENT**: `src/lib/readiness.ts`: `getPassProbability(): { pct:number; labelKey:string; color:string; basis:"exams"|"practice"|"none" }`. Логика: если есть ≥1 запись в `getExamAttempts()` — взвесить последние N по свежести (напр. последние 3, веса 0.5/0.3/0.2) относительно порога `EXAM_PASS_PERCENT`; если экзаменов нет — деградировать к оценке из точности по вопросам (`getQuestionProgressMap`) с явной пометкой `basis:"practice"` и подписью «оценка по практике». Цвет — токены (`--green/--accent/--gold/--red`). В `HomePage` и `ProgressPage` заменить подпись кольца с «покрытие» на «Вероятность сдать: N%» (кольцо `ReadinessRing` переиспользовать, скормить новое значение). Покрытие оставить как вторичную цифру.
- **MIRROR**: SCORING (getReadinessLevel форма), ReadinessRing (готовое кольцо), I18N.
- **IMPORTS**: `import { getExamAttempts } from "./examHistory";`, `import { EXAM_PASS_PERCENT } from "../constants/exam";`.
- **GOTCHA**: Зависит от P0. НЕ переписывать `getReadinessLevel` — это отдельная функция (формула защищена в T21/homeStats). Честная деградация при отсутствии экзаменов (не показывать «78%» из воздуха — помечать basis).
- **VALIDATE**: `npx vitest run src/lib/readiness.test.ts` (нет данных → basis:"none", pct 0; 3 мок-экзамена 90/80/70 → взвешенный результат; только практика → basis:"practice"); `run.bat` — кольцо показывает прогноз, деградация корректна.

### Task P4: «Умная тренировка» как явный режим + слабые темы
- **ACTION**: Выставить существующий адаптив как именованный режим и добавить таргетинг слабейших тем.
- **IMPLEMENT**: `buildPracticeQuestionIds` уже адаптивен (unseen 50/ошибки 30/повтор 20) — на Home карточка «Умная тренировка» ведёт на `/practice` (дефолт уже её вызывает). Добавить `buildWeakTopicQuestionIds(questions, size)`: посчитать точность по `subtopic` из прогресса, взять 1–2 слабейшие темы (точность <80%, seen>0), собрать из них через `buildSubtopicSessionQuestionIds`-логику; режим `?weak=1` в PracticePage. Показывать на Home/Progress кнопку «Тренировать слабую тему» (в ProgressPage уже есть аналог — переиспользовать/унифицировать).
- **MIRROR**: BUILDER_PATTERN, ProgressPage существующая кнопка слабой темы.
- **IMPORTS**: переиспользовать `buildSubtopicSessionQuestionIds`, `getQuestionProgressMap`.
- **GOTCHA**: Не дублировать логику слабой темы, что уже в ProgressPage — вынести в `questionProgress.ts` и переиспользовать в обоих местах. Query-параметр, не роут.
- **VALIDATE**: `npx tsc --noEmit`; `run.bat` — «Умная» даёт микс unseen/ошибки; «слабая тема» ведёт в тему с наименьшей точностью.

### Task P5: График эволюции мок-баллов
- **ACTION**: Показать линию/спарклайн баллов мок-экзаменов во времени в Прогрессе.
- **IMPLEMENT**: `src/components/EvolutionChart.tsx` — чистый SVG (без внешних либ), принимает `attempts: ExamAttempt[]`, рисует линию pct по времени + порог `EXAM_PASS_PERCENT` пунктиром. Пустое состояние: «Пройди первый экзамен — здесь появится динамика». В `ProgressPage` вставить в плитку «Экзамены» или отдельной секцией.
- **MIRROR**: ReadinessRing (паттерн inline-SVG с токен-цветами), I18N.
- **IMPORTS**: `import { getExamAttempts, type ExamAttempt } from "../lib/examHistory";`.
- **GOTCHA**: Зависит от P0. Цвета — токены (`var(--accent)`, `var(--green)`), не хардкод (Bandera). `viewBox` + `preserveAspectRatio` для адаптивности, `overflow-x` не нужен.
- **VALIDATE**: `run.bat` — после 2+ экзаменов линия растёт; 1 экзамен → точка; 0 → пустое состояние; обе темы.

### Task P6: Банк ошибок до мастерства
- **ACTION**: Ошибка считается «закрытой» только после N верных подряд.
- **IMPLEMENT**: Дописать в `QuestionProgressItem` поле `correctStreak: number` (additive, дефолт 0). В `updateQuestionProgress`: `correctStreak = isCorrect ? prev.correctStreak+1 : 0`. Ввести `MASTERY_STREAK = 2`. `getActiveMistakeIds` расширить/добавить `getUnmasteredMistakeIds`: `wrongCount>0 && correctStreak < MASTERY_STREAK`. Счётчик ошибок на Home/More и режим `?mistakes=1` использовать новую границу. В `getQuestionProgressMap` добавить чтение `correctStreak` (как остальные поля, с `Number.isFinite`).
- **MIRROR**: PROGRESS_UPDATE (additive-поле), существующие `getActiveMistakeIds`.
- **IMPORTS**: без новых.
- **GOTCHA**: Обратная совместимость — старые записи без `correctStreak` читать как 0 (см. `getQuestionProgressMap` cleaning на строках 52-58). Обновить `questionProgress.test.ts` под новое поле, не сломав существующие локи.
- **VALIDATE**: `npx vitest run src/lib/questionProgress.test.ts`; логика: ошибся → в банке; ответил верно 1 раз → ещё в банке; 2 раза → вышел.

### Task P7: Пейвол-по-глубине + 7-дневный триал (без оплаты)
- **ACTION**: Ввести тир доступа и гейтить глубину (полные объяснения, прогноз, «самые заваленные», безлимит экзаменов); ProCard → апселл-обёртка.
- **IMPLEMENT**: `src/lib/entitlement.ts`: ключи `licencia_ar_trial_started` (ISO, ставится при первом заходе), `licencia_ar_pro` (dev/QA-оверрайд "1"). `TRIAL_DAYS = 7`. `getAccessTier(): "pro" | "trial" | "free"` — pro если оверрайд; иначе trial если `now - trialStart < 7d`; иначе free. `getTrialDaysLeft()`. `startTrialIfNeeded()` (идемпотентно ставит trialStart). `useEntitlement()` (`src/hooks/useEntitlement.ts`) — реактивно отдаёт `{ tier, daysLeft, isPro }`. `src/components/ProGate.tsx`: `<ProGate feature="explanations" lang>{children}</ProGate>` — если `tier!=="free"` (trial/pro) рендерит children, иначе рендерит `<ProCard>`-апселл (переиспользовать существующий модал). Применить: полные объяснения (`whyCorrect_ru/commonMistake_ru/memoryHint_ru`) в `SessionResultScreen`/практике под ProGate; `keyRule_ru` — свободно. «Самые заваленные» (P1) и прогноз (P3) — под ProGate для free. Экзамены: free = 1/нед (счётчик по `exam_attempts_v1` за 7 дней), trial/pro = безлимит. `startTrialIfNeeded()` дёрнуть в `main.tsx` или в `RequireOnboarding`.
- **MIRROR**: MODAL (ProCard), STORAGE_REPOSITORY, custom-hook паттерн (`useDebounce`-форма из правил).
- **IMPORTS**: ProGate → `import { ProCard } from "./ProCard";` + `useEntitlement`.
- **GOTCHA**: **НИКАКОЙ реальной оплаты** — `pro` только через локальный оверрайд (кнопка в dev/localhost, как DEV-reset словаря). Гейт — презентационный (localStorage не защита от копирования, и это ок для учебного контента: цель — конверсия, не DRM). Не гейтить сами вопросы (ширину) — только глубину. Триал стартует один раз, не сбрасывается перезаходом.
- **VALIDATE**: `npx vitest run src/lib/entitlement.test.ts` (свежий → trial, daysLeft 7; +8 дней → free; оверрайд → pro); `run.bat` — free видит keyRule + апселл на полном объяснении; trial видит всё; счётчик экзаменов ограничивает free.

---

## Testing Strategy

### Unit Tests
| Test | Input | Expected Output | Edge? |
|---|---|---|---|
| examHistory.record | correct=34,total=40 | attempt pct=85 добавлен, массив ≤50 | да (обрезка на 50) |
| studyPlan.getDaysUntilExam | дата +9д | 9 | да (прошлое→0, null→null) |
| studyPlan.getDailyPlan | 100 остаток, 10 дней | target≈10 (кламп 10..40) | да (0 дней — без деления на 0) |
| readiness.getPassProbability | attempts [90,80,70] | взвешенный ~82, basis:"exams" | да (нет данных→none; только практика→practice) |
| questionProgress.correctStreak | wrong→correct→correct | streak 0→1→2, вышел из банка при 2 | да (старая запись без поля→0) |
| entitlement.getAccessTier | trialStart=now | "trial", daysLeft 7 | да (+8д→free; override→pro) |
| buildHardestQuestionIds | 3 вопроса разной wrong-rate | отсортированы по доле ошибок | да (мало данных→добор practice) |

### Edge Cases Checklist
- [ ] Пустой localStorage (новый пользователь) — все функции дают дефолты, не падают
- [ ] Дата экзамена в прошлом / отсутствует / 0 дней
- [ ] 0 пройденных вопросов (деление на ноль в точности/плане)
- [ ] Экзаменов нет — прогноз деградирует честно (basis)
- [ ] Старые записи прогресса без `correctStreak` — читаются как 0
- [ ] Триал истёк ровно на границе 7 дней
- [ ] Приватный режим/quota — storage-хелперы не бросают (уже покрыто `storage.ts` try/catch)

---

## Validation Commands

### Static Analysis
```bash
npx tsc --noEmit
```
EXPECT: пустой вывод (0 ошибок)

### Unit Tests (затронутые lib)
```bash
npx vitest run
```
EXPECT: все зелёные; существующие локи (questionProgress/vocabularyStatus/storage/buildSessionResult) не сломаны

### Build
```bash
npx vite build
```
EXPECT: успешная сборка, PWA-манифест генерируется

### Browser Validation
```bash
run.bat
```
EXPECT (обе темы + RU/ES, 320/375/desktop): режимы запускаются, план считается, прогноз в кольце, график рисуется, гейт показывает апселл на глубине, экзамен/практика проходятся, горизонтального скролла нет, консоль без ошибок

### Manual Validation
- [ ] Новый профиль → онбординг с датой → Home показывает «До экзамена N дней»
- [ ] Пройти мок-экзамен → `exam_attempts_v1` пополнился → прогноз и график обновились
- [ ] `/practice?hard=1` даёт самые заваленные; `/practice?weak=1` — слабую тему
- [ ] Free-тир: полное объяснение закрыто апселлом, keyRule виден; trial: всё открыто
- [ ] Механика не изменилась: confirmMode-пилюля, exam-таймер 45мин, practiceMode не залипает

---

## Acceptance Criteria
- [ ] Все фазы P0–P7 реализованы (или выбранное подмножество за сессию)
- [ ] `npx tsc --noEmit` чист; `npx vitest run` зелёный; `npx vite build` проходит
- [ ] Новые lib покрыты тестами по образцу `questionProgress.test.ts`
- [ ] Обе темы и оба языка (RU/ES) корректны; ноль новых `[data-theme]`-селекторов (только токены)
- [ ] Защищённая механика не тронута (кроме +1 строки записи истории в P0)
- [ ] Ни одно бесплатное действие не заблокировано (гейт только на глубине)

## Completion Checklist
- [ ] localStorage — только через `storage.ts`-хелперы, ключи-константы вверху файла
- [ ] Новые builder'ы — чистые функции формы `build*QuestionIds(questions)`
- [ ] i18n-ключи добавлены в ОБА блока ru/es
- [ ] Файлы с emoji/кириллицей (OnboardingPage, HomePage, PracticePage, i18n, styles) правлены Python-скриптом, не Edit-tool
- [ ] Никаких платёжных SDK/форм/внешних скриптов
- [ ] Новые CSS-модули — только токены, `@import` добавлен, лимит <800 строк
- [ ] `getReadinessLevel` и потоки хуков не переписаны

## Risks
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Правка `useExamSession` заденет таймер/поток | низк. | выс. | Ровно +1 строка записи истории; прогнать полный экзамен через run.bat |
| Прогноз «из воздуха» при отсутствии экзаменов | сред. | сред. | `basis`-пометка + честная деградация к практике; тест на none |
| Гейт заблокирует что-то бесплатное | низк. | выс. | Гейт только на глубине; чек-лист «ни одно бесплатное действие не закрыто» |
| Новые режимы через роуты сломают practiceMode | низк. | выс. | Только query-параметры, как существующие; не читать practiceMode из localStorage |
| Обратная несовместимость `correctStreak` | низк. | сред. | Чтение с `Number.isFinite`→0; тест на старую запись |
| Рост HomePage.tsx > лимита | сред. | низк. | Выносить сетку режимов/план в под-компоненты (`components/home/*`) |

## Notes
- Порядок катки: **P0 → P1 → P2 → P3 → (P4, P5, P6 параллельно) → P7**. P0 — фундамент для P3/P5.
- Быстрые победы «ощущения подготовки» с максимальным эффектом на усилие: **P1 (режимы) и P2 (план)** — начать с них.
- P7 монетизация: рекомендованная модель — free-триал 7 дней (всё) → разовый анлок (не месячная подписка: короткий жизненный цикл продукта). Реальная оплата — отдельная задача вне этого плана.
- `ProCard` (T20) уже стоит на Home и в More — станет surface для `ProGate`.
- После реализации обновить `docs/DESIGN_REVIEW_TASKS.md` и (в `AUTO/CLAUDE.md`) список localStorage-ключей новыми ключами.
