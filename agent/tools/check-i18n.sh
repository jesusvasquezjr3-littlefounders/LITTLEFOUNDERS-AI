#!/usr/bin/env bash
# Verifies i18n key parity across en-US, es-MX, pt-BR (en-US = source of truth).
set -euo pipefail
cd "$(dirname "$0")/../.."

DIR="frontend/src/i18n"
if [ ! -d "$DIR" ]; then
  echo "i18n:check SKIPPED — $DIR does not exist yet"
  exit 0
fi

keys() { # flatten JSON keys to dot paths, sorted
  node -e '
    const o = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
    const walk = (x, p) => Object.entries(x).flatMap(([k, v]) =>
      v && typeof v === "object" ? walk(v, p ? p + "." + k : k) : [p ? p + "." + k : k]);
    console.log(walk(o, "").sort().join("\n"));
  ' "$1"
}

FAIL=0
for loc in es-MX pt-BR; do
  if ! diff <(keys "$DIR/en-US.json") <(keys "$DIR/$loc.json") >/tmp/i18n-diff.$$; then
    echo "i18n:check FAILED — key mismatch between en-US and $loc:" >&2
    cat /tmp/i18n-diff.$$ >&2
    FAIL=1
  fi
  rm -f /tmp/i18n-diff.$$
done

[ "$FAIL" -eq 1 ] && exit 1
echo "i18n:check OK — en-US, es-MX, pt-BR key sets identical"
