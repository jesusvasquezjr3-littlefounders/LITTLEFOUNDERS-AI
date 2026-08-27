# AGENTS.md — frontend

> Domain rules for this service. Root rules: [/AGENTS.md](../AGENTS.md). Context: [agent/core/CONTEXT.md](../agent/core/CONTEXT.md).

## Mission

The SPA: the four product sections (learn, tutor, tasks, profile). Talks ONLY to backend (Core) — plus Supabase Auth for sessions. Deployed on Vercel.

## Invariants that bite here

- **/DESIGN.md is AUTHORITATIVE** (LittleFounders Liquid Glass). Tokens live in `tailwind.config.js` + `src/index.css` CSS vars — never add values those files/DESIGN.md don't define. Type ONLY via the closed `lf-*` scale (`lf-display-xl`…`lf-caption`, Inter + Sora). Build UI with the kit in `src/components/ui/` (Button, Icon, Card, IconChip, Dropdown, ThemeToggle, ProgressBar, Badge, StatCard) — no per-view restyling. Elevation ONLY via the liquid-glass set (`shadow-glass*`, `shadow-pop`, `.lf-glass`, `.lf-glass-deep`) — frosted translucent panels with backdrop-blur, subtle light borders, and layered soft shadows; flat opaque surfaces and raw hex are prohibited. Icons: Material Symbols via `<Icon name="…"/>` — never emojis, no exceptions. Country flags (language switcher) are real SVGs via `<LocaleFlag locale="…"/>` (`components/ui/LocaleFlag.tsx`), not emoji: Windows ships no glyphs at all for the regional-indicator emoji pairs a flag emoji is made of, so the old emoji carve-out rendered as boxes or nothing on every non-macOS platform.
- **Dates are `DateField`, never a text box with a date-shaped regex.** Three numeric segments that advance themselves, emitting the ISO string callers already expect - and `''` for anything incomplete OR impossible, so "half typed" can never be mistaken for "valid". It validates a REAL calendar date by round-tripping through `Date`, which is what rejects 31 February (the constructor rolls it forward, so the parts coming back out no longer match). What it replaced was one field, `^\d{4}-\d{2}-\d{2}$` and the placeholder "1988-02-14": an internal format asked of a parent, with no help while typing and a rejection only after the fact, on a phone, at the most expensive moment in the funnel.
- **A component whose displayed value can differ from the value it EMITS must hold its own state, not a ref.** `DateField` emits `''` while a date is incomplete, so the parent re-sets the same `''` and React bails out of re-rendering - held in a ref, the typed digits were never painted and every box looked empty until the third segment completed. The first version did exactly that and three tests caught it.
- **No native pickers**: never `<select>`, `<input type="date">`, etc. as a choice control — always `Dropdown` or a purpose-built component (`ThemeToggle`).
- **Action Color Contract (/DESIGN.md §Colors) is NON-NEGOTIABLE**: every button/action's color is chosen by what it DOES, not by taste — `primary`/`accent` variant = the ONE main CTA (indigo fill), `secondary` (alternative/lower emphasis, outlined), `success` (positive completion), `danger` (destructive/irreversible). Indigo (`primary` token) is for links/focus/info. `delight` (violet) and `warning` are status/celebration only, never button fills.
- **The auth surface has ONE shell, `routes/auth/AuthShell.tsx`, and `AuthRecipe.test.tsx` is what keeps it that way.** Every `*Page.tsx` under `routes/auth/` renders `<AuthShell>`; cross-links use the exported `AUTH_LINK_CLASS`, never a colour of their own. A second shell (`AuthSplit`, two columns over a full-bleed photo) once took over /login, /signup, /forgot-password and /reset-password while /verify-parent and /upgrade-account stayed compliant, and every gate stayed green for weeks because the recipe existed only in a document. If a recipe matters, a test has to read the source and say so.
- **A page-level layer must never hard-code a light or dark surface.** The auth layout forced `text-on-inverse` over a scrimmed photograph, so a visitor in light mode still got a dark page - the theme they had chosen stopped applying at exactly the screen where they were asked to type a password. Page chrome uses `bg-base` / `text-content` and lets the tokens resolve; the only surfaces that name a side are the ones DESIGN.md says are inverse.
- **COMPOSITION FIDELITY (/DESIGN.md §0):** build from **/DESIGN.md §Screen Recipes** — they are the single composition source (there is no mockup directory). Deviating without human sign-off is a design bug; if a recipe is ambiguous, fix the recipe in the same commit.
- **Motion is a closed system** (/DESIGN.md §Motion): only the five recipes (page transition via layout, `<Reveal>` scroll reveal with ≤3×80ms stagger, `.lf-pop` panels, press physics, arrow nudge) with `--lf-ease`/`--lf-dur-*` tokens. `.lf-float` is the only infinite animation. Everything reduced-motion safe (wired in index.css).
- **Page metadata is built, never mounted.** Titles, descriptions, Open Graph, canonical and JSON-LD are written into per-route HTML at build time by `scripts/seo/build-seo.mjs` from `scripts/seo/site.mjs`. Do NOT add a client-side SEO library or set these from a component: the consumers they exist for — every social unfurler, almost every AI crawler, most scrapers — do not execute JavaScript, so a tag added on mount reaches none of them. Adding or renaming a marketing route means editing `site.mjs` in the same commit; `npm run seo:check` fails the build if it disagrees with `MARKETING_PREFIXES`, and `npm run seo:live` asserts what production actually serves. Not being indexed is the DEFAULT — the SPA fallback (`app-shell.html`) is `noindex`, and only pages declared in `site.mjs` opt in. **The same file is also what AI assistants repeat about us** (`ELEVATOR`, `SUBJECTS`, `MENTORS` → `llms.txt` and the schema.org `Course` graph), so a change to what the product IS — a course, an age range, a language, the headline claim — goes here in the same commit or answer engines keep recommending a product we no longer have (/AGENTS.md §1.15).
- **i18n zero tolerance** (§1.8): every string via `t()`. Locales are DIRECTORIES of route-area fragments — `src/i18n/{en-US,es-MX,pt-BR}/{common,marketing,errors,…}.json` — assembled in `src/i18n/index.ts` (fragment name ⇒ key prefix; `common` spreads at the root). A new key (or fragment file) lands in all three locale dirs in the same commit. Gate: `npm run i18n:check` (root) — checks file-set AND per-file key parity. **`<html lang>` follows the learner**, published by `src/i18n/index.ts` at init and on every `languageChanged` — never by a component effect, because the attribute must be right for the first paint and for consumers that never mount one. It is not cosmetic: a screen reader picks its VOICE from it, so a stale `lang="en"` had Spanish content read aloud by an English synthesiser. `i18n:check` cannot see this (it checks keys, not the document); `src/i18n/documentLanguage.test.ts` does.
- **End-User UI Cleanliness & Copy Protocol (NON-NEGOTIABLE)**: The UI must be clean, direct, clear, and designed exclusively for the END USER. The characters `—` (em-dash, U+2014), `§` (section symbol, U+00A7), and `—` (punctuation dash variants) are **PROHIBITED** in all user-facing text: UI component strings, JSX text nodes, i18n translation values, email template body copy, aria-labels, and fallback states. These are AI-system artifacts, not human-readable content. Use commas, periods, colons, or sentence breaks instead. Also NEVER include internal spec/doc references (e.g. `(§1.9)`, `(§1.3)`, `(0025)`), developer implementation notes, or other AI text artifacts (double dashes `--`, prefix colons). Keep all copy professional, functional, user-centric, and free of system-origin glyphs.
- **Design tokens are CHANNELS, not colours.** `--lf-primary` holds `79 70 229`, so anywhere a raw CSS/SVG colour is required — recharts props, SVG `fill`/`stroke`, `color-mix()`, gradient `stopColor` — it MUST be wrapped: `rgb(var(--lf-primary))`. A bare `var(--lf-outline)` is an invalid colour and SVG silently falls back to BLACK, which is invisible on a dark surface and survives review because the surrounding data still renders. Every axis, grid line and gradient in the intelligence console shipped this way.
- **Dark mode at write time**: every component styles `dark:` variants. Never light-only.
- **Two surfaces sharing one character render share its ART DIRECTION, so re-posing for one silently re-poses the other.** /how-it-works had block 2 and the mentor grid both reading `mentor-zara.webp`; posing her to face the decision card would have turned her sideways in a line-up of four mentors standing evenly, where facing the viewer IS the composition. A pose that carries meaning for one block gets its OWN file (`zara-presents.webp`), named for what it does rather than who it is, with a comment at the reader saying why the two are not interchangeable - they look similar enough to be collapsed back together by anyone tidying up.
- **Read a rig's axis conventions off a contact sheet; never reason about them.** These exports do not agree on which local axis swings an arm out or turns a head, and a wrong guess costs a full capture cycle. Sweep the candidate bone/axis/sign combinations, tile the results, and pick by looking - Zara's presenting pose came from two throwaway sheets (yaw direction, then arm and head axes) before a single final frame was rendered. Poses are still composed onto SNAPSHOTTED bind quaternions, never `Skeleton.pose()`.
- **Characters are canonical assets**: Dina, Liruf, Dr. Rho, Zara Vex (`src/components/characters/`). Reuse; no new mascots without sign-off. Animate them ONLY through Character Control (`characters/control/` — `CharacterActor` + `lf-rig-*` hooks, /LESSON_ENGINE.md §9): never edit SVG geometry/colors, never animate the RAF-owned head/pupil groups.
- **Lesson Engine** (`src/lesson-engine/`): /LESSON_ENGINE.md is authoritative (taxonomy, document contract, grading, session). Exercises build ONLY from `lesson-engine/core/primitives.tsx`; new types follow the §11 extension protocol (family slice + registry, never cross-family edits). Answer keys are server-only — `stripAnswers()` before anything client-persistent; the local grader is dev-lab-only. QA surface: `/dev/lesson-lab` (dev builds).
- API calls expect the envelope; error codes map to `errors.api.<code>` i18n keys.
- **A value used as a `useEffect` dependency MUST have a stable identity.** `x ?? {}` / `x ?? []` computed during render is a render-loop generator: the fallback is a new object every render, so the effect re-runs, `setState`s, re-renders, and never stops. Hoist the fallback to a module-level constant, and have state updaters return the PREVIOUS value when nothing actually changed. `PipelineFlow` shipped exactly this (`heartbeat?.stageBreakdown ?? {}`) and looped in the page's DEFAULT state — no active run, nothing to render, i.e. the state every admin lands in.
- **A field a user is REQUIRED to give must be used by the thing it is collected for.** Guardian verification demanded a home address, Zod validated it, Core persisted it - and it never left Core: `parent-id-check/` has no occurrence of the word, and the verdict is exactly `documentReadable`, `nameMatch`, `birthDateMatch`, `notExpired`. Nothing ever read the column back. Before adding a field to any PII form, trace it to the consumer that acts on it; if there is none, it is not a form field, it is a liability (§1.9). The form now collects four things and every one of them is matched against the document.
- **The insights beacon (`lib/insights.ts`, /INSIGHTS.md) is the ONLY sanctioned usage-telemetry path.** Never add a tracker to kid-reachable surfaces, never call `trackInsight` with anything outside the closed enums, and never bypass `configureInsights`'s enabled gate — an unconsented kid's browser must not even TRANSMIT (Core drops server-side regardless, but minimization starts at the client). A new event = extending the enum in 0023 + Core + `lib/insights.ts` together, and that is a §1.9 review, not a quick edit.
- **A Supabase channel TOPIC is a key in a registry that OUTLIVES your component - never reuse a fixed one.** `supabase.channel(topic)` returns the EXISTING channel when the topic is already registered, `.on('postgres_changes', ...)` on an already-subscribed channel THROWS, and `removeChannel` is ASYNC, so the topic is still registered when an un-awaited teardown is followed by a re-subscribe. The client is a module singleton (`lib/supabaseRealtime.ts`), so a remount, a StrictMode double-mount or a retry all re-enter with the topic still there. Derive a fresh topic per attempt from a MODULE-scoped counter (a per-instance one repeats across mounts), assign the channel reference BEFORE anything in the chain can throw, and await removal before re-subscribing. This latched: the throw landed mid-chain so the reference was never assigned, so cleanup had nothing to remove, so every later attempt threw too and the admin Live Monitor lost its push transport for the rest of the browser session.
- **`void someAsyncFn()` inside an effect is an unhandled rejection waiting to happen, and an accelerator that fails must SAY so.** Wrap it in a function that catches, and route the failure to a state the UI can render. `!realtimeConnected` was not that state: it is also the normal state while connecting and the permanent state wherever the Supabase env vars are not deployed, so a subscription that actively threw was indistinguishable from a healthy fallback. A distinct `realtimeFailed` transport label exists for exactly this (/AGENTS.md §1.14 - failure must be distinguishable from emptiness).
- **A unit test must not reach real infrastructure, and `.env` is loaded in test mode too.** `getSupabaseClient()` reads `VITE_SUPABASE_URL` / `_ANON_KEY`, so any suite mounting a Realtime consumer without mocking `@/lib/supabaseRealtime` builds a real client and opens a real websocket on a developer machine, while taking a different code path entirely on CI where those variables are absent. A test whose behaviour is decided by a file that is not in git is not flaky, it is two tests.
- **Supabase Realtime authorizes ONCE, at subscribe time.** Any long-lived subscription needs proactive re-auth (`realtime.setAuth` on an interval well under the token lifetime) plus a resubscribe path on `CHANNEL_ERROR`/`TIMED_OUT`. Without both, a tab left open past the JWT's lifetime loses the channel permanently and then renders as idle — indistinguishable from a genuinely idle backend, so the failure is invisible instead of loud (`routes/admin/LiveStats.tsx`).
- a11y floor: semantic elements, focus-visible, ≥44×44px hit areas (`min-h-11 min-w-11`).
- Never import from internal services — backend only.
- **Responsive is NON-NEGOTIABLE** (/AGENTS.md §1.11, /DESIGN.md §Layout → *Responsive Adaptation*): every screen and component MUST work at Desktop (≥1024px) AND Mobile (<768px). No frontend task is done until verified in-browser at both ~375px and ~1280px — screenshot both. Desktop must use the freed width deliberately (sidebar, multi-column) — never a stretched mobile column.
- **NEVER ask a rig to reconstruct its own rest pose - COPY the rest pose before touching it.** `Skeleton.pose()` rebuilds each bone from its inverse bind matrix in WORLD space and decomposes back to local, and the Meshy character exports carry a 0.01 scale on the node above the rig, so that round trip does not survive: the mesh collapses to a point. It is silent to every matrix-based check - a projection of the bounding box still reports the character filling the frame while the renderer draws him six pixels tall, because the projection reads matrices and the renderer reads the SKINNED result. Snapshot each bone's `quaternion` at load and restore from that copy, then COMPOSE deltas onto it (`quaternion.multiply`), never assign over it - assigning discards the bind orientation the skin was authored against and shreds the mesh, which is the same lesson in the other direction.
- **A measurement of a shared object must not read anything ABOVE the object.** `Box3.setFromObject` is WORLD-space, so measuring a model that already hangs from a moved pivot returns the box of wherever it currently is, and subtracting that world centre from a LOCAL position is a different quantity entirely. It is correct on the first call and wrong on every later one, which is exactly the shape that survives review: in the marketing capture harness it made orienting one character move two others, and the overlap report changed for a pair nobody had touched. Measure once, while nothing above it is transformed, and cache the result.
- **A VOICED narration line cannot be reworded on its own - that is a PAID regeneration, not a copy edit.** Every key in `guided-voice/cast.json` has a synthesised clip recorded in `guided-voice/manifest.json` together with the exact text it was made from, and `speak()` REFUSES a clip whose text no longer matches the subtitle, so a reworded line goes SILENT rather than lying. The manifest is generated (`oracle/scripts/pregenerate-guided-voice.ts`), must cover every cast key in every locale, and is never hand-edited - so there is no partial state to land in: either the wording and the audio move together, or the wording stays. This bites the em-dash rule above directly, and it already has: an en-US cleanup pass orphaned four clips (Liruf's name prompt and Dr Rho's/Zara's placement lines) and the only symptom was `guided-voice/__tests__/cast.test.ts` going red. Before touching `onboarding.narration.*` or `placement.narration.*`, check `cast.json`; if the key is there, the edit needs the generator re-run and that costs money and needs sign-off.
- **Marketing renders come from the ARTIST SOURCE at maximum quality; the Tutor keeps its budget; and anything a capture borrows is a LOAN.** Owner rule 2026-08-25. Stills and clips for `routes/marketing/` are captured off `/glb/*.glb` on the `high` tier and supersampled, because a picture has no frame budget - the optimized builds in `public/scenes/` are the Tutor's alone. Both directions are defects: shipping the runtime build into a still bakes in a compromise it never needed, and leaving `quality.ts` or `public/scenes/` raised after a capture charges every learner forever for one image. `public/` is copied wholesale into `dist/`, so source exports parked there DEPLOY. Put it all back in the same session and check `git status` before you finish. The Landing diorama itself is a VP9-alpha `<video>` gated by `routes/marketing/alphaVideo.ts` - see that file before changing the format, the probe is not optional.
- **A marketing CTA's DESTINATION is part of the copy around it, and there is exactly ONE acquisition button.** `routes/marketing/PrimaryCta.tsx` owns the guest-start path for every public page: it fires `guest_start` BEFORE the await, calls `startGuestSession()`, navigates to `/onboarding`, and surfaces the failure. Never hand-roll a second one, and never point a "start without an account" CTA at `/signup` - `/onboarding` sits behind `RequireAuth`, so starting without an account is a BEHAVIOUR, not an href. §1.13 still applies: `guestLabel` re-words the visitor branch only, and a signed-in visitor always gets "continue where you left off" pointing at the dashboard.
- **A key BUILT AT RUNTIME is invisible to `npm run i18n:check` - pin it with a test.** The gate verifies key-set parity between locales and statically decidable `t()` calls; it says so in its own output. Anything of the form ``t(`a.b.${x}.c`)`` passes it whatever the files are named, so a rename ships the literal key string to a user with every gate green. If you add one, add a test that renders the surface and asserts each resolved value differs from its key AND appears on screen (`App.test.tsx`, "resolves every dynamically built key").
- **An asset's ASPECT RATIO is a responsiveness decision (§1.11).** One wide composition is not a cheaper version of several square ones: a 2.5:1 group shot in a single column puts each subject at roughly 90px on a 375px phone, and no CSS undoes it because the subjects are baked into one image. Prefer per-subject stills trimmed to their own ink and re-padded to a square, which lets subjects of very different real heights share a grid cell without cropping - and prefer a CSS float over a video loop for idle motion, because four `<video>` elements cost four decoders for movement nobody can distinguish.
- **A `fullPage` screenshot is not evidence, and neither is a scroll-walk with a fixed bound.** Verify marketing routes with per-viewport captures: `fullPage` composites layers that were never on screen and has reported a fully rendered section as blank. When walking the page to fire `<Reveal>`, re-read `document.body.scrollHeight` EVERY step - lazy images and the atlas canvas grow the document after the walk starts, so a height sampled once stops it half way and photographs later blocks at opacity 0. Confirm against the DOM (`getComputedStyle(...).opacity`, `innerText`) before believing a capture.
- **Global Theme Transition is NON-NEGOTIABLE**: Every color, background, and border change across the app must transition smoothly when switching themes. This is enforced globally in `index.css` via `transition-property: background-color, border-color, color, fill, stroke;`. Do not override this behavior globally, and ensure all theme changes respect this smooth fading animation.

## Layout

`src/routes/` (pages + Layout) · `src/components/` (shared; characters live here) · `src/lesson-engine/` (core/ · families/ · player/ · lab/ · registry/schema — see /LESSON_ENGINE.md) · `src/i18n/` (3 locale dirs of fragment JSONs + init) · `src/theme/` (dark-mode hook) · `src/lib/` (utils).

**Admin sections** live in `src/routes/admin/`: 9 pages gated behind `admin`/`superadmin` via `<RequireRole role={STAFF}>`. The admin nav registry is `adminNav.ts` (rendered as a "Staff" group in the app sidebar). Key pages: Overview, Content (merged courses + moderation), Users (stats bar + signup timeline), Emails (Resend-style dashboard), Analytics & Health, Generation, Intel (Data Intelligence — 9-tab console, `/DATAINTEL.md` §7), Audit, Roles (superadmin-only). Shared building blocks in `adminShared.tsx`. The Staff group is HIDDEN for non-staff (never shown as a locked section).

## Read before touching

- `frontend/README.md` § "How the internet sees this site" — before ANY change to a marketing route, page title, description or share copy.

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

- **The tutor route is EXEMPT from the app shell, and that exemption is
  structural.** `/tutor` is declared OUTSIDE the `AppLayout` route group in
  `App.tsx`, beside the Lesson Player, and `StageShell`
  (`src/tutor/stage/StageShell.tsx`) renders `fixed inset-0` with no
  `mx-auto max-w-container`, no page padding and no `<h1>`. Those are the only
  two full-bleed surfaces in the product and the list is closed at two
  (/DESIGN.md → Layout → the immersive exception); a third is an owner
  decision. `fixed inset-0` alone is NOT the exemption: inside `AppLayout` the
  sidebar and the mobile tab bar stay in the DOM under the stage, so a keyboard
  user tabs into navigation they cannot see. Because the chrome is gone, the
  shell owes the learner a way out on every phase, and it carries one —
  VIEWPORT-anchored, visible without focus, and above the loading veil. It was
  none of those things first: a world rune on `sky.mark.4` plus an `sr-only`
  button. Both are real controls and neither is reachable, because the rune is
  culled whenever the camera stops framing the sky (most of a session) and a
  skip link is revealed by a key a thumb never presses. That left a pointer
  user in a close-up with the browser back button. It is the third
  viewport-anchored element on the route and /DESIGN.md now names all three.
- **The mouth card is the ONE unlit surface in the scene, so it has to be TOLD
  what colour the light is.** `MouthCard` uses `MeshBasicMaterial` because every
  lit material renders that particular map solid black (root cause unfound — see
  TUTOR_3D.md §3.1a). An unlit material does not darken when the sun goes down,
  and at Dusk the speaker's mouth photographed as a cream-white rectangle across
  an orange-lit face. `backdrops.ts` → `mouthCardTint()` supplies the light by
  hand through the material's `color`; `backdrop` reaches the card by prop from
  `TutorScene` → `Cast` → `Character3D`, and the card reads the THEME from
  `useTheme` exactly as `SceneLighting` does — one answer to "is it dark", never
  two that can disagree. Two rules if you touch it: the tint is expressed
  RELATIVE to the default palette so `auto` in light mode is provably
  `#ffffff` and nobody's untouched scene moves, and it is encoded through the
  sRGB transfer function because `material.color` is read as sRGB and multiplied
  in linear — writing the linear ratio straight in applies it twice and turns
  the mouth BLACK, which is the same defect wearing the other colour.
- **A screenshot is the only gate that can see any of this.** Every defect in
  this directory found since 2026-08-15 — the 221 m contact shadow, the ghost
  character, the white mouth bar, the plate on the wrong dinosaur — passed
  type-check, lint and the whole unit suite. `/dev/tutor-lab` mounts the REAL
  `StageShell` with switches for phase, locale, cast and activity; drive it with
  headless Chrome over CDP (RUNBOOK.md has the recipe and the four traps,
  including that `getComputedStyle` cannot answer "is this visible" and that
  `drawImage` on a WebGL canvas returns stale pixels). Do not close a change
  here on a green suite.
- **The stage is mounted ONCE for the whole route.** `StageShell` holds the
  single `TutorStage`; a phase changes the camera SHOT and which HUD layer is
  on top, never the tree under the canvas. A surface that mounts its own
  `<TutorStage>` reintroduces the bug this replaced: the island refetches
  through a Suspense fallback and the learner watches their own world blink at
  every phase boundary. Layers receive `PersonalizeLayerProps`,
  `OfferLayerProps` and `ConversationLayerProps` from `stage/StageShell.tsx` and
  drive nothing but their own chrome.
- **Only VIEWPORT-anchored surfaces may register with `SafeAreaContext`.** The
  camera composes around every registered rect (`tutor-scene/composition.ts`,
  read each frame by `CameraDirector`), so a WORLD-anchored surface — one
  positioned by projecting a point the camera is currently moving — would be
  pushed by its own measurement: the aim lifts, the anchor it rides lifts with
  it, the rect it publishes lifts, the inset grows, the aim lifts again. The
  slot union is closed at `lesson | sheet | mic` for that reason and `caption`
  was removed from it. What the world-anchored chrome gets instead is a promise
  from the SHOT: `CameraPose.keepInFrame` is the radius about the aim the solver
  may not shift out of view, and for the close shots it covers the crown, the
  caption band above it and the chest the offer chips hang from. If a new piece
  of chrome needs room, it is bought there — in arithmetic the shot owns — and
  never by registering a rect that moves when the camera answers it.
- **Look at the stage at 375 px before closing any Tutor task, at
  `/dev/tutor-lab`.** The route is DEV-only, outside `RequireAuth`, and it
  mounts the REAL `StageShell` — real island, real camera, real anchored HUD,
  real dock, real lesson sheet — driven through every phase by a switcher, with
  a live viewport readout. Only the two NETWORK edges are stubbed, both in
  `src/tutor/lab/labFixtures.ts`: the Oracle socket (no Core-minted token exists
  in a lab) and `/api/v1/tutor/*` (a scoped `fetch` shim that passes everything
  else, including the `.glb`, straight through). Do NOT let it drift into a copy
  of the screens: the whole reason it exists is that the previous lab rendered
  stand-ins on an ordinary scrolling page and said the anchored chrome was
  "looked at on /tutor itself" — a route that needs a token, a running Oracle
  and a live socket, so in practice nobody ever looked. The owner found the
  phone layout first, which is the only outcome that arrangement could produce.
- **Drive the lab's LOCALE switch, and screenshot all three** (added
  2026-08-22). The panel carries `en-US · es-MX · pt-BR`, and one press moves
  `i18n.changeLanguage` AND the simulated session's content together — the
  tutor's line, the transcript, the activity, the flagged skill. It is one
  control on purpose: the fixtures used to be pinned to `es-MX` while the UI ran
  in whatever the browser detected, so every screenshot showed English chrome
  around Spanish content and was read, reasonably, as hardcoded strings in the
  product. Nothing was hardcoded — production drives everything off
  `session.locale` — but a QA surface that lies about the exact thing being
  reviewed is worse than no QA surface. It is also the only way to SEE the
  locale swing: these labels run to 1.86x of each other, and a plate sized for
  English is a defect invisible in English. The lab's own chrome stays in plain
  English (it is an instrument label); the simulated product never does.
- **`/dev/learn-lab/:courseSlug` is the learn surfaces' QA route** (added
  2026-08-24). `/learn/*` is the one product area whose four screens all sit
  behind `RequireAuth` and a live course tree, so looking at them used to mean
  running the whole Supabase stack — which meant, in practice, that nobody
  looked, and §1.11's "screenshot 375 and 1280 before closing" was satisfied by
  intention rather than by a screenshot. The lab mounts the REAL `LearnPage`,
  `CoursePage`, `TerritoryPage` and `PlacementPage` inside a copy of
  `AppLayout`'s content box, so widths measured there are the widths that ship.
  Only the network edge is stubbed: a module-scope `window.fetch` shim answers
  the four learn endpoints from `learn/lab/fixtures.ts` and passes everything
  else through, and a matching stored session exists because `TerritoryPage`
  correctly refuses to fetch without a token. **The route carries `:courseSlug`
  on purpose** — the pages read it with `useParams`, and it is what decides
  whether a territory chip is a link or a padlock; mounted without one, every
  chip falls to its locked branch and the lab shows a state no learner is ever
  in. Fixture ids are valid UUIDv4 (§1.14) and `nextLessonId` is DERIVED from
  the lesson whose state is `current`, never hand-written, because a
  hand-written id drifts the moment a lesson is inserted above it and the lab
  then paints the "you are here" highlight on a lesson already passed.
- **`/dev/lesson-lab` has the same switch now, for the same reason** (added
  2026-08-23). It renders its chrome through i18n and used to render fixtures
  pinned to `es-MX`, so it had the identical defect and was the instrument the
  lesson-engine work was being reviewed through. Every fixture is now written in
  all three (`lesson-engine/lab/fixtureCopy.ts`), STRUCTURE once and copy three
  times, with the en-US object as the key source of truth and the other two
  typed against it so a missing key is a compile error. The tutor lab's activity
  switch draws from the same fixtures, so its `script`-only caveat is gone too.
  `registry.test.tsx` blanks every string and compares what is left, which is
  what stops the three from drifting into three different exercises.
- **`three` must only ever be reached through a lazy route.** `TutorPage` and
  the scene lab are `lazy()` imports; a static import anywhere in the eager
  graph would put ~285 kB gzipped into the entry bundle of every marketing
  page. Verified after each build: `WebGLRenderer` must appear in the
  `TutorScene-*` chunk and NOT in `index-*`. Any 3D preview added ANYWHERE in
  the product has to live inside that lazy chunk for this to keep holding.
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
- **A separation floor is per PAIR, and a sampling ring is per CAST SIZE.** One
  number for everybody only survives two characters: Dina and Liruf need 2.61 m
  between them, Rho and Zara need 1.18 m, and charging the small pair the big
  pair's rent left two of the four personalization candidates with NO SPOT FOUND
  on the 6.5 m island. The coarse ring is the other half — its surviving samples
  sit 40° apart while the gap the fourth candidate needs is 27° wide, so the spot
  existed and nothing was ever sampled in it. `verify:placement` now runs the
  whole-cast audition against both islands, which is how both were found.
- **Ask a SHARED model how big it is in its OWN space — never `setFromObject`.**
  `useSceneModel` hands out the loader's cached `gltf.scene` by reference, so one
  `Object3D` is the model and it is attached to whichever group is rendering it.
  `Box3.setFromObject` measures in WORLD space, which is the right answer for the
  composed scene, the ground and the camera fit — and the wrong one for "how big
  is this export", because on a REMOUNT the object is still inside the outgoing
  instance's scaled group during the incoming instance's render pass. That put
  Dina's feet 12.24 m under the island and stretched her contact shadow to
  221.53 m, covering the canvas; the three characters who export at scale 1.0
  hid it for five days. Use `modelBounds` / `modelFooting`
  (`tutor-scene/modelBounds.ts`), which compose local matrices down from the
  model root and read nothing above it. /TUTOR_3D.md §5.1.
- **A character's Suspense boundary must not depend on their ROLE.** Wrapping
  principals in a `Fragment` and extras in a `Suspense` made a role change an
  element-TYPE change under an unchanged key, which React implements as
  unmount-and-remount — and that remount is what took the world-space
  measurement above. Every character gets their own `<Suspense key={id}>`
  unconditionally; `onReady` waits for the tutor and companion through an
  explicit `PrincipalModels` gate instead. /TUTOR_3D.md §5.2.
- **`verify:placement` sweeps the audition WITH a companion**, every character in
  both roles on both islands, using the product's own `standingCast`
  (`tutor-scene/cast.ts`). That configuration — a candidate who is also the
  session's companion — is the one the gate never covered and the only one that
  broke. It also measures footing free versus mounted, which fails on the
  pre-fix code.
- **The whole cast stands on the island during personalization, and it turns the
  shadow pass off to afford it.** Four characters measure 106,208 triangles;
  with either island that is 151,204 or 173,076 per frame against a 220,000
  ceiling, and 302,408 or 346,152 with shadows, because `high` submits the scene
  twice. Dropping a candidate instead would put a name plate back over empty
  ground, which is the bug the audition exists to fix. Both halves are asserted
  in `budget.test.ts`, against triangle counts recorded in `measurements.ts`.
- **The microphone is a property of the STAGE, not of a layer.** `StageShell`
  mounts exactly one `MicOrb` for the whole route and `stage/micForPhase.ts`
  decides, as a total function over the phase vocabulary, what it is doing.
  Mounting it inside a layer is what left `arriving`, `personalizing`, `closing`
  and `unavailable` with no microphone at all — including the first screen a new
  learner sees — while two layers each had one. A layer contributes rows above
  and below the orb through `useStageDock`, never a second orb.
- **A new island needs its mask baked before it can ship.** `assets:walkmask`
  is not part of `assets:3d`; adding a diorama means running it and committing
  `walkMasks.generated.json` in the same commit.
- **An anchored HUD node is culled against its BOX, never against its centre.**
  The projector positions a node by its centre (`translate(-50%, -50%)`), so a
  centre test knows nothing about where the node's edges are. Culling on the
  centre plus a 96 px margin kept chips un-hidden and un-inert while they hung
  half off the frame: visible as a sliver, fully focusable, and the focus ring
  went somewhere the learner could not read. The geometry is `culling.ts`
  (imports nothing, so it can be unit-tested); the node's own box is measured on
  the same quarter-second tick as the canvas rect, and a zero reading from a
  hidden node is discarded rather than stored, or the cull oscillates.
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
