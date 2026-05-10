"""
tts_client.py — Genera audio MP3 usando Qwen TTS con voice cloning.

Estructura real de respuesta de DashScope (verificada):
  response.output.audio.url   → URL temporal para descargar el WAV generado
  response.output.audio.data  → siempre vacío (no se usa)
  response.output.choices     → null (no se usa)

Flujo:
  1. Llamada a dashscope.MultiModalConversation.call()
  2. Descarga del WAV desde la URL temporal
  3. Conversión WAV → MP3 via ffmpeg
  4. Cálculo de duración con mutagen
  5. Devuelve (bytes_mp3, duration_ms)
"""

import io
import subprocess
import tempfile
import pathlib
import time
from typing import Optional

import requests as http_requests
import dashscope
from mutagen.mp3 import MP3 as MutagenMP3

import config

# Configurar endpoint internacional de DashScope
dashscope.base_http_api_url = "https://dashscope-intl.aliyuncs.com/api/v1"

# Ruta absoluta a ffmpeg (necesaria en macOS porque Python no hereda el PATH del shell)
FFMPEG_BIN = "/opt/homebrew/bin/ffmpeg"


def generate_audio(
    text: str,
    voice_id: str,
    max_retries: int = 3,
    retry_delay: float = 2.0,
) -> tuple:
    """
    Genera audio MP3 desde texto usando Qwen TTS con la voz clonada.

    Args:
        text: Texto a sintetizar.
        voice_id: ID de voz devuelto por el enrollment (voice_registry).
        max_retries: Intentos máximos ante errores de red/rate limit.
        retry_delay: Segundos de espera entre reintentos.

    Returns:
        Tupla (audio_bytes: bytes, duration_ms: int) — audio en formato MP3.

    Raises:
        RuntimeError: Si no se pudo generar audio tras todos los reintentos.
    """
    if not text or not text.strip():
        raise ValueError("[tts_client] El texto está vacío — no se puede generar audio.")

    last_error: Optional[Exception] = None

    for attempt in range(1, max_retries + 1):
        try:
            # ── 1. Llamada a Qwen TTS ──────────────────────────────────
            response = dashscope.MultiModalConversation.call(
                model=config.QWEN_TTS_MODEL,
                api_key=config.DASHSCOPE_API_KEY,
                text=text.strip(),
                voice=voice_id,
                stream=False,
            )

            # ── 2. Verificar status ────────────────────────────────────
            import http as _http_lib
            ok_statuses = {_http_lib.HTTPStatus.OK, 200, "200"}
            status = getattr(response, "status_code", None)
            if status not in ok_statuses and str(status) != "HTTPStatus.OK":
                msg = getattr(response, "message", "sin detalle")
                raise RuntimeError(f"[tts_client] DashScope devolvió status {status}: {msg}")

            # ── 3. Extraer URL del audio de la respuesta ───────────────
            audio_url = _extract_audio_url(response)

            # ── 4. Descargar el WAV desde la URL temporal ──────────────
            wav_bytes = _download_audio(audio_url)

            # ── 5. Convertir WAV → MP3 ─────────────────────────────────
            mp3_bytes = _wav_to_mp3(wav_bytes)

            # ── 6. Calcular duración ───────────────────────────────────
            duration_ms = _calculate_duration_ms(mp3_bytes)

            return mp3_bytes, duration_ms

        except (ValueError, RuntimeError):
            raise
        except Exception as e:
            last_error = e
            if attempt < max_retries:
                print(f"    [tts_client] Intento {attempt}/{max_retries} falló: {e}. "
                      f"Reintentando en {retry_delay}s...")
                time.sleep(retry_delay)
            else:
                raise RuntimeError(
                    f"[tts_client] Audio no generado tras {max_retries} intentos. "
                    f"Último error: {last_error}"
                ) from last_error

    raise RuntimeError("[tts_client] Fallo inesperado en el bucle de reintentos.")


def _extract_audio_url(response) -> str:
    """
    Extrae la URL del audio WAV desde la respuesta de DashScope.

    Estructura real:
      response.output.audio.url → URL temporal del WAV generado
    """
    try:
        output = response.output
        audio = output.audio if hasattr(output, "audio") else output.get("audio", {})

        # Puede ser un objeto con atributo .url o un dict con key "url"
        if hasattr(audio, "url"):
            url = audio.url
        elif isinstance(audio, dict):
            url = audio.get("url", "")
        else:
            url = ""

        if not url:
            raise RuntimeError(
                f"[tts_client] No se encontró URL de audio en la respuesta. "
                f"output.audio = {audio}"
            )
        return url

    except (RuntimeError, ValueError):
        raise
    except Exception as e:
        raise RuntimeError(
            f"[tts_client] Error al extraer URL del audio: {e}. "
            f"output = {getattr(response, 'output', 'N/A')}"
        ) from e


def _download_audio(url: str) -> bytes:
    """
    Descarga el audio WAV desde la URL temporal de DashScope.
    """
    try:
        resp = http_requests.get(url, timeout=30)
        resp.raise_for_status()
        return resp.content
    except Exception as e:
        raise RuntimeError(f"[tts_client] Error descargando audio desde URL: {e}") from e


def _wav_to_mp3(wav_bytes: bytes) -> bytes:
    """
    Convierte bytes WAV a bytes MP3 usando ffmpeg.
    Opera completamente en memoria via archivos temporales.
    """
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp_in:
        tmp_in_path = pathlib.Path(tmp_in.name)
        tmp_in_path.write_bytes(wav_bytes)

    tmp_out_path = tmp_in_path.with_suffix(".mp3")

    try:
        result = subprocess.run(
            [
                FFMPEG_BIN, "-y",
                "-i", str(tmp_in_path),
                "-acodec", "libmp3lame",
                "-b:a", "64k",      # 64kbps — suficiente para voz narrada, mitad de tamaño
                "-ac", "1",         # mono — voz no necesita estéreo
                "-ar", "22050",     # 22kHz — suficiente para habla humana
                str(tmp_out_path),
            ],
            capture_output=True,
            timeout=30,
        )
        if result.returncode != 0:
            raise RuntimeError(
                f"[tts_client] ffmpeg falló (code {result.returncode}): "
                f"{result.stderr.decode()[:200]}"
            )
        return tmp_out_path.read_bytes()
    finally:
        tmp_in_path.unlink(missing_ok=True)
        tmp_out_path.unlink(missing_ok=True)


def _calculate_duration_ms(audio_bytes: bytes) -> int:
    """
    Calcula la duración del MP3 en milisegundos usando mutagen.
    Devuelve 0 si no se puede calcular.
    """
    try:
        audio_file = MutagenMP3(io.BytesIO(audio_bytes))
        return int(audio_file.info.length * 1000)
    except Exception:
        return 0
