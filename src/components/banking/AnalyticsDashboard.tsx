import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  BarChart3, 
  TrendingUp,
  TrendingDown,
  DollarSign,
  PiggyBank,
  Target,
  Trophy,
  Calendar,
  ArrowUp,
  ArrowDown,
  Eye,
  Download,
  Zap,
  Star,
  Clock,
  CheckCircle,
  AlertTriangle
} from "lucide-react";

interface FinancialData {
  period: string;
  income: number;
  expenses: number;
  savings: number;
  balance: number;
}

interface CategorySpending {
  category: string;
  amount: number;
  percentage: number;
  trend: 'up' | 'down' | 'stable';
  icon: string;
}

interface Achievement {
  id: string;
  title: string;
  description: string;
  dateAchieved: string;
  points: number;
  icon: string;
  category: 'saving' | 'earning' | 'learning' | 'goals';
}

interface SavingsGoalProgress {
  id: string;
  title: string;
  target: number;
  current: number;
  deadline: string;
  daysLeft: number;
  onTrack: boolean;
}

const mockFinancialData: FinancialData[] = [
  { period: "Enero", income: 45, expenses: 25, savings: 15, balance: 65 },
  { period: "Febrero", income: 50, expenses: 30, savings: 18, balance: 83 },
  { period: "Marzo", income: 60, expenses: 22, savings: 28, balance: 121 },
  { period: "Abril", income: 55, expenses: 35, savings: 15, balance: 141 },
  { period: "Mayo", income: 70, expenses: 28, savings: 32, balance: 175 },
  { period: "Junio", income: 65, expenses: 40, savings: 20, balance: 200 }
];

const categorySpending: CategorySpending[] = [
  { category: "Entretenimiento", amount: 45, percentage: 35, trend: "up", icon: "🎮" },
  { category: "Comida y Bebidas", amount: 25, percentage: 20, trend: "stable", icon: "🍕" },
  { category: "Libros y Educación", amount: 20, percentage: 15, trend: "up", icon: "📚" },
  { category: "Juguetes", amount: 18, percentage: 14, trend: "down", icon: "🧸" },
  { category: "Ropa", amount: 12, percentage: 9, trend: "stable", icon: "👕" },
  { category: "Deportes", amount: 8, percentage: 7, trend: "up", icon: "⚽" }
];

const recentAchievements: Achievement[] = [
  {
    id: "1",
    title: "Meta de Ahorro Alcanzada",
    description: "Completaste tu meta de ahorrar $200 para la Nintendo Switch",
    dateAchieved: "2024-01-15",
    points: 50,
    icon: "🎯",
    category: "goals"
  },
  {
    id: "2",
    title: "Racha de Tareas",
    description: "Completaste 10 tareas consecutivas sin fallar",
    dateAchieved: "2024-01-12",
    points: 25,
    icon: "🔥",
    category: "earning"
  },
  {
    id: "3",
    title: "Ahorrador Constante",
    description: "Ahorraste dinero durante 4 semanas seguidas",
    dateAchieved: "2024-01-10",
    points: 30,
    icon: "💰",
    category: "saving"
  },
  {
    id: "4",
    title: "Genio Financiero",
    description: "Completaste el nivel avanzado de educación financiera",
    dateAchieved: "2024-01-08",
    points: 40,
    icon: "🧠",
    category: "learning"
  }
];

const savingsGoals: SavingsGoalProgress[] = [
  {
    id: "1",
    title: "Nintendo Switch",
    target: 300,
    current: 285,
    deadline: "2024-06-15",
    daysLeft: 45,
    onTrack: true
  },
  {
    id: "2",
    title: "Curso de Programación",
    target: 150,
    current: 75,
    deadline: "2024-04-30",
    daysLeft: 89,
    onTrack: true
  },
  {
    id: "3",
    title: "Fondo de Emergencia",
    target: 100,
    current: 35,
    deadline: "2024-12-31",
    daysLeft: 280,
    onTrack: false
  }
];

export function AnalyticsDashboard() {
  const [selectedPeriod, setSelectedPeriod] = useState("6months");
  const [activeTab, setActiveTab] = useState("overview");

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const calculateTrend = (current: number, previous: number) => {
    const change = ((current - previous) / previous) * 100;
    return {
      value: Math.abs(change),
      direction: change >= 0 ? 'up' : 'down',
      isPositive: change >= 0
    };
  };

  const getCurrentPeriodData = () => {
    return mockFinancialData[mockFinancialData.length - 1];
  };

  const getPreviousPeriodData = () => {
    return mockFinancialData[mockFinancialData.length - 2];
  };

  const currentData = getCurrentPeriodData();
  const previousData = getPreviousPeriodData();

  const incomeTrend = calculateTrend(currentData.income, previousData.income);
  const expensesTrend = calculateTrend(currentData.expenses, previousData.expenses);
  const savingsTrend = calculateTrend(currentData.savings, previousData.savings);

  const totalSavings = savingsGoals.reduce((sum, goal) => sum + goal.current, 0);
  const totalTargets = savingsGoals.reduce((sum, goal) => sum + goal.target, 0);
  const savingsProgress = (totalSavings / totalTargets) * 100;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Análisis Financiero</h2>
          <p className="text-muted-foreground">
            Vista completa de tu progreso financiero y logros
          </p>
        </div>
        <div className="flex items-center space-x-4">
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="3months">Últimos 3 meses</SelectItem>
              <SelectItem value="6months">Últimos 6 meses</SelectItem>
              <SelectItem value="1year">Último año</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Exportar
          </Button>
        </div>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Resumen</TabsTrigger>
          <TabsTrigger value="spending">Gastos</TabsTrigger>
          <TabsTrigger value="goals">Metas</TabsTrigger>
          <TabsTrigger value="achievements">Logros</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-green-100 rounded-full">
                    <DollarSign className="h-6 w-6 text-green-600" />
                  </div>
                  <div className="flex-1">
                    <div className="text-2xl font-bold text-green-600">
                      {formatCurrency(currentData.balance)}
                    </div>
                    <div className="text-sm text-muted-foreground">Balance Total</div>
                    <div className="flex items-center mt-1">
                      <ArrowUp className="h-3 w-3 text-green-600 mr-1" />
                      <span className="text-xs text-green-600">+12% vs mes anterior</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-blue-100 rounded-full">
                    <TrendingUp className="h-6 w-6 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <div className="text-2xl font-bold text-blue-600">
                      {formatCurrency(currentData.income)}
                    </div>
                    <div className="text-sm text-muted-foreground">Ingresos del Mes</div>
                    <div className="flex items-center mt-1">
                      {incomeTrend.direction === 'up' ? (
                        <ArrowUp className="h-3 w-3 text-green-600 mr-1" />
                      ) : (
                        <ArrowDown className="h-3 w-3 text-red-600 mr-1" />
                      )}
                      <span className={`text-xs ${incomeTrend.isPositive ? 'text-green-600' : 'text-red-600'}`}>
                        {incomeTrend.isPositive ? '+' : '-'}{incomeTrend.value.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-orange-100 rounded-full">
                    <TrendingDown className="h-6 w-6 text-orange-600" />
                  </div>
                  <div className="flex-1">
                    <div className="text-2xl font-bold text-orange-600">
                      {formatCurrency(currentData.expenses)}
                    </div>
                    <div className="text-sm text-muted-foreground">Gastos del Mes</div>
                    <div className="flex items-center mt-1">
                      {expensesTrend.direction === 'up' ? (
                        <ArrowUp className="h-3 w-3 text-red-600 mr-1" />
                      ) : (
                        <ArrowDown className="h-3 w-3 text-green-600 mr-1" />
                      )}
                      <span className={`text-xs ${expensesTrend.direction === 'up' ? 'text-red-600' : 'text-green-600'}`}>
                        {expensesTrend.direction === 'up' ? '+' : '-'}{expensesTrend.value.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-purple-100 rounded-full">
                    <PiggyBank className="h-6 w-6 text-purple-600" />
                  </div>
                  <div className="flex-1">
                    <div className="text-2xl font-bold text-purple-600">
                      {formatCurrency(currentData.savings)}
                    </div>
                    <div className="text-sm text-muted-foreground">Ahorrado del Mes</div>
                    <div className="flex items-center mt-1">
                      {savingsTrend.direction === 'up' ? (
                        <ArrowUp className="h-3 w-3 text-green-600 mr-1" />
                      ) : (
                        <ArrowDown className="h-3 w-3 text-red-600 mr-1" />
                      )}
                      <span className={`text-xs ${savingsTrend.isPositive ? 'text-green-600' : 'text-red-600'}`}>
                        {savingsTrend.isPositive ? '+' : '-'}{savingsTrend.value.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Financial Timeline Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Evolución Financiera</CardTitle>
              <CardDescription>
                Seguimiento de ingresos, gastos y ahorros durante los últimos 6 meses
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80 flex items-end justify-between space-x-2">
                {mockFinancialData.map((data, index) => (
                  <div key={index} className="flex-1 flex flex-col items-center space-y-2">
                    <div className="relative flex items-end space-x-1 h-60">
                      {/* Income Bar */}
                      <div 
                        className="bg-green-500 rounded-t w-6"
                        style={{ height: `${(data.income / 70) * 100}%` }}
                        title={`Ingresos: ${formatCurrency(data.income)}`}
                      />
                      {/* Expenses Bar */}
                      <div 
                        className="bg-red-500 rounded-t w-6"
                        style={{ height: `${(data.expenses / 70) * 100}%` }}
                        title={`Gastos: ${formatCurrency(data.expenses)}`}
                      />
                      {/* Savings Bar */}
                      <div 
                        className="bg-blue-500 rounded-t w-6"
                        style={{ height: `${(data.savings / 70) * 100}%` }}
                        title={`Ahorros: ${formatCurrency(data.savings)}`}
                      />
                    </div>
                    <div className="text-xs text-center font-medium">{data.period}</div>
                  </div>
                ))}
              </div>
              <div className="flex justify-center space-x-6 mt-4">
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 bg-green-500 rounded"></div>
                  <span className="text-sm">Ingresos</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 bg-red-500 rounded"></div>
                  <span className="text-sm">Gastos</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 bg-blue-500 rounded"></div>
                  <span className="text-sm">Ahorros</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Insights */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Zap className="h-5 w-5 text-yellow-600" />
                  <span>Insights Rápidos</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-3 bg-green-50 rounded-lg">
                  <div className="flex items-start space-x-3">
                    <CheckCircle className="h-5 w-5 text-green-600 mt-1" />
                    <div>
                      <div className="font-medium text-green-700">¡Gran trabajo ahorrando!</div>
                      <div className="text-sm text-green-600">
                        Has ahorrado 25% más que el mes pasado
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="p-3 bg-blue-50 rounded-lg">
                  <div className="flex items-start space-x-3">
                    <Target className="h-5 w-5 text-blue-600 mt-1" />
                    <div>
                      <div className="font-medium text-blue-700">Cerca de tu meta</div>
                      <div className="text-sm text-blue-600">
                        Solo necesitas $15 más para tu Nintendo Switch
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="p-3 bg-orange-50 rounded-lg">
                  <div className="flex items-start space-x-3">
                    <AlertTriangle className="h-5 w-5 text-orange-600 mt-1" />
                    <div>
                      <div className="font-medium text-orange-700">Consejo de gasto</div>
                      <div className="text-sm text-orange-600">
                        Gastas más en entretenimiento que en educación
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Progreso de Metas</CardTitle>
                <CardDescription>
                  Tu progreso general en todas las metas de ahorro
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-purple-600">
                      {savingsProgress.toFixed(1)}%
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Progreso general de metas
                    </div>
                  </div>
                  <Progress value={savingsProgress} className="h-3" />
                  <div className="text-center">
                    <div className="text-lg font-semibold">
                      {formatCurrency(totalSavings)} de {formatCurrency(totalTargets)}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Total ahorrado vs objetivos
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Spending Tab */}
        <TabsContent value="spending" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Análisis de Gastos por Categoría</CardTitle>
              <CardDescription>
                Desglose detallado de dónde gastas tu dinero
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {categorySpending.map((category, index) => (
                  <div key={index} className="flex items-center space-x-4 p-4 rounded-lg border">
                    <div className="text-2xl">{category.icon}</div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">{category.category}</span>
                        <div className="flex items-center space-x-2">
                          <span className="font-bold">{formatCurrency(category.amount)}</span>
                          <Badge variant={
                            category.trend === 'up' ? 'destructive' : 
                            category.trend === 'down' ? 'default' : 'secondary'
                          }>
                            {category.trend === 'up' ? '↑' : category.trend === 'down' ? '↓' : '→'}
                          </Badge>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Progress value={category.percentage} className="h-2" />
                        <div className="text-sm text-muted-foreground">
                          {category.percentage}% del gasto total
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Spending Tips */}
          <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Star className="h-5 w-5 text-blue-600" />
                <span>Consejos Personalizados</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-blue-600 rounded-full mt-2"></div>
                  <div>
                    <div className="font-medium">Optimiza tu entretenimiento</div>
                    <div className="text-sm text-muted-foreground">
                      Considera suscripciones familiares o busca alternativas gratuitas
                    </div>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-blue-600 rounded-full mt-2"></div>
                  <div>
                    <div className="font-medium">Invierte más en educación</div>
                    <div className="text-sm text-muted-foreground">
                      Los libros y cursos son inversiones a largo plazo
                    </div>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-blue-600 rounded-full mt-2"></div>
                  <div>
                    <div className="font-medium">Establece un presupuesto mensual</div>
                    <div className="text-sm text-muted-foreground">
                      Asigna cantidades específicas a cada categoría
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Goals Tab */}
        <TabsContent value="goals" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {savingsGoals.map((goal) => (
              <Card key={goal.id} className={`${goal.onTrack ? 'border-green-200' : 'border-orange-200'}`}>
                <CardHeader>
                  <CardTitle className="text-lg">{goal.title}</CardTitle>
                  <CardDescription>
                    Vence en {goal.daysLeft} días
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between text-sm">
                      <span>Progreso</span>
                      <span>{formatCurrency(goal.current)} / {formatCurrency(goal.target)}</span>
                    </div>
                    <Progress value={(goal.current / goal.target) * 100} className="h-3" />
                    <div className="flex items-center justify-between">
                      <Badge variant={goal.onTrack ? "default" : "destructive"}>
                        {goal.onTrack ? "En camino" : "Necesita impulso"}
                      </Badge>
                      <span className="text-lg font-bold">
                        {((goal.current / goal.target) * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Faltan {formatCurrency(goal.target - goal.current)} para completar
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Achievements Tab */}
        <TabsContent value="achievements" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Logros Recientes</CardTitle>
              <CardDescription>
                Tus últimos logros financieros y educativos
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentAchievements.map((achievement) => (
                  <div key={achievement.id} className="flex items-center space-x-4 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                    <div className="text-3xl">{achievement.icon}</div>
                    <div className="flex-1">
                      <div className="font-semibold text-yellow-800">{achievement.title}</div>
                      <div className="text-sm text-yellow-600 mb-2">{achievement.description}</div>
                      <div className="flex items-center space-x-4 text-xs text-yellow-600">
                        <span>📅 {new Date(achievement.dateAchieved).toLocaleDateString('es-ES')}</span>
                        <span>⭐ +{achievement.points} puntos</span>
                        <Badge variant="outline" className="text-xs">
                          {achievement.category === 'saving' ? 'Ahorro' :
                           achievement.category === 'earning' ? 'Ingresos' :
                           achievement.category === 'learning' ? 'Aprendizaje' : 'Metas'}
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Achievement Statistics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-yellow-600">156</div>
                <div className="text-sm text-muted-foreground">Puntos Totales</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-green-600">8</div>
                <div className="text-sm text-muted-foreground">Logros de Ahorro</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-blue-600">5</div>
                <div className="text-sm text-muted-foreground">Metas Completadas</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-purple-600">12</div>
                <div className="text-sm text-muted-foreground">Días de Racha</div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}



