#!/usr/bin/env bash
# Same fake CLI transport contract as the Node reference, without Node startup per query.
set -u
json='['
separator=''
for arg in "$@"; do
  escaped=${arg//\\/\\\\}
  escaped=${escaped//\"/\\\"}
  escaped=${escaped//$'\n'/\\n}
  escaped=${escaped//$'\r'/\\r}
  escaped=${escaped//$'\t'/\\t}
  json+="$separator\"$escaped\""
  separator=','
done
printf '%s]\n' "$json" >> "$RAILWAY_FAKE_ARGS"
for arg in "$@"; do
  if [[ "$arg" == '--' ]]; then
    printf 'sh: usage: printf FORMAT [ARGUMENT ...]\n' >&2
    exit 0
  fi
done
command=''
skip=false
for arg in "$@"; do
  if [[ "$skip" == true ]]; then skip=false; continue; fi
  case "$arg" in
    ssh) ;;
    --service|-i) skip=true ;;
    *) command="$arg" ;;
  esac
done
if [[ -n "$command" ]]; then
  # Keep the remote command in a FILE: native Windows sh -c truncates long argv.
  script="$RAILWAY_FAKE_ARGS.remote-$$.sh"
  printf '%s' "$command" > "$script"
  sh "$script" > "$script.stdout" 2> "$script.stderr" || true
  stdout=''; stderr=''
  IFS= read -r -d '' stdout < "$script.stdout" || true
  IFS= read -r -d '' stderr < "$script.stderr" || true
  printf '%s' "$stdout"
  printf '%s' "$stderr" >&2
fi
# Real CLI discards the remote status; local status is ALWAYS zero.
exit 0
