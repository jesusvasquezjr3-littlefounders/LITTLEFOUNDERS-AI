import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { ParentProtectedRoute } from "@/components/auth/ParentProtectedRoute";
import { ChildProtectedRoute } from "@/components/auth/ChildProtectedRoute";
import { PostHogProvider } from "@/components/PostHogProvider";
import { SimpleTimeDemo } from "@/components/analytics/SimpleTimeDemo";
import { PostHogAnalyticsDemo } from "@/components/analytics/PostHogAnalyticsDemo";
import { UserAnalyticsDemo } from "@/components/analytics/UserAnalyticsDemo";
import { PostHogEventsDemo } from "@/components/analytics/PostHogEventsDemo";
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
import NotFound from "./pages/NotFound";
import Demo from "./pages/demo/Demo";
import { DemoLemonadeStand } from "./pages/demo/DemoLemonadeStand";
import { DemoLecciones } from "./pages/demo/DemoLecciones";
import { DemoLesson1 } from "./pages/demo/DemoLesson1";
import { DemoVirtualCard } from "./pages/demo/DemoVirtualCard";
import { DemoDigitalBanking } from "./pages/demo/DemoDigitalBanking";
import { DemoInvestmentGames } from "./pages/demo/DemoInvestmentGames";
import { DemoSavings } from "./pages/demo/DemoSavings";
import { DemoStore } from "./pages/demo/DemoStore";
import { DemoTasks } from "./pages/demo/DemoTasks";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <PostHogProvider>
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
            {/* Demo Routes */}
            <Route path="/demo" element={<Demo />} />
            <Route path="/demo/lemonade-stand" element={<DemoLemonadeStand />} />
            <Route path="/demo/lecciones" element={<DemoLecciones />} />
            <Route path="/demo/lecciones/1" element={<DemoLesson1 />} />
            <Route path="/demo/card" element={<DemoVirtualCard />} />
            <Route path="/demo/growth" element={<DemoDigitalBanking />} />
            <Route path="/demo/investment-games" element={<DemoInvestmentGames />} />
            <Route path="/demo/savings" element={<DemoSavings />} />
            <Route path="/demo/store" element={<DemoStore />} />
            <Route path="/demo/tasks" element={<DemoTasks />} />

            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
          {/* Analytics components hidden */}
          {/* <SimpleTimeDemo />
          <PostHogAnalyticsDemo showDemo={import.meta.env.DEV} />
          <UserAnalyticsDemo showDemo={import.meta.env.DEV} />
          <PostHogEventsDemo showDemo={import.meta.env.DEV} /> */}
        </PostHogProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
