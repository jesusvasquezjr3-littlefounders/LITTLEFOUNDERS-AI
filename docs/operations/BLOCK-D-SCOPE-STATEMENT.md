# What the Family Hub and Digital Banking practice teaches, and what it does not

**Status:** Product 10 D.20, written by Engineering (S07.7, 2026-09-24). The statement below is what families read; its registry is `docs/operations/block-d-scope.json` and `agent/tools/check-block-d-scope.mjs` keeps them equal. The SPEC and the owner decision log win over this file.

**Why.** Appendix G §3.5: credit and debt behaviour and a real understanding of exponential growth are the concepts financial education most reliably fails to move, or moves the wrong way (the Brazil RCT raised both saving and borrowing, Bruhn et al. 2016). LittleFounders' simulation has no borrowing, no risk or insurance and no true compounding: a defensible scope choice, but only if it is stated, not left as a gap a parent could reasonably assume is covered by "financial literacy" (Law 5: transparency is love).

## The statement

Shown as "What this practice covers" on the Tutor's Family screen and Banking screen and in the self-registered teen's wallet (`frontend/src/rebuild/family/ScopeStatement.tsx`), in three locales. Since S07.8 the marketing FAQ answers "Does it teach credit, debt or investing?" with the same lines (`faq.items.notTaught`), so a parent reads the scope before signing up:

> Practice with coins that stay in the app. No real money moves.

It practises:

| Line | Backed by |
|---|---|
| Earning coins for tasks, and helping at home. | D.10: every chore is a family contribution or a paid bonus task (`tasks.ts`, `family_task_contribution_kind`) |
| Splitting coins into save, spend and share. | D.13: the usual split with an easy override (`moneyHabits.ts`, `wallet_usual_split`) |
| Saving toward goals and waiting for them. | D.15, D.16: goals with provenance and the next-goal prompt |
| Asking for rewards and hearing the reason. | D.18: every "not yet" carries an actionable reason |

It does not teach:

| Line | Research basis |
|---|---|
| Borrowing, loans or credit cards. | Appendix G §3.5 |
| Debt, or paying it back with interest. | Appendix G §3.2, §3.5 |
| Real compound interest. The weekly bonus is not interest. | Appendix G §2.4, §3.5; D.11 |
| Risk, investing or insurance. | Appendix G §3.5 |

> These are hard to teach well, so we leave them out.

"No real money moves" is backed by the D.7 control registry (`block-d-controls.json`, control `simulation`): the account is a declared simulation, and a gate fails on any payment, card-issuing or bank-linking SDK. The older-teen bridge (D.19) talks about real pay, real accounts and real budgets outside the app; it moves nothing either.

## What the gate enforces

- The four exclusions stay (credit, debt, compound interest, risk).
- Every line has copy in en-US, es-MX and pt-BR, and the component shows exactly the registry's lines, in order.
- Every "it practises" line keeps the code that backs it.
- The statement stays mounted on the three pages above.
- The FAQ answer stays on the FAQ page and names credit, debt, compound interest, risk, insurance and "not interest" in each locale (`publicAnswers` in the registry).
- No table or column for borrowing, lending, interest, insurance or investing enters the schema without the statement changing first: the gate reads every table and column the migrations define. Adding such a mechanic means rewriting this statement, adding the identifier to `acknowledged` in the registry with the review that approved it, and re-running the audit below.

## Quarterly Scope-Disclosure Presence & Accuracy Audit (Appendix H Part 1.3)

A person (Product with the Pedagogical Lead) checks, once a quarter and before any release that changes Block D copy or marketing:

1. The statement is visible on the Tutor's Family and Banking screens and in the teen wallet, in all three locales, light and dark.
2. Every "it practises" line is still true of the product as it behaves, not only as the code reads.
3. No parent-facing material (the app, the marketing site, the FAQ, emails, store listings) implies coverage of credit, debt, compound interest, risk, investing or insurance, or presents any Block D mechanic as scientifically proven (Block D Part 4 governance boundary; `check-block-d-research.mjs` screens the app and marketing copy for proof claims, the human reads everything else).
4. The savings bonus is never described as interest.

Target: zero violations. A violation is fixed in the material, never by softening this statement.

## Audit log

| Date | Scope | Findings | By |
|---|---|---|---|
| 2026-09-24 | Engineering pre-audit of the rebuilt Family Hub and Banking surfaces and `marketing.json` in three locales | No surface or marketing string claims credit, debt, compound-interest, investing or insurance coverage; the only mentions of credit and loans in `marketing.json` are the Terms' statement that LittleFounders grants none. The statement is mounted on the three pages. This entry does not replace the first human audit. | Engineering (S07 lane) |
