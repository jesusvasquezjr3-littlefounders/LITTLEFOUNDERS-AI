# AGENTS.md — frontend

> Domain rules for this service. Root rules: [/AGENTS.md](../AGENTS.md). Context: [agent/core/CONTEXT.md](../agent/core/CONTEXT.md).

## Mission

The SPA: the four product sections (learn, tutor, tasks, profile). Talks ONLY to backend (Core) — plus Supabase Auth for sessions. Deployed on Vercel.

## Invariants that bite here

- **/DESIGN.md is AUTHORITATIVE** (LittleFounders Liquid Glass). Tokens live in `tailwind.config.js` + `src/index.css` CSS vars — never add values those files/DESIGN.md don't define. Type ONLY via the closed `lf-*` scale (`lf-display-xl`…`lf-caption`, Inter + Sora). Build UI with the kit in `src/components/ui/` (Button, Icon, Card, IconChip, Dropdown, ThemeToggle, ProgressBar, Badge, StatCard) — no per-view restyling. Elevation ONLY via the liquid-glass set (`shadow-glass*`, `shadow-pop`, `.lf-glass`, `.lf-glass-deep`) — frosted translucent panels with backdrop-blur, subtle light borders, and layered soft shadows; flat opaque surfaces and raw hex are prohibited. Icons: Material Symbols via `<Icon name="…"/>` — never emojis (except country flags in the language switcher, DESIGN.md's one exception).
- **No native pickers**: never `<select>`, `<input type="date">`, etc. as a choice control — always `Dropdown` or a purpose-built component (`ThemeToggle`).
- **Action Color Contract (/DESIGN.md §Colors) is NON-NEGOTIABLE**: every button/action's color is chosen by what it DOES, not by taste — `primary`/`accent` variant = the ONE main CTA (indigo fill), `secondary` (alternative/lower emphasis, outlined), `success` (positive completion), `danger` (destructive/irreversible). Indigo (`primary` token) is for links/focus/info. `delight` (violet) and `warning` are status/celebration only, never button fills.
- **COMPOSITION FIDELITY (/DESIGN.md §0):** build from **/DESIGN.md §Screen Recipes** — they are the single composition source (there is no mockup directory). Deviating without human sign-off is a design bug; if a recipe is ambiguous, fix the recipe in the same commit.
- **Motion is a closed system** (/DESIGN.md §Motion): only the five recipes (page transition via layout, `<Reveal>` scroll reveal with ≤3×80ms stagger, `.lf-pop` panels, press physics, arrow nudge) with `--lf-ease`/`--lf-dur-*` tokens. `.lf-float` is the only infinite animation. Everything reduced-motion safe (wired in index.css).
- **i18n zero tolerance** (§1.8): every string via `t()`. Locales are DIRECTORIES of route-area fragments — `src/i18n/{en-US,es-MX,pt-BR}/{common,marketing,errors,…}.json` — assembled in `src/i18n/index.ts` (fragment name ⇒ key prefix; `common` spreads at the root). A new key (or fragment file) lands in all three locale dirs in the same commit. Gate: `npm run i18n:check` (root) — checks file-set AND per-file key parity.
- **End-User UI Cleanliness & Copy Protocol (NON-NEGOTIABLE)**: The UI must be clean, direct, clear, and designed exclusively for the END USER. The characters `—` (em-dash, U+2014), `§` (section symbol, U+00A7), and `—` (punctuation dash variants) are **PROHIBITED** in all user-facing text: UI component strings, JSX text nodes, i18n translation values, email template body copy, aria-labels, and fallback states. These are AI-system artifacts, not human-readable content. Use commas, periods, colons, or sentence breaks instead. Also NEVER include internal spec/doc references (e.g. `(§1.9)`, `(§1.3)`, `(0025)`), developer implementation notes, or other AI text artifacts (double dashes `--`, prefix colons). Keep all copy professional, functional, user-centric, and free of system-origin glyphs.
- **Design tokens are CHANNELS, not colours.** `--lf-primary` holds `79 70 229`, so anywhere a raw CSS/SVG colour is required — recharts props, SVG `fill`/`stroke`, `color-mix()`, gradient `stopColor` — it MUST be wrapped: `rgb(var(--lf-primary))`. A bare `var(--lf-outline)` is an invalid colour and SVG silently falls back to BLACK, which is invisible on a dark surface and survives review because the surrounding data still renders. Every axis, grid line and gradient in the intelligence console shipped this way.
- **Dark mode at write time**: every component styles `dark:` variants. Never light-only.
- **Characters are canonical assets**: Dina, Liruf, Dr. Rho, Zara Vex (`src/components/characters/`). Reuse; no new mascots without sign-off. Animate them ONLY through Character Control (`characters/control/` — `CharacterActor` + `lf-rig-*` hooks, /LESSON_ENGINE.md §9): never edit SVG geometry/colors, never animate the RAF-owned head/pupil groups.
- **Lesson Engine** (`src/lesson-engine/`): /LESSON_ENGINE.md is authoritative (taxonomy, document contract, grading, session). Exercises build ONLY from `lesson-engine/core/primitives.tsx`; new types follow the §11 extension protocol (family slice + registry, never cross-family edits). Answer keys are server-only — `stripAnswers()` before anything client-persistent; the local grader is dev-lab-only. QA surface: `/dev/lesson-lab` (dev builds).
- API calls expect the envelope; error codes map to `errors.api.<code>` i18n keys.
- **A value used as a `useEffect` dependency MUST have a stable identity.** `x ?? {}` / `x ?? []` computed during render is a render-loop generator: the fallback is a new object every render, so the effect re-runs, `setState`s, re-renders, and never stops. Hoist the fallback to a module-level constant, and have state updaters return the PREVIOUS value when nothing actually changed. `PipelineFlow` shipped exactly this (`heartbeat?.stageBreakdown ?? {}`) and looped in the page's DEFAULT state — no active run, nothing to render, i.e. the state every admin lands in.
- **The insights beacon (`lib/insights.ts`, /INSIGHTS.md) is the ONLY sanctioned usage-telemetry path.** Never add a tracker to kid-reachable surfaces, never call `trackInsight` with anything outside the closed enums, and never bypass `configureInsights`'s enabled gate — an unconsented kid's browser must not even TRANSMIT (Core drops server-side regardless, but minimization starts at the client). A new event = extending the enum in 0023 + Core + `lib/insights.ts` together, and that is a §1.9 review, not a quick edit.
- **Supabase Realtime authorizes ONCE, at subscribe time.** Any long-lived subscription needs proactive re-auth (`realtime.setAuth` on an interval well under the token lifetime) plus a resubscribe path on `CHANNEL_ERROR`/`TIMED_OUT`. Without both, a tab left open past the JWT's lifetime loses the channel permanently and then renders as idle — indistinguishable from a genuinely idle backend, so the failure is invisible instead of loud (`routes/admin/LiveStats.tsx`).
- a11y floor: semantic elements, focus-visible, ≥44×44px hit areas (`min-h-11 min-w-11`).
- Never import from internal services — backend only.
- **Responsive is NON-NEGOTIABLE** (/AGENTS.md §1.11, /DESIGN.md §Layout → *Responsive Adaptation*): every screen and component MUST work at Desktop (≥1024px) AND Mobile (<768px). No frontend task is done until verified in-browser at both ~375px and ~1280px — screenshot both. Desktop must use the freed width deliberately (sidebar, multi-column) — never a stretched mobile column.
- **Global Theme Transition is NON-NEGOTIABLE**: Every color, background, and border change across the app must transition smoothly when switching themes. This is enforced globally in `index.css` via `transition-property: background-color, border-color, color, fill, stroke;`. Do not override this behavior globally, and ensure all theme changes respect this smooth fading animation.

## Layout

`src/routes/` (pages + Layout) · `src/components/` (shared; characters live here) · `src/lesson-engine/` (core/ · families/ · player/ · lab/ · registry/schema — see /LESSON_ENGINE.md) · `src/i18n/` (3 locale dirs of fragment JSONs + init) · `src/theme/` (dark-mode hook) · `src/lib/` (utils).

**Admin sections** live in `src/routes/admin/`: 9 pages gated behind `admin`/`superadmin` via `<RequireRole role={STAFF}>`. The admin nav registry is `adminNav.ts` (rendered as a "Staff" group in the app sidebar). Key pages: Overview, Content (merged courses + moderation), Users (stats bar + signup timeline), Emails (Resend-style dashboard), Analytics & Health, Generation, Intel (Data Intelligence — 9-tab console, `/DATAINTEL.md` §7), Audit, Roles (superadmin-only). Shared building blocks in `adminShared.tsx`. The Staff group is HIDDEN for non-staff (never shown as a locked section).

## Read before touching

- `/DESIGN.md` — current rules + what's locked (modes, characters, a11y floor).
- `agent/prompts/templates/new-component.md` — the component protocol.
- Skills: `impeccable`, `agave`, `emil-design-eng` apply to all UI work here.

## Tutor 3D scene (`src/tutor-scene/`)

The Tutor's stage is 3D for EVERY user (owner decision 2026-08-15, recorded in
ROADMAP.md) — it is never gated by role or device class. Stack: `three` +
`@react-three/fiber` **v8**; drei is deliberately absent (its React-18 line is
frozen and would pin `three` backwards, and it weighs more than the ~150 lines
it would save). R3F v9 / drei v10 require React ≥19 and are unusable here.

Rules that bite:

- **`three` must only ever be reached through a lazy route.** `TutorPage` and
  the scene lab are `lazy()` imports; a static import anywhere in the eager
  graph would put ~285 kB gzipped into the entry bundle of every marketing
  page. Verified after each build: `WebGLRenderer` must appear in the
  `TutorScene-*` chunk and NOT in `index-*`.
- **Quality is measured, never assumed.** `quality.ts` picks a starting tier
  from a device probe; `governor.ts` — a PURE reducer, deliberately outside
  React — steps it from real frame times. Never move tier transitions back
  into a `setState` updater: StrictMode double-invokes those, and the side
  effects latched the tier after one demotion instead of two.
- **A device that reports nothing is not a weak device.** `deviceMemory` is
  Chromium-only; treating absent as zero would push every Safari and Firefox
  user onto the degraded tier (§1.14).
- **Placement is solved from geometry, never authored.** Ground height comes
  from a downward raycast (`ground.tsx`) and standing positions from
  `standingSpots.ts`. Hand-tuned coordinates do not survive the second
  diorama — they put a character on top of the stone table on the first one.
- **But geometry says how a surface BEHAVES, never what it IS — and that gap
  stood the whole cast in a pond.** Water is the flattest, most open surface a
  diorama has, so on `diorama-b` it outscored every patch of grass. Meaning
  comes from `walkability.ts`, a mask baked per island by
  `npm run assets:walkmask` and applied as a HARD gate. A missing mask returns
  `null`, never a permissive default: "nobody checked this island" is exactly
  the state diorama-b was in. Run `npm run verify:placement` after touching
  placement, an island, or a character's measurements — it runs the real solver
  against the real meshes and reports what each character would stand on.
- **A new island needs its mask baked before it can ship.** `assets:walkmask`
  is not part of `assets:3d`; adding a diorama means running it and committing
  `walkMasks.generated.json` in the same commit.
- **Lighting lives in code, never baked into the .glb.** DESIGN.md mandates
  light AND dark mode, so an asset lit at export time is wrong in one of them
  by construction. Baked ambient occlusion in textures is fine; baked
  lightmaps are not.
- **Assets are budgeted in code** (`budget.ts`), measured against real exports
  by `/dev/scene-lab` and `npm run assets:3d`, and served from Depot's public
  `tutor-scenes` bucket in deployed environments (`VITE_SCENE_ASSET_BASE`).
  Source exports live outside the repo; only optimized output is published.

- **`VITE_SCENE_ASSET_BASE` is not enough on its own.** Depot is CONTENT
  ADDRESSED — `/files/:bucket/:hash.:ext`, "independent of the uploader's
  original filename" — so a deployed build asks for the sha256, never for
  `rho.glb`. `npm run publish:scenes` uploads and writes
  `sceneManifest.generated.json`, which is committed and is build input. Set the
  variable only after that manifest is merged, or the resolver throws for every
  asset. Full sequence: /TUTOR_3D.md §3.2–§3.3.

- **Changing a Vercel env var does NOT change a deployed bundle.** This project
  has no Git integration on Vercel: `frontend-cd.yml` runs `vercel pull`,
  `vercel build` ON THE CI RUNNER, then `vercel deploy --prebuilt`. A dashboard
  "Redeploy" re-serves the same prebuilt output — it finishes in ~3 seconds,
  which is the tell — and Vite inlines `import.meta.env.*` at build time.

- **`frontend CI` is PATH-FILTERED, and CD hangs off it.** It runs on `main`
  only for `frontend/**`, `database/types/**` or its own workflow file, and
  `frontend CD` triggers on that workflow completing. A commit that touches
  only root-level docs therefore deploys NOTHING. Learned by pushing exactly
  that and waiting for a deploy that was never going to start.

- **The mouth is a CARD, and it has to be.** No facial bone exists on any
  export AND the mouths are painted into the texture, so there is nothing to
  deform — blendshapes would stretch a decal. Sliding the mouth region's UVs is
  equally impossible: the exports carry a per-facet shattered UV atlas (two
  points 4 cm apart on Zara's face resolve to (0.096, 0.153) and
  (0.447, 0.300)), so there is no mouth island to slide. `MouthCard.tsx`
  parents a fitted grid to the `Head` joint and swaps an 8-frame atlas by
  texture offset. Details and the per-character status: `/TUTOR_3D.md` §7.1.
- **A card's skin colour comes from the ALBEDO, never from a render.** Blender's
  view transform darkens and desaturates, so a card matched to a rendered pixel
  is wrong under the app's own lighting. Resolve the UV under the face and
  sample the source texture.
- **The card geometry is baked, and it is not flat.** The face bulges ~1.6 cm
  forward across the mouth's 8.6 cm width, so a flat quad stands off the cheek
  at its corners — fine head-on, obvious once the camera orbits, and this
  camera orbits continuously. Refit with `scripts/fit-mouth-card.py` rather
  than hand-editing `mouthCards.generated.json`.
- **The atlas texture must not mipmap.** Eight frames sit edge to edge, and
  minification blends a frame into its neighbour — the mouth smears into the
  next viseme as the character gets smaller.
- **A WebGL canvas has an intrinsic size, so its container needs `min-w-0`.**
  R3F writes width/height ATTRIBUTES onto the `<canvas>`, which gives a grid or
  flex item a min-content width it refuses to shrink below. The scene therefore
  GREW with the viewport but never shrank: going from a 1540 px viewport to
  659 px left a 760 px canvas and a 780 px document, i.e. a horizontally
  scrolling page, which §1.11 forbids. A phone rotating to portrait is the same
  event. `SceneCanvas` now carries `min-w-0 [&_canvas]:max-w-full`; any grid
  item wrapping it needs `min-w-0` too.
- **Check responsive behaviour by SHRINKING, not only by loading narrow.** A
  reload at the target width hid this bug completely — the layout was correct
  every time it was built from scratch and wrong only when it had to give width
  back.
- **The mouth card is UNLIT, and that is a known compromise.** Every lit
  material renders it solid black over the mouth while the same material with a
  flat colour and no map lights up correctly — the lights reach it, its normals
  point outward, it is excluded from shadow mapping and it is front-side only.
  The failure is isolated to "lit shader + this map" and the root cause is not
  found. Unlit is shippable because the atlas is painted with the character's
  own albedo, but it will not darken with the face in dark mode.
- **An authored clip and the procedural driver must never run in the same
  frame.** An `AnimationMixer` writes ABSOLUTE bone orientations, so `resetRig`
  erases the clip and the procedural action fights it per bone — which reads as
  jitter, not as a bug. Emotion still composes over a clip because it is a
  RELATIVE offset (`applyEmotionPosture`).
- **Decide "biped or quadruped" from STATE, not from a ref read during render.**
  `rig.current` is a ref: mutating it does not re-render, so a memo that picks a
  clip keeps whatever it computed on the first pass — when the rig is still
  null and everything looks like a biped. Dina would be handed clips authored
  for a skeleton she does not have.

Asset pipeline: `npm run assets:inspect -- <file.glb>` (read-only report) →
`npm run assets:3d -- <in.glb> <out.glb> [--max-triangles=N]` (meshopt +
texture compression + optional decimation, with a hard rig-integrity gate) →
`npm run assets:mouth` (viseme atlases). All outputs land in the gitignored
`public/scenes/`.
