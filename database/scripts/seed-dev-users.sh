#!/usr/bin/env bash
# seed-dev-users.sh — LOCAL DEV ONLY. Never run against production.
#
# Creates 6 real, login-able test users (password: password123), one per
# role, via the GoTrue admin API + role grants in the DB:
#
#   universal@email.com            → universal
#   tutor@email.com                → parent   (UI term: Tutor)
#   kid@email.com                  → kid
#   bigfounder@email.com           → bigfounder
#   admin@email.com                → admin
#   superadmin@littlefounders.ai   → superadmin  (NOT @email.com — the §1.3
#                                    domain trigger rejects anything else)
#
# Testing Tutor ↔ Testing Niño are linked: one "Testing Family" with both as
# members and a VERIFIED guardian link (kid invariant: ≥1 verified guardian).
# Idempotent — safe to re-run after db:reset.

set -euo pipefail

DB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DOCKER_ENV="$DB_DIR/supabase/docker/.env"
SUPABASE_URL="${SUPABASE_URL:-http://localhost:8000}"
PASSWORD="password123"

if [[ ! -f "$DOCKER_ENV" ]]; then
  echo "FAIL: $DOCKER_ENV not found — run 'npm run db:up' first" >&2
  exit 1
fi
SERVICE_KEY="$(grep '^SERVICE_ROLE_KEY=' "$DOCKER_ENV" | cut -d= -f2- | tr -d '\r\"')"

create_user() {
  local email="$1" display="$2"
  local out
  out=$(curl -s -X POST "$SUPABASE_URL/auth/v1/admin/users" \
    -H "apikey: $SERVICE_KEY" \
    -H "Authorization: Bearer $SERVICE_KEY" \
    -H 'Content-Type: application/json' \
    -d "{\"email\":\"$email\",\"password\":\"$PASSWORD\",\"email_confirm\":true,\"user_metadata\":{\"display_name\":\"$display\"}}")
  if echo "$out" | grep -q '"id"'; then
    echo "  created $email"
  elif echo "$out" | grep -qi 'already been registered\|already registered\|email_exists'; then
    echo "  exists  $email"
  else
    echo "FAIL creating $email: $out" >&2
    exit 1
  fi
}

echo "==> Creating test users via GoTrue admin API"
create_user universal@email.com          'Testing Universal'
create_user tutor@email.com              'Testing Tutor'
create_user kid@email.com                'Testing Niño'
create_user bigfounder@email.com         'Testing BigFounder'
create_user admin@email.com              'Testing Admin'
create_user superadmin@littlefounders.ai 'Testing Superadmin'

echo "==> Granting roles + linking Testing Tutor ↔ Testing Niño"
bash "$DB_DIR/scripts/local-stack.sh" psql -q <<'SQL'
-- Testing Family: Tutor + Niño members, guardian link VERIFIED.
INSERT INTO public.families (id, name, created_by)
SELECT '20000000-0000-4000-a000-000000000001', 'Testing Family', u.id
FROM auth.users u WHERE u.email = 'tutor@email.com'
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.family_members (family_id, user_id, member_role)
SELECT '20000000-0000-4000-a000-000000000001', u.id,
       CASE u.email WHEN 'tutor@email.com' THEN 'parent' ELSE 'kid' END
FROM auth.users u WHERE u.email IN ('tutor@email.com', 'kid@email.com')
ON CONFLICT DO NOTHING;

INSERT INTO public.guardian_links (parent_user_id, kid_user_id, verification_status, verified_at)
SELECT p.id, k.id, 'verified', now()
FROM auth.users p, auth.users k
WHERE p.email = 'tutor@email.com' AND k.email = 'kid@email.com'
ON CONFLICT ON CONSTRAINT guardian_link_unique DO NOTHING;

-- The 0003 signup trigger already gave everyone `universal` + a profile.
-- Grant each account its specific role (idempotent).
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'superadmin'
FROM auth.users u WHERE u.email = 'superadmin@littlefounders.ai'
ON CONFLICT (user_id, role) DO NOTHING;

INSERT INTO public.user_roles (user_id, role)
SELECT u.id, v.role
FROM (VALUES
    ('tutor@email.com', 'parent'),
    ('kid@email.com', 'kid'),
    ('bigfounder@email.com', 'bigfounder')
) AS v(email, role)
JOIN auth.users u ON u.email = v.email
ON CONFLICT (user_id, role) DO NOTHING;

INSERT INTO public.user_roles (user_id, role, granted_by)
SELECT u.id, 'admin', s.id
FROM auth.users u, auth.users s
WHERE u.email = 'admin@email.com' AND s.email = 'superadmin@littlefounders.ai'
ON CONFLICT (user_id, role) DO NOTHING;

-- @usernames for the test accounts (0005)
UPDATE public.profiles p SET username = v.username
FROM (VALUES
    ('universal@email.com', 'universal'),
    ('tutor@email.com', 'tutor'),
    ('kid@email.com', 'nino'),
    ('bigfounder@email.com', 'bigfounder'),
    ('admin@email.com', 'admin'),
    ('superadmin@littlefounders.ai', 'superadmin')
) AS v(email, username)
JOIN auth.users u ON u.email = v.email
WHERE p.user_id = u.id AND p.username IS NULL;
SQL

echo "OK: 6 test users ready (password: password123); Tutor↔Niño linked (verified)"
