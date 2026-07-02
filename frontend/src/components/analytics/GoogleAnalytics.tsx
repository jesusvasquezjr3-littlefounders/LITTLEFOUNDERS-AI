import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const GA_TRACKING_ID = 'G-0XH7S80QG2';

export function GoogleAnalytics() {
  const location = useLocation();

  useEffect(() => {
    // Measure ONLY the canonical production host — never localhost, preview
    // deploys, or the es./en. language subdomains.
    if (window.location.hostname !== 'littlefounders.ai') {
      return;
    }

    // Send page view event
    if (typeof window.gtag === 'function') {
      window.gtag('config', GA_TRACKING_ID, {
        page_path: location.pathname + location.search,
        page_title: document.title,
      });
    }
  }, [location]);

  return null;
}
