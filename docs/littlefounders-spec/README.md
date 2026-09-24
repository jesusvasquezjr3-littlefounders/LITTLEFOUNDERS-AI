# LittleFounders: Product and Frontend specification (import package, 21 September 2026)

This folder is the **final output of the September 2026 product and frontend work**: the binding owner decisions, the product requirements, the Frontend Bible, the reference mockup, and the audit tools. It is written in English because it feeds the AI frontend agent (Codex) and the engineering team.

**Everything here is binding.** "Non-negotiable" means that a finding or rule must be satisfied. Where a requirement leaves a detail open, the document names who decides and when.

---

## 1. Which document wins (precedence)

When two documents disagree, the higher one wins. Inside the Frontend Bible, a chapter written for a specific subject (`05` teaching visuals, `06` copy, `07` assets, `08` Mentor stage) refines the general rules of `02` on that subject, and `02` points to it.

1. **`product/13-OWNER-DECISION-LOG.md`**: the owner's decisions OD-1 to OD-17.
2. **`product/10-PRODUCT-GOLD-STANDARD-REQUIREMENTS.md`** and its appendices `10-APPENDIX-A` to `P`: what the product must do.
3. **`frontend/frontend-bible/02-FOUNDATIONS.md`**, then the other Bible chapters (`01`, `03`–`08`): how every screen looks, reads and moves.
4. **`frontend/mockup/littlefounders-mockup.html`**: a visual reference only, minus everything listed in `frontend/mockup/KNOWN-DEVIATIONS.md`. It is not the scope and not the information architecture.
5. **`product/reviews/`**: historical records, for traceability only. Never implement from them.

Sources outside this package that these documents rely on, and that stay the source of truth for their own subject:

- the product audit files `00-EXECUTIVE-SUMMARY.md` to `09-CONFIGURATION.md`, which describe the **legacy** platform (the "Current State" of every requirement);
- `COSMIC_NARRATIVE.md` (the brand narrative and the approved brand lines);
- the **3D Mentor characters** (Dr. Rho, Zara, Liruf, Dina), the **Diorama** and the **pose catalogue**, all in the project folder.

These documents cite those sources **by file name**, not by path, so they resolve wherever the files live in the repository.

## 2. The non-negotiables in one screen

| # | Rule | Where |
|---|---|---|
| 1 | Frontend is **rebuilt from scratch**; backend is **migrated**; existing user data is migrated; critical live defects are hot-fixed now. | OD-2, OD-8, OD-9 |
| 2 | Individuals may self-register. Family, Wallet and Tasks need a verified parent, **except** a teen's personal wallet (Option B). Families only: no teachers or schools. Every safeguard follows **age**, not role. | OD-3, log §2 and §7 |
| 3 | **No lives.** Celebration only on the closed milestone list. | OD-1, OD-7 |
| 4 | "Tutor" is the verified parent. The AI is the **Mentor**: one of the four 3D characters. | OD-6 |
| 5 | **One design system** for every surface and user. Age changes content only. | OD-4 |
| 6 | **Copy budget:** numeric limits on every string. | OD-13, Bible `06` |
| 7 | **Our own iconography and visual assets**, at the same level as shapes and colours. The characters are always the real 3D models. | OD-14, Bible `07` |
| 8 | **The Mentor is a 3D character on its Diorama.** The legacy Mentor UI and legacy buttons are **deleted**, not restyled. | OD-15, Bible `08` |
| 9 | Pricing is out of scope ("free to start" allowed). Legal validates before launch. AI translation from the glossary. Web first, native later. | OD-5, OD-10, OD-11, OD-12 |
| 10 | **One course per theme, with age-appropriate pathways.** Build the new Lesson Engine and its shared Pizarrón before regenerating the catalog. Preserve existing learning evidence. | OD-16, OD-17, B.6–B.8, OD-9 |

## 3. Folder layout and what each file contains

```
littlefounders-spec/
├── README.md                ← this file: precedence, non-negotiables, index
├── IMPORT-GUIDE.md          ← how to place this in the repository without conflicts, and how to check it
├── AGENTS-SNIPPET.md        ← text to add to the repository's AGENTS.md so Codex follows this package
├── CHECKSUMS.sha256         ← integrity check for every file
├── product/                 ← WHAT the product must do
│   ├── 13-OWNER-DECISION-LOG.md
│   ├── 10-PRODUCT-GOLD-STANDARD-REQUIREMENTS.md
│   ├── 10-APPENDIX-A … 10-APPENDIX-P (16 appendices)
│   └── reviews/             ← historical, not to implement from
│       ├── 11-INDEPENDENT-AUDIT-FINDINGS.md
│       └── 12-PRODUCT-FRONTEND-IMPORT-READINESS-REVIEW.md
└── frontend/                ← HOW it looks, reads and moves
    ├── README.md
    ├── frontend-bible/      ← 01–08
    ├── mockup/              ← the reference HTML + the deviations not to copy
    └── verification-tools/  ← 3 audit scripts + package.json
```

### 3.1 `product/`

| File | Contents |
|---|---|
| `13-OWNER-DECISION-LOG.md` | **The top authority.** It contains: <br>• OD-1 to OD-17, each with its consequences and where it was applied; <br>• the access model table by population (adults, teens, parent-created children, children who arrive alone, parents); <br>• the hotfix list for the live platform; <br>• the data-migration requirements; <br>• the controlled EN/es-MX/pt-BR glossary; <br>• the items still open; <br>• the OD-3 vs D.3 conflict, resolved by Option B; <br>• the register of the 12 open decision points inside `10`. |
| `10-PRODUCT-GOLD-STANDARD-REQUIREMENTS.md` | The requirements: 112 items in Blocks A–H (113 headings; C.8 and C.12 count as one item, as the document explains). Each item has a Current State (the legacy platform), a Finding, a Mandated Requirement, a Severity and a Brand Alignment. The blocks are: <br>• A: acquisition and identity; <br>• B: learning, the lesson engine, the Pizarrón (teaching board) and the pedagogical standard; <br>• C: the AI Mentor; <br>• D: Family Hub and Digital Banking; <br>• E: profile and social; <br>• F: achievements and sharing; <br>• G: staff console; <br>• H: analytics and operations. <br>Its opening "Status and use during the migration" section explains how to read everything as acceptance criteria for the rebuild. |
| `10-APPENDIX-A` | Interactive visual catalogue: charts, diagrams and 16 interaction primitives (behind B.7). |
| `10-APPENDIX-B` | Pedagogical and psychological framework: cognitive load, development by age, gamification ethics, neurodivergence (behind B.17–B.28). |
| `10-APPENDIX-C` | Learning success metrics, Definition of Done, QA, and the lesson production pipeline. |
| `10-APPENDIX-D` | Real-time tutoring research: how the Mentor decides turn by turn (behind Block C). |
| `10-APPENDIX-E` | Governance of the Mentor's self-improvement: what may change automatically and what may not. |
| `10-APPENDIX-F` | AI Mentor metrics, Definition of Done, QA and deployment pipeline. |
| `10-APPENDIX-G` | Family Hub and Digital Banking research: money development by age, the split, goals and autonomy. |
| `10-APPENDIX-H` | Family Hub and Banking metrics, Definition of Done and QA (includes the teen independent mode, Option B). |
| `10-APPENDIX-I` | Profile and social safety research: discoverability, the verified-adult signal, reporting. |
| `10-APPENDIX-J` | Profile and social metrics, Definition of Done and QA. |
| `10-APPENDIX-K` | Achievement-sharing research brief: public links, disclosure, revocation. |
| `10-APPENDIX-L` | Achievement-sharing metrics, Definition of Done and QA. |
| `10-APPENDIX-M` | Acquisition and identity metrics, Definition of Done and QA. |
| `10-APPENDIX-N` | Staff console and content production metrics, Definition of Done and QA. |
| `10-APPENDIX-O` | Analytics, experimentation and operations metrics, Definition of Done and QA. |
| `10-APPENDIX-P` | Teaching visuals for maths (M1–M20), logic (L1–L13) and money ($1–$12). It also covers: <br>• the evidence behind each visual; <br>• localisation; <br>• licensing; <br>• the grading contract; <br>• the first-release plan. |
| `reviews/11-…` | Historical: the adversarial self-audit of the requirement set. All of its findings are applied. |
| `reviews/12-…` | Historical: the Product × Frontend import-readiness review. It is resolved by the decision log and the Bible fixes. |

### 3.2 `frontend/`

| File | Contents |
|---|---|
| `README.md` | What changed in v3 and v2, the reading order, and how to run the tools and the results. |
| `frontend-bible/01-RESEARCH-FOUNDATION.md` | The evidence base behind colour, shape, gamification and accessibility for children, with every claim graded A–D. |
| `frontend-bible/02-FOUNDATIONS.md` | **The core rule set (v3).** It contains: <br>• decisions D1–D13; <br>• scope, access and naming, and the language and platform constraints; <br>• 23 mechanically checkable rules; <br>• the `DESIGN.md` YAML tokens; <br>• colour (the measured palette and reserved meanings); <br>• dual mode, typography and the Text Fit Contract; <br>• touch targets, buttons, feedback and the streak; <br>• character slots, forms, tables and overlays, and a motion summary; <br>• open items. |
| `frontend-bible/03-PROPORTIONS-AND-COMPOSITION.md` | Why a layout reads as machine-made, and the composition rules the proportion audit checks. |
| `frontend-bible/04-MOTION.md` | Motion: <br>• the evidence on "juice"; <br>• 5 duration tokens (80/150/250/380/700 ms) and the easings (spring only for milestones); <br>• reduced motion; <br>• the orchestrated patterns. |
| `frontend-bible/05-TEACHING-VISUALS.md` | The Pizarrón board: `viz` tokens, the interaction, text and accessibility contract, and verification. |
| `frontend-bible/06-COPY-BUDGET.md` | **New (OD-13).** <br>• Numeric word and sentence limits per text role, for the app and the site. <br>• Lower limits for ages 6–9, and ES/PT ×1.25. <br>• Where extra detail goes: cut, show, say, or put behind a tap. <br>• Writing rules and before/after rewrites. <br>• The gate before merge. |
| `frontend-bible/07-ICONOGRAPHY-AND-VISUAL-ASSETS.md` | **New (OD-14).** <br>• Two classes of visual: at most 24 system glyphs, and our own assets. <br>• The house style: colour, dimension, shape, no text in assets, both modes. <br>• Formats (SVG, WebP, Lottie) and size budgets. <br>• The real 3D characters and the pose catalogue. <br>• Motion assets, the asset manifest, the review gate and accessibility. |
| `frontend-bible/08-MENTOR-STAGE.md` | **New (OD-15).** <br>• The Mentor as a 3D character on the Diorama, and the order to delete the legacy chat UI and buttons. <br>• The screen layers: stage, speech plate, board, reply chips and input, transcript sheet. <br>• Character states mapped to catalogue poses, and the Block C behaviours made visible. <br>• Layout by width, performance and fallbacks, age bands. <br>• The acceptance checklist. |
| `mockup/littlefounders-mockup.html` | The v2.1 reference prototype, as one self-contained file. <br>• 17 routes, EN/ES/PT, light and dark. <br>• A control bar for route, language, theme, width, text stress and "Child in a family / Teen, no parent". |
| `mockup/KNOWN-DEVIATIONS.md` | The change log K1–K39 (resolved in v2.1), and **K40–K42, open on purpose**: the mockup's copy, icons and art, and Mentor screen are not the design. |
| `mockup/COPY-BUDGET-FINDINGS.md` | The 142 copy-budget findings on the mockup (the English ones listed), recorded as K40. |
| `verification-tools/text-fit-audit.reference.mjs` | The Text Fit Contract audit: 41 states × 3 languages × 2 themes × 4 widths × 2 text sizes, with and without WCAG 1.4.12 spacing. |
| `verification-tools/proportion-audit.reference.mjs` | The composition audit: 492 page states. |
| `verification-tools/copy-budget-audit.reference.mjs` | **New.** The Copy Budget audit. It uses `data-copy-role` when components declare it. |
| `verification-tools/package.json` | Dependency (`puppeteer-core`) and the scripts to run the three audits. |

## 4. Verified state at hand-off

On the v2.1 mockup:

- **Text fit:** 0 issues in 1,968 configurations, and 0 issues in 1,968 more under WCAG 1.4.12 text spacing.
- **Proportion:** 0 findings in 492 page states.
- **JavaScript:** 0 errors.
- **Copy budget:** 142 findings. This is the recorded K40 baseline, not a regression.

The documents were cross-checked for consistency across the product and frontend packages: the decision references, the Option B wording, the file names and the version labels.
