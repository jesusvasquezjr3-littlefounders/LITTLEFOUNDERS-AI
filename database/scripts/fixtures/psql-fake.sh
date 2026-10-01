#!/usr/bin/env bash
# Builtin-only counterpart of the Node fake; receives the full decoded SQL pipeline.
set -u
sql=''
IFS= read -r -d '' sql || true
printf '%s\n---\n' "$sql" >> "$RAILWAY_FAKE_CALLS"
mode="${RAILWAY_FAKE_PSQL_MODE:-ok}"
if [[ "$mode" == error ]]; then
  printf 'psql:<stdin>:1: ERROR:  boom\n' >&2
  exit 1
fi
if [[ "$mode" == silent ]]; then exit 0; fi
if [[ "$sql" == *'AS has_ledger'* && "$sql" == *'\if :has_ledger'* ]]; then
  printf '%s\n' "${RAILWAY_FAKE_LEDGER:-absent|-1|present}"
elif [[ "$sql" == *"'baseline-ok'"* ]]; then
  printf '%s\n' "${RAILWAY_FAKE_SIGNATURE:-baseline-ok}"
elif [[ "$sql" == *'SELECT checksum FROM public.schema_migrations'* ]]; then
  pattern="filename = '([^']+)'"
  if [[ "$sql" =~ $pattern ]]; then
    filename="${BASH_REMATCH[1]}"
    while IFS=$'\t' read -r file checksum; do
      if [[ "$file" == "$filename" && -n "$checksum" ]]; then printf '%s\n' "$checksum"; break; fi
    done < "$RAILWAY_FAKE_RECEIPTS_FILE"
  fi
elif [[ "$sql" == *'SELECT count(*) FROM public.schema_migrations;'* ]]; then
  printf '%s\n' "${RAILWAY_FAKE_COUNT:-0}"
fi
printf 'LF_MIGRATION_OK\n'
if [[ "$mode" == notice-after-sentinel ]]; then
  printf 'psql:<stdin>:12: NOTICE:  relation "anon_visitors" already exists, skipping\n' >&2
fi
if [[ "$mode" == error-after-sentinel ]]; then
  printf 'psql:<stdin>:12: ERROR:  deadlock detected\n' >&2
fi
