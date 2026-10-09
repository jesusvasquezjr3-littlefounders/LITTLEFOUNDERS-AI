---
title: Child safety and privacy
status: scaffold
updated: 2026-10-09
---

# Child safety and privacy

> The rules that protect minors and their personal data.

> **Status: scaffold.** The structure is set; nothing below that is not marked as current state has been decided. Fill it in with the owner, then change the status to `draft` and, once approved, `accepted`.

## Role

Children's data and safety come before every other consideration. This document is the reference every feature is reviewed against, and the place where legal obligations are recorded once confirmed.

## Read this when

- Designing anything that collects, stores, shows or sends data about a user.
- Designing the AI tutor or any communication feature.
- Choosing a third-party processor.

## Inputs from the owner (2026-10-09, not yet confirmed with counsel)

- Educational STEM platforms such as Scratch, Code.org and Khan Academy generally do not let a child under 13 create an account alone: a parent or legal guardian creates it and consents to the handling of the child's data. From 13, most let the teenager manage their own account. The reason given is the United States COPPA law, which sets 13 as the minimum age to collect personal data without parental permission.
- Mexico: the General Law on the Rights of Girls, Boys and Adolescents (LGDNNA), article 101 Bis 2, gives minors the right to safe access to the internet for education, science and leisure, and expects the State to encourage STEM tools, with accompaniment and supervision by guardians.
- Decision: the platform is for ages 12 to 18, final ([[DECISIONS]] D-013). The youngest age served is 12, so the way a 12-year-old signs up and gives (or has a parent give) consent is to be designed (T-020); under-12 users need a different registration process, also to be designed.

## To define

- [ ] The legal regimes that apply per market (to be confirmed with counsel before production).
- [ ] Parental consent and verification model, by age.
- [ ] Data minimization: exactly what is collected per age group, and why.
- [ ] What is shown to other users, if anything.
- [ ] AI tutor safeguards: content limits, no personal data sent to model providers, logging and human review.
- [ ] Retention, export and erasure.
- [ ] Third-party processors and the data each receives.
- [ ] Consent for analytics and cookies.
- [ ] Breach notification duties.
- [ ] The rule that no real money is represented.

## Related

- [[PRODUCT-REQUIREMENTS]]
- [[SECURITY-GUIDE]]
- [[DATABASE-GUIDE]]
- [[USER-FLOWS]]
- [[OBSERVABILITY]]
- [[INCIDENT-RESPONSE]]
- [[FEATURE-TEMPLATE]]

Back to [[INDEX]].

## Update this document when

- A legal obligation is confirmed or changes.
- Data collection, processors or tutor safeguards change.
