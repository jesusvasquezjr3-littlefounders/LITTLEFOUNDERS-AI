#!/usr/bin/env node
// social-db-verify.mjs — the data-gateway half of the social release gate.
//
// Appendix J 1.3 asks for a per-release adversarial test that a kid-role
// profile cannot be found, searched or followed by an unconnected account
// through ANY path, the data gateway included (DoD 2.1(2)). Core's stubbed
// suites cover the API; the database path is proven only by the native
// PostgreSQL verifiers in this directory. Before this runner they were run by
// hand, once per lane. This runs every one of them, against the full
// migration chain, and fails on any failure.
//
//   node database/scripts/social-db-verify.mjs [--only <substring>] [--list]
//
// The verifiers (verifiers() below): every verify-social-*.py, plus
// verify-teen-discoverable-postgres.py, verify-coop-goals-postgres.py and
// verify-account-erasure-postgres.py. Each creates and drops its own database.
// Cluster, Python and parallelism: see pg-verify-runner.mjs (LF_PG_BIN,
// LF_PG_PORT/USER/PSQL/DATA, LF_PYTHON, LF_PG_VERIFY_JOBS). Exit 1 on any
// failure; a printed SKIP only when no PostgreSQL or Python exists.

import { readdirSync } from 'node:fs';
import { HERE, main } from './pg-verify-runner.mjs';

export { findPgBin } from './pg-verify-runner.mjs';

const EXTRA = ['verify-teen-discoverable-postgres.py', 'verify-coop-goals-postgres.py', 'verify-account-erasure-postgres.py'];

/** Every verifier this gate runs, in a stable order. */
export function verifiers(files = readdirSync(HERE)) {
  const social = files.filter((f) => /^verify-social-.+\.py$/.test(f)).sort();
  return [...social, ...EXTRA.filter((f) => files.includes(f))];
}

main(import.meta.url, { name: 'social:db-verify', verifiers: verifiers() });
