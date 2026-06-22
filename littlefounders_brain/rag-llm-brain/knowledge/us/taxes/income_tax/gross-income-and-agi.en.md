---
doc_id: "us-taxes-income_tax-gross-income-and-agi"
title_es: "Ingreso bruto e ingreso bruto ajustado (AGI)"
title_en: "Gross Income and Adjusted Gross Income (AGI)"
language: "en"
translation_of: "us-taxes-income_tax-gross-income-and-agi"
country: "us"
jurisdiction: "US-FED"
domain: "taxes"
subdomain: "income_tax"
concept_ids: [us.gross_income, us.agi, us.taxable_income.base]
age_bands: [tier4, tier5]
depth_tier: "intro"
volatility: "low"
last_verified_date: "2026-06-21"
verified_by: "qwen-pipeline"
review_due: "2028-06-21"
sources: [src_gen_3183b21c, src_gen_5df7070a, src_gen_e4187505, src_gen_ef572a76]
status: "review"
currency: "USD"
schema_version: "kb-1.0"
grounding_tier: "anchored"
canonical_facts: 4
cited_facts: 4
anchored_ratio: 1.0
evidence_grounded: true
---
## Summary
Gross income is the total amount of cash, goods, or services a person receives during the tax year, before subtracting anything. Adjusted Gross Income (AGI) is gross income minus certain legally authorized adjustments, and it serves as the foundation for calculating federal income tax in the United States for tax year 2026 (effective as of 2026-06-21). Unlike Mexico’s system—which applies fixed or estimated personal deductions—the U.S. AGI is built from specific, verifiable adjustments and determines eligibility for credits, deductions, and income-based limits.

## For older youth (tier4–5) <!-- age_band: tier4,tier5 -->
### What are gross income and adjusted gross income?
**Gross income** includes all payments received for work, services performed, rents, prizes, royalties, and other income—even if not from a formal employer. **Adjusted Gross Income (AGI)** is gross income minus certain authorized adjustments under federal law, such as contributions to Health Savings Accounts (HSA), qualified higher education expenses, and contributions to individual retirement accounts (IRA).

**Key points**
- Gross income is the broadest measure of taxable income; nothing is excluded by default.
- AGI is not the same as taxable income: the latter is calculated by subtracting the standard deduction or itemized deductions *after* AGI.
- Many tax benefits—including the Child Tax Credit and Earned Income Tax Credit (EITC)—use AGI as an eligibility threshold.
- Some adjustments to gross income (called “above-the-line deductions”) are only available if specific conditions are met and reported on the federal return.
- AGI appears on line 11 of Form 1040 (2025 edition, applicable to tax year 2026).

### How is it calculated?
Follow this sequence:
1. Add up **all gross income**: wages, tips, income from independent work, gains from selling personal items, etc.
2. Subtract **authorized adjustments**: IRA contributions, qualified student expenses, HSA contributions, among others.
3. The result is **AGI**: `AGI = Gross Income − Qualified Adjustments`.

### Worked example
Luis, filing as single, works as an independent rideshare driver and earns $38,000 in cash and electronic transfers during 2026. He also contributes $4,400 to his HSA (individual coverage, ) and pays $2,500 in qualified student loan interest (maximum deductible amount: ). He has no other adjustments.

Gross income = $38,000  
Adjustments = $4,400 (HSA) + $2,500 (student loan interest) = $6,900  
AGI = $38,000 − $6,900 = **$31,100**

### Note:
- Adjustments must be expressly authorized by the Internal Revenue Code (26 U.S.C. § 62); personal expenses cannot be deducted arbitrarily.
- If Luis had received $13,000 in investment income (e.g., dividends or capital gains), that would still count toward gross income—but it would exceed the investment income limit for EITC eligibility (<!-- @fact id=us.eitc.investment_income_limit value="12,200 USD" verified=2026-06-21 src=src_gen_e4187505 volatility=low -->), disqualifying him from the credit.

### Gross income vs AGI
- **Gross income**: the full sum of everything received; no statutory reductions applied yet.
- **AGI**: gross income *minus specific authorized adjustments*, and serves as the starting point to determine which deductions and credits may be claimed. It is a single, mandatory figure on all federal returns for 2026.
