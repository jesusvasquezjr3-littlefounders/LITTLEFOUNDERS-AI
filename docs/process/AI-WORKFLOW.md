---
title: AI development workflow
status: scaffold
updated: 2026-10-09
---

# AI development workflow

> How AI agents and humans work together on this repository.

> **Status: scaffold.** The structure is set; nothing below that is not marked as current state has been decided. Fill it in with the owner, then change the status to `draft` and, once approved, `accepted`.

## Role

The operating manual for agents beyond the short rules in [[CLAUDE]]. It sets what to read first, how a task proceeds from requirement to merged change, and what an agent must never do on its own.

## Read this when

- Starting any task.
- Delegating to a subagent.
- Reviewing agent output.

## To define

- [ ] Context loading order: [[CLAUDE]], then [[INDEX]], then the guides relevant to the task.
- [ ] Task protocol: confirm scope, read the requirements document, plan, implement, verify, update documents, commit.
- [ ] Definition of done.
- [ ] When to use subagents and how to brief them; independent verification.
- [ ] What agents must never do: invent requirements, push, skip checks, write outside scope.
- [ ] How uncertainty is raised to the owner.
- [ ] Installed agent skills and when each applies.
- [ ] What belongs in agent memory versus in the repository.

## Current state

- Installed skills are in `.claude/skills/`: anti-slop installer, Strix security skills and the security reference. [[CLAUDE]] and [[AGENTS]] are the same file.

## Related

- [[CLAUDE]]
- [[AGENTS]]
- [[INDEX]]
- [[BUILD-TASKS]]
- [[IMPLEMENTATION-PLAN]]
- [[CODE-STYLE-GUIDE]]
- [[TESTING-GUIDE]]
- [[CI-CD-AND-VERSION-CONTROL]]
- [[ai-pentesting]]

Back to [[INDEX]].

## Update this document when

- The way agents are expected to work changes.
- A skill is added or removed.
