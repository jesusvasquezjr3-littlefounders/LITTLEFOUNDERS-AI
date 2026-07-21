#!/bin/sh
# Pulse Postgres first-boot provisioning. Runs ONCE against an empty volume
# (docker-entrypoint-initdb.d contract). Creates one role + one database per
# app so Plausible and Umami never share credentials — least privilege inside
# the private network. Passwords come from Railway variables (never tracked).
set -eu

: "${PLAUSIBLE_DB_PASSWORD:?PLAUSIBLE_DB_PASSWORD is required}"
: "${UMAMI_DB_PASSWORD:?UMAMI_DB_PASSWORD is required}"

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" <<-EOSQL
    CREATE ROLE plausible LOGIN PASSWORD '${PLAUSIBLE_DB_PASSWORD}';
    CREATE ROLE umami LOGIN PASSWORD '${UMAMI_DB_PASSWORD}';
    CREATE DATABASE plausible OWNER plausible;
    CREATE DATABASE umami OWNER umami;
EOSQL
