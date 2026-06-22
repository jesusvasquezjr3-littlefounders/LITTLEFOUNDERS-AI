---
doc_id: "us-taxes-income_tax-tax-brackets-and-marginal-rates"
title_es: "Tramos impositivos y tasas marginales del impuesto federal sobre la renta en Estados Unidos (2026)"
title_en: "U.S. Federal Income Tax Brackets and Marginal Rates (2026)"
language: "es"
translation_of: null
country: "us"
jurisdiction: "US-FED"
domain: "taxes"
subdomain: "income_tax"
concept_ids: [us.income_tax.bracket, us.income_tax.marginal_rate, us.tax_progressivity]
age_bands: [tier4, tier5]
depth_tier: "intro"
volatility: "low"
last_verified_date: "2026-06-21"
verified_by: "qwen-pipeline"
review_due: "2028-06-21"
sources: [src_gen_c639dae6, src_gen_e04d5966, src_irs_2026_inflation]
status: "draft"
currency: "USD"
schema_version: "kb-1.0"
grounding_tier: "anchored"
canonical_facts: 4
cited_facts: 4
anchored_ratio: 1.0
evidence_grounded: true
---
## Resumen
El sistema de impuesto federal sobre la renta en Estados Unidos es progresivo: cuanto más se gana, mayor es la tasa aplicada a las porciones adicionales de ingreso. Este sistema aplica a los ingresos gravables reportados en la declaración anual Form 1040 para el ejercicio fiscal 2026, vigente a 2026-06-21. A diferencia del sistema mexicano (que usa una tabla única con tasa efectiva creciente y sin deducción estándar fija), el sistema estadounidense define tramos específicos por estado civil, cada uno con su propia tasa marginal, y permite una deducción estándar fija que reduce directamente el ingreso antes de aplicar los tramos — lo que significa que muchos contribuyentes no pagan impuestos sobre sus primeros miles de dólares ganados.

## Para adultos jóvenes y profesionales emergentes (tier4) <!-- age_band: tier4 -->
Un tramo impositivo es un rango de ingreso gravable al que se le aplica una tasa específica. En Estados Unidos, no se aplica una sola tasa a todo el ingreso, sino que cada parte del ingreso cae dentro de un tramo distinto y se grava a la tasa correspondiente a ese tramo. Por ejemplo, si alguien gana $50,000 y está soltero, los primeros $16,100 no se gravan porque equivalen a la deducción estándar <!-- @fact id=us.std_deduction.single value="16,100 USD" verified=2026-06-21 src=src_irs_2026_inflation volatility=low -->; luego, los siguientes $11,600 se gravan al 10%, y los siguientes $19,200 al 12%.

**Ejemplo trabajado**: Carlos, soltero, tiene ingresos gravables de $45,000 en 2026. Primero resta la deducción estándar: $45,000 − $16,100 = $28,900 de ingreso gravable. Luego aplica los tramos 2026 para solteros: 
- Primeros $11,600 × 10% = $1,160
- Siguientes $17,300 ($28,900 − $11,600) × 12% = $2,076
Total = $1,160 + $2,076 = **$3,236**.

## Para adultos plenamente independientes y familias (tier5) <!-- age_band: tier5 -->
### Tramo impositivo (tax bracket)
Rango de ingreso gravable al que se le aplica una tasa marginal específica, definido por ley federal y ajustado anualmente por inflación según el Internal Revenue Code §1 y publicado por el IRS.

**Puntos clave**
- Cada tramo solo aplica a la porción de ingreso gravable que cae dentro de ese rango.
- La tasa marginal es la que se aplica al último dólar ganado; no representa la tasa promedio pagada sobre todo el ingreso.
- Los tramos difieren según estado civil: soltero, casados declarando juntos (MFJ), casados por separado (MFS), o jefe de hogar (HoH).
- La deducción estándar reduce el ingreso bruto para obtener el ingreso gravable — y es fija por categoría (ej. $32,200 para MFJ en 2026).
- El tope de deducción de impuestos estatales y locales (SALT) sigue limitado a $40,400 USD para 2026 <!-- @fact id=us.salt.cap value="40,400 USD" verified=2026-06-21 src=src_irs_2026_inflation volatility=low -->.

**Cómo funciona / cómo se calcula**
El impuesto total se calcula sumando los productos de cada tramo parcial multiplicado por su tasa marginal. No se aplica una fórmula única; se usa una tabla escalonada oficial del IRS. La fórmula general es:
> Impuesto = Σ (Ingreso_en_tramo_i × Tasa_marginal_i)

**Ejemplo trabajado**: María y Luis, casados declarando juntos, tienen ingresos gravables de $120,000 en 2026. Su deducción estándar ya fue restada previamente (por eso el monto es *gravable*). Aplican los tramos 2026 para MFJ:
- Primeros $23,200 × 10% = $2,320
- Siguientes $59,200 ($82,400 − $23,200) × 12% = $7,104
- Siguientes $37,600 ($120,000 − $82,400) × 22% = $8,272
Total = $2,320 + $7,104 + $8,272 = **$17,696**.

**Ojo:** El ingreso gravable no es lo mismo que el ingreso bruto. Se obtiene restando deducciones permitidas (como la deducción estándar <!-- @fact id=us.std_deduction.mfj value="32,200 USD" verified=2026-06-21 src=src_irs_2026_inflation volatility=low -->, gastos médicos calificados o donaciones) del ingreso bruto ajustado (AGI).

**Excepción:** Contribuyentes con ingresos por negocios propios o ingresos del exterior pueden tener reglas adicionales de exclusión o crédito que alteran el cálculo base — pero esos casos requieren formularios complementarios (Form 2555, Schedule C, etc.) y no modifican los tramos ni tasas oficiales.

**Casados declarando juntos vs Soltero**: Para un ingreso gravable de $120,000, un soltero paga $22,824 (usando tramos soltero 2026), mientras que una pareja MFJ paga $17,696 — una diferencia de $5,128, derivada principalmente de que los tramos MFJ son casi el doble de anchos que los solteros y la deducción estándar es el doble ($32,200 vs $16,100).
