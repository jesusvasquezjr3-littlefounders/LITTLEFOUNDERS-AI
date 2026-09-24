# Appendix O — Analytics & Experimentation, and Operations Success Metrics, Definition of Done, and Production/QA Pipeline

**Status:** Authoritative operational framework closing Block H. Block H (`10-PRODUCT-GOLD-STANDARD-REQUIREMENTS.md`, items H.1–H.7) shipped without a dedicated companion appendix of this kind, alongside Blocks A and G — a gap an independent audit flagged given that this Block includes the platform's data-retention, incident-response, and operational-alerting posture: the layer that determines whether a silent failure (an alert nobody is told about, a backup nobody confirmed is encrypted) is caught before it becomes a family-facing harm. This appendix closes that gap for Block H, answering the same three questions Appendices C, F, H (Family Hub), J, L, M, and N answered for their own Blocks: **how do we know the analytics-consent and operational-reliability layer is actually working for every population it should cover, not just for the one population it was originally built for; how do we know a given requirement is done; and how does a change to consent gating, retention, alerting, or experimentation get built, tested, and released** without quietly reintroducing an unnotified alert, an unreconciled retention window, or an ungoverned experiment reaching a child.

---

## Part 1 — Success Metrics Framework

Four categories. No single category may be used alone to declare Block H "working" — an analytics-consent gate can be genuinely excellent for kid-role accounts (as H.6 confirms it is) while quietly leaving an entire adjacent population, and an entire operational-alerting layer, uncovered.

### 1.1 Consent & Population-Coverage Metrics

| Metric | What it measures | Data source | Target | Verifies |
|---|---|---|---|---|
| Teen/Guest Consent-Adjacent Disclosure Coverage | % of self-registered teen and guest sessions presented with the teen-facing, self-managed analytics disclosure/opt-out mechanism | Analytics-consent event log filtered by role/population | 100% once H.1 ships | H.1 |
| Consent-Gate Population Gap Rate | Rate at which self-registered teens and guests are measured with no consent-adjacent mechanism at all (pre-fix baseline, and a regression check thereafter) | Analytics event log vs. consent-state audit | Diagnostic pre-fix, to establish the baseline exposure; zero post-fix, verified per release | H.1 |
| Kid-Role Consent Gate Regression Check | Per-release confirmation that the existing kid-role analytics-consent gate's design (transmission blocked at the source until active guardian consent exists, guardian-only grant, "kid" always wins in role-based event stamping) continues to hold unmodified | Release-gate test suite | Pass, every release, zero exceptions — this gate is this Block's confirmed strength (H.6) and must not regress while H.1's teen-facing extension is being built alongside it | H.6 |

### 1.2 Retention & Governance-Documentation Metrics

| Metric | What it measures | Data source | Target | Verifies |
|---|---|---|---|---|
| Retention-Window Reconciliation Documentation | Whether a written rationale exists reconciling the 400-day raw-event retention window against the analytics warehouse's 90-day session-dimension window, as part of a broader written retention policy for this domain | Documentation audit | Present and current | H.2 |
| Backup-Encryption-at-Rest Confirmation | Documented, verified status of whether database backups (including family and AI Mentor data) are encrypted at rest | Documentation audit + infrastructure configuration audit | Confirmed encrypted, documented — if the audit finds backups are not encrypted, this metric is a Critical-priority gap requiring immediate remediation, not merely documentation | H.5 |
| Incident-Response & Breach-Notification Plan Existence and Currency | Whether a baseline documented incident-response and breach-notification process exists, including internal notification chain, family-facing notification timeline, and stated commitment | Documentation audit | Present, and reviewed on a defined recurring cadence (proposed: annually at minimum, or after any actual incident) | H.5 |

### 1.3 Operational Notification & Reliability Metrics

| Metric | What it measures | Data source | Target | Verifies |
|---|---|---|---|---|
| Instrumentation Consumer Coverage | % of analytics events, warehouse alerts, and export jobs with a confirmed emitter AND a confirmed downstream consumer (a caller for an event, a notification channel for an alert, a processor for an export job) — end to end, not merely "recorded" | Event/alert/job schema-and-flow audit, tied to the Appendix C/F/H/J/L/M Definition-of-Done pattern | 100% coverage — no mechanism may ship recording an event, a trigger, or a job with no consumer that acts on it | H.3 |
| Alert-to-Notification Delivery Rate | % of fired warehouse alerts that actually produce a webhook or email notification to a real recipient, as opposed to being recorded internally with nobody told | Alert-trigger log vs. notification-delivery log | 100% — an alert that fires but notifies nobody is treated as equivalent to having no alert, per this Block's own finding that this is "arguably worse than having no alerting system at all" | H.3 |
| Export-Job Terminal-State Completion Rate | % of created warehouse export jobs (CSV/JSON/Parquet) that reach a terminal state (completed or explicitly failed) rather than remaining permanently "pending" | Export-job queue state audit | 100%, or, if the processor is not built, the ability to create a job that can never complete is removed and this metric is retired | H.3 |
| Missing-Emitter Closure Rate | Confirms the two previously-unwired analytics events (`task_view`, `tutor_open`) now have a confirmed emitter in the product | Event-emission code/flow audit | 100% — both events confirmed emitting, or formally removed from the schema if no longer needed | H.3 |
| Watchdog-Plus-Notification Coverage for Critical Scheduled Jobs | % of scheduled production jobs whose silent failure would have serious consequences (at minimum: the Mentor 90-day retention sweep, the daily database backup, and the schema drift probe) that have the watchdog-plus-external-notification pattern already built for the tutor retention sweep | Job-monitoring configuration audit + simulated-failure drill | 100% for the three named jobs at minimum | H.4 |
| Simulated Job-Failure Drill Pass Rate | Whether a deliberately simulated failure of each covered job actually triggers an external page/notification to a human, not merely a failed-automation-run log entry | Scheduled adversarial drill (not passive log review) | Pass, on a recurring cadence (proposed: at minimum before each release that touches job-scheduling infrastructure, and quarterly otherwise) | H.4 |

### 1.4 Standing-Constraint & Forward-Governance Metrics

| Metric | What it measures | Data source | Target | Verifies |
|---|---|---|---|---|
| Reference-Standard Documentation Check | Confirms the kid-role analytics-consent gate's specific design (transmission blocked at the source, guardian-only grant, role-stamping precedence) is documented in this document's list of standing constraints as the reference implementation for any future consent-gated feature | Documentation audit | Present and current | H.6 |
| Experiment Eligibility Policy Existence (pre-launch gate) | Confirms a documented, explicit age-based eligibility policy for kid-role and universal-teen accounts in experiments exists and is approved before the experiment-exposure endpoint is ever called from the web app | Documentation audit + release-gate checklist tied to the exposure-endpoint's first production call | Present before first call — a hard Pass/Fail gate, not a diagnostic metric, since the entire point of H.7 is to decide this before engineering pressure to ship a growth experiment arrives | H.7 |

---

## Part 2 — Definition of Done

### 2.1 Generic Definition of Done (applies to every item H.1–H.7)

Mirrors the standard already set in Appendices C, F, H, J, L, M, and N. A requirement is not "done" when code merges. It is done when all four of the following are true:

1. **Functional** — the described behavior is implemented and a test reproducing the exact scenario in the requirement's "Current State" now passes.
2. **Enforced, not just displayed** — where the requirement concerns a boundary a family or the platform relies on (the teen consent-adjacent gate, an alert's notification delivery, a watchdog's actual paging behavior, the experiment-eligibility gate), a deliberately adversarial or simulated-failure test confirms the boundary actually holds in practice — a watchdog that logs a failure internally without paging anyone, or an alert that fires but delivers no webhook, does not satisfy this criterion merely because the trigger condition itself works correctly. This is the standard already established in Appendices H, J, L, M, and N, applied here to operational and governance boundaries rather than only user-facing ones: an alert or watchdog exists specifically to notify a human, and one that fires silently is functionally equivalent to one that does not exist.
3. **Measured** — at least one metric from Part 1 is instrumented and reporting real production data tied to this requirement within one release cycle of shipping, and, for any metric with a fixed (non-diagnostic) target, production data is trending toward that target, not merely flowing. This criterion is written to require target-trending explicitly, consistent with the correction being applied across this document series' other appendices: a metric that is merely "instrumented and reporting data" without trending toward its target does not satisfy this criterion for any non-diagnostic metric.
4. **Reviewed** — a reviewer explicitly confirms the specific "Current State" defect no longer reproduces, and, for H.3/H.4 specifically, that review includes signing off on the results of a simulated-failure drill demonstrating an actual notification was delivered, not a code review confirming the notification-sending code exists.

### 2.2 Worked example — H.1 (teen/guest consent-adjacent gate)

**H.1 (self-registered teens/guests excluded from the analytics consent gate):** Done when (a) a teen-facing, self-managed analytics disclosure/opt-out mechanism is implemented and presented to every self-registered teen and guest session, distinct from the guardian-consent gate that governs kid-role accounts, verified by a test reproducing the exact "measured like adults" scenario in this item's Current State, (b) the mechanism is confirmed, by an adversarial test, not to weaken or bypass the existing kid-role guardian-consent gate — a change to extend coverage to teens must not accidentally create a new path for a kid-role account to be measured under the looser teen-facing rule, (c) the Teen/Guest Consent-Adjacent Disclosure Coverage metric (Part 1.1) reports 100% and the Kid-Role Consent Gate Regression Check continues to pass, both for at least one full release cycle, and (d) the implementation has been reviewed against the two-tier model already established for this exact population in E.8, per this item's own mandated requirement, rather than inventing an unrelated third model. H.1 is not done if a disclosure banner is added to the teen/guest flow but analytics events continue transmitting regardless of whether the teen has seen or interacted with it — a disclosure that does not gate anything is not what this item requires.

### 2.3 Worked example — H.4 (watchdog-plus-notification extension)

**H.4 (no external paging for scheduled job failures beyond Mentor retention):** Done when (a) the watchdog-plus-notification pattern already built for the Mentor 90-day retention sweep is extended to, at minimum, the daily database backup job and the schema drift probe, verified by a test confirming each job now has an active watchdog, (b) a simulated failure of each of the three jobs (Mentor retention, backup, drift probe) is deliberately triggered in a non-production environment and confirmed, by direct observation, to produce an actual external page or notification to a human recipient — not merely a failed-automation-run entry in a log a human would have to go looking for, (c) the Watchdog-Plus-Notification Coverage and Simulated Job-Failure Drill Pass Rate metrics (Part 1.3) both report the target state, and (d) a reviewer confirms the notification channel used (page, email, or equivalent) reaches a real on-call recipient, not a channel nobody monitors. H.4 is not done if the watchdog code exists and would theoretically fire, but has never actually been exercised end-to-end against a simulated failure — an untested watchdog is a hypothesis, not a control.

---

## Part 3 — Production/QA Pipeline for Analytics, Experimentation, and Operations Changes

This is the answer to "how does a change to consent gating, retention, operational alerting, or the experiment framework get built and released without reintroducing an H.1-style population gap or an H.3-style silent-recording-with-no-consumer pattern." Because this domain spans both family-facing consent boundaries and internal operational reliability, every stage explicitly separates "does the mechanism record or trigger correctly" from "does it actually notify, gate, or cover the population/failure mode it claims to" — the distinction whose absence produced most of this Block's findings.

**Stage 0 — Scoping & Risk Classification** (Data/Privacy Lead + Engineering Lead, human)
Every change is classified into one of four categories before development starts: **consent/retention-boundary** (touches who is covered by an analytics-consent gate, or a data-retention window), **operational-reliability** (touches an alert, an event emitter, an export job, or a scheduled-job watchdog), **experiment-governance** (touches the experiment-assignment or exposure-tracking framework), or **presentation-only** (copy, dashboards, or visuals with no behavioral change). A consent/retention-boundary or experiment-governance change is automatically subject to Stage 3; an operational-reliability change is automatically subject to Stage 2's simulated-failure testing and Stage 4 — in each case with no exception, regardless of how small the change appears, since H.1's and H.3's core findings were both small-looking gaps (a role check, a missing webhook call) with outsized consequences.

**Stage 1 — Development** (Engineering, human or AI-assisted)
The change is authored.

**Stage 2 — Automated Verification & Simulated-Failure Testing** (machine, mandatory for consent/retention-boundary and operational-reliability changes)
For a consent/retention-boundary change: confirms teen/guest sessions receive the disclosure/opt-out mechanism, and confirms — by adversarial test — that the existing kid-role consent gate is unaffected (a regression check, not just a new-feature check). For an operational-reliability change: confirms, via a simulated failure or trigger condition in a non-production environment, that an alert actually produces a webhook/email delivery, that an export job reaches a terminal state, and that a watchdog actually pages a human — not that the underlying trigger logic merely executes without error. For an experiment-governance change: confirms the experiment-exposure endpoint remains ungated (uncallable in a way that reaches a kid-role or universal-teen account) until the eligibility policy required by H.7 is documented and approved. A change failing this stage returns to Stage 1 with an itemized failure report identifying exactly which coverage or notification path failed to hold.

**Stage 3 — Data/Privacy Review** (Data/Privacy Lead, human — mandatory for any consent/retention-boundary, governance-documentation (H.2, H.5, H.6), or experiment-governance change; a distinct role from the Engineering Lead who scoped or authored the change, even when the same person occasionally fills both, to avoid a false sense of independent review)
Confirms consent-coverage parity across populations, that any retention-window change or documentation update accurately reconciles the underlying windows, that backup-encryption and incident-response documentation remain current, and, for any experiment-governance change, that the eligibility policy required by H.7 has been explicitly decided and recorded before the exposure endpoint's first production call — not inherited by default from the adult experiment framework.

**Stage 4 — Reliability Review** (Data/Privacy Lead or a designated Reliability-focused reviewer, human — mandatory for any operational-reliability change)
Confirms the simulated-failure drill from Stage 2 was actually run and actually reached a real recipient, and that the specific job(s) affected remain within the watchdog-plus-notification coverage required by H.4.

**Stage 5 — Release & Instrumentation** (Engineering)
The change ships with its relevant Part 1 metric already instrumented, as a launch requirement, not a follow-up ticket.

**Stage 6 — Post-Launch Recalibration** (Data/Privacy Lead, on a quarterly cadence, consistent with Appendices H, J, L, M, and N)
Real production data (consent-coverage rates, alert-delivery rates, watchdog-drill results, retention-policy currency) feeds back into this Block's thresholds. A regression in the Kid-Role Consent Gate Regression Check, the Alert-to-Notification Delivery Rate, or the Watchdog-Plus-Notification Coverage metric triggers an immediate rollback rather than a patch under pressure, consistent with the kill-switch discipline already established in Appendices F, H, J, L, M, and N.

---

## Part 4 — Internal Sequencing & Phasing of Block H

| Phase | Items | Dependency | Rationale |
|---|---|---|---|
| **0 — Population-coverage parity** | H.1 | None | This is the same "kid role ≠ minor" pattern already fixed at A.3/A.4, D.3, and E.8 recurring in a new domain; closing the self-registered teen/guest consent gap is the highest-severity item in this Block (High) and should not wait on the lower-severity operational and governance work below |
| **1 — Operational visibility that actually notifies** | H.3, H.4 | None hard (may proceed in parallel with Phase 0) | Both are the same declared-but-unused pattern already flagged at D.5, F.4, and G.4 — wiring the missing event emitters, alert notifications, and export processor, and extending the Mentor-retention watchdog pattern to backups and the drift probe — and neither depends on H.1's consent-population work |
| **2 — Governance documentation baseline** | H.2, H.5 | None hard | Documentation-first items (a written retention-window rationale, a documented incident-response/breach-notification process, and confirmed backup-encryption status) that can proceed independently, though they are lower urgency than the live population and operational gaps in Phases 0–1 |
| **3 — Standing constraints & forward governance** | H.6, H.7 | Phase 0 (H.7 benefits from H.1's population-coverage work being settled first, so the eligibility policy is written against the corrected consent model, not the current gap) | H.6 locks in an existing strength as a standing reference; H.7 is explicitly a low-urgency, ahead-of-need finding (the experiment endpoint is not yet live) — both are sequenced last, but H.7 must still close before the experiment-exposure endpoint's first production call, regardless of calendar phase |

---

## A note on why this appendix exists

Everything in H.1–H.7 describes what must be true of the analytics, experimentation, and operations domain. Without this appendix, "the kid-role consent gate works" could be mistaken for "the platform's consent posture is fine" — when in fact an entire adjacent population (self-registered teens and guests) is measured with no consent-adjacent mechanism at all, the same shallow-coverage mistake this document series has already flagged when a fix built for one population was never extended to a structurally identical one (A.3/A.4, D.3, E.8). Separately, H.3's finding that alerts "record triggers but deliver no webhook or email" is a distinct and, in its own way, more dangerous failure mode: a system that silently does nothing can create false confidence that "there's a system for that" when nobody is ever actually told. The Enforced-not-just-displayed criterion in Part 2.1, the target-trending requirement written explicitly into the Measured criterion, and the mandatory simulated-failure testing in Part 3 exist so that an alert that fires, a watchdog that exists, or a consent mechanism that is technically present is never again mistaken for one a human being actually receives, actually relies on, or actually covers.
