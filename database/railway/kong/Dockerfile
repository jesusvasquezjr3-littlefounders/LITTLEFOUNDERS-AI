# Vault (Supabase self-hosted) — Kong API gateway component.
# Wraps the pinned upstream image (database/SUPABASE_VERSION) with the
# declarative config + entrypoint docker-compose.yml mounts locally, since
# Railway's Docker-image services can't bind-mount files from the repo.
# kong-entrypoint.sh source: database/supabase/docker/volumes/api/ (gitignored
# upstream clone) — copied verbatim. kong.yml is OUR adaptation for Railway
# private networking (see the header comment inside kong.yml).
FROM kong/kong:3.9.1

# Cost/right-sizing (2026-07-17): Kong (OpenResty) defaults nginx
# worker_processes to `auto` = one worker per HOST cpu core. Railway hosts
# expose ~50 cores, so Kong was spawning ~50 workers, each with its own Lua
# VM + the full declarative config resident — measured at ~5.8 GB RSS, which
# alone was ~63% of the whole project's Railway memory bill. Two workers
# (worker_connections 16384 each = ~32k concurrent connections) is far more
# than this gateway's real load and drops Kong to ~280 MB (~95% less). This
# does NOT cap scalability — bump this value (or set it back to `auto`) via
# this ENV or a Railway variable the moment real traffic warrants it.
ENV KONG_NGINX_WORKER_PROCESSES=2

COPY kong.yml /home/kong/temp.yml
COPY kong-entrypoint.sh /home/kong/kong-entrypoint.sh

ENTRYPOINT ["/bin/sh", "/home/kong/kong-entrypoint.sh"]
