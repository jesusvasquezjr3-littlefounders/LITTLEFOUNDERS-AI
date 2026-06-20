---
doc_id: mx-taxes-invoicing-cfdi
title_es: "El CFDI: la factura electrónica de México"
title_en: "CFDI: Mexico's electronic invoice"
language: es
translation_of: null
country: mx
jurisdiction: MX-FED
domain: taxes
subdomain: invoicing
concept_ids: [tax.invoicing.cfdi]
age_bands: [tier4, tier5]
depth_tier: advanced
volatility: medium
last_verified_date: 2026-06-19
verified_by: jesusv
review_due: 2027-06-19
sources: [src_sat_cfdi, src_sat_home]
status: published
currency: MXN
schema_version: kb-1.0
---
## For future Claude
Doc sobre el **CFDI** (Comprobante Fiscal Digital por Internet), la factura electrónica obligatoria de
México, verificado al 2026-06-19, jurisdicción federal (SAT). Sirve tiers 4-5. La versión vigente es
la **4.0**, dato volatilidad media — re-verificar antes de 2027 por si el SAT publica una versión nueva.
**Diferenciador clave:** el CFDI es exclusivamente mexicano (factura electrónica certificada por el
gobierno **en tiempo real** para cada transacción). NO es un "1099" ni una "invoice" de EE.UU.; Estados
Unidos **no tiene equivalente** al CFDI.

## Para jóvenes (tier4) <!-- age_band: tier4 -->

Imagina que cada vez que alguien vende algo en México —un café, un corte de pelo, una computadora— el
gobierno quiere un **recibo oficial** de esa venta. Ese recibo se llama **CFDI**, que significa
**Comprobante Fiscal Digital por Internet**. No es un papel cualquiera: es un archivo digital que el
**SAT** (la oficina de impuestos de México) revisa y aprueba casi al instante.

Lo interesante del CFDI es que **no se puede inventar**. Antes de que valga, tiene que pasar por un
ayudante autorizado llamado **PAC** (Proveedor Autorizado de Certificación), que lo "sella" en nombre
del gobierno. Una vez sellado, el comprobante recibe un número único llamado **folio fiscal** o **UUID**
—como una huella digital que ningún otro CFDI en todo el país puede repetir.

¿Para qué sirve? Cuando compras algo y pides tu factura, lo que recibes es un CFDI. Te sirve para
comprobar que pagaste, para que la empresa demuestre lo que vendió, y para que el SAT sepa cuánto
dinero se movió. La versión que se usa hoy es la **4.0**. <!-- @fact id=mx.cfdi.version value=4.0 verified=2026-06-19 src=src_sat_cfdi volatility=medium --> Cada vez que el SAT actualiza las reglas,
cambia el número de versión, así que todos en México deben usar el mismo formato al mismo tiempo.

## Avanzado (tier5) <!-- age_band: tier5 -->

El **CFDI** (Comprobante Fiscal Digital por Internet) es el estándar de **facturación electrónica
obligatoria** en México: se requiere para **toda transacción gravada**, sin importar el monto. A
diferencia de un recibo en papel, el CFDI es un archivo **XML** estructurado que debe **timbrarse**
(certificarse) por un **PAC** —proveedor autorizado de certificación— antes de tener validez fiscal. El
timbrado asigna el **folio fiscal (UUID)**, el sello digital del SAT y la fecha de certificación. La
versión vigente del estándar es la **4.0**. <!-- @fact id=mx.cfdi.version value=4.0 verified=2026-06-19 src=src_sat_cfdi volatility=medium -->

Existen distintos **tipos de comprobante** según la operación:

- **Ingreso:** documenta una venta o cobro (lo más común).
- **Egreso:** notas de crédito, devoluciones o descuentos.
- **Traslado:** ampara el movimiento o transporte de mercancías (complemento Carta Porte).
- **Nómina:** comprobante de pago de sueldos al personal.
- **Pago (REP):** Recibo Electrónico de Pago, para operaciones a crédito en parcialidades.

Un CFDI emitido **no se borra**: puede **cancelarse** —y desde CFDI 4.0 la cancelación normalmente
requiere la **aceptación del receptor**— o **sustituirse** por otro que lo reemplace. Para emitir CFDI
hay que estar inscrito en el **RFC**, contar con e.firma y Certificado de Sello Digital (CSD), y usar
un PAC o las herramientas gratuitas del SAT.

> **Diferenciador MX vs US:** el CFDI es **único de México**: una factura electrónica **certificada por
> el gobierno en tiempo real** para cada transacción. NO lo llames "1099" ni "invoice" estadounidense:
> en EE.UU. las facturas son documentos privados sin certificación gubernamental previa, y **no existe
> un equivalente al CFDI**.
