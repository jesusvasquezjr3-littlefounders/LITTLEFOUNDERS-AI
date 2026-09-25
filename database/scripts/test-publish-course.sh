#!/usr/bin/env bash
# Exercise the local operator command's release boundary without a Docker stack.
set -euo pipefail

DB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

run_case() (
  local receipt="$1" slug="$2"
  bash() {
    if [[ "$1" != */local-stack.sh ]]; then
      command bash "$@"
      return
    fi
    local sql
    sql="$(cat)"
    [[ "$*" == *"-v slug=$slug"* ]] || { echo 'slug was not bound as a psql variable' >&2; return 1; }
    [[ "$sql" == *"WHERE slug = :'slug'"* ]] || { echo 'slug was not SQL-escaped by psql' >&2; return 1; }
    [[ "$sql" == *'public.release_course(target.id)'* ]] || { echo 'release preflight was bypassed' >&2; return 1; }
    [[ ! "${sql,,}" =~ update[[:space:]]+(courses|adventures|sagas|topics|lessons) ]] || {
      echo 'direct status update returned' >&2
      return 1
    }
    printf '%s\n' "$receipt"
  }
  source "$DB_DIR/scripts/publish-course.sh" "$slug"
)

run_case 't|RELEASED|Course hierarchy released.|1|1|1|1' 'safe-course' >/dev/null
if run_case 'f|VERIFICATION_REQUIRED|Run Forge verification.|0|0|0|0' 'safe-course' >/dev/null 2>&1; then
  echo 'an unverified course was reported as released' >&2
  exit 1
fi
# S05.4c: a fresh verification that does not attest every Forge release gate.
if run_case 'f|VERIFICATION_INCOMPLETE|The Forge verification does not attest every required release gate (1 missing, 0 failed).|0|0|0|0' 'safe-course' >/dev/null 2>&1; then
  echo 'a course missing a Forge release gate was reported as released' >&2
  exit 1
fi
if run_case '' 'missing-course' >/dev/null 2>&1; then
  echo 'a missing course was reported as released' >&2
  exit 1
fi
run_case 't|RELEASED|Course hierarchy released.|1|1|1|1' "quoted'course" >/dev/null

echo 'publish-course boundary OK — verified release, unverified and incomplete-gate refusals, missing slug and quoted slug'
