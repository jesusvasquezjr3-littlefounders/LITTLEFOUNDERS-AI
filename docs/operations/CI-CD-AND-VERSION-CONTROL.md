---
title: CI/CD and version control
status: scaffold
updated: 2026-10-09
---

# CI/CD and version control

> How changes are recorded, checked, released and rolled back.

> **Status: scaffold.** The structure is set; nothing below that is not marked as current state has been decided. Fill it in with the owner, then change the status to `draft` and, once approved, `accepted`.

## Role

Defines the path from a commit to production and the gates on it. Agents follow it so that nothing reaches production by accident.

## Read this when

- Committing, releasing or editing a workflow.
- Investigating a failed pipeline.

## To define

- [ ] Branching and commit conventions.
- [ ] The documentation check that runs before every commit.
- [ ] Pull request and review rules.
- [ ] Inventory of workflows and what each does.
- [ ] Gates before deploy; environment promotion.
- [ ] Release, rollback and hotfix procedure.
- [ ] Dependency update policy.
- [ ] Secrets used by CI.
- [ ] Pinning rules for actions and images.

## Current state

- Work happens on `main`; commits are local and the owner decides when to push. A push to `main` deploys the frontend to Vercel. Workflows: `frontend-ci`, `frontend-cd`, `pulse-ci`, `pulse-cd`, `pulse-backup`, `pulse-dependabot-automerge`, `vault-backup`, `docs-ci`, `email-server-ci` (type-check, lint and build when `email-server/` changes) and `email-server-cd` (Railway deploy, skipped until the variable `EMAIL_SERVER_LIVE` is `true`). The GitHub ruleset on `main` requires a check whose workflow no longer exists. The deploy fetches only `frontend/public/scenes/**` from Git LFS.

## Related

- [[ENVIRONMENT-SETUP]]
- [[INFRASTRUCTURE]]
- [[TESTING-GUIDE]]
- [[SECURITY-GUIDE]]
- [[CODE-STYLE-GUIDE]]
- [[CHANGELOG]]
- [[AI-WORKFLOW]]

Back to [[INDEX]].

## Update this document when

- A workflow, gate or convention changes.
