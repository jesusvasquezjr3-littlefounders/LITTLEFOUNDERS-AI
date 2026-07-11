#!/usr/bin/env bash
# Runs an npm script (test | type-check | lint | build) in every service that defines it.
set -euo pipefail
cd "$(dirname "$0")/../.."

SCRIPT="${1:?usage: run-all.sh <npm-script>}"
SERVICES=(database backend frontend coursegen audiogen gamegen parent-id-check email-server)

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
