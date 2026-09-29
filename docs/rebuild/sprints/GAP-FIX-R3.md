# Gap-fix round 3

Lane records for the third gap-fix round of the SPEC migration. Each lane
appends its own section. Statuses follow the ledger: implementation, local
verification, acceptance and release are separate, and nothing here is
accepted or released.

## Checkpoint F3-social

Branch `codex/spec-fix3social`. One audited gap: a Tutor could approve a
connection for their child but could not end or report it.

### The gap, confirmed in code

- Core's family router had only the graph, pending requests, decision, history
  and safety-notice routes (`backend/src/routes/family.ts`). No route ended a
  child's follow or approval in either direction, and none reported from the
  guardian's side.
- The database had no guardian-side end: `withdraw_social_connection` is the
  follower's own unfollow, `remove_social_follower` the followed account's own
  tool, `decide_social_connection` settles only pending requests, and the
  retention sweep removes an edge only when the approving guardian is no longer
  current.
- `rebuild/social/SocialGraph.tsx` and `SocialNotices.tsx` were display-only.

### What was built

| SPEC clause | What was built | Where |
|---|---|---|
| E.1, E.13; Block E components 1-2; OD-3 §2 | `public.guardian_end_social_connection(p_guardian, p_kid, p_other)`, service role only. Pair locks in both directions (the block trigger's order), guardian evidence locked, `social_guardian_is_current` re-checked (verified link, parent role, latest verification adult and local-ocr), a child outside the guardian tier refused (`SOCIAL_SELF_MANAGED`), 0 and no write when there is no follow. Otherwise it revokes every approved request between the pair (either direction), closes a teen consent between them, deletes the follow both ways and writes one `social.connection_revoked` row (actor the guardian, reason `guardian_ended`, `kid_user_id`, `guardian_id`, `other_user_id`, request ids, removed edges, origin `database-function`). Returns the number of removed edges | `database/migrations/0228_guardian_end_social_connection.sql` |
| E.2; Appendix J Audit-Log Completeness | The same migration redefines `social_protection_metrics`: a service-role unfollow row (no actor) counts as audited when a `guardian_ended` row with the same transaction timestamp names the same pair. Core records each removed edge as an `unfollow` event, so the reconciliation stays at 100% | same migration; `backend/src/routes/family.ts` |
| E.1, E.13 | `DELETE /api/v1/family/kids/:kidId/social/connections/:userId`: `guardKid` before and after the write, 400 for a malformed or self target or any query, 404 when the account is not a current connection (checked before the write, and again when the transaction removes nothing), 403 for a stale guardian or a self-managed teen, 502 on an unreadable read or receipt | `backend/src/routes/family.ts`, `services/supabaseRest.ts` (`isSocialConnection`, `guardianEndSocialConnection`) |
| E.3 | `POST .../connections/:userId/report`: the bounded report body (5 categories, 140-character note), the guardian as reporter, admitted only for a current connection of the child or an account named in this guardian's notice for this child; calls `submit_social_report`, so it reaches the staff queue, the guardian notices and the pattern evaluation | same files (`hasGuardianSocialNotice`) |
| E.1, E.2, E.3 (Family surfaces) | The graph answers `canEnd` (the child is guardian tier) and each notice answers `canEnd` (named, still connected, guardian tier). `rebuild/social/ConnectionActions.tsx`: a confirmed `DestructiveAction` ("End connection with {name}?", consequence: reconnecting needs your approval) and the existing `ReportDialog`, grouped and labelled by the account's name. Mounted on every graph row and every named notice. Transport is injected (`rebuild/social/guardianConnectionsClient.ts`); success only on Core's exact receipt. After an end, `publishSocialUpdate` refreshes the child's requests, history and graph panels, and a new token-wide subscription re-reads the notices | `frontend/src/rebuild/social/*`, `frontend/src/routes/app/family/SocialGraphPanel.tsx`, `SocialNoticesPanel.tsx`, `socialUpdates.ts` |
| 06 Copy Budget | `socialConnectionActions` in `rebuild-family.json` (en-US, es-MX, pt-BR), budgeted in `copy-budget/family.test.ts`; the report dialog reuses the profile's report copy | `frontend/src/i18n/*/rebuild-family.json` |
| Gates | `verify-social-guardian-end-postgres.py` (joins `social:db-verify` by name). `social:check` section 8: the latest SQL keeps the guardian re-check, the self-managed refusal, the locks, the revocation and the audit row; the metric keeps the reconciliation; Core keeps both routes with the session guardian and the unfollow record; the Family graph and notices keep the actions (4 new mutation tests). Policy `SOCIAL-TIERS.md` §1.3 | `database/scripts/`, `agent/tools/check-social-tiers.mjs` |

### Verification (local)

- PostgreSQL 17.6 (owned cluster, port 15940): `verify-social-guardian-end-postgres.py` applies all 228 migrations and passes 8 checks: refusals leave no trace (unrelated verified parent, stale guardian, the other account, the child itself, null, a self-registered teen's parent, anon and authenticated); a failing audit write rolls back everything; success removes both edges, revokes the approval and writes the audit row; a re-follow either way is refused and the old request cannot be re-approved until a fresh approval; no connection answers 0 with no write; audit completeness stays at 100%. Two mutation checks: the 0204 reconciliation reads the same unfollows as unaudited, and a copy without the guardian re-check lets the stale guardian through. `verify-social-protection-postgres.py` still passes (8 checks) on the new chain.
- Core (vitest): `familySocialGuardianEnd.test.ts` (new, 37 cases: success and each refused population for both routes, receipt mapping, the recheck after the write, the `canEnd` answers), `family.test.ts`, `report.test.ts`. Type-check and lint clean.
- Frontend (vitest): `SocialConnectionActions.test.tsx` (new, 11), the graph, notices, requests, history and refresh panel tests, `FamilyPage` tests, the family copy budget, `rebuild/design`. Type-check and lint clean.
- Root: `spec:check`, `secrets:check`, the i18n gate, `social:check` and its 26 tests, the database package tests.
- Not run here (orchestrator, per merge): browser matrices, `audit:rebuild`, full suites. The two Family social browser verifiers' mocks gained `canEnd`.

### Decisions taken with the conservative default (owner questions)

1. **"Ended" is the existing `revoked` status.** The request table's CHECK allows pending, approved, denied and revoked. Widening it would make every reader of the terminal states (retention, metrics) learn a new value; the audit reason `guardian_ended` records who ended it.
2. **Accounts are addressed by user id, not username.** The graph wire shape allows a null username and notices carry only ids, so a username path would leave some rows without actions. The route never reveals more than the Family list already shows.
3. **A self-registered teen's list stays read-only to its linked parent** (E.8, OD-3 Option B: the teen decides its own connections). Reporting stays available.
4. **A guardian's report counts as an adult's.** It opens a review case immediately and notifies the connected families, but the E.3 three-minors pattern counts minors only, so it does not count as the child's event. Whether it should is an owner question.
5. **Ending also closes an accepted teen consent between the pair and the reverse-direction approval**, so neither side can reconnect without a fresh decision.

### Migrations (renumbered by the orchestrator at merge)

- `0228_guardian_end_social_connection.sql` (`@phase: expand`; applying it deletes nothing, the DELETE lives inside the function).

### Remaining

Acceptance and release evidence for E.1-E.3 and E.13 as the requirement rows
state; a visual pass of the new row actions in the browser matrices.

## Checkpoint F3-social-finish (lane summary)

- **Sync.** `codex/spec-migration-s02` was already contained in the lane
  (merge: "Already up to date"); no conflicts.
- **Adversarial pass against the one audited gap (end/report a child's
  connection).** Authorization sits at the server: both routes run `guardKid`
  before and after the write, the database function re-checks the current
  guardian under the pair locks, and every refused population (unrelated or
  stale guardian, self-managed teen, self or malformed target, non-connection,
  anon/authenticated callers) has a Core test and a PostgreSQL check. The
  rebuilt UI uses only the shared `DestructiveAction` and the existing
  `ReportDialog`; nothing under `rebuild/` imports the legacy app. Copy exists
  in en-US, es-MX and pt-BR. One gap closed here: no test proved that the new
  row actions and both dialogs declare `data-copy-role` (02 rule 19); a test
  now walks the row, the confirm dialog and the report dialog.
- **Verification.** Backend: type-check, lint and the full unit suite (148
  files passed, 1 skipped). Frontend: type-check, lint and the full unit
  suite (272 of 273 files passed in the full run; the one red,
  `rebuild/assets/assetGate.test.ts`, was a 90 s timeout under other lanes'
  load and passes alone, 13/13). Database: every `npm test` step up to
  the migrator passed (migrations, phase, family lifecycle, 48 node tests);
  `railway-migrate.test.mjs` (a fully stubbed transport test this lane did
  not touch) was stopped after 55 minutes still in scenario 2 of 13 with
  every lane running it at once, so it is left to the orchestrator's merge
  run. Root: `spec:check`, `secrets:check`, `social:check`.
- **Status.** E.1, E.2, E.3 and E.13 stay "Implemented and locally verified;
  not accepted". Still open: a visual pass of the new actions in the browser
  matrices (the two Family social verifiers do not click them yet), and
  acceptance and release evidence. Owner questions 1-5 above stand, with the
  conservative defaults implemented.
