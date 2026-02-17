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
import DigitalBanking from "./pages/DigitalBanking";
import Savings from "./pages/Savings";
import Tasks from "./pages/Tasks";
import ParentTasks from "./pages/ParentTasks";
import Store from "./pages/Store";
import LemonadeStand from "./pages/LemonadeStand";
import InvestmentGames from "./pages/InvestmentGames";
import Settings from "./pages/Settings";
import Help from "./pages/Help";
import NotFound from "./pages/NotFound";
import Demo from "./pages/demo/Demo";
import { DemoLemonadeStand } from "./pages/demo/DemoLemonadeStand";

import { DemoVirtualCard } from "./pages/demo/DemoVirtualCard";
import { DemoDigitalBanking } from "./pages/demo/DemoDigitalBanking";
import { DemoInvestmentGames } from "./pages/demo/DemoInvestmentGames";
import { DemoSavings } from "./pages/demo/DemoSavings";
import { DemoStore } from "./pages/demo/DemoStore";
import { DemoTasks } from "./pages/demo/DemoTasks";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
// Nuevo Motor de Lecciones
import { LessonRunner } from "@/components/lessons/engine";
import { LanguageSyncWrapper } from "@/components/auth/LanguageSyncWrapper";
import { SoundProvider } from "@/contexts/SoundContext";

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
                    <Tasks />
                  </ChildProtectedRoute>
                } />
                <Route path="/parent-tasks" element={
                  <ParentProtectedRoute>
                    <ParentTasks />
                  </ParentProtectedRoute>
                } />
                <Route path="/growth" element={
                  <ProtectedRoute>
                    <DigitalBanking />
                  </ProtectedRoute>
                } />
                <Route path="/savings" element={
                  <ProtectedRoute>
                    <Savings />
                  </ProtectedRoute>
                } />
                <Route path="/store" element={
                  <ProtectedRoute>
                    <Store />
                  </ProtectedRoute>
                } />
                <Route path="/investment-games" element={
                  <ProtectedRoute>
                    <InvestmentGames />
                  </ProtectedRoute>
                } />
                <Route path="/lemonade-stand" element={
                  <ProtectedRoute>
                    <LemonadeStand />
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
                <Route path="/demo/lemonade-stand" element={<DemoLemonadeStand />} />

                <Route path="/demo/card" element={<DemoVirtualCard />} />
                <Route path="/demo/growth" element={<DemoDigitalBanking />} />
                <Route path="/demo/investment-games" element={<DemoInvestmentGames />} />
                <Route path="/demo/savings" element={<DemoSavings />} />
                <Route path="/demo/store" element={<DemoStore />} />
                <Route path="/demo/tasks" element={<DemoTasks />} />

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
