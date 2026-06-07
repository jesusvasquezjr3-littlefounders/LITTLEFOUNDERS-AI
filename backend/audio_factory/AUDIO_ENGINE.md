# 🎙️ Audio Engine — Documentación Maestra

> **Propósito:** Contexto recuperable del sistema de generación de narración por
> voz para las lecciones de Little Founders. Léelo para retomar el tema desde cero.
>
> **Última actualización:** 2026-06-04
> **Estado actual:** ✅ Sistema completo y probado. ⏸️ Pendiente: análisis de costes
> antes de generar masivamente. NO se ha generado ningún módulo todavía
> (solo la lección piloto `1-1-1-1` en español).

---

## 1. ¿Qué hace este sistema?

Genera **narración por voz** (audio MP3) para cada lección, a nivel de
sub-elemento del ejercicio. Cada ejercicio se descompone en "segmentos" narrables
identificados por un `target_field`:

| target_field        | Qué narra                                          |
|---------------------|----------------------------------------------------|
| `main`              | Narración general / introducción del personaje     |
| `question`          | La pregunta al estudiante                           |
| `statement`         | Afirmación a evaluar (verdadero/falso, tap)         |
| `instruction`       | Instrucción de qué hacer                            |
| `feedback_success`  | Retroalimentación al acertar                        |
| `feedback_error`    | Retroalimentación al fallar                         |

Soporta **40+ tipos de ejercicio** en **español e inglés**, usando **4 personajes**
con voz clonada (liruf, dina, dr_rho, zara_vex).

---

## 2. Arquitectura — Pipeline de generación

```
┌─────────────────────────────────────────────────────────────────┐
│  main.py / generate_module.py  (orquestación)                    │
└─────────────────────────────────────────────────────────────────┘
        │
        ▼
  ① fetch_lesson()      → Backend REST API (lesson-engine/.../play?lang=)
        │                  obtiene el JSON de la lección
        ▼
  ② extractor.py        → DeepSeek extrae {target_field: texto}
        │                  feedback se extrae directo del JSON (sin DeepSeek)
        ▼
  ③ [CACHÉ] db_client.compute_text_hash() + audio_cache lookup
        │   ├── HIT  → reusa URL existente. Costo TTS: $0  ♻️
        │   └── MISS → continúa ↓
        ▼
  ④ tts_client.py       → Qwen TTS 3.0 + voice cloning → MP3 (64kbps mono)
        │
        ▼
  ⑤ storage_client.py   → Sube MP3 a Cloudflare R2
        │
        ▼
  ⑥ db_client.py        → UPSERT en lesson_audio_segments (Supabase Postgres)
```

---

## 3. Stack y servicios externos

| Componente        | Servicio                          | Para qué                          |
|-------------------|-----------------------------------|-----------------------------------|
| Extracción texto  | **DeepSeek** (`deepseek-chat`)    | Identifica qué texto narrar       |
| TTS + clonación   | **Alibaba DashScope Qwen TTS**    | Genera el audio con voz de personaje |
| Almacenamiento    | **Cloudflare R2** (S3-compatible) | Hosting público de los MP3        |
| Base de datos     | **Supabase Postgres**             | Tabla `lesson_audio_segments`     |
| Conversión audio  | **ffmpeg** (`/opt/homebrew/bin/ffmpeg`) | WAV → MP3                  |
| Duración audio    | **mutagen**                       | Calcula `duration_ms`             |

> ⚠️ **IMPORTANTE:** El almacenamiento de **audio** vive en **Cloudflare R2**, NO
> en Supabase Storage. Supabase se usa solo para la **base de datos** (lecciones,
> personajes, segmentos de audio). Esto se migró deliberadamente para no consumir
> el tier gratuito de Supabase Storage (1 GB).

---

## 4. Archivos del factory (`backend/audio_factory/`)

| Archivo                | Responsabilidad                                              |
|------------------------|--------------------------------------------------------------|
| `config.py`            | Carga `.env`, valida variables, define paths/constantes      |
| `voice_registry.py`    | Enrolla las 8 voces (4 personajes × 2 idiomas), cachea IDs    |
| `extractor.py`         | DeepSeek → `{target_field: texto}`                           |
| `tts_client.py`        | Qwen TTS → MP3 (64kbps mono, 22kHz)                          |
| `storage_client.py`    | Sube MP3 a Cloudflare R2, devuelve URL pública              |
| `db_client.py`         | UPSERT en DB + **caché de deduplicación por hash**          |
| `main.py`              | CLI para UNA lección: `--lesson 1-1-1-1 --lang es,en`       |
| `generate_module.py`   | CLI para un MÓDULO completo: `--module 1`                   |
| `migrate_to_r2.py`     | Migración one-shot Supabase Storage → R2 (ya ejecutado)     |
| `test_voice.py`        | Test de una sola voz                                         |
| `test_all_voices.py`   | Test de las 8 voces                                          |

---

## 5. Frontend — Reproducción

| Archivo                                                                  | Rol                                  |
|--------------------------------------------------------------------------|--------------------------------------|
| `frontend/src/components/lessons/engine/hooks/useLessonAudio.ts`         | Hook que reproduce los segmentos     |
| `frontend/src/components/lessons/engine/LessonRunner.tsx`                | Llama al hook, gestiona feedback     |
| `frontend/src/components/lessons/engine/hooks/useLessonData.ts`          | Tipa y pasa el campo `audio`         |
| `backend/lesson_engine/endpoints.py`                                     | Sirve `exercise.audio` (AudioSegmentMap) |

**Lógica clave del hook:**
- `LOAD_SEQUENCE`: mapa `tipo_ejercicio → [orden de target_fields a reproducir]`
- Al cargar ejercicio: reproduce la secuencia (main → question/statement → instruction)
- Al responder: reproduce `feedback_success` o `feedback_error`
- **Degradación elegante:** si un segmento no existe / da error / autoplay bloqueado
  → se omite en silencio, la lección continúa normal.
- `isActive`: evita autoplay durante IDLE/COMPLETED (política de autoplay del navegador).

---

## 6. Indexación crítica — exercise_id es 0-based

> 🔴 **Bug histórico ya corregido — no reintroducir.**

El backend indexa el audio con `audio_by_exercise.get(idx)` donde `idx` es el
**`order_index` 0-based** (0, 1, 2…). El factory DEBE guardar `exercise_id =
order_index` (0-based), NO el `exercise.id` del API (que es 1-based / fake).

```python
# main.py — CORRECTO:
db_client.upsert_audio_segment(exercise_db_id=order_index, ...)  # order_index = 0,1,2...
```

Unicidad lógica de un segmento en la DB:
`(lesson_id, exercise_id, target_field, language_code)`

---

## 7. Optimizaciones de costo implementadas

### 7.1 Deduplicación por hash ♻️ (mayor ahorro)
- `db_client.compute_text_hash(text, character_code, lang)` = `sha256(texto.lower() + char + lang)`
- `db_client.load_audio_cache()` carga TODOS los segmentos existentes al inicio,
  indexados por hash → `{hash: (url, duration_ms)}`.
- Antes de llamar a Qwen: si el hash ya existe → reusa URL, **costo TTS $0**.
- El caché es **mutable y crece** durante la sesión (los audios nuevos se añaden).
- En `generate_module.py` el caché se comparte entre todas las lecciones del módulo,
  por lo que el % de ahorro **aumenta** conforme avanza.
- **Medido en `1-1-1-1`:** 96% de cache hits al re-procesar.

### 7.2 Bitrate 64kbps mono 🔊 (almacenamiento ÷2)
- `tts_client.py` ffmpeg: `-b:a 64k -ac 1 -ar 22050`
- Antes: 128k / 44.1kHz / stereo. Voz narrada no necesita más.
- Resultado: ~17 GB → ~8–9 GB estimados.

### 7.3 Generación por módulo (lazy) 🚀
- No generar las 2,461 lecciones de golpe. Generar por módulo según necesidad.
- `generate_module.py --module N` procesa un "adventure" completo.
- Carga voces UNA vez, mantiene caché vivo, muestra ETA y ahorro.

---

## 8. Escala del proyecto (datos reales del manifest)

| Métrica                          | Valor      |
|----------------------------------|------------|
| Lecciones totales                | **2,461**  |
| Ejercicios promedio por lección  | 12.7       |
| Campos narrables por ejercicio   | 2.97       |
| Segmentos totales (2 idiomas)    | ~185,653   |

**Lecciones por módulo (adventure):**

| Módulo | Carpeta       | Lecciones |
|--------|---------------|-----------|
| 1      | `adventure_1` | 467       |
| 2      | `adventure_2` | 410       |
| 3      | `adventure_3` | 340       |
| 4      | `adventure_4` | 340       |
| 5      | `adventure_5` | 396       |
| 6      | `adventure_6` | 508       |

---

## 9. Estimación de costos

### Total (las 2,461 lecciones, sin deduplicación)
| Concepto            | Costo            |
|---------------------|------------------|
| DashScope Qwen TTS  | $228 – $342 USD  |
| DeepSeek            | ~$8 USD          |
| **Total one-time**  | **~$236 – $350** |
| R2 storage          | ~$0.10/mes       |

### Módulo 1 (467 lecciones) — con deduplicación estimada 25–35%
| Concepto            | Estimado         |
|---------------------|------------------|
| TTS calls reales    | ~22,900 – 26,400 |
| **Costo TTS**       | **$37 – $54 USD**|
| DeepSeek            | ~$0.65 USD       |
| **Total Módulo 1**  | **~$38 – $55 USD** |
| Almacenamiento      | ~1.6 GB          |
| Tiempo (secuencial) | ~14 – 18 h       |

> 📌 **Pendiente:** validar estos números con una corrida real parcial antes de
> comprometer el presupuesto completo. El % de deduplicación real se confirmará
> con la primera generación.

### Pricing de referencia
- **Qwen TTS:** ¥0.10–0.15 / 1,000 caracteres (endpoint internacional)
- **DeepSeek:** $0.14/M tokens input, $0.28/M tokens output (`deepseek-chat`)
- **Cloudflare R2:** 10 GB gratis, luego $0.015/GB, egress gratis
- **Supabase Storage:** 1 GB gratis, luego $0.021/GB (NO usado para audio)

---

## 10. Configuración (`.env`)

```bash
# DashScope (Qwen TTS + voice cloning)
DASHSCOPE_API_KEY=sk-...

# DeepSeek (extracción de texto)
DEEPSEEK_API_KEY=sk-...
DEEPSEEK_BASE_URL=https://api.deepseek.com

# Backend REST (lectura de lecciones)
BACKEND_URL=http://localhost:8000

# Supabase (solo base de datos)
SUPABASE_URL=https://xxpsyormxalqjcbomiwe.supabase.co
SUPABASE_SERVICE_KEY=...

# Cloudflare R2 (almacenamiento de audio)
R2_ACCOUNT_ID=835443f3062594b5ad6b34b16049cd38
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET=lesson-audio
R2_PUBLIC_URL_BASE=https://pub-e48e240762794f02a541fca13b33d7ba.r2.dev
```

> `config.py` deriva `R2_ENDPOINT_URL = https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com`

---

## 11. Comandos

```bash
cd backend/audio_factory

# Una lección, ambos idiomas
python3 main.py --lesson 1-1-1-1 --lang es,en

# Dry-run (sin generar nada, muestra cache hits)
python3 main.py --lesson 1-1-1-1 --lang es --dry-run

# Un módulo completo
python3 generate_module.py --module 1 --lang es,en

# Reanudar un módulo interrumpido
python3 generate_module.py --module 1 --lang es,en --start-from 1-2-5-1

# Re-enrollar voces (si cambian los samples)
python3 main.py --lesson 1-1-1-1 --reenroll
```

---

## 12. Rutas de almacenamiento

**En R2 (clave del objeto):**
```
{lesson_code}/{order_index}/{lang}/{target_field}.mp3
ej: 1-1-1-1/0/es/main.mp3
```

**URL pública resultante:**
```
https://pub-e48e240762794f02a541fca13b33d7ba.r2.dev/1-1-1-1/0/es/main.mp3
```

---

## 13. Historial de bugs corregidos (no reintroducir)

| Bug                                          | Fix                                            |
|----------------------------------------------|------------------------------------------------|
| Type hints `dict \| None` (Python 3.9)       | Usar `Optional[...]`                           |
| ffmpeg no encontrado en PATH                 | Ruta absoluta `/opt/homebrew/bin/ffmpeg`       |
| Header Supabase `upsert` incorrecto          | `x-upsert: true` (histórico, ya en R2)         |
| Respuesta TTS mal parseada                   | Usar `response.output.audio.url` + descarga    |
| exercise_id 1-based vs 0-based               | Guardar `order_index` (0-based)                |
| Autoplay bloqueado antes de interacción      | Flag `isActive` en `useLessonAudio`            |
| Bucket privado (HTTP 400)                    | Migrado a R2 público                            |
| Race condition en `playSingle` al desmontar  | Guard `mountedRef.current` en handlers         |
| Stale closure en `setTimeout` de autoplay    | Capturar `exerciseIdAtSchedule` + verificar    |

---

## 14. Estado de migración

- ✅ Lección `1-1-1-1` (español): 24 segmentos migrados de Supabase Storage → R2.
- ✅ Bucket Supabase `lesson-assets` limpio de audios.
- ✅ DB actualizada: todos los `audio_url` apuntan a `r2.dev`.
- ⏸️ Lección `1-1-1-1` inglés: pendiente de generar.
- ⏸️ Módulos 1–6: pendientes (esperando análisis de costes).

---

## 15. Próximos pasos sugeridos

1. **Análisis de costes** (en curso) — decidir presupuesto por módulo.
2. Generar inglés de `1-1-1-1` como prueba del pipeline completo con R2.
3. Generar **Módulo 1** como piloto real → confirmar % de deduplicación y costo real.
4. Evaluar generación on-demand (trigger backend) para lecciones sin tráfico.
5. Considerar paralelización (4–8 workers) si se generan todos los módulos.
