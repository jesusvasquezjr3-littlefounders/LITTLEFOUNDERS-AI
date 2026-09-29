#!/usr/bin/env node
// identity-db-verify.mjs — the database half of the Block A (identity and age
// safeguards) release gate.
//
// Appendix M Part 2.1 criterion 2 and Part 3 Stage 2 ask for the age and
// identity adversarial checks on every release, holding "through every path";
// Appendix M 1.1 (Unconsented Analytics Event Rate on flagged sessions) and
// 1.3 (Unauthorized Kid-Role Email-Change Attempt Rate, "every release") name
// two of them. For A.6 the path that matters is the database itself: GoTrue is
// reachable directly through Kong, so only the auth.users trigger stops a
// child's address from moving. Before this runner the proofs below were run by
// hand, once per lane, and a migration that weakened guard_kid_email,
// guard_optional_learning_event, enforce_parent_role_provenance or
// guard_parent_verification_age passed database CI and auto-applied. This runs
// every one of them over the WHOLE migration chain and fails on any failure.
//
//   node database/scripts/identity-db-verify.mjs [--only <substring>] [--list]
//
// Run by `npm run identity:db-verify`, by release-readiness, by the
// identity-db-verify job of database-ci.yml (a migration cannot auto-apply past
// a red proof) and by the unfiltered repo gates (a Core-only release still
// re-proves the database safeguards Core relies on). A new Block A verifier
// joins BLOCK_A here; identity-db-verify.test.mjs fails when one is left out.
// Cluster, Python and parallelism: see pg-verify-runner.mjs.

import { main } from './pg-verify-runner.mjs';

/** Every Block A verifier, in a stable order. A missing file fails the gate. */
export const BLOCK_A = [
  // A.2 / A.4 / H.1: the under-13 origin, the age declaration, the protected
  // profile date, the Mentor calibration, the teen analytics choice and the
  // optional-event admission trigger (flagged sessions record no analytics).
  'verify-origin-postgres.py',
  // A.6 / Appendix M 1.3: guard_kid_email on auth.users.
  'verify-kid-email-guard-postgres.py',
  // A.5: parent-role provenance, grant/revoke atomicity, the verification age
  // guard, the minor-record Tutor list and identity_metrics.
  'verify-staff-ops-postgres.py',
  // E.4 / A.4: the staff-reviewed age correction.
  'verify-age-correction-postgres.py',
  // OD-28 (S-04): the declared teen's birth month and the move to adult at 18.
  'verify-age-birth-month-postgres.py',
  // S-06 (OD-28): the verified Tutor's rename of a flagged child handle.
  'verify-kid-username-change-postgres.py',
];

/** Every verifier runs over the whole chain. */
export const GATE = { name: 'identity:db-verify', verifiers: BLOCK_A, env: { LF_PG_FULL_CHAIN: '1' } };

main(import.meta.url, GATE);
