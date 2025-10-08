# Sistema de Relaciones Familiares

## Descripción General

Este sistema implementa relaciones jerárquicas entre usuarios (Tutor, Child, Sponsor) utilizando Foreign Keys de SQLAlchemy, garantizando integridad referencial y control de acceso adecuado.

## Estructura de Relaciones

### Flujo de Registro

1. **Primero se registra el TUTOR**
   - Es el guardián/padre del niño
   - Puede tener múltiples hijos (children)

2. **Luego se registra el CHILD**
   - Se vincula automáticamente con el tutor mediante `tutor_id`
   - Solo puede tener un tutor

3. **Opcionalmente se registra el SPONSOR**
   - Se vincula con el niño mediante `sponsored_child_id`
   - Puede patrocinar a un niño específico

### Modelo de Base de Datos

```python
class User(Base):
    # ... campos básicos ...
    
    # Foreign Keys
    tutor_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    sponsored_child_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    # Relationships
    children = relationship("User", foreign_keys=[tutor_id], back_populates="tutor")
    tutor = relationship("User", foreign_keys=[tutor_id], back_populates="children")
    sponsors = relationship("User", foreign_keys=[sponsored_child_id], back_populates="sponsored_child")
    sponsored_child = relationship("User", foreign_keys=[sponsored_child_id], back_populates="sponsors")
```

### Diagrama de Relaciones

```
TUTOR (id: 1)
    ↓ tutor_id
CHILD (id: 2, tutor_id: 1)
    ↑ sponsored_child_id
SPONSOR (id: 3, sponsored_child_id: 2)
```

## Endpoints Principales

### 1. Registro de Familia

**POST** `/auth/register`

Registra una familia completa (tutor + child + sponsor opcional) en una sola operación.

```json
{
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
    "name": "Ana Sponsor",
    "email": "ana@example.com",
    "password": "password123",
    "birth_date": "1975-08-10",
    "gender": "femenino"
  }
}
```

**Proceso interno:**
1. Crea el tutor y obtiene su ID
2. Crea el child vinculándolo con `tutor_id`
3. Si hay sponsor, lo crea vinculándolo con `sponsored_child_id`

### 2. Obtener Familia

**GET** `/auth/family/{user_id}`

Obtiene toda la información familiar relacionada con un usuario.

**Respuesta según tipo de usuario:**

- **CHILD**: Devuelve su tutor y sponsors
- **TUTOR**: Devuelve todos sus children
- **SPONSOR**: Devuelve el child patrocinado y el tutor del child

### 3. Crear Tarea para Child

**POST** `/parent-tasks/`

Permite a tutores y sponsors crear tareas para sus children.

**Validaciones de seguridad:**
- Verifica que el parent sea TUTOR o SPONSOR
- Verifica que el child esté relacionado con ese parent:
  - Si es TUTOR: verifica `child.tutor_id == parent_id`
  - Si es SPONSOR: verifica `parent.sponsored_child_id == child.id`

### 4. Ver Tareas Disponibles (Child)

**GET** `/tasks/available/{user_id}`

Lista todas las tareas asignadas a un niño.

**Validaciones de seguridad:**
- Solo muestra tareas creadas por el tutor o sponsors autorizados
- Filtra por `created_by` usando la lista de authorized_creators
- Incluye información del creador (nombre y tipo)

### 5. Obtener Children de un Parent

**GET** `/parent-tasks/children/{parent_id}`

Lista todos los children relacionados con un parent.

**Lógica:**
- Si es TUTOR: busca todos los users con `tutor_id == parent_id`
- Si es SPONSOR: busca el user con `id == sponsored_child_id`

## Reglas de Negocio

### Control de Acceso

1. **Tutores pueden:**
   - Ver todos sus children
   - Crear tareas solo para sus children
   - Aprobar/rechazar tareas de sus children

2. **Sponsors pueden:**
   - Ver el child que patrocinan
   - Crear tareas solo para ese child
   - No pueden aprobar tareas (solo el tutor)

3. **Children pueden:**
   - Ver solo las tareas creadas por su tutor o sponsors
   - Completar tareas con evidencia
   - Ver su información familiar

### Integridad Referencial

- Las relaciones usan Foreign Keys, garantizando:
  - No se puede asignar un tutor_id inexistente
  - No se puede asignar un sponsored_child_id inexistente
  - Al eliminar un usuario, se deben manejar las relaciones (CASCADE o SET NULL)

### Validaciones

1. **Al registrar:** Verificar emails únicos
2. **Al crear tareas:** Verificar relación parent-child
3. **Al ver tareas:** Filtrar solo por creators autorizados
4. **Al aprobar tareas:** Verificar que el aprobador sea el creador o tutor

## Migración de Datos

Para migrar de la estructura antigua (email-based) a la nueva (ID-based):

```bash
cd backend
python migrate_user_relations.py
```

Este script:
1. Crea las nuevas columnas `tutor_id` y `sponsored_child_id`
2. Migra los datos de `tutor_email` y `child_email`
3. Agrega Foreign Keys (según la base de datos)
4. Opcionalmente elimina las columnas antiguas

## Ventajas del Sistema

1. **Integridad Referencial**: Las Foreign Keys garantizan consistencia
2. **Rendimiento**: Joins por ID son más rápidos que por email
3. **Seguridad**: Control de acceso basado en relaciones verificables
4. **Escalabilidad**: Fácil agregar más tipos de relaciones
5. **Mantenibilidad**: Código más claro y menos propenso a errores

## Ejemplos de Uso

### Ejemplo 1: Registro de Familia

```python
# POST /auth/register
family_data = {
    "tutor": {...},
    "child": {...},
    "sponsor": {...}  # opcional
}
# Resultado: Familia registrada con relaciones correctas
```

### Ejemplo 2: Tutor Crea Tarea

```python
# POST /parent-tasks/?parent_id=1
task_data = {
    "title": "Lavar los platos",
    "assigned_to": 2,  # ID del child
    "reward": 50.0
}
# Validación: Verifica que child.tutor_id == 1
```

### Ejemplo 3: Child Ve Sus Tareas

```python
# GET /tasks/available/2
# Resultado: Solo tareas creadas por:
#   - Su tutor (id: 1)
#   - Sus sponsors (si los tiene)
```

## Próximas Mejoras

1. **Múltiples Tutores**: Permitir que un child tenga más de un tutor
2. **Múltiples Sponsors**: Ya soportado en el modelo actual
3. **Roles y Permisos**: Sistema más granular de permisos
4. **Historial de Relaciones**: Auditoría de cambios en relaciones
5. **Invitaciones**: Sistema de invitación para sponsors

## Notas Técnicas

- **Base de datos**: Compatible con SQLite, PostgreSQL, MySQL
- **ORM**: SQLAlchemy con relationships bidireccionales
- **Validaciones**: En capa de endpoints y modelo
- **Testing**: Se recomienda agregar tests unitarios para cada relación

