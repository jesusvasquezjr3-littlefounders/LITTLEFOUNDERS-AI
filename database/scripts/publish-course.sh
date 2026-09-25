#!/usr/bin/env bash
# publish-course.sh <course-slug> — LOCAL DEV ONLY. Never run against production.
#
# Forge writes draft/review content. This local operator shortcut must use the
# same release_course preflight as Core: complete locales, reviewable lessons,
# and a fresh Forge verification after the last document change that attests
# every Forge release gate in public.forge_release_gates (S05.4c). It cannot
# turn an unchecked hierarchy into child-visible content.
#
# This remains local-dev only. Production publishing goes through the
# authenticated Core staff route, which also records the actor and audit log.
#
# Usage: bash scripts/publish-course.sh first-lemonade-stand

set -euo pipefail

DB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SLUG="${1:-}"

if [[ -z "$SLUG" ]]; then
  echo "Usage: $0 <course-slug>" >&2
  exit 1
fi

RESULT=$(bash "$DB_DIR/scripts/local-stack.sh" psql -q -t -A -F '|' -v slug="$SLUG" <<'SQL'
WITH target AS MATERIALIZED (
  SELECT id FROM public.courses WHERE slug = :'slug'
)
SELECT r.ok, r.code, r.message,
       r.adventures_published, r.sagas_published,
       r.topics_published, r.lessons_published
FROM target CROSS JOIN LATERAL public.release_course(target.id) AS r;
SQL
)

IFS='|' read -r ok code message adventures sagas topics lessons <<< "$RESULT"
if [[ "$ok" != t ]]; then
  echo "FAIL: release refused for '$SLUG' — ${code:-NOT_FOUND}: ${message:-Course does not exist.}" >&2
  exit 1
fi

echo "OK: '$SLUG' released through verified preflight ($adventures adventures, $sagas sagas, $topics topics, $lessons lessons)."
