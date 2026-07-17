# Vault (Supabase self-hosted) — Kong API gateway component.
# Wraps the pinned upstream image (database/SUPABASE_VERSION) with the
# declarative config + entrypoint docker-compose.yml mounts locally, since
# Railway's Docker-image services can't bind-mount files from the repo.
# kong-entrypoint.sh source: database/supabase/docker/volumes/api/ (gitignored
# upstream clone) — copied verbatim. kong.yml is OUR adaptation for Railway
# private networking (see the header comment inside kong.yml).
FROM kong/kong:3.9.1

COPY kong.yml /home/kong/temp.yml
COPY kong-entrypoint.sh /home/kong/kong-entrypoint.sh

ENTRYPOINT ["/bin/sh", "/home/kong/kong-entrypoint.sh"]
