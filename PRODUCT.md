# PRODUCT.md — LittleFounders (skill-facing summary)

> Strategic context for design tooling. Canonical sources (never duplicate,
> always defer): `agent/core/CONTEXT.md` (product/architecture),
> `GLOSSARY.md` (terms), `ROADMAP.md` (scope), `DESIGN.md` (visual system —
> AUTHORITATIVE, root AGENTS.md §1.1 rank 4).

## Register

product — app UI (design serves the product). Marketing pages exist but the
platform surface (auth, dashboard, learn/tutor/tasks/profile) is the
primary register.

## Who / What / Why

Financial-literacy learning platform for families. Kids learn money skills
through gamified courses and an AI tutor; parents (Tutors) manage
kid accounts, assign real-world tasks with rewards, and keep full visibility.
Six roles; everyone signs up as `universal` (zero friction), upgrades are
verification-gated (Guardian service). Locales: en-US, es-MX, pt-BR. Light +
dark, desktop + mobile — all four are product invariants.

## Brand personality

"LittleFounders Arcade" — premium learning game: Brilliant.org-style clarity,
one loud papaya CTA per view, extrabold tight Figtree headlines, pills and big
radii, liquid-glass floating chrome. Minimal by default; color is spent on
meaning, never decoration. Kid-friendly without being childish.

## Anti-references

Corporate fintech navy-and-gold; SaaS cream landing kits; dark-pattern
gamification (no streak-shaming, no manipulative urgency — COPPA-minded,
/AGENTS.md §1.9); clip-art kid-app rainbow noise.

## Strategic principles

1. DESIGN.md is law — closed token sets; skills refine execution, never
   override tokens (/AGENTS.md §4).
2. Trust surfaces (auth, verification, parent controls) read calm and safe:
   clear copy, honest errors, no tricks.
3. Every string i18n'd ×3 locales; every screen verified at ~375px and
   ~1280px in both themes before done.
