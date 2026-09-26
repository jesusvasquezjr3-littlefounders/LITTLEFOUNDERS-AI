import { Route, Routes } from 'react-router-dom';
import { ThemeProvider } from '@/theme/useTheme';
import { AuthProvider } from '@/auth/AuthContext';
import { AnalyticsScripts } from '@/lib/analytics';
import { RequireAuth } from '@/auth/RequireAuth';
import { RequireOnboarded } from '@/auth/RequireOnboarded';
import { useInsightsBeacon } from '@/lib/useInsightsBeacon';
import { useMarketingBeacon } from '@/lib/useMarketingBeacon';
import { CookieConsentBanner } from '@/components/CookieConsentBanner';
import { releaseBootVeil } from '@/lib/boot';
import { AppShellLayout, StaffShellLayout } from '@/app-shell/AppLayouts';
import { AuthLayout, SiteLayout } from '@/app-shell/PublicLayouts';
import { devRoutes, notFoundRoute, standaloneStateRoutes } from '@/app-routes/core';
import { siteAccountRoutes, siteAuthRoutes, sitePageRoutes, siteStandaloneRoutes } from '@/app-routes/site';
import { learnShellRoutes, learnStandaloneRoutes } from '@/app-routes/learn';
import { mentorStandaloneRoutes } from '@/app-routes/mentor';
import { familyShellRoutes } from '@/app-routes/family';
import { profileShellRoutes } from '@/app-routes/profile';
import { staffShellRoutes } from '@/app-routes/staff';

import { useEffect, useState } from 'react';

/*
 * The route table, composed (W2 Lane 0). Each wave-2 lane owns one module
 * under src/app-routes/ (site, learn, mentor, family, profile, staff) that
 * exports its child routes with their guards; core.tsx (Lane 0) holds the dev
 * harnesses, the standalone states and the route of last resort. This file
 * only decides which rebuilt shell (src/app-shell/) each group renders in:
 *
 *   SiteShell         the public pages
 *   AuthShell         sign-in, sign-up, recovery, verification, OAuth landing
 *   LearnerShell /    every signed-in page but the console: the learner app, or
 *   TutorShell        the Tutor console for a verified parent (OD-6)
 *   StaffShell        /admin, items filtered by the staff grants
 *   single-state      not found, a suspended account, account deletion
 *   (none)            the full-screen layers: onboarding, account upgrade,
 *                     placement, the lesson player, the Mentor stage and the
 *                     public badge page
 */

/*
 * First-party usage beacon (/INSIGHTS.md), mounted ONCE above every route
 * group — the lesson player lives OUTSIDE the app shell, so a layout-level
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
          <Route element={<SiteLayout />}>{sitePageRoutes}</Route>
          <Route element={<AuthLayout />}>
            {siteAuthRoutes}
            {siteAccountRoutes}
          </Route>
          {siteStandaloneRoutes}
          {standaloneStateRoutes}
          {learnStandaloneRoutes}
          {mentorStandaloneRoutes}
          <Route
            element={
              <RequireAuth>
                <RequireOnboarded>
                  <AppShellLayout />
                </RequireOnboarded>
              </RequireAuth>
            }
          >
            {learnShellRoutes}
            {familyShellRoutes}
            {profileShellRoutes}
          </Route>
          <Route
            element={
              <RequireAuth>
                <RequireOnboarded>
                  <StaffShellLayout />
                </RequireOnboarded>
              </RequireAuth>
            }
          >
            {staffShellRoutes}
          </Route>
          {/* The route of last resort: must stay LAST. */}
          {notFoundRoute}
        </Routes>
      </AuthProvider>
    </ThemeProvider>
  );
}
