"""
db_client.py — Registra los segmentos de audio en la tabla lesson_audio_segments
via Supabase client (no requiere DATABASE_URL directo).

Estrategia de upsert:
  1. Busca registro existente por (lesson_id, exercise_id, target_field, language_code).
  2. Si existe → actualiza (audio_url, transcript, duration_ms, character_id, is_active).
  3. Si no existe → inserta nuevo registro.
"""

import hashlib
from supabase import create_client, Client
from typing import Optional, Tuple

import config

_supabase: Client = create_client(config.SUPABASE_URL, config.SUPABASE_SERVICE_KEY)

TABLE = "lesson_audio_segments"


# ── Deduplicación por hash de texto ───────────────────────────────────────

def compute_text_hash(text: str, character_code: str, lang: str) -> str:
    """
    Calcula un hash SHA-256 único para una combinación de texto + voz + idioma.
    Normaliza el texto (strip + lowercase) para maximizar los hits de caché.
    Incluye character_code porque distintos personajes tienen distintas voces.
    """
    key = f"{text.strip().lower()}|{character_code}|{lang}"
    return hashlib.sha256(key.encode("utf-8")).hexdigest()


def load_audio_cache() -> dict:
    """
    Carga todos los segmentos de audio existentes en la DB y los indexa
    por hash de texto. Devuelve un dict {hash: (audio_url, duration_ms)}.

    Se llama UNA VEZ al arrancar el factory. Permite detectar textos ya
    generados sin llamar a Qwen TTS de nuevo, ahorrando costo de API.

    Si la DB falla o está vacía, devuelve {} sin interrumpir el proceso.
    """
    try:
        # Cargar mapa character_id → character_code
        chars_resp = _supabase.table("characters").select("id, code").execute()
        char_map: dict = {
            row["id"]: row["code"]
            for row in (chars_resp.data or [])
        }

        # Cargar todos los segmentos con transcript y audio_url definidos
        segs_resp = (
            _supabase.table(TABLE)
            .select("transcript, character_id, language_code, audio_url, duration_ms")
            .not_.is_("transcript", "null")
            .not_.is_("audio_url", "null")
            .execute()
        )

        cache: dict = {}
        for row in (segs_resp.data or []):
            transcript = (row.get("transcript") or "").strip()
            audio_url  = row.get("audio_url") or ""
            char_code  = char_map.get(row.get("character_id"), "")
            lang       = row.get("language_code") or ""
            duration   = row.get("duration_ms") or 0

            if transcript and audio_url and lang:
                h = compute_text_hash(transcript, char_code, lang)
                if h not in cache:          # conservar la primera ocurrencia
                    cache[h] = (audio_url, duration)

        return cache

    except Exception as e:
        print(f"    [db_client] ⚠ No se pudo cargar el audio cache: {e}")
        return {}


def get_lesson_integer_id(public_uuid: str) -> Optional[int]:
    """
    Resuelve el public_id UUID de una lección a su integer primary key.
    El API devuelve public_id como 'id', pero lesson_audio_segments.lesson_id
    es FK al integer id de la tabla lessons.
    """
    try:
        resp = (
            _supabase.table("lessons")
            .select("id")
            .eq("public_id", public_uuid)
            .single()
            .execute()
        )
        return resp.data["id"] if resp.data else None
    except Exception as e:
        print(f"    [db_client] ⚠ No se pudo resolver lesson UUID '{public_uuid}': {e}")
        return None


def get_character_id(character_code: str) -> Optional[int]:
    """
    Obtiene el ID numérico del personaje desde la tabla 'characters'.
    Devuelve None si no se encuentra.
    """
    try:
        resp = (
            _supabase.table("characters")
            .select("id")
            .eq("code", character_code)
            .single()
            .execute()
        )
        return resp.data["id"] if resp.data else None
    except Exception as e:
        print(f"    [db_client] ⚠ No se encontró character_id para '{character_code}': {e}")
        return None


def upsert_audio_segment(
    lesson_id: int,
    exercise_db_id: int,
    target_field: str,
    language_code: str,
    audio_url: str,
    transcript: str,
    duration_ms: int,
    character_code: str,
    emotion: str = "neutral",
    order_index: int = 0,
) -> None:
    """
    Inserta o actualiza un registro en lesson_audio_segments.

    La unicidad lógica está dada por:
      (lesson_id, exercise_id, target_field, language_code)

    Args:
        lesson_id: ID numérico de la lección en DB.
        exercise_db_id: ID numérico del ejercicio en DB (exercise.id del API).
        target_field: Campo de audio ('main', 'question', etc.).
        language_code: 'es' o 'en'.
        audio_url: URL pública del MP3 en Supabase Storage.
        transcript: Texto que fue narrado.
        duration_ms: Duración del audio en milisegundos.
        character_code: Code del personaje (ej: 'liruf').
        emotion: Emoción del audio (por defecto 'neutral').
        order_index: Orden dentro del ejercicio (normalmente 0).
    """
    character_id = get_character_id(character_code)

    record = {
        "lesson_id": lesson_id,
        "exercise_id": exercise_db_id,
        "target_field": target_field,
        "language_code": language_code,
        "audio_url": audio_url,
        "transcript": transcript,
        "duration_ms": duration_ms if duration_ms else None,
        "character_id": character_id,
        "emotion": emotion,
        "order_index": order_index,
        "source": "generated",
        "is_active": True,
        "tags": ["audio_factory"],
    }

    # ── Buscar si ya existe ────────────────────────────────────────────────
    try:
        existing = (
            _supabase.table(TABLE)
            .select("id")
            .eq("lesson_id", lesson_id)
            .eq("exercise_id", exercise_db_id)
            .eq("target_field", target_field)
            .eq("language_code", language_code)
            .execute()
        )
    except Exception as e:
        raise RuntimeError(f"[db_client] Error consultando registro existente: {e}") from e

    try:
        if existing.data:
            # ── UPDATE ────────────────────────────────────────────────────
            record_id = existing.data[0]["id"]
            _supabase.table(TABLE).update(record).eq("id", record_id).execute()
        else:
            # ── INSERT ────────────────────────────────────────────────────
            _supabase.table(TABLE).insert(record).execute()
    except Exception as e:
        raise RuntimeError(
            f"[db_client] Error guardando audio segment "
            f"(lesson={lesson_id}, exercise={exercise_db_id}, "
            f"field={target_field}, lang={language_code}): {e}"
        ) from e
