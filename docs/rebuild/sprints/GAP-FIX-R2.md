# Gap-fix round 2

Lane records for the second gap-fix round of the SPEC migration. Each lane
appends its own section. Statuses follow the ledger: implementation, local
verification, acceptance and release are separate, and nothing here is
accepted or released.

## F2-design-system

Branch `codex/spec-fix2designsy`. Three audited gaps; gaps 1 and 3 are the
same artifact (the OD-20 achievement image) and were closed together. Each
was checked in the code first.

### What was built

| # | SPEC clause | Gap confirmed in code | What was built | Where |
|---|---|---|---|---|
| 1 + 3 | Bible 02 D1, D3, D4, rules 2, 3, 16; 07 sections 1, 3; 06 section 5.7; OD-4, OD-14, OD-20; Product 10 F.1, F.6 | Real. `filebase/src/lib/badge.ts` drew a `linearGradient` in the retired palette (#4f46e5/#4338ca, #d97706/#b45309, #0e9f6e/#0a7a55), opacity tints, emoji as the central art, Nunito with a Segoe UI fallback and no Fredoka, Depot-held kickers with exclamation marks, and two ellipsis truncations (Core's `label.slice(0, 79)…` and Depot's 4-line cap) | **Depot.** `buildSvg` rebuilt: solid kind colour (primary / reward / mint) with its on-* text colour, the kind's -soft disc behind the mark, no gradient, no opacity. Colours come only from `badgeDesign.generated.ts`, the light-mode token set mirrored from `frontend/src/rebuild/design/tokens.css` (a test pins the mirror). The emoji are replaced by three new class B marks, `share.achievement.{course_badge,streak,goal_reached}`, family `achievement-share`, status draft. They are drawn from the house badge, streak flame and Save pocket and inlined in `badgeArt.ts`. Text carries no `<text>` for Latin: Fredoka 700 (kicker, name, wordmark) and Nunito 700 (label) are drawn as glyph outlines generated from the self-hosted woff2 files, because librsvg cannot load a web font. A character outside the Latin subset still shows through the renderer's fallback. Layout is measured: the name shrinks in 4 px steps to fit one line, and the label wraps by measured width with no line cap and shrinks step-wise (52 to 28 px). There is no ellipsis anywhere. Emoji in a name or title are dropped. The kicker must be free of `!`/`¡` and is optional only for deploy ordering. **Core.** The kickers ("Badge earned / Insignia ganada / Insígnia conquistada", "Learning streak / Racha de aprendizaje / Sequência de estudos", "Goal reached / Meta alcanzada / Meta alcançada") and every label move to `services/achievementImageCopy.ts`. A title longer than 80 characters is replaced whole by the generic label, with a new course generic "Finished a course / Terminó un curso / Concluiu um curso". **Gates.** `badgeDesign.test.ts` fails on any off-token hex, a gradient, an opacity, a filter or image, an emoji, an ellipsis, system-font text for Latin, a missing locale glyph, or a mark that differs from its registered SVG. `check-rebuild-assets.mjs` now reads the Depot template: it checks token colours, no gradient, opacity or emoji, and that every inlined mark equals its registered SVG. An `achievement-share` asset counts as referenced only as a Depot mark (mutation-tested). Depot CI also runs on token, manifest and share-art changes | `filebase/src/lib/badge.ts`, `badgeArt.ts`, `badgeDesign.generated.ts`, `filebase/scripts/build-badge-assets.py`, `filebase/src/routes/badges.ts`, `backend/src/services/achievementImageCopy.ts`, `backend/src/routes/family.ts`, `frontend/public/rebuild/art/share-achievement-*.svg`, `frontend/src/rebuild/assets/manifest.json`, `frontend/scripts/check-rebuild-assets.mjs`, `.github/workflows/filebase-ci.yml` |
| 2 | Bible 02 rule 23, D13; 04 section 3; OD-24 | Real. The island did `import '@/index.css'`, and the staff preview did `import('@/index.css').then(...)`. Vite never removes an injected sheet, so after one v1 lesson or v1 preview the Tailwind preflight and the legacy `body` ground stayed on every rebuilt route. The smooth-scroll part was only partly real: index.css already reset it under `prefers-reduced-motion: reduce` | `app-routes/legacySheet.tsx` imports the sheet as a string (`?inline`, still compiled by Tailwind/PostCSS; checked on the dev server). `LegacySheetScope` inserts one reference-counted `<style data-legacy-island>` in a layout effect, renders its children only after the sheet is present, and removes the sheet when the last holder unmounts. The island wraps `LessonPlayer` in it. The staff preview lazy-loads `app-routes/ScopedLessonPlayer.tsx`, so the sheet string ships only in the preview chunk. `scroll-behavior: smooth` now sits inside `@media (prefers-reduced-motion: no-preference)`. The new modules live under `app-routes/`, because `lesson-engine/` is a frozen legacy directory (`legacy-ui:check`) | `frontend/src/app-routes/legacySheet.tsx`, `ScopedLessonPlayer.tsx`, `staffConsole.tsx`, `frontend/src/routes/app/learn/LegacyLessonIsland.tsx`, `frontend/src/index.css` |

### Verification (local)

- Depot: `badges.test.ts` (14) and `badgeDesign.test.ts` (7) pass; type-check and lint are clean. All three kinds were rendered to PNG and looked at once: token grounds, the marks on the -soft discs, Fredoka/Nunito outlines, wrapped labels.
- Core: `achievementImageCopy.test.ts` (new), `achievementSharingConstraints.test.ts` (the render body is now exactly kind, label, first name, locale and kicker; an over-long goal or course title becomes the generic label, with no ellipsis) and `familyBadge.test.ts` pass (40 tests). Type-check and lint of the touched files are clean.
- Frontend: `app-routes/legacySheet.test.tsx` (jsdom) checks three things. The sheet is present only while mounted, and children never render without it. Two holders share one element, and release is idempotent. No non-lab module loads `index.css` except the scope. `legacyLessonIsland.test.ts` is updated. The asset gate's new mutation case (a drifted mark, an undrawn `achievement-share` asset, a retired drawn mark) passes. Type-check and lint are clean.
- Root: `spec:check` (including `legacy-ui:check`, `check-achievement-sharing`, the token and asset gates) and `secrets:check` are green. No product copy in the i18n bundles changed.

### Remaining / limitations

- A browser `verify-*` check was not written: open a v1 lesson, navigate to /learn, and assert no `style[data-legacy-island]` and a #f4f5fd body. It needs the seeded DB stack and a published v1 lesson; the jsdom test covers the mechanism. Speed-mode lean verification.
- The three `share.achievement.*` marks are drafts. The owner's first-asset style review (07 section 7, OD-14) is pending, and `--release` refuses them until then, like every other draft.
- There is no GPOS kerning in the outline text: advances only, which is visibly fine at these sizes. Characters outside the Latin woff2 subset use the renderer's system fallback.
- Deploy order when this ships: Depot before Core. Depot accepts a request with or without `kicker`; an older Depot refuses the new field.
- Acceptance and release are not claimed.

### Owner questions (conservative defaults implemented)

- Kicker wording without exclamation marks. EN uses "Badge earned", "Learning streak" and "Goal reached"; es-MX and pt-BR follow the existing glossary ("Insignia ganada", "Insígnia conquistada").
- The achievement marks reuse the house course badge, streak flame and Save pocket drawings, not new illustrations. The owner may commission dedicated share art under the same slots.
- A label over 80 characters is replaced whole by the generic label, not wrapped at a larger ceiling.
