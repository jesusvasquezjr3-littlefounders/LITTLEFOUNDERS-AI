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
├── prompts/templates/    # task templates: inputs + "Read first" pointers + steps + acceptance
└── workflows/            # multi-step procedures chaining templates + tools
```

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
```

**Stamping a new service:** `bash agent/tools/new-service.sh <name> <port>` then follow `workflows/service-scaffold.md`.
