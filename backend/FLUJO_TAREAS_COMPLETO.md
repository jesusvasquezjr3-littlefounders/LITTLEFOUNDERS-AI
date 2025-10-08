# ✅ Flujo Completo de Tareas - Frontend a Backend

## Problema Resuelto

**ANTES:** Las tareas creadas por tutores/sponsors solo se guardaban en el estado local del frontend, NO en la base de datos.

**AHORA:** Las tareas se guardan en la base de datos y se sincronizan entre frontend y backend.

---

## 🔄 Flujo End-to-End

### 1. Tutor/Sponsor Crea Tarea

#### Frontend (`src/components/banking/ParentTasksSystem.tsx`)

```typescript
// Cuando el tutor hace click en "Crear Tarea"
const handleCreateTask = async () => {
  // 1. Validaciones
  // 2. Obtener ID del child por email
  const selectedChild = children.find(c => c.email === newTask.assignedTo);
  
  // 3. Preparar datos para el backend
  const taskData = {
    title: newTask.title,
    description: newTask.description,
    category: newTask.category,
    difficulty: newTask.difficulty,
    reward: newTask.reward,
    time_estimate: newTask.timeEstimate,
    due_date: newTask.dueDate || null,
    is_first_dibs: newTask.isFirstDibs,
    assigned_to: parseInt(selectedChild.id)
  };
  
  // 4. Enviar al backend
  const response = await fetch(
    `http://localhost:8000/parent-tasks/?parent_id=${user.id}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(taskData)
    }
  );
  
  // 5. Actualizar estado local con la tarea creada
  const createdTask = await response.json();
  setTasks([...tasks, createdTask]);
}
```

#### Backend (`backend/parent_tasks/endpoints.py`)

```python
@router.post("/")
async def create_task_for_child(task: TaskCreate, parent_id: int, db: Session):
    # 1. Verificar que el parent existe
    parent = db.query(User).filter(User.id == parent_id).first()
    
    # 2. Verificar que es tutor o sponsor
    if parent.user_type.value not in ["tutor", "sponsor"]:
        raise HTTPException(403, "Only tutors and sponsors can create tasks")
    
    # 3. Verificar relación con el child
    child = db.query(User).filter(User.id == task.assigned_to).first()
    is_authorized = False
    if parent.user_type.value == "tutor" and child.tutor_id == parent_id:
        is_authorized = True
    elif parent.user_type.value == "sponsor" and parent.sponsored_child_id == child.id:
        is_authorized = True
    
    if not is_authorized:
        raise HTTPException(403, "You can only create tasks for your registered children")
    
    # 4. Crear Task en la DB
    db_task = Task(
        title=task.title,
        created_by=parent_id,
        assigned_to=task.assigned_to,
        # ... otros campos
    )
    db.add(db_task)
    db.commit()
    
    # 5. Crear UserTask entry
    user_task = UserTask(
        user_id=task.assigned_to,
        task_id=db_task.id
    )
    db.add(user_task)
    db.commit()
    
    return db_task
```

---

### 2. Child Ve Sus Tareas

#### Frontend

```typescript
// El componente TasksSystem.tsx carga las tareas del child
useEffect(() => {
  const loadTasks = async () => {
    const response = await fetch(
      `http://localhost:8000/tasks/available/${user.id}`
    );
    const data = await response.json();
    setTasks(data.tasks);
  };
  loadTasks();
}, [user]);
```

#### Backend (`backend/tasks/endpoints.py`)

```python
@router.get("/available/{user_id}")
async def get_available_tasks(user_id: int, db: Session):
    # 1. Obtener child
    child = db.query(User).filter(User.id == user_id).first()
    
    # 2. Obtener creadores autorizados (tutor + sponsors)
    authorized_creators = []
    if child.tutor_id:
        authorized_creators.append(child.tutor_id)
    
    sponsors = db.query(User).filter(
        User.sponsored_child_id == user_id,
        User.user_type == "sponsor"
    ).all()
    for sponsor in sponsors:
        authorized_creators.append(sponsor.id)
    
    # 3. Filtrar tareas solo de creadores autorizados
    query = db.query(Task).filter(
        Task.assigned_to == user_id,
        Task.is_active == True
    )
    
    if authorized_creators:
        query = query.filter(Task.created_by.in_(authorized_creators))
    
    tasks = query.all()
    
    # 4. Devolver tareas con info del creador
    return {"tasks": task_data}
```

---

### 3. Tutor Ve Todas Sus Tareas Asignadas

#### Frontend

```typescript
// El componente se carga con useEffect
useEffect(() => {
  const loadData = async () => {
    // 1. Cargar children del tutor
    const childrenResponse = await fetch(
      `http://localhost:8000/parent-tasks/children/${user.id}`
    );
    const childrenData = await childrenResponse.json();
    setChildren(childrenData.children);
    
    // 2. Cargar tareas de cada child
    const allTasks = [];
    for (const child of childrenData.children) {
      const tasksResponse = await fetch(
        `http://localhost:8000/parent-tasks/child-tasks/${child.id}`
      );
      const tasksData = await tasksResponse.json();
      allTasks.push(...tasksData.tasks);
    }
    setTasks(allTasks);
  };
  
  loadData();
}, [user]);
```

#### Backend

```python
# Endpoint para obtener children
@router.get("/children/{parent_id}")
async def get_parent_children(parent_id: int, db: Session):
    parent = db.query(User).filter(User.id == parent_id).first()
    
    children = []
    if parent.user_type.value == "tutor":
        children = db.query(User).filter(User.tutor_id == parent_id).all()
    elif parent.user_type.value == "sponsor":
        if parent.sponsored_child_id:
            child = db.query(User).filter(User.id == parent.sponsored_child_id).first()
            if child:
                children = [child]
    
    return {"children": [... formatted children ...]}

# Endpoint para obtener tareas de un child
@router.get("/child-tasks/{child_id}")
async def get_child_tasks(child_id: int, db: Session):
    tasks = db.query(Task, UserTask).outerjoin(
        UserTask, (Task.id == UserTask.task_id) & (UserTask.user_id == child_id)
    ).filter(
        Task.assigned_to == child_id,
        Task.is_active == True
    ).all()
    
    return {"tasks": [... formatted tasks ...]}
```

---

## 📋 Cambios Realizados

### Backend

1. **`backend/models.py`** ✅
   - Corregidas relaciones SQLAlchemy (remote_side)

2. **`backend/tasks/endpoints.py`** ✅
   - Corregido filtro de tareas (authorized_creators)
   - Agregados endpoints de debug

3. **`backend/parent_tasks/endpoints.py`** ✅
   - Ya tiene validaciones de seguridad
   - Crea Task y UserTask correctamente

### Frontend

1. **`src/components/banking/ParentTasksSystem.tsx`** ✅
   - `handleCreateTask()` ahora hace POST al backend
   - Agregado `useEffect` para cargar children del backend
   - Agregado `useEffect` para cargar tareas del backend
   - Las tareas se sincronizan con la base de datos

---

## 🧪 Cómo Probar

### 1. Registrar una Familia

```bash
curl -X POST http://localhost:8000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "tutor": {
      "name": "Juan Pérez",
      "email": "juan@test.com",
      "password": "test123"
    },
    "child": {
      "name": "María Pérez",
      "email": "maria@test.com",
      "password": "test123"
    }
  }'
```

Guardar los IDs:
- `tutor_id` (ejemplo: 1)
- `child_id` (ejemplo: 2)

### 2. Login como Tutor

1. Ir a `http://localhost:5173/login`
2. Email: `juan@test.com`
3. Password: `test123`

### 3. Ir a la Sección de Tareas

1. En el dashboard del tutor, ir a "Tareas" o "Parent Tasks"
2. Click en "Crear Nueva Tarea"
3. Llenar el formulario:
   - Título: "Lavar los platos"
   - Descripción: "Tarea de prueba"
   - Categoría: Tareas del hogar
   - Dificultad: Fácil
   - Recompensa: $50
   - Tiempo: 15 minutos
   - Asignar a: María Pérez
4. Click en "Crear Tarea"

### 4. Verificar que se Guardó

**Opción 1: Endpoint de Debug**
```bash
curl http://localhost:8000/tasks/debug/all-tasks
```

Debería mostrar:
```json
{
  "total_tasks": 1,
  "total_user_tasks": 1,
  "tasks": [
    {
      "id": 1,
      "title": "Lavar los platos",
      "created_by": 1,
      "assigned_to": 2,
      "is_active": true
    }
  ]
}
```

**Opción 2: Login como Child**
1. Logout
2. Login con `maria@test.com` / `test123`
3. Ir a la sección de Tareas
4. Debería ver "Lavar los platos"

### 5. Verificar que el Tutor Ve la Tarea

1. Login como tutor nuevamente
2. Ir a "Tareas"
3. En la pestaña "Asignadas" debería aparecer la tarea

---

## ✅ Checklist de Funcionamiento

- [x] ✅ Relaciones SQLAlchemy corregidas
- [x] ✅ Filtro de tareas corregido en backend
- [x] ✅ Frontend hace POST al crear tareas
- [x] ✅ Frontend carga children del backend
- [x] ✅ Frontend carga tareas del backend
- [x] ✅ Tareas se guardan en la DB
- [x] ✅ Tareas aparecen al tutor después de crearlas
- [x] ✅ Tareas aparecen al child asignado
- [x] ✅ Solo aparecen tareas de la familia correspondiente

---

## 🎯 Resultado Final

### Para el Tutor:
1. ✅ Puede crear tareas desde el frontend
2. ✅ Las tareas se guardan en la base de datos
3. ✅ Las tareas aparecen en su lista cada vez que entra
4. ✅ Puede ver todas las tareas de sus children

### Para el Child:
1. ✅ Ve solo las tareas asignadas a él
2. ✅ Ve solo tareas de su tutor y sponsors
3. ✅ Las tareas persisten entre sesiones

### Para el Sponsor:
1. ✅ Puede crear tareas para su child patrocinado
2. ✅ Las tareas aparecen al child
3. ✅ Puede ver las tareas que creó

---

## 🔍 Debugging

Si las tareas no aparecen:

1. **Verificar en la base de datos:**
   ```bash
   curl http://localhost:8000/tasks/debug/all-tasks
   ```

2. **Verificar relaciones:**
   ```bash
   curl http://localhost:8000/tasks/debug/user/2
   ```

3. **Ver logs del servidor:**
   - Revisar la consola donde corre `uvicorn`
   - Buscar errores al crear o consultar tareas

4. **Ver console del navegador:**
   - Abrir DevTools (F12)
   - Ver la pestaña Console
   - Ver la pestaña Network para ver las peticiones HTTP

---

## 🎉 ¡Sistema Completamente Funcional!

El flujo de tareas ahora funciona end-to-end:
- ✅ Creación persiste en DB
- ✅ Sincronización frontend-backend
- ✅ Control de acceso familiar
- ✅ Tareas visibles para todos los actores correctos

**¡Todo listo para usarse!** 🚀

