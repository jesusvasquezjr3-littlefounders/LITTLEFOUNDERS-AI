# Social tiers, comparison counts and profile-content review

Status: implemented and locally verified in S08.6 (25 September 2026), including real PostgreSQL 17 evidence of the database half. Not accepted: the Appendix J §2.1(4) reviewer, the Stage 3 Safety/Trust review, the Stage 5 family usability pilot, the owner decisions in section 7, evidence against the real Supabase stack and production readings of the metrics are open. See [the S08 sprint record](../sprints/S08-PROFILES-SOCIAL-AND-SHARING.md#s086-implementation-and-rationale).

Binding sources: Product `10` E.8, E.9 and E.13 and components 1, 3 and 4 of the Block E standard; Appendix I (research basis) and Appendix J (metrics, Definition of Done, Part 3 pipeline); owner decision OD-3 (every minor safeguard follows age, not role; the self-registered teen's lighter tier); Frontend Bible `02` and `06` for the rebuilt surfaces. `npm run social:check` (part of `spec:check`) keeps this document, the database and the code in step.

## 1. The tiers (E.8)

Every account has exactly one social tier. The database decides it (`public.social_tier`, migration `social_age_tiers`) from service-owned evidence. It never uses anything the caller says about itself, and it never uses the role alone. Core asks the same function, and so do the database's own follow trigger and visibility policy. The two cannot disagree about who is who.

| Tier | Who (evidence, in this order) | Profile | Inbound connection | Outbound connection | Who decides |
|---|---|---|---|---|---|
| guardian | A parent-created child (`kid` role, any age). Also an under-13-origin account (A.2 marker) that a verified guardian has linked | Not discoverable. The linked family sees it. An outsider sees it only through a current guardian approval (E.1) | Only through a request that a current verified guardian approves (E.1, unchanged) | Only inside its family, or back to an account its guardian already approved. Anything else is refused (`GUARDIAN_MANAGED_CONNECTIONS`). No independent loosening by the child | The verified guardian |
| teen | A self-registered account whose age screen said 13 to 17, with no verified adult evidence | Private. Another account sees a card with the handle it typed, the cartoon avatar and the cover preset, plus one way to ask. The whole profile is visible only to an account the teen accepted, an account the teen chose to follow, and the teen's verified guardian if one exists | Only through the teen's own recorded consent: request, then the teen accepts or declines. A direct follow is refused (`SUBJECT_CONSENT_REQUIRED`) | The teen follows adults directly. It asks another teen, and a child's guardian, like anyone else | The teen, with no guardian asked (OD-3: none exists in this flow) |
| adult | A screened adult (age screen said adult), or a parent whose latest ID verification is current and 18+ | Public under the Block E rules. The Tutor badge follows E.5 | Open follow, unless blocked | Open follow, except into a child or a teen, which follows their rules | The account holder |
| closed | A guest; an under-13-origin account with no guardian; an account with no age screen yet; an account with no role evidence | Not visible to anyone but itself | None (`SOCIAL_TIER_CLOSED`) | None | Nobody. OD-3 gives guests no social layer. The age screen A.3 requires moves an unscreened account out of this tier |

Rules that hold in every tier:

- An unreadable tier is no access, never an adult (§1.14). Core answers 404 or 502, and the database raises.
- A closed-tier viewer sees no profile but its own.
- A block closes everything between the pair: follows both ways, pending and approved guardian requests, and pending and accepted teen consents.
- Every follow, unfollow, block, unblock, request, decision, removal and revocation writes an audit row in the same transaction (E.2). The teen actions are `social.connection_requested`, `social.connection_accepted`, `social.connection_declined`, `social.connection_revoked` (reasons `unfollow`, `block`, `removed_by_subject`) and `social.follower_removed`. Each carries `tier: 'teen'`.

The teen's consent queue (`social_consent_requests`) is service-only. It has RLS and no browser policy. Core reads it with the service role, and even the service role writes only through `request_teen_connection`, `decide_teen_connection`, `withdraw_social_connection` and `remove_social_follower`. Each takes the same per-pair advisory lock as every other social transition. Abuse limits are set in the database: one account can hold at most 20 pending teen requests, and a declined requester waits 30 days to ask the same teen again. A flagged minor (section 3) can neither request, accept nor follow outside its family until the flag is fixed.

Historical follows are not consent. A follow into a teen that existed before this checkpoint grants no visibility. The teen sees it in "People who follow you" and can remove it. It is not deleted by the migration.

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

1. **Teens cannot make their profile public.** E.8 says "private-by-default". No control to loosen it is offered, because no guardian exists to be told. Owner question: may a 16 or 17 year old opt into a discoverable profile?
2. **A declared teen stays in the teen tier until there is verified adult evidence** (a current ID verification) or a staff-reviewed correction (E.4). The age screen stores a band, not a date, so an 18th birthday cannot be computed. Owner question: should the age screen keep a birth month for this?
3. **Adults may ask a teen to connect.** The teen decides, and the report pattern trigger (E.3) and the 20-request cap apply. Owner question: should adults outside the teen's family be unable to ask at all, as some platforms do?
4. **A teen whose parent links later stays self-managed.** The guardian sees the teen's full profile, but the teen keeps deciding. Owner question: should a guardian link move a teen into the guardian tier?
5. **A child's username flagged before this checkpoint can only be changed by support.** A child's sign-in address derives from the username (A.6). Owner question: build a guardian-initiated handle change?
6. **Counts are removed, not opt-in** (section 2).
