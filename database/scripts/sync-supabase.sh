#!/usr/bin/env bash
# sync-supabase.sh — materialize the supabase/supabase clone at the PINNED release.
#
# The pin lives in database/SUPABASE_VERSION (a supabase/supabase release tag,
# e.g. v1.26.07). Local dev AND production deploys both run the docker stack
# from this clone, so everything is reproducible from one version string.
#
# Upgrade procedure (also in database/AGENTS.md):
#   1. Check the release is functional/approved: https://github.com/supabase/supabase/releases
#   2. Edit database/SUPABASE_VERSION to the new tag.
#   3. Re-run this script, then `npm run db:reset` twice + `npm test`.
#   4. Update the pin table in database/DEPLOYMENT.md and commit.
#
# By default this is a blobless sparse clone of docker/ only (the self-hosting
# stack — everything else in the monorepo ships as prebuilt Docker images).
# Pass --full to materialize the whole working tree.

set -euo pipefail

DB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CLONE_DIR="$DB_DIR/supabase"
REPO_URL="https://github.com/supabase/supabase.git"
PIN="$(tr -d '[:space:]' < "$DB_DIR/SUPABASE_VERSION")"

if [[ -z "$PIN" ]]; then
  echo "FAIL: database/SUPABASE_VERSION is empty" >&2
  exit 1
fi

SPARSE=1
[[ "${1:-}" == "--full" ]] && SPARSE=0

if [[ ! -d "$CLONE_DIR/.git" ]]; then
  echo "Cloning supabase/supabase (blobless) into database/supabase/ ..."
  git clone --filter=blob:none --no-checkout "$REPO_URL" "$CLONE_DIR"
  if [[ "$SPARSE" == 1 ]]; then
    git -C "$CLONE_DIR" sparse-checkout set docker
  fi
else
  echo "Existing clone found — fetching tags ..."
  git -C "$CLONE_DIR" fetch --tags --force origin
fi

if ! git -C "$CLONE_DIR" rev-parse -q --verify "refs/tags/$PIN" >/dev/null; then
  echo "FAIL: tag '$PIN' does not exist in supabase/supabase" >&2
  exit 1
fi

git -C "$CLONE_DIR" -c advice.detachedHead=false checkout --force "$PIN"

echo "OK: database/supabase/ is at supabase/supabase@$PIN"
git -C "$CLONE_DIR" log -1 --format='   commit %h — %s (%ci)'
