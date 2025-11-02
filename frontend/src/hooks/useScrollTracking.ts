import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useAnalytics } from '@/components/analytics/AnalyticsTracker'

export const useScrollTracking = () => {
  const location = useLocation()
  const { trackScrollDepth, trackTimeToInteraction } = useAnalytics()
  const [scrollDepth, setScrollDepth] = useState(0)
  const [hasInteracted, setHasInteracted] = useState(false)
  const [firstInteractionTime, setFirstInteractionTime] = useState<number | null>(null)
  const pageLoadTime = useRef<number>(Date.now())

  // Función para calcular el porcentaje de scroll
  const calculateScrollDepth = () => {
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop
    const documentHeight = document.documentElement.scrollHeight - window.innerHeight
    const scrollPercent = Math.round((scrollTop / documentHeight) * 100)
    
    return Math.min(scrollPercent, 100) // Máximo 100%
  }

  // Función para trackear interacciones
  const handleInteraction = () => {
    if (!hasInteracted) {
      const timeToInteraction = Date.now() - pageLoadTime.current
      setFirstInteractionTime(timeToInteraction)
      setHasInteracted(true)
      
      trackTimeToInteraction(location.pathname, timeToInteraction)
    }
  }

  // Efecto para tracking de scroll
  useEffect(() => {
    let lastTrackedDepth = 0
    
    const handleScroll = () => {
      const currentDepth = calculateScrollDepth()
      setScrollDepth(currentDepth)
      
      // Trackear cada 25% de scroll
      const depthThresholds = [25, 50, 75, 100]
      const shouldTrack = depthThresholds.some(threshold => 
        currentDepth >= threshold && lastTrackedDepth < threshold
      )
      
      if (shouldTrack) {
        trackScrollDepth(location.pathname, currentDepth)
        lastTrackedDepth = currentDepth
      }
    }

    // Throttle scroll events
    let scrollTimeout: NodeJS.Timeout
    const throttledScroll = () => {
      if (scrollTimeout) return
      
      scrollTimeout = setTimeout(() => {
        handleScroll()
        scrollTimeout = null as any
      }, 100)
    }

    window.addEventListener('scroll', throttledScroll, { passive: true })
    
    return () => {
      window.removeEventListener('scroll', throttledScroll)
      if (scrollTimeout) {
        clearTimeout(scrollTimeout)
      }
    }
  }, [location.pathname, trackScrollDepth])

  // Efecto para tracking de interacciones
  useEffect(() => {
    const interactionEvents = ['click', 'keydown', 'touchstart']
    
    interactionEvents.forEach(event => {
      document.addEventListener(event, handleInteraction, { passive: true })
    })

    // Reset para nueva página
    setHasInteracted(false)
    setFirstInteractionTime(null)
    setScrollDepth(0)
    pageLoadTime.current = Date.now()

    return () => {
      interactionEvents.forEach(event => {
        document.removeEventListener(event, handleInteraction)
      })
    }
  }, [location.pathname])

  return {
    scrollDepth,
    hasInteracted,
    firstInteractionTime,
    timeOnPage: Date.now() - pageLoadTime.current
  }
}
