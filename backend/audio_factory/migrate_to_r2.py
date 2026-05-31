"""
migrate_to_r2.py — Migra audios de Supabase Storage → Cloudflare R2.

Proceso por cada registro en lesson_audio_segments con URL de Supabase:
  1. Descarga el MP3 desde la URL pública de Supabase.
  2. Extrae la clave R2 a partir del path del URL.
  3. Sube el MP3 a R2.
  4. Actualiza el audio_url en la DB con la nueva URL de R2.
  5. (Después de migrar todo) Elimina los archivos del bucket de Supabase.

Uso:
  python3 migrate_to_r2.py               # Migra y limpia
  python3 migrate_to_r2.py --dry-run     # Solo muestra qué haría
  python3 migrate_to_r2.py --skip-clean  # Migra pero no elimina de Supabase
"""
from __future__ import annotations

import argparse
import sys
import time

import boto3
import requests as http
from botocore.config import Config
from supabase import create_client

import config

# ── Clientes ──────────────────────────────────────────────────────────────
_supabase = create_client(config.SUPABASE_URL, config.SUPABASE_SERVICE_KEY)

_r2 = boto3.client(
    "s3",
    endpoint_url=config.R2_ENDPOINT_URL,
    aws_access_key_id=config.R2_ACCESS_KEY_ID,
    aws_secret_access_key=config.R2_SECRET_ACCESS_KEY,
    region_name="auto",
    config=Config(
        signature_version="s3v4",
        retries={"max_attempts": 3, "mode": "standard"},
    ),
)

# Prefijo que identifica URLs de Supabase Storage en la DB
SUPABASE_STORAGE_PREFIX = f"{config.SUPABASE_URL}/storage/v1/object/public/"
# Prefijo del bucket dentro de Supabase (ej: "lesson-assets/lesson-audio/")
SUPABASE_BUCKET_PATH_PREFIX = "lesson-assets/lesson-audio/"


def supabase_url_to_r2_key(supabase_url: str) -> str | None:
    """
    Extrae la clave R2 a partir de un URL de Supabase Storage.

    Supabase: https://.../storage/v1/object/public/lesson-assets/lesson-audio/1-1-1-1/0/es/main.mp3
    R2 key  : 1-1-1-1/0/es/main.mp3
    """
    if SUPABASE_STORAGE_PREFIX not in supabase_url:
        return None

    path_after_public = supabase_url.split(SUPABASE_STORAGE_PREFIX, 1)[1]

    if not path_after_public.startswith(SUPABASE_BUCKET_PATH_PREFIX):
        return None

    return path_after_public[len(SUPABASE_BUCKET_PATH_PREFIX):]


def fetch_supabase_records() -> list[dict]:
    """Obtiene todos los registros de lesson_audio_segments con URL de Supabase."""
    try:
        resp = (
            _supabase.table("lesson_audio_segments")
            .select("id, audio_url, lesson_id, exercise_id, target_field, language_code")
            .like("audio_url", f"%{config.SUPABASE_URL}%")
            .execute()
        )
        return resp.data or []
    except Exception as e:
        print(f"[migrate] ✗ Error consultando DB: {e}")
        sys.exit(1)


def download_audio(url: str) -> bytes | None:
    """Descarga el MP3 desde el URL público de Supabase. Devuelve None si falla."""
    try:
        resp = http.get(url, timeout=30)
        resp.raise_for_status()
        return resp.content
    except Exception as e:
        print(f"  ✗ Error descargando {url}: {e}")
        return None


def upload_to_r2(audio_bytes: bytes, r2_key: str) -> str:
    """Sube bytes a R2 y devuelve la URL pública."""
    _r2.put_object(
        Bucket=config.R2_BUCKET,
        Key=r2_key,
        Body=audio_bytes,
        ContentType="audio/mpeg",
    )
    return f"{config.R2_PUBLIC_URL_BASE.rstrip('/')}/{r2_key}"


def update_db_url(record_id: int, new_url: str) -> None:
    """Actualiza audio_url en la DB."""
    _supabase.table("lesson_audio_segments").update(
        {"audio_url": new_url}
    ).eq("id", record_id).execute()


def delete_from_supabase(storage_path: str) -> bool:
    """
    Elimina un archivo del bucket de Supabase Storage.
    storage_path es relativo al bucket (ej: 'lesson-audio/1-1-1-1/0/es/main.mp3').
    """
    try:
        _supabase.storage.from_("lesson-assets").remove([storage_path])
        return True
    except Exception as e:
        print(f"  ⚠ No se pudo eliminar '{storage_path}' de Supabase: {e}")
        return False


def migrate(dry_run: bool = False, skip_clean: bool = False) -> None:
    print(f"\n{'═'*60}")
    print("  Migración Supabase Storage → Cloudflare R2")
    print(f"  Modo: {'DRY-RUN' if dry_run else 'PRODUCCIÓN'}")
    print(f"  Limpieza Supabase: {'NO' if skip_clean or dry_run else 'SÍ'}")
    print(f"{'═'*60}\n")

    records = fetch_supabase_records()
    total = len(records)

    if total == 0:
        print("  ✅ No hay registros con URL de Supabase. Nada que migrar.")
        return

    print(f"  Registros a migrar: {total}\n")

    migrated = 0
    skipped = 0
    errors = 0
    supabase_paths_to_delete: list[str] = []

    for i, rec in enumerate(records, 1):
        rec_id = rec["id"]
        supabase_url = rec["audio_url"]
        label = f"[{i}/{total}] ID:{rec_id} | {rec['language_code']} | {rec['target_field']}"

        # Extraer clave R2
        r2_key = supabase_url_to_r2_key(supabase_url)
        if not r2_key:
            print(f"  ⚠ {label} — URL no reconocida, saltando: {supabase_url}")
            skipped += 1
            continue

        r2_url = f"{config.R2_PUBLIC_URL_BASE.rstrip('/')}/{r2_key}"
        supabase_storage_path = f"lesson-audio/{r2_key}"

        print(f"  {label}")
        print(f"    → R2: {r2_key}")

        if dry_run:
            print("    [DRY-RUN] Omitiría descarga, subida y actualización de DB")
            migrated += 1
            continue

        # 1. Descargar de Supabase
        audio_bytes = download_audio(supabase_url)
        if audio_bytes is None:
            errors += 1
            continue

        # 2. Subir a R2
        try:
            upload_to_r2(audio_bytes, r2_key)
        except Exception as e:
            print(f"    ✗ Error subiendo a R2: {e}")
            errors += 1
            continue

        # 3. Actualizar DB
        try:
            update_db_url(rec_id, r2_url)
        except Exception as e:
            print(f"    ✗ Error actualizando DB: {e}")
            errors += 1
            continue

        print(f"    ✓ Migrado ({len(audio_bytes) // 1024} KB)")
        supabase_paths_to_delete.append(supabase_storage_path)
        migrated += 1

        # Pausa breve para no saturar APIs
        time.sleep(0.2)

    # ── Limpieza de Supabase ──────────────────────────────────────────────
    if not skip_clean and not dry_run and supabase_paths_to_delete:
        print(f"\n{'─'*60}")
        print(f"  Eliminando {len(supabase_paths_to_delete)} archivos de Supabase Storage...")

        deleted = 0
        for path in supabase_paths_to_delete:
            if delete_from_supabase(path):
                deleted += 1
            time.sleep(0.1)

        print(f"  🧹 Eliminados: {deleted}/{len(supabase_paths_to_delete)}")

    # ── Reporte ───────────────────────────────────────────────────────────
    print(f"\n{'═'*60}")
    print("  REPORTE FINAL")
    print(f"{'═'*60}")
    print(f"  Total procesados : {total}")
    print(f"  ✓ Migrados       : {migrated}")
    print(f"  ⚠ Saltados       : {skipped}")
    print(f"  ✗ Errores        : {errors}")
    print(f"{'═'*60}\n")

    if errors > 0:
        print("  ⚠ Algunos registros no se migraron. Vuelve a ejecutar para reintentar.")
        sys.exit(1)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Migra audios de Supabase Storage a Cloudflare R2."
    )
    parser.add_argument(
        "--dry-run", action="store_true",
        help="Simula la migración sin mover archivos ni actualizar la DB."
    )
    parser.add_argument(
        "--skip-clean", action="store_true",
        help="Migra a R2 pero no elimina los archivos de Supabase."
    )
    args = parser.parse_args()

    migrate(dry_run=args.dry_run, skip_clean=args.skip_clean)


if __name__ == "__main__":
    main()
