# S05: learning engine and learner experience

Status: in progress. Started 24 September 2026. Owner: Engineering for implementation. Product and pedagogical review, and the owner's review of the B.6 pathway policy (OD-22), are pending. No release approval is recorded.

This is the sprint record for the S05 learning-engine and learner-experience lane. It follows the [S05 lesson-engine design record](S05-LESSON-ENGINE-DESIGN.md), which holds the engine design, the S05.1 and S05.2 checkpoints and the open design questions. B.6 policy detail lives in the [B.6 pathway policy](S05-B6-PATHWAY-POLICY.md).

## Binding acceptance sources

- Product `10` B.6, including the OD-16 amendment, with B.1, B.2 and B.9 where they meet the pathway model.
- Owner log: OD-9 (migrated evidence is never lost), OD-16 (one thematic course with age pathways), OD-22 (B.6: engineering drafts and builds; the owner reviews before release) and OD-23 (zero paid spend).
- Appendix C: the pedagogical review stage is where the topic-to-component map is reviewed.

Risk classification: **learning integrity and minor safeguards.** The pathway rules decide what a child can open and how learning evidence counts. The data added here is inert until the learner routes adopt it.

## Point-by-point checkpoints

| ID | Scope | Product acceptance | Frontend acceptance | State |
|---|---|---|---|---|
| S05.3a | B.6 policy and data layer | The pathway policy is written as an owner-review proposal, covering eligibility, frontier, placement entry, cross-stage credit, badges and progress, legacy equivalence and migration mapping. It is implemented as pure Core rules. Every one of the 882 curriculum topics is mapped to shared knowledge components (26 of the original 28 components taught, 2 declared content gaps). Additive schema: the topic link table, chapter eligibility columns, stage-entry placements and frozen badges. The strand widening is declared contract. Adversarial tests cover each population, and a no-deadlock simulation runs on the whole real catalog. | None in this checkpoint. The rebuilt pathway screens are wave-2 work on the finished design system. | In progress: implemented and locally verified. Owner policy review, pedagogical review of the map, real-PostgreSQL evidence and route adoption (S05.3b) pending. |

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
