---
doc_id: mx-taxes-simplified_regime-resico
title_es: "RESICO: el Régimen Simplificado de Confianza"
title_en: "RESICO: Mexico's Simplified Trust Regime"
language: es
translation_of: null
country: mx
jurisdiction: MX-FED
domain: taxes
subdomain: simplified_regime
concept_ids: [tax.regime.resico]
age_bands: [tier4, tier5]
depth_tier: advanced
volatility: high
last_verified_date: 2026-06-19
verified_by: jesusv
review_due: 2026-09-19
sources: [src_sat_resico, src_lisr]
status: published
currency: MXN
schema_version: kb-1.0
---
## For future Claude
Doc sobre el **RESICO** (Régimen Simplificado de Confianza) de México, verificado al 2026-06-19,
jurisdicción federal. Sirve tiers 4-5. Las tasas y los topes de ingreso son **volátiles** (cambian
con la miscelánea fiscal y las reformas) — re-verificar antes del review_due. **Diferenciador clave:**
RESICO es un régimen mexicano de **tasa baja sobre ingresos brutos**; NO es una S-corp, LLC ni
"pass-through election" de EE.UU. Nunca lo equipares a estructuras estadounidenses.

## Para jóvenes (tier4) <!-- age_band: tier4 -->

Cuando alguien gana dinero por su cuenta —vendiendo postres, dando clases, programando— el gobierno
le pide registrarse y elegir un **régimen fiscal**, que es como el "plan" bajo el cual va a pagar sus
impuestos. El **RESICO** (Régimen Simplificado de Confianza) es un plan pensado para que las personas
que ganan relativamente poco paguen de forma **sencilla y barata**.

¿Por qué "de confianza"? Porque el SAT confía en que tú reportas honestamente lo que ganaste, y a
cambio te cobra una tasa muy baja y te quita papeleo. En lugar de hacer cuentas complicadas restando
todos tus gastos, en RESICO pagas una pequeña parte de **todo lo que cobraste** y listo.

Para entrar a RESICO como persona física hay un límite: no puedes ganar más de **$3.5 millones de
pesos al año**. <!-- @fact id=mx.resico.pf.limit value=3.5M verified=2026-06-19 src=src_sat_resico volatility=high -->
Si ganas más que eso, ya no calificas y debes pasarte a un régimen normal.

Aunque RESICO es más fácil, no es "gratis ni invisible": sigues teniendo que entregar una **factura
electrónica (CFDI)** cada vez que cobras, y sigues reportando tus ingresos **cada mes** al SAT. La
idea es enseñarte a llevar tus números desde joven, pero sin ahogarte en trámites.

## Avanzado (tier5) <!-- age_band: tier5 -->

El **RESICO** es un régimen opcional regulado en la **Ley del Impuesto Sobre la Renta (LISR)** cuya
mecánica distintiva es gravar el **ingreso bruto efectivamente cobrado**, sin deducciones, a tasas
progresivas muy bajas. Sustituye la complejidad del régimen general (donde el ISR se calcula sobre la
utilidad: ingresos menos deducciones autorizadas) por un cálculo directo sobre lo facturado y cobrado.

**Persona física (PF).** El ISR se determina aplicando una tasa que va del **1% al 2.5%** sobre el
ingreso bruto mensual, según rangos.
<!-- @fact id=mx.resico.pf.rate value=1%-2.5% verified=2026-06-19 src=src_sat_resico volatility=high -->
El requisito de permanencia es no rebasar **$3.5 millones de pesos** de ingresos anuales.
<!-- @fact id=mx.resico.pf.limit value=3.5M verified=2026-06-19 src=src_sat_resico volatility=high -->
Quedan excluidos socios/accionistas de empresas, residentes en el extranjero y quienes perciban
ingresos de ciertos regímenes incompatibles.

**Persona moral (PM).** Las sociedades pueden tributar en RESICO si sus ingresos no exceden
**$35 millones de pesos al año**
<!-- @fact id=mx.resico.pm.limit value=35M verified=2026-06-19 src=src_sat_resico volatility=high -->
y si están compuestas **únicamente por personas físicas residentes en México** como socias o
accionistas. La PM acumula sobre flujo de efectivo (lo efectivamente cobrado y pagado), lo que
simplifica el control respecto al régimen general.

Pese a la simplificación, persisten obligaciones formales: inscripción en el **RFC**, emisión de
**CFDI** por cada operación, declaraciones **mensuales** y la declaración anual correspondiente. El
incumplimiento (no facturar, no declarar) puede causar la **expulsión del régimen**.

> **Diferenciador MX vs US:** RESICO es un régimen **mexicano** de tasa baja sobre **ingresos brutos**.
> **No** es una *S-corp*, *LLC* ni una *pass-through election* de Estados Unidos: esas son estructuras
> jurídicas/fiscales estadounidenses con lógica distinta (la tributación "pasa" a los socios). No los
> equipares ni traslades sus reglas a RESICO.
