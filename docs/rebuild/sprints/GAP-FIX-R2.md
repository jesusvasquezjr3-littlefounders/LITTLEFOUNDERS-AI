# Gap-fix round 2

Lane records for the second gap-fix round of the SPEC migration. Each lane
appends its own section. Statuses follow the ledger: implementation, local
verification, acceptance and release are separate, and nothing here is
accepted or released.

## F2-family

Branch `codex/spec-fix2family`. Four audited SPEC gaps in the Family Hub,
Wallet and account area. Each gap was checked in the code first.

### 1. The tone gate reads the rebuilt Family, Tasks and Wallet copy (D.8; Appendix H 1.3; Part 3 Stage 4)

**Gap confirmed.** `agent/tools/family-copy-tone.lexicon.json` scoped only the
i18next namespaces and `common:family`. The screens mounted on `/family`,
`/tasks`, `/family-wallet` and `/wallet` render `rebuild-family.json`, which the
gate never read. Running the gate's own `findings()` over those groups found 37
hits (invite "Accept", "Rejected"/"Rechazar"/"Recusar" on memory notes,
"seguridad"/"segurança" labels, a "guardian" pending label, friend-request
"Deny").

**Built.**
- Scope: 20 `rebuild-family:<group>` subtrees (the 14 Family, Tasks and Wallet
  groups named by the audit, plus `badgeShares`, `achievementShare` and the
  four `social*` panels mounted in the Family Hub). 4,620 strings in three
  locales, 100% pass.
- Reworded in EN/es-MX/pt-BR: the invite's "Accept" is "Join" / "Unirme" /
  "Entrar" (the glossary keeps "accept" away from a Tutor's approval); the
  memory note's "Reject" is "Discard" / "Descartar"; the social pending label
  names the Tutor instead of a "guardian".
- 7 reviewed exceptions: the console's "Privacy and safety" section label, the
  two Mentor safety-review event labels, the two friend-request refusals and
  the two "safety notices" labels. None is about coins.
- Coverage rule in the gate: a surface under `scope.surfaces` that names a
  `rebuild-family.json` group, or loads an i18next namespace, outside the
  scope fails the gate.
- B.14's UI lexicon (`coursegen/src/contentGates/tone.ts` `TONE_LEXICON`,
  parsed from source, folded matching) runs as a fifth category, `b14_ui`.
  It finds nothing today.

**Where.** `agent/tools/check-family-copy-tone.mjs` (+ test),
`agent/tools/family-copy-tone.lexicon.json`,
`frontend/src/i18n/*/rebuild-family.json`,
`docs/operations/FAMILY-COPY-TONE-GATE.md`.

**Verified.** `node --test agent/tools/check-family-copy-tone.test.mjs` (27,
including the coverage refusals); the gate CLI; i18n gate; copy-budget and the
touched panel tests.

**Remains.** The Stage 4 human spot-check and native copy review of the
reworded keys.

### 2. The Tutor sees a child's story choices on /family (OD-27 (3); B.9/B.10)

**Gap confirmed.** `ChildDecisionsPanel` was imported only by its test and
the preview; `routes/app/family/LearningPanels.tsx` mounted the narrative,
bridges and streak pause, not the decisions panel, although Core serves
`GET /family/learning/kids/:kidId/decisions`.

**Built.** `LearningDecisionsPanel` in `routes/app/family/LearningPanels.tsx`
(keyed by child and session, the Family Hub transport, locale and mode) hosts
the real `ChildDecisionsPanel`; `FamilyPage.tsx` renders it in the child's
`learning` group right after the narrative. Core stays the only judge: a teen's
journal answers `JOURNAL_PRIVATE` and the panel renders nothing, not even a
heading. Audit: `/family@story-choices` (scenario `family-two`, KID_A opened)
with a synthetic Core fixture in all three locales; `/family@teen-selected`
now also exercises the private answer for KID_B.

**Verified.** `FamilyPageDecisions.test.tsx` (the real panel: an under-13
child's choice appears after one press, beside the narrative; a teen's private
journal leaves no section); `FamilyPage.test.tsx` (the panel receives the
child in view); frontend type-check and lint of touched files.

**Remains.** The browser audit run of the new state (orchestrator's merge
gates).

### 3. A young adult is asked again when the Tutor's research yes lapses at 18 (H-25; D.22; OD-9 4.2)

**Gap confirmed, and one layer deeper than audited.** Core served
`/family-hub/research/me` only to wallet holders, and a linked teen stops being
one at 18, so the young adult could not even read the lapsed state; the panel
lived only on the wallet pages; the client had no yes call. The database also
refused the young adult's own yes: `family_research_set_consent` required
`wallet_holder_kind` for every yes, and it is NULL for a former linked teen at
18 (reproduced on native PostgreSQL before the fix).

**Built.**
- `database/migrations/0215_family_research_reconsent_at_18.sql` (expand):
  `family_research_set_consent` also admits an adult's own yes while they hold
  an active consent row (the lapsed Tutor one, or their own). The lapsed row is
  replaced, never revived, so the months recorded as a child stay under their
  own consent; a repeated yes to the same disclosure changes nothing; a no
  deletes every snapshot. `family_research_admitted` is unchanged: an adult
  without a wallet is not recorded further in this phase.
- Core (`backend/src/routes/familyGovernance.ts`): GET/PUT `/research/me`
  admit any signed-in non-guest account (guests 403 `GUEST_NOT_ALLOWED`); the
  database decides who may answer. The wire gains `lapsed` (participating,
  grantor tutor, adult, not recording). The self-yes audit row now carries the
  disclosure version.
- Frontend: `joinMyResearch` in `governanceApi.ts`; `rebuild/family/AdultResearch.tsx`
  (the lapsed ask: one sentence, what and how, Yes / No, nothing preselected;
  an adult's own participation with a confirmed stop);
  `AdultResearchPanel` in `routes/app/family/GovernancePanels.tsx`, mounted by
  `app-routes/ResearchSetting.tsx` in Settings (moved from `routes/app/profile/` in the next commit: the legacy-UI gate freezes that directory). The child's wallet note
  (`MyResearch`) no longer shows to an adult. Copy group
  `familyGovernance.researchAtEighteen` in three locales (adult band, Copy
  Budget and first-view budget pinned).
- `docs/operations/BLOCK-D-LONGITUDINAL-RESEARCH-PLAN.md` updated.

**Verified.** `database/scripts/verify-research-reconsent-postgres.py` on
native PostgreSQL 17.6 (lane cluster, port 15840): the gap reproduced before
the migration, then the yes, the kept history, the no that deletes, and the
refusals (Tutor for an 18-year-old, a 17-year-old for themselves, an adult with
no lapsed consent, a guest, a stale disclosure). Core
`familyGovernance.test.ts` (60, including the lapsed read without a wallet, the
self grant with its audit row, the no with its audit row, the guest refusal).
Frontend `ResearchSetting.test.tsx` (7), governance copy contract, family and
wallet suites; type-check and lint clean; database migration gates green.

**Remains.** The adult measures and their own disclosure (research plan phase
2); native copy review.

### 4. A linked teen's own deletion tells each verified Tutor (D-14 (b); E.6; OD-3 section 2)

**Gap confirmed.** `POST /account/deletion` scheduled a teen's request and
revoked sessions without reading guardian links; migrations 0116-0118 hold no
notice; the erasure removes the link. `ACCOUNT-DELETION.md` still assumed links
exist only for parent-created children.

**Built.**
- `database/migrations/0216_teen_deletion_guardian_notices.sql` (expand):
  `account_deletion_guardian_notices` (ids and a timestamp only; RLS, the named
  Tutor reads, no browser writes; both user columns cascade, so the erasure
  takes the teen's notices with the account); the AFTER INSERT trigger
  `notify_guardians_of_teen_deletion` writes one notice per verified guardian
  link of a self-initiated `teen` request and the audit row
  `account.deletion_guardians_notified` in the request's own transaction;
  `guardian_deletion_notices(p_guardian)` (service only) returns open notices
  with the display name and date, so a cancelled request drops out.
- Core: `backend/src/routes/account.ts` reads the teen's verified Tutors
  before scheduling (unreadable = 502, nothing scheduled) and returns
  `tutorsTold` on GET and POST; `GET /family-hub/deletion-notices` (parent
  role) via `backend/src/services/teenDeletionNotices.ts`.
- Frontend: `rebuild/family/TeenDeletionNotices.tsx` (name, date, "can keep it
  by signing in"; no control) hosted by `app-routes/TeenDeletionNoticesPanel.tsx`
  in the Family console's aside on `/family`; the teen's confirm step says
  "We tell your Tutor the deletion date." (`accountDeletion.tutorToldOne/Many`).
  Copy group `familyDeletionNotices` in three locales, in the tone gate's scope
  and the family copy-budget test. Audit state `/family@teen-deletion-notice`.
- `docs/rebuild/policies/ACCOUNT-DELETION.md` updated (population row and the
  resolved open item).
- The gap-3 Settings adapter moved from `routes/app/profile/` to
  `app-routes/ResearchSetting.tsx`: the legacy-UI gate (`spec:check`) refuses new
  files under `routes/`.

**Verified.** `database/scripts/verify-teen-deletion-notices-postgres.py` on
native PostgreSQL 17.6: the gap shown before the migration; two verified
Tutors told, a pending link not; one audit row; an unlinked teen and an adult
tell nobody; RLS (each Tutor only their own; no browser writes or function
call); a cancel drops the notice with no second one; a new request tells
again; the erasure removes the notices; replay. `verify-account-erasure-postgres.py`
re-run on the new chain: 16 checks green. Core `accountDeletion.test.ts`
(linked teen told in the request's step, read before scheduling; unlinked teen
and adult tell nobody; cancel needs no second notice; unreadable links schedule
nothing) and `familyGovernance.test.ts` (the Tutor's read, 502 on malformed,
every non-Tutor refused). Frontend `TeenDeletionNoticesPanel.test.tsx`,
`AccountDeletion.test.tsx`, `deletionClient.test.ts`, copy budgets; i18n,
tone, spec and secrets gates green.

**Remains.** Email delivery of the notice (in-app only today, zero spend);
native copy review; the browser audit run of the new state.

### Verification summary (lean mode)

Per checkpoint: focused Core and frontend vitest files, type-check and lint of
touched files in each service, `npm run spec:check`, `npm run secrets:check`,
the i18n gate, the tone gate and its tests, and the database migration gates;
two new native PostgreSQL verifiers (`verify-research-reconsent-postgres.py`,
`verify-teen-deletion-notices-postgres.py`) plus the account-erasure verifier.
No browser matrix, no `audit:rebuild`, no full suites (orchestrator runs them
at merge).

### Decisions taken with the conservative default (owner questions)

1. D.8 scope: the four `social*` Family Hub panels and `badgeShares` /
   `achievementShare` joined the tone gate, with reviewed exceptions for the
   friend-request "Deny" and the "safety notices" labels. The invite's
   "Accept" became "Join" (glossary: approve, never accept).
2. H-25: a young adult's own yes keeps what was recorded as a child, but
   nothing more is recorded while they hold no wallet; adult measures wait for
   a later phase with their own disclosure.
3. H-25: the child's wallet research note no longer shows to an adult; the
   adult answers in Settings only.
4. D-14 (b): the notice is in-app on `/family`, not email; the Tutor sees open
   requests only, and a cancelled one disappears silently (no "kept" notice).
   Only population `teen` self-requests notify; an adult with a leftover link
   notifies nobody.
5. D-14 (b): the teen is told before confirming that their Tutor gets the date.

### Migrations (renumbered by the orchestrator at merge)

- `0215_family_research_reconsent_at_18.sql` (expand)
- `0216_teen_deletion_guardian_notices.sql` (expand)

### F2-family-finish (lane close)

**Sync.** `codex/spec-migration-s02` was already contained in the lane
(`Already up to date`); no conflicts.

**Adversarial pass over the four audited gaps.** D.8, OD-27 (3), H-25 and
D-14 (b) are each built end to end: database (where a rule lives there), Core
route with the refusals tested at the boundary (guest 403 on
`/family-hub/research/me`, non-parent 403 and unreadable-link 502 on
`/family-hub/deletion-notices`, 502 before scheduling a teen deletion when the
Tutor links are unreadable), rebuilt UI from `rebuild/design/controls` only
with `data-copy-role`, and copy in EN/es-MX/pt-BR. One real defect was found
by the full Core suite: the OD-9 4.2 "tables tying two accounts" pin in
`backend/src/__tests__/dataPractices.test.ts` did not know the new
`account_deletion_guardian_notices` table. It is now listed as a reviewed
exemption (an owner-mandated D-14 (b) safeguard to an already verified Tutor,
ids only; not a sharing surface), rather than consent-gated, which would
contradict D-14 (b).

**Final verification.** Core and frontend: `type-check`, `lint` and the full
unit suite once each; `database` `npm test`; root `tools:test`,
`spec:check`, `secrets:check` and the i18n gate. All green: Core 3,225
tests after the exemption above (the one red was that pin); frontend 267 files
/ 3,051 tests (a first run under four concurrent lanes' load had 4 timing reds
in files this lane never touched, the rerun was clean); `database` 48 tests
plus the railway-migrate integration; `tools:test` 389 tests. The orchestrator
runs the browser audit and `test:all` at merge.

**Still open.** Browser audit of `/family@story-choices`,
`/family@teen-deletion-notice` and the Settings research ask; email delivery
of the D-14 (b) notice (in-app only, zero spend); adult research measures
(research-plan phase 2); native review of the reworded copy and the Stage 4
human spot-check of the tone gate; migrations 0215/0216 renumbered at merge.
