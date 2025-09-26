# 📊 Configuración Correcta de Dashboards en PostHog

## 🎯 **Problema Identificado**
PostHog a veces no permite elegir libremente los ejes X e Y, especialmente con ciertos tipos de gráficos. Aquí te muestro las configuraciones correctas.

## 🚀 **Solución: Configuraciones Específicas para PostHog**

### 1. **Dashboard: Tiempo por Tipo de Usuario**

#### 📈 **Gráfico 1: Tiempo Promedio por Página**
1. Ve a **"Dashboards"** → **"New Dashboard"**
2. Nombre: "Tiempo por Tipo de Usuario"
3. **Agregar Insight**:
   - **Tipo**: **Bar Chart** (NO Line Chart)
   - **Evento**: `user_page_time_final`
   - **Métrica**: `duration_minutes` (promedio)
   - **Breakdown**: `page_name`
   - **Filtro**: `is_sidebar_page = true`

#### 📈 **Gráfico 2: Tiempo por Tipo de Usuario**
1. **Agregar Insight**:
   - **Tipo**: **Bar Chart**
   - **Evento**: `user_page_time_final`
   - **Métrica**: `duration_minutes` (promedio)
   - **Breakdown**: `user_type`
   - **Filtro**: `is_sidebar_page = true`

### 2. **Dashboard: Engagement por Página**

#### 📈 **Gráfico 1: Páginas Más Visitadas**
1. **Tipo**: **Bar Chart**
2. **Evento**: `sidebar_page_analytics`
3. **Métrica**: **Conteo de eventos** (no promedio)
4. **Breakdown**: `page_name`
5. **Filtro**: `user_type = "child"`

#### 📈 **Gráfico 2: Tiempo de Permanencia por Página**
1. **Tipo**: **Bar Chart**
2. **Evento**: `user_page_time_final`
3. **Métrica**: `duration_minutes` (promedio)
4. **Breakdown**: `page_name`
5. **Filtro**: `is_sidebar_page = true`

### 3. **Dashboard: Análisis de Sesiones**

#### 📈 **Gráfico 1: Duración de Sesión por Tipo de Usuario**
1. **Tipo**: **Bar Chart**
2. **Evento**: `user_session_final`
3. **Métrica**: `session_duration_minutes` (promedio)
4. **Breakdown**: `user_type`

#### 📈 **Gráfico 2: Páginas Visitadas por Sesión**
1. **Tipo**: **Bar Chart**
2. **Evento**: `user_session_final`
3. **Métrica**: `pages_visited` (promedio)
4. **Breakdown**: `user_type`

## 🔧 **Configuraciones Alternativas si No Funcionan**

### **Opción 1: Usar Insights en Lugar de Dashboards**

#### 📊 **Insight 1: Tiempo por Página**
1. Ve a **"Insights"** → **"New Insight"**
2. **Tipo**: **Bar Chart**
3. **Evento**: `user_page_time_final`
4. **Métrica**: `duration_minutes` (promedio)
5. **Breakdown**: `page_name`
6. **Filtro**: `is_sidebar_page = true`

#### 📊 **Insight 2: Tiempo por Tipo de Usuario**
1. **Tipo**: **Bar Chart**
2. **Evento**: `user_page_time_final`
3. **Métrica**: `duration_minutes` (promedio)
4. **Breakdown**: `user_type`
5. **Filtro**: `is_sidebar_page = true`

### **Opción 2: Usar Funnels para Análisis de Flujo**

#### 📊 **Funnel: Flujo de Usuario por Página**
1. **Tipo**: **Funnel**
2. **Eventos**:
   - `user_page_time_start`
   - `user_page_time_update`
   - `user_page_time_final`
3. **Breakdown**: `user_type`

### **Opción 3: Usar Paths para Análisis de Navegación**

#### 📊 **Path: Patrones de Navegación**
1. **Tipo**: **Paths**
2. **Evento**: `user_page_time_start`
3. **Filtro**: `user_type = "child"`

## 🎯 **Configuraciones Específicas por Tipo de Gráfico**

### **Bar Chart (Recomendado)**
- ✅ Permite elegir métricas y breakdowns
- ✅ Fácil de configurar
- ✅ Ideal para comparaciones

### **Line Chart**
- ⚠️ A veces limita las opciones de ejes
- ⚠️ Mejor para series temporales

### **Pie Chart**
- ✅ Bueno para mostrar proporciones
- ✅ Fácil de configurar

### **Funnel**
- ✅ Excelente para flujos de usuario
- ✅ Permite múltiples eventos

## 🔍 **Filtros Específicos para PostHog**

### **Filtros por Tipo de Usuario**
```
user_type = "tutor"     # Solo tutores
user_type = "child"     # Solo niños
user_type = "sponsor"   # Solo patrocinadores
```

### **Filtros por Página**
```
page_name = "Lecciones"           # Solo lecciones
page_name = "Mis Ahorros"         # Solo ahorros
page_category = "Educación"       # Solo páginas educativas
is_sidebar_page = true            # Solo páginas del sidebar
```

### **Filtros por Tiempo**
```
duration_minutes > 1              # Sesiones de más de 1 minuto
duration_minutes < 0.5            # Sesiones de menos de 30 segundos
session_duration_minutes > 5      # Sesiones largas
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

### **Paso 2: Agregar Primer Gráfico**
1. **"Add Insight"**
2. **Tipo**: **Bar Chart**
3. **Evento**: `user_page_time_final`
4. **Métrica**: `duration_minutes` (promedio)
5. **Breakdown**: `page_name`
6. **Filtro**: `is_sidebar_page = true`
7. **Título**: "Tiempo Promedio por Página"

### **Paso 3: Agregar Segundo Gráfico**
1. **"Add Insight"**
2. **Tipo**: **Bar Chart**
3. **Evento**: `user_page_time_final`
4. **Métrica**: `duration_minutes` (promedio)
5. **Breakdown**: `user_type`
6. **Filtro**: `is_sidebar_page = true`
7. **Título**: "Tiempo por Tipo de Usuario"

### **Paso 4: Agregar Tercer Gráfico**
1. **"Add Insight"**
2. **Tipo**: **Pie Chart**
3. **Evento**: `user_session_final`
4. **Métrica**: `session_duration_minutes` (suma)
5. **Breakdown**: `user_type`
6. **Título**: "Duración de Sesión por Tipo de Usuario"

## 🔧 **Troubleshooting**

### **❌ No Puedo Elegir Ejes X e Y**
- **Solución**: Usa **Bar Chart** en lugar de Line Chart
- **Alternativa**: Usa **Insights** en lugar de Dashboards

### **❌ No Aparecen Datos**
- **Verificar**: Que los eventos se estén enviando
- **Comprobar**: Filtros aplicados
- **Revisar**: Rango de fechas

### **❌ Gráficos Vacíos**
- **Verificar**: Que el evento exista
- **Comprobar**: Que las propiedades existan
- **Revisar**: Filtros muy restrictivos

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

¡Ahora deberías poder ver todos los analytics de tiempo por página y tipo de usuario en PostHog! 🎯
