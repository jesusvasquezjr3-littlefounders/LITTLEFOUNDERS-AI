"""
LittleFounders Audio Engine - Python SDK Client
Conecta al microservicio de generación de audio LF Audio Engine.
"""

import os
import time
import requests
from typing import Optional
from pathlib import Path

# Load .env from backend directory
try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).parent.parent / ".env")
except ImportError:
    pass


class LFAudioClient:
    """Cliente para el servicio LittleFounders Audio Engine"""
    
    def __init__(self, api_url: str = None, api_key: str = None):
        """
        Inicializa el cliente de LittleFounders Audio.
        
        Args:
            api_url: URL base del servicio
            api_key: Clave de API para autenticación
        """
        self.api_url = api_url or os.getenv("LF_AUDIO_API_URL")
        self.api_key = api_key or os.getenv("LF_AUDIO_API_KEY")
        
    def generate(
        self, 
        text: str, 
        character: str, 
        emotion: str = "neutral",
        language_code: str = "es",
        output_path: str = None,
        studio_intensity: str = "medium"
    ) -> Optional[bytes]:
        """
        Genera un audio usando LF Audio Engine.
        
        Args:
            text: Texto a hablar
            character: 'liruf', 'dina', 'dr_rho', 'zara_vex'
            emotion: 'neutral', 'happy', 'excited', 'thinking', 'sad', 'calm'
            language_code: 'es' (Español) o 'en' (Inglés)
            output_path: Ruta donde guardar el archivo .wav (opcional)
            studio_intensity: 'light', 'medium', 'heavy'
            
        Returns:
            bytes: Datos del audio WAV, o None si falló
        """
        endpoint = f"{self.api_url}/v1/synthesis"
        
        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["X-API-KEY"] = self.api_key
            
        payload = {
            "text": text,
            "character_code": character,
            "emotion": emotion,
            "language_code": language_code,
            "apply_studio_enhancement": True,
            "studio_intensity": studio_intensity
        }
        
        try:
            # Timeout alto (300s) porque el servidor procesa secuencialmente
            response = requests.post(endpoint, json=payload, headers=headers, timeout=300)
            
            if response.status_code == 200:
                audio_data = response.content
                duration = response.headers.get("X-Audio-Duration", "?")
                
                # Guardar a archivo si se especificó ruta
                if output_path:
                    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
                    with open(output_path, "wb") as f:
                        f.write(audio_data)
                    print(f"✅ Audio guardado: {output_path} (Duración: {duration}s)")
                
                return audio_data
            else:
                print(f"❌ Error del servidor ({response.status_code}): {response.text}")
                return None
                
        except requests.exceptions.Timeout:
            print(f"❌ Timeout: El servidor tardó demasiado en responder")
            return None
        except requests.exceptions.ConnectionError as e:
            print(f"❌ Error de conexión: {str(e)}")
            return None
        except Exception as e:
            print(f"❌ Error inesperado: {str(e)}")
            return None
    
    def health_check(self) -> bool:
        """Verifica si el servicio está disponible"""
        try:
            response = requests.get(f"{self.api_url}/health", timeout=10)
            return response.status_code == 200
        except:
            return False


# --- Ejemplo de uso ---
if __name__ == "__main__":
    print("🎤 LF Audio Engine - Test de Integración")
    print("=" * 50)
    
    client = LFAudioClient()
    
    # Test de conexión
    print(f"\n📡 Conectando a: {client.api_url}")
    
    # Generar audio de prueba
    print("\n🔄 Generando audio de prueba...")
    audio = client.generate(
        text="¡Hola! Esto es una prueba del nuevo motor de audio de LittleFounders.",
        character="liruf",
        emotion="happy",
        language_code="es",
        output_path="test_lf_audio.wav"
    )
    
    if audio:
        print(f"\n✅ ¡Éxito! Audio generado ({len(audio) / 1024:.1f} KB)")
    else:
        print("\n❌ Error al generar audio")
