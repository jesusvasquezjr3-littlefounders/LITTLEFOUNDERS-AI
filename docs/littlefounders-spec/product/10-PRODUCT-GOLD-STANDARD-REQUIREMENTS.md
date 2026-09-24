# 10 — Product Gold Standard Requirements

**Status:** Authoritative, non-negotiable. This document records the product decisions made during the September 2026 product review of the LittleFounders platform audit (files `00`–`09`) against the brand's Cosmic Narrative (`COSMIC_NARRATIVE.md`). Every finding below identifies a gap between current implemented behavior and either (a) the platform's own stated promises (FAQ, marketing copy, legal text) or (b) the brand's Communication Laws. Every finding carries a mandated requirement. Once approved, these requirements supersede the current behavior described in the audit set and must be treated as the specification for engineering work, not a suggestion.

**Basis documents:** `00-EXECUTIVE-SUMMARY.md` through `09-CONFIGURATION.md` (product audit), `COSMIC_NARRATIVE.md` (brand narrative), `10-APPENDIX-A-INTERACTIVE-VISUAL-CATALOG.md` (chart/interaction catalog underlying B.7), `10-APPENDIX-B-PEDAGOGICAL-PSYCHOLOGICAL-FRAMEWORK.md` (cognitive science, developmental psychology, and neurodivergent/ethical-gamification research underlying B.17–B.28 and the Block B design standard), `10-APPENDIX-C-SUCCESS-METRICS-QA-PIPELINE.md` (success metrics, Definition of Done, and the end-to-end lesson production pipeline that operationalizes all of Block B), `10-APPENDIX-D-REALTIME-TUTORING-FRAMEWORK.md` (real-time affect-detection, knowledge-modeling/stopping-rule, and conversational-pedagogy/working-alliance research underlying C.9–C.20 and the Block C Real-Time Interaction Standard), `10-APPENDIX-E-SELF-IMPROVEMENT-GOVERNANCE.md` (self-improvement/"Harness AI" governance research underlying C.21–C.24), `10-APPENDIX-F-AI-MENTOR-METRICS-QA-PIPELINE.md` (success metrics, Definition of Done, real-time QA/deployment pipeline, and internal phasing that operationalizes all of Block C), `10-APPENDIX-G-FAMILY-HUB-BANKING-RESEARCH-FRAMEWORK.md` (financial socialization/developmental psychology, behavioral economics of saving, financial-education program-evaluation evidence, and family-systems/ethical-design research underlying Block D), `10-APPENDIX-H-FAMILY-HUB-BANKING-METRICS-QA-PIPELINE.md` (success metrics, Definition of Done, production/QA pipeline, and internal phasing that operationalizes Block D), `10-APPENDIX-I-PROFILE-SOCIAL-SAFETY-RESEARCH-FRAMEWORK.md` (child stranger-contact-risk research, walled-garden/graduated-autonomy design-pattern research, COPPA/AADC regulatory research, and social-comparison/gamification-psychology research underlying Block E), `10-APPENDIX-J-PROFILE-SOCIAL-METRICS-QA-PIPELINE.md` (success metrics, Definition of Done, production/QA pipeline, and internal phasing that operationalizes Block E), `10-APPENDIX-K-ACHIEVEMENT-SHARING-RESEARCH-BRIEF.md` (COPPA/FTC disclosure-doctrine research, real-world shareable-achievement product precedent, and growth-loop/commodification-of-childhood research underlying Block F), `10-APPENDIX-L-ACHIEVEMENT-SHARING-METRICS-QA-PIPELINE.md` (success metrics, Definition of Done, production/QA pipeline, and internal phasing that operationalizes Block F), `10-APPENDIX-M-ACQUISITION-IDENTITY-METRICS-QA-PIPELINE.md` (success metrics, Definition of Done, and production/QA pipeline that operationalizes Block A), `10-APPENDIX-N-STAFF-CONSOLE-METRICS-QA-PIPELINE.md` (success metrics, Definition of Done, and production/QA pipeline that operationalizes Block G), `10-APPENDIX-O-ANALYTICS-OPERATIONS-METRICS-QA-PIPELINE.md` (success metrics, Definition of Done, and production/QA pipeline that operationalizes Block H), `10-APPENDIX-P-TEACHING-VISUALS-MATH-LOGIC-MONEY.md` (research and catalogue of mathematical, logical and money teaching visuals extending B.7), `11-INDEPENDENT-AUDIT-FINDINGS.md` (adversarial self-audit of this document set), `12-PRODUCT-FRONTEND-IMPORT-READINESS-REVIEW.md` (reconciliation review against the Frontend package), `13-OWNER-DECISION-LOG.md` (binding owner decisions; takes precedence), and the Frontend package `frontend/` (design system, including `05-TEACHING-VISUALS.md`).

**How to read this document:** each entry has a **Current State** (what the audit found), a **Finding** (the gap and why it matters), a **Mandated Requirement** (what must change — non-negotiable), and where relevant a **Brand Alignment** note tying the requirement back to a specific Communication Law from the Cosmic Narrative. Severity is marked Critical / High / Medium to guide sequencing, not to make any item optional.

**What "non-negotiable" means for an open decision:** "non-negotiable" means the finding itself is real and must be addressed — it does not mean every implementation detail is pre-decided. Where a Mandated Requirement leaves a genuine decision open (a value, a design variant, a scope choice), that decision must be given a named decision-owner and a deadline or trigger, exactly as already modeled by A.1, B.2, D.5, E.6, and G.1 below — never left open indefinitely with no one accountable for closing it.

**A note on "Pillar N" citations:** the Cosmic Narrative's five Communication Laws (Law 1–5) are numbered in the source document itself. The six "Authority" points under Narrative Element 3 ("The Guide") are not numbered in the source; this document assigns them working numbers Pillar 1–6, in source order, solely for internal cross-referencing: Pillar 1 = "We teach judgment, not transactions" (and "living with the consequences"); Pillar 2 = "A guide for the child, too"; Pillar 3 = "Mentors, not mascots"; Pillar 4 = "Real work, real rewards, real choices"; Pillar 5 = "The parent stays in the room... we equip them"; Pillar 6 = "It is free."

---

## Status and use during the migration (owner decisions of 20 and 21 September 2026)

The owner's decisions are recorded in `13-OWNER-DECISION-LOG.md`, which takes precedence over this document where they differ. How they change the way this document is read:

- **Rebuild, not patch (OD-2).** The frontend is rebuilt from scratch and the backend is migrated to it. Every **Current State** below describes the legacy platform. For the new build, each requirement is an **acceptance criterion**: the new build must not reproduce the defect, and its Definition of Done (Appendices C, F, H, J, L, M, N, O) applies to the new implementation.
- **Hotfixes on the live platform (OD-8).** Critical child-safety and trust defects are fixed on the current platform now, in parallel with the rebuild: A.2, A.3, B.1, C.2, C.3, D.1, E.1, E.2, F.1/F.2, G.1 (list and minimum fixes in the decision log, section 3).
- **Existing user data is migrated (OD-9)**, under the migration requirements in the decision log, section 4 (no promised progress lost; consent re-obtained for any new data practice; legacy defects corrected in transit).
- **Access model (OD-3).** Individual users may self-register. Family, Wallet/Digital Banking and Tasks require a verified parent and a guardian link. Families only: no teacher, school or classroom roles. Because self-registered minors remain a supported population, every minor safeguard in this document follows **age**, never role. **D.3 stands (OD-3, Option B, 20 September 2026):** a self-registered teen without a parent gets a personal wallet (self-logged income, Save/Spend/Share, savings goals; still simulated coins) with no approval step; Tasks and anything a parent approves remain guardian-only. If the teen later invites a parent, the family mechanics layer on top of the same wallet, as D.3 requires.
- **Terminology (OD-6).** "Tutor" means only the verified parent. The AI is the **Mentor**, embodied by one of four 3D characters the learner chooses (Dr. Rho, Zara, Liruf, Dina). These are the same four characters that narrate stories and lessons (B.8, B.11): in **authored story content** a character may model a misjudgment and recover from it (B.11); in **live Mentor conversation** the same character never presents incorrect information as correct (Block C). The Product package was renamed accordingly ("AI Tutor" → "AI Mentor"; "the tutor" → "the Mentor"). Two exceptions keep the old word, and only these: legacy system identifiers, written in code format (e.g. the `Tutor Session` data entity, renamed during the backend migration); and research passages where "tutor" and "tutoring" describe human tutors or intelligent tutoring systems in the cited studies (mainly Appendices D, E and F).
- **Standing constraints (OD-5, OD-10).** Pricing is out of scope; the platform is free at launch. Any future paywall may never cover safety features or parental controls, never charge a child, never sell streaks, rest days or error forgiveness, and must pass the B.25 audit. Where a requirement touches regulation (COPPA, the UK and US age-appropriate design codes, Brazil's ECA Digital), the new build implements the conservative option this document already defines, and Legal validates it **before launch**.
- **Design system (OD-4).** One design system for every surface and every user, defined in the Frontend package (`frontend/`). Age bands change content (tone, character presence, reward framing, social mechanics), never tokens or components (see B.23).
- **Copy, assets and the Mentor (OD-13, OD-14, OD-15; 21 September 2026).** Every string meets a numeric copy budget (Frontend `06-COPY-BUDGET.md`); lesson prompts, answer options and Mentor turns meet the same limits as a Forge content gate next to B.17 and B.18. Iconography and visual assets are LittleFounders' own, generated in the house style, with the Mentor characters always rendered from the real 3D models and the pose catalogue (Frontend `07`). The AI Mentor is the chosen 3D character on its Diorama, never a chat window: the legacy Mentor UI and the legacy buttons are deleted and rebuilt, not restyled (Frontend `08`).

---

## Block A — Acquisition & Identity

Covers: public marketing and FAQ, guest sessions, signup (email and Google), onboarding, guardian (parent/"Tutor") verification, and child account creation.

### A.1 — Public FAQ promises capabilities the product does not have

**Severity:** Medium

**Current State:** The public FAQ (`/faq`) states that a second verified guardian can be linked to an existing child, that child accounts are suspended if the parent's account is cancelled, and that an in-product report tool exists. None of the three exist in the platform. (Ref: `00` §6.5, `02` F1 edge cases, `05` §2.4.)

**Finding:** These are trust and safety promises, not incidental copy. A parent who relies on any of them and later discovers they don't exist experiences exactly the kind of breach of confidence the brand's Law 5 ("transparency is love") is designed to prevent. The data model already supports multiple guardian links per child at the schema level, so this gap is a missing product flow, not a structural limitation.

**Mandated Requirement:** The FAQ must never describe a capability that does not exist in the shipped product. For each of the three items, engineering and product must jointly decide, before the next release: (1) build the flow, or (2) remove the claim from the FAQ. No FAQ content ships without a named, working feature behind it. Priority order: "second verified guardian" first (schema already supports it), then account-cancellation cascade behavior, then in-product reporting.

**Brand Alignment:** Law 5 — the parent must never be surprised by an absence where a promise was made.

---

### A.2 — Guest accounts (the under-13 refusal path) receive zero minor safeguards

**Severity:** Critical

**Current State:** The guest path is the platform's own designated destination for a visitor refused at signup for being under 13 ("Keep going without an account"). The system decides "is this person a minor?" solely by whether the account holds the **kid** role. A guest holds only the **universal** role. As a result, a guest account — created specifically because the platform detected a child — receives none of the protections gated on the kid role: analytics events are not consent-gated, AI Mentor moderation does not run in fail-closed mode, and the minors' voice policy does not apply to it at all. (Ref: `00` §6.4, `05` §1.2, `05` §6.)

**Finding:** This is the single most severe gap in the acquisition flow. The platform's own age screen identifies a person as a probable child and then routes them into the one account type that carries none of the protections the rest of the product designed specifically for children. This directly contradicts Pillar 5 ("The parent stays in the room... we do not replace the parent, we equip them") and the public promise on the Families page ("Here, you decide").

**Mandated Requirement:** Any guest session created via the age-refusal path ("An adult has to create this one" → "Keep going without an account") must carry an internal flag — never the date of birth itself, only a boolean origin marker — that triggers the same safeguards currently gated on the kid role: AI Mentor moderation must run fail-closed for this session, the microphone must remain unavailable regardless of the minors' voice policy state, and analytics events must not be recorded without an equivalent consent mechanism (to be designed, since no guardian link exists yet for a guest). This flag must persist through guest-to-account upgrade (B8) until a guardian link is established or the account is confirmed as adult by another means.

**Brand Alignment:** Pillar 5 and Law 5 — verified parental control is meaningless if the exact population it exists to protect is routed around it.

---

### A.3 — Google Sign-In has no age screen at all

**Severity:** Critical

**Current State:** Email signup requires and validates a date of birth, refusing anyone under 13. Google Sign-In applies no age screen whatsoever. A new Google account is created as a full universal account regardless of the person's actual age, with zeroed stats and no path through either the age-refusal flow or guest status. (Ref: `02` B3, `05` §6.)

**Finding:** This is a quieter and more complete bypass than A.2: a child using Google Sign-In never gets flagged as a guest, never gets the origin marker proposed in A.2, and never gets a chance to be routed to any protective path. It is the least protected entry point in the entire platform for a minor.

**Mandated Requirement:** Every account created for the first time via Google Sign-In must pass through a mandatory post-callback age screen before reaching Learn. An age under 13 must reclassify the session immediately with the same origin marker and safeguards mandated in A.2, rather than leaving the account as a standard universal account. This must not be optional or deferred to a later Settings prompt.

**Brand Alignment:** Pillar 5 — a verified-control platform cannot have an unverified, unscreened front door.

---

### A.4 — Onboarding (and date-of-birth capture) only happens for guests

**Severity:** High

**Current State:** Onboarding — and with it, the only mandatory capture of date of birth outside email signup — runs exclusively for guest sessions. Any account created via email signup or Google never passes through onboarding, regardless of age. (Ref: `02` C1, `09` §3.)

**Finding:** Combined with A.3, this means a meaningful population of accounts (self-registered teens, and now confirmed: possible undetected minors via Google) can exist indefinitely with no date of birth on file. This is not only a personalization loss (default middle age-tier for the AI Mentor, no eligibility for placement free-text intake) — it is another point where the platform loses the one signal it needs to decide how to protect the person.

**Mandated Requirement:** Every account-creation path — email signup, Google Sign-In, guest — must include a point where date of birth (or, at minimum, an age-band self-declaration sufficient to drive the A.2/A.3 safeguards) is captured before the account reaches unrestricted use of Learn or the AI Mentor. The existing signup age screen's validation and discard logic should be reused as the pattern, not reinvented per entry path.

**Brand Alignment:** Pillar 5 — protection cannot depend on which door the user happened to walk through.

---

### A.5 — Parent ("Tutor") verification has two silent trust levels behind one badge

**Severity:** High

**Current State:** Two distinct paths grant the parent role: (1) passing the four-check ID verification (document readable, name match, date-of-birth match, not expired), or (2) a direct Superadmin grant through Roles & Access with no ID check at all. Both produce the identical outward "Tutor" badge. Separately, the document-type field (national ID / passport / driver's license) is recorded but never validated against the image content — any legible ID-like document passes regardless of the declared type. A verification can technically be marked "revoked" but no flow ever does this. (Ref: `02` B11, `03` §1.5–1.6, `05` §2.3, `00` §6.6.)

**Finding:** The entire trust architecture of the product — guardian visibility into Mentor transcripts, memory approval, card freeze, redemption approval — rests on the word "verified." If that word can mean either "passed a real ID check" or "a staff member decided to grant this," the guarantee the product markets against competitors like Greenlight is not actually being kept, and there is no way to later revoke a verification found to be fraudulent or mistaken.

**Mandated Requirement:** The product must expose (internally, in the audit log and staff console, not necessarily to end users) a distinct status for `parent (ID-verified)` versus `parent (staff-granted)`. A staff grant of the parent role must require a mandatory, audited justification field — not just the actor and timestamp already logged. The document-type field must either be validated against the image or be removed from the form until it can be. The "revoked" verification status must have a real trigger path (e.g., a staff action following a fraud report) rather than existing only as an unused schema value.

**Brand Alignment:** Pillar 5 and the Families page's core sales pitch — verification must mean one thing, always.

---

### A.6 — Children can escape parental visibility through the shared Settings screen

**Severity:** High

**Current State:** Children use the identical Settings screen as adults. This lets a signed-in child request an email change, edit their profile username, and change their own password, all without any guardian notification or approval step. The account's sign-in username remains fixed and separate from the editable profile username, and nothing in the product explains this divergence. (Ref: `00` §6.9, `02` I1, `05` §7.)

**Finding:** Child accounts are deliberately created with no email at all — a synthetic, non-deliverable sign-in address, explicitly for data minimization. Allowing the child to attach a real email address later, unsupervised, quietly defeats that minimization and hands the child an account-recovery path fully independent of the parent — the opposite of the guardianship model the product sells. This directly contradicts Law 5.

**Mandated Requirement:** Settings must branch by role, not remain a single shared screen. For any account holding the kid role: the email-change capability must be removed entirely, or gated behind guardian approval using the same pattern already built for Mentor memory-note approval. Username-change behavior must be documented and, ideally, surfaced to the parent (a profile-username change notice) so the profile/sign-in username divergence is never a silent surprise to the family.

**Scope under the access model (OD-3):** this requirement protects parent-created child accounts, which hold the kid role and have no email of their own. A self-registered teen registered with their own email, so the email rule does not apply to them; their protections come from the age-based safeguards listed in "Status and use during the migration".

**Brand Alignment:** Law 5 and the "child data minimization" commitment in the Terms and Privacy Notice.

---

### Block A — Summary of Mandated Changes

| ID | Finding | Severity | Owner decision needed |
|---|---|---|---|
| A.1 | FAQ promises unbuilt features | Medium | Build vs. remove claim, per item |
| A.2 | Guest (age-refusal path) has no minor safeguards | Critical | Add origin flag + safeguard wiring |
| A.3 | Google Sign-In has no age screen | Critical | Add mandatory post-callback age screen |
| A.4 | Onboarding/date-of-birth capture skips non-guest paths | High | Add age capture to every entry path |
| A.5 | Two silent trust levels behind one "Tutor" badge | High | Split status, require staff-grant justification |
| A.6 | Child email-change bypasses guardian visibility | High | Branch Settings by role; gate or remove |

**References:** `10-APPENDIX-M-ACQUISITION-IDENTITY-METRICS-QA-PIPELINE.md` — success metrics, the Definition of Done per requirement, the production/QA pipeline, and the internal phasing/sequencing of all 6 Block A requirements.

---

## Block B — Learning (Courses, Placement, Lesson Engine, Territory, Badges)

Covers: course catalog and progress map, the adaptive placement quiz, the lesson engine and grading, the territory (mastery) map, and course badges — plus two forward-looking capability requirements that emerged from this review: adaptive branching progression and an interactive visual reasoning system.

### B.1 — Placement commit is broken for any course with authored placement questions

**Severity:** Critical — release-blocking

**Current State:** The data store accepts exactly three placement-method values: `quiz`, `claimed beginner shortcut`, `no probe content fallback`. The placement business logic produces four: `adaptive quiz`, `learner chose start`, `learner adjusted`, `no probe content fallback`. Only the fourth matches. (Ref: `00` §6.1, `02` D3, `03` §3.6.)

**Finding:** A learner who completes the full adaptive quiz, or who chooses "start from scratch," or who uses the "this feels too advanced" adjuster, reaches the result screen and then receives a generic "Could not record placement" error on commit — every real placement outcome fails to persist. The only path that works today is the fallback used when a topic has no placement questions authored at all, meaning placement functionally only "succeeds" when there is nothing to place. Because placement credits are written only after a successful placement record, this also silently blocks lesson-skip credits, course-progress calculation for skipped lessons, and — since a course badge requires every lesson passed or credited — course badge attainment and the public badge-sharing growth loop for any learner who should have received placement credit. This is a single schema/logic mismatch with a blast radius across learning, progress, badges, and acquisition (Block F).

**Mandated Requirement:** Treat this as a release-blocking defect, not a backlog item. Engineering must decide between widening the accepted database values to the four real business states, or normalizing the four business states down to the existing three at the write boundary (noting `learner adjusted` has no clean equivalent among the three, which argues for widening the schema). A mandatory end-to-end acceptance test must exist and pass before any course with authored placement questions ships: complete quiz → successful commit → placement credit written → course progress updated → badge attainable.

**Brand Alignment:** This is the entry point to the entire learning pillar; a broken entry point undermines every downstream promise about adaptive, judgment-building learning.

---

### B.2 — Course prerequisites are stored but never enforced

**Severity:** Medium

**Current State:** A course can declare prerequisite courses in its data model, but no product flow checks or enforces them. A learner can open an advanced course (e.g., Investing) without ever touching a foundational one (e.g., Financial Education). (Ref: `03` §2.1, `09` §6.)

**Finding:** This tensions the brand's own claim that judgment is built progressively, through practice — the course shelf currently imposes no real sequencing between courses, only within one.

**Mandated Requirement:** Product and engineering must make an explicit decision, not leave this dormant: either build enforcement (block or soft-warn on entering a course whose prerequisites are unmet) or remove the prerequisite field from the data model and documentation until it is a real, intentional capability.

---

### B.3 — A course that fails to assemble disappears from the shelf without any signal

**Severity:** Medium

**Current State:** If a single course cannot be assembled server-side, it is silently dropped from the learner's course shelf. Only a total failure (every course failing) surfaces an error. (Ref: `02` D1.)

**Finding:** A learner's active course could vanish from their shelf with zero explanation to the learner or the guardian, indistinguishable from an intentional product decision. This is a transparency gap, not just a resilience gap.

**Mandated Requirement:** Every silently dropped course must generate a visible operational signal in the staff console. If the dropped course was the learner's active/featured course, the frontend must show an explicit "we couldn't load this right now" state rather than omitting it invisibly from the shelf.

---

### B.4 — Unsupported exercise segments on an outdated client can produce an unearned passing score

**Severity:** Medium-High

**Current State:** A lesson with no graded weight scores 100 by definition. Segment types unsupported by the client version are skipped without affecting the score. (Ref: `02` D4, `03` §2.6.)

**Finding:** Combined, these two rules create a real edge case: a learner on an outdated client encountering a lesson composed mostly or entirely of newer, unrecognized exercise types could pass with a perfect score having answered nothing. This directly undermines Law 4 ("reward the decision, not the amount") — there was no decision at all.

**Mandated Requirement:** When the proportion of unsupported segment weight in a lesson exceeds a defined threshold (proposed: 30% of total XP weight), the lesson must not be completable — the client must be forced to update before the learner can proceed, rather than silently degrading to an unearned pass.

---

### B.5 — Replaying a passed lesson can read as a regression

**Severity:** Low-Medium

**Current State:** Replaying a passed lesson shows that run's score on the results screen, while the course-level record keeps the best historical score. (Ref: `02` D4.)

**Finding:** A learner scoring lower on a replay than their kept best can reasonably interpret this as lost progress, in tension with Law 3 ("no one is shamed by a mistake").

**Mandated Requirement:** The replay results screen must explicitly state that the kept best score is unaffected (e.g., "Your saved best score is still {X} — this replay was just practice") whenever the replay score differs from the course-level best.

---

### B.6 — Adaptive branching progression must unify with the AI Mentor's existing knowledge graph, not duplicate it

**Severity:** Critical (architectural) — sequenced after B.1

**Current State:** The course engine is strictly linear: lesson state (locked / available / current / passed) is computed purely from adventure → saga → topic → lesson position. Separately, the AI Mentor already runs a substantially more capable pedagogical model that the course engine never uses: a 28-component knowledge graph with 36 prerequisite edges and 32 mapped misconceptions, a per-learner mastery estimate, a spaced-repetition review-card mechanism, and a strategy controller that adapts moment to moment. Only 24 of the 28 knowledge components are currently linked to a course lesson. (Ref: `03` §5, `02` E3, `07` §5.3.)

**Finding:** The product currently has two disconnected pedagogical brains: one adaptive and continuous (the AI Mentor), one static and linear (the course engine) — when the core value proposition depends on a single coherent, decision-driven learning journey. A course-specific branching mechanism built independently of the Mentor's graph would double the maintenance burden and risk two different, possibly contradictory, views of what a given learner has mastered (e.g., "mastered" on the Mentor's learning map but "locked" on the course path).

**Mandated Requirement:** The course engine's progression must be re-architected on top of the same knowledge-component graph, mastery model, and review-card mechanism already built for the AI Mentor — not a second, parallel system. This requires: (1) completing knowledge-component mapping for every published topic, not just 24 of 28; (2) evolving "current lesson" from a single linear position into a frontier of available next-lessons determined by demonstrated mastery against the shared model; (3) building this on top of a corrected placement/credit pipeline (B.1), since placement becomes the entry point into the graph rather than a one-time gate in front of a fixed list; (4) redefining course-badge and progress-percentage logic against graph completion once this ships. This work must not begin until B.1 is resolved, since the credit-writing pipeline it depends on is currently broken.

**Owner amendment (OD-16, 21 September 2026):** The target is one thematic course with age-appropriate chapters for children, adolescents and adults, rather than a separate course per audience. The shared graph and placement determine an eligible learning frontier without requiring an adult to traverse childhood chapters or a minor to complete adult chapters. Age-specific content is genuinely authored for its audience, not a cosmetic rewrite. Eligible progress, badge rules, transitions between stages and legacy-credit equivalence must be specified and verified before the new catalog is released; OD-9 forbids losing existing learning evidence.

**Brand Alignment:** This is what makes "we do not give lessons, we give decisions" true at the architectural level for the course experience, not only inside Mentor conversations — and what makes The Guide's promise of an adapting mentor consistent across the whole product, not just one surface of it.

---

### B.7 — Lessons need a first-class interactive visual & operational reasoning system ("Pizarrón"), unified with the AI Mentor's whiteboard, specified against the full research-grounded catalog, not a hand-picked subset

**Severity:** Critical — flagship capability, not an enhancement

**Current State:** The lesson engine's "Analyze" exercise family (spot the error, cause and effect, compare table, read chart, evidence hunt, red flags, fact vs. opinion) presents visual content as authored, largely fixed segments graded like any other exercise. Separately, the AI Mentor already has a live interactive whiteboard validated against roughly 45 instrument shapes — but it exists only inside ephemeral Mentor conversations, is kept only if the learner explicitly taps "keep" into their notebook, and is entirely outside the deterministic, gradable lesson engine. (Ref: `01` §2.5 T1c, `03` §4.4, `04` §9.)

**Finding:** A generic multiple-choice/fill-in-the-blank exercise engine, however well executed, caps out at recognition and rote practice. The brand's central differentiation claim — decisions inside stories, not videos or swipe-based transactions — is only fully honored when a learner can manipulate a real model of a concept and observe the causal consequence directly, rather than answer a question about it. This capability also directly serves the parent, not only the child: a shared, manipulable model is a natural artifact for the "ten minutes a week" dinner-table ritual the Disruptive Promise calls for, in a way a quiz score never is. Because this is a foundational, effectively irreversible architectural commitment, it was specified only after a dedicated research pass surveying the complete space of chart/diagram types (~65, across 11 categories, cross-referenced against the Financial Times Visual Vocabulary, The Data Visualisation Catalogue, Data-to-Viz, and ASQ's quality-tool literature) and the complementary discipline of interactive operations and animated demonstrations (grounded in PhET Interactive Simulations' design research, Desmos/GeoGebra's manipulation model, Bret Victor's "Explorable Explanations," Universal Design for Learning, and virtual-manipulatives research) — see **Appendix A** (`10-APPENDIX-A-INTERACTIVE-VISUAL-CATALOG.md`) for the full, tagged catalog and the concept-to-technique mapping this requirement is built on.

**Mandated Requirement:** Build a first-class, deterministic, server-gradable interactive visualization and operations component library for the lesson engine, unified with — not duplicated from — the AI Mentor's existing whiteboard/instrument system, so both surfaces share one component set and one visual language. This requirement has two parts, both mandatory:

1. **Chart/diagram component set** — every type tagged **Core** in Appendix A Part 1 must ship in the first release: bar/column (plain, grouped, stacked, diverging), pie/donut, waterfall, radar/spider, bullet graph, line/area, time series, sparkline, calendar heatmap, scatter plot, bubble chart, Sankey diagram, flowchart, decision tree, tree diagram, pictogram, waffle chart, and stat tile. Types tagged **Situational** in Appendix A (including candlestick/OHLC, Marimekko, treemap, sunburst, box plot, Venn/Euler, Ishikawa, Pareto, mind map, org chart, swimlane, bump chart, gauge) must ship gated to the specific course subjects and age tiers Appendix A specifies for each — these are real requirements, not a "someday" backlog, but they are scoped narrowly by design rather than deployed uniformly. Types tagged **Out of scope** in Appendix A are explicitly excluded from this requirement (geospatial maps, pure statistical/analytics-only forms, corporate quality-planning tools with no learner-facing fit) — engineering must not build these on the assumption that "complete" meant "every type in the literature."
2. **Interactive operations & animated demonstrations** — the sixteen reusable interaction primitives catalogued in Appendix A Part 2 (parameter sliders with live recompute, direct-manipulation drag points, drag-to-reallocate, multi-curve overlay comparison, what-if branching simulators, step-by-step animated replay with scrub, before/after toggles, guided sandboxes, live-linked multi-representation panels, threshold markers, constrained trade-off choosers, draggable curve-shifts, real-time running ledgers, reactive "what-if" text, ghost-trace overlay replay, and zoom/scale toggles) must be built as reusable primitives, not one bespoke widget per financial concept. The twelve concept-to-technique mappings in Appendix A Part 3 (compound interest, loan amortization, budget allocation, supply and demand, opportunity cost, inflation, the Rule of 72, debt payoff strategies, diversification, unit economics, marginal tax brackets, and simple-vs-compound comparison) are the required first-release content targets built on these primitives.

3. **Mathematical, logic and money teaching visuals** (amendment, OD-4, 20 September 2026) — the owner directed that teaching must be able to use every kind of visual resource, not only charts. `10-APPENDIX-P-TEACHING-VISUALS-MATH-LOGIC-MONEY.md` adds three families to this library: mathematical representations (M1–M20: number lines, base-ten regrouping, fraction models, bar and schema models, step-by-step and faded worked examples of the operations, balance scales, ratio tables, percent bars, probability representations, growth curves, tax brackets), logic and structured reasoning (L1–L13: permission-rule checks, IF–THEN–ELSE rule builders, truth tables, switch and gate circuits, Euler diagrams, steppable flowcharts, block-based programs, rule sorting, filterable tables, scam classification, if–then plans) and money manipulables ($1–$12). Its Part 8 defines which ship in the first release; its Part 7 is the grading contract all of them follow; the visual specification is `frontend/frontend-bible/05-TEACHING-VISUALS.md`.

Every component in all three parts must support genuine learner interaction with live client-side recomputation, and where the interaction is gradable, server-side verification following the same "server never trusts client scores" principle already enforced elsewhere in the lesson engine (see the original audit's flow `02-D4`; distinct from this document's own item D.4, which addresses a related but distinct data-layer enforcement gap). The content-generation pipeline (Forge) must gain new deterministic gates specific to interactive visualizations and operations, verifying correct behavior across the full interactive input range rather than a single authored state, before any such exercise can reach review status. Design of every primitive must follow the governing principles in Appendix A Part 2 (simplest-possible initial state, no element without conceptual meaning, guided rather than open-ended exploration, unobtrusive on-request help).

**Owner sequencing (OD-17, 21 September 2026):** Begin with the optimized learner-facing lesson UI, chart rendering and interactive Pizarrón, using controlled fixtures and only the minimum contract needed to exercise them. Establish and verify the complete new lesson contract, authoritative grading and recovery around that experience before regenerating lessons with Forge. A prototype or a total count of generated lessons does not satisfy this requirement; the Appendix A/P catalog and Appendix C review and quality gates still apply. Existing DeepSeek/Qwen provider choices are unchanged for the engine-design phase and are assessed separately when generation work begins.

**Brand Alignment:** This elevates the visual/graphic resource to the primary way LittleFounders demonstrates its pedagogical difference from every card-based competitor — it should read as the product's signature, not as one exercise family among fifty-seven.

---

### B.8 — The lesson player is sensorially flat compared to the AI Mentor, and inherits none of the territory map's thematic immersion

**Severity:** High

**Current State:** The AI Mentor stage presents a 3D character with gestures, emotions, demonstration animations, and roleplay scenes on a personalized island. The territory map already renders a distinct themed scene per adventure (archipelago, forest, city, valley, kingdom, cosmos). The lesson player itself, by contrast, is described in the product architecture as an intro screen (minutes, challenge count), a progress bar, segment-by-segment exercises with a prompt/image/hints, narrated audio, and a results screen — no character presence during the exercise itself, no demonstration animation, and no inheritance of the adventure's thematic scene. (Ref: `01` §2.4 L5, §2.5 T1, §2.6 L3.)

**Finding:** This is the same structural fracture identified in B.6 (two disconnected pedagogical brains), now appearing at the presentation layer: the product already built its visual language of immersion — themed scenes, character presence, animation — but confined it to the Mentor and the map, never letting it flow into the lesson player where the learner spends the most time. This is precisely the "generic course, take it and done" experience the product must avoid to deliver on its differentiation claim.

**Mandated Requirement:** The lesson player must inherit the active adventure's thematic scene as its visual backdrop (not a generic neutral frame), and a mentor character must have a visible, animated presence during lesson-play — introducing the lesson, reacting to correct/incorrect answers with the same gesture/emotion vocabulary already built for the AI Mentor, and narrating transitions — reusing that existing character/animation system rather than building a second one. This must be sequenced together with B.7, since both draw on the same underlying component and character-presence infrastructure.

**Brand Alignment:** Makes the mentor characters (Dina, Liruf, Dr. Rho, Zara) feel like a continuous presence across the product's two main learning surfaces, rather than a persona that exists only inside the AI Mentor.

**Amendment (OD-15, 21 September 2026):** "reusing that existing character/animation system" means reusing the **3D character models, the Diorama and the gesture/emotion vocabulary and pose catalogue**. It does not mean the legacy Mentor screens or UI components, which are deleted and rebuilt (Frontend `08-MENTOR-STAGE.md`). The lesson player's character presence and the Mentor stage share one stage component.

---

### B.9 — No persistent narrative continuity across lessons; only gamified stats carry forward, never the story

**Severity:** High

**Current State:** What persists across lessons today is XP, streaks, badges, and best score — game currency, not narrative. The AI Mentor already has session memory, a saved plan, and a notebook of kept work; the core course engine has no equivalent narrative state. (Ref: `03` §3.1, §4.10, §4.13, §4.14, `02` D4.)

**Finding:** The brand promise is that children learn by "making decisions inside stories" and "living with the consequences." Today, a decision made in one lesson has no narrative echo later in the course — only its numeric effect on progress. This is the flagship pillar's version of the same gap the AI Mentor already solved for itself.

**Mandated Requirement:** Introduce a per-learner narrative-state layer for the course engine — a "decision journal" — that records meaningful in-story choices and resurfaces them in later, relevant moments of the course, distinct from and additional to gamification statistics.

**Brand Alignment:** The Plan, step 2 — decisions must have consequences the learner lives with, not just a score.

---

### B.10 — No parent-facing narrative exists for course-lesson learning, unlike the AI Mentor

**Severity:** High

**Current State:** The AI Mentor's guardian view generates a deterministic, human-language narrative per session ("Practiced X," "Found X tricky at first"). No equivalent exists for the core course/lesson pillar — the Family view shows only wallet totals, streaks, and numeric progress. (Ref: `02` E8/F3 vs. `01` §2.6 F1–F2.)

**Finding:** The Plan's second step is explicit: "the lesson does the explaining, you do the talking." A parent cannot open that conversation with numbers alone — this is the exact mechanism the AI Mentor already built, simply never extended to the product's largest pillar.

**Mandated Requirement:** Generate a short, human-language narrative for each completed lesson or topic in the core course, reusing the deterministic-narrative pattern already built for Mentor sessions, and surface it to the guardian.

**Brand Alignment:** Law 1 and the Plan's step 2.

---

### B.11 — Nothing requires mentors to model flawed, human decisions — risk of becoming infallible narrators

**Severity:** Medium-High

**Current State:** Mentor characters narrate story dialogue and scenes, reveal concepts, and deliver checkpoints — functionally, they explain correct outcomes. No requirement mandates that a mentor ever demonstrate a real misjudgment. (Ref: `03` §2.6 exercise families; `00` §1 mentor description.)

**Finding:** This risks contradicting the Guide's own stated positioning: "Mentors, not mascots. Recurring characters who model wise, flawed, human decisions about money." Without an explicit content requirement, mentors default to being correct-answer machines — the opposite of the brand's intent.

**Mandated Requirement:** Require a minimum proportion of story content per course — proposed starting point: at least one such episode per course, flagged for content-team validation — to show a mentor making and recovering from a real financial misjudgment, narrated with the same no-shame framing mandated for learner mistakes.

**Brand Alignment:** The Guide's defining character description; Law 3.

---

### B.12 — Grading rewards correctness, not the quality of reasoning — Law 4 is absent from the core grading architecture

**Severity:** High

**Current State:** Lesson grading is a score derived from correctness, with penalties for hints and attempts. No dimension of the grading model evaluates the reasoning process independent of the final answer. (Ref: `02` D4, `03` §3.2–3.5.)

**Finding:** Law 4 — "reward the decision, not the amount... a child who saved 10 coins with a plan outranks a child who was handed 100" — is realized in the Family Hub's wallet philosophy but has no counterpart in the course engine's own grading logic, where a deliberate, exploratory correct answer scores no differently (or worse, due to hint penalties) than a lucky first guess.

**Mandated Requirement:** Introduce at least one graded exercise family that explicitly evaluates reasoning ("why did you choose this") independent of final-answer correctness, producing a "judgment quality" signal distinct from the numeric score.

**Brand Alignment:** Law 4.

---

### B.13 — The Learning pillar and the Family Hub are structurally disconnected; nothing bridges a simulated lesson to a real-world action

**Severity:** Critical

**Current State:** No cross-reference exists anywhere in the data model or product flows between course/lesson content and Tasks, Wallet, or Goals. The two pillars operate as fully isolated systems. (Ref: `03` §2 vs. §6; `02` sections D and G.)

**Finding:** The brand's own Success vision is explicit that real behavior, not simulation alone, is the goal: "At 16, they've made money, not just been given it." A platform whose learning pillar never connects to its real-money pillar cannot deliver that outcome by design.

**Mandated Requirement:** Certain course milestones must trigger a concrete, optional prompt to the guardian inside the Family Hub (for example: "Your child just learned about savings goals — create a real one together?"), explicitly bridging simulated learning into real practice.

**Brand Alignment:** The Success vision; the Disruptive Promise.

---

### B.14 — No content-pipeline gate verifies Law 2 ("speak like a mentor, never a bank")

**Severity:** Medium

**Current State:** The content-generation pipeline (Forge) has deterministic gates for age-appropriate vocabulary, currency facts, and arithmetic re-execution, but none for brand tone. Evidence of leakage already exists in system copy — the literal error string "No attempts left for this question" reads as procedural, not mentor-like. (Ref: `02` K1, `04` §1.6.)

**Finding:** Without an explicit gate, banking-style, transactional language can and does slip into learner-facing copy, undermining the one voice trait the brand considers non-negotiable.

**Mandated Requirement:** Add a deterministic or judge-assisted tone gate to Forge that screens both authored lesson content and system/UI copy for banking/transactional language before release.

**Brand Alignment:** Law 2.

---

### B.15 — Placement outcome framing risks reading as a verdict on ability rather than accompaniment

**Severity:** Medium

**Current State:** Result screens state "starting further in" or "starting from the beginning" with no mandated framing beyond the literal outcome. (Ref: `02` D3.)

**Finding:** Repeated "starting from the beginning" results, without explicit non-comparative, growth-oriented language, risk feeling like a sorting verdict rather than a mentorship moment — in tension with Law 3.

**Mandated Requirement:** Mandate growth-mindset, non-comparative copy for every placement outcome, explicitly framing the starting point as a reflection of prior exposure, never of capability.

**Brand Alignment:** Law 3.

---

### B.16 — Content is translated, not culturally localized, despite the brand's own research citing distinct problems per market

**Severity:** Medium

**Current State:** Content is authored once in Spanish (Mexico) and translated into English and Portuguese with numbers, identifiers and answer keys frozen. (Ref: `09` §10, `02` K1.)

**Finding:** The Cosmic Narrative's own research foundation cites materially different problems per market — Mexico's gap is formal access outpacing financial *wellbeing*, while Brazil's is a raw literacy gap (45% of 15-year-olds below the OECD baseline). A literal translation of Mexico-centric examples does not necessarily address Brazil's distinct problem, or the US market's.

**Mandated Requirement:** Add a regional-adaptation layer to the content-generation pipeline, beyond translation — adjusting examples, amounts, and context per market, informed by each market's specific financial-literacy research profile. This must produce a named, documented "Regional Adaptation Gate" in Forge with an explicit per-market checklist, owned by the content/learning-design team, decided before the item's assigned phase begins.

**Brand Alignment:** The brand's own cited market research (Cosmic Narrative §1.1).

---

### B.17 — No content-pipeline enforcement of age-based working-memory limits per lesson

**Severity:** High

**Current State:** Lesson authoring has no rule limiting how many genuinely new concepts can be introduced before requiring practice or consolidation. The number of new elements in a lesson is currently an authoring judgment call, not a system constraint. (Ref: Appendix B §1.2, Miller/Cowan/Gathercole & Alloway working-memory research.)

**Finding:** Working-memory capacity for new, unchunked information is a measurable, age-dependent biological limit, not a stylistic preference — a lesson that exceeds it for its target age band cannot be learned regardless of how well it is written, narrated, or gamified. This is a silent failure mode: nothing in the current pipeline would ever flag a lesson as "too dense," because density is not a tracked property today.

**Mandated Requirement:** Forge must gain a deterministic gate that counts genuinely new (non-previously-introduced) concepts per lesson and blocks publication when that count exceeds an age-tier ceiling (proposed starting points, to be validated with the learning-design team: 2–3 new concepts for the 6–9 tier, 3–4 for 10–12, and 4–6 for teens/adults). Lessons exceeding the ceiling must be split, not shipped as authored.

**Brand Alignment:** "Teach without overwhelming" is only achievable if density is measured, not assumed.

---

### B.18 — No content-pipeline gate against redundant on-screen text and narration (Mayer's redundancy principle)

**Severity:** Medium

**Current State:** Lesson segments commonly pair narrated audio with on-screen text; there is no check for whether the two present identical wording. (Ref: Appendix B §1.5, Mayer's multimedia-learning principles.)

**Finding:** Presenting identical words simultaneously through two channels (heard and read) does not reinforce learning — the empirical finding is that it actively competes for the same cognitive channel and reduces comprehension relative to well-coordinated, non-redundant text and narration. This is a correctable, mechanical content defect, not a matter of authoring taste.

**Mandated Requirement:** Add a Forge content-pipeline check that flags segments where on-screen text substantially duplicates narrated audio verbatim, requiring the author to either differentiate them (narration explains, text labels/cues) or deliberately choose one channel for that segment.

**Brand Alignment:** None specific to a Communication Law — this is a learning-effectiveness requirement, not a brand-voice one.

---

### B.19 — Practice difficulty is not calibrated to a target success-rate band (desirable difficulty)

**Severity:** Medium-High

**Current State:** Adaptive difficulty (where it exists) and static exercise authoring have no explicit target success rate; nothing prevents difficulty calibration from drifting toward near-100% pass rates in pursuit of a "successful, satisfied learner" engagement signal. (Ref: Appendix B §1.7, Bjork's desirable-difficulties research; also connects to B.4's unearned-100%-score defect, which is a different failure mode with the same symptom.)

**Finding:** The research is specific and somewhat counter-intuitive: practice that feels too easy (approaching 100% success) is not actually building durable learning, even though it produces a positive-feeling session. A commercially-incentivized system optimizing purely for "learner feels good" will tend to drift exactly toward this pedagogically weak zone.

**Mandated Requirement:** Difficulty calibration (whether authored or adaptive) must explicitly target a success-rate band of roughly 70–85% for practice exercises — as a starting hypothesis to be validated and adjusted per lesson via the tracked metric, not a fixed universal constant — rather than a satisfaction or completion-rate metric. This target must be visible to the content/learning-design team as a tracked metric per lesson, not left implicit.

**Brand Alignment:** "We do not give lessons, we give decisions" requires the decisions to carry real, appropriately-calibrated difficulty.

---

### B.20 — Reward architecture risks the overjustification effect for young children

**Severity:** High

**Current State:** The wallet/reward system pays tangible currency contingent on completing tasks and lessons, with no distinction in framing between informational reward ("you figured out a tricky problem") and transactional payment for output. (Ref: Appendix B §2.5, Deci & Ryan's Self-Determination Theory; Deci, Koestner & Ryan 1999 meta-analysis.)

**Finding:** Tangible, task-contingent rewards are the reward structure most reliably shown to undermine intrinsic motivation for the underlying activity once the reward is anticipated or withdrawn — and this meta-analysis found the effect is *larger in children than in adults*. This is a direct, evidence-based risk to the product's long-term goal of building genuine financial-literacy interest, not just short-term engagement.

**Mandated Requirement:** Audit and reframe reward delivery so that currency/XP payouts are paired with competence-affirming, specific language about what was figured out (informational framing), rather than presented as pure payment for compliance. This does not mandate removing rewards — it mandates that reward framing and the presence of genuine autonomy (B.24) work together rather than the reward system substituting for autonomy. **Celebration budget (OD-7):** celebration effects (confetti, floating XP or coin amounts, overshooting "spring" motion) are reserved for a closed list of milestones: lesson complete, course complete, savings goal reached, badge earned, and streak milestones at 7, 30 and 100 days. A correct answer receives an informational response (a check mark, a short movement of the chosen answer, and a banner naming what was done right), never a celebration or a floating reward; a routine action such as confirming a coin split receives a plain confirmation. Rewards earned during a lesson are tallied on the result screen, not announced per answer. Acceptance: an automated check that no celebration effect fires outside the milestone list.

**Brand Alignment:** Law 4 — rewarding the decision, not the amount, is undermined if the reward system itself trains the child to work for the payout rather than the judgment.

---

### B.21 — All-or-nothing streak mechanic is not grounded in real habit-formation science

**Severity:** Medium

**Current State:** A streak resets to zero on a single missed day, with no lapse tolerance. (Ref: Appendix B §3.7, Lally et al. 2010 real-world habit-formation research.)

**Finding:** The empirical habit-formation literature shows genuine habits tolerate occasional lapses without breaking. An all-or-nothing streak reset is a retention mechanic borrowed from general social/engagement app design, not a habit-science-grounded feature — and it directly risks producing a shame response (per B.26/Tangney) over a single missed day, in tension with Law 3.

**Mandated Requirement:** Replace the all-or-nothing streak reset with a lapse-tolerant model — for example, a small number of "streak protections" per period, or a rolling-window definition of consistency — so the mechanic reflects how habits actually form rather than punishing a single miss disproportionately. The identical defect exists in the Chore Streak entity outside the learning domain; that instance is tracked and fixed separately at D.2, using this same model, so the two are not implemented as independent, potentially conflicting efforts.

**Brand Alignment:** Law 3 — a single missed day should never read as a failure requiring recovery from zero.

---

### B.22 — No prohibition exists on variable-ratio ("mystery reward") mechanics for minors

**Severity:** High — ethical/policy requirement

**Current State:** No documented policy currently prohibits randomized or variable-ratio reward mechanics (e.g., loot-box-style unlocks, randomized reward tiers) from being introduced into the rewards or badge system in the future. (Ref: Appendix B §3.8, Skinner's operant-conditioning research on reinforcement schedules.)

**Finding:** Variable-ratio reinforcement is the specific, well-established mechanism that makes slot machines and loot boxes behaviorally powerful and resistant to extinction — this is one of the most solid findings in behavioral psychology, not a contested one. Deploying it toward users under 18 carries real ethical exposure and is inconsistent with the brand's "mentor, not casino" positioning.

**Mandated Requirement:** Adopt and document an explicit, written prohibition on variable-ratio/randomized reward mechanics for any account holding the kid role or otherwise identified as a minor (per the age-safeguard flag mandated in A.2–A.4). All rewards must be predictable and transparently tied to a specific, understood action.

**Brand Alignment:** Law 2 — a mentor does not run a slot machine.

---

### B.23 — Age-band tone, UI, and reward registers are not genuinely differentiated

**Severity:** High

**Current State:** The same mascot-driven reward and tone framework spans the full user age range, from young children through teens, with no documented "graduation" point where the register visibly matures. (Ref: Appendix B §2.9, motivation-across-the-lifespan research and the age-band synthesis table.)

**Finding:** The research is explicit that this is not one product with a difficulty slider — it is at minimum four psychologically distinct experiences (young child, tween, teen, adult/parent) sharing a data model and brand promise, each with a different primary motivator and a different tolerance for childish framing. A teen encountering a reward register designed for a 7-year-old can experience it as actively repellent and autonomy-undermining, not merely "not ideal."

**Mandated Requirement:** Define and build at least three genuinely distinct tone/UI/reward registers (young child, tween/teen transition, teen; the adult/parent register is addressed separately as the Family Hub's own surface) — not palette or copy re-skins of one mechanic, but different reward framings, different mascot presence levels, and different social/comparative mechanics per band. Build an explicit design "graduation" moment around ages 10–12, timed to when children begin discounting simplistic praise per the research.

**Amendment (OD-4, 20 September 2026):** the owner ruled that there is one design system for every surface and every user. The registers above are therefore built **inside** that one system: colours, typography, shapes, components and motion tokens are identical for every age band; what differs per band is copy tone, the Mentor character's presence and voice, reward framing, and the social/comparative mechanics allowed. "Different reward framings, different mascot presence levels, and different social/comparative mechanics per band" stands; "tone/UI" is read as tone and content, not as a separate visual skin. The graduation moment around ages 10–12 stands.

**Brand Alignment:** The mentor promise ("wise, flawed, human decisions about money") must be credible to the age band receiving it — a mentor who talks to a 15-year-old the way they talk to a 7-year-old is not credible.

---

### B.24 — Avatar customization is the product's primary "autonomy" lever, but research shows it does not serve autonomy

**Severity:** Medium-High

**Current State:** Avatar/profile personalization is the main learner-facing choice mechanism outside of course selection. (Ref: Appendix B §3.5, Sailer et al. 2017.)

**Finding:** This specific empirical study found that badges/leaderboards/graphs serve the *competence* need and avatar/narrative/teammates serve the *relatedness* need — but avatar customization alone does **not** measurably serve the *autonomy* need central to Self-Determination Theory. The product's implicit assumption that personalization equals autonomy is not supported by this research.

**Mandated Requirement:** Introduce a genuine autonomy mechanism distinct from cosmetic personalization — real learner choice over path, approach, or pacing within a course or lesson (for example: choosing which of two equally-valid strategies to practice next, or which order to tackle optional enrichment content) — and do not credit avatar customization toward the product's autonomy-support goals in design reviews.

**Brand Alignment:** Connects to B.6/B.7 — a frontier of available next-lessons, chosen by the learner rather than dictated by fixed order, is itself a concrete autonomy mechanism this requirement can be built on.

---

### B.25 — No formal audit exists against manipulative ("dark pattern") design for a product marketed as safe-for-children

**Severity:** High

**Current State:** No documented, recurring review process checks the product against known manipulative-design pattern categories. (Ref: Appendix B §3.6, Radesky et al. 2022, *JAMA Network Open*.)

**Finding:** A large published study found roughly 80% of studied children's apps contain at least one manipulative design pattern, and explicitly names a real, commercially successful product (PBS KIDS) as a zero-manipulation benchmark. A product whose entire brand promise is trustworthy, verified parental control cannot leave this unaudited and simply assume good intent produced a clean result.

**Mandated Requirement:** Establish a recurring (at minimum, pre-release) design and content audit against the dark-pattern taxonomy in this research, with the explicit goal of a zero-manipulation product, benchmarked against the same standard the cited study uses.

**Brand Alignment:** Pillar 5 and Law 5 — verified parental control is a hollow promise if the product itself uses manipulative retention mechanics on the children that control exists to protect.

---

### B.26 — Error and failure states are not audited for non-verbal shame signals, and feedback is not systematically self/task-scoped

**Severity:** Medium-High

**Current State:** No documented content or UX rule requires every corrective/error moment to be scoped strictly to the action rather than the learner's identity, and no audit exists for non-verbal signals (mascot reactions, visual/audio cues) separate from copy. (Ref: Appendix B §1.8 Kluger & DeNisi and §2.8 Tangney's shame-vs-guilt research — the same underlying mechanism examined from two disciplines.)

**Finding:** This is one of the best-replicated findings in the entire research base: feedback and error states that implicate the learner's identity (even wordlessly — a disappointed mascot animation, a public rank drop, a red "failed" flash) function as shame cues and reliably predict withdrawal; feedback and error states scoped to a specific, fixable action function as guilt-adjacent and reliably predict engagement and repair. Law 3's "no one is shamed for a mistake" promise is currently an intention without a systematic enforcement mechanism — B.14 already gates banking-style *tone*, but nothing currently gates identity-implicating *shame* language or non-verbal shame signals specifically.

**Mandated Requirement:** Extend the Forge tone gate introduced in B.14 (or add a parallel gate) to explicitly screen for self-global language in every error/failure state ("you're not a saver" style framing) and require all corrective language to name the specific action or step instead. Separately, audit non-verbal elements — mascot animation states, color/sound cues, and any leaderboard or comparative display tied to a single miss — against the same self-vs-behavior standard, since these can encode shame independent of copy. **No loss mechanics (OD-1):** a wrong answer never costs the learner anything: no lives, hearts, energy or other depleting resource, no counter shown (not even an "unlimited" one), and no lockout from practice. After several consecutive misses on the same skill (proposed: 3; owned by the Pedagogical Lead and calibrated through Appendix C's threshold recalibration log), the learner's Mentor offers a guided review of that skill. Rationale: B.19 targets a 70–85% practice success rate, so errors are expected by design; with 3 lives and 10-question lessons, between 18% (at 85% success) and 62% (at 70% success) of lessons would exhaust the lives.

**Brand Alignment:** Law 3, directly and specifically — this requirement is the operational enforcement mechanism for a promise the brand already makes.

---

### B.27 — The "no shame" promise is scoped to in-app performance only, not to the family's real financial circumstances the product may surface

**Severity:** Medium

**Current State:** No documented content rule addresses how scenarios, prompts, or comparisons might implicitly frame a family's actual financial circumstances (income level, spending choices, financial stress) as reflecting personal or moral failing. (Ref: Appendix B §2.7, Klontz's money-script research and Gudmunson & Danes' family financial socialization theory.)

**Finding:** Research shows children absorb financial beliefs and stress signals from their family's emotional relationship with money — not only from explicit teaching — and that this transmission occurs across the income spectrum, not only in financially stressed households. A product whose content or Family Hub prompts implicitly frame certain spending patterns, income levels, or financial choices as better or worse in a moralized way risks reinforcing exactly the kind of shame-based money script the brand's own promise is meant to prevent.

**Mandated Requirement:** Extend content-review guidance (and the Forge tone/shame gates from B.14 and B.26) to explicitly cover real-world financial framing in scenarios and Family Hub prompts, not only in-app performance feedback: no scenario, comparison, or prompt language may imply that a family's actual financial circumstances are a personal or moral failing.

**Brand Alignment:** Law 3 and Law 1 (the parent is the hero) — a product that quietly moralizes a family's real financial situation cannot simultaneously cast that family's parent as the hero of the story.

---

### B.28 — No requirement prevents the AI Mentor or content design from optimizing for engagement volume over learning efficiency

**Severity:** High

**Current State:** No documented principle or metric distinguishes healthy learning engagement from engagement-maximizing design — for example, artificially prolonged AI Mentor dialogue, unnecessary re-explanation, or conversational turn count treated as an implicit success signal. (Ref: Appendix B §2.6, Flow theory's explicit warning about "flow-as-stickiness vs. flow-as-learning"; Appendix C Part 1.2, Engagement-Health Metrics.)

**Finding:** Conversational AI systems, left unchecked, can drift toward maximizing dialogue turns and session length — each additional turn reads as additional "engagement" by a naive metric, even when it represents nothing more than an inefficient resolution — rather than resolving the learner's actual need efficiently. This runs directly counter to a mentor-positioned brand promise and to the product's real mission of teaching effectively, and it is a realistic long-term risk for a product built around an LLM-driven Mentor, not a hypothetical one.

**Mandated Requirement:** Adopt "resolution efficiency" as an explicit, tracked design principle for the AI Mentor and for lesson pacing: the AI Mentor must be designed and evaluated against the goal of resolving a learner's question or completing a requested demonstration in as few conversational turns as genuinely needed, not the most. Instrument and monitor the Session Efficiency Ratio and AI Mentor Resolution Efficiency metrics (Appendix C Part 1.2) from initial release; an increasing-turns-over-time trend must be treated as a regression requiring investigation, never as a neutral or positive engagement signal.

**Brand Alignment:** A mentor answers well and moves on; a mentor who keeps a student talking longer than necessary to appear attentive is stalling, not modeling wisdom — in direct tension with the Guide's positioning and with Law 2's rejection of vendor/engagement-maximizing logic.

---

## Block B — Pedagogical Design Standard: How to Build a Lesson Correctly

**Status:** Mandatory design standard, applying to every lesson authored or revised from this point forward. This section operationalizes the research in `10-APPENDIX-B-PEDAGOGICAL-PSYCHOLOGICAL-FRAMEWORK.md` into a working checklist for the content and learning-design team and, ultimately, into Forge content-pipeline gates. B.17–B.28 above are the specific, individually-tracked mandatory requirements drawn from this research; this section is the synthesized standard those requirements sit inside. **`10-APPENDIX-C-SUCCESS-METRICS-QA-PIPELINE.md` is where this standard is operationalized into an end-to-end production process** — the six checks below are executed formally at Stage 3 (Pedagogical Human Review) of that pipeline, and every check below has a corresponding metric and Definition-of-Done criterion defined there. This section states the standard; Appendix C states how it is enforced, measured, and sequenced.

### The six checks every lesson must pass

Grounded in the cross-cutting synthesis of all three research passes in Appendix B, every authored lesson — regardless of subject, course, or age tier — must be able to answer "yes" to each of the following before it is considered release-ready:

1. **Does it respect the real working-memory limit for its target age band?** No more new, unchunked concepts than the age-tier ceiling in B.17 — abstract concepts must have a concrete/visual proxy available (Appendix A) rather than being introduced purely verbally, especially for younger and less-experienced learners (Appendix B §1.2, §2.1).
2. **Is every piece of feedback scoped to the action, never to the learner's identity?** No self-global language, no non-verbal shame signals (mascot, color, sound, comparative display), in any error or low-score state (B.26; Appendix B §1.8, §2.8).
3. **Does the reward structure reinforce genuine competence and autonomy, or does it risk substituting for them?** Rewards should read as informational recognition of a specific decision, not pure payment for output; a real, non-cosmetic choice mechanism must exist somewhere in the lesson or course path (B.20, B.24; Appendix B §2.5, §3.5).
4. **Is difficulty calibrated to a genuine practice zone, not to a comfort/completion metric?** Target roughly 70–85% success on practice exercises; a lesson that is easy enough to be near-certain to complete perfectly is not doing its job (B.19, B.4; Appendix B §1.7).
5. **Is the tone, mascot presence, and reward framing matched to the actual age band receiving it, not a generic register reused across ages?** A distinct, deliberately-chosen register per age band (young child / tween-teen transition / teen), consistent with the "graduation" point around ages 10–12 (B.23; Appendix B §2.9).
6. **Where this lesson or moment involves the AI Mentor, is it designed to resolve efficiently rather than to maximize dialogue?** No conversational pacing choice should be justified by "it increases engagement time" alone — efficiency of resolution is itself a quality signal, not a cost to be traded away (B.28; Appendix C Part 1.2).

### Age-band registers (operational summary)

| Register | Ages | Dominant motivator | Tone & mascot presence | Reward framing | Autonomy mechanism |
|---|---|---|---|---|---|
| Young child | 6–9 | Caregiver approval, immediate concrete recognition | High mascot presence; warm, literal, generous encouragement | Frequent, small, informational feedback (never per-answer celebration, OD-7); sparing tangible currency | Simple binary choices (which topic next) |
| Tween / transition | 10–12 | Emerging mastery + peer comparison; discounts insincere praise | Reduced mascot dependence; recognition tied to specific skill demonstrated | Mastery-based, specific ("you nailed the compounding step") | Choice of approach/strategy, not just topic order |
| Teen | 13–17 | Autonomy, identity, peer status | Minimal mascot dependence; identity-respecting, non-childish framing; no peer-visible risk comparisons | Identity-affirming, tied to real capability, never framed as "for kids" | Real path/pacing choice; optional depth/enrichment tracks |
| Adult / parent (Family Hub surface) | 18+ | Utility, transparency, time-efficiency | Minimal decoration; direct, respectful of time | Transparent, optional gamified layers; lead with utility | Full visibility and control over what is tracked/shown |

This table is the working reference for both content authors and Forge gate design; it should be revisited as the underlying research in Appendix B is revisited (see that appendix's closing note on intellectual honesty).

---

### Block B — Summary of Mandated Changes

| ID | Finding | Severity | Owner decision needed |
|---|---|---|---|
| B.1 | Placement commit fails for real quiz outcomes | Critical | Widen DB schema or normalize method values; add E2E acceptance test |
| B.2 | Course prerequisites stored but unenforced | Medium | Build enforcement vs. remove the field |
| B.3 | Silent single-course failure drops content invisibly | Medium | Add staff-visible signal + learner-facing error state |
| B.4 | Unsupported segments can yield an unearned pass | Medium-High | Add unsupported-weight threshold that blocks completion |
| B.5 | Replay score can read as a regression | Low-Medium | Add explicit "best score preserved" messaging |
| B.6 | Two disconnected pedagogical brains (course vs. Mentor) | Critical | Unify course progression on the AI Mentor's knowledge graph; sequence after B.1 |
| B.7 | No interactive visual/operational reasoning system in lessons | Critical | Build full catalog per Appendix A (Core charts + 16 interaction primitives + 12 concept mappings) **and Appendix P** (mathematical, logic and money visuals; first-release list in P Part 8) |
| B.8 | Lesson player inherits none of the Mentor's/map's immersion (character, theme, animation) | High | Reuse existing character/animation system inside the lesson player; sequence with B.7 |
| B.9 | No narrative continuity across lessons — only gamified stats persist | High | Build a per-learner "decision journal" narrative-state layer |
| B.10 | No parent-facing narrative for course lessons (asymmetry vs. AI Mentor) | High | Reuse the Mentor's deterministic-narrative pattern for course lessons |
| B.11 | Mentors risk being infallible narrators, not flawed/human models | Medium-High | Require mentors to model and recover from real misjudgments |
| B.12 | Grading rewards correctness only, not reasoning quality (Law 4 absent) | High | Add a graded exercise family evaluating reasoning independent of correctness |
| B.13 | Learning pillar and Family Hub have no bridge to real-world action | Critical | Trigger optional real-task/goal prompts from course milestones |
| B.14 | No content-pipeline gate verifies Law 2 tone ("mentor, not bank") | Medium | Add a tone gate to Forge for learner-facing and system copy |
| B.15 | Placement framing risks reading as a verdict, not accompaniment | Medium | Mandate growth-mindset, non-comparative placement copy |
| B.16 | Content is translated, not culturally localized, per market | Medium | Add a regional-adaptation layer to the content pipeline |
| B.17 | No cap on new concepts per lesson vs. age-based working-memory limits | High | Add a Forge gate capping new concepts per lesson by age tier |
| B.18 | No gate against redundant on-screen text + narration | Medium | Add a Forge check for verbatim text/narration duplication |
| B.19 | Practice difficulty not calibrated to a target success-rate band | Medium-High | Target ~70–85% success rate explicitly, not a satisfaction metric |
| B.20 | Reward architecture risks overjustification effect, especially for young children | High | Reframe rewards as informational/competence-based; celebration only on the OD-7 milestone list |
| B.21 | All-or-nothing streak mechanic contradicts real habit-formation science | Medium | Replace with a lapse-tolerant streak model |
| B.22 | No prohibition on variable-ratio ("mystery reward") mechanics for minors | High | Adopt and document an explicit prohibition |
| B.23 | Age-band tone/UI/reward registers are not genuinely differentiated | High | Build ≥3 distinct content registers (tone, character presence, reward framing, social mechanics) inside the one design system (OD-4); graduation point at ages 10–12 |
| B.24 | Avatar customization is treated as the autonomy mechanism, but isn't one | Medium-High | Add a genuine path/pacing/approach choice mechanism |
| B.25 | No audit exists against manipulative ("dark pattern") design | High | Establish a recurring pre-release dark-pattern audit |
| B.26 | Error states not audited for non-verbal shame signals; feedback not systematically self/task-scoped | Medium-High | Extend the Forge tone gate to shame language and non-verbal cues; no loss mechanics (no lives, OD-1) |
| B.27 | "No shame" promise doesn't extend to real family financial circumstances | Medium | Extend content-review guidance to real-world financial framing |
| B.28 | Nothing prevents the AI Mentor/content pacing from optimizing engagement volume over learning efficiency | High | Adopt "resolution efficiency" as a tracked design principle and metric |

**References:** `10-APPENDIX-A-INTERACTIVE-VISUAL-CATALOG.md` — the complete, research-grounded chart/diagram taxonomy and interactive-operations catalog underlying B.7. `10-APPENDIX-B-PEDAGOGICAL-PSYCHOLOGICAL-FRAMEWORK.md` — the complete cognitive-science, developmental-psychology, and neurodivergent/ethical-gamification research underlying B.17–B.28 and the Pedagogical Design Standard above. `10-APPENDIX-C-SUCCESS-METRICS-QA-PIPELINE.md` — success metrics (learning outcome, engagement-health, and QA), the Definition of Done per requirement, the end-to-end lesson production pipeline, and the internal phasing/sequencing of all 28 Block B requirements. `10-APPENDIX-P-TEACHING-VISUALS-MATH-LOGIC-MONEY.md` — the mathematical, logic and money teaching-visual families that extend B.7, with their evidence, localisation rules, licensing constraints and grading contract.

---

## Block C — AI Mentor (Real-Time Pedagogy, Safety, and Self-Improvement)

Covers: the AI Mentor's session lifecycle (start, in-session turns, adaptation offers, memory notes, session close), its content ladder (published lesson → curated bank → live LLM generation), its pedagogy controller and mastery model, and — per explicit direction for this Block — how the Mentor should build a real-time picture of the learner it is speaking to, how it should decide what to teach and when to stop, and how the product as a whole should get better at doing this over time. Because the AI Mentor's output happens live, in a real conversation with a child, this Block required materially deeper research than Block B: `10-APPENDIX-D-REALTIME-TUTORING-FRAMEWORK.md` covers real-time affect/motivation detection, real-time knowledge modeling and stopping rules, and conversational pedagogy/working alliance; `10-APPENDIX-E-SELF-IMPROVEMENT-GOVERNANCE.md` covers what "the Mentor improving itself" can defensibly mean and how it must be governed. C.1–C.8 are structural findings from the existing architecture (`01` §2.5, `02` Section E, `03`, `05` §6, `08`); C.9–C.20 formalize Appendix D's design implications; C.21–C.24 formalize Appendix E's governance model.

### C.1 — Self-registered accounts default to the middle age tier, mis-calibrating every pedagogy decision

**Severity:** High

**Current State:** The AI Mentor derives its age tier from stored date of birth (7 or younger → tier 1, 8–9 → tier 2, 10+ → tier 3), but the tier defaults to 2 whenever date of birth is unknown. Per A.4, email-signup date of birth is validated at signup and then discarded rather than stored, and Google Sign-In (A.3) captures none at all — meaning most self-registered accounts reach the AI Mentor with no real age signal and silently receive tier-2 treatment regardless of whether the learner is 8 or 16. (Ref: `01` §2.5; `05` §6; A.3, A.4.)

**Finding:** Every downstream real-time decision this Block addresses — hint-ladder pacing, dialogue register, persona tone, working-memory-appropriate strategy selection — is conditioned on age tier. A tier-2 default silently applied to a 15-year-old produces exactly the "generic register reused across ages" failure Block B (B.23) already identified for authored content, but here it happens live, in conversation, where the mismatch is more immediately visible to the learner as condescension or confusion.

**Mandated Requirement:** Date of birth (or, per A.4, an equivalent minimum age-band declaration) must be persisted for every account, not discarded after signup validation, specifically so the AI Mentor never falls back to a default tier for a self-registered account. Until A.4 is implemented platform-wide, the AI Mentor must treat "age tier unknown" as its own explicit state — triggering a lightweight, one-time in-conversation calibration question — rather than silently substituting tier 2.

**Brand Alignment:** Law 5 — a personalization default silently applied without the learner's or parent's knowledge is the same kind of quiet substitution the FAQ-promise findings (A.1) already flagged.

---

### C.2 — Kid-role-gated voice/microphone safeguards do not follow the real minor

**Severity:** Critical

**Current State:** The minors' voice/microphone policy — the rule restricting AI Mentor voice input for children — is gated exclusively on the kid role. A self-registered teen (13–17) or a guest, both of whom hold only the universal role (A.2, A.3), can access the AI Mentor's voice channel with none of the restrictions the product designed specifically for underage users of that channel. (Ref: `01` §2.5 T1 voice flow; `05` §6.)

**Finding:** This is the same "kid role ≠ real minor" fracture identified at the account level in Block A, recurring inside the AI Mentor's own safety mechanisms. It is more consequential here than at signup: voice input is precisely the channel where Appendix D's affect-detection research (Part 1.6) flags the highest technical and ethical risk (pubertal voice noise, arousal/valence confound, weakest reliability for exactly the young-teen population most likely to be misclassified as adult by this gap).

**Mandated Requirement:** The minors' voice policy must key off the same origin/age-signal mechanism mandated in A.2 and A.4 (an account-level minor indicator independent of role), not the kid role alone. Until that indicator exists platform-wide, any account with an unknown or unverified age must default to the minors' voice policy being applied, not exempted — the safe default must be the restrictive one.

**Brand Alignment:** Pillar 5 — the same principle as A.2, applied to the AI Mentor's own channel-level controls.

---

### C.3 — AI Mentor content moderation fails open for the same population

**Severity:** Critical

**Current State:** AI Mentor content moderation runs in fail-closed mode (blocking on any moderation-system failure or ambiguity) only for sessions under the kid role. Sessions under the universal role — again, including self-registered teens and guests — fail open: a moderation-system error or timeout allows the conversation to continue rather than blocking it. (Ref: `01` §2.5; `05` §6.)

**Finding:** This is the third and most severe instance of the recurring fracture: it is not a missing convenience feature but an active safety-system behavior that is measurably weaker for exactly the population — teens — who are old enough to have substantive, higher-stakes conversations with the AI Mentor and young enough to still be minors under the product's own stated protections.

**Mandated Requirement:** Fail-closed moderation behavior must apply to every AI Mentor session by default, regardless of role, unless an account has been affirmatively confirmed as adult (e.g., a verified parent/Tutor account). Fail-open must never be the default state for any session where the user's age is unconfirmed.

**Brand Alignment:** Pillar 5 and Law 5 — a safety mechanism that is quietly weaker exactly where it matters most is a broken promise, not a technical nuance.

---

### C.4 — Memory-note guardian review is gated on kid role, not on being a minor

**Severity:** High

**Current State:** The AI Mentor's memory-note system (learner note + pedagogy note, per the data model) routes proposed memory notes through mandatory guardian approval only when the account holds the kid role. A self-registered teen's memory notes — which can include the Mentor's own inferences about the learner's emotional state, struggles, or family financial context discussed in-session — are written and retained with no guardian visibility at all. (Ref: `03` Learner Memory Note, Memory Proposal; `01` §2.5.)

**Finding:** This is the fourth documented instance of the same structural fracture, and arguably the most sensitive: a memory note is the AI Mentor's own inferred summary of what it learned about a specific child, potentially including affective or family-financial content (Appendix D Part 1; Block B's B.27 already flagged real-world financial framing as sensitive). A teen self-registering specifically to avoid guardian involvement — a realistic scenario this product's own account model makes possible — receives a persistent AI-authored profile of themselves that no guardian ever sees or can correct.

**Mandated Requirement:** Guardian review eligibility for memory notes must key off a verified guardian-link relationship, not the kid role. Where a teen account has no linked guardian at all (a real, permitted state in this account model), the product must decide and document an explicit policy — e.g., a lighter-weight self-review/deletion mechanism for the teen themselves — rather than leaving the notes ungoverned by default.

**Brand Alignment:** Pillar 5 and Law 5 — "verified parental control" cannot selectively apply only to the accounts that happen to carry a particular internal role flag.

---

### C.5 — The live-generation content tier is judge-approved with an unexamined, fixed staff-sampling rate

**Severity:** Medium-High

**Current State:** The content ladder's third tier — live LLM-generated content, used whenever the published-lesson and curated-bank tiers do not cover a need — is approved by an automated judge and staff-sampled at a fixed 15% rate. No documented rationale ties that rate to an acceptable error tolerance, and no threshold exists for automatically increasing the sampling rate if a quality or safety issue is found in a sampled batch. (Ref: `08` content-ladder sampling job; `01` §2.5.)

**Finding:** Per Appendix E Part 1.2, LLM-as-judge systems have documented, well-replicated failure modes (position/verbosity/self-enhancement bias, sharply higher error rates on ambiguous or adversarial cases) that a flat sampling rate does nothing to detect early — a degrading judge or a newly-emerged failure pattern could run at scale for an extended period before the next scheduled staff review surfaces it.

**Mandated Requirement:** The staff-sampling rate must be dynamic, not fixed: any sampled batch that surfaces a real quality or safety issue must trigger an automatic, temporary increase in sampling rate for that content category until a defined number of consecutive clean batches (proposed: 5, pending calibration — see Appendix F's Threshold Recalibration Log) restores the baseline rate. This dynamic-sampling floor must also satisfy Appendix E §3.1.1's risk-scaled minimums for live per-item content judging (C.5/C.6): no less than 15% for standard content, no less than 50% for any content flagged as touching a sensitive topic. The judge itself must be calibrated against a human-rated seed set per Appendix E Part 2.1/3.2 before its approvals are trusted at any sampling rate.

**Brand Alignment:** Law 4 (nuanced-reasoning quality) — an unaudited automated approver is the content-generation analog of grading only for correctness.

---

### C.6 — The curated activity-pack tier is structurally empty, collapsing the content ladder to two tiers in practice

**Severity:** Medium

**Current State:** The content ladder's middle tier — a curated bank of pre-authored activity packs meant to sit between fully-authored published lessons and live LLM generation — is structurally defined in the data model but contains no populated content. In practice, every request that misses the published-lesson tier falls straight through to live generation. (Ref: `03` Curated Activity Pack; `01` §2.5.)

**Finding:** This removes the one tier in the ladder that was meant to give the product a fast, pre-vetted fallback with no live-generation risk at all. It quietly shifts far more real-time traffic onto the highest-risk, least-controllable tier (live generation, C.5) than the architecture's own three-tier design intended.

**Mandated Requirement:** Populate the curated-activity-pack tier for the highest-frequency, highest-predictability request patterns first (per Appendix C's production-pipeline sequencing), explicitly to reduce live-generation volume — treat this as a load-bearing part of the content-safety architecture, not an optional content-variety nicety.

**Brand Alignment:** Law 2 — an architecture design that quietly reduces to "always improvise" was not the deliberate choice the platform's own design intended.

---

### C.7 — No explicit real-time learner profile exists beyond per-skill mastery values

**Severity:** High

**Current State:** The pedagogy controller selects among its 12 strategies and tracks per-knowledge-component mastery (BKT), but maintains no explicit, structured profile of the learner's disposition — help-seeking style, typical response latency, prior sessions' end-reasons, persona rapport history — that could inform strategy selection beyond the mastery number alone. (Ref: `01` §2.5; `03` Tutor Session.)

**Finding:** This is the structural root of the user's original question — "cómo construir un perfil psicométrico/pedagógico en tiempo real" — the mastery model answers "what does the learner know," but nothing today answers "how does this specific learner learn best," which Appendix D's Parts 1 and 3 establish is necessary for both affect-aware pacing and alliance continuity across sessions.

**Mandated Requirement:** Extend the Tutor Session data model with a persistent, cross-session **learner disposition profile** — populated by the Behavioral Telemetry Layer (C.9) and Alliance Controller (C.15) mandated below — that the pedagogy controller reads alongside mastery values when selecting a strategy. This profile is additive to, not a replacement for, the existing mastery model.

**Brand Alignment:** Directly responsive to the brand's mentor positioning — a mentor who has spoken with someone before remembers how they learn, not only what they've covered.

---

### C.8 — No behavioral-signature-based session-end recommendation exists; only hard/soft time and turn caps

**Severity:** High

**Current State:** Session budgets are purely clock- and turn-based: 15-minute soft budget, 25-minute/120-turn hard cap, 10-minute idle timeout. Nothing in the current design evaluates whether the learner is still learning productively versus fatigued, frustrated, or disengaged when recommending a session end. (Ref: `01` §2.5; `03` Tutor Session.)

**Finding:** Per Appendix D Part 2.5, elapsed time and turn count are a documented weak predictor of learning outcome on their own (Baker et al.'s time-on-task research found ~1.9% variance explained, negative in 8 of 19 classrooms) — a purely clock-based cap means the Mentor can neither end a session early when it should (rising error rate on already-mastered material) nor justify continuing past the soft budget when a learner is in genuine productive flow.

**Mandated Requirement:** Implement the behavioral-signature-based early-warning signal specified in Appendix D §2.5 (rising response-latency variance plus a rising "surprising miss" rate against the learner's own session-opening baseline, tracked over a rolling window) as an input to the adaptation-offer mechanism, able to fire before the hard cap — never replacing the hard cap, which remains a non-negotiable ceiling.

**Brand Alignment:** Directly addresses the user's explicit concern about sessions ending in a "sabor amargo" — a session that runs to a clock rather than to the learner's actual state is the mechanism by which that bitter aftertaste happens.

---

### C.9 — No real-time affective or motivational state detection layer exists

**Severity:** Critical

**Current State:** The AI Mentor has no mechanism to infer, from conversational or behavioral signal, whether a learner is confused-and-productively-struggling, frustrated, bored, or disengaged. The adaptation-offer mechanism exists but nothing currently decides when to trigger it based on the learner's state. (Ref: Appendix D Part 1.)

**Finding:** This is the core capability the user identified as missing: the Mentor cannot currently "evaluar si el usuario ya está enojado, está frustrado o que quiere." Appendix D Part 1 establishes this is solvable, within real limits, from text/voice/telemetry signal alone — but only if built as a dedicated layer, not left implicit in the LLM's own turn-by-turn judgment.

**Mandated Requirement:** Build a **Behavioral Telemetry Layer** as a first-class component alongside the pedagogy controller, computing the signals specified in Appendix D §1.3–1.4 (response-latency deltas against the learner's own baseline, verbosity delta, repeated-identical-answer detection, hedging-language detection, off-topic drift, gaming-the-system pattern detection) from existing conversational and interaction data — no new data collection beyond what a text/voice tutoring session already produces. Per Appendix D §1.7, this layer must never output a declarative emotion label; it must output signal strength feeding the adaptation-offer mechanism (C.9 pairs directly with C.19).

**Brand Alignment:** Central to the mentor positioning — a mentor notices when someone is struggling; a system that cannot notice cannot claim to mentor.

---

### C.10 — Fixed guess/slip parameters risk premature mastery declarations and unwarranted remediation triggers

**Severity:** High

**Current State:** The BKT mastery model uses guess ≤0.30/default 0.20 and slip ≤0.10/default 0.10 as fixed, population-average parameters (overridable per knowledge component, but not per learner or in response to real-time context). A single correct or incorrect response can move a moderate-prior P(L) substantially. (Ref: Appendix D §2.6; `03` Knowledge Component.)

**Finding:** Per Appendix D §2.6, this is a quantified, quoted risk in the research, not a theoretical one: at default parameters, a fully-mastered skill still has a 1-in-10 chance of a wrong answer on any attempt, and a not-yet-mastered skill can have better than a 1-in-5 chance of a lucky guess — meaning the system can currently declare mastery or trigger remediation/rescue off a single, possibly-unrepresentative response.

**Mandated Requirement:** Require corroborating evidence — a minimum of two consecutive observations (proposed, pending data-driven validation — see Appendix F's Threshold Recalibration Log), weighted by response latency and hint-request pattern as specified in Appendix D §2.6 — before the pedagogy controller autonomously executes either of its two most consequential moves: declaring full mastery of a knowledge component, or triggering the "remediate"/"rescue" strategies. Treat every mastery declaration as provisional and re-testable (mirroring the demotion-rule precedent in Appendix D §2.3), never a permanent one-way flag. Any metric tracking compliance with this threshold (including a 100%-compliance target, if one is defined in Appendix F) should be reviewed and recalibrated alongside the threshold itself, not treated as a separately fixed measure once the threshold is adjusted.

**Brand Alignment:** Law 4 — a mastery claim the system cannot actually stand behind is a nuance failure with real downstream consequences for the learner's confidence and the parent-facing progress report.

---

### C.11 — No distinction between within-session and cross-session spaced review

**Severity:** Medium-High

**Current State:** No documented mechanism separates "should we re-cover this shaky answer again before this session ends" from "when should this skill come back up in a future session." (Ref: Appendix D §2.4.)

**Finding:** Per Appendix D §2.4, these are two genuinely distinct problems in the literature and in every mature production precedent reviewed (Duolingo's two-tier model being the clearest): using a single mechanism for both risks either cramming ineffective last-minute repetition into a session about to hit its cap, or losing shaky material entirely once a session ends.

**Mandated Requirement:** Implement the two-tier model specified in Appendix D §2.4: a short-horizon, BKT/PFA-style running-count rule for within-session re-exposure, and an activation/half-life-style scheduler (extending the mastery model's existing per-component tracking) for cross-session due-date scheduling, with an explicit decision rule for which tier a given wrong answer is routed to based on proximity to mastery threshold and remaining session-turn budget.

**Brand Alignment:** Law 4 — genuine mastery requires genuine retention, not a session-scoped illusion of it.

---

### C.12 — Session-end guidance does not use the behavioral-signature signal mandated in C.8

**Severity:** High

*(Formal specification of the mechanism referenced structurally in C.8; listed separately here because it is the direct, load-bearing Appendix D requirement.)*

**Current State:** See C.8. *(Editorial note: C.12 is tracked as a distinct ID for phasing/dependency purposes but is not an independent requirement beyond C.8 — see C.8 for the substantive finding and mandate.)*

**Finding:** See C.8; Appendix D §2.5 additionally specifies the exact signal composition (rolling-window response-latency variance plus "surprising miss" rate) and explicitly warns against using raw elapsed time or turn count as the trigger.

**Mandated Requirement:** The behavioral-signature signal specified in Appendix D §2.5 must be implemented as a defined input to the adaptation-offer mechanism, with its own instrumentation independent of the hard/soft time caps, and must be able to recommend an early, graceful session close well before the 25-minute/120-turn ceiling is reached.

**Brand Alignment:** See C.8.

---

### C.13 — No first-class hint-ladder dialogue-manager object; hint-abuse risk is unaddressed

**Severity:** High

**Current State:** The pedagogy controller selects among strategies including "direct," "worked example," "faded," "Socratic," but nothing in the documented architecture enforces graduated hint escalation with a hard "never repeat a level" rule, and there is no defined limit preventing a learner from reaching bottom-out telling through repeated requests alone. (Ref: Appendix D §3.3, §1.5.)

**Finding:** Per Appendix D §3.3, skilled human and computer tutors alike escalate hints in a graduated ladder specifically to avoid the well-documented "hint abuse" failure mode (repeatedly requesting help to skip cognitive work); absent an explicit ladder object, this behavior is left to per-turn LLM judgment, which Appendix D §3.7 separately documents as prone to giving away answers under plausible-sounding rationale.

**Mandated Requirement:** Implement the hint ladder specified in Appendix D §3.3 as a first-class, independently-tracked dialogue-manager object (pump/re-ask → indirect hint → targeted hint naming the misconception → fill-in-the-blank prompt → assertion/tell), with a hard never-repeat-a-level rule per learner per sub-step, and an explicit, gracefully-honored "just tell me" escape hatch.

**Brand Alignment:** Law 2 — a Mentor that can be talked into skipping the teaching is not modeling the mentor relationship the brand sells.

---

### C.14 — No self-explanation prompt exists as a distinct, quality-checked dialogue move

**Severity:** Medium-High

**Current State:** No documented mechanism requires or checks for a learner articulating their own reasoning after a decision, distinct from simply answering correctly. (Ref: Appendix D §3.3.)

**Finding:** Per Appendix D §3.3, the self-explanation effect is a causally-confirmed, well-replicated learning-gains finding, directly relevant to a financial-literacy product built around decisions ("why did you choose to save rather than spend here?") — but the same research flags that a required prompt can be gamed with low-effort filler absent a quality check.

**Mandated Requirement:** Add a self-explanation prompt as a distinct, named dialogue move triggered after financial-decision points, paired with the lightweight explanation-quality check specified in Appendix D §3.3 (does the response cite the actual relevant concept, or is it filler) — a low-quality response should trigger a targeted follow-up, not silent acceptance.

**Brand Alignment:** Law 4 — reasoning quality, not just correctness, is the standard this document already set for authored grading (B.12); real-time dialogue should meet the same bar.

---

### C.15 — No Working Alliance tracking exists; adaptation-offer declines are not treated as relationship signal

**Severity:** Critical

**Current State:** The adaptation-offer mechanism records accept/decline but nothing downstream treats a pattern of declines as a signal requiring a response; no session-level state tracks whether Mentor and learner ever explicitly agreed on a session's goal, or whether the Mentor referenced anything specific and individual about that learner. (Ref: Appendix D §3.4.)

**Finding:** Appendix D §3.4 identifies the Working Alliance construct — bond, goal agreement, task agreement — as the single most load-bearing, cross-domain-validated predictor of whether any helping relationship (including AI conversational agents, per the Wysa result) produces benefit at all, and flags a pattern of unaddressed adaptation-offer declines as exactly the kind of unnamed bond/task-agreement failure the current architecture has no mechanism to catch.

**Mandated Requirement:** Build an **Alliance Controller** as a sibling component to the pedagogy controller, tracking bond/goals/tasks as explicit, separately-monitorable session state per Appendix D §3.4: instrument goal-agreement as an explicit session-opening move; convert a defined pattern of repeated adaptation declines into a renegotiation trigger rather than silent persistence; require the Mentor to explicitly re-establish bond/goal/task framing whenever a learner sees a different persona or after a session-memory gap, rather than acting falsely familiar.

**Brand Alignment:** This is the single clearest real-time expression of the mentor positioning at the heart of the Cosmic Narrative — a mentor relationship, not a Q&A service.

---

### C.16 — Session closing uses one generic template regardless of how the session actually ended

**Severity:** High

**Current State:** No documented distinction exists between how a session closes when completed normally, when it hits the budget cap mid-task, when the learner silently leaves, or when a safety stop is triggered. (Ref: Appendix D §3.5; `03` Tutor Session.)

**Finding:** Per Appendix D §3.5, the peak-end rule is one of the most robust findings in the applicable literature (a meta-analytic r≈0.58) — how a session ends disproportionately determines how the whole experience is remembered, independent of duration — meaning a single generic closing template is very plausibly the direct mechanism behind the exact "no aprendí nada" bitter-aftertaste outcome the user named as the thing to design against.

**Mandated Requirement:** Build the four distinct closing scripts specified in Appendix D §3.5: a co-constructed recap and specific effort acknowledgment for a normal completion; an explicit acknowledgment of interruption plus a concrete re-entry point for a budget-reached mid-task close; a low-pressure, no-blame re-engagement message queued for a silent-dropout close; and a distinct, non-cheerful design for a safety-stop close that never reuses the standard positive template.

**Brand Alignment:** Directly responsive to the user's explicit design goal for this Block — no session should end in a way that leaves the learner feeling unheard.

---

### C.17 — No age-band-differentiated dialogue calibration for hint pacing or scaffolding style

**Severity:** High

**Current State:** The four mentor personas and the pedagogy controller's strategy selection do not currently vary hint-ladder pacing, scaffolding directness, or autonomy-supportive versus directive language by age tier. (Ref: Appendix D §3.6.)

**Finding:** Appendix D §3.6 documents converging evidence (self-determination theory's autonomy-support findings, adolescent mentoring interviews, scaffolding-development literature) that younger children need more direct, contingent scaffolding while teens respond better to autonomy-supportive, non-controlling language and are more susceptible to reactance from directive phrasing — while honestly flagging that no direct tutoring-specific RCT exists comparing these calibrations in a live AI Mentor.

**Mandated Requirement:** Build age-band-differentiated defaults into the hint-ladder and persona dialogue policies per Appendix D §3.6 (shorter escalation ladders and "let's do this together" framing for younger children; autonomy-supportive language, offered rationale, and a strong bias toward asking before adjusting pacing for teens), explicitly avoiding controlling-language markers ("you need to," "you have to") in the teen register across all four personas. Given the acknowledged absence of a direct evidence base, this must be instrumented as an A/B-tested, directly measured design decision (via the alliance-bond and session-closing telemetry from C.15–C.16), not assumed correct on adoption.

**Brand Alignment:** Extends Block B's age-band-register requirement (B.23) into the real-time conversational surface, closing the gap between authored content and live dialogue.

---

### C.18 — No anti-sycophancy constraint or answer-reveal-rate monitoring exists

**Severity:** Critical

**Current State:** Nothing in the documented architecture constrains the Mentor against affirming a learner's in-scenario financial decision because the learner seems pleased, nor tracks how often the Mentor reveals an answer rather than scaffolding toward it. (Ref: Appendix D §3.7.)

**Finding:** Appendix D §3.7 is unambiguous and directly quantified: general-purpose LLMs asked to tutor rather than solve reveal the solution outright roughly two-thirds of the time and give incorrect feedback on student errors more often than not, and separately, sycophantic responses are rated more favorably by users even when they produce worse outcomes and less accurate self-assessment — meaning the failure mode this item addresses is one the product's own underlying model is measurably prone to by default, not a hypothetical edge case.

**Mandated Requirement:** Add an explicit anti-sycophancy constraint to the Mentor's feedback generation, tying praise to specific, verifiable learner actions rather than generic affirmation, with a hard rule against endorsing a financially unsound in-scenario decision. Build and monitor an answer-reveal-rate metric per session and per persona (per Appendix C's engagement-health metric family), treating an elevated rate as a controller defect requiring investigation, not an acceptable outcome of being "helpful."

**Brand Alignment:** This is the direct, evidence-based justification for the "mentors, not mascots" brand positioning — without this constraint, the underlying model's default behavior actively works against it.

---

### C.19 — No disengagement-watch or repair-initiation capability; the Mentor never checks whether it actually helped

**Severity:** High

**Current State:** Nothing in the current design requires the Mentor to notice and name a possible misunderstanding, nor to check in explicitly when disengagement signals (once built per C.9) fire. (Ref: Appendix D §3.7.)

**Finding:** Appendix D §3.7 documents that in real conversational-AI transcripts, the human user does nearly all of the work of noticing and repairing misunderstanding — the model rarely initiates a "let me check I understood you" move — which is precisely the mechanism by which a learner ends up feeling unheard without the Mentor ever registering that anything went wrong.

**Mandated Requirement:** Add a required Mentor move, triggered when the Behavioral Telemetry Layer (C.9) fires a disengagement signal: an explicit, humble check-in ("I want to make sure I'm actually helping right now — are we on the same page?") rather than continuing the current plan as though nothing happened. This makes repair-initiation the Mentor's responsibility, not the child's.

**Brand Alignment:** Directly responsive to the user's explicit "no me entendió" failure mode — this is the specific mechanism that prevents it from going unnoticed by the system.

---

### C.20 — No bias audit exists for affect-detection or moderation components against dialect, accent, or ASR artifacts

**Severity:** High

**Current State:** No documented process audits any lexical, prosodic, or moderation-adjacent component for differential treatment across dialect, accent, or speech-to-text quality variation. (Ref: Appendix D §1.7.)

**Finding:** Appendix D §1.7 documents specific, named findings of demographic and dialect bias in adjacent technologies — sentiment/toxicity classifiers rating African American English and other dialect forms as more negative than semantically equivalent Standard English, and commercial facial-emotion systems showing analogous racial bias — a direct, foreseeable risk for any text- or voice-based affect signal (C.9) deployed to a demographically diverse population of children who code-switch or use regional forms.

**Mandated Requirement:** Any lexical or prosodic component feeding the Behavioral Telemetry Layer (C.9) or content moderation must be audited against dialect and ASR-artifact variation before release, with a recurring re-audit cadence as the component or its underlying model changes. Per Appendix D §1.7's core design implication, the highest-severity mitigation remains structural — the Mentor never declares an emotional state — but this audit is required in addition to, not instead of, that constraint.

**Brand Alignment:** Law 5 — a mentor whose judgment of a child is quietly less accurate for some children than others is a hidden, unequal promise.

---

### C.21 — No evaluation-and-improvement loop exists for the AI Mentor at all today

**Severity:** High

**Current State:** Changes to the AI Mentor's prompts, pacing rules, and persona behavior currently happen only through manual engineering changes, verified only by whatever ad hoc testing the team performs before release. No continuous, instrumented evaluation of live tutoring transcripts exists. (Ref: Appendix E Part 2.)

**Finding:** This is the starting-point gap behind the product's own original "Harness AI" ambition: before any self-improvement mechanism can exist, a measurement mechanism has to exist first. Appendix E Part 2.3 establishes that in every credible real-world precedent, automated measurement is the foundation the rest of the pipeline is built on, and it is also the lowest-risk, highest-immediate-value piece to build.

**Mandated Requirement:** Build the Tier 3 (fully-automate) capability specified in Appendix E §3.1 first and independently of any deployment-automation work: continuous transcript scoring against a defined rubric, anomaly flagging (spikes in answer-reveal rate, drops in alliance-bond proxy, persona-level disparities), and a reporting dashboard to the human product/pedagogy team. This alone directly answers the user's "cómo saber cuándo algo está fallando" question without requiring any judge-autonomy trust yet.

**Brand Alignment:** Law 4 — a product cannot claim rigorous, nuanced pedagogy without first being able to measure whether it is actually delivering it.

---

### C.22 — No tiered governance model exists to constrain what "self-improvement" is allowed to touch

**Severity:** Critical

**Current State:** No documented policy distinguishes what aspects of the AI Mentor could safely be changed by an automated process from what must always require full human review. (Ref: Appendix E Part 3.)

**Finding:** Appendix E Part 1.2 establishes this is not a hypothetical risk: reward hacking is a well-replicated failure mode of any closed optimization loop, LLM-judge reliability drops sharply on exactly the ambiguous, high-stakes cases that matter most (a child in real distress, a subtle answer-giveaway), and a real, litigated harm case (the Character.AI/Google settlement) plus an active FTC inquiry both concern exactly the pattern of an AI system adapting its behavior toward child users without clear human-gated oversight of what it is optimizing for.

**Mandated Requirement:** Adopt the three-tier governance model specified in Appendix E §3.1 before any automated proposal-generation capability is built: safety-judge and rubric changes and any monetization-adjacent mechanic are never automated; prompt/pacing micro-variants within pre-approved bounds may be proposed automatically but require simulated-student testing, calibrated-judge approval, and human-spot-checked canary rollout before full release; measurement and flagging (C.21) may run fully automatically. No component may be promoted to a more autonomous tier without an explicit, documented decision.

**Brand Alignment:** Directly responsive to the user's own framing — a "re-diseño" moment for this product must build the safety architecture at the same time as the ambition, not after.

---

### C.23 — No calibration process exists for any future automated evaluation judge

**Severity:** High

**Current State:** No process exists today for validating that an automated judge's assessment of tutoring quality agrees with human expert judgment before that judge is trusted for any purpose. (Ref: Appendix E §2.1, §3.2.)

**Finding:** Per Appendix E §2.1 and §3.2, this is the specific mechanism every credible real-world precedent (Khan Academy's described pipeline foremost) uses to make an AI judge trustworthy at all — human panel agreement first, then judge calibration against that panel, then periodic recalibration to catch judge drift — and it is precisely the step a team excited about "self-improving AI" is most likely to skip under time pressure.

**Mandated Requirement:** Before any AI judge is used to gate even a Tier-2 (gated-automate, per C.22) release, it must be calibrated against a human-expert-rated seed set of tutoring transcripts to a defined, documented inter-rater-agreement threshold, and that calibration must be re-run on a defined recurring cadence, not treated as a one-time setup step.

**Brand Alignment:** Law 4 — trusting an uncalibrated judge with real deployment decisions is the automation-era version of grading only for correctness.

---

### C.24 — No monitoring dashboard consolidates the Mentor-quality and engagement-health signals this Block and Appendix C both mandate

**Severity:** Medium-High

**Current State:** Block B (Appendix C) already mandates engagement-health and learning-outcome metrics for authored content; this Block adds answer-reveal rate, alliance-bond proxy, and behavioral-telemetry-derived friction signals for the AI Mentor specifically. No single place is specified where these are meant to converge for the human team responsible for watching them. (Ref: Appendix C Part 1; Appendix E §3.1.)

**Finding:** Per Appendix E §3.1, Tier 3 (fully-automate) monitoring is only useful if a human team actually looks at it; a set of metrics defined across three separate documents with no consolidated view is a real risk of the measurement work in C.21 going unused in practice.

**Mandated Requirement:** Build a single monitoring dashboard, owned by the product/pedagogy team, consolidating Appendix C's engagement-health and learning-outcome metrics with this Block's AI-Mentor-specific signals (answer-reveal rate, alliance-bond proxy, behavioral-telemetry friction rate, content-ladder tier distribution per C.5/C.6), with defined regression thresholds that trigger a named owner's review — not merely a passive display.

**Brand Alignment:** Law 4 — measurement that no one is required to act on is not actually quality assurance.

---

## Block C — Real-Time Interaction Standard: How the AI Mentor Should Decide, Turn by Turn

**Status:** Mandatory architectural standard for the AI Mentor's real-time decision-making, applying alongside the existing pedagogy controller and mastery model. This section operationalizes `10-APPENDIX-D-REALTIME-TUTORING-FRAMEWORK.md` and `10-APPENDIX-E-SELF-IMPROVEMENT-GOVERNANCE.md` into a working architecture. C.9–C.24 above are the individually-tracked mandatory requirements drawn from this research; this section is the synthesized standard those requirements sit inside — the direct answer to the user's original question of how the AI Mentor builds and acts on a real-time psychometric/pedagogical picture of the learner it is speaking to.

### The three new components, and how they feed the existing pedagogy controller

The AI Mentor's existing architecture — a pedagogy controller selecting among 12 strategies from a BKT-based mastery model over a 28-component knowledge graph — remains the decision-making core. Three new components sit alongside it, each owning one dimension of the real-time picture, and each feeding fused signal into the controller's turn-by-turn strategy selection rather than making decisions independently of it:

1. **Behavioral Telemetry Layer** (C.9, C.20) — the friction/affect proxy. Computes response-latency deltas, verbosity deltas, repeated-answer patterns, hedging language, off-topic drift, and gaming-the-system indicators from existing conversational data. Outputs signal *strength*, never a declared emotional state, feeding the adaptation-offer mechanism and the disengagement-watch capability (C.19).

2. **Extended Mastery Engine** (C.10, C.11, C.12) — the existing BKT model plus a corroborating-evidence rule (two consecutive observations before mastery/remediation), the within-session/cross-session spaced-review split, and the behavioral-signature-based session-end signal. Outputs remain interpretable and auditable to a parent, per Appendix D §2.6's explicit design requirement — never a black-box confidence score.

3. **Alliance Controller** (C.15, C.16, C.17) — tracks bond, goal agreement, and task agreement as explicit session state; owns goal-agreement framing at session open, renegotiation triggers on repeated adaptation-offer declines, persona-continuity re-establishment, and the four end-reason-specific closing scripts.

These three components feed a persistent data layer, not only the turn-by-turn controller: the **learner disposition profile** mandated in **C.7** is populated by components 1 (Behavioral Telemetry Layer / C.9) and 3 (Alliance Controller / C.15) — C.7 is not a fourth component alongside these three, but the persistent cross-session record their outputs accumulate into, so a reader should not conclude it was silently dropped from this architecture.

These three components' outputs converge on the pedagogy controller as fused input to each turn's strategy selection (which of the 12 strategies, how much hint-ladder escalation per C.13, whether to trigger a self-explanation prompt per C.14, whether to surface an adaptation offer, whether to recommend closing). The controller's existing 3x/minute strategy-change ceiling remains the governing constraint — the new signal informs *which* strategy is chosen within that ceiling, it does not add new decision velocity.

### Non-negotiable behavioral constraints (apply regardless of which strategy is active)

- The Mentor never issues a declarative claim about the learner's emotional state (C.9/Appendix D §1.7).
- The hint ladder never repeats a level and always honors an explicit "just tell me" request (C.13).
- No mastery or remediation decision executes on a single observation (C.10).
- No closing sequence uses the standard positive template for a safety-stop or unresolved-interruption end-reason (C.16).
- Praise is always tied to a specific, verifiable action; the Mentor never affirms a financially unsound in-scenario decision because the learner seems pleased (C.18).
- A fired disengagement signal always produces an explicit, humble check-in before the current plan continues (C.19).

### Governance boundary (per Appendix E)

Nothing in this architecture is self-modifying in production. The Behavioral Telemetry Layer, Extended Mastery Engine, and Alliance Controller are themselves subject to the Tier 1/2/3 governance model in C.22: their thresholds and weightings may be proposed for adjustment through the gated-automate pipeline (C.23) once built, but the safety-relevant constraints listed above sit in Tier 1 and are never eligible for automated modification.

---

### Block C — Summary of Mandated Changes

| ID | Finding | Severity | Owner decision needed |
|---|---|---|---|
| C.1 | Self-registered accounts default to a mis-calibrated age tier | High | Persist DOB/age-band; add fallback calibration question |
| C.2 | Minors' voice policy keyed on kid role, not real minor status | Critical | Key policy off account-level minor indicator; safe default = restrictive |
| C.3 | AI Mentor moderation fails open for universal-role sessions | Critical | Fail-closed by default unless account confirmed adult |
| C.4 | Memory-note guardian review keyed on kid role, not guardian link | High | Key review off guardian-link; define policy for unlinked teens |
| C.5 | Live-generation judge approval has a fixed, unexamined sampling rate | Medium-High | Dynamic sampling rate; calibrate judge first |
| C.6 | Curated activity-pack tier is structurally empty | Medium | Populate highest-frequency packs to reduce live-generation load |
| C.7 | No real-time learner disposition profile beyond mastery values | High | Build persistent cross-session disposition profile |
| C.8 / C.12 | Session-end uses only hard/soft time caps, no behavioral signal | High | Build behavioral-signature early-warning signal |
| C.9 | No real-time affective/motivational detection layer | Critical | Build Behavioral Telemetry Layer |
| C.10 | Fixed guess/slip risks premature mastery/remediation calls | High | Require corroborating evidence before consequential moves |
| C.11 | No within-session vs. cross-session spaced-review split | Medium-High | Build two-tier review model |
| C.13 | No first-class hint-ladder object; hint-abuse risk unaddressed | High | Build hint ladder as independent dialogue-manager object |
| C.14 | No self-explanation prompt as a distinct, checked dialogue move | Medium-High | Add self-explanation prompt + quality check |
| C.15 | No Working Alliance tracking; declines untreated as signal | Critical | Build Alliance Controller |
| C.16 | Session closing uses one generic template for all end-reasons | High | Build four end-reason-specific closing scripts |
| C.17 | No age-band-differentiated dialogue calibration | High | Build age-band hint/scaffolding defaults; A/B instrument |
| C.18 | No anti-sycophancy constraint or answer-reveal monitoring | Critical | Add constraint + metric; treat elevated rate as a defect |
| C.19 | No disengagement-watch or repair-initiation capability | High | Add required check-in move on fired disengagement signal |
| C.20 | No bias audit for affect/moderation components vs. dialect/ASR | High | Build recurring bias audit |
| C.21 | No evaluation-and-improvement loop exists at all | High | Build Tier 3 continuous measurement/flagging first |
| C.22 | No tiered governance model constrains automated self-improvement | Critical | Adopt Tier 1/2/3 governance model before any automation |
| C.23 | No calibration process exists for any future automated judge | High | Require human-panel calibration before any judge gates a release |
| C.24 | No consolidated monitoring dashboard for Mentor-quality signals | Medium-High | Build single dashboard with owned regression thresholds |

**References:** `10-APPENDIX-D-REALTIME-TUTORING-FRAMEWORK.md` — the complete real-time affect-detection, knowledge-modeling/stopping-rule, and conversational-pedagogy/working-alliance research underlying C.9–C.20 and the Real-Time Interaction Standard above. `10-APPENDIX-E-SELF-IMPROVEMENT-GOVERNANCE.md` — the complete self-improvement/"Harness AI" governance research underlying C.21–C.24 and the governance boundary above. `10-APPENDIX-F-AI-MENTOR-METRICS-QA-PIPELINE.md` — success metrics (real-time pedagogical effectiveness, relational/affective health, safety/governance, and QA/pipeline metrics), the Definition of Done per requirement, the real-time QA and deployment pipeline (including simulated-student adversarial testing and kill-switch governance), and the internal phasing/sequencing of all 24 Block C requirements.

---

## Block D — Family Hub (Family Management, Tasks & Rewards) and Digital Banking

Covers: the Family panel (create/manage children, analytics consent, child territory, Mentor-transcript oversight), Family Hub (chores, evidence photos, approvals, savings goals, the reward catalog, redemptions, chore streaks), and Digital Banking — the platform's explicitly-labeled **educational simulation** (an account, a card, freeze/unfreeze, a scheduled allowance, a savings bonus, spending limits, monthly statements). This is the literal subject-matter domain the product is named after, so per the user's direction this Block received the same order of research depth as Block C: `10-APPENDIX-G-FAMILY-HUB-BANKING-RESEARCH-FRAMEWORK.md` covers financial-socialization theory and the developmental psychology of money, behavioral economics of saving and mental accounting, the contested evidence on whether financial education actually changes behavior, and family-systems/parental-control/ethical-design research. D.1–D.9 are structural findings from the existing architecture (`00` §6; `01` §2.6; `02` sections F, G, H; `03` §6–7; `05` §3, §6; `07`; `08`; `09`); D.10–D.23 formalize Appendix G's design implications.

**A confirmed structural fact worth stating up front, because it shapes how every finding below should be read:** this domain is a genuine closed-loop simulation. LF Coins never convert to real currency, no payment provider or card issuer is integrated (confirmed in `06`), and the product's own brand narrative explicitly positions itself against competitors selling real cards to children ("we refuse to sell the illusion that a card raises a child"). This materially reduces regulatory/financial-harm exposure relative to a real-money product, and the findings below should not be read as implying otherwise — but, per Appendix G, it does not eliminate the risks of gamified-money design generally, and it does introduce its own honesty obligation: nothing in the simulation may visually or functionally imply a real financial control it cannot back up.

### D.1 — Card freeze is recorded but not enforced

**Severity:** Critical

**Current State:** The child UI states that freezing the card "blocks new redemption requests." No server-side rule checks the frozen state — redemptions, allocations, and scheduled allowances all continue unaffected while a card is frozen. A child can also unfreeze an account a parent froze. This is confirmed as a current-state fact by the audit itself. (Ref: `00` §6.3; `02` H4; `03` §7.1.)

**Finding:** This is likely the single most serious finding in this Block. A parent who freezes a child's card is exercising the platform's most visible, most "emergency-feeling" control mechanism, and reasonably believes it stops something. It stops nothing. Per Appendix G §2.5, a cosmetic commitment device is worse than no device at all: the entire behavioral-economics rationale for a freeze feature depends on the restriction being real and credible, and a fake lock both provides none of the genuine self-control value the literature attributes to real commitment devices and creates a foreseeable trust rupture once discovered — independent of any pedagogical debate, this is a plain broken promise about "verified parental control."

**Mandated Requirement:** Implement real server-side enforcement: while a card is frozen, redemption requests must be rejected, and pending allocations/allowance splits must be held rather than processed. A child must not be able to unilaterally unfreeze an account a parent froze; only a parent (or the child, for a child-initiated freeze) may reverse their own action. This must ship before any other Block D work is marketed as complete, given its direct bearing on the platform's core safety promise.

**Brand Alignment:** Pillar 5 and Law 5 — a control that visibly signals "active" while functionally doing nothing is the same category of broken promise as the FAQ gaps in A.1, applied to money.

---

### D.2 — Chore streak reuses the all-or-nothing arithmetic just mandated for correction in learning streaks

**Severity:** Medium-High

**Current State:** The Chore Streak entity uses "the same streak arithmetic as the learning streak" (Ref: `03` §6.6) — meaning it inherits the identical all-or-nothing, one-missed-day-resets-to-zero design that B.21 already found to contradict real habit-formation science and mandated replacing with a lapse-tolerant model. Chore Streak is a separate stored entity; B.21's requirement was scoped to the learning domain and was never extended here.

**Finding:** The same psychological concern B.21 raised — loss-aversion-driven anxiety rather than genuine habit reinforcement — applies with equal force to a chore streak, arguably more so, since a missed chore day can result from ordinary family circumstances (travel, illness, a busy week) entirely outside the child's control, making an all-or-nothing reset feel more arbitrary and less earned than a missed lesson day.

**Mandated Requirement:** Extend B.21's lapse-tolerant streak model (or an equivalent mechanism) to the Chore Streak entity. This is not a new design problem to solve — it is the same fix already specified for Block B, applied to a second entity that was missed.

**Brand Alignment:** Law 3 — celebrating patience and consistency, not penalizing an ordinary missed day, extended consistently across every streak mechanic in the product.

---

### D.3 — Self-registered teens are completely excluded from Family Hub and Digital Banking

**Severity:** Critical — confirmed by the owner (OD-3, Option B; `13-OWNER-DECISION-LOG.md`, section 7)

**Current State:** Both Tasks and Digital Banking show as locked (🔒) for the universal role, meaning a self-registered 13–17-year-old — who holds only the universal role per A.3/A.4 — cannot access chores, rewards, savings goals, or the banking simulation under any circumstance, regardless of actual age or maturity. These features are only reachable through an account a parent explicitly creates via the Family panel. (Ref: `05` §3.)

**Finding:** This is the mirror image of the "kid role ≠ minor" safety gaps found elsewhere in this document: here, the same role-based gate produces a product-access exclusion rather than a safety hole. It directly contradicts the brand's own narrative, which explicitly uses a self-directed 16-year-old ("they've made money, not just been given it") as an aspirational example of what the product enables — a population its own access rules currently bar entirely. Appendix G §4.3 identifies this as the single sharpest contradiction found anywhere in this research between the product's stated mission and its actual design: every framework reviewed (the CFPB's Building Blocks model, the general graduated-autonomy literature) identifies the 13–17 band as the population that most needs supported independent financial practice, and it is the population this product currently serves worst.

**Mandated Requirement:** Build a genuinely independent mode for self-registered teens, redesigned around self-direction rather than parent-approval, since a self-registered teen by definition has no guardian counterpart to approve anything. Concretely: self-declared **income entries** (allowance received elsewhere, gig income, gifts) that the teen logs and immediately allocates across Save/Spend/Share with no approval step; self-directed Savings Goals exactly as in the managed model; and a personal reward-tracking mechanism the teen defines and marks for themselves in place of a parent-curated Reward Catalog, since no parent exists to curate one. If and when the teen later invites a guardian to link (optional, teen-initiated, never mandatory), the account must be able to layer the existing chore/approval/reward-catalog mechanics on top of this foundation rather than requiring a full migration between two incompatible systems. This does not require abandoning the parent-managed model for accounts a parent created — it requires the two paths to coexist and to be mergeable later.

**Brand Alignment:** Pillar 1 ("we teach judgment, not transactions") — a product that locks its most autonomy-ready users out of practicing judgment cannot claim this positioning without qualification.

---

### D.4 — Data-layer writes bypass the API's state-machine rules

**Severity:** High

**Current State:** The audit confirms the data store's row-level rules permit certain parties to write directly to chores, savings goals, redemptions, and banking accounts through the public data gateway, bypassing the state transitions and validation the Core API enforces (photo-required-before-approval, balance-checked-before-redemption-approval, and so on). Wallet ledger entries themselves — the actual movement of LF Coins — remain service-only and are not exposed to this gap. (Ref: `00` §6.10.)

**Finding:** Even though the money-movement ledger is protected, the surrounding trust-critical fields are not: a technically capable party could directly set a task to "approved" without ever going through parent review, or manipulate a redemption's status, defeating the entire point of "the parent decides" even where it cannot directly manufacture LF Coins. This is a data-integrity gap adjacent to, but distinct from, the freeze issue in D.1 — both are cases where a stated control is not actually backed by enforcement.

**Mandated Requirement:** Extend row-level access rules so that state-transition fields on Task, Savings Goal, Redemption Request, and Banking Account records are as protected as wallet ledger entries already are — writable only through the service layer that enforces the associated business rules, not directly through the data gateway.

**Brand Alignment:** Pillar 5 — "verified parental control" requires that the parent's decision is the only path to a state change, not one of several.

---

### D.5 — A recurring pattern of half-built lifecycle states specific to this domain

**Severity:** Medium

**Current State:** The audit documents several declared-but-unused states in this Block specifically: the "fulfilled" redemption status is never set by any flow; the "goal withdrawal" and "manual adjustment" wallet-ledger reasons are permitted but produced by no flow; the guardian-link states "pending," "rejected" and "revoked" are never produced; the `task_view` analytics event has no emitter. (Ref: `00` §6.6; `03` §6, §9.2; `07`.)

**Finding:** No single instance here is severe on its own, but the pattern indicates this domain was scaffolded with more lifecycle richness than was ever wired up end-to-end — the same category of gap already flagged generally in the audit (`00` §6.6) and specifically relevant to the Definition-of-Done discipline this document series has built for every other Block.

**Mandated Requirement:** For each declared-but-unused state, product and engineering must jointly decide, before further Block D work ships: build the missing flow that produces it, or remove the unused state from the schema. No new Block D feature may declare a lifecycle state without a corresponding flow that produces and consumes it, per the general Definition-of-Done principle already established in Appendices C and F.

**Brand Alignment:** Law 5 — an unused "fulfilled" state or an ungrantable "second guardian" link (echoing A.1's FAQ gap) is a small-scale version of the same "promise without a working feature behind it" problem.

---

### D.6 — Family-engagement staff insight is broken

**Severity:** Medium

**Current State:** The family-engagement view was redefined to be per-child, but the staff endpoint that serves it still expects the earlier per-family shape and answers "Family views unreachable." (Ref: `00` §6.2; `07`.)

**Finding:** This is internal tooling, not user-facing, but it means the product team currently has no visibility into this Block's own engagement health — precisely the blind spot the metrics discipline built for every other Block (Appendices C and F) exists to prevent.

**Mandated Requirement:** Fix the staff endpoint to match the per-child data shape, and treat this as a prerequisite for the Block D metrics work in Appendix H — a metrics framework is only as useful as the staff tooling that surfaces it.

**Brand Alignment:** Law 4 — a product cannot claim rigor about a domain it cannot currently see.

---

### D.7 — Realistic simulation visuals risk implying a real financial control the product cannot back up

**Severity:** High

**Current State:** Digital Banking presents a named account, a designed card with a display card number, and a "Frozen" badge with attribution ("You froze this card" / "A parent froze this card") — visual fidelity deliberately close to a real banking product, despite being an explicitly-labeled simulation. Combined with D.1, the freeze badge currently displays as functionally active while doing nothing.

**Finding:** This compounds D.1 rather than duplicating it: the fix for D.1 is enforcement; the concern here is presentation. The brand's own narrative explicitly criticizes competitors for selling "the illusion of managed control" — a realistic-looking card and account UI, paired with any control that isn't fully backed by enforcement, risks the platform committing exactly the failure it accuses competitors of, regardless of intent.

**Mandated Requirement:** Adopt a standing design principle for this whole surface: no visual element or copy in Digital Banking may imply a guarantee the underlying system does not enforce. As each control (starting with freeze, per D.1) is made functionally real, this principle should be re-verified against it, not assumed satisfied once the backend is fixed.

**Brand Alignment:** Law 5 — the fix is not only technical; the presentation must never outrun what the system actually does.

---

### D.8 — No tone/content gate exists for Family Hub and Digital Banking's transactional copy

**Severity:** Medium-High

**Current State:** Forge's tone gate (B.14) audits lesson content for "bank voice" language. No equivalent gate exists for the system copy in this Block — redemption denial messages, spending-limit-exceeded messages, freeze/unfreeze notifications, allowance-arrival messages — even though these are exactly the moments of monetary friction where Law 2 ("speak like a mentor, never like a bank") is easiest to violate by accident.

**Finding:** The existing copy sampled in the audit (e.g., "They no longer have enough LF Coins for this," "This would go over the weekly/monthly spending limit") reads as reasonably warm already, but nothing systematically verifies this as the product grows, and no gate exists to catch a regression as new copy is added by different engineers over time.

**Mandated Requirement:** Extend the Forge tone gate (B.14) or an equivalent review step to cover all system-generated copy in Family Hub and Digital Banking, with the same "no bank register" standard already defined for lesson content.

**Brand Alignment:** Law 2, applied to the domain where it is most tempting to slip into transactional language by default.

---

### D.9 — No pedagogical or developmental-psychology research foundation existed for this domain's core design choices before this review

**Severity:** High (resolved by this review's research; retained as the item establishing why D.10–D.23 exist)

**Current State:** Prior to this Block's research pass, none of the core design choices in this domain — the mandatory three-way split, the chore-for-currency model, the percentage-based savings bonus, the uniform mechanics across all ages, the approval-gated design — had a documented research basis, unlike Block B (Appendix B) or Block C (Appendix D).

**Finding:** Because this domain is the literal subject matter the product is named after, this gap was, in this review's judgment, at least as consequential as the AI Mentor's real-time gap addressed in Block C — which is why the user directed the same depth of research be applied here. `10-APPENDIX-G-FAMILY-HUB-BANKING-RESEARCH-FRAMEWORK.md` now provides that foundation.

**Mandated Requirement:** Treat Appendix G as the authoritative basis for D.10 onward, and revisit it on the same recalibration cadence as Appendices B and D as new research emerges or as the product's own data accumulates (Appendix G explicitly flags several places — most importantly, whether childhood practice actually causes better adult outcomes — where LittleFounders is positioned to generate evidence the field currently lacks).

**Brand Alignment:** Law 4 — the product's central subject matter deserves the same evidentiary rigor as its lesson design and its AI Mentor.

---

### D.10 — No distinction between expected family contribution and paid bonus tasks

**Severity:** Medium

**Current State:** Every chore a parent assigns is paid in LF Coins through the same undifferentiated "Tasks" flow, with no mechanism distinguishing baseline family contribution (making one's bed, clearing a plate) from extraordinary or optional tasks (washing the car, yard work). (Ref: Appendix G §1.2.)

**Finding:** Appendix G §1.2 documents a real, unsettled expert debate (Lieber's influential "pay for extraordinary tasks, not ordinary contribution" position) backed indirectly by the general overjustification literature, though no direct controlled study of paid-versus-unpaid children's chores exists. This is a considered values choice the product currently makes implicitly (monetizing all household participation) rather than deliberately.

**Mandated Requirement:** Let parents tag a chore as "expected contribution" (unpaid or nominal) versus "bonus task" (paid at the assigned rate), rather than presenting one undifferentiated paid-chore flow. Present this as a deliberate design option to families, not a scientifically mandated ratio, since the evidence does not compel a specific answer.

**Brand Alignment:** Pillar 1 — teaching that all family participation is transactional cuts against "judgment, not transactions" more directly than any other single mechanic in this Block.

---

### D.11 — The Savings Bonus Rule is framed in a way most users cannot meaningfully understand, and risks reading as arbitrary "free money"

**Severity:** High

**Current State:** The Savings Bonus Rule applies uniformly across all ages: a parent-configured 0–20% rate, credited weekly against the current Save balance, labeled honestly as "a bonus your family adds... not a bank interest rate." (Ref: `03` §7.3; `02` H2; Appendix G §1.5, §2.4.)

**Finding:** Appendix G §2.4 shows that even adults systematically misjudge exponential/compound growth (Stango & Zinman's well-documented "exponential growth bias"), and that genuine proportional/rate-based reasoning is not reliably available before early-to-mid adolescence (Ebersbach et al.). For LittleFounders' younger users, a percentage-based weekly bonus is very likely experienced as unpredictable, arbitrary positive reinforcement rather than an intuition-building lesson — while simultaneously carrying the general overjustification risk (Appendix G §1.3, §2.4) of attaching an extrinsic reward to the very behavior (saving) the product wants to become intrinsically valued.

**Mandated Requirement:** Replace the uniform percentage framing for younger age tiers with a small, fixed, concretely-explained bonus ("for every 10 coins you keep saved, get 1 more each week" — proposed starting ratio, to be tracked in Appendix H's Threshold Recalibration Log alongside the age-band framing cutoffs); reserve percentage-based framing — ideally paired with an explicit worked-example teaching moment — for the 13–17 age tier, where the concept becomes pedagogically reachable per Appendix G §1.5.

**Brand Alignment:** Law 4 — a mechanic whose own honest disclaimer ("not interest") is more sophisticated than the age band it's shown to can understand is not meeting the reasoning-quality bar this document has held every other domain to.

---

### D.12 — No age-differentiated presentation exists anywhere in Family Hub or Digital Banking

**Severity:** High

**Current State:** The same mechanic set — chore range, goal range, split requirement, spending-limit structure, and (per D.11) bonus framing — is presented identically across the full 6-to-17 age span this product serves. (Ref: Appendix G §1.5.)

**Finding:** This is the Family Hub/Banking analog of the gap Block B closed with B.23 for lesson content: Appendix G §1.5's developmental-cognition research (Berti & Bombi; Furnham) shows children's understanding of money concepts moves through well-documented, discrete stages (quantity-value conflation before ~6–7; denomination/change integration from ~7; institutional banking understanding from ~10–11; profit/markup from ~11+), meaning the same screen and the same numeric framing cannot be equally legible across this age range. D.11's fixed-bonus replacement for younger tiers is a specific instance of this general age-differentiation mandate, not a separate, potentially conflicting effort — the two must be implemented as one coherent age-band design.

**Mandated Requirement:** Extend B.23's age-band register work to Family Hub and Digital Banking: differentiate presentation complexity, numeric framing (see D.11), and explanatory copy by age tier, using the same three-register structure (young child / tween-teen transition / teen) already defined for lesson content, plus the teen-specific independence considerations from D.3 and D.17.

**Brand Alignment:** Consistent, direct extension of B.23's brand-alignment rationale to this Block.

---

### D.13 — The mandatory, rigid three-way split is an untested design variant with a documented rigidity risk

**Severity:** Medium

**Current State:** Every chore or allowance reward must be split across Save/Spend/Share summing exactly to the total, with no learner discretion over ratios and no flexibility mechanism. (Ref: `03` §6.2; `02` G4; Appendix G §2.1.)

**Finding:** Appendix G §2.1 shows mental-accounting/earmarking effects are strongest when the categories are self-imposed, not externally mandated on every single transaction — Heath & Soll's rigidity research predicts a large Spend-bucket balance (e.g., right after an allowance credit) can license impulsive redemption, while a system-mandated split with no discretion risks becoming rote or provoking reactance rather than delivering the self-control benefit the mental-accounting literature documents for voluntary labeling.

**Mandated Requirement:** Instrument redemption requests against time-since-last-credit to test whether allowance credits specifically predict impulsive-redemption spikes (a direct, falsifiable prediction from this research). Mandate a recommended-default split with an easy override, preserving the self-imposed quality the literature says matters, as the design to ship, unless product explicitly documents a rationale for the compulsory alternative — silence on this decision resolves to the recommended-default design, not to an open question.

**Brand Alignment:** Law 4 — a mechanic borrowed from real behavioral-economics research should be implemented in the form the research actually supports, not a stricter, untested variant of it.

---

### D.14 — The "Share" bucket has no stated real-world redemption path

**Severity:** Medium

**Current State:** Save routes to goals and Spend routes to the reward catalog; the documented mechanics describe no equivalent destination for the Share bucket. (Ref: `03` §6; Appendix G §1.4.)

**Finding:** Appendix G §1.4 flags this directly: if "Share" money doesn't visibly go anywhere meaningful, the label risks being symbolic rather than operative — and, per the environmental-trust research in Appendix G §1.3, a label that doesn't cash out in a real, felt outcome is exactly the kind of unreliability that can rationally teach a child not to trust the system's other labels either.

**Mandated Requirement:** Define and build a real destination for Share-bucket contributions (for example, a family-chosen charitable or gift-giving action the child can see actually happen), so all three buckets have equally real consequences.

**Brand Alignment:** Law 5 — a bucket whose destination is invisible is a small-scale version of the "promise without a feature behind it" pattern this document has flagged repeatedly.

---

### D.15 — No mitigation exists for the documented post-goal "motivation cliff"

**Severity:** Medium-High

**Current State:** A Savings Goal flips to "reached" automatically and becomes shareable as a badge; nothing in the documented flow prompts a next goal at that moment. (Ref: `02` G5; Appendix G §2.3.)

**Finding:** Appendix G §2.3 documents "postreward resetting" as a replicated finding, not a hypothetical risk: motivation to continue saving reliably drops immediately after a goal is achieved, before (if at all) reaccelerating toward a new one. The badge-sharing moment, designed to feel like a peak, is exactly the point this research predicts a measurable saving slump begins.

**Mandated Requirement:** Prompt "what's your next goal?" at or immediately after the celebration moment, before the child disengages; instrument Save-bucket contribution rate in the 1–2 weeks following a goal completion as a direct, falsifiable test of this mechanism in LittleFounders' own population.

**Brand Alignment:** Law 3 — celebrating a reached goal should be the start of the next chapter, not an unscaffolded stopping point.

---

### D.16 — No safeguard against illusionary/padded goal-progress visualization

**Severity:** Medium

**Current State:** Savings Goal progress is described as "the sum of Save-bucket entries tagged to the goal" — which would include any Savings Bonus credit as well as chore/allowance contributions, with no documented distinction in the progress visualization. (Ref: `03` §6.3; Appendix G §2.3.)

**Finding:** Appendix G §2.3 documents "illusionary goal progress" (padded starting credit accelerating perceived completion) as a recognized commercial dark-pattern precedent. If a parent-added bonus is folded into a goal's progress bar without visual distinction from the child's own contributions, the product risks replicating this manipulation, even unintentionally.

**Mandated Requirement:** Visually distinguish bonus-sourced credit from the child's own chore/allowance-sourced contributions within any goal-progress display, so progress always accurately reflects what portion the child actually earned toward it.

**Brand Alignment:** Law 3 — the product celebrates "the quality of a choice," which requires the child (and parent) to be able to see which progress was actually chosen and earned.

---

### D.17 — No graduated-autonomy model exists within the parent-managed system itself

**Severity:** Critical

**Current State:** Approval-gating on chores, redemptions, and spending appears structurally identical for an 8-year-old and a 17-year-old parent-managed account. Nothing fades with age or with an accumulated track record of sound decisions. (Ref: `05` §3; Appendix G §4.1, §4.3.)

**Finding:** This is, per Appendix G §4.3, the sharpest misalignment identified anywhere in this research between the product's stated mission and its actual design — distinct from D.3 (which addresses the population excluded entirely) because this finding addresses the population the product does serve, but without the fading independence every graduated-autonomy framework reviewed (the CFPB's Building Blocks model, Beyers et al.'s developmental data, Lieber's practitioner consensus) recommends. Appendix G §2.5 additionally shows the relevant meta-analytic evidence does not support automatic age-based fading of parental structure on behavioral-economics grounds alone — this must be a deliberate product/ethics decision, not an assumption.

**Mandated Requirement:** Build an explicit independence-tier system tied to age and/or an accumulated track record of approved requests: rising pre-approved spending thresholds below which no parent tap is required, self-directed chore logging with post-hoc rather than pre-hoc confirmation at higher tiers, and a child-voice mechanism (per D.18) at every tier below full independence.

**Brand Alignment:** Pillar 1 — the product's entire differentiation rests on building judgment rather than managing money; a flat control structure across a nine-year age range does not deliver on that claim.

---

### D.18 — The approval/denial flow has no rationale requirement and no communication scaffolding

**Severity:** High

**Current State:** A parent can deny a chore or a redemption with only an optional, short reason (up to 240 characters); the audit describes no other structure for the approval interaction. (Ref: `02` G3, G6; Appendix G §4.2, §4.5.)

**Finding:** Appendix G converges two independent literatures on this exact design point: the financial-communication research (LeBaron-Black's program) shows child-initiated, reciprocal dialogue — not a one-way verdict — is what predicts good financial-socialization outcomes, and the general parental-monitoring/disclosure research (Stattin & Kerr's reinterpretation) shows that unexplained control-type interactions are a leading indicator of reduced future disclosure and relationship erosion. A tap-to-approve/deny workflow is structurally the least reciprocal format possible, and risks becoming the family's substitute for real financial conversation rather than a prompt for it.

**Mandated Requirement:** Make the denial-reason field mandatory and specific enough to act on (not just "not now"); surface the child's own stated reasoning to the parent at decision time, not just the bare request; add a lightweight "talk about it" nudge after a defined pattern of repeated denials.

**Brand Alignment:** Law 3 — mentoring rather than punishing requires naming what happened and why, exactly as this document already requires for lesson feedback (B.26), now extended to real financial decisions.

---

### D.19 — No designed bridge exists from the sealed virtual simulation to real financial decisions as children age

**Severity:** High

**Current State:** LF Coins never convert to real currency at any point in the documented mechanics, for any age tier; there is no transition mechanism as a user ages toward adulthood. (Ref: Appendix G §3.1, §3.3.)

**Finding:** Appendix G §3.1 and §3.3 identify this as a genuine structural risk, not just a missed opportunity: the "just-in-time" financial-education literature (Fernandes, Lynch & Netemeyer's own policy recommendation) finds education delivered close to a real decision outperforms education delivered long before it with no reinforcement, and Sherraden's financial-capability framework notes a pure simulation can build the "ability" half of capability but not the "opportunity to act" half, since it provides no access to real financial products or institutions.

**Mandated Requirement:** Design an explicit, age-gated transition path for older teens — for example, optional real-world linkage or a structured "graduation" curriculum timed to a teen's first real income or first real account — rather than leaving the simulation permanently sealed off from the real decisions it is meant to prepare a user for. This is a multi-year product initiative, not a single engineering fix, and should be scoped and sequenced accordingly (see Appendix H). It must be scoped by product within two quarters of this document's approval as a named initiative with an explicit first milestone; until scoped, it remains a tracked, owned open decision, not an indefinitely deferred one.

**Brand Alignment:** Pillar 1 — practice that never connects to the real decision it's rehearsing for is a weaker version of "living with the consequences" than the brand's own positioning claims.

---

### D.20 — The product does not attempt, and does not disclose that it does not attempt, credit, debt, risk, or true compounding

**Severity:** Medium

**Current State:** The documented mechanics contain no borrowing, no risk/insurance concept, and (per D.11) no mechanic that actually teaches exponential compounding as opposed to a flat or arbitrary-feeling bonus.

**Finding:** Appendix G §3.5 identifies credit/debt behavior and true exponential-growth understanding as the concepts financial education is most reliably shown to fail at moving, or even to move adversely (the Brazil RCT found a financial-education program increased both saving and borrowing simultaneously) — meaning LittleFounders' choice not to attempt these is defensible, but should be a stated scope decision, not a silent gap a parent might reasonably assume is covered given the "financial literacy" positioning.

**Mandated Requirement:** State plainly, in parent-facing material, what the simulation does and does not teach — explicitly naming credit, debt, and real compound interest as concepts outside its current scope — rather than allowing "financial literacy" framing to imply broader coverage than the mechanics provide.

**Brand Alignment:** Law 5 — transparency about what the product does not do is as much a part of "transparency is love" as transparency about what it does.

---

### D.21 — No documented data-retention or consent policy specific to this Block's behavioral data

**Severity:** Medium-High

**Current State:** This domain generates a rich record of a minor's chore-completion history, a parent's approval/denial decisions and stated reasons, spending-limit configuration, and freeze-state signals. No retention or third-party-sharing policy specific to this data was found in the documented mechanics beyond the platform's general practices.

**Finding:** Appendix G §4.6 notes the FTC's 2025 COPPA amendments add data-minimization and disclosed-retention requirements, and that state-level design-code laws extending protection to the 13–17 band remain in active, unsettled litigation — meaning "no real money moves" is not a complete shield, since these frameworks attach to behavioral and family-relationship data regardless of whether currency is real.

**Mandated Requirement:** Establish and publish a written retention/deletion policy specifically covering Family Hub and Digital Banking behavioral data (chore history, approval/denial reasons, spending configuration), proactively rather than reactively, ahead of full clarity on the amended COPPA rule's implementation timeline.

**Brand Alignment:** Law 5 — get ahead of a transparency obligation rather than waiting for regulatory clarity to force it.

---

### D.22 — The product has no mechanism to test its own central causal hypothesis

**Severity:** Medium

**Current State:** No longitudinal research instrumentation exists to test whether LittleFounders' core theory of change — that practicing Save/Spend/Share and chore-based earning as a child produces better adult financial behavior — actually holds for its own users over time.

**Finding:** Appendix G §3.6 states plainly that this causal chain is not demonstrated by any study in the literature, retrospective or otherwise, and that LittleFounders is unusually well-positioned to generate genuine evidence the field currently lacks, given a sustained, multi-year user relationship no existing study has been able to track with real behavioral data.

**Mandated Requirement:** Design a long-horizon, privacy-respecting research instrumentation plan (in coordination with the retention policy in D.21) capable of eventually testing this hypothesis against the company's own longitudinal data, framed internally as an open question the company is testing, not a proven mechanism it is already delivering. This must be scoped by a named product/research owner within two quarters of this document's approval, at minimum producing a scope document with a defined timeline for the first phase of instrumentation, even though the research plan itself is necessarily long-horizon.

**Brand Alignment:** Law 4 — the intellectual honesty this entire document series has insisted on applies with the most force to the product's own foundational claim about itself.

---

### D.23 — No parent-facing coaching content exists for how to use Family Hub and Digital Banking well

**Severity:** Medium-High

**Current State:** Parents currently receive no guidance beyond the mechanics themselves — no help pricing a chore, no support in explaining a denial well, no visibility into how their own visible money behavior inside the app shapes the child's learning.

**Finding:** Appendix G §1.1 (Gudmunson & Danes' financial-socialization model) finds that unintentional/implicit socialization — how a parent visibly handles money in the family's presence — carries comparable weight to any purposive mechanic the app provides, and explicitly recommends investing in parent-facing coaching content as at least as valuable as child-facing feature polish. Appendix G §4.2 adds a specific, concrete lever not yet captured elsewhere in this Block: prompting the parent with a brief reflective question ("what would you tell your kid about this decision?") at the moment of approval or denial — distinct from, and additional to, D.18's requirement that the reason given *to the child* be mandatory and actionable.

**Mandated Requirement:** Build parent-facing coaching content integrated directly into the Family panel and the Tasks/Banking control surfaces: guidance on chore pricing and on distinguishing expected contribution from bonus tasks (D.10); a brief reflective prompt to the parent at the moment of approval/denial, prior to and separate from the reason recorded for the child; and periodic, unobtrusive parent-facing tips — proposed cadence: monthly — sourced from Appendix G's specific findings and reviewed by the Pedagogical Lead before send. This treats the parent, not only the child, as a design surface this Block is responsible for.

**Brand Alignment:** Law 1 — the brand's own narrative names the parent as "the hero" and explicitly acknowledges parents need support having these conversations well; this closes the gap between that stated intent and the current parent-facing product surface, which today offers controls but no coaching.

---

## Block D — Real-World Money Practice Standard: How Family Hub and Digital Banking Should Actually Work

**Status:** Mandatory design standard for Family Management, Family Hub, and Digital Banking, applying alongside the existing chore/wallet/banking architecture. This section operationalizes `10-APPENDIX-G-FAMILY-HUB-BANKING-RESEARCH-FRAMEWORK.md` into a working architecture, the same way Block B's Pedagogical Design Standard and Block C's Real-Time Interaction Standard operationalized their appendices. D.1–D.23 above are the individually-tracked mandatory requirements; this section is the synthesized standard those requirements sit inside.

### The five components of the standard

1. **Structural Integrity & Honesty Layer** (D.1, D.4, D.7, D.8, D.20) — every control the product displays (freeze, spending limit, approval state) must be genuinely enforced end-to-end, from the data layer up through the visual presentation; no copy or visual may imply a guarantee the system does not back; and the product must state plainly what it does not attempt (credit, debt, real compounding) rather than let "financial literacy" framing imply broader coverage.

2. **Age-Banded Money Mechanics** (D.10, D.11, D.12, D.16) — chore-type tagging (contribution vs. bonus task), numeric framing of the savings bonus, and overall presentation complexity must differentiate by the same three-register structure Block B established (young child / tween-teen transition / teen), with any bonus credit visually distinguished from the child's own earned contributions in every progress display.

3. **Graduated Autonomy Ladder** (D.3, D.17) — independence must fade in by age and track record within the parent-managed system (rising pre-approved thresholds, post-hoc rather than pre-hoc confirmation at higher tiers), and a genuinely independent, non-family-linked mode must exist for self-registered teens rather than the current all-or-nothing exclusion.

4. **Trust & Communication Layer** (D.2, D.14, D.15, D.18, D.23) — every denial carries a mandatory, actionable reason; every bucket (including Share) has a real, visible destination; every reached goal is met with an immediate next-step prompt rather than left as an unscaffolded stopping point; every streak mechanic in this domain uses the same lapse-tolerant model as the rest of the product; and parents themselves receive coaching content and a reflective prompt at the moment of decision, not just controls.

5. **Real-World Bridge** (D.19, D.22) — an explicit, age-gated transition path from the sealed simulation toward real financial decisions as teens age, paired with the longitudinal research instrumentation needed to actually learn whether the whole model works, rather than assuming it does.

### Non-negotiable behavioral constraints (apply regardless of which component is active)

- No control (freeze, spending limit, approval gate) may be presented as active unless it is functionally enforced (D.1, D.7).
- No lifecycle state may be declared without a corresponding flow that produces and consumes it (D.5).
- No chore, redemption, or banking-account state may be reachable through a path that bypasses parent-driven business rules (D.4).
- No denial may be issued without an actionable reason (D.18).
- No goal-progress display may combine earned and bonus-sourced credit without visual distinction (D.16).

### Part 4 governance boundary (per Appendix G's own honesty note)

None of the mechanics in this Block should be marketed as scientifically proven. Per Appendix G's closing note, the product's core design choices are theoretically coherent and consistent with adjacent research, not directly validated for this exact context — internal and external communication about this Block should reflect that honestly, consistent with the standard already set for Blocks B and C.

---

### Block D — Summary of Mandated Changes

| ID | Finding | Severity | Owner decision needed |
|---|---|---|---|
| D.1 | Card freeze is recorded but not enforced | Critical | Add real server-side enforcement; restrict who can unfreeze |
| D.2 | Chore streak uses the same all-or-nothing arithmetic B.21 already mandated fixing | Medium-High | Extend B.21's lapse-tolerant model to Chore Streak |
| D.3 | Self-registered teens fully excluded from Family Hub/Banking | Critical | Build an independent, non-family-linked personal wallet for teens (OD-3, Option B); Tasks and parent approvals stay guardian-only |
| D.4 | Data-layer writes bypass API state-machine rules | High | Lock down row-level rules for chores/goals/redemptions/banking |
| D.5 | Pattern of half-built lifecycle states specific to this domain | Medium | Build or remove each declared-but-unused state |
| D.6 | Family-engagement staff insight is broken (schema mismatch) | Medium | Fix the staff endpoint to the per-child shape |
| D.7 | Realistic simulation visuals risk implying real control that doesn't exist | High | Adopt and audit a no-unbacked-guarantee design principle |
| D.8 | No tone gate for Family Hub/Banking transactional copy | Medium-High | Extend the Forge tone gate (B.14) to this domain |
| D.9 | No research foundation existed for this domain before this review | High (resolved) | Adopt Appendix G as authoritative; recalibrate on the same cadence as Appendix B/D |
| D.10 | No distinction between expected contribution and paid bonus tasks | Medium | Add a chore-tagging mechanism |
| D.11 | Savings Bonus framing is incomprehensible to younger tiers, risks feeling arbitrary | High | Replace percentage framing with fixed-amount for younger tiers |
| D.12 | No age-differentiated presentation anywhere in this domain | High | Extend B.23's age-band registers to Family Hub/Banking |
| D.13 | Mandatory rigid three-way split is an untested, stricter-than-evidenced variant | Medium | Instrument for impulsive-redemption spikes; consider default-with-override |
| D.14 | "Share" bucket has no real-world redemption path | Medium | Build a real destination for Share contributions |
| D.15 | No mitigation for the documented post-goal motivation cliff | Medium-High | Prompt a next goal at the celebration moment; instrument the effect |
| D.16 | No safeguard against illusionary/padded goal-progress visualization | Medium | Visually distinguish bonus credit from earned contributions |
| D.17 | No graduated-autonomy model within the parent-managed system | Critical | Build an independence-tier system with fading approval requirements |
| D.18 | Approval/denial flow has no rationale requirement or communication scaffolding | High | Make denial reasons mandatory and actionable; surface child's reasoning |
| D.19 | No bridge from the sealed simulation to real financial decisions | High | Design an age-gated transition path for older teens |
| D.20 | No disclosure of what the product does not teach (credit, debt, real compounding) | Medium | Publish an explicit scope statement in parent-facing material |
| D.21 | No documented retention/consent policy for this Block's behavioral data | Medium-High | Publish a written retention/deletion policy |
| D.22 | No mechanism to test the product's own central causal hypothesis | Medium | Design long-horizon, privacy-respecting research instrumentation |
| D.23 | No parent-facing coaching content exists | Medium-High | Build coaching content + a reflective prompt at approval/denial |

**References:** `10-APPENDIX-G-FAMILY-HUB-BANKING-RESEARCH-FRAMEWORK.md` — the complete financial-socialization/developmental-psychology, behavioral-economics, financial-education program-evaluation, and family-systems/ethical-design research underlying D.10–D.23 and the Real-World Money Practice Standard above. `10-APPENDIX-H-FAMILY-HUB-BANKING-METRICS-QA-PIPELINE.md` — success metrics, the Definition of Done per requirement, the production/QA pipeline, and the internal phasing/sequencing of all 23 Block D requirements.

---

## Block E — Profile & Social (Public Profiles, Avatars, Follow/Block, Account Settings)

Covers: the app-shell Profile and social domain — My Profile, the avatar editor, Settings, My Followers, Who I Follow, a user's Public Profile (`/@{username}`), Public Followers and Public Following (`01` §2.7, screens P1–P8), and the underlying Follow, Block, Profile and Avatar data entities (`03` §1). Per the user's explicit direction, this Block received the same order of research depth as Blocks C and D, because the initial structural read of this domain surfaced what this review judges to be the single most severe child-safety finding in the entire audit series: a social graph that crosses family boundaries with no restriction tied to the **kid** role at all. `10-APPENDIX-I-PROFILE-SOCIAL-SAFETY-RESEARCH-FRAMEWORK.md` covers child stranger-contact-risk research, real-world "walled garden"/graduated-autonomy design-pattern precedent, the current COPPA/AADC regulatory landscape, and the psychological literature on social-comparison metrics and gamification. E.1–E.6 are structural findings from the existing architecture (`01` §2.7; `02` section I; `03` §1; `05` §3, §7); E.7 is the pivot item marking where Appendix I's research foundation begins; E.8–E.13 formalize Appendix I's design implications.

**A confirmed structural fact worth stating up front, because it shapes how every finding below should be read:** this domain has no direct-messaging feature anywhere in the product, and the avatar system is 100% cartoon-generated with no image upload capability at all. Both are genuine, deliberate-looking safety-positive design choices that materially narrow the space of possible harms relative to a mainstream social app, and the findings below should not be read as implying LittleFounders built an Instagram-for-kids. But per Appendix I Pillar 1, the empirical grooming-risk literature treats **discovery/contact risk as a distinct category from messaging-content risk** — removing messaging removes one escalation channel, not the exposure event itself — and per Appendix I Pillar 2, every mainstream product that has faced regulatory or legal consequences over exactly this kind of exposure did so because of its **discoverability and connection architecture**, not only its chat feature. The absence of DM is a real mitigating fact; it is not, on its own, a solution to what follows.

### E.1 — Kid-role profiles are publicly discoverable and followable by any signed-in user, with no age-gating at all

**Severity:** Critical

**Current State:** The platform's own permissions documentation states, verbatim: *"Social layer: crosses families. Any signed-in user can view another user's public profile... and follow them, unless a block exists. Children's public profiles are visible to other signed-in users in the same way."* (Ref: `05` §7.) The **kid** role — the platform's only mechanism for flagging an account as belonging to a minor — has no effect whatsoever on discoverability, on who may follow a kid-role account, or on who a kid-role account may follow. A follow is refused only if either party has blocked the other (`03` §1.9); there is no other gate.

**Finding:** Per Appendix I Pillar 1 (Livingstone's EU Kids Online "4Cs" typology; boyd & Marwick's "networked privacy" research), public discoverability plus an open follow mechanic constitutes the **exposure event** in the standard academic framework for online child-safety risk — the event that makes unwanted contact possible in the first place — independent of whatever escalation channel (messaging) does or doesn't exist afterward. Per Appendix I Pillar 2, this is structurally the same fact pattern that produced the FTC's 2019 Musical.ly settlement ($5.7M, at the time the largest COPPA penalty ever obtained, for exactly a public-by-default child profile discoverable by any user) and the FTC's 2022 Epic Games/Fortnite settlement ($520M total, $275M of it COPPA-specific, for an always-on, cross-population connection feature reachable by minors with no age-tiered default). Every mainstream product that has actually reduced this risk — Messenger Kids' parent-approved contacts, Snapchat's mutual-friend model with connection-gated discoverability, Instagram's 2024 Teen Accounts (private by default, mutual-follow-approval required), TikTok's under-16 defaults — converged on the same structural fix: replace open, one-directional discovery with a gated, mutual-consent connection model. LittleFounders currently sits closer to the pre-fix state of every one of these products than to any of their current designs.

**Mandated Requirement:** Kid-role profiles must be **non-discoverable by default to any account outside the linked family**: no appearance in search or suggested-account surfaces, no resolvable public profile URL, and no visibility in another user's followers/following lists, for any signed-in user with no existing approved relationship to that child. Any inbound connection request targeting a kid-role account must require **explicit guardian approval** through the Family panel (see E.2) before the requester gains follower status or visibility into the child's stats or activity — not a child-side accept, and not the current "open unless blocked" default. This is the single highest-priority fix in this Block, in the same category of urgency as D.1 and D.4.

**Brand Alignment:** Law 1 and Pillar 5 ("the parent stays in the room... we do not replace the parent, we equip them") — a platform-level decision to expose a child's identity and activity to any signed-in stranger, made with no parental role in the decision at all, is the opposite of equipping the parent; it makes a consequential safety decision on the family's behalf without them.

---

### E.2 — Zero parental visibility into the child's social graph, and no audit trail of follow, unfollow, or block events

**Severity:** Critical

**Current State:** The Family panel (`01` §2.6, screens F1–F5, confirmed in Block D) gives a parent oversight of chores, the AI Mentor's transcripts, and Digital Banking, but nothing about the social layer — a parent has no way, anywhere in the documented product, to see who follows their child, who their child follows, or that a connection was ever made. Compounding this, the Audit Log Entry schema's own enumerated list of recorded actions (role changes, task/redemption events, banking events, course-release events, analytics-exclusion events) does not include follow, unfollow, or block (`03` §1.11) — meaning even LittleFounders' own staff have no investigable record of social-graph activity if a parent or a regulator ever asks.

**Finding:** This is, in this review's judgment, as consequential as the exposure itself: a parent cannot mitigate a risk they cannot see, and the platform cannot investigate an incident it never recorded. Appendix I Pillar 2 identifies this as the precise gap the Messenger Kids/Family Link "parent-approval queue" pattern exists to close — the Family panel is the natural, already-existing surface to extend, not a new one to build. Appendix I Pillar 1 independently flags the missing audit trail as a compounding failure distinct from the exposure problem: it is the lowest-cost, highest-leverage fix on this Block's list, since it changes nothing about the connection model but closes the gap that currently makes every other safety claim about this domain unverifiable after the fact.

**Mandated Requirement:** Extend the Family panel to surface a linked child's followers, following, and any pending connection requests (which E.1 requires to route through guardian approval). Add follow, unfollow, and block as recorded Audit Log actions, at minimum for any event where either party is a kid-role account, so both parents and staff can reconstruct social-graph activity after the fact.

**Brand Alignment:** Law 5, quoted directly: *"The parent must always be able to see what their child is learning, what the guide said, and what is being remembered about the child... Nothing about a child happens out of the parent's sight."* A social relationship formed around the child is not currently covered by that promise at all.

---

### E.3 — No reporting or moderation escalation path exists beyond a manual, silent mutual block

**Severity:** High

**Current State:** The only safety action available anywhere in the social layer is Block — a second-tap-confirms, bidirectional action that removes the follow relationship and hides both profiles from each other without revealing who blocked whom (`02` I4). No "report" action, no abuse-flagging mechanism, and no path to platform staff exists anywhere in the documented permissions or data model.

**Finding:** Appendix I Pillar 2 notes that even Discord — the product surveyed with the weakest historical governance record for minors — has a moderation/reporting escalation path beyond a user-level block, and that Meta's own 2026 evaluation of Instagram's safety tooling found manual, reactive, user-initiated controls (of which Block is the LittleFounders equivalent) are the specific category of mitigation found to fail at high rates precisely because they depend on the child or parent noticing and acting, with no route to the platform itself. A block silently protects one relationship after the fact; it does nothing to let LittleFounders learn that an account is engaging in a concerning pattern across many children.

**Mandated Requirement:** Add a "report" action on a profile or a followers/following-list entry that routes to a platform-level review queue and, for a kid-role account's connections, notifies the linked guardian. Report and block events must both feed the audit trail required by E.2, and this must be an **automatic pattern-detection trigger, not merely a visible log a staff member has to think to check**: an account accumulating reports or blocks from more than a defined number (proposed: 3) of unrelated kid-role accounts within a defined window (proposed: 30 days) must automatically queue for proactive staff review, mirroring the explicit repeated-pattern trigger D.18 already mandates for repeated chore/redemption denials. A pattern that is merely "visible in principle" in an audit log is not equivalent to a pattern the platform actually acts on.

**Brand Alignment:** Law 5 and Pillar 5 — transparency and "the parent stays in the room" both require a path to act on a concern that goes beyond hiding it from view.

---

### E.4 — Self-editable date of birth and username undermine any age-based gating, present or future

**Severity:** High

**Current State:** Per `02` I1, children use the same Settings screen as everyone else and can independently edit their own date of birth, display name, and profile username, with no guardian notification. Date of birth is the field the platform's own data model says is "used for age tiers, placement and Mentor eligibility" (`03` §1.2).

**Finding:** This finding already exists structurally, independent of Block E, but it becomes newly load-bearing here: Appendix I Pillar 2 documents, via Pasquale et al.'s 2019–2020 study of ten mainstream apps, that a self-reported, user-editable age field is trivially circumvented and cannot be relied on as a safety boundary — and both Roblox's and TikTok's real-world age-tiering failures are directly attributable to exactly this weakness. Any discoverability or connection-approval gate built per E.1 that keys off a user-editable date of birth is, in Appendix I Pillar 2's own words, "theater in exactly the sense the 2026 Instagram Teen Accounts evaluation found Meta's safety tools to be" — a child (or an account misrepresenting a child) could silently exit whatever protection is built.

**Mandated Requirement:** Lock a kid-role account's date of birth after initial parent-set verification, or require guardian re-confirmation before any subsequent change takes effect. **Amendment (OD-3):** because minor safeguards now follow age, a self-registered minor's date of birth must also be locked after the first declaration (otherwise a 15-year-old can escape every safeguard by editing one field); with no guardian to re-confirm, a later change goes through a staff-reviewed request. This is a prerequisite for E.1 and E.8, not an independent, optional fix — treat it as gating infrastructure, not a cosmetic Settings-screen tweak. (Echoes A.4/A.6.)

**Brand Alignment:** Law 5 — a control the child can unilaterally defeat is not a control the parent can actually rely on to see the whole story.

---

### E.5 — The "Tutor badge" (ID-verified-adult signal) is publicly visible to any user, including unconnected kid-role accounts

**Severity:** Medium-High

**Current State:** Any public profile, including one viewed by a kid-role account with no prior relationship to the profile owner, displays the Tutor badge when that account belongs to an ID-verified parent (`01` P1/P6; `02` I3).

**Finding:** Appendix I Pillar 1 is explicit that this is likely a genuinely novel design combination: no comparable mainstream platform pairs a platform-issued, ID-verification-backed "this adult is verified" signal with a space where children can independently browse and be followed by that same badge-holder. Grooming-stage research (O'Connell's foundational typology, cited with an honesty flag on exact bibliographic detail) treats trust-establishment as the first and most time-consuming stage of grooming; a public badge that pre-authenticates an adult as "verified" to a child who has no other reason to trust them shortens exactly that work, with no analog this research pass could find on any other platform.

**Mandated Requirement:** Restrict Tutor-badge visibility to the verified adult's own linked children and any connections approved through the gates required by E.1 — it should not be shown to a kid-role account with no established relationship to that adult. The badge can remain a meaningful, visible trust signal inside an already-established family or approved-connection context without functioning as an unearned, platform-wide trust signal inside an otherwise open discovery surface.

**Brand Alignment:** Pillar 5 — "verified parental control," per D.1's own established framing, must mean something specific and bounded; a verification signal shown to strangers in an open social space is a different, unintended kind of "control" than the one the badge was built for.

---

### E.6 — No self-service account deletion exists for adults or guests

**Severity:** Medium

**Current State:** Per `02` I6, a child's account is deleted only by their parent; an adult or guest has no self-service deletion path anywhere in the product, and the FAQ directs them to "contact us."

**Finding:** This reads as a likely echo of the pattern already flagged in A.1 (FAQ promising functionality that isn't built) — worth confirming against the actual FAQ text, but structurally consistent with a real gap rather than a deliberate design choice, since no stated rationale for withholding self-service deletion appears anywhere in the documented product or brand narrative.

**Mandated Requirement:** Either build a genuine self-service deletion flow for adult and guest accounts, or, if a manual/reviewed deletion process is the deliberate design (e.g., for fraud or abuse review), state that plainly in the FAQ instead of the current unqualified "contact us."

**Brand Alignment:** Law 5 — a deletion process a user cannot see the shape or timeline of is a small-scale version of the same opacity Law 5 exists to rule out.

---

### E.7 — No child-safety or social-design research foundation existed for this domain's design choices before this review

**Severity:** High (resolved by this review's research; retained as the item establishing why E.8–E.12 exist)

**Current State:** Prior to this Block's research pass, none of this domain's core design choices — an open follow graph with no gating, a manual-block-only safety mechanism, uniform treatment of the kid role and the self-registered teen population, and publicly visible follower/following counts — had a documented safety, legal, or developmental research basis, unlike Blocks B, C, and D.

**Finding:** Given that this review independently judges E.1–E.3 to be, combined, a strong candidate for the single most severe finding in the entire audit series, this gap was at least as consequential as the AI Mentor's real-time gap (Block C) and the Family Hub/Banking gap (Block D) that received the same treatment — which is why the user directed the same depth of research be applied here. `10-APPENDIX-I-PROFILE-SOCIAL-SAFETY-RESEARCH-FRAMEWORK.md` now provides that foundation across four pillars: child stranger-contact-risk research, real-world "walled garden"/graduated-autonomy design precedent, the current COPPA/AADC regulatory landscape, and the psychology of social-comparison metrics and gamification.

**Mandated Requirement:** Treat Appendix I as the authoritative basis for E.8 onward, and revisit it on the same recalibration cadence as Appendices B, D, and G — Appendix I explicitly flags that the regulatory landscape (California's AB 2273 litigation, Maryland's Kids Code litigation, federal KOSA) is actively moving and should be re-checked against current sources before any specific legal claim in E.8–E.12 is treated as settled.

**Brand Alignment:** Law 4 — the same evidentiary rigor already required of lesson design, the AI Mentor, and Family Hub/Banking applies to the domain where the platform's youngest users are most directly exposed to other people.

---

### E.8 — No age-tiered differentiation exists between the kid role and the self-registered 13–17 "universal" role in the social layer

**Severity:** High

**Current State:** A platform-created kid-role account (always linked to a verified parent) and a self-registered 13–17-year-old holding only the generic universal role are subject to identical social-layer defaults today — the same defaults, in turn, that apply to any adult.

**Finding:** Appendix I Pillar 4 (Somerville's developmental-neuroscience work on adolescent sensitivity to social evaluation) and Pillar 1 both identify teens as the population most reactive to exactly the discoverability and comparison-metric risks this Block addresses, while Appendix I Pillar 3 independently flags this population as the platform's largest *unresolved* regulatory exposure: COPPA's bright line stops at 13, but the UK Children's Code and a fast-growing, still-unsettled set of U.S. state laws (California, Maryland, Utah) extend "child"/"minor" protections to 16 or 18 specifically including default-privacy-of-social-features obligations. This is also the same population already excluded, per the audit's earlier findings (A.3/A.4/D.3), from every other age-based protection on the platform — the social layer is one more instance of that pattern, not an isolated gap.

**Mandated Requirement:** Build a two-tier model, modeled directly on Instagram's shipped Teen Accounts split: kid-role accounts get the strictest tier (non-discoverable, guardian-approval-gated per E.1, no independent loosening by the child); self-registered universal-role teens get a lighter but still materially protective tier (private-by-default profile, mutual-consent connections the teen can self-manage without a per-request guardian approval, since no guardian exists in this flow) — never treated identically to a verified adult default, as they are today.

**Brand Alignment:** Narrative Element 7 ("The Success") — the brand's own success vision explicitly celebrates a self-directed 16-year-old ("At 16, they've made money, not just been given it") as its aspirational example, and cannot simultaneously give that same population the platform's least protective social-layer defaults.

---

### E.9 — Public follower/following counts function as an unmitigated, quantified social-comparison metric on an already gamification-intensive product

**Severity:** Medium-High

**Current State:** Every public profile displays follower and following counts alongside the product's existing gamification metrics (day streak, XP points, minutes learned, course badges) on the same screen (`01` P1/P6).

**Finding:** Appendix I Pillar 4 draws a specific, evidence-grounded distinction: the broad "social media harms kids" claim is genuinely contested (Orben & Przybylski's specification-curve work found digital-technology use explains roughly 0.4% of variance in adolescent wellbeing), but the narrower claim that **visible, quantified peer-comparison metrics specifically** carry a more direct, mechanistically-supported risk is well-supported — Sherman et al.'s fMRI work shows a visible like/follower count directly activates reward circuitry and drives conformity in the adolescent brain; Nesi & Prinstein found this effect concentrates its downside on lower-status peers, meaning the metric is likely to harm exactly the children least equipped to shrug it off; and Hanus & Fox's classroom study found visible comparative leaderboards measurably *reduced* motivation and performance in a mechanically similar gamified-education context. No study examines LittleFounders' exact combination (financial-literacy gamification plus an open, cross-family follower count), and Appendix I is explicit that this specific compounding effect is a research gap, not a proven finding — but the existing, adjacent evidence is strong enough to justify precaution on the one metric in this product that is comparison-to-others rather than comparison-to-self. This is not a new concern for this document series: `10-APPENDIX-B-PEDAGOGICAL-PSYCHOLOGICAL-FRAMEWORK.md` §2.2 (the Dual-Systems Model) already found, for the 13–17 age band specifically, that "any mechanic that makes a teen's choices, mistakes, or performance visible to peers (leaderboards, shared streaks, comparative rankings) should be treated as a risk-amplifying design element," and its own age-band synthesis table (§2.9) recommends "no peer-visible risk leaderboards" for that band. Follower/following counts are exactly this category of mechanic, on the exact age band Appendix B already flagged, and B.23's age-band presentation work never extended to the Profile domain because Block B's own scope predates this Block's review of it — this finding closes that gap rather than introducing a new concern from nothing.

**Mandated Requirement:** Remove public follower/following counts from the default profile display, or make them private/opt-in rather than shown by default; if retained in any form, do not display them adjacent to or in the same visual block as XP, streaks, or badges. This is the most surgical fix available: it preserves the ability to follow and be followed (subject to E.1's gating) while removing the one quantified, comparison-inviting number research consistently implicates.

**Brand Alignment:** Law 4 ("reward the decision, not the amount... progress and reasoning over accumulation") and the brand's own villain narrative, which explicitly names **the Feed** — "finfluencers, flex culture, one-tap purchases" — as an accomplice of the Inheritance the platform exists to defeat. A public, quantified popularity count sitting on the same screen as a child's financial-literacy progress is a small Feed built inside the guide's own product.

---

### E.10 — The absence of direct messaging is a de facto safety property today, not a governed constraint for tomorrow

**Severity:** Medium

**Current State:** No messaging, comment, or chat feature of any kind exists anywhere in the documented product. Nothing in the audit or the brand narrative states this as a deliberate, permanent safety decision rather than a feature simply not yet built.

**Finding:** Appendix I Pillars 1–3 converge on treating the absence of messaging as the single most significant mitigating fact in this entire Block — but also warn, via the FTC's Epic Games/Fortnite precedent ($520M, centrally for defaulting voice/text chat to *on* for minors with internal awareness of the risk, per the FTC's own complaint), that this protection is only as durable as the next product decision. A well-intentioned future team adding a comment feature, a "say hi" message, or a group chat "to increase engagement" would silently reintroduce the exact risk this Block spends most of its length addressing, unless the constraint is written down now.

**Mandated Requirement:** Formally codify "no direct messaging or comment feature" as a standing product constraint for kid-role and universal-teen accounts. Any future messaging-adjacent feature must default OFF for both populations, require affirmative guardian opt-in (kid role) or affirmative teen opt-in with guardian notice (universal-teen role) before activation, and must be reviewed against this Block's standard before shipping — not treated as an unrelated new feature outside this Block's scope.

**Brand Alignment:** Law 5 — a future feature that reopens this exposure without the parent's active decision would violate "nothing about a child happens out of the parent's sight" the moment it shipped, not gradually.

---

### E.11 — No documented data-retention or consent policy exists for social-graph data

**Severity:** Medium

**Current State:** No retention, deletion, or third-party-disclosure policy specific to follow, block, or connection-request data was found in the documented mechanics.

**Finding:** Appendix I Pillar 3 (not legal advice; flagged throughout as requiring counsel review) notes that COPPA's "disclosure" definition has, since the 2013 Rule, explicitly included making a child's personal information publicly available through a profile page or similar public-facing feature — meaning a kid-role account's public profile and follower relationships plausibly constitute a disclosure requiring its own consent and retention treatment, separate from whatever consent was obtained at account creation. This directly parallels D.21's finding for Family Hub/Banking behavioral data, applied to a different data category.

**Mandated Requirement:** Establish and publish a written retention/deletion policy specifically covering social-graph data (follow relationships, connection requests, block records), and treat the "being followed by / following another user" action as its own disclosure event requiring guardian awareness for kid-role accounts, distinct from account-creation consent — consistent with D.21's precedent and the FTC's 2025 COPPA amendments' data-minimization requirements.

**Brand Alignment:** Law 5 — get ahead of a disclosure obligation rather than waiting for regulatory clarity to force it, exactly as D.21 already established for Block D.

---

### E.12 — Standing guardrails worth locking in, and a notable brand-narrative silence

**Severity:** Medium (governance item)

**Current State:** Two elements of the current design are genuine safety strengths worth explicitly preserving rather than silently relying on: the avatar system is 100% cartoon-generated with no image-upload capability anywhere in the product (`02` I2), and (per E.10) no messaging feature exists. Separately, `COSMIC_NARRATIVE.md` contains no stated brand position on the design of the social/follow layer for children at all — a notable silence given how explicit and vocal the same narrative is about Digital Banking's honesty ("we refuse to sell the illusion that a card raises a child") and the AI Mentor's safety posture.

**Finding:** A strength that is never written down as a requirement is one a future redesign can remove without anyone noticing it was load-bearing — the cartoon-only avatar system should be treated with the same explicit protection this document already gives other safety-positive defaults. Separately, the brand's silence on the social layer stands out precisely because the narrative is otherwise unusually willing to draw an explicit line against a specific competitor pattern; Appendix I Pillar 4's "Feed" framing (see E.9) suggests the natural, on-brand articulation already exists in the narrative's own vocabulary and simply hasn't been written down for this domain.

**Mandated Requirement:** Add the cartoon-only avatar system to this document's list of standing constraints (no image upload may be introduced without a full child-safety re-review). Add an explicit brand-narrative statement — in the register already established by the Digital Banking narrative — articulating why LittleFounders does not build an open, discoverable social network for children: for example, a stated position that the product offers "a small, safe way to say hello to people you already know," not a public social graph, distinguishing it explicitly from the Feed the brand's own villain narrative names as an adversary.

**Brand Alignment:** Law 5 and the brand's own villain narrative (`COSMIC_NARRATIVE.md` §2, "The Feed") — an explicit position here costs nothing and closes a gap between what the brand is clearly willing to say about money (Block D) and what it has never said about social exposure.

---

### E.13 — No audit exists of whether an approved profile still leaks information that lets a stranger locate a child off-platform

**Severity:** High

**Current State:** Nothing in the documented product reviews profile content (username, display name, bio-adjacent fields, avatar choices) for information that would let a viewer identify or locate the child outside LittleFounders — this is true regardless of whether E.1's discoverability gate ships, because it concerns what an *already-approved* viewer, or a viewer who has already seen a profile before a block, can do with what they saw.

**Finding:** Appendix I Pillar 1 is explicit that "no DM" is a genuine mitigating fact, not a solved problem, precisely because Thorn's 2022 research found that **65% of minors with online-only contacts were invited to move the conversation to a different platform** — a migration that a follow relationship or even a single profile view can enable simply by exposing a username or display name an offender can search for elsewhere, with no on-platform messaging required at all. E.1's discoverability gate controls *who* can reach a kid-role profile; it does not control what identifying information that profile hands a viewer once reached, whether that viewer is a stranger who slipped past the gate, an approved connection who turns out to be unsafe, or someone who saw the profile before being blocked.

**Mandated Requirement:** Before E.1 ships, define and apply a profile-content safety review for kid-role accounts: disallow or flag any profile field (username, display name) that reuses an identifiable handle from another platform where reasonably detectable, and ensure no free-text field anywhere in a kid-role profile (if any is ever added) can carry school, location, or other off-platform-locating information. This is a content-level safety layer distinct from, and in addition to, E.1's access-level gate — closing the access gate does not make this review unnecessary, since an approved connection is not automatically a safe one.

**Brand Alignment:** Pillar 5 — "the parent stays in the room" requires that a parent-approved connection actually be the boundary of the exposure, not merely the boundary of who technically had to be approved first.

---

## Block E — Safe Social Layer Standard: How Profile & Social Should Actually Work

**Status:** Mandatory design standard for the Profile and social domain, applying alongside the existing profile/avatar/follow/block architecture. This section operationalizes `10-APPENDIX-I-PROFILE-SOCIAL-SAFETY-RESEARCH-FRAMEWORK.md` into a working architecture, the same way Block B's Pedagogical Design Standard, Block C's Real-Time Interaction Standard, and Block D's Real-World Money Practice Standard operationalized their appendices. E.1–E.12 above are the individually-tracked mandatory requirements; this section is the synthesized standard those requirements sit inside.

### The five components of the standard

1. **Discoverability & Consent Architecture** (E.1, E.4, E.13) — kid-role profiles are non-discoverable outside the linked family by default; any inbound connection requires guardian approval; the date-of-birth field any age-based gate relies on cannot be unilaterally edited by the account it governs; and profile content itself is reviewed so that an approved or previously-visible profile does not hand a viewer what they need to locate the child off-platform.

2. **Parental Visibility & Accountability Layer** (E.2, E.3, E.11) — the Family panel surfaces a linked child's followers, following, and pending requests; every follow/unfollow/block event is audit-logged; a reporting path exists beyond a silent mutual block, with an automatic pattern-detection trigger (not a log a staff member must remember to check) escalating an account accumulating reports or blocks across multiple unrelated kid-role accounts; and social-graph data carries its own published retention/disclosure policy.

3. **Graduated Age-Tiering** (E.8) — the kid role and the self-registered 13–17 universal role receive distinct, more-protective-than-adult defaults, calibrated to their different circumstances (guardian-managed vs. self-managed) rather than treated identically to each other or to an adult account, extending the graduated-autonomy principle Block D already established for Digital Banking into this domain.

4. **Trust-Signal & Comparison-Metric Integrity** (E.5, E.9) — the Tutor badge functions as a bounded trust signal inside an established relationship, never as a general public signal inside an open discovery surface; public follower/following counts, the one metric on the profile that is comparison-to-others rather than comparison-to-self, are removed or made private/opt-in and never displayed adjacent to the product's mastery-oriented gamification metrics.

5. **Standing Guardrails Against Future Regression** (E.6, E.10, E.12) — "no direct messaging," "no image-upload avatars," and a self-service (or clearly-documented) account-deletion path are treated as locked-in product constraints subject to explicit re-review before being changed, not silent defaults a future team can quietly remove.

### Non-negotiable behavioral constraints (apply regardless of which component is active)

- No inbound connection request may reach a kid-role account without guardian approval (E.1).
- No follow, unfollow, or block event may occur without a corresponding Audit Log entry (E.2).
- No age-based gate anywhere in this Block may key off a field the governed account can unilaterally edit (E.4).
- No future messaging or comment feature may default to on for a kid-role or universal-teen account (E.10).
- No platform-issued trust badge may be shown to a viewer with no established, approved connection to the badge holder (E.5).
- No kid-role profile may ship without the content-level safety review required by E.13, regardless of how restrictive its discoverability gate is.
- No report or block pattern against a single account may remain staff-invisible past the defined threshold — detection must be automatic, not dependent on a staff member checking (E.3).

### Governance boundary (per Appendix I's own honesty notes)

None of the findings above should be presented internally or externally as resting on fully settled science or fully settled law. Per Appendix I: the general "social media harms adolescents" literature is genuinely and prominently contested (Orben & Przybylski vs. Twenge/Haidt); the regulatory exposure for the 13–17 population rests partly on U.S. state laws (California's AB 2273, Maryland's Kids Code) currently in active, unresolved litigation; and no study directly tests LittleFounders' exact combination of an open follower graph with an already-gamified learning product. What is genuinely well-established — the FTC's completed Musical.ly and Epic Games settlements, the UK Children's Code's binding "high privacy by default" standard, and the mechanistic evidence that visible comparison metrics activate reward-seeking and conformity in the adolescent brain — is more than sufficient to justify the requirements above without overstating certainty on the points that remain open.

---

### Block E — Summary of Mandated Changes

| ID | Finding | Severity | Owner decision needed |
|---|---|---|---|
| E.1 | Kid-role profiles are publicly discoverable and followable by any signed-in user, no age-gating | Critical | Non-discoverable by default outside family; guardian-approval gate on inbound connections |
| E.2 | Zero parental visibility into the child's social graph; no audit trail of follow/unfollow/block | Critical | Extend Family panel; add follow/unfollow/block to the Audit Log |
| E.3 | No reporting/moderation escalation path beyond a manual, silent mutual block | High | Add a "report" action routing to staff and, for kid-role accounts, to the guardian |
| E.4 | Self-editable date of birth/username undermines any age-based gating | High | Lock DOB after verification, or require guardian re-confirmation on change |
| E.5 | Tutor badge publicly visible to any user, including unconnected kid-role accounts | Medium-High | Restrict badge visibility to established family/approved connections |
| E.6 | No self-service account deletion for adults/guests | Medium | Build self-service deletion, or document the manual process honestly |
| E.7 | No child-safety/social-design research foundation existed before this review | High (resolved) | Adopt Appendix I as authoritative; recalibrate on the same cadence as Appendix B/D/G |
| E.8 | No age-tiered differentiation between kid role and self-registered teen role in the social layer | High | Build a two-tier model (guardian-gated vs. self-managed-private-by-default) |
| E.9 | Public follower/following counts are an unmitigated social-comparison metric | Medium-High | Remove or make private/opt-in; never display adjacent to XP/streak metrics |
| E.10 | Absence of DM is undocumented, not a governed constraint | Medium | Codify "no DM" as a standing constraint with a default-off, guardian-opt-in rule for any future feature |
| E.11 | No documented retention/consent policy for social-graph data | Medium | Publish a written retention/deletion policy; treat being-followed as its own disclosure event |
| E.12 | Cartoon-only avatars and no-DM are unprotected strengths; brand narrative is silent on social-layer design | Medium | Lock in both constraints explicitly; add a brand-narrative statement on the social layer |
| E.13 | No audit of whether an approved profile leaks information enabling off-platform location of a child | High | Add a content-level profile safety review, distinct from and in addition to E.1's access gate |

**References:** `10-APPENDIX-I-PROFILE-SOCIAL-SAFETY-RESEARCH-FRAMEWORK.md` — the complete child stranger-contact-risk, walled-garden/graduated-autonomy design-pattern, COPPA/AADC regulatory, and social-comparison/gamification-psychology research underlying E.8–E.13 and the Safe Social Layer Standard above. `10-APPENDIX-J-PROFILE-SOCIAL-METRICS-QA-PIPELINE.md` — success metrics, the Definition of Done per requirement, the production/QA pipeline, and the internal phasing/sequencing of all 13 Block E requirements.

---

## Block F — Achievements (Course Badges, Streak and Savings-Goal Badges, Shareable Achievement Links)

Covers: course-completion badges (derived, not stored), the shareable Achievement Share mechanism reachable from a child's territory screen (a completed course badge, a learning streak of 3+ days, or a reached savings goal), and the fully public `/badge/{token}` landing page that mechanism generates (`00` domain #15; `01` screen inventory; `02` flows A3, D5, F5, G4; `03` §3.8–3.9; `05` feature-access/data-exposure tables; `07`–`09`). Per the user's direction, and because this review's own initial read judged the gaps here to be mostly product/governance questions rather than genuinely disputed science, this Block received a lighter, single-report research pass rather than the four-pillar deep dive given to Blocks C, D, and E: `10-APPENDIX-K-ACHIEVEMENT-SHARING-RESEARCH-BRIEF.md` covers COPPA/FTC disclosure doctrine as applied to a company-hosted public child-achievement page, real-world precedent from comparable products, and the growth-loop/commodification-of-childhood literature. F.1–F.6 are all grounded in this single research pass together with the existing structural audit, since the two were investigated as one question rather than structural-findings-first-then-research as in prior Blocks.

**A confirmed structural fact worth stating up front, because it shapes how every finding below should be read:** this is the one mechanism in the entire audit where a *verified parent*, not the platform unilaterally, initiates the exposure, and the server verifies the achievement is genuine before generating anything — a materially better consent posture than Block E's open follow graph. The findings below are about what happens **after** that parent-initiated share (permanence, revocability, disclosure, and framing), not about a platform decision made with no parental role at all.

**A distinction worth stating explicitly, because it is easy to conflate with Block E's fix:** course badges also appear on a child's authenticated public profile (`01` P1/P6), which is exactly the surface E.1's discoverability gate restricts. That gate has no bearing on this Block. The `/badge/{token}` mechanism below requires no account and no sign-in at all — closing the social graph in Block E does nothing to close this exposure, and this Block's fixes must not be read as already covered by Block E's.

### F.1 — The badge-sharing page is fully public, unauthenticated, and indexable, exposing a specific child's identity to the entire internet

**Severity:** Critical

**Current State:** A shared achievement generates a page at `/badge/{token}` showing the child's first name, an achievement label, and a generated image. No sign-in or account is required to view it (`02` M7, flow A3); the platform's own permission tables place this route and its API in the same "public, no guard" bucket as the signup and login endpoints (`05` feature matrix, screen-guard table, API-area table). Messaging apps generate an automatic rich preview showing the child's first name and achievement the moment the link is pasted, before anyone clicks (`02` A3; supplementary `04` edge-function detail).

**Finding:** Per Appendix K, this reading of COPPA's "disclosure" definition is not a stretch: the Rule's second disclosure prong is "making personal information collected by an operator from a child publicly available in identifiable form by any means" (16 CFR 312.2), and FTC FAQ D.12 treats "making a child's personal information publicly available... through... other means" as disclosure requiring verifiable parental consent. Appendix K is explicit that no FTC action or formal guidance addresses this *exact* fact pattern — a parent-initiated, first-party growth mechanism, rather than a child-initiated share or a third-party ad-tech disclosure — so this should be read as a well-grounded risk analysis, not a citation of settled law. What is not in dispute: every verified real-world comparator Appendix K found (Mozilla Open Badges' private-by-default model; ClassDojo's authenticated-family-and-teacher-only portfolio; Strava's default suppression of a minor's public achievement visibility) chose a materially more closed architecture than LittleFounders' permanent, unauthenticated, indexable page.

**Mandated Requirement:** Reconsider the underlying architecture before adding guardrails to the current one: evaluate whether a downloadable/shareable **image handed directly to the parent** (rendered once, with no company-hosted persistent public URL) satisfies the actual use case — sending a picture to a grandparent over WhatsApp — without creating an open-web asset at all, which would also eliminate the automatic link-preview exposure described above, since a plain image attachment does not trigger a company-hosted metadata preview. This decision must be made jointly by Product and the Safety/Trust Lead (the role named in Appendix L for this Block's metrics ownership), resolved before Block F's Phase 0 begins, since Block F's own sequencing already treats this architecture choice as the prerequisite first phase. If a persistent public page is kept for any reason, it must at minimum be marked `noindex`/excluded from any sitemap so search engines cannot crawl and permanently cache it, and must carry the expiration/revocation controls required by F.2.

**Brand Alignment:** Law 5 and Pillar 5 — "the parent stays in the room" should mean the parent controls the boundary of an exposure they initiated, not that the platform converts a single celebratory moment into a permanent, crawlable, public artifact.

---

### F.2 — No revocation or expiration mechanism exists for an individual shared badge

**Severity:** High

**Current State:** The Achievement Share record persists until the entire child's account is deleted (`03` §3.9, §12) — there is no documented screen or flow anywhere that lets a parent revoke or expire one specific shared link, and no expiration window is defined for the token.

**Finding:** Appendix K notes this is in tension with a parent's ongoing COPPA right to compel deletion of a child's personal information (16 CFR 312.6) at the level of a specific disclosure, not only the entire account, and with the FTC's 2023–2025 rulemaking trend against indefinite retention beyond the purpose originally served (a one-time celebratory share does not need to remain live and crawlable indefinitely to have served its purpose). A parent who shares a link in error, or simply changes their mind, currently has exactly one remedy: delete their child's entire LittleFounders account.

**Mandated Requirement:** Add a per-share "revoke this link" control, reachable from the parent's territory/Family panel, that immediately invalidates the token and removes the page independent of the underlying achievement record. Pair this with a default expiration window (Appendix K proposes 30–90 days as a reasonable starting range) or a view-count cap, so a forgotten link does not remain a live, public artifact indefinitely even absent an explicit revoke action. Critically, "revoked" must mean **actually unreachable, not just delisted**: the badge image itself sits in Media Storage, documented elsewhere in this audit as "world-readable with 1-year immutable caching," and a messaging app may have already cached its own copy of the link-preview image before revocation. Revocation is not done until (a) the image's own storage location stops serving it (not merely the `/badge/{token}` page returning "not found" while the underlying image URL still resolves), and (b) the team has explicitly accepted, and disclosed to the parent per F.3, that a preview already cached by a third-party messaging app before revocation may persist there regardless of what LittleFounders' own systems do. A revoke button that only removes the page while the image stays fetchable is the same category of failure as D.1's cosmetic freeze.

**Brand Alignment:** Law 5 — a promise that "the parent always sees the whole story" implies the parent can also end a chapter they started, not just begin one.

---

### F.3 — The share flow gives the parent no informed, specific disclosure that the resulting link is public, permanent, and instrumented as a growth mechanism

**Severity:** Medium-High

**Current State:** "Share achievement" is a single tap from the child's territory screen (`02` F5); the flow describes verification of the achievement and generation of the link, with no described disclosure step telling the parent what they are about to create. Internally, the mechanism is explicitly framed as a "growth loop": it records a "badge link clicked" acquisition event, carries a "badge-share" attribution tag, and the landing page's call to action recruits the visitor as a new sign-up (`02` M7; `07` event catalog rows 33–35, North Star export set).

**Finding:** Appendix K notes that FTC verifiable-parental-consent guidance emphasizes consent must be informed of the *specific* practice, not a general blanket permission, and separately cites the UK Advertising Standards Authority's guidance on children as marketing vectors, which requires that marketing activity be "obviously identifiable" to those who encounter it — here, that would mean the *parent*, at the point of sharing, understanding that they are not just sending a private celebration to a grandparent but creating a public, permanent, attribution-tagged acquisition touchpoint for the company. Nothing in the documented flow currently makes that explicit at the moment of the decision.

**Mandated Requirement:** Add a short, specific, un-buried disclosure at the point of tapping "Share achievement" — for example, along the lines of "This creates a link anyone with it can view, even people you didn't send it to if they find the URL, and helps LittleFounders grow. It won't expire unless you delete it" (to be updated once F.1/F.2 ship, reflecting whatever expiration/revocation and page-vs-image architecture is actually built, including the caching caveat F.2 requires). This is a one-time, point-of-action disclosure, not a privacy-policy clause, and its copy must pass through the same Forge tone gate D.8 and E's copy stages already established elsewhere in this document series — a disclosure this important must still sound like a mentor speaking plainly (Law 2), not a legal warning bolted onto a happy moment.

**Copy tone note:** this reinforces, rather than replaces, F.6's brand alignment — a moment designed to celebrate a child's achievement should not curdle into something that reads as a liability disclaimer; Forge review exists precisely to catch that failure mode before it ships.

**Brand Alignment:** Law 5 — transparency shown at the exact moment a parent acts, not buried in a policy document, is the standard this document series has already applied everywhere else (D.7's no-unbacked-guarantee principle; E.10's standing-constraint disclosure).

---

### F.4 — A declared-but-unused "age band" field on the Achievement Share entity

**Severity:** Medium

**Current State:** The Achievement Share data model includes an age-band field (6–8 / 9–11 / 12–14) that is documented as "never populated" (`03` §3.9).

**Finding:** This is the same pattern already flagged in D.5 — a lifecycle or data element that was scaffolded but never wired up end-to-end. Appendix K's own reading of this fact is notable: an unused age-band field is itself a signal that whoever designed this entity already recognized age as a relevant risk dimension for a public-facing artifact, without ever finishing the thought.

**Mandated Requirement:** Per the Definition-of-Done principle already established in Appendices C, F, and H: either build a genuine use for the age-band field (for example, feeding it into a more conservative default for younger children under F.1/F.2's architecture decision) or remove it from the schema. No Block F field may ship declared without a corresponding consuming flow.

**Brand Alignment:** Law 5 — the same "no promise without a working feature behind it" principle already applied throughout this document series.

---

### F.5 — No stated brand-narrative position exists on the badge-sharing growth loop

**Severity:** Medium-High

**Current State:** A full-text search of `COSMIC_NARRATIVE.md` for every relevant term (badge, achievement, streak, milestone, shareable) returns zero matches. The brand narrative says nothing about this feature at all.

**Finding:** This is the same category of silence already flagged in E.12, and arguably more pointed here: the brand is otherwise proactively vocal about safety and honesty in exactly the two domains (the AI Mentor, Digital Banking) where it has the most to explain, but has nothing to say about a mechanism that turns a specific, named child's achievement into a permanent, public, growth-instrumented artifact — precisely the kind of feature a brand built around "we are the only financial voice in the child's life that has nothing to sell them" (Law 2) would be expected to address directly.

**Mandated Requirement:** Add an explicit brand-narrative statement articulating why and how LittleFounders shares a child's achievement — what it is (a proud moment a parent chooses to send to people who care), what it deliberately is not (a permanent public listing or an unconsented marketing use of a child's identity) — once F.1–F.3 have settled the actual mechanics, so the statement describes the shipped behavior rather than the current one.

**Brand Alignment:** Law 2 and Law 5 — say plainly, in the brand's own voice, what this feature is and isn't, the same way the brand already does for Digital Banking.

---

### F.6 — Existing strengths worth explicitly preserving as standing constraints

**Severity:** Medium (governance item)

**Current State:** Three elements of the current design are genuine strengths, confirmed across `02` F5 and `05`'s data-exposure table: only a verified guardian may initiate a share (not the child, not any other party); the server verifies the underlying achievement is genuine before generating anything; and the information exposed is deliberately minimized (first name only, capped at 40 characters, no surname, no age, no photo).

**Finding:** As with E.12's cartoon-only-avatar finding, a strength that is never written down as a requirement is one a future redesign can quietly remove without anyone treating it as a regression. Given F.1–F.3 are about to change this feature's architecture, it is worth locking in what already works so it survives that change rather than being incidentally lost.

**Mandated Requirement:** Add guardian-only initiation, server-side achievement verification, and first-name-only information minimization to this document's list of standing constraints for this feature — any future redesign of the sharing mechanism (including the F.1 architecture change) must preserve all three explicitly, not merely by accident of not having touched them.

**Brand Alignment:** Pillar 5 — the parts of this feature that already equip rather than bypass the parent should be named and protected, not just left alone.

---

## Block F — Achievement Sharing Standard: How Sharing a Child's Achievement Should Actually Work

**Status:** Mandatory design standard for the Achievements domain, applying alongside the existing course-badge and Achievement Share architecture. This section operationalizes `10-APPENDIX-K-ACHIEVEMENT-SHARING-RESEARCH-BRIEF.md` into a working architecture, the same way the Standards for Blocks B through E operationalized their appendices. F.1–F.6 above are the individually-tracked mandatory requirements; this section is the synthesized standard those requirements sit inside.

### The three components of the standard

1. **Exposure Minimization & Architecture** (F.1, F.2) — the default preference is a shareable artifact with no company-hosted persistent public URL at all; if a public page is kept for any reason, it is non-indexable, expires or caps its views, and can be revoked by the parent at will, independent of deleting the child's account.

2. **Informed Consent at the Point of Action** (F.3) — the parent is told, in plain language and at the exact moment of sharing, what they are creating (a public, potentially permanent, attribution-tracked artifact), not only in a privacy policy they are unlikely to have read.

3. **Standing Constraints & Governance** (F.4, F.5, F.6) — the schema carries no declared-but-unused fields; the brand narrative states a plain position on this feature; and the design's existing strengths (guardian-only initiation, server-verified authenticity, first-name-only minimization) are written down as constraints any future redesign must preserve.

### Non-negotiable behavioral constraints (apply regardless of which component is active)

- No achievement may be shared by anyone other than a verified guardian of the child in question (F.6).
- No shared achievement page or artifact may expose more than first name, achievement label, and image (F.6) unless a future, explicit, separately-consented feature says otherwise.
- No shared link may be un-revocable and un-expiring at the same time (F.2).
- No new field may be added to the Achievement Share entity without a consuming flow that uses it (F.4).

### Governance boundary (per Appendix K's own honesty note)

This is a comparatively novel, under-litigated fact pattern: no FTC action or court ruling addresses a parent-initiated, permanently public, company-hosted child-achievement page used as a first-party growth mechanism. The requirements above are a well-grounded risk-reduction position built from adjacent COPPA doctrine, verified comparator products that chose more closed architectures, and UK advertising-standards guidance on children as marketing vectors — not a claim that the current design has already been found unlawful, and not a substitute for counsel review before treating any specific claim above as a compliance conclusion.

---

### Block F — Summary of Mandated Changes

| ID | Finding | Severity | Owner decision needed |
|---|---|---|---|
| F.1 | Badge-sharing page is fully public, unauthenticated, and indexable | Critical | Prefer a no-persistent-URL image artifact; if a page is kept, add noindex + expiration/revocation |
| F.2 | No revocation or expiration mechanism for an individual shared badge | High | Add a per-share revoke control and a default expiration window |
| F.3 | No informed, specific disclosure of the public/permanent/growth-instrumented nature at point of sharing | Medium-High | Add a point-of-action disclosure before the link is created |
| F.4 | Declared-but-unused "age band" field on Achievement Share | Medium | Build a use for it or remove it |
| F.5 | No brand-narrative position on the badge-sharing growth loop | Medium-High | Add an explicit brand statement once F.1–F.3 ship |
| F.6 | Existing strengths (guardian-only, server-verified, minimized data) are unprotected | Medium | Lock in explicitly as standing constraints |

**References:** `10-APPENDIX-K-ACHIEVEMENT-SHARING-RESEARCH-BRIEF.md` — the COPPA/FTC disclosure-doctrine research, real-world shareable-achievement product precedent, and growth-loop/commodification-of-childhood research underlying F.1–F.6 and the Achievement Sharing Standard above. `10-APPENDIX-L-ACHIEVEMENT-SHARING-METRICS-QA-PIPELINE.md` — success metrics, the Definition of Done per requirement, the production/QA pipeline, and the internal phasing/sequencing of all 6 Block F requirements.

---

## Block G — Staff Console & Content Production

Covers: the ten staff console screens (Overview, Content, Users, Emails, Analytics, Intelligence, Generation, Insights, Audit log, Roles & Access) and the course-generation/content-production pipeline (plan → write → AI-judge review → localize → illustrate → publish, plus release verification) (`00` domains #16–#17; `01` §2.8; `02` sections J, K; `03` §1.3–1.4, §1.11, §8.3; `05` §1–3, §9; `06` §2.4–2.6; `08` §1, §6). Unlike Blocks C–F, this Block's findings are engineering-governance and access-control questions with well-established, largely uncontested professional standards (least-privilege access control, incident-response practice, audit-trail completeness) rather than genuinely disputed science or child-development research, so — consistent with the proportionality already applied in this document series (Block A shipped with no dedicated research appendix at all) — this Block is formalized directly from the structural audit, citing general engineering/security standards inline rather than through a new dedicated appendix.

**A confirmed structural fact worth stating up front:** the content-production pipeline itself is well designed on its own terms — an independent AI judge scores every lesson on a 9-dimension rubric with **child safety as a hard, non-negotiable floor**, deterministic gates check age-appropriate vocabulary and factual/arithmetic correctness, answer keys are frozen and kept separate from the public lesson document, and no lesson reaches a child without passing through a human staff approval step (`02` K1, J2). The findings below are about the access-control and governance layer surrounding that pipeline and the rest of the staff console, not about the pipeline's own content-safety design, which this review found genuinely solid.

### G.1 — Staff permission labels are entirely cosmetic; only the admin/superadmin role actually gates anything

**Severity:** Critical

**Current State:** Four fine-grained staff permissions exist (manage users, manage content, view analytics, manage support) and are stored, displayed, and audited in Roles & Access — but, per the platform's own documentation, verbatim: "No endpoint checks them. Access to staff capabilities is decided solely by holding the admin or superadmin role." (`05` §1.3; `03` §1.4, identical language). A Superadmin granting a staff member only "manage support" today gives that person no less access than granting all four — every Admin sees the entire staff console except Roles & Access, regardless of which permissions they hold.

**Finding:** This is the staff-console equivalent of D.1's cosmetic card freeze: a control that visibly exists, is dutifully audited every time it changes, and restricts nothing. Least-privilege access control — granting each person only the access their role actually requires — is one of the most uncontested principles in information-security practice (reflected in, among others, NIST SP 800-53's access-control family and the OWASP Application Security Verification Standard's access-control requirements), and it is precisely what these four labels appear to implement without actually doing so. For a platform holding children's Mentor-adjacent data, banking-simulation data, and family records, an unenforced permission system is a meaningful governance gap, not a cosmetic one.

**Mandated Requirement:** Either wire each of the four permissions to the endpoints/screens it names (manage_content gates Content and Generation; view_analytics gates Analytics, Intelligence, and Insights; manage_users gates Users; manage_support gates Emails and support-adjacent tooling) so that granting one does not imply the others, or, if a single undifferentiated "staff" tier is the deliberate intended design, remove the granular permission UI and audit trail entirely rather than displaying a control that implies a restriction it does not enforce.

**Brand Alignment:** Law 5 — the same "nothing about a child happens out of the parent's sight" standard this document series holds the product to requires that the platform itself know, precisely, who can see what internally; a permission system that only appears to enforce this is itself a transparency gap.

---

### G.2 — An operator tool bypasses the human-review/release-check gate that the staff console otherwise enforces

**Severity:** High

**Current State:** The documented content-production pipeline requires every course to pass a release-verification check (`02` K3) before the staff console's Publish action (J1) will unlock — but a separate operator command-line tool, "Publish course (direct)," "publishes a course hierarchy by slug with direct updates" and explicitly "bypasses the release check used by the staff console" (`08` §6).

**Finding:** This is structurally the same pattern already flagged in D.4 (data-layer writes bypassing the API's state-machine rules): a safety-relevant gate is real and well-designed at the primary interface, but a second, lower-friction path exists that skips it entirely. Whatever operational reason motivated this direct-publish tool (an emergency fix, a migration convenience), it means the "no lesson reaches a child without human approval and the automated release-verification checks" guarantee this Block's opening paragraph credits the pipeline with is not, in fact, universally true.

**Mandated Requirement:** Either remove the direct-publish bypass, or restrict it to Superadmin use with a mandatory logged justification and a follow-up requirement that the bypassed release-verification check be run retroactively within a defined window (proposed: 30 days, pending validation — see Appendix N). No path to production content for children should exist that is structurally exempt from the same gates the primary interface enforces.

**Brand Alignment:** Law 5 — a safety gate with a documented back door is the same category of gap as a control that looks enforced but isn't.

---

### G.3 — Staff moderation decisions on live AI-Mentor activities are not captured in the central audit log

**Severity:** Medium

**Current State:** The platform's own documentation is explicit that "Mentor live-activity review decisions" are among the actions "not audited" in the central Audit Log — they are "recorded on the activity" itself instead (`05` §9). This differs from course/lesson status changes, which are audit-logged.

**Finding:** Staff review roughly 15% of AI-generated live Mentor activities before they reach a child, approving or rejecting each one (`02` J3) — a genuinely safety-relevant moderation decision, made about content a child will encounter in real time. Recording that decision only on the activity record itself, rather than in the searchable, staff-wide Audit Log, makes it materially harder to investigate a pattern (a specific reviewer approving borderline content repeatedly, for example) the same way E.2/E.3 required a searchable trail for follow/block/report patterns in the social layer.

**Mandated Requirement:** Add Mentor live-activity review decisions (approve/reject, reviewer, timestamp) to the central Audit Log, consistent with how course and lesson status changes are already treated.

**Brand Alignment:** Law 5 — the same completeness standard already mandated for the social layer's audit trail (E.2) applies to the platform's own content-safety moderation decisions.

---

### G.4 — The role and permission system has no lifecycle discipline

**Severity:** Medium

**Current State:** Per the platform's own documentation: "roles expire nowhere. There is no self-service downgrade. There is no invitation-based role assignment." (`05` §2.3)

**Finding:** This is a lower-urgency version of the D.5 "declared-but-unused states" pattern, applied to access governance rather than product features: a staff member's elevated access, once granted, persists indefinitely with no built-in review cadence, and there is no lightweight way to grant temporary or provisional access short of a full manual grant/revoke by a Superadmin.

**Mandated Requirement:** Add a periodic access-review cadence — proposed: quarterly, calendar-triggered, owned by the staff/access owner, to be validated against actual usage patterns — for Admin/Superadmin role holders and staff permissions, consistent with ordinary access-governance practice, and consider a time-bounded or invitation-based grant mechanism for lower-risk onboarding.

**Brand Alignment:** Law 5 — access that nobody is required to periodically re-justify is access nobody can currently vouch for.

---

### G.5 — The Insights staff screen is undiscoverable through normal navigation

**Severity:** Low-Medium

**Current State:** "S8 Insights exists as a route but does not appear in the staff navigation menu. It is reached only by direct address." (`01` §2.8 notes)

**Finding:** This is a minor finding on its own, but undocumented or unlisted internal surfaces are a recognized minor risk pattern in access-governance practice generally (an unlisted screen is more likely to be forgotten during a permissions review, precisely the review G.4 mandates establishing).

**Mandated Requirement:** Either add Insights to the staff navigation menu (if it is intended to be used) or formally deprecate/remove it (if it is not) — no staff-facing screen with access to first-party learning and usage data should exist in a state where its own team can forget it exists.

**Brand Alignment:** Law 5 — the same completeness standard applies to the platform's own internal map of what exists.

---

### G.6 — Genuine strengths worth explicitly preserving as standing constraints

**Severity:** Medium (governance item)

**Current State:** Two elements of the current design are confirmed, real safety strengths: staff cannot read a child's full AI Mentor conversation transcripts directly (access is limited to a 15% sample of individual generated activities plus their answer keys, not the surrounding conversation, and full transcript access is explicitly "⛔" for both Admin and Superadmin per `05` §3) or a child's banking/wallet data directly (reads are restricted to the child and their verified guardians, per `05` §8); and no staff "impersonation," "login as," or direct account-operation feature exists anywhere in the documented product (confirmed by an exhaustive search of the audit set).

**Finding:** As with E.12 and F.6, a strength that is never written down as a requirement is one a future redesign — a new support tool, a "view as user" debugging feature added under deadline pressure — can quietly remove without anyone treating it as a regression.

**Mandated Requirement:** Add "no staff read-access to full AI Mentor transcripts," "no staff read-access to banking/wallet data beyond the child and their guardians," and "no user-impersonation or login-as capability" to this document's list of standing constraints. Any future support tooling that appears to require transcript or banking visibility must be scoped as a new, explicitly-reviewed exception, not built by default.

**Brand Alignment:** Pillar 5 — "the parent stays in the room" extends to internal tooling: LittleFounders' own staff should have no more access to a child's private conversations or money than this document already requires of anyone else.

---

## Block G — Staff Console & Content Production Standard

**Status:** Mandatory design standard for the staff console and content-production domains. This section operationalizes the findings above into a working architecture, the same way the Standards for Blocks B through F operationalized their appendices — here, grounded directly in established access-control and audit-governance practice rather than a dedicated research appendix.

### The three components of the standard

1. **Enforced Access Control** (G.1, G.4) — every displayed permission actually restricts something; every elevated access grant has a defined review cadence.

2. **Gate Integrity** (G.2, G.3) — no path to production content or to a logged safety decision may bypass the same checks and the same audit trail the primary staff interface enforces.

3. **Standing Constraints & Discoverability** (G.5, G.6) — every staff-facing screen is either in active, documented use or removed; and the platform's existing internal restraint (no transcript access, no banking access, no impersonation) is written down as a constraint any future tooling must respect.

### Non-negotiable behavioral constraints (apply regardless of which component is active)

- No staff permission label may be displayed or audited unless it actually restricts something (G.1).
- No path to publishing content for children may bypass the release-verification check the primary staff interface enforces (G.2).
- No staff moderation decision affecting content a child will see may go unrecorded in the central Audit Log (G.3).
- No new staff tool may grant read access to a child's full AI Mentor transcript, banking data, or an impersonation capability without an explicit, separately-reviewed exception (G.6).

---

### Block G — Summary of Mandated Changes

| ID | Finding | Severity | Owner decision needed |
|---|---|---|---|
| G.1 | Staff permission labels are cosmetic; only admin/superadmin role actually gates access | Critical | Wire each permission to its named scope, or remove the granular UI |
| G.2 | Operator tool bypasses the release-check gate | High | Restrict/remove the direct-publish bypass; require logged justification |
| G.3 | Mentor live-activity review decisions are not in the central Audit Log | Medium | Add these decisions to the Audit Log |
| G.4 | No lifecycle discipline for roles/permissions (no expiry, no review cadence) | Medium | Add a periodic access-review cadence |
| G.5 | Insights screen undiscoverable (not in staff nav) | Low-Medium | Add to nav or formally deprecate |
| G.6 | Existing strengths (no transcript/banking access, no impersonation) are unprotected | Medium | Lock in explicitly as standing constraints |

**References:** `10-APPENDIX-N-STAFF-CONSOLE-METRICS-QA-PIPELINE.md` — success metrics, the Definition of Done per requirement, the production/QA pipeline, and the internal phasing/sequencing of all 6 Block G requirements.

---

## Block H — Analytics & Experimentation, and Operations

Covers: the first-party event beacon and analytics-consent gating, acquisition attribution, the analytics warehouse (rollups, experiments, anomaly detection, churn risk, forecasts, alerts), and platform operations (scheduled retention, backups, drift probes, deployment/migration automation) (`00` domains #18–#19; `03` §12; `05` §3, §6; `06` §"Analytics/backup integrations"; `07` full document; `08` full document; `09`). Like Block G, this Block's findings are engineering-governance and data-retention questions grounded in already-established principles (data minimization, retention discipline, incident-response practice) rather than contested science, so it is formalized directly, without a dedicated new research appendix, consistent with Block A's and Block G's precedent.

**A confirmed structural fact worth stating up front:** the analytics-consent gate for kid-role accounts is, on its own terms, one of the best-built controls found anywhere in this entire audit — the first-party event beacon does not even transmit for a kid-role account until the server confirms an active guardian consent exists, only a verified guardian can grant that consent, and "kid" always wins in role-based event stamping even when a person holds other roles too (`07` §"consent gating"; `05` §"Analytics consent gate"). This is a genuine positive benchmark, not a finding — several other consent gates elsewhere in this audit (most notably Block E's pre-fix follow graph) fall well short of this standard. The findings below concern the population this gate does not cover, and the operational/governance layer around it.

### H.1 — Self-registered teens and guests are excluded from the analytics consent gate, and are measured like adults

**Severity:** High

**Current State:** The analytics-consent gate is tied specifically to the **kid** role. Per the platform's own documentation: "Because analytics consent is tied to the kid role, guests and self-registered teens are measured like adults." (`07` §11; `05` §6)

**Finding:** This is the same "kid role ≠ minor" pattern already identified in A.3/A.4 (identity/age-screen gaps), D.3 (Family Hub/Banking exclusion), and E.8 (the social layer's missing age-tiering) — appearing again here, in a new domain, with the same root cause and the same population affected. A self-registered 13–17-year-old's in-app behavior is collected and analyzed with no guardian consent step at all, the same way an adult's is.

**Mandated Requirement:** Extend a consent-adjacent gate to the self-registered teen population specifically — not necessarily identical guardian-consent gating (no guardian is in this flow by design, per D.3's precedent), but at minimum a teen-facing, self-managed analytics disclosure/opt-out distinct from the silent, ungated collection this population currently receives, consistent with the two-tier model already established for this exact population in E.8. At minimum, the disclosure must name, in plain language, what analytics events are collected for this population, and the opt-out must provide a working toggle that actually suppresses non-essential event collection when switched off — distinct from safety-critical logging, which this toggle does not and must not suppress.

**Brand Alignment:** Law 5 — the same transparency standard already required for a guardian-managed child's data should have a self-managed equivalent for a teen with no guardian in the loop, not silence.

---

### H.2 — Inconsistent retention windows for overlapping underlying activity data, with no written policy reconciling them

**Severity:** Medium

**Current State:** Raw usage events are retained for 400 days in the operational store, while the analytics warehouse's own "sessions" dimension, built from that same underlying activity, is retained for only a rolling 90 days (`07` §10).

**Finding:** Neither window is wrong on its own, but nothing in the documented product explains why two different retention periods exist for overlapping data, or confirms this is a deliberate design choice rather than an unreconciled inconsistency — the same category of gap D.21 and E.11 already required a written retention policy to resolve for their own domains.

**Mandated Requirement:** Publish a written rationale (even a short one) for why the warehouse session window differs from the raw-event window, as part of a broader written retention policy for this domain, consistent with the precedent set in D.21 and E.11.

**Brand Alignment:** Law 5 — an unreconciled inconsistency in how long a family's data is kept is a small-scale version of the same transparency gap already flagged twice elsewhere in this document.

---

### H.3 — Several pieces of instrumentation are wired to record but never to notify or complete

**Severity:** Medium

**Current State:** Three separate, confirmed half-built mechanisms: two analytics events (`task_view`, `tutor_open`) have no emitter anywhere in the product (`07` §11); warehouse alerts "record triggers but deliver no webhook or email" — the alert fires internally and is stored, but nobody is ever notified (`07` §"alerts"; `00` §6); and asynchronous warehouse export jobs (CSV/JSON/Parquet) can be created and listed but "no processor advances them," so they remain permanently "pending" (`07` §11).

**Finding:** This is the same declared-but-unused pattern already flagged repeatedly in this document series (D.5, F.4, G.4) — applied here to the platform's own operational visibility. The alerts case is the most consequential of the three: an alerting system that silently records a trigger without ever notifying anyone is arguably worse than having no alerting system at all, since it can create false confidence that "there's a system for that" when in practice nobody is ever told.

**Mandated Requirement:** For each of the three: wire the missing event emitters, connect the alert-trigger mechanism to an actual notification channel (webhook or email, as the schema already implies it was designed to support), and either build the export-job processor or remove the ability to create a job that can never complete. Per the Definition-of-Done principle already established in Appendices C, F, H, J, and L: no mechanism may ship recording an event with no consumer that acts on it.

**Brand Alignment:** Law 5 — the same "no promise without a working feature behind it" principle already applied throughout this document series.

---

### H.4 — No external paging or alerting exists for scheduled job failures generally

**Severity:** Medium-High

**Current State:** Per the platform's own documentation: "Scheduled production jobs have no external paging or alerting. A failure surfaces only as a failed automation run. For the Mentor retention sweep there is additionally a watchdog job and a staff console status." (`08` §1)

**Finding:** The one exception the platform already built — a dedicated watchdog for the AI Mentor's 90-day deletion promise, because a silent failure there would mean the platform quietly stops honoring a specific, brand-stated commitment — shows the team already understands why this matters for at least one job. The same reasoning applies, with only slightly less urgency, to the daily backup jobs (which the platform relies on for disaster recovery of every family's data) and the schema drift probe (which is the platform's only defense against an unreviewed production schema change): a silent failure of either would currently go undetected except by someone manually checking a status screen.

**Mandated Requirement:** Extend the watchdog-plus-notification pattern already built for the Mentor retention sweep to, at minimum, the daily database backup job and the schema drift probe — the two other jobs whose silent failure would have the most serious consequences if undetected.

**Brand Alignment:** Law 5 — the brand's own "90-day promise" already earned a watchdog because breaking it silently would betray a stated commitment; the same logic extends to not losing a family's data to an unnoticed backup failure.

---

### H.5 — No documented incident-response or breach-notification process exists anywhere, and no statement confirms backup encryption

**Severity:** Medium-High

**Current State:** An exhaustive search of the entire audit document set found no documented incident-response process, no breach-notification procedure, and no statement confirming whether database backups — which explicitly include family and AI Mentor data (`08` §1) — are encrypted at rest.

**Finding:** This is a foundational governance gap for any platform holding children's and families' data, independent of whether an incident has ever occurred. The absence of a documented process is itself the finding: a written incident-response plan and confirmed backup-encryption status are baseline expectations in data-governance frameworks generally (reflected in, among others, ISO/IEC 27001's incident-management controls and ordinary breach-notification practice), and neither currently has a documented answer anywhere in this product's own record of itself.

**Mandated Requirement:** Document (a) whether backups are encrypted at rest, and if not, encrypt them; and (b) a baseline incident-response and breach-notification process, including who is notified internally, on what timeline affected families are informed, and what the platform's stated commitment is — consistent with the honesty this document series has required of every other domain's data-handling practices (D.21, E.11, H.2).

**Brand Alignment:** Law 5 — "transparency is love" cannot stop at the product's own UI; it has to include what happens if something goes wrong with the data behind it.

---

### H.6 — Genuine strength worth explicitly preserving as a standing constraint

**Severity:** Medium (governance item)

**Current State:** As stated in this Block's opening paragraph, the analytics-consent gate for kid-role accounts — no transmission without active guardian consent, guardian-only grant, "kid" always wins in stamping — is a genuinely well-built control.

**Finding:** Consistent with E.12, F.6, and G.6, a strength this well-built should be written down as the standard other consent gates in this product are measured against, not left as an implicit accident of this one domain's implementation.

**Mandated Requirement:** Add this gate's specific design (transmission blocked at the source, not filtered after collection; guardian-only grant; role-stamping precedence) to this document's list of standing constraints, and treat it explicitly as the reference implementation any future consent-gated feature in this product should be built to match.

**Brand Alignment:** Law 5 — name the standard the product already meets in one place, so it becomes the floor for every future feature, not a fact only findable by reading this appendix.

---

### H.7 — The experiment framework has no documented age-based eligibility consideration, ahead of it ever being wired up

**Severity:** Low-Medium

**Current State:** An experiment-assignment and exposure-tracking framework exists in the analytics warehouse; assignment is not currently role-restricted, and exposure events for a kid-role account are gated by the same analytics-consent rule as any other event. Nothing currently calls the exposure endpoint from the web app, so no live experiment currently reaches any user (`07` §5.4, §11).

**Finding:** Because nothing is live yet, this is a low-urgency finding — but it is the right moment to require the decision, before engineering pressure to ship a growth experiment arrives. Per the graduated-autonomy and age-tiering principles already established for the social layer (E.8) and Family Hub/Banking (D.3, D.17), a blanket "kid-role accounts are eligible for any experiment an adult is" default deserves the same deliberate review this document series has already required elsewhere, before the first experiment goes live rather than after.

**Mandated Requirement:** Before the experiment-exposure endpoint is ever called from the web app, define an explicit eligibility policy for kid-role and universal-teen accounts in experiments (which experiment categories, if any, they may be included in; whether growth/monetization-adjacent experiments are categorically excluded for this population) — a deliberate decision made in advance, not an unreviewed default inherited from the adult experiment framework.

**Brand Alignment:** Law 4 — testing growth or engagement mechanics on children without a deliberate, stated policy is the opposite of "reward the decision, not the amount"; the decision to include or exclude this population from a given experiment category should itself be a considered judgment, not a default.

---

## Block H — Analytics & Operations Standard

**Status:** Mandatory design standard for the analytics and operations domains. This section operationalizes the findings above into a working architecture, the same way the Standards for Blocks B through G operationalized theirs — grounded directly in established data-governance and reliability-engineering practice rather than a dedicated research appendix.

### The three components of the standard

1. **Consistent Consent & Retention Coverage** (H.1, H.2) — every population the product serves, including self-registered teens with no guardian in the loop, has an explicit, documented data-handling policy; no two retention windows for overlapping data exist without a written rationale.

2. **Operational Visibility That Actually Notifies** (H.3, H.4) — no instrumentation records an event, a trigger, or a job outcome without a real consumer or notification path acting on it; the watchdog-plus-notification pattern already built for the Mentor-retention promise extends to every job whose silent failure would have serious consequences.

3. **Governance Baseline & Standing Constraints** (H.5, H.6, H.7) — a documented incident-response process and confirmed backup-encryption status exist as a baseline; the platform's existing best-built consent gate (kid-role analytics) is written down as the reference standard; and any future experiment involving children is governed by a deliberate eligibility policy decided in advance.

### Non-negotiable behavioral constraints (apply regardless of which component is active)

- No population the product serves may have its behavioral data collected with less consent rigor than another, without an explicit, documented reason (H.1).
- No alert, event, or export job may be built to record without a real consumer that acts on what it records (H.3).
- No job whose silent failure would have serious consequences for family data may lack the watchdog-plus-notification pattern already proven for the Mentor-retention sweep (H.4).
- No experiment may reach a kid-role or universal-teen account until an explicit eligibility policy for that population has been decided (H.7).

---

### Block H — Summary of Mandated Changes

| ID | Finding | Severity | Owner decision needed |
|---|---|---|---|
| H.1 | Self-registered teens/guests excluded from analytics consent gate | High | Extend a teen-appropriate, self-managed disclosure/opt-out |
| H.2 | Inconsistent retention windows for overlapping data, no written rationale | Medium | Publish a written retention policy reconciling the windows |
| H.3 | Alerts, exports, and two events record but never notify/complete | Medium | Wire emitters, alert notifications, and the export processor |
| H.4 | No external paging/alerting for scheduled jobs beyond Mentor retention | Medium-High | Extend the watchdog pattern to backups and the drift probe |
| H.5 | No incident-response/breach-notification process; no backup-encryption statement | Medium-High | Document both, and encrypt backups if not already encrypted |
| H.6 | The kid-role analytics consent gate is a strength that's unprotected | Medium | Lock in explicitly as the reference standard |
| H.7 | No age-based eligibility policy exists for the (currently unused) experiment framework | Low-Medium | Define eligibility policy before the exposure endpoint is ever called |

**References:** `10-APPENDIX-O-ANALYTICS-OPERATIONS-METRICS-QA-PIPELINE.md` — success metrics, the Definition of Done per requirement, the production/QA pipeline, and the internal phasing/sequencing of all 7 Block H requirements.

---

## Document Status: Audit Complete — All 19 Product Domains Covered

Blocks A through H now cover every domain in the executive summary's product-domain inventory (`00` §4, domains 1–19): Acquisition & Identity (A), Learning (B), AI Mentor (C), Family Hub & Digital Banking (D), Profile & Social (E), Achievements (F), and Staff Console/Content Production/Analytics/Operations (G, H). This section closes the document series with a cross-block summary; it does not supersede any individual Block's own summary table above, which remains the authoritative per-item reference.

### Total requirements by Block

| Block | Domain | Items | Critical | High (incl. resolved-pivot) | Medium-High | Medium | Low-Medium |
|---|---|---|---|---|---|---|---|
| A | Acquisition & Identity | 6 | 2 | 3 | 0 | 1 | 0 |
| B | Learning | 28 | 4 | 10 | 5 | 8 | 1 |
| C | AI Mentor | 23 | 6 | 12 | 4 | 1 | 0 |
| D | Family Hub & Digital Banking | 23 | 3 | 7 | 5 | 8 | 0 |
| E | Profile & Social | 13 | 2 | 5 | 2 | 4 | 0 |
| F | Achievements | 6 | 1 | 1 | 2 | 2 | 0 |
| G | Staff Console & Content Production | 6 | 1 | 1 | 0 | 3 | 1 |
| H | Analytics & Operations | 7 | 0 | 1 | 2 | 3 | 1 |
| **Total** | | **112** | **19** | **40** | **20** | **30** | **3** |

*(Each row's figures are drawn directly from that Block's own summary table above; the "resolved-pivot" items — D.9 and E.7 — are the items marking where each Block's research foundation begins, counted as High. Block C's count (23, not the 24 raw `C.1`–`C.24` headings) treats C.8 and C.12 as a single item, consistent with Block C's own internal summary table above, since C.12 is a formal specification of C.8's mechanism rather than an independent finding — see the editorial note on C.12 itself.)*

### The single most severe finding across the entire audit

Read together, this review's judgment is that **E.1/E.2/E.3** (the pre-fix open, cross-family, stranger-followable social graph for kid-role accounts, with zero parental visibility and no reporting path) remains the most severe finding in the document — a genuine, unmitigated child-safety exposure with real-world regulatory precedent (Appendix I) directly on point.

**D.1** (the cosmetic card freeze) and **G.1** (cosmetic staff permissions) are the clearest instances of this audit's recurring "a control that displays as active but is not enforced" pattern, found independently in two unrelated domains — real evidence of an engineering-discipline gap worth watching for, though not, on the strength of two instances alone, proof it is fully systemic — and the "Enforced, not just displayed" Definition-of-Done criterion this document series established starting with Appendix H exists specifically to prevent a third recurrence.

A related but distinct pattern is worth naming separately, because it is easy to conflate with the cosmetic-control pattern above but is not the same failure: a **bypass path**, where a second write path skips a business-rule or safety gate the primary interface enforces, with no control of any kind on that second path — not a control that looks enforced but isn't, but the complete absence of one. **D.4** (data-layer writes bypassing the Core API's business-rule enforcement for chores, goals, redemptions, and banking) is the clearest instance, with related enforcement-boundary gaps in the same Block at **D.1/D.7**; **G.2** (an operator CLI tool that bypasses the human-review/release-verification gate for course publishing) is an independent instance of the same pattern in a different domain. Both patterns point to the same underlying discipline failure — a control that exists at one interface is not, on its own, evidence the underlying rule is enforced everywhere the same data can be written — and both are addressed by the same "Enforced, not just displayed" Definition-of-Done standard.

### The recurring cross-block pattern worth naming once, here

The finding that "the **kid** role, not date of birth, is the platform's only signal that an account belongs to a minor — and self-registered 13–17-year-olds and guests, holding only the **universal** role, are therefore excluded from nearly every age-based protection in the product" recurs, independently discovered, in **five separate domains**: identity/age-screens (A.3/A.4), the AI Mentor's own safety mechanisms (C.2/C.3/C.4 — the most extensively developed instance, spanning voice/microphone gating, content-moderation fail-open behavior, and memory-note guardian review), Family Hub & Banking (D.3), the social layer (E.8), and analytics consent (H.1). This is the single most consequential architectural decision in the entire product, and this document recommends it be treated as a cross-cutting platform decision — not re-litigated domain by domain — the next time engineering scoping begins: either extend a consistent, appropriately lighter-touch protection model to this population everywhere at once, or make an explicit, documented, company-level decision that this population is deliberately treated as adults, stated once rather than silently implied by omission in five different places.

### Appendix index

| Appendix | Block | Content |
|---|---|---|
| A | B | Interactive/visual catalog underlying B.7 |
| B | B | Pedagogical/developmental-psychology and ethical-gamification research |
| C | B | Success metrics, Definition of Done, lesson-production pipeline |
| D | C | Real-time affect-detection, knowledge-modeling, and conversational-pedagogy research |
| E | C | Self-improvement/"Harness AI" governance research |
| F | C | Success metrics, Definition of Done, real-time QA/deployment pipeline |
| G | D | Financial-socialization, behavioral-economics, and family-systems research |
| H | D | Success metrics, Definition of Done, production/QA pipeline |
| I | E | Child stranger-contact-risk, design-precedent, COPPA/AADC, and social-comparison research |
| J | E | Success metrics, Definition of Done, production/QA pipeline |
| K | F | COPPA/FTC disclosure doctrine, product precedent, and commodification-of-childhood research |
| L | F | Success metrics, Definition of Done, production/QA pipeline |
| M | A | Success metrics, Definition of Done, production/QA pipeline |
| N | G | Success metrics, Definition of Done, production/QA pipeline |
| O | H | Success metrics, Definition of Done, production/QA pipeline |
| P | B | Teaching visuals: mathematical representations, logic and money manipulables (extends B.7) |
| *(none)* | A, G, H | No dedicated deep research appendix — these Blocks' findings are grounded in the structural audit and established practice rather than contested science, per this document's proportionality principle; Appendices M, N, and O above cover their metrics/DoD/QA frameworks |

### What this document does not cover

This audit reviewed the product as documented in the `00`–`09` audit files and `COSMIC_NARRATIVE.md` as of September 2026. It does not cover: implementation-level code review (the audit works from documented architecture and data models, not a line-by-line source read); anything the underlying audit files did not themselves document (an absence in this document reflects an absence in the source material, not a confirmed absence in the live product); or cross-block engineering sequencing (each Block's own Part 4 phasing table sequences that Block's items internally; no attempt is made here to interleave all 112 items into one global roadmap, since that is a resourcing decision for engineering leadership, not a product-requirements decision).
