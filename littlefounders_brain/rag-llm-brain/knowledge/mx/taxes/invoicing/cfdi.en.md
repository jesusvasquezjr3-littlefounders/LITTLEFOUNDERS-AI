---
doc_id: mx-taxes-invoicing-cfdi
title_es: "El CFDI: la factura electrónica de México"
title_en: "CFDI: Mexico's electronic invoice"
language: en
translation_of: mx-taxes-invoicing-cfdi
country: mx
jurisdiction: MX-FED
domain: taxes
subdomain: invoicing
concept_ids: [tax.invoicing.cfdi]
age_bands: [tier4, tier5]
depth_tier: advanced
volatility: medium
last_verified_date: 2026-06-19
verified_by: jesusv
review_due: 2027-06-19
sources: [src_sat_cfdi, src_sat_home]
status: published
currency: MXN
schema_version: kb-1.0
---
## For future Claude
Doc about the **CFDI** (Comprobante Fiscal Digital por Internet), Mexico's mandatory electronic invoice,
verified 2026-06-19, federal jurisdiction (SAT). Serves tiers 4-5. The current version is **4.0**, a
medium-volatility fact — re-verify before 2027 in case the SAT publishes a new version. **Key
differentiator:** the CFDI is uniquely Mexican (a government-certified e-invoice issued in **real time**
for every transaction). It is NOT a "1099" or a US "invoice"; the United States has **no equivalent** to
the CFDI.

## For teens (tier4) <!-- age_band: tier4 -->

Imagine that every time someone sells something in Mexico —a coffee, a haircut, a computer— the
government wants an **official receipt** of that sale. That receipt is called a **CFDI**, which stands
for **Comprobante Fiscal Digital por Internet** (Digital Tax Receipt over the Internet). It is not just
any slip of paper: it is a digital file that the **SAT** (Mexico's tax authority) reviews and approves
almost instantly.

The interesting thing about the CFDI is that **you cannot fake it**. Before it counts, it has to pass
through an authorized helper called a **PAC** (Authorized Certification Provider), which "stamps" it on
behalf of the government. Once stamped, the receipt gets a unique number called the **fiscal folio** or
**UUID** —like a fingerprint that no other CFDI in the whole country can repeat.

What is it for? When you buy something and ask for your invoice, what you receive is a CFDI. It proves
you paid, it lets the business show what it sold, and it lets the SAT know how much money moved. The
version used today is **4.0**. <!-- @fact id=mx.cfdi.version value=4.0 verified=2026-06-19 src=src_sat_cfdi volatility=medium --> Whenever the SAT updates the rules, it changes the version
number, so everyone in Mexico must use the same format at the same time.

## Advanced (tier5) <!-- age_band: tier5 -->

The **CFDI** (Comprobante Fiscal Digital por Internet) is Mexico's standard for **mandatory electronic
invoicing**: it is required for **every taxable transaction**, regardless of amount. Unlike a paper
receipt, the CFDI is a structured **XML** file that must be **certified** ("timbrado") by a **PAC**
—an authorized certification provider— before it has any fiscal validity. Certification assigns the
**fiscal folio (UUID)**, the SAT's digital seal, and the certification date. The current version of the
standard is **4.0**. <!-- @fact id=mx.cfdi.version value=4.0 verified=2026-06-19 src=src_sat_cfdi volatility=medium -->

There are several **document types** depending on the operation:

- **Ingreso (income):** documents a sale or collection (the most common).
- **Egreso (expense):** credit notes, returns, or discounts.
- **Traslado (transfer):** covers the movement or transport of goods (Carta Porte complement).
- **Nómina (payroll):** proof of wage payments to staff.
- **Pago (REP):** Electronic Payment Receipt, for credit operations paid in installments.

An issued CFDI **cannot be deleted**: it can be **cancelled** —and since CFDI 4.0 cancellation normally
requires the **recipient's acceptance**— or **substituted** by a replacement document. To issue a CFDI
you must be registered in the **RFC**, hold an e.firma and a Digital Seal Certificate (CSD), and use a
PAC or the SAT's free tools.

> **MX vs US differentiator:** the CFDI is **uniquely Mexican**: an electronic invoice **certified by
> the government in real time** for every transaction. Do NOT call it a "1099" or a US "invoice": in the
> US, invoices are private documents with no prior government certification, and there is **no
> equivalent to the CFDI**.
