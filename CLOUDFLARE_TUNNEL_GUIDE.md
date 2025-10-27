# Guía de Cloudflare Tunnel para LittleFounders

## ¿Qué es Cloudflare Tunnel?

Cloudflare Tunnel te permite exponer tu aplicación local a internet de forma segura, sin necesidad de:
- Abrir puertos en tu router
- Tener una IP pública estática
- Configurar reglas de firewall

## Requisitos Previos

✅ Ya tienes `cloudflared-windows-amd64.exe` descargado
✅ Necesitas una cuenta de Cloudflare (gratuita)
✅ Un dominio configurado en Cloudflare (opcional, pero recomendado)

## Opción 1: Túnel Rápido (Sin Dominio) 🚀

Esta es la forma más rápida para pruebas:

### Para el Backend (puerto 8000):
```bash
.\cloudflared-windows-amd64.exe tunnel --url http://localhost:8000
```

### Para el Frontend en desarrollo (puerto 5173):
```bash
.\cloudflared-windows-amd64.exe tunnel --url http://localhost:5173
```

### Para Docker Compose completo (frontend puerto 80):
```bash
.\cloudflared-windows-amd64.exe tunnel --url http://localhost:80
```

**Ventajas**: Instantáneo, no requiere configuración
**Desventajas**: La URL cambia cada vez, formato tipo: `https://random-name.trycloudflare.com`

---

## Opción 2: Túnel Permanente (Con Dominio Propio) ⭐ RECOMENDADO

### Paso 1: Autenticar Cloudflare

```bash
.\cloudflared-windows-amd64.exe login
```

Esto abrirá tu navegador para autorizar la aplicación.

### Paso 2: Crear un Túnel

```bash
.\cloudflared-windows-amd64.exe tunnel create littlefounders
```

Esto creará:
- Un túnel llamado "littlefounders"
- Un archivo de credenciales (guárdalo en lugar seguro)

### Paso 3: Configurar el Túnel

Crea un archivo `cloudflare-config.yml` en la raíz del proyecto:

```yaml
# cloudflare-config.yml
tunnel: <TUNNEL-ID>  # Lo obtienes del paso anterior
credentials-file: C:\Users\Aetio\.cloudflared\<TUNNEL-ID>.json

ingress:
  # Si tienes un dominio, usa tu dominio real
  - hostname: littlefounders.tudominio.com
    service: http://localhost:80
  
  # API en un subdominio
  - hostname: api.tudominio.com
    service: http://localhost:8000
  
  # Regla catch-all (obligatoria)
  - service: http_status:404
```

**IMPORTANTE**: Si NO tienes dominio todavía, puedes usar el túnel rápido mientras tanto.

### Paso 4: Configurar DNS en Cloudflare

Entra a tu panel de Cloudflare y crea registros DNS:

```
Tipo: CNAME
Nombre: littlefounders
Destino: <TUNNEL-ID>.cfargotunnel.com
Proxied: ✅ (naranja)

Tipo: CNAME
Nombre: api
Destino: <TUNNEL-ID>.cfargotunnel.com
Proxied: ✅ (naranja)
```

### Paso 5: Iniciar el Túnel

```bash
.\cloudflared-windows-amd64.exe tunnel --config cloudflare-config.yml run littlefounders
```

---

## Opción 3: Usando Docker Compose 🐳

### Configuración Recomendada para tu Proyecto

1. **Inicia tu stack con Docker Compose:**

```bash
docker-compose up -d
```

Esto iniciará:
- PostgreSQL en puerto 5432
- Backend en puerto 8000
- Frontend en puerto 80

2. **Expón el frontend con Cloudflare:**

```bash
# Para desarrollo rápido (URL temporal)
.\cloudflared-windows-amd64.exe tunnel --url http://localhost:80

# O para túnel permanente (con el config.yml)
.\cloudflared-windows-amd64.exe tunnel --config cloudflare-config.yml run littlefounders
```

---

## Opción 4: Desarrollo Local (Sin Docker) 💻

Si estás desarrollando localmente sin Docker:

### Terminal 1 - Backend:
```bash
cd backend
python main.py
```
(Corre en puerto 8000)

### Terminal 2 - Frontend:
```bash
npm run dev
```
(Corre en puerto 5173 por defecto con Vite)

### Terminal 3 - Túnel Frontend:
```bash
.\cloudflared-windows-amd64.exe tunnel --url http://localhost:5173
```

### Terminal 4 - Túnel Backend (opcional):
```bash
.\cloudflared-windows-amd64.exe tunnel --url http://localhost:8000
```

---

## Configuración de CORS 🔒

**IMPORTANTE**: Cuando uses Cloudflare Tunnel, necesitas actualizar las configuraciones de CORS.

### Actualizar `backend/config.py`:

Asegúrate de incluir tus URLs de Cloudflare en `cors_origins`:

```python
cors_origins = [
    "http://localhost:5173",
    "http://localhost:80",
    "https://tu-url-cloudflare.trycloudflare.com",  # URL temporal
    "https://littlefounders.tudominio.com",  # Tu dominio permanente
]
```

---

## Configuración Múltiple con un Solo Túnel

Si quieres exponer tanto frontend como backend con un solo túnel:

```yaml
# cloudflare-config.yml
tunnel: <TUNNEL-ID>
credentials-file: C:\Users\Aetio\.cloudflared\<TUNNEL-ID>.json

ingress:
  # Frontend en el dominio principal
  - hostname: littlefounders.tudominio.com
    service: http://localhost:80
  
  # Backend API en subdominio
  - hostname: api.littlefounders.tudominio.com
    service: http://localhost:8000
  
  # Catch-all
  - service: http_status:404
```

---

## Scripts Útiles

Puedes crear archivos `.bat` para facilitar el inicio:

### `start-tunnel.bat`
```batch
@echo off
echo Iniciando Cloudflare Tunnel...
.\cloudflared-windows-amd64.exe tunnel --url http://localhost:80
pause
```

### `start-tunnel-dev.bat`
```batch
@echo off
echo Iniciando Cloudflare Tunnel para desarrollo...
.\cloudflared-windows-amd64.exe tunnel --url http://localhost:5173
pause
```

### `start-tunnel-permanent.bat`
```batch
@echo off
echo Iniciando Cloudflare Tunnel permanente...
.\cloudflared-windows-amd64.exe tunnel --config cloudflare-config.yml run littlefounders
pause
```

---

## Solución de Problemas

### Error: "Connection refused"
- Verifica que tu aplicación esté corriendo en el puerto correcto
- Usa `http://localhost` no `http://127.0.0.1`

### Error: "failed to sufficiently increase receive buffer size"
- Esto es solo una advertencia, puedes ignorarla en Windows

### El frontend no puede conectarse al backend:
- Actualiza las configuraciones de CORS
- Verifica que estés usando las URLs correctas de Cloudflare
- Revisa la configuración de la API URL en tu frontend

### Túnel se cierra automáticamente:
- No cierres la ventana de comando donde corre `cloudflared`
- Considera ejecutarlo como servicio de Windows para que sea permanente

---

## Ejecutar como Servicio de Windows (Avanzado)

Para que el túnel se ejecute automáticamente al iniciar Windows:

```bash
.\cloudflared-windows-amd64.exe service install
.\cloudflared-windows-amd64.exe service start
```

---

## Recomendaciones de Seguridad

1. ✅ **No expongas la base de datos (puerto 5432)** - Solo frontend y backend
2. ✅ **Usa HTTPS** - Cloudflare lo proporciona automáticamente
3. ✅ **Configura variables de entorno** - No uses contraseñas por defecto en producción
4. ✅ **Actualiza CORS** - Solo permite tus dominios específicos
5. ✅ **Monitorea el tráfico** - Usa el dashboard de Cloudflare

---

## Comandos Útiles

```bash
# Listar túneles existentes
.\cloudflared-windows-amd64.exe tunnel list

# Ver información de un túnel
.\cloudflared-windows-amd64.exe tunnel info littlefounders

# Eliminar un túnel
.\cloudflared-windows-amd64.exe tunnel delete littlefounders

# Ver rutas configuradas
.\cloudflared-windows-amd64.exe tunnel route dns

# Probar conectividad
.\cloudflared-windows-amd64.exe tunnel run littlefounders --loglevel debug
```

---

## Para Empezar AHORA (Lo Más Rápido) 🎯

**Si solo quieres probar rápidamente:**

1. Abre una terminal en la raíz del proyecto
2. Ejecuta:
   ```bash
   docker-compose up -d
   ```
3. En otra terminal:
   ```bash
   .\cloudflared-windows-amd64.exe tunnel --url http://localhost:80
   ```
4. Copia la URL que te da (ej: `https://random-name.trycloudflare.com`)
5. ¡Compártela con quien quieras!

**La URL funcionará mientras mantengas ambos comandos corriendo.**

---

## Próximos Pasos

Una vez que confirmes que funciona:
1. Considera obtener un dominio propio
2. Configura un túnel permanente
3. Instálalo como servicio de Windows
4. Configura monitoreo y analytics en Cloudflare

¿Necesitas ayuda con algún paso específico?

