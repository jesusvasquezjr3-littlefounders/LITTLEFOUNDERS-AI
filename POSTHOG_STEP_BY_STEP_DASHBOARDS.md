# 📊 Guía Paso a Paso: Dashboards en PostHog

## 🎯 **Problema Identificado**
PostHog a veces no permite elegir libremente los ejes X e Y, especialmente con ciertos tipos de gráficos. Aquí te muestro las configuraciones correctas paso a paso.

## 🚀 **Solución: Configuraciones Específicas**

### **Dashboard 1: Tiempo por Página y Tipo de Usuario**

#### **Paso 1: Crear Dashboard**
1. Ve a **"Dashboards"** en PostHog
2. Haz clic en **"New Dashboard"**
3. Nombre: "Analytics de Usuario"
4. Descripción: "Tiempo por página y tipo de usuario"
5. Haz clic en **"Create Dashboard"**

#### **Paso 2: Agregar Primer Gráfico - Tiempo por Página**
1. Haz clic en **"Add Insight"**
2. **Configuración**:
   - **Tipo**: **Bar Chart** (NO Line Chart)
   - **Evento**: `user_page_time_final`
   - **Métrica**: `duration_minutes` (promedio)
   - **Breakdown**: `page_name`
   - **Filtro**: `is_sidebar_page = true`
3. **Título**: "Tiempo Promedio por Página"
4. Haz clic en **"Save"**

#### **Paso 3: Agregar Segundo Gráfico - Tiempo por Tipo de Usuario**
1. Haz clic en **"Add Insight"**
2. **Configuración**:
   - **Tipo**: **Bar Chart**
   - **Evento**: `user_page_time_final`
   - **Métrica**: `duration_minutes` (promedio)
   - **Breakdown**: `user_type`
   - **Filtro**: `is_sidebar_page = true`
3. **Título**: "Tiempo por Tipo de Usuario"
4. Haz clic en **"Save"**

#### **Paso 4: Agregar Tercer Gráfico - Páginas Más Visitadas**
1. Haz clic en **"Add Insight"**
2. **Configuración**:
   - **Tipo**: **Bar Chart**
   - **Evento**: `sidebar_page_analytics`
   - **Métrica**: **Conteo de eventos** (no promedio)
   - **Breakdown**: `page_name`
3. **Título**: "Páginas Más Visitadas"
4. Haz clic en **"Save"**

### **Dashboard 2: Engagement y Comportamiento**

#### **Paso 1: Crear Segundo Dashboard**
1. Ve a **"Dashboards"** → **"New Dashboard"**
2. Nombre: "Engagement y Comportamiento"
3. Haz clic en **"Create Dashboard"**

#### **Paso 2: Gráfico de Engagement por Tipo de Usuario**
1. **"Add Insight"**
2. **Configuración**:
   - **Tipo**: **Pie Chart**
   - **Evento**: `user_engagement_by_type`
   - **Métrica**: **Conteo de eventos**
   - **Breakdown**: `user_type`
3. **Título**: "Engagement por Tipo de Usuario"
4. **Save**

#### **Paso 3: Gráfico de Duración de Sesión**
1. **"Add Insight"**
2. **Configuración**:
   - **Tipo**: **Bar Chart**
   - **Evento**: `user_session_final`
   - **Métrica**: `session_duration_minutes` (promedio)
   - **Breakdown**: `user_type`
3. **Título**: "Duración de Sesión por Tipo de Usuario"
4. **Save**

### **Dashboard 3: Análisis de Navegación**

#### **Paso 1: Crear Tercer Dashboard**
1. **"New Dashboard"**
2. Nombre: "Análisis de Navegación"
3. **Create Dashboard**

#### **Paso 2: Funnel de Navegación**
1. **"Add Insight"**
2. **Configuración**:
   - **Tipo**: **Funnel**
   - **Eventos**:
     - `user_page_time_start`
     - `user_page_time_update`
     - `user_page_time_final`
   - **Breakdown**: `user_type`
3. **Título**: "Flujo de Navegación por Tipo de Usuario"
4. **Save**

#### **Paso 3: Paths de Navegación**
1. **"Add Insight"**
2. **Configuración**:
   - **Tipo**: **Paths**
   - **Evento**: `user_page_time_start`
   - **Filtro**: `user_type = "child"`
3. **Título**: "Patrones de Navegación (Niños)"
4. **Save**

## 🔧 **Configuraciones Alternativas si No Funcionan**

### **Opción 1: Usar Insights en Lugar de Dashboards**

#### **Insight 1: Tiempo por Página**
1. Ve a **"Insights"** → **"New Insight"**
2. **Tipo**: **Bar Chart**
3. **Evento**: `user_page_time_final`
4. **Métrica**: `duration_minutes` (promedio)
5. **Breakdown**: `page_name`
6. **Filtro**: `is_sidebar_page = true`
7. **Título**: "Tiempo Promedio por Página"
8. **Save**

#### **Insight 2: Tiempo por Tipo de Usuario**
1. **"New Insight"**
2. **Tipo**: **Bar Chart**
3. **Evento**: `user_page_time_final`
4. **Métrica**: `duration_minutes` (promedio)
5. **Breakdown**: `user_type`
6. **Filtro**: `is_sidebar_page = true`
7. **Título**: "Tiempo por Tipo de Usuario"
8. **Save**

### **Opción 2: Usar Funnels para Análisis de Flujo**

#### **Funnel: Flujo de Usuario por Página**
1. **"New Insight"**
2. **Tipo**: **Funnel**
3. **Eventos**:
   - `user_page_time_start`
   - `user_page_time_update`
   - `user_page_time_final`
4. **Breakdown**: `user_type`
5. **Título**: "Flujo de Usuario por Página"
6. **Save**

### **Opción 3: Usar Paths para Análisis de Navegación**

#### **Path: Patrones de Navegación**
1. **"New Insight"**
2. **Tipo**: **Paths**
3. **Evento**: `user_page_time_start`
4. **Filtro**: `user_type = "child"`
5. **Título**: "Patrones de Navegación (Niños)"
6. **Save**

## 🎯 **Configuraciones Específicas por Tipo de Gráfico**

### **Bar Chart (Recomendado)**
- ✅ Permite elegir métricas y breakdowns
- ✅ Fácil de configurar
- ✅ Ideal para comparaciones
- ✅ **Configuración**: Evento → Métrica → Breakdown

### **Pie Chart**
- ✅ Bueno para mostrar proporciones
- ✅ Fácil de configurar
- ✅ **Configuración**: Evento → Métrica → Breakdown

### **Funnel**
- ✅ Excelente para flujos de usuario
- ✅ Permite múltiples eventos
- ✅ **Configuración**: Eventos → Breakdown

### **Paths**
- ✅ Ideal para análisis de navegación
- ✅ **Configuración**: Evento → Filtros

## 🔍 **Filtros Específicos para PostHog**

### **Filtros por Tipo de Usuario**
```
user_type = "tutor"        # Solo tutores
user_type = "child"        # Solo niños
user_type = "sponsor"      # Solo patrocinadores
```

### **Filtros por Página**
```
page_name = "Lecciones"            # Solo lecciones
page_name = "Mis Ahorros"          # Solo ahorros
page_category = "Educación"         # Solo páginas educativas
is_sidebar_page = true              # Solo páginas del sidebar
```

### **Filtros por Tiempo**
```
duration_minutes > 1                # Sesiones de más de 1 minuto
duration_minutes < 0.5              # Sesiones de menos de 30 segundos
session_duration_minutes > 5        # Sesiones largas
```

## 📊 **Métricas Disponibles**

### **Métricas de Tiempo**
- `duration_minutes` - Tiempo en minutos
- `duration_seconds` - Tiempo en segundos
- `session_duration_minutes` - Duración de sesión
- `average_page_time` - Tiempo promedio por página

### **Métricas de Engagement**
- `engagement_level` - Nivel de engagement
- `is_active` - Estado de actividad
- `pages_visited` - Páginas visitadas

### **Métricas de Usuario**
- `user_type` - Tipo de usuario
- `user_id` - ID del usuario
- `session_id` - ID de sesión

## 🚀 **Pasos Detallados para Crear Dashboards**

### **Paso 1: Crear Dashboard**
1. Ve a **"Dashboards"** → **"New Dashboard"**
2. Nombre: "Analytics de Usuario"
3. Descripción: "Tiempo por página y tipo de usuario"
4. **Create Dashboard**

### **Paso 2: Agregar Primer Gráfico**
1. **"Add Insight"**
2. **Tipo**: **Bar Chart**
3. **Evento**: `user_page_time_final`
4. **Métrica**: `duration_minutes` (promedio)
5. **Breakdown**: `page_name`
6. **Filtro**: `is_sidebar_page = true`
7. **Título**: "Tiempo Promedio por Página"
8. **Save**

### **Paso 3: Agregar Segundo Gráfico**
1. **"Add Insight"**
2. **Tipo**: **Bar Chart**
3. **Evento**: `user_page_time_final`
4. **Métrica**: `duration_minutes` (promedio)
5. **Breakdown**: `user_type`
6. **Filtro**: `is_sidebar_page = true`
7. **Título**: "Tiempo por Tipo de Usuario"
8. **Save**

### **Paso 4: Agregar Tercer Gráfico**
1. **"Add Insight"**
2. **Tipo**: **Pie Chart**
3. **Evento**: `user_session_final`
4. **Métrica**: `session_duration_minutes` (suma)
5. **Breakdown**: `user_type`
6. **Título**: "Duración de Sesión por Tipo de Usuario"
7. **Save**

## 🔧 **Troubleshooting**

### **❌ No Puedo Elegir Ejes X e Y**
- **Solución**: Usa **Bar Chart** en lugar de Line Chart
- **Alternativa**: Usa **Insights** en lugar de Dashboards
- **Verificar**: Que el evento tenga las propiedades necesarias

### **❌ No Aparecen Datos**
- **Verificar**: Que los eventos se estén enviando
- **Comprobar**: Filtros aplicados
- **Revisar**: Rango de fechas
- **Probar**: Ejecutar `testPostHog.runAllTests()` en consola

### **❌ Gráficos Vacíos**
- **Verificar**: Que el evento exista
- **Comprobar**: Que las propiedades existan
- **Revisar**: Filtros muy restrictivos
- **Probar**: Quitar filtros temporalmente

### **❌ No Aparecen las Propiedades**
- **Verificar**: Que los eventos se estén enviando con las propiedades correctas
- **Comprobar**: Que el usuario esté logueado
- **Revisar**: Que las páginas estén en la lista de `SIDEBAR_PAGES`

## 🎉 **¡Listo!**

Con estas configuraciones específicas podrás crear dashboards efectivos en PostHog que muestren:

✅ **Tiempo por página y tipo de usuario**
✅ **Engagement y comportamiento**
✅ **Métricas de sesión**
✅ **Patrones de navegación**

### 📋 **Checklist de Verificación**

- [ ] Dashboard creado con Bar Charts
- [ ] Eventos configurados correctamente
- [ ] Filtros aplicados
- [ ] Métricas seleccionadas
- [ ] Breakdowns configurados
- [ ] Datos apareciendo
- [ ] Gráficos funcionando

¡Ahora deberías poder ver todos los analytics de tiempo por página y tipo de usuario en PostHog! 🎯
