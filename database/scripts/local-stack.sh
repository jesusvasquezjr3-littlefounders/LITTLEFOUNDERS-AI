#!/usr/bin/env bash
# local-stack.sh — drive the pinned self-hosted Supabase stack for local dev.
#
# The stack itself lives in database/supabase/docker (the supabase/supabase
# clone pinned by SUPABASE_VERSION — see sync-supabase.sh). This wrapper
# delegates to the upstream tooling (run.sh / reset.sh / utils/generate-keys.sh)
# and adds the LittleFounders pieces: our migrations, seeds, and psql access.
#
# Usage:
#   local-stack.sh up        # ensure .env (secrets generated on first run) + start
#   local-stack.sh down      # stop containers (data kept)
#   local-stack.sh nuke      # stop + delete ALL volumes (data gone; .env kept)
#   local-stack.sh reset     # nuke → up → migrate  (the from-zero gate)
#   local-stack.sh migrate   # apply only migrations not recorded in the ledger
#   local-stack.sh migrate --baseline NNNN # record an independently verified legacy baseline
#   local-stack.sh seed      # apply database/seeds/dev_seed.sql (DEV ONLY)
#   local-stack.sh psql ...  # psql inside the db container (extra args pass through)
#   local-stack.sh status    # docker compose ps
#   local-stack.sh db-url    # print the pooler connection string (for gen types etc.)

set -euo pipefail

DB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DOCKER_DIR="$DB_DIR/supabase/docker"
MIGRATE_ROLE="${MIGRATE_ROLE:-supabase_admin}"

require_clone() {
  if [[ ! -f "$DOCKER_DIR/docker-compose.yml" ]]; then
    echo "FAIL: database/supabase/docker not found — run 'npm run db:sync' first" >&2
    exit 1
  fi
}

# Host port for the Supavisor SESSION pooler (psql/gen-types entrypoint).
# Not 5432: this machine already has a Postgres bound there.
SESSION_PORT="${SESSION_PORT:-54322}"

# First run: create .env from the upstream example, generate real secrets
# (never committed — database/supabase/ is gitignored), and apply local-dev
# overrides (email autoconfirm on: no SMTP locally; named tenant/org).
ensure_env() {
  require_clone
  # Missing OR still carrying upstream placeholder secrets (reset.sh recreates
  # .env from .env.example when it's absent) → (re)generate real secrets.
  if [[ ! -f "$DOCKER_DIR/.env" ]] || grep -q "your-super-secret" "$DOCKER_DIR/.env"; then
    echo "Creating docker/.env with generated secrets ..."
    cp "$DOCKER_DIR/.env.example" "$DOCKER_DIR/.env"
    (cd "$DOCKER_DIR" && sh utils/generate-keys.sh --update-env)
    sed -i.old \
      -e 's|^POOLER_TENANT_ID=.*$|POOLER_TENANT_ID=littlefounders-local|' \
      -e 's|^ENABLE_EMAIL_AUTOCONFIRM=.*$|ENABLE_EMAIL_AUTOCONFIRM=true|' \
      -e 's|^STUDIO_DEFAULT_ORGANIZATION=.*$|STUDIO_DEFAULT_ORGANIZATION=LittleFounders|' \
      -e 's|^STUDIO_DEFAULT_PROJECT=.*$|STUDIO_DEFAULT_PROJECT=Vault Local|' \
      "$DOCKER_DIR/.env"
    rm -f "$DOCKER_DIR/.env.old"
  fi
  ensure_port_override
}

# Local-only compose overlay: remap the pooler's session port on the host
# (POSTGRES_PORT must stay 5432 — internal service URLs are built from it).
# Registered via the upstream COMPOSE_FILE layering (run.sh config add).
ensure_port_override() {
  cat > "$DOCKER_DIR/docker-compose.local-ports.yml" <<EOF
services:
  supavisor:
    ports: !override
      - ${SESSION_PORT}:5432
      - \${POOLER_PROXY_PORT_TRANSACTION}:6543
EOF
  (cd "$DOCKER_DIR" && sh run.sh config add local-ports >/dev/null)
}

env_var() {
  grep "^$1=" "$DOCKER_DIR/.env" | head -n1 | cut -d= -f2- | tr -d "\r\"'"
}

compose() { (cd "$DOCKER_DIR" && docker compose "$@"); }

psql_in_db() {
  compose exec -T db psql -U "$MIGRATE_ROLE" -d postgres -v ON_ERROR_STOP=1 "$@"
}

cmd_up() {
  ensure_env
  # `run.sh start` = `docker compose up -d --wait`, which aborts the moment
  # any container reports unhealthy. On a from-zero boot (post-nuke) the
  # storage service must run its own internal migrations against the fresh
  # Postgres, which can exceed its 25s healthcheck window (upstream compose
  # file — not ours to edit) before flipping healthy seconds later. The
  # containers are already up at that point, so retrying the same idempotent
  # `up -d --wait` simply re-checks health; give it up to 3 attempts.
  local attempt
  for attempt in 1 2 3; do
    if (cd "$DOCKER_DIR" && sh run.sh start); then
      return 0
    fi
    echo "start attempt ${attempt} reported unhealthy container(s); retrying after settle ..."
    sleep 20
  done
  echo "FAIL: stack did not become healthy after 3 start attempts" >&2
  return 1
}

cmd_down() { require_clone; (cd "$DOCKER_DIR" && sh run.sh stop); }

# Upstream reset.sh wipes volumes AND resets .env to .env.example — we want
# the wipe but must keep our generated secrets, so save/restore .env around it.
cmd_nuke() {
  require_clone
  local keep=""
  if [[ -f "$DOCKER_DIR/.env" ]]; then
    keep="$(mktemp)"
    cp "$DOCKER_DIR/.env" "$keep"
  fi
  (cd "$DOCKER_DIR" && sh reset.sh -y)
  if [[ -n "$keep" ]]; then
    mv "$keep" "$DOCKER_DIR/.env"
    rm -f "$DOCKER_DIR/.env.old"
  fi
}

ledger_exists() {
  psql_in_db -tA -c "select to_regclass('public.schema_migrations') is not null;" | tr -d '[:space:]'
}

application_schema_exists() {
  psql_in_db -tA -c "select to_regclass('public.courses') is not null;" | tr -d '[:space:]'
}

ensure_migration_ledger() {
  # This is operational metadata, not application content. It is deliberately
  # RLS-with-zero-policies and inaccessible to every API role; only the local
  # migration operator may read/write it through the database owner.
  psql_in_db -q <<'SQL'
CREATE TABLE IF NOT EXISTS public.schema_migrations (
  filename text PRIMARY KEY,
  checksum text NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.schema_migrations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.schema_migrations FROM anon, authenticated, service_role;
SQL
}

migration_checksum() {
  shasum -a 256 "$1" | awk '{print $1}'
}

baseline_migrations() {
  local through="$1"
  local f filename number checksum

  if ! [[ "$through" =~ ^[0-9]{4}$ ]]; then
    echo "FAIL: --baseline needs a four-digit verified migration number (for example, 0030)" >&2
    exit 1
  fi
  if [[ "$(application_schema_exists)" != "t" ]]; then
    echo "FAIL: --baseline is only for a legacy database that already has the application schema" >&2
    exit 1
  fi

  ensure_migration_ledger
  if [[ "$(psql_in_db -tA -c 'select count(*) from public.schema_migrations;' | tr -d '[:space:]')" != "0" ]]; then
    echo "FAIL: --baseline refuses a non-empty migration ledger" >&2
    exit 1
  fi

  for f in "$DB_DIR"/migrations/*.sql; do
    filename="$(basename "$f")"
    number="${filename%%_*}"
    if (( 10#$number > 10#$through )); then
      continue
    fi
    checksum="$(migration_checksum "$f")"
    psql_in_db -q -c "insert into public.schema_migrations (filename, checksum) values ('$filename', '$checksum');"
  done
  echo "OK: legacy database baseline recorded through $through. Run 'npm run db:migrate' to apply later migrations."
}

cmd_migrate() {
  if [[ "${1:-}" == "--baseline" ]]; then
    if [[ $# -ne 2 ]]; then
      echo "Usage: npm run db:migrate -- --baseline NNNN" >&2
      exit 1
    fi
    baseline_migrations "$2"
    return
  fi
  if [[ $# -ne 0 ]]; then
    echo "Usage: npm run db:migrate [-- --baseline NNNN]" >&2
    exit 1
  fi

  # Replaying the historical 0002 provisional schema after 0007 has replaced
  # `lessons.course_id` drops the live RLS policy and then errors. Refuse to
  # touch any legacy database until an operator records the independently
  # verified high-water mark with --baseline.
  if [[ "$(ledger_exists)" != "t" && "$(application_schema_exists)" == "t" ]]; then
    echo "FAIL: legacy database has no migration ledger; refusing unsafe replay. Verify its high-water mark, then run 'npm run db:migrate -- --baseline NNNN'." >&2
    exit 1
  fi

  ensure_migration_ledger

  local f filename checksum recorded
  for f in "$DB_DIR"/migrations/*.sql; do
    filename="$(basename "$f")"
    checksum="$(migration_checksum "$f")"
    recorded="$(psql_in_db -tA -c "select checksum from public.schema_migrations where filename = '$filename';" | tr -d '[:space:]')"

    if [[ -n "$recorded" ]]; then
      if [[ "$recorded" != "$checksum" ]]; then
        echo "FAIL: migration drift detected for $filename — applied migrations must never be edited" >&2
        exit 1
      fi
      continue
    fi

    echo "==> $filename"
    # One transaction covers the migration and its receipt. A failed file has
    # no receipt and rolls back, so the next run is safe to retry.
    {
      printf 'BEGIN;\n'
      sed -n '1,$p' "$f"
      printf "\nINSERT INTO public.schema_migrations (filename, checksum) VALUES ('%s', '%s');\nCOMMIT;\n" "$filename" "$checksum"
    } | psql_in_db -q
  done
  echo "OK: every migration is recorded and current"
}

cmd_seed() {
  echo "==> seeds/dev_seed.sql (DEV ONLY)"
  psql_in_db -q < "$DB_DIR/seeds/dev_seed.sql"
  echo "OK: dev seed applied"
}

cmd_reset() {
  cmd_nuke
  cmd_up
  cmd_migrate
}

cmd_db_url() {
  ensure_env
  local pass tenant
  pass="$(env_var POSTGRES_PASSWORD)"
  tenant="$(env_var POOLER_TENANT_ID)"
  # Host is 0.0.0.0 (= loopback for clients) on purpose: the supabase CLI
  # special-cases 127.0.0.1/localhost URLs and demands its own `supabase start`
  # stack; 0.0.0.0 bypasses that and connects to our pooler.
  echo "postgresql://postgres.${tenant}:${pass}@0.0.0.0:${SESSION_PORT}/postgres"
}

CMD="${1:-help}"
[[ $# -gt 0 ]] && shift

case "$CMD" in
  up)      cmd_up ;;
  down)    cmd_down ;;
  nuke)    cmd_nuke ;;
  reset)   cmd_reset ;;
  migrate) cmd_migrate "$@" ;;
  seed)    cmd_seed ;;
  psql)    compose exec -T db psql -U "$MIGRATE_ROLE" -d postgres "$@" ;;
  status)  compose ps ;;
  db-url)  cmd_db_url ;;
  *)
    grep '^#   local-stack.sh' "${BASH_SOURCE[0]}" | sed 's/^#   //'
    exit 1
    ;;
esac
