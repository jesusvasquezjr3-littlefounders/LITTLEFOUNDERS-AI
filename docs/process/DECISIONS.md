---
title: Decision log
status: scaffold
updated: 2026-10-09
---

# Decision log

> Why things are the way they are: one short record per decision made by the owner.

> **Status: scaffold.** The structure is set; nothing below that is not marked as current state has been decided. Fill it in with the owner, then change the status to `draft` and, once approved, `accepted`.

## Role

Stops agents and humans from re-litigating settled questions or silently reversing them. Only decisions the owner has made are recorded; a proposal is not a decision.

## Read this when

- Before proposing a change that might contradict an earlier choice.
- After the owner decides something that has lasting effect.

## To define

- [ ] Entry format: ID, date, status (accepted or superseded), context, decision, consequences.

## Entries

### D-001: Restart from zero

Date: 2026-10-09. Status: accepted.

Everything of the previous version was deleted except the landing page, the 3D characters, the pinned Supabase setup and Pulse. Every feature is designed again with the owner. The previous version is the git tag `archive/pre-restart-2026-10-09`, kept for data migration and history only.

### D-002: Single branch, local commits

Date: 2026-10-09. Status: accepted.

Work happens on `main` only. Commits stay local until the owner pushes, because a push deploys.

### D-003: 3D files in Git LFS

Date: 2026-10-09. Status: accepted.

The Mentor character models in `glb/` and `frontend/public/scenes/` are tracked with Git LFS and must not be deleted or overwritten without the owner asking.

### D-004: Analytics

Date: 2026-10-09. Status: accepted.

Plausible, Umami and Google Analytics 4 stay, loaded only after consent.

### D-005: Security tooling

Date: 2026-10-09. Status: accepted.

The anti-slop lint rules and the Strix security skills and references are installed. Shannon and Strix themselves are not installed and the idea was cancelled.

### D-006: Documentation system

Date: 2026-10-09. Status: accepted.

Documentation lives under `docs/`, is written in English, is interlinked with Obsidian-style wikilinks, and is checked for links and freshness before every commit.

## Related

- [[PRODUCT-REQUIREMENTS]]
- [[ARCHITECTURE]]
- [[SYSTEM-DESIGN]]
- [[IMPLEMENTATION-PLAN]]
- [[AI-WORKFLOW]]

Back to [[INDEX]].

## Update this document when

- The owner makes a decision with lasting effect, or reverses one.
