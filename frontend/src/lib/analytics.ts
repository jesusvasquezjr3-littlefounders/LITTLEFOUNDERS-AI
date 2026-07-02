type GtagEventParams = Record<string, string | number | boolean | string[] | number[] | null | undefined>;

declare global {
  interface Window {
    gtag?: (
      command: 'config' | 'event' | 'js' | 'set',
      targetIdOrEventName: string | Date,
      params?: Record<string, unknown>,
    ) => void;
  }
}

// Measure ONLY the canonical production host — never localhost, preview
// deploys (*.vercel.app), or the es./en. language subdomains — so the
// analytics stay scoped to littlefounders.ai and nothing else.
const CANONICAL_HOST = 'littlefounders.ai';

function isTrackingEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.location.hostname !== CANONICAL_HOST) return false;
  return typeof window.gtag === 'function';
}

export function trackEvent(eventName: string, params?: GtagEventParams): void {
  if (!isTrackingEnabled()) return;
  try {
    window.gtag!('event', eventName, params ?? {});
  } catch {
    // never let analytics break the app
  }
}
