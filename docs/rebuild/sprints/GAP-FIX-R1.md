# Gap-fix round 1

Lane records for the first gap-fix round of the SPEC migration. Each lane
appends its own section. Statuses follow the tracker's rule: implemented,
locally verified, accepted and released are separate, and nothing here is
accepted.

## F1-design-system

Branch `codex/spec-fix1designsy`. Six audited SPEC gaps in the shared design
system, each checked in the code before it was fixed (all six were real).

### 1. Teaching-board audits and Reset (Bible 05 §3, §8)

- Built: `boards()` in `frontend/scripts/audits/in-page.mjs` measures every
  visible `.lf-learning-board`: SVG text limited to short numerals and symbols
  and kept inside the board (05 §5), mark and axis contrast of 3:1 against the
  board ground in the current mode (both modes by the matrix; gridlines and
  `[data-board-decoration]` ground excluded), no reserved hue on a
  `[data-series]` mark (05 §2), a 64 px hit area for every draggable and a tap
  alternative for any non-native handle (05 V4, §2). `motion()` adds
  `boardMotion`: no animation inside a board that is infinite, longer than
  `--dur-component`, springy or a celebration (05 §4, V5).
  `frontend/scripts/audits/rules.mjs` `boardFindings` turns them into findings
  inside the proportion pass, so `npm run audit:rebuild` (the pre-merge run)
  carries them. The scorer-parity half of 05 §8 stays the node gate
  `agent/tools/sync-v2-visual-scorer.mjs --check` in `spec:check`.
- Built: Reset in the control strip of BarModel, FractionArea, PlaceValue,
  SavingsRule, SchemaDiagram, FunctionMachine, CpaFading and WorkedExample
  boards. It restores the authored initial state and clears the verdict
  (EN Reset, es-MX Restablecer, pt-BR Recomeçar, the words the other boards
  already use). On the CPA board it is the `refresh` icon button with that
  name, because a visible word pushed the 6-9 first view to 26/25 (06 §3.1).
- Calibration: the proportion pass over the 21 board preview states (en-US,
  light and dark, 375 and 1280 px) found one board finding, the goal bullet's
  track and goal band at 1.24:1 in dark mode. Those two rects are ground (the
  target line and the fill carry the values), so they are marked
  `data-board-decoration`; the rerun is clean.
- Verified: `boardReset.test.tsx` (8), `boardAudit.test.ts` (3),
  `LessonDocumentView.test.tsx`.

### 2. The legacy page body is gone (02 rule 23, D3, D13; 08 §0; OD-15)

- `AppShellLayout` renders the page straight into the shell's `<main>` (a keyed
  fragment keeps the old per-address remount); `StaffShellLayout` has no
  fallback; `LegacyBody`, `isRebuiltStaffPath` and the `rebuilt` flag are
  deleted. Every `[data-legacy-body]` selector and bridge rule is gone from
  `system.css`, `shells.css`, `learnerPage.css` and the in-page audit.
- `.lf-shell-main` owns the content padding and, in the learner and console
  shells, a centred maximum width of `calc(var(--spacing-32) * 10)`; a learner
  page inside a shell adds no padding of its own, and every page fills the
  column `<main>` (zero-specificity `inline-size: 100%`; without it the teen
  wallet, which centres itself with auto margins, shrank to 0 px, found by the
  real-route audit).
- The legacy `lf-page-enter` entrance is replaced by the shell's own route
  entrance: `data-route-enter` on `<main>`, `lf-route-enter` over
  `--dur-transition` on `--ease-enter` inside `prefers-reduced-motion:
  no-preference`, fill mode `backwards` so no transform outlives it, fired
  from the shells' route-focus effect only on a real route change
  (`replayRouteEntrance`).
- Verified: `AppLayouts.test.tsx`, `shells.test.tsx` (new entrance case),
  `staffConsole.test.tsx`.

### 3. The legacy sheet is scoped to the island (02 rule 2, D3, D4; 07 §1; OD-12)

- `main.tsx` no longer imports `index.css`; it imports
  `rebuild/design/document.css` (body ground, ink and Nunito from the tokens,
  both modes, pinned to `tokens.css` by `bootVeil.test.ts`).
- `index.css` (Tailwind, the legacy tokens, glass, Inter/Sora via its own
  `@import`, the self-hosted Material Symbols face) loads only with the v1
  island (`LegacyLessonIsland.tsx`, now lazy from `LessonRoute.tsx`, so a v2
  lesson never loads it), the staff lesson preview (lazy, in
  `staffConsole.tsx`) and the four dev labs.
- `index.html`: no Google Fonts request and no icon-font preload; it preloads
  `fredoka-latin-v1.woff2` and `nunito-latin-v1.woff2`. The boot veil paints
  `--base` (#f4f5fd) and dark `--base` (#0b0d1b) with a `--primary` bloom.
- The 3D layer's Tailwind utilities became `tutor-scene/sceneCanvas.css`
  classes (the Mentor stage mounts it outside the island).
- `system.css` carries the element baseline the rebuilt surfaces were built on
  in the real app (the preflight's borders, heading, list, form-control, link
  and media rules), scoped to `.lf-rebuild` at zero specificity, so any
  component rule wins and the preview entry and the real app share it (the
  real-route audit had found a bare `h3` at the UA's 18.72 px).
- Verified: `bootVeil.test.ts` (15), `legacyLessonIsland.test.ts` (new lazy
  and sheet case), `CharacterLayer.test.tsx`, `designClasses.test.ts`,
  `celebrationBudget.test.ts`; a real-app audit run (below).

### 4. The four orchestrated motion patterns (04 §4.1-§4.4; 02 §9.9, rule 14)

All in `rebuild/design/motion.tsx` and `motion.css`, under
`prefers-reduced-motion: no-preference`; with reduced motion the final state is
shown directly.

- `useRouteEntry(key)`: true only on the first render of a surface after a
  route or lesson-screen change (`noteRouteChange`, called by the shells' route
  entrance and the lesson layer); a re-render or a same-route remount never
  re-fires.
- `SequenceTransition` wraps the v2 lesson's segment swap
  (`LessonDocumentView`): the outgoing `.lf-learning-content` is cloned before
  the swap (inert, hidden from assistive technology, ids stripped) and slides
  out 14% on `--ease-exit` while the incoming card slides in from 18% on
  `--ease-enter`, both over `--dur-transition`, about 22% overlap; the foot
  travels with its card. The CPA board keeps its own stage transition.
- `SuccessWipe` in the Tutor's `DecisionQueue` (Tasks and Coins pages): on
  approving a chore or a reward, a solid success panel with the check glyph and
  the item's title covers the row from the top, holds and clears downwards over
  three `--dur-component` steps, revealing the row as approved (kept, with a
  success chip, until the wipe ends even when the refreshed queue drops it).
- `Wave` on a new streak strip in the learner's rhythm card (seven days derived
  from the streak's own count, decorative; index × 60 ms). `Stagger` on the own
  and public profile badge grids (min(i, 10) × 45 ms).
- Registered as non-celebration motion (`ORCHESTRATED_MOTION`) in
  `celebrationBudget.test.ts` and in the in-page motion audit, which reports a
  wave outside the streak strip or a stagger outside its primitive.
- Verified: `motionPatterns.test.tsx` (route entry, re-render and remount do
  not re-fire, wipe and slide with and without reduced motion).

### 5. The coin asset (07 §1 class B, §6; 02 §9.5)

- `public/rebuild/art/coin.svg`: in-house, flat, no text, under 1 KB, the
  `reward` fill with a `reward-ridge` outline and a `reward-strong` star.
  Registered as `money.coin` (class B, slot `money.coin`, family `coins`,
  modes both, draft). The asset gate now also reads `money.*` ids as
  references. The SVG uses the token hex values rather than CSS variables:
  an `<img>` SVG cannot read the page's variables, the reward tokens are the
  same in both modes, and the gate proves every colour is a token.
- `CoinAmount` (coin art, aria-hidden, then the number and the word "coins")
  and `RewardChip coin`. Used for task rewards, the reward catalog (child and
  Tutor), the family console's wallet total, the Tutor's reward costs, pocket
  balances (child pockets, coin account pockets), goal progress (the copy now
  says "{saved} of {target} coins" in all three locales), Share gifts and the
  teen wallet (total, pockets, reward prices). XP and streak chips never carry
  the coin. Shown in the SystemGallery.
- Verified: `coinAmount.test.tsx`, the money surface tests, `check-rebuild-assets`.

### 6. Press ring and haptic tick (02 §9.1)

- `pressFeedback` / `withPressFeedback` in `motion.tsx`: on pointer down a ring
  in the control's own on-* colour (`currentColor` border, no fill) scales out
  from the touch point over `--dur-micro` on `--ease-standard`, then is
  removed; `navigator.vibrate?.(8)` unless the platform's sound off switch
  (`lf_sound_muted`) is on. Disabled or pending controls give no feedback.
  Applied to Button, IconButton, AnswerChoice, ReplyChip, ChoiceChip and the
  pressable ListRow. Under reduced motion only the colour change remains.
- Pinned in `controlsCss.test.ts` and `scripts/verify-rebuild-controls.mjs`
  (a real press must start `lf-press-ring` and clear it).

### Verification summary

`npm run type-check` and `npm run lint` (frontend) clean; focused Vitest over
design, learning, family, account, social, wallet, banking, app-shell,
routes/app and `src/__tests__` green (1,233 tests in the widest run); root
`npm run spec:check`, `npm run secrets:check` and the i18n gate green;
`check-rebuild-assets` OK (145 class B assets). Browser (`audit-rebuild.mjs
all`, local dev server, synthetic Core): all 183 real-app states at 375 px in
en-US light and dark and all 176 preview states at 375 px en-US light: text fit
and proportion clean; copy budget clean except the one finding below. The
eight Reset boards, the goal board, the system gallery and the learner home in
es-MX and pt-BR, light and dark, 320 and 1280 px: clean. The full matrices and
`test:all` are the orchestrator's merge gate.

### Owner questions and defaults taken

- The streak strip has no per-day history from Core, so it is derived from the
  streak count and kept decorative (the words carry the meaning). If the owner
  wants real practised/rest-day marks, Core needs a seven-day history field.
- The haptic tick follows the platform sound off switch only, not reduced
  motion (haptics are not visual motion). Conservative alternative: also skip
  it under reduced motion.
- The legacy island keeps Inter and Sora through a Google Fonts `@import` in
  its own sheet, so only a v1 lesson (and the staff preview and labs) makes that
  third-party request. Self-hosting them, or moving the island to Fredoka and
  Nunito, would remove it entirely.

### Remaining

- Copy budget: `app:/@marta@kid-6-9` (a 6-9 viewer on a public profile) counts
  28/25 first-view words at 375 px: the first badge's "Earned Aug 14, 2026"
  sits 5 px above the fold now that the shell's phone padding is 16 px instead
  of the legacy body's 20 px. The layout is the SPEC's; the fix is a profile
  copy or composition decision for the profile lane (drop the earned date in
  the 6-9 register, or move the badges below the safety notice), not an audit
  exception.

- Ledger lines (activity, corrections, statements) keep signed numbers without
  the coin mark; tiles and cards other than the pressable list row do not yet
  ripple (the picture option keeps its scale press only).
- Acceptance and release are not claimed.
