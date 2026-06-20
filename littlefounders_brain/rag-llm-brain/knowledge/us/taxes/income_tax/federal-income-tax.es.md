---
doc_id: us-taxes-income_tax-federal-income-tax
title_es: "El impuesto federal sobre la renta en EE.UU."
title_en: "US federal income tax"
language: es
translation_of: null
country: us
jurisdiction: US-FED
domain: taxes
subdomain: income_tax
concept_ids: [tax.income.federal]
age_bands: [tier3, tier4, tier5]
depth_tier: intermediate
volatility: high
last_verified_date: 2026-06-19
verified_by: jesusv
review_due: 2026-09-19
sources: [src_irs_2026_inflation, src_irs_obbba, src_irs_home]
status: published
currency: USD
schema_version: kb-1.0
---
## For future Claude
Doc sobre el **impuesto federal sobre la renta de EE.UU.** (el que administra el **IRS**), en dólares
(USD), verificado al 2026-06-19. Sirve tiers 3-5. La estructura de 7 tramos la volvió permanente la
*One Big Beautiful Bill* (OBBBA, firmada 2025-07-04), pero los montos de deducción estándar se ajustan
cada año por inflación, así que son **volátiles** — re-verificar antes del año fiscal 2027.
**Diferenciador clave:** este es el impuesto **federal** de EE.UU.; los estados pueden cobrar su
propio income tax encima. **NO** es el ISR de México y **NO** lo administra el SAT — mantener términos
mexicanos fuera de este doc.

## Para jóvenes (tier3-4) <!-- age_band: tier3,tier4 -->

El **impuesto federal sobre la renta** es el dinero que la gente en Estados Unidos paga al gobierno
nacional sobre lo que **gana**: un sueldo, propinas o lo que ganas con un pequeño negocio. Lo recauda
una oficina llamada **IRS** (Internal Revenue Service), y se paga en **dólares**.

La idea más importante es que **no todos pagan la misma parte**. El sistema es **escalonado**: tu
ingreso se parte en tramos, como los escalones de una escalera. La primera parte de lo que ganas paga
muy poco, y solo la parte que entra en escalones más altos paga una parte mayor. Por eso a alguien que
gana más se le pide una porción un poco más grande de cada dólar extra, no de todo su dinero.

Antes de calcular nada, el gobierno te deja restar una cantidad fija que **no paga impuesto**, llamada
**deducción estándar**. Es como un descuento automático: si ganaste poco, puede que esa cantidad libre
cubra casi todo y termines pagando muy poquito o nada.

Cada año, las personas llenan un formulario (el famoso "1040") donde cuentan cuánto ganaron y cuánto
ya les habían retenido de cada cheque. Si retuvieron de más, el IRS les **devuelve** la diferencia; si
fue de menos, pagan lo que falta. Aprender esto temprano te ayuda a entender por qué tu primer cheque
de trabajo es más chico que el número que te prometieron.

## Avanzado (tier5) <!-- age_band: tier5 -->

El impuesto federal sobre la renta de EE.UU. es **progresivo**: se aplica mediante **7 tramos**
marginales con tasas de **10%, 12%, 22%, 24%, 32%, 35% y 37%**. La *One Big Beautiful Bill* (OBBBA),
firmada el **4 de julio de 2025**, volvió **permanente** esa estructura de tramos, que antes tenía
fecha de expiración. Todo lo administra el **IRS**.

Es esencial distinguir dos tasas:

- **Tasa marginal:** la que aplica al **último dólar** ganado (el tramo más alto que alcanzas). Es la
  que determina cuánto te cuesta un ingreso adicional.
- **Tasa efectiva:** el impuesto total dividido entre el ingreso total. Siempre es **menor** que la
  marginal, porque los primeros tramos se gravaron a tasas bajas. Confundirlas hace creer que "subir
  de tramo" castiga todo tu sueldo, lo cual es falso: solo el dinero dentro del tramo nuevo paga la
  tasa nueva.

El cálculo parte del **AGI** (*adjusted gross income*, ingreso bruto ajustado): ingreso total menos
ciertos ajustes. De ahí se resta la **deducción estándar** para llegar al ingreso gravable. Para el
año fiscal **2026**, la deducción estándar es de **$16,100** para contribuyentes solteros
<!-- @fact id=us.std_deduction.single value=16,100 verified=2026-06-19 src=src_irs_2026_inflation volatility=high -->
y de **$32,200** para casados que declaran en conjunto (*married filing jointly*).
<!-- @fact id=us.std_deduction.mfj value=32,200 verified=2026-06-19 src=src_irs_2026_inflation volatility=high -->

> **Diferenciador US vs MX:** este es el income tax **federal** de EE.UU., en USD, administrado por el
> **IRS**. Los **estados** pueden cobrar su propio impuesto sobre la renta **encima** del federal (con
> tasas y reglas propias). **No** es el ISR mexicano ni lo administra el SAT; son sistemas distintos y
> no deben mezclarse.
