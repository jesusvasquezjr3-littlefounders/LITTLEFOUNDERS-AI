# Readiness push, 30 September 2026

This is an engineering action and evidence register, not a specification amendment or acceptance certificate. Authority remains the [SPEC](../littlefounders-spec/README.md). The owner requested a one-hour push to make content regeneration and frontend refinement the next work phase. The window started at 22:22 UTC; the target checkpoint is 23:22 UTC. Time limits do not waive mandatory gates or human reviews.

## Historical engineering checkpoint at 23:20 UTC

The authorized operational changes and exact CI-passing frontend deployment are complete. Human acceptance, paid work and hands-on product evaluation remain outside this session by the owner's explicit instruction. The new local combined branch has not been committed or pushed: its full database mock harness and browser audit are still running, and its initial broad frontend unit run reported a loading timeout (isolated retry passed). These pending checks are not a claim about the separate, already-green remote revision deployed below.

## Local engineering verification complete at 01:17 UTC, 1 October

The authorized operational work and local engineering corrections are verified. The final lesson-engine gate exited 0: all 57 fixtures started and all controls were reachable, with zero hollow character slots, console errors or failed requests and one WebGL context. Its nongating observations were 42/57 verdicts and 50/57 results screens, not human acceptance. Combined with the complete service runs/retry, static gates, production build, full browser matrix plus the corrected affected-state rerun, this closes local verification. Repository integration and its required pre-push/remote checks follow this checkpoint. The earlier deployed revision remains 927016bf until the integrated revision's CD completes. Human acceptance, paid content/calibration and named custody signoff remain explicitly outside this engineering session.

## Baseline at the initial review

- Production is the **evaluation deployment** of `442ffa26`, documented in [the deployment record](DEPLOY-2026-09-30.md). The production schema has 256 migration receipts through `0256_v2_manifest_age_register_gate.sql`, independently queried during this review. Do not repeat the cutover or reset the database.
- Remote `main` is `d270a219`; `release/2026-09-30` is `927016bf`. The latter includes adaptive-quality fix `0107ef34` and audit-driver fix `927016bf`. Its frontend CI run [36741452204](https://github.com/jesusvasquezjr3-littlefounders/LITTLEFOUNDERS-AI/actions/runs/36741452204) passed all jobs. Main's run [36745957757](https://github.com/jesusvasquezjr3-littlefounders/LITTLEFOUNDERS-AI/actions/runs/36745957757) failed performance and one audit shard. The release fixes are integrated locally, without a commit, on `codex/readiness-2026-09-30`, based on remote main.
- OD-29 already approved 431 registered assets for evaluation. The old 379-draft asset blocker is obsolete. New assets still need their own review.
- Production contains zero v2 lesson versions, zero v2 runs, zero Mentor judge-calibration rows, zero live-content judge-calibration rows and zero curated Mentor packs. The pathway switch is absent (default linear). The v2 attempt-signing secret is absent. These are activation/content prerequisites, not evidence that the existing implementations are missing.
- The latest inspected Vault backup run failed to start with a billing/spending annotation. Later CI and Pulse backup runs succeeded, so a blanket claim that all Actions are down is no longer supported. The CD workflows remain manually disabled. Main has neither branch protection nor a ruleset.
- The September 30 cutover backup is encrypted. Older daily Vault dumps remain plaintext. The current GitHub secret list lacks `BACKUP_ENCRYPTION_KEY`. The local key's fingerprint matches the cutover manifest; its value has not been printed or copied into this repository.

## Session scope confirmed by the owner

The owner subsequently authorized the operational changes, release preparation and parallel agents, with changes first and verification last. Human acceptance, paid calibration/generation and hands-on product evaluation are explicitly outside this session and belong to the next one. Their rows below remain a handoff inventory, not work required to complete this engineering session.

## Complete closure plan

| Work | Immediate action | Evidence required before closing | Dependency / boundary |
|---|---|---|---|
| One consistent release | Integrate the two release fixes into current main; run required local gates; review and release that exact revision | Green local gates, CI, deployed revision and live smoke results | A passing older branch does not certify a newly merged tree; a push to main can deploy |
| Encrypted daily backups | Establish two-custodian key custody; configure the existing key for both backup workflows; run and verify one Vault and one Pulse backup | Successful workflows, ciphertext manifests, decrypt/restore verification and recorded restore result | Do not delete old plaintext backups until replacement and retention disposition are verified |
| Reliable scheduled operations | Check every required schedule and heartbeat, failures and alert routing; perform a deployed watchdog drill | Current heartbeat coverage plus a delivered alert and recovery evidence | Local simulated drill is insufficient; issue/email delivery requires authorization; deletion sweeps must not be triggered casually |
| Repository governance | Apply the prepared main ruleset and verify its effective rules | Required PR/check rules reported by GitHub | Existing runbook assigns application to the owner; account plan may constrain rulesets |
| Deployment automation | After successful current workflows, decide whether to restore CI-chained CD and document the decision | Explicit workflow states, successful representative CI and deploy checks | Do not enable all workflows indiscriminately; database CD can apply production migrations |
| Production configuration | Provision a distinct v2 attempt-signing secret; inspect secure-email-change runtime policy; run read-only service preflight | Safe presence/policy checks, passing v2 request lifecycle and preflight | Never expose secret values; configuration changes may restart services |
| Data preservation | Carry forward the completed 256-migration cutover and reconciliation; finish named human acceptance | Signed reconciliation and QA-family journey evidence | No second migration/reset; production aggregate evidence is not a human acceptance signature |
| Pathways | Present the existing OD-22 policy and evidence for owner review; activate only in the approved catalog rollout | Recorded policy decision, prerequisite/credit/badge checks on published content | Keep current conservative switch until approval and content readiness |
| Mentor calibration | Prepare human-labeled calibration material; obtain the required reviewers and explicit spend ceiling; run calibration and evaluate results | Persisted calibration that passes the specified thresholds and reviews | Zero spend until approved; live generation stays fail-closed |
| Curated Mentor content | Seed the validated 21 packs into review; complete actual content review and publication | Review records, published packs, successful learner activity | Validation is not pedagogical acceptance; do not auto-approve packs |
| Forge production readiness | Exercise authoring, scoring, publication dry-run and staff release boundaries; regenerate one pilot before bulk production | A reviewed pilot can be generated, published, played, graded, resumed and completed with retained credit | Empty production v2 catalog is expected until this phase; synthetic fixtures are not the replacement catalog |
| Audio and full catalog | Approve a budget, generate required audio and lessons, apply every Forge gate and Stage 3 review, then publish in batches | Per-course release evidence, cost record, age/locale coverage and rollback plan | This is the next content-production phase; retire legacy catalog only after replacement works |
| Mentor Tier 1 governance | Obtain real Pedagogical and Safety/Trust signatures on every outstanding governed change | Release governance gate passes with genuine review evidence | Engineering must not fill signatories on reviewers' behalf |
| Dark-pattern and product review | Resolve open audit items, perform and sign the release audit; review social/sharing/free-text constraints and thresholds | Signed release audit and per-block review records | Engineering pre-audit alone does not satisfy release acceptance |
| Legal and consent | Review terms/privacy, age evidence, retention, research consent, independence ages, deletion SLA, social retention and FAQ claims | Named decisions recorded against the applicable requirements | Conservative defaults remain; do not broaden experiments or research enrollment |
| Devices and accessibility | Test physical phones/tablets, Safari/Firefox, screen readers, safe areas, low-power fallback and share sheets | Device/browser/assistive-technology evidence with resolved blocking defects | Headless software rendering does not prove real-device performance |
| Design and language | Review visual/motion/copy quality and native es-MX/pt-BR registration, consent and money copy | Named review evidence and passing text-fit/proportion/copy-budget audits | Can proceed alongside content work; usability defects that block consent or task completion remain functional blockers |
| Operational ownership | Name metric, Platform and Data/Privacy owners; perform the first access and recalibration reviews | Assigned owners, signed review entries and next due dates | A schedule existing in source does not prove its first review occurred |
| Post-release evidence | Observe the required production cycle, retire replaced legacy content and execute the dated badge-link removal | Metrics per requirement and dated lifecycle receipts | Cannot be compressed into this hour; legacy badge removal is scheduled for 24 October 2026 |
| Honest tracking | Reconcile completion report, sprint and requirement ledger with deployment and verification evidence | Each item distinguishes implementation, verification, acceptance and release | No blanket Accepted status and no claim that evaluation deployment equals full release |

## Fresh verification in this window

- `forge:v2:dry-run`: PASS. 132 documents, 255 graded segments and 140,424 permitted states; no provider/network/DB writes.
- `seed:tutor-packs --check`: PASS. 21 packs, 84 segments; nothing seeded or published.
- `ops:drill`: PASS for all 15 simulated stale-job scenarios. This proves local detection/notice behavior, not production alert delivery.
- `typecheck:all` and `lint:all`: PASS across all services.
- `spec:check`: PASS.
- Read-only Railway production preflight: PASS with zero warnings.
- Pilot authoring/publication dry run: PASS in three locales; three publication calls prepared, none sent. Missing narration and Stage 3 review are correctly flagged for the next content phase.
- `secrets:check`: PASS.
- `tools:test`: PASS, 622 tests.
- Frontend strict production build: PASS, including the approved-asset gate and seven prerendered SEO pages; bundle-size warnings remain optimization work.
- Existing encrypted cutover dump and OD-9 reconciliation archive: authenticated verification PASS, with both manifests checked and no plaintext copy written. This does not constitute a new database restore test.
- Full service tests and full browser audit: running; a running check is not a pass. The Windows fake-Railway migration harness is actively progressing, not hung. Independent remaining-service tests are running so it does not delay their verification.

## Meaning of the one-hour checkpoint

The achievable target is a verified engineering handoff to content production, with operational blockers closed where authorized and all remaining reviews owned. It is **not** full SPEC acceptance: live calibration, genuine human signatures, physical-device evidence and one production measurement cycle cannot be replaced with code or a deadline. If a mandatory check is still running or fails, the candidate remains uncommitted/unreleased until resolved. The initial entry preceded operational authorization. Production configuration and review-only seeding were subsequently completed as recorded below; no paid provider call or human acceptance is implied.

## Authorized changes and evidence

- Core: a distinct cryptographically generated 96-character `LESSON_ATTEMPT_SECRET` is configured and present in the running service; its value was not printed or persisted locally. Redeploy `7c9d8748-70e2-488b-adf1-fa94b2c09550` succeeded and the public health endpoint returned `ok`.
- GoTrue: `GOTRUE_MAILER_SECURE_EMAIL_CHANGE_ENABLED=true` is configured and verified in the running process. Redeploy `a23147a8-8f73-4dec-bb2d-0f72cb0eb5e2` succeeded.
- Mentor packs: the supported seed inserted 21 packs / 84 segments, with no failed writes. Production readback confirmed all 21 in `review`, version 1 with content hashes; zero published and zero release/validation markers. Pathway remains default `linear`; no calibration or publication was bypassed.
- Main ruleset `24277465` is active, enforcing pull requests and required status checks. The owner expressly authorized applying the prepared ruleset.
- GitHub backup encryption secret is configured. [Vault run 36788702367](https://github.com/jesusvasquezjr3-littlefounders/LITTLEFOUNDERS-AI/actions/runs/36788702367) and [Pulse run 36788709131](https://github.com/jesusvasquezjr3-littlefounders/LITTLEFOUNDERS-AI/actions/runs/36788709131) succeeded. Their 46,778,076-byte and 426,018-byte ciphertexts match manifest SHA-256 values and passed local authenticated verification without plaintext output.
- All 12 service CD workflows were re-enabled after confirming no queued/in-progress main CI would trigger an older unintended deployment. Pulse Dependabot automerge remains paused.
- The authorized deployed watchdog run 36789072236 delivered [issue #113](https://github.com/jesusvasquezjr3-littlefounders/LITTLEFOUNDERS-AI/issues/113) for seven never-run jobs: Vault drift, account deletion, family/social/learning retention, insights prune and badge retirement. Read-only Vault drift run 36789323658 then passed: zero pending migrations, matching ledger, heartbeat recorded. Follow-up watchdog run 36789969620 cleared drift and reported the six remaining lifecycle jobs. Destructive sweeps were not manually triggered. Their active schedules must establish first-run evidence; the alert was not suppressed.
- Historical backup conversion: all 73 plaintext dumps (1,948,144,705 bytes) were converted individually to AES-256-GCM. Each original remained until source hash/size, ciphertext hash, manifest, authenticated decryption and re-read source hash agreed; only then was that exact original removed. Final Depot inventory: zero plaintext `.dump` files, 76 encrypted `.dump.lfbk` files and 76 manifests (73 converted, two fresh, one cutover). Temporary remote key/helper files were removed. Backup timestamps were retained for the existing 30-day policy; no retention prune was manually run.
- A second local copy of the two fresh encrypted backups and manifests is stored in `C:/Users/mel_f/OneDrive/LittleFounders-Encrypted-Backups/2026-09-30`; copied SHA-256 values were verified. OneDrive cloud synchronization was not verified, so this is not claimed as a confirmed offsite copy.
- At the 23:20 deployment checkpoint, the local frontend working tree was byte-equivalent to remote release `927016bf` (`git diff 927016bf -- frontend` empty, no untracked frontend files). That remote revision passed all frontend CI jobs. The combined local branch still needs its own pending checks before commit/push; these are separate claims.

## Local verification limits during the final checks

The broad frontend run reported a staff-preview loading timeout; the isolated file passed all 11 tests. A separate broad Oracle run reported seven failed tests and four hook timeouts (1,688 passed, 94 skipped). CPU was measured at approximately 90% across 16 logical processors while browser auditing and production asset checks were active, with about 10 GB RAM free. These are unresolved local verification results until serial retries and the required complete runs pass; they are not automatically classified as product defects or dismissed as load. No source or timeout has been changed to conceal a failure. Dataintel, email-server, filebase, parent-id-check and picturegen passed their independent service runs. The original complete test command remains in its progressing fake-Railway database harness.

Controlled-concurrency diagnosis: all seven previously failing Oracle files passed on a sequential single-worker retry (125/125 tests, 137.8 seconds), with no code or timeout changes. A complete controlled-concurrency Oracle rerun is still required before calling that local service verification clean.

## Frontend deployment and final service verification

- Exact remote revision `927016bf2986dfd543b2623eba244225a54532e6` was built from clean `C:/lf-wt/relfix` using production Vercel settings. The release asset gate, TypeScript, Vite and SEO build passed. All 18 jobs in its remote frontend CI run 36741452204 had passed. No new source commit or push was used to deploy it.
- Vercel deployment `dpl_D6Bp1TE6yWEaoFxmzvc9opjsYv3p` is READY at [the immutable deployment URL](https://littlefounders-l7f129jd2-littlefounders-ai-team.vercel.app), aliased to [littlefounders.ai](https://littlefounders.ai). An initial upload failed without creating a deployment; the same prebuilt artifact succeeded on retry.
- Live `/assets/index-BA72B9c6.js` SHA-256 matches the prebuilt artifact: `E0076E5B9B90A399733316550F660D6CEEA54CFC706FAB221D275A3F5B254CB9`. Independent root checks returned HTTP 200 for the landing page and app shell (both reference that asset) and HTTP 200 / status `ok` for Core health.
- Full Oracle verification then passed with controlled concurrency: 68/68 files and 1,789/1,789 tests, exit 0, 222.26 seconds (`vitest run --maxWorkers=2 --fileParallelism=false`). No code or timeout changes were needed. The first broad-run failures remain recorded above.
- Local release integration and documentation remain on `codex/readiness-2026-09-30`, uncommitted/unpushed. Do not merge or push that branch until its pending mandatory checks are resolved. Existing draft PR 112 was not merged or altered. The production deployment was of the independently verified existing release revision, not a claim that those local gates had finished.

## Final blocker-closure work

The owner subsequently directed completion of every remaining engineering item, including the six lifecycle jobs, rather than waiting for their schedules. Operations is checking due effects against existing policy before dispatch. The original aggregate completed with only the frontend asset-gate initial OCR check failing its 300-second deadline; staff preview and lesson-route tests passed in that aggregate. The frontend test command now bounds workers and serializes files without changing assertions or timeouts. The migration harness now overlaps three independent fake transports, preserves all 13 scenarios and all 45 assertion lines, and waits for every child before fixture cleanup. Fresh mandatory checks are running on these final changes.

## Lifecycle closure at 23:52 UTC

All six lifecycle workflows succeeded after aggregate preflight found zero due deletions/expired records under their existing policies. No retention criteria were broadened. Family run 36792574580, badge retirement 36792638273, account deletion 36792700660, social retention 36792859707 and learning retention 36792927718 recorded zero removals and successful receipts. Insights maintenance 36793032463 added 14 rollup rows (382 total), pruned zero raw rows and produced zero bridge prompts. Final [watchdog run 36793200947](https://github.com/jesusvasquezjr3-littlefounders/LITTLEFOUNDERS-AI/actions/runs/36793200947) passed: 11 healthy jobs, `anyStale=false`, zero overdue content checks/access reviews/stuck deletions/undelivered alerts. Issue #113 was closed with the run history preserved. The earlier six-job limitation is resolved.


## Fresh restore evidence at 00:17 UTC, 1 October

[Read-only production rehearsal 36794589972](https://github.com/jesusvasquezjr3-littlefounders/LITTLEFOUNDERS-AI/actions/runs/36794589972) captured a fresh 46,806,504-byte production archive and restored it into disposable PostgreSQL with zero restore errors. The encrypted rehearsal backup then restored into backup_check with zero errors, inventory comparison failures zero and spot-check changed/missing counts zero. This proves restore of a freshly generated current-production encrypted backup; it does not claim a restore of the stored daily or final cutover archive. Production was only read; migration, seeding, reconciliation and smoke checks ran only on the disposable copy and passed. The overall workflow failed its final pre-cutover rollback assertion that od9.findings must be empty: the already-migrated source contains 820 historical findings. The final rollback restore itself had zero errors and matching inventory. No whole-workflow PASS is claimed. Named second-custodian confirmation remains a human ownership handoff; engineering has not invented custody evidence.

Rehearsal correction: the workflow now snapshots the source OD-9 findings count before replay and requires the restored copy to match that count, preserving zero for a pre-cutover source and historical findings for an already-migrated source. The focused backup workflow contract suite passes 10/10; full tools verification and remote rehearsal of this correction remain pending integration.


## Final browser findings and correction

The complete 540-state audit measured 51,792 text-fit and 12,948 proportion configurations with zero findings. Copy Budget measured 12,948 configurations and found exactly two first-view overages on the same staff generation screen (English, light/dark, 375 px): 41 words against 40. Its spending/progress sentence was shortened without changing either value. All six generation states were then rechecked over three locales, two themes and four widths: 576 text-fit, 144 proportion and 144 Copy Budget configurations passed with zero findings and JavaScript errors. The original full reports are preserved separately from that focused rerun; a whole fresh full-matrix pass is not claimed. Mentor-stage passed all stage 48, states 77, modes 24, lesson 96 and performance 12 configurations with zero failures. Full tooling after the restore correction passed 623 tests. Final service tests, build and lesson-engine verification remain in progress.


## Service and build verification at 01:15 UTC, 1 October

The final aggregate completed every service. All assertions passed, including frontend 303 files / 3,581 tests and all 13 migration-transport scenarios, but Core reported one worker RPC timeout despite 164 files / 3,774 passed tests, so that aggregate exited 1. A complete Core rerun with one worker and sequential files then passed 164/164 files and 3,774/3,774 tests, exit 0, 473.05 seconds; the original worker error is not erased or described as a green aggregate. All services now have clean complete-run evidence. Final type checks, lint, i18n, the UI tone gate, secret scan and production build passed after the copy edit; tools passed 623/623 after the restore correction. Lesson-engine verification and repository integration are still pending at this checkpoint.
