import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { ChildDashboard } from "@/components/dashboard/ChildDashboard";
import { KPICard } from "@/components/dashboard/KPICard";
import { RevenueChart } from "@/components/dashboard/RevenueChart";
import { CustomerAnalytics } from "@/components/dashboard/CustomerAnalytics";
import { 
  DollarSign, 
  Users, 
  Package, 
  UserCheck, 
  Activity,
  Zap,
  Timer,
  TrendingUp
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const Index = () => {
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) {
      setUser(JSON.parse(userData));
    }
  }, []);

  // If user is a child, show the child dashboard
  if (user?.user_type === 'child') {
    return (
      <DashboardLayout>
        <ChildDashboard user={user} />
      </DashboardLayout>
    );
  }

  // For tutor and sponsor, show the regular dashboard
  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">
              {user?.user_type === 'tutor' ? 'Panel de Control - Padre o Tutor' : 
               user?.user_type === 'sponsor' ? 'Panel de Control - Patrocinador' : 
               'Panel de Control'}
            </h1>
            <p className="text-muted-foreground">
              Monitorea tus métricas importantes y indicadores de rendimiento
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <Badge variant="outline" className="px-3 py-1">
              Datos en Vivo
            </Badge>
            <Button>
              <Activity className="w-4 h-4 mr-2" />
              Exportar Reporte
            </Button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <KPICard
            title="Ingresos Mensuales"
            value="$20,000"
            change={16.2}
            changeLabel="vs mes anterior"
            target="$25,000"
            targetProgress={80}
            variant="revenue"
            icon={DollarSign}
          />
          <KPICard
            title="Usuarios Activos"
            value="2,847"
            change={12.4}
            changeLabel="vs mes anterior"
            target="3,000"
            targetProgress={94.9}
            variant="customers"
            icon={Users}
          />
          <KPICard
            title="Adopción del Producto"
            value="78.5%"
            change={5.8}
            changeLabel="vs mes anterior"
            target="85%"
            targetProgress={92.4}
            variant="product"
            icon={Package}
          />
          <KPICard
            title="Velocidad del Equipo"
            value="42 pts"
            change={-2.1}
            changeLabel="vs sprint anterior"
            target="45 pts"
            targetProgress={93.3}
            variant="team"
            icon={UserCheck}
          />
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <RevenueChart />
          
          {/* Quick Metrics */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Zap className="h-5 w-5 text-primary" />
                <span>Métricas Rápidas</span>
              </CardTitle>
              <CardDescription>Indicadores clave de rendimiento de un vistazo</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-revenue-light rounded-lg">
                <div>
                  <div className="font-medium">Valor del Cliente</div>
                  <div className="text-sm text-muted-foreground">Valor de por vida</div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-revenue">$2,340</div>
                  <div className="text-xs text-revenue">+8.2%</div>
                </div>
              </div>
              
              <div className="flex items-center justify-between p-3 bg-customers-light rounded-lg">
                <div>
                  <div className="font-medium">Recuperación CAC</div>
                  <div className="text-sm text-muted-foreground">Costo de adquisición</div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-customers">8.2 meses</div>
                  <div className="text-xs text-customers">-0.5 meses</div>
                </div>
              </div>
              
              <div className="flex items-center justify-between p-3 bg-product-light rounded-lg">
                <div>
                  <div className="font-medium">Uso de Funciones</div>
                  <div className="text-sm text-muted-foreground">Funciones principales</div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-product">92%</div>
                  <div className="text-xs text-product">+3.1%</div>
                </div>
              </div>
              
              <div className="flex items-center justify-between p-3 bg-team-light rounded-lg">
                <div>
                  <div className="font-medium">Tasa de Consumo</div>
                  <div className="text-sm text-muted-foreground">Gasto mensual</div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-team">$45K</div>
                  <div className="text-xs text-team">18 meses de autonomía</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Customer Analytics */}
        <CustomerAnalytics />

        {/* Bottom Row - Alerts & Insights */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Timer className="h-5 w-5 text-destructive" />
                <span>Alertas Críticas</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-start space-x-3 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                <div className="w-2 h-2 bg-destructive rounded-full mt-2"></div>
                <div>
                  <div className="font-medium">Pico en Tasa de Abandono</div>
                  <div className="text-sm text-muted-foreground">
                    El abandono de clientes aumentó 2% esta semana. Revisa las métricas de satisfacción.
                  </div>
                </div>
              </div>
              
              <div className="flex items-start space-x-3 p-3 bg-team/10 border border-team/20 rounded-lg">
                <div className="w-2 h-2 bg-team rounded-full mt-2"></div>
                <div>
                  <div className="font-medium">Rendimiento del Servidor</div>
                  <div className="text-sm text-muted-foreground">
                    Los tiempos de respuesta de la API son 15% más lentos de lo normal. Verifica la infraestructura.
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                <span>Insights de Crecimiento</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-start space-x-3 p-3 bg-revenue/10 border border-revenue/20 rounded-lg">
                <div className="w-2 h-2 bg-revenue rounded-full mt-2"></div>
                <div>
                  <div className="font-medium">Hito de Ingresos</div>
                  <div className="text-sm text-muted-foreground">
                    ¡Estás al 80% de tu meta de $25K MRR. ¡Mantén el impulso!
                  </div>
                </div>
              </div>
              
              <div className="flex items-start space-x-3 p-3 bg-customers/10 border border-customers/20 rounded-lg">
                <div className="w-2 h-2 bg-customers rounded-full mt-2"></div>
                <div>
                  <div className="font-medium">Crecimiento del Segmento de Clientes</div>
                  <div className="text-sm text-muted-foreground">
                    Los clientes empresariales están creciendo 23% más rápido que otros segmentos.
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Index;
