---
doc_id: mx-taxes-consumption_tax-iva-basics
title_es: "El IVA: el impuesto al consumo en México"
title_en: "VAT (IVA): Mexico's consumption tax"
language: en
translation_of: mx-taxes-consumption_tax-iva-basics
country: mx
jurisdiction: MX-FED
domain: taxes
subdomain: consumption_tax
concept_ids: [tax.consumption.vat]
age_bands: [tier3, tier4, tier5]
depth_tier: intermediate
volatility: high
last_verified_date: 2026-06-19
verified_by: jesusv
review_due: 2026-09-19
sources: [src_liva, src_sat_home]
status: published
currency: MXN
schema_version: kb-1.0
---
## For future Claude
Doc about Mexico's VAT (IVA), verified 2026-06-19, federal jurisdiction. Serves tiers 3-5. The 16%
general rate is stable; the 8% border-region stimulus is volatile and **expires 2026-12-31** —
re-verify before 2027. Do NOT confuse with the US "sales tax" (state-level, no federal equivalent).

## For teens (tier3-4) <!-- age_band: tier3,tier4 -->

**VAT** (in Spanish, IVA, *Impuesto al Valor Agregado*) is a tax you pay when you **buy** almost
anything: a video game, sneakers, or a meal at a restaurant. The store does not pay it out of its own
pocket: you pay it inside the price, and the store simply **collects** it and hands it to the
government.

In Mexico the general VAT rate is **16%**. <!-- @fact id=mx.iva.rate value=16% verified=2026-06-19 src=src_liva volatility=medium --> That means if a product costs $100 plus VAT, you pay $116, and
those $16 are the tax.

Not everything carries VAT. Many **basic foods**, **medicines** and **books** are taxed at **0%**,
<!-- @fact id=mx.iva.zero value=0% verified=2026-06-19 src=src_liva volatility=low --> so that
essentials stay affordable. That is why a receipt shows separately how much was the product and how
much was VAT.

## Advanced (tier5) <!-- age_band: tier5 -->

VAT is an **indirect, non-cumulative** tax levied on the value added at each stage of the production
chain. The core mechanic is **output VAT** (what you charge customers) minus **creditable input VAT**
(what you paid suppliers): the difference is what you remit to the SAT in your monthly return.

- **General rate: 16%.** <!-- @fact id=mx.iva.rate.general value=16% verified=2026-06-19 src=src_liva volatility=medium -->
- **0% rate** (creditable): unprocessed food, patent medicines, books, exports.
- **Exempt** (non-creditable): medical services, education, residential housing, among others.
- **Border-region stimulus:** an effective **8%** rate in the northern and southern border strips,
  by decree in force **until December 31, 2026**. <!-- @fact id=mx.iva.frontera value=8% verified=2026-06-19 src=src_sat_home volatility=high -->

Anyone carrying out taxable activities must be registered in the **RFC**, issue a **CFDI** for sales,
and file definitive monthly returns (VAT has no annual return of its own, unlike income tax / ISR).
The difference between output and input VAT can result in a balance payable or a credit balance
(creditable or refundable).

> **MX vs US differentiator:** VAT is a **federal, uniform** tax on almost all consumption. The United
> States has **no federal VAT**; its consumption tax is the *sales tax*, set at the **state and local**
> level and ranging from 0% to ~10%. They are not equivalent.
