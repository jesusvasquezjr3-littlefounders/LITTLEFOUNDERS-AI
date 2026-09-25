# S05: learning engine and learner experience

Status: in progress. Started 24 September 2026. Owner: Engineering for implementation. Product and pedagogical review, and the owner's review of the B.6 pathway policy (OD-22), are pending. No release approval is recorded.

This is the sprint record for the S05 learning-engine and learner-experience lane. It follows the [S05 lesson-engine design record](S05-LESSON-ENGINE-DESIGN.md), which holds the engine design, the S05.1 and S05.2 checkpoints and the open design questions. B.6 policy detail lives in the [B.6 pathway policy](S05-B6-PATHWAY-POLICY.md).

## Binding acceptance sources

- Product `10` B.6, including the OD-16 amendment, with B.1, B.2 and B.9 where they meet the pathway model.
- Owner log: OD-9 (migrated evidence is never lost), OD-16 (one thematic course with age pathways), OD-22 (B.6: engineering drafts and builds; the owner reviews before release) and OD-23 (zero paid spend).
- Appendix C: the pedagogical review stage is where the topic-to-component map is reviewed.

Risk classification: **learning integrity and minor safeguards.** The pathway rules decide what a child can open and how learning evidence counts. The learner routes adopted them in S05.3b behind the release switch `COURSE_PATHWAY_ENGINE`, which stays `linear` until the owner accepts the policy and the migrations are applied.

## Point-by-point checkpoints

| ID | Scope | Product acceptance | Frontend acceptance | State |
|---|---|---|---|---|
| S05.3a | B.6 policy and data layer | The pathway policy is written as an owner-review proposal, covering eligibility, frontier, placement entry, cross-stage credit, badges and progress, legacy equivalence and migration mapping. It is implemented as pure Core rules. Every one of the 882 curriculum topics is mapped to shared knowledge components (26 of the original 28 components taught, 2 declared content gaps). Additive schema: the topic link table, chapter eligibility columns, stage-entry placements and frozen badges. The strand widening is declared contract. Adversarial tests cover each population, and a no-deadlock simulation runs on the whole real catalog. | None in this checkpoint. The rebuilt pathway screens are wave-2 work on the finished design system. | In progress: implemented and locally verified. Owner policy review, pedagogical review of the map, real-PostgreSQL evidence and route adoption (S05.3b) pending. |
| S05.3b | B.6 route adoption and rebuilt course path | Core computes each learner's frontier from the Mentor's own graph, mastery and review cards, and serves it through the shelf, the course tree and a new course-path endpoint. The four lesson endpoints, placement, completion and the Family Hub kid view use the same pathway tree. Placement writes a per-stage entry through an extended B.1 transaction that refuses credit outside the stage. Progress and badges come from pathway completion; badges are stored and never revoked. Age filters chapters as a safeguard only. B.2 uses cross-stage rule P7. Everything sits behind `COURSE_PATHWAY_ENGINE` (default `linear`). Adversarial route tests cover every population named in the checkpoint. | A self-contained rebuilt course path in `rebuild/learning` with a validated client, three-locale copy within the youngest Copy Budget, light and dark themes, and every state the server can return. Real-Chrome matrix 540/540 and proportion audit 120/120 with no findings. Wave-2 composition on the finished design system is pending. | In progress: implemented and locally verified. Owner policy review (OD-22), real-PostgreSQL evidence, course-lesson evidence into the Mentor's BKT, human visual review and wave-2 composition pending. |

## S05.3a: B.6 pathway policy and data layer

### Implementation and rationale

**Current state checked in the code first.** The Mentor's graph has 28 knowledge components, 36 edges and 32 misconceptions, with BKT mastery, FSRS cards and an evidence log. 24 of the 28 components have a content bridge (`kc.skill_key`). The course engine is a single flat lesson order and reads none of that. The curriculum has 882 topics (609 teaching, 273 review) and 2,462 lessons in 4 courses. Two gaps that the SPEC does not mention came up:

- Course badges are derived live, so any catalog growth would revoke them.
- The B.2 prerequisite route asks everyone, adults included, for the badge of the whole children's course.

The policy document records both, with rules that address them (B4/B5 and P7).

**Policy (proposal).** [S05-B6-PATHWAY-POLICY.md](S05-B6-PATHWAY-POLICY.md) sets out the numbered rules:

- P1–P7: chapter policy, age evidence, stage, safeguard, pathway resolution, placement as the entry point, and course prerequisites across stages.
- E1–E2: evidence.
- F1–F7: the frontier.
- B1–B5: progress and badges.
- T1–T4: stage transitions.
- G1–G6: graph authoring.

It also covers the OD-9 equivalence table, the migration mapping, the order of the production rollout and eight owner questions, each with the default currently implemented.

**One brain, not two.** No second model was added. The course reads prerequisites from `kc_edge`, "already known" from `learner_kc_mastery` at the Mentor's own 0.80 bar, and due reviews from `memory_card`. A topic reaches the graph only through the new `topic_knowledge_components` table.

**The map.** 72 new knowledge components were written by hand at zero spend, in three locales:

- `money_life`: 25
- `entrepreneurship`: 28
- `investing`: 18
- `money_math`: 1

A component is a concept taught at different depths in different stages, not a copy of a topic. Every teaching topic lists its components, with the first as primary. Review topics inherit what they review. The two review quests that the Mentor's 2026-09-01 lesson-level check found to teach something new keep that as explicit teaching. `money.percent-intro` and `biz.risk-and-reward` now reach content through teen topics. Their Mentor bridge stays null because Mentor tier 3 includes 10-year-olds. `money.fraction-of-amount` and `biz.goods-vs-services` are declared content gaps with reasons, instead of being left as silent nulls.

**Safe to seed before acceptance.** New components are `draft`. The Mentor's planner, its map and the `kc` RLS policy read only active components, and the drafts have no `skill_key`. A seed rule refuses any edge where a draft would be a prerequisite of an active component. So activating the drafts later can only add reachable ground; it can never re-lock work learners are doing now.

**The frontier cannot deadlock.** Running the first frontier design on the real catalog deadlocked every production course. The shared graph and the authored order disagree for 63 topics; for example, the 0052 graph requires mixed-coin totals before comparing amounts, while financial education teaches comparing first. The final rule (F2/F3) lets a prerequisite block a topic only when an earlier topic in the pathway teaches it. So the earliest incomplete topic is always open, and nothing outside the learner's pathway is ever required (OD-16). The 63 conflicts are listed for pedagogical review, not settled here.

**Schema, all additive except one widening.**

- `*_b6_pathway_data_layer.sql` (expand) adds:
  - `topic_knowledge_components`: one primary per topic; a primary must be *teaches*; mapped components can only be retired, not deleted; readable only for active components.
  - `adventures.pathway_stage` and `eligibility_min_age` / `eligibility_max_age`, all-or-nothing.
  - `course_pathway_placements`.
  - `course_pathway_badges`, with an idempotent backfill that freezes every badge the live rule grants today.
- `*_kc_strand_widening.sql` (contract) widens `kc.strand` to four values. The phase gate treats any CHECK replacement as contract, so it needs operator review.
- `database/types/database.ts` was not edited. It must be regenerated at integration.

**Seed and gates.**

- `seed:kc` now validates the map against the graph before writing anything. It writes the links in two passes (demote, then promote primaries), reports stale links without deleting them, and fails on any published topic that has no mapping.
- Coursegen gains `npm run kc:map`. It checks that the map matches the YAML topic for topic (kind, `review_of`, hard prerequisites, order, a component on every teaching topic) and refreshes those repeated facts with `--write`, never inventing a component.
- CI path filters now run backend and coursegen CI when `database/seeds/**` changes.

### Verification log

Executed 24 September 2026 in the lane worktree, with thread limits of 3 per test runner. These are local results, not CI or production observations. No database was used; the shared Docker stack was not touched, and no provider was called.

| Boundary | Command / evidence | Result |
|---|---|---|
| Pathway policy (fixtures + real catalog) | `backend/`: `npx vitest run src/services/pathway` | 3 files, 64 tests passed. Covers P1–P7, E, F1–F7 and B1–B5 across these populations: 7-year-old created by a parent, refusal-path guest, independent teen aged 15, 10-, 11- and 12-year-olds, adult, and verified-parent Tutor (role-free). Also checks legacy % parity with `assembleCourseTree` and OD-9 coverage. The no-deadlock simulation runs on the whole real catalog for 7 course/age populations × 2 selection strategies, with every pathway reaching 100%. |
| Seed rules | `backend/`: `npx vitest run src/__tests__/seedKcGraph.test.ts` | 11 tests passed: acyclic, no tier inversion, no draft gating an active component, strands, status default. |
| First deadlock run (resolved) | Same suite before the F2/F3 revision | 8 failures: 6 real-catalog deadlocks plus 2 fixture expectations. Resolved by the authored-order gating rule; the 63 conflicting topics are documented in the policy. |
| Map ↔ curriculum | `coursegen/`: `npm run kc:map` and `npx vitest run src/__tests__/kcTopicMap.test.ts` | `kc:map OK — 4 courses, 882 topics in sync`; 6 tests passed, including a byte-for-byte `--write` round trip and 8 drift classes. |
| Core regression | `backend/`: `npm test` | 73 files passed and 1 skipped; 1,539 tests passed and 1 documented skip. `contract:check` passed (8 files and 8 core symbols match the frontend lesson engine). |
| Core static checks | `backend/`: `npm run type-check`, `npm run lint` | Passed |
| Forge regression | `coursegen/`: `npm test` | 46 files, 668 tests passed |
| Forge static checks | `coursegen/`: `npm run type-check`, `npm run lint` | Passed |
| Migration gates | `database/`: `npm test` (Git Bash on `PATH`) | Migrations OK: 113 files; sequential numbering, RLS coverage and append-only audit pass. Phase gate: 92 expand and 21 contract; the new data-layer migration is expand and the strand widening is a pending contract. 21 Node checks passed, and 12 Railway transport scenarios passed. Two extra standalone reruns of `railway-migrate.test.mjs`, started while the full gate was still running, failed an assertion; the likely cause is contention between the concurrent runs, not the migrations. The full gate passed on its own and is the evidence. |
| Repository gates | Root: `npm run spec:check`, `npm run secrets:check` | Specification OK (checksums, agent parity, 113 headings, UI boundary, v2 parity, tokens, assets); secrets OK. The i18n gate does not apply: no copy changed. |

### Remaining limitations

- **Owner review (OD-22).** The whole policy, including the eight questions, is a proposal. The 72 components stay draft until it is accepted.
- **Pedagogical review.** Map links other than the 24 lesson-verified Mentor bridges were written from topic blueprints. They have not been checked against published `lesson_documents`, which this lane cannot read. The 63 graph-versus-order conflicts need a decision for each pair. The new components' BKT parameters are the uncalibrated defaults.
- **Physical PostgreSQL.** Neither migration has been applied to a database. The badge backfill, constraints, RLS and the seed's PostgREST embedding query need disposable-database evidence. Types need regenerating.
- **Route adoption (S05.3b).** The course tree, lesson admission, placement, badge routes and the B.2 check still run the linear model. Graded course lessons do not yet feed the Mentor's BKT or review cards.
- **Content.** There are no tween (10–12) or adult chapters, and two components have no topic. OD-16 requires both to be authored before release (Forge phase, OD-23).

## S05.3b: B.6 route adoption and the rebuilt course path

### Implementation and rationale

**Current state checked first.** After S05.3a, every learner route still ran the flat linear order. Four more facts came out of reading the code:

- The Family Hub kid tree was built without the kid's placement credits, so a guardian saw less progress than the kid. It now reads the kid's credits (this fix applies to the linear engine too).
- The B.2 check read badges with a helper that turns a failed read into "no badges".
- `get_completed_course_badges` still derived badges live only, so the frozen rows from S05.3a were not visible to any reader.
- Placement always walked every chapter of the course, whatever the learner's age.

**The release switch (OD-22).** `COURSE_PATHWAY_ENGINE` (`linear` by default, `pathway` to enable) is a validated Core config value. In `linear` mode every route behaves exactly as before S05.3b and reads none of the B.6 tables, so this code can deploy before the migrations are applied. The course-path endpoint answers `PATHWAY_ENGINE_DISABLED`, and the client route sends the learner to the existing course page. The switch is the rollback too: every row the pathway engine writes is valid under the linear engine.

**One brain.** `services/pathway/pathwayData.ts` reads the Mentor's own rows with the Mentor's own accessors: active KCs, edges whose two ends are active, `learner_kc_mastery` and due `memory_card` rows. It also reads the B.6 tables and the learner's badges. A topic link to a draft KC does not exist for the course, just as it does not for the Mentor. Any failed read answers 502; it never collapses to "nothing known", which would re-lock work the learner has shown. Age evidence is read on the server (birth date with the service role, the stored age screen) and never leaves Core. Only the resulting stage is served.

**The engine on the tree.** `services/pathway/coursePathway.ts` applies the S05.3a rules to the tree every route already serves, keeping its shape:

- Lesson state comes from the frontier (F1–F8). The first pathway item is `current`, other offered lessons are `available`, passes and credits stay `passed`, and everything else is locked. Every lesson in a closed chapter is locked, whatever the learner has shown.
- Chapter access (pathway, optional, closed) comes from P1–P5.
- Progress is the pathway's (B1–B3), so another stage's lessons are never in the denominator.
- Placement is required per pathway stage (P6). A B.1 course placement counts for the stage the course's legacy chapters formed.
- The badge decision is the staged credential (B4). A legacy live badge counts as that stage already earned (B5).
- The stage-entry placement gets a prior from graph evidence (Mentor mastery, skills shown in another stage). It only moves the first question, like every placement signal.

**New rule F8: a skill already shown is never locked.** Running the engine against the checkpoint's third claim showed that F1–F7 alone could lock a topic whose skills the Mentor already holds, when that topic was not yet the next step of its saga. F8 opens such a topic's first unfinished lesson as "known". It is never recommended ahead of the frontier and never completed by that evidence (B2). The policy document records it.

**Routes (one decision everywhere).**

- `GET /learn/courses`: each course carries the learner's stage, the course's pathway stage, the basis and the recommended lesson. A course unavailable for the learner's age stays listed, marked `unavailable`, so nothing silently disappears.
- `GET /learn/courses/:slug/tree` and the new `GET /learn/courses/:slug/path`: `courseEntry` decides first. A course with no open chapter answers `COURSE_AGE_RESTRICTED`. B.2 then applies P7: a badge of the required course from any stage satisfies it; the requirement is waived when the required course would be a younger bridge for this learner; otherwise `COURSE_PREREQUISITE_REQUIRED` names what is missing. Unknown or unpublished prerequisites stay missing. `/path` projects the tree to one learner-sized answer: chapters with access, offered items with titles and minutes, blocked topics with the skills and topics they wait on, and the path's skills with how each is shown. It carries no age, birth date or score.
- The four lesson endpoints (open, grade, v2 grade, complete) share `lessonAdmissionRefusal`. A lesson in an age-closed chapter answers `LESSON_AGE_RESTRICTED` before anything else; a locked lesson answers `LESSON_LOCKED`; a missing stage placement answers `PLACEMENT_REQUIRED`.
- Placement (start, step, commit) walks only the pathway stage's chapters. It refuses an age-closed course, feeds the graph prior as a signal, and commits through `commit_course_pathway_placement`.
- Completion (v1 and v2) settles badges after the write. So do placement and the course read, so an interrupted write converges on the next visit. A failed badge write is logged and retried; it never fails a completion that is already committed.
- The Family Hub kid tree applies the **kid's** own pathway: the kid's age evidence, mastery and badges, read with the service role after the verified-link guard. The parent's own age never enters it.

**Database (`*_b6_pathway_route_adoption.sql`, expand).**

- `get_completed_course_badges` keeps its signature and row shape. It returns stored badges plus the 0043 live rule, dated by the earliest earning. Every existing reader (profile, badge share, public badge page, B.2) therefore keeps a badge that catalog growth would otherwise revoke (OD-9), and no badge that exists today disappears.
- `commit_course_pathway_placement` is B.1's atomic commit extended per (course, stage). It writes the stage entry row, writes B.1's course row only when absent (so switching back to `linear` still finds the learner placed), and adds credits without touching earlier ones. It refuses any credit outside the course's published lessons of that stage, so even a Core defect cannot credit an adult with childhood chapters or a minor with adult ones. A replay returns `replayed`; a different second placement for the same stage returns `conflict`.
- Both functions are `SECURITY DEFINER` and executable by `service_role` only, like their predecessors. The fake PostgREST double in the Core tests mirrors the refusals Core relies on.

**Rebuilt course path (frontend).**

- `rebuild/learning/coursePath.ts` is the client. A zod schema checks the server shape; each Core refusal (age, prerequisite, disabled, error) maps to its own state; a malformed payload is an error, never a partial screen. Transport is injected, so the module imports nothing from the legacy app.
- `CoursePathView.tsx` is presentation only. It leads with the one recommended step (or placement first, or a stated, uncelebrated "path complete"). Other open lessons are real choices, with two shown first for a child and four for older learners. It also shows the chapters with access, a count of closed chapters (never their lessons), and the path's skills, including "Shown with your Mentor". Copy is in three locales, with the controlled glossary (Mentor, never Tutor), no lives and no celebration.
- `routes/app/learn/CoursePathRoute.tsx` is the thin authenticated wrapper at `/learn/:courseSlug/path`. The preview entry renders every fixture state (`rebuild.html?screen=coursepath&path=child|bridge|placement|adult|complete|age|prerequisite|error|loading`).
- The fixture helper was renamed from `t` to `loc` after the i18n key scanner read its catalog titles as missing translation keys.

### Verification log

Executed 24 September 2026 in the lane worktree with thread limits of 3 per test runner. These are local results, not CI or production observations. No database was used, the shared Docker stack was not touched, and no provider was called (OD-23).

| Boundary | Command / evidence | Result |
|---|---|---|
| Pathway engine and rules | `backend/`: `npx vitest run src/services/pathway src/__tests__/learnPathway.test.ts` | 5 files, 106 tests passed. `coursePathway.test.ts` (23): the four checkpoint claims on fixtures, including an adult credential with no child or teen lesson, an adult placement that credits only adult topics, the refusal-path guest and parent-created 7-year-old, Mentor mastery at 0.80 never locked and never completing a topic, legacy % parity for every age, T4 evidence retention, and immutability. The real-catalog runs follow the recommendation to 100% and the stage badge for financial education at 8 and for investing at 15 and 34. Entrepreneurship at 12 also reaches 100% and the badge. A random-mastery sweep checks that no fully shown topic is ever locked. |
| Route boundary, per population | same command, `learnPathway.test.ts` (19) | Direct API requests. Linear stays the default and `/path` is refused. For the parent-created 7-year-old and the guest, teen and adult lessons answer `LESSON_AGE_RESTRICTED` on open and complete, no progress is written, and the teen-only course refuses tree, placement step and commit. The independent teen completes the teen pathway, earns the teen badge, and cannot open adult lessons. For the adult and the verified-parent Tutor, the adult stage needs its own placement, and placement answers can credit adult topics only. P7 lets an adult enter investing without the children's or 12–18 course; a teen is waived the children's course but needs the own-stage one; a 12-year-old with early entry still needs it. Mentor mastery opens the topic on the tree and at the lesson gate; draft KCs are ignored; a failed mastery read is a 502. Legacy badge frozen and dated; earlier-stage credits kept; a replay neither duplicates the badge nor changes XP. The shelf marks the age-closed course; `/path` carries no age; a guardian sees the kid's pathway. |
| Core regression | `backend/`: `npm test` | `contract:check` passed. 75 files passed and 1 skipped; 1,581 tests passed and 1 documented skip (the opt-in PostgreSQL placement audit). |
| Core static checks | `backend/`: `npm run type-check`, `npm run lint` | Passed |
| Course path client and view | `frontend/`: `npx vitest run src/rebuild/learning/CoursePathView.test.tsx` | 12 tests passed. Copy Budget at 6–9 for every string in 3 locales with the glossary check, schema acceptance and rejection, every refusal state, the locale fallback, layering, placement first, a finished path without celebration, a retry only on error, and a copy role on every text node. |
| Frontend regression | `frontend/`: `npm test` | 212 files, 2,201 tests passed |
| Frontend static checks | `frontend/`: `npm run type-check`, `npm run lint` | Passed |
| Real Chrome | `frontend/`: `REBUILD_URL=http://localhost:5320 REPORT_DIR=../.lane-cache/rebuild-course-path node scripts/verify-rebuild-course-path.mjs` | 540/540 configurations, 0 findings: 9 states × 3 locales × 2 themes × 320/375/768/1280 px × 100%/140% text, plus WCAG 1.4.12 spacing at 375 px. Checked: Copy Budget per role and band, first-view word limit, clipping, 14 px minimum, 48 px targets, copy roles, horizontal scroll, keyboard Tab + Enter on the recommendation with a visible focus ring, no motion under reduced motion, and Show more announced as expanded. The es-MX 375 px child (light) and adult (dark) captures and the en-US 1280 px child (dark) capture were inspected by eye: no clipping or overlap, readable tags, and closed chapters only counted. |
| Proportions | `frontend/`: `REBUILD_PROPORTIONS_SCOPE=course-path node scripts/verify-rebuild-proportions.mjs` (new scope), then the unscoped run | Course path 120/120, 0 findings (4 px grid, type scale, heading/body ratio, accent competition, 8 px tap gaps). The full audit, now including the course path, ran 864/864 with 0 findings. |
| i18n | Root: `bash agent/tools/check-i18n.sh` (Git Bash) | First run failed: 27 "missing t() keys" were the fixture helper's catalog titles, a scanner false positive. After renaming the helper to `loc`, all three phases passed. |
| Migration gates | `database/`: `node scripts/check-migrations.mjs`, `node scripts/check-migration-phase.mjs`, `node --test` on the three script tests, `node scripts/railway-migrate.test.mjs` | Migrations OK: 114 files, including sequential numbering, RLS coverage and append-only audit. Phase gate: 93 expand and 21 contract; the route-adoption migration is expand. 21 Node checks passed. The full `npm test` gate passed, including the Railway runner: 12 transport scenarios plus the static cross-checks. It took about an hour because five lanes were running the same test at once. |
| Repository gates | Root: `npm run spec:check`, `npm run secrets:check` | Specification OK (checksums, agent parity, 113 headings, UI boundary, v2 parity, tokens, assets); secrets OK (rerun on the staged tree before the commit). |

### Remaining limitations

- **Owner review (OD-22).** The policy, including the new rule F8 and questions 9 and 10, is a proposal. The engine stays off (`linear`) until the owner accepts it.
- **Physical PostgreSQL.** None of the three B.6 migrations has been applied to a database. The stored-union badge function, the stage placement function's refusals and its `ON CONFLICT` paths, and the frozen-badge backfill need disposable-database evidence. `database/types` must be regenerated at integration.
- **Course lessons into the Mentor.** The course reads the Mentor's mastery and review cards, but graded course lessons do not yet update them (owner question 9). Until they do, the course's own evidence is topic completion.
- **Content.** There are no tween or adult chapters. Adults and 10–12-year-olds take younger-bridge pathways, reported as content gaps.
- **UI.** The course path is a self-contained surface reached only by its URL. Wave 2 composes it on the finished design system and links it from the shelf and the course page. Owner visual review, assistive-technology review and real-device checks are open. The legacy course page still renders the tree's lock state, which follows the pathway engine when the switch is on.
- **B.1 row.** The stage-entry placement extends B.1's transaction. The B.1 requirement row (owned by S02) is not changed here; its release evidence still applies to the linear commit.
