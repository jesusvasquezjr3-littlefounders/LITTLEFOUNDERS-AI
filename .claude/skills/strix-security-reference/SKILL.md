---
name: strix-security-reference
description: Security review checklists for LittleFounders code. Use when designing or reviewing Supabase row-level security, authorization, sessions and tokens, file uploads, rewards or ledger logic, or the AI tutor's prompt-injection surface.
---

# Security reference

Checklists from the Strix project (Apache-2.0, see `LICENSE`), written for an attacker's workflow. Use them as the attacker's view when reviewing our own design and code, before and after building a feature.

Read only the files the task touches:

| Task | Read |
|---|---|
| Supabase tables, policies, storage, Realtime, keys | `references/supabase.md` |
| Who can read or change another user's data | `references/idor.md`, `references/broken_function_level_authorization.md`, `references/mass_assignment.md` |
| Rewards, balances, any state machine | `references/business_logic.md`, `references/race_conditions.md` |
| Login, sessions, tokens, social sign-in | `references/authentication_jwt.md`, `references/oauth.md`, `references/csrf.md` |
| Inputs and outputs | `references/xss.md`, `references/sql_injection.md`, `references/ssrf.md`, `references/insecure_file_uploads.md`, `references/information_disclosure.md` |
| AI tutor and any agent | `references/llm_applications.md`, `references/llm_prompt_injection.md`, `references/agentic_system_security.md` |
| Judging a finding | `references/counterevidence.md`, `references/severity_calibration.md` |

## Adapt, do not copy

- Our product represents no real money. Read "payment" as the rewards ledger and any balance-like value.
- The users are minors. These files have no guidance for minors' personal data, age-appropriate output or grooming: apply the stricter reading and raise it with the owner.
- We use a Vite single-page app and self-hosted Supabase. Ignore the Next.js, NestJS and FastAPI material unless the backend later uses it.
- Run exploit payloads only in a disposable stack with synthetic data (`docs/security/ai-pentesting.md`).
