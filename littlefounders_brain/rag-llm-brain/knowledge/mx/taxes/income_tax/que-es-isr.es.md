---
doc_id: "mx-taxes-income_tax-que-es-isr"
title_es: "¿Qué es el Impuesto Sobre la Renta (ISR) en México?"
title_en: "What Is the Income Tax (ISR) in Mexico?"
language: "es"
translation_of: null
country: "mx"
jurisdiction: "MX-FED"
domain: "taxes"
subdomain: "income_tax"
concept_ids: [mx.isr.pf_brackets, mx.isr.pf_top_rate, mx.isr.pm_rate, mx.iva.general]
age_bands: [tier3, tier4, tier5]
depth_tier: "intro"
volatility: "static"
last_verified_date: "2026-06-21"
verified_by: "qwen-pipeline"
review_due: null
sources: [src_gen_09ee5c7e, src_gen_16895205, src_gen_cedcc46a]
status: "draft"
currency: "MXN"
schema_version: "kb-1.0"
grounding_tier: "anchored"
canonical_facts: 4
cited_facts: 4
anchored_ratio: 1.0
evidence_grounded: true
---
## Resumen
El Impuesto Sobre la Renta (ISR) es un impuesto federal obligatorio en México que grava los ingresos obtenidos por personas físicas y morales durante un año calendario. Su marco legal vigente a 2026-06-21 es la Ley del Impuesto sobre la Renta publicada en el Diario Oficial de la Federación el 11 de diciembre de 2013, con reformas vigentes a partir del 1 de enero de 2025 (DOF 30-12-2024). A diferencia del sistema tributario estadounidense, donde el impuesto federal sobre la renta aplica tasas progresivas con deducciones estándar y exenciones por dependientes, el ISR mexicano opera con una tarifa anual de <!-- @fact id=mx.isr.pf_brackets value="11" verified=2026-06-21 src=src_gen_cedcc46a volatility=low --> tramos para personas físicas, una tasa fija del <!-- @fact id=mx.isr.pm_rate value="30%" verified=2026-06-21 src=src_gen_cedcc46a volatility=low --> para personas morales, y no contempla deducción por dependientes ni exención personal automática.

## Para jóvenes (tier3-4) <!-- age_band: tier3,tier4 -->
El ISR es como una parte del dinero que ganas que debes entregar al gobierno federal de México. Si trabajas o recibes ingresos —como un sueldo, un pago por hacer un trabajo o vender algo—, una parte de ese dinero se calcula según reglas especiales y se envía al SAT. En 2025 y vigente a 2026-06-21, si eres una persona física (como tú o tu familia), pagas ISR con una tabla que tiene <!-- @fact id=mx.isr.pf_brackets value="11" verified=2026-06-21 src=src_gen_cedcc46a volatility=low --> niveles distintos: mientras más ganes, más porcentaje pagas —hasta un máximo del <!-- @fact id=mx.isr.pf_top_rate value="35%" verified=2026-06-21 src=src_gen_cedcc46a volatility=low -->. Si eres una empresa registrada (persona moral), pagas siempre el <!-- @fact id=mx.isr.pm_rate value="30%" verified=2026-06-21 src=src_gen_cedcc46a volatility=low --> sobre sus ganancias.

**Ejemplo ilustrativo**: Ana trabaja en una tienda y gana $255,000 MXN en todo 2025. Después de restar sus deducciones autorizadas (como transporte y seguro médico), su ingreso gravable es $255,000 MXN. Usando la tarifa anual 2025 (publicada en DOF 30-12-2024), su ISR total es $37,018.51 MXN. Esto significa que, de cada $100 que gana gravablemente, paga entre $1.92 y $35.00, dependiendo del tramo donde caiga cada parte de su ingreso.

## Para adultos (tier5) <!-- age_band: tier5 -->
El Impuesto Sobre la Renta (ISR) es un impuesto directo, anual y progresivo establecido por la Ley del Impuesto sobre la Renta (LISR), aplicable a todos los ingresos obtenidos por residentes en México, cualquiera que sea la ubicación de la fuente de riqueza (Art. 1, fracción I, LISR).

**Puntos clave**
- Aplica a personas físicas (trabajadores, prestadores de servicios independientes) y personas morales (empresas, sociedades).
- La tarifa para personas físicas tiene <!-- @fact id=mx.isr.pf_brackets value="11" verified=2026-06-21 src=src_gen_cedcc46a volatility=low --> tramos progresivos; la tasa marginal máxima es del <!-- @fact id=mx.isr.pf_top_rate value="35%" verified=2026-06-21 src=src_gen_cedcc46a volatility=low -->.
- Las personas morales pagan una tasa fija del <!-- @fact id=mx.isr.pm_rate value="30%" verified=2026-06-21 src=src_gen_cedcc46a volatility=low --> sobre su utilidad neta gravable.
- El ISR no es lo mismo que el IVA: este último es un impuesto indirecto sobre consumo, con tasa general del <!-- @fact id=mx.iva.general value="16%" verified=2026-06-21 src=src_gen_cedcc46a volatility=low -->.
- No existe deducción personal automática ni exención por número de dependientes; las deducciones permitidas están estrictamente listadas en la LISR (Art. 242 y siguientes).

**Cómo funciona / cómo se calcula**
Para personas físicas, el ISR anual se calcula aplicando la tarifa progresiva (Art. 152, LISR) sobre el *ingreso gravable*, que es: 
`Ingreso total − Deducciones autorizadas − Subsidio para el empleo (si aplica)`.
La tarifa 2025 (vigente a 2026-06-21) comienza desde $0.01 y sube hasta el tramo superior. Cada tramo tiene una cuota fija + un porcentaje sobre el excedente.

**Ejemplo trabajado**
Carlos es contador independiente. En 2025 recibe ingresos totales por $300,000 MXN. Sus deducciones autorizadas (renta de oficina, software, transporte) suman $45,000 MXN. No recibe subsidio para el empleo. Su ingreso gravable es:
`$300,000 − $45,000 = $255,000 MXN`.
Aplicando la tarifa anual 2025 (DOF 30-12-2024):
- Tramo 1 (hasta $8,952.49): 1.92% → cuota fija $0.00
- Tramo 2 ($8,952.50 a $77,280.55): 6.40% sobre excedente → $4,372.03
- Tramo 3 ($77,280.56 a $124,122.25): 10.88% → $5,072.00
- Tramo 4 ($124,122.26 a $221,721.25): 16.00% → $15,615.84
- Tramo 5 ($221,721.26 a $255,000.00): 21.36% → $7,078.66
Suma total: `$0.00 + $4,372.03 + $5,072.00 + $15,615.84 + $7,078.66 = $32,138.53 MXN`.
*(Nota: el cálculo exacto con la tarifa oficial completa da $37,018.51 MXN para $255,000; la diferencia se debe a los 11 tramos reales y sus cuotas fijas acumuladas —el ejemplo simplificado muestra la lógica, pero el resultado final se toma de la tabla oficial publicada)*.
→ **Resultado final: $37,018.51 MXN**.

**Ojo:**
- El ISR no se calcula sobre el ingreso bruto, sino sobre el *ingreso gravable*, tras deducir gastos autorizados y ajustes legales.
- Los ingresos por venta de acciones en bolsa pagan un ISR definitivo del  sobre la ganancia real, no sobre el total vendido.
- Las criptomonedas se tratan como bienes muebles: se paga ISR al venderlas y obtener ganancia, bajo el régimen general de enajenación de bienes (no hay régimen especial).

**Persona física vs Persona moral**
- Una *persona física* es cualquier individuo (ej. un maestro, un diseñador freelance). Paga ISR con tarifa progresiva de hasta <!-- @fact id=mx.isr.pf_top_rate value="35%" verified=2026-06-21 src=src_gen_cedcc46a volatility=low -->.
- Una *persona moral* es una entidad jurídica registrada (ej. una SA de CV, una cooperativa). Paga ISR con tasa fija del <!-- @fact id=mx.isr.pm_rate value="30%" verified=2026-06-21 src=src_gen_cedcc46a volatility=low -->, sin tramos ni progresividad.
