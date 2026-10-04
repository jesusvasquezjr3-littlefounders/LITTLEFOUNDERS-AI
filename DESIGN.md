# LittleFounders — Current Frontend and UI/UX Design

Consolidated reference exported on 1 October 2026 from the current binding specification. This document contains the current Frontend Bible and owner decisions, not the retired design system. Source documents remain authoritative; this export does not amend them.

## Latest owner direction, 2 October 2026

OD-34 extends the unchanged official graphic logo to every shared brand slot, including authentication and application rails. Entry flows use one bounded form column on phones and supporting original flat artwork beside the form on desktop; onboarding welcome may include restrained decorative artwork. The artwork is character-free and text-free, with no action-orange or error-red colors. Application topbars remain prohibited. See `docs/rebuild/sprints/ENTRY-FLOWS-AND-GLOBAL-BRAND.md`.

Marketing composition refinement: use one centered content/header width, one owner of inter-section spacing, heading-plus-copy groups within split columns, natural-height interactive examples and separate primary/supporting art sizes. Phone setup steps put the number beside title/body; desktop steps align as a chronological sequence. See `docs/rebuild/sprints/MARKETING-SPACING-AND-COMPOSITION.md`.

The landing is being redesigned locally from the owner-supplied v2 marketing prototype. The topbar appears **only on marketing pages**, never in the application, including authentication and standalone states. This explicit direction supersedes earlier global-header placement below; language/theme controls remain accessible through rails, bottom-dock preferences or the sign-in content. Existing proprietary-branding and accessibility rules remain binding. The attachment is a visual reference; its bundled specification is not imported as authority. See `docs/rebuild/sprints/LANDING-LOCAL-REDESIGN.md`. The owner then extended that direction to all remaining marketing pages, requested more original illustrations and a single graphic topbar wordmark. The local implementation retains the real 3D Mentor identities, uses original house-style imagery, and keeps legal documents complete. See `docs/rebuild/sprints/MARKETING-LOCAL-REDESIGN.md`; new art approval remains pending. The owner correction OD-33 requires the existing full graphic logo, not a replacement typographic wordmark, and complex AI action compositions derived from the actual 3D Mentor references. This exception is marketing-only; the application Mentor stage still uses the real models. See `docs/rebuild/sprints/MARKETING-CHARACTERS-AND-LOGO.md`.

## Authority and current global requirements

The owner decision log takes precedence, followed by the product gold-standard requirements and appendices, then the Frontend Bible. Subject-specific chapters refine Foundations. The mockup is visual reference only, subject to its recorded deviations. Implementation and release receipts are not competing specifications.

Owner decision OD-30 applies globally to marketing, authentication, learner, parent, staff, Mentor, loading, error and standalone surfaces:

- No native browser dropdowns or native date controls: use application-rendered controls in the house design system.
- No emojis in any interface content.
- No third-party icon packs: system glyphs and meaningful assets are authored in-house and registered; the 24-system-glyph-family limit remains. Any older chapter allowance for an external glyph set is superseded.
- Every topbar uses the official graphic logo and integrated language/theme controls.
- Theme controls show proprietary icons only, with an accessible name and no accompanying visible text.
- Buttons use the proprietary component system; the footer is minimalist and professionally composed.
- These rules apply to every route, role, age band, locale, theme and responsive layout.

The visual language is flat-tactile solid colour, Fredoka display type and Nunito body type, semantic light/dark tokens, responsive composition and restrained copy. The Mentor uses the real 3D characters on the Diorama. Exact values and contracts follow in the source chapters below.

## Source index

- [Owner decisions](docs/littlefounders-spec/product/13-OWNER-DECISION-LOG.md)
- [Product requirements](docs/littlefounders-spec/product/10-PRODUCT-GOLD-STANDARD-REQUIREMENTS.md)
- [02-FOUNDATIONS.md](docs/littlefounders-spec/frontend/frontend-bible/02-FOUNDATIONS.md)
- [03-PROPORTIONS-AND-COMPOSITION.md](docs/littlefounders-spec/frontend/frontend-bible/03-PROPORTIONS-AND-COMPOSITION.md)
- [04-MOTION.md](docs/littlefounders-spec/frontend/frontend-bible/04-MOTION.md)
- [05-TEACHING-VISUALS.md](docs/littlefounders-spec/frontend/frontend-bible/05-TEACHING-VISUALS.md)
- [06-COPY-BUDGET.md](docs/littlefounders-spec/frontend/frontend-bible/06-COPY-BUDGET.md)
- [07-ICONOGRAPHY-AND-VISUAL-ASSETS.md](docs/littlefounders-spec/frontend/frontend-bible/07-ICONOGRAPHY-AND-VISUAL-ASSETS.md)
- [08-MENTOR-STAGE.md](docs/littlefounders-spec/frontend/frontend-bible/08-MENTOR-STAGE.md)
- [01-RESEARCH-FOUNDATION.md](docs/littlefounders-spec/frontend/frontend-bible/01-RESEARCH-FOUNDATION.md)

---

# Binding owner decisions

# 13 — Owner Decision Log

**Status:** Binding. Records the owner's decisions of 20 September 2026 (OD-1 to OD-12), taken after the Product × Frontend import-readiness review (`12-PRODUCT-FRONTEND-IMPORT-READINESS-REVIEW.md`). Where this log conflicts with any earlier document in the Product package (`10-*`, `11-*`, `12-*`) or the Frontend package (`frontend/`), **this log wins**, and the affected documents have been amended to match (see the "Applied in" column). OD-13 to OD-17 were added on 21 September 2026 during the migration review. OD-18 (independent-teen memory self-review) and OD-19 (lesson-stage Mentor contract) were added on 24 September 2026, followed the same day by OD-20 to OD-23 (sharing architecture, Family Hub lifecycle states, B.6 pathway policy process and zero paid spend). OD-24 to OD-28 record the owner's answers to the wave-1 review queue on 27 September 2026. OD-29 (30 September 2026) records the owner's OD-14 style approval of every draft asset for the production evaluation deploy. OD-30 and OD-31 (30 September 2026) record global UI restrictions and the authorized one-time legacy catalog, media and linked-history reset after verified local backups.

---

## 1. Decisions

| # | Topic | Decision | Consequences written into the documents | Applied in |
|---|---|---|---|---|
| OD-1 | **Lives / hearts** | No lives mechanic. Mistakes cost nothing. (Owner framing: "unlimited lives"; implemented as *no life counter at all*, since a counter, even one showing ∞, still presents an error as a resource being spent.) | After several consecutive misses on the same skill, the child's Mentor character offers a guided review instead of any penalty. Lives can never exist, and can therefore never be sold behind a future paywall. The `berry` hue loses its "lives" meaning. Rationale: the product targets a 70–85% practice success band (B.19); with 3 lives and 10-question lessons, 18% (85% success) to 62% (70% success) of lessons would exhaust the lives by design. | `10` B.26 and Block B summary table; Frontend `02` §4.2, §9.2, D9, rule 18 |
| OD-2 | **Scope of the rebuild** | The frontend is rebuilt from scratch. The backend is **migrated** to the new product, not rewritten. The mockup is a visual reference for how the product should look, not the scope of v1. | Every requirement's "Current State" describes the legacy platform; for the new build it becomes an acceptance criterion ("the new build must not reproduce this"). Scope = the product's full screen inventory (`01`) + the 112 requirements, designed in the one visual language. | `10` "Status and use during the migration" section; Frontend README |
| OD-3 | **Who can use the platform** | Individual users can use the platform on their own (Duolingo-style). Advanced features (Family, Digital Banking/Wallet, Tasks) unlock only when requirements are met; a self-registered teen gets a personal wallet without a parent (Option B, section 7). Only families: no teachers, schools or classrooms, for now. | Access model (section 2 below). Self-registered minors remain a supported population, so the "kid role ≠ real minor" requirements (A.2–A.4, C.2–C.4, D.3, E.8, H.1) keep their full weight: every minor safeguard follows **age**, not role. | `10` "Status and use during the migration" section (summary; the full table is section 2 of this log); A.6 and E.4 scope notes; Frontend `02` §1.1 |
| OD-4 | **One design system, age registers by content** | One design system for **everything**: marketing, learner app, parent experience, staff console, emails, the public badge page and the teaching visuals. Tokens, components and shapes are identical for every user. What varies by age band is copy tone, character presence, reward framing and social mechanics (B.23, reduced form). | B.23 amended; Frontend D8 amended. A new, dedicated chapter on teaching visuals (charts, diagrams, mathematical operations, boolean logic, money manipulables) starts now. | `10` B.23, B.7; `10-APPENDIX-P`; Frontend `02` D8, new `05-TEACHING-VISUALS.md` |
| OD-5 | **Pricing** | Out of scope. The platform is free at launch; a paywall may come later and has not been designed. The current priority is user acquisition. | Pricing route parked (not in v1). Marketing may say "free to start", never "always free" or "forever free". Brand team to revise Authority point 6 ("It is free") in `COSMIC_NARRATIVE.md` before any paywall work. Standing constraints for any future paywall: never on safety features or parental controls; never charged to a child; never sells streaks, rest days or error forgiveness; upgrade flows pass the B.25 manipulative-design audit. | `10` "Status and use during the migration" section (standing-constraints bullet); Frontend `02` §1.1, known-deviations list |
| OD-6 | **Naming** | "Tutor" means only the verified parent (brand: "Become your child's Tutor"). The AI is the **Mentor**: one of the four existing 3D characters (Dr. Rho, Zara, Liruf, Dina), chosen by the learner. | Generic noun "Mentor" (identical in EN, ES and PT). The learner's own navigation shows the chosen character's name and avatar; parent views, staff views and documents say "Mentor". "AI Tutor" renamed to "AI Mentor" across the Product package. Legacy system identifiers (e.g. the `Tutor Session` data entity) keep their names until the backend migration renames them. | `10`–`12` (global rename); Frontend `02` |
| OD-7 | **Celebration budget** | "High" gamification means high *feel* (press feedback, state transitions, the scene's own elements moving). Celebration (confetti, XP floaters, spring overshoot) is reserved for a closed list of milestones. | Closed list: lesson complete; course complete; savings goal reached; badge earned; streak milestones at 7, 30 and 100 days. A correct answer gets a bump, a check mark and an informational banner, never confetti or a floating reward. Confirming a coin split gets a confirmation, never confetti. | `10` B.20; Frontend `02` D6, D7, §9.2; `04` |
| OD-8 | **Live platform during the migration** | Critical safety defects are fixed on the **current** platform now, without waiting for the rebuild. | Hotfix list (section 3 below). | `10` "Status and use during the migration" section |
| OD-9 | **Existing user data** | Migrated. | Migration requirements (section 4 below). | `10` "Status and use during the migration" section |
| OD-10 | **Legal** | Legal will update the Terms and Conditions once this work is finished. | Build to the conservative option each requirement already defines (private by default, gated discoverability, revocable and expiring shares, consent-gated analytics). Legal validates **before launch**, not after. | `10` "Status and use during the migration" section (standing-constraints bullet) |
| OD-11 | **Translation** | Done by AI. | AI translation works from a controlled glossary (section 5). Recommendation, not yet confirmed by the owner: native human review of the registration, consent and money screens before launch. | Frontend `02` |
| OD-12 | **Platforms** | Web first; a mobile wrapper sharing that frontend follows. | The owner closed the export-technology choice on 21 September 2026; see section 9. Tokens stay platform-neutral (`DESIGN.md` YAML), while web layout, accessibility and motion primitives remain the implementation target. Wrapper vendor and store-policy validation are still open. | Frontend `02`, `04`, `08`; Product Appendix P |
| OD-13 | **Copy budget** (21 September 2026) | Too much text on several screens. Every string must be clear, precise and as short as possible while still understood at first read. Brevity has **numeric limits**, not just a style wish. | Frontend `06-COPY-BUDGET.md`: budgets per role (app: actions 3 words, headings 6, body 12 and 2 sentences, prompts 20, Mentor turns 20, first view 40; ages 6–9 lower; ES/PT ×1.25), layering for detail, a checking tool, and the gate before merge. Lesson prompts, options and Mentor turns get the same limits as a Forge content gate next to B.17 and B.18. The v2.1 mockup's strings are over budget (K40) and are not copied. | Frontend `02` D11 and rules 19; `06`; `verification-tools/copy-budget-audit.reference.mjs`; mockup `COPY-BUDGET-FINDINGS.md` |
| OD-14 | **Iconography and visual assets are ours** (21 September 2026) | Iconography, images and visual resources are **non-negotiable, at the same level as shapes and colours**. The final product uses as few generic icons as possible. Everything that carries meaning or identity is an asset of our own, generated by the frontend agent (Codex) in the LittleFounders style: images (PNG/WebP), custom SVG and Lottie motion, for both Marketing and the App. The four Mentor characters are rendered from the **real 3D models**, in the poses of the **pose catalogue** that exists in the project folder. | Frontend `07-ICONOGRAPHY-AND-VISUAL-ASSETS.md`: at most 24 system glyphs from one source; the house style (token colours only, flat except the characters and the Diorama, shapes keep their meaning, no text inside assets, both modes); formats and size budgets; the character rules (real models only, catalogue poses, new poses added to the catalogue first); an asset manifest the build checks; an automated and human review gate. The mockup's icons, letter avatars and placeholder art are slots, not designs (K41). | Frontend `02` D12, rules 20–21, §9.7; `07` |
| OD-15 | **The Mentor is 3D on its Diorama; the legacy UI is destroyed** (21 September 2026) | The AI Mentor is the chosen 3D character standing on the **Diorama**, not a generic chatbot. The Mentor UI of the current application is **deleted and rebuilt**, not restyled. The same applies to the legacy **buttons** and controls: they are replaced everywhere by the new design system. | Frontend `08-MENTOR-STAGE.md`: the stage (the character on the Diorama as the dominant area), a speech plate holding one turn, a board on demand, reply chips and input, a transcript only as a secondary sheet, character states mapped to catalogue poses, layout by width, performance fallbacks, age bands and an acceptance checklist. No legacy component is imported (`02` rule 23). B.8's "reuse the existing character/animation system" means the **3D models, Diorama and gesture/emotion vocabulary**, never the legacy screens or components. The mockup's chat-style Mentor screen is not the design (K42). | Frontend `02` D13, rules 22–23; `08`; Product `10` B.8 amendment and the Status section |
| OD-16 | **One thematic course with age-appropriate learning pathways** (21 September 2026) | Each subject is one course containing chapters and lessons for different developmental stages, including adults. A learner enters at an age-appropriate, placement- and mastery-informed frontier; an adult need not complete childhood chapters, and a minor's completion must not depend on adult chapters. The same knowledge-component model supports all pathways, while examples, depth, scaffolding and register are authored for their audience. Age eligibility is a safeguard, not a proxy for mastery. | Rebuild the course map, placement, unlocks, eligible progress and badge rules around the shared graph (B.6), preserving evidence as a learner moves between stages. This supersedes the legacy single flat course sequence and Forge's separate adult-course output as the target information architecture. No existing lesson or user record is deleted as a shortcut; OD-9 governs migration. Exact pathway eligibility, cross-stage credit and badge policy require explicit design before implementation. | Product `10` B.6 and Appendix C; `docs/rebuild/sprints/S05-LESSON-ENGINE-DESIGN.md` |
| OD-17 | **Learner experience first, Lesson Engine before catalog regeneration** (21 September 2026) | The first deliverable is the real, optimized new lesson interface: layout, rendering, charts and interactive Pizarrón, responsive and accessible across the required states, using controlled fixtures while its minimum data contract is defined. Complete the new document contract, authoritative grading, recovery and compact Mentor stage around that experience before adapting Forge or regenerating the age-pathway catalog. Approximately 400 lessons is an illustrative planning size, not a content quota or acceptance threshold. | Frontend quality is an exit gate, not polish deferred until after content generation. A passing visual prototype alone does not approve a new engine: interaction, scoring, accessibility and recovery must pass. Authoring and generation later target this verified contract and use Appendix C's human and automated release pipeline. DeepSeek/Qwen configuration remains unchanged during engine design; provider roles, cost and quality are reassessed when Forge work begins. No paid bulk generation or production content deletion follows from this decision. | Product `10` B.7–B.8 and Appendix C; Frontend `02`, `03`, `05`–`08`; `docs/rebuild/sprints/S05-LESSON-ENGINE-DESIGN.md` |
| OD-18 | **Independent-teen memory notes are self-reviewed** (24 September 2026) | A teen (13–17, no linked guardian) approves or deletes every persistent Mentor memory note, as their own reviewer — the same per-note review pattern children get from their verified guardian, with the teen in the reviewer seat. Nothing is written to persistent memory without that note-level decision. | C.4 closes its open decision point (§8). Implementation: the learner-memory write path treats an independent screened teen as the reviewer of their own proposed notes; existing kid-role records keep their guardian-review hold; no note is silently auto-approved. Verified-guardian review for linked children is unchanged. | Product `10` C.4; `docs/rebuild/sprints/S01-IDENTITY-AND-SAFEGUARDS.md` |
| OD-19 | **The lesson-stage Mentor is the learner's chosen character on a lesson-declared scene** (24 September 2026) | The compact Mentor stage inside lessons shows the learner's own chosen Mentor character on the diorama/scene the lesson document declares — never a fixed character, never a hardcoded scene. The contract between Core, learner preference ownership and the lesson document is public, minimum and answerless: the lesson response projects `character` (from the learner's own choice, defaulting per catalog rules) and an approved `scene` id (from the lesson document's answerless public metadata); no Tutor context, session state or pedagogy data crosses that boundary. | S05.2bh's decision boundary resolves: define the strict public projection in the v2 lesson document contract and connect the authenticated lesson route to the shared real-model stage adapter; the preview fixture remains fixed only until the real projection exists. | Product `10` B.8; Frontend `08`; `docs/rebuild/sprints/S05-LESSON-ENGINE-DESIGN.md` |
| OD-20 | **Achievement sharing is a downloadable image** (24 September 2026) | F.1 resolves to the image architecture: the parent receives a rendered achievement image to send directly (for example over WhatsApp); the rebuild creates no company-hosted persistent public page for a new share, so no link preview exposes a child. Links issued before this decision keep their F.2 noindex, 30-day expiry and revocation until they expire, after which the public page route is retired. | F.1 closes its open decision point (§8). F.2's revocation/expiry remains the control for legacy links only; F.3's disclosure is rewritten for the image flow; Appendix L metrics count downloads/shares initiated, never viewer reach. | Product `10` F.1–F.3; `docs/rebuild/sprints/S08-PROFILES-SOCIAL-AND-SHARING.md` |
| OD-21 | **Every declared Family Hub lifecycle state gets a working flow** (24 September 2026) | D.5 resolves to build, not remove: redemption `fulfilled`, wallet-ledger `goal withdrawal` and `manual adjustment` (guardian-only, audited, with a required reason), and guardian-link `pending`, `rejected` and `revoked` each receive a flow that produces and consumes them. | D.5 closes its open decision point (§8). No new Block D state may be declared without its producing and consuming flow. | Product `10` D.5; `docs/rebuild/sprints/S07-FAMILY-AND-WALLET.md` |
| OD-22 | **B.6 pathway policy: engineering drafts, then builds; owner reviews before release** (24 September 2026) | Engineering writes the pathway eligibility, cross-stage credit, badge and legacy-credit-equivalence policy for OD-16 as a recorded proposal and implements it on the shared knowledge-component graph. The owner reviews the policy and its evidence before the new catalog is released; the proposal is not an accepted release policy until then. | B.6 may begin implementation on the drafted policy (B.1 local verification is complete). OD-9's no-evidence-loss rule is binding on the legacy-credit mapping. | Product `10` B.6; `docs/rebuild/sprints/S05-LESSON-ENGINE-DESIGN.md` |
| OD-23 | **Zero paid model spend during the migration build** (24 September 2026) | No paid LLM, image, voice or API generation is run while implementing the SPEC: Forge catalog regeneration, judge calibration runs and live Mentor transcript scoring are built and verified with fixtures and dry-runs, and their live execution is a documented owner-run step. | Every pipeline that would spend ships a zero-spend dry-run path and an operator runbook; acceptance evidence that needs a live run stays explicitly open. H.7 defaults to adults (18+) only until Product and Legal choose wider experiment ages. | Product `10` C.21–C.23, B.14–B.18, H.7; Appendix C/F |
| OD-24 | **The legacy lesson catalog is replaced, and every earned record is kept** (27 September 2026) | Once the migration and the new Lesson Engine are complete and tested, the current lesson content is removed and new courses with new exercises are authored for the v2 engine. Nothing a family earned is lost (OD-9): badges, XP, coins, streaks, placement credits and completion history are preserved, and every completed legacy topic credits the matching knowledge components on the shared graph so new courses start learners at the right place. | D-01, P-01 and F-05 of the owner review queue. Forge's refusal of the legacy catalogs is expected and needs no legacy rewrite. The legacy v1 lesson player retires with the legacy content, not before it. B.11 misjudgment episodes, B.16 market scenarios and every Forge gate apply to the new catalog. | Product `10` B.6, B.11; `docs/rebuild/OWNER-REVIEW-ANSWERS.md`; `docs/rebuild/sprints/S05-B6-PATHWAY-POLICY.md` |
| OD-25 | **Mastery may open one stage early, and Mentor mastery may complete a topic with the learner's consent** (27 September 2026) | A minor may open a chapter one stage above their age stage (for example 10–12 into the teen stage) when every prerequisite skill of that chapter is mastered on the shared graph and the learner confirms; adult chapters never open to a minor. Mastery shown with the Mentor may complete a course topic, but only after the learner accepts a prompt such as "You have shown mastery of X; unlock the next level?" | P-03 and P-04 (alternatives), P-01 resolved by OD-24. Refines OD-16: age eligibility stays a safeguard at the adult boundary and for more than one stage. | Product `10` B.6; `docs/rebuild/sprints/S05-B6-PATHWAY-POLICY.md` |
| OD-26 | **The C.17 dialogue-calibration experiment may enrol teens and tweens** (27 September 2026) | The C.17 A/B test may enrol teens 13–17 with their own analytics opt-in and tweens 10–12 with guardian analytics consent. Children 6–9 stay excluded. Every other experiment keeps the OD-23 interim rule (adults only) until Product and Legal decide otherwise. | M-12 (alternative). H.7's register row is updated accordingly. | Product `10` C.17, H.7 |
| OD-27 | **Social and privacy refinements** (27 September 2026) | (1) Teens 13–17 get one peer mechanic: cooperative goals in small groups of mutual connections, with no rankings and no public progress; no band gets a leaderboard. (2) A 16- or 17-year-old may opt in to a discoverable profile; private remains the default for every teen. (3) For parent-created children under 13, the verified Tutor sees which option the child chose in each story decision; teens' decision journals stay private. | L-04, S-03 and L-13 (alternatives). E.13 profile minimization, E.10 no messaging and every connection rule still apply. | Product `10` B.23, E.8, B.9/B.10 |
| OD-28 | **Product details from the owner review queue** (27 September 2026) | Digital Banking is renamed Wallet / Cartera / Carteira (§5). Running out of time in a timed drill no longer costs points. Wrong answers get a dedicated, gentle "not yet" sound. When a learner presses end, the Mentor asks the recap question first. An independent teen's "I will try" creates their own savings goal. The age screen stores a birth month so a teen moves to the adult tier at 18. A verified Tutor may change the username of a child whose handle is flagged. Lesson completion gets a confetti burst (reduced-motion static frame). Loading placeholders shimmer, pending buttons show a spinner, and dark mode uses soft shadows as well as surface colour (all motion off under reduced motion). Account emails are designed for dark mode too. The phone function machine uses a smaller segmented control. An OCR check automates "no text inside raster art". Mixed Mentor files get finer Tier 1 boundaries. images:backfill (paid) and audiogen narrate:all require an owner-approved USD ceiling. Branch protection for the governed Mentor folders is prepared by Engineering and applied by the owner. The project leader is interim owner of D.19 and D.22. | The remaining 22 alternatives; the 108 approved defaults are confirmed as recorded in `docs/rebuild/OWNER-REVIEW-ANSWERS.md`. | Product `10` B.5, B.20, B.26, C.16, C.22, D.3, D.19, D.22, E.4, E.8; Frontend `02`, `04`, `07` |
| OD-29 | **Every draft asset is approved for the production evaluation deploy** (30 September 2026) | The owner closes the OD-14 first-asset style review for every class B asset registered as `draft` in the asset manifest (431 rows across all 14 review families: character renders, badges, coins, course icons, scenes, pockets, empty states, avatar parts, profile covers, achievement share, sounds, celebration motion, brand and navigation), so the strict production build can ship the current release for an online evaluation. Each row records `reviewStatus: approved` and `approvedBy` naming the owner, this date and this entry. | The release build (`prebuild`, `check-rebuild-assets.mjs --release`) passes without the local draft override. Every other 07 gate still applies to these assets (size, modes, no text by OCR, real-model provenance and catalogue pose, references). An asset registered after this entry starts as `draft` again and needs its own approval before a production build. The owner may still retire or replace any approved asset after the evaluation. | Frontend `07` §6–§7; `frontend/src/rebuild/assets/manifest.json`; `frontend/src/rebuild/assets/assetGate.test.ts` |
| OD-30 | **Global application-owned UI** (30 September 2026) | The owner requires custom application-rendered dropdowns everywhere: no native select elements, emoji artwork or third-party icon libraries. Every surface uses proprietary branding. The topbar displays the official graphic logo, integrated language selection and an icon-only theme toggle. The footer remains professional and minimalist. | Applies globally to public, authentication, learner, guardian, staff and authoring surfaces, not selected routes. Accessibility labels remain available without visible theme text. Existing house assets and locally authored system glyphs satisfy provenance requirements; the 24-family budget remains. | Shared rebuilt controls and shells; authored-UI gate; UI polish checkpoint |
| OD-31 | **One-time legacy content and linked history reset** (30 September 2026) | The owner explicitly authorizes deleting all current course lesson content, including archived content, associated image/audio assets and learning history linked to the removed courses, after a verified database and media backup with documentation in a local folder outside online synchronization. The legacy lesson engine must be eliminated and the v2 implementation deployed. | This scoped reset overrides OD-9/OD-24 preservation for the removed catalog only. Accounts, family links, wallet balances, unrelated tasks and unrelated history remain protected. Future catalog learner-record guards remain enabled. New content generation and human product acceptance are separate subsequent work. | UI polish and lesson retirement checkpoint; local backup reset record |

---

## 2. Access model (OD-3)

| Population | How they get in | Learning and Mentor | Family, Wallet/Banking, Tasks | Profile and social | Safeguards |
|---|---|---|---|---|---|
| Adults (18+) | Self-registration (email or Google); age captured on every path | Yes | As a **parent** only: after ID verification (A.5) and a guardian link, the adult manages and sees their children's wallets, tasks and goals. There is no personal adult wallet. | Public profile under Block E rules; the Tutor badge is visible only as E.5 allows | Standard |
| Teens (13–17), self-registered | Self-registration; age captured on every path; date of birth locked after the first declaration (E.4) | Yes | A **personal wallet** without a parent (self-logged income, Save/Spend/Share, savings goals; simulated coins; no approval step), per OD-3 Option B. Tasks and parent approvals only if a parent links later | Private by default; **mutual-consent connections the teen manages without a guardian** (E.8's lighter tier); no public badge links (F.6 keeps sharing guardian-initiated) | All minor safeguards **by age**: Mentor moderation fail-closed (C.3), minors' voice policy (C.2), memory-note policy for teens without a guardian (C.4), consent-gated analytics with a self-managed opt-out (H.1), no variable-ratio rewards (B.22) |
| Children (under 13), parent-created | A parent creates the account (username + passphrase) | Yes | Inside the family, under the parent's approvals and the independence tiers of D.17 | Non-discoverable; connections only with guardian approval (E.1, E.8's strictest tier) | Full minor safeguards |
| Children (under 13) who arrive alone | Guest mode reached from the age screen (A.2) | Yes, with every minor safeguard (the A.2 marker forces Mentor moderation fail-closed and turns the microphone off) | No | None | Full minor safeguards; the guest origin marker persists until a guardian link exists |
| Parents ("Tutors") | Adult account + ID verification (A.5) | Yes | Yes (the guardian experience) | As adults | Two internal trust levels kept distinct (A.5) |

"Advanced features" (Family, Wallet/Banking, Tasks) require a verified parent and a guardian link. They are never unlocked by a self-declared role. The one exception is the self-registered teen's personal wallet (Option B, section 7): Tasks and anything a parent approves stay guardian-only.

---

## 3. Hotfix list for the live platform (OD-8)

The Critical child-safety and trust defects that exist **today in production**, plus two items added for their exposure or impact: F.2 (High; ships with F.1, since `noindex` without revocation leaves permanent pages) and B.1 (Critical but functional: it silently breaks placement, progress and badges for every learner). These are fixed on the current platform in parallel with the rebuild; each is also carried into the new build as an acceptance criterion.

| Item | Defect in production | Minimum hotfix |
|---|---|---|
| A.2 | Guest accounts (the under-13 refusal path) get no minor safeguards | Origin marker on age-refusal guests; Mentor moderation fail-closed, microphone off, analytics suppressed |
| A.3 | Google Sign-In has no age screen | Mandatory post-callback age screen; under-13 → same marker as A.2 |
| D.1 | Card freeze is cosmetic | Server-side rejection of redemptions on a frozen account, proven by an adversarial test |
| G.1 | Staff permissions are labels, not enforcement | Enforce each permission at its endpoints, or collapse to one audited staff tier |
| E.1 | Any signed-in user can find and follow a child | Kid-role and under-13 accounts: non-discoverable, connections only with guardian approval. Self-registered 13–17: private by default and mutual-consent connections the teen manages (E.8's lighter tier), since no guardian exists to approve |
| E.2 | Parents cannot see their child's social graph, and follow/unfollow/block leave no audit trail | Guardian view of the child's connections; audit-log entries for follow, unfollow and block |
| C.2 | Minor voice/microphone safeguards follow the kid role, not the real minor (self-registered teens and guests are unprotected) | Apply the minors' voice policy by age (and to A.2 guests) |
| C.3 | Mentor content moderation fails open for the same population | Fail-closed moderation for every account not positively confirmed as adult |
| F.1 / F.2 | Public, permanent, indexable badge pages naming a child | `noindex`, per-share revoke that also invalidates the image, default expiry |
| B.1 | Placement commit fails for every real placement outcome (release-blocking) | Align the stored placement values with the four business states |

Also recommended as early hotfixes because they are small or close a live exposure: E.3 (a report action for unwanted contact), C.4 (guardian review of Mentor memory notes by age, not role), A.6 (child email change without guardian approval), G.2 (the direct-publish bypass restricted to logged Superadmin use).

---

## 4. Data migration requirements (OD-9)

1. **Nothing is lost that a family was promised:** progress, placement credits, XP, coins, badges, streaks (current and best), savings goals, chore history, Mentor plans and notebooks.
2. **Parental consent carries over only for the practices it covered.** Any new data practice introduced by the rebuild (a new analytics event class, a new Mentor memory type, a new sharing surface) needs fresh, specific parental consent for children's accounts before it applies to migrated children.
3. **Legacy defects are not migrated forward.** Records created by defective flows are flagged and corrected during migration: staff-granted parent roles without justification (A.5), guest accounts created from the age-refusal path (A.2), Google accounts with no date of birth (A.3/A.4), public badge shares with no expiry (F.2, which are given the default expiry at migration).
4. **Identifiers:** child usernames and the parent-child guardian links migrate unchanged, so children keep signing in the same way.
5. **Verification:** row counts and per-family spot checks on balances, streaks and badges before and after, signed off before the legacy platform is switched off.

---

## 5. Controlled glossary (OD-6, OD-11)

| Concept | EN | es-MX | pt-BR | Never use |
|---|---|---|---|---|
| Verified parent | Tutor | Tutor | Tutor | (never for the AI) |
| The AI character | Mentor (or the character's name) | Mentor | Mentor | Tutor, bot, assistant |
| In-app currency | coins | monedas | moedas | money, pesos, reais (it is a simulation) |
| Chore | task / chore | tarea | tarefa | job |
| Parent's approval | approve | aprobar | aprovar | accept |
| Savings / spending / sharing | save / spend / share | ahorrar / gastar / compartir | poupar / gastar / compartilhar | invest (for the save pocket) |
| Rest day | rest day | día de descanso | dia de descanso | streak freeze (implies a purchase) |
| The money section (formerly "Digital Banking", OD-28) | Wallet | Cartera | Carteira | bank, banking account |
| Allowance (regional) | allowance | domingo / mesada (confirm regionally) | mesada | |
| The Mentor's 3D scene | Diorama | Diorama | Diorama | |
| The Mentor screen | Mentor (the character's name in the learner's UI) | Mentor | Mentor | chatbot, bot, assistant |

---

## 6. Still open

| Item | Owner of the answer |
|---|---|
| ~~Mobile export technology~~ | Closed by the owner on 21 September 2026: web first, with a future mobile wrapper sharing the web frontend. See section 9. |
| Native human review of registration, consent and money screens | Owner (recommended, not yet confirmed) |
| Revision of `COSMIC_NARRATIVE.md` Authority point 6 ("It is free") | Brand team, before any paywall work |
| The 12 open product decision points inside `10` (register in section 8) and the counsel-review items | Product and Legal, each before its block enters development |

---

## 7. Conflict OD-3 vs. D.3 — resolved: Option B (owner, 20 September 2026)

The first version of the access model unlocked Wallet/Banking and Tasks only with a verified parent and a guardian link. That contradicted requirement D.3 (Critical), which mandates an independent mode for self-registered teens, grounded in Appendix G §4.3 and in the brand's own 16-year-old success story. The conflict was missed when the access model was proposed and approved, and was recorded here rather than resolved silently.

**The owner chose Option B:** "advanced features" split in two. A self-registered teen (13–17) without a parent gets a **personal wallet**: self-logged income, Save/Spend/Share allocation and savings goals, in simulated coins, with no approval step. **Tasks, chore approval and anything a parent approves stay guardian-only.** If the teen later invites a parent, the family mechanics layer on top of the same wallet (D.3). D.3 stands as written; H.1's reference to D.3 and Appendix H's Phase 3 and "Teen Independent-Mode Adoption" metric stand. Section 2 above reflects this.

---

## 8. Register of open product decision points inside `10`

An earlier count of "15 decision points" (in `12` and in the first version of this log) also counted the "Owner decision needed" column headers of the summary tables. The real list is 12 (one of them, D.3, is now closed):

| Item | Decision | Owner | Deadline or trigger |
|---|---|---|---|
| A.1 | For each FAQ promise: build the flow or remove the claim | Product + Engineering | Before the first public release of the new build |
| B.1 | Placement states: in the rebuild, the new schema stores the four real business states (the legacy choice between widening and normalizing applies only to the hotfix) | Engineering | Hotfix now; schema at Block B Phase 0 |
| B.2 | Course prerequisites: enforce (block or soft warning) or remove the field | Product + Engineering | Before Block B's course-path work |
| C.4 | ~~Memory-note policy for teens with no linked guardian~~ — decided: OD-18 (self-review, 2026-09-24) | Owner | Closed 2026-09-24 |
| Mentor-stage contract | ~~Which character and scene the compact lesson Mentor stage shows~~ — decided: OD-19 (learner's chosen character + lesson-declared scene, 2026-09-24) | Owner | Closed 2026-09-24 |
| D.3 | ~~Parent-free teen wallet~~ — decided: Option B (section 7) | Owner | Closed 2026-09-20 |
| D.5 | ~~For each declared-but-unused Family Hub state: build or remove~~ — decided: OD-21 (build every flow, 2026-09-24) | Owner | Closed 2026-09-24 |
| D.13 | Save/Spend/Share split: recommended default with override, unless a documented rationale chooses compulsory — no compulsory rationale was recorded, so the recommended default with override applies | Product | Block D design |
| D.19 | Scope the older-teen "graduation" initiative | Product | Within two quarters of approval |
| D.22 | Scope the long-horizon research instrumentation plan | Product | Within two quarters of approval |
| F.1 | ~~Downloadable image vs. guarded page for shared achievements~~ — decided: OD-20 (downloadable image, 2026-09-24) | Owner | Closed 2026-09-24 |
| G.1 | Enforce each staff permission, or collapse to one audited staff tier | Engineering | Hotfix now |
| H.7 | Which ages may be included in experiments — interim default per OD-23: adults (18+) only; OD-26 opens the C.17 dialogue experiment to teens (own opt-in) and tweens (guardian consent) | Product + Legal | Before any other experiment runs in the new build |

Calibration values proposed in `10` (B.4 30%, B.17 concept ceilings, B.26 three misses, C.10 two observations, D.11 bonus ratio, E.3 three reports in 30 days, F.2 30–90-day expiry, G.2 30-day retroactive window, G.4 quarterly reviews) are not open decisions: they apply as written and are recalibrated through each block's threshold log.

## 9. OD-12 implementation decision (21 September 2026)

The owner explicitly selected **web with a future mobile wrapper sharing the same frontend** during implementation kickoff. React Native is not the target for this rebuild. Component work may proceed using web layout, accessibility and motion primitives. Tokens remain platform-neutral, and the Mentor stage retains the isolated input/output contract from Frontend Bible `08` section 7. Wrapper vendor selection and store-policy validation remain implementation and launch tasks; this decision does not approve an unreviewed third-party SDK. Earlier references in the package to the export technology being open are superseded by this entry.


---

Source: [02-FOUNDATIONS.md](docs/littlefounders-spec/frontend/frontend-bible/02-FOUNDATIONS.md)

# 02 · Foundations — decisions, tokens and contracts

Status: **owner-approved decisions, verified in a prototype. Version 3 (2026-09-21):** the owner decisions OD-1 to OD-15 in `13-OWNER-DECISION-LOG.md` are applied (v3 adds OD-13 copy budget, OD-14 own visual assets, OD-15 the Mentor stage and the replacement of the legacy UI). Where this file and that log disagree, the log wins. Written in English because the file feeds an AI frontend agent.
Companion files: `01-RESEARCH-FOUNDATION.md` (evidence), `03-PROPORTIONS-AND-COMPOSITION.md` and `04-MOTION.md` (the two follow-up research passes), `05-TEACHING-VISUALS.md` (charts, mathematics, logic and money visuals), `06-COPY-BUDGET.md` (how much text), `07-ICONOGRAPHY-AND-VISUAL-ASSETS.md` (system glyphs vs our own assets; the real 3D characters), `08-MENTOR-STAGE.md` (the Mentor as a 3D character on the Diorama), `../mockup/littlefounders-mockup.html` (the visual reference; the values in section 3 are what it renders) and `../mockup/KNOWN-DEVIATIONS.md` (every place where the mockup contradicts this file or the owner decisions; do not copy those).

---

## 1. Decision log (all confirmed by the owner)

| # | Decision | Notes |
|---|---|---|
| D1 | Text never truncates, clips or ends in an ellipsis. Space must be used well. | Non-negotiable. Contract in section 7. |
| D2 | Light and dark are both first-class, defined from the start. | Section 5. |
| D3 | Typeface: more character and roundness, close to the references. | **Fredoka** (display, buttons, numbers in headings) + **Nunito** (text, labels, numerals). |
| D4 | Primary indigo becomes `#5c55fd` (was `#4f46e5`). | One value works in both modes. |
| D5 | Identity colours are reinforced by icon, shape and label. | Colour is never the only channel. Section 4.3. |
| D6 | **Gamification is HIGH in feel, buttons included:** press feedback, state transitions, the scene's own elements moving. | Section 9. Fixed rule, not a variable. Revised in v2 (OD-7): "high" never means celebrating every action. |
| D7 | **Celebration is budgeted.** Confetti, XP floaters and spring overshoot happen only on a closed list of milestones: lesson complete, course complete, savings goal reached, badge earned, streak milestones at 7, 30 and 100 days. | A correct answer gets a bump, a check mark and an informational banner, never confetti or a "+XP" floater. Confirming a coin split gets a confirmation, never confetti. A routine press uses scale feedback with standard easing, never spring overshoot. Idle motion has a hard budget (section 9.4). OD-7. |
| D8 | **One design system for everything and everyone; age registers by content.** | One set of tokens, components and shapes for every surface (marketing, learner app, parent experience, staff console, emails, public badge page, teaching visuals) and every user. What varies by age band (young child, tween-teen transition, teen, with a "graduation" around ages 10–12) is only copy tone, character presence, reward framing and social mechanics. Density changes by composition only. OD-4. |
| D9 | **No lives.** | No life or heart counter of any kind, not even one showing ∞. A wrong answer costs nothing. After several consecutive misses on the same skill, the learner's Mentor character offers a guided review (an offer, never a penalty or a lock). OD-1. |
| D10 | **"Tutor" means only the verified parent. The AI is the Mentor.** | Section 1.1 and 9.7. OD-6. |
| D11 | **Copy budget: say less.** Every string does one job in the fewest words a child in that band understands at first read. | Numeric budgets per role, a first-view limit, layering for detail. `06-COPY-BUDGET.md`. OD-13. |
| D12 | **Our own visual assets.** At most 24 generic system glyphs; everything that carries meaning or identity is our own SVG, WebP or Lottie in the house style; the Mentor characters are always rendered from the real 3D models in catalogue poses. Non-negotiable, like shape and colour. | `07-ICONOGRAPHY-AND-VISUAL-ASSETS.md`. OD-14. |
| D13 | **The Mentor is a 3D character on its Diorama, not a chatbot.** The legacy Mentor chat UI and the legacy buttons are deleted and rebuilt from this bible, never restyled or ported. | `08-MENTOR-STAGE.md`. OD-15. |

Earlier fixed rules still apply: flat-tactile solid colour, no glassmorphism, warm accent beside indigo, 3D characters wherever possible, 100% responsive.

**Correction to something I said earlier:** 44 CSS px is about **7 mm** on a phone (a CSS px is about 0.16 mm), not "7–11 mm". That is exactly the size at which children aged 7–10 were reported to miss roughly 30% of targets.

### 1.1 Scope, access and naming (owner decisions OD-2, OD-3, OD-5, OD-6)

- **The mockup is a visual reference only** (OD-2). It shows how the product should look and move. It is not the v1 scope and not the information architecture. Scope comes from the product's screen inventory and requirements (`10-PRODUCT-GOLD-STANDARD-REQUIREMENTS.md` and the screen inventory it cites), all designed in this one visual language. The frontend is rebuilt from scratch; the backend is migrated.
- **Access model** (OD-3). Individual users may self-register. The advanced features (Family, Wallet/Banking, Tasks) need a verified parent and a guardian link; a self-declared role never unlocks them. Exception decided by the owner (OD-3, Option B): a self-registered teen (13–17) without a parent gets a **personal wallet** (self-logged income, Save/Spend/Share, savings goals; simulated coins; no approval step); Tasks and anything a parent approves stay guardian-only. The mockup shows both modes (control bar: "Child in a family" / "Teen, no parent"). Families only: no teacher or school roles, no classrooms, no class dashboards. Every sign-up path (email, Google, guest) captures age, and every minor safeguard follows age, not role. Login accepts **email or username**: children sign in with a username and passphrase created by their parent.
- **Pricing is parked** (OD-5). The pricing route and every "Upgrade" or "See pricing" element are out of scope for v1. Marketing copy may say "free to start", never "always free" or "forever free". If a paywall is ever designed, it may never apply to safety features, parental controls, streaks or rest days, or error forgiveness, and it is never shown or charged to a child.
- **Naming** (OD-6). "Tutor" means only the verified parent (brand line: "Become your child's Tutor"). The AI is the **Mentor**: the learner chooses one of the four existing 3D characters (Dr. Rho, Zara, Liruf, Dina). The learner's own navigation tab shows the chosen character's name and avatar; parent views, staff views and documentation say "Mentor". Never label the AI "Tutor", "bot" or "assistant".

### 1.2 Language and platforms (OD-11, OD-12)

- **Translation is done by AI from a controlled glossary** (OD-11). The glossary below is copied from the decision log (section 5), which remains the source of truth. **Recommendation, not yet confirmed by the owner:** native human review of the registration, consent and money screens before launch.

| Concept | EN | es-MX | pt-BR | Never use |
|---|---|---|---|---|
| Verified parent | Tutor | Tutor | Tutor | (never for the AI) |
| The AI character | Mentor (or the character's name) | Mentor | Mentor | Tutor, bot, assistant |
| In-app currency | coins | monedas | moedas | money, pesos, reais (it is a simulation) |
| Chore | task / chore | tarea | tarefa | job |
| Parent's approval | approve | aprobar | aprovar | accept |
| Savings / spending / sharing | save / spend / share | ahorrar / gastar / compartir | poupar / gastar / compartilhar | invest (for the save pocket) |
| Rest day | rest day | día de descanso | dia de descanso | streak freeze (implies a purchase) |
| Allowance (regional) | allowance | domingo / mesada (confirm regionally) | mesada | |
| The Mentor's 3D scene | Diorama | Diorama | Diorama | |
| The Mentor screen | Mentor (the character's name in the learner's UI) | Mentor | Mentor | chatbot, bot, assistant |

- **Web first; a mobile wrapper shares the web frontend** (OD-12, resolved 21 September 2026 in the owner log §9). Tokens stay platform-neutral: the YAML in section 3 holds values, not CSS. The web implementation uses the container queries, text-reflow, fixed-viewport overlays and motion rules in this Bible. The future wrapper must preserve those behaviors, accessibility, safe-area handling and reduced-motion settings. Wrapper vendor selection remains open. Apple's Kids Category and Google Play's Families Policy restrict analytics, advertising and third-party services in children's apps; check both at design time, not at submission.

---

## 2. Rules an agent can check mechanically

1. One visual language. No audience-specific themes or components. Age bands change content (copy tone, character presence, reward framing, social mechanics), never tokens, components or shapes (D8).
2. No `backdrop-filter`, no glass, no gradient text, no drop-shadow ridge, and no decorative border on any component that has its own fill colour (section 4.4). Separation between elements is a change of fill colour or, for a neutral surface, a soft elevation shadow — never an outline drawn around a shape. Simulated depth/3D is reserved for the Mentor characters and the Diorama they stand on (`07`, `08`).
3. Identity/achievement fills are solid: `background: {hue}; color: on-{hue}`. Never fade a fill with opacity to make a tint; use `{hue}-soft`.
4. Every text-bearing element obeys the Text Fit Contract (section 7).
5. Every screen is verified in light and dark. `fill`, `ridge` and `on-*` are identical in both modes.
6. Colour never carries meaning alone: pair it with an icon and a word.
7. Reserved hues (section 4.2).
8. Touch targets: 48 / 56 / 64 px by function (section 8).
9. Every pressable gives feedback through colour and scale — not simulated depth (section 9.1).
10. Characters are 3D assets in a labelled slot, or on the Mentor stage (`08`). Text never lives inside a character asset. Nothing else in the interface simulates 3D, except the Diorama.
11. Body and UI text never falls below 14 px, and every text token reaches at least 4.5:1 on the surfaces it is used on.
12. Any overlay (dialog scrim, toast, sheet) uses `position:fixed`, anchored to the real viewport — never `position:absolute` inside a scrollable ancestor. An `absolute` overlay centers on the full scrollable content, not what the user can see, and on a long page can render off-screen entirely.
13. Re-rendering the DOM in place (opening a dialog, a toast appearing, a validation error) must preserve the user's current scroll position. Only an intentional route change resets scroll to the top.
14. Motion always has a reason stated before it is added — what event does this communicate — per section 9.9 and `04-MOTION.md`. Orchestrated patterns (stagger, wave) fire only on genuine route/screen entry, never on an in-place re-render from an unrelated interaction.
15. A screen representing a single state (a lesson, a result, an onboarding step) fills its entire background with one dominant hue; a dashboard-style screen with many independent pieces of content stays a neutral page with coloured cards (section 4.5).
16. No em dash (—) anywhere in UI copy — headings, body text, button labels, error messages, empty states. It reads as a stylistic tell of AI-written text and undercuts the platform's tone. Rewrite as two sentences, or use a colon or comma depending on the relationship between the clauses.
17. Celebration effects (confetti, XP floaters, `spring` easing) fire only on the D7 milestone list. A correct answer, a coin split, a sign-up or a routine press never triggers them.
18. No lives, hearts or any counter that is spent by a wrong answer (D9).
19. Every string meets its Copy Budget (`06` §3) and every component declares `data-copy-role`; the Copy Budget audit passes (D11).
20. At most 24 system glyphs in the whole product, from one source; every other visual is a manifest-registered own asset with no text inside it (`07`, D12).
21. A Mentor character is only ever a render of the real 3D model in a catalogue pose; never a letter avatar, a generic bot icon or an image-model look-alike (`07` §4, D12).
22. The Mentor screen is the stage (`08`): the character on the Diorama is the dominant area; no chat thread as the primary view, no bubble tails, no typing dots (D13).
23. No legacy component (button, input, chat, card) from the current application is imported into the new frontend. Every control comes from this system (D13).

---

## 3. Tokens (DESIGN.md format)

Naming grammar: `{role}` = solid fill, `{role}-ridge` = a darker tone of the fill, `on-{role}` = text/icons on the fill, `{role}-strong` = coloured text or icon on a neutral surface, `{role}-soft` = pale well. `dark-` prefixes the values that change in dark mode.

**What `{role}-ridge` is still for (v2).** The system is flat: no component has a ridge edge, and the v1 `depth` tokens are gone. The ridge colours are kept because the mockup uses them for exactly two things: (1) the thin outline and inner detail strokes drawn into small illustrated collectibles (the coin, the medal, the hexagon badge; section 4.4, exception 3), and (2) coloured text on a white chip that sits on that hue's fill (the "Simulation" chip on the indigo balance card uses `primary-ridge`, 7.7:1 on white). Do not use them for anything else.

The block below is regenerated in v2 from the mockup's rendered CSS (and, for motion, from the v2 rule in D7, where the mockup is a known deviation).

```yaml
version: alpha
name: LittleFounders
description: Flat-tactile, solid-colour, highly gamified design system. One visual language for every audience. Light and dark are both first-class.
colors:
  # ---- neutrals: light values are the base names; dark values carry the dark- prefix ----
  base: "#f4f5fd"
  surface: "#ffffff"
  sunken: "#eaecf6"
  outline: "#d5d8e7"
  edge: "#83869a"
  content: "#11132a"
  content-muted: "#66697c"
  content-disabled: "#999db2"
  ink: "#11132a"            # text on bright fills, identical in both modes
  dark-base: "#0b0d1b"
  dark-surface: "#131627"
  dark-raised: "#1c1f32"
  dark-sunken: "#060713"
  dark-outline: "#2c3046"
  dark-edge: "#606376"
  dark-content: "#f5f6fe"
  dark-content-muted: "#8f92a7"
  dark-content-disabled: "#515466"
  # ---- solid hues: fill / ridge / on-* never change with the mode; strong / soft do ----
  primary: "#5c55fd"
  primary-ridge: "#4438cf"
  on-primary: "#ffffff"
  primary-strong: "#5850f8"
  primary-soft: "#eceffe"
  dark-primary-strong: "#7a84ff"
  dark-primary-soft: "#21254e"
  accent: "#eb7301"
  accent-ridge: "#be5c01"
  on-accent: "#11132a"
  accent-strong: "#ab5202"
  accent-soft: "#feece2"
  dark-accent-strong: "#e16f03"
  dark-accent-soft: "#451d00"
  reward: "#ebb806"
  reward-ridge: "#a88205"
  on-reward: "#11132a"
  reward-strong: "#856600"
  reward-soft: "#ffefc9"
  dark-reward-strong: "#b38b00"
  dark-reward-soft: "#362801"
  success: "#028048"
  success-ridge: "#005f34"
  on-success: "#ffffff"
  success-strong: "#027b45"
  success-soft: "#d2fcdf"
  dark-success-strong: "#3ea56b"
  dark-success-soft: "#01341a"
  error: "#db1b2b"
  error-ridge: "#ac001a"
  on-error: "#ffffff"
  error-strong: "#d60f26"
  error-soft: "#ffebe9"
  dark-error-strong: "#fe5150"
  dark-error-soft: "#491816"
  sky: "#4b94ff"
  sky-ridge: "#3476d4"
  on-sky: "#11132a"
  sky-strong: "#1d68ce"
  sky-soft: "#e8f1fe"
  dark-sky-strong: "#468ff9"
  dark-sky-soft: "#10294e"
  mint: "#05a893"
  mint-ridge: "#018675"
  on-mint: "#11132a"
  mint-strong: "#07796a"
  mint-soft: "#c7fef1"
  dark-mint-strong: "#06a490"
  dark-mint-soft: "#01322b"
  berry: "#cc2e72"
  berry-ridge: "#a40c56"
  on-berry: "#ffffff"
  berry-strong: "#c6266d"
  berry-soft: "#ffeaef"
  dark-berry-strong: "#f15391"
  dark-berry-soft: "#461729"
  # ---- alias: no separate amber exists (it collapsed with accent and reward under colour-vision simulation) ----
  warning: "{colors.reward}"
  warning-ridge: "{colors.reward-ridge}"
  on-warning: "{colors.on-reward}"
  warning-strong: "{colors.reward-strong}"
  warning-soft: "{colors.reward-soft}"
  dark-warning-strong: "{colors.dark-reward-strong}"
  dark-warning-soft: "{colors.dark-reward-soft}"
typography:                                          # fixed sizes, stepped by the `app` container width (<640 / 640-1119 / >=1120 px), never fluid clamp(); see 03 §3.2
  display-2xl: { fontFamily: Fredoka, fontSize: 48px,     fontWeight: 700, lineHeight: 1.04, letterSpacing: -0.015em }  # marketing H1; 56px at >=640, 72px at >=1120
  display-xl: { fontFamily: Fredoka, fontSize: 36px,      fontWeight: 700, lineHeight: 1.08, letterSpacing: -0.01em }   # 40px at >=640
  display-lg: { fontFamily: Fredoka, fontSize: 28px,      fontWeight: 700, lineHeight: 1.12, letterSpacing: -0.005em }  # in-app H1; 32px at >=640
  headline:   { fontFamily: Fredoka, fontSize: 1.5rem,    fontWeight: 600, lineHeight: 1.25 }
  title:      { fontFamily: Fredoka, fontSize: 1.25rem,   fontWeight: 600, lineHeight: 1.28 }
  button:     { fontFamily: Fredoka, fontSize: 1rem,      fontWeight: 600, lineHeight: 1.2, letterSpacing: 0.008em }
  button-lg:  { fontFamily: Fredoka, fontSize: 1.125rem,  fontWeight: 600, lineHeight: 1.2, letterSpacing: 0.008em }
  question:   { fontFamily: Nunito,  fontSize: 1.75rem,   fontWeight: 700, lineHeight: 1.35 }   # lesson question on the full-bleed lesson screen
  answer:     { fontFamily: Nunito,  fontSize: 1.125rem,  fontWeight: 800, lineHeight: 1.3 }    # answer rows and choice controls
  body-lg:    { fontFamily: Nunito,  fontSize: 1.125rem,  fontWeight: 500, lineHeight: 1.6 }
  body:       { fontFamily: Nunito,  fontSize: 1rem,      fontWeight: 500, lineHeight: 1.55, letterSpacing: 0.008em }
  label:      { fontFamily: Nunito,  fontSize: 1rem,      fontWeight: 800, lineHeight: 1.25 }
  caption:    { fontFamily: Nunito,  fontSize: 0.875rem,  fontWeight: 700, lineHeight: 1.35 }   # 14 px is the floor for ANY text
  chip:       { fontFamily: Nunito,  fontSize: 0.875rem,  fontWeight: 800, lineHeight: 1.25 }
  numeral-xl: { fontFamily: Nunito,  fontSize: 40px,      fontWeight: 900, lineHeight: 1, letterSpacing: -0.01em }      # 56px at >=640; digits are fixed-width by default in Nunito
  numeral:    { fontFamily: Nunito,  fontSize: 1.5rem,    fontWeight: 800, lineHeight: 1.1 }
rounded: { sm: 12px, md: 20px, lg: 28px, xl: 36px, full: 9999px }
spacing: { 1: 4px, 2: 8px, 3: 12px, 4: 16px, 5: 20px, 6: 24px, 8: 32px, 10: 40px, 12: 48px, 14: 56px, 16: 64px, 20: 80px, 24: 96px, 32: 128px }   # = the mockup's --s-1 ... --s-32; nothing off this scale (03 §3.1)
target: { min: 48px, base: 56px, lg: 64px }        # extension: touch-target floors, by function (never by audience)
elevation:                                          # extension: soft shadows for surfaces with no colour of their own (light mode; dark mode uses the surface step, section 5)
  card:    "0 1px 3px rgba(17,19,42,.08), 0 1px 2px rgba(17,19,42,.06)"
  control: "0 1px 3px rgba(17,19,42,.14)"           # secondary button, icon button
  float:   "0 10px 28px rgba(17,19,42,.14)"         # dialog, toast
focus: { width: 3px, offset: 3px, color: "{colors.primary-strong}" }
motion:                                             # extension; full rationale in 04-MOTION.md §2. Five duration tokens in three categories.
  duration:
    instant: 80ms          # state-layer feedback: press-in, tap acknowledgement
    micro: 150ms           # press release, toggle, small icon swap
    component: 250ms       # a component changes state in place (bump, chip appears, card flips to "done")
    transition: 380ms      # one screen or exercise replaces another
    celebration: 700ms     # a milestone on the D7 list only; once per moment, never per click
  easing:
    standard: "cubic-bezier(.4, 0, .2, 1)"         # moves within the screen; also every press and release
    enter:    "cubic-bezier(0, 0, .2, 1)"          # decelerate: arriving on screen
    exit:     "cubic-bezier(.4, 0, 1, 1)"          # accelerate: leaving the screen
    spring:   "cubic-bezier(.34, 1.56, .64, 1)"    # overshoot: ONLY the D7 milestone list, never routine UI
  press: { scale: 0.97, in: "{motion.duration.instant}", out: "{motion.duration.micro}", easing: "{motion.easing.standard}" }
  bump:  { keyframes: "scale .96 -> 1.035 -> 1", duration: "{motion.duration.component}", easing: "{motion.easing.standard}" }   # select, correct answer, armed CTA
  celebrate-on: [lesson-complete, course-complete, savings-goal-reached, badge-earned, streak-7-days, streak-30-days, streak-100-days]
  idle: { hero-float: 5s, streak-flicker: 2.4s, cta-breathe: 2.6s }   # ambient loops, deliberately not duration tokens; at most three at once (section 9.4)
components:                                         # flat: no ridge, no border on any filled component (section 4.4)
  button-accent:    { backgroundColor: "{colors.accent}",  textColor: "{colors.on-accent}",  typography: "{typography.button}",    rounded: "{rounded.full}", minHeight: "{target.base}", padding: "12px 24px" }
  button-accent-lg: { backgroundColor: "{colors.accent}",  textColor: "{colors.on-accent}",  typography: "{typography.button-lg}", rounded: "{rounded.full}", minHeight: "{target.lg}",   padding: "12px 32px" }
  button-sm:        { typography: "{typography.button}", rounded: "{rounded.full}", minHeight: "{target.min}", padding: "8px 20px" }   # any hue
  button-brand:     { backgroundColor: "{colors.primary}", textColor: "{colors.on-primary}", typography: "{typography.button}",    rounded: "{rounded.full}", minHeight: "{target.base}" }
  button-success:   { backgroundColor: "{colors.success}", textColor: "{colors.on-success}", typography: "{typography.button}",    rounded: "{rounded.full}", minHeight: "{target.base}" }   # sky, mint, berry, reward and error buttons follow the same pattern; roles in section 9.5
  button-secondary: { backgroundColor: "{colors.surface}", textColor: "{colors.content}",    typography: "{typography.button}",    rounded: "{rounded.full}", minHeight: "{target.base}", shadow: "{elevation.control}" }   # no line: surface fill + soft shadow
  button-inverse:   { backgroundColor: "{colors.surface}", textColor: "{colors.content}",    typography: "{typography.button}",    rounded: "{rounded.full}", minHeight: "{target.base}" }   # sits on a coloured band or card
  button-disabled:  { backgroundColor: "{colors.sunken}",  textColor: "{colors.content-disabled}", typography: "{typography.button}", rounded: "{rounded.full}", minHeight: "{target.base}" }
  icon-button:      { backgroundColor: "{colors.surface}", textColor: "{colors.content}",    shadow: "{elevation.control}", rounded: "{rounded.full}", width: "{target.min}", height: "{target.min}" }
  answer-idle:      { backgroundColor: "color-mix({colors.on-primary} 14%, transparent)", textColor: "{colors.on-primary}", typography: "{typography.answer}", rounded: "{rounded.md}", minHeight: "{target.lg}", padding: "16px 20px" }   # inside the full-bleed primary lesson screen
  answer-idle-neutral: { backgroundColor: "{colors.primary-soft}", textColor: "{colors.content}", typography: "{typography.answer}", rounded: "{rounded.md}", minHeight: "{target.lg}", padding: "16px 20px" }   # the same component on a neutral page
  answer-selected:  { backgroundColor: "{colors.primary}", textColor: "{colors.on-primary}", rounded: "{rounded.md}", minHeight: "{target.lg}", mark: ring-and-dot }
  answer-correct:   { backgroundColor: "{colors.success}", textColor: "{colors.on-success}", rounded: "{rounded.md}", minHeight: "{target.lg}", mark: check }
  answer-try-again: { backgroundColor: "{colors.warning}", textColor: "{colors.on-warning}", rounded: "{rounded.md}", minHeight: "{target.lg}", mark: cross }
  choice:           { backgroundColor: "{colors.surface}", textColor: "{colors.content}", shadow: "0 1px 3px rgba(17,19,42,.08)", typography: "{typography.answer}", rounded: "{rounded.md}", minHeight: "{target.lg}" }   # "choose one" on a neutral page (pager, tabs, pickers)
  banner-correct:   { backgroundColor: "{colors.success}", textColor: "{colors.on-success}", rounded: "{rounded.md}", padding: "{spacing.4}", icon: check }   # names what happened
  banner-try-again: { backgroundColor: "{colors.warning}", textColor: "{colors.on-warning}", rounded: "{rounded.md}", padding: "{spacing.4}", icon: cross }   # gives a hint; never a penalty
  identity-card:    { backgroundColor: "{colors.mint}",    textColor: "{colors.on-mint}",    rounded: "{rounded.lg}", padding: "{spacing.5}" }   # swap mint for sky, berry, reward or primary; icon + label always present
  course-card:      { backgroundColor: "{colors.primary}", textColor: "{colors.on-primary}", rounded: "{rounded.lg}", padding: "{spacing.4}", minHeight: "{target.lg}" }   # padding spacing.5 at >=840; hue by course (section 4.3)
  hero-band:        { backgroundColor: "{colors.primary}", textColor: "{colors.on-primary}", rounded: "{rounded.xl}", padding: "{spacing.6}" }   # padding spacing.8 at >=840
  card:             { backgroundColor: "{colors.surface}", textColor: "{colors.content}",    rounded: "{rounded.lg}", padding: "{spacing.5}", shadow: "{elevation.card}" }
  chip-reward:      { backgroundColor: "{colors.reward}",  textColor: "{colors.on-reward}",  typography: "{typography.chip}", rounded: "{rounded.full}", padding: "4px 12px" }
  chip-status:      { backgroundColor: "{colors.success-soft}", textColor: "{colors.success-strong}", typography: "{typography.chip}", rounded: "{rounded.full}", padding: "4px 12px" }   # soft + strong + icon + word, for success / warning / error / sky / primary
  input:            { backgroundColor: "{colors.sunken}",  textColor: "{colors.content}", rounded: "{rounded.md}", minHeight: "{target.base}", padding: "16px 20px", focus: "inset 3px {colors.primary-strong} + 5px {colors.primary-soft} halo", error: "inset 3px {colors.error-strong} + icon + message" }   # no resting line
  dialog:           { backgroundColor: "{colors.surface}", textColor: "{colors.content}", rounded: "{rounded.xl}", padding: "{spacing.6}", shadow: "{elevation.float}", position: fixed }
  collectible-art:  { fill: "{colors.reward}", outline: "{colors.reward-ridge}", outlineWidth: "about 3% of the art's size (4 units in a 120-unit viewBox)" }   # coin, medal, hexagon badge (badge uses its own hue and that hue's ridge; locked = sunken + edge). The only shapes that carry a ridge-colour line.
```

---

## 4. Colour

### 4.1 Measured record

Contrast is WCAG 2.x relative luminance. **128 checks, 0 failures** across both modes (text on fills, ridge against light surfaces, fill boundary against dark surface, strong tones on every surface and soft well, content on every soft well).

| hue | fill | on | on:fill | ridge | ridge vs white | fill vs dark surface | strong on surface (light / dark) |
|---|---|---|---|---|---|---|---|
| `primary` | `#5c55fd` | `#ffffff` | 5.0 | `#4438cf` | 7.7 | 3.6 | 5.4 / 5.6 |
| `accent` | `#eb7301` | `#11132a` | 6.1 | `#be5c01` | 4.4 | 6.0 | 5.3 / 5.5 |
| `reward` | `#ebb806` | `#11132a` | 9.9 | `#a88205` | 3.6 | 9.7 | 5.4 / 5.6 |
| `success` | `#028048` | `#ffffff` | 5.0 | `#005f34` | 7.8 | 3.6 | 5.4 / 5.8 |
| `error` | `#db1b2b` | `#ffffff` | 5.0 | `#ac001a` | 7.6 | 3.6 | 5.3 / 5.6 |
| `sky` | `#4b94ff` | `#11132a` | 6.1 | `#3476d4` | 4.5 | 6.0 | 5.4 / 5.6 |
| `mint` | `#05a893` | `#11132a` | 6.1 | `#018675` | 4.5 | 6.0 | 5.3 / 5.7 |
| `berry` | `#cc2e72` | `#ffffff` | 5.0 | `#a40c56` | 7.6 | 3.6 | 5.4 / 5.5 |

Colour-vision check (Machado 2009 simulation, worst of protan/deutan/tritan, CIEDE2000; heuristic threshold 9, not a standard):

| pair | normal | worst CVD |
|---|---|---|
| `accent` vs `error` | 25 | 12.2 |
| `success` vs `error` | 68 | 11.3 |
| `accent` vs `success` | 54 | 12.4 |
| `reward` vs `accent` | 25 | 10.5 |
| `primary` vs `sky` | 21 | 12.4 |
| `error` vs `berry` | 19 | 11.9 |
| `success` vs `mint` | 18 | 15.1 |

The ceiling is **8 mutually distinguishable solid hues**: 5 are spoken for (`primary`, `accent`, `reward`, `success`, `error`), 3 are free (`sky`, `mint`, `berry`). Adding a ninth requires removing one or accepting a documented collapse.

### 4.2 Reserved meanings

| hue | means | never used for |
|---|---|---|
| `primary` (indigo) | brand surfaces, hero bands, links, focus, progress, selection | actions, errors |
| `accent` (orange) | **the** call to action, the only "press me" colour | categories, achievements, status |
| `reward` (gold) | coins, XP, stars, streak. `warning` is an alias of it | errors, actions |
| `success` (green) | correct, approved, confirm | categories |
| `error` (red) | system errors and destructive actions only | **wrong answers** |
| `sky`, `mint`, `berry` | identity: courses, wallet pockets; `berry` also share and invite | any status |

A wrong answer is `warning` + a cross + informational copy ("Almost there. Try counting by 5s"). Red is not used because it would turn feedback into punishment. That is a convention, not a psychological fact (see 01 §2). A wrong answer also costs nothing: there are no lives (D9), so `berry` no longer has a "lives" meaning (v1 reserved it for a lives chip; that chip is gone).

### 4.3 Identity slots (answers your question 1)

Four courses and three wallet pockets share four identity hues (`primary`, `mint`, `sky`, `berry`). Each meaning is carried three ways at once: colour, icon and label. Hue reuse is scoped to a context (a course view and a wallet view never appear together), and one context never gives one hue two meanings.

| context | hue | icon |
|---|---|---|
| course: first steps | `primary` | sprout |
| course: money basics | `mint` | coin |
| course: start a business | `berry` | rocket |
| course: smart investing | `sky` | chart |
| pocket: save | `mint` | jar |
| pocket: spend | `sky` | bag |
| pocket: share | `berry` | heart |

The split bar under the pockets separates segments with gaps and always sits beside labelled steppers.

### 4.4 No decorative borders — separation is colour, not outline (revised this pass)

**Correction, flagged against the owner's reference material:** the earlier build had drifted into outlining almost everything — 69 separate `box-shadow: inset ... Npx` declarations across the stylesheet, one on nearly every card, button, avatar and control. None of the 17 reference images the owner supplied use that pattern. In every reference, one "box" is told apart from the next by a **change of fill colour**, not by a ring drawn around it. That correction is now the rule:

- **A component with its own solid fill colour never gets a border.** The colour is the boundary. This covers every `.btn`, every identity card, tile, badge, chip and avatar-on-colour.
- **A line is allowed only in three cases, all functional, not decorative:**
  1. **A control with no fill colour of its own**, where colour alone has nothing to contrast against. The mockup solves every such case without a line: text inputs get a `sunken` fill, and the `.secondary` button, the icon button and the neutral `.choice` get a `surface` fill plus a soft elevation shadow. That is the rule. Fall back to a thin (1.5–2 px, `edge`) line only where a fill or shadow would be indistinguishable from the background. (v2 correction: v1 said the secondary button keeps a 1.5 px line; the mockup never rendered one.)
  2. **A real interaction state**: keyboard focus (3 px `primary-strong` outline), a validation error (3 px inset `error-strong` ring on the input, always with an icon and a message), or "this is the one currently selected/current" (the streak strip's "today" marker, a chosen role or tab). These are signals the person needs, not decoration, so they stay.
  3. **Illustrated collectibles** (the coin, the medal, the hexagon badge) are drawn with a thin outline and inner detail in their own `{hue}-ridge` tone (about 3% of the art's size). That line is part of the drawing, for legibility at small sizes, not a border around a component; it is never applied to buttons, cards, chips or avatars.
- **A surface with no colour of its own** (a white card on a light page, a dialog, a toast, a table) is separated by a **soft elevation shadow** (`0 1px 3px rgba(17,19,42,.08)` for resting cards, `var(--shadow-float)` for floating overlays) — never by an inset outline. This is the legitimate "elevated card" pattern (Material Design's *filled* or *elevated* card types), not a contour.
- When two adjacent things need to read as clearly different and a fill/shadow difference genuinely is not enough (this should be rare), the fallback is a colour change, not a border — e.g. the featured plan on the mockup's (parked, OD-5) pricing page is a full `primary` fill rather than a card with a thicker outline.

### 4.5 Full-bleed colour screens (revised this pass)

The owner's reference set uses full-bleed colour for entire screens at specific moments — an onboarding "sun" screen, a "YOU WON" result, a "B2 Level Test" question screen — not a coloured card floating on a neutral background. That distinction had been lost: the lesson and result screens were previously a coloured card inside a white/neutral page.

**Rule:** a screen that represents a single state — a lesson in progress, a result, an onboarding step, a celebratory or congratulatory moment — fills its **entire** background with one dominant hue; every element on it (text, answer rows, feedback banners, stat tiles) is a tint or a contrasting fill of that same hue family, not a jump to a neutral white surface. A dashboard-style screen with many independent pieces of content (the app home, a data table, a settings page) is the other case, and stays a light/dark neutral page with coloured cards on it — that composition is also present in the references (the `Alysia Dermott` dashboard, the `Hi, Alysia` course tiles) and should not be forced full-bleed.

**Exception: the compact Mentor stage in the lesson player (v3, OD-15, B.8).** A lesson screen may carry the compact stage defined in `08` §11: the character on its Diorama in a band at the top (phone) or a side column (desktop), which may show the active adventure's scene inside that band. The rest of the screen keeps the single dominant hue.

**Exception: the teaching-visual board (v2, OD-4). A lesson screen that contains a teaching visual (a chart, mathematical representation, logic visual or money manipulable) places it on one neutral **board** (`surface` / `dark-surface`), specified in `05-TEACHING-VISUALS.md`. It is the only neutral surface allowed on a full-bleed screen, and it exists for a functional reason: data marks need a neutral ground to reach 3:1 contrast and to keep the reserved hues (`accent`, `reward`, `success`, `error`) from being confused with data. Everything around the board stays in the screen's hue family.

| screen | before | now |
|---|---|---|
| Lesson (question in progress) | white/neutral page, indigo question card | full indigo background; answers and feedback are tints/fills of indigo, success or warning |
| Result (lesson complete) | indigo top band, white stat sheet below | full accent-orange background; the stat sheet and "today vs best" card are translucent tints of the same orange, never white |
| App home, staff table, settings | (unchanged) | stays a neutral page with coloured cards — this is the correct pattern for a dashboard, not a screen to force full-bleed |

---

## 5. Dual mode

| changes with the mode | does not change |
|---|---|
| `base`, `surface`, `raised`, `sunken`, `outline`, `edge`, `content*` | every `{hue}` fill |
| `{hue}-strong` (light: deep, dark: light tone) | every `{hue}-ridge` |
| `{hue}-soft` (light: pale, dark: deep tint) | every `on-{hue}` |
| ambient shadow (light only) | |

- Dark elevation is a lighter surface step (`sunken` < `base` < `surface` < `raised`), never a shadow.
- Because fills are invariant, a bright fill on a dark surface has 3.6–9.7:1 boundary contrast. On a white surface there is no ridge to lean on (flat system): deep fills (`primary`, `success`, `error`, `berry`) reach 5.0:1 on their own, `accent`, `sky` and `mint` reach 3.0:1, and `reward` only 1.8:1, so a `reward` fill is never the only thing that makes an element findable; it always carries ink text or an icon (values from the mockup's system sheet).
- Focus ring: 3 px `primary-strong`, 3 px offset, on every pressable. `primary-strong` reaches 5.4:1 (light) and 5.6:1 (dark).
- `content-faint` from the old file is **removed**. A token that fails 4.5:1 will be misused as text. Use `content-disabled` for disabled states only (WCAG exempts them).
- `outline` (about 1.2:1) is a decorative divider. Any boundary a control needs to be found by uses `edge` (at least 3:1).
- Adding a hue: pick a class (`deep` = white text, luminance about 0.16; `bright` = ink text, luminance about 0.30), solve `fill`, derive `ridge` (at least 3:1 on light surfaces), then `strong` and `soft` per mode, then run the matrix. Do not hand-pick.

---

## 6. Typography

- **Fredoka** (display, headings, button labels): rounded, character, and measured about 2% narrower than Nunito at weight 700, so a button label is not wider for being playful.
- **Nunito** (text, labels, numerals): the readable workhorse. Digits are fixed-width by default, so counters do not jitter while animating (Fredoka's digits are proportional).
- Both are OFL. Self-host the Latin subset as variable woff2 (about 29 KB and 38 KB). Latin covers every Spanish and Portuguese glyph checked (`¿¡ñáéíóúüãõâêôç`).
- Not chosen: Baloo 2 (cap height 14% smaller, reads as 14 px at 16 px), Poppins (about 13% wider than Nunito at weight 700, more clipping risk). Baloo 2 stays wired as a switch in the prototype.
- Evidence note: I found no strong evidence that a display typeface improves children's reading. What is supported is size, spacing and avoiding italics and all caps. The choice rests on character and measured width, not on a legibility claim.
- Sizes are **fixed steps, not fluid `clamp()`**: display and numeral sizes change at two `app` container widths (640 and 1120 px), so the type responds to the component's width, not the window, and every size belongs to the named scale (values in the section 3 YAML; rationale in `03` §3.2). v1 said "fluid `clamp`"; the mockup never used `clamp()`.

---

## 7. Text Fit Contract (D1)

**Why it is a contract and not a guideline.** On this platform's own sample (21 UI strings) Spanish and Portuguese run wider than English by these factors:

| strings | ES mean / max | PT mean / max |
|---|---|---|
| short (12 strings, 10 characters or fewer in English) | x1.37 / x2.02 | x1.38 / x2.29 |
| longer (9 strings) | x1.19 / x1.38 | x1.25 / x1.42 |

The worst case is "Share" → "Compartilhar" (x2.29). Short labels are exactly where fixed widths break. The sample and its translations are mine and illustrative; native review is still needed.

**Rules**

1. Forbidden on system-authored text: `text-overflow: ellipsis`, `-webkit-line-clamp`, fixed `height` or `width` on anything containing text, `overflow: hidden` used to hide text.
2. Size to content: `min-height` (the touch floor) plus padding. Buttons wrap to as many lines as they need and grow.
3. Groups of buttons and chips use `flex-wrap` with `flex: 1 1 auto`, never a fixed-width grid column. `width: 100%` is only used where the container is guaranteed wider than the longest label.
4. Every button carries `min-inline-size: min-content`, so it cannot be squeezed narrower than its longest word.
5. Every flex or grid child that holds text sets `min-width: 0` **or** relies on `min-content`. Choose deliberately.
6. Rows with a label and a control use `flex-wrap`: the control drops to its own line when the label needs the room (wallet pockets). Do not rely on a breakpoint.
7. Prose: `hyphens: auto` with the right `lang` (`en-US`, `es-MX`, `pt-BR`), `overflow-wrap: break-word`, `text-wrap: pretty`. Headings: `text-wrap: balance`. Buttons and labels: `overflow-wrap: break-word` as a last resort, never as the plan.
8. User-generated tokens (names, nicknames, emails) carry `.ugc`: `overflow-wrap: anywhere; hyphens: none; min-inline-size: 0`. This rule must come **last** in the stylesheet; it lost to `.btn` during testing.
9. Reflow before crop. Layouts change shape by **container width** (`container-type: inline-size`), never by viewport, so a component in a narrow column behaves like a narrow screen. Below 400 px the hero art moves above the text; below 360 px inactive tabs become 48 px icon buttons and only the active tab shows its label (its name stays available to assistive tech).
10. New copy is a design change: any new or translated string must pass the audit below **and the Copy Budget audit (`06` §7)** before merge.

**Verification performed** (Chromium, automated). Checks per element: ellipsis, line-clamp, horizontal or vertical clipping, text outside the frame, any word wider than its box (measured with canvas), any tap target under 48 px, page-level horizontal scroll. Each matrix runs twice, the second time with the WCAG 1.4.12 overrides (letter-spacing 0.12em, word-spacing 0.16em, line-height 1.5).
- *First pass (7 screen states, 336 configurations):* four real failures found and fixed at the root, none by shrinking text: tab bar targets of 43 px at 320 px; wallet labels squeezed to 51 px; a 149 px Portuguese title in a 124 px column; and a `.btn` rule that overrode `.ugc` so a long nickname overflowed.
- *Final build, as reported by the original session:* 1,440 configurations with normal text and 1,440 with forced text spacing, across all 14 routes, 0 issues, 0 JS errors; 168 proportion/composition page states, 0 findings (`03` §5). The exact state list behind "1,440" was not delivered (14 routes × 3 languages × 2 themes × 4 widths × 2 text sizes is 672), so that figure cannot be reproduced as stated.
- *v2 re-run (2026-09-20, reproducible):* `verification-tools/text-fit-audit.reference.mjs` v2 replaces the stale v1 tool (which drove `#screen=` and `S.screen`, so it audited only the landing page and passed vacuously). It audits 16 states (the 14 routes, with the lesson in its three answer states) × 3 languages × 2 themes × 4 widths × 2 text sizes = **768 configurations per run**, and skips visually-hidden elements (the `.sr-only` / `clip: rect(0 0 0 0)` pattern). Result: **normal text, 0 issues; WCAG 1.4.12 text spacing, one real defect** (12 hits): the Portuguese course title "Investimento inteligente" on `home` at 375 and 768 px, where the word "Investimento" (145 px with the spacing overrides) is wider than its 130–139 px column and spills into the card's padding. Not fixed in the mockup (it is frozen); the rule it breaks is rule 5 above, and the fix belongs in the product build (the course grid must not make a column narrower than its longest title word; reflow to one column instead). Listed in `../mockup/KNOWN-DEVIATIONS.md`. 0 JS errors.
- *v2.1 mockup (2026-09-20, re-run independently):* the mockup now implements the owner decisions (17 routes: landing, how, families, signup, login, notfound, home, lesson, result, board, mentor, tasks, wallet, me, parent, staff, system; 41 audited states). Text fit: **1,968 configurations with normal text, 0 issues; 1,968 with WCAG 1.4.12 text spacing, 0 issues** (41 states × EN/ES/PT × light/dark × 320/375/768/1280 px × normal/+40% text). Proportion: **492 page states, 0 findings**. 0 JavaScript errors. K39 is fixed at the root (the course grid reflows before any column gets narrower than its longest title word).
- The tools are still coupled to the mockup's state hooks (`S`, `render()`); auditing the real application needs a new driver, with the same checks.

---

## 8. Touch targets

| tier | size | mm on a phone | used for |
|---|---|---|---|
| `target-min` | 48 px | about 7.5 | any interactive element, icon buttons, inactive tabs |
| `target-base` | 56 px | about 9 | buttons, nav items, list rows |
| `target-lg` | 64 px | about 10 | primary CTAs, answer options, tab bar |

Tiers follow function (how costly a miss is), never audience, so the one visual language holds.
Grade: the evidence says misses fall as targets grow for young children; it does not give a threshold. These numbers are a design judgement, not a measured optimum. Open: whether 64 px should be the global minimum.

---

## 9. Gamification of controls (D6, D7)

Gamification is high in feel (D6) and celebration is budgeted (D7). It is implemented through **colour, shape and feedback motion** — never through simulated depth, and never through celebrating every action. **This is a revision from the first version of this document**, corrected against the owner's reference material: the earlier system gave every pressable a 6px ridge, a gloss highlight and a periodic shine sweep, which read as heavier and more "3D" than the flat-tactile references call for. That treatment is now reserved for characters only (the owner's direction: "only characters are 3D, nothing else is"). Buttons, cards, tiles and badges are flat.

### 9.1 The flat button
- **Colour fill only, no border of any kind** (revised this pass, see 4.4) — the fill is the boundary. Pill radius, label in Fredoka 600. No gloss gradient, no shine sweep, no drop-shadow ridge, no inset outline.
- **Press:** the button scales to 0.97 over `--dur-instant` (80 ms) and returns over `--dur-micro` (150 ms), both with `--ease-standard`: no overshoot (D7). A soft ring ripples from the touch point. Haptic tick where supported. (The mockup presses in over a hard-coded 60 ms and releases with the spring curve; that is a known deviation.)
- **Armed:** when a disabled button becomes usable it bumps once (scale .97 → 1.02 → 1, `--dur-component`, `--ease-standard`).
- **Pulsing CTA:** the one emphasised CTA per screen gets a slow (2.6s) breathing glow around its edge — a soft outward halo in its own colour, not a moving highlight — so there is still exactly one thing drawing the eye without adding visual weight to the object itself.
- **Disabled:** flat fill in `sunken`, `content-disabled` text.
- **`.secondary`** (no fill colour of its own) is a `surface` fill with a soft elevation shadow (`elevation.control`), no line; this is what the mockup renders (v1 described a 1.5 px line that was never built). Every other variant is colour-only.
- Applies uniformly to icon buttons, answer options, course cards, row cards, identity tiles and badges: colour fill or a soft elevation shadow on a neutral surface, never an inset "3D" outline.
- Coins, medals and hexagon badges are single-layer flat shapes with a thin outline in their own `{hue}-ridge` tone for legibility at small sizes (section 4.4, exception 3: part of the drawing, not a component border). The earlier double-layer offset disc (a drop-shadow disc duplicated and shifted a few pixels down, plus a diagonal gloss stroke) is removed for the same reason.

### 9.2 Feedback grammar
| moment | response |
|---|---|
| select an answer | bump (scale .96 → 1.035 → 1, standard easing), ring-and-dot mark, "Check" arms |
| correct | green row bumps, mark becomes a check, informational `success` banner that names what happened, progress bar advances (`--dur-component`, standard easing). **No confetti, no "+XP" floater** (D7): XP is tallied and shown on the lesson-complete screen |
| not yet | wobble on the chosen row, cross mark, `warning` banner with a hint. No confetti, no red, and nothing is spent: there is no life or heart counter (D9) |
| several consecutive misses on the same skill | the learner's Mentor character offers a guided review of that skill (an offer the learner can decline; never a penalty, a lock or a lost resource). The threshold is a product parameter (proposed: 3; owned by the Pedagogical Lead, per `10` B.26) |
| confirm the coin split | a confirmation: the split settles into place and a short status message states the result (e.g. "Saved: 10 save, 5 spend, 5 share"). No confetti, no XP floater |
| lesson complete (milestone) | medal pops (`--ease-spring`, `--dur-celebration`), stat tiles rise in sequence, numbers count up (fixed-width digits so nothing reflows), bars fill. A confetti burst is permitted here |
| other milestones on the D7 list (course complete, savings goal reached, badge earned, streak at 7, 30 and 100 days) | one celebration per moment, same budget as lesson complete. Nothing else celebrates |

### 9.3 Guardrails that keep "high" from backfiring (evidence in 01 §3)
- Feedback is **informational**: it says what happened and what to try. Tangible rewards handed out for doing a task reduced intrinsic motivation in a 128-study meta-analysis, more so in children; informational feedback did not. So celebrate progress and mastery; do not dangle or take away rewards.
- No guilt copy on streaks, no "you lost" states. Streak rules: section 9.6.
- Mistakes cost nothing (D9). The product targets a 70–85% practice success band, so with a three-life mechanic a large share of lessons would end in a "no lives left" state by design (decision log, OD-1).
- Effects of gamification on learning are small on average (motivational g = 0.36, cognitive g = 0.49). The design does not depend on it to teach; it depends on it to make the practice feel good.

### 9.4 Motion budget
- **Idle motion is allowed on three things only:** the hero object (5 s float), the streak flame (2.4 s flicker), one soft breathing-glow CTA per screen (a border halo, not a moving highlight). **v3:** on a screen with the Mentor stage (`08`), the character's catalogue idle loop takes the hero object's place. It is one of the three, never a fourth.
- Everything else moves only in answer to a tap or a screen entrance (one choreographed entrance per screen).
- **Celebration budget** (D7): confetti, XP floaters and `--ease-spring` overshoot occur only on the closed milestone list, once per moment. Everything else uses the standard, enter and exit easings.
- `prefers-reduced-motion: reduce`: every state and colour change still happens; transitions, confetti, count-ups, the pulse glow, float and flicker are skipped, and bars jump to their value.

---

## 9.5 Colour and shape as taught conventions, not psychological levers

The owner asked for colour psychology and shape to inform buttons and components. I looked for evidence that a specific button hue (as opposed to contrast with its surface) measurably changes behaviour, and for evidence on children's colour associations specifically.

- **Children do associate bright, saturated colours with positive emotion and dark/muted colours (brown, black, grey) with negative emotion** (Boyatzis & Varghese 1994, 60 children aged 5–6.5). Grade **C**: one study, a small sample, and it says nothing about which specific bright hue to use for which specific action.
- **The "this button colour converts better" claims that circulate in marketing blogs are not good evidence.** The most-cited example (red outperforming green) confounded colour with contrast against the page background in the original test. What has real, repeated support is that **contrast against the surface and consistent use of a hue for one meaning** drive recognition — not the hue itself. Grade: **A for contrast/consistency mattering, D-and-below for any specific hue "meaning" something universally.**

**Decision:** hue is a **taught, in-product convention**, documented once and used consistently, not a claim that orange "means" urgency or green "means" safety to everyone who opens the app. This is stated as the operating principle in the system sheet itself so an agent extending the product does not reach for hue as a persuasion lever.

### Button colour roles (all fills verified against their `on-*` text at ≥4.5:1; ratios shown are what the prototype's system sheet computes live)

| Role | Hue token | Use | Notes |
|---|---|---|---|
| Accent | `accent` | The one primary action per view (`Start free`, `Continue`) | Reserved — see D5/section 4.2, unchanged. "Free to start" is allowed copy; "always free" is not (OD-5) |
| Success | `success` | Confirm, approve, continue after a correct answer | |
| Primary | `primary` | Brand actions, navigation to another place in the product | |
| Reward | `reward` | Claim or view coins/XP, the streak chip | Same token as `warning`/alias (section 3 of the original palette work) |
| Sky | `sky` | Get help, learn more, secondary informational actions | |
| Mint | `mint` | Save, saving-related actions | |
| Berry | `berry` | Share, invite | v1 also listed a "lives" chip; removed in v2 (no lives, D9) |
| Error | `error` | Destructive actions only (`Remove family`), always behind a confirmation dialog | Never used for "wrong answer" — that stays `warning`/wobble, no red, per D-earlier decision |
| Secondary | neutral surface + soft shadow | Cancel, back, lower-priority choice next to a coloured primary | No line (section 4.4) |
| Inverse | surface-on-colour | A button that sits on top of a coloured band or card; the white fill against the band is what makes it read as pressable | Needed once cards themselves became coloured (feature cards, the CTA band). v1 said its "ridge borrows the card's colour"; no ridge is rendered |

### Shape by object type
Shape is likewise a recognition convention, not an emotional claim, stated as such in the system sheet:

| Shape | Meaning | Component |
|---|---|---|
| Pill | Do something | `.btn` |
| Rounded rectangle | Choose one (of several) | `.answer`, `.choice` — shared component, so an answer option and a segmented choice (a pager, a picker) are visibly "the same kind of control" |
| Circle | One icon action | `.icon-btn` |
| Hexagon | Collectible | badge component, `hexBadge()` |
| Coin | Currency | the coin SVG, used only for money, never decoratively |
| Capsule | Progress | `.bar` |

---

## 9.6 Streak design (owner delegated this decision to design judgement)

No good evidence exists on streak-forgiveness mechanics specifically — what's published is almost entirely vendor blogs and growth-marketing case studies (grade **D**). The rule below leans on the one strong, relevant finding already in `01-RESEARCH-FOUNDATION.md`: controlling, contingent rewards **reduce** intrinsic motivation, more so in children (Deci, Koestner & Ryan 1999, 128 studies, grade A) — which argues directly against streak mechanics that punish or guilt a lapse.

**Rule, implemented and shown in the prototype's "How it works" page, profile page and system sheet:**
1. Two rest days a week are free and automatic — not earned, not purchased with coins.
2. Best streak and total days practiced are permanent stats and are never erased by a broken streak.
3. Parents can pause a streak for holidays from the family controls.
4. No loss-framed or guilt-framed copy, ever. A broken streak shows as "Streak resting" with the best-streak number still visible, not a "you lost your streak" state.
5. Only the 7-, 30- and 100-day milestones celebrate (D7). An ordinary practised day updates the strip without a celebration.
6. Rest days, streaks and error forgiveness can never be sold, even if a paywall is introduced later (OD-5), and are never called a "streak freeze" (glossary, section 1.2).

This is a design decision under real uncertainty, not a measured optimum — flagged as such in section 12.

---

## 9.7 3D character and image slots

**v3 (OD-14, OD-15):** the full asset rules are in `07-ICONOGRAPHY-AND-VISUAL-ASSETS.md` and the Mentor screen is specified in `08-MENTOR-STAGE.md`. Our own assets are generated by the frontend agent in the house style (`07` §3); characters are rendered from the real 3D models and the pose catalogue in the project folder (`07` §4); both pass the review gate in `07` §7. This section defines the **slot** each asset fills. **Exception:** the Mentor stage is not a slot. It is a full-bleed scene sized by `08` §2 and §6 (and the compact stage in the lesson player by `08` §11), and those sizes win over the square in-app character slot below.
- Slots are visually marked in the prototype (`Art slots` toggle in the stage bar) with a label stating exact aspect ratio and purpose, e.g. "Hero character · 4:5 · transparent."
- Every slot: transparent background, a stated aspect ratio (square for in-app character slots, 4:5 portrait for marketing hero/scene art), and the hard rule that **the asset itself never carries text** — any label, price or instruction is a separate DOM element layered by the system, never baked into the image. This keeps every string inside the Text Fit Contract and translatable.
- Placeholder art in the prototype (the coin, the medal) is vector, built from the token colours, and stands in only until real assets land in these slots — it is not a proposed final style.
- **The Mentor characters exist** (OD-6): four 3D characters, Dr. Rho, Zara, Liruf and Dina, are available as 3D assets. The learner chooses one; that character fills every Mentor slot (lesson prompt, help entry point, guided review), and the learner's navigation tab shows the chosen character's name and avatar instead of a generic label. Parent and staff views, and all documentation, say "Mentor"; the AI is never labelled "Tutor". How present the character is (size, frequency, voice) varies by age band (D8); the slot rules above do not.

---

## 9.8 Forms, tables and overlays

Added this pass, since the marketing site and staff view introduced controls the original app screens didn't need:

- **Inputs** never clip a value: a single-line text value scrolls natively inside its box; labels, hints and error messages always wrap. A field's minimum touch height matches `target-base` (56px); the visible width, not just height, of every control is included in the 48px minimum, which the mechanical audit checks directly (adjacent-target spacing, section 5 of `03-PROPORTIONS-AND-COMPOSITION.md`).
- **Errors** always pair an icon with text — never colour alone — and sit directly under the field they describe.
- **Tables** collapse into stacked cards below an 840px container width; each cell keeps its label visible (`label: value` stacked, not truncated side-by-side) and text wraps rather than clipping, including the one deliberately unbreakable stress-test name in the sample data (`Alessandro_Bartolomeo_Villanueva_Rodriguez_2014`).
- **Dialogs and toasts** sit on a scrim, always paired with a text description of the consequence (not just a colour), and a destructive action always has an explicit "keep/cancel" option offered before the destructive one.
- **z-index order**, now fixed so overlays never fight each other: sticky nav (30) → mobile menu sheet (50) → dialog scrim (65) → toast (70).

## 9.9 Motion — the full system lives in `04-MOTION.md`

A dedicated research pass (owner's explicit request: motion is a core gamification carrier and deserved its own session, not a subsection of general UI work). Summary of what an agent needs to know; see `04-MOTION.md` for the evidence, the full duration/easing token table, and the three orchestrated patterns built this pass.

- **Five duration tokens in three categories** (state-layer feedback, component state change, transition), named by what the movement represents: `--dur-instant` (80ms, state-layer feedback), `--dur-micro` (150ms, press/release), `--dur-component` (250ms, a component changes state in place), `--dur-transition` (380ms, one screen/exercise replaces another), `--dur-celebration` (700ms, a milestone on the D7 list, once per moment never per click). Easings: `--ease-standard`, `--ease-enter`, `--ease-exit`, and `--ease-spring`, which is reserved for the D7 milestones.
- **The evidence ceiling on "juice":** Kao (2020) found medium/high levels of audiovisual feedback outperform both none and extreme levels — the strongest single finding behind every rule here. Motion always has to answer "what does this communicate," never added for its own sake.
- **The scene's own elements participate**, rather than a floating element entering from nowhere: an exercise slides out as the next one slides in (not an instant swap); an approved chore is covered by a solid success-green panel that wipes away to reveal its own updated state (not a toast layered on top); a streak strip's seven days rise in a left-to-right wave matching what the component means (a completed sequence), reserved for that one component rather than applied generically.
- **Orchestration (stagger)** on collections — badges, lists — fires only on genuine route entry, never on an in-place re-render from an unrelated interaction on the same screen. This is enforced in code, not just intended: toggling an unrelated control never re-triggers a stagger or a wave.
- **`prefers-reduced-motion` is checked everywhere**, either via the `REDUCED()` JS helper (Web Animations API sequences) or an `@media (prefers-reduced-motion: no-preference)` CSS guard (so reduced-motion means the keyframe animation is absent, not present-and-skipped). Every state change still happens; only the travel is removed. Grounded in WCAG 2.3.3 and the finding that ~35% of adults over 40 have some vestibular sensitivity, and that what triggers a reaction is the size of a movement relative to the screen, not which CSS property moves.
- **Idle "alive" loops** (the hero float, the streak flame flicker, a pulsing CTA) deliberately do not use the transition-duration tokens — they are ambient rhythm, not state transitions, and forcing a 5-second float onto a 380ms scale would misrepresent what it is. The existing motion budget still caps this at three things at once (section 9.4).

---

## 10. What changed from the previous file

**v3 (2026-09-21): owner review of the v2.1 screenshots.** New decisions D11 (copy budget, OD-13), D12 (own visual assets, OD-14) and D13 (the Mentor stage and the replacement of the legacy UI, OD-15); mechanical rules 19–23; new chapters `06`, `07` and `08`; new tool `copy-budget-audit.reference.mjs`; the mockup's copy, icons and Mentor screen recorded as deviations K40–K42.

**v2 (2026-09-20): owner decisions OD-1…OD-12 applied; internal inconsistencies F1–F12 fixed** (both from `12-PRODUCT-FRONTEND-IMPORT-READINESS-REVIEW.md` and `13-OWNER-DECISION-LOG.md`). The mockup was not changed; where it now contradicts this file it is listed in `../mockup/KNOWN-DEVIATIONS.md`.
- *Owner decisions.* D6 and D7 rewritten (high feel, budgeted celebration on a closed milestone list; OD-7). D8 rewritten (one design system for every surface and user; age registers by content; OD-4). New D9 (no lives, guided review by the Mentor; OD-1) and D10 (Tutor = verified parent, the AI is the Mentor; OD-6). New sections 1.1 (mockup is a visual reference, not scope; access model; pricing parked; naming) and 1.2 (controlled glossary, AI translation, recommended native review; web first with the React Native equivalents and store policies to check). Rules 17 and 18 added. Sections 4.2, 9.1–9.7 and 9.9 updated to match.
- *F1.* YAML components regenerated from the rendered mockup: no `depth` tokens, no `ridge` on any component, secondary button without a line; new `elevation`, `focus`, `input`, `dialog`, `choice`, `banner-*`, `course-card` and `collectible-art` entries. `{hue}-ridge` colours kept, and their two remaining uses stated (section 3).
- *F2/F3.* YAML motion block replaced with the `04` tokens (80/150/250/380/700 ms; standard/enter/exit/spring). "Three tiers" corrected to "five duration tokens in three categories". Spring is milestone-only everywhere (D7, section 9.1, `04` §2).
- *F4 and F12.* Per-click celebration and the lives mechanic removed (D7, D9, section 9.2).
- *F5.* Type is fixed steps, not `clamp()`, in section 6, the YAML and `03` §3.2, with the mockup's step values.
- *F6.* YAML spacing scale now equals the mockup's `--s-1` … `--s-32` (4–128 px).
- *F7.* Borders: sections 4.4, 9.1 and this changelog agree with the mockup (no lines on filled components or the secondary button; functional lines only; the collectible-art outline stated as an explicit exception).
- *F8.* Duplicate rule 14 renumbered (rules 15 and 16 follow); open item 9 now cites the accent rule where it actually lives.
- *F9.* Section 7 verification brought up to date, including the v2 tool re-run and the one real text-spacing defect it found.
- *F10.* Stale file names replaced: `littlefounders-site-and-app.html` (header) and `tools/…` (section 7) here, and `littlefounders-prototype.html` / `/tmp/...` defaults in the tool headers. The review's "mockup comment citing `03-MOTION.md`" could not be found in the delivered mockup; see the deviations file.
- *F11.* `01` status line corrected: it is the evidence base behind these rules, and final.
- Also: section 5 no longer claims a ridge separates fills from light surfaces; the section 9.5 role table and shape table no longer rely on the pricing page or on ridges.

**v1 history** (kept as written, except where a v2 note says otherwise):

Glass, Lumen and Tactile materials removed. `accent` value is now orange (its meaning, "the call to action", is unchanged). `primary` `#4f46e5` → `#5c55fd`. `delight` (violet) removed: a violet distinct enough to count as its own hue collapsed with indigo under colour-vision simulation (ΔE 6.3 measured for a hue-318° violet). `warning` is an alias of `reward`. `content-faint` removed. `edge` added. Radii 10/16/24/32 → 12/20/28/36 (proposal, see section 11). Sora/Inter → Fredoka + Nunito. Touch 44 → 48/56/64. Minimum text 12 → 14 px. `dark-` naming kept.

**Correction this pass, flagged by the owner against the reference material:** the button/card system had drifted into a heavier "3D" treatment than the references call for — a 6px ridge, a gloss highlight and a periodic shine sweep on every pressable surface, plus a duplicated offset disc under every coin/medal/badge. The owner's direction is explicit: **3D is reserved for character assets only** (the owner's direction: "only characters are 3D, nothing else is"). Section 9.1 now specifies a flat system — colour fills with no relief (an interim build drew thin inset borders instead; all of them were removed in the border correction below, so no filled component has a line), scale-based press feedback instead of `translateY`, a soft border-glow pulse instead of a moving shine sweep. Colour, shape and motion-on-tap remain the carriers of the gamified feel; simulated depth is no longer one of them. This is exactly the kind of correction meant to happen at the mockup stage and be written back into this file, rather than discovered later in production.

**Also fixed this pass — overlay positioning (grave, reported by the owner):** dialogs and toasts used `position:absolute`, which anchors to the full scrollable content area rather than the visible viewport. On a long page, a dialog opened after scrolling down would render off-screen, appearing only if the user scrolled further. Both now use `position:fixed`, anchored to the true viewport regardless of page length. A related bug was fixed alongside it: re-rendering after a state change (opening a dialog, a toast appearing) was resetting scroll position to the top; scroll position is now preserved across in-place re-renders and only reset on an intentional route change.

**Correction this pass, flagged by the owner directly against the 17 reference images supplied:** the design still read as generic against the references in two further, more fundamental ways.
1. **Borders.** The stylesheet had 69 separate decorative border declarations — one on nearly every card, button, avatar and small control. None of the reference images use this pattern; separation between elements is consistently a change of fill colour, or for neutral surfaces a soft elevation shadow, never an outline. All decorative borders are removed (section 4.4); the handful that remain are functional (keyboard focus, form validation errors, a "this is the current/selected one" marker) and were kept deliberately, not missed.
2. **Full-bleed colour screens.** Several references (an onboarding "sun" screen, a "YOU WON" result screen, a full-screen language test) use one dominant hue across the *entire* screen for a single-state moment, not a coloured card sitting on a neutral background. The lesson and result screens were rebuilt this way (section 4.5); dashboard-style screens with many independent pieces of content correctly stay as a neutral page with coloured cards, matching the references that show that pattern instead.

Also added: rule 16 in section 2 (numbered 15 before v2) prohibits the em dash in UI copy, since it reads as a stylistic tell of AI-generated text (flagged by the owner; independently corroborated by public style guides that call out the same pattern, e.g. Home Assistant's documentation guide: "avoid excessive use of em dashes, often used by AI").

While applying the border removal, two real contrast bugs were caught and fixed: the pagination control on the staff table had unselected pages rendering nearly invisible (white text on a near-white fill) once its border was removed, and the four answer-state examples on the "How it works" marketing page inherited a colour meant only for the indigo lesson background, making the "Choose" (idle) state unreadable outside that context. Both are fixed and re-verified.

**This pass — a dedicated motion research session (owner's explicit request):** built a full duration/easing token system (the "+XP"/confetti feedback it kept on correct answers and coin splits was withdrawn in v2, D7) and three orchestrated animation patterns, documented in full in `04-MOTION.md` (section 9.9 above is the summary). The lesson screen gained a real 4-exercise sequence per language (previously one hardcoded question) with a choreographed slide transition between exercises; a chore-approval flow gained a success-wipe where a solid green panel covers and then reveals the row's own updated state; the streak strip gained a left-to-right wave entrance; badge grids gained a capped stagger reveal. Two bugs were caught mid-build and fixed: the lesson's bottom action bar was snapping to the new question's state while the old question's card was still visibly sliding out (fixed by cross-fading the foot in sync with the slide), and adding an "Approve" button to the chore row crowded the task title into an ugly wrap on narrow screens (fixed with a responsive flex layout, verified at both 375px and 768px). Re-verified against the full suite after every change: 0 issues across 1,440 normal-text and 1,440 forced-text-spacing configurations, 0 findings across 168 proportion/composition page-states, 0 JS errors across all 14 routes.

---

## 11. Open items

1. **Radii** 12/20/28/36: chosen by eye against the references, not measured. Confirm visually in the prototype.
2. **64 px as the global minimum** touch size, or keep the three tiers?
3. **Icon disc above a heading** (course cards, tiles, pockets): a pattern often flagged as generic. Here it is literal identity content and the references use it. Accepted, watched.
4. ~~**Streak mechanic**~~ — resolved this pass, section 9.6. Still a design judgement under real uncertainty, not a measured optimum.
5. **3D character assets:** slot spec is defined (section 9.7). The four Mentor characters (Dr. Rho, Zara, Liruf, Dina), the Diorama and the pose catalogue exist in the project folder (OD-6, OD-15). Hero and scene art is generated by the frontend agent in the house style under the `07` review gate (OD-14); the first asset of each family needs the owner's style approval.
6. **Sound:** haptics are wired, sound is not. In scope?
7. **Copy:** all strings in the prototype are my sample translations. Production copy is AI-translated from the controlled glossary (section 1.2, OD-11); native review of the registration, consent and money screens is recommended and not yet confirmed by the owner. The expansion factors in section 7 should be re-measured on that copy.
8. **Nav breakpoint:** the inline marketing nav needs a 1120px container to fit ES/PT labels without crowding; below that it is the hamburger menu. Confirm this threshold holds once real copy (not my sample translations) is final.
9. **"One accent per view"** (section 4.2, `accent` is "**the** call to action"; the section 9.5 role table, "the one primary action per view"; `01` §1 pattern 5) is stricter than the shipped marketing site, which allows one accent-hued CTA per section plus the persistent one in the nav. Proposal: amend the written rule to match, since the stricter version was never really followed once the site grew past a single screen.
10. **Focus management** (focus trap inside a dialog, returning focus to the trigger on close) is not implemented in the prototype. Needed before this ships as production code, not just a design reference.
11. ~~**Native export technology**~~ — closed by the owner: the mobile app uses a wrapper sharing the web frontend (OD-12 §9). Wrapper vendor, safe-area behavior and store-policy validation remain implementation tasks.
12. ~~**Self-registered teens and the wallet**~~ — resolved: OD-3 Option B (personal wallet without a parent; Tasks and approvals guardian-only), shown in the v2 mockup.
13. ~~**Teaching visuals**~~ — specified in `05-TEACHING-VISUALS.md` (board, viz tokens, interaction and accessibility contract); catalogue and evidence in the Product package's Appendices A and P. Three board demos (number line, discount predict-then-reveal, IF–THEN rule builder) are built in the v2.1 mockup's `board` route and pass the general text-fit and proportion audits; the board-specific checks in `05` §8 are still to be written, so those rules are not yet machine-verified.
14. **Pose catalogue coverage:** at import, check that the catalogue covers every Mentor state in `08` §3 (idle, listening, thinking, speaking, demonstrating, encouraging, celebrating, closing). Missing poses are added to the catalogue before the stage is built, never improvised.
15. **Mentor stage budgets** (`08` §7: first render under 2.5 s, 30 fps minimum) and asset size budgets (`07` §3.2) are design judgements. Measure them on real devices and revise.
16. **Copy budget numbers** (`06` §3) are design judgement calibrated on the mockup. Revise them only with usability evidence, never by raising a limit for one string.

## 12. What was not verified
Chromium only (no Safari, Firefox or real devices). No check against Apple's Kids Category or Google Play's Families Policy yet (section 1.2). No screen reader pass. No children in the loop. `hyphens: auto` depends on the browser's dictionaries, so it is a fallback, not a layout mechanism. Contrast and CVD checks use standard formulas; the CVD threshold of 9 is a heuristic I chose. Button-colour-drives-conversion and children's-colour-association claims are evidence-graded C/D in section 9.5 — treated as a starting convention, not a validated effect. See `03-PROPORTIONS-AND-COMPOSITION.md` §4 for the proportion/composition evidence gaps.


---

Source: [03-PROPORTIONS-AND-COMPOSITION.md](docs/littlefounders-spec/frontend/frontend-bible/03-PROPORTIONS-AND-COMPOSITION.md)

# 03 · Proportion & Composition — why this should feel human-made

Status: **owner-directed research, applied and verified in the prototype.** v2 (2026-09-20): type-scale wording aligned with the mockup and `02`, pricing marked as parked (OD-5), verification re-run. Companion to `02-FOUNDATIONS.md`. Written in English because the file feeds an AI frontend agent.

The owner's brief: mobile and desktop should both feel like the primary surface, not one adapted from the other, and the platform should feel human-made rather than "built by AI." This file documents what the evidence actually says about that feeling, and the concrete rules an agent can follow to reproduce it. Every rule below was applied to the site prototype and re-verified after each change (section 5).

---

## 1. What actually reads as "AI-made" — evidence, not vibes

I could not find controlled experiments that isolate "does this page look AI-generated" as a variable — the claims in this section come from practitioner audits of many AI-built sites, not peer-reviewed studies. I'm grading them **D** (converging craft opinion) and treating them as a hypothesis worth designing against, not as fact.

**The catalogued tell is a specific bundle, not any one part of it:** a centered hero with a badge above the H1, a row of exactly three identical cards (icon, heading, two lines), a numbered 1-2-3 step row, purple-to-indigo gradients, glassmorphism, and every section given the same padding and the same centered-text treatment. Practitioners who reviewed large batches of AI-built launches found this specific combination repeatedly enough to name it ("AI design slop"). None of these elements is wrong on its own — a three-card row is often the right shape for three things. What reads as machine-made is **uniformity without a reason**: every section the same width, every card the same size, every heading the same weight relationship to its body text, nothing asymmetric, nothing that only makes sense for *this* content.

The proposed mechanism (also D-grade, but coherent with what the audits describe): a generative model reverts to the statistical center of its training data when a request is under-specified, and that center is exactly the safe, universal pattern above. The fix practitioners converge on is the same one design systems have always used — locked tokens, a real typographic scale, capped variety — which is what section 3 gives an agent to follow instead of improvising.

**What is NOT evidence for this:** none of this says generic patterns are unusable, and it does not mean novelty for its own sake reads as "human." The next section gives the actual, measured alternative.

## 2. What IS measured, and what it implies

| Finding | Source | Grade | What it means here |
|---|---|---|---|
| Low visual complexity **and** high prototypicality together produce the best first impression, and the effect is set within 17–50 ms | Tuch, Presslaber, Stöcklin, Opwis & Bargas-Avila 2012, two studies, real website screenshots | B | Familiar structure (nav at top, cards for choices, a table for rows) is not the problem. The two knobs that matter are keeping visual complexity low and making sure the structure still reads as *the kind of thing it is* on sight. |
| No reliable preference for the golden ratio in controlled tests; the only strong, replicated preference in rectangle studies is for near-square shapes, and individual variation dwarfs any population-level ratio preference | Green 1995 review; McManus et al. 2010; large cross-cultural replications through 2015–2016 | A (absence of an effect, well replicated) | Do not reach for 1.618 as a magic number. Asymmetry and a clear larger/smaller relationship read as intentional; a specific irrational ratio does not read as anything to a viewer. |
| ~49% of people hold a phone one-handed; ~75% of touches are thumb-driven; the bottom third of the screen is the effortless zone, the middle third needs a stretch | Hoober 2013, 1,333 observed device interactions in public | B | Primary actions belong low on the screen on mobile, not just "responsive" — reachable. Section 4.4. |
| Comprehension peaks around 50–75 characters per line for on-screen reading; both much shorter and much longer lines measurably hurt comprehension or speed, though the exact optimum is contested across studies (55 vs 75–95 cpl) | Dyson & Haselgrove 2001; Dyson & Kipping 1998; later replications disagree on the exact peak | C (real effect, contested optimum) | Cap running text width. I used a conservative ~66-character measure (66 characters ≈ 30em with this typeface's average glyph width — see section 3.2) rather than the higher end of the range, since undershooting is the safer failure mode for a children's product. |
| A heading needs to be *noticeably* larger than body text — subtle size steps read as indecision, not hierarchy | General typographic-hierarchy literature, converging but not a single controlled study | D | A closed, stepped type scale with real jumps between levels (section 3.2), not a fluid `clamp()` that can land anywhere. |
| Buyers rate handmade goods as more attractive than identical machine-made goods, and the effect is driven by a perceived "love"/effort signal, not by objective quality | Fuchs, Schreier & van Osselaer 2015, four studies, *Journal of Marketing* | B (for physical products; extrapolated here) | This is about physical goods with a stated production method, not interfaces — I'm applying it by analogy, not as direct evidence. The transferable idea: specificity and visible effort read as care. A generic stock icon reads as low effort; a screen showing the product's *actual* UI (a real answer choice, a real chore row) inside a marketing card reads as considered, because it could only have been made by someone who used the product. |

## 3. Rules an agent can check mechanically

### 3.1 Spacing: one scale, no off-grid values
All padding, margin and gap values are multiples of 4px: `--s-1` (4) through `--s-32` (128); the full scale (4, 8, 12, 16, 20, 24, 32, 40, 48, 56, 64, 80, 96, 128) is the `spacing` block of the `02` YAML. An agent should never hand-write a padding value outside this scale (`--s-1` … `--s-32`, `--target-min/base/lg` for touch sizing). Off-scale spacing was the single largest source of findings when this was audited mechanically (see section 5) — it is invisible to a person eyeballing one screen and obvious as noise across many.

### 3.2 Type: closed, stepped, measured
- Sizes are fixed pixel values at each container-width step, not fluid `clamp()` interpolation (the mockup contains no `clamp()`; `02` §6 and the `02` YAML say the same since v2). Three steps only, keyed to the `app` container width: base (<640px), medium (640–1119px), wide (≥1120px). What steps, as rendered: marketing H1 `display-2xl` 48 / 56 / 72 px; `display-xl` 36 / 40 / 40; `display-lg` (in-app H1) 28 / 32 / 32; `numeral-xl` 40 / 56 / 56. Every other size is fixed at all widths. A size either belongs to the named scale or it is a bug.
- Marketing H1 is at least **3×** the 16px body size. In-app H1 (a lesson question, a page title) is at least **1.5×**, since app headings sit inside a denser, task-focused layout where a 3× jump would crowd the content below it.
- Every page has exactly one `<h1>`.
- Running text (`p`, `.t-body`, `.t-body-lg`) caps at **30em** measure. I derived this from the typeface rather than the `ch` unit: Nunito's average glyph is about 0.45em wide, so 30em ≈ 66 characters, near the middle of the researched range. The `ch` unit (defined by the width of "0", ≈0.60em in this face) would have permitted lines nearly a third longer than intended — a mistake worth flagging since `max-width: 66ch` is a common shorthand that silently assumes a monospace-like average.

### 3.3 Composition: asymmetry with a reason, not decoration
- The hero is a **7:5** split on wide screens (copy: art), never 1:1. The hero art is portrait (4:5) and allowed to overlap into the next section by design, breaking the "every block is a clean rectangle" tell.
- Feature cards use a **7:5 / 5:7** two-up rhythm (a wide card paired with a narrow one), not a uniform 3- or 4-across grid. Where a true uniform grid is the right shape for the content — badges to collect, colour swatches in the system sheet, plan cards in pricing (a route parked for v1, OD-5) — it stays uniform, because forcing asymmetry onto genuinely equivalent items would be decoration for its own sake, which is its own tell.
- Process steps render as a **staircase** (alternating vertical offset, connected by a dotted line) on wide screens, not a row of identically-sized numbered circles.
- The "how it works for families" section **alternates which side the text sits on**, chapter by chapter, rather than repeating the same left-text/right-image block.
- Each feature card shows a **real piece of the product** — an actual answer row, an actual coin, an actual "waiting for approval" chip — rather than a decorative line-icon standing in for the idea. This is the interface analogue of the handmade-effect finding: specificity signals that someone actually built and looked at the thing being described.
- Section rhythm uses three named paddings (tight/default/loose) rather than one constant, and at least one section per page is a full colour block rather than the alternating light/white pattern repeated forever — enough to break a run of three or more identical section treatments in a row, which is the pattern the composition audit (section 5) checks for directly.

### 3.4 Mobile is a primary surface, not a shrink
- Primary actions sit in the bottom third of the screen on phones: the signup/login CTA in the marketing nav, the tab bar in the app, and a **sticky "Start free" bar** that appears on mobile once the visitor scrolls past the first screen of the landing and family pages — so the action is always in the thumb's easy zone without pinning it there from the first paint, which would crowd the hero.
- On mobile, the pricing page reorders the **recommended plan first**, ahead of the free plan, since a phone shows one plan at a time and the free-first order (correct for a side-by-side desktop comparison) would bury the recommendation below a full scroll. *v2: the pricing route is parked and out of scope for v1 (owner decision OD-5); the reordering principle (on a phone, put the item the page exists for first) still applies to any comparison layout.*
- Desktop is not "mobile plus more columns": the hero split, the feature-card asymmetry and the alternating chapters only activate at wider container widths; below that, content stacks in an order chosen for a single reading column, not a squeezed version of the wide layout.

---

## 4. Evidence gaps — flagged, not asserted

- No controlled study isolates "looks AI-generated" as a measured variable; section 1 is practitioner consensus, not an experiment.
- The 55 vs 75–95 characters-per-line optimum is genuinely contested in the reading-research literature; I chose the conservative end for a children's product rather than claiming a settled number.
- The handmade-effect study (section 2) is about physical goods with a *disclosed* production method (a label saying "handmade"). Nothing here tests whether showing real product UI in marketing cards produces a comparable effect for a digital interface — it is a reasoned extrapolation, not a direct finding.
- No test with real children or families on any of this. Every rule above should be treated as the best available starting point, not a validated outcome.

---

## 5. Verification

A second, purpose-built audit (separate from the Text Fit Contract in `02-FOUNDATIONS.md` §7) renders every route and measures the **computed, on-screen** page — not the source code — for:
off-grid spacing and font sizes, running-text measure over the cap, rows of 3+ visually-identical siblings outside the routes where a uniform grid is the correct shape, heading:body ratio below threshold, symmetric (near-1:1) hero splits, more than one accent-coloured button competing for attention on screen, more than one `<h1>`, centered-text share over 50% outside the pages where that is intentional, three or more consecutive sections sharing the same padding/background/layout signature, and interactive targets closer than 8px apart.

**Before these rules were applied:** the same audit, run on the previous build, returned over 100 findings across 28 page states — dominated by off-grid spacing (padding/margin values like 6px, 10px, 30px sitting outside the 4px scale), font sizes with no relationship to a scale, a symmetric 1:1 hero, and a heading:body ratio as low as 1.33.

**Current state (v2.1 mockup):** **0 findings across 492 page states** (17 routes and their state variants, 41 states × 4 widths × 3 languages). Earlier: **0 findings across 168 page states** (14 routes × 4 widths [320/375/768/1280] × 3 languages [EN/ES/PT]). Re-run with the v2 tool on 2026-09-20 (`verification-tools/proportion-audit.reference.mjs`, local Chromium via `CHROME_PATH`): the same 168 states, 0 findings.

This runs alongside, not instead of, the Text Fit Contract audit in `02-FOUNDATIONS.md` §7: that harness confirms nothing clips or truncates; this one confirms the composition around that text follows a deliberate, checkable rhythm. Both passed on the same final build, as reported by the original session: 1,440 configurations with normal text, 1,440 with WCAG 1.4.12 forced text-spacing, 0 issues in either, 0 JS errors across all 14 routes. The v2 re-run of the text-fit audit (768 + 768 reproducible configurations) confirms 0 issues with normal text and finds one real defect under forced text-spacing (a Portuguese course title on `home`); see `02` §7.


---

Source: [04-MOTION.md](docs/littlefounders-spec/frontend/frontend-bible/04-MOTION.md)

# 04 · Motion — transitions, animation and "juice"

Status: **owner-directed research, applied and verified in the prototype.** v2 (2026-09-20): the celebration budget (owner decision OD-7) is applied to the tokens and rules below; where the mockup disagrees, this file wins. v3 (2026-09-21): motion **assets** (Lottie, rendered sequences) follow these tokens as set out in `07-ICONOGRAPHY-AND-VISUAL-ASSETS.md` §5, and the Mentor character's states on the Diorama are in `08-MENTOR-STAGE.md` §3. Companion to `02-FOUNDATIONS.md` and `03-PROPORTIONS-AND-COMPOSITION.md`. Written in English because the file feeds an AI frontend agent.

The owner's brief for this pass: motion is not a finishing touch, it is one of the core carriers of gamification, and it deserved its own dedicated research session rather than being folded into general UI work. The two concrete requests were (1) avoid the "generic AI transition" — fade/slide applied uniformly with no relationship to what's on screen — and (2) build animations where **the scene's own elements participate** (a green card sliding over to cover what it's confirming, a wave running through a row of items, an exercise sliding out as the next one slides in), not decoration flown in from outside the scene.

---

## 1. What the evidence actually says about "juice"

**The central finding, and the one that shapes every rule below:** Kao (2020, *Entertainment Computing*, the largest controlled study of "juiciness" to date) tested none / low / medium / high / extreme levels of audiovisual feedback in an action RPG and found a **non-monotonic relationship**: medium and high levels outperformed both the complete absence of juice *and* extreme levels, across player-experience, intrinsic-motivation, play-time and in-game-performance measures. Grade **B** (single strong controlled study, not yet a meta-analysis, but well-powered and widely cited). This is the direct evidence against both failure modes this project has now hit once each: the earlier "chunky 3D button" system was too much simulated weight (corrected in `02-FOUNDATIONS.md` §9), and a bare fade/instant-swap interface would be the opposite failure — participants in Kao's dry condition described it as "something was either missing, or incomplete."

Supporting context, all lower-grade but converging: Swink's *Game Feel* (2009) frames juice as the third pillar after real-time control and a predictable simulated space — polish amplifies something that already works, it does not fix something broken. Pichlmair & Johansen's 2020 survey adds the caution that juice-rich interaction can make it hard to learn what aspects of an interface have mechanical importance, unless the exaggeration is itself a deliberate, legible choice. Grade **D** as a general design maxim, but consistent with Kao's quantitative ceiling.

**Design consequence:** every animation in this system has to answer "what does this movement communicate" before it's allowed in. Motion for the sake of motion is exactly the failure mode the evidence warns against.

## 2. Duration — five tokens in three categories

Grounded in Material Design 3's own three-category split (transitions 300–700ms, component state changes 100–300ms, state-layer feedback 50–150ms): `--dur-instant` and `--dur-micro` are state-layer feedback, `--dur-component` is a component state change, `--dur-transition` and `--dur-celebration` are transitions. The split is cross-checked against general mobile-motion practice, which converges on the same bands independently. Named here by **what the movement represents**, not by a number, so an agent extending this system reaches for the right token by asking "what kind of event is this" rather than picking a duration that merely looks right.

| Token | Duration | What it's for |
|---|---|---|
| `--dur-instant` | 80ms | State-layer: a row's press shadow, a tap acknowledgement |
| `--dur-micro` | 150ms | Press/release, a toggle, a small icon swap |
| `--dur-component` | 250ms | A component changes state in place: a badge pops in, a card flips to "done" |
| `--dur-transition` | 380ms | One screen or exercise replaces another |
| `--dur-celebration` | 700ms | A milestone on the closed list (`02` D7, owner decision OD-7): lesson complete, course complete, savings goal reached, badge earned, streak at 7, 30 or 100 days. Once per moment, never per click, never for a correct answer or a coin split |

Easing is named by what enters or exits, not by the shape of the curve, for the same reason: `--ease-enter` (decelerate, arriving on screen), `--ease-exit` (accelerate, leaving), `--ease-standard` (moves within the screen, starts and ends on-screen), `--ease-spring` (overshoot — reserved for the same closed milestone list, never routine UI, so an overshoot always means something). A press and its release use `--ease-standard` (`--dur-instant` in, `--dur-micro` out); small state bumps (an answer selected or correct, a CTA arming) are keyframed scale changes on `--ease-standard`, not spring.

**Resolved in the v2.1 mockup:** spring overshoot is removed from all routine UI (press in 80 ms, out 150 ms, standard easing; the streak wave uses enter easing); spring and confetti remain only on the lesson-complete milestone.

**Deliberate exception, documented in the CSS itself:** the hero object's float (5s), the streak flame's flicker (2.4s) and a pulsing CTA's breathing glow do **not** use these tokens (v3: on the Mentor stage, the character's catalogue idle loop takes the hero object's place, `08` §3). They are idle "the scene is alive" loops, not state transitions — forcing a 5-second float onto a 380ms transition scale would misrepresent what it is. The motion budget from `02-FOUNDATIONS.md` §9.4 still applies: exactly three things get idle motion at once, no more.

## 3. Accessibility — the hard limit that overrides everything above

**35% of adults over 40 have some vestibular dysfunction** (WCAG 2.3.3 analysis), and the reaction — dizziness, nausea, headaches, sometimes requiring the person to stop and lie down — can be triggered by animation the way flashing content triggers seizures, just slower-building. Grade **A** for WCAG 2.3.3 and 2.2.2 being binding standards; grade **B** for the 35% figure (a cited estimate, not this project's own measurement).

The specific, actionable finding (A List Apart, practitioner analysis corroborated by the WCAG working group's own examples): **what triggers a reaction is the size of the movement relative to the screen, not which CSS property is animated.** A small button doing a 3D rotate is unlikely to cause a problem; a full-screen wipe transition is a likely trigger regardless of how "smooth" the easing is. Opacity, color and blur changes are essentially never problematic; large-scale position changes are the actual risk.

**Rule, already implemented and re-verified this pass:** every animation in this system checks `prefers-reduced-motion` — either through the JS `REDUCED()` helper (for Web Animations API sequences) or the `@media (prefers-reduced-motion: no-preference)` guard (for CSS `@keyframes`, which means the animation is simply absent rather than present-and-skipped when motion is reduced). Reduced motion never hides a state change — the wave, the stagger, the exercise slide all still result in the correct final state, only the travel is removed or reduced to a brief cross-fade.

## 4. The three orchestrated patterns built this pass

The owner's request was specific: animations that look "generic AI" are the ones where a floating element enters from nowhere in particular. The alternative is **the scene's own elements doing the moving** — something already on screen transforms into its next state, rather than a new element appearing over it.

### 4.1 Exercise-to-exercise slide (the lesson engine)

**Before this pass:** the lesson screen had exactly one hardcoded question. Advancing "reset" went straight to the result screen with no transition at all — an instant `innerHTML` swap, the single most generic possible interface behavior.

**What was built:** a real 4-exercise sequence per language (12 total question/answer sets, EN/ES/PT), and a transition where the outgoing exercise card is cloned before the DOM swap, then both cards are choreographed together: the outgoing card slides out to the left and fades (`--ease-exit`), the incoming card slides in from the right and fades in (`--ease-enter`), with roughly a 22%-duration overlap so the handoff reads as one continuous motion rather than two separate cuts. The bottom action bar (feedback banner + Check/Continue button) cross-fades in sync rather than snapping to its new state mid-slide — an earlier version of this had the new question's fresh "Check" button visually stacked on the old question's green "correct" feedback for a frame, which was confusing and is now fixed (section 6).

Distance traveled is a **fraction of the track's own width** (18% in, 14% out), not a fixed pixel value, so the motion is proportionate whether the container is a 320px phone or a 1280px desktop panel — this is the same "scale to the container, not a magic number" principle used throughout the composition work in `03-PROPORTIONS-AND-COMPOSITION.md`.

### 4.2 Success-wipe (the requested "green card overlaps on completion" pattern)

Built on the family chores screen: each pending chore now has a real "Approve" action. On approval, a solid `success`-green panel — no border, per the `02-FOUNDATIONS.md` §4.4 rule — covers the row from the top edge, holds briefly with a check mark and the task's own name, then wipes away in the same direction it arrived, revealing the row already updated to "Approved" underneath.

This is the row's own content participating in its own transition, not a toast or a separate confetti burst layered on top. (v2 note: approving a chore is a parent action; in the product this pattern lives in the parent experience. The mockup shows it inside the child's app shell, which is a known deviation.) The direction (top-to-bottom cover, then continuing top-to-bottom to clear) was chosen because it reads like a stamp or a seal being applied — matching what "approve" means — rather than an arbitrary left/right choice.

### 4.3 Wave entrance (the streak strip)

The weekly streak strip's seven day-dots rise and settle in sequence, left to right, like a stadium wave crossing the row — each dot's animation delay is `index × 60ms`, so the motion visibly travels across the row rather than every dot popping in at once. This pattern is reserved specifically for the streak strip, not applied generically to every list in the product: the whole point of that component is "a sequence completed in order," so a wave crossing the row in reading order is the one place where the direction of the motion actually matches what the component means. (v2: the wave uses `--ease-enter`; the mockup's spring curve on it is a known deviation, and an ordinary practised day never celebrates, `02` §9.6.) Applying the same wave to, say, a badge grid (which has no inherent left-to-right sequence) would be motion for its own sake — exactly what section 1 warns against — so the badge grid instead uses a plainer staggered fade-and-rise (section 4.4), not a wave.

### 4.4 Staggered reveal (badge grids)

A simpler, more general pattern for collections that don't have the streak strip's sequential meaning: each item fades and rises in with a capped stagger delay (`min(index, 10) × 45ms`, so a 12-item grid still finishes settling well under a second rather than trailing indefinitely). Applied to the badge grid on both the landing page and the profile screen.

**Critical constraint, verified in code, not just assumed:** this only fires on genuine route entry (`S.enter`), never on an in-place re-render triggered by an unrelated interaction on the same screen. Before this was enforced, toggling an unrelated control (e.g. "show resting state" on the profile page) would have re-triggered the badge stagger and the streak wave every time — exactly the kind of motion-without-a-reason the evidence in section 1 argues against. Confirmed directly: navigating into the profile route fires both animations (7 wave elements, 6 staggered badges); a subsequent click on an in-page toggle fires neither.

---

## 5. Library and tooling notes (for whoever picks this up)

No animation library was added to the prototype — everything above is native CSS `@keyframes`/transitions plus the Web Animations API (already used for the confetti burst and press-ring effects before this pass; since v2, confetti is reserved for the milestone list). OD-12 now selects a future mobile wrapper sharing the web frontend, so these web motion mechanisms remain the implementation target; the wrapper must honor reduced-motion settings and preserve the same tokens (`02` §1.2). That was a deliberate choice for a static prototype, not a recommendation against libraries for production:

- **GSAP became 100% free in 2025** (Webflow now sponsors it), including ScrollTrigger and every previously-paid plugin. It remains the strongest choice for complex, timeline-driven, or scroll-linked sequences — most relevant here if the lesson engine grows scroll-driven transitions or cross-exercise choreography beyond what a CSS/WAAPI slide can express cleanly.
- **Motion (the 2024 rebrand of Framer Motion)** is the dominant choice for React UI animation specifically — declarative, smaller bundle than GSAP's full package, first-class exit/layout animations. The natural choice if/when this design system is implemented in a real React codebase rather than the vanilla-JS prototype harness used here.
- **Native CSS transitions/`@keyframes` and the Web Animations API**, which is everything used in this prototype, remain the right choice for anything that doesn't need cross-browser scroll-linking or complex timeline sequencing — zero added bundle weight, and every effect built this pass (the exercise slide, the success-wipe, the wave, the stagger) was expressible cleanly without a library.

The recommendation for production: start with native CSS/WAAPI as done here; reach for Motion if the codebase is React and the team wants less animation boilerplate; reach for GSAP specifically when a sequence needs precise multi-element timeline control or scroll-triggering that CSS alone can't express well.

---

## 6. Iteration log — what was caught and fixed this pass

**Bug: the lesson-foot overlap.** The first working version of the exercise slide had the bottom action bar (feedback + button) snap instantly to the new exercise's state while the old exercise's card was still visibly sliding out above it — for a frame, the new question's disabled "Check" button appeared stacked on top of the old question's green "correct" feedback banner. Caught by screenshotting the animation mid-flight, not by the automated audits (which check layout overflow, not animation choreography). Fixed by cross-fading the foot in sync with the card slide rather than letting it change state instantly.

**Bug: the approve-row layout.** Adding a fourth column (the "Approve" button) to the existing 3-column row-card grid crowded the task title against the button badly enough to wrap it into an ugly multi-line stack on narrow screens. Fixed by switching that row variant to flex-wrap, with the button given its own full-width line below 480px and returning inline at wider widths — verified with screenshots at both 375px and 768px.

Both fixes were re-verified against the full suite: 1,440 configurations with normal text, 1,440 with WCAG 1.4.12 forced text-spacing, 168 proportion/composition page-states, 0 issues in any of them, 0 JS errors across all 14 routes.

---

## 7. Evidence gaps — flagged, not asserted

- Kao (2020) is one strong study, not a meta-analysis; the exact shape of the "too much juice" ceiling (where it starts, how steep the falloff is) is this one paper's finding, not an established constant.
- The 35% vestibular-dysfunction figure is a cited estimate from accessibility literature, not measured by this project, and prevalence in the platform's actual Mexico/Brazil user base is unknown.
- No test with real children on any of the motion patterns built this pass. Kao's study population was general game players, not this platform's specific audience of children and their parents.


---

Source: [05-TEACHING-VISUALS.md](docs/littlefounders-spec/frontend/frontend-bible/05-TEACHING-VISUALS.md)

# 05 · Teaching visuals ("Pizarrón") — charts, mathematics, logic and money

Status: **owner-directed (OD-4, 2026-09-20); specification. Three board demos are built in the v2.1 mockup (`board` route); the rest of the catalogue is not.** Board labels and prompts follow the Copy Budget (`06`); the Mentor beside the board follows `08` §2. Companion to `02-FOUNDATIONS.md`. Written in English because the file feeds an AI frontend agent. Evidence, the full catalogue and the grading contract live in the Product package: `10-APPENDIX-A-INTERACTIVE-VISUAL-CATALOG.md` (charts, diagrams, 16 interaction primitives) and `10-APPENDIX-P-TEACHING-VISUALS-MATH-LOGIC-MONEY.md` (mathematical representations M1–M20, logic L1–L13, money manipulables $1–$12). This file only states how those look and behave inside the one design system. It adds no new style: every colour, type style, radius, spacing value, target size and duration below is a token from `02`; the stroke widths and handle geometry in the `viz` block are new tokens defined here.

---

## 1. Decisions

| # | Decision | Why |
|---|---|---|
| V1 | Teaching visuals are built in-house on SVG, with a separate HTML layer for controls, labels and descriptions, and a pure TypeScript model and scorer shared with the server. | No library covers these widgets with the accessibility, localisation and grading needed; PhET (CC BY-NC for versions released from 29 March 2026) and GeoGebra (non-commercial only) cannot be embedded without a licence (Appendix P, Part 6). |
| V2 | Every visual sits on a **board**: a neutral surface inside the lesson's full-bleed screen. | Marks and labels need a neutral ground to reach contrast and to keep reserved hues meaningful. This is the one explicit exception to `02` §4.5's full-bleed rule, written into §4.5 itself. |
| V3 | Nothing decorative inside the board. The Mentor character, confetti, sparkles and theme art stay outside it. | Seductive details reduce learning (Appendix P, Part 1 notes). |
| V4 | Every drag has a tap alternative and a keyboard alternative. | WCAG 2.5.7: keyboard support alone does not satisfy it. |
| V5 | No celebration inside the board. A correct interaction gets the informational response from `02` §9.2; celebration happens only on the milestone list (`02` D7). | OD-7. |
| V6 | Default renderer is SVG. Canvas only for simulations with hundreds of marks, always with an HTML fallback. No WebGL or Skia on the web. | Screen-reader exposure; low-end Android (Appendix P, Part 6). |

---

## 2. Tokens (extension to the `02` YAML)

```yaml
viz:
  board:        { background: "{colors.surface}", dark-background: "{colors.dark-surface}", rounded: "{rounded.lg}", padding: "{spacing.4}" }   # 16 px inner padding; board never carries a border (02 §4.4)
  gridline:     { color: "{colors.outline}", dark-color: "{colors.dark-outline}", width: 1px }     # decorative only, never needed to read a value
  axis:         { color: "{colors.edge}", dark-color: "{colors.dark-edge}", width: 2px }           # >= 3:1 against the board (WCAG 1.4.11)
  mark:         { stroke: 3px, point-radius: 6px }
  series:       ["{colors.sky-strong}", "{colors.mint-strong}", "{colors.berry-strong}"]   # dark mode: the dark-*-strong values; order is fixed; primary is NOT a series (it means selection and focus, 02 §4.2)
  series-fill:  ["{colors.sky}", "{colors.mint}", "{colors.berry}"]           # bars and areas; text on them uses the matching on-* token
  series-pattern: [solid, diagonal, dots]                                                        # second channel, always applied from the second series on
  series-overflow: { color: "{colors.content-muted}", pattern: crosshatch, labels: direct }       # a fourth or later series: neutral marks with direct labels, one series highlighted at a time
  handle:       { visual: 32px, hit: "{target.lg}" }                                              # 64 px hit area: a handle is an answer surface (02 §8)
  snap-tick:    { length: 12px, active-color: "{colors.primary-strong}" }
  label:        "{typography.caption}"                                                            # 14 px floor; numerals in Nunito (fixed-width digits)
  value-label:  "{typography.label}"
  state:
    correct:    { color: "{colors.success-strong}", mark: check }
    try-again:  { color: "{colors.content}", mark: cross }                                        # inside the board: neutral cross + the word; the warning hue is used only by the lesson-foot banner, because warning = reward = coins (02 §3)
    selected:   { color: "{colors.primary-strong}", ring: 3px }
```

Hue rules on the board:

- Only `sky`, `mint` and `berry` may encode data series; `primary` stays reserved for selection, focus and progress (`02` §4.2). `accent` (the call to action), `reward` (coins and XP), `success` and `error` keep their reserved meanings. Coins in a money manipulable use `reward`, because that is what `reward` means.
- More than three series: the rest use `series-overflow` (neutral marks, patterns, direct labels), never another hue. Three is what the palette leaves free after the five reserved hues (`02` §4.1: eight distinguishable hues, five spoken for).
- **One board, one meaning per hue.** Within a board a hue has a single meaning. When a board combines a money manipulable with another representation, the money manipulable keeps the wallet meanings (`mint` save, `sky` spend, `berry` share) and the other representation uses neutral marks with direct labels. Coins always use `reward`, so no other element on a money board may use `reward`, `warning` included.
- **Coins on the board carry their outline.** A flat `reward` coin on a white board is about 1.8:1; the `collectible-art` outline in `reward-ridge` (`02` §3) is mandatory on the board so the coin reaches 3:1.
- A negative value (debt, a balance below zero) is shown by **position** below the zero line, a minus sign and a word, never by `error` red.
- Series meaning is always carried by colour **and** pattern or direct label (`02` rule 6).

---

## 3. Anatomy

From top to bottom inside the lesson screen:

1. **Prompt** (outside the board): the question in `typography.question`; the Mentor's avatar and name beside it, never inside the board.
2. **Board**: the workspace. Contains only the representation and its labels.
3. **Control strip** (directly under the board, HTML): the tap and keyboard alternatives (steppers, "place here" buttons, "move to…" menus), the step scrubber for replays, **Show as table** for any chart, and **Reset**. Every control meets `target.base` (56 px); primary manipulation controls meet `target.lg` (64 px).
4. **Lesson foot** (existing, `02` §9.2): the feedback banner and the Check/Continue button.

The board is the single scroll-free unit: at any width it fits without horizontal scrolling. Below 400 px container width, the board takes the full width and the control strip stacks under it; the representation reflows by container width (`02` §7 rule 9), for example a number line changes tick density, and a truth table switches from a grid to one row per card.

---

## 4. Interaction contract

| Pattern | Behaviour | Tap alternative | Keyboard |
|---|---|---|---|
| Drag a point (number line, graph) | Follows the pointer with no easing lag; snaps on release | Tap on the track to place; steppers to adjust | Arrow keys move one snap step; Page Up/Down ten steps; Home/End the bounds |
| Drag an object into a region (coins into pockets, items into bins, Euler regions) | Object lifts on pick-up (`bump`), region highlights on hover | Tap the object, then tap the destination | Enter/Space to pick up, arrows to choose a region, Enter/Space to drop; or a "Move to…" menu |
| Trade / regroup (base-ten, making change) | The traded pieces merge or split in place; the written digit changes at the same moment | "Trade 10 ones for 1 ten" button next to a column | The same button, focusable |
| Build (bar model, rule builder, flowchart, circuit) | Pieces snap into slots; the result runs on test cases when the learner asks | Slot-by-slot pickers | Tab through slots; Enter opens the picker |
| Predict, then reveal (curves, gates, tables, simulations) | The reveal is blocked until a prediction is committed; the prediction stays visible next to the result | Tap to choose or place the prediction | Same as the underlying control |
| Step replay (worked examples) | One step per `component` (250 ms), each step highlighting the cells it changes; a scrubber moves freely (`transition` stays reserved for one exercise replacing another) | Previous / next step buttons | Left/Right arrows |
| Simulation (dice, spinner) | Trials run in batches; the frequency bar grows; the learner can pause | Run 1 / Run 10 / Run 100 buttons | Same buttons |

State changes on the board use `component` (250 ms, `standard` easing). Spring overshoot is never used on the board. Under `prefers-reduced-motion: reduce`, every state still happens: points jump to their snapped position, replays switch steps with a cross-fade, simulations show the final frequencies, and highlights remain.

---

## 5. Text on the board (Text Fit Contract, `02` §7)

- Any label that is a word or can grow in translation (axis titles, bin names, legend entries, flowchart node text, scenario cards) is **HTML**, positioned over the SVG, and wraps. SVG `<text>` is allowed only for short numerals and single symbols.
- Tick labels never overlap, rotate or truncate: when space runs out, the representation shows fewer ticks. Values the learner needs stay reachable in **Show as table**.
- Units are always visible ("per 100 g", "coins", "years").
- Numbers, currencies and plurals come from `Intl` with the full locale (`en-US`, `es-MX`, `pt-BR`). A bare "$" never appears in a lesson that involves more than one currency (in `es-MX` it means pesos).
- Number input uses `inputmode="decimal"` and a locale-aware parser, and echoes the parsed value back before submission.
- Long division has **three renderers** — US bracket, Mexican *casita*, Brazilian *método da chave* (quotient under the divisor) — selected by locale profile, each with its own step sequence (Appendix P, Part 5).
- Mathematical notation is rendered with KaTeX (server-side where possible, loaded only in lessons that need it), and every expression a child must understand carries an author-written `spokenText` per locale (MathJax has no Portuguese speech).

---

## 6. Accessibility

- **Structure:** model → SVG view (`aria-hidden="true"` when an HTML layer carries the semantics) → HTML control and description layer. Never put `role="img"` on an interactive SVG; it removes the children from the accessibility tree.
- **Roles:** a movable point is a `slider` with a localised `aria-valuetext` ("three quarters", "tres cuartos", "três quartos"); a truth table is a `grid`; bins and regions are reached through the "Move to…" menu; a static chart is `role="img"` with a name and a description following "chart type → axes → key takeaway".
- **Announcements:** state changes (a trade made, a point placed, a rule evaluated) are announced through one polite live region; correct/try-again feedback is announced through the lesson foot's existing banner.
- **Contrast:** marks, axes, handles and focus rings reach 3:1 against the board in both modes; text reaches 4.5:1 (`02` rule 11).
- **Every chart** has **Show as table**, formatted per locale.
- **Audit checklist:** Chartability (Elavsky) quick test, in addition to the `verification-tools/` audits.

---

## 7. Family notes

| Family | Visual rules specific to it |
|---|---|
| Number lines (M2–M4) | Always bounded, with both ends labelled; benchmarks (0, ½, 1) as longer ticks; the placed point shows its value only after submission when estimation is the skill. |
| Base-ten and place value (M5) | Units, rods and flats in one series hue per place (`sky` ones, `mint` tens, `berry` hundreds), each also labelled; the written number sits directly under its column. Never on the same board as a Save/Spend/Share split (one meaning per hue). |
| Fractions (M3, M6) | Area and number-line views of the same fraction are linked live; circle models only for halves, thirds, quarters and sixths (hard to split equally otherwise). |
| Bar and schema models (M7, M8) | Bars built by the learner; the unknown is a dashed segment labelled "?"; structure is checked before the arithmetic. |
| Worked examples (M9, M10) | The active step is highlighted with `primary-soft`; completed steps stay visible in `content-muted`; blanks in faded examples are input fields at `target.base`. |
| Probability and risk (M16–M18) | Icon arrays of 10 or 100, grouped in rows of 10; counts ("12 of 100") first, percentages as a second view. |
| Logic (L1–L6) | Condition text lives on the node, switch or card, never in a legend; at most 3 decision points for ages 6–9 and 2 inputs for ages 10–12 (content registers, `02` D8). |
| Money ($1–$12) | Coins are simplified, flat `reward` tokens for arithmetic (realistic artwork only in coin-recognition lessons); the save/spend/share split reuses the Wallet's own component; amounts in the child's wallet are always labelled as simulated coins. |

---

## 8. Verification

The v2.1 mockup's `board` route builds three demos (number line, discount predict-then-reveal, IF–THEN rule builder); that route passes the general text-fit and proportion audits. The board-specific rules below are not yet machine-verified. Extend `verification-tools/` with: board labels in the text-fit audit; a contrast check of marks and axes against the board in both modes; a check that no reserved hue encodes a data series; a check that every draggable has a tap alternative and a 64 px hit area; a check that no animation fires inside the board outside the allowed patterns; and the scorer parity test from Appendix P, Part 7.


---

Source: [06-COPY-BUDGET.md](docs/littlefounders-spec/frontend/frontend-bible/06-COPY-BUDGET.md)

# 06 · Copy Budget — say less, say it clearly

Status: **owner-mandated (OD-13, 21 September 2026). Non-negotiable.** Written in English because the file feeds an AI frontend agent. Where this file and `13-OWNER-DECISION-LOG.md` disagree, the log wins.

The owner reviewed the v2.1 screenshots and found **too much text in several elements**. The earlier rules only covered whether text *fits*: the Text Fit Contract (`02` §7) forbids clipping and the em-dash rule (`02` rule 16) covers tone. Nothing set a limit on *how much* text a screen may carry. This file sets that limit, with numbers an agent can check and a tool that checks them (`verification-tools/copy-budget-audit.reference.mjs`).

---

## 1. The rule in one line

**Every string does one job, in the fewest words that a child in that age band understands at first read. Detail goes behind a tap, into the Mentor's voice, or into the visual. It never goes into more words on the screen.**

## 2. Why (evidence, graded as in `01`)

| Claim | Source | Grade | What it means here |
|---|---|---|---|
| People scan pages; on an average page visit they read only a minority of the words (at most about 28%, likely closer to 20%). | Weinreich, Obendorf, Herder & Mayer (2008), *ACM Transactions on the Web* 2(1), browsing logs; analysed by Nielsen (2008) | B | Text beyond the first few words of each block is mostly not read. It costs space and hides the one sentence that matters. |
| Removing interesting but extraneous words and pictures improves learning (the coherence principle). | Mayer & Fiorella (2014), *Cambridge Handbook of Multimedia Learning*: the leaner version won in most experiments reviewed, with a large median effect | A | In lessons and on the board, extra explanation on screen does not help understanding and can hurt it. |
| Children's working memory is smaller than adults'. New content per lesson must be capped by age. | Product Appendix B; requirement B.17 | A | The same cap applies to interface text around the content: chrome must not compete with the lesson. |
| On-screen text that duplicates narration verbatim hurts learning (redundancy principle). | Product Appendix B; requirement B.18 | A | When the Mentor speaks, the screen shows a short caption, not a paragraph (see `08` §5). |
| Plain-language guidance: short sentences, common words, one idea per sentence. | GOV.UK content design guidance; plain-language practice | C | Expert consensus, not a controlled study. Used as a style rule. |
| The exact numbers in section 3. | Design judgement, calibrated on the v2.1 mockup and the owner's review | D | Treated as hard limits because the owner mandated brevity. Revisit with real usability data, never by adding words case by case. |

## 3. Budgets (English words; ES and PT get ×1.25, rounded up)

A **word** is any run of letters or digits ("25%", "Sofía's" and "60" each count as one). Budgets apply to what the user sees in one state of one screen.

### 3.1 Signed-in product, sign-up and log-in ("app")

| Role (`data-copy-role`) | What it is | Max words | Max sentences | Notes |
|---|---|---|---|---|
| `action` | Button or link-button label | **3** | — | Verb first: "Continue", "Add photo", "Invite a parent". No "my", no "please". |
| `heading` | Screen or card title | **6** | 1 | A noun phrase or a short question. No trailing explanation. |
| `body` | Subtitle, helper line, card text, banner text, empty state, error | **12** | 2 | One idea. If it needs "and", "so" or "because", it is probably two ideas: cut one or move it behind a tap. |
| `prompt` | A lesson or board question | **20** | 2 | Context plus the question. Ages 6–9: **12**. Numbers the learner needs stay; decoration goes. |
| `option` | Answer option, choice, picker value | **8** | 1 | Ages 6–9: **5**. |
| `mentor` | One Mentor turn on the stage (`08`) | **20** | 2 | Ages 6–9: **12**. One question per turn. |
| `narrative` | The parent's weekly story (B.10) | **30** | 2 | The one exception for parents: it is content, not chrome. Still one paragraph. |
| First view | Total words visible without scrolling on a 375 × 740 px screen (excluding `data`) | **40** | — | Ages 6–9: **25**. If a screen needs more, it needs a second step, not more text. |

### 3.2 Marketing site ("site")

| Role | Max words | Max sentences |
|---|---|---|
| `action` | 3 | — |
| `heading` | 8 | 1 (a two-part brand line counts as one heading) |
| `body` (per paragraph) | 25 | 2, and at most one paragraph per section |

### 3.3 Not counted

- `data`: user content, names, numbers, table cells, amounts, dates.
- `brand`: approved brand lines taken verbatim from `COSMIC_NARRATIVE.md` (for example "Become your child's Tutor"). Marked `data-copy-role="brand"`. New brand lines are the brand team's call, not the agent's.
- `legal`: mandated disclosures (consent, the share disclosure in F.3, age safeguards). These are never shortened below what the requirement demands. They use **layering** instead (section 4).

## 4. Where the extra detail goes (layering)

When a message is longer than its budget, the agent does **not** raise the budget. It chooses one of these, in this order:

1. **Cut.** Remove anything the user does not need to act *now*: reassurance, repetition, "you can change this later" (unless that is the point of the screen).
2. **Show it.** Replace words with the visual or state that already says it: an icon plus a word, a progress bar, a chip, a character pose, the board.
3. **Say it.** In learning surfaces, the Mentor says it (voice plus a short caption, `08` §5), within the Mentor budget.
4. **Put it behind a tap.** A "Why?" or "Details" link opens a sheet. The sheet may hold up to 60 words, in short paragraphs, and the legal text in full where required.

A summary line that stands in for a disclosure must still be true on its own. It is not allowed to hide the consequence behind the tap.

## 5. Writing rules (all surfaces)

1. One idea per string. One question per Mentor turn.
2. Verb-first actions, in the user's voice where it reads naturally ("Log in", "Add coins", "Ask Dina").
3. Common words from the controlled glossary (`02` §1.2). No jargon, no "simulation" wording on every screen. The simulation disclosure lives in one chip or banner per surface, not in every sentence.
4. No filler: "please", "simply", "just", "in order to", "so the right protections apply from the start".
5. No repetition of what the heading or the visual already says.
6. Numbers as digits ("3 lessons", not "three lessons").
7. No em dash (`02` rule 16), no exclamation marks in parent, staff or error copy, at most one per screen for learners.
8. Age register changes the *words*, not the budget upward: younger bands get **smaller** budgets (section 3.1).
9. Translations must meet the ×1.25 budget. If a translation cannot, the English source is rewritten shorter. The translated string is never truncated.

## 6. Before and after (from the v2.1 mockup)

These are examples of the method, not final copy. Final copy is written and AI-translated from the glossary (OD-11).

| Screen | v2.1 mockup (over budget) | Within budget |
|---|---|---|
| Sign-up, age | "We ask everyone who signs up, so the right protections apply from the start. Enter your own month and year of birth." (22) | "We use it to keep you safe." (7) |
| Sign-up, under 13 | "Accounts for children under 13 are created by a parent. They will give you a username and a passphrase to log in." (22) | "A parent creates your account." (5) + "Why?" sheet |
| Sign-up, under 13 action | "Try a lesson as a guest" (6) | "Try as guest" (3) |
| Landing action | "Try one lesson with your child" (6) | "Try a lesson" (3) |
| Lesson, guided review | "This one is tricky, and that is fine. Want to look at it together first? A short review with worked steps, then you try again." (25) | Mentor turn: "Tricky one. Want to see it together?" (7) |
| Guided review actions | "Review with Dr. Rho" (4) / "Keep trying on my own" (5) | "Show me" (2) / "I'll try" (2) |
| Tasks (child) | "A grown-up in your family checks each task and approves it. Then the coins go to your wallet." (18) | "A grown-up approves. Then you get the coins." (8) |
| Tasks (teen, no parent) | "Tasks and anything a parent approves need a parent or guardian linked to your account. Your personal wallet works without one." (21) | "Tasks need a linked parent." (5) |
| Tasks action | "Add a photo as proof" (5) | "Add photo" (2) |
| Teen wallet | "You manage this wallet yourself. No approval needed. Everything here is a simulation in coins." (15) | "Your wallet. No approval needed." (5) + the simulation chip |
| Board, discount | "Lock in my prediction" (4) | "Lock it in" (3) |
| Parent, weekly story | "This week Sofía practised saving for a goal and splitting coins between save, spend and share. She found "how many more do I need" tricky at first, then solved it on her own." (33) | "Sofía practised saving and splitting coins. "How many more do I need?" was tricky, then she solved it." (18) |
| Parent, coaching tip | "Keep everyday help at home unpaid and put coins on bonus tasks. It shows that some work is simply part of being a family." (24) | "Pay coins for bonus tasks only. Everyday help stays unpaid." (10) |
| Mentor screen intro | "Dr. Rho helps you think things through, one question at a time." (12, at the limit, but it repeats what the stage shows) | Removed. The stage and the character say it (`08`). |

## 7. How it is verified

- **Tool:** `verification-tools/copy-budget-audit.reference.mjs` measures every visible text block by role, per state and language, and the first-view total. It checks words and sentences. In production, components must declare `data-copy-role`, and the root must carry `data-age-band` (the tool then applies the 6–9 limits). With both declared, the tool measures roles exactly instead of guessing them. Without them, it infers only `action`, `heading`, `body`, `prompt` and `option`. The mockup declares roles only where the heuristics would be wrong (listed in `../mockup/COPY-BUDGET-FINDINGS.md`).
- **v2.1 mockup baseline:** 142 distinct findings across EN, ES and PT (59 in English), mostly on sign-up, the Mentor screen, the board, the wallet, tasks and the parent screen. The full list is in `../mockup/COPY-BUDGET-FINDINGS.md`. It is recorded as deviation **K40**: do not copy the mockup's strings.
- **Gate:** a new or translated string must pass the Text Fit audit **and** the Copy Budget audit before merge (`02` §7 item 10, extended).
- **Content pipeline:** lesson prompts, options and Mentor turns are content, authored in Forge. The same budgets become a Forge gate next to B.17 and B.18 (see the note on requirement B.18 in `13-OWNER-DECISION-LOG.md`, OD-13).


---

Source: [07-ICONOGRAPHY-AND-VISUAL-ASSETS.md](docs/littlefounders-spec/frontend/frontend-bible/07-ICONOGRAPHY-AND-VISUAL-ASSETS.md)

# 07 · Iconography and visual assets — our own, not stock

Status: **owner-mandated (OD-14, 21 September 2026). Non-negotiable, at the same level as shapes (`02` "Shape by object type") and colours (`02` §4).** Written in English because the file feeds an AI frontend agent. Where this file and `13-OWNER-DECISION-LOG.md` disagree, the log wins.

## 0. Why this chapter exists

Iconography, images and visual resources carry a large part of LittleFounders' identity. The reference mockup could not show this: the environment it was built in cannot generate images. Its icons are a generic stroke sprite (42 symbols) and its art is flat placeholder vector (a coin, a medal, letter avatars). **None of that is the product's visual language.** It is recorded as deviation **K41**.

The frontend agent that builds the product (Codex) *can* generate images and motion assets. So the rule for the final product is:

> **Use the fewest generic icons possible. Everything that carries meaning, identity or emotion is an asset of our own, generated in the LittleFounders style: a PNG/WebP render, a custom SVG, or a Lottie animation. The four Mentor characters are always rendered from the real 3D models, in the poses defined in the project's pose catalogue.**

## 1. Two classes of visual, and nothing else

| Class | What it is | Source | Examples |
|---|---|---|---|
| **A. System glyphs** | Small, functional marks that operate the interface. They carry no brand meaning. | A **closed list** (section 2), drawn to the glyph spec. | close, back, menu, chevron, check, cross, plus, minus, show/hide, search, settings, info, warning, external link, microphone, send, play, pause, refresh |
| **B. Own assets** | Anything that names a thing, a place, an achievement, a person, a feeling or a concept. | **Generated by the frontend agent in the house style** (section 3), reviewed (section 7), registered in the asset manifest (section 6). | Course and adventure icons, the Save/Spend/Share pocket icons, task categories, badges and medals, coins, empty states, onboarding scenes, marketing hero and scene art, the Mentor characters, celebration motion, the Diorama scenes |

**The test:** if removing the visual would lose meaning that the label alone does not carry, or if the visual appears somewhere a child would remember it, it is class B. When in doubt, it is class B.

**Forbidden:** stock illustration packs, emoji as interface art, icon-font pictograms for class-B meanings (a generic "piggy bank" glyph for Save, a generic "trophy" for a badge), AI-generated look-alikes of the Mentor characters, and any third-party character or brand likeness.

## 2. System glyphs (class A): the closed list

- **Maximum 24 glyphs in the whole product.** The starting list is the 19 in section 1 (show/hide counts as one), plus up to 5 more if the product needs them. Adding a 25th requires removing one, or an owner decision.
- **One source.** Either drawn in-house to the spec below, or taken from **one** permissively licensed open-source set and adjusted to the spec. Never mix sets.
- **Glyph spec:** 24 px grid, 2 px live area padding, rounded caps and joins, a single stroke weight (2 px at 24 px), no fills except a dot or the check inside a filled circle, `currentColor` only, optically centred. Minimum rendered size 20 px, always inside a target that meets `02` §8 (48 px minimum).
- A glyph is never the only carrier of meaning (`02` rule 6): it pairs with a word, or has an accessible name when it stands alone in an icon button.

## 3. Own assets (class B): the house style

The house style is the style of this design system. An asset that would look out of place next to the tokens in `02` §3 is wrong, however good it looks alone.

| Property | Rule |
|---|---|
| **Colour** | Only the token hues: the 8 solid hues, their `-ridge` and `-soft` tones, and the neutrals (`02` §4). No off-palette colours, no gradients used as meaning, no neon, no photographic textures. Reserved hues keep their meaning (`02` §4.2). For example, `reward` gold is for coins and rewards only, and `error` red never appears in learner art. |
| **Dimension** | **Only the Mentor characters (and the Diorama they stand on) are 3D** (`02` rule 10). Every other asset is flat-tactile: solid fills, one soft shadow at most, no gloss, no bevel, no drop-shadow ridge, no glass. The one permitted line is the `-ridge` edge on coin, medal and hexagon art (`02` §4.4). |
| **Shape** | Shapes keep their meaning (`02` "Shape by object type"): the hexagon is collectible, the coin is currency, the pill is an action, the circle is one icon action. A badge is never a circle, a coin is never decorative. Corners are rounded to match the radius scale (12/20/28/36). |
| **Form language** | Simple, bold silhouettes that read at 48 px. At most 3 hues plus ink per icon. No hairlines under 2 px at the rendered size. |
| **Text** | **No text inside any asset**, in any language (`02` §9.7). Labels, numbers and prices are DOM text layered by the system, so they stay translatable and inside the Text Fit Contract. |
| **Modes** | Every asset is checked on the light *and* the dark surfaces. It either works on both, or ships as a light/dark pair registered in the manifest. |
| **Emotion** | Warm, calm, encouraging. No fear, no loss imagery (broken hearts, empty wallets, crying faces). No shame signals (B.26). Money is shown as simulated coins, never as real banknotes or card numbers (D.7). |

### 3.1 Formats

| Need | Format | Notes |
|---|---|---|
| Flat icon of our own (course, pocket, task category) | **SVG** | Token colours as CSS variables, so both modes work from one file. |
| Illustration or scene (empty state, onboarding, marketing) | **WebP** with alpha (PNG fallback) | Rendered at 1× / 2× / 3×, sized to its slot. |
| Mentor character still | **WebP/PNG with alpha**, rendered from the 3D model | Section 4. |
| Motion of a flat element (a coin drop, a badge reveal, a pocket filling, milestone celebration) | **Lottie** (JSON, or dotLottie) | Section 5. |
| Mentor character motion | The 3D runtime on the Mentor stage (`08`), or pre-rendered sequences from the model | Never a Lottie redraw of a character. |

### 3.2 Initial size budgets (design judgement; revise with real measurements)

SVG icon ≤ 6 KB. Illustration ≤ 120 KB per 2× WebP. Character still ≤ 150 KB per 2× WebP. Lottie ≤ 150 KB, ≤ 3 s, ≤ 60 fps. Anything larger needs a reason in the manifest. Everything below the first view is lazy-loaded.

## 4. The Mentor characters: always the real ones

- **Source of truth:** the four 3D characters (Dr. Rho, Zara, Liruf, Dina), the **Diorama** they stand on, and the **pose catalogue** already defined for them all live in the main project folder. The agent opens those files, inspects the models and renders from them. **This bible does not redefine them.** When a pose, a proportion or a colour here seems to conflict with the models or the catalogue, the models and the catalogue win.
- **Allowed:** rendering stills and short sequences from the real models, in catalogue poses, with the lighting and camera set up for the Diorama. Stills can be used anywhere a character slot exists: the app, marketing, emails and the public badge page.
- **Not allowed:**
  - generating a character "in the style of" the Mentors with an image model, without the model;
  - changing proportions, colours or outfits;
  - inventing a new pose outside the catalogue without adding it to the catalogue first;
  - putting text on a character render;
  - showing a character in a scene that contradicts its personality or the age register (B.23).
- **New poses** are added to the catalogue (named, with a use case) *before* they are used. The manifest records the pose ID of every render.
- **Presence by age band:** high for 6–9, reduced for 10–12, minimal for teens, and none for parent and staff utility screens beyond the Mentor stage and the Mentor summary (B.23, `02` D8). The slot rules do not change with age; how often and how large the character appears does.
- **Placement:** always in a labelled slot (`02` §9.7) with a stated aspect ratio and a transparent background.

## 5. Motion assets (Lottie and rendered sequences)

Everything in `04-MOTION.md` applies to assets too:

- Entrances and state changes map to the motion tokens (80/150/250/380/700 ms). A celebration asset may keep settling after its 700 ms entrance (particles falling, a coin landing), up to 3 s in total, once. Idle loops follow the idle-loop exception, within the budget of 3 moving things at once.
- **Celebration assets** (confetti shapes, coin bursts, badge reveals) play **only** on the D7 milestone list: lesson complete, course complete, savings goal reached, badge earned, and streaks of 7, 30 and 100 days (OD-7).
- **Reduced motion:** every Lottie has a designated static frame that is shown instead. Every rendered sequence has a still. The state change still happens (`04` §3).
- A motion asset never carries text, and never loops forever in a learning surface: it plays once and settles. The only loop there is the Mentor's catalogue idle on the stage (`08` §3), and it counts toward the 3.

## 6. The asset manifest (how the agent keeps this under control)

Every class-B asset is registered in one manifest in the codebase (for example `assets/manifest.json`), with:

`id` · `class` (B) · `type` (svg | webp | lottie | render) · `slot` (the `02` §9.7 slot it fills) · `aspect` · `modes` (both | light | dark) · `character` and `poseId` (renders only) · `sourceModel` (renders only) · `altKey` (an i18n key for the accessible name, or `decorative`) · `sizesKb` · `motionTokens` and `staticFrame` (Lottie only) · `generatedBy` · `reviewStatus` (draft | approved | retired) · `approvedBy`.

The build fails if a component references an asset that is not in the manifest, or one that is not `approved`.

## 7. Review gate

1. **Automated:** the colour check (every pixel colour within tolerance of a token, sampled on flat assets), the no-text check (OCR finds no text), the size budget, both-mode rendering, the reduced-motion static frame and the manifest completeness.
2. **Human:** the owner (or a named design reviewer) approves the **style** of the first asset in each family (course icons, pockets, badges, empty states, scenes, character renders). Later assets in an approved family need only the automated checks, plus a spot check.
3. A rejected asset is regenerated, not patched by hand into the style.

## 8. Accessibility

- Informative assets have an accessible name through the manifest's `altKey`, which is translated like any other string and stays within the Copy Budget (`06`: at most 12 words).
- Decorative assets are `aria-hidden`.
- An asset never replaces a text label that the user needs to act.

## 9. What this changes in the mockup reading

The mockup's stroke sprite, letter avatars ("R", "Z", "L", "D"), coin and medal vectors and the coloured icon discs on cards are **placeholders for slots**. Copy the slot (position, size, aspect ratio, colour role), not the drawing (K41).


---

Source: [08-MENTOR-STAGE.md](docs/littlefounders-spec/frontend/frontend-bible/08-MENTOR-STAGE.md)

# 08 · The Mentor stage — a 3D character on its Diorama, not a chatbot

Status: **owner-mandated (OD-15, 21 September 2026). Non-negotiable.** Written in English because the file feeds an AI frontend agent. Where this file and `13-OWNER-DECISION-LOG.md` disagree, the log wins. The Mentor's behaviour (pedagogy, safety, moderation, memory, session limits) is defined by the Product package, Block C and Appendices D, E and F. This file defines only how the Mentor **looks and is operated**.

## 0. The decision

The AI Mentor is **one of the four 3D characters** (Dr. Rho, Zara, Liruf or Dina, chosen by the learner), **standing on the Diorama**. It is not a chat window with an avatar.

Two things are therefore **destroyed, not restyled**, when this work is imported:

1. **The legacy Mentor UI** in the current LittleFounders application: the generic chat layout, with a message thread, bubbles, a bot avatar and an input bar as the whole screen. It is deleted and rebuilt from this file. No component, layout or style from it is ported.
2. **The legacy buttons and controls** across the application. They are replaced everywhere by the flat button system and controls in `02` §9.1–9.2 and §9.8. There is no "legacy" variant, and no mix of old and new buttons on any screen.

The v2.1 mockup's `mentor` route shows a chat-bubble layout with letter avatars. It is **not** the design. It is recorded as deviation **K42**.

## 1. Source of truth for the 3D

- The character models, the **Diorama**, and the **pose/animation catalogue** live in the main project folder. The agent opens them and builds from them. This file does not redefine them. If anything here conflicts with those assets, the assets win and this file is corrected.
- Poses and gestures come from the catalogue. The existing gesture and emotion vocabulary already built for the Mentor is reused, never duplicated (requirement B.8).
- The character renders in real time on the Diorama where the device allows (section 7). Everywhere else, stills and sequences are rendered from the same models (`07` §4).

## 2. What the screen is made of (top to bottom on a phone)

| Layer | What it is | Rules |
|---|---|---|
| **1. Top bar** | Close/back, the character's name, a menu (change Mentor, transcript, and "what my grown-up sees" only when a guardian link exists) | System glyphs only (`07` §2). The character's name is the title. Never "AI", "bot" or "assistant". |
| **2. The stage** | The Diorama with the character on it. It is the **dominant area of the screen**: about 55–60% of the height on a phone, and the left 7 of 12 columns on a wide screen. | Full-bleed scene, never boxed in a card. The character is the protagonist (`01` §1, pattern 3: the character is the protagonist, not decoration). Nothing decorative covers the character's face or hands. |
| **3. Speech plate** | The Mentor's **current turn only**, as a short caption anchored to the stage just below the character | One turn at a time, within the Copy Budget (`06`: 20 words and 2 sentences; 12 words for ages 6–9). One question per turn. It is not a scrolling thread. |
| **4. Board (on demand)** | The teaching board (`05`) when the Mentor demonstrates something | It enters beside the character on wide screens, and slides up over the lower stage on phones. The character stays visible and points or reacts. The board holds the visual; the character holds the voice. |
| **5. Response area** | 2–3 **reply chips** with suggested answers, the **text field**, and a **microphone** (only where the age safeguards allow it, C.2) | Chips are `option` controls (8 words at most; 5 for ages 6–9). The field is the flat input (`02` §9.8). One primary action. It never looks like a messaging app: no bubble tails, no read receipts, no typing dots. |

**The transcript** (the full conversation so far) is available from the menu as a sheet: accessible, searchable by screen readers, and in reading order. It is a secondary view for accessibility and review, never the primary layout.

## 3. Character states (what the learner sees the Mentor do)

Every state maps to catalogue poses and animations. The UI requests states and never fakes them.

| State | When | What the learner sees |
|---|---|---|
| Idle | Waiting for the learner | Catalogue idle loop. It counts as one of the 3 idle loops allowed on screen (`02` §9.4). |
| Listening | The learner is typing or speaking | Listening pose. With the microphone on, a level indicator in the response area (not on the character). |
| Thinking | Waiting for the model's reply | A thinking pose, **instead of typing dots**. If the wait exceeds about 1.5 s, a short status in the speech plate ("Thinking…", 1 word). |
| Speaking | Delivering a turn | The speaking animation, with the speech plate text shown as it is spoken. Audio follows the voice rules for the age and the session. |
| Demonstrating | Explaining with the board | A pointing or presenting gesture toward the board. |
| Encouraging | After a miss, or when offering a guided review (D9) | A warm gesture. Never disappointment, never a "sad" face (B.26: no shame signals). |
| Celebrating | **Only** on a D7 milestone reached in the session | The celebration gesture and, if applicable, the milestone asset (`07` §5). Never per answer. |
| Closing | Session end (C.16) | A closing gesture matched to how the session actually ended. |

## 4. Behaviour the UI must make visible (from Block C, not redefined here)

- **Hint ladder (C.13)** and **self-explanation prompts (C.14):** shown as Mentor turns, with reply chips for the likely answers.
- **Adaptation offers (C.15)**, such as the guided review: an offer with two equal choices, never a default-accepted path.
- **Repair (C.19):** "Did that help?" is a turn with chips, not a modal.
- **Session end (C.8, C.12, C.16):** the Mentor suggests stopping. The UI shows the closing state, one summary line, and one action back to the learning path.
- **What the grown-up sees:** only when a guardian link exists (a child in a family). A line in the menu explains it within the Copy Budget ("Your grown-up sees topics, not your words."). A teen without a parent (Option B) and an adult learner never see this line. The full rule lives in the Product package.

## 5. Text and voice together

- The speech plate is a **caption of the current turn**, kept short. When the Mentor also speaks it aloud, the plate still shows it for accessibility and for muted devices. The Forge content gate for authored segments follows B.18 (no long on-screen text duplicating narration). In live conversation the plate is the caption, and the Copy Budget keeps it short.
- Captions can be turned off only where accessibility settings allow. The transcript always keeps the full text.

## 6. Layout by width

- **Phone (< 600 px):** stacked. Top bar, stage (about 55–60% of the height), speech plate overlapping the lower edge of the stage, response area pinned to the bottom above the safe area. The board slides up over the lower stage.
- **Tablet (600–1023 px):** the stage keeps about 50% of the height. The speech plate sits beside the character when the scene allows it.
- **Desktop (≥ 1024 px):** the stage takes the left 7 of 12 columns, and the speech plate, board and response area take the right 5. This is an asymmetric split (`03`), never 50/50.
- The stage is never smaller than the response area on any width.

## 7. Performance and fallbacks

- **Real-time 3D** is used where the device and the settings allow it. Budgets: first render of the stage under 2.5 s on a mid-range phone, and a steady 30 fps minimum. The model loads progressively, with a pre-rendered still of the same character and pose shown until it is ready.
- **Fallback (low-power device, no WebGL, or data saver):** pre-rendered stills and short sequences from the same models and catalogue poses (`07` §4). The layout does not change. In the fallback, idle is a still: sequences play once per state change and settle.
- **Reduced motion:** the character switches poses with a short cross-fade instead of animating. The idle loop stops. Every state stays visible (`04` §3).
- **Mobile wrapper (OD-12):** the stage remains one isolated component with a documented interface (inputs: character, state, board open/closed, age band; outputs: ready, error). The future wrapper shares this web component and must preserve its fallback, input and accessibility behavior.

## 8. Choosing and changing the Mentor

- The chooser shows the **four real characters on the Diorama**, rendered from the models. It does not use letter avatars or cards with personality paragraphs.
- Each character has its name and one line of at most 6 words. Personality shows through pose and animation, not text.
- The choice fills every Mentor slot in the product: the lesson prompt label, the guided review, the home card, the navigation tab (the character's name and avatar), the profile and this stage (`02` §9.7).

## 9. Age bands (B.23)

- **6–9:** the largest character presence, the most animation and the smallest text budgets (`06`). Reply chips come first; the text field is secondary.
- **10–12:** the stage is slightly smaller, and the text field is equal to the chips.
- **13–17:** minimal "mascot" framing: the same character and Diorama, calmer animation, and the text field first. Framing is never childish.
- The Diorama, the character models and the components do not change between bands. Presence and wording do.

## 10. Acceptance checklist (the legacy UI is gone when all of these pass)

1. There is no chat thread as the primary view. The transcript is a secondary sheet only.
2. There are no bubble tails, typing dots, bot or letter avatars, or "AI assistant" labels.
3. The chosen character, on the Diorama, occupies the dominant area on every width.
4. Every character state in section 3 is driven by catalogue poses, and there is no celebration outside D7.
5. The speech plate and chips pass the Copy Budget audit. All text passes the Text Fit audit.
6. The microphone appears only where C.2 allows it.
7. Reduced motion and the low-power fallback render the same layout with stills.
8. Every button and control on the screen is from the `02` system. No legacy component is imported anywhere in the Mentor feature.
9. The same stage component and character system is reused for the lesson player's character presence (B.8), not rebuilt.

## 11. The compact stage in the lesson player (B.8)

Requirement B.8 asks for the Mentor's visible, animated presence during lessons, using the same character system. The lesson player uses **the same stage component at a compact size**, not a second system:

- **Phone:** a band at the top of the lesson screen, under the progress bar, at most **25% of the height** (30% for ages 6–9, 15% for teens). The character sits on the edge of its Diorama, waist-up or full body as the catalogue pose allows. The band may show the active adventure's scene (B.8). Below the band, the screen keeps its full-bleed lesson hue (`02` §4.5).
- **Desktop:** a side column of 4 of 12 columns, left of the question. The question, the answers and the board take the other 8.
- **Behaviour:** the same states as section 3. The character introduces the question, reacts to answers with encouraging or neutral gestures, and demonstrates beside the board. It never goes inside the board (`05` V3). It never celebrates a single correct answer (D7).
- **Text:** the Mentor's words in a lesson are the prompt label ("Dina asks") and, for a guided review or a hint, one speech-plate turn within the Mentor budget (`06`).
- **Reduced motion and low power:** stills, as in section 7.
- The compact stage never pushes the answers below the first view on a 375 × 740 px screen. If it would, it shrinks to the minimum band (15%) first.


---

Source: [01-RESEARCH-FOUNDATION.md](docs/littlefounders-spec/frontend/frontend-bible/01-RESEARCH-FOUNDATION.md)

# LittleFounders — Frontend Design Research Foundation

**Scope:** Frontend only. No product description. This document is the evidence base
for the rule set in `02-FOUNDATIONS.md` (which carries the `DESIGN.md` tokens). It is NOT the `DESIGN.md`.
**Language:** English (all project documentation).
**Status:** Final (v2, 2026-09-20). This is the evidence base behind the rules in
`02-FOUNDATIONS.md`, `03-PROPORTIONS-AND-COMPOSITION.md` and `04-MOTION.md`. It holds
findings and their grades, not tokens or rules; where a finding became a rule, the rule
lives in `02`–`04`, and the owner decisions in `13-OWNER-DECISION-LOG.md` take precedence.

---

## 0. How to read this document

### 0.1 Evidence grades

Every claim carries a grade. The design system may only turn a claim into a hard rule
if the grade allows it.

| Grade | Meaning | May become |
|---|---|---|
| **A** | Meta-analysis, large replicated study, or binding standard (WCAG) | Hard rule (MUST / MUST NOT) |
| **B** | Single strong study, or converging qualitative evidence | Strong default (SHOULD) |
| **C** | Contested, mixed replication, or expert consensus without controlled data | Guideline with stated caveat |
| **D** | Practitioner folklore, blog-level, or a claim we could not verify | NOT a rule. Do not encode |

### 0.2 Why this matters

The single largest risk in this project is **bias laundered as principle**. Design
writing is full of confident statements ("blue builds trust", "round shapes feel safe")
that are either context-dependent or fail replication. An AI agent given such a
statement as a rule will apply it rigidly everywhere. Section 2 and 3 exist to prevent
that.

### 0.3 Project decisions already fixed by the owner

These are inputs, not findings. They are not up for re-litigation in later phases.

1. **One visual language for every user.** No per-audience skins. Uniformity is the point.
   Density differences are solved by composition (how much content fits), never by a
   different style.
   *Clarified by the owner on 2026-09-20 (OD-4):* one design system for every surface and
   user; what varies by age band is only copy tone, character presence, reward framing and
   social mechanics (`02` D8).
2. **No glassmorphism.** Base style is flat-tactile with solid colour.
3. **"Absolute" colours** (one solid, saturated hue per meaning) carry achievements,
   categories and states, as in the reference set.
4. **A warm contrast accent** is introduced (coral/orange family) alongside the brand
   indigo.
5. **Characters are 3D** wherever possible.

---

## 1. The reference set — what the style actually is

Twelve reference screens were supplied. Palettes were extracted programmatically and
each screen was read individually. The recurring structure (appears in 8+ of 12):

| # | Pattern | Evidence in references |
|---|---|---|
| 1 | One brand colour + one warm contrast accent | Indigo/violet + coral or yellow in refs 2, 3, 5, 10, 11 |
| 2 | Large, fully rounded surfaces (20–32 px), capsule buttons, circular icon holders | All 12; no square corners anywhere |
| 3 | Character or illustration is the protagonist, not decoration | 30–50% of welcome screens (refs 2, 3, 10, 11, 12) |
| 4 | Hierarchy by weight, not size or colour | Extra-bold titles, regular body |
| 5 | One primary action per screen, label legible on its fill | All welcome and result screens |
| 6 | Progress always visible (thin bars, rings, dots, counters) | Refs 1, 2, 4, 7, 10, 12 |
| 7 | Colour-by-category cards | Refs 1, 4, 7, 8 |
| 8 | Simple bottom navigation, 4–5 items | Refs 1, 2, 3, 7, 8, 10 |
| 9 | Generous white space; density only in the adult dashboard | Refs 4, 6 |

**Contrast finding that directly affects the "absolute colour" decision.** The saturated
fills used in the references were measured against white and dark ink text (WCAG relative
luminance, computed, not estimated):

| Fill | White text | Ink text | Usable label colour |
|---|---:|---:|---|
| Indigo `#4f46e5` | 6.29 | 2.84 | white |
| Violet `#8977eb` | 3.56 | 5.02 | ink |
| Coral `#ed7353` | 2.93 | 6.10 | ink |
| Orange (ref 1) | 2.54 | 7.02 | ink |
| Green `#5fdc7a` | 1.75 | 10.21 | ink |
| Green `#57bc7b` | 2.36 | 7.55 | ink |
| Yellow (ref 5) | 1.67 | 10.69 | ink |
| Sky blue (ref 1) | 2.87 | 6.23 | ink |
| `success` in current pseudo-doc `#059669` | **3.77** | 4.74 | ink (white **fails AA**) |

**Consequence (grade A, derived from WCAG 1.4.3):** in this style, *only deep fills take
white text*. Bright "absolute" fills take **dark ink text**. This is a token-level rule:
every fill token must ship with its own `on-*` token chosen by measurement, never by
habit. The current pseudo-doc violates this with `on-success: #ffffff`.

---

## 2. Colour psychology — what is and is not established

### 2.1 What the science actually supports

**Colour-in-Context theory** (Elliot & Maier, 2012, 2014) is the leading framework. Its
six propositions (as summarised in later literature): colour carries meaning; it can
influence behaviour; responses can be automatic; associations arise from learning and
biology; the relation is reciprocal; and **the effect of a colour is context-specific**.

**Grade A finding, stated carefully:** the same colour produces *different or opposite*
effects in different psychological contexts. Meier et al. (2012) found red made people
walk *faster* to a dating interview and *slower* to an intelligence interview. There is
no context-free "meaning of red".

### 2.2 What fails or is unstable

**Red and achievement.** Elliot et al. (2007) reported that brief exposure to red before a
test impaired performance. Later replications are mixed:

- Four replication attempts on the *word* "red" (Collabra, 2020; N = 69, 104, 103, 1,149)
  found effects near zero (Cohen's d = 0.04, −0.23, 0.19, 0.01). The authors conclude the
  effect, if real, is small enough to need very large samples.
- A separate replication (2019) supported the original on evaluation and failure focus.

**Grade C.** The honest position: red-in-achievement is *plausible, possibly small,
not settled*. The field's own review says it is "at a nascent stage" and asks for
"patience and prudence" before real-world application.

### 2.3 Decisions this supports

- **Do not encode "blue = trust", "green = calm", "red = danger" as universal rules.**
  (Grade D as universals.) They may be used as *conventions of this product* — a
  convention is a promise the product keeps, not a fact about brains.
- **Keep "no red for a wrong answer".** The pseudo-doc already does this. The defensible
  reason is *not* "red harms performance" (unsettled). It is: **(a)** red carries a
  "marked wrong on school papers" association for children (a learned association,
  Grade C); **(b)** the cost of avoiding red is zero; **(c)** amber plus a shape mark
  carries the meaning without it. Cheap, low-risk, reversible. Grade C, kept as a
  guideline.
- **Semantic colour must be a system convention, defined once, applied uniformly.**
  The value of an "absolute colour" is *consistency of meaning across the product*, not
  any innate meaning of the hue.

---

## 3. Shape psychology — what is and is not established

### 3.1 The famous claim

Bar & Neta (2006, *Psychological Science*) reported people prefer curved to sharp-angled
objects and proposed a threat-avoidance explanation. It is widely repeated as
"round = safe and friendly".

### 3.2 What the meta-analysis found

Chuquichambi et al. (2022, *Annals of the NY Academy of Sciences*; 61 records) reviewed the
field and concluded:

> preference for visual curvature is "a reliable but not universal phenomenon", moderated
> by **presentation time, stimulus type, expertise and task**.

A follow-up reading of the same dataset found the effect **small to non-significant for
spatial-design stimuli** (rooms, buildings) versus larger effects for meaningless shapes
and real objects, and a negative relation between curvature preference and how many
*affordances* an object has.

**Grade A for "reliable but not universal". Grade C for any mechanism (threat, etc.).**

### 3.3 Decisions this supports

- **Do not justify the rounded style with "round shapes feel safe".** That is the
  overreach. The style is justified by **(a)** the owner's reference set and brand
  direction and **(b)** the functional benefits below.
- **Functional, verifiable reasons for large radii and capsule controls:**
  - A capsule reads as *pressable* because it is a *closed, self-contained hit region*
    (affordance). This is an interface claim, testable by tap-accuracy, not a claim
    about emotion.
  - A consistent radius scale makes *hierarchy* legible (control vs. surface).
- **Impeccable's catalogue flags "extreme border-radius on cards" (44 px on a small
  card) as a design-review smell.** The cure there is *proportion to size*, not
  abolition. Our rule: radius scales with the element's shortest side; a small card
  must not use a hero radius.
- **Affordance beats aesthetic.** Curved-preference research finds *lower* preference for
  curvature in objects with many affordances. For us: **do not make a control less
  legible as a control in order to look soft.**

---

## 4. Gamification — effect, and how it goes wrong

### 4.1 Does it work?

Sailer & Homner (2020, *Educational Psychology Review*): significant **small** effects on
cognitive (g = 0.49), motivational (g = 0.36) and behavioural (g = 0.25) outcomes
(k = 9–19 per outcome). The cognitive effect was stable in high-rigour subsets; the
**motivational and behavioural effects were less stable**. Heterogeneity was high
(other syntheses report I² ≈ 92%).

Moderators that mattered:
- **Game fiction** (a story/world wrapper) — helped behavioural outcomes.
- **Competition combined with collaboration** — helped; competition alone did not.

**Grade A** for "small positive, heterogeneous". **Grade B** for the two moderators.

Implication: this platform's *story-driven* framing (a character, a world, missions) is the
best-supported gamification element. Leaderboard-style pure competition is the
least-supported.

### 4.2 The reward trap (overjustification)

Deci, Koestner & Ryan (1999, *Psychological Bulletin*; 128 experiments):

- Engagement-, completion- and performance-contingent **tangible** rewards significantly
  **undermined** free-choice intrinsic motivation (d = −0.40, −0.36, −0.28).
- **Positive informational feedback enhanced** it (d = +0.33 free-choice; +0.31 interest).
- **Tangible rewards tended to be more detrimental for children than for college
  students.** Verbal/informational rewards were *less* enhancing for children.

**Grade A.** This is the strongest single finding for our design and it is directly
about our audience.

Design consequences (all derived, none invented):

| Principle | Reason | Applies to |
|---|---|---|
| Feedback must be **informational** ("you split the fraction correctly"), not controlling ("you MUST keep your streak!") | DKR 1999: informational feedback enhances; controlling erodes | All feedback copy and states |
| Rewards must not be the *point* of the screen | Completion-contingent tangible rewards undermine interest, worse in children | XP/coin displays are secondary chrome, never the hero |
| Celebrations mark a **real** milestone, not a click | Engagement-contingent rewards undermine most (d = −0.40) | Confetti/burst budgets |

*Caveat:* the "overjustification effect" is contested in language-learning contexts
specifically (Grade C for that sub-domain). The meta-analytic evidence above is general
and stronger.

### 4.3 Loss aversion and streak harms

Loss aversion ("a loss weighs roughly twice a gain") is well known (Kahneman & Tversky).
Applied to streaks it produces retention **and** anxiety. Evidence quality here is
**mixed**:

- A qualitative case study of a language-learning app (arXiv 2203.16175) documents users
  reporting **apprehension** and **self-recrimination** driven by gamification misuse
  (e.g., stress over leagues; gamification becoming "another chore"). **Grade B**
  (qualitative, real users, single app).
- Parent-facing blogs and Medium posts report anxiety in children. **Grade D** as
  evidence. Consistent, but not a study. Not cited as proof.
- Commentary that streak mechanics "monetize anxiety" (paid streak repair) is
  **Grade D** as science but is a legitimate **design-ethics warning**.

**Decision (design-ethics, not a claim of proven harm):** for a platform whose users are
children, the burden of proof is on the mechanic. We adopt **"forgiving by default"**:

- No guilt-framed copy. No sad-mascot-as-punishment.
- Loss states are **never** the most visually prominent state on a screen.
- Streaks, if used, must have a built-in grace mechanism and must never be sold back.
  (Note: the platform's product docs state no billing exists, which removes the
  monetization vector; the *visual* language must still not imitate it. Owner decision
  OD-5, 2026-09-20: the platform is free at launch and pricing is parked; if a paywall ever
  comes, streaks, rest days and error forgiveness can never be sold.)

### 4.4 "Designed to wear the user down" — the user's stated concern

The owner asked that this be handled from the start. Two distinct concerns exist and must
not be conflated:

1. **UI that wears down the end-user** (dark patterns, streak anxiety, notification
   pressure). Addressed in 4.2–4.3 and in the "Engagement ethics" rules to be derived.
2. **AI tooling that wears down the developer** (more tokens, more dialogue turns).
   Addressed in Section 6.

---

## 5. Accessibility and children's motor ability — hard limits

### 5.1 Binding standards (Grade A)

| Requirement | Value | Source |
|---|---|---|
| Normal text contrast | ≥ 4.5 : 1 | WCAG 1.4.3 (AA) |
| Large text contrast | ≥ 3 : 1 | WCAG 1.4.3 (AA) |
| UI component / graphic contrast | ≥ 3 : 1 | WCAG 1.4.11 (AA) |
| Colour not the only channel | required | WCAG 1.4.1 (A) |
| Minimum target size | 24 × 24 CSS px (or spacing exception) | WCAG 2.5.8 (AA) |
| Enhanced target size | 44 × 44 CSS px | WCAG 2.5.5 (AAA) |
| Body text (Impeccable guidance) | ≈ 16 px start | Impeccable, a tool convention (Grade C) |
| Line length | 65–75 characters | Impeccable, a tool convention (Grade C) |

### 5.2 Children are not small adults (Grade A/B)

- Children 7–10 years old **missed 7 mm targets almost 30 % of the time**; 11–17 year olds
  about **20 %** (Anthony et al., 2013, cited in a ScienceDirect study of ages 3–6).
- Nielsen Norman Group (usability studies with children aged 3–12, ~125 children across
  three rounds) recommends **at least 2 cm × 2 cm** touch targets for young children
  (four times the 1 cm × 1 cm adult recommendation), and notes fine gestures such as
  dragging are hard for young children, while tapping, swiping and large-motion gestures
  are easy.
- Target ages differ enough that NN/G distinguishes at least 3–5, 6–8 and 9–12.

**Implication for the pseudo-doc's "44 px, 48 px on answers":** 44 CSS px is roughly
**7–11 mm** on common phones depending on pixel density. That sits **inside the range
where 7–10 year-olds still err**. It satisfies WCAG AAA and adult use; it is *not*
evidence-based comfort for the youngest users. **Open decision, see Section 8.**

### 5.3 Colour-vision deficiency (Grade A for prevalence, with a caveat)

- Red–green CVD affects **up to ~8 % of males and ~0.5 % of females of Northern European
  descent**; rates are lower in Asian and African populations. The "8 % of men" figure is
  **regional, not a global average**; pooled global estimates are nearer 4.5 % (male) and
  0.4 % (female).
- The platform serves Mexico and Brazil. Precise local rates are **not established by
  the sources gathered** (do not assume 8 %). The design consequence is identical at any
  of these rates: **never use colour as the only channel.**

**Measured on our candidate palette** (Machado et al. 2009 simulation, CIELAB ΔE76;
computed, not estimated):

| Pair | Normal vision ΔE | Worst-case CVD ΔE | Verdict |
|---|---:|---:|---|
| Indigo ↔ Violet | 14.0 | 10.5 | **Confusable even with normal vision** |
| Coral ↔ Green | 106.2 | **10.8** | **Collapses under CVD** |
| Coral ↔ Pink | 57.0 | **11.3** | **Collapses under CVD** |
| Sky ↔ Violet | 53.4 | 15.8 | Marginal |
| Green ↔ Sky | 98.0 | 16.9 | Marginal |

**Consequences (Grade A method, derived numbers):**
1. **Indigo and violet must not be used as two distinct meanings.** Either merge them or
   move violet far enough away.
2. **Coral and green — the natural "wrong / right" pair — collapse under CVD.** The
   correct/incorrect state therefore **must** carry a second channel (icon shape + word),
   and the palette must not rely on hue to separate them. This independently confirms
   the pseudo-doc's `AnswerMark` idea.
3. "Absolute colours per achievement" is compatible with accessibility **only if** every
   colour also has a **shape/icon and a text label**, and the palette is validated by
   simulation before adoption.

---

## 6. Designing for AI agents — evidence on context files, and the token-cost concern

The owner's concern: *AI use is designed to wear the user down, burn tokens and force more
dialogue turns; do it right from the start.* The evidence is directly relevant.

### 6.1 What the best available study found (Grade B, one strong preprint)

Gloaguen et al. (arXiv 2602.11988, ETH Zurich, v2 June 2026) evaluated repository context
files (AGENTS.md / CLAUDE.md) on coding agents across four models and two benchmarks
(SWE-bench Lite 300 tasks; CtxBench 138 tasks with developer-written context files).

- Context files **did not significantly improve task success**. LLM-generated files
  changed resolution by −0.5 % (SWE-bench) and −2 % (CtxBench) on average (p = 0.87, 0.37).
- They **raised cost by ~20–23 %** and increased steps (≈ +2.5 to +3.9 per task); reasoning
  tokens rose ~10–22 %.
- Agents **followed the instructions well**; that is *why* cost rose (more testing and
  exploration). It was not an instruction-following failure.
- **Codebase overviews were not helpful.** Agents did not find relevant files faster.
- Developer-written files beat LLM-generated ones by a significant margin (≈ 7 %,
  p = 0.038), but were still not significantly better than none (p = 0.21).
- Length of the file **did not** correlate with success or cost. What raised cost was
  **the number of *followed instructions***.
- Recommended content: *only* non-standard instructions the agent cannot infer from the
  repo.

**Limitations to state honestly:** Python only; software-engineering tasks (bug fixes),
**not UI-design quality**; coding agents, not design agents. It is a **strong signal about
cost and instruction-following, not proof about design outcomes.** Do not over-extend it.

### 6.2 What Impeccable's own research adds (Grade C, self-reported, credible method)

Impeccable v4 research notes (July 2026; ~30 iterations, ~200 sampled concepts, ~$2,600
in evaluations):

- Asking a model to "be creative" produced **the same concept 30 of 35 times**. Wording
  changed; the idea did not.
- The same happened after "reject your first idea": the model landed on its **second
  default**.
- **A varied shortlist still collapsed to one winner** when the model chose. Their fix:
  the model *proposes* options, a **script assigns** which to build.
- Adding many discouraging instructions made work "timid". The **biggest single quality
  jump** came from removing a safeguard and ordering the work: **commit to the concept
  first, then refine clarity.**
- A **written direction contract** compared against the rendered result by a *separate*
  reviewer caught gaps that self-review missed.
- Their own catalogue rejected glassmorphism as an AI default. **Independent
  confirmation of the owner's decision, but the source is a competitor tool, so treat as
  supporting, not decisive.**

**Caveat on this source:** the evaluations were run by the tool's authors, with the
project's design director as the human rater. Results are informative, not independent.

### 6.3 What this means for how the `DESIGN.md` must be written

Derived from 6.1 and 6.2 (Grade B/C; these shape *format*, they are not design facts):

1. **Do not describe the codebase.** Overviews are not helpful. The file must state only
   what an agent **cannot infer**: the decisions.
2. **Every instruction costs tokens because it is followed.** Each rule must earn its
   place. Prefer **few, high-leverage, enforceable** rules over long prose.
3. **Prefer machine-checkable rules over prose.** A rule that a linter can verify does not
   need to be re-read every turn. (Impeccable ships a detector that runs "in code,
   without an AI model or API key".)
4. **Put the token names and values in structured YAML;** put *why and when* in short
   prose. This matches the open `DESIGN.md` spec (below).
5. **Do not rely on the model's taste to avoid genericness.** Give it a *concrete
   direction* (this product's own visual world), not an instruction to "be creative".
6. **Do not make the file longer to feel thorough.** Length is not correlated with
   benefit; followed-instruction count correlates with cost.

### 6.4 The open `DESIGN.md` format (Grade A for the spec itself)

Google Labs' open spec (`google-labs-code/design.md`, alpha):

- YAML front matter for tokens: `colors`, `typography`, `rounded`, `spacing`, `components`.
- Token references with `{path.to.token}`.
- **Eight body sections in fixed order:** Overview, Colors, Typography, Layout,
  Elevation & Depth, Shapes, Components, Do's and Don'ts. Unknown sections are preserved.
  **Duplicate section headings are an error.**
- Recommended (non-normative) names: `primary, secondary, tertiary, neutral, surface,
  on-surface, error`; type levels `headline-*, body-*, label-*`; radii `none, sm, md, lg,
  xl, full`.
- Colour values may be hex, `rgb()`, `hsl()`, `oklch()`, etc.; all are converted to sRGB
  for WCAG checks.

Impeccable reads `DESIGN.md` plus a separate `PRODUCT.md` (users, purpose, principles).
**The owner has excluded product description from this document set**, so any
product-context content stays out; only the design system goes in.

---

## 7. Anti-pattern catalogue — what to forbid, and what not to over-forbid

Source: Impeccable's public slop catalogue (61 detector rules + 6 design-review patterns).
Treat as **Grade C**: a well-maintained practitioner list, not science. Only the entries
that touch this project's decisions are reproduced.

### 7.1 Directly relevant to the owner's decisions

| Catalogue entry | Relevance |
|---|---|
| **Glassmorphism everywhere** (design-review) | Confirms dropping glass. |
| **Bounce or elastic easing** | Conflicts with playful gamified motion. See 7.3. |
| **Extreme border-radius on cards** | Proportion rule (Section 3.3). |
| **Icon tile stacked above heading** | The pseudo-doc's `.lf-tile` lockup is exactly this pattern. Conflict. |
| **Label above a heading** ("eyebrow") | The pseudo-doc's `.lf-eyebrow` "strongest typographic signature" is flagged. Conflict. |
| **Overused font (Inter, Geist)** | Pseudo-doc uses Inter as the only UI family. Conflict. |
| **Nested cards / cards inside cards** | Relevant to dashboard composition. |
| **Identical card grids** | Relevant to course and category grids. |
| **Gradient text**, **radial-gradient halo**, **dark mode with glowing accents** | Avoid. |
| **Side-tab accent border** | Avoid; use only for a real status. |
| **Low-contrast text**, **tiny body text**, **tiny interface text** | Reinforce Section 5. |
| **Pulsing status dot**, **auto-scrolling marquee**, **images that move on hover** | Motion budget. |
| **Em-dash overuse** (copy) | Matches the owner's copy rule in the pseudo-doc. |
| **Rough SVG illustrations** | Argues for *properly made* character assets, not hand-coded ones. |
| **Cream/beige palette** | Only if it is a considered choice. |

### 7.2 Where the catalogue is a tension, not a law

The catalogue targets *marketing/product-UI defaults* and is **not calibrated for
children's gamified learning**. Three places where we should **consciously diverge**:

- **Bounce/spring easing.** Flagged as fussy for "a routine action". In a gamified
  learning product, a springy reward at a *real milestone* is part of the reference
  style (refs 1, 7, 10). Rule should be **contextual**: bounce is allowed only on
  reward/celebration moments, never on routine navigation or dialogs.
- **Large icon tiles.** Flagged as decoration outranking content. In our references, big
  illustrated tiles *are* the content (ref 5, 10). Rule: the tile must **be** the
  navigational object, not ornament above a heading.
- **Repeated similar cards.** Flagged for identical grids. Our category cards *should*
  look like a family, differentiated by their absolute colour and illustration. Rule:
  **family resemblance with per-item colour and art is intentional; identical
  icon-heading-text triplets are not.**

### 7.3 Where the catalogue itself may be biased

The catalogue is one author's taste system, tuned to detect what current models
overproduce. Its own research notes that "the catalogue has to respond as those defaults
change." **Do not treat it as timeless truth.** Adopt the *checking mechanism*
(detect → fix) more than any specific taste verdict.

---

## 8. Open decisions — must be answered before writing `DESIGN.md`

These are unresolved by the evidence and need the owner.
*Status (v2):* all eight were answered in `02` (decision log §1, and sections 4, 6, 8,
9.6 and 11). D7 (bounce policy) and D8 (age bands) were settled finally by owner decisions OD-7
and OD-4 on 2026-09-20 (`02` D7, D8).

| # | Decision | Why it is open |
|---|---|---|
| D1 | **Tap-target floor.** Keep 44/48 px, or raise (e.g. 56 px+) on answer surfaces? | 44 px ≈ 7–11 mm, inside the range where 7–10 year-olds still err ~30 % (5.2). Trade-off is screen space vs. accuracy. |
| D2 | **Palette collapse.** Merge indigo/violet? Re-space coral/green? | Measured collapse under CVD (5.3). |
| D3 | **Text-on-fill policy.** Dark ink on bright "absolute" fills (measured to pass) vs. deepen fills to allow white | Section 1 contrast table. Affects the whole colour-token set. |
| D4 | **Typeface.** Keep Inter (flagged as overused) or choose a face with more character | Conflicts with Section 7.1; also a legibility question for children. |
| D5 | **Eyebrow / icon-tile lockup.** Keep, restyle, or drop | Both flagged in the catalogue; both central to the pseudo-doc. |
| D6 | **Streak mechanic.** Include at all? If so, grace rules | Section 4.3. Ethics decision, not a research fact. |
| D7 | **Bounce policy.** Confirm "reward moments only" | Section 7.2. |
| D8 | **Age bands.** One tap-size/type scale for all, or scale up under a size setting | Owner rule is *one style*; a *size* setting is not a *style* — needs an explicit ruling. |

---

## 9. What is deliberately NOT concluded

To avoid bias, the following are **not** claimed by this document:

- That any colour has an innate emotional meaning.
- That rounded shapes are inherently safer or friendlier.
- That gamification "boosts engagement" without qualification (effects are small,
  heterogeneous, less stable for motivation and behaviour).
- That context files (`DESIGN.md` included) *improve* agent output. The best evidence
  says they mainly **change behaviour and raise cost**, and help only when they contain
  **non-inferable specifics**.
- That Impeccable's rules are correct for children. It is not built or validated for
  that audience.
- That the "8 % of men colour-blind" figure applies to this platform's markets.

---

## 10. Source list

**Colour**
- Elliot, A. J., & Maier, M. A. (2014). Color psychology: Effects of perceiving color on
  psychological functioning in humans. *Annual Review of Psychology, 65*, 95–120.
- Elliot, A. J., & Maier, M. A. (2012). Color-in-context theory. *Advances in Experimental
  Social Psychology, 45*, 61–125.
- Elliot, A. J., et al. (2007). Color and psychological functioning: The effect of red on
  performance attainment. *J. Exp. Psychol.: General, 136*, 154–168.
- Meier, B. P., D'Agostino, P. R., Elliot, A. J., Maier, M. A., & Wilkowski, B. M. (2012).
  Color in context: Psychological context moderates the influence of red on approach- and
  avoidance-motivated behavior. *PLoS ONE*.
- Four replication attempts on processing the word "red" and intellectual performance.
  *Collabra: Psychology*, 6(1), 2020.
- "The power of red: The influence of colour on evaluation and failure — A replication."
  *Acta Psychologica*, 2019.

**Shape**
- Bar, M., & Neta, M. (2006). Humans prefer curved visual objects. *Psychological
  Science, 17*(8), 645–648.
- Chuquichambi, E. G., Vartanian, O., Skov, M., Corradi, G. B., Nadal, M., Silvia, P. J., &
  Munar, E. (2022). How universal is preference for visual curvature? A systematic review
  and meta-analysis. *Annals of the NY Academy of Sciences, 1518*(1), 151–165.
- Djebbara, Z., et al. (2023). Affordances and curvature preference: The case of real
  objects and spaces. *Annals of the NY Academy of Sciences*.

**Motivation and gamification**
- Deci, E. L., Koestner, R., & Ryan, R. M. (1999). A meta-analytic review of experiments
  examining the effects of extrinsic rewards on intrinsic motivation. *Psychological
  Bulletin, 125*(6), 627–668.
- Sailer, M., & Homner, L. (2020). The gamification of learning: A meta-analysis.
  *Educational Psychology Review, 32*, 77–112.
- "When gamification spoils your learning: A qualitative case study of gamification misuse
  in a language-learning app." arXiv:2203.16175.

**Cognitive load**
- Rey, G. D. (2012). A review of research and a meta-analysis of the seductive detail
  effect. *Educational Research Review, 7*(3), 216–237.
- Sundararajan, N., & Adesope, O. (2020). Keep it coherent: A meta-analysis of the
  seductive details effect. *Educational Psychology Review*. (Overall g ≈ −0.33.)

**Accessibility and children**
- W3C. WCAG 2.2: SC 1.4.1, 1.4.3, 1.4.11, 2.5.5, 2.5.8.
- Nielsen Norman Group. *Design for Kids Based on Their Stage of Physical Development*
  (2024) and *UX Design for Children (Ages 3–12), 4th ed.*
- Anthony, L., Brown, Q., Nias, J., & Tate, B., et al. (2012–2013). Children's touch and
  gesture input on mobile devices; touch interaction for ages 3–6 (*Int. J.
  Human-Computer Studies*, 2014).
- Machado, G. M., Oliveira, M. M., & Fernandes, L. A. F. (2009). A physiologically-based
  model for simulation of color vision deficiency. *IEEE TVCG*.
- Prevalence: narrative review "A Global Perspective of Color Vision Deficiency" (MDPI
  *Healthcare*, 2025); pooled estimates cited by secondary sources (treat as Grade C).

**AI agents and design tooling**
- Gloaguen, T., Mündler, N., Müller, M., Raychev, V., & Vechev, M. (2026). Evaluating
  AGENTS.md: Are repository-level context files helpful for coding agents?
  arXiv:2602.11988 (v2, 23 Jun 2026).
- Impeccable (P. Bakaus). *The model can't roll its own dice* (research notes, July 2026),
  slop catalogue, and `document` command docs. impeccable.style.
- Google Labs. *DESIGN.md Format Specification* (alpha).
  github.com/google-labs-code/design.md

---

## 11. Method notes (for reproducibility)

- Contrast ratios: WCAG 2.x relative-luminance formula, computed in Python.
- CVD simulation: Machado et al. (2009) matrices at severity 1.0 (protan, deutan, tritan)
  applied in linear RGB; distance = CIELAB ΔE76. ΔE76 is a coarse metric and is used here
  only to rank pair separability; a threshold of "≈ 15 = collapses" is a working
  heuristic, **not a standard**.
- Reference palettes: 7-colour median-cut quantisation of each reference screenshot.
  These are *dominant on-screen values*, not the designers' source tokens; screenshots
  contain photographs and gradients, so treat percentages as indicative.
- Web sources were retrieved on 2026-09-20. Some secondary sources (blogs, Medium, parent
  guides) were read but **not** relied on for any grade A/B claim.

