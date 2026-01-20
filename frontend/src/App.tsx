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
import Lecciones from "./pages/Lecciones";
import Profile from "./pages/Profile";
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
import { DemoLecciones } from "./pages/demo/DemoLecciones";
import { DemoLesson1 } from "./pages/demo/DemoLesson1";
import { DemoLesson2 } from "./pages/demo/DemoLesson2";
import { DemoLesson3 } from "./pages/demo/DemoLesson3";
import { DemoLesson4 } from "./pages/demo/DemoLesson4";
import { DemoVirtualCard } from "./pages/demo/DemoVirtualCard";
import { DemoDigitalBanking } from "./pages/demo/DemoDigitalBanking";
import { DemoInvestmentGames } from "./pages/demo/DemoInvestmentGames";
import { DemoSavings } from "./pages/demo/DemoSavings";
import { DemoStore } from "./pages/demo/DemoStore";
import { DemoTasks } from "./pages/demo/DemoTasks";
import { DemoLesson5 } from "./pages/demo/DemoLesson5";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
// Nuevo Motor de Lecciones
import { LessonRunner } from "@/components/lessons/engine";
import { LanguageSyncWrapper } from "@/components/auth/LanguageSyncWrapper";

const queryClient = new QueryClient();


const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">

        <Toaster />
        <Sonner />
        <BrowserRouter>
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
              <Route path="/demo/lecciones" element={<DemoLecciones />} />
              <Route path="/demo/lecciones/1" element={<DemoLesson1 />} />
              <Route path="/demo/lecciones/2" element={<DemoLesson2 />} />
              <Route path="/demo/lecciones/3" element={<DemoLesson3 />} />
              <Route path="/demo/lecciones/4" element={<DemoLesson4 />} />
              <Route path="/demo/lecciones/5" element={<DemoLesson5 />} />
              <Route path="/demo/card" element={<DemoVirtualCard />} />
              <Route path="/demo/growth" element={<DemoDigitalBanking />} />
              <Route path="/demo/investment-games" element={<DemoInvestmentGames />} />
              <Route path="/demo/savings" element={<DemoSavings />} />
              <Route path="/demo/store" element={<DemoStore />} />
              <Route path="/demo/tasks" element={<DemoTasks />} />

              {/* Nuevo Motor de Lecciones - Rutas dinámicas */}
              <Route path="/lesson/:lessonCode" element={<LessonRunner />} />

              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </LanguageSyncWrapper>
        </BrowserRouter>
      </ThemeProvider>
    </TooltipProvider>
  </QueryClientProvider>

);

export default App;
