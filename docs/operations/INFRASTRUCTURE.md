---
title: Infrastructure
status: scaffold
updated: 2026-10-10
---

# Infrastructure

> Where everything runs, who owns it and how it is connected.

> **Status: scaffold.** The structure is set; nothing below that is not marked as current state has been decided. Fill it in with the owner, then change the status to `draft` and, once approved, `accepted`.

## Role

The inventory of hosting and third-party services, so no environment, account or cost is a surprise.

## Read this when

- Adding or changing a service, domain or account.
- Debugging an environment difference.

## To define

- [ ] Environments (local, staging, production) and how they differ.
- [ ] Hosting inventory with region, owner and cost.
- [ ] Domains, DNS and certificates.
- [ ] Network layout and egress.
- [ ] Where each secret lives.
- [ ] Third-party processors and the data each receives.
- [ ] Disaster-recovery targets.

## Current state

- The mail service (`email-server/`) runs on Railway as one service with a gated deploy: the workflow `email-server-cd` does nothing until the repository variable `EMAIL_SERVER_LIVE` is `true`, and the service needs the Amazon SES credentials and its internal key (variable names in `email-server/.env.example`).
- The frontend is deployed to Vercel from `main`. The database and gateway images and Pulse run on Railway. A `filebase` (Depot) volume service remains in production and holds encrypted backups, with no code in this repository.

- Production today still runs the previous version (Railway project `littlefounders-b2c`, read on 2026-10-10): the gateway at `auth-b2c.littlefounders.ai` (service `kong`, in front of `auth`, `rest`, `realtime`, `storage`, `meta`, `studio`, `db`), the backend at `api-b2c.littlefounders.ai` (service `littlefounders-backend`), the mail service (`email-server`), Redis, and the frontend on Vercel at `littlefounders.ai`. The new Core is meant to replace `littlefounders-backend` in place, under the same variable names (D-031 in [[DECISIONS]]); what has to change on each service before that is the rollout list in [[F-001-authentication]].
- Where each secret lives: on the Railway service that uses it, never in the repository. The Google sign-in keys are `GOTRUE_EXTERNAL_GOOGLE_*` on `auth`; the Amazon SES credentials are `SES_*` on `email-server`; the Supabase keys are on `kong`, `auth`, `rest`, `db` and the backend under each service's own name for them ([[ENVIRONMENT-SETUP]]).

## Related

- [[F-001-authentication]]
- [[DECISIONS]]

- [[ARCHITECTURE]]
- [[ENVIRONMENT-SETUP]]
- [[CI-CD-AND-VERSION-CONTROL]]
- [[OBSERVABILITY]]
- [[SECURITY-GUIDE]]
- [[BACKUP-RESTORE]]
- [[PERFORMANCE-AND-SCALING]]

Back to [[INDEX]].

## Update this document when

- A service, environment, domain or account is added, moved or removed.
