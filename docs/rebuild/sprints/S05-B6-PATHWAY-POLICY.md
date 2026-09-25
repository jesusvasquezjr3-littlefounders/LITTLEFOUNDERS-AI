# S05: B.6 age-pathway policy on the shared knowledge graph

**Status: engineering proposal awaiting owner review (OD-22).** Engineering drafted this policy and implemented its data layer on the Mentor's knowledge-component graph. It is not an accepted release policy. The owner reviews the policy and its evidence before the new catalog is released. S05.3a added the policy and its data layer. S05.3b wired the learner routes to the policy behind one release switch, `COURSE_PATHWAY_ENGINE` (default `linear`). Until an operator sets it to `pathway`, after the owner accepts the policy and the B.6 migrations are applied, a learner sees the legacy linear course. The 72 new knowledge components stay `draft`, so the Mentor's view does not change either.

**Authority:** Product `10` B.6 (with the OD-16 amendment), B.1, B.2 and B.9; OD-9 (no loss of learning evidence), OD-16 (one course, age-appropriate pathways), OD-22 (draft, then build, then owner review) and OD-23 (no paid spend); Appendix C (Stage 3 pedagogical review). Frontend Bible registers set the stage ages. Where this document and the SPEC disagree, the SPEC wins.

**Sprint record:** [S05 learning experience, checkpoints S05.3a and S05.3b](S05-LEARNING-EXPERIENCE.md). **Design context:** [S05 lesson-engine design](S05-LESSON-ENGINE-DESIGN.md).

## 1. What B.6 requires

The course engine must stop being a second, linear learning model. Its progression must run on the Mentor's knowledge-component graph, mastery model and review cards. That means four things:

1. Every published topic is mapped to the shared knowledge components.
2. A frontier of available next lessons replaces the single "current lesson".
3. Placement becomes the learner's entry point into the graph.
4. Course badges and progress percentages are defined against graph completion.

OD-16 adds age pathways inside one course. The shared graph and placement decide where an eligible learner starts. An adult does not have to complete childhood chapters, and a minor's completion never depends on adult chapters. Age is a safeguard, not a stand-in for mastery. OD-9 forbids losing existing learning evidence.

## 2. Verified current state (24 September 2026)

The SPEC's "Current State" is mostly still accurate. The details below come from reading the code, not from the SPEC.

| Area | What the code does | Evidence |
|---|---|---|
| Mentor graph | 28 knowledge components, 36 prerequisite edges and 32 misconceptions, with BKT mastery (`learner_kc_mastery`), FSRS review cards (`memory_card`) and an evidence log (`kc_attempt`). The Mentor's planner reads only `active` components and drops any edge whose ends are not both active. | `database/migrations/0052_kc_graph.sql`, `database/seeds/kc_graph.v1.json`, `backend/src/services/pedagogy/sessionPlan.ts`, `tutorMap.ts` |
| Mentor-to-content bridge | `kc.skill_key` points 24 of the 28 components at one topic each. The other 4 are null on purpose: the lesson-level audit of 2026-09-01 found no child-age topic that teaches them. | `backend/src/services/contentBridgeAudit.ts` |
| Catalog | 4 courses, 882 topics (609 teaching, 273 review) and 2,462 lessons in the authored curriculum. Financial education uses legacy tiers 1 (ages 6–7) and 2 (ages 8–10). Investing and entrepreneurship use tier 4 (ages 12–18). The lemonade stand is tier 2. No course has tween-only or adult chapters. | `coursegen/curriculum/*` (catalog, taxonomy and adventure YAML files) |
| Course progression | Lesson state comes from one flat order of every lesson in the course. Progress = lessons passed or placement-credited ÷ all lessons in the course. | `backend/src/services/courseTree.ts`, `unlockRules.ts` |
| Placement | Placement searches one "known up to topic k" point over the course's topic order. It writes one `course_placements` row per course and records skipped lessons in `placement_credits`. | `backend/src/services/placementAlgorithm.ts`, migrations 0043 and 0091 |
| Course badges | Badges are calculated live by `get_completed_course_badges` and never stored. **New finding:** if a single lesson is added to a finished course, every badge on that course disappears. The catalog expansion that OD-16 plans would do exactly that, which OD-9 forbids. | migrations 0039 and 0043 |
| Two brains | Nothing in the course engine reads the Mentor's graph, mastery or review cards. | code search |

## 3. Definitions

- **Stage:** one of four age registers from the Frontend Bible and the v2 `age_band`: child (6–9), tween (10–12), teen (13–17) and adult (18+).
- **Chapter:** an adventure. Each chapter has a stage and an age range. A new chapter declares `pathway_stage`, `eligibility_min_age` and `eligibility_max_age`. A legacy chapter gets these from its `age_tier`.
- **Pathway:** the chapters of one course that a learner's completion is measured against.
- **Topic link:** a row in `topic_knowledge_components`. It says that a topic *teaches* or *reviews* a shared knowledge component (KC).

## 4. The policy

Each numbered rule is implemented in `backend/src/services/pathway/pathwayPolicy.ts` or `kcTopicMap.ts` and tested in the `.test.ts` file beside it.

### Eligibility and pathway (P1–P7)

- **P1 (chapter policy).** If a chapter has explicit pathway columns, they are used. They must be complete, and the age range must overlap the chapter's own stage. A chapter with half-filled or contradictory columns is closed. It is never guessed. Legacy chapters keep the ages their taxonomy declared:

  | Tier | Stage | Ages |
  |---|---|---|
  | tier1 | child | 6–7 |
  | tier2 | child | 8–10 |
  | tier3 | tween | 11–12 (no catalog uses this tier) |
  | tier4 | teen | 12–18 |

- **P2 (age evidence).** Age evidence follows age, not account role. A valid birth date gives an exact age. Without one, the declared age band gives a range. An account created through the under-13 refusal path (A.2) is capped at age 12, whatever date or band was entered. Age evidence stays on the server, as in S05.2a.
- **P3 (learner stage).** The learner's stage is the stage of the youngest age the evidence allows. If nothing is known, the learner is treated as a child.
- **P4 (safeguard).** Child chapters are open to everyone. Any other chapter opens only when the youngest possible age meets its minimum age. Unknown age opens nothing above the child stage. Evidence of mastery never opens a closed chapter.
- **P5 (pathway resolution).** For each course, the pathway is chosen in this order:
  1. The open chapters of the learner's own stage.
  2. If there are none, the nearest younger stage that has open chapters. This is a "younger bridge" and is recorded as a content gap.
  3. If there are none, the nearest older stage whose minimum age the learner meets. This is "early entry".
  4. If there are none, the course is unavailable to this learner.

  Any other open chapter is optional: the learner can play it, but it is never required and never counted in progress. With today's catalog:

  | Learner | Financial education | Investing and entrepreneurship |
  |---|---|---|
  | Child (6–9) | own stage | unavailable |
  | 10–11 | younger bridge | unavailable |
  | 12 | younger bridge | early entry |
  | Teen (13–17) | younger bridge | own stage |
  | Adult | younger bridge | younger bridge |

  Every "younger bridge" entry is a content gap that OD-16 requires to be authored before the new catalog is released.
- **P7 (course prerequisites across stages, B.2 × OD-16).** A course-level `requires` is satisfied by a badge for the required course from any stage, including a frozen legacy badge. It is waived when the learner's pathway in the required course would be a younger bridge. It is missing otherwise. **New finding:** the S05.2ba route asks everyone for the required course's badge. Under that rule a 15-year-old or an adult must finish the whole children's financial-education course (1,312 lessons) before investing, which contradicts OD-16. With P7, a teen still needs entrepreneurship (their own stage) but not financial education. An adult needs neither; what those courses teach still reaches the adult through the graph (F2, F5). A 12-year-old with early entry still needs entrepreneurship.
- **P6 (placement as the graph entry point).** Each (course, stage) pathway has one entry placement, stored in `course_pathway_placements`. It orders the pathway's topics by pathway order (F1). Mentor mastery and knowledge components already shown in another stage only choose where the first question is asked, as the existing placement design says ("signals are priors, never verdicts"). The credits it grants are written to `placement_credits` as they are today. A legacy `course_placements` row counts as the entry placement for the stage the course's chapters had at cutover. When a learner reaches a new stage, they get a new entry placement for that stage; earlier placements and credits stay.

### Evidence (E1–E2)

- **E1.** A topic is complete when every live lesson in it is passed (`lesson_progress`) or placement-credited (`placement_credits`). This is the same rule as today.
- **E2.** A knowledge component is satisfied when either of these holds:
  - a complete topic in any open chapter teaches it (course evidence);
  - the Mentor's BKT estimate is at least the Mentor's own prerequisite threshold (`MASTERY_PREREQ_THRESHOLD` = 0.80).

  Because of the second condition, the course can never show as locked something the Mentor already counts as mastered.

### Frontier (F1–F7)

- **F1.** Pathway order is the authored order: chapter, then saga, then topic. Each saga contributes at most its first incomplete topic, so the story inside a saga stays in order (B.9). Lessons inside a topic stay in order.
- **F2.** A topic's prerequisites are the graph prerequisites of every knowledge component it teaches, not counting the components it teaches itself. A prerequisite **blocks** the topic only when an earlier topic in the pathway teaches it and it is not yet satisfied. If nothing earlier in the pathway teaches it (a content gap, another course, or a younger stage), it is advisory only and never blocks. Where the shared graph and the authored order disagree, the authored order decides what is locked.
- **F3.** Hard prerequisites written in the YAML, and review citations, block in the same way: only when they point at an earlier pathway topic that is neither complete nor fully satisfied.
- **F4.** Chapters are no longer locked in sequence. Every open saga in every pathway chapter is on the frontier, in pathway order. The first item is the recommendation, and the others are real choices (B.24).
- **F5.** When an advisory prerequisite is still unsatisfied, the first incomplete topic in an optional chapter that teaches it is offered as a "bridge", after the pathway items. It is never required.
- **F6.** When a Mentor review card is due for a knowledge component, the first open review topic that reviews that component is moved to the front, marked review-due. At most one item is promoted this way.
- **F7 (no deadlock).** The earliest incomplete topic in a pathway only ever waits on earlier topics, and those are all complete. So the frontier is empty only when the pathway is complete. A test checks this on the whole real catalog.
- **F8 (a skill already shown is never locked; added in S05.3b).** If every knowledge component a topic teaches is already satisfied (E2: a complete topic in any open chapter, or the Mentor's estimate at its 0.80 bar), the topic's first unfinished lesson is open, even when it is not yet the next step of its saga. It is marked "known", it is never recommended ahead of the frontier, and it is never completed by that evidence (B2): the learner can play it, and completion still needs graded lessons or placement credit. This rule makes "mastered with the Mentor but locked on the course path" impossible. A closed chapter stays closed (P4). A test checks it on the whole financial-education catalog with random Mentor mastery.

### Progress, completion and badges (B1–B5)

- **B1.** Progress % = lessons passed or credited in pathway chapters ÷ lessons in pathway chapters. For a course whose chapters are all in one stage, this equals today's formula exactly, so no migrated percentage changes. A test compares it with `assembleCourseTree`.
- **B2.** A pathway is complete, graph-wise, when every one of its topics is complete. At that point every knowledge component the pathway teaches has been shown through its own graded topics or placement credits. Mentor mastery alone satisfies prerequisites but never completes a pathway topic. The engine also reports the number of components the pathway teaches and how many are satisfied, as a graph view of progress.
- **B3.** Optional and closed chapters are never counted in a denominator.
- **B4.** A course badge is a credential for a stage. It is earned once, recorded in `course_pathway_badges`, and never revoked: not by catalog growth, an age change or a map revision. An unavailable pathway can never earn a badge. A younger-bridge pathway can: today's adults keep today's badges, and the case is reported as a content gap.
- **B5.** Before the learner routes adopt these rules, the migration freezes every badge the live rule grants today as a `legacy` row, together with the stage its chapters formed. That legacy row counts as the credential for that stage.

### Stage transitions (T1–T4)

- **T1.** The stage is recalculated on the server on every read. A birthday moves the pathway forward.
- **T2.** Chapters from the earlier stage become optional, never closed. Their completed topics, progress and badges stay as they are.
- **T3.** Knowledge components satisfied in an earlier stage keep satisfying prerequisites in the new stage. The new stage's own topics are **not** credited automatically, because an older-stage topic teaches more depth. The new stage's entry placement (P6) credits what the learner can show.
- **T4.** If a corrected birth date lowers the learner's age, chapters above the new stage close. No evidence is deleted.

### Graph authoring rules (G1–G6)

- **G1.** Each teaching topic lists one or more knowledge components. The first one is the topic's primary component.
- **G2.** Review topics get their links from what they review: every teaching topic of a cited saga, or a cited topic, following cited review topics. A review quest can also list components that its own lessons were checked (at the lesson level) to teach as new material.
- **G3.** Every knowledge component is taught by at least one topic or is listed as a content gap with a reason. A listed gap can never be taught.
- **G4.** The Mentor's bridge (`kc.skill_key`) must point at a topic that the course map links to the same component. This stops the two systems from disagreeing about where a component is taught.
- **G5.** New components stay `draft` until the owner accepts this policy. A draft component can never be a prerequisite of an active one, so activating the drafts can never re-lock an active component that learners are already working on. Activation is done by editing the seed file and re-running the seed, never by a manual SQL update.
- **G6.** The YAML owns each topic's kind, `review_of` and hard prerequisites. The map repeats them, and `npm run kc:map` fails if the two ever differ.

## 5. The knowledge-component map (S05.3a)

- **Graph.** 100 components (28 active plus 72 draft), 122 edges and 32 misconceptions. The 72 new components add two strands: `money_life` (25) covers everyday money habits, safety, banking, giving and planning, and `investing` (18) covers the investing course. `entrepreneurship` gains 28 and `money_math` gains 1.

  A component is a concept that is taught at different depths in different stages, not one per topic. For example, `biz.make-and-test` is taught in the 6–7 inventors' workshop and again in the teen garage prototype; this is the "one graph, age-appropriate chapters" model of OD-16. Mentor tiers follow each component's first audience (tier 1 or 2 for financial education, tier 3 for teen content). The new components use the default BKT parameters and have not been calibrated (`audit:bkt-calibration` applies after activation).
- **Map.** Every topic of the 4 courses is mapped: 882 topics and 1,631 links (755 *teaches*, 876 *reviews*). Each knowledge component is taught by 1 to 24 teaching links (median 7). 25 components are taught in two or more courses.
- **The original 28.** 26 are now taught by catalog topics:
  - `money.percent-intro` and `biz.risk-and-reward` reach content through teen-stage topics (investing premium-percentage and risk-map sagas, entrepreneurship margin and funnel topics). The Mentor bridge stays null for these two: a Mentor tier-3 learner can be 10 years old, and these topics are for ages 12–18.
  - `money.fraction-of-amount` and `biz.goods-vs-services` are declared **content gaps**. No topic in any pathway teaches them; the 2026-09-01 lesson-level evidence still holds. They need newly written topics (Forge phase).
- **Order conflicts found.** When the frontier was run on the real catalog, 63 topics (34 in financial education, 4 in investing, 25 in entrepreneurship) were found to depend on a component that the authored order teaches later. Two examples:
  - The 0052 graph requires `money.count-mixed-coins` before `money.compare-amounts`, but financial education compares coins in adventure 1 and totals mixed coins in the adventure 2 quest.
  - `biz.needs-vs-wants` is required before `biz.what-is-price`, but needs and wants are taught in adventure 4.

  Rule F2 lets the authored order decide what is locked, so no pathway can deadlock. Pedagogical review should still decide, pair by pair, whether the graph edge or the curriculum order is right.
- **How the map was written, and its limits.** The mapping was done from each topic's blueprint (concept, learning objective and micro-objectives), without paid generation. The 24 Mentor bridges were checked at the lesson level earlier and are preserved; the gate G4 enforces them. The other links have **not** been checked against the published `lesson_documents`, which this lane cannot read (no production access). They are an engineering proposal for Appendix C Stage 3 review. The contentBridgeAudit method note applies: a blueprint summary can describe a topic wrongly in either direction.

## 6. Legacy-credit equivalence (OD-9)

No evidence is rewritten, rescored, remapped or deleted when the pathway model takes over. `LEGACY_EVIDENCE_EQUIVALENCE` in `pathwayPolicy.ts` lists each evidence type, and a test checks that the list covers OD-9 §4.1 and that nothing is dropped.

| Evidence | Where it lives | Treatment |
|---|---|---|
| Lesson passes and best scores | `lesson_progress` | Kept as is. Counts toward topic completion (E1, B1). Best score is never lowered (B.5). |
| Placement credits | `placement_credits` | Kept as is. Counts as passed for completion and badges, never as played and never as XP. |
| Placement records | `course_placements` | Kept as is. Becomes the entry placement of the stage the course's chapters had at cutover (P6). |
| Segment and v2 attempts, receipts | `lesson_segment_attempts`, `lesson_v2_*` | Kept as is. Grading history; the pathway rules read only lesson outcomes. |
| XP, minutes, lessons completed, streak days | `learning_stats` | Kept as is. Never recalculated from pathway membership. |
| Course badges | Derived today; frozen into `course_pathway_badges` | Legacy badges are frozen by the migration and never revoked (B4, B5). Financial education and the lemonade stand are child credentials; investing and entrepreneurship are teen credentials. From S05.3b, `get_completed_course_badges` returns stored badges as well as the live rule, so every badge reader (profile, Family Hub share, public badge page, B.2 check) keeps a badge the live rule would drop. Core freezes a badge earned after the migration on the next course read or completion. |
| Mentor mastery, review cards, misconceptions, evidence log | `learner_kc_mastery`, `memory_card`, `learner_misconception`, `kc_attempt` | The same rows drive course prerequisites and review-due items (E2, F6). There is no copy and no second model. |
| Mentor plans and notebooks; coins, savings goals and chore history | Mentor and Family Hub tables | Untouched. |

When the Forge phase replaces a legacy topic with a new one, credit moves only through an equivalence mapping between old and new *lessons* that a person reviews. The rule: same knowledge component, and same or older stage content. Mastery is never remapped quietly from a weak or unrelated lesson. The old rows stay, and the old topic's chapter stays readable as optional history.

## 7. Migration mapping (legacy to new)

| Legacy | New | How |
|---|---|---|
| `adventures.age_tier` | chapter stage and age range | Worked out at read time (P1). Explicit columns stay NULL on legacy rows. |
| Topic, with no link to the Mentor | `topic_knowledge_components` | `npm run seed:kc` writes the map. Links are keyed by (course slug, adventure/saga/topic path), because review topic slugs repeat within a course. |
| One `course_placements` row per course | `course_pathway_placements` per (course, stage) | Read-time equivalence (P6). Nothing is copied. |
| Badges calculated live | `course_pathway_badges` | Frozen once by the migration, then written by Core when earned (S05.3b: `settleCourseBadges` after a completion, after a placement and on the course read). Read back through `get_completed_course_badges` (stored plus live). |
| Flat "current lesson" | Frontier (F1–F8) | Pure function. The learner routes serve it from S05.3b when `COURSE_PATHWAY_ENGINE=pathway`. |
| B.1 `commit_course_placement` | `commit_course_pathway_placement` | The same atomic transaction, per (course, stage). It keeps the B.1 row as the course's first placement and refuses a credit outside the stage's own chapters. |
| Lesson ids, `lesson_progress`, credits | Unchanged | Same rows. The lesson id is the stable identifier. |

**Order of work in production (owner-run, after policy acceptance):**

1. Apply the B.6 data-layer migration. It is expand-only; its frozen-badge backfill is idempotent.
2. Apply the `kc_strand_widening` migration. It is declared contract because the phase gate treats any CHECK change that way, even though it only widens; it needs manual review.
3. Apply the `b6_pathway_route_adoption` migration (expand): stored badges in the badge reader, and the stage-entry placement function.
4. Run `npm run seed:kc`.
5. Regenerate `database/types`.
6. Deploy Core with the S05.3b routes. `COURSE_PATHWAY_ENGINE` stays `linear`, so this deploy changes nothing a learner sees.
7. Flip the 72 drafts to active in the seed and seed again.
8. Set `COURSE_PATHWAY_ENGINE=pathway` on Core. Setting it back to `linear` is the rollback: every row the pathway engine writes (stage placements, stored badges, credits) is also valid under the linear engine, and the B.1 course placement row is kept.

Before the legacy platform is switched off, OD-9 §4.5 still requires row counts and per-family spot checks.

## 8. What each rule is enforced by

| Mechanism | Enforces |
|---|---|
| Migration `*_b6_pathway_data_layer.sql` | Link table with one primary per topic and primary ⇒ *teaches*. A mapped component can only be retired, never deleted (`ON DELETE RESTRICT`). Clients read links only for active components. Chapter eligibility columns must be all-or-nothing. Stage-entry placement table. Frozen badge table with a key-matches-basis CHECK, and the legacy backfill. All new tables have RLS with learner-and-guardian reads and service-role writes. |
| Migration `*_kc_strand_widening.sql` | The two new strands (declared contract). |
| `backend` `seed-kc-graph.ts` | Refuses cycles, tier inversions, a draft that would gate an active component, and any map/graph disagreement *before* writing. Writes links in two passes. Reports stale links and fails on a published topic that has no mapping. Audits the Mentor bridge for active components only. |
| `backend` `services/pathway/*.test.ts` | Checks the real map against the real graph and pins the counts. Tests every P (P1–P7), E, F and B rule on fixtures and for each population: a 7-year-old created by a parent, a guest from the refusal path, a teen aged 15, 11- and 12-year-olds, an adult, and a verified-parent Tutor (role never matters). A no-deadlock simulation on the whole real catalog runs for 7 course × age populations with 2 selection strategies. Also checks legacy % parity and OD-9 coverage. |
| `coursegen` `npm run kc:map` and `kcTopicMap.test.ts` | The map matches the curriculum topic by topic, the file is always in its canonical form, and a sync never invents a component. |
| CI path filters | Changes under `database/seeds/**` now trigger both backend and coursegen CI. |
| Migration `*_b6_pathway_route_adoption.sql` (S05.3b) | `get_completed_course_badges` returns stored badges plus the live rule, dated by the earliest earning (B4). `commit_course_pathway_placement` writes the (course, stage) entry placement, B.1's course row when absent and the credits in one transaction, and refuses any credit outside the course's published lessons of that stage (P6). Both are service-role only. |
| `backend` `services/pathway/coursePathway.ts` (S05.3b) | Applies the rules to the learner's course tree: lesson state from the frontier (F1–F8), chapter access from P1–P5 (every lesson of a closed chapter is locked), pathway progress (B1–B3), per-stage placement (P6), the badge decision (B4) and the placement prior from graph evidence (P6). |
| `backend` `services/pathway/pathwayData.ts` (S05.3b) | Reads the Mentor's own rows (active KCs, active-to-active edges, `learner_kc_mastery`, `memory_card`) and the B.6 tables. Any failed read is a 502, never "nothing known". |
| `backend` routes (S05.3b) | The shelf, course tree, course path, the four lesson endpoints, placement (start, step, commit), completion and the Family Hub kid tree all use the same pathway tree. Lessons in an age-closed chapter answer `LESSON_AGE_RESTRICTED`; a course with no open chapter answers `COURSE_AGE_RESTRICTED`; B.2 uses P7. |
| `backend` `__tests__/learnPathway.test.ts` (S05.3b) | Direct API requests per population (7-year-old created by a parent, independent teen, 12-year-old, adult, verified-parent Tutor, a guardian reading a kid) prove the four checkpoint claims at the route boundary. |
| `backend` `services/pathway/coursePathway.test.ts`, cross-surface block (S05.3g) | Appendix C's B.6 done-criterion (c). On the real catalog (financial education at 8, investing at 15, entrepreneurship at 12; 25 random learners each, mastery drawn over the whole 0–1 range with 0–5 attempts), the Mentor's map state from its own rule (`tutorMap.deriveNodeState`) and the course's view from the pathway engine never disagree: a component the Mentor calls mastered is never "not shown" on the course, never blocks anything, and never leaves a topic it fully covers locked on an open chapter; the course never credits Mentor evidence below the Mentor's own 0.80 bar, and without course evidence the course's view equals that bar exactly. Negative control: raising the course's bar to 0.90 fails the block. |

## 9. What is still not done (after S05.3b, reviewed in S05.3g)

These are listed so the checkpoints are not read as more complete than they are. S05.3b closed the first item of the S05.3a list: the learner course tree, lesson admission, placement, badges and the B.2 check now run on the pathway model when the release switch is on.

- Graded course lessons do not yet update the Mentor's BKT mastery or review cards (a `kc_attempt` source for course lessons). Until they do, E2's course evidence comes from topic completion alone: the course sees the Mentor's mastery, but the Mentor does not yet see course lessons. This needs a contract migration (a new `kc_attempt.source` value) and an owner decision (question 9).
- The migrations have not been applied to a real PostgreSQL database. This lane has no disposable database, and the shared Docker stack is off-limits.
- The rebuilt course path (`/learn/:courseSlug/path`) is a self-contained S05.3b surface. Its composition on the finished design system, and links to it from the shelf and the course page, are wave-2 work. Until the switch is on, the route sends the learner to the existing course page.
- There is no authored content for tweens (10–12) or adults. OD-16 requires both to be written before release; that is Forge-phase work.
- Appendix C's B.6 done-criterion (a) asks for 28 of 28 original components mapped to a course lesson. The map reaches 26: `money.fraction-of-amount` and `biz.goods-vs-services` are declared content gaps (no published topic teaches either; S05.3a searched the curriculum). They need new topics (Forge, zero-spend authoring after pedagogical review), so (a) is not met yet. Criterion (b) is met behind the release switch, (c) is now pinned by the cross-surface test above, and (d) depends on B.1's acceptance, owned by S02.

## 10. Owner decisions requested

For each item, the default in brackets is what is implemented now.

1. **Early access for 12-year-olds.** Legacy teen chapters were written for ages 12–18. Should 12-year-olds keep "early entry" to them? [Yes, as written, P5.3. The alternative is to make them 13+.]
2. **Adults on legacy teen chapters.** Until adult chapters exist, should adults keep taking the teen chapters as a younger bridge that earns the badge? [Yes: it preserves today's adult badges and is reported as a content gap.]
3. **Minors seeing older chapters.** Beyond the authored minimum age, may a minor with strong mastery see an older stage's chapter early? [No. Mastery never opens a closed chapter (P4).]
4. **Mentor mastery and course completion.** Should Mentor mastery alone ever complete a course topic, instead of only unlocking what follows it? [No. Completion needs graded lessons or placement credit (B2). Mentor mastery informs the stage-entry placement instead.]
5. **Stage transitions.** On moving to a new stage, should topics in the new stage whose components the learner already showed be credited automatically? [No. The new stage's entry placement decides (T3).]
6. **The two content gaps** (`money.fraction-of-amount`, `biz.goods-vs-services`). Should they be written as new topics or retired? [Written in the Forge phase. Retiring would remove Mentor ground.]
7. **Graph versus curriculum order.** For the 63 topics where the graph order and curriculum order conflict, should pedagogical review settle each pair (change the graph edge or reorder the curriculum)? [Recommended before activation; until then the authored order decides what is locked (F2).]
8. **Course prerequisites for older learners.** Should a course-level prerequisite be waived when the required course is a younger stage's course for this learner (for example, financial education before investing, for a teen or an adult)? [Yes, P7. This replaces S05.2ba's "badge from everyone" behavior when S05.3b adopts it.]
9. **Course lessons as Mentor evidence.** Should a graded course lesson update the Mentor's mastery estimate and review cards for the topic's knowledge components, so the Mentor also sees what the course taught? [Proposed: yes, for the topic's primary component only, through the Mentor's own `recordAttempt` with a new `course_lesson` evidence source, after this policy is accepted and the new components are calibrated. Not implemented: it changes a child's Mentor estimate and needs a contract migration.]
10. **Release switch scope.** Should the pathway engine be switched on for every course at once, or course by course? [One global switch, `COURSE_PATHWAY_ENGINE`, as implemented. Today's four courses each form a single stage, so for a learner who can open a course, progress and badges do not move (B1, B5); what changes is the lock state. A learner below a course's minimum age loses access to it (P4, the safeguard), keeping every pass, credit and badge (T4).]
