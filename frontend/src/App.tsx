import { Route, Routes } from 'react-router-dom';
import { ThemeProvider } from '@/theme/useTheme';
import { AuthProvider } from '@/auth/AuthContext';
import { AnalyticsScripts } from '@/lib/analytics';
import { RequireAuth } from '@/auth/RequireAuth';
import { RequireOnboarded } from '@/auth/RequireOnboarded';
import { MarketingLayout } from '@/routes/marketing/MarketingLayout';
import { AuthLayout } from '@/routes/auth/AuthLayout';
import { AppLayout } from '@/routes/app/AppLayout';
import { useInsightsBeacon } from '@/lib/useInsightsBeacon';
import { useMarketingBeacon } from '@/lib/useMarketingBeacon';
import { CookieConsentBanner } from '@/components/CookieConsentBanner';
import { releaseBootVeil } from '@/lib/boot';
import { devRoutes, notFoundRoute, standaloneStateRoutes } from '@/app-routes/core';
import { siteAccountRoutes, siteAuthRoutes, sitePageRoutes, siteStandaloneRoutes } from '@/app-routes/site';
import { learnShellRoutes, learnStandaloneRoutes } from '@/app-routes/learn';
import { mentorStandaloneRoutes } from '@/app-routes/mentor';
import { familyShellRoutes } from '@/app-routes/family';
import { profileShellRoutes } from '@/app-routes/profile';
import { staffShellRoutes } from '@/app-routes/staff';

import { useEffect, useState } from 'react';

/*
 * The route table, composed. Each wave-2 lane owns one module under
 * src/app-routes/ (site, learn, mentor, family, profile, staff) that exports
 * its child routes with their guards; core.tsx (Lane 0) holds the dev
 * harnesses, the standalone states and the route of last resort. This file
 * (Lane 0) only decides which layout each group renders in.
 */

/*
 * First-party usage beacon (/INSIGHTS.md), mounted ONCE above BOTH route
 * groups — the lesson player lives OUTSIDE AppLayout, so a layout-level
 * beacon died on every lesson entry, silently discarding lesson events.
 * Renders nothing; transmits nothing without a session + analyticsEnabled.
 */
function InsightsBeacon({ consentVersion }: { consentVersion: number }) {
  useInsightsBeacon();
  // Acquisition funnel: anonymous, marketing-only, cookie-consent gated.
  // consentVersion is bumped by the banner so accepting starts tracking
  // IMMEDIATELY — the banner's own setState only re-renders the banner, so
  // without this the hook would not re-evaluate consent until the next
  // navigation and the landing visit that produced the accept would be lost.
  useMarketingBeacon(consentVersion);
  return null;
}

export function App() {
  const [consentVersion, setConsentVersion] = useState(0);

  /*
   * Dissolve the boot veil index.html armed before the first paint
   * (/DESIGN.md §Motion recipe 11). Here rather than in main.tsx because an
   * effect at the app root is the first moment React has actually COMMITTED —
   * calling it beside createRoot().render() would only mean "render was
   * requested", which under concurrent rendering can be several frames early,
   * and revealing an empty #root is the defect this replaces, not a fix for it.
   */
  useEffect(() => {
    void releaseBootVeil();
  }, []);

  return (
    <ThemeProvider>
      <AuthProvider>
        <AnalyticsScripts consentVersion={consentVersion} />
        <InsightsBeacon consentVersion={consentVersion} />
        <CookieConsentBanner onDecision={() => setConsentVersion((v) => v + 1)} />
        <Routes>
          {devRoutes}
          {/* Marketing (marketing chrome) */}
          <Route element={<MarketingLayout />}>
            {sitePageRoutes}
            {siteAccountRoutes}
          </Route>
          {/* Auth (login/signup) — bare trust surface, no marketing chrome. */}
          <Route element={<AuthLayout />}>{siteAuthRoutes}</Route>
          {siteStandaloneRoutes}
          {standaloneStateRoutes}
          {learnStandaloneRoutes}
          {mentorStandaloneRoutes}
          {/* App (dashboard chrome) */}
          <Route
            element={
              <RequireAuth>
                <RequireOnboarded>
                  <AppLayout />
                </RequireOnboarded>
              </RequireAuth>
            }
          >
            {learnShellRoutes}
            {familyShellRoutes}
            {profileShellRoutes}
            {staffShellRoutes}
          </Route>
          {/* Must be LAST. */}
          {notFoundRoute}
        </Routes>
      </AuthProvider>
    </ThemeProvider>
  );
}
