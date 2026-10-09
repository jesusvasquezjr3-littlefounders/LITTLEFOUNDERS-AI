import { lazy, Suspense, useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { MotionConfig } from 'motion/react';
import { Toaster } from 'sileo';
import { ThinkingOrb } from 'thinking-orbs';
import { ThemeProvider, useTheme } from '@/theme/useTheme';
import { AnalyticsScripts } from '@/lib/analytics';
import { CookieConsentBanner } from '@/components/CookieConsentBanner';
import { AppShell } from '@/components/AppShell';
import { useCoreCopy } from '@/i18n/useCopy';
import { releaseBootVeil } from '@/lib/boot';

const Landing = lazy(() => import('@/features/landing/Landing').then((module) => ({ default: module.Landing })));

/** Shown while a page's code loads: a thinking orb, announced as "Loading". */
function PageLoading() {
  const label = useCoreCopy().appShell.loading;

  return <div role="status" className="grid min-h-[60dvh] place-items-center">
    <ThinkingOrb state="working" size={64} />
    <span className="sr-only">{label}</span>
  </div>;
}

/** Toasts follow the visitor's theme (not the operating system's), drawn as the opposite surface so they stand off the page. */
function ThemedToaster() {
  const { isDark } = useTheme();

  return <Toaster position="top-center" theme={isDark ? 'dark' : 'light'} />;
}

/*
 * The whole app: one page, `/`, inside the site shell. Any other URL goes
 * back to it. Reduced motion is honored once, here, for every Motion
 * component below.
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
    <MotionConfig reducedMotion="user">
      <ThemeProvider>
        <AnalyticsScripts consentVersion={consentVersion} />
        <CookieConsentBanner onDecision={() => setConsentVersion((v) => v + 1)} />
        <ThemedToaster />
        <Suspense fallback={<PageLoading />}>
          <Routes>
            <Route element={<AppShell />}>
              <Route index element={<Landing />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </ThemeProvider>
    </MotionConfig>
  );
}
