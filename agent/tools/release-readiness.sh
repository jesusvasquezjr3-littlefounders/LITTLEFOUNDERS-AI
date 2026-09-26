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
npm run judge-calibration:check
npm run i18n:check
npm run deps:check
npm run typecheck:all
npm run lint:all
npm run test:all
bash agent/tools/run-all.sh build

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
