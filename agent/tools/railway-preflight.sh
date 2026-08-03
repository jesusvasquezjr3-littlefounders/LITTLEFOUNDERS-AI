#!/usr/bin/env bash
# Read-only production handoff check. Never sets variables, deploys, deletes,
# migrates, or prints secret values.
set -euo pipefail

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

service_names="$(printf '%s' "$status_json" | jq -r '.environments.edges[]?.node.serviceInstances.edges[]?.node.serviceName' | sort -u)"
[[ -n "$service_names" ]] || fail_check "no services found in Railway environment $ENVIRONMENT"

service_count() {
  local service="$1"
  printf '%s' "$status_json" | jq -r --arg service "$service" '[.environments.edges[]?.node.serviceInstances.edges[]?.node | select(.serviceName == $service)] | length'
}

service_running() {
  local service="$1"
  printf '%s' "$status_json" | jq -r --arg service "$service" '[.environments.edges[]?.node.serviceInstances.edges[]?.node | select(.serviceName == $service) | .activeDeployments[]?.instances[]?.status] | any(. == "RUNNING")'
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
)
for service in "${required_services[@]}"; do
  if [[ "$(service_count "$service")" == "0" ]]; then
    fail_check "service missing: $service"
  elif [[ "$(service_running "$service")" == "true" ]]; then
    pass_check "service present and RUNNING: $service"
  else
    fail_check "service is present but has no RUNNING instance: $service"
  fi
done

if printf '%s\n' "$service_names" | grep -Fxq gamegen; then
  fail_check "retired service still present: gamegen (remove it before production handoff)"
else
  pass_check "retired gamegen service absent"
fi

value_state() {
  local vars_json="$1" key="$2"
  printf '%s' "$vars_json" | jq -r --arg key "$key" '
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
    state="$(value_state "$vars_json" "$key")"
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
