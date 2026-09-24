# 04 — API Surface

This document lists every HTTP endpoint and real-time channel of the platform, grouped by service and functional domain. For each endpoint it gives the business purpose, the inputs, the outputs, the access classification and notable errors. Addresses are shown as they are called. Core API addresses are relative to the `/api/v1` prefix.

---

## 1. Conventions

### 1.1 Response envelope
Every JSON response uses one envelope: `{ data, error }`.
- **Success:** `data` holds the payload and `error` is empty.
- **Failure:** `data` is empty and `error` holds `{ code, message }`. Occasionally extra typed fields are added; the only current case is the tutor's daily-limit refusal, which carries the exact reset time.
- **Exceptions (file downloads):** report exports (PDF/CSV/XLSX), the first-party CSV export, and media file downloads return raw bytes on success. Their errors still use the envelope.

### 1.2 Access classes

| Class | Meaning |
|---|---|
| **Public** | No sign-in. Protected by rate limits. |
| **Authenticated** | Requires a valid session token (the "Bearer" authorization header). The token is verified by signature, expiry, audience and issuer. Guests are authenticated. |
| **Role: parent / kid / parent-or-kid** | Authenticated, and the role is re-read from the data store on every request. |
| **Guardian-scoped** | Additionally requires a **verified guardian link** between the caller and the child named in the request. It is re-checked on every request. Another family's child is answered as not found (404) or forbidden (403), depending on the endpoint. |
| **Staff** | Admin or Superadmin. |
| **Superadmin** | Superadmin only. |
| **Internal** | Service-to-service only. Requires the shared internal key header, compared in constant time. Never exposed to browsers. |
| **Socket token** | A single-use, 60-second, session-bound token signed by Core, used only for the AI Tutor websocket. |

### 1.3 Cross-origin policy
The Core API answers browsers only from the official web-app origin. Requests from any other origin are refused with "forbidden". Media downloads of public files are readable from any origin.

### 1.4 Rate limits (Core API, per network address)

| Budget | Limit | Applies to |
|---|---|---|
| Global | 200 requests / 15 min | Every Core endpoint except health and event ingestion |
| Credential operations | 10 / 15 min | Login, session refresh, password recovery, password reset, password change, email change, guest upgrade |
| Account creation | 30 / 15 min | Signup, guest session |
| Event ingestion | 300 batches / 15 min | Event beacon (its own pool) |
| Evidence photos | 20 / 15 min | Chore photo upload |
| Parent verification | 5 attempts / hour **per user** | ID verification |
| AI Tutor sessions | 2 sessions / local day **per learner** (staff exempt) | Tutor session start |
| AI Tutor XP | 120 XP / local day per learner | Tutor activity grading |
| Tutor websocket handshakes | 100 / minute per network | AI Tutor Runtime |
| Tutor concurrent sessions | 200 per runtime instance | AI Tutor Runtime |
| Tutor daily spend | USD 20 per runtime instance per rolling 24 h (alert at 50%) | New session admission |

Limits use a shared store in production. If that store is unreachable, requests are allowed rather than failed. Exceeding a limit returns HTTP 429 with the code `RATE_LIMITED`.

### 1.5 Pagination and filtering patterns
- **Offset pagination:** `limit`/`offset` on the audit log, email logs, guardian tutor sessions and staff event export. Bounds are validated (for example, limit 1–200).
- **Export paging:** the staff event export returns response headers with rows exported, a truncation flag, the next offset and a **continuation token**. The token keeps session pseudonyms stable across pages.
- **Time windows:** analytics endpoints accept a period preset (today, 7 days, 30 days, this month, 6 months, 12 months, this year, all time) or a custom `from`/`to` range. Insights endpoints take `days`. Warehouse endpoints take `days` (1–3,650) or `from`/`to`.
- **Warehouse caching:** responses are cached for 5 minutes, with entity tags. Web and behavioral analytics readers are cached for 60 seconds.

### 1.6 Error codes and their business meaning

| Code | HTTP | Meaning |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Input failed validation. The message names the first problem. |
| `UNAUTHORIZED` | 401 | No or invalid session, or an invalid internal key. |
| `FORBIDDEN` | 403 | Signed in but not allowed (wrong role, not the guardian, not the owner, wrong origin, or a non-recovery session trying to reset a password). |
| `NOT_FOUND` | 404 | Unknown resource, or a resource deliberately hidden (another family's child, a blocked profile). |
| `CONFLICT` | 409 | State conflict (already open, already decided, not ready). |
| `PAYLOAD_TOO_LARGE` | 413 | Body or file too large. |
| `RATE_LIMITED` | 429 | Too many requests. |
| `INTERNAL` | 500/502 | An unexpected or upstream failure. |
| `DATA_UNAVAILABLE` | 502 | The data store or a dependency could not answer. Never reported as an empty result. |
| `UPSTREAM_FAILED` / `UPSTREAM_TIMEOUT` | 502 / 504 | An analytics provider or the warehouse failed or timed out. |
| `PULSE_UNCONFIGURED` | 503 | The observability stack is not configured on this deployment. |
| `INVALID_CREDENTIALS` | 401 | Wrong email/username and password, or a wrong current password. |
| `EMAIL_NOT_CONFIRMED` | 401 | The account's email is not confirmed yet. |
| `EMAIL_IN_USE` | 4xx | The email is already registered. |
| `AGE_RESTRICTED` | 403 | The signup date of birth is under 13. |
| `NOT_A_GUEST` | 409 | Upgrade attempted on a permanent account. |
| `ALREADY_VERIFIED` | 409 | Already a verified parent. |
| `DOCUMENT_UNREADABLE` | 422 | The ID photo could not be processed. |
| `ONBOARDING_ALREADY_COMPLETE` | 409 | Onboarding submitted twice. |
| `USERNAME_TAKEN` / `USERNAME_IN_USE` | 409 | The username is taken (profile / new child). |
| `KID_LIMIT_REACHED` | 409 | The parent already has 10 children. |
| `LESSON_LOCKED` | 403 | The lesson is not unlocked for this learner. |
| `PLACEMENT_REQUIRED` | 403 | The course placement quiz must be taken first. |
| `PLACEMENT_ALREADY_COMPLETE` | 409 | The placement was already committed. |
| `UNSUPPORTED_SEGMENT` | 422 | The exercise cannot be graded. |
| `ATTEMPTS_EXHAUSTED` | 409 | No attempts remain for this exercise in this run. |
| `SPEND_LIMIT_REACHED` | 409 | The redemption would exceed the child's spending limit. |
| `SESSION_LIMIT` | 429 | The tutor daily session cap was reached (includes a reset time). |
| `SESSION_CLOSED` | 409 | The tutor session has already ended. |
| `POLICY_BLOCKED` | 409/503 | The platform policy blocks microphone use for minors. |
| `ORACLE_UNAVAILABLE`, `MODEL_UNAVAILABLE`, `MODERATION_UNAVAILABLE` | 503 | The tutor cannot start safely. |
| `ALREADY_DECIDED`, `NOTE_OUT_OF_DATE` | 409 | Memory-note decision conflicts. |
| `ROLE_REJECTED` | 409 | The data store refused a role or permission change. |
| `RELEASE_NOT_FOUND`, `RELEASE_ARCHIVED`, `RELEASE_INCOMPLETE_HIERARCHY`, `RELEASE_LESSONS_NOT_REVIEWABLE`, `RELEASE_INCOMPLETE_LOCALES`, `RELEASE_VERIFICATION_REQUIRED`, `RELEASE_BLOCKED` | 404/409 | Course release refusals (see 02 J1). |
| `AUDIO_GENERATION_FAILED` | 502 | Narration failed (internal). |

---

## 2. Core API — Platform

| Method & address | Purpose | Inputs | Outputs | Access |
|---|---|---|---|---|
| GET `/health` (no prefix) | Liveness probe | — | service, version, status "ok" | Public, not rate limited |

---

## 3. Core API — Identity & Access (`/auth`)

| Method & address | Purpose | Inputs | Outputs | Access / notes |
|---|---|---|---|---|
| POST `/auth/signup` | Create an adult account | email; password 8–128; display name 1–80; language (default en-US); parent intent (yes/no); **date of birth (required; screened and discarded)**; optional anonymous visitor id | a session, or a flag saying email confirmation is required | Public; account-creation limit. Under 13 → `AGE_RESTRICTED`. Attributes the signup to the visitor's acquisition source. |
| POST `/auth/guest` | Start a guest session | — | session | Public; account-creation limit |
| POST `/auth/upgrade` | Attach email and password to the current guest identity (keeps all data) | email, password, refresh token, optional visitor id | refreshed session (no longer a guest) | Authenticated guest; credential limit. `NOT_A_GUEST` for permanent accounts. |
| POST `/auth/login` | Sign in with email **or child username** | identifier (or email), password | session | Public; credential limit |
| POST `/auth/refresh` | Renew a session | refresh token | session | Public; credential limit. Invalid → 401 "Session expired". |
| POST `/auth/logout` | End a session (best effort) | — | signed out | Authenticated |
| POST `/auth/recover` | Send a password-recovery email | email | `sent: true` (always, whether or not the account exists) | Public; credential limit |
| POST `/auth/reset-password` | Set a new password from a recovery link | password 8–128 | `updated: true` | Authenticated with a session **established by a recovery link** only; credential limit |
| POST `/auth/change-password` | Change password in session | current password, new password 8–128 | `updated: true` | Authenticated; credential limit; the current password is re-verified |
| POST `/auth/change-email` | Request an email change | new email, current password | `pending: true` | Authenticated; credential limit; confirmed by a link sent to the new address |
| GET `/auth/oauth/providers` | Which social providers are enabled | — | provider list (only "google" is supported) | Public |
| GET `/auth/oauth/{provider}` | Start social sign-in | provider = google | the provider authorization address | Public |
| GET `/auth/me` | The signed-in user's context | — | user id and email, profile, **role names**, avatar options, **analytics enabled** (children: only with active guardian consent; no roles → no), **new account** (created < 2 min ago), guest flag, onboarding complete | Authenticated |

## 4. Core API — Guardian verification (`/verification`)

| Method & address | Purpose | Inputs | Outputs | Access / notes |
|---|---|---|---|---|
| POST `/verification/parent` | Verify identity and grant the parent role | multipart: given names 1–120, surnames 1–120, date of birth (18+), document type (national-id / passport / driver-license), document image (JPEG/PNG/WebP ≤ 8 MB) | `verified: true, role: parent`, or `verified: false` with the four check results | Authenticated; 5 attempts/hour/user; `ALREADY_VERIFIED`; `DOCUMENT_UNREADABLE`. Never passes when the verification service is down. |

## 5. Core API — Onboarding (`/onboarding`)

| Method & address | Purpose | Inputs | Outputs | Access |
|---|---|---|---|---|
| POST `/onboarding/complete` | Finish guest onboarding | display name 1–80; discovery channel (friend, social_media, search, app_store, school, ad, other; optional); date of birth (optional, past, ≥ 1900); account choice (created_now / later); local date | resulting streak days | Authenticated; `ONBOARDING_ALREADY_COMPLETE` |

## 6. Core API — Learning (`/learn`)

| Method & address | Purpose | Inputs | Outputs | Access / notes |
|---|---|---|---|---|
| GET `/learn/courses` | Course shelf | — | per published course: id, slug, title, subject, badge art, lesson count, adventure count, in-progress notice, progress (passed/total/%) | Authenticated. One broken course is skipped. All failing → 502. |
| GET `/learn/courses/{slug}/tree` | Full course map for this learner | slug | the course (placement required?, progress), adventures (state, progress) → sagas → topics (kind, review-of, prerequisites, placement probe, state) → lessons (state, best score, placement-credited), next lesson id | Authenticated |
| GET `/learn/lessons/{id}` | Load a lesson to play | lesson id | lesson metadata (difficulty, total XP, minutes, cast, scoring), language served, learner-safe document (no answers), audio manifest | Authenticated; `LESSON_LOCKED`, `PLACEMENT_REQUIRED` |
| POST `/learn/lessons/{id}/grade` | Grade one exercise answer | segment id; answer; attempt number; run id (optional); hints used 0–10; time spent 0–7,200 s | verdict (score, correct, feedback, retry allowed, reveal when final) | Authenticated; `ATTEMPTS_EXHAUSTED`, `UNSUPPORTED_SEGMENT`. The same run and attempt number replays the original verdict. |
| POST `/learn/lessons/{id}/complete` | Complete a play-through | seconds spent 0–7,200 (or legacy minutes 0–120); local date; run id | score, passed, best score, XP earned, XP delta, streak days, longest streak, streak extended, first today, minutes learned, lessons completed, course progress, next lesson id | Authenticated. The score is recomputed from recorded attempts. The same run is replayed without double counting. |
| GET `/learn/personalization` | The caller's derived skill states and top recommendation | — | recommendation, list of skill states | Authenticated. No caller in the web app. |
| POST `/learn/experiments/exposure` | Record that an experiment variant was shown | experiment id; surface (learn / tasks / profile / tutor); target | recorded flag and assignment | Authenticated. For children without analytics consent → 202 "not recorded". No caller in the web app. |

## 7. Core API — Placement (`/placement`)

| Method & address | Purpose | Inputs | Outputs | Access / notes |
|---|---|---|---|---|
| GET `/placement/{courseSlug}/intake` | Is the conversational intake available? | — | age already known; intake available (stored age ≥ 12) | Authenticated |
| POST `/placement/{courseSlug}/intake` | AI read of the learner's free text | learner text 1–4,000; localized neutral reflection ≤ 400 | available; prior fraction 0–1; reflection text | Authenticated. Unavailable/ineligible → `available: false`. A flagged text stores a guardian-visible flag, with the same neutral answer. |
| POST `/placement/{courseSlug}/step` | Next question, or the result so far (stateless) | signals (claimed level, education level, date of birth, prior fraction) and answers so far (topic, selected option; max 10) | either a question (probe, question number, questions remaining, phase search/confirm) or a result | Authenticated. Writes nothing. |
| POST `/placement/{courseSlug}/commit` | Save the placement | signals, answers, chosen frontier (can only move earlier), start from beginning | frontier, starting topic, starting lesson, credited lessons/topics, total topics, method, capped by prerequisite | Authenticated; `PLACEMENT_ALREADY_COMPLETE`; see the method-value observation in 03 §3.6 |

## 8. Core API — AI Tutor (user-facing, `/tutor`)

| Method & address | Purpose | Inputs | Outputs | Access / notes |
|---|---|---|---|---|
| GET `/tutor/preferences` | Tutor personalization and catalog | — | character, companion, island, lighting, nickname, adaptations, personalized flag, catalog (4 characters, 2 islands, 5 lightings, 5 adaptations, which characters lip-sync) | Authenticated |
| PUT `/tutor/preferences` | Save personalization | any of: character, companion (≠ character, or none), island, lighting, nickname (1–24, letters/digits/space/'/_/-, not containing the real name), adaptations | saved preferences | Authenticated |
| GET `/tutor/map` | Knowledge-graph learning map | — | nodes (with states), edges, continue target, review count | Authenticated. Empty when the pedagogy brain is off or unseeded. |
| GET `/tutor/offers` | Offer screen | — | language; last session ("continue"); intelligence degraded flag; **can start**; blocked-by reason (runtime reason or `SESSION_LIMIT`); limit reset time; voice available; microphone blocked-by (POLICY_BLOCKED / CONSENT_REQUIRED / VOICE_UNAVAILABLE); up to 3 weak skills; 4 FAQ ids; open chat allowed | Authenticated |
| POST `/tutor/sessions` | Start a session | intent (course_topic / weak_skill / faq / open / diagnostic); course id; topic id; skill key (FAQ id for faq; a real knowledge component for weak_skill; forbidden for others); wants voice | session id, **socket address with a single-use token**, token expiry (60 s), character, companion, island, lighting, language, voice available, microphone available, microphone blocked-by | Authenticated; `SESSION_LIMIT` (with the reset time); 503 when the runtime is unavailable |
| GET `/tutor/sessions` | My sessions | — | session summaries | Authenticated (owner) |
| POST `/tutor/sessions/{id}/resume` | New socket token for a dropped session | — | session id, socket address, expiry | Owner only; `SESSION_CLOSED` |
| GET `/tutor/sessions/{id}` | Full transcript | — | session summary, turns, activities (answers removed), scores, XP, times | Owner **or verified guardian** |
| POST `/tutor/segments/{segmentId}/grade` | Grade a tutor activity | answer; attempt 1–3; hints 0–2 | verdict, XP awarded, whether it scores XP, daily XP cap, pedagogy result (component, correct, probability known after, misconception, next review, signed receipt) | Owner |
| POST `/tutor/consent` | Grant microphone consent for a child | child id; the exact consent text (40–4,000); language | granted, granted at | **Verified guardian** of the child; `POLICY_BLOCKED` while minors' voice is disabled |
| GET `/tutor/consent/{kidUserId}` | Microphone consent state | — | active, granted at, language, policy (allowed/blocked) | The child themself or a verified guardian |
| DELETE `/tutor/consent/{kidUserId}` | Revoke microphone consent | — | revoked | The child themself or a verified guardian |
| GET `/tutor/kids/{kidUserId}/sessions` | Guardian view of a child's sessions | limit 1–100 (default 30), offset | sessions with narratives, has more, safety flags, placement safety flags | Verified guardian |
| GET `/tutor/kids/{kidUserId}/memory-proposals` | Pending memory notes | — | proposals (proposed text, what it replaces, session, time), current note | Verified guardian |
| POST `/tutor/memory-proposals/{proposalId}/decision` | Approve or reject a note | verdict approved/rejected | outcome, applied | Verified guardian; `ALREADY_DECIDED`, `NOTE_OUT_OF_DATE` |
| GET `/tutor/plan` | My tutor plan | — | content, session, updated at | Authenticated |
| GET `/tutor/kids/{kidUserId}/plan` | A child's plan | — | same | Verified guardian |
| GET `/tutor/notebook` | My kept boards | — | entries | Authenticated |
| GET `/tutor/kids/{kidUserId}/notebook` | A child's kept boards | — | entries | Verified guardian |
| POST `/tutor/notebook` | Keep a whiteboard | session id, turn number | kept | Owner of the session; the turn must have drawn a board |

## 9. Core API — AI Tutor (runtime-only, `/tutor/internal`)

Called only by the AI Tutor Runtime (Internal).

| Method & address | Purpose | Inputs | Outputs |
|---|---|---|---|
| GET `/tutor/internal/sessions/{id}` | Everything the runtime may know about a session | — | session id, user id, **age tier** (never the date of birth), language, nickname (or a neutral word), character, companion, island, intent, adaptations, course context (published only), skill, up to 3 previous-session summaries, learner brief (notes) and a degraded flag, up to 12 skill states, is-minor, consent state, pedagogy plan. `SESSION_CLOSED` when ended. |
| POST `/tutor/internal/turns` | Record a turn | session, sequence, speaker, text ≤ 4,000, emotion, gesture, audio location, source, moderation, whiteboard (validated against ~45 instrument shapes), demonstration steps, roleplay scene, pointer, save-plan flag | recorded |
| PUT `/tutor/internal/learner-memory` | Write post-session memory notes | user, session, proposed notes (learner ≤ 1,400; pedagogy ≤ 2,200), expected previous notes | written stores; stores **pending** guardian approval (children) |
| GET `/tutor/internal/recall` | Verbatim excerpts from the learner's own history | user, query 2–200, language | up to 3 excerpts (flagged turns excluded) |
| POST `/tutor/internal/flags` | Record a safety flag | session, turn, category, severity low/medium/high, handling | recorded |
| POST `/tutor/internal/trajectory` | Record controller decisions | user, session, 1–200 steps | recorded count |
| POST `/tutor/internal/sessions/{id}/close` | Close a session | end reason, turn count, activity count, cost | closed / already closed |
| POST `/tutor/internal/sessions/{id}/cost` | Add post-session review cost | cost > 0, reason | recorded, total cost |
| GET `/tutor/internal/consent/{userId}` | Live microphone-consent check | — | active |
| GET `/tutor/internal/retention/status` | Health of the 90-day sweep | — | last run, hours since, stale (> 36 h) |
| POST `/tutor/internal/retention/purge` | Run one retention batch | limit 1–2,000 (default 500) | sessions deleted, audio deleted, audio failed, audio retained, orphaned paths |
| POST `/tutor/internal/segments` | Get an activity from the content ladder | session, skill, difficulty 1–5, framing ≤ 240, rationale ≤ 400, knowledge component, strategy, up to 3 preferred money/number-line types | an activity (origin catalog/bank), or a signal that live generation is needed |
| POST `/tutor/internal/segments/verify` | Verify a live-generated activity | session, activity, provenance, component, strategy | accepted (stored and served) or `accepted: false` with failures |
| POST `/tutor/internal/segments/{segmentId}/voice-check` | Check a spoken answer | session, utterance 1–500, strategy | checkable, recognized, correct, pedagogy receipt |

## 10. Core API — Family (`/family`) — Role: parent

| Method & address | Purpose | Inputs | Outputs | Notes |
|---|---|---|---|---|
| GET `/family/kids` | The parent's children with a summary | — | per child: id, name, username, analytics consent, pending approvals, wallet total, chore streak | — |
| POST `/family/kids` | Create a child account | display name 1–80; username 3–20; passphrase 8–72; date of birth (optional); language | the child (id, name, username) | `KID_LIMIT_REACHED` (10), `USERNAME_IN_USE`; rollback on partial failure |
| PATCH `/family/kids/{kidId}` | Rename / set date of birth | display name, date of birth | the child | Guardian-scoped (404 otherwise). The username cannot be changed. |
| POST `/family/kids/{kidId}/passphrase` | Reset the passphrase | passphrase 8–72 | rotated | Guardian-scoped |
| DELETE `/family/kids/{kidId}` | Permanently delete the child and all data | — | deleted | Guardian-scoped |
| POST `/family/kids/{kidId}/analytics-consent` | Grant analytics consent | — | consent on | Guardian-scoped (403 otherwise) |
| DELETE `/family/kids/{kidId}/analytics-consent` | Revoke analytics consent | — | consent off | Guardian-scoped |
| GET `/family/kids/{kidId}/courses/{slug}/territory` | The child's course map and stats | — | course tree (child's progress), XP, lessons, streak, longest streak, last active | Guardian-scoped |
| POST `/family/kids/{kidId}/badge` | Create a shareable achievement badge | kind (course_badge + course slug / streak / goal_reached + goal id); language | token, image address, share address (with a campaign tag) | Guardian-scoped; 403 when not earned (streak < 3 days, goal not reached, course incomplete) |

## 11. Core API — Tasks, Wallet, Goals, Rewards (`/tasks`)

| Method & address | Purpose | Inputs | Outputs | Access |
|---|---|---|---|---|
| POST `/tasks` | Create a chore | child id, title 1–120, reward 1–500, recurrence once/weekly, due date, requires photo | task | Parent (for own verified child) |
| GET `/tasks` | List chores | optional child id | tasks | Parent |
| POST `/tasks/{id}/approve` | Approve a done chore | — | task | Parent guardian; 409 if not awaiting approval or the required photo is missing |
| POST `/tasks/{id}/cancel` | Cancel a chore | reason ≤ 240 (optional) | task | Parent guardian; open/done only |
| GET `/tasks/{kidId}/wallet` | A child's balances | — | Save/Spend/Share | Parent guardian |
| GET `/tasks/{kidId}/goals` | A child's goals | — | goals with saved amounts | Parent guardian |
| POST `/tasks/catalog` | Add a reward | title 1–120, cost 1–500 | item | Parent |
| GET `/tasks/catalog` | My reward catalog | — | items | Parent |
| PATCH `/tasks/catalog/{id}` | Turn a reward on/off | active | item | Parent (owner) |
| GET `/tasks/redemptions` | Redemption requests | optional child id | requests | Parent |
| POST `/tasks/redemptions/{id}/decide` | Approve or deny | approve yes/no | decided | Parent guardian; 409 if already decided or the Spend balance is insufficient |
| GET `/tasks/mine` | My chores | — | tasks | Kid |
| POST `/tasks/{id}/complete` | Mark a chore done | local date | task | Kid (assignee); open only; updates the chore streak |
| GET `/tasks/streak` | My chore streak | — | current, longest | Kid |
| POST `/tasks/{id}/evidence` | Attach or replace a proof photo | photo (JPEG/PNG/WebP ≤ 8 MB, content-verified) | task | Kid (assignee); 20 uploads/15 min; open/done only |
| GET `/tasks/{id}/evidence` | View the proof photo | — | image bytes (private cache, 1 h) | The assignee child or their verified guardian |
| POST `/tasks/{id}/allocate` | Sort an approved reward | save, spend, share (≥ 0, sum = reward), optional goal id | allocated | Kid; 409 if not ready or the split is invalid |
| GET `/tasks/wallet` | My balances | — | Save/Spend/Share | Kid |
| GET `/tasks/wallet/ledger` | My last 100 movements | — | entries (bucket, amount, reason, related task/goal/redemption, time) | Kid |
| POST `/tasks/goals` | Create a goal | title 1–80, target 1–100,000, icon | goal | Kid |
| GET `/tasks/goals` | My goals | — | goals with saved amounts | Kid |
| PATCH `/tasks/goals/{id}` | Archive a goal | — | goal | Kid (owner) |
| GET `/tasks/catalog/available` | Rewards I can redeem | — | active items from my guardians | Kid |
| POST `/tasks/redemptions` | Request a reward | catalog id | request | Kid; `SPEND_LIMIT_REACHED` |
| GET `/tasks/redemptions/mine` | My requests | — | requests | Kid |

## 12. Core API — Digital Banking (`/banking`)

| Method & address | Purpose | Inputs | Outputs | Access |
|---|---|---|---|---|
| POST `/banking/accounts/{kidId}` | Open a child's account | nickname 1–40, card design | account | Parent guardian; 409 if already open |
| GET `/banking/accounts/{kidId}` | Read the account (also processes due allowance/bonus) | — | account or none | Parent guardian |
| PATCH `/banking/accounts/{kidId}` | Rename / redesign | nickname, card design | account | Parent guardian |
| POST `/banking/accounts/{kidId}/freeze` | Freeze/unfreeze | frozen | account | Parent guardian |
| GET / PUT `/banking/allowance/{kidId}` | Read / set the allowance | amount 1–1,000; frequency; anchor day (0–6 or 1–28); active | rule | Parent guardian; the account must be open |
| GET / PUT `/banking/spend-limit/{kidId}` | Read / set the spending limit | period weekly/monthly; cap ≥ 1; active | status (configured, cap, used, remaining) | Parent guardian; the account must be open |
| GET / PUT `/banking/savings-bonus/{kidId}` | Read / set the savings bonus | rate 0–2,000 basis points; active | rule | Parent guardian; the account must be open |
| GET `/banking/statement/{kidId}` | Monthly statement | month YYYY-MM | earned, spent, saved, entries | Parent guardian |
| GET `/banking/account` | My account (processes due credits) | — | account or none | Kid |
| PATCH `/banking/account` | Rename / redesign my card | nickname, card design | account | Kid |
| POST `/banking/account/freeze` | Freeze/unfreeze my card | frozen | account | Kid |
| GET `/banking/allowance` | My allowance rule | — | rule | Kid |
| GET `/banking/spend-limit` | My spending limit status | — | status | Kid |
| GET `/banking/savings-bonus` | My savings bonus rule | — | rule | Kid |
| GET `/banking/wallet/pending-credits` | Allowance payments to sort | — | credits | Kid |
| POST `/banking/wallet/pending-credits/{id}/allocate` | Sort a pending credit | save, spend, share (sum = amount) | allocated | Kid (owner) |
| GET `/banking/statement` | My monthly statement | month | statement | Kid |

## 13. Core API — Profiles and social

| Method & address | Purpose | Inputs | Outputs | Access |
|---|---|---|---|---|
| GET `/profile` | My profile | — | name, username, cover, avatar, member since, email, language, theme, date of birth, follower counts, learning stats, course badges | Authenticated |
| PATCH `/profile` | Update my profile | name 1–80, username (3–20, a–z0–9_), language, date of birth | updated | Authenticated; `USERNAME_TAKEN` |
| PUT `/profile/cover` | Set the cover | preset (10 values) | cover | Authenticated |
| PUT `/profile/avatar` | Save the avatar | option set (closed keys) | updated | Authenticated |
| GET `/profile/followers` · `/profile/following` · `/profile/blocked` | My lists | — | users | Authenticated |
| GET `/profiles/{username}` | A public profile | — | public fields, counts, is following, is self, is Tutor, learning stats, course badges | Authenticated; 404 if missing **or blocked either way** |
| GET `/profiles/{username}/followers` · `/following` | Their lists | — | users | Authenticated; same visibility rule |
| POST / DELETE `/profiles/{username}/follow` | Follow / unfollow | — | following flag | Authenticated; cannot follow self |
| POST / DELETE `/profiles/{username}/block` | Block / unblock | — | blocked flag | Authenticated; cannot block self; unblock works although the profile is hidden |

## 14. Core API — Public growth and analytics

| Method & address | Purpose | Inputs | Outputs | Access |
|---|---|---|---|---|
| GET `/badges/{token}` | Public badge data | token (16–64 URL-safe characters) | first name, achievement kind, label, image address | **Public** |
| GET `/analytics/tracking-decision` | Should this browser load analytics trackers? | — (uses the caller's address and user agent) | excluded, degraded | **Public**; never cached; bots are always excluded; the address is not stored |
| POST `/events` | First-party usage event ingestion | 1–25 events per batch (event, surface, lesson, course, segment, value, session, device, language, referrer class, ordinal, client event id, version, occurred at, experiment id/variant); optional anonymous visitor id and acquisition context | accepted count (202) | **Public** for anonymous acquisition events; authenticated otherwise. Its own rate pool; body ≤ 16 KB. Silently accepts 0 when excluded, a bot, or unconsented (see 07). |

## 15. Core API — Staff console (`/admin`) — Staff (Superadmin where noted)

Every staff request also records the caller's network address as a "staff sighting" (for exclusion suggestions).

### 15.1 Web and behavioral analytics, health

| Method & address | Purpose | Key inputs | Output |
|---|---|---|---|
| GET `/admin/analytics/overview` | Web analytics KPIs and time series | period / custom range; filters | visitors, pageviews, bounce rate, visit duration, series, resolved range |
| GET `/admin/analytics/breakdown` | Top values by dimension | dimension (page, source, referrer, channel, country, region, device, browser, os, entry page, exit page, UTM source/medium/campaign); limit 1–200 | rows, imported-history flag |
| GET `/admin/analytics/report` | Report bundle | audience marketing/sales/frontend/full; rows 1–200 | aggregate, previous period, series, breakdowns, import flags, range drift, **first-party block** |
| GET `/admin/analytics/report.pdf` · `.csv` · `.xlsx` | Downloadable report | as above, plus report language (PDF) | file |
| GET `/admin/analytics/exclusions` | Internal-traffic registry | days 1–90, limit 1–200 | this device (address, excluded), active exclusions, detected staff addresses |
| POST `/admin/analytics/exclusions` | Exclude a network | network (address or range; IPv4 ≥ /16, IPv6 ≥ /32), label 1–80, reason ≤ 280 | exclusion (409 if already covered) |
| POST `/admin/analytics/exclusions/self` | Exclude my current address | label, reason | exclusion |
| DELETE `/admin/analytics/exclusions/{id}` | Revoke an exclusion | — | revoked exclusion |
| GET `/admin/analytics/behavior` | Behavioral (adult surfaces) stats | period | pageviews, visitors, visits, bounces, total time, out-of-boundary pageviews |
| GET `/admin/analytics/behavior/breakdown` | Behavioral breakdown | dimension (path, referrer, title, query, browser, os, device, screen, language, country, region, city, event); limit | rows |
| GET `/admin/analytics/behavior/series` | Behavioral daily series | period | pageviews and sessions per day |
| GET `/admin/analytics/behavior/export` | Behavioral export | period; csv/xlsx | file |
| GET `/admin/health/services` | Service health | — | monitors (status, latency, 24 h uptime), totals up/down |

### 15.2 Platform, content and moderation

| Method & address | Purpose | Output / notes |
|---|---|---|
| GET `/admin/overview` | Platform totals | users by primary role, staff count, courses and lessons by status, review queue, audit total |
| GET `/admin/learning/retention` | Forgetting curves | first-attempt scores on review lessons by days since last practice (0–1, 2–6, 7–13, 14–29, 30+) and by source topic |
| GET `/admin/users` | All users | name, username, language, created, date of birth, roles |
| GET `/admin/users/timeline` | Signups per day | days 7–365 |
| GET `/admin/content` | Course list and summary | structure counts, lessons by status |
| POST `/admin/content/{courseId}/status` | Publish (release check) / draft / archive | release refusal codes (see §1.6) |
| GET `/admin/moderation` | Lessons in review | context titles and languages |
| GET `/admin/moderation/{lessonId}` | Lesson review detail | documents per language, metadata |
| POST `/admin/moderation/{lessonId}/status` | Approve/reject a lesson | status draft / review / published / archived |
| GET `/admin/tutor/review-queue` | Sampled live tutor activities | includes answer keys |
| POST `/admin/tutor/review-queue/{segmentId}/status` | Approve/reject an activity | approved / rejected |
| GET `/admin/tutor/retention-status` | 90-day sweep health | stale flag |
| GET `/admin/audit` | Audit log | limit 1–200, offset, action, actor, subject, from/to |

### 15.3 Generation telemetry

| Method & address | Purpose |
|---|---|
| GET `/admin/generation` | Overview of generation runs and tracks |
| GET `/admin/generation/runs/{runId}` | One run in detail |
| GET `/admin/generation/live` | Active runs (updated in the last 2 minutes) |
| GET `/admin/generation/analytics?course=` | Cost, quality and failure trends |
| GET `/admin/generation/coach?course=&track=` | Deterministic diagnosis and evidence-backed proposals |
| GET `/admin/generation/snapshots/{runId}` | Progress time series |
| GET `/admin/generation/slots/{runId}/{slotId}` | One lesson slot's rubric, error and metrics |
| GET `/admin/generation/compare?runA=&runB=` | Side-by-side run comparison |

### 15.4 Roles and permissions (Superadmin)

| Method & address | Purpose | Inputs |
|---|---|---|
| GET `/admin/roles` | Role and permission holders | — |
| GET `/admin/roles/candidates` | Find users to assign | query ≥ 2 characters, limit 1–20 |
| POST `/admin/roles/grant` · `/admin/roles/revoke` | Grant/revoke a role | user id; role parent / kid / bigfounder / admin / superadmin (cannot revoke own superadmin) |
| POST `/admin/roles/permissions/grant` · `/revoke` | Grant/revoke a staff permission | user id; permission manage_users / manage_content / view_analytics / manage_support |

### 15.5 Email

| Method & address | Purpose | Inputs |
|---|---|---|
| GET `/admin/emails/logs` | Delivery log | limit 1–200, offset, search, status, template |
| GET `/admin/emails/summary` | Delivery summary | days 7–365 → total, by status, by template, by language, trend |

### 15.6 First-party insights

| Method & address | Purpose (key inputs) |
|---|---|
| GET `/admin/insights/calibration` | Worst-calibrated exercises (min learners 1–100, limit) |
| GET `/admin/insights/activity` | Daily activity by dimension, plus distinct users (days 1–365) |
| GET `/admin/insights/audience` | Sessions by audience (anonymous / registered / staff), external share (days) |
| GET `/admin/insights/registrations` | Server-side account creations per day and role |
| GET `/admin/insights/funnel-integrity` | Server registrations vs. observed signup events |
| GET `/admin/insights/acquisition` | Anonymous visitors, conversions, rate |
| GET `/admin/insights/cohorts` | Weekly cohort retention (weeks 1–52) |
| GET `/admin/insights/funnel` | Activation funnel (6 steps) |
| GET `/admin/insights/velocity` | Per-learner pace (limit) |
| GET `/admin/insights/dropoff` | Lesson abandonment (limit) |
| GET `/admin/insights/adoption` | Feature adoption by role and surface |
| GET `/admin/insights/sessions` | Recent session depth (days 1–90, limit 1–1,000) |
| GET `/admin/insights/export` | Raw event export (csv/json; days, role, event, surface, language, device; limit 1–50,000; offset; continuation token). Audited. |
| GET `/admin/insights/timetovalue` | Hours from first seen to first completed lesson |
| GET `/admin/insights/engagement` | Engagement score per learner |
| GET `/admin/insights/families` | Family engagement and consent coverage (**currently answers unavailable; see 07**) |

### 15.7 Intelligence warehouse

| Method & address | Purpose |
|---|---|
| GET `/admin/intel-export.csv` · `.xlsx` | Multi-sheet export (activation funnel, engagement, lesson drop-off, exercise calibration) with staff-exclusion notes (days 1–3,650 or from/to) |
| ANY `/admin/intel/*` | **Pass-through proxy** to every warehouse endpoint (§17). 30 s timeout; responses over 50 MB refused. |

---

## 16. AI Tutor Runtime (Oracle)

### 16.1 HTTP (Internal, except health)

| Method & address | Purpose | Inputs | Outputs |
|---|---|---|---|
| GET `/health` | Liveness and components | — | model up/down, voice up/down, moderation up/down, live sessions, today's spend vs. ceiling, admitting new sessions |
| POST `/api/v1/tutor/preflight` | Can a session start? | is minor, wants voice | can start, blocked by (MODEL_UNAVAILABLE / MODERATION_UNAVAILABLE), voice available, microphone available, minor voice policy (allowed/blocked) |
| POST `/api/v1/tutor/placement-intake` | AI reading of placement free text | course title, subject, outline, language, age band (12–14 / 15–17 / 18+), learner text, neutral reflection | available, prior fraction, reflection, source (model/fallback), flag (category/severity) |
| GET `/api/v1/tutor/status` | Operational status | — | live sessions, model configured, voice provider, moderation for minors, pregenerated lines count and date, speech-cache scope |

### 16.2 Live websocket `/ws/tutor?token=…` (Socket token)

- **Admission order:** capacity → handshake rate → token present → not a regular sign-in token → signature, expiry and single use → session belongs to the user → moderation ready → microphone consent. A session allows only one live connection.
- **Close codes:**

| Code | Meaning |
|---|---|
| 4001 | Unauthorized |
| 4003 | Consent required |
| 4004 | Session not found |
| 4008 | Budget exhausted |
| 4009 | Already connected |
| 4013 | Service degraded (capacity, rate limit, moderation unavailable, internal error, continuity failure) |
| 4029 | Daily spend ceiling |
| 1000 | Normal (completed, idle, shutdown) |

- **Client → server messages:**
  - learner text (1–2,000 characters);
  - learner edit (replace the last message);
  - learner audio (a whole clip ≤ ~1.1 MB, or streamed begin / chunk / commit);
  - interrupt;
  - activity graded (activity, score, correct, signed receipt, attempt);
  - adaptation response (adaptation, accepted);
  - end session;
  - ping.
- **Server → client messages:**
  - **ready** (session, character, companion, island, voice, microphone, intelligence degraded, language);
  - **turn** (sequence, text, emotion, gesture, audio address or pending, next step ask/segment/close, listening policy, demonstration steps, lesson step x of y, whiteboard, roleplay scene, pointer);
  - **turn audio** (address and word timings);
  - **thinking**;
  - **history** (on resume);
  - **transcript** (what the learner said);
  - **segment** (an activity with origin, whether it scores XP, framing);
  - **adaptation offer**;
  - **state** (budget running/wrapping/ended, remaining time, turn count);
  - **closed** (reason);
  - **error** (code and message).

---

## 17. Analytics Warehouse (Data Intel) — Internal (reached by staff through the Core proxy)

Base: `/api/v1/intel`. Global 200 requests/15 min. Responses cached for 5 minutes. Window parameters: `days` 1–3,650 or `from`/`to`.

| Group | Endpoints |
|---|---|
| Metrics | GET `metrics/summary`; GET `metrics/trends` (metric events/dau/users/sessions; granularity hour/day/week/month); GET `metrics/compare`; GET `metrics/timetovalue` |
| Engagement | GET `engagement/leaderboard` |
| Lessons | GET `lessons/dropoff`; GET `lessons/calibration` |
| Sessions | GET `sessions/depth` |
| Funnels | GET `funnels/activation`; POST `funnels/custom` (2–10 steps, window 1–365 days) |
| Retention | GET `retention/cohorts`; POST `retention/curves` (1–50 cohorts) |
| Segments | POST `segments` (name, 1–20 filters field eq/neq/in); GET `segments`; GET `segments/{id}/metrics`; POST `segments/compare`; DELETE `segments/{id}` |
| Exports | POST `export/jobs` (filters; csv/json/parquet); GET `export/jobs/{jobId}`; GET `export/jobs`; POST `export/events` (limit 1–10,000, offset) |
| Anomalies | GET `anomalies`; GET `anomalies/active`; POST `anomalies/{date}/resolve`; GET `anomalies/history` |
| Churn | GET `churn/risk`; GET `churn/factors` |
| Forecast | GET `forecast` |
| Paths | GET `paths/top`; POST `paths/sankey` (2–20 steps) |
| Learning | GET `learning/states/{userId}`; GET `learning/recommendation/{userId}`; GET `learning/content-health`; GET `learning/overview`; GET `learning/learners/{userId}` |
| Quality | GET `quality/staff-exclusion`; GET `quality` (sync freshness) |
| Experiments | POST `experiments` (name, variants A/B, surface, target); POST `experiments/{id}/start`; GET `experiments/{id}/results`; POST `experiments/{id}/conclude`; GET `experiments` |
| Runtime experiments | POST `runtime/experiments/assignments` (user, surface, target → sticky variants); POST `runtime/experiments/exposure` |
| Alerts | POST `alerts` (name, metric, condition above/below/change %, threshold, channel webhook/email, cooldown 1–1,440 min); GET `alerts`; PATCH `alerts/{id}` (active/paused); DELETE `alerts/{id}`; GET `alerts/{id}/history` |

Plus GET `/health` (warehouse and cache status, last sync, sync error).

---

## 18. Supporting internal services

### 18.1 Media Storage (Depot)

| Method & address | Access | Purpose |
|---|---|---|
| GET `/health` | Public | Liveness |
| POST `/api/v1/files` | Internal | Store a file: bucket, visibility public/internal, file up to 25 MB (MP3, WAV, OGG, PNG, JPEG, WebP, JSON, 3D model). Content-addressed; deduplicated. |
| GET `/api/v1/files?bucket=` | Internal | List a bucket (cursor, limit 1–200) |
| DELETE `/api/v1/files/{bucket}/{file}` | Internal | Delete a file |
| POST `/api/v1/badges` | Internal | Render a badge image (kind, label, first name, optional age band) |
| GET/HEAD `/files/{bucket}/{hash}.{ext}` | Public for public files; internal key for private files | Download, with range requests, entity tags and 1-year immutable caching. Public files allow any origin. Private files are never readable cross-origin. |

### 18.2 Transactional Email (Courier)

| Method & address | Access | Purpose |
|---|---|---|
| GET `/health` | Public | Liveness |
| POST `/api/v1/send` | Internal | Send an email (recipient, subject, HTML/text, template type, language, user) → 202 |
| POST `/api/v1/logs` | Internal | Record a delivery (used by the mail relay) → 202 |
| GET `/api/v1/logs` | Internal | Delivery log (limit 1–200, offset, search, status, template) |
| GET `/api/v1/logs/summary` | Internal | Summary (days 7–365) |
| SMTP relay (port 587 / local 2525) | Private-network sources only | Accepts mail from the authentication server and forwards it to Amazon SES |

### 18.3 Lesson Audio (Echo) — Internal

| Method & address | Purpose |
|---|---|
| POST `/internal/v1/audio/lesson` | Narrate one lesson document (lesson id, language) → units total, generated, reused, cached, failed |
| POST `/internal/v1/audio/segment` | Synthesize a text (≤ 4,000 characters, language, optional voice) |
| GET `/internal/v1/audio/lesson/{id}?locale=` | Read a lesson's audio manifest |
| GET `/health` | Liveness |

### 18.4 Image Generation (Prism) — Internal

| Method & address | Purpose |
|---|---|
| POST `/api/v1/pictures` | Generate or reuse an illustration (label ≤ 300, context ≤ 2,000, purpose lesson_option / option_card / item_card / scene_anchor / memory_card / outcome / scene / generic, scope) → address, file id, prompt, model, cached, images generated. A 502 means retryable; a 422 means refused. |
| GET `/health` | Liveness |

### 18.5 Guardian Identity Check — Internal

| Method & address | Purpose |
|---|---|
| POST `/internal/v1/verifications/parent` | OCR comparison (given names, surnames, date of birth, document image ≤ 8 MB) → verified plus four checks. 422 when unreadable. |
| GET `/health` | Liveness |

### 18.6 Course Generation (Forge)

| Method & address | Purpose |
|---|---|
| GET `/health` | Liveness. All generation work runs through operator tools, not HTTP (see 08). |

### 18.7 Web application edge function

| Address | Access | Purpose |
|---|---|---|
| GET `/badge/{token}` (web domain) | Public | Serves the app shell with link-preview tags (title "{First name} — {Achievement} · LittleFounders", description and image) so messaging apps show a rich preview. The app then renders the badge landing. |

### 18.8 Authentication / data gateway (Vault)

The self-hosted identity and data gateway exposes standard authentication routes (sign-up, token, verify, callback, authorize, key set, single sign-on metadata), a data API, a GraphQL API and realtime channels, all behind API keys and row-level security.

In practice the web app uses it directly only for:
1. following verification, recovery and OAuth links;
2. **realtime subscription to live generation progress** (staff only; the data carries no personal information).

All other product data flows through the Core API.
