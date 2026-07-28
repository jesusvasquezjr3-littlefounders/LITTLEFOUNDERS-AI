# ORACLE.md — Tutor IA (diseño aprobado, NO implementado)

> **ESTADO: FUTURO.** El dueño decidió (2026-07-25) que la funcionalidad de
> Tutor IA es demasiado compleja para desarrollarse de paso y requiere una
> sesión dedicada. Este documento captura el diseño completo de la v1
> ("Money Moments") tal como fue analizado, prototipado y luego REVERTIDO
> (commit de revert sobre `67dfb6e` — ese commit contiene una implementación
> de referencia completa y funcional si la sesión futura quiere partir de
> ella con `git show`). Nada de lo aquí descrito existe en el código activo.

## Fundamento (análisis edtech 2026-07-25)

Patrón origen: Google Labs *Little Language Lessons* — "Tiny Lesson": la
SITUACIÓN real del aprendiz, no un nodo de currículo, como unidad de
aprendizaje (transfer-appropriate processing). Su colección demuestra que el
context-first engancha mejor que "elige la lección 37", y que TODO el
artefacto puede generarse en un pase y moderarse ANTES de mostrarse.

Adaptación crítica de seguridad (§1.9): el niño NUNCA escribe texto libre —
elige de una **taxonomía cerrada y curada de situaciones**, así ningún dato
del menor viaja a APIs de terceros. "Bajo demanda" en runtime = lectura de un
pool pre-aprobado en Vault, cero IA sin filtrar frente a un niño, latencia
cero.

## Arquitectura v1 diseñada (Money Moments)

1. **Taxonomía de situaciones** — YAML curado por humanos, trilingüe A MANO
   (un tianguis no es un yard sale ni una feira): 8 situaciones iniciales
   (mesada, tiendita, tianguis, skin del juego, intercambio de cartas, venta
   escolar, dinero de cumpleaños, meta de ahorro), cada una con `id`, `icon`,
   `tiers` aplicables, `title`/`description` por locale.
   Propuesta de ubicación: `coursegen/curriculum/money-moments/situations.yaml`.

2. **Vault (migración nueva)** — dos tablas con postura service-role-only
   (RLS sin políticas cliente, como `lesson_documents`):
   - `tutor_situations(id text pk, icon, title jsonb, description jsonb, tiers jsonb, position)`
   - `tutor_packs(id uuid, situation_id fk, tier, locale, pack jsonb,
     status review|published|archived, unique(situation_id, tier, locale))`

3. **Contrato del pack** (Zod): `terms` (3-5 términos con definición en
   palabras de niño), `phrases` (2-3 "qué decir/hacer" con su porqué),
   `quick_check` (1 pregunta, EXACTAMENTE 3 opciones, UNA correcta,
   `rationale_md` por opción — distractores = concepciones erróneas reales).

4. **Generación (Forge, offline)** — CLI `tutor:packs`:
   - `--sync-situations` (gratis): YAML → `tutor_situations`.
   - `--generate --confirm` (PAGADO, idempotente — un pack existente jamás se
     re-paga): por cada situación×tier×locale faltante, DeepSeek con retry
     correctivo (prompts estático-primero por la disciplina de prefix-cache) →
     validación determinística (exactamente-una-correcta, ids únicos,
     vocabulario prohibido del tier desde `taxonomy.yaml`, bandas de
     legibilidad outlier como el gate 9) → upsert como `status='review'`.
   - **Publicar es un flip HUMANO** — la misma compuerta bloqueante de
     kid-safety que las lecciones (§1.9). Volumen inicial: 60 packs
     (~centavos con el prefix-cache).

5. **Core** — `/api/v1/tutor`:
   - `GET /situations`: picker con disponibilidad para el tier del caller
     (derivado de `profiles.birth_date`: ≤7 tier1, ≤9 tier2, resto tier3;
     desconocido → tier2) y su locale.
   - `GET /situations/:id/pack`: escalera de resolución
     exacto(tier,locale) → tier@es-MX → locale → cualquiera; packs en
     `review` JAMÁS se sirven (pineado por test en el prototipo).

6. **Frontend** — `/tutor` (reemplaza el ComingSoon): grid picker de
   situaciones → vista de pack (términos, frases, reto rápido con reveal de
   racional + reintentar; calificación client-side deliberada: es práctica,
   sin XP, no amerita grading de servidor) → estado "en preparación" honesto
   cuando el pack no está publicado.

## Extensiones diseñadas para después de v1 (del análisis, no prototipadas)

- **Ancla por nodo** (patrón roadmap.sh): "ayúdame con ESTE topic" — la
  conversación siempre scoped a un nodo del mapa con el micro_objective
  inyectado server-side; jamás chat abierto como primera superficie.
- **Prompt del tutor estilo LearnLM**: pedagogía como instrucciones de
  sistema (aprendizaje activo, manejo de carga cognitiva, curiosidad,
  metacognición) + arena de evaluación offline (comparaciones ciegas por
  pares contra rúbrica) ANTES de exponer nada a un niño.
- **Telemetría de demanda**: log de situaciones elegidas (solo category IDs,
  jamás texto libre) → reporte "pedido pero débil en catálogo" para
  planeación de contenido.
- **Chat en vivo (v3+)**: exige moderación-antes-de-pantalla (stream a búfer
  de moderación, no directo), límites de contexto §1.9 (age band + nombre de
  pila máximo), rate limits y visibilidad parental de transcripciones.

## Reglas no negociables para la sesión futura

1. Taxonomía CERRADA: el picker jamás evoluciona a caja de texto libre del
   niño — ahí es exactamente donde se viola §1.9.
2. Todo contenido kid-facing pasa validación + juez + publicación humana
   ANTES de ser visible. Sin excepciones "porque es solo un tutor".
3. Solo proveedores ya definidos en §1.2 (DeepSeek/Qwen). Nada nuevo.
4. La implementación de referencia vive en `git show 67dfb6e` — úsala como
   punto de partida, no como verdad: fue escrita en una sesión general y la
   sesión dedicada debe re-evaluar cada decisión.
