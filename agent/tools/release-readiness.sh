#!/usr/bin/env bash
# Zero-spend release candidate verification.
# This command never deploys, migrates, publishes, or calls a paid provider.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
COURSE="${1:-financial-education}"

[[ "$COURSE" =~ ^[a-z0-9-]+$ ]] || {
  echo "release-readiness: course slug must contain only lowercase letters, digits, and hyphens" >&2
  exit 1
}

cd "$ROOT_DIR"
RUN_SUFFIX="$(date +%Y%m%d%H%M%S)-$$"
RUN_ID="release-check-${COURSE}-${RUN_SUFFIX}"
TRACK_ID="release-track-${COURSE}-${RUN_SUFFIX}"

echo "== LittleFounders zero-spend release readiness: $COURSE =="
npm run git:diff-check
npm run secrets:check
# B.25 (S05.3f): the automated dark-pattern gate, and a human-signed release
# audit no older than 45 days with nothing failing or open
# (docs/rebuild/DARK-PATTERN-AUDIT.md).
node agent/tools/check-dark-patterns.mjs --release

# C.22 / Appendix F §1.3 Tier-Compliance Audit: every Tier 1 (and live-content)
# component's current version and every governance decision must carry both
# sign-offs (Pedagogical Reviewer, Safety/Trust Lead) before a release.
npm run governance:check -- --release
# C.2 / C.3 / C.4, Appendix F 1.3 Fracture-Closure Verification (GAP-FIX-R3):
# every voice, moderation-mode and memory-review safeguard keys off the minor
# indicator or a guardian link, never the kid role alone. The pass/fail JSON is
# the release evidence behind the dashboard's safety.fracture_closure signal.
mkdir -p coursegen/runs
npm run minor-safeguards:check -- --report="coursegen/runs/fracture-closure-${RUN_SUFFIX}.json"
# C.22 / Appendix F Stage 5: the canary delivery path agrees across every copy.
npm run canary:check
npm run judge-calibration:check
npm run i18n:check
npm run deps:check
npm run typecheck:all
npm run lint:all
npm run test:all
bash agent/tools/run-all.sh build
# S07.7 (D.9): a release cannot ship on an overdue Appendix G recalibration.
node agent/tools/check-block-d-research.mjs --strict
# Appendix H 1.3 / 1.4 (GAP-FIX-R5): nor on an overdue quarterly human review:
# the threshold recalibration, the no-unbacked-guarantee audit and the
# scope-disclosure audit, each due by its own log (block-d-review-cadence.mjs).
node agent/tools/check-block-d-thresholds.mjs --strict
node agent/tools/check-no-unbacked-guarantee.mjs --strict
node agent/tools/check-block-d-scope.mjs --strict
# Appendix M Part 3 Stage 6 (GAP-FIX-R6): nor on an overdue quarterly Block A
# identity recalibration (docs/operations/IDENTITY-RECALIBRATION-LOG.md), and
# the log's thresholds must match the metrics Core reports.
node agent/tools/identity-review-cadence.mjs --strict
# Appendix J 1.3 / DoD 2.1(2): the data-gateway half of the social release
# gate. Every native-PostgreSQL social verifier (and the teen discoverable,
# cooperative goals and account-erasure ones) against the full migration
# chain, on a throwaway cluster; a machine with no PostgreSQL prints SKIP.
npm run social:db-verify
# Appendix H 1.3 / 2.2 D.1(d) (GAP-FIX-R3): the Block D database proofs, the
# Freeze-Enforcement Verification and the Unauthorized State-Transition check
# among them, re-run over the whole migration chain for every release; a
# machine with no PostgreSQL prints SKIP.
npm run family:db-verify
# Appendix M Part 2.1 criterion 2 / Part 3 Stage 2 (GAP-FIX-R4): the age and
# identity adversarial checks hold through every path, every release. The
# Block A database proofs (flagged sessions record no optional analytics, 1.1;
# a child's sign-in address cannot move, 1.3, even straight through GoTrue;
# parent-role provenance and the verification age guard, A.5) re-run over the
# whole migration chain; a machine with no PostgreSQL prints SKIP.
npm run identity:db-verify
# Appendix N 1.1 / 1.2 and Appendix O 1.1 (GAP-FIX-R4): the Block G/H database
# proofs (staff grants and decisions, content release, the Generation read
# path, the kid and teen consent gate) over the whole migration chain; a
# machine with no PostgreSQL prints SKIP.
npm run staff:db-verify
# Appendix C 2.2 B.1 / 2.1 (GAP-FIX-R4): the learning database proofs
# (placement for all four methods, v2 grading, the learning signals, the
# pathway, completion, the course release gate) over the whole migration
# chain; a machine with no PostgreSQL prints SKIP.
npm run learning:db-verify
# Frontend Bible 02 §7 item 10, 03 §5, 05 §8, 06 §7 and 08 §9 (GAP-FIX-R5):
# the text-fit, proportion (with the teaching-board rules and the motion
# budget) and copy-budget audits over every rebuilt state in 3 locales x 2
# modes x 4 widths, then the Mentor-stage verifier, on a local Vite dev server
# with every Core request answered by the synthetic Core (nothing leaves the
# machine). Reports: audit-results/rebuild-audits/ and
# audit-results/mentor-stage/. A machine with no Chrome prints SKIP.
npm run rebuild:audit-gate

npm --prefix coursegen run catalog:check -- "curriculum/$COURSE"
npm --prefix coursegen run graph:check -- "$COURSE"
npm --prefix coursegen run contract:check
# S05.4a Forge content gates (B.18 redundancy, B.14 Law 2 tone, OD-13 Copy Budget):
# catalog + committed course fixture + system/UI copy. Any blocking finding fails the release.
npm run narration:check
npm --prefix coursegen run content:gates -- --course "$COURSE"
# S05.4c: every Forge gate is part of the shared release preflight, and the
# zero-spend v2 emitter's output passes Core's strict v2 contract.
npm run forge:release-gates:check
npm run forge:v2:dry-run
npm --prefix coursegen run generate -- --course "$COURSE" --run-id "$RUN_ID" --require-images --dry-run
npm --prefix coursegen run generate:track -- --course "$COURSE" --track-id "$TRACK_ID" --require-images --dry-run
npm --prefix audiogen run narrate:all -- --course "$COURSE" --dry-run

echo ""
echo "release-readiness OK — no deployment, migration, publication, or paid API call was performed"
echo "dry-run evidence: coursegen/runs/$RUN_ID and coursegen/runs/$TRACK_ID"
echo "fracture-closure audit: coursegen/runs/fracture-closure-${RUN_SUFFIX}.json"
