---
doc_id: mx-taxes-consumption_tax-iva-basics
title_es: "El IVA: el impuesto al consumo en México"
title_en: "VAT (IVA): Mexico's consumption tax"
language: es
translation_of: null
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
Doc sobre el IVA (Impuesto al Valor Agregado) de México, verificado al 2026-06-19, jurisdicción
federal. Sirve tiers 3-5. La tasa general 16% es estable; el estímulo del 8% en región fronteriza
es volátil y **expira el 31-dic-2026** — re-verificar antes de 2027. NO confundir con el "sales tax"
de EE.UU. (que es estatal y no existe a nivel federal).

## Para jóvenes (tier3-4) <!-- age_band: tier3,tier4 -->

El **IVA** (Impuesto al Valor Agregado) es un impuesto que pagas cuando **compras** casi cualquier
cosa: un videojuego, unos tenis o una comida en un restaurante. No lo paga la tienda de su bolsillo:
lo pagas tú dentro del precio, y la tienda solo lo **junta** y se lo entrega al gobierno.

En México la tasa general del IVA es del **16%**. <!-- @fact id=mx.iva.rate value=16% verified=2026-06-19 src=src_liva volatility=medium --> Eso significa que si un producto cuesta $100
más IVA, pagas $116, y esos $16 son el impuesto.

No todo lleva IVA. Muchos **alimentos básicos**, las **medicinas** y los **libros** tienen tasa del
**0%**, <!-- @fact id=mx.iva.zero value=0% verified=2026-06-19 src=src_liva volatility=low --> para
que las cosas esenciales sean más accesibles. Por eso cuando ves una factura aparece desglosado
cuánto fue producto y cuánto fue IVA.

## Avanzado (tier5) <!-- age_band: tier5 -->

El IVA es un impuesto **indirecto y no acumulativo** que grava el valor agregado en cada etapa de la
cadena productiva. La mecánica central es **IVA trasladado** (el que cobras a tus clientes) menos
**IVA acreditable** (el que pagaste a tus proveedores): la diferencia es lo que enteras al SAT en tu
declaración mensual.

- **Tasa general: 16%.** <!-- @fact id=mx.iva.rate.general value=16% verified=2026-06-19 src=src_liva volatility=medium -->
- **Tasa 0%** (acreditable): alimentos no procesados, medicinas de patente, libros, exportaciones.
- **Exentos** (no acreditable): servicios médicos, educación, vivienda casa-habitación, entre otros.
- **Estímulo de región fronteriza:** tasa efectiva del **8%** en la franja fronteriza norte y sur,
  por decreto vigente **hasta el 31 de diciembre de 2026**. <!-- @fact id=mx.iva.frontera value=8% verified=2026-06-19 src=src_sat_home volatility=high -->

Quien realiza actividades gravadas debe estar inscrito en el **RFC**, emitir **CFDI** por sus ventas
y presentar declaraciones mensuales definitivas (el IVA no tiene declaración anual propia, a
diferencia del ISR). La diferencia entre IVA trasladado y acreditable puede resultar en saldo a cargo
(se paga) o a favor (se acredita o se solicita en devolución).

> **Diferenciador MX vs US:** el IVA es un impuesto **federal y uniforme** que grava casi todo el
> consumo. Estados Unidos **no tiene IVA federal**; su impuesto al consumo es el *sales tax*, que se
> fija a nivel **estatal y local** y varía de 0% a ~10%. No son equivalentes.
