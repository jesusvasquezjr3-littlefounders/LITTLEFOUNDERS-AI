#!/usr/bin/env bash
# Samples the runner's disk every 20 s, for the browser gates of frontend-ci.yml.
# Started in the background before a gate (its output goes to
# $RUNNER_TEMP/disk.log); disk-report.sh prints the samples after the gate.
# Each sample: free space on /, what /tmp and the audit reports hold, and what
# deleted-but-still-open files under /tmp hold (where Chrome's shared memory
# lives under --disable-dev-shm-usage), each file once by inode: anonymous
# memfd mappings are listed once per process and are not on the disk.
# Runs from frontend/; the runner stops it at job end.
set -u
while true; do
  free=$(df -BM --output=avail / | tail -n 1 | tr -d ' ')
  tmp=$(du -sm /tmp 2>/dev/null | cut -f1)
  reports=$(du -sm ../audit-results 2>/dev/null | cut -f1)
  open=$(sudo lsof -nP +L1 2>/dev/null | awk '$0 ~ / \/tmp\// && $7 ~ /^[0-9]+$/ && !seen[$8]++ { s += $7 } END { print int(s / 1048576) }')
  echo "$(date -u +%T) free=${free} tmp=${tmp:-?}M audit-results=${reports:-?}M deleted-in-tmp=${open:-?}M"
  sleep 20
done
