# Family independence levels and decisions (D.17, D.18)

This is the documented rule Appendix H's Definition of Done for D.17 asks for, and the D.18 reason and conversation policy. It describes what the product enforces; it is not a specification. The SPEC (`docs/littlefounders-spec/`) and the owner decision log win when they disagree with it. Every number below is pinned in `docs/operations/BLOCK-D-THRESHOLD-LOG.md`, where a gate keeps the log, Core and the database equal. None of it is presented to families as scientifically proven (Block D Part 4 governance boundary): Appendix G supports gradual, volitional fading and explained decisions, but gives no number for any of them.

Implementation and evidence: `docs/rebuild/sprints/S07-FAMILY-AND-WALLET.md` (S07.5).

## Who the ladder applies to

A **child in a family**: a parent-created child, or a self-registered teen (13 to 17) who linked a verified parent. The level follows the child's age and track record, never their role (owner log §2). A self-registered teen with no parent has no ladder: their personal wallet already has no approval step, and tasks and parent approvals do not exist for them (OD-3 Option B). Adults, guests and staff have no level.

## The three levels

| Level | Name (child's words) | What needs a Tutor's tap | What does not |
|---|---|---|---|
| 1 | Ask first | Every chore and every reward request | Nothing. This is the previous flat model; every child starts here |
| 2 | Small steps | Bonus chores; rewards above the pre-approved amount | Family contributions (D.10) are **self-logged**: approved at once under the level, the Tutor looks afterwards. Rewards up to the Tutor's pre-approved amount (at most 20 coins) are approved and paid at once |
| 3 | Trusted | Chores worth more than 100 coins; rewards above the pre-approved amount | Every chore up to 100 coins is self-logged; a chore that asks for a photo only once the photo is in. Rewards up to the pre-approved amount (at most 100 coins) |

At every level the Tutor's **spending limit** and a **hold** (the freeze) still apply: a pre-approved reward over the limit, or while the account is on hold, is refused. They are the safety boundary Appendix G §4.4 reserves for the parent.

The level in force is also capped by age at the moment of use: if a Tutor changes or removes a birth date, the level and the pre-approved amount fall back to what the age allows, whatever is stored.

## When a child may move up (the eligibility rule)

A level opens only when **all** of its conditions hold. The child and the Tutor both see each condition with the child's own numbers.

| Next level | Age | Track record (last 60 days) | Time on the previous level |
|---|---|---|---|
| 2 | 8 or older | At least 10 requests approved, and at most 1 in 4 not approved | None |
| 3 | 12 or older | At least 20 approved, and at most 1 in 5 not approved | 28 days on Level 2 |

- **Approved**: a Tutor's approval of a chore or a reward, or a self-directed item (self-logged or pre-approved) that no Tutor questioned.
- **Not approved**: a chore sent back, a chore cancelled after the child said it was done, a reward denied, a self-directed item a Tutor questioned. Cancelling a chore the child never marked done is not a denial of anything the child asked for. Hearing "not yet" to a level request never counts: asking to grow is not a failure.
- **Age**: from the birth date. A linked teen without a birth date is at least 13 by their locked age declaration. A parent-created child without a birth date has no known age and cannot move above Level 1 until the Tutor adds one (the conservative default).
- Decisions made before this rule existed are counted too (backfilled, OD-9): no evidence is lost.

Meeting the rule never promotes a child by itself. A Tutor decides (Appendix G §2.5: fading must be a deliberate decision; Beyers et al. 2024: independence granted volitionally works best).

## Who may change a level

| Who | Up | Down | Pre-approved amount |
|---|---|---|---|
| A verified Tutor of the child | Only when the rule above is met | Any time, with a reason code (more practice, let's talk first, not a good fit) and a reason the child reads | Any amount from 0 to the level's cap |
| The child | Never directly. They **ask** for the next level, in their own words if they like; a Tutor grants it (only when the rule is met) or answers "not yet" with a reason | They may step down one level on their own, any time | Never |
| Staff with the `manage_support` grant | Never | After a support review, with a reason the family reads (the product team's rollback) | Lowered with the level only |
| The system | Never | One level, when a Tutor has questioned three self-directed items within 30 days (at most once per 30 days); the child reads why | Lowered with the level only |
| Anyone else, and every other writer | Refused by the database | Refused | Refused |

This is the rollback path of Appendix H's D.17 Definition of Done (d), after the Appendix D demotion precedent: a level is re-testable, never a permanent one-way flag, and corroborated (three questions, not one) before the system acts.

## Every "not yet" has a reason (D.18)

- A chore the child marked done can be **approved**, **sent back** to finish (it returns to open: the visible next step), or **cancelled**. Sending back and cancelling need a reason code (not finished, needs a redo, not a good fit, let's talk first) and a reason.
- A reward request can be approved or **denied**. A denial needs a reason code (save more first, later on a date, not a good fit, let's talk first) and a reason; "later" needs the date to ask again, from tomorrow to 90 days ahead.
- A level request answered "not yet" needs a code (more practice, later on a date, let's talk first) and a reason.
- A self-directed item a Tutor **questions** afterwards needs the same.
- The reason must be specific enough to act on: 12 to 240 characters, at least three different words, and never a brush-off such as "not now", "ahora no" or "agora não" (the full list is in the migration and in `database/scripts/fixtures/denial-reasons.json`). Core and the client check it before sending; the database checks it again for every writer. A structural check cannot judge meaning: the human-scored sample below does.
- The child's own reasoning reaches the Tutor at the moment of decision: a note when marking a chore done, and why they want a reward (a short list a young child can tap, plus an optional note).
- Every decision is one immutable record: the child reads the reason, the date and the outcome on their Tasks page.

## "Talk about it"

- When a child receives three "not yet"s within 14 days, the Tutor sees a "Time to talk" card (at most one every 14 days per child) with a one-line suggestion. The Tutor closes it as "we talked" or "not now".
- The child can ask to talk about any "not yet" they received ("Let's talk"). The Tutor sees it in the same place.
- The card is written by the database when the pattern happens, so no flow can forget it.

## Measured (Appendix H, all Diagnostic)

| Metric | Where | What it reads |
|---|---|---|
| Independence-Tier Progression Rate | `GET /api/v1/admin/family/autonomy-progression` | Of the children who first met the rule for a level, how many reached it within 30 days; and the levels lowered, by who (Tutor, child, staff, system) |
| Repeated-Denial Communication-Nudge Trigger Rate | `GET /api/v1/admin/family/talk-nudges` | The repeated-denial patterns recomputed from the decision record, against the nudges that opened; child asks; talked, dismissed, open |
| Denial-Reason Actionability Rate | `GET /api/v1/admin/family/denial-actionability`, `GET /api/v1/admin/family/denial-reasons/sample`, `POST /api/v1/admin/family/denial-reasons/:id/score` | Staff with `view_analytics` score a random sample of reasons as actionable or not. The sample carries only the reason, its code and an opaque id, and only for children the H.1 analytics gate admits |

The first eligible moment is recorded after every decision and by the nightly insights maintenance sweep (a birthday can open a level without any decision).

## Review

Every threshold here is an Engineering proposal awaiting Product and Safety review, and enters the Block D threshold log's quarterly review. Appendix H Stage 5 (family usability testing: does a denial feel explained, does a new level feel earned) has not been run.
