---
title: Code style guide
status: scaffold
updated: 2026-10-09
---

# Code style guide

> How code is written, named, commented and reviewed.

> **Status: scaffold.** The structure is set; nothing below that is not marked as current state has been decided. Fill it in with the owner, then change the status to `draft` and, once approved, `accepted`.

## Role

Makes generated code indistinguishable from hand-written code and keeps it checkable by tools. Rules that a linter can enforce are enforced by the linter; this document holds the rest.

## Read this when

- Writing or reviewing any code.
- Configuring lint or format tooling.

## To define

- [ ] Languages and versions (Node 24, TypeScript strict).
- [ ] Naming and file layout.
- [ ] Comment policy: what deserves a comment and what does not.
- [ ] Error handling and null-handling conventions.
- [ ] Parse input at the boundary; no unparsed `unknown` parameters or unjustified assertions.
- [ ] Dependency policy: when a new dependency is acceptable.
- [ ] Commit message format and size.
- [ ] Review checklist.

## Current state

- ESLint with typescript-eslint, plus the vendored anti-slop Oxlint rules (`npm run lint:slop` in `frontend/`). Everything written to the repository is in English. When something is removed, its code, assets, comments and documentation pointers go in the same change.

## Related

- [[FRONTEND-GUIDE]]
- [[BACKEND-GUIDE]]
- [[TESTING-GUIDE]]
- [[CI-CD-AND-VERSION-CONTROL]]
- [[AI-WORKFLOW]]
- [[SECURITY-GUIDE]]

Back to [[INDEX]].

## Update this document when

- A lint rule is added, changed or waived.
- A convention changes.
