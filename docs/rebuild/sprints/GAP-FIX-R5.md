# Gap-fix round 5

Lane records for the fifth gap-fix round of the SPEC migration. Each lane
appends its own section. Statuses follow the ledger: implementation, local
verification, acceptance and release are separate, and nothing here is
accepted or released.

## Checkpoint F5-mentor

Branch `codex/spec-fix5mentor`. Three audited gaps. Each was checked in the
code first and each was real.

### Gap 1: a stored Mentor memory note can be deleted (C.4, OD-18, S01.4)

Verified first: `backend/src/routes/tutor.ts` had no route that removes a
`learner_memory` row (the only `router.delete` handlers were the disposition
resets and the consent revoke), and the database had no function that clears
one (`decide_learner_memory_proposal`, `write_learner_memory_checked` and
`write_learner_memory_pair_checked` only write). `MemorySelfReview` and
`ChildMentorTalks` showed the current note read-only; their delete only
rejected a proposal.

| SPEC clause | What was built | Where |
|---|---|---|
| C.4 (self-review/deletion mechanism), OD-18 (approves or deletes every persistent note), S01.4 acceptance (visible deletion controls) | `clear_learner_memory(p_user, p_store, p_expected, p_actor, p_decided_by)`: service-role only; compare-and-delete of one store's row under the same advisory lock as the write path; one append-only `learner_memory_ledger` row with no text (actor `learner-self-deleted` or `guardian-deleted`, sha256 of the deleted note, sha256 of the empty string as the after hash); pending proposals of that store written against the deleted note are closed as rejected, decided by the deleter; a proposal computed from "no note yet" stays pending. Answers `deleted`, `absent` or `conflict`. A fifth parameter, `p_decided_by`, was added to the suggested signature because the proposals table requires a decider on every closed row | `database/migrations/0241_learner_memory_clear.sql` (number provisional; the orchestrator renumbers at merge) |
| same | `DELETE /tutor/memory/:store` (the owner; admitted only when `classifyMemoryReview` answers self-review or adult-direct; guardian-review is 403 GUARDIAN_MANAGED, hold is 403 AGE_EVIDENCE_REQUIRED) and `DELETE /tutor/kids/:kidUserId/memory/:store` (a verified guardian, re-checked on every call, audited without the text). Body `{ expected }` names the note on screen: a read failure is 502, a changed note is 409 NOTE_OUT_OF_DATE (checked before the write and again inside the database), no note is 404 | `backend/src/routes/tutor.ts`, `backend/src/services/tutorData.ts` (`clearLearnerMemory`) |
| same; Bible 02 §9.5 (destructive action behind a confirmation) | A secondary "Delete this note" action beside each current note in teen Settings (`MemorySelfReview`) and in the Family console (`ChildMentorTalks`), behind the rebuilt `ConfirmDialog` (destructive confirm), then a status line (deleted, changed, failed). Copy in EN, es-MX, pt-BR | `frontend/src/rebuild/memory/MemorySelfReview.tsx`, `frontend/src/routes/app/profile/TeenMemoryReviewSetting.tsx`, `frontend/src/rebuild/family/console/ChildMentorTalks.tsx`, `consoleApi.ts`, `rebuild/mentor/session/tutorApi.ts`, `rebuild-profile.json`, `rebuild-family.json` |
| C.4 via Appendix F 1.3 (Fracture-Closure Verification) | `check-mentor-minor-safeguards.mjs` check `memory-review` now requires the owner's delete to bind `classifyMemoryReview(user.id)` and refuse guardian-review and hold with 403, and the guardian's delete to re-check `isVerifiedGuardian` | `agent/tools/check-mentor-minor-safeguards.mjs` (+ test) |

Verification (local): 15 route tests in `backend/src/__tests__/tutor.test.ts`
(teen self-delete for both stores, adult direct, and the refused populations:
a linked child, a kid-role account with no link, an under-13 hold, another
teen reaching for someone's child, an unlinked adult, a Tutor for a kid with
no link, the child through the guardian route; 502 on eligibility, note and
guardian reads; 409 before the write and on the database race; 404; 400; the
audit row carries no text); the whole file passes (367). `node --test` on the
safeguards gate: 11 pass, including four new RED cases.
`database/scripts/verify-mentor-f5-postgres.py` on the lane's PostgreSQL 17.6
cluster (port 15720), all 241 migrations: compare-and-delete of one store, the
hashes-only ledger row, stale proposals closed and a from-nothing proposal
still applying, `absent`, the guardian stamp, four refused inputs, browser
roles denied, replay keeps rows. 5 new frontend tests (MemorySelfReview 17,
ChildMentorTalks 23, all pass). `check-migration-phase` and `check-migrations`
pass; the migration is declared contract (the classifier flags the DELETE in
the function body, as for 0118 and 0122) and must be applied by hand before
the Core release that serves the two routes.

Remaining: an adult has no screen for their own notes (the API admits them;
no SPEC surface asks for one). Assistive-technology and device evidence and
human review, as for the rest of C.4.
