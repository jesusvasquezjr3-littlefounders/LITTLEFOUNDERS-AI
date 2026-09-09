# BANCA_DIGITAL.md — a family-bank experience over the LF Coins economy — product design

> **Authority:** engine spec (`/AGENTS.md` §1.1 tier 6), same tier as `FAMILY_HUB.md`.
> Subordinate to `/AGENTS.md`, `ROADMAP.md`, `GLOSSARY.md`, `DESIGN.md`,
> `backend/AGENTS.md`, `frontend/AGENTS.md`, `database/AGENTS.md`, and to
> `FAMILY_HUB.md` itself — this document extends that one's data model and UI
> recipe rather than replacing them. Where a recommendation below would change
> the literal wording of an `/AGENTS.md` invariant, or reopen `FAMILY_HUB.md`
> §3's "real money" non-goal, that change is NOT authorized by this file alone
> — it needs explicit owner sign-off, applied to `/AGENTS.md` **and**
> `/CLAUDE.md` in the same commit as the code, per the sync rule.
>
> **Created:** 2026-09-08 · **Language:** English, per `/AGENTS.md` §1.0 #4.
>
> **What this file is.** Originally a product design; §5-§11 (Waves 0-2) were
> built and verified the same day, 2026-09-08 — see §0 and §14 for what's real
> versus what's still a proposal. It is built on two things read in full in
> the same session it was authored: the shipped `FAMILY_HUB.md` foundation (`wallet_ledger`,
> Save/Spend/Share, `savings_goals`, `redemption_catalog`, `guardian_links`) and
> a competitive/regulatory research brief — *Banca Digital: a Family Banking
> Strategy Brief* — covering Greenlight, GoHenry, Step, Chase First Banking,
> Copper, BusyKid, Revolut Kids & Teens, Nubank/Banco Inter/C6 Bank in Brazil,
> and the 2024 Synapse/Evolve BaaS collapse. That brief's conclusions are cited
> throughout as **[Brief §n]**. Every open decision is listed in §12 and none
> of them is assumed silently.

---

## §0 STATE — read this first, always

| | |
|---|---|
| **Status** | **WAVES 0-2 SHIPPED AND LIVE IN PRODUCTION, 2026-09-09.** A named account + card (freeze, nickname, design), automated allowance with the pending-credit allocate loop, a "Parent-Paid" savings bonus, a spend limit enforced at request time, and the derived statement are all built, verified locally end-to-end against a real Postgres instance (§14), and now deployed: `0081_banca_digital.sql` applied via `tutor-deploy.yml step:migrate` (pre-migration restore point taken automatically), production confirmed at **81/81**, and independently re-verified live — `/health` 200, `GET /api/v1/banca/account` 401 (mounted, not 404), `https://littlefounders.ai/banca` 200 — see `ROADMAP.md`'s migration-handoff paragraph for the full receipt. `family_gifts` (§5.7) is explicitly NOT built. |
| **Depends on** | `FAMILY_HUB.md`, shipped and live in production 2026-09-08 (`wallet_ledger`, `savings_goals`, `redemption_catalog`, `guardian_links`, `kid_task_streaks`) — this design adds a presentation and mechanics layer on top, not a replacement. |
| **Regulatory posture** | Stays entirely at **rung 1 — simulation** of the research brief's ladder [Brief §5]. No real money, no bank partner, no new regulatory surface. Every mechanic below is closed-loop LF Coins, exactly like `FAMILY_HUB.md`'s existing economy — this document changes what the economy *feels like*, never what it *is*. |
| **Next action** | None outstanding for Waves 0-2. `family_gifts` (Wave 3) is the next build increment, not a blocker. |

---

## §1 Vision

`FAMILY_HUB.md` built the loop: a chore becomes LF Coins, LF Coins split across
Save/Spend/Share, Save funds a goal, Spend redeems a privilege. That loop is
real and it is live. What it is not, yet, is a **place** — today the wallet is
three `StatCard`s at the top of a chores dashboard. A family cannot point to
"their bank." There is no account to open, nothing to name, no card to design,
no statement to read at the end of the month, no sense that the money in Save
is *growing* for a reason a kid can see.

Every serious competitor researched — Greenlight, GoHenry, Nubank's Conta para
Menores — sells exactly that feeling, not the ledger underneath it. The
ledger is commodity; the *experience of having a bank* is the product. This
document designs that experience for LittleFounders, using data we already
have and mechanics the research says the entire category converges on
[Brief §2]: a named account, a card the kid can see and freeze, an allowance
that arrives on its own schedule, a spend limit that creates real budgeting
friction, a "Parent-Paid" savings bonus, and a monthly statement.

**The wedge stays what the research found it to be, independently, twice
[Brief §7]: every competitor is a bank bolting on financial-education content
after the fact. We are the reverse.** Banca Digital is not LittleFounders
adding a bank. It is LittleFounders' financial-education platform finally
giving a kid somewhere to *practice* what the courses teach, styled exactly
like the real thing they'll use as an adult — because the entire pedagogical
point evaporates if it looks like a toy.

**Positioning line (for `frontend/scripts/seo/site.mjs` once this ships, per
`/AGENTS.md` §1.15 — not written yet, flagged here so it isn't forgotten):**
*"The only family bank built by educators, not the other way around."*

---

## §2 Non-goals — reaffirmed, and two new ones

`FAMILY_HUB.md` §3's boundary table holds. Restated with the research brief's
citations now behind it, plus two additions this design introduces:

| Cut | Why (now with the research behind it) |
|---|---|
| Real money, bank transfers, a real debit card | Unchanged from `FAMILY_HUB.md` §3. The research brief's whole regulatory ladder [Brief §5] exists to answer "what would it take" — the answer for a company our size is rungs 3-5 (embed a licensed partner, or never touch custody), not something this design reaches for. |
| Device screen-time limits, GPS/geofencing | Unchanged, same reasoning as `FAMILY_HUB.md` §3. |
| Converting LF Coins ↔ XP | Unchanged — the two economies stay separate. |
| **A "card number" that looks real** *(new)* | The displayed account/card number must be **structurally, visibly fake** — not a Luhn-valid 16-digit PAN, not formatted like a real IBAN/CLABE. A kid who screenshots their Banca Digital card and pastes the number into an actual payment field must get an obvious reject, not a coincidence. §5.1 specifies the format. |
| **Any claim of deposit insurance, real interest, or bank-account status** *(new)* | Never "FDIC-insured," never "bank account," never "interest rate" or "APY," anywhere in UI copy, in any of the three locales. This is the single most load-bearing copy rule in this document — see §4's language-discipline callout. It is not a nice-to-have; it is the line the research brief identifies as the exact one Synapse-adjacent products blurred [Brief §4]. |

---

## §3 Information architecture — where this lives

**Decision needed from the owner — D1 in §12.** Recommendation below, and the
rest of this document is drafted against it, the same way `FAMILY_HUB.md`
drafted its schema against its own D1 recommendation before the owner had
ruled.

**Recommendation: a new nav item, `/banca`, role-gated identically to
`/tasks` (`['parent', 'kid']`).** `/tasks` keeps its current job — the
worklist: assign, complete, approve, the redemption catalog editor. `/banca`
becomes the money home: the account, the card, goals in full (not just the
Save `StatCard`), the statement, allowance automation, spend limits. The two
routes cross-link:

- `/tasks`'s existing Save/Spend/Share `StatCard` row gains a "View your
  bank →" link (kid) / "View wallet details →" (parent), rather than
  disappearing — a kid mid-chore should still see the number move without
  leaving the worklist.
- `/banca`'s home shows a small "N tasks awaiting" teaser back to `/tasks`
  when relevant (parent) or "N chores to do" (kid) — the ClassDojo-style
  proactive-visibility idea `FAMILY_HUB.md` §2 already established, applied
  to the reverse direction.

**Why a new nav item and not a tab inside `/tasks`:** the user's own framing
of this initiative — "something that will be of great importance and even a
major draw" — is an information-architecture claim, not just a features one.
A feature buried as a tab inside a chores dashboard cannot be the platform's
banking story; a nav item with its own icon can. This mirrors the exact shape
`family` and `tasks` already sit at (§1.5's service map lists four product
sections; this becomes a fifth, gated the same way `tasks` is).

**Why not fold the wallet out of `/tasks` entirely:** `/tasks`'s existing
Dashboard-content recipe [DESIGN.md → *Screen Recipes* → Tasks] already
treats the wallet as the anchor a kid sees before deciding what to do next.
Removing it there in favor of a click-through would cost the one thing that
recipe was built to fix — "what needs my attention" in one glance. Keeping a
compact echo in both places, in sync because both read the same
`wallet_ledger`, costs nothing and loses nothing.

### §3.1 Role applicability — all six roles, per `/AGENTS.md` §1.4's own matrix shape

| Capability | universal | parent | kid | bigfounder | admin | superadmin |
|---|---|---|---|---|---|---|
| See the `/banca` nav item | — | ✅ | ✅ | — | — | — |
| Open a kid's account | — | ✅ | — | — | — | — |
| Use own account/card/statement | — | — | ✅ | — | — | — |
| View a kid's account (as guardian) | — | ✅ *(any verified guardian, no hierarchy)* | — | — | — | — |
| Configure allowance / spend limit / savings bonus | — | ✅ | — | — | — | — |
| Freeze/unfreeze the card | — | ✅ | ✅ *(their own)* | — | — | — |
| Request a redemption / family gift | — | — | ✅ | — | — | — |
| Approve/deny a redemption / gift | — | ✅ | — | — | — | — |
| See aggregate adoption metrics (never a specific kid's ledger) | — | — | — | — | ✅ | ✅ |

**Every `—` here is a boundary, not an omission left to fill in later:**

- **`universal`** — has no verified family yet, so there is no kid to attach
  an account to. The only contact is as a prospect: this feature's own
  positioning line (§1, and eventually `site.mjs` per §1.15) is what nudges a
  `universal` signup toward verifying as `parent`.
- **`bigfounder`** — `/AGENTS.md` §1.4's own capability matrix already treats
  this as a verified-adult track entirely separate from the parent↔kid
  relationship ("verified-adult exclusive features (future)"). Every table in
  §5 keys off `guardian_links`, so there is structurally no point of contact
  today — not a gap this document left unaddressed, the same boundary the
  platform already draws elsewhere.
- **`admin` / `superadmin`** — held to the same principle `/AGENTS.md` §1.9
  states for "parent visibility into kid activity": that visibility is a
  **product invariant belonging to a verified guardian**, not an operational
  default for staff. Admin gets adoption counts and totals (accounts opened,
  allowance-automation uptake) through the existing admin-analytics pattern;
  admin does NOT get a specific kid's transaction detail. A audited,
  support-specific exception for troubleshooting a reported bug ("my kid's
  allowance never posted") is a real future need this document does NOT
  design — see D7 in §12, rather than assuming a mechanism that doesn't yet
  exist anywhere else in the platform.

### §3.2 Integration surface — what this plugs into, and what it deliberately doesn't touch

| System | How Banca Digital connects to it |
|---|---|
| `navConfig.ts` | One new `NavItem`, `requiresRole: ['parent', 'kid']` — identical gating shape to `tasks`, zero new permission mechanism |
| `wallet_ledger` / `savings_goals` / `redemption_catalog` | Read and extended in place (§5) — a kid's existing balance carries over the moment an account is opened; this is a presentation layer, never a migration of value |
| `FamilyPage.tsx`'s kid-card summary chips | The existing wallet-total pill (`FAMILY_HUB.md` §7, 2026-09-08) repoints to `/banca` instead of `/tasks` once this ships |
| `events.ts` (the existing notification pipeline) | Extended with new event types (allowance posted, statement ready, spend limit reached) into the SAME weekly digest `FAMILY_HUB.md` §6 step 8 already rides — no new transport |
| i18n | A new `banca.*` key group, same 3-locale-parity discipline as `tasks.*` |
| `DESIGN.md` | Gains a Screen Recipe entry at build time (§7 is written in that exact grammar already, so this is a copy-in, not a re-derivation) |
| `frontend/scripts/seo/site.mjs` | **Not yet touched — required by `/AGENTS.md` §1.15 the moment this ships for real.** If this is meant to be a major draw, that claim has to reach the public `ELEVATOR`/value proposition, not stay inside the authenticated app |
| Admin analytics | Aggregate-only, via the existing admin-console pattern (§3.1) |
| Oracle (the Tutor) | **Deliberately not integrated.** A kid's financial state reaching the Tutor's context would need to clear `/ORACLE.md` §4.1's `.strict()` validation and a new entry in `/LEGAL/AI_TUTOR_LEGAL_REVIEW.md` before it could happen at all — flagged here as a real possible future tie-in (imagine a Tutor line acknowledging a savings goal), explicitly NOT designed, so nobody wires it in casually later |
| Course content (`learn/`) | No integration designed yet. The natural future one — a lesson that teaches Save/Spend/Share linking straight to "try it in your own account" — is left as an idea, not a spec, because it wasn't asked for and deserves its own pass |

---

## §4 Vocabulary & branding — draft, owner sign-off flagged (D2)

| Concept | Draft en-US | Draft es-MX | Draft pt-BR |
|---|---|---|---|
| Product name | Digital Bank *or keep "Banca Digital" as a proper noun in all three, the way "LF Coins" already is* | Banca Digital | Banco Digital |
| The kid's account | "your account" | "tu cuenta" | "sua conta" |
| The card | "your card" | "tu tarjeta" | "seu cartão" |
| Monthly recap | "statement" | "estado de cuenta" | "extrato" |
| Recurring payout | "allowance" | "mesada" | "mesada" |
| Save-bucket bonus | **"Bonus your family pays"** — never "interest" | **"Bono que tu familia te paga"** | **"Bônus que sua família paga"** |

**The bonus line is the one non-negotiable translation in this table.** It is
the exact phrasing pattern the research found Greenlight uses for the same
reason [Brief §2 item 5] — the parent funds the bonus, not a bank, and saying
so in every locale is what keeps this a game mechanic rather than an
unlicensed deposit product.

**Language-discipline checklist — applies to every string this feature ever
ships, in all three locales, forever:**

- ❌ "bank account" → ✅ "account" (bank is implied by the product name, never
  asserted about the account itself)
- ❌ "interest," "APY," "rate of return" → ✅ "bonus," "what your family adds"
- ❌ "FDIC-insured," "protected deposits," "your money is safe with us" → ✅
  nothing — say nothing about insurance, because there is nothing to insure
- ❌ "transfer to your bank" / "withdraw" → this action does not exist and no
  button may imply it does

---

## §5 Data model

All new, additive to `FAMILY_HUB.md`'s `0074`-`0080`. Migration numbers below
are illustrative (next real number assigned at build time, per
`/AGENTS.md` §7's migration workflow) — drafted starting at `0081` as a
placeholder sequence, not a claim about what else may land first.

### §5.1 `banca_accounts` — one row per kid, created at onboarding

```sql
CREATE TABLE public.banca_accounts (
    kid_user_id  uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
    nickname     text NOT NULL DEFAULT 'My Account' CHECK (char_length(nickname) BETWEEN 1 AND 40),
    -- Closed vocabulary, never free-text — same discipline savings_goals.icon
    -- already applies (FAMILY_HUB.md §5.2's own §9 PII note).
    card_design  text NOT NULL DEFAULT 'indigo' CHECK (card_design IN
                    ('indigo', 'emerald', 'violet', 'amber', 'sunrise', 'ocean')),
    -- Server-generated at INSERT, format 'LF-####-####' — deliberately NOT
    -- 16 digits and NOT Luhn-valid (§2's new non-goal: must fail obviously
    -- if ever typed into a real payment field).
    display_number text NOT NULL,
    frozen       boolean NOT NULL DEFAULT false,
    frozen_by    uuid REFERENCES auth.users (id),   -- who froze it: the kid themself, or a guardian
    frozen_at    timestamptz,
    opened_by    uuid NOT NULL REFERENCES auth.users (id),  -- the verified guardian who opened it
    opened_at    timestamptz NOT NULL DEFAULT now()
);
-- INSERT: a verified guardian of kid_user_id, once (PK prevents a second
-- account). UPDATE (nickname, card_design, frozen): the kid themself OR any
-- verified guardian — same "either can act" shape /AGENTS.md §1.3 already
-- establishes for a kid's multiple parents. SELECT: the kid + their verified
-- guardians, same as every table in this feature.
```

*A kid has exactly one account. This is deliberate — a "second account" adds
a whole reconciliation surface (which one does a chore credit?) for a feature
whose entire pedagogical value is Save/Spend/Share staying one clear picture,
never a portfolio.*

### §5.2 `wallet_ledger.reason` — two new values

```sql
ALTER TABLE public.wallet_ledger DROP CONSTRAINT wallet_ledger_reason_check;
ALTER TABLE public.wallet_ledger ADD CONSTRAINT wallet_ledger_reason_check
    CHECK (reason IN (
        'task_approved', 'goal_withdrawal', 'redemption', 'manual_adjustment',
        'allowance', 'savings_bonus', 'family_gift_received'   -- new
    ));
```

Every new money-in mechanic below is a row in the SAME append-only ledger
`FAMILY_HUB.md` already built — no parallel ledger, no second source of
truth. This is the one architectural discipline this whole document treats
as load-bearing: the research brief's central lesson from the Synapse
collapse is that a SECOND ledger that can drift from the first is what
breaks trust [Brief §4]. We only ever have one.

### §5.3 `allowance_rules` — recurring, chore-independent payouts

```sql
CREATE TABLE public.allowance_rules (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    kid_user_id   uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    parent_user_id uuid NOT NULL REFERENCES auth.users (id),
    amount        integer NOT NULL CHECK (amount > 0 AND amount <= 1000),
    frequency     text NOT NULL CHECK (frequency IN ('weekly', 'biweekly', 'monthly')),
    anchor_day    integer NOT NULL,   -- 0-6 (Sun-Sat) for weekly/biweekly, 1-28 for monthly
    active        boolean NOT NULL DEFAULT true,
    next_run_at   timestamptz NOT NULL,
    created_at    timestamptz NOT NULL DEFAULT now()
);
-- INSERT/UPDATE: a verified guardian of kid_user_id only — an allowance is a
-- parental commitment, never kid-editable, the one config table in this
-- document where that's true without exception.
```

A scheduled job (same shape as `services/streak.ts`'s pure day-math, no new
infrastructure) finds rules where `next_run_at <= now()`, writes ONE
`wallet_ledger` row per rule with `reason = 'allowance'` and
`bucket = null`-equivalent — in practice this needs the SAME
"unallocated credit, kid splits it" shape `tasks.allocated` already uses, so
§5.6 generalizes that pattern rather than special-casing allowance.

### §5.4 `savings_bonus_rules` — the "Parent-Paid Bonus" mechanic

```sql
CREATE TABLE public.savings_bonus_rules (
    kid_user_id   uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
    parent_user_id uuid NOT NULL REFERENCES auth.users (id),
    rate_bp       integer NOT NULL CHECK (rate_bp BETWEEN 0 AND 2000),  -- basis points, 0-20%
    active        boolean NOT NULL DEFAULT true,
    next_run_at   timestamptz NOT NULL,
    created_at    timestamptz NOT NULL DEFAULT now()
);
```

Runs weekly, computed server-side against the kid's CURRENT `save` bucket
balance at run time: `floor(save_balance * rate_bp / 10000)`, minimum payout
0 (no bonus is owed on an empty jar, and a fractional result truncates rather
than rounds up — LF Coins have no fractional units, matching
`learning_stats.xp`'s own integer-only discipline). Credits directly to the
`save` bucket, `reason = 'savings_bonus'` — this is the one money-in event
that skips the Save/Spend/Share allocate step, because it IS the Save bucket
by definition; making a kid re-decide where their own savings bonus goes
would be a UX tax with no pedagogical payoff.

### §5.5 `spend_limits` — the parental-control simulation

```sql
CREATE TABLE public.spend_limits (
    kid_user_id  uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
    parent_user_id uuid NOT NULL REFERENCES auth.users (id),
    period       text NOT NULL CHECK (period IN ('weekly', 'monthly')),
    cap          integer NOT NULL CHECK (cap > 0),
    active       boolean NOT NULL DEFAULT true,
    created_at   timestamptz NOT NULL DEFAULT now()
);
```

Enforced at **redemption REQUEST time** (`POST /tasks/redemptions`, unchanged
route — see §8), not at approval: the sum of `wallet_ledger` rows this period
where `bucket = 'spend'` and `reason = 'redemption'` (negative amounts) must
not push past `-cap`, or the request is rejected server-side with a
`SPEND_LIMIT_REACHED` error code before it ever reaches the parent's queue.
This is deliberate — a limit a kid discovers only after a parent says no
teaches nothing; a limit the kid hits themselves, immediately, with a clear
reason, is the actual budgeting lesson every competitor's spend-cap feature
is selling [Brief §2 item 6]. A parent can still manually credit around it
via `manual_adjustment` (unchanged mechanism) — the limit shapes behavior, it
does not lock money away from a parent's own judgment call.

### §5.6 Generalizing "unallocated credit" beyond tasks

`tasks.allocated` (boolean) is currently how the kid UI knows a task's reward
still needs a Save/Spend/Share split. Allowance needs the identical shape
without a task row to hang it off. Cleanest fix, additive:

```sql
ALTER TABLE public.wallet_ledger
    ADD COLUMN allocated boolean NOT NULL DEFAULT true;
-- Existing rows backfill true (already-allocated history is not retroactively
-- reopened). A NEW row is inserted with allocated = false ONLY for
-- reason IN ('task_approved', 'allowance', 'family_gift_received') — the
-- three "kid must decide where this goes" events. 'savings_bonus' inserts
-- already-true (§5.4). 'redemption'/'manual_adjustment' are debits, never
-- awaiting allocation.
```

`GET /tasks/wallet/pending-allocation` (renamed/generalized from the
task-specific `toAllocate` filter the frontend currently derives client-side
from `tasks.allocated`) becomes the ONE place the kid checks "what do I still
need to split," across every source of income, present and future. The
existing `AllocateCard` component (`KidTaskBoard.tsx`) needs no visual
change — only its data source widens from "an approved task" to "any
unallocated ledger row," carrying a source label (`task_approved` →
"You earned {title}", `allowance` → "Your allowance arrived", 
`family_gift_received` → "{sibling} sent you a gift").

### §5.7 `family_gifts` — Wave 3, the Share bucket's real mechanic

`FAMILY_HUB.md` §3/D4 left Share "tracked-only," deliberately, rather than
built half-way. This is where it becomes real — still entirely inside one
family, never real money, never leaving `guardian_links`' own graph:

```sql
CREATE TABLE public.family_gifts (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    from_kid_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    to_kid_user_id   uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    amount          integer NOT NULL CHECK (amount > 0),
    note            text CHECK (note IS NULL OR char_length(note) <= 140),
    status          text NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'approved', 'denied')),
    created_at      timestamptz NOT NULL DEFAULT now(),
    decided_at      timestamptz,
    decided_by      uuid REFERENCES auth.users (id),
    CHECK (from_kid_user_id <> to_kid_user_id)
);
-- INSERT: the sending kid, and ONLY where a server-side check confirms
-- from/to share at least one verified guardian in common (a sibling check,
-- derived from guardian_links, never a client-asserted relationship).
-- Decision (approve/deny): any verified guardian common to both kids.
```

On approval: one ledger DEBIT on the sender (`bucket = 'share'`,
`reason = 'family_gift_sent'` — an eighth `wallet_ledger.reason` value, or
folded into `redemption`'s shape; §12 D5 leaves this open) and one ledger
CREDIT on the recipient (`allocated = false`, `reason = 'family_gift_received'`
— already in §5.2's set), written atomically inside one request exactly like
`allocate_task_reward`'s existing DB function pattern.

---

## §6 Core flows, end to end

### §6.1 Opening the account (onboarding)

1. A parent who has never used Banca Digital for a given kid sees an "Open
   {kid}'s account" card on `/banca` instead of the account view.
2. Parent picks a nickname and a card design (six closed options, §5.1) — the
   kid can change either later themselves, so this is a starting point, not
   a permanent parental choice.
3. `POST /banca/accounts` creates the row, generates `display_number`
   server-side.
4. The KID sees a one-time "welcome" moment next time they open `/banca` —
   the account card animates in with `.lf-land` (§7's reward-arrival motion,
   already in the design system, not a new one), any existing Save/Spend/Share
   balance from `FAMILY_HUB.md`'s prior life is already sitting in it (this
   is a re-skin, not a reset — a kid who already has 340 coins does not open
   a new account at zero).

### §6.2 Auto-allowance

1. Parent sets an amount + frequency on `/banca`'s control panel
   (§7.5) — `POST /banca/allowance-rules`.
2. On schedule, the job (§5.3) writes an unallocated `wallet_ledger` credit.
3. Kid sees it in the SAME "you have something to allocate" surface tasks
   already use (§5.6) — "Your allowance arrived! Split it up."
4. Parent gets a digest line, not a push per-payout (`FAMILY_HUB.md` §6 step
   8's existing weekly digest gains one more fact, no new transport).

### §6.3 Hitting a spend limit

1. Kid taps "Request" on a redemption-catalog item.
2. Server checks §5.5's cap. If exceeded: `SPEND_LIMIT_REACHED`, and the UI
   shows the limit, what's been spent this period, and when it resets — never
   just "no."
3. Kid can still ask in person, or wait; parent can raise the cap or grant a
   one-off `manual_adjustment` from the control panel with the reason
   pre-filled ("Exception for {item}").

### §6.4 The savings bonus

1. Parent turns it on, sets a rate (a slider capped at 20%, §5.4).
2. Weekly, the bonus posts directly to Save, captioned in the ledger as
   *"Bonus your family added"* — never framed as the account earning it.
3. Reaching a `savings_goals` target still fires the EXISTING badge mechanic
   (`FAMILY_HUB.md` §6 step 5, Depot compositor) — the bonus is a faster path
   there, not a new destination.

### §6.5 The statement

1. On the first of each month, a derived (never stored) aggregation over the
   prior month's `wallet_ledger` rows: total earned, by source (chores /
   allowance / bonus / gifts); total spent, by catalog item; ending balance
   per bucket; goals progress delta.
2. Parent + kid both get a digest notification: "{kid}'s {month} statement is
   ready."
3. The screen (§7.4) is read-only, one month at a time, `Intl.DateTimeFormat`
   month navigation — no export/PDF in Wave 1 (flagged as a possible Wave 4
   addition, not designed here since nothing in the research suggests it's
   load-bearing for a kid audience).

### §6.6 Freezing the card

1. Either the kid or a guardian can freeze from `/banca`'s account header —
   a single toggle, `.lf-switch` (§7's existing component, not a new one).
2. Frozen blocks NEW redemption requests only — chores, allowance, and the
   savings bonus keep running; freezing your OWN spending is a self-control
   practice, not a punishment that also stops your allowance from arriving.
3. A frozen card shows why and who froze it ("Frozen by Mom" / "You froze
   this") — never silent, matching the MicOrb precedent [DESIGN.md
   → *Components*] that an unavailable control must say why, not just refuse.

### §6.7 A family gift (Wave 3)

1. From the Share `StatCard`, a kid picks a sibling (only kids sharing a
   guardian appear — never a cross-family list) and an amount up to their
   Share balance, with an optional 140-character note.
2. `POST /banca/gifts` — status `requested`.
3. A common guardian approves or denies from the control panel, same visual
   shape as a redemption decision.
4. On approval: sender's Share balance debits immediately; recipient gets an
   unallocated credit (§5.6) and splits it themselves — a gift is income
   like any other, taught the same way.

---

## §7 UI/UX — screen recipes

Written to the exact grammar `DESIGN.md` → *Screen Recipes* already uses, so
this reads as an entry that could be pasted into that file once built (per
`/AGENTS.md` §8's stewardship table — a new UI change belongs in `DESIGN.md`
in the same commit as the code). Per `/AGENTS.md` §1.11, every screen below
ships verified at ~375px and ~1280px before being called done; every string
exists in all three locales in the same commit.

### §7.1 `/banca` — kid view, "your account"

Uses the **Dashboard content** 2-column shape `FAMILY_HUB.md`'s Tasks recipe
already established (`grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-6`)
— the wide column is the account's own story, the 360px column is what the
money is FOR.

- **Header band**: the account card — `rounded-lg` `hero`-density `Card`,
  the kid's chosen `card_design` as a soft gradient fill (six closed presets,
  §5.1, each a pairing of two existing semantic tokens — `indigo` =
  `primary`→`accent`, `emerald` = `success`→`success-strong`, etc., never a
  new hex), the masked `display_number`, nickname, and a freeze `.lf-switch`
  top-right. This is the ONE place in the product that gets to look like a
  literal debit card, because it is the thesis of the whole feature.
- **Wallet row**: the same fixed 3-column Save/Spend/Share `StatCard` row
  `FAMILY_HUB.md` already built (`success`/`primary`/`delight`), now the
  MAIN wallet reference rather than an echo — `/tasks`'s copy links here.
- **Main column**: goals, promoted from the 360px secondary slot they
  currently occupy on `/tasks` to first-class citizens here — the existing
  goal list + `AddGoalCard`, unchanged components, just given the room
  `FAMILY_HUB.md` §7 already flagged Save's real home should eventually be.
- **Secondary column**: a compact "This month" statement teaser (3 numbers:
  earned / spent / saved, `lf-number` tabular, linking to §7.4's full
  statement), the activity ledger (`FAMILY_HUB.md`'s existing receipt list,
  moved here verbatim), and — once active — the spend-limit meter (a
  `ProgressBar` toward the cap, `warning` tone past 80%).
- **Empty state** (no account yet): a centered `hero` Card, one line from a
  character, one indigo "Ask a parent to open your account" — never a form
  the kid can fill out themselves; opening the account is a parent action
  (§6.1).

### §7.2 `/banca` — parent view, "the control panel"

Same 2-column Dashboard shape, **decisions due** in the wide column,
**what they're in service of** in the 360px one — the identical principle
`FAMILY_HUB.md`'s Tasks recipe states for its own two roles.

- **Header band**: one row per kid (families with more than one), each a
  compact version of §7.1's card — nickname, balance total, frozen state —
  tappable to switch which kid's control panel is showing below. Single-kid
  families skip the switcher entirely (no UI for a choice that isn't one).
- **Main column, tabs-as-sections (not a tab switcher — this app's own
  standing rule against tab UI, `DESIGN.md` → *Screen Recipes* → Followers)**:
  Allowance automation (§7.5), Spend limit (§7.6), Savings bonus rate — three
  `.lf-config-row`-built forms (§DESIGN.md's *component set*, not new
  markup), each a toggle + the relevant fields, collapsed to a summary line
  when inactive.
- **Secondary column**: pending decisions — redemption requests, gift
  requests (Wave 3) — reusing `ParentTaskBoard.tsx`'s existing approve/deny
  row pattern verbatim, just fed from `/banca`'s own data.

### §7.3 Card / freeze detail

Not a separate route — a `.lf-config-dialog` (§DESIGN.md's closed modal
shell) opened from either home's header card. Contents: the full-size card
render, the freeze switch with its "who froze it, when" caption, and the
nickname/design editor (kid-editable per §5.1). Closing it is the only exit;
no destructive action lives here (freezing is fully reversible, so it never
needs `ConfirmButton`'s confirm-step pattern).

### §7.4 Statement

A focused single column (`max-w-2xl`, the Auth recipe's own reading width —
this is a document to read, not a dashboard to scan), month-by-month via a
back/forward chevron pair around an `Intl.DateTimeFormat` month label. Three
`StatCard`s (earned / spent / saved that month) then a grouped activity list
(same row component as the ledger elsewhere, grouped by week with a
`lf-eyebrow` date divider). No numbers on this screen are stored — every
render re-aggregates `wallet_ledger`, so a correction to history (a reversed
`manual_adjustment`, say) is reflected the moment it's queried, never a
stale snapshot.

### §7.5 Allowance automation setup

One `.lf-config-row` block: amount (`Field`, `type="number"`, capped per
§5.3's `CHECK`), frequency (`Dropdown`, three options), a day picker that
only shows the field relevant to the chosen frequency (weekly/biweekly show
a day-of-week `Dropdown`, monthly shows a day-of-month `Field`) — never all
three at once, the same "answer what's actually being asked" discipline
`/AGENTS.md` §1.14 states for a lesson-engine control that reveals a new
question. A `.lf-switch` toggles the whole rule active/inactive without
deleting the configured amount, so a paused allowance is one tap to resume.

### §7.6 Spend limit setup

One `.lf-config-row`: period (`Dropdown`, weekly/monthly), cap (`Field`),
`.lf-switch` for active. Directly below it, read-only: "{kid} has spent
{X} of {cap} this {period}" with a `ProgressBar`, so a parent sets the
number while looking at the number it will be judged against — never a form
divorced from the data it configures.

### §7.7 Family gift (Wave 3)

A `.lf-config-dialog` from the Share `StatCard`: a sibling picker (avatar +
name, only guardian-verified siblings), an amount `Field` capped at the
current Share balance, an optional note `Field` (140 chars, counter shown).
Submission returns to the account view with the pending gift visible in the
activity list as `requested`, same visual grammar a redemption request
already uses.

---

## §8 API routes — `/api/v1/banca/*`

Mounted the same way `tasks.ts` is: `requireAuth` at the router,
`requireRole(['parent', 'kid'])` or a narrower per-route role, envelope
response, Zod validation at the edge, per `/AGENTS.md` §1.6.

| Route | Method | Role | Purpose |
|---|---|---|---|
| `/banca/accounts/:kidId` | `POST` | parent | Open the account (§6.1) |
| `/banca/accounts/:kidId` | `GET` | both | Account header (nickname, design, number, frozen) |
| `/banca/accounts/:kidId` | `PATCH` | both | Nickname, card design |
| `/banca/accounts/:kidId/freeze` | `POST` | both | Toggle frozen |
| `/banca/allowance-rules/:kidId` | `GET`/`PUT` | parent | Read/set the allowance rule |
| `/banca/spend-limits/:kidId` | `GET`/`PUT` | parent | Read/set the spend limit |
| `/banca/savings-bonus/:kidId` | `GET`/`PUT` | parent | Read/set the bonus rate |
| `/banca/wallet/pending-allocation` | `GET` | kid | The generalized §5.6 queue |
| `/banca/wallet/allocate/:ledgerId` | `POST` | kid | Split an unallocated credit (any source) |
| `/banca/statements/:kidId?month=YYYY-MM` | `GET` | both | §7.4's derived aggregation |
| `/banca/gifts` | `POST` | kid | Request a family gift (Wave 3) |
| `/banca/gifts/:id/decide` | `POST` | parent | Approve/deny (Wave 3) |

`POST /tasks/redemptions` (existing route, unchanged path) gains the §5.5
spend-limit check server-side — the one existing endpoint this design
modifies rather than adds to, and it is called out explicitly here so the
change doesn't get lost inside a "new routes only" reading of this table.

---

## §9 i18n

A new `banca` key group, structured like `tasks`'s existing group
(`banca.kid.*`, `banca.parent.*`, `banca.common.*`), added to `en-US` first
and mirrored to `es-MX`/`pt-BR` in the same commit, per `/AGENTS.md` §1.8.
The language-discipline checklist in §4 applies to every key in this group
without exception — `i18n:check`'s hardcoded-string scan catches a literal
string in a component, but nothing automated catches "APY" smuggled into a
translated value, so this is a manual review gate at PR time, called out
explicitly because it's the one thing in this document a script cannot
enforce.

---

## §10 Invariants checklist

- [ ] Every new table's `SELECT` RLS matches `wallet_ledger`'s existing shape:
      the kid themself + their verified guardians, never wider.
- [ ] Every server-computed amount (allowance, bonus, gift transfer) is
      written by a DB function or service-role code path — never a
      client-asserted number, the same discipline `allocate_task_reward`
      already established and `/AGENTS.md` §1.14 states as a general rule.
- [ ] `display_number` (§5.1) is verified, by a test, to fail Luhn validation
      and to not match any real card-number length/format — a regression
      here is a safety defect, not a cosmetic one.
- [ ] No string anywhere in this feature, in any locale, uses "FDIC-insured,"
      "bank account," "interest," "APY," or implies a withdrawal/transfer to
      a real external bank — §4's checklist, gated at PR review since no
      script catches translated copy.
- [ ] `spend_limits` enforcement happens at request time (§5.5), not only at
      approval — a limit surfaced after the fact teaches nothing.
- [ ] `family_gifts` (§5.7) can only be created between kids who share at
      least one verified guardian, checked server-side against
      `guardian_links` — never a client-supplied relationship claim.
- [ ] The statement (§7.4) is computed on read, never stored — one source of
      truth stays one source of truth, the whole point of §5.2's framing.
- [ ] Every screen in §7 verified at ~375px and ~1280px, screenshotted,
      before being called done (`/AGENTS.md` §1.11).

---

## §11 Phased build plan

| Wave | Ships | Depends on |
|---|---|---|
| **0** | Schema (§5.1, §5.2, §5.6) + `GET/PATCH /banca/accounts`, the account-opening flow, `/banca` nav item and the kid/parent home screens (§7.1, §7.2) reading EXISTING `FAMILY_HUB.md` data through the new presentation — no new mechanics yet, just the place | Owner sign-off on D1 (IA), D2 (naming) |
| **1** | Allowance automation (§5.3, §7.5) + the generalized unallocated-credit queue (§5.6) | Wave 0 |
| **2** | Savings bonus (§5.4) + spend limits (§5.5, §7.6) + card freeze (§7.3) | Wave 0 |
| **3** | Statement (§7.4, derived-only, no new storage) + family gifts (§5.7, §7.7) | Wave 1 (statement needs allowance in the aggregation to be meaningful; gifts need the account to exist) |
| **4 (not designed here)** | Anything from the research brief's rungs 2-5 — closed-loop stored value, an embedded partner, real custody | A SEPARATE owner decision, tracked as the research brief's own D1/D2, not this document's |

---

## §12 Open decisions

| # | Question | Recommendation (this document is drafted against it) |
|---|---|---|
| **D1** | Own nav item (`/banca`) vs. a tab inside `/tasks`? | **Own nav item** — §3's full reasoning. **BUILT 2026-09-08** as recommended. |
| **D2** | Product name across locales — "Banca Digital" as a proper noun everywhere (like "LF Coins"), or a translated name per locale? | Lean toward the proper-noun path for brand consistency across a family that may mix languages, but this is a branding call, not an engineering one — same footing `FAMILY_HUB.md` §4 gave LF Coins' own naming. **BUILT 2026-09-08** as the proper-noun path, in all three locales — still an owner call to revisit, not closed by having shipped. |
| **D3** | Does a specific existing character (Dina/Liruf/Dr. Rho/Zara Vex) host the onboarding moment (§6.1) as "the family's banker," or does onboarding stay character-neutral? | No recommendation — this is a narrative-casting choice for whoever owns character voice, flagged so it doesn't get decided by whoever happens to build §6.1 first. |
| **D4** | Statement export (PDF/share) — Wave 4 addition or explicitly out of scope? | Out of scope for now (§6.5) — nothing in the competitive research suggests a kid audience needs a downloadable statement; revisit if real usage says otherwise. |
| **D5** | `family_gifts`' sender-side debit — a new `wallet_ledger.reason` value (`family_gift_sent`), or reuse `redemption`'s shape since both are Spend/Share-side debits? | Lean new value for query clarity (a statement wants to say "gift sent," not "redeemed"), but this is a schema-taste call worth a second look at Wave 3 build time, not now. |
| **D6** | Should `/banca` exist for a kid with NO guardian-approved account yet, showing an empty "ask a parent" state (§7.1), or should the nav item itself stay hidden until an account exists? | Lean toward showing the empty state — a locked/hidden nav item teaches a kid the feature doesn't exist for them; an empty state with one clear next step is the same pattern `navConfig.ts`'s own `requiresRole` already uses for a locked-but-visible item. **BUILT 2026-09-08** as recommended — no CTA button in the empty state (§14 revises this out of the original mockup: nothing for a kid to actually submit there). |
| **D7** | Does `admin`/`superadmin` ever get a support-specific, audited path to inspect ONE kid's ledger for troubleshooting (e.g. "my kid's allowance never posted"), or does support stay limited to what a parent can already see and screenshot? | No recommendation — §3.1 holds the line that admin visibility defaults to aggregate-only, on the same footing `/AGENTS.md` §1.9 gives parent visibility as a guardian-only invariant. If a support path is ever needed, it should be its own audited, logged exception (mirroring the discipline `/AGENTS.md` §1.5 already applies to every other internal-access exception), not a quiet admin query added under deadline pressure. |

---

## §13 Relationship to the research brief

This document stays entirely inside the research brief's **rung 1** (§0's
table, above) — nothing here creates money-transmitter exposure, touches a
BaaS provider, or claims deposit insurance. The brief's own open decisions
(real money ever, which market first, how far the "real bank" simulation
goes visually) are answered, in part, by this document's existence: §7.1's
account card, §4's vocabulary, and §6's flows ARE the answer to the brief's
own D3 ("how far does the simulation go, visually and verbally") — as far as
a real bank's UX, with none of a real bank's claims. The brief's D1/D2 (real
money, ever; which market first) remain open and are NOT reopened by
anything in this document.

---

## §14 Round 1 build closure (2026-09-08)

Waves 0-2 went from this design to a working, tested, live-verified feature
in one session. What actually shipped, where it diverged from the plan above,
and what live browser verification caught that no other gate would have.

### §14.1 What's real

Migration `0081_banca_digital.sql`: `banca_accounts`, `pending_credits`,
`allowance_rules`, `savings_bonus_rules`, `spend_limits`, `wallet_ledger`'s
widened reason vocabulary, and the `allocate_pending_credit` /
`run_due_scheduled_credits` functions — applied locally twice (idempotent,
per `/AGENTS.md` §7's own migration workflow). Backend: `routes/banca.ts`
(mounted at `/api/v1/banca`) plus a spend-limit check added to the existing
`POST /tasks/redemptions`. Frontend: `/banca` (nav item, both roles),
`KidBancaHome.tsx`, `ParentBancaControlPanel.tsx`, cross-links from `/tasks`
and `/family`'s kid card. i18n: `banca.*` in all three locales plus
`dashboard.nav.banca` (missed on the first pass — caught by the nav item
literally reading `dashboard.nav.banca` on screen, §14.3). Tests: 32 new
backend tests (`banca.test.ts`) plus 4 new spend-limit cases added to
`tasks.test.ts`; suites green at 996/996 (backend) and 1804/1804 (frontend).

### §14.2 Design revision: §5.6's `wallet_ledger.allocated` never got built

The plan proposed adding an `allocated` boolean directly to `wallet_ledger`.
Building it revealed why the existing system doesn't do that: `bucket` is
`NOT NULL` with a closed 3-value CHECK, and an unallocated credit has, by
definition, no bucket yet. `tasks.allocated` already solves this by keeping
"awaiting a decision" on the SOURCE row and never touching `wallet_ledger`
until the split is chosen. `pending_credits` (§5.6, as actually shipped)
generalizes that same pattern to allowance instead of bending the ledger's
own invariant — one small table, one `allocate_pending_credit` function that
mirrors `allocate_task_reward` exactly. The kid's "you have something to
sort" surface (`KidBancaHome`'s `AllocateCreditCard`) reads from this table
instead of a `wallet_ledger.allocated = false` filter.

### §14.3 Two defects live browser verification caught, that no other gate would have

Both were found and fixed in the SAME session, driving the real UI against a
real Postgres instance as the two seeded test accounts
(`tutor@email.com`/`kid@email.com`, `database/scripts/seed-dev-users.sh`) —
`/AGENTS.md` §1.14's own standing lesson, that a synthetic click or a mocked
fetch proves the code ran, not that a user could reach it.

1. **The nav item's own label was missing.** `navConfig.ts`'s own comment
   says every entry reads `dashboard.nav.<key>` — a SEPARATE i18n namespace
   from the `banca.*` group this feature's content lives in, and easy to
   miss because nothing type-checks a nav key against that namespace. It
   rendered as the literal string `dashboard.nav.banca` in the sidebar and
   the bottom tab bar until the first screenshot. Fixed by adding the key to
   `dashboard.json` in all three locales.
2. **The card-details dialog was reachable, and invisible.** `CardDialog`
   (nickname/design/freeze) used the same `.lf-config-scrim` /
   `.lf-config-dialog` classes `PersonalizeInWorld.tsx` already ships with,
   but WITHOUT that component's `createPortal(..., document.body)` —
   rendered inline inside the normal app-shell tree instead. An ancestor in
   that tree (the page's own enter-transition wrapper) established a CSS
   containing block for `position: fixed`, so the "fixed, centered overlay"
   silently degraded to flowing INSIDE the page: measured live at 1520px
   tall, starting 56px down the page rather than the viewport. On a short
   screen almost the entire dialog rendered off the bottom edge — visible
   only as a sliver of border, easy to read as "nothing happened" rather
   than "it's there, just not on screen." A second, independent issue
   compounded it: even the visible sliver was nearly unreadable, because
   `--lf-surface` (the dialog's own fill) and `--lf-inverse` (the scrim's
   fill) are RGB(13,20,38) and RGB(15,23,42) in dark mode — close enough,
   under the SAME backdrop-blur applied twice, to be indistinguishable.
   Fixed two ways, both scoped to this one component rather than touching
   the shared classes other routes depend on: `createPortal` (the exact
   fix `AdminDialog` already uses, for the exact same reason), plus a
   `max-h-[85vh]` + internal `overflow-y-auto` on the body (so content
   taller than the viewport scrolls instead of pushing the dialog off
   screen) and a `border-2 border-white/25 shadow-2xl` for a contrast
   edge that doesn't depend on the two fills differing.

### §14.4 Verified live, with real numbers, not just "no error shown"

A parent (`tutor@email.com`) opened an account, configured a 10-coin weekly
Friday allowance, a 50-coin weekly spend limit, and a 5% savings bonus — all
three persisted correctly on reload. Forcing `allowance_rules.next_run_at`
and `savings_bonus_rules.next_run_at` into the past and reloading the kid's
`/banca` fired `run_due_scheduled_credits` exactly as designed: an
unallocated "Your allowance arrived!" credit appeared, a Save/Spend/Share
split of 5/3/2 posted correctly to `wallet_ledger` through
`allocate_pending_credit`, and — after manually raising the Save balance to
200 coins and forcing the bonus rule due again — the bonus posted
`floor(200 × 500 / 10000) = 10` exactly, labeled "Bonus your family added,"
never "interest." The statement for the month independently re-aggregated
the same activity to `earned: 215, spent: 0, saved: 210` — matching by hand
arithmetic, not just by the absence of a visible error. Both roles verified
at ~390-500px and ~1280px, per `/AGENTS.md` §1.11.

### §14.5 Scope held, deliberately

`family_gifts` (§5.7, Wave 3) is not built. Building the sibling-transfer
mechanic well needs §12 D5 resolved first and a second cross-kid
authorization surface on top of everything else in this pass — building it
half-verified under the same session would be exactly what `FAMILY_HUB.md`
§3/D4 already refused to do with the Share bucket once ("deliberately
deferred rather than built half-way"). Tracked as the next increment.
