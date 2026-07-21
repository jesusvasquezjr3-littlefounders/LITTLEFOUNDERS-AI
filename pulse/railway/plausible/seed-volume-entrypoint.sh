#!/bin/sh
# Railway volume shim (same class of fix as Vault's fix-volume-entrypoint.sh).
#
# The CE image ships required runtime data inside /var/lib/plausible (e.g.
# tzdata_data/ — the app crash-loops without it). docker-compose named volumes
# copy that image content into the volume on first use; Railway bind-mounts do
# NOT — they shadow it with an empty root-owned dir. This entrypoint restores
# the copy-up semantics: seed anything missing from the /var/lib/plausible.dist
# snapshot (taken at build time), ensure TMPDIR exists, then exec the normal
# boot chain. Runs as root (RAILWAY_RUN_UID=0 on the service) so it can write
# the mount — a documented Railway pattern for non-root images with volumes.
set -eu

DIST=/var/lib/plausible.dist
DATA=/var/lib/plausible

if [ -d "$DIST" ]; then
    for entry in "$DIST"/* "$DIST"/.[!.]*; do
        [ -e "$entry" ] || continue
        base=$(basename "$entry")
        [ -e "$DATA/$base" ] || cp -a "$entry" "$DATA/$base"
    done
fi
mkdir -p "$DATA/tmp"

exec "$@"
