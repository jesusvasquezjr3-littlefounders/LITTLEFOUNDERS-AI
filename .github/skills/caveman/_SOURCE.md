# Source

- **Skill:** `caveman` — ultra-compressed communication mode (terse "caveman-speak"
  responses; ~65% fewer output tokens vs. an unprompted baseline, per upstream's
  measured benchmark table).
- **Upstream:** https://github.com/JuliusBrussee/caveman — skill payload vendored
  from `skills/caveman/` at the commit current as of the install date below.
- **Author:** Julius Brussee (https://github.com/JuliusBrussee).
- **License:** MIT — covers the skill itself (upstream's README lists "the skill"
  under its MIT-licensed surfaces). The repo's Proxy/Engine/Browse/cavemem
  components are separately BSL-1.1-licensed and were **not** installed here.
- **Installed:** 2026-08-20. `SKILL.md` and `README.md` vendored verbatim,
  unmodified.

## Scope — what was NOT installed

Upstream `caveman` is a large multi-product monorepo. Only the flagship
`caveman` skill (this directory) was installed. Deliberately excluded:

- ~19 companion skills/subagents bundled in the same repo (`caveman-commit`,
  `caveman-review`, `caveman-learn`, `cavecrew-investigator/builder/reviewer`,
  etc.) — not requested, not reviewed.
- The Claude Code **plugin** path (`.claude-plugin/`), which wires
  `SessionStart` and `UserPromptSubmit` **hooks** running JS on every session/
  prompt and touches global `~/.claude/settings.json`. This project installs
  skills locally per-project only — no global config, no hooks.
- **Caveman Proxy** (`@caveman-ai/cli`, npm-global, BSL-1.1) — a local proxy
  that intercepts and rewrites provider (Anthropic API) traffic. Separate
  product, not a skill, not installed.
- **`caveman browse`** — a compiled Go binary doing Chrome DevTools Protocol
  browser automation. Not installed.
- The "convert skills to PNG images" feature, which rewrites *other* installed
  skills' `SKILL.md` bodies in place. Not installed, not run.

## Behavior note

Per `SKILL.md`'s own "Boundaries" section, caveman mode already exempts
persisted/external content (code, comments, commit messages, docs, issue/PR
text) from compression — normal prose is used there regardless of mode. This
is compatible with `/AGENTS.md` §1.0.4's detailed-commit-message requirement;
no conflict found.
