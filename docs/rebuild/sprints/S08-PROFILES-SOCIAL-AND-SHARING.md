# S08: profiles, social and achievement lifecycle

Status: in progress. Started 24 September 2026. Owner: Engineering for implementation; Product and Safety/Trust for the decisions/reviews named by the SPEC. No release approval is recorded.

## Binding acceptance sources

- Product E.5–E.13, F.3–F.6.
- Appendix I (profile/social safety research), Appendix J (profile/social metrics), Appendix K/L (achievement sharing research + metrics).
- Frontend Bible 02 and 06 for rebuilt surfaces.

Risk classification: **child-safety boundary**. Existing production UI may receive OD-8 hotfixes; it is not reused in the rebuilt frontend.

## Point-by-point checkpoints

| ID | Scope | Product acceptance | Frontend acceptance | State |
|---|---|---|---|---|
| S08.1 | E.5 Tutor-badge visibility | Badge shown only inside an established relationship (subject's verified-linked kid, mutual approved follow, self, staff) AND only for a currently ID-verified parent; ambiguous reads hide it | Public profile renders exactly the server's isTutor verdict | In progress: implementation and local verification recorded; real-database and human review pending |
| S08.2 | F.3 share-flow disclosure | A short, un-buried, point-of-action disclosure beside each Share button naming the real mechanics (anyone with the link can open it; 30-day expiry; revoke from the Family panel) and the growth purpose | Disclosure rendered beside both share buttons in the parent territory surface | In progress: implementation and local verification recorded; copy/human review pending |
| S08.3 | F.4 share age_band | The declared-but-unused age_band is now populated from the kid's stored birth date at share time in the column's own vocabulary (6-8/9-11/12-14); NULL outside the teaching bands rather than guessed | No surface change (server-derived field) | In progress: implementation and local verification recorded; real-database evidence pending |

## S08.1 implementation and rationale

Inspected evidence: the public profile response derived `isTutor` from the bare `parent` role — a platform-wide trust signal visible to any signed-in user, including unconnected kid-role accounts, and it did not even require current verification. E.5's mandate is to restrict the badge to the verified adult's own linked children and connections approved through E.1's gates.

`tutorBadgeVisible(viewer, subject)` replaces the role check: the subject themself and staff viewers always see it; everyone else only when (a) the viewer is the subject's verified-linked kid (`guardian_links`), or (b) a mutual follow exists (the approved-connection form available to this surface), AND the subject's latest `parent_verifications` row is `verified` via `local-ocr` — aligning the badge with A.5's "verification must mean one thing". An ambiguous verification or link read hides the badge (fail closed: an absence is safer than an unearned trust signal). The public-profile route serves only the boolean; no new data reaches the client.

## S08.2 implementation and rationale

Inspected evidence: the share flow issued a permanent link with no disclosure of what it was (a public, instrumented acquisition touchpoint). F.2 has since added the 30-day expiry and per-share revoke, so the disclosure states the real mechanics instead of the SPEC's placeholder copy. A caption line sits directly under each Share button on the parent territory surface (streak and goal-reached): anyone with the link can open it, it expires in 30 days, it can be revoked from the Family panel, and it helps LittleFounders grow — mentor-voiced, not a liability disclaimer. The F.2 caching caveat (a messaging app may keep its own preview after revocation) is documented in the S02.4c record and remains a candidate for a deeper explainer, not a point-of-action caption.

## S08.3 implementation and rationale

Inspected evidence: `badge_shares.age_band` (vocabulary 6-8/9-11/12-14) was never populated. The share route now computes it from the kid's stored birth date (the same date math as the age screens) at issue time; a kid outside the teaching bands or without a date gets NULL rather than a guessed value. `getKidProfiles` gained `birth_date` for the server-side computation only — it is never a response field.

## Verification log

Executed 24 September 2026 against the current working tree. Commands below are relative to the named directory. These are local results, not CI or production observations.

| Boundary | Command / evidence | Result |
|---|---|---|
| Adversarial Core tests | `backend/`: `npm test -- --run src/__tests__/tutorBadge.test.ts src/__tests__/familyBadge.test.ts src/__tests__/learn.test.ts` | 8 badge-visibility tests (linked kid, mutual follow, self/staff, unconnected kid, staff-granted/revoked subject, ambiguous-read fail-closed, route projection), 2 age_band tests, 2 prerequisite tests; 100 tests across the three suites |
| Core regression | `backend/`: `npm test` | 70 files, 1,470 tests passed + 1 documented skip |
| Core static checks | `backend/`: `npm run type-check`, `npm run lint` | Passed, including test type checking |
| Frontend regression | `frontend/`: `npm test` | 211 files, 2,189 tests passed |
| Frontend static checks | `frontend/`: `npm run type-check`, `npm run lint` | Passed |
| Binding authority and repository tools | Root: `npm run spec:check`, i18n gate (Git Bash) | Passed |

Execution notes: the badge-visibility stub initially ignored the `role=eq.` filter, which made every viewer read as staff — the stub now filters by the requested role (a harness correction, not a product change). The age-band test's first expectation used a birth date that lands in 9-11 today; the fixture now uses a date that lands in 6-8.

Remaining acceptance boundaries: real PostgreSQL evidence for the badge reads and the populated column, visual/device matrices, and human Product/Safety review. None of E.5, F.3 or F.4 is accepted.
