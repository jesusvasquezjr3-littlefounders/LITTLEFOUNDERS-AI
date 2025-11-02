import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { usePostHog } from './usePostHog'

interface PageTimeData {
  page: string
  startTime: number
  duration?: number
  isActive: boolean
}

interface SessionData {
  sessionStart: number
  totalTime: number
  pages: PageTimeData[]
  lastActivity: number
}

export const usePageTimeTracking = () => {
  const location = useLocation()
  const { trackEvent } = usePostHog()
  const [currentPage, setCurrentPage] = useState<string>('')
  const [pageStartTime, setPageStartTime] = useState<number>(0)
  const [isPageActive, setIsPageActive] = useState<boolean>(true)
  const [sessionData, setSessionData] = useState<SessionData>({
    sessionStart: Date.now(),
    totalTime: 0,
    pages: [],
    lastActivity: Date.now()
  })

  // Refs para mantener referencias estables
  const pageTimerRef = useRef<NodeJS.Timeout | null>(null)
  const sessionTimerRef = useRef<NodeJS.Timeout | null>(null)
  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Configuración de tiempo de inactividad (en milisegundos)
  const INACTIVITY_THRESHOLD = 30000 // 30 segundos
  const PAGE_TRACKING_INTERVAL = 10000 // 10 segundos

  // Función para detectar actividad del usuario
  const updateActivity = () => {
    setSessionData(prev => ({
      ...prev,
      lastActivity: Date.now()
    }))
    
    if (!isPageActive) {
      setIsPageActive(true)
      trackEvent('page_activity_resumed', {
        page: currentPage,
        timestamp: new Date().toISOString(),
        inactive_duration: Date.now() - sessionData.lastActivity
      })
    }

    // Reset inactivity timer
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current)
    }

    inactivityTimerRef.current = setTimeout(() => {
      if (isPageActive) {
        setIsPageActive(false)
        trackEvent('page_activity_paused', {
          page: currentPage,
          timestamp: new Date().toISOString()
        })
      }
    }, INACTIVITY_THRESHOLD)
  }

  // Función para trackear tiempo de página
  const trackPageTime = () => {
    if (pageStartTime > 0 && isPageActive) {
      const duration = Date.now() - pageStartTime
      
      trackEvent('page_time_update', {
        page: currentPage,
        duration: duration,
        duration_seconds: Math.round(duration / 1000),
        timestamp: new Date().toISOString(),
        is_active: isPageActive
      })

      // Actualizar datos de sesión
      setSessionData(prev => {
        const updatedPages = prev.pages.map(p => 
          p.page === currentPage 
            ? { ...p, duration: duration }
            : p
        )
        
        return {
          ...prev,
          pages: updatedPages,
          totalTime: prev.totalTime + PAGE_TRACKING_INTERVAL
        }
      })
    }
  }

  // Función para finalizar el tiempo de una página
  const finalizePageTime = (page: string, startTime: number) => {
    if (startTime > 0) {
      const duration = Date.now() - startTime
      
      trackEvent('page_time_final', {
        page: page,
        duration: duration,
        duration_seconds: Math.round(duration / 1000),
        duration_minutes: Math.round(duration / 60000 * 100) / 100,
        timestamp: new Date().toISOString(),
        is_active: isPageActive
      })

      // Actualizar datos de sesión
      setSessionData(prev => ({
        ...prev,
        pages: [
          ...prev.pages,
          {
            page,
            startTime,
            duration,
            isActive: isPageActive
          }
        ]
      }))
    }
  }

  // Efecto para manejar cambios de página
  useEffect(() => {
    // Finalizar tiempo de página anterior
    if (currentPage && pageStartTime > 0) {
      finalizePageTime(currentPage, pageStartTime)
    }

    // Limpiar timers anteriores
    if (pageTimerRef.current) {
      clearInterval(pageTimerRef.current)
    }

    // Inicializar nueva página
    const newPage = location.pathname
    const newStartTime = Date.now()
    
    setCurrentPage(newPage)
    setPageStartTime(newStartTime)
    setIsPageActive(true)

    // Trackear inicio de página
    trackEvent('page_time_start', {
      page: newPage,
      timestamp: new Date().toISOString(),
      previous_page: currentPage || null,
      session_duration: Date.now() - sessionData.sessionStart
    })

    // Configurar timer para tracking periódico
    pageTimerRef.current = setInterval(trackPageTime, PAGE_TRACKING_INTERVAL)

    // Cleanup
    return () => {
      if (pageTimerRef.current) {
        clearInterval(pageTimerRef.current)
      }
    }
  }, [location.pathname])

  // Efecto para detectar actividad del usuario
  useEffect(() => {
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click']
    
    events.forEach(event => {
      document.addEventListener(event, updateActivity, true)
    })

    // Cleanup
    return () => {
      events.forEach(event => {
        document.removeEventListener(event, updateActivity, true)
      })
      
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current)
      }
    }
  }, [currentPage, isPageActive])

  // Efecto para tracking de sesión
  useEffect(() => {
    sessionTimerRef.current = setInterval(() => {
      const sessionDuration = Date.now() - sessionData.sessionStart
      
      trackEvent('session_time_update', {
        session_duration: sessionDuration,
        session_duration_minutes: Math.round(sessionDuration / 60000 * 100) / 100,
        pages_visited: sessionData.pages.length,
        current_page: currentPage,
        timestamp: new Date().toISOString()
      })
    }, 60000) // Cada minuto

    return () => {
      if (sessionTimerRef.current) {
        clearInterval(sessionTimerRef.current)
      }
    }
  }, [sessionData.sessionStart, sessionData.pages.length, currentPage])

  // Función para obtener estadísticas de la sesión actual
  const getSessionStats = () => {
    const totalDuration = Date.now() - sessionData.sessionStart
    const activePages = sessionData.pages.filter(p => p.isActive)
    const totalPageTime = sessionData.pages.reduce((sum, p) => sum + (p.duration || 0), 0)
    
    return {
      sessionDuration: totalDuration,
      sessionDurationMinutes: Math.round(totalDuration / 60000 * 100) / 100,
      pagesVisited: sessionData.pages.length,
      totalPageTime: totalPageTime,
      averagePageTime: sessionData.pages.length > 0 ? totalPageTime / sessionData.pages.length : 0,
      currentPage: currentPage,
      currentPageDuration: pageStartTime > 0 ? Date.now() - pageStartTime : 0,
      isActive: isPageActive
    }
  }

  // Función para finalizar sesión
  const finalizeSession = () => {
    const stats = getSessionStats()
    
    trackEvent('session_final', {
      session_duration: stats.sessionDuration,
      session_duration_minutes: stats.sessionDurationMinutes,
      pages_visited: stats.pagesVisited,
      total_page_time: stats.totalPageTime,
      average_page_time: stats.averagePageTime,
      timestamp: new Date().toISOString()
    })

    // Limpiar todos los timers
    if (pageTimerRef.current) clearInterval(pageTimerRef.current)
    if (sessionTimerRef.current) clearInterval(sessionTimerRef.current)
    if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current)
  }

  return {
    currentPage,
    pageStartTime,
    isPageActive,
    sessionData,
    getSessionStats,
    finalizeSession
  }
}
