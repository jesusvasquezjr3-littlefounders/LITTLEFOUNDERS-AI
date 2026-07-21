# Pulse (observability) — PostgreSQL, shared relational store for the stack.
# One instance, two logical databases: `plausible` (app/config data — events
# live in ClickHouse, not here) and `umami` (all Umami data). Pinned to the
# exact major.minor Plausible CE v3.2.1's compose.yml ships (postgres:16-alpine);
# Umami requires >=12.14, so 16 satisfies both. Upgrade alongside the app pins.
FROM postgres:16-alpine

# First-boot provisioning only (docker-entrypoint-initdb.d runs on an empty
# volume): creates the second database + per-app roles from Railway variables.
COPY init-scripts/ /docker-entrypoint-initdb.d/
