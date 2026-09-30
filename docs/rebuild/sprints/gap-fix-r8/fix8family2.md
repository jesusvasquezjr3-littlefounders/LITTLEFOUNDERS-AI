# Gap-fix round 8: family (fix8family2)

Branch `codex/spec-fix8family2`. Status: **implemented and locally verified; not accepted.**

## Gap 1: production state transitions and retention were never checked (Appendix H 1.3, 1.4, Part 3 Stage 7; D.4, D.21)

**Verified in code first: real.**

- The production Unauthorized State-Transition count could only be read:
  - Core served it at `GET /admin/family/state-integrity`, which needs a staff session (`view_analytics`);
  - the staff console drew it as a card.
- Nothing else read it:
  - `release-readiness.sh` ran only `npm run family:db-verify`, which proves the mechanism on a throwaway cluster;
  - no workflow called the metric;
  - `ops-job-watch.yml` checks only that the sweeps ran.
- The Retention-Policy Compliance Audit (`/admin/family/retention-compliance`) had the same problem.
- The fix suggested by the audit ("call the admin route with the internal key") would not work: the admin router requires a JWT and a staff grant before any route runs.

**Built:**

- **Core** (`backend/src/services/familyLifecycle.ts`):
  - `readFamilyStateIntegrity(since)` is now the one home of the D.4 summary shape;
  - the admin route uses it, and its response is unchanged.
- **Core** (`backend/src/routes/opsHeartbeat.ts`): new route `GET /api/v1/internal/ops/family-integrity?days=1` (default 1, range 1 to 365, strict query).
  - It needs the internal key.
  - It returns `{days, stateIntegrity, retention}`.
  - An unreadable integrity metric answers 502. An unreadable retention audit is returned as `retention: null`.
- **Tool** (`agent/tools/check-family-production-integrity.mjs`), following the `check-block-b-thresholds.mjs` pattern.
  - Sources:
    - `--export=<json>`: Core's envelope, the bare object, or the raw RPC rows;
    - `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`: calls `family_state_integrity(p_since)` and `family_retention_compliance()`, read only.
  - Window: `--since`, else the date of the last `v*`/`release-*` tag, else 30 days.
  - `--strict` fails on:
    - any table with `outside_service > 0`, naming it;
    - any table with `overdue > 0`, naming it;
    - a named source that cannot be read;
    - a missing section.
  - Without credentials it warns and prints SKIP.
  - `--watch` fails on a bypass or an unreadable reply. It writes the "Block D Stage 7: revert candidate (<tables>, since <window>)" notice to `--notify-file`. Overdue retention rows only warn in this mode.
- **Release**: `agent/tools/release-readiness.sh` runs the tool with `--strict` right after `npm run family:db-verify`.
- **Daily**: new workflow `.github/workflows/family-integrity-watch.yml`, run at 10:30 UTC.
  - It calls the internal route from inside the Core container, the same way as `ops-job-watch.yml`.
  - It judges the reply with `--watch`.
  - On failure it opens or comments on one issue labelled `block-d-stage7`.
  - It is a new file rather than an edit to `ops-job-watch.yml`, so it cannot conflict with other lanes.
- **Rule recorded**: `docs/operations/NO-UNBACKED-GUARANTEE.md`, section "Production integrity and the Stage 7 revert rule", plus two rows in its mechanisms table.

**Verified:**

- `agent/tools/check-family-production-integrity.test.mjs`, 13 tests. They cover:
  - every refused population: a bypass on any table, overdue rows, an unreadable or foreign reply, a missing section;
  - the credential-less SKIP;
  - the window selection;
  - the RPC calls;
  - the CLI exit codes and the notice file;
  - the release-readiness ordering;
  - the workflow wiring.
- `backend/src/__tests__/familyLifecycle.test.ts`, 3 new tests on the internal route:
  - the shape and the one-day default window;
  - refusal of no key, a wrong key, and staff, parent, kid and teen sessions, all before any RPC runs;
  - validation, a 502 on an unreadable metric, and `null` retention.
- The existing admin-route tests still pass.

## Gap 2: the D.16 release gate skipped the Wallet folder (D.16; Appendix H 1.3; Real-World Money Practice Standard constraint 5)

**Verified in code first: real.** `goalProgressGate.test.ts` scanned only `routes/app`, `rebuild/family` and `rebuild/wallet`. `rebuild/banking` (CoinAccount, ChildCoins, TutorCoins, ChildCoinActivity) was never scanned.

**Built:**

- `rebuild/banking` is added to the scopes.
- A self-drawn bar is now judged over its whole JSX element, not one line, so a goal bar whose props wrap onto a second line is caught.
- `REVIEWED_BARS` pins the Tutor's spending-limit `<ProgressBar>` in `TutorCoins.tsx` (`limit.used` of `limit.cap`). Every bar in that file must still carry the limit marker and no goal word.
  - The limit bar did not trip the goal regex. The reviewed entry exists so that it cannot silently turn into a goal bar.
- New negative fixtures under `rebuild/banking`: a one-line goal bar, a wrapped goal bar, and a saved/target ratio each fail. The limit bar passes.
- The scope test asserts that all four Wallet files are scanned.

**Verified:** the gate passes on the live tree, 6 tests.

## Verification

Gates run in the worktree:

- backend and frontend: `npm run type-check` and `npm run lint`;
- focused vitest runs: backend `familyLifecycle` and `staffOps`, frontend `goalProgressGate`;
- `node --test` for the new tool;
- root `npm run spec:check` and `npm run secrets:check`.

No copy changed, so the i18n gate does not apply.

## Open

- **The first real production run needs the operator.** Release readiness needs production credentials, and the daily watch needs the Railway secrets; both only exist outside this machine.
- **The watch needs this Core release first.** The internal route exists only once this Core change is deployed. Until then the watch fails as unreadable.
- **Stage 7 names two more metrics.** The Freeze-Enforcement Verification and the Lifecycle-State audit regress in `family:db-verify` (release) and have no production reading of their own. There is no production metric to read for them.

## Owner questions

- **Release tags.** The window starts at the last `v*`/`release-*` tag. The repository has no release tags today, so the window is 30 days, the SPEC-conservative default. If releases are marked some other way, tell us how and the tool will read it.
