---
doc_id: "mx-investing-crypto-criptomonedas-que-son"
title_es: "Criptomonedas: ¿qué son y cómo se pagan impuestos en México?"
title_en: "Cryptocurrencies: What They Are and How Taxes Apply in Mexico"
language: "en"
translation_of: "mx-investing-crypto-criptomonedas-que-son"
country: "mx"
jurisdiction: "MX-FED"
domain: "investing"
subdomain: "crypto"
concept_ids: [mx.cripto.treatment, mx.isr.pf_brackets, mx.isr.pf_top_rate, mx.resico.pf_cap]
age_bands: [tier3, tier4, tier5]
depth_tier: "intro"
volatility: "static"
last_verified_date: "2026-06-21"
verified_by: "qwen-pipeline"
review_due: null
sources: [src_gen_b306d4d2, src_gen_e3d9cbd6, src_lisr]
status: "review"
currency: "MXN"
schema_version: "kb-1.0"
---
## For future Claude
This document explains cryptocurrencies from the Mexican tax perspective (MX-FED), updated as of 2026-06-20. Unlike the U.S., Mexico has no special regime for virtual assets: they are governed by the Income Tax Law (LISR) like any other property. The treatment is static and grounded in verifiable legal facts—not market practices or opinions.

## For young learners (tier3-4) <!-- age_band: tier3,tier4 -->
Imagine receiving digital coins as a gift or using them to buy something online. In Mexico, this isn’t magic or tax-free: every time you swap one digital coin for another, for cash, or for a product, **it’s treated like selling an object**. If you sell something for more than you paid, that’s a gain—and that gain counts toward your annual tax return. For example, if you buy a digital coin for $1,000 and later swap it for another digital coin worth $1,500, you’ve made a $500 gain. That gain must be reported on your annual tax declaration.

There’s no single flat rate: it depends on your total income for the year. The law says there are <!-- @fact id=mx.isr.pf_brackets value="11" verified=2026-06-21 src=src_lisr volatility=low --> distinct tax brackets for individuals who work or earn income independently. The highest bracket reaches <!-- @fact id=mx.isr.pf_top_rate value="35%" verified=2026-06-21 src=src_lisr volatility=low -->. But if your total annual income is under <!-- @fact id=mx.resico.pf_cap value="3,500,000 MXN" verified=2026-06-21 src=src_gen_e3d9cbd6 volatility=low -->, you may use the simplified tax regime (RESICO), paying monthly rates between 1% and 2.5%—and skipping those brackets entirely.

## For teens and young adults (tier5) <!-- age_band: tier5 -->
In Mexico, cryptocurrencies are officially called *virtual assets*. Under Article 14 of the Income Tax Law (LISR), swapping one cryptocurrency for another is a *barter transaction*, legally classified as *disposal of property*—i.e., a sale. It is not exempt: it triggers taxable gain if the value of what you receive exceeds the value of what you give up (Art. 14, Section III, LISR). This applies to both individuals and companies.

The SAT confirms there is no special regime: the *general LISR regime applies*, with no exceptions for crypto-to-crypto swaps <!-- @fact id=mx.cripto.treatment value="régimen general LISR (sin régimen especial): tributa como enajenación de bienes / ingreso al REALIZAR ganancia" verified=2026-06-21 src=src_lisr volatility=low -->. It doesn’t matter whether you withdraw money to your bank: the gain arises at the moment of the swap. Likewise, if you pay for services or goods using cryptocurrencies, the gain or loss is calculated in Mexican pesos based on the fair market value at the time of the transaction.

If your annual income is below <!-- @fact id=mx.resico.pf_cap value="3,500,000 MXN" verified=2026-06-21 src=src_gen_e3d9cbd6 volatility=low -->, you may opt for RESICO and pay fixed monthly rates between 1% and 2.5%, without calculating individual gains. But if you exceed that threshold, you must apply the annual progressive rate schedule with <!-- @fact id=mx.isr.pf_brackets value="11" verified=2026-06-21 src=src_lisr volatility=low --> brackets, capped at <!-- @fact id=mx.isr.pf_top_rate value="35%" verified=2026-06-21 src=src_lisr volatility=low -->.

## For all (key summary) <!-- age_band: tier3,tier4,tier5 -->
✅ Swapping cryptocurrency for cryptocurrency = tax is due on the gain (not exempt). 
✅ The same law applies as for selling physical items or earning income from work. 
✅ Gain is measured in Mexican pesos, using the value at the time of the transaction. 
✅ If annual income is under <!-- @fact id=mx.resico.pf_cap value="3,500,000 MXN" verified=2026-06-21 src=src_gen_e3d9cbd6 volatility=low -->, RESICO offers low, simple monthly rates. 
✅ If income exceeds that amount, the <!-- @fact id=mx.isr.pf_brackets value="11" verified=2026-06-21 src=src_lisr volatility=low -->-bracket general rate applies, up to a maximum of <!-- @fact id=mx.isr.pf_top_rate value="35%" verified=2026-06-21 src=src_lisr volatility=low -->.
