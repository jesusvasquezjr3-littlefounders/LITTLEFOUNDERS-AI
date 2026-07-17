#!/bin/sh
# Railway volumes mount as a fresh ext4 filesystem root, which the kernel
# pre-populates with a lost+found directory. supabase/postgres's own
# docker-entrypoint.sh treats that as "directory exists but is not empty"
# and refuses to initdb. Clear it, then hand off to the real entrypoint
# unmodified (PGDATA stays at the image default — a custom PGDATA path
# hits a second, unrelated hardcoded-path check deeper in this image).
rm -rf /var/lib/postgresql/data/lost+found

# Defense against a partial/failed init leaving debris behind (e.g. a crash
# mid-initdb from an earlier deploy): a real, successfully initialized data
# directory always contains PG_VERSION. If there's content but no
# PG_VERSION, it's not a real database — clear it so initdb can run clean.
# Never touches a directory that has a valid PG_VERSION marker.
if [ -d /var/lib/postgresql/data ] \
  && [ "$(ls -A /var/lib/postgresql/data 2>/dev/null)" ] \
  && [ ! -f /var/lib/postgresql/data/PG_VERSION ]; then
  echo "fix-volume-entrypoint: data dir has debris but no PG_VERSION marker (partial/failed prior init) -- clearing before initdb"
  find /var/lib/postgresql/data -mindepth 1 -delete
fi

exec docker-entrypoint.sh "$@"
