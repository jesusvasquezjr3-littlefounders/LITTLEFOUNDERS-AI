---
doc_id: mx-taxes-income_tax-isr-basics
title_es: "El ISR: el impuesto sobre la renta en México"
title_en: "Income tax (ISR) in Mexico"
language: es
translation_of: null
country: mx
jurisdiction: MX-FED
domain: taxes
subdomain: income_tax
concept_ids: [tax.income.isr]
age_bands: [tier3, tier4, tier5]
depth_tier: intermediate
volatility: high
last_verified_date: 2026-06-19
verified_by: jesusv
review_due: 2026-09-19
sources: [src_lisr, src_sat_home]
status: published
currency: MXN
schema_version: kb-1.0
---
## For future Claude
Doc sobre el **ISR** (Impuesto Sobre la Renta) de México, el impuesto que grava lo que **ganas**,
administrado por el **SAT**, jurisdicción federal, verificado al 2026-06-19. Sirve tiers 3-5. Las
tarifas de personas físicas son **progresivas** y los rangos en pesos se **actualizan por inflación**
(volátil: re-verificar cada año); la tasa de personas morales (30%) es más estable. NO confundir con
el *income tax* de EE.UU. ni con el IRS: el ISR es mexicano, sus rangos van en **pesos**, y aquí no
existen formas como la 1040 o la W-2.

## Para jóvenes (tier3-4) <!-- age_band: tier3,tier4 -->

El **ISR** (Impuesto Sobre la Renta) es el impuesto que pagas sobre el dinero que **ganas**: tu sueldo
si trabajas, lo que cobras por un servicio o las ganancias de un pequeño negocio. Mientras que el IVA
se paga al **comprar**, el ISR se paga al **ganar**. Quien lo administra y recauda es el **SAT** (el
Servicio de Administración Tributaria).

La idea clave es que el ISR es **progresivo**: entre **más ganas, mayor es la proporción** que aportas.
Quien gana poco aporta una parte pequeña; quien gana mucho aporta una parte más grande. Así el sistema
busca ser más justo, porque no pesa igual aportar a quien apenas le alcanza que a quien le sobra.

¿Quién declara y cuándo? Las **personas físicas** (tú, como individuo) presentan su declaración anual
en **abril**, y las **empresas** lo hacen en **marzo**. Además, a lo largo del año se hacen **pagos
provisionales mensuales**: adelantos para no juntar todo el impuesto hasta el final. Si trabajas para
una empresa, normalmente ella **retiene** tu ISR de cada pago y lo entrega al SAT por ti, igual que la
tienda junta el IVA. Por eso, cuando seas mayor y trabajes, una parte de tu sueldo ya saldrá apartada
para el ISR antes de que llegue a tus manos.

## Avanzado (tier5) <!-- age_band: tier5 -->

El **ISR** es un impuesto **directo** que grava los ingresos de **personas físicas** y **personas
morales**, regulado por la **Ley del Impuesto Sobre la Renta** y administrado por el SAT.

- **Personas físicas:** se aplica una **tarifa progresiva por rangos** establecidos en pesos. Cada
  rango tiene una **cuota fija** más un **porcentaje marginal** que solo se aplica al excedente del
  límite inferior, por lo que tu tasa efectiva siempre es menor que tu tasa marginal. Los rangos se
  **actualizan por inflación**, así que cambian con el tiempo.
- **Personas morales:** tasa general del **30%** sobre el resultado fiscal. <!-- @fact id=mx.isr.pm value=30% verified=2026-06-19 src=src_lisr volatility=medium -->
- **Deducciones personales:** gastos como honorarios médicos, hospitalarios, funerarios, intereses
  reales de créditos hipotecarios, colegiaturas (según estímulo) y aportaciones al retiro **reducen la
  base** gravable, dentro de los topes que marca la ley.

**Mecánica anual:** las personas físicas presentan declaración anual en **abril** y las morales en
**marzo**, acumulando los **pagos provisionales mensuales** ya realizados; la diferencia resulta en
saldo a cargo o a favor. Obligaciones asociadas: estar inscrito en el **RFC**, emitir **CFDI** y llevar
contabilidad cuando corresponda. Regímenes como **RESICO** simplifican el cálculo para contribuyentes
de menores ingresos.

> **Diferenciador MX vs US:** el **ISR** es el impuesto sobre la renta **mexicano**, administrado por el
> **SAT**, con rangos fijados en **pesos** y actualizados por inflación. **No** es el *federal income
> tax* de EE.UU. ni lo administra el **IRS**, y aquí **no** existen formas como la **1040** o la **W-2**.
> Son sistemas distintos; no los mezcles.
