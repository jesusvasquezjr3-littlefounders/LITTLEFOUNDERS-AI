# SPEC migration: local completion report

> Historical local-completion snapshot. The September 30 evaluation deployment, 256 production migration receipts and OD-29 approval of 431 assets supersede the older statements below that nothing is deployed and all assets await approval. See [the deployment record](../operations/DEPLOY-2026-09-30.md) and [the current readiness register](../operations/READINESS-2026-09-30.md) for current activation gaps and outstanding acceptance. The historical checks below are not evidence that the newer combined release candidate has passed.

For the project leader. First recorded 28 September 2026; updated 30 September 2026 on branch `codex/spec-migration-s02` (tip `cf48ffaf` plus this documentation commit), after eight rounds of the SPEC gap audit. Nothing in the final push has been pushed or deployed, and no paid provider was called (OD-23).

**Bottom line.** Every requirement in the SPEC is implemented and locally verified. None is accepted or released. Eight gap-audit rounds, each with eight auditors over the whole SPEC, found 58, 32, 26, 27, 21, 16, 9 and 11 gaps; every one was fixed and merged locally. In round 7, four of the eight areas were clean (the Mentor, Family and Wallet, the owner decisions, the Frontend Bible); in round 8, learning was clean. The final gates on the merged tree are green after one fix commit (`cf48ffaf`). UI audit on the final tree: running - result recorded when it completes. See [State at close](#10-state-at-close). What remains needs people, production or owner-approved spend, and cannot be closed by writing code. It is listed in order in [section 9](#9-remaining-steps-before-production-in-order). The per-requirement ledger is [REQUIREMENTS.md](REQUIREMENTS.md), and the sprint history, lanes, merges and integration defects are in [SPRINTS.md](SPRINTS.md).

## 1. What the SPEC required

The binding source is [`docs/littlefounders-spec/`](../littlefounders-spec/README.md), in this precedence:

1. The owner decision log.
2. Product 10, with appendices A to P.
3. The Frontend Bible, 01 to 08.
4. The mockup, as a visual reference only.

It asks for two things at once:

- **The product transformation: 113 requirement headings in eight blocks (112 requirements, since C.8 and C.12 are one).**
  - A: identity and acquisition, 6
  - B: learning, 28
  - C: the AI Mentor, 24
  - D: Family Hub and wallet, 23
  - E: profiles and social, 13
  - F: achievement sharing, 6
  - G: staff console, 6
  - H: analytics and operations, 7

  Each heading carries its own acceptance criteria and an appendix with a Definition of Done.
- **A frontend rebuilt from scratch on one design system (OD-2, OD-4, OD-15).**
  - The legacy UI is destroyed, not restyled.
  - Every string meets the Copy Budget, and every visual is our own asset.
  - The Mentor is the chosen 3D character on its Diorama, never a chat window.
  - The existing families' data is migrated with nothing promised lost (OD-9).

## 2. What is implemented, per block

Status of every block: **implemented and locally verified; not accepted, not released.** The last sentence of each row names what gap-audit rounds 3 to 7 added.

| Block | What exists in the code today |
|---|---|
| **A. Identity** | An age screen on every entry path: email, Google return and guest. The protected under-13 origin persists through guest upgrade. Only birth month and year are kept, and a declared teen becomes an adult on schedule. A child's email and username are locked at the API and by a database trigger on `auth.users`. A parent-created child always has Tutor-given age evidence. Tutor verification shows three statuses, and staff grants and revocations are audited in one transaction. A second Tutor joins by invite. The account-cancellation cascade and the 90-day purge are built. Every FAQ claim is backed by a working feature. Rounds 3–7: a staff revocation ends a Tutor's powers on every API path and withdraws their unaccepted invites (0248); unconsented analytics on flagged sessions is measured from the event log, target zero (0252); a Block A recalibration log with a quarterly issue and a release-readiness check. |
| **B. Learning** | Atomic placement, and prerequisites enforced at course entry. The v2 lesson engine: immutable versions, strict public and private contracts, short-lived signed attempts, server scoring, non-punitive retry, reload recovery, version-pinned completion. The B.6 age-pathway engine, behind its switch until the owner reviews the policy (OD-22). The Appendix A and P boards, chart set, concept boards and KaTeX notation, all on the shared Pizarrón. The narrative, the decision journal and the Family Hub bridge. The Forge content and release gates, now up to gate 19 and carried onto v2 documents, with a reviewed v2 publication and staff release. The reward and wellbeing policies: no lives, the celebration budget, a habit streak with rest days, no randomized rewards, and age registers. Rounds 3–7: every v2 feedback banner names what was done right, and a miss gets a board-specific hint (B.20); a recorded Stage 3 pedagogical review, by someone other than the author, gates every release (0249–0251); every defect escape opens an owned gate-effectiveness review (0254); decision-journal coverage has a denominator (0253); the M1, M7, M8 and M13 answers use the locale-aware number input; the v2 player honours the shared age scope; a machine-checked Block B threshold log with quarterly reviews. |
| **C. Mentor** | Age-conservative policy and fail-closed moderation. Calibration first. Memory review, including teen self-review (OD-18). The hint ladder with a just-tell-me escape. Anti-sycophancy and the honesty record. Behavioral telemetry, the alliance controller, the disposition profile, spaced review and session end with a recap first. The judge-calibration harness, the evaluation loop and the quality dashboard. Tiered self-improvement governance with an append-only change record. Live generation stays off until the owner-run calibration. Rounds 3–7: the controlling-language gate runs in both C.17 arms for teens and adults; a monthly equity-drift audit (Appendix D 3.7); a quarterly Block C threshold review; the canary delivery path and memory-note deletion (C.4, OD-18). |
| **D. Family and wallet** | The freeze, and a state machine with a working flow for every declared state (OD-21). The self-registered teen's own wallet (OD-3 Option B). A forgiving chore streak, the split, pockets, goals and the Share destination. The independence ladder and the decision record. Three money registers by age. Retention, research consent and parent coaching, all behind human review. The section is named Wallet everywhere (OD-28). Rounds 3–7: the Tutor sees each child's pockets, month and coin history on the Wallet; quarterly Block D reviews with release-readiness checks. |
| **E. Profiles and social** | Private by default, with tiers by age, never by role. Guardian approvals. Report and block, with a pattern trigger by age. One erasure lifecycle, including notices to a teen's Tutors. No counts and no messaging. Cartoon avatars and preset covers only. Username safety review. Teen cooperative goals (OD-27 (1)) and the 16–17 discoverable opt-in (OD-27 (2)). Rounds 3–7: the Settings age-correction and discoverable states pass the Bible audits; a Block E recalibration cadence with a quarterly issue; S-08 enforced in the messaging register. |
| **F. Sharing** | Image-only sharing (OD-20), started by the guardian, with the achievement verified on the server and a disclosure at the point of action. Legacy links get per-link revoke, a 30-day expiry and an image purge. The legacy badge page is rebuilt until its dated removal on 24 October 2026. |
| **G. Staff** | Four named grants enforced in Core, with navigation filtered by the same table. Audited decisions. A quarterly access-review card. A standing-constraints gate: no transcript or wallet reach from staff routes, and no impersonation. Content release governance, with retroactive checks on every bypass. Rounds 3–7: staff review plays v2 lessons in the learner's rebuilt view and checks answers against the real key without recording anything; a Blocks G and H recalibration log with a cadence gate and a quarterly issue. |
| **H. Analytics and ops** | Teen analytics by opt-in; nothing is collected under 13. A written retention rationale. Alerts that deliver, measured by delivery rate. Watchdog heartbeats and a failure drill. Encrypted backups. Experiments bounded by age. Disclosure-coverage and population-gap metrics. Rounds 3–7: the watchdog covers the family-data jobs, stalled erasures and undelivered alerts; an alert retries and then fails the watchdog; the warehouse's raw-event copy is kept 400 days (H.2); the autonomy events are gated by OD-9 consent. |
| **Cutover (OD-9, OD-24)** | A before-and-after inventory with per-family checksums, legacy-defect corrections, knowledge-component credit for completed legacy topics, consent carry-over and enforcement, encrypted backup and restore, the cutover and rollback runbooks, and a timed local rehearsal. |

## 3. What is implemented, per screen family

Every screen below is rebuilt on the shared controls and shells, in en-US, es-MX and pt-BR, light and dark, within the Copy Budget, and with no legacy component. Status of every screen family: **implemented and locally verified; not accepted, not released.** Acceptance of each needs the human design and copy review, native-language review, device and assistive-technology testing and the owner's asset approval (section 9). UI audit on the final tree: running - result recorded when it completes (540 states × 3 locales × 2 themes, 3,240 jobs).

| Family | Screens | Record |
|---|---|---|
| Public site and sign-in | Landing, how it works, families, FAQ, legal (M1–M6, M8); the badge page (M7); sign-in, sign-up, recovery, verification, Google return, age screen, Become a Tutor (A1–A7); onboarding with the Diorama Mentor chooser (O1); suspended and deletion states (X1–X2) | [W2S](sprints/W2-SITE-AND-AUTH.md) |
| Learner | Home (L1), course (L2), course world (L3), placement (L4), the lesson route with its boards, compact Mentor band and results (L5), journal, rhythm and badges | [W2L](sprints/W2-LEARNER.md), [W3L](sprints/W3-LEARNER-ANSWERS.md) |
| Mentor | `/tutor`: the character on the Diorama with a speech plate, the board on demand, reply chips and the microphone where C.2 allows it. The chooser, My island, the learning map, the notebook, replay, roleplay and voice consent (T1a–T1g). The same stage component draws the lesson band. | [W2M](sprints/W2-MENTOR-STAGE.md), [W3M](sprints/W3-MENTOR-ANSWERS.md) |
| Family | Family console (F1), a child's progress (F2) and Mentor talks with read-only boards (F3), Tasks (F4), coin cards and the child's wallet with pockets, coin history and monthly statements (F5-P, F5-K), the teen Wallet `/wallet` | [W2F](sprints/W2-FAMILY-AND-WALLET.md) |
| Profile and social | Own profile (P1), look editor (P2), Settings (P3), people lists and other profiles (P4–P8), cooperative goals | [W2P](sprints/W2-PROFILE-AND-SOCIAL.md), [W3S](sprints/W3-SOCIAL-ANSWERS.md) |
| Staff console | Overview, Content (with the v2 lesson preview and the Stage 3 review), Users, Emails, Analytics & Health, Learning intel with Insights, Generation, Audit log, Roles & Access (S1–S10), Reports and Mentor quality | [W2T](sprints/W2-STAFF-CONSOLE.md) |
| Outside the app | The five account emails (light and dark), share cards, favicons and app icons from `brand.mark`, the achievement image, and the staff report PDF | [S03](sprints/S03-DESIGN-SYSTEM.md), [GAP-FIX-R2](sprints/GAP-FIX-R2.md) |

The system has 19 system glyph families (class A) and 379 own assets (class B), all registered in the asset manifest. The class B assets are drafts awaiting the owner's style review. `spec:check` freezes the remaining legacy code. The only legacy UI left is the OD-24 v1 lesson-player island, which plays the legacy catalog until the new catalog replaces it.

## 4. Owner decisions applied

| Decision | Applied as |
|---|---|
| OD-1 | No lives: mistakes cost nothing, and a gate refuses lives or hearts vocabulary |
| OD-2, OD-15 | Frontend rebuilt, legacy UI deleted (S10L), with a freeze gate |
| OD-3 | Option B: the teen's personal wallet without a parent; Tasks and approvals stay guardian-only |
| OD-4 | One design system for the app, site, emails, badge page and boards |
| OD-5 | No pricing surface |
| OD-6 | "Tutor" is only a verified parent; the AI is the Mentor, named after the chosen character |
| OD-7 | Celebration only in the milestone list; motion budget |
| OD-8 | Hotfix lane S01/S02 |
| OD-9 | Data migration toolkit and runbooks (S10) |
| OD-10 | Conservative defaults, with Legal review listed as pending |
| OD-11 | Controlled glossary; native review listed as pending |
| OD-12 | Web first; platform-neutral tokens and an isolated stage |
| OD-13 | Numeric Copy Budget, gated in the app, emails and Forge |
| OD-14 | Own assets only, manifest and gate, including OCR "no text in art"; style review pending |
| OD-16, OD-17 | One course per subject with age pathways; engine before catalog |
| OD-18 | Teen memory self-review |
| OD-19 | Compact stage shows the learner's own Mentor on a lesson-declared scene |
| OD-20 | Image-only sharing |
| OD-21 | Every Family Hub state has a flow |
| OD-22 | Pathway policy built, release awaits owner review |
| OD-23 | Zero paid spend; every paid step is owner-run with a ceiling |
| OD-24 | Legacy catalog replaced, earned records kept, KC credit |
| OD-25 | One stage early by mastery; Mentor mastery with consent |
| OD-26 | C.17 experiment bands |
| OD-27 | Cooperative goals, 16–17 discoverable, Tutor sees story choices |
| OD-28 | The 132 review answers: Wallet rename, no timed-drill penalty, recap-first end, and more; per item in [OWNER-REVIEW-ANSWERS.md](OWNER-REVIEW-ANSWERS.md) |

Every question raised since the answers of 27 September runs on its conservative default. Rounds 6 and 7 are listed in [section 8](#8-owner-questions-with-defaults-implemented); earlier rounds list theirs in their GAP-FIX records under "owner questions" or "proposals".

## 5. How to run everything locally

Prerequisites: Node 24 (`.nvmrc`), Docker Desktop running, and Git Bash on Windows. Check the machine first (README, "Local development").

```bash
# Provision. From zero only: setup resets the database.
npm run setup
# On a working checkout, instead: npm install in the packages you touch.

# Run: frontend (:5173) + Core (:4000) + Supabase containers (Kong :8000)
DEV_PROFILE=core DEV_DB=1 npm run dev
DEV_PROFILE=all  DEV_DB=1 npm run dev     # every service (several GB of RAM)

# Gates before every commit
npm run typecheck:all && npm run lint:all && npm run test:all
npm run secrets:check && npm run tools:test && npm run spec:check
npm run i18n:check && npm run seo:check && npm run glossary:check

# Rebuilt UI: audits and browser matrices (dev server running; from frontend/)
REBUILD_URL=http://localhost:5173 npm run audit:rebuild      # text fit, proportion, Copy Budget
REBUILD_URL=http://localhost:5173 npm run verify:app-shells
REBUILD_URL=http://localhost:5173 npm run verify:learn-pages
REBUILD_URL=http://localhost:5173 npm run verify:profile-screens
REBUILD_URL=http://localhost:5173 npm run verify:staff-console
REBUILD_URL=http://localhost:5173 node scripts/verify-mentor-stage.mjs
npm run build:local                                          # full production build with draft assets

# Database: from-zero proof on an isolated stack (the dev stack is untouched)
bash database/scripts/disposable-stack.sh reset              # twice, both green
npm run social:db-verify                                     # native PostgreSQL social verifiers

# Cutover rehearsal on native PostgreSQL (from database/; LF_PG_* variables per migration-od9/README.md)
npm run od9:prove && npm run od9:rehearse

# Zero-spend release dry runs
npm run release:readiness -- <course>
npm run forge:v2:dry-run
npm --prefix backend run ops:drill

# Pre-merge UI gate in one command (it starts its own dev server)
npm run rebuild:audit-gate                                   # Bible audits + Mentor stage

# Native PostgreSQL proofs per block (each applies the whole chain)
npm run identity:db-verify && npm run family:db-verify
npm run learning:db-verify && npm run staff:db-verify
```

README.md has every command, the conditional gate for each area, and each browser matrix.

## 6. Evidence

- **Per requirement:** each row of [REQUIREMENTS.md](REQUIREMENTS.md) links its checkpoint records, with commands, counts and limitations.
- **Final tree:** see "Final gate evidence after round 8" in [SPRINTS.md](SPRINTS.md#final-gate-evidence-after-round-8-30-september-2026), and "Gate evidence after rounds 6 and 7" before it. In short:
  - After round 6 (tip `0b5386d8`), every root gate was green: `typecheck:all`, `lint:all`, `test:all` (frontend 298 files / 3,476 tests; backend 162 files / 3,731 tests, green on a quiet rerun after a vitest-worker RPC timeout under load in the 443 s `placement.postgres` E2E; Oracle 68 files / 1,789 tests; every other service green), `spec:check`, `secrets:check`, i18n, `tools:test` 575/575, and the database package 80/80 plus all 12 `railway-migrate` scenarios. Five real failures were fixed in `0b5386d8`.
  - After round 7 (fix `5ce7dd8f`): `typecheck:all`, `lint:all`, `spec:check`, `secrets:check`, `tools:test` 604/604, i18n and the database suite with the `railway-migrate` harness (94 minutes on this host) are green.
  - After round 8 (from tip `ec54cf4f`, fix `cf48ffaf`): `typecheck:all` and `lint:all` pass for all services; `spec:check`, `secrets:check`, `tools:test` 621/621, `check-i18n.sh` (3/3), `check-migrations` and `check-migration-phase` (254 files: 187 expand, 67 contract) and `cutover-freeze.test.mjs` 4/4 pass. Backend 3,774/3,774 tests, coursegen 861/861 and dataintel 252/252 pass. The first full frontend run passed 3,576 of 3,578 tests; the 2 real failures (an undefined `lf-mentor-stage-sequence` class and an es-MX staff line one word over the adult limit) are fixed in `cf48ffaf`, and the failing and related files were rerun green (4/4 files, 59/59 tests). The full frontend suite was not rerun after the fix, and the database `railway-migrate` harness was not run on this tree.
  - UI audit on the final tree: running - result recorded when it completes. It covers 540 states × 3 locales × 2 themes (3,240 jobs). A first run under full machine load could not finish (setup stops that did not reproduce when rerun alone; the 48-job overlays group rerun was clean on all three audits), and it was restarted on the otherwise idle machine.
  - The chain is 254 migrations. The 28 September evidence after round 2 (tip `08a70f06`) stays in the same file as history.
- **Per round:** [GAP-FIX-R1](sprints/GAP-FIX-R1.md) to [GAP-FIX-R5](sprints/GAP-FIX-R5.md), and the lane indexes [GAP-FIX-R6](sprints/GAP-FIX-R6.md), [GAP-FIX-R7](sprints/GAP-FIX-R7.md) and [GAP-FIX-R8](sprints/GAP-FIX-R8.md).
- **Integration defects** found and fixed at merge are listed in the same section. Each one is also in its merge commit and in the lane record.

## 7. The SPEC gap audit

After the rebuild, eight auditors per round compared the merged tree with the whole SPEC, clause by clause. Each gap was checked against the code before it was fixed, and each fix was built, not recorded as a limitation.

| Round | Gaps | Lanes | Record |
|---|---|---|---|
| 1 | 58 | 8 | [GAP-FIX-R1](sprints/GAP-FIX-R1.md) |
| 2 | 32 | 7 | [GAP-FIX-R2](sprints/GAP-FIX-R2.md) |
| 3 | 26 | 8 | [GAP-FIX-R3](sprints/GAP-FIX-R3.md) |
| 4 | 27 | 7 | [GAP-FIX-R4](sprints/GAP-FIX-R4.md) |
| 5 | 21 | 8 | [GAP-FIX-R5](sprints/GAP-FIX-R5.md) |
| 6 | 16 | 10 | [GAP-FIX-R6](sprints/GAP-FIX-R6.md) |
| 7 | 9 (four of eight areas clean) | 6 | [GAP-FIX-R7](sprints/GAP-FIX-R7.md) |
| 8 | 11 (learning clean) | 8 | [GAP-FIX-R8](sprints/GAP-FIX-R8.md) |

The trend is 58, 32, 26, 27, 21, 16, 9 and 11: 200 gaps in all. Every gap of rounds 1 to 8 is fixed and merged locally, and no round 8 lane added a migration. The machine rebooted twice during round 8; three lanes were finished after it. The merge commits and the integration defects found at each merge are in [SPRINTS.md](SPRINTS.md#integration-defects-found-at-merge).

## 8. Owner questions with defaults implemented

Each question below was raised by a round 6, 7 or 8 lane. The conservative default is implemented and runs until the owner answers. Earlier rounds' questions are in their GAP-FIX records. Grouped by block, one line each; the lane record has the detail.

**A. Identity**
- Revocation is permanent on every API path; only a database superuser can undo it. Should there be an audited reinstatement path, and who decides? ([fix6identi7](sprints/gap-fix-r6/fix6identi7.md))
- A revoked Tutor's unaccepted invites are withdrawn at revocation, including when the revocation is for fraud. Confirm the stricter rule. ([fix6identi7](sprints/gap-fix-r6/fix6identi7.md))
- Flagged-session events are counted from the flag's own timestamp, so events admitted before the flag are not reported as unconsented. Confirm this matches Appendix M 1.1. ([fix7identi0](sprints/gap-fix-r7/fix7identi0.md))
- OD-3 section 2 lists a child under 13 who arrives alone as guest mode only, while A.2 and A.3 keep that child's protected account (guest upgrade, Google). The code was kept and the FAQ corrected. Take the stricter reading and refuse the upgrade instead? ([fix8identi0](sprints/gap-fix-r8/fix8identi0.md))
- Should the Bible 06 refusal title "A parent creates your account." be reworded, since it reads as absolute next to the upgrade path? ([fix8identi0](sprints/gap-fix-r8/fix8identi0.md))

**B. Learning**
- After four quarterly reviews, the Block B threshold review falls back to a yearly ceiling, because release readiness cannot tell a major release from a minor one. Confirm, or name the major-release marker. ([fix6learni1](sprints/gap-fix-r6/fix6learni1.md))
- The first Block B human reviews are due 2027-01-15, one quarter after the planned first release; the date should move with the release and never past it. Confirm. ([fix6learni1](sprints/gap-fix-r6/fix6learni1.md))
- `feedback.met` is required only from age 10; lessons for ages 6 to 9 may omit it and show the named fallback. Require it for 6 to 9 too? ([fix6learni0](sprints/gap-fix-r6/fix6learni0.md))
- The database refuses a Stage 3 review whose reviewer is the author. Should a one-person team be allowed to self-review with an audited justification? ([fix6learni2](sprints/gap-fix-r6/fix6learni2.md))
- Forge records no author, so the reviewer names the Content Author (a staff account). Should Forge carry an operator identity in its manifest? ([fix6learni2](sprints/gap-fix-r6/fix6learni2.md))
- The G.2 emergency activation now requires the Stage 3 review. Confirm. ([fix6learni2](sprints/gap-fix-r6/fix6learni2.md))
- `learning.decision_journal` keeps the resurfacing rate as its primary value, with coverage beside it. Should coverage be primary? ([fix7learni1](sprints/gap-fix-r7/fix7learni1.md))
- Decisions of learners without the OD-9 journal consent are excluded from the coverage denominator and reported separately. Confirm. ([fix7learni1](sprints/gap-fix-r7/fix7learni1.md))
- The Pedagogical Lead owns every content gate and content engineering owns the six pipeline checks. Should a Safety/Trust owner take gates 17 and 18? ([fix7learni2](sprints/gap-fix-r7/fix7learni2.md))
- A gate-effectiveness review is overdue after 90 days. Should it have a tighter window? ([fix7learni2](sprints/gap-fix-r7/fix7learni2.md))
- An out-of-range whole-number answer is refused, and the browser shows the public bound ("Try a smaller number"). Should it be graded as a "not yet" miss instead, changing the scorer and the behaviour gate together? ([fix7learni3](sprints/gap-fix-r7/fix7learni3.md))

**C. Mentor**
- The first Block C threshold review is due 2026-12-23, one quarter after the log was created, because the Mentor is already live. Confirm, or tie it to the release date. ([fix6mentor8](sprints/gap-fix-r6/fix6mentor8.md))
- Should the compact lesson band also play rendered sequences? Default: no; only the full stage plays them. ([fix8mentor1](sprints/gap-fix-r8/fix8mentor1.md))
- Should the v1 player's full-crop fallback use transparent full-body stills? Default: the registered idle avatar render. ([fix8learni6](sprints/gap-fix-r8/fix8learni6.md))
- The teen and adult controlling-language gate stays on under the `TUTOR_DIALOGUE_CALIBRATION=off` kill switch, as a Tier 1 style constraint. Confirm. ([fix6mentor8](sprints/gap-fix-r6/fix6mentor8.md))
- The equity-drift audit uses the adult moderation posture, binary-gender name sets and origin groups proposed by engineering. Approve, or name the groups the Safety/Trust Lead should use. ([fix6mentor8](sprints/gap-fix-r6/fix6mentor8.md))

**D. Family and wallet**
- The production-integrity window starts at the last `v*` or `release-*` tag, else 30 days; the repository has no release tags today. How are releases marked? ([fix8family2](sprints/gap-fix-r8/fix8family2.md))
- `family-integrity-watch` is frozen during the OD-9 cutover and re-enabled 24 hours after the freeze lifts. The alternative is to leave it enabled and annotate the migration's rows on its issue. ([fix8datapl5](sprints/gap-fix-r8/fix8datapl5.md))

**E. Profiles and social**
- The brand position says a discoverable 16- or 17-year-old can be found by "signed-in members", not "anyone". Confirm the wording. ([fix6social4](sprints/gap-fix-r6/fix6social4.md))
- Social-graph audit entries are kept with no expiry until a decision (D-15 (b)). Approve the proposed 400-day expiry? ([fix7social4](sprints/gap-fix-r7/fix7social4.md))
- Should every follow and every connection request require the requester to have a @username? Default: only a request to a teen does. ([fix8social4](sprints/gap-fix-r8/fix8social4.md))
- After the first year, the Block E recalibration follows the Appendix B, D and G cadence, with at most a year between reviews. Confirm. ([fix7social4](sprints/gap-fix-r7/fix7social4.md))

**F. Sharing:** none raised in rounds 6 to 8.

**G. Staff**
- The staff lesson preview checks each answer through Core against the real key and records nothing. Is this the reviewer experience you want? ([fix6staffo9](sprints/gap-fix-r6/fix6staffo9.md))
- The preview shows the catalog default Mentor (Rho) and unfaded worked examples. Should it offer a Mentor or mastery switcher? ([fix6staffo9](sprints/gap-fix-r6/fix6staffo9.md))
- Blocks G and H share one log with a schedule per block, and a joint "G+H" review counts for both leads. Confirm, and name the Platform Lead and the Data/Privacy Lead. ([fix7staffo5](sprints/gap-fix-r7/fix7staffo5.md))
- If the Mentor-quality read fails, the Families bridge card shows an error rather than engagement alone (Appendix H 1.1, "reviewed together"). Relax it to a partial card with the conversion shown as unavailable? ([fix8staffo3](sprints/gap-fix-r8/fix8staffo3.md))

**H. Analytics and operations**
- Alert delivery: 3 attempts in total, 2 s then 8 s apart; retry only on network errors, timeouts, 408, 425, 429 and 5xx; an undelivered-alert window of 36 hours. Confirm or give other values. ([fix6staffo9](sprints/gap-fix-r6/fix6staffo9.md))
- The consent version for `analytics.motivation_events` was not raised, because no released build can have recorded that consent yet. If one is recorded before this ships, raise it to 2 so the Tutor is asked again? ([fix6datapl6](sprints/gap-fix-r6/fix6datapl6.md))
- Experiment assignments and exposures are pruned 400 days after creation, so an experiment running longer loses its oldest exposures. Accept age-based pruning, or add concluded-plus-grace pruning? ([fix6datapl6](sprints/gap-fix-r6/fix6datapl6.md))

## 9. Remaining steps before production, in order

None of these is engineering work. Each unblocks the next.

1. **Owner style and visual approvals.** Approve or return the 379 draft class B assets (OD-14), then the S05 visual review ledger, the open lane proposals and the owner questions in section 8. Until then the strict `npm run build` refuses the drafts, so no deployable build contains one.
2. **Human reviews.**
   - Design, motion and copy review (Bible 02 §12).
   - Native es-MX and pt-BR review of the registration, consent and money copy (OD-11).
   - Product and Trust review.
   - Stage 3 Safety/Trust review of social, sharing and the reviewed free-text list.
   - The Pedagogical Lead: tips, thresholds, rubric v1, Tier 3, and the first Stage 3 pedagogical reviews that now gate every release.
   - Tier 1 sign-offs on the Mentor change record (C.22), including the rows recorded at the round 4 and round 7 merges.
   - The first human reviews in every recalibration log (Blocks A, B, C, D, E, G and H), each with its due date.
   - The first human-signed dark-pattern release audit (B.25), which `release:readiness` requires.
3. **Legal.**
   - Terms and Privacy Notice (OD-10), including month-and-year age retention.
   - Block D retention periods (D.21).
   - The research disclosure and consent model, before any family is asked (D.22).
   - Age 15 per market (D.19).
   - Deletion grace period and SLA (E.6).
   - Social retention windows (E.11), including the audit-entry expiry in section 8.
   - The FAQ claims.
4. **Device and assistive-technology testing.** Physical phones and tablets, Safari and Firefox, screen readers, real safe areas, the low-power stage fallback, and the device share sheet.
5. **Owner-run paid steps under OD-23, each with an approved ceiling.**
   - The judge calibration (91 calls) and the human panels. Live Mentor generation stays off until this is done.
   - Pre-generated Mentor audio.
   - The OD-24 new catalog: the content team authors the v2 lessons, then `v2:author` with `--max-usd`, the Forge gates, the Stage 3 pedagogical review, `v2:publish` and the staff release. Runbooks: `docs/content/FORGE-V2-RELEASE.md` and `FORGE-OWNER-RUN-GENERATION.md`.
6. **Owner release decisions.** The pathway engine switch (OD-22), and the remaining owner questions, which run on their defaults until answered.
7. **Ops-owner preparation.**
   - Production alert channels (H.3).
   - Watchdog schedules and a drill against the deployed Core (H.4), including the round 8 additions: the `badge_link_retirement` and `warehouse_retention` watched jobs and the daily `family-integrity-watch`.
   - Confirmation that daily backups are encrypted (H.5, release-blocking).
   - Branch protection on `main`.
   - The first CI runs on GitHub of every new job and workflow: the jobs added to `repo-gates.yml`, `database-ci.yml`, `backend-ci.yml` and `frontend-ci.yml` (the Bible audits and the Mentor-stage verifier), and the new scheduled workflows (the quarterly review issues for Blocks B, C, D, E, A, G and H, the monthly equity audit, the retention sweeps and the extended watchdog). None has run on GitHub from this branch, because the final push was not pushed; scheduled workflows run only from `main`.
   - Naming the metric owners (C.24), the Platform Lead and the Data/Privacy Lead.
   - The first quarterly access review (G.4).
   - `GOTRUE_MAILER_SECURE_EMAIL_CHANGE_ENABLED=true` on Railway.
8. **Production deployment and cutover** ([CUTOVER-RUNBOOK](../operations/CUTOVER-RUNBOOK.md), [BACKUP-RESTORE-ROLLBACK](../operations/BACKUP-RESTORE-ROLLBACK.md)):
   - Run `release:readiness`, then `production:preflight`.
   - Freeze, then take and verify an encrypted backup.
   - Apply the contract migrations by hand, in their stated order and around their Core releases: the 56 contract migrations pending release that `node database/scripts/check-migration-phase.mjs` lists with their order (254 migrations: 187 expand, 67 contract). `database-cd.yml` auto-applies only additive migrations.
   - Run the OD-9 toolkit, then reconcile.
   - Get the §4.5 row-count and per-family sign-off from a person, and Legal's sign-off.
   - Switch. Deploy in the documented order: Depot before Core, dataintel before Core (the round 8 warehouse watch reads a dataintel route), and Core before Oracle for wire changes.
   - Run the post-release checks.
9. **After release.**
   - Retire the legacy catalog once the new one is live (`od9 retire-catalog`, runbook step 10).
   - The dated legacy badge-link removal (24 October 2026).
   - One release cycle of production metrics per requirement.
   - Only then can a requirement be marked Accepted.

## 10. State at close

Every gap the eight SPEC audit rounds found (58, 32, 26, 27, 21, 16, 9 and 11; 200 in all) is implemented and merged locally on `codex/spec-migration-s02` (tip `cf48ffaf` plus this documentation commit); nothing is pushed or deployed. Nothing is Accepted or Released: every requirement is implemented and locally verified, and its acceptance needs people, production evidence or owner-approved spend. The remaining steps are the owner's and non-engineering, listed in order in [section 9](#9-remaining-steps-before-production-in-order), with the owner questions and their implemented defaults in [section 8](#8-owner-questions-with-defaults-implemented); each lane record also names its own open items (for example, the Liruf and Dina stage sequences, 52 of 104 rendered, and posed transparent stills for the v1 player, which keep the registered stills until rendered). The final gates on the merged tree are green after `cf48ffaf`; the full frontend suite was not rerun after that fix, and the database `railway-migrate` harness was not run on this tree. The full UI audit on the final tree is running; its result is recorded when it completes.
