# 🚀 Quick Start - Sistema de Relaciones Familiares

## ⚡ Inicio Rápido

### Si tienes una base de datos NUEVA:

```bash
cd backend
python create_tables.py
python test_relations.py
```

### Si tienes una base de datos EXISTENTE:

```bash
cd backend
python migrate_user_relations.py
python test_relations.py
```

---

## 📋 Checklist de Implementación

- [x] ✅ Modelo actualizado con Foreign Keys
- [x] ✅ Endpoints de autenticación actualizados
- [x] ✅ Endpoints de tareas con validaciones de seguridad
- [x] ✅ Script de migración creado
- [x] ✅ Script de pruebas creado
- [x] ✅ Documentación completa

---

## 🎯 Lo que Cambió (Resumen Ejecutivo)

### ANTES:
- Relaciones basadas en emails (`tutor_email`, `child_email`)
- Sin integridad referencial
- Sin validaciones de seguridad
- Cualquiera podía crear tareas para cualquier child

### AHORA:
- ✅ Relaciones basadas en IDs con Foreign Keys (`tutor_id`, `sponsored_child_id`)
- ✅ Integridad referencial garantizada
- ✅ Validaciones de seguridad en todos los endpoints
- ✅ Tutores y sponsors solo pueden crear tareas para SUS children
- ✅ Children solo ven tareas de SU tutor y sponsors

---

## 🔍 Verificación Rápida

### 1. Verificar que el modelo se actualizó:
```python
from models import User
user = User()
print(hasattr(user, 'tutor_id'))  # Debe ser True
print(hasattr(user, 'sponsored_child_id'))  # Debe ser True
```

### 2. Ejecutar pruebas:
```bash
python test_relations.py
```

### 3. Probar registro de familia:
```bash
curl -X POST http://localhost:8000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "tutor": {
      "name": "Test Tutor",
      "email": "tutor@test.com",
      "password": "test123"
    },
    "child": {
      "name": "Test Child",
      "email": "child@test.com",
      "password": "test123"
    }
  }'
```

---

## 📚 Documentación Completa

Para más detalles, revisa:

1. **`SISTEMA_RELACIONES_FAMILIARES.md`** - Documentación técnica completa
2. **`CAMBIOS_RELACIONES_DB.md`** - Lista detallada de todos los cambios
3. **`migrate_user_relations.py`** - Script de migración comentado
4. **`test_relations.py`** - Suite de pruebas completa

---

## 🔧 Comandos Útiles

### Ver estructura de la tabla users:
```bash
sqlite3 littlefounders.db "PRAGMA table_info(users);"
```

### Ver todas las relaciones:
```bash
python -c "from database import SessionLocal; from models import User; db = SessionLocal(); users = db.query(User).all(); print('\n'.join([f'{u.name} (ID: {u.id}) - tutor_id: {u.tutor_id}, sponsored_child_id: {u.sponsored_child_id}' for u in users]))"
```

### Resetear base de datos:
```bash
rm littlefounders.db
python create_tables.py
```

---

## 🎓 Ejemplos de Uso

### Ejemplo 1: Registrar familia completa
```python
import requests

response = requests.post('http://localhost:8000/auth/register', json={
    "tutor": {
        "name": "Juan Pérez",
        "email": "juan@example.com",
        "password": "password123",
        "birth_date": "1980-05-15",
        "gender": "masculino"
    },
    "child": {
        "name": "María Pérez",
        "email": "maria@example.com",
        "password": "password123",
        "birth_date": "2010-03-20",
        "gender": "femenino"
    },
    "sponsor": {
        "name": "Ana López",
        "email": "ana@example.com",
        "password": "password123",
        "birth_date": "1975-08-10",
        "gender": "femenino"
    }
})

data = response.json()
tutor_id = data['tutor']['id']
child_id = data['child']['id']
sponsor_id = data['sponsor']['id']
```

### Ejemplo 2: Tutor crea tarea para su child
```python
import requests

response = requests.post(
    f'http://localhost:8000/parent-tasks/?parent_id={tutor_id}',
    json={
        "title": "Lavar los platos",
        "description": "Lavar todos los platos después de la cena",
        "category": "chores",
        "difficulty": "easy",
        "reward": 50.0,
        "assigned_to": child_id
    }
)
```

### Ejemplo 3: Child ve sus tareas
```python
import requests

response = requests.get(f'http://localhost:8000/tasks/available/{child_id}')
tasks = response.json()['tasks']

for task in tasks:
    print(f"Tarea: {task['title']}")
    print(f"Creada por: {task['created_by']} ({task['created_by_type']})")
    print(f"Recompensa: ${task['reward']}")
    print()
```

---

## ⚠️ Problemas Comunes

### Error: "tutor_id column not found"
**Solución:** Ejecuta el script de migración:
```bash
python migrate_user_relations.py
```

### Error: "Foreign key constraint failed"
**Solución:** Verifica que el tutor_id o sponsored_child_id exista:
```python
from database import SessionLocal
from models import User

db = SessionLocal()
tutor = db.query(User).filter(User.id == tutor_id).first()
if not tutor:
    print("Tutor no existe!")
```

### Error: "Only tutors and sponsors can create tasks"
**Solución:** Verifica que estás usando el ID de un usuario con user_type = "tutor" o "sponsor"

### Error: "You can only create tasks for your registered children"
**Solución:** Verifica la relación:
- Para TUTOR: `child.tutor_id` debe ser igual al `tutor.id`
- Para SPONSOR: `sponsor.sponsored_child_id` debe ser igual al `child.id`

---

## 🧪 Testing

### Prueba Manual Completa:

1. **Registrar familia:**
   ```bash
   curl -X POST http://localhost:8000/auth/register -H "Content-Type: application/json" -d '{"tutor":{...}, "child":{...}}'
   ```

2. **Ver familia del tutor:**
   ```bash
   curl http://localhost:8000/auth/family/1
   ```

3. **Ver children del tutor:**
   ```bash
   curl http://localhost:8000/parent-tasks/children/1
   ```

4. **Crear tarea:**
   ```bash
   curl -X POST "http://localhost:8000/parent-tasks/?parent_id=1" -H "Content-Type: application/json" -d '{"title":"Test","reward":50,"assigned_to":2,...}'
   ```

5. **Ver tareas del child:**
   ```bash
   curl http://localhost:8000/tasks/available/2
   ```

---

## 📞 Soporte

¿Problemas? Revisa:
1. ✅ `test_relations.py` pasa todas las pruebas
2. ✅ El servidor está corriendo sin errores
3. ✅ La migración se completó exitosamente
4. ✅ Las columnas `tutor_id` y `sponsored_child_id` existen

Si todo lo anterior está correcto y sigues teniendo problemas, revisa los logs del servidor.

---

## ✨ Features Implementadas

- ✅ Registro de familia en un solo endpoint
- ✅ Relaciones bidireccionales automáticas
- ✅ Validación de seguridad en creación de tareas
- ✅ Filtrado automático de tareas por permisos
- ✅ Endpoint de información familiar completa
- ✅ Soporte para múltiples sponsors por child
- ✅ Migración automática de datos existentes
- ✅ Suite de pruebas automatizada

---

**¡Listo para usar!** 🎉

