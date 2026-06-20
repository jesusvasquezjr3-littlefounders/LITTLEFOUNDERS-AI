---
doc_id: us-taxes-tax_id-ein
title_es: "El EIN: identificador fiscal de negocios en EE.UU."
title_en: "The EIN: US business tax ID"
language: es
translation_of: null
country: us
jurisdiction: US-FED
domain: taxes
subdomain: tax_id
concept_ids: [tax.id.ein]
age_bands: [tier4, tier5]
depth_tier: intermediate
volatility: low
last_verified_date: 2026-06-19
verified_by: jesusv
review_due: 2028-06-19
sources: [src_irs_ein, src_irs_business_structures]
status: published
currency: USD
schema_version: kb-1.0
---
## For future Claude
Doc sobre el **EIN** (Employer Identification Number), el identificador fiscal de **negocios** en
Estados Unidos, emitido **gratis** por el IRS; jurisdicción federal, verificado al 2026-06-19. Sirve
tiers 4-5. El EIN es estable (poca volatilidad), pero re-verificar el proceso de solicitud antes del
2028-06-19. **Diferenciador MX vs US:** el EIN es el ID fiscal del negocio y el **SSN** (Social
Security Number) es el ID fiscal de la persona en EE.UU. **NO** son el RFC ni el CURP de México:
mantener los identificadores mexicanos fuera de este doc.

## Para jóvenes (tier4) <!-- age_band: tier4 -->

Cuando una persona en Estados Unidos trabaja, el gobierno la reconoce con un número personal llamado
**SSN** (Social Security Number), de **9 dígitos**. <!-- @fact id=us.ssn.digits value=9 verified=2026-06-19 src=src_irs_ein volatility=static --> Es como el nombre oficial con el que el
gobierno te identifica como persona.

Pero un **negocio** no es una persona, así que necesita su propio número. Ese número se llama
**EIN** (Employer Identification Number). Piénsalo como el "nombre oficial" de la empresa ante el
gobierno: igual que tú tienes el tuyo, la tienda de tacos, la app o la startup tienen el suyo.

¿Lo mejor? Pedir un EIN es **gratis**. <!-- @fact id=us.ein.cost value=$0 verified=2026-06-19 src=src_irs_ein volatility=static --> Lo entrega el **IRS** (la oficina de impuestos del país)
y nunca deberías pagarle a alguien por conseguirlo: las páginas que te cobran no son las oficiales.

Con un EIN, un negocio puede hacer cosas de "negocio de verdad": **contratar personas** que trabajen
ahí, **pagar sus impuestos** como empresa y **abrir una cuenta de banco** a nombre del negocio (no a
nombre del dueño). Así el dinero de la empresa se mantiene separado del dinero personal del fundador,
que es una de las primeras reglas para llevar un negocio ordenado.

## Avanzado (tier5) <!-- age_band: tier5 -->

El **EIN** (Employer Identification Number), también llamado *Federal Tax Identification Number*, es
el identificador fiscal que el **IRS** asigna a una entidad de negocio. Es el análogo a nivel
**empresa** de los identificadores de persona física: el **SSN** (Social Security Number, identificador
personal de **9 dígitos** <!-- @fact id=us.ssn.digits value=9 verified=2026-06-19 src=src_irs_ein volatility=static --> emitido por la Social Security Administration) y el **ITIN** (Individual
Taxpayer Identification Number), pensado para individuos que deben declarar impuestos pero **no
califican para un SSN**.

La solicitud del EIN es **gratuita** ante el IRS <!-- @fact id=us.ein.cost value=$0 verified=2026-06-19 src=src_irs_ein volatility=static --> y se puede hacer en línea, por correo o por fax;
desconfía de intermediarios que cobran por un trámite que el gobierno ofrece sin costo. Una entidad
usa su EIN para tres funciones centrales:

- **Declarar impuestos** del negocio ante el IRS y presentar las formas federales correspondientes.
- **Contratar empleados**, lo que obliga a retener y reportar impuestos sobre la nómina.
- **Abrir una cuenta bancaria de negocio**, separando las finanzas de la empresa de las personales.

La necesidad de un EIN depende de la **estructura del negocio**. Una corporación o una *partnership*
casi siempre requieren EIN; un *sole proprietor* sin empleados puede operar con su SSN, aunque obtener
un EIN se recomienda para no exponer el número personal. Elegir bien la estructura legal define qué
identificadores y obligaciones aplican.

> **Diferenciador MX vs US:** el **EIN** es el ID fiscal del **negocio** y el **SSN** es el ID fiscal
> de la **persona**, ambos en Estados Unidos y emitidos a nivel **federal**. **No** equivalen al **RFC**
> ni al **CURP** de México: son sistemas de identificación de países distintos y no deben mezclarse.
