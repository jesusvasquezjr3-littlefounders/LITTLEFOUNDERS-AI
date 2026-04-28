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

function isTrackingEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  if (host === 'localhost' || host === '127.0.0.1') return false;
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
