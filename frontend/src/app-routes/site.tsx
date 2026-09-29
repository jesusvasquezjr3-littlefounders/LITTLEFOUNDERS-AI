import { Route } from 'react-router-dom';
import { RequireAuth } from '@/auth/RequireAuth';
import { RequireGuest } from '@/auth/RequireGuest';
import { Landing } from '@/routes/marketing/Landing';
import { HowItWorks } from '@/routes/marketing/HowItWorks';
import { Families } from '@/routes/marketing/Families';
import { FAQ } from '@/routes/marketing/FAQ';
import { LegalPage } from '@/routes/marketing/LegalPage';
import { BadgeLandingPage } from '@/routes/marketing/BadgeLandingPage';
import { LoginPage } from '@/routes/auth/LoginPage';
import { SignupPage } from '@/routes/auth/SignupPage';
import { AuthCallbackPage } from '@/routes/auth/AuthCallbackPage';
import { ForgotPasswordPage } from '@/routes/auth/ForgotPasswordPage';
import { ResetPasswordPage } from '@/routes/auth/ResetPasswordPage';
import { VerifyParentPage } from '@/routes/auth/VerifyParentPage';
import { UpgradeAccountPage } from '@/routes/auth/UpgradeAccountPage';
import { JoinInvitePage } from '@/app-routes/JoinInvitePage';
import { OnboardingPage } from '@/routes/onboarding/OnboardingPage';

/*
 * Lane 1 (site): the public site, sign-in, recovery, verification and
 * onboarding. App.tsx (Lane 0) mounts each group inside its layout; this
 * module owns only the child routes and their guards.
 */

/** The public site's pages (inside the public-site shell). */
export const sitePageRoutes = (
  <>
    <Route index element={<Landing />} />
    <Route path="how-it-works" element={<HowItWorks />} />
    <Route path="families" element={<Families />} />
    <Route path="faq" element={<FAQ />} />
    <Route path="legal/terms" element={<LegalPage doc="terms" />} />
    <Route path="legal/privacy" element={<LegalPage doc="privacy" />} />
  </>
);

/** Sign-in, sign-up, recovery and verification (inside the sign-in shell). */
export const siteAuthRoutes = (
  <>
    <Route path="login" element={<RequireGuest><LoginPage /></RequireGuest>} />
    <Route path="signup" element={<RequireGuest><SignupPage /></RequireGuest>} />
    <Route path="forgot-password" element={<RequireGuest><ForgotPasswordPage /></RequireGuest>} />
    {/* Not guest-guarded: driven entirely by the recovery link's URL
        fragment, which is valid regardless of any existing session
        on this device (e.g. an older link opened while logged in
        elsewhere). */}
    <Route path="reset-password" element={<ResetPasswordPage />} />
  </>
);

/** The OAuth return, parent verification and saving a guest's progress: sign-in screens that need (or make) a session. */
export const siteAccountRoutes = (
  <>
    {/* OAuth landing — not guest-guarded: it completes the transition from guest to authed. */}
    <Route path="auth/callback" element={<AuthCallbackPage />} />
    <Route path="verify-parent" element={<RequireAuth><VerifyParentPage /></RequireAuth>} />
    {/* GAP-FIX-R5 (A.1, D.3): a Tutor invite's landing. No guard: the person
        who opens it is usually not a verified Tutor yet, often not signed in.
        It keeps the token through sign-in, sign-up and verification; the
        accept stays on /family, inside Core's verified-parent boundary. */}
    <Route path="join/:token" element={<JoinInvitePage />} />
    {/* Attach a permanent identity to the current guest session in
        place — never /signup, which would mint a second blank identity.
        On the sign-in shell since W2S.2 (A6 is a sign-in screen). */}
    <Route path="upgrade-account" element={<RequireAuth><UpgradeAccountPage /></RequireAuth>} />
  </>
);

/** Full-screen layers with no navigation around them. */
export const siteStandaloneRoutes = (
  <>
    {/* Onboarding — guest-first, one-time. Its own fullscreen layer, no
        app/marketing chrome; RequireAuth only (a guest already has a
        session the moment they land here — see Landing's startAsGuest). */}
    <Route path="onboarding" element={<RequireAuth><OnboardingPage /></RequireAuth>} />
    {/* Shareable-achievement-badge landing page (0072/0073) — the ONE
        route in this app a stranger opens with no account and no
        session. No chrome, no auth: its own fullscreen layer, but
        reachable by anyone. The <head> OG tags a crawler reads come from
        frontend/api/badge/[token].ts, which injects them into this same
        app-shell before the SPA boots. */}
    <Route path="badge/:token" element={<BadgeLandingPage />} />
  </>
);
