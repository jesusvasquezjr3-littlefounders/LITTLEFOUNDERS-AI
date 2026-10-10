---
title: Decision log
status: scaffold
updated: 2026-10-10
---

# Decision log

> Why things are the way they are: one short record per decision made by the owner.

> **Status: scaffold.** The structure is set; nothing below that is not marked as current state has been decided. Fill it in with the owner, then change the status to `draft` and, once approved, `accepted`.

## Role

Stops agents and humans from re-litigating settled questions or silently reversing them. Only decisions the owner has made are recorded; a proposal is not a decision.

## Read this when

- Before proposing a change that might contradict an earlier choice.
- After the owner decides something that has lasting effect.

## To define

- [ ] Entry format: ID, date, status (accepted or superseded), context, decision, consequences.

## Entries

### D-001: Restart from zero

Date: 2026-10-09. Status: accepted.

Everything of the previous version was deleted except the landing page, the 3D characters, the pinned Supabase setup and Pulse. Every feature is designed again with the owner. The previous version is the git tag `archive/pre-restart-2026-10-09`, kept for data migration and history only.

### D-002: Single branch, local commits

Date: 2026-10-09. Status: accepted.

Work happens on `main` only. Commits stay local until the owner pushes, because a push deploys.

### D-003: 3D files in Git LFS

Date: 2026-10-09. Status: accepted.

The Mentor character models in `glb/` and `frontend/public/scenes/` are tracked with Git LFS and must not be deleted or overwritten without the owner asking.

### D-004: Analytics

Date: 2026-10-09. Status: accepted.

Plausible, Umami and Google Analytics 4 stay, loaded only after consent.

### D-005: Security tooling

Date: 2026-10-09. Status: accepted.

The anti-slop lint rules and the Strix security skills and references are installed. Shannon and Strix themselves are not installed and the idea was cancelled.

### D-006: Documentation system

Date: 2026-10-09. Status: accepted.

Documentation lives under `docs/`, is written in English, is interlinked with Obsidian-style wikilinks, and is checked for links and freshness before every commit.

### D-007: Mandatory UI libraries

Date: 2026-10-09. Status: accepted.

The interface is built with seven libraries, non-negotiable: Bklit UI, Motion, Sileo, 000h by Cojeev, Bencho, Morphicons and Thinking Orbs. Where tokens or the stack had to change to fit them, they changed at once: the frontend moved to React 19, Tailwind CSS v4 and shadcn, and the hand-written design system was deleted and replaced. No other component, chart, toast, animation or icon-morph library is added without the owner. Details and rules: [[UI-LIBRARIES]] (accepted, with the per-library roles approved by the owner on 2026-10-09).

### D-008: Writing and design skills

Date: 2026-10-09. Status: accepted.

`humanizer` is the standing standard for every word a person reads (rule 12 in [[CLAUDE]]). `impeccable` and the taste-skill design skills are installed but run only when the owner invokes them. Understand-Anything and os-taxonomy were reviewed and not installed. Details and pinned versions: [[AI-WORKFLOW]].

### D-009: The five frontend rules

Date: 2026-10-09. Status: accepted.

Non-negotiable for every screen: (1) all text through i18n in en-US, es-MX and pt-BR, nothing hardcoded; (2) desktop and mobile each optimized, on clear grids; (3) text is never cut or overflowed; (4) the product's own audited icons for features and main actions, libraries for the rest; (5) design from evidence: the literature, graded, in [[RESEARCH-FOUNDATION]]. Rules and how they are checked: [[FRONTEND-GUIDE]].

### D-010: Frontend audit tools in the repository

Date: 2026-10-09. Status: accepted.

The frontend audit scripts (accessibility, keyboard, layout, grid, scene framing, color, screenshots) live in `frontend/tools/audit/` as developer tools, run by hand with `npm run audit:*`. They are not a CI gate and not a test suite, so rule 5 in [[CLAUDE]] (no test suites or gates unless the owner asks) stands for those. Method and thresholds: [[FRONTEND-TOOLKIT]].

### D-011: Every route path is in English

Date: 2026-10-09. Status: accepted.

Every route path in the platform is in English, whatever the interface language: `/sign-up`, never `/crear-cuenta`. Only the words on screen are translated ([[FRONTEND-GUIDE]] rule 1). Sign-in is not a page: it is a window opened from the topbar, and its actions read their destinations from `frontend/src/lib/authRoutes.ts`, which holds placeholders until the first application routes exist.

### D-012: Rules for character compositions

Date: 2026-10-09. Status: accepted.

Scenes with the characters follow one set of rules (true scale with Dina large, bright light in both modes, no visible edges, no collisions, delivered as video, rendered from the artist sources, at most 30 % of a window's height), written in [[CHARACTER-COMPOSITIONS]], and are rendered with the tools in `frontend/tools/render/`. `three` is a development dependency for those tools only.

### D-013: The platform is for ages 12 to 18

Date: 2026-10-09. Status: accepted.

The owner set the product audience at 12 to 18 years old, final: 12 is the youngest age served, not 13. The platforms the product is compared with (Scratch, Code.org, Khan Academy) let teenagers from 13 manage their own account and require a parent or guardian for younger children, so the sign-up of 12-year-olds is a design item (T-020), not a reason to move the line. The landing says "ages 12 to 18" and the first skill starts at 12. How sign-up handles age is in D-025. Children under 12 are not served until the owner designs a different registration process, after looking at how existing learning platforms register young users. Legal inputs the owner supplied (not yet confirmed with counsel) are recorded in [[CHILD-SAFETY-AND-PRIVACY]].

### D-014: The mail service is restored

Date: 2026-10-09. Status: accepted.

The previous version's mail service (`email-server/`, called Courier: an Express HTTP API and a Haraka SMTP relay to Amazon SES) is restored from the archive tag because it was working in production, and rebuilding it would cost time in tests and in environment variables, locally and in production. It exceeds the "restart from zero" rule on purpose, as the Supabase and Pulse setups did. What came back is the service, its two workflows and the local `.env` (from the saved copy; not tracked). What did not: the `email_logs` migration (the database has no schema, so history is kept in memory until it is recreated), the authentication email templates and their translated texts (T-021), and anything that called the service. Comments that pointed at removed code were corrected.

### D-015: Character avatars are an own SVG rig

Date: 2026-10-10. Status: accepted.

The in-product avatars of Rho, Zara, Liruf and Dina are layered 2D vector drawings (head and shoulders) with named parts, moved by a small own rig and a React component (`frontend/src/features/avatars`), not by Rive or dotLottie, not in 3D and not from video. The owner approved the likeness and chose the floating-avatar use. Details, tools and limits: [[CHARACTER-AVATARS]]. The 3D shape of each character (viewed turned) governs every drawing.

### D-016: Universal frontend behaviors

Date: 2026-10-10. Status: accepted.

The owner defined eleven behaviors that every page has, not only the landing: smooth animation on scroll, button micro-interactions, hover states, a custom favicon, a back-to-top button, a loading screen and skeletons, transitions between pages, speed optimization, a custom 404 page, breadcrumbs and a fixed call to action on phones (Sign in, because it is the quickest). The favicon is the compact logo. The 404 page is a composition with Rho and Liruf kneeling back to back, small in the frame, heads low, under a small red "Error 404" with a warning mark, with a plain sentence and one button to `/`. The rules and where each lives are in [[FRONTEND-GUIDE]] ("Interaction, motion and page furniture"); the 404 scene is in [[CHARACTER-COMPOSITIONS]].

### D-017: The loading window

Date: 2026-10-10. Status: accepted.

Inside the platform, a wait is shown in a window like the sign-in window (Cojeev's Dialog surface, the product's tokens; no glass, no percentage): a bar that fills from empty to 80 % in two seconds and holds, a character running on the bar's leading edge, and one word under it in bold capitals. The four characters run it. The runner is an AVIF sprite sheet per character and per color mode (8 files, 26 to 52 KB each), not 24 baked animations, because the word, the window and the colors are live. The owner chose the format after seeing the measurements and approved the four previews. Details, the measurements and the references: [[FRONTEND-GUIDE]], "The loading window".

### D-018: The reference mapping is the input for product decisions

Date: 2026-10-10. Status: accepted.

The owner mapped six learning products (Mimo, Brilliant, Duolingo, Finanz, GoHenry, Astra AI) in the private repository `LittleFounders-AI/reference-mapping-for-littlefounders` and the first product decisions (D-019 to D-026) come from reading it in full. It is a reference, not a specification: its evidence is uneven (the two finance products were mapped from public pages only), so a pattern taken from it is named with the product it came from, and nothing time-based or server-side in it is treated as a known rule.

### D-019: A mistake is never punished

Date: 2026-10-10. Status: accepted.

A wrong answer is treated as part of learning, in words and in mechanics. The reference for the tone is Brilliant ("If you're not making mistakes, you're not learning"). No mechanic limits learning because of mistakes: no lives, hearts, energy or waiting time, and nothing is sold or earned back to keep learning after an error.

### D-020: One primary button per screen

Date: 2026-10-10. Status: accepted.

Every screen has a single primary button, and it stays disabled until the person has given an answer.

### D-021: Value before data

Date: 2026-10-10. Status: accepted.

Choosing to join shows the whole onboarding before any account is asked for. The experience is immersive and low in cognitive load, and a person sees the value within the first 5 to 10 seconds of using the platform. Registration is never presented as a requirement: it is the way to keep progress permanently and to reach advanced functions.

### D-022: Rewards arrive one idea per screen

Date: 2026-10-10. Status: accepted.

After a lesson, each reward has its own screen, in order: lesson completed, then streak, then goal, then league. What each of those is (rules, numbers, and what a league shows about other people) is designed with its feature.

### D-023: No commercial pressure, and a free layer for everything

Date: 2026-10-10. Status: accepted.

Every product of the platform is available for free through a free layer. Advanced functions (the AI, advanced family functions) will sit behind a paywall, and the paywall is built only once the product is declared ready in its first version. Nothing pressures a person to pay: no countdowns, no repeated offers, no offer placed in the way of learning.

### D-024: The currency is Seeds

Date: 2026-10-10. Status: accepted.

The official currency of LittleFounders is Seeds ("Semillas" in Spanish). How Seeds are earned and used is designed with the features that need them; they never represent real money (rule 8 in [[CLAUDE]]). The term is in [[GLOSSARY]].

### D-025: Self-declared permission at sign-up

Date: 2026-10-10. Status: accepted.

The product is aimed first at people aged 12 and over (D-013). So that a younger person who signs up meets no friction, the age step uses a self-declared checkbox like Astra AI's ("I confirm I have my parent's or guardian's permission") instead of a verified parental-consent process. This answers the sign-up part of T-020. Open with the owner: the age below which the checkbox appears, and whether it also admits children under 12, whom D-013 does not serve. To confirm with counsel before production: a self-declared checkbox is not verifiable parental consent, which some regimes require for the youngest users ([[CHILD-SAFETY-AND-PRIVACY]]).

### D-026: Finance content comes later

Date: 2026-10-10. Status: accepted.

No finance content is written yet. It is made later, as the functionality is developed one feature at a time.

## Related

- [[RESEARCH-FOUNDATION]]
- [[GLOSSARY]]
- [[CHILD-SAFETY-AND-PRIVACY]]
- [[UI-LIBRARIES]]
- [[PRODUCT-REQUIREMENTS]]
- [[ARCHITECTURE]]
- [[SYSTEM-DESIGN]]
- [[IMPLEMENTATION-PLAN]]
- [[AI-WORKFLOW]]

Back to [[INDEX]].

## Update this document when

- The owner makes a decision with lasting effect, or reverses one.
