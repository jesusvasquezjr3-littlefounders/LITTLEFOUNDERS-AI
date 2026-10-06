#!/usr/bin/env node
// learning-db-verify.mjs — the database half of the learning (Block B)
// release gate.
//
// Appendix C 2.2 B.1: B.1 is done only when its E2E placement test "passes in
// CI on every build" and a regression run shows zero "Could not record
// placement" errors across all four placement paths; Appendix C 2.1 asks each
// requirement to be demonstrably live. The learning database proofs below
// (placement commit, v2 grading and completion, the learning signals, the
// OD-25 pathway, atomic lesson completion, the course release gate) used to
// run by hand, once per lane, on one Windows audit cluster. This runs every one
// of them over the WHOLE migration chain (LF_PG_FULL_CHAIN=1: the placement and
// course-publish proofs switch from their historical minimal schema to every
// migration) and fails on any failure.
//
//   node database/scripts/learning-db-verify.mjs [--only <substring>] [--list]
//
// Run by `npm run learning:db-verify`, by release-readiness and by the
// learning-db-verify job of database-ci.yml (a migration cannot auto-apply past
// a red proof). A new learning verifier joins LEARNING here;
// learning-db-verify.test.mjs fails when one is left out.
// Cluster, Python and parallelism: see pg-verify-runner.mjs.

import { main } from './pg-verify-runner.mjs';

/** Every learning verifier, in a stable order. A missing file fails the gate. */
export const LEARNING = [
  'verify-placement-postgres.py',
  'verify-v2-learning-postgres.py',
  'verify-learning-r2-postgres.py',
  'verify-learning-r3-postgres.py',
  'verify-learning-r4-postgres.py',
  'verify-learning-r5-postgres.py',
  'verify-pathway-od25-postgres.py',
  'verify-completion-postgres.py',
  'verify-course-publish-postgres.py',
  // GAP-FIX-R6: Appendix C Part 3 Stage 3, the pedagogical review record and its release gate.
  'verify-stage3-review-postgres.py',
  // GAP-FIX-R7: Appendix C 1.1 (B.9), the decision-journal coverage denominator.
  'verify-decision-journal-coverage-postgres.py',
  // Gap-fix round 7: Appendix C 1.3 / Stage 6, every defect escape opens an owned gate-effectiveness review.
  'verify-gate-effectiveness-reviews-postgres.py',
  // Games in /learn (docs/games): learner-local daily cap, run idempotency, save compare-and-set, guardian limits, RLS and erasure cascade.
  'verify-game-records-postgres.py',
];

/**
 * Learning proofs this native gate cannot run, each with the reason. A
 * verifier left out of LEARNING must be named here (the self-test checks).
 */
export const NOT_NATIVE = {
  'verify-grade-postgres.py': 'drives a full disposable Supabase stack (Docker via disposable-stack.sh, PostgREST and GoTrue), not a bare PostgreSQL cluster; the v2 grade receipts it guards are re-proved natively by verify-v2-learning-postgres.py',
};

/** Every verifier runs over the whole chain; the placement proof drops its database here (the backend E2E keeps its own). */
export const GATE = { name: 'learning:db-verify', verifiers: LEARNING, env: { LF_PG_FULL_CHAIN: '1', LF_PG_DROP: '1' } };

main(import.meta.url, GATE);
