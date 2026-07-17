#!/usr/bin/env bash
# Verifies AGENTS.md and CLAUDE.md are byte-identical (AGENTS.md sync rule).
set -euo pipefail
cd "$(dirname "$0")/../.."

if diff -q AGENTS.md CLAUDE.md >/dev/null; then
  echo "docs:check OK — AGENTS.md == CLAUDE.md"
else
  echo "docs:check FAILED — AGENTS.md and CLAUDE.md differ." >&2
  echo "Fix: edit AGENTS.md, then: cp AGENTS.md CLAUDE.md" >&2
  exit 1
fi
