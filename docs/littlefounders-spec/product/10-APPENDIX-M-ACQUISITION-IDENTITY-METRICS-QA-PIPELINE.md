# Appendix M — Acquisition & Identity Success Metrics, Definition of Done, and Production/QA Pipeline

**Status:** Authoritative operational framework closing Block A. Block A (`10-PRODUCT-GOLD-STANDARD-REQUIREMENTS.md`, items A.1–A.6) shipped without a dedicated companion appendix of this kind, alongside Blocks G and H — a gap an independent audit flagged given that A.2 and A.3 are Critical-severity findings describing live, unaddressed paths for a minor to reach the product with none of the safeguards the rest of the platform builds specifically for children. This appendix closes that gap for Block A, answering the same three questions Appendices C, F, H, J, and L answered for their own Blocks, scaled to this Block's front-door scope: **how do we know the acquisition and identity flows are actually keeping unprotected minors out, not just displaying an age screen somewhere; how do we know a given requirement is done; and how does a change to signup, onboarding, guest handling, or guardian verification get built, tested, and released** without quietly reopening a path for a child to enter the product as an unflagged adult.

---

## Part 1 — Success Metrics Framework

Four categories. No single category may be used alone to declare Block A "working" — a platform can look compliant on signup-form validation while a Google Sign-In account or a guest session quietly carries none of the same protections.

### 1.1 Minor-Safeguard Enforcement Metrics

| Metric | What it measures | Data source | Target | Verifies |
|---|---|---|---|---|
| Guest-Session Origin-Flag Coverage | % of guest sessions created via the age-refusal path ("Keep going without an account") that carry the internal origin-marker flag | Guest-session creation event log | 100% — a guest session created via age-refusal with no flag is a Critical regression | A.2 |
| Flagged-Session Microphone Suppression | Adversarial test confirming the microphone remains unavailable for a flagged guest session regardless of the minors' voice-policy state | Automated adversarial test against the voice/microphone API | 100% blocked — zero successful microphone access on a flagged session, every release | A.2 |
| Flagged-Session AI Mentor Fail-Closed Rate | Adversarial test confirming AI Mentor moderation runs in fail-closed mode (blocks rather than allows on an ambiguous case) for a flagged guest session | Automated adversarial test against the AI Mentor moderation pipeline | 100% fail-closed on flagged sessions, every release | A.2 |
| Unconsented Analytics Event Rate (flagged sessions) | Rate of analytics events recorded for a flagged guest session without an equivalent consent mechanism in place | Analytics event log filtered by origin flag | Zero — any event recorded without the required consent-equivalent is a Critical regression | A.2 |
| Flag Persistence Through Guest-to-Account Upgrade | % of guest-to-account upgrades (B8) that retain the origin flag and its attached safeguards until a guardian link is established or adult status is otherwise confirmed | Upgrade-flow event log vs. flag state | 100% | A.2 |
| Post-Callback Age-Screen Completion Rate | % of first-time Google Sign-In accounts that pass through the mandatory post-callback age screen before reaching Learn | Signup/auth event log | 100% — no first-time Google account reaches Learn without completing this screen | A.3 |
| Under-13 Google Reclassification Rate | % of Google accounts identified as under 13 at the post-callback age screen that are correctly reclassified with the same origin marker and safeguards mandated in A.2 (rather than left as a standard universal account) | Signup/auth event log vs. account-role state | 100% | A.3 |
| Age-Screen Bypass Attempt Rate | Adversarial test confirming a new Google account cannot reach Learn, the AI Mentor, or any unrestricted surface through any path (UI, direct API, deep link) without completing the age screen | Automated adversarial test suite | Zero successful bypasses, every release | A.3 |
| Entry-Path DOB/Age-Band Capture Coverage | % of new accounts, across all three entry paths (email signup, Google Sign-In, guest), with a date of birth or, at minimum, an age-band self-declaration on file before the account reaches unrestricted use of Learn or the AI Mentor | Account-creation event log vs. profile-field audit | 100% for new accounts going forward | A.4 |
| Undated-Account Backlog Rate | % of existing accounts created before this fix with no date of birth or age-band on file | Profile-field audit | Diagnostic pre-remediation; should trend toward zero as backfill/re-prompt flows run, no fixed release-gate target | A.4 |

### 1.2 Verification & Trust Integrity Metrics

| Metric | What it measures | Data source | Target | Verifies |
|---|---|---|---|---|
| Verification-Path Status Differentiation Coverage | % of parent-role grants correctly tagged, internally, as `parent (ID-verified)` vs. `parent (staff-granted)` in the audit log and staff console | Roles & Access audit log | 100% | A.5 |
| Staff-Grant Justification Completeness | % of staff-granted parent-role assignments with the mandatory, audited justification field completed (not just actor and timestamp) | Roles & Access audit log | 100% | A.5 |
| Document-Type Validation Coverage | % of ID verifications where the declared document type (national ID / passport / driver's license) is actually validated against the submitted image content, rather than accepted on the basis of any legible ID-like document | Verification pipeline audit log | 100% once shipped; if the field is instead removed per the alternate remedy, this metric is retired and replaced by a Schema Field Utilization check confirming the field no longer exists unused | A.5 |
| Verification Revocation-Path Utilization | Whether the "revoked" verification status is ever reachable through a real trigger path (e.g., a staff action following a fraud report), as opposed to existing only as an unused schema value | Verification pipeline audit log + code path audit | Diagnostic — no fixed usage target, but the trigger path itself must exist and be exercised at least once in staging/QA before this item is marked done | A.5 |

### 1.3 Parental-Visibility & Settings Integrity Metrics

| Metric | What it measures | Data source | Target | Verifies |
|---|---|---|---|---|
| Kid-Role Email-Change Restriction Coverage | % of kid-role accounts for which the Settings email-change capability is either removed entirely or gated behind guardian approval, using the same pattern already built for Mentor memory-note approval | Settings/account-change audit log vs. role | 100% | A.6 |
| Unauthorized Kid-Role Email-Change Attempt Rate | Adversarial test confirming a kid-role account cannot complete an email change without guardian approval through any path (UI, direct API) | Automated adversarial test suite | Zero successful unauthorized changes, every release | A.6 |
| Kid-Role Username-Change Guardian Notice Delivery Rate | % of profile-username changes by a kid-role account that generate a parent-facing notice, so the profile/sign-in username divergence is never a silent surprise | Family panel / notification event log | Diagnostic if the notice is implemented as a "should" rather than a hard gate — target 100% delivery once the notice pattern ships; escalate to a hard target if product decides to make it mandatory | A.6 |

### 1.4 QA & Promise-Integrity Metrics

| Metric | What it measures | Data source | Target | Verifies |
|---|---|---|---|---|
| FAQ-Claim Feature Parity Rate | % of public FAQ claims (currently: second verified guardian, account-cancellation cascade, in-product report tool) that have a verified, shipped, working feature behind them, or have been removed from the FAQ | FAQ content audit cross-checked against the product capability audit | 100% — no FAQ content may describe a capability that does not exist in the shipped product | A.1 |
| Schema Field Utilization Audit (Block A) | For every field touched by A.2–A.6 (origin flag, verification-status tier, document-type field, revocation status), confirmation that at least one flow produces and at least one flow consumes it | Schema/flow audit, tied to the Appendix C/F/H/J/L Definition-of-Done pattern | 100% coverage — no declared field ships without both a producer and a consumer | A.2, A.5 |

---

## Part 2 — Definition of Done

### 2.1 Generic Definition of Done (applies to every item A.1–A.6)

Mirrors the standard already set in Appendices C, F, H, J, and L. A requirement is not "done" when code merges. It is done when all four of the following are true:

1. **Functional** — the described behavior is implemented and a test reproducing the exact scenario in the requirement's "Current State" now passes.
2. **Enforced, not just displayed** — where the requirement concerns a safeguard a family relies on (the guest origin flag, the Google age screen, the guardian-approval gate on a kid-role email change, the verification-status distinction), a deliberately adversarial test confirms the safeguard actually holds through every path (UI, direct API call, and, where relevant, the guest-to-account upgrade flow) — not merely that a flag exists in the data model or a screen appears in the normal flow. This is the same standard already established in Appendices H, J, and L, and it is the specific standard A.2 and A.3 exist to meet: a safeguard flag that is set but does not actually suppress microphone access, force fail-closed AI Mentor moderation, and block unconsented analytics events is no safer than no flag at all.
3. **Measured** — at least one metric from Part 1 is instrumented and reporting real production data tied to this requirement within one release cycle of shipping, and, for any metric with a fixed (non-diagnostic) target, production data is trending toward that target, not merely flowing.
4. **Reviewed** — a reviewer explicitly confirms the specific "Current State" defect described in the requirement no longer reproduces, and, for A.2/A.3/A.6 specifically, that review includes signing off on the adversarial-test results from Criterion 2, not a UI walkthrough alone.

### 2.2 Worked example — A.2 (guest minor safeguards)

**A.2 (guest-session minor safeguards):** Done when (a) every guest session created via the age-refusal path carries the internal origin flag, verified by an automated test exercising the exact "An adult has to create this one" → "Keep going without an account" flow, (b) an adversarial test confirms that for a flagged session, the microphone cannot be activated through any path regardless of the minors' voice-policy state, the AI Mentor's moderation pipeline runs fail-closed on an ambiguous test input, and no analytics event is recorded without the required consent-equivalent — three separate adversarial checks, not one combined "the flag is set" check, (c) a further adversarial test confirms the flag and its attached safeguards persist through a guest-to-account upgrade (B8) until a guardian link is established or adult status is otherwise confirmed, and (d) the five Part 1.1 metrics tied to A.2 are all instrumented and reporting 100% (or zero, for the unconsented-event metric) for at least one full release cycle before this item is marked done. A.2 is not done if the flag exists in the schema and is set correctly but any one of the three downstream safeguards still fires as if the session were an ordinary universal account — that is the cosmetic-control failure mode this whole appendix exists to prevent.

### 2.3 Worked example — A.3 (Google Sign-In age screen)

**A.3 (Google Sign-In age screen):** Done when (a) every first-time Google Sign-In account is routed through the mandatory post-callback age screen before reaching Learn, verified by an automated test, (b) an adversarial test confirms there is no path — including a direct API call or a deep link into Learn — that lets a new Google account skip the age screen, (c) an account identified as under 13 at this screen is reclassified with the same origin marker and safeguards mandated in A.2, verified by the same three adversarial checks used in A.2's Definition of Done (microphone suppression, fail-closed moderation, unconsented-analytics blocking), and (d) the Post-Callback Age-Screen Completion Rate and Age-Screen Bypass Attempt Rate metrics (Part 1.1) both report the target state for at least one full release cycle. A.3 is not done if the age screen is optional, deferrable to a later Settings prompt, or bypassable by any path other than the intended flow.

---

## Part 3 — Production/QA Pipeline for Acquisition & Identity Changes

This is the answer to "how does a change to signup, onboarding, guest handling, or guardian verification get built and released without reopening an A.2- or A.3-style gap between an intended age screen and an actually-enforced one." Because this domain is the platform's front door for every population it protects, every stage explicitly separates "does the age/identity flow display correctly" from "does it actually keep an unprotected minor from reaching Learn or the AI Mentor" — the distinction whose absence produced this Block's two Critical findings.

**Stage 0 — Scoping & Risk Classification** (Trust/Identity Lead + Engineering Lead, human)
Every change is classified into one of three categories before development starts: **age/identity-boundary** (touches age screening, the guest origin flag, guardian-verification status, or guardian-approval gating on a kid-role Settings action), **promise/claim** (touches FAQ or marketing copy describing product capability), or **presentation-only** (copy or visuals with no behavioral or claim change). Any change classified age/identity-boundary is automatically subject to Stage 2 with no exception, regardless of how small it appears — this is the specific lesson of A.2 and A.3, where the gap was not a large feature but an absent or unenforced restriction at the front door.

**Stage 1 — Development** (Engineering, human or AI-assisted)
The change is authored.

**Stage 2 — Automated Adversarial Testing** (machine, mandatory for age/identity-boundary changes)
A deliberately adversarial test suite exercises the change as an unscreened minor, or a bypass attempt, would: does a flagged guest session's microphone stay blocked, does its AI Mentor moderation stay fail-closed, are its analytics events actually suppressed without consent; can a new Google account reach Learn without completing the age screen; can a kid-role account complete an email change in Settings without guardian approval, through the UI or a direct API call? A change failing this stage returns to Stage 1 with an itemized failure report identifying exactly which safeguard path failed to hold.

**Stage 3 — Trust/Verification Review** (Trust/Identity Lead, human — mandatory for any change touching A.5's guardian-verification status or its staff-grant path; a distinct role from the Engineering Lead who scoped or authored the change, even when the same person occasionally fills both, to avoid a false sense of independent review)
Confirms the `parent (ID-verified)` / `parent (staff-granted)` distinction remains intact and correctly tagged, that any staff grant carries a completed justification field, and that the document-type field is either validated against the submitted image or has been removed from the form.

**Stage 4 — Promise/Claim Integrity Review** (Product/Marketing Lead + Trust/Identity Lead, human — mandatory for any FAQ or marketing copy change)
Confirms no FAQ or marketing claim ships describing a capability without a verified, working feature behind it, consistent with A.1's mandate. This review is a distinct function from the engineering work that builds (or does not build) the underlying feature, even when the same person occasionally drafts both, to avoid a false sense of independent review.

**Stage 5 — Release & Instrumentation** (Engineering)
The change ships with its relevant Part 1 metric already instrumented, as a launch requirement, not a follow-up ticket.

**Stage 6 — Post-Launch Recalibration** (Trust/Identity Lead, on a quarterly cadence, consistent with Appendices H, J, and L)
Real production data (origin-flag coverage, age-screen completion, bypass-attempt rate, undated-account backlog) feeds back into this Block's thresholds. A regression in any of the age/identity-boundary adversarial metrics (flagged-session safeguard suppression, age-screen bypass, unauthorized kid-role email change) triggers an immediate rollback rather than a patch under pressure, consistent with the kill-switch discipline already established in Appendices F, H, J, and L.

---

## Part 4 — Internal Sequencing & Phasing of Block A

| Phase | Items | Dependency | Rationale |
|---|---|---|---|
| **0 — Critical minor-safeguard closure** | A.2, A.3 | None | Both are Critical-severity, live, unaddressed paths for a minor to enter the product as an unflagged adult; these carry the same urgency class as this document series' other Critical findings and must close before any other Block A work, since every other item in this Block assumes an age signal exists to act on |
| **1 — Universal age-signal capture** | A.4 | Phase 0 | Extending date-of-birth/age-band capture to every entry path is most meaningful once the origin-flag and Google age-screen scaffolding from Phase 0 exists for it to feed into — building A.4 first, in isolation, would leave the two live Critical bypass paths open the longest |
| **2 — Trust/verification integrity** | A.5 | None hard | Independent of the age-signal work in Phases 0–1; a High-severity fix to the guardian-verification trust architecture that can proceed in parallel |
| **3 — Parental-visibility closure** | A.6 | None hard | Independent Settings-layer engineering; can proceed in parallel with Phase 2, but is sequenced after the Critical age-safeguard work in Phase 0 |
| **4 — Promise integrity** | A.1 | Phases 0–3 (informational) | Each of the three FAQ claims should be resolved (built or removed) only once the underlying feature decisions — including whether any of them touch the guardian-linking or verification work in Phase 2 — are settled, so the FAQ accurately reflects the shipped state rather than a moving target |

---

## A note on why this appendix exists

Everything in A.1–A.6 describes what must be true of the acquisition and identity domain. Without this appendix, "a guest session carries an origin flag" or "Google Sign-In shows an age screen somewhere in the flow" could be treated as sufficient on their own — the same shallow-verification mistake this document series has already flagged in D.1, D.4, D.7, E.1, and G.1. A.2 in particular describes a flag that, on its own, does nothing: it is a database value until three separate downstream systems (microphone access, AI Mentor moderation, analytics consent) are each confirmed to actually check it and actually fail closed. The Enforced-not-just-displayed criterion in Part 2.1 and the adversarial Stage 2 testing in Part 3 exist so that a guest session flagged as a probable child, or a Google account that technically passed an age screen once, is never mistaken for a genuinely protected one — the exact front-door version of the cosmetic-control failure this document series keeps finding elsewhere.
