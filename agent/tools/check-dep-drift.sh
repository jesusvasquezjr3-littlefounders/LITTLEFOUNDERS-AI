#!/usr/bin/env bash
# Reports version drift of shared dependencies across the service package.json files.
set -euo pipefail
cd "$(dirname "$0")/../.."

SERVICES=(backend frontend coursegen audiogen gamegen parent-id-check email-server database)
DEPS=(express zod typescript tsx vitest supertest eslint typescript-eslint react react-dom vite tailwindcss)

FAIL=0
for dep in "${DEPS[@]}"; do
  declare -A seen=()
  for s in "${SERVICES[@]}"; do
    [ -f "$s/package.json" ] || continue
    v=$(node -e '
      const p = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
      const d = { ...p.dependencies, ...p.devDependencies };
      if (d[process.argv[2]]) console.log(d[process.argv[2]]);
    ' "$s/package.json" "$dep")
    [ -n "$v" ] && seen["$v"]+=" $s"
  done
  if [ "${#seen[@]}" -gt 1 ]; then
    echo "deps:check DRIFT on '$dep':" >&2
    for v in "${!seen[@]}"; do echo "  $v →${seen[$v]}" >&2; done
    FAIL=1
  fi
  unset seen
done

[ "$FAIL" -eq 1 ] && { echo "deps:check FAILED — align versions (AGENTS.md §1.2 pinned set)." >&2; exit 1; }
echo "deps:check OK — no version drift on shared dependencies"
