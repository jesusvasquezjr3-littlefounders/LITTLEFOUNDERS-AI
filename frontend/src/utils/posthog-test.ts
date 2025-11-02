// Script de prueba para verificar que PostHog está funcionando correctamente
import { posthog } from '@/lib/posthog'

export const testPostHogConnection = () => {
  console.log('🧪 Probando conexión con PostHog...')
  
  // Verificar que PostHog esté inicializado
  if (!posthog) {
    console.error('❌ PostHog no está inicializado')
    return false
  }

  // Enviar evento de prueba
  posthog.capture('posthog_test_connection', {
      test: true,
      timestamp: new Date().toISOString(),
    user_agent: navigator.userAgent,
    url: window.location.href
  })

  console.log('✅ Evento de prueba enviado a PostHog')
  return true
}

export const testUserAnalytics = () => {
  console.log('🧪 Probando analytics de usuario...')
  
  // Simular diferentes tipos de usuario
  const userTypes = ['tutor', 'child', 'sponsor']
  const pages = [
    { path: '/dashboard', name: 'Inicio' },
    { path: '/lecciones', name: 'Lecciones' },
    { path: '/savings', name: 'Mis Ahorros' },
    { path: '/store', name: 'Tiendita' },
    { path: '/growth', name: 'Banca Digital' }
  ]

  userTypes.forEach((userType, index) => {
    setTimeout(() => {
      const page = pages[index % pages.length]
      
      // Simular entrada a página
      posthog.capture('user_page_time_start', {
        page: page.path,
        page_name: page.name,
        user_type: userType,
        user_id: `test_${userType}_${Date.now()}`,
        timestamp: new Date().toISOString(),
        is_sidebar_page: true
      })

      // Simular tiempo en página
      setTimeout(() => {
        posthog.capture('user_page_time_update', {
          page: page.path,
          page_name: page.name,
          user_type: userType,
          user_id: `test_${userType}_${Date.now()}`,
          duration: 30000, // 30 segundos
          duration_seconds: 30,
          duration_minutes: 0.5,
          timestamp: new Date().toISOString(),
          is_active: true,
          is_sidebar_page: true
        })
      }, 1000)

      // Simular salida de página
      setTimeout(() => {
        posthog.capture('user_page_time_final', {
          page: page.path,
          page_name: page.name,
          user_type: userType,
          user_id: `test_${userType}_${Date.now()}`,
          duration: 60000, // 1 minuto
          duration_seconds: 60,
          duration_minutes: 1,
          timestamp: new Date().toISOString(),
          is_active: true,
          is_sidebar_page: true
        })
      }, 2000)

    }, index * 3000) // Espaciar los eventos
  })

  console.log('✅ Eventos de prueba de analytics enviados')
}

export const testSidebarAnalytics = () => {
  console.log('🧪 Probando analytics de sidebar...')
  
  const sidebarPages = [
    { path: '/dashboard', name: 'Inicio', category: 'Navegación' },
    { path: '/lecciones', name: 'Lecciones', category: 'Educación' },
    { path: '/savings', name: 'Mis Ahorros', category: 'Finanzas' },
    { path: '/store', name: 'Tiendita', category: 'Comercio' },
    { path: '/growth', name: 'Banca Digital', category: 'Finanzas' }
  ]

  sidebarPages.forEach((page, index) => {
    setTimeout(() => {
      posthog.capture('sidebar_page_analytics', {
        page_path: page.path,
        page_name: page.name,
        page_category: page.category,
        user_type: 'child',
        user_type_label: 'Niño',
        time_spent: Math.random() * 300000, // 0-5 minutos
        time_spent_seconds: Math.floor(Math.random() * 300),
        time_spent_minutes: Math.round(Math.random() * 5 * 100) / 100,
        engagement_level: ['Muy Bajo', 'Bajo', 'Medio', 'Alto', 'Muy Alto'][Math.floor(Math.random() * 5)],
        session_duration: Math.random() * 1800000, // 0-30 minutos
        session_pages_visited: Math.floor(Math.random() * 10) + 1,
        timestamp: new Date().toISOString()
      })
    }, index * 2000)
  })

  console.log('✅ Eventos de sidebar enviados')
}

export const testSessionMetrics = () => {
  console.log('🧪 Probando métricas de sesión...')
  
  const userTypes = ['tutor', 'child', 'sponsor']
  
  userTypes.forEach((userType, index) => {
    setTimeout(() => {
      posthog.capture('user_session_metrics', {
        user_type: userType,
        user_type_label: userType === 'tutor' ? 'Tutor' : userType === 'child' ? 'Niño' : 'Patrocinador',
        session_duration: Math.random() * 3600000, // 0-60 minutos
        session_duration_minutes: Math.round(Math.random() * 60 * 100) / 100,
        pages_visited: Math.floor(Math.random() * 15) + 1,
        average_page_time: Math.random() * 300000, // 0-5 minutos
        average_page_time_minutes: Math.round(Math.random() * 5 * 100) / 100,
        current_page: '/dashboard',
        current_page_name: 'Inicio',
        is_active: true,
        timestamp: new Date().toISOString()
      })
    }, index * 1500)
  })

  console.log('✅ Métricas de sesión enviadas')
}

// Función para ejecutar todas las pruebas
export const runAllTests = () => {
  console.log('🚀 Ejecutando todas las pruebas de PostHog...')
  
  testPostHogConnection()
  
  setTimeout(() => {
    testUserAnalytics()
  }, 2000)
  
  setTimeout(() => {
    testSidebarAnalytics()
  }, 5000)
  
  setTimeout(() => {
    testSessionMetrics()
  }, 8000)
  
  console.log('✅ Todas las pruebas completadas. Revisa PostHog para ver los eventos.')
}

// Exportar para uso en consola del navegador
if (typeof window !== 'undefined') {
  (window as any).testPostHog = {
    testConnection: testPostHogConnection,
    testUserAnalytics: testUserAnalytics,
    testSidebarAnalytics: testSidebarAnalytics,
    testSessionMetrics: testSessionMetrics,
    runAllTests: runAllTests
  }
}