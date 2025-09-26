import { useEffect } from 'react'
import { usePageTimeTracking } from '@/hooks/usePageTimeTracking'

interface PageTimeTrackerProps {
  children: React.ReactNode
  enableDebugMode?: boolean
}

export const PageTimeTracker = ({ children, enableDebugMode = false }: PageTimeTrackerProps) => {
  const {
    currentPage,
    pageStartTime,
    isPageActive,
    sessionData,
    getSessionStats,
    finalizeSession
  } = usePageTimeTracking()

  // Debug mode para desarrollo
  useEffect(() => {
    if (enableDebugMode && import.meta.env.DEV) {
      const stats = getSessionStats()
      console.log('📊 Page Time Analytics:', {
        currentPage,
        currentPageDuration: stats.currentPageDuration,
        sessionDuration: stats.sessionDurationMinutes,
        isActive: isPageActive,
        pagesVisited: stats.pagesVisited
      })
    }
  }, [currentPage, pageStartTime, isPageActive, enableDebugMode, getSessionStats])

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

// Hook para obtener estadísticas de tiempo en tiempo real
export const usePageTimeStats = () => {
  const { getSessionStats } = usePageTimeTracking()
  return getSessionStats()
}
