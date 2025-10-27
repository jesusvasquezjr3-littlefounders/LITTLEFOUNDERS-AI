# 🚀 Inicio Rápido - Cloudflare Tunnel

## Para empezar EN 2 MINUTOS:

### Opción 1: Docker (Recomendado)

1. **Inicia la aplicación completa:**
   ```bash
   docker-compose up -d
   ```

2. **Ejecuta el script de túnel:**
   ```bash
   start-tunnel-quick.bat
   ```
   
   O manualmente:
   ```bash
   .\cloudflared-windows-amd64.exe tunnel --url http://localhost:80
   ```

3. **¡Listo!** Copia la URL que aparece (ejemplo: `https://random-name.trycloudflare.com`)

---

### Opción 2: Desarrollo (Sin Docker)

1. **Inicia el backend:**
   ```bash
   cd backend
   python main.py
   ```

2. **Inicia el frontend** (en otra terminal):
   ```bash
   npm run dev
   ```

3. **Ejecuta el túnel para el frontend:**
   ```bash
   start-tunnel-dev.bat
   ```

4. **Copia la URL de Cloudflare**

---

## Scripts Disponibles

| Script | Descripción |
|--------|-------------|
| `start-tunnel-quick.bat` | Túnel para Docker (puerto 80) |
| `start-tunnel-dev.bat` | Túnel para desarrollo (puerto 5173) |
| `start-tunnel-backend.bat` | Túnel solo para backend (puerto 8000) |
| `start-all-with-tunnel.bat` | Inicia Docker + Túnel automáticamente |

---

## Importante: Configurar CORS

Si vas a usar el túnel, necesitas actualizar el backend para aceptar peticiones de la URL de Cloudflare.

**Edita `backend/config.py`** y agrega tu URL de Cloudflare:

```python
cors_origins = [
    "http://localhost:5173",
    "http://localhost:80",
    "https://tu-url-cloudflare.trycloudflare.com",  # 👈 Agrega esta
]
```

Luego reinicia el backend.

---

## Solución Rápida de Problemas

### ❌ Error: "connection refused"
✅ Verifica que tu aplicación esté corriendo primero (docker-compose o npm run dev)

### ❌ El frontend no se conecta al backend
✅ Actualiza las configuraciones de CORS (ver arriba)
✅ Asegúrate de que el backend también esté expuesto o accesible

### ❌ "Failed to find a suitable IP address"
✅ Verifica que el puerto esté correcto (80 para Docker, 5173 para dev)

---

## Siguiente Nivel: Túnel Permanente

Si quieres una URL fija (no cambia cada vez):

1. **Autentica Cloudflare:**
   ```bash
   .\cloudflared-windows-amd64.exe login
   ```

2. **Crea un túnel:**
   ```bash
   .\cloudflared-windows-amd64.exe tunnel create littlefounders
   ```

3. **Copia `cloudflare-config.example.yml` a `cloudflare-config.yml`**

4. **Edita `cloudflare-config.yml`** con tu TUNNEL-ID

5. **Configura DNS** en el panel de Cloudflare

6. **Inicia el túnel:**
   ```bash
   .\cloudflared-windows-amd64.exe tunnel --config cloudflare-config.yml run littlefounders
   ```

📚 Para más detalles, consulta `CLOUDFLARE_TUNNEL_GUIDE.md`

---

## ¿Necesitas Ayuda?

- Documentación completa: `CLOUDFLARE_TUNNEL_GUIDE.md`
- Configuración de ejemplo: `cloudflare-config.example.yml`
- Documentación oficial: https://developers.cloudflare.com/cloudflare-one/

---

**¡Disfruta compartiendo tu aplicación! 🎉**

