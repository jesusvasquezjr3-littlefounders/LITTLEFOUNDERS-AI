# Gap-fix round 3

Lane records for the third gap-fix round of the SPEC migration. Each lane
appends its own section. Statuses follow the ledger: implementation, local
verification, acceptance and release are separate, and nothing here is
accepted or released.

## Checkpoint F3-family

Branch `codex/spec-fix3family`. Two audited gaps in the family area. Each
was checked in the code first, and both were real.

### What was built

| # | SPEC clause | Gap confirmed in code | What was built | Where |
|---|---|---|---|---|
| 1 | D.1; Appendix H 1.3 (Freeze-Enforcement Verification, Unauthorized State-Transition Rate) and 2.2 D.1(d); Appendix H Part 3 Stage 2 and Stage 7 | No Block D database proof ran in CI or release readiness. The only native-PostgreSQL CI job was `social-db-verify`. `verify-freeze-postgres.py` was hard-wired to the Windows audit cluster (`psql.exe`, port 15483). It built a hand-written schema and applied only `0093_enforce_banking_freeze.sql`, so it tested none of the later redefinitions: `allocate_task_reward`/`allocate_pending_credit` (0163), `run_due_scheduled_credits` (0159), `decide_redemption`/`guard_redemption_state`/`family_request_redemption` (0169), `guard_share_gift` (0161) and `guard_banking_account_state` (0212). `check-no-unbacked-guarantee.mjs` only searched the proof for strings. The real-Chrome freeze matrix had been deleted in S10. Running the other Block D verifiers with `LF_PG_FULL_CHAIN=1` also showed that 6 of the 10 failed their replay step, because re-applying "every migration from X on" runs an expand step after its own contract step (0199 after 0200). Three more never ran the whole chain: governance stopped at 0177, and research re-consent and teen deletion notices stopped at their own migration. | **The proof.** `verify-freeze-postgres.py` was rewritten on the shared `LF_PG_*` harness. It applies every migration and first asserts that the live body of each of the 11 enforcing functions still carries its freeze guard and that the 4 enforcing triggers are installed. While a Tutor's freeze holds, it checks that each of these is refused: a direct request insert, the child's request flow, both approval paths, and a level-2 pre-approval even when a superuser forges it. It checks that the bonus-chore, contribution-chore and allowance splits are held, that the scheduled allowance and savings bonus post 0 and keep their due dates, and that the child can neither pledge Share coins nor take a pledge back. The child is refused on the service path (`FREEZE_OWNED_BY_GUARDIAN`) and a stranger gets `FREEZE_ACTOR_INVALID`. Every browser role (child, Tutor, stranger, anon) is refused when it writes the freeze, deletes the account or calls a movement function, and no coin moves. After the lift, each held split lands exactly once, the schedule catches up (2 posted, a 4-coin per-ten bonus), and the waiting request and the pledge resume. It also covers real lock waits in both orders and a replay. **Replay.** New `lf_pg_replay.py`: `replay_set()` returns the migrations under test plus every later migration that redefines one of their functions, triggers or policies, closed transitively. `fingerprint()`/`assert_unchanged()` then assert that every public function, trigger (and its enabled state), policy, table and column grant and EXECUTE privilege is byte-identical afterwards, and name any object that differs. The replay step of the family state machine, teen wallet, chores and bonus, money habits, autonomy, presentation, governance and deletion-notice verifiers now uses it. Governance, research re-consent and deletion notices now honour `LF_PG_FULL_CHAIN`. **A real proof defect the fingerprint found.** The money-habits verifier restored its fault-injected consent gate by replaying `0160`, which put the pre-0182 body of `family_analytics_admitted` back, so every later check ran against a stale gate. It now restores the live definition. **Runner and wiring.** The social runner's cluster logic became `pg-verify-runner.mjs`, shared by `social-db-verify.mjs` and the new `family-db-verify.mjs` (`BLOCK_D`, 11 verifiers, `LF_PG_FULL_CHAIN=1`, a missing file fails). On an external cluster it hands the verifiers the directory of the `psql` on PATH. Root and `database/` scripts: `family:db-verify`. CI: a `family-db-verify` job in `database-ci.yml`, where a red proof also stops the migration auto-apply, and one in the unfiltered `repo-gates.yml`, so a Core-only release re-proves it. `release-readiness.sh` runs it. **Self-tests.** `family-db-verify.test.mjs` checks four things: every Block D verifier is listed and exists; a verifier whose first docstring line cites a Block D clause (D.n, D-n, S07) cannot be left out; every database proof in `block-d-controls.json` is run; and every verifier honours the `LF_PG_*` harness and the whole chain, with CI, repo gates and readiness calling it. `check-no-unbacked-guarantee.mjs` now fails when the registry names a `database/scripts/*.py` proof that `BLOCK_D` does not run. README line 89 and the Mandatory-testing table point at the CI-run proof. The registry's freeze proofs now pin assertions of the new proof | `database/scripts/verify-freeze-postgres.py`, `lf_pg_replay.py`, `pg-verify-runner.mjs`, `family-db-verify.mjs`, `family-db-verify.test.mjs`, `social-db-verify.mjs`, the ten other Block D verifiers, `.github/workflows/database-ci.yml`, `repo-gates.yml`, `agent/tools/release-readiness.sh`, `check-no-unbacked-guarantee.mjs` (+ test), `docs/operations/block-d-controls.json`, `README.md`, `package.json`, `database/package.json` |
| 2 | Frontend Bible 06 (every string localized, every component declares `data-copy-role`); CLAUDE.md SPEC rules; OD-28 three-locale surfaces | `GuardianInvite.tsx` line 71: `<span … aria-label="invite link">{link}</span>`, which is English in es-MX and pt-BR and has no copy role. `GuardianInviteCopy` had no key for it. It was the only hardcoded `aria-label` in the family, banking and wallet surfaces | `GuardianInviteCopy.linkLabel` and `guardianInvite.linkLabel` in `rebuild-family.json` ("Invite link" / "Enlace de invitación" / "Link de convite"). The span uses it and declares `data-copy-role="data"`. The toggle and mint buttons carry `data-invite-control` hooks. New `GuardianInvite.test.tsx` checks, in all three locales, that the link is found by its localized name, has the data role, carries no English label, and that every text-bearing element sits under a copy role. The panel test now uses the localized name. The copy-role audit lane gains `/family@invite-link` (open, then mint; the synthetic Core answers the mint with Core's `{ token, expiresAt }`) | `frontend/src/rebuild/family/GuardianInvite.tsx` (+ test), `src/i18n/*/rebuild-family.json`, `src/routes/app/family/__tests__/GuardianInvitePanel.test.tsx`, `frontend/scripts/audits/lanes/family.mjs` |

### Verification (local)

- Native PostgreSQL 17.6 (lane-owned cluster, port 15930): `npm run family:db-verify` passed 11/11 (see the final run below), every verifier over the whole chain. The replay closure was also checked on its own against a fresh full chain for each parts set (freeze, S07.1-S07.6), and each left an identical schema.
- `database/` `npm test` (54 node tests, including the 6 new runner self-tests), `node --test` of `family-db-verify.test.mjs` and `social-db-verify.test.mjs`, `npm run tools:test` (400/400, including the new unbacked-guarantee case) and `node agent/tools/check-no-unbacked-guarantee.mjs` all green. `social-db-verify.mjs --list` still lists its 15 verifiers after the refactor.
- Frontend: `GuardianInvite.test.tsx` (4) and `GuardianInvitePanel.test.tsx` (8) green. Type-check and full lint clean. i18n gate green.
- Root: `spec:check` (exit 0) and `secrets:check` green.
- Not run here (orchestrator, per merge): the audit matrix including the new `/family@invite-link` state, browser matrices, full suites. The CI jobs have not run: nothing is pushed.

### Decisions taken with the SPEC's conservative default (owner questions)

- The Block D proofs run in both `database-ci.yml` (where they also gate the migration auto-apply) and the unfiltered `repo-gates.yml` (Core-only releases). On a push that touches `database/`, they run twice: about 10 minutes of runner time each on a 3-job PostgreSQL container, estimated from the local timings. The conservative choice is to prove on every build, as Appendix H 2.2 D.1(d) says. The owner may prefer to skip the repo-gates copy when `database/**` changed.
- The deleted real-Chrome freeze matrix was not rebuilt. The database proof now covers the enforcement, and the rebuilt coin screens' freeze card is covered by `BankingPage.test.tsx`. A browser journey of the frozen card on the rebuilt routes stays with the orchestrator's browser matrices.

### Migrations

None.

### Open items

- First CI run of the two `family-db-verify` jobs: confirm on the runner that the Ubuntu `psql` is found on PATH (the runner derives `LF_PG_BIN` from it) and record the job's duration.
- The freeze proof is about 5 to 9 minutes on this machine under load. It is the slowest single verifier with the autonomy one; `LF_PG_VERIFY_JOBS` (3 in CI) bounds the job, and the timeout is 60 minutes.
- Pre-existing, not from this lane: the migration chain cannot be replayed wholesale because of its expand/contract pairs (0199 after 0200). Any other verifier that replays "every migration from X on" will break the same way; `lf_pg_replay.replay_set()` is the shared fix.

## Checkpoint F3-family-finish (lane summary)

**Sync.** `codex/spec-migration-s02` merged into the lane branch: already up to date, no conflicts.

**Adversarial pass against the two audited gaps.**

- Gap 1 (D.1; Appendix H 1.3, 2.2 D.1(d), Part 3 Stage 2 and 7). The enforcement lives in the database functions and triggers, which is the server boundary. The proof covers the child, Tutor, stranger and anon roles on both the service and browser paths. It runs in `database-ci.yml`, where a red proof blocks the auto-apply, in the unfiltered `repo-gates.yml` and in release readiness. Nothing is missing.
- Gap 2 (Bible 06, OD-28). The label is localized in all three locales, the copy role is declared, and only shared controls are used, no legacy component. One defect found and fixed: the minted link used a raw `font-size: .8rem`, which is below the smallest type token and breaks the tokens-only rule. It now uses `var(--type-caption)` with its tracking token (`frontend/src/rebuild/family/guardianInvite.css`). This closes the proportion concern left open at F3-family.

**Final state.**

| Gap | Implementation | Local verification | Acceptance / release |
|---|---|---|---|
| 1: D.1 freeze and Block D proofs in CI and release | Done | `family:db-verify` passed 11/11 over the whole chain (F3-family); runner self-tests green | Not accepted. The first CI run has not been observed. |
| 2: invite link label and copy role | Done | Component tests in all three locales; type-check, lint, the full frontend suite and the i18n gate green | Not accepted. The `/family@invite-link` audit state has not been run through `audit:rebuild`. |

**Verification at finish.** Frontend: type-check, lint and the full vitest suite. `database/`: `npm test`. Root: `tools:test`, `spec:check`, `secrets:check` and the i18n gate. Migrations: none.

**Still open.** The first CI run of both `family-db-verify` jobs: confirm that `psql` is found on the runner's PATH and record the duration. The `/family@invite-link` audit state has not been run through `audit:rebuild`. The browser journey of the frozen card stays with the orchestrator's browser matrices.

**Owner question.** Should the Block D proofs run twice on a push that touches `database/`? The conservative default keeps both runs (Appendix H 2.2 D.1(d), "green in CI on every build").
