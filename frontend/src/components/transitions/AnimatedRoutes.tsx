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

    // Check if the browser supports View Transitions API
    if (!document.startViewTransition) {
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
