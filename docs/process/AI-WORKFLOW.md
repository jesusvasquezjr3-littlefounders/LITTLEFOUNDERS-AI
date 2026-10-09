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
- [x] Installed agent skills and when each applies: the frontend ones in [[FRONTEND-TOOLKIT]], the versions and licences below.
- [ ] What belongs in agent memory versus in the repository.

## Current state

- Installed skills are in `.claude/skills/`: anti-slop installer, Strix security skills and the security reference, and the writing and design skills below. [[CLAUDE]] and [[AGENTS]] are the same file.
- **Always on, for words a person reads:** `humanizer` (MIT, blader/humanizer, commit `225a6f3`, version 3.1.0). Rule 12 in [[CLAUDE]] makes it the standard for every interface string and every message to a user, in all three languages.
- **Manual only, used when the owner names them:** `impeccable` (Apache 2.0, pbakaus/impeccable, commit `d631a88`, version 4.5.2), and from taste-skill (MIT, leonxlnx/taste-skill, commit `18dfc92`): `design-taste-frontend`, `redesign-existing-projects`, `high-end-visual-design`, `minimalist-ui`, `industrial-brutalist-ui`, `full-output-enforcement`, `stitch-design-taste`; and `layout-grid` (MIT, owl-listener/designer-skills, MC Dean, commit `9a6930c`; added 2026-10-09 at the owner's request for layout and grid work). Each has `disable-model-invocation: true` added to its front matter (the only change to the upstream files). They never override [[UI-LIBRARIES]] or [[DESIGN-SYSTEM]].
- **How the third-party skills were taken:** only the skill folders; Impeccable's hooks (which run on every edit and stop) and its four subagent definitions were not installed, and the image-generation and GPT-specific taste skills and the v1 skill were left out. Impeccable's launcher (`scripts/impeccable`) downloads its engine binary from the project's GitHub releases on first use and checks it against a published SHA-256; that happens only when the owner invokes it. First use (2026-10-09, landing copy): Impeccable's launcher was not run, because it downloads and executes an external binary; the agent read the project context directly, as the skill allows, and used its `clarify` and `typeset` references. The tool refuses to let the agent invoke `design-taste-frontend`, so that pass is run by the owner. Understand-Anything (a code knowledge-graph plugin) and os-taxonomy (a children's curriculum dataset, not a skill) were reviewed and deliberately not installed.

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
