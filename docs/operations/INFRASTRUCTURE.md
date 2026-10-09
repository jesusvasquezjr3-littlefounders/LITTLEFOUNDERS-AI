---
title: Infrastructure
status: scaffold
updated: 2026-10-09
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

- The frontend is deployed to Vercel from `main`. The database and gateway images and Pulse run on Railway. A `filebase` (Depot) volume service remains in production and holds encrypted backups, with no code in this repository.

## Related

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
