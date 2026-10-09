---
title: Character avatars
status: draft
updated: 2026-10-09
---

# Character avatars

> A plan to turn the heads of Liruf, Dina, Zara and Rho into light, interactive avatars (speech, expressions, gaze, micro-interactions) that run inside the platform without a 3D renderer and without pre-rendered video. Research, options, a recommendation, and the spikes that decide it.

> **Status: draft.** Nothing here is decided. The owner's goal and constraints are in the first two sections; the recommendation is mine and is to be tested by the spikes before anything is built.

## Role

The characters exist as 3D models, used for marketing compositions ([[CHARACTER-COMPOSITIONS]]). Inside the product a live 3D scene costs the user's device, and a video for every state would be too many files and too heavy. The avatar is a third thing: a head that reacts. It does not replace the compositions or the models. Poses it should be able to express: [[CHARACTER-POSES]].

## Read this when

- Deciding the format, the runtime or the pipeline for in-product character heads.
- Any screen asks a character to speak, react, look at something or follow the cursor.

## Goals and constraints (from the owner)

1. The **head only**, faithful to the canon of each `.glb`, for the four characters.
2. Fast to render, with **no 3D renderer** and no per-state video.
3. **Control**: speech, facial expressions, cursor following, micro-interactions.
4. A format such as Lottie (`.lottie`, `.json`) or similar. The reference given is [bible-strong-avatar-lab](https://github.com/smontlouis/bible-strong-avatar-lab).
5. Not a replacement for marketing compositions or the `.glb` files.

Added by this plan, from the project rules, to be confirmed: every avatar is decorative or has a text equivalent and honors reduced motion ([[FRONTEND-GUIDE]] rules); no camera, no microphone and no face tracking of the child, only the cursor ([[CHILD-SAFETY-AND-PRIVACY]]); weight and CPU budgets as below ([[PERFORMANCE-AND-SCALING]]).

## What the research found

**The reference is a different technique.** bible-strong-avatar-lab builds *procedural* 2D avatars: geometry described in JSON and drawn as SVG by its own runtime (`avatar-core`, with React and DOM renderers). Its useful ideas: expressions are stored as differences from the neutral face, so the same behavior works on different faces; an animation is a sequence of expressions with hold and transition times; automatic blinking; one portable definition file read by one framework-independent runtime. It is not baked from a 3D model, and it is licensed **AGPL-3.0**, so none of its code can go into this product without opening ours: take ideas only.

**Our models are hard to take apart.** Measured on the source files in `glb/`:

| | Rho | Dina |
|---|---|---|
| Vertices | 3,026 | 95,076 |
| Texture | one 2048 px image | one 2048 px image |
| Morph targets (blendshapes) | none | none |

Both textures are a *fragmented atlas*: the eyes, the mouth and the skin are scattered islands in no readable layout. So the faces cannot be edited as layers from the texture, and there are no blendshapes to drive a mouth. The only reliable source of "what the character looks like" is a **render of the model**. The previous version already faced this: `frontend/public/scenes/mouth/` still holds one 8-cell mouth atlas per character (closed, wide open, and six intermediate shapes) painted over a skin-colored patch, which is a mouth drawn on top of the painted one. That is a precedent for the approach below, not a design to copy.

**Format facts** (searched 2026-10-09; sizes of runtimes are not verified):

- **dotLottie** has state machines (since v2.4): inputs of number, boolean and string kind, pointer events (click, hover, custom), and the web player wires the listeners itself. Raster images inside a Lottie are embedded and are the biggest cause of heavy files; Lottie is designed around vector shapes.
- **Rive** has a canvas runtime that draws with the browser's 2D context (no WebGL, so no limit on how many are on a page), supports raster images and mesh deformation, state-machine inputs, and mouths driven by bones or meshes. Its editor is proprietary and files are authored by hand in it; the runtimes are open source.
- **Visemes**: classic charts use about 8 to 12 mouth shapes (closed M-B-P, rounded O, wide E, F-V, and so on); Adobe Character Animator ships 11. The shapes are mostly shared across English, Spanish and Portuguese, so one set serves the three interface languages.

## The options

| | A. Baked sprite rig, our own small runtime | B. Rive | C. dotLottie | D. Head-only 3D in WebGL |
|---|---|---|---|---|
| Fidelity to the canon | Highest: pixels are renders of the `.glb` | High if sprites are imported; deformation is hand-made | Same limit, plus the raster weight problem | Highest, but the models have no mouth rig |
| Weight | Small and predictable (WebP layers) | Medium (runtime plus file) | Heavy with images | Heavy (3D library, GPU) |
| Concurrent avatars | Many (2D canvas or DOM) | Many (2D canvas) | Many | Few, or one shared canvas |
| Speech, gaze, micro-interactions | Whatever we code: full control | Strong: state machines and bones | Good: state machines | Full |
| Produced by script from the `.glb` | Yes | No: hand authoring in the editor | Partly (the JSON can be generated) | Yes, but needs blendshapes authored |
| Lock-in and license | None, ours | Editor is a product we depend on | Open format | None |
| Fits the "no 3D renderer" goal | Yes | Yes | Yes | No |

## Recommendation

**Option A, a baked sprite rig, as the default**, with a time-boxed comparison against Rive. Reasons: it is the only option that keeps the heads literally faithful (they are renders of the models), it can be produced by script from the `.glb` files with the render tool we already have ([[CHARACTER-COMPOSITIONS]]), it is the lightest, and it leaves us in control of speech and gaze. Lottie is built for vector shapes and our heads are raster, so it is the weakest fit. Rive is the strongest alternative when real deformation matters; the spike tells us whether it is worth the hand authoring.

How A works:

1. **Base head**: the head and neck rendered from the model at several turns (for example three to five yaw angles, with pitch done by a 2D transform), with the painted mouth covered by a skin-colored patch, as the old mouth cards did. Rendered at maximum quality from the sources in `glb/`.
2. **Face decals** drawn on the base, each with its position, scale and skew per turn angle stored in the file: eyes (open, half, closed, plus a pupil that moves for gaze), eyebrows, and the **mouth** (8 to 12 viseme shapes, from the existing atlases as a start).
3. **A definition file** (`avatar.json`, one per character, validated when read): parts, anchors, visemes, expressions stored as differences from neutral (borrowed idea), and named behaviors (blink every few seconds, idle sway, a nod, a look-away).
4. **A tiny runtime** (a React component over a 2D canvas) with a small interface: `expression`, `speaking` (a timeline of visemes with times, or an amplitude), `gaze` (a point, or the cursor), and one-shot micro-interactions. Easing with Motion, which is already in the stack.

## Plan

Each step ends with something the owner can see and accept or stop.

| Step | What | Done when |
|---|---|---|
| 0. Decide | Head extent (head only or neck and shoulders); which characters first; where avatars will be used; the expressions needed (the seven emotions of [[CHARACTER-POSES]] are the starting list) | The owner answers the open questions below |
| 1. Spike A | Rho and Dina by hand through the render tool: base turns, one set of visemes, blink and gaze; a throwaway runtime in a test page. Dina first among the hard cases: a non-human face with a crest and a large head | A page where the head follows the cursor, blinks and speaks a test phrase; weight and frame cost measured on a mid-range phone |
| 2. Spike B | The same heads in Rive, built by hand | The same behaviors; the comparison table below filled with measurements |
| 3. Decide | Pick the format from the measurements and the owner's eye | Decision recorded in [[DECISIONS]] |
| 4. Schema | Write the `avatar.json` specification and its validation | Document at status accepted |
| 5. Bake tool | `frontend/tools/avatars/`: one command bakes a character from its `.glb` into the layers and the file | Rho and Dina baked without hand steps except the art that must be redrawn |
| 6. Runtime | The component in `frontend/src/`, with i18n for any text, reduced motion, an accessible name or hiding, and checks with the audit tools | One avatar in a real screen, in the three languages and both themes |
| 7. The rest | Zara and Liruf, then the expressions the screens ask for | Owner approves each character against its canon |

**What the spikes measure**: weight per character (target: under 300 KB loaded, to be confirmed); runtime weight (target: under 15 KB gzipped for option A); frame cost on a mid-range phone with four avatars on screen; no WebGL context used; fidelity (the base render beside the `.glb` render, judged by the owner and by an image difference); and how many hand-art hours each character needs.

## Risks

- **Faces are painted into a fragmented texture**, so covering the painted mouth and eyes needs drawn patches that match each character's shading. Probably a manual art step per character; to be measured in step 1.
- **Head turn costs weight**: every extra turn angle is another base image. Fewer angles with 2D tilt and parallax is cheaper but less faithful.
- **Hair, hats and crests** (Rho's cap, Zara's hair, Dina's crest) may need to move on their own for the head to feel alive; that grows the layer count.
- **Uncanny or off-model faces** if a decal is out of register with the base: owner review of each character is a gate.
- **Child safety**: avatars that react to the child must not record or transmit anything; cursor following stays on the device.
- **AGPL**: no code from the reference repository.

## Open questions for the owner

- [ ] Head only, or neck and shoulders too?
- [ ] Where will avatars appear (a guide beside an exercise, feedback after an answer, a profile picture, a chat)? This sets the sizes and the expressions.
- [ ] Speech: what drives the mouth, recorded or generated voice, or text only with an animated mouth? Voice raises child-safety and cost questions that are not decided.
- [ ] Which two characters first (suggestion: Rho and Dina, who are already in a composition).
- [ ] Is Rive an acceptable dependency if the spike favors it, given its editor is proprietary?

## Related

- [[CHARACTER-COMPOSITIONS]]
- [[CHARACTER-POSES]]
- [[FRONTEND-GUIDE]]
- [[FRONTEND-TOOLKIT]]
- [[UI-LIBRARIES]]
- [[CHILD-SAFETY-AND-PRIVACY]]
- [[PERFORMANCE-AND-SCALING]]
- [[BUILD-TASKS]]
- [[DECISIONS]]

Back to [[INDEX]].

## Update this document when

- The owner answers an open question or changes a goal.
- A spike produces measurements.
- A format is chosen.

## Sources

- [bible-strong-avatar-lab](https://github.com/smontlouis/bible-strong-avatar-lab) (README and license, read 2026-10-09)
- [dotLottie state machines](https://github.com/lottiefiles/dotlottie-web/wiki/State-Machines) and [dotLottie 2.4 release note](https://lottiefiles.com/blog/working-with-lottie/dotlottie-v2-4-0-state-machine-support)
- [Rive web runtime](https://rive.app/docs/runtimes/web/) and [rive-wasm](https://github.com/rive-app/rive-wasm)
- [Lottie file size and raster images](https://lottiefiles.com/blog/working-with-lottie-animations/optimize-lottie-files-for-faster-page-load-speeds.md)
- [Lip sync mouth shapes in Adobe Character Animator](https://www.adobe.com/learn/adobe-character-animator/web/lip-sync-mouth-shapes)
