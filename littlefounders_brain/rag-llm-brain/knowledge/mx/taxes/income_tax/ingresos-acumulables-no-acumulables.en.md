---
doc_id: "mx-taxes-income_tax-ingresos-acumulables-no-acumulables"
title_es: "Ingresos Acumulables y No Acumulables para el ISR en México"
title_en: "Accumulable and Non-Accumulable Income for Income Tax in Mexico"
language: "en"
translation_of: "mx-taxes-income_tax-ingresos-acumulables-no-acumulables"
country: "mx"
jurisdiction: "MX-FED"
domain: "taxes"
subdomain: "income_tax"
concept_ids: [mx.isr.income_classification, mx.isr.acumulable, mx.isr.no_acumulable]
age_bands: [tier3, tier4, tier5]
depth_tier: "intro"
volatility: "low"
last_verified_date: "2026-06-21"
verified_by: "qwen-pipeline"
review_due: "2028-06-21"
sources: [src_gen_3ccce9e2, src_gen_9c61c3a1, src_gen_dd1f8a95]
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
Accumulable income includes all earnings received by an individual or entity that must be included in the taxable base for calculating Mexico’s Income Tax (ISR); non-accumulable income is expressly exempt under law. This classification is mandatory under the Income Tax Law (LISR), effective as of 2026-06-21, and applies exclusively to residents of Mexico. Unlike the U.S. system (where certain gifts or inheritances may be fully exempt), in Mexico only donations between spouses or from parents to children qualify as non-accumulable — and even those are subject to documentation requirements and anti-avoidance scrutiny.

## For youth (tier3–4) <!-- age_band: tier3,tier4 -->
Imagine receiving money from family or starting your first job. In Mexico, **not all money you receive counts toward your income tax bill**. For example: if your parents give you $5,000 for school, that amount **is not included** in your taxable income. But if your uncle gives you $5,000, **it is included**, because the law exempts only donations between spouses or from parents to children (and not from other relatives). If you work and earn $12,000 per month, that income *is* included — but you may deduct documented expenses like transportation or school supplies. The government uses the UMA (Unit of Measurement and Updating) to define many thresholds: in 2026, one monthly UMA equals <!-- @fact id=mx.uma.mensual value="3,566.22 MXN" verified=2026-06-21 src=src_gen_9c61c3a1 volatility=low --> and one annual UMA equals <!-- @fact id=mx.uma.anual value="42,794.64 MXN" verified=2026-06-21 src=src_gen_9c61c3a1 volatility=low -->.

## For adults and professionals (tier5) <!-- age_band: tier5 -->
Accumulable income refers to all income received by a natural person during the year that — pursuant to Article 109 of the Income Tax Law (LISR) — must be integrated into the taxable base to determine annual ISR liability.

**Key points**
- Accumulable income includes salaries, professional fees, rental income from real estate, capital gains from selling stocks or land, and gifts from persons other than spouse or parent.
- Non-accumulable (exempt) income includes only: (i) donations between spouses or from parents to children; (ii) workers’ compensation for occupational injuries or illnesses; (iii) court-ordered alimony payments.
- Non-accumulable income **generates no ISR and is not declared**, but must be properly documented before the SAT (Tax Administration Service).
- The donation exemption **does not apply** to grandparents, uncles, cousins, friends, or employers: such amounts *are* accumulable (Art. 109, Section I, LISR).
- The personal deduction cap is limited to the lesser of: 5 annual UMAs or 15% of total income .

**How it works / How it is calculated**
Annual taxable base = Sum of all accumulable income − Authorized deductions (documented expenses, IMSS contributions, etc.). Then the progressive annual rate schedule of 11 brackets <!-- @fact id=mx.isr.pf_brackets value="11" verified=2026-06-21 src=src_gen_9c61c3a1 volatility=low --> is applied, with a top marginal rate of 35% <!-- @fact id=mx.isr.pf_top_rate value="35%" verified=2026-06-21 src=src_gen_9c61c3a1 volatility=low -->.

**Worked example**
Carlos, a Mexican resident, receives in 2025:
- Annual salary: $320,000 MXN (accumulable)
- Professional fees: $85,000 MXN (accumulable)
- Donation from his father: $40,000 MXN (non-accumulable, Art. 109, Sec. I LISR)
- Donation from his uncle: $25,000 MXN (accumulable — not covered by exemption)
- Documented deductible expenses: $32,000 MXN

Taxable base = ($320,000 + $85,000 + $25,000) − $32,000 = $398,000 MXN
Applying the 2025 annual rate schedule (Art. 152 LISR, applicable to 2025 returns filed in 2026):
- Up to $159,519.24: 1.92% → $3,062.77
- $159,519.25 to $274,258.12: 6.40% on excess → $7,354.22
- $274,258.13 to $398,000.00: 10.88% on excess → $13,529.47
Total ISR = $3,062.77 + $7,354.22 + $13,529.47 = **$23,946.46 MXN**

**Note:** The $40,000 donation from his father qualifies as non-accumulable only if proven via notarial deed or traceable bank transfer. Without proof, the SAT may require its inclusion.

**Exception:** Profit-sharing payments (PTU) are accumulable, but a special deduction equal to 10% of the PTU received applies (Art. 112, Sec. III LISR); this does not apply to donations.

**Father’s donation vs uncle’s donation**
- Father’s donation: non-accumulable, no statutory monetary cap, but must be documented and cannot simulate tax avoidance.
- Uncle’s donation: fully accumulable — included in taxable base and taxed at the applicable progressive rate.
