import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { usePostHog } from '@/hooks/usePostHog'

interface AnalyticsTrackerProps {
  children: React.ReactNode
}

export const AnalyticsTracker = ({ children }: AnalyticsTrackerProps) => {
  const location = useLocation()
  const { trackEvent } = usePostHog()

  useEffect(() => {
    // Track page views with additional context
    trackEvent('page_view', {
      path: location.pathname,
      search: location.search,
      hash: location.hash,
      timestamp: new Date().toISOString(),
      referrer: document.referrer,
      user_agent: navigator.userAgent,
      screen_resolution: `${screen.width}x${screen.height}`,
      viewport_size: `${window.innerWidth}x${window.innerHeight}`
    })
  }, [location, trackEvent])

  return <>{children}</>
}

// Hook for tracking user interactions
export const useAnalytics = () => {
  const { trackEvent, identifyUser, setUserProperties } = usePostHog()

  const trackUserAction = (action: string, properties?: Record<string, any>) => {
    trackEvent('user_action', {
      action,
      timestamp: new Date().toISOString(),
      ...properties
    })
  }

  const trackFeatureUsage = (feature: string, properties?: Record<string, any>) => {
    trackEvent('feature_used', {
      feature,
      timestamp: new Date().toISOString(),
      ...properties
    })
  }

  const trackGameEvent = (game: string, event: string, properties?: Record<string, any>) => {
    trackEvent('game_event', {
      game,
      event,
      timestamp: new Date().toISOString(),
      ...properties
    })
  }

  const trackLessonProgress = (lesson: string, progress: number, properties?: Record<string, any>) => {
    trackEvent('lesson_progress', {
      lesson,
      progress,
      timestamp: new Date().toISOString(),
      ...properties
    })
  }

  const trackFinancialAction = (action: string, amount?: number, properties?: Record<string, any>) => {
    trackEvent('financial_action', {
      action,
      amount,
      timestamp: new Date().toISOString(),
      ...properties
    })
  }

  const trackTaskCompletion = (task: string, properties?: Record<string, any>) => {
    trackEvent('task_completed', {
      task,
      timestamp: new Date().toISOString(),
      ...properties
    })
  }

  const trackError = (error: string, context?: Record<string, any>) => {
    trackEvent('error_occurred', {
      error,
      context,
      timestamp: new Date().toISOString()
    })
  }

  const trackPageEngagement = (page: string, engagement: 'high' | 'medium' | 'low', duration: number) => {
    trackEvent('page_engagement', {
      page,
      engagement_level: engagement,
      duration_seconds: duration,
      timestamp: new Date().toISOString()
    })
  }

  const trackBounceRate = (page: string, duration: number, isBounce: boolean) => {
    trackEvent('page_bounce', {
      page,
      duration_seconds: duration,
      is_bounce: isBounce,
      bounce_threshold: 30, // 30 segundos
      timestamp: new Date().toISOString()
    })
  }

  const trackScrollDepth = (page: string, depth: number) => {
    trackEvent('scroll_depth', {
      page,
      scroll_depth_percentage: depth,
      timestamp: new Date().toISOString()
    })
  }

  const trackTimeToInteraction = (page: string, timeToFirstClick: number) => {
    trackEvent('time_to_interaction', {
      page,
      time_to_first_click_ms: timeToFirstClick,
      time_to_first_click_seconds: Math.round(timeToFirstClick / 1000),
      timestamp: new Date().toISOString()
    })
  }

  return {
    trackUserAction,
    trackFeatureUsage,
    trackGameEvent,
    trackLessonProgress,
    trackFinancialAction,
    trackTaskCompletion,
    trackError,
    trackPageEngagement,
    trackBounceRate,
    trackScrollDepth,
    trackTimeToInteraction,
    identifyUser,
    setUserProperties
  }
}
