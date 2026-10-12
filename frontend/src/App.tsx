import { lazy, Suspense, useEffect, useState } from 'react';
import { Route, Routes } from 'react-router-dom';
import { MotionConfig } from 'motion/react';
import { Toaster } from 'sileo';
import { ThemeProvider, useTheme } from '@/theme/useTheme';
import { AnalyticsScripts } from '@/lib/analytics';
import { CookieConsentBanner } from '@/components/CookieConsentBanner';
import { AppShell } from '@/components/AppShell';
import { AuthDialogProvider } from '@/features/auth/AuthDialog';
import { SessionProvider } from '@/features/auth/session';
import { GoHomeAfterSignIn } from '@/features/app/GoHome';
import { OnboardingHandoff } from '@/features/onboarding/Handoff';
import { releaseBootVeil } from '@/lib/boot';

// Development only: the avatars alive. `import.meta.env.DEV` is false in a production build, so this chunk is not shipped.
const DevAvatars = import.meta.env.DEV ? lazy(() => import('@/features/avatars/DevAvatars')) : null;

// Development only: the loading window open. Not shipped, like the avatars page.
const DevLoading = import.meta.env.DEV ? lazy(() => import('@/features/loading/DevLoading')) : null;

// Development only: every icon of the application, to look at them together. Not shipped.
const DevIcons = import.meta.env.DEV ? lazy(() => import('@/icons/DevIcons')) : null;

// Development only: the home with its board of the day full of made-up rows. Not shipped.
const DevHome = import.meta.env.DEV ? lazy(() => import('@/features/app/DevHome')) : null;

const Landing = lazy(() => import('@/features/landing/Landing').then((module) => ({ default: module.Landing })));

const NotFound = lazy(() => import('@/features/notFound/NotFound').then((module) => ({ default: module.NotFound })));

const Unsubscribe = lazy(() => import('@/features/email/Unsubscribe').then((module) => ({ default: module.Unsubscribe })));

const Onboarding = lazy(() => import('@/features/onboarding/Onboarding').then((module) => ({ default: module.Onboarding })));

// The signed-in application: its layout and its pages are fetched only by somebody who goes in.
const AppLayout = lazy(() => import('@/features/app/AppLayout').then((module) => ({ default: module.AppLayout })));

const AppHome = lazy(() => import('@/features/app/Home').then((module) => ({ default: module.Home })));

const Destination = lazy(() => import('@/features/app/Destination').then((module) => ({ default: module.Destination })));

const AuthCallback = lazy(() => import('@/features/auth/AuthCallback').then((module) => ({ default: module.AuthCallback })));

/** Toasts follow the visitor's theme (not the operating system's), drawn as the opposite surface so they stand off the page. */
function ThemedToaster() {
  const { isDark } = useTheme();

  return <Toaster position="top-center" theme={isDark ? 'dark' : 'light'} />;
}

/*
 * The whole app: the signed-in application (`/home` and its destinations, in its own layout), the landing at `/` inside the site shell, the page a Google sign-in comes back to
 * (outside the shell: it often lives in a small window), the onboarding's two paths (outside the
 * shell too: one thing per screen), the page the "Unsubscribe" link of an email
 * opens, and the not-found page for every other URL
 * (the shell shows a skeleton while a page's code loads). The session and the sign-in window are
 * provided here, above every page. Reduced motion is honored once, here,
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
        <SessionProvider>
          <AuthDialogProvider>
            <OnboardingHandoff />
            <GoHomeAfterSignIn />
            <Routes>
              <Route path="onboarding" element={<Suspense fallback={null}><Onboarding path="learner" /></Suspense>} />
              <Route path="onboarding/parent" element={<Suspense fallback={null}><Onboarding path="parent" /></Suspense>} />
              <Route element={<Suspense fallback={null}><AppLayout /></Suspense>}>
                <Route path="home" element={<AppHome />} />
                <Route path="learn" element={<Destination name="learn" />} />
                <Route path="mentor" element={<Destination name="mentor" />} />
                <Route path="wallet" element={<Destination name="wallet" />} />
                <Route path="tasks" element={<Destination name="tasks" />} />
                <Route path="family" element={<Destination name="family" />} />
              </Route>
              <Route path="auth/callback" element={<Suspense fallback={null}><AuthCallback /></Suspense>} />
              <Route element={<AppShell />}>
                <Route index element={<Landing />} />
                <Route path="unsubscribe" element={<Unsubscribe />} />
                {DevAvatars ? <Route path="dev/avatars" element={<DevAvatars />} /> : null}
                {DevLoading ? <Route path="dev/loading" element={<DevLoading />} /> : null}
                {DevIcons ? <Route path="dev/icons" element={<DevIcons />} /> : null}
                {DevHome ? <Route path="dev/home" element={<DevHome />} /> : null}
                <Route path="*" element={<NotFound />} />
              </Route>
            </Routes>
          </AuthDialogProvider>
        </SessionProvider>
        {/* After the page in the DOM so the skip link stays the first stop; it is fixed to the bottom either way. */}
        <CookieConsentBanner onDecision={() => setConsentVersion((v) => v + 1)} />
      </ThemeProvider>
    </MotionConfig>
  );
}
