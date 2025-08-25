import { useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AccountOverview } from "@/components/banking/AccountOverview";
import { TasksSystem } from "@/components/banking/TasksSystem";
import { SavingsGoals } from "@/components/banking/SavingsGoals";
import { VirtualCard } from "@/components/banking/VirtualCard";
import { ParentalControls } from "@/components/banking/ParentalControls";
import { FinancialEducationGame } from "@/components/banking/FinancialEducationGame";
import { AnalyticsDashboard } from "@/components/banking/AnalyticsDashboard";
import { 
  CreditCard, 
  PiggyBank, 
  Target,
  AlertTriangle,
  TrendingUp,
  Settings,
  Trophy,
  BookOpen,
  Gamepad2,
  BarChart3
} from "lucide-react";

const DigitalBanking = () => {
  const [activeTab, setActiveTab] = useState("accounts");

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Banca Digital</h1>
            <p className="text-muted-foreground">
              Administra tu dinero virtual, ahorra y aprende sobre finanzas
            </p>
          </div>
        </div>

        {/* Main Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="accounts">
              <CreditCard className="h-4 w-4 mr-2" />
              Cuentas
            </TabsTrigger>
            <TabsTrigger value="tasks">
              <Trophy className="h-4 w-4 mr-2" />
              Tareas
            </TabsTrigger>
            <TabsTrigger value="savings">
              <PiggyBank className="h-4 w-4 mr-2" />
              Ahorros
            </TabsTrigger>
            <TabsTrigger value="education">
              <BookOpen className="h-4 w-4 mr-2" />
              Educación
            </TabsTrigger>
            <TabsTrigger value="analytics">
              <BarChart3 className="h-4 w-4 mr-2" />
              Análisis
            </TabsTrigger>
            <TabsTrigger value="settings">
              <Settings className="h-4 w-4 mr-2" />
              Configuración
            </TabsTrigger>
          </TabsList>

          {/* Accounts Tab */}
          <TabsContent value="accounts">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-6">
                <AccountOverview />
              </div>
              <div>
                <VirtualCard />
              </div>
            </div>
          </TabsContent>

          {/* Tasks Tab */}
          <TabsContent value="tasks">
            <TasksSystem />
          </TabsContent>

          {/* Savings Tab */}
          <TabsContent value="savings">
            <SavingsGoals />
          </TabsContent>

          {/* Education Tab */}
          <TabsContent value="education">
            <FinancialEducationGame />
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics">
            <AnalyticsDashboard />
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings">
            <ParentalControls />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default DigitalBanking;




