# TUTOR_3D.md — The Tutor's 3D stage

> **Authority:** engine spec (/AGENTS.md §1.1 #6). Domain rules for the code
> live in `frontend/AGENTS.md` → *Tutor 3D scene*. Product design for the
> conversational layer is `/ORACLE.md` — **this document covers the STAGE
> only**, not the tutoring.
>
> **Status (2026-08-16):** stage BUILT, rendering, and READY AS AN INTEGRATION
> TARGET — §7b is the contract RAG/TTS plug into. Zara has a working mouth
> driven by real audio through `useLipSync`; three characters still need their
> card. ALL TWELVE actions are authored clips; the seven emotions remain
> procedural posture. Conversational layer NOT started (/ORACLE.md). Assets are
> local-only — publishing them to Depot is the one blocker before deploy.

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
**Dina was the sole outlier** — exported in Unreal units at 0.028 m tall and
0.042 m long (deeper than tall, which is what gave the quadruped away) — and is
normalised to 0.70 m at the shoulder, ~1.05 m long: large-dog sized beside a
1.7 m human. Normalisation happens at RUNTIME via a scale on the wrapping
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

## §4 Animation — procedural by necessity

Every export ships **exactly one clip**, and all of them are locomotion cycles
(`walking_man`, `running`, an Unreal take). Looping a walk cycle on a character
who is standing still and talking reads as a treadmill.

So the authored clip is used as a **pose** (evaluated once, held) and the full
canonical vocabulary is synthesised procedurally in
`frontend/src/tutor-scene/characterActions.ts`:

- **12 actions** — `idle jump hop wave point celebrate nod shake think dance peek bow`
- **7 emotions** — `neutral happy excited thinking surprised encouraging proud`

These are the SAME closed vocabulary as the 2D rig
(`components/characters/control/types.ts`), so `emotion`/`action` fields already
authored throughout the lesson catalog drive the 3D cast unchanged.

Emotions map to **posture**, not expression — there is no face to move (§3).
That is a weaker channel than the 2D characters have, and it is stated plainly
rather than pretended otherwise.

### §4.1 The authored clip library — why every clip is ADDITIVE

`frontend/scripts/author-clips.py` produces `clips-biped.glb`: 20 clips (12
actions + 7 emotions + `emotion.rest`) authored on Zara's rig. Two rules make
one file safe on three skeletons that do not share a rest pose (§3):

1. **`sanitizeClip` — rotation only, plus one deliberate root translation.**
   The export is force-sampled, so it carries translation, rotation AND scale
   for all 24 bones of all 20 clips: 1,440 tracks, of which 1,140 describe
   Zara's skeleton rather than any motion. `Hips.position` is the single
   exception, because leaving the ground is root motion and cannot be expressed
   as a rotation.
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

### §4.2 OPEN: gesture amplitude is calibrated to one rig

Additive composition fixes *proportions*, not *amplitude*. A bone-local delta
of 150° means something different on a bone whose rest orientation is 73° away,
so a gesture authored on Zara arrives muted or misaimed on the others.
Measured, at each gesture's peak frame:

| gesture | zara | rho | liruf |
|---|---|---|---|
| `think` | ✅ | ✅ | ✅ |
| `bow` | ✅ | ✅ | ✅ |
| `wave` | ✅ | ✅ acceptable | ✅ |
| `point` | ✅ | ⚠️ weak (10.2 forward) | ❌ **pointed backwards** (−0.9) |
| `celebrate` | ✅ overhead | ❌ hands at head | ❌ arms stay down |

Two findings worth keeping:

- **Rho physically cannot raise his arms overhead.** Arm reach 15.99 from a
  shoulder at ~3.2 tops out at 19.2; his crown is at 25.94. Stylized character,
  big head, short arms. His `celebrate` has to be *arms up and out*, not a
  retarget of Zara's.
- **An armature-space retarget is not the fix.** It was implemented and
  measured (identity check on Zara: 2e-6, so the maths is right). It *helps*
  Liruf and *hurts* Rho — the rests differ in incompatible ways and no single
  linear rule serves both. Per-character values are the answer, not a smarter
  transform.

The intended shape is per-character override clips named `<action>@<id>` in the
same library, resolved with fallback to the shared `<action>`, so only the four
clips that actually need it get authored twice.

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
| Upload optimized `.glb` to Depot | Production credentials + owner authorization | Bucket `tutor-scenes` already supported and tested. Then set `VITE_SCENE_ASSET_BASE`. **This is the deploy blocker.** |
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
/>
```

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
live perf HUD, buttons for all 12 actions, and per-asset inspection. That is
the fastest way back into context.

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
