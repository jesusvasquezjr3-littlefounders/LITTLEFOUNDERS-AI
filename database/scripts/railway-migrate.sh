#!/usr/bin/env bash
# railway-migrate.sh — apply LittleFounders migrations to the production Vault.
#
# This is deliberately operator-only. It never seeds data, never drops objects,
# and refuses to mutate production without --confirm-production. A legacy
# production database may be given an independently verified high-water mark
# with --baseline NNNN; the script records only those receipts, then applies
# later files in filename order with one transaction per migration.

set -euo pipefail

DB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIGRATIONS_DIR="$DB_DIR/migrations"
SERVICE="${RAILWAY_DB_SERVICE:-db}"
MIGRATE_ROLE="${MIGRATE_ROLE:-supabase_admin}"
SSH_KEY="${RAILWAY_SSH_KEY_PATH:-$HOME/.ssh/railway_key}"
ATTEMPTS="${RAILWAY_SSH_ATTEMPTS:-5}"
RETRY_SECONDS="${RAILWAY_SSH_RETRY_SECONDS:-20}"
BASELINE=""
CONFIRM=false
DRY_RUN=false

usage() {
  cat <<'USAGE'
Usage:
  railway-migrate.sh --dry-run [--baseline NNNN]
  railway-migrate.sh --confirm-production [--baseline NNNN]

Options:
  --baseline NNNN          Required only when the remote ledger is absent.
                           The operator must have independently verified that
                           production is exactly at this migration number.
  --confirm-production     Authorize remote schema mutation for this run.
  --dry-run                Inspect the remote ledger and list pending files;
                           never creates a ledger or applies SQL.
  --service NAME           Railway service (default: db).
  --ssh-key PATH           SSH key passed to Railway (default: ~/.ssh/railway_key).
  --help                   Show this help.

Environment:
  RAILWAY_TOKEN            Railway CLI authentication token.
  RAILWAY_DB_SERVICE       Override the database service name.
  RAILWAY_SSH_KEY_PATH     Override the SSH key path.
USAGE
}

fail() {
  echo "FAIL: $*" >&2
  exit 1
}

while (($# > 0)); do
  case "$1" in
    --baseline)
      (($# >= 2)) || fail "--baseline needs a four-digit migration number"
      BASELINE="$2"
      shift 2
      ;;
    --confirm-production)
      CONFIRM=true
      shift
      ;;
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    --service)
      (($# >= 2)) || fail "--service needs a Railway service name"
      SERVICE="$2"
      shift 2
      ;;
    --ssh-key)
      (($# >= 2)) || fail "--ssh-key needs a file path"
      SSH_KEY="$2"
      shift 2
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      fail "unknown option: $1 (use --help)"
      ;;
  esac
done

[[ "$BASELINE" == "" || "$BASELINE" =~ ^[0-9]{4}$ ]] || fail "--baseline must be a four-digit migration number"
[[ "$CONFIRM" == true || "$DRY_RUN" == true ]] || fail "refusing remote mutation without --confirm-production (or use --dry-run)"
command -v railway >/dev/null 2>&1 || fail "Railway CLI is not installed"
[[ -n "${RAILWAY_TOKEN:-}" ]] || fail "RAILWAY_TOKEN is not set"
[[ -f "$SSH_KEY" ]] || fail "SSH key not found: $SSH_KEY"
[[ "$SERVICE" =~ ^[A-Za-z0-9._-]+$ ]] || fail "Railway service name contains unsupported characters"
[[ "$MIGRATE_ROLE" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] || fail "MIGRATE_ROLE contains unsupported characters"
[[ "$ATTEMPTS" =~ ^[1-9][0-9]*$ ]] || fail "RAILWAY_SSH_ATTEMPTS must be a positive integer"
[[ "$RETRY_SECONDS" =~ ^[0-9]+$ ]] || fail "RAILWAY_SSH_RETRY_SECONDS must be a non-negative integer"

MIGRATION_FILES=()
while IFS= read -r migration; do
  MIGRATION_FILES+=("$migration")
done < <(find "$MIGRATIONS_DIR" -maxdepth 1 -type f -name '[0-9][0-9][0-9][0-9]_*.sql' -print | sort)
(( ${#MIGRATION_FILES[@]} > 0 )) || fail "no migration files found in $MIGRATIONS_DIR"

remote_sql() {
  local sql="$1" label="${2:-query}" b64 output attempt
  b64="$(printf '%s' "$sql" | base64 | tr -d '\n')"
  for ((attempt = 1; attempt <= ATTEMPTS; attempt++)); do
    # Pass the remote pipeline as one argument to `sh -c`. Do not wrap the
    # entire command in literal single quotes: Railway forwards those quotes
    # to the remote shell, which would treat the pipeline as a string instead
    # of executing base64/psql.
    if output="$(railway ssh --service "$SERVICE" -i "$SSH_KEY" -- \
      sh -c "printf '%s' '$b64' | base64 -d | psql -U $MIGRATE_ROLE -d postgres -t -A -v ON_ERROR_STOP=1" 2>&1)"; then
      printf '%s' "$output"
      return 0
    fi
    if ((attempt == ATTEMPTS)); then
      echo "$output" >&2
      fail "$label failed after $ATTEMPTS Railway SSH attempts"
    fi
    echo "$label: SSH attempt $attempt failed; retrying in ${RETRY_SECONDS}s" >&2
    sleep "$RETRY_SECONDS"
  done
}

checksum_for() {
  shasum -a 256 "$1" | awk '{print $1}'
}

number_for() {
  basename "$1" | cut -d_ -f1
}

filename_for() {
  basename "$1"
}

if [[ -n "$BASELINE" ]]; then
  latest_number="$(number_for "${MIGRATION_FILES[${#MIGRATION_FILES[@]} - 1]}")"
  ((10#$BASELINE <= 10#$latest_number)) || fail "--baseline $BASELINE is newer than the latest local migration $latest_number"
fi

remote_state="$(remote_sql "SELECT CASE WHEN to_regclass('public.schema_migrations') IS NULL THEN 'absent' ELSE 'present' END || '|' || CASE WHEN to_regclass('public.schema_migrations') IS NULL THEN '-1' ELSE (SELECT count(*)::text FROM public.schema_migrations) END || '|' || CASE WHEN to_regclass('public.courses') IS NULL THEN 'absent' ELSE 'present' END;" 'preflight')"
IFS='|' read -r ledger_state ledger_count courses_state <<<"$remote_state"
[[ "$ledger_state" == "absent" || "$ledger_state" == "present" ]] || fail "unexpected remote ledger state: $remote_state"
[[ "$courses_state" == "absent" || "$courses_state" == "present" ]] || fail "unexpected remote schema state: $remote_state"

if [[ "$ledger_state" == "absent" ]]; then
  [[ -n "$BASELINE" ]] || fail "remote ledger is absent; provide --baseline NNNN only after independently verifying production's high-water mark"
  [[ "$courses_state" == "present" ]] || fail "--baseline is only valid for an existing application schema"
  [[ "$BASELINE" != "0000" ]] || fail "baseline must identify an applied migration"
  echo "Remote ledger is absent; requested baseline: $BASELINE (course schema present)."
else
  [[ -z "$BASELINE" ]] || fail "remote ledger already exists; do not baseline a non-empty ledger"
  echo "Remote migration ledger has $ledger_count receipt(s)."
fi

if [[ "$DRY_RUN" == true ]]; then
  echo "DRY RUN — no ledger or migration SQL will be written."
else
  if [[ "$ledger_state" == "absent" ]]; then
    baseline_sql="BEGIN;
CREATE TABLE IF NOT EXISTS public.schema_migrations (
  filename text PRIMARY KEY,
  checksum text NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.schema_migrations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.schema_migrations FROM anon, authenticated, service_role;
DO \$\$ BEGIN
  IF EXISTS (SELECT 1 FROM public.schema_migrations) THEN
    RAISE EXCEPTION 'refusing baseline: schema_migrations is not empty';
  END IF;
END \$\$;"
    for migration in "${MIGRATION_FILES[@]}"; do
      number="$(number_for "$migration")"
      if ((10#$number <= 10#$BASELINE)); then
        filename="$(filename_for "$migration")"
        checksum="$(checksum_for "$migration")"
        baseline_sql+="
INSERT INTO public.schema_migrations (filename, checksum) VALUES ('$filename', '$checksum');"
      fi
    done
    baseline_sql+="
COMMIT;"
    remote_sql "$baseline_sql" "baseline $BASELINE" >/dev/null
    ledger_state="present"
    echo "Recorded immutable baseline through $BASELINE."
  fi
fi

for migration in "${MIGRATION_FILES[@]}"; do
  filename="$(filename_for "$migration")"
  number="$(number_for "$migration")"
  if [[ -n "$BASELINE" ]] && ((10#$number <= 10#$BASELINE)); then
    continue
  fi

  checksum="$(checksum_for "$migration")"
  # A dry-run against a legacy database must not query a ledger that does not
  # exist. The explicit baseline is the only source of truth until a real run
  # records it.
  if [[ "$ledger_state" == "absent" ]]; then
    echo "pending $filename"
    continue
  fi
  recorded="$(remote_sql "SELECT checksum FROM public.schema_migrations WHERE filename = '$filename';" "receipt $filename" | tr -d '[:space:]')"
  if [[ -n "$recorded" ]]; then
    [[ "$recorded" == "$checksum" ]] || fail "migration drift detected for $filename"
    echo "skip $filename (recorded)"
    continue
  fi

  echo "pending $filename"
  if [[ "$DRY_RUN" == true ]]; then
    continue
  fi

  sql="BEGIN;
$(sed -n '1,$p' "$migration")
INSERT INTO public.schema_migrations (filename, checksum) VALUES ('$filename', '$checksum');
COMMIT;"
  remote_sql "$sql" "apply $filename" >/dev/null
  echo "applied $filename"
done

if [[ "$DRY_RUN" == true ]]; then
  echo "OK: dry-run complete"
else
  final_count="$(remote_sql "SELECT count(*) FROM public.schema_migrations;" 'postflight' | tr -d '[:space:]')"
  echo "OK: production migration ledger is current ($final_count receipt(s))"
fi
