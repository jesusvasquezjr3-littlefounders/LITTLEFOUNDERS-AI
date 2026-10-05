#!/usr/bin/env bash
# Operator tool for the v2 catalog data steps (FORGE-V2-RELEASE.md section 3). Not CI: it needs credentials.
#
#   bash agent/tools/release-v2-catalog.sh                 # rehearsal: offline checks only, writes nothing, needs no credentials
#   bash agent/tools/release-v2-catalog.sh --apply         # the real run: seed KCs, hierarchy seeds, publish, per course
#   bash agent/tools/release-v2-catalog.sh --apply --course investing   # one course (repeatable)
#   bash agent/tools/release-v2-catalog.sh --apply --activate-kcs       # after Financial Education is live
#
# --apply needs SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY for the target Vault (never printed), and LF_SQL_RUNNER:
# a command that reads SQL on stdin and runs it as a database superuser with ON_ERROR_STOP, e.g.
#   LF_SQL_RUNNER='psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q'
# It refuses a localhost target unless LF_ALLOW_LOCAL=1. Every step is idempotent, so a failed run is simply re-run.
# Order (each step needs the one before it): seed:kc -> hierarchy seed -> v2:publish. Nothing it does shows a lesson to a
# learner: lessons land in review and stay invisible until staff run release_lesson. Core must already carry the Horizonte
# types (it does since 2670d911) and migrations 0123-0125 must be applied (checked by seed:kc and the seed's own KC check).
set -euo pipefail
cd "$(dirname "$0")/../.."
ROOT="$PWD"
COURSES=(financial-education entrepreneurship investing first-lemonade-stand)
APPLY=0; ACTIVATE_KCS=0; PICK=()
while [ $# -gt 0 ]; do
  case "$1" in
    --apply) APPLY=1; shift ;;
    --activate-kcs) ACTIVATE_KCS=1; shift ;;
    --course) PICK+=("${2:?--course needs a slug}"); shift 2 ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
done
[ "$ACTIVATE_KCS" -eq 0 ] || [ ${#PICK[@]} -eq 0 ] || { echo "--activate-kcs cannot be combined with --course" >&2; exit 2; }
[ ${#PICK[@]} -gt 0 ] && COURSES=("${PICK[@]}")
for c in "${COURSES[@]}"; do [ -d "coursegen/curriculum-v2/$c" ] || { echo "unknown course: $c" >&2; exit 2; }; done
RUN_ID="v2-catalog-$(date -u +%Y%m%dT%H%M%SZ)"
OUT="$ROOT/coursegen/runs/v2-release/$RUN_ID"
step() { printf '\n== %s\n' "$*"; }

if [ "$ACTIVATE_KCS" -eq 1 ]; then
  [ "$APPLY" -eq 1 ] || { echo "--activate-kcs requires --apply because it changes the KC catalog" >&2; exit 2; }
  : "${SUPABASE_URL:?set SUPABASE_URL}"; : "${SUPABASE_ANON_KEY:?set SUPABASE_ANON_KEY}"
  : "${SUPABASE_SERVICE_ROLE_KEY:?set SUPABASE_SERVICE_ROLE_KEY}"; : "${LF_SQL_RUNNER:?set LF_SQL_RUNNER (SQL on stdin, superuser)}"
  if [[ "$SUPABASE_URL" =~ ^https?://(localhost|127\.0\.0\.1|\[::1\]) ]] && [ "${LF_ALLOW_LOCAL:-0}" != 1 ]; then
    echo "SUPABASE_URL is a local address; set LF_ALLOW_LOCAL=1 to apply to a local stack." >&2; exit 2
  fi
  step "OD-22 post-release activation (atomic; refuses any KC without a live Financial Education bridge)"
  node agent/tools/render-od22-kc-activation.mjs | eval "$LF_SQL_RUNNER"
  (cd backend && npm run --silent audit:content-bridge)
  echo "OD-22 activation complete. Re-running this command is safe."
  exit 0
fi

mkdir -p "$OUT"

step "Rehearsal: coverage, hierarchy drift, publish dry run (no network, no writes)"
(cd coursegen && npm run --silent v2:catalog)
for c in "${COURSES[@]}"; do
  (cd coursegen && npm run --silent v2:hierarchy -- --course "$c" --check)
  (cd coursegen && npm run --silent v2:publish -- --plans "curriculum-v2/$c/plans" --course "$c" --run-id "$RUN_ID-dry" \
    --out "$OUT/dry-$c" --core-has-horizonte --lesson-ids "curriculum-v2/$c/hierarchy/ids.json" --require-lesson-design --dry-run)
done
if [ "$APPLY" -eq 0 ]; then
  echo; echo "Rehearsal clean for: ${COURSES[*]}. Re-run with --apply to write to the Vault named by SUPABASE_URL."; exit 0
fi

: "${SUPABASE_URL:?set SUPABASE_URL}"; : "${SUPABASE_ANON_KEY:?set SUPABASE_ANON_KEY}"
: "${SUPABASE_SERVICE_ROLE_KEY:?set SUPABASE_SERVICE_ROLE_KEY}"; : "${LF_SQL_RUNNER:?set LF_SQL_RUNNER (SQL on stdin, superuser)}"
if [[ "$SUPABASE_URL" =~ ^https?://(localhost|127\.0\.0\.1|\[::1\]) ]] && [ "${LF_ALLOW_LOCAL:-0}" != 1 ]; then
  echo "SUPABASE_URL is a local address; set LF_ALLOW_LOCAL=1 to apply to a local stack." >&2; exit 2
fi
echo; echo "Target Vault: ${SUPABASE_URL%%\?*}  courses: ${COURSES[*]}  run: $RUN_ID"

step "1/3 Knowledge components (approved OD-22 KCs remain operationally draft until post-release activation)"
(cd backend && npm run --silent seed:kc)

step "2/3 Hierarchy seeds (courses, adventures, sagas, topics, lessons in review; ROLLBACK switched to COMMIT)"
for c in "${COURSES[@]}"; do
  f="coursegen/curriculum-v2/$c/hierarchy/hierarchy.seed.sql"
  grep -q '^ROLLBACK;$' "$f" || { echo "$f does not end in ROLLBACK; regenerate it with v2:hierarchy" >&2; exit 3; }
  sed 's/^ROLLBACK;$/COMMIT;/' "$f" | eval "$LF_SQL_RUNNER"
  echo "seeded $c"
done

step "3/3 Publish (one immutable version per lesson and market; verify:course runs inside)"
for c in "${COURSES[@]}"; do
  (cd coursegen && npm run --silent v2:publish -- --plans "curriculum-v2/$c/plans" --course "$c" --run-id "$RUN_ID-$c" \
    --out "$OUT/$c" --core-has-horizonte --lesson-ids "curriculum-v2/$c/hierarchy/ids.json" --require-lesson-design)
done

cat <<EOF

Done: ${COURSES[*]} published as drafts/review. Still to do, by people:
  - staff: release_lesson per lesson (Content page); the entrepreneurship and investing course status flips;
  - operator, only after Financial Education is live: rerun with --apply --activate-kcs;
  - operator: set COURSE_PATHWAY_ENGINE=pathway in the B.6 order (S05-B6-PATHWAY-POLICY.md section 7).
Reports: $OUT
EOF
