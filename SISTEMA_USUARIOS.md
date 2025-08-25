# Sistema de Usuarios - LittleFounders

## Descripción General

Se ha implementado un sistema completo de usuarios con diferentes tipos de dashboards según el rol del usuario. Todos los datos se guardan en el archivo `users.txt` del backend.

## Tipos de Usuario

### 1. Padre o Tutor (`tutor`)
- **Dashboard**: Panel de control completo con métricas empresariales
- **Funcionalidades**: Monitoreo de ingresos, usuarios activos, adopción del producto
- **Título del Dashboard**: "Panel de Control - Padre o Tutor"

### 2. Niño (`child`)
- **Dashboard**: Dashboard amigable y colorido diseñado específicamente para niños
- **Funcionalidades**:
  - Métricas de lecciones completadas
  - Minutos estudiados
  - Puntos ganados
  - Racha actual de estudio
  - Logros desbloqueables
  - Próximas lecciones
  - Acciones rápidas
- **Título del Dashboard**: Dashboard personalizado con saludo amigable

### 3. Patrocinador (`sponsor`)
- **Dashboard**: Panel de control completo (mismo que el tutor)
- **Funcionalidades**: Mismas métricas que el tutor
- **Título del Dashboard**: "Panel de Control - Patrocinador"

## Estructura de Datos

### Campos de Registro
Todos los usuarios incluyen:
- `email`: Correo electrónico único
- `name`: Nombre completo
- `password`: Contraseña hasheada
- `user_type`: Tipo de usuario (tutor/child/sponsor)
- `birth_date`: Fecha de nacimiento
- `gender`: Género

### Campos Específicos por Tipo

#### Niño (`child`)
- `tutor_email`: Enlace al tutor
- `lessons_completed`: Lecciones completadas
- `minutes_studied`: Minutos estudiados
- `points_earned`: Puntos ganados

#### Patrocinador (`sponsor`)
- `child_email`: Enlace al niño

## Flujo de Registro

1. **Paso 1**: Datos del Padre/Tutor (incluye contraseña)
2. **Paso 2**: Datos del Niño (incluye contraseña)
3. **Paso 3**: Opcional - Datos del Patrocinador (incluye contraseña)
4. **Finalización**: Todos los datos se envían al backend y se guardan en `users.txt`

## Flujo de Login

1. Usuario ingresa email y contraseña
2. Sistema valida credenciales
3. Se determina el tipo de usuario
4. Se redirige al dashboard correspondiente
5. Se muestra el nombre y tipo de usuario en la barra superior

## Características del Dashboard Infantil

### Métricas Principales
- **Lecciones Completadas**: Contador de lecciones terminadas
- **Minutos Estudiados**: Tiempo total de estudio
- **Puntos Ganados**: Sistema de puntos por actividades
- **Racha Actual**: Días consecutivos de estudio

### Secciones Especiales
- **Meta Semanal**: Progreso hacia objetivos semanales
- **Próximas Lecciones**: Lista de lecciones disponibles
- **Logros**: Sistema de badges desbloqueables
- **Acciones Rápidas**: Botones para acceso rápido

### Diseño
- Colores vibrantes y amigables
- Iconos grandes y claros
- Mensajes motivacionales
- Gradientes atractivos
- Animaciones suaves

## Seguridad

### Autenticación
- Contraseñas hasheadas con SHA-256
- Validación de sesión en todas las rutas protegidas
- Redirección automática al login si no hay sesión

### Protección de Rutas
- `ProtectedRoute` component para rutas que requieren autenticación
- Verificación de datos de usuario válidos
- Limpieza automática de datos corruptos

## Credenciales de Prueba

### Usuarios Demo
- **Padre/Tutor**: `tutor@demo.com` / `password123`
- **Niño**: `nino@demo.com` / `password123`
- **Patrocinador**: `patrocinador@demo.com` / `password123`

## Archivos Modificados/Creados

### Backend
- `backend/main.py`: Sistema completo de registro y login

### Frontend
- `src/pages/Register.tsx`: Formulario de registro con contraseñas
- `src/pages/Login.tsx`: Login actualizado con tipos de usuario
- `src/pages/Index.tsx`: Dashboard dinámico según tipo de usuario
- `src/components/dashboard/ChildDashboard.tsx`: Dashboard infantil
- `src/components/dashboard/TopNav.tsx`: Navegación con información de usuario
- `src/components/auth/ProtectedRoute.tsx`: Protección de rutas
- `src/App.tsx`: Rutas protegidas

## Funcionalidades Implementadas

✅ **Registro completo** con contraseñas para todos los usuarios
✅ **Guardado en archivo TXT** del backend
✅ **Login diferenciado** por tipo de usuario
✅ **Dashboard específico** para niños con métricas educativas
✅ **Dashboard adaptado** para tutor y patrocinador
✅ **Protección de rutas** con autenticación
✅ **Sistema de logout** funcional
✅ **Interfaz responsiva** y amigable
✅ **Validaciones** completas de formularios
✅ **Mensajes de error** informativos

## Próximos Pasos Sugeridos

1. **Persistencia de métricas**: Actualizar métricas en tiempo real
2. **Sistema de logros**: Implementar más badges y recompensas
3. **Progreso de lecciones**: Conectar con el sistema de lecciones
4. **Notificaciones**: Sistema de alertas personalizadas
5. **Perfil de usuario**: Página de perfil específica por tipo
6. **Configuraciones**: Panel de configuración personalizable
