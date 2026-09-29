# Gap-fix round 3

Lane records for the third gap-fix round of the SPEC migration. Each lane
appends its own section. Statuses follow the ledger: implementation, local
verification, acceptance and release are separate, and nothing here is
accepted or released.

## F3-design-system

Branch `codex/spec-fix3designsy`. Three audited gaps, each checked in the code
first; all three were real.

### What was built

1. **Class B navigation marks; the compact tab bar switches on** (Bible 02 §7
   rule 9; 07 §1 class B, §3 house style; 03 §3.4).
   - 22 in-house SVG marks (`frontend/public/rebuild/art/nav-*.svg`, 48 px grid,
     flat token fills, at most 3 hues, no text, no accent or error hue, one file
     for both modes): learn, tasks, wallet, family wallet, coins (the Tutor's
     Wallet), family, profile, become-a-Tutor, staff, back-to-app, and the 12
     staff console sections (overview, content, users, age corrections, emails,
     analytics, intel, Mentor quality, generation, audit, reports, roles).
   - Registered in `src/rebuild/assets/manifest.json` (slot `nav.icon`, type
     svg, modes both, altKey decorative, review status draft) under a new review
     family `navigation`; the asset gate (`scripts/check-rebuild-assets.mjs`)
     knows the family and resolves `nav.*` id references.
   - `src/rebuild/design/navMarks.ts` holds the ids; every `NavSlot` in
     `src/app-shell/navigation.ts` (SLOTS and STAFF_SLOTS) now requires an
     `iconAssetId`, carried through `AppLayouts.tsx` (learner, Tutor and staff
     layouts) into the shells. The preview shell gallery uses the same marks.
   - `shells.tsx`: a mark is shown only when the manifest resolves it;
     `data-icons='all'` when every entry has a mark. The current entry is
     marked on its list item (`data-current`), so the compact rule in
     `shells.css` no longer needs `:has()`; below a 360 px container inactive
     tabs are 48 px icon targets, only the current label is visible, every
     name stays the link's accessible name, and the bar's insets shrink to give
     the current label room (the 8 px gap between targets stays).
   - The Mentor tab before a character is chosen has no picture (02 rule 21, no
     stand-in) and keeps its word in the compact bar (`data-keep-label`).
2. **The 14 px floor on mounted screens, and an audit that checks it** (02 rule
   11, §3 caption; 06 §7; 02 §1.2).
   - `.lf-streak-weekday` (streak strip: learner home, rhythm, own profile) and
     `.lf-guardian-invite-link-value` (co-guardian invite link on /family) use
     `font: var(--type-caption)` (14 px).
   - The invite link has `data-copy-role="data"` and no hard-coded English
     `aria-label`: the visible link is its own name.
   - `scripts/audits/in-page.mjs`: 12 is no longer a step of the proportion type
     scale, and text fit reports `font<14px` for any visible non-SVG text under
     14 px.
3. **Flat, token-only feature stylesheets, and a contract over all of them**
   (02 rules 2, 10, 11, 23, §4.4, §3 input; 07 §3; 05 §2).
   - CPA counters are flat fills (no inset ridge, no `#000` mix); the flowchart
     outcome node is told apart by its mint-soft fill, word and weight, not a
     border; the what-if branch card is a surface card on `--elevation-card`,
     the chosen one wearing the 3 px selection ring; the staff learning-quality
     note is the shared `TextAreaField` (the raw textarea and its outlined
     rules are gone); the neutral streak dot's boundary is `--edge`.
   - The widened contract found four more lines on hue fills, fixed the same
     way: the CPA step rows' left stripe, the number-line marker's surface
     ring, the operations token's ink border (the spent token keeps a dashed
     `--edge` line: it has no fill), and the place-value rod's unit separators
     (now a 1 px gap).
   - `src/rebuild/design/controlsCss.test.ts` now checks every
     `src/rebuild/**/*.css`: colour literals only in `tokens.css` and
     `document.css` (plus the two shadow tokens of `system.css`); no inset
     relief ridge; no border or outline on a rule with its own hue fill (focus
     rules excepted); no HTML font size under .875rem (SVG text rules, which
     paint with `fill`, excepted); no text-overflow or line clamp; gradients
     only as hard-stop pattern fills (the second channel of a series, 05 §2),
     never as a shade. Each rule was mutation-checked.

### Verification (local)

- Frontend `type-check` and `lint` (`eslint .`) clean.
- Focused vitest: `shells.test.tsx` (new: compact tab bar at a 320 px
  container, applying the shell sheet's own container block; data-icons,
  visible labels, accessible names, decorative marks; unchosen Mentor; a
  missing mark; the Tutor bar), `navigation.test.ts` (every slot's mark is
  registered, decorative and distinct per destination), `controlsCss.test.ts`
  (59), `auditFloor.test.ts` (new, the in-page floor rule in jsdom),
  `StreakStrip.test.tsx`, `GuardianInvitePanel.test.tsx`,
  `LearningQualityPanel.test.tsx`, the learning board and operations tests,
  `boardAudit.test.ts`, and the asset gate and its mutation tests.
- `node scripts/check-rebuild-assets.mjs`: OK, 355 class B assets, owner style
  review pending for the new `navigation` family among others.
- `audit:text-fit` at 320 px on Vite 5960, Chromium, 3 locales x 2 modes x
  normal/+40% text x normal/WCAG spacing: the preview shells (learner, teen,
  Tutor, staff, staff limited, staff menu; 144 configurations) and the mounted
  shells on real routes (`/learn` child, `/profile/settings` teen,
  `/admin/intel` staff limited, `/family` Tutor empty; 96 configurations): no
  findings.
- One look at 320 px (headless Chromium, CDP capture): the es-MX learner bar
  and the pt-BR dark Tutor bar sit on one row with `data-icons='all'` and only
  the current label visible.
- Root `spec:check` (exit 0) and `secrets:check` OK. The i18n gate was not
  needed: no copy key changed in this lane.

### Decisions taken with the SPEC's conservative default (owner questions)

- **Unchosen Mentor tab in the compact bar.** 02 rule 21 forbids a stand-in
  picture, so before a character is chosen the Mentor tab keeps its word while
  the other inactive tabs compact. A class B "stage" mark would be an
  alternative; it needs the owner's word because it would sit in the Mentor's
  own slot.
- **Navigation family style.** The 22 marks are drafts; the owner's first-asset
  style review of the `navigation` family (07 §7 item 2) is pending, and a
  release build refuses drafts by design.

### Open items

- The linked teen's six-entry learner bar (Learn, Mentor, Tasks, Wallet, Family
  wallet, Profile) needs 5 x 48 px plus gaps before the current label, which
  does not fit one 320 px row: it reflows onto a second row, with no crop. The
  01 research asks for 4-5 bottom items; trimming the six is a product call.
- The teaching charts' 12 px HTML tags (`.lf-chart-tag`) and the SVG chart and
  operations labels sized in drawing units are the charts gap, owned by the
  learning lane; the static contract allowlists `.lf-chart-tag` by name, and
  the new `font<14px` text-fit finding will report those tags on any audited
  state that shows a chart until that gap closes.
- Human review (style, both modes, screen reader) and acceptance.

### Migrations

None.

### Lane finish (F3-design-system-finish)

- **Sync.** `codex/spec-migration-s02` merged: already up to date, so there
  was nothing to resolve.
- **Adversarial pass against the three gaps.** 02 §7 rule 9 asks that below
  360 px inactive tabs become 48 px icon buttons, only the active tab shows its
  label, and every name stays available to assistive tech. The lane does that
  for every learner, Tutor and staff slot. The one exception is the unchosen
  Mentor, which keeps its word because rule 21 forbids a stand-in. The 14 px
  floor holds on the two mounted offenders, and the audit now reports any
  visible text under 14 px. Every rebuilt stylesheet sits under the flat,
  token-only contract. No legacy component is used: the note field is the
  shared `TextAreaField`. No copy key changed, and the lane has no server
  surface, so no authorization boundary is involved. Nothing was missing.
- **Full frontend unit suite, run once.** Frontend `type-check` and `lint` are
  clean. `vitest run` (3 threads): 272 of 273 files and 3142 of 3143 tests
  passed. The one red was a 90 s per-test timeout in
  `src/rebuild/assets/assetGate.test.ts`, on the Mentor-avatar mutation case,
  while other lanes were loading the machine. Run alone, the file passed 13 of
  13 in 923 s. Several of its cases take 100-140 s alone, so the file is close
  to its own budget under load. That is a harness-time risk, not a product
  defect; see the open items. Root `spec:check` (exit 0), `secrets:check` and
  `check-rebuild-assets.mjs` are OK.
- **Status.** Implemented and locally verified. Not accepted and not released.
  Still open: the owner's style review of the `navigation` family, the teen's
  six-entry bar (a product call), the charts' 12 px tags (learning lane), a
  human review, and the asset-gate file's timing under load.
