import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { usePostHog } from '@/hooks/usePostHog'

interface TimeAnalyticsData {
  page: string
  totalTime: number
  visitCount: number
  averageTime: number
  minTime: number
  maxTime: number
  lastUpdated: string
}

interface TimeAnalyticsTrackerProps {
  children: React.ReactNode
}

export const TimeAnalyticsTracker = ({ children }: TimeAnalyticsTrackerProps) => {
  const location = useLocation()
  const { trackEvent } = usePostHog()
  const [currentPageStartTime, setCurrentPageStartTime] = useState<number>(Date.now())
  const [sessionStartTime, setSessionStartTime] = useState<number>(Date.now())
  const [pageTimes, setPageTimes] = useState<Map<string, number[]>>(new Map())

  const pageStartTimeRef = useRef<number>(Date.now())
  const sessionStartTimeRef = useRef<number>(Date.now())
  const trackingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const hasTrackedPageLeave = useRef<boolean>(false)

  // Función para obtener datos de tiempo desde localStorage
  const getTimeAnalyticsData = (): Map<string, TimeAnalyticsData> => {
    try {
      const stored = localStorage.getItem('time_analytics_data')
      if (stored) {
        const parsed = JSON.parse(stored)
        return new Map(Object.entries(parsed))
      }
    } catch (error) {
      console.error('Error reading time analytics data:', error)
    }
    return new Map()
  }

  // Función para guardar datos de tiempo en localStorage
  const saveTimeAnalyticsData = (data: Map<string, TimeAnalyticsData>) => {
    try {
      const objectData = Object.fromEntries(data.entries())
      localStorage.setItem('time_analytics_data', JSON.stringify(objectData))
    } catch (error) {
      console.error('Error saving time analytics data:', error)
    }
  }

  // Función para calcular estadísticas de tiempo
  const calculateTimeStats = (times: number[]): Omit<TimeAnalyticsData, 'page' | 'lastUpdated'> => {
    if (times.length === 0) {
      return {
        totalTime: 0,
        visitCount: 0,
        averageTime: 0,
        minTime: 0,
        maxTime: 0
      }
    }

    const totalTime = times.reduce((sum, time) => sum + time, 0)
    const averageTime = totalTime / times.length
    const minTime = Math.min(...times)
    const maxTime = Math.max(...times)

    return {
      totalTime,
      visitCount: times.length,
      averageTime,
      minTime,
      maxTime
    }
  }

  // Función para trackear tiempo de página
  const trackPageTime = (pagePath: string, duration: number) => {
    const now = new Date().toISOString()
    const timeData = getTimeAnalyticsData()

    // Obtener tiempos existentes para esta página
    const existingData = timeData.get(pagePath)
    const existingTimes = pageTimes.get(pagePath) || []
    const allTimes = [...existingTimes, duration]

    // Calcular estadísticas
    const stats = calculateTimeStats(allTimes)

    const newData: TimeAnalyticsData = {
      page: pagePath,
      lastUpdated: now,
      ...stats
    }

    timeData.set(pagePath, newData)
    saveTimeAnalyticsData(timeData)

    // Actualizar estado local
    setPageTimes(prev => new Map(prev.set(pagePath, allTimes)))

    // Enviar evento detallado a PostHog
    trackEvent('page_time_analytics', {
      page_path: pagePath,
      page_name: getPageDisplayName(pagePath),
      duration_ms: duration,
      duration_seconds: Math.round(duration / 1000),
      duration_minutes: Math.round(duration / 60000 * 100) / 100,
      visit_number: allTimes.length,
      total_time_all_visits_ms: stats.totalTime,
      total_time_all_visits_minutes: Math.round(stats.totalTime / 60000 * 100) / 100,
      average_time_ms: Math.round(stats.averageTime),
      average_time_seconds: Math.round(stats.averageTime / 1000),
      average_time_minutes: Math.round(stats.averageTime / 60000 * 100) / 100,
      min_time_ms: stats.minTime,
      max_time_ms: stats.maxTime,
      time_variance: stats.maxTime - stats.minTime,
      timestamp: now
    })

    // Enviar evento agregado para análisis de tendencias
    trackEvent('page_time_trends', {
      page_path: pagePath,
      average_time_seconds: Math.round(stats.averageTime / 1000),
      total_visits: stats.visitCount,
      engagement_score: calculateEngagementScore(duration, stats.averageTime),
      time_category: getTimeCategory(duration),
      timestamp: now
    })
  }

  // Función para obtener nombre de visualización de página
  const getPageDisplayName = (path: string): string => {
    const pageNames: Record<string, string> = {
      '/': 'Welcome',
      '/dashboard': 'Dashboard',
      '/welcome': 'Welcome',
      '/login': 'Login',
      '/register': 'Register',
      '/lecciones': 'Lessons',
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

  // Función para calcular score de engagement basado en tiempo
  const calculateEngagementScore = (currentTime: number, averageTime: number): number => {
    if (averageTime === 0) return 1
    const ratio = currentTime / averageTime
    return Math.min(Math.max(ratio, 0), 3) // Entre 0 y 3
  }

  // Función para categorizar tiempo de visita
  const getTimeCategory = (duration: number): string => {
    if (duration < 10000) return 'very_short' // < 10 segundos
    if (duration < 30000) return 'short' // < 30 segundos
    if (duration < 120000) return 'medium' // < 2 minutos
    if (duration < 300000) return 'long' // < 5 minutos
    return 'very_long' // > 5 minutos
  }

  // Función para trackear estadísticas de sesión
  const trackSessionTimeStats = () => {
    const sessionDuration = Date.now() - sessionStartTimeRef.current
    const timeData = getTimeAnalyticsData()
    const allPages = Array.from(timeData.values())

    const totalAverageTime = allPages.length > 0
      ? allPages.reduce((sum, page) => sum + page.averageTime, 0) / allPages.length
      : 0

    const mostEngagingPage = allPages.sort((a, b) => b.averageTime - a.averageTime)[0]

    trackEvent('session_time_summary', {
      session_duration_ms: sessionDuration,
      session_duration_minutes: Math.round(sessionDuration / 60000 * 100) / 100,
      pages_visited: allPages.length,
      overall_average_time_ms: Math.round(totalAverageTime),
      overall_average_time_minutes: Math.round(totalAverageTime / 60000 * 100) / 100,
      most_engaging_page: mostEngagingPage?.page || null,
      most_engaging_page_avg_time: mostEngagingPage ? Math.round(mostEngagingPage.averageTime / 1000) : 0,
      timestamp: new Date().toISOString()
    })
  }

  // Función para trackear tiempo en tiempo real
  const trackRealTimeAnalytics = () => {
    const currentTime = Date.now() - pageStartTimeRef.current
    const currentPath = location.pathname

    trackEvent('page_time_realtime', {
      page_path: currentPath,
      current_time_ms: currentTime,
      current_time_seconds: Math.round(currentTime / 1000),
      session_duration_ms: Date.now() - sessionStartTimeRef.current,
      timestamp: new Date().toISOString()
    })
  }

  // Efecto para manejar cambios de página
  useEffect(() => {
    // Finalizar tracking de página anterior
    if (hasTrackedPageLeave.current === false && pageStartTimeRef.current > 0) {
      const duration = Date.now() - pageStartTimeRef.current
      const previousPage = location.pathname

      if (duration > 1000) { // Solo trackear si pasó más de 1 segundo
        trackPageTime(previousPage, duration)
      }
      hasTrackedPageLeave.current = true
    }

    // Limpiar timer anterior
    if (trackingIntervalRef.current) {
      clearInterval(trackingIntervalRef.current)
    }

    // Inicializar nueva página
    pageStartTimeRef.current = Date.now()
    setCurrentPageStartTime(Date.now())
    hasTrackedPageLeave.current = false

    // Configurar tracking en tiempo real cada 10 segundos
    trackingIntervalRef.current = setInterval(trackRealTimeAnalytics, 10000)

    // Trackear inicio de página
    trackEvent('page_time_start', {
      page_path: location.pathname,
      page_name: getPageDisplayName(location.pathname),
      timestamp: new Date().toISOString()
    })

    // Cleanup
    return () => {
      if (trackingIntervalRef.current) {
        clearInterval(trackingIntervalRef.current)
      }
    }
  }, [location.pathname, trackEvent])

  // Efecto para trackear estadísticas de sesión periódicamente
  useEffect(() => {
    const interval = setInterval(trackSessionTimeStats, 60000) // Cada minuto

    return () => clearInterval(interval)
  }, [])

  // Efecto para finalizar sesión
  useEffect(() => {
    const handleBeforeUnload = () => {
      const duration = Date.now() - pageStartTimeRef.current
      if (duration > 1000) {
        trackPageTime(location.pathname, duration)
      }
      trackSessionTimeStats()
    }

    const handleVisibilityChange = () => {
      if (document.hidden) {
        const duration = Date.now() - pageStartTimeRef.current
        if (duration > 1000) {
          trackPageTime(location.pathname, duration)
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

  return <>{children}</>
}

// Hook para acceder a estadísticas de tiempo
export const useTimeAnalytics = () => {
  const getTimeAnalyticsData = (): Map<string, TimeAnalyticsData> => {
    try {
      const stored = localStorage.getItem('time_analytics_data')
      if (stored) {
        const parsed = JSON.parse(stored)
        return new Map(Object.entries(parsed))
      }
    } catch (error) {
      console.error('Error reading time analytics data:', error)
    }
    return new Map()
  }

  const getAverageTimeByPage = (): Record<string, number> => {
    const timeData = getTimeAnalyticsData()
    const averages: Record<string, number> = {}

    timeData.forEach((data, path) => {
      averages[path] = data.averageTime
    })

    return averages
  }

  const getTopPagesByTime = (limit: number = 10): TimeAnalyticsData[] => {
    const timeData = getTimeAnalyticsData()
    return Array.from(timeData.values())
      .sort((a, b) => b.averageTime - a.averageTime)
      .slice(0, limit)
  }

  const getOverallTimeStats = () => {
    const timeData = getTimeAnalyticsData()
    const pages = Array.from(timeData.values())

    if (pages.length === 0) {
      return {
        totalPages: 0,
        overallAverageTime: 0,
        totalTime: 0,
        mostEngagingPage: null,
        leastEngagingPage: null
      }
    }

    const totalTime = pages.reduce((sum, page) => sum + page.totalTime, 0)
    const overallAverageTime = pages.reduce((sum, page) => sum + page.averageTime, 0) / pages.length

    const sortedByTime = pages.sort((a, b) => b.averageTime - a.averageTime)

    return {
      totalPages: pages.length,
      overallAverageTime: Math.round(overallAverageTime),
      totalTime: Math.round(totalTime),
      mostEngagingPage: sortedByTime[0] || null,
      leastEngagingPage: sortedByTime[sortedByTime.length - 1] || null
    }
  }

  return {
    getAverageTimeByPage,
    getTopPagesByTime,
    getOverallTimeStats
  }
}
