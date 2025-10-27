# Configuración de CORS para Cloudflare Tunnel

## ⚠️ IMPORTANTE: Configurar CORS para Producción

Cuando uses Cloudflare Tunnel, tu aplicación estará accesible desde internet. Es importante configurar CORS correctamente para seguridad.

## Configuración Actual (Desarrollo)

Tu backend actualmente acepta peticiones desde **cualquier origen** (`"*"`):

```python
cors_origins: list[str] = ["*"]
```

Esto está bien para desarrollo local, pero **NO es seguro para producción**.

---

## Opción 1: Variables de Entorno (RECOMENDADO) ⭐

### Paso 1: Crea un archivo `.env` en `backend/`

```env
# Database
DATABASE_HOSTNAME=localhost
DATABASE_PORT=5432
DATABASE_PASSWORD=changeme
DATABASE_NAME=littlefounders_db
DATABASE_USERNAME=littlefounders

# Security
SECRET_KEY=your-secret-key-here-change-in-production
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

# Email
MAIL_USERNAME=your-email@example.com
MAIL_PASSWORD=your-password
MAIL_FROM=noreply@littlefounders.com
MAIL_PORT=587
MAIL_SERVER=smtp.gmail.com
MAIL_FROM_NAME=LittleFounders

# API
API_TITLE=LittleFounders API
API_VERSION=1.0.0
API_DESCRIPTION=API para la plataforma educativa financiera LittleFounders

# CORS - Agrega tus URLs de Cloudflare aquí
CORS_ORIGINS=["http://localhost:5173","http://localhost:80","http://localhost:3000","https://tu-url-cloudflare.trycloudflare.com","https://littlefounders.tudominio.com"]
```

### Paso 2: Actualiza `backend/config.py`

```python
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List
import json


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env"
    )

    # Database configuration
    database_hostname: str
    database_port: str
    database_password: str
    database_name: str
    database_username: str
    
    # Security configuration
    secret_key: str
    algorithm: str
    access_token_expire_minutes: int
    
    # Email configuration
    mail_username: str
    mail_password: str
    mail_from: str
    mail_port: int
    mail_server: str
    mail_from_name: str
    
    # API configuration
    api_title: str = "LittleFounders API"
    api_version: str = "1.0.0"
    api_description: str = "API para la plataforma educativa financiera LittleFounders"
    
    # CORS configuration
    # Leer desde variable de entorno como JSON
    cors_origins: str = '["*"]'
    cors_allow_credentials: bool = True
    cors_allow_methods: List[str] = ["*"]
    cors_allow_headers: List[str] = ["*"]
    
    @property
    def get_cors_origins(self) -> List[str]:
        """Parse CORS origins from JSON string"""
        try:
            return json.loads(self.cors_origins)
        except:
            return ["*"]


settings = Settings()
```

### Paso 3: Actualiza `backend/main.py`

Cambia la línea de `allow_origins`:

```python
# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.get_cors_origins,  # 👈 Cambio aquí
    allow_credentials=settings.cors_allow_credentials,
    allow_methods=settings.cors_allow_methods,
    allow_headers=settings.cors_allow_headers,
)
```

---

## Opción 2: Configuración Directa (Más Simple)

Si no quieres usar variables de entorno, puedes editar directamente `backend/config.py`:

```python
# CORS configuration
cors_origins: list[str] = [
    "http://localhost:5173",  # Frontend dev
    "http://localhost:80",     # Frontend Docker
    "http://localhost:3000",   # Alternativo
    "https://random-name.trycloudflare.com",  # Tu URL temporal de Cloudflare
    "https://littlefounders.tudominio.com",   # Tu dominio permanente
]
```

**Nota**: Tendrás que actualizar esto cada vez que uses un nuevo túnel temporal.

---

## Configuración para Docker Compose

Si usas Docker Compose, actualiza el archivo `docker-compose.yml`:

```yaml
backend:
  build:
    context: .
    dockerfile: Dockerfile.backend
  container_name: littlefounders-backend
  environment:
    DATABASE_URL: postgresql://${DB_USER:-littlefounders}:${DB_PASSWORD:-changeme}@db:5432/${DB_NAME:-littlefounders_db}
    SECRET_KEY: ${SECRET_KEY:-your-secret-key-here-change-in-production}
    ALGORITHM: ${ALGORITHM:-HS256}
    ACCESS_TOKEN_EXPIRE_MINUTES: ${ACCESS_TOKEN_EXPIRE_MINUTES:-30}
    # Agrega tu URL de Cloudflare
    CORS_ORIGINS: '["http://localhost:5173","http://localhost:80","https://tu-url-cloudflare.trycloudflare.com"]'
  ports:
    - "8000:8000"
  depends_on:
    db:
      condition: service_healthy
  networks:
    - littlefounders-network
  volumes:
    - ./backend:/app/backend
  command: uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

---

## Verificar Configuración

### 1. Verifica que CORS esté configurado correctamente:

Accede a: `http://localhost:8000/docs`

Deberías ver la documentación de FastAPI.

### 2. Prueba desde el frontend:

```javascript
// En tu navegador, abre la consola y prueba:
fetch('https://tu-url-cloudflare.trycloudflare.com/api/endpoint')
  .then(response => response.json())
  .then(data => console.log(data))
  .catch(error => console.error('Error:', error));
```

Si ves un error de CORS, significa que necesitas agregar la URL a la lista.

---

## Configurar URL del Backend en el Frontend

### Actualiza tu archivo de configuración del frontend

Si tienes variables de entorno en el frontend (`.env` en la raíz):

```env
# Frontend .env
VITE_API_URL=http://localhost:8000
# O cuando uses Cloudflare:
# VITE_API_URL=https://api.tudominio.com
```

Y úsalo en tu código:

```typescript
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// Usar en tus llamadas API
fetch(`${API_URL}/api/endpoint`)
```

---

## Mejores Prácticas de Seguridad 🔒

1. **NO uses `"*"` en producción**
   - Restringe los orígenes a tus dominios específicos

2. **Usa HTTPS siempre**
   - Cloudflare lo proporciona automáticamente

3. **Actualiza las credenciales por defecto**
   - Cambia `SECRET_KEY`, `DATABASE_PASSWORD`, etc.

4. **No compartas credenciales**
   - Archivos `.env` están en `.gitignore`

5. **Limita los métodos HTTP si es posible**
   - Solo permite los métodos que necesites (GET, POST, etc.)

6. **Implementa rate limiting**
   - Protege tu API de abuso

---

## Solución Rápida de Problemas

### ❌ Error: "CORS policy: No 'Access-Control-Allow-Origin'"

✅ **Solución**: Agrega tu URL de Cloudflare a `cors_origins`

### ❌ El frontend se conecta pero el backend responde con 404

✅ **Solución**: Verifica las rutas de la API y que uses el prefijo correcto

### ❌ "Preflight request doesn't pass access control check"

✅ **Solución**: Asegúrate de que `cors_allow_credentials: true` y las credenciales estén configuradas

---

## Ejemplo Completo de Flujo

1. **Inicia Docker Compose**:
   ```bash
   docker-compose up -d
   ```

2. **Inicia Cloudflare Tunnel**:
   ```bash
   .\cloudflared-windows-amd64.exe tunnel --url http://localhost:80
   ```

3. **Copia la URL** (ej: `https://abc123.trycloudflare.com`)

4. **Actualiza CORS** en `backend/.env`:
   ```env
   CORS_ORIGINS=["http://localhost:5173","http://localhost:80","https://abc123.trycloudflare.com"]
   ```

5. **Reinicia el backend**:
   ```bash
   docker-compose restart backend
   ```

6. **¡Prueba la URL!** Comparte `https://abc123.trycloudflare.com`

---

## Referencias

- [FastAPI CORS Middleware](https://fastapi.tiangolo.com/tutorial/cors/)
- [Cloudflare Tunnel Docs](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/)
- [MDN CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)

¿Necesitas ayuda configurando algún aspecto específico?

