# 📊 Cómo Ver Analytics en PostHog - Guía Rápida

## 🚀 **Paso 1: Configurar el Proyecto**

### 1.1 Verificar Variables de Entorno
Crea un archivo `.env` en la raíz del proyecto:
```env
VITE_POSTHOG_KEY=tu_clave_de_posthog_aqui
VITE_POSTHOG_HOST=https://app.posthog.com
```

### 1.2 Iniciar el Proyecto
```bash
npm run dev
```

## 🔍 **Paso 2: Ver Eventos en PostHog**

### 2.1 Acceder a PostHog
1. Ve a [app.posthog.com](https://app.posthog.com)
2. Inicia sesión con tu cuenta
3. Selecciona tu proyecto

### 2.2 Buscar Eventos
En la sección **"Events"**, busca estos eventos:

#### 🎯 **Eventos Principales**
- `user_page_time_start` - Usuario entra a una página
- `user_page_time_update` - Actualización cada 15 segundos
- `user_page_time_final` - Usuario sale de una página
- `user_engagement_by_type` - Engagement por tipo de usuario
- `sidebar_page_analytics` - Analytics de páginas del sidebar
- `user_session_metrics` - Métricas de sesión

## 📈 **Paso 3: Crear Dashboards**

### 3.1 Dashboard: Tiempo por Tipo de Usuario
1. Ve a **"Dashboards"** → **"New Dashboard"**
2. Nombre: "Tiempo por Tipo de Usuario"
3. Agrega gráfico:
   - **Tipo**: Bar Chart
   - **Evento**: `user_page_time_final`
   - **X-axis**: `page_name`
   - **Y-axis**: `duration_minutes` (promedio)
   - **Breakdown**: `user_type`

### 3.2 Dashboard: Engagement por Página
1. **Gráfico**: Páginas Más Visitadas
   - **Tipo**: Bar Chart
   - **Evento**: `sidebar_page_analytics`
   - **X-axis**: `page_name`
   - **Y-axis**: Conteo de eventos
   - **Breakdown**: `user_type`

## 🧪 **Paso 4: Probar en Desarrollo**

### 4.1 Usar la Consola del Navegador
Abre la consola del navegador (F12) y ejecuta:

```javascript
// Probar conexión
testPostHog.testConnection()

// Probar analytics de usuario
testPostHog.testUserAnalytics()

// Probar analytics de sidebar
testPostHog.testSidebarAnalytics()

// Ejecutar todas las pruebas
testPostHog.runAllTests()
```

### 4.2 Componentes de Demostración
En desarrollo verás:
- **UserAnalyticsDemo**: Analytics en tiempo real (esquina inferior derecha)
- **PostHogEventsDemo**: Eventos simulados (esquina inferior izquierda)

## 📊 **Paso 5: Filtros Útiles en PostHog**

### 5.1 Por Tipo de Usuario
```
user_type = "tutor"     # Solo tutores
user_type = "child"     # Solo niños  
user_type = "sponsor"   # Solo patrocinadores
```

### 5.2 Por Página
```
page_name = "Lecciones"           # Solo lecciones
page_name = "Mis Ahorros"         # Solo ahorros
page_category = "Educación"       # Solo páginas educativas
```

### 5.3 Por Tiempo
```
duration_minutes > 1    # Sesiones de más de 1 minuto
duration_minutes < 0.5  # Sesiones de menos de 30 segundos
```

## 🎯 **Paso 6: Insights Específicos**

### 6.1 Tiempo Promedio por Página
1. **Insights** → **New Insight**
2. **Tipo**: Bar Chart
3. **Evento**: `user_page_time_final`
4. **Métrica**: `duration_minutes` (promedio)
5. **Breakdown**: `page_name`
6. **Filtro**: `is_sidebar_page = true`

### 6.2 Engagement por Tipo de Usuario
1. **Tipo**: Funnel
2. **Eventos**: 
   - `user_page_time_start`
   - `user_page_time_update`
   - `user_page_time_final`
3. **Breakdown**: `user_type`

## 📱 **Paso 7: Monitoreo en Tiempo Real**

### 7.1 Live Events
1. Ve a **"Live Events"**
2. Filtra por: `user_page_time_update`
3. Observa el tiempo en tiempo real

### 7.2 Session Recordings
1. Ve a **"Session Recordings"**
2. Filtra por usuario específico
3. Ve el comportamiento completo

## 🔧 **Paso 8: Troubleshooting**

### ❌ **No Veo Eventos**
1. Verifica variables de entorno en `.env`
2. Revisa consola del navegador para errores
3. Asegúrate de que el usuario esté logueado
4. Ejecuta `testPostHog.testConnection()` en consola

### ❌ **Datos Inconsistentes**
1. Verifica que el usuario tenga `user_type` correcto
2. Revisa que las páginas estén en la lista de `SIDEBAR_PAGES`
3. Comprueba que PostHog esté recibiendo los eventos

### ❌ **Filtros No Funcionan**
1. Verifica la sintaxis de los filtros
2. Asegúrate de que los nombres de propiedades coincidan
3. Revisa que los tipos de datos sean correctos

## 🎉 **¡Listo!**

Con esta configuración podrás ver:

✅ **Tiempo que pasa cada tipo de usuario en cada página**
✅ **Patrones de navegación por tipo de usuario**  
✅ **Engagement y comportamiento**
✅ **Métricas de sesión detalladas**
✅ **Análisis en tiempo real**

### 📋 **Checklist de Verificación**

- [ ] Variables de entorno configuradas
- [ ] Proyecto iniciado con `npm run dev`
- [ ] Usuario logueado en la aplicación
- [ ] Navegando por páginas del sidebar
- [ ] Eventos apareciendo en PostHog
- [ ] Dashboards creados
- [ ] Filtros funcionando
- [ ] Insights configurados

### 🚀 **Próximos Pasos**

1. **Crear alertas** para sesiones largas o baja actividad
2. **Exportar datos** a CSV para análisis externo
3. **Configurar cohorts** para análisis específicos
4. **Usar la API** de PostHog para integraciones personalizadas

Los datos se actualizarán automáticamente cada vez que los usuarios naveguen por las páginas del sidebar. ¡Disfruta analizando el comportamiento de tus usuarios! 🎯
