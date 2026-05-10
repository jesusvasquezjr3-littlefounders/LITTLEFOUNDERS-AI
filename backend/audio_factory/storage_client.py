"""
storage_client.py — Sube archivos de audio al bucket de Cloudflare R2.

Ruta de destino en R2:
  {lesson_code}/{order_index}/{lang}/{target_field}.mp3

Devuelve la URL pública del archivo subido.

Notas:
  - R2 usa protocolo S3 compatible (boto3 con endpoint personalizado).
  - El bucket debe tener Public Access habilitado en Cloudflare Dashboard.
  - La URL pública base se configura en R2_PUBLIC_URL_BASE (ej: https://pub-XXX.r2.dev).
  - Si ya existe un archivo en la misma ruta, se sobreescribe (put_object es idempotente).
"""

import boto3
from botocore.config import Config

import config

# ── Cliente R2 (singleton, protocol S3-compatible) ────────────────────────
_r2 = boto3.client(
    "s3",
    endpoint_url=config.R2_ENDPOINT_URL,
    aws_access_key_id=config.R2_ACCESS_KEY_ID,
    aws_secret_access_key=config.R2_SECRET_ACCESS_KEY,
    region_name="auto",                         # R2 no usa regiones AWS; 'auto' es el valor correcto
    config=Config(
        signature_version="s3v4",              # R2 requiere Signature Version 4
        retries={"max_attempts": 3, "mode": "standard"},
    ),
)


def upload_audio(
    audio_bytes: bytes,
    lesson_code: str,
    order_index: int,
    lang: str,
    target_field: str,
) -> str:
    """
    Sube los bytes de audio MP3 a Cloudflare R2 y devuelve la URL pública.

    Ruta del objeto en R2:
      {lesson_code}/{order_index}/{lang}/{target_field}.mp3

    Si ya existe un objeto en esa ruta, lo sobreescribe (put_object es idempotente).

    Args:
        audio_bytes: Bytes del archivo MP3.
        lesson_code: Código de la lección (ej: "1-1-0-1").
        order_index: Índice 0-based del ejercicio dentro de la lección.
        lang: Código de idioma ('es' o 'en').
        target_field: Campo de audio ('main', 'question', 'instruction', etc.).

    Returns:
        URL pública del archivo en Cloudflare R2.

    Raises:
        RuntimeError: Si la subida falla.
    """
    # Clave del objeto dentro del bucket (sin barra inicial)
    object_key = f"{lesson_code}/{order_index}/{lang}/{target_field}.mp3"

    try:
        _r2.put_object(
            Bucket=config.R2_BUCKET,
            Key=object_key,
            Body=audio_bytes,
            ContentType="audio/mpeg",
        )
    except Exception as e:
        raise RuntimeError(
            f"[storage_client] Error subiendo a R2 '{object_key}': {e}"
        ) from e

    # Construir URL pública usando la base configurada en R2_PUBLIC_URL_BASE
    # Formato: https://pub-XXXX.r2.dev/{object_key}
    public_url = f"{config.R2_PUBLIC_URL_BASE.rstrip('/')}/{object_key}"
    return public_url
