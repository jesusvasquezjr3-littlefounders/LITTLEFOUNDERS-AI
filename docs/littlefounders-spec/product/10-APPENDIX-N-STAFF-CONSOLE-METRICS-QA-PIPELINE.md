# Appendix N — Staff Console & Content Production Success Metrics, Definition of Done, and Production/QA Pipeline

**Status:** Authoritative operational framework closing Block G. Block G (`10-PRODUCT-GOLD-STANDARD-REQUIREMENTS.md`, items G.1–G.6) shipped without a dedicated companion appendix of this kind, alongside Blocks A and H — a gap an independent audit flagged given that G.1 is a Critical-severity finding the main document itself describes as "the staff-console equivalent of D.1's cosmetic card freeze." This appendix closes that gap for Block G, answering the same three questions Appendices C, F, H, J, L, and M answered for their own Blocks: **how do we know the staff console's access controls and the content-production pipeline's release gates actually restrict and enforce what they claim to, not just display a label that implies a restriction; how do we know a given requirement is done; and how does a change to staff permissions, the publishing pipeline, or platform operations get built, tested, and released** without quietly reintroducing an unenforced permission label or an ungated publish path.

---

## Part 1 — Success Metrics Framework

Three categories. No single category may be used alone to declare Block G "working" — a permission system can look correctly configured in Roles & Access while enforcing nothing server-side, exactly as G.1 describes.

### 1.1 Access-Control Enforcement Metrics

| Metric | What it measures | Data source | Target | Verifies |
|---|---|---|---|---|
| Permission-Endpoint Enforcement Coverage | % of the four staff permissions (manage_users, manage_content, view_analytics, manage_support) verified, per release, to actually gate their named endpoints/screens server-side (manage_content → Content and Generation; view_analytics → Analytics, Intelligence, Insights; manage_users → Users; manage_support → Emails and support-adjacent tooling) | Automated adversarial test suite | 100% — any permission that gates nothing server-side is a Critical finding, not a partial pass | G.1 |
| Cosmetic-Permission Regression Test | Per-release adversarial test confirming a staff account whose permission label is removed or restricted in the UI is actually rejected server-side on the corresponding API call, for each of the four permissions independently | Release-gate test suite | Pass, every release, no exceptions — this is the single highest-priority regression to guard against in this Block, directly analogous to Appendix H's Freeze-Enforcement Verification for D.1 | G.1 |
| Privilege Differentiation Rate | % of Admin accounts whose actual server-side access differs meaningfully according to which of the four permissions they hold, as opposed to receiving blanket admin-level access regardless of granted permissions | Access-control audit log vs. API authorization log | 100% once G.1 ships (if the wired-permission remedy is chosen); if the alternate remedy is chosen instead (removing the granular UI in favor of one undifferentiated staff tier), this metric is retired and replaced by a check confirming no unenforced permission UI remains | G.1 |
| Access-Review Cadence Compliance | % of Admin/Superadmin role holders and granted staff permissions reviewed within the defined periodic review cadence | Access-review log | 100% | G.4 |
| Stale-Grant Rate | % of elevated access grants (Admin, Superadmin, or any staff permission) with no review or re-justification within the cadence window | Access-review log vs. grant-creation timestamp | Trending toward zero; not expected to be zero immediately upon this metric's introduction, but any grant exceeding the window without review is flagged | G.4 |

### 1.2 Gate & Audit Integrity Metrics

| Metric | What it measures | Data source | Target | Verifies |
|---|---|---|---|---|
| Release-Verification Bypass Rate | % of course-publish actions that occurred via the "Publish course (direct)" operator CLI tool without the release-verification check (`02` K3) having been completed, either before or retroactively within a defined window (proposed: 30 days, pending validation) | Publish event log (staff console + CLI) cross-referenced against release-verification results | Zero, unless the bypass is explicitly restricted to logged, justified Superadmin use per G.2's mandated requirement — see the bypass-path note below | G.2 |
| Bypass-Path Justification & Retroactive-Check Completeness | % of direct-publish bypass uses that carry a mandatory logged justification and a retroactive release-verification check completed within the defined window (proposed: 30 days, pending validation) | CLI/operator-tool audit log | 100% — any bypass use missing either a justification or the retroactive check is a finding, not a tolerance | G.2 |
| Mentor Live-Activity Review Audit-Log Completeness | % of staff Mentor live-activity approve/reject moderation decisions that produce a corresponding entry in the central Audit Log (not only on the activity record itself) | Central Audit Log vs. raw moderation-decision event stream | 100%, verified per release | G.3 |

**A note on the G.2 bypass-path pattern:** G.2 is a specific instance of a recurring cross-block pattern this audit series keeps finding: a safety-relevant gate is real and well-designed at the primary interface, but a second, lower-friction write path — usually an operator or data-layer tool built for an emergency fix or migration convenience — skips it entirely. The identical structure recurs at **D.4** (Family Hub/Banking data-layer writes bypassing the API's state-machine rules, documented in `10-APPENDIX-H-FAMILY-HUB-BANKING-METRICS-QA-PIPELINE.md`), and the main requirements document's closing cross-block synthesis names this as a recurring pattern across Blocks, not a one-off. Any future audit of a new domain in this product should explicitly check for a "second write path" of this shape before declaring a primary-interface gate sufficient.

### 1.3 Discoverability & Standing-Constraint Metrics

| Metric | What it measures | Data source | Target | Verifies |
|---|---|---|---|---|
| Staff-Screen Navigation Parity | % of active, in-use staff-facing screens (e.g., Insights) reachable through the staff navigation menu, or formally documented as deprecated/removed if not | Navigation-menu audit vs. route inventory | 100% — no active screen may be reachable only by direct address, undocumented | G.5 |
| Standing-Constraint Integrity | Per-release confirmation that no staff read-access to a child's full AI Mentor transcripts, no staff read-access to banking/wallet data beyond the child and their verified guardians, and no user-impersonation/"login as" capability has been introduced anywhere in the product | Release-gate test suite + codebase/route audit | Pass, every release, zero exceptions unless a new capability is explicitly scoped and separately reviewed per G.6's mandate | G.6 |

---

## Part 2 — Definition of Done

### 2.1 Generic Definition of Done (applies to every item G.1–G.6)

Mirrors the standard already set in Appendices C, F, H, J, L, and M. A requirement is not "done" when code merges. It is done when all four of the following are true:

1. **Functional** — the described behavior is implemented and a test reproducing the exact scenario in the requirement's "Current State" now passes.
2. **Enforced, not just displayed** — where the requirement concerns an access-control or gate boundary (a staff permission, the release-verification check, the transcript/banking/impersonation standing constraints), a deliberately adversarial test confirms the boundary actually holds server-side, through the API directly, not merely that the UI hides or shows the correct control. This is the standard already established in Appendices H, J, L, and M, and it is the exact standard G.1 exists to meet: the main document explicitly names G.1 as "the staff-console equivalent of D.1's cosmetic card freeze" — a permission label that is stored, displayed, and audited but restricts nothing is no safer than no permission system at all, and this criterion is not satisfied by confirming the label renders correctly in Roles & Access.
3. **Measured** — at least one metric from Part 1 is instrumented and reporting real production data tied to this requirement within one release cycle of shipping, and, for any metric with a fixed (non-diagnostic) target, production data is trending toward that target, not merely flowing.
4. **Reviewed** — a reviewer explicitly confirms the specific "Current State" defect no longer reproduces, and, for G.1 and G.2 specifically, that review includes signing off on adversarial-test results demonstrating server-side enforcement, not a Roles & Access screenshot or a staff-console walkthrough.

### 2.2 Worked example — G.1 (staff permission enforcement)

**G.1 (staff permission labels are cosmetic):** Done when (a) each of the four staff permissions is wired to gate its named endpoints/screens server-side — manage_content gates Content and Generation, view_analytics gates Analytics/Intelligence/Insights, manage_users gates Users, manage_support gates Emails and support-adjacent tooling — verified by a test exercising each permission independently, (b) a mandatory adversarial test confirms that a staff account with a given permission label removed or restricted in the Roles & Access UI is actually rejected — not merely hidden from — the corresponding API call, for each of the four permissions, (c) granting one permission is confirmed, by the same adversarial suite, not to implicitly grant access gated by any of the other three, and (d) the Permission-Endpoint Enforcement Coverage and Cosmetic-Permission Regression Test metrics (Part 1.1) both report 100% pass for at least one full release cycle before this item is marked done. If, instead, the alternate remedy is chosen (removing the granular permission UI and audit trail entirely in favor of one undifferentiated staff tier), G.1 is done when that UI and its associated audit entries are fully removed, verified by a code/route audit confirming no control remains that implies a restriction it does not enforce. G.1 is not done if the four permissions are correctly displayed and correctly logged on every grant but a staff account can still reach Content, Analytics, Users, or support tooling by holding only the admin role, regardless of which permissions were actually granted — that is precisely the cosmetic-control state this item exists to fix.

### 2.3 Worked example — G.2 (release-verification bypass path)

**G.2 (operator tool bypasses the release-check gate):** Done when (a) either the direct-publish bypass is removed entirely, verified by a code audit confirming the CLI tool no longer has a code path that skips the release-verification check, or it is restricted to Superadmin use with a mandatory logged justification field, verified by a test attempting the bypass without a Superadmin role or without a justification and confirming both are rejected, (b) if the bypass is retained, a follow-up mechanism runs the bypassed release-verification check retroactively within a defined window (proposed: 30 days, pending validation), verified by a test confirming the retroactive check actually executes and its result is recorded, and (c) the Release-Verification Bypass Rate and Bypass-Path Justification & Retroactive-Check Completeness metrics (Part 1.2) both report the target state for at least one full release cycle. G.2 is not done if the CLI tool still exists, unrestricted, with the bypass note in its own documentation unchanged — a documented bypass is still a bypass.

---

## Part 3 — Production/QA Pipeline for Staff Console & Content Production Changes

This is the answer to "how does a change to staff permissions, the publishing pipeline, or platform operations get built and released without reintroducing a G.1-style gap between a permission label and what it actually enforces, or a G.2-style bypass around a safety gate." Because this domain governs who inside the company can see and change what, every stage explicitly separates "does the permission or gate display correctly" from "does it actually restrict or enforce" — the distinction whose absence produced this Block's Critical and High findings.

**Stage 0 — Scoping & Risk Classification** (Platform Lead + Engineering Lead, human)
Every change is classified into one of three categories before development starts: **access-control/enforcement-boundary** (touches a staff permission's server-side gating, a role grant, a release-verification or publish-path gate, or the logging of a safety-relevant staff decision), **content-pipeline** (touches the plan→write→AI-judge→localize→illustrate→publish flow itself, short of the release gate), or **presentation-only** (nav labels, screen copy, layout with no access or gate change). Any change classified access-control/enforcement-boundary is automatically subject to Stage 2 with no exception, regardless of how small it appears — this is the specific lesson of G.1 and G.2, where the gap was not a large feature but an unenforced label and an unrestricted second path.

**Stage 1 — Development** (Engineering, human or AI-assisted)
The change is authored.

**Stage 2 — Automated Adversarial Testing** (machine, mandatory for access-control/enforcement-boundary changes)
A deliberately adversarial test suite exercises the change as a staff account with reduced or removed permissions, or a bypass attempt, would: for any permission change, is a staff account with that permission label removed in the UI actually rejected server-side on the corresponding API call; for any publish-path change, can a course reach production through any path (staff console or operator tool) without the release-verification check having run or without a logged Superadmin justification; do Mentor live-activity review decisions actually produce a central Audit Log entry; does no new tool grant transcript, banking, or impersonation access without an explicit, separately-reviewed exception? A change failing this stage returns to Stage 1 with an itemized failure report identifying exactly which enforcement path failed to hold.

**Stage 3 — Content Ops Review** (Content Ops Lead, human — mandatory for any change to the content-production pipeline, including any change to or around the release-verification gate; a distinct role from the Engineering Lead who scoped or authored the change, even when the same person occasionally fills both, to avoid a false sense of independent review)
Confirms the pipeline's existing, confirmed strengths — the 9-dimension AI-judge rubric with child safety as a hard floor, the deterministic vocabulary/correctness gates, the frozen and separated answer keys, and the mandatory human staff approval step — remain intact and are not weakened by the change, and specifically confirms no new or modified operator tool introduces a second write path that skips the release-verification check the primary staff interface enforces (the G.2 pattern).

**Stage 4 — Access-Governance Review** (Platform Lead, human — mandatory for any change to roles, permissions, or the access-review cadence)
Confirms access-review cadence compliance, permission-scope correctness against the four named permissions, and that any new staff-facing screen is added to the staff navigation menu or is formally and visibly deprecated rather than left reachable only by direct address.

**Stage 5 — Release & Instrumentation** (Engineering)
The change ships with its relevant Part 1 metric already instrumented, as a launch requirement, not a follow-up ticket.

**Stage 6 — Post-Launch Recalibration** (Platform Lead, on a quarterly cadence, consistent with Appendices H, J, L, and M)
Real production data (access-review cadence compliance, bypass-path usage, Audit Log completeness) feeds back into this Block's thresholds. A regression in the Cosmetic-Permission Regression Test or the Release-Verification Bypass Rate triggers an immediate rollback rather than a patch under pressure, consistent with the kill-switch discipline already established in Appendices F, H, J, L, and M — these two metrics guard against this Block's two most severe, already-confirmed failure modes.

---

## Part 4 — Internal Sequencing & Phasing of Block G

| Phase | Items | Dependency | Rationale |
|---|---|---|---|
| **0 — Trust-critical enforcement fix** | G.1 | None | The Critical-severity, confirmed-cosmetic permission system is the prerequisite for every other access-governance item in this Block (and, per this appendix's Part 3, for trusting any future change classified access-control/enforcement-boundary) to mean anything at all; it is the same urgency class as D.1's card-freeze fix and must ship first |
| **1 — Gate integrity** | G.2, G.3 | None hard (may proceed in parallel with Phase 0) | Both are safety-relevant gate/audit-completeness fixes to the content-production pipeline — closing the release-verification bypass and adding Mentor live-activity decisions to the central Audit Log — and neither depends on G.1's access-control rewiring being complete, though both should land before Phase 2's lower-urgency governance work |
| **2 — Access lifecycle governance** | G.4 | Phase 0 | A periodic access-review cadence is only meaningful to establish once the permissions being reviewed (Phase 0) actually restrict something; reviewing a cosmetic permission on a schedule accomplishes nothing |
| **3 — Discoverability & standing constraints** | G.5, G.6 | None hard | Lower-urgency documentation and navigation fixes — adding Insights to the staff nav or formally deprecating it, and writing down the platform's existing no-transcript/no-banking/no-impersonation strengths as standing constraints — that can proceed independently once the higher-severity Phase 0–1 work is underway |

---

## A note on why this appendix exists

Everything in G.1–G.6 describes what must be true of the staff console and content-production domain. Without this appendix, "the four permissions are visible and audited in Roles & Access" could be treated as sufficient on its own — the exact shallow-verification mistake this document series has already flagged in D.1, D.4, D.7, E.1, and A.2/A.3. G.1 is not a hypothetical risk: the platform's own documentation states, verbatim, that no endpoint checks these permissions and access is decided solely by the admin/superadmin role — a control that visibly exists, is dutifully audited every time it changes, and restricts nothing. The Enforced-not-just-displayed criterion in Part 2.1, the mandatory adversarial Stage 2 testing in Part 3, and the Cosmetic-Permission Regression Test in Part 1.1 exist specifically so that a staff permission label being present, correctly displayed, and correctly logged is never again mistaken for that permission actually restricting anything — and so that G.2's operator-tool bypass, and any future bypass of the same shape found elsewhere in this product (as it already was at D.4), is treated as a first-class finding rather than an overlooked back door.
