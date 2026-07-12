#!/usr/bin/env bash
# Verifies i18n parity across en-US, es-MX, pt-BR (en-US = source of truth).
# Locales are directories of fragment files (common.json, marketing.json, …):
# every locale must have the same file set AND identical key sets per file.
set -euo pipefail
cd "$(dirname "$0")/../.."

DIR="frontend/src/i18n"
if [ ! -d "$DIR/en-US" ]; then
  echo "i18n:check SKIPPED — $DIR/en-US does not exist yet"
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
  # File-set parity
  if ! diff <(ls "$DIR/en-US") <(ls "$DIR/$loc") >/tmp/i18n-diff.$$ 2>&1; then
    echo "i18n:check FAILED — file set mismatch between en-US and $loc:" >&2
    cat /tmp/i18n-diff.$$ >&2
    FAIL=1
  fi
  rm -f /tmp/i18n-diff.$$
  # Per-file key parity
  for f in "$DIR/en-US"/*.json; do
    base="$(basename "$f")"
    [ -f "$DIR/$loc/$base" ] || continue
    if ! diff <(keys "$f") <(keys "$DIR/$loc/$base") >/tmp/i18n-diff.$$; then
      echo "i18n:check FAILED — key mismatch in $base between en-US and $loc:" >&2
      cat /tmp/i18n-diff.$$ >&2
      FAIL=1
    fi
    rm -f /tmp/i18n-diff.$$
  done
done

[ "$FAIL" -eq 1 ] && exit 1
echo "i18n:check OK — en-US, es-MX, pt-BR file and key sets identical"
