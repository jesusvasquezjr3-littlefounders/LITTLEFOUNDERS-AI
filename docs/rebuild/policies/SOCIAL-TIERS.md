# Social tiers, comparison counts and profile-content review

Status: implemented and locally verified in S08.6 (25 September 2026), including real PostgreSQL 17 evidence of the database half. Not accepted: the Appendix J §2.1(4) reviewer, the Stage 3 Safety/Trust review, the Stage 5 family usability pilot, the owner decisions in section 7, evidence against the real Supabase stack and production readings of the metrics are open. See [the S08 sprint record](../sprints/S08-PROFILES-SOCIAL-AND-SHARING.md#s086-implementation-and-rationale).

Binding sources: Product `10` E.8, E.9 and E.13 and components 1, 3 and 4 of the Block E standard; Appendix I (research basis) and Appendix J (metrics, Definition of Done, Part 3 pipeline); owner decision OD-3 (every minor safeguard follows age, not role; the self-registered teen's lighter tier); Frontend Bible `02` and `06` for the rebuilt surfaces. `npm run social:check` (part of `spec:check`) keeps this document, the database and the code in step.

## 1. The tiers (E.8)

Every account has exactly one social tier. The database decides it (`public.social_tier`, migration `social_age_tiers`) from service-owned evidence. It never uses anything the caller says about itself, and it never uses the role alone. Core asks the same function, and so do the database's own follow trigger and visibility policy. The two cannot disagree about who is who.

| Tier | Who (evidence, in this order) | Profile | Inbound connection | Outbound connection | Who decides |
|---|---|---|---|---|---|
| guardian | A parent-created child (`kid` role, any age). Also an under-13-origin account (A.2 marker) that a verified guardian has linked | Not discoverable. The linked family sees it. An outsider sees it only through a current guardian approval (E.1) | Only through a request that a current verified guardian approves (E.1, unchanged) | Only inside its family, or back to an account its guardian already approved. Anything else is refused (`GUARDIAN_MANAGED_CONNECTIONS`). No independent loosening by the child | The verified guardian |
| teen | A self-registered account whose age screen said 13 to 17, with no verified adult evidence | Private by default; a proven 16- or 17-year-old may opt in to a discoverable profile (section 1.1). Another account sees a card with the handle it typed, the cartoon avatar and the cover preset, plus one way to ask. The whole profile is visible only to an account the teen accepted, an account the teen chose to follow, and the teen's verified guardian if one exists | Only through the teen's own recorded consent: request, then the teen accepts or declines. A direct follow is refused (`SUBJECT_CONSENT_REQUIRED`) | The teen follows adults directly. It asks another teen, and a child's guardian, like anyone else | The teen, with no guardian asked (OD-3: none exists in this flow) |
| adult | A screened adult (age screen said adult), or a parent whose latest ID verification is current and 18+ | Public under the Block E rules. The Tutor badge follows E.5 | Open follow, unless blocked | Open follow, except into a child or a teen, which follows their rules | The account holder |
| closed | A guest; an under-13-origin account with no guardian; an account with no age screen yet; an account with no role evidence | Not visible to anyone but itself | None (`SOCIAL_TIER_CLOSED`) | None | Nobody. OD-3 gives guests no social layer. The age screen A.3 requires moves an unscreened account out of this tier |

Rules that hold in every tier:

- An unreadable tier is no access, never an adult (§1.14). Core answers 404 or 502, and the database raises.
- A closed-tier viewer sees no profile but its own.
- A block closes everything between the pair: follows both ways, pending and approved guardian requests, and pending and accepted teen consents.
- Every follow, unfollow, block, unblock, request, decision, removal and revocation writes an audit row in the same transaction (E.2). The teen actions are `social.connection_requested`, `social.connection_accepted`, `social.connection_declined`, `social.connection_revoked` (reasons `unfollow`, `block`, `removed_by_subject`) and `social.follower_removed`. Each carries `tier: 'teen'`.

The teen's consent queue (`social_consent_requests`) is service-only. It has RLS and no browser policy. Core reads it with the service role, and even the service role writes only through `request_teen_connection`, `decide_teen_connection`, `withdraw_social_connection` and `remove_social_follower`. Each takes the same per-pair advisory lock as every other social transition. Abuse limits are set in the database: one account can hold at most 20 pending teen requests, and a declined requester waits 30 days to ask the same teen again. A flagged minor (section 3) can neither request, accept nor follow outside its family until the flag is fixed.

### 1.1 A discoverable profile at 16 or 17 (S-03, OD-27)

Owner decision OD-27 (2), 27 September 2026: a 16- or 17-year-old may opt in to a discoverable profile. Private remains the default for every teen. Migration `teen_discoverable_profile`, Core `services/teenDiscoverability.ts`.

- **Who may opt in.** An account in the teen tier (self-registered, 13 to 17, no verified adult evidence) whose age evidence **proves** 16 or more, and whose profile fields are not flagged (E.13). Proof is a birth month kept by the age screen (S-04), counted only after the whole 16th-birthday month has passed, or a profile birth date. A declared teen with no birth month cannot prove 16, because the band alone says 13 to 17, so the choice is not offered. A parent-created child (any age), an under-13-origin account, a 13-to-15-year-old, an adult and every closed-tier account cannot opt in (`DISCOVERABLE_NOT_ELIGIBLE`).
- **How.** `PUT /api/v1/profile/discoverable` with `{ "discoverable": true | false }`, nothing else. Only the teen's own session can make the choice. Turning it on needs eligibility; turning it off always works. The database records it in `teen_profile_discoverability` through `set_teen_profile_discoverable`, which writes `social.profile_discoverable_enabled` or `social.profile_discoverable_disabled` to the audit log in the same transaction (`tier: 'teen'`, no names). An unchanged answer writes nothing. `GET /api/v1/profile` reports `social.discoverable: { canChoose, enabled, reason }`, and `privateProfile` is false only while the profile is discoverable.
- **What it changes.** The whole profile is visible to any signed-in account outside the closed tier, as an adult's is, and the teen may appear in other accounts' lists (`profileAccess` answers `full`; `social_subject_visible` answers true).
- **What it does not change.** A follow into the teen still needs the teen's own recorded consent (`SUBJECT_CONSENT_REQUIRED`). There is no messaging of any kind (E.10). A minor's learning stats and activity date stay hidden from other accounts. A flagged profile stays hidden from everyone outside the family (the E.13 check comes first).
- **It lapses by itself.** Visibility asks `teen_profile_discoverable` on every read, which re-checks eligibility. A flag on the handle or the name hides the profile at once, and at 18 the adult tier's rule takes over. No sweep is needed. The stored choice is kept, so a fixed flag restores it; the teen can turn it off at any time.
- **The linked guardian.** A teen who linked a parent keeps deciding (S-05). The guardian already sees the teen's full profile. No notice is sent: E.10's guardian-notice rule is for messaging-adjacent features, and discoverability adds no way to send anything. The audit row records every change. Whether a linked guardian should also get an active notice is recorded as an open question in the W3 record.
- **Independent teens.** OD-27 names 16- and 17-year-olds without requiring a guardian link, so an independent (Option B) teen may opt in on the same terms.
- **Migrated teens (OD-9 section 4.2, OD-10).** Being discoverable is the registered data practice `sharing.discoverable_profile` (sharing surface, migration `discoverable_profile_data_practice`, GAP-FIX-R3). For an account the OD-9 consent step marked as a migrated child, it applies only after a verified Tutor gives the specific consent in the Family Hub's data-practice panel; the teen alone cannot (`teen_self_consent` false, like every sharing surface). `teen_discoverable_eligible` requires `data_practice_applies`, so an opt-in recorded before the marking lapses by itself and a revoked consent hides the profile at once. An otherwise eligible teen without the consent is refused by name (`DATA_PRACTICE_CONSENT_REQUIRED`), and `GET /api/v1/profile` reports `social.discoverable.reason` so Settings can say a Tutor must allow it first. A marked independent teen with no verified Tutor therefore stays private. Every account the consent step did not mark is unaffected.
- **Gate.** `npm run social:check` fails if the latest eligibility function stops requiring the teen tier, the 16+ proof, an unflagged profile or the OD-9 practice, if the setter stops naming a missing consent, if the visibility function consults the choice outside the E.13 check, if Core asks it before the flag check or makes it the default, or if the route accepts anything but one boolean. `database/scripts/verify-teen-discoverable-postgres.py` proves the database half on PostgreSQL.

Historical follows are not consent. A follow into a teen that existed before this checkpoint grants no visibility. The teen sees it in "People who follow you" and can remove it. It is not deleted by the migration.

### 1.2 Cooperative goals for 13-to-17-year-olds (L-04, OD-27 (1))

Owner decision OD-27 (1), 27 September 2026: teens 13 to 17 get one peer mechanic, cooperative goals in small groups of mutual connections, with no rankings and no public progress; no band gets a leaderboard. Migrations `teen_cooperative_goals`, `teen_cooperative_goal_actions` and `cooperative_goals_retention`; Core `routes/coopGoals.ts` and `services/coopGoals.ts`; the learner's page is `/learn/together`; the Tutor's opt-in is a card in the Family console's Connections group. Record: [W3-SOCIAL-ANSWERS.md](../sprints/W3-SOCIAL-ANSWERS.md).

- **What it is.** A shared goal, "finish N lessons together" (N one of 5, 10, 15, 20, 30, 40) in 7, 14 or 28 days, for 2 to 5 people. The only progress is the group total: lessons the active members first finished inside the window since each joined. It is shown only to the group's own members. There is no per-member number, no order of people but the order they joined, no score, no ranking, no public view, no coins, XP or badge, and no celebration (reaching it is said once, as information; OD-7's list has no group goal).
- **Who takes part** (`coop_goal_eligible`, read on every action and every read). The teen social tier (a self-registered 13-to-17 account; OD-3: no guardian asked); or a parent-created child whose profile birth date proves 13 to 17 today and whose current verified guardian turned goals together on (default off, one opt-in per child, E.10's pattern). Never a flagged profile (E.13). Adults, children under 13, a child without the opt-in, guests and the closed tier are refused (`COOP_NOT_ELIGIBLE`). No adult is ever in a group, as a member or an observer.
- **Who can be asked.** Only a mutual connection of every member (and of every person already asked): a follow each way that each side's own rule consented to (the teen's recorded consent, the Tutor's approval for a child, or the family link) and no block (`coop_goal_mutual`). An unknown handle, an ineligible person and an unconnected person get the same answer (`COOP_MEMBER_UNAVAILABLE`), so nothing about them leaks. One ask per person per goal: after a no, the same goal cannot ask again. At most three open goals per person.
- **Consent.** The person asked decides (join or no thanks); nobody is added without their own yes. For a parent-created child, the Tutor's opt-in comes first, and turning it off takes the child out of every goal at once.
- **Leaving and removing.** Anyone leaves at any time, eligible or not. The person who started the goal removes a member or cancels an ask; whoever asked someone can cancel their own ask. When a mutual connection between two members ends (an unfollow, a removed follower, a block), the member who joined later leaves the goal; the same happens whichever side acted, so nobody learns who unfollowed or blocked. A goal closes at the end of its window, or when it is down to one person with nobody asked.
- **No messaging (E.10).** A goal has no free text: no name, no note, no message, no reaction. The database holds codes only (`guardrails:check` section 5 and the live E.10 scan), and Core's bodies are strict (presets, usernames and one decision).
- **Report (E.3).** From inside a goal, a member reports someone who is or was in it with them (`POST /coop-goals/:goalId/report`), into the same safety queue, guardian notices and pattern trigger as a profile report, and may leave in the same step.
- **Audit (E.2).** Every change writes its row in the same transaction: `social.coop_goal_created`, `social.coop_member_invited`, `social.coop_member_joined`, `social.coop_member_ended` (with the reason code), `social.coop_goal_closed`, `social.coop_guardian_enabled`, `social.coop_guardian_disabled`.
- **The Tutor sees the goals (E.2, Law 5; GAP-FIX-R4).** For a parent-created child (the guardian tier), the verified Tutor's goals-together card lists every open goal the child is asked to or in: the target, the end date, whether the child started it, and each other person by name (only through the same E.1 discovery check the connection history uses; otherwise "private account") with a status: asked, joined or left. It shows no progress at all: the group total stays with the group, and there is no number per person. `public.coop_goal_guardian_goals` (service role only: the verified link, the guardian tier, reconcile first) and Core `GET /family/kids/:kidId/coop-goals` (re-checks the link after the read). A self-registered teen's goals stay its own even when it linked a parent (OD-3 Option B): `ACCOUNT_SELF_MANAGED`. The Family connection history also reads the `social.coop_*` rows where the child is the actor or the subject, and the closing of a goal the child was in, so the Tutor can reconstruct goal activity; only fixed fields leave Core (the action, the people, the goal id, the reason code, the preset target).
- **Retention (E.11).** [SOCIAL-GOVERNANCE.md §3.2](SOCIAL-GOVERNANCE.md#32-retention), "Cooperative goals (L-04)".
- **Gate.** `npm run guardrails:check` section 5 (part of `spec:check`), `rewards:check` rule 4 and `social:check` section 9 (the Tutor's view and history); `database/scripts/verify-coop-goals-postgres.py` proves the database half on PostgreSQL.

### 1.3 The Tutor ends or reports a child's connection (E.1, E.3, E.13; GAP-FIX-R3)

- **Rule.** For a guardian-tier child, the verified Tutor who can approve a connection can also end it, in both directions, from the Family list or from a safety notice that names the account. Ending revokes the approval, so any new follow needs a fresh one. The Tutor can also report the account (the guardian is the reporter; same queue, notices and pattern evaluation as any report). A self-registered teen's list stays read-only to its linked parent: the teen decides its own connections.
- **Where.** `public.guardian_end_social_connection` (service role only: current guardian and latest adult verification re-checked under the pair locks, one `social.connection_revoked` audit row with reason `guardian_ended`); Core `DELETE /family/kids/:kidId/social/connections/:userId` and `POST .../report`; `rebuild/social/ConnectionActions.tsx`.
- **Gate.** `social:check` section 8; `database/scripts/verify-social-guardian-end-postgres.py`.

### 1.4 Report and block from the request queues (E.3, OD-8, D-19; GAP-FIX-R5)

**Report and block from the request queues (E.3, D-19; GAP-FIX-R5).** An inbound connection request is the first unwanted-contact event in the product, so the two queues that decide one are also where a concern is acted on (E.3's "path to act on a concern"; OD-8's "report action for unwanted contact").

- **Rule.** The Tutor reports the requester from a child's pending queue (the guardian is the reporter; reporting does not decide the request, the Tutor still approves or denies it). A self-registered teen reports or blocks the requester from its own queue; a block also closes the request (the blocks trigger sets it `removed`) and the requester cannot ask again. Both are addressed by the request id, never by the requester's profile, so a requester the viewer cannot otherwise see is still reportable. A request stays actionable while pending and for 30 days after it closed without a connection (Tutor: `denied`, `revoked`; teen: `declined`, `removed`, `withdrawn`), the same window as the decline cooldown, so a decline is not the end of the path.
- **Why it matters for D-19.** An adult may ask a teen to connect; the E.3 pattern trigger is one of the limits. A decline alone never reached the trigger (`evaluate_social_pattern` reads reports and blocks only). Reports and blocks from the teen queue do: three unrelated teens acting from their queues put the requester in front of staff. A Tutor's report opens a staff review case on its own (`origin = 'report'`), but the Tutor is an adult, so it does not count toward the three-minor pattern (owner question in GAP-FIX-R5).
- **Where.** Core `POST /family/kids/:kidId/social/requests/:requestId/report` (`guardKid` before and after, the bounded report body, `getGuardianReportableRequest`), `POST /profile/connection-requests/:requestId/report` and `.../block` (`getTeenActionableRequest`, the session is the reporter and the blocker); `rebuild/social/SocialRequests.tsx` and `rebuild/social/TeenConnections.tsx` (the shared `ReportDialog`, the block behind a `DestructiveAction` confirmation).
- **Gate.** `social:check` section 10; `backend/src/__tests__/socialRequestReports.test.ts`; `database/scripts/verify-social-request-report-postgres.py` (in `social:db-verify`, which runs on every push through `repo-gates.yml`).

## 2. No comparison count (E.9)

Decision: follower and following counts are removed from every profile surface. They are not made opt-in. E.9 allows either; removal is the conservative answer, and Appendix I Part 4 identifies the count as the one comparison-to-others metric on the profile.

- Core emits no count. `GET /api/v1/profile` and `GET /api/v1/profiles/:username` carry no `followers` or `following` number, and neither route issues a count query.
- The legacy profile pages render the lists as plain "Followers" and "Following" links, with no number. The links sit in their own row outside the stats block, so nothing sits next to XP, streaks or badges.
- The rebuilt teen surface lists people to decide about. It shows no count of requests or followers.
- `npm run social:check` fails if either profile route reads a count or either page renders one. This automates the quarterly Comparison-Metric Audit that Appendix J proposes. Its self-test proves both regressions fail.

## 3. Profile-content audit (E.13)

### 3.1 What an approved or earlier viewer can see

Every Core surface that returns profile data was reviewed for what it would let a viewer use to find the account holder outside LittleFounders. Core is the only backend the SPA calls. Surfaces not listed return no profile data.

| Surface | Fields a non-family viewer receives | Verdict | Fix in S08.6 |
|---|---|---|---|
| Public profile `GET /profiles/:username` (full) | display name, username, cover preset, cartoon avatar options, member-since month, Tutor badge (E.5), XP, minutes, lessons, streak, last active date, course badges | Display name and username can carry a handle, school, street, contact or birth year. The last active date says whether a minor is online today, which is a presence signal | Both fields are reviewed (3.2). A minor's flagged profile is hidden from every non-family viewer. The last active date is withheld from everyone but a minor themself |
| Private teen card | username, cartoon avatar options, cover preset | The viewer already typed the handle; the avatar is a closed cartoon option set (E.12, no upload) | New in S08.6. Hidden entirely while the teen's fields are flagged |
| Follower/following lists (own and public) | display name, username, avatar options, Tutor badge | The same name risk. The Tutor badge was derived from the bare parent role, which leaked E.5's trust signal through lists | Lists include only accounts the viewer may see in full, so flagged minors and private teens drop out. The badge now uses E.5's relationship rule for each card |
| Teen request queue | requester's display name, username, avatar | The requester chose to reveal itself to this teen, and a flagged minor cannot request | New in S08.6 |
| Family panel (guardian only) | the child's own fields; names of requesters, connections and history participants | Family context. Other accounts' names resolve only through the access rule | A requester's name shows at card level. A flagged or hidden account stays unnamed. Each flagged child carries a notice (3.3) |
| Achievement image (S08.4) | child's first name, achievement | Reviewed in S08.4: first name only, no handle, no photo | None |
| Staff report queue | names needed for moderation | Staff under `manage_support` (G.1), audited | None |
| Mentor, lessons, wallet, tasks | not social surfaces | Not exposed to other accounts | None |

The profile has one free-text field (display name, 80 characters) and one constrained handle (username, `[a-z0-9_]{3,20}`). There is no bio, no location, no school and no link field. The cover is a preset and the avatar a closed DiceBear option set. Standing constraint: no free-text field may be added to a minor's profile unless it goes through the same review. `social:check` pins the patch schema to display name, username and locale.

### 3.2 The review

`public.profile_field_flags` in the database and `profileFieldFlags` in Core (`backend/src/services/profileFieldSafety.ts`) apply the same rules. `social:check` compares every pattern literally, and both run the shared corpus in `database/scripts/fixtures/profile-field-safety-cases.json`: 43 cases, ordinary names included. A field raises these flags:

| Flag | Rule |
|---|---|
| contact | an email address, or 7 or more digits (a phone number) |
| link | a URL, `www.`, or a domain ending (.com, .net, .org, .io, .gg, .tv, .me, .app, .ly, .link, .mx, .br, .co) |
| handle | an `@` |
| platform | another platform's name or short form reused as a handle: instagram, tiktok, snapchat, youtube, discord, roblox, fortnite, twitch, twitter, facebook, whatsapp, telegram, playstation, xbox, minecraft, pinterest, reddit, kwai, likee, zepeto, and the tokens ig, yt, fb, ttv, psn, rblx, snap, insta, xbl |
| school | school, escuela, escola, colegio/colégio, primaria/primária, secundaria/secundária, elementary, kinder, preescolar, liceo, instituto, academy/academia, "class of", "grade N", "Nth grade", grado, "série N" |
| location | street, avenue/avenida, apartment/apartamento, código postal, zip code, the words calle, rua, road, cep, apt, depto, colonia, bairro and barrio, or a 5-digit postal code |
| year | a year from 1950 to 2039 (a birth year) |

Deliberate limits, not claimed as covered: a city or neighbourhood name, a surname, and a handle with no platform marker are not reasonably detectable by rules. E.13 asks for detection "where reasonably detectable". The copy at the point of entry asks for a first name or nickname. A human review of flagged and unflagged samples is part of the open Stage 3 review.

Scope: every minor tier (guardian and teen), plus an account a verified guardian has linked, such as a child still being created, whose link exists before its role. Adults are not reviewed.

### 3.3 Enforcement

- **The database refuses** a flagged username or display name for an in-scope account, from any writer: browser, Core or the service role (`profile_fields_guard`, `PROFILE_FIELD_UNSAFE`). A value that was already there is not refused on an unrelated edit, so a locale change still works.
- **The database records** a review for every in-scope profile: at creation, on every edit, when the account enters scope (age declaration, `kid` role, verified guardian link), and in a backfill of every existing profile when the migration runs. The record holds flags only, never the text.
- **Core answers first.** `PATCH /api/v1/profile` (teen or child), `POST /api/v1/family/kids` and `PATCH /api/v1/family/kids/:kidId` return 422 `PROFILE_FIELD_UNSAFE` with the field names before any write. No account is created with a flagged handle.
- **Containment.** A flagged minor's profile is hidden from every viewer outside its family (Core's access rule and `social_subject_visible`). The minor cannot request, accept or follow outside the family.
- **The right person is told.** A teen sees which field to change in Settings. A child sees which field it can change and is told to ask its Tutor about a username (A.6 keeps a child's username fixed). The Tutor sees a notice on the child's Family card and can rename the child there.

## 4. Metrics (Appendix J)

`GET /api/v1/admin/analytics/social-safety` (staff with `view_analytics`) returns counts only, from `public.social_safety_metrics`:

- accounts by tier: the population the Age-Tier Differentiation Coverage applies to;
- Profile-Content Safety Review Coverage: in-scope profiles, reviewed, flagged, and the same for the guardian tier the metric names, with the coverage rates. The target is 100%, true by construction and reported so a regression would show;
- the teen consent queue: pending, accepted, declined, and withdrawn or removed.

Other Appendix J metrics owned elsewhere: Cross-Family Discovery and the guardian queue (E.1/E.2, S02) and the report pattern trigger (E.3, S02). Production readings are open.

## 5. Runbook

1. Apply migration `social_age_tiers` (expand). It adds the tier function, the teen consent queue, the classifier, the review record and its backfill, and the metric. It narrows nothing, so the auto-apply gate may apply it.
2. Deploy Core and the frontend from this lane. Core needs step 1's functions. Before step 3, teen requests, decisions and tier-aware visibility work. Two things wait for step 3: follower removal answers 502, because `remove_social_follower` ships with the contract migration, and withdrawing a pending teen request leaves that request pending, because the withdrawal function that also closes teen consents is replaced there.
3. Apply migration `social_tier_enforcement` (contract) after that Core release is live. It replaces the follow admission trigger, `social_subject_visible`, the block and withdrawal functions, and adds the follower removal function and the profile-field write guard. The migration-phase gate lists it as pending and auto-apply refuses it.
4. Verify on an owned PostgreSQL: `python database/scripts/verify-social-tiers-postgres.py` (section 6 of the sprint record has the exact environment).
5. Read `GET /api/v1/admin/analytics/social-safety`: coverage must be 1.

To change the classifier, edit the SQL function (new migration), `profileFieldSafety.ts` and the corpus together. `social:check`, the Core parity test and the PostgreSQL verifier all fail on drift.

## 6. Standing constraints

- A child's connections are decided by its guardian, and a teen's by the teen. No surface may create a connection another way.
- No follower or following count on any profile surface.
- No free-text field on a minor's profile without the E.13 review.
- The tier comes from the database's `social_tier`, never from the role alone or the client.
- Any messaging or comment feature remains governed by E.10 (default off for both minor tiers).

## 7. Proposals for the owner (conservative defaults implemented)

1. ~~**Teens cannot make their profile public.**~~ Answered by OD-27 (S-03): a 16- or 17-year-old may opt in to a discoverable profile; private stays the default (section 1.1).
2. ~~**A declared teen stays in the teen tier until there is verified adult evidence.**~~ Answered by OD-28 (S-04): the age screen may also keep a birth month with the first 13-to-17 declaration, and the account moves to the adult tier after its 18th-birthday month (`promote_age_declaration`, migration `0179_age_declaration_birth_month`; every tier reader follows `effective_age_band`, migration `0182_effective_age_band`). A band-only teen still moves only on verified adult evidence.
3. ~~**Adults may ask a teen to connect.**~~ Answered by D-19 (OWNER-REVIEW-ANSWERS): they may; the teen decides, and the 20-request cap, the 30-day cooldown and the report pattern trigger (E.3) apply. The trigger counts a self-registered teen's reports and blocks like a child's, by age tier (OD-3; migration `social_pattern_age_based`, proven by `database/scripts/verify-social-pattern-postgres.py`).
4. **A teen whose parent links later stays self-managed.** The guardian sees the teen's full profile, but the teen keeps deciding. Owner question: should a guardian link move a teen into the guardian tier?
5. ~~**A child's username flagged before this checkpoint can only be changed by support.**~~ Answered by OD-28 (S-06): a verified Tutor changes the flagged handle of their parent-created child with `PUT /api/v1/family/kids/:kidId/username`; the handle, the derived sign-in address and the audit row change in one transaction (`guardian_rename_flagged_child`, migration `guardian_child_username_change`), and the child's sessions end.
6. **Counts are removed, not opt-in** (section 2).
