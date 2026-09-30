# Gap-fix round 7, learning lane (fix7learni3)

Branch `codex/spec-fix7learni3`. Status: **implemented and locally verified; not accepted.** No migration. No browser run in the lane (the orchestrator runs the UI audit and the full gates at the end).

## Gap 1: four graded boards bypassed the locale-aware number input

**The gap was real.** `BarModelBoard.tsx` (M7 answer), `SchemaDiagramBoard.tsx` (M8 answer), `CpaFadingBoard.tsx` (M1) and `FunctionMachineBoard.tsx` (M13 multiplier and offset) each used a raw `TextField` with `inputMode="numeric" pattern="[0-9]*"`. They accepted only `/^(0|[1-9]\d*)$/`, had no parsed echo, and silently disabled Check on `1,000` (en-US), `1.000` (pt-BR) or `15 `.

SPEC clauses:

- Frontend Bible 05 §5: a number input uses `inputmode="decimal"` and a locale-aware parser, and echoes the parsed value before submission.
- Appendix P Part 5, Number input row: `1.234` is ambiguous in pt-BR.
- Appendix P Part 8, Definition of Done: the board renders and grades correctly in all three locales.

What was built, and where:

- `frontend/src/rebuild/learning/segmentKit.tsx`
  - `readNumberAnswer(text, locale, domain)` is a pure function. It returns the canonical string, or the reason Check stays off: `empty`, `notNumber`, `wholeNumber`, `tooSmall` or `tooBig`.
  - `NumberAnswer` takes an optional domain (`whole`, `min`, `max`) and an optional controlled `value` / `onTextChange`, so a board's Reset can empty it.
  - A refused value shows its reason under the field (`aria-invalid`, described by the error). Check is never disabled silently.
  - The parsed value is echoed politely ("Reads as 1,000", "Se lee 1,000", "Lê-se 1.000").
- The four boards now render `NumberAnswer` and send Core the canonical string, as the other boards do.
  - Their domain is the canonical scorer's public bound: bar model ≤ 2 × the quantities' sum; schema ≤ a·b + a + b; CPA ≤ left + right; function machine multiplier 1..`multiplierMaximum`, offset 0..`offsetMaximum`.
  - The M8 story row and the M13 KaTeX rule show the parsed value.
- Copy: `player.wholeNumber`, `player.tooSmall` and `player.tooBig` in `rebuild-learn.json` (EN, es-MX, pt-BR), budgeted as `body` in `copy-budget/learn.test.ts`.

Design choice (conservative, no owner question): Core's scorer was **not** relaxed. Forge's interactive-behaviour gate (`backend/src/services/forgeV2Behaviour.ts`) requires out-of-range states to be refused, so the browser applies the same public bounds and says "Try a smaller number" rather than sending a request Core would refuse. For M1 this reveals only that the count is smaller than the typed number, never the count itself.

Tests: `frontend/src/rebuild/learning/numberAnswerBoards.test.tsx` (23 tests).

- The parser covers pt-BR `1.000` = 1000, en-US `1,000` = 1000, en-US `1.000` = 1, `15 ` = 15, and a refused `1,00`.
- The domain reasons are checked.
- A per-locale "reads as" echo is checked with `inputmode="decimal"`.
- Each of the four boards is tested in each locale:
  - it refuses out loud;
  - it echoes the value;
  - it sends the canonical value.
- The board bounds equal the canonical scorer's (`clientScorerVerdict`: valid at the bound, invalid past it).
- Static check: no learning board (including `operations/`) has an `inputMode="numeric"` or digits-only field. The only raw `TextField` left is the worked example's, which parses and echoes itself with `inputMode="decimal"`. Each of the four boards renders `<NumberAnswer`.

Also fixed: two stale expectations in `frontend/src/routes/app/learn/__tests__/LessonRoute.test.tsx` still asserted generic verdict lines that GAP-FIX-R6 retired ("That choice works.", "Try counting again."). They now assert the named feedback. Both tests were red before this lane.

## Gap 2: v2 authoring recorded no first-submission gate results

**The gap was real.** `authorV2Plan` (`coursegen/src/v2/author.ts`) overwrote the first draft's problems on each corrective round. `v2:author` wrote only the final plan. The per-gate first-submission pass rate therefore had no data for the catalog OD-17 and OD-24 make the only path for new lessons.

SPEC clauses:

- Appendix C Part 1.3, Forge Gate Pass Rate (per gate): first submission, tracked per gate, from Forge pipeline logs.
- OD-17 and OD-24.
- OD-23: zero spend in the dry run.

What was built, and where:

- `coursegen/src/v2/author.ts`
  - `V2AuthorResult.firstSubmission` holds one entry per market from round 1 only: `{ locale, evaluated, unparseable, failedGates }`.
  - `firstSubmissionOf` counts a problem without a market against every market, and a market's own problem only against that market.
  - An unparseable reply is `evaluated: false` with gate 1, never a pass of gates 2 to 19 (the v1 convention).
- `coursegen/src/pipeline/gateSubmissionLog.ts`
  - Entries carry an optional `pipeline` (`'v2'`; absent means v1, so old lines still read).
  - `firstSubmissionPassRates(entries, pipeline?)` filters by path and keys first submissions per path, slot and locale.
  - `formatFirstSubmissionPassRates` prints one per-gate line per path.
- `coursegen/src/v2/releaseCli.ts`
  - `v2:author` (dry run included) appends its first draft's gates per market with `slotId = lesson_id`, whether the draft ends blocked or fixed. It then prints the run directory's v2 per-gate rate.
  - The run directory is `runs/<id>/` with `--run-id`; otherwise it is the directory of `--out`, where the usage ledger lives.
  - A log write failure only warns.
- `coursegen/src/cli.ts` (`generate`'s run report) prints the v1 and v2 lines apart.
- Runbook: `docs/content/FORGE-V2-RELEASE.md` §1.

Tests:

- `coursegen/src/__tests__/v2Release.test.ts` (3 new):
  - a blocked-then-fixed draft keeps its round-1 gates;
  - an unparseable first reply records gate 1 and not evaluated;
  - `v2:author --dry-run` with a blocked-then-fixed responder writes three `pipeline: "v2"` lines to the run directory, the rate reads them, and the report line prints. A draft still blocked is logged too. No network is used.
- `coursegen/src/__tests__/gateSubmissionLog.test.ts` (1 new): v1 and v2 are rated and reported apart.

## Verified locally

- **Coursegen:** `type-check`, eslint on the touched files, and vitest `gateSubmissionLog` + `v2Release` (15/15).
- **Frontend:** `type-check`, eslint on the touched files, and the focused vitest files, all green:
  - `numberAnswerBoards` (23)
  - `boardReset`
  - `LessonDocumentView`
  - `generalPlayer`
  - `stageVerdict`
  - `namedFeedback`
  - `LearningQaSignals`
  - `pizarron/oneComponentSet`
  - `lessonDocument`
  - `copy-budget/learn`
  - `LessonRoute` (after the two stale expectations were fixed)
- **Root:** `spec:check` (exit 0), `secrets:check` and the i18n gate (`agent/tools/check-i18n.sh`).

## Open

- Browser matrices, the text-fit, proportion and copy-budget audits of the four boards' new error and echo lines, and device acceptance belong to the orchestrator's end-of-round run.
- Live per-gate pass-rate data needs owner-run paid `v2:author` batches (OD-23).
- Acceptance and native copy review of the three new strings.
