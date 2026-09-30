#!/usr/bin/env bash
# After a browser gate (frontend-ci.yml): the disk now, the samples disk-sampler.sh
# took while the gate ran, and the largest places a runner writes to, so a gate
# that failed on a full disk says so in its own log. Never fails the job.
set -u
df -h /
log="${RUNNER_TEMP:-/tmp}/disk.log"
if [ -f "$log" ]; then
  echo "--- the disk while the gate ran (every 20 s)"
  tail -n 120 "$log"
fi
echo "--- the largest places a runner writes to"
sudo du -xsh /tmp /var/tmp /var/crash /var/lib/systemd/coredump /var/log "$HOME/.cache" "$HOME/.npm" "$HOME/.config" "${GITHUB_WORKSPACE:-.}" 2>/dev/null | sort -h
exit 0
