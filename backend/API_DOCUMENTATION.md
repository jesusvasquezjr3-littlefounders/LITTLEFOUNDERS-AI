# LittleFounders API - Documentación Completa

## Resumen de Implementación

Se han implementado **todos los módulos** del backend basados en el análisis profundo del frontend, excepto el módulo `growth` (Banca Digital) como se solicitó.

## Arquitectura

### Base de Datos
- **ORM**: SQLAlchemy
- **Base de Datos**: PostgreSQL
- **Migraciones**: Alembic (configurar según necesidad)

### Modelos Implementados

#### Usuarios y Autenticación
- `User`: Usuarios (tutor, child, sponsor)
- Campos: name, email, password_hash, user_type, birth_date, gender, balance, lessons_completed, minutes_studied, points_earned, current_streak

#### Lecciones
- `Lesson`: Lecciones educativas por edad y nivel
- `UserLessonProgress`: Progreso de usuario en cada lección

#### Tareas
- `Task`: Tareas asignadas por padres
- `UserTask`: Estado de completación y aprobación de tareas

#### Ahorros
- `SavingsGoal`: Metas de ahorro
- `Transaction`: Historial de transacciones (ingresos, gastos, depósitos, retiros)

#### Tienda
- `Product`: Productos disponibles en la tienda virtual
- `Purchase`: Historial de compras

#### Logros
- `Achievement`: Logros disponibles
- `UserAchievement`: Logros desbloqueados por usuario

#### Juegos de Inversión
- `GameSession`: Sesiones de juego (Lemonade Stand, etc.)

---

## Endpoints por Módulo

### 1. **Auth** (`/auth`)

#### `POST /auth/register`
Registrar una familia completa (tutor + child + sponsor opcional)
```json
{
  "tutor": {
    "name": "María González",
    "email": "maria@example.com",
    "password": "password123",
    "birth_date": "1985-03-15",
    "gender": "femenino"
  },
  "child": {
    "name": "Carlos González",
    "email": "carlos@example.com",
    "password": "password123",
    "birth_date": "2015-07-22",
    "gender": "masculino"
  },
  "sponsor": null
}
```

#### `POST /auth/login`
Iniciar sesión
```json
{
  "email": "carlos@example.com",
  "password": "password123"
}
```

#### `GET /auth/users`
Obtener todos los usuarios (debug)

---

### 2. **Dashboard** (`/dashboard`)

#### `GET /dashboard/stats/{user_id}`
Obtener estadísticas del usuario (lecciones completadas, puntos, racha, balance)

#### `GET /dashboard/recent-activity/{user_id}`
Obtener actividad reciente (transacciones)

#### `GET /dashboard/pending-tasks/{user_id}`
Obtener tareas pendientes

---

### 3. **Tasks** (`/tasks`)

#### `POST /tasks/`
Crear nueva tarea

#### `GET /tasks/available/{user_id}`
Obtener tareas disponibles para un niño

#### `POST /tasks/complete`
Marcar tarea como completada
```json
{
  "task_id": 1,
  "photo_evidence": "url_to_photo"
}
```

#### `POST /tasks/approve`
Aprobar o rechazar tarea completada (padres)
```json
{
  "user_task_id": 1,
  "is_approved": true
}
```

#### `GET /tasks/completed/{user_id}`
Obtener tareas completadas

#### `DELETE /tasks/{task_id}`
Eliminar tarea

---

### 4. **Parent Tasks** (`/parent-tasks`)

#### `POST /parent-tasks/`
Crear y asignar tarea a un hijo

#### `GET /parent-tasks/children/{parent_id}`
Obtener hijos asociados al padre

#### `GET /parent-tasks/pending-approvals/{parent_id}`
Obtener tareas pendientes de aprobación

#### `GET /parent-tasks/child-tasks/{child_id}`
Obtener todas las tareas de un hijo específico

---

### 5. **Savings** (`/savings`)

#### `POST /savings/goals`
Crear meta de ahorro
```json
{
  "title": "Nueva Bicicleta",
  "description": "Quiero comprar una bicicleta",
  "target_amount": 500.00,
  "deadline": "2025-12-31",
  "image_url": "url_to_image"
}
```

#### `GET /savings/goals/{user_id}`
Obtener metas de ahorro del usuario

#### `PUT /savings/goals/{goal_id}`
Actualizar meta de ahorro

#### `POST /savings/deposit`
Depositar a una meta de ahorro
```json
{
  "user_id": 1,
  "goal_id": 1,
  "amount": 50.00
}
```

#### `POST /savings/withdraw`
Retirar de una meta de ahorro

#### `GET /savings/transactions/{user_id}`
Obtener historial de transacciones

#### `DELETE /savings/goals/{goal_id}`
Eliminar meta de ahorro

---

### 6. **Store** (`/store`)

#### `GET /store/products`
Obtener todos los productos disponibles

#### `GET /store/products/{product_id}`
Obtener producto específico

#### `GET /store/products/category/{category}`
Obtener productos por categoría

#### `POST /store/purchase`
Comprar productos
```json
{
  "items": [
    {
      "product_id": 1,
      "quantity": 2
    }
  ]
}
```

#### `GET /store/purchases/{user_id}`
Obtener historial de compras

#### `POST /store/products`
Crear producto (admin)

#### `PUT /store/products/{product_id}/stock`
Actualizar stock de producto

---

### 7. **Lecciones** (`/lecciones`)

#### `POST /lecciones/`
Crear lección

#### `GET /lecciones/`
Obtener todas las lecciones (filtrable por age_range)

#### `GET /lecciones/{lesson_id}`
Obtener lección específica

#### `GET /lecciones/by-level/{level_id}`
Obtener lecciones por nivel

#### `GET /lecciones/progress/{user_id}`
Obtener progreso del usuario

#### `POST /lecciones/progress/update`
Actualizar progreso en lección
```json
{
  "lesson_id": 1,
  "progress": 50,
  "time_spent": 15
}
```

#### `POST /lecciones/complete`
Completar lección
```json
{
  "lesson_id": 1,
  "time_spent": 30
}
```

#### `GET /lecciones/completed/{user_id}`
Obtener lecciones completadas

---

### 8. **Lecciones V2** (`/lecciones-v2`)

#### `GET /lecciones-v2/`
Obtener lecciones v2 (framework científico)

#### `GET /lecciones-v2/progress/{user_id}`
Obtener progreso v2

#### `POST /lecciones-v2/progress/update`
Actualizar progreso v2

---

### 9. **Investment Games** (`/investment-games`)

#### `POST /investment-games/session`
Crear sesión de juego
```json
{
  "game_type": "lemonade_stand"
}
```

#### `GET /investment-games/session/{user_id}/{game_type}`
Obtener sesión activa

#### `PUT /investment-games/session/{session_id}`
Actualizar sesión de juego
```json
{
  "day_number": 2,
  "cash": 75.50,
  "inventory": {"lemons": 10, "sugar": 5, "cups": 20},
  "score": 150
}
```

#### `POST /investment-games/session/{session_id}/end`
Terminar sesión de juego

#### `GET /investment-games/leaderboard/{game_type}`
Obtener tabla de líderes

#### `GET /investment-games/history/{user_id}`
Obtener historial de juegos

---

## Características Implementadas

### ✅ Sistema de Autenticación
- Registro familiar completo
- Login con JWT tokens
- Hash de contraseñas con bcrypt
- Soporte para 3 tipos de usuario (tutor, child, sponsor)

### ✅ Sistema de Tareas
- Creación y asignación de tareas
- Categorías (chores, education, social, bonus)
- Evidencia fotográfica
- Sistema de aprobación por padres
- Recompensas automáticas

### ✅ Sistema de Ahorros
- Metas de ahorro personalizables
- Depósitos y retiros
- Historial de transacciones completo
- Balance de usuario

### ✅ Tienda Virtual
- Catálogo de productos
- Sistema de compras
- Gestión de inventario
- Historial de compras

### ✅ Sistema de Lecciones
- Lecciones por edad y nivel
- Progreso granular (0-100%)
- Tiempo de estudio tracking
- Sistema de puntos y recompensas
- Estadísticas de usuario

### ✅ Juegos de Inversión
- Sesiones de juego persistentes
- Lemonade Stand implementado
- Sistema de puntuación
- Leaderboards
- Historial de juegos

---

## Próximos Pasos

1. **Configurar Base de Datos**
   - Crear base de datos PostgreSQL
   - Configurar variables de entorno en `.env`
   - Ejecutar migraciones

2. **Testing**
   - Probar cada endpoint
   - Validar lógica de negocio
   - Testing de integración

3. **Seguridad**
   - Implementar middleware de autenticación JWT
   - Validación de permisos por rol
   - Rate limiting

4. **Documentación API**
   - FastAPI genera docs automáticas en `/docs` y `/redoc`

5. **Deploy**
   - Configurar servidor
   - Variables de entorno de producción
   - CI/CD pipeline

---

## Comandos Útiles

```bash
# Instalar dependencias
pip install -r requirements.txt

# Ejecutar servidor de desarrollo
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000

# Acceder a documentación interactiva
http://localhost:8000/docs

# Crear migración
alembic revision --autogenerate -m "descripción"

# Aplicar migraciones
alembic upgrade head
```

---

## Notas Importantes

- **Módulo Growth (Banca Digital)**: No implementado según solicitud
- Todos los demás módulos están completamente implementados
- Los endpoints están listos para integrarse con el frontend
- Se requiere configurar la base de datos PostgreSQL antes de ejecutar

