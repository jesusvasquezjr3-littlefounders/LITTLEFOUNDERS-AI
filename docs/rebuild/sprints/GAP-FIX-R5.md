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

### Gap 2: the lesson's compact Mentor follows the lesson; the offer's choices are equal (Bible 08 §11, §3, §4; D9; B.8)

Verified first: `LessonStageSlot({ verdict })` passed only the verdict,
`CompactMentorStage` played `lessonStateFor(verdict)` (idle, acknowledging or
encouraging), `NarrationControl`, `WorkedExampleBoard` and `StepReplay` never
informed the stage, the guided-review offer rendered as the lesson layer's
sibling of the board (outside any stage context), and its choices were an
`accent` button and a default one.

| SPEC clause | What was built | Where |
|---|---|---|
| 08 §11 ("the same states as section 3": introduces, reacts, demonstrates beside the board); 08 §3 (encouraging when offering a guided review) | A counted stage-request store (`LessonStageRequestHost`, `useLessonStageRequest`) in the lesson layer, above both the lesson and the offer (a lesson without the layer gets its own). `NarrationControl` requests `speaking` while its line plays; `StepReplay` and `WorkedExampleBoard` request `demonstrating` while on screen; `GuidedReviewOffer` requests `encouraging` while open. The slot adds a 2 s introduction (`speaking`) when a segment mounts (boards remount per segment). `lessonStageStateFor` resolves: verdict reaction, then the offer, then speaking, then demonstrating, then idle; no path returns `celebrating` | `frontend/src/rebuild/learning/lessonStage.tsx`, `LessonLayer.tsx`, `segmentKit.tsx`, `StepReplay.tsx`, `WorkedExampleBoard.tsx`, `GuidedReviewOffer.tsx`, `CompactMentorStage.tsx`, `frontend/src/rebuild/mentor/stageStates.ts` |
| 08 §4 (two equal choices, never a default-accepted path); D9 | Both offer choices are the same (secondary) variant and size, marked `data-offer-choice`; neither takes focus | `GuidedReviewOffer.tsx` |
| 08 §7 (the still fallback shows the state the stage is in) | No new stills were needed: the GAP-FIX-R2 band stills already cover speaking (`ambient.idle.happy`) and demonstrating (`teach.explain`) for every character, both modes and both band shapes; a new unit test pins that every state a lesson can request has its band still | `frontend/src/rebuild/mentor/__tests__/stageStills.test.ts` |
| Verification harness | `verify-compact-stage.mjs` records every state the band shows from the first frame and adds five checks (intro, worked example light and dark, offer young and teen: settled state, the states seen, no celebration, equal and unfocused 48 px+ choices); `STAGE_ONLY=states` runs just these. Previews: `screen=workedexample&stage=1`, `screen=lesson&stage=1&offer=1` | `frontend/scripts/verify-compact-stage.mjs`, `frontend/src/rebuild/preview/registry/learn.tsx` |

Verification (local): `lessonStage.test.tsx` (7: intro then rest, verdict
wins, replay demonstrates and stops, a worked example demonstrates, narration
speaks exactly while playing, the offer beside the lesson encourages, counted
requests), `stageStates.test.ts` (13, the precedence and no celebration over
every combination), `stageStills.test.ts` (18), `wellbeingS053f.test.tsx`
(19, equal and unfocused choices in both registers), and the lesson player,
layer, authenticated-document and board-reset suites (all pass).
`verify-compact-stage.mjs` against the lane's dev server: the five new state
checks pass (the band was seen `speaking` then `idle`; `speaking` then
`demonstrating` with the `teach.explain` still; `encouraging` with
`feedback.retry.gentle` (6-9) and `ambient.listen` (13-17), choices 56 px and
equal).

### Gap 3: every mounted Mentor screen state is in a Bible audit state (08 §10 item 5, 08 §4, 02 §7 item 10, 06 §7, 03 §5)

Verified first: `frontend/scripts/audits/lanes/mentor.mjs` declared no state
for the goal-agreement chips, the stop-or-continue choice, the likely-answer
chips, the Thinking plate, the microphone level, the live error notice, the
transcript and grown-up sheets, the recap's "Finish now" chip or the
start-over ConfirmDialog, and no lane audited the four standalone Mentor
preview screens.

| SPEC clause | What was built | Where |
|---|---|---|
| 08 §10 item 5, 06 §7, 02 §7 item 10, 03 §5 | 19 new Mentor screen audit states spread over the child bands (goal, session-end, replies, thinking, recording, error, transcript, grown-up, recap, start-over), each with `readyAll` selectors that prove the state rendered; 10 states for the standalone previews (`mentor-session-end` with each closing script, `mentor-goal-check`, `mentor-alliance-check`, `mentor-profile` own and child) | `frontend/scripts/audits/lanes/mentor.mjs` |
| same | Preview openers `?recap=1` (the OD-28 recap's one "Finish now" chip) and `?dialog=start-over` (the start-over ConfirmDialog), both only in a conversation, through a new `initialConfirmRestart` prop | `frontend/src/rebuild/mentor/screen/MentorScreenPreview.tsx`, `MentorScreen.tsx` |

Verification (local): `MentorScreenPreview.test.tsx` (3: recap chip, start-over
dialog, neither outside a conversation or by default) with the Mentor screen
suites (74 pass); the lane module loads with 63 unique state ids and every
`readyAll` selector was checked against the component source. Frontend
type-check and lint pass. No requirement row owns audit coverage, so no row
changed.

Remaining: the three audits (`npm run audit:rebuild`) have not measured these
states. Speed mode keeps browser runs with the orchestrator's final gate; an
earlier attempt in this lane was interrupted before it finished. Any finding
there is open until that run.

### Lane summary

Built: stored-note deletion for the owner and the verified Tutor (C.4, OD-18);
a compact lesson Mentor that introduces, demonstrates and encourages, with
equal guided-review choices (08 §11, §3, §4); audit states for every mounted
Mentor screen state (08 §10 item 5). Migration: `0241_learner_memory_clear.sql`
(provisional number, declared contract, apply by hand before the Core
release). Open: the orchestrator's UI audit of the new states; device,
assistive-technology and human review; nothing is accepted.
