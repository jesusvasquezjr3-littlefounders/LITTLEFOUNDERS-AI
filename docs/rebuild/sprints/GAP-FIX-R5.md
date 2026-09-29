# Gap-fix round 5

Lane records for the fifth gap-fix round of the SPEC migration. Each lane
appends its own section. Statuses follow the ledger: implementation, local
verification, acceptance and release are separate, and nothing here is
accepted or released.

## Checkpoint F5-design-system

Branch `codex/spec-fix5designsy`. Two audited gaps in the design-system area.
Both were checked in the code first and both were real. One more defect
surfaced while wiring the second: the Mentor-stage verifier had drifted from
the product and could not pass (below).

### What was built

| # | SPEC clause | What was built | Where |
|---|---|---|---|
| 1 | Bible 02 rule 2 (no glass, no gradients), D13 and rule 23 (the legacy look is rebuilt, never carried over); 04 §2 (duration and easing tokens), §3 (reduced motion); 02 §9.4 (idle motion on three things only); 07 §3 | The inline boot veil every page shows during the bundle download is rebuilt. It was an 18 px `backdrop-filter` blur (also animated in `lf-boot-out`), a breathing `radial-gradient` bloom on an infinite 2.4 s loop and a 560 ms `cubic-bezier(0.22, 1, 0.36, 1)` dissolve. It is now an opaque `--base` ground with nothing on it, which alone hides the prerendered shell. The `@supports` block, the reduced-motion `!important` override and the bloom pseudo-element are gone. The dissolve is `--dur-transition` (380 ms), with the veil leaving on `--ease-exit` and `#root` arriving on `--ease-enter`, and it exists only under `prefers-reduced-motion: no-preference`. With reduced motion the veil cuts away. The fail-open deadline (30 s CSS timer plus the `load`-armed release) is kept. It is now a `step-end` timer, so nothing moves and it still runs under reduced motion. The release script's fallback duration is 0, not a second copy of a number. `bootVeil.test.ts` holds the inline stylesheet (the one product stylesheet outside `src/rebuild`) to the rule 2 and 04 §2 contract. It checks for no `backdrop-filter`, filter, gradient or shadow, no `@supports` or `!important`, and no pseudo-element bloom. It also checks that every duration literal is the dissolve token copy or the deadline, that every `cubic-bezier` is `--ease-exit` or `--ease-enter` read from `tokens.css`, and that no keyword curve or `infinite` is used. Outside the no-preference query, only the two `step-end` deadline animations are allowed. Keyframes may animate opacity only. Run against the legacy file, 10 of these tests fail. | `frontend/index.html`, `frontend/src/__tests__/bootVeil.test.ts`, citations in `frontend/src/App.tsx` and `frontend/src/lib/boot.ts` |
| 2 | Bible 02 §7 item 10 and 06 §7 (text fit and copy budget before merge); 03 §5 (proportion); 05 §8 (board rules); 08 §9 (stage verification); CLAUDE.md SPEC rule on UI merges | **One gate command.** `frontend/scripts/rebuild-audit-gate.mjs` (`npm run audit:gate -- --suite audits\|mentor-stage\|all`; root `npm run rebuild:audit-gate` runs `all`) runs the predev decoder copy and starts Vite on a strict port (`AUDIT_GATE_PORT`, default 5310). It then runs `audit-rebuild.mjs all` and/or `verify-mentor-stage.mjs` against that server, stops it, and exits with the worst code (0 clean, 1 findings, 2 setup). With no Chrome it prints SKIP and exits 0, unless `--require-chrome` is given, in which case it exits 2. `browser.mjs` exports `findChrome()`. **Sharding without trimming.** `AUDIT_SHARD=k/n` (`shardStates` in `audits/states.mjs`) splits the state list round-robin into disjoint, balanced shards. Each report records `shard`, `filtered` and the `[signature, state]` pairs. `scripts/audits/merge-shards.mjs` merges n reports and exits 2 unless every shard 1..n is present once, no shard was narrowed by `AUDIT_STATES` or a trimmed locale, theme or width list, every state in `states.mjs` was measured exactly once, and no two states in different shards render identical markup (the driver's own check, across shards). It sums configurations, merges finding groups by key and exits 1 on findings or JS errors. **CI.** `frontend-ci.yml` gains `rebuild-audits`: `needs: ci`, 12 shards, `fail-fast: false`, `scenes:fetch`, then the gate with `--suite audits --require-chrome`, `AUDIT_WORKERS=2` and `AUDIT_READY_MS=60000` (a shared runner is a loaded machine, as the driver header defines one). Each shard's reports are uploaded, and `rebuild-audits-report` merges them into the `rebuild-audits` artifact. The `browser-gates` job now runs the Mentor-stage verifier (`--suite mentor-stage --require-chrome`) and uploads `mentor-stage`, so its comment is true. frontend CD deploys only a green frontend CI, so all of these are deploy gates. **Release readiness.** `release-readiness.sh` runs `npm run rebuild:audit-gate` after the db-verify proofs. **Verifier drift fixed.** `verify-mentor-stage.mjs` still expected the chooser portrait (`/rebuild/mentor-chooser/liruf-<mode>.png`, pose `ambient.idle`) as the low-power, no-WebGL and data-saver still. Since W3M.1 the stage shows the same character in the pose its state plays (`/rebuild/mentor-stage/liruf-ambient-listen-<mode>.png`, `ambient.listen`), as `MentorStage.test.tsx` and `stageStills.test.ts` pin. The verifier now expects that. `agent/tools/rebuild-audit-gate.test.mjs` (in `tools:test`, so in the unfiltered repo gates) pins the partition, every merge refusal, the gate's suites and Chrome decision, and the CI and release wiring. | `frontend/scripts/rebuild-audit-gate.mjs`, `frontend/scripts/audits/merge-shards.mjs`, `frontend/scripts/audits/states.mjs`, `frontend/scripts/audit-rebuild.mjs`, `frontend/scripts/lesson-engine/browser.mjs`, `frontend/scripts/verify-mentor-stage.mjs`, `frontend/package.json`, `package.json`, `.github/workflows/frontend-ci.yml`, `agent/tools/release-readiness.sh`, `agent/tools/rebuild-audit-gate.test.mjs`, `README.md` |

### Verification (local)

- The rebuilt veil on the real dev server, in headless Chrome at 375 px, in
  light and dark with motion and in dark with reduced motion. While armed,
  the veil computes `backdrop-filter: none`, `background-image: none`, no
  `::after` content and the `--base` colour (rgb 244 245 253 / 11 13 27). Its
  only animation is the `steps(1)` 30 s deadline. After release, the
  attribute is gone, the veil is `display: none`, `#root` has opacity 1 and
  no animation, and there are no console errors. A screenshot of the armed
  dark veil shows a flat ground.
- The gate itself: `AUDIT_STATES=system,gallery,overlays AUDIT_SHARD=2/3`
  with one locale, mode and width measured exactly the one state of shard 2
  (`gallery`). It found 0 findings and exited 0. The Vite server and Chrome
  were stopped afterwards, and no lane process was left. `merge-shards.mjs`
  on that report exited 2, naming the narrowed matrix, the missing shards 1
  and 3, and the 440 unmeasured states.
- The Mentor-stage verifier through the gate (`--suite mentor-stage`) on this
  machine, before the orchestrator stopped the lane: the `stage` (48) and
  `states` (101) families passed, 149 of 149. The `modes` family failed the
  reduced-motion and low-power checks in every locale and mode (no-WebGL and
  data-saver passed), and the `lesson` family failed at 320 and 375 px (768
  and 1280 px passed). Both runs were stopped before the report was written,
  so the failing assertion is not recorded. An earlier `modes` run failed
  only because `public/scenes/` had not been fetched in this worktree
  (`diorama-a.glb` served as HTML), which CI's `scenes:fetch` covers. The
  lane's speed rules forbid further browser runs, so these failures are open
  (below). They are not caused by this lane's changes, which touch only the
  verifier's still expectation.
- Frontend `type-check` and `lint`. Focused vitest: `bootVeil`,
  `designClasses`, `galleryContract`, `controlsCss` and `stageStills`, 112
  tests. `node --test agent/tools/rebuild-audit-gate.test.mjs` passed 14
  tests. Root `spec:check` and `secrets:check` passed. No copy changed, so
  the i18n gate was not required.

### Decisions taken with the SPEC's conservative default (owner questions)

- The veil keeps no loading shape at all ("either nothing or the shimmer"):
  the boot window is short, the shimmer is busy motion reserved for a
  surface's own loading state, and nothing on the ground cannot break 02
  §9.4.
- The CI split is 12 shards, estimated from the measured 58 states in about
  20 minutes on the 16-thread machine, which extrapolates to about 150
  minutes for 441 states. That is roughly 12 runner jobs of 20 to 40 minutes
  each on every frontend push. This costs GitHub Actions minutes, not model
  spend (OD-23 is about paid generation), but it is a recurring cost the
  owner should know about.

### Commits

- `92f48a9e` fix(frontend): rebuild the boot veil from the Bible, without the legacy glass
- `5085caa9` ci(frontend): run the Bible audits and the Mentor-stage verifier in CI and release readiness

### Migrations

None.

### Open items

- The full 441-state matrix has not run in CI or locally in this lane. The
  first CI run is also the first full measurement, so it can surface existing
  findings. Because the job is a deploy gate, a red first run blocks frontend
  CD until they are fixed. The orchestrator's merge gate is the place to run
  it first, locally.
- The Mentor-stage verifier is red locally in two families (reduced motion
  and low power in `modes`; phone widths in `lesson`). Until each failure is
  read from a full report and fixed, in the product or in the verifier if it
  drifted again, the `browser-gates` job is red and blocks frontend CD. Run
  `npm run audit:gate -- --suite mentor-stage` from `frontend/` (or
  `MENTOR_STAGE_FAMILIES=modes,lesson node scripts/verify-mentor-stage.mjs`
  against a running server) at the orchestrator's end gate.
- The shard runtime on the GitHub runner is unmeasured. The 75-minute
  per-shard timeout is a guess to revisit after the first run.
