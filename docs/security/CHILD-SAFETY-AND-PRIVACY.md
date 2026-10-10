---
title: Child safety and privacy
status: scaffold
updated: 2026-10-10
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
- Decision of that day, superseded on 2026-10-10: the platform was set for ages 12 to 18 ([[DECISIONS]] D-013). The line is now 13 (D-027); see the next section.

## Decided by the owner (2026-10-10)

- The platform is for ages 13 and over, following the COPPA line named above ([[DECISIONS]] D-027).
- Sign-up asks for self-declared permission: a checkbox like Astra AI's ("I confirm I have my parent's or guardian's permission"), not a verified parental-consent process, so that a younger person who signs up meets no friction ([[DECISIONS]] D-025).
- The age step accepts 6 to 100, so children from 6 to 12 can sign up with that checkbox. Taken by default: the checkbox appears for a declared age under 13.
- Verified parental consent is not promised anywhere (interface, terms, privacy text), so the product never claims more than it does.
- To confirm with counsel before production, because a self-declared checkbox is not verifiable parental consent and children under 13 are admitted with it: what COPPA requires in the United States for those accounts, and the rules for children's data in the other markets the product is written for (Mexico, Brazil). In the reference mapping, Astra AI's own privacy policy promises verified parental consent under 15 while its product shows only this checkbox; the gap between the two is the thing to avoid.
- No account is asked for before the onboarding has been seen (D-021), so nothing personal is collected from a visitor who has not signed up.

## Current state (identity, built 2026-10-10)

What the product holds about a person today, all of it in [[F-001-authentication]]:

- **Email address**, held by the authentication service. It is how a person signs in and where the code goes. It is shown only to its owner.
- **Age**, as a whole number the person typed (6 to 100), with the date it was declared. No birth date is asked or stored. Under 13 the record also holds that the permission box was ticked. The age is written once and cannot be changed by the person.
- **Username and display name**, optional, chosen by the person. Nothing in the product shows them to anybody else yet.
- **Language.**
- With Google, the authentication service also keeps what Google sends (name, picture). Whether to strip it is open.

Nothing is collected from a visitor who has not signed in: no request reaches the backend. Logs carry no personal data ([[SECURITY-GUIDE]]). The third parties that receive an address are the mail route (the mail service to Amazon SES) and, for a person who chooses it, Google.

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
