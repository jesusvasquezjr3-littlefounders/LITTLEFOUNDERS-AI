// Google Analytics 4 Configuration and Utilities

// Declare gtag for TypeScript
declare global {
  interface Window {
    dataLayer: unknown[];
    gtag: (...args: unknown[]) => void;
  }
}

// GA4 Measurement ID from environment variable
const GA_MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID || 'G-XXXXXXXXXX';

let isInitialized = false;

/**
 * Load the Google Analytics script dynamically
 */
const loadGAScript = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src*="googletagmanager.com/gtag/js"]`)) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google Analytics script'));
    document.head.appendChild(script);
  });
};

/**
 * Initialize Google Analytics 4
 */
export const initGoogleAnalytics = async () => {
  if (typeof window === 'undefined' || isInitialized) return;

  // Don't initialize if no measurement ID is configured
  if (GA_MEASUREMENT_ID === 'G-XXXXXXXXXX') {
    if (import.meta.env.DEV) {
      console.warn('Google Analytics: No measurement ID configured. Set VITE_GA_MEASUREMENT_ID in your .env file.');
    }
    return;
  }

  try {
    // Load the GA script dynamically
    await loadGAScript();

    // Configure GA4 with the measurement ID
    window.gtag('config', GA_MEASUREMENT_ID, {
      // Disable automatic page view tracking (we'll handle it manually for SPA)
      send_page_view: false,
      // Enable debug mode in development
      debug_mode: import.meta.env.DEV,
    });

    isInitialized = true;

    if (import.meta.env.DEV) {
      console.log('Google Analytics initialized with ID:', GA_MEASUREMENT_ID);
    }
  } catch (error) {
    console.error('Failed to initialize Google Analytics:', error);
  }
};

/**
 * Track a page view
 */
export const trackPageView = (path: string, title?: string) => {
  if (typeof window === 'undefined' || !window.gtag) return;

  window.gtag('event', 'page_view', {
    page_path: path,
    page_title: title || document.title,
    page_location: window.location.href,
  });

  if (import.meta.env.DEV) {
    console.log('GA4 Page View:', path);
  }
};

/**
 * Track a custom event
 */
export const trackEvent = (
  eventName: string,
  params?: Record<string, unknown>
) => {
  if (typeof window === 'undefined' || !window.gtag) return;

  window.gtag('event', eventName, params);

  if (import.meta.env.DEV) {
    console.log('GA4 Event:', eventName, params);
  }
};

/**
 * Track user login
 */
export const trackLogin = (method: string) => {
  trackEvent('login', { method });
};

/**
 * Track user sign up
 */
export const trackSignUp = (method: string) => {
  trackEvent('sign_up', { method });
};

/**
 * Track lesson started
 */
export const trackLessonStarted = (lessonId: string, lessonName: string) => {
  trackEvent('lesson_started', {
    lesson_id: lessonId,
    lesson_name: lessonName,
  });
};

/**
 * Track lesson completed
 */
export const trackLessonCompleted = (
  lessonId: string,
  lessonName: string,
  score?: number
) => {
  trackEvent('lesson_completed', {
    lesson_id: lessonId,
    lesson_name: lessonName,
    score,
  });
};

/**
 * Track game started
 */
export const trackGameStarted = (gameId: string, gameName: string) => {
  trackEvent('game_started', {
    game_id: gameId,
    game_name: gameName,
  });
};

/**
 * Track game completed
 */
export const trackGameCompleted = (
  gameId: string,
  gameName: string,
  score?: number,
  level?: number
) => {
  trackEvent('game_completed', {
    game_id: gameId,
    game_name: gameName,
    score,
    level,
  });
};

/**
 * Track savings goal created
 */
export const trackSavingsGoalCreated = (goalName: string, targetAmount: number) => {
  trackEvent('savings_goal_created', {
    goal_name: goalName,
    target_amount: targetAmount,
  });
};

/**
 * Track deposit made
 */
export const trackDepositMade = (amount: number, goalName?: string) => {
  trackEvent('deposit_made', {
    amount,
    goal_name: goalName,
  });
};

/**
 * Track purchase in store
 */
export const trackPurchase = (itemName: string, price: number) => {
  trackEvent('purchase', {
    item_name: itemName,
    value: price,
    currency: 'MXN',
  });
};

/**
 * Track task completed
 */
export const trackTaskCompleted = (taskName: string, reward: number) => {
  trackEvent('task_completed', {
    task_name: taskName,
    reward,
  });
};

/**
 * Set user ID for cross-device tracking
 */
export const setUserId = (userId: string) => {
  if (typeof window === 'undefined' || !window.gtag) return;

  window.gtag('config', GA_MEASUREMENT_ID, {
    user_id: userId,
  });

  if (import.meta.env.DEV) {
    console.log('GA4 User ID set:', userId);
  }
};

/**
 * Set user properties
 */
export const setUserProperties = (properties: Record<string, unknown>) => {
  if (typeof window === 'undefined' || !window.gtag) return;

  window.gtag('set', 'user_properties', properties);

  if (import.meta.env.DEV) {
    console.log('GA4 User Properties:', properties);
  }
};

export { GA_MEASUREMENT_ID };
