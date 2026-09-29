# No unbacked guarantee (Wallet and Family Hub)

Requirement D.7 (Block D, `docs/littlefounders-spec/product/10-PRODUCT-GOLD-STANDARD-REQUIREMENTS.md`) makes this a standing design principle for the whole surface: **no visual element or copy in the Wallet may imply a guarantee the underlying system does not enforce.** Each control must be re-verified against this principle as it changes, never assumed satisfied once the backend is fixed. Appendix H measures it with the **No-Unbacked-Guarantee Audit** (recurring, human-judged, target zero violations) and runs every family-facing copy change through Stage 4 of its pipeline, which checks for phrasing that implies an unenforced guarantee.

This file is the written principle and its audit procedure. The mechanisms that enforce it are listed at the end. It is not a specification: the SPEC and the owner decision log win when they disagree with it.

## What the principle forbids

A family must never read or see something that promises more than the system does. In practice:

1. **The simulation is always declared.** The account is a *practice card*, and the page says that coins stay in the app. There is never a card number, a chip, a card-network mark, a bank logo, a padlock "secure" badge or anything else drawn to look like a real card or a real bank. Core's rebuilt account contract carries `simulated: true` and no number, and the client refuses an answer that says otherwise.
2. **A control shows only what it enforces.** The freeze card lists the four things the database holds while an account is frozen, and nothing else. The list comes from Core (`FREEZE_HOLDS`), and each entry is pinned to its enforcing SQL. The page says a freeze loses nothing and moves no coins, because both are true.
3. **Nobody is offered an action the system will refuse.** A child is shown "Unfreeze" only for a freeze they set themselves. A Tutor is never shown a bare "Deny": since S07.5 a reward cannot be refused without an actionable reason (D.18), so the Banking page uses the reason-carrying decision queue.
4. **A limit says how and when it is checked.** The spending limit is checked by the database when a reward is asked for, over the last 7 or 30 days. The copy says that. It never says "this week" or "resets", because the window is rolling.
5. **No promise of safety.** No "safe", "secure", "protected", "insured", "guaranteed", "risk-free" or "real money" in any locale. The tone gate enforces the words; this audit judges the meaning.
6. **Age presentation never changes a control.** The age register (D.12) changes tone, numbers and detail. It never hides a hold, softens a limit or changes who may lift a freeze.

## How a new or changed control is admitted

Before a control a family can see ships, it needs an entry in `docs/operations/block-d-controls.json` with:
- a written claim (what the product may say it does);
- at least one enforcement: a file and text, or the name of an SQL function whose **latest** definition must still contain its guard;
- at least one adversarial proof: a test or verifier that attacks it;
- the copy keys that describe it.

A surface marks the element with `data-control="<id>"`. `node agent/tools/check-no-unbacked-guarantee.mjs` (run by `repo-gates.yml` on every push, unfiltered) fails when:
- an enforcement or proof disappears;
- a later migration redefines an enforcing function without its guard;
- Core's or the client's freeze holds differ from the registry;
- a surface declares an unregistered control;
- a copy key is missing in a locale;
- a retired claim (`retiredClaims` in the registry: a promise the product stopped backing) reappears in any string of its namespace, in any locale;
- any package depends on a payment, card-issuing or bank-linking SDK.

## The quarterly audit (human)

Owner: the Pedagogical Lead with the Engineering Lead (Appendix H, Stage 0 pairing), plus one reviewer who did not build the change. Cadence: quarterly, and before any release that adds or changes a control in this domain.

**First human review due: 2027-01-15** (one quarter after the release planned to ship S07.3, as the threshold log). The due date is machine-read (`agent/tools/block-d-review-cadence.mjs`): only a row of kind `human` counts as the review; a row of kind `engineering` records what a lane did and never does. After a human audit the next is due 90 days later. `check-no-unbacked-guarantee.mjs` warns when the audit is overdue and fails with `--strict` (release readiness); `.github/workflows/block-d-reviews-quarterly.yml` opens the quarter's review issue on the first day of each calendar quarter.

Checklist, on the running product in all three locales, light and dark, at 375 and 1280 px:
1. Open the child's Banking page in each age register (young, transition, teen) and the Tutor's Banking page.
2. For every visible control, find its registry entry and read its claim. Then do what the page implies in a real test family: freeze and try to request a reward, split coins, give Share coins, and wait for an allowance; exceed the spending limit; as a child, try to lift a Tutor's freeze. Record whether each claim held.
3. Read every sentence on the pages. Mark any that promises more than step 2 showed.
4. Look for any visual that suggests a real card or bank: a number, a chip, a network mark, or a lock used as a security promise.
5. Record the result below. A violation is fixed before the next release, or the control is removed.

## Audit log

| Date | Kind | Scope | By | Result |
|---|---|---|---|---|
| 2026-09-24 | engineering | Engineering pre-audit at S07.6 of the legacy and rebuilt Banking pages. This is **not** the human audit Appendix H asks for; that is still open. | Engineering (S07 lane) | 8 findings. All fixed in S07.6 except the unrendered legacy `display_number` column, removed in gap-fix round 1 (below) |
| 2026-09-24 | engineering | Engineering lane review at S07.8 of the marketing site's Family Hub claims (`marketing.json`, three locales) against the controls as built in S07.1-S07.7. Also **not** the human audit. | Engineering (S07 lane) | 3 findings, all fixed in S07.8 (below the first list) |

Findings of the 2026-09-24 pre-audit:

1. **The card looked real.** The legacy card showed `LF-####-####` in a monospace, card-number layout on a gradient card, and the Tutor's panel repeated it. *Fixed:* the rebuilt practice card has no number and says the coins stay in the app. Neither page renders the number any more.
   *Closed (2026-09-27, gap-fix round 1, F1-family.3):* Core no longer mints, stores or serves the number: `generateDisplayNumber` is gone, account inserts send no number, the account routes no longer return `displayNumber`, and `banking_accounts.display_number` is made optional (migration `banking_display_number_optional`, expand) and then dropped with the guard and the E.10 reviewed name that named it (migration `banking_display_number_drop`, contract, applied after the Core release that stopped writing it).
2. **The freeze was explained wrongly.** It lived as a switch inside a "Card details" dialog, and its hint said it "Blocks new redemption requests". In fact it holds four things: reward requests and approvals, splits, the scheduled allowance and bonus, and Share gifts. *Fixed:* the rebuilt freeze card lists exactly the holds the database enforces, and the dialog no longer carries the switch.
3. **"A parent/guardian froze this card".** The glossary says the verified parent is the Tutor. *Fixed* in the rebuilt copy and in `errors.json` (`GUARDIAN_FREEZE`) in three locales.
4. **"Your credits stay safe until it is unfrozen"** (`ACCOUNT_FROZEN`). "Safe" is a promise, and "credits" is bank register. *Fixed:* "Your coins wait here until it is unfrozen."
5. **The spending limit implied a calendar reset.** The child read "Weekly spending limit", and the Tutor's form said "Resets: Every week". The database counts a rolling 7 or 30 days, checked when a reward is asked for. *Fixed:*
   - the child reads what is left and "It is checked when you ask for a reward", with "the last 7 days" wherever a number is shown;
   - the Tutor's form says "Counts the last: 7 days / 30 days" and when the limit is checked.
6. **A dead "Deny".** Since S07.5 a denial needs an actionable reason. The Tutor's Banking page still offered a bare "Deny", which the server always refused and which showed no error. *Fixed:* the Banking page mounts the rebuilt decision queue.
7. **"Your own account, card and savings"** in the child's subtitle, and "a named account and a card" in the Tutor's. *Fixed:* "a practice card, pockets and goals", and "a named practice card".
8. **"Wallet" as the section name.** *Renamed by the owner (OD-28, H-16).* The section was first called "Digital Banking"; it is now Wallet / Cartera / Carteira, and the page still states that it is practice with coins that stay in the app. `agent/tools/check-wallet-glossary.mjs` (part of `npm run spec:check`) keeps the old name from coming back.

Findings of the 2026-09-24 S07.8 lane review (the marketing site):

1. **"Spending needs your approval first"** (FAQ, chores) and **"It's waiting for their approval before it's yours"** (Families page). Since S07.5 a Tutor can raise a child to Level 2 or 3, where rewards up to an amount the Tutor sets are pre-approved and chores are self-logged and reviewed afterwards (D.17). The claim promised more control than the product keeps once the Tutor chooses a level. *Fixed:* both now say every child starts with the Tutor approving each chore and reward, and that small ones can go through on their own within limits the Tutor sets. Registered as control `approval`.
2. **"You approve it before it lands"** (Families page, chores). The same promise, for self-logged chores. *Fixed:* the Tutor approves it once it is done, and can let small chores count on their own and check them afterwards.
3. **"You send a few coins toward someone else's goal"** (Families page, Share). No flow ever sent Share coins to another person's goal; since S07.4 they go to a place a Tutor chose, and whoever chose it records what really happened (D.14). *Fixed:* the copy describes that destination. Registered as control `share_destination`.

The three retired phrasings are listed under `retiredClaims`, so the gate fails if any of them comes back in any marketing string. The same review published the D.20 scope statement and the D.21 periods in the marketing FAQ (`notTaught`, `familyRecords`), each pinned by its own gate.

## Enforcing mechanisms (S07.6, extended in S07.8)

| Mechanism | Where |
|---|---|
| Control registry | `docs/operations/block-d-controls.json` |
| Registry gate (CI, unfiltered) | `agent/tools/check-no-unbacked-guarantee.mjs`, self-tests `check-no-unbacked-guarantee.test.mjs` |
| Server contract: simulation declared, no number, holds from `FREEZE_HOLDS` | `backend/src/routes/banking.ts` (`GET /api/v1/banking/overview`, `GET /api/v1/banking/accounts/:kidId/freeze`), `backend/src/services/moneyPresentation.ts` |
| Client refusal of an unbacked answer | `frontend/src/rebuild/banking/bankingApi.ts` |
| Copy gate for guarantee words | `agent/tools/check-family-copy-tone.mjs` (D.8), category `guarantee` |
| Rebuilt surfaces | `frontend/src/rebuild/banking/CoinAccount.tsx`, `TutorFreeze.tsx` |
