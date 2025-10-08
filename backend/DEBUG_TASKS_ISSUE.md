# 🔍 Guía de Debugging - Problema de Tareas No Aparecen

## Problema Reportado
Cuando un tutor crea una tarea, no se guarda ni le aparece al niño ni al sponsor.

## Cambios Realizados

### 1. ✅ Corregido Filtro de Tareas
**Archivo:** `backend/tasks/endpoints.py`

**ANTES (❌ Problema):**
```python
Task.created_by.in_(authorized_creators) if authorized_creators else False
```
Este código devuelve `False` (booleano) cuando no hay creadores autorizados, lo que causa errores en SQLAlchemy.

**DESPUÉS (✅ Correcto):**
```python
query = db.query(Task).filter(
    Task.assigned_to == user_id,
    Task.is_active == True
)

if authorized_creators:
    query = query.filter(Task.created_by.in_(authorized_creators))

tasks = query.all()
```

### 2. ✨ Agregados Endpoints de Debug

Se agregaron dos nuevos endpoints para diagnosticar problemas:

#### `/tasks/debug/all-tasks`
Muestra todas las tareas en la base de datos

#### `/tasks/debug/user/{user_id}`
Muestra información de un usuario y sus relaciones familiares

---

## 🧪 Cómo Diagnosticar el Problema

### Paso 1: Verificar que el Servidor Esté Actualizado

```bash
# Reinicia el servidor
# Presiona Ctrl+C y luego:
cd backend
uvicorn main:app --reload
```

### Paso 2: Crear una Familia de Prueba

```bash
# Registrar tutor y child
curl -X POST http://localhost:8000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "tutor": {
      "name": "Test Tutor",
      "email": "tutor_test@example.com",
      "password": "test123"
    },
    "child": {
      "name": "Test Child",
      "email": "child_test@example.com",
      "password": "test123"
    }
  }'
```

**Guarda los IDs devueltos:**
- `tutor_id` (ejemplo: 1)
- `child_id` (ejemplo: 2)

### Paso 3: Verificar Relación Familiar

```bash
# Verificar info del child
curl http://localhost:8000/tasks/debug/user/2
```

**Debe devolver:**
```json
{
  "user": {
    "id": 2,
    "name": "Test Child",
    "user_type": "child",
    "tutor_id": 1,  // ✅ DEBE TENER EL ID DEL TUTOR
    "sponsored_child_id": null
  },
  "authorized_creators": [1],  // ✅ DEBE INCLUIR AL TUTOR
  "tasks_assigned_to_user": 0,
  "user_tasks_count": 0
}
```

**⚠️ Si `tutor_id` es `null`, hay un problema en el registro!**

### Paso 4: Crear una Tarea

```bash
# Tutor crea tarea para child
curl -X POST "http://localhost:8000/parent-tasks/?parent_id=1" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Lavar los platos",
    "description": "Tarea de prueba",
    "category": "chores",
    "difficulty": "easy",
    "reward": 50.0,
    "assigned_to": 2
  }'
```

**Debe devolver:**
```json
{
  "id": 1,
  "title": "Lavar los platos",
  "created_by": 1,
  "assigned_to": 2,
  "is_active": true
}
```

### Paso 5: Verificar que la Tarea se Guardó

```bash
# Ver todas las tareas en la DB
curl http://localhost:8000/tasks/debug/all-tasks
```

**Debe mostrar:**
```json
{
  "total_tasks": 1,
  "total_user_tasks": 1,
  "tasks": [
    {
      "id": 1,
      "title": "Lavar los platos",
      "created_by": 1,     // ✅ ID del tutor
      "assigned_to": 2,    // ✅ ID del child
      "is_active": true
    }
  ],
  "user_tasks": [
    {
      "id": 1,
      "user_id": 2,        // ✅ ID del child
      "task_id": 1,        // ✅ ID de la tarea
      "is_completed": false
    }
  ]
}
```

### Paso 6: Verificar que el Child Pueda Ver la Tarea

```bash
# Child consulta sus tareas
curl http://localhost:8000/tasks/available/2
```

**Debe devolver:**
```json
{
  "tasks": [
    {
      "id": 1,
      "title": "Lavar los platos",
      "created_by": "Test Tutor",
      "created_by_type": "tutor",
      "is_completed": false
    }
  ]
}
```

---

## 🔍 Posibles Problemas y Soluciones

### Problema 1: `tutor_id` es `null` en el child

**Causa:** El registro no está vinculando correctamente al tutor con el child.

**Solución:**
1. Verifica que `backend/auth/endpoints.py` tenga:
```python
child_user = User(
    tutor_id=tutor_user.id,  # ✅ Debe estar presente
    ...
)
```

2. Si falta, el archivo ya debería estar actualizado. Reinicia el servidor.

3. Si persiste, ejecuta la migración:
```bash
cd backend
python migrate_user_relations.py
```

### Problema 2: Tareas se crean pero no aparecen

**Causa:** El filtro de `authorized_creators` está bloqueando las tareas.

**Solución:** Ya corregido en el código. Asegúrate de tener la última versión.

### Problema 3: `UserTask` no se crea

**Causa:** Error en el endpoint de creación de tareas.

**Verificar:**
```bash
curl http://localhost:8000/tasks/debug/all-tasks
```

Si `total_user_tasks` es 0 pero `total_tasks` es mayor a 0, el problema está en la línea 60-66 de `parent_tasks/endpoints.py`.

**Solución:**
```python
# Debe existir este código:
if task.assigned_to:
    user_task = UserTask(
        user_id=task.assigned_to,
        task_id=db_task.id
    )
    db.add(user_task)
    db.commit()
```

### Problema 4: Base de Datos Corrupta

**Solución Drástica (⚠️ BORRA TODOS LOS DATOS):**
```bash
cd backend
rm littlefounders.db  # o tu archivo de base de datos
python create_tables.py
```

Luego registra usuarios nuevamente.

---

## 📊 Checklist de Verificación

- [ ] ✅ Servidor reiniciado con última versión del código
- [ ] ✅ Familia registrada correctamente (tutor + child)
- [ ] ✅ `child.tutor_id` apunta al tutor (verificar con `/tasks/debug/user/{child_id}`)
- [ ] ✅ Tarea creada exitosamente (verificar respuesta del POST)
- [ ] ✅ Tarea existe en la DB (verificar con `/tasks/debug/all-tasks`)
- [ ] ✅ `UserTask` existe en la DB (verificar con `/tasks/debug/all-tasks`)
- [ ] ✅ Child puede ver la tarea (verificar con `/tasks/available/{child_id}`)

---

## 🚨 Si Nada Funciona

1. **Captura los logs del servidor:**
   - Ve a la consola donde corre `uvicorn`
   - Copia cualquier error que aparezca

2. **Captura las respuestas de los endpoints de debug:**
   ```bash
   curl http://localhost:8000/tasks/debug/all-tasks > debug_tasks.json
   curl http://localhost:8000/tasks/debug/user/2 > debug_user.json
   ```

3. **Verifica la estructura de la DB:**
   ```bash
   sqlite3 littlefounders.db "SELECT * FROM users;"
   sqlite3 littlefounders.db "SELECT * FROM tasks;"
   sqlite3 littlefounders.db "SELECT * FROM user_tasks;"
   ```

---

## 📝 Resumen de Cambios en el Código

### `backend/tasks/endpoints.py`

1. **Corregido filtro en `/available/{user_id}`:**
   - Antes: Usaba `if/else` que devolvía `False`
   - Ahora: Usa condicional para aplicar filtro solo si hay creadores

2. **Agregados endpoints de debug:**
   - `/tasks/debug/all-tasks` - Ver todas las tareas
   - `/tasks/debug/user/{user_id}` - Ver info del usuario

### Flujo Completo Correcto

```
1. Tutor crea tarea
   POST /parent-tasks/?parent_id=1
   ↓
2. Backend valida:
   - ✅ Tutor existe
   - ✅ Tutor es tipo "tutor"
   - ✅ Child existe
   - ✅ child.tutor_id == parent_id
   ↓
3. Se crea Task:
   - created_by = 1 (tutor)
   - assigned_to = 2 (child)
   ↓
4. Se crea UserTask:
   - user_id = 2 (child)
   - task_id = 1 (tarea)
   ↓
5. Child consulta tareas
   GET /tasks/available/2
   ↓
6. Backend obtiene:
   - authorized_creators = [1] (tutor_id)
   - Filtra: assigned_to=2 AND created_by IN [1]
   ↓
7. Devuelve tareas
```

---

**¡Usa esta guía para encontrar dónde está el problema!** 🔍

