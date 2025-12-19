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
import { BankingLoadingScreen } from "@/components/ui/LoadingScreen";
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
  FileText,
  History
} from "lucide-react";

const DigitalBanking = () => {
  const [activeTab, setActiveTab] = useState("accounts");
  const [user, setUser] = useState<any>(null);
  const [hasVirtualCard, setHasVirtualCard] = useState<boolean>(false);
  const [bankingActivated, setBankingActivated] = useState<boolean>(false);
  const [childrenWithoutCards, setChildrenWithoutCards] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) {
      setUser(JSON.parse(userData));
    }
  }, []);

  // Verificar estado de tarjeta virtual
  useEffect(() => {
    const checkVirtualCardStatus = async () => {
      if (!user?.id) return;
      
      try {
        setIsLoading(true);
        // Agregar timestamp para evitar caché
        const response = await fetch(`http://localhost:8000/virtual-cards/status/${user.id}?t=${Date.now()}`);
        if (response.ok) {
          const data = await response.json();
          
          if (user.user_type === 'child') {
            setHasVirtualCard(data.has_card || false);
            setBankingActivated(data.banking_activated || false);
          } else if (user.user_type === 'tutor' || user.user_type === 'sponsor') {
            // Verificar si algún child no tiene tarjeta
            const childrenWithoutCard = data.children?.filter((c: any) => !c.banking_activated) || [];
            setChildrenWithoutCards(childrenWithoutCard);
          }
        } else {
          // Si hay error, asumir que no tiene tarjeta
          if (user.user_type === 'child') {
            setHasVirtualCard(false);
            setBankingActivated(false);
          }
        }
      } catch (error) {
        console.error('Error checking virtual card status:', error);
        // En caso de error, asumir que no tiene tarjeta
        if (user.user_type === 'child') {
          setHasVirtualCard(false);
          setBankingActivated(false);
        }
      } finally {
        setIsLoading(false);
      }
    };

    if (user) {
      checkVirtualCardStatus();
    }
  }, [user]);

  // Escuchar eventos de activación de tarjeta virtual
  useEffect(() => {
    const handleVirtualCardActivated = () => {
      // Refrescar el estado cuando se active una tarjeta virtual
      refreshVirtualCardStatus();
    };

    window.addEventListener('virtualCardActivated', handleVirtualCardActivated);
    
    return () => {
      window.removeEventListener('virtualCardActivated', handleVirtualCardActivated);
    };
  }, [user]);

  // Determinar qué pestañas mostrar según el tipo de usuario
  const isChild = user?.user_type === 'child';
  const isAdult = user?.user_type === 'tutor' || user?.user_type === 'sponsor';

  // Función para navegar a gestión familiar
  const goToFamilyManagement = () => {
    setActiveTab("family");
  };

  // Función para refrescar el estado de la tarjeta virtual
  const refreshVirtualCardStatus = async () => {
    if (!user?.id) return;
    
    try {
      const response = await fetch(`http://localhost:8000/virtual-cards/status/${user.id}?t=${Date.now()}`);
      if (response.ok) {
        const data = await response.json();
        
        if (user.user_type === 'child') {
          setHasVirtualCard(data.has_card || false);
          setBankingActivated(data.banking_activated || false);
        } else if (user.user_type === 'tutor' || user.user_type === 'sponsor') {
          const childrenWithoutCard = data.children?.filter((c: any) => !c.banking_activated) || [];
          setChildrenWithoutCards(childrenWithoutCard);
        }
      }
    } catch (error) {
      console.error('Error refreshing virtual card status:', error);
    }
  };

  // Pantalla de carga mientras se verifica el estado
  if (isLoading) {
    return (
      <DashboardLayout>
        <BankingLoadingScreen />
      </DashboardLayout>
    );
  }

  // Si es child sin banca activada, mostrar mensaje
  if (isChild && !bankingActivated) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Banca Digital</h1>
              <p className="text-muted-foreground">
                Administra tu dinero virtual, ahorra y aprende sobre finanzas
              </p>
            </div>
          </div>

          <Card className="p-8 text-center">
            <CardContent>
              <div className="flex flex-col items-center space-y-4">
                <CreditCard className="h-16 w-16 text-muted-foreground" />
                <h2 className="text-2xl font-bold">Banca en Línea no Activada</h2>
                <p className="text-muted-foreground max-w-md">
                  Habla con tu tutor o patrocinador para que active tu banca en línea 
                  y puedas empezar a administrar tu dinero virtual.
                </p>
                <Button 
                  variant="outline" 
                  onClick={refreshVirtualCardStatus}
                  className="mt-4"
                >
                  <CreditCard className="h-4 w-4 mr-2" />
                  Verificar Estado
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  // Si es tutor/sponsor con children sin tarjetas y no ha navegado a family management
  if (isAdult && childrenWithoutCards.length > 0 && !isLoading && activeTab !== "family") {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Banca Digital</h1>
              <p className="text-muted-foreground">
                Administra las finanzas de tu hijo, supervisa gastos y configuraciones
              </p>
            </div>
          </div>

          <Card className="p-8 text-center">
            <CardContent>
              <div className="flex flex-col items-center space-y-4">
                <AlertTriangle className="h-16 w-16 text-yellow-600" />
                <h2 className="text-2xl font-bold">Activa la Banca en Línea</h2>
                <p className="text-muted-foreground max-w-md">
                  Genera una tarjeta virtual para que {childrenWithoutCards.length > 1 ? 'tus hijos puedan' : 'tu hijo pueda'} 
                  {' '}empezar a usar la banca en línea.
                </p>
                <Button 
                  size="lg"
                  onClick={goToFamilyManagement}
                  className="mt-4"
                >
                  <Users className="h-5 w-5 mr-2" />
                  Ir a Gestión Familiar
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

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
          <TabsList className={`grid w-full ${isChild ? 'grid-cols-3' : 'grid-cols-4'}`}>
            <TabsTrigger value="accounts">
              <CreditCard className="h-4 w-4 mr-2" />
              Cuentas
            </TabsTrigger>
            <TabsTrigger value="history">
              <History className="h-4 w-4 mr-2" />
              Historial
            </TabsTrigger>
            {isChild && (
              <TabsTrigger value="test">
                <Users className="h-4 w-4 mr-2" />
                Prueba
              </TabsTrigger>
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
            <div className="space-y-6">
              {/* Mi Tarjeta Virtual */}
              <VirtualCard />
              
              {/* Mi Cuenta Principal */}
              <AccountOverview />
            </div>
          </TabsContent>

          {/* History Tab - Engloba Ingresos, Gastos y Estado de Cuenta */}
          <TabsContent value="history">
            <Tabs defaultValue="income" className="space-y-6">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="income">
                  <TrendingUp className="h-4 w-4 mr-2" />
                  Ingresos
                </TabsTrigger>
                <TabsTrigger value="expenses">
                  <TrendingDown className="h-4 w-4 mr-2" />
                  Gastos
                </TabsTrigger>
                <TabsTrigger value="statement">
                  <FileText className="h-4 w-4 mr-2" />
                  Estado de Cuenta
                </TabsTrigger>
              </TabsList>

              <TabsContent value="income">
                <IncomeHistory />
              </TabsContent>

              <TabsContent value="expenses">
                <ExpenseHistory />
              </TabsContent>

              <TabsContent value="statement">
                <AccountStatement />
              </TabsContent>
            </Tabs>
          </TabsContent>

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




