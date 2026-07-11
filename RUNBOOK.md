# RUNBOOK.md — Incident Response

## Rollback to v1

v1 is fully intact on `main`. Emergency path:
```bash
git checkout main            # local inspection
# Production rollback = re-point Vercel/Railway to main (v1 deploy configs live there)
```
The v2 wipe is a single revertable commit on `littlefounders_v2` (`git log --diff-filter=D` to find it).

## Secrets leak (a credential landed in git)

1. **ROTATE the credential immediately** — at the provider (Supabase, Railway, DeepSeek, Qwen…). Rotation is the containment; history rewriting is not.
2. Purge from history (`git filter-repo`) only after rotation, coordinate force-push with the team (BOUNDARIES action).
3. Verify `npm run secrets:check` catches the pattern; if it didn't, add the pattern to `agent/tools/check-secrets.sh`.
4. Record the incident + fix here.

## CI red on littlefounders_v2 / main

1. `gh run list --branch <branch>` → `gh run view <id> --log-failed`.
2. Reproduce locally: `cd <service> && npm ci && npm run type-check && npm run lint && npm test`.
3. Fix forward if < 30 min; otherwise revert the breaking commit. Never merge over red.

## Supabase self-hosted on Railway (placeholders — MUST be completed before real user data)

- **Restart procedure:** TBD at deploy (Day 4–5).
- **Backup:** TBD — scheduled `pg_dump` to external storage; REQUIRED before onboarding any real user.
- **Restore drill:** TBD — must be executed once successfully before launch.
- **Upgrade procedure:** TBD — component versions pinned in `database/DEPLOYMENT.md`.

## Service down (Railway)

1. Check `/health` of the service; check Railway logs/deploy status.
2. Redeploy last green build; if DB-related, check Vault components (Kong, GoTrue, Postgres) in order.
3. Record cause + fix in this file.
