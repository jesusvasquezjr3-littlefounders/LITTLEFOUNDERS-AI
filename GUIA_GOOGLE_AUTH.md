# Guía de Implementación: Autenticación con Google

Este documento describe la arquitectura, configuración y detalles técnicos de la integración de Google Sign-In en LittleFounders.

## 1. Arquitectura de Autenticación

Utilizamos un flujo basado en token de acceso (Implicit Flow / Access Token) verificado por el backend.

1.  **Frontend (@react-oauth/google)**:
    -   El usuario hace clic en el botón de Google.
    -   Se solicita el scope `email profile`.
    -   Google devuelve un `access_token` al frontend.
2.  **Comunicación Cliente-Servidor**:
    -   El frontend envía este `access_token` al endpoint `POST /auth/google`.
3.  **Backend (FastAPI)**:
    -   Recibe el token.
    -   Verifica la validez y obtiene los datos del usuario consultando directamente a la API de Google (`https://www.googleapis.com/oauth2/v3/userinfo`).
    -   **Login:** Si el email ya existe en la base de datos, inicia sesión.
    -   **Registro:** Si el email no existe, crea un nuevo usuario tipo `UNIVERSAL` automáticamente.
    -   Devuelve un JWT propio de la aplicación (igual que el login tradicional).

## 2. Configuración Requerida

### Google Cloud Console
-   **Proyecto**: `LittleFounders` (o tu proyecto en GCP).
-   **Tipo de Cliente**: Web Application.
-   **Orígenes Autorizados**:
    -   Dev: `http://localhost:5173`
    -   Prod: `https://littlefounders.ai`
-   **Redirecciones Autorizadas**: Igual que los orígenes.

### Variables de Entorno
**Frontend (`frontend/.env`)**:
```env
VITE_GOOGLE_CLIENT_ID=tu-client-id-de-google.apps.googleusercontent.com
```

**Backend (`backend/.env`)**:
No requiere variables específicas de Google ya que la verificación se hace vía petición HTTP directa, pero se recomienda validar el `Audience` si se desea mayor seguridad estricta en el futuro.

## 3. Cambios en Base de Datos

Se modificó la tabla `users` para soportar autenticación externa:

```sql
ALTER TABLE users ADD COLUMN auth_provider VARCHAR(20) DEFAULT 'email'; -- 'email' o 'google'
ALTER TABLE users ADD COLUMN google_id VARCHAR(100) UNIQUE;
```

## 4. Estructura de Código

### Frontend
-   **`src/main.tsx`**: Envuelve la app con `<GoogleOAuthProvider>`.
-   **`src/pages/Login.tsx` y `Register.tsx`**:
    -   Usa el hook `useGoogleLogin` para manejar el popup.
    -   Envía el token al backend y maneja la respuesta (guardado de token/user en localStorage).

### Backend
-   **`models.py`**: Modelo `User` actualizado con los nuevos campos.
-   **`auth/schemas.py`**: Esquema `GoogleLoginRequest` (recibe `{ token: str }`).
-   **`auth/endpoints.py`**:
    -   Endpoint `google_login`: Lógica central de verificación y creación de usuario.
    -   Librería usada: `requests` para validar contra Google UserInfo API.

## 5. Solución de Problemas Comunes

-   **Error 400: redirect_uri_mismatch**: Falta agregar la URL (localhost o dominio) en la consola de Google Cloud.
-   **Pantalla en blanco al iniciar**: Falta la variable `VITE_GOOGLE_CLIENT_ID` en el frontend.
-   **Error 500 en Login**: Verificar que la base de datos tenga las columnas `auth_provider` y `google_id`.
