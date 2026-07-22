# Implementation Report: Killer Features & Monetization

> **СТАТУС: ЗАВЕРШЁН (Wave 1 + Wave 2), 2026-07-22.** План закрыт и перенесён в
> `.claude/PRPs/plans/archive/killer-features-and-monetization.plan.md`.
> Все 8 фаз P0–P7 реализованы. Отложено осознанно: реальная оплата (вне скоупа плана).

## Summary
Реализована **Wave 1 — логическое ядро** плана (7 из 8 фаз в части чистой логики), полностью покрытое юнит-тестами. UI-интеграция и график эволюции (P5) выполнены в **Wave 2** (браузер-наблюдаемая часть, правки emoji-файлов) — см. раздел «Wave 2» ниже.

## Assessment vs Reality
| Metric | Predicted (Plan) | Actual (Wave 1) |
|---|---|---|
| Complexity | XL | XL — исполняется волнами; Wave 1 = Medium |
| Confidence | 8/10 | 9/10 для логики (всё зелёное с первого прогона) |
| Files Changed | ~22 (весь план) | 13 (Wave 1): 9 CREATE, 4 UPDATE |

## Tasks Completed (Wave 1 — логика)
| # | Task | Status | Notes |
|---|---|---|---|
| P0 | Серия попыток экзамена (`examHistory.ts` + провод в хук) | ✅ Complete | +1 строка `recordExamAttempt` в `useExamSession` рядом с `saveExamHistory`; механика не тронута |
| P1 | `buildHardestQuestionIds` («самые заваленные») | ✅ Complete | Ранжирование по wrong-rate, добор practice-миксом |
| P4 | `buildWeakTopicQuestionIds` + `getSubtopicAccuracy` | ✅ Complete | Таргетинг слабейших тем (<80% точности) |
| P6 | `correctStreak` + `getUnmasteredMistakeIds` (до мастерства) | ✅ Complete | Additive-поле, обратно совместимо (старые записи → streak 0) |
| P2 | `studyPlan.ts` (дата экзамена + дневной план) | ✅ Complete (logic) | Чистые функции (`now`/`total`/`seen` параметрами) — UI-шаг онбординга в Wave 2 |
| P3 | `readiness.ts` (`getPassProbability`) | ✅ Complete (logic) | Recency-weighted мок-история → честная деградация practice/none |
| P7 | `entitlement.ts` + `useEntitlement.ts` | ✅ Complete (logic) | Тир trial/free/pro, триал 7 дней, PRO только dev-оверрайд (без оплаты) |
| P5 | График эволюции (`EvolutionChart.tsx`) | ⏸ Wave 2 | UI-компонент, требует браузер-проверки |

## Validation Results
| Level | Status | Notes |
|---|---|---|
| Static Analysis (`tsc --noEmit`) | ✅ Pass | 0 ошибок |
| Unit Tests (`vitest run`) | ✅ Pass | 8 файлов, **39 тестов** зелёные (было 4 файла/добавлено 4 новых) |
| Build (`vite build`) | ✅ Pass | PWA генерируется, 0 ошибок |
| Integration (browser) | ⏸ N/A для Wave 1 | Логика не наблюдаема в UI; проверка в Wave 2 через run.bat |
| Edge Cases | ✅ Pass | Пустой storage, дата в прошлом/невалидная, 0 вопросов (без /0), нет экзаменов (basis), старые записи без поля, граница триала, cap 50 |

## Files Changed
| File | Action | Notes |
|---|---|---|
| `src/lib/examHistory.ts` | CREATED | P0 серия попыток |
| `src/lib/studyPlan.ts` | CREATED | P2 план от даты |
| `src/lib/readiness.ts` | CREATED | P3 прогноз сдачи |
| `src/lib/entitlement.ts` | CREATED | P7 тир доступа |
| `src/hooks/useEntitlement.ts` | CREATED | P7 реактивный тир |
| `src/lib/examHistory.test.ts` | CREATED | 4 теста |
| `src/lib/studyPlan.test.ts` | CREATED | 7 тестов |
| `src/lib/readiness.test.ts` | CREATED | 3 теста |
| `src/lib/entitlement.test.ts` | CREATED | 5 тестов |
| `src/lib/questionProgress.ts` | UPDATED | P1/P4/P6: correctStreak, MASTERY_STREAK, getUnmasteredMistakeIds, buildHardestQuestionIds, getSubtopicAccuracy, buildWeakTopicQuestionIds |
| `src/lib/questionProgress.test.ts` | UPDATED | sanitize-тест +correctStreak; +5 новых тестов |
| `src/hooks/useExamSession.ts` | UPDATED | +import, +1 строка recordExamAttempt (защищённый хук — только additive) |

## Deviations from Plan
- **studyPlan/readiness — чистые функции с параметрами вместо импорта `questionsData`.** WHY: держит lib свободной от тяжёлого импорта данных (1.29 МБ) → быстрые изолированные тесты; UI передаёт `questionsData.length`/`getUniqueSeenCount()` на месте вызова. Соответствует правилу «container передаёт данные presentational-слою».
- **Волновое исполнение.** WHY: план XL; логическое ядро отделено от UI-интеграции, чтобы дать зелёный проверяемый чекпойнт до правки emoji-файлов (HomePage/OnboardingPage/PracticePage) и браузер-верификации.

## Issues Encountered
- Существующий sanitize-тест `questionProgress.test.ts` делал `toEqual` по полной форме прогресса → добавление `correctStreak` его ломало. Обновлён (добавлен `correctStreak: 0`); остальные ассерты используют `toMatchObject`, не затронуты.

## Tests Written
| Test File | Tests | Coverage |
|---|---|---|
| `examHistory.test.ts` | 4 | запись/pct/cap50/санитайз/zero-total |
| `studyPlan.test.ts` | 7 | дни до экзамена (future/past/invalid/none), дневной план (клампы, /0) |
| `readiness.test.ts` | 3 | none / recency-weighted exams / practice-fallback |
| `entitlement.test.ts` | 5 | free-до-старта / trial-окно / истечение / no-restart / pro-override |
| `questionProgress.test.ts` | +5 | correctStreak, до-мастерства, hardest-ранжирование, subtopic-accuracy, weak-topic |

---

# Wave 2 — UI-интеграция (браузер-наблюдаемая часть)

## Tasks Completed (Wave 2)
| # | Task | Commit | Status | Notes |
|---|---|---|---|---|
| P7 | Старт триала на буте | `0f52d34` | ✅ | `startTrialIfNeeded()` в `main.tsx` под `typeof window` — идемпотентно, один раз на профиль |
| P3 | Прогноз сдачи вместо покрытия | `63f1f33` | ✅ | Кольцо на Home и в Progress кормится `getPassProbability()`; при `basis:"none"` подпись падает назад на старую «ещё N вопросов» — из воздуха процент не показывается |
| P2 | Дата экзамена + план-баннер | `6f0b28a` | ✅ | 5-й шаг онбординга: пресеты 1/2/4 недели + «пока не знаю» (не блокирует завершение); баннер `.hb-plan-banner` над hero рендерится только при заданной дате |
| — | Правка высот онбординга | `83e4127` | ✅ | Побочный фикс: выравнены высоты экранов после добавления 5-го шага + контраст feature-карточек |
| P1/P4 | Именованные режимы + `?hard=1`/`?weak=1` | `ed104cf` | ✅ | Сетка из 5 режимов на Home (Tabler-иконки); `usePracticeSession` получил `useHardest`/`useWeak`; персист-сессия не переиспользуется для этих режимов (как для `?mistakes`) |
| P5 | График эволюции мок-баллов | `07f8328` | ✅ | `EvolutionChart.tsx` (чистый SVG, токен-цвета, пунктир порога `EXAM_PASS_PERCENT`); секция скрыта при нуле попыток |
| P7 | Пейвол-по-глубине | `b8bf4e2` | ✅ | `ProGate.tsx` (portal-модал + Escape + фокус) закрывает «почему верно / типичная ошибка / мнемоника» в аккордеоне практики; `keyRule` и сам верный ответ остались бесплатными; dev-тумблер PRO в «Ещё» только на localhost |
| P6 | Банк ошибок до мастерства (провод) | `3cd693d` | ✅ | `getMistakeQuestionCount` и `buildMistakesPracticeQuestionIds` переведены с `getActiveMistakeIds` на `getUnmasteredMistakeIds` — счётчик и сессия ошибок теперь держат вопрос до 2 верных подряд |
| P7 | Недельный лимит экзаменов для free | `145ebfd` | ✅ | `countExamAttemptsSince(7) >= FREE_WEEKLY_EXAM_LIMIT` → кнопка старта экзамена оборачивается в `ProGate`; trial/pro — безлимит |

## Validation Results (Wave 2, финальный прогон 2026-07-22)
| Level | Status | Notes |
|---|---|---|
| Static Analysis (`npx tsc --noEmit`) | ✅ Pass | пустой вывод |
| Unit Tests (`npx vitest run`) | ✅ Pass | 8 файлов, 39 тестов зелёные |
| Browser (`run.bat`) | ✅ Pass | проверялось по ходу каждого коммита: обе темы, RU/ES, 320/375/desktop |

## Files Changed (Wave 2)
| File | Action | Notes |
|---|---|---|
| `src/components/ProGate.tsx` | CREATED | Гейт глубины: children для trial/pro, upsell-модал для free |
| `src/components/EvolutionChart.tsx` | CREATED | SVG-спарклайн мок-баллов + линия порога |
| `src/styles/23-exam-plan.css` | CREATED | План-баннер + шаг даты в онбординге |
| `src/styles/24-home-modes.css` | CREATED | Сетка режимов на главной |
| `src/styles/25-progress-evolution.css` | CREATED | Секция графика в Прогрессе |
| `src/styles/26-progate.css` | CREATED | Полоса-замок и модал гейта |
| `src/main.tsx` | UPDATED | `startTrialIfNeeded()` на буте |
| `src/pages/HomePage.tsx` | UPDATED | прогноз в кольце, план-баннер, сетка режимов |
| `src/pages/OnboardingPage.tsx` | UPDATED | шаг «дата экзамена» (5-й), пресеты |
| `src/pages/PracticePage.tsx` | UPDATED | `?hard=1`/`?weak=1`, ProGate на объяснениях, `examLocked` |
| `src/pages/ProgressPage.tsx` | UPDATED | прогноз в кольце + секция графика |
| `src/pages/MorePage.tsx` | UPDATED | dev-тумблер PRO (только localhost) |
| `src/components/practice/ExamStart.tsx` | UPDATED | `examLocked` → ProGate вокруг кнопки старта |
| `src/hooks/usePracticeSession.ts` | UPDATED | `useHardest`/`useWeak` в билдере сессии |
| `src/lib/entitlement.ts` | UPDATED | `FREE_WEEKLY_EXAM_LIMIT` |
| `src/lib/examHistory.ts` | UPDATED | `countExamAttemptsSince(days)` |
| `src/lib/questionProgress.ts` | UPDATED | P6-провод на `getUnmasteredMistakeIds` |
| `src/lib/i18n.ts` | UPDATED | новые ключи в оба блока ru/es (`home.mode.*`, `home.plan.*`, `home.prob.*`, `ob.date.*`, `progate.*`, `pv2.title.hard/weak`, `progress.evolution.title`) |
| `src/styles.css` | UPDATED | `@import` модулей 23–26 |
| `src/styles/04-*.css`, `src/styles/11-*.css` | UPDATED | выравнивание высот онбординга + контраст |

## Deviations from Plan (Wave 2)
- **Гейт объяснений стоит в аккордеоне PracticePage, а не в `SessionResultScreen`.** WHY: полные поля (`whyCorrect_ru`/`commonMistake_ru`/`memoryHint_ru`) читаются именно там, сразу после ответа — это точка, где глубина реально потребляется. `SessionResultScreen` не трогали, чтобы не задевать `buildSessionResult` (защищённый).
- **Прогноз (P3) НЕ спрятан под ProGate.** WHY: план допускал гейт, но прятать главную метрику мотивации у free-юзера бьёт по удержанию сильнее, чем даёт конверсии. Гейт оставлен на объяснениях и лимите экзаменов.
- **«Самые заваленные» (`?hard=1`) НЕ под гейтом.** WHY: та же причина — режим доступен всем, монетизация держится на глубине объяснений и лимите мок-экзаменов.
- **Шаг даты — пресеты вместо `<input type="date">`.** WHY: три тапа против клавиатурного датапикера на мобиле; «пока не знаю» явно записывает `null`.

## Acceptance Criteria — итог
- [x] Все фазы P0–P7 реализованы
- [x] `npx tsc --noEmit` чист; `npx vitest run` зелёный (39)
- [x] Новые lib покрыты тестами по образцу `questionProgress.test.ts`
- [x] Обе темы и оба языка; новые CSS-модули только на токенах, ноль новых `[data-theme]`
- [x] Защищённая механика не тронута (кроме +1 строки записи истории в P0)
- [x] Ни одно бесплатное действие не заблокировано — гейт только на глубине объяснений и на 2-м мок-экзамене в неделю для free

## Открытые хвосты (вне этого плана)
- Реальная оплата/анлок PRO — отдельная задача, платёжных SDK в коде нет.
- Тесты на Wave 2 — только логика (39 юнит-тестов); UI-регресс проверялся глазами через `run.bat`, автотестов на новые экраны нет.
- **Найдено и починено при закрытии плана:** `PROGRESS_KEYS_TO_CLEAR` в `ProgressPage.tsx` чистил `exam_history_v1`, но не новый `exam_attempts_v1` — после «Сбросить прогресс» кольцо прогноза и график эволюции продолжали жить на старых попытках. Ключ добавлен. Побочный эффект принят осознанно: полный сброс прогресса обнуляет и недельный лимит экзаменов — гейт по проекту презентационный (не DRM), а цена обхода (потеря всего прогресса) делает это непрактичным путём.
- Ключи триала (`licencia_ar_trial_started`, `licencia_ar_pro`) в сброс прогресса НЕ входят намеренно: триал — не учебный прогресс, перезапускать его сбросом нельзя.
