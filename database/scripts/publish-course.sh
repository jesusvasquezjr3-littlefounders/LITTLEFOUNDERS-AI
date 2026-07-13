#!/usr/bin/env bash
# publish-course.sh <course-slug> — LOCAL DEV ONLY. Never run against production.
#
# Forge (coursegen) writes the full hierarchy at status='draft' (courses,
# adventures, sagas, topics — the table default) and status='review' for
# lessons specifically (COURSE_ENGINE.md §6: lesson CONTENT always needs a
# human review pass before reaching a kid). The read-side RLS policy
# (database/migrations/0007_course_hierarchy.sql) requires status='published'
# at EVERY level of the chain — course, adventure, saga, topic, AND lesson —
# or the row (and everything under it) is invisible to the app.
#
# This script is that human "flip to published" action, scoped to one course
# by slug, so a freshly-generated course can be reviewed and made visible in
# one deliberate step instead of 5 hand-written cascading UPDATEs. Idempotent.
#
# Usage: bash scripts/publish-course.sh qa-lesson-engine-smoketest

set -euo pipefail

DB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SLUG="${1:-}"

if [[ -z "$SLUG" ]]; then
  echo "Usage: $0 <course-slug>" >&2
  exit 1
fi

bash "$DB_DIR/scripts/local-stack.sh" psql -q -v slug="'$SLUG'" <<'SQL'
WITH c AS (
  UPDATE courses SET status = 'published' WHERE slug = :slug AND status <> 'published' RETURNING id
), a AS (
  UPDATE adventures SET status = 'published' WHERE course_id IN (SELECT id FROM courses WHERE slug = :slug) AND status <> 'published' RETURNING id
), s AS (
  UPDATE sagas SET status = 'published' WHERE adventure_id IN (SELECT id FROM adventures WHERE course_id IN (SELECT id FROM courses WHERE slug = :slug)) AND status <> 'published' RETURNING id
), t AS (
  UPDATE topics SET status = 'published' WHERE saga_id IN (SELECT id FROM sagas WHERE adventure_id IN (SELECT id FROM adventures WHERE course_id IN (SELECT id FROM courses WHERE slug = :slug))) AND status <> 'published' RETURNING id
), l AS (
  UPDATE lessons SET status = 'published' WHERE topic_id IN (SELECT id FROM topics WHERE saga_id IN (SELECT id FROM sagas WHERE adventure_id IN (SELECT id FROM adventures WHERE course_id IN (SELECT id FROM courses WHERE slug = :slug)))) AND status <> 'published' RETURNING id
)
SELECT
  (SELECT count(*) FROM c) AS courses_published,
  (SELECT count(*) FROM a) AS adventures_published,
  (SELECT count(*) FROM s) AS sagas_published,
  (SELECT count(*) FROM t) AS topics_published,
  (SELECT count(*) FROM l) AS lessons_published;
SQL

echo "OK: '$SLUG' published (course -> adventures -> sagas -> topics -> lessons)."
