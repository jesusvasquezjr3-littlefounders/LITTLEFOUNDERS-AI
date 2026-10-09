---
title: Documentation index
status: scaffold
updated: 2026-10-09
---

# Documentation index

> The entry point to every document. Agents and humans start here.

## Rules for this documentation

- Everything is written in English.
- Every document links to the documents it depends on with Obsidian-style wikilinks (`[[NAME]]`), has a Related section, and is reachable from this page.
- Documentation is part of the change: a change that alters behavior, structure, a rule or a task updates the affected documents in the same commit. `node scripts/check-docs.mjs` verifies links and freshness and runs as a pre-commit hook and in CI.
- A document with status `scaffold` records a structure, not a decision. Only `accepted` documents are requirements. Decisions the owner has made are in [[DECISIONS]].

## Entry points

- [[CLAUDE]] (the same file as [[AGENTS]]): the short rules every agent reads first.
- [[README]]: what exists and how to run it.
- [[AI-WORKFLOW]]: how agents work here.
- [[CHANGELOG]]: what changed.

## Process

How work is organized and recorded.

- [[AI-WORKFLOW]]: How AI agents and humans work together on this repository.
- [[IMPLEMENTATION-PLAN]]: The order in which the product is built and why.
- [[BUILD-TASKS]]: The working task list: what is open, in progress and done.
- [[DECISIONS]]: Why things are the way they are: one short record per decision made by the owner.

## Product

What is built, for whom.

- [[PRODUCT-REQUIREMENTS]]: What LittleFounders is, for whom, and why. The source of truth for scope.
- [[USER-FLOWS]]: How each kind of user moves through the product, screen by screen and state by state.
- [[LANDING-MESSAGING]]: What the landing says and why: audience, promise, section order, and the assumptions still to test.
- [[GLOSSARY]]: The one agreed vocabulary of the domain, so code, UI copy, data and documents use the same words.

## Design

How it looks and behaves.

- [[DESIGN-SYSTEM]]: The visual and interaction language: tokens, components, patterns and the rules for using them.
- [[UI-LIBRARIES]]: The seven mandatory UI libraries, how they are wired here and the rules for using them.
- [[RESEARCH-FOUNDATION]]: The published evidence behind the design (color, shape, gamification, rewards, children's motor ability), graded, and what it means for the current tokens.

## Engineering

How it is built.

- [[SYSTEM-DESIGN]]: The reasoning behind the system: required qualities, capacity assumptions and trade-offs.
- [[ARCHITECTURE]]: The structure of the system: components, boundaries, dependencies and the stack.
- [[FRONTEND-GUIDE]]: How the web client is built: the stack, the structure, the five non-negotiable rules, the conventions, how a change is checked, and what is still open.
- [[FRONTEND-TOOLKIT]]: Which skill, library or document to use for each frontend job, the repeating procedures, and how each mechanical check is run.
- [[BACKEND-GUIDE]]: The rules for building server-side logic.
- [[API-GUIDE]]: The contract style and rules for every interface between client and server.
- [[DATABASE-GUIDE]]: Schema conventions, migrations, permissions and data handling for the database.
- [[CODE-STYLE-GUIDE]]: How code is written, named, commented and reviewed.
- [[TESTING-GUIDE]]: What is tested, how, and what must pass before work is called done.
- [[TECHNICAL-REQUIREMENTS]]: The index of technical requirements documents, one per feature, and the method for writing them.
- [[PERFORMANCE-AND-SCALING]]: Performance budgets, caching, CDN behavior and how the system grows.

## Security

How it is protected.

- [[SECURITY-GUIDE]]: The security baseline every change must meet.
- [[CHILD-SAFETY-AND-PRIVACY]]: The rules that protect minors and their personal data.
- [[RATE-LIMITING-AND-ABUSE]]: How the system limits use to protect availability, cost and users.
- [[ai-pentesting]]: Agent security skills and the rules for any AI pentest run.

## Operations

How it runs.

- [[INFRASTRUCTURE]]: Where everything runs, who owns it and how it is connected.
- [[ENVIRONMENT-SETUP]]: How to get a working development machine, and how to check it is correct.
- [[CI-CD-AND-VERSION-CONTROL]]: How changes are recorded, checked, released and rolled back.
- [[OBSERVABILITY]]: How the system is watched: errors, logs, metrics, uptime, alerts and product analytics.
- [[INCIDENT-RESPONSE]]: What to do when something goes wrong, especially when children's data may be involved.
- [[BACKUP-RESTORE]]: Backup and restore procedure for the Vault and Pulse databases.

## Features

Per-feature technical requirements (one document each).

- [[FEATURE-TEMPLATE]]: The template every technical requirements document starts from. Copy it to `docs/features/<FEATURE-ID>-<name>.md`.

## Which documents to load for a task

| Task | Read |
|---|---|
| Any task | [[CLAUDE]], [[AI-WORKFLOW]], [[BUILD-TASKS]] |
| Starting a feature | [[PRODUCT-REQUIREMENTS]], [[USER-FLOWS]], [[TECHNICAL-REQUIREMENTS]], [[FEATURE-TEMPLATE]] |
| Frontend change | [[FRONTEND-GUIDE]], [[DESIGN-SYSTEM]], [[CODE-STYLE-GUIDE]] |
| Backend or API change | [[BACKEND-GUIDE]], [[API-GUIDE]], [[SECURITY-GUIDE]] |
| Database change | [[DATABASE-GUIDE]], [[CHILD-SAFETY-AND-PRIVACY]], [[SECURITY-GUIDE]] |
| Anything involving a minor's data or the tutor | [[CHILD-SAFETY-AND-PRIVACY]], [[SECURITY-GUIDE]], [[RATE-LIMITING-AND-ABUSE]] |
| Deploy, workflow, environment | [[CI-CD-AND-VERSION-CONTROL]], [[INFRASTRUCTURE]], [[ENVIRONMENT-SETUP]] |
| Monitoring, logging, an incident | [[OBSERVABILITY]], [[INCIDENT-RESPONSE]], [[BACKUP-RESTORE]] |
| Performance or capacity | [[PERFORMANCE-AND-SCALING]], [[SYSTEM-DESIGN]] |
| Verifying work | [[TESTING-GUIDE]] |

## Related

- [[AI-WORKFLOW]]
- [[DECISIONS]]
- [[IMPLEMENTATION-PLAN]]

## Update this document when

- A document is added, renamed or removed.
