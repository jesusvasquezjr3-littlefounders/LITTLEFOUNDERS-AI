#!/usr/bin/env bash
# Room on a hosted runner's disk for the browser gates of frontend-ci.yml.
#
# The ubuntu-latest image ships toolchains these jobs never read (Android SDK,
# .NET, GHC, CodeQL). Chrome keeps its shared memory in files under /tmp on a
# runner (--disable-dev-shm-usage, scripts/lesson-engine/browser.mjs), and when
# the disk fills it can no longer draw a page: the gate then reports states that
# "never became ready" or a browser that went away, which reads like a product
# failure. Only directories of the hosted image are removed; the free space is
# printed before and after.
set -u
df -h /
for dir in /usr/local/lib/android /usr/share/dotnet /opt/ghc /usr/local/.ghcup /opt/hostedtoolcache/CodeQL; do
  if [ -d "$dir" ]; then sudo rm -rf "$dir" || echo "could not remove $dir"; fi
done
df -h /
