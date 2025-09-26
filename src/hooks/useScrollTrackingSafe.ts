import { useEffect, useRef, useState } from 'react'
import { useAnalytics } from '@/components/analytics/AnalyticsTracker'

export const useScrollTrackingSafe = () => {
  const { trackScrollDepth, trackTimeToInteraction } = useAnalytics()
  const [scrollDepth, setScrollDepth] = useState(0)
  const [hasInteracted, setHasInteracted] = useState(false)
  const [firstInteractionTime, setFirstInteractionTime] = useState<number | null>(null)
  const pageLoadTime = useRef<number>(Date.now())
  const currentPath = useRef<string>(window.location.pathname)

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
      
      trackTimeToInteraction(currentPath.current, timeToInteraction)
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
        trackScrollDepth(currentPath.current, currentDepth)
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
  }, [trackScrollDepth])

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
    currentPath.current = window.location.pathname

    return () => {
      interactionEvents.forEach(event => {
        document.removeEventListener(event, handleInteraction)
      })
    }
  }, [])

  // Efecto para detectar cambios de URL
  useEffect(() => {
    const handlePopState = () => {
      const newPath = window.location.pathname
      if (newPath !== currentPath.current) {
        // Reset para nueva página
        setHasInteracted(false)
        setFirstInteractionTime(null)
        setScrollDepth(0)
        pageLoadTime.current = Date.now()
        currentPath.current = newPath
      }
    }

    window.addEventListener('popstate', handlePopState)
    
    return () => {
      window.removeEventListener('popstate', handlePopState)
    }
  }, [])

  return {
    scrollDepth,
    hasInteracted,
    firstInteractionTime,
    timeOnPage: Date.now() - pageLoadTime.current
  }
}
