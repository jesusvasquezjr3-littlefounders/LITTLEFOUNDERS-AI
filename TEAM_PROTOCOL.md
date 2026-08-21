# TEAM_PROTOCOL.md — Skills & Session Rituals

## Session lifecycle

1. **Start** — run the preflight checklist (`agent/core/checklists/preflight.md`).
2. **Assess** — trivial task? Do it directly. Matches a template? Start from `agent/prompts/templates/`.
3. **Propose** — team-mode/opt-in skills are PROPOSED with rationale, never auto-run. The human decides.
4. **Work** — always-on design skills fire automatically on UI work.
5. **End** — run `agent/workflows/doc-sync.md`. Every session. No exceptions.

## Skill catalog & tiers

Skills live in `.claude/skills/` (and mirrored in `.github/skills/`). Both are
untracked by default; a skill the team wants versioned gets a scoped
`!`-negation in `.gitignore` / `.github/.gitignore` instead (see Rules).

### Always-on — design (auto-invoke on any UI task)

| Skill | Use |
|---|---|
| `impeccable` | Design/redesign/audit/polish any frontend surface; subcommands (craft, shape, audit, polish, animate…) |
| `agave` | Senior-designer instincts: hierarchy, color intent, spacing rhythm, restraint |
| `emil-design-eng` | Design-engineering judgment; writing motion code |
| `make-interfaces-feel-better` | Polish details: text-balance, tabular-nums, concentric radius, hit areas |
| `react-bits` | Animated React component patterns |
| `review-animations` | ONLY when reviewing motion code (high bar; approval is earned) |
| `design-md` | When writing/auditing DESIGN.md itself |

### Opt-in — propose first, human decides

| Skill | Use |
|---|---|
| `ponytail` | Minimal-diff / YAGNI lens. Recommended default for most coding tasks. |
| `graphify` | Codebase knowledge-graph questions/mapping. |
| `caveman` | Ultra-terse "caveman-speak" replies (`/caveman lite\|full\|ultra\|off`) when the human wants fewer output tokens. Exempts code/commits/docs/PR text — stays normal prose there. **Tracked** (see Rules). |

### Reference shelf

| Skill | Use |
|---|---|
| `ecc` | Context-engineering reference. |
| `claude-for-legal` | Legal workflows — outputs are drafts for attorney review, never legal advice. |
| `claude-for-legal-mexico` | Mexican-jurisdiction extension of the above (LFPDPPP, IMPI, SAT…). |

## Rules

- **Attribution:** every borrowed skill keeps a `_SOURCE.md` (author, license, adaptation note). Unlicensed upstreams get reimplemented, never vendored.
- **Double install:** a skill added to `.claude/skills/` is copied to `.github/skills/` (both untracked by default; `.claude/archive/github-skills/` holds the backup).
- **Untracked by default, on purpose.** Two of the reference-shelf skills (`claude-for-legal`, `claude-for-legal-mexico`) vendor entire third-party repos with their own licenses/CLAs — committing those into a private company repo without a deliberate redistribution review is the wrong default. Blanket-tracking `.claude/skills/` was considered and rejected for this reason (2026-08-20).
- **Tracking one skill anyway:** when a specific skill is small, permissively licensed (MIT or equivalent), and the team wants it versioned, carve out a scoped exception instead of flipping the blanket rule — in both `.gitignore` and `.github/.gitignore`:
  ```
  .claude/*
  !.claude/skills/
  .claude/skills/*
  !.claude/skills/<name>/
  ```
  Gitignore won't re-include a file whose parent directory is itself excluded, so each level needs its own `!`-negation — verify with `git check-ignore -v` on both the intended path and a sibling skill before trusting it (a single blanket `.claude/` rule elsewhere in the file will silently shadow this and re-hide everything; `caveman`'s install found and removed exactly that duplicate). `caveman` (MIT) is the first skill tracked this way.
- **Design skills refine, DESIGN.md defines.** Skills never override tokens/rules in DESIGN.md.
- **New skill installed** → add it to this catalog in the same commit (stewardship §8).
