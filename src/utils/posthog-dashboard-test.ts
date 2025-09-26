// Script específico para probar eventos de dashboard en PostHog
import { posthog } from '@/lib/posthog'

export const testDashboardEvents = () => {
  console.log('🧪 Probando eventos para dashboards de PostHog...')
  
  // Simular eventos con todas las propiedades necesarias para dashboards
  const testEvents = [
    {
      event: 'user_page_time_final',
      properties: {
        page: '/dashboard',
        page_name: 'Inicio',
        page_category: 'Navegación',
        user_type: 'tutor',
        user_id: 'test_tutor_001',
        duration: 120000, // 2 minutos
        duration_seconds: 120,
        duration_minutes: 2,
        is_sidebar_page: true,
        timestamp: new Date().toISOString()
      }
    },
    {
      event: 'user_page_time_final',
      properties: {
        page: '/lecciones',
        page_name: 'Lecciones',
        page_category: 'Educación',
        user_type: 'child',
        user_id: 'test_child_001',
        duration: 300000, // 5 minutos
        duration_seconds: 300,
        duration_minutes: 5,
        is_sidebar_page: true,
        timestamp: new Date().toISOString()
      }
    },
    {
      event: 'user_page_time_final',
      properties: {
        page: '/savings',
        page_name: 'Mis Ahorros',
        page_category: 'Finanzas',
        user_type: 'sponsor',
        user_id: 'test_sponsor_001',
        duration: 180000, // 3 minutos
        duration_seconds: 180,
        duration_minutes: 3,
        is_sidebar_page: true,
        timestamp: new Date().toISOString()
      }
    },
    {
      event: 'sidebar_page_analytics',
      properties: {
        page_path: '/store',
        page_name: 'Tiendita',
        page_category: 'Comercio',
        user_type: 'child',
        user_type_label: 'Niño',
        time_spent: 240000, // 4 minutos
        time_spent_seconds: 240,
        time_spent_minutes: 4,
        engagement_level: 'Alto',
        session_duration: 1800000, // 30 minutos
        session_pages_visited: 8,
        timestamp: new Date().toISOString()
      }
    },
    {
      event: 'user_session_final',
      properties: {
        user_type: 'tutor',
        user_id: 'test_tutor_001',
        session_id: 'session_tutor_001',
        session_duration: 3600000, // 60 minutos
        session_duration_minutes: 60,
        pages_visited: 12,
        average_page_time: 300000, // 5 minutos
        average_page_time_minutes: 5,
        timestamp: new Date().toISOString()
      }
    }
  ]

  // Enviar eventos con delay para simular comportamiento real
  testEvents.forEach((eventData, index) => {
    setTimeout(() => {
      posthog.capture(eventData.event, eventData.properties)
      console.log(`✅ Evento enviado: ${eventData.event}`, eventData.properties)
    }, index * 2000) // 2 segundos entre eventos
  })

  console.log('✅ Todos los eventos de prueba enviados a PostHog')
  console.log('📊 Ahora puedes crear dashboards con estos eventos:')
  console.log('   - user_page_time_final (para tiempo por página y tipo de usuario)')
  console.log('   - sidebar_page_analytics (para páginas del sidebar)')
  console.log('   - user_session_final (para métricas de sesión)')
}

export const testSpecificDashboard = (dashboardType: 'time' | 'engagement' | 'session') => {
  console.log(`🧪 Probando eventos específicos para dashboard: ${dashboardType}`)
  
  switch (dashboardType) {
    case 'time':
      // Eventos para dashboard de tiempo
      const timeEvents = [
        {
          event: 'user_page_time_final',
          properties: {
            page: '/dashboard',
            page_name: 'Inicio',
            user_type: 'tutor',
            duration_minutes: 2.5,
            is_sidebar_page: true
          }
        },
        {
          event: 'user_page_time_final',
          properties: {
            page: '/lecciones',
            page_name: 'Lecciones',
            user_type: 'child',
            duration_minutes: 4.2,
            is_sidebar_page: true
          }
        }
      ]
      
      timeEvents.forEach((eventData, index) => {
        setTimeout(() => {
          posthog.capture(eventData.event, eventData.properties)
          console.log(`✅ Evento de tiempo enviado: ${eventData.event}`)
        }, index * 1000)
      })
      break
      
    case 'engagement':
      // Eventos para dashboard de engagement
      const engagementEvents = [
        {
          event: 'sidebar_page_analytics',
          properties: {
            page_name: 'Lecciones',
            user_type: 'child',
            engagement_level: 'Alto',
            time_spent_minutes: 5.5
          }
        },
        {
          event: 'user_engagement_by_type',
          properties: {
            user_type: 'tutor',
            engagement_level: 'Medio',
            time_spent_minutes: 3.2
          }
        }
      ]
      
      engagementEvents.forEach((eventData, index) => {
        setTimeout(() => {
          posthog.capture(eventData.event, eventData.properties)
          console.log(`✅ Evento de engagement enviado: ${eventData.event}`)
        }, index * 1000)
      })
      break
      
    case 'session':
      // Eventos para dashboard de sesión
      const sessionEvents = [
        {
          event: 'user_session_final',
          properties: {
            user_type: 'child',
            session_duration_minutes: 25.5,
            pages_visited: 6,
            average_page_time_minutes: 4.2
          }
        },
        {
          event: 'user_session_final',
          properties: {
            user_type: 'tutor',
            session_duration_minutes: 45.2,
            pages_visited: 10,
            average_page_time_minutes: 4.5
          }
        }
      ]
      
      sessionEvents.forEach((eventData, index) => {
        setTimeout(() => {
          posthog.capture(eventData.event, eventData.properties)
          console.log(`✅ Evento de sesión enviado: ${eventData.event}`)
        }, index * 1000)
      })
      break
  }
  
  console.log(`✅ Eventos específicos para dashboard ${dashboardType} enviados`)
}

// Función para probar todos los tipos de dashboard
export const testAllDashboards = () => {
  console.log('🚀 Probando todos los tipos de dashboard...')
  
  setTimeout(() => testSpecificDashboard('time'), 1000)
  setTimeout(() => testSpecificDashboard('engagement'), 5000)
  setTimeout(() => testSpecificDashboard('session'), 9000)
  
  console.log('✅ Todos los dashboards probados')
}

// Exportar para uso en consola del navegador
if (typeof window !== 'undefined') {
  (window as any).testDashboard = {
    testAll: testDashboardEvents,
    testTime: () => testSpecificDashboard('time'),
    testEngagement: () => testSpecificDashboard('engagement'),
    testSession: () => testSpecificDashboard('session'),
    testAllDashboards: testAllDashboards
  }
}
