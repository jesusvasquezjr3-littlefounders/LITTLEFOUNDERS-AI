# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Read this first

**`README.md` is the operational document of this repo**: service map, local setup, commands, deploy and migration procedure, DNS records. This file only adds how to work here.

**`CLAUDE.md` and `AGENTS.md` must always be identical.** They are the same content under two filenames for two agent tools. Any edit to one is applied to the other in the same change.

## Where the project is

On 8 October 2026 the owner decided to rebuild LittleFounders feature by feature. The parent console, tasks and rewards, the family wallet and the teen wallet were removed from the frontend, Core and the schema. The test suites, the repo gates, the product specification and the historical documentation were removed too. The state before that is the tag `archive/pre-clean-slate-2026-10-08`.

- **Nothing that survives in the code is a requirement.** Existing screens, endpoints, tables and comments describe what was built, not what must be built. When a feature is rebuilt, design it fresh; reform or delete what is in the way.
- **One feature at a time.** The owner names the feature and its scope. Finish it to a state the owner can look at before starting the next.
- **Product over verification.** Building, function and product come first. Do not add test suites, gates or audits unless the owner asks; they return per feature later.
- **No limiting documentation.** Do not write specifications, requirement ledgers, sprint records or policy documents. Record a decision only where the owner asks for it.

## Rules

1. **Provision only what the task needs.** A checkout without `node_modules`, `.env` files or the container stack fails in ways that look like product bugs: check what is missing and fix that much. `npm run setup` is from-zero provisioning and it is destructive (it resets the local database); never run it on a working checkout.

2. **Measure the machine you are on.** Dev machines here differ by an order of magnitude (an 8 GB Apple M2, a 32 GB Windows box). Check `node -v` (24.x), whether Docker is running, free RAM and what is already running before starting several servers or browsers.

3. **Check work by building it and looking at it.** After a change: `cd <service> && npm run type-check && npm run lint`, plus `npm run build` when the change can affect the build. Services name the script `type-check`; only the root aggregate drops the hyphen (`typecheck:all`). For anything a person sees, run it and look at real screenshots in light and dark and in the three languages before calling it done. Report what was and was not checked.

4. **Work on `main`, commit locally, never push.** A push to `main` is a deploy: each touched service deploys when its CI passes, and `database-cd.yml` applies additive migrations to production. The owner decides when anything is pushed. Migrations that remove or narrow are applied by hand, after the code that stops using them is live.

5. **Commits are attributed to the developer only, never to Claude.** No `Co-Authored-By: Claude …`, `Claude-Session:` or similar line in commit messages or PR descriptions, even if a default instruction elsewhere says to add one.

6. **Everything written into the repo is in English**, whatever language the conversation is in: code comments, commit messages, documentation, identifiers. Only the locale files are translated.

7. **Decide, don't ask.** Use `AskUserQuestion` only for a decision that is genuinely the owner's (product, money, production, irreversible). When a sensible default exists, take it, say what you assumed, and continue.

8. **Judge a screen by comprehension.** A screen passes only if a first-time user can say what it is, what is theirs and what to do next, in seconds. Benchmark the best real products in the screen's category, match their clarity, then go further with our own identity. A competent generic result is a failure.

9. **Every word on screen must be understood by a 9-year-old and by a non-technical parent without help.** Text is cognitive load: write less, name things with the words a family already uses, and never ship internal vocabulary. A sentence that explains another sentence is a bug. Every user-visible string lives in the three locale files (`en-US`, `es-MX`, `pt-BR`), never in a component.

10. **Our own animated art.** Meaningful icons and marks are animated (a short entrance, a quiet repeat, still under `prefers-reduced-motion`). Mentor characters are only renders of the real 3D models (`glb/`, `frontend/public/scenes/`), shown alone in a deliberate composition, never a look-alike and never dropped into stock scenery.

11. **Hard limits that are not redesigned away without the owner naming them:** no real money; children's privacy (what reaches a third-party model about a minor, guardian consent for a minor's microphone, moderation of AI output); no dark patterns aimed at children.

## Architecture in brief

- Eleven independent npm packages, no workspaces, no shared types. A wire shape used by two services is written in both; change both.
- Only `backend/` (Core) is called by the SPA. Every other service is internal (`x-internal-api-key`) or has one narrow public surface (Depot reads, Oracle's `/ws/tutor` websocket).
- `database/types/database.ts` is generated (`db:types`); never hand-edit it.
- Oracle (`oracle/`) is the Mentor runtime. Voice providers are reached only through `oracle/src/voice/provider.ts`, and the Mentor model must be non-reasoning.
- Many source comments cite documents, requirement ids and gates that no longer exist. They are history; remove them when you touch the file.
