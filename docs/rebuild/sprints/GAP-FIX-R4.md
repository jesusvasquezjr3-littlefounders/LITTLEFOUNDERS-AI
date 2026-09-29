# Gap-fix round 4

Lane records for the fourth gap-fix round of the SPEC migration. Each lane
appends its own section. Statuses follow the ledger: implementation, local
verification, acceptance and release are separate, and nothing here is
accepted or released.

## F4-family

Branch `codex/spec-fix4family`. Two audited gaps on the family money
surfaces. Both were checked in the code first and both were real:

- A confirmed coin split showed "Coins added." inside the payout's own slot,
  and the hosts re-read at once, so the payout left `chores.toSplit` /
  `coins.credits`, the slot unmounted and the only confirmation went with it.
  The teen's `/wallet` said only "Added {n} coins.". No test asserted a result.
- The registered pocket icons (`pocket.{save,spend,share}.icon`) were drawn
  only by `PocketRow` on `/tasks`; the split chooser, the usual split, the
  child's coin account and both teen-wallet pocket lists showed a hue swatch
  or tint plus the word, and no split bar existed anywhere.

### What was built

| # | SPEC clause | What was built | Where |
|---|---|---|---|
| 1 | Bible 02 §9.2 (confirm the coin split); mockup K18; OD-7; D.13 | New copy `split.result` ("Done: {save} to Save, {spend} to Spend, {share} to Share.") in EN, es-MX, pt-BR replaces the unused `split.added`; `teenWallet.income.added` becomes `income.result` ("Added {n} coins: {save} to Save, …"). `AllocationPanel` reports the accepted split through `onDone(split, goal)` and then renders nothing for that payout (it never offers the split again, even if the re-read fails). The `split` slots of `ChildTasks` and `ChildCoins` now pass `settled(result)`: the board holds the last result in state and renders it as a live success `InlineNotice` (`data-family-part="split-result"`) at the top of the primary column (Tasks) or right under the coin account and its pockets (family wallet), outside the per-payout slot, so it survives the re-read. `TasksPage` and `BankingPage` format it with `splitResultText` (`routes/app/family/moneyHabitsCopy.ts`). A reached goal still celebrates only on the goals panel, which re-reads (OD-7); the split itself is a status, no confetti, no XP. TeenWallet `submitIncome` states the three placed counts (and the reached goal after it) | `frontend/src/routes/app/tasks/AllocationPanel.tsx`, `TasksPage.tsx`, `routes/app/banking/BankingPage.tsx`, `routes/app/family/moneyHabitsCopy.ts`, `rebuild/family/tasks/ChildTasks.tsx`, `rebuild/banking/coins/ChildCoins.tsx`, `rebuild/wallet/TeenWallet.tsx`, `src/i18n/*/moneyHabits.json`, `src/i18n/*/teenWallet.json` |
| 2 | Bible 02 §4.3 (colour, icon and label at once; the split bar under the pockets beside labelled steppers); 02 §4.4; 07 §1 class B | One pocket identity component, `PocketMark` (the manifest pocket icon at sm 24 / md 32 / lg 48 px, decorative beside the word). Used by `PocketSplit` in every mode (stepper, typed, readonly; it replaces the hue swatch, which rendered empty on the lesson board), `PocketRow` (Tasks), the `CoinAccount` pocket list and its statement lines, both `TeenWallet` pocket lists, and the Share section heading of `ShareGiving`. `SplitBar`: one token-hue segment per pocket sized by its count (flex-grow), an empty pocket hidden, the unplaced rest as a sunken segment, gaps between, no border, `aria-hidden`, a `flex-grow` transition only without reduced motion. `PocketSplit` draws it under the rows by default (`total` = payout coins in the chooser, 10 in the usual split); the lesson allocation board passes `bar={false}` because it draws its own teaching chart; the teen income form draws it under its count fields. The pocket rows on Tasks and the coin account now wrap (02 §7 rule 6) | `frontend/src/rebuild/family/PocketMark.tsx`, `pocketMark.css`, `PocketSplit.tsx`, `SplitChooser.tsx`, `UsualSplit.tsx`, `ShareGiving.tsx`, `moneyHabits.css`, `moneyRegister.ts`, `tasks/taskParts.tsx`, `tasks/money.css`, `rebuild/banking/CoinAccount.tsx`, `coinAccount.css`, `rebuild/wallet/TeenWallet.tsx`, `teenWallet.css`, `rebuild/learning/AllocationBoard.tsx` |
| 3 | Bible 02 §4.3 gate | `pocketIdentityGate.test.ts`: every JSX element marked `data-pocket="…"` in `rebuild/family`, `rebuild/banking` and `rebuild/wallet` must contain `<PocketMark>` (7 elements today). Component tests: PocketSplit marks every pocket in all three modes, draws three segments sized by the counts plus the unplaced rest, and omits the bar with `bar={false}`; TeenWallet draws the live bar and marks every pocket | `frontend/src/rebuild/family/pocketIdentityGate.test.ts`, `PocketSplit.test.tsx`, `rebuild/wallet/TeenWallet.test.tsx` |
| 4 | Result tests; audit states | `SplitResult.test.tsx` wires the real `AllocationPanel` into `ChildTasks` and `ChildCoins` exactly as the routes do: after "Use my split" the re-read removes the payout and the chooser, the status still reads "Done: 5 to Save, 4 to Spend, 1 to Share.", the pockets re-read, and nothing with `data-celebration` renders; the formatter is checked in all three locales. The audit lane gains `/tasks@split-confirmed` and `/family-wallet@split-confirmed` (open the payout, keep the usual split; the synthetic Core answers both allocate routes). The browser journeys `verify-money-habits.mjs` and `verify-teen-wallet.mjs` now wait for the new result lines | `frontend/src/routes/app/tasks/__tests__/SplitResult.test.tsx`, `MoneyHabitsPanels.test.tsx`, `frontend/scripts/audits/lanes/family.mjs`, `scripts/verify-money-habits.mjs`, `scripts/verify-teen-wallet.mjs` |

### Verification (local)

- Frontend `type-check` and `lint` clean.
- Focused vitest (3 workers): SplitResult, MoneyHabitsPanels, PocketSplit,
  pocketIdentityGate, moneyHabitsCopy, teen wallet (component and copy),
  `rebuild/family/tasks`, `rebuild/banking`, MoneyHabits, TasksPage, the
  banking route tests and `rebuild/learning` (the lesson board): all green.
- Real-Chrome audit (`audit-rebuild.mjs all`) on the seven pocket-bearing
  states (`/tasks@child`, `/tasks@split-confirmed`, `/tasks@teen-linked`,
  `/family-wallet@child`, `/family-wallet@split-confirmed`,
  `/family-wallet@teen-linked`, `/wallet@teen`) × 3 locales × 2 themes ×
  320/375 px: text fit 336, proportion 84, copy budget 84 configurations,
  no findings, no JS errors.
- Looked at: `/tasks@split-confirmed` light 375 (the status above the
  chores after the split), `/family-wallet@split-confirmed` dark 320 and 375
  (pocket icons in the coin account; the status under it), and the open
  split chooser dark 320 (icons and the three-segment bar under the rows).
- Root `spec:check` (asset gate included), `secrets:check` and
  `check-i18n.sh` green.

### Remaining

- The full audit matrix at 768/1280 px and the browser journeys
  (`verify-money-habits`, `verify-teen-wallet`) were not run here (speed
  mode; the orchestrator runs the full gates per merge).
- The synthetic Core keeps no state, so in the `split-confirmed` audit
  states the settled payout stays on the board as an empty slot; the real
  re-read removes it (proven by `SplitResult.test.tsx`).
- The pockets asset family still awaits the owner's first-family style
  review (OD-14); human design review.

### Owner questions (conservative defaults implemented)

- Placement of the result status on `/tasks`: Bible 02 §9.2 says the split
  "settles into place" in the pockets, but on the child's Tasks board the
  pockets sit in the secondary column (below everything on a phone). The
  status is shown at the top of the primary column, where the payout was, so
  the child sees it where they pressed; on the family wallet it sits right
  under the pockets. Confirm, or move it into the pockets card.
- The result replaces "Coins added." (EN "Done: …", es-MX "Listo: …", pt-BR
  "Pronto: …"); native copy review of the three lines.
