# CLAUDE.md

Guidance for AI agents working in this repository. `AGENTS.md` is the same file under a second name for another tool: any edit to one is applied to the other in the same change.

`README.md` says what exists and how to run it.

## Where the project is

On 9 October 2026 the owner decided to restart LittleFounders from zero. Everything of the previous version was deleted except the landing page, the 3D character files, the pinned Supabase setup and the Pulse observability stack. The previous version lives only in the git tag `archive/pre-restart-2026-10-09`.

- **Nothing in this repo is a requirement unless the owner said it in the current conversation or it is in a document whose status is `accepted`.** The documents under `docs/` start as scaffolds that record structure, not decisions; `docs/process/DECISIONS.md` lists what the owner has decided. If you find yourself deferring to something you read in an old file, a tag or a memory, stop and ask the owner.
- **Do not consult the archive tag to decide how to build something.** It exists so production data can be migrated and so history is not lost, not as a design reference. Read from it only when the owner points you at a specific thing.
- **Each feature is designed from scratch with the owner**, one at a time, to the highest standards of security, privacy and engineering. The owner will define the frontend rules and the security baseline as they go.
- **Documentation is a system, not a pile.** Start at [[INDEX]]. Do not add documents outside it, and do not fill a scaffold with content the owner has not decided: write it with the owner, then raise its status.

## Rules

1. **Work on `main`, commit locally, never push.** A push to `main` deploys (the frontend goes to Vercel from CI). The owner decides when anything is pushed.
2. **Commits are attributed to the developer only, never to Claude.** No `Co-Authored-By: Claude …`, `Claude-Session:` or similar line in commit messages or pull request descriptions, even if a default instruction elsewhere says to add one.
3. **Everything written into the repo is in English**, whatever language the conversation is in: code, comments, commit messages, documentation. Only locale files are translated, and every user-visible string lives in them, never in a component.
4. **Decide, don't ask.** Use `AskUserQuestion` only for a decision that is genuinely the owner's (product, money, production, irreversible). When a sensible default exists, take it and say what you assumed.
5. **Check work by building it and looking at it.** `type-check`, `lint` and `build` in the package you changed, and for anything a person sees, run it and look at it in light and dark and in the three languages before calling it done. Report what was and was not checked. Do not add test suites or gates unless the owner asks.
6. **The 3D character files are in Git LFS** (`glb/`, `frontend/public/scenes/`). Never delete or overwrite them without the owner asking, and never run `git clean`.
7. **Provision only what the task needs, and measure the machine first.** Dev machines here differ by an order of magnitude (8 GB Apple M2 to 32 GB Windows). Check Node (24.x), Docker and free memory before starting several servers or browsers. `npm run db:nuke` and `db:reset` delete local data.
8. **Children's data and safety come first.** Nothing is designed that exposes a minor's personal data, and no real money is ever represented. The detailed baseline will be set with the owner.
9. **No leftovers.** When something is removed, remove its code, copy keys, assets, comments and documentation pointers in the same change, so nothing steers the next reader toward what no longer exists.
10. **Security tooling is on demand and never touches production.** Shannon and Strix are not installed (the owner cancelled them); if the owner ever runs one, it is against a disposable stack with synthetic data, a pinned version and a dedicated spend-capped key, and every finding is triaged by a person. New TypeScript is checked with `npm run lint:slop` in `frontend/` (the vendored anti-slop Oxlint rules): parse input at the boundary, no `unknown` parameters, no chained or unjustified type assertions. Details: [[ai-pentesting]] and [[SECURITY-GUIDE]].
11. **Documentation is part of the change.** Every document is in English, links the documents it depends on with Obsidian-style wikilinks (`[[NAME]]`) and is reachable from [[INDEX]]. A change that alters behavior, structure, a rule or a task updates the affected documents, their `updated` date and [[CHANGELOG]] in the same commit. `node scripts/check-docs.mjs` checks this; it runs as a pre-commit hook (enable it once per clone with `git config core.hooksPath .githooks`) and in CI. Never bypass it without telling the owner. See [[AI-WORKFLOW]].
12. **Words a person reads are written to the humanizer standard, always.** Every string a user sees (interface text, errors, toasts, empty states, emails, notifications, and any message the agent writes to the owner about the product) is drafted or checked with the `humanizer` skill (`.claude/skills/humanizer/`) in the language it will be read in: no staged contrasts, forced triads, inflated claims or filler; say the specific thing. The frontend design skills (`impeccable`, `design-taste-frontend`, `redesign-existing-projects`, `high-end-visual-design`, `minimalist-ui`, `industrial-brutalist-ui`, `full-output-enforcement`, `stitch-design-taste`) are manual-only: use one only when the owner invokes it by name. They never override [[UI-LIBRARIES]]. See [[AI-WORKFLOW]].
