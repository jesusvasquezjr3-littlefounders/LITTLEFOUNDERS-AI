#!/usr/bin/env node
// family-db-verify.mjs — the database half of the Block D (Family Hub and
// Wallet) release gate.
//
// Appendix H 2.2 D.1(d): the Freeze-Enforcement Verification is done only
// when it is "green in CI on every build, not just checked once at ship time";
// Appendix H 1.3 asks for it and the Unauthorized State-Transition check on
// every release, and Part 3 Stage 2 for an adversarial test through the data
// gateway on every structural change. Those proofs are the native-PostgreSQL
// verifiers below. Before this runner they were run by hand, once per lane,
// and the freeze proof tested a hand-written schema instead of the functions
// production runs. This runs every one of them over the WHOLE migration chain
// (LF_PG_FULL_CHAIN=1: every later migration applied, so a later redefinition
// of a guard is re-proved) and fails on any failure.
//
//   node database/scripts/family-db-verify.mjs [--only <substring>] [--list]
//
// Run by `npm run family:db-verify`, by release-readiness, by the
// family-db-verify job of database-ci.yml (a migration cannot auto-apply past
// a red proof) and by the unfiltered repo gates (a Core-only release still
// re-proves the freeze). A new Block D verifier joins BLOCK_D here;
// family-db-verify.test.mjs fails when one is left out.
// Cluster, Python and parallelism: see pg-verify-runner.mjs.

import { main } from './pg-verify-runner.mjs';

/** Every Block D verifier, in a stable order. A missing file fails the gate. */
export const BLOCK_D = [
  'verify-freeze-postgres.py',
  'verify-family-state-machine-postgres.py',
  'verify-teen-wallet-postgres.py',
  'verify-chore-streak-bonus-postgres.py',
  'verify-money-habits-postgres.py',
  'verify-autonomy-decisions-postgres.py',
  'verify-money-presentation-postgres.py',
  'verify-family-governance-postgres.py',
  'verify-research-reconsent-postgres.py',
  'verify-teen-deletion-notices-postgres.py',
  'verify-teen-bridge-goal-postgres.py',
];

/** Every verifier runs over the whole chain. */
export const GATE = { name: 'family:db-verify', verifiers: BLOCK_D, env: { LF_PG_FULL_CHAIN: '1' } };

main(import.meta.url, GATE);
