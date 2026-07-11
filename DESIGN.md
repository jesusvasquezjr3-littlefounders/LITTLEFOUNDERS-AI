# DESIGN.md — LittleFounders Frontend Design System

> **⚠️ SKELETON.** The authoritative visual spec will be derived from a mockup the team will provide. Until then: **do not invent tokens.** Use plain Tailwind defaults, keep components structurally clean, and flag every new UI surface with `// DESIGN: pending re-skin` so the re-skin pass can find them.
>
> When the mockup lands, this file will be rewritten using the `design-md` skill format (YAML front-matter tokens + prose rationale).

## What is already locked (build against these today)

- **Modes:** light AND dark are both first-class. Tailwind `darkMode: 'class'`. Every component styles both at write time — never ship light-only.
- **i18n:** `en-US`, `es-MX`, `pt-BR`. Layouts must tolerate ±35% string length; never bake text into images.
- **Characters:** the canonical mascots are **Dina, Dino, Dr. Rho, Zara Vex** (`frontend/src/components/characters/`). They are SVG React components — reuse them; do not create new mascots without sign-off.
- **Avatars:** DiceBear, `avataaars` style. Profile customization builds on DiceBear options — no custom avatar engine.
- **Accessibility floor:** WCAG 2.1 AA. Kid-readable type (generous sizes, high contrast), ≥44×44px hit areas, visible focus states, `prefers-reduced-motion` respected.
- **Motion discipline (carried from v1, still applies):** no `transition: all` — transition exact properties only; `will-change` only on `transform`/`opacity`/`filter`.

## To be defined by the mockup (placeholders — DO NOT GUESS)

| Section | Status |
|---|---|
| Design tokens: color palette (light + dark ramps) | TBD |
| Typography scale & families | TBD |
| Spacing rhythm & radius system | TBD |
| Component library (buttons, cards, inputs, nav) | TBD |
| Brand voice in UI copy (per locale) | TBD |
| Per-section personality — learn / tutor / games / tasks / profile | TBD |
| Kid-facing vs parent-facing surface differentiation | TBD |
| Illustration & character usage rules | TBD |

## Working rules while this is a skeleton

1. Structure > style: build components with correct semantics, i18n, dark-mode wiring, and a11y — visual polish comes with the re-skin.
2. Tailwind defaults only; no raw hex values, no custom CSS files per component.
3. Design skills (`impeccable`, `agave`, `emil-design-eng`) still apply for hierarchy/spacing/motion judgment — they refine execution, they don't define tokens.
