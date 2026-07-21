# Pulse (observability) — PostgreSQL, shared relational store for the stack.
# One instance, two logical databases: `plausible` (app/config data — events
# live in ClickHouse, not here) and `umami` (all Umami data). CE's compose
# ships the patch-floating `postgres:16-alpine`; our no-floating-tags gate
# (pulse-ci) demands an exact pin, so we pin the concrete patch inside the
# same major.minor. Umami requires >=12.14, so 16 satisfies both. Dependabot
# bumps patches; majors move only alongside the Plausible pin.
FROM postgres:16.14-alpine

# First-boot provisioning only (docker-entrypoint-initdb.d runs on an empty
# volume): creates the second database + per-app roles from Railway variables.
COPY init-scripts/ /docker-entrypoint-initdb.d/
