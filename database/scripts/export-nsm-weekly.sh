#!/usr/bin/env bash
# export-nsm-weekly.sh — read-only weekly CSV export of the raw learning_events
# rows the North Star Metric is computed from.
#
# Read-only, by construction: the only statement run is `\copy (SELECT ...)
# TO STDOUT`, over the SAME `railway ssh` + base64-piped-psql mechanism
# insights-maintenance.yml uses for the nightly rollup/prune job, and
# database/scripts/railway-migrate.sh uses for schema changes — this script
# never writes.
#
# Scope: exactly the events this loop cares about (analytics event-tracking
# work item + the shareable-achievement-badge loop, /AGENTS.md-adjacent
# ROADMAP entry): lesson_complete, parent_report_viewed, badge_generated,
# badge_shared, badge_link_click. NOT a general-purpose learning_events dump —
# widen the WHERE list deliberately if another metric needs a new event, not
# by relaxing it to "everything".
#
# Columns exported carry no PII: learning_events has no jsonb payload and no
# open string column (INSIGHTS.md rule 2) — user_id/anon_id are opaque UUIDs,
# not names or emails. This still counts as data leaving Railway (the CSV is
# uploaded as a private, org-scoped GitHub Actions artifact by the calling
# workflow) — narrower in scope and shorter-lived (14-day artifact retention,
# set in the workflow) than the DB's own 400-day raw retention, but a change
# from "never leaves Vault" all the same. Flagged for the owner in the PR/
# commit body per /AGENTS.md §1.9's "list exactly which fields and why".

set -euo pipefail

SERVICE="${RAILWAY_DB_SERVICE:-db}"
SSH_KEY="${RAILWAY_SSH_KEY_PATH:-$HOME/.ssh/railway_key}"
ATTEMPTS="${RAILWAY_SSH_ATTEMPTS:-5}"
RETRY_SECONDS="${RAILWAY_SSH_RETRY_SECONDS:-20}"
DAYS="${NSM_EXPORT_DAYS:-7}"
OUT="${1:?usage: export-nsm-weekly.sh OUTPUT_CSV_PATH}"

# Read the query from a file rather than inlining it here: it is genuinely
# multi-line SQL and the base64-single-argument constraint below cares only
# about what crosses the SSH boundary, not how this script stores it.
QUERY_SQL="$(cat <<'SQL'
\copy (
  SELECT
    id, user_id, anon_id, role, event, route_class,
    lesson_id, segment_id, value, session_id, occurred_at
  FROM public.learning_events
  WHERE event IN (
    'lesson_complete', 'parent_report_viewed',
    'badge_generated', 'badge_shared', 'badge_link_click'
  )
  AND occurred_at >= now() - make_interval(days => __DAYS__)
  ORDER BY occurred_at
) TO STDOUT WITH (FORMAT csv, HEADER true)
SQL
)"
QUERY_SQL="${QUERY_SQL/__DAYS__/$DAYS}"

# Same shape as insights-maintenance.yml's run_sql: SQL travels base64-encoded
# as ONE positional argument because `railway ssh` space-joins its args and
# the remote shell re-parses them — any statement containing spaces would be
# word-split into garbage otherwise. Failure is always printed (§1.14 /
# §1.0 rule 5): a retry that swallows what it is retrying turned twelve
# nights of a different job silently stale before anyone noticed.
b64=$(printf '%s' "$QUERY_SQL" | base64 | tr -d '\n')
for attempt in $(seq 1 "$ATTEMPTS"); do
  status=0
  out="$(railway ssh --service "$SERVICE" -i "$SSH_KEY" \
        "echo $b64 | base64 -d | psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -f -" \
        2>/tmp/nsm-export-stderr)" || status=$?
  if [ "$status" -eq 0 ]; then
    printf '%s\n' "$out" > "$OUT"
    rows=$(($(wc -l < "$OUT") - 1))
    echo "export-nsm-weekly: wrote $rows row(s) (last $DAYS day(s)) to $OUT"
    exit 0
  fi
  echo "export-nsm-weekly: attempt $attempt failed (exit $status):" >&2
  sed 's/^/    /' /tmp/nsm-export-stderr >&2
  if [ "$attempt" -lt "$ATTEMPTS" ]; then sleep "$RETRY_SECONDS"; fi
done
echo "::error::export-nsm-weekly FAILED after $ATTEMPTS attempts — no CSV was written. The last attempt's output is above." >&2
exit 1
