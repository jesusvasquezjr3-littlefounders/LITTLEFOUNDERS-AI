# W2 Lane 2: learner home, courses, placement, course world, lessons and results

Status: lane finished (W2L.1 to W2L.4 implemented; W2L.1 and W2L.2 locally verified with browser matrices; W2L.3 and W2L.4 unit-verified, their browser look left to the orchestrator's merge run). Nothing here is accepted or released. Branch `codex/spec-w2learn` (worktree `/c/lf-wt/w2learn`), synced with `codex/spec-migration-s02` at `294f973a` (the owner's answers, OD-24 to OD-28). Owner: Engineering (Lane 2) for implementation; the owner for the proposals below; Product for copy; a named design reviewer for 02 §12.

This lane owns the learner's own pages inside Lane 0's split (`W2-SHELLS-AND-ROUTING.md`, "Lane ownership map"): the learning home (L1), the course (L2), the course world (L3), placement (L4), the lesson route and its results (L5), plus the decision journal, the rhythm and the course badges.

## Binding sources

OD-2, OD-3 (Option B), OD-4, OD-6, OD-7, OD-9, OD-13 to OD-16, OD-19, OD-22 to OD-28 (`product/13-OWNER-DECISION-LOG.md`); Product 10 B.1, B.2, B.3, B.5, B.6, B.8, B.9, B.10, B.13, B.15, B.20, B.21, B.23 to B.26; Frontend Bible 02 §1 to 2 (D1 to D13, rules 1 to 23), §4.3, §4.5, §7 to §9, 03, 06 (Copy Budget), 07 (own assets), 08 §2 and §11.

## Checkpoints

| ID | Scope | State |
|---|---|---|
| W2L.1 | L1 home and L2 course on the learner shell (both course engines), the journal and the rhythm moved onto the shell; legacy `LearnPage`, `CoursePage`, `CoursePathView` and their parts deleted | Implemented and locally verified (unit, real-route matrix 336 configurations, full audit 0 findings) |
| W2L.2 | L3 course world (`TerritoryMapView`, six own scene assets) and L4 placement flow (`PlacementFlowView`, B.1 identical retry, B.15 framing); legacy `PlacementPage` and scene components deleted | Implemented and locally verified (552/552 real-route configurations, B.1 commit retry 36/36 journeys, lane audit 0 findings) |
| W2L.3 | L5: the lesson route in one `LessonLayer` (every Core refusal its own screen), the compact Mentor stage on all nineteen v2 boards (B.8), badge and course-complete results (OD-7, B.20), the v1 player behind one named adapter (OD-24) | Implemented and unit-verified |
| W2L.4 | Owner answers in the lane (OD-25, OD-27 (3), OD-28 L-01, L-02, L-12, V-12), a deep-linked lesson's course, lane finish | Implemented and unit-verified |

## What was built

### W2L.1 to W2L.3 (summary)

The three checkpoint headings below are kept as link targets.

#### W2L.1: the home (L1), the course (L2), the journal and the rhythm

- **Data.** `course.ts`, `learnHome.ts`, `territory.ts`, `placementFlow.ts` validate every Core answer with zod (malformed is unavailable, never partly shown); the course screen asks for the B.6 path first and falls back to the tree when Core answers `PATHWAY_ENGINE_DISABLED`; every refusal (`COURSE_AGE_RESTRICTED`, `COURSE_PREREQUISITE_REQUIRED` with its slugs, `NOT_FOUND`, offline, refused, retryable) has its own state. No lock is re-derived and no age reaches the client.
- **L1 home.** A dashboard: the featured course's next step as the one accent action, one identity card per course (02 §4.3, own icons), B.3's unavailable featured course named with a retry, a course closed by age listed and never offered (OD-16), the B.21 streak with rest days and the B.24 pace one press away, the B.9 journal and the B.13 teen prompts, the B.23 graduation card.
- **L2 course.** One screen for both engines: placement offered, not forced (B.15), the recommended lesson, the other open lessons as real choices (B.24), chapters with their access, skills; the linear engine's chapters in Core's order; the course badge on a finished course.

#### W2L.2: the course world (L3) and the placement flow (L4)

- **L3 course world.** Worlds with their own scene art (B.8), "you are here", fog of war, topic states in a word, the placement first when owed.
- **L4 placement.** One state at a time on the sky single-state screen, the learner's own Mentor as a real-model render, every legacy capability kept; B.1: a lost commit keeps the outcome and the same press sends the identical body.

#### W2L.3: the lesson route and results

- **L5 lesson.** `LessonLayer` carries the shell duties (root, language, band, title, skip link, focus on each new screen); `LessonStageSlot` is the one path to `CompactMentorStage.tsx`; the result shows `badge-earned` or `course-complete` as one moment through `mayCelebrate`; `LegacyLessonIsland.tsx` is the only way to the v1 engine (a scan test pins it).

### W2L.4: owner answers and lane finish

- **OD-25, B.6: one stage early on mastery.** `pathwayPolicy.earlyStageCandidate` (a closed chapter exactly one stage above a known age; never an adult chapter for a minor, never two stages up) and `chapterPrerequisiteKcs`. `coursePathway.applyCoursePathway` lists a candidate as `eligible` once every prerequisite skill is shown on the shared graph, and plays a confirmed chapter as optional (never required, never counted); age is re-checked on every read (T4). A course with no chapter for this age still opens when an early chapter is offered; the shelf flags it (`pathway.earlyAccess`).
- **OD-25, B.6: Mentor mastery with consent.** A teaching topic whose every skill is shown, at least one with the Mentor, is offered ("You showed X. Unlock the next step?"); an accepted topic reads as a credit (counts toward completion and badges, never played, never XP) and settles the stage badge.
- **Migration `0180_pathway_early_stage_and_mastery_credit.sql`** (expand): `course_chapter_early_access` and `course_topic_mastery_credits`, RLS (own and verified guardian read), service-role writes, cascade erasure. Core: `POST /learn/courses/:slug/early-access` and `/mastery-credit` re-derive the offer server-side from the same tree the lesson gate uses; pathway engine only. Course screen: the two questions (`OfferCard`), "Not now" only hides, the host re-reads the course after a yes. Preview `?screen=coursepath&path=offers`, audit state `coursepath-offers@10-12`. The B.6 policy document's P4 and B2 carry the exception.
- **OD-27 (3), B.9 and B.10: the Tutor sees an under-13 child's choices.** `journalSharing.ts` (a parent-created child under 13 by birth date, else by the screened band; unknown age stays private). Guardian route `GET /family/learning/kids/:kidId/decisions` (parent role, current verified identity, verified link): the situation and the chosen option only, titles in the Tutor's locale, every read audited; 403 `JOURNAL_PRIVATE` for a teen. `GET /learn/journal` adds `sharedWithTutor`; the journal says "Your Tutor can see the choices you make." `ChildDecisionsPanel` (with its client, preview `childdecisions` and audit state) is ready for the Family Hub.
- **OD-28 L-12, B.13: the teen's own goal.** Migration `0179_teen_bridge_own_goal.sql` (expand): a savings self prompt may create the teen's own goal (`result_self_goal_id`, its own CHECK), `teen_wallet_holder` at the moment of acting or `no_wallet`; a task prompt still creates nothing. Core accepts `{title, target, icon}` on `POST /learn/bridges/:id/act`; the journal, home and shortcut open a short goal form or keep "Just a plan".
- **OD-28 L-01 and L-02, B.26.** Timed drills keep the answer's own score when time runs out (choice and storyplay graders, frontend and Core). A gentle rising "not yet" cue is synthesised in-house (`frontend/scripts/generate-not-yet-sound.mjs`, zero spend, `public/sounds/edu/not_yet.wav`): the v1 miss sound, and the v2 feedback row plays it (and the success cue) honouring the platform off switch (`lessonCue.ts`).
- **OD-28 V-12, B.20.** The v2 result's lesson-complete milestone bursts confetti once inside the gated `Celebration` (630 ms within the 700 ms budget, token durations and colours), with the static frame for reduced motion and revisits; pieces land above the heading and inside a 320 px page.
- **Deep link (W2L.3 open item).** `GET /learn/lessons/:id` carries `lesson.course_slug`; the lesson route falls back to it (validated) when the opening link named no course, so a badge result and the way back work from a deep link.
- **Docs.** `DARK-PATTERN-AUDIT.md` and `audits/dark-pattern-audits.json` (MN-02 evidence, still open for the manual review), `LEARNER-REGISTER-AND-WELLBEING-POLICY.md` (items 6 and 7 decided), `S05-B6-PATHWAY-POLICY.md` (P4, B2), `REQUIREMENTS.md` rows B.6, B.9, B.10, B.13, B.20, B.25, B.26.

## Decisions taken on the conservative default (proposals for owner review)

1. Course identity slots: first-lemonade-stand primary/sprout, financial-education mint/coin, entrepreneurship berry/rocket, investing sky/chart; a course without a slot is a neutral card.
2. Placement is offered, not forced; lessons stay closed by Core until it is taken.
3. Catalog titles are budgeted by the role of the element they sit in; Forge budgets the content itself.
4. The legacy six-course track filter is not rebuilt (four courses).
5. The home's hero and the shelf both list the featured course.
6. Lesson rows carry no minutes and XP; chapters carry no topic subheadings (the map has the structure).
7. Layering to fit the first view (06 §3.1): pace one press away, chapters start closed, one-word disclosure.
8. The placement is silent until its lines are voiced again (the fixed cast's clips broke the budget, OD-6 and OD-19; regeneration is paid, OD-23).
9. The placement outcome shows Core's closed frame only (no skipped count).
10. The placement is a full-screen sky layer, not a shell page.
11. The map opens worlds on request; the topic-state legend is cut.
12. Scene art per chapter theme, not the Diorama (02 rule 10).
13. "Back" in Spanish is "Regresar" ("Atrás" reads as a verdict).
14. The lesson layer is not the learner shell (02 rule 15).
15. The compact band shows the Diorama, not the chapter scene (a Core and Lane 3 contract change).
16. The v1 result and its celebration stay the island's own until the v1 catalog is replaced (OD-24); the confetti is the v2 result's.
17. (Superseded in W2L.4) a deep-linked lesson now names its course.
18. OD-25: an unknown age never opens early (P4 unchanged for it); a chapter whose prerequisites the graph cannot name never opens early (fail closed).
19. OD-25: once confirmed, an early chapter is re-checked for age only, never for mastery again (shown evidence is not revoked, OD-9).
20. OD-25: the offers exist only under the pathway engine (the linear engine is the legacy catalog, retiring with OD-24); the mastery offer is for teaching topics with at least one skill shown with the Mentor; the prompt lives on the course screen (a Mentor-session prompt is Lane 3's, on the same Core route).
21. OD-27 (3): unknown age keeps the journal private; the Tutor sees the situation and the chosen option only; every Tutor read is audited; the child is told on their journal and may still clear it.
22. L-12: the goal form asks a name and coins (icon defaults to star); "Just a plan" stays available; a teen the wallet does not admit is told and keeps the plan option.
23. L-02: the cue is a WAV (no encoder on the machine, 27 KB); the v2 lesson also plays the success cue so a miss is not the only sound.

## Verification

| Checkpoint | Evidence (local, Chromium, synthetic Core; no real Core, database or provider, OD-23) |
|---|---|
| W2L.1 | type-check and lint; unit 281 files / 2,973 tests; real-route matrix 336 configurations after fixes (focus kept on arrival, rows committed before reading); lane audit 26 states and full audit 102 states, 0 findings; course-path, narrative and motivation matrices 0 findings; screenshots read |
| W2L.2 | lane unit 42 files / 335 tests; B.1 commit retry 36/36 journeys on the rebuilt flow; real-route matrix 552/552; lane audit 26 states, 0 findings; screenshots read (two defects found by looking and fixed) |
| W2L.3 | lane unit 63 files / 589 tests; spec, secrets, i18n and asset gates; no browser run (registered: `/learn/lesson@locked`, `@prerequisite`, `@not-found`, `resultbadge`) |
| W2L.4 focused | backend `timeoutPenalty`, `learnNarrative` (teen goal and OD-27 (3) populations), `journalSharing`, `learnPathway` (OD-25: 12-year-old early chapter, never two up, never adult, never unknown age, mastery credit and its badge, linear engine refusal, lesson course slug), `pathwayPolicy` (47); frontend `lessonCue`, `LessonResultView` (confetti), `NarrativeViews` (goal form, sharing copy), `ChildDecisions`, `CourseView` (offers), `LearnHomeView`, `LessonRoute` (deep link), graders, `celebrationBudget`, `controlsCss`, copy budgets |
| W2L.4 physical PostgreSQL | Portable 17.6 on the lane's own cluster (port 15420), full chain of 180 migrations: `verify-teen-bridge-goal-postgres.py` (7 checks: own goal once, commitment alone, self task refused, only the teen acts, `no_wallet`, guardian path unchanged with the new CHECK, browser roles refused) and `verify-pathway-od25-postgres.py` (CHECKs, RLS own rows, browser writes refused, erasure cascade) |
| W2L.4 lane finish | Full suites once: backend 118 files, 2,887 passed, 1 skipped; frontend 288 files, 3,029 passed, exit 1 only for the known shared vitest RPC timeout (`assetGate.test.ts`, S03); database 28 passed. type-check and lint (backend, frontend), `spec:check`, `secrets:check`, i18n gate, migration-phase (135 expand), migrations and account-deletion gates: all OK |

## Open items

- **Browser look (merge run).** No browser evidence yet for W2L.3 and W2L.4: the `:has()` side column of the stage on the eighteen boards other than the allocation pilot, the rosette's icon placement and badge pill, the confetti frame, the course-screen offers, the teen goal form, the journal's sharing line and the Tutor panel. Registered audit states: `childdecisions@adult`, `coursepath-offers@10-12` (with the W2L.3 ones).
- **Lane 4 request.** Mount `ChildDecisionsPanel` (rebuild/learning) in the Family Hub's child learning panels beside the B.10 narrative, with the family learning transport; it renders nothing for a teen.
- **Lane 3.** Swap `MentorStage.tsx` into `lessonStage.tsx` when it ships; the compact band's chapter scene needs a Core and Lane 3 contract change; a Mentor-session version of the OD-25 mastery prompt can call `POST /learn/courses/:slug/mastery-credit`.
- **Pathway engine.** OD-25's offers are live only with `COURSE_PATHWAY_ENGINE=pathway` (D-06: an operator sets it after the B.6 migrations and 0180 are applied).
- **Migrations.** `0179` and `0180` are this worktree's next free numbers; the orchestrator renumbers at merge.
- **Metrics.** `learning_narrative_metrics` still reports a teen's self answer as a commitment apart from conversions; a self-created goal is not yet counted as a conversion (Product call).
- **Unchanged from earlier checkpoints.** The v1 island until the new catalog (OD-24); the placement's new Mentor turns unvoiced (owner-run spend); drafts awaiting the owner's style review (three course icons, six scenes, `course.badge.frame`); long linear chapters not virtualised; the shared `assetGate.test.ts` RPC timeout (fix proposed to Lane 0/S03: `execFile` and `fs.promises.cp`).

## Files outside `rebuild/learning` and `routes/app/learn` touched by the lane

`frontend/src/index.css` and `src/__tests__/designClasses.test.ts` (three dead legacy classes, W2L.1); `scripts/audits/lanes/core.mjs` and `scripts/audit-rebuild.mjs` (W2L.1); `src/rebuild/assets/manifest.json` (icons, scenes, rosette); `src/lesson-engine/families/{choice,storyplay}/grade.ts` and `player/sfx.ts` (OD-28); Core `routes/learn.ts`, `learnNarrative.ts`, `familyLearning.ts`, `services/pathway/*`, `services/narrative/*`, `lesson-contract/families/*`; database migrations `0179`, `0180` and two verifiers.
