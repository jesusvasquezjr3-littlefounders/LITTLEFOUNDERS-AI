---
title: Character compositions
status: accepted
updated: 2026-10-10
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
6. **Delivered as video.** A looping H.264 MP4 plus a WebP poster per color mode (the poster is what shows with reduced motion, less data, or before play). Decorative, so hidden from assistive technology and without sound. The loop is seamless: every motion completes whole cycles in the loop length.
7. **Rendered at the highest quality.** Static renders use the artist sources in `glb/`, at twice the delivered size and reduced with a high-quality filter. The runtime copies in `public/scenes/` belong to the Tutor and its budget, and are never changed for a render.
8. **Held to the page's grid and size limits.** A scene that sits inside a window takes at most 30 % of that window's height.
9. **Not generated-looking.** No crowded orbits, no full-screen fixed backdrops, no everything-centered stacks ([[LANDING-MESSAGING]]).

## How a scene is rendered

10. **Animation fits the story.** A character shows what it is doing in the scene: a watcher stands and watches, it does not walk in place. Use a rest pose with small procedural motion (breath, head, tail, ears) when a character's clip does not fit.

The tools are in `frontend/tools/render/` and are run by hand (`npm run render:signin`, `npm run render:problem` and `npm run render:notfound`; `render-scene.mjs` takes `--scene`). The scene is a page (`signin-scene.html` and `.js`) that draws the frame for any second `t`; `render-signin.mjs` serves it with three.js and the source models, captures every frame in headless Chrome, and `encode.py` encodes them with Blender's bundled FFmpeg. No dev server is needed. `--still 0,3,6` writes PNGs to `frontend/audit-out/` to look at before a full run. Prerequisites: Chrome, Blender (`BLENDER=<path>`), and `three`, a development dependency used only by these tools. Output: `frontend/public/landing/<scene>/<scene>-<mode>.mp4` and `-poster.webp`.

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

## Scenes that exist

| Scene | Where | Characters | Notes |
|---|---|---|---|
| hero | landing hero | Rho and Zara | Rendered by tools that are not in the repository any more; the files in `public/landing/hero/` are the approved result |
| problem | landing problem section | Liruf and Dina | Rebuilt 2026-10-10 as a cinematic scene (replacing the earlier render): Liruf waters a seed, a sprout grows and a golden bud opens with sparkles, Dina watches, glad. 1500 x 900 (5 to 3), 12 s loop. Dina stands in her own rest pose with a breath, a head that bobs toward the sprout, a swaying tail and twitching ears, because her clip is a walk cycle and a character that watches must not walk. Lit by one key light, a cool rim light and a warm bounce, soft shadows, a pool of light that fades to nothing, out-of-focus lights in dark mode, and all four borders fading to the page's own color |
| notfound | the 404 page | Rho and Liruf | The two kneel back to back, each facing outward and turned a little toward the camera, backs touching, heads low, hands at the chest. Small in the frame on purpose (the owner asked for them small, not filling it). 1600 x 680 (about 40 to 17), 12 s loop, shown at most 768 px wide under the small red "Error 404" that the page itself draws. A long lens from a little above eye height, one warm spotlight with a haze of light, a cool and a warm rim light, specks of light falling slowly, out-of-focus discs in front and behind, a camera that drifts and returns. Zara and Dina were tried and removed: their poses did not look organic. Acting is described above |
| signin | the sign-in window | Rho and Dina | Round table, four floating glass screens in a loading state (shapes, no text) turning once per loop, 1440 x 420 (about 3.4 to 1), shown at 120 px high. Keep the characters and the table in the central two thirds: on phones the sides are cropped |

## Related

- [[CHARACTER-AVATARS]]
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
