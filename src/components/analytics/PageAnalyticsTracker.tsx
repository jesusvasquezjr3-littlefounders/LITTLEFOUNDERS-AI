import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { usePostHog } from '@/hooks/usePostHog'

interface PageVisitData {
  page: string
  visitCount: number
  totalTime: number
  averageTime: number
  lastVisit: string
  firstVisit: string
}

interface PageAnalyticsTrackerProps {
  children: React.ReactNode
}

export const PageAnalyticsTracker = ({ children }: PageAnalyticsTrackerProps) => {
  const location = useLocation()
  const { trackEvent, posthog } = usePostHog()
  const [currentPageStartTime, setCurrentPageStartTime] = useState<number>(Date.now())
  const [sessionPageVisits, setSessionPageVisits] = useState<string[]>([])
  const [pageVisitTimes, setPageVisitTimes] = useState<Map<string, number>>(new Map())
  
  const pageStartTimeRef = useRef<number>(Date.now())
  const hasTrackedPageLeave = useRef<boolean>(false)

  // Función para obtener datos de visitas de páginas desde localStorage
  const getPageVisitData = (): Map<string, PageVisitData> => {
    try {
      const stored = localStorage.getItem('page_visit_analytics')
      if (stored) {
        const parsed = JSON.parse(stored)
        return new Map(Object.entries(parsed))
      }
    } catch (error) {
      console.error('Error reading page visit data:', error)
    }
    return new Map()
  }

  // Función para guardar datos de visitas de páginas en localStorage
  const savePageVisitData = (data: Map<string, PageVisitData>) => {
    try {
      const objectData = Object.fromEntries(data.entries())
      localStorage.setItem('page_visit_analytics', JSON.stringify(objectData))
    } catch (error) {
      console.error('Error saving page visit data:', error)
    }
  }

  // Función para trackear visita de página
  const trackPageVisit = (pagePath: string, duration: number) => {
    const now = new Date().toISOString()
    const pageData = getPageVisitData()
    
    const existingData = pageData.get(pagePath)
    const newData: PageVisitData = existingData 
      ? {
          ...existingData,
          visitCount: existingData.visitCount + 1,
          totalTime: existingData.totalTime + duration,
          averageTime: (existingData.totalTime + duration) / (existingData.visitCount + 1),
          lastVisit: now
        }
      : {
          page: pagePath,
          visitCount: 1,
          totalTime: duration,
          averageTime: duration,
          lastVisit: now,
          firstVisit: now
        }

    pageData.set(pagePath, newData)
    savePageVisitData(pageData)

    // Enviar evento a PostHog con datos detallados
    trackEvent('page_visit_detailed', {
      page_path: pagePath,
      page_name: getPageDisplayName(pagePath),
      visit_count: newData.visitCount,
      session_visit_number: sessionPageVisits.length + 1,
      duration_ms: duration,
      duration_seconds: Math.round(duration / 1000),
      duration_minutes: Math.round(duration / 60000 * 100) / 100,
      average_time_all_visits: Math.round(newData.averageTime / 1000),
      total_time_all_visits: Math.round(newData.totalTime / 1000),
      is_returning_visitor: newData.visitCount > 1,
      first_visit: newData.firstVisit,
      last_visit: newData.lastVisit,
      timestamp: now,
      session_pages_visited: sessionPageVisits.length,
      previous_page: sessionPageVisits[sessionPageVisits.length - 1] || null
    })

    // Enviar evento agregado para análisis de tendencias
    trackEvent('page_popularity_update', {
      page_path: pagePath,
      total_visits: newData.visitCount,
      average_time_seconds: Math.round(newData.averageTime / 1000),
      popularity_rank: getPopularityRank(pageData, pagePath),
      timestamp: now
    })
  }

  // Función para obtener el nombre de visualización de la página
  const getPageDisplayName = (path: string): string => {
    const pageNames: Record<string, string> = {
      '/': 'Welcome',
      '/dashboard': 'Dashboard',
      '/welcome': 'Welcome',
      '/login': 'Login',
      '/register': 'Register',
      '/lecciones': 'Lessons',
      '/lecciones-v2': 'Lessons V2',
      '/profile': 'Profile',
      '/tasks': 'Tasks',
      '/parent-tasks': 'Parent Tasks',
      '/growth': 'Digital Banking',
      '/savings': 'Savings',
      '/store': 'Store',
      '/investment-games': 'Investment Games',
      '/lemonade-stand': 'Lemonade Stand'
    }
    return pageNames[path] || path
  }

  // Función para obtener el ranking de popularidad de una página
  const getPopularityRank = (pageData: Map<string, PageVisitData>, currentPage: string): number => {
    const sortedPages = Array.from(pageData.entries())
      .sort(([,a], [,b]) => b.visitCount - a.visitCount)
      .map(([path]) => path)
    
    return sortedPages.indexOf(currentPage) + 1
  }

  // Función para trackear estadísticas de sesión
  const trackSessionStats = () => {
    const sessionDuration = Date.now() - pageStartTimeRef.current
    const uniquePages = new Set(sessionPageVisits).size
    
    trackEvent('session_analytics', {
      session_duration_ms: sessionDuration,
      session_duration_minutes: Math.round(sessionDuration / 60000 * 100) / 100,
      pages_visited_count: sessionPageVisits.length,
      unique_pages_count: uniquePages,
      session_start_time: new Date(pageStartTimeRef.current).toISOString(),
      pages_visited: sessionPageVisits,
      timestamp: new Date().toISOString()
    })
  }

  // Efecto para manejar cambios de página
  useEffect(() => {
    // Finalizar tracking de página anterior
    if (hasTrackedPageLeave.current === false && pageStartTimeRef.current > 0) {
      const duration = Date.now() - pageStartTimeRef.current
      const previousPage = sessionPageVisits[sessionPageVisits.length - 1]
      
      if (previousPage && duration > 1000) { // Solo trackear si pasó más de 1 segundo
        trackPageVisit(previousPage, duration)
      }
      hasTrackedPageLeave.current = true
    }

    // Inicializar nueva página
    const currentPath = location.pathname
    pageStartTimeRef.current = Date.now()
    setCurrentPageStartTime(Date.now())
    hasTrackedPageLeave.current = false

    // Actualizar visitas de sesión
    setSessionPageVisits(prev => [...prev, currentPath])

    // Trackear inicio de nueva página
    trackEvent('page_view_enhanced', {
      page_path: currentPath,
      page_name: getPageDisplayName(currentPath),
      session_page_number: sessionPageVisits.length + 1,
      timestamp: new Date().toISOString(),
      referrer: document.referrer,
      user_agent: navigator.userAgent,
      screen_resolution: `${screen.width}x${screen.height}`,
      viewport_size: `${window.innerWidth}x${window.innerHeight}`
    })

    // Cleanup function para cuando el componente se desmonte
    return () => {
      const duration = Date.now() - pageStartTimeRef.current
      if (duration > 1000) {
        trackPageVisit(currentPath, duration)
      }
    }
  }, [location.pathname, trackEvent])

  // Efecto para trackear estadísticas de sesión periódicamente
  useEffect(() => {
    const interval = setInterval(trackSessionStats, 30000) // Cada 30 segundos
    
    return () => clearInterval(interval)
  }, [sessionPageVisits])

  // Efecto para finalizar sesión cuando el usuario sale
  useEffect(() => {
    const handleBeforeUnload = () => {
      const duration = Date.now() - pageStartTimeRef.current
      if (duration > 1000) {
        trackPageVisit(location.pathname, duration)
      }
      trackSessionStats()
    }

    const handleVisibilityChange = () => {
      if (document.hidden) {
        const duration = Date.now() - pageStartTimeRef.current
        if (duration > 1000) {
          trackPageVisit(location.pathname, duration)
        }
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [location.pathname])

  // Función para obtener estadísticas de páginas más visitadas
  const getTopPages = (limit: number = 10): PageVisitData[] => {
    const pageData = getPageVisitData()
    return Array.from(pageData.values())
      .sort((a, b) => b.visitCount - a.visitCount)
      .slice(0, limit)
  }

  // Función para obtener estadísticas de tiempo promedio por página
  const getAverageTimeByPage = (): Record<string, number> => {
    const pageData = getPageVisitData()
    const averages: Record<string, number> = {}
    
    pageData.forEach((data, path) => {
      averages[path] = data.averageTime
    })
    
    return averages
  }

  return <>{children}</>
}

// Hook para acceder a las estadísticas de páginas desde otros componentes
export const usePageAnalytics = () => {
  const getPageVisitData = (): Map<string, PageVisitData> => {
    try {
      const stored = localStorage.getItem('page_visit_analytics')
      if (stored) {
        const parsed = JSON.parse(stored)
        return new Map(Object.entries(parsed))
      }
    } catch (error) {
      console.error('Error reading page visit data:', error)
    }
    return new Map()
  }

  const getTopPages = (limit: number = 10): PageVisitData[] => {
    const pageData = getPageVisitData()
    return Array.from(pageData.values())
      .sort((a, b) => b.visitCount - a.visitCount)
      .slice(0, limit)
  }

  const getAverageTimeByPage = (): Record<string, number> => {
    const pageData = getPageVisitData()
    const averages: Record<string, number> = {}
    
    pageData.forEach((data, path) => {
      averages[path] = data.averageTime
    })
    
    return averages
  }

  const getPageStats = (pagePath: string): PageVisitData | null => {
    const pageData = getPageVisitData()
    return pageData.get(pagePath) || null
  }

  const getOverallStats = () => {
    const pageData = getPageVisitData()
    const pages = Array.from(pageData.values())
    
    const totalVisits = pages.reduce((sum, page) => sum + page.visitCount, 0)
    const totalTime = pages.reduce((sum, page) => sum + page.totalTime, 0)
    const averageTime = pages.length > 0 ? totalTime / pages.length : 0
    
    return {
      totalPages: pages.length,
      totalVisits,
      totalTime,
      averageTime,
      mostVisitedPage: pages.sort((a, b) => b.visitCount - a.visitCount)[0] || null,
      longestAverageTime: pages.sort((a, b) => b.averageTime - a.averageTime)[0] || null
    }
  }

  return {
    getTopPages,
    getAverageTimeByPage,
    getPageStats,
    getOverallStats
  }
}
