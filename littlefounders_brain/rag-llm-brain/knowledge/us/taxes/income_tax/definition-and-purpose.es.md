---
doc_id: "us-taxes-income_tax-definition-and-purpose"
title_es: "Definición y propósito del impuesto sobre la renta (EE.UU., 2026)"
title_en: "Definition and Purpose of Income Tax (U.S. Federal, 2026)"
language: "es"
translation_of: null
country: "us"
jurisdiction: "US-FED"
domain: "taxes"
subdomain: "income_tax"
concept_ids: [us.income_tax.definition, us.withholding.purpose, us.tax_liability]
age_bands: [tier3, tier4, tier5]
depth_tier: "intro"
volatility: "static"
last_verified_date: "2026-06-21"
verified_by: "qwen-pipeline"
review_due: null
sources: [src_gen_4f88219b, src_gen_62f606d8, src_gen_e04d5966, src_gen_fc17b522]
status: "review"
currency: "USD"
schema_version: "kb-1.0"
grounding_tier: "anchored"
canonical_facts: 6
cited_facts: 6
anchored_ratio: 1.0
evidence_grounded: true
---
## Resumen
El impuesto sobre la renta federal de Estados Unidos es un tributo que el gobierno federal cobra sobre los ingresos que una persona recibe durante un año fiscal (del 1 de enero al 31 de diciembre), vigente a 2026-06-21. Aplica solo a ingresos sujetos a gravamen según el Internal Revenue Code (título 26 del U.S. Code), no a todos los flujos de dinero. A diferencia del sistema mexicano (donde el impuesto se calcula anualmente sobre la base total y se paga en abril), en EE.UU. se aplica principalmente mediante retención en la fuente: el empleador quita una parte de cada cheque de sueldo para pagarla directamente al IRS. Este mecanismo evita pagos grandes al final del año y reduce riesgos de multas por subretención.

## Para jóvenes (tier3-4) <!-- age_band: tier3,tier4 -->
El impuesto sobre la renta es como una cuota que pagas al gobierno federal por vivir y trabajar en Estados Unidos. Si ganas dinero trabajando (por ejemplo, en un trabajo de verano o como asistente escolar), una parte de ese dinero se retiene automáticamente de tu sueldo antes de que lo recibas. Esa parte va al gobierno para financiar servicios públicos como carreteras, escuelas y hospitales. No todas las personas pagan: si tus ingresos son muy bajos (menos de <!-- @fact id=us.std_deduction.single value="16,100 USD" verified=2026-06-21 src=src_gen_fc17b522 volatility=low --> en 2026 si eres soltero), no debes impuesto y puedes pedir que no te retengan nada. Pero si ganas más, sí se retiene — y al final del año, cuando presentas tu declaración (Form 1040), puedes recibir un reembolso si se retuvo de más, o pagar lo faltante si se retuvo de menos.

**Ejemplo ilustrativo:** Ana, de 17 años, trabaja medio tiempo y gana $18,000 en 2026. Su empleador usa la Forma W-4 para calcular cuánto retener. Como su ingreso supera la deducción estándar para solteros (<!-- @fact id=us.std_deduction.single value="16,100 USD" verified=2026-06-21 src=src_gen_fc17b522 volatility=low -->), debe impuesto sobre la parte excedente. Suponiendo una tasa efectiva promedio del 12% sobre esa base imponible, su retención anual aproximada sería: ($18,000 − $16,100) × 12% = $1,900 × 12% = $228. Esto es solo una estimación didáctica; el monto real depende de su W-4 y de la tabla de retención oficial del IRS.

## Para adultos jóvenes y adultos (tier5) <!-- age_band: tier5 -->
El impuesto sobre la renta federal es un tributo progresivo impuesto por el gobierno de Estados Unidos sobre la renta neta gravable de individuos, conforme al Internal Revenue Code § 1, vigente para el ejercicio fiscal 2026.

**Puntos clave**
- Es un impuesto *progresivo*: cuanto más gana una persona, mayor es el porcentaje que paga sobre las partes más altas de sus ingresos.
- Se financia mediante *retención en la fuente* (por empleadores) y/o *pagos estimados* (para ingresos no salariales como trabajos independientes o alquileres).
- La base imponible se obtiene restando deducciones autorizadas (como la deducción estándar o gastos deducibles) de los ingresos brutos.
- Las tasas marginales van desde el 10% hasta el <!-- @fact id=us.federal.top_rate value="37%" verified=2026-06-21 src=src_gen_e04d5966 volatility=low --> para ingresos muy altos.
- No se aplica sobre todo tipo de ingreso: por ejemplo, ciertos beneficios gubernamentales o regalos no son gravables.

**Cómo funciona / cómo se calcula**
La fórmula básica es:

> Impuesto federal = Σ (base imponible en cada tramo × tasa marginal aplicable)

Donde:
- *Base imponible* = Ingresos brutos totales − deducciones permitidas (p. ej., <!-- @fact id=us.std_deduction.mfj value="32,200 USD" verified=2026-06-21 src=src_gen_fc17b522 volatility=low --> para casados declarando juntos en 2026)
- *Tramos de ingresos* están definidos por ley y varían según el estado civil (soltero, casado, jefe de hogar).

**Ejemplo trabajado**
Carlos, soltero, reporta ingresos brutos de $52,000 en 2026. No tiene deducciones adicionales, así que usa la deducción estándar para solteros: <!-- @fact id=us.std_deduction.single value="16,100 USD" verified=2026-06-21 src=src_gen_fc17b522 volatility=low --> = $16,100.

→ Base imponible = $52,000 − $16,100 = $35,900

Aplicando los tramos fiscales federales 2026 (publicados en IRS Pub. 15 y 17):
- Primeros $11,600: tasa del 10% → $1,160
- Siguientes $35,900 − $11,600 = $24,300, dentro del tramo del 12% → $24,300 × 12% = $2,916

→ Impuesto total calculado = $1,160 + $2,916 = **$4,076**

Este monto es lo que Carlos *debería pagar* por su renta en 2026. Si su empleador retuvo $4,300 durante el año, recibirá un reembolso de $224 al presentar su Form 1040.

**Ojo:**
- El impuesto sobre la renta federal es distinto del impuesto sobre nómina (FICA): este último es una retención fija para Seguro Social y Medicare, no para el gobierno general. Por ejemplo, sobre los primeros <!-- @fact id=us.ss.wage_base value="184,500 USD" verified=2026-06-21 src=src_gen_4f88219b volatility=low --> de salario, se retiene <!-- @fact id=us.fica.ss_rate value="6.2%" verified=2026-06-21 src=src_gen_4f88219b volatility=low --> para Seguro Social y <!-- @fact id=us.fica.medicare_rate value="1.45%" verified=2026-06-21 src=src_gen_4f88219b volatility=low --> sobre *todo el salario* para Medicare.
- La retención en nómina no siempre iguala el impuesto real debido a créditos fiscales (como el Child Tax Credit), cambios familiares o ingresos adicionales no reportados en la W-4.

**Impuesto sobre la renta vs Impuesto sobre nómina (FICA)**
- *Impuesto sobre la renta*: progresivo, basado en ingresos netos, va al Tesoro General, se calcula anualmente y se ajusta con la declaración (Form 1040). Su tasa máxima es <!-- @fact id=us.federal.top_rate value="37%" verified=2026-06-21 src=src_gen_e04d5966 volatility=low -->.
- *Impuesto sobre nómina (FICA)*: fijo y proporcional, compuesto por <!-- @fact id=us.fica.ss_rate value="6.2%" verified=2026-06-21 src=src_gen_4f88219b volatility=low --> sobre los primeros <!-- @fact id=us.ss.wage_base value="184,500 USD" verified=2026-06-21 src=src_gen_4f88219b volatility=low --> de salario (Seguro Social) y <!-- @fact id=us.fica.medicare_rate value="1.45%" verified=2026-06-21 src=src_gen_4f88219b volatility=low --> sobre *todo* el salario (Medicare); va específicamente a fondos de seguridad social y atención médica, no al presupuesto general.
