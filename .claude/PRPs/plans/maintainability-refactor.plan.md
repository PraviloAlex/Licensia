# Plan: Maintainability Refactor

## Summary
This plan raises code quality, scalability, and maintainability without changing product behavior or visual design. It focuses on four concrete improvements: split `PracticePage.tsx` into stable modules, migrate vocabulary persistence to the shared storage layer, reduce heavy data loading pressure, and add a minimal test foundation for the pure business logic.

## User Story
As a returning Licencia AR user, I want the app to keep the same practice, exam, vocabulary, and progress behavior, so that I can continue learning without disruption while the app becomes faster and more reliable.

## Problem -> Solution
Large page-level orchestration, duplicated storage code, a heavy data chunk, and no test runner -> modular hooks/components, shared storage helpers, staged async data loading, and unit tests around the existing domain logic.

## Metadata
- **Complexity**: Large
- **Source PRD**: N/A
- **PRD Phase**: N/A
- **Estimated Files**: 12-18

---

## UX Design

### Before
```text
User opens app
  -> same home/practice/exam/vocabulary screens
  -> first load pulls large route/data code
  -> behavior depends on several localStorage readers
```

### After
```text
User opens app
  -> same home/practice/exam/vocabulary screens
  -> route and data loading are lighter
  -> saved progress/word state uses one safer persistence pattern
```

### Interaction Changes
| Touchpoint | Before | After | Notes |
|---|---|---|---|
| Home screen | Opens dashboard and recommendations | Same UI and copy | No visual redesign |
| Practice mode | 20-question sessions, quick sessions, mistakes, topics | Same mechanics | Logic moves behind hooks/components |
| Exam mode | 40-question timed exam, Spanish-only mode, result summary | Same mechanics | Timer/session logic moves behind hook |
| Vocabulary | Known/repeat, SRS, daily review count | Same mechanics | Storage implementation becomes safer |
| First load | Smaller app chunk after route lazy loading, but data chunk remains large | Target further reduction by async data loading | Preserve PWA caching behavior |

---

## Mandatory Reading

| Priority | File | Lines | Why |
|---|---|---|---|
| P0 | `src/pages/PracticePage.tsx` | 159-290 | Current state layout, derived values, practice/exam result construction |
| P0 | `src/pages/PracticePage.tsx` | 347-508 | Timer effects, session mutation handlers, answer handlers |
| P0 | `src/lib/vocabularyStatus.ts` | 43-65 | Vocabulary storage versioning and reset behavior |
| P0 | `src/lib/vocabularyStatus.ts` | 80-123 | Known-clicks and cooldown storage patterns to replace |
| P0 | `src/lib/vocabularyStatus.ts` | 195-256 | Word status and SRS map readers/writers |
| P0 | `src/lib/vocabularyStatus.ts` | 370-455 | Known/repeat/remove mutation behavior that must not change |
| P0 | `src/lib/storage.ts` | 1-66 | Shared storage API to reuse |
| P0 | `src/lib/questionProgress.ts` | 42-90 | Sanitized progress reading and immutable progress update pattern |
| P0 | `src/lib/questionProgress.ts` | 151-184 | Practice, mistakes, and exam selection logic |
| P1 | `src/utils/buildSessionResult.ts` | 13-60 | Existing pure result builder pattern for unit tests |
| P1 | `src/screens/SessionResultScreen.tsx` | 19-120 | Existing extracted presentational screen pattern |
| P1 | `src/pages/HomePage.tsx` | 118-164 | Existing page-local read aggregation pattern |
| P1 | `src/lib/data.ts` | 1-17 | Current synchronous JSON imports and verified question filter |
| P1 | `vite.config.ts` | 43-90 | PWA runtime caching assumptions for JSON/images |
| P1 | `package.json` | all | Scripts and dependencies; no test runner currently exists |

## External Documentation

| Topic | Source | Key Takeaway |
|---|---|---|
| Vitest setup | https://vitest.dev/guide/ | Vitest is Vite-native and fits this Vite/TypeScript project for fast unit tests. |
| React lazy | https://react.dev/reference/react/lazy | `lazy` returns a component rendered under `Suspense`; load functions should resolve to a default component. |
| React code splitting | https://legacy.reactjs.org/docs/code-splitting.html | Dynamic `import()` plus `Suspense` is the established route/component splitting pattern. |

KEY_INSIGHT: Vitest can test pure TypeScript modules without adding browser component testing first.
APPLIES_TO: Initial test foundation for `storage`, `questionProgress`, `buildSessionResult`, and `vocabularyStatus`.
GOTCHA: Adding Vitest requires a dev dependency install and likely a `test` script; this project currently has no `test` command.

KEY_INSIGHT: React `lazy` expects a default export, or a `.then((module) => ({ default: module.NamedExport }))` adapter.
APPLIES_TO: Existing `App.tsx` route lazy-loading and any future component lazy-loading.
GOTCHA: Do not remove the named page exports unless all imports are updated.

---

## Unified Discovery Table

| Category | File:Lines | Pattern | Key Snippet |
|---|---|---|---|
| Similar implementation | `src/App.tsx:4-13` | Route-level lazy imports with named export adapters | `lazy(() => import("./pages/HomePage").then((module) => ({ default: module.HomePage })))` |
| Similar implementation | `src/screens/SessionResultScreen.tsx:19-39` | Extracted presentational component receives callbacks and data via props | `export function SessionResultScreen({ result, lang, onRetryMistakes... }: Props)` |
| Naming | `src/lib/questionProgress.ts:12-31` | `PascalCase` exported types, `camelCase` functions, constants in uppercase | `export type PracticeSession = { ... }` |
| Naming | `src/lib/storage.ts:41-66` | Generic storage helpers use `read*` / `write*` naming | `export function readJson<T>(key: string, fallback: T): T` |
| Error handling | `src/lib/storage.ts:5-26` | Storage errors are caught and converted to fallback/no-op behavior | `try { return window.localStorage.getItem(key); } catch { return null; }` |
| Error handling | `src/lib/questionProgress.ts:42-61` | Malformed persisted objects are sanitized field by field | `Number.isFinite(rec.seenCount) ? Number(rec.seenCount) : 0` |
| Logging | N/A | No application logging pattern found in affected paths | Do not add logging unless a specific failure path needs it |
| Types | `src/types/question.ts:22-38` | Verified question contract used across practice and stats | `export type VerifiedQuestion = { id: string; ... }` |
| Types | `src/types/sessionResult.ts:1-27` | Session result contract separates domain result from UI | `export type SessionResult = { mode: SessionMode; ... }` |
| Test patterns | N/A | No `*.test.*`, `*.spec.*`, `vitest.config.*`, or `jest.config.*` found | Add minimal test convention first |
| Configuration | `package.json:6-18` | Scripts are npm-based and use `npx` for Vite/TypeScript tools | `"build": "npx tsc --noEmit && npx vite build"` |
| Configuration | `vite.config.ts:43-90` | PWA caches JSON-like data/images and public assets | `runtimeCaching: [{ urlPattern: /\/src\/data\/.*\.json$/ ... }]` |
| Dependencies | `package.json:20-33` | Runtime deps are React, React DOM, React Router; build deps are Vite/TS/PWA | No test deps yet |

---

## Patterns to Mirror

### NAMING_CONVENTION
// SOURCE: `src/lib/questionProgress.ts:12-31`
```ts
export type QuestionProgressItem = {
  seenCount: number;
  correctCount: number;
  wrongCount: number;
  lastSeenAt: string;
  lastAnswerCorrect: boolean;
};

export type QuestionProgressMap = Record<string, QuestionProgressItem>;
```

Use exported `PascalCase` types and `camelCase` functions. Keep domain constants near the functions that use them.

### ERROR_HANDLING
// SOURCE: `src/lib/storage.ts:5-26`
```ts
export function readStorageString(key: string): string | null {
  if (!isBrowserStorageAvailable()) {
    return null;
  }

  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
```

Storage failures should not crash the app. Reads return fallback values; writes become no-ops when storage is unavailable.

### DATA_SANITIZATION
// SOURCE: `src/lib/questionProgress.ts:42-61`
```ts
const raw = readJson<Record<string, unknown>>(QUESTION_PROGRESS_KEY, {});
const cleaned: QuestionProgressMap = {};

for (const [id, value] of Object.entries(raw)) {
  if (!value || typeof value !== "object") {
    continue;
  }
}
```

Persisted state must be treated as untrusted. Parse as `unknown` or `Record<string, unknown>`, then build a clean result.

### IMMUTABLE_UPDATE
// SOURCE: `src/lib/questionProgress.ts:86-89`
```ts
saveQuestionProgressMap({
  ...map,
  [questionId]: next,
});
```

When changing maps, create new objects rather than mutating existing objects in place.

### PRESENTATIONAL_COMPONENT
// SOURCE: `src/screens/SessionResultScreen.tsx:7-29`
```ts
type Props = {
  result: SessionResult;
  lang: UILang;
  onRetryMistakes: () => void;
  onNewPractice: () => void;
};

export function SessionResultScreen({ result, lang, onRetryMistakes }: Props) {
```

Extract UI by passing data and callbacks through typed props. Do not let presentational components read `localStorage` directly.

### PURE_DOMAIN_FUNCTION
// SOURCE: `src/utils/buildSessionResult.ts:13-60`
```ts
export function buildSessionResult(params: {
  mode: SessionMode;
  answeredQuestions: AnsweredQuestion[];
  durationMinutes?: number;
}): SessionResult {
```

New domain logic should prefer pure functions with explicit inputs and outputs so it can be unit tested.

### ROUTE_LAZY_LOADING
// SOURCE: `src/App.tsx:4-13`
```ts
const PracticePage = lazy(() => import("./pages/PracticePage").then((module) => ({ default: module.PracticePage })));
```

Keep route splitting at the route boundary. Use named-export adapters unless changing exports across all pages.

### TEST_STRUCTURE
// SOURCE: no existing tests found
```text
Recommended new convention:
src/lib/questionProgress.test.ts
src/lib/vocabularyStatus.test.ts
src/lib/storage.test.ts
src/utils/buildSessionResult.test.ts
```

Use colocated `*.test.ts` files for pure logic first. Add component tests only after unit coverage exists.

---

## Strategic Design

- **Approach**: Refactor behavior-preserving internals in layers: tests first, storage cleanup, practice/exam hook extraction, UI component extraction, then data-loading improvements.
- **Alternatives Considered**:
  - Full rewrite of `PracticePage.tsx`: rejected because it risks changing mechanics and visual behavior.
  - Immediate data migration to backend/API: rejected because this is currently a static client/PWA app.
  - E2E-only validation: rejected because pure domain logic is the current safest and cheapest test target.
- **Scope**:
  - Add minimal Vitest test setup.
  - Add behavior locks around current logic.
  - Refactor `vocabularyStatus.ts` to use `storage.ts` and immutable updates.
  - Extract practice/exam orchestration from `PracticePage.tsx` into hooks and small components.
  - Further split data loading if it can be done without changing UI states.
- **NOT Building**:
  - No visual redesign.
  - No change to question selection rules.
  - No change to exam pass thresholds.
  - No migration away from `localStorage`.
  - No backend, authentication, or sync feature.
  - No change to saved storage keys or data compatibility.

---

## Files to Change

| File | Action | Justification |
|---|---|---|
| `package.json` | UPDATE | Add `test` script and Vitest dev dependency references |
| `vite.config.ts` or `vitest.config.ts` | UPDATE/CREATE | Configure Vitest without disturbing Vite/PWA build |
| `src/lib/storage.test.ts` | CREATE | Lock fallback/no-op storage behavior |
| `src/lib/questionProgress.test.ts` | CREATE | Lock session selection, progress update, and persisted session sanitization |
| `src/utils/buildSessionResult.test.ts` | CREATE | Lock result percentages, mistakes, weak topics |
| `src/lib/vocabularyStatus.test.ts` | CREATE | Lock known/repeat/SRS/current storage key behavior |
| `src/lib/vocabularyStatus.ts` | UPDATE | Replace duplicate storage logic and in-place mutations |
| `src/pages/PracticePage.tsx` | UPDATE | Reduce orchestration size by extracting hooks/components |
| `src/hooks/usePracticeSession.ts` | CREATE | Own practice session state and handlers |
| `src/hooks/useExamSession.ts` | CREATE | Own exam session state, timer, summary handling |
| `src/components/practice/QuestionCard.tsx` | CREATE | Present question/options/answer state |
| `src/components/practice/PracticeSettings.tsx` | CREATE | Present language/font/confirm settings |
| `src/components/practice/ExamStart.tsx` | CREATE | Present exam start surface |
| `src/lib/data.ts` or `src/lib/dataLoaders.ts` | UPDATE/CREATE | Stage async JSON/domain data loading if safe |

---

## Step-by-Step Tasks

### Task 1: Add Minimal Test Runner
- **ACTION**: Add Vitest as the project test runner.
- **IMPLEMENT**: Add `vitest` to dev dependencies, add `"test": "vitest run"` and `"test:watch": "vitest"` scripts. Prefer a separate `vitest.config.ts` if changing `vite.config.ts` would disturb PWA config.
- **MIRROR**: `package.json:6-18` script style uses npm scripts and `npx` for build tools.
- **IMPORTS**: None in production code.
- **GOTCHA**: Dependency install requires network/approval in this environment. Do not add React Testing Library yet unless component tests are included in the same change.
- **VALIDATE**: `npm run test` should run, even with only one starter test.

### Task 2: Lock Existing Pure Behavior
- **ACTION**: Add tests before refactoring logic.
- **IMPLEMENT**:
  - `buildSessionResult.test.ts`: empty session gives 0%, wrong answers become `mistakes`, weak topics sort by mistake count.
  - `questionProgress.test.ts`: invalid persisted progress is sanitized; `updateQuestionProgress` increments correct/wrong counts; practice/exam sizes remain unchanged.
  - `storage.test.ts`: malformed JSON returns fallback; string array reader filters non-strings.
- **MIRROR**: Pure function pattern in `src/utils/buildSessionResult.ts:13-60`.
- **IMPORTS**: `describe`, `it`, `expect`, `beforeEach`, `vi` from `vitest`.
- **GOTCHA**: Storage tests must mock or replace `window.localStorage`; keep tests isolated and clear storage before each test.
- **VALIDATE**: `npm run test` and `npm run typecheck`.

### Task 3: Refactor Vocabulary Storage Safely
- **ACTION**: Replace repeated `localStorage`/`JSON.parse` blocks in `vocabularyStatus.ts` with `storage.ts`.
- **IMPLEMENT**:
  - Import `readJson`, `writeJson`, `readStorageString`, `writeStorageString`, and `removeStorageItem`.
  - Convert `ensureVocabularyStorageVersion` and `resetVocabularyState` to use shared helpers.
  - Convert map readers: `getKnownClicksMap`, `getKnownLastCountedMap`, `getReviewAddedAtMap`, `getWordStatusMap`, `getReviewSrsMap`, `getKnownSessionsMap`.
  - Convert writers: `setKnownClicksMap`, `setKnownLastCountedMap`, `setWordStatusMap`, `setReviewSrsMap`, `setKnownSessionsMap`.
- **MIRROR**: `src/lib/storage.ts:41-60` and `src/lib/questionProgress.ts:42-61`.
- **IMPORTS**: `readJson`, `writeJson`, `readStorageString`, `writeStorageString`, `removeStorageItem` from `./storage`.
- **GOTCHA**: Preserve all existing storage keys exactly: `licencia_ar_word_status`, `licencia_ar_review_srs`, `licencia_ar_known_clicks`, etc. Do not bump `CURRENT_DATA_VERSION`.
- **VALIDATE**: Existing vocabulary tests pass; manually mark a word known/repeat and confirm daily review count still updates.

### Task 4: Remove In-Place Vocabulary Mutations
- **ACTION**: Replace direct map mutation with immutable updates while preserving exact behavior.
- **IMPLEMENT**:
  - Replace `clicks[wordId] = ...` with `setKnownClicksMap({ ...clicks, [wordId]: nextCount })`.
  - Replace `lastCounted[wordId] = nowMs()` with a new object.
  - Replace `delete srs[wordId]` with destructuring omission helper.
  - Update `upsertReviewWord` to return `{ ...srs, [wordId]: { ...current, ...partial } }`.
- **MIRROR**: `src/lib/questionProgress.ts:86-89`.
- **IMPORTS**: No new imports beyond Task 3.
- **GOTCHA**: `markWordKnown` computes `mastered` after updating clicks; keep the same count semantics.
- **VALIDATE**: `vocabularyStatus.test.ts`, `npm run typecheck`, manual vocabulary flow.

### Task 5: Extract Practice Session Hook
- **ACTION**: Move practice-only session state and handlers out of `PracticePage.tsx`.
- **IMPLEMENT**:
  - Create `src/hooks/usePracticeSession.ts`.
  - Move or wrap: `getInitialPracticeSession`, `startPracticeSession`, `handlePracticeAnswer`, `goNextPracticeQuestion`, `goToPracticeQuestion`, practice summary result construction.
  - Return state and callbacks needed by the page.
- **MIRROR**: Domain/session functions in `src/lib/questionProgress.ts:187-220`; presentational callbacks in `src/screens/SessionResultScreen.tsx:7-29`.
- **IMPORTS**: `useMemo`, `useState`, relevant functions from `../lib/questionProgress`, `../lib/data`, `../lib/glossaryLinkage`, `../lib/vocabularyStatus`.
- **GOTCHA**: Do not move JSX yet in this task. Keep the rendered page identical while moving logic.
- **VALIDATE**: Typecheck/build; manual practice: normal session, quick session, mistakes session, topic session, answer correct/wrong, previous-question navigation.

### Task 6: Extract Exam Session Hook
- **ACTION**: Move exam-only state, timer, history, and answer handling out of `PracticePage.tsx`.
- **IMPLEMENT**:
  - Create `src/hooks/useExamSession.ts`.
  - Move `examQuestionIds`, `examIndex`, `examAnswers`, `examSelAnswers`, `examStarted`, `examElapsed`, `examForceEnd`, timer effect, `handleStartExam`, `handleExamAnswer`, `exitExam`, summary result construction.
  - Keep exam-only Spanish behavior: `setLanguageMode("es")` without persisting.
- **MIRROR**: Current behavior in `src/pages/PracticePage.tsx:347-372` and `src/pages/PracticePage.tsx:410-498`.
- **IMPORTS**: `useEffect`, `useMemo`, `useRef`, `useState`, `buildExamQuestionIds`, `updateQuestionProgress`, `markExamCompletedToday`.
- **GOTCHA**: `showExamSummary` currently triggers history saving in an effect. Make sure it does not double-save on rerenders.
- **VALIDATE**: Manual exam: start exam, answer, timer advances, forced end at limit, summary saves once, exit returns home.

### Task 7: Extract Presentational Practice Components
- **ACTION**: Move repeated JSX sections into typed components.
- **IMPLEMENT**:
  - Create `QuestionCard`, `PracticeSettings`, and `ExamStart` components under `src/components/practice/`.
  - Components receive plain props; no storage reads inside components.
  - Keep class names unchanged to preserve styles.
- **MIRROR**: `src/screens/SessionResultScreen.tsx:19-120` typed props and callback style.
- **IMPORTS**: React types as needed, `Link` only in components that render links.
- **GOTCHA**: Do not rename CSS classes. Visual diffs should be zero or intentionally limited to loading transitions.
- **VALIDATE**: Build; browser-check practice/exam screens on mobile and desktop widths.

### Task 8: Stage Data Loading Improvements
- **ACTION**: Reduce the heavy `data-*.js` chunk without changing data semantics.
- **IMPLEMENT**:
  - First measure build output before changes and record current chunk sizes.
  - Create `src/lib/dataLoaders.ts` with async functions for questions/glossary/practical exam if JSON can be imported dynamically without breaking PWA behavior.
  - Update only route-level pages that need data to await/load their data locally.
  - Keep `questionsData` synchronous exports until all consumers are migrated, or provide a compatibility wrapper.
- **MIRROR**: Current verified filter in `src/lib/data.ts:9-14`; current route lazy pattern in `src/App.tsx:4-13`.
- **IMPORTS**: Dynamic `import("../data/questions.verified.json")` only if Vite build confirms correct chunks.
- **GOTCHA**: PWA config currently caches `/src/data/*.json`, but bundled JSON becomes JS chunks. Validate generated `dist` and service worker behavior after changes.
- **VALIDATE**: `npm run build`; compare chunk output; manually load home/practice/vocabulary/progress offline after first load if practical.

### Task 9: Final Regression Pass
- **ACTION**: Verify behavior is unchanged.
- **IMPLEMENT**: Run static/build/test commands and manual smoke flows.
- **MIRROR**: Existing validation style: `npm run typecheck`, `npm run build`.
- **IMPORTS**: None.
- **GOTCHA**: The repo already has unrelated dirty files. Do not revert or overwrite unrelated user changes.
- **VALIDATE**: All commands pass and manual checklist is complete.

---

## Testing Strategy

### Unit Tests

| Test | Input | Expected Output | Edge Case? |
|---|---|---|---|
| `readJson` malformed JSON | key contains `{bad` | fallback returned | Yes |
| `readStringArray` mixed array | `["a", 1, "b", null]` | `["a", "b"]` | Yes |
| `buildSessionResult` empty | no answered questions | 0 totals and 0% | Yes |
| `buildSessionResult` mistakes | 2 wrong questions with topics | mistake list and sorted weak topics | No |
| `updateQuestionProgress` first correct | no prior progress | seen=1, correct=1, wrong=0 | Yes |
| `getQuestionProgressMap` malformed records | missing/wrong fields | sanitized defaults | Yes |
| `markWordKnown` first click | empty vocabulary state | counted true, status known, review scheduled | No |
| `markWordKnown` cooldown | last counted today | counted false, count unchanged | Yes |
| `markWordRepeat` with click count | click count 2 | decrements to 1, schedules review | No |
| `removeWordFromReview` | SRS map contains word | word omitted from SRS map | No |

### Edge Cases Checklist
- [ ] Empty persisted storage
- [ ] Malformed JSON in storage
- [ ] Storage unavailable or throwing
- [ ] Unknown question id in session
- [ ] Empty questions array
- [ ] One-question session
- [ ] Exam timer reaches limit
- [ ] Repeat word with zero clicks
- [ ] Mastered word leaves review queue
- [ ] Existing legacy known sessions remain compatible

---

## Validation Commands

### Static Analysis
```bash
npm run typecheck
```
EXPECT: Zero type errors

### Unit Tests
```bash
npm run test
```
EXPECT: All unit tests pass

### Full Build
```bash
npm run build
```
EXPECT: Production build succeeds. Chunk output is recorded before and after data-loading changes.

### Browser Validation
```bash
npm run dev
```
EXPECT: App opens locally. User flows below work as designed.

### Manual Validation
- [ ] First launch/onboarding gate still works.
- [ ] Home dashboard opens and shows existing progress.
- [ ] Normal practice starts, answer selection works, correct/wrong feedback works.
- [ ] Wrong practice answer adds related words to review.
- [ ] Next question and previous-question navigation work.
- [ ] Quick practice starts with 5 questions.
- [ ] Mistakes practice uses active mistakes.
- [ ] Topic practice starts from selected topic.
- [ ] Exam starts in Spanish, timer runs, answers advance, result appears.
- [ ] Exam completion updates daily mission.
- [ ] Vocabulary known/repeat buttons preserve counts, cooldown, SRS due dates.
- [ ] Progress screen reflects answered questions and mistakes.
- [ ] No visual class names changed unintentionally.

---

## Acceptance Criteria
- [ ] All tasks completed.
- [ ] All validation commands pass.
- [ ] Tests written and passing for changed domain logic.
- [ ] No type errors.
- [ ] Build succeeds.
- [ ] Practice/exam/vocabulary behavior unchanged.
- [ ] Saved localStorage keys remain backward compatible.
- [ ] Initial app chunk and/or data loading pressure does not regress.

## Completion Checklist
- [ ] Code follows discovered naming and module patterns.
- [ ] Error handling matches storage fallback style.
- [ ] No new logging pattern introduced without need.
- [ ] Tests follow new colocated `*.test.ts` convention.
- [ ] No hardcoded new user-facing values.
- [ ] No unnecessary visual redesign.
- [ ] No unrelated dirty files reverted.
- [ ] Self-contained - implementation should not require more codebase searching.

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Practice/exam behavior changes during hook extraction | Medium | High | Add behavior tests first; extract logic without JSX changes first |
| Vocabulary storage compatibility breaks existing users | Medium | High | Preserve keys and data version; test legacy/malformed data |
| Async data loading breaks PWA/offline assumptions | Medium | Medium | Stage after core refactor; inspect `dist` and service worker output |
| Tests require dependency installation | High | Low | Request approval during implementation; keep initial test stack small |
| Existing dirty worktree causes confusing diffs | High | Medium | Touch only scoped files; do not restore unrelated changes |

## Notes
- This is a refactor plan, not a product feature plan. The user-facing promise is "same app, safer internals".
- `PracticePage.tsx` should be reduced incrementally. Avoid one giant move that combines hook extraction, JSX extraction, and visual edits.
- The most urgent code-health target is `vocabularyStatus.ts` because it holds persisted user learning state and still duplicates storage parsing.
- The most urgent maintainability target is `PracticePage.tsx` because it mixes route query parsing, settings, timers, answer logic, persistence, result construction, and JSX in one file.
- The most urgent performance target after route lazy loading is the generated `data-*.js` chunk.
