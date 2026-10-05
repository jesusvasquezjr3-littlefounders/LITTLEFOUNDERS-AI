# S05 Financial Education V2 production release

Date: 5 October 2026
Owner decision: Financial Education V2 is canonical. Every component that has valid content evidence may be enabled, and the complete course is approved to proceed to production without generated voice or narration audio.

## Scope

- Expand Financial Education from 56 to 112 authored lessons: 28 in each of the 6–9, 10–12, 13–17 and adult pathways.
- Keep en-US, es-MX and pt-BR as first-class authored markets. The resulting release contains 336 localized lesson documents.
- Use the registered interactive boards, diagrams, manipulatives, real Mentor models and approved Diorama stages. No lesson requires a generated raster illustration, and no Mentor look-alike is permitted.
- Keep investing, credit, debt, instalment financing and compound-growth instruction outside this course.
- Replace the legacy release assumption with a V2-native verification and publication path, then release the course and its usable knowledge components to production.

## Implementation record

- The four pathways now contain 28 lessons each. Every new plan declares eligibility, KCs, new-concept density, Mentor and stage, market policy, an examples-first teaching arc, private server rubrics and localized feedback.
- Forge V2 now blocks the carried document gates 5–9 in addition to the existing V2 gates. The database manifest contract requires the same set.
- `verify:course` selects V2 whenever a canonical V2 structure exists. It re-emits the authored plans, compares the exact current Vault documents and answer keys, runs Core's contract and interactive-behaviour check, evaluates all 34 release checks and attests the content watermark it captured before reading.
- A first course writes its invisible review pointers before verification, so the final complete corpus and final watermark are attested. A live-course update still verifies first and remains pending for staff release. Identical publication retries are idempotent; a reused identity with different content is refused.
- Course and lesson release count each locale from its current V2 pointer, with a V1 document used only as a per-locale fallback. No shadow V1 documents are manufactured.

## Verification and release evidence

This section is completed once per checkpoint, after the final tree is stable.

- Authored-corpus checks: 112 of 112 plans emitted in all three locales (336 documents), with zero blocking V2 content findings. The V2-native `content:gates` path also passed the 112-plan corpus and the family-facing UI tone scan; its 164 Stage 3 review flags remain explicit rather than being silently discarded.
- Core strict V2 check: 336 of 336 documents passed; all 1,599 graded segments and 378,021 permitted interaction states were solvable.
- Hierarchy and catalog: exactly 28 lessons in each of four pathways, 112 topics and lessons, 313 topic-to-KC links, no duplicate lesson id, 100 of 100 KCs covered and zero catalog errors. The 38 catalog warnings are nonblocking prerequisite/pure-practice notices.
- Release-path regression checks: semantic version identity is kept separate from the document-version row UUID; an idempotent retry fails closed unless Vault reports `activated` or `pending_staff_approval`; 19 focused verifier/publication tests passed.
- Database checks: all 258 migrations passed the static chain check. The full PostgreSQL 17 learning gate passed 12 of 12 verifiers after updating the V2 idempotency expectation, and the staff gate passed 9 of 9 verifiers, including content release and course publication.
- Repository integration: PR #130 merged to `main` as `7f308062ce98e0787f9b04e81a59c202906d11dd`; required checks and the affected service deployments passed.
- Production migration and release: the migration ledger is complete through 0258. The course, 28 adventures, 28 sagas, 112 topics and 112 lessons are published. All 336 current document pointers resolve to schema V2 across 112 distinct lessons and three locales; no activation request remains pending.
- Post-release learning state: 313 topic-to-KC links are current, 44 active KCs have live lesson bridges, 9 active KCs are deliberately unmapped because no published topic teaches them, and 47 KCs remain draft. The OD-22 activation and course release each have an audit receipt.
- Release attestation: all 34 checks are recorded against the current content watermark. Production preflight passed with every service running, the pathway engine enabled, and the lesson-attempt secret configured; lesson evidence remains intentionally disabled.

## Human and operational boundary

The owner authorized production release in this session and supplied the operational sign-offs: Claudio Sonne as reviewer and Soleniano Gepete as safety lead. The course was released through the existing audited database-owner path; the audit trail records 112 Stage 3 bypasses rather than representing those operational sign-offs as native-language review. Generated voice and narration audio are explicitly outside this checkpoint.

## Remaining limitations

- Native es-MX/pt-BR human review remains a follow-up and is not inferred from the recorded operational sign-offs.
- Voice and narration audio remain out of scope. Text-only Mentor plates are the supported fallback.
