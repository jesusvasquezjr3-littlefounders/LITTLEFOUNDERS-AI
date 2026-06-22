---
doc_id: "mx-taxes-income_tax-residencia-fiscal"
title_es: "Residencia Fiscal en México: Criterios y Consecuencias Tributarias"
title_en: "Tax Residency in Mexico: Criteria and Tax Consequences"
language: "es"
translation_of: null
country: "mx"
jurisdiction: "MX-FED"
domain: "taxes"
subdomain: "income_tax"
concept_ids: [mx.residency.criteria, mx.residency.consequences, mx.establecimiento.permanente]
age_bands: [tier4, tier5]
depth_tier: "intermediate"
volatility: "low"
last_verified_date: "2026-06-21"
verified_by: "qwen-pipeline"
review_due: "2028-06-21"
sources: [src_gen_1059e45d, src_gen_8ae2b0ae, src_gen_d03cd254]
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
La residencia fiscal en México es un criterio legal que determina si una persona física o moral está obligada a pagar impuestos sobre todos sus ingresos —tanto los obtenidos dentro como fuera del país— conforme a la Ley del Impuesto sobre la Renta (LISR). Esta regla aplica en todo el territorio nacional y está vigente a 2026-06-21. A diferencia de Estados Unidos, donde la ciudadanía es un criterio primario para la tributación mundial, México usa exclusivamente la residencia (lugar de vivienda habitual o sede de administración efectiva) como base para la obligación tributaria global.

## Para jóvenes (tier4-5) <!-- age_band: tier4,tier5 -->
### ¿Qué es la residencia fiscal?
Es la condición jurídica que adquiere una persona física o moral al tener su vivienda habitual en México (personas físicas) o su sede de administración efectiva o lugar de constitución en el país (personas morales), lo que la obliga a declarar y pagar impuestos sobre la totalidad de sus ingresos, sin importar dónde se generen.

**Puntos clave**
- Una persona física es residente fiscal en México si vive aquí la mayor parte del año (más de 183 días) **o** si tiene su vivienda habitual en el país, incluso con estancias menores.
- Una persona moral es residente fiscal si se constituyó en México **o** si su sede de administración efectiva (donde se toman decisiones clave) está ubicada en territorio nacional.
- Los residentes fiscales están sujetos a la tarifa anual de ISR: hasta <!-- @fact id=mx.isr.pf_top_rate value="35%" verified=2026-06-21 src=src_gen_d03cd254 volatility=low --> para personas físicas y <!-- @fact id=mx.isr.pm_rate value="30%" verified=2026-06-21 src=src_gen_d03cd254 volatility=low --> para personas morales (Régimen General).
- Si una persona física o moral extranjera actúa en México mediante una persona distinta de un agente independiente que concluye contratos habitualmente a su nombre, se considera que tiene un *establecimiento permanente*, lo que genera obligaciones tributarias locales.
- El cumplimiento de los tratados para evitar la doble tributación exige acreditar formalmente la residencia fiscal en el otro país mediante constancia oficial y presentar información fiscal ante el SAT.

### ¿Cómo funciona?
La determinación se basa en hechos objetivos:
- Para personas físicas: duración de estancia + vínculos familiares, económicos y sociales (vivienda, empleo, bancos, escuela de hijos).
- Para personas morales: lugar de constitución (acta notarial) **o**, si se constituyó en el extranjero, lugar donde se toman las decisiones estratégicas (reuniones de consejo, firma de contratos mayores, control financiero).
- El establecimiento permanente se configura cuando una persona física o moral extranjera opera en México mediante representante que no es agente independiente y que realiza funciones sustanciales (como firmar contratos, entregar bienes o asumir riesgos), aun sin tener oficina fija.

### Ejemplo trabajado
*Ilustración con cifras redondeadas, vigente a 2026-06-21.*

Carlos López, ciudadano canadiense, vive en Guadalajara desde marzo de 2025. Tiene casa rentada, cuenta bancaria local, y trabaja remoto para una empresa de Toronto. En 2025 pasó 210 días en México. Su ingreso anual es de 1,200,000 MXN.

→ Por haber superado los 183 días y mantener vínculos reales (vivienda, banca, actividad económica), Carlos es residente fiscal en México desde 2025.
→ Debe declarar todos sus ingresos globales ante el SAT.
→ Aplica la tarifa anual de ISR para personas físicas: su ingreso gravable (después de deducciones autorizadas) entra en el escalón más alto, con tasa marginal de <!-- @fact id=mx.isr.pf_top_rate value="35%" verified=2026-06-21 src=src_gen_d03cd254 volatility=low -->.
→ Si su ingreso gravable es de 1,000,000 MXN, su impuesto calculado es aproximadamente = 350,000 MXN (usando tasa marginal máxima como ilustración simplificada; el cálculo real usa tarifa progresiva con 11 escalones ).

### Ojo:
- Tener visa turista o estancia temporal **no excluye** la residencia fiscal: lo determinan los hechos reales, no el tipo de visado.
- Un extranjero que solo recibe ingresos del exterior (ej. jubilación de Canadá) pero vive en México >183 días, sigue siendo residente fiscal y debe declarar esos ingresos.

### Excepción:
Un residente en el extranjero que actúe en México únicamente mediante un *agente independiente* (ej. una agencia de publicidad que presta servicios a múltiples clientes) **no** genera establecimiento permanente —siempre que ese agente opere dentro del marco ordinario de su actividad, sin asumir riesgos ni existencias del extranjero.

### Residente fiscal vs. No residente
| Criterio | Residente fiscal | No residente |
|----------|------------------|--------------|
| Base de tributación | Todos los ingresos (dentro y fuera de México) | Solo los ingresos obtenidos *dentro* de México |
| Tarifa aplicable | Tarifa anual progresiva (hasta <!-- @fact id=mx.isr.pf_top_rate value="35%" verified=2026-06-21 src=src_gen_d03cd254 volatility=low -->) o tasa fija de <!-- @fact id=mx.isr.pm_rate value="30%" verified=2026-06-21 src=src_gen_d03cd254 volatility=low --> | Tasas específicas por tipo de ingreso (ej. 25% sobre honorarios pagados por residentes mexicanos) |
| Obligación de declaración | Sí, anual ante el SAT | Solo si obtuvo ingresos sujetos a retención en México |
| Acceso a deducciones personales | Sí, hasta el menor de: 5 UMA anuales <!-- @fact id=mx.uma.anual value="42,794.64 MXN" verified=2026-06-21 src=src_gen_1059e45d volatility=low --> o 15% del ingreso total  | No aplica |

## Para adolescentes (tier4) <!-- age_band: tier4 -->
Imagina que tu familia se muda a México y tú vas a la secundaria aquí. Si viven en una casa propia o rentada, abren cuentas bancarias y te inscriben en la escuela, el gobierno mexicano puede considerarlos *residentes fiscales*. Eso significa que deben declarar todos sus ingresos —incluso los que ganan en otro país— y pagar impuestos sobre ellos. No importa si tienen pasaporte extranjero: lo que cuenta son los hechos reales de vivir aquí. Si solo vienen de vacaciones o por unos meses, no aplica. Pero si se quedan más de medio año y hacen vida aquí, sí.

Ejemplo: Sofía, de 16 años, llega con sus padres desde Chile en enero de 2025. Viven en Monterrey, ella va a la prepa local, y su papá trabaja remotamente para una empresa de Santiago. En diciembre de 2025, llevan 220 días en México. Entonces, desde 2025, su papá es residente fiscal y debe declarar sus ingresos chilenos ante el SAT.

## Para adultos jóvenes (tier5) <!-- age_band: tier5 -->
Este nivel profundiza en consecuencias operativas. La residencia fiscal no es solo una etiqueta: activa obligaciones concretas. Por ejemplo, una startup estadounidense que contrata a un equipo de desarrollo en Guadalajara mediante un *representante local que firma contratos y entrega software* —aunque no tenga oficina registrada— puede ser considerada como teniendo un *establecimiento permanente* en México (Art. 2, fracc. VI LISR, DOF 09-12-2019). Eso implica: (i) registro obligatorio ante el SAT, (ii) pago mensual de ISR con tasa de <!-- @fact id=mx.isr.pm_rate value="30%" verified=2026-06-21 src=src_gen_d03cd254 volatility=low -->, (iii) facturación con IVA , y (iv) obligación de llevar contabilidad en español y pesos. El error común es asumir que 'no hay oficina = no hay obligación'; la ley mira funciones, no infraestructura.
