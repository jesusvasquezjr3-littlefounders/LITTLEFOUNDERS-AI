import { useEffect } from 'react'
import { usePostHog } from '@/hooks/usePostHog'
import { useUserAnalytics } from '@/hooks/useUserAnalytics'

interface PostHogUserAnalyticsProps {
  children: React.ReactNode
}

export const PostHogUserAnalytics = ({ children }: PostHogUserAnalyticsProps) => {
  const { trackEvent } = usePostHog()
  const { getSessionSummary } = useUserAnalytics()

  useEffect(() => {
    const summary = getSessionSummary()
    
    // Trackear información del usuario al cargar
    trackEvent('user_analytics_loaded', {
      user_type: summary.user.type,
      user_id: summary.user.id,
      current_page: summary.currentPage.path,
      current_page_name: summary.currentPage.name,
      session_duration: summary.session.duration,
      pages_visited: summary.session.pagesVisited,
      is_active: summary.session.isActive,
      timestamp: new Date().toISOString()
    })

    // Trackear engagement por tipo de usuario
    trackEvent('user_engagement_by_type', {
      user_type: summary.user.type,
      user_type_label: summary.user.typeInfo.label,
      current_page: summary.currentPage.path,
      page_category: summary.currentPage.info.category,
      engagement_level: summary.currentPage.engagement.level,
      engagement_score: summary.currentPage.engagement.color,
      time_spent: summary.currentPage.duration,
      time_spent_minutes: Math.round(summary.currentPage.duration / 60000 * 100) / 100,
      timestamp: new Date().toISOString()
    })

    // Trackear analytics por página del sidebar
    if (summary.currentPage.path !== '/') {
      trackEvent('sidebar_page_analytics', {
        page_path: summary.currentPage.path,
        page_name: summary.currentPage.name,
        page_category: summary.currentPage.info.category,
        user_type: summary.user.type,
        user_type_label: summary.user.typeInfo.label,
        time_spent: summary.currentPage.duration,
        time_spent_seconds: Math.round(summary.currentPage.duration / 1000),
        time_spent_minutes: Math.round(summary.currentPage.duration / 60000 * 100) / 100,
        engagement_level: summary.currentPage.engagement.level,
        session_duration: summary.session.duration,
        session_pages_visited: summary.session.pagesVisited,
        timestamp: new Date().toISOString()
      })
    }

    // Trackear métricas de sesión por tipo de usuario
    trackEvent('user_session_metrics', {
      user_type: summary.user.type,
      user_type_label: summary.user.typeInfo.label,
      session_duration: summary.session.duration,
      session_duration_minutes: Math.round(summary.session.duration / 60000 * 100) / 100,
      pages_visited: summary.session.pagesVisited,
      average_page_time: summary.session.averagePageTime,
      average_page_time_minutes: Math.round(summary.session.averagePageTime / 60000 * 100) / 100,
      current_page: summary.currentPage.path,
      current_page_name: summary.currentPage.name,
      is_active: summary.session.isActive,
      timestamp: new Date().toISOString()
    })

  }, [trackEvent, getSessionSummary])

  return <>{children}</>
}

// Hook para trackear eventos específicos de analytics
export const usePostHogUserTracking = () => {
  const { trackEvent } = usePostHog()
  const { getSessionSummary } = useUserAnalytics()

  const trackPageView = (page: string, pageName: string) => {
    const summary = getSessionSummary()
    
    trackEvent('user_page_view', {
      page: page,
      page_name: pageName,
      user_type: summary.user.type,
      user_id: summary.user.id,
      session_duration: summary.session.duration,
      pages_visited: summary.session.pagesVisited,
      timestamp: new Date().toISOString()
    })
  }

  const trackUserAction = (action: string, details?: Record<string, any>) => {
    const summary = getSessionSummary()
    
    trackEvent('user_action', {
      action: action,
      user_type: summary.user.type,
      user_id: summary.user.id,
      current_page: summary.currentPage.path,
      current_page_name: summary.currentPage.name,
      session_duration: summary.session.duration,
      ...details,
      timestamp: new Date().toISOString()
    })
  }

  const trackEngagement = (engagementType: string, value: number) => {
    const summary = getSessionSummary()
    
    trackEvent('user_engagement', {
      engagement_type: engagementType,
      engagement_value: value,
      user_type: summary.user.type,
      user_id: summary.user.id,
      current_page: summary.currentPage.path,
      current_page_name: summary.currentPage.name,
      time_spent: summary.currentPage.duration,
      engagement_level: summary.currentPage.engagement.level,
      timestamp: new Date().toISOString()
    })
  }

  return {
    trackPageView,
    trackUserAction,
    trackEngagement
  }
}
