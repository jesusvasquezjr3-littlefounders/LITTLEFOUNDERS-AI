"""
test_voice.py — Prueba rápida de enrollment + TTS para un personaje.

Ejecutar:
    python3 test_voice.py

Qué hace:
  1. Enrolla liruf_es.mp3 en Qwen TTS
  2. Genera un audio de prueba con esa voz
  3. Guarda el resultado en test_output.mp3
  4. Muestra la duración detectada
"""

import sys
import pathlib

# Cargar config (lee .env de esta carpeta)
import config

print("=" * 55)
print("  Little Founders — Test de voz (liruf ES)")
print("=" * 55)

# ── 1. Verificar que el archivo de muestra existe ──────────────
sample = config.VOICE_SAMPLES_DIR / "liruf_es.mp3"
if not sample.exists():
    print(f"✗ No se encontró: {sample}")
    sys.exit(1)

size_kb = sample.stat().st_size / 1024
print(f"\n[1] Muestra de voz: {sample.name} ({size_kb:.0f} KB)")

# ── 2. Enrollment ──────────────────────────────────────────────
print("\n[2] Enrollando voz en Qwen TTS...")
import voice_registry

try:
    voice_map = voice_registry.build_registry(langs=["es"], force_reenroll=False)
except Exception as e:
    print(f"✗ Error en enrollment: {e}")
    sys.exit(1)

voice_id = voice_map.get("liruf_es")
if not voice_id:
    print("✗ No se obtuvo voice_id para liruf_es")
    sys.exit(1)

print(f"✓ voice_id obtenido: {voice_id}")

# ── 3. Generación de audio de prueba ──────────────────────────
TEST_TEXT = "¡Hola! Soy Liruf, tu guía de finanzas. Hoy aprenderemos a tomar decisiones inteligentes con el dinero."

print(f"\n[3] Generando audio de prueba...")
print(f'    Texto: "{TEST_TEXT}"')

import tts_client

try:
    audio_bytes, duration_ms = tts_client.generate_audio(TEST_TEXT, voice_id)
except Exception as e:
    print(f"✗ Error generando audio: {e}")
    sys.exit(1)

print(f"✓ Audio generado: {len(audio_bytes) / 1024:.1f} KB, {duration_ms}ms")

# ── 4. Guardar resultado ───────────────────────────────────────
output_path = pathlib.Path(__file__).parent / "test_output_liruf_es.mp3"
output_path.write_bytes(audio_bytes)
print(f"\n[4] Guardado en: {output_path}")
print(f"\n{'='*55}")
print("  ✓ Prueba completada exitosamente")
print(f"  Reproduce test_output_liruf_es.mp3 para verificar la voz")
print(f"{'='*55}\n")
