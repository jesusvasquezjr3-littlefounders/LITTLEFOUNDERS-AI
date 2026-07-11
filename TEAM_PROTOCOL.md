# TEAM_PROTOCOL.md — Skills & Session Rituals

## Session lifecycle

1. **Start** — run the preflight checklist (`agent/core/checklists/preflight.md`).
2. **Assess** — trivial task? Do it directly. Matches a template? Start from `agent/prompts/templates/`.
3. **Propose** — team-mode/opt-in skills are PROPOSED with rationale, never auto-run. The human decides.
4. **Work** — always-on design skills fire automatically on UI work.
5. **End** — run `agent/workflows/doc-sync.md`. Every session. No exceptions.

## Skill catalog & tiers

Skills live in `.claude/skills/` (and mirrored, untracked, in `.github/skills/`).

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

### Reference shelf

| Skill | Use |
|---|---|
| `ecc` | Context-engineering reference. |
| `claude-for-legal` | Legal workflows — outputs are drafts for attorney review, never legal advice. |
| `claude-for-legal-mexico` | Mexican-jurisdiction extension of the above (LFPDPPP, IMPI, SAT…). |

## Rules

- **Attribution:** every borrowed skill keeps a `_SOURCE.md` (author, license, adaptation note). Unlicensed upstreams get reimplemented, never vendored.
- **Double install:** a skill added to `.claude/skills/` is copied to `.github/skills/` (both untracked; `.claude/archive/github-skills/` holds the backup).
- **Design skills refine, DESIGN.md defines.** Skills never override tokens/rules in DESIGN.md.
- **New skill installed** → add it to this catalog in the same commit (stewardship §8).
