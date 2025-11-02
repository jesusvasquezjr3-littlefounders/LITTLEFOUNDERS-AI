import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { initPostHog, posthog } from '@/lib/posthog'
import { PageTimeTracker } from '@/components/analytics/PageTimeTracker'
import { EngagementTracker } from '@/components/analytics/EngagementTracker'
import { PageAnalyticsTracker } from '@/components/analytics/PageAnalyticsTracker'
import { TimeAnalyticsTracker } from '@/components/analytics/TimeAnalyticsTracker'
import { UserPageTimeTrackerComponent } from '@/components/analytics/UserPageTimeTrackerComponent'
import { PostHogUserAnalytics } from '@/components/analytics/PostHogUserAnalytics'

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
    // Track page views on route changes
    if (posthog) {
      posthog.capture('$pageview', {
        $current_url: window.location.href,
        path: location.pathname,
        search: location.search,
        hash: location.hash,
        timestamp: new Date().toISOString(),
        referrer: document.referrer,
        user_agent: navigator.userAgent,
        screen_resolution: `${screen.width}x${screen.height}`,
        viewport_size: `${window.innerWidth}x${window.innerHeight}`
      })
    }
  }, [location])

  return (
    <PageTimeTracker enableDebugMode={import.meta.env.DEV}>
      <EngagementTracker>
        <PageAnalyticsTracker>
          <TimeAnalyticsTracker>
            <UserPageTimeTrackerComponent enableDebugMode={import.meta.env.DEV}>
              <PostHogUserAnalytics>
                {children}
              </PostHogUserAnalytics>
            </UserPageTimeTrackerComponent>
          </TimeAnalyticsTracker>
        </PageAnalyticsTracker>
      </EngagementTracker>
    </PageTimeTracker>
  )
}
