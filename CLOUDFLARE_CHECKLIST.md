# ✅ Checklist: Cloudflare Tunnel para LittleFounders

## 🎯 Objetivo
Exponer tu aplicación LittleFounders localmente para que sea accesible desde internet.

---

## 📋 Checklist de Inicio Rápido (5 minutos)

### Opción A: Con Docker (Recomendado)

- [ ] **1. Verifica que tengas Docker Desktop instalado y corriendo**
  ```bash
  docker --version
  ```

- [ ] **2. Inicia la aplicación con Docker Compose**
  ```bash
  docker-compose up -d
  ```
  *Espera 10-15 segundos para que todo inicie*

- [ ] **3. Verifica que la aplicación funcione localmente**
  - Abre http://localhost:80 en tu navegador
  - Debería cargar LittleFounders

- [ ] **4. Inicia Cloudflare Tunnel**
  - Opción fácil: Doble clic en `start-all-with-tunnel.bat`
  - O manualmente:
    ```bash
    .\cloudflared-windows-amd64.exe tunnel --url http://localhost:80
    ```

- [ ] **5. Copia la URL que aparece**
  ```
  ┌───────────────────────────────────────────────┐
  │  Your quick Tunnel has been created!         │
  │  https://random-name-123.trycloudflare.com   │ 👈 COPIA ESTA URL
  └───────────────────────────────────────────────┘
  ```

- [ ] **6. Prueba la URL en otro dispositivo o navegador**
  - Pégala en tu móvil o en modo incógnito
  - Debería cargar la aplicación

---

### Opción B: Sin Docker (Desarrollo)

- [ ] **1. Inicia el backend**
  ```bash
  cd backend
  python main.py
  ```
  *Mantén esta terminal abierta*

- [ ] **2. Inicia el frontend** (en otra terminal)
  ```bash
  npm run dev
  ```
  *Mantén esta terminal abierta*

- [ ] **3. Verifica que funcione localmente**
  - Abre http://localhost:5173
  - Debería cargar LittleFounders

- [ ] **4. Inicia Cloudflare Tunnel** (en otra terminal)
  - Opción fácil: Doble clic en `start-tunnel-dev.bat`
  - O manualmente:
    ```bash
    .\cloudflared-windows-amd64.exe tunnel --url http://localhost:5173
    ```

- [ ] **5. Copia la URL de Cloudflare**

- [ ] **6. Prueba la URL**

---

## ⚠️ Si Encuentras Errores de CORS

Si la página carga pero ves errores en la consola del navegador sobre CORS:

- [ ] **1. Identifica tu URL de Cloudflare**
  ```
  Ejemplo: https://abc-def-123.trycloudflare.com
  ```

- [ ] **2. Edita `backend/config.py`**
  
  Cambia esta línea:
  ```python
  cors_origins: list[str] = ["*"]
  ```
  
  Por esto:
  ```python
  cors_origins: list[str] = [
      "http://localhost:5173",
      "http://localhost:80",
      "https://abc-def-123.trycloudflare.com",  # 👈 Tu URL aquí
  ]
  ```

- [ ] **3. Reinicia el backend**
  
  Si usas Docker:
  ```bash
  docker-compose restart backend
  ```
  
  Si lo corres manualmente:
  - Presiona `Ctrl+C` en la terminal del backend
  - Vuelve a ejecutar: `python main.py`

- [ ] **4. Prueba de nuevo**
  - Recarga la página de Cloudflare
  - Debería funcionar correctamente

---

## 🔍 Verificación de Funcionamiento

Marca cuando compruebes cada punto:

- [ ] **La aplicación carga correctamente**
- [ ] **Puedes navegar por las páginas**
- [ ] **No hay errores en la consola del navegador** (F12)
- [ ] **Puedes hacer login** (si aplica)
- [ ] **La API responde correctamente**

---

## 📱 Prueba Desde Otros Dispositivos

- [ ] **Desde tu móvil** (usando datos móviles, no WiFi)
- [ ] **Desde otra computadora**
- [ ] **Desde navegador en modo incógnito**
- [ ] **Comparte la URL con un amigo/colega**

---

## 🛑 Detener Todo

Cuando termines de probar:

### Si usaste Docker:

- [ ] **1. Detén Cloudflare Tunnel**
  - Presiona `Ctrl+C` en la terminal del túnel

- [ ] **2. Detén Docker Compose**
  ```bash
  docker-compose down
  ```

### Si usaste desarrollo manual:

- [ ] **1. Detén Cloudflare Tunnel**
  - Presiona `Ctrl+C` en la terminal del túnel

- [ ] **2. Detén el frontend**
  - Presiona `Ctrl+C` en la terminal de npm

- [ ] **3. Detén el backend**
  - Presiona `Ctrl+C` en la terminal de Python

---

## 🚀 Próximos Pasos (Opcional)

Si quieres llevar esto al siguiente nivel:

- [ ] **Crear cuenta en Cloudflare** (si no tienes)
  - https://dash.cloudflare.com/sign-up

- [ ] **Autenticar cloudflared**
  ```bash
  .\cloudflared-windows-amd64.exe login
  ```

- [ ] **Crear un túnel permanente**
  ```bash
  .\cloudflared-windows-amd64.exe tunnel create littlefounders
  ```

- [ ] **Obtener un dominio** (opcional)
  - Puedes usar uno existente o comprar uno nuevo
  - Agregarlo a Cloudflare

- [ ] **Configurar DNS** en Cloudflare dashboard

- [ ] **Crear archivo de configuración**
  - Copiar `cloudflare-config.example.yml` a `cloudflare-config.yml`
  - Editar con tus valores

- [ ] **Instalar como servicio de Windows** (para que corra siempre)
  ```bash
  .\cloudflared-windows-amd64.exe service install
  ```

📖 **Ver `CLOUDFLARE_TUNNEL_GUIDE.md` para instrucciones detalladas**

---

## 🆘 Troubleshooting Rápido

| Problema | Solución Rápida |
|----------|----------------|
| "Connection refused" | Verifica que la app esté corriendo (docker-compose ps) |
| "CORS error" | Actualiza `backend/config.py` con tu URL de Cloudflare |
| Túnel se cierra solo | No cierres la terminal donde corre cloudflared |
| "Port already in use" | Detén otros servicios en ese puerto o usa otro |
| Frontend carga pero API no funciona | Verifica CORS y que el backend esté corriendo |

---

## ✨ ¡Éxito!

Si marcaste todos los puntos de "Verificación de Funcionamiento", ¡felicitaciones! 🎉

Tu aplicación LittleFounders está ahora accesible desde internet de forma segura.

**Recuerda**:
- ⏰ Los túneles temporales cambian de URL cada vez
- 🔒 Para producción, considera un túnel permanente
- 🛡️ Actualiza las configuraciones de seguridad antes de lanzar
- 💾 Haz backups regulares de tu base de datos

---

## 📞 Ayuda Adicional

- **Guía completa**: `CLOUDFLARE_TUNNEL_GUIDE.md`
- **Inicio rápido**: `QUICK_START_CLOUDFLARE.md`
- **Configuración CORS**: `CORS_CLOUDFLARE_CONFIG.md`
- **Resumen general**: `CLOUDFLARE_TUNNEL_README.md`

---

**¡Buena suerte con tu proyecto LittleFounders! 🚀**

