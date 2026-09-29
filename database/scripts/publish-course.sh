#!/usr/bin/env bash
# publish-course.sh <course-slug> — LOCAL DEV ONLY. Never run against production.
#
# Forge writes draft/review content. This local operator shortcut must use the
# same release_course preflight as Core: complete locales, reviewable lessons,
# and a fresh Forge verification after the last document change that attests
# every Forge release gate in public.forge_release_gates (S05.4c). It cannot
# turn an unchecked hierarchy into child-visible content.
#
# G.3 / Appendix N 1.2 (GAP-FIX-R5): a release names a staff actor and writes
# its 'admin.course.release' audit row in the same transaction, from the CLI
# exactly as from the staff console. The actor is LF_RELEASE_ACTOR (a user id
# holding superadmin, or admin with manage_content) or, when it is unset, the
# local superadmin with the oldest grant. With neither, release_course refuses
# (FORBIDDEN) and nothing is published.
#
# This remains local-dev only. Production publishing goes through the
# authenticated Core staff route.
#
# Usage: bash scripts/publish-course.sh first-lemonade-stand
#        LF_RELEASE_ACTOR=<uuid> bash scripts/publish-course.sh first-lemonade-stand

set -euo pipefail

DB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SLUG="${1:-}"
ACTOR="${LF_RELEASE_ACTOR:-}"

if [[ -z "$SLUG" ]]; then
  echo "Usage: $0 <course-slug>" >&2
  exit 1
fi
if [[ -n "$ACTOR" && ! "$ACTOR" =~ ^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$ ]]; then
  echo "LF_RELEASE_ACTOR must be a user id (uuid)" >&2
  exit 1
fi

RESULT=$(bash "$DB_DIR/scripts/local-stack.sh" psql -q -t -A -F '|' -v slug="$SLUG" -v actor="$ACTOR" <<'SQL'
WITH target AS MATERIALIZED (
  SELECT id FROM public.courses WHERE slug = :'slug'
), actor AS MATERIALIZED (
  SELECT COALESCE(
    NULLIF(:'actor', '')::uuid,
    (SELECT r.user_id FROM public.user_roles r WHERE r.role = 'superadmin' ORDER BY r.granted_at, r.user_id LIMIT 1)
  ) AS id
)
SELECT r.ok, r.code, r.message,
       r.adventures_published, r.sagas_published,
       r.topics_published, r.lessons_published
FROM target CROSS JOIN actor CROSS JOIN LATERAL public.release_course(actor.id, target.id) AS r;
SQL
)

IFS='|' read -r ok code message adventures sagas topics lessons <<< "$RESULT"
if [[ "$ok" != t ]]; then
  echo "FAIL: release refused for '$SLUG' — ${code:-NOT_FOUND}: ${message:-Course does not exist.}" >&2
  exit 1
fi

echo "OK: '$SLUG' released through verified preflight ($adventures adventures, $sagas sagas, $topics topics, $lessons lessons)."
