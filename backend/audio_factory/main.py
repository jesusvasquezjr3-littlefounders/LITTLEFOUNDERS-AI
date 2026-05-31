"""
main.py — Punto de entrada del audio_factory.

Uso:
  python main.py --lesson 1-1-0-1
  python main.py --lesson 1-1-0-1 --lang es
  python main.py --lesson 1-1-0-1 --lang en
  python main.py --lesson 1-1-0-1 --lang es,en      (ambos idiomas)
  python main.py --lesson 1-1-0-1 --reenroll         (re-enrolla las voces)
  python main.py --lesson 1-1-0-1 --dry-run          (solo muestra qué haría)

Proceso por ejercicio:
  1. Obtiene datos de la lección desde el backend REST API.
  2. Usa DeepSeek para extraer {target_field: texto} del exercise JSON.
  3. Genera audio MP3 con Qwen TTS + voice cloning (por personaje).
  4. Sube el MP3 a Supabase Storage.
  5. Upsert en lesson_audio_segments.
"""
from __future__ import annotations

import argparse
import sys
import time

import db_client
import extractor
import requests as http
import storage_client
import tts_client
import voice_registry

# Importar config primero (carga .env y valida variables)
import config

# ── Fallback de personaje ─────────────────────────────────────────────────
# Si un ejercicio no tiene character_code, se usa liruf como narrador por defecto
DEFAULT_CHARACTER = "liruf"


def fetch_lesson(lesson_code: str, lang: str) -> dict | None:
    """
    Obtiene los datos de la lección desde el backend REST API.
    Devuelve el JSON de la lección o None si falla.
    """
    url = f"{config.BACKEND_URL}/lesson-engine/lessons/{lesson_code}/play?lang={lang}"
    try:
        resp = http.get(url, timeout=15)
        resp.raise_for_status()
        return resp.json()
    except http.exceptions.HTTPError as e:
        print(f"[main] ✗ ERROR al obtener lección '{lesson_code}' (lang={lang}): {e}")
        if e.response is not None and e.response.status_code == 404:
            print(f"       La lección '{lesson_code}' no existe en el backend.")
        return None
    except Exception as e:
        print(f"[main] ✗ ERROR de red al obtener lección: {e}")
        print(f"       Asegúrate de que el backend está corriendo en {config.BACKEND_URL}")
        return None


def process_lesson(
    lesson_code: str,
    langs: list[str],
    voice_map: dict[str, str],
    dry_run: bool = False,
    audio_cache: dict | None = None,
) -> dict:
    """
    Procesa todos los ejercicios de una lección en los idiomas indicados.

    Args:
        audio_cache: Dict {hash: (url, duration_ms)} con audios ya generados.
                     Si se provee, los textos repetidos reusan el URL existente
                     sin llamar a Qwen TTS (ahorro de costo de API).
                     Si es None, se deshabilita la deduplicación.

    Returns:
        Reporte de resultados:
        {
          "total": int,
          "generated": int,
          "cache_hits": int,
          "skipped": int,
          "errors": int,
          "error_details": list[str],
        }
    """
    if audio_cache is None:
        audio_cache = {}

    stats = {"total": 0, "generated": 0, "cache_hits": 0, "skipped": 0, "errors": 0, "error_details": []}

    for lang in langs:
        print(f"\n{'─'*60}")
        print(f"  Procesando lección '{lesson_code}' — idioma: {lang.upper()}")
        print(f"{'─'*60}")

        lesson_data = fetch_lesson(lesson_code, lang)
        if not lesson_data:
            stats["errors"] += 1
            stats["error_details"].append(f"[{lang}] No se pudo obtener la lección desde el backend.")
            continue

        lesson_info = lesson_data.get("lesson", {})
        # El API devuelve public_id (UUID) como "id" — resolver al integer FK
        lesson_public_id: str = lesson_info.get("id", "")
        if not lesson_public_id:
            print("  [main] ✗ La respuesta no incluye lesson.id.")
            stats["errors"] += 1
            continue

        lesson_id: int | None = db_client.get_lesson_integer_id(lesson_public_id)
        if not lesson_id:
            print(f"  [main] ✗ No se pudo resolver lesson UUID '{lesson_public_id}' a integer ID.")
            stats["errors"] += 1
            continue

        timeline: list[dict] = lesson_data.get("timeline", [])
        if not timeline:
            print("  [main] ⚠ La lección no tiene ejercicios.")
            continue

        print(f"  Lección ID: {lesson_id} | Ejercicios: {len(timeline)}\n")

        for exercise in timeline:
            exercise_id: int = exercise.get("id")
            exercise_type: str = exercise.get("type", "unknown")
            order_index: int = exercise.get("order_index", 0)

            # Determinar el personaje del ejercicio
            character_code: str = (
                exercise.get("character_code")
                or exercise.get("content", {}).get("characterCode")
                or DEFAULT_CHARACTER
            )

            print(f"  [{order_index}] {exercise_type} (ID:{exercise_id}, char:{character_code})")

            # Verificar que el personaje tiene voz enrollada para este idioma
            # La key del registry es "{character_code}_{lang}" (ej: "liruf_es")
            registry_key = f"{character_code}_{lang}"
            voice_id: str | None = voice_map.get(registry_key)
            if not voice_id:
                print(f"      ⚠ Sin voice_id para '{registry_key}' — saltando ejercicio.")
                stats["skipped"] += 1
                continue

            # ── Extracción de texto ────────────────────────────────────
            # NOTA: el backend indexa audio_by_exercise con order_index (0-based).
            # No usar exercise_id del API (que es idx+1, 1-based fake ID).
            try:
                text_segments: dict[str, str] = extractor.extract_text_segments(exercise, lang)
            except Exception as e:
                print(f"      ✗ ERROR en extracción de texto: {e}")
                stats["errors"] += 1
                stats["error_details"].append(
                    f"[{lang}] ex#{order_index} ({exercise_type}): extractor falló — {e}"
                )
                continue

            if not text_segments:
                print("      ⚠ Sin texto extraído para este ejercicio — saltando.")
                stats["skipped"] += 1
                continue

            print(f"      Campos a generar: {list(text_segments.keys())}")

            # ── Generación de audio por target_field ───────────────────
            for target_field, text in text_segments.items():
                stats["total"] += 1

                if dry_run:
                    text_hash = db_client.compute_text_hash(text, character_code, lang)
                    cached = audio_cache.get(text_hash)
                    tag = "[CACHE HIT]" if cached else "[NUEVO]"
                    print(f"      [DRY-RUN] {tag} {target_field}: «{text[:55]}{'...' if len(text) > 55 else ''}»")
                    stats["generated"] += 1
                    if cached:
                        stats["cache_hits"] += 1
                    continue

                # ── Verificar caché antes de llamar a Qwen TTS ─────────
                text_hash = db_client.compute_text_hash(text, character_code, lang)
                cached = audio_cache.get(text_hash)

                if cached:
                    # Cache hit: reusar URL existente, sin TTS ni subida a R2
                    cached_url, cached_duration = cached
                    try:
                        db_client.upsert_audio_segment(
                            lesson_id=lesson_id,
                            exercise_db_id=order_index,
                            target_field=target_field,
                            language_code=lang,
                            audio_url=cached_url,
                            transcript=text,
                            duration_ms=cached_duration,
                            character_code=character_code,
                            emotion=config.DEFAULT_EMOTION,
                            order_index=0,
                        )
                        print(f"      ♻ {target_field} [CACHE HIT — $0] → reusing audio")
                        stats["generated"] += 1
                        stats["cache_hits"] += 1
                    except RuntimeError as e:
                        print(f"      ✗ ERROR registrando cache hit en {target_field}: {e}")
                        stats["errors"] += 1
                        stats["error_details"].append(
                            f"[{lang}] ex#{order_index}/{target_field} (cache): {e}"
                        )
                    continue

                # ── Cache miss: generar nuevo audio ────────────────────
                try:
                    # 1. Generar audio con Qwen TTS
                    audio_bytes, duration_ms = tts_client.generate_audio(text, voice_id)

                    # 2. Subir a Cloudflare R2
                    audio_url = storage_client.upload_audio(
                        audio_bytes=audio_bytes,
                        lesson_code=lesson_code,
                        order_index=order_index,
                        lang=lang,
                        target_field=target_field,
                    )

                    # 3. Registrar en DB
                    # Usar order_index (0-based) como exercise_id para que coincida
                    # con la lógica de audio_by_exercise.get(idx) en el backend.
                    db_client.upsert_audio_segment(
                        lesson_id=lesson_id,
                        exercise_db_id=order_index,
                        target_field=target_field,
                        language_code=lang,
                        audio_url=audio_url,
                        transcript=text,
                        duration_ms=duration_ms,
                        character_code=character_code,
                        emotion=config.DEFAULT_EMOTION,
                        order_index=0,
                    )

                    # 4. Añadir al caché en memoria para hits futuros en esta ejecución
                    audio_cache[text_hash] = (audio_url, duration_ms)

                    dur_str = f"{duration_ms}ms" if duration_ms else "?ms"
                    print(f"      ✓ {target_field} [{dur_str}] → {audio_url.split('/')[-1]}")
                    stats["generated"] += 1

                    # Pausa breve para no saturar la API de Qwen
                    time.sleep(0.5)

                except RuntimeError as e:
                    print(f"      ✗ ERROR en {target_field}: {e}")
                    stats["errors"] += 1
                    stats["error_details"].append(
                        f"[{lang}] ex#{order_index}/{target_field}: {e}"
                    )
                    continue

    return stats


def print_report(lesson_code: str, langs: list[str], stats: dict, elapsed: float) -> None:
    """Imprime el reporte final de la ejecución."""
    hits       = stats.get("cache_hits", 0)
    generated  = stats.get("generated", 0)
    new_audio  = generated - hits

    print(f"\n{'═'*60}")
    print(f"  REPORTE FINAL — {lesson_code} | Langs: {', '.join(langs)}")
    print(f"{'═'*60}")
    print(f"  Audios procesados : {stats['total']}")
    print(f"  ✓ Generados       : {generated}")
    print(f"  ♻ Cache hits ($0) : {hits}  ({hits*100//generated if generated else 0}% ahorro)")
    print(f"  🔊 TTS calls reales: {new_audio}")
    print(f"  ⚠ Saltados        : {stats['skipped']}")
    print(f"  ✗ Errores         : {stats['errors']}")
    print(f"  Tiempo total      : {elapsed:.1f}s")

    if stats["error_details"]:
        print("\n  Detalle de errores:")
        for err in stats["error_details"]:
            print(f"    - {err}")

    print(f"{'═'*60}\n")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Little Founders Audio Factory — Genera audios para lecciones.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Ejemplos:
  python main.py --lesson 1-1-0-1
  python main.py --lesson 1-1-0-1 --lang en
  python main.py --lesson 1-1-0-1 --lang es,en
  python main.py --lesson 1-1-0-1 --reenroll --dry-run
        """,
    )
    parser.add_argument(
        "--lesson",
        required=True,
        help="Código de la lección (ej: 1-1-0-1)",
    )
    parser.add_argument(
        "--lang",
        default="es,en",
        help="Idioma(s) a generar. Separados por coma: es,en (default: es,en)",
    )
    parser.add_argument(
        "--reenroll",
        action="store_true",
        help="Fuerza re-enrollment de todas las voces, ignorando el cache.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        dest="dry_run",
        help="Simula la ejecución sin generar audio ni escribir en la DB.",
    )

    args = parser.parse_args()

    lesson_code: str = args.lesson.strip()
    langs: list[str] = [l.strip().lower() for l in args.lang.split(",") if l.strip()]

    # Validar idiomas
    for lang in langs:
        if lang not in config.SUPPORTED_LANGS:
            print(f"[main] ERROR: Idioma no soportado: '{lang}'. Usa: {config.SUPPORTED_LANGS}")
            sys.exit(1)

    print(f"\n{'═'*60}")
    print("  LITTLE FOUNDERS — Audio Factory")
    print(f"  Lección : {lesson_code}")
    print(f"  Idiomas : {', '.join(langs)}")
    print(f"  Modo    : {'DRY-RUN (sin cambios)' if args.dry_run else 'PRODUCCIÓN'}")
    print(f"{'═'*60}\n")

    # ── Paso 1: Enrollar voces ────────────────────────────────────────────
    print("[1/3] Preparando registro de voces...")
    voice_map = voice_registry.build_registry(langs=langs, force_reenroll=args.reenroll)

    if not voice_map and not args.dry_run:
        print("\n[main] ✗ No hay voces disponibles. Agrega archivos .mp3 en voice_samples/")
        sys.exit(1)

    # ── Paso 2: Cargar caché de audios existentes ─────────────────────────
    print("[2/3] Cargando caché de audios existentes (deduplicación)...")
    audio_cache = db_client.load_audio_cache()
    print(f"      {len(audio_cache)} segmentos en caché — textos repetidos no llamarán a Qwen TTS.\n")

    # ── Paso 3: Procesar lección ──────────────────────────────────────────
    print(f"[3/3] Procesando lección '{lesson_code}'...")
    start_time = time.time()

    try:
        stats = process_lesson(
            lesson_code=lesson_code,
            langs=langs,
            voice_map=voice_map,
            dry_run=args.dry_run,
            audio_cache=audio_cache,
        )
    except KeyboardInterrupt:
        print("\n\n[main] Interrumpido por el usuario. Los audios ya generados fueron guardados.")
        sys.exit(0)

    elapsed = time.time() - start_time
    print_report(lesson_code, langs, stats, elapsed)

    # Exit code: 0 si no hubo errores, 1 si hubo alguno
    sys.exit(0 if stats["errors"] == 0 else 1)


if __name__ == "__main__":
    main()
