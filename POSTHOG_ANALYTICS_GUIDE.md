# Guía de Analytics Avanzados en PostHog

Esta guía te explica cómo usar los nuevos analytics implementados para rastrear páginas más visitadas y tiempo promedio por página en PostHog.

## 🎯 Eventos Implementados

### 1. Eventos de Páginas Más Visitadas

#### `page_visit_detailed`
Se envía cada vez que un usuario visita una página con información detallada:

```json
{
  "page_path": "/dashboard",
  "page_name": "Dashboard",
  "visit_count": 5,
  "session_visit_number": 3,
  "duration_ms": 45000,
  "duration_seconds": 45,
  "duration_minutes": 0.75,
  "average_time_all_visits": 52,
  "total_time_all_visits": 260,
  "is_returning_visitor": true,
  "first_visit": "2024-01-15T10:30:00.000Z",
  "last_visit": "2024-01-15T14:22:00.000Z",
  "session_pages_visited": 2,
  "previous_page": "/welcome"
}
```

#### `page_popularity_update`
Se envía para actualizar el ranking de popularidad de páginas:

```json
{
  "page_path": "/lecciones",
  "total_visits": 12,
  "average_time_seconds": 180,
  "popularity_rank": 2,
  "timestamp": "2024-01-15T14:22:00.000Z"
}
```

### 2. Eventos de Tiempo Promedio

#### `page_time_analytics`
Información detallada sobre el tiempo en cada página:

```json
{
  "page_path": "/lemonade-stand",
  "page_name": "Lemonade Stand",
  "duration_ms": 120000,
  "duration_seconds": 120,
  "duration_minutes": 2.0,
  "visit_number": 3,
  "total_time_all_visits_ms": 360000,
  "total_time_all_visits_minutes": 6.0,
  "average_time_ms": 120000,
  "average_time_seconds": 120,
  "average_time_minutes": 2.0,
  "min_time_ms": 45000,
  "max_time_ms": 180000,
  "time_variance": 135000
}
```

#### `page_time_trends`
Análisis de tendencias de tiempo:

```json
{
  "page_path": "/store",
  "average_time_seconds": 90,
  "total_visits": 8,
  "engagement_score": 1.2,
  "time_category": "medium",
  "timestamp": "2024-01-15T14:22:00.000Z"
}
```

#### `page_time_realtime`
Tracking en tiempo real del tiempo en página:

```json
{
  "page_path": "/savings",
  "current_time_ms": 30000,
  "current_time_seconds": 30,
  "session_duration_ms": 180000,
  "timestamp": "2024-01-15T14:22:00.000Z"
}
```

### 3. Eventos de Sesión

#### `session_analytics`
Estadísticas generales de la sesión:

```json
{
  "session_duration_ms": 600000,
  "session_duration_minutes": 10.0,
  "pages_visited_count": 5,
  "unique_pages_count": 4,
  "session_start_time": "2024-01-15T14:15:00.000Z",
  "pages_visited": ["/", "/dashboard", "/lecciones", "/store", "/profile"],
  "timestamp": "2024-01-15T14:25:00.000Z"
}
```

#### `session_time_summary`
Resumen del tiempo de sesión:

```json
{
  "session_duration_ms": 600000,
  "session_duration_minutes": 10.0,
  "pages_visited": 5,
  "overall_average_time_ms": 120000,
  "overall_average_time_minutes": 2.0,
  "most_engaging_page": "/lemonade-stand",
  "most_engaging_page_avg_time": 180,
  "timestamp": "2024-01-15T14:25:00.000Z"
}
```

## 📊 Cómo Crear Insights en PostHog

### 1. Páginas Más Visitadas

1. Ve a **Insights** en tu dashboard de PostHog
2. Crea un nuevo insight
3. Selecciona **Event** como tipo de gráfico
4. Usa el evento `page_visit_detailed`
5. Agrupa por `page_path` o `page_name`
6. Ordena por `visit_count` descendente

**Query de ejemplo:**
```
Event: page_visit_detailed
Group by: page_name
Order by: visit_count (descending)
```

### 2. Tiempo Promedio por Página

1. Crea un nuevo insight
2. Selecciona **Event** como tipo
3. Usa el evento `page_time_analytics`
4. Agrupa por `page_path`
5. Usa la métrica `average_time_seconds`
6. Calcula la media

**Query de ejemplo:**
```
Event: page_time_analytics
Group by: page_name
Metric: Average of average_time_seconds
```

### 3. Análisis de Engagement

1. Crea un insight con el evento `page_time_trends`
2. Agrupa por `time_category`
3. Usa el conteo de eventos para ver distribución

**Query de ejemplo:**
```
Event: page_time_trends
Group by: time_category
Metric: Count of events
```

### 4. Páginas con Mayor Engagement

1. Usa el evento `page_time_analytics`
2. Agrupa por `page_name`
3. Calcula la media de `engagement_score`
4. Filtra páginas con engagement > 1.5

## 🔍 Filtros Útiles

### Por Tipo de Usuario
- `is_returning_visitor: true` - Solo usuarios que regresan
- `session_pages_visited: > 3` - Sesiones con múltiples páginas

### Por Tiempo
- `duration_seconds: > 60` - Visitas de más de 1 minuto
- `time_category: long` - Visitas largas (> 2 minutos)

### Por Página
- `page_path: /lemonade-stand` - Solo el juego de limonada
- `page_name: Dashboard` - Solo el dashboard

## 📈 Dashboards Recomendados

### Dashboard de Páginas Más Populares
1. **Gráfico de barras**: Top 10 páginas por visitas
2. **Gráfico circular**: Distribución de visitas por página
3. **Tabla**: Detalles de cada página (visitas, tiempo promedio, engagement)

### Dashboard de Análisis de Tiempo
1. **Gráfico de líneas**: Tiempo promedio por página a lo largo del tiempo
2. **Heatmap**: Tiempo promedio por día de la semana
3. **Gráfico de barras**: Páginas con mayor engagement

### Dashboard de Comportamiento de Usuario
1. **Funnel**: Flujo de navegación más común
2. **Gráfico de dispersión**: Tiempo vs. visitas por página
3. **Métricas**: Tiempo promedio de sesión, páginas por sesión

## 🎯 Métricas Clave a Monitorear

1. **Páginas más visitadas**: Identifica contenido popular
2. **Tiempo promedio por página**: Mide engagement
3. **Tasa de rebote por página**: Identifica problemas de UX
4. **Flujo de navegación**: Optimiza la experiencia del usuario
5. **Páginas con mayor engagement**: Enfoque en contenido de calidad

## 🚀 Automatizaciones

### Alertas Recomendadas
1. **Páginas con tiempo promedio < 30 segundos**: Posible problema de UX
2. **Aumento del 50% en tiempo promedio**: Contenido más engaging
3. **Nueva página en top 5**: Contenido exitoso

### Integraciones
- **Slack**: Notificaciones de métricas importantes
- **Email**: Reportes semanales de analytics
- **Webhooks**: Integración con otros sistemas

## 🔧 Configuración Adicional

Los analytics se almacenan localmente en el navegador para persistencia entre sesiones. Los datos se envían a PostHog en tiempo real y también se pueden acceder mediante los hooks `usePageAnalytics` y `useTimeAnalytics`.

### Hooks Disponibles

```typescript
// Para estadísticas de páginas
const { getTopPages, getOverallStats } = usePageAnalytics()

// Para estadísticas de tiempo
const { getAverageTimeByPage, getTopPagesByTime } = useTimeAnalytics()
```

## 📝 Notas Importantes

1. Los datos se almacenan localmente para persistencia
2. Los eventos se envían a PostHog en tiempo real
3. El sistema respeta la configuración de privacidad de PostHog
4. Los analytics funcionan tanto en desarrollo como en producción
5. Se incluye un componente de demostración para ver datos locales

¡Con estos analytics podrás tener una visión completa del comportamiento de los usuarios en tu aplicación!
