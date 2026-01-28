# 📖 Guía de Integración - LittleFounders Audio Engine

Esta guía detalla cómo integrar LittleFounders Audio Engine en tu aplicación cliente, reemplazando la dependencia de ElevenLabs.

---

## 📋 Tabla de Contenidos

1. [Resumen de Cambios](#resumen-de-cambios)
2. [Configuración del Entorno](#configuración-del-entorno)
3. [Clase Cliente LFAudioClient](#clase-cliente-lfaudioclient)
4. [Migración desde ElevenLabs](#migración-desde-elevenlabs)
5. [Ejemplos de Uso](#ejemplos-de-uso)
6. [Manejo de Errores](#manejo-de-errores)
7. [Optimización y Mejores Prácticas](#optimización-y-mejores-prácticas)

---

## Resumen de Cambios

### Diferencias Clave con ElevenLabs

| Aspecto | ElevenLabs (Anterior) | LF Audio Engine (Nuevo) |
|---------|----------------------|-------------------------|
| **Identificación de Voz** | UUID opaco (`ErXwobaBV20c...`) | Código de personaje (`liruf`, `dina`, etc.) |
| **Control de Emoción** | `stability`, `similarity_boost` | `emotion` (preset) o `exaggeration`, `cfg_weight` |
| **Endpoint** | `api.elevenlabs.io/v1/text-to-speech/{voice_id}` | `{TU_URL}/v1/synthesis` |
| **Autenticación** | `xi-api-key` header | **Google Cloud IAM** (Identity Token) |
| **Latencia** | ~500ms | Variable (30-60s en CPU) |
| **Primera Request** | ~500ms | 3-5 minutos (descarga modelo) |
| **Costo** | Por carácter | Costo fijo de infraestructura |

---

## Configuración del Entorno

### Dependencias Requeridas

```bash
pip install google-auth requests
```

### Variables de Entorno

Actualiza tu archivo `.env`:

```bash
# ANTES (ElevenLabs)
# ELEVENLABS_API_KEY=tu_clave_elevenlabs

# AHORA (LF Audio Engine)
LF_AUDIO_ENGINE_URL=https://lf-audio-engine-7fdkgzlyqa-uc.a.run.app

# Opcional: API Key adicional
LF_AUDIO_API_KEY=tu_clave_segura_opcional
```

### Configuración de Credenciales de GCP

El servicio usa autenticación de Google Cloud IAM. Configura las credenciales según tu entorno:

#### Opción 1: Desde tu máquina local (desarrollo)
```bash
gcloud auth application-default login
```

#### Opción 2: Desde un servicio de GCP (producción)
Las credenciales se obtienen automáticamente del entorno.

#### Opción 3: Service Account Key (no recomendado)
```bash
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account-key.json
```

### Mapeo de Voice IDs a Códigos de Personaje

Si tenías Voice IDs de ElevenLabs mapeados, actualiza el mapeo:

```python
# ANTES (ElevenLabs Voice IDs)
VOICE_MAP_OLD = {
    "liruf": "ErXwo8aBV20c...",   # Voice ID de ElevenLabs
    "narrator": "21m00Tcm4Tl...",
}

# AHORA (Códigos de personaje)
CHARACTER_CODES = {
    "liruf": "liruf",
    "dina": "dina", 
    "dr_rho": "dr_rho",
    "zara_vex": "zara_vex",
}
```

---

## Clase Cliente LFAudioClient

Implementa esta clase en tu proyecto para comunicarte con LF Audio Engine:

```python
"""
LF Audio Engine Client
Reemplazo drop-in para el cliente de ElevenLabs
Con autenticación de Google Cloud IAM
"""

import os
import requests
from typing import Optional
from dataclasses import dataclass

# Autenticación de Google Cloud
import google.auth.transport.requests
import google.oauth2.id_token


@dataclass
class AudioGenerationResult:
    """Resultado de la generación de audio."""
    audio_bytes: bytes
    duration_seconds: float
    character: str
    emotion: str


class LFAudioClient:
    """
    Cliente para LittleFounders Audio Engine.
    Incluye autenticación automática con Google Cloud IAM.
    
    Ejemplo de uso:
        client = LFAudioClient()
        audio = client.generate("¡Hola!", "liruf", "happy")
        
        with open("output.wav", "wb") as f:
            f.write(audio.audio_bytes)
    """
    
    # URL del servicio desplegado en LittleFounders
    DEFAULT_URL = "https://lf-audio-engine-7fdkgzlyqa-uc.a.run.app"
    
    def __init__(
        self,
        base_url: Optional[str] = None,
        api_key: Optional[str] = None,
        timeout: int = 300  # 5 minutos para primera request
    ):
        """
        Inicializa el cliente.
        
        Args:
            base_url: URL del servicio (default: variable de entorno o URL de LittleFounders)
            api_key: API Key opcional adicional
            timeout: Timeout en segundos para requests (default: 300s para cold starts)
        """
        self.base_url = base_url or os.getenv("LF_AUDIO_ENGINE_URL", self.DEFAULT_URL)
        self.api_key = api_key or os.getenv("LF_AUDIO_API_KEY")
        self.timeout = timeout
    
    def _get_identity_token(self) -> str:
        """Obtiene un Identity Token de Google Cloud para autenticación."""
        try:
            auth_req = google.auth.transport.requests.Request()
            token = google.oauth2.id_token.fetch_id_token(auth_req, self.base_url)
            return token
        except Exception as e:
            raise Exception(
                f"Error obteniendo Identity Token: {e}. "
                "Asegúrate de tener credenciales de GCP configuradas. "
                "Ejecuta: gcloud auth application-default login"
            )
        
    def _get_headers(self) -> dict:
        """Construye headers para la request con autenticación de GCP."""
        token = self._get_identity_token()
        
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {token}"
        }
        if self.api_key:
            headers["X-API-Key"] = self.api_key
        return headers
    
    def generate(
        self,
        text: str,
        character_code: str,
        emotion: str = "neutral",
        language_code: str = "es"
    ) -> AudioGenerationResult:
        """
        Genera audio a partir de texto.
        
        Args:
            text: Texto a sintetizar
            character_code: Código del personaje (liruf, dina, dr_rho, zara_vex)
            emotion: Emoción (neutral, happy, excited, thinking)
            language_code: Código de idioma ISO 639-1
            
        Returns:
            AudioGenerationResult con bytes del audio y metadata
            
        Raises:
            LFAudioError: Si hay error en la generación
        """
        payload = {
            "text": text,
            "character_code": character_code,
            "emotion": emotion,
            "language_code": language_code
        }
        
        try:
            response = requests.post(
                self.base_url,
                json=payload,
                headers=self._get_headers(),
                timeout=self.timeout
            )
            
            if response.status_code == 200:
                # Extraer metadata de headers
                duration = float(response.headers.get("X-Audio-Duration", 0))
                
                return AudioGenerationResult(
                    audio_bytes=response.content,
                    duration_seconds=duration,
                    character=character_code,
                    emotion=emotion
                )
            else:
                error_detail = response.json().get("detail", response.text)
                raise LFAudioError(
                    f"Error {response.status_code}: {error_detail}"
                )
                
        except requests.exceptions.Timeout:
            raise LFAudioError(
                f"Timeout: El servidor tardó más de {self.timeout}s en responder"
            )
        except requests.exceptions.ConnectionError:
            raise LFAudioError(
                f"Error de conexión: No se pudo conectar a {self.base_url}"
            )
    
    def generate_to_file(
        self,
        text: str,
        character_code: str,
        output_path: str,
        emotion: str = "neutral",
        language_code: str = "es"
    ) -> str:
        """
        Genera audio y lo guarda directamente en un archivo.
        
        Returns:
            Ruta del archivo guardado
        """
        result = self.generate(text, character_code, emotion, language_code)
        
        with open(output_path, "wb") as f:
            f.write(result.audio_bytes)
            
        return output_path
    
    def health_check(self) -> dict:
        """Verifica el estado del servicio."""
        health_url = self.base_url.replace("/v1/synthesis", "/health")
        
        try:
            response = requests.get(health_url, timeout=10)
            return response.json()
        except Exception as e:
            return {"status": "error", "detail": str(e)}


class LFAudioError(Exception):
    """Excepción para errores de LF Audio Engine."""
    pass
```

---

## Migración desde ElevenLabs

### Antes (ElevenLabs)

```python
def generate_audio_elevenlabs(text: str, voice_id: str, emotion: str) -> bytes:
    """Genera audio usando ElevenLabs API."""
    
    url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"
    
    # Mapear emoción a parámetros de ElevenLabs
    stability = 0.5
    similarity_boost = 0.75
    if emotion == "excited":
        stability = 0.3
        similarity_boost = 0.8
    
    payload = {
        "text": text,
        "model_id": "eleven_multilingual_v2",
        "voice_settings": {
            "stability": stability,
            "similarity_boost": similarity_boost
        }
    }
    
    headers = {
        "xi-api-key": os.getenv("ELEVENLABS_API_KEY"),
        "Content-Type": "application/json"
    }
    
    response = requests.post(url, json=payload, headers=headers)
    
    if response.status_code != 200:
        raise Exception(f"ElevenLabs Error: {response.text}")
    
    return response.content
```

### Después (LF Audio Engine)

```python
def generate_audio_lf_engine(text: str, character_code: str, emotion: str = "neutral") -> bytes:
    """
    Genera audio usando LF Audio Engine (Self-Hosted Chatterbox).
    Reemplaza a ElevenLabs API.
    """
    
    api_url = os.getenv("LF_AUDIO_ENGINE_URL")
    if not api_url:
        # Fallback a local si se está probando
        api_url = "http://localhost:8000/v1/synthesis"
    
    payload = {
        "text": text,
        "character_code": character_code,  # Código del personaje, no Voice ID
        "emotion": emotion,
        "language_code": "es"
    }
    
    headers = {"Content-Type": "application/json"}
    
    # API Key opcional
    api_key = os.getenv("LF_AUDIO_API_KEY")
    if api_key:
        headers["X-API-Key"] = api_key
    
    try:
        # Timeout alto porque la generación puede tardar más que ElevenLabs
        response = requests.post(api_url, json=payload, headers=headers, timeout=120)
        
        if response.status_code != 200:
            raise Exception(f"LF Engine Error: {response.status_code} - {response.text}")
        
        return response.content
        
    except requests.exceptions.Timeout:
        raise Exception("LF Audio Engine tardó demasiado en responder (Timeout)")
    except requests.exceptions.ConnectionError:
        raise Exception(f"No se pudo conectar a LF Audio Engine: {api_url}")
```

### Actualización del Bucle Principal

En tu método que procesa lecciones o genera audios:

```python
# ANTES
for segment in segments:
    # Usaba Voice ID de ElevenLabs
    audio_data = self.generate_audio_elevenlabs(
        segment.text,
        segment.voice_id,  # UUID de ElevenLabs
        segment.emotion
    )
    process_audio(audio_data)

# AHORA
for segment in segments:
    # Usa código de personaje de LittleFounders
    audio_data = self.generate_audio_lf_engine(
        segment.text,
        segment.character_code,  # "liruf", "dina", etc.
        segment.emotion
    )
    process_audio(audio_data)
```

---

## Ejemplos de Uso

### Ejemplo Básico

```python
from lf_audio_client import LFAudioClient

# Crear cliente
client = LFAudioClient()

# Generar audio
result = client.generate(
    text="¡Hola! Soy Liruf y hoy aprenderemos algo increíble.",
    character_code="liruf",
    emotion="happy"
)

# Guardar archivo
with open("saludo_liruf.wav", "wb") as f:
    f.write(result.audio_bytes)

print(f"Audio generado: {result.duration_seconds:.2f} segundos")
```

### Ejemplo con Múltiples Personajes

```python
from lf_audio_client import LFAudioClient

client = LFAudioClient()

dialogos = [
    {"personaje": "liruf", "texto": "¡Hola amigos! Hoy tenemos una aventura especial.", "emocion": "happy"},
    {"personaje": "dina", "texto": "¡Sí! ¿Qué vamos a aprender hoy?", "emocion": "excited"},
    {"personaje": "dr_rho", "texto": "Hoy exploraremos el fascinante mundo de las estrellas.", "emocion": "thinking"},
    {"personaje": "zara_vex", "texto": "¡Vamos! Estoy lista para esta aventura espacial.", "emocion": "excited"},
]

for i, dialogo in enumerate(dialogos):
    result = client.generate(
        text=dialogo["texto"],
        character_code=dialogo["personaje"],
        emotion=dialogo["emocion"]
    )
    
    filename = f"dialogo_{i+1}_{dialogo['personaje']}.wav"
    with open(filename, "wb") as f:
        f.write(result.audio_bytes)
    
    print(f"✅ {dialogo['personaje']}: {filename}")
```

### Ejemplo Asíncrono (para aplicaciones web)

```python
import asyncio
import aiohttp
import os


async def generate_audio_async(
    text: str,
    character_code: str,
    emotion: str = "neutral"
) -> bytes:
    """Genera audio de forma asíncrona."""
    
    url = os.getenv("LF_AUDIO_ENGINE_URL", "http://localhost:8000/v1/synthesis")
    
    payload = {
        "text": text,
        "character_code": character_code,
        "emotion": emotion,
        "language_code": "es"
    }
    
    async with aiohttp.ClientSession() as session:
        async with session.post(url, json=payload, timeout=120) as response:
            if response.status == 200:
                return await response.read()
            else:
                error = await response.text()
                raise Exception(f"Error: {error}")


# Uso
async def main():
    audio = await generate_audio_async(
        "¡Hola desde async!",
        "liruf",
        "happy"
    )
    
    with open("async_output.wav", "wb") as f:
        f.write(audio)

asyncio.run(main())
```

---

## Manejo de Errores

### Errores Comunes y Soluciones

| Error | Causa | Solución |
|-------|-------|----------|
| `404 - Personaje no encontrado` | Código de personaje inválido | Usar: `liruf`, `dina`, `dr_rho`, `zara_vex` |
| `400 - Emoción no soportada` | Emoción inválida | Usar: `neutral`, `happy`, `excited`, `thinking` |
| `503 - Modelo no cargado` | Servidor iniciando | Esperar ~60s y reintentar |
| `Timeout` | Generación lenta | Aumentar timeout o usar GPU |
| `Connection refused` | Servidor no disponible | Verificar URL y estado del servidor |

### Implementación de Reintentos

```python
import time
from typing import Optional


def generate_with_retry(
    client: LFAudioClient,
    text: str,
    character_code: str,
    emotion: str = "neutral",
    max_retries: int = 3,
    retry_delay: float = 5.0
) -> Optional[bytes]:
    """Genera audio con reintentos automáticos."""
    
    last_error = None
    
    for attempt in range(max_retries):
        try:
            result = client.generate(text, character_code, emotion)
            return result.audio_bytes
            
        except LFAudioError as e:
            last_error = e
            print(f"Intento {attempt + 1}/{max_retries} fallido: {e}")
            
            if attempt < max_retries - 1:
                print(f"Reintentando en {retry_delay}s...")
                time.sleep(retry_delay)
    
    print(f"❌ Todos los intentos fallaron: {last_error}")
    return None
```

---

## Optimización y Mejores Prácticas

### 1. Procesamiento en Lotes

Para múltiples audios, procesa en paralelo (si tienes múltiples instancias):

```python
from concurrent.futures import ThreadPoolExecutor


def batch_generate(texts_and_characters: list) -> list:
    """Genera múltiples audios en paralelo."""
    
    client = LFAudioClient()
    
    def generate_single(item):
        return client.generate(
            item["text"],
            item["character"],
            item.get("emotion", "neutral")
        )
    
    # Ajustar workers según capacidad del servidor
    with ThreadPoolExecutor(max_workers=2) as executor:
        results = list(executor.map(generate_single, texts_and_characters))
    
    return results
```

### 2. Cache de Audios Generados

```python
import hashlib
import os


def get_cached_or_generate(
    client: LFAudioClient,
    text: str,
    character_code: str,
    emotion: str,
    cache_dir: str = "./audio_cache"
) -> bytes:
    """Usa cache para evitar regenerar audios idénticos."""
    
    # Crear hash único para el request
    cache_key = hashlib.md5(
        f"{text}:{character_code}:{emotion}".encode()
    ).hexdigest()
    
    cache_path = os.path.join(cache_dir, f"{cache_key}.wav")
    
    # Verificar cache
    if os.path.exists(cache_path):
        with open(cache_path, "rb") as f:
            return f.read()
    
    # Generar y guardar en cache
    result = client.generate(text, character_code, emotion)
    
    os.makedirs(cache_dir, exist_ok=True)
    with open(cache_path, "wb") as f:
        f.write(result.audio_bytes)
    
    return result.audio_bytes
```

### 3. Health Check Periódico

```python
def ensure_service_healthy(client: LFAudioClient) -> bool:
    """Verifica que el servicio esté disponible antes de generar."""
    
    health = client.health_check()
    
    if health.get("status") != "healthy":
        print(f"⚠️ Servicio no saludable: {health}")
        return False
    
    if not health.get("model_loaded"):
        print("⚠️ Modelo aún cargando, esperando...")
        return False
    
    return True
```

---

## Checklist de Migración

- [ ] Actualizar variables de entorno (`.env`)
- [ ] Reemplazar `ELEVENLABS_API_KEY` por `LF_AUDIO_ENGINE_URL`
- [ ] Actualizar mapeo de Voice IDs a códigos de personaje
- [ ] Reemplazar función de generación de audio
- [ ] Actualizar llamadas en el bucle principal
- [ ] Ajustar timeouts (120s recomendado para CPU)
- [ ] Implementar manejo de errores apropiado
- [ ] Probar con cada personaje
- [ ] Verificar calidad de audio generado

---

## Soporte

Si tienes problemas con la integración:

1. Verifica que el servicio esté corriendo: `curl {URL}/health`
2. Revisa los logs del servidor
3. Confirma que los archivos de voz existen en `/voices`
4. Verifica la configuración de red (firewalls, VPC, etc.)

---

*Documentación generada para LittleFounders Audio Engine v1.0.0*
