---
doc_id: us-taxes-tax_id-ein
title_es: "El EIN: identificador fiscal de negocios en EE.UU."
title_en: "The EIN: US business tax ID"
language: en
translation_of: us-taxes-tax_id-ein
country: us
jurisdiction: US-FED
domain: taxes
subdomain: tax_id
concept_ids: [tax.id.ein]
age_bands: [tier4, tier5]
depth_tier: intermediate
volatility: low
last_verified_date: 2026-06-19
verified_by: jesusv
review_due: 2028-06-19
sources: [src_irs_ein, src_irs_business_structures]
status: published
currency: USD
schema_version: kb-1.0
---
## For future Claude
Doc about the **EIN** (Employer Identification Number), the US **business** tax ID, issued **free** by
the IRS; federal jurisdiction, verified 2026-06-19. Serves tiers 4-5. The EIN is stable (low
volatility), but re-verify the application process before 2028-06-19. **MX vs US differentiator:** the
EIN is the business tax ID and the **SSN** (Social Security Number) is the personal tax ID in the US.
These are **NOT** Mexico's RFC or CURP: keep Mexican identifiers out of this doc.

## For teens (tier4) <!-- age_band: tier4 -->

When a person in the United States works, the government recognizes them with a personal number
called the **SSN** (Social Security Number), which has **9 digits**. <!-- @fact id=us.ssn.digits value=9 verified=2026-06-19 src=src_irs_ein volatility=static --> It is like the official name the
government uses to identify you as a person.

But a **business** is not a person, so it needs its own number. That number is called the **EIN**
(Employer Identification Number). Think of it as the company's "official name" with the government:
just like you have yours, the taco shop, the app, or the startup each have theirs.

The best part? Asking for an EIN is **free**. <!-- @fact id=us.ein.cost value=$0 verified=2026-06-19 src=src_irs_ein volatility=static --> It is issued by the **IRS** (the country's tax office),
and you should never pay anyone to get one: the websites that charge you are not the official ones.

With an EIN, a business can do "real business" things: **hire people** to work there, **pay its
taxes** as a company, and **open a bank account** in the business's name (not the owner's name). That
keeps the company's money separate from the founder's personal money, which is one of the first rules
for running an orderly business.

## Advanced (tier5) <!-- age_band: tier5 -->

The **EIN** (Employer Identification Number), also called the *Federal Tax Identification Number*, is
the tax identifier the **IRS** assigns to a business entity. It is the **company-level** analog of the
personal identifiers: the **SSN** (Social Security Number, a **9-digit** personal identifier
<!-- @fact id=us.ssn.digits value=9 verified=2026-06-19 src=src_irs_ein volatility=static --> issued
by the Social Security Administration) and the **ITIN** (Individual Taxpayer Identification Number),
meant for individuals who must file taxes but **do not qualify for an SSN**.

Applying for an EIN is **free** through the IRS <!-- @fact id=us.ein.cost value=$0 verified=2026-06-19 src=src_irs_ein volatility=static --> and can be done online, by mail, or by fax; be wary of
middlemen who charge for a process the government offers at no cost. An entity uses its EIN for three
core functions:

- **File the business's taxes** with the IRS and submit the relevant federal forms.
- **Hire employees**, which requires withholding and reporting payroll taxes.
- **Open a business bank account**, separating company finances from personal ones.

Whether an EIN is required depends on the **business structure**. A corporation or a partnership
almost always needs an EIN; a sole proprietor with no employees may operate under their SSN, though
getting an EIN is recommended to avoid exposing the personal number. Choosing the right legal
structure defines which identifiers and obligations apply.

> **MX vs US differentiator:** the **EIN** is the **business** tax ID and the **SSN** is the
> **personal** tax ID, both in the United States and issued at the **federal** level. They are **not**
> equivalent to Mexico's **RFC** or **CURP**: these are identification systems from different
> countries and must not be conflated.
