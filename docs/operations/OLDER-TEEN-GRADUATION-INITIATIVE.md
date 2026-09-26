# Older-teen graduation initiative ("Beyond the app")

**Status:** Product 10 D.19. Scoped by Engineering as a named initiative with its first milestone built and measurable (S07.7, 2026-09-24), on the SPEC's conservative default. The SPEC asks Product to scope it within two quarters of approval and to keep it a tracked, owned open decision until then: **the owner must still name the Product owner of this initiative** (owner question), and Product may rescope every later milestone. Nothing here is accepted.

## The problem

LF Coins never convert to real currency and nothing in the simulation connects to a real decision (Appendix G §3.1, §3.3). Two findings make that a structural risk, not a missed feature:

- **Timing.** Education delivered close to a real decision outperforms education delivered long before it with no reinforcement ("just in time", the one recommendation both sides of the Fernandes/Lynch/Netemeyer versus Kaiser/Lusardi/Menkhoff/Urban debate share). A teen who practised for years and then meets a first paycheck with no bridge faces exactly the long, unreinforced gap that literature describes.
- **Capability.** A simulation can build the ability half of financial capability (knowledge, skills, confidence) but never the opportunity half (access to real products and institutions; Sherraden 2013).

## What the initiative is, and is not

It is an age-gated path, timed to the teen's own real-world moments, from practice in the app toward real decisions outside it. It is **not** a bank, a card, an account link or a way to move money: coins never convert, no real amount is stored, and the D.7 gate fails on any payment, card-issuing or bank-linking SDK. Any milestone that would connect to a real financial product needs its own owner decision, Legal review and a D.7 control entry first.

## Milestones

| # | Milestone | Status |
|---|---|---|
| 1 | **Beyond the app (built in S07.7).** From 15, by stored age evidence and never role, a wallet holder (a family child or a self-registered teen) sees three real-world moments: first real pay, first account at a bank, first real budget. When the teen says a moment has arrived, its three-step checklist opens (just in time). The first-pay moment carries a split tool that applies the teen's own usual split to a real amount, in the browser only. Only the teen's own ticks are stored. | Implemented and locally verified; not accepted |
| 2 | **Graduation curriculum.** Lessons timed to the same moments (a first pay slip and deductions, taxes, an account's fees, a budget), written in Forge on the shared knowledge-component graph (B.6, OD-16's adult pathway), opened from the moment itself. Taxation and how banks profit stay shallow even for teens who handle money (Appendix G §1.5), so these need real teaching, not tips. | Proposed; belongs to the S05 lane and Forge (OD-23: generation is an owner-run step) |
| 3 | **Graduation at 18.** When a family child turns 18: a clear handover of their record (export, keep, or delete), their own research consent (D.22's Tutor yes lapses at 18), and a personal space that no longer runs under a Tutor's approvals. | Proposed; needs owner decisions on the adult account model (OD-3 has no personal adult wallet) |
| 4 | **Optional real-world linkage.** Any link to a real account or a real income source (read-only at most). | Not scoped; explicitly out of scope until an owner decision, Legal review and a D.7 control entry |

## Milestone 1 in detail

- **Eligibility.** `money_bridge_eligible()`: a wallet holder whose stored birth date makes them 15 or older. No birth date, no known age, no bridge. The age is in the Block D threshold log (`bridge.min_age`, a proposal awaiting Product and Legal review per market).
- **What is stored.** `money_bridge_progress`: which moment the teen said arrived (step 0) and which steps they ticked (1 to 3), with the time. A step waits for its moment; unticking a moment clears it. Kept while the account exists and erased with it (`FAMILY-DATA-RETENTION.md`).
- **API.** `GET /api/v1/family-hub/bridge`, `POST /api/v1/family-hub/bridge` (wallet holders; the database decides eligibility).
- **Surfaces.** `frontend/src/rebuild/wallet/MoneyBridge.tsx`, mounted on the teen wallet and the child's Banking page, in three locales, teen register.
- **Nothing celebrates.** A real-world moment is not on OD-7's milestone list.

## Measured

Appendix H Part 1.1, Real-World Bridge Engagement Rate (Diagnostic, no target): `GET /api/v1/admin/family/bridge-engagement`, eligible teens, how many engaged at all, how many marked each moment, how many finished its checklist. Read it together with Appendix C's Real-World Bridge Conversion Rate (Learning to Family Hub) once that exists.

Appendix H's Definition of Done for D.19 asks that (a) a documented, age-gated design exists (this file), (b) a first phase shipped and is measurable (milestone 1 and the metric above, plus the D.20 scope statement), and (c) the Longitudinal-Hypothesis Data Completeness metric shows the transition population is tracked: `GET /api/v1/admin/family/research-completeness` reports a `bridge_age` cohort (15+). (a) and (b) are implemented and locally verified; (c) is instrumented and needs production data and consenting families.

## Open

- The owner names the Product owner of the initiative; Product confirms or rescopes milestones 2 to 4 within two quarters of approval.
- Product and Legal review of the eligibility age (15) per market, and of the checklist wording.
- Appendix H Stage 5: family usability testing with real 15 to 17-year-olds.
