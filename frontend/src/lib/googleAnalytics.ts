import ReactGA from "react-ga4";

// Google Analytics Measurement ID from environment variable
const GA_MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID;

/**
 * Initialize Google Analytics
 * Call this once when the app starts
 */
export const initGA = () => {
  if (GA_MEASUREMENT_ID) {
    ReactGA.initialize(GA_MEASUREMENT_ID, {
      gaOptions: {
        anonymizeIp: true, // Anonymize IP for privacy
      },
      gtagOptions: {
        send_page_view: false, // We'll handle page views manually
      },
    });
    console.log("Google Analytics initialized with ID:", GA_MEASUREMENT_ID);
  } else {
    console.warn("Google Analytics Measurement ID not found in environment variables");
  }
};

/**
 * Track a page view
 * @param path - The page path to track
 */
export const trackPageView = (path: string) => {
  if (GA_MEASUREMENT_ID) {
    ReactGA.send({ hitType: "pageview", page: path });
  }
};

/**
 * Track a custom event
 * @param category - Event category
 * @param action - Event action
 * @param label - Optional event label
 * @param value - Optional event value
 */
export const trackEvent = (
  category: string,
  action: string,
  label?: string,
  value?: number
) => {
  if (GA_MEASUREMENT_ID) {
    ReactGA.event({
      category,
      action,
      label,
      value,
    });
  }
};

/**
 * Track a custom event with custom parameters
 * @param eventName - Name of the event
 * @param params - Custom parameters object
 */
export const trackCustomEvent = (eventName: string, params?: Record<string, any>) => {
  if (GA_MEASUREMENT_ID) {
    ReactGA.event(eventName, params);
  }
};

/**
 * Set user properties for analytics
 * @param userId - User ID to track
 */
export const setUserId = (userId: string | null) => {
  if (GA_MEASUREMENT_ID && userId) {
    ReactGA.set({ userId });
  }
};

/**
 * Set custom user properties
 * @param properties - Object with custom properties
 */
export const setUserProperties = (properties: Record<string, any>) => {
  if (GA_MEASUREMENT_ID) {
    ReactGA.set(properties);
  }
};

/**
 * Track timing metrics
 * @param category - Timing category
 * @param variable - Timing variable name
 * @param value - Time value in milliseconds
 * @param label - Optional label
 */
export const trackTiming = (
  category: string,
  variable: string,
  value: number,
  label?: string
) => {
  if (GA_MEASUREMENT_ID) {
    ReactGA.event({
      category: "timing",
      action: category,
      label: label || variable,
      value,
    });
  }
};

export default {
  initGA,
  trackPageView,
  trackEvent,
  trackCustomEvent,
  setUserId,
  setUserProperties,
  trackTiming,
};

