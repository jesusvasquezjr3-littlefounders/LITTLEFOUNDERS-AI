import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route } from "react-router-dom";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { AnimatedRoutes } from "@/components/transitions/AnimatedRoutes";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { ParentProtectedRoute } from "@/components/auth/ParentProtectedRoute";
import { ChildProtectedRoute } from "@/components/auth/ChildProtectedRoute";
import { Analytics } from '@vercel/analytics/react';

// Pages
import Index from "./pages/Index";
import Onboarding from "./pages/Onboarding";
import PlacementPage from "./pages/PlacementPage";
import LandingPage from "./pages/LandingPage";
import FamiliesPage from "./pages/landing/FamiliesPage";
import FaqPage from "./pages/landing/FaqPage";
import HowItWorksPage from "./pages/landing/HowItWorksPage";
import PricingPage from "./pages/landing/PricingPage";
import TermsPage from "./pages/legal/TermsPage";
import PrivacyPage from "./pages/legal/PrivacyPage";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Bye from "./pages/Bye";
import AuthCallback from "./pages/AuthCallback";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import LearnPage from "./pages/LearnPage";
import Profile from "./pages/Profile";
import AvatarEditor from "./pages/AvatarEditor";
import Settings from "./pages/Settings";
import Help from "./pages/Help";
import NotFound from "./pages/NotFound";
import PageUnderConstruction from "./pages/PageUnderConstruction";
// DEV-only: Playful DS v2 reference harness for the Lesson Engine redesign.
import LessonLab from "./pages/dev/LessonLab";
// DEV-only: previsualiza lecciones (JSON) en el LessonRunner real sin backend.
import LessonPreview from "./pages/dev/LessonPreview";
import { Navigate } from "react-router-dom";

// Social
import UserProfile from "./pages/social/UserProfile";


import { ThemeProvider } from "@/components/theme/ThemeProvider";
// Nuevo Motor de Lecciones
import { LessonRunner } from "@/components/lessons/engine";
import { LanguageSyncWrapper } from "@/components/auth/LanguageSyncWrapper";
import { SoundProvider } from "@/contexts/SoundContext";
import { GoogleAnalytics } from "@/components/analytics/GoogleAnalytics";

// Games
import GamesPage from "./pages/GamesPage";
import NamVsYumPage from "@/games/nam-vs-yum/NamVsYumPage";
import NectarOfShadowsPage from "@/games/nectar-of-shadows/NectarOfShadowsPage";
import PaperDetectivePage from "@/games/paper-detective/PaperDetectivePage";
import PaperCoinPage from "@/games/paper-coin/PaperCoinPage";
import HackerDefensePage from "@/games/hacker-defense/HackerDefensePage";
import ChronoBloomPage from "@/games/chronobloom/ChronoBloomPage";

// Admin Panel
import { AdminProtectedRoute } from "@/components/admin/AdminProtectedRoute";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import AdminLessons from "@/pages/admin/AdminLessons";
import AdminLessonEditor from "@/pages/admin/AdminLessonEditor";
import AdminCharacters from "@/pages/admin/AdminCharacters";
import AdminAudio from "@/pages/admin/AdminAudio";
import AdminHistory from "@/pages/admin/AdminHistory";
import AdminUsers from "@/pages/admin/AdminUsers";
import { AdminHelp } from "@/pages/admin/AdminHelp";
import AdminReports from "@/pages/admin/AdminReports";
import AdminNotifications from "@/pages/admin/AdminNotifications";
import AdminAnalytics from "@/pages/admin/AdminAnalytics";
import AdminSettings from "@/pages/admin/AdminSettings";

import { useEffect } from "react";
import { useLocation } from "react-router-dom";

// Common
import { ReportFAB } from "@/components/common/ReportFAB";

const queryClient = new QueryClient();

function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
        <SoundProvider>
          <Toaster />
          <Sonner />
          {/* Measure ONLY the canonical production host — beforeSend drops
              events from previews (*.vercel.app) and the es./en. subdomains
              so Vercel Analytics stays scoped to littlefounders.ai. */}
          <Analytics
            beforeSend={(event) =>
              typeof window !== 'undefined' &&
              window.location.hostname === 'littlefounders.ai'
                ? event
                : null
            }
          />
          <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <ScrollToTop />
            <GoogleAnalytics />
            <LanguageSyncWrapper>
              <ReportFAB />
              <AnimatedRoutes>
                <Route path="/" element={<LandingPage />} />
                <Route path="/onboarding" element={<Onboarding />} />
                <Route path="/placement" element={<PlacementPage />} />
                <Route path="/families" element={<FamiliesPage />} />
                <Route path="/how-it-works" element={<HowItWorksPage />} />
                <Route path="/faq" element={<FaqPage />} />
                <Route path="/pricing" element={<PricingPage />} />
                {/* Legal */}
                <Route path="/legal/terms" element={<TermsPage />} />
                <Route path="/legal/privacy" element={<PrivacyPage />} />
                {/* Auth / public routes */}
                <Route path="/login" element={<Login />} />
                <Route path="/signup" element={<Signup />} />
                <Route path="/bye" element={<Bye />} />
                <Route path="/auth/callback" element={<AuthCallback />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password" element={<ResetPassword />} />

                {/* Public social profile — standalone, uses DashboardLayout internally */}
                <Route path="/u/:username" element={<UserProfile />} />

                {/* DEV-only reference harness for the Lesson Engine redesign (Playful DS v2) */}
                {import.meta.env.DEV && <Route path="/dev/lesson-lab" element={<LessonLab />} />}
                {/* DEV-only: previsualiza lecciones generadas en el motor real sin backend */}
                {import.meta.env.DEV && <Route path="/dev/lesson-preview" element={<LessonPreview />} />}

                {/* /lessons — legacy redirect */}
                <Route path="/lessons" element={<Navigate to="/learn" replace />} />
                <Route path="/investment-games" element={<Navigate to="/games" replace />} />
                <Route path="/games/nectar-de-las-sombras" element={<Navigate to="/games/nectar-of-shadows" replace />} />

                {/* ── Dashboard layout route: sidebar/topnav persist across all child routes ── */}
                <Route element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
                  <Route path="/dashboard" element={<Index />} />
                  <Route path="/learn" element={<LearnPage />} />
                  <Route path="/games" element={<GamesPage />} />
                  <Route path="/ai" element={<ProtectedRoute requireAuth><PageUnderConstruction /></ProtectedRoute>} />
                  <Route path="/profile" element={<Profile />} />
                  <Route path="/avatar/edit" element={<AvatarEditor />} />
                  <Route path="/tasks" element={<ChildProtectedRoute><PageUnderConstruction /></ChildProtectedRoute>} />
                  <Route path="/parent-tasks" element={<ParentProtectedRoute><PageUnderConstruction /></ParentProtectedRoute>} />
                  <Route path="/growth" element={<PageUnderConstruction />} />
                  <Route path="/savings" element={<PageUnderConstruction />} />
                  <Route path="/store" element={<PageUnderConstruction />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="/help" element={<Help />} />
                </Route>

                {/* Games (fullscreen — no dashboard chrome) */}
                <Route path="/games/nam-vs-yum" element={<ProtectedRoute><NamVsYumPage /></ProtectedRoute>} />
                <Route path="/games/nectar-of-shadows" element={<ProtectedRoute><NectarOfShadowsPage /></ProtectedRoute>} />
                <Route path="/games/paper-detective" element={<ProtectedRoute><PaperDetectivePage /></ProtectedRoute>} />
                <Route path="/games/paper-coin" element={<ProtectedRoute><PaperCoinPage /></ProtectedRoute>} />
                <Route path="/games/hacker-defense" element={<ProtectedRoute><HackerDefensePage /></ProtectedRoute>} />
                <Route path="/games/chronobloom" element={<ProtectedRoute><ChronoBloomPage /></ProtectedRoute>} />

                {/* Admin Panel Routes */}
                <Route path="/admin" element={
                  <AdminProtectedRoute>
                    <AdminDashboard />
                  </AdminProtectedRoute>
                } />
                <Route path="/admin/lessons" element={
                  <AdminProtectedRoute>
                    <AdminLessons />
                  </AdminProtectedRoute>
                } />
                <Route path="/admin/lessons/new" element={
                  <AdminProtectedRoute>
                    <AdminLessonEditor />
                  </AdminProtectedRoute>
                } />
                <Route path="/admin/lessons/:publicId/edit" element={
                  <AdminProtectedRoute>
                    <AdminLessonEditor />
                  </AdminProtectedRoute>
                } />
                <Route path="/admin/characters" element={
                  <AdminProtectedRoute>
                    <AdminCharacters />
                  </AdminProtectedRoute>
                } />
                <Route path="/admin/audio" element={
                  <AdminProtectedRoute>
                    <AdminAudio />
                  </AdminProtectedRoute>
                } />
                <Route path="/admin/history" element={
                  <AdminProtectedRoute>
                    <AdminHistory />
                  </AdminProtectedRoute>
                } />
                <Route path="/admin/users" element={
                  <AdminProtectedRoute>
                    <AdminUsers />
                  </AdminProtectedRoute>
                } />
                <Route path="/admin/help" element={
                  <AdminProtectedRoute>
                    <AdminHelp />
                  </AdminProtectedRoute>
                } />
                <Route path="/admin/reports" element={
                  <AdminProtectedRoute>
                    <AdminReports />
                  </AdminProtectedRoute>
                } />
                <Route path="/admin/notifications" element={
                  <AdminProtectedRoute>
                    <AdminNotifications />
                  </AdminProtectedRoute>
                } />
                <Route path="/admin/analytics" element={
                  <AdminProtectedRoute>
                    <AdminAnalytics />
                  </AdminProtectedRoute>
                } />
                <Route path="/admin/settings" element={
                  <AdminProtectedRoute>
                    <AdminSettings />
                  </AdminProtectedRoute>
                } />

                {/* Nuevo Motor de Lecciones - Rutas dinámicas */}
                <Route path="/lesson/:lessonCode" element={<LessonRunner />} />

                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </AnimatedRoutes>
            </LanguageSyncWrapper>
          </BrowserRouter>
        </SoundProvider>
      </ThemeProvider>
    </TooltipProvider>
  </QueryClientProvider>

);

export default App;
