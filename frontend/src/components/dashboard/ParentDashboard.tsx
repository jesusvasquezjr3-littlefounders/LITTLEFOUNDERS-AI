import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProgressCharts } from "./ProgressCharts";
import { AdvancedMetrics } from "./AdvancedMetrics";
import { ExecutiveSummary } from "./ExecutiveSummary";
import { Link } from "react-router-dom";
import {
  BookOpen,
  Clock,
  Star,
  Target,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Award,
  Activity,
  Zap,
  AlertTriangle,
  CheckCircle,
  Lightbulb,
  CreditCard,
  Minus
} from "lucide-react";

interface ChildProgress {
  id: string;
  name: string;
  email: string;
  lessons_completed: number;
  minutes_studied: number;
  points_earned: number;
  current_streak: number;
  weekly_goal: number;
  weekly_progress: number;
  monthly_goal: number;
  monthly_progress: number;
  yearly_goal: number;
  yearly_progress: number;
  last_activity: string;
  favorite_subject: string;
  learning_pace: string;
  achievements_unlocked: number;
  total_achievements: number;
}

interface ParentDashboardProps {
  user: any;
}

export function ParentDashboard({ user }: ParentDashboardProps) {
  const [childData, setChildData] = useState<ChildProgress | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState("week");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Simular carga de datos del niño
    const loadChildData = async () => {
      setIsLoading(true);

      // En un entorno real, esto vendría de una API
      const mockChildData: ChildProgress = {
        id: "child001",
        name: "Carlos González",
        email: "nino@demo.com",
        lessons_completed: 15,
        minutes_studied: 320,
        points_earned: 750,
        current_streak: 7,
        weekly_goal: 5,
        weekly_progress: 4,
        monthly_goal: 20,
        monthly_progress: 15,
        yearly_goal: 100,
        yearly_progress: 15,
        last_activity: "2024-01-15T14:30:00Z",
        favorite_subject: "Ahorro",
        learning_pace: "Rápido",
        achievements_unlocked: 8,
        total_achievements: 12
      };

      setTimeout(() => {
        setChildData(mockChildData);
        setIsLoading(false);
      }, 1000);
    };

    loadChildData();
  }, []);

  const getProgressData = (period: string) => {
    if (!childData) return null;

    const data = {
      day: {
        lessons: 2,
        minutes: 45,
        points: 75,
        change: "+15%"
      },
      week: {
        lessons: childData.weekly_progress,
        minutes: 180,
        points: 320,
        change: "+8%"
      },
      month: {
        lessons: childData.monthly_progress,
        minutes: 720,
        points: 1250,
        change: "+12%"
      },
      year: {
        lessons: childData.yearly_progress,
        minutes: 8640,
        points: 15000,
        change: "+25%"
      }
    };

    return data[period as keyof typeof data];
  };

  const getAchievementProgress = () => {
    if (!childData) return 0;
    return (childData.achievements_unlocked / childData.total_achievements) * 100;
  };

  const getStreakStatus = () => {
    if (!childData) return { status: "neutral", message: "Sin datos" };

    if (childData.current_streak >= 7) {
      return { status: "excellent", message: "¡Excelente racha!" };
    } else if (childData.current_streak >= 3) {
      return { status: "good", message: "¡Buen progreso!" };
    } else {
      return { status: "needs_improvement", message: "Necesita más constancia" };
    }
  };

  const getLearningPaceStatus = () => {
    if (!childData) return { status: "neutral", icon: Minus, color: "text-gray-500" };

    switch (childData.learning_pace) {
      case "Rápido":
        return { status: "fast", icon: TrendingUp, color: "text-green-600" };
      case "Normal":
        return { status: "normal", icon: Minus, color: "text-blue-600" };
      case "Lento":
        return { status: "slow", icon: TrendingDown, color: "text-orange-600" };
      default:
        return { status: "normal", icon: Minus, color: "text-blue-600" };
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!childData) {
    return (
      <div className="text-center py-12">
        <AlertTriangle className="h-12 w-12 text-orange-500 mx-auto mb-4" />
        <h3 className="text-lg font-semibold mb-2">No se encontró información del niño</h3>
        <p className="text-muted-foreground">Verifica la configuración de tu cuenta</p>
      </div>
    );
  }

  const streakStatus = getStreakStatus();
  const learningPaceStatus = getLearningPaceStatus();

  const stats = [
    {
      title: "Lecciones Completadas",
      value: childData.lessons_completed,
      lottieSrc: "https://lottie.host/fd6ae247-34b4-4c56-9b11-f2f3687210a5/ydEAxkmQs0.lottie",
      color: "text-blue-600",
      bgColor: "bg-blue-50",
      description: "Totales"
    },
    {
      title: "Minutos Estudiados",
      value: childData.minutes_studied,
      lottieSrc: "https://lottie.host/1452b96d-4f8d-4b34-b1ed-88a5e16ff3c3/oM0u7NQXQy.lottie",
      color: "text-green-600",
      bgColor: "bg-green-50",
      description: "Tiempo total"
    },
    {
      title: "Puntos Ganados",
      value: childData.points_earned,
      lottieSrc: "https://lottie.host/670784f8-65c7-4b8b-a506-3da5403c7a3f/bpw4bs7R0M.lottie",
      color: "text-yellow-600",
      bgColor: "bg-yellow-50",
      description: "Puntaje total"
    },
    {
      title: "Racha Actual",
      value: childData.current_streak,
      lottieSrc: "https://lottie.host/3edaf8fb-44e9-43da-b623-1836120273cf/9pmK4xn6MU.lottie",
      color: "text-purple-600",
      bgColor: "bg-purple-50",
      description: "Días seguidos"
    }
  ];

  return (
    <div className="space-y-8 p-6">
      {/* Header con información del niño */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="text-center md:text-left">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            {user?.user_type === 'tutor' ? 'Panel de Control - Tutor' :
              user?.user_type === 'sponsor' ? 'Panel de Control - Patrocinador' :
                'Panel de Control'}
          </h1>
          <p className="text-lg text-muted-foreground mt-2">
            Monitoreando el progreso de <span className="font-semibold text-primary">{childData.name}</span>
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <Badge variant="outline" className="px-3 py-1 text-sm">
            <Activity className="w-4 h-4 mr-2" />
            Última actividad: {new Date(childData.last_activity).toLocaleDateString()}
          </Badge>
          <Button variant="outline" className="border-blue-200 hover:bg-blue-50">
            <BarChart3 className="w-4 h-4 mr-2" />
            Exportar Reporte
          </Button>
        </div>
      </div>

      {/* Stats Grid - New Appearance */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, index) => (
          <Card key={index} className="border-2 border-transparent hover:border-primary/20 transition-all overflow-hidden relative shadow-md hover:shadow-xl">
            <CardContent className="p-6">
              <div className="flex flex-col items-center text-center space-y-2 relative z-10">
                <div className={`p-2 rounded-full ${stat.bgColor} mb-2`}>
                  {/* @ts-ignore */}
                  <dotlottie-wc
                    src={stat.lottieSrc}
                    style={{ width: '100px', height: '100px' }}
                    autoplay
                    loop
                  ></dotlottie-wc>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{stat.title}</p>
                  <p className="text-3xl font-bold my-1">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.description}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Explore Features Section for Parents - Added Lemonade Game */}
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-gray-800 px-1">Explora las Funcionalidades del Estudiante 🚀</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Interactive Lessons Card */}
          <Link to="/lecciones" className="group relative overflow-hidden rounded-2xl transition-all duration-300 hover:scale-105 hover:shadow-xl shadow-md border-2 border-transparent hover:border-blue-200">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-400 to-blue-600"></div>
            <div className="relative p-6 flex flex-col items-center justify-center h-48 text-center space-y-3">
              <div className="p-4 bg-white/20 backdrop-blur-sm rounded-full shadow-inner group-hover:scale-110 transition-transform duration-300">
                <BookOpen className="h-10 w-10 text-white" />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-white mb-1">Aprender</h3>
                <p className="text-blue-100 font-medium text-sm">Ver Lecciones</p>
              </div>
            </div>
          </Link>

          {/* Lemonade Stand Card */}
          <Link to="/lemonade-stand" className="group relative overflow-hidden rounded-2xl transition-all duration-300 hover:scale-105 hover:shadow-xl shadow-md border-2 border-transparent hover:border-orange-200">
            <div className="absolute inset-0 bg-gradient-to-br from-orange-400 to-red-500"></div>
            <div className="relative p-6 flex flex-col items-center justify-center h-48 text-center space-y-3">
              <div className="p-4 bg-white/20 backdrop-blur-sm rounded-full shadow-inner group-hover:scale-110 transition-transform duration-300">
                <Lightbulb className="h-10 w-10 text-white" />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-white mb-1">Emprendimiento</h3>
                <p className="text-orange-100 font-medium text-sm">Juego de Limonada</p>
              </div>
            </div>
          </Link>

          {/* Virtual Card Card */}
          <Link to="/growth" className="group relative overflow-hidden rounded-2xl transition-all duration-300 hover:scale-105 hover:shadow-xl shadow-md border-2 border-transparent hover:border-green-200">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-400 to-green-600"></div>
            <div className="relative p-6 flex flex-col items-center justify-center h-48 text-center space-y-3">
              <div className="p-4 bg-white/20 backdrop-blur-sm rounded-full shadow-inner group-hover:scale-110 transition-transform duration-300">
                <CreditCard className="h-10 w-10 text-white" />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-white mb-1">Banca Digital</h3>
                <p className="text-green-100 font-medium text-sm">Tarjeta Virtual</p>
              </div>
            </div>
          </Link>
        </div>
      </div>

      {/* Tabs para diferentes períodos - Parent Specific Functionality */}
      <Tabs value={selectedPeriod} onValueChange={setSelectedPeriod} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 bg-gray-100 p-1 rounded-xl">
          <TabsTrigger value="day" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">Hoy</TabsTrigger>
          <TabsTrigger value="week" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">Esta Semana</TabsTrigger>
          <TabsTrigger value="month" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">Este Mes</TabsTrigger>
          <TabsTrigger value="year" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">Este Año</TabsTrigger>
        </TabsList>

        {["day", "week", "month", "year"].map((period) => {
          const data = getProgressData(period);
          if (!data) return null;

          return (
            <TabsContent key={period} value={period} className="space-y-6">
              {/* Progreso del período seleccionado */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <BookOpen className="h-5 w-5 text-blue-600" />
                      <span>Lecciones</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-2xl font-bold">{data.lessons}</span>
                        <Badge variant="outline" className="text-green-600 bg-green-50">
                          {data.change}
                        </Badge>
                      </div>
                      <Progress value={period === "day" ? 100 : (data.lessons / (period === "week" ? 5 : period === "month" ? 20 : 100)) * 100} className="h-2" />
                      <p className="text-sm text-muted-foreground">
                        {period === "day" ? "Meta diaria completada" :
                          period === "week" ? `${data.lessons} de 5 lecciones semanales` :
                            period === "month" ? `${data.lessons} de 20 lecciones mensuales` :
                              `${data.lessons} de 100 lecciones anuales`}
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <Clock className="h-5 w-5 text-green-600" />
                      <span>Tiempo de Estudio</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-2xl font-bold">{data.minutes} min</span>
                        <Badge variant="outline" className="text-green-600 bg-green-50">
                          {data.change}
                        </Badge>
                      </div>
                      <Progress value={period === "day" ? 90 : period === "week" ? 75 : period === "month" ? 80 : 85} className="h-2" />
                      <p className="text-sm text-muted-foreground">
                        {period === "day" ? "45 de 50 minutos diarios" :
                          period === "week" ? "180 de 240 minutos semanales" :
                            period === "month" ? "720 de 900 minutos mensuales" :
                              "8,640 de 10,800 minutos anuales"}
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <Star className="h-5 w-5 text-yellow-600" />
                      <span>Puntos Ganados</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-2xl font-bold">{data.points}</span>
                        <Badge variant="outline" className="text-green-600 bg-green-50">
                          {data.change}
                        </Badge>
                      </div>
                      <Progress value={period === "day" ? 75 : period === "week" ? 80 : period === "month" ? 85 : 90} className="h-2" />
                      <p className="text-sm text-muted-foreground">
                        {period === "day" ? "75 de 100 puntos diarios" :
                          period === "week" ? "320 de 400 puntos semanales" :
                            period === "month" ? "1,250 de 1,500 puntos mensuales" :
                              "15,000 de 18,000 puntos anuales"}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Gráficos de progreso */}
              <ProgressCharts childData={childData} selectedPeriod={period} />
            </TabsContent>
          );
        })}
      </Tabs>

      {/* Información detallada del niño */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Logros y progreso */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Award className="h-5 w-5 text-yellow-600" />
              <span>Logros y Progreso</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Logros Desbloqueados</span>
                <span className="text-sm text-muted-foreground">
                  {childData.achievements_unlocked} de {childData.total_achievements}
                </span>
              </div>
              <Progress value={getAchievementProgress()} className="h-2" />
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Racha de Estudio</span>
                <Badge variant={streakStatus.status === "excellent" ? "default" :
                  streakStatus.status === "good" ? "secondary" : "destructive"}>
                  {childData.current_streak} días
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">{streakStatus.message}</p>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Ritmo de Aprendizaje</span>
                <div className="flex items-center space-x-2">
                  <learningPaceStatus.icon className={`h-4 w-4 ${learningPaceStatus.color}`} />
                  <span className="text-sm font-medium">{childData.learning_pace}</span>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Materia Favorita</span>
                <Badge variant="outline">{childData.favorite_subject}</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Metas y objetivos */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Target className="h-5 w-5 text-red-600" />
              <span>Metas y Objetivos</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Meta Semanal</span>
                <span className="text-sm text-muted-foreground">
                  {childData.weekly_progress} de {childData.weekly_goal}
                </span>
              </div>
              <Progress value={(childData.weekly_progress / childData.weekly_goal) * 100} className="h-2" />
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Meta Mensual</span>
                <span className="text-sm text-muted-foreground">
                  {childData.monthly_progress} de {childData.monthly_goal}
                </span>
              </div>
              <Progress value={(childData.monthly_progress / childData.monthly_goal) * 100} className="h-2" />
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Meta Anual</span>
                <span className="text-sm text-muted-foreground">
                  {childData.yearly_progress} de {childData.yearly_goal}
                </span>
              </div>
              <Progress value={(childData.yearly_progress / childData.yearly_goal) * 100} className="h-2" />
            </div>

            <div className="pt-4 border-t">
              <h4 className="font-medium mb-3">Próximos Objetivos</h4>
              <div className="space-y-3">
                <div className="flex items-center space-x-3 p-3 bg-blue-50 rounded-lg">
                  <Target className="h-4 w-4 text-blue-600" />
                  <div>
                    <p className="text-sm font-medium">Completar 20 lecciones</p>
                    <p className="text-xs text-muted-foreground">5 lecciones más para alcanzar la meta</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3 p-3 bg-green-50 rounded-lg">
                  <Clock className="h-4 w-4 text-green-600" />
                  <div>
                    <p className="text-sm font-medium">Estudiar 500 minutos</p>
                    <p className="text-xs text-muted-foreground">180 minutos más para alcanzar la meta</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3 p-3 bg-yellow-50 rounded-lg">
                  <Star className="h-4 w-4 text-yellow-600" />
                  <div>
                    <p className="text-sm font-medium">Ganar 1000 puntos</p>
                    <p className="text-xs text-muted-foreground">250 puntos más para alcanzar la meta</p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Resumen Ejecutivo */}
      <ExecutiveSummary childData={childData} userType={user?.user_type} />

      {/* Métricas Avanzadas */}
      <AdvancedMetrics childData={childData} />
    </div>
  );
}
