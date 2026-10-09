---
title: Environment setup
status: scaffold
updated: 2026-10-09
---

# Environment setup

> How to get a working development machine, and how to check it is correct.

> **Status: scaffold.** The structure is set; nothing below that is not marked as current state has been decided. Fill it in with the owner, then change the status to `draft` and, once approved, `accepted`.

## Role

An environment configured badly produces errors that look like product bugs. This is the checklist for a human or an agent to start from a known-good state.

## Read this when

- Setting up a machine.
- Something works on one machine and not another.

## To define

- [ ] Prerequisites: Node 24, Docker, Git and Git LFS, shell notes for Windows.
- [ ] Machine profiles and how to measure free memory before starting services.
- [ ] Clone, install and run commands per package.
- [ ] Environment variables: the full catalog, what each is for, where its real value comes from.
- [ ] The local database stack.
- [ ] Enabling the repository git hooks.
- [ ] A verification checklist.
- [ ] Known traps and fixes.

## Current state

- Clone with Git LFS installed. Frontend: `npm install`, `npm run dev`, `npm run type-check && npm run lint && npm run build` in `frontend/`. Database stack from `database/`: `npm run db:sync`, then `db:up`. Enable the documentation check with `git config core.hooksPath .githooks`. The frontend dev server listens on `localhost` (the IPv6 loopback, not `127.0.0.1`) and must be restarted after a change to `vite.config.ts` or after installing a Tailwind or shadcn piece; more traps in [[FRONTEND-TOOLKIT]]. The frontend audit tools (`npm run audit:*`) need Chrome and the dev server running; set `CHROME_PATH` if Chrome is not in its usual place.

## Related

- [[README]]
- [[INFRASTRUCTURE]]
- [[DATABASE-GUIDE]]
- [[CI-CD-AND-VERSION-CONTROL]]
- [[CODE-STYLE-GUIDE]]
- [[AI-WORKFLOW]]

Back to [[INDEX]].

## Update this document when

- A prerequisite, command or environment variable changes.
