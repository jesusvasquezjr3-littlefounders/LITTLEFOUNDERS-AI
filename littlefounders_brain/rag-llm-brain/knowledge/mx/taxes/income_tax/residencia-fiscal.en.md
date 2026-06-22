---
doc_id: "mx-taxes-income_tax-residencia-fiscal"
title_es: "Residencia Fiscal en México: Criterios y Consecuencias Tributarias"
title_en: "Tax Residency in Mexico: Criteria and Tax Consequences"
language: "en"
translation_of: "mx-taxes-income_tax-residencia-fiscal"
country: "mx"
jurisdiction: "MX-FED"
domain: "taxes"
subdomain: "income_tax"
concept_ids: [mx.residency.criteria, mx.residency.consequences, mx.establecimiento.permanente]
age_bands: [tier4, tier5]
depth_tier: "intermediate"
volatility: "low"
last_verified_date: "2026-06-21"
verified_by: "qwen-pipeline"
review_due: "2028-06-21"
sources: [src_gen_1059e45d, src_gen_8ae2b0ae, src_gen_d03cd254]
status: "review"
currency: "MXN"
schema_version: "kb-1.0"
grounding_tier: "anchored"
canonical_facts: 4
cited_facts: 4
anchored_ratio: 1.0
evidence_grounded: true
---
## Summary
Tax residency in Mexico is a legal criterion that determines whether an individual or company must pay income tax on *all* their income —both earned inside and outside Mexico— under the Income Tax Law (LISR). This rule applies nationwide and is effective as of 2026-06-21. Unlike the United States, where citizenship is a primary basis for worldwide taxation, Mexico relies *exclusively* on residence (habitual home or effective place of management) to trigger global tax liability.

## For young adults (tier4-5) <!-- age_band: tier4,tier5 -->
### What is tax residency?
It is the legal status acquired by a natural or legal person who has their habitual home in Mexico (natural persons) or their effective place of administration or place of incorporation in Mexico (legal entities), thereby becoming obligated to report and pay tax on their worldwide income, regardless of where it is generated.

**Key points**
- A natural person is a Mexican tax resident if they stay in Mexico for more than 183 days in a calendar year **or** if Mexico is their habitual home—even with shorter stays.
- A legal entity is a Mexican tax resident if incorporated in Mexico **or** if its effective place of administration (where key decisions are made) is located in Mexico.
- Tax residents are subject to Mexico’s annual progressive income tax rate: up to <!-- @fact id=mx.isr.pf_top_rate value="35%" verified=2026-06-21 src=src_gen_d03cd254 volatility=low --> for individuals and <!-- @fact id=mx.isr.pm_rate value="30%" verified=2026-06-21 src=src_gen_d03cd254 volatility=low --> for corporations (General Regime).
- A foreign individual or entity acting in Mexico through a representative *other than an independent agent* who habitually concludes contracts on its behalf is deemed to have a *permanent establishment*, triggering local tax obligations.
- To claim benefits under tax treaties to avoid double taxation, taxpayers must formally prove residence in the other country using official documentation and file required fiscal information with Mexico’s tax authority (SAT).

### How it works
Determination relies on objective facts:
- For natural persons: duration of stay + family, economic, and social ties (housing, bank accounts, employment, children’s schooling).
- For legal entities: place of incorporation (notarial deed) **or**, if incorporated abroad, location where strategic decisions are taken (board meetings, signing of major contracts, financial control).
- A permanent establishment arises when a foreign person operates in Mexico via a representative who is *not* an independent agent and performs substantive functions (e.g., signing contracts, delivering goods, assuming risks)—even without a fixed office.

### Worked example
*Illustrative rounded figures, effective as of 2026-06-21.*

Carlos López, a Canadian citizen, has lived in Guadalajara since March 2025. He rents a home, holds a local bank account, and works remotely for a Toronto-based company. In 2025, he spent 210 days in Mexico. His annual income is 1,200,000 MXN.

→ Having exceeded 183 days and maintained real ties (housing, banking, economic activity), Carlos became a Mexican tax resident in 2025.
→ He must report all global income to SAT.
→ Mexico’s annual progressive individual income tax rate applies: his taxable income (after authorized deductions) falls into the top bracket, subject to the marginal rate of <!-- @fact id=mx.isr.pf_top_rate value="35%" verified=2026-06-21 src=src_gen_d03cd254 volatility=low -->.
→ If his taxable income is 1,000,000 MXN, his calculated tax is approximately = 350,000 MXN (illustrative use of top marginal rate; actual calculation uses 11-step progressive scale ).

### Caution:
- Holding a tourist visa or temporary stay permit **does not exclude** tax residency: factual circumstances—not visa type—determine status.
- A foreigner receiving only foreign-source income (e.g., Canadian pension) but residing in Mexico >183 days remains a tax resident and must declare those foreign earnings.

### Exception:
A foreign resident acting in Mexico *solely* through an *independent agent* (e.g., an advertising agency serving multiple clients) **does not** create a permanent establishment—as long as that agent operates within the ordinary course of its business, without assuming the foreigner’s risks or holding its inventory.

### Tax resident vs. Non-resident
| Criterion | Tax resident | Non-resident |
|----------|--------------|--------------|
| Tax base | All income (inside and outside Mexico) | Only income sourced *within* Mexico |
| Applicable rate | Annual progressive rate (up to <!-- @fact id=mx.isr.pf_top_rate value="35%" verified=2026-06-21 src=src_gen_d03cd254 volatility=low -->) or flat <!-- @fact id=mx.isr.pm_rate value="30%" verified=2026-06-21 src=src_gen_d03cd254 volatility=low --> for corporations | Specific rates per income type (e.g., 25% on fees paid by Mexican residents) |
| Filing obligation | Yes, annual return to SAT | Only if earning Mexican-source income subject to withholding |
| Eligibility for personal deductions | Yes, up to lesser of: 5 annual UMA <!-- @fact id=mx.uma.anual value="42,794.64 MXN" verified=2026-06-21 src=src_gen_1059e45d volatility=low --> or 15% of total income  | Not applicable |

## For teenagers (tier4) <!-- age_band: tier4 -->
Imagine your family moves to Mexico and you enroll in high school here. If you rent or own a home, open local bank accounts, and register at school, the Mexican government may consider your family *tax residents*. That means they must declare *all* their income—including earnings from another country—and pay tax on it. It doesn’t matter if they hold a foreign passport: what matters are the real-life facts of living here. If they’re only visiting for vacation or a few months, it doesn’t apply. But if they stay over half a year and build daily life here, it does.

Example: Sofía, age 16, arrives from Chile with her parents in January 2025. They live in Monterrey, she attends local high school, and her father works remotely for a Santiago-based company. By December 2025, they’ve spent 220 days in Mexico. Therefore, as of 2025, her father is a Mexican tax resident and must report his Chilean income to SAT.

## For young adults (tier5) <!-- age_band: tier5 -->
This level addresses operational consequences. Tax residency is not just a label—it triggers concrete obligations. For example, a U.S.-based startup hiring a software development team in Guadalajara through a *local representative who signs contracts and delivers code*—even without a registered office—may be deemed to have a *permanent establishment* in Mexico (Art. 2, VI, LISR, DOF 09-12-2019). This entails: (i) mandatory registration with SAT, (ii) monthly ISR payment at <!-- @fact id=mx.isr.pm_rate value="30%" verified=2026-06-21 src=src_gen_d03cd254 volatility=low -->, (iii) invoicing with VAT at , and (iv) maintaining accounting records in Spanish and Mexican pesos. A common mistake is assuming 'no physical office = no tax obligation'; the law examines *functions performed*, not infrastructure.
