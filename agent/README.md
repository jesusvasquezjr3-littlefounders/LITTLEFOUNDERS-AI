# agent/ — The AI-Agent Environment

This directory makes agent sessions **iterative without context repetition**. The rule: context lives exactly once, everything else points to it.

## The no-context-repetition contract

| Kind of knowledge | Lives ONLY in |
|---|---|
| Product & architecture context | `agent/core/CONTEXT.md` |
| Operating rules & invariants | `/AGENTS.md` (== `/CLAUDE.md`) |
| Machine-usable code conventions | `agent/core/CONVENTIONS.md` |
| Human-sign-off boundaries | `agent/core/BOUNDARIES.md` |
| Per-service domain rules | `<service>/AGENTS.md` |
| Visual system | `/DESIGN.md` |
| Terminology | `/GLOSSARY.md` |

Templates and workflows carry **pointers with section anchors, never copied text**. If a prompt needs to re-explain the platform, that's a bug here — add a pointer, not prose.

## How the pieces compose

```
agent/
├── core/                 # canonical context + conventions + boundaries + checklists
├── tools/                # runnable bash gates and generators (no dependencies)
│   └── content/          # repair PUBLISHED lesson content without paying a provider
├── prompts/templates/    # task templates: inputs + "Read first" pointers + steps + acceptance
├── workflows/            # multi-step procedures chaining templates + tools
└── handoff/              # receipts from long content runs: work orders + per-order checkpoints
```

**`tools/content/` is the exception to "tools have no dependencies".** It is the
only tool directory that reads and writes PUBLISHED lesson documents, and the
constraint it exists to encode is a billing one: `speech_assets.speech_hash` is
sha256 over the NARRATED text (migration `0015`), so unchanged narration is a
guaranteed cache hit and one new narrated sentence is a paid DashScope call.
`gate.ts` refuses any repair that would spend money, importing Echo's own
`extractNarratables` so its idea of "narrated" cannot drift from what actually
gets synthesised; `applyOps.ts` takes edit OPERATIONS rather than rewritten
documents, so a field nobody named cannot be damaged. Read
`tools/content/README.md` before touching published content — it is authoritative
on which fields are free to rewrite and which are not.

**`handoff/` holds receipts, not instructions.** One checkpoint JSON per content
order, plus the work orders and inventories that produced them. They record what
a long run actually did, which is the only way a run that spans sessions or
machines can be resumed or audited. Nothing reads them at build time; they are
never authoritative over a document in §1.1.

**Starting a task:** find a matching template in `prompts/templates/` → fill its inputs → follow its "Read first" pointers → execute steps → verify acceptance criteria → run the pre-commit gates.

**Multi-step jobs** (new service, release, session end): follow the corresponding file in `workflows/`.

**Gates** (run from repo root):

```bash
npm run docs:check      # AGENTS.md == CLAUDE.md
npm run secrets:check   # no credentials in tracked files
npm run i18n:check      # 3-locale key parity
npm run deps:check      # pinned-major drift across the 8 packages
npm run test:all        # vitest in every service
npm run typecheck:all   # tsc --noEmit in every service
npm run lint:all        # eslint in every service
npm run release:readiness -- financial-education  # all gates + zero-spend course/audio dry-runs
npm run production:preflight                         # Railway inventory/config; read-only
npm run production:preflight:test                    # fake-Railway regression test; no remote access
npm run git:diff-check                               # tree matches HEAD — no diffs, no untracked files (run after repo:map)
npm run tools:test                                   # every agent/tools regression test (node --test)
```

`release:readiness` is the final local release-candidate check. It also
regenerates `repo_map.md` — deterministically: the stamp is the last commit
date and enumeration is git-aware, so a fully committed tree regenerates
byte-identically — and then fails on ANY working-tree or index diff or
untracked non-gitignored file (`git:diff-check`) — a stale regenerated
`repo_map.md` or uncommitted work both stop the gate — validates the
competency graph, and deliberately performs no deployment, migration,
publication, or paid API call.

`production:preflight` is an operator-only, read-only Railway check scoped to
one environment (default `production`). It lists required services, verifies
an active `RUNNING` instance — the scale-to-zero services (coursegen,
audiogen, picturegen, dataintel; DEPLOYMENT.md §6) may be asleep (no active
instances at all) and only WARN, while a crashed/failed instance hard-fails
for every service, allowlisted or not — and classifies required variables by
presence/state without printing their values (the no-secrets contract holds
even under `bash -x`); it must pass before the production migration handoff.

**Stamping a new service:** `bash agent/tools/new-service.sh <name> <port>` then follow `workflows/service-scaffold.md`.
