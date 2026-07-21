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

# Everything else (BASE_URL, SECRET_KEY_BASE, TOTP_VAULT_KEY, DATABASE_URL,
# CLICKHOUSE_DATABASE_URL, SMTP_*, GOOGLE_CLIENT_ID/SECRET) is configured as
# Railway variables — see pulse/.env.example for the full contract.
