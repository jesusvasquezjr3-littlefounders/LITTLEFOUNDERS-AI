import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AccountOverview } from "@/components/banking/AccountOverview";
import { VirtualCard } from "@/components/banking/VirtualCard";
import { ParentalControls } from "@/components/banking/ParentalControls";
import { FinancialEducationGame } from "@/components/banking/FinancialEducationGame";
import { AnalyticsDashboard } from "@/components/banking/AnalyticsDashboard";
import { IncomeHistory } from "@/components/banking/IncomeHistory";
import { ExpenseHistory } from "@/components/banking/ExpenseHistory";
import { ParentAccountManagement } from "@/components/banking/ParentAccountManagement";
import { ChildAccountTest } from "@/components/banking/ChildAccountTest";
import { AccountStatement } from "@/components/banking/AccountStatement";
import { 
  CreditCard, 
  Target,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Settings,
  BookOpen,
  Gamepad2,
  BarChart3,
  Users,
  FileText
} from "lucide-react";

const DigitalBanking = () => {
  const [activeTab, setActiveTab] = useState("accounts");
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) {
      setUser(JSON.parse(userData));
    }
  }, []);

  // Determinar qué pestañas mostrar según el tipo de usuario
  const isChild = user?.user_type === 'child';
  const isAdult = user?.user_type === 'tutor' || user?.user_type === 'sponsor';

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Banca Digital</h1>
            <p className="text-muted-foreground">
              {isChild 
                ? "Administra tu dinero virtual, ahorra y aprende sobre finanzas"
                : "Administra las finanzas de tu hijo, supervisa gastos y configuraciones"
              }
            </p>
          </div>
        </div>

        {/* Main Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className={`grid w-full ${isChild ? 'grid-cols-5' : 'grid-cols-5'}`}>
            <TabsTrigger value="accounts">
              <CreditCard className="h-4 w-4 mr-2" />
              Cuentas
            </TabsTrigger>
            <TabsTrigger value="income">
              <TrendingUp className="h-4 w-4 mr-2" />
              Ingresos
            </TabsTrigger>
            <TabsTrigger value="expenses">
              <TrendingDown className="h-4 w-4 mr-2" />
              Gastos
            </TabsTrigger>
            {isChild && (
              <>
                <TabsTrigger value="statement">
                  <FileText className="h-4 w-4 mr-2" />
                  Estado de Cuenta
                </TabsTrigger>
                <TabsTrigger value="test">
                  <Users className="h-4 w-4 mr-2" />
                  Prueba
                </TabsTrigger>
              </>
            )}
            {isAdult && (
              <>
                <TabsTrigger value="family">
                  <Users className="h-4 w-4 mr-2" />
                  Gestión Familiar
                </TabsTrigger>
                <TabsTrigger value="settings">
                  <Settings className="h-4 w-4 mr-2" />
                  Configuración
                </TabsTrigger>
              </>
            )}
            {/* Education tab removed */}
            {/* <TabsTrigger value="education">
              <BookOpen className="h-4 w-4 mr-2" />
              Educación
            </TabsTrigger> */}
            {/* Analytics tab hidden */}
            {/* <TabsTrigger value="analytics">
              <BarChart3 className="h-4 w-4 mr-2" />
              Análisis
            </TabsTrigger> */}
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

          {/* Income Tab */}
          <TabsContent value="income">
            <IncomeHistory />
          </TabsContent>

          {/* Expenses Tab - Para todos los usuarios */}
          <TabsContent value="expenses">
            <ExpenseHistory />
          </TabsContent>

          {/* Statement Tab - Solo para niños */}
          {isChild && (
            <TabsContent value="statement">
              <AccountStatement />
            </TabsContent>
          )}

          {/* Test Tab - Solo para niños */}
          {isChild && (
            <TabsContent value="test">
              <ChildAccountTest />
            </TabsContent>
          )}

          {/* Family Management Tab - Solo para adultos */}
          {isAdult && (
            <TabsContent value="family">
              <ParentAccountManagement />
            </TabsContent>
          )}

          {/* Settings Tab - Solo para adultos */}
          {isAdult && (
            <TabsContent value="settings">
              <ParentalControls />
            </TabsContent>
          )}

          {/* Education Tab removed */}
          {/* <TabsContent value="education">
            <FinancialEducationGame />
          </TabsContent> */}

          {/* Analytics Tab hidden */}
          {/* <TabsContent value="analytics">
            <AnalyticsDashboard />
          </TabsContent> */}
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default DigitalBanking;




