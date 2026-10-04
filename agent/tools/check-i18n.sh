#!/usr/bin/env bash
# i18n:check — three-phase verification:
#   Phase 1: JSON key parity across en-US, es-MX, pt-BR (en-US = source of truth),
#            every file of the folder, the per-lane rebuild-<namespace>.json included;
#            phase 1b then checks those namespaces are registered and disjoint
#   Phase 2: Hardcoded string scan in TSX/TS source (strings not wrapped in t())
#   Phase 3: Every STATICALLY DECIDABLE t() key in source EXISTS in en-US —
#            plain literals, BOTH branches of t(cond ? 'a' : 'b'), and the
#            leading namespace of t(`a.b.${expr}`)
#
# Phase 1 alone is not enough: it only proves the three locales agree with each
# other. A key called by a component but present in NO locale is trivially "in
# parity" and renders on screen as its raw dot-path. Phase 3 closes that hole.
#
# Phase 3 is not limited to plain literals, because "dynamic" is not the same as
# "unknowable": in t(cond ? 'a.b' : 'a.c') both keys are literals, and in
# t(`a.b.${x}`) the namespace 'a.b' is literal even when the leaf is not. Six
# defects that rendered raw dot-paths on screen hid in exactly those two shapes.
# What phase 3 still cannot see is the LEAF under a `${…}` segment — the check
# says so in its own output so a green run is never mistaken for full coverage.
set -euo pipefail
cd "$(dirname "$0")/../.."

FAIL=0

# ── Phase 1: JSON key parity ──────────────────────────────────────────────────
DIR="frontend/src/i18n"
if [ ! -d "$DIR/en-US" ]; then
  echo "i18n:check SKIPPED — $DIR/en-US does not exist yet"
  exit 0
fi

keys() {
  node -e '
    const o = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
    const walk = (x, p) => Object.entries(x).flatMap(([k, v]) =>
      v && typeof v === "object" ? walk(v, p ? p + "." + k : k) : [p ? p + "." + k : k]);
    console.log(walk(o, "").sort().join("\n"));
  ' "$1"
}

for loc in es-MX pt-BR; do
  if ! diff <(ls "$DIR/en-US") <(ls "$DIR/$loc") >/tmp/i18n-diff.$$ 2>&1; then
    echo "i18n:check FAILED — file set mismatch between en-US and $loc:" >&2
    cat /tmp/i18n-diff.$$ >&2
    FAIL=1
  fi
  rm -f /tmp/i18n-diff.$$
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

# ── Phase 1b: rebuilt copy namespaces ─────────────────────────────────────────
# The rebuilt UI's copy is one rebuild-<namespace>.json per wave-2 lane. Phase 1
# proves the locales agree file by file; this proves every such file is a
# registered namespace (frontend/src/i18n/rebuild.ts) and that no top-level key
# is in two namespaces (their merge would silently shadow one lane's string).
if ! node agent/tools/check-rebuild-namespaces.mjs; then
  exit 1
fi

# ── Phase 1c: Horizonte pack copy ─────────────────────────────────────────────
# Each Horizonte pack holds its strings in <pack>/copy.ts (three native locales,
# a Copy Budget role per string); the checker finds the pack modules by scanning.
if ! node agent/tools/check-horizonte-copy.mjs; then
  exit 1
fi

# ── Phase 2: Hardcoded string scan ────────────────────────────────────────────
if ! node agent/tools/check-hardcoded-strings.mjs; then
  FAIL=1
fi

# ── Phase 3: Referenced-key existence ─────────────────────────────────────────
# Reports every missing key (and every missing dynamic namespace, under its own
# label) with the file:line that references it.
if ! node agent/tools/check-t-keys.mjs; then
  FAIL=1
fi

[ "$FAIL" -eq 1 ] && exit 1
echo "i18n:check OK — en-US, es-MX, pt-BR file and key sets identical"
echo "i18n:check OK — no hardcoded user-facing strings in source"
echo "i18n:check OK — every statically decidable t() key referenced in source exists in en-US"
