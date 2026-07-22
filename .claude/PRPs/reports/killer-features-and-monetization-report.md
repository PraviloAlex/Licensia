# Implementation Report: Killer Features & Monetization

## Summary
Реализована **Wave 1 — логическое ядро** плана (7 из 8 фаз в части чистой логики), полностью покрытое юнит-тестами. UI-интеграция и график эволюции (P5) вынесены в **Wave 2** (браузер-наблюдаемая часть, правки emoji-файлов) — см. Next Steps.

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

## Next Steps — Wave 2 (UI-интеграция, браузер-наблюдаемая)
- [ ] P1/P4: сетка именованных режимов на HomePage + провод `?hard=1`/`?weak=1` в PracticePage (по образцу `?mistakes`/`?subtopic`)
- [ ] P2: шаг «дата экзамена» в OnboardingPage (Python-правка) + план-баннер на Home
- [ ] P3: заменить подпись кольца на «Вероятность сдать» (Home + Progress), передать `getPassProbability()`
- [ ] P5: `EvolutionChart.tsx` (SVG) в ProgressPage
- [ ] P7: `ProGate.tsx` + гейт полных объяснений в SessionResultScreen; `startTrialIfNeeded()` в `main.tsx`; dev PRO-тумблер на localhost
- [ ] i18n-ключи (`prob.lvl.*`, `plan.*`, режимы, `pro.*` расширения) в оба блока ru/es
- [ ] Новые CSS-модули (23/24) + `@import`; браузер-проверка обеих тем через run.bat
- [ ] После Wave 2: обновить `docs/DESIGN_REVIEW_TASKS.md` и список localStorage-ключей в `AUTO/CLAUDE.md`

> План НЕ архивирован — реализована Wave 1. Wave 2 продолжает тот же план-файл.
> Рекомендация: `/code-review` или коммит логического ядра, затем Wave 2.
