# BOUNDARIES.md — Actions Requiring Human Sign-Off

An agent may PREPARE any of these (draft the diff, write the migration, open the PR) but must NOT execute/merge them without an explicit human yes in the current session:

1. **Anything against production** — prod DB migrations, deploys, Railway/Vercel config changes, DNS.
2. **Stack-of-record changes** (`/AGENTS.md` §1.2) — swapping libraries, adding a service, changing deploy targets.
3. **Role/permission logic** — anything touching the 6-role model, superadmin gating, guardian links, RLS policies on identity tables.
4. **Child-data handling** — any change to what data leaves our infra, moderation behavior, or parent visibility (§1.9).
5. **New dependencies** — adding a package to any service (drift + supply-chain surface).
6. **Deleting or rewriting git history**, force-pushes, branch deletion.
7. **Editing an already-applied migration** (forbidden outright — write a delta).
8. **Outward-facing actions** — sending real emails, calling paid AI APIs in bulk, publishing anything.
9. **Editing `/AGENTS.md`, `/CLAUDE.md`, this file, or `TEAM_PROTOCOL.md`** — propose the diff, human approves.

When in doubt whether something is boundary-listed: it is. Ask.
