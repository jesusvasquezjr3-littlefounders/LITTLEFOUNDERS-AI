import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { initPostHog, posthog } from '@/lib/posthog'

interface PostHogProviderProps {
  children: React.ReactNode
}

export const PostHogProvider = ({ children }: PostHogProviderProps) => {
  const location = useLocation()

  useEffect(() => {
    // Initialize PostHog
    initPostHog()
  }, [])

  useEffect(() => {
    // Track page views on route changes (simple, no spam)
    if (posthog) {
      posthog.capture('$pageview', {
        $current_url: window.location.href,
        path: location.pathname
      })
    }
  }, [location.pathname])

  return <>{children}</>
}
