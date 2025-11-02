# ✅ Integración de Ahorros con Base de Datos

## Problema Resuelto

**ANTES:** Las metas de ahorro se guardaban solo en el estado local del componente (`mockSavingsGoals`).

**AHORA:** Las metas se guardan en la base de datos y persisten entre sesiones.

---

## 🔧 Cambios Implementados

### Backend

#### 1. **Modelo Actualizado** (`backend/models.py`)

**Campos Agregados:**
```python
class SavingsGoal(Base):
    # ... campos existentes ...
    category = Column(String(50), default='other')  # NUEVO
    parent_match_percentage = Column(Integer, default=0)  # NUEVO
    round_up_enabled = Column(Boolean, default=False)  # NUEVO
```

**Campos soportados:**
- `category`: toy, education, experience, electronics, other
- `parent_match_percentage`: % que el tutor iguala del ahorro
- `round_up_enabled`: Si el redondeo automático está activo

#### 2. **Schemas Actualizados** (`backend/schemas.py`)

```python
class SavingsGoalBase(BaseModel):
    title: str
    description: Optional[str] = None
    target_amount: float
    category: Optional[str] = "other"  # NUEVO
    deadline: Optional[datetime] = None
    image_url: Optional[str] = None
    parent_match_percentage: Optional[int] = 0  # NUEVO
    round_up_enabled: Optional[bool] = False  # NUEVO

class SavingsGoalUpdate(BaseModel):
    current_amount: Optional[float] = None
    is_active: Optional[bool] = None
    category: Optional[str] = None  # NUEVO
    parent_match_percentage: Optional[int] = None  # NUEVO
    round_up_enabled: Optional[bool] = None  # NUEVO
```

#### 3. **Endpoint Actualizado** (`backend/savings/endpoints.py`)

```python
@router.post("/goals")
async def create_savings_goal(goal: SavingsGoalCreate, user_id: int, db: Session):
    db_goal = SavingsGoal(
        user_id=user_id,
        title=goal.title,
        description=goal.description,
        target_amount=goal.target_amount,
        category=goal.category,  # NUEVO
        deadline=goal.deadline,
        image_url=goal.image_url,
        parent_match_percentage=goal.parent_match_percentage,  # NUEVO
        round_up_enabled=goal.round_up_enabled  # NUEVO
    )
    db.add(db_goal)
    db.commit()
    return db_goal
```

---

### Frontend

#### 1. **Estado Inicial Actualizado** (`src/components/banking/SavingsGoals.tsx`)

**ANTES:**
```typescript
const [goals, setGoals] = useState<SavingsGoal[]>(mockSavingsGoals);
```

**AHORA:**
```typescript
const [goals, setGoals] = useState<SavingsGoal[]>([]);
const [isLoading, setIsLoading] = useState(true);
```

#### 2. **Cargar Metas desde DB**

```typescript
useEffect(() => {
  const loadGoals = async () => {
    try {
      const user = JSON.parse(localStorage.getItem('user'));
      
      const response = await fetch(
        `http://localhost:8000/savings/goals/${user.id}?requester_id=${user.id}`
      );
      
      const data = await response.json();
      
      const formattedGoals = data.map((g: any) => ({
        id: g.id.toString(),
        title: g.title,
        targetAmount: g.target_amount,
        currentAmount: g.current_amount,
        category: g.category,
        parentMatchPercentage: g.parent_match_percentage,
        roundUpEnabled: g.round_up_enabled,
        // ... otros campos
      }));
      
      setGoals(formattedGoals);
      console.log(`✅ Metas de ahorro cargadas: ${formattedGoals.length}`);
      
    } catch (error) {
      console.error('Error al cargar metas:', error);
      setGoals(mockSavingsGoals); // Fallback
    }
  };
  
  loadGoals();
}, []);
```

#### 3. **Crear Meta con Persistencia**

**ANTES:**
```typescript
const handleAddGoal = () => {
  const goal = { /* ... */ };
  setGoals([...goals, goal]); // Solo estado local
  setIsAddingGoal(false);
};
```

**AHORA:**
```typescript
const handleAddGoal = async () => {
  try {
    const user = JSON.parse(localStorage.getItem('user'));
    
    // Preparar datos
    const goalData = {
      title: newGoal.title,
      target_amount: parseFloat(newGoal.targetAmount),
      category: newGoal.category,
      parent_match_percentage: parseInt(newGoal.parentMatchPercentage),
      round_up_enabled: newGoal.roundUpEnabled,
      // ... otros campos
    };
    
    // POST al backend
    const response = await fetch(
      `http://localhost:8000/savings/goals?user_id=${user.id}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(goalData)
      }
    );
    
    const createdGoal = await response.json();
    
    // Actualizar estado local
    setGoals([...goals, formattedGoal]);
    
    alert('✅ Meta de ahorro creada exitosamente');
    
  } catch (error) {
    console.error('Error:', error);
    alert('❌ Error al crear la meta');
  }
};
```

---

## 🔄 Flujo Completo

### 1. Usuario Entra a "Mis Ahorros"

```
1. Componente se monta
   ↓
2. useEffect se ejecuta
   ↓
3. Carga user desde localStorage
   ↓
4. GET /savings/goals/{user_id}?requester_id={user_id}
   ↓
5. Backend verifica acceso familiar
   ↓
6. Backend devuelve metas del usuario
   ↓
7. Frontend formatea y muestra metas
   ↓
8. ✅ Usuario ve sus metas guardadas
```

### 2. Usuario Crea Nueva Meta

```
1. Click en "Nueva Meta"
   ↓
2. Llena formulario:
   - Título: "Nintendo Switch"
   - Monto: $300
   - Categoría: Electrónicos
   - Match parental: 25%
   - Redondeo: Sí
   ↓
3. Click en "Crear Meta"
   ↓
4. Frontend valida datos
   ↓
5. POST /savings/goals?user_id={user_id}
   ↓
6. Backend guarda en DB
   ↓
7. Backend devuelve meta creada
   ↓
8. Frontend actualiza estado local
   ↓
9. ✅ Meta aparece inmediatamente
   ↓
10. ✅ Meta persiste al salir y volver
```

---

## 📊 Datos Guardados en DB

### Tabla: `savings_goals`

```sql
CREATE TABLE savings_goals (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL,  -- FK a users
    title VARCHAR(200) NOT NULL,
    description TEXT,
    target_amount FLOAT NOT NULL,
    current_amount FLOAT DEFAULT 0.0,
    category VARCHAR(50) DEFAULT 'other',  -- NUEVO
    deadline DATETIME,
    image_url VARCHAR(500),
    parent_match_percentage INTEGER DEFAULT 0,  -- NUEVO
    round_up_enabled BOOLEAN DEFAULT FALSE,  -- NUEVO
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME,
    
    FOREIGN KEY (user_id) REFERENCES users(id)
);
```

---

## 🎯 Características Soportadas

### ✅ Campos Funcionales:
- **Título** - Nombre de la meta
- **Descripción** - Detalles
- **Monto objetivo** - Cantidad a ahorrar
- **Monto actual** - Cantidad ahorrada
- **Categoría** - Tipo de meta (juguete, educación, etc.)
- **Fecha límite** - Deadline opcional
- **Match parental** - % que el tutor iguala
- **Redondeo automático** - Para ahorros automáticos
- **Estado** - Activa o completada
- **Fechas** - Creación y actualización

### ✅ Control de Acceso:
- Child puede crear sus propias metas
- Child puede ver sus propias metas
- Tutor puede ver metas de sus children
- Sponsor puede ver metas del child patrocinado

---

## 🧪 Cómo Probar

### 1. Login como Child
```
Email: maria@test.com
Password: test123
```

### 2. Ir a "Mis Ahorros"
- Al inicio: Lista vacía (cargando desde DB)
- ✅ Mensaje: "Crea tu primera meta de ahorro"

### 3. Crear Nueva Meta
```
1. Click en "Nueva Meta"
2. Llenar formulario:
   - Título: "Nintendo Switch"
   - Descripción: "Consola de videojuegos"
   - Monto: $300
   - Categoría: Electrónicos
   - Match parental: 25%
   - Redondeo: Sí
3. Click en "Crear Meta"
4. ✅ Ver mensaje: "Meta de ahorro creada exitosamente"
```

### 4. Verificar en DB
```bash
curl "http://localhost:8000/savings/goals/2?requester_id=2"
```

Debe mostrar:
```json
[
  {
    "id": 1,
    "title": "Nintendo Switch",
    "target_amount": 300.0,
    "current_amount": 0.0,
    "category": "electronics",
    "parent_match_percentage": 25,
    "round_up_enabled": true
  }
]
```

### 5. Salir y Volver
```
1. Logout
2. Login nuevamente
3. Ir a "Mis Ahorros"
4. ✅ La meta sigue ahí (persistida en DB)
```

### 6. Tutor Ve Metas del Child
```bash
curl "http://localhost:8000/savings/goals/2?requester_id=1"
```
✅ El tutor puede ver las metas de su child

---

## 📋 Próximas Funcionalidades

### Para Implementar Después:

1. **Depositar a Meta**
   ```typescript
   const handleDeposit = async (goalId: string, amount: number) => {
     await fetch('/savings/deposit', {
       method: 'POST',
       body: JSON.stringify({ user_id, goal_id: goalId, amount })
     });
   };
   ```

2. **Retirar de Meta**
   ```typescript
   const handleWithdraw = async (goalId: string, amount: number) => {
     await fetch('/savings/withdraw', {
       method: 'POST',
       body: JSON.stringify({ user_id, goal_id: goalId, amount })
     });
   };
   ```

3. **Eliminar Meta**
   ```typescript
   const handleDeleteGoal = async (goalId: string) => {
     await fetch(`/savings/goals/${goalId}?requester_id=${user.id}`, {
       method: 'DELETE'
     });
   };
   ```

---

## ✅ Estado Actual

### Lo que Funciona:
- ✅ Cargar metas desde DB al iniciar
- ✅ Crear nuevas metas que persisten en DB
- ✅ Metas incluyen todos los campos (categoría, match, redondeo)
- ✅ Control de acceso familiar
- ✅ Sincronización frontend-backend

### Lo que Falta:
- ⏳ Depositar dinero a las metas (funcionalidad UI)
- ⏳ Retirar dinero de las metas (funcionalidad UI)
- ⏳ Eliminar metas (funcionalidad UI)

**Nota:** Los endpoints del backend ya existen para depositar/retirar:
- `POST /savings/deposit`
- `POST /savings/withdraw`
- `DELETE /savings/goals/{goal_id}`

Solo falta conectar la UI del frontend.

---

## 📊 Comparación

| Aspecto | ANTES | AHORA |
|---------|-------|-------|
| **Datos** | mockSavingsGoals | ✅ Base de datos |
| **Persistencia** | ❌ Se pierden al salir | ✅ Persisten |
| **Sincronización** | ❌ Solo local | ✅ Frontend-Backend |
| **Campos** | Básicos | ✅ Completos (categoría, match, redondeo) |
| **Acceso** | Sin control | ✅ Solo familia |
| **Carga inicial** | Inmediata | ✅ Desde DB con loading |

---

## 🎉 Resultado

Las metas de ahorro ahora funcionan igual que tareas y lecciones:

- ✅ Carga desde base de datos
- ✅ Guarda en base de datos
- ✅ Persiste entre sesiones
- ✅ Control de acceso familiar
- ✅ Todos los campos soportados

**¡Sistema de ahorros integrado con la base de datos!** 💰✨

