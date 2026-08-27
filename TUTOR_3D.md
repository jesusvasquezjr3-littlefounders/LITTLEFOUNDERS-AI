# TUTOR_3D.md — The Tutor's 3D stage

> **Authority:** engine spec (/AGENTS.md §1.1 #6). Domain rules for the code
> live in `frontend/AGENTS.md` → *Tutor 3D scene*. Product design for the
> conversational layer is `/ORACLE.md` — **this document covers the STAGE
> only**, not the tutoring.
>
> **Status (2026-08-17):** stage BUILT, rendering, DEPLOYED and READY AS AN
> INTEGRATION TARGET — §7b is the contract RAG/TTS plug into. **zara and rho**
> have working mouths driven by real audio through `useLipSync`; liruf and dina
> do not (§7.1). All twelve actions AND all seven emotions are authored clips,
> composed additively over each character's bind pose (§4.0–§4.2). Assets are
> published to Depot and readable from the production origin (§3.2–§3.3).
> Placement now knows water from ground (§5) — before that, `diorama-b` stood
> its entire cast in the pond. Conversational layer BUILT 2026-08-21 and plugged in through §7b (/ORACLE.md).
>
> **Update 2026-08-21 — the stage is being promoted from a panel to the page.**
> The first `/tutor` experience rendered this scene inside a card on a
> dashboard and the owner rejected it: the Tutor is meant to be immersive, with
> the controls INSIDE the scene. Nothing in §1–§7b changes. What is new is
> **§9**, the in-scene composition contract: a shot vocabulary with one damper,
> a projection channel that positions DOM chrome over the render without
> touching React state, safe-area composition, and the picking rules that make
> the scene itself interactive. `/ORACLE.md` §9–§10 is the product side of the
> same rebuild; `DESIGN.md` → §Screen Recipes → **Tutor** is the authoritative
> layout recipe and outranks both.

---

## §1 What exists

A floating-island vignette: a round diorama with one or two canonical
characters standing on it, a slow camera orbit, and no environment beyond a
plain themed backdrop.

**Why this presentation and not a room the camera sits inside:** an island is
ONE draw call at 45–67k triangles, needs no environment map or occlusion work
to look finished, and its silhouette reads as well at 375 px as at 1280 px. A
room would have cost far more and read worse on a phone. The Tutor stage is 3D
for EVERY user (owner decision, 2026-08-15, ROADMAP.md) — never gated by role
or device class.

Live scene cost: **7 draw calls, ~51k triangles per frame** (island + two
characters + their contact shadows).

## §2 The assets

Source exports live OUTSIDE the repo (`/glb/`, gitignored — 156 MB). Only
optimized output is published. Everything below was MEASURED with
`npm run assets:inspect`, never assumed.

| Asset | Source | Optimized | Triangles | Notes |
|---|---|---|---|---|
| `diorama-a` | 43.67 MB | 1.35 MB | 954,100 → 44,996 | Stone circle: table, curved back wall, plants |
| `diorama-b` | 69.23 MB | 1.97 MB | 1,512,830 → 66,868 | Oasis: pond, palms, benches |
| `dina` | 12.17 MB | 0.65 MB | 170,910 → 49,997 | **Quadruped**, 27-joint rig, Unreal unit scale |
| `liruf` | 4.73 MB | 0.31 MB | 3,132 | Bipedal cartoon dinosaur |
| `rho` | 4.65 MB | 0.29 MB | 3,080 | Adult human, moustache + glasses |
| `zara` | 14.12 MB | 0.62 MB | 235,014 → 49,999 | Young woman |

`diorama-b` stops at 66,868 rather than its 45,000 target: the simplifier hit
its 1% error bound and stopped rather than wreck the silhouette. That is
correct behaviour, not a failure.

**Scales** (`frontend/src/tutor-scene/assets.ts`): rho 1.70 m, zara 1.61 m and
liruf 1.647 m are the exports' own measured heights and are authoritative.
**Dina is the outlier and the biggest character** — exported in Unreal units at
0.0283 m tall and 0.0417 m long (deeper than tall, which is what gave the
quadruped away) — normalised to **1.90 m, ~2.80 m long**. She was 0.70 m
("large-dog sized"), which was a guess nobody made deliberately; owner
correction 2026-08-16. Normalisation happens at RUNTIME via a scale on the wrapping
group, so the .glb stays byte-identical to what the artist approved.

## §3 The rigs — and the one hard limit

Three characters (rho, zara, liruf) share the same **24 biped bone NAMES**:

```
Hips · Spine · Spine01 · Spine02 · neck · Head · head_end · headfront
Left|Right: UpLeg · Leg · Foot · ToeBase · Shoulder · Arm · ForeArm · Hand
```

> ### ⚠️ They do NOT share a rest pose — and this document said they did
>
> Same names, same count, **23 of the 24 bones differ in rest orientation**.
> Measured against Zara (`scripts/`-driven probe, degrees):
>
> | | LeftUpLeg | Hips | Spine02 | RightForeArm | foot separation |
> |---|---|---|---|---|---|
> | zara | — | — | — | — | 0.092 |
> | rho | 74° | 70° | 72° | 31° | 0.234 |
> | liruf | 39° | 27° | 11° | 73° | 0.447 |
>
> **Two consequences, and both bit.**
>
> An ABSOLUTE clip authored on one rig re-poses the others into that rig's
> skeleton. Rho's feet collapsed 60.6% and Liruf's 79.4% — both to exactly
> Zara's 0.09214 — because glTF stores a bone's rest offset in its
> `translation` channel, so a force-sampled clip ships the authoring
> character's PROPORTIONS as if they were motion. Fixed by
> `sanitizeClip` + `additiveClip` (§4.1); drift is now 0.0% on all three.
>
> A gesture's AMPLITUDE is still calibrated to the rig it was authored on, and
> additive composition does not fix that. It is a separate, open problem —
> §4.2.

Dina is a **quadruped on her own 27-joint rig**: Hips, chest, head, ear ends, a
5-segment tail chain, and front/back leg chains.

> ### ⛔ THE BLOCKER: there is no facial rig
>
> **Not one jaw, mouth, brow or eye bone exists on any of the four exports.**
> All 24 (and 27) joints are body only. Verified by enumerating
> `skin.listJoints()` on every file.
>
> This makes lip-sync **impossible** in code today. It is not a tuning problem
> or a missing feature — the geometry to move does not exist. See §7.
>
> Worse than absent: the mouths are **painted into the texture**. Zara's open
> smile, Liruf's toothy grin and Dina's curve are all albedo, and rho has no
> mouth at all under his moustache. So the answer was never to move geometry.
> §7.1 has what shipped.

### §3.1 CLOSED: liruf and dina keep their painted mouths

Exhausted rather than abandoned. Every approach was tried and measured:

| attempt | liruf | dina |
|---|---|---|
| planar projection | muzzle sides compressed to nothing | — |
| cylindrical | fixed-height band does not follow the mouth | — |
| ribbon (traced curve) | painted grin leaks past both ends | patch folded, invisible under the body |
| ribbon, re-measured | widened 4 cm a side — grin runs −0.191 to 0.237 against a card reaching −0.149 to 0.209. Red fragments still show on `closed` | curve raised 0.0008; depth spread fell from 0.01899 to 0.00594 |
| gap sweep | — | 0.00014 → 0.0015: card still fragments |
| grid density | 21×13 helps slightly, **31×19 is WORSE** (bulge 0.0347 → 0.1019) — more samples land on teeth and mouth interior | 11×7 → 31×19 improves 0.00083 → 0.00066, still 4.7× the gap |

The card ends up **split into disconnected pieces with the face poking through
between them**, because the snout curves more across the patch than a bilinear
surface can hug at any density that does not start sampling the mouth interior.

**The only remaining fix is texture surgery** — painting the mouth out of the
albedo so the card ADDS one, which is exactly why Rho's worked first time (he
has no painted mouth under his moustache). That was investigated and rejected:
a UV sweep over the mouth region returns points spanning `u` 0.024–0.994 and
`v` 0.028–0.983 on Liruf. **These models' UV layouts are fragmented into islands
scattered across the whole atlas**, so a masked repaint would be painting large
disjoint areas of face, on a shaded curved surface, with a colour that varies
across it. High risk of visibly damaging two characters that currently look
good, for two COMPANIONS who do not carry the speech.

rho and zara — the two human characters — lip-sync. That is the decision.

### §3.1a The mouth card is UNLIT, so it has to be TOLD what colour the light is (2026-08-23)

`MouthCard` uses `MeshBasicMaterial`, and its own comment has always said why:
every lit material renders that particular map **solid black** over the mouth —
`MeshStandardMaterial` and `MeshLambertMaterial` alike — while the same material
with a flat `color` and no map lights up perfectly. The lights reach it, the
normals point outward, it is out of shadow mapping, it is front-side only. The
failure is isolated to "lit shader + this map" and **the root cause is still not
found**.

The comment also named the consequence — "what it will not do is darken with the
face as the scene's lighting changes" — and the consequence turned out to be
much worse than that sentence sounds. Photographed at Dusk at 1280x800: **Zara's
mouth was a cream-white rectangle across an orange-lit face.** It read as tape
over her mouth, on one of the two characters the camera closes in on precisely
BECAUSE they articulate (§2.2). Measured against the skin two head-widths away,
the card was **+62/+104/+111 of 255 brighter at Dusk and +133/+138/+130 at
Night**, against a Day baseline mismatch of +7/+16/+24.

**An unlit material still multiplies its map by `color`.** So the light is now
applied by hand: `backdrops.ts` → `mouthCardTint(lighting)` returns an
approximate irradiance for a forward-facing patch of skin — half sky, half sun —
expressed as a ratio against the DEFAULT palette (`AUTO_LIGHT`) and encoded
through the exact sRGB transfer function.

Three properties make it safe to have landed on a finished product, and each is
asserted in `mouthTint.test.ts`:

- **The default is byte-identical.** `auto` in light mode is the reference, so
  it returns exactly `#ffffff`; `day` clamps to `#ffffff` too. Nobody who has
  not chosen a darker hour sees any change at all.
- **It carries the HUE of the hour, not only its brightness.** A tint that only
  dimmed would swap a white sticker for a grey one. Dusk comes back warm
  (`#e1b9a8`), Night cold (`#79859b`).
- **The sRGB encode is load-bearing, not pedantry.** `material.color` is read as
  sRGB and converted to linear before the shader multiplies, so writing a linear
  ratio straight in applies it twice. The first version did exactly that: it
  fixed Dusk and turned Night's mouth into a BLACK rectangle — the same defect
  wearing the other colour. Caught by screenshot, not by the test.

**Measured result: worst-case mismatch fell from ~135 to ~50 of 255.** It is not
zero, and it will not be while an unlit patch has to track a lit, tone-mapped
surface: the pipeline stacks ACES tone mapping on a `CLAY_EMISSIVE_FLOOR`
(`characterMaterial.ts`) on normalised export materials, and no closed-form
multiplier follows all three. Fitting an exponent by eye across two screenshots
was considered and rejected — that is the confident-wrong-number failure
/AGENTS.md §1.14 is about. **The real fix is still the one this section opens
with: find out why a lit material renders that map black.** Then the card takes
the light like everything else and no multiplier exists to be wrong.

`backdrop` reaches the card by prop from `TutorScene` → `Cast` → `Character3D` →
`MouthCard`, and the card reads the THEME from `useTheme` exactly as
`SceneLighting` does — one answer to "is it dark", not two that can disagree.

### §3.1b KNOWN LIMITATION: a name plate hangs above a BOUNDING BOX, which is not a head on a quadruped

During the personalization audition every candidate carries a name plate,
anchored in `TutorScene` at `focus.y + focus.height * 0.25` — which, since
`focus.y` is the mid-head point at `spot.y + height * 0.75`, is exactly the top
of that character's bounding box, in metres. Correct by construction for the
three characters who stand upright.

Dina is a quadruped 1.90 m tall and 2.80 m long, and her standing spot is the
centre of her FOOTPRINT — under her hips, not under her head. So her plate rides
1.90 m above her hips, and at the desktop audition camera that projects up and
back, next to Liruf's snout. Photographed at 1280x800 it reads as though the
green dinosaur is called Dina. **At 375 px — where most of these learners are —
the camera is further back and the same plate reads correctly.**

**Why it is not fixed here, with the measurement that decided it.** The obvious
fix is to anchor the plate to the head bone. The four exports came from
different pipelines and their skeletons do not agree on what a head is. Measured
out of the source `.glb` bind poses (inverse bind matrices, so joints and mesh
are in one space), as a fraction of each character's own height:

| character | `head` joint | `head_end` joint | highest joint of any name |
|---|---|---|---|
| rho | **0.535** (his waist) | 1.002 | `head_end` |
| zara | 0.808 | 1.001 | `head_end` |
| liruf | 0.590 | 0.659 | `head_end`, at 0.659 — his MESH reaches 1.000 |
| dina | 0.616 | 0.464 | `earend` / `R_earend`, at **1.010** |

There is no rule over that table. Each model is also a single unnamed primitive,
so there is no head sub-mesh to measure instead. A per-character head anchor is
therefore new MEASURED data that has to come from re-rigging or from a geometric
head-finder, and either is an asset-pipeline change with its own verification
pass. Moving the plate by a constant chosen to look right at one camera is the
failure `TutorScene` already documents for CSS-pixel nudges: right at one shot,
wrong at the next.

Recorded in /ORACLE.md §16.2 in plain language, because a customer may see it.

### §3.2 Depot is CONTENT-ADDRESSED — the base URL alone is not enough

This was documented for weeks as "blocked only on credentials". That was wrong,
and it would have failed on deploy day.

Depot's download route is `/files/:bucket/:hash.:ext`, and its README is
explicit that the extension mapping is *"independent of the uploader's original
filename"*. There is no route that serves `rho.glb` under that name. Setting
`VITE_SCENE_ASSET_BASE` on its own **404s every asset**.

So publishing is two steps, and the second is code:

1. `npm run publish:scenes` uploads each file and records the name Depot serves
   it under in `src/tutor-scene/sceneManifest.generated.json`. **Commit it** —
   it is build input and holds no secrets. The manifest stores hashed filenames
   only, never the host: the host is per-environment and lives in the env var,
   so a manifest published from staging still resolves in production.
2. Set `VITE_SCENE_ASSET_BASE` to `<depot>/files/tutor-scenes`.

Every URL now goes through `sceneAssetUrl()` in `assets.ts` — the character
`.glb`s, the mouth atlases and the clip library, which previously each built
their own by concatenation. With the env var unset it serves by filename from
Vite; with it set it resolves through the manifest and **throws** on a missing
entry, which `TutorPage`'s error boundary turns into the load-failed panel plus
a named asset in the console. A silent 404 would have been a character quietly
absent from the island.

Depot dedups by hash, so re-publishing is idempotent and cheap.

### §3.3 The deploy has an ORDER, and Depot goes first

Attempted 2026-08-17 against the live Depot at
`https://media-b2c.littlefounders.ai`. Result:

```
publish-scenes: clips-biped.glb: Depot responded 400
  — Unsupported mime type: model/gltf-binary
```

**The `.glb` mime support is on this branch and has never been deployed.** It
was added in `88d95a6` (`filebase/src/lib/storage.ts`), `main` does not have it,
and `main` is what is running. This document previously said the bucket was
"already supported and tested" — true of the CODE, false of the DEPLOYMENT, and
that distinction is the whole blocker.

Everything else on the path is PROVEN, deliberately, by publishing the two mouth
atlases on their own with `--only=.png`:

| step | evidence |
|---|---|
| credential | reached a 400, not a 401 |
| bucket + `visibility: public` | both PNGs stored |
| content-addressed download | `GET .../files/tutor-scenes/<sha256>.png` → 200, `image/png`, exact byte count |

So the order is:

1. **Merge this branch and deploy Depot**, so it accepts `model/gltf-binary`.
2. `npm run publish:scenes` — Depot dedups by hash, so the two atlases already
   up come back `deduplicated` and cost nothing.
3. Commit `sceneManifest.generated.json`.
4. Set `VITE_SCENE_ASSET_BASE=https://media-b2c.littlefounders.ai/files/tutor-scenes`
   on the Vercel project, then **re-run `frontend CD`** — see below.

> ### ⚠️ "Redeploy" in the Vercel UI does NOT rebuild this project
>
> The Vercel project is **not connected to a Git repository**. `frontend-cd.yml`
> does the work: `vercel pull --environment=production` (which is what fetches
> the env vars), `vercel build` **on the CI runner**, then
> `vercel deploy --prebuilt`.
>
> So a "Redeploy" from the dashboard re-serves the SAME prebuilt output — it
> completes in about 3 seconds, which is the tell — and a Vite build inlines
> `import.meta.env.*` at build time, so the bundle cannot pick up a new
> variable that way. Changing an env var takes effect only on the next
> `frontend CD` run.
>
> Cost of not knowing this: three redeploys that could never have changed a
> byte, plus a bundle that was verified as "missing the variable" and blamed on
> timing.
>
> To verify a deployment actually has it, fetch the scene chunk and look:
>
> ```
> curl -s https://littlefounders.ai/ | grep -o '/assets/index-[^"]*\.js'
> curl -s https://littlefounders.ai/assets/index-<hash>.js >   | grep -o 'useLipSync-[A-Za-z0-9_-]*\.js'
> curl -s https://littlefounders.ai/assets/useLipSync-<hash>.js >   | grep -c 'media-b2c.littlefounders.ai/files/tutor-scenes'
> ```

`--only=<substring>` exists for exactly this kind of partial run, and it
deliberately **does not write the manifest**: a partial manifest is the
dangerous state, where some assets resolve and others throw mid-scene.

## §4 Animation — procedural by necessity

Every export ships **exactly one clip**, and all of them are locomotion cycles
(`walking_man`, `running`, an Unreal take). Looping a walk cycle on a character
who is standing still and talking reads as a treadmill.

None of them is played. The base pose is each character's BIND pose (§4.0), and
the full canonical vocabulary is driven by the authored clip library (§4.1) with
a procedural fallback in `frontend/src/tutor-scene/characterActions.ts` for any
state the library has not authored:

- **12 actions** — `idle jump hop wave point celebrate nod shake think dance peek bow`
- **7 emotions** — `neutral happy excited thinking surprised encouraging proud`

These are the SAME closed vocabulary as the 2D rig
(`components/characters/control/types.ts`), so `emotion`/`action` fields already
authored throughout the lesson catalog drive the 3D cast unchanged.

Emotions map to **posture**, not expression — there is no face to move (§3),
beyond the mouth card zara and rho carry. That is a weaker channel than the 2D
characters have, and it is stated plainly rather than pretended otherwise.

### §4.0 The base pose is the BIND POSE

Nothing plays underneath the gesture layers. This used to evaluate each export's
own clip at t=0 and hold it, on the stated theory that it was "the character's
actual standing posture rather than its bind pose". **It is the opposite.**
Every export ships exactly one clip and all of them are locomotion cycles, so
frame 0 is a stride:

- **Zara** stood with her legs crossed mid-step.
- **Liruf**, whose clip is `running`, was frozen **airborne with his legs
  tucked**.

Every gesture in the product then composed over that. The bind pose is the
natural standing pose the models were authored in and matches the owner's
reference captures of all four characters exactly.

With no normal action playing, three.js falls back to each property's ORIGINAL
value — captured when the mixer first binds, which is the bind pose — and
applies the additive layers on top. The correct amount of code is none.

### §4.0a A REMOUNT used to inherit the previous gesture, and it compounded (2026-08-27)

§4.0 says the base pose is the bind pose. `bindRig` implemented that by
capturing `bone.quaternion` at bind time — correct on a freshly loaded model,
and wrong on every mount after the first, because `useSceneModel` shares ONE
Object3D per character and a remount comes back to a skeleton the outgoing
instance left mid-gesture. The captured "rest" was therefore the last frame of
the previous gesture, and the next gesture composed on top of it.

It compounds, and nothing caught it because the FIRST mount is always right —
which is the mount every screenshot, every test and every manual check
exercises. Found by stepping `/dev/pose-lab` through sixteen poses and returning
to the first: Dina came back with her head cocked and her body twisted, and
across the full 43-pose sheet she degraded into a faceless ball. Zara showed the
same drift, less legibly, because a biped has more ways to look merely odd.

`rig.ts` now snapshots every bone's quaternion the FIRST time a model is bound,
in a `WeakMap` keyed on the model root, and restores from that snapshot before
capturing. First mount byte-identical; every later mount identical to the first.
The snapshot covers ALL bones rather than the bound slots, because clips and
drivers reach bones the slot map does not name — fingers, tail segments, ears.
`rig.test.ts` pins it, including across forty rebinds: a fix that merely halved
a compounding error would pass a single-rebind assertion.

This matters beyond the lab. §5.2 records that a character's Suspense boundary
depending on their ROLE made inviting them an element-type change under an
unchanged key — that is a remount, in the Tutor, in production.

### §4.0b The learner must be able to see the FACE (2026-08-27)

A character's backward lean is composed from three sources that never see each
other: the character's own rest stance, the emotion layer, and the action. Each
is reasonable alone, and their SUM is what a viewer sees.

Measured on the live skeleton, chest + neck + head against the rest pose:

| pose | emotion + action | face lift | reads as |
|---|---|---|---|
| `ambient.idle` | neutral + idle | 0 | the baseline |
| `ambient.idle.happy` | happy + idle | 14.5 deg | fine |
| `marketing.proud` | proud + idle | 28.2 deg | fine |
| `marketing.banner` | neutral + celebrate | 30.5 deg | fine — joyful, face clear |
| `celebrate.lesson` | proud + celebrate | **59.7 deg** | chin at the camera, face gone |

`celebrate.lesson` and `celebrate.levelup` are the results screen, and they LOOP
— Zara and Rho held that pose for the entire screen. Dina never came close: her
quadruped driver lifts the head 12.6 deg and reads as looking up in delight.

`limitFaceLift` (`characterActions.ts`) caps the cumulative backward pitch of
chest + neck + head at `MAX_FACE_LIFT` = 0.58 rad (33.2 deg), applied AFTER the
frame's pose is fully composed, on both the clip-driven and the procedural path.
The correction is proportional, so the shape of the gesture survives, and it is
measured as a delta from each bone's rest orientation in `rig.base` — never from
a world transform (§5.1). `celebrate.lesson` went 59.7 -> 32.5 deg;
`marketing.banner` stayed at 30.5, unchanged to the digit.

**Why a cap rather than a re-authored clip.** Re-authoring `celebrate` fixes one
composition out of the 7 x 12 the vocabulary allows, and the next pairing that
loses the face is the same bug found the same way — by somebody happening to
look at it. The cap states the invariant once and holds for pairings added later
by content rather than by code. `characterActions.test.ts` pins that a pose
under the limit is left BYTE-identical, that the correction is proportional,
that a forward lean never buys budget for a backward one, and that 120
consecutive calls change nothing after the first.

### §4.1 The authored clip library — why every clip is ADDITIVE

`frontend/scripts/author-clips.py` produces `clips-biped.glb`: 20 clips (12
actions + 7 emotions + `emotion.rest`) authored on Zara's rig. Two rules make
one file safe on three skeletons that do not share a rest pose (§3):

1. **`sanitizeClip` — rotation only, and nothing else.**
   The export is force-sampled, so it carries translation, rotation AND scale
   for all 24 bones of all 20 clips: 1,440 tracks, of which 1,140 describe
   Zara's skeleton rather than any motion.

   **Not even the hips.** A clip can only express leaving the ground as a hips
   translation in the authoring rig's units — the same absolute-value-shared-
   between-skeletons mistake — and travel should scale with the jumper anyway.
   Measured, the baked value was also wrong by three orders of magnitude:
   Blender pose-bone location is not in armature units, so an authored 32 cm
   exported as 0.0816 units, or **0.8 mm**. In clip mode the jump did not leave
   the ground at all, because the procedural lift was disabled at the same time.
   `CLIP_LIFT` (`characterActions.ts`) now owns travel as a fraction of the
   character's height — 0.42 for `jump`, 0.16 for `hop` — read from the clip's
   OWN time so the flight matches the crouch and landing the clip does carry.
   **The clip carries the mechanics, the runtime carries the travel.**
2. **`additiveClip` — deltas against `emotion.rest`, never absolute values.**
   The mixer then applies `characterOwnPose × authoredDelta`, which is the same
   relative-offset rule the procedural driver has always followed. A track with
   no counterpart in the reference **throws**: `AnimationUtils.makeClipAdditive`
   silently leaves such a track ABSOLUTE, which is exactly the defect being
   prevented.

The character's own export clip plays underneath at full weight as the base
pose, on the **same** AnimationMixer. A second mixer captured its "original
value" from whatever the bones held at bind time — after a clamped one-shot,
the last frame of the previous gesture — so switching `bow` → `wave` layered
the wave on top of a held bow.

### §4.2 Gesture amplitude is per-character — the `<action>@<id>` overrides

Additive composition fixes *proportions*, not *amplitude*. A bone-local delta
of 150° means something different on a bone whose rest orientation is 73° away,
so a gesture authored on Zara arrives muted or misaimed on the others.
Measured at each gesture's peak frame, before any override existed:

| gesture | zara | rho | liruf |
|---|---|---|---|
| `think` | ✅ | ✅ | ✅ |
| `bow` | ✅ | ✅ | ✅ |
| `wave` | ✅ | ✅ acceptable | ✅ |
| `point` | ✅ | ⚠️ weak | ❌ **aimed at nothing** (−0.004 forward) |
| `celebrate` | ✅ overhead | ❌ hands ON his head | ❌ arms stayed down |

**The mechanism.** A clip named `<action>@<characterId>` replaces `<action>` for
that character only; `clipFor` falls back to the shared clip for everyone else,
so exactly the clips that need it get authored twice. `baseClipName` strips the
suffix wherever the ACTION's semantics are what matter — looping in particular,
or `celebrate@rho` would play once and freeze.

Three shipped, verified end to end from the exported `.glb` through additive
composition (`scratchpad/verify-overrides.mjs`), with each character's forward
direction **measured** from its own `headfront` bone rather than assumed:

| | shared | override |
|---|---|---|
| `point@liruf` forward reach | −0.004 | **+0.245** |
| `celebrate@rho` hand spread | 0.578 | **0.765** |
| `celebrate@liruf` hand height | 0.629 | **0.684** |

**Three findings worth keeping.**

- **Rho physically cannot raise his arms overhead.** Arm reach 15.99 from a
  shoulder at ~3.2 tops out at 19.2; his crown is at 25.94. His `celebrate` is
  *arms up and out with the torso carrying it* — a different pose, not a
  retarget of Zara's.
- **Liruf's rig has no mirror at all.** Reflecting his right hand across his own
  sagittal plane misses the left by 23.4 under *every* euler negation (Rho's
  best is 1.4). His two arms are stated independently in `author-clips.py`;
  deriving one from the other is what made his celebrate look one-armed.
- **An armature-space retarget is not the fix.** It was implemented and measured
  (identity check on the authoring rig: 2e-6, so the maths is right). It *helps*
  Liruf and *hurts* Rho — the rests differ in incompatible ways and no single
  linear rule serves both.

### §4.3 The seven emotions need NO per-character overrides — audited

The obvious follow-up to §4.2 is "if the actions needed per-character values, the
emotions must too". They do not, and the reason is worth keeping.

Head displacement at each emotion's peak looked damning — Rho moves roughly
twice as far as Zara on every one of them, and Liruf's `surprised` barely
registers. But displacement is confounded by head size: Rho's head is large and
sits far from the pivot, so the same tilt travels further. The measure that
matters is the ANGLE, which is what a viewer reads:

| head swing at peak | zara | rho | liruf |
|---|---|---|---|
| `happy` | 10° | 10° | 10° |
| `excited` | 15° | 15° | 15° |
| `surprised` | 13° | 13° | 13° |
| `proud` | 19° | 19° | 19° |
| `encouraging` | 6° | 6° | 6° |
| `thinking` | 10.7° | 11° | 9.8° |

Identical. Rendered on all three afterwards, each emotion reads as itself and
stays distinct from its neighbours.

**The principle, which is what makes this predictive rather than lucky:** small
deltas are robust to rest-pose differences, large ones are not. Rotations very
nearly commute at these magnitudes, so a 6–19° emotion arrives intact on a
skeleton whose rest orientation differs, while a 150° arm swing does not. That
is the dividing line between §4.1 (which was enough for emotions) and §4.2
(which was not enough for arms).

**Still open:** `point@rho` reaches 0.176 against Zara's 0.213. Five rounds of
candidates — straight-arm, up-and-out, and the constrained solver's own
optimum — all measured WORSE than the shipped pose once the camera was finally
put on his right side, where his own body stops occluding the arm. Three of
those rounds were judged from his left and were therefore judged on nothing.

The reason is anatomy again: shoulder-to-hand is barely wider than his head, so
no arm angle clears his silhouette enough to read as indicating something. The
shipped pose has the best forward reach of anything tried (9.86 against 1.38 to
5.64) and its weakness is that the hand crosses to his left of centre. Fixing
that costs forward reach — the two trade directly.

An automated search is the wrong tool here: it optimises the hand's position
against geometry it cannot see, and every run returned high-scoring poses with
the arm inside the torso.

### §4.4 `npm run verify:rig` — the gate that can actually catch this

Four of the defects in §3–§4.3 passed type-check, lint, the whole test suite and
review, because each looked correct on Zara and wrong only on the others. Unit
tests cannot see them: they are properties of the geometry inside the `.glb`
files, not of the code.

`frontend/scripts/verify-rig.mjs` plays every clip on every character by forward
kinematics and asserts:

| check | invariant |
|---|---|
| `proportions` | no clip changes how far a bone sits from its parent. Only a translation can, so this is EXACT — no tolerance |
| `stance` | every clip opens on the character's own foot separation |
| `vocabulary` | every clip name is canonical, or a `<name>@<id>` override of one |
| `overrides` | every override names a character that exists |
| `emotions` | the seven emotions tilt every head by the same ANGLE (spread ≤ 2°) |
| `travel` | reports translation tracks, which `sanitizeClip` strips |

It is a LOCAL gate: `/glb/` lives outside the repo, so it prints a loud SKIP
rather than passing quietly when the source exports are absent.

**Its first version cried wolf**, and that is worth knowing before trusting the
next one. It measured foot separation across every frame and flagged `jump` at
27% on Zara herself — a landing compression bends the knees and legitimately
brings the feet together. It was measuring the animation, not the defect.

### Rules that will bite whoever touches this next

1. **Rotate bones with `premultiply` (parent space), never `multiply` (local
   space).** On these rigs a bone's local +Y runs along its length (`LeftArm`'s
   child sits at `[0, 28.03, 0]`), so post-multiplying turns an arm swing into
   a twist around the limb — a real rotation that is completely invisible. This
   cost hours: type-check, lint, bound-slot logging and a quaternion diff all
   passed while nothing moved on screen.
2. **Accumulate, never assign.** Emotion posture is applied before the action;
   an assigning `turn()` erased it the moment an action touched the same bone.
   `resetRig()` once per frame is what makes accumulation safe.
3. **A missing bone must never throw mid-frame.** Unbound slots are simply not
   driven.
4. **Amplitudes are art direction, they are NOT art-directed yet, and they are
   per-character.** See §4.2 for what is measured and what is still open.
5. **Never share an absolute clip between these rigs.** Same bone names is not
   the same skeleton (§3), and the failure is silent on the rig it was authored
   on — Zara stood correctly through the entire defect while the other two were
   visibly deformed. If one character looks right and the others do not,
   suspect the rest pose before suspecting the animation.

## §5 Placement — solved, never authored

Hand-tuned coordinates do not survive the second diorama. They put a character
on top of the stone table on the first one.

- `ground.tsx` — surface height under any (x, z) by downward raycast. Returns
  `null`, never 0, when nothing is under that point: a character off the edge
  is a placement bug and must stay visible as one (§1.14).
- `standingSpots.ts` — samples candidate rings over the island, requires the
  ground to be flat (surface normal up) and open (neighbours at a similar
  height, so not the top of a rock), scores by flatness + facing + relative
  height, and selects greedily with a minimum separation.
- `facing.ts` — which way each of them is turned. Everybody faces the bearing
  the stage opens on (`shots.ts` → `STAGE_BEARING`), then leans up to 20° toward
  their nearest neighbour so a group reads as people sharing a place. It is a
  module, and `npm run verify:placement` gates it.

A new diorama therefore needs **no coordinates and no manifest tuning** beyond
its target diameter.

### Facing — outward from the centre is NOT toward the viewer

Corrected 2026-08-22, and the sentence it replaces was in this document, stated
as a principle, and wrong: *"characters face outward from the island centre
(`atan2(x, z)`) — facing inward shows their backs, and 'inward' and 'toward the
viewer' are opposites when the camera is outside the scene."*

The first half is true and the second half does not follow. The camera does not
surround the island; it stands at ONE bearing. Radially outward therefore points
at the viewer only along the single radius that passes through them, and points
into the sea everywhere else. The audition is where that bites hardest, because
the audition deliberately SPREADS the cast around the ring — spreading their
bodies is right, spreading their FACES is not.

Measured with `npm run verify:placement` before the fix, on `diorama-a`, with
the whole cast standing:

| | turned off the viewer |
|---|---|
| dina | 39° |
| liruf | **138° — back to the learner** |
| rho | **129° — back to the learner** |
| zara | **127° — back to the learner** |

Three of the four candidates, on the one screen whose entire job is choosing a
tutor by looking at them. And not only there: on `diorama-b` an ordinary
two-person session stood Dr. Rho at **101° off** for the whole conversation.
Every gate was green throughout, because no gate had ever been told that where
somebody stands and which way they are turned are two different facts.

The rule now: **face `STAGE_BEARING`, lean up to 20° toward the nearest
neighbour.** After it, the worst case anywhere on either island in any shipped
pairing is 20°. The lean is CLAMPED because a quarter of the arc to a neighbour
standing behind you is 45°, which is the difference between glancing at a friend
and presenting a shoulder to the learner.

`STAGE_BEARING` is a constant of the stage, derived from the placement solver's
own `preferDirection`, and **not** a live camera pose — so §9.1's trap is
untouched: the camera reads placement, placement never reads the camera.

### Walkability — shape is not meaning

The rules above score how a surface BEHAVES. Nothing in them can say what it
IS, and that gap had a cost: on `diorama-b` the whole cast stood in the pond.
Every pairing, both characters, for as long as the island had shipped. Water is
the flattest, most open surface a diorama has, so it beat every patch of grass
on the two terms that carry most of the score. The pond is not badly shaped —
it is beautifully shaped and wet.

There is no geometric signal to recover. Measured on the real assets: the
diorama is ONE mesh with ONE material, the water is not a separate node, the
mesh is quantized so the water is not even exactly planar, and there are no
vertex colours. The only place the meaning lives is the texture.

- `scripts/generate-walkmask.ts` (`npm run assets:walkmask`) rays down through a
  96-cell grid per island, reads the base-colour texel each ray lands on, and
  bakes a bitmask into `src/tutor-scene/walkMasks.generated.json` — committed,
  in metres, in the frame `Diorama.tsx` places the island in.
- `walkability.ts` resolves it at runtime to one array index per query.
- `findStandingSpots` takes it as `isWalkable` and applies it as a HARD gate, at
  the candidate and at all four flatness probes — a character whose centre
  clears the shoreline by a hair still has both feet in the lake.

**Why a colour rule, and why at build time.** "Cyan means water" is true of
these two dioramas and is not a fact about the world. Baking it means a wrong
classification is a visibly wrong mask in a diff — `--preview` writes a PNG with
blocked cells in magenta — reviewable before it can put a child's tutor
waist-deep in a lake, and correctable without touching placement code. It also
costs nothing per frame, which matters on the tier the whole quality system
exists to protect.

**A missing mask is not permission.** `walkabilityFor` returns `null` rather
than a permissive predicate, and `TutorScene` warns. An island nobody has
checked is exactly the state diorama-b was in (§1.14).

### Room and togetherness

Two preferences, neither a rule, both added with the mask:

- **Room** — the fraction of a character's own footprint radius that lands on
  ground they could also have stood on. Because the mask marks everything past
  the rim unwalkable, this scores edge clearance and pond clearance with one
  measurement. It moved Dina from 4 cm of rim clearance to 49 cm on diorama-a.
- **Togetherness** — after the lead is placed, later spots are pulled toward it.
  This only became visible once the mask opened up diorama-b: with the pond
  off-limits, the two best patches of grass sat on OPPOSITE SHORES and the
  solver dutifully chose both, 5.39 m apart against 1.82 m on diorama-a. The
  quarter-turn each character takes toward the other means nothing at six
  metres. Now 2.28 m.

Both are preferences because rejecting on them can return NO spot, and `Cast`
renders nothing without one. A cramped character beats an empty island.

### An audition separates in DEPTH, because depth is what a phone has spare

Added 2026-08-22. A third preference, and it applies only to the personalization
audition (`AUDITION_NARROW_WEIGHT`, `AUDITION_RINGS`, and the `narrowAxis` /
`narrowWeight` / `rings` options).

`approach` has to keep every candidate inside a horizontal field of view that is
**17 degrees** at 375x812, so the frame's world WIDTH is decided by whichever of
them sits furthest ACROSS it — and the island's share of the screen follows from
that one number and nothing else. Field of view cannot trade against it (a
narrower lens stands further back and the frame comes out the same size);
distance cannot trade against it either. A metre spent sideways is a metre the
camera stands back, and coverage falls as the SQUARE of that. **The same metre
spent in DEPTH satisfies the same separation floor and costs the framing
nothing.**

So the solver charges each candidate spot for its off-axis distance, squared, in
island radii. Squared rather than linear: a candidate a third of the way out is
barely charged and one at the rim is charged the lot — a linear penalty of any
useful size collapses the cast onto the centre line and turns an audition into a
queue receding from the camera. On `diorama-a` it moves the widest candidate
from **1.97 m off the aim to 1.56 m**, which is what took the island from 29.9%
of a phone to 49.1% (§9.1).

**The outer rings stay.** Cutting them was the obvious way to gather the cast
and it is the way that loses people: a set stopping at 0.54 of the radius seats
all four on `diorama-a` and only THREE on `diorama-b`, whose pond takes most of
the inner deck, and a candidate with no spot has no anchor, so their plate is
hidden and inert and they cannot be chosen at all. The gathering is a
PREFERENCE, which degrades into "stand wherever you can"; the rings only have to
be there when it needs them. `AUDITION_RINGS` samples five rings from 0.24 to
0.66, finer inward than the two-person default and stopping just short of it
outward.

The gathering does cost something and it is written down: on `diorama-b`, whose
walkable deck is a ring around a pond, the four end up in a narrow column near
the middle of a 1280 px frame rather than spread across it. `diorama-a` is the
default island and keeps a good lateral spread at both breakpoints. Placement
may not read the camera (§9.1's trap), so there is one arrangement for both
aspects and this is the side to be wrong on: a phone that reads as a place,
against a desktop that reads as a slightly tight group.

`npm run verify:placement` passes the audition options through, because a gate
that exercises a different configuration certifies a different product.

### `npm run verify:placement`

Runs the real solver against the real islands, headless, in seconds, and reports
what each character would be standing on — surface colour at the hit UV, height,
rim clearance, and whether the ground under them is a pedestal. It imports
`findStandingSpots` rather than reimplementing it; a copy would drift from the
thing it certifies.

**It reports FACING too** (added 2026-08-22, and the omission is the reason the
cast stood with its back to the learner for as long as it did). Each line now
carries how far that character is turned off the stage bearing, and a placement
past 45° FAILS the run. The gate had certified "on walkable ground, inside the
rim" and called that placement; being in the right place and being turned the
right way are two facts, and a gate that only knows the first keeps saying OK
through the second. See §5 → Facing for the numbers it would have caught.

It exists because this defect was found by a screenshot and nothing else could
have found it. Two of the three "defects" that first screenshot seemed to show
did not survive measurement:

- **Retracted — "the companion stands on a boulder".** Read from a
  low-resolution crop where the boulders sit BETWEEN Liruf and the camera. A
  tight re-render shows both feet flat on the sand, and the harness reports no
  pedestal at that spot. There was no defect.
- **Corrected — "Dina overhangs the rim by 44 cm".** That assumed she would be
  placed on the outer sampling ring. She is not: measured, she stood 2.01 m out
  with 4 cm to spare. Real but latent, and the room term now gives her 49 cm.

Looking is how the pond was caught; measuring is how the other two were
disproved. Neither substitutes for the other.

**The separation floor is PER PAIR, not per cast** (added 2026-08-21, found by
extending the harness rather than by looking). Dina covers 2.83 m and Liruf
1.70 m, so those two genuinely need 2.61 m between them — and applying that same
figure to Rho and Zara, who cover 0.82 m each, reserves three times the ground
they occupy. On `diorama-a` that seated two of the four audition candidates and
reported NO SPOT FOUND for the other two. `pairSeparationM` states the rule and
`findStandingSpots` takes it as `separationFor`, so the k-th spot is chosen
under the k-th member's own constraints.

**Sampling density is a cast-size decision too.** The default ring is what two
characters need and no more, because every sample costs five raycasts against a
45k-triangle island. Measured on `diorama-a`, the usable band is two rings wide
and the surviving samples sit 40 degrees apart, while the gap left for the
fourth candidate is 27 degrees: the spot existed and nothing was ever sampled in
it. An audition samples at `AUDITION_SAMPLES_PER_METRE` and solves with a
NEGATIVE grouping weight, because four candidates are a ring you look along
rather than a huddle — and the huddle is what leaves the last one nowhere to
stand. `npm run verify:placement` runs the audition against both real islands
alongside every shipped pairing.

**AND IT RUNS THE AUDITION *PLUS* A COMPANION** (added 2026-08-22, and the
omission is the shape of the ship-blocker in §5.1). The gate certified the
audition, and it certified lead+companion pairs, and it never certified a
character who is BOTH — which is the only configuration that broke. It now
sweeps every character in every role on both islands: 16 cases per island,
built by the product's own `standingCast` (`tutor-scene/cast.ts`, imported for
the same reason the solver is), each solved in full and compared seat-for-seat
against the plain audition. The property being asserted is that **who you pick
does not move anybody** — if the cast ever starts depending on the pairing, the
solve runs on that cast and the seats stop matching.

Measured, and these are the tightest numbers the new case finds:

| | tightest rim clearance | tightest contact-shadow margin |
|---|---|---|
| `diorama-a` | **0.49 m** (dina) | **0.28 m** (dina) |
| `diorama-b` | **0.29 m** (dina) | **0.08 m** (dina) |

Identical to the plain audition's own, in all 32 cases — which is the answer the
sweep exists to produce rather than to assume.

**And it checks FOOTING, which is a third fact the gate did not know.** Every
spot in the broken build was walkable, inside the rim and correctly turned; what
was wrong was where the character's feet and contact shadow ended up once
mounted. So each character is now measured twice through the product's own
`modelFooting` — once free, once from inside the scaled group `Character3D`
mounts them in — and the two readings must be identical. On the pre-fix code
Dina's half-footprint reads 1.414 m free and 95.937 m mounted, and the run
fails. The contact-shadow margin above is the second half of it: `ContactShadow`
is a flat plane of `footprint x 1.15` radius laid on the surface, so from
wherever a character stands it has to fit inside the rim, and Dina on
`diorama-b` has 8 cm to spare.

The footing section uses `CHARACTER_MEASUREMENTS` rather than the shipped .glb,
and that is forced rather than chosen: the shipped characters are
meshopt-quantized AND skinned, so their POSITION accessors hold integers whose
metres only exist after dequantization and posing — `npm run assets:inspect`
says so itself about these files ("world size n/a — mesh is quantized"), and the
source exports are not in the repository. The table is where those measurements
were written down and it is the same table the solver separates the cast by.
Cross-checked against the live renderer: Dina's contact shadow measures 3.25 m
across in the browser, and the table predicts 3.251 m. That the measurement is
parent-independent for a real, skinned, nested model is certified separately and
exactly by `src/tutor-scene/modelBounds.test.ts`.

### §5.1 A measurement of a SHARED model must not depend on where it hangs

Added 2026-08-22, from the worst defect this stage has shipped.

`useSceneModel` hands out the loader's cached `gltf.scene` **by reference** —
deliberately, since cloning would double VRAM for a scene that mounts each
character once. One `Object3D` therefore IS the model, and it is attached to
whichever group is currently rendering it.

`Box3.setFromObject` is a WORLD-space measurement. Called on that shared object
it answers "how much room does this occupy on stage", not "how big is this
export", and the two coincide only while the object has no parent. `Character3D`
called it to derive `footOffset` and `footprint`. On a first mount the object is
unparented and the numbers are the export's own; on a REMOUNT the object is
still inside the outgoing instance's group during the incoming instance's render
pass, so the box comes back already scaled into scene metres and is multiplied
by `characterScale` a second time.

Three of the four characters export at scale 1.0, so the defect only sank them
by the island's surface height and was invisible for five days. Dina exports in
Unreal units at scale 67.86. Measured on `diorama-a` at the moment she was
invited to stay:

| | before | after |
|---|---|---|
| Dina's contact shadow | 3.25 m across | **221.53 m** |
| Dina's feet | y = 0.14 | **y = −12.24** |
| Liruf's feet | y = 0.17 | y = 0.00 (sunk 17 cm) |
| composed scene box | 6.49 x 2.10 x 6.14 | **235 x 14 x 235** |
| canvas coverage | 55.6% | **100%** |

The 221 m black plane is what "the sky turned grey" was, and the 235 m scene box
is why changing the island from that state collapsed the camera to a 70 px
speck — `CameraDirector` refits on `fitKey` and the content it fits had grown by
a factor of thirty-six.

The rule, and it is not confined to characters: **ask a shared model how big it
is in ITS OWN space.** `modelBounds` / `modelFooting` (`tutor-scene/modelBounds.ts`)
compose local matrices down from the model root and read nothing above it, so
they are parent-independent by construction rather than by being called at the
right moment. `Character3D` and `Diorama` both use them. `setFromObject` remains
correct — and is still used — for the composed scene, the ground and the camera
fit, where the world IS the question.

Two details that cost a run each: the object-level box wins over the geometry
box wherever a class defines one, exactly as `Box3.expandByObject` makes it win,
because every character is a `SkinnedMesh` whose geometry box is bind-space and
means nothing (reading it collapsed Dina's shadow to 1.06 m and the bipeds' to a
centimetre); and the object-level box is computed once and cached by three, on
the first measurement, which happens while the model is unparented.

### §5.2 A character's Suspense boundary must not depend on their ROLE

The other half of the same defect, and the reason a remount happened at all.

`Cast` used to wrap principals in a `<Fragment key={id}>` and audition extras in
a `<Suspense key={id}>`. Inviting a candidate to stay moves them across that
branch, which changes the ELEMENT TYPE under an unchanged key, which React
implements as unmount-and-remount. The outgoing companion crosses it in the
other direction at the same instant, which is why Liruf sank in the same frame.

Every character now gets their own `<Suspense key={id}>`, always. What the
principals' shared boundary bought — `onReady`, and therefore the tutor's first
spoken line, waiting for the people the session is about — is bought explicitly
instead by `PrincipalModels`, which suspends on exactly those assets, renders
nothing, and is mounted only until the stage lights up. After that it can only
do harm: a companion invited later would suspend the shared boundary and blank
the whole cast while their .glb loaded, which is the failure the per-character
boundaries exist to prevent.

A role change now costs nothing at all: no remount, no new `AnimationMixer` on a
shared skeleton, no rig re-bind, no ground re-sample, no one-frame gap.

## §6 Performance contract

The stage ships to every user on every device, so quality is MEASURED, not
assumed.

- `quality.ts` — a cheap static probe picks a STARTING tier. A browser that
  withholds `deviceMemory` (all of Safari and Firefox) must not be read as a
  weak device.
- `governor.ts` — a **pure reducer** steps the tier from real frame times:
  2 bad windows to demote, 5 good ones to promote, a dead band between them,
  and a latch after 2 demotions. Never move this back into a `setState`
  updater — StrictMode double-invokes those and it latched after one demotion.
- Rendering **stops entirely** when the canvas is offscreen or the tab is
  backgrounded. This is the largest device-load lever in the system.
- Lost WebGL contexts are recovered rather than left black.
- `budget.ts` holds the asset budget as code; `/dev/scene-lab` and
  `npm run assets:3d` both measure real files against it.
- **Frame cost and asset cost are SEPARATE ceilings**, and conflating them
  produced a permanent false alarm. `gl.info.render.triangles` counts every
  triangle submitted, and `high` is the only tier with shadows — so it renders
  the scene twice and the count doubles exactly: rho + liruf on diorama-a
  measured **102,424** against assets containing **51,208**. Compared to the
  100,000 ASSET ceiling that painted "Over budget" in red for a scene
  comfortably inside its documented cost, which is worse than no readout — it
  teaches whoever is doing performance work to ignore their only alarm.
  `maxTrianglesPerFrame` (220,000) now measures live scenes and `maxTriangles`
  still measures a single .glb.
- **`three` must only ever be reached through a lazy route.** Verify after each
  build: `WebGLRenderer` appears in the `TutorScene-*` chunk (≈287 kB gzip) and
  NOT in `index-*`.

### §6.1 `CharacterStage` — one character, no world (2026-08-27)

The character-only surface the Lesson Engine and the pose lab both compose
from: `SceneCanvas` + `SceneLighting` + `Character3D`, no diorama, no camera
director, no time of day. Three decisions in it are load-bearing.

**Framing is MEASURED, never declared.** `framing.ts` solves for the distance at
which the character occupies its share of the frame, twice — once against the
frame's height and once against its width — and takes the larger, because the
nearer solution is always the one that crops. The inputs come from
`modelBounds` (§5.1), so they are parent-independent. Framing to a character's
declared `targetHeightM` looked right on all three bipeds and put the quadruped's
feet hard against the bottom edge: Dina is 1.9 m by the number that makes Rho
1.7 m, but her mass is low and long, so a fraction of her height aims above most
of her. The aim point is the measured vertical centre and the fill is the
measured silhouette.

**No shadow map on this surface.** A shadow map is a second full draw of every
caster (§6). The island earns it — the ground receives it, and moving the sun is
most of what separates dawn from dusk. Here nothing receives it:
`FlatGroundProvider` is a sampler, not geometry, and the shadow under a
character is `ContactShadow`, a painted plane that never reads the map. Measured
in the pose lab, per frame, with the pass and without: Zara 100,122 → 50,123,
Dina 99,998 → 50,001, Rho 6,284 → 3,204, Liruf 6,268 → 3,136. The override is
applied to the settings handed DOWN, so the canvas governor is untouched and the
diorama keeps its shadows.

**The lip-sync card is OPT-IN here** (`Character3D` gained `mouth`, defaulting to
`true`, so the Tutor is unchanged). The card is worth its draw call exactly when
something drives `viseme`; a surface that never speaks was getting a static
closed mouth pasted over Zara's own painted one, and because the card is unlit
while the face around it is not, that paste read as a pale rectangle — the §3.1a
defect under a light nobody had photographed, the dark `auto` rig being dimmer
than any of the island's hours. **The debt this creates has a due date:** wiring
a viseme driver into a lesson brings the card back, so `mouthCardTint` has to be
corrected for `AUTO_DARK` BEFORE that, not after.

### §6.2 `CharacterLayer` — one canvas, many characters (2026-08-27)

The Lesson Engine draws characters everywhere, including one per line of a
dialogue transcript that GROWS as the learner reveals it. One canvas per
character would be ten WebGL contexts on a single screen.

So there is exactly one: a fixed, transparent overlay across the viewport.
Each character renders an empty DOM placeholder that registers with the
provider, and the frame loop draws each into that placeholder's screen
rectangle, with its own camera, through `setViewport`/`setScissor`. Ten avatars
cost ten DRAWS, not ten CONTEXTS. Priority-1 `useFrame` takes rendering from
R3F; every character is hidden and made visible only for its own pass, so lights
and the ground provider are shared and no character can appear in another's
rectangle. Rectangles are read from the DOM EVERY FRAME, so scrolling and
reflow are followed without a React pass, and a slot whose rectangle is off
screen is skipped entirely.

**THE OVERLAY MUST BE INERT, and a class on the wrapper is not enough.** R3F
writes `pointer-events: auto` INLINE on its own container, which beats a
`pointer-events: none` inherited from above — so this canvas became the topmost
element over every control in the Lesson Engine and the product stopped
responding to a real pointer. `SceneCanvas` now takes `interactive`, defaulting
to true so the Tutor (which IS driven by tapping the stage) is untouched, and
the layer passes `false`: the flag adds the class AND an inline style, because
only an inline value wins against an inline value. /AGENTS.md §1.14 carries the
verification lesson, which is the more expensive half — every audit had driven
the app with `element.click()`, which does no hit-testing.

**MEASURED**, at 390x844 with dpr 2, worst case (the whole cast on the intro
screen): **106,224 triangles per frame, 12 draw calls, 1 WebGL context** — 48%
of the documented `maxTrianglesPerFrame` (220,000). A typical segment with two
characters is 53,137 / 6; a single character 50,003 / 3. The 2D baseline is
approximately zero GPU cost. Under headless SwiftShader the worst case holds
48 fps against 145 with the layer removed; **that is a software-rasteriser
bound, not a phone measurement** — CPU throttling from 1x to 4x did not move it,
which says the cost there is raster, not CPU. A real mid-range device number
still needs a real device.

Three things the layer needed that the diorama never did:

- **`instanced` on `Character3D`.** `useSceneModel` hands out one Object3D per
  character, which is right where each appears once. A transcript shows the same
  speaker on lines 1 and 3, and one object cannot hold two poses. The clone
  shares geometry and materials and duplicates the skeleton — 24 bone matrices.
- **The rig kind DERIVED, not stored.** It was React state set from `bindRig` in
  an effect, which lags the model by one render. Invisible in the Tutor, where a
  character's element never changes identity; a defect in a lesson, where ONE
  narrator slot shows dina on this segment and liruf on the next. For that render
  the component held "biped" while already holding Dina's 27-joint skeleton, so
  the shared biped library was played on her: 23 `PropertyBinding: No target node
  found for track: LeftUpLeg.quaternion` warnings and a gesture dropped on the
  floor. `rigKindOf` is now pure and read during render.
- **`shadow` opt-out on `Character3D`.** A contact shadow grounds a figure ON
  something; a lesson page is not a floor. The shadow plane is sized from the
  footprint and is LARGER than a tightly cropped avatar's frame, so what reached
  the screen was not a blob under the feet but the middle band of its gradient,
  clipped square by the slot: invisible on a dark page and a hard-edged grey
  rectangle on a light one. §1.14's class again, found by looking at the light
  theme.

`stageHeightM` on a slot frames a FIXED world height with the feet on the bottom
edge instead of framing the character's own box. Slots that share it and share a
pixel height share a scale, which is what keeps 1.61 m Zara visibly shorter than
1.9 m Dina in a cast row; `fill` alone normalises everyone to the same size,
which is right for a lone avatar and throws the cast portrait away.

### §6.3 A bust crop has to be sized by the HEAD, and the head measured (2026-08-27)

Presence in a small box is mostly framing: a 96 px full-body avatar gives the
face twenty-five pixels. So slots take `crop: 'bust'`. Getting it right took
three wrong answers, and each was a proportion assumed rather than measured.

1. **A fraction of total HEIGHT, anchored at the crown.** Fine on Zara. On Dina
   it framed the top 46% of a quadruped whose face is at the FRONT of her box,
   and the slot rendered as the smooth orange dome of her skull.
2. **Aiming at the head BONE** — right idea, still too close: the camera solved
   for a region and said nothing about ending up INSIDE the model. Dina is
   1.92 m tall and 2.83 m DEEP, so the camera landed past her shoulder and
   inside her muzzle: a flat orange square. The distance is now also at least
   half the depth plus clearance.
3. **A fixed multiple of height for the frame SIZE.** This cast does not share a
   proportion. Measured, in scene metres, the gap between the `head` bone and
   the top of the box — which IS the head:

   | | height | width | depth | head bone | head size |
   |---|---|---|---|---|---|
   | zara | 1.61 | 0.83 | 0.45 | 1.30 | 0.31 |
   | rho | 1.70 | 0.82 | 0.81 | 0.91 | **0.79** |
   | liruf | 1.65 | 0.71 | 1.70 | 0.97 | 0.68 |
   | dina | 1.92 | 0.95 | 2.83 | 1.18 | 0.74 |

   Rho's head is 46% of his height and Zara's is 19%. A bust is therefore
   `1.9 x the measured head`, aimed a third of a head above the bone, and
   "head and shoulders" resolves to the same PICTURE on four different body
   plans. `boneOrigin` in `modelBounds.ts` reads the bone the same
   parent-independent way the box is read (§5.1).

### §6.4 `speaking` is ARTICULATION, not lip-sync (2026-08-27)

The 2D control surface has had `speaking` since v1: each character's SVG runs a
mouth-flap while a line is read. Moving the Lesson Engine to 3D dropped it, and
a character standing perfectly still while its own words appear reads as a
picture rather than as a character.

**Why not the viseme card.** Two reasons, and either alone is enough. Neither
rig has a JAW bone — verified in both exports: zara carries `Head`, `head_end`,
`headfront`; dina carries `head`, `headend`. And the card is fitted for only
TWO of the four characters: liruf and dina are dinosaurs whose mouths defeat a
rectangular decal (§7.1). Wiring it into lessons would animate half the cast,
leave the other half inert, and carry the card's unresolved lighting debt
(§6.1) onto the surface every learner sees.

**What runs instead.** `applySpeaking` adds a syllabic cadence to the head, with
a slower yaw so it is not a metronome and a trace of chest. It composes on top
of whatever emotion and action are playing, and it runs BEFORE `limitFaceLift`,
so a talking character can never talk its own face out of frame. Measured live
in a lesson: the speaker's head swings 10.4 deg of pitch against 3.9 deg with
the cadence off.

Amplitude is sized by what READS, not by what is physically demure. At two
degrees the chin of a 96 px avatar travels about a pixel and the cadence is
invisible exactly where most of the cast lives; four degrees of peak pitch moves
it a few. Six degrees is the ceiling, because `nod` is a gesture in its own
right and this must never be mistaken for one.

**It is gated on `reducedMotion`, NOT on `ambientMotion`,** and that distinction
needed a new field. `ambientMotion` folds an accessibility instruction into a
performance tier — it is false on `low` AND false under `prefers-reduced-motion`
— so a consumer reading it cannot tell "this phone is slow" from "this person
asked for less motion". Decoration is right to stop for either; motion that
carries INFORMATION should stop only for the instruction. Silencing "who is
talking" on a cheap device removes the signal exactly where most learners are,
to save two quaternion multiplies a frame. `QualitySettings.reducedMotion` now
carries the instruction on its own, at every tier.

*This is how the defect was found, and it is worth recording:* the cadence
appeared not to run at all. Raising its amplitude fivefold changed nothing. It
was not a wiring bug — a probe showed `speaking=true` reaching the character
with `ambient=false tier=low`, because SwiftShader is slow enough that the
governor demotes. The gate was wrong, and the same gate would have silenced the
feature on exactly the phones §1.0 is about.

## §7 HANDOFF — what the next session needs Blender for

Ordered by value. Items 1–2 are the reason this handoff exists.

### 1. Add a mouth (unblocks lip-sync) — SOLVED for `zara`, pending for the rest

No jaw/facial bone exists (§3), and **the mouths are painted into the texture
rather than modelled** — so there is no geometry to deform. That kills both
routes this handoff originally proposed, and the second one is worth stating
plainly because it looks viable right up until it is measured:

- **Viseme blendshapes are out.** Nothing to deform. On rho the whole body is
  3,080 triangles and the lips share a triangle with the cheek; a viseme would
  stretch a decal, not open a mouth.
- **Sliding the mouth region's UV offset is also out.** It presumes a
  contiguous mouth island. These exports carry a **per-facet shattered UV
  atlas**: two probe points 4 cm apart on Zara's face resolve to (0.096, 0.153)
  and (0.447, 0.300). Verified by resolving the UV under seven probe points
  with barycentric interpolation, not by looking at the texture.

**What shipped instead: a mouth CARD.** A small grid parented to the `Head`
joint, laid over the painted mouth, with an 8-frame atlas swapped by texture
offset. It keeps everything the UV route was chosen for — no rig change, and an
upgrade path from amplitude-driven to true visemes without touching the model.

- `frontend/scripts/generate-mouth-atlas.mjs` (`npm run assets:mouth`) draws the
  atlas. Skin colour is the character's **albedo** (`#FECBA6` for Zara, within
  ±2 across four widely separated UV locations), never a sampled render —
  Blender's view transform darkens and desaturates, and a card matched to a
  rendered pixel goes wrong the moment the app's lighting hits it.
- `frontend/scripts/fit-mouth-card.py` raycasts the card grid onto the face and
  emits `src/tutor-scene/mouthCards.generated.json`. The card is **not a flat
  quad**: the face bulges ~1.6 cm forward across the mouth's 8.6 cm width, so a
  flat plate stands that far off the cheek at its corners.
- `src/tutor-scene/mouthAtlas.ts` + `MouthCard.tsx` build and attach it.
  `Character3D` takes a `viseme` prop; that is the seam lip-sync plugs into.

Still open on this item: **rho, liruf and dina have no card yet**, and the
reason is worth reading before anyone assumes it is a palette swap.

- **liruf — fitted three ways, still NOT shipped.** His grin is measured
  (0.376 × 0.127 m at (0.031, 0.870)), his albedo is measured (snout `#587D5C`,
  jaw `#B2DC86` — his skin is TWO colours across the mouth), and the atlas has
  an `arc` shape family with triangular teeth to match him. What does not work
  is the FIT, and all three projections are now in `fit-mouth-card.py` with
  their failure modes recorded:
  **planar** compresses the sides of a muzzle to nothing and leaves the painted
  grin's corners showing; **cylindrical** sweeps a band of constant height,
  which a grin whose height varies with the angle around the snout does not
  follow; **ribbon** traces the mouth line and builds a band across it, which
  puts the curve in the geometry and covers the most — and still not all of it,
  with a few stray triangles left in three-quarter view.
  `hasMouthCard('liruf')` is false, so he renders exactly as before. A
  half-covering mouth card is worse than none: it makes a character look broken
  rather than unfinished.
- **rho — SHIPPED, and he never needed an animated moustache.** He has no mouth
  to replace: his moustache covers the region and nothing is painted under it.
  But there IS a clean patch of skin between the moustache's centre and his
  chin, measured at 8.3 x 6.8 cm — which is exactly where a moustachioed man's
  mouth belongs. So his card ADDS a mouth in a normal place with the ordinary
  ellipse family, and the moustache's curled tips stay painted and static,
  which is what a moustache does. His card is deliberately small: a soft
  skin-coloured edge straying onto that near-black moustache would be the one
  part of it the eye finds instantly.
- **dina — fitted, NOT shipped, and she failed differently from Liruf.** Her
  painted mouth is a thin curve, so there is barely anything to cover — the
  ribbon should have been easy. It collapsed instead: 38 of her 77 card
  vertices were rejected, because her head is so small that the ray origin
  (an axis 5.2 mm inside a face 10 mm tall) falls outside the head for the
  band's top and bottom rows, and those rays never meet a surface. Her card
  rendered as a crumpled scrap.
  Fitting her also forced a real fix that outlives her: the RAY MODE is now
  chosen from measured curvature rather than assumed, and the per-character
  `gap` exists because she is exported at Unreal scale and blown up ~25x at
  runtime — the 3.5 mm gap that suits Zara would stand 9 cm off Dina's face.

A card is therefore **three measurements and a shape family**, not a colour:
the mouth rect, the albedo either side of it, and a projection that suits the
head it sits on.

> ### ⚠ The mouth is 2.4 px at the framing this stage actually ships
>
> Measured in the browser, not estimated: at `/dev/scene-lab` the canvas is
> 760 CSS px wide showing a 6.5 m island, which is ~64 px per metre. Zara stands
> **104 px tall** and her mouth is **2.4 CSS px / 2.9 device px**.
>
> The card is correct and the blocker in §3 is genuinely broken — but at this
> camera distance **no viseme is distinguishable from any other**. Lip-sync
> cannot pay for itself until the Tutor frames a speaking character far closer
> than the island vignette does, which is a CAMERA decision belonging to this
> document, not an asset one. Until then the mouth is correctness with no
> visible effect.
>
> This is why the art was iterated in Blender renders rather than in the app:
> the app cannot show the difference.

The card's alpha feather is **anisotropic**, and that is forced by the face, not
chosen: Zara's nose sits 17.5 px below the top of the card while the mouth
starts at 28.8 px, so the entire transparent→opaque ramp has 11 px. An
isotropic blur wide enough to hide the card's side edges **erased her nose** —
caught only by rendering the card frames beside the untouched face.

### 2. Author real animation clips

Name them **exactly** as the canonical vocabulary (§4) so they drop straight
into `characterActions.ts` as replacements:

```
idle jump hop wave point celebrate nod shake think dance peek bow
```

Plus 7 short looping emotion clips affecting head/upper-torso only, named
`emotion.<name>`; they are composed additively over actions.

Loop `idle`, `celebrate`, `dance`; the rest are one-shot. Bake to keyframes at
30 fps — constraints and IK do not survive glTF export.

### 3. Fix Dina's export scale at source (optional)

She is the only character whose units disagree with the rest (Unreal scale).
The runtime normalises her, so this is hygiene, not a bug.

### 4. Everything else that is still open

| Item | Blocked on | Notes |
|---|---|---|
| KTX2 texture compression | `brew install ktx` | Textures ship as WebP and decode to full RGBA in VRAM. Matters most on 2 GB phones. `npm run assets:3d` warns loudly on every run. |
| Publish assets to Depot | **Depot must ship first** (see §3.3) | `npm run publish:scenes` uploads 9 files / 5.90 MB to bucket `tutor-scenes`, then writes `sceneManifest.generated.json`. Commit it, then set `VITE_SCENE_ASSET_BASE` to `<depot>/files/tutor-scenes`. |
| Gesture amplitude tuning | Nothing — just art direction | Numbers in `characterActions.ts` + a screenshot pass. |
| Conversational layer | **DONE 2026-08-21** | Built as `oracle/` + Core `/api/v1/tutor/*` + `frontend/src/tutor/`. See §7b's integration note. Not enabled for minors until `/ORACLE.md` §16 clears. |

## §7b The integration contract — what the next layer plugs into

The stage is a RENDERING concern with a small, closed surface. Nothing in
`src/tutor-scene/` knows about DeepSeek, Qwen, retrieval, transcripts or
turn-taking.

**`TutorStage` is the surface the product uses**, and it is what `/tutor`
renders. Wiring the conversational layer means passing it props, not reaching
into the scene:

```tsx
<TutorStage
  character="rho"           // who leads. companion is optional.
  emotion={emotion}         // 7 canonical emotions
  action={action}           // 12 canonical actions
  actionKey={replayCounter} // bump to replay the same one-shot
  speechUrl={audioUrl}      // from audiogen; null when silent
  onSpeechEnd={next}
  onReady={begin}           // fires ONCE, when the cast is actually on screen
/>
```

**Wait for `onReady` before the first line.** The scene already gated its own
visibility on this and kept it to itself, which left the conversational layer no
way to know whether anyone was there yet: speech handed over while the assets
are still resolving plays audio at a blank canvas — the tutor talking to an
empty island. It fires exactly once, through a ref rather than a dependency, so
an inline arrow callback cannot make it fire every render.

Hand it a speech URL and it plays the audio, drives the mouth from that audio,
and moves the camera in close for as long as the character is talking. Changing
the URL INTERRUPTS — a tutor that finishes its sentence after the child has
moved on is worse than one that stops mid-word. Clearing it stops.

It owns the `<audio>` element on purpose: an element can only ever be adopted
by one AudioContext, a second attempt throws, and because the analyser ROUTES
the audio a failed attach is SILENCE rather than merely a still mouth. One
owner means that cannot happen twice.

`TutorScene` underneath takes the low-level props (`viseme`, `framing`) and is
what the scene lab drives directly.

**TTS plugs in through `useLipSync`.** `audiogen` returns a URL; the product
plays it in an `<audio>` element it owns; the hook turns that element's live
loudness into the `viseme` prop:

```tsx
const viseme = useLipSync(speaking ? audioElement : null);
```

Verified end to end in `/dev/scene-lab`: 5 s of real audio drove the mouth
through 7 distinct visemes. The hook takes an ELEMENT rather than a URL on
purpose — playback, pausing, interruption and the user gesture that unlocks
audio all belong to whoever owns the conversation, not to a 3D scene.

Amplitude, not phonemes, because Qwen3-TTS returns no phoneme track. The
upgrade path costs nothing structurally: a phoneme track would index the SAME
eight atlas frames, so no model, card or component changes when it arrives.
That is what the atlas bought.

> ### ✅ The conversational layer PLUGGED IN — 2026-08-21
>
> `/ORACLE.md` is built, and this contract held: wiring it was passing props,
> not reaching into the scene. Two props were added because they were genuinely
> missing rather than because the design changed:
>
> - **`scene`** — `TutorScene` had always accepted it; `TutorStage` never
>   forwarded it, so the product could not offer an island the scene lab had
>   been switching between for weeks.
> - **`speakingFraming`** — the owner made all four characters selectable as
>   the speaking tutor (`/ORACLE.md` §0 decision 4), so `conversation` framing
>   could no longer be a constant. `rho` and `zara` close in; `liruf` and
>   `dina` stayed at the island shot, because closing the camera on a painted,
>   motionless mouth frames the one thing that is not working. For them the 2D
>   bubble carries the articulation — `CharacterActor`'s `speaking` prop
>   animates the SVG mouths that §3.1 could not give them in 3D.
>
>   **Where that 2D head LIVES changed on 2026-08-22, and only the place.** It
>   was a chat bubble on the lesson plate; it is now inside the caption over the
>   speaker's crown, cropped to the head (`TutorFace`), beside the words. Two
>   surfaces printing one sentence 252 px apart was never the requirement, and
>   in a 64 px whole-body figure the mouth this section is about measured about
>   five pixels. See /DESIGN.md §Lumen -> *One line, one printing, two
>   channels*.
>
>   **CORRECTED 2026-08-21 — that second half was `/ORACLE.md` §2.2's FALLBACK,
>   not its decision.** §2.2's primary mitigation reads "They frame wider.
>   Their `conversation` framing keeps more of the body in shot"; never closing
>   the camera on them was the alternative, gated on "if this reads as broken
>   in the first real screenshot pass". No such pass ran, so the gated branch
>   shipped ungated and two of the four selectable tutors never came near the
>   camera. The fix is a third shot rather than a boolean: `closeup-wide`
>   (§9.1) brings them to the foreground 22° off-axis at 1.35× distance,
>   framing head and hands, so the still mouth is never the subject and the
>   character is still genuinely present. Two framings could not express that;
>   a vocabulary can.
>
> Captions render as an HTML overlay ON the canvas
> (`frontend/src/tutor/SpeechCaption.tsx`), never as scene geometry: text in
> WebGL is a font-atlas problem across three locales that buys nothing when the
> caption always faces the viewer anyway.
>
> `onReady` earned its keep exactly as predicted — the product gates its first
> speech URL on it, so audio never plays at an unresolved canvas.

**`framing` is not decoration.** At `vignette` a character is 104 px tall and
their mouth 2.4 px, so no viseme is distinguishable from any other. Lip-sync
only means something in `conversation`, which frames head-and-shoulders by a
fraction of the character's own height — rho's head alone is 47% of his, and a
fixed metre framing cropped his skull while missing Dina entirely.

**Authored clips replace procedural drivers per action, silently.**
`clips-biped.glb` carries ALL TWELVE actions — `idle nod bow celebrate jump hop
point shake think dance peek wave` — plus the seven `emotion.*` states and the
`emotion.rest` reference pose. 0.31 MB, no geometry. A character uses a clip
when one exists for its action and falls back otherwise, so the library filled
in without a single call site changing.

**Emotions are ADDITIVE over the action.** Seven emotions times twelve actions
would be 84 clips to author and re-author; additive means seven, each touching
head, neck and upper torso only, so an emotion cannot fight a jump for the same
joints. `emotion.rest` has to be exported rather than synthesised: a bone's
rest orientation is its own bind rotation, not identity, so "no emotion" cannot
be written in clip space without shipping it. Dina, on her own rig, keeps the
procedural posture. The file is OPTIONAL: a 404 logs once
and everything keeps working procedurally, because it is a gitignored build
output and a fresh checkout must still render a stage.

## §8 Resuming on another machine

```bash
git checkout feat/tutor-3d-scene
cd frontend && npm install          # runs predev/prebuild → copies Basis transcoder
```

**The optimized assets are NOT in git** (`frontend/public/scenes/` is
gitignored — they are build outputs). Re-create them from the source exports:

```bash
# Source .glb files are in /glb/ (also gitignored — copy them across separately)
npm run assets:inspect -- ../glb/Rho.glb           # read-only report
npm run assets:3d -- ../glb/Rho.glb  public/scenes/rho.glb   --max-triangles=50000
npm run assets:3d -- ../glb/Dina.glb public/scenes/dina.glb  --max-triangles=50000
npm run assets:3d -- ../glb/Zara.glb public/scenes/zara.glb  --max-triangles=50000
npm run assets:3d -- ../glb/Liruf.glb public/scenes/liruf.glb --max-triangles=50000
npm run assets:3d -- "../glb/Meshy_AI_A_stylized_3D_diorama_0815070253_texture.glb" public/scenes/diorama-a.glb --max-triangles=45000
npm run assets:3d -- "../glb/Meshy_AI_A_stylized_3D_diorama_0815070301_texture.glb" public/scenes/diorama-b.glb --max-triangles=45000

# Mouth atlases (§7.1). Also a build output, also gitignored.
npm run assets:mouth

# Authored clip library (§7b). Needs Blender on PATH.
npm run assets:clips
```

The optimizer creates `public/scenes/` itself. It did not always: the write is
the LAST step, so on a clean checkout a missing directory threw only after the
whole pipeline had run — minutes of diorama simplification discarded at the
finish line.

Then `npm run dev` and open **`/dev/scene-lab`** — the composed scene with a
live perf HUD, buttons for all 12 actions, 7 emotions, 8 visemes, both framings,
each of the 4 leads, **both islands**, and per-asset inspection. That is the
fastest way back into context.

The island switch exists for the same reason the lead switch does: whether a
cast FITS a diorama is a question only the composed view answers, and while the
harness was pinned to `diorama-a` nobody could see that `diorama-b` stands its
entire cast in the pond (§5).

`/tutor` renders the same stage inside the product shell.

### Pipeline invariants

- `optimize-glb` **fails the build** if skins, animations or skinning
  attributes decrease. `prune({keepLeaves: false})` once deleted Liruf's
  skeleton silently — joints ARE leaf nodes — producing a smaller, valid .glb
  whose character could no longer deform.
- The artist exports **uncompressed**; the script does the compression.
- Meshopt over Draco: no externally hosted decoder, faster decode on the
  low-end phones the budget exists for.
- Lighting lives in code, never baked — DESIGN.md mandates light AND dark mode,
  so an asset lit at export time is wrong in one of them by construction. Baked
  ambient occlusion in textures is fine; baked lightmaps are not.

## §9 In-scene composition — the stage as the page

Added 2026-08-21. §1–§7b describe a scene that renders. This section describes
a scene that is the whole screen and that the learner touches: what the camera
can be told to do, how DOM chrome is positioned over a moving render, how the
camera composes around that chrome, and what is actually pickable.

The layout these rules serve is `DESIGN.md` → §Screen Recipes → **Tutor**,
which is authoritative (/AGENTS.md §1.1 rank 4). This section is the STAGE
side of it; the product side is `/ORACLE.md` §9–§10.

### §9.1 The shot vocabulary and the damper contract

**Five shots, closed, pure.** `src/tutor-scene/shots.ts` holds one function per
shot, `(ctx: ShotContext) => CameraPose`, importing neither `three` nor React:

```
establishing · approach · closeup · closeup-wide · two-shot
```

`closeup-wide` is the shot that did not exist and should have (§7b's
correction): 22° off the subject's own facing axis at 1.35× the `closeup`
distance, framing head AND hands. It is what `/ORACLE.md` §2.2 always meant by
"they frame wider", expressed as something a picker can put on screen and a
test can assert.

**`over-shoulder` was the sixth and was REMOVED on 2026-08-21**, after the
stage was driven at 375×812 and photographed. It was the framing `conversing`
took the moment a live segment reached the plate, and what it put on a phone
was hair and one ear — no island, no face, no companion; at 1280×800 the back
of Dr Rho's head filled the left two-thirds in profile. Every gate in the repo
was green throughout, because a character's own body counts as painted scene
and the shot tests asked only for sign and finiteness.

Two independent reasons, either of which is sufficient:

- **Its one caller was itself a violation.** `/ORACLE.md` §9.3, `/ORACLE.md`
  §16's shipping gate and `DESIGN.md` → Screen Recipes → **Tutor** all say the
  character's on-screen height is IDENTICAL with and without a live segment.
  Every shot sits at its own distance, so ANY shot change breaks that. Getting
  the tutor out from behind the plate is `composition.ts`'s job and it does it
  by shifting the AIM, never the distance. `StageShotInput` therefore no longer
  has a `segmentLive` field at all — the coupling now fails `type-check`
  instead of failing a screenshot.
- **It is geometrically impossible in portrait**, which §1.11 makes
  non-negotiable. A cartoon head is ~47% of body height, so making the near
  figure a foreground EDGE rather than the subject needs a stand-off of about
  2.1× height (~3.5 m for Rho). The cast stands ~1.4 m apart, so from there the
  lead subtends 5.97° off axis and the companion 4.27° — 1.7° apart, the
  "shoulder" landing on top of the subject. Widening the offset cannot fix it:
  at 375×812 half the horizontal field of view is 8.53°, capping the offset at
  0.53 m and the separation at 2.4°. An over-the-shoulder needs the stand-off
  SMALL relative to the separation; here it is the reverse.

There is also nothing in the WORLD to look over a shoulder at during a segment:
the activity is DOM chrome on a plate, and a world camera cannot frame a
screen-space rectangle. The pair moment that IS expressible — one character
putting a question to another — is `two-shot`, which `/ORACLE.md` §9.4 assigns.

**An island shot stands as CLOSE as its promises allow and lets the rest
bleed** (added 2026-08-22). `establishing` used to fit the island's bounding BOX
inside the frame on both axes. On a portrait phone half the horizontal field of
view is 8.53 degrees, so the width term pushed the camera to 29 m and the island
then used a quarter of the frame's height — 220x110 px in an 812 px page, 6.5%
of the canvas by alpha count, which is the owner's original "minimizaste el
escenario" surviving in the phases nobody had photographed. A subject with air
on all four sides is an object on a table; one that runs past the edge is a
place you are standing in.

So the fit is now a set of PROMISED POINTS (`shots.ts` → `holdDistance`): the
cast's heads, crowns and chests, the top of the island's own box, and a ring at
`ISLAND_HOLD` / `APPROACH_HOLD` of the island's radius. Each point states the
distance IT needs to stay inside the frame with `HOLD_MARGIN` to spare, the shot
takes the largest, and everything outside that runs off the edges. `ISLAND_HOLD`
is **below 1 in portrait and above 1 in landscape**, which is the whole
composition decision in one constant: a phone gets an island that overflows, a
desktop gets the whole rim with margin — the latter because `DESIGN.md` spends
the freed width on the scene and because the `island.rim.*` pads are pickable
there.

**Elevation is what fills a portrait frame**, and it is not a taste. The island
is a floating disc on an `alpha: true` canvas, so a camera near the cast's eye
line sees it EDGE ON with transparency above and below; its projected height
grows as `sin(elevation)` while its width does not move at all. Portrait
therefore tilts down harder than landscape (`ISLAND_ELEVATION`,
`APPROACH_ELEVATION`, `TWO_SHOT_ELEVATION` are all per aspect), and `two-shot`
went from a level camera — which framed two figures against void, 7.0% of a
phone — to a tilt that puts the island BEHIND the pair.

**`approach` holds the CAST, not a fraction of the island** (changed
2026-08-22, and the paragraph this replaces is the reason the picker was
empty). Its one phase is `personalizing`, which is an audition: the whole
catalog stands on the island with a name plate on each crown, and a plate whose
anchor leaves the frame is hidden AND inert, so a candidate framed out is a
candidate who cannot be chosen by looking at them.

The shot used to buy that safety with a bigger HOLD — a symmetric ring at 0.68
of the radius, hand-tuned once until the widest candidate fitted — and the
paragraph here said, correctly for that design, that `approach` was therefore
WIDER than `establishing` on a phone. **A ring is not four people.** It charged
the camera for both sides of a whole circle when what actually had to be in
frame was four points, and it went on charging after the cast moved. Measured at
375x812 on `diorama-a`: the cast's real spread was 1.97 m either side of the aim
and the proxy charged 2.35 m, so the frame came out 5.56 m wide against a 6.5 m
island and `personalizing` painted **29.9%** of the viewport while `arriving`
painted 50.7%. The one screen a child chooses their tutor on was four fifths
sky, and every gate in the repo was green — the coverage gate included, because
it asked `approach` the same two-character question it asks every other shot,
and holding two is strictly easier than holding four.

Three things changed together, and none of them works alone:

- **`ShotContext.cast`** carries the whole audition, and `castPoints` promises
  every one of them with their own silhouette pad. The framing is now a function
  of where the people are: gather them and the camera comes in, spread them and
  it gives ground. No number to re-tune.
- **The audition gathers in DEPTH** (`standingSpots.ts` →
  `AUDITION_NARROW_WEIGHT`, §5). Depth is free — two characters a metre apart in
  depth are a metre apart to the separation rule and cost the frame's WIDTH
  nothing, which is the axis a portrait phone has least of.
- **`APPROACH_HOLD.portrait` became a floor**, equal to `ISLAND_HOLD.portrait`:
  the audition is never framed further out than arrival for want of a subject.
  `APPROACH_LEAN` dropped 0.25 → 0.12 for the same reason the hold did — a lean
  is charged directly against the cast now, and a quarter of the way cost a
  point of coverage on `diorama-a` and four and a half on `diorama-b`.

Result, measured on `/dev/tutor-lab` with the orbit stopped: **29.9% → 49.1%**
at 375x812 and **48.5% → 55.5%** at 1280x800, with all four candidates on
screen, facing the learner, each name legible, and no control under 44 px.
`shots.test.ts` now asks the audition question directly — a four-candidate
fixture taken off `npm run verify:placement`, held to the same coverage floor
AND asserted to keep every candidate inside the frame at both breakpoints.

Landscape is unchanged: there the `island.rim.*` pads at 0.88 of the radius are
still the binding promise, the cast is always well inside them, and `approach`
is nearer than `establishing` exactly as it always was.

**The idle orbit is a SWING, not a circuit** (`CameraDirector` → `ORBIT_SWING`,
0.10 rad). It used to accumulate without bound, which was survivable only while
the island shot stood far enough back that nothing could leave the frame however
far the camera walked round. A shot that bleeds cannot promise to hold a subject
it is going to orbit away from, and the placement solver faces the cast outward
along the stage bearing, so far enough round is the backs of their heads.

**The retreat a fitting shot owes the HUD is measured against what the shot is
holding**, not against the viewport (`composition.ts`). The old rule was
`max(viewport / free)`, so a microphone dock covering a quarter of the height
pushed every island shot back a third whatever it was framing — and coverage
falls as the SQUARE of that, which cancelled the framing at 1280x800 from 41.6%
to 15.7%. `keepInFrame` is now stated PER SCREEN AXIS for the same reason: one
scalar reported an island shot's 3.4 m lateral ring as 3.4 m of vertical
protection too, against a 2.7 m half-frame, and the solver concluded the subject
already overflowed and refused to compose at all.

**Coverage is a gate.** `shots.test.ts` → "how much of the frame the island
actually covers" casts one ray per sample against the island's ground disc and
holds every shot to a floor at both breakpoints, so a phase that leaves a phone
two-thirds empty fails a test rather than a screenshot. It is a deliberate LOWER
BOUND on the canvas alpha measurement — no rock, no palms, no characters — and
it does not replace looking.

**Every shot is asserted to hold its own subject, at BOTH breakpoints.**
`shots.test.ts` projects each shot's promised points — heads with a 12% margin
inside the frame edge, crown/chest/rim anchors merely inside it — at 1280×800
and 375×812, paired and solo. That suite exists because the previous one could
not tell a shot pointed at a face from a shot pointed at the inside of a skull.
It still cannot see that a head is BACKWARDS, which is why the screenshot pass
is not optional.

**Why a module and not two branches in `useFrame`.** The camera rig shipped
with `vignette` and `conversation` decided inline, each computing an ABSOLUTE
position and writing it every frame, then returning. That is why every framing
change SNAPPED — there was no state between "here" and "there" for anything to
travel through. Splitting the DESTINATION (a pure pose) from the TRAVEL (one
damper) makes a transition a property of the system rather than a feature
somebody has to remember to add to the next shot.

**The damper is one line and it is framerate-independent:**

```
x += (target - x) * (1 - Math.exp(-lambda * dt))
```

Never a duration-based tween. A shot change routinely arrives while the
previous one is still moving, and a tween restarted from a moving start
produces exactly the snap the rewrite exists to remove. Still **exactly one
camera write per frame**, unchanged from §1's cost.

Four rules on top of it, each preventing a failure this scene has already had
or would have had:

1. **`ambientMotion: false` gates the ambient layers ONLY** — the idle orbit,
   the handheld noise, the bob, the breathing. It must NOT gate the shot
   damper. `quality.ts` sets `ambientMotion: false` on the `low` tier and
   `governor.ts` LATCHES after two demotions, so a device that hiccuped twice
   would otherwise be locked forever into a stage whose camera can never move
   between shots — the whole design reduced to a static island, on exactly the
   hardware the quality system exists to protect. The damper costs the same
   single write either way, so gating it buys no frames.
2. **Reduced motion is a `still` MODIFIER on this system, never a second
   camera.** Zero orbit, zero handheld, zero anticipation, and travel collapsed
   to a cut covered by a 120 ms scrim dip. One vocabulary with a modifier means
   the accessible path is exercised by every shot test; two camera systems
   means the accessible one is the one nobody looks at.
3. **No shot may EVER feed back into placement.** Every one of them is built
   off the cast's own facing axis — `two-shot` blends two of them — and the
   solver faces characters outward from the island centre (§5). If placement
   re-solves in response to the camera, the two chase each other and the cast
   ends up facing a shot that has already moved on. **The camera reads
   placement; placement never reads the camera.**
4. **Re-base the orbit clock on arrival.** The shipped rig accrued
   `clock.elapsedTime` continuously while a close-up was held, so returning to
   the establishing shot jumped to wherever the orbit would have been. Arrival
   resets the phase.

The framing cache must invalidate on **scene and cast**, not only on viewport
resize. The two islands are 6.5 m and 9.5 m across (`measurements.ts`) and the
characters differ in height by 2.4× — a fit computed for one and reused for the
other is visibly wrong, and the shipped cache invalidated on `size` alone.

### §9.2 The anchor ref channel — DOM chrome over a moving render

Every in-scene control that carries text is a DOM node (§2.1 of `/ORACLE.md`
generalizes the caption doctrine to the whole HUD). A DOM node over a moving
camera needs a new screen position every frame, and the obvious implementation
is the expensive one.

**The channel:**

```tsx
// INSIDE the Canvas — publishes a world point under a named slot.
<WorldAnchor slot="lead.head" point={[x, y, z]} />

// OUTSIDE the Canvas — a ref CALLBACK for the node to be positioned.
const ref = useAnchorSlot('lead.head');
```

Inside `useFrame`: `point.project(camera)`, convert to CSS px against the
canvas size, lerp ~90 ms to absorb handheld noise, and write
`el.style.transform = translate3d(...)` **straight onto the ref'd node**.

**It NEVER calls setState, and that is the load-bearing rule.** `SceneCanvas`
already carries the measured version of this lesson in its own comment: it
throttles its stats report to ~1 s because "reporting per frame would push a
React state update 60×/second into the parent and cost more than the scene it
is measuring". A HUD of a dozen anchored nodes re-rendering the whole tutor
route sixty times a second would be the same mistake at twelve times the size,
and it would be paid on the low tier that can least afford it.

**The slot vocabulary is a CLOSED union**, `AnchorId` in
`src/tutor-scene/anchors.ts` — lead/companion crown and head, lead chest, three
island places, five stage marks and five sky marks. Three properties matter more
than the list:

- **A DOM component asks for a named PLACE, never a coordinate.** A component
  holding `[1.4, 1.9, -0.2]` must be rewritten when an island changes size, and
  — since a coordinate here is a `Vector3` — it also imports `three`, which
  would drag the renderer out of the lazy route §6 confines it to and into the
  main bundle. The two halves share nothing heavier than a string.
- **An unknown slot is a compile error, not a silent no-op.** A string-keyed
  registry fails invisibly: an unpositioned node still renders, at 0,0, looking
  like a layout bug rather than a typo. `anchors.ts` also pins the union in
  both directions, so adding a member without listing it fails the build.
- **The CROWN is a published place, not a CSS offset from the head.** `.head` is
  the MID-head, because that is what the camera aims at (a crown aim put the
  whole face in the bottom half of frame, §9.1). Anything that must sit ABOVE
  the character — the caption first of all — rides `.crown`, published by the
  scene at `focus.y + height * 0.25`, where the character's height is known in
  metres. Nudging upward off `.head` in CSS cannot work and was measured: the
  gap between the two is about 290 CSS px at a close-up on a 1280 viewport and
  about 40 px at the establishing shot, so any single pixel value is wrong in
  one of them, and being wrong at the close-up parks the caption across the
  speaker's face for most of a session. The general rule: **when a HUD offset
  depends on how big something is on screen, it is an anchor, not a margin.**

**CULLING IS MANDATORY, and it is two properties, not one.** When the projected
point is behind the near plane (`v.z > 1`) or falls outside the viewport plus a
margin, the node is set `hidden = true` **AND** `inert = true`, imperatively on
the DOM node — React 18.3 has no `inert` prop, so this is an assignment and not
JSX. Hidden alone leaves a focusable control that a keyboard user can still
reach: focus vanishes to somewhere off-screen behind the camera, with no visible
focus ring anywhere, which is indistinguishable from the page having broken.

**A hard floor on effective font size** sits beneath any depth scaling. "Scales
with depth" is a pleasant effect right up to the frame where it becomes "too
small to read", and the stage already has a measured precedent for exactly this
class of mistake: §7.1's mouth is 2.4 CSS px at the island framing, correct and
invisible.

### §9.3 Safe-area composition — a full-bleed canvas with a HUD on top

The canvas runs edge to edge and controls float over it, so the geometric
centre of the canvas is not the centre of the space the character can actually
be SEEN in. With a lesson plate inset from the bottom-right at 1280 px, the
free rectangle is up and to the left; a character framed dead centre is a
character half behind a panel.

**Shrinking the canvas to the free rectangle is the wrong fix** — it reinstates
the rejected letterboxed panel with extra steps, because the visible edge of
the render is what makes a stage read as a stage. The canvas stays full-bleed
and the CAMERA moves: `src/tutor-scene/composition.ts` turns measured HUD
rectangles into per-edge insets, then into a camera-space aim shift in metres
plus a fit padding.

Three details worth keeping:

- **A rect is charged to the edge it is cheapest to clear.** A 420 px plate
  inset 24 px from the bottom-right of a 1280×800 stage intrudes 444 px from
  the right and 524 px from the bottom, and the right answer is to move the
  subject LEFT. A full-width bottom sheet on a 375 px phone intrudes from both
  and the right answer flips to lifting. One rule produces both, which is why
  it is one rule rather than a per-component "which edge am I on" prop that
  would eventually disagree with where the component actually rendered.
- **The intrusion is CLAMPED.** A sheet dragged to FULL covers 88% of a phone;
  honouring that literally pushes the camera back until the island is a speck.
  An extreme, temporary gesture must not redefine the shot.
- **`camera.setViewOffset()` was considered and is the documented alternative**
  if the aim offset ever reads as a tilted horizon at extreme insets. It was
  not chosen because every fit in `shots.ts` derives its horizontal FOV from the
  full viewport aspect, and a view offset changes the effective projection
  without changing that aspect — so six fits would have to be rewritten to agree
  about a sub-rectangle none of them can see.

The rects are held in a **ref**, written by a `ResizeObserver`, for §9.2's
reason: a sheet being dragged must not re-render the tree on every frame of the
drag.

### §9.4 Picking — the scene is the menu, and it is pick-proxies

React Three Fiber v8 ships its own raycasting, so `onClick` / `onPointerOver`
on a mesh works with no additional dependency. **drei is deliberately not a
dependency** (/AGENTS.md §1.2) and nothing here needs it.

What DOES need care is the cost and the target size:

- **Heavy meshes get `raycast = () => null` at mount** — the diorama group and
  every skinned character mesh. Otherwise every pointer move tests 45–67k
  island triangles plus up to 50k per character, per event, on the tier the
  budget exists to protect.
- **Picking happens on invisible padded PROXY boxes**, roughly seven of them,
  sized from `CHARACTER_MEASUREMENTS` (§2). This is what makes a 44 px minimum
  tap target at 375 px true **by construction** rather than by hoping a
  character's silhouette is large enough at whatever distance the current shot
  put the camera. A tap target that depends on the camera is a tap target that
  fails on one shot and passes on the others.
- **A pickable mesh always has a DOM twin dispatching the same handler**
  (`DESIGN.md` §Components → WorldChip). The mesh is the delightful path, the
  twin is the guaranteed path, and both are always mounted. This is the rule
  that keeps the cinematic route and the keyboard route from becoming two
  implementations that drift apart at the second feature.

### §9.5 Suspense boundaries and preload

The scene mounts once and stays mounted for the whole `/tutor` route
(`/ORACLE.md` §9.1), which changes what a Suspense boundary costs.

- **Split the single boundary.** `TutorScene` wraps the diorama and the whole
  cast in ONE `<Suspense fallback={null}>`, so swapping a character blanks the
  island too. That was invisible while personalization was a form; it is
  unacceptable when tapping a character IS the picker. One boundary for the
  diorama, one per character, with a veil fallback rather than nothing.
- **`SceneLighting` renders OUTSIDE the boundary** and must stay there — that
  is what lets a backdrop change apply instantly without ever blanking the
  stage (`/ORACLE.md` §2.1's reopened gap).
- **Preload the alternatives on entering personalize** (`useLoader.preload`):
  the other island and the characters not currently on stage. Paired with the
  split boundaries, that is what makes the island genuinely usable as a menu —
  a swap that hits a fallback is a swap that reads as a page load.
- **`useSceneModel` deliberately does not clone the loaded scene**, so the same
  character must never be mounted twice. `TutorScene` therefore takes ONE cast
  list (`standing`) and de-duplicates the tutor into it, rather than rendering a
  lead and a companion that could be the same person.
- **THE AUDITION: all four characters, for one phase, priced.** Added
  2026-08-21. During personalization the whole catalog stands on the island so
  that a name plate labels somebody who is visibly there; before it, the picker
  hung a plate at each stage mark while the scene rendered two characters, so
  two of the four plates floated over empty grass. This section previously said
  "four characters plus an island will not fit", which was measured against the
  wrong ceiling — the 100,000 SINGLE-ASSET one. Against the ceiling that governs
  a live scene it fits, and here are the numbers (`npm run assets:inspect`, now
  recorded in `measurements.ts`):

  | | triangles |
  |---|---|
  | rho | 3,080 |
  | liruf | 3,132 |
  | zara | 49,999 |
  | dina | 49,997 |
  | diorama-a | 44,996 |
  | diorama-b | 66,868 |

  Four characters are 106,208. With either island that is **151,204** or
  **173,076** per frame against the 220,000 ceiling — comfortable. With the
  shadow pass on it is **302,408** or **346,152**, 1.4x and 1.6x over, because
  `high` is the only tier with a shadow-casting light and a shadow map
  re-renders the whole scene. So the audition turns shadows OFF for its
  duration rather than dropping a candidate: a missing candidate puts a name
  plate back over empty ground, while a missing shadow costs one directional
  light's contact darkening on one tier, and `ContactShadow` still grounds every
  character on every tier. Asserted in `budget.test.ts` — both halves, including
  that it does NOT fit with shadows on, so the override cannot quietly become
  unnecessary and stay.
- **EVERY character gets their own Suspense boundary — including the tutor and
  their companion.** Superseded 2026-08-22; it used to be "each audition EXTRA",
  with the principals sharing the boundary that gates `onReady`, and that
  distinction shipped the worst defect this stage has had. A wrapper that
  depends on a character's role remounts them when the role changes. See §5.2
  for what the remount then did, and for how `onReady` keeps its promise
  without it. A candidate nobody has chosen still must not be able to hold the
  tutor's first spoken line behind three more .glb fetches, and now neither can
  a companion invited halfway through.
