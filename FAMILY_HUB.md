# FAMILY_HUB.md — Family functions: tasks, rewards, monitoring — product plan

> **Authority:** engine spec (`/AGENTS.md` §1.1 tier 6). Subordinate to `/AGENTS.md`,
> `ROADMAP.md`, `GLOSSARY.md`, `DESIGN.md`, `backend/AGENTS.md`, `frontend/AGENTS.md`,
> `database/AGENTS.md`. Authoritative over `WALKTHROUGH.md`, `repo_map.md` and
> `doc_map.md` on this topic. Where this plan's recommendations would change the
> literal wording of an `/AGENTS.md` invariant (§5.1 flags the one case), that
> change is NOT authorized by this file alone — it requires explicit owner
> sign-off, applied to `/AGENTS.md` **and** `/CLAUDE.md` in the same commit as the
> code, per `/AGENTS.md`'s own sync rule.
>
> **Created:** 2026-09-08 · **Language:** English, per `/AGENTS.md` §1.0 #4.
>
> **What this file is.** A product plan, not a record of built work. Nothing in
> §5–§10 exists yet. It was derived by reading the actual repo state (schema,
> routes, RLS, nav) in the same session, cross-referenced against a competitive
> survey of the closest real products (Greenlight, GoHenry, BusyKid, RoosterMoney,
> FamZoo, Google Family Link, Qustodio, Cozi, ClassDojo, Khan Academy, Duolingo —
> full findings in the session transcript, not reproduced here). Every open
> decision is listed in §11 and none of them is assumed silently.

---

## §0 STATE — read this first, always

**This section is the resume point after any context loss. Update it at every wave boundary.**

| | |
|---|---|
| **Status** | **SHIPPED AND LIVE IN PRODUCTION** (2026-09-08). Waves 0-3 (schema, backend, frontend, both roles) built and verified locally 2026-09-08; a follow-up 5-lens deep audit (security, backend correctness, frontend UX, accessibility, product quality) found real issues and closed every one — fixed, or accepted as a documented risk (§8.1) — in the same session, adding proof-of-work photos, a chore streak, goal-reached badge sharing, a kid wallet history, and a real `/family` landing along the way (round-2 close-out below has the full list). Pushed to `main` and deployed on the owner's explicit authorization: migrations `0074`-`0080` applied via `tutor-deploy.yml step:migrate` (pre-migration restore point taken automatically), confirmed at production **80/80** and independently re-verified live (`/health`, both new API routes reachable, `/family` serving 200, deployed commit SHA matched HEAD) — see `ROADMAP.md`'s migration-handoff paragraph for the full receipt. §11 is kept below as the record of the owner's original D1-D6 decisions. |
| **What's real today** | The full earn → allocate → goal → redeem loop, proof-of-work photos, a chore streak, goal-reached badge sharing, and the `/family` Family Hub landing are all live in production. `family` (guardian identity → `parent` role, kid account CRUD, kid territory view, analytics consent, shareable badge) remains SHIPPED from before this build. Real-family production usage has not been separately re-measured since deploy (the 2026-09-07 "zero real families" reading predates this feature going live). |
| **Next action** | None outstanding for Waves 0-3 or the round-2 audit. Wave 4 (a real Share-bucket mechanic, sibling comparisons, recurring-task templates, co-parent approval-queue polish) remains deliberately out of scope, per §10. |

**Backend AND frontend (Waves 1-3) are DONE**, ahead of the phasing this section originally described. Backend: `backend/src/routes/tasks.ts`, mounted at `/api/v1/tasks` — deliberately NOT under `/api/v1/family` (that router is entirely `requireRole(['parent'])`; this one needs both roles, so it mirrors `learn`/`tutor`'s shape instead — `requireAuth` at the router, `requireRole([...])` per route). Full route table: `backend/README.md`. Frontend: `frontend/src/routes/app/tasks/` (`TasksPage.tsx` role-branches to `ParentTaskBoard.tsx`/`KidTaskBoard.tsx`), replacing the `SectionComingSoon` placeholder (now deleted — it had no other consumer); `navConfig.ts`'s `requiresRole` widened to accept an any-of role set for this one nav item. Covers task CRUD + approve/cancel, the atomic allocate-to-buckets flow with goal tagging, wallet balance/ledger reads, savings goals with progress, and the redemption catalog + request/decide flow — all of §6's end-to-end flow, UI included.

**Verified live, not just by test suite**: local dev stack (`db:reset`, backend, frontend all running), a real signup → parent-role grant → kid-account creation → task creation → complete → approve → allocate-with-goal-tag → goal progress bar update, all driven through the actual browser UI with real HTTP round-trips, screenshotted at both breakpoints for both roles (§1.11). One process note: this session's Chrome `resize_window` tool only applied a requested size after the tab GROUP was closed and recreated (a one-generation lag), and macOS clamped the achievable "mobile" width to ~500px rather than exactly 375px — still comfortably under the app's real `768px` mobile breakpoint, so the verification is valid, just not pixel-exact to the AGENTS.md-suggested measurement point. Backend: 26 new tests (`backend/src/__tests__/tasks.test.ts`), suite green at 920/920. Frontend: suite green at 1804/1804 (including the design-classes gate, which caught one invented class name — `lf-display-md` doesn't exist, fixed to the real `lf-number lf-headline` pair `StatCard.tsx` already established for a dense numeral). i18n: `tasks` key group added to `common.json` in all three locales (mirroring where `family` already lives, not a new file), gates green. type-check/lint/build clean in both services.

A real correctness bug was caught and fixed before any frontend code depended on it: the first draft of `tasks.ts` returned raw snake_case DB rows (`assigned_to`, `reward_coins`) instead of the camelCase every other endpoint in this API uses (`routes/family.ts`'s own convention) — see the dedicated commit fixing it, with two regression tests asserting the snake_case fields are `undefined` on the wire.

**2026-09-08, round 2 close-out.** Every finding from the 5-lens audit below is
now either fixed or a documented, accepted risk (§8.1) — including the four
product-quality gaps it flagged as scope, not bugs: celebration on
task-approved/goal-reached (badge reuse, 0079), a real `/family` landing
(this section, just above), the kid's own ledger history (§7's "receipt
list," `GET /tasks/wallet/ledger` finally consumed), and a chore streak
(0080). Verified live at ~1280px and mobile (~390px, real narrow viewport
this round — browser-tool coordinate/resize quirks made a couple of clicks
misfire during verification, root-caused via `elementFromPoint` and a direct
DOM `.click()` rather than assumed away; not a product defect). Backend
961/961, frontend 1804/1804.

**2026-09-08, round 2 — UI redesign, proof-of-work photo, and a 5-lens deep audit.** The owner flagged the first cut's UI as not using desktop space deliberately (a stretched single column at 1280px — the exact §1.11 violation) and asked for a photo-evidence feature so a kid can attach proof of a completed chore. Both shipped: a real 2-column desktop dashboard (documented as a new DESIGN.md screen recipe) and `0077_task_evidence.sql` + `POST`/`GET /:id/evidence`, the photo stored `visibility: internal` in Depot and only ever reached through Core's own authenticated proxy (§1.9 — a kid's photo is a different privacy class than a public badge). A follow-up ask for a detailed audit ("no genérico, encuentra áreas de oportunidad") ran 5 parallel reviews (security/privacy, backend edge cases, frontend UX, accessibility, product quality) against the shipped code — no critical bugs, but real ones: a race where a photo could attach after a parent had already decided the task, a permanent per-replace storage leak in Depot, evidence type-checked only by declared Content-Type, several one-click destructive actions with no confirmation and no visible error on failure. All fixed in `0078_task_hardening.sql` + the same commit's backend/frontend changes, backend tests 36 → 55, both suites green. See §8.1 below for the one finding that was accepted as a documented risk rather than fixed.

---

## §1 Vision

LittleFounders already teaches saving, budgeting and earning as **course content**.
Today nothing in the product lets a kid *practice* it. The Tasks section is a
placeholder; the family surface is a management console (add a child, watch
their lesson progress) with no loop that brings a parent and a kid back
together inside the app more than once.

**The gap and the fix are the same thing.** Every competitor in this space
(Greenlight, GoHenry, BusyKid, RoosterMoney, FamZoo) is built around one loop:
a kid does something real in the world, earns something inside the app for it,
and has to decide what to do with what they earned. That loop — chore → income
→ allocate → goal — is not a feature bolted onto financial education. It IS
financial education, played instead of read. Building it turns `tasks/` from
a generic to-do list into the single strongest piece of retention the product
has, because it is the one surface both roles have a reason to open every day:
the kid to see what they earned, the parent to approve it.

**The three pillars this plan proposes:**

1. **Earn & Allocate** — chores become income (LF Coins, a virtual currency,
   never real money), split across three buckets a kid controls: **Save**,
   **Spend**, **Share** — the same three-way split BusyKid and FamZoo center
   their whole product on, and the same concept `financial-education`
   already teaches in lesson form.
2. **Goals** — a kid names something they're saving toward and watches a
   real progress bar move every time a chore is approved.
3. **Family Monitoring** — a parent sees what's happening without asking:
   task activity, learning progress (already partly built), streaks, and
   proactive notifications instead of a dashboard nobody opens. This is
   monitoring in the ClassDojo/Khan-Academy sense — **visibility into
   learning and activity** — never in the Qustodio/Family-Link sense of
   device or location control. §3 makes that boundary explicit because it
   is the one a reader is most likely to import from the wrong reference
   product.

---

## §2 What "first-tier" means here, concretely

Not "add every feature the market has." The competitive survey turned up four
distinct categories of family app, and only one of them is actually our
category:

| Category | Examples | Relevant to us? |
|---|---|---|
| Chore/allowance + kid banking | Greenlight, GoHenry, BusyKid, RoosterMoney, FamZoo | **Yes — this is our category.** The earn→allocate→goal loop, minus the real money. |
| Device-level parental control | Google Family Link, Qustodio | No. Screen time, app blocking, GPS location, message scanning are OS/device-permission features. We are a web SPA; building these means shipping native apps with MDM-grade permissions — a different company. §3 makes this a hard boundary, not a "later." |
| Household organizer | Cozi | No product overlap (shared calendar, grocery lists). Worth one UI idea only: a single unified "what's happening in my family today" view, which §7's Family Hub screen already does for a different purpose. |
| Ed-tech parent dashboard | ClassDojo, Khan Academy, Duolingo Family Plan | **Partially — this is what "monitoring" should mean for us.** Progress visibility, proactive notification, weekly digest. We already have the progress data (`territory` endpoint); we're missing the proactive half. |

"Putting LittleFounders on par with first-tier products" means matching the
**chore/allowance category's core loop** with zero real-money surface, and
matching the **ed-tech dashboard category's proactive monitoring**, while
explicitly not chasing the device-control category at all.

---

## §3 Non-goals — locked scope boundary

Each of these was cut for a specific, load-bearing reason, not for being
"out of scope for now." A future request to add one of these should re-read
the reason before reopening it.

| Cut | Why |
|---|---|
| Real money, bank transfers, a debit card | Requires a banking partner, a money-transmission license, KYC on the parent, PCI scope. That is a different regulated business, not a feature. LF Coins are a closed, virtual, in-app-only unit with no cash-out path — this is what keeps the entire feature inside a normal `npm run build` instead of a compliance program. |
| Device screen-time limits, app blocking | We are a web SPA. Enforcing this requires a native app with OS-level supervision permissions (Family Link/Qustodio's actual mechanism). Out of the stack of record (§1.2) entirely. |
| GPS location / geofencing | The single most sensitive category of a minor's data that exists, with **no product justification** here — nothing in our feature set needs to know where a child physically is. Directly in tension with §1.9's minimal-data-collection default. Not "deferred" — refused. |
| Reading a kid's messages/social media on other platforms | We have no access to those platforms and no reason to build toward it. This is Qustodio's "Social Monitor" — irrelevant to an app that does not host kid-to-stranger messaging at all. |
| Converting LF Coins ↔ XP (`learning_stats`) | Keeping the chore economy and the learning-gamification economy separate is deliberate: conflating them lets a kid "buy" academic-looking progress, which corrupts the one signal (`learning_stats`) that is meant to mean "this was actually learned." §8 makes this explicit at the integration-point level. |

---

## §4 Currency & vocabulary (draft — see D3 in §11)

Working name: **LF Coins** (`lf_coins`, integer, no fractional units — matches
`learning_stats.xp` in being a plain integer ledger, not a decimal money type,
which sidesteps any appearance of being currency-equivalent). Visual language:
three "jars" — **Save**, **Spend**, **Share** — rendered as containers a coin
visibly drops into, in the same tactile-object idiom `WALKTHROUGH.md`'s
2026-09-05 appearance migration already established for pressable objects
(`.lf-tactile`). This is a naming/branding call for the owner, not an
engineering one — flagged as D3.

---

## §5 Data model

### §5.1 The blocking decision (D1): `families`/`family_members` vs `guardian_links`

Every write path that exists today (`POST /family/kids` and everything it
calls) links a parent to a kid through `guardian_links` — a verified
`(parent_user_id, kid_user_id)` pair. It never touches `public.families` or
`public.family_members`, even though both tables exist (`0001_identity.sql`)
and `/AGENTS.md` §1.3 states membership "lives in the `family_members` join
table. Never model it as a `parent_id` column." Verified live: both tables
have zero rows in production. `public.tasks` (`0002_content_skeleton.sql`,
explicitly PROVISIONAL) foreign-keys `family_id → families.id` — a column
nothing can ever populate under the current code path.

This has to be resolved before anything in §5.2 can be migrated, because the
new tables (wallet ledger, goals, redemption catalog) all need the same
answer to "what identifies a family."

**Recommendation:** drop `public.families` and `public.family_members`
rather than start populating them. Reasoning: `guardian_links` already
satisfies the actual invariant the join table exists for — multiple parents
per kid — because nothing stops two different `parent_user_id` rows from
pointing at the same `kid_user_id`. Introducing a second entity (`families`)
that nothing currently reads, on top of the relation that already works and
is what every existing endpoint's RLS policy (`is_verified_guardian_of()`)
already checks, adds a table with no unique responsibility. The unit this
plan calls a "family" is: **one kid + the set of their verified guardians**,
derived from `guardian_links`, never stored as its own row.

This recommendation changes what `/AGENTS.md` §1.3 says on the page — the
sentence "membership lives in the `family_members` join table" would become
false. Per this file's own authority header, that edit is not mine to make
unilaterally; it is D1 in §11, and shipping it means the migration that drops
the tables, the code that re-keys `tasks`/wallet/goals off `guardian_links`,
and the `/AGENTS.md` + `/CLAUDE.md` wording fix land in the **same commit** —
exactly the discipline §8's stewardship table already requires for any
invariant change.

*(If the owner instead prefers to keep `families`/`family_members` as the
literal source of truth, the alternative is: start writing a `families` row +
two `family_members` rows at kid-creation time, keep `guardian_links` as the
verification/consent record it already is, and FK the new tables to
`families.id` as originally designed. Either path is buildable; §11 needs the
answer before Wave 0's migration is written.)**

### §5.2 New tables (drafted against the D1 recommendation — re-key on `guardian_links` if D1 goes the other way)

```
-- wallet_ledger — append-only, exactly like audit_logs and the XP-write
-- pattern learning_stats already established. A balance is SUM(amount) per
-- bucket, never a mutable counter — this is /AGENTS.md §1.14's own rule
-- ("failure must be distinguishable from emptiness") applied here: a wallet
-- balance derived from a corrupted read defaults to a WRONG number if it's a
-- counter, and to a computable, re-derivable number if it's a ledger sum.
CREATE TABLE public.wallet_ledger (
    id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    kid_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    bucket      text NOT NULL CHECK (bucket IN ('save', 'spend', 'share')),
    amount      integer NOT NULL,          -- signed; credits positive, redemptions negative
    reason      text NOT NULL CHECK (reason IN (
                    'task_approved', 'goal_withdrawal', 'redemption', 'manual_adjustment'
                )),
    task_id       uuid REFERENCES public.tasks (id) ON DELETE SET NULL,
    goal_id       uuid REFERENCES public.savings_goals (id) ON DELETE SET NULL,
    redemption_id uuid REFERENCES public.redemptions (id) ON DELETE SET NULL,
    created_by  uuid NOT NULL REFERENCES auth.users (id),   -- who caused the entry (parent approving, kid redeeming)
    created_at  timestamptz NOT NULL DEFAULT now()
);
-- INSERT: service role only (server computes every amount — never client-asserted,
-- same rule /AGENTS.md §1.14 states for instrument-derived fields). SELECT: the
-- kid themself + their verified guardians.

CREATE TABLE public.savings_goals (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    kid_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    title       text NOT NULL,
    target      integer NOT NULL CHECK (target > 0),
    icon        text NOT NULL DEFAULT 'star',   -- closed vocabulary, not free-text image upload — §9 PII note
    status      text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'reached', 'archived')),
    created_at  timestamptz NOT NULL DEFAULT now(),
    reached_at  timestamptz
);

CREATE TABLE public.redemption_catalog (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    title       text NOT NULL,     -- parent-authored, e.g. "30 extra minutes of tablet"
    cost        integer NOT NULL CHECK (cost > 0),
    active      boolean NOT NULL DEFAULT true,
    created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.redemptions (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    catalog_id   uuid NOT NULL REFERENCES public.redemption_catalog (id) ON DELETE CASCADE,
    kid_user_id  uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    status       text NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'approved', 'denied', 'fulfilled')),
    created_at   timestamptz NOT NULL DEFAULT now(),
    decided_at   timestamptz,
    decided_by   uuid REFERENCES auth.users (id)
);
```

### §5.3 `public.tasks` — redesigned, no longer provisional

Today: `family_id` (dead FK, see D1), free-form `reward jsonb`, `status` enum
with no endpoint that ever moves it, only a `SELECT` RLS policy. Redesign:

```
ALTER TABLE public.tasks DROP COLUMN family_id;   -- superseded by guardian_links derivation, pending D1
ALTER TABLE public.tasks
    ADD COLUMN reward_coins integer NOT NULL DEFAULT 0 CHECK (reward_coins > 0),
    ADD COLUMN recurrence   text NOT NULL DEFAULT 'once' CHECK (recurrence IN ('once', 'weekly')),
    ADD COLUMN due_at       timestamptz;
-- reward jsonb dropped: a free-form shape with no defined vocabulary is exactly
-- what /AGENTS.md §1.14 warns against — an unvalidated shape a UI has to guess
-- how to render. reward_coins is the one thing the loop actually needs.
```

RLS gains real `INSERT`/`UPDATE` policies (today there are none — the
migration comment says "service role for now"): a verified parent can insert
a task assigned to their verified kid; the assigned kid can transition
`open → done`; only the assigning parent (or any verified guardian — see D2)
can transition `done → approved`, which is the ONLY transition that writes a
`wallet_ledger` row, and that write happens server-side inside the same
request, never as a second client call — the same "server-computed, never
client-asserted" shape as the ledger note above.

---

## §6 Core flow, end to end

1. **Parent creates a task** — title, `reward_coins`, optional recurrence
   (`weekly`), optional `due_at`. (`POST /api/v1/family/tasks`)
2. **Kid sees it** on their task list, marks it done. (`PATCH .../tasks/:id` → `status: done`)
3. **Parent approves** — this is the ONLY action that credits the wallet.
   Server computes the ledger write; the client never sends an amount.
   (`POST .../tasks/:id/approve`)
4. **Kid allocates the credit** across Save/Spend/Share at approval time (a
   single split screen — "you earned 10 coins, where do they go?" — rather
   than a separate step later, so the allocation habit is inseparable from
   the earning event, which is the whole pedagogical point).
5. **Save bucket funds a goal.** A kid creates a goal (title + target),
   and any future Save credit either auto-applies to the active goal or the
   kid chooses — UI detail, not a data-model question. Reaching a goal
   (`status → reached`) mints a shareable badge through the **existing**
   Depot compositor (`filebase/src/lib/badge.ts`) — zero new infrastructure,
   the same mechanism the 2026-09-07 achievement-badge loop already ships.
6. **Spend bucket redeems** against the parent's own `redemption_catalog` —
   kid requests, parent approves/denies, `wallet_ledger` debits on approval
   exactly like a task credits on approval (same shape, opposite sign).
7. **Share bucket — v1 is tracked-only.** No redemption action attached; it
   is a running number and an optional note ("I want to give this to..."),
   deliberately deferred rather than built half-way — see D4 in §11 for why
   this is a decision and not just a cut.
8. **Parent gets notified** at: task marked done (needs their approval),
   goal reached, a redemption requested, and a standing weekly family digest.
   No new transport needed — this rides the existing `events.ts` pipeline the
   same way `parent_report_viewed`/badge events already do (`0072`).

---

## §7 UI/UX direction

Per `/AGENTS.md` §1.11, every screen below ships verified at ~375px and
~1280px before being called done, and every string exists in all three
locales in the same commit as the screen (§1.8).

- **`/family` gains a Family Hub landing** above the existing per-kid manage
  view: one card per kid — avatar, streak, a badge count for tasks awaiting
  approval, wallet total. This replaces "a list of children" with "what needs
  my attention," which is the ClassDojo-style proactive-visibility idea from
  §2 applied to our own data. **Shipped 2026-09-08 using the CHORE streak
  (`kid_task_streaks`, 0080), not `learning_stats`'s lesson streak this
  paragraph originally named** — a deliberate substitution once the chore
  streak existed: this card's whole point is "what needs my attention IN
  THIS DOMAIN," and the lesson streak is already visible on the kid's own
  territory page a parent can already reach from here. `GET /family/kids`
  now rolls up all three facts server-side (tasksForKids grouped by
  `status='done'`, `getWalletBalances`, `getTaskStreak`, one call per kid via
  `Promise.all` — kid counts per parent are small enough that this beats a
  bespoke aggregate endpoint).
- **`/tasks` stops being `SectionComingSoon`.** Parent view: tabs for
  *Awaiting approval* / *Active* / *Redemption catalog* (the catalog editor
  lives here, not in a separate settings page). Kid view: a single task list
  styled with the same tactile-press object language (`.lf-tactile`) the
  lesson engine's answer objects already use, per `DESIGN.md`'s closed
  tokens — this is not a new visual system, it is the existing one applied
  to a new surface.
- **Wallet screen (kid-facing)** — the three jars as the dominant visual
  element, each showing its running total; tapping a jar shows its own
  ledger history (a receipt list, not a dashboard). Goals live under the
  Save jar.
- **Notification surface** reuses the guardian portal's existing
  severity-first pattern (already built for the Tutor's safety-flag
  narrative) so a parent sees task/family notices in the same visual
  language as everything else the portal already tells them, rather than a
  third notification idiom.

---

## §8 Integration points with what already exists

| Existing system | How this plan touches it |
|---|---|
| `learning_stats` (XP, streaks) | Read-only reference for the Family Hub card. **No conversion path to/from LF Coins** — §3's non-goal, kept deliberate. |
| Shareable achievement badge (`filebase/src/lib/badge.ts`, `0072`/`0073`) | Reused as-is for "goal reached" — no new image/compositor work. |
| Guardian portal narrative (Tutor, `/ORACLE.md` §12) | Visual pattern reused for task/family notifications; no coupling to Tutor session state. |
| `events.ts` / closed-vocabulary analytics | New events (`task_created`, `task_approved`, `goal_reached`, `redemption_requested`, …) via a migration in the same shape as `0072` — and a real NSM candidate, since a family that completes the earn→allocate→goal loop at least once is a strong retention signal worth tracking from day one. |
| `oracle/` (Tutor) and `coursegen/` (model calls) | **Explicit boundary, not an integration**: task titles, redemption catalog text and goal names are parent/kid-authored free text about household life. None of it may ever reach a third-party model — no task, wallet or goal content is added to the Tutor's sealed context or any generation prompt. Worth stating here because §1.9's field-by-field review process exists precisely to catch a new data source getting added to that context without going through it. |

---

### §8.1 Accepted risk: no moderation on a kid-uploaded evidence photo

The proof-of-work photo (0077, §7) has no content moderation of any kind — a
kid can upload any image that passes the jpeg/png/webp magic-byte check
(`sniffImageMime`, `evidence.ts`), and a verified guardian sees it through
Core's authenticated proxy with no filter in between. This is deliberately
**not** the same class of gap §1.9's moderation rule exists for: that rule
gates AI-*generated* content reaching a minor, where nobody has looked at the
output before a child sees it. Here the direction is reversed — a child's own
upload, viewed only by their own already-fully-visible-into-their-account
parent — so the harm model is different and much narrower (a kid uploading
something unrelated or in poor taste, seen only by the parent it was already
meant for, not redistributed). Accepted for launch on that basis, with two
compensating controls already in place: `visibility: internal` in Depot (the
photo is never a public URL, §1.9's actual non-negotiable) and the 20/15min
evidence-upload rate limiter (0078, `evidenceUploadRateLimiter`) bounding how
many attempts a kid gets. **Not accepted as a permanent decision** — revisit
if evidence photos are ever shown to anyone besides the uploading kid's own
verified guardian (a sibling, a shared family feed, anything social).

## §9 Invariant checklist (nothing here is optional — this is what "done" checks against)

- [ ] `wallet_ledger` inserts are server-computed only; no endpoint accepts a
      client-supplied `amount` (§1.14 — this is the same class of bug the
      instrument schemas' server-derived-field rule already exists to prevent)
- [ ] Every new table has RLS enabled in the SAME migration that creates it,
      kid rows readable only by the kid and their verified guardians (§1.3)
- [ ] `tasks` gets real `INSERT`/`UPDATE` RLS policies — no more "service
      role for now" (closing the gap the provisional comment left open)
- [ ] Migration is sequential, idempotent, and (if D1 goes the "drop"
      direction) ships the `/AGENTS.md` + `/CLAUDE.md` §1.3 wording fix in
      the same commit
- [ ] No task/goal/redemption text is ever added to a Tutor or coursegen
      prompt (§1.9 boundary — see §8)
- [ ] Every new string in `en-US`, `es-MX`, `pt-BR` in the same commit as the
      screen that uses it (§1.8)
- [ ] Every new screen verified at ~375px and ~1280px, screenshotted, before
      being called done (§1.11)
- [ ] New closed-vocabulary events registered the same way `0072`'s were —
      `MARKETING_PREFIXES`/`MARKETING_ROOTS` untouched (this is product
      activity, not marketing surface)

---

## §10 Phasing

**Wave 0 — foundation, no user-facing surface.** D1's migration (drop or
populate `families`/`family_members`, per the owner's answer), `wallet_ledger`
+ `savings_goals` + `redemption_catalog` + `redemptions` tables, `tasks`
redesign + real RLS, backend service functions, `agent/prompts/templates/`
scaffolding for the new endpoints per the `new-endpoint.md` template.

**Wave 1 — the MVP loop.** Parent creates/approves a task → kid completes →
coins credited → Save/Spend/Share split UI → wallet screen with running
balances. This alone is a shippable, useful v1 — a family that only ever
uses Wave 1 already gets the core value.

**Wave 2 — goals.** Savings goal CRUD, progress bar, goal-reached →
shareable badge integration.

**Wave 3 — redemption + digest.** Parent-authored redemption catalog, the
request/approve/fulfill flow, and the weekly family notification digest.

**Wave 4 — deliberately deferred, not scoped here.** Share-bucket real
action (a curated cause list, or a written note that's just displayed — needs
a decision, not just a build), recurring-task template library, sibling
comparison/family challenges (flagged in the competitive survey as easy to
get wrong — needs its own design pass, not a bolt-on), co-parent shared
approval queue polish for the two-guardian case.

---

## §11 Decisions — DECIDED 2026-09-08 (owner approved every recommended option)

> Kept as the record of what was decided and why, not as a live blocker list — §0 links here.

| # | Decision | This plan's recommendation | Why it can't default |
|---|---|---|---|
| D1 | `families`/`family_members` (dead tables) vs `guardian_links` as the real relation | Drop the dead tables; re-key everything on `guardian_links`; fix `/AGENTS.md` §1.3's wording in the same commit | Changes what a locked invariant document says — not this file's call to make alone |
| D2 | Does every task need parent approval before crediting, or can young kids self-approve below some age? | Always requires approval — matches every competitor surveyed and is the safer default for a system that credits a currency | Changes the trust model of the whole loop; a wrong default here is hard to walk back once families are using it |
| D3 | Currency name/branding ("LF Coins" is a placeholder) and jar iconography | — | Pure branding/design call, owner's domain |
| D4 | Share bucket: tracked-only in v1, or build a real redemption/cause mechanic now | Tracked-only in v1 (§6 step 7) | A half-built "give" mechanic (no real charity, no real transfer) risks teaching the wrong lesson about what "sharing" money means — needs its own design thought, not a rushed v1 shortcut |
| D5 | Recurring tasks in the MVP (Wave 1) or deferred to Wave 4 | Include simple `weekly` recurrence in Wave 1 — every competitor has it and the added complexity over one-off tasks is small (one column, one cron-equivalent) | Affects Wave 1's actual scope/estimate |
| D6 | Redemption catalog: free-text parent-authored only, or a curated preset list we ship | Free-text only for v1 — zero content-moderation surface to build, and it's genuinely the parent's call what a privilege is worth | A preset list implies we're endorsing specific rewards across very different households/cultures (3 locales) |

---

## §12 Success metrics (once shipped)

- **Family activation**: % of verified `guardian_links` families that create
  ≥1 task within 7 days of kid-account creation
- **Loop completion**: % of created tasks that reach `approved` within their
  first week
- **Goal engagement**: % of kids with ≥1 active savings goal; median time to
  first goal reached
- **Retention correlation**: weekly-active-family rate for families with an
  active task loop vs. without — the number this whole plan is a bet on
