---
doc_id: "us-taxes-income_tax-tax-brackets-and-marginal-rates"
title_es: "Tramos impositivos y tasas marginales del impuesto federal sobre la renta en Estados Unidos (2026)"
title_en: "U.S. Federal Income Tax Brackets and Marginal Rates (2026)"
language: "en"
translation_of: "us-taxes-income_tax-tax-brackets-and-marginal-rates"
country: "us"
jurisdiction: "US-FED"
domain: "taxes"
subdomain: "income_tax"
concept_ids: [us.income_tax.bracket, us.income_tax.marginal_rate, us.tax_progressivity]
age_bands: [tier4, tier5]
depth_tier: "intro"
volatility: "low"
last_verified_date: "2026-06-21"
verified_by: "qwen-pipeline"
review_due: "2028-06-21"
sources: [src_gen_c639dae6, src_gen_e04d5966, src_irs_2026_inflation]
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
The U.S. federal income tax system is progressive: the more you earn, the higher the tax rate applied to additional portions of income. This system applies to taxable income reported on Form 1040 for tax year 2026, effective as of 2026-06-21. Unlike Mexico’s system—which uses a single table with increasing effective rates and no fixed standard deduction—the U.S. system defines specific income brackets by filing status, each with its own marginal rate, and allows a fixed standard deduction that directly reduces income before applying brackets. As a result, many taxpayers pay no federal tax on their first several thousand dollars of earnings.

## For young adults and emerging professionals (tier4) <!-- age_band: tier4 -->
A tax bracket is a range of taxable income subject to a specific tax rate. In the United States, a single flat rate does not apply to all income. Instead, each portion of taxable income falls into a different bracket and is taxed at the rate corresponding to that bracket. For example, if someone earns $50,000 and files as single, the first $16,100 is not taxed because it equals the standard deduction <!-- @fact id=us.std_deduction.single value="16,100 USD" verified=2026-06-21 src=src_irs_2026_inflation volatility=low -->; the next $11,600 is taxed at 10%, and the next $19,200 at 12%.

**Worked example**: Carlos, filing as single, has $45,000 of taxable income in 2026. He subtracts the standard deduction: $45,000 − $16,100 = $28,900 of taxable income. Then he applies the 2026 single brackets:
- First $11,600 × 10% = $1,160
- Next $17,300 ($28,900 − $11,600) × 12% = $2,076
Total = $1,160 + $2,076 = **$3,236**.

## For fully independent adults and families (tier5) <!-- age_band: tier5 -->
### Tax bracket
A range of taxable income to which a specific marginal tax rate applies, defined by federal law (Internal Revenue Code §1) and annually adjusted for inflation by the IRS.

**Key points**
- Each bracket applies only to the portion of taxable income falling within that range.
- The marginal rate is the rate applied to the last dollar earned—not the average rate paid on total income.
- Brackets differ by filing status: single, married filing jointly (MFJ), married filing separately (MFS), or head of household (HoH).
- The standard deduction reduces gross income to arrive at taxable income—and is fixed per category (e.g., $32,200 for MFJ in 2026).
- The state and local tax (SALT) deduction remains capped at $40,400 USD for 2026 <!-- @fact id=us.salt.cap value="40,400 USD" verified=2026-06-21 src=src_irs_2026_inflation volatility=low -->.

**How it works / How it’s calculated**
Total tax is calculated by summing the products of each partial income amount multiplied by its marginal rate. There is no single formula; the IRS publishes official graduated tables. The general calculation is:
> Tax = Σ (Income_in_bracket_i × Marginal_rate_i)

**Worked example**: Maria and Luis, married filing jointly, have $120,000 of taxable income in 2026. Their standard deduction has already been subtracted (hence this is *taxable* income). They apply the 2026 MFJ brackets:
- First $23,200 × 10% = $2,320
- Next $59,200 ($82,400 − $23,200) × 12% = $7,104
- Next $37,600 ($120,000 − $82,400) × 22% = $8,272
Total = $2,320 + $7,104 + $8,272 = **$17,696**.

**Note:** Taxable income is not the same as gross income. It is calculated by subtracting allowable deductions (e.g., the standard deduction <!-- @fact id=us.std_deduction.mfj value="32,200 USD" verified=2026-06-21 src=src_irs_2026_inflation volatility=low -->, qualified medical expenses, or charitable contributions) from adjusted gross income (AGI).

**Exception:** Taxpayers with self-employment income or foreign-sourced income may qualify for exclusions or credits (e.g., Form 2555, Schedule C) that modify the base calculation—but these do not change the official brackets or rates.

**Married filing jointly vs Single**: For $120,000 of taxable income, a single filer pays $22,824 (using 2026 single brackets), while an MFJ couple pays $17,696—a difference of $5,128—primarily because MFJ brackets are nearly twice as wide as single brackets and the standard deduction is double ($32,200 vs $16,100).
