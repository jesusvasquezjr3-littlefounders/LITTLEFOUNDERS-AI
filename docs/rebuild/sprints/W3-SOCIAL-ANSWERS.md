# W3 social, identity and consent: the owner's answers

**Branch:** `codex/spec-w3social`, based on `cfe204d3`. **Sources:** owner log OD-27 (`docs/littlefounders-spec/product/13-OWNER-DECISION-LOG.md`), the per-item answers (`docs/rebuild/OWNER-REVIEW-ANSWERS.md`), Product `10` B.23, E.2, E.3, E.8, E.10, E.11, E.13, and the Frontend Bible for the rebuilt screens.

**Status rule.** Implemented and locally verified is not accepted. Nothing here is accepted, released or deployed, and nothing was pushed. Speed mode (27 September 2026): lean verification per checkpoint; the orchestrator runs the full gates at merge.

## W3S.1: teen cooperative goals (L-04)

**The answer.** OD-27 (1): teens 13 to 17 get one peer mechanic, cooperative goals in small groups of mutual connections, with no rankings and no public progress; no band gets a leaderboard. E.10 (no messaging), E.13 and every connection rule still apply.

### What was built

| Clause | What | Where |
|---|---|---|
| L-04 / B.23: who takes part | `coop_goal_eligible`, read on every action and read: the teen social tier, or a parent-created child whose birth date proves 13 to 17 **and** whose current verified Tutor opted in; never a flagged profile (E.13). Adults, children under 13, guests and the closed tier are refused. | `database/migrations/0188_teen_cooperative_goals.sql` |
| L-04: mutual connections | `coop_goal_edge` / `coop_goal_mutual`: a live follow each way that each side's own rule consented to (the teen's recorded consent, the Tutor's approval for a child, or the family link) and no block. Every member is connected with every other member and with everyone already asked. | same |
| L-04: small groups | 2 to 5 people (1 to 4 asked at creation; at most 5 in or asked), at most three open goals per person, one ask per person per goal. | `0189_teen_cooperative_goal_actions.sql` |
| L-04: shared learning goal, no rankings, no public progress | A preset goal (finish 5, 10, 15, 20, 30 or 40 lessons in 7, 14 or 28 days). The group total (lessons the active members first finished inside the window since each joined) is the only number, returned only to the group's members. No per-member number, rank, score, reward or celebration. | `coop_goal_done`, `coop_goal_overview` |
| Consent | The person asked decides (join or no thanks). A parent-created child also needs the Tutor's opt-in first (default off); turning it off ends the child's memberships at once. | `decide_coop_goal_invitation`, `set_coop_goal_guardian_consent` |
| Leave or remove at any time | Anyone leaves, eligible or not; the creator removes a member or cancels an ask; an inviter cancels their own ask. An ended mutual connection removes the later joiner (the same whichever side acted, so no block is revealed); a goal down to one person with nobody asked closes. | `end_coop_goal_membership`, `coop_goal_reconcile`, the `coop_goal_unfollow` trigger on follows |
| E.10: no messaging | No free-text column anywhere (codes only), strict Core bodies (presets, usernames, one decision). | migrations; `backend/src/routes/coopGoals.ts` |
| E.3: report path | `POST /coop-goals/:goalId/report` reports someone who is or was in the goal, into the existing queue, guardian notices and pattern trigger (`submit_social_report`), optionally leaving in the same step. | `backend/src/routes/coopGoals.ts` |
| E.2: audit | Every change writes its audit row in the same transaction: `social.coop_goal_created`, `social.coop_member_invited`, `social.coop_member_joined`, `social.coop_member_ended` (reason code), `social.coop_goal_closed`, `social.coop_guardian_enabled`, `social.coop_guardian_disabled`. | migrations |
| E.11: retention | The social-graph sweep reconciles goals with something due, deletes closed goals 30 days after closing, and deletes a Tutor opt-in with its guardian link or 30 days after it was turned off. Existing windows only. | `0190_cooperative_goals_retention.sql`; `SOCIAL-GOVERNANCE.md` §3.2 |
| RLS | RLS on all three tables; no browser grant; the service role reads only and writes only through the functions. | migrations |
| Core | `/api/v1/coop-goals` (overview, candidates, create, ask, decide, leave, remove, report) and `/api/v1/family/coop-goals/kids/:kidId` (the Tutor's opt-in, behind the verified-parent gate and the verified link). Core refuses ineligible sessions before any write and maps each database refusal to one answer. | `backend/src/routes/coopGoals.ts`, `backend/src/services/coopGoals.ts`, `backend/src/app.ts`; `socialGovernance.ts` accepts the sweep's three new counts |
| UI, learner shell | `/learn/together` (L-04 page: invitations, goals with the group total and the people as cartoon cards, start a goal, ask someone, leave, remove, report) and a learner-home card shown only when Core says the learner may take part. Built from the shared controls, `data-copy-role` everywhere, copy in EN/es-MX/pt-BR budgeted in the teen band. | `frontend/src/rebuild/learning/{TogetherView.tsx,together.ts,together.css}`, `frontend/src/routes/app/learn/TogetherRoute.tsx`, `LearnHomeView.tsx`, `paths.ts`, `app-routes/learn.tsx`, `rebuild-learn.json` (`together`, `home.together*`); preview `?screen=together&together=ready\|empty\|reached\|closed\|loading\|error\|offline` and `?screen=learnhome&together=1` (`togetherFixtures.ts`) for the pre-merge audits |
| UI, Family console | The Tutor's "Goals together" card in a child's Connections group. | `frontend/src/rebuild/family/CoopGoalsConsent.tsx`, `frontend/src/routes/app/family/CoopGoalsConsentPanel.tsx`, `FamilyPage.tsx`, `rebuild-family.json` (`familyCoopGoals`) |
| Gates | `guardrails:check` section 5 (eligibility, 13-to-17 proof, consented edges, group size, group-total-only overview, no free-text column, strict bodies, mounted route, sweep coverage, policy note); `rewards:check` rule 4 (the cooperative-goal code names no coins, XP, reward, badge, streak, celebration, rank, leaderboard or winner, and exists). | `agent/tools/check-social-governance.mjs`, `agent/tools/check-reward-mechanics.mjs` (+ tests) |
| Policy | `SOCIAL-TIERS.md` §1.2 (the mechanic and its rules); `SOCIAL-GOVERNANCE.md` §3.2 (retention). | `docs/rebuild/policies/` |

### Verification (lean, speed mode)

- PostgreSQL 17.6 (lane-owned cluster, port 15530): `database/scripts/verify-coop-goals-postgres.py`, 10 checks, all 190 migrations applied in order: eligibility per population; the Tutor's opt-in (and its refusals); creation refusals (adult, under 13, flagged, unconnected, off-preset); invite and decide rules; the member-only group total; remove, unfollow-ends-the-later-joiner and close; siblings with the opt-in, leave and opt-in off; the sweep (close, delete after 30 days, opt-in deletion) and every audit action; no browser grant and no coop name in the E.10 scan.
- Core: `backend/src/__tests__/coopGoals.test.ts` (17 cases: every refused population before any write, unreadable eligibility is 502, one answer for an unknown or unconnected person, each refusal mapped, no free text, session as actor, overview shape with no per-member number or reward, guest view, candidates, report membership rule, Tutor gate).
- Frontend: `frontend/src/rebuild/learning/Together.test.tsx` (view and client), `copy-budget/learn.test.ts` and `copy-budget/family.test.ts` (the new groups).
- Root: `spec:check` (includes `guardrails:check` section 5 and `rewards:check` rule 4), `secrets:check`, i18n gate; gate self-tests `check-social-governance.test.mjs` and `check-reward-mechanics.test.mjs` include the new mutations.
- Not run (orchestrator, per speed mode): browser matrices, `audit:rebuild`, full suites, a screenshot.

### Conservative defaults taken (owner questions)

1. **Parent-created children aged 13 to 17** take part only after their verified Tutor turns goals together on (default off, one opt-in per child), following E.10's opt-in pattern for a peer feature; self-registered teens need no guardian (OD-3). Age for a parent-created child comes from the profile birth date only; no birth date means not eligible.
2. **Group rule:** every member must be mutually connected with every other member (not just with the creator).
3. **Who removes:** the creator removes members and cancels any ask; there is no other admin role. An ended connection removes the later joiner.
4. **Goal shape:** one goal kind (lessons finished together), preset targets 5 to 40 and windows of 7, 14 or 28 days; at most three open goals per person; one ask per person per goal.
5. **Progress:** the group total counts only current active members' lessons since each joined; a member who leaves takes their lessons out of the total.
6. **Reaching the goal** is an informational line, not a celebration and not a reward (OD-7's list does not include it).
7. **A linked guardian of a self-registered teen** gets no notice when the teen joins a goal (OD-3; the audit row records it).

### Remaining

- Deploy order when shipped: Core (accepts the three new sweep counts) before `cooperative_goals_retention`; the two other migrations are expand.
- Browser capture, text-fit, proportion and copy-budget audits of `/learn/together` and the Family card; human visual and copy review; Stage 3 Safety/Trust review of the mechanic; acceptance and release.
- The owner questions above.

## W3S.2: UI for the remaining owner answers (S-03, S-04, S-06, M-12)

The server contracts are W3A's (see [W3-OWNER-ANSWERS.md](W3-OWNER-ANSWERS.md)); this checkpoint puts them on rebuilt screens and adds the two display hints Core needed for M-12. No migration.

| Answer | What was built | Where |
|---|---|---|
| S-03 (OD-27 (2)) | Already on the tree from the W2 profile lane (`80ec5406`): the Settings switch "Let people find my profile" appears only when `GET /profile` says `social.discoverable.canChoose` (a 16-17-year-old with age proof and an unflagged profile) or while it is on; it states who can see the profile, that people still ask before following and nobody can message, and asks before turning it on. Re-read against the contract; nothing to change. | `frontend/src/rebuild/account/DiscoverableCard.tsx`, `frontend/src/routes/app/profile/DiscoverableSetting.tsx` |
| S-04 (OD-28, E.4) | The age screen now says the answer cannot be changed later (every age) and, once the typed date reads 13 to 17, that the account moves to adult settings at 18; only then is `birthMonth` (`YYYY-MM` of the date) sent with `birthDate`. Sign-up does the same. Settings shows a read-only age card to a self-managed teen (month kept / age group kept / moved to adult at 18) with no control, from `GET /auth/age-screen`; nobody else sees it. | `frontend/src/rebuild/identity/{AgeScreen.tsx,ageFromParts.ts,SignInScreens.tsx}`, `frontend/src/auth/{RequireAgeScreen.tsx,AuthContext.tsx}`, `frontend/src/rebuild/account/AgeRecordCard.tsx`, `frontend/src/routes/app/profile/{AgeRecordSetting.tsx,SettingsRoute.tsx}`; copy `ageScreen.locked/teenMonth`, `authSignup.teenMonth`, `ageRecord.*` |
| S-06 (OD-28) | The Family console's flagged-username change (built by W2F, server by W3A) now reads `sessionsEnded`: the Tutor is told the child signs in again with the new name, or that an older sign-in may stay open when Core could not end the sessions. | `frontend/src/rebuild/family/console/{ChildControls.tsx,consoleApi.ts}`; copy `familyChildAccount.usernameSignInAgain/usernameStillSignedIn` |
| M-12 (OD-26) | OD-26 names the consent: the teen's own usage-data opt-in and, for a 10-12 child, the guardian's usage-data consent. Both switches now say, beside the switch and before it is turned on, that the same consent lets the Mentor test two hint styles with the learner. Core decides when that is true: `dialogueExperiment` on `GET/PUT /auth/analytics-preference` (the teen band, or a teen who moved to adult by birth month, is in `MENTOR_DIALOGUE_EXPERIMENT_BANDS`) and per child on `GET /family/kids` (a parent-created child whose profile birth date proves 10 to 12, or 18+, with that band configured; never 6-9 and never a parent-created teen, who also needs an own opt-in they do not have). A display hint only; `resolveDialogueCalibration` still re-decides every session. A child just added with a 10-12 birth date shows the line until the list is read again (over-telling is the safe side). | `backend/src/services/dialogueExperimentNotice.ts`, `backend/src/routes/{auth.ts,family.ts}`, `frontend/src/rebuild/privacy/AnalyticsChoice.tsx`, `frontend/src/routes/app/profile/TeenAnalyticsSetting.tsx`, `frontend/src/rebuild/family/console/{ChildControls.tsx,consoleApi.ts}`; copy `analyticsChoice.experiment`, `familyChildConsent.insightsExperiment` |

All new UI uses the shared controls (`Card`, `Copy`, `Switch`), `data-copy-role` on every text, tokens only, and copy in EN, es-MX and pt-BR within the Copy Budget (age screen at 6-9, the age card and the teen switch at 13-17, the console at adult). The profile preview (`?screen=account-settings&state=teen`) shows the age card and the switch with the test line for the pre-merge audits.

### Verification (lean, speed mode)

- Core: `analyticsPreference.test.ts` (the hint is true for a teen while the teen band is open, false when an operator narrows the bands to `adult`, and false for a kid-role teen, an adult who declared as an adult and an under-13 origin) and `family.test.ts` (the exact-shape whitelist now includes `dialogueExperiment`; 10, 11 and 12 are marked, 8, 9, 13 and 17 are not, and a self-registered teen who linked the Tutor never is). `type-check` and `lint` green.
- Frontend: `identity.test.tsx` (age screen lock line, teen line only for 13-17, `birthMonth` only then; `ageFromParts`; sign-up sends the month for a teen), `RequireAgeScreen.test.tsx` (the guard's body), `AgeRecordCard.test.tsx` (each state, nobody else, no control; the switch's test line only when marked), `FamilyConsole.test.tsx` (the test line only for a marked child; the rename notice for `sessionsEnded` true, false and absent), `consoleApi.test.ts`, `copy-budget/{site,profile,family}.test.ts`. `type-check` and `lint` green.
- Root: `spec:check`, `secrets:check`, i18n gate.
- Not run (orchestrator, per speed mode): browser matrices, `audit:rebuild`, full suites, a screenshot.

### Conservative defaults taken (owner questions)

8. **S-04 has no opt-out.** The merged server keeps a teen's birth month derived from the date whether or not `birthMonth` is sent (W2S's design stands, per the W3 merge note), so the screens disclose it instead of offering a choice. Offering "don't keep my month" would need a server change and would leave that teen in the teen tier after 18.
9. **M-12 consent is the usage-data consent, disclosed.** OD-26 names the analytics consent; no separate experiment-only switch was added. A parent-created 13-17-year-old stays outside C.17 (their own opt-in does not exist).
10. **The age card** shows no birth month itself (Core does not return it), only what was kept and when the move happens.

### Remaining

- Browser capture, text-fit, proportion and copy-budget audits of the changed age screen, sign-up, Settings (age card, switch line) and Family console lines; human visual and copy review; acceptance and release.
