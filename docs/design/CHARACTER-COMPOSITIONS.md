---
title: Character compositions
status: accepted
updated: 2026-10-09
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

The tools are in `frontend/tools/render/` and are run by hand (`npm run render:signin`). The scene is a page (`signin-scene.html` and `.js`) that draws the frame for any second `t`; `render-signin.mjs` serves it with three.js and the source models, captures every frame in headless Chrome, and `encode.py` encodes them with Blender's bundled FFmpeg. No dev server is needed. `--still 0,3,6` writes PNGs to `frontend/audit-out/` to look at before a full run. Prerequisites: Chrome, Blender (`BLENDER=<path>`), and `three`, a development dependency used only by these tools. Output: `frontend/public/landing/<scene>/<scene>-<mode>.mp4` and `-poster.webp`.

Rho is animated from the shared clip library with rotations only, added on top of his own pose, because the library was authored on another skeleton's rest pose ([[CHARACTER-POSES]]). Dina plays her own clip.

## Scenes that exist

| Scene | Where | Characters | Notes |
|---|---|---|---|
| hero | landing hero | Rho and Zara | Rendered by tools that are not in the repository any more; the files in `public/landing/hero/` are the approved result |
| problem | landing problem section | Liruf and Dina | Same |
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
