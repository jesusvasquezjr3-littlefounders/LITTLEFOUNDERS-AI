# Lane doc: Forge integration (coursegen)

The merge of the 18 Horizonte Forge packs into `coursegen/`, and the work that was needed so the merged tree emits, gates and tests all 64
Horizonte segment types. Pack procedure: [RECIPE.md](./RECIPE.md). Solvability: [F0.4-solvability.md](./F0.4-solvability.md).

| Item | Value |
|---|---|
| Area | `coursegen/` (Forge), v2 emitter, gates, fixtures |
| Pieces covered | every Horizonte pack: golden, num-a, num-b, balance, stats1, plane1, fin1, fin2, alg1, alg2, geom2, prob, com, sim1, sim2, solids, space1, space2 |
| Segment types added | 64 (golden 1, num-a 7, num-b 3, balance 2, stats1 5, plane1 8, fin1 3, fin2 3, alg1 3, alg2 3, geom2 4, prob 3, com 4, sim1 4, sim2 1, solids 3, space1 4, space2 3). Each is registered once, through its pack, in `horizonte/index.ts` |
| Status | Implemented and locally verified in the worktree. Not accepted, not released, not pushed |

## What the merged tree needed

The packs were built as neutral-payload kinds: the payload holds only ids, enums and numbers (identical in every market), and the learner
text lives in the prompt, the help ladder, the feedback banner, a `labels` record (payload id to localized name, 60 characters at most)
and, for algebra boards, a `notation` (neutral TeX plus a localized spoken form). The v2 emitter and gates of the day assumed that
every string sat inside the payload, so a Horizonte plan could not be written. The change keeps every existing kind byte-identical.

| File | Change |
|---|---|
| `src/v2/contract.ts` | `V2Segment` gains optional `labels` and `notation`. `hasNeutralPayload(type)` is built from `HORIZONTE_FORGE_CAPABILITIES`; it gates every exemption below without widening the global `isNonCopyKey` |
| `src/v2/plan.ts` | A plan segment may carry `notation: { tex }` (neutral). Only a Horizonte kind may; any other kind is refused at parse time. The copy schema documents `labels` and `notation.spokenText` |
| `src/v2/emit.ts` | For a neutral kind the payload is emitted as planned and `labels` and `notation` lift next to it (`horizonteExtras`). Any other copy key is a gate-1 problem. A notation needs its TeX and a spokenText in all three markets, or none. The "payload strings must come from copy" check skips neutral kinds |
| `src/v2/gates.ts` | Text blocks for a neutral kind are the prompt, help, feedback and each label (role option); the payload is not walked as copy |
| `src/v2/carriedGates.ts` | The carried gates read a neutral kind's visible text the same way (prompt, help, feedback, labels) |
| `src/v2/horizonte/num-b.ts` | Two `no-explicit-any` casts replaced by typed shapes (lint error reported by the com lane) |
| `src/v2/cli.ts` | `v2:emit --horizonte [--write-fixture]` runs the Horizonte plans and writes their own fixture file |
| `src/__tests__/v2Emit.test.ts` | Coverage is now the union of the two plan directories; a new block covers the Horizonte plans (see Tests) |
| `src/v2/fixtures/plans-horizonte/` | 37 new plans, `48-` to `84-`, one segment per Horizonte type (64 segments, 63 server-graded) |
| `src/v2/fixtures/emitted-horizonte.json` | 111 documents (37 lessons by 3 markets) emitted from those plans |

Hooks confirmed in place: `horizonteGuidanceFor` in `author.ts` (import L26, use L73), `horizontePieceGates` in `gates.ts` (import L53, call
L218), and `HORIZONTE_FORGE_CAPABILITIES` in `contract.ts` (L15 and L71). The three hand-mirrored capability maps are in parity
(`node agent/tools/check-v2-lesson-capability-parity.mjs`), and every `sync-v2-*.mjs --check` is green.

## Why the Horizonte plans live in their own directory

`v2Emit.test.ts` demands that the committed plans cover every segment kind of the contract, so 64 kinds needed plans. They are not in
`fixtures/plans/` because Core's interactive-behaviour gate (`checkV2Behaviour`, run by `npm --prefix backend run forge-v2:check` and by
`forge:v2:dry-run`) has no behaviour space for any Horizonte kind and fails closed on a graded segment of an unmodelled kind. Putting the
rows in the shared `emitted.json` turned Core red: `forge-v2:check` failed at 264 of 453 graded segments, and three backend suites that
read `emitted.json` failed (among them `v2SegmentFeedback`), as did `npm run test` there, whose first step is that check.

The split keeps both gates honest without touching Core or weakening a test: `emitted.json` and `fixtures/plans/` are byte-identical to
before (141 rows, 264 of 264 graded segments pass), and the Horizonte rows are validated by the same Core strict parser on demand:

```
npm --prefix coursegen run v2:emit -- --horizonte --write-fixture
npm --prefix backend run forge-v2:check -- ../coursegen/src/v2/fixtures/emitted-horizonte.json
```

Measured on the current rows: Core's strict contract accepts all 111 documents; the only failures are the 189 graded segments with
"no behaviour space defined for this kind" (0 of 189 pass, no other problem). To promote the Horizonte plans into the shared fixture, Core
needs a behaviour space (or an explicit, reviewed exemption) per kind first; then move the files into `fixtures/plans/` and refresh `emitted.json`.

## Solvability (gate 4, riding gate 1)

21 of the 64 types register an F0.4 checker (fin1 2, fin2 3, alg1 3, com 4, solids 3, space1 4, space2 2); `solvabilityPacks.ts`
imports each of those packs (an existing test enforces it). The other 43 types rely on the gate-4 function inside their own pack file.

New guard: `v2Emit.test.ts` corrupts the private key of every server-graded Horizonte segment three ways (add one, negate, triple) and
requires gate 1 or 4 to refuse at least one corruption for every kind. All 63 graded kinds do. This proves that a key is checked
against the payload, not that the instance is unique or free of dead ends; that proof exists only for the 21 registered types.

## Authoring and gate findings that shaped the fixtures

- Gate 19 (feedback): a graded step for ages 10 and up needs `feedback.met`, and feedback may not contain a digit the step does not show.
  The fixture feedback is therefore digit-free and written per pack in the three markets.
- Gate 16 (regional): pt-BR prices read `R$ N`, never `$N`, in titles and prompts.
- Gate 12 (tone): the word "job" is a never-use term, so the weekend pay lesson reads "Weekend pay".
- Gate 2 (vocabulary) needs the taxonomy, so every plan uses `course_id: financial-education` with a real pathway of that course.

## Tests

| Command | Result |
|---|---|
| `npm --prefix coursegen run type-check` | green |
| `npm --prefix coursegen run lint` | green |
| `npm --prefix coursegen run test` (capped at 3 threads and forks) | 80 files, 1220 tests, green. Includes `src/__tests__/horizonte` (281), `v2Emit` (44), `v2Solvability`, `v2CarriedGates`, `v2Release`, `releaseEvaluate`, `glossary`, the contract, gates and author suites |
| `npm --prefix backend run forge-v2:check` | OK, 141 rows, 264 of 264 graded segments pass |
| backend `forgeV2Emitted`, `forgeV2Behaviour`, `v2AgeScope`, `v2ChartModel`, `v2ConceptBoards`, `v2SegmentFeedback` (vitest, read only) | 45 of 45 pass |
| `forge:release-gates:check` and `forge:v2:dry-run` | Not run, by instruction. Read instead: the release-gate parity script compares gate numbers only (the pack gates all use gate 4), so no new type can trip it; the dry-run emits `fixtures/plans/` and checks it with Core, which is unchanged and green |

New `v2Emit.test.ts` block ("the committed Horizonte plans"): zero-spend emit of all 37 plans, equality with `emitted-horizonte.json`,
payload identical in the three markets and rubric private (only `labels` and `notation` may ride beside the base fields), labels and
spoken notation lifted per market with neutral TeX, the corrupted-key guard, and refusal of a notation on a non-Horizonte kind, a
notation without its spoken text, and stray copy in a neutral kind.

## Not verified, not accepted, not released

- Fixture copy is synthesized for the gates, not authored for learners: the feedback banners, the es-MX briefs and the pt-BR and es-MX
  renderings have had no native review, and the fixtures were produced by a script, not by a model call.
- `notation.spokenText` is not scanned by the tone or vocabulary gates (it matches how the existing notation fields are skipped).
- No Core behaviour space exists for any Horizonte kind; Core has not graded these documents in the behaviour gate (see above).
- The Horizonte rows were validated by Core's strict parser by hand, not by a backend test, and nothing in CI reads `emitted-horizonte.json`.
- `forge:release-gates:check` and `forge:v2:dry-run` were not run. The push gate has not run. No requirement row or sprint entry is closed.
- No live generation, publication or Vault write happened.

## Limits

- One segment per type per fixture: the plans prove that every kind emits and gates, not that a full lesson built from them is a good lesson.
- A neutral kind cannot take a string in its payload; a pack that needs a new localized field must route it through `labels` or `notation`.
- `labels` entries are 60 characters at most (Core's fin2 contract); `notation` TeX is 200 characters at most, spoken text 160.

## Owner follow-ups

- Decide how Core's behaviour gate treats Horizonte kinds: write a behaviour space per kind (sim1 and sim2 explain why seeded kinds are hard)
  or approve a named exemption. Until then keep `emitted-horizonte.json` out of the shared fixture.
- Run `forge:v2:dry-run` and `forge:release-gates:check` once, at the push gate, on the final tree.
- Have the pack lanes replace fixture copy with authored lessons, and have a native reader review es-MX and pt-BR.
- Decide whether the 43 types without an F0.4 checker need one (uniqueness, ambiguity, dead ends), starting with the puzzle-like boards:
  geoboard, tessellation, area-squares, transform, equation-balance, pan-balance.
