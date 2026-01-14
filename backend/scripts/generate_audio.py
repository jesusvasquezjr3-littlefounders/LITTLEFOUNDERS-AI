"""
Pipeline de Generación de Audio para Lecciones - LittleFounders
================================================================

Este script genera audios para las lecciones usando ElevenLabs API,
los sube a Supabase Storage, y actualiza la base de datos.

IMPORTANTE: Los audios se generan UNA VEZ y se almacenan para
reducir costos de la API de ElevenLabs.

Uso:
    python generate_audio.py --lesson-code 1-1-1
    python generate_audio.py --lesson-code 1-1-1 --dry-run
"""

import os
import sys
import json
import argparse
import requests
from pathlib import Path
from datetime import datetime
from typing import Optional, Dict, List
from dataclasses import dataclass

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()


@dataclass
class AudioSegment:
    """Representa un segmento de audio a generar"""
    exercise_id: int
    character_code: str
    voice_id: str
    text: str
    emotion: str
    order_index: int


class LessonAudioGenerator:
    """Generador de audio para lecciones usando ElevenLabs"""
    
    ELEVENLABS_API_URL = "https://api.elevenlabs.io/v1"
    
    def __init__(self, dry_run: bool = False):
        self.dry_run = dry_run
        
        # ElevenLabs API Key
        self.elevenlabs_api_key = os.getenv("ELEVENLABS_API_KEY")
        if not self.elevenlabs_api_key and not dry_run:
            raise ValueError("ELEVENLABS_API_KEY no está configurada en .env")
        
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
    
    def get_lesson_data(self, lesson_code: str) -> Dict:
        """Obtiene los datos de la lección desde Supabase"""
        result = self.supabase.table("lessons").select("*").eq("lesson_id", lesson_code).single().execute()
        return result.data
    
    def get_exercises(self, lesson_id: int) -> List[Dict]:
        """Obtiene los ejercicios de una lección"""
        result = self.supabase.table("exercises").select("*").eq("lesson_id", lesson_id).order("order_index").execute()
        return result.data
    
    def get_characters(self) -> Dict[str, Dict]:
        """Obtiene los personajes y sus Voice IDs"""
        result = self.supabase.table("characters").select("*").execute()
        return {char["code"]: char for char in result.data}
    
    def extract_audio_segments(self, exercises: List[Dict], characters: Dict) -> List[AudioSegment]:
        """Extrae los segmentos de audio a generar de los ejercicios"""
        segments = []
        
        for exercise in exercises:
            content = exercise.get("content", {})
            
            # Buscar texto para sintetizar
            transcript = content.get("transcript")
            if not transcript:
                continue
            
            # Obtener personaje
            character_code = content.get("characterCode", "liruf")
            character = characters.get(character_code)
            
            if not character or not character.get("elevenlabs_voice_id"):
                print(f"⚠️ Personaje '{character_code}' sin Voice ID, saltando...")
                continue
            
            segments.append(AudioSegment(
                exercise_id=exercise["id"],
                character_code=character_code,
                voice_id=character["elevenlabs_voice_id"],
                text=transcript,
                emotion=content.get("emotion", "neutral"),
                order_index=exercise["order_index"]
            ))
        
        return segments
    
    def generate_audio_elevenlabs(self, text: str, voice_id: str, emotion: str = "neutral") -> bytes:
        """Genera audio usando ElevenLabs API"""
        
        # Mapear emociones a estilos de ElevenLabs
        stability = 0.5
        similarity_boost = 0.75
        
        if emotion == "excited":
            stability = 0.3
            similarity_boost = 0.8
        elif emotion == "happy":
            stability = 0.4
            similarity_boost = 0.75
        elif emotion == "thinking":
            stability = 0.6
            similarity_boost = 0.7
        
        url = f"{self.ELEVENLABS_API_URL}/text-to-speech/{voice_id}"
        
        headers = {
            "Accept": "audio/mpeg",
            "Content-Type": "application/json",
            "xi-api-key": self.elevenlabs_api_key
        }
        
        payload = {
            "text": text,
            "model_id": "eleven_multilingual_v2",  # Mejor para español
            "voice_settings": {
                "stability": stability,
                "similarity_boost": similarity_boost,
                "style": 0.5,
                "use_speaker_boost": True
            }
        }
        
        response = requests.post(url, json=payload, headers=headers)
        
        if response.status_code != 200:
            raise Exception(f"Error de ElevenLabs: {response.status_code} - {response.text}")
        
        return response.content
    
    def upload_to_supabase(self, audio_data: bytes, file_path: str) -> str:
        """Sube el audio a Supabase Storage y retorna la URL pública"""
        
        # Subir archivo
        self.supabase.storage.from_(self.bucket_name).upload(
            file_path,
            audio_data,
            {"content-type": "audio/mpeg"}
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
        duration_ms: Optional[int] = None
    ):
        """Guarda el segmento de audio en la base de datos"""
        
        data = {
            "lesson_id": lesson_id,
            "exercise_id": exercise_id,
            "character_id": character_id,
            "audio_url": audio_url,
            "transcript": transcript,
            "emotion": emotion,
            "order_index": order_index,
            "duration_ms": duration_ms,
            "language_code": "es"
        }
        
        self.supabase.table("lesson_audio_segments").insert(data).execute()
    
    def process_lesson(self, lesson_code: str):
        """Procesa una lección completa: genera audios, sube y guarda en BD"""
        
        print(f"\n{'='*60}")
        print(f"📚 Procesando lección: {lesson_code}")
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
        segments = self.extract_audio_segments(exercises, characters)
        print(f"\n📝 {len(segments)} segmentos de audio a generar:\n")
        
        for i, seg in enumerate(segments, 1):
            preview = seg.text[:60] + "..." if len(seg.text) > 60 else seg.text
            print(f"  {i}. [{seg.character_code}] ({seg.emotion}): \"{preview}\"")
        
        if self.dry_run:
            print("\n⚠️ MODO DRY-RUN: No se generarán audios reales")
            return
        
        # Procesar cada segmento
        print(f"\n🎤 Generando audios con ElevenLabs...\n")
        
        for i, seg in enumerate(segments, 1):
            print(f"  [{i}/{len(segments)}] Generando audio para {seg.character_code}...")
            
            try:
                # Generar audio
                audio_data = self.generate_audio_elevenlabs(seg.text, seg.voice_id, seg.emotion)
                print(f"    ✓ Audio generado ({len(audio_data) / 1024:.1f} KB)")
                
                # Guardar localmente
                local_file = self.output_dir / f"{lesson_code}_{seg.order_index}_{seg.character_code}.mp3"
                with open(local_file, "wb") as f:
                    f.write(audio_data)
                print(f"    ✓ Guardado localmente: {local_file.name}")
                
                # Subir a Supabase Storage
                storage_path = f"lessons/{lesson_code}/{seg.order_index}_{seg.character_code}_{seg.emotion}.mp3"
                audio_url = self.upload_to_supabase(audio_data, storage_path)
                print(f"    ✓ Subido a Storage")
                
                # Obtener character_id
                character_id = characters[seg.character_code]["id"]
                
                # Guardar en BD
                self.save_audio_segment_to_db(
                    lesson_id=lesson["id"],
                    exercise_id=seg.exercise_id,
                    character_id=character_id,
                    audio_url=audio_url,
                    transcript=seg.text,
                    emotion=seg.emotion,
                    order_index=seg.order_index
                )
                print(f"    ✓ Guardado en base de datos")
                
            except Exception as e:
                print(f"    ❌ Error: {e}")
        
        print(f"\n{'='*60}")
        print(f"✅ Lección {lesson_code} procesada exitosamente")
        print(f"{'='*60}\n")


def main():
    parser = argparse.ArgumentParser(description="Genera audios para lecciones de LittleFounders")
    parser.add_argument("--lesson-code", "-l", required=True, help="Código de la lección (ej: 1-1-1)")
    parser.add_argument("--dry-run", "-d", action="store_true", help="Simular sin generar audios")
    
    args = parser.parse_args()
    
    generator = LessonAudioGenerator(dry_run=args.dry_run)
    generator.process_lesson(args.lesson_code)


if __name__ == "__main__":
    main()
