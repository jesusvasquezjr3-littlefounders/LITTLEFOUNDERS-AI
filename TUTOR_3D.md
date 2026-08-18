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
> its entire cast in the pond. Conversational layer NOT started (/ORACLE.md).

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
- Characters face **outward** from the island centre (`atan2(x, z)`), turned a
  quarter toward each other. Facing inward shows their backs — "inward" and
  "toward the viewer" are opposites when the camera is outside the scene.

A new diorama therefore needs **no coordinates and no manifest tuning** beyond
its target diameter.

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

### `npm run verify:placement`

Runs the real solver against the real islands, headless, in seconds, and reports
what each character would be standing on — surface colour at the hit UV, height,
rim clearance, and whether the ground under them is a pedestal. It imports
`findStandingSpots` rather than reimplementing it; a copy would drift from the
thing it certifies.

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
| Conversational layer | Product decisions in `/ORACLE.md` §3 | Voice/live tutoring. §1.9 applies in full. |

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
