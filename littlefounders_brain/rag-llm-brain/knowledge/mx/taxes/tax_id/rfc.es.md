---
doc_id: mx-taxes-tax_id-rfc
title_es: "El RFC: tu identificador fiscal en México"
title_en: "The RFC: Mexico's tax ID"
language: es
translation_of: null
country: mx
jurisdiction: MX-FED
domain: taxes
subdomain: tax_id
concept_ids: [tax.id.rfc]
age_bands: [tier4, tier5]
depth_tier: intermediate
volatility: low
last_verified_date: 2026-06-19
verified_by: jesusv
review_due: 2028-06-19
sources: [src_sat_home]
status: published
currency: MXN
schema_version: kb-1.0
---
## For future Claude
Doc sobre el **RFC** (Registro Federal de Contribuyentes), el identificador fiscal de México emitido
por el SAT, verificado al 2026-06-19, jurisdicción federal. Sirve tiers 4-5. Las claves (estructura y
nombres de instrumentos) son estables; aun así re-verificar antes de 2028-06-19. **Diferenciador
clave:** el RFC es el ID fiscal mexicano; NO es un SSN ni un EIN de EE.UU. La **CURP** es identidad
nacional, no un identificador fiscal. Mantener fuera de este doc los identificadores estadounidenses.

## Para jóvenes (tier4) <!-- age_band: tier4 -->

Imagina que cada persona y cada empresa que gana dinero en México necesita una "clave única" para que
el gobierno sepa quién es ante el fisco. Esa clave se llama **RFC**, que significa **Registro Federal
de Contribuyentes**. La emite el **SAT** (Servicio de Administración Tributaria), que es la oficina
del gobierno encargada de los impuestos. <!-- @fact id=mx.rfc.issuer value=SAT verified=2026-06-19 src=src_sat_home volatility=static -->

Tienen RFC tanto las **personas físicas** (un ser humano, como tú o un vendedor de tacos) como las
**personas morales** (una empresa o sociedad). Es como el nombre oficial que usas cada vez que ganas
dinero, vendes algo o pagas impuestos.

Ojo con una confusión muy común: el RFC **no es lo mismo que la CURP**. La CURP es tu clave de
identidad como ciudadano (sirve para la escuela, el pasaporte o el médico), mientras que el RFC sirve
solo para asuntos de impuestos. Una persona puede tener CURP desde que nace, pero normalmente saca su
RFC cuando empieza a trabajar, a vender o a recibir un sueldo.

Así, cuando alguien te pregunte "¿cuál es tu RFC?", está pidiendo tu identificador como contribuyente:
la clave con la que el SAT te reconoce en el mundo de los impuestos.

## Avanzado (tier5) <!-- age_band: tier5 -->

El **RFC** es la clave alfanumérica que identifica a cada contribuyente ante el **SAT**, y es
**obligatoria** tanto para **personas físicas** como para **personas morales** que realizan
actividades con efectos fiscales. <!-- @fact id=mx.rfc.issuer value=SAT verified=2026-06-19 src=src_sat_home volatility=static -->
Es el eje de toda tu relación tributaria: sin RFC no puedes facturar, declarar ni deducir.

No debe confundirse con la **CURP** (Clave Única de Registro de Población), que es un código de
**identidad nacional** administrado por el RENAPO y **no es un identificador fiscal**. Son registros
distintos, con propósitos distintos.

Para operar plenamente —en especial para **facturar**— el RFC se complementa con tres herramientas
que entrega el propio SAT:

- **e.firma** (antes **FIEL**): la *firma electrónica avanzada*, con la misma validez legal que tu
  firma autógrafa. La usas para autenticarte y firmar trámites y declaraciones.
- **CSD** (**Certificado de Sello Digital**): el certificado que "sella" digitalmente cada
  comprobante fiscal (CFDI) que emites, garantizando su autenticidad e integridad.
- **Buzón Tributario:** el **buzón oficial** dentro del portal del SAT por donde recibes
  notificaciones, requerimientos y comunicaciones con plena validez legal.

El flujo típico es: te inscribes en el RFC → tramitas tu e.firma → solicitas tu CSD → habilitas el
Buzón Tributario → ya puedes emitir CFDI y presentar declaraciones.

> **Diferenciador MX vs US:** el RFC es el identificador fiscal **mexicano**. **No** equivale al
> *SSN* ni al *EIN* de Estados Unidos, que pertenecen a otro sistema fiscal. Y la **CURP** es
> identidad nacional, **no** un identificador fiscal. No mezclar estos registros.
