---
title: Character avatars
status: draft
updated: 2026-10-10
---

# Character avatars

> A plan to rebuild the heads of Liruf, Dina, Zara and Rho as light 2D vector avatars (speech, expressions, gaze, micro-interactions) that run inside the platform with no 3D and no per-state video. The owner's decisions, the research, the way to rebuild a head faithfully, the format candidates and the spikes that choose between them.

> **Status: draft.** The first section is decided by the owner. Everything after it is a proposal to be tested by the spikes before anything is built.

## Role

The characters exist as 3D models, used for marketing compositions ([[CHARACTER-COMPOSITIONS]]). Inside the product a live 3D scene costs the user's device and a video per state is too heavy. The avatar is a third thing: a head that reacts, drawn in 2D. It does not replace the compositions or the models. The expressions it should cover start from [[CHARACTER-POSES]].

## Read this when

- Deciding the format, the runtime or the pipeline for in-product character heads.
- Any screen asks a character to speak, react, look at something or follow the cursor.

## Decided by the owner (2026-10-09)

1. The avatar is the head, shown as a **bust down to the shoulders** (the owner changed this on 2026-10-09 from a cut at the neck); it was first "head only", a reconstruction **faithful to the `.glb`** of each character.
2. **No 3D**, no 3D models and no 3D renderer in the product for avatars.
3. **No mouth atlas or mouth cards.** A picture placed in front of the mouth reads as paper over the 3D face and is rejected. The mouth has to be part of the drawing.
4. The format may be Lottie, Rive, SVG or similar, as long as it is 2D.
5. Prefer licenses without strings: try the reference (bible-strong-avatar-lab) or another alternative.
6. Avatars do not replace marketing compositions or the `.glb` files.
7. Answers of the same day: head only; used as a **floating avatar** (in the style of the guide mascot on Brilliant) inside the platform; the voice is **generated**; all **four** characters (Rho, Dina, Liruf, Zara); the fidelity is whatever the recreation allows at its maximum; if it works, a full catalog of expressions follows. A flatter character is accepted (textures are not kept) as long as it **looks** like the original. Work is supervised step by step, with as much automation as possible and as little hand work as possible.

Added by this plan from the project rules, to be confirmed: every avatar is decorative or has a text equivalent and honors reduced motion ([[FRONTEND-GUIDE]]); no camera, microphone or face tracking of the child, only the cursor ([[CHILD-SAFETY-AND-PRIVACY]]); small weight and low CPU ([[PERFORMANCE-AND-SCALING]]).

## What the research found

**The reference does not fit, for two reasons.** bible-strong-avatar-lab builds *procedural* 2D avatars: a body made of primitives and eyes, drawn as SVG by its own runtime. (1) All three of its runtime packages (`avatar-core`, `avatar-react`, `avatar-web`) are licensed **AGPL-3.0-only**; using one in the product would require publishing the product's source under the same license. (2) It has no mouth: its README lists body, colors and eyes, and a code search of the repository finds no "mouth" and no "viseme". It cannot speak and its shapes are not built from our models. The Studio itself runs in the browser and its output is a JSON file, but that file needs the AGPL runtime to draw. Three of its ideas are worth taking, as ideas: expressions stored as differences from the neutral face; animations as sequences of expressions with hold and transition times; automatic blinking.

**What the models give us** (measured on the sources in `glb/`):

| | Rho | Dina |
|---|---|---|
| Vertices | 3,026 | 95,076 |
| Texture | one 2048 px image, fragmented atlas | one 2048 px image, fragmented atlas |
| Morph targets (blendshapes) | none | none |

The faces are painted into a fragmented texture, so there are no separable eye or mouth parts and no blendshapes. The only reliable record of what a character looks like is a **render of the model**, and everything that is hidden in the model (the eyeball behind the lid, the inside of the mouth, the teeth, the skin behind the hair) does not exist and has to be drawn.

**Tools and licenses** (checked 2026-10-09 on each project's repository unless noted):

| Piece | License | Note |
|---|---|---|
| Rive runtime (`rive-wasm`) | MIT | Canvas 2D renderer, no WebGL limit; vector paths, bones, raster meshes, state-machine inputs. The editor is proprietary and files are authored by hand in it |
| dotLottie player (`dotlottie-web`) and `thorvg` | MIT | Lottie with state machines (number, boolean, string inputs, pointer events); designed for vectors |
| `lottie-web` | MIT | The classic player, no state machine |
| VTracer | MIT | Raster to layered SVG; usable as a build tool |
| diffvg (reported as Apache-2.0, not checked) | Apache-2.0 | Fits vector shapes to an image by optimization; usable as a build tool |
| Live2D Cubism | Proprietary SDK; free under about 10M yen of yearly revenue, otherwise a paid release license | Layered raster art with mesh deformation and parameters (the industry standard for 2D faces that turn); `pixi-live2d-display` is MIT but needs the proprietary core |
| Inkscape, Figma | GPL / commercial | Hand cleanup tools; the product ships only their output |

Viseme charts use about 8 to 12 mouth shapes and the shapes are largely shared by English, Spanish and Portuguese, so one set serves the three languages.

## How to rebuild a head faithfully (proposal)

Be exact about what "faithful" can mean. For the **neutral face seen from the front** it is checkable: the vector head can be drawn over the render of the model and compared. For **everything the model never shows** (open mouths, closed eyes, other expressions) there is no ground truth: those are drawn in the character's own style (same colors, same outline weight, same shading) and approved by the owner against the canon. This plan promises the first strictly and the second with a review.

1. **Reference renders.** With the render tool we already have ([[CHARACTER-COMPOSITIONS]]), render each head from the source model at maximum quality: a front view, and a few turned views, in separate passes: color without light (the painted surface), light only (shading), and an outline.
2. **Separate the parts.** Eyes (white, iris, pupil, highlight, lids), brows, nose, mouth (lips, inside, teeth, tongue), ears, hair or hat, mustache, glasses, crest or horns, the head silhouette. Most of this is cut out by color from the unlit pass, then corrected by hand.
3. **Redraw each part as vector shapes**: a first pass with VTracer for the base shapes, then cleaned by hand into smooth Bezier curves with the same number of points wherever a part will change shape. Soft shading becomes a few flat shadow and highlight shapes or fitted gradients; edges and flats are kept; photographic detail is not.
4. **Draw what is hidden**: the full eyeball, the lids, the mouth interior, a set of mouth shapes built from real lips, teeth and tongue (not a card on top), the skin behind hair. This is the main hand-art cost.
5. **Rig**: the mouth morphs between shapes as a path; lids close; the iris moves inside the eye for gaze; parts shift by depth for a head that follows the cursor; small idle movement; named expressions as differences from neutral.
6. **Check**: the vector neutral over the render (overlay and an image difference), then each expression sheet against the canon by the owner.

## Candidate formats for the rig

All of them can carry the vector parts above; the choice is about how much control, how much hand authoring and what lock-in.

| | Rive | dotLottie | Our own SVG runtime |
|---|---|---|---|
| What it is | Vector rig with state machine and bones | Vector animation with a state machine | The parts as SVG, driven by code |
| Control (visemes, gaze, cursor) | Strong: inputs and bones | Good: inputs and pointer events; morphing mouths means many keyframes | Full, anything we code |
| Made by script from the art | No: authored by hand in the editor | Partly (the JSON can be generated) | Yes |
| Weight | Small binary file plus runtime | Small JSON or archive plus runtime | Smallest runtime; SVG as data |
| Lock-in | A proprietary editor | Open format, open players | None |
| Risk | Hand work and tool dependence | Interactivity is simpler than Rive's | We build and maintain the runtime |

## Plan

Each step ends with something the owner can see and accept or stop.

| Step | What | Done when |
|---|---|---|
| 0. Decide | Head extent (head only or with neck and shoulders); which character first; where avatars appear; the expressions needed | The owner answers the open questions below |
| 1. Reference | Render the reference passes of Rho and Dina with a new mode of the render tool | A sheet of passes per character to look at |
| 2. Spike on one head | Rebuild **Rho** as vector (neutral, blink, three mouth shapes, gaze) in the three candidate formats, same art | One page per format; the overlay of the vector on the render; weight and cost measured on a mid-range phone |
| 3. Hard case | Dina (large non-human head, crest, wide mouth) in the format that won | Dina neutral and an open mouth that the owner accepts as hers |
| 4. Decide | The format, from the owner's eye and the measurements | Decision recorded in [[DECISIONS]] |
| 5. Schema and tools | The avatar definition format (validated on read) and the scripts for steps 1 to 3 of the rebuild that can be automated | Document at status accepted; one command from `.glb` to reference passes and first traces |
| 6. Runtime | The component in `frontend/src/`, with i18n for any text, reduced motion, an accessible name or hiding, and the audit tools | One avatar in a real screen, in three languages and both themes |
| 7. The rest | Zara and Liruf, then the expressions the screens ask for, each approved against its canon | The owner approves each character |

**What the spike measures**: how close the vector neutral is to the render (image difference and the owner's eye); weight per character (provisional target: under 100 KB); runtime weight; frame cost on a mid-range phone with four avatars on screen; hours of hand art per character; and how natural the mouth looks while speaking a test phrase.

## Risks

- **Hand art is unavoidable.** Hidden parts and mouth shapes must be drawn. Auto-tracing alone gives a posterized look that is not faithful.
- **Soft shading** of the models is the hardest thing to keep in vector; too many gradients and shapes grow the file and slow it down.
- **Hair, hats and crests** may need to move on their own for the head to feel alive.
- **Turning the head** in vector means either parallax of layers (cheap, limited angle) or extra drawn views.
- **Tool dependence** if Rive wins, since its editor is proprietary; **maintenance** if the runtime is ours.
- **Child safety**: avatars that react to the child record and transmit nothing; cursor following stays on the device.

## Progress

**Second pass, as busts (2026-10-09).** The owner found the first clean versions better but not organic or well defined enough, and asked for a much more careful pass and for every character to end at the shoulders instead of the neck. Changes: the reference is now cut at shoulder height for all four (`tools/avatars/head-reference.js`); outlines are organic (corners are found first, then each stretch between corners is smoothed hard and fitted with long calm Bezier curves, so there are few nodes and no wobble); a spec can add soft tonal shading as blurred shapes clipped inside a part, can clip a part to another (blush stays inside the face), and can draw a closed smooth shape through measured points (`smooth`); Rho's vest, shirt, tie and pin, Zara's shoulders, tank top and necklace, Liruf's neck and chest, and Dina's neck and chest are rebuilt as clean shapes; and the comparison image now has an overlay of the reference under the vector to check the likeness. `npm run avatars:sheet` lays the four finished avatars side by side on light and dark.

Results: Rho 10 KB with about 220 nodes, Zara 10 KB and 207, Liruf 5 KB and 94, Dina 7 KB and 108.

Owner review of the busts: Rho and Zara are about 90 out of 100 with details to improve; Liruf had a green patch between the eyes (a stray highlight piece), now removed and replaced by a soft light band along the top of the snout; Dina's body looked like raised shoulders, and she is a sauropod, so she now keeps only a long, thick neck with a light belly stripe. The traces follow the original well ("calcar fielmente").

Second review: Dina's neck looked like a stick, so it now starts thin at the head and widens toward the bottom, like the original; Liruf's face had places where the components seemed to come apart, so his head outline, jaw and snout are now single smooth shapes drawn through measured points, and the jaw is clipped to the head, which removed the joins and spikes.

Honest assessment: much cleaner than before and symmetric, but not yet at the polish of the Brilliant or Duolingo mascots. Known gaps: Rho's hair, cap and shirt edges are still a little lumpy and his face has no soft shading; Zara's hair is a flat shape with one gradient and her hairline is simplified; Liruf's head is a stack of shapes and the join between snout and cheeks is hard; Dina's neck and chest are simplified from the original body; none has the soft rim light and shading of the originals. The next level is drawing more of the volume (shadows under the hair and cap, light along the jaw, rim lights) and checking every contour against the overlay.

## Questions that were open and are now answered

- [x] Head only.
- [x] A floating avatar inside the platform.
- [x] Generated voice. Open: the voice provider, cost and child-safety rules for generated speech are not decided.
- [x] All four characters.
- [x] Whatever allows the recreation with the highest fidelity.
- [x] Accepted; if it works, a full catalog of expressions follows.

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

- The owner answers an open question or changes a decision.
- A spike produces measurements.
- A format is chosen.

## Sources

- [bible-strong-avatar-lab](https://github.com/smontlouis/bible-strong-avatar-lab) (README and package licenses, read 2026-10-09)
- [rive-wasm](https://github.com/rive-app/rive-wasm), [Rive web runtime](https://rive.app/docs/runtimes/web/), [Rive mesh deformation](https://rive.app/blog/new-features-released-mesh-deformation-and-psd-support)
- [dotlottie-web](https://github.com/lottiefiles/dotlottie-web), [state machines](https://github.com/lottiefiles/dotlottie-web/wiki/State-Machines), [thorvg](https://github.com/thorvg/thorvg), [lottie-web](https://github.com/airbnb/lottie-web)
- [VTracer](https://github.com/visioncortex/vtracer), [diffvg](https://people.csail.mit.edu/tzumao/diffvg), [layer-wise image vectorization (LIVE)](https://openaccess.thecvf.com/content/CVPR2022/html/Ma_Towards_Layer-Wise_Image_Vectorization_CVPR_2022_paper.html)
- [Live2D SDK license](https://www.live2d.com/en/sdk/license/), [pixi-live2d-display](https://github.com/guansss/pixi-live2d-display)
- [Lip sync mouth shapes in Adobe Character Animator](https://www.adobe.com/learn/adobe-character-animator/web/lip-sync-mouth-shapes)
