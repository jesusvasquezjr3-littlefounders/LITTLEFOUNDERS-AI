# INSIGHTS.md — First-Party Learning & Usage Telemetry

> Authority level: engine spec (/AGENTS.md §1.1 #6). Owns the contract for
> knowing the end user from FIRST-PARTY data: what is collected, under which
> consent, where it flows, and what may never happen to it. On conflict with
> /AGENTS.md §1.9, §1.9 wins — this document is an implementation of it, not
> an exception to it.
>
> Status: schema (0023) + ingest + parent consent + /admin/insights SHIPPED
> in-branch (2026-07-29). Verified E2E against the local stack: parent and
> kid events recorded, consent gate observed opening and closing.

## 1. Why this exists

Knowing learner behavior — patterns, drop-off, rhythm, family dynamics — is
existential for the product. But the platform's users are CHILDREN, so the
usual answer (drop a behavioral tracker on every page) is prohibited twice
over: by /AGENTS.md §1.9 and by the child-privacy laws of all three target
markets (COPPA, LGPD, LFPDPPP). Pulse's boundary already encodes this: Umami
never loads on kid sessions.

The resolution is structural, not aspirational:

1. **The deepest learning data was already first-party.** Every graded
   attempt, hint, score, streak and completion is recorded server-side by
   the product itself (`lesson_segment_attempts`, `lesson_progress`,
   `learning_stats`). Insight #1 is READING what we already have — the
   calibration report needs no new collection at all.
2. **What was missing** — session rhythm, surface interest, drop-off,
   family conduct — is now collected as a **closed-vocabulary event stream**
   (`learning_events`, 0023), first-party only, consent-gated for kids.
3. **The consent mechanism already existed:** a kid account cannot exist
   without a verified guardian (§1.3). Consent is a per-kid toggle on the
   parent dashboard, backed by an auditable row (`analytics_consents`).

## 2. The four load-bearing rules

1. **Kid events require ACTIVE guardian consent, fail-closed, twice.**
   The kid's browser does not transmit unless `/auth/me` says
   `analyticsEnabled` (kid + active consent), AND Core's ingest re-checks
   the consent row per batch and DROPS silently (202, `accepted: 0`) when it
   is missing, revoked, or unreadable. "Vault didn't answer" means NO.
2. **No free text, by construction.** `learning_events` has no jsonb payload
   and no open string column: `event` and `route_class` are CHECK-constrained
   closed enums, `value` is numeric, and `segment_id` is charset-constrained
   to `^[A-Za-z0-9._-]{1,64}$` at BOTH layers (a length cap alone would still
   be a free-text channel).
   Nothing a child types can enter this stream. Widening the schema is a
   §1.9 review, not a migration detail.
3. **Identity is stamped server-side.** The client says WHAT happened; Core
   stamps WHO (session) and role (`user_roles`) — `kid` wins over every
   other role so the consent gate and segmentation always err toward the
   child.
4. **First-party forever.** This stream feeds Vault and the staff console
   only. It is never sent to Pulse, never to a third-party AI API, never
   embedded in a prompt. Pulse's kid boundary (pulse/AGENTS.md) is
   unchanged by this system.

## 3. Data flow

```
browser (App-level beacon + lesson player)           server-side capture
  configureInsights(enabled ⟵ /auth/me)               family territory route
  trackInsight(closed enum) → batch                      │
        │  POST /api/v1/events (60s / 25 events /        │
        │       pagehide keepalive)                      │
        ▼                                                ▼
Core /api/v1/events ── roles ── kid? ──► analytics_consents (active?) ─ no ─► DROP (202, accepted:0)
        │ yes / adult                                   
        ▼
learning_events (0023, RLS service-role-only)
        ▼
SQL views: insights_segment_calibration · insights_daily_activity · insights_family_engagement
        ▼
Core /api/v1/admin/insights/{calibration,activity,families}  (admin/superadmin)
        ▼
/admin/insights  ·  KPIs / surfaces / calibration table
```

## 4. Event vocabulary (closed — mirror of the 0025 CHECK)

**Every event in the enum is emitted by real code.** A declared-but-unwired
event is how a dashboard silently lies with an empty series, so 0025 deleted
the three that nothing could produce (`video_play`, `game_complete`,
`task_complete` — there is no video, and Games/Tasks are placeholder
surfaces). They return in the same commit as the features that emit them.

| Group | Events | Emitted by |
|---|---|---|
| Session | `session_start` `session_heartbeat` `session_end` `nav_view` | App-level beacon; heartbeat only while the tab is VISIBLE |
| Acquisition | `page_view` `cta_click` `scroll_depth` | Marketing beacon; CTA label from `data-cta`, depth at 25/50/75/100% |
| Signup funnel | `signup_start` `signup_submit` `signup_complete` `login_complete` | Signup/Login pages; `signup_start` fires on first field FOCUS, so "started" means intent, not a pageview |
| Activation | `course_open` `lesson_start` `lesson_complete` `first_lesson_complete` | CoursePage, LessonRoute, LessonPlayer; `first_lesson_complete` is SERVER-side (only Core sees `lessons_completed` before the update). `lesson_complete` fires ONLY on a pass — the results screen is reached on failure too, and counting those inflated the funnel's last step |
| Lesson micro-behaviour | `segment_view` `segment_submit` `segment_retry` `hint_open` `explanation_view` `audio_replay` `results_view` `lesson_abandon` | LessonPlayer / LessonRoute. `value` carries attempt number, hint depth, score, seconds |
| Surfaces | `game_open` `task_view` `tutor_open` `profile_edit` `avatar_edit` | Opening a locked surface IS the demand signal for building it |
| Retention & family | `streak_extend` `territory_view` `consent_grant` `consent_revoke` | SERVER-side — only Core can assert a streak truthfully or witness a consent decision |

Deliberately NOT events: per-exercise ANSWERS (authoritative in
`lesson_segment_attempts`), task lifecycle (in `tasks`). The stream records
what the product does not otherwise see.

Every row also carries `session_id`, `ordinal` (position within the session),
`device`, `locale` and `referrer_class` — which is what makes any of the
above segmentable, and what turns "what happened before they quit" into an
index scan.

## 5. Consent lifecycle

- **Grant / revoke:** parent dashboard toggle → `POST/DELETE
  /api/v1/family/kids/:kidId/analytics-consent`; both re-guarded by a
  verified `guardian_links` row for the CALLER. The table is an append-only
  LEDGER: revocation closes the open row (`revoked_at`), a re-grant INSERTS a
  new one — so "was consent active on date X" stays answerable across cycles.
- **Effect:** immediate. The next `/auth/me` silences the kid's beacon; the
  ingest gate enforces it regardless on every batch.
- **Coverage is surfaced, not hidden:** /admin/insights leads with
  kidsConsented/kidsTotal. Insight breadth is BOUNDED by consent, by design.
- Adults (universal/parent/bigfounder/staff) are covered by the platform
  terms; their events carry their stamped role for segmentation.

## 5b. Hardening the review forced (2026-07-29)

An adversarial review of the first implementation confirmed 17 defects. The
five that changed the CONTRACT, not just the code:

1. **The consent table is an append-only LEDGER, not one row per kid.** The
   first version upserted, so grant→revoke→re-grant rewrote history and left
   already-collected data with no consent evidence for the period it was
   lawfully collected. Now: revoke closes the open row, re-grant INSERTS.
2. **Role resolution for the §1.9 gates uses the SERVICE role.** Reading the
   caller's roles with the caller's own RLS-scoped token meant a lost SELECT
   policy (a regression this repo has actually had) would return `[]`, not an
   error — silently reclassifying every kid as an adult and switching their
   beacon ON. An EMPTY role set is now treated as unconfirmed and goes
   THROUGH the kid gate, not around it.
3. **`segment_id` is charset-constrained, not just length-capped.** A 64-char
   "bounded content id" with no character class was still a free-text channel,
   contradicting rule 2. Enforced at both layers (Zod + CHECK).
4. **Telemetry has its own rate-limit budget** and mounts above the global
   limiter. Sharing the 200-req/15-min per-IP pool meant a NAT'd household or
   classroom could have beacon flushes starve real lesson traffic.
5. **The beacon lives above BOTH route groups.** Mounted in AppLayout it was
   torn down on every lesson entry (the player routes sit outside the layout),
   silently discarding `lesson_start`/`lesson_abandon`/`audio_replay` — the
   drop-off signal the whole system exists to capture — and double-counting
   sessions. Events fired before `/auth/me` answers are now HELD (never
   transmitted) and either promoted or discarded once consent is known, so a
   bookmarked-lesson load keeps its data without weakening fail-closed.

Also: per-event validation (one bad event no longer voids a 25-event batch),
client-side clamping, `session_start` deduped across StrictMode/token-refresh
re-runs, bfcache rebase, `nav_view` per SURFACE rather than per pathname, and
consent coverage counted via `count=exact` instead of transferring every row.

## 5c. The third review (2026-07-29) — what it changed

A third adversarial pass confirmed 23 defects. Its value was not the count but
the KIND: almost every one produced a number that looked right. The seven that
changed the contract:

1. **The retention guarantee was false.** See §6 — the rollup is now an
   accumulating table, and the claim is tested rather than asserted.
2. **Distinct users were being summed** across dimensions in the console, at
   ~6x inflation. Distinct counts are not additive; `insights_daily_users`
   counts them at the grain they are reported at.
3. **`lesson_complete` fired on FAILED lessons.** The results screen is
   reached on both outcomes, so the activation funnel's final step counted
   non-completions. It is now gated on `outcome === 'passed'`, and carries
   `lessonId` — without which `insights_lesson_dropoff.completions` was
   permanently 0 for every lesson.
4. **Google signups were invisible and unattributable.** OAuth returns
   straight to the SPA and never touches `/auth/signup`, so social signups
   emitted no funnel event and never linked their visitor — and the prune then
   deleted those visitors as non-converters, so the campaigns that produced
   them read as permanently zero-yield. Attribution now happens on the
   CONVERSION EVENT in the ingest path, which covers every sign-in route
   including ones added later, and `attributeSignup` is first-conversion-wins
   so a shared family device cannot re-point it.
5. **An anonymous visit and the signed-in session that followed shared one
   `session_id`** — two `session_start` rows under two identities with
   continuing ordinals. A change of who is acting is a new session; the id
   rotates on the identity flip.
6. **The marketing beacon went permanently deaf on a locale switch.** Its
   effect cleanup removed the CTA/scroll/pagehide listeners and the flush
   timer, and a `startedRef` guard then returned before re-registering them.
   Registration must mirror cleanup; duplicate `session_start` is prevented by
   `announceSessionStart` instead.
7. **The cookie banner rendered over the product**, including a kid's lesson,
   where its fixed bottom bar covered the player's action bar. It is
   marketing-surfaces-only, as this document already claimed.

Also: events buffered before `/auth/me` answers are now STAMPED on promotion
(they were arriving with no session, position or device — invisible to every
session-grained view); acquisition context is only marked sent once the
request actually lands; consent events are recorded only when the state truly
changed; Core's event enum mirrors the DB CHECK exactly (a value Core accepted
but Postgres rejected failed the INSERT for the whole 25-event batch); and the
export re-keys sessions per file (§8).

**A known and accepted limit:** the anonymous ingest path trusts a
caller-supplied visitor UUID, so a determined party could fabricate visitor
rows. This is inherent to cookie-based web analytics (a forged GA client id is
the same shape of problem) and is bounded by per-IP rate limiting, a
marketing-only vocabulary, the absence of any PII on that path, and the prune
of non-converting visitors. It is written down rather than quietly tolerated.

## 6. Retention & growth — EXECUTABLE, not documented

- **The rollups are accumulating TABLES, not materialized views.** This is the
  correction the third review forced, and it is the difference between the
  retention guarantee being true and being a sentence in a document. A matview
  is fully recomputed from its source on every refresh, so the night after raw
  events aged out, the next refresh rebuilt the rollup WITHOUT them and
  silently erased those days from history — while this file claimed
  "aggregates survive the prune". They do now: `refresh_insights_rollups()`
  rewrites only a trailing 7-day window, every older row is frozen, and a
  frozen row outlives the events it came from.
  - Verified, not asserted: an event 500 days old was rolled up, pruned from
    `learning_events`, and the rollup row was still there after the nightly
    refresh ran.
  - The trailing window also turns the nightly cost from "scan the whole
    table" into "scan the last week".
- **Distinct users live in their own rollup** (`insights_daily_users`).
  `insights_daily_activity.users` is a count-distinct WITHIN one dimension
  combination and must never be summed: adding those counts tallies one
  learner once per combination they appear in — measured at 6x inflation on a
  trivial dataset, and it grows with every dimension added. `role = ''` is the
  day's true all-roles figure, counted at the grain it is reported at.
- **Day access is sargable.** The old plain view grouped on `created_at::date`
  while Core filtered `day >= X`; a cast on the left of a predicate is not
  sargable, so every admin load sequentially scanned the table. Raw range
  queries now filter `created_at` directly and ride
  `idx_learning_events_created`.
  - There is deliberately NO index on `(created_at::date)`: a timestamptz→date
    cast is not IMMUTABLE (it depends on TimeZone) and Postgres rejects it in
    an index expression. Forcing it with an immutable wrapper would freeze a
    timezone into the index.
  - `insights_time_to_value` gets `idx_learning_events_lifecycle`, a partial
    index on the three lifecycle events, so it stops aggregating every
    `segment_view` row in the table to find three timestamps per user.
  - Rollup dimensions are coalesced to `''` rather than NULL so the primary
    key is total — NULL never equals NULL, so a nullable key column silently
    permits duplicate rows. `''` is falsy in JS, so every `if (!route_class)`
    consumer works unchanged.
- `prune_learning_events(400)` is a **PROCEDURE**, and that is load-bearing: a
  plpgsql FUNCTION always runs inside its caller's transaction, so the
  "bounded batches" loop it used to contain committed nothing and accumulated
  into one enormous transaction — exactly what batching was meant to avoid.
  Only a procedure may COMMIT mid-loop. It carries no `SET search_path` clause
  for the same reason (Postgres forbids transaction control in a routine with
  a SET clause); every reference inside it is schema-qualified instead.
  - It also drops unconverted anonymous visitors with no remaining events.
    Converted visitors are KEPT — attribution history outlives raw behaviour.
  - It reports through `insights_maintenance_log` rather than a return value,
    because a procedure that performs transaction control may not have output
    parameters. A deletion policy that leaves no record of having run cannot
    be shown to have run.
- Both run nightly from `.github/workflows/insights-maintenance.yml` (07:30
  UTC), refresh FIRST so anything ageing out today is rolled up before it is
  deleted, using the same `railway ssh` discipline as vault-backup: one
  command per call with args as distinct tokens, each wrapped in a 5x/20 s
  retry.

## 7. Acquisition layer — first-party cookie (2026-07-29)

The product could not answer "which channel produces signups" at all. It can
now, without a single third-party tracker.

- **`lf_aid`** — a first-party cookie, set by our own JS on
  `.littlefounders.ai` (so the locale subdomains share one visitor), 400-day
  expiry. It is sent to Core in the request BODY, not as a Cookie header:
  Core's CORS deliberately runs credentials-off, and analytics is not a good
  enough reason to weaken that.
- **`lf_cc`** — the consent record. The banner shows once, on marketing
  surfaces, with Accept and Decline at equal weight (no pre-tick, no cookie
  wall — §1.9 "no dark patterns"). **Declining DELETES `lf_aid`**; nothing is
  minted and nothing is sent.
- **Landing snapshot.** UTM parameters and the external referrer exist only
  on the landing URL, so `captureLandingContext()` runs in `main.tsx` before
  React mounts and stores a first-touch snapshot in sessionStorage. Capturing
  it later attributed a campaign visit to whatever page the visitor happened
  to be on when they accepted — i.e. it silently destroyed attribution.
  Storing is consent-independent because nothing is TRANSMITTED without
  consent; the snapshot dies with the tab.
- **`anon_visitors` holds no PII**: no IP, no user-agent string, no raw
  referrer. Only a coarse `referrer_class`, our own UTM labels
  (charset-constrained), a landing route, a viewport-derived device class and
  a locale.
- **Anonymous batches are restricted server-side** to acquisition events on
  marketing surfaces (`ANON_EVENTS` / `ANON_ROUTE_CLASSES` in
  `routes/events.ts`). "Anonymous" on a product surface just means "a kid
  whose consent we have not checked", so that path cannot carry product
  behaviour.
- **Attribution on signup is ADULTS ONLY.** `attributeSignup()` refuses any
  account holding `kid`, leaving the visitor row orphaned. Linking would turn
  a child's pre-consent browsing into a retained behavioural profile — the
  exact thing the consent gate exists to prevent.
- **CTA labels come from `data-cta` attributes WE author**, never
  `innerText`. Scroll depth is recorded at 25/50/75/100%.

## 8. What the console answers (0024)

Four tabs over six SQL views, all aggregated in Postgres:

| Tab | Answers |
|---|---|
| Overview | consent coverage, event volume, peak daily actives, feature adoption per role |
| Acquisition | activation funnel (visited → signup → course → lesson → completion) and weekly cohort retention |
| Learning | lesson drop-off with time-before-quit, exercise calibration, per-learner velocity |
| Sessions | session depth: events, surfaces touched, visible time, by role and device |

`learning_events` now carries `session_id`, `ordinal`, `device`, `locale` and
`referrer_class`, which is what makes any of those segmentable. The event
vocabulary is ~35 entries covering marketing → signup → activation →
engagement → retention — still a CLOSED enum, still no free-text column.

**Export** (`GET /api/v1/admin/insights/export`): CSV or JSON, filtered by
period/role/event/surface/locale/device, staff-only, and written to the
append-only audit log on every pull. It deliberately carries **no `user_id`
and no `anon_id`** — a file leaves the platform's access controls, so it
holds behaviour and dimensions, never an identifier that re-identifies a
learner. Per-user questions stay inside the console, behind auth.

Dropping `user_id` is not sufficient on its own, and this file used to claim
it was. A stable `session_id` is itself a pseudonymous identifier: two files
pulled a month apart could be joined on it to rebuild one child's history
across exports. Each export therefore mints a random salt and emits
`session_ref = sha256(salt + session_id)` — within-file sequence analysis (the
only reason the column exists) is fully preserved, the value is meaningless
outside that one file, and the salt is never stored.

**Truncation is declared, never silent.** A clipped CSV is indistinguishable
from a complete one once it is open in a spreadsheet. Responses carry
`X-LF-Export-Rows`, `X-LF-Export-Truncated` and `X-LF-Export-Next-Offset`;
JSON repeats `truncated` and `nextOffset` in the envelope, and `offset` lets
an analyst walk an arbitrarily large window to completion.

## 9. Derived measures

- **Time to value** (`insights_time_to_value`) — hours from first sight to
  first completed lesson. Rows with a null `activated_at` are the people who
  never got there; they are deliberately NOT filtered out, because that
  population is the measure's whole point. The console reports the MEDIAN,
  not the mean — a few accounts activating weeks later would drag an average
  into meaninglessness.
- **Engagement score** (`insights_engagement`) — one comparable 0-100 per
  learner: breadth (lessons, cap 40), consistency (best streak, cap 30),
  depth (active days in 30d, cap 30). The weights are deliberately simple and
  visible in the migration rather than hidden in application code, so the
  number can be argued with.

`learning_events` is append-only and unbounded. Before any large-scale
rollout: a prune delta (drop rows older than ~400 days — one school year of
cohort comparison plus margin) or partitioning. The views aggregate in
Postgres, so admin reads stay cheap as the table grows; the indexes
(`user_id, created_at` / `event, created_at`) serve both the views and the
eventual prune.

## 10. What this must never become

- A session recorder. Replay/heatmap tooling on kid surfaces stays
  prohibited (pulse/AGENTS.md) — the event stream exists precisely so that
  behavioral insight never requires surveillance-grade capture.
- A free-text channel. See rule 2.
- A model input. Learning about OUR product from this data is the point;
  feeding a child's behavioral stream to a third-party model is a §1.9
  violation regardless of intent.
- Collected-before-consented. The order is constitutional: consent row
  first, kid data second. The pending platform terms / privacy notice
  govern ADULT collection and must ship before public launch.
