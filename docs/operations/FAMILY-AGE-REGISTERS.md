# Age registers in Family Hub and the Wallet

Requirement D.12 extends B.23's age-band registers to Family Hub and the Wallet. Presentation complexity, numeric framing and explanatory copy are differentiated by age tier, using Block B's three registers: young child, tween-teen transition, teen. D.11's fixed bonus for younger children is named as "a specific instance of this general age-differentiation mandate": the two must be one coherent age-band design.

Owner decision OD-4 binds how: one design system for everyone. Tokens, components, shapes and motion are identical at every age. What varies by age band is copy tone, character presence, reward framing and social mechanics. In this domain that means tone, how numbers are framed, and how much detail a surface shows. Every minor safeguard follows age, never role (OD-3).

## The three registers

| Register | Who | Numbers | Detail | Tone |
|---|---|---|---|---|
| `young` | 6-9, and every child whose age is not known | Whole coins, one number at a time. What is left of a limit, never used-of-cap. The usual split as "5 of 10". No percentage, no ratio | Three month totals. No statement lines | Short, concrete, second person. The 6-9 Copy Budget |
| `transition` | 10-12 (B.23's "graduation" band) | Coins, with "out of 100" scaffolding: the split as "5 of 10, so 50 of 100", the bonus as "1 for every 10 is like 10 for every 100", "20 of your 40", used of the cap over the last 7 days. Still no percentage | Totals, plus what was given and corrected | A little more grown up. The 10-12 budget |
| `teen` | 13-17, a self-registered teen, and an 18-year-old still in a family | Percentages and rates: the pocket shares, the limit used, the goal reached, D.11's rate and worked example | The latest statement lines | Direct and peer-to-peer, never childish praise. The 13-17 budget |

**Why these cutoffs.** Appendix G §1.5:
- denominations are integrated from about 7;
- what a bank does institutionally is understood from about 10-11;
- a percentage of a balance is reachable at 10-12 only with concrete scaffolding;
- only 13-17 can use it as a rate.

**One design with D.11 by construction.** The teen register is *exactly* the children D.11 gives a percentage bonus (`savings_bonus_framing = 'percent'`). The young and transition registers are exactly the per-ten framing.

**Unknown age.** A parent-created child with no birth date reads the young register. This is the most legible one, and the same conservative default D.11 (per ten) and D.17 (Level 1) use. The Tutor adds a birth date to move it.

## Where the register is decided

The **database** decides, from age evidence, never from role and never from the client. `public.family_money_register(uuid)` (migration `family_money_register`) reads:
- the wallet holder kind;
- D.11's framing, which uses the stored birth date and the locked teen declaration;
- the child's age.

It returns `young`, `transition`, `teen`, or NULL for an account that holds no wallet (an adult, a guest, staff). The register moves with a birthday at read time; nothing is stored.

**Core** reads it through a service-role RPC. Two routes serve it:
- `GET /api/v1/banking/register` gives any wallet holder their own register;
- `GET /api/v1/banking/overview` gives the child's coin account, **shaped by the register at the server**. A young reader's answer carries no cap, no used amount, no percentage and no statement lines, so no client can render them.

The Tutor's freeze card (`GET /api/v1/banking/accounts/:kidId/freeze`) names the view the child reads.

**The client** refuses an answer carrying numbers its register is not given (`frontend/src/rebuild/banking/bankingApi.ts`). Until the register is known, and when it cannot be read, a surface is presented in the young register.

## What never varies with the register

- Every control, hold, limit and approval rule is the same at every age. Only its explanation changes.
- The honesty lines (a practice card, coins stay in the app, nothing is lost) appear in every register.
- Goal-progress provenance (D.16) is drawn the same way at every age.
- Celebration stays OD-7's closed list for everyone.

## Surface policy

Every child-facing component in `frontend/src/rebuild/family`, `rebuild/banking` and `rebuild/wallet` declares its policy in `REGISTER_POLICY` (`frontend/src/rebuild/family/moneyRegister.ts`). A test fails when a new component is added without one.

| Policy | Components |
|---|---|
| Presented per register | `CoinAccount` (account, freeze, limit, month: tone, numbers and detail), `UsualSplit`, `GoalProgress`, `SavingsGoals`, `SavingsBonusExplainer` (the transition bridge), `TeenWallet` (always teen) |
| Register-neutral, with the reason recorded | `SplitChooser`, `ChoreStreak`, `ChoreDone`, `DecisionNotes`, `GoalNextStep`, `MyLevel`, `RewardAsk`, `ShareGiving`, `WalletActivity`. None frames a ratio, and each is written to the youngest band's budget, which reads plainly at every age |
| Tutor (adult) surfaces | `TutorFreeze`, `AutonomyLadder`, `ChoreComposer`, `DecisionQueue`, `NotYetForm`, `SavingsBonusSettings`, `ShareDestinations`, `StreakPauses`, `WalletCorrections`, `CoGuardians`, `GuardianInvite`, `BadgeShares` |

## Measured and recalibrated

- The cutoffs (`register.transition_min_age` = 10, `register.teen_min_age` = 13) and the teen's statement lines (8) are in `docs/operations/BLOCK-D-THRESHOLD-LOG.md`. The threshold gate keeps the log, Core and the migration equal.
- Appendix H's threshold review reads two things: the **register distribution** (`GET /api/v1/admin/family/register-distribution`, counts only, analytics staff), and D.11's Age-Tier Bonus Comprehension Proxy.
- A 10-12 group that fails the transition scaffolding argues for a later cutoff, never for showing a percentage below 13.
- Family usability testing (Appendix H Stage 5) of the three registers is still to be run. Does a 7-year-old read "Freezing pauses" and "Nothing is lost"? Does a 15-year-old find the teen register credible? Native copy review of `coinAccount.json` and `moneyRegister.json` is also open.

## Not yet done (recorded, not hidden)

- **The B.23 "graduation" moment around 10-12.** A notice when a child's register changes is B.23's to design (S05 lane). The Family Hub register changes silently on the birthday.
- **Tone variants for the neutral components.** Their copy is short, concrete and written to the 6-9 budget. Whether the teen register should get its own wording for them (for example `MyLevel`) is a proposal for Product review, not built.
