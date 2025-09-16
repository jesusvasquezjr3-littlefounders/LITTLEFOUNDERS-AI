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
import Login from "./pages/Login";
import Register from "./pages/Register";
import Lecciones from "./pages/Lecciones";
import LeccionesV2 from "./pages/LeccionesV2";
import Profile from "./pages/Profile";
import DigitalBanking from "./pages/DigitalBanking";
import Savings from "./pages/Savings";
import Tasks from "./pages/Tasks";
import ParentTasks from "./pages/ParentTasks";
import Store from "./pages/Store";
import InvestmentGames from "./pages/InvestmentGames";
import LemonadeStand from "./pages/LemonadeStand";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Welcome />} />
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
          <Route path="/lecciones-v2" element={
            <ProtectedRoute>
              <LeccionesV2 />
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
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
