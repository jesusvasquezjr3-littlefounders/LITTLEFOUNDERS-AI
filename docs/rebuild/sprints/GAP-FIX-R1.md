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

## F1-social-finish: guardian notice by age, lane close

**Adversarial pass.** The audited E.3 gap had a second role test in the same 0108 file: `submit_social_report` notified a reporter's or subject's verified guardian only when that account held the `kid` role. A guardian-linked under-13 origin account (social tier `guardian`, role `universal`) could report or be reported without its Tutor being told, against OD-3.

**Built.** Migration `social_pattern_age_based` now also redefines `public.submit_social_report` (0108 verbatim otherwise). The reporter and subject notice sources read `public.social_child_account` (0121), the same child test E.11 uses. A self-registered teen still decides for itself (S-05). Whether a teen's linked guardian also gets this notice stays the open question SOCIAL-TIERS already records. The migration is now about 11 KB.

**Verified (local).**

- `verify-social-pattern-postgres.py`: 11 of 11 on PostgreSQL 17.6, 193 migrations. The new check covers three cases. A linked origin account that reports, or is reported, notifies its guardian. An unlinked teen reporter notifies nobody. A third mutation check (putting back the `kid` role test) loses the notice. `verify-social-governance-postgres.py` is green on the same chain.
- Full unit suites, run once at the lane close, with type-check and lint:
  - backend: 3067 pass, 1 skipped;
  - frontend: 2855 of 2856 pass. The one red was `assetGate.test.ts`, an OCR timeout under shared machine load in a file this lane never touched. It passed 11 of 11 when rerun alone.
  - database: the migration, phase and lifecycle checks pass, and so do 44 of 44 node tests. The last step of `npm test`, `railway-migrate.test.mjs`, hung in its fake-Railway shell harness with no output, and was stopped. The same test hung at that moment in two other lane worktrees, and this lane did not touch it or `railway-migrate.sh`. The orchestrator's merge gate should rerun it.

**Lane summary.** E.3 now follows OD-3 in both of its role tests. Minors count toward the pattern trigger by age tier, and a child's guardian is notified by the child test instead of the kid role. The staff copy is updated in EN, es-MX and pt-BR, and so is the policy text. There is no new UI and no Core wire change. Remaining: human review and acceptance of E.3, production readings for the Appendix J metric, and the two owner questions: a child reporting its own Tutor, and notices for a teen's linked guardian.
