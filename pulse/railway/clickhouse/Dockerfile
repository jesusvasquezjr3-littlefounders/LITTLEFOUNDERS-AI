# Pulse (observability) — ClickHouse, Plausible's analytics event store.
# Pinned to the exact tag Plausible CE v3.2.1's own compose.yml ships
# (clickhouse/clickhouse-server:24.12-alpine) — upgrade it together with the
# Plausible pin, never independently, so we stay on the combination upstream
# actually tests. The stock image is NOT Railway-ready: private networking is
# IPv6 (must bind ::) and the default config assumes multi-GB hosts, so we
# overlay our own config.d/users.d tuning (same approach as the official
# railwayapp-templates/plausible ClickHouse package).
FROM clickhouse/clickhouse-server:26.6-alpine

# Same as CE's compose: skip the entrypoint's default-user password setup —
# access is private-network-only and Plausible connects as `default`.
ENV CLICKHOUSE_SKIP_USER_SETUP=1

COPY config.d/ /etc/clickhouse-server/config.d/
COPY users.d/ /etc/clickhouse-server/users.d/
