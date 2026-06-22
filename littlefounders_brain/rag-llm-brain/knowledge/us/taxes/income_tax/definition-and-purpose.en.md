---
doc_id: "us-taxes-income_tax-definition-and-purpose"
title_es: "Definición y propósito del impuesto sobre la renta (EE.UU., 2026)"
title_en: "Definition and Purpose of Income Tax (U.S. Federal, 2026)"
language: "en"
translation_of: "us-taxes-income_tax-definition-and-purpose"
country: "us"
jurisdiction: "US-FED"
domain: "taxes"
subdomain: "income_tax"
concept_ids: [us.income_tax.definition, us.withholding.purpose, us.tax_liability]
age_bands: [tier3, tier4, tier5]
depth_tier: "intro"
volatility: "static"
last_verified_date: "2026-06-21"
verified_by: "qwen-pipeline"
review_due: null
sources: [src_gen_4f88219b, src_gen_62f606d8, src_gen_e04d5966, src_gen_fc17b522]
status: "review"
currency: "USD"
schema_version: "kb-1.0"
grounding_tier: "anchored"
canonical_facts: 6
cited_facts: 6
anchored_ratio: 1.0
evidence_grounded: true
---
## Summary
The U.S. federal income tax is a levy imposed by the federal government on an individual’s taxable income earned during a calendar tax year (January 1 to December 31), effective as of 2026-06-21. It applies only to income defined as taxable under the Internal Revenue Code (Title 26 of the U.S. Code), not to all money received. Unlike Mexico’s system—where tax is calculated annually on total income and paid in April—the U.S. system relies primarily on *withholding at the source*: employers deduct a portion from each paycheck and remit it directly to the IRS. This mechanism prevents large year-end payments and reduces penalties for under-withholding.

## For young people (tier3–4) <!-- age_band: tier3,tier4 -->
Federal income tax is like a membership fee you pay to the U.S. federal government for living and working in the country. If you earn money from work (e.g., a summer job or school assistant role), part of that pay is automatically withheld from your paycheck before you receive it. That amount goes to the government to fund public services such as roads, schools, and hospitals. Not everyone pays: if your income is very low (less than <!-- @fact id=us.std_deduction.single value="16,100 USD" verified=2026-06-21 src=src_gen_fc17b522 volatility=low --> in 2026 when filing as single), you owe no tax and may request zero withholding. But if you earn more, withholding applies—and at year-end, when you file your tax return (Form 1040), you’ll get a refund if too much was withheld, or pay the balance if too little was withheld.

**Illustrative example:** Ana, age 17, works part-time and earns $18,000 in 2026. Her employer uses Form W-4 to calculate withholding. Because her income exceeds the standard deduction for single filers (<!-- @fact id=us.std_deduction.single value="16,100 USD" verified=2026-06-21 src=src_gen_fc17b522 volatility=low -->), tax applies to the excess. Assuming an average effective rate of 12% on taxable income, her approximate annual withholding would be: ($18,000 − $16,100) × 12% = $1,900 × 12% = $228. This is a simplified teaching estimate; the actual amount depends on her completed W-4 and the IRS’s official withholding tables.

## For young adults and adults (tier5) <!-- age_band: tier5 -->
The federal income tax is a progressive tax imposed by the United States government on an individual’s taxable net income, as prescribed by Internal Revenue Code § 1, effective for the 2026 tax year.

**Key facts**
- It is *progressive*: the higher a person’s income, the higher the marginal rate applied to the top portions of that income.
- It is funded through *withholding at the source* (by employers) and/or *estimated tax payments* (for non-wage income such as self-employment or rental income).
- Taxable income is calculated by subtracting allowable deductions (e.g., the standard deduction or itemized deductions) from gross income.
- Marginal tax rates range from 10% to <!-- @fact id=us.federal.top_rate value="37%" verified=2026-06-21 src=src_gen_e04d5966 volatility=low --> for very high incomes.
- Not all money received is taxable—for example, certain government benefits or gifts are excluded from gross income.

**How it works / How it’s calculated**
The basic formula is:

> Federal income tax = Σ (taxable income within each bracket × applicable marginal rate)

Where:
- *Taxable income* = Total gross income − permitted deductions (e.g., <!-- @fact id=us.std_deduction.mfj value="32,200 USD" verified=2026-06-21 src=src_gen_fc17b522 volatility=low --> for married filing jointly in 2026)
- *Income brackets* are statutorily defined and vary by filing status (single, married filing jointly, head of household).

**Worked example**
Carlos, filing as single, reports $52,000 in gross income for 2026. He claims no itemized deductions, so he takes the standard deduction for single filers: <!-- @fact id=us.std_deduction.single value="16,100 USD" verified=2026-06-21 src=src_gen_fc17b522 volatility=low --> = $16,100.

→ Taxable income = $52,000 − $16,100 = $35,900

Applying the 2026 federal income tax brackets (published in IRS Publication 15 and 17; thresholds per IRS Rev. Proc. 2025-32):
- First $12,400: 10% rate → $1,240
- Next $35,900 − $12,400 = $23,500, taxed at 12% → $23,500 × 12% = $2,820

→ Total tax liability = $1,240 + $2,820 = **$4,060**

This is the amount Carlos *owes* on his 2026 income. If his employer withheld $4,300 over the year, he will receive a $240 refund when he files Form 1040.

**Note:**
- The federal income tax is distinct from payroll tax (FICA): the latter is a fixed, proportional levy for Social Security and Medicare—not for general government operations. Specifically, <!-- @fact id=us.fica.ss_rate value="6.2%" verified=2026-06-21 src=src_gen_4f88219b volatility=low --> applies to the first <!-- @fact id=us.ss.wage_base value="184,500 USD" verified=2026-06-21 src=src_gen_4f88219b volatility=low --> of wages (Social Security), and <!-- @fact id=us.fica.medicare_rate value="1.45%" verified=2026-06-21 src=src_gen_4f88219b volatility=low --> applies to *all* wages (Medicare).
- Payroll withholding does not always equal the final tax liability due to tax credits (e.g., Child Tax Credit), life changes, or unreported additional income not reflected on Form W-4.

**Income tax vs Payroll tax (FICA)**
- *Income tax*: Progressive, based on net income, funds the general Treasury, calculated annually and reconciled via Form 1040. Its top marginal rate is <!-- @fact id=us.federal.top_rate value="37%" verified=2026-06-21 src=src_gen_e04d5966 volatility=low -->.
- *Payroll tax (FICA)*: Fixed and proportional, composed of <!-- @fact id=us.fica.ss_rate value="6.2%" verified=2026-06-21 src=src_gen_4f88219b volatility=low --> on the first <!-- @fact id=us.ss.wage_base value="184,500 USD" verified=2026-06-21 src=src_gen_4f88219b volatility=low --> of wages (Social Security) and <!-- @fact id=us.fica.medicare_rate value="1.45%" verified=2026-06-21 src=src_gen_4f88219b volatility=low --> on *all* wages (Medicare); it funds dedicated trust funds for retirement and health care—not the general budget.
