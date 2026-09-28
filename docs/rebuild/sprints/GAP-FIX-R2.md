# Gap-fix round 2

Lane records for the second gap-fix round of the SPEC migration. Each lane
appends its own section. Statuses follow the ledger: implementation, local
verification, acceptance and release are separate, and nothing here is
accepted or released.

## Checkpoint F2-identity-site

Branch `codex/spec-fix2identity`. Three audited gaps in the identity and
public-site area. Each was checked in the code first; all three were real.

### What was built

| # | SPEC clause | Gap confirmed in code | What was built | Where |
|---|---|---|---|---|
| 1 | A.2; Appendix M 1.1 (Unconsented Analytics Event Rate, flagged sessions: target zero); Part 2.2(b) | `POST /onboarding/complete` wrote `discovery_channel` for every account, with no origin, role or analytics check; O1 always asked | One predicate, `admitsAcquisitionAnswer` (not required, not under-13 origin, a confirmed non-kid role, `allowsSelfManagedAnalytics`), now used by `attributeSignup`, the onboarding route and `/auth/me`. Onboarding stores the answer only when it holds and otherwise writes `null`, still recording `account_offer_choice` as the completion marker (a failed role read discards it too). `/auth/me` returns `discoverySurvey`; `AuthContext` exposes it and O1 drops the step (progress reads "n of 4", mentor goes straight to the account step, no channel is sent). Migration `onboarding_discovery_metrics`: scrubs earlier answers of refused populations (under-13 origin, kid, under-13 declaration, teen without opt-in, a teen promoted by birth month who said no) and adds `onboarding_discovery_metrics()` (service role, counts only). Core reads it beside `identity_metrics`; the report gains the release-gate metric `onboarding_discovery_unconsented` (share of stored answers that are admitted; met means zero unconsented rows), labelled on the staff Trust view in three locales | `backend/src/services/analyticsPreference.ts`, `routes/onboarding.ts`, `routes/auth.ts`, `services/insights.ts`, `services/identityMetrics.ts`, `database/migrations/0215_onboarding_discovery_metrics.sql`, `frontend/src/auth/AuthContext.tsx`, `rebuild/identity/OnboardingFlow.tsx`, `routes/onboarding/OnboardingPage.tsx` |
| 2 | A.1; Appendix M 1.4; owner answer H-20; Law 5 | The FAQ and the console switch promised per-child usage analytics; every optional gate drops an under-13 origin's events whatever the consent (`insights.ts`, `events.ts`), so for 6-12 the switch only ever enrolled the M-12 tween test | FAQ `analyticsToggle` rewritten (EN, es-MX, pt-BR): under 13 no usage data is ever collected; for a teen it stays off until their Tutor or the teen turns it on. `GET /family/kids` returns `under13` (`readUnder13Accounts`: the origin or an under-13 declaration). The console shows, for such a child, the one-line fact and no usage-data switch; where `dialogueExperiment` is true (a 10-12 child with a known birth date) the switch stays, relabelled "Hint-style test" with its own help line. `POST /family/kids/:kidId/analytics-consent` refuses any other under-13 grant with 403 `ANALYTICS_NOT_COLLECTED_UNDER_13`; revoking stays allowed | `backend/src/services/ageScreen.ts`, `routes/family.ts`, `frontend/src/rebuild/family/console/ChildControls.tsx`, `consoleApi.ts`, `src/i18n/*/rebuild-site.json`, `rebuild-family.json` |
| 3 | Bible 02 D3, D4, D8, rules 2 and 21; 07 §1 and §3 | `og-card.html` loaded Inter/Sora from Google Fonts, used the indigo radial gradient, a gradient rule, drop shadows, the raster logo (gradient text, stock figures) and unregistered busts; `themeColor #4f46e5`, manifest background `#0b1120`, JSON-LD logo and every icon were the legacy logo | New own asset `brand.mark` (`public/rebuild/brand/mark.svg`: flat tile in primary with its ridge, three white rising bars and a reward coin; 2 hues plus white; registered in the manifest, new review family `brand`). The asset gate accepts an asset used outside the app when its row names a `consumer` script under `scripts/` that carries the asset path (mutation-proved). `scripts/seo/render-icons.mjs` (`npm run seo:icons`) draws `favicon-48.png`, `favicon.ico` (32+48 PNG entries), `apple-touch-icon.png` (on primary), `icon-192.png` and `icon-512.png` from it; `scripts/seo/cdp.mjs` holds the server, Chrome launch (Windows paths added) and CDP client both renderers share. `og-card.html` rewritten: solid primary ground, Fredoka and Nunito from `public/fonts`, the mark beside the text wordmark, the four Mentors as `mentor.<id>.avatar.light` renders on a flat ridge band; cards re-rendered for 3 locales. `site.mjs`: `themeColor #5c55fd`, `manifestBackground #0b0d1b`, `logoPath /icon-512.png` (JSON-LD). `check-seo-surface` gains `auditBrand`: fails on a non-token theme or manifest colour or a non-mark logo (4 new gate tests). Deleted from `public/`: `logo-main.png`, `logo-main-trimmed.png`, `favicon.png` (the 2553 px legacy master), `Hero-Families.webp` and the whole unreferenced `marketing/` folder (Pexels stock, the photo atlas, busts, legacy videos and its CREDITS.md) | `frontend/public/rebuild/brand/mark.svg`, `src/rebuild/assets/manifest.json`, `scripts/check-rebuild-assets.mjs`, `scripts/seo/*`, `agent/tools/check-seo-surface.mjs` |

### Verification (local)

- Core (vitest, focused): `onboarding.test.ts` (15: six refused populations never persist the channel and still complete, an opted-in teen does, `/auth/me` discoverySurvey), `analyticsPreference.test.ts`, `staffOps.test.ts` (14: the new metric, a malformed discovery answer 502s, a flagged stored answer misses), `family.test.ts` (86: `under13` for origin, declaration and teen; 8-year-old, 9-year-old and undated under-13 grants refused and nothing stored; declaration-only refused; 11-year-old accepted; revoke allowed; unreadable age 502), `insights.test.ts`, `familyKids.test.ts`. Backend type-check and lint clean.
- Native PostgreSQL 17.6 (owned cluster, port 15800): `verify-staff-ops-postgres.py` applies every migration in order and passes 18 checks, two new: the metric counts answers from refused populations and only the service role reads it; the migration's scrub nulls the refused answers, keeps every completion marker and the admitted answer.
- Frontend (vitest, focused): `identity.test.tsx` (29, including the 4-step flow with no discovery step and a null channel), `OnboardingPage.test.tsx` (13, a flagged guest is never asked and sends no channel), `AuthContext.test.tsx`, `FamilyConsole.test.tsx` (3 new: no switch under 13, the hint-style test switch alone for a 10-12 child, the switch kept for a teen), site tests. Type-check and lint clean; i18n gate green.
- Asset gate: `check-rebuild-assets.mjs` passes with OCR (118 rasters free of text, 146 class B assets). The three new mutation cases in `assetGate.test.ts` (consumer drops the path, consumer outside `scripts/`, off-token mark colour) were proved by running the gate by hand on a copied tree; the vitest file itself timed out at 90 s per case on this machine, pre-existing cases included, because the first read of each fresh temp tree takes about 50 s here (a second run on the same tree takes 7 s). Left to the orchestrator's quiet run.
- SEO: `seo:check` green, `check-seo-surface.test.mjs` 18/18; `seo:icons` and `seo:cards` rendered; one share card (pt-BR) and the 192 px icon inspected by eye.
- Root: `spec:check` (exit 0) and `secrets:check` green.
- Not run here (orchestrator, per merge): browser matrices, `audit:rebuild`, full suites, a production build (`build-seo.mjs` runs after `vite build`).

### Decisions taken with the SPEC's conservative default (owner questions)

1. **Adult guest discovery answer.** The predicate is signup attribution's, so an adult guest's answer is kept (as before) while a guest's usage beacon stays off. Acquisition self-report from a declared adult is treated like attribution, not like product analytics.
2. **Earlier answers scrubbed.** The migration nulls stored discovery answers of refused populations instead of only measuring them, so the metric starts at zero once applied. The completion rows stay.
3. **`lf-logo-email.png` kept.** The task listed it as unreferenced, but README says it stays because account emails already delivered link to it. Deleting it breaks those messages' images, so it is kept. The staff analytics PDF no longer uses it (see the finish checkpoint).
4. **Mentor art on the card** uses the `mentor.<id>.avatar.light` renders (square, transparent), not the chooser stills (which carry the Diorama).
5. **Brand mark design** is ours and in draft: the new `brand` review family awaits the owner's first-asset style review (07 §7 item 2).

### Migrations (renumbered by the orchestrator at merge)

- `0215_onboarding_discovery_metrics.sql` (expand: a data scrub to NULL, a value every deployed reader accepts, plus a new function)

### Open items

- (Closed at the finish checkpoint) The staff analytics PDF report embedded the legacy raster wordmark.
- `database/types/database.ts` not regenerated for the new function (Core reads it untyped through `serviceRest`, as it does `identity_metrics`).
- `assetGate.test.ts` needs the orchestrator's quiet run (see verification).

## Checkpoint F2-identity-site-finish

Lane finish for identity-site. Synced with `codex/spec-migration-s02` (already
up to date, no conflicts).

### Adversarial pass and what it built

- **Staff analytics report PDF (02 D3, D4, D8; 07 §1 and §3).** The last
  outbound document still inlined the legacy raster wordmark. `drawLogo` now
  draws `brand.mark` as pdfkit vectors from the asset's own 64-unit geometry
  beside a text wordmark; the report palette moves from the legacy
  indigo/slate set to the rebuilt light tokens; `backend/src/assets/lfLogo.ts`
  (the base64 PNG) is deleted. `analytics-report-pdf.test.ts` asserts no image
  object in the report and the mark's token fills in the uncompressed lockup.
  `lf-logo-email.png` itself stays in `public/` (delivered emails link to it).
- **FAQ copy budget.** The full frontend suite caught the rewritten en-US
  `analyticsToggle` answer at 27 words against the site body budget of 25; it
  now reads "Under 13, we never collect usage data. For a teen, it stays off
  until their Tutor or the teen turns it on." (22 words; es-MX and pt-BR were
  within their budget).
- Re-checked: all three gaps are enforced at Core (the onboarding predicate,
  the 403 on under-13 analytics grants), no legacy component in the rebuilt
  console or onboarding, new copy present in all three locales (i18n gate
  green), no remaining reference to the deleted `public/` rasters.

### Verification (local, lane finish)

- Backend: type-check and lint clean; full unit suite run once: 9 red, all in
  files this lane did not touch (admin, auth, coopGoals, learnNarrative,
  socialGovernance; 5 s timeouts while three other lanes ran suites), and all
  five files pass alone (223/223).
- Frontend: type-check and lint clean; full unit suite run once (264 files,
  3,040 tests): the copy-budget red above (fixed, `site.test.ts` 6/6);
  `StaffInsights.test.tsx` and `App.test.tsx` timeouts that pass alone;
  `assetGate.test.ts` timed out again (see the open item).
- Root: `spec:check`, `secrets:check` and the i18n gate green.

### Open items (final)

- `assetGate.test.ts` still needs a quiet-machine run; its cases time out here
  (fresh temp trees read slowly; the gate logic was proved by hand).
- `database/types/database.ts` not regenerated for
  `onboarding_discovery_metrics()` (read untyped through `serviceRest`).
- Owner first-asset style review of the new `brand` review family
  (`brand.mark`, 07 §7 item 2); the PDF lockup and icons follow it.
- Production (later, owner): migration `onboarding_discovery_metrics` plus a
  Core and frontend deploy; icons, share cards and the PDF ship with them.

### Merge integration (F2-identity-site into `codex/spec-migration-s02`)

- The merge was clean: no textual conflicts, and no integration defect was
  found on the merged tree.
- Migrations: the lane's `0215_onboarding_discovery_metrics.sql` already
  follows the integration branch's highest number (`0214`), so it kept its
  number. It is 4,476 bytes, under the 23,000-byte limit.
- Checks on the merged tree: `typecheck:all`, `lint:all`, `spec:check`
  (asset gate now lists the `brand` family as awaiting review; Wallet
  glossary and dark-pattern gates green), `secrets:check`, the i18n gate,
  backend unit tests (3,227 passed, 1 skipped), frontend unit tests (3,040
  passed) and `database` `npm test`, all green.
