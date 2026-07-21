# Pulse (observability) — Plausible Analytics CE, the web-analytics engine.
# Wraps the pinned upstream image so the version pin lives in git (Vault
# pattern: database/railway/*/Dockerfile) and Dependabot can auto-bump it.
# v3.2.1 is the security floor — it removes the /storybook RCE endpoint
# (CVE-2026-8467); never pin below it. Registry MUST be ghcr.io: the old
# Docker Hub repo is frozen at v2.1.4 and misses every v3.x security patch.
FROM ghcr.io/plausible/community-edition:v3.2.1

# Railway private networking is IPv6 — the app must bind :: to be reachable
# at pulse-plausible.railway.internal (LISTEN_IP default is 0.0.0.0).
ENV LISTEN_IP="::"
ENV HTTP_PORT=8000

# CE's compose contract: persistent app data + tmp staging (GA4 imports stage
# under TMPDIR) live on the /var/lib/plausible volume (Railway volume mount).
ENV TMPDIR=/var/lib/plausible/tmp

# Everything else (BASE_URL, SECRET_KEY_BASE, TOTP_VAULT_KEY, DATABASE_URL,
# CLICKHOUSE_DATABASE_URL, SMTP_*, GOOGLE_CLIENT_ID/SECRET) is configured as
# Railway variables — see pulse/.env.example for the full contract.

# Railway's empty volume shadows the image's /var/lib/plausible (tzdata_data
# lives there — the app crash-loops without it). Snapshot it at build time and
# seed the volume on boot; requires RAILWAY_RUN_UID=0 on the service (image
# USER is 999, and Railway mounts volumes root-owned — a non-root process
# could neither seed nor write TMPDIR).
COPY seed-volume-entrypoint.sh /usr/local/bin/seed-volume-entrypoint.sh
USER root
RUN cp -a /var/lib/plausible /var/lib/plausible.dist \
    && chmod +x /usr/local/bin/seed-volume-entrypoint.sh
ENTRYPOINT ["/usr/local/bin/seed-volume-entrypoint.sh"]

# Same boot contract as CE's official compose: ensure DBs exist (Postgres AND
# the ClickHouse events DB), run pending migrations, then serve. Idempotent —
# createdb skips existing databases, migrate applies only what's new.
# (/entrypoint.sh is the image's own entrypoint, now invoked explicitly.)
CMD ["sh", "-c", "/entrypoint.sh db createdb && /entrypoint.sh db migrate && /entrypoint.sh run"]
