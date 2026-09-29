# Gap-fix round 3

Lane records for the third gap-fix round of the SPEC migration. Each lane
appends its own section. Statuses follow the ledger: implementation, local
verification, acceptance and release are separate, and nothing here is
accepted or released.

## F3-data-platform

Branch `codex/spec-fix3dataplat`. One audited gap: OD-9 section 4.2, OD-27 (2)
(S-03) and OD-10 for the 16-17 discoverable profile.

### Gap confirmed in code

OD-9 section 4.2 says any new sharing surface the rebuild introduces needs a
fresh, specific consent before it applies to a migrated child. OD-27 (2) added
one: a 16- or 17-year-old may make the whole profile visible to any signed-in
account and listable (`teen_discoverable_profile`, 0184). The gap was real:

- The registry (`od9_legacy_migration` 0186, plus `sharing.cooperative_goals`
  in 0202) had no discoverable-profile entry.
- `teen_discoverable_eligible` and `set_teen_profile_discoverable` never asked
  `data_practice_applies`. `od9_consent_enforcement` (0187) had no trigger or
  check on `teen_profile_discoverability`.
- Core (`services/teenDiscoverability.ts`, `PUT /profile/discoverable`) never
  asked the practice.
- The OD-9 pin (`backend/src/__tests__/dataPractices.test.ts`) deferred the
  table to the owner's answer; S10-CUTOVER and GAP-FIX-R1 left it open.

So a self-registered teen that `od9 consent --apply` marks in
`legacy_consent_subjects` could turn on public discoverability with no consent.

### What was built

| # | SPEC clause | What was built | Where |
|---|---|---|---|
| 1 | OD-9 4.2; OD-27 (2); OD-10 | Registers `sharing.discoverable_profile`: kind `sharing_surface`, requirement `E.8/OD-27`, consent source `data_practice_consents`, `teen_self_consent` false like every other sharing surface. A verified Tutor answers it; the teen alone cannot. | `database/migrations/0228_discoverable_profile_data_practice.sql` |
| 2 | OD-9 4.2 | `teen_discoverable_eligible` keeps the whole S-03 rule inline and also requires `data_practice_applies(p_user, 'sharing.discoverable_profile')`. `teen_profile_discoverable` reads it on every visibility decision (Core and `social_subject_visible`), so an opt-in recorded before the marking lapses by itself (no sweep, the stored choice kept) and a revoked consent hides the profile at once. New `teen_discoverable_base_eligible` (the S-03 rule alone, service role only) decides nothing; it only names the reason. | same migration |
| 3 | OD-9 4.2 | `set_teen_profile_discoverable` refuses every opt-in the eligibility function refuses: `DATA_PRACTICE_CONSENT_REQUIRED` when the account is otherwise eligible and only the consent is missing, `DISCOVERABLE_NOT_ELIGIBLE` otherwise. Turning it off always works. Same signature, return shape and grants. | same migration |
| 4 | OD-9 4.2 at the Core boundary | `readTeenDiscoverability` asks `data_practice_applies` (through `readDataPracticeApplies`) and `teen_discoverable_base_eligible` when the account is not eligible, and reports `reason: 'DATA_PRACTICE_CONSENT_REQUIRED'` only when the consent is the one thing missing (never for a 13-15-year-old; an unreadable answer names nothing). `GET /profile` and the `PUT /profile/discoverable` receipt carry `social.discoverable { canChoose, enabled, reason }`; the refusal maps to 403 `DATA_PRACTICE_CONSENT_REQUIRED`. | `backend/src/services/teenDiscoverability.ts`, `backend/src/routes/profile.ts` |
| 5 | OD-9 4.2 (Family Hub panel); 06 Copy Budget | The practice is in the client's known keys, and the `dataPractices` copy labels it in EN, es-MX and pt-BR, so a linked verified Tutor can answer it in the Family Hub `DataPracticeConsent` panel (Shared with others group). | `frontend/src/rebuild/family/dataPracticesApi.ts`, `frontend/src/i18n/*/dataPractices.json` |
| 6 | OD-9 4.2 (Settings) | Settings shows the card without a switch and one line, "A Tutor must allow this first." (3 locales), when Core names the reason on read or refuses a write with it. Any other reason names nothing and the card stays hidden. | `frontend/src/rebuild/account/DiscoverableCard.tsx`, `frontend/src/routes/app/profile/DiscoverableSetting.tsx`, `frontend/src/i18n/*/rebuild-profile.json` |
| 7 | Gates | The OD-9 pin's deferral comment is replaced by a real mapping: pre-registry sharing surfaces (`teen_profile_discoverability` to `sharing.discoverable_profile`) must be registered as a Tutor-answered sharing surface and the latest `teen_discoverable_eligible` must ask the practice. `social:check` now fails if the latest eligibility function drops the practice or the setter stops naming the missing consent. The OD-9 fixture registry lists the new practice (16 practices). | `backend/src/__tests__/dataPractices.test.ts`, `agent/tools/check-social-tiers.mjs` (+ test), `database/migration-od9/fixtures/generate-legacy-fixture.mjs` |
| 8 | Policy | SOCIAL-TIERS.md section 1.1 gains the migrated-teen rule and the wire field. S10-CUTOVER and GAP-FIX-R1 point their open notes here. | `docs/rebuild/policies/SOCIAL-TIERS.md` |

### Verification (local)

- **Native PostgreSQL 17.6** (lane cluster under `.lane-cache/pg`, port 15970, full 228-migration chain): `verify-teen-discoverable-postgres.py` 11/11. The 5 new checks cover a self-registered 16-17 (one with a linked verified Tutor, one independent): unaffected before marking; once marked, not eligible, an earlier opt-in hidden from every viewer with the stored choice kept, turning it on refused as `DATA_PRACTICE_CONSENT_REQUIRED` with nothing written; the teen cannot consent alone and neither can an unrelated adult, so the independent teen stays private; `data_practice_state` lists the practice for the Tutor, and after the Tutor's audited consent the teen is eligible again and the earlier choice applies; a revoked consent hides it at once, and turning it off still works and is audited. `prove-od9-postgres.mjs` 15/15, including 16 rebuild practices in the consent carry-over.
- **Unit and contract tests:** backend `socialTiers` (52 tests, including 6 new OD-9 cases), `dataPractices`, `profile`; frontend `SettingsRoute` (3 new), `DataPractices`, copy-budget `profile`, `OwnProfileRoute`; `check-social-tiers.test.mjs` (23 tests); `database`: `check-migrations` (228 files), `check-migration-phase` and `migration-od9/od9.test.mjs` (15 tests, the registry mirror). The rest of `database` `npm test` was not completed here: its `railway-migrate.test.mjs` (a fake-CLI test of an untouched script) ran over 20 minutes under the other lanes' load and was stopped; the orchestrator's full gates cover it. Type-check and lint in backend and frontend; root `spec:check`, `social:check`, `secrets:check` and the i18n gate.

### Decisions taken with the SPEC's conservative default (owner questions)

1. **Tutor-only consent.** `teen_self_consent` is false, like every sharing surface (OD-10). A marked independent teen (Option B, no verified Tutor) cannot become discoverable until a Tutor links and consents. Should a migrated 16-17 with no Tutor be able to consent to this one practice alone?
2. **A consent revives an earlier opt-in.** A teen's opt-in recorded before the marking is kept, not cleared. It lapses while the practice does not apply and applies again once the Tutor consents, the same way a fixed flag restores it (S-03). The conservative alternative is to require the teen to opt in again after the consent. The owner should say whether a fresh opt-in is needed.

### Migrations (renumbered by the orchestrator at merge)

- `0228_discoverable_profile_data_practice.sql` (`@phase: expand`, additive: one registry row and three function replacements, no table). Until the OD-9 consent step marks migrated children at the cutover, every function answers as before. Apply before the Core release of this lane (the new Core reads `teen_discoverable_base_eligible` only for a teen who is not eligible, and treats a failed read as no reason).

### Open items

- `database/types/database.ts` does not yet declare `teen_discoverable_base_eligible`. Regenerate with the official generator after the merge, together with the other lanes' schema.
- The profile audit lane driver did not capture the consent-required card state. Resolved at the lane finish (below).
- Acceptance and release remain.

## F3-data-platform lane finish

Branch `codex/spec-fix3dataplat`, synced with `codex/spec-migration-s02`
(already up to date, no conflicts).

### Final summary

The one audited gap is closed in code: the 16-17 discoverable profile
(OD-27 (2), S-03) is the registered OD-9 section 4.2 practice
`sharing.discoverable_profile`, a Tutor-answered sharing surface (OD-10). The
database is the authority (eligibility, setter and every visibility read ask
the practice); Core names the one missing condition and maps the refusal to
403 `DATA_PRACTICE_CONSENT_REQUIRED`; the Family Hub consent panel lists the
practice for a linked verified Tutor; Settings says "A Tutor must allow this
first." with no switch. Everything else answers as before until the OD-9
consent step marks migrated children at the cutover.

### Adversarial pass (against the SPEC scope)

- Authorization at the server: the setter refuses in the database, Core maps
  the refusal, and nothing in Core or the SPA reads `teen_profile_discoverability`
  directly (only the three database functions do). The teen cannot answer the
  practice alone and an unrelated adult cannot answer it (native PostgreSQL
  checks, F3-data-platform). The Family Hub routes take the practice key from
  the database registry, not a Core allowlist.
- Rebuilt UI: `DiscoverableCard` uses only the shared controls (`Card`,
  `Copy`, `InlineNotice`, `Switch`, `ConfirmDialog`); no legacy component.
- Copy: the Settings line and the practice label exist in EN, es-MX and pt-BR
  (i18n gate identical key sets); "Tutor" is the verified parent only.
- Built at the finish: the profile audit lane driver now reaches the
  consent-required state (`app:/profile/settings@teen-consent-required`,
  scenario `settings-teen-consent`, ready on the card's notice).

### Verification at the finish

- Native PostgreSQL 17.6: as recorded in F3-data-platform (verifier 11/11,
  OD-9 proof 15/15); no SQL changed since.
- Backend: type-check, lint, full unit suite (147 files, 3342 tests passed,
  1 skipped).
- Frontend: type-check, lint, full unit suite (271 of 272 files passed in the
  full run; `App.test.tsx`, untouched, timed out once at 5 s under the
  concurrent backend suite and passed when rerun alone). ESLint on the edited
  audit driver.
- Database: `npm test` checks and node tests passed (`check-migrations`,
  `check-migration-phase`, `check-family-lifecycle`, 48 node tests including
  the OD-9 and social-db suites). `railway-migrate.test.mjs` (untouched, a
  fake-CLI test that spawns bash per scenario) was still running after more
  than 40 minutes, alongside the same test from four other lanes; its result
  is not claimed here.
- Root: `spec:check`, `secrets:check`, `social:check` (and its 23 tests), the
  i18n gate.
- Bible audits on the real app (lane Vite on 5970, synthetic Core) for
  `app:/profile/settings@teen-consent-required`: text fit 96, proportion 24
  and copy budget 24 configurations (3 locales x 2 themes x 4 widths), no
  findings, no JS errors.

### Still open

- `database/types/database.ts` does not declare
  `teen_discoverable_base_eligible`; regenerate with the official generator
  after the merge.
- Owner questions 1 (Tutor-only consent for a marked independent teen) and 2
  (a consent revives an earlier opt-in) above; the conservative defaults are
  implemented.
- Acceptance and release of E.8 / OD-9 4.2 for this surface.
