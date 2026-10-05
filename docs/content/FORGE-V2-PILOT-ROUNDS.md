# Forge v2 pilot rounds: Educación Financiera

How the first v2 course is being written and judged before it is generated in full (OD-17, OD-23, OD-24). The course is authored in agentic mode with Claude Code instead of Forge's paid stages, in small rounds of eight lessons, and each round is measured against the one before it. Nothing in a round spends money, publishes a lesson or writes to Vault: every command below is offline.

## Method

| Step | Command (from `coursegen/`) |
|---|---|
| Plans in, documents out | `npx tsx src/v2/cli.ts --plans <dir> --out <dir> --run-id <id> --require-lesson-design` |
| Core's strict contract and the interactive-behaviour check | `npm --prefix ../backend run forge-v2:check -- <out>/documents.json` |
| Calls the owner would send | `npm run v2:publish -- --plans <dir> --course <slug> --run-id <id> --out <dir> --dry-run` |
| Hierarchy rows and seed SQL | `npm run v2:hierarchy` (`-- --check` fails when the written files are stale) |
| Compare rounds | `npm run v2:round-report -- --round round-1=<plans dir> --round round-2=<plans dir> [--json f] [--markdown f]` |

Each round archives its plans under `coursegen/curriculum-v2/financial-education/rounds/round-N/`; `plans/` always holds the latest. Round 1 is `rounds/round-1/plans/`. Round 2 keeps two snapshots, `rounds/round-2/authored/plans/` (as written under the writing skills, before review) and `rounds/round-2/reviewed/plans/` (after the three reviews were applied; identical to `plans/` today), plus `report.md` and `report.json` (the three-way measurement), `review/` (the three reviewers' findings) and `review/applied-changes.txt` (every changed leaf between the two snapshots). The pilot structure is `pilot.structure.yaml` (four lessons for ages 6-9, four for 10-12, one Mentor each).

A round is: author each lesson, emit it through every gate, run Core's check, review it from three angles (pedagogy and age fit, regional adaptation, correctness and contract fidelity), apply the fixes that survive, and re-run the gates. A finding is applied only when it is correct against the gates and the specification; the rest are rejected with a reason. A reviewer's replacement string is never pasted: it is counted against the real Copy Budget first, because the reviewers' strings did not always fit (see Round 2 results).

## Round 1 (baseline)

Eight lessons, 69 segments. `v2:emit` emitted 24 documents, Core's check passed 129 graded segments over 14,484 input states, and the publish dry run built 24 calls and sent none. Three reviewers raised 146 findings: 83 fixes were applied and 41 were rejected.

What the owner and the reviewers found:

- **Too much asking, too little showing.** 26 of 69 segments (38%) were demonstrations; 43 were graded. On average the learner met the first graded item after 1.9 segments. No lesson opened with a pre item, one lesson had a post item, and a lesson's order was not declared anywhere a gate could read it.
- **The Mentors sounded alike.** "Escucha a tu Mentor" opened a Mentor line in most lessons; only Liruf had a recognisable voice.
- **Regional adaptation was nouns only.** Most scenarios changed a word, not a situation, and the reviewers flagged es-MX words a Mexican child would not say (`pulsa`, `enlace`, `mesada`, `insumos`) and gendered greetings (`Bienvenido`, `Bem-vindo`) addressed to a child of unknown gender.
- **Vocabulary drift on money.** Coins, pieces, tokens and value were used for each other in the 6-9 lessons.
- **Market money.** The market-stall and coin-stack boards printed a generic `$` and read "dollars" in every market.

## What changed for round 2

### 1. The writing skills reach the authors

Forge v1 keeps its writing discipline in `coursegen/src/pipeline/contentPlaybook.ts` (`PLAYBOOK_RULES`, `PLAYBOOK_FORBIDDEN`, `FOLLOWABILITY_RULES`, `tierReasoningGuidance`) and `learnerRegisterPolicy.generated.ts` (register lexicons, generic praise, exclamations). The v2 authoring prompt never imported any of it, so v2 copy was held to the gates and not to the craft. `coursegen/src/v2/writingSkills.ts` is that import:

- v1 rules are reused **verbatim, by number** (`playbookRule(n)` throws if v1 renumbers or drops one). v1 rule 4 (discovery first) is not reused: the owner reversed it for v2.
- Followability rule 2 is restated against the v2 Copy Budget (the anchor is a clause inside the instruction, never a sentence of its own).
- One voice card per Mentor (`MENTOR_VOICES`: voice, how that Mentor teaches an example, a sample line per market), mirroring `oracle/src/tutor/prompt.ts`.
- One style note per market (`LOCALE_STYLE`), the Copy Budget as numbers per market, and the register rules for the lesson's age band.
- The examples-first teaching order (`EXAMPLES_FIRST_SKILL`).
- What the round-2 reviewers kept finding, as seven rules to apply the first time (`PILOT_LESSONS`): the example demonstrates the exact criterion the exercise grades; the reason is in the visible line, not only in narration; a hook is a picture, not an instruction; number the steps of a longer example; a step never leaks the next result, and `met` credits only what the child did; vary where the right choice sits; a mistake ends with a commitment for next time. Round 3 and the full course start from these, so the next round's findings should be new ones.

`v2/author.ts` adds `writingSkillsPrompt(skeleton)` to `authoringMessages`. The v1 prompt is byte-identical to before (`v2LessonDesign.test.ts` pins it).

### 2. Examples first, exercises only reaffirm

A segment may carry a plan-only `teaching_role`: `hook`, `pre`, `example`, `guided`, `practice`, `transfer`. The arc is: the Mentor opens the situation, one low-stakes `pre` item, a chain of example turns (one step per turn, no question to the learner), a `guided` step, a few `practice` items that reaffirm what was shown, and one `transfer` in a new setting. The role never reaches the emitted document (`emit.ts` copies explicit fields only).

Gate 14 (`coursegen/src/v2/lessonDesign.ts`, so no new gate number) checks the arc. It blocks: a role that contradicts the segment's grading, a graded item before the first example (other than hook and `pre`), more than two `pre` items, a new concept with no example, a lesson whose last graded item is not the transfer, no transfer at all, an example run of more than five turns, and more than two independent exercises per demonstration. It reviews (a finding, not a block): an example run of four or five turns, between one and two exercises per demonstration, and a `pre` and `transfer` that do not evidence the same knowledge component. `--require-lesson-design` blocks a plan that names no role at all; `v2:publish` takes the same flag.

Pre, post and transfer items also feed the learning-QA signals Core already reads (`learningQaSignals.ts`) and Appendix C's practice-versus-transfer split, which the round-1 plans left empty.

### 3. Market money on the boards

The market-stall and coin-stack boards print the learner's market currency (`$12` es-MX, `R$ 12,50` pt-BR, `$12.50` en-US) and read it aloud as pesos, reais or dollars (`localMoney`, `spokenLocalMoney` in `frontend/.../fin1/format.ts`). The plan payload stays whole cents, so plans remain locale-neutral. The goal-bullet and savings-line boards still print ISO codes; see the backlog.

### 4. Hierarchy and lesson ids

`npm run v2:hierarchy` generates the Vault hierarchy (courses, adventures, sagas, topics, lessons, KC links) as reviewable rows and a seed SQL that ends in `ROLLBACK`, and `v2:publish --lesson-ids` maps each plan's slug to its `public.lessons` uuid. Regenerate it after a round changes a plan's title (`-- --check`).

### 5. Measuring a round

`v2:round-report` measures every plan offline: demonstrations versus graded items, segments before the first question, roles, pre and post items, the average and longest line per market, reading level per market, and the emit findings by gate. Reading level is reported, never gated (the formulas skew on short gamified text, see `pipeline/readability.ts`).

## Round 2 results

Round 2 re-wrote the same eight lessons under the writing skills and the lesson-design gate, then ran the three reviews and applied them in two passes: regional and correctness (185 fields), then pedagogy (153 fields and one inserted segment). 389 leaves differ between the authored and the reviewed plans (`rounds/round-2/review/applied-changes.txt`). Everything below is offline and reproducible with `npm run v2:round-report -- --round round-1=curriculum-v2/financial-education/rounds/round-1/plans --round round-2-authored=curriculum-v2/financial-education/rounds/round-2/authored/plans --round round-2-reviewed=curriculum-v2/financial-education/rounds/round-2/reviewed/plans`.

### Round 1 against round 2

| Measure | Round 1 | Round 2 as authored | Round 2 reviewed |
|---|---|---|---|
| Segments | 69 | 83 | 84 |
| Shown (ungraded Mentor turns) / graded | 26 / 43 | 42 / 41 | 43 / 41 |
| Shown share of the lesson | 38% | 51% | 51% |
| Demonstration steps / independent exercises (roles declared) | not declared | 48 / 19 | 49 / 19 |
| Exercises per demonstration step | not declared | 0.40 | 0.39 |
| Segments before the first graded item | 1.9 | 1 | 1 |
| Lessons with a pre item / with a post item | 0 / 1 of 8 | 8 / 8 | 8 / 8 |
| Lessons that declare teaching roles | 0 of 8 | 8 of 8 | 8 of 8 |
| Emit: blocking problems / review items | 0 / 12 | 0 / 12 | 0 / 13 |
| Core graded segments (all three markets) / input states | 129 / 14,484 | 123 / 9,411 | 123 / 9,411 |
| Publish dry run: calls built, calls sent | 24, 0 | 24, 0 | 24, 0 |
| Narration notices (differentiated narration with no audio) | 63 | 36 | 18 |
| Stage 3 review flags on the dry run | 24 | 24 | 24 |

The learner now watches before being asked: ungraded turns went from 26 to 43 and graded items from 43 to 41, so the lesson is 51% shown instead of 38%. Every lesson opens with one `pre` item, ends on a `transfer` item, and declares its order where gate 14 can read it. The review pass added one example turn (see below) and removed 18 notices by moving six reasons out of narration that has no audio and into the line the child reads.

### Per lesson (round 1 to round 2 reviewed)

| Lesson | Mentor, ages | Shown | Graded | Demonstrations / exercises | Longest line es / en / pt (words) |
|---|---|---|---|---|---|
| `fe-1012-01-unit-price` | Liruf, 10-12 | 3 to 5 | 6 to 6 | 6 / 3 | 22 / 20 / 24 |
| `fe-1012-02-plan-the-budget` | Rho, 10-12 | 4 to 6 | 8 to 5 | 7 / 2 | 21 / 20 / 23 |
| `fe-1012-03-saving-plan` | Zara, 10-12 | 3 to 5 | 4 to 5 | 6 / 2 | 22 / 20 / 25 |
| `fe-1012-04-suspicious-messages` | Dina, 10-12 | 4 to 6 | 4 to 4 | 6 / 2 | 15 / 14 / 17 |
| `fe-69-01-count-coins` | Dina, 6-9 | 3 to 6 | 5 to 5 | 7 / 2 | 15 / 12 / 15 |
| `fe-69-02-change-counting-up` | Rho, 6-9 | 3 to 4 | 6 to 6 | 5 / 3 | 14 / 12 / 14 |
| `fe-69-03-needs-and-wants` | Liruf, 6-9 | 3 to 6 | 4 to 5 | 7 / 2 | 12 / 11 / 12 |
| `fe-69-04-market-stall` | Zara, 6-9 | 3 to 5 | 6 to 5 | 5 / 3 | 14 / 12 / 14 |

### What the three reviewers found

| Angle | Findings | What they were |
|---|---|---|
| Regional adaptation and language | 25, plus a taste list and a board-owned backlog (not counted) | A scenario that changed a noun, not a situation; wording a Mexican or Brazilian child would not say; gendered greetings; the board labels listed in the backlog below. |
| Correctness and contract fidelity | 22, including one blocker | The blocker: the rain-jacket item of `fe-69-03` accepted one reason pair while the whole lesson taught another, so a correct sort was marked not met (fixed in the rubric). The rest: typed answers already on screen, `feedback.met` that claims more than the grader verifies, a `pre` whose feedback taught the method. Every number in every market was recomputed and every key was right apart from the blocker. |
| Pedagogy and age fit | 38 | See the next table. |

Round 1 had 146 findings (58 major, 1 blocker). The count is not a stable metric, because the reviewers are different runs and the lessons are different, so it is reported, not used as a target.

### What the pedagogy pass changed

| Theme | What was wrong | What changed |
|---|---|---|
| Examples did not show what the exercise grades | `fe-1012-01` practice grades decimal unit prices and spoilage while the examples used whole numbers and said spoilage in words; `fe-1012-04` guided step grades a message with nothing wrong while no example showed one; "do not reply" was a graded distractor nobody had modelled | Examples now use decimals (2.5 and 2.2), show the spoilage with numbers, add `example-fine-01` (a harmless message from Dad) and say "do not reply" |
| The reason was only in narration | Narration audio is not generated, so `fe-69-01` and `fe-69-04` explained why a move was made where no child could read it | The reason moved into the visible line and those six turns became `text_only`, so their notices disappeared |
| Hooks and steps | "Escucha a Rho" and "Escucha a Zara" repeated on four turns are instructions, not a hook or a step; the `fe-1012-03` example steps were not numbered; its demonstrated check was not the graded one and the savings-line payload (`initial: 20`) contradicted the line's 10 a week | Picture hooks in the three 10-12 lessons that lacked one; "Paso 1" to "Paso 4"; Zara tries 10 a week, expects 60 and checks, which is the graded check, and the payload now says 10 |
| A step leaked the next result | Step expressions such as "60 − 50" and "14 + 8" showed an earlier hidden result | Word labels ("Meta − total redondeado", "Mandarinas + jugo") in `fe-1012-01`, `-02` (four steps) and `-03` |
| `feedback.met` credited the wrong thing | A step the board already showed was praised; `fe-1012-04` called the other messages "safe", a claim a child could not check | `met` names what the child did; "no sign of a trap" replaces "safe" |
| The right choice was always first | `fe-69-02` practice-02 | Reordered, payload and labels together |
| Mentor and voice | The `fe-1012-04` episode disagreed across markets and ended without a commitment; `fe-1012-01` recovery had no next-time line; Liruf's two sorting prompts in `fe-69-03` were flat labels | Episodes agree across markets and end on what the Mentor does next time; Liruf's prompts are small pictures |

### Reviewer strings that broke the budget

Several of the reviewers' replacement strings did not fit the real Copy Budget, so applying them as written would have blocked the build. The real limits (`coursegen/src/contentGates/budgets.ts`) are: a prompt or Mentor line 20 words in en-US and 25 in es-MX and pt-BR at ages 10-12 (12 and 15 at ages 6-9); a `feedback` line (role `body`) is 12 words in en-US and 15 in es-MX and pt-BR at every age. Four replacement strings in the pedagogy pass alone were shortened (`fe-1012-02` transfer `met`, `fe-1012-03` transfer `met` in en-US and pt-BR, `fe-1012-04` guided `met` in en-US). Each applied string was counted with the gate's own word expression before it went in.

### Honest limits of this round

- **The numbers measure structure and length, not whether a child learns more.** Only a native reader and a learner test can say that, and neither has happened.
- **"Segments before the first question" fell from 1.9 to 1 because a graded `pre` item now opens each lesson.** That item is a low-stakes probe, not teaching; the first teaching turn follows it.
- **Lines got longer.** The examples carry their reasoning in visible text, so the longest line sits at or within one word of the limit in several 10-12 lessons (`fe-1012-01` 20 words in en-US, `fe-1012-03` 25 in pt-BR). There is almost no room left to add a word.
- **Longer example runs.** The reviewed `fe-1012-04` has a run of four example turns before its guided step, which gate 14 reports as a review item (13 review items against 12 before). It was accepted because the added turn is the only demonstration of the "nothing wrong" case.
- **The reading-level numbers barely moved** (`report.md`); they are reported, never gated.
- **Regional sign-offs remain.** The 12 lesson-level gate-16 acknowledgements (36 review lines over three markets) and the 24 Stage 3 flag lines on the dry run need a native reader before any lesson is released.
- **Board coverage narrowed.** Round 1 used the opportunity-cost board once, the allocation board once, the running-ledger board twice and the goal-bullet board once; round 2 uses none of them and has 39 Mentor-turn segments where round 1 had 21 (decide-justify items went from 4 to 6). A later round can bring a board back where an example run can carry it.
- **Taste items were not applied.** Five pedagogy findings (17, 19, 23, 34 and 38) and the taste part of a sixth (30) were judged preferences, not defects; three more (1, 28 and 37) were already fixed by the earlier pass. All stay listed in `rounds/round-2/review/pedagogy.md`.
- **A reviewer cannot hear.** Nothing here tests how a Mentor line sounds when it is voiced; narration audio is not generated.

## Engine limits found by the pilot (owner decision backlog)

These are limits of the boards and graders, not of the plans, found by the round-1 and round-2 reviews. A fix is a wire change (Core's body union has no fallback member), so Core must be deployed before the browser. None is fixed in the engine yet; each lesson works inside them.

| Limit | What it costs the lesson | Evidence in round 1 |
|---|---|---|
| No item shows a mixed pile of coins and asks for its total; the coin tray builds a total and the grader reads the tray total. | `money.count-mixed-coins` is evidenced by tray totals only. | `fe-69-01`: the make-an-amount item was retagged `money.make-amount` and the guided item became the only count-mixed-coins item. A given-set counting family would be a new board. |
| Feedback is one static string per step. | A wrong answer cannot be told why it failed beyond the step's single `not_yet`. | Gate 19 requires `feedback.met` to describe what the step verified; reviewers found three steps whose feedback claimed more than the grader checks. |
| `reasoning.decide-justify.v2` grades the choice only; the reason is telemetry. | `feedback.not_yet` shows only after a wrong choice, and `feedback.met` must not praise the reason. | Found in `fe-1012-04` and in the reason-unit of `fe-1012-02`. |
| The worked-example board prints every expression and hides only results, with 3-4 steps and `fade_count` below the step count. | A later expression that contains an earlier result gives it away. | Reported in three of the four numeric lessons in round 1. Round 2 applies the first reviewer fix by hand: word-label expressions for steps whose inputs are earlier answers (`fe-1012-01` guided-02, `fe-1012-02` four steps, `fe-1012-03`). The second fix, a gate that flags a later expression containing an earlier `expectedValue`, is still open. |
| The goal-bullet scorer passes any value in a band; a text answer takes one value. | No exact target, and no multi-value text answer. | `fe-1012-03`: the goal bullet passes any value from 60 to 70. |
| The goal-bullet and savings-line boards print ISO currency codes (`MXN`, `USD`, `BRL`). | Copy that says pesos or reais sits beside the code. | `fe-1012-03`. The stall and stack boards were fixed in this work. |
| Board-owned labels are not reviewed with the plans. | Labels such as `Insumos` (es-MX, pt-BR, `RunningLedgerBoard.tsx`) and the `mm` unit on the coin stack (en-US) escape the plan's copy review. | Cross-lesson note of the regional reviewer, repeated in round 2. |
| Only ungraded demonstrations are Mentor-turn chains. `math.worked-example.v2` is always server-graded, with 3-4 steps, `fade_count` below the step count and step 1 shown. | A `pre` or `transfer` worked example still scaffolds: the step labels give the method away and every step result is public. A demonstration that wants a visual is limited to the slider-gated savings line. | Round 2 builds every demonstration as a chain of Mentor turns, one step per turn, because a turn at ages 6-9 holds one worked step inside the Copy Budget. |
| A graded `pre` item has no skip. | A learner who has never seen the skill must answer anyway; the baseline item is low-stakes only by its feedback wording. | All eight round-2 lessons open with a `pre` item. |
| The market-stall and coin-stack payload is shared by the three markets. | Per-market realism lives only in the copy, the sort labels and the sort `rubric_by_locale`. The stall's `rubric_by_locale` is inert, and a denomination of 5, 10 or 20 is a different coin in each market. Only a 1-coin works across MXN, USD and BRL. | `fe-69-04`; gate 16 also rejects a `fact_refs` id for a denomination, so the coin is not sourced. |
| The unit-price board payload is locale-neutral, so the three markets show the same price numbers. | Regional adaptation of that lesson is the shop, the goods and the final decision, not the arithmetic. | `fe-1012-01`. |
| Gate 19 blocks a number in `feedback.met` that the step does not show, in the coin stack and in `decide-justify`. | A confirmation cannot say a computed value (a total, a remainder) after a right answer. | The `fe-1012-02` transfer was rewritten to confirm the choice, not a computed value. |
| Gate 3 (real-currency facts) covers neither the market stall nor the coin stack. | Market prices there are not checked against a source. | `fe-69-04`. |
| The Copy Budget counts words with `/[\p{L}\p{N}][\p{L}\p{N}'’.,%$-]*/gu` (`contentGates/text.ts`): `÷`, `×`, `−` and `=` are not words, but `$10`, `2.5`, `10,` and `R$` each count as one. A `feedback` line (role `body`) is 12 words in en-US and 15 in es-MX and pt-BR at every age, with no shorter limit for ages 6-9. | A reviewer's better wording often does not fit: many round-2 replacement strings broke gate 13 and were shortened until they passed, and the 6-9 feedback lines have the same room as the 10-12 ones. | Round 2, regional, correctness and pedagogy patches. |

### Gaps no gate tests today (candidates for gate 14)

Round 2 found these by reading, because no check could. Each could ride gate 14 as a review item; none is implemented.

- **Copyable typed answers.** A typed answer that is already on screen, or was said in an earlier turn of the lesson, tests copying, not the skill.
- **Pre-item neutrality.** A `pre` item's feedback should not teach the method the lesson is about to show.
- **`feedback.met` that claims more than the grader verifies.** `decide-justify` verifies the choice only, and the savings-line verifies the total only; `met` may still praise the reason or the method.
- **A sort key that accepts the lesson's own taught reason.** The sort grader cannot tell a reason the learner reasoned from one the lesson just handed over.
- **The example does not show what the exercise grades.** A practice item that grades decimals, spoilage, a "nothing is wrong" case or a "do not reply" distractor, with no earlier example turn that demonstrates it. A check would compare each graded criterion with the example turns' text.
- **A reason only in `narration.script`.** A `differentiated` turn whose visible line gives no reason, so the reason is never read while narration audio is not generated.
- **Correct choice always first.** A decide-justify or reorder set whose keyed option is first in every item of a lesson.

## Open points and how each was resolved

| Open point | Resolution |
|---|---|
| Draft knowledge components (`life.wants-and-choices`, `life.scam-awareness`) and their misconceptions (OD-22) | Proposed, not applied. `coursegen/curriculum-v2/financial-education/kc-misconceptions.proposal.yaml` holds six entries (three draft KCs, two misconceptions each: `life.wants-and-choices`, `life.scam-awareness`, `life.advertising-literacy`) in the exact shape of `database/seeds/kc_graph.v1.json`, each with a source rationale, plus a `held_back` list. It parses, passes the seed's zod rule (hints at most 240 characters, no double quotes, unique `(kc, code)`), and merges into the seed in memory without error. Nothing is written to the seed or to Vault; acceptance stays with the owner under OD-22 and G5. Four things to know before accepting. (1) `life.advertising-literacy` has no pilot lesson, so its entries rest on the KC objective and the legacy topic titles, and the external citations need a check. (2) Nothing in Forge emits `misconception_tags` yet and course-lesson evidence submits null, so the `option_tags` stay inert until tagged items exist. (3) The seed loader upserts draft misconceptions too, so pasting them makes them live in Vault before the KC is activated. (4) Every es-MX and pt-BR string needs a native read. |
| Hierarchy rows and a generator | Done: `v2:hierarchy`, `v2:publish --lesson-ids`. |
| Horizonte types against a live Core | Checked read-only on 2026-10-04. `money.market-stall.v2` and `money.coin-stack.v2` are in Core's source at `2670d911` (`backend/src/services/horizonte/space1/contract.ts`, `forgeV2HorizonteBehaviour/space1.ts`). The `backend CD` run for that commit finished green (`Deploy backend to Railway: success`, 08:59-09:00 UTC; the Railway healthcheck gates the deploy), and `origin/main` (`71706d29`) differs from it by docs only, with no backend change and no later backend deploy. So `--core-has-horizonte` is safe to pass. Residual uncertainty: Core's `/health` envelope (README) is documented as service, version and status, not the git sha, so a manual rollback outside CI would not show here; confirm the Railway deployment shows `2670d911` before the real write. The frontend money-board fix of this work is not deployed yet. |
| No pre items, one post item | Solved in round 2: eight of eight lessons open with a pre item and end on a transfer item; gate 14 blocks the lesson otherwise. |
| Mentors sound alike | Round 2 gives each Mentor a voice card and the pedagogy review checked each lesson against it; the hooks no longer open with "Escucha a ..." and Liruf's prompts are pictures. |
| Regional adaptation is nouns only | Round 2 writes each market's situation, not its nouns, and the scenario text is in the market's own language; 25 regional findings were applied or classified. The 12 lesson-level gate-16 acknowledgements stay until a native reader signs them. |
| Market money | Fixed for the stall and stack boards; goal-bullet and savings-line are in the backlog above. |
| Native es-MX and pt-BR review | A human step: the pilot copy has not been read by a native Mexican or Brazilian reader. Do it before Stage 3 sign-off. |
| Engine limits | The backlog above, for the owner to prioritise. |
