import { useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { ThemeProvider } from '@/theme/useTheme';
import { AnalyticsScripts } from '@/lib/analytics';
import { CookieConsentBanner } from '@/components/CookieConsentBanner';
import { releaseBootVeil } from '@/lib/boot';
import { SiteLayout } from '@/SiteLayout';
import { Landing } from '@/Landing';

/*
 * The whole app: one page, `/`, inside the site shell. Any other URL goes
 * back to it.
 */
export function App() {
  const [consentVersion, setConsentVersion] = useState(0);

  /*
   * Dissolve the boot veil index.html armed before the first paint. An effect
   * at the app root is the first moment React has actually committed, so the
   * veil never reveals an empty #root.
   */
  useEffect(() => {
    void releaseBootVeil();
  }, []);

  return (
    <ThemeProvider>
      <AnalyticsScripts consentVersion={consentVersion} />
      <CookieConsentBanner onDecision={() => setConsentVersion((v) => v + 1)} />
      <Routes>
        <Route element={<SiteLayout />}>
          <Route index element={<Landing />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ThemeProvider>
  );
}
