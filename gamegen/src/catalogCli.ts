#!/usr/bin/env node
// `npm run catalog:check [-- <course-dir>]` — the Arcade catalog gate.
//
// Thin entry point on purpose (Forge's `cli.ts` / `pipeline/run.ts` split): argv in,
// exit code out. Discovery, validation, cross-catalog resolution and printing all live
// in `src/catalog/check.ts` + `src/catalog/loader.ts`, which are pure and are what the
// test suite calls directly.
//
// With no argument it validates every course directory under `gamegen/curriculum/`.
// With one it validates just that directory (absolute, or relative to cwd).
//
// DEV/CI-TIME ONLY — this reads `coursegen/curriculum/` from the repo root to prove
// every blueprint's `topic_path` binds to a real Forge topic. Railway deploys gamegen
// with `--path-as-root`, so `coursegen/` does not exist in the production image and this
// command cannot (and must not) run there. Nothing on a request path may call it.
// `gamegen-ci.yml`'s path filters must include `coursegen/curriculum/**`, or a Forge
// rename silently breaks every binding with nothing failing.

import { runCatalogCheck } from './catalog/check.js';

process.exit(runCatalogCheck(process.argv.slice(2)));
