---
title: Icon system
status: accepted
updated: 2026-10-12
---

# Icon system

> The rules every icon and symbol of the platform is drawn and animated by, the steps to make a new one, and the icons that exist.

> **Status: accepted** (2026-10-11). The owner set the rule (D-054 in [[DECISIONS]]), rejected a first set of line icons, and approved the nine icons below as the level and the style every new icon follows.

## Role

The platform has its own icons. This document is what a person or an agent reads before drawing one, so a new icon looks and moves like the ones the owner approved. The engineering side (the files, the player, loading, reduced motion) is summarized in rule 4 of [[FRONTEND-GUIDE]]; the contract a file must meet is in `frontend/tools/icons/lottie.mjs` and is checked by `npm run icons`.

## Read this when

- A screen needs an icon or a symbol that does not exist yet.
- Changing how an existing icon looks or moves.
- Replacing a library icon in a screen built before the rule (T-012 in [[BUILD-TASKS]]).

## The rule

Every icon and symbol used in the platform is our own: a 2D composition in full color, with no outlines, kept as a Lottie file (`*.json`), that feels in motion and has micro-interactions. No icon comes from an icon library. The owner's example is the measure: a streak is a flame that is burning, not a plain drawing of a fire that looks dead.

Marks that belong to others (Google's, the social networks') are the only exception: they stay as their owners draw them.

## How an icon is drawn

1. **A picture, not a sign.** Draw the thing itself, simplified: a house with a roof, a wall, a door and windows; a wallet with a flap, a clasp and a Seed in it. A symbol made of one line is what the owner rejected.
2. **Filled shapes, no outline.** A shape is told from its neighbor by its color, never by a line around it. A line is used only where the thing drawn is itself a line: a check mark, a smile, the lines of a page.
3. **Round.** A corner is an arc: rectangles have round corners (at least a fifth of their short side; the build refuses less), polygons go through `soft()`, which rounds every corner. The one tip allowed is the tip of a flame.
4. **The brand's colors, a few an icon.** Use the palette `P` at the top of `definitions.mjs` (indigo, deep indigo, pale indigo, orange, red, gold, yellow, cream, sky, mint, pink, white). Three or four colors an icon; one of them carries the meaning (the gold Seed, the mint check). A gradient is welcome on the largest shape to give it volume, top lighter than bottom.
5. **Right on every surface.** An icon keeps its colors on the light page, the dark page and the dark sidebar. So nothing is drawn in a color close to either page: no near-white and no near-black as the main shape. Look at all three in `/dev/icons` before calling it done.
6. **On a 48 grid, inside 4 to 44,** standing on a common foot line near 42 when the thing stands on something. Back to front, at most fourteen layers.
7. **It reads at 20 px.** The menu shows icons at 20 to 32 px. Check the small sizes at the bottom of `/dev/icons`; a detail that turns into noise there is removed.
8. **No words, letters or figures, and no money.** The only currency is the Seed, drawn as the sunflower seed (D-043). Nothing from another brand, film or game.
9. **A plain sign is the exception, not the default.** A chevron or a cross cannot be a picture; those are drawn as a single round stroke in the text color (`ink`) and still move. If a thing can be drawn as a picture, it is.

## How an icon moves

Every icon has three movements, each a named segment of its Lottie file. All three start and end in the rest pose (frame 0), so one follows another without a jump; the build checks it.

| Movement | Length | When it plays | What it is |
|---|---|---|---|
| `idle` | 2 s, a loop | While the icon is alive: what it stands for is on (the current destination of the menu, a streak that is running) | The thing alive, doing what it does: the flame burns, the chimney smokes, the face blinks, the star turns. Never the whole icon merely pulsing |
| `hover` | 0.6 s, once | A pointer enters, or the keyboard's focus reaches, the control the icon is in | A small, quick answer made of a part of the picture: the roof lifts, the page turns, the flap opens |
| `select` | 0.8 s, once | What the icon stands for becomes the current thing | Larger, and it lands: the whole icon pops a little past its size and settles (`POP`), with the meaningful part doing more |

1. **The motion comes from the thing.** Ask what this object does in the world and animate that. A flame changes shape (its outline morphs between poses, each tongue on its own rhythm); smoke rises and fades; a check is drawn.
2. **Parts move, not only the whole.** Each layer has its own pivot and its own keyframes; `root` moves the whole icon when it must (a pop, a bob). An icon whose only motion is a scale of everything is not done.
3. **Offset the parts.** Two things that move in the same icon do not peak on the same frame.
4. **Ease in and out,** with a little overshoot on the way in. A loop that must not pause at each key (a flame, a drift) sets `even: true` on its layer.
5. **Small.** Parts travel a few units of the 48 grid. An icon is a detail on a screen with content; it must not pull the eye from it while idle.
6. **Reduced motion.** A person who asked for less motion sees the rest frame only, so the rest frame alone must say what the icon is.

## Making a new icon

1. Read the nine in `frontend/tools/icons/definitions.mjs`, and look at them moving in `/dev/icons` (dev server). The file's header repeats the rules above next to the code.
2. Add an entry to `ICONS`: a `name` (lowercase words joined by hyphens), an optional `root`, and its `layers` from the back to the front. A layer has one paint (`fill`, `gradient`, `stroke` with a `width`, or `ink`), its `shapes` (`rect`, `circle`, `ellipse`, `path` with M, L, C and Z only, or `morph` for an outline that changes) and what moves (`move`, `scale`, `rotate`, `opacity`, `draw` for a line), each built with `motion(rest, { idle, hover, select })`.
3. Run `npm run icons` in `frontend/`. It writes `src/icons/lottie/<name>.json` and `src/icons/rest.ts`, and fails with the reason if the icon breaks the contract (grid, size, layers, 24 KB, round corners, same number of points in every pose of a morph, every movement back in the rest pose). Never edit the generated files by hand.
4. Look at it in `/dev/icons`: alive, hovered, selected; on the three surfaces; at 20, 24 and 32 px; in light and in dark. Fix what you see and repeat.
5. Use it with `<AppIcon name="..." />`. `active` marks the current destination (it plays `select` once and then stays alive), `alive` keeps the loop running for a thing that is on, `label` gives it a name when it stands alone as information.
6. Add it to the table below, and show it to the owner: a new icon is approved by the owner like a composition is.

## Icons that exist

All nine were approved by the owner on 2026-10-11.

| Icon | The picture | Alive | Hover | Select |
|---|---|---|---|---|
| `streak` | A fire: three tongues of flame, a glow behind, sparks | The tongues change shape, each on its own rhythm; the glow breathes; sparks rise | The fire flares | A taller flare, and it settles |
| `home` | A house: gold wall, indigo roof, door, two lit windows, a chimney | The chimney smokes; the windows flicker | The roof lifts like a lid, the door grows | Pop; the roof jumps |
| `learn` | An open book with a gold star over it | The star turns and twinkles; a glint appears | The right page turns | Pop; the star grows and spins; the lines are written again |
| `mentor` | A speech bubble with a face and a spark | It bobs and blinks; the spark twinkles | It tilts its head and blinks | Pop; wide eyes, a blink, the smile is drawn |
| `wallet` | A wallet with a clasp and a golden Seed in it | The Seed bobs; the stud pulses | The flap opens and the Seed jumps | Pop; a higher jump |
| `tasks` | A clipboard with a sheet and a mint check | The check is drawn again and again | It tilts; the check is redrawn | Pop; the check is redrawn and grows |
| `family` | Two grown-ups and a child in front of them | The grown-ups sway; the child hops a little | They lean in; the child jumps | Pop; a higher jump |
| `chevron` | A plain sign in the text color, pointing left (the page turns it for other directions) | None | It nudges the way it points | A longer nudge |
| `close` | A plain sign in the text color: two strokes that cross | None | A quarter turn and back | A half turn and back |

## Related

- [[FRONTEND-GUIDE]]: rule 4, and how the files, the player and loading work.
- [[UI-LIBRARIES]]: the player, `lottie-web` in its light build.
- [[DESIGN-SYSTEM]]
- [[SECURITY-GUIDE]]: why the player has no `eval`.
- [[BUILD-TASKS]]: T-012.
- [[DECISIONS]]: D-054, D-043, D-051.

Back to [[INDEX]].

## Update this document when

- An icon is added, changed or removed.
- The owner changes a rule of how icons look or move.
- The contract in `tools/icons/lottie.mjs` changes.
