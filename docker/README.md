# Docker Configuration Files

Este directorio contiene los archivos de configuración necesarios para ejecutar Little Founders con Docker.

## 📁 Archivos

### nginx.conf
Configuración de Nginx para el contenedor multi-servicio (frontend + backend en un solo contenedor).

**Características:**
- Sirve archivos estáticos del frontend desde `/app/frontend`
- Proxy reverso al backend en `localhost:8000`
- Headers de seguridad configurados
- Cache optimizado para assets estáticos
- Logs configurados
- Rutas de API (`/api`, `/docs`, `/redoc`)

**Uso:** Se copia en `Dockerfile` principal

### nginx-frontend.conf
Configuración de Nginx para el contenedor standalone del frontend.

**Características:**
- Sirve archivos desde `/usr/share/nginx/html`
- SPA routing con `try_files`
- Compresión Gzip habilitada
- Headers de seguridad
- Cache para assets estáticos
- Proxy al backend (apunta a servicio `backend:8000`)

**Uso:** Se copia en `Dockerfile.frontend`

### supervisord.conf
Configuración de Supervisor para manejar múltiples procesos en un contenedor.

**Características:**
- Maneja Nginx y Backend simultáneamente
- Auto-restart de procesos
- Logs separados por proceso
- Ejecuta como root (para Nginx)

**Uso:** Se copia en `Dockerfile` principal

## 🚀 Uso

### Opción 1: Docker Compose (Desarrollo)

```bash
# Desde el directorio raíz del proyecto
docker-compose up -d
```

Esto levanta:
- PostgreSQL (puerto 5432)
- Backend (puerto 8000)
- Frontend (puerto 80)

### Opción 2: Docker Individual (Producción)

```bash
# Build del contenedor completo
docker build -t littlefounders .

# Run
docker run -p 80:80 -p 8000:8000 \
  -e DATABASE_URL="postgresql://..." \
  -e SECRET_KEY="..." \
  littlefounders
```

### Opción 3: Contenedores Separados

```bash
# Build frontend
docker build -t littlefounders-frontend -f Dockerfile.frontend .

# Build backend
docker build -t littlefounders-backend -f Dockerfile.backend .

# Run backend
docker run -d -p 8000:8000 \
  -e DATABASE_URL="..." \
  littlefounders-backend

# Run frontend
docker run -d -p 80:80 littlefounders-frontend
```

## 🔧 Personalización

### Modificar Nginx

Para cambiar la configuración de Nginx:

1. Edita `nginx.conf` o `nginx-frontend.conf`
2. Rebuild el contenedor:
   ```bash
   docker build -t littlefounders .
   ```
3. Reinicia el contenedor:
   ```bash
   docker restart container-name
   ```

### Verificar Configuración

```bash
# Dentro del contenedor
docker exec -it container-name nginx -t

# Ver logs de Nginx
docker exec -it container-name tail -f /var/log/nginx/error.log
```

### Modificar Supervisor

Para cambiar procesos manejados:

1. Edita `supervisord.conf`
2. Agrega nuevas secciones `[program:nombre]`
3. Rebuild y restart

## 📊 Logs

### Ver logs de todos los procesos

```bash
# Logs de Docker Compose
docker-compose logs -f

# Logs de un servicio específico
docker-compose logs -f backend
docker-compose logs -f frontend

# Logs dentro del contenedor
docker exec -it container-name tail -f /var/log/supervisor/supervisord.log
```

### Ubicación de logs

En contenedores:
- Supervisor: `/var/log/supervisor/`
- Nginx: `/var/log/nginx/`
- Backend: stdout (capturado por Supervisor)

## 🐛 Troubleshooting

### Nginx no inicia

```bash
# Verificar sintaxis
docker exec -it container-name nginx -t

# Ver logs
docker exec -it container-name cat /var/log/nginx/error.log
```

### Backend no responde

```bash
# Verificar que está corriendo
docker exec -it container-name ps aux | grep uvicorn

# Ver logs
docker exec -it container-name tail -f /var/log/supervisor/backend_stdout.log
```

### Puerto ya en uso

```bash
# Cambiar puerto en docker-compose.yml o comando docker run
# Frontend
ports:
  - "8080:80"  # Usar puerto 8080 en host

# Backend
ports:
  - "8001:8000"  # Usar puerto 8001 en host
```

## 🔒 Seguridad

### Headers de Seguridad

Los archivos de Nginx ya incluyen:
- `X-Frame-Options: SAMEORIGIN`
- `X-Content-Type-Options: nosniff`
- `X-XSS-Protection: 1; mode=block`

### HTTPS

Para producción, agrega:

```nginx
# En nginx.conf o nginx-frontend.conf
server {
    listen 443 ssl;
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    # ... resto de configuración
}
```

## 📚 Referencias

- [Nginx Documentation](https://nginx.org/en/docs/)
- [Supervisor Documentation](http://supervisord.org/)
- [Docker Best Practices](https://docs.docker.com/develop/dev-best-practices/)

