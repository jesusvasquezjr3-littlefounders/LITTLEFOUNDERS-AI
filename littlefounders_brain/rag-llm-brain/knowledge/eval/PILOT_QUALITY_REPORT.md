# Reporte de Calidad — Piloto de Impuestos

> **Fecha:** 2026-06-19 · **Alcance:** 11 temas (22 docs ES/EN), dominio `impuestos` (MX + US + shared).
> **Método:** panel de juez LLM (rúbrica 5 dimensiones) + verificación **adversaria** de cada `@fact`
> contra fuentes primarias (IRS, SAT, LISR/LIVA, DOF, SSA, Federal Reserve, Tax Foundation, OECD).
> 22 agentes independientes. Pipeline: `brain-pilot-quality-eval`.

## Veredicto

**Los 11 temas: `publish`. Cero hard-fails. Cada `@fact` verificado = `confirmed` (0 wrong / 0 outdated / 0 unverifiable).**

Precisión factual perfecta: todos los valores 2026 se confirmaron contra fuente primaria —
IVA 16%/8%/0%, ISR PM 30%, RESICO 1–2.5% / 3.5M / 35M, CFDI 4.0, deducción estándar US 16,100/32,200,
SE tax 15.3% (12.4+2.9) / 92.35% / $400, 1099-K 20,000+200, 1099-NEC 2,000, EIN gratis, SSN 9 dígitos,
"US sin IVA federal", OBBBA firmada 4-jul-2025.

## Puntajes (1–5)

| Tema | Factual | Pedagogía | País | Traducción | Engagement | Veredicto |
|------|:------:|:--------:|:----:|:---------:|:---------:|-----------|
| shared/what-is-a-tax | 5 | 5 | 5 | 5 | 4 | publish |
| mx/iva | 5 | 5 | 5 | 5 | 4 | publish |
| mx/isr | 5 | 5 | 5 | 5 | 4 | publish |
| mx/resico | 5 | 5 | 5 | 5 | 4 | publish |
| mx/cfdi | 5 | 5 | 5 | 5 | 4 | publish |
| mx/rfc | 5 | 5 | 5 | 5 | 4 | publish |
| us/federal-income-tax | 5 | **4** | 5 | 5 | 4 | publish |
| us/sales-tax | 5 | 5 | 5 | 5 | 4 | publish |
| us/self-employment-tax | 5 | 5 | 5 | 5 | 4 | publish |
| us/tax-forms | 5 | 5 | 5 | 5 | 4 | publish |
| us/ein | 5 | 5 | 5 | 5 | 4 | publish |
| **Promedio** | **5.0** | **4.9** | **5.0** | **5.0** | **4.0** | — |

## Temas de mejora (todos menores; ninguno bloquea)

1. **Engagement 4/5 de forma consistente — la única palanca real.** Los jueces coinciden: las secciones
   tier5/avanzado son correctas pero "enumerativas/secas". La recomendación repetida es **añadir un
   mini-ejemplo numérico concreto** por doc (p.ej. IVA: "si algo cuesta $100 + IVA pagas $116, encuentra
   los $16"; SE tax: "$10,000 netos → ×92.35% → ×15.3%"). Sube engagement 4→5 y ancla lo concreto en
   tiers jóvenes. **Decisión sugerida: adoptarlo como convención del corpus antes de escalar.**
2. **Precisión en tier joven — `mx/iva`:** tier3-4 dice "medicinas" al 0%; legalmente es "medicinas de
   patente" (el tier5 lo dice bien). Sugerencia: "muchas medicinas". Micro-precisión.
3. **`us/tax-forms` — 1099-K:** dice "$20,000 y 200 transacciones"; el estatuto es **">200"** (más de
   200). El valor es correcto; afinar a "más de 200". (Nota: el umbral 1099-K es retroactivo a 2025, no
   solo 2026 — el doc lo ata a "año fiscal 2026", lo cual subestima levemente la línea de tiempo.)
4. **Sentinels `@fact` faltantes:** algunos hechos verificables (las 7 tasas marginales US, fecha OBBBA,
   meses de declaración MX) no están envueltos en `@fact`; conviene marcarlos para re-verificación futura.
5. **Nits de citación/formato:** el doc `shared` cita solo una fuente terciaria (permitido por
   `volatility: static`); inconsistencia cosmética de comillas en un `@fact` EN; `RENAPO` se menciona
   pero no está en `sources.yaml`.

## Conclusión

El piloto es **de calidad publicable** con exactitud factual verificada contra fuentes primarias. Las
mejoras son pulido, dominadas por una sola palanca (ejemplos numéricos para engagement). Recomendación:
decidir la convención de "mini-ejemplo numérico por doc", aplicar los 2-3 micro-fixes de precisión, y
proceder a escalar a los siguientes dominios con esa convención incorporada en el contrato de autoría.
