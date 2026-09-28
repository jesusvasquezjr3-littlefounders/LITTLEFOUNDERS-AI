# Gap-fix round 1

Lane records for the first round of audited SPEC gap fixes. Each section is one lane checkpoint: the SPEC clauses closed, where, what was verified and what remains. Statuses follow `docs/rebuild/REQUIREMENTS.md`: implementation and local verification only, never acceptance.

## F1-social: E.3 pattern trigger by age

Branch `codex/spec-fix1social`.

**Gap (confirmed in code).** E.3 queues an account for staff review once reports or blocks from 3 or more unrelated minor accounts reach it within 30 days. OD-3 (13-OWNER-DECISION-LOG section 1 and the section 2 access table) makes every minor safeguard follow age, not role, and OWNER-REVIEW-ANSWERS D-19 names this trigger as a limit on adults who send teens requests. `evaluate_social_pattern` in `0108_report_escalation.sql` counted a reporter only when `user_roles.role = 'kid'` and skipped any reporter with no verified guardian. No later migration redefined it. A self-registered 13-17 teen's report or block therefore counted for nothing, and three teens reporting one adult never opened a case.

**Built.**

- Migration `social_pattern_age_based` (`database/migrations/0193_social_pattern_age_based.sql`, `@phase: expand`) redefines `public.evaluate_social_pattern(p_subject)` with the same signature, grants and event sources (reports, and blocks read from the 0095 audit trail). The window stays 30 days and the threshold stays 3.
  - A reporter qualifies when `public.social_tier()` puts it in a minor tier (`guardian` or `teen`). Adults, guests and the closed tier never count.
  - A reporter with verified guardians is excluded when it shares a guardian with the subject, or when the subject is one of its guardians (new: a child blocking its own Tutor is family). Siblings count once.
  - A reporter without a guardian is its own unrelated unit. It is excluded only when a verified guardian link joins it to the subject in either direction. A pending link does not exclude it, so an adult cannot shield itself by starting a link.
- `database/scripts/verify-social-pattern-postgres.py`: a new PostgreSQL verifier with 10 checks, described under Verified.
- `backend/src/__tests__/report.test.ts`: three teen-tier sessions report one adult. Each report reaches `submit_social_report` as that teen, and Core never filters reporters by role.
- Copy: the staff case sheet's `reports.body.patternHelp` now reads "reports or blocks from 3 unrelated minors" in EN, es-MX and pt-BR. `StaffReports.tsx` header comment. Policy text: SOCIAL-GOVERNANCE threshold table and SOCIAL-TIERS section 7 item 3 (D-19 answered).

**Verified (local).**

- The new verifier passed 10 of 10 checks on portable PostgreSQL 17.6, with all 193 migrations applied in order:
  - three independent teens blocking an adult open a `pattern` case, and two do not;
  - two teen reports plus one teen block cross the threshold;
  - three adults open nothing;
  - siblings count once, and minor tiers mix;
  - the subject's own family is excluded: a child blocking its own Tutor, a sibling of the subject, or a teen joined to the subject by a verified link;
  - a pending link does not shield the subject;
  - two mutation checks: restoring `role = 'kid'`, or restoring the skip for a reporter with no guardian, turns the independent-teen case red;
  - no browser role and not the service role can call the rule directly.
- `verify-social-governance-postgres.py` and `verify-account-erasure-postgres.py` were rerun on the same chain and are green.
- Core `report.test.ts`: 25 of 25 pass.

**Remaining.**

- Human review.
- Production readings for the Appendix J pattern metric.
- The tier is read when the rule is evaluated, the same "as of today" reading every other E.8 gate uses. A teen who turns 18 inside the window stops counting.
- Conservative default recorded as an owner question: a child blocking or reporting its own verified Tutor no longer counts toward the Tutor's pattern case. E.3 says "unrelated", and a report still opens a case on its own.
