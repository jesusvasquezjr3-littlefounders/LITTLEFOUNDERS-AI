# Sistema de Activación de Banca en Línea

## Descripción General

Se ha implementado un sistema de activación de banca en línea que requiere que el tutor o patrocinador genere una tarjeta virtual para el niño antes de que pueda acceder a las funcionalidades de la banca digital.

## Cambios Implementados

### 1. Backend

#### Modelo de Datos
- **Campo añadido**: `has_virtual_card` (Boolean) en el modelo `User`
- **Ubicación**: `backend/models.py`
- **Valor por defecto**: `False`

#### Endpoints Nuevos
**Ubicación**: `backend/virtual_cards/endpoints.py`

1. **POST `/virtual-cards/generate/{parent_id}`**
   - Genera una tarjeta virtual para un child
   - Solo puede ser ejecutado por tutores o patrocinadores relacionados
   - Requiere: `child_id` en el cuerpo de la petición

2. **GET `/virtual-cards/status/{user_id}`**
   - Obtiene el estado de la tarjeta virtual de un usuario
   - Para tutores/patrocinadores: devuelve información de sus hijos
   - Para niños: devuelve su propio estado

3. **DELETE `/virtual-cards/revoke/{parent_id}/{child_id}`**
   - Revoca la tarjeta virtual de un child
   - Solo puede ser ejecutado por el tutor

4. **GET `/virtual-cards/children-without-card/{parent_id}`**
   - Lista los hijos sin tarjeta virtual

#### Script de Migración
**Ubicación**: `backend/migrate_add_virtual_card.py`

Para ejecutar la migración:
```bash
cd backend
python migrate_add_virtual_card.py
```

Esto agregará el campo `has_virtual_card` a todos los usuarios existentes con valor `False`.

### 2. Frontend

#### Página de Banca Digital
**Ubicación**: `src/pages/DigitalBanking.tsx`

**Comportamiento para niños SIN tarjeta:**
- Muestra un mensaje: "Banca en Línea no Activada"
- Indica que deben hablar con su tutor o patrocinador
- No se muestran las funcionalidades de banca

**Comportamiento para tutores/patrocinadores con hijos sin tarjeta:**
- Muestra un mensaje: "Activa la Banca en Línea"
- Botón para ir a "Gestión Familiar"
- No se muestran las funcionalidades hasta que todos los hijos tengan tarjeta

**Comportamiento normal:**
- Una vez que el niño tiene tarjeta, puede acceder a todas las funcionalidades:
  - Ver su tarjeta virtual
  - Realizar compras en la tiendita
  - Ver transacciones
  - Ver estado de cuenta

#### Gestión Familiar
**Ubicación**: `src/components/banking/ParentAccountManagement.tsx`

**Nueva pestaña: "Tarjetas Virtuales"**
- Lista todos los hijos con su estado de tarjeta
- Botón "Generar Tarjeta" para crear tarjetas virtuales
- Selector de hijo (similar al de tareas)
- Muestra el balance actual de cada hijo
- Badges indicando si tienen tarjeta activa o no

**Proceso de generación:**
1. El tutor/patrocinador va a "Gestión Familiar"
2. Selecciona la pestaña "Tarjetas Virtuales"
3. Hace clic en "Generar Tarjeta"
4. Selecciona al hijo en el menú desplegable
5. Confirma la generación
6. La tarjeta se activa inmediatamente

#### Tiendita Virtual
**Ubicación**: `src/pages/Store.tsx`

**Validaciones agregadas:**
- Verifica que el niño tenga tarjeta virtual antes de permitir compras
- Mensaje de error si intenta comprar sin tarjeta
- "No tienes una tarjeta virtual activa. Habla con tu tutor o patrocinador."

### 3. Autenticación

**Modificación**: `backend/auth/endpoints.py`

El endpoint de login ahora incluye el campo `has_virtual_card` en la respuesta para niños, permitiendo que el frontend sepa inmediatamente el estado de la tarjeta.

## Flujo de Usuario

### Para el Tutor/Patrocinador

1. **Registro de la familia**
   - Se registra normalmente (no hay cambios aquí)
   - El niño NO tiene tarjeta virtual por defecto

2. **Activación de Banca en Línea**
   - Va a "Banca Digital"
   - Si el niño no tiene tarjeta, ve un mensaje para activarla
   - Hace clic en "Ir a Gestión Familiar"
   - Selecciona la pestaña "Tarjetas Virtuales"
   - Genera la tarjeta para el niño

3. **Después de la activación**
   - Puede ver y administrar todas las funcionalidades de banca
   - Puede transferir dinero al niño
   - Puede configurar mesadas automáticas

### Para el Niño

1. **Inicio sin tarjeta**
   - Al entrar a "Banca Digital", ve el mensaje:
   - "Habla con tu tutor o patrocinador para que active tu banca en línea"
   - No puede acceder a ninguna funcionalidad

2. **Después de la activación**
   - Puede ver su tarjeta virtual con todos sus datos
   - Puede realizar compras en la tiendita
   - Puede ver su historial de transacciones
   - Puede ver su estado de cuenta
   - Puede usar todas las funcionalidades de banca digital

## Validaciones Implementadas

1. **Verificación de relación familiar**
   - Solo tutores/patrocinadores relacionados pueden generar tarjetas
   - Los patrocinadores solo pueden generar para su child patrocinado

2. **Prevención de duplicados**
   - No se puede generar más de una tarjeta por niño
   - El sistema verifica antes de generar

3. **Verificación de compras**
   - La tiendita verifica que el niño tenga tarjeta antes de procesar compras

4. **Estado en tiempo real**
   - El estado de la tarjeta se verifica en cada carga de página
   - Se actualiza automáticamente cuando se genera una tarjeta

## Endpoints de la API

### Generar Tarjeta Virtual
```http
POST /virtual-cards/generate/{parent_id}
Content-Type: application/json

{
  "child_id": 123
}
```

**Respuesta exitosa:**
```json
{
  "success": true,
  "message": "Virtual card generated successfully",
  "child_id": 123,
  "child_name": "Nombre del Niño",
  "has_virtual_card": true
}
```

### Verificar Estado de Tarjeta
```http
GET /virtual-cards/status/{user_id}
```

**Respuesta para tutor:**
```json
{
  "user_type": "tutor",
  "children": [
    {
      "id": 123,
      "name": "Nombre del Niño",
      "email": "nino@ejemplo.com",
      "has_virtual_card": false,
      "balance": 0.0
    }
  ],
  "message": "Parent information retrieved successfully"
}
```

**Respuesta para niño:**
```json
{
  "user_type": "child",
  "has_card": false,
  "balance": 0.0,
  "message": "Tarjeta no generada"
}
```

## Notas Técnicas

### Consideraciones de Seguridad
- Las tarjetas solo pueden ser generadas por tutores/patrocinadores autorizados
- Se verifica la relación familiar antes de cualquier operación
- No se puede revocar tarjetas de niños que no estén relacionados

### Actualización de Datos
- El estado de la tarjeta se verifica cada vez que se carga la página
- En Gestión Familiar, los datos se actualizan cada 5 segundos
- Los cambios son inmediatos en el backend

### Compatibilidad con Usuarios Existentes
- El script de migración establece `has_virtual_card = False` para todos los usuarios existentes
- Los tutores deben generar tarjetas para sus hijos existentes
- No hay cambios retroactivos en el comportamiento

## Testing

### Escenarios de Prueba

1. **Registro nuevo**
   - Verificar que el niño no tiene tarjeta por defecto
   - Verificar mensaje de activación en Banca Digital

2. **Generación de tarjeta**
   - Tutor genera tarjeta para su hijo
   - Verificar que el estado se actualiza
   - Verificar que el niño puede acceder a funcionalidades

3. **Compras**
   - Intentar comprar sin tarjeta (debe fallar)
   - Generar tarjeta
   - Intentar comprar con tarjeta (debe funcionar)

4. **Relaciones familiares**
   - Intentar generar tarjeta para un niño no relacionado (debe fallar)
   - Patrocinador genera tarjeta para su child patrocinado (debe funcionar)

## Próximas Mejoras Posibles

1. **Notificaciones**
   - Notificar al niño cuando se le genera la tarjeta
   - Notificar al tutor cuando el niño intenta usar una función sin tarjeta

2. **Personalización de tarjetas**
   - Permitir al tutor configurar límites antes de generar la tarjeta
   - Permitir elegir diseños de tarjeta

3. **Revocación de tarjetas**
   - Interfaz para que el tutor pueda desactivar temporalmente la tarjeta
   - Historial de activaciones/desactivaciones

4. **Dashboard de administración**
   - Vista consolidada del estado de todas las tarjetas
   - Estadísticas de uso

## Problemas Conocidos

- Ninguno por el momento

## Changelog

### Versión 1.0.0 (Fecha actual)
- Implementación inicial del sistema de activación de banca en línea
- Modelo de datos con campo `has_virtual_card`
- Endpoints para gestión de tarjetas virtuales
- UI para generación de tarjetas en Gestión Familiar
- Mensajes de activación en Banca Digital
- Validaciones en la tiendita virtual

