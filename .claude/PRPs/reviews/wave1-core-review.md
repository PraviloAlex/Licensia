# Code Review: Killer Features — Wave 1 (logic core)

**Reviewed**: 2026-07-22
**Mode**: Local (uncommitted)
**Decision**: APPROVE

## Summary
Логическое ядро Wave 1 (P0–P4, P6, P7) — чистое, иммутабельное, покрыто 39 тестами. Секретов/эмодзи/`console.log` нет, функции <50 строк, файлы <800, JSDoc на публичных API. Один MEDIUM (таймзонный off-by-one в дневном плане) починен в ходе ревью; два LOW приняты осознанно.

## Findings

### CRITICAL
None.

### HIGH
None.

### MEDIUM
- **`src/lib/studyPlan.ts` — `getDaysUntilExam` смешивал локальное `now` с UTC-компонентами даты** → off-by-one для UTC−3 (Аргентина) вечером. Это цифра «дней до экзамена», ключевая для эффекта срочности (P2). **FIXED**: сравнение по календарным компонентам (локальный день пользователя vs Y/M/D даты), `Date.UTC` только как стабильная база арифметики. Тест переведён на локально-календарный `now` для детерминизма по таймзонам.

### LOW (accepted)
- **`src/hooks/useEntitlement.ts`** — слушает `storage`-событие (межвкладочное); смена dev PRO-оверрайда в той же вкладке не хот-обновит UI без перезагрузки. Приемлемо для dev-инструмента; комментарий честно указывает «cross-tab».
- **`src/hooks/useExamSession.ts`** — `recordExamAttempt` наследует семантику записи из существующего `saveExamHistory` (тот же `useEffect`). Нового риска не вносит; при завершении экзамена срабатывает один раз.

## Validation Results
| Check | Result |
|---|---|
| Type check (`tsc --noEmit`) | Pass |
| Tests (`vitest run`) | Pass — 8 файлов, 39 тестов |
| Build (`vite build`) | Pass |
| Lint | Skipped (в проекте нет отдельного lint-скрипта; typecheck покрывает) |

## Files Reviewed
- `src/lib/examHistory.ts` — Added
- `src/lib/studyPlan.ts` — Added (fixed during review)
- `src/lib/readiness.ts` — Added
- `src/lib/entitlement.ts` — Added
- `src/hooks/useEntitlement.ts` — Added
- `src/lib/questionProgress.ts` — Modified (builders + correctStreak)
- `src/hooks/useExamSession.ts` — Modified (+1 line record)
- `src/lib/{examHistory,studyPlan,readiness,entitlement}.test.ts` — Added
- `src/lib/questionProgress.test.ts` — Modified (+5 tests)
