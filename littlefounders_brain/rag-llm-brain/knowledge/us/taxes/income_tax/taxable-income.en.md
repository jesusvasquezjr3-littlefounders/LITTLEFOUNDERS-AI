---
doc_id: "us-taxes-income_tax-taxable-income"
title_es: "Ingreso gravable (US-FED, 2026)"
title_en: "Taxable Income (US-FED, 2026)"
language: "en"
translation_of: "us-taxes-income_tax-taxable-income"
country: "us"
jurisdiction: "US-FED"
domain: "taxes"
subdomain: "income_tax"
concept_ids: [taxable_income, agi, standard_deduction, itemized_deduction]
age_bands: [tier4, tier5]
depth_tier: "intro"
volatility: "low"
last_verified_date: "2026-06-21"
verified_by: "qwen-pipeline"
review_due: "2028-06-21"
sources: [src_gen_04c03c8a, src_gen_687165fd, src_gen_ef572a76, src_irs_obbba]
status: "draft"
currency: "USD"
schema_version: "kb-1.0"
grounding_tier: "anchored"
canonical_facts: 4
cited_facts: 4
anchored_ratio: 1.0
evidence_grounded: true
---
## Summary
Taxable income is the amount of money on which the U.S. federal government levies income tax for tax year 2026. It is calculated by subtracting allowable deductions from adjusted gross income (AGI), and determines the federal income tax liability. Unlike Mexico — where taxable income follows different statutory definitions and does not use AGI or a standard deduction — the U.S. system follows a fixed sequence: gross income → adjustments → AGI → deductions → taxable income.

## For young adults (tier4–5) <!-- age_band: tier4,tier5 -->
### What is taxable income?
It is the actual dollar amount the Internal Revenue Service (IRS) uses to compute how much federal income tax a person owes for 2026.

**Key points**
- Starts with all money received during the year (wages, tips, proceeds from selling items).
- Then subtracts certain adjustments (e.g., retirement plan contributions or student loan interest) to arrive at *adjusted gross income* (AGI).
- From AGI, subtract either the *standard deduction* (a fixed amount based on filing status) or *itemized deductions* (actual expenses like charitable gifts or state taxes — subject to caps).
- The final result is taxable income.
- Excludes tax-exempt income such as certain scholarships or state tax refunds.

**How it’s calculated**
Taxable income = Adjusted gross income (AGI) − Standard deduction OR itemized deductions

**Worked example**
Carlos, single, earns $52,000 in wages in 2026. He contributes $4,400 to his HSA (a permitted adjustment), reducing his AGI to $47,600. He has no itemized deductions exceeding the standard deduction. He claims the standard deduction for single filers: <!-- @fact id=us.std_deduction.single value="16,100 USD" verified=2026-06-21 src=src_gen_687165fd volatility=low --> = $16,100. So: $47,600 − $16,100 = **$31,500**. His taxable income is $31,500.

**Note:** If Carlos had more than $12,200 of investment income (e.g., rent or dividends), he would lose eligibility for the Earned Income Tax Credit (EITC) — though this does not change his taxable income, it affects his net refund.

**Exception:** State and local taxes (SALT) are deductible only up to <!-- @fact id=us.salt.cap value="10,000 USD" verified=2026-06-21 src=src_gen_04c03c8a volatility=low --> = $10,000, even if more was paid.

**Standard deduction vs. itemized deductions**
The standard deduction is simpler and used by >90% of filers; itemizing is beneficial only if total qualifying expenses exceed the standard amount (e.g., $32,200 for married filing jointly).
