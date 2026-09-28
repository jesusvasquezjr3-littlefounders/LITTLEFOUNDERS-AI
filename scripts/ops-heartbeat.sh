#!/usr/bin/env bash
# ops-heartbeat.sh <job> <ok:true|false> [bytes] [pending]
#
# H.4 / Appendix O 1.3: the last step of vault-backup.yml, pulse-backup.yml
# and vault-drift.yml. Records the run in Core's audit trail through
# POST /api/v1/internal/ops/heartbeat, called from INSIDE the Core container
# (the same route to Core tutor-retention.yml uses), so INTERNAL_API_KEY and
# PORT expand there and never on the runner. ops-job-watch.yml later reads
# the trail back and notifies a human when a job goes quiet.
#
# Requires: RAILWAY_TOKEN in the environment, the Railway CLI, and the SSH
# key at RAILWAY_SSH_KEY_PATH (default ~/.ssh/railway_backup_key). Exits
# non-zero when Core does not confirm the heartbeat: a run whose trail was
# not recorded must not look healthy.
set -euo pipefail

job="${1:?job: vault_backup | pulse_backup | vault_drift}"
ok="${2:?ok: true | false}"
bytes="${3:-}"
pending="${4:-}"
key="${RAILWAY_SSH_KEY_PATH:-$HOME/.ssh/railway_backup_key}"

case "$job" in vault_backup|pulse_backup|vault_drift) ;; *) echo "unknown job: $job" >&2; exit 2 ;; esac
case "$ok" in true|false) ;; *) echo "ok must be true or false" >&2; exit 2 ;; esac
payload="{\"job\":\"${job}\",\"ok\":${ok}"
if [ -n "$bytes" ]; then payload="${payload},\"bytes\":${bytes}"; fi
if [ -n "$pending" ]; then payload="${payload},\"pending\":${pending}"; fi
payload="${payload}}"

# Base64 as a single argument and no inner quotes around the -c string:
# `railway ssh` passes argv straight to exec (measured in tutor-retention.yml).
script='curl -sS -X POST'
script="$script"' -H "Content-Type: application/json"'
script="$script"' -H "x-internal-api-key: $INTERNAL_API_KEY"'
script="$script"" -d '${payload}'"
script="$script"' "http://127.0.0.1:${PORT:-4000}/api/v1/internal/ops/heartbeat"'
b64=$(printf '%s' "$script" | base64 | tr -d '\n')

body=''
for attempt in 1 2 3; do
  if body=$(railway ssh --service littlefounders-backend -i "$key" -- sh -c "echo $b64 | base64 -d | sh" 2>&1) \
    && printf '%s' "$body" | grep -q '"recorded":true'; then
    echo "ops-heartbeat: ${job} ok=${ok} recorded"
    exit 0
  fi
  echo "heartbeat attempt ${attempt} failed:" >&2
  printf '%s\n' "$body" | head -5 >&2
  sleep 20
done
echo "::error::Core did not confirm the ${job} heartbeat; the watchdog will report this job as stale"
exit 1
