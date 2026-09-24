# 12 — Product × Frontend Import-Readiness Review

> **Historical record (21 September 2026).** Its verdict ("not as one combined package, yet") was resolved: the owner decisions it asked for are recorded in `../13-OWNER-DECISION-LOG.md` (OD-1 to OD-15), the frontend inconsistencies F1–F12 are fixed in the Frontend Bible, and the mockup deviations K1–K39 are resolved (K40–K42 are open on purpose). Kept for traceability. Do not implement from this file.

**Question reviewed:** is the Product package (`10-PRODUCT-GOLD-STANDARD-REQUIREMENTS.md` + 15 appendices (16 since Appendix P was added after this review) + `11-INDEPENDENT-AUDIT-FINDINGS.md`) together with the Frontend delivery (`frontend-bible/01–04`, `mockup/littlefounders-mockup.html`, `verification-tools/`) ready to be imported into the LittleFounders project as the basis for development?

**Verdict: not as one combined package, yet.** Each package is individually strong in its own lane, but they were built in separate sessions with a deliberate wall between them (the Frontend Research Foundation §6.4 states the owner excluded product description from the frontend document set), and they have never been reconciled. The result is a set of direct contradictions on brand-level and safety-level points, a large coverage gap, and internal drift inside the frontend's own rule set. Roughly half of the material can be imported now; the other half needs one reconciliation pass and six owner decisions first. Section 7 gives the component-by-component matrix; section 8 the shortest path to "ready."

---

## 0. Method

- Read all four Frontend Bible documents and the README in full.
- Rendered all 14 mockup routes headlessly in Chromium (desktop 1280 px and mobile 390 px), extracted the visible English text of every route, and inspected screenshots.
- Re-ran both delivered verification tools against the delivered mockup (using a local Chromium in place of `@sparticuz/chromium`), and a patched version of the text-fit tool (see section 5).
- Cross-referenced every mockup route and Bible rule against the product audit (`00`–`09`), `COSMIC_NARRATIVE.md`, and the 112 requirements in `10-PRODUCT-GOLD-STANDARD-REQUIREMENTS.md`.
- Spot-checked the Frontend's headline citation against its primary source: Deci, Koestner & Ryan (1999) — the stated effect sizes (d = −0.40 / −0.36 / −0.28; positive feedback +0.33 / +0.31) match the published abstract exactly.

---

## 1. What held up under independent verification

| Claim in the Frontend delivery | Result of re-running it here |
|---|---|
| Proportion/composition audit: 0 findings across 168 page states | **Reproduced exactly.** 14 routes × 4 widths × 3 languages, 0 findings. |
| Text Fit Contract: no clipping/truncation across all routes | **Substantially reproduced** once the tool was patched to actually visit all routes (section 5). The only hits were the staff table's `<thead>` in stacked-card mode, which is hidden with a correct visually-hidden pattern (`clip:rect(0 0 0 0)`) — false positives of the tool, not defects. |
| 0 JavaScript errors across 14 routes | **Reproduced.** |
| Deci, Koestner & Ryan (1999) effect sizes | **Verified** against the published abstract. |

Genuine convergences with the Product package (arrived at independently, which strengthens both):

- **Wrong answers are never red** (amber + cross mark + informational hint). Directly implements Law 3 and B.26.
- **Forgiving streak** (two automatic rest days a week, best streak never erased, parent holiday pause, no guilt copy). Directly implements B.21 and D.2.
- **Informational rather than controlling feedback**, grounded in the same Deci/Koestner/Ryan meta-analysis that grounds B.20.
- **Colour is never the only channel**, measured WCAG contrast (128 checks), colour-vision-deficiency simulation, a 14 px text floor, touch targets by function, full `prefers-reduced-motion` handling. This is a rigorous accessibility foundation.
- **3D asset slots never carry text**, and a text-expansion contract tested in EN/ES/PT. This is exactly what the product's three markets (US, Mexico, Brazil) and B.16's localization requirement need.
- **"Simulation" label on the coin balance.** Honest, consistent with Law 5.
- **Evidence grading (A–D) with explicit "what we did not conclude" sections.** Same epistemic standard as the Product appendices.

---

## 2. Blocking conflicts between the Frontend and the Product/brand

These are not taste disagreements. Each one contradicts a documented fact about the platform, a brand law, or a mandated requirement.

| # | Conflict | Frontend evidence | Product / brand evidence | Severity |
|---|---|---|---|---|
| P1 | **Paid plans on a free product.** | `pricing` route: "Free / Family $8 per month / School Custom", "Start free. Upgrade when you are ready", a monthly/yearly toggle; "See pricing" linked from the 404 and families pages; `03` §3.4 reorders the paid plan first on mobile. | `00` exec summary: "The product is free. No billing, subscription, payment or pricing capability exists anywhere in the platform." `COSMIC_NARRATIVE` Authority point 6 (Pillar 6): "It is free. We do not ask a strained family for another monthly fee." The Frontend's own `01` §4.3 notes "product docs state no billing exists." | Critical (brand promise) |
| P2 | **Teacher role and School plan that do not exist.** | Sign-up "I am a… Parent / Teen / Teacher"; School plan with "Class dashboards, Bulk profiles". | `05`: "No organizations, schools, classrooms or teams exist. The only tenancy boundary is the family." | High |
| P3 | **Sign-up has no age screen and offers teen self-registration.** | `signup` collects name, email, password, role; no date of birth, no age gate, no guardian verification step. | The live product's email sign-up already requires and validates a date of birth (A.3 current state). A.2–A.4 mandate age capture on **every** entry path; the self-registered 13–17 population is the product's most repeated cross-block risk ("kid role ≠ minor", Blocks A, C, D, E, H). The mockup regresses below the current product. | Critical (child safety) |
| P4 | **Children cannot log in with the mocked login.** | `login` asks for "Email" only. | `02` B2/F1: children have no email; they sign in with a **username and passphrase** chosen by the parent. | High |
| P5 | **"Tutor" means two different things.** | App nav tab "Tutor" = the AI character ("Ask Dr. Rho — your tutor is ready to help"). | In the product and brand, **"Tutor" is the verified parent** ("Become your child's Tutor", the Tutor badge, `/verify-parent`). In es-MX and pt-BR, *tutor* is also the legal word for guardian. | High (core vocabulary) |
| P6 | **The parent, who is the hero of the brand, has no experience in the mockup.** | No guardian dashboard, no child's tutor transcripts, no memory approval, no card freeze, no redemption approval, no weekly narrative. Parent-only "Approve" buttons appear inside the **child's** app shell ("Hi, Sofia!" + Learn/Tutor/Tasks/Wallet/Profile). | Law 1 (the parent is the hero), Law 5 (the parent always sees the whole story), B.10, D.1, D.23, A.6; product screens F1–F3, F5, A7. | Critical (brand architecture) |
| P7 | **Celebration on every correct answer.** | `02` D6 "Gamification is always HIGH"; `02` §9.2: every correct answer fires a 26-piece confetti burst and a "+10 XP" floater; confirming a coin split fires confetti and "+5 XP"; marketing copy "XP and coins for every lesson". | B.20 (reward framing must be informational, not payment for output), B.28, B.25 (zero-manipulation audit), Law 4. **Also contradicts the Frontend's own research:** `01` §4.2 "Celebrations mark a real milestone, not a click"; `04` §2 "`--dur-celebration` … once per moment, never per click". | High |
| P8 | **A lives/hearts mechanic appears in the lesson.** | Lesson header shows "♡ 3"; `02` §4.2 reserves `berry` for "lives". | No lives mechanic exists in the product audit. A loss-framed resource contradicts Law 3, B.26 (non-verbal shame signals) and the Frontend's own "forgiving by default" stance (`01` §4.3). | High |
| P9 | **Age registers: one visual language vs. three registers.** | `02` D8 "No age bands, no per-audience skins"; `01` §0.3 "Uniformity is the point." | B.23 mandates at least three distinct tone/UI/reward registers (young child, tween-teen transition, teen) with different reward framing, mascot presence and social mechanics, plus a "graduation" moment at 10–12. | High (needs owner arbitration; reconcilable, see section 8) |
| P10 | **The staff screen models a process the product does not have.** | `staff` route: "Family review" of children's chores, with "Review" and "Remove" per family. | Staff do not approve chores (parent-only, `04` API). Block G is about content publishing, permissions (G.1) and the publish bypass (G.2). Staff browsing named families' chores is also a data-minimization question. | Medium |

Smaller copy-level items (placeholder copy is acknowledged in the README, so these are lower priority, but they are structural choices, not translations): the landing hero addresses the child, not the parent (Law 1) and never uses the brand CTA "Become your child's Tutor"; "Log in to keep your streak going" is mild streak pressure; "Purchases wait for your approval" frames redemptions as shopping (Law 2); the result screen celebrates XP and accuracy but has no judgment-quality signal (B.12). The result screen's sample data is also internally inconsistent ("Today 90% / Best 80%": a best score lower than today's, and "9 of 10 correctly" after a 4-exercise lesson) — harmless in itself, but it shows the verification suite checks layout, not meaning. *Correction (v2 review): this review originally also reported a "randomly generated 71–78% accuracy"; that was an artifact of capturing the screen mid count-up animation. The final value is a fixed 90%.*

---

## 3. Coverage gap

The product has **47 top-level screens** (`01` screen inventory, excluding the AI Mentor's 7 internal layers). The mockup's 14 routes map, fully or partially, to **about 10 of them (~21%)**: M1, M2, M3, A1, A2, L1, L5 (lesson + result), F1/F4 (partial), P1 (partial), X1. Two mockup routes have no product equivalent (Pricing, which contradicts the product; the staff "Family review" table). The System sheet is a design artifact.

Not designed at all, yet carrying Critical or High requirements:

| Missing surface | Requirements that need it |
|---|---|
| **AI Mentor stage** (T1 and its 7 layers) | All of Block C (23 items, 6 Critical); B.8 mentor presence |
| **Interactive visual system "Pizarrón"** (charts, diagrams, manipulables) | B.7, Critical flagship: 25 Core chart types + 16 interaction primitives. The Bible has **no data-visualization specification** of any kind. |
| Parent/guardian experience (F1–F3, F5, A7 Verify parent) | Laws 1 and 5; A.5, B.10, B.13, D.1, D.23, C.4 |
| Onboarding, age screen, Google callback, upgrade account (O1, A5, A6) | A.2, A.3, A.4 (Critical) |
| Settings (P3), role-branched | A.6 |
| Course path, territory map, placement quiz (L2–L4) | B.1 (Critical, release-blocking), B.6, B.15 |
| Badge share page and flow (M7) | Block F (F.1 Critical) |
| Profile, followers, public profile (P2, P4–P8), report and block | Block E (E.1, E.2 Critical) |
| Admin console (S1–S10) | Block G (G.1 Critical), Block H |
| FAQ, cookie banner (M4, M8) | A.1, H.1 |

---

## 4. Internal inconsistencies inside the Frontend Bible

The Bible's own changelog shows several corrections were made in prose but not propagated to the YAML token block — and the YAML is the part the README says to "hand an AI agent." An agent reading it will reintroduce what the owner already rejected.

| # | Inconsistency | Where |
|---|---|---|
| F1 | YAML still defines `depth: { ridge: 6px … }` "the hard bottom edge that makes every pressable a physical object," and every component carries a `ridge:`; `button-secondary` has a 2 px border. The prose (§9.1, §4.4) removed ridges and says the secondary border is 1.5 px. | `02` lines 157, 166–179 vs §9.1 |
| F2 | Motion tokens disagree: YAML has press-down 60 ms, press-release 180 ms, reward-burst 900–1350 ms, spring on "press release"; `04` defines 80/150/250/380/700 ms and reserves spring for reward moments "never routine UI". `04` calls it a "three-tier system" and lists five tiers. | `02` lines 158–164 vs `04` §2 |
| F3 | Spring on every press (`02` D7, §9.1) vs. spring "reserved for reward/celebration moments, never routine UI" (`04` §2). | `02` line 18 vs `04` line 29 |
| F4 | Celebration per correct answer (`02` §9.2) vs. "never per click" (`04`) and `01` §4.2. | see P7 |
| F5 | Type sizes: "fluid display sizes use container units (`clamp`)" (`02` §6, YAML comments) vs. "fixed pixel values … not fluid `clamp()`" (`03` §3.2). | `02` line 296 vs `03` line 36 |
| F6 | Spacing: YAML scale stops at 56 px; `03` defines `--s-1` … `--s-32` up to 128 px. | `02` YAML vs `03` line 33 |
| F7 | Borders: `02` §10 says the flat system uses "thin inset borders"; §4.4 and §9.1 say no border of any kind; §9.1 then gives coins, medals and hexagons "a thin ridge-coloured outline" while §4.4 says that iconography never gets a border. | `02` §4.4, §9.1, §10 |
| F8 | Two rules numbered 14; open item 9 cites "rule 2 in section 2" for "one accent per view," but rule 2 is about glass and borders. | `02` lines 42–43, 492 |
| F9 | Verification section still reports the old 336-configuration, 7-state run and calls the tool "not yet a general tool"; the README reports 1,440 configurations and calls the tool "general-purpose." | `02` lines 324–326 vs README |
| F10 | Stale file names: `littlefounders-site-and-app.html`, `littlefounders-prototype.html`, `tools/…`, and a mockup comment citing `03-MOTION.md` (it is `04`). | `02` line 4, line 326; tool headers; mockup CSS comment |
| F11 | `01` says "Status: Research phase. Nothing here is a token or a rule yet"; the README says everything is final. | `01` line 6 |
| F12 | Lives are removed from feedback animation ("no life-loss animation") but the mechanic itself is kept and reserved a hue. | `02` §9.2, §4.2 |

---

## 5. Verification tooling

- **The delivered text-fit tool is stale and passes vacuously.** It drives the page with `#screen=home` and sets `S.screen`, but the mockup routes on `route`. Run as delivered, it reports "NO ISSUES FOUND" — while auditing only the default landing page 336 times. It is the 7-state version described in `02` §7, not the tool behind the 1,440-configuration claim in the README. Patched to use `route` and all 14 routes, it confirms the claim (section 1), so the mockup is sound; the tool is not.
- Both tools are coupled to the mockup's global `S` and `render()`. They cannot audit a real application without rewriting the driver.
- Both depend on `@sparticuz/chromium` (a serverless Lambda build). For CI they need standard Puppeteer or Playwright.
- The text-fit tool does not recognise the visually-hidden pattern and reports false positives on accessible hidden headers.
- Not verified by the Frontend session, and stated as such: Safari and Firefox, real devices, screen readers, focus management inside dialogs (open item 10), and any test with children.

---

## 6. Product-side readiness (the same standard applied to our own package)

- **Ready as a requirements backlog:** 112 items, each with severity, finding, mandate, brand alignment; every block has metrics, a Definition of Done, a pipeline and internal phasing (Blocks A, G, H since Appendices M, N, O).
- **Not everything is ready to build.** The main document contains **12 explicit decision points** (this review first said 15, counting table headers by mistake; the register is in `13-OWNER-DECISION-LOG.md` §8) (build-vs-remove, architecture choices, scoping) and the set references legal **counsel review 12 times** (COPPA/AADC items in Blocks E and F). Those items are specified, not buildable, until decided.
- **No global roadmap across blocks** — excluded on purpose as an engineering-leadership resourcing decision (main document, closing scope note). Import needs one.
- **The Product package never references the design system.** Requirements with heavy UI implications (B.7, B.8, B.23, B.26, C-block interaction patterns, the parent surfaces) have no link to Bible tokens or components.
- **B.23 is in open conflict with Frontend D8** (P9). Our own requirement must be reconciled, not just theirs.
- **Undefined relationship between remediation and redesign.** The Product package mandates fixes to the *existing* product (its territory map, AI Mentor island, public profiles, admin console). The mockup is a *redesign* that drops most of those screens. Nobody has stated which existing screens survive the redesign, which are rebuilt, and which are retired. Every requirement's implementation path depends on that answer.

---

## 7. Readiness matrix

| Component | Status | Condition |
|---|---|---|
| Product: backend and safety-critical fixes (B.1, A.2/A.3 safeguard flag, D.1 server-side freeze, G.1 endpoint permissions, G.2 bypass, E.1 discoverability gate) | **Ready now** | None of these depend on visual design. |
| Product: remaining requirements | Ready after decisions | 12 decision points, counsel review for E/F items, a cross-block roadmap. |
| Frontend: colour system, contrast/CVD method, `on-*` pairing, dual mode | **Ready after F1–F8 fixes** | The YAML must be regenerated from the prose and the mockup's actual CSS. |
| Frontend: Text Fit Contract, touch targets, reduced motion, 3D slot spec | **Ready now** | Verified; consistent with Product requirements. |
| Frontend: gamification and motion rules (D6, D7, §9.2) | Not ready | Resolve P7, P8, F2–F4 against B.20/B.25/B.28 and the Frontend's own `01`/`04`. |
| Frontend: mockup as information-architecture reference | **Not ready** | P1–P6 and P10 contradict the product; ~21% screen coverage. |
| Frontend: mockup as visual-language reference (look, spacing, composition, motion craft) | Ready | With the gamification caveat above. |
| Verification tools | Not ready | Replace the stale text-fit tool; decouple from `S`; standard Chromium for CI. |

---

## 8. Shortest path to "import-ready"

**Owner decisions (blocking, business-level, not something design or product can settle alone):**
1. Pricing: the product is free (Pillar 6) → delete the Pricing route and every "Start free / Upgrade / See pricing" reference; or, if monetization is now planned, the brand narrative and Pillar 6 must change first, explicitly.
2. Scope of roles: parent, child (created by parent), self-registered teen, staff. Teacher/School in or out?
3. Vocabulary: "Tutor" = verified parent (brand) → rename the AI surface (for example by the mentor's name, "Dr. Rho", or "Guide").
4. Age registers: a workable reconciliation is *one design system, several registers* — tokens, components and shapes stay identical for everyone (D8 holds at the style level), while copy tone, mascot presence, reward framing and social mechanics vary by age band (B.23 holds at the content/behaviour level). This needs to be written into both documents.
5. Gamification intensity: keep "high" for control feel (press feedback, state transitions, the scene's own elements moving) and reserve celebration (confetti, XP floaters, spring overshoot) for real milestones, as the Frontend's own `01` §4.2 and `04` §2 already say.
6. Lives: remove, or justify against Law 3 and B.26.
7. Redesign vs. remediation: which existing screens survive, which are rebuilt in the new language, which retire.

**Reconciliation edits (mechanical once the decisions exist):**
- Regenerate the `02` YAML from the prose and the mockup's shipped CSS (F1–F2, F5–F6); fix F3–F12.
- Rebuild the mockup's sign-up, login, pricing, family and staff routes to match the product (P1–P6, P10).
- Add a **Frontend linkage appendix** to the Product package mapping each UI-bearing requirement to Bible rules and components.
- Design, before their blocks enter development: the AI Mentor stage, the Pizarrón component library (a data-visualization chapter for the Bible, using Appendix A's catalogue), the parent experience, onboarding/age gate, settings, badge share, profile/social, admin console.
- Replace the verification tools (current routes, decoupled driver, standard Chromium, visually-hidden aware).
- Native-speaker copy review for es-MX and pt-BR, written to the Communication Laws.

**What can start immediately, in parallel:** the backend and safety fixes in the first row of section 7, and the implementation of the Frontend's token/theme layer, Text Fit Contract, touch-target tiers and reduced-motion handling in the real codebase. None of these depend on the open decisions.
