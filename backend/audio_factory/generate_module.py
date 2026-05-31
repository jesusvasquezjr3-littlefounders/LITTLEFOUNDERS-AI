"""
generate_module.py — Genera audios para todas las lecciones de un módulo (adventure).

Ventajas sobre ejecutar main.py en loop:
  - Carga el registro de voces UNA sola vez (no re-enrolla para cada lección).
  - Carga el caché de deduplicación UNA sola vez al inicio y lo mantiene en
    memoria durante toda la sesión. A medida que avanza, el caché crece y los
    textos repetidos se reusan sin llamar a Qwen TTS.
  - Muestra progreso global, ETA y resumen de ahorro al final.

Módulos disponibles:
  1 → adventure_1 (467 lecciones)
  2 → adventure_2 (410 lecciones)
  3 → adventure_3 (340 lecciones)
  4 → adventure_4 (340 lecciones)
  5 → adventure_5 (396 lecciones)
  6 → adventure_6 (508 lecciones)

Uso:
  python3 generate_module.py --module 1
  python3 generate_module.py --module 1 --lang es
  python3 generate_module.py --module 1 --lang es,en --dry-run
  python3 generate_module.py --module 1 --start-from 1-1-3-1   (reanudar desde una lección)
"""

import argparse
import json
import sys
import time
from pathlib import Path

import db_client
import voice_registry

# ── Imports del factory (mismo proceso — comparte voz y caché) ────────────
import config  # noqa: F401 — carga .env y valida vars
import main as factory

MANIFEST_PATH = (
    Path(__file__).parent.parent
    / "lesson_engine"
    / "littlefounders_lessons"
    / "manifest.json"
)


def load_module_lessons(module_num: int) -> list:
    """Devuelve la lista de lesson_codes para el módulo indicado, en orden."""
    with open(MANIFEST_PATH, encoding="utf-8") as f:
        manifest = json.load(f)

    prefix = f"adventure_{module_num}/"
    return [
        item["lesson_code"]
        for item in manifest["lessons_index"]
        if item["file_path"].startswith(prefix)
    ]


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Genera audios para un módulo completo de Little Founders.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Ejemplos:
  python3 generate_module.py --module 1
  python3 generate_module.py --module 1 --lang es
  python3 generate_module.py --module 1 --lang es,en --dry-run
  python3 generate_module.py --module 2 --start-from 1-2-5-3
        """,
    )
    parser.add_argument("--module", required=True, type=int,
                        choices=[1, 2, 3, 4, 5, 6],
                        help="Número de módulo a procesar (1–6).")
    parser.add_argument("--lang", default="es,en",
                        help="Idiomas a generar, separados por coma (default: es,en).")
    parser.add_argument("--reenroll", action="store_true",
                        help="Fuerza re-enrollment de voces, ignorando el caché.")
    parser.add_argument("--dry-run", action="store_true", dest="dry_run",
                        help="Simula sin generar audio ni escribir en DB/R2.")
    parser.add_argument("--start-from", default=None, dest="start_from",
                        metavar="LESSON_CODE",
                        help="Reanuda desde este lesson_code (útil si fue interrumpido).")
    args = parser.parse_args()

    langs: list = [l.strip().lower() for l in args.lang.split(",") if l.strip()]
    for lang in langs:
        if lang not in config.SUPPORTED_LANGS:
            print(f"[generate_module] ERROR: Idioma no soportado '{lang}'. "
                  f"Usa: {config.SUPPORTED_LANGS}")
            sys.exit(1)

    # ── Cargar lista de lecciones del módulo ──────────────────────────────
    lesson_codes = load_module_lessons(args.module)
    total_lessons = len(lesson_codes)

    if not lesson_codes:
        print(f"[generate_module] ERROR: No se encontraron lecciones para el módulo {args.module}.")
        sys.exit(1)

    # ── Aplicar --start-from ──────────────────────────────────────────────
    start_idx = 0
    if args.start_from:
        try:
            start_idx = lesson_codes.index(args.start_from)
            print(f"  Reanudando desde lección #{start_idx + 1}: {args.start_from}")
        except ValueError:
            print(f"[generate_module] ERROR: Lección '{args.start_from}' no está en el módulo {args.module}.")
            sys.exit(1)

    lesson_codes = lesson_codes[start_idx:]
    pending = len(lesson_codes)

    print(f"\n{'═'*60}")
    print(f"  LITTLE FOUNDERS — Módulo {args.module}")
    print(f"  Lecciones totales : {total_lessons}")
    print(f"  Pendientes        : {pending}")
    print(f"  Idiomas           : {', '.join(langs)}")
    print(f"  Modo              : {'DRY-RUN (sin cambios)' if args.dry_run else 'PRODUCCIÓN'}")
    print(f"{'═'*60}\n")

    # ── Paso 1: Registro de voces (UNA sola vez para todo el módulo) ──────
    print("[1/3] Preparando registro de voces...")
    voice_map = voice_registry.build_registry(langs=langs, force_reenroll=args.reenroll)

    if not voice_map and not args.dry_run:
        print("\n[generate_module] ✗ No hay voces disponibles.")
        sys.exit(1)

    # ── Paso 2: Caché de deduplicación (UNA sola vez, crece durante la sesión) ──
    print("[2/3] Cargando caché de audios existentes (deduplicación)...")
    audio_cache: dict = db_client.load_audio_cache()
    print(f"      {len(audio_cache)} segmentos en caché al inicio.\n")

    # ── Paso 3: Procesar cada lección ─────────────────────────────────────
    print(f"[3/3] Procesando {pending} lecciones...\n")

    total_stats: dict = {
        "total": 0, "generated": 0, "cache_hits": 0,
        "skipped": 0, "errors": 0, "error_details": [],
    }
    lesson_errors: list = []
    session_start = time.time()

    for i, lesson_code in enumerate(lesson_codes, 1):
        # ── ETA dinámica ──────────────────────────────────────────────────
        elapsed = time.time() - session_start
        if i > 1:
            avg_per_lesson = elapsed / (i - 1)
            remaining_secs = avg_per_lesson * (pending - i + 1)
            if remaining_secs > 3600:
                eta_str = f"{remaining_secs / 3600:.1f}h"
            elif remaining_secs > 60:
                eta_str = f"{remaining_secs / 60:.0f}min"
            else:
                eta_str = f"{remaining_secs:.0f}s"
        else:
            eta_str = "calculando..."

        print(f"\n{'─'*60}")
        print(f"  [{i}/{pending}] {lesson_code}  |  ETA: {eta_str}  |  "
              f"Cache: {len(audio_cache)} segs")
        print(f"{'─'*60}")

        lesson_start = time.time()
        try:
            stats = factory.process_lesson(
                lesson_code=lesson_code,
                langs=langs,
                voice_map=voice_map,
                dry_run=args.dry_run,
                audio_cache=audio_cache,   # caché compartido y mutable
            )
        except Exception as e:
            print(f"  ✗ Error fatal en lección {lesson_code}: {e}")
            lesson_errors.append(lesson_code)
            stats = {"total": 0, "generated": 0, "cache_hits": 0,
                     "skipped": 0, "errors": 1, "error_details": [str(e)]}

        lesson_elapsed = time.time() - lesson_start

        # Acumular estadísticas globales
        for key in ("total", "generated", "cache_hits", "skipped", "errors"):
            total_stats[key] += stats.get(key, 0)
        total_stats["error_details"].extend(stats.get("error_details", []))

        hits = stats.get("cache_hits", 0)
        gen  = stats.get("generated", 0)
        new  = gen - hits
        print(f"  ✓ Lección {lesson_code}: {gen} audios "
              f"({new} TTS, {hits} cache) en {lesson_elapsed:.0f}s")

    # ── Reporte final del módulo ───────────────────────────────────────────
    total_elapsed = time.time() - session_start
    hits   = total_stats.get("cache_hits", 0)
    gen    = total_stats.get("generated", 0)
    new    = gen - hits
    pct    = hits * 100 // gen if gen else 0

    print(f"\n{'═'*60}")
    print(f"  MÓDULO {args.module} — REPORTE FINAL")
    print(f"{'═'*60}")
    print(f"  Lecciones procesadas : {pending}")
    print(f"  Audios procesados    : {total_stats['total']}")
    print(f"  ✓ Generados totales  : {gen}")
    print(f"  ♻ Cache hits ($0)    : {hits}  ({pct}% ahorro en TTS)")
    print(f"  🔊 TTS calls reales  : {new}")
    print(f"  ⚠ Saltados           : {total_stats['skipped']}")
    print(f"  ✗ Errores            : {total_stats['errors']}")
    if total_elapsed > 3600:
        time_str = f"{total_elapsed / 3600:.1f}h"
    elif total_elapsed > 60:
        time_str = f"{total_elapsed / 60:.0f}min"
    else:
        time_str = f"{total_elapsed:.0f}s"
    print(f"  Tiempo total         : {time_str}")

    if lesson_errors:
        print(f"\n  Lecciones con error fatal ({len(lesson_errors)}):")
        for code in lesson_errors:
            print(f"    - {code}")
        print(f"\n  Para reintentar: python3 generate_module.py --module {args.module} "
              f"--start-from {lesson_errors[0]}")

    print(f"{'═'*60}\n")

    sys.exit(0 if total_stats["errors"] == 0 else 1)


if __name__ == "__main__":
    main()
