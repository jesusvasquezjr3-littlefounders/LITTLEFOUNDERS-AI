#!/usr/bin/env bash
# Greps git-tracked files for credential patterns. Gate: exits 1 on any hit.
set -euo pipefail
cd "$(dirname "$0")/../.."

# Patterns: private keys, JWT-looking blobs, common API key prefixes,
# hardcoded values on secret-named env vars.
PATTERNS=(
  '-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----'
  'eyJ[A-Za-z0-9_-]{20,}\.eyJ[A-Za-z0-9_-]{20,}'
  'sk-[A-Za-z0-9]{20,}'
  'sbp_[A-Za-z0-9]{20,}'
  'ghp_[A-Za-z0-9]{20,}'
  'AKIA[0-9A-Z]{16}'
  'xox[baprs]-[A-Za-z0-9-]{10,}'
  '(API_KEY|SECRET|TOKEN|PASSWORD|SERVICE_ROLE)[A-Z_]*[[:space:]]*[:=][[:space:]]*["'\''][A-Za-z0-9+/_-]{16,}["'\'']'
)

FAIL=0
for p in "${PATTERNS[@]}"; do
  # Search tracked files only; exclude this script and lockfiles (integrity hashes).
  if HITS=$(git grep -InE "$p" -- ':!agent/tools/check-secrets.sh' ':!*package-lock.json' 2>/dev/null); then
    echo "secrets:check HIT for pattern: $p" >&2
    echo "$HITS" >&2
    FAIL=1
  fi
done

if [ "$FAIL" -eq 1 ]; then
  echo "secrets:check FAILED — rotate anything real, move values to .env, keep placeholders in .env.example." >&2
  exit 1
fi
echo "secrets:check OK — no credential patterns in tracked files"
