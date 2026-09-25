# S03: shared design system

Status: in progress. Started 24 September 2026. Owner: Engineering for implementation; the owner (or a named design reviewer) for the first-family asset style reviews required by Frontend Bible 07 §7; Product for copy review. No acceptance or release approval is recorded.

## Binding acceptance sources

- Owner decisions OD-1 (no lives), OD-4 (one design system, age by content), OD-6 (Tutor is the verified parent, the AI is the Mentor), OD-7 (closed celebration list), OD-13 (copy budget), OD-14 (own visual assets) and OD-15 (Mentor stage, legacy UI replaced) in `product/13-OWNER-DECISION-LOG.md`.
- Frontend Bible 02 in full (decisions D1–D13, mechanical rules 1–23, the token block, §4.4 separation, §7 Text Fit Contract, §8 targets, §9 controls and motion), 03 (proportion), 04 (motion), 06 (copy budget) and 07 (glyphs and own assets). The mockup is a visual reference only, minus `KNOWN-DEVIATIONS.md` (K40 copy, K41 icons and letter avatars).
- The verification tools in `frontend/verification-tools/`, adapted to the rebuilt app's driver.

Risk classification: **frontend foundation**. S03 owns no product requirement row (see `../REQUIREMENTS.md`); every rebuilt surface in S04–S09 is composed from it, so a defect here repeats everywhere.

## Point-by-point checkpoints

| ID | Scope | Product acceptance | Frontend acceptance | State |
|---|---|---|---|---|
| S03.1 | Foundation controls: the complete shared control set, generated tokens, the closed glyph list, the real-model-only Mentor avatar slot | Controls cannot express a lives counter, a celebration or a wrong answer in the error hue; no component owns copy; Mentor imagery is only a manifest render of the real model | Every Bible control in every variant/size/state; `data-copy-role` everywhere; tokens only; logical properties; focus rings; both modes; reduced motion; 48 px targets; 3 locales | In progress: implemented and locally verified (unit, static CSS contract, 96-configuration real-Chrome matrix, proportion audit, pure-refactor DOM proof); human design review, first-family avatar render approval and real-app composition pending |
| S03.2 | Overlays and focus | Destructive actions always confirm with a keep option first | Dialog, sheet and toast on `position: fixed` (02 rule 12), scrim and z-index order (02 §9.8), focus trap and return (02 §11 item 10), scroll preservation (rule 13) | Planned |
| S03.3 | Shared shells | Age changes content, never components (D8) | App shell and tab bar with the chosen Mentor's name and avatar, full-bleed single-state screen shell (02 §4.5), dashboard page, table-to-card collapse below 840 px (02 §9.8) | Planned |
| S03.4 | Own asset families | 07 §7 automated checks (token colours, no text, size budget, both modes, static frame) plus owner approval of the first asset of each family | Transparent Mentor avatar renders for all four characters, course and pocket icons, empty-state and badge art registered in the manifest | Planned |
| S03.5 | Real-app audit drivers | — | Text-fit, proportion and copy-budget audits driven through the real authenticated routes, not only the preview entry | Planned |
| S03.6 | Recomposition | — | Existing rebuilt surfaces (identity, privacy, social, family, memory, learning boards) moved onto the shared controls with their matrices re-run | Planned |
| S03.7 | Motion patterns | Celebration only for the OD-7 list via `milestones.ts` | Armed bump, one breathing CTA, milestone celebration with a static reduced-motion frame (04, 07 §5) | Planned |

## S03.1 current state (inspected 24 September 2026)

The SPEC's "current state" describes the legacy platform; the rebuilt foundation already existed in part and was inventoried directly:

- `rebuild/design/tokens.css` was generated from the Bible 02 YAML but carried only colours, spacing, radii and targets. Type steps, elevation, focus and motion tokens were hand-written in `system.css` (motion) or absent (type, elevation, focus). The `--check` mode was wired into `spec:check` only.
- `rebuild/design/controls.tsx` offered four pieces: `Copy`, `Button` (secondary, accent, success only; no sizes, no pending state), a `Field` whose error has no glyph (02 §9.8 requires icon plus text), and `StatusMark` (two hard-coded glyphs).
- Controls re-implemented ad hoc inside surfaces (none shared, several diverging from the Bible):

| Pattern | Where it is duplicated | Shared control that replaces it |
|---|---|---|
| −/+ stepper buttons (rounded squares, not the circle icon-action shape) | `learning/ParameterSlider`, `AllocationBoard`, `FractionAreaBoard`, `FractionNumberLineBoard`, `NumberLineBoard`, `learning.css` `.lf-learning-stepper` | `Stepper` |
| Native range sliders with local styling | `ParameterSlider`, `AllocationBoard`, `NumberLineBoard`, `FractionNumberLineBoard`, `StepReplay` | `Slider` |
| `aria-pressed` two-way toggles | `ScaleToggle`, `SchemaDiagramBoard`, `FunctionMachineBoard`, `TeachingChartBoard`/`FractionAreaBoard` view toggles | `SegmentedControl` (native radios, arrow keys, check mark) |
| Bare numeric inputs (one with a 1 px border, against 02 §4.4) | `CpaFadingBoard`, `FunctionMachineBoard`, `SchemaDiagramBoard`, `WorkedExampleBoard` | `TextField type="number"` |
| A `Button` with `role="switch"` | `privacy/AnalyticsChoice` | `Switch` |
| Loading / error / saving `role=status`/`alert` paragraphs | `AgeScreen`, `MentorCalibration`, `AnalyticsChoice`, `MemorySelfReview`, social and family panels | `LoadingState`, `ErrorState`, `InlineNotice`, `Button pending` |
| Feedback rows | `learning.css` `.lf-learning-feedback--*`, preview `.lf-feedback--*` | `Banner` |
| Progress capsule | `learning.css` `.lf-learning-progress` | `ProgressBar` |
| Preview answer rows | `preview/Preview.tsx` practice screen | `AnswerChoice` (moved in this checkpoint) |
| Undefined token | `learning.css` uses `--content-secondary`, which no token defines | Recorded for S03.6; not changed here because it would alter a surface |

Two legacy global classes, `lf-chip` and `lf-switch`, are used by the legacy application (`routes/app/learn`, `routes/app/banking`, `SignupPage`, `AdminRolesPage`, `PersonalizeInWorld`). A shared control reusing those names would be restyled by the legacy global stylesheet wherever both load, so the new controls use `lf-status-chip` and `lf-toggle`, and a contract test now fails on any future collision.

## S03.1 implementation and rationale

**Tokens.** `scripts/build-rebuild-tokens.mjs` now generates, from the Bible 02 YAML only: every type step as a `font` shorthand plus tracking (`--type-*`), including the display and numeral steps at the `app` container widths 640 and 1120 px from the YAML's own annotations (03 §3.2, fixed steps, no `clamp()`); the three elevation shadows (`--elevation-*`), which dark mode sets to `none` because "dark elevation is a lighter surface step, never a shadow" (02 §5); focus width, offset and colour (the colour stays a reference to `--primary-strong` so it follows the mode); the five duration and four easing tokens; and the press scale. The generator is now importable without side effects, its output is pinned by a unit test in addition to `spec:check`, and the same values are no longer hand-written anywhere else.

**Controls** (`rebuild/design/`, all exported from `controls.tsx`; no component owns a string, every caller passes translated, budgeted copy):

| Component | Bible source | States and behaviour |
|---|---|---|
| `Button`, `ButtonGroup` | 02 §3 `button-*`, §9.1, §9.5 role table | Ten colour roles (accent, brand, success, reward, sky, mint, berry, danger, secondary, inverse) × sm/md/lg (48/56/64 px floors) × enabled, disabled and pending. Pending stays focusable, sets `aria-busy`/`aria-disabled`, swaps to the pending label and refuses a second press or form submit. Groups wrap with `flex: 1 1 auto` (02 §7 rule 3). New roles apply only while enabled so the shared disabled treatment always wins. |
| `IconButton` | §3 `icon-button`, shape table (circle) | 48 px circle, secondary/soft/inverse, a required accessible name, a class-A glyph only |
| `Glyph` | 07 §2 | Closed in-house list of 19 glyph families (20 names; show/hide is one family) on the 24 px, 2 px-stroke spec, `currentColor`, always `aria-hidden`; a test caps it at 24 |
| `TextField` (text, email, number, date, search, tel, url, password), `SelectField`, `Checkbox` | §3 `input`, §4.4 exception 1, §9.8 | Visible label; help before the control; error directly under it with a glyph and words, `aria-invalid` and `aria-describedby`; focus is the inset 3 px ring plus the 5 px `primary-soft` halo from the token block; the password reveal is a named 48 px toggle that controls the input; number spinners are removed (the `Stepper` is the increment control); disabled states |
| `RadioGroup`, `SegmentedControl` | §3 `answer-idle-neutral`/`answer-selected`, shape table (rounded rectangle = choose one) | Native radios under a legend (arrow keys and form semantics for free); ring-and-dot mark; the selected segment also shows a check, so colour is never the only cue; focus ring on the whole option |
| `Switch` | §9.1, rule 6 | `role="switch"`; thumb position, a check in the thumb and a state word change together; pending and disabled; `edge` line on the off track only because a fill alone would be invisible (§4.4 exception 1) |
| `Slider`, `Stepper` | §8, 05 interaction contract | Native range input (pointer, touch and keyboard) with the value always written as text; stepper disables the matching button at each bound instead of clamping silently, announces the value politely |
| `Chip`, `RewardChip`, `ChoiceChip`, `ChipGroup`, `Pill` | §3 `chip-status`, `chip-reward`, §4.2 | Status chips always carry a glyph and a word; reward gold only for coins/XP; pick chips add a check when selected; pills exclude accent (reserved for the call to action); the inverse pill is the "Simulation" chip (white fill, `primary-ridge` text, 7.7:1) |
| `Card`, `List`, `ListRow` | §3 `card`, `identity-card`, §4.4 | Neutral cards separate by soft elevation (light) or surface step (dark); identity hues are solid fills with no line and require a heading; rows are 56 px, wrap their trailing slot before squeezing the title, and become one button with a chevron when pressable |
| `Banner`, `InlineNotice` | §3 `banner-*`, §9.2, §4.2 | Solid success / retry / error / info banners that name what happened, each with its glyph; `retry` (a wrong answer) is warning gold with a cross and can never use the error hue (a test enforces it); errors announce as alerts, the rest as status; inline notices are silent unless asked |
| `ProgressBar` | shape table (capsule = progress) | Labelled `progressbar` with a text value; drawn width clamped |
| `Skeleton`, `LoadingState`, `EmptyState`, `ErrorState` | §9.4, 07 §1 | Static skeleton lines with no shimmer (idle motion is budgeted to three things per screen, and a loading state is not one of them); loading is a status with words; empty and error states have a heading, an optional manifest-registered art slot, and a retry that holds a pending state; no blame copy is built in |
| `MentorAvatar` | rule 21, 07 §4 | Accepts only a manifest `render` of one of the four characters, whose `sourceModel` is that character's own `.glb`, with a pose, in a square slot; anything else leaves the slot empty with `data-refused` and no letter, glyph or look-alike fallback. Pose membership in the pose catalogue is enforced on the manifest itself by `scripts/check-rebuild-assets.mjs` (part of `spec:check` and every release build), because the rebuilt frontend may not import the legacy `tutor-scene` module outside the one authorised stage bridge |
| `AnswerChoice` | §3 `answer-idle`/`answer-selected` | The full-bleed lesson answer row, extracted from the preview without any change to its markup |

**Stylesheet** (`rebuild/design/controls.css`). Tokens only (no colour literal, no length other than the 2 px functional edge), logical properties only, no truncation or `clamp()`, no glass or gradient. Transitions exist only inside `@media (prefers-reduced-motion: no-preference)`, so reduced motion removes travel and keeps every state change (04 §3); presses scale to the `--press-scale` token with the standard easing and never the spring (D7). A forced-colours block restores functional edges where fills and shadows disappear. Selectors carry `.lf-rebuild`, so they outrank the root's element resets in `system.css` regardless of stylesheet order; the first-generation `.lf-button` base, accent, success, disabled and `.lf-field` rules are untouched.

**Preview catalogue** (`rebuild/preview/SystemGallery.tsx`, `/rebuild.html?screen=system`). Every control in every variant and state, in three locales and both modes, so the matrix can measure them. It is preview-only and not a product screen: every string meets its copy budget at the youngest band, but the first-view word total is deliberately not budgeted. Its 75 strings are in `i18n/*/rebuild.json` under `designSystem`, using the controlled glossary (coins/monedas/moedas, save/spend/share, approve/aprobar/aprovar, "Mentor" for the AI).

**Pure refactor of existing surfaces.** Only moves that leave every existing surface byte-identical were made: `Button` and `StatusMark` were re-implemented on the shared primitives with unchanged output for every existing call, and the preview practice screen's answer rows now use `AnswerChoice`. Everything else in the inventory above changes markup or appearance and is therefore scheduled for S03.6 with its own matrices, not done silently here.

**Proposals recorded for owner review** (conservative defaults implemented):

1. Loading placeholders are static (no shimmer), per the idle-motion budget in 02 §9.4.
2. A pending button swaps to its pending label and shows no spinner; a spinner would be an idle loop outside the budget.
3. Dark-mode elevation is `none` for every elevation token, per 02 §5; overlays in dark mode (S03.2) will separate by the `raised` surface step.
4. The avatar slot currently demonstrates the existing draft Dina square still, which includes the Diorama background. 02 §9.7 asks for transparent slots, so transparent avatar renders of all four characters are an S03.4 asset task that needs the owner's first-family style approval.
5. Generic date entry uses the native date input for accessibility; its displayed format follows the device's locale, not the page language (observed: an es-MX page on an en-US browser shows `09/24/2026`). The age screen keeps its three-field day/month/year pattern.

## Verification log

Executed 24 September 2026 in the S03 lane worktree. Commands are relative to `frontend/` unless noted; browser runs used `REBUILD_URL=http://localhost:5310` and the repository's headless-Chrome CDP harness. These are local results, not CI or production observations.

| Boundary | Command / evidence | Result |
|---|---|---|
| Design unit and contract tests | `npx vitest run src/rebuild/design` | 4 files, 54 tests passed: 29 component tests (markup identity with the pre-S03.1 `Button`/`StatusMark`/answer row, every colour role and size, pending refusal, glyph budget and spec, field label/help/error order and descriptions, password reveal, select, checkbox, radio, segmented check mark, switch state word and pending, slider text value, stepper bounds, chips, cards, rows, banner roles, notice silence, progress clamp, loading/empty/error states, avatar acceptance and four refusal cases), 18 static CSS contract tests (tokens only, logical properties, no truncation/glass/gradient, motion only under no-preference and never spring, only defined tokens, target floors, focus rings, every tone styled, retry never uses the error hue, no line on a filled component, no class-name collision with the legacy app, generated tokens match the Bible and carry type/elevation/focus/motion), plus the existing copy-budget contracts extended to the 75 catalogue strings in 3 locales |
| Frontend regression | `npm test` (3 threads/forks) | 213 files, 2,236 tests passed. The first run failed one existing gate, `designClasses.test.ts`: seven class hooks the new TSX referenced without a CSS definition; resolved by removing the unused modifiers and defining the used hooks, then green |
| Frontend static checks | `npm run type-check`, `npm run lint` | Passed (two strict-index errors in the new tests were fixed first) |
| Control matrix | `npm run verify:controls` | 96/96 configurations (3 locales × 2 themes × 320/375/768/1280 px × 1.0/1.4 text × normal/WCAG 1.4.12 spacing), 0 findings: no horizontal scroll, one `h1`, every string within its role budget, no truncation or text overflow, no text under 14 px, every text at 4.5:1 (3:1 large) against its real background, every target at least 48 × 48 px. Per locale and theme: a 40-stop keyboard walk with a visible ring at every stop, 16 pointer/keyboard interaction checks (field error with glyph and description, error clearing, password reveal/hide, switch, segmented arrow key, radio, checkbox via its label, stepper, pick chip, pending hold, retry pending, real-model avatar loaded, scroll kept on re-render, motion on, reduced motion zeroes transitions), axe-core WCAG 2.0/2.1/2.2 A/AA: 0 violations. 12 full-page captures in `audit-results/rebuild-controls/` |
| Control matrix iterations | same command | Run 1: 96 contrast hits, one per configuration, all on the label of a disabled checkbox (WCAG 1.4.3 exempts inactive components) — the driver's exemption now covers a disabled control's label; the focus walk counted a native date input's three segments as repeats — the driver now counts one stop per element. Visual inspection of the captures (es-MX light and pt-BR/en-US dark at 375 px, en-US light at 1280 px, read directly) found default `h3` margins inside cards and a pill stretched across a grid card; both fixed in `controls.css` and re-verified |
| Proportion audit | `REBUILD_PROPORTIONS_SCOPE=controls node scripts/verify-rebuild-proportions.mjs` | 24/24 configurations (3 locales × 2 themes × 4 widths), 0 findings (off-grid spacing, type scale, heading/body ratio, accent competition, tap gaps). The catalogue's large-button example was changed from accent to brand to keep at most three accents per view, and segments were spaced 8 px apart |
| Existing preview matrix (touched: `Button`, `StatusMark`, `AnswerChoice`) | `node scripts/verify-rebuild.mjs` | 288/288 configurations, 0 findings |
| Existing lesson matrix (uses `Button`, `StatusMark`) | `node scripts/verify-rebuild-lesson.mjs` | 384/384 configurations, 0 findings |
| Pure-refactor proof | Scratch CDP snapshot of 32 preview screens × (375 px light es-MX, 1280 px dark pt-BR), taken on the working tree and again after `git stash` of the tracked changes | 64/64 screens with identical `outerHTML`; 62/64 with identical per-element geometry and computed colour, background, font, shadow, radius, transition and outline; the 2 remaining differ only in the phase of the transport "opening" screen's infinite progress animation, a timing artefact |
| Asset gate | `node scripts/check-rebuild-assets.mjs`, plus a mutation (one render's pose set to `made.up` and its source model to another character) | Passes on the real manifest; the mutation fails with "not from the character's own model" and "pose is not in the pose catalogue" (exit 1); manifest restored |
| Binding authority and repository tools | Root: `npm run spec:check`, `npm run secrets:check`, `bash agent/tools/check-i18n.sh` (Git Bash) | Passed. `spec:check` first refused an import of the legacy pose catalogue into `rebuild/design/assets.ts`; the pose check moved to the manifest gate instead of widening the authorised bridge. i18n: key parity, hardcoded-string scan and t() keys OK |
| Database | — | Not touched; no migration |

Remaining limitations and open items:

- The catalogue runs on the isolated preview entry, which does not load the legacy global stylesheet. The class-collision test guards the known risk, but composition inside the real authenticated app is S03.5/S03.6 evidence.
- Chromium only; no Safari, Firefox, physical device or screen-reader pass (02 §12).
- No shared control has had human design review, and no asset is approved; the seven manifest assets remain drafts that block the release build by design.
- Overlays, focus trapping, shells, motion patterns and the recomposition of existing surfaces are later checkpoints (table above).
- Observed outside this lane's scope: the lesson transport "opening" screen runs an infinite progress animation, which counts against the three-item idle-motion budget in 02 §9.4. It is recorded here for the S05 owner, not changed.
