import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { usePostHog } from '@/hooks/usePostHog'

interface UserPageTimeData {
  page: string
  pageName: string
  userType: string
  userId: string
  startTime: number
  duration?: number
  isActive: boolean
  sessionId: string
}

interface UserSessionData {
  sessionId: string
  userId: string
  userType: string
  sessionStart: number
  totalTime: number
  pages: UserPageTimeData[]
  lastActivity: number
}

// Mapeo de rutas a nombres de páginas del sidebar
const SIDEBAR_PAGES: Record<string, string> = {
  '/dashboard': 'Inicio',
  '/savings': 'Mis Ahorros',
  '/customers': 'Amiguitos',
  '/store': 'Tiendita',
  '/team': 'Mi Equipo',
  '/lecciones': 'Lecciones',
  '/lecciones-v2': 'Lecciones V.2',
  '/tasks': 'Mis Tareas',
  '/parent-tasks': 'Gestión de Tareas',
  '/investment-games': 'Aprende a invertir',
  '/growth': 'Banca Digital',
  '/lemonade-stand': 'Lemonade Stand'
}

// Función para obtener información del usuario desde localStorage
const getUserInfo = () => {
  try {
    const user = JSON.parse(localStorage.getItem('user') || '{}')
    return {
      userId: user.id || 'anonymous',
      userType: user.user_type || 'unknown',
      userName: user.name || 'Unknown User'
    }
  } catch {
    return {
      userId: 'anonymous',
      userType: 'unknown',
      userName: 'Unknown User'
    }
  }
}

// Función para determinar si una ruta pertenece a una página del sidebar
const isSidebarPage = (path: string): boolean => {
  return Object.keys(SIDEBAR_PAGES).some(sidebarPath => 
    path === sidebarPath || path.startsWith(sidebarPath + '/')
  )
}

// Función para obtener el nombre de la página del sidebar
const getSidebarPageName = (path: string): string => {
  for (const [sidebarPath, pageName] of Object.entries(SIDEBAR_PAGES)) {
    if (path === sidebarPath || path.startsWith(sidebarPath + '/')) {
      return pageName
    }
  }
  return path
}

export const useUserPageTimeTracking = () => {
  const location = useLocation()
  const { trackEvent } = usePostHog()
  const [currentPage, setCurrentPage] = useState<string>('')
  const [currentPageName, setCurrentPageName] = useState<string>('')
  const [pageStartTime, setPageStartTime] = useState<number>(0)
  const [isPageActive, setIsPageActive] = useState<boolean>(true)
  const [userInfo, setUserInfo] = useState(getUserInfo())
  const [sessionData, setSessionData] = useState<UserSessionData>({
    sessionId: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    userId: userInfo.userId,
    userType: userInfo.userType,
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
  const PAGE_TRACKING_INTERVAL = 15000 // 15 segundos

  // Función para detectar actividad del usuario
  const updateActivity = () => {
    setSessionData(prev => ({
      ...prev,
      lastActivity: Date.now()
    }))
    
    if (!isPageActive) {
      setIsPageActive(true)
      trackEvent('user_page_activity_resumed', {
        page: currentPage,
        page_name: currentPageName,
        user_type: userInfo.userType,
        user_id: userInfo.userId,
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
        trackEvent('user_page_activity_paused', {
          page: currentPage,
          page_name: currentPageName,
          user_type: userInfo.userType,
          user_id: userInfo.userId,
          timestamp: new Date().toISOString()
        })
      }
    }, INACTIVITY_THRESHOLD)
  }

  // Función para trackear tiempo de página
  const trackPageTime = () => {
    if (pageStartTime > 0 && isPageActive && isSidebarPage(currentPage)) {
      const duration = Date.now() - pageStartTime
      
      trackEvent('user_page_time_update', {
        page: currentPage,
        page_name: currentPageName,
        user_type: userInfo.userType,
        user_id: userInfo.userId,
        session_id: sessionData.sessionId,
        duration: duration,
        duration_seconds: Math.round(duration / 1000),
        duration_minutes: Math.round(duration / 60000 * 100) / 100,
        timestamp: new Date().toISOString(),
        is_active: isPageActive,
        is_sidebar_page: true
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
  const finalizePageTime = (page: string, pageName: string, startTime: number) => {
    if (startTime > 0 && isSidebarPage(page)) {
      const duration = Date.now() - startTime
      
      trackEvent('user_page_time_final', {
        page: page,
        page_name: pageName,
        user_type: userInfo.userType,
        user_id: userInfo.userId,
        session_id: sessionData.sessionId,
        duration: duration,
        duration_seconds: Math.round(duration / 1000),
        duration_minutes: Math.round(duration / 60000 * 100) / 100,
        timestamp: new Date().toISOString(),
        is_active: isPageActive,
        is_sidebar_page: true
      })

      // Actualizar datos de sesión
      setSessionData(prev => ({
        ...prev,
        pages: [
          ...prev.pages,
          {
            page,
            pageName,
            userType: userInfo.userType,
            userId: userInfo.userId,
            startTime,
            duration,
            isActive: isPageActive,
            sessionId: sessionData.sessionId
          }
        ]
      }))
    }
  }

  // Efecto para manejar cambios de página
  useEffect(() => {
    // Finalizar tiempo de página anterior
    if (currentPage && pageStartTime > 0) {
      finalizePageTime(currentPage, currentPageName, pageStartTime)
    }

    // Limpiar timers anteriores
    if (pageTimerRef.current) {
      clearInterval(pageTimerRef.current)
    }

    // Inicializar nueva página
    const newPage = location.pathname
    const newPageName = getSidebarPageName(newPage)
    const newStartTime = Date.now()
    
    setCurrentPage(newPage)
    setCurrentPageName(newPageName)
    setPageStartTime(newStartTime)
    setIsPageActive(true)

    // Solo trackear si es una página del sidebar
    if (isSidebarPage(newPage)) {
      // Trackear inicio de página
      trackEvent('user_page_time_start', {
        page: newPage,
        page_name: newPageName,
        user_type: userInfo.userType,
        user_id: userInfo.userId,
        session_id: sessionData.sessionId,
        timestamp: new Date().toISOString(),
        previous_page: currentPage || null,
        session_duration: Date.now() - sessionData.sessionStart,
        is_sidebar_page: true
      })

      // Configurar timer para tracking periódico
      pageTimerRef.current = setInterval(trackPageTime, PAGE_TRACKING_INTERVAL)
    }

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
      
      trackEvent('user_session_time_update', {
        user_type: userInfo.userType,
        user_id: userInfo.userId,
        session_id: sessionData.sessionId,
        session_duration: sessionDuration,
        session_duration_minutes: Math.round(sessionDuration / 60000 * 100) / 100,
        pages_visited: sessionData.pages.length,
        current_page: currentPage,
        current_page_name: currentPageName,
        timestamp: new Date().toISOString()
      })
    }, 60000) // Cada minuto

    return () => {
      if (sessionTimerRef.current) {
        clearInterval(sessionTimerRef.current)
      }
    }
  }, [sessionData.sessionStart, sessionData.pages.length, currentPage])

  // Efecto para actualizar información del usuario cuando cambia
  useEffect(() => {
    const newUserInfo = getUserInfo()
    setUserInfo(newUserInfo)
    setSessionData(prev => ({
      ...prev,
      userId: newUserInfo.userId,
      userType: newUserInfo.userType
    }))
  }, [])

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
      currentPageName: currentPageName,
      currentPageDuration: pageStartTime > 0 ? Date.now() - pageStartTime : 0,
      isActive: isPageActive,
      userType: userInfo.userType,
      userId: userInfo.userId
    }
  }

  // Función para finalizar sesión
  const finalizeSession = () => {
    const stats = getSessionStats()
    
    trackEvent('user_session_final', {
      user_type: userInfo.userType,
      user_id: userInfo.userId,
      session_id: sessionData.sessionId,
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
    currentPageName,
    pageStartTime,
    isPageActive,
    sessionData,
    userInfo,
    getSessionStats,
    finalizeSession
  }
}
