# Regional Adaptation Gate (Forge gate 16)

Status: policy in force for every lesson authored or regenerated from 24 September 2026. The gate is implemented and verified locally; checkpoint S05.4b. It has not been accepted yet: acceptance needs the content/learning-design team's sign-off on this checklist and the market inventory.

Binding source: Product `10` B.16 ("Content is translated, not culturally localized") and Appendix C Part 3 Stage 2, gate 6. The owner log applies the proposed values as written (§8) and OD-23 keeps every live generation owner-run.

## Why

Forge writes a lesson once in Spanish (Mexico). It then translates the lesson into English and Portuguese, with numbers, identifiers and answer keys frozen. The brand's own research shows that the markets have different problems:

- **Mexico:** formal access has outpaced financial wellbeing.
- **Brazil:** many 15-year-olds lack basic financial literacy (45% are below the PISA baseline, against an OECD average of 18%).
- **United States:** children have access to money, but not the judgment to use it.

A literal translation of a Mexican street-market lesson does not teach a Brazilian or US child about their own problem. B.16 requires an adaptation layer beyond translation, and this named gate enforces it.

## Ownership

| Role | Owns |
|---|---|
| Content / learning-design team | The market problem inventory (`coursegen/regional/markets.yaml`): problems, evidence, lesson implications and anchors. It writes each lesson's `regional_scenarios`, validates or deletes hypotheses, and signs off on this checklist at Stage 3. |
| Pedagogical Reviewer (Appendix C Stage 3) | Signs off each lesson's per-market scenarios against the checklist below. The sign-off must name its findings; a bare "approved" does not count. |
| Engineering | The schema, the gate (`coursegen/src/contentGates/regional.ts`), the adaptation step in localization, and keeping this document true to the code. |

The market inventory and scenarios must be decided **before** a course's regeneration phase begins (B.16: "decided before the item's assigned phase begins"). No lesson that needs scenarios is generated without them.

## When a lesson needs per-market scenarios

The decision is deterministic and uses only the catalog. A lesson needs scenarios when either of these is true:

1. Its topic cites a money fact: a fact whose unit is a currency (MXN, BRL, USD), or whose id is in a currency namespace (`mxn.`, `brl.`, `usd.`). Coins, notes and reference prices differ by market.
2. Its briefs (`micro_objective`, `narrative_beat`, topic `concept` and `learning_objective`) carry market context: a currency amount ("20 pesos", "$5") or an anchor from the Mexican inventory (`tianguis`, `tiendita`, `tanda`, `quincena`, `aguinaldo`).

A lesson without market context (a fantasy island, a barter between characters) does not need scenarios. The author may still record that it is market-neutral with `regional_scenarios: { universal: "<why>" }`; the Stage 3 reviewer confirms that claim. A neutral claim is refused when the lesson meets either rule above.

## The market-scenario authoring contract

Each lesson blueprint that needs scenarios declares one scenario per market:

```yaml
regional_scenarios:
  es-MX:
    scenario: "Liruf compra fruta en el tianguis del domingo y paga en pesos."
    problem_refs: [mx-cash-and-informal-commerce]
    anchors: [tianguis]
    fact_refs: [mxn.reference_costs.limonada_vaso]      # optional
  en-US:
    scenario: "Liruf buys fruit at a neighbourhood yard sale on Saturday morning."
    problem_refs: [us-parent-silence]
    anchors: [yard sale]
  pt-BR:
    scenario: "Liruf compra frutas na feira livre do bairro e paga em reais."
    problem_refs: [br-baseline-literacy-gap]
    anchors: [feira livre]
```

| Field | Rule the gate enforces |
|---|---|
| `scenario` | The author brief for that market's own situation, context and amounts. A non-authoring scenario that repeats the Spanish brief (at least 80% of the same words) is refused. |
| `problem_refs` | One to four problem ids from that market's inventory. An id from another market, or an unknown id, is refused. A scenario that rests on a `hypothesis` goes to Stage 3 review. |
| `anchors` | One to eight words that must appear in that market's lesson document. An anchor may identify only one market: it cannot be another market's inventory anchor or scenario anchor. |
| `fact_refs` | Optional verified facts behind the market's amounts. A currency fact must be in that market's currency. |

## What the gate blocks

| Where | Blocks |
|---|---|
| Catalog (`content:gates`, `verify:course`, the Forge run preflight) | A lesson that needs scenarios but declares none, or has only some markets. A false market-neutral claim. Any breach of the contract rules above. A Forge run skips such a slot before any paid stage, including under `--dry-run`. |
| Every lesson document (`runAllGates`: write retry, judge revision, localization, `verify:course`) | Another market's context: its inventory anchors, its currency next to a number ("5 pesos" in a Brazilian lesson), its currency code (MXN, BRL) or symbol ("$5" in a Brazilian lesson). The US dollar is the world reference currency, so a Mexican or Brazilian teen lesson may mention it. |
| A document for a lesson that needs scenarios | In a non-authoring market: no scenario declared ("it would ship as a translation"). In any market: none of that market's anchors appears, or another market's scenario anchor appears. |

Localization adapts instead of translating. When a lesson has scenarios, the translator receives the target market's scenario, research focus, required anchors and forbidden anchors. The localized document is then re-gated; a literal translation fails with an itemized `LocalizeContentGateError`.

## Per-market checklist (Stage 3)

The reviewer answers each question for each market, with a finding, before sign-off.

**Every market**

1. Does the scenario answer the market problem it cites, not only mention it?
2. Is every place, custom, name and payment method one a child in that market meets in everyday life? Does the lesson avoid stereotypes and brands?
3. Are the amounts plausible there for the item and the age? (Play-money amounts keep the same numbers across markets today; see the limitation below.)
4. Does the currency follow the market (MXN $, BRL R$, USD $), including in feedback, hints and option text?
5. Does no other market's context remain (places, customs, honorifics, holidays, payment methods)?
6. Does the scenario keep the lesson's concept, answer and difficulty? (Adaptation changes the situation, not what is taught or graded.)
7. Does it keep the Copy Budget, the Law 2 tone and the no-shame rules in the target language?

**Mexico (es-MX):** Is the lesson about a daily decision, not access to a product (`mx-access-without-wellbeing`)? Do cash and informal commerce appear where they are natural for young learners?

**Brazil (pt-BR):** Are the fundamentals built explicitly, with concrete or pictorial support before any abstract step (`br-baseline-literacy-gap`)? Where a digital payment or an instalment purchase appears, is the risk it carries made visible?

**United States (en-US):** Is the decision one the learner could get wrong with money they already have (`us-access-not-judgment`)? For teens, is a creator's or an app's claim examined for who benefits?

## Market problem inventory

`coursegen/regional/markets.yaml` is the single source. Each market lists its currency, its research profile and its problems. Each problem has an id, a statement, its evidence and its lesson implications. Evidence is either `cited` (restating a sourced finding from `docs/product-audit/COSMIC_NARRATIVE.md` §1.1) or `hypothesis` (a learning-design hypothesis to validate or delete before release). Never add a number without a source. Anchors are only markers that identify one market without ambiguity. Portuguese "peso" (weight), Spanish "boleto" (ticket) and "mesada" (regional Spanish for an allowance) were left out, because they would block honest lessons.

As of 24 September 2026 the inventory holds:

- **Mexico:** 1 cited problem, 2 hypotheses.
- **Brazil:** 1 cited problem, 2 hypotheses.
- **United States:** 3 cited problems.

The Brazilian `br-instant-payments` (Pix) and `br-installment-culture` hypotheses, and the Mexican `mx-cash-and-informal-commerce` and `mx-informal-group-saving` hypotheses, need the learning-design team's validation.

## Known limitation

The amounts in a localized document are the source numbers: localization freezes numbers and answer keys by design, so answers cannot drift. To adapt amounts to a market, the lesson must be written for that market, with the answer key derived again and checked again by the arithmetic gate. That is a per-market write stage, which is paid generation (OD-23 makes it owner-run). It is not built. Until then, checklist question 3 is judged by the reviewer, and a scenario whose amounts do not fit the market fails Stage 3.

## Metrics

`content:gates` reports the following per course, along with the gate 16 pass rate on documents (Appendix C Forge Gate Pass Rate, diagnostic):

- the lessons that need scenarios;
- how many of them declare scenarios;
- the blocking and review counts.
