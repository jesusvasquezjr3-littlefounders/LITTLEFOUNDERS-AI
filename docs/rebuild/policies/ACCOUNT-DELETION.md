# Account deletion policy

Status: implemented and locally verified in S08.5 (24 September 2026). Not accepted: the human review named in Appendix J §2.1(4), the owner decisions listed in section 9, evidence against the real Supabase/GoTrue schema and production readings of the metric are open. See [the S08 sprint record](../sprints/S08-PROFILES-SOCIAL-AND-SHARING.md#s085-implementation-and-rationale).

Binding sources: Product `10` E.6 and component 5 of the Block E standard, Appendix J (Deletion-Request Clarity metric, Definition of Done, Part 3 pipeline), A.1 (account-cancellation cascade, already built in S04.1), and Frontend Bible `02` and `06` for the rebuilt surface. `npm run deletion:check` (part of `spec:check`) keeps this document, the public FAQ and the code in step.

## 1. Decision (E.6)

E.6 allows two answers: build self-service deletion, or state a manual process honestly. LittleFounders builds self-service deletion. The FAQ no longer says "contact us". It states the timeline, and Settings carries the flow.

Staff accounts are the one manual case, and this policy states it plainly. A superadmin removes a staff account after revoking its grants. The self-service route and the database both refuse a staff account.

## 2. Who can delete which account

Core decides eligibility from server-side facts only: roles, the age screen and the guest flag. The browser never states a population.

| Account | Who deletes it | Timing |
|---|---|---|
| Adult (age screen says adult) | The holder, in Settings | 14-day grace period, then erased |
| Parent / verified Tutor | The holder, in Settings | 14-day grace period. Before confirming, the holder sees how many children they supervise alone. Those children are paused when the erasure runs (A.1) |
| Independent teen, 13 to 17 (Option B, no guardian) | The holder, in Settings, on the same terms as an adult | 14-day grace period |
| Linked teen, 13 to 17 (a verified parent linked later) | The holder, in Settings, on the same terms; each verified Tutor is told the date (notify only, D-14 (b)) | 14-day grace period |
| Not yet age-screened | The holder | 14-day grace period |
| Guest | The holder, in Settings | Erased when confirmed. A guest has no way to sign back in to cancel |
| Self-registered account whose age screen says under 13 | The holder | Erased when confirmed. Holding a child's data for a window nobody can use is the worse outcome |
| Parent-created child (kid role) | Only its verified Tutor, from Family (`DELETE /api/v1/family/kids/:kidId`). The child sees who can delete it and has no control (`KID_DELETION_BY_TUTOR`) | Erased when the Tutor confirms |
| Child paused under A.1 for 90 days | The daily A.1 purge | Erased at day 90 through the same lifecycle |
| Staff (admin, superadmin) | A superadmin, after revoking the grants | Manual. Refused by the self-service route (`STAFF_ACCOUNT`) and by `request_account_deletion` / `erase_account_data` |

Every minor safeguard follows age, not role. The under-13 rule applies to any self-registered account whose age screen says under 13, whatever its role.

## 3. Timeline and confirmation

- **Confirmation is enforced by the server.** The body must carry `acknowledge: true` in a `.strict()` schema. A password session re-enters its current password, checked by a real GoTrue sign-in. An OAuth or magic-link session must have signed in within the last 15 minutes. A guest has nothing to re-enter. The route shares the auth rate limiter (10 attempts per 15 minutes).
- **The date is stated when the request is made.** The response and the deletion screen carry `scheduledFor`, and the Settings intro states the grace period before any confirmation.
- **14-day grace period.** Scheduling signs the account out everywhere (GoTrue session revocation). Signing back in before the date opens the deletion screen, not the app: the date, "Keep account" and "Sign out". Keeping cancels the request, and the cancellation is audited.
- **Completion SLA.** A due request is erased by the daily sweep (`.github/workflows/account-deletion.yml`, 03:45 UTC). The erasure completes within 48 hours of the stated date. A step that fails is retried by the next day's sweep, and a request past the SLA shows as overdue in the metric (section 7).
- **Safety hold.** If an E.3 safety review case names the account and is still open, the erasure is held (`held`, audited) until staff resolve the case. Reports and review evidence cascade away with the account, so erasing first would destroy the evidence. The holder sees that the deletion is paused for a safety review and can still keep the account.

## 4. What is erased (one lifecycle, four recorded steps)

Every deletion path uses the same lifecycle: self-service, a Tutor deleting a child, and A.1's 90-day purge. Each request is one `account_deletion_requests` row. `complete_account_deletion` refuses to mark it completed until all four steps are recorded and no stored file is left. Each step is idempotent.

1. **Oracle (Mentor runtime).** `POST /api/v1/tutor/erasure` (internal key) closes the learner's live socket and drops any parked session. The ordinary endings are skipped: no close written back to Core, no post-session review (a paid model call) and no trajectory emission. Oracle has no database of its own. The speech cache is keyed by content hash with a TTL and holds no user id.
2. **Core (one database transaction, `erase_account_data`).**
   - Takes the Depot inventory: Mentor speech audio from the account's sessions, task evidence photos and legacy badge images. It also records the pre-signup visitor ids converted into the account.
   - Deletes the rows that do not cascade: the Mentor memory ledger (no foreign key by design), converted anonymous visitors (their events cascade) and email delivery logs, matched by user id or by the account's own address.
   - Removes follows, blocks and guardian links while the account still exists, so their audit triggers still fire. The A.1 trigger pauses any child who loses its last Tutor, and a co-supervised child stays active.
   - Ends any voice consent the account granted to a child. Clears the account's id from staff grants it made, then removes its own roles and permissions.
   - Deletes GoTrue's own audit entries for the account and then the `auth.users` row. Everything else cascades from `auth.users`: profile, progress, wallet, tasks, Mentor sessions, transcripts, memory, plans, notebook, learning events, sessions and identities.
   - Keeps any Depot object that another account's surviving row still references (Depot is content-addressed).
3. **Depot (stored files).** Deletes every object on the inventory. An object already gone counts as deleted. A failure leaves exactly the remaining paths on the request for the next sweep.
4. **Warehouse (dataintel).** `POST /api/v1/intel/erasure` deletes the account's rows, and the converted visitor ids' rows, from the raw event, attempt, skill-state, session, user and visitor-conversion tables in one transaction. It then records tombstones that the sync re-applies after every run, so a batch read just before the erasure cannot bring the rows back. Tombstones are dropped after 30 days. `agg_daily_*` tables hold counts only and stay.

## 5. What stays, and why

- **Records that belong to a child stay with the child.** A departed adult's id leaves them: ledger entries they created, the banking account they opened or froze, allowance, savings-bonus and spend-limit rules, redemption decisions, and the voice consent they granted (ended, not deleted). These columns are `ON DELETE SET NULL`. Before S08.5 they blocked the deletion of any Tutor who had used the Family Hub.
- **Audit logs** keep their rows. The departed account's id is cleared as the actor (`ON DELETE SET NULL`) and stays only as the subject id of entries about it. That is an opaque id, and the deletion itself is one of those entries.
- **The deletion record.** One `account_deletion_requests` row survives with the account id, population, initiator, dates, attempts and step counts. It holds no email, name or content. It answers "was this account deleted, when and at whose request", which is the audit answer E.6 owes.
- **Aggregates.** Daily counts in the warehouse contain no identifiers.
- **Backups.** Database backups follow the hosting provider's retention and expire on its schedule. This is not yet stated in the Privacy Notice (section 9).

## 6. Audit trail

Written in the same transaction as each state change: `account.deletion_requested`, `account.deletion_cancelled`, `account.deletion_held`, `account.erased` (with per-table counts) and `account.deletion_completed` (with the step results). Core adds `account.deletion_step_failed` for every failed step and `account_deletions.sweep_ran` for every sweep run, including runs that found nothing. The Tutor path keeps `family.kid_delete.requested` and `family.kid_deleted`.

## 7. Metric (Appendix J, Deletion-Request Clarity)

`GET /api/v1/admin/analytics/account-deletions?days=N` (staff with `view_analytics`) returns counts only:

- requests by initiator and by population;
- cancellations and completions;
- the **stated-timeline rate**: requests that carry a date divided by all requests;
- the **within-SLA rate**: completions within 48 hours of the stated date divided by all completions;
- the open queue: pending, processing, held and overdue.

The published SLA is the one in section 3. Appendix J labels this metric diagnostic until a published SLA exists. With the SLA published here, a baseline is established from the first production readings and tracked toward 100% within SLA. An unreadable count fails the whole read. It never reports a believable zero.

## 8. Standing constraint and change pipeline

Standing constraint (Block E standard, component 5): the self-service deletion path is locked in. Removing it, adding friction beyond the confirmation in section 3, lengthening the grace period, or taking any deletion path outside the one lifecycle needs an explicit re-review (Appendix J Part 3, Stage 0 classification as age-tiering/trust-signal and Stage 3 review). It is never a silent change. `npm run deletion:check` fails when any of these facts drift:

- the route or the sweep mount;
- the acknowledgement;
- the child and staff refusals;
- the rule that no direct GoTrue delete exists outside the audited rollback of a half-created child;
- the four steps and their completion rule;
- the memory-ledger erasure;
- this policy's grace period and SLA;
- the FAQ in three locales, which must say the account is kept by choosing "Keep account" after signing in (signing in alone keeps nothing);
- the sweep workflow;
- every foreign key to an account (`auth.users` or `profiles`), in every migration from any lane: it must end `ON DELETE CASCADE` or `SET NULL`. A NO ACTION or RESTRICT key makes the final `auth.users` delete fail, so that account could never be erased (S08.5 found eight such columns). A later migration that re-declares the key, or renames the table, is followed (S08.8).

Adversarial tests at each boundary:

- `backend/src/__tests__/accountDeletion.test.ts`: every population by direct API request, confirmation and re-authentication, the lifecycle's failure and retry paths, the sweep;
- `backend/src/__tests__/accountDeletionMetrics.test.ts`;
- `oracle/src/__tests__/live-session.test.ts` (account erasure block);
- `dataintel/src/__tests__/account-erasure.test.ts`;
- `database/scripts/verify-account-erasure-postgres.py`, run against real PostgreSQL.

## 9. Operations and open items

Deploy order:

1. Apply the `account_deletion_requests` migration (expand), then the `account_erasure_function` migration by hand. It is declared contract only because the classifier sees `DELETE` inside the function body.
2. Deploy Oracle and dataintel, then Core, then the frontend.

Any other order fails closed and never half-erases: without the function, the request stays processing and nothing is deleted; without Oracle, the Oracle step fails before the database is touched. Enable the scheduled workflow when Core is live.

Open items and owner questions (conservative defaults are implemented):

- The 14-day grace period and the 48-hour SLA are proposals, and the owner decides both. Product owns the decision, which must be made before release (the same pattern as the other E.6 decision points).
- Backup retention needs a statement in the Privacy Notice. The legal Terms text (retention after cancellation) should be read by counsel against this policy. Both are legal copy and were not changed here.
- A teen's self-deletion and their Tutors (owner review D-14, resolved in GAP-FIX-R2). Linking now exists: a self-registered teen can link a verified parent (`POST /api/v1/wallet/guardian-invite`). (b) A linked teen's own deletion tells each verified Tutor, notify only: the `teen_deletion_guardian_notices` trigger writes one notice per verified guardian link and the audit row `account.deletion_guardians_notified` in the request's own transaction, before any erasure can run. Core reads the links first (unreadable = 502, nothing scheduled) and states `tutorsTold` to the teen before they confirm ("We tell your Tutor the deletion date."). The Tutor sees it on /family (`GET /api/v1/family-hub/deletion-notices`): the teen's display name, the date, and that the teen can keep the account by signing in. No reason and no action. A cancelled request drops out of the Tutor's read, so keeping the account needs no second notice; a new request later is a new notice. The erasure removes the notices with the account. (a) An unlinked teen's deletion notifies nobody. If the owner wants a notice for the unlinked teen, it goes to the teen's own email. Verified by `database/scripts/verify-teen-deletion-notices-postgres.py` and Core's `accountDeletion.test.ts`.
- Evidence against the real Supabase/GoTrue schema (the verify script uses a minimal `auth` shim), and the first production readings of the metric.
