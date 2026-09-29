# SPEC migration: local completion report

For the project leader. Recorded 28 September 2026 on branch `codex/spec-migration-s02` (tip `08a70f06` plus this documentation commit). Nothing has been pushed or deployed, and no paid provider was called (OD-23).

**Bottom line.** Every requirement in the SPEC is implemented and locally verified. None is accepted or released. What remains needs people, production or owner-approved spend, and cannot be closed by writing code. It is listed in order in [section 7](#7-remaining-steps-before-production-in-order). The per-requirement ledger is [REQUIREMENTS.md](REQUIREMENTS.md), and the sprint history, lanes, merges and integration defects are in [SPRINTS.md](SPRINTS.md).

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

| Block | What exists in the code today |
|---|---|
| **A. Identity** | An age screen on every entry path: email, Google return and guest. The protected under-13 origin persists through guest upgrade. Only birth month and year are kept, and a declared teen becomes an adult on schedule. A child's email and username are locked at the API and by a database trigger on `auth.users`. A parent-created child always has Tutor-given age evidence. Tutor verification shows three statuses, and staff grants and revocations are audited in one transaction. A second Tutor joins by invite. The account-cancellation cascade and the 90-day purge are built. Every FAQ claim is backed by a working feature. |
| **B. Learning** | Atomic placement, and prerequisites enforced at course entry. The v2 lesson engine: immutable versions, strict public and private contracts, short-lived signed attempts, server scoring, non-punitive retry, reload recovery, version-pinned completion. The B.6 age-pathway engine, behind its switch until the owner reviews the policy (OD-22). The Appendix A and P boards, chart set, concept boards and KaTeX notation, all on the shared Pizarrón. The narrative, the decision journal and the Family Hub bridge. The Forge content and release gates, now up to gate 19 and carried onto v2 documents, with a reviewed v2 publication and staff release. The reward and wellbeing policies: no lives, the celebration budget, a habit streak with rest days, no randomized rewards, and age registers. |
| **C. Mentor** | Age-conservative policy and fail-closed moderation. Calibration first. Memory review, including teen self-review (OD-18). The hint ladder with a just-tell-me escape. Anti-sycophancy and the honesty record. Behavioral telemetry, the alliance controller, the disposition profile, spaced review and session end with a recap first. The judge-calibration harness, the evaluation loop and the quality dashboard. Tiered self-improvement governance with an append-only change record. Live generation stays off until the owner-run calibration. |
| **D. Family and wallet** | The freeze, and a state machine with a working flow for every declared state (OD-21). The self-registered teen's own wallet (OD-3 Option B). A forgiving chore streak, the split, pockets, goals and the Share destination. The independence ladder and the decision record. Three money registers by age. Retention, research consent and parent coaching, all behind human review. The section is named Wallet everywhere (OD-28). |
| **E. Profiles and social** | Private by default, with tiers by age, never by role. Guardian approvals. Report and block, with a pattern trigger by age. One erasure lifecycle, including notices to a teen's Tutors. No counts and no messaging. Cartoon avatars and preset covers only. Username safety review. Teen cooperative goals (OD-27 (1)) and the 16–17 discoverable opt-in (OD-27 (2)). |
| **F. Sharing** | Image-only sharing (OD-20), started by the guardian, with the achievement verified on the server and a disclosure at the point of action. Legacy links get per-link revoke, a 30-day expiry and an image purge. The legacy badge page is rebuilt until its dated removal on 24 October 2026. |
| **G. Staff** | Four named grants enforced in Core, with navigation filtered by the same table. Audited decisions. A quarterly access-review card. A standing-constraints gate: no transcript or wallet reach from staff routes, and no impersonation. Content release governance, with retroactive checks on every bypass. |
| **H. Analytics and ops** | Teen analytics by opt-in; nothing is collected under 13. A written retention rationale. Alerts that deliver, measured by delivery rate. Watchdog heartbeats and a failure drill. Encrypted backups. Experiments bounded by age. Disclosure-coverage and population-gap metrics. |
| **Cutover (OD-9, OD-24)** | A before-and-after inventory with per-family checksums, legacy-defect corrections, knowledge-component credit for completed legacy topics, consent carry-over and enforcement, encrypted backup and restore, the cutover and rollback runbooks, and a timed local rehearsal. |

## 3. What is implemented, per screen family

Every screen below is rebuilt on the shared controls and shells, in en-US, es-MX and pt-BR, light and dark, within the Copy Budget, and with no legacy component.

| Family | Screens | Record |
|---|---|---|
| Public site and sign-in | Landing, how it works, families, FAQ, legal (M1–M6, M8); the badge page (M7); sign-in, sign-up, recovery, verification, Google return, age screen, Become a Tutor (A1–A7); onboarding with the Diorama Mentor chooser (O1); suspended and deletion states (X1–X2) | [W2S](sprints/W2-SITE-AND-AUTH.md) |
| Learner | Home (L1), course (L2), course world (L3), placement (L4), the lesson route with its boards, compact Mentor band and results (L5), journal, rhythm and badges | [W2L](sprints/W2-LEARNER.md), [W3L](sprints/W3-LEARNER-ANSWERS.md) |
| Mentor | `/tutor`: the character on the Diorama with a speech plate, the board on demand, reply chips and the microphone where C.2 allows it. The chooser, My island, the learning map, the notebook, replay, roleplay and voice consent (T1a–T1g). The same stage component draws the lesson band. | [W2M](sprints/W2-MENTOR-STAGE.md), [W3M](sprints/W3-MENTOR-ANSWERS.md) |
| Family | Family console (F1), a child's progress (F2) and Mentor talks with read-only boards (F3), Tasks (F4), coin cards and the child's wallet with monthly statements (F5-P, F5-K), the teen Wallet `/wallet` | [W2F](sprints/W2-FAMILY-AND-WALLET.md) |
| Profile and social | Own profile (P1), look editor (P2), Settings (P3), people lists and other profiles (P4–P8), cooperative goals | [W2P](sprints/W2-PROFILE-AND-SOCIAL.md), [W3S](sprints/W3-SOCIAL-ANSWERS.md) |
| Staff console | Overview, Content, Users, Emails, Analytics & Health, Learning intel with Insights, Generation, Audit log, Roles & Access (S1–S10), Reports and Mentor quality | [W2T](sprints/W2-STAFF-CONSOLE.md) |
| Outside the app | The five account emails (light and dark), share cards, favicons and app icons from `brand.mark`, the achievement image, and the staff report PDF | [S03](sprints/S03-DESIGN-SYSTEM.md), [GAP-FIX-R2](sprints/GAP-FIX-R2.md) |

The system has 19 system glyph families (class A) and 333 own assets (class B), all registered in the asset manifest. The class B assets are drafts awaiting the owner's style review. `spec:check` freezes the remaining legacy code. The only legacy UI left is the OD-24 v1 lesson-player island, which plays the legacy catalog until the new catalog replaces it.

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

Every question raised since the answers of 27 September runs on its conservative default. Each lane record lists them under "owner questions" or "proposals".

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
```

README.md has every command, the conditional gate for each area, and each browser matrix.

## 6. Evidence

- **Per requirement:** each row of [REQUIREMENTS.md](REQUIREMENTS.md) links its checkpoint records, with commands, counts and limitations.
- **Final tree:** see "Final gate evidence" in [SPRINTS.md](SPRINTS.md#final-gate-evidence-28-september-2026-tip-08a70f06). It covers the repository gates on the tip, the 227-migration chain on native PostgreSQL, the isolated double reset and the real-HTTP checks, the rebuild audits, and the local production build.
- **Integration defects** found and fixed at merge are listed in the same section. Each one is also in its merge commit and in the lane record.

## 7. Remaining steps before production, in order

None of these is engineering work. Each unblocks the next.

1. **Owner style and visual approvals.** Approve or return the 333 draft assets (OD-14), then the S05 visual review ledger and the open lane proposals. Until then the strict `npm run build` refuses the drafts, so no deployable build contains one.
2. **Human reviews.**
   - Design, motion and copy review (Bible 02 §12).
   - Native es-MX and pt-BR review of the registration, consent and money copy (OD-11).
   - Product and Trust review.
   - Stage 3 Safety/Trust review of social, sharing and the reviewed free-text list.
   - The Pedagogical Lead: tips, thresholds, rubric v1, Tier 3.
   - Tier 1 sign-offs on the Mentor change record (C.22).
   - The first human-signed dark-pattern release audit (B.25), which `release:readiness` requires.
3. **Legal.**
   - Terms and Privacy Notice (OD-10), including month-and-year age retention.
   - Block D retention periods (D.21).
   - The research disclosure and consent model, before any family is asked (D.22).
   - Age 15 per market (D.19).
   - Deletion grace period and SLA (E.6).
   - Social retention windows (E.11).
   - The FAQ claims.
4. **Device and assistive-technology testing.** Physical phones and tablets, Safari and Firefox, screen readers, real safe areas, the low-power stage fallback, and the device share sheet.
5. **Owner-run paid steps under OD-23, each with an approved ceiling.**
   - The judge calibration (91 calls) and the human panels. Live Mentor generation stays off until this is done.
   - Pre-generated Mentor audio.
   - The OD-24 new catalog: the content team authors the v2 lessons, then `v2:author` with `--max-usd`, the Forge gates, `v2:publish` and the staff release. Runbooks: `docs/content/FORGE-V2-RELEASE.md` and `FORGE-OWNER-RUN-GENERATION.md`.
6. **Owner release decisions.** The pathway engine switch (OD-22), and the remaining owner questions, which run on their defaults until answered.
7. **Ops-owner preparation.**
   - Production alert channels (H.3).
   - Watchdog schedules and a drill against the deployed Core (H.4).
   - Confirmation that daily backups are encrypted (H.5, release-blocking).
   - Branch protection on `main`.
   - Naming the metric owners (C.24).
   - The first quarterly access review (G.4).
   - `GOTRUE_MAILER_SECURE_EMAIL_CHANGE_ENABLED=true` on Railway.
8. **Production deployment and cutover** ([CUTOVER-RUNBOOK](../operations/CUTOVER-RUNBOOK.md), [BACKUP-RESTORE-ROLLBACK](../operations/BACKUP-RESTORE-ROLLBACK.md)):
   - Run `release:readiness`, then `production:preflight`.
   - Freeze, then take and verify an encrypted backup.
   - Apply the 47 hand-applied contract migrations in their stated order, around their Core releases.
   - Run the OD-9 toolkit, then reconcile.
   - Get the §4.5 row-count and per-family sign-off from a person, and Legal's sign-off.
   - Switch. Deploy in the documented order: Depot before Core, and Core before Oracle for wire changes.
   - Run the post-release checks.
9. **After release.**
   - Retire the legacy catalog once the new one is live (`od9 retire-catalog`, runbook step 10).
   - The dated legacy badge-link removal (24 October 2026).
   - One release cycle of production metrics per requirement.
   - Only then can a requirement be marked Accepted.
