# Refinamiento del Sistema de Metas de Ahorro

## Resumen de Cambios

Se ha implementado un sistema de asignación y visibilidad familiar para las metas de ahorro, similar al sistema de tareas existente.

## Cambios en el Backend

### 1. Modelo `SavingsGoal` (models.py)

Se agregaron dos nuevos campos:

```python
created_by = Column(Integer, ForeignKey("users.id"), nullable=False)  # Quien creó la meta
assigned_to = Column(Integer, ForeignKey("users.id"))  # Para tutores asignando a children
```

**Lógica:**
- `user_id`: Propietario de la meta (a quien pertenece)
- `created_by`: Quien creó la meta (puede ser tutor, child o sponsor)
- `assigned_to`: Si un tutor asigna una meta a un child, este campo contiene el ID del child

### 2. Schemas (schemas.py)

- **`SavingsGoalCreate`**: Ahora acepta `assigned_to` como campo opcional
- **`SavingsGoalResponse`**: Incluye `created_by` y `assigned_to` en la respuesta

### 3. Endpoints (savings/endpoints.py)

#### Nuevo endpoint: `GET /savings/children/{tutor_id}`
Retorna la lista de children de un tutor para poder asignarles metas.

#### Modificado: `POST /savings/goals`
- Si se proporciona `assigned_to`:
  - El `user_id` de la meta será el child asignado
  - `created_by` será el tutor que la crea
  - Se verifica la relación familiar
- Si NO se proporciona `assigned_to`:
  - El usuario crea la meta para sí mismo
  - `user_id` = `created_by`

#### Modificado: `GET /savings/goals/{user_id}`
Retorna metas según el tipo de usuario:

- **CHILD**: Solo sus propias metas
- **TUTOR**: Sus propias metas + metas de todos sus children (tanto creadas por el tutor como por los children)
- **SPONSOR**: Sus propias metas + metas de su sponsored child

## Cambios en el Frontend

### 1. Componente `SavingsGoals.tsx`

#### Nuevos estados:
```typescript
const [children, setChildren] = useState<Child[]>([]);
const [userType, setUserType] = useState<string>("");
```

#### Nuevas interfaces:
```typescript
interface SavingsGoal {
  // ... campos existentes
  createdBy?: number;
  assignedTo?: number;
  userId?: number;
}

interface Child {
  id: number;
  name: string;
  email: string;
}
```

#### Selector de Children (solo para tutores)
Cuando un tutor crea una meta, puede:
- Dejarla para sí mismo (sin asignar)
- Asignarla a uno de sus children

#### Badges informativos
Las metas ahora muestran:
- **"Meta de hijo"**: Si el tutor está viendo la meta de un child
- **"Asignada por tutor"**: Si un child tiene una meta que le asignó su tutor

## Migración de Base de Datos

### Script: `migrate_savings_goals.py`

Ejecutar este script para actualizar la base de datos existente:

```bash
cd backend
python migrate_savings_goals.py
```

El script:
1. Agrega columna `created_by` (NOT NULL)
2. Agrega columna `assigned_to` (NULLABLE)
3. Agrega foreign keys a `users.id`
4. Rellena `created_by` con valores de `user_id` para registros existentes

## Flujo de Uso

### Caso 1: Child crea su propia meta
1. Child accede a "Mis Ahorros"
2. Crea una nueva meta
3. La meta aparece en su cuenta
4. **Visibilidad**: Tutor y Sponsor pueden ver esta meta

### Caso 2: Tutor crea meta para sí mismo
1. Tutor accede a "Mis Ahorros"
2. Crea una nueva meta sin asignar a ningún child
3. La meta solo le pertenece al tutor
4. **Visibilidad**: Solo el tutor la ve

### Caso 3: Tutor asigna meta a un child
1. Tutor accede a "Mis Ahorros"
2. Crea una nueva meta
3. Selecciona un child en el dropdown "Asignar a"
4. La meta aparece en la cuenta del child
5. **Visibilidad**: El child, el tutor y los sponsors del child pueden verla
6. El child verá un badge "Asignada por tutor"

### Caso 4: Sponsor visualiza metas del sponsored child
1. Sponsor accede a "Mis Ahorros"
2. Ve sus propias metas + todas las metas de su sponsored child
3. Puede distinguir cuáles son del child por el badge "Meta de hijo"

## Comportamiento de Visibilidad

### CHILD
- ✅ Ve sus propias metas
- ✅ Ve metas asignadas por su tutor
- ❌ No ve metas de otros

### TUTOR
- ✅ Ve sus propias metas
- ✅ Ve todas las metas de sus children (creadas por ellos o asignadas por el tutor)
- ✅ Puede crear metas para sí mismo
- ✅ Puede asignar metas a sus children

### SPONSOR
- ✅ Ve sus propias metas
- ✅ Ve todas las metas de su sponsored child
- ❌ No puede asignar metas (solo visualizar)

## Verificación de Seguridad

- ✅ `verify_family_access()`: Verifica relaciones familiares antes de asignar metas
- ✅ `verify_ownership()`: Verifica propiedad antes de modificar metas
- ✅ Foreign keys en BD aseguran integridad referencial
- ✅ Solo tutores pueden asignar metas a children

## Próximos Pasos (Opcional)

1. Agregar notificaciones cuando un tutor asigna una meta
2. Permitir que sponsors también puedan crear/asignar metas a su sponsored child
3. Agregar historial de quién creó/modificó cada meta
4. Dashboard de metas familiares para tutores

## Archivos Modificados

**Backend:**
- `backend/models.py` - Modelo SavingsGoal actualizado
- `backend/schemas.py` - Schemas actualizados
- `backend/savings/endpoints.py` - Endpoints modificados y nuevo endpoint
- `backend/migrate_savings_goals.py` - Script de migración (nuevo)

**Frontend:**
- `src/components/banking/SavingsGoals.tsx` - Componente actualizado con selector de children y badges

## Pruebas Sugeridas

1. **Como Tutor:**
   - [ ] Crear meta para sí mismo
   - [ ] Crear meta asignada a un child
   - [ ] Ver metas de children en la lista
   - [ ] Verificar que aparecen badges correctos

2. **Como Child:**
   - [ ] Crear meta propia
   - [ ] Ver meta asignada por tutor
   - [ ] Verificar badge "Asignada por tutor"

3. **Como Sponsor:**
   - [ ] Ver metas del sponsored child
   - [ ] Verificar badge "Meta de hijo"

4. **Migración:**
   - [ ] Ejecutar script de migración
   - [ ] Verificar que metas existentes tienen `created_by` poblado
   - [ ] Verificar que no hay errores en la BD

