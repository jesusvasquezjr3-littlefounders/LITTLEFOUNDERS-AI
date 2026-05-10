"""
voice_registry.py — Gestiona el enrollment de voces en Qwen TTS.

Cada personaje tiene DOS muestras de voz: una en español y otra en inglés,
porque las voces clonadas pueden diferir sutilmente entre idiomas.

Estructura de archivos esperada:
    voice_samples/liruf_es.mp3
    voice_samples/liruf_en.mp3
    voice_samples/dina_es.mp3
    voice_samples/dina_en.mp3
    voice_samples/dr_rho_es.mp3
    voice_samples/dr_rho_en.mp3
    voice_samples/zara_vex_es.mp3
    voice_samples/zara_vex_en.mp3

Resultado: dict con keys "{character_code}_{lang}" → voice_id_string
  Ejemplo: {"liruf_es": "guanyu-xxx", "liruf_en": "guanyu-yyy", ...}
"""

import json
import base64
import pathlib
import subprocess
import tempfile
import requests
from typing import Optional

import config


# Personajes reconocidos por el sistema (codes del DB)
KNOWN_CHARACTERS: list = ["liruf", "dina", "dr_rho", "zara_vex"]

# Qwen enrollment acepta máximo ~30 segundos de audio
# Usamos 28s para quedarnos bien dentro del límite
ENROLLMENT_MAX_SECONDS: int = 28


def _trim_audio(file_path: pathlib.Path, max_seconds: int = ENROLLMENT_MAX_SECONDS) -> bytes:
    """
    Recorta el audio a max_seconds usando ffmpeg.
    Devuelve los bytes del MP3 recortado en memoria (sin escribir en disco).

    Args:
        file_path: Ruta al archivo de muestra original.
        max_seconds: Duración máxima en segundos.

    Returns:
        Bytes del MP3 recortado.
    """
    with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as tmp:
        tmp_path = pathlib.Path(tmp.name)

    try:
        # Usar ruta absoluta porque Python no hereda el PATH del shell en macOS
        ffmpeg_bin = "/opt/homebrew/bin/ffmpeg"
        result = subprocess.run(
            [
                ffmpeg_bin, "-y",
                "-i", str(file_path),
                "-t", str(max_seconds),          # Recortar a max_seconds
                "-acodec", "libmp3lame",
                "-ab", "128k",
                "-ar", "22050",                  # Sample rate óptimo para TTS
                "-ac", "1",                      # Mono
                str(tmp_path),
            ],
            capture_output=True,
            timeout=30,
        )
        if result.returncode != 0:
            raise RuntimeError(
                f"ffmpeg falló (code {result.returncode}): {result.stderr.decode()[:200]}"
            )
        trimmed_bytes = tmp_path.read_bytes()
        return trimmed_bytes
    finally:
        tmp_path.unlink(missing_ok=True)


def _load_cache() -> dict:
    """Lee el cache de voice IDs desde disco."""
    if config.VOICE_IDS_CACHE.exists():
        try:
            return json.loads(config.VOICE_IDS_CACHE.read_text())
        except (json.JSONDecodeError, OSError):
            return {}
    return {}


def _save_cache(cache: dict) -> None:
    """Persiste el cache de voice IDs en disco."""
    config.VOICE_IDS_CACHE.write_text(json.dumps(cache, indent=2))


def _enroll_voice(character_code: str, lang: str, file_path: pathlib.Path) -> str:
    """
    Enrolla un archivo de voz en Qwen y devuelve el voice_id asignado.

    Args:
        character_code: Code del personaje (ej: 'liruf').
        lang: Idioma de la muestra ('es' o 'en').
        file_path: Ruta al archivo de muestra .mp3.

    Returns:
        voice_id string devuelto por la API.

    Raises:
        RuntimeError: Si el enrollment falla.
    """
    key = f"{character_code}_{lang}"
    print(f"  [voice_registry] Enrollando: {key} ({file_path.name}) ...")

    # Recortar a ENROLLMENT_MAX_SECONDS para cumplir el límite de Qwen
    print(f"  [voice_registry] Recortando audio a {ENROLLMENT_MAX_SECONDS}s para enrollment...")
    audio_bytes = _trim_audio(file_path)
    base64_str = base64.b64encode(audio_bytes).decode()
    data_uri = f"data:audio/mpeg;base64,{base64_str}"

    # preferred_name incluye lang para que Qwen distinga entre las dos voces del mismo personaje
    preferred_name = f"{character_code}_{lang}"

    payload = {
        "model": config.QWEN_ENROLLMENT_MODEL,
        "input": {
            "action": "create",
            "target_model": config.QWEN_TTS_MODEL,
            "preferred_name": preferred_name,
            "audio": {"data": data_uri},
        },
    }
    headers = {
        "Authorization": f"Bearer {config.DASHSCOPE_API_KEY}",
        "Content-Type": "application/json",
    }

    resp = requests.post(config.QWEN_ENROLLMENT_URL, json=payload, headers=headers, timeout=60)
    if resp.status_code != 200:
        raise RuntimeError(
            f"[voice_registry] Enrollment de '{key}' falló: "
            f"HTTP {resp.status_code} — {resp.text}"
        )

    data = resp.json()
    voice_id: Optional[str] = data.get("output", {}).get("voice")
    if not voice_id:
        raise RuntimeError(
            f"[voice_registry] Respuesta inesperada para '{key}': {data}"
        )

    print(f"  [voice_registry] ✓ {key} → voice_id: {voice_id}")
    return voice_id


def build_registry(langs: list, force_reenroll: bool = False) -> dict:
    """
    Construye y devuelve el mapa {"{character_code}_{lang}": voice_id}.

    Para cada combinación de (personaje × idioma), busca el archivo:
        voice_samples/{character_code}_{lang}.mp3

    Args:
        langs: Lista de idiomas a procesar (ej: ['es', 'en']).
        force_reenroll: Si True, ignora el cache y re-enrolla todas las voces.

    Returns:
        Dict con keys "{char}_{lang}" → voice_id_string.
        Las combinaciones sin archivo de muestra son omitidas silenciosamente.
    """
    cache = {} if force_reenroll else _load_cache()
    registry: dict = {}
    updated = False

    for char_code in KNOWN_CHARACTERS:
        for lang in langs:
            key = f"{char_code}_{lang}"
            sample_path = config.VOICE_SAMPLES_DIR / f"{key}.mp3"

            if not sample_path.exists():
                print(f"  [voice_registry] ⚠  Sin muestra para '{key}' — se omitirá.")
                continue

            if key in cache and not force_reenroll:
                print(f"  [voice_registry] ✓ {key} → voice_id (cached): {cache[key]}")
                registry[key] = cache[key]
            else:
                try:
                    voice_id = _enroll_voice(char_code, lang, sample_path)
                    registry[key] = voice_id
                    cache[key] = voice_id
                    updated = True
                except RuntimeError as e:
                    print(f"  [voice_registry] ✗ ERROR en enrollment de '{key}': {e}")
                    # Continúa con las demás combinaciones

    if updated:
        _save_cache(cache)
        print(f"  [voice_registry] Cache actualizado → {config.VOICE_IDS_CACHE}")

    if not registry:
        print("[voice_registry] ADVERTENCIA: No se enrolló ningún personaje/idioma.")
        print(f"                 Coloca archivos .mp3 en: {config.VOICE_SAMPLES_DIR}")
        print(f"                 Formato esperado: {{personaje}}_{{lang}}.mp3")
        print(f"                 Ejemplo: liruf_es.mp3, liruf_en.mp3")

    return registry
