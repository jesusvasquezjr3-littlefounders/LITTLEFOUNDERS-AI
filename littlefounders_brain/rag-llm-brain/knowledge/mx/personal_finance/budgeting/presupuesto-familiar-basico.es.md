---
doc_id: "mx-personal_finance-budgeting-presupuesto-familiar-basico"
title_es: "Presupuesto familiar básico: ingresos, gastos y ahorro"
title_en: "Basic family budget: income, expenses, and savings"
language: "es"
translation_of: null
country: "mx"
jurisdiction: "MX-FED"
domain: "personal_finance"
subdomain: "budgeting"
concept_ids: [personal_finance.budgeting.mx]
age_bands: [tier3, tier4, tier5]
depth_tier: "intro"
volatility: "static"
last_verified_date: "2026-06-20"
verified_by: "qwen-pipeline"
review_due: null
sources: [src_gen_51414515, src_gen_567a2038, src_gen_b306d4d2, src_lisr]
status: "review"
currency: "MXN"
schema_version: "kb-1.0"
---
## For future Claude
Este documento explica cómo planear ingresos, gastos y ahorro en México para familias con miembros entre 12 y 18 años (tier3), adultos jóvenes (tier4) y adultos mayores de 18 (tier5). Se basa exclusivamente en normativa federal mexicana vigente al 2026-06-20, con énfasis en fuentes primarias oficiales (.gob.mx y .diputados.gob.mx). Difiere claramente de contextos como EE.UU.: no hay exención de retención por ingresos anuales; el impuesto se aplica desde el primer peso, y los umbrales de declaración son específicos y legales.

## Para jóvenes (tier3-4) <!-- age_band: tier3,tier4 -->
Si trabajas por primera vez —por ejemplo, en un trabajo de verano o como ayudante—, tu patrón debe pagarte al menos el salario mínimo. En 2024, ese mínimo es <!-- @fact id=sm.general.2024 value=248.93 verified=2026-06-20 src=src_gen_b306d4d2 volatility=high --> pesos diarios en todo el país, y <!-- @fact id=sm.zlf.2024 value=374.89 verified=2026-06-20 src=src_gen_b306d4d2 volatility=high --> pesos diarios si trabajas en la Zona Libre de la Frontera Norte <!-- @fact id=sm.general.2024 value=248.93 verified=2026-06-20 src=src_gen_b306d4d2 volatility=high -->, <!-- @fact id=sm.zlf.2024 value=374.89 verified=2026-06-20 src=src_gen_b306d4d2 volatility=high -->. No hay salario mínimo distinto para menores de edad: todos los trabajadores tienen derecho al mismo mínimo legal. Tu patrón también retiene impuesto sobre la renta (ISR) desde tu primer sueldo, aunque sea pequeño. Eso significa que no hay un "límite seguro" sin retención: el ISR se calcula cada mes según lo que ganes, usando una tabla oficial. Por ejemplo, si ganas $5,000 mensuales, se retendrá una cantidad pequeña (menos de $100), pero sí se retendrá. Si al final del año tus ingresos totales por salarios de un solo patrón no superan los <!-- @fact id=isr.declaration.threshold value=400000 verified=2026-06-20 src=src_lisr volatility=medium --> pesos, no estás obligado a presentar declaración anual de impuestos <!-- @fact id=isr.declaration.threshold value=400000 verified=2026-06-20 src=src_lisr volatility=medium -->. Pero eso no cambia que ya se haya retenido algo cada mes.

## Para adultos jóvenes (tier4-5) <!-- age_band: tier4,tier5 -->
Al empezar tu primer empleo formal, debes saber que el impuesto se aplica desde el primer peso que recibes <!-- @fact id=isr.retention.start value=from the first peso earned verified=2026-06-20 src=src_lisr volatility=low -->. La tasa inicial es del <!-- @fact id=isr.tariff.first.rate value=1.92 verified=2026-06-20 src=src_lisr volatility=medium -->% para los ingresos más bajos, y sube conforme ganas más. No existe una exención anual de $500,000 ni ningún otro monto que evite la retención: esa cifra no aparece en la Ley del Impuesto sobre la Renta ni en el Diario Oficial de la Federación. Lo que sí existe es un umbral para *no presentar* declaración anual: si ganaste menos de <!-- @fact id=isr.declaration.threshold value=400000 verified=2026-06-20 src=src_lisr volatility=medium --> pesos en el año y solo tuviste un patrón, puedes omitir la declaración. Pero las retenciones mensuales ya ocurrieron. También debes saber que el salario mínimo no es un "salario típico": muchas personas ganan más, y otras menos (en empleos informales o no registrados), pero el mínimo es el piso legal obligatorio para todos los trabajadores registrados.

## Para adultos (tier5) <!-- age_band: tier5 -->
Como cabeza de familia o persona con responsabilidades económicas, es clave entender que el presupuesto familiar empieza con ingresos *netos*, no brutos: lo que recibes después de las retenciones legales (como el ISR) y las aportaciones obligatorias (como IMSS). El ISR no se calcula sobre un porcentaje fijo de tu sueldo, sino sobre una base que considera deducciones autorizadas (como gastos médicos o donativos, si los tienes). Pero para la mayoría de los trabajadores asalariados, la retención se hace automáticamente cada mes usando tablas oficiales del SAT. Por ejemplo, si ganas $5,000 mensuales, tu retención aproximada será de $50–$70, dependiendo de tus percepciones y deducciones. Esto no es una estimación personal: es un cálculo reglamentario que tu patrón está obligado a hacer. Y recuerda: el salario mínimo sigue siendo el mínimo legal que debe pagarse por jornada completa —no por hora, no por semana, sino por día trabajado— y se actualiza cada año por acuerdo de la CONASAMI, publicado en el Diario Oficial de la Federación.
