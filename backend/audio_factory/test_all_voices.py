"""
test_all_voices.py — Prueba de calidad para los 8 personajes × idioma.

Genera un audio de prueba por cada combinación (char, lang) y los guarda
en test_outputs/ para reproducirlos y evaluar la calidad.

Ejecutar:
    python3 test_all_voices.py
"""

import pathlib
import sys
import time

import tts_client
import voice_registry

# ── Textos de prueba por idioma ────────────────────────────────────────────
# Cada texto incluye números, puntuación y variaciones de tono
# para evaluar la calidad de síntesis en condiciones reales de lección

TEST_TEXTS = {
    "es": {
        "liruf":    "¡Hola! Soy Liruf. El ahorro es guardar una parte de tu dinero para usarla después. Si ganas 100 pesos y gastas 80, ¡ahorraste 20! ¿Lo intentamos juntos?",
        "dina":     "¡Genial! Esa respuesta es correcta. Recuerda: un presupuesto te ayuda a saber cuánto puedes gastar. ¡Sigue así, vas muy bien!",
        "dr_rho":   "Interesante pregunta. La inflación significa que los precios suben con el tiempo. Si hoy un café cuesta 20 pesos, en 5 años podría costar 28. ¿Tiene sentido?",
        "zara_vex": "¡Atención! Detecté un error en tu estrategia financiera. Gastar más de lo que ganas crea deuda. Ajusta tu presupuesto antes de continuar.",
    },
    "en": {
        "liruf":    "Hey there! I'm Liruf. Saving money means keeping part of what you earn for later. If you make 100 dollars and spend 80, you saved 20! Want to practice together?",
        "dina":     "Excellent work! That answer is correct. Remember: a budget helps you know how much you can spend. Keep it up, you're doing great!",
        "dr_rho":   "Good question. Inflation means prices go up over time. If a coffee costs 2 dollars today, in 5 years it might cost 2.80. Does that make sense?",
        "zara_vex": "Warning! I detected a flaw in your financial strategy. Spending more than you earn creates debt. Adjust your budget before continuing.",
    },
}

OUTPUT_DIR = pathlib.Path(__file__).parent / "test_outputs"
OUTPUT_DIR.mkdir(exist_ok=True)


def main():
    langs = ["es", "en"]

    print("=" * 60)
    print("  Little Founders — Test de calidad de voces (8 combos)")
    print("=" * 60)

    # ── Paso 1: Enrollar / cargar todas las voces ──────────────────────
    print("\n[1/2] Preparando voces...")
    voice_map = voice_registry.build_registry(langs=langs, force_reenroll=False)

    if not voice_map:
        print("✗ No hay voces disponibles. Revisa voice_samples/")
        sys.exit(1)

    print(f"\n  Voces disponibles: {list(voice_map.keys())}\n")

    # ── Paso 2: Generar audio para cada combo ──────────────────────────
    print("[2/2] Generando audios de prueba...\n")

    results = []
    chars = ["liruf", "dina", "dr_rho", "zara_vex"]

    for lang in langs:
        for char in chars:
            key = f"{char}_{lang}"
            voice_id = voice_map.get(key)

            if not voice_id:
                print(f"  ⚠  [{key}] Sin voice_id — omitido.")
                results.append((key, False, "sin voice_id"))
                continue

            text = TEST_TEXTS[lang][char]
            print(f"  [{key}]")
            print(f"    Texto : «{text[:70]}{'...' if len(text) > 70 else ''}»")

            t0 = time.time()
            try:
                audio_bytes, duration_ms = tts_client.generate_audio(text, voice_id)
                elapsed = time.time() - t0

                output_path = OUTPUT_DIR / f"{key}.mp3"
                output_path.write_bytes(audio_bytes)

                print(f"    ✓ {duration_ms}ms de audio | {len(audio_bytes)//1024}KB | "
                      f"generado en {elapsed:.1f}s → {output_path.name}\n")
                results.append((key, True, f"{duration_ms}ms"))

            except Exception as e:
                elapsed = time.time() - t0
                print(f"    ✗ ERROR ({elapsed:.1f}s): {e}\n")
                results.append((key, False, str(e)[:80]))

            # Pausa entre llamadas para no saturar la API
            time.sleep(1.0)

    # ── Reporte final ──────────────────────────────────────────────────
    ok = [r for r in results if r[1]]
    fail = [r for r in results if not r[1]]

    print("=" * 60)
    print(f"  RESULTADO: {len(ok)}/{len(results)} audios generados")
    print(f"  Carpeta  : {OUTPUT_DIR}")
    print("=" * 60)

    if ok:
        print("\n  ✓ Exitosos:")
        for key, _, info in ok:
            print(f"    {key}.mp3  ({info})")

    if fail:
        print("\n  ✗ Fallidos:")
        for key, _, err in fail:
            print(f"    {key}: {err}")

    print()


if __name__ == "__main__":
    main()
