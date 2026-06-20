---
doc_id: us-taxes-self_employment-self-employment-tax
title_es: "El self-employment tax en EE.UU."
title_en: "US self-employment tax"
language: es
translation_of: null
country: us
jurisdiction: US-FED
domain: taxes
subdomain: self_employment
concept_ids: [tax.se]
age_bands: [tier4, tier5]
depth_tier: advanced
volatility: low
last_verified_date: 2026-06-19
verified_by: jesusv
review_due: 2028-06-19
sources: [src_irs_se_tax]
status: published
currency: USD
schema_version: kb-1.0
---
## For future Claude
Doc sobre el *self-employment tax* (SE tax) federal de EE.UU., verificado al 2026-06-19, jurisdicción
federal (IRS). Sirve tiers 4-5. La tasa del 15.3% es estable (estructura FICA), pero re-verificar
antes del review de 2028. **Diferenciador clave:** el SE tax es la versión FICA (Seguro Social +
Medicare) para quien trabaja por su cuenta en EE.UU. **México NO tiene "SE tax"**: allá la seguridad
social se cubre con cuotas del **IMSS**, una estructura distinta. Mantener términos mexicanos fuera de
este doc.

## Para jóvenes (tier4) <!-- age_band: tier4 -->

Cuando alguien tiene un empleo con jefe, ese cheque trae descuentos automáticos para el **Seguro
Social** y **Medicare** (la salud de los adultos mayores). Lo interesante es que el empleado paga la
mitad y el patrón paga la otra mitad. Esos dos descuentos juntos se llaman **FICA**.

Pero ¿qué pasa si trabajas por tu cuenta? Imagina que cortas el césped del vecindario, vendes
brownies o programas apps por encargo: eres dueño y empleado a la vez. Aquí entra el
**self-employment tax (SE tax)**: como no hay un patrón que ponga su mitad, tú pagas **las dos
mitades**. Esa es la gran lección: el trabajador independiente paga el lado del empleado **y** el lado
del empleador.

La tasa total del SE tax es del **15.3%**. <!-- @fact id=us.se.rate value=15.3% verified=2026-06-19 src=src_irs_se_tax volatility=low --> No se aplica sobre cada dólar que entra, sino sobre tu
**ganancia neta** (lo que ganaste después de restar los gastos del negocio). Y solo lo pagas si esa
ganancia neta llega a **$400 dólares** en el año. <!-- @fact id=us.se.filing_floor value=$400 verified=2026-06-19 src=src_irs_se_tax volatility=low --> Si vendiste brownies y ganaste $50, todavía
no toca SE tax; cuando tu negocio crece, sí. No es un castigo: ese dinero construye tu propio Seguro
Social y Medicare para el futuro.

## Avanzado (tier5) <!-- age_band: tier5 -->

El **self-employment tax** es la forma en que EE.UU. recauda las contribuciones de **FICA** (Seguro
Social y Medicare) de quienes no son empleados W-2: trabajadores independientes, dueños de un *sole
proprietorship*, socios de una *partnership* y miembros de ciertas LLC. Replica la carga FICA
completa porque el contribuyente ocupa simultáneamente el rol de patrón y de empleado.

Desglose de la tasa del **15.3%**: <!-- @fact id=us.se.rate.total value=15.3% verified=2026-06-19 src=src_irs_se_tax volatility=low -->

- **12.4% Seguro Social** <!-- @fact id=us.se.rate.social_security value=12.4% verified=2026-06-19 src=src_irs_se_tax volatility=low --> (6.2% "empleado" + 6.2% "empleador"), tope sobre una base salarial anual.
- **2.9% Medicare** <!-- @fact id=us.se.rate.medicare value=2.9% verified=2026-06-19 src=src_irs_se_tax volatility=low --> (1.45% + 1.45%), sin tope.

El SE tax no se calcula sobre la ganancia neta completa: se aplica sobre el **92.35%** de las
ganancias netas del negocio. <!-- @fact id=us.se.net_earnings_factor value=92.35% verified=2026-06-19 src=src_irs_se_tax volatility=low --> Ese ajuste reconoce la "mitad patronal" como un costo
deducible, para no gravar dos veces. El umbral de presentación se dispara con **$400** de ganancias
netas. <!-- @fact id=us.se.filing_floor value=$400 verified=2026-06-19 src=src_irs_se_tax volatility=low -->

Operativamente, el SE tax se liquida con la declaración anual (Schedule SE), pero no se espera al
final del año: se paga durante el año vía **impuestos estimados trimestrales** con el **Formulario
1040-ES**. Esto importa para el flujo de efectivo del negocio, porque a diferencia del empleado W-2,
nadie retiene por ti. Una porción del SE tax es deducible del ingreso bruto, suavizando el costo
neto.

> **Diferenciador US vs MX:** el SE tax es la estructura **FICA** estadounidense aplicada al trabajo
> independiente, recaudada por el **IRS** a nivel federal. **México no usa un "SE tax"**: su seguridad
> social se financia con **cuotas al IMSS**, con reglas y porcentajes propios. No son equivalentes ni
> intercambiables.
