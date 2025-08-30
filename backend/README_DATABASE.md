# Configuración de Base de Datos PostgreSQL - LittleFounders

## Descripción General

Este backend está configurado para usar PostgreSQL en Google Cloud Platform (GCP) con SQLAlchemy y Alembic para migraciones.

## Estructura de Base de Datos

### Tablas Principales

#### 1. `users` - Usuarios del Sistema
- **id**: Identificador único (string)
- **name**: Nombre completo
- **email**: Email único
- **password**: Contraseña hasheada
- **user_type**: Tipo de usuario (TUTOR, CHILD, SPONSOR)
- **birth_date**: Fecha de nacimiento
- **gender**: Género (MASCULINO, FEMENINO, OTRO)
- **created_at**: Fecha de creación
- **tutor_email**: Email del tutor (para niños)
- **child_email**: Email del niño (para patrocinadores)
- **lessons_completed**: Lecciones completadas (para niños)
- **minutes_studied**: Minutos estudiados (para niños)
- **points_earned**: Puntos ganados (para niños)

#### 2. `tasks` - Sistema de Tareas
- **id**: Identificador único
- **title**: Título de la tarea
- **description**: Descripción detallada
- **category**: Categoría (CHORES, EDUCATION, SOCIAL, BONUS)
- **difficulty**: Dificultad (EASY, MEDIUM, HARD)
- **reward**: Recompensa monetaria
- **time_estimate**: Tiempo estimado en minutos
- **due_date**: Fecha límite (opcional)
- **is_important**: Marca de prioridad alta
- **status**: Estado (ASSIGNED, PENDING, COMPLETED, REJECTED)
- **created_at**: Fecha de creación
- **completed_at**: Fecha de completado
- **approved_at**: Fecha de aprobación
- **assigned_by_id**: ID del usuario que asigna
- **assigned_to_id**: ID del usuario asignado
- **notes**: Comentarios de aprobación/rechazo
- **photo_evidence_url**: URL de foto de evidencia
- **original_task_id**: ID de tarea original (para reasignaciones)

#### 3. `task_history` - Historial de Tareas
- **id**: Identificador único
- **task_id**: ID de la tarea
- **action**: Acción realizada (created, completed, approved, rejected, reassigned)
- **performed_by_id**: ID del usuario que realizó la acción
- **performed_at**: Fecha de la acción
- **notes**: Notas adicionales

#### 4. `rewards` - Recompensas y Pagos
- **id**: Identificador único
- **task_id**: ID de la tarea
- **child_id**: ID del niño
- **amount**: Cantidad pagada
- **paid_at**: Fecha de pago
- **paid_by_id**: ID del padre/patrocinador que pagó

#### 5. `family_settings` - Configuración Familiar
- **id**: Identificador único
- **tutor_id**: ID del tutor
- **weekly_allowance**: Asignación semanal
- **task_completion_goal**: Meta semanal de tareas
- **auto_approve_photos**: Auto-aprobación con fotos
- **require_photo_evidence**: Requerir evidencia fotográfica

## Configuración de GCP PostgreSQL

### 1. Crear Instancia en Google Cloud SQL
```bash
# Crear instancia de PostgreSQL
gcloud sql instances create littlefounders-db \
    --database-version=POSTGRES_15 \
    --tier=db-f1-micro \
    --region=us-central1 \
    --storage-size=10GB \
    --storage-type=SSD
```

### 2. Crear Base de Datos y Usuario
```sql
-- Conectarse a la instancia
CREATE DATABASE littlefounders_db;
CREATE USER littlefounders_user WITH PASSWORD 'tu_contraseña_segura';
GRANT ALL PRIVILEGES ON DATABASE littlefounders_db TO littlefounders_user;
```

### 3. Configurar Variables de Entorno
Crear archivo `.env` basado en `.env.example`:
```env
DATABASE_URL=postgresql://littlefounders_user:tu_contraseña@IP_PUBLICA:5432/littlefounders_db
SECRET_KEY=tu_clave_secreta_muy_larga
```

### 4. Ejecutar Migraciones
```bash
# Ejecutar migraciones
export PATH="/home/ubuntu/.local/bin:$PATH"
alembic upgrade head
```

## Endpoints API Implementados

### Autenticación
- `POST /auth/register` - Registro de familia completa
- `POST /auth/login` - Login de usuario
- `GET /users/summary` - Resumen de usuarios (debugging)
- `POST /migrate/users` - Migrar usuarios desde users.txt

### Gestión de Tareas
- `POST /tasks` - Crear nueva tarea
- `GET /tasks/assigned-by/{user_id}` - Tareas asignadas por usuario
- `GET /tasks/assigned-to/{user_id}` - Tareas asignadas a usuario
- `GET /tasks/{task_id}` - Obtener tarea específica
- `PUT /tasks/{task_id}` - Actualizar tarea
- `DELETE /tasks/{task_id}` - Eliminar tarea
- `POST /tasks/{task_id}/complete` - Completar tarea (niño)
- `POST /tasks/{task_id}/approve` - Aprobar/rechazar tarea (padre)
- `POST /tasks/{task_id}/reassign` - Reasignar tarea rechazada
- `POST /tasks/{task_id}/upload-photo` - Subir evidencia fotográfica

### Familia y Estadísticas
- `GET /family/children/{tutor_email}` - Niños de un tutor
- `GET /family/child/{sponsor_email}` - Niño patrocinado
- `GET /statistics/{user_id}` - Estadísticas de tareas
- `GET /progress/{child_id}` - Progreso completo del niño

### Configuración Familiar
- `POST /family/settings` - Crear configuración
- `GET /family/settings/{tutor_id}` - Obtener configuración
- `PUT /family/settings/{tutor_id}` - Actualizar configuración

### Recompensas e Historial
- `GET /rewards/{child_id}` - Recompensas de un niño
- `GET /tasks/{task_id}/history` - Historial de una tarea

## Instalación y Configuración

### 1. Instalar Dependencias
```bash
cd backend
pip install --break-system-packages -r requirements.txt
```

### 2. Configurar Variables de Entorno
```bash
cp .env.example .env
# Editar .env con la configuración real de GCP
```

### 3. Ejecutar Migraciones
```bash
export PATH="/home/ubuntu/.local/bin:$PATH"
alembic upgrade head
```

### 4. Ejecutar Servidor
```bash
# Servidor v1 (archivo de texto)
python main.py

# Servidor v2 (PostgreSQL)
python main_v2.py
```

## Migración desde Sistema Anterior

El nuevo sistema incluye un endpoint para migrar automáticamente los usuarios desde el archivo `users.txt` al sistema PostgreSQL:

```bash
curl -X POST http://localhost:8000/migrate/users
```

## Consideraciones de Seguridad

1. **Autenticación JWT**: Para producción, implementar JWT completo
2. **Validación de archivos**: Validación robusta de uploads de fotos
3. **Rate limiting**: Limitar requests por usuario
4. **Encriptación**: Usar bcrypt para passwords en lugar de SHA-256
5. **Autorización**: Verificar permisos en cada endpoint

## Próximos Pasos

1. Configurar instancia PostgreSQL en GCP
2. Actualizar frontend para usar nueva API
3. Implementar sistema de autenticación JWT
4. Agregar sistema de notificaciones
5. Implementar analytics avanzados