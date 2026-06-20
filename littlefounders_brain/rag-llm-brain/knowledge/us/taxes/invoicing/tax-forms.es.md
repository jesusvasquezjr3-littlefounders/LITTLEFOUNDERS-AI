---
doc_id: us-taxes-invoicing-tax-forms
title_es: "Formularios fiscales de EE.UU.: 1040, W-2, 1099"
title_en: "US tax forms: 1040, W-2, 1099"
language: es
translation_of: null
country: us
jurisdiction: US-FED
domain: taxes
subdomain: invoicing
concept_ids: [tax.forms]
age_bands: [tier4, tier5]
depth_tier: intermediate
volatility: medium
last_verified_date: 2026-06-19
verified_by: jesusv
review_due: 2027-06-19
sources: [src_irs_forms, src_irs_obbba]
status: published
currency: USD
schema_version: kb-1.0
---
## For future Claude
Doc sobre los formularios fiscales federales de EE.UU. (1040, W-2, W-4, serie 1099), verificado al
2026-06-19, jurisdicción federal (IRS). Sirve tiers 4-5. Los umbrales de la serie 1099 son volátiles:
cambiaron con la ley **OBBBA** para 2026 y deben re-verificarse antes de 2027. Diferenciador clave:
estos son formularios de EE.UU. que el contribuyente **auto-reporta** al IRS; **NO** son el **CFDI**
de México (una factura electrónica certificada por el gobierno en tiempo real). Nunca equipares un
1099 con un CFDI.

## Para jóvenes (tier4) <!-- age_band: tier4 -->

En Estados Unidos, cuando ganas dinero, el gobierno federal (el **IRS**) quiere saberlo a través de
unos **formularios** con nombres como números. No es magia ni espionaje: es papeleo estandarizado.

- El **W-2** es el comprobante que tu **empleador** te entrega cada enero. Resume cuánto te pagó
  durante el año y cuánto impuesto ya te retuvo de cada cheque.
- El **W-4** es lo contrario: tú lo llenas el primer día de trabajo para decirle al empleador
  **cuánto retener** de tu sueldo. Es una instrucción que tú das.
- El **1040** es la **declaración anual** principal de personas físicas. En él juntas todos tus
  ingresos, restas lo que te corresponde y calculas si debes dinero o si te toca un reembolso.
- Los **1099** son para dinero que **no** viene de un empleo tradicional: trabajos por tu cuenta,
  apps de pago, premios. Hay varios tipos (1099-NEC, 1099-K, 1099-MISC).

La idea central: si trabajas para una empresa, recibes un **W-2**; si trabajas por tu cuenta o como
freelancer, probablemente recibas un **1099**. Después, todo eso se vacía en tu **1040**. Guardar
estos papeles ordenados durante el año hace que la temporada de impuestos sea aburrida en vez de
aterradora. Recuerda: en EE.UU. **tú** reportas; el gobierno no te emite la factura por ti.

## Avanzado (tier5) <!-- age_band: tier5 -->

El sistema federal de EE.UU. es de **auto-declaración**: el contribuyente reúne sus comprobantes
informativos y presenta el **Formulario 1040** (*U.S. Individual Income Tax Return*). Los formularios
que lo alimentan tienen funciones distintas:

- **W-2** — emitido por el empleador; reporta salarios y retenciones de un empleado.
- **W-4** — el empleado elige su nivel de retención; controla cuánto se descuenta de cada nómina.
- **1099-NEC** — pagos a no-empleados (contratistas, freelancers).
- **1099-K** — ingresos liquidados por apps y plataformas de pago.
- **1099-MISC** — otros ingresos misceláneos (rentas, premios, regalías).

Los **umbrales** de reporte cambiaron con la ley **OBBBA** para el año fiscal 2026. El **1099-K** se
emite a partir de **$20,000 y 200 transacciones**. <!-- @fact id=us.1099k.threshold value="20,000+200tx" verified=2026-06-19 src=src_irs_obbba volatility=medium --> El umbral de reporte del
**1099-NEC/MISC** subió a **$2,000** desde 2026. <!-- @fact id=us.1099nec.threshold value=2,000 verified=2026-06-19 src=src_irs_obbba volatility=medium --> Importante: aunque no recibas un 1099
por estar bajo el umbral, **sigues obligado** a reportar el ingreso; el formulario es informativo,
no la condición que crea el impuesto.

> **Diferenciador US vs MX:** estos son formularios de **auto-declaración** ante el IRS, emitidos por
> empleadores o pagadores y conciliados por el contribuyente. **NO** son el **CFDI** mexicano, que es
> una factura electrónica **certificada por la autoridad (SAT) en tiempo real**. Un 1099 reporta pagos
> *después* del hecho; un CFDI *autoriza* la factura en el momento. No son equivalentes.
