# Horizonte Visual: the pack recipe

How a lane adds a teaching visual to the Lesson Engine. Every pack owns its own folders in three layers, so
eighteen lanes can run in parallel without touching a hot file. The reference implementation is the **golden** pack
(F1.1, ten frame and double ten frame; see [golden.md](./golden.md)). Copy it, rename it, replace the maths.

Packs: `golden`, `num-a`, `num-b`, `balance`, `stats1`, `plane1`, `fin1`, `fin2`, `alg1`, `alg2`, `geom2`, `prob`,
`com`, `sim1`, `sim2`, `solids`, `space1`, `space2`.

## Binding rules (Appendix P, Bible 02, OD-32)

- V1 in-house SVG with a pure TypeScript model and scorer. V2 neutral board. V3 nothing decorative.
- V4 a tap and a keyboard alternative for every drag; a drag handle is at least 64 px. V5 no celebration inside a board.
- V6 SVG by default. The only 3D is the one lazy solids viewer of the `solids` pack (OD-32).
- At most 24 system glyphs. A table or text equivalent on every board. KaTeX with an author-written `spokenText`.
- Copy Budget: `data-copy-role` on every string; real native text in `en-US`, `es-MX` and `pt-BR`.
- Series hues are `--sky`, `--mint`, `--berry` and their `-strong`, `-soft`, `-ridge` variants. Motion is
  `--dur-component` (250 ms) with `--ease-standard`, no spring, and only inside `@media (prefers-reduced-motion: no-preference)`.
- No third-party iframe or SDK. One lazy chunk per board. Grading is server-authoritative; the browser copy is advisory.
- A client that meets an unknown segment type fails closed with "upgrade required". Every piece declares an age scope.
- Oracle's 14-field context is never widened. AR and camera for minors are default-off.

## The one rule that prevents merge conflicts

A lane edits **only files inside its own pack**. The shared files are already wired once and are not touched again:
`backend/src/services/horizonte/index.ts`, `v2LessonDocument.ts`, `frontend/.../horizonte/registry.tsx`,
`contract.ts`, `fixtures.ts`, `lessonDocument.ts`, `LessonDocumentView.tsx`, `coursegen/src/v2/horizonte/index.ts`,
`coursegen/src/v2/contract.ts`. Each pack is already registered in the aggregators with a type-correct empty stub.
If a pack really needs a new shared hook, say so in the pack doc and ask the skeleton owner; do not add it.

## Naming

| Thing | Pattern | Golden |
|---|---|---|
| Pack id | lowercase kebab | `golden` |
| Constant prefix | upper snake of the id | `GOLDEN`, `NUM_A` |
| Segment type | `<domain>.<piece>.v2`, one per distinct interaction | `math.ten-frame.v2` |
| Visual types | `visual: { type }` literals, kebab | `ten-frame`, `double-ten-frame` |
| Capability ids | `visual.<piece>.v1`, `operation.<verb>.v1` | `visual.ten-frame.v1`, `operation.drag-chips.v1`, `operation.tap-cells.v1` |
| Fixture ids | kebab, unique inside the pack | `make-ten`, `fill-first` |
| Preview screen | `?screen=fixture&seg=hz:<pack>:<fixture id>&age=<band>` | `hz:golden:make-ten` |

## Files per layer

### 1. Backend: `backend/src/services/horizonte/<pack>/`

| File | Holds |
|---|---|
| `capabilities.ts` | `export const <PACK>_CAPABILITIES = { '<type>': [...] } as const`, multi-line, one entry per segment type. Hand-assembled; held in parity across the three layers. |
| `model.ts` (optional, any pure file) | The pure model: types, constants, total predicates. No I/O, no clock, no randomness, no imports from `v2LessonDocument.ts`. |
| `contract.ts` | `<PACK>_SEGMENTS` (zod `.strict()` segment schemas built with `hzBase`, `hzServer`, `hzVisual`), `<PACK>_RUBRICS` (the private answer key, `.strict()`), `<PACK>_AGE_SCOPE` (`{ ages: [min, max], adult }` per type). |
| `scorer.ts` | `<PACK>_SCORERS[type] = { grade, sample }`. `grade(segment, response, rubric)` is pure and total and returns a `V2Grade`; `sample` returns a scorable response. |
| `fixtures.ts` | `<PACK>_FIXTURES: HorizonteFixture[]`: authored samples in three locales with the rubric and the ladder `invalid` / `valid` / `met`. |
| `index.ts` | The pack object `export const <camel> = { id, segments, capabilities, rubrics, ageScope, scorers } as const satisfies HorizontePack`. Already present. |

Verdict ladder: `invalid` is a response the rule refuses (wrong shape, outside the domain, malformed rubric);
`valid` is the untouched or advisory state and scores nothing; `review` is a well-formed wrong answer (score 0, diagnostic
`value`); `met` is the answer (score 100, diagnostic `none`). Without a rubric (the browser) a scorer may say only
`valid` or `invalid`, never `met`. The diagnostic set is closed: `none` and `value`.

The answer key never rides in the public payload. A rubric field name must not appear in the payload.

### 2. Frontend: `frontend/src/rebuild/learning/horizonte/<pack>/`

| File | Holds |
|---|---|
| `contract.generated.ts`, `model.generated.ts`, `scorer.generated.ts`, `fixtures.generated.ts` | Copies of the backend pure files. **Never edited by hand**; produced by `node agent/tools/sync-v2-horizonte.mjs`. The browser scorer is advisory preview only. |
| `capabilities.ts` | The same `<PACK>_CAPABILITIES` literal as the backend (parity-checked). |
| `index.ts` | The browser pack object (imports the generated files). Already present. |
| `copy.ts` | `export const <PACK>_COPY = { key: { role, 'en-US', 'es-MX', 'pt-BR' } } as const satisfies HorizonteCopy`. Imports only types (node type stripping reads it). |
| `boards.tsx` | `<PACK>_BOARDS = { '<type>': { board: lazy(() => import('./XBoard')), icap, chunkBudgetKb } }`. One `lazy` import per board; never import a board eagerly. |
| `XBoard.tsx`, `XBoard.css` | The board (default export, takes `HorizonteBoardProps`) and its styles. |
| `audit.json` | `[{ "fixture": "<id>", "age": "<band>" }]`, one entry per fixture, read by the audit lane. |
| `XBoard.test.tsx` | Board tests plus `assertBoardContract`. |

Shared pieces to use rather than rebuild: `BoardShell`, `GradedFoot`, `useSegmentGrade`, `useDragPlace`, `MoveToChoice`
(`learning/segmentKit.tsx`), `Button` and `ChoiceChip` (`design/controls`), `copyText` and `fillSlot` (`horizonte/copyText.ts`),
and the shared `horizonte.css` (the 64 px handle rule, the table styles, the loading placeholder).

A drag handle is wrapped: `<span className="lf-hz-handle" data-hz-handle="" data-hz-hit="64">`. A table or text
equivalent is marked `data-hz-table-toggle` (the button that opens it), `data-hz-table` or `data-hz-text-equivalent`.

### 3. Forge: `coursegen/src/v2/horizonte/<pack>.ts`

`<PACK>_CAPABILITIES` (same literal), `guidance` (`{ type, lines }[]`, appended to the authoring prompt when a
skeleton uses the type), and `gates` (a function `(document, answerKeys?) => GateProblem[]` run at gate 4, solvability:
the key is reachable from the public state, malformed starts are refused). The pack object ends
`as const satisfies ForgeHorizontePack`. Do not edit `solvability.ts`; the pack gate is the hook.

### 4. Tooling and docs

- `docs/rebuild/sprints/horizonte/<pack>.md`: the lane doc (catalogue rows, ages, ICAP, answer shape, decisions, known issues).
- Tests: backend and Forge tests in `src/__tests__/horizonte/<pack>*.test.ts`; frontend tests next to the board.

## Registration: what a lane does, step by step

1. **Segment type.** In `backend/.../<pack>/contract.ts` add the zod schema to `<PACK>_SEGMENTS`, the rubric to
   `<PACK>_RUBRICS`, the age scope to `<PACK>_AGE_SCOPE`. Core's union, `rubricByKind` and the age check already spread the pack.
2. **Capability literal.** Add the type with its capabilities to `<PACK>_CAPABILITIES` in the backend `capabilities.ts`,
   the browser `capabilities.ts` and `coursegen/src/v2/horizonte/<pack>.ts`. Keep the literal multi-line and in the same form
   in all three; `node agent/tools/check-v2-lesson-capability-parity.mjs` compares them.
3. **Scorer.** Add `<PACK>_SCORERS[type] = { grade, sample }` in `scorer.ts`. Core's grading dispatch looks it up through
   `horizonteGrade`; publish-time key checks use `horizonteSampleVerdict`.
4. **Board.** Add the lazy entry to `<PACK>_BOARDS` in the browser `boards.tsx` with a declared `icap` and a `chunkBudgetKb`.
   `LessonDocumentView` reaches it through `registry.tsx`; a type with no board never renders and shows upgrade required.
5. **Copy.** Add keys to the pack `copy.ts` with a role and three native strings. Read them with
   `copyText(<PACK>_COPY, document.locale)`. Put `data-copy-role` on the element that holds the string.
6. **Forge guidance.** Add `{ type, lines }` to the pack `guidance` and the gate-4 checks to `gates`.
7. **Fixture.** Add a `HorizonteFixture` in the backend `fixtures.ts` and an entry in `audit.json`. Run the sync tool.
8. **Sync.** `node agent/tools/sync-v2-horizonte.mjs` writes the `*.generated.ts` files; `--check` fails on drift.

## Tests and the two harnesses

Backend, in `backend/src/__tests__/horizonte/<pack>.test.ts`:

```ts
import { assertScorerContract } from '../../services/horizonte/harness/scorerContract.js';
assertScorerContract(pack, FIXTURES);
```

`assertScorerContract(pack, fixtures)` checks, for every type: a segment schema, a rubric schema, a scorer and a **declared age
scope**; fixtures that parse in three locales with equal payloads; the ladder `invalid` then `valid` then `met` is reachable;
the **sample response** is scorable; the scorer is **pure and deterministic** (deep-frozen inputs, equal results twice); it is
total (garbage and a malformed rubric give `invalid`, never a throw or `met`); an advisory run without a rubric is never
`met`; no rubric field leaks into the public payload.

Frontend, in `<pack>/XBoard.test.tsx`. The board renders the tutor stage, so mock it exactly as `boardReset.test.tsx` does:

```tsx
vi.mock('../../../../tutor-scene/quality', () => ({
  getDeviceProbe: () => ({ cores: 8, memoryGb: 8, coarsePointer: false, devicePixelRatio: 1, webgl: 'webgl2', maxTextureSize: 8192, prefersReducedMotion: false }),
  pickInitialTier: () => 'medium',
}));
vi.mock('../../../../tutor-scene/TutorStage', () => ({ TutorStage: () => <div data-testid="tutor-stage" /> }));

await assertBoardContract({ pack: '<pack>', fixtureId: '<fixture>', copy: <PACK>_COPY, css: ['<pack>/XBoard.css'] });
```

`assertBoardContract` (in `horizonte/harness/boardContract.tsx`) renders the fixture through the real `LessonDocumentView` in three
locales and checks: **keyboard-operable** (every interactive element focusable and named, no native HTML5 drag);
**handle hit area at least 64 px** (every `data-hz-handle` declares it and `horizonte.css` sizes `.lf-hz-handle` from
`--hz-hit: 64px`) with a Move to menu beside the handles; a **table or text equivalent** that opens; **reduced motion**
(every `transition` or `animation` in the listed CSS sits inside `no-preference`, at most 250 ms, no spring or bezier);
a declared **ICAP level**; a declared **chunk budget** (whole KB, 1 to 60); and **`data-copy-role` on every string**, within the
Copy Budget at the fixture's age. jsdom has no layout, so hit size is a declared attribute plus the CSS rule, not a measurement.

Also write the behaviour tests of your own board: the tap path, the keyboard path, the table, the grade call with the exact
answer shape, and three locales. `horizonte/harness/fixtureCoverage.test.tsx` already checks that every fixture has an
audit entry and loads as a valid lesson in three locales; it runs for your pack without edits.

Run targeted checks only:

```
VITEST_MAX_THREADS=3 VITEST_MAX_FORKS=3 npx vitest run src/__tests__/horizonte          # backend, from backend/
VITEST_MAX_THREADS=3 VITEST_MAX_FORKS=3 npx vitest run src/__tests__/horizonte          # coursegen, from coursegen/
VITE_CACHE_DIR=<lane cache> VITEST_MAX_THREADS=3 VITEST_MAX_FORKS=3 npx vitest run src/rebuild/learning/horizonte/<pack>
node agent/tools/sync-v2-horizonte.mjs --check
node agent/tools/check-v2-lesson-capability-parity.mjs
node agent/tools/check-horizonte-copy.mjs
npm --prefix backend run type-check     # once per touched service, near the end
```

Never run an install. Never run the aggregate gates (`test:all`, `verify:*`, `audit:*`); the coordinator does at the push gate.

## Bundle size

The Appendix P budget is a widget runtime plus one lesson under about **150 to 200 KB gzipped**. Horizonte keeps to it by loading
nothing until a segment is on screen:

- Each board is its own `React.lazy` chunk. The registry holds only the lazy handle and the declared budget; no board, model,
  fixture or CSS of an off-screen piece reaches the player bundle. Fixtures are imported only by preview, audit and tests.
- A board's declared `chunkBudgetKb` is the gzipped size of its own chunk, shared code excluded. Default budget 12 KB, hard
  ceiling 60 KB (the harness enforces the range). A piece that needs more (KaTeX, d3-geo) loads that module lazily too.
- Whole pack at rest: the `*.generated.ts` scorers and contracts are small pure code (a few KB per pack); the player pays for
  them once because they validate the document. Keep models free of large tables.
- The one 3D viewer (`solids`) reuses the tutor-scene canvas, adaptive quality and the Mentor budget (OD-32); it is a separate
  lazy chunk and never loads for a flat piece.
- Measure with `npm --prefix frontend run build` and read the chunk sizes; record the figure in the pack doc.

## Merge rules

- `*.generated.ts` files are never hand-merged. After any merge or rebase touching a backend pack file, run
  `node agent/tools/sync-v2-horizonte.mjs` and commit the result; `--check` is part of `spec:check` and the frontend `prebuild`.
- The three capability literals are compared by the parity script. If two lanes edit different packs there is nothing to merge.
- A pack never edits another pack, a shared aggregator, `lessonDocument.ts`, `LessonDocumentView.tsx` or the shared harness.
- Do not re-run the skeleton generator; it would overwrite finished packs. The golden pack is the template; copy it.
- `docs/rebuild/SPRINTS.md` and `REQUIREMENTS.md` are updated by the coordinator at the push gate, not by a lane.

## Definition of done (every piece)

- [ ] Segment schema, rubric, age scope, scorer, sample response and fixtures exist in the backend pack; types are strict.
- [ ] `assertScorerContract` passes; the age scope is declared (ages and adult).
- [ ] The capability literal is identical in Core, browser and Forge; parity script green.
- [ ] `sync-v2-horizonte.mjs --check` is green; no generated file was edited by hand.
- [ ] The board is a lazy chunk with a declared ICAP level and `chunkBudgetKb`; nothing imports it eagerly.
- [ ] `assertBoardContract` passes in three locales: keyboard path, 64 px handles with Move to, table or text equivalent,
      reduced motion, data-copy-role on every string.
- [ ] Copy is real and native in `en-US`, `es-MX`, `pt-BR` and within the Copy Budget; `check-horizonte-copy.mjs` is green.
- [ ] Nothing decorative; series hues only through `--sky`, `--mint`, `--berry`; no celebration inside the board.
- [ ] The grade call submits the semantic answer shape, never a score; Core holds the key; unknown types fail closed.
- [ ] The Forge pack has guidance and a gate-4 check that refuses an unsolvable key.
- [ ] `audit.json` lists every fixture; the preview screen `hz:<pack>:<fixture>` renders.
- [ ] The pack doc names the catalogue rows, ages, ICAP, answer shape, decisions and known issues.
- [ ] One `type-check` per touched service passed, plus the focused tests above.
