# agent/

Runnable tooling only — no rules, no templates, no briefings. Everything here is a script the repo (or CI) actually executes; if a file in this directory is not run by an npm script, a workflow, or another tool here, it does not belong here.

## tools/ — gates and operator scripts

Most are wired to root `package.json` scripts and run in CI via `.github/workflows/repo-gates.yml` (plus per-service CI):

| Script | npm script | What it checks / does |
|---|---|---|
| `check-secrets.sh` | `secrets:check` | No credential patterns in tracked files |
| `check-i18n.sh` (+ `check-t-keys.mjs`, `check-hardcoded-strings.mjs`) | `i18n:check` | 3-locale key parity + hardcoded-string scan |
| `check-marketing-paths.mjs` | `paths:check` | Marketing route lists agree between `frontend/` and `backend/` |
| `check-seo-surface.mjs` | `seo:check` | The declared public surface (`frontend/scripts/seo/site.mjs`) agrees with the app's routes |
| `check-seo-live.mjs` | `seo:live` | What production actually serves a crawler (run after a frontend deploy) |
| `check-provider-parity.mjs` | `provider:check` | Forge and Oracle agree on DeepSeek/Qwen base URLs and models |
| `check-instrument-parity.mjs` | `instruments:check` | Whiteboard instrument shapes agree across their five hand-written copies |
| `check-preferred-types-parity.mjs` | `preferred-types:check` | `segmentRequest.preferredTypes` vocabulary agrees between oracle and backend |
| `check-demo-step-parity.mjs` | `demo-step:check` | `demonstrate` step shape agrees across its six hand-written copies |
| `check-roleplay-voice-parity.mjs` | `roleplay-voices:check` | Roleplay dialogue agrees between oracle's synthesized catalog and the frontend captions |
| `generate-roleplay-voices.mjs` | `roleplay-voices:generate` | Regenerates the frontend's roleplay voice-URL lookup from oracle's manifest |
| `check-dep-drift.sh` | `deps:check` | Dependency version drift across the 11 packages |
| `check-clean-tree.sh` | `git:diff-check` | Working tree, index and untracked set match HEAD |
| `run-all.sh` | `test:all` / `typecheck:all` / `lint:all` | Runs the given npm script in every package |
| `release-readiness.sh` | `release:readiness` | All local gates + zero-spend course/audio dry-runs |
| `railway-preflight.sh` | `production:preflight` | Read-only Railway inventory/config check (operator-only, never CI) |
| `new-service.sh` | — | Stamps a new Express+TS service skeleton (`new-service.sh <name> <port>`) |
| `analytics-diagnose.mjs` | — | Ad-hoc analytics diagnosis against Pulse |
| `*.test.mjs` | `tools:test` | Self-tests for the gates above (run in CI) |
