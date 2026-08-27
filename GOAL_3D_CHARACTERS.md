# GOAL — 3D characters in the Lesson Engine, a reusable pose library, and Lesson Engine gamification

> Owner request, 2026-08-27. Authority: this document defines SCOPE and
> ACCEPTANCE for the work; on any conflict with an invariant, `/AGENTS.md` wins
> and the conflict is surfaced rather than resolved silently (§1.0.1).
>
> Status: **IN PROGRESS.** Decisions answered 2026-08-27 (§6). §3.3 the
> pose lab and the character-only stage are DONE; §3.2 the library is at
> 57 entries; §3.1 and §3.4 are next.

---

## §1 Why

User testing found the 3D characters read as more useful than the 2D ones for
practical explanation. The 3D cast already exists, is already rigged, and
already speaks the same emotion/action vocabulary as the 2D layer — it is
currently reachable only from inside the Tutor's diorama.

So this is mostly **exposure and reuse**, not new capability. The genuinely new
work is the pose library and the Lesson Engine's gamification pass.

## §2 What already exists — do not rebuild it

Established by reading the code, not assumed:

| Thing | Where | State |
|---|---|---|
| Emotion/action vocabulary | `components/characters/control/types.ts` | **7 emotions × 12 actions × 4 characters**, one source both layers already use |
| 3D clips for that vocabulary | `tutor-scene/clipLibrary.ts`, `clips-biped.glb` | All twelve actions and all seven emotions are authored clips (`TUTOR_3D.md` §0) |
| Per-character overrides | `<action>@<characterId>` | Exists because additive composition fixes proportions, not amplitude |
| Clip authoring pipeline | `scripts/author-clips.py` | The tool the library grows through |
| Asset budget as code | `tutor-scene/budget.ts`, `/dev/scene-lab` | `maxTrianglesPerFrame` 220,000; live Tutor scene ~51k/frame, 7 draw calls |
| 2D characters | `components/characters/*.tsx` | **STAY. Not deleted, not deprecated** — owner instruction, non-negotiable |

**The three rules the 3D rig already enforces, learned expensively:**

1. **A shared clip is ROTATION-ONLY and composed ADDITIVELY.** An absolute clip
   dresses every character in the authoring rig's skeleton — measured: Liruf's
   feet snap from 0.447 to 0.092 apart, Rho's torso folds 70°.
2. **Some gestures cannot be retargeted at all.** An armature-space retarget was
   built, verified correct on the authoring rig (2e-6), and still helped Liruf
   while hurting Rho. Rho's arms are physically too short to pass his own crown,
   so his `celebrate` is a DIFFERENT pose rather than a scaled one.
3. **Dina is a quadruped on a 27-joint rig with different bone names.** She is
   excluded from the shared CLIP library by rig kind - but NOT from the
   vocabulary: `characterActions.ts` carries a QUADRUPED driver table typed
   `Record<CharacterAction, ...>`, all twelve actions expressed through head,
   chest, ears and tail. *This document's first draft said she should be
   excluded from poses needing hands. That was wrong and the pose library was
   written the other way.*

Any pose library that assumes one clip serves four characters is wrong before it
is written - and any that assumes the quadruped cannot participate is wrong for
the opposite reason.

## §3 Scope

### 3.1 The Lesson Engine renders 3D characters

A character-only 3D surface — **no diorama, no island, no environment** — that
is a drop-in for the existing `CharacterActor` prop surface (`character`,
`emotion`, `action`, `loop`, `speaking`, `bubble`, `size`, `actionKey`).

Same props in, same meaning out. Every caller listed in §2 keeps working, and
switching a surface between 2D and 3D is a one-line change.

### 3.2 A pose library of 50–100 named entries

Named, reusable poses / emotes / dances / actions, addressable from the Lesson
Engine, the Tutor, and marketing captures alike, so a pose is authored once and
paid for once.

Grown through `scripts/author-clips.py`, carried in the existing clip library,
and named on one scheme with per-character overrides where the rig demands it.

### 3.3 A pose lab

A developer surface that renders every entry for every character, so a pose is
reviewed by LOOKING at it. Nothing in this project's history supports trusting a
pose that nobody has seen on all four rigs — the retarget that was numerically
correct and visibly wrong is the precedent.

### 3.4 Lesson Engine gamification and VFX

More game feel and visual effects. Deliberately the least specified item here
(§6 decision 3).

## §4 NOT in scope

- Deleting, deprecating or hiding any 2D character file. **Non-negotiable.**
- Changing the Tutor's diorama, its camera, or its performance budget.
- Changing the emotion/action vocabulary itself. Adding poses is additive; a
  breaking change to the 19 primitives is a separate decision.
- Voice, captions, or anything in `/ORACLE.md`'s contract.

## §5 Acceptance — how "100% complete" is judged

Every line here is checkable by running something or looking at something.

**3D in the Lesson Engine**
- [ ] A lesson plays end to end with 3D characters at 375px and 1280px, light
      and dark, screenshotted (§1.11 — non-negotiable).
- [ ] **Measured** frame cost on a mid-range profile against the 2D baseline,
      published as numbers. §1.0: a stutter on a mid-range phone is a family
      that leaves, and 2D DOM characters currently cost approximately nothing.
- [ ] The 2D path still works and is still reachable — proven by a test, not by
      the files existing.
- [ ] No regression in `npm test` for `lesson-engine/`.

**The pose library**
- [ ] ≥ 50 named entries, each rendered for every character that supports it.
- [ ] A gate asserts every entry resolves for every supported character, and
      that a character without one falls back visibly rather than silently.
- [ ] `verify:rig` still passes: every clip keeps every character in its own
      stance and proportions (§5 of `/AGENTS.md`).
- [ ] Contact sheets for all four characters, reviewed by the owner.

**Gamification / VFX**
- [ ] Defined once §6 decision 3 is answered, then filled in here before build.

**Always**
- [ ] Every root gate green, three-locale i18n parity, docs updated in the same
      commit (§8).

## §6 Decisions — answered 2026-08-27

**1. Where does the 3D character render?** ONE persistent canvas, as
recommended. Built as `tutor-scene/CharacterStage.tsx`: `SceneCanvas` +
`SceneLighting` + `Character3D`, no diorama, no camera director, no time of day.
The framing is derived from each character's own `targetHeightM`, because a
fixed distance frames a 1.61 m human and crops a 1.9 m dinosaur.

**2. What is a pose?** The owner's definition: *a concrete action a character
performs, documented, reusable anywhere on the platform.* So the catalog carries
the NAME, the INTENT and the parameters, and resolves to the emotion/action
vocabulary both rigs already speak. Adding a pose costs a row and a review, not
an authored clip and a download. Where the rig genuinely cannot express
something, the answer is a new clip through `scripts/author-clips.py` and a row
pointing at it — never a row pretending.

**3. Gamification.** Proceed with the candidates, with UI/UX improvement as the
general direction. Concretely, and to be filled into §5 before building:
combo/streak feedback inside a lesson, XP that animates rather than appears, and
character reactions tied to answer quality — the three that reuse the pose
library rather than adding a second system.

## §7 Sizing, honestly

This is multi-session work. §3.1 and §3.3 are a session each; §3.2 is the
largest and is bounded by authoring and review, not by code; §3.4 depends
entirely on §6.3.

Sequence: **the lab first** (§3.3) — done — then §3.2 to its full size, then
§3.1, then §3.4.

## §8 Done so far (2026-08-27)

- `CharacterStage` — one character, no world. Verified: all four render, each
  on its own contact shadow, correctly proportioned, Dina included.
- `FlatGroundProvider` — the stage has no island, so its floor is the origin
  plane. Kept in the PROVIDER rather than as a flag on `Character3D`, so the
  diorama's "no ground means a placement bug" reading survives untouched.
- `poseLibrary.ts` — 57 documented poses across eight categories, with a gate
  asserting every one resolves for every character and that `loop` is only
  claimed where BOTH renderers honour it.
- `/dev/pose-lab` — every pose, on every character, played and looked at.

**Known and not fixed:** Dina and Liruf sit tight against the bottom of the lab
frame. The aim point is a fraction of HEIGHT, which is the wrong measure for a
quadruped whose mass is low and long. Cosmetic in a dev surface; it matters the
moment the same framing is used in a lesson.
