# TUTOR_3D.md — The Tutor's 3D stage

> **Authority:** engine spec (/AGENTS.md §1.1 #6). Domain rules for the code
> live in `frontend/AGENTS.md` → *Tutor 3D scene*. Product design for the
> conversational layer is `/ORACLE.md` — **this document covers the STAGE
> only**, not the tutoring.
>
> **Status (2026-08-15):** stage BUILT and rendering for every user on
> `/tutor`. Conversational layer NOT started. Assets are local-only —
> publishing them to Depot is the one blocker before deploy.

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

Three characters (rho, zara, liruf) share an **identical 24-joint biped
skeleton**:

```
Hips · Spine · Spine01 · Spine02 · neck · Head · head_end · headfront
Left|Right: UpLeg · Leg · Foot · ToeBase · Shoulder · Arm · ForeArm · Hand
```

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
4. **Amplitudes are art direction, and they are NOT art-directed yet.** The
   gestures read, but `celebrate` in particular leaves the arms mid-height
   instead of overhead. Tuning is numbers in one file plus a screenshot pass.

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
- **`three` must only ever be reached through a lazy route.** Verify after each
  build: `WebGLRenderer` appears in the `TutorScene-*` chunk (≈287 kB gzip) and
  NOT in `index-*`.

## §7 HANDOFF — what the next session needs Blender for

Ordered by value. Items 1–2 are the reason this handoff exists.

### 1. Add a mouth (unblocks lip-sync)

No jaw/facial bone exists (§3). Two viable routes, in preference order:

- **UV mouth atlas (recommended).** Map the mouth region to a small atlas
  (one 512² texture, ~8 frames: closed, A, E, I, O, U, M/B/P, F/V) and swap the
  UV offset at runtime. **No rig change at all**, matches the stylized look,
  and it upgrades from amplitude-driven to true viseme-driven later without
  touching the model.
- **Viseme blendshapes.** Best quality, most authoring. Use the ARKit set or
  the 8-shape subset above.

Either way, also consider a single `jaw` bone as a cheap fallback for
amplitude-driven talking.

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
```

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
