---
doc_id: "us-taxes-income_tax-gross-income-and-agi"
title_es: "Ingreso bruto e ingreso bruto ajustado (AGI)"
title_en: "Gross Income and Adjusted Gross Income (AGI)"
language: "es"
translation_of: null
country: "us"
jurisdiction: "US-FED"
domain: "taxes"
subdomain: "income_tax"
concept_ids: [us.gross_income, us.agi, us.taxable_income.base]
age_bands: [tier4, tier5]
depth_tier: "intro"
volatility: "low"
last_verified_date: "2026-06-21"
verified_by: "qwen-pipeline"
review_due: "2028-06-21"
sources: [src_gen_3183b21c, src_gen_5df7070a, src_gen_e4187505, src_gen_ef572a76]
status: "review"
currency: "USD"
schema_version: "kb-1.0"
grounding_tier: "anchored"
canonical_facts: 4
cited_facts: 4
anchored_ratio: 1.0
evidence_grounded: true
---
## Resumen
El ingreso bruto es la suma total de todo lo que una persona recibe en efectivo, bienes o servicios durante el año fiscal, antes de quitar nada. El ingreso bruto ajustado (AGI) es ese ingreso bruto menos ciertos descuentos autorizados por ley federal estadounidense, y es la base para calcular impuestos federales sobre la renta en Estados Unidos para el ejercicio fiscal 2026 (vigente a 2026-06-21). A diferencia del sistema mexicano, donde se aplica un régimen de deducciones personales fijas o estimadas, el AGI estadounidense se construye con ajustes específicos y verificables, y determina la elegibilidad para créditos, deducciones y límites de ingreso.

## Para jóvenes (tier4-5) <!-- age_band: tier4,tier5 -->
### ¿Qué es el ingreso bruto y el ingreso bruto ajustado?
El **ingreso bruto** incluye todos los pagos recibidos por trabajo, servicios prestados, alquileres, premios, regalías y otros ingresos — incluso si no vienen de un empleador formal. El **ingreso bruto ajustado (AGI)** es el ingreso bruto menos ciertos ajustes permitidos por ley federal, como aportaciones a cuentas de ahorro para salud (HSA), gastos de educación superior calificados y contribuciones a planes de jubilación individuales (IRA).

**Puntos clave**
- El ingreso bruto es la base más amplia de ingresos gravables; no excluye nada por defecto.
- El AGI no es lo mismo que el ingreso gravable: este último se obtiene restando la deducción estándar o deducciones detalladas *después* del AGI.
- Muchos beneficios fiscales (como el Crédito Tributario por Hijos o el EITC) usan el AGI como umbral de elegibilidad.
- Algunos ajustes al ingreso bruto (llamados "above-the-line deductions") solo están disponibles si se cumplen condiciones específicas y se reportan en la declaración federal.
- El AGI aparece en la línea 11 de la Forma 1040 (2025, aplicable al ejercicio fiscal 2026).

### ¿Cómo se calcula?
Se sigue esta secuencia:
1. Sumar **todo el ingreso bruto**: salarios, propinas, ingresos por trabajos independientes, ganancias por venta de objetos personales, etc.
2. Restar **ajustes autorizados** ("above-the-line deductions"): aportaciones a IRA, gastos de estudiante calificados, aportaciones a HSA, entre otros.
3. El resultado es el **AGI**: `AGI = Ingreso bruto − Ajustes calificados`.

### Ejemplo trabajado
Luis, soltero, trabaja como conductor independiente y gana $38,000 en efectivo y transferencias durante 2026. También aporta $4,400 a su cuenta HSA (cobertura individual, ) y paga $2,500 en intereses de préstamo estudiantil (deducción máxima permitida: ). No tiene otros ajustes.

Ingreso bruto = $38,000  
Ajustes = $4,400 (HSA) + $2,500 (intereses de préstamo) = $6,900  
AGI = $38,000 − $6,900 = **$31,100**

### Ojo:
- Los ajustes deben estar expresamente autorizados por el Código de Rentas Internas (26 U.S.C. § 62); no se puede restar cualquier gasto personal.
- Si Luis hubiera recibido $13,000 en ingresos por inversiones (como dividendos o ganancias de capital), eso sí forma parte del ingreso bruto — pero superaría el límite de ingreso por inversión para el EITC (<!-- @fact id=us.eitc.investment_income_limit value="12,200 USD" verified=2026-06-21 src=src_gen_e4187505 volatility=low -->), descalificándolo del crédito.

### Ingreso bruto vs AGI
- **Ingreso bruto**: es la suma completa de todo lo recibido; no se le aplica ninguna reducción por ley aún.
- **AGI**: es el ingreso bruto *menos ajustes específicos*, y sirve como punto de partida para determinar qué deducciones y créditos pueden usarse. Es un número único y obligatorio para todas las declaraciones federales de 2026.
