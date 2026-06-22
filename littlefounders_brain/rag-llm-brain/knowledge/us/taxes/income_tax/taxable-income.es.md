---
doc_id: "us-taxes-income_tax-taxable-income"
title_es: "Ingreso gravable (US-FED, 2026)"
title_en: "Taxable Income (US-FED, 2026)"
language: "es"
translation_of: null
country: "us"
jurisdiction: "US-FED"
domain: "taxes"
subdomain: "income_tax"
concept_ids: [taxable_income, agi, standard_deduction, itemized_deduction]
age_bands: [tier4, tier5]
depth_tier: "intro"
volatility: "low"
last_verified_date: "2026-06-21"
verified_by: "qwen-pipeline"
review_due: "2028-06-21"
sources: [src_gen_04c03c8a, src_gen_687165fd, src_gen_ef572a76, src_irs_obbba]
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
El ingreso gravable es la cantidad de dinero sobre la que el gobierno federal de Estados Unidos cobra impuestos en el ejercicio fiscal 2026. Se calcula restando deducciones autorizadas del ingreso ajustado (AGI), y determina cuánto se paga en impuestos federales sobre ingresos individuales. A diferencia de México —donde el ingreso gravable se define por reglas distintas y no usa el concepto de AGI ni deducción estándar—, el sistema estadounidense depende de una secuencia fija: ingresos brutos → ajustes → AGI → deducciones → ingreso gravable.

## Para jóvenes (tier4–5) <!-- age_band: tier4,tier5 -->
### ¿Qué es el ingreso gravable?
Es el dinero real que el Servicio de Impuestos Internos (IRS) usa para calcular cuánto impuesto federal debe pagar una persona en 2026.

**Puntos clave**
- Empieza con todos los ingresos recibidos durante el año (salarios, propinas, ganancias de venta de cosas).
- Luego se restan ciertos ajustes (como aportes a planes de retiro o intereses de préstamos estudiantiles) para obtener el *ingreso ajustado* (AGI).
- Del AGI se restan las deducciones: o la *deducción estándar* (una cantidad fija según su estado civil), o las *deducciones detalladas* (gastos reales como donaciones o impuestos estatales, pero con límites).
- El resultado final es el ingreso gravable.
- No incluye ingresos exentos como ciertas becas o devoluciones de impuestos estatales.

**Cómo se calcula**
Ingreso gravable = Ingreso ajustado (AGI) − Deducción estándar o deducciones detalladas

**Ejemplo trabajado**
Carlos, soltero, gana $52,000 en salarios en 2026. Hace un aporte de $4,400 a su plan HSA (ajuste permitido), lo que reduce su AGI a $47,600. No tiene gastos detallables mayores que la deducción estándar. Usa la deducción estándar para solteros: <!-- @fact id=us.std_deduction.single value="16,100 USD" verified=2026-06-21 src=src_gen_687165fd volatility=low --> = $16,100. Entonces: $47,600 − $16,100 = **$31,500**. Su ingreso gravable es $31,500.

**Ojo:** Si Carlos hubiera tenido más de $12,200 de ingresos por rentas o dividendos, perdería derecho al Crédito por Ingreso del Trabajo (EITC) — aunque eso no cambia su ingreso gravable, sí afecta su reembolso total.

**Excepción:** Los impuestos estatales y locales (SALT) solo pueden deducirse hasta <!-- @fact id=us.salt.cap value="10,000 USD" verified=2026-06-21 src=src_gen_04c03c8a volatility=low --> = $10,000, incluso si se pagaron más.

**Deducción estándar vs. deducciones detalladas**
La deducción estándar es más simple y usada por >90 % de los declarantes; las detalladas solo valen la pena si los gastos reales superan ese monto fijo (p. ej., $32,200 para casados juntos).
