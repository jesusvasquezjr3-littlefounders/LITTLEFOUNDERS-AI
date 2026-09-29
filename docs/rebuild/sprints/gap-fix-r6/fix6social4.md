# Gap-fix round 6: social (fix6social4)

Branch `codex/spec-fix6social4`. Two audited gaps. Each was checked in the code
first and each was real. Nothing here is accepted or released; statuses follow
the ledger (implementation, local verification, acceptance and release are
separate).

## Gap 1: the Bible audits never reached three Settings states

SPEC: Frontend Bible 02 §7 item 10 and 06 §7 (a new string passes Text Fit and
the Copy Budget before merge), 03 §5 (proportion audit), CLAUDE.md's SPEC rule;
E.4 as amended by OD-3 (the staff-reviewed age correction); OD-27 (2) / S-03;
OD-28 / S-04.

Verified first: `frontend/scripts/audits/synthetic-core.mjs` had no answer for
`GET /account/age-correction` (the `ok({})` fallback reads as "no correction
state", so the form and its receipts never rendered), its `/auth/age-screen`
answer never carried `birthMonthRecorded` or `adultByBirthMonth` (so the
`teenMonth` and `adultByMonth` cards never rendered on a real route), and no
audit state pressed the discoverable switch or showed it on. The preview entry
rendered only `<AgeRecordCard kind="teenMonth"/>` and never `DiscoverableCard`.

| What was built | Where |
|---|---|
| `ageScreen` scenario field merged into the age answer; the analytics answer's `canManage` follows Core for a teen who moved to adult by birth month | `frontend/scripts/audits/synthetic-core.mjs` |
| `GET /account/age-correction` answered with Core's eligibility rule (`correctionAnswer`: never a guest, a parent-created child or an under-13 origin) and Core's `OwnCorrection` shape; `POST` answered with a pending receipt | `frontend/scripts/audits/lanes/profile.mjs` |
| Real-route states on `/profile/settings`: `@teen-age-correction` (form opened by a real press on "Request a correction"), `@teen-age-correction-pending`, `@teen-age-month`, `@adult-by-month`, `@teen-discoverable-confirm` (confirmation opened by a real press on the switch), `@teen-discoverable-on`; four new scenarios | same |
| Preview focus states `account-settings@ageTeenBand`, `ageAdultByMonth`, `ageForm` (opened by a press), `agePending`, `ageApproved`, `ageRejected`, `discoverableConfirming`, `discoverableSaving`, `discoverableEnabled`, `discoverableFailed` | `frontend/src/rebuild/account/ProfileScreensPreview.tsx`, lane list `SETTINGS_FOCUS_STATES` |
| Unit tests: each preview state renders what its name promises; the form opens by the lane's own press selector; a pending request offers no second request; the lane lists every focus state; the real-route states and their scenarios exist; the correction answer refuses a child and a guest | `frontend/src/rebuild/account/settingsAuditStates.test.tsx` |

A side effect worth naming: every screened adult and teen scenario now gets
Core's real answer (`eligible: true`), so the existing `/profile/settings@adult`
and `@teen` states also show the "Request a correction" button, as they do in
production.

Not done here, by the round's rules: the audit run itself (`audit:rebuild`,
browser) is the orchestrator's final gate, so any text-fit, proportion or
copy-budget finding on the new states is still to be seen and fixed there.

## Gap 2: the social-layer brand position contradicted OD-27

SPEC: E.12; Appendix J 1.4 (Brand-Narrative Coverage Check, "present and
current"); OD-27 (1) and (2); A.1 (no copy describes behaviour that does not
exist).

Verified first: `docs/product-audit/COSMIC_NARRATIVE.md` §6 said a teen chooses
"one by one, who may see them", while migration `teen_discoverable_profile`,
`services/teenDiscoverability.ts` and `PUT /profile/discoverable` let a
16-17-year-old who opts in be seen by any signed-in account outside the closed
tier (SOCIAL-TIERS.md §1.1). §6 also never named the teen cooperative goals.
The coverage check only looked for fixed phrases.

| What was built | Where |
|---|---|
| §6 "What it is", "Not a place to be found" and the promises rewritten to the shipped layer: private by default; each follower needs the teen's yes (or, for a managed account, the parent's); a 16-17-year-old may choose to be found by signed-in members and turn it off at any time, with no messages and hidden learning stats even then; it stops at once on a flagged name or handle; small goals together with existing connections, one shared total, no rankings, a managed teen only with the parent's allowance. Every existing needle kept | `docs/product-audit/COSMIC_NARRATIVE.md` |
| The coverage check fails on the "one by one, who may see" claim while `teen_profile_discoverable` exists, and requires "private by default", "16 or 17" and "turn that off"; while `coop_goal_eligible` exists it requires "small goal together" and "no rankings" | `agent/tools/check-social-governance.mjs` |
| Mutation self-tests for each failure, plus a negative test (without the discoverable function the old sentence is not flagged) | `agent/tools/check-social-governance.test.mjs` |
| Policy note on what the check now enforces | `docs/rebuild/policies/SOCIAL-GOVERNANCE.md` |

## Verification (local)

- `frontend`: `npm run type-check`, `npm run lint` clean; vitest
  `settingsAuditStates.test.tsx` (6), `AgeRecordCard.test.tsx` (8),
  `app-routes/__tests__/auditCoverage.test.tsx` and
  `rebuild/design/auditAgeBand.test.ts` pass. The lane loads in Node with 523
  unique state ids.
- Root: `node --test agent/tools/check-social-governance.test.mjs` (17 pass),
  `check-achievement-sharing.test.mjs` (10 pass), `npm run spec:check`,
  `npm run social:check`, `npm run secrets:check` all green.
- No copy strings were added or changed (the preview reuses the existing
  `ageRecord` and `discoverable` copy), so the i18n gate was not needed.

## Open

- Run `audit:rebuild` for the new profile-lane states (orchestrator's final
  gate) and fix any finding.
- Brand and Stage 3 Safety/Trust review of the rewritten §6.
- `docs/rebuild/sprints/W3-SOCIAL-ANSWERS.md` still lists "the Settings age
  card" among audits not yet run; that stays true until the final audit run.

## Owner questions

- None new. Conservative default applied in §6: the brand position speaks of
  "signed-in members" (SOCIAL-TIERS.md §1.1: any signed-in account outside the
  closed tier), not "anyone".
