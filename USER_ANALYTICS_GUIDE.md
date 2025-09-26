# Guía de Analytics de Usuario - LittleFounders

## Descripción General

Se ha implementado un sistema completo de analytics que trackea el tiempo que cada tipo de usuario (tutor, child, sponsor) pasa en cada página del sidebar. Los datos se envían automáticamente a PostHog para análisis.

## Características Principales

### 1. Tracking por Tipo de Usuario
- **Tutor**: Padres o tutores responsables
- **Child**: Usuarios principales (niños)
- **Sponsor**: Patrocinadores financieros

### 2. Páginas del Sidebar Trackeadas
- **Inicio** (`/dashboard`)
- **Mis Ahorros** (`/savings`)
- **Amiguitos** (`/customers`)
- **Tiendita** (`/store`)
- **Mi Equipo** (`/team`)
- **Lecciones** (`/lecciones`)
- **Lecciones V.2** (`/lecciones-v2`)
- **Mis Tareas** (`/tasks`) - Solo para niños
- **Gestión de Tareas** (`/parent-tasks`) - Solo para padres
- **Aprende a invertir** (`/investment-games`)
- **Banca Digital** (`/growth`)
- **Lemonade Stand** (`/lemonade-stand`) - Solo para niños

### 3. Eventos de PostHog

#### Eventos Principales
- `user_page_time_start`: Inicio de tiempo en página
- `user_page_time_update`: Actualización periódica del tiempo
- `user_page_time_final`: Tiempo final en página
- `user_page_activity_resumed`: Usuario vuelve a estar activo
- `user_page_activity_paused`: Usuario se vuelve inactivo

#### Eventos de Analytics
- `user_analytics_loaded`: Carga de analytics de usuario
- `user_engagement_by_type`: Engagement por tipo de usuario
- `sidebar_page_analytics`: Analytics específicos de páginas del sidebar
- `user_session_metrics`: Métricas de sesión por tipo de usuario

#### Eventos de Sesión
- `user_session_time_update`: Actualización de tiempo de sesión
- `user_session_final`: Finalización de sesión

## Estructura de Datos

### Información del Usuario
```typescript
{
  user_id: string,
  user_type: 'tutor' | 'child' | 'sponsor',
  user_name: string
}
```

### Información de Página
```typescript
{
  page: string,           // Ruta de la página
  page_name: string,      // Nombre legible de la página
  page_category: string,  // Categoría de la página
  duration: number,       // Tiempo en milisegundos
  duration_seconds: number, // Tiempo en segundos
  duration_minutes: number  // Tiempo en minutos
}
```

### Información de Sesión
```typescript
{
  session_id: string,
  session_duration: number,
  pages_visited: number,
  average_page_time: number,
  is_active: boolean
}
```

## Uso en Componentes

### Hook Principal
```typescript
import { useUserAnalytics } from '@/hooks/useUserAnalytics'

const MyComponent = () => {
  const { stats, getSessionSummary } = useUserAnalytics()
  
  // Obtener estadísticas en tiempo real
  const summary = getSessionSummary()
  
  return (
    <div>
      <p>Usuario: {summary.user.typeInfo.label}</p>
      <p>Página actual: {summary.currentPage.name}</p>
      <p>Tiempo en página: {summary.currentPage.formattedDuration}</p>
    </div>
  )
}
```

### Hook de Tracking Personalizado
```typescript
import { usePostHogUserTracking } from '@/components/analytics/PostHogUserAnalytics'

const MyComponent = () => {
  const { trackUserAction, trackEngagement } = usePostHogUserTracking()
  
  const handleButtonClick = () => {
    trackUserAction('button_clicked', {
      button_name: 'submit_form',
      form_data: { /* datos del formulario */ }
    })
  }
  
  const handleScroll = () => {
    trackEngagement('scroll_depth', 75) // 75% de scroll
  }
}
```

## Configuración de PostHog

### Variables de Entorno
```env
VITE_POSTHOG_KEY=tu_clave_de_posthog
VITE_POSTHOG_HOST=https://app.posthog.com
```

### Eventos Recomendados para Dashboards

#### 1. Tiempo por Tipo de Usuario
- **Evento**: `user_page_time_final`
- **Filtros**: `user_type`, `page_name`
- **Métricas**: `duration_minutes`

#### 2. Engagement por Página
- **Evento**: `sidebar_page_analytics`
- **Filtros**: `page_name`, `user_type`
- **Métricas**: `time_spent_minutes`, `engagement_level`

#### 3. Sesiones por Usuario
- **Evento**: `user_session_final`
- **Filtros**: `user_type`
- **Métricas**: `session_duration_minutes`, `pages_visited`

## Componentes de Demostración

### UserAnalyticsDemo
Componente flotante que muestra analytics en tiempo real durante el desarrollo.

### UserPageTimeTrackerComponent
Componente principal que maneja el tracking automático.

## Características Técnicas

### Detección de Inactividad
- **Umbral**: 30 segundos sin actividad
- **Eventos monitoreados**: mousedown, mousemove, keypress, scroll, touchstart, click

### Tracking Periódico
- **Intervalo**: 15 segundos para actualizaciones de tiempo
- **Intervalo de sesión**: 60 segundos para métricas de sesión

### Persistencia
- Los datos se almacenan en localStorage para persistencia entre sesiones
- Los eventos se envían inmediatamente a PostHog

## Debugging

### Modo Debug
En desarrollo, se muestra información detallada en la consola:
```typescript
// En PostHogProvider.tsx
<UserPageTimeTrackerComponent enableDebugMode={import.meta.env.DEV}>
```

### Componente de Demostración
```typescript
// En App.tsx
<UserAnalyticsDemo showDemo={import.meta.env.DEV} />
```

## Métricas Clave en PostHog

### 1. Tiempo Promedio por Página
- **Fórmula**: `duration_minutes` promedio por `page_name`
- **Segmentación**: Por `user_type`

### 2. Engagement por Tipo de Usuario
- **Fórmula**: `time_spent_minutes` por `user_type`
- **Visualización**: Gráfico de barras

### 3. Páginas Más Visitadas
- **Fórmula**: Conteo de `page_name`
- **Segmentación**: Por `user_type`

### 4. Duración de Sesión
- **Fórmula**: `session_duration_minutes` promedio
- **Segmentación**: Por `user_type`

## Consideraciones de Privacidad

- Los datos se envían solo cuando el usuario está activo
- Se respeta la configuración de `respect_dnt` de PostHog
- Los datos de usuario se almacenan localmente y se envían de forma anónima a PostHog

## Troubleshooting

### Problemas Comunes

1. **No se envían eventos a PostHog**
   - Verificar variables de entorno
   - Revisar configuración de PostHog

2. **Tracking no funciona en ciertas páginas**
   - Verificar que la página esté en `SIDEBAR_PAGES`

3. **Datos inconsistentes**
   - Verificar que el usuario esté logueado
   - Revisar localStorage para datos de usuario

### Logs de Debug
```typescript
// Habilitar logs detallados
console.log('User Analytics:', {
  userType: stats.userType,
  currentPage: stats.currentPage,
  sessionDuration: stats.sessionDuration
})
```
