#!/usr/bin/env node
// staff-analytics-db-verify.mjs — the database half of the Block G (staff
// console) and Block H (analytics and operations) release gate.
//
// Appendix N 1.1 (Cosmetic-Permission Regression Test and Permission-Endpoint
// Enforcement Coverage, every release), 1.2 (Mentor Live-Activity Review
// Audit-Log Completeness, verified per release; Bypass-Path Justification),
// 2.3(a)/(b) and Part 3 Stage 2; Appendix O 1.1 (Kid-Role Consent Gate
// Regression Check, pass every release), 2.2(b) and Part 3 Stage 2. The
// server-side G.1/G.2/G.3 enforcement and the database half of the kid and
// teen consent gate are proved by the native-PostgreSQL verifiers below.
// Before this runner they were run by hand, once per lane, and two of them
// (admin permissions and the analytics admission) tested a hand-written
// schema instead of the functions production runs. This runs every one of
// them over the WHOLE migration chain and fails on any failure.
//
//   node database/scripts/staff-analytics-db-verify.mjs [--only <substring>] [--list]
//
// Run by `npm run staff:db-verify`, by release-readiness, by the
// staff-db-verify job of database-ci.yml (a migration cannot auto-apply past
// a red proof) and by the unfiltered repo gates (a Core-only release still
// re-proves it). A new Block G/H verifier joins BLOCK_GH here;
// staff-analytics-db-verify.test.mjs fails when one is left out.
// Cluster, Python and parallelism: see pg-verify-runner.mjs.

import { main } from './pg-verify-runner.mjs';

/** Every Block G/H verifier, in a stable order. A missing file fails the gate. */
export const BLOCK_GH = [
  'verify-staff-ops-postgres.py',
  'verify-content-release-postgres.py',
  'verify-data-platform-postgres.py',
  'verify-course-publish-postgres.py',
  'verify-admin-permissions-postgres.py',
  'verify-analytics-disclosure-postgres.py',
  'verify-analytics-postgres.py',
  'verify-mentor-quality-audits-postgres.py',
];

/** Every verifier runs over the whole chain. */
export const GATE = { name: 'staff:db-verify', verifiers: BLOCK_GH, env: { LF_PG_FULL_CHAIN: '1' } };

main(import.meta.url, GATE);
