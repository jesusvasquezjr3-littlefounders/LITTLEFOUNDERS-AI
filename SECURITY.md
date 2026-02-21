# 🔒 SECURITY.md — LittleFounders

> Última actualización: 2026-02-20

## Arquitectura de Seguridad

### Autenticación
- **Sistema**: JWT propio via FastAPI (`python-jose` + `bcrypt`)
- **Proveedores OAuth**: Google (implicit flow), Discord (authorization code flow)
- **Tokens**: HS256, expiración configurable (default: 30 min)
- **Passwords**: BCrypt hash con salt automático

### Autorización
- **RLS (Row-Level Security)**: Habilitado en **todas** las tablas públicas con políticas deny-all
- **GRANTs revocados**: `anon` y `authenticated` no tienen permisos directos en ninguna tabla
- **Admin**: Protegido con dependency `require_admin` en todos los endpoints
- **Familia**: Sistema de permisos basado en `verify_family_access`

### Protección de IDs
- **UUIDs públicos**: Los usuarios se identifican externamente con `public_id` (UUID v4)
- **IDs internos**: Secuenciales (`integer`), usados solo en JOINs internos del backend
- **Previene**: IDOR (Insecure Direct Object Reference), enumeración de usuarios

### Rate Limiting
- **Librería**: `slowapi` (basado en `limits`)
- **Límite global**: 60 requests/minuto por IP
- **Auth endpoints**: Todos inyectan `Request` para soporte de rate limiting

### CORS
- **Whitelist estricta**: Solo dominios autorizados
  - `https://littlefounders.ai`
  - `https://www.littlefounders.ai`
  - `https://littlefounders-ai.vercel.app`
  - `http://localhost:*` (desarrollo local)
- **Métodos**: Solo `GET`, `POST`, `PUT`, `DELETE`, `PATCH`, `OPTIONS`

---

## Advertencias Conocidas (No Críticas)

### `Cross-Origin-Opener-Policy would block window.closed`
- **Origen**: SDK de Google OAuth (popup flow)
- **Riesgo**: ⚪ Ninguno — es un warning del navegador, no un error
- **Causa**: Google intenta verificar si el popup se cerró, pero COOP lo bloquea
- **Acción**: Ya se maneja con `Cross-Origin-Opener-Policy: unsafe-none` en rutas `/auth/`
- **Referencia**: [Chrome COOP docs](https://developer.chrome.com/docs/privacy-security/coop-coep/)

### `console.log` del access_token de Google
- **Origen**: `Login.tsx:187` hace `console.log` del response de Google
- **Riesgo**: 🟡 Bajo — solo visible en DevTools del navegador del propio usuario
- **Acción recomendada**: Eliminar el `console.log` antes de producción
- **Nota**: El `access_token` de Google es de corta duración (1 hora) y solo se usa para obtener el perfil

### `function_search_path_mutable`
- **Estado**: ✅ Resuelto — ambas funciones (`update_updated_at_column`, `upgrade_user_role`) tienen `SET search_path = public`

---

## Checklist de Despliegue

- [ ] Actualizar `CORS_ORIGINS` en Vercel Dashboard (sin localhost)
- [ ] Verificar que `SECRET_KEY` no sea `your_secret_key_here` en producción
- [ ] Eliminar `console.log` de tokens en `Login.tsx`
- [ ] Rotar `SUPABASE_SERVICE_KEY` si fue expuesto en algún commit
- [ ] Configurar HTTPS (forzado por Vercel automáticamente)

---

## Contacto de Seguridad

Para reportar vulnerabilidades: security@littlefounders.ai
