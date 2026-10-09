---
title: Security guide
status: scaffold
updated: 2026-10-09
---

# Security guide

> The security baseline every change must meet.

> **Status: scaffold.** The structure is set; nothing below that is not marked as current state has been decided. Fill it in with the owner, then change the status to `draft` and, once approved, `accepted`.

## Role

The owner sets the baseline here, to the highest standard. Agents treat it as binding for every change and raise any conflict instead of working around it. Child-specific rules are in [[CHILD-SAFETY-AND-PRIVACY]].

## Read this when

- Any change that handles identity, data, input, secrets or network exposure.
- Reviewing a pull request.

## To define

- [ ] Assets, actors and the threat model, including abuse cases involving minors.
- [ ] Authentication: methods, sessions, parent verification and recovery.
- [ ] Authorization model and where it is enforced.
- [ ] Secrets: storage, rotation, and what never enters the repository.
- [ ] Input validation and output encoding.
- [ ] Browser hardening: headers, content security policy, CORS, cookies.
- [ ] Encryption in transit and at rest; key management.
- [ ] Dependency and supply-chain controls: lockfiles, pinned CI actions, update policy.
- [ ] Logging rules: no personal data in logs.
- [ ] Security review checklist per change.
- [ ] Vulnerability reporting.

## Current state

- `scripts/check-secrets.sh` scans tracked files for credentials. The vendored anti-slop rules reject unparsed input and unjustified type assertions. Security skills for agents and the rules for any AI pentest run are in [[ai-pentesting]].

## Related

- [[CHILD-SAFETY-AND-PRIVACY]]
- [[RATE-LIMITING-AND-ABUSE]]
- [[API-GUIDE]]
- [[DATABASE-GUIDE]]
- [[INFRASTRUCTURE]]
- [[CI-CD-AND-VERSION-CONTROL]]
- [[INCIDENT-RESPONSE]]
- [[ai-pentesting]]
- [[CODE-STYLE-GUIDE]]
- [[TESTING-GUIDE]]

Back to [[INDEX]].

## Update this document when

- The baseline changes or a control is added.
- A security-relevant dependency or service is introduced.
