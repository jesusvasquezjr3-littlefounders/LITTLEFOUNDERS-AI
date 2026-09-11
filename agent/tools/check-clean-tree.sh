#!/usr/bin/env bash
# Fails when the working tree or index differs from HEAD, or when untracked
# (non-gitignored) files exist.
#
# release-readiness runs this first, so any diff at that point means a release
# candidate being checked on top of uncommitted work. The previous
# implementation (`git diff --check`) only flags whitespace errors and conflict
# markers — a stale regenerated file sailed straight through the gate — and an
# earlier revision of this gate ignored untracked files entirely, contradicting
# the documented contract that uncommitted work stops the gate.
set -euo pipefail

clean=1
git diff --quiet || clean=0
git diff --cached --quiet || clean=0
# Untracked files are uncommitted work too. `--exclude-standard` honors
# .gitignore, so local-only artifacts (coursegen/runs/, .env, ...) never trip
# the gate.
untracked="$(git ls-files --others --exclude-standard)"
[[ -z "$untracked" ]] || clean=0

if ((clean == 0)); then
  echo "git:diff-check FAILED — the working tree, index, or untracked set differs from HEAD:" >&2
  git status --short >&2
  echo "Commit, stash, or remove untracked files before the release gate." >&2
  exit 1
fi

echo "git:diff-check OK — working tree and index match HEAD; no untracked files"
