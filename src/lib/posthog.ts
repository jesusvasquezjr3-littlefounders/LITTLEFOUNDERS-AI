import posthog from 'posthog-js'

export const initPostHog = () => {
  // Initialize PostHog with your project key
  // Replace 'YOUR_PROJECT_KEY' with your actual PostHog project key
  posthog.init(import.meta.env.VITE_POSTHOG_KEY || 'YOUR_PROJECT_KEY', {
    api_host: import.meta.env.VITE_POSTHOG_HOST || 'https://app.posthog.com',
    // Enable debug mode in development
    debug: import.meta.env.DEV,
    // Automatically capture page views
    capture_pageview: true,
    // Automatically capture page leaves
    capture_pageleave: true,
    // Enable session recording (optional)
    session_recording: {
      enabled: true,
      // Record only in production or when explicitly enabled
      recordCrossOriginIframes: false,
    },
    // Privacy settings
    respect_dnt: true,
    // Disable in development if needed
    loaded: (posthog) => {
      if (import.meta.env.DEV) {
        console.log('PostHog loaded in development mode')
      }
    }
  })

  return posthog
}

export { posthog }
