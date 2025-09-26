# PostHog Analytics Setup

Este documento explica cómo configurar y usar PostHog para analytics en LittleFounders AI.

## Configuración Inicial

### 1. Crear cuenta en PostHog

1. Ve a [PostHog](https://posthog.com) y crea una cuenta
2. Crea un nuevo proyecto
3. Copia tu Project API Key

### 2. Configurar variables de entorno

Crea un archivo `.env` en la raíz del proyecto con:

```env
VITE_POSTHOG_KEY=tu_project_key_aqui
VITE_POSTHOG_HOST=https://app.posthog.com
```

**Ejemplo:**
```env
VITE_POSTHOG_KEY=phc_1234567890abcdef
VITE_POSTHOG_HOST=https://app.posthog.com
```

### 3. Instalar dependencias

Las dependencias ya están instaladas:
- `posthog-js` - SDK principal de PostHog

## Eventos Trackeados

### Eventos de Autenticación
- `login_attempt` - Usuario intenta iniciar sesión
- `login_success` - Login exitoso
- `login_failed` - Login fallido
- `login_error` - Error de conexión en login
- `registration_success` - Registro exitoso
- `registration_failed` - Registro fallido
- `registration_error` - Error de conexión en registro

### Eventos de Navegación
- `page_view` - Vista de página (automático)
- `welcome_login_clicked` - Click en botón de login desde welcome
- `welcome_register_clicked` - Click en botón de registro desde welcome

### Eventos de Registro
- `registration_step_completed` - Paso completado en registro
- `sponsor_choice` - Elección sobre patrocinador

### Eventos de Tiempo y Engagement
- `page_time_start` - Inicio de tiempo en página
- `page_time_update` - Actualización periódica de tiempo en página
- `page_time_final` - Tiempo final en página al salir
- `page_activity_paused` - Usuario se vuelve inactivo
- `page_activity_resumed` - Usuario vuelve a ser activo
- `session_time_update` - Actualización de tiempo de sesión
- `session_final` - Tiempo final de sesión

### Eventos de Engagement
- `page_engagement` - Nivel de engagement en página (high/medium/low)
- `page_bounce` - Tracking de bounce rate
- `scroll_depth` - Profundidad de scroll en página
- `time_to_interaction` - Tiempo hasta primera interacción

### Eventos Personalizados Disponibles
- `user_action` - Acción genérica del usuario
- `feature_used` - Uso de funcionalidad
- `game_event` - Evento en juegos
- `lesson_progress` - Progreso en lecciones
- `financial_action` - Acción financiera
- `task_completed` - Tarea completada
- `error_occurred` - Error ocurrido

## Uso en Componentes

### Hook básico
```tsx
import { usePostHog } from '@/hooks/usePostHog'

const MyComponent = () => {
  const { trackEvent, identifyUser } = usePostHog()
  
  const handleClick = () => {
    trackEvent('button_clicked', {
      button_name: 'my_button',
      timestamp: new Date().toISOString()
    })
  }
  
  return <button onClick={handleClick}>Click me</button>
}
```

### Hook avanzado para analytics
```tsx
import { useAnalytics } from '@/components/analytics/AnalyticsTracker'

const MyComponent = () => {
  const { trackUserAction, trackFeatureUsage } = useAnalytics()
  
  const handleFeatureUse = () => {
    trackFeatureUsage('savings_goal_created', {
      goal_amount: 100,
      goal_type: 'short_term'
    })
  }
  
  return <button onClick={handleFeatureUse}>Create Goal</button>
}
```

### Hook para estadísticas de tiempo en tiempo real
```tsx
import { usePageTimeStats } from '@/components/analytics/PageTimeTracker'

const MyComponent = () => {
  const stats = usePageTimeStats()
  
  return (
    <div>
      <p>Tiempo en página: {Math.round(stats.currentPageDuration / 1000)}s</p>
      <p>Duración de sesión: {stats.sessionDurationMinutes} min</p>
      <p>Páginas visitadas: {stats.pagesVisited}</p>
    </div>
  )
}
```

### Hook para tracking de scroll
```tsx
import { useScrollTracking } from '@/hooks/useScrollTracking'

const MyComponent = () => {
  const { scrollDepth, hasInteracted, timeOnPage } = useScrollTracking()
  
  return (
    <div>
      <p>Scroll: {scrollDepth}%</p>
      <p>Has interactuado: {hasInteracted ? 'Sí' : 'No'}</p>
      <p>Tiempo en página: {Math.round(timeOnPage / 1000)}s</p>
    </div>
  )
}
```

## Identificación de Usuarios

Los usuarios se identifican automáticamente al hacer login exitoso:

```tsx
identifyUser(userId, {
  email: user.email,
  name: user.name,
  user_type: user.user_type,
  birth_date: user.birth_date
})
```

## Configuración de PostHog

### Características Habilitadas
- ✅ Captura automática de page views
- ✅ Captura automática de page leaves
- ✅ Session recording (grabación de sesiones)
- ✅ Debug mode en desarrollo
- ✅ Respeto a DNT (Do Not Track)

### Privacidad
- Se respeta la configuración DNT del navegador
- Los datos se envían de forma segura a PostHog
- No se capturan datos sensibles como contraseñas

## Dashboard y Métricas

Una vez configurado, podrás ver en tu dashboard de PostHog:

1. **Eventos en tiempo real** - Actividad de usuarios
2. **Funnels** - Flujos de conversión (registro → login → uso)
3. **Retention** - Retención de usuarios
4. **Session recordings** - Grabaciones de sesiones de usuario
5. **Feature flags** - Para A/B testing (opcional)

### Métricas de Tiempo y Engagement

6. **Tiempo en página** - Duración promedio por página
7. **Tiempo de sesión** - Duración total de sesiones
8. **Bounce rate** - Porcentaje de páginas con baja engagement
9. **Scroll depth** - Qué tan profundo llegan los usuarios
10. **Time to interaction** - Tiempo hasta primera interacción
11. **Engagement levels** - Niveles de engagement por página
12. **Session heatmaps** - Mapas de calor de actividad

## Desarrollo vs Producción

### Desarrollo
- Debug mode habilitado
- Logs en consola
- Datos de prueba separados

### Producción
- Debug mode deshabilitado
- Sin logs en consola
- Datos reales de usuarios

## Troubleshooting

### PostHog no se inicializa
1. Verifica que `VITE_POSTHOG_KEY` esté configurado
2. Revisa la consola del navegador por errores
3. Verifica que la URL de PostHog sea correcta

### Eventos no aparecen
1. Verifica la conexión a internet
2. Revisa el Network tab en DevTools
3. Verifica que el Project Key sea correcto

### Problemas de CORS
Si tienes problemas de CORS, verifica que estés usando la URL correcta de PostHog.

## Próximos Pasos

1. Configurar funnels para el flujo de registro
2. Implementar feature flags para A/B testing
3. Configurar alertas para eventos importantes
4. Crear dashboards personalizados
5. Implementar cohortes de usuarios

## Recursos Adicionales

- [Documentación de PostHog](https://posthog.com/docs)
- [PostHog JavaScript SDK](https://posthog.com/docs/libraries/js)
- [Best Practices](https://posthog.com/docs/best-practices)
