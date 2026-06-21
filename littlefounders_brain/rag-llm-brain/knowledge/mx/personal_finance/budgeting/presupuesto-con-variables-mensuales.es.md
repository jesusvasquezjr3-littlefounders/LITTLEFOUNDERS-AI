---
doc_id: "mx-personal_finance-budgeting-presupuesto-con-variables-mensuales"
title_es: "Presupuesto con variables mensuales: servicios, alimentación y transporte"
title_en: "Monthly variable budgeting: utilities, food, and transportation"
language: "es"
translation_of: null
country: "mx"
jurisdiction: "MX-FED"
domain: "personal_finance"
subdomain: "budgeting"
concept_ids: [budgeting, monthly_expenses, income_tracking, cost_control]
age_bands: [tier4, tier5]
depth_tier: "intermediate"
volatility: "low"
last_verified_date: "2026-06-20"
verified_by: "qwen-pipeline"
review_due: "2028-06-20"
sources: [src_gen_b306d4d2, src_lisr]
status: "review"
currency: "MXN"
schema_version: "kb-1.0"
---
## For future Claude
Este documento explica cómo construir un presupuesto mensual realista para jóvenes y adultos jóvenes en México (edad 15–25+), usando solo datos oficiales vigentes al 2026-06-20. Se enfoca en gastos que cambian cada mes —como luz, agua, transporte público o comida— y evita términos abstractos prohibidos (p.ej., 'inversión', 'deuda'). Difiere claramente de modelos estadounidenses: no aplica el IRS ni el FLSA; usa el salario mínimo federal mexicano 2026 y la LISR vigente desde el 1 de abril de 2024.

## Para jóvenes mayores y adultos jóvenes (tier4–tier5) <!-- age_band: tier4,tier5 -->
Los gastos mensuales reales dependen de tres cosas: cuánto ganas, dónde vives y qué necesitas cada mes. En México, el salario mínimo diario es oficial y distinto según zona: $248.93 en todo el país, y $312.41 en la Zona Libre de la Frontera Norte <!-- @fact id=sm.2026.general value=248.93 verified=2026-06-20 src=src_gen_b306d4d2 volatility=low -->, <!-- @fact id=sm.2026.zona_norte value=312.41 verified=2026-06-20 src=src_gen_b306d4d2 volatility=low -->. Esto significa que, si trabajas 22 días al mes, tu ingreso base mínimo está entre $5,476 y $6,873 —pero muchos trabajos pagan más, y otros menos.

Para hacer tu presupuesto, anota cada mes:
- Lo que recibes (sueldo, apoyo familiar, ingresos informales);
- Lo que pagas por servicios fijos (agua, internet, seguro médico básico);
- Lo que gastas en cosas que cambian: electricidad (sube en verano), transporte (más viajes = más pasajes), y comida (más comidas fuera = más gasto).

Por ejemplo, si ganas $5,000 al mes y vives solo en la Ciudad de México, podrías asignar:
• $1,200 para luz, agua y gas;
• $600 para transporte (Metro + combi + ocasional Uber);
• $1,800 para alimentos (mercado + 6 comidas semanales fuera);
• $700 para teléfono, suscripciones y "extras" (gimnasio, streaming);
• $700 para ahorro o imprevistos.

Esto suma $5,000. Si sobra o falta, ajusta las categorías variables —no las fijas— porque son las que puedes controlar sin afectar tus necesidades básicas.

Recuerda: si trabajas formalmente, tu patrón ya retiene impuestos según la Ley del Impuesto sobre la Renta (LISR), que aplica a todos los ingresos de personas físicas residentes en México <!-- @fact id=l_isr.art1.i value=Artículo 1, fracción I verified=2026-06-20 src=src_lisr volatility=low --> y entró en vigor el 1 de abril de 2024 <!-- @fact id=l_isr.effective_date value=2024-04-01 verified=2026-06-20 src=src_lisr volatility=low -->. Pero tú no pagas impuestos directamente si ganas menos del umbral anual gravable —y ese cálculo lo hace tu empleador, no tú.

No necesitas una app ni un curso: basta una hoja de Excel con tres columnas (mes, ingreso, gasto) y revisarla cada 30 días. El objetivo no es ahorrar todo, sino saber adónde va cada peso.
