# 🚩 LittleFounders Reports System (Backend)

Esta carpeta contiene la implementación del motor de reportes, quejas y sugerencias de la plataforma LittleFounders. El sistema está diseñado para ser seguro, escalable y fácil de administrar.

## 🏗️ Arquitectura y Flujo de Datos

El sistema sigue un flujo desacoplado que permite a cualquier usuario (autenticado o no) enviar reportes desde cualquier parte de la aplicación.

### 🔄 Flujo General
1. **Frontend:** El componente `ReportFAB` y `ReportModal` capturan los datos del usuario.
2. **API (FastAPI):** El endpoint `/reports/` recibe la carga, valida la integridad y enriquece los metadatos.
3. **Database (Postgres/Supabase):** Se almacena el registro en la tabla `platform_reports`.
4. **Admin Panel:** Los administradores gestionan los reportes a través de una interfaz dedicada que consume endpoints protegidos.

---

## 🔒 Seguridad y Robustez (Critical Paths)

Para evitar abusos y proteger la integridad del sistema, se han implementado varias capas de seguridad:

### 1. Control de Tasa (Rate Limiting)
Utilizamos `slowapi` para prevenir ataques de spam y denegación de servicio (DoS):
- **IP-Based:** Máximo 5 reportes por minuto por dirección IP.
- **User-Based:** Si el usuario está autenticado, se aplica un límite adicional de 3 reportes por minuto por `user_id`.

### 2. Validación de Evidencia (Anti-Injection)
El sistema permite adjuntar evidencia (imágenes/videos). Para prevenir inyección de enlaces maliciosos o SSRF:
- Solo se aceptan URLs que pertenezcan al dominio oficial de **Supabase** configurado en el proyecto.
- Se permiten adjuntos locales temporales con el prefijo `[attached:]`.

### 3. Captura Automática de Metadatos
Cada reporte captura automáticamente información técnica del cliente para facilitar la depuración:
- **User Agent:** Navegador y OS del informante.
- **IP Address:** Para rastreo de abusos.
- **Contexto:** URL exacta donde se originó el reporte.

---

## 📊 Estructura de Datos (Modelos)

### Tabla: `platform_reports`
| Campo | Tipo | Descripción |
| :--- | :--- | :--- |
| `id` | SERIAL | Identificador único. |
| `user_id` | INT (FK) | ID del usuario si estaba logueado. |
| `reporter_email` | VARCHAR | Email de contacto proporcionado. |
| `report_type` | ENUM | `bug`, `abuse`, `suggestion`, `content`, `other`. |
| `subject` | TEXT | Título o asunto del reporte. |
| `context` | TEXT | Descripción detallada del problema. |
| `evidence_url` | TEXT | Enlace seguro a la evidencia (Supabase). |
| `report_metadata` | JSONB | Datos técnicos (browser, OS, lang, ip). |
| `status` | ENUM | `pending`, `in_review`, `resolved`, `closed`. |
| `priority` | ENUM | `low`, `medium`, `high`, `critical`. |
| `admin_notes` | TEXT | Notas internas para revisión administrativa. |

---

## 🚀 Endpoints de la API

### Públicos (No requieren Auth)
- `POST /reports/`: Crea un nuevo reporte.
  - *Opcional:* Si se envía el header `Authorization`, se vincula el `user_id`.

### Privados (Solo Administradores)
- `GET /reports/`: Lista reportes con soporte de paginación y filtros (`status`, `type`).
- `GET /reports/stats`: Retorna conteos agregados por estado y tipo para el Dashboard.
- `GET /reports/{id}`: Detalle completo de un reporte específico.
- `PATCH /reports/{id}`: Actualiza el estado, prioridad o agrega notas administrativas.

---

## 🛠️ Notas para Desarrolladores

### Agregar un nuevo tipo de reporte
1. Actualiza el enum en `database.sql`.
2. Actualiza la validación en `reports/schemas.py` (`ReportCreate.validate_type`).
3. Actualiza el objeto `stats_data` en `reports/endpoints.py` para incluir el nuevo tipo en los conteos.

### Depuración de Errores Comunes
- **HTTP 429:** Límite de reportes alcanzado. Espera un minuto.
- **HTTP 400 (URL no válida):** Ocurre si `evidence_url` no coincide con el dominio de Supabase. Revisa las variables de entorno `VITE_SUPABASE_URL`.
- **UndefinedColumn (report_metadata):** Asegúrate de haber corrido la migración que renombra la columna `metadata` a `report_metadata`.

---
*Documentación generada para el equipo de LittleFounders.*
