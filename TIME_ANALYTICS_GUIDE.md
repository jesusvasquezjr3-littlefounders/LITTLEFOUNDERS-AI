# Guía de Analytics de Tiempo - LittleFounders AI

Esta guía explica el sistema completo de analytics de tiempo implementado en LittleFounders AI.

## 📊 Métricas Implementadas

### 1. **Tiempo en Página**
- **Duración exacta** que el usuario pasa en cada página
- **Tracking en tiempo real** con actualizaciones cada 10 segundos
- **Detección de inactividad** después de 30 segundos sin actividad
- **Tiempo final** registrado al salir de la página

### 2. **Tiempo de Sesión**
- **Duración total** de la sesión del usuario
- **Actualizaciones periódicas** cada minuto
- **Tracking de páginas visitadas** durante la sesión
- **Tiempo promedio por página**

### 3. **Engagement Metrics**
- **Nivel de engagement** (high/medium/low) basado en múltiples factores
- **Bounce rate** - páginas con baja engagement (< 30s, < 25% scroll, sin interacción)
- **Scroll depth** - qué tan profundo llegan los usuarios
- **Time to interaction** - tiempo hasta la primera interacción del usuario

## 🎯 Eventos Trackeados

### Eventos de Tiempo
```typescript
// Inicio de página
'page_time_start' - {
  page: string,
  timestamp: string,
  previous_page: string | null,
  session_duration: number
}

// Actualización periódica
'page_time_update' - {
  page: string,
  duration: number,
  duration_seconds: number,
  timestamp: string,
  is_active: boolean
}

// Finalización de página
'page_time_final' - {
  page: string,
  duration: number,
  duration_seconds: number,
  duration_minutes: number,
  timestamp: string,
  is_active: boolean
}
```

### Eventos de Sesión
```typescript
// Actualización de sesión
'session_time_update' - {
  session_duration: number,
  session_duration_minutes: number,
  pages_visited: number,
  current_page: string,
  timestamp: string
}

// Finalización de sesión
'session_final' - {
  session_duration: number,
  session_duration_minutes: number,
  pages_visited: number,
  total_page_time: number,
  average_page_time: number,
  timestamp: string
}
```

### Eventos de Engagement
```typescript
// Nivel de engagement
'page_engagement' - {
  page: string,
  engagement_level: 'high' | 'medium' | 'low',
  duration_seconds: number,
  timestamp: string
}

// Bounce rate
'page_bounce' - {
  page: string,
  duration_seconds: number,
  is_bounce: boolean,
  bounce_threshold: 30,
  timestamp: string
}

// Scroll depth
'scroll_depth' - {
  page: string,
  scroll_depth_percentage: number,
  timestamp: string
}

// Time to interaction
'time_to_interaction' - {
  page: string,
  time_to_first_click_ms: number,
  time_to_first_click_seconds: number,
  timestamp: string
}
```

### Eventos de Actividad
```typescript
// Usuario inactivo
'page_activity_paused' - {
  page: string,
  timestamp: string
}

// Usuario activo
'page_activity_resumed' - {
  page: string,
  timestamp: string,
  inactive_duration: number
}
```

## 🛠 Componentes y Hooks

### Hooks Principales

#### `usePageTimeTracking()`
Hook principal para tracking de tiempo en páginas.

```typescript
const {
  currentPage,
  pageStartTime,
  isPageActive,
  sessionData,
  getSessionStats,
  finalizeSession
} = usePageTimeTracking()
```

#### `useScrollTracking()`
Hook para tracking de scroll e interacciones.

```typescript
const {
  scrollDepth,
  hasInteracted,
  firstInteractionTime,
  timeOnPage
} = useScrollTracking()
```

#### `usePageTimeStats()`
Hook para obtener estadísticas en tiempo real.

```typescript
const stats = usePageTimeStats()
// {
//   sessionDuration: number,
//   sessionDurationMinutes: number,
//   pagesVisited: number,
//   totalPageTime: number,
//   averagePageTime: number,
//   currentPage: string,
//   currentPageDuration: number,
//   isActive: boolean
// }
```

### Componentes

#### `PageTimeTracker`
Componente que maneja el tracking automático de tiempo.

#### `EngagementTracker`
Componente que calcula y trackea niveles de engagement.

#### `TimeAnalyticsDemo`
Componente de demostración que muestra métricas en tiempo real (solo desarrollo).

## 📈 Cálculo de Engagement

El nivel de engagement se calcula basado en múltiples factores:

### Factores de Puntuación
1. **Tiempo en página** (máximo 5 puntos)
   - 1 punto por cada minuto, máximo 5 puntos
2. **Scroll depth** (máximo 5 puntos)
   - 1 punto por cada 20% de scroll
3. **Interacción** (2 puntos)
   - 2 puntos si el usuario interactuó
   - 1 punto extra si la interacción fue en los primeros 10 segundos

### Niveles de Engagement
- **High**: 8+ puntos
- **Medium**: 4-7 puntos
- **Low**: 0-3 puntos

### Criterios de Bounce
Una página se considera "bounce" si:
- Duración < 30 segundos
- Scroll depth < 25%
- Sin interacciones del usuario

## 🔧 Configuración

### Variables de Configuración
```typescript
const INACTIVITY_THRESHOLD = 30000 // 30 segundos de inactividad
const PAGE_TRACKING_INTERVAL = 10000 // Actualización cada 10 segundos
const BOUNCE_THRESHOLD = 30 // 30 segundos para considerar bounce
```

### Debug Mode
En modo desarrollo, se muestra un panel flotante con métricas en tiempo real.

## 📊 Dashboard de PostHog

### Métricas Disponibles
1. **Average Time on Page** - Tiempo promedio por página
2. **Session Duration** - Duración promedio de sesiones
3. **Bounce Rate** - Porcentaje de páginas con baja engagement
4. **Scroll Depth Distribution** - Distribución de profundidad de scroll
5. **Engagement Level Distribution** - Distribución de niveles de engagement
6. **Time to Interaction** - Tiempo promedio hasta primera interacción

### Funnels Recomendados
1. **Page Engagement Funnel**
   - Visita → Scroll 25% → Scroll 50% → Interacción
2. **Session Quality Funnel**
   - Página visitada → 1+ minuto → 2+ páginas → High engagement

### Cohortes Útiles
1. **High Engagement Users** - Usuarios con engagement alto
2. **Quick Bouncers** - Usuarios que abandonan rápidamente
3. **Deep Scrollers** - Usuarios que llegan al 75%+ de scroll

## 🎯 Casos de Uso

### 1. Optimización de Contenido
- Identificar páginas con bajo tiempo de permanencia
- Mejorar contenido basado en scroll depth
- Optimizar páginas con alto bounce rate

### 2. Mejora de UX
- Reducir time to interaction
- Identificar puntos de fricción
- Optimizar flujos de navegación

### 3. Análisis de Comportamiento
- Entender patrones de navegación
- Identificar contenido más engaging
- Analizar diferencias entre tipos de usuarios

## 🚀 Próximos Pasos

1. **Heatmaps** - Integración con mapas de calor
2. **A/B Testing** - Testing basado en engagement
3. **Personalización** - Contenido basado en comportamiento
4. **Alertas** - Notificaciones por métricas anómalas
5. **Exportación** - Reportes automáticos de métricas

## 🔒 Privacidad

- **Datos anónimos** - No se capturan datos personales
- **Respeto a DNT** - Respeta configuración Do Not Track
- **Configuración local** - Usuarios pueden desactivar tracking
- **Cumplimiento GDPR** - Cumple con regulaciones de privacidad
