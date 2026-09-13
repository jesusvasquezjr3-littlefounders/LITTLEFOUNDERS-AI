#!/usr/bin/env bash
# Reports version drift of shared dependencies across the service package.json files.
# Portable to bash 3.2 (macOS): no associative arrays.
set -euo pipefail
cd "$(dirname "$0")/../.."

# Discovered, not listed. The hardcoded list this replaces had fallen three
# services behind — oracle, dataintel and picturegen were never compared, so the
# Tutor runtime could drift its express/zod/vitest versions away from Core and
# this gate would still print OK. A list of services maintained by hand is a
# list that silently stops covering the newest service, which is the one most
# likely to drift.
SERVICES=()
for dir in */; do
  name="${dir%/}"
  [ "$name" = "node_modules" ] && continue
  [ -f "$name/package.json" ] && SERVICES+=("$name")
done

DEPS=(express zod typescript tsx vitest supertest eslint typescript-eslint react react-dom vite tailwindcss)

TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT

for s in "${SERVICES[@]}"; do
  [ -f "$s/package.json" ] || continue
  for dep in "${DEPS[@]}"; do
    v=$(node -e '
      const p = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
      const d = { ...p.dependencies, ...p.devDependencies };
      if (d[process.argv[2]]) console.log(d[process.argv[2]]);
    ' "$s/package.json" "$dep")
    [ -n "$v" ] && echo "$dep $v $s" >> "$TMP"
  done
done

FAIL=0
for dep in "${DEPS[@]}"; do
  VERSIONS=$(awk -v d="$dep" '$1 == d { print $2 }' "$TMP" | sort -u)
  COUNT=$(printf '%s\n' "$VERSIONS" | sed '/^$/d' | wc -l | tr -d ' ')
  if [ "$COUNT" -gt 1 ]; then
    echo "deps:check DRIFT on '$dep':" >&2
    for v in $VERSIONS; do
      SVCS=$(awk -v d="$dep" -v ver="$v" '$1 == d && $2 == ver { printf " %s", $3 }' "$TMP")
      echo "  $v →$SVCS" >&2
    done
    FAIL=1
  fi
done

[ "$FAIL" -eq 1 ] && { echo "deps:check FAILED — align the versions listed above across the services named." >&2; exit 1; }
echo "deps:check OK — no version drift on shared dependencies"
