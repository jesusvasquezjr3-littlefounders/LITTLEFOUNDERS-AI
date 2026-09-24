# Appendix L — Achievement Sharing Success Metrics, Definition of Done, and Production/QA Pipeline

**Status:** Authoritative operational framework closing Block F. Appendix K answers what the evidence and real-world precedent actually support about sharing a child's achievement publicly. This appendix answers the same three questions Appendices C, F, H, and J answered for their own Blocks, scaled to this Block's smaller footprint: **how do we know this feature is actually safer, not just differently designed; how do we know a given requirement is done; and how does a change to the sharing mechanism get built, tested, and released** without quietly reintroducing a permanent, unrevocable, undisclosed public exposure of a child's identity.

---

## Part 1 — Success Metrics Framework

Two categories, scaled to this Block's scope. No single category may be used alone to declare Block F "working."

### 1.1 Exposure & Compliance Metrics

| Metric | What it measures | Data source | Target | Verifies |
|---|---|---|---|---|
| Persistent Public URL Rate | % of newly created achievement shares that result in a company-hosted, indefinitely-public URL (as opposed to a downloadable artifact with no persistent public URL) | Share-creation event log | Establish baseline pre-F.1; target zero if the image-artifact architecture is adopted, or 100% compliant with noindex/expiration if a page architecture is retained | F.1 |
| Revocation Availability & Usage | % of active shares for which a "revoke" control is reachable from the parent's Family panel, and the rate at which parents actually use it | Family panel event log | 100% availability once F.2 ships; usage rate is diagnostic, not a target | F.2 |
| Revocation Enforcement Completeness | % of revoked shares for which the underlying badge image (not just the `/badge/{token}` page) is confirmed unreachable at its own storage URL | Automated adversarial test against Media Storage | 100% — a revoked share whose image still resolves directly is a Critical regression, not a partial success | F.2 |
| Share Link Lifespan | Median and 95th-percentile time between share creation and either expiration, revocation, or account deletion | Achievement Share event log | Establish baseline; should trend toward the defined expiration window once F.2 ships, rather than trending toward "indefinite" | F.2 |
| Point-of-Share Disclosure Comprehension | Sampled parent comprehension check (or, at minimum, confirmed display) of the point-of-action disclosure required by F.3 | Sampled UX/support audit | Establish baseline; disclosure must be confirmed displayed on 100% of share actions | F.3 |
| Search-Engine Indexing Rate | % of badge-share URLs (if the page architecture is retained) that appear in search-engine indexes | External search-index spot-check | Zero, once the `noindex`/no-sitemap requirement in F.1 ships | F.1 |

### 1.2 QA & Production Metrics

| Metric | What it measures | Data source | Target | Verifies |
|---|---|---|---|---|
| Schema Field Utilization Audit | For every field on the Achievement Share entity (including the age-band field), confirmation that at least one flow produces and at least one flow consumes it | Schema/flow audit, tied to the Appendix C/F/H/J Definition-of-Done pattern | 100% coverage; no declared field ships without both a producer and a consumer | F.4 |
| Brand-Narrative Coverage Check | Confirms `COSMIC_NARRATIVE.md` (or its living equivalent) carries an explicit, current statement on the badge-sharing feature | Documentation audit, owned per Part 4 | Present and current once F.5 ships | F.5 |
| Standing-Constraint Integrity | Confirms guardian-only initiation, server-side achievement verification, and first-name-only data minimization remain true after any redesign of the sharing mechanism | Release-gate test suite | Pass, every release, no exceptions | F.6 |

---

## Part 2 — Definition of Done

### 2.1 Generic Definition of Done (applies to every item F.1–F.6)

Mirrors the standard already set in Appendices C, F, H, and J. A requirement is not "done" when code merges. It is done when all four of the following are true:

1. **Functional** — the described behavior is implemented and a test reproducing the exact scenario in the requirement's "Current State" now passes.
2. **Enforced, not just displayed** — where the requirement concerns an exposure boundary (revocation, expiration, non-indexability), a test confirms the boundary actually holds (a revoked link genuinely 404s; an expired link genuinely stops resolving; a page marked `noindex` is verified absent from a search-index spot-check), not merely that a setting exists.
3. **Measured** — at least one metric from Part 1 is instrumented and reporting real production data tied to this requirement within one release cycle of shipping; for any such metric not explicitly labeled "Diagnostic — no fixed target" in Part 1, that production data must also be trending toward the metric's stated target before this criterion is satisfied — reporting a number alone is not sufficient.
4. **Reviewed** — for a requirement grounded in Appendix K's regulatory or precedent research (F.1–F.3, F.5), a reviewer explicitly checks the implementation against that research's specific design implication; for a structural/schema item (F.4, F.6), a reviewer confirms the specific "Current State" defect no longer reproduces.

### 2.2 Worked example — the highest-ambiguity item

**F.1 (architecture reconsideration):** Done when (a) a documented decision has been made and implemented between the image-artifact architecture and the guarded-page architecture, (b) if the page architecture is retained, an automated test confirms the page is excluded from any sitemap and carries a `noindex` directive, verified by an external crawl spot-check, (c) the Persistent Public URL Rate and Search-Engine Indexing Rate metrics (Part 1.1) are both reporting the target state, and (d) F.2's revocation/expiration controls are confirmed shipped simultaneously — F.1 is not done if a page is kept "temporarily" without F.2's controls attached, since that recreates the exact permanent-and-unrevocable state F.1 exists to fix.

---

## Part 3 — Production/QA Pipeline for Achievement Sharing Changes

A shorter pipeline than Appendices H and J's, proportionate to this Block's smaller footprint, but preserving the same core discipline: separating "does it display correctly" from "does it actually bound the exposure."

**Stage 0 — Scoping** (Safety/Trust Lead + Engineering Lead, human)
Any change to the sharing mechanism is classified as **exposure-boundary** (touches the persistence, indexability, revocability, or information content of a shared artifact) or **presentation-only** (copy, visuals with no change to what is exposed or for how long). Exposure-boundary changes are automatically subject to Stage 2.

**Stage 1 — Development** (Engineering, human or AI-assisted)
The change is authored.

**Stage 2 — Automated Adversarial Testing** (machine, mandatory for exposure-boundary changes)
Confirms a revoked link actually stops resolving **at both the page and the underlying image storage URL** (not the page alone), an expired link actually stops resolving, a `noindex` page is actually excluded from crawl, and no new field or flow silently expands what a public artifact exposes beyond first name, achievement label, and image without a corresponding explicit product decision and disclosure update (F.3).

**Stage 3 — Regulatory & Brand Review** (Safety/Trust Lead, human — mandatory for any exposure-boundary change)
Checks the change against Appendix K's design implications and against F.5's brand-narrative statement, flagging to counsel any change that alters what is disclosed publicly about a child, consistent with the governance boundary Appendix K itself establishes.

**Stage 4 — Release & Instrumentation** (Engineering)
The change ships with its relevant Part 1 metric already instrumented.

**Stage 5 — Post-Launch Recalibration** (Safety/Trust Lead, on a quarterly cadence, consistent with Appendices H and J)
Real production data (Share Link Lifespan, Revocation Availability & Usage) feeds back into the expiration-window default proposed in F.2. An exposure-boundary regression (a revoked or expired link still resolving) triggers an immediate rollback, consistent with the kill-switch discipline established in Appendices F, H, and J.

---

## Part 4 — Internal Sequencing & Phasing of Block F

| Phase | Items | Dependency | Rationale |
|---|---|---|---|
| **0 — Architecture decision** | F.1 | None | The image-vs-page architecture decision determines the shape of every other fix in this Block; it must be made first, not discovered mid-implementation of F.2/F.3 |
| **1 — Exposure bounding** | F.2 | Phase 0 | Revocation and expiration are meaningless to design in detail until the underlying artifact type (image vs. page) is decided |
| **2 — Disclosure and housekeeping** | F.3, F.4 | Phase 1 | The point-of-share disclosure (F.3) should describe the actual shipped behavior from Phases 0–1, not the current one; the schema cleanup (F.4) is independent but low-risk to sequence alongside |
| **3 — Governance** | F.5, F.6 | Phase 2 | The brand statement (F.5) and the standing-constraints lock-in (F.6) are most meaningful once the actual mechanics they describe are final |

---

## A note on why this appendix exists

Everything in F.1–F.6 describes what must be true of the achievement-sharing mechanism. Without this appendix, "a revoke button exists" or "the page says noindex" could be treated as sufficient on their own, the same shallow-verification mistake this document series has already flagged in D.1, D.4, D.7, and E.1. The Enforced-not-just-displayed criterion in Part 2.1 and the adversarial Stage 2 testing in Part 3 exist so that a revoked link that still quietly resolves, or a noindex page still findable through some other path, is never mistaken for a fixed exposure.
