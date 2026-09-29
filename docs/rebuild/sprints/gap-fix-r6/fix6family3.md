# GAP-FIX-R6 lane record: family (fix6family3)

Branch `codex/spec-fix6family3`. One audited gap, verified real and closed. Status: **implemented and locally verified; not accepted**.

## Gap: the Tutor could not see a child's pockets, coin history or monthly statement

SPEC clauses: OD-3 §2 (the verified parent "manages and sees their children's wallets, tasks and goals"), Law 5 ("Nothing about a child happens out of the parent's sight"), Block D scope (monthly statements), owner answer H-06 (a linked teen keeps self-directed wallet actions with no approval step), D.5 / OD-21 (guardian corrections), Bible 02 §4.3 (pockets: colour, icon and label; the split bar).

### Verified before fixing

- Core serves `GET /tasks/:kidId/wallet`, `GET /tasks/:kidId/wallet/ledger` and `GET /banking/statement/:kidId`, each behind `requireRole(['parent'])` and `guardParentOf`. No file under `frontend/src` called any of them.
- `TutorCoins.tsx` rendered the freeze card, allowance, limit, bonus, corrections and Share slots, but no pocket balance, history or statement.
- `WalletCorrections.tsx` removed coins from a pocket without showing that pocket's balance.
- A linked teen's `self_income`, `personal_reward` and `goal_release` ledger entries are not `family_decisions`, so no Tutor surface showed them.
- The Family console's "Coin card" link went to `/family-wallet` with no `?child=`, so the Wallet opened on the first child.
- Not a gap: the console's approvals link to `/tasks`. The Tutor Tasks board (`TutorTasks.tsx`) lists every child's decisions by name and has no per-child view, so a `?child=` there would do nothing. Left as is.

### Built

- **Core** (`backend/src/routes/banking.ts`): `GET /banking/statement/:kidId` now bounds `month` with `statementMonthAllowed`, the same window as the child's own paging: never after this UTC month and at most 23 months back. Anything else gets a 400 before any read. The Tutor is an adult reader, so the statement keeps its full detail: every line with its reason, and a linked teen's self-directed lines included. The guardian guard is unchanged: 404 for another family, 403 for a child.
- **Client API** (`frontend/src/rebuild/banking/coins/coinsApi.ts`): `fetchChildPockets`, `fetchChildMonth`, `fetchChildHistory` and `monthInWindow`. Each response is shape-checked. The layer refuses a guardian line without its reason, an unknown ledger reason, an impossible month and a non-integer total. `familyHubApi.ts` now shares `isLedgerEntry` and `SELF_DIRECTED_REASONS`, and adds `fetchKidPockets`.
- **Rebuilt UI** (`frontend/src/rebuild/banking/coins/ChildCoinActivity.tsx`, on `/family-wallet?child=`):
  - The child's three pockets, shown with `PocketRow` (pocket art, word and coins) and the `SplitBar`.
  - "Month summary", read when opened: earned, spent, added to Save, shared and Tutor corrections, plus every line of the month with its reason. It pages back through Core's window and never goes past this month.
  - "Recent coins", read when opened: the latest history, 10 lines first, then 20 more at a time.
  - A linked teen's self-directed lines carry a Pill labelled "On their own".
  - The panel sits right after the freeze card. A child with no coin card yet still has pockets, so the panel also appears beside "Open a coin card".
  - The panel re-reads after a correction or goal move on the same screen: `WalletCorrectionsPanel` gets a new `onChanged`, wired in `BankingPage.tsx`.
  - It is built only from shared controls (`Disclosure`, `Pill`, `Button`, `LoadingState`, `InlineNotice`) and token CSS in `money.css`. Every node carries `data-copy-role`.
- **Corrections** (`WalletCorrections.tsx`, `WalletCorrectionsPanel.tsx`): the chosen pocket's coins are shown as "In this pocket now: N". A removal larger than the pocket is stopped with the existing "insufficient" copy before any request; the database still refuses with `INSUFFICIENT_BALANCE`. If the pockets cannot be read, the line is hidden and the form keeps working.
- **Family console** (`FamilyConsole.tsx`): the coin-card link is now `/family-wallet?child=<id>`.
- **Copy**: `rebuild-family:familyCoins` has new keys (title, pockets, month, history, reasons, "on their own") and `familyHub:walletCorrections.pocketNow` is new, in en-US, es-MX and pt-BR. The copy is adult Tutor voice and follows the glossary: coins, Tutor, Wallet. It stays within the D.8 tone gate's scope and is budgeted in `copy-budget/family.test.ts`.
- **Audit states** (`frontend/scripts/audits/lanes/family.mjs`): `/family-wallet@child-coins`, `@child-coins-month` and `@child-coins-history`, on the linked teen (KID_B). They use Core-shaped synthetic reads for the three routes, including `self_income` and `personal_reward` lines.

### Verified (local, lean)

- Backend: `type-check`, `lint`, and `vitest src/__tests__/banking.test.ts` (53 tests). The new tests cover the full-detail month with self-directed lines; this month, 1 month back and 23 months back admitted; next month, 24 months back, `2026-13` and `2026-00` refused; another family 404; a child 403; an extra query parameter 400.
- Frontend: `type-check` and `lint` (whole package). Focused vitest runs covered `ChildCoinActivity.test.tsx` (new, 12 tests), `TutorCoins.test.tsx`, `BankingPage.test.tsx`, `FamilyHubLifecycle.test.tsx`, `FamilyHubLifecyclePanels.test.tsx`, `FamilyConsole.test.tsx`, the family copy-budget, family-hub copy, pocket-identity, goal-progress, wallet-path and audit-coverage tests.
- Root gates: `spec:check`, `secrets:check`, `check-i18n.sh`, `check-family-copy-tone.mjs` (100% pass) and `check-wallet-glossary.mjs`.
- Not run here, by lane rule: browser audits (text fit, proportion, copy budget first view) and full suites. The orchestrator runs them.

### Open

- The three new audit states need the orchestrator's UI audit run (text fit, proportion, copy budget) over the full matrix.
- Human copy review of the new es-MX and pt-BR strings (OD-11) and design review, as for every money surface.
- No owner question: the SPEC's default (read-only Tutor visibility after the fact, no approval step for H-06 entries) is what was built.
