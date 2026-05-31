"""
Pipeline de Generación de Audio para Lecciones - LittleFounders
================================================================

Este script genera audios para las lecciones usando LF Audio Engine,
los sube a Supabase Storage, y actualiza la base de datos.

IMPORTANTE: Los audios se generan UNA VEZ y se almacenan para
optimizar el rendimiento.

Uso:
    python generate_audio.py --lesson-code 1-1-1
    python generate_audio.py --lesson-code 1-1-1 --dry-run
"""
from __future__ import annotations

import argparse
import os
import sys
from dataclasses import dataclass
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv

# Import LF Audio Client
from lf_audio_client import LFAudioClient
from supabase import Client, create_client

load_dotenv()


@dataclass
class AudioSegment:
    """Representa un segmento de audio a generar"""
    exercise_id: int
    character_code: str
    text: str
    emotion: str
    order_index: int


class LessonAudioGenerator:
    """Generador de audio para lecciones usando LF Audio Engine"""

    def __init__(self, dry_run: bool = False):
        self.dry_run = dry_run

        # LF Audio Engine client
        self.audio_client = LFAudioClient()

        # Supabase client
        supabase_url = os.getenv("SUPABASE_URL")
        supabase_key = os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("SUPABASE_KEY")

        if not supabase_url or not supabase_key:
            raise ValueError("SUPABASE_URL y SUPABASE_KEY/SUPABASE_SERVICE_KEY son requeridas")

        self.supabase: Client = create_client(supabase_url, supabase_key)

        # Storage bucket
        self.bucket_name = "littlefounders-audio"

        # Output directory for local backup
        self.output_dir = Path(__file__).parent / "generated_audio"
        self.output_dir.mkdir(exist_ok=True)

    def get_lesson_data(self, lesson_code: str) -> dict:
        """Obtiene los datos de la lección desde Supabase"""
        result = self.supabase.table("lessons").select("*").eq("lesson_id", lesson_code).single().execute()
        return result.data

    def get_exercises(self, lesson_id: int) -> list[dict]:
        """Obtiene los ejercicios de una lección"""
        result = self.supabase.table("exercises").select("*").eq("lesson_id", lesson_id).order("order_index").execute()
        return result.data

    def get_characters(self) -> dict[str, dict]:
        """Obtiene los personajes y sus IDs"""
        characters_result = self.supabase.table("characters").select("*").execute()

        result = {}
        for char in characters_result.data:
            result[char["code"]] = char
        return result

    def extract_audio_segments(self, exercises: list[dict]) -> list[AudioSegment]:
        """Extrae los segmentos de audio a generar de los ejercicios"""
        segments = []

        for exercise in exercises:
            content = exercise.get("content", {})

            # Buscar texto para sintetizar
            transcript = content.get("transcript")
            if not transcript:
                continue

            # Obtener personaje
            character_code = exercise.get("character_code", "liruf")

            segments.append(AudioSegment(
                exercise_id=exercise["id"],
                character_code=character_code,
                text=transcript,
                emotion=content.get("emotion", "neutral"),
                order_index=exercise["order_index"]
            ))

        return segments

    def generate_audio_lf_engine(self, text: str, character_code: str, emotion: str = "neutral", language_code: str = "es") -> bytes | None:
        """
        Genera audio usando LF Audio Engine.

        Returns:
            bytes: Datos del audio WAV, o None si falló
        """
        return self.audio_client.generate(
            text=text,
            character=character_code,
            emotion=emotion,
            language_code=language_code,
            studio_intensity="medium"
        )

    def upload_to_supabase(self, audio_data: bytes, file_path: str) -> str:
        """Sube el audio a Supabase Storage y retorna la URL pública"""

        # Eliminar archivo existente si ya existe (para updates)
        try:
            self.supabase.storage.from_(self.bucket_name).remove([file_path])
        except:
            pass  # Ignorar si no existe

        # Subir archivo (formato WAV desde LF Audio Engine)
        self.supabase.storage.from_(self.bucket_name).upload(
            file_path,
            audio_data,
            {"content-type": "audio/wav"}
        )

        # Obtener URL pública
        public_url = self.supabase.storage.from_(self.bucket_name).get_public_url(file_path)

        return public_url

    def save_audio_segment_to_db(
        self,
        lesson_id: int,
        exercise_id: int,
        character_id: int,
        audio_url: str,
        transcript: str,
        emotion: str,
        order_index: int,
        language: str = "es",
        duration_ms: int | None = None
    ):
        """Guarda el segmento de audio en la base de datos"""

        # Verificar si ya existe un registro para este ejercicio
        existing = self.supabase.table("lesson_audio_segments").select("id").eq("exercise_id", exercise_id).execute()

        data = {
            "lesson_id": lesson_id,
            "exercise_id": exercise_id,
            "character_id": character_id,
            "audio_url": audio_url,
            "transcript": transcript,
            "emotion": emotion,
            "order_index": order_index,
            "duration_ms": duration_ms,
            "language_code": language
        }

        if existing.data:
            # Update existente
            self.supabase.table("lesson_audio_segments").update(data).eq("exercise_id", exercise_id).execute()
        else:
            # Insert nuevo
            self.supabase.table("lesson_audio_segments").insert(data).execute()

    def process_lesson(self, lesson_code: str, language: str = "es"):
        """
        Procesa una lección completa: genera audios, sube y guarda en BD.

        Args:
            lesson_code: Código de la lección (ej: 1-1-1-L1)
            language: Código de idioma (es, en)
        """

        print(f"\n{'='*60}")
        print(f"📚 Procesando lección: {lesson_code} (idioma: {language})")
        print(f"{'='*60}\n")

        # Obtener datos
        lesson = self.get_lesson_data(lesson_code)
        if not lesson:
            print(f"❌ Lección '{lesson_code}' no encontrada")
            return

        print(f"✅ Lección encontrada: {lesson['title']}")

        exercises = self.get_exercises(lesson["id"])
        print(f"✅ {len(exercises)} ejercicios encontrados")

        characters = self.get_characters()
        print(f"✅ Personajes cargados: {list(characters.keys())}")

        # Extraer segmentos
        segments = self.extract_audio_segments(exercises)
        print(f"\n📝 {len(segments)} segmentos de audio a generar:\n")

        for i, seg in enumerate(segments, 1):
            preview = seg.text[:60] + "..." if len(seg.text) > 60 else seg.text
            print(f"  {i}. [{seg.character_code}] ({seg.emotion}): \"{preview}\"")

        if self.dry_run:
            print("\n⚠️ MODO DRY-RUN: No se generarán audios reales")
            return

        # Procesar cada segmento
        print("\n🎤 Generando audios con LF Audio Engine...\n")
        print(f"📡 Conectando a: {self.audio_client.api_url}")
        print("⚠️  Primera solicitud puede tardar mientras el servicio se activa...\n")

        success_count = 0
        error_count = 0

        for i, seg in enumerate(segments, 1):
            print(f"  [{i}/{len(segments)}] Generando audio para {seg.character_code} ({seg.emotion})...")

            try:
                # Generar audio con LF Audio Engine
                audio_data = self.generate_audio_lf_engine(seg.text, seg.character_code, seg.emotion, language)

                if not audio_data:
                    print("    ❌ No se pudo generar audio")
                    error_count += 1
                    continue

                print(f"    ✓ Audio generado ({len(audio_data) / 1024:.1f} KB)")

                # Guardar localmente
                local_file = self.output_dir / f"{lesson_code}_{seg.order_index}_{seg.character_code}.wav"
                with open(local_file, "wb") as f:
                    f.write(audio_data)
                print(f"    ✓ Guardado localmente: {local_file.name}")

                # Subir a Supabase Storage
                storage_path = f"lessons/{lesson_code}/{seg.order_index}_{seg.character_code}_{seg.emotion}.wav"
                audio_url = self.upload_to_supabase(audio_data, storage_path)
                print("    ✓ Subido a Storage")

                # Obtener character_id
                character_id = characters.get(seg.character_code, {}).get("id")

                if character_id:
                    # Guardar en BD
                    self.save_audio_segment_to_db(
                        lesson_id=lesson["id"],
                        exercise_id=seg.exercise_id,
                        character_id=character_id,
                        audio_url=audio_url,
                        transcript=seg.text,
                        emotion=seg.emotion,
                        order_index=seg.order_index,
                        language=language
                    )
                    print("    ✓ Guardado en base de datos")
                else:
                    print(f"    ⚠️ Character ID no encontrado para {seg.character_code}")

                success_count += 1

            except Exception as e:
                print(f"    ❌ Error: {e}")
                error_count += 1

        print(f"\n{'='*60}")
        print(f"✅ Lección {lesson_code} procesada")
        print(f"   - Exitosos: {success_count}")
        print(f"   - Errores: {error_count}")
        print(f"{'='*60}\n")


def main():
    parser = argparse.ArgumentParser(description="Genera audios para lecciones de LittleFounders usando LF Audio Engine")
    parser.add_argument("--lesson-code", "-l", required=True, help="Código de la lección (ej: 1-1-1-L1)")
    parser.add_argument("--dry-run", "-d", action="store_true", help="Simular sin generar audios")
    parser.add_argument("--language", "-L", default="es", help="Idioma para las voces (es, en). Default: es")

    args = parser.parse_args()

    generator = LessonAudioGenerator(dry_run=args.dry_run)
    generator.process_lesson(args.lesson_code, args.language)


if __name__ == "__main__":
    main()
