---
title: Infrastructure
status: scaffold
updated: 2026-10-12
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

- The mail service (`email-server/`) runs on Railway as one service with a gated deploy: the workflow `email-server-cd` does nothing until the repository variable `EMAIL_SERVER_LIVE` is `true`, and the service needs the credentials of its SMTP relay (Brevo since 2026-10-12, D-060) and its internal key (variable names in `email-server/.env.example`).
- The frontend is deployed to Vercel from `main`. The database and gateway images and Pulse run on Railway. A `filebase` (Depot) volume service remains in production and holds encrypted backups, with no code in this repository.

- **Production runs the new version since 2026-10-12** (D-059), Railway project `littlefounders-b2c`. The site is on Vercel at `littlefounders.ai`; Core is the service `littlefounders-backend` at `api-b2c.littlefounders.ai`; the gateway is `kong` at `auth-b2c.littlefounders.ai`, closed, in front of `auth`, `rest`, `realtime`, `storage`, `meta`, `studio` and `db`; the mail service is `email-server`, private; the counters are in `Redis`.
- **How each one is deployed.** The site: a push to `main` (workflows `frontend-ci`, then `frontend-cd`). The mail service: the same push (`email-server-cd`, while the repository variable `EMAIL_SERVER_LIVE` is `true`). Core and the gateway: by hand, `railway up backend --path-as-root --service littlefounders-backend --ci` and `railway up database/railway/kong --path-as-root --service kong --ci`; no workflow does it. The database: the migrations of `database/migrations/` are run inside the `db` service (`railway ssh --service db`), each in a transaction with its line in `public.schema_migrations`; it has no public address.
- **What the first deployment did, in order:** saved every service's variables and a dump of the database on the owner's computer (outside the repository); added the new variables without restarting anything; emptied the public schema, the `od9` schema and every account, and applied migrations 0001 to 0005; deployed the closed gateway, Core and the mail service and restarted `auth`; merged pull request 140, which deployed the site.
- **What it taught:** a shell script with Windows line endings does not start in a container, and took the gateway down for a few minutes (`.gitattributes` now keeps them as they must be); the gateway accepted the name of an unset key variable as a key ([[SECURITY-GUIDE]]); the mail service's build needs its build tools although `NODE_ENV` is `production` (`email-server/railway.json`); and a push did not send the large files, because the repository's own hooks folder had no `pre-push` for Git LFS (it has one now), so the site's deployment failed until they were pushed with `git lfs push origin main --all`.
- **Seven services of the previous version were deleted by the owner on 2026-10-12,** because nothing uses them: `oracle`, `coursegen`, `audiogen`, `picturegen`, `kartrush`, `dataintel` and `parent-id-check`. Their variables, and the one database among them that held anything (`dataintel`'s), are in the owner's copy. Eighteen services remain. `filebase` stays: the backup workflows write to it (T-004).
- **Analytics after the deployment** (checked on 2026-10-12): Plausible and Umami kept their history through the redeployment of Pulse and record the new site (a visit that accepted them was counted by both); nothing of a tracker loads on the onboarding or in the application. Google Analytics could not be checked from the development machine, whose network does not resolve Google's analytics hosts; it is to be looked at in GA4's real-time view from another network. The previous backend kept the team's own addresses out of the numbers; nothing does now.
- **Checked in production on 2026-10-12, in a browser with nothing stored:** the guest's way in and out (the onboarding, "later", the home, erasing with its confirmation); the site in the three languages with no error and no violation of the content policy; the sign-in window offering Google and the email; Core's health, the guest read and the refusal without a session; the gateway refusing a request with no key and with the literal name of a key. Not checked: a code arriving in a real mailbox, Google's round trip, and the trackers after accepting them, which need a person.
- **The mail relay is Brevo since 2026-10-12** (D-060 in [[DECISIONS]]). The mail service's relay forwards to `smtp-relay.brevo.com`, port 587, with STARTTLS and SMTP AUTH; Amazon SES receives nothing. Amazon SES kept the account in its sandbox, which delivers to verified addresses only, so sign-in codes did not arrive. Checked in production the same day: a probe and a real sign-in code went through Brevo to a test mailbox, and the owner confirmed that both arrived. This closes the "code arriving in a real mailbox" line left unchecked above.
- **DNS of `littlefounders.ai`** (managed in Vercel), as changed on 2026-10-12. Deleted: the five Amazon SES records (three `*._domainkey` CNAMEs to `dkim.amazonses.com`, and the `mail` MX and SPF TXT of the SES MAIL FROM), and two records of a deleted service, `tutor-b2c` (CNAME) and `_railway-verify.tutor-b2c` (TXT). Added for Brevo: the CNAMEs `brevo1._domainkey` to `b1.littlefounders-ai.dkim.brevo.com` and `brevo2._domainkey` to `b2.littlefounders-ai.dkim.brevo.com`, and a root TXT `brevo-code:...` that proves ownership. `_dmarc` reads `v=DMARC1; p=none; rua=mailto:rua@dmarc.brevo.com`: the aggregate reports go to Brevo, as its domain authentication asks. The domain is authenticated in Brevo. Receiving mail did not change: the MX points to Google.
- **Brevo as a processor.** For each email it receives the recipient's address, the subject and the body (a sign-in code, or the welcome email), and it keeps a log of each one (recipient, subject, events) under its own retention rules, not yet reviewed. Its transactional tracking is set to "anonymous": opens and clicks are counted and not tied to a contact; that screen does not offer switching it off. Both are open and go to counsel (T-036 in [[BUILD-TASKS]], [[CHILD-SAFETY-AND-PRIVACY]]).
- Before 2026-10-12 production ran the previous version (read on 2026-10-10): the gateway at `auth-b2c.littlefounders.ai` (service `kong`, in front of `auth`, `rest`, `realtime`, `storage`, `meta`, `studio`, `db`), the backend at `api-b2c.littlefounders.ai` (service `littlefounders-backend`), the mail service (`email-server`), Redis, and the frontend on Vercel at `littlefounders.ai`. The new Core is meant to replace `littlefounders-backend` in place, under the same variable names (D-031 in [[DECISIONS]]); what has to change on each service before that is the rollout list in [[F-001-authentication]].
- Where each secret lives: on the Railway service that uses it, never in the repository. The Google sign-in keys are `GOTRUE_EXTERNAL_GOOGLE_*` on `auth`; the Brevo SMTP login and key are `SMTP_RELAY_USER` and `SMTP_RELAY_PASS` on `email-server` (the `SES_*` variables of Amazon SES are still set there and are removed once the version that reads the new names is deployed); the Supabase keys are on `kong`, `auth`, `rest`, `db` and the backend under each service's own name for them ([[ENVIRONMENT-SETUP]]).

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
