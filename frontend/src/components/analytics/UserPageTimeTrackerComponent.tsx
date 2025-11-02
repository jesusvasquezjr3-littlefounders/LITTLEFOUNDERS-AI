import { useEffect } from 'react'
import { useUserPageTimeTracking } from './UserPageTimeTracker'

interface UserPageTimeTrackerProps {
  children: React.ReactNode
  enableDebugMode?: boolean
}

export const UserPageTimeTrackerComponent = ({ children, enableDebugMode = false }: UserPageTimeTrackerProps) => {
  const {
    currentPage,
    currentPageName,
    pageStartTime,
    isPageActive,
    sessionData,
    userInfo,
    getSessionStats,
    finalizeSession
  } = useUserPageTimeTracking()

  // Debug mode para desarrollo
  useEffect(() => {
    if (enableDebugMode && import.meta.env.DEV) {
      const stats = getSessionStats()
      console.log('👤 User Page Time Analytics:', {
        userType: userInfo.userType,
        userId: userInfo.userId,
        currentPage,
        currentPageName,
        currentPageDuration: stats.currentPageDuration,
        sessionDuration: stats.sessionDurationMinutes,
        isActive: isPageActive,
        pagesVisited: stats.pagesVisited
      })
    }
  }, [currentPage, pageStartTime, isPageActive, enableDebugMode, getSessionStats, userInfo])

  // Finalizar sesión cuando el usuario sale de la página
  useEffect(() => {
    const handleBeforeUnload = () => {
      finalizeSession()
    }

    const handleVisibilityChange = () => {
      if (document.hidden) {
        finalizeSession()
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [finalizeSession])

  return <>{children}</>
}

// Hook para obtener estadísticas de tiempo por usuario en tiempo real
export const useUserPageTimeStats = () => {
  const { getSessionStats } = useUserPageTimeTracking()
  return getSessionStats()
}
