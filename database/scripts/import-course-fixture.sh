#!/usr/bin/env bash
# import-course-fixture.sh <fixture-file> — LOCAL DEV ONLY.
#
# Counterpart to export-course-fixture.sh: loads a previously-exported
# course snapshot into the local Vault. Idempotent (ON CONFLICT DO NOTHING
# on every insert) — safe to run after a fresh `db:reset`. The imported
# course lands with whatever `status` it had at export time (Forge's
# default: courses/adventures/sagas/topics at 'draft', lessons at 'review')
# — run Forge `verify:course` and then `db:publish-course -- <slug>` to make
# verified content visible in the local app. The publish command no longer
# bypasses the release check.
#
# Usage: bash scripts/import-course-fixture.sh seeds/qa-course-fixture.sql

set -euo pipefail

DB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FILE="${1:-}"

if [[ -z "$FILE" || ! -f "$FILE" ]]; then
  echo "Usage: $0 <fixture-file>" >&2
  exit 1
fi

echo "==> importing $FILE"
bash "$DB_DIR/scripts/local-stack.sh" psql -q < "$FILE"
echo "OK: fixture imported. Run Forge verify:course, then npm run db:publish-course -- <slug> to release verified content locally."
