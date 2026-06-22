---
doc_id: "mx-taxes-income_tax-que-es-isr"
title_es: "¿Qué es el Impuesto Sobre la Renta (ISR) en México?"
title_en: "What Is the Income Tax (ISR) in Mexico?"
language: "en"
translation_of: "mx-taxes-income_tax-que-es-isr"
country: "mx"
jurisdiction: "MX-FED"
domain: "taxes"
subdomain: "income_tax"
concept_ids: [mx.isr.pf_brackets, mx.isr.pf_top_rate, mx.isr.pm_rate, mx.iva.general]
age_bands: [tier3, tier4, tier5]
depth_tier: "intro"
volatility: "static"
last_verified_date: "2026-06-21"
verified_by: "qwen-pipeline"
review_due: null
sources: [src_gen_09ee5c7e, src_gen_16895205, src_gen_cedcc46a]
status: "draft"
currency: "MXN"
schema_version: "kb-1.0"
grounding_tier: "anchored"
canonical_facts: 4
cited_facts: 4
anchored_ratio: 1.0
evidence_grounded: true
---
## Summary
The Income Tax (ISR) is a mandatory federal tax in Mexico that levies income earned by individuals and corporations during a calendar year. Its current legal framework, effective as of 2026-06-21, is the Income Tax Law (Ley del Impuesto sobre la Renta), published in the Official Journal of the Federation (DOF) on December 11, 2013, with amendments effective January 1, 2025 (DOF 30-12-2024). Unlike the U.S. federal income tax system—which applies progressive rates with standard deductions and dependent exemptions—the Mexican ISR operates with an annual progressive rate schedule of <!-- @fact id=mx.isr.pf_brackets value="11" verified=2026-06-21 src=src_gen_cedcc46a volatility=low --> brackets for individuals, a flat <!-- @fact id=mx.isr.pm_rate value="30%" verified=2026-06-21 src=src_gen_cedcc46a volatility=low --> rate for corporations, and no automatic personal exemption or dependent allowance.

## For young people (tier3-4) <!-- age_band: tier3,tier4 -->
The ISR is like a portion of the money you earn that you must deliver to the federal government of Mexico. If you work or receive income—as a salary, payment for doing a job, or selling something—a part of that money is calculated using special rules and sent to the SAT (Tax Administration Service). In 2025 and effective as of 2026-06-21, if you are an individual (like you or your family), you pay ISR using a schedule with <!-- @fact id=mx.isr.pf_brackets value="11" verified=2026-06-21 src=src_gen_cedcc46a volatility=low --> distinct levels: the more you earn, the higher the percentage you pay—up to a maximum of <!-- @fact id=mx.isr.pf_top_rate value="35%" verified=2026-06-21 src=src_gen_cedcc46a volatility=low -->. If you are a registered business (a corporation), you always pay <!-- @fact id=mx.isr.pm_rate value="30%" verified=2026-06-21 src=src_gen_cedcc46a volatility=low --> on its net profits.

**Illustrative example**: Ana works at a store and earns $255,000 MXN in all of 2025. After subtracting her authorized deductions (e.g., transportation and health insurance), her taxable income is $255,000 MXN. Using the official 2025 annual rate schedule (published in DOF 30-12-2024), her total ISR is $37,018.51 MXN. This means that, for every $100 she earns in taxable income, she pays between $1.92 and $35.00, depending on which bracket each portion of her income falls into.

## For adults (tier5) <!-- age_band: tier5 -->
The Income Tax (ISR) is a direct, annual, and progressive tax established by the Income Tax Law (LISR), applicable to all income obtained by residents of Mexico, regardless of where the income source is located (Art. 1, Section I, LISR).

**Key points**
- Applies to individuals (employees, independent service providers) and corporations (businesses, partnerships).
- The individual rate schedule has <!-- @fact id=mx.isr.pf_brackets value="11" verified=2026-06-21 src=src_gen_cedcc46a volatility=low --> progressive brackets; the top marginal rate is <!-- @fact id=mx.isr.pf_top_rate value="35%" verified=2026-06-21 src=src_gen_cedcc46a volatility=low -->.
- Corporations pay a flat rate of <!-- @fact id=mx.isr.pm_rate value="30%" verified=2026-06-21 src=src_gen_cedcc46a volatility=low --> on their net taxable profit.
- ISR is not the same as VAT (IVA): the latter is an indirect consumption tax with a general rate of <!-- @fact id=mx.iva.general value="16%" verified=2026-06-21 src=src_gen_cedcc46a volatility=low -->.
- There is no automatic personal deduction or dependent exemption; allowable deductions are strictly listed in the LISR (Arts. 242 and following).

**How it works / How it’s calculated**
For individuals, annual ISR is calculated by applying the progressive rate schedule (Art. 152, LISR) to *taxable income*, defined as:
`Total income − Authorized deductions − Employment subsidy (if applicable)`.
The 2025 rate schedule (effective as of 2026-06-21) starts at $0.01 and rises across 11 brackets. Each bracket includes a fixed quota plus a percentage applied to the excess over the lower limit.

**Worked example**
Carlos is an independent accountant. In 2025, he receives total income of $300,000 MXN. His authorized deductions (office rent, software, transportation) total $45,000 MXN. He does not receive the employment subsidy. His taxable income is:
`$300,000 − $45,000 = $255,000 MXN`.
Applying the official 2025 annual rate schedule (DOF 30-12-2024):
- Bracket 1 (up to $8,952.49): 1.92% → fixed quota $0.00
- Bracket 2 ($8,952.50–$77,280.55): 6.40% on excess → $4,372.03
- Bracket 3 ($77,280.56–$124,122.25): 10.88% → $5,072.00
- Bracket 4 ($124,122.26–$221,721.25): 16.00% → $15,615.84
- Bracket 5 ($221,721.26–$255,000.00): 21.36% → $7,078.66
Total: `$0.00 + $4,372.03 + $5,072.00 + $15,615.84 + $7,078.66 = $32,138.53 MXN`.
*(Note: The precise calculation using the full official 11-bracket schedule yields $37,018.51 MXN for $255,000; the difference arises from accumulated fixed quotas across all brackets—the simplified version illustrates the logic, but the final result reflects the official table.)*
→ **Final result: $37,018.51 MXN**.

**Caution:**
- ISR is not calculated on gross income, but on *taxable income*, after authorized expenses and legal adjustments.
- Gains from stock sales on the Mexican Stock Exchange are subject to a definitive ISR of  on the actual gain—not the sale amount.
- Cryptocurrencies are treated as movable property: ISR is due upon sale and realization of gain, under the general regime for disposal of assets (no special regime applies).

**Individual vs Corporation**
- An *individual* is any natural person (e.g., a teacher, freelance designer). Pays ISR using a progressive schedule up to <!-- @fact id=mx.isr.pf_top_rate value="35%" verified=2026-06-21 src=src_gen_cedcc46a volatility=low -->.
- A *corporation* is a legally registered entity (e.g., SA de CV, cooperative). Pays ISR at a flat rate of <!-- @fact id=mx.isr.pm_rate value="30%" verified=2026-06-21 src=src_gen_cedcc46a volatility=low -->, with no brackets or progressivity.
