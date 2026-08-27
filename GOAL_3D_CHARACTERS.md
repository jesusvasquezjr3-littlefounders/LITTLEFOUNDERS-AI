# GOAL — 3D characters in the Lesson Engine, a reusable pose library, and Lesson Engine gamification

> Owner request, 2026-08-27. Authority: this document defines SCOPE and
> ACCEPTANCE for the work; on any conflict with an invariant, `/AGENTS.md` wins
> and the conflict is surfaced rather than resolved silently (§1.0.1).
>
> Status: **IN PROGRESS.** Decisions answered 2026-08-27 (§6). §3.3 the
> pose lab and the character-only stage are DONE and reviewed on all four
> characters by looking at them; §3.2 is DONE at 100 poses / 80 distinct
> renders, contact-sheeted for all four; §3.1 is DONE — the WHOLE Lesson Engine
> renders 3D, owner instruction 2026-08-27; §3.4 is next.

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

**3D in the Lesson Engine** — DONE 2026-08-27

- [x] A lesson plays with 3D characters at 375px and 1280px, light and dark,
      screenshotted. The intro cast, the narrator beside a prompt, a story
      speaker and a dialogue transcript were all walked through and looked at.
- [x] **Measured** frame cost, published as numbers (`TUTOR_3D.md` §6.2). Worst
      case — the whole cast — **106,224 triangles per frame, 12 draw calls, ONE
      WebGL context**, 48% of the documented 220,000 budget. A typical segment
      is 53,137 / 6. The 2D baseline is approximately zero.
      *Honest limit:* the fps figure (48 worst case vs 145 with the layer
      removed) comes from headless SwiftShader, a SOFTWARE rasteriser — CPU
      throttling 1x to 4x did not move it, so it is raster-bound there. It is a
      pessimistic bound, not a mid-range phone measurement, and saying otherwise
      would be the kind of number §1.0 calls blind flight.
- [x] The 2D path still works and is still reachable — proven by a test, not by
      the files existing. `CharacterActor3D.test.tsx` asserts that a slot with
      no 3D layer above it renders the 2D character, which is also the state on
      a cold chunk and on a device with no WebGL.
- [x] No regression: 1,278 tests across 101 files.

**The pose library**
- [ ] ≥ 50 named entries, each rendered for every character that supports it.
- [ ] A gate asserts every entry resolves for every supported character, and
      that a character without one falls back visibly rather than silently.
- [ ] `verify:rig` still passes: every clip keeps every character in its own
      stance and proportions (§5 of `/AGENTS.md`).
- [ ] Contact sheets for all four characters, reviewed by the owner.

**Gamification / VFX** — DONE 2026-08-27

- [x] **Reactions come from the POSE LIBRARY, not a second table.** `director.ts`
      carries its own inline list of emotion/action pairs, which is exactly the
      "second system" §6 decision 3 said not to build now that there are 100
      documented poses. Every director event names pose IDs; a gate asserts each
      one resolves.
- [x] **XP animates rather than appears.** The header chip and the results card
      count up to their new value instead of jumping. Reduced motion lands on
      the final number immediately — that is the modifier, never a second path.
- [x] **Combo feedback inside the lesson.** A run of correct answers is
      acknowledged when it happens, not only in the header total.
      *Constraint (DESIGN.md motion recipe 8 → `public/lottie/README.md`):*
      `streak.lottie` is the DAY streak and `gold-coin.lottie` is Gold. Neither
      may be used for an in-lesson combo or for XP.
- [x] **A VFX beat on the moments that earn one** — a perfect answer and a combo
      milestone. One-shot, token-timed, reduced-motion safe, and named in
      DESIGN.md motion recipe 7 rather than left as a loose tween.
- [x] Verified by LOOKING, at 375 and 1280, both themes, and by the 57-fixture
      audit still reporting zero regressions.

**Always**
- [ ] Every root gate green, three-locale i18n parity, docs updated in the same
      commit (§8).

## §6 Decisions — answered 2026-08-27

**1. Where does the 3D character render?** ONE persistent canvas, as
recommended. Built as `tutor-scene/CharacterStage.tsx`: `SceneCanvas` +
`SceneLighting` + `Character3D`, no diorama, no camera director, no time of day.
The framing is derived from each character's own `targetHeightM`, because a
fixed distance frames a 1.61 m human and crops a 1.9 m dinosaur.

*(§6.1 note, 2026-08-27: the framing described in decision 1 was rebuilt. It is
now derived from the model's MEASURED box rather than from `targetHeightM` —
see §8.)*

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

- `CharacterStage` — one character, no world. Verified by LOOKING at all four,
  headless, in the pose lab: each is fully framed with air above and below,
  correctly proportioned, on its own contact shadow.
- `FlatGroundProvider` — the stage has no island, so its floor is the origin
  plane. Kept in the PROVIDER rather than as a flag on `Character3D`, so the
  diorama's "no ground means a placement bug" reading survives untouched.
- `poseLibrary.ts` — **100 documented poses** across eight categories, the top
  of the range asked for. The 43 added on 2026-08-27 all sit on emotion/action
  pairs nothing used yet, or on a genuinely different rotation: the catalog grew
  by ADDING, never by relabelling. Gates assert every pose resolves for every
  character, that `loop` is only claimed where BOTH renderers honour it, and
  the two below.
- **A distinctness metric, because the count had to mean something.**
  `distinctPoseCount()` reports how many visually distinct renders the catalog
  can produce — 80, against 100 names — and the lab header shows both side by
  side. /AGENTS.md §1.14 was written after a coverage metric counted PRESENCE
  and read 100% while every lesson opened with the same picture. Two intents on
  one render is the catalog working (`greet.hello` and `transition.exit` are
  both a happy wave); a test caps it at three, so a later batch of aliases moves
  `POSES.length` and not the number anyone is looking at.
- **Contact sheets for all four characters**, 43 poses each, captured headless
  through the lab's own URL.
- `/dev/pose-lab` — every pose, on every character, played and looked at. Now
  DEEP-LINKABLE (`?character=&pose=`), so a review is a URL rather than a click
  path, and so the contact sheets photograph the surface a human opens rather
  than a second one built to be photographed.
- `framing.ts` + 9 tests — the framing arithmetic as a pure module, in the shape
  `composition.ts` established, tested against BOTH body plans.

### What looking at it actually found

Three defects, none of which any test was failing on:

1. **The framing was wrong for the quadruped, and the fix was not a constant.**
   Aiming at a fraction of declared HEIGHT pinned Dina and Liruf to the bottom
   edge. Framing now solves for the measured silhouette against the container's
   real aspect (`framing.ts`, `TUTOR_3D.md` §6.1). *Recorded here on the day it
   was found as "cosmetic in a dev surface"; it stopped being cosmetic the
   moment the same stage was headed for a lesson, which is why it was fixed
   before §3.1 rather than after.*
2. **A shadow-map pass that nothing received.** It drew every character a second
   time for no visible pixel: Zara 100,122 → 50,123 triangles per frame,
   5 → 3 draw calls once the unused lip-sync card went with it. On a surface
   headed for a lesson on a mid-range phone, that is the difference between one
   avatar costing a whole Tutor scene and costing a fifth of one (§1.0).
3. **A pale rectangle where Zara's mouth is.** The unlit lip-sync card
   (`TUTOR_3D.md` §3.1a) under the dark `auto` rig — a light the tint had never
   been photographed under. The card is now opt-in and off here, so she keeps
   her own painted mouth, and the tint debt is written down with a due date.

### The fourth defect, and the expensive one

**A remount inherited the previous gesture, and it compounded.** `useSceneModel`
shares ONE Object3D per character; `bindRig` captured `bone.quaternion` at bind
time as the rest orientation every procedural offset is relative to. On a
remount those bones are wherever the outgoing instance left them, so the drift
was baked in as the new rest and the next gesture composed on top of it.

Found by looking: stepping the lab through sixteen poses and returning to the
first did not return to the first POSE. Across the full 43-pose sheet Dina
degraded into a faceless ball. Nothing caught it because the FIRST mount is
always right, and the first mount is what every screenshot and every test
exercises.

Fixed in `rig.ts` by snapshotting the loaded rest pose once per model and
restoring before capture, pinned by `rig.test.ts` across forty rebinds. It
reaches the Tutor too: `TUTOR_3D.md` §5.2 records a Suspense boundary that made
inviting a character a remount, in production. The class is now written into
/AGENTS.md §1.14 beside its measurement sibling.

### The `celebrate` finding — investigated and CLOSED

Recorded earlier as "for the owner to decide". Investigating it first corrected
two things I had got wrong:

- **Dina was never affected.** Her bad `celebrate` was the remount bug above.
  Post-fix, on a single mount, she lifts her head 12.6 deg and reads as
  delighted. The finding applies to the clip-driven bipeds only.
- **The clip is not the culprit either.** The authored `celebrate` head track is
  only -14 deg, and `emotion.proud` -8. What loses the face is their SUM with
  the character's own rest stance: 59.7 deg of cumulative backward pitch,
  against 30.5 for the same clip under a neutral emotion, which reads perfectly.

So the fix is not in a clip and not in an emotion — it is the product rule
neither of them can know: **the learner must be able to see the face.**
`limitFaceLift` caps the cumulative lift of chest + neck + head after the pose is
composed, proportionally, on both the clip-driven and procedural paths.
`celebrate.lesson` 59.7 -> 32.5 deg; every pose already under the cap is left
byte-identical, verified by test and by re-measuring `marketing.banner` at an
unchanged 30.5. See `TUTOR_3D.md` §4.0b.

## §9 §3.1 — the whole Lesson Engine in 3D (2026-08-27)

Owner instruction, superseding an earlier plan of mine that would have kept the
story transcript and small list avatars on 2D: **all of it**, no half and half.
That forced the architecture §6 decision 1 actually called for and my first pass
under-delivered — `CharacterStage` is one canvas per character, and a transcript
grows one avatar per line.

`CharacterLayer` is the answer: one overlay canvas for the whole lesson, one DOM
placeholder per character, each drawn into its own screen rectangle through the
renderer's scissor, off-screen slots skipped. `TUTOR_3D.md` §6.2 carries the
architecture, the measurements and the three defects it surfaced (a shared model
that cannot hold two poses, a rig kind that lagged the model by one render, and a
contact shadow with no ground under it).

### What the swap costs, and it is not nothing

- **`speaking` has no expression in 3D.** The character is present and animated,
  but its mouth does not move while it talks — nothing drives visemes in a
  lesson and the lip-sync card is off. The story family is where this shows.
  Fixing it means correcting `mouthCardTint` for the dark `auto` rig FIRST
  (TUTOR_3D.md §6.1), then wiring a driver.
- **`bubble` falls back to the 2D actor whole.** No Lesson Engine surface passes
  one today.
- **Cast rows lost their overlap.** Slots are scissored to their own rectangles,
  so overlapping them would clip square. They stand side by side instead, at
  true relative heights on a common baseline — which the 2D row could not do.

### Verified 100% 3D, by walking it rather than by grepping it

The owner asked to be sure before moving on. Static: nine render sites in the
engine, all `CharacterActor3D`, and no 2D character component referenced from
`lesson-engine/` at all. Dynamic, which is the answer that counts — every one of
the **57 segment-type fixtures** opened and inspected, in dark AND light:

    fixtures audited        57
    CHARACTERS RENDERED 2D   0
    fixtures with no character on the first screen   0
    console errors           0

Plus a 220-step walk of the showcase: all four characters, every screen carrying
one, one canvas throughout, zero errors. The 2D component still renders when
there is NO 3D layer above the slot — a cold chunk, a device without WebGL, and
every jsdom test — which is the fallback working, not a leftover.

### Presence — the characters are the scenography now (owner, 2026-08-27)

"Demasiado pequeños... mayor protagonismo en la escenografía." Two things were
wrong and only one of them was size: our characters were framed head to toe in
every box, so a 96 px avatar gave the face 25 px while Duolingo's fills the same
box with a head. `presence` is now a named four-step scale (`inline` / `talk` /
`scene` / `cast`) defined at both breakpoints in `DESIGN.md`'s Lesson recipe,
small boxes get a BUST crop, the narrator strip is a stated two-column grid
instead of a flex guess, and the feedback banner shows its character on mobile —
it used to be `hidden sm:block`, so a lesson's most emotional beat had no
character at all on the viewport most learners use.

Sizing that bust took three wrong answers, all of them proportions assumed
rather than measured; `TUTOR_3D.md` §6.3 carries the table that settled it —
Rho's head is 46% of his height and Zara's is 19%.

## §10 §3.4 — gamification and VFX (2026-08-27)

Built on what already existed rather than beside it, which was the whole point
of §6 decision 3.

- **The director names poses.** Its inline table of emotion/action pairs is
  gone; every event names IDs from the 100-entry catalog, and a test asserts
  each resolves for every character. A wrong answer is now provably a
  `feedback` pose and provably never a celebration.
- **`core/combo.ts`** states when a run is worth naming (from two) and when it
  earns the extra beat (every third). Pure, six tests, including the one that
  matters: a wrong answer never carries a combo, because the streak has not been
  recomputed when its feedback renders.
- **`CountUp`/`useCountTo`** — one counter, two documented behaviours. The
  results screen's private copy of the same rAF loop is gone.
- **`.lf-burst`** — one ring, one shot, not drawn at all under reduced motion.

Measured on screen, in a real lesson: "2 in a row!", then "3 in a row!" with two
bursts live, the flame chip popping on each increment, the XP chip counting to
30, and the reacting character celebrating INSIDE the feedback banner.

Getting that last one on screen needed the z-stack rethought — header 30, layer
20, footer 10 — because one canvas cannot be both above and below the same
element, and at z-1 the banner painted over its own character.

## §11 `speaking` — closed, and not the way it was planned (2026-08-27)

The debt said: fix `mouthCardTint` for the dark rig, then wire a viseme driver.
Investigating it changed the answer, and the investigation is the useful part.

**The viseme card cannot carry this.** It is fitted for TWO of the four
characters — liruf and dina are dinosaurs whose mouths defeat a rectangular
decal — so it would animate half the cast and leave the other half inert. And
neither rig has a jaw bone: there is nothing to open. Wiring it into lessons
would also drag its unresolved lighting debt onto the one surface every learner
sees. I spent real effort on the root cause of that debt (why a lit material
renders the card black) and did not find it; it remains open and recorded.

**So `speaking` is ARTICULATION**: a syllabic head cadence with a slower yaw and
a trace of chest, on all four characters, composed on top of whatever emotion
and action are playing and capped by `limitFaceLift` so a talking character can
never talk its own face out of frame. Measured live: the speaker's head swings
10.4 deg of pitch against 3.9 deg with it off. Real lip-sync stays the Tutor's
viseme path, where the geometry for it exists.

**The defect the work surfaced.** The cadence appeared not to run at all, and
raising its amplitude fivefold changed nothing. Not a wiring bug: a probe showed
`speaking=true` reaching the character with `ambient=false tier=low`. The gate
was `ambientMotion`, which folds an ACCESSIBILITY instruction into a PERFORMANCE
tier — so it would have silenced "who is talking" on exactly the cheap phones
§1.0 is about. `QualitySettings.reducedMotion` now carries the instruction on
its own and the cadence stops only for that.

### Still open

- **The mouth card's lighting debt** (TUTOR_3D.md §6.1): under a dark `auto`
  rig its tint is under-corrected. It bites only when something drives visemes,
  which today is the Tutor alone. Root cause of the underlying "lit material
  renders the card black" is still unfound.
- **A real mid-range DEVICE frame measurement.** Everything so far is a software
  rasteriser bound — honest, but pessimistic, and not proof.
