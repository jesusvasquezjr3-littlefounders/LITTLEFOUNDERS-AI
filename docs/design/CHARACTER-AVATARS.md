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

## Plan (as proposed; steps 1 to 6 are done)

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

**Status of the work (2026-10-10): the four avatars exist and run.** The owner approved the likeness ("they look much better"; Rho and Zara about 90 out of 100) and asked that everything pending be done, not asked about. The decisions taken to finish it:

- **Format: our own SVG rig (D-015).** The art is layered SVG with named parts; a small framework-free rig moves the parts and a React component runs it. Rive and dotLottie were not built as spikes: both need hand authoring in a tool, neither can be generated from the art by script, and the own rig already does everything asked (speech, expressions, gaze, cursor, micro-interactions) at 5 to 13 KB per character. They stay as options if a full 3D-like turn is ever needed.
- **The 3D rule applies to all four** and drove every drawing: the turned views (`npm run avatars:reference -- --yaw 0,40,75,-40 --pass lit`) showed Rho's round nose, wrapped mustache and shaded cheeks, Zara's lit strands, Liruf's boxy snout and Dina's thick neck. The drawings carry soft shading and volume planes, and the head turn is a parallax (below).

**How it is built**

1. `tools/avatars/`: `reference.mjs` (renders, turned views with `--yaw`), `segment.py` (numbered color pieces), `art/<character>.json` (the art spec: parts, how each is drawn, and the `rig` that says what moves), `parts.py` (builds the SVG and the rig file), `compare.mjs` and `sheet.mjs` (to judge).
2. `src/features/avatars/assets/<character>.svg` and `.rig.json`: the shipped art (ids prefixed per character so several share a page) and its rig, 4 to 13 KB each, loaded on demand per character.
3. `rig.ts`: moves named parts by transform from one `Frame` of numbers (gaze, blink, eye opening, brows, mouth, blush, tilt, breathing, nod). The head turn is a parallax: features slide by their depth, hair and crest the other way, and the whole avatar tilts a little; it reads as a turn of a few degrees, not a full rotation.
4. `expressions.ts`: six expressions (neutral, happy, surprised, thinking, sad, encouraging) the avatar eases between. `visemes.ts`: eight mouth shapes shared by English, Spanish and Portuguese and a text-to-timeline function; the generated voice's own timing replaces it later, because the avatar accepts any timeline.
5. `Avatar.tsx`: the component (blinks, breathes, follows the pointer, holds an expression, speaks, nods and wiggles; pauses off screen and when the tab is hidden; reduced motion holds it still). `FloatingAvatar.tsx`: the floating companion with a speech bubble, in the style of the guide mascot on Brilliant. `DevAvatars.tsx`: a development page at `/dev/avatars`, mounted only by the dev server, to see them alive.

**Expressiveness pass (2026-10-10).** The owner asked for far more expressive avatars, built from how a face really works: the brows and the line between them (raised in surprise, drawn together in anger or worry, arched for doubt), the lids and the white of the eye (wide in fear and surprise, narrowed and tense in anger, squeezed in joy), the nose (wrinkled in disgust), the mouth (corners up for a smile, down for sadness, pressed in anger, round in surprise), the cheeks and the fold beside the nose (raised with a smile), "and also head movement and rotations". The rig now has: independent brows per side with tilt and a frown squeeze; eyes that open, narrow, widen, slant and change pupil size per side; a nose that wrinkles with fold lines and flaring nostrils; a mouth whose outline is bent point by point (smile and frown, a one-sided smirk, an "O", pressed lips, width, opening) with parts such as the mustache riding along; cheeks that rise and swell; and the head: turn (parallax), tilt, nod, lean, bounce and rearing back, with the hair and crest swinging behind. Motion is a spring with a little overshoot, so every change reads as a reaction. There are **19 expressions** (neutral, happy, laughing, excited, surprised, scared, angry, disgusted, sad, worried, doubtful, thinking, confused, proud, smug, shy, sleepy, encouraging, wink) and **12 gestures** (nod, double nod, shake, blink, wink, wiggle, jump, lean in, curious, shrug, flinch, giggle) in `expressions.ts`; while speaking the avatar also lifts its brows and nods. Each character has a `gain` that scales motion for faces that take up less of the drawing (Zara, Dina). Liruf gained brow ridges so that anger and worry read on a face without brows.

**Checked alive (headless Chrome):** all four render and move; the 19 expressions, gaze, head turn and speech were captured on all four characters and read clearly (Liruf and Rho are the most readable; Zara and Dina are subtler because their features are small). Type-check, lint, the anti-slop lint and the production build pass; the dev page is not in the production build. Not checked: a real phone, a screen reader, the CPU cost with several avatars, and sound (there is no voice yet).

**Cursor following and speech (2026-10-10).** Following the pointer is now in three layers, as a person does it: the eyes lead, the head turns and tilts toward it a moment later, and looking up lifts the chin; resting the pointer on an avatar makes it smile and lean in, and tapping it plays a random reaction (`interactive`, on by default). Speech is a researched dictionary of words to mouth shapes for English, Spanish and Portuguese plus audio-driven lip sync: see [[AVATAR-SPEECH]]. Liruf was redesigned to be friendlier after the owner found his gestures "murky and not friendly at all": a warm amber iris instead of red, softer brows, a pink mouth with a tongue and small fangs, and a resting gentle smile (`baseline` in his rig), so every expression starts from friendly.

**Cursor following and speech (2026-10-10).** Following the pointer moves only the iris and pupil inside each eye (the owner asked for this: the face and head must not deform); expressions and gestures keep the head turn, tilt and lean, at a softer strength, and a squint no longer collapses the eye into a slit. Resting the pointer on an avatar makes it smile, and tapping it plays a random reaction (`interactive`, on by default). A blush is clipped to the face outside the group the rig moves, so it can no longer leave the face when the head turns (Dina). Speech is a researched dictionary of words to mouth shapes for English, Spanish and Portuguese plus audio-driven lip sync: see [[AVATAR-SPEECH]]. Liruf was reworked twice after the owner said he was not as tender as the 3D model and his gestures were murky: first friendlier colors, then, because that moved away from the model, back to the model's own eyes (large black pupils with a thin red iris ring and two glints), no brow ridges, softer motion (gain 0.8) and a resting gentle smile (`baseline`).

**The test page.** `npm run dev` in `frontend/` and open `/dev/avatars` (dev server only; the production build does not include it). It shows the four avatars, or one large, and has buttons for the 19 expressions, the 12 gestures and the 13 mouth shapes; the look (the pointer, glances, or a fixed point); a text box with English, Spanish and Portuguese to speak with a speed control; a file picker that plays any audio with the mouth following it (the text is fitted to the audio, or cleared so the mouth follows the sound); and a slider for every number the rig takes, to build a face by hand. Rebuilding an avatar with `python tools/avatars/parts.py <Character>` updates the page by itself.

**Owner review of Zara and Liruf (2026-10-10).** Rho and Dina approved at 100 %. Zara: expressions were murky, eyes stuck out of place, the mouth made odd, unfeminine grimaces and nothing was tender; found by capturing every expression at full size (cause: motion strength and gain too high for small features, and a mouth bend that made pointed V shapes). Fix: a per-character `expressionScale` (0.85 for Zara) that scales how much of an expression's brow, eye and mouth movement she wears, a lower motion gain, and a soft mouth curve (reach 26): every expression is now clean and in place. Liruf: too many outlines (not the style of the others), not tender, not faithful, not expressive. Fix: all outlines removed (eyes, mouth, snout edges), eyes as in the 3D model (large black pupil, thin red ring, two glints), and expressiveness through **eyelids**: a skin-colored lid, clipped to his head, slides down and tilts over each eye (angry, sad, sleepy, doubtful, wink), so a face with no brows has brows; the eye no longer squashes. His mouth is a soft gradient with tongue and small fangs and bends with the rest. Rho and Dina were not touched.

**Zara's eyes (2026-10-10).** The owner still found her eyes odd, in outline and size. Compared at high zoom against the reference render: the white was too big and too low, the iris too small, the liner floated above the eye instead of hugging it, and it was a thin stroke where the original is a thick tapered liner with a wing at the outer corner. Redrawn from measurements of the reference: a rounder, smaller white tucked under the liner, a larger iris clipped to the eye so it can never leave it, and a filled liner that tapers into the wing. Parts can now be clipped to an ellipse (`clip_ellipse` in the art spec), and path layers honor `opacity`.

**Zara's jaw, neck and sideburns (2026-10-10).** The owner found her chin asymmetric and her neck and chest wrong (the collarbones seemed to stick out where the necklace sits), then, after a first fix, the chin huge and unfeminine, and her temples bald. Cause: the jaw came from color pieces of a render in which the model is itself turned a little (its two sides are 40 px different at the jaw), and the neck was a separate patch of a different skin tone. Fix: the face outline below the cheeks is now one smooth, exactly symmetric shape built from half-widths measured on the reference (narrower toward a rounded chin), the neck, shoulders and chest are one continuous skin tone with the neck flaring into the shoulders, the chain starts at the neck as in the original, a soft shadow under the chin shows where the chin ends, and thin tapered strands of hair (sideburns) frame each temple and move with the hair.

**Hanging hair (2026-10-10).** Zara's sideburns moved with the head's parallax and counter-rotation like a part of the face, so with expressions they swung like earrings. They are now `strands` in the rig: pinned at a root on the hairline, they keep hanging down while the head tilts (they counter-rotate against the head's roll), sway a little with a turn or a nod, and stretch slightly, so they behave as hair. Her jaw was refined (more convex, slightly wider at the cheek than the narrowest reading) and a thin edge under the chin marks where the chin ends.

**Known limits.** The head turn is a parallax, so it holds for small turns; a real profile would need extra drawn views. Rho's octagonal lenses are circles by request. The expression catalog is the first six; a full catalog is the next step the owner announced ("if it works, a full catalog follows"). Voice (generated) is not designed: provider, cost and child-safety rules are open (T-023).

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
