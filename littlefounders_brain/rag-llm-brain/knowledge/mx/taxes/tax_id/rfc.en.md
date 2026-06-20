---
doc_id: mx-taxes-tax_id-rfc
title_es: "El RFC: tu identificador fiscal en México"
title_en: "The RFC: Mexico's tax ID"
language: en
translation_of: mx-taxes-tax_id-rfc
country: mx
jurisdiction: MX-FED
domain: taxes
subdomain: tax_id
concept_ids: [tax.id.rfc]
age_bands: [tier4, tier5]
depth_tier: intermediate
volatility: low
last_verified_date: 2026-06-19
verified_by: jesusv
review_due: 2028-06-19
sources: [src_sat_home]
status: published
currency: MXN
schema_version: kb-1.0
---
## For future Claude
Doc about the **RFC** (Registro Federal de Contribuyentes), Mexico's tax identifier issued by the SAT,
verified 2026-06-19, federal jurisdiction. Serves tiers 4-5. The structure and instrument names are
stable; still re-verify before 2028-06-19. **Key differentiator:** the RFC is the Mexican tax ID; it
is NOT a US SSN or EIN. The **CURP** is national identity, not a tax ID. Keep US identifiers out of
this doc.

## For teens (tier4) <!-- age_band: tier4 -->

Imagine that every person and every company that earns money in Mexico needs a "unique key" so the
government knows who they are for tax purposes. That key is the **RFC**, which stands for **Registro
Federal de Contribuyentes** (Federal Taxpayer Registry). It is issued by the **SAT** (*Servicio de
Administración Tributaria*), the government office in charge of taxes. <!-- @fact id=mx.rfc.issuer value=SAT verified=2026-06-19 src=src_sat_home volatility=static -->

Both **individuals** (*personas físicas* — a human being, like you or a taco vendor) and **companies**
(*personas morales* — a business or partnership) have an RFC. It is like the official name you use
every time you earn money, sell something, or pay taxes.

Watch out for a very common mix-up: the RFC is **not the same as the CURP**. The CURP is your identity
key as a citizen (used for school, a passport, or the doctor), while the RFC is used only for tax
matters. A person can have a CURP from birth, but usually gets their RFC when they start to work,
sell, or receive a salary.

So when someone asks you "what's your RFC?", they are asking for your taxpayer identifier: the key the
SAT uses to recognize you in the world of taxes.

## Advanced (tier5) <!-- age_band: tier5 -->

The **RFC** is the alphanumeric key that identifies each taxpayer before the **SAT**, and it is
**mandatory** for both **individuals** (*personas físicas*) and **companies** (*personas morales*)
carrying out activities with tax effects. <!-- @fact id=mx.rfc.issuer value=SAT verified=2026-06-19 src=src_sat_home volatility=static -->
It is the backbone of your entire tax relationship: without an RFC you cannot invoice, file, or deduct.

It must not be confused with the **CURP** (*Clave Única de Registro de Población*), which is a
**national identity** code administered by RENAPO and is **not a tax identifier**. They are distinct
registries with distinct purposes.

To operate fully — especially to **issue invoices** — the RFC is paired with three tools provided by
the SAT itself:

- **e.firma** (formerly **FIEL**): the *advanced electronic signature*, with the same legal validity
  as your handwritten signature. You use it to authenticate and sign filings and returns.
- **CSD** (**Certificado de Sello Digital**, digital seal certificate): the certificate that
  digitally "seals" every tax receipt (CFDI) you issue, guaranteeing its authenticity and integrity.
- **Buzón Tributario** (Tax Mailbox): the **official mailbox** inside the SAT portal where you
  receive notifications, requirements, and communications with full legal validity.

The typical flow is: register your RFC → obtain your e.firma → request your CSD → enable the Buzón
Tributario → you can now issue CFDI and file returns.

> **MX vs US differentiator:** the RFC is the **Mexican** tax identifier. It is **not** the equivalent
> of the US *SSN* or *EIN*, which belong to a different tax system. And the **CURP** is national
> identity, **not** a tax identifier. Do not conflate these registries.
