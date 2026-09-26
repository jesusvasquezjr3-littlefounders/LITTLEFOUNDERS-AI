# Family Hub and banking tone gate

Requirement D.8 extends B.14's "speak like a mentor, never like a bank" standard (Law 2) from lesson content to the system copy of Family Hub and Digital Banking. These are the moments of monetary friction where a product slips into bank language by default:
- a reward that is not approved yet;
- a spending limit reached;
- a freeze;
- an allowance arriving;
- a correction.

Appendix H Stage 4 runs this gate on any new or changed copy in the domain. It also checks, per D.7, for phrasing that implies a guarantee the system does not enforce. It reports the **Tone-Gate Pass Rate** (Diagnostic, no fixed target).

B.14's Forge gate for lesson content is not built in this branch. It belongs to the S05 lane. This gate is the "equivalent review step" D.8 allows. When B.14 lands, its lexicon and this one should be merged into one list, so that one standard covers both surfaces.

## What the gate checks

`node agent/tools/check-family-copy-tone.mjs` reads `agent/tools/family-copy-tone.lexicon.json`.

**Scope, all three locales:**
- the rebuilt Family Hub and banking namespaces: `familyHub`, `familyMoney`, `moneyHabits`, `familyAutonomy`, `teenWallet`, `coinAccount` and `moneyRegister`;
- the `tasks`, `banking` and `family` subtrees of `common.json`;
- the family and banking error codes of `errors.json`.

Core's own error messages are English developer diagnostics. A family never reads them: the legacy error banner and every rebuilt surface resolve the error *code* to copy. So the gate fails instead if a Family Hub or banking surface starts rendering a raw `error.message`.

| Category | Why | Examples caught |
|---|---|---|
| `bank_register` | Law 2: transactional, procedural or legal banking language | insufficient funds, transaction, declined, fee, penalty, denied, redeem, redemption, credits; rechazar, canje, créditos; recusar, resgate, taxa |
| `guarantee` | D.7: no promise of safety, protection, insurance or a real bank or card | safe, secure, protected, insured, guaranteed, real money, bank account; seguro, protegido; seguro, protegida |
| `glossary` | Owner log §5, the controlled glossary | money, dinero, dinheiro; job; accept (for a parent's approval); streak freeze; guardian (the verified parent is the Tutor) |
| `shouting` | A mentor never shouts | stacked "!!", words in capitals, raw error codes such as `ACCOUNT_FROZEN` |

Placeholders (`{count}`, `{{name}}`) are ignored when matching words. The gate prints the pass rate. `--report <path>` writes it as JSON (Appendix H metric). In CI the rate is in the `repo gates` job log for every push.

## Exceptions

An exception names the key, the category and a reason a reviewer can check. Two kinds exist:
- the D.11 disclosures, which name what the bonus is *not* ("not a bank interest rate");
- the invitation and safety words that are not about money: an adult *accepts an invite*; a Tutor *refuses* an adult who asked to join the child's account.

The gate fails on an exception that no longer excuses anything, so a stale exception cannot silently excuse the next string written under that key.

## Stage 4 human spot-check

Automated matching cannot judge meaning. For every release that changes copy in this domain:
1. A reviewer who did not write the copy reads every new or changed string in the three locales, in context (screenshots from the release's browser matrix).
2. The reviewer checks each string against three questions. Would a mentor say this to a child? Does it promise anything the system does not enforce (`docs/operations/NO-UNBACKED-GUARANTEE.md`)? Does it keep the glossary?
3. A string that fails is rewritten. A new pattern the reviewer finds is added to the lexicon, so the machine catches it next time.
4. The review is recorded in the release notes with the reviewer's name.

## Recorded runs

| Date | Strings | First run | After fixes | Notes |
|---|---|---|---|---|
| 2026-09-24 | 3,941 first, then 3,480 | 3,862 of 3,941 pass (98.0%) | 3,480 of 3,480 (100%), 6 reviewed exceptions | First run at S07.6. It included Core's English messages; these were then taken out of scope as developer diagnostics a family never reads, and the raw-message rule was added instead. 15 family-facing keys were rewritten in all three locales: redemption, deny, credits, "safe", "guardian", "rejected". |
