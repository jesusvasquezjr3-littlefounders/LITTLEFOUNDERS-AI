# 07 — Analytics and Metrics

This document describes every analytics event tracked, the consent and exclusion rules governing collection, the metrics computed and stored, the DuckDB analytics warehouse (ingestion, analyses, experiments, alerts), the staff reports and dashboards, and the analytics shown to users.

---

## 1. Measurement architecture

| Layer | What it measures | Where data lives | Who sees it |
|---|---|---|---|
| **First-party usage events** | Behavior on every surface: acquisition, signup funnel, learning, family, tutor entry | Operational data store (events, anonymous visitors, consents), with rollups | Staff (Insights, Analytics "Audience", exports) |
| **Learning records** | Graded attempts, lesson progress, placements, streaks, XP, tutor activity, knowledge-component evidence | Operational data store | Learners, guardians, staff |
| **Analytics warehouse (DuckDB)** | Copies of events, attempts, users, sessions, lessons and conversions, refreshed every 5 minutes; derived skill states; experiments; anomalies; alerts | Warehouse service | Staff ("Intelligence"); the AI Tutor (skill states) |
| **Web analytics (Plausible)** | Anonymous, consented page views on public marketing pages | Self-hosted Plausible | Staff (Analytics, reports) |
| **Behavioral analytics (Umami)** | Page views on adult surfaces (anonymous marketing visitors with consent; signed-in parents) | Self-hosted Umami | Staff (Analytics "Behavioral", exports) |
| **Google Analytics 4** | Consented public-page views and marketing goals | Google | Outside the product (no console view) |
| **Service health (Uptime Kuma)** | Service status, latency, 24-hour uptime | Self-hosted Kuma | Staff (System health) |
| **Content-generation telemetry** | Pipeline runs, stage outcomes, judge rubrics, costs, images | Operational data store | Staff (Generation) |
| **Email delivery log** | Relayed emails and statuses | Operational data store | Staff (Emails) |
| **AI Tutor operations** | Per-session cost, daily spend, live sessions, retention sweep | Data store, runtime memory | Staff (tutor queues/status), runtime health |

---

## 2. Collection rules, consent and exclusions

### 2.1 Order of gates for a batch of first-party events

1. **Internal traffic:** if the sender's network is on the staff exclusion registry, the batch is acknowledged and dropped. If the registry is unreachable, the batch is accepted.
2. **Bots:** known crawler user agents are acknowledged and dropped. The user agent is not stored.
3. **Anonymous batches** (no session, a consented visitor id present):
   - Only acquisition events are allowed: page view, CTA click, scroll depth, signup start/submit/complete, login complete, session start/end, navigation view and badge link click.
   - Only on the "marketing" or "other" surfaces.
   - Everything else is discarded.
   - The visitor record is created or updated with its acquisition context: referrer class, campaign source/medium/name, landing route, device class and language.
4. **Authenticated batches:**
   - The sender's roles are read with the platform's own identity (so they cannot be spoofed).
   - A **kid, or anyone with no roles, is recorded only while an active guardian analytics consent exists.** Otherwise the batch is acknowledged and dropped.
   - The event is stamped with the person's role (kid wins over every other role).
5. **Per-event validation:**
   - Events are validated individually, so one bad event does not drop the batch.
   - Client timestamps older than 30 days or more than 5 minutes in the future are discarded.
   - Values are limited to 0–86,400.
   - Segment identifiers use a restricted character set, so **no free text can enter the event stream**.
6. **Idempotency:** each event carries a client-generated unique id, and duplicates from retries are ignored.

### 2.2 Web app transmission rules

- The app's first-party beacon **does not transmit at all** until the server confirms that analytics is enabled for the account. Children require active consent. Accounts with unconfirmed roles are treated as not enabled.
- Anonymous acquisition tracking requires **cookie consent** and applies only on marketing pages without a session.
- Browsers flagged as automated, devices with a local analytics opt-out, and networks marked as excluded load no tracker at all.
- The beacon queues up to 100 events, sends batches of up to 25, and flushes every 60 seconds (30 seconds on marketing pages). On tab hide/close it sends a final batch. While the tab is visible it records a heartbeat every 60 seconds.

### 2.3 Cookies and identifiers

| Identifier | Purpose | Lifetime | Consent |
|---|---|---|---|
| Consent choice cookie | Remembers accept/reject | 400 days | Necessary |
| Anonymous visitor cookie | First-party attribution of acquisition | 400 days | Requires consent. Deleted on rejection. |
| Google Analytics cookies | GA4 | Google's own | Requires consent. Deleted on rejection. |
| Session identifier (browser session) | Groups events into sessions | Per browser session | — |
| Analytics exclusion / device opt-out flags (local) | Keep staff devices unmeasured | Persistent on device | — |

### 2.4 Attribution
- On signup, guest upgrade, or the first signup/login completion event, the anonymous visitor is linked to the resulting **adult** account. The **first conversion wins**, so later logins on a shared device never re-attribute.
- **Child accounts are never linked** to pre-signup browsing.
- The badge-share campaign tag makes shared links attributable.

---

## 3. Event inventory (closed vocabulary of 35 events)

"Emitter" is where the event originates. **C** = web app beacon; **S** = Core API server-side. Surfaces: learn, tasks, profile, tutor, family, admin, marketing, other (banking pages are classified as "other").

| # | Event | Business meaning | Trigger | Emitter | Anonymous allowed | Value carried |
|---|---|---|---|---|---|---|
| 1 | `session_start` | A usage session began | First activity in a browser session (deduplicated) | C | Yes | — |
| 2 | `session_heartbeat` | The user is still active | Every 60 s while the tab is visible | C | No | Seconds (60) |
| 3 | `session_end` | The session ended | Tab hidden/closed (app), or leaving the marketing area | C | Yes | Session duration (s) |
| 4 | `nav_view` | Moved to another product area | Change of surface (learn/tasks/profile/tutor/family/admin/other) | C | Yes | — |
| 5 | `page_view` | A marketing page was viewed | Each marketing page view (consented anonymous visitor) | C | Yes | — |
| 6 | `cta_click` | A call-to-action was pressed | Clicks on tagged marketing buttons | C | Yes | CTA label (as segment) |
| 7 | `scroll_depth` | Marketing page scroll reached a mark | 25 / 50 / 75 / 100% | C | Yes | Percentage mark |
| 8 | `signup_start` | Signup form engaged | Opening or first interaction with Sign up | C | Yes | — |
| 9 | `signup_submit` | Signup submitted | Pressing Create account | C | Yes | — |
| 10 | `signup_complete` | An account was created | Successful signup, or first Google sign-in | C | Yes | — |
| 11 | `login_complete` | Signed in | Successful login or returning Google sign-in | C | Yes | — |
| 12 | `course_open` | A course path was opened | Opening a course page | C | No | — |
| 13 | `lesson_start` | A lesson was entered | Opening the lesson player | C | No | — |
| 14 | `lesson_complete` | A lesson was passed | Every passing, non-replayed completion (**server-authoritative**) | S | No | Score 0–100 |
| 15 | `first_lesson_complete` | The learner's first-ever pass (activation) | The completion that moves lessons completed from 0 to 1 | S | No | — |
| 16 | `lesson_abandon` | Left a lesson unfinished | Leaving the player before completion | C | No | Seconds spent |
| 17 | `segment_view` | An exercise was shown | Each segment displayed while playing | C | No | — |
| 18 | `segment_submit` | An answer was submitted | Pressing Check | C | No | Attempt number |
| 19 | `segment_retry` | Chose to try again | "Try again" | C | No | — |
| 20 | `hint_open` | A hint was revealed | Pressing Hint | C | No | Hint number (1 or 2) |
| 21 | `explanation_view` | An explanation was viewed | Opening an explanation | C | No | — |
| 22 | `audio_replay` | Narration was replayed | "Listen again" | C | No | — |
| 23 | `results_view` | The results screen was reached | Lesson end (pass or fail) | C | No | Seconds spent |
| 24 | `task_view` | (Tasks viewed) | **No emitter exists** | — | No | — |
| 25 | `profile_edit` | Profile settings saved | Saving Settings | C | No | — |
| 26 | `avatar_edit` | The avatar was saved | Saving the avatar editor | C | No | — |
| 27 | `tutor_open` | (AI Tutor opened) | **No emitter exists** | — | No | — |
| 28 | `streak_extend` | The day streak grew | A completion that increased the streak | S | No | New streak length |
| 29 | `territory_view` | A parent viewed a child's map | Loading a child's territory (subject = the parent) | S | No | — |
| 30 | `consent_grant` | A parent turned on a child's analytics | Actual state change only (subject = the parent) | S | No | — |
| 31 | `consent_revoke` | A parent turned off a child's analytics | Actual state change only (subject = the parent) | S | No | — |
| 32 | `parent_report_viewed` | A parent viewed a child report | The child territory page loaded | C | No | — |
| 33 | `badge_generated` | A shareable badge was created | Badge creation (subject = the parent) | S | No | — |
| 34 | `badge_shared` | A badge link was shared or copied | Share sheet completed or link copied | C | No | — |
| 35 | `badge_link_click` | Someone opened a shared badge | The badge landing loaded | C | **Yes** (a stranger) | — |

Each event also carries, where applicable: lesson, course, segment, session, device class, language, referrer class, per-session ordinal, event version, occurrence time and experiment context (id, variant A/B). Events about family actions always name the **parent**, never the child.

**Marketing goals** (sent to Plausible, Umami and GA4 in addition to the first-party events): `guest_start`, `cta_signup_start`, `cta_secondary`.

---

## 4. Stored metrics and analytical views (operational store)

| View / metric | Definition |
|---|---|
| **Daily activity** | Per day × role × event × surface × device × language: events, distinct users, sessions, value total. History comes from a nightly rollup; today is computed live. |
| **Daily users** | Distinct users and sessions per day, overall and per role |
| **Exercise calibration** | Per lesson segment: attempts, distinct learners, average score, average attempts per learner, hint rate, first-try average score, last attempt. Sorted worst-first. Shown when the minimum number of learners is met (default 2). |
| **Cohort retention** | Learners grouped by week first seen; the share active in each following week |
| **Activation funnel** | 1 visited (page view or session start) → 2 signup started → 3 signed up → 4 opened a course → 5 started a lesson → 6 completed a lesson (distinct people per step) |
| **Learning velocity** | Per learner: lessons passed, average score, average attempts, lessons per week, streak, longest streak, XP |
| **Lesson drop-off** | Per lesson: starts, abandons, completions, abandon rate, average seconds before abandoning |
| **Feature adoption** | Per role × surface: events, users, sessions |
| **Session depth** (last 90 days) | Per session: start, role, device, events, surfaces visited, lessons started, visible seconds |
| **Time to value** | Per user: first seen, first completed lesson, hours between them (including those who never got there) |
| **Engagement score** | Per learner, 0–100: min(40, lessons completed × 4) + min(30, longest streak × 3) + min(30, active days in the last 30 days × 2); plus sessions and active days in 30 days |
| **Registrations** | Accounts created per day and role (server-side, independent of consent) |
| **Signup funnel integrity** | Per day: accounts created (server) vs. observed signup start/submit/complete events, and the unobserved difference |
| **Audience** | Per day and role: sessions, users, anonymous visitors, events, surfaces |
| **Anonymous acquisition** | By first-seen day, landing route, referrer, device, language and campaign: visitors, conversions, average days to convert |
| **Family engagement** | Per child: first guardian link date, number of guardians, tasks created, tasks approved, last task |
| **Consent coverage** | Children with active analytics consent vs. total children |
| **Learning retention (forgetting curves)** | First-attempt score on spaced-review lessons, by days since the learner last practiced the reviewed topic (0–1, 2–6, 7–13, 14–29, 30+), and by source topic |
| **North Star export set** | Weekly raw export of `lesson_complete`, `parent_report_viewed`, `badge_generated`, `badge_shared` and `badge_link_click` (see 08) |

**Observation:** the Family engagement view is now defined per child (the columns above). The staff endpoint that serves it still expects an earlier per-family shape (family id, creation date, members, tasks completed). That endpoint therefore answers "Family views unreachable" instead of data.

---

## 5. DuckDB analytics warehouse ("Intelligence")

### 5.1 Ingestion

- **Cadence:** every **5 minutes**, incremental by high-water mark, from service-only views of the operational store.
- **Data copied:**
  - **Events** (all first-party events with experiment context);
  - **Segment attempts** (score, hints, time, skill, diagnostic);
  - **Users** (role, language, XP, minutes, lessons, streaks, **staff flag**);
  - **Sessions** (last 90 days);
  - **Published lessons** (titles in 3 languages, course, segment count);
  - **Anonymous → account conversions** (adult accounts only).
- **Staff exclusion:** admin and superadmin accounts are filtered out before any metric is computed. An account with an unknown staff flag is treated as staff. The share of raw events excluded as staff is reported for transparency.
- **Freshness monitoring:** the sync is flagged **stale after 15 minutes**. Late-arriving events (received more than 5 minutes after occurring) are counted.

### 5.2 Analyses available

| Area | What it computes |
|---|---|
| Metrics summary, trends and comparison | Events, daily active users, users and sessions, at hourly/daily/weekly/monthly granularity; period comparison |
| Engagement leaderboard | Most engaged learners |
| Time to value | First seen → first value |
| Lessons | Drop-off and calibration (as in §4, on warehouse data) |
| Sessions | Depth |
| Funnels | The fixed activation funnel, plus **custom funnels** (2–10 event steps, within 1–365 days) |
| Retention | Weekly cohorts; retention curves for up to 50 chosen cohorts |
| Segments | Saved audience definitions (1–20 filters of the form field equals / not equals / in), with segment metrics and A/B segment comparison |
| Paths | Top navigation paths; flow (Sankey) diagrams over 2–20 steps |
| Anomalies | Daily metric values compared with expected values using **z-scores**: severity **high** at \|z\| ≥ 3, **medium** at ≥ 2, **low** otherwise; direction up/down; resolvable by staff; history kept |
| Churn risk | Per learner: **high risk** if inactive for more than 14 days, **medium** if more than 7 days, **at risk** if active on at most 1 day in the last 7, otherwise **active**. Also contributing factors. |
| Forecast | Linear trend projection with a 95% confidence band |
| Learning | Per-learner skill states, recommendations, content health (skills with low average mastery among 5+ learners, hint rate, time per attempt), learning overview, learner detail |
| Quality | Staff-exclusion share; sync freshness and late-event counts |

### 5.3 Learner skill-state model (feeds the AI Tutor and the learner API)

For every learner × skill (course/topic):
- **Mastery estimate** = (2 + weighted successes) ÷ (4 + evidence count), with an uncertainty value.
- **Review due** = the last practice + 1 day (mastery < 0.55), + 3 days (< 0.80), otherwise + 7 days.
- **Recommended action:**
  - **remediate** (mastery < 0.55);
  - **practice** (< 0.80);
  - **retrieve** (review due now);
  - **continue** (otherwise).
- **Reason:**
  - low evidence (< 3 attempts);
  - low mastery;
  - developing mastery;
  - review due;
  - stable mastery.
- The AI Tutor offers "practise this" only for skills with at least 3 pieces of evidence and an uncertainty of 0.35 or less.

### 5.4 Experiments (A/B)
- **Definition:** name, variants A and B, product surface (learn / tasks / profile / tutor), target, status **draft → running → concluded**.
- **Assignment:** deterministic and **sticky per user**, derived from a hash of the experiment and user. Stored on first assignment.
- **Exposure:** recorded only after a treatment was actually shown. For children, only with active analytics consent.
- **Results:** users, mean and standard deviation per variant, p-value, confidence (1 − p), **significant when p < 0.05**, and a **sample-ratio mismatch** flag when the variant split deviates by more than 10%.
- **Current use:** the web app contains no experiment exposure calls, so experiments can be defined and assigned but are not wired into any product surface.

### 5.5 Alerts
- **Definition:** name, metric, condition (above / below / change %), threshold, channel (webhook / email), cooldown (1–1,440 minutes), status active/paused.
- **Evaluation:** every **5 minutes**. A triggered alert writes its history (value, threshold, condition) and its last-triggered time, subject to the cooldown.
- **Observation:** no webhook call or email is sent. The channel is stored only.

### 5.6 Exports
- **Synchronous event export:** 1–10,000 rows with filters (event, role, surface, device, language, lesson, segment).
- **Asynchronous export jobs** (CSV / JSON / Parquet) can be created and listed. **No processor advances them**, so they remain "pending".
- **Staff "Intelligence export"** (through the Core API): CSV/XLSX with the activation funnel, engagement, lesson drop-off and exercise calibration. The file includes the notes "Staff activity is excluded from every figure in this file" and the staff share for the window.

### 5.7 Performance
Responses are cached for 5 minutes (with entity tags). The warehouse is scale-to-zero, so the first request after idle is slower.

---

## 6. Reports and dashboards (staff)

| Dashboard | Contents | Export |
|---|---|---|
| **Overview** | Users by role, staff, courses/lessons by status, review queue, audit total, service health, forgetting curves | — |
| **Analytics — Web** (Plausible) | Visitors, pageviews, bounce rate, visit duration, daily trend, previous-period comparison, breakdowns (page, source, referrer, channel, country, region with a world map, device, browser, OS, entry/exit page, UTM), filters, custom ranges, imported-history markers | PDF (report language selectable) / CSV / XLSX, per audience: **Marketing** (source, channel, UTM campaign, UTM source, country, referrer), **Sales** (source, channel, entry page, country, device), **Frontend** (page, entry/exit page, device, browser, OS), **Full**. Each report includes a **first-party block** (sessions, share not from staff, accounts created, signups observed and unobserved, anonymous visitors, conversions, conversion rate). "Could not be read" is shown instead of zeros when unavailable. |
| **Analytics — Behavioral** (Umami, adult surfaces) | Pageviews, visitors, visits, bounces, time; 13 dimensions (path, referrer, title, query, browser, OS, device, screen, language, country, region, city, event); daily series; a count of staff-console pageviews recorded before the tracker boundary was fixed | CSV / XLSX (all dimensions) |
| **Analytics — Internal traffic & coverage** | Active exclusions, detected staff addresses, and a note stating from which date staff traffic is excluded | — |
| **Analytics — Audience** | Daily sessions split into anonymous / registered / staff (staff shown, not hidden), and the external share | — |
| **System health** | Monitors: up/down, latency, 24-hour uptime | — |
| **Insights** | Overview KPIs, surfaces, calibration, acquisition, cohorts, funnel, velocity, drop-off, adoption, sessions, engagement, families/consent | Raw events CSV/JSON (paged, pseudonymous sessions, audited) |
| **Intelligence** | Home, Trends, Funnels, Learning, Retention, Segments, People, Experiments, Alerts, Settings | CSV / XLSX |
| **Generation** | Live monitor, run history, analytics, coach, run comparison | — |
| **Emails** | Totals, success/failure rate, pending, active templates, top locale, trend, logs | — |
| **Users** | Distribution by role, language and age; signup timeline (daily/cumulative, average, peak, change) | — |

**Export privacy rules:** raw exports never contain user or visitor identifiers. Session ids are replaced by a salted pseudonym that is stable only within one export (across its pages). Every raw export is recorded in the audit log.

---

## 7. Content-generation metrics

For each run and lesson ("slot"):
- tokens used (total and cached) and USD cost;
- images generated / billed / reused;
- duration, the stage reached, and the stage a failure came from;
- salvaged and early-stopped flags, dropped segments, review cycles;
- **judge rubric** scores on 9 dimensions (child safety is a hard floor).

Across runs:
- cost, quality and failure trends per course;
- a per-stage failure heatmap;
- cache efficiency;
- coach diagnostics with evidence;
- run-to-run comparisons.

Live runs report active/completed/failed/skipped slot counts and a stage breakdown every heartbeat, with a stored time series.

---

## 8. AI Tutor metrics

| Metric | Where |
|---|---|
| Sessions per learner per day (cap 2) | Enforced at start |
| Session duration, turn count, activity count, XP awarded, **cost in USD**, end reason | Per session |
| Tutor XP per day (cap 120) | Enforced at grading |
| Daily model/voice spend per runtime instance vs. ceiling (USD 20) and alert threshold (50%) | Runtime health |
| Live sessions | Runtime health and status |
| Knowledge-component evidence: correct, probability known before/after, strategy, misconception | Per attempt |
| Controller trajectory (strategy changes, scaffolding, difficulty, mode) | Per turn |
| Safety flags by category and severity | Per session; guardian view |
| Live-activity review sample rate (default 15%) and staff verdicts | Review queue |
| Retention sweep: sessions deleted, audio deleted/failed/retained; hours since the last run; stale after 36 h | Sweep status |

---

## 9. User-facing analytics and reporting

| Audience | What they see |
|---|---|
| **Learner** | XP points, minutes learned, lessons completed, day streak and best streak (profile, results screen, streak celebration), course progress bars (passed/total, including placement skips), topic states on the territory map (completed / review due / in progress / not started), "n reviews due", per-lesson best score, results-screen strengths ("Today's superpower") and areas to improve ("Your next quest") by exercise family, course badges, the AI Tutor learning map (mastered / in progress / needs review / available / locked), a tutor session recap (minutes, XP) |
| **Child (Family Hub)** | Wallet balances by Save/Spend/Share, recent activity, goal progress, chore streak, spending-limit usage, monthly statements (earned/spent/saved) |
| **Parent** | Per child: wallet total, chore streak, pending approvals, territory map, XP, lessons completed, day streak, best streak, last active date; tutor session narratives ("Practiced X… answered c of t correctly"), safety flags, statements, spending status, coins awarded, items to approve/decide |
| **Public profile viewers** | Another user's XP, minutes, lessons, streak and course badges |
| **Staff** | Everything in §6 |

---

## 10. Retention of analytics data

| Data | Retention |
|---|---|
| Raw usage events | 400 days (pruned daily) |
| Daily rollups | Indefinite |
| Unconverted anonymous visitors with no events | Pruned after 400 days of inactivity |
| Warehouse sessions dimension | Rolling 90 days |
| Session-depth view | Rolling 90 days |
| Pulse (Plausible/Umami) databases | Backed up daily, 30-day backup retention |
| AI Tutor sessions and transcripts | 90 days |
| North Star weekly export files | 14 days (automation artifact) |

---

## 11. Observations specific to analytics (current state)

1. `task_view` and `tutor_open` are part of the event vocabulary, but nothing emits them.
2. The staff "families" insight endpoint cannot read its view, because the view's shape changed (§4).
3. Warehouse alerts never notify anyone. Asynchronous warehouse export jobs never complete (§5.5, §5.6).
4. The learner personalization endpoint and the experiment-exposure endpoint exist, but the web app does not call them. Experiments therefore have no live surface.
5. Banking pages are reported under the "other" surface, because no banking surface class exists.
6. Because analytics consent is tied to the kid role, guests and self-registered teens are measured like adults (see 05 §6).
