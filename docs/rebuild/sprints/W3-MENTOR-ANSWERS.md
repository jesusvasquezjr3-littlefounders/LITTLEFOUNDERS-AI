# W3 lane: Mentor answers and stage completeness

Status: lane finished (W3M.1 and W3M.2 implemented and locally verified); nothing here is accepted or released. Recorded 27 September 2026 on branch `codex/spec-w3mentor` (worktree `C:/lf-wt/w3mentor`), branched from `cfe204d3`. Owner: Engineering (W3 Mentor lane) for implementation; the owner for the questions below and for the character-render style review (07 §7, OD-14); Product for copy review.

This lane finishes the rebuilt Mentor screen against Frontend Bible 08 after wave 2: the M-04 recap before the closing (OD-28) on the Mentor screen, the open items of the [W2 Mentor stage record](W2-MENTOR-STAGE.md), and the 08 checklist (eight catalogue states, speech-plate budget, board on demand, reply chips, microphone policy, transcript sheet, width layouts, performance fallbacks, age bands, and the lesson's compact stage as the same component, 08 §11).

## W3M.1: the Mentor screen against Bible 08, item by item

What was already true on the integration branch (W2M.1 to W2M.4) was read against 08 again, and each remaining gap was built. The table is the audit; "Built in W3M.1" names what this checkpoint changed.

| 08 clause | State before W3M.1 | Built in W3M.1 | Where |
|---|---|---|---|
| §3 eight states from catalogue poses | Every state mapped to a catalogue pose (`stageStates.ts`). The screen asked for `encouraging` only when the model's turn carried that emotion. | `encouraging` is also requested after a missed live activity and while a guided-review offer (C.15, D9) is open; speaking and thinking still outrank it. `celebrating` stays refused without a D7 milestone: no Mentor session reaches one today (Core's segment grade returns no `celebrations`), so the screen never asks for it (owner question 3). | `screen/MentorScreen.tsx` `stageStateFor` |
| §3 speaking: "the speech plate text shown as it is spoken" | A long voiced turn was paged; the learner pressed Next while the voice ran on. | While the Mentor speaks (and while a past talk replays), each caption page holds about as long as it takes to say it (400 ms a word, never under 1.5 s) and turns by itself, settling on the last page. Next still moves on sooner. | `MentorScreen.tsx` `SpeechPlate`, `captionPageMs` |
| §2 layer 3 speech-plate budget | Caption pages within the `mentor` role (20 words and 2 sentences; 12 for 6-9; x1.25 es/pt). | No change needed. | `screen/speechPages.ts` |
| §2 layer 5 reply chips (8 words; 5 for 6-9) | Static chip copy passes the copy-budget test; an opening that names a catalogue topic ("Keep going: {topic}") could overflow a 6-9 chip. | A filled opening that exceeds the `option` budget for the learner's band and locale says the generic line instead (never cut, 02 D1). | `MentorScreen.tsx` `openingsFor` |
| §2 layer 4 board on demand | Over the lower stage on a phone, beside the character on a desktop, reopenable by a chip. | No change needed. | `MentorScreen.tsx`, `mentorScreen.css` |
| §2 layer 5, C.2 microphone | Shown only where Core's policy allows it; the guardian's permission control was built (`VoiceConsent`) but not mounted. | The family lane mounted its own rebuilt permission control on the Family console and the child's Mentor page (`family/console/ChildControls.tsx` `MicrophoneConsent`; wording names the Mentor, two presses to grant, one to revoke, policy before consent). The Mentor lane's `VoiceConsent` is now a duplicate kept only in the preview (open item). | `rebuild/family/console/` (W2F) |
| §2 transcript sheet | A secondary sheet in reading order. | No change needed. | `MentorScreen.tsx` |
| §6 width layouts | Phone 55% of the height, tablet 50%, desktop 7 of 12 columns; the plate always across the lower stage when stacked. | Tablet: on a stacked screen from 600 px whose stage is landscape (at least 3:2), the plate stands at the inline end of the Diorama, beside the character, instead of across the lower stage ("when the scene allows it"). | `screen/mentorScreen.css` (`lf-mentor-region` size container) |
| §7 performance fallbacks: per-state stills | The fallback and the loading cover showed each character's idle render whatever the state (W2M limitation; owner question 2 of W2M). | 96 per-pose stills rendered from the real models at zero spend: 12 catalogue poses (the eight states in the expressive and the calm register, and the closing gesture of each C.16 script) x 4 characters x 2 colour modes, each the rebuilt stage itself with the pose held (the frame a reduced-motion learner sees), registered as drafts in `mentor.stageStill`. The full stage now shows the still of the pose it is in, both while the live model loads and in the fallback. | `frontend/scripts/render-mentor-stage-stills.mjs`, `public/rebuild/mentor-stage/`, `rebuild/assets/manifest.json`, `mentor/stageStills.ts` |
| §7 fallback: "sequences play once per state change and settle" | A state change in the still fallback swapped the picture instantly. | In the still fallback a state change fades to the next pose's still once and settles, as the held 3D does under reduced motion. No sequence clips exist (open item). | `mentor/MentorStage.tsx`, `mentor/mentorStage.css` |
| §9 age bands | Chips lead for 6-12, the field for 13+ (DOM order); the stage was the same size for every band. | 6-9 gets the largest stage (60% of a phone's height, 55% on a tablet), 10-12 a slightly smaller one (57%, 52%), 13+ the base (55%, 50%); the desktop split keeps 7 of 12 columns. Components, models and Diorama do not change. | `mentorScreen.css` |
| §11 compact stage is the same component | The lesson band renders `MentorStage size="compact"` (`learning/CompactMentorStage.tsx`, `lessonStage.tsx`), bands 110/96/80 px (under 15% of a 740 px screen, so it never pushes the answers down). | No change needed; the per-pose stills stay off the band (it keeps its band-shaped stills). | `rebuild/learning/` |
| OD-28 M-04 recap before the closing | The first press of end asks the recap (`end_session` with `recapFirst`), the close control is disabled until the recap turn arrives, a "Finish now" chip and a second press leave, and a server that answers neither closes after 4 s. The server lane's wait limit on an unanswered recap (`RECAP_ANSWER_WAIT_MS`) was lost at the W3A merge. | An unanswered recap closes the talk after two minutes (`RECAP_ANSWER_WAIT_MS`, restored on the client); a draft in the field or a reply on its way holds it. | `screen/useMentorSession.ts` |

**Verified (local only).** `npm run type-check` and `npm run lint` in `frontend/`; focused unit tests: `MentorScreen.test.tsx`, `MentorScreenMore.test.tsx`, `useMentorSession.test.tsx`, `MentorStage.test.tsx`, `stageStills.test.ts`, `stageStates.test.ts`, the Mentor copy-budget test; `node scripts/check-rebuild-assets.mjs` (every still registered, referenced, within its size, a real render of the character's own model in a catalogue pose); root `npm run spec:check` and `npm run secrets:check`. New tests: the state requests (a miss and a guided-review offer encourage; speaking and thinking outrank), the chip budget per band, the caption pacing, the recap wait (a draft holds it), a full-stage still for every pose, character and mode, and every 08 §3 state in every band and closing resolving to a pose that has one. Visual: the stills were read directly (examples in the verification log); no browser matrix and no `audit:rebuild` (speed mode: the orchestrator runs them once per merge).

**Remains open.** See the limitations and owner questions below.

## W3M.2: lane finish

Synced with `codex/spec-migration-s02` (already up to date at `cfe204d3`, no conflicts). Adversarial pass over the lane against M-04, Bible 08 and the compact stage; two items were mandated and half-built, and both are now built.

| Item | Before | Built in W3M.2 | Where |
|---|---|---|---|
| OD-28 M-04: the server holds the recap wait | Only the client closed an unanswered recap; a learner who closed the tab left Oracle to park the session and finalize it as `learner_left` after the grace window. | Oracle closes a learner-asked recap that has gone unanswered for `RECAP_ANSWER_WAIT_MS` (two minutes, on the existing heartbeat, floor free) with the completed close. A socket that drops while the learner's own recap waits (or is still queued behind a busy turn) closes `completed` once instead of parking. A recap the Mentor asked (a wrap-up, an accepted offer) still parks and stays resumable. The client constant now mirrors the server one. | `oracle/src/ws/server.ts` (`Live.learnerRecapAsked`, `recapWaitExpired`, heartbeat, close handler); `docs/rebuild/mentor/SESSION-END-POLICY.md` |
| C.2 one microphone permission control | Two rebuilt controls with the same contract: the family lane's `MicrophoneConsent` (mounted) and this lane's `VoiceConsent` (preview only). | `VoiceConsent`, its stylesheet, test, preview state (`mentor-voice-consent`), its three audit states and its `mentorVoiceConsent` copy in all three locales were retired; the family control is the only one. The Core client calls in `mentor/session/tutorApi.ts` stay (the API surface is unchanged). | `frontend/src/rebuild/mentor/`, `preview/registry/mentor.tsx`, `scripts/audits/lanes/mentor.mjs`, `i18n/*/rebuild-mentor.json`, `copy-budget/mentor.test.ts` |

Checked and unchanged: the M-04 UI (first end asks, close disabled until the recap turn, "Finish now" and a second press leave, a two-minute client wait), the eight 08 §3 states and their stills, the compact lesson band as the same `MentorStage` (08 §11), no legacy component under `rebuild/mentor`, the Mentor copy in EN, es-MX and pt-BR (i18n gate green).

**Verified (local only).** Frontend: `npm run type-check`, `npm run lint`, full unit suite (298 files, 3424 tests pass). Oracle: `npm run type-check`, `npm run lint`, full unit suite (64 files, 1692 tests pass), including two new tests: a socket dropped during the learner's recap closes `completed` exactly once past the resume grace window, and `recapWaitExpired` fires only for a learner-asked recap with the floor free past the wait. Root: `spec:check`, `secrets:check`, `session-end:check`, `governance:check`, `agent/tools/check-i18n.sh`. No browser matrix and no `audit:rebuild` (speed mode).

## Verification log

| Check | Command | Result |
|---|---|---|
| Stage stills | `REBUILD_URL=http://localhost:5540 node scripts/render-mentor-stage-stills.mjs` (one job per character, software GL, virtual clock; resumable, a hung or reloaded capture is retried) | 96 stills, 4:5, 400 x 500, palette PNG, 32-75 KB each (5.3 MB in all); read directly: Dr. Rho demonstrating (light), Zara celebrating (light), Liruf thinking (dark), Dina idle (light). The gesture is visible in each held pose; Dr. Rho's ammonite still crosses his hand (known) |
| Screen layout | Headless capture of `rebuild.html?screen=mentor-screen&state=conversing` at 1000 x 700 (Dr. Rho, 10-12) and 375 x 740 (Zara, 6-9) | Tablet: stacked, the plate at the inline end (x 644-984) clear of the character's face and hands. Phone 6-9: the stage 444 of 740 px (60%), chips and field in the first view |
| Assets | `node scripts/check-rebuild-assets.mjs` | OK: 142 class B assets, all drafts awaiting the owner's style review |
| Types and lint | `npm run type-check`, `npm run lint` (frontend) | Clean |
| Unit tests | `npx vitest run src/rebuild/mentor src/rebuild/copy-budget/mentor.test.ts src/rebuild/learning/wellbeingS053f.test.tsx src/tutor-scene/__tests__/rebuildMentorParity.test.ts` | 27 files, 365 tests pass |
| Root gates | `npm run spec:check`, `npm run secrets:check` | Pass |
| W3M.2 frontend | `npm run type-check`, `npm run lint`, `npm test` (frontend) | Clean; 298 files, 3424 tests pass |
| W3M.2 Oracle | `npm run type-check`, `npm run lint`, `npm test` (oracle) | Clean; 64 files, 1692 tests pass |
| W3M.2 root gates | `spec:check`, `secrets:check`, `session-end:check`, `governance:check`, `check-i18n.sh` | Pass |

## Limitations and open items

- **Stills are drafts.** The 96 stage stills await the character-render family's style review (07 §7, OD-14); a release build refuses drafts by design. They are rendered on `diorama-a` with the live stage's default shot; a learner on `diorama-b` sees the other Diorama in the still until the live model is ready (the chooser renders have the same limit). Props that cross the character in the live close-up (Dr. Rho's ammonite) cross it in the still too (the W2M engine-placement limitation).
- **No sequence clips.** 08 §7 allows "short sequences" in the fallback; the stage cross-fades between per-pose stills instead.
- **The compact band shows the Diorama, not the chapter scene.** 08 §11 allows ("may") the active adventure's scene; not built.
- **The learner-asked marker is not in the park snapshot.** It lives on the socket (`Live.learnerRecapAsked`). A drop while the recap waits now closes the session, so no resume carries it; a recap still waiting after a crash-and-resume on another replica falls back to the idle close.
- **Owed at merge or release:** `audit:rebuild` on the Mentor preview states and the real `/tutor` and lesson routes (the retired `mentor-voice-consent` states are gone from the lane list).
- **Evidence scope.** Local, Chromium, software GL on a shared machine; no device, GPU, Safari, Firefox or screen-reader pass; no human design review.

## Owner questions (conservative defaults implemented)

1. **Per-state stills for the full stage** (W2M owner question 2): implemented as drafts, one per catalogue pose, four characters, two modes. Proposal: review them with the character-render family (07 §7).
2. **Caption pacing while the Mentor speaks:** 400 ms a word, at least 1.5 s a page, with Next to move on sooner. Proposal: accept; tune with the real voice's pace on a device.
3. **No celebration on the Mentor screen.** No D7 milestone is reachable inside a Mentor session today, so the stage never celebrates there. Proposal: accept; if a Mentor activity should count toward a milestone (a badge, a streak day), Core's segment grade must return it first.
4. **A chip that would overflow says the generic line** ("Continue where we stopped", "Practise a skill") instead of the topic's name. Proposal: accept.
5. **Stage presence by age band:** 60/57/55% of a phone's height (55/52/50% on a tablet) for 6-9, 10-12 and 13+. Proposal: accept (08 §9 names the order, not the numbers).
6. **Recap wait:** two minutes, the value the server lane chose. Proposal: accept.

## Merge integration

Merged into `codex/spec-migration-s02` on 27 September 2026 (after the W3 design-system, learner and social lanes).

- No migrations in this lane, so nothing was renumbered.
- `frontend/src/rebuild/assets/manifest.json` conflicted at the end of the list: the 96 `mentor.stageStill` rows were appended after the design-system lane's two `celebration.lesson-complete.confetti` rows. The lane's copy of `sound.lesson.not-yet` still carried the `wiring` field that W3D.1 removed when the sound was wired; the integration branch's version (no `wiring`) was kept.
- `docs/rebuild/REQUIREMENTS.md`: B.23 keeps the social lane's W3S.1 entry and gains W3M.1's stage-size-by-band note; C.16 gains the W3M.1 and W3M.2 recap-wait notes; C.17 keeps the W3S.2 entry (the lane did not change it).
- No other defects. The removed `VoiceConsent` has no remaining importers; the legacy `frontend/src/tutor/VoiceConsentControl.tsx` is unrelated and untouched.
- Checks on the merged tree: `typecheck:all`, `lint:all`, `spec:check`, `secrets:check`, the i18n gate, frontend unit suite (301 files, 3464 tests) and Oracle unit suite (64 files, 1692 tests) all green. Oracle's first run, concurrent with the frontend suite, hit hook timeouts (admission-control, hardening, live-session, sttFailureKind, boot-skills); a quiet rerun passed all 64 files.
