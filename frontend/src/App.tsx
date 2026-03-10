import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { ParentProtectedRoute } from "@/components/auth/ParentProtectedRoute";
import { ChildProtectedRoute } from "@/components/auth/ChildProtectedRoute";

import Index from "./pages/Index";
import Welcome from "./pages/Welcome";
import LandingPage from "./pages/LandingPage";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Bye from "./pages/Bye";
import DiscordCallback from "./pages/DiscordCallback";
import Lecciones from "./pages/Lecciones";
import Profile from "./pages/Profile";
import AvatarEditor from "./pages/AvatarEditor";
import Settings from "./pages/Settings";
import Help from "./pages/Help";
import NotFound from "./pages/NotFound";
import PageUnderConstruction from "./pages/PageUnderConstruction";

import Demo from "./pages/demo/Demo";
import { DemoDashboardLayout } from "@/components/demo/DemoDashboardLayout";

import { ThemeProvider } from "@/components/theme/ThemeProvider";
// Nuevo Motor de Lecciones
import { LessonRunner } from "@/components/lessons/engine";
import { LanguageSyncWrapper } from "@/components/auth/LanguageSyncWrapper";
import { SoundProvider } from "@/contexts/SoundContext";

// Games
import GamesPage from "./pages/GamesPage";
import NamVsYumPage from "@/games/nam-vs-yum/NamVsYumPage";
import NectarDeLasSombrasPage from "@/games/nectar-de-las-sombras/NectarDeLasSombrasPage";
import PaperDetectivePage from "@/games/paper-detective/PaperDetectivePage";

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

const queryClient = new QueryClient();


const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
        <SoundProvider>

          <Toaster />
          <Sonner />
          <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <LanguageSyncWrapper>
              <Routes>
                <Route path="/" element={<LandingPage />} />
                <Route path="/dashboard" element={
                  <ProtectedRoute>
                    <Index />
                  </ProtectedRoute>
                } />
                <Route path="/welcome" element={<Welcome />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/bye" element={<Bye />} />
                <Route path="/auth/discord/callback" element={<DiscordCallback />} />
                <Route path="/lecciones" element={
                  <ProtectedRoute>
                    <Lecciones />
                  </ProtectedRoute>
                } />
                <Route path="/ai" element={
                  <ProtectedRoute>
                    <PageUnderConstruction />
                  </ProtectedRoute>
                } />
                <Route path="/profile" element={
                  <ProtectedRoute>
                    <Profile />
                  </ProtectedRoute>
                } />
                <Route path="/avatar/edit" element={
                  <ProtectedRoute>
                    <AvatarEditor />
                  </ProtectedRoute>
                } />
                <Route path="/tasks" element={
                  <ChildProtectedRoute>
                    <PageUnderConstruction />
                  </ChildProtectedRoute>
                } />
                <Route path="/parent-tasks" element={
                  <ParentProtectedRoute>
                    <PageUnderConstruction />
                  </ParentProtectedRoute>
                } />
                <Route path="/growth" element={
                  <ProtectedRoute>
                    <PageUnderConstruction />
                  </ProtectedRoute>
                } />
                <Route path="/savings" element={
                  <ProtectedRoute>
                    <PageUnderConstruction />
                  </ProtectedRoute>
                } />
                <Route path="/store" element={
                  <ProtectedRoute>
                    <PageUnderConstruction />
                  </ProtectedRoute>
                } />
                <Route path="/investment-games" element={
                  <ProtectedRoute>
                    <GamesPage />
                  </ProtectedRoute>
                } />
                {/* Games */}
                <Route path="/games/nam-vs-yum" element={
                  <ProtectedRoute>
                    <NamVsYumPage />
                  </ProtectedRoute>
                } />
                <Route path="/games/nectar-de-las-sombras" element={
                  <ProtectedRoute>
                    <NectarDeLasSombrasPage />
                  </ProtectedRoute>
                } />
                <Route path="/games/paper-detective" element={
                  <ProtectedRoute>
                    <PaperDetectivePage />
                  </ProtectedRoute>
                } />

                <Route path="/settings" element={
                  <ProtectedRoute>
                    <Settings />
                  </ProtectedRoute>
                } />
                <Route path="/help" element={
                  <ProtectedRoute>
                    <Help />
                  </ProtectedRoute>
                } />
                {/* Demo Routes */}
                <Route path="/demo" element={<Demo />} />
                <Route path="/demo/lecciones" element={<Lecciones isDemo Layout={DemoDashboardLayout} />} />
                <Route path="/demo/lessons" element={<Lecciones isDemo Layout={DemoDashboardLayout} />} />
                <Route path="/demo/investment-games" element={<GamesPage isDemo Layout={DemoDashboardLayout} />} />
                <Route path="/demo/games" element={<GamesPage isDemo Layout={DemoDashboardLayout} />} />
                <Route path="/demo/juegos" element={<GamesPage isDemo Layout={DemoDashboardLayout} />} />

                {/* Removed unused Demo routes or pointed them to Under Construction if needed for consistency, 
                    though Sidebar has them locked with '#' */}


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
                <Route path="/admin/lessons/:id/edit" element={
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

                {/* Nuevo Motor de Lecciones - Rutas dinámicas */}
                <Route path="/lesson/:lessonCode" element={<LessonRunner />} />

                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </LanguageSyncWrapper>
          </BrowserRouter>
        </SoundProvider>
      </ThemeProvider>
    </TooltipProvider>
  </QueryClientProvider>

);

export default App;
