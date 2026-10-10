import { lazy, useEffect, useState } from 'react';
import { Route, Routes } from 'react-router-dom';
import { MotionConfig } from 'motion/react';
import { Toaster } from 'sileo';
import { ThemeProvider, useTheme } from '@/theme/useTheme';
import { AnalyticsScripts } from '@/lib/analytics';
import { CookieConsentBanner } from '@/components/CookieConsentBanner';
import { AppShell } from '@/components/AppShell';
import { releaseBootVeil } from '@/lib/boot';

// Development only: the avatars alive. `import.meta.env.DEV` is false in a production build, so this chunk is not shipped.
const DevAvatars = import.meta.env.DEV ? lazy(() => import('@/features/avatars/DevAvatars')) : null;

// Development only: the loading window open. Not shipped, like the avatars page.
const DevLoading = import.meta.env.DEV ? lazy(() => import('@/features/loading/DevLoading')) : null;

const Landing = lazy(() => import('@/features/landing/Landing').then((module) => ({ default: module.Landing })));
const NotFound = lazy(() => import('@/features/notFound/NotFound').then((module) => ({ default: module.NotFound })));

/** Toasts follow the visitor's theme (not the operating system's), drawn as the opposite surface so they stand off the page. */
function ThemedToaster() {
  const { isDark } = useTheme();

  return <Toaster position="top-center" theme={isDark ? 'dark' : 'light'} />;
}

/*
 * The whole app: the landing at `/` inside the site shell, and the not-found page for every other
 * URL (the shell shows a skeleton while a page's code loads). Reduced motion is honored once, here,
 * for every Motion component below.
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
        <ThemedToaster />
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<Landing />} />
            {DevAvatars ? <Route path="dev/avatars" element={<DevAvatars />} /> : null}
            {DevLoading ? <Route path="dev/loading" element={<DevLoading />} /> : null}
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
        {/* After the page in the DOM so the skip link stays the first stop; it is fixed to the bottom either way. */}
        <CookieConsentBanner onDecision={() => setConsentVersion((v) => v + 1)} />
      </ThemeProvider>
    </MotionConfig>
  );
}
