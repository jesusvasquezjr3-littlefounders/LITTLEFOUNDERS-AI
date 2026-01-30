# Guía de Despliegue en Vercel - LittleFounders

Esta guía detalla los pasos para desplegar exitosamente el proyecto **LittleFounders** en Vercel, utilizando Supabase como base de datos.

## Estructura del Proyecto
El proyecto está configurado como un "monorepo" simple que contiene tanto el Frontend (React/Vite) como el Backend (FastAPI/Python) en el mismo repositorio.
- **Frontend**: Carpeta `frontend/`
- **Backend**: Carpeta `backend/`
- **Configuración**: Archivo `vercel.json` en la raíz que orquesta el enrutamiento.

## Prerrequisitos
1.  Cuenta en [Vercel](https://vercel.com).
2.  Cuenta en [GitHub](https://github.com) con el código subido.
3.  Proyecto en [Supabase](https://supabase.com) configurado (Base de datos migrada).

## Pasos para Desplegar

### 1. Preparación en GitHub
Asegúrate de que tu código esté actualizado en el repositorio de GitHub:
- El archivo `vercel.json` debe estar en la raíz.
- El archivo `package.json` debe estar en la raíz (creado por el agente para corregir el error de build).
- La carpeta `backend/` no debe contener archivos `.env` (credenciales).
- La carpeta `docker/` y archivos de AWS deben haber sido eliminados (esto ya fue realizado por el agente).

### 2. Importar Proyecto en Vercel
1.  Ve a tu Dashboard de Vercel y haz clic en **"Add New..."** -> **"Project"**.
2.  Importa tu repositorio de GitHub `LITTLEFOUNDERS-AI`.
3.  **Configuración del Proyecto**:
    - **Framework Preset**: Déjalo en `Vite` o `Other` (Vercel detectará el `vercel.json`).
    - **Root Directory**: Déjalo en `./` (la raíz del repositorio). **IMPORTANTE**: No selecciones `frontend` o `backend`, usa la raíz.

    - CRITICAL STEP FOR YOU: When you import the project in Vercel (or in your Project Settings if already imported):

        1. Find Output Directory.
        2. Set it to explicitly override: `frontend/dist`.
    
    This is the only way to tell Vercel where the built files are located when using a custom build script. Please make this change in the Vercel Dashboard and then Push to GitHub again.


### 3. Variables de Entorno (Environment Variables)
En la sección de configuración "Environment Variables" en Vercel, debes agregar las mismas variables que definiste en tu `.env` local para el backend. Copia los valores desde tu configuración de Supabase:

| Clave | Valor (Ejemplo) |
|-------|-----------------|
| `DATABASE_HOSTNAME` | `db.gkf...supabase.co` |
| `DATABASE_PORT` | `5432` |
| `DATABASE_NAME` | `postgres` |
| `DATABASE_USERNAME` | `postgres` |
| `DATABASE_PASSWORD` | `TuContraseñaSegura` |
| `SECRET_KEY` | `GeneraUnaClaveLargaYSegura` |
| `ALGORITHM` | `HS256` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `30` |

**Nota**: No es necesario incluir las variables de correo (`MAIL_...`) si no vas a enviar emails en este momento, pero es recomendable configurarlas si tienes un servidor SMTP.

### 4. Despliegue
Haz clic en **"Deploy"**.
Vercel comenzará a construir el proyecto:
- Instalará las dependencias de Python para el backend (detectado por `backend/requirements.txt` y `api/` rewrites).
- Construirá el frontend de React.

### 5. Verificar Funcionamiento
Una vez desplegado, Vercel te dará una URL (ej. `littlefounders-ai.vercel.app`).
- **Frontend**: Navega a la URL principal.
- **Backend**: Puedes probar `/api/` o `/api/docs` para ver la documentación automática de FastAPI.

## Solución de Problemas Comunes

**Error 404 en /api/**:
- Verifica que el archivo `vercel.json` exista en la raíz con la configuración `rewrites`.

**Error de Conexión a Base de Datos**:
- Verifica las "Environment Variables" en Vercel. Asegúrate de que la contraseña no tenga espacios extra.
- Asegúrate de que la base de datos en Supabase permita conexiones desde cualquier IP (0.0.0.0/0) o configura el pooler de Supabase.

**Error de "Internal Server Error" en Login**:
- Revisa los "Logs" en el dashboard de Vercel (pestaña "Functions").
- Confirma que eliminamos el código legacy de `backend/main.py` que intentaba escribir en `users.txt` (esto ya fue realizado por el agente).
