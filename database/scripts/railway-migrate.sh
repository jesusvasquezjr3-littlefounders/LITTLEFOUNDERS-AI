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
                           The runner additionally verifies a read-only
                           signature-object probe for the requested baseline
                           and refuses baselines it has no signature map for.
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
# Auth: a headless run supplies RAILWAY_TOKEN; an interactive operator session
# is equally valid when the CLI already holds a logged-in session. The intent
# of this guard is "Railway auth exists", not "a token specifically".
if [[ -z "${RAILWAY_TOKEN:-}" ]]; then
  railway whoami >/dev/null 2>&1 || fail "RAILWAY_TOKEN is not set and no logged-in Railway CLI session was found"
fi
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

# The Railway CLI transport lies about failure (verified live against CLI
# 5.30.3): `railway ssh --service db -- sh -c "exit 42"` exits 0 locally, and
# the `-- sh -c` word-split shape never even reaches psql. Success is
# therefore judged from psql OUTPUT — every payload must print this sentinel,
# and any 'ERROR:' or missing sentinel is a hard refusal. The judgment is
# ORDER-INDEPENDENT on purpose: psql NOTICEs travel on stderr (unbuffered),
# so across the CLI's forwarded channels a NOTICE can land AFTER the sentinel
# in the 2>&1 merge (0024/0033 DO blocks genuinely NOTICE on the production
# path). With ON_ERROR_STOP=1 and the sentinel as the final statement, the
# sentinel cannot print if any earlier statement failed — so presence anywhere
# plus the absence of an ERROR line is airtight.
SENTINEL="LF_MIGRATION_OK"

remote_sql() {
  local sql="$1" label="${2:-query}" b64 output status attempt
  sql="$sql
\\echo $SENTINEL"
  b64="$(printf '%s' "$sql" | base64 | tr -d '\n')"
  for ((attempt = 1; attempt <= ATTEMPTS; attempt++)); do
    # The remote pipeline must be ONE positional argument (the proven-working
    # shape). psql reads the decoded SQL as a script via `-f -`, so with
    # ON_ERROR_STOP=1 the trailing \echo sentinel only prints if every prior
    # statement succeeded.
    status=0
    output="$(railway ssh --service "$SERVICE" -i "$SSH_KEY" \
      "echo $b64 | base64 -d | psql -U $MIGRATE_ROLE -d postgres -t -A -v ON_ERROR_STOP=1 -f -" 2>&1)" || status=$?
    if ((status != 0)); then
      # A non-zero LOCAL exit is a genuine transport failure (the CLI could
      # not run at all) — the only case that is safe to retry.
      if ((attempt == ATTEMPTS)); then
        echo "$output" >&2
        fail "$label failed after $ATTEMPTS Railway SSH attempts"
      fi
      echo "$label: SSH attempt $attempt failed; retrying in ${RETRY_SECONDS}s" >&2
      sleep "$RETRY_SECONDS"
      continue
    fi
    if printf '%s\n' "$output" | grep -q 'ERROR:'; then
      echo "$output" >&2
      fail "$label: remote psql reported an error"
    fi
    if ! printf '%s\n' "$output" | grep -Fq "$SENTINEL"; then
      # Exit 0 with no sentinel is exactly how a dropped or lying transport
      # presents. Retrying could re-run SQL whose fate is unknown, so refuse.
      # Presence ANYWHERE (not "last line") is deliberate: a psql NOTICE can
      # be forwarded after the sentinel and must not fail a committed run.
      echo "$output" >&2
      fail "$label: success sentinel missing from remote output (transport exit codes are untrustworthy); refusing to continue"
    fi
    # The captured query result is what remains after dropping the sentinel
    # and psql's stderr chatter (NOTICE/WARNING and their attachment lines),
    # which the channel merge can interleave anywhere relative to real rows.
    printf '%s\n' "$output" \
      | grep -Fvx "$SENTINEL" \
      | grep -Ev '^(psql:[^ ]* )?(NOTICE|WARNING|DETAIL|HINT|CONTEXT):' \
      || true
    return 0
  done
}

# Data-driven signature-object map for --baseline sanity. Each verified
# baseline pairs objects its migration set must have created (present) with
# the first objects a later migration would create (absent). Probes are
# read-only and print a single token. Extend only with an independently
# verified probe; DEPLOYMENT.md records the 2026-08-02 evidence for 0022.
baseline_signature_sql() {
  case "$1" in
    0011)
      cat <<'SQL'
SELECT CASE
  WHEN to_regclass('public.courses') IS NULL
    OR to_regclass('public.audit_logs') IS NULL
    THEN 'missing-baseline-objects'
  WHEN to_regclass('public.picture_assets') IS NOT NULL
    OR EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema = 'public' AND table_name = 'learning_stats'
                 AND column_name = 'longest_streak')
    THEN 'found-later-objects'
  ELSE 'baseline-ok'
END;
SQL
      ;;
    0022)
      cat <<'SQL'
SELECT CASE
  WHEN to_regclass('public.picture_assets') IS NULL
    OR to_regclass('public.speech_assets') IS NULL
    OR to_regclass('public.generation_runs') IS NULL
    OR to_regclass('public.generation_runs_live') IS NULL
    OR to_regclass('public.generation_heartbeat_snapshots') IS NULL
    OR to_regclass('public.email_logs') IS NULL
    OR NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'public' AND table_name = 'learning_stats'
                     AND column_name = 'longest_streak')
    OR NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'public' AND table_name = 'topics'
                     AND column_name = 'review_of')
    OR NOT EXISTS (SELECT 1 FROM pg_publication_tables
                   WHERE pubname = 'supabase_realtime')
    THEN 'missing-baseline-objects'
  WHEN to_regclass('public.learning_events') IS NOT NULL
    THEN 'found-later-objects'
  ELSE 'baseline-ok'
END;
SQL
      ;;
    *)
      return 1
      ;;
  esac
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

# The ledger count must not appear as a scalar subquery next to the
# to_regclass() guard: PostgreSQL plans every CASE arm, so the query itself
# ERRORs on a database where public.schema_migrations does not exist — which
# is exactly the pre-baseline production state this preflight must handle.
# psql \gset/\if splits it into two exact phases in one round-trip instead.
remote_state="$(remote_sql "SELECT (to_regclass('public.schema_migrations') IS NOT NULL) AS has_ledger \gset
\if :has_ledger
SELECT 'present|' || count(*)::text || '|' || CASE WHEN to_regclass('public.courses') IS NULL THEN 'absent' ELSE 'present' END FROM public.schema_migrations;
\else
SELECT 'absent|-1|' || CASE WHEN to_regclass('public.courses') IS NULL THEN 'absent' ELSE 'present' END;
\endif" 'preflight')"
IFS='|' read -r ledger_state ledger_count courses_state <<<"$remote_state"
[[ "$ledger_state" == "absent" || "$ledger_state" == "present" ]] || fail "unexpected remote ledger state: $remote_state"
[[ "$courses_state" == "absent" || "$courses_state" == "present" ]] || fail "unexpected remote schema state: $remote_state"

if [[ "$ledger_state" == "absent" ]]; then
  [[ -n "$BASELINE" ]] || fail "remote ledger is absent; provide --baseline NNNN only after independently verifying production's high-water mark"
  [[ "$courses_state" == "present" ]] || fail "--baseline is only valid for an existing application schema"
  [[ "$BASELINE" != "0000" ]] || fail "baseline must identify an applied migration"
  signature_sql="$(baseline_signature_sql "$BASELINE")" \
    || fail "--baseline $BASELINE has no signature-object map; add an independently verified probe to baseline_signature_sql before using it"
  signature_state="$(remote_sql "$signature_sql" "baseline signature $BASELINE" | tr -d '[:space:]')"
  [[ "$signature_state" == "baseline-ok" ]] \
    || fail "baseline $BASELINE signature probe refused: ${signature_state:-no-output} (production does not match the requested high-water mark)"
  echo "Remote ledger is absent; requested baseline: $BASELINE (course schema present, signature probe passed)."
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
