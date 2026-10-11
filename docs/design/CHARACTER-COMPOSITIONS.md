---
title: Character compositions
status: accepted
updated: 2026-10-11
---

# Character compositions

> The rules for every scene that shows the characters (Liruf, Dina, Zara and Rho) on a page, how those scenes are rendered, and the scenes that exist.

> **Status: accepted** (2026-10-09). The rules come from the owner, from the landing compositions that were approved, and from the ones that were rejected ([[LANDING-MESSAGING]]). They apply to every new composition.

## Role

One place for what makes a character scene acceptable, so each new one starts from the same rules instead of being corrected one round at a time. Which poses exist: [[CHARACTER-POSES]]. How the page around it is laid out: [[FRONTEND-GUIDE]].

## Read this when

- Creating or changing a scene with a character in it (hero, problem, the sign-in window, anything later).
- Changing how a scene is rendered, encoded or shown.

## The rules

1. **Scale is the character's, not the file's.** The models are small in their files and large in the product. Dina in particular is a big animal: beside Rho she stands taller than him. A Dina the size of a dog is a defect.
2. **Bright light in both color modes.** One light rig, bright, for light and dark alike; only the ground tint changes. A dark mode that dims the characters is a defect.
3. **Immersive, with no visible edges.** The scene sits directly on the page's own color. No box, band or frame around it; shadows and light pools fade to nothing inside the frame, and the video is also faded at its borders on the page.
4. **Nothing collides.** Each prop has its own place with clear space around it, paths never cross, and nothing touches a character. Few, distinct elements (about six at most), not a crowd.
5. **Characters are always alive and well lit.** They move (idle and an occasional gesture), never freeze, and never stand in shade.
6. **Delivered as video** (on the site; an email cannot play one and gets a still). A looping H.264 MP4 plus a WebP poster per color mode (the poster is what shows with reduced motion, less data, or before play). Decorative, so hidden from assistive technology and without sound. The loop is seamless: every motion completes whole cycles in the loop length.
7. **Rendered at the highest quality.** Static renders use the artist sources (`glb/originals/` for Rho, Liruf and Zara, `glb/` for Dina, who has no original; see [[CHARACTER-POSES]] for why `glb/Rho.glb` and `glb/Liruf.glb` are not used), at twice the delivered size and reduced with a high-quality filter. The runtime copies in `public/scenes/` belong to the Tutor and its budget, and are never changed for a render.
8. **Held to the page's grid and size limits.** A scene that sits inside a window takes at most 30 % of that window's height.
9. **Not generated-looking.** No crowded orbits, no full-screen fixed backdrops, no everything-centered stacks ([[LANDING-MESSAGING]]).
10. **Rho and Liruf never raise their elbows or hands** (D-042, 2026-10-10). A defect left by the program that generated their models shows in renders when they do. Everything else on them moves freely: head, torso, legs, tail, a jump. It applies to every composition made from that day on; the earlier ones are not regenerated. Zara and Dina are not restricted. A scene enforces it in code (the onboarding's `Rig.rot` refuses those bones), not by memory.
11. **Enthusiasm shows in the body.** The faces are textures. A character that stands and turns its head reads as bored (the owner rejected the onboarding's first drafts for it): they bounce, jump, lean in and tilt their heads.
12. **Inside a setting, with shadows and effects, when the owner asks for one.** The onboarding's scenes are played on a built set, every character and prop throws a shadow on it, and there are effects (sparkles, confetti, dust, motes of light). Characters floating on nothing, with no shadow, were rejected there.
13. **Approved as a still first.** The owner approves each new composition one by one as an image; its loop is rendered only after that (D-041).

## How a scene is rendered

14. **Animation fits the story.** A character shows what it is doing in the scene: a watcher stands and watches, it does not walk in place. Use a rest pose with small procedural motion (breath, head, tail, ears) when a character's clip does not fit.

The tools are in `frontend/tools/render/` and are run by hand (`npm run render:signin`, `npm run render:problem` and `npm run render:notfound`; `render-scene.mjs` takes `--scene`; `npm run render:email` makes the emails' still and `npm run render:onboarding` the onboarding's; both need pngquant, `PNGQUANT=<path>`). The scene is a page (`signin-scene.html` and `.js`) that draws the frame for any second `t`; `render-signin.mjs` serves it with three.js and the source models, captures every frame in headless Chrome, and `encode.py` encodes them with Blender's bundled FFmpeg. No dev server is needed. `--still 0,3,6` writes PNGs to `frontend/audit-out/` to look at before a full run. Prerequisites: Chrome, Blender (`BLENDER=<path>`), and `three`, a development dependency used only by these tools. Output: `frontend/public/landing/<scene>/<scene>-<mode>.mp4` and `-poster.webp`.

Rho is animated from the shared clip library with rotations only, added on top of his own pose, because the library was authored on another skeleton's rest pose ([[CHARACTER-POSES]]). Dina plays her own clip.

## Acting

Added with the 404 scene (2026-10-10), and valid for every scene where a character feels something. The faces are textures and do not change, so the feeling is in the body, and it is animated like a film, not looped like a toy.

1. **Each character acts its own small story,** offset from the others so they never move in unison. In the 404 scene: Rho searches the floor with his head, breathes in and sighs, and brings his hands to his chest; Liruf looks around, taps the floor with a claw and then slumps.
2. **Anticipate every move.** A breath in before the sigh, a small rise before the nudge.
3. **The body leads and the rest follows.** The head, the hands and the ears read their curves a fraction of a second late (the `lag` of `curve()` in the scene).
4. **Ease in and out of every pose,** never linear.
5. **Never frozen.** Between moves each character holds with a slow breath and a small drift (a moving hold).
6. **Weight sits low.** The lean is forward and down, the knees fold only as far as the mesh allows (a 110 degree knee, not a full heel sit, which collapses the skin of these models). A character whose pose does not look organic is taken out of the scene, not forced.
7. **A pose is a set of deltas from each bone's rest pose, in the character's own frame,** so it does not depend on how a skeleton orients its bones. Check every pose from the side and close up (`--only <name> --close --cam side` in the render tool) before the full render.
8. **Whole cycles in the loop.** Every breath, sway and falling speck completes whole cycles in the 12 seconds, so the loop is seamless.

The loading window's runners are not scenes: they have no composition of their own, only a transparent run cycle per character, made by `npm run render:loading` with the same model rules (originals first, lit by one bright rig, no shadow). See [[FRONTEND-GUIDE]].

## Scenes that exist

| Scene | Where | Characters | Notes |
|---|---|---|---|
| hero | landing hero | Rho and Zara | Rendered by tools that are not in the repository any more; the files in `public/landing/hero/` are the approved result. It could not be re-rendered from the originals with the rest (2026-10-10); Rho's vest shows the same torn patches in it (seen in the poster), so the scene has to be rebuilt to clear them |
| problem | landing problem section | Liruf and Dina | Rebuilt 2026-10-10 as a cinematic scene (replacing the earlier render) and re-rendered the same day with Liruf from `glb/originals/`, because the processed file had his belly torn open: Liruf waters a seed, a sprout grows and a golden bud opens with sparkles, Dina watches, glad. 1500 x 900 (5 to 3), 12 s loop. Dina stands in her own rest pose with a breath, a head that bobs toward the sprout, a swaying tail and twitching ears, because her clip is a walk cycle and a character that watches must not walk. Lit by one key light, a cool rim light and a warm bounce, soft shadows, a pool of light that fades to nothing, out-of-focus lights in dark mode, and all four borders fading to the page's own color |
| notfound | the 404 page | Rho and Liruf | The two kneel back to back, each facing outward and turned a little toward the camera, backs touching, heads low, hands at the chest. Small in the frame on purpose (the owner asked for them small, not filling it). 1600 x 680 (about 40 to 17), 12 s loop, shown at most 768 px wide under the small red "Error 404" that the page itself draws. A long lens from a little above eye height, one warm spotlight with a haze of light, a cool and a warm rim light, specks of light falling slowly, out-of-focus discs in front and behind, a camera that drifts and returns. Zara and Dina were tried and removed: their poses did not look organic. Acting is described above |
| email | the top of every email | Liruf, Zara, Rho and Dina | Made 2026-10-10 for [[F-002-emails]] (`npm run render:email`, which also makes the email logos and social marks). Seen from above (the camera looks 60 degrees down, long lens): the four stand in a shallow arc that opens toward the reader, close together, nobody touching; Liruf and Dina at the ends a step back, Zara and Rho in the middle. Only the heads are turned up to the reader, shared between neck and head; every body stays in its rest pose (the owner's direction). A still, 1040 x 640, shown at most 520 px wide. **Transparent**: no background and no border, only soft shadows and an indigo pool of light that fade to nothing before every edge, so it sits on the email's own color in light and in dark. The owner rejected the first version, on a yellow panel with rounded corners, as not immersive, and approved this one. A PNG reduced to a palette with pngquant (89 KB; 490 KB before) because mail programs show no WebP |
| onboarding (a family) | every screen of the onboarding ([[F-003-onboarding]]) | the four together, or the chosen mentor alone | Made 2026-10-10. **The owner approved all twenty-six compositions the same day (the two special scenes after one round of changes) and their loops are rendered**: `npm run render:onboarding -- --loops` writes `public/onboarding/loops/<scene>-<mode>.mp4` and `-poster.webp`. Each scene is rendered once, transparent, and every frame is laid on the light and on the dark page color, so one render makes both files. `npm run render:onboarding`; `onboarding-scene.js` draws every scene, chosen by `?scene=`. **The set** is reusable and is the same for all of them: the mentors' studio (`onboarding-set.js`), an island with no walls so the picture stays transparent: a round wooden deck with an indigo rug, a chalkboard on an easel (drawings only, never words), a bookshelf, a floor lamp, a side table with a jar of Seeds, a plant and a string of warm bulbs. One unit is one metre and everything is sized against the characters (lamp 1.95, shelf 1.75, table 0.62). The floor lamp and the bulbs are real lights. Two layouts: `wide` for the four, `close` (board, lamp, plant, bulbs) for one mentor. **Scenes:** `group-greet` (everybody jumps for joy a beat apart; Zara cheers with both arms and waves), `group-attend`, and per mentor `look` (eager about the options beside it, reading down them), `nod` (a jump landing in a big nod), `lean` (leans in, bouncing), plus `portrait` (head and shoulders, no set) for the choice cards. **The two special scenes** (D-044): `games`, the mentor at the wheel of an open sports car, flat out on a cut-out slab of race track with kerbs, cones, a tyre wall, two floodlights (real lights) and a chequered banner (`onboarding-track.js`); the car does not travel, the speed is made of the road and the kerbs rushing back, blurred wheels, streaks of air, dust from the rear wheels and the car's lean; the car is a single-seater with a real hollow cockpit (a floor, two thin doors, nothing across the top), so the driver sits in the middle of it and no surface of a character runs into a surface of the car (the owner rejected a first version, a solid block the driver was sunk into, because the join showed); Rho's and Liruf's arms stay down inside it; each mentor's car has its own color; Dina, a quadruped, does not sit: she rides standing in the cockpit of a larger car with her head in the wind, her ears laid back and her tail streaming, like a dog in an open car (seated, she did not look organic). `seeds`, on the studio without its chalkboard, a two-metre sunflower drops its Seeds one after another into a big glass jar and one large Seed floats above it in its own light (`onboarding-seeds.js`). **A Seed is a sunflower seed** (D-043) and every scene builds it with `seed-model.js`, the same drawing as the 2D icon. **Effects** (`onboarding-vfx.js`): sparkles around each character, confetti when they cheer, a ring of dust where they land, motes in the lamplight, golden stars from the jar; all functions of the loop's second. 8-second loops at 24 frames a second, 1200 x 800 (the four) and 900 x 900 (one); the portraits are 560 x 560 transparent PNGs through pngquant |
| signin | the sign-in window | Rho and Dina | Re-rendered 2026-10-10 with Rho from `glb/originals/` (the processed file has gaps along his vest). Round table, four floating glass screens in a loading state (shapes, no text) turning once per loop, 1440 x 420 (about 3.4 to 1), shown at 120 px high. Keep the characters and the table in the central two thirds: on phones the sides are cropped |

## Related

- [[CHARACTER-AVATARS]]
- [[F-002-emails]]
- [[F-003-onboarding]]
- [[DECISIONS]]
- [[CHARACTER-POSES]]
- [[LANDING-MESSAGING]]
- [[FRONTEND-GUIDE]]
- [[FRONTEND-TOOLKIT]]
- [[DESIGN-SYSTEM]]
- [[PERFORMANCE-AND-SCALING]]

Back to [[INDEX]].

## Update this document when

- The owner adds or changes a composition rule.
- A scene is added, replaced or removed.
- The render tools change.
