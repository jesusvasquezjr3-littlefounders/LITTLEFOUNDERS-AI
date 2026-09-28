#!/usr/bin/env bash
# disposable-stack.sh — run the destructive from-zero Supabase gate against an
# ISOLATED stack. The development stack and its data are never touched.
#
# Isolation comes from three layers, each of which this script refuses to
# skip:
#   1. a distinct docker compose project name (distinct containers + volumes),
#   2. remapped host ports (the dev stack's 8000/8443/54322/6543/2500 stay),
#   3. a copied docker directory, so .env writes never reach the dev stack.
#
# Usage:
#   disposable-stack.sh provision   # copy docker dir + write isolated .env
#   disposable-stack.sh up          # start the isolated stack (health-wait)
#   disposable-stack.sh migrate     # apply every migration + the ledger
#   disposable-stack.sh reset       # nuke -> up -> migrate (the from-zero gate)
#   disposable-stack.sh nuke        # down -v (isolated volumes only)
#   disposable-stack.sh teardown    # nuke + remove the copied directory
#   disposable-stack.sh db-url      # pooler URL for supabase gen types
#   disposable-stack.sh status      # docker compose ps
#
# Overridable: DISPOSABLE_ROOT (default: fresh temp dir), DISPOSABLE_PROJECT
# (default lf-reset), DISPOSABLE_SESSION_PORT (55432), DISPOSABLE_TXN_PORT
# (56543), DISPOSABLE_KONG_HTTP (18000), DISPOSABLE_KONG_HTTPS (18443),
# DISPOSABLE_SMTP_PORT (12500).

set -euo pipefail

export COMPOSE_PATH_SEPARATOR=:

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DB_DIR="$REPO_ROOT/database"
BASE_DOCKER_DIR="$DB_DIR/supabase/docker"
MIGRATE_ROLE="${MIGRATE_ROLE:-supabase_admin}"

PROJECT="${DISPOSABLE_PROJECT:-lf-reset}"
SESSION_PORT="${DISPOSABLE_SESSION_PORT:-55432}"
TXN_PORT="${DISPOSABLE_TXN_PORT:-56543}"
KONG_HTTP="${DISPOSABLE_KONG_HTTP:-18000}"
KONG_HTTPS="${DISPOSABLE_KONG_HTTPS:-18443}"
SMTP_PORT="${DISPOSABLE_SMTP_PORT:-12500}"

resolve_root() {
  if [[ -n "${DISPOSABLE_ROOT:-}" ]]; then
    ROOT="$DISPOSABLE_ROOT"
    mkdir -p "$ROOT"
  else
    ROOT="$(mktemp -d "${TMPDIR:-/tmp}/lf-disposable.XXXXXX")"
    echo "DISPOSABLE_ROOT=$ROOT" >&2
  fi
  DOCKER_DIR="$ROOT/docker"
}

require_base_clone() {
  if [[ ! -f "$BASE_DOCKER_DIR/docker-compose.yml" ]]; then
    echo "FAIL: database/supabase/docker not found — run 'npm run db:sync' first" >&2
    exit 1
  fi
}

port_free() {
  local port="$1"
  if command -v netstat >/dev/null 2>&1; then
    if netstat -an | grep -qE "[:.]${port}[[:space:]]+.*LISTEN"; then return 1; fi
  fi
  return 0
}

preflight_ports() {
  local port
  for port in "$SESSION_PORT" "$TXN_PORT" "$KONG_HTTP" "$KONG_HTTPS" "$SMTP_PORT"; do
    if ! port_free "$port"; then
      echo "FAIL: port $port is in use — pick different DISPOSABLE_* ports" >&2
      exit 1
    fi
  done
  if [[ "$PROJECT" == "docker" ]]; then
    echo "FAIL: DISPOSABLE_PROJECT must not be 'docker' (the dev stack's project)" >&2
    exit 1
  fi
}

compose() {
  (cd "$DOCKER_DIR" && docker compose -p "$PROJECT" "$@")
}

psql_in_db() {
  compose exec -T db psql -U "$MIGRATE_ROLE" -d postgres -v ON_ERROR_STOP=1 "$@"
}

cmd_provision() {
  require_base_clone
  resolve_root
  if [[ -f "$DOCKER_DIR/.env" ]]; then
    echo "OK: already provisioned at $DOCKER_DIR"
    return 0
  fi
  preflight_ports
  cp -r "$BASE_DOCKER_DIR" "$DOCKER_DIR"
  # The dev stack's PGDATA lives in volumes/db/data as a bind mount. The
  # disposable stack must never boot from — or write to — a copy of it:
  # replace it with a fresh empty directory.
  rm -rf "$DOCKER_DIR/volumes/db/data"
  mkdir -p "$DOCKER_DIR/volumes/db/data"
  # Upstream compose files pin global `container_name:` values; those are not
  # project-scoped and would collide with the running dev stack. Drop them so
  # compose derives project-scoped names (lf-reset-db-1, …).
  find "$DOCKER_DIR" -maxdepth 1 -name 'docker-compose*.yml' -exec sed -i '/^[[:space:]]*container_name:/d' {} +
  cp "$DOCKER_DIR/.env.example" "$DOCKER_DIR/.env"
  (cd "$DOCKER_DIR" && sh utils/generate-keys.sh --update-env >/dev/null)
  sed -i \
    -e "s|^POOLER_TENANT_ID=.*$|POOLER_TENANT_ID=littlefounders-disposable|" \
    -e "s|^ENABLE_EMAIL_AUTOCONFIRM=.*$|ENABLE_EMAIL_AUTOCONFIRM=true|" \
    -e "s|^ENABLE_ANONYMOUS_USERS=.*$|ENABLE_ANONYMOUS_USERS=true|" \
    -e "s|^STUDIO_DEFAULT_ORGANIZATION=.*$|STUDIO_DEFAULT_ORGANIZATION=LittleFounders|" \
    -e "s|^STUDIO_DEFAULT_PROJECT=.*$|STUDIO_DEFAULT_PROJECT=Disposable Reset|" \
    -e "s|^KONG_HTTP_PORT=.*$|KONG_HTTP_PORT=${KONG_HTTP}|" \
    -e "s|^KONG_HTTPS_PORT=.*$|KONG_HTTPS_PORT=${KONG_HTTPS}|" \
    -e "s|^POOLER_PROXY_PORT_TRANSACTION=.*$|POOLER_PROXY_PORT_TRANSACTION=${TXN_PORT}|" \
    -e "s|^SMTP_PORT=.*$|SMTP_PORT=${SMTP_PORT}|" \
    -e "s|^ADDITIONAL_REDIRECT_URLS=.*$|ADDITIONAL_REDIRECT_URLS=http://localhost:5173/auth/callback|" \
    "$DOCKER_DIR/.env"
  grep -q "^COMPOSE_FILE=" "$DOCKER_DIR/.env" \
    && sed -i "s|^COMPOSE_FILE=.*$|COMPOSE_FILE=docker-compose.yml:docker-compose.local-ports.yml|" "$DOCKER_DIR/.env" \
    || printf '\nCOMPOSE_FILE=docker-compose.yml:docker-compose.local-ports.yml\n' >> "$DOCKER_DIR/.env"
  cat > "$DOCKER_DIR/docker-compose.local-ports.yml" <<EOF
services:
  supavisor:
    ports: !override
      - ${SESSION_PORT}:5432
      - ${TXN_PORT}:6543
EOF
  echo "OK: isolated stack provisioned under $DOCKER_DIR (project $PROJECT)"
}

# The db image's first boot runs its init scripts on a temporary server and
# then restarts PostgreSQL. pg_isready (the healthcheck) can pass against that
# temporary server, and on a loaded Docker Desktop host init outlasts the
# healthcheck's 50s budget, so neither `up --wait` succeeding nor failing
# proves the database is stable. Ready means: init finished (or was skipped on
# an existing PGDATA), the container is healthy, and a real query succeeds.
wait_db_ready() {
  local id status logs i
  for i in $(seq 1 120); do
    id="$(compose ps -q db 2>/dev/null || true)"
    if [[ -n "$id" ]]; then
      status="$(docker inspect -f '{{.State.Health.Status}}' "$id" 2>/dev/null || true)"
      logs="$(docker logs "$id" 2>&1 || true)"
      if [[ "$status" == "healthy" ]]         && grep -qE 'init process complete|Skipping initialization' <<<"$logs"         && psql_in_db -tA -c 'select 1' >/dev/null 2>&1; then
        return 0
      fi
    fi
    sleep 5
  done
  return 1
}

cmd_up() {
  resolve_root
  require_base_clone
  if [[ ! -f "$DOCKER_DIR/.env" ]]; then cmd_provision; fi
  preflight_ports
  local attempt
  for attempt in 1 2 3; do
    # The second `up --wait` re-checks every dependent after the db restart.
    if (cd "$DOCKER_DIR" && docker compose -p "$PROJECT" up -d --wait)       && wait_db_ready       && (cd "$DOCKER_DIR" && docker compose -p "$PROJECT" up -d --wait); then
      echo "OK: isolated stack is healthy"
      return 0
    fi
    echo "start attempt ${attempt} reported unhealthy container(s); waiting for db init to finish, then retrying ..."
    wait_db_ready || true
  done
  echo "FAIL: isolated stack did not become healthy after 3 start attempts" >&2
  return 1
}

cmd_nuke() {
  resolve_root
  (cd "$DOCKER_DIR" && docker compose -p "$PROJECT" down -v 2>/dev/null || true)
  # PGDATA is a bind mount, not a named volume — `down -v` cannot remove it.
  # Wipe it explicitly so the next reset starts from a truly empty database.
  rm -rf "$DOCKER_DIR/volumes/db/data"
  mkdir -p "$DOCKER_DIR/volumes/db/data"
  echo "OK: isolated volumes and bind-mounted PGDATA removed"
}

ledger_exists() {
  psql_in_db -tA -c "select to_regclass('public.schema_migrations') is not null;" | tr -d '[:space:]'
}

ensure_migration_ledger() {
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
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | awk '{print $1}'
  else
    shasum -a 256 "$1" | awk '{print $1}'
  fi
}

cmd_migrate() {
  resolve_root
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
    {
      printf 'BEGIN;\n'
      sed -n '1,$p' "$f"
      printf "\nINSERT INTO public.schema_migrations (filename, checksum) VALUES ('%s', '%s');\nCOMMIT;\n" "$filename" "$checksum"
    } | psql_in_db -q
  done
  echo "OK: every migration is recorded and current ($(psql_in_db -tA -c 'select count(*) from public.schema_migrations;' | tr -d '[:space:]') files)"
}

cmd_reset() {
  cmd_nuke
  cmd_up
  cmd_migrate
}

cmd_db_url() {
  resolve_root
  local pass tenant
  pass="$(grep '^POSTGRES_PASSWORD=' "$DOCKER_DIR/.env" | head -n1 | cut -d= -f2- | tr -d "\r\"'")"
  tenant="$(grep '^POOLER_TENANT_ID=' "$DOCKER_DIR/.env" | head -n1 | cut -d= -f2- | tr -d "\r\"'")"
  echo "postgresql://postgres.${tenant}:${pass}@0.0.0.0:${SESSION_PORT}/postgres"
}

cmd_teardown() {
  resolve_root
  cmd_nuke
  rm -rf "$ROOT"
  echo "OK: isolated stack removed ($ROOT)"
}

CMD="${1:-help}"
[[ $# -gt 0 ]] && shift

case "$CMD" in
  provision) cmd_provision ;;
  up)        cmd_up ;;
  nuke)      cmd_nuke ;;
  reset)     cmd_reset ;;
  migrate)   cmd_migrate ;;
  teardown)  cmd_teardown ;;
  db-url)    cmd_db_url ;;
  status)    resolve_root; compose ps ;;
  *)
    grep '^#   disposable-stack.sh' "${BASH_SOURCE[0]}" | sed 's/^#   //'
    exit 1
    ;;
esac
