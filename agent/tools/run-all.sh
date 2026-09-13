#!/usr/bin/env bash
# Runs an npm script (test | type-check | lint | build) in every service that defines it.
set -euo pipefail
cd "$(dirname "$0")/../.."

SCRIPT="${1:?usage: run-all.sh <npm-script>}"

# Discovered from disk, not listed. Skipping a service that does not define the
# requested script is intended; never visiting it at all is not — omitting
# Prism/Depot/Data Intel once made a green root gate weaker than those services'
# own CI, and a hand-kept list is exactly how that happens again the next time a
# service is added. (The list this replaces was pinned to "AGENTS.md §1.5", a
# section deleted in 77b55596, so it was pinned to nothing.)
SERVICES=()
for dir in */; do
  name="${dir%/}"
  [ "$name" = "node_modules" ] && continue
  [ -f "$name/package.json" ] && SERVICES+=("$name")
done

FAILED=()
for s in "${SERVICES[@]}"; do
  [ -f "$s/package.json" ] || continue
  if ! node -e '
    const p = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
    process.exit(p.scripts && p.scripts[process.argv[2]] ? 0 : 1);
  ' "$s/package.json" "$SCRIPT"; then
    echo "── $s: no '$SCRIPT' script, skipping"
    continue
  fi
  echo "── $s: npm run $SCRIPT"
  if ! (cd "$s" && npm run --silent "$SCRIPT"); then
    FAILED+=("$s")
  fi
done

if [ "${#FAILED[@]}" -gt 0 ]; then
  echo "run-all $SCRIPT FAILED in: ${FAILED[*]}" >&2
  exit 1
fi
echo "run-all $SCRIPT OK across all services"
