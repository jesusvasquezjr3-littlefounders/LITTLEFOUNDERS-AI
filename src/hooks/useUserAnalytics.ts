import { useUserPageTimeStats } from '@/components/analytics/UserPageTimeTrackerComponent'

export const useUserAnalytics = () => {
  const stats = useUserPageTimeStats()

  const formatTime = (ms: number): string => {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`
    } else {
      return `${seconds}s`
    }
  }

  const getUserTypeInfo = (userType: string) => {
    switch (userType) {
      case 'tutor':
        return {
          label: 'Tutor',
          color: 'blue',
          description: 'Padre o tutor responsable'
        }
      case 'child':
        return {
          label: 'Niño',
          color: 'green',
          description: 'Usuario principal (niño)'
        }
      case 'sponsor':
        return {
          label: 'Patrocinador',
          color: 'purple',
          description: 'Patrocinador financiero'
        }
      default:
        return {
          label: 'Desconocido',
          color: 'gray',
          description: 'Tipo de usuario no identificado'
        }
    }
  }

  const getPageInfo = (page: string) => {
    const sidebarPages: Record<string, { name: string; description: string; category: string }> = {
      '/dashboard': { name: 'Inicio', description: 'Dashboard principal', category: 'Navegación' },
      '/savings': { name: 'Mis Ahorros', description: 'Gestión de ahorros', category: 'Finanzas' },
      '/customers': { name: 'Amiguitos', description: 'Gestión de clientes', category: 'Negocio' },
      '/store': { name: 'Tiendita', description: 'Tienda virtual', category: 'Comercio' },
      '/team': { name: 'Mi Equipo', description: 'Gestión de equipo', category: 'Colaboración' },
      '/lecciones': { name: 'Lecciones', description: 'Sistema de aprendizaje', category: 'Educación' },
      '/lecciones-v2': { name: 'Lecciones V.2', description: 'Nueva versión de lecciones', category: 'Educación' },
      '/tasks': { name: 'Mis Tareas', description: 'Tareas del niño', category: 'Productividad' },
      '/parent-tasks': { name: 'Gestión de Tareas', description: 'Tareas para padres', category: 'Productividad' },
      '/investment-games': { name: 'Aprende a invertir', description: 'Juegos de inversión', category: 'Educación' },
      '/growth': { name: 'Banca Digital', description: 'Servicios bancarios', category: 'Finanzas' },
      '/lemonade-stand': { name: 'Lemonade Stand', description: 'Juego de limonada', category: 'Juegos' }
    }

    return sidebarPages[page] || { name: page, description: 'Página personalizada', category: 'Otros' }
  }

  const getEngagementLevel = (duration: number): { level: string; color: string; description: string } => {
    if (duration < 10000) { // < 10 segundos
      return { level: 'Muy Bajo', color: 'red', description: 'Visita muy corta' }
    } else if (duration < 30000) { // < 30 segundos
      return { level: 'Bajo', color: 'orange', description: 'Visita corta' }
    } else if (duration < 120000) { // < 2 minutos
      return { level: 'Medio', color: 'yellow', description: 'Visita moderada' }
    } else if (duration < 300000) { // < 5 minutos
      return { level: 'Alto', color: 'green', description: 'Visita larga' }
    } else { // > 5 minutos
      return { level: 'Muy Alto', color: 'blue', description: 'Visita muy larga' }
    }
  }

  const getSessionSummary = () => {
    const userTypeInfo = getUserTypeInfo(stats.userType)
    const pageInfo = getPageInfo(stats.currentPage)
    const engagementLevel = getEngagementLevel(stats.currentPageDuration)

    return {
      user: {
        id: stats.userId,
        type: stats.userType,
        typeInfo: userTypeInfo
      },
      currentPage: {
        path: stats.currentPage,
        name: stats.currentPageName,
        info: pageInfo,
        duration: stats.currentPageDuration,
        formattedDuration: formatTime(stats.currentPageDuration),
        engagement: engagementLevel
      },
      session: {
        duration: stats.sessionDuration,
        formattedDuration: formatTime(stats.sessionDuration),
        pagesVisited: stats.pagesVisited,
        averagePageTime: stats.averagePageTime,
        formattedAverageTime: formatTime(stats.averagePageTime),
        isActive: stats.isActive
      }
    }
  }

  return {
    stats,
    formatTime,
    getUserTypeInfo,
    getPageInfo,
    getEngagementLevel,
    getSessionSummary
  }
}
