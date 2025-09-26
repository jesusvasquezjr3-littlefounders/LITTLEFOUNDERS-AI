import { useCallback } from 'react'
import { posthog } from '@/lib/posthog'

export const usePostHog = () => {
  const trackEvent = useCallback((eventName: string, properties?: Record<string, any>) => {
    if (posthog) {
      posthog.capture(eventName, properties)
    }
  }, [])

  const identifyUser = useCallback((userId: string, properties?: Record<string, any>) => {
    if (posthog) {
      posthog.identify(userId, properties)
    }
  }, [])

  const setUserProperties = useCallback((properties: Record<string, any>) => {
    if (posthog) {
      posthog.people.set(properties)
    }
  }, [])

  const resetUser = useCallback(() => {
    if (posthog) {
      posthog.reset()
    }
  }, [])

  const trackPageView = useCallback((pageName: string, properties?: Record<string, any>) => {
    if (posthog) {
      posthog.capture('$pageview', {
        page: pageName,
        ...properties
      })
    }
  }, [])

  const trackUserAction = useCallback((action: string, context?: Record<string, any>) => {
    if (posthog) {
      posthog.capture('user_action', {
        action,
        timestamp: new Date().toISOString(),
        ...context
      })
    }
  }, [])

  return {
    trackEvent,
    identifyUser,
    setUserProperties,
    resetUser,
    trackPageView,
    trackUserAction
  }
}
