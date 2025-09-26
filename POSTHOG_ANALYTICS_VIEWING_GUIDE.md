# Guía para Ver Analytics en PostHog - LittleFounders

## 🚀 Configuración Inicial

### 1. Verificar Variables de Entorno
Asegúrate de que tu archivo `.env` tenga las variables de PostHog:

```env
VITE_POSTHOG_KEY=tu_clave_de_posthog_aqui
VITE_POSTHOG_HOST=https://app.posthog.com
```

### 2. Iniciar el Proyecto
```bash
npm run dev
```

## 📊 Cómo Ver los Analytics en PostHog

### 1. **Acceder a PostHog**
1. Ve a [app.posthog.com](https://app.posthog.com)
2. Inicia sesión con tu cuenta
3. Selecciona tu proyecto

### 2. **Eventos Principales a Buscar**

#### 🔍 **Eventos de Tiempo por Página**
Busca estos eventos en la sección "Events":

- `user_page_time_start` - Cuando un usuario entra a una página
- `user_page_time_update` - Actualización cada 15 segundos
- `user_page_time_final` - Cuando un usuario sale de una página
- `user_page_activity_resumed` - Usuario vuelve a estar activo
- `user_page_activity_paused` - Usuario se vuelve inactivo

#### 📈 **Eventos de Analytics**
- `user_engagement_by_type` - Engagement por tipo de usuario
- `sidebar_page_analytics` - Analytics específicos de páginas del sidebar
- `user_session_metrics` - Métricas de sesión por tipo de usuario
- `user_session_final` - Finalización de sesión

### 3. **Crear Dashboards Personalizados**

#### 📊 **Dashboard 1: Tiempo por Tipo de Usuario**

1. Ve a **"Dashboards"** → **"New Dashboard"**
2. Nombre: "Tiempo por Tipo de Usuario"
3. Agrega estos gráficos:

**Gráfico 1: Tiempo Promedio por Página**
- **Tipo**: Bar Chart
- **Evento**: `user_page_time_final`
- **X-axis**: `page_name`
- **Y-axis**: `duration_minutes` (promedio)
- **Breakdown**: `user_type`
- **Filtro**: `is_sidebar_page = true`

**Gráfico 2: Tiempo Total por Tipo de Usuario**
- **Tipo**: Pie Chart
- **Evento**: `user_session_final`
- **Métrica**: `session_duration_minutes` (suma)
- **Breakdown**: `user_type`

#### 📊 **Dashboard 2: Engagement por Página**

1. **Gráfico 1: Páginas Más Visitadas**
- **Tipo**: Bar Chart
- **Evento**: `sidebar_page_analytics`
- **X-axis**: `page_name`
- **Y-axis**: Conteo de eventos
- **Breakdown**: `user_type`

**Gráfico 2: Tiempo de Permanencia por Página**
- **Tipo**: Line Chart
- **Evento**: `user_page_time_final`
- **X-axis**: `page_name`
- **Y-axis**: `duration_minutes` (promedio)
- **Breakdown**: `user_type`

#### 📊 **Dashboard 3: Análisis de Sesiones**

1. **Gráfico 1: Duración de Sesión por Tipo de Usuario**
- **Tipo**: Bar Chart
- **Evento**: `user_session_final`
- **X-axis**: `user_type`
- **Y-axis**: `session_duration_minutes` (promedio)

**Gráfico 2: Páginas Visitadas por Sesión**
- **Tipo**: Scatter Plot
- **Evento**: `user_session_final`
- **X-axis**: `pages_visited`
- **Y-axis**: `session_duration_minutes`
- **Color**: `user_type`

### 4. **Filtros Útiles**

#### 🎯 **Filtros por Tipo de Usuario**
- `user_type = "tutor"` - Solo tutores
- `user_type = "child"` - Solo niños
- `user_type = "sponsor"` - Solo patrocinadores

#### 🎯 **Filtros por Página**
- `page_name = "Lecciones"` - Solo página de lecciones
- `page_name = "Mis Ahorros"` - Solo página de ahorros
- `page_category = "Educación"` - Solo páginas educativas

#### 🎯 **Filtros por Tiempo**
- `duration_minutes > 1` - Sesiones de más de 1 minuto
- `duration_minutes < 0.5` - Sesiones de menos de 30 segundos

### 5. **Insights Específicos**

#### 📈 **Insight 1: Tiempo Promedio por Página**
1. Ve a **"Insights"** → **"New Insight"**
2. **Tipo**: Bar Chart
3. **Evento**: `user_page_time_final`
4. **Métrica**: `duration_minutes` (promedio)
5. **Breakdown**: `page_name`
6. **Filtro**: `is_sidebar_page = true`

#### 📈 **Insight 2: Engagement por Tipo de Usuario**
1. **Tipo**: Funnel
2. **Eventos**: 
   - `user_page_time_start`
   - `user_page_time_update`
   - `user_page_time_final`
3. **Breakdown**: `user_type`

#### 📈 **Insight 3: Patrones de Navegación**
1. **Tipo**: Paths
2. **Evento**: `user_page_time_start`
3. **Filtro**: `user_type = "child"`

### 6. **Alertas Útiles**

#### 🚨 **Alerta 1: Sesiones Largas**
- **Condición**: `session_duration_minutes > 30`
- **Tipo**: Email/Slack
- **Mensaje**: "Usuario ha estado activo por más de 30 minutos"

#### 🚨 **Alerta 2: Baja Actividad**
- **Condición**: `duration_minutes < 0.5` (más de 10 veces)
- **Tipo**: Email
- **Mensaje**: "Usuario con baja engagement en páginas"

### 7. **Cohorts para Análisis**

#### 👥 **Cohort 1: Usuarios Activos**
- **Definición**: Usuarios que han tenido `session_duration_minutes > 5`
- **Uso**: Análisis de usuarios comprometidos

#### 👥 **Cohort 2: Usuarios por Tipo**
- **Definición**: `user_type = "child"`
- **Uso**: Análisis específico de niños

### 8. **Queries SQL Personalizadas**

#### 📊 **Query 1: Tiempo Total por Usuario**
```sql
SELECT 
  user_id,
  user_type,
  SUM(duration_minutes) as total_time_minutes,
  COUNT(DISTINCT page_name) as pages_visited
FROM events 
WHERE event = 'user_page_time_final'
  AND is_sidebar_page = true
GROUP BY user_id, user_type
ORDER BY total_time_minutes DESC
```

#### 📊 **Query 2: Páginas Más Populares por Tipo de Usuario**
```sql
SELECT 
  user_type,
  page_name,
  COUNT(*) as visits,
  AVG(duration_minutes) as avg_time_minutes
FROM events 
WHERE event = 'user_page_time_final'
  AND is_sidebar_page = true
GROUP BY user_type, page_name
ORDER BY user_type, visits DESC
```

### 9. **Configuración de Tiempo Real**

#### ⚡ **Live Events**
1. Ve a **"Live Events"**
2. Filtra por: `user_page_time_update`
3. Observa el tiempo en tiempo real

#### ⚡ **Session Recordings**
1. Ve a **"Session Recordings"**
2. Filtra por usuario específico
3. Ve el comportamiento completo

### 10. **Exportar Datos**

#### 📤 **Exportar a CSV**
1. Ve a **"Insights"**
2. Crea tu insight
3. Haz clic en **"Export"** → **"CSV"**

#### 📤 **API de PostHog**
```javascript
// Obtener eventos específicos
const events = await posthog.getEvents({
  event: 'user_page_time_final',
  properties: {
    user_type: 'child'
  }
})
```

## 🔧 **Troubleshooting**

### ❌ **No Veo Eventos**
1. Verifica que las variables de entorno estén configuradas
2. Revisa la consola del navegador para errores
3. Asegúrate de que el usuario esté logueado

### ❌ **Datos Inconsistentes**
1. Verifica que el usuario tenga `user_type` correcto
2. Revisa que las páginas estén en la lista de `SIDEBAR_PAGES`
3. Comprueba que PostHog esté recibiendo los eventos

### ❌ **Filtros No Funcionan**
1. Verifica la sintaxis de los filtros
2. Asegúrate de que los nombres de propiedades coincidan
3. Revisa que los tipos de datos sean correctos

## 📱 **Monitoreo en Tiempo Real**

### 🎯 **Dashboard de Monitoreo**
Crea un dashboard con:
- Eventos en tiempo real
- Usuarios activos por tipo
- Páginas más visitadas en tiempo real
- Tiempo promedio por página

### 🎯 **Alertas Automáticas**
- Notificaciones cuando un usuario pasa más de X minutos en una página
- Alertas cuando hay baja actividad
- Notificaciones de patrones inusuales

## 🎉 **¡Listo!**

Con esta configuración podrás ver:
- ✅ Tiempo que pasa cada tipo de usuario en cada página
- ✅ Patrones de navegación por tipo de usuario
- ✅ Engagement y comportamiento
- ✅ Métricas de sesión detalladas
- ✅ Análisis en tiempo real

Los datos se actualizarán automáticamente cada vez que los usuarios naveguen por las páginas del sidebar.
