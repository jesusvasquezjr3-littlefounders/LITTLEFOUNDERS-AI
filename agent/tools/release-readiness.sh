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
npm run i18n:check
npm run deps:check
npm run typecheck:all
npm run lint:all
npm run test:all
bash agent/tools/run-all.sh build

npm --prefix coursegen run catalog:check -- "curriculum/$COURSE"
npm --prefix coursegen run graph:check -- "$COURSE"
npm --prefix coursegen run contract:check
npm --prefix coursegen run generate -- --course "$COURSE" --run-id "$RUN_ID" --require-images --dry-run
npm --prefix coursegen run generate:track -- --course "$COURSE" --track-id "$TRACK_ID" --require-images --dry-run
npm --prefix audiogen run narrate:all -- --course "$COURSE" --dry-run

echo ""
echo "release-readiness OK — no deployment, migration, publication, or paid API call was performed"
echo "dry-run evidence: coursegen/runs/$RUN_ID and coursegen/runs/$TRACK_ID"
