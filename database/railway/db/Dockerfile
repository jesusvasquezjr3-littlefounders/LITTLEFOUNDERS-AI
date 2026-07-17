# Vault (Supabase self-hosted) — Postgres component.
# Wraps the pinned upstream image (database/SUPABASE_VERSION) with the same
# init scripts docker-compose.yml mounts locally, since Railway's Docker-image
# services can't bind-mount files from the repo the way docker-compose does.
# Source of truth for these files: database/supabase/docker/volumes/db/
# (gitignored upstream clone) — copied here verbatim, never hand-edited.
FROM supabase/postgres:17.6.1.136

COPY migrations/ /docker-entrypoint-initdb.d/migrations/
COPY init-scripts/ /docker-entrypoint-initdb.d/init-scripts/
COPY fix-volume-entrypoint.sh /usr/local/bin/fix-volume-entrypoint.sh
RUN chmod +x /usr/local/bin/fix-volume-entrypoint.sh

ENTRYPOINT ["/usr/local/bin/fix-volume-entrypoint.sh"]
CMD ["postgres", "-c", "config_file=/etc/postgresql/postgresql.conf", "-c", "log_min_messages=fatal"]
