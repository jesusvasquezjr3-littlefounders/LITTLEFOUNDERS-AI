# Guía de Integración API - LittleFounders Audio Engine

Esta guía explica cómo conectar cualquier aplicación (frontend, backend, scripts) al microservicio de generación de audio **LittleFounders Audio Engine**.

El servicio está diseñado para ser **estrictamente secuencial**: procesa una solicitud a la vez para garantizar la máxima calidad de audio sin sobrecargar la CPU.

## 1. Configuración de Conexión

No se requiere autenticación compleja (Google IAM). La seguridad se maneja mediante una simple **API Key** en los encabezados.

### Variables de Entorno (Recomendado)

En tu proyecto cliente (el que va a pedir los audios), agrega estas variables a tu archivo `.env`:

```bash
LF_AUDIO_API_URL="LF_AUDIO_API_URL"
LF_AUDIO_API_KEY="LF_AUDIO_API_KEY"
```

---

## 2. Cliente Python (SDK)

Copia este archivo `lf_audio_client.py` en tu proyecto para tener una integración instantánea. Maneja la conexión, los reintentos y el guardado de archivos.

```python
import os
import time
import requests
from typing import Optional

class LFAudioClient:
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
        output_path: str = "output.wav"
    ) -> bool:
        """
        Genera un audio y lo guarda en la ruta especificada.
        
        Args:
            text: Texto a hablar
            character: 'liruf', 'dina', 'dr_rho', 'zara_vex'
            emotion: 'neutral', 'happy', 'excited', 'thinking', 'sad', 'calm'
            language_code: 'es' o 'en'
            output_path: Ruta donde guardar el archivo .wav
            
        Returns:
            bool: True si tuvo éxito, False si falló.
        """
        endpoint = f"{self.api_url}/v1/synthesis"
        
        headers = {}
        if self.api_key:
            headers["X-API-KEY"] = self.api_key
            
        payload = {
            "text": text,
            "character_code": character,
            "emotion": emotion,
            "language_code": language_code,
            "apply_studio_enhancement": True,
            "studio_intensity": "medium"
        }
        
        print(f"🎤 Solicitando audio para {character} ({emotion})...")
        
        try:
            # Timeout alto (300s) porque el servidor puede estar ocupado (cola secuencial)
            response = requests.post(endpoint, json=payload, headers=headers, timeout=300)
            
            if response.status_code == 200:
                # Crear directorios si no existen
                os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
                
                with open(output_path, "wb") as f:
                    f.write(response.content)
                    
                duration = response.headers.get("X-Audio-Duration", "?")
                print(f"✅ Éxito: Guardado en {output_path} (Duración: {duration}s)")
                return True
            else:
                print(f"❌ Error del servidor ({response.status_code}): {response.text}")
                return False
                
        except Exception as e:
            print(f"❌ Error de conexión: {str(e)}")
            return False

# --- Ejemplo de uso ---
if __name__ == "__main__":
    client = LFAudioClient()
    client.generate(
        text="¡Hola! Esto es una prueba del sistema de audio integrado.",
        character="liruf",
        emotion="happy",
        language_code="es",
        output_path="prueba_integracion.wav"
    )
```

---

## 3. Especificación de la API

### Endpoint Principal: Generar Audio

*   **URL:** `/v1/synthesis`
*   **Método:** `POST`
*   **Headers:**
    *   `Content-Type: application/json`
    *   `X-API-KEY: X-API-KEY`

**Cuerpo (JSON):**

```json
{
  "text": "Texto que quieres que el personaje diga.",
  "character_code": "dina",
  "emotion": "excited",
  "language_code": "es",
  "apply_studio_enhancement": true,
  "studio_intensity": "medium"
}
```

| Campo | Tipo | Descripción | Opciones |
| :--- | :--- | :--- | :--- |
| `text` | string | El guion a leer. | Máx 5000 caracteres. |
| `character_code` | string | El personaje. | `liruf`, `dina`, `dr_rho`, `zara_vex` |
| `emotion` | string | La emoción/tono. | `neutral`, `happy`, `excited`, `thinking`, `sad`, `calm` |
| `language_code` | string | Idioma del texto. | `es` (Español), `en` (Inglés - Experimental) |
| `studio_intensity` | string | Calidad de mejora. | `light`, `medium`, `heavy` (Recomendado: `medium`) |

### Comportamiento de Cola (Queue)

El servidor tiene un **bloqueo global estricto**.

1.  Si envías 5 peticiones simultáneas desde distintos proyectos, el servidor procesará la **1ra** y dejará las otras 4 esperando.
2.  Cuando termine la 1ra, procesará la 2da, y así sucesivamente.
3.  **Importante:** Configura el `timeout` de tu cliente HTTP en al menos **60 segundos** (o más si envías textos largos) para evitar que corte la conexión mientras espera su turno en la fila.

---

## 4. Personajes y Emociones

### Personajes (`character_code`)

| Código | Nombre | Estilo de Voz |
| :--- | :--- | :--- |
| `liruf` | Liruf | Amigable, cálido, educativo (M) |
| `dina` | Dina | Enérgica, curiosa, aguda (F) |
| `dr_rho` | Dr. Rho | Profundo, calmado, sabio (M) |
| `zara_vex` | Zara Vex | Dinámica, líder, aventurera (F) |

### Emociones (`emotion`)

*   **`neutral`**: Narrativa estándar.
*   **`happy`**: Sonriente, ligeramente más rápido.
*   **`excited`**: Muy rápido, con picos de tono (¡gritos de emoción!).
*   **`thinking`**: Lento, reflexivo, pausas más largas.
*   **`sad`**: Lento, tono descendente, apagado.
*   **`calm`**: Suave, casi susurrado, relajante.
