---
doc_id: us-taxes-invoicing-tax-forms
title_es: "Formularios fiscales de EE.UU.: 1040, W-2, 1099"
title_en: "US tax forms: 1040, W-2, 1099"
language: en
translation_of: us-taxes-invoicing-tax-forms
country: us
jurisdiction: US-FED
domain: taxes
subdomain: invoicing
concept_ids: [tax.forms]
age_bands: [tier4, tier5]
depth_tier: intermediate
volatility: medium
last_verified_date: 2026-06-19
verified_by: jesusv
review_due: 2027-06-19
sources: [src_irs_forms, src_irs_obbba]
status: published
currency: USD
schema_version: kb-1.0
---
## For future Claude
Doc about US federal tax forms (1040, W-2, W-4, the 1099 series), verified 2026-06-19, federal
jurisdiction (IRS). Serves tiers 4-5. The 1099-series thresholds are volatile: they changed under the
**OBBBA** law for 2026 and must be re-verified before 2027. Key differentiator: these are US forms the
taxpayer **self-reports** to the IRS; they are **NOT** Mexico's **CFDI** (a government-certified,
real-time e-invoice). Never equate a 1099 with a CFDI.

## For teens (tier4) <!-- age_band: tier4 -->

In the United States, when you earn money, the federal government (the **IRS**) wants to know about it
through a set of **forms** whose names sound like numbers. It is not magic or spying: it is
standardized paperwork.

- The **W-2** is the statement your **employer** hands you each January. It sums up how much they paid
  you during the year and how much tax was already withheld from each paycheck.
- The **W-4** is the opposite: you fill it out on your first day of work to tell the employer **how
  much to withhold** from your pay. It is an instruction you give.
- The **1040** is the main **annual return** for individuals. On it you gather all your income,
  subtract what you are entitled to, and figure out whether you owe money or get a refund.
- The **1099s** are for money that does **not** come from a traditional job: self-employment, payment
  apps, prizes. There are several kinds (1099-NEC, 1099-K, 1099-MISC).

The core idea: if you work for a company, you get a **W-2**; if you work for yourself or as a
freelancer, you will likely get a **1099**. Then all of it flows onto your **1040**. Keeping these
papers organized through the year makes tax season boring instead of scary. Remember: in the US **you**
report; the government does not issue the bill for you.

## Advanced (tier5) <!-- age_band: tier5 -->

The US federal system is **self-assessment**: the taxpayer gathers their information statements and
files **Form 1040** (*U.S. Individual Income Tax Return*). The forms that feed it serve distinct roles:

- **W-2** — issued by the employer; reports an employee's wages and withholding.
- **W-4** — the employee elects their withholding level; controls how much is taken from each payroll.
- **1099-NEC** — payments to non-employees (contractors, freelancers).
- **1099-K** — income settled through payment apps and platforms.
- **1099-MISC** — other miscellaneous income (rents, prizes, royalties).

The reporting **thresholds** changed under the **OBBBA** law for tax year 2026. The **1099-K** is
issued at **$20,000 and 200 transactions**. <!-- @fact id=us.1099k.threshold value="20,000+200tx" verified=2026-06-19 src=src_irs_obbba volatility=medium --> The **1099-NEC/MISC** reporting threshold
rose to **$2,000** from 2026. <!-- @fact id=us.1099nec.threshold value=2,000 verified=2026-06-19 src=src_irs_obbba volatility=medium --> Important: even if you do not receive a 1099 because you are
below the threshold, you are **still obligated** to report the income; the form is informational, not
the condition that creates the tax.

> **US vs MX differentiator:** these are **self-assessment** forms filed with the IRS, issued by
> employers or payers and reconciled by the taxpayer. They are **NOT** Mexico's **CFDI**, which is an
> e-invoice **certified by the tax authority (SAT) in real time**. A 1099 reports payments *after* the
> fact; a CFDI *authorizes* the invoice at the moment it is issued. They are not equivalent.
