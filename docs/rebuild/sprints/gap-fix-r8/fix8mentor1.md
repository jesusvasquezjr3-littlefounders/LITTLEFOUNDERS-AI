# Gap-fix round 8: Mentor stage (fix8mentor1)

Branch `codex/spec-fix8mentor1`. Status: **implemented and unit-verified; not accepted.** Nothing here ran in production or in a browser matrix. The sequences are drafts until the owner reviews the character-render family (07 §7, OD-14).

## 1. The still fallback had no rendered sequences

**SPEC:** Frontend Bible 08 §7 ("pre-rendered stills and short sequences from the same models and catalogue poses"; "idle is a still: sequences play once per state change and settle"), 08 §10 item 4; 07 §1 (Mentor character motion), 07 §4 (stills and short sequences from the real models), 07 §5 (every rendered sequence has a still; plays once, never loops).

**The gap was real.** The still fallback (low power, no WebGL, data saver, frame-rate strikes, renderer failure) only cross-faded between per-pose stills. The manifest had no sequence asset, and `W3-MENTOR-ANSWERS.md` listed "No sequence clips" as open.

**Built.**

- `frontend/scripts/render-mentor-stage-sequences.mjs` (zero spend, local): the rebuilt `MentorStage` live on `diorama-a`, the character's own `/scenes/<character>.glb`, on a virtual clock. It captures the catalogue transition into each pose over its motion token (`--dur-transition` 380 ms, `--dur-celebration` 700 ms for the D7 poses), blends the last two frames into the pose's registered still, and ends on that still. The output is an animated WebP that plays once (loop count 1). `SEQ_MANIFEST=1` prints the manifest rows for the files on disk. Rerunning the script skips files already rendered.
- `frontend/scripts/lib/mentorStagePoses.mjs`: the one pose list shared by the stills and the sequences renderers.
- `frontend/src/rebuild/assets/manifest.json`: new slot `mentor.stageSequence`, type `sequence`, `reviewStatus: "draft"`. Each row names its end frame (`endFrame`, the `mentor.stageStill` of the same character, pose and mode) and its `durationMs`.
- `frontend/scripts/check-rebuild-assets.mjs`: `sequence` is an asset type (150 KB budget, as a character still). It must be an animated WebP that loops once, lasts at most 3 s and declares its real duration. It must be of the character's own model, in the catalogue, never for idle, map to motion tokens, and have a live end-frame still of the same character, pose and mode.
- `frontend/src/rebuild/mentor/stageStills.ts`: `findStageSequence(character, poseId, theme)`. It returns null for idle, and for a sequence without its still.
- `frontend/src/rebuild/mentor/MentorStage.tsx`: in `still` mode on the full stage, a state change fades as before. Under the fade, the pose's sequence loads (up to `SEQUENCE_WAIT_MS`, 600 ms), plays once over the pose's still and is removed after its duration, leaving the still. Idle, reduced motion, the compact band and a missing or late sequence keep the still and its fade unchanged. With data saver on, only a copy the browser already holds plays (`cache: 'only-if-cached'`). `data-still-sequence` exposes the playing sequence. A new `environment` prop lets a host (the OD-12 wrapper, the preview) state device conditions.
- `frontend/src/rebuild/mentor/MentorStagePreview.tsx`: `?device=low-power|no-webgl|data-saver` shows a fallback without emulation; `?then=<state>` switches state a second after ready, to see a sequence play. The query is reread on `popstate`, which the renderer uses.

**Verified.**

- `src/rebuild/mentor/__tests__/MentorStage.test.tsx`: a state change plays the sequence once and ends on the pose's still; idle never plays one; reduced motion never plays one; data saver asks only for a cached copy and settles on the still; a late sequence settles on the still. The existing fallback tests still pass (25/25).
- `src/rebuild/mentor/__tests__/stageStills.test.ts`: every registered sequence resolves and ends on its still; idle never has one.
- `npm run type-check` and `npm run lint` (frontend); the 26 mentor test files (373 tests); `check-rebuild-assets` (431 class B assets, the 52 sequences included); root `npm run spec:check` and `npm run secrets:check`.
- After merging `codex/spec-migration-s02` (clean, no conflicts): the frontend type-check, `check-rebuild-assets` and the 26 mentor test files pass again.
- One sequence was inspected frame by frame (Rho, `teach.explain`, light): it shows the real model raising its arm into the point and ending on the still. It has 10 frames over 380 ms, then the still, with a loop count of 1.

**Open.**

- 52 of 104 sequences are rendered and registered: Rho and Zara, all 13 non-idle poses, light and dark (about 38 to 153 KB each; the one over 150 KB carries a `budgetReason`). Liruf and Dina have none yet: their capture runs failed to reach a ready live stage while the machine ran other lanes. Until they are rendered, those two keep the still and its fade. To resume, run a Vite dev server, then `REBUILD_URL=http://localhost:<port> SEQ_CHARACTERS=liruf,dina node scripts/render-mentor-stage-sequences.mjs`, then `SEQ_MANIFEST=1 SEQ_CHARACTERS=liruf,dina node scripts/render-mentor-stage-sequences.mjs` for the manifest rows. The script skips files already on disk.
- The compact lesson band keeps its fade: its stills are a different framing (`lesson.compactMentorStill`), and no band-framed sequence is rendered.
- No browser check of a sequence playing on the stage in this checkpoint; the preview states above are ready for it.
- The owner's style review of the drafts (07 §7, OD-14).

**Owner questions (default implemented).**

- Should the compact lesson band also get rendered sequences? Default: no. The band keeps its still and fade, and only the full stage plays sequences.
