# 📊 Diagrama del Sistema de Relaciones Familiares

## 🏗️ Arquitectura del Sistema

```
┌─────────────────────────────────────────────────────────┐
│                    FRONTEND (React)                      │
│                                                          │
│  ┌──────────┐  ┌──────────┐                            │
│  │  Tutor   │  │  Child   │                            │
│  │   View   │  │   View   │                            │
│  └────┬─────┘  └────┬─────┘                            │
└───────┼─────────────┼──────────────────────────────────┘
        │             │             │
        ▼             ▼             ▼
┌─────────────────────────────────────────────────────────┐
│              BACKEND API (FastAPI)                       │
│                                                          │
│  ┌─────────────────────────────────────────────────┐   │
│  │      /auth/register - Registro de Familia        │   │
│  │      /auth/family/{id} - Info Familiar           │   │
│  │      /parent-tasks/ - Gestión de Tareas          │   │
│  │      /tasks/available/{id} - Tareas del Child    │   │
│  └─────────────────────────────────────────────────┘   │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│              BASE DE DATOS (SQLite/PostgreSQL)           │
│                                                          │
│  ┌─────────────────────────────────────────────────┐   │
│  │  Tabla: users                                    │   │
│  │  ├─ id (PK)                                      │   │
│  │  ├─ tutor_id (FK → users.id)                    │   │
│  │  └─ ... otros campos                             │   │
│  └─────────────────────────────────────────────────┘   │
│                                                          │
│  ┌─────────────────────────────────────────────────┐   │
│  │  Tabla: tasks                                    │   │
│  │  ├─ id (PK)                                      │   │
│  │  ├─ created_by (FK → users.id)                  │   │
│  │  ├─ assigned_to (FK → users.id)                 │   │
│  │  └─ ... otros campos                             │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

---

## 👥 Relaciones Entre Usuarios

```
        ┌─────────────┐
        │   TUTOR     │  user_type: "tutor"
        │  (Juan)     │  
        └──────┬──────┘
               │ tutor_id
               │
               ▼
        ┌─────────────┐
        │   CHILD     │  user_type: "child"
        │  (María)    │  tutor_id: 1
        └──────▲──────┘
- Esta estructura permite relaciones 1:N (un tutor puede tener múltiples children)

---

## 🔄 Flujo de Registro de Familia

```
┌────────────────────────────────────────────────────────┐
│  1. CLIENTE ENVÍA DATOS                                │
│                                                        │
│  POST /auth/register                                   │
│  {                                                     │
│    child: {...}                                        │
│  }                                                     │
└───────────────────┬────────────────────────────────────┘
                    │
                    ▼
┌────────────────────────────────────────────────────────┐
│  2. BACKEND PROCESA EN ORDEN                           │
│                                                        │
│  ┌──────────────────────────────┐                     │
│  │ a) Crear TUTOR               │                     │
│  │    INSERT INTO users (...)   │                     │
│  │    → Obtener tutor.id = 1    │                     │
│  └──────────────────────────────┘                     │
│                ↓                                       │
│  ┌──────────────────────────────┐                     │
│  │ b) Crear CHILD               │                     │
│  │    INSERT INTO users (       │                     │
│  │      tutor_id = 1            │ ← Vincula con tutor │
│  │    )                          │                     │
│  │    → Obtener child.id = 2    │                     │
│  └──────────────────────────────┘                     │
│                                                        │
│  ✅ COMMIT TRANSACTION                                 │
└───────────────────┬────────────────────────────────────┘
                    │
                    ▼
┌────────────────────────────────────────────────────────┐
│  3. RESPUESTA AL CLIENTE                               │
│                                                        │
│  {                                                     │
│    message: "Family registration successful",          │
│    child: { id: 2, tutor_id: 1, ... }                  │
│  }                                                     │
└────────────────────────────────────────────────────────┘
```

---

## 🎯 Flujo de Asignación de Tareas

```
┌──────────────────────────────────────────────────────┐
│  TUTOR quiere crear tarea para CHILD                 │
└───────────────────┬──────────────────────────────────┘
                    │
                    ▼
┌────────────────────────────────────────────────────────┐
│  POST /parent-tasks/?parent_id=1                       │
│  {                                                     │
│    title: "Lavar los platos",                          │
│    assigned_to: 2,  ← ID del child                     │
│    reward: 50.0                                        │
│  }                                                     │
└───────────────────┬────────────────────────────────────┘
                    │
                    ▼
┌────────────────────────────────────────────────────────┐
│  VALIDACIONES DE SEGURIDAD                             │
│                                                        │
│  ┌──────────────────────────────────────┐             │
│  │ 1. ¿Parent existe?                   │             │
│  │    SELECT * FROM users WHERE id = 1  │             │
│  │    ✅ Sí existe                       │             │
│  └──────────────────────────────────────┘             │
│                ↓                                       │
│  ┌──────────────────────────────────────┐             │
│  │ 2. ¿Es TUTOR?                        │             │
│  │    parent.user_type == tutor         │             │
│  │    ✅ Sí es tutor                     │             │
│  └──────────────────────────────────────┘             │
│                ↓                                       │
│  ┌──────────────────────────────────────┐             │
│  │ 3. ¿Child existe?                    │             │
│  │    SELECT * FROM users WHERE id = 2  │             │
│  │    ✅ Sí existe                       │             │
│  └──────────────────────────────────────┘             │
│                ↓                                       │
│  ┌──────────────────────────────────────┐             │
│  │ 4. ¿Relación válida?                 │             │
│  │    child.tutor_id == parent.id       │             │
│  │    ✅ 2.tutor_id (1) == 1             │             │
│  └──────────────────────────────────────┘             │
│                                                        │
│  ✅ TODAS LAS VALIDACIONES PASARON                     │
└───────────────────┬────────────────────────────────────┘
                    │
                    ▼
┌────────────────────────────────────────────────────────┐
│  CREAR TAREA                                           │
│                                                        │
│  INSERT INTO tasks (                                   │
│    title = "Lavar los platos",                         │
│    created_by = 1,      ← ID del tutor                 │
│    assigned_to = 2,     ← ID del child                 │
│    reward = 50.0                                       │
│  )                                                     │
│                                                        │
│  ✅ Tarea creada con id = 100                          │
└───────────────────┬────────────────────────────────────┘
                    │
                    ▼
┌────────────────────────────────────────────────────────┐
│  RESPUESTA                                             │
│                                                        │
│  {                                                     │
│    id: 100,                                            │
│    title: "Lavar los platos",                          │
│    created_by: 1,                                      │
│    assigned_to: 2,                                     │
│    reward: 50.0                                        │
│  }                                                     │
└────────────────────────────────────────────────────────┘
```

---

## 🔍 Flujo de Visualización de Tareas (Child)

```
┌──────────────────────────────────────────────────────┐
│  CHILD quiere ver sus tareas                          │
└───────────────────┬──────────────────────────────────┘
                    │
                    ▼
┌────────────────────────────────────────────────────────┐
│  GET /tasks/available/2                                │
└───────────────────┬────────────────────────────────────┘
                    │
                    ▼
┌────────────────────────────────────────────────────────┐
│  OBTENER CREADORES AUTORIZADOS                         │
│                                                        │
│  ┌──────────────────────────────────────┐             │
│  │ 1. Obtener CHILD                     │             │
│  │    child = SELECT * FROM users       │             │
│  │            WHERE id = 2              │             │
│  └──────────────────────────────────────┘             │
│                ↓                                       │
│  ┌──────────────────────────────────────┐             │
│  │ 2. Obtener su TUTOR                  │             │
│  │    authorized_creators = []          │             │
│  │    if child.tutor_id:                │             │
│  │      authorized_creators.add(1)      │             │
│  └──────────────────────────────────────┘             │
│                                                        │
│  authorized_creators = [1]                             │
└───────────────────┬────────────────────────────────────┘
                    │
                    ▼
┌────────────────────────────────────────────────────────┐
│  FILTRAR TAREAS                                        │
│                                                        │
│  SELECT * FROM tasks                                   │
│  WHERE assigned_to = 2                                 │
│    AND created_by = 1  ← Solo creadores autorizados    │
│    AND is_active = true                                │
│                                                        │
│  Resultado:                                            │
│  ┌────────────────────────────────────┐               │
│  │ Task 100: "Lavar los platos"      │               │
│  │   created_by: 1 (Tutor)           │               │
│  │   reward: 50.0                     │               │
│  └────────────────────────────────────┘               │
└───────────────────┬────────────────────────────────────┘
                    │
                    ▼
┌────────────────────────────────────────────────────────┐
│  RESPUESTA                                             │
│                                                        │
│  {                                                     │
│    tasks: [                                            │
│      {                                                 │
│        id: 100,                                        │
│        title: "Lavar los platos",                      │
│        created_by: "Juan Pérez",                       │
│        created_by_type: "tutor",                       │
│      }                                                 │
│    ]                                                   │
│  }                                                     │
└────────────────────────────────────────────────────────┘
```

---

## 🛡️ Matriz de Permisos

```
┌─────────────┬──────────────┬──────────────┐
│   Acción    │    TUTOR     │    CHILD     │
├─────────────┼──────────────┼──────────────┤
│ Ver sus     │      ✅      │      ✅      │
│ children    │   Múltiples  │     N/A      │
├─────────────┼──────────────┼──────────────┤
│ Ver su      │      ❌      │      ✅      │
│ tutor       │     N/A      │    Solo 1    │
├─────────────┼──────────────┼──────────────┤
│ Crear       │      ✅      │      ❌      │
│ tareas      │ Para sus     │     N/A      │
│             │ children     │              │
├─────────────┼──────────────┼──────────────┤
│ Ver         │      ✅      │      ✅      │
│ tareas      │De sus        │Solo las      │
│             │children      │de su familia │
├─────────────┼──────────────┼──────────────┤
│ Aprobar     │      ✅      │      ❌      │
│ tareas      │Las que creó  │     N/A      │
├─────────────┼──────────────┼──────────────┤
│ Completar   │      ❌      │      ✅      │
│ tareas      │     N/A      │  Sus tareas  │
└─────────────┴──────────────┴──────────────┘

Leyenda:
  ✅ = Permitido
  ❌ = No permitido
  🔸 = Funcionalidad limitada o futura
```

---

## 🗂️ Estructura de Base de Datos

```sql
CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    user_type ENUM('tutor', 'child') NOT NULL,
    
    -- Relaciones
    tutor_id INTEGER,
    
    -- Foreign Keys
    FOREIGN KEY (tutor_id) REFERENCES users(id),
    
    -- Campos específicos de child
    lessons_completed INTEGER DEFAULT 0,
    minutes_studied INTEGER DEFAULT 0,
    points_earned INTEGER DEFAULT 0,
    balance FLOAT DEFAULT 0.0,
    
    -- Otros campos...
    birth_date DATETIME,
    gender ENUM('masculino', 'femenino', 'otro'),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME,
    is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE tasks (
    id INTEGER PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    category ENUM('chores', 'education', 'social', 'bonus'),
    difficulty ENUM('easy', 'medium', 'hard'),
    reward FLOAT NOT NULL,
    
    -- Relaciones
    created_by INTEGER NOT NULL,
    assigned_to INTEGER,
    
    -- Foreign Keys
    FOREIGN KEY (created_by) REFERENCES users(id),
    FOREIGN KEY (assigned_to) REFERENCES users(id),
    
    -- Otros campos...
    time_estimate INTEGER,
    due_date DATETIME,
    is_first_dibs BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME
);
```

---

## 📈 Escalabilidad

El sistema está diseñado para escalar fácilmente:

```
ACTUAL:
  Tutor (1) → Children (N)


FUTURO POSIBLE:
  ┌─────────────────────────────────┐
  │ Múltiples Tutores por Child     │
  │ (Requiere tabla de relación)    │
  └─────────────────────────────────┘
  
  ┌─────────────────────────────────┐
  │ Roles y Permisos Granulares     │
  │ (Tabla de roles y permisos)     │
  └─────────────────────────────────┘
  

```

---

## 🎯 Conclusión

Este sistema implementa:
- ✅ Relaciones jerárquicas claras
- ✅ Integridad referencial
- ✅ Control de acceso robusto
- ✅ Escalabilidad para futuras mejoras
- ✅ Validaciones de seguridad en todos los niveles

**¡Sistema listo para producción!** 🚀

