# Gap-fix round 5

Lane records for the fifth gap-fix round of the SPEC migration. Each lane
appends its own section. Statuses follow the ledger: implementation, local
verification, acceptance and release are separate, and nothing here is
accepted or released.

## Checkpoint F5-staff-ops

Branch `codex/spec-fix5staffops`. Three audited gaps. Each was checked in the
code first and each was real:

1. `release_course(uuid)` (0112) and `release_lesson(uuid)` (0113) took no
   actor, checked no grant and wrote no audit row; Core committed the release
   and then posted the audit row separately (a failure was only
   `console.error`'d), and a rejection, return to review, unpublish or
   archive was a PostgREST PATCH whose audit insert result was ignored. No
   trigger on `courses` or `lessons` audited anything. A release that lost its
   row also dropped out of the `content_bypass_metrics` denominator.
2. `revokeRoleChecked` / `revokeAdminPermissionChecked` issued a service-role
   DELETE; the audit triggers (0003, 0030) took `COALESCE(jwt sub,
   OLD.granted_by)`, and the service key has no `sub`, so every revocation
   was recorded under the original granter. No revocation wrote a
   `staff_access_reviews` row (the console only records 'kept').
3. `docs/operations/GOVERNANCE.md` section 5 had no internal notification
   chain and no review cadence, owner or date.

### What was built

| # | SPEC clause | What was built | Where |
|---|---|---|---|
| 1 | G.3 (non-negotiable; "consistent with how course and lesson status changes are already treated"); Appendix N 1.2 (Release-Verification Bypass Rate, publish event log from the staff console and the CLI; the second-write-path note); G.2 | Migration `audited_content_release` (expand): `release_course(p_actor, p_course_id)` and `release_lesson(p_actor, p_lesson_id)` keep the 0112/0113 bodies (the static pins still hold), refuse with `FORBIDDEN` unless the actor is a superadmin or an admin holding manage_content (`content_release_actor_allowed`, 0221), and insert `admin.course.release` / `admin.lesson.release` in the same transaction (a course retry that changes nothing writes none). `set_course_status(actor, course, draft or archived)` and `set_lesson_status(actor, lesson, draft, review or archived)` lock the row, move it and insert `admin.course.set_status` / `admin.lesson.set_status` {status, from} together; publishing there is `USE_RELEASE`, the current status is `UNCHANGED` with no row. Migration `content_status_contract` (contract, after the Core release): drops the one-argument releases; `guard_release_only_publication` now refuses, for anon, authenticated and service_role, every course or lesson status change, except the Forge upsert of a lesson into review, whose demotion of a published lesson writes `content.lesson.demoted` (no staff actor) in the same statement. Core `setCourseStatus` / `setLessonStatus` call the four RPCs with `authedUser(res).id`, answer 502 on any unconfirmed receipt (failed request, empty or unreadable row), map `FORBIDDEN` to 403, and no longer post an audit row themselves. `publish-course.sh` passes `LF_RELEASE_ACTOR` (uuid-checked) or the local superadmin with the oldest grant | `database/migrations/0241_audited_content_release.sql`, `database/migrations/0243_content_status_contract.sql`, `backend/src/services/adminData.ts`, `backend/src/routes/admin.ts`, `database/scripts/publish-course.sh`, `database/scripts/test-publish-course.sh`, `database/scripts/verify-course-publish-postgres.py`, `backend/src/__tests__/admin.test.ts` |
| 2 | G.1 (permissions stored, displayed and audited; Law 5); G.4; Appendix N 1.1 (Access-Review Cadence Compliance and Stale-Grant Rate from the access-review log); Appendix N Part 3 Stage 4 | Migration `staff_grant_revocation` (additive in effect, declared `contract` because the phase classifier flags the DELETE statements in the new function body, the 0208 precedent; applied by hand BEFORE the Core release): `audit_role_change` and `audit_admin_permission_change` take the actor from the jwt `sub`, then the transaction-local `lf.actor`, then (INSERT/UPDATE only) `granted_by`; a DELETE with no actor records NULL and keeps the granter as `grantedBy` in the detail. `revoke_staff_grant(p_actor, p_subject, p_kind, p_grant)`, service role only: superadmin actor (`ACCESS_REVOKE_FORBIDDEN`), never the actor's own superadmin role (`ACCESS_REVOKE_SELF`), sets `lf.actor`, deletes the role or permission, and for an elevated grant records the review 'revoked' through `record_staff_access_review` (review row plus `admin.access.reviewed`), one transaction; returns 'revoked' or 'not_held'. The role triggers (domain, kid guardian, parent cascade, admin grant) still refuse. Core `/roles/revoke` and `/roles/permissions/revoke` call it with the caller's id: 200 (`revoked` true, or false when not held), 403 on the actor refusal, 409 `ROLE_REJECTED` on a trigger refusal, 502 when unconfirmed. The service-role DELETE helpers were removed. The console needs no change (it already reloads the review card after a removal) | `database/migrations/0242_staff_grant_revocation.sql`, `backend/src/services/adminData.ts`, `backend/src/services/supabaseRest.ts`, `backend/src/routes/admin.ts`, `database/scripts/verify-staff-ops-postgres.py`, `backend/src/__tests__/admin.test.ts`, `frontend/src/rebuild/staff/console/StaffAccess.tsx` (comment) |
| 3 | H.5 (b) (who inside the company is notified); Appendix O 1.2 (plan present and reviewed annually or after any incident); Appendix O Part 3 Stage 3 | GOVERNANCE.md section 5 gains the internal notification chain (Owner and Engineering lead within 1 hour, Safety/Trust lead within 4 hours, Legal within 24 hours or 4 hours when a minor's data may be involved; each by phone or direct message plus the `ops-watchdog` issue, no personal data in the issue; escalation when a step is not acknowledged) and a Plan review bullet (at least yearly, 366 days at most, and after every incident; owner the Safety/Trust lead; Last reviewed 2026-09-29). `check-staff-standing-constraints.mjs` (in `spec:check`) now also fails when section 5 lacks the chain, one of the four roles in order, a channel or a time limit per step, the annual and after-incident cadence, the review owner or the date, or when the date is more than 366 days old or in the future | `docs/operations/GOVERNANCE.md`, `agent/tools/check-staff-standing-constraints.mjs` (+ test) |

### Verification (local)

- Native PostgreSQL 17.6 (lane cluster `.lane-cache/pg`, port 15750), whole
  chain of 243 migrations: `verify-course-publish-postgres.py` 16 checks
  (exactly one audit row per decision with the staff actor, a failed audit
  insert rolls back the course release, the lesson release, the lesson
  takedown and the course takedown, a non-content admin is refused for each
  of the four functions, the one-argument signatures are gone, the service
  role cannot PATCH a status except the Forge move into review and the
  demotion is recorded, no browser role calls the functions);
  `verify-staff-ops-postgres.py` 30 checks (the revoking superadmin is the
  audit actor with the granter kept as `grantedBy`, the review row and
  `admin.access.reviewed` land, a non-superadmin, missing actor, unknown
  kind and self-revocation are refused, a failed review write keeps the
  grant, a direct DELETE records no actor, browser roles refused). The whole
  `staff:db-verify` gate on the same cluster: 9/9 verifiers pass over the
  whole chain (content release, staff ops, data platform, course publish,
  admin permissions, analytics disclosure, analytics, Mentor quality audits,
  origin).
- `database`: `check-migrations`, `check-migration-phase`, the node tests of
  the phase gate, auto-apply gate, publish CLI boundary (bash) and the
  db-verify runner self-tests (37 pass).
- Backend `type-check`, `lint`, `admin.test.ts` (116 pass: the RPC bodies
  carry the actor, no PATCH, DELETE or separate audit write, every 502 path,
  FORBIDDEN mapping, every revoke outcome). Frontend `type-check`.
- `node --test agent/tools/check-staff-standing-constraints.test.mjs` (10),
  root `spec:check`, `secrets:check`. No copy changed (no i18n run needed).
- Finish pass (after the lane was stopped): stale lane test processes were
  stopped, the 0242 header was declared `contract` so `check-migration-phase`
  agrees with its SQL, and the branch was merged with the integration
  branch (already up to date). Re-run green: `check-migrations`,
  `check-migration-phase` (+ phase and auto-apply gate tests, 20), the
  publish CLI test, backend `type-check`, `lint`, `admin.test.ts` (116),
  `check-staff-standing-constraints` tests (10), `spec:check`,
  `secrets:check`. The native PostgreSQL verifiers were not re-run: only a
  comment header changed since their 16 + 30 and 9/9 passes.

### Remaining

- Deploy order: 0241 (expand, auto-applies) and 0242 (declared contract,
  applied by hand; it deletes nothing on apply) must both be in place BEFORE
  the new Core, whose revoke routes answer 502 without 0242. The new Core must
  be live before 0243 (contract) is applied by hand, since 0243 drops the
  signatures the current Core calls and refuses its status PATCH.
- `database/types/database.ts` still lists `release_course(p_course_id)` and
  `release_lesson(p_lesson_id)` and lacks the new functions: it is generated
  (`db:types`) against the local stack, which this lane may not touch.
- `account_erasure` (0118) deletes roles with no session actor, so those rows
  are now recorded with a NULL actor (system) instead of the original
  granter; naming the erasing actor there would need that function to set
  `lf.actor`.
- The first staff:db-verify run in CI on the new verifiers; acceptance by
  Trust and the owner; production evidence of the audit rows.

### Owner questions

- Default taken for H.5: the chain names roles, not people, with the time
  limits above; the owner confirms the people and their phone and message
  channels, and the next review date follows from that confirmation.
- Default taken for G.3: the Forge pipeline may still move a lesson into
  review (including an archived one) without a staff actor, because that is
  content entering the human gate; a demotion of a live lesson is recorded as
  `content.lesson.demoted`. Every other status move needs a staff actor.
