"""
config.py — Carga y valida todas las variables de entorno del audio_factory.
Importar este módulo antes que cualquier otro en el factory.
"""

import os
import sys
from pathlib import Path
from dotenv import load_dotenv

# Cargar .env desde la misma carpeta que este archivo
_ENV_PATH = Path(__file__).parent / ".env"
load_dotenv(dotenv_path=_ENV_PATH)


def _require(key: str) -> str:
    """Lee una variable de entorno; aborta si no existe."""
    val = os.getenv(key)
    if not val:
        print(f"[config] ERROR: Variable de entorno '{key}' no encontrada en .env")
        print(f"         Copia .env.example → .env y rellena el valor.")
        sys.exit(1)
    return val


# ── Alibaba Cloud / DashScope ──────────────────────────────────────────────
DASHSCOPE_API_KEY: str = _require("DASHSCOPE_API_KEY")

# ── DeepSeek ───────────────────────────────────────────────────────────────
DEEPSEEK_API_KEY: str = _require("DEEPSEEK_API_KEY")
DEEPSEEK_BASE_URL: str = os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com")
DEEPSEEK_MODEL: str = "deepseek-chat"          # deepseek-chat = DeepSeek-V3

# ── Backend REST ───────────────────────────────────────────────────────────
BACKEND_URL: str = os.getenv("BACKEND_URL", "http://localhost:8000").rstrip("/")

# ── Supabase (base de datos de lecciones y personajes) ────────────────────
SUPABASE_URL: str = _require("SUPABASE_URL")
SUPABASE_SERVICE_KEY: str = _require("SUPABASE_SERVICE_KEY")

# ── Cloudflare R2 (almacenamiento de audio de lecciones) ──────────────────
R2_ACCOUNT_ID: str = _require("R2_ACCOUNT_ID")
R2_ACCESS_KEY_ID: str = _require("R2_ACCESS_KEY_ID")
R2_SECRET_ACCESS_KEY: str = _require("R2_SECRET_ACCESS_KEY")
R2_BUCKET: str = os.getenv("R2_BUCKET", "lesson-audio")
R2_ENDPOINT_URL: str = f"https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com"
# URL pública del bucket (habilitar Public Access en Cloudflare Dashboard antes de usar)
R2_PUBLIC_URL_BASE: str = _require("R2_PUBLIC_URL_BASE")

# ── Qwen TTS ───────────────────────────────────────────────────────────────
QWEN_TTS_MODEL: str = "qwen3-tts-vc-2026-01-22"
QWEN_ENROLLMENT_MODEL: str = "qwen-voice-enrollment"
QWEN_ENROLLMENT_URL: str = "https://dashscope-intl.aliyuncs.com/api/v1/services/audio/tts/customization"

# ── Paths locales ──────────────────────────────────────────────────────────
FACTORY_DIR: Path = Path(__file__).parent
VOICE_SAMPLES_DIR: Path = FACTORY_DIR / "voice_samples"
CACHE_DIR: Path = FACTORY_DIR / "cache"
VOICE_IDS_CACHE: Path = CACHE_DIR / "voice_ids.json"

# Asegurar que existen los directorios de caché
CACHE_DIR.mkdir(exist_ok=True)

# ── Idiomas soportados ─────────────────────────────────────────────────────
SUPPORTED_LANGS: list[str] = ["es", "en"]

# ── Campos de audio válidos ────────────────────────────────────────────────
VALID_TARGET_FIELDS: set[str] = {
    "main", "statement", "question",
    "instruction", "feedback_success", "feedback_error",
}

# Emoción por defecto para el audio generado
DEFAULT_EMOTION: str = "neutral"
