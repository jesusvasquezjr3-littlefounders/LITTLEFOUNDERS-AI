# Quick Start - Sistema de Activación de Banca en Línea

## Pasos para Poner en Marcha el Sistema

### 1. Actualizar la Base de Datos

Ejecuta el script de migración para agregar el campo `has_virtual_card`:

```bash
cd backend
python migrate_add_virtual_card.py
```

**Salida esperada:**
```
Iniciando migración para agregar campo has_virtual_card...
Migrando X usuarios...
✅ Migración completada: X usuarios actualizados

Resumen:
  Usuarios con tarjeta: 0
  Usuarios sin tarjeta: X
Migración finalizada
```

### 2. Reiniciar el Backend

```bash
cd backend
# Si usas uvicorn
uvicorn main:app --reload

# O si usas python directamente
python -m uvicorn main:app --reload
```

### 3. Verificar los Endpoints

Prueba que los nuevos endpoints funcionen:

```bash
# Verificar estado de un usuario
curl http://localhost:8000/virtual-cards/status/1

# Generar tarjeta (requiere POST con datos)
curl -X POST http://localhost:8000/virtual-cards/generate/1 \
  -H "Content-Type: application/json" \
  -d '{"child_id": 2}'
```

### 4. Frontend - No Requiere Cambios Adicionales

El frontend ya está actualizado con:
- ✅ Verificación de tarjeta en Banca Digital
- ✅ Mensajes para activación
- ✅ Pestaña de Tarjetas Virtuales en Gestión Familiar
- ✅ Validación en la tiendita

## Flujo de Uso para Probar

### Como Tutor/Patrocinador:

1. **Login** con tu cuenta de tutor o patrocinador
2. Ve a **"Banca Digital"**
3. Verás un mensaje: *"Activa la Banca en Línea"*
4. Haz clic en **"Ir a Gestión Familiar"**
5. Selecciona la pestaña **"Tarjetas Virtuales"**
6. Haz clic en **"Generar Tarjeta"**
7. Selecciona al hijo en el menú desplegable
8. Haz clic en **"Generar Tarjeta"**
9. ✅ Verás un mensaje de éxito

### Como Niño (antes de la activación):

1. **Login** con tu cuenta de niño
2. Ve a **"Banca Digital"**
3. Verás el mensaje: *"Banca en Línea no Activada"*
4. *"Habla con tu tutor o patrocinador para que active tu banca en línea"*

### Como Niño (después de la activación):

1. **Recarga la página** o vuelve a entrar a Banca Digital
2. Ahora puedes ver:
   - Tu tarjeta virtual con todos los datos
   - Todas las pestañas (Cuentas, Ingresos, Gastos, Estado de Cuenta)
   - Puedes realizar compras en la tiendita
   - Puedes ver tus transacciones

## Comandos Útiles

### Ver logs del backend
```bash
# Los logs mostrarán si hay errores en los endpoints
tail -f backend/logs/app.log
```

### Verificar estado de la base de datos
```bash
cd backend
python
>>> from database import SessionLocal
>>> from models import User
>>> db = SessionLocal()
>>> users = db.query(User).all()
>>> for u in users:
...     print(f"{u.name} ({u.user_type.value}): has_card={u.has_virtual_card}")
```

### Restablecer tarjetas (para testing)
```bash
cd backend
python
>>> from database import SessionLocal
>>> from models import User
>>> db = SessionLocal()
>>> # Quitar tarjetas a todos
>>> db.query(User).update({"has_virtual_card": False})
>>> db.commit()
```

## Estructura de Archivos Modificados

```
backend/
├── models.py                           # ✅ Campo has_virtual_card añadido
├── main.py                             # ✅ Router de virtual_cards incluido
├── auth/
│   └── endpoints.py                    # ✅ has_virtual_card en respuesta de login
├── virtual_cards/
│   ├── __init__.py                     # ✅ Nuevo módulo
│   └── endpoints.py                    # ✅ Endpoints de gestión de tarjetas
└── migrate_add_virtual_card.py         # ✅ Script de migración

src/
├── pages/
│   ├── DigitalBanking.tsx              # ✅ Mensajes de activación
│   └── Store.tsx                       # ✅ Validación de tarjeta
└── components/banking/
    └── ParentAccountManagement.tsx     # ✅ Pestaña de Tarjetas Virtuales
```

## Troubleshooting

### Problema: "Module 'virtual_cards' has no attribute 'endpoints'"
**Solución:** Verifica que el archivo `backend/virtual_cards/__init__.py` exista

### Problema: "Column 'has_virtual_card' does not exist"
**Solución:** Ejecuta el script de migración:
```bash
cd backend
python migrate_add_virtual_card.py
```

### Problema: El frontend no muestra los mensajes de activación
**Solución:** 
1. Verifica que el backend esté corriendo
2. Abre las DevTools del navegador y revisa la consola
3. Verifica que la llamada a `/virtual-cards/status/{user_id}` esté funcionando

### Problema: "You are not related to this child"
**Solución:** 
- Verifica que el tutor esté relacionado con el child en la base de datos
- Revisa que `child.tutor_id` sea igual al ID del tutor
- Para patrocinadores, verifica que `sponsor.sponsored_child_id` sea igual al ID del child

## Próximos Pasos

Después de implementar el sistema:

1. **Testing completo**
   - Prueba con diferentes tipos de usuarios
   - Verifica las validaciones
   - Prueba los casos extremos

2. **Documentación para usuarios finales**
   - Crea tutoriales en video
   - Agrega tooltips en la UI
   - Prepara FAQs

3. **Monitoreo**
   - Agrega logs para rastrear generación de tarjetas
   - Implementa métricas de uso
   - Configura alertas

## Contacto y Soporte

Si encuentras algún problema o necesitas ayuda:
- Revisa los logs del backend
- Verifica la documentación completa en `SISTEMA_ACTIVACION_BANCA.md`
- Revisa la consola del navegador para errores de frontend

