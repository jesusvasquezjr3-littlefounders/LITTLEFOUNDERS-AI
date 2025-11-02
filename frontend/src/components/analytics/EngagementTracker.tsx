import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useAnalytics } from '@/components/analytics/AnalyticsTracker'
import { useScrollTracking } from '@/hooks/useScrollTracking'
import { usePageTimeStats } from '@/components/analytics/PageTimeTracker'

interface EngagementTrackerProps {
  children: React.ReactNode
}

export const EngagementTracker = ({ children }: EngagementTrackerProps) => {
  const location = useLocation()
  const { trackPageEngagement, trackBounceRate } = useAnalytics()
  const { scrollDepth, hasInteracted, firstInteractionTime } = useScrollTracking()
  const pageTimeStats = usePageTimeStats()
  
  const [engagementLevel, setEngagementLevel] = useState<'low' | 'medium' | 'high'>('low')
  const [hasTrackedEngagement, setHasTrackedEngagement] = useState(false)

  // Calcular nivel de engagement basado en múltiples factores
  useEffect(() => {
    const calculateEngagementLevel = (): 'low' | 'medium' | 'high' => {
      let score = 0
      
      // Factor tiempo en página
      const timeScore = Math.min(pageTimeStats.currentPageDuration / 60000, 5) // Máximo 5 puntos por 5+ minutos
      score += timeScore
      
      // Factor scroll depth
      const scrollScore = scrollDepth / 20 // Máximo 5 puntos por 100% scroll
      score += scrollScore
      
      // Factor interacción
      if (hasInteracted) {
        score += 2
        // Bonus por interacción temprana
        if (firstInteractionTime && firstInteractionTime < 10000) {
          score += 1
        }
      }
      
      // Determinar nivel
      if (score >= 8) return 'high'
      if (score >= 4) return 'medium'
      return 'low'
    }

    const newEngagementLevel = calculateEngagementLevel()
    setEngagementLevel(newEngagementLevel)

    // Trackear engagement cuando cambie significativamente
    if (!hasTrackedEngagement && newEngagementLevel !== 'low') {
      trackPageEngagement(
        location.pathname,
        newEngagementLevel,
        Math.round(pageTimeStats.currentPageDuration / 1000)
      )
      setHasTrackedEngagement(true)
    }
  }, [scrollDepth, hasInteracted, pageTimeStats.currentPageDuration, location.pathname, trackPageEngagement, hasTrackedEngagement, firstInteractionTime])

  // Trackear bounce rate cuando el usuario salga de la página
  useEffect(() => {
    const handleBeforeUnload = () => {
      const durationSeconds = Math.round(pageTimeStats.currentPageDuration / 1000)
      const isBounce = durationSeconds < 30 && scrollDepth < 25 && !hasInteracted
      
      trackBounceRate(location.pathname, durationSeconds, isBounce)
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [location.pathname, pageTimeStats.currentPageDuration, scrollDepth, hasInteracted, trackBounceRate])

  return <>{children}</>
}
