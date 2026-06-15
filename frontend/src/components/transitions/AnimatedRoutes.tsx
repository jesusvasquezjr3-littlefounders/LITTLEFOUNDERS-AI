import React, { useState, useLayoutEffect } from "react";
import { useLocation, Routes } from "react-router-dom";
import { flushSync } from "react-dom";

interface AnimatedRoutesProps {
  children: React.ReactNode;
}

export const AnimatedRoutes: React.FC<AnimatedRoutesProps> = ({ children }) => {
  const location = useLocation();
  const [displayLocation, setDisplayLocation] = useState(location);

  useLayoutEffect(() => {
    // If the path hasn't changed, we don't need a view transition
    if (location.pathname === displayLocation.pathname && location.search === displayLocation.search) {
      return;
    }

    // Skip the snapshot-based view transition when navigating WITHIN the app
    // shell (dashboard/admin). The sidebar + top bar are mounted once by the
    // shared layout route and persist across navigation, so a full-page snapshot
    // overlay only causes artifacts: the chrome appears to "jump", and the new
    // page is captured mid-`animate-in` (opacity 0) producing a whole-screen
    // flash before it fades in. Inside the shell we swap instantly and let each
    // page's own `animate-in` entrance play. Marketing / public pages (no shell)
    // keep the organic view transition.
    const inAppShell = !!document.querySelector('.view-transition-sidebar');

    // Check if the browser supports View Transitions API
    if (!document.startViewTransition || inAppShell) {
      setDisplayLocation(location);
      return;
    }

    // Start the native browser view transition
    document.startViewTransition(() => {
      flushSync(() => {
        setDisplayLocation(location);
      });
    });
  }, [location, displayLocation.pathname, displayLocation.search]);

  // We explicitly pass the cached location to the Routes component
  // so it renders the old page while the transition starts, and then
  // renders the new page inside the flushSync callback.
  return (
    <Routes location={displayLocation}>
      {children}
    </Routes>
  );
};
