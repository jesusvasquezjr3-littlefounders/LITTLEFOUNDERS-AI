#!/usr/bin/env bash
# Read-only production handoff check. Never sets variables, deploys, deletes,
# migrates, or prints secret values.
set -euo pipefail

# The header contract ("never prints secret values") must survive `bash -x`:
# xtrace would echo every expansion, including raw variable payloads, so it is
# saved, forced off for the whole script, and restored only on exit.
xtrace_was_on=0
case "$-" in *x*) xtrace_was_on=1 ;; esac
set +x
trap 'if [[ "$xtrace_was_on" == 1 ]]; then set -x; fi' EXIT

ENVIRONMENT="${1:-production}"

failures=0
warnings=0

fail_check() {
  echo "FAIL: $*"
  failures=$((failures + 1))
}

warn_check() {
  echo "WARN: $*"
  warnings=$((warnings + 1))
}

pass_check() {
  echo "OK: $*"
}

command -v railway >/dev/null 2>&1 || {
  echo "FAIL: Railway CLI is not installed" >&2
  exit 1
}
command -v jq >/dev/null 2>&1 || {
  echo "FAIL: jq is required for the read-only Railway preflight" >&2
  exit 1
}

echo "== LittleFounders Railway read-only preflight: $ENVIRONMENT =="

read_status() {
  if [[ -n "${RAILWAY_PROJECT_ID:-}" ]]; then
    railway status --project "$RAILWAY_PROJECT_ID" --environment "$ENVIRONMENT" --json
  else
    railway status --environment "$ENVIRONMENT" --json
  fi
}

read_variables() {
  local service="$1"
  if [[ -n "${RAILWAY_PROJECT_ID:-}" ]]; then
    railway variable list --project "$RAILWAY_PROJECT_ID" --service "$service" --environment "$ENVIRONMENT" --json
  else
    railway variable list --service "$service" --environment "$ENVIRONMENT" --json
  fi
}

status_json="$(read_status)" || {
  echo "FAIL: unable to read Railway status for environment $ENVIRONMENT" >&2
  exit 1
}

# Every status query selects the requested environment by name — the status
# payload carries ALL environments, and aggregating them would let a staging
# deployment satisfy (or poison) a production check.
service_names="$(printf '%s' "$status_json" | jq -r --arg env "$ENVIRONMENT" '.environments.edges[]? | select(.node.name == $env) | .node.serviceInstances.edges[]?.node.serviceName' | sort -u)"
[[ -n "$service_names" ]] || fail_check "no services found in Railway environment $ENVIRONMENT"

service_count() {
  local service="$1"
  printf '%s' "$status_json" | jq -r --arg env "$ENVIRONMENT" --arg service "$service" '[.environments.edges[]? | select(.node.name == $env) | .node.serviceInstances.edges[]?.node | select(.serviceName == $service)] | length'
}

# Collapses a service's active-instance statuses to one word:
#   crashed      — ANY instance in a crashed/failed state (checked first: a
#                  crash-looping replica must fail even next to a RUNNING one)
#   running      — at least one RUNNING instance and no crashed one
#   asleep       — no active instances at all (the scale-to-zero idle state)
#   not-running  — instances exist but none is RUNNING or crashed (deploying,
#                  stopped, ...)
service_state() {
  local service="$1"
  printf '%s' "$status_json" | jq -r --arg env "$ENVIRONMENT" --arg service "$service" '
    [.environments.edges[]? | select(.node.name == $env)
     | .node.serviceInstances.edges[]?.node | select(.serviceName == $service)
     | .activeDeployments[]?.instances[]? | .status? // empty | tostring]
    | if any(test("CRASH|FAIL")) then "crashed"
      elif any(. == "RUNNING") then "running"
      elif length == 0 then "asleep"
      else "not-running"
      end'
}

required_services=(
  littlefounders-backend
  coursegen
  audiogen
  picturegen
  parent-id-check
  email-server
  filebase
  dataintel
  oracle
)
# DEPLOYMENT.md §6: these app services sleep after ~10-15 min idle and wake on
# request, so a present service with NO active instances at all is an expected
# state — WARN, never FAIL. The allowlist never excuses a crash: any instance
# in a crashed/failed state hard-fails the preflight for every service. Every
# service outside this list is always-warm and must be RUNNING for the handoff.
scale_to_zero_services=(
  coursegen
  audiogen
  picturegen
  dataintel
)
# Oracle is deliberately NOT on that list: it terminates the browser's
# websocket, so a cold start happens in front of a learner who has just pressed
# the button — the one place sleeping costs the product more than it saves.
is_scale_to_zero() {
  local service="$1" candidate
  for candidate in "${scale_to_zero_services[@]}"; do
    if [[ "$candidate" == "$service" ]]; then
      return 0
    fi
  done
  return 1
}
for service in "${required_services[@]}"; do
  if [[ "$(service_count "$service")" == "0" ]]; then
    fail_check "service missing: $service"
    continue
  fi
  case "$(service_state "$service")" in
    running)
      pass_check "service present and RUNNING: $service"
      ;;
    crashed)
      # Crashed is never "asleep" — a crash-looping service must not pass the
      # handoff just because it is on the scale-to-zero allowlist.
      fail_check "service has a crashed/failed instance: $service"
      ;;
    asleep)
      if is_scale_to_zero "$service"; then
        warn_check "service present but not RUNNING (scale-to-zero, likely asleep): $service"
      else
        fail_check "service is present but has no RUNNING instance: $service"
      fi
      ;;
    *)
      fail_check "service is present but has no RUNNING instance: $service"
      ;;
  esac
done

if printf '%s\n' "$service_names" | grep -Fxq gamegen; then
  fail_check "retired service still present: gamegen (remove it before production handoff)"
else
  pass_check "retired gamegen service absent"
fi

# Reads the variables JSON on stdin. The secrets payload is never passed as a
# positional argument, so it cannot surface in xtrace output or a process
# listing (the header contract again).
value_state() {
  local key="$1"
  jq -r --arg key "$key" '
    if has($key) == false then "absent"
    elif .[$key] == null or .[$key] == "" then "empty"
    elif (.[$key] | tostring | test("replace|placeholder|example|fake|test|local"; "i")) then "placeholder-like"
    else "configured"
    end'
}

check_variables() {
  local service="$1"
  shift
  local vars_json
  vars_json="$(read_variables "$service")" || {
    fail_check "unable to read variables for service: $service"
    return
  }
  local key state
  for key in "$@"; do
    state="$(printf '%s' "$vars_json" | value_state "$key")"
    case "$state" in
      configured) pass_check "$service/$key configured" ;;
      absent) fail_check "$service/$key missing" ;;
      empty) fail_check "$service/$key empty" ;;
      placeholder-like) fail_check "$service/$key is placeholder-like" ;;
      *) fail_check "$service/$key has an unreadable state" ;;
    esac
  done
}

check_variables coursegen DEEPSEEK_API_KEY QWEN_API_KEY PICTUREGEN_URL PICTUREGEN_INTERNAL_KEY
check_variables audiogen TTS_API_KEY
check_variables picturegen IMAGE_API_KEY
check_variables littlefounders-backend DATAINTEL_URL DATAINTEL_INTERNAL_KEY

echo ""
echo "Variables were classified by presence/state only; secret values were not printed."
if ((failures > 0)); then
  echo "railway-preflight FAILED — $failures failure(s), $warnings warning(s)"
  exit 1
fi
echo "railway-preflight OK — $warnings warning(s); no mutation was performed"
