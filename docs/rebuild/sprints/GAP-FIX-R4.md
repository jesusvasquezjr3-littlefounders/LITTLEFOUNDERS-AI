# GAP-FIX-R4: gap-fix round 4

Lane records of the fourth gap-fix round. Each lane appends its own section; the orchestrator owns `SPRINTS.md`.

## Checkpoint F4-social

Branch `codex/spec-fix4social`. Three audited gaps, each confirmed in the code before it was fixed.

### The gaps, confirmed in code

1. **No tone gate read the profile and social-layer copy** (Appendix J Part 3 Stage 4; F.3; Law 2). The only copy tone gate was `agent/tools/check-family-copy-tone.mjs`. Its scope named the Family namespaces and some `rebuild-family` groups, and its surfaces only `rebuild/{family,banking,wallet}` and `routes/app/{banking,tasks,family,wallet}`. No tone check read `rebuild-profile.json`. The goals-together copy was also unread (`rebuild-learn.json` `together`), and so were the surfaces `rebuild/social`, `rebuild/account`, `routes/app/profile` and `TogetherRoute.tsx`. The copy-budget tests count words, sentences and dashes, not register.
2. **The Bible audits never rendered the Family Connections panels, the end/report dialogs or `/learn/together`** (02 §7, 03 §5, 06 §3). The problems:
   - `lanes/family.mjs` had no state that opened a Connections panel, and its synthetic Core answered none of their reads.
   - `lanes/learn.mjs` had no together state.
   - `verify-family-social.mjs` mocked `canEnd:false`, so the new row actions never rendered.
   - The verifier had also decayed. Its retry and more presses matched the first "Try again" and "Show more" on the page, and newer Family panels now carry those same labels, so the script timed out even before this change (confirmed by running the committed version).
3. **A Tutor saw a child's goals together only as a count, and the coop audit rows never reached the Family history** (E.2, Law 5, OD-27 (1)). Two parts:
   - `CoopGuardianView` was `{ ageFits, enabled, openGoals }`.
   - `getGuardianSocialAuditPage` filtered `action=in.(social.follow,social.unfollow,social.block,social.unblock)`, and its zod enum accepted only those four actions.

### What was built

| SPEC clause | What was built | Where |
|---|---|---|
| E.2, Law 5, OD-27 (1), OD-3 Option B | `public.coop_goal_guardian_goals(p_guardian, p_kid)`, service role only. It refuses a caller without a verified guardian link (`COOP_GUARDIAN_NOT_LINKED`) and a child outside the guardian social tier (`COOP_NOT_ALLOWED`: a self-registered teen's goals are its own, even with a linked Tutor). It reconciles each open goal first. It returns at most 50 open goals the child is asked to or in: kind, target, window, whether the child started it, the child's status, and each other person as invited, active or ended-after-joining. No progress of any kind | `database/migrations/0235_coop_goal_guardian_goals.sql` |
| E.2, Law 5 | `GET /api/v1/family/kids/:kidId/coop-goals`. The route: <ul><li>runs `guardKid`;</li><li>refuses any query;</li><li>refuses a non-guardian tier with `403 ACCOUNT_SELF_MANAGED`;</li><li>reads as the session guardian;</li><li>names each person only through `mayDiscoverProfile(guardian, id)` (else `null`);</li><li>runs `guardKid` again after the reads.</li></ul> The answer is `{ goals: [{ id, kind, target, startsAt, endsAt, startedByChild, childStatus: joined|asked, people: [{ name, status: joined|asked|left }] }] }`, with no account ids and no numbers per person | `backend/src/routes/family.ts`, `backend/src/services/coopGoals.ts` (`readCoopGuardianGoals`, `CoopGuardianGoals`) |
| E.2 | The guardian history also reads the `social.coop_*` rows where the child is the actor or the subject, and `social.coop_goal_closed` for the goals the child joined and was still in (at most 100, read first). Only fixed fields leave Core: the action, the people, the goal id, the reason code and the preset target. An unknown reason or origin is a 502, and a row about another family is dropped even if the transport returns it | `backend/src/services/supabaseRest.ts` (`COOP_AUDIT_ACTIONS`, `CoopAuditRow`, `getGuardianSocialAuditPage`) |
| E.2 (Family surfaces), 06 | The goals-together card lists each goal: the target and end date, who started it, and each person as a row with a status pill. It says "private account" for a person the Tutor may not see and shows no progress. The history renders each goal event as one sentence, with a reason-specific sentence for left, removed, declined and withdrawn. Copy is in EN, es-MX and pt-BR (`familyCoopGoals`: 11 keys; `socialHistory`: 11 keys), within the budget | `frontend/src/rebuild/family/CoopGoalsConsent.tsx`, `coopGuardianGoals.ts`, `rebuild/social/SocialHistory.tsx`, `app-routes/CoopGoalsConsentPanel.tsx`, `routes/app/family/SocialHistoryPanel.tsx` |
| Appendix J Part 3 Stage 4, F.3, Law 2, E.10 | `check-social-copy-tone.mjs` runs the D.8 engine with a second scope file, `social-copy-tone.lexicon.json`. Scope: <ul><li>every `rebuild-profile` group (`complete`: a new group fails until it is listed);</li><li>`rebuild-learn` `together` and the learner-home card's three together keys;</li><li>the Family connection groups.</li></ul> Surfaces: `rebuild/social`, `rebuild/account`, `routes/app/profile`, `TogetherRoute.tsx`, `TogetherView.tsx` and `together.ts`. Categories: guarantee, messaging (E.10), glossary (Tutor, Mentor, coins), bank register, legal register, shouting and B.14. The engine gains `scope.coverage`, `scope.complete` and `scope.accessors` (for example `learnCopy[locale].together`). It no longer counts a comparison of `error.message` as rendering it. There are 14 reviewed keyed exceptions, among them the report note that names the safety team. `accountDeletion.reauth` was reworded in three locales ("to confirm it is you") | `agent/tools/check-social-copy-tone.mjs`, `social-copy-tone.lexicon.json`, `check-family-copy-tone.mjs`, `docs/operations/SOCIAL-COPY-TONE-GATE.md` |
| Bible 02 §7, 03 §5, 06 §3; E.1-E.3; OD-27 (1) | The synthetic Core now answers the graph (`canEnd` true for the parent-created child and false for the linked self-registered teen), requests, history (with goal events), notices (one named, one not), badge links, the coop opt-in view (on, off, not a teen) and the guardian goals read (with the self-managed refusal). New family states: <ul><li>`connections-graph` and `connections-graph-self-managed`;</li><li>`connections-requests` and `connections-history`;</li><li>`social-notices`;</li><li>`connection-end-confirm` and `connection-report`;</li><li>`badge-links`;</li><li>`coop-goals-consent`, `coop-goals-off` and `coop-goals-not-teen`.</li></ul> Each is reached with real presses and waits until the token-bound panels have remounted. The learn lane gains three scenarios (teen with goals, teen asked, a child it is closed to) and the states `/learn@home-together`, `/learn/together@goals`, `@invitation`, `@start-goal`, `@report` and `@closed` | `frontend/scripts/audits/lanes/family.mjs`, `lanes/learn.mjs` |
| E.1/E.3 browser | `verify-family-social.mjs` now answers `canEnd:true` and the DELETE and report writes. In every locale, theme and width it presses End (the confirmation must state the consequence and nothing is sent before confirming), confirms (exactly one DELETE, "Connection ended."), then opens and cancels the report dialog (nothing is sent). Presses are scoped to the graph panel | `frontend/scripts/verify-family-social.mjs` |
| Gates | `social:check` section 9 pins the latest SQL (link, tier, reconcile, no progress), the Core route order, the coop actions of the history read, the card and the history rendering, and the policy line, with 3 new mutation tests. The social tone gate runs in `spec:check` and in the repo gates (`.github/workflows/repo-gates.yml`), with 33 tests | `agent/tools/check-social-tiers.mjs`, `.test.mjs`, `package.json`, `docs/rebuild/policies/SOCIAL-TIERS.md` §1.2 |

Findings the audit pass fixed:

- `/learn/together` ran over the 40-word first view: 43 words for the goals state and 49 for the invitation state. The fixes:
  - The intro and rules were shortened in 3 locales.
  - The invitation heading became "Invitations", and the invited-by line became "{name} asked you".
  - The "With {names}" line was removed, because the members list right below already names them.
  - The empty "No goals yet" state now waits while an invitation is shown.
- The closed page put two sentences (16 words) in one body. The hint is now its own paragraph.
- `invite-link` (GAP-FIX-R3) failed at random with "Missing mint". The toggle was pressed before the token-bound panels remounted, and once the social and goals reads were answered the press was lost often enough to abort a run. The state now also waits for `SOCIAL.settled`.
- The `<time>` elements of the history and requests lacked `data-copy-role`.
- The goals-together paragraphs and the guardian invite notice ran 76 to 89 characters wide at 768 and 1280 px, over the 03 §3 measure. They are now capped at 30rem.

### Verification (local)

- **PostgreSQL 17.6** (owned cluster, port 15650). `verify-coop-goals-postgres.py` applies all 235 migrations and passes 12 checks, one of them new. The Tutor reads the open goal with the child's status and each person asked or joined, and no progress. The invited sibling sees it as asked. An unlinked adult is refused, and so is the linked Tutor of a self-registered teen (`COOP_NOT_ALLOWED`). anon and authenticated cannot call it.
- **Core (vitest).** `family.test.ts` has 95 tests: 6 new for the guardian goals route and 3 for the coop history (fixed fields only, another family dropped, an unknown reason or origin refused). `coopGoals.test.ts` (21) passes. Type-check and lint are clean.
- **Frontend (vitest).** New `CoopGoalsConsent.test.tsx` (7 tests). Also passing: `Together.test.tsx`, `AccountDeletion.test.tsx`, and the family, learn, profile and namespace copy-budget tests. Type-check and lint are clean.
- **Root.** All of these pass: `spec:check`, `secrets:check`, `tools:test` (478 tests), `social:check` and its 30 tests, `check-social-copy-tone.mjs` (1,998 strings, 100%), `check-family-copy-tone.mjs` (4,797 strings, 100%), and the i18n gate.
- **Browser.** `verify-family-social.mjs` passes 12 of 12 runs (3 locales x 2 themes x 375/1280 px): end confirmed, report dialog opened and cancelled, 0 axe violations. `npm run audit:rebuild` covered the 17 new states plus the touched `two-children`, `one-child`, `invite-link` and `teen-selected` states: text fit, proportion and copy budget over 3 locales, 2 themes and 320/375/768/1280 px. The final run of those 21 states is clean: 2,016 text-fit, 504 proportion and 504 copy-budget configurations with no finding and no JS error, and no social, coop or badge read left unanswered. An earlier full run of all 37 `/family` states found only the measure findings fixed above. Their proportion rerun at 768 and 1280 px after the fix is clean (444 configurations).

### Decisions taken with the conservative default (owner questions)

1. **A goal member the Tutor may not discover appears as "private account".** Their name is never shown. For a guardian-tier child, every connection needed the Tutor's approval, so members are normally named.
2. **"Left" means ended after joining.** Someone who declined, was withdrawn or lapsed without ever joining is not listed on the card. The history still records those events.
3. **The Tutor's own opt-in changes (`social.coop_guardian_enabled`/`disabled`) appear in the child's history**, because the child is the subject of those rows. Another verified Tutor of the same child sees them too.
4. **The Spanish and Portuguese noun for "safety"** ("seguridad", "segurança") stays a guarantee word in the social lexicon. The existing labels that name the safety team or a safety list carry keyed exceptions. English "safety" is not in the lexicon; "safe" and "protected" are.

### Migrations (the orchestrator renumbers at merge)

- `0235_coop_goal_guardian_goals.sql` (`@phase: expand`, 4,348 bytes; one function; no table, no row change).

### Open items

- `database/types/database.ts` is not regenerated for `coop_goal_guardian_goals`. Regeneration needs `db:types` against a Supabase stack, and this lane may not touch the shared one.
- The Stage 4 human spot-check of the social copy, and a native es-MX/pt-BR read of the new goals-together and history sentences.
- A linked self-registered teen's goals-together card still says "Only for ages 13 to 17, by the birth date you gave". This is Core's `ageFits:false` for a non-kid account. The card should say the teen manages it themself. This behavior predates the lane and is left unchanged.
