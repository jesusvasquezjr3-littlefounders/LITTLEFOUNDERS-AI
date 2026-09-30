# Gap-fix round 8, learning lane (fix8learni6)

Branch `codex/spec-fix8learni6`. Status: **implemented and locally verified; not accepted.** No migration.

## Gap closed

**The v1 lesson player showed hand-drawn 2D look-alikes of the four Mentors.** The gap was real. `tutor-scene/CharacterLayer.tsx` `CharacterSlot` rendered the legacy SVG `CharacterActor` in two cases:

- outside a `CharacterLayerProvider`;
- while the shared canvas was not drawing. That covers a cold three.js chunk, a model still loading, missing WebGL, a lost context and a background tab.

`CharacterActor3D` also kept a `bubble` branch that always returned the 2D actor.

SPEC clauses:

- Frontend Bible 02 rule 21 and D12: a Mentor character is only a render of its real 3D model.
- Bible 07 §4: never a look-alike.
- Bible 08 §7: the fallback is pre-rendered stills of the same models in catalogue poses.
- OD-14, and the CLAUDE.md SPEC rule "Never generate a look-alike".
- OD-24 keeps the v1 player running, but rule 21 does not depend on whether the UI is legacy.

## What was built, and where

- `frontend/src/tutor-scene/slotStill.ts` (new).
  - `poseForSlot` maps a slot's emotion and action to a catalogue pose. It picks the first pose with both, trying ambient poses first. Failing that, it takes the pose holding that emotion at rest, then `ambient.idle`.
  - `findSlotStill` returns a transparent `mentor.avatar` render of that character in that pose when one is registered. Otherwise it falls back to `findMentorAvatar`, the idle render.
  - Every choice goes through `resolveMentorRender`, so it must be the character's own model, square and transparent. It never resolves to another character's render.
  - It returns the pose the still actually shows.
- `frontend/src/rebuild/design/assets.ts`: `findMentorAvatarInPose`, a posed lookup with the same refusals as `findMentorAvatar`.
- `frontend/src/theme/useTheme.tsx`: `useIsDarkTheme`. It needs no provider and falls back to the `dark` class on `<html>`, so the still follows the colour mode.
- `frontend/src/tutor-scene/CharacterLayer.tsx`: while not drawing, the slot renders `<img alt="">` with the manifest still.
  - The slot stays `aria-hidden`, keeps its box (`className`) and exposes its crop (`data-crop`).
  - The image uses `object-contain`, anchored to the top for `bust` and to the bottom for `full`.
  - The slot now reports `data-render="still"` instead of `2d`, plus `data-still-pose`.
- `frontend/src/components/characters/control/CharacterActor3D.tsx`: the `bubble` branch is removed, since no caller passes it. The props type now lives here, without `bubble` or `enableMouseTracking`.
- Deleted:
  - `components/characters/control/CharacterActor.tsx`
  - `components/characters/control/rig.css`
  - `components/characters/{DinaCharacter,DrRhoCharacter,LirufCharacter,ZaraVexCharacter}.tsx`
  - the 2D-only `EMOTION_TO_NATIVE` and `ACTION_DURATION_MS` in `control/types.ts`
- Gates and tests updated for the deletion:
  - `agent/tools/legacy-ui-freeze.json`: the six files moved from `files` to `removed`, so `check-legacy-ui` refuses any import of them from `src` or `scripts`.
  - `check-reward-mechanics.mjs`: the four blink-timing allowlist rows are gone.
  - `celebrationBudget.test.ts`: the definitions list is closed without the four characters.
  - `designClasses.test.ts`: "renders no flat cast anywhere".
  - `verify-lesson-engine.mjs`: the hollow-slot probe now reads `data-render="still"`.
  - Stale comments in the character layer canvas, the lesson-engine browser script and `LessonPlayer.tsx` are updated.

## Verified

- `frontend`: `npm run type-check` and `npm run lint` are clean.
- Focused vitest: 11 files, 65 tests, all green.
  - `tutor-scene/__tests__/CharacterLayer.test.tsx`: with no provider and with a provider whose canvas never draws (`drawing=false`), the slot holds an `img` whose `src` is a manifest `mentor.avatar` render of that character's own model in the right colour mode, and holds no `svg`. It also covers the pose mapping, the idle fallback that reports the pose it shows, and the rule that no character resolves to another's render.
  - `tutor-scene/__tests__/noLookAlikeReachable.test.ts` (new): walks every static and lazy import from `main.tsx`, a walk that reaches both `CharacterLayer.tsx` and `slotStill.ts`. It asserts that no `components/characters/*Character.tsx`, `CharacterActor.tsx`, `rig.css` or SVG-drawing character module is reachable.
  - Also run: `CharacterActor3D.test.tsx`, the story family tests, `designClasses`, `celebrationBudget`, `poseLibrary`, `rebuildMentorParity`, `avatarFallback`, and the two player tests that mock the 3D actor.
- Root:
  - `npm run spec:check` is OK. It includes `check-legacy-ui`, `check-rebuild-assets` and `check-reward-mechanics`.
  - `npm run secrets:check` is OK.
  - `node --test` passes on `check-reward-mechanics.test.mjs` and `check-legacy-ui.test.mjs`.
- No copy changed, so no i18n gate was needed. No browser run, per lane rules.

## Open

- **No posed transparent stills exist yet.** Today every slot fallback shows the idle avatar render (`ambient.idle`), whatever emotion or action it was asked for. The slot says so through `data-still-pose`. Adding a transparent 1:1 `mentor.avatar` render per pose, rendered with `scripts/render-mentor-avatars.mjs`, is picked up automatically by `findMentorAvatarInPose`. Rendering needs a headless browser, which this lane may not run.
- The avatar render is a head-and-shoulders crop. In `full`-crop slots (the cast row, story scenes), the fallback therefore shows a bust anchored to the bottom rather than a full figure. That needs an owner visual review (the character-renders family is still draft).
- The orchestrator's UI audit and `verify:lesson-engine` should confirm there is no hollow slot in a browser.

## Owner questions

- Should the v1 player's `full`-crop fallback use transparent full-body stills? That would mean rendering a new transparent full-figure slot. The conservative default applied here is the registered idle avatar render, which never shows a look-alike.
