#!/usr/bin/env bash
# Retain the original Unix filters as an oracle for the optimized builtins.
set -euo pipefail
runner="$1"
workspace="$2"
SENTINEL='LF_MIGRATION_OK'
for name in filter_remote_output strip_remote_whitespace number_for filename_for; do
  source <(sed -n "/^$name()/,/^}/p" "$runner")
done
reference_filter() {
  printf '%s\n' "$1" | grep -Fvx "$SENTINEL" \
    | grep -Ev '^(psql:[^ ]* )?(NOTICE|WARNING|DETAIL|HINT|CONTEXT):' \
    | grep -Ev '^Warning: Permanently added .* to the list of known hosts\.$' || true
}
values=(
  '' 'truncated output' 'LF_MIGRATION_O' 'LF_MIGRATION_OK'
  $'baseline-ok\nLF_MIGRATION_OK'
  $'baseline-ok\r\nLF_MIGRATION_OK\r\n'
  $'LF_MIGRATION_OK\npsql:<stdin>:12: NOTICE: relation exists'
  $'NOTICE: first\nLF_MIGRATION_OK\nWARNING: last'
  $'DETAIL: more\nHINT: tip\nCONTEXT: block\n42\nLF_MIGRATION_OK'
  $'psql:<stdin>:12: ERROR: deadlock\nLF_MIGRATION_OK'
  $'LF_MIGRATION_OK\nERROR: failed'
  $'Warning: Permanently added host (ED25519) to the list of known hosts.\n42\nLF_MIGRATION_OK'
  $'Warning: Permanently added host to the list of known hosts.\r\n42\nLF_MIGRATION_OK'
  $'prefixLF_MIGRATION_OKsuffix\n NOTICE: real row\npsql:file name: NOTICE: real row'
  $'\t baseline-ok \r\n\v\fLF_MIGRATION_OK\n\n'
)
index=0
for value in "${values[@]}"; do
  reference_filter "$value" > "$workspace/filter-reference-$index"
  filter_remote_output "$value" > "$workspace/filter-current-$index"
  cmp "$workspace/filter-reference-$index" "$workspace/filter-current-$index"
  original_error=false; original_sentinel=false
  if printf '%s\n' "$value" | grep -q 'ERROR:'; then original_error=true; fi
  if printf '%s\n' "$value" | grep -Fq "$SENTINEL"; then original_sentinel=true; fi
  current_error=false; current_sentinel=false
  [[ "$value" == *'ERROR:'* ]] && current_error=true
  [[ "$value" == *"$SENTINEL"* ]] && current_sentinel=true
  [[ "$original_error" == "$current_error" && "$original_sentinel" == "$current_sentinel" ]]
  original_space="$(printf '%s' "$value" | tr -d '[:space:]')"
  current_space="$(strip_remote_whitespace "$value")"
  [[ "$original_space" == "$current_space" ]]
  index=$((index+1))
done
for name in '/tmp/a path/0025_insights_scale.sql' './0001_identity.sql' '/a/b/0256_last.sql'; do
  [[ "$(basename "$name")" == "$(filename_for "$name")" ]]
  [[ "$(basename "$name" | cut -d_ -f1)" == "$(number_for "$name")" ]]
done
printf 'runner builtin differential parity OK — %s outputs, exact bytes/classification/whitespace and filename/number extraction\n' "$index"
