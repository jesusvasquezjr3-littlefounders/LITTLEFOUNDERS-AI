# S05: Forge content-pipeline gates

Status: in progress. Started 24 September 2026. Owner: Engineering for implementation; the Pedagogical Lead (Appendix C Stage 3 reviewer), Product and the brand owner for the threshold and lexicon reviews named below. Nothing here is accepted or released.

Parent record: [S05 Lesson Engine design](S05-LESSON-ENGINE-DESIGN.md). OD-17 still governs sequencing: these gates verify content, they do not authorize catalog regeneration or any paid generation (OD-23).

## Binding acceptance sources

- Product B.14 (Law 2 tone gate for authored lesson content **and** system/UI copy), B.18 (redundancy of on-screen text versus narration), and the Block B Pedagogical Design Standard.
- Owner decision OD-13 (Copy Budget: "Lesson prompts, options and Mentor turns get the same limits as a Forge content gate next to B.17 and B.18"), OD-11 glossary, OD-23 (zero spend).
- Appendix C Part 3 Stage 2 (gate order: concept cap, redundancy, tone, …; "a lesson failing any gate returns to Stage 1 with an itemized, specific failure report"), Part 2.1 Definition of Done ("Gated": the gate demonstrably blocks a deliberately non-compliant red-team lesson), Part 1.3 metrics (Forge Gate Pass Rate per gate; Threshold Recalibration Log).
- Appendix B §1.5 (Mayer's redundancy principle). `docs/product-audit/COSMIC_NARRATIVE.md` Law 2.
- Frontend Bible 06 (Copy Budget numbers, word/sentence definition, layering, §5.9 translations) and 08 §2/§5 (speech plate caption; "The Forge content gate for authored segments follows B.18 (no long on-screen text duplicating narration)").

## Point-by-point checkpoints

| ID | Scope | Product acceptance | Frontend acceptance | State |
|---|---|---|---|---|
| S05.4a | B.14 tone gate, B.18 redundancy gate, OD-13 Copy Budget content gate | Deterministic gates 11–13 inside Forge's `runAllGates` (write corrective retry, judge revision, localization re-gate, `verify:course` release attestation) and a zero-spend `content:gates` command over catalog YAML, the committed course corpus, run checkpoints, JSON documents and family-facing UI copy; wired into `release:readiness`; red-team sample per gate blocks; B.18 channel choice (`narration.mode`) added to the v1 contract and honoured by Echo | No new surface. Six family-facing UI strings that failed the tone gate were rewritten in EN/es-MX/pt-BR within the Copy Budget | In progress: implemented and locally verified; Stage 3 reviewer sign-off on lexicon/thresholds, content rewrite of the failing catalogs/corpus, live-pipeline metric data and acceptance pending |

## Verified current state (before this checkpoint)

The SPEC's "Current State" was checked against the code on 24 September 2026:

- **B.14 — confirmed.** `coursegen/src/pipeline/gates.ts` had ten deterministic gates (contract, age vocabulary, currency facts, arithmetic, rationale/canon, anti-genericity, generation quality, clarity, readability, plan fidelity) and none for tone. The SPEC's example string was live in `frontend/src/i18n/en-US/errors.json` (`ATTEMPTS_EXHAUSTED`: "No attempts left for this question."), with equivalents in es-MX and pt-BR; the kid banking screen also used bank framing ("Estado de cuenta", "Extrato", "View this month's statement").
- **B.18 — confirmed and structural.** Echo (`audiogen/src/narrate/extractNarratables.ts`) narrates the raw on-screen string of `prompt_md`, story bodies, choice roll-ups, hints and `explanation_md`. Every narrated block in a v1 document is therefore duplicated verbatim on screen by construction, and nothing measured its length. The v1 contract had no way to declare a different spoken script or a text-only segment.
- **OD-13 — not implemented in Forge.** The only text limit was gate 8's `prompt_md` ≤ 140 characters and ≤ 2 sentences (plus the 4,000-character contract maximum). No per-role word budgets, no 6–9 reduction, no ES/PT factor, no limit on options, story turns, feedback or titles, and nothing over the catalog.

## Implementation and rationale

All code lives in `coursegen/src/contentGates/` unless named otherwise.

### Shared measurement (`text.ts`, `budgets.ts`)

Word and sentence counting copy the Bible's reference tool expression for expression (`verification-tools/copy-budget-audit.reference.mjs`), so Forge measures a string exactly as the rendered-app audit will. Budgets come straight from Bible 06 §3.1: heading 6/1 sentence, prompt 20/2 (12 for ages 6–9), option 8/1 (5), Mentor turn 20/2 (12), body 12/2, and the §4 layered sheet (60 words) for text behind a tap; ES and PT ×1.25 rounded up.

The 6–9 limits apply when the kid register serves a tier whose lowest age is 9 or below (tier1 6–7 and tier2 8–10 both qualify, because tier2 still serves 8- and 9-year-olds); the adult register never does; unknown ages take the stricter reading. `GateContext.register` carries the register from `run.ts`.

### Lesson model (`lessonModel.ts`)

- **Screen blocks:** every string of a v1 document is classified into a copy role by its position in the contract (`classifyPath`). The classifier is total: a test walks every string field of all 56 segment schemas and fails when a new field has no role (the same pattern as the existing `NON_VISIBLE_KEYS` enum test). Answer-key strings are never copy, except the feedback prose shown after a check (`correction_md`, `fix_md`, `reveal_md`, `rationale_md`, dialogue `reactions`). Table headers and chart legends are `data` (Bible 06 §3.3, not counted).
- **Narration units:** an exact mirror of Echo's unit model (ids, fields, choice-type roll-up, story bodies), each unit linked to the block(s) it voices. Replaying the 186 recorded audio manifests of the committed corpus through this model gives zero drift, and `agent/tools/check-narration-parity.mjs` (`npm run narration:check`, self-tested by `tools:test`) fails when either copy changes alone.

### B.18 redundancy gate (gate 11, `redundancy.ts`)

Rule, taken from Frontend 08 §5: a narrated on-screen block may repeat its narration verbatim only while it is a **caption** — at most one Mentor turn (20 words and 2 sentences; 12 for ages 6–9; ×1.25 ES/PT). A longer block that "substantially duplicates" its narration fails. "Substantially" is measured, not judged: the share of the block's words inside runs of at least three consecutive words also found in the narration (the whole block for one- and two-word blocks), threshold 0.6.

The author has the three remedies the SPEC names, and the failure message states the applicable one:

1. **Differentiate** — `narration: {"mode": "differentiated", "script_md": "…"}`: Echo reads the script instead of `prompt_md`, which stays a short on-screen cue. A script that adds less than 20% new words over the cue is rejected as a false differentiation.
2. **Choose one channel** — `narration: {"mode": "text_only"}`: Echo narrates nothing for that segment.
3. **Shorten** the block to a caption.

There is deliberately no audio-only mode: Frontend 08 §5 keeps the caption on screen for accessibility and muted devices. The field was added to the v1 contract in both hand-mirrored copies (`frontend/src/lesson-engine/core/schemaBase.ts` and `coursegen/src/contract/core/schemaBase.ts`; `contract:check` stays green), to the frontend and Echo TypeScript mirrors, and Echo honours it (`extractNarratables.ts`, with two new tests). The legacy player ignores the field; it only changes what Echo narrates. Why the v1 contract: it is what Forge produces and Echo narrates today. The v2 lesson document has no narration channel yet; when it gains one, the same gate applies through a second adapter (open item).

### B.14 Law 2 tone gate (gate 12, `tone.ts`)

A per-locale lexicon in three categories — banking frame ("account balance", "insufficient funds", "estado de cuenta", "extrato"), hype and urgency ("get rich", "duplica tu dinero", "sem risco", "act now"), and resource-exhaustion wording ("no attempts left", "no quedan intentos", "não há mais tentativas") — matched at word boundaries on folded text (no accents, lower case).

Severity depends on the surface:

- **System/UI copy** is the product's own voice: every category blocks.
- **Lessons and catalogs** legitimately teach what a bank message or a scam looks like (the investing course has a whole fraud-radar adventure). Voiced hype and exhaustion wording block; banking vocabulary and everyday urgency ("tiempo limitado", "last chance") go to human review.

A blocking hit becomes a review item, and never a silent pass, when it is **quoted** ("…", “…”, «…», ‘…’, or straight single quotes used as quotes, never apostrophes), **negated** within four words ("no investment is ever risk-free"), **warned** (named as a warning sign within six words: "the signal of guaranteed profit", "frases como …"), or **examined** (the red_flags segment's artifact and flags, whose contract purpose is material the learner inspects). Review items are listed separately in every report for the Appendix C Stage 3 reviewer.

System/UI copy scanned: every `frontend/src/i18n/<locale>/*.json` except the staff console namespace (`admin.json`, internal tooling) and subtrees named `legal` (mandated disclosures, Bible 06 §3.3, reviewed by Legal under OD-10), plus every prose string literal in `frontend/src/rebuild/**` (scanned with all three lexicons because an inline literal does not declare its locale).

### OD-13 Copy Budget gate (gate 13, `copyBudget.ts`)

Every classified block is measured against its role budget for the document's locale and audience. The failure message carries the counts, the limit, the audience and the Bible 06 remedy for that role ("rewrite shorter, never truncate"). Catalog titles (heading) and descriptions (body) are measured too, per locale; `parent_check` is measured as a parent coaching tip (body, Bible 06 §6); author briefs (`concept`, `micro_objective`, `narrative_beat`, …) are tone-scanned but never budgeted because they are not rendered. A per-segment first-view total (title + prompt + options + the longest single turn against 40 words, 25 for ages 6–9) is reported as an **advisory** only, because the true first view depends on layout and the rendered-app audit is its authority.

### Where the gates run

| Boundary | Effect |
|---|---|
| `runAllGates` (gates 11–13 appended after gate 10) | The write stage's corrective retry tells the author exactly what to fix; the judge's revision and `author:validate` re-check it; `verify:course` fails a course whose documents do not pass, so Core's `release_course` preflight (which requires a fresh successful `verify:course` attestation) refuses to release it |
| `localizeLesson` | Gates 11–13 re-run on the translated document (per-locale lexicon and budget) and throw `LocalizeContentGateError` with itemized problems; per Bible 06 §5.9 the source is rewritten shorter, never truncated |
| Write prompt (`guidance.ts`) | The author is told the tier's exact budgets, the caption rule, the `narration` remedies and the Law 2 lexicon before drafting, generated from the same numbers the gates enforce (a rejected draft is a paid retry when generation runs live) |
| `npm run content:gates -- --course <slug>` | Zero-spend scan of the catalog, the committed corpus `database/seeds/<slug>-fixture.sql`, extra `--documents` (run checkpoint, JSON) and the UI copy; human-readable itemized report plus a JSON report under `coursegen/runs/content-gates/`; exit 1 on any blocking finding |
| `release:readiness` | Runs `narration:check` and `content:gates` for the course; any blocking finding fails the release check |

The JSON report is the Appendix C Part 1.3 **Forge Gate Pass Rate (per gate)** data point: the share of lesson documents passing each gate, tracked separately (a diagnostic metric by the appendix's own definition). Live pipeline logs will report it once generation runs again (owner-run, OD-23).

### Red-team samples (Appendix C DoD "Gated")

`coursegen/src/contentGates/fixtures/red-team/` holds one compliant lesson and one deliberately non-compliant lesson per gate. Each red-team lesson fails exactly its own gate through `runAllGates` and through `content:gates`; the compliant lesson (which uses a differentiated narration) passes all three.

### UI copy rewritten to pass the tone gate

| Key | Before (en-US / es-MX / pt-BR) | After |
|---|---|---|
| `errors.api.ATTEMPTS_EXHAUSTED` | "No attempts left for this question." / "No quedan intentos para esta pregunta." / "Não há mais tentativas para esta pergunta." | "That's it for this one. Let's keep going." / "Listo con esta. Sigamos adelante." / "Pronto com esta. Vamos em frente." |
| `common.banking.statement.title` | "Statement" / "Estado de cuenta" / "Extrato" | "Month summary" / "Resumen del mes" / "Resumo do mês" |
| `common.banking.statement.viewCta` | "View this month's statement" / "Ver el estado de cuenta de este mes" / "Ver o extrato deste mês" | "See this month" / "Ver este mes" / "Ver este mês" |

All six are within the Copy Budget (action ≤ 3 words, heading ≤ 6, body ≤ 12; ×1.25 ES/PT). Keys are unchanged, so i18n parity holds.

## Threshold Recalibration Log (Appendix C Part 1.3)

Every number below is a starting point, reviewed at least quarterly in the first year and whenever a review-queue sample shows a systematic false block or false pass. A change is recorded here with its date and evidence; the lexicon is part of this log.

| Threshold | Value | Source | Last reviewed |
|---|---|---|---|
| Copy Budget per role | Bible 06 §3.1 (heading 6, prompt 20/12, option 8/5, Mentor 20/12, body 12, layered sheet 60; ×1.25 ES/PT) | Owner-mandated (OD-13), grade D design judgement per Bible 06 §2 | 24 Sep 2026 (initial) |
| Young-audience rule | kid register and tier lowest age ≤ 9 | Bible 06 "ages 6–9"; conservative for tier2 (8–10) | 24 Sep 2026 (initial) |
| Caption limit (B.18) | the Mentor-turn budget | Frontend 08 §2/§5 | 24 Sep 2026 (initial) |
| Verbatim run length | 3 words | Engineering starting point | 24 Sep 2026 (initial) |
| Redundancy threshold | ≥ 60% of the block's words verbatim | Engineering starting point | 24 Sep 2026 (initial) |
| Differentiated-script repeat threshold | ≥ 80% of the script repeats the cue | Engineering starting point | 24 Sep 2026 (initial) |
| Tone negation window / warning-cue window | 4 words / 6 words | Calibrated on the four catalogs and the corpus (0 false blocks, see below) | 24 Sep 2026 (initial) |
| Tone lexicon | `TONE_LEXICON` in `tone.ts` (EN 51, es-MX 45, pt-BR 45 phrases) | Law 2 wording + B.14 example; single common words excluded by design | 24 Sep 2026 (initial) |

Lexicon calibration on 24 September 2026: the first draft blocked 58 catalog strings, all of them teaching or narrative uses (the fraud-radar adventure naming "ganancia garantizada" as a warning sign, quotes in straight single quotes, "tiempo limitado" as an ordinary constraint, "FOMO" as a taught concept). After adding straight-quote detection, the warning-cue rule, the everyday-urgency review tier and removing concept names, the same inputs produce 0 blocks and 57 review items, while every real UI violation and every red-team phrase still blocks.

## Baseline measurement (24 September 2026)

`npm run content:gates -- --course <slug>` (UI copy included) after this checkpoint:

| Course | Inputs | Blocking | Human review | Pass rate per gate (documents) |
|---|---|---|---|---|
| financial-education | 4,497 catalog strings | Copy Budget 233 (89 descriptions, 140 parent tips, 4 titles); tone 0 | tone 2 | no generated documents in the repository |
| entrepreneurship | 2,670 catalog strings | Copy Budget 330 (127 descriptions, 189 parent tips, 14 titles); tone 0 | tone 6 | no generated documents in the repository |
| investing | 2,670 catalog strings | Copy Budget 330 (137 descriptions, 182 parent tips, 11 titles); tone 0 | tone 49 | no generated documents in the repository |
| first-lemonade-stand | 439 catalog strings + 186 corpus documents (62 lessons × 3 locales) | Redundancy 375; Copy Budget 504 in lessons (224 body, 152 prompt, 80 option, 34 Mentor, 14 heading) + 34 catalog; tone 0 | tone 4 (red_flags scam artifact, examined) | redundancy 0/186 · tone 186/186 · Copy Budget 2/186 |
| System/UI copy | 6,396 strings | tone 0 (8 before the rewrite above) | 0 | — |

Reading: the legacy content was never written to these budgets, and v1 narration duplicates every narrated block by construction, so the release check now fails for every course until the content is rewritten. That is the intended effect of the gate, not a defect to silence. Rewriting the catalogs is authoring work (human, or AI-assisted under OD-23's owner-run rule); regenerating the corpus is the later Forge phase (OD-17).

## Verification log

Executed 24 September 2026 in the lane worktree (`C:/lf-wt/s05f`, branch `codex/spec-s05f`) with `VITEST_MAX_THREADS=3`. Local results only; no CI, database, network or model call.

| Boundary | Command / evidence | Result |
|---|---|---|
| Forge content gates, focused | `coursegen/`: `npx vitest run src/__tests__/contentGates.test.ts src/__tests__/contentGatesSources.test.ts` | 37 tests passed (text parity with the Bible tool, budgets, total classification over all 56 schemas, Echo mirror, each gate's red team and remedies, runAllGates integration, adult register, localization re-gate, seed parser incl. `E'…'` literals, corpus zero-drift, UI loader exclusions, repository UI copy clean) |
| Forge regression | `coursegen/`: `npm test` | 47 files, 699 tests passed (baseline before the checkpoint: 45 files, 662 tests; the existing suite stayed green with gates 11–13 in `runAllGates`) |
| Forge static checks | `coursegen/`: `npm run type-check`, `npm run lint`, `npm run contract:check` | Passed; contract copies identical (10 files) |
| Echo | `audiogen/`: `npm test`, `npm run type-check`, `npm run lint` | 17 files, 170 tests passed (2 new: text_only silent, differentiated reads the script); static checks passed |
| Narration parity | Root: `npm run narration:check`; `node --test agent/tools/check-narration-parity.test.mjs` | OK; 5 tests passed (green on the repo, red on a drifted choice type, a dropped story body, a renamed field and a dropped text_only rule) |
| Content gates, real inputs | `coursegen/`: `npm run content:gates -- --course <slug>` for all four courses; `--documents src/contentGates/fixtures/red-team --no-ui` | Exit 1 as expected for all four courses (numbers in the baseline table); red team: pass rate 3/4 per gate, each red-team lesson fails only its own gate |
| Lexicon calibration | Same runs before/after the context rules | 58 → 0 false blocks on catalogs; red-team and real UI violations still block |
| Frontend | `frontend/`: `npm run type-check`, `npm run lint`, `npm test` | Passed; 211 files, 2,189 tests passed (contract field and copy changes only) |
| i18n | Root (Git Bash): `bash agent/tools/check-i18n.sh` | All three phases OK |
| Repository gates | Root: `npm run spec:check`, `npm run secrets:check`, `npm run tools:test` | spec:check OK (113 headings, parity, tokens, assets); secrets OK; tools:test 61 passed, 0 failed |

## Remaining limitations and open items

- **Content is not yet compliant.** The four catalogs and the committed corpus fail (baseline table). Rewriting them is authoring work; nothing was regenerated or rewritten by this checkpoint, and no paid call was made.
- **Live-pipeline behaviour is unobserved.** Gates 11–13 now run inside the write corrective-retry loop and the localization re-gate; their effect on retry count and cost per lesson is unmeasured until an owner-run generation (OD-23). The write prompt states the budgets up front to keep retries rare.
- **Stage 3 review of the lexicon and thresholds** has not happened. Review items (57 on the current catalogs, 4 on the corpus) need a Pedagogical Reviewer; a false block found later is a recalibration entry above.
- **v2 lesson documents** carry no narration channel yet; when the v2 contract gains one, add a v2 adapter to `lessonModel.ts`. The rendered-app copy-budget audit remains the authority for v2 prompts and all first views.
- **Rebuild inline literals** are tone-scanned but not budgeted (their role is declared in the DOM via `data-copy-role`, which the rendered-app audit measures).
- **Legacy UI copy change** is verified by i18n parity and the frontend suite, not by a browser screenshot of the kid banking screen and the error toast (both are legacy surfaces the rebuild replaces).
- **Physical environments.** No real database, Echo run or CI run was involved; the Core release preflight's reliance on `verify:course` is unchanged code, verified by reading, not by a live release attempt.

## Owner questions and recorded proposals

1. **Roles beyond OD-13's list.** OD-13 names prompts, options and Mentor turns. This checkpoint also gates feedback (`explanation_md`, rationale, recap: body, 12/15 words), titles (heading, 6/8) and hints (layered sheet, 60/75), applying Bible 06 §3.1 and §4 to every string a lesson renders, and measures catalog descriptions and `parent_check` tips as body copy. Proposal: keep them blocking. Question: confirm, or restrict the blocking set to OD-13's three roles and report the rest as advisory.
2. **Tier2 (8–10) takes the 6–9 limits.** Proposal: keep the stricter reading until pathways (OD-16) split 8–9 from 10.
3. **Banking vocabulary in lessons is review, not block.** Proposal: keep; money lessons for teens teach what a bank message says.
