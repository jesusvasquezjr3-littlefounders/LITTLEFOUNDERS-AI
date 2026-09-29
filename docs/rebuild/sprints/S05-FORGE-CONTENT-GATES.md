# S05: Forge content-pipeline gates

Status: in progress. Started 24 September 2026. Checkpoints S05.4a (B.14, B.18, OD-13), S05.4b (B.17, B.11, B.16) and S05.4c (Appendix C pipeline integration, G.2 release preflight, OD-23 runbook, lane review). Owner: Engineering for implementation; the Pedagogical Lead (Appendix C Stage 3 reviewer), Product and the brand owner for the threshold and lexicon reviews named below. Nothing here is accepted or released.

Parent record: [S05 Lesson Engine design](S05-LESSON-ENGINE-DESIGN.md). OD-17 still governs sequencing: these gates verify content, they do not authorize catalog regeneration or any paid generation (OD-23).

## Binding acceptance sources

- Product B.14 (Law 2 tone gate for authored lesson content **and** system/UI copy), B.18 (redundancy of on-screen text versus narration), and the Block B Pedagogical Design Standard.
- S05.4b: Product B.17 (deterministic concept-cap gate, ceilings 2–3 / 3–4 / 4–6 by age band, "split, not shipped as authored"), B.11 (at least one mentor misjudgment-and-recovery episode per course, flagged for content-team validation, same no-shame framing as learner mistakes), B.16 (a named Regional Adaptation Gate with a per-market checklist, owned by the content/learning-design team, adapting examples, amounts and context per market). Appendix B §1.2 (working-memory capacity by age). Appendix C Part 1 metrics (Forge Gate Pass Rate per gate, Mentor-Misjudgment Content Coverage, Threshold Recalibration Log), Part 3 Stage 2 gates 1 (concept cap) and 6 (regional adaptation) and Stage 3 ("does mentor content in this lesson show real fallibility where required (B.11)?"). Owner log §8 (the B.17 ceilings apply as written). `docs/product-audit/COSMIC_NARRATIVE.md` §1.1 (the market research B.16 cites).
- Owner decision OD-13 (Copy Budget: "Lesson prompts, options and Mentor turns get the same limits as a Forge content gate next to B.17 and B.18"), OD-11 glossary, OD-23 (zero spend).
- Appendix C Part 3 Stage 2 (gate order: concept cap, redundancy, tone, …; "a lesson failing any gate returns to Stage 1 with an itemized, specific failure report"), Part 2.1 Definition of Done ("Gated": the gate demonstrably blocks a deliberately non-compliant red-team lesson), Part 1.3 metrics (Forge Gate Pass Rate per gate; Threshold Recalibration Log).
- Appendix B §1.5 (Mayer's redundancy principle). `docs/product-audit/COSMIC_NARRATIVE.md` Law 2.
- S05.4c: Product G.2 ("No path to production content for children should exist that is structurally exempt from the same gates the primary interface enforces"), Appendix C Part 3 Stages 1–6 (Stage 2's gate list, Stage 5 "metrics are a launch requirement") and Part 1.3 (Forge Gate Pass Rate per gate **on first submission**, from pipeline logs), owner decisions OD-17 (generation later targets the verified v2 contract; no catalog regeneration before owner acceptance) and OD-23 (zero spend; every spending pipeline ships a dry-run and an operator runbook).
- Frontend Bible 06 (Copy Budget numbers, word/sentence definition, layering, §5.9 translations) and 08 §2/§5 (speech plate caption; "The Forge content gate for authored segments follows B.18 (no long on-screen text duplicating narration)").

## Point-by-point checkpoints

| ID | Scope | Product acceptance | Frontend acceptance | State |
|---|---|---|---|---|
| S05.4a | B.14 tone gate, B.18 redundancy gate, OD-13 Copy Budget content gate | Deterministic gates 11–13 inside Forge's `runAllGates` (write corrective retry, judge revision, localization re-gate, `verify:course` release attestation) and a zero-spend `content:gates` command over catalog YAML, the committed course corpus, run checkpoints, JSON documents and family-facing UI copy; wired into `release:readiness`; red-team sample per gate blocks; B.18 channel choice (`narration.mode`) added to the v1 contract and honoured by Echo | No new surface. Six family-facing UI strings that failed the tone gate were rewritten in EN/es-MX/pt-BR within the Copy Budget | In progress: implemented and locally verified; Stage 3 reviewer sign-off on lexicon/thresholds, content rewrite of the failing catalogs/corpus, live-pipeline metric data and acceptance pending |
| S05.4b | B.17 concept cap (working-memory limits per lesson), B.11 mentor misjudgment episodes, B.16 cultural localization (Regional Adaptation Gate) | Lesson-policy gates 14–16 decided from the catalog (Forge run preflight skips a blocked slot with zero spend, `content:gates`, `verify:course`) and checked on every document inside `runAllGates` (write retry, judge revision, localization re-gate, release attestation). Authoring contract fields `new_concepts`, `mentor_misjudgment`, `regional_scenarios` and an optional `concepts.yaml` registry; market problem inventory `coursegen/regional/markets.yaml`; written policy and per-market checklist `docs/content/REGIONAL-ADAPTATION-GATE.md`; localization adapts to the market scenario instead of translating; one red-team sample per gate blocks and a compliant localized episode passes | No new surface; no UI copy changed | In progress: implemented and locally verified; content-team declarations (density for 2,462 lessons, market scenarios for 439 lessons), validation of the 3 flagged episodes and 4 inventory hypotheses, the per-market write stage for amounts, live metric data and acceptance pending |
| S05.4c | Appendix C pipeline integration: every Forge gate in the shared release preflight (G.2); zero-spend v2 emitter validated by Core's strict v2 contract; owner-run generation runbook (OD-23); lane review of S05.4 | Release-gate manifest (31 ids) recorded per gate by `verify:course`, with the content watermark it captured before reading, and required by Vault (`forge_release_gates`, `forge_release_verification_refusal` shared by `release_course` and the new `release_lesson`); API-role publication and live v2 pointer moves refused by triggers; Forge `keep-published` removed; v2 plans → emitter → v2 gates → Core `validateV2LessonForGrading` (20 plans, all 21 segment kinds, 60 documents; 5 red-team plans each blocked by its own gate); `--max-usd`/`--budget-usd` required on paid runs; first-submission gate log; B.14 UI tone gate in frontend CI; migration size cap for the Railway transport | No new surface. Two staff-console refusal strings (`RELEASE_VERIFICATION_INCOMPLETE`, `RELEASE_COURSE_RELEASE_REQUIRED`) in EN/es-MX/pt-BR within the Copy Budget | In progress: implemented and locally verified; physical-PostgreSQL evidence of the two migrations, the first owner-run pilot (live metric data), a v2 authoring stage and v2 publication transaction, asset-only live patches, and acceptance pending |

## S05.4a — verified current state (before that checkpoint)

The SPEC's "Current State" was checked against the code on 24 September 2026:

- **B.14 — confirmed.** `coursegen/src/pipeline/gates.ts` had ten deterministic gates (contract, age vocabulary, currency facts, arithmetic, rationale/canon, anti-genericity, generation quality, clarity, readability, plan fidelity) and none for tone. The SPEC's example string was live in `frontend/src/i18n/en-US/errors.json` (`ATTEMPTS_EXHAUSTED`: "No attempts left for this question."), with equivalents in es-MX and pt-BR; the kid banking screen also used bank framing ("Estado de cuenta", "Extrato", "View this month's statement").
- **B.18 — confirmed and structural.** Echo (`audiogen/src/narrate/extractNarratables.ts`) narrates the raw on-screen string of `prompt_md`, story bodies, choice roll-ups, hints and `explanation_md`. Every narrated block in a v1 document is therefore duplicated verbatim on screen by construction, and nothing measured its length. The v1 contract had no way to declare a different spoken script or a text-only segment.
- **OD-13 — not implemented in Forge.** The only text limit was gate 8's `prompt_md` ≤ 140 characters and ≤ 2 sentences (plus the 4,000-character contract maximum). No per-role word budgets, no 6–9 reduction, no ES/PT factor, no limit on options, story turns, feedback or titles, and nothing over the catalog.

## S05.4a — implementation and rationale

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

## S05.4b — verified current state (before this checkpoint)

The SPEC's "Current State" was checked against the code and the catalogs on 24 September 2026:

- **B.17 — confirmed.** No lesson blueprint, topic or document field records how many concepts a lesson introduces, and no gate counts them. Topics carry `key_vocabulary`, but it mixes concepts with ordinary words ("tener", "me gusta", "después"), so it cannot be used as a concept count. Of 2,462 lesson blueprints across the four catalogs, 0 declare their density.
- **B.11 — confirmed.** Nothing in the catalog schema, the write prompt or the gates asks a mentor to be wrong. The catalogs do already contain a few beats where a mentor misjudges and recovers: Liruf spends everything without comparing prices (financial-education, adventure 8), Liruf forgets a packaging cost when pricing (entrepreneurship, adventure 4), and Rho makes a costly choice in the simulator (investing, adventure 8). None was marked, counted or checked, and the lemonade corpus has none.
- **B.16 — confirmed, and worse than stated.** `localize.ts` translates a frozen string map and remaps the currency word and code; "20 pesos becomes 20 reais", and places, customs and situations stay Mexican. The gate also found **translation residue in the committed corpus**: 8 English and Portuguese lemonade-stand documents still say "N pesos" (for example "8 pesos" in `en-US` and `pt-BR`).

## S05.4b — implementation and rationale

All three requirements are **lesson-policy gates**. Unlike gates 11–13, they cannot judge a document alone: they need the catalog (the lesson's declared density and its place in course order, whether it is a flagged episode, its market scenarios). So each has two halves.

- **Catalog half.** `buildCoursePolicy` in `coursegen/src/contentGates/policyGates.ts` derives one `LessonPolicy` per lesson plus itemized findings. A blocking finding is decided **before generation**. The Forge run (`run.ts` `processSlot`) skips such a slot with the reason and zero spend, also under `--dry-run`, because a paid corrective retry cannot fix a catalog declaration. It is decided again at release (`content:gates`, `verify:course` check "catalog passes the lesson-policy gates"), and `author:validate` reports it.
- **Document half.** `runLessonPolicyGates` runs inside `runAllGates` as gates 14, 15 and 16, with the lesson's policy passed in `GateContext.lessonPolicy`. The write stage's corrective retry, the judge's revision, `author:validate`, the localization re-gate and `verify:course` therefore all enforce it.

The write prompt states the lesson's own policy (`lessonPolicyGuidance`): its declared concepts and ceiling, the concepts to avoid, the misjudgment episode to stage, and the Mexican scenario with its anchors.

### B.17 concept cap (gate 14, `conceptCap.ts`)

- **Authoring contract.** Every lesson blueprint declares `new_concepts`: the genuinely new concept ids it introduces, or `[]` for practice. An optional course registry, `curriculum/<slug>/concepts.yaml`, gives each id a localized label and the surface terms per locale that show a lesson is using it. It can also mark a concept `from_course` (introduced by a prerequisite course). Once the registry exists, an unregistered id is a catalog load error.
- **Genuinely new.** The course is walked in order (adventure, saga, topic, lesson positions). A concept counts as new only the first time it is declared. A later declaration is refused ("reinforcement, not new"), and so is a `from_course` concept. A review lesson (review saga or review-kind topic) must declare `[]`.
- **Ceilings.** The band is taken from the youngest age a tier serves, which is the conservative reading also used by the Copy Budget:

  | Tier ages | Band |
  |---|---|
  | 6–7, 8–10 | 6–9 |
  | 12–18 | 10–12 |
  | 13 and over, or the adult register | 13+ |

  The SPEC ranges become two numbers per band. The upper end is the **blocking ceiling** (6–9: 3, 10–12: 4, 13+: 6): "split the lesson, never ship as authored". A count above the lower end (2, 3, 4) goes to Stage 3 review, where the reviewer checks the concepts are chunked onto prior knowledge (Appendix B §1.2 "Nuance"). An undeclared lesson blocks: density that is not tracked cannot be shown to fit.
- **Document check.** With a registry, a generated lesson that uses the terms of a concept introduced **later** in the course has introduced an undeclared new concept. That blocks, and the real count (declared + early) is checked against the ceiling again. Without a registry, the document half has nothing to compare against, and the catalog half still applies.

### B.11 mentor misjudgment (gate 15, `misjudgment.ts`)

- **Authoring contract.** A lesson blueprint is flagged with `mentor_misjudgment`, which records:
  - `character`: one of the four canon mentors;
  - `misjudgment`: a real money decision gone wrong, 20–400 characters;
  - `recovery`: how the mentor recovers, 20–400 characters.
- **Coverage.** A course needs at least one flagged episode. This is the SPEC's proposed minimum, `MIN_MISJUDGMENT_EPISODES_PER_COURSE = 1`; below it, the course fails the release check. The metric is Appendix C "Mentor-Misjudgment Content Coverage", reported per course. Every flagged episode is a Stage 3 review item ("pending content-team validation"); a flag is never accepted silently.
- **Document check.** A flagged lesson's document must:
  - have the mentor in `meta.cast`;
  - have the mentor speak in at least two moments (the misjudgment and the recovery), counted across narration, dialogue lines, scenes and storyplay nodes;
  - carry no self-global shame language. A per-locale lexicon covers phrases such as "I'm so stupid", "soy un desastre" and "sou burro", 23–30 phrases per locale. Decision language ("I forgot to count the bag", "a costly mistake") is not flagged.

  Whether the fallibility is real and the recovery honest is left to the Stage 3 reviewer, as Appendix C assigns it.
- **Flags added.** Three existing lessons whose beats already show a mentor misjudging and recovering were flagged, with no learner-visible change:
  - financial-education `que-paso-despues-del-error` (Liruf);
  - entrepreneurship `que-le-falto-a-esta-lista` (Liruf);
  - investing `rho-comete-un-error-barato` (Rho).

  They await content-team validation. first-lemonade-stand has no such beat, so it still fails the coverage minimum. Writing a new episode is authoring work, not something to invent in this checkpoint.

### B.16 Regional Adaptation Gate (gate 16, `regional.ts`)

- **Market problem inventory** (`coursegen/regional/markets.yaml`, owned by the content/learning-design team). It covers Mexico, Brazil and the United States. Each market has its currency (code, words, symbols), a research profile and problems. Each problem has an id, a statement, its evidence (`cited` with sources, or `hypothesis`) and its lesson implications. The file also lists unambiguous market anchors.

  Cited evidence restates only what the brand research records (Cosmic Narrative §1.1):
  - Mexico: about 80% formal access, but education does not become wellbeing (ENIF 2024).
  - Brazil: 45% of 15-year-olds are below the PISA baseline, against an OECD average of 18%.
  - United States: access is solved but judgment is not; the finfluencer confidence gap; parents' silence about money.

  Everything else (Mexican street markets and tandas, Brazilian Pix and instalment culture) is a labelled hypothesis. The schema refuses a cited problem without a source.
- **Written policy and checklist** in `docs/content/REGIONAL-ADAPTATION-GATE.md`: why the gate exists, who owns what, when a lesson needs scenarios, the authoring contract, what blocks, a per-market Stage 3 checklist and the known limitation.
- **Requirement (deterministic).** A lesson needs scenarios when its topic cites a money fact (currency unit or `mxn.`/`brl.`/`usd.` namespace) or its briefs carry Mexico-specific context (a currency amount such as "20 pesos" or "$5", or an inventory anchor such as "tianguis").
- **Market-scenario authoring contract** (`regional_scenarios` on the lesson blueprint). It is either one scenario per market (es-MX, en-US, pt-BR), each with the fields below, or `{ universal: "<why>" }`, which is refused when the lesson needs scenarios and reviewed otherwise.

  | Field | Rule |
  |---|---|
  | `scenario` | The author brief for that market |
  | `problem_refs` | Ids from that market's inventory |
  | `anchors` | Words that must appear in that market's document, and must not mark another market |
  | `fact_refs` | Optional; each fact must be in that market's currency |

  A non-authoring scenario that repeats the Spanish brief is refused (token Jaccard of at least 0.8).
- **Document check (the "merely translated" gate).**
  - **Every document:** it is rejected if it carries another market's anchors, its currency next to a number ("5 pesos" in pt-BR), its currency code, or its symbol ("$5" in pt-BR, where "R$" is the Brazilian mark). The US dollar is marked international, so a Mexican or Brazilian teen lesson may mention it.
  - **A lesson that needs scenarios:** a non-authoring document with no declared scenario is rejected ("it would ship as a translation"). So is a document that shows none of its own market's anchors, or carries another market's scenario anchors.

  The currency word check requires an adjacent number, because Portuguese "peso" means weight.
- **Adaptation layer in localization.** When a lesson has scenarios, `localizeLesson` passes the translator an adaptation brief: the market scenario, research focus, required anchors, anchors to drop, and currency. It does the same in the shorten-retry prompt. The result is re-gated, and a literal translation fails with an itemized `LocalizeContentGateError`.
- **Amounts.** Localization freezes numbers and answer keys by design, so amounts stay the source numbers and checklist question 3 is judged by the reviewer. Adapting amounts needs a per-market write stage that derives the answer key again. That stage is paid generation (OD-23) and is not built; see the open items.

### Red-team samples (Appendix C DoD "Gated")

`coursegen/src/contentGates/fixtures/red-team/` now holds:

- `b17-concept-cap.json`: three declared concepts plus two later concepts used early, so five against a ceiling of 3;
- `b11-misjudgment.json`: the flagged mentor speaks once and says "¡Soy un desastre!";
- `b16-regional.json`: a Brazilian document that keeps "tianguis" and "5 pesos" and never reaches the "feira livre" scenario;
- `compliant-localized.json`: a Brazilian misjudgment episode that passes gates 11–16.

A JSON sample carries its own `policy`. Through `runAllGates` and through `content:gates`, each red-team lesson fails exactly its own gate among gates 11–16.

## S05.4c — verified current state (before this checkpoint)

Checked against the code on 24 September 2026:

- **The release preflight never read the Forge result.** `release_course` (0031) only required that SOME `course_release_verifications` row was newer than the last document update. Its `checks` JSON was never read, so an attestation written by a Forge that predated gates 11–16, or a hand-written row, unlocked a release. `verified_at` came from the operator's clock.
- **Two G.2 paths bypassed it entirely.** The S02.4b inventory had already named both as open questions:
  - the staff console's lesson **Approve** (`POST /admin/moderation/:lessonId/status` with `published`) patched `lessons.status` directly, so a regenerated lesson in a live course reached learners with no Forge verification;
  - Forge's `--on-existing-published keep-published` swapped a live lesson's documents in place, with no verification and no human read.

  Nothing in Vault stopped any service-role caller from doing the same with one PATCH, or from moving the v2 pointer (`lesson_document_version_current`, 0101) of a published lesson.
- **Forge had no v2 path.** Forge produces v1 documents only. Nothing emitted the verified v2 lesson document, and gates 11–16 had no v2 adapter (a documented S05.4a/b open item).
- **B.14's UI half did not block a UI release.** The UI copy tone scan runs in `release:readiness` and in coursegen's test suite, but coursegen CI never runs on a frontend-only copy change, and frontend CD deploys whatever frontend CI passes.
- **Appendix C's first-submission metric had no data source.** "Forge Gate Pass Rate (per gate)" is defined on first submission from pipeline logs, but the write stage kept only the final result.
- **Paid runs had no owner ceiling.** The run budget is a kill switch with a $50 floor per run: a one-slot paid run was allowed $50.

## S05.4c — implementation and rationale

### One release preflight for every Forge gate (G.2, Appendix C Stage 2)

- **Manifest.** `coursegen/src/release/gateManifest.ts` gives every release check a stable id (31 today):
  - the catalog checks, including the B.17, B.11 and B.16 policy halves and catalog tone and Copy Budget;
  - one check per Forge document gate (1–9 and 11–16; gate 10, plan fidelity, is generation-only with a stated reason because the plan is not persisted with the document);
  - the course release checks;
  - `forge.release.v2-content`.

  Each check names its SPEC ids and whether a blueprint's `known_exception` may excuse it: only the legacy gates 1–9. Appendix C Stage 1 gives no draft a gate exemption, and B.17 says "split, not shipped as authored".
- **Evaluation.** `coursegen/src/release/evaluate.ts` is the pure evaluation behind `verify:course`. It returns exactly one result per id, in manifest order, with per-gate pass counts (the release-time Forge Gate Pass Rate). It fails closed:
  - a contract failure counts against every document gate;
  - a lesson with no age tier, an empty document set or no catalog strings fails its checks;
  - an unreadable or mislabelled v2 activation fails.

  `verify:course` now writes that list as the attestation, plus a JSON report under `coursegen/runs/verify-course/`.
- **Vault.** The `forge_release_gate_manifest` migration adds `public.forge_release_gates` (seeded from the manifest; service-role only, RLS on) and `forge_release_verification_refusal(course_id)`, the verification half of the preflight. It refuses:
  - `VERIFICATION_REQUIRED` unless the attestation is newer than the latest document change **and** the latest v2 activation;
  - `VERIFICATION_INCOMPLETE` unless every required id carries `ok: true` and no entry failed.

  `release_course` calls it and also locks and recounts the course's v2 pointers. A trigger stamps `verified_at` with the database clock.
- **Content watermark (lane review).** `verify:course` reads the course, evaluates it and only then writes the attestation, so a document written while it was running would be older than the attestation and ride on it unread. `forge_release_content_watermark(course_id)` (latest document change or v2 activation) is now captured by `verify:course` **before** its first read and stored in `course_release_verifications.content_watermark`; the shared refusal function returns `VERIFICATION_REQUIRED` unless the attested watermark equals the current one. The value round-trips as Vault's own text, so microsecond precision is kept. The database cannot tell a forged complete attestation from a real one: the service-role key is that trust boundary, and the runbook says so.
- **Parity.** `agent/tools/check-forge-release-gate-parity.mjs` (`npm run forge:release-gates:check`, a named `repo-gates` step, self-tested by `tools:test`) fails when Forge's `GateNumber` union, the manifest and the seeded rows disagree in either direction.

### Release-only publication (lane-review G.2 fixes)

- **One path per scope.** The `release_only_publication` migration adds `release_lesson(lesson_id)`: it publishes one review lesson of an already-live course after the same locale and reviewability checks and the same `forge_release_verification_refusal`. A lesson whose course or section is not live gets `COURSE_RELEASE_REQUIRED`: release the whole course.
- **Guards.** Triggers refuse any write by the API roles (`anon`, `authenticated`, `service_role`) that makes a lesson or a course `published`, and any activation or move of the v2 pointer of a published lesson. `release_course` and `release_lesson` are `SECURITY DEFINER`, so they pass. Migrations, seeds and operator `psql` sessions run as the database owner and are outside the guard by design.
- **Core.** The moderation route now calls `release_lesson` for `published`, maps every refusal to its own envelope code (`RELEASE_VERIFICATION_INCOMPLETE` and `RELEASE_COURSE_RELEASE_REQUIRED` are new, in 3 locales within the Copy Budget), and audits `admin.lesson.release`. Other statuses stay an audited update. The course route maps `VERIFICATION_INCOMPLETE` too.
- **Forge.** `keep-published` is removed from the publish stage, `generate` and the run options. A regenerated live slot demotes to review and returns only through the verified release. The decision stays explicit (`--on-existing-published demote-to-review`), so an operator never demotes live lessons by accident.

This implements the SPEC's first G.2 option ("remove the direct-publish bypass") for these paths; the S02.4b inventory's open question is answered with the conservative default and recorded below as a proposal.

### Zero-spend v2 emitter validated by Core (OD-17, OD-23)

- **Plan contract** (`coursegen/src/v2/plan.ts`). A v2 lesson plan is the Stage 0/1 output for one lesson:
  - identity, age pathway, knowledge components, segment kinds with locale-neutral numbers, and private rubrics;
  - per-market copy for every learner-visible string;
  - the gate 14–16 declarations (`new_concepts`, `mentor_misjudgment`, `regional`).

  In a paid run a model would author the copy. In the dry-run the plan carries fixture copy.
- **Emitter** (`coursegen/src/v2/emit.ts`). It builds the three market documents and the answer keys. Rubrics go to `answer_keys` only, and `required_capabilities` is exactly what the segments need. Every visible string comes from copy, and the three markets must fill the same fields; a string left in the neutral payload, or copy that overwrites a number, is a gate 1 problem. A lesson with any blocking finding emits nothing.
- **v2 gates** (`coursegen/src/v2/gates.ts`). The same measurement code as v1 runs over the v2 shape:
  - tone (12) on every visible string;
  - Copy Budget (13): title = heading, prompt = prompt, diagram labels = option, readouts and worked-step text = data;
  - regional residue and scenarios (16);
  - at plan level, the B.17 ceiling by age pathway (6–9, 10–12, 13+), a flagged B.11 episode (it blocks: the v2 contract has no Mentor voice channel yet), and B.16 scenario analysis, with local-currency amounts requiring scenarios.

  Gate 11 is reported as not applicable (no v2 narration channel), never as a silent pass.
- **Capabilities.** Forge keeps only the capability map needed to assemble documents (`coursegen/src/v2/contract.ts`), now the third copy checked by `check-v2-lesson-capability-parity.mjs` (in `spec:check`).
- **Fixtures.** Twenty committed plans cover all 21 v2 segment kinds, three markets each (60 documents), including a local-currency savings lesson with a scenario per market. Five red-team plans each block on exactly their own gate (12, 13, 14, 15, 16).
- **Validated by Core, not by a copy.** `npm run v2:emit` writes `documents.json` and `report.json` (zero-spend receipt: 0 model, image, voice, network or Vault calls). `npm --prefix backend run forge-v2:check` validates the rows with `validateV2LessonForGrading`, the exact function Core runs before delivering or grading a v2 lesson. The committed output `coursegen/src/v2/fixtures/emitted.json` is checked by Core's `contract:check` (so by Core's `npm test` and CI; `backend-ci` now also watches `coursegen/src/v2/**`), and coursegen's test fails if the committed output is stale. `npm run forge:v2:dry-run` chains both. No catalog was regenerated (OD-17).

### Owner-run generation (OD-23)

- **Runbook.** [`docs/content/FORGE-OWNER-RUN-GENERATION.md`](../../content/FORGE-OWNER-RUN-GENERATION.md) covers:
  - what costs money, and the zero-spend form of each step;
  - preconditions, the rehearsal, and pilot-then-run;
  - live lessons, Stage 3 review, verification and release, with the refusal codes;
  - metrics capture, and what never to do.
- **Enforced ceiling.** A paid `generate` refuses to start without `--max-usd`, and a paid `generate:track` without `--budget-usd` (`coursegen/src/pipeline/spendGuard.ts`). The value only lowers the scaled budget.
- **First-submission metric.** The write stage now reports the first draft's gate result through a callback, so a slot that later fails is still counted. `run.ts` appends it to `runs/<run-id>/gate-submissions.jsonl`, and `generate` prints the per-gate first-submission pass rate. It is zero-cost telemetry of what a run already computes.

### B.14 UI copy now blocks the UI release

`frontend-ci.yml` runs `npm run content:gates` from `coursegen/` (no `--course`: UI copy only) after the i18n check, and watches `coursegen/src/contentGates/**`. A family-facing string that fails the Law 2 tone gate now fails the workflow that deploys it.

## S05.4 lane review (24 September 2026)

Each requirement's mandate compared adversarially with what the gates enforce, after S05.4a–c:

| Requirement | Mandate | Gap found | Resolution |
|---|---|---|---|
| G.2 (preflight) | No path to child-visible content exempt from the gates | `release_course` ignored the attestation's content | Per-gate attestation + `forge_release_gates` (above) |
| G.2 (paths) | Same | Lesson Approve, Forge `keep-published`, and any service-role PATCH or v2 pointer move published without verification | `release_lesson`, triggers, Core route, Forge removal (above). Asset-only in-place patches remain (open items) |
| B.14 | Tone gate on lesson content **and** system/UI copy before release | UI scan did not gate the frontend deploy | Frontend CI step (above) |
| B.14, B.16, B.17, OD-13 | Gates on every authored lesson | v2 documents had no adapter | v2 gates in the emitter and at release (`forge.release.v2-content`) |
| B.18 | Flag narrated text that duplicates on-screen text | v2 has no narration channel | Reported as not applicable; revisit when v2 gains narration |
| B.11 | ≥1 no-shame misjudgment episode per course, flagged for validation | Enforced for v1 (catalog + documents + release) | A flagged v2 plan blocks until v2 has a Mentor voice |
| B.17 | Count genuinely new concepts; block over the ceiling | v1 enforced; v2 plans declare counts but novelty across a v2 pathway is not computed (no v2 catalog graph yet) | Ceiling enforced per plan; cross-lesson novelty for v2 is an open item |
| B.16 | Named gate, per-market checklist, adaptation beyond translation | Amount adaptation not built (S05.4b) | Unchanged open item; v2 plans carry per-market copy, so amounts may differ per market in v2 |
| G.2 (race) | Same | `verify:course` reads, evaluates, then attests: a document written meanwhile would be older than the attestation and unlock unread | Content watermark captured before reading and compared by the preflight (above); pinned in `check-migrations.mjs` and by a source-order test |
| G.2 (rollout) | The preflight migration must be applicable by the owner's migration transport | Adding the watermark grew `forge_release_gate_manifest` to 24,913 bytes; `railway-migrate.test.mjs` failed with "Argument list too long" (the base64 payload is one Windows command-line argument, capped at 32,767 characters) | Comments that restated 0031 were cut (22,396 bytes); `check-migrations.mjs` now refuses any migration over 23,000 bytes in seconds (0025, 22,799 bytes, is the largest proven) |
| Appendix C DoD "Gated" (v2) | A red-team lesson demonstrably blocked by the pipeline tool | The v2 red-team samples blocked only in unit tests; `v2:emit --plans <red-team dir>` rejected them as malformed plans | The plan loader accepts the red-team wrapper; the command itself now blocks each sample on its own gate |
| Appendix C 1.3 | Pass rate per gate on first submission, from pipeline logs | No first-submission record | `gate-submissions.jsonl` + run summary |
| Appendix C Stage 2 order | Fixed fail-fast order, cheap before expensive | Deterministic gates run in pipeline order 1–16, all reported | Recorded interpretation: every gate here is deterministic and runs before the paid judge, and catalog-level blocks skip the slot before any paid call; the order among free checks does not change cost, and a full itemized report is what Stage 2 requires on failure |
| OD-23 | Zero-spend dry-run + runbook for every spending pipeline | No owner ceiling on paid runs | `--max-usd` / `--budget-usd` required; runbook |

Stage 2 gates that belong to other lanes (B.26/B.27 shame language beyond B.11 episodes, B.7 interactive behavior, B.22 reward mechanics) are not implemented here; the manifest and `forge_release_gates` take a new gate by adding one id and one migration row, and the parity gate fails until both exist.

## Threshold Recalibration Log (Appendix C Part 1.3)

The machine-checked log of record is now [`docs/operations/BLOCK-B-THRESHOLD-LOG.md`](../../operations/BLOCK-B-THRESHOLD-LOG.md) (GAP-FIX-R6): it holds these values with their constants, a review due date and the review history, and `agent/tools/check-block-b-thresholds.mjs` fails when they drift. This table is the initial record.

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
| Concept ceilings (B.17) | 6–9: target 2, ceiling 3 · 10–12: target 3, ceiling 4 · 13+: target 4, ceiling 6 (above the target → Stage 3 review; above the ceiling → blocks) | Product B.17 and Appendix B §1.2 ranges; owner log §8 applies them as written | 24 Sep 2026 (initial) |
| Working-memory band rule | The youngest age a tier serves decides; the adult register is 13+; unknown ages → 6–9 | Engineering, conservative (same reading as the Copy Budget audience) | 24 Sep 2026 (initial) |
| Mentor-misjudgment minimum (B.11) | 1 flagged episode per course; the mentor voices at least 2 moments | Product B.11 proposed starting point | 24 Sep 2026 (initial) |
| Shame lexicon (B.11 episodes) | `SHAME_LEXICON` in `misjudgment.ts` (EN 30, es-MX 30, pt-BR 23 self- or person-directed labels) | Appendix B §1.8/§2.8 (feedback scoped to the action, never the person) | 24 Sep 2026 (initial) |
| Scenario copy threshold (B.16) | A non-authoring scenario brief with a token Jaccard of at least 0.8 against the es-MX brief is a copy | Engineering starting point | 24 Sep 2026 (initial) |
| Market anchors (B.16) | `coursegen/regional/markets.yaml` (Mexico 5, Brazil 6, United States 2); currency words count only next to a number | Content team; screened for words that are ordinary in another content language | 24 Sep 2026 (initial) |
| v2 audiences (S05.4c) | Copy Budget 6–9 limits for the `6-9` age pathway only; working-memory band `6-9`→6–9, `10-12`→10–12, `13-17`/`adult`→13+, unknown→6–9; diagram labels are option copy, readouts and worked-step text are data | Bible 06 §3.1/§3.3 and Product B.17 applied to the v2 age pathways (OD-16) | 24 Sep 2026 (initial) |

Lexicon calibration on 24 September 2026: the first draft blocked 58 catalog strings, all of them teaching or narrative uses (the fraud-radar adventure naming "ganancia garantizada" as a warning sign, quotes in straight single quotes, "tiempo limitado" as an ordinary constraint, "FOMO" as a taught concept). After adding straight-quote detection, the warning-cue rule, the everyday-urgency review tier and removing concept names, the same inputs produce 0 blocks and 57 review items, while every real UI violation and every red-team phrase still blocks.

## Baseline measurement (24 September 2026)

`npm run content:gates -- --course <slug>` (UI copy included) after S05.4a:

| Course | Inputs | Blocking | Human review | Pass rate per gate (documents) |
|---|---|---|---|---|
| financial-education | 4,497 catalog strings | Copy Budget 233 (89 descriptions, 140 parent tips, 4 titles); tone 0 | tone 2 | no generated documents in the repository |
| entrepreneurship | 2,670 catalog strings | Copy Budget 330 (127 descriptions, 189 parent tips, 14 titles); tone 0 | tone 6 | no generated documents in the repository |
| investing | 2,670 catalog strings | Copy Budget 330 (137 descriptions, 182 parent tips, 11 titles); tone 0 | tone 49 | no generated documents in the repository |
| first-lemonade-stand | 439 catalog strings + 186 corpus documents (62 lessons × 3 locales) | Redundancy 375; Copy Budget 504 in lessons (224 body, 152 prompt, 80 option, 34 Mentor, 14 heading) + 34 catalog; tone 0 | tone 4 (red_flags scam artifact, examined) | redundancy 0/186 · tone 186/186 · Copy Budget 2/186 |
| System/UI copy | 6,396 strings | tone 0 (8 before the rewrite above) | 0 | — |

Reading: the legacy content was never written to these budgets, and v1 narration duplicates every narrated block by construction, so the release check now fails for every course until the content is rewritten. That is the intended effect of the gate, not a defect to silence. Rewriting the catalogs is authoring work (human, or AI-assisted under OD-23's owner-run rule); regenerating the corpus is the later Forge phase (OD-17).

### S05.4b baseline: lesson-policy gates 14–16 (24 September 2026)

Command: `npm run content:gates -- --course <slug>`, run after S05.4b.

| Course | Lessons | B.17 density declared | B.17 blocking | B.11 episodes (minimum 1) | B.16 lessons needing scenarios (declared) | Gates 14–16 on corpus documents |
|---|---|---|---|---|---|---|
| financial-education | 1,312 | 0 | 1,312 (undeclared) | 1 flagged, pending validation | 266 (0) | no documents in the repository |
| entrepreneurship | 544 | 0 | 544 (undeclared) | 1 flagged, pending validation | 67 (0) | no documents in the repository |
| investing | 544 | 0 | 544 (undeclared) | 1 flagged, pending validation | 44 (0) | no documents in the repository |
| first-lemonade-stand | 62 | 0 | 62 (undeclared) | 0: course blocks | 62 (0) | concept cap 186/186 · misjudgment 186/186 · regional 62/186 (the 62 es-MX sources pass) |

Why lessons need market scenarios:

- **Cited money facts.** Most lessons need scenarios because they cite money facts: MXN denominations and reference costs (364 reasons in financial-education, 118 in the lemonade course).
- **Amounts in the briefs.** The rest carry amounts in their briefs ("80 pesos", "$9"), and 3 financial-education briefs name the Mexican "tiendita".

Regional findings in the corpus documents (132):

- **124 are translations.** These are the English and Portuguese documents of lessons that need scenarios but declare none.
- **8 are real translation residue.** "4 pesos", "8 pesos", "10 pesos" and "15 pesos" survive in en-US and pt-BR lemonade-stand documents; these are defects in the committed content.

UI copy is unchanged: 6,396 strings, tone 0 blocking.

Reading: gates 14 and 16 are red for every course until the content team declares density and market scenarios, and gate 15 is red for the lemonade course until it has an episode. That is the intended effect of the gates: the catalogs never tracked these properties, and B.17 and B.16 require them to be decided before generation.

## Verification log

S05.4a — executed 24 September 2026 in the lane worktree (`C:/lf-wt/s05f`, branch `codex/spec-s05f`) with `VITEST_MAX_THREADS=3`. Local results only; no CI, database, network or model call.

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

### S05.4b verification log

Executed 24 September 2026 in the lane worktree (`C:/lf-wt/s05f`, branch `codex/spec-s05f`) with `VITEST_MAX_THREADS=3`. Local results only: no CI, database, network or model call, and zero spend.

| Boundary | Command / evidence | Result |
|---|---|---|
| Lesson-policy gates, focused | `coursegen/`: `npx vitest run src/__tests__/lessonPolicyGates.test.ts` | 26 tests passed. They cover: bands and ceilings; catalog blocks (undeclared, re-declared, review lesson, over ceiling); review above the target; `from_course`; the later-concept list; orphan registry entries; voiced-moment counting; the shame lexicon in 3 locales; the inventory schema and cited sources; the requirement rules; the scenario contract (wrong market problem, wrong currency fact, shared anchor, copied brief, false market-neutral claim); the residue check (foreign currency and anchors blocked; own currency, Portuguese "peso", the US dollar and the authoring source not blocked); each red team failing only its own gate through `runAllGates`; the compliant localized episode passing gates 11–16; coverage and guidance on a written course; registry and contract load errors; the es-MX author told the Mexican scenario and its anchors; the adaptation brief in the translator prompt; a literal localization refused and an adapted one accepted; and the three flagged episodes in the real catalogs |
| Forge run preflight | `coursegen/`: `npx vitest run src/__tests__/dry-run.test.ts` | 9 tests passed, 3 new: an undeclared lesson, a lesson with Mexican amounts and no scenarios, and a lesson over the ceiling are each skipped with the itemized gate 14/16 reason and 0 tokens, while the compliant slot proceeds |
| Red team through `content:gates` | `coursegen/`: `npx tsx src/contentGates/cli.ts --documents src/contentGates/fixtures/red-team --no-ui`; test `contentGatesSources.test.ts` | Exit 1 as expected. The pass rate is 7/8 for each of the six gates: each red-team lesson fails only its own gate, and both compliant samples pass all six |
| Content gates, real inputs | `coursegen/`: `npm run content:gates -- --course <slug>` for all four courses (the lemonade course also with UI copy) | Exit 1 as expected for all four; numbers in the S05.4b baseline table |
| Catalog validity | `coursegen/`: `npx tsx src/catalog/check.ts` | 4 courses, 2,462 blueprints, 0 errors (597 warnings, unchanged) with the three `mentor_misjudgment` flags added |
| Forge regression | `coursegen/`: `npm test` | 48 files, 728 tests passed (before this checkpoint: 47 files, 699 tests; 3 existing dry-run tests needed their fixture lessons to declare `new_concepts`, and the red-team runner test gained the new samples) |
| Forge static checks | `coursegen/`: `npm run type-check`, `npm run lint`, `npm run contract:check` | Passed; contract copies identical (10 files); the v1 lesson contract is unchanged |
| Repository gates | Root: `npm run spec:check`, `npm run secrets:check` | Both OK |

### S05.4c verification log

Executed 24–25 September 2026 in the lane worktree (`C:/lf-wt/s05f`, branch `codex/spec-s05f`) with `VITEST_MAX_THREADS=3`. The checkpoint was interrupted once (usage limit) and resumed on 25 September; the resumed session re-ran every row below on the final tree. Local results only: no CI, database, network or model call, and zero spend.

| Boundary | Command / evidence | Result |
|---|---|---|
| Release evaluation, spend guard, first-submission log, v2 emitter, publish stage, write stage (focused) | `coursegen/`: `npx vitest run src/__tests__/{releaseEvaluate,spendGuard,gateSubmissionLog,v2Emit,publish-vault,write}.test.ts` | 6 files, 92 tests passed. They cover: one result per manifest id, in order; fail-closed cases (contract failure counts against every document gate, missing tier, empty document set, no catalog strings, unreadable or mislabelled v2 activation); only gates 1–9 excusable by `known_exception`; the real lemonade course and corpus evaluated end to end; `verify:course` captures the content watermark before its first read and never attests without it (source-order pin); a paid `generate` / `generate:track` without `--max-usd` / `--budget-usd` exits 1 through the real CLIs; the ceiling only lowers the scaled budget; the first draft's gate result is logged even when the slot later fails; `keep-published` is refused; all 21 v2 segment kinds across 20 plans; no network call possible during an emit; each of the 5 red-team plans blocks on exactly its own gate (12, 13, 14, 15, 16) and emits nothing, also through the `v2:emit` command over the red-team directory; the committed `emitted.json` is not stale |
| Core validates Forge's v2 output | `backend/`: `npx vitest run src/__tests__/forgeV2Emitted.test.ts`; root `npm run forge:v2:dry-run` | 8 tests passed; `forge-v2:check OK — 60 Forge-emitted v2 rows pass Core's strict contract` (`validateV2LessonForGrading`, the function Core runs before delivering or grading) |
| v2 red team through the command | `coursegen/`: `npm run v2:emit -- --plans src/v2/fixtures/red-team --out runs/v2-emit/red-team` | Exit 1; 5 of 5 plans blocked, each on its own gate, 0 documents written (before the lane-review fix the command rejected the samples as malformed plans instead) |
| Core release routes, adversarial | `backend/`: `npx vitest run src/__tests__/admin.test.ts -t "moderation/:lessonId/status"` plus the course-route refusal table | 10 moderation tests passed: `published` goes only through `release_lesson` and is audited `admin.lesson.release`; each of 7 refusal codes maps to its envelope with no status write and no audit; a family account (kid, teen, adult or parent all carry the `universal` role) and staff without `manage_content` get 403 before any release call; `draft` stays an audited status update. The course route maps `VERIFICATION_INCOMPLETE` too |
| Vault static pins | `database/`: `node scripts/check-migrations.mjs`, `node scripts/check-migration-phase.mjs`, `node --test scripts/*.test.mjs` | `migrations OK — 113 file(s)` (now including the Railway transport size cap; the release-gate manifest migration is 22,396 bytes, release-only publication 9,167); `migration-phase OK — 91 expand, 22 contract`; 21 node tests passed (publish CLI boundary includes the `VERIFICATION_INCOMPLETE` refusal). Each new pin was shown red on a weakened scratch copy: no shared refusal function, no gate-id check, no v2 activation, no watermark comparison, a watermark without v2 activations, a missing `release_lesson` / status / v2-pointer guard, and a migration padded past 23,000 bytes |
| Release-gate parity | Root: `npm run forge:release-gates:check`; `node --test agent/tools/check-forge-release-gate-parity.test.mjs` (in `tools:test`) | `forge release-gate parity OK — 31 release checks recorded by verify:course and required by release_course`; 6 self-tests: red when Forge gains a gate the manifest does not record, when the manifest records a check the database does not require, when the database requires a check `verify:course` never records, and when a gate number disagrees; a later migration may retire a requirement |
| v2 capability parity | Root: `node agent/tools/check-v2-lesson-capability-parity.mjs` (in `spec:check`) | OK across Core, browser and Forge copies |
| UI copy (B.14) and i18n | `coursegen/`: `npm run content:gates` (the new frontend-CI step); root (Git Bash) `bash agent/tools/check-i18n.sh` | `content:gates OK — no blocking finding` on the family-facing UI copy; i18n all three phases OK. The two new staff refusal strings are within the body budget (EN 12 words / 2 sentences; ES and PT 13 of 15) |
| Service suites | `coursegen/`, `backend/`, `frontend/`: `npm run type-check`, `npm run lint`, `npm test` | See the root aggregate row; each service also passed alone on 25 September (coursegen 52 files / 774 tests and backend 71 files / 1,488 tests before the three lane-review tests were added; frontend 211 files / 2,189 tests) |
| Root aggregates | Root: `npm run typecheck:all`, `npm run lint:all`, `npm run test:all` | typecheck:all and lint:all OK across all services; test:all green in every package on the final tree: audiogen 17 files / 170 tests, backend 71 files / 1,489 tests (1 skipped), coursegen 52 files / 777 tests, dataintel 194, email-server 35, filebase 34, frontend 211 files / 2,189 tests, oracle 41 files / 1,136 tests, parent-id-check 26, picturegen 103. `database` failed inside that run (the transport size row of the lane review) and, after the fix, passed alone: `npm test` exit 0 (migrations, phase, 21 node tests, 12 Railway transport scenarios) |
| Repository gates | Root: `npm run spec:check`, `npm run secrets:check`, `npm run tools:test` | spec:check OK (113 headings, parity, tokens, assets); secrets OK; tools:test 69 passed, 0 failed; `forge:release-gates:check` OK |

Failures met and resolved during the checkpoint: the `v2:emit` command could not run the red-team samples (loader fixed, test added); `verify:course`'s read-then-attest race (content watermark added, pinned); an overclaim in the migration comment and the runbook that a hand-written attestation can never unlock a release (reworded: only an incomplete one; the service-role key is the trust boundary); the first wording of `RELEASE_VERIFICATION_INCOMPLETE` said "skipped" when the gate may also have failed (rewritten in 3 locales). The database package's Railway transport test then failed inside `test:all` with "Argument list too long" on `forge_release_gate_manifest` once the watermark was added (24,913 bytes); the migration was trimmed to 22,396 bytes, a size cap was added to `check-migrations.mjs` (shown red on a padded copy), and the suite was re-run green (row above). A first attempt of that test had run for over 30 minutes under the shared machine's load and was stopped.

## Remaining limitations and open items

### S05.4a open items

- **Content is not yet compliant.** The four catalogs and the committed corpus fail (baseline table). Rewriting them is authoring work; nothing was regenerated or rewritten by this checkpoint, and no paid call was made.
- **Live-pipeline behaviour is unobserved.** Gates 11–13 now run inside the write corrective-retry loop and the localization re-gate; their effect on retry count and cost per lesson is unmeasured until an owner-run generation (OD-23). The write prompt states the budgets up front to keep retries rare.
- **Stage 3 review of the lexicon and thresholds** has not happened. Review items (57 on the current catalogs, 4 on the corpus) need a Pedagogical Reviewer; a false block found later is a recalibration entry above.
- **v2 lesson documents** carry no narration channel yet; when the v2 contract gains one, add the redundancy check to the v2 adapter. The rendered-app copy-budget audit remains the authority for v2 prompts and all first views. (S05.4c built the v2 adapter for gates 12, 13 and 16 and reports gate 11 as not applicable.)
- **Rebuild inline literals** are tone-scanned but not budgeted (their role is declared in the DOM via `data-copy-role`, which the rendered-app audit measures).
- **Legacy UI copy change** is verified by i18n parity and the frontend suite, not by a browser screenshot of the kid banking screen and the error toast (both are legacy surfaces the rebuild replaces).
- **Physical environments.** No real database, Echo run or CI run was involved; the Core release preflight's reliance on `verify:course` is unchanged code, verified by reading, not by a live release attempt. (S05.4c now makes the preflight read the attestation per gate; its physical-PostgreSQL evidence is an S05.4c open item.)

### S05.4b open items

- **Declarations are content-team work and none exist yet.** The following are authoring decisions for Stage 0/1, owned by the content/learning-design team:
  - density (`new_concepts`) for 2,462 lessons;
  - market scenarios for 439 lessons;
  - an optional `concepts.yaml` with terms per course.

  This checkpoint did not invent them. Until they exist, gates 14 and 16 keep every course's release check red, and a Forge run skips those slots at zero spend.
- **The three flagged misjudgment episodes are unvalidated.** financial-education, entrepreneurship and investing each have one flagged episode. first-lemonade-stand has none, so it fails the B.11 minimum until one is authored.
- **Market inventory hypotheses.** 4 hypotheses (`mx-cash-and-informal-commerce`, `mx-informal-group-saving`, `br-instant-payments`, `br-installment-culture`) need learning-design validation or deletion. Every scenario that cites one is listed for Stage 3 review.
- **Amounts are not adapted per market.** Localization keeps the source numbers, because it freezes numbers and answer keys on purpose. Adapting amounts needs a per-market write stage that derives the answer key again and re-runs the arithmetic gate. That stage is paid generation (OD-23, owner-run) and is not built. Until then, the Stage 3 checklist judges plausibility.
- **The document half of B.17 needs a registry.** Without `concepts.yaml` terms, a generated lesson that front-loads a later concept is not detected; only the declared count is enforced.
- **The corpus translation residue is not fixed.** 8 en-US and pt-BR lemonade documents still say "N pesos". They are the committed legacy corpus, due to be regenerated (OD-17), so this checkpoint does not hand-edit them.
- **Live pipeline and metrics are not observed.** No generation ran (OD-23). The following are therefore unmeasured:
  - the effect of gates 14–16 on the write retry and the localization retry;
  - the adaptation prompt's success rate;
  - live Forge Gate Pass Rate data;
  - Mentor-Misjudgment Content Coverage in production.

  `verify:course` gained the policy check, but it is verified by tests and reading, not by a run against a real database.
- **The v2 lesson documents have no adapter.** Resolved in S05.4c: `coursegen/src/v2/gates.ts` applies gates 12–16 to v2 plans and documents (gate 14 per plan; cross-lesson novelty for v2 pathways still open, see S05.4c).

### S05.4c open items

- **No physical PostgreSQL evidence.** `forge_release_gate_manifest` and `release_only_publication` were verified by the static gates only: numbering, RLS, phase declaration, and the new pins, which were each shown going red on a weakened copy. Also unverified on a real database (both migrations are `contract` and applied by hand):
  - the plpgsql itself;
  - the trigger behaviour under PostgREST's `service_role`;
  - the lock order of `release_lesson` against `release_course`;
  - that `release_course` still releases a verified course;
  - that the content watermark round-trips through PostgREST at microsecond precision and refuses an attestation written after a concurrent document change.

  A disposable-stack run (`database/scripts/disposable-stack.sh`) covering the refusal codes, the triggers and a full release is required before rollout.
- **Every existing course's release is now blocked until it is re-verified.** No attestation written before this checkpoint carries a content watermark or names gate ids, so `release_course` returns `RELEASE_VERIFICATION_REQUIRED` (then `RELEASE_VERIFICATION_INCOMPLETE` for an older Forge) for every course after the migration. Given the S05.4a/b baselines, `verify:course` will then fail for every current catalog until content is rewritten and declared. This is the intended effect of G.2, and it must be planned: a published course stays published; only a new release is refused.
- **Asset-only in-place patches of live documents remain.** `images:backfill` (Prism, paid) and Echo's narration stamps write the `document` of already-published lessons in place. No text changes, but images are learner-visible. Such a change forces a fresh verification before the next release; it is not blocked when it happens. Proposal and question below. These two tools also have no command-line owner ceiling like `--max-usd`.
- **v2 generation is dry-run only.** No model authors v2 plans yet, and no reviewed v2 publication transaction exists (0101 names it as future work). Until both exist, v2 content reaches Vault only by an operator inserting versions and pointers, which the new guard refuses for published lessons and the release preflight re-gates for review lessons. Cross-lesson B.17 novelty for v2 pathways, and B.11 episodes in v2 (no Mentor voice channel), are open.
- **Live metrics.** The first-submission log and the per-gate release report exist, but no paid run has produced data (OD-23). Appendix C "Measured" stays open until the owner-run pilot.
- **CI not run.** The new `repo-gates` step, the `frontend-ci` UI tone step and the `backend-ci` path were verified by running their commands locally. The workflows themselves run only on push, which is the owner's decision.
- **Core `RELEASE_REFUSALS` in the legacy staff console.** The two new codes render through the existing `errors.api.<CODE>` lookup. No screenshot of the legacy console was taken, because the staff console rebuild belongs to S09.

## Owner questions and recorded proposals

**S05.4a**

1. **Roles beyond OD-13's list.** OD-13 names prompts, options and Mentor turns. This checkpoint also gates feedback (`explanation_md`, rationale, recap: body, 12/15 words), titles (heading, 6/8) and hints (layered sheet, 60/75), applying Bible 06 §3.1 and §4 to every string a lesson renders, and measures catalog descriptions and `parent_check` tips as body copy. Proposal: keep them blocking. Question: confirm, or restrict the blocking set to OD-13's three roles and report the rest as advisory.
2. **Tier2 (8–10) takes the 6–9 limits.** Proposal: keep the stricter reading until pathways (OD-16) split 8–9 from 10.
3. **Banking vocabulary in lessons is review, not block.** Proposal: keep; money lessons for teens teach what a bank message says.

**S05.4b**

4. **How to apply the B.17 ranges.** Proposal (implemented): the upper end of each range blocks (3, 4, 6) and a count above the lower end (2, 3, 4) goes to Stage 3 review. Question: confirm, or block at the lower end.
5. **Tier4 (12–18) takes the 10–12 band (ceiling 4).** Proposal (implemented): keep the youngest-age reading until the age pathways (OD-16) separate 12-year-olds from teens.
6. **B.11 episodes.** Proposal (implemented): at least 1 per course, with three existing lessons flagged as candidates. Question: confirm the three candidates, and decide who authors the first-lemonade-stand episode.
7. **B.16 amounts.** Should Forge gain a per-market write stage that re-derives the answer key (paid generation, owner-run), or does same-number play money reviewed at Stage 3 remain acceptable? Proposal: build the stage when Forge moves to the v2 contract; until then, Stage 3 judges amounts.
8. **No bypass for undeclared lessons.** Proposal (implemented): a Forge run skips undeclared slots even in the QA smoke course (first-lemonade-stand), because B.17 requires density to be decided before generation.

**S05.4c**

9. **Single-lesson approval.** The staff console's lesson Approve now publishes only through `release_lesson`. That requires the same fresh, complete Forge verification as a course release, and only into an already-live course. Proposal (implemented): keep per-lesson approval with that preflight. Question: confirm, or remove per-lesson approval so that only whole-course releases exist.
10. **No in-place live swap.** Forge's `keep-published` is removed. Regenerating a live v1 lesson therefore takes it out of the learner catalog until it is released again (a planned outage). The no-outage path for live content is the v2 versioned document with a reviewed publication transaction. Proposal (implemented): accept the outage for v1 regeneration. Question: confirm.
11. **Asset-only patches of live documents.** `images:backfill` and Echo's narration stamps change the `document` of published lessons in place. Two options:
    - (a) require demotion, or a new v2 version, before any change to a live document; this is the proposal, enforced later with a physical-database-tested guard that must allow Echo's audio-only writes;
    - (b) allow asset-only patches with a mandatory retroactive `verify:course` within 30 days, G.2's second option.

    Question: choose (a) or (b).
12. **Owner ceilings on the other paid tools.** `generate` and `generate:track` now require the owner-approved USD ceiling. Proposal: add the same requirement to `images:backfill` (paid mode) and `audiogen narrate:all`. Question: confirm.
13. **Re-verification after the migration.** Every course needs a fresh `verify:course` from the S05.4c Forge before its next release, and per the baselines every current catalog fails it until its content is rewritten and declared. Question: confirm this is acceptable, or name a course whose content work should be prioritised before the migration is applied.

## Follow-up: gap-fix round 1 (F1-data-platform), G.2 asset-only patches

The in-place patches of published lessons listed above as remaining are closed by owner-queue F-09 option (a): the `live_lesson_document_guard` migration refuses, for the API roles, any content change or delete of a published lesson's `document`, with Echo's narration stamp (`segments[].audio_segment_id`) as the one allowlisted diff; a database-owner change is logged (`content.live_document_patched`) for the retroactive check. `images:backfill` reads each lesson's status, never illustrates or writes a published lesson and reports each one it skipped. Evidence: `database/scripts/verify-data-platform-postgres.py` on native PostgreSQL 17.6, `coursegen/src/__tests__/backfillImages.test.ts` and `liveDocumentGuard.test.ts`. Record: [GAP-FIX-R1.md](GAP-FIX-R1.md#f1-data-platform).
