import posthog from 'posthog-js'

export const initPostHog = () => {
  // Initialize PostHog with your project key
  posthog.init(import.meta.env.VITE_POSTHOG_KEY || 'YOUR_PROJECT_KEY', {
    api_host: import.meta.env.VITE_POSTHOG_HOST || 'https://app.posthog.com',
    // Disable debug mode to prevent console spam
    debug: false,
    // Disable auto page view capture (we handle it manually)
    capture_pageview: false,
    capture_pageleave: false,
    // Disable session recording to prevent $snapshot spam
    disable_session_recording: true,
    // Disable heatmaps to prevent $$heatmap spam
    enable_heatmaps: false,
    // Privacy settings
    respect_dnt: true,
    // Disable persistence in development
    persistence: 'localStorage',
    // Opt out of autocapture to reduce noise
    autocapture: false
  })

  return posthog
}

export { posthog }
