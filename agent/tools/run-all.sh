#!/usr/bin/env bash
# Runs an npm script (test | type-check | lint | build) in every service that defines it.
set -euo pipefail
cd "$(dirname "$0")/../.."

SCRIPT="${1:?usage: run-all.sh <npm-script>}"
JOBS="${LF_RUN_ALL_JOBS:-1}"
if [[ ! "$JOBS" =~ ^[1-4]$ ]]; then
  echo "LF_RUN_ALL_JOBS must be an integer from 1 to 4 (received: $JOBS)" >&2
  exit 2
fi

# Discovered from disk, not listed. Skipping a service that does not define the
# requested script is intended; never visiting it at all is not — omitting
# Prism/Depot/Data Intel once made a green root gate weaker than those services'
# own CI, and a hand-kept list is exactly how that happens again the next time a
# service is added. (The list this replaces was pinned to "AGENTS.md §1.5", a
# section deleted in 77b55596, so it was pinned to nothing.)
SERVICES=()
for dir in */; do
  name="${dir%/}"
  [ "$name" = "node_modules" ] && continue
  [ -f "$name/package.json" ] && SERVICES+=("$name")
done

RUN_SERVICES=()
for s in "${SERVICES[@]}"; do
  [ -f "$s/package.json" ] || continue
  if ! node -e '
    const p = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
    process.exit(p.scripts && p.scripts[process.argv[2]] ? 0 : 1);
  ' "$s/package.json" "$SCRIPT"; then
    echo "── $s: no '$SCRIPT' script, skipping"
    continue
  fi
  RUN_SERVICES+=("$s")
done

# Each worker writes to its own file. The parent prints those files in discovery
# order after the whole pool drains, so parallel output stays readable and a
# slower package cannot splice its lines into another package's diagnostics.
LOG_DIR="$(mktemp -d "${TMPDIR:-/tmp}/lf-run-all.XXXXXX")"
LOG_FILES=()
cleanup() {
  for log in "${LOG_FILES[@]:-}"; do
    [ -n "$log" ] && rm -f -- "$log"
  done
  rmdir -- "$LOG_DIR" 2>/dev/null || true
}
trap cleanup EXIT

FAILED=()
declare -A PID_SERVICE=()
declare -A SERVICE_STATUS=()
declare -A SERVICE_LOG=()
ACTIVE_PIDS=()
next=0
while [ "$next" -lt "${#RUN_SERVICES[@]}" ] || [ "${#ACTIVE_PIDS[@]}" -gt 0 ]; do
  while [ "$next" -lt "${#RUN_SERVICES[@]}" ] && [ "${#ACTIVE_PIDS[@]}" -lt "$JOBS" ]; do
    s="${RUN_SERVICES[next]}"
    log="$LOG_DIR/$next.log"
    LOG_FILES+=("$log")
    SERVICE_LOG["$s"]="$log"
    (cd "$s" && npm run --silent "$SCRIPT") >"$log" 2>&1 &
    pid="$!"
    ACTIVE_PIDS+=("$pid")
    PID_SERVICE["$pid"]="$s"
    next=$((next+1))
  done

  if wait -n -p done_pid "${ACTIVE_PIDS[@]}"; then
    SERVICE_STATUS["${PID_SERVICE[$done_pid]}"]=0
  else
    SERVICE_STATUS["${PID_SERVICE[$done_pid]}"]=$?
  fi
  remaining=()
  for pid in "${ACTIVE_PIDS[@]}"; do
    [ "$pid" = "$done_pid" ] || remaining+=("$pid")
  done
  ACTIVE_PIDS=("${remaining[@]}")
done

for s in "${RUN_SERVICES[@]}"; do
  status="${SERVICE_STATUS[$s]}"
  echo "── $s: npm run $SCRIPT"
  cat "${SERVICE_LOG[$s]}"
  rm -f -- "${SERVICE_LOG[$s]}"
  if [ "$status" -ne 0 ]; then
    FAILED+=("$s")
    echo "── $s: FAILED (exit $status)" >&2
  fi
done

if [ "${#FAILED[@]}" -gt 0 ]; then
  echo "run-all $SCRIPT FAILED in: ${FAILED[*]}" >&2
  exit 1
fi
echo "run-all $SCRIPT OK across all services"
