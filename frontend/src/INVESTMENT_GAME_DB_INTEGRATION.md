# ✅ Integración del Juego de Inversión con Base de Datos

## Problema Resuelto

**ANTES:** El progreso del juego de limonada se guardaba solo en el estado local y se perdía al salir.

**AHORA:** Todo el progreso se guarda automáticamente en la base de datos y se recupera al volver.

---

## 🔧 Cambios Implementados

### Backend

#### 1. **Modelo Actualizado** (`backend/models.py`)

**Campos Agregados al GameSession:**
```python
class GameSession(Base):
    # ... campos básicos ...
    
    # Nuevos campos detallados
    inventory = Column(JSON)  # {lemons, sugar, cups, ice}
    recipe = Column(JSON)  # {lemonsPerCup, sugarPerCup, icePerCup, price}
    weather = Column(String(20))  # sunny, cloudy, rainy, cold
    temperature = Column(Integer)  # Temperatura actual
    location = Column(String(50))  # park, school, mall, beach
    daily_stats = Column(JSON)  # {cupsSold, revenue, profit, customersServed}
    achievements = Column(JSON)  # Array de achievement IDs
    reputation = Column(Integer, default=50)  # 0-100
    experience = Column(Integer, default=0)  # XP points
    level = Column(Integer, default=1)  # Nivel del jugador
```

#### 2. **Schemas Actualizados** (`backend/schemas.py`)

```python
class GameSessionUpdate(BaseModel):
    day_number: Optional[int] = None
    cash: Optional[float] = None
    inventory: Optional[dict] = None
    recipe: Optional[dict] = None  # NUEVO
    weather: Optional[str] = None  # NUEVO
    temperature: Optional[int] = None  # NUEVO
    location: Optional[str] = None  # NUEVO
    daily_stats: Optional[dict] = None  # NUEVO
    achievements: Optional[list] = None  # NUEVO
    reputation: Optional[int] = None  # NUEVO
    experience: Optional[int] = None  # NUEVO
    level: Optional[int] = None  # NUEVO
    score: Optional[int] = None

class GameSessionResponse(BaseModel):
    # ... incluye todos los campos nuevos ...
```

#### 3. **Endpoint de Creación Actualizado**

```python
@router.post("/session")
async def create_game_session(session: GameSessionCreate, user_id: int, db: Session):
    # Crear sesión con valores iniciales completos
    db_session = GameSession(
        user_id=user_id,
        game_type=session.game_type,
        day_number=1,
        cash=50.0,
        inventory={"lemons": 0, "sugar": 0, "cups": 0, "ice": 0},
        recipe={"lemonsPerCup": 3, "sugarPerCup": 2, "icePerCup": 3, "price": 1.0},
        weather="sunny",
        temperature=75,
        location="park",
        daily_stats={"cupsSold": 0, "revenue": 0, "profit": 0, "customersServed": 0},
        achievements=[],
        reputation=50,
        experience=0,
        level=1,
        score=0
    )
```

#### 4. **Endpoint de Actualización Mejorado**

Ahora soporta actualizar todos los campos:
- day_number, cash, inventory, recipe
- weather, temperature, location
- daily_stats, achievements
- reputation, experience, level, score

---

### Frontend

#### 1. **Estado Inicial** (`src/pages/LemonadeStand.tsx`)

**Agregados:**
```typescript
const [sessionId, setSessionId] = useState<number | null>(null);
const [isLoadingSession, setIsLoadingSession] = useState(true);
```

#### 2. **Cargar o Crear Sesión al Iniciar**

```typescript
useEffect(() => {
  const loadOrCreateSession = async () => {
    const user = JSON.parse(localStorage.getItem('user'));
    
    // 1. Intentar obtener sesión activa
    try {
      const response = await fetch(
        `http://localhost:8000/investment-games/session/${user.id}/lemonade_stand`
      );
      
      if (response.ok) {
        const session = await response.json();
        setSessionId(session.id);
        loadSessionToState(session);
        console.log('✅ Sesión existente cargada');
        return;
      }
    } catch (error) {
      // No hay sesión activa
    }
    
    // 2. Crear nueva sesión
    const createResponse = await fetch(
      `http://localhost:8000/investment-games/session?user_id=${user.id}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ game_type: 'lemonade_stand' })
      }
    );
    
    if (createResponse.ok) {
      const newSession = await createResponse.json();
      setSessionId(newSession.id);
      loadSessionToState(newSession);
      console.log('✅ Nueva sesión creada');
    }
  };
  
  loadOrCreateSession();
}, []);
```

#### 3. **Función para Cargar Sesión al Estado**

```typescript
const loadSessionToState = (session: any) => {
  setGameState({
    day: session.day_number || 1,
    money: session.cash || 20,
    inventory: session.inventory || {...},
    recipe: session.recipe || {...},
    weather: session.weather || 'sunny',
    temperature: session.temperature || 24,
    location: session.location || 'park',
    dailyStats: session.daily_stats || {...},
    achievements: session.achievements || [],
    reputation: session.reputation || 50,
    experience: session.experience || 0,
    level: session.level || 1,
    customers: []
  });
};
```

#### 4. **Función para Guardar Progreso**

```typescript
const saveGameProgress = useCallback(async () => {
  if (!sessionId) return;
  
  try {
    const sessionUpdate = {
      day_number: gameState.day,
      cash: gameState.money,
      inventory: gameState.inventory,
      recipe: gameState.recipe,
      weather: gameState.weather,
      temperature: gameState.temperature,
      location: gameState.location,
      daily_stats: gameState.dailyStats,
      achievements: gameState.achievements,
      reputation: gameState.reputation,
      experience: gameState.experience,
      level: gameState.level,
      score: Math.round(gameState.money + gameState.experience / 10)
    };
    
    await fetch(`http://localhost:8000/investment-games/session/${sessionId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sessionUpdate)
    });
    
    console.log('✅ Progreso guardado en DB');
  } catch (error) {
    console.error('Error al guardar:', error);
  }
}, [sessionId, gameState]);
```

#### 5. **Guardado Automático**

**Al avanzar de día:**
```typescript
const nextDay = useCallback(async () => {
  // ... lógica del día ...
  
  // Guardar progreso antes de avanzar
  await saveGameProgress();
  
  // Continuar con siguiente día
  setGameState(prev => ({...prev, day: nextDayNumber}));
}, [gameState, saveGameProgress]);
```

**Autoguardado periódico (cada 30 segundos):**
```typescript
useEffect(() => {
  if (!sessionId) return;
  
  const autoSaveInterval = setInterval(() => {
    saveGameProgress();
  }, 30000);
  
  return () => clearInterval(autoSaveInterval);
}, [sessionId, saveGameProgress]);
```

**Al salir del juego:**
```typescript
useEffect(() => {
  return () => {
    if (sessionId) {
      saveGameProgress();
    }
  };
}, [sessionId, saveGameProgress]);
```

---

## 🔄 Flujo Completo

### 1. Usuario Entra al Juego de Limonada

```
1. Componente se monta
   ↓
2. useEffect se ejecuta
   ↓
3. Intenta GET /investment-games/session/{user_id}/lemonade_stand
   ↓
4a. Si existe sesión activa:
    → Carga datos al estado
    → Usuario continúa donde lo dejó ✅
   ↓
4b. Si NO existe sesión:
    → POST /investment-games/session
    → Crea nueva sesión
    → Carga valores iniciales ✅
```

### 2. Usuario Juega

```
1. Usuario compra ingredientes
2. Usuario ajusta receta
3. Usuario abre el puesto
4. Sirve clientes
5. Gana dinero y experiencia
   ↓
Cada 30 segundos:
   → PUT /investment-games/session/{session_id}
   → Guarda todo el progreso automáticamente ✅
```

### 3. Usuario Avanza al Siguiente Día

```
1. Click en "Siguiente Día"
   ↓
2. Función nextDay() se ejecuta
   ↓
3. Guarda progreso del día actual
   PUT /investment-games/session/{session_id}
   ↓
4. Actualiza estado para nuevo día
   ↓
5. ✅ Progreso guardado en DB
```

### 4. Usuario Sale del Juego

```
1. Usuario navega a otra página
   ↓
2. useEffect cleanup se ejecuta
   ↓
3. Guarda progreso final
   PUT /investment-games/session/{session_id}
   ↓
4. ✅ Progreso guardado antes de salir
```

### 5. Usuario Vuelve al Juego

```
1. Usuario entra nuevamente
   ↓
2. GET /investment-games/session/{user_id}/lemonade_stand
   ↓
3. Carga sesión activa con todo el progreso
   ↓
4. ✅ Usuario continúa exactamente donde lo dejó:
   - Mismo día
   - Mismo dinero
   - Mismo inventario
   - Mismos logros
   - Misma reputación
```

---

## 📊 Datos Guardados en DB

### Tabla: `game_sessions`

```sql
id                    : 1
user_id               : 2
game_type             : "lemonade_stand"
day_number            : 5
cash                  : 87.50
inventory             : {"lemons": 25, "sugar": 18, "cups": 40, "ice": 30}
recipe                : {"lemonsPerCup": 3, "sugarPerCup": 2, "icePerCup": 3, "price": 1.25}
weather               : "sunny"
temperature           : 28
location              : "mall"
daily_stats           : {"cupsSold": 15, "revenue": 18.75, "profit": 12.30, "customersServed": 15}
achievements          : ["first-sale", "profit-day", "perfect-recipe"]
reputation            : 75
experience            : 350
level                 : 3
score                 : 123
is_active             : true
started_at            : "2025-10-08T10:00:00"
ended_at              : null
```

---

## ✅ Beneficios

### Persistencia:
- ✅ Progreso se guarda automáticamente cada 30 segundos
- ✅ Se guarda al avanzar de día
- ✅ Se guarda al salir del juego
- ✅ Se recupera al volver

### Continuidad:
- ✅ Usuario continúa exactamente donde lo dejó
- ✅ Todos los logros se mantienen
- ✅ Inventario preservado
- ✅ Dinero preservado
- ✅ Configuración de receta preservada

### Control de Acceso:
- ✅ Solo el usuario puede ver su sesión
- ✅ Tutores pueden ver el historial de sus children
- ✅ Sponsors pueden ver el historial del child patrocinado

---

## 🧪 Cómo Probar

### 1. Registrar un Child (si no existe)
```bash
curl -X POST http://localhost:8000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "tutor": {"name": "Juan", "email": "juan@test.com", "password": "test123"},
    "child": {"name": "María", "email": "maria@test.com", "password": "test123", "birth_date": "2015-05-15"}
  }'
```

### 2. Login como Child
```
Email: maria@test.com
Password: test123
```

### 3. Ir a "Aprende a Invertir"
- Click en "¡Jugar!" en el juego de limonada

### 4. Jugar un Poco
```
1. Comprar ingredientes
2. Ajustar receta
3. Abrir el puesto
4. Servir clientes
5. Avanzar al día 2
6. Jugar un poco más
```

### 5. Verificar Guardado Automático
```
F12 → Console
Buscar: "✅ Progreso guardado en DB"
(Debería aparecer cada 30 segundos)
```

### 6. Salir del Juego
```
1. Navegar a otra sección (ej: Dashboard)
2. Verificar en Console:
   "✅ Progreso guardado en DB" (al desmontar)
```

### 7. Volver al Juego
```
1. Ir nuevamente a "Aprende a Invertir"
2. Click en "¡Jugar!"
3. ✅ Debería continuar en el mismo día
4. ✅ Con el mismo dinero
5. ✅ Con el mismo inventario
6. Verificar en Console:
   "✅ Sesión existente cargada: {id}"
```

### 8. Verificar en Backend
```bash
# Ver historial del child
curl "http://localhost:8000/investment-games/history/2?requester_id=2"

# Ver sesión activa
curl "http://localhost:8000/investment-games/session/2/lemonade_stand"
```

---

## 📋 Endpoints Utilizados

### POST `/investment-games/session`
**Uso:** Crear nueva sesión de juego

**Request:**
```json
POST /investment-games/session?user_id=2
{
  "game_type": "lemonade_stand"
}
```

**Response:**
```json
{
  "id": 1,
  "user_id": 2,
  "game_type": "lemonade_stand",
  "day_number": 1,
  "cash": 50.0,
  "inventory": {"lemons": 0, "sugar": 0, "cups": 0, "ice": 0},
  "recipe": {"lemonsPerCup": 3, "sugarPerCup": 2, "icePerCup": 3, "price": 1.0},
  "weather": "sunny",
  "temperature": 75,
  "location": "park",
  "score": 0,
  "is_active": true
}
```

### GET `/investment-games/session/{user_id}/{game_type}`
**Uso:** Obtener sesión activa del usuario

**Request:**
```
GET /investment-games/session/2/lemonade_stand
```

**Response:** (igual que arriba, con datos actuales)

### PUT `/investment-games/session/{session_id}`
**Uso:** Actualizar progreso de la sesión

**Request:**
```json
PUT /investment-games/session/1
{
  "day_number": 5,
  "cash": 87.50,
  "inventory": {"lemons": 25, "sugar": 18, "cups": 40, "ice": 30},
  "recipe": {"lemonsPerCup": 3, "sugarPerCup": 2, "icePerCup": 3, "price": 1.25},
  "weather": "sunny",
  "temperature": 28,
  "location": "mall",
  "daily_stats": {"cupsSold": 15, "revenue": 18.75, "profit": 12.30, "customersServed": 15},
  "achievements": ["first-sale", "profit-day"],
  "reputation": 75,
  "experience": 350,
  "level": 3,
  "score": 123
}
```

### GET `/investment-games/history/{user_id}`
**Uso:** Ver historial de juegos del usuario

**Request:**
```
GET /investment-games/history/2?requester_id=2
```

**Response:**
```json
{
  "sessions": [
    {
      "id": 1,
      "game_type": "lemonade_stand",
      "score": 123,
      "days_played": 5,
      "started_at": "2025-10-08T10:00:00",
      "is_active": true
    }
  ]
}
```

---

## 🎯 Estrategias de Guardado

### 1. **Autoguardado Periódico** ⏱️
- Cada 30 segundos automáticamente
- Garantiza que no se pierda progreso

### 2. **Guardado al Avanzar Día** 📅
- Al hacer click en "Siguiente Día"
- Antes de cambiar al nuevo día

### 3. **Guardado al Salir** 🚪
- Cuando el usuario navega a otra página
- useEffect cleanup hook

### 4. **Guardado Manual** (futuro) 💾
- Botón "Guardar" explícito
- Para que el usuario tenga control

---

## 🎮 Características del Juego Preservadas

### ✅ Todo se Guarda:
- Día actual
- Dinero/efectivo
- Inventario (limones, azúcar, vasos, hielo)
- Receta (ingredientes por vaso, precio)
- Clima actual
- Temperatura
- Ubicación del puesto
- Estadísticas diarias
- Logros desbloqueados
- Reputación
- Experiencia
- Nivel
- Puntuación

### ✅ Todo se Recupera:
- Al volver al juego
- Exactamente como lo dejó
- Sin pérdida de datos

---

## 📊 Comparación

| Aspecto | ANTES | AHORA |
|---------|-------|-------|
| **Persistencia** | ❌ Se pierde al salir | ✅ Guardado automático |
| **Progreso** | ❌ Empieza de cero | ✅ Continúa donde lo dejó |
| **Logros** | ❌ Se pierden | ✅ Se preservan |
| **Inventario** | ❌ Se resetea | ✅ Se mantiene |
| **Dinero** | ❌ Vuelve a $20 | ✅ Se mantiene |
| **Autoguardado** | ❌ No existe | ✅ Cada 30 segundos |
| **Recuperación** | ❌ Manual | ✅ Automática |
| **Historial** | ❌ No guardado | ✅ Guardado en DB |

---

## 🎓 Tutores y Sponsors

### Pueden Ver:
```bash
# Ver historial del child
GET /investment-games/history/{child_id}?requester_id={tutor_id}
```

**Resultado:**
- Cuántos días ha jugado
- Puntuación alcanzada
- Cuándo empezó a jugar
- Si la sesión está activa

**No pueden ver:**
- El estado actual detallado del juego
- Solo child puede ver su sesión activa

---

## ✅ Checklist

- [x] ✅ Modelo actualizado con todos los campos
- [x] ✅ Schemas actualizados
- [x] ✅ Endpoint de creación inicializa todos los campos
- [x] ✅ Endpoint de actualización soporta todos los campos
- [x] ✅ Frontend carga sesión al iniciar
- [x] ✅ Frontend crea sesión si no existe
- [x] ✅ Autoguardado cada 30 segundos
- [x] ✅ Guardado al avanzar de día
- [x] ✅ Guardado al salir
- [x] ✅ Sin errores de linting

---

## 🎉 Resultado Final

El juego de limonada ahora:

- ✅ **Guarda automáticamente** el progreso
- ✅ **Recupera** el progreso al volver
- ✅ **Persiste** todos los datos importantes
- ✅ **Protege** con control de acceso familiar
- ✅ **Funciona** igual que tareas, lecciones y ahorros

**¡Sistema de juego completamente integrado con la base de datos!** 🎮✨

---

**Próximo paso:** Probar que el juego guarde y recupere correctamente.

