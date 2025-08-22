import { useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Wallet, 
  PiggyBank, 
  ShoppingCart, 
  Shield, 
  CreditCard, 
  Target,
  TrendingUp,
  Users,
  Settings,
  Bell,
  Play,
  Pause,
  Lock,
  Unlock,
  Star,
  Gift
} from "lucide-react";

interface Account {
  id: string;
  name: string;
  balance: number;
  percentage: number;
  color: string;
  icon: any;
  description: string;
}

interface SavingsGoal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  deadline: string;
  category: string;
}

interface Task {
  id: string;
  title: string;
  description: string;
  reward: number;
  difficulty: 'easy' | 'medium' | 'hard';
  status: 'available' | 'pending' | 'completed';
  ageRange: string;
}

const Banking = () => {
  const [selectedTab, setSelectedTab] = useState("overview");
  const [cardLocked, setCardLocked] = useState(false);
  
  // Mock data - in real app, this would come from API
  const totalBalance = 125.50;
  const accounts: Account[] = [
    {
      id: "spend",
      name: "Gastar",
      balance: 62.75,
      percentage: 50,
      color: "bg-blue-500",
      icon: ShoppingCart,
      description: "Para compras y gastos diarios"
    },
    {
      id: "save",
      name: "Ahorrar",
      balance: 50.20,
      percentage: 40,
      color: "bg-green-500", 
      icon: PiggyBank,
      description: "Para metas de ahorro a largo plazo"
    },
    {
      id: "emergency",
      name: "Emergencia",
      balance: 12.55,
      percentage: 10,
      color: "bg-red-500",
      icon: Shield,
      description: "Fondo de emergencia"
    }
  ];

  const savingsGoals: SavingsGoal[] = [
    {
      id: "bike",
      name: "Bicicleta Nueva",
      targetAmount: 200,
      currentAmount: 125,
      deadline: "2024-06-15",
      category: "deporte"
    },
    {
      id: "toy",
      name: "Videojuego",
      targetAmount: 60,
      currentAmount: 45,
      deadline: "2024-04-01",
      category: "entretenimiento"
    }
  ];

  const availableTasks: Task[] = [
    {
      id: "clean-room",
      title: "Limpiar mi cuarto",
      description: "Organizar juguetes y hacer la cama",
      reward: 5.00,
      difficulty: 'easy',
      status: 'available',
      ageRange: "6-12"
    },
    {
      id: "wash-dishes",
      title: "Ayudar con los platos",
      description: "Lavar y secar los platos después de la cena",
      reward: 8.00,
      difficulty: 'medium',
      status: 'available',
      ageRange: "8-15"
    },
    {
      id: "homework",
      title: "Completar tarea escolar",
      description: "Terminar toda la tarea y mostrarla a papá/mamá",
      reward: 10.00,
      difficulty: 'medium',
      status: 'pending',
      ageRange: "6-18"
    }
  ];

  const renderAccountOverview = () => (
    <div className="space-y-6">
      {/* Main Account Card */}
      <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardHeader className="text-center pb-2">
          <CardTitle className="flex items-center justify-center gap-2 text-2xl">
            <Wallet className="w-6 h-6" />
            Mi Cuenta Principal
          </CardTitle>
          <div className="text-4xl font-bold text-primary">${totalBalance.toFixed(2)}</div>
          <CardDescription>Balance total disponible</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {accounts.map((account) => (
              <Card key={account.id} className="border border-gray-200 hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className={`p-2 rounded-lg ${account.color}`}>
                        <account.icon className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <div className="font-semibold">{account.name}</div>
                        <div className="text-xs text-muted-foreground">{account.percentage}%</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-lg">${account.balance.toFixed(2)}</div>
                    </div>
                  </div>
                  <Progress value={account.percentage} className="h-2" />
                  <div className="text-xs text-muted-foreground mt-2">{account.description}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="w-5 h-5" />
            Acciones Rápidas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Button variant="outline" className="h-20 flex-col gap-2">
              <Gift className="w-6 h-6" />
              <span className="text-xs">Solicitar Dinero</span>
            </Button>
            <Button variant="outline" className="h-20 flex-col gap-2">
              <Target className="w-6 h-6" />
              <span className="text-xs">Nueva Meta</span>
            </Button>
            <Button variant="outline" className="h-20 flex-col gap-2">
              <Users className="w-6 h-6" />
              <span className="text-xs">Enviar Dinero</span>
            </Button>
            <Button 
              variant="outline" 
              className={`h-20 flex-col gap-2 ${cardLocked ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}
              onClick={() => setCardLocked(!cardLocked)}
            >
              {cardLocked ? <Lock className="w-6 h-6 text-red-600" /> : <Unlock className="w-6 h-6 text-green-600" />}
              <span className="text-xs">{cardLocked ? 'Desbloquear' : 'Bloquear'} Tarjeta</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderTasks = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="w-5 h-5" />
            Tareas Disponibles
          </CardTitle>
          <CardDescription>
            Completa tareas para ganar dinero y desarrollar buenos hábitos
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {availableTasks.map((task) => (
            <Card key={task.id} className="border border-gray-200">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold">{task.title}</h4>
                      <Badge 
                        variant={task.difficulty === 'easy' ? 'secondary' : task.difficulty === 'medium' ? 'outline' : 'destructive'}
                        className="text-xs"
                      >
                        {task.difficulty}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {task.ageRange}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{task.description}</p>
                  </div>
                  <div className="text-right flex flex-col items-end gap-2">
                    <div className="text-lg font-bold text-green-600">+${task.reward.toFixed(2)}</div>
                    <Button 
                      size="sm" 
                      disabled={task.status === 'pending' || task.status === 'completed'}
                      variant={task.status === 'completed' ? 'secondary' : 'default'}
                    >
                      {task.status === 'available' && 'Empezar'}
                      {task.status === 'pending' && 'Pendiente de Aprobación'}
                      {task.status === 'completed' && '✅ Completada'}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </CardContent>
      </Card>
    </div>
  );

  const renderSavingsGoals = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="w-5 h-5" />
            Mis Metas de Ahorro
          </CardTitle>
          <CardDescription>
            Alcanza tus objetivos ahorrando de manera constante
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {savingsGoals.map((goal) => {
            const progress = (goal.currentAmount / goal.targetAmount) * 100;
            return (
              <Card key={goal.id} className="border border-gray-200">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold">{goal.name}</h4>
                    <Badge variant="outline">{goal.category}</Badge>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Progreso</span>
                      <span>${goal.currentAmount} / ${goal.targetAmount}</span>
                    </div>
                    <Progress value={progress} className="h-3" />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{Math.round(progress)}% completado</span>
                      <span>Meta: {new Date(goal.deadline).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <Button size="sm" variant="outline" className="flex-1">
                      Transferir de Gastar
                    </Button>
                    <Button size="sm" className="flex-1">
                      Agregar Dinero
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          
          <Button variant="outline" className="w-full h-16 border-dashed border-2 border-primary/30 hover:border-primary/50">
            <Target className="w-6 h-6 mr-2" />
            Crear Nueva Meta de Ahorro
          </Button>
        </CardContent>
      </Card>
    </div>
  );

  const renderVirtualCard = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            Mi Tarjeta Virtual
          </CardTitle>
          <CardDescription>
            Tarjeta personalizable para compras seguras en línea
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Virtual Card Display */}
          <div className="relative w-full max-w-sm mx-auto">
            <div className="aspect-[1.6/1] bg-gradient-to-br from-purple-600 via-blue-600 to-cyan-600 rounded-2xl p-6 text-white relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-16 translate-x-16"></div>
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full translate-y-12 -translate-x-12"></div>
              
              <div className="relative z-10 h-full flex flex-col justify-between">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="text-sm opacity-80">LITTLEFOUNDERS</div>
                    <div className="text-xs opacity-60">DIGITAL BANKING</div>
                  </div>
                  <div className="w-10 h-6 bg-white/20 rounded"></div>
                </div>
                
                <div className="space-y-2">
                  <div className="text-lg font-mono tracking-wider">
                    •••• •••• •••• 1234
                  </div>
                  <div className="flex justify-between text-xs">
                    <div>
                      <div className="opacity-60">TITULAR</div>
                      <div className="font-semibold">JUAN PÉREZ</div>
                    </div>
                    <div>
                      <div className="opacity-60">VÁLIDA</div>
                      <div className="font-semibold">12/28</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Card Controls */}
          <div className="grid grid-cols-2 gap-4 mt-6">
            <Card className="border border-gray-200">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {cardLocked ? <Lock className="w-5 h-5 text-red-600" /> : <Unlock className="w-5 h-5 text-green-600" />}
                    <span className="font-medium">
                      {cardLocked ? 'Tarjeta Bloqueada' : 'Tarjeta Activa'}
                    </span>
                  </div>
                  <Button 
                    size="sm" 
                    variant={cardLocked ? "destructive" : "default"}
                    onClick={() => setCardLocked(!cardLocked)}
                  >
                    {cardLocked ? 'Desbloquear' : 'Bloquear'}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="border border-gray-200">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Settings className="w-5 h-5" />
                    <span className="font-medium">Personalizar</span>
                  </div>
                  <Button size="sm" variant="outline">
                    Editar
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Transaction Limits */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-lg">Límites de Transacción</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm">Límite diario</span>
                <div className="text-right">
                  <div className="font-semibold">$25.00 / $50.00</div>
                  <div className="text-xs text-muted-foreground">Usado / Límite</div>
                </div>
              </div>
              <Progress value={50} className="h-2" />
              
              <div className="flex justify-between items-center">
                <span className="text-sm">Límite por transacción</span>
                <div className="font-semibold">$15.00</div>
              </div>
            </CardContent>
          </Card>
        </CardContent>
      </Card>
    </div>
  );

  const renderAnalytics = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Panel de Análisis Financiero
          </CardTitle>
          <CardDescription>
            Vista completa de tus hábitos financieros
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Spending by Category */}
            <Card className="border border-gray-200">
              <CardHeader>
                <CardTitle className="text-lg">Gastos por Categoría</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { category: "Entretenimiento", amount: 45, percentage: 35, color: "bg-blue-500" },
                  { category: "Comida", amount: 30, percentage: 25, color: "bg-green-500" },
                  { category: "Juguetes", amount: 25, percentage: 20, color: "bg-purple-500" },
                  { category: "Otros", amount: 20, percentage: 20, color: "bg-gray-500" }
                ].map((item, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${item.color}`}></div>
                      <span className="text-sm">{item.category}</span>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">${item.amount}</div>
                      <div className="text-xs text-muted-foreground">{item.percentage}%</div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Financial Achievements */}
            <Card className="border border-gray-200">
              <CardHeader>
                <CardTitle className="text-lg">Logros Financieros</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { achievement: "Primera Meta Alcanzada", icon: "🎯", unlocked: true },
                  { achievement: "Ahorrador Constante", icon: "💰", unlocked: true },
                  { achievement: "Gastos Inteligentes", icon: "🧠", unlocked: false },
                  { achievement: "Inversor Junior", icon: "📈", unlocked: false }
                ].map((item, index) => (
                  <div key={index} className={`flex items-center gap-3 p-3 rounded-lg ${item.unlocked ? 'bg-green-50 border border-green-200' : 'bg-gray-50 border border-gray-200'}`}>
                    <div className="text-2xl">{item.icon}</div>
                    <div className="flex-1">
                      <div className={`font-medium ${item.unlocked ? 'text-green-800' : 'text-gray-600'}`}>
                        {item.achievement}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {item.unlocked ? 'Desbloqueado' : 'Bloqueado'}
                      </div>
                    </div>
                    {item.unlocked && <Badge className="bg-green-600">✓</Badge>}
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Banca Digital</h1>
            <p className="text-muted-foreground">
              Administra tu dinero, completa tareas y alcanza tus metas
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <Badge variant="outline" className="px-3 py-1">
              <Bell className="w-3 h-3 mr-1" />
              2 Notificaciones
            </Badge>
          </div>
        </div>

        {/* Navigation Tabs */}
        <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 lg:w-fit lg:grid-cols-4">
            <TabsTrigger value="overview">Resumen</TabsTrigger>
            <TabsTrigger value="tasks">Tareas</TabsTrigger>
            <TabsTrigger value="goals">Metas</TabsTrigger>
            <TabsTrigger value="card">Mi Tarjeta</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            {renderAccountOverview()}
          </TabsContent>

          <TabsContent value="tasks" className="space-y-4">
            {renderTasks()}
          </TabsContent>

          <TabsContent value="goals" className="space-y-4">
            {renderSavingsGoals()}
          </TabsContent>

          <TabsContent value="card" className="space-y-4">
            {renderVirtualCard()}
          </TabsContent>

          {/* Analytics hidden for now, will be integrated later */}
          <TabsContent value="analytics" className="space-y-4">
            {renderAnalytics()}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default Banking;