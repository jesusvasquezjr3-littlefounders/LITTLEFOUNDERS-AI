---
doc_id: us-taxes-self_employment-self-employment-tax
title_es: "El self-employment tax en EE.UU."
title_en: "US self-employment tax"
language: en
translation_of: us-taxes-self_employment-self-employment-tax
country: us
jurisdiction: US-FED
domain: taxes
subdomain: self_employment
concept_ids: [tax.se]
age_bands: [tier4, tier5]
depth_tier: advanced
volatility: low
last_verified_date: 2026-06-19
verified_by: jesusv
review_due: 2028-06-19
sources: [src_irs_se_tax]
status: published
currency: USD
schema_version: kb-1.0
---
## For future Claude
Doc about the US federal *self-employment tax* (SE tax), verified 2026-06-19, federal jurisdiction
(IRS). Serves tiers 4-5. The 15.3% rate is stable (FICA structure), but re-verify before the 2028
review. **Key differentiator:** SE tax is the FICA (Social Security + Medicare) structure for people
who work for themselves in the US. **Mexico has NO "SE tax"**: there, social security is covered by
**IMSS** contributions, a different structure. Keep Mexican terms out of this doc.

## For teens (tier4) <!-- age_band: tier4 -->

When someone has a job with a boss, the paycheck comes with automatic deductions for **Social
Security** and **Medicare** (health care for older adults). The interesting part: the employee pays
half and the employer pays the other half. Those two deductions together are called **FICA**.

But what happens when you work for yourself? Picture mowing lawns around the neighborhood, selling
brownies, or building apps on commission: you are the owner and the worker at the same time. This is
where the **self-employment tax (SE tax)** comes in: since there is no employer to chip in their half,
you pay **both halves**. That is the big lesson: the self-employed pay the employee side **and** the
employer side.

The total SE tax rate is **15.3%**. <!-- @fact id=us.se.rate value=15.3% verified=2026-06-19 src=src_irs_se_tax volatility=low --> It is not applied to every dollar that comes in, but to your
**net earnings** (what you made after subtracting your business expenses). And you only pay it if
those net earnings reach **$400** for the year. <!-- @fact id=us.se.filing_floor value=$400 verified=2026-06-19 src=src_irs_se_tax volatility=low --> If you sold brownies and made $50, no SE tax
yet; once your business grows, it kicks in. It is not a punishment: that money builds your own Social
Security and Medicare for the future.

## Advanced (tier5) <!-- age_band: tier5 -->

The **self-employment tax** is how the US collects **FICA** contributions (Social Security and
Medicare) from people who are not W-2 employees: independent workers, sole proprietors, partners in a
partnership, and members of certain LLCs. It mirrors the full FICA burden because the taxpayer
occupies the role of both employer and employee at once.

Breakdown of the **15.3%** rate: <!-- @fact id=us.se.rate.total value=15.3% verified=2026-06-19 src=src_irs_se_tax volatility=low -->

- **12.4% Social Security** <!-- @fact id=us.se.rate.social_security value=12.4% verified=2026-06-19 src=src_irs_se_tax volatility=low --> (6.2% "employee" + 6.2% "employer"), capped at an annual wage base.
- **2.9% Medicare** <!-- @fact id=us.se.rate.medicare value=2.9% verified=2026-06-19 src=src_irs_se_tax volatility=low --> (1.45% + 1.45%), with no cap.

SE tax is not computed on the full net profit: it applies to **92.35%** of net business earnings.
<!-- @fact id=us.se.net_earnings_factor value=92.35% verified=2026-06-19 src=src_irs_se_tax volatility=low --> That adjustment recognizes the "employer half" as a deductible cost, so the income
is not taxed twice. The filing threshold is triggered at **$400** of net earnings. <!-- @fact id=us.se.filing_floor value=$400 verified=2026-06-19 src=src_irs_se_tax volatility=low -->

Operationally, SE tax is settled on the annual return (Schedule SE), but you do not wait until
year-end: you pay it during the year via **quarterly estimated taxes** using **Form 1040-ES**. This
matters for business cash flow, because unlike a W-2 employee, no one withholds for you. A portion of
the SE tax is deductible from gross income, easing the net cost.

> **US vs MX differentiator:** SE tax is the US **FICA** structure applied to self-employment,
> collected by the **IRS** at the federal level. **Mexico does not use an "SE tax"**: its social
> security is funded through **IMSS contributions**, with its own rules and rates. They are not
> equivalent or interchangeable.
