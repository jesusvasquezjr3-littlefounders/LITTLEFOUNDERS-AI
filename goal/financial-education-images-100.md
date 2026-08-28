# GOAL — Terminar al 100% las imágenes del curso `financial-education`

> Generas las imágenes con TU PROPIO sistema de generación (la suscripción de
> ChatGPT/Codex), NUNCA con Prism (`picturegen/`) ni con DashScope. Esa regla
> viene de una decisión explícita del owner y se explica en la sección 1. Si
> en algún punto un comando de este documento pareciera pedirte llamar a
> DashScope, DETENTE — es un error del documento, no una instrucción real.

> Este documento reemplaza cualquier versión anterior de este brief que
> hayas visto (incluida una versión previa, incorrecta, de ESTE MISMO
> archivo, que asumía por error que ibas a usar `npm run images:backfill` →
> Prism → DashScope. Esa versión estaba mal. Ignórala si la recuerdas de
> algún lado).

---

## 0. Por qué existe este archivo, otra vez

Ya hubo una sesión de 3 días (2026-08-17 a 2026-08-19) trabajando esto
correctamente, con tu mismo mecanismo de generación, que se pausó al topar
el límite semanal de uso y nunca se retomó — su rama nunca se fusionó a
`main` y quedó abandonada en un worktree separado. **Ese trabajo, sus
herramientas y sus lecciones aprendidas ya están recuperados en `main`**
(ver §3). No repitas su curva de aprendizaje ni reinventes sus scripts.

**No reportes "terminado" hasta que la sección 7 (verificación) pase.**
Reportar como terminado un trabajo que no lo está es el error más caro que
puedes cometer aquí — cuesta dinero real y las horas de la única persona
que puede diagnosticarlo después.

---

## 1. La regla que lo cambia todo: tú eres el camino de la imagen, Prism no

**Genera con tu propio sistema, en la suscripción existente. No uses Prism,
y no asumas que hay que arreglar DashScope para hacer este trabajo.**

Ese es el punto entero de este esfuerzo. Generar el catálogo completo con
Prism (Qwen vía DashScope) costó **$1,586** la primera vez. La instrucción
del owner es explícita: arreglar esto sin volver a gastar cientos o miles
de dólares con ese proveedor. Prism (`picturegen/`) enruta a DashScope /
Alibaba Model Studio — verifiqué HOY (2026-08-24) que la cuenta ya no está
en mora y la API responde, pero **eso es irrelevante para esta tarea**: la
razón para no usarla nunca fue la mora, fue el costo. Pagarle a DashScope
es una decisión POSTERIOR, que se toma solo si probar con niños muestra que
el resultado actual no alcanza.

Como generas fuera de Prism, esta tarea es dueña de tres cosas que Prism
normalmente resuelve solo: igualar la identidad visual (§4), subir los
bytes a Depot, y escribir las URLs en los documentos (§5). Nada de esto es
difícil, pero nada pasa automáticamente — y ya existe la tubería que lo
hace (§3).

---

## 2. El problema real — verificado con evidencia visual, no con metadatos

**No es "faltan imágenes".** 466 de 475 lecciones publicadas ya tienen al
menos una imagen. Tampoco es duplicación exacta de URLs — eso está en 0 hoy
(ninguna imagen se reutiliza literalmente entre lecciones).

**El problema real es de SUJETO.** Bajé 24 imágenes al azar de lecciones
publicadas de `financial-education` y las revisé una por una. **16 de 24
(66.7%) muestran el mismo puesto de limonada genérico** — fotorrealista en
la mayoría de los casos, con limones, monedas y un toldo — sin ninguna
relación con el contenido real de la lección. Ejemplos reales de esta
muestra:

| Lección | Debería mostrar | Lo que muestra |
|---|---|---|
| `sumamos-pasos-de-toda-la-aldea` (sumar pasos del pueblo) | algo sobre contar/sumar en la aldea | puesto de limonada fotorrealista con monedas |
| `mi-cuenta-lista` (mi cuenta lista, ahorro) | una cuenta de ahorro | puesto de limonada fotorrealista con monedas |
| `recuerdo-mi-primera-necesidad` (mi primera necesidad) | una necesidad personal | puesto de limonada en miniatura/diorama |

Este es el mismo bug de "sujeto por defecto" que ya se documentó y
supuestamente se corrigió el 2026-08-14 en `LF_VISUAL_IDENTITY`
(picturegen), pero **estas imágenes NO pasaron por esa corrección** — son
images generadas fuera de Prism, en algún momento anterior, sin seguir el
brief correcto, o generadas con un prompt que igual invocaba el sujeto por
defecto. No importa el origen exacto: lo que importa es que **la mayoría
del catálogo, hoy, muestra contenido incorrecto ya publicado**, no un hueco
en la cobertura.

**Antes de fanear out cualquier trabajo, corre el audit de §6 sobre las 475
lecciones completas** — la muestra de 24 es evidencia suficiente de que el
problema es real y grande, pero no asumas que 66.7% es la cifra exacta;
mídela.

---

## 3. La tubería ya existe — recuperada de la sesión anterior a `agent/tools/content/`

**Estos archivos ya están en tu checkout de `main`** (recuperados hoy desde
la rama abandonada `fix/lesson-cast-overflow-mobile` / worktree
`littlefounders-image-session`, con un bug de path absoluto corregido y un
fix nuevo para que el stamp de versión de estilo se escriba correctamente —
ver §7 sobre por qué eso importa). Si por alguna razón tu checkout no los
tiene, avisa — no los reconstruyas desde cero, alguien tiene que
sincronizarlos primero.

Documentos de contexto adicionales, léelos ANTES de tocar nada:
- `agent/handoff/codex-image-session.md` — el brief original completo
  (2026-08-16), con la identidad visual citada, las trampas ya pagadas, y
  el orden sugerido de trabajo. Sigue siendo válido salvo por los números
  (medidos contra 988 lecciones, hoy son 475 — ver §6).
- `agent/handoff/PROGRESS-2026-08-19.md` — el estado verificado al pausar:
  66-71% de progreso en el problema de REUTILIZACIÓN (ya resuelto hoy, ver
  §2), la lista exacta de las 10 herramientas y el orden en que se usan.
- `agent/tools/content/README.md` — documentación de `gate.ts` y
  `applyOps.ts`, el par que aplica cambios sin arriesgar romper nada.

Los archivos de datos viejos en esa carpeta (`work-order.json`,
`remaining-work.json`, `image-inventory.json`, los 297 `checkpoints/`) son
**históricos**: se midieron contra el catálogo de 988 lecciones, que ya no
existe (la poda de calidad del 2026-08-21 archivó 513 lecciones más,
dejando 475). No los uses para decidir qué lección tocar — regenera esa
lista fresca contra producción actual (§6). Sí sirven para entender CÓMO se
hizo el trabajo, y los checkpoints documentan qué se aplicó hasta el
pedido ~340 en detalle si necesitas auditar algo específico.

**Tubería, en orden** (documentada con más detalle en el README y en
PROGRESS, aquí el resumen operativo):

1. `export-production.mjs <work-dir>` — exporta `lesson_documents` actual
   (los 3 locales) a un directorio local. Lee `SUPABASE_URL` /
   `SUPABASE_SERVICE_ROLE_KEY` de stdin como JSON — nunca los imprimas ni
   los hardcodees. Consíguelos con
   `railway variables --service coursegen --json`.
2. `prepare-inventory.mjs <export-dir>` — reacomoda el export al layout que
   esperan `gate.ts` e `image-inventory.mjs`.
3. **Generas el arte de reemplazo con tu propio sistema aquí.** Este es el
   único paso que reemplazas respecto a lo que hizo el Codex anterior —
   todo lo demás se queda igual.
4. **Nunca llames a `picturegen/src/gen/qwenImageClient.ts`** — es el
   cliente pagado de DashScope/Qwen, lo único que este esfuerzo entero
   existe para evitar. Los siguientes dos pasos SÍ importan desde dentro de
   `picturegen/`, pero solo dos módulos angostos y gratis:
   `transcodeToWebp` (re-codifica con `sharp` localmente, sin red) y
   `uploadFile` (llama al propio `/api/v1/files` de Depot, nunca a
   DashScope). No explores el resto de `picturegen/src/gen/` buscando un
   generador gratis — no existe, a propósito.
5. `upload-production.mjs <archivo>` (una imagen) o
   `upload-many-production.mjs` (lote) — redimensiona a 1328×1328,
   convierte a WebP calidad 82 (la misma que usa Prism en producción), sube
   a Depot (`bucket: lesson-images`, `visibility: public`). Lee
   `FILEBASE_URL` / `FILEBASE_INTERNAL_KEY` de stdin JSON —
   `railway variables --service picturegen --json`.
6. `build-image-ops-from-uploads.mjs` — convierte los resultados de subida
   en ops con la forma que espera `applyOps.ts`.
7. `applyOps.ts` + `gate.ts` — aplica los ops en los 3 locales y rechaza
   cualquier cambio que meta texto narrado nuevo (dispararía TTS pagado),
   rompa el lockstep entre locales, o baje de los pisos estructurales.
   Corre ambos así (necesitas estar parado en `audiogen/` porque ahí
   resuelven `tsx` y las dependencias del módulo de narración):
   ```bash
   cd audiogen && ./node_modules/.bin/tsx ../agent/tools/content/gate.ts <work-dir> <repairs-dir> [report.json]
   cd audiogen && ./node_modules/.bin/tsx ../agent/tools/content/applyOps.ts <work-dir> <ops-dir> <out-dir> [report.json]
   ```
8. `write-production.mjs <release-json>` — hace el PATCH final a
   `lesson_documents` para una lección que pasó el gate. **Ya actualicé
   este script hoy para que también estampe
   `illustration_style_version` con la versión actual** — sin eso,
   `verify:course` nunca puede pasar para una lección que tocas (ver §7).
9. `publish-applied-orders.mjs` — cierra un lote y escribe su checkpoint.
10. `prepare-dev-preview.mjs` — exporta una lección a
    `frontend/public/dev-lessons/` (gitignored) para verla en
    `/dev/lesson-view` (ruta solo-dev) antes de confiar en un lote.

**Usa una imagen para los 3 idiomas** (`value`, no `values`, en el op
`set_field`) — un dibujo sin texto es independiente del idioma. Por eso una
imagen nueva cuesta una sola generación, no tres.

---

## 4. La identidad visual — cítala tal cual, no la parafrasees

Fuente única de verdad: `picturegen/src/judge/promptJudge.ts` →
`LF_VISUAL_IDENTITY` (verificado fresco hoy, 2026-08-24):

> Strictly two-dimensional flat educational vector graphic in the original
> LittleFounders style: polished animated-editorial feel, clean geometric
> shapes, crisp high-contrast visual reasoning, soft rounded corners, warm
> and friendly, zero text or letters in the image. Never imitate a named
> third-party brand and never use 3D rendering, photorealism, clay/plastic
> materials, painterly shading, soft focus or cinematic depth of field.
> Palette anchored on papaya-coral accents, deep navy and soft blues, with
> sunny yellows and fresh greens — bright but never neon. Use a pure white
> or transparent-looking plain background for single-object tiles; reserve
> complete contextual backgrounds for wide scenes only. SUBJECT DISCIPLINE:
> this brief fixes the LOOK and never the CONTENT, and it carries no
> default scene of its own — draw exactly and only the place, objects and
> props the label names. [...] never substitute a stock cheerful-stand
> scene for a subject you find vague. [...] (The app renders its own
> non-human characters separately, in a different layer.) No brand logos,
> no watermarks, no scary/violent elements — this is for young learners.

No-negociables, en corto:

- **Estrictamente plano, vectorial, 2D.** Nunca 3D, nunca fotorrealista,
  nunca sombreado pictórico. **Las 3 imágenes fotorrealistas que viste en
  §2 violan esto directamente** — es la señal más fácil de detectar a ojo.
- **Cero texto, letras o números** en la imagen, ni siquiera en monedas.
- **NUNCA dibujes personas ni personajes** — ni humano, cara, manos,
  mascota, ni personaje de caricatura, aunque la etiqueta nombre a Dina,
  Liruf, Rho o Zara: dibuja los OBJETOS y el LUGAR, no a ellos. La app
  dibuja sus propios personajes en otra capa.
- **Paleta:** coral-papaya, azul marino y celestes, amarillos y verdes
  frescos. Brillante, nunca neón.
- **El sujeto lo da el contenido de la lección, nunca un default.** Dibuja
  exactamente el lugar/objeto/situación que describe esa lección específica
  — un mostrador de banco, un puesto de mercado, un taller, un cuarto, un
  patio de escuela, lo que corresponda. Nunca sustituyas por una escena
  "alegre" genérica cuando el sujeto te parezca vago — sustituir así es
  exactamente el bug que produjo el puesto de limonada.

**Regla de redacción del prompt, fácil de pasar por alto:** nunca escribas
las palabras persona/personas/humano/niño/cara/manos/personaje en el texto
del prompt, ni siquiera para negarlas — un modelo de texto-a-imagen fija su
atención en lo que el prompt NOMBRA. Las exclusiones van en un campo
`negative` aparte, nunca en el prompt positivo.

---

## 5. Cómo una imagen llega a una lección

- **Bytes** en Depot (`filebase/`, bucket `lesson-images`, direccionado por
  contenido, lectura pública). URLs públicas:
  `https://media-b2c.littlefounders.ai/files/lesson-images/<sha256>.webp`.
- **Documentos** referencian con campos cuya CLAVE TERMINA en `image_url`
  — ojo, no siempre es la clave literal: `memory_flip` usa
  `a_image_url`/`b_image_url`. Un barrido que solo busque `image_url` exacto
  subcuenta el catálogo.
- `picture_assets` es la caché propia de Prism — no la tocas, no escribes
  ahí. Es también la tabla que cuentas si algún día necesitas probar que no
  se generó ninguna imagen pagada (cuéntala antes y después de tu sesión;
  debe quedar exactamente igual).

---

## 6. Mide fresco contra producción actual — no confíes en los números de 2026-08-19

El catálogo cambió de tamaño (988 → 475 publicadas) desde la última
medición. Antes de tocar una sola lección:

1. Exporta producción actual (§3, paso 1) — 475 lecciones, no 988.
2. Corre `node agent/tools/content/image-inventory.mjs <work-dir>` — esto
   te confirma reutilización (debería salir en 0 o casi 0, ya está resuelto)
   y lecciones sin ninguna imagen (debería salir 8-9 por idioma).
3. **Ninguna herramienta existente mide "sujeto incorrecto"** — eso es lo
   que hiciste a mano en §2 y es el problema real. Constrúyelo así, es
   mecánico:

   ```js
   // Para cada lección exportada:
   //   subject = document.meta.title (o el label del segmento scene_anchor)
   //   bytes   = descarga el image_url actual
   //   usa verifyPictorial(bytes, contentType, {
   //     apiBase: config.JUDGE_API_BASE,
   //     apiKey:  judgeApiKey(config),   // helper de picturegen/src/env.ts
   //     model:   config.VERIFY_MODEL,   // 'qwen-vl-plus' por defecto
   //     subject,
   //   }) de picturegen/src/verify/pictorialCheck.ts
   //   → si depictsSubject === false, la lección entra a la lista de trabajo
   ```

   **Esta llamada SÍ usa DashScope** (es un modelo de visión barato para
   verificar, no para generar — típicamente centavos de dólar por llamada,
   no los ~$0.075 de una generación de imagen). Es una excepción deliberada
   y pequeña a la regla de §1, justificada porque sin verificación
   automática vas a volver a publicar el mismo bug a esta escala otra vez.
   Si tienes cualquier duda de si esto cuenta como "usar DashScope para
   este trabajo" en el sentido que la regla del owner prohíbe, PREGUNTA
   antes de correrlo sobre las 475 lecciones — es barato pero sigue siendo
   gasto real con ese proveedor.
   
   Si prefieres no gastar ni un centavo en DashScope: la alternativa es
   revisión humana muestreada vía `/dev/lesson-view` (§3, paso 10) sobre
   una muestra más grande que la de §2 — más lento, cero riesgo de volver a
   tocar ese proveedor.

4. Produce una lista de trabajo fresca — no reutilices `remaining-work.json`
   viejo, muchas de esas 159 lecciones ya no existen (archivadas) o ya
   fueron arregladas indirectamente.

---

## 7. Definición de "terminado"

Dos verificaciones, ambas deben pasar:

**a) El audit de sujeto de §6, corrido sobre el catálogo COMPLETO (475
lecciones), reporta 0 lecciones con `depictsSubject === false`** (o, si
usas revisión humana, una muestra aleatoria de al menos 40 lecciones
revisadas a ojo, 0 con sujeto incorrecto).

**b)**
```bash
railway ssh --service coursegen -- npm run verify:course -- financial-education
```
**sale con exit code 0.** Esto ahora es alcanzable: arreglé
`write-production.mjs` hoy para que estampe
`illustration_style_version` correctamente cuando escribe — antes de ese
fix, este comando iba a fallar SIEMPRE para cualquier documento que tocaras
por esta vía, sin importar qué tan bien estuviera la imagen, porque nadie
actualizaba esa columna. Si ves fallar el check
`"every release-ready document uses the current illustration style"`
después de tocar una lección, es señal de que tu copia de
`write-production.mjs` no tiene el fix — verifica que sí lo tenga antes de
seguir.

No cierres esta tarea sin ver el exit code 0 con tus propios ojos en esta
corrida — no en una corrida de hace días, no en lo que "debería" haber
pasado.

---

## 8. Multiagentes — cómo paralelizar esto

El curso tiene 8 aventuras, conjuntos disjuntos de lecciones — es seguro
repartir el trabajo entre ellas sin riesgo de que dos workers escriban la
misma fila:

```
aldea-del-ahorro            archipielago-del-trueque
bosque-de-la-abundancia     cosmos-del-manana
faro-de-la-confianza        jardin-compartido
mercado-de-los-colores      taller-de-los-inventores
```

**Antes de fanear a 8, haz el piloto que el brief original ya recomendaba y
que sigue siendo correcto:** arregla UNA lección completa tú mismo, de
principio a fin (generar → subir → aplicar ops → gate → escribir →
preview en `/dev/lesson-view`), y confírmala a ojo antes de escalar. Un
error de identidad visual replicado por 8 workers en paralelo es 8 veces
más caro de deshacer que uno solo.

Después del piloto: si tu entorno soporta múltiples sesiones/agentes
concurrentes, asigna una aventura a cada uno, cada uno corriendo el pipeline
completo de §3 sobre su lista de trabajo (§6) filtrada a esa aventura, con
su propio checkpoint. Si solo tienes una sesión, procesa las aventuras en
secuencia — más lento pero funciona igual.

**Advertencia honesta sobre el límite semanal:** la sesión anterior se
pausó al topar un límite de uso semanal de la suscripción, trabajando SOLA.
No sé si ese límite es por sesión o compartido a nivel de cuenta. Si es
compartido, correr 8 sesiones en paralelo no acelera el trabajo total —
solo gasta el mismo presupuesto 8 veces más rápido y todas topan el límite
al mismo tiempo. Empieza con 2-3 workers en paralelo, no 8 de una vez;
si no ves el límite acercarse, escala. Si lo topas, es un límite de tiempo,
no de dinero — checkpointea (§3, paso 9) y para limpio; alguien retoma
después, igual que la vez pasada, y esta vez el checkpoint sí queda en
`main`.

---

## 9. Qué NO hacer

- No uses `npm run images:backfill` para GENERAR nada — esa herramienta
  llama a Prism → DashScope, exactamente lo que este documento existe para
  evitar. (Sí es inofensivo usar su modo `--dry-run` de solo lectura si
  quieres comparar números, pero no es parte del flujo de trabajo.)
- No llames a `picturegen/src/gen/qwenImageClient.ts`, directa ni
  indirectamente.
- No toques `entrepreneurship` ni `investing` — fuera de alcance. (Es
  probable que tengan el mismo bug de sujeto; no es tu tarea hoy.)
- No toques las 733 lecciones archivadas.
- No confíes en `work-order.json` / `remaining-work.json` /
  `image-inventory.json` viejos para decidir qué lección tocar — están
  medidos contra un catálogo que ya no existe (§3, §6).
- No escribas texto narrado nuevo en ningún campo que el gate considere
  narrado — dispara TTS pagado. El gate ya te protege de esto; no lo
  saltes ni lo edites para que pase.
- No reportes "100% completo" sin los dos checks de §7 pasando, vistos por
  ti en esta corrida.

---

## 10. Reporte final esperado

1. Resultado del audit de sujeto (§7a): cuántas lecciones se revisaron,
   cuántas tenían sujeto incorrecto al empezar, cuántas quedaron en 0.
2. Salida de `verify:course -- financial-education` (§7b), mostrando exit 0.
3. Conteo de `picture_assets` antes y después — debe ser idéntico (prueba
   de que no se gastó nada en Prism/DashScope para GENERAR, más allá del
   audit opcional de §6 si lo usaste — reporta ese gasto aparte si aplica).
4. Cuántas imágenes se generaron y subieron en total.
5. Qué aventuras necesitaron más de un intento y por qué (p. ej. toparon el
   límite semanal).
6. Si encontraste y arreglaste un bug real en la tubería: qué era, dónde,
   y el commit.
