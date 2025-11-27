import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { initGA, trackPageView } from "@/lib/googleAnalytics";

interface GoogleAnalyticsProviderProps {
  children: React.ReactNode;
}

/**
 * GoogleAnalyticsProvider component
 * Initializes Google Analytics and tracks page views automatically
 */
export const GoogleAnalyticsProvider = ({ children }: GoogleAnalyticsProviderProps) => {
  const location = useLocation();

  // Initialize GA on mount
  useEffect(() => {
    initGA();
  }, []);

  // Track page views on route change
  useEffect(() => {
    const path = location.pathname + location.search;
    trackPageView(path);
  }, [location]);

  return <>{children}</>;
};

export default GoogleAnalyticsProvider;

