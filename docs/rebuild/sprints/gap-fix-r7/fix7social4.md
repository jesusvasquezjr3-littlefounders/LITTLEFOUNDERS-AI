# Gap-fix round 7: social (fix7social4)

Branch `codex/spec-fix7social4`. Two audited gaps. Each was checked in the code
first and each was real. Nothing here is accepted or released; statuses follow
the ledger (implementation, local verification, acceptance and release are
separate). No migration, no Core or frontend change.

## Gap 1: the Block E quarterly review had no calendar trigger

SPEC: Appendix J Part 1.4 (Threshold Recalibration Log: every threshold
reviewed at least once per defined cadence, quarterly for the first year);
Appendix J Part 3 Stage 7 (the Safety/Trust Lead, on the cadence in the log);
E.7 (the moving regulation is re-checked against current sources).

Verified first: the only enforcement of the nine §1.2 due dates (all
2026-12-24) was the date comparison in `check-social-governance.mjs`
(`guardrails:check`), which runs only inside `spec:check`, which runs only in
`repo-gates.yml` on push or pull request, never on a schedule.
`release-readiness.sh` ran the Block A, B, C and D cadence checks with
`--strict` but no Block E one, no workflow referenced the social policy's log,
and the §1.3 regulatory watch list carried no dates at all.

| What was built | Where |
|---|---|
| Cadence gate: parses §1.2 (threshold, value, enforcing function, last reviewed, next due) and §1.3; a malformed table, an undated row, a due date before its review or more than a quarter after it in the first year (a year after that; the first year starts at the earliest §1.4 record) always fails; an overdue row warns, and fails under `--strict` | `agent/tools/block-e-review-cadence.mjs` |
| The watch list is dated: `Last re-checked` (`not yet` until counsel records one) and `Next re-check due` (2026-12-24, the §1.2 cadence) | `docs/rebuild/policies/SOCIAL-GOVERNANCE.md` §1.3 |
| Quarterly issue body: every threshold with value, enforcing function, last review, next due and state (overdue / due this quarter / not yet due); every watch-list item to re-check; the Safety/Trust Lead as owner; how to record the review | `agent/tools/block-e-reviews-quarterly.mjs` |
| Workflow: cron `0 9 1 1,4,7,10 *` plus `workflow_dispatch`; opens or comments on the quarter's issue labelled `block-e-review`; a malformed log still opens the issue and turns the run red; nothing reaches production | `.github/workflows/block-e-reviews-quarterly.yml` |
| Release readiness runs `node agent/tools/block-e-review-cadence.mjs --strict` beside the other Blocks; the repo gates run it without `--strict` | `agent/tools/release-readiness.sh`, `.github/workflows/repo-gates.yml` |
| §1.2 names both triggers (per quarter, per release) | `docs/rebuild/policies/SOCIAL-GOVERNANCE.md` §1.2 |
| Node tests: live log parses (9 thresholds, 5 items); on time passes, overdue warns and fails under `--strict` (CLI exit codes); nine malformed-log mutations fail; the yearly interval after the first year; release readiness and repo gates carry the call; the issue lists all 14 rows with owner and dates; a malformed or missing log still writes the issue and exits 1; the workflow lint fails on a yearly or daily schedule, a skipped tool, a failure-only notice, another label, `issues: read` and a production call | `agent/tools/block-e-review-cadence.test.mjs`, `agent/tools/block-e-reviews-quarterly.test.mjs` |

## Gap 2: owner answer S-08 was prose, and S-08 / D-15 (a) were listed as open

SPEC: E.10 (a future messaging-adjacent feature defaults off and needs an
affirmative opt-in); owner answers S-08 (a teen with no linked guardian cannot
turn it on) and D-15 (a) (retention windows approved), in
`docs/rebuild/OWNER-REVIEW-ANSWERS.md`.

Verified first: `messaging-features.json` `requiredShape.activation` had only
`guardian`, `teen` and `closed`; `check-social-governance.mjs` accepted an
entry with no statement about a teen with no linked guardian; §2.1 rule 4 read
"Until the owner decides otherwise (section 8)", and §8 listed the windows
and S-08 as proposals.

| What was built | Where |
|---|---|
| `requiredShape.activation.teenWithoutGuardian: "never"` | `docs/rebuild/policies/messaging-features.json` |
| `guardrails:check` refuses a register entry whose `activation.teenWithoutGuardian` is not `never`, and a register whose required shape drops it | `agent/tools/check-social-governance.mjs` |
| Mutation tests: an entry without the key, an entry set to an opt-in, and the required shape without it each fail | `agent/tools/check-social-governance.test.mjs` |
| §2.1 rule 4 is a decided rule citing S-08; §8 split into 8.1 Decided (D-15 (a) windows, D-15 (a) unanswered-request expiry, D-16 former-guardian follow removal, S-08) and 8.2 Proposals (audit-entry expiry, kept per D-15 (b); the recalibration cadence); §3.2, §3.6 and the status line follow | `docs/rebuild/policies/SOCIAL-GOVERNANCE.md` |

Beyond the brief, on the same evidence: proposals 4 (unanswered requests expire
after 30 days, the `pendingRequestDays` window) and 5 (former-guardian follow
removal) were also answered, by D-15 (a) and D-16, so they moved to 8.1 too.

REQUIREMENTS rows updated: E.7, E.10, E.11.

## Verified

`node --test` on the three touched test files (32 tests) passes;
`npm run guardrails:check`, `npm run spec:check`, `npm run secrets:check` and
`npm run tools:test` pass; the cadence tool exits 0 today and 1 under
`--strict --today 2026-12-25` (14 overdue rows). No service code changed, so no
service type-check or lint applies; no copy changed, so the i18n gate does not
apply.

## Open

- The workflow has not run on GitHub (it needs a push; the owner deploys).
- The first Safety/Trust recalibration and the first regulatory re-check with
  counsel (both due 2026-12-24) are human work.
- Owner: the audit-entry expiry (§8.2 item 1, D-15 (b)) and the post-first-year
  cadence (§8.2 item 2) stay proposals.
