---
doc_id: "mx-taxes-income_tax-ingresos-acumulables-no-acumulables"
title_es: "Ingresos Acumulables y No Acumulables para el ISR en México"
title_en: "Accumulable and Non-Accumulable Income for Income Tax in Mexico"
language: "es"
translation_of: null
country: "mx"
jurisdiction: "MX-FED"
domain: "taxes"
subdomain: "income_tax"
concept_ids: [mx.isr.income_classification, mx.isr.acumulable, mx.isr.no_acumulable]
age_bands: [tier3, tier4, tier5]
depth_tier: "intro"
volatility: "low"
last_verified_date: "2026-06-21"
verified_by: "qwen-pipeline"
review_due: "2028-06-21"
sources: [src_gen_3ccce9e2, src_gen_9c61c3a1, src_gen_dd1f8a95]
status: "review"
currency: "MXN"
schema_version: "kb-1.0"
grounding_tier: "anchored"
canonical_facts: 4
cited_facts: 4
anchored_ratio: 1.0
evidence_grounded: true
---
## Resumen
Los ingresos acumulables son todos los que una persona física o moral recibe y que deben sumarse a su base gravable para calcular el Impuesto Sobre la Renta (ISR) en México; los no acumulables son aquellos expresamente exentos por ley. Esta clasificación es obligatoria bajo la Ley del Impuesto sobre la Renta (LISR), vigente a 2026-06-21, y aplica exclusivamente a residentes en México. A diferencia del sistema estadounidense (donde ciertos regalos o herencias pueden ser exentos sin límite), en México solo los donativos entre cónyuges y padres a hijos son no acumulables —y aun así están sujetos a comprobación y límites legales.

## Para jóvenes (tier3-4) <!-- age_band: tier3,tier4 -->
Imagina que recibes dinero de tu familia o trabajas por primera vez. En México, **no todo lo que recibes se suma al impuesto que debes pagar**. Por ejemplo: si tus papás te dan $5,000 para tus estudios, eso **no se cuenta** como ingreso para el ISR. Pero si tu tío te da $5,000, **sí se cuenta**, porque la ley solo exenta los donativos de padres e hijos (y cónyuges). Si trabajas y ganas $12,000 mensuales, ese dinero sí se suma —pero puedes restar gastos reales como transporte o útiles escolares, si los tienes comprobados. El gobierno usa la UMA (Unidad de Medida y Actualización) para medir muchos límites: en 2026, una UMA mensual vale <!-- @fact id=mx.uma.mensual value="3,566.22 MXN" verified=2026-06-21 src=src_gen_9c61c3a1 volatility=low --> y una anual vale <!-- @fact id=mx.uma.anual value="42,794.64 MXN" verified=2026-06-21 src=src_gen_9c61c3a1 volatility=low -->.

## Para adultos y profesionales (tier5) <!-- age_band: tier5 -->
Los ingresos acumulables son todos los ingresos que una persona física obtiene durante el año y que, según la Ley del Impuesto sobre la Renta (Art. 109 LISR), deben integrarse a la base gravable para determinar el ISR anual.

**Puntos clave**
- Son acumulables los salarios, honorarios, rentas de bienes inmuebles, ganancias por venta de acciones o terrenos, y regalos de personas distintas de cónyuge o progenitores.
- Son no acumulables (exentos) únicamente: (i) donativos entre cónyuges o de padres a hijos; (ii) indemnizaciones por riesgos de trabajo o enfermedades profesionales; (iii) ciertas pensiones alimenticias autorizadas judicialmente.
- Los ingresos no acumulables **no generan ISR ni se declaran**, pero deben estar debidamente comprobados ante el SAT.
- La exención por donativos **no aplica** para abuelos, tíos, primos, amigos ni empleadores: esos montos sí son acumulables (Art. 109, Fracción I, LISR).
- El tope de deducciones personales está limitado al menor de: 5 UMA anuales o 15% del ingreso total .

**Cómo funciona / cómo se calcula**
La base gravable anual = Suma de todos los ingresos acumulables − Deducciones autorizadas (gastos comprobados, aportaciones al IMSS, etc.). Luego se aplica la tarifa progresiva anual de 11 escalones <!-- @fact id=mx.isr.pf_brackets value="11" verified=2026-06-21 src=src_gen_9c61c3a1 volatility=low -->, con tasa marginal máxima del 35% <!-- @fact id=mx.isr.pf_top_rate value="35%" verified=2026-06-21 src=src_gen_9c61c3a1 volatility=low -->.

**Ejemplo trabajado**
Carlos, residente en México, recibe en 2025:
- Salario anual: $320,000 MXN (acumulable)
- Honorarios por asesoría: $85,000 MXN (acumulable)
- Donativo de su padre: $40,000 MXN (no acumulable, Art. 109, Fracc. I LISR)
- Donativo de su tío: $25,000 MXN (acumulable — no cubierto por exención)
- Gastos deducibles comprobados: $32,000 MXN

Base gravable = ($320,000 + $85,000 + $25,000) − $32,000 = $398,000 MXN
Aplicando la tarifa anual del Art. 152 LISR (vigente 2025, aplicable a ejercicio 2025 declarado en 2026): 
- Hasta $159,519.24: 1.92% → $3,062.77
- De $159,519.25 a $274,258.12: 6.40% sobre excedente → $7,354.22
- De $274,258.13 a $398,000.00: 10.88% sobre excedente → $13,529.47
Total ISR = $3,062.77 + $7,354.22 + $13,529.47 = **$23,946.46 MXN**

**Ojo:** El donativo de $40,000 de su padre es válido como no acumulable solo si se acredita con documento notarial o transferencia bancaria identificable. Si no se comprueba, el SAT puede exigir su inclusión.

**Excepción:** Las prestaciones de PTU (participación de utilidades) son acumulables, pero se les aplica una deducción especial equivalente al 10% de la PTU recibida (Art. 112, Fracc. III LISR); esto no aplica a donativos.

**Donativo de padre vs donativo de tío**
- Donativo de padre: no acumulable, sin límite legal explícito, pero sujeto a comprobación y no debe simular evasión fiscal.
- Donativo de tío: acumulable íntegramente — forma parte de la base gravable y se grava con la tarifa progresiva correspondiente.
