import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProgressCharts } from "./ProgressCharts";
import { AdvancedMetrics } from "./AdvancedMetrics";
import { ExecutiveSummary } from "./ExecutiveSummary";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
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
  Lightbulb,
  CreditCard,
  Minus,
  Briefcase,
  Users,
  Settings,
  ChevronRight
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
        email: "carlos@demo.com",
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
      return { status: "excellent", message: "¡Racha incendiaria! 🔥" };
    } else if (childData.current_streak >= 3) {
      return { status: "good", message: "¡Buen ritmo! 👍" };
    } else {
      return { status: "needs_improvement", message: "¡A practicar! 📚" };
    }
  };

  const getLearningPaceStatus = () => {
    if (!childData) return { status: "neutral", icon: Minus, color: "text-slate-500" };

    switch (childData.learning_pace) {
      case "Rápido":
        return { status: "fast", icon: TrendingUp, color: "text-green-500" };
      case "Normal":
        return { status: "normal", icon: Minus, color: "text-blue-500" };
      case "Lento":
        return { status: "slow", icon: TrendingDown, color: "text-orange-500" };
      default:
        return { status: "normal", icon: Minus, color: "text-blue-500" };
    }
  };

  if (isLoading) {
    return (
      <div className="p-8 space-y-8 animate-pulse">
        <div className="h-12 bg-slate-200 dark:bg-slate-800 rounded-3xl w-1/3"></div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-40 bg-slate-200 dark:bg-slate-800 rounded-3xl"></div>
          ))}
        </div>
        <div className="h-96 bg-slate-200 dark:bg-slate-800 rounded-3xl"></div>
      </div>
    );
  }

  if (!childData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] p-8 text-center">
        <div className="w-24 h-24 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center mb-6">
          <AlertTriangle className="h-12 w-12 text-orange-500" />
        </div>
        <h3 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">No se encontró información</h3>
        <p className="text-slate-500 dark:text-slate-400">Verifica que tu cuenta esté vinculada correctamente a un estudiante.</p>
      </div>
    );
  }

  const streakStatus = getStreakStatus();
  const learningPaceStatus = getLearningPaceStatus();

  return (
    <div className="space-y-8 p-4 md:p-8 max-w-7xl mx-auto font-sans">

      {/* Header Section */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-slate-800 dark:text-white tracking-tight">
            Hola, Tutor 👋
          </h1>
          <div className="flex items-center gap-2 mt-2 text-slate-500 dark:text-slate-400 font-medium">
            <Users className="w-5 h-5" />
            <span>Viendo progreso de:</span>
            <span className="text-primary font-bold bg-primary/10 px-3 py-1 rounded-full">{childData.name}</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden md:flex flex-col items-end mr-2">
            <span className="text-xs uppercase font-bold text-slate-400 tracking-wider">Última actividad</span>
            <span className="font-bold text-slate-700 dark:text-slate-300">{new Date(childData.last_activity).toLocaleDateString()}</span>
          </div>
          <Button className="rounded-2xl font-bold shadow-[0_4px_0_0_rgba(0,0,0,0.2)] active:translate-y-1 active:shadow-none transition-all" size="lg">
            <BarChart3 className="w-5 h-5 mr-2" />
            Reporte Completo
          </Button>
          <Button variant="outline" size="icon" className="rounded-2xl border-2 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800">
            <Settings className="w-5 h-5 text-slate-500" />
          </Button>
        </div>
      </div>

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">

        {/* Left Column (Main Content) */}
        <div className="xl:col-span-8 space-y-8">

          {/* Quick Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Lecciones */}
            <div className={`bg-white/10 backdrop-blur-sm border-0 rounded-3xl p-5 relative overflow-hidden group ${childData?.lessons_completed === 0 ? 'grayscale opacity-70' : ''}`}>
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <BookOpen className="w-24 h-24 text-blue-500 transform rotate-12 translate-x-4 -translate-y-4" />
              </div>
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center text-blue-600 dark:text-blue-400">
                    <BookOpen className="w-6 h-6" />
                  </div>
                  <span className="font-bold text-slate-600 dark:text-slate-300 uppercase text-xs tracking-wider">Lecciones</span>
                </div>
                <div className="text-4xl font-black text-slate-800 dark:text-white mb-1">{childData.lessons_completed}</div>
                <div className="text-sm font-bold text-blue-500">Completadas</div>
              </div>
            </div>

            {/* Puntos */}
            <div className={`bg-white/10 backdrop-blur-sm border-0 rounded-3xl p-5 relative overflow-hidden group ${childData?.points_earned === 0 ? 'grayscale opacity-70' : ''}`}>
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <Star className="w-24 h-24 text-yellow-500 transform rotate-12 translate-x-4 -translate-y-4" />
              </div>
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-yellow-100 dark:bg-yellow-900/50 flex items-center justify-center text-yellow-600 dark:text-yellow-400">
                    <Star className="w-6 h-6" />
                  </div>
                  <span className="font-bold text-slate-600 dark:text-slate-300 uppercase text-xs tracking-wider">Puntos XP</span>
                </div>
                <div className="text-4xl font-black text-slate-800 dark:text-white mb-1">{childData.points_earned}</div>
                <div className="text-sm font-bold text-yellow-500">Total acumulado</div>
              </div>
            </div>

            {/* Racha */}
            <div className={`bg-white/10 backdrop-blur-sm border-0 rounded-3xl p-5 relative overflow-hidden group ${childData?.current_streak === 0 ? 'grayscale opacity-70' : ''}`}>
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <Zap className="w-24 h-24 text-orange-500 transform rotate-12 translate-x-4 -translate-y-4" />
              </div>
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-orange-100 dark:bg-orange-900/50 flex items-center justify-center text-orange-600 dark:text-orange-400">
                    <Zap className="w-6 h-6" />
                  </div>
                  <span className="font-bold text-slate-600 dark:text-slate-300 uppercase text-xs tracking-wider">Racha</span>
                </div>
                <div className="text-4xl font-black text-slate-800 dark:text-white mb-1">{childData.current_streak}</div>
                <div className="text-sm font-bold text-orange-500">Días seguidos</div>
              </div>
            </div>
          </div>

          {/* Detailed Progress Tabs */}
          <div className="bg-white/10 backdrop-blur-sm border-0 rounded-3xl p-6">
            <Tabs value={selectedPeriod} onValueChange={setSelectedPeriod} className="w-full">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
                <h2 className="text-xl font-extrabold text-slate-800 dark:text-white flex items-center gap-2">
                  <Activity className="w-6 h-6 text-green-500" />
                  Actividad Detallada
                </h2>
                <TabsList className="bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl h-auto">
                  {["day", "week", "month", "year"].map((period) => (
                    <TabsTrigger
                      key={period}
                      value={period}
                      className="rounded-xl px-4 py-2 font-bold text-slate-600 dark:text-slate-400 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:text-primary dark:data-[state=active]:text-white data-[state=active]:shadow-sm transition-all capitalize"
                    >
                      {period === 'day' ? 'Día' : period === 'week' ? 'Semana' : period === 'month' ? 'Mes' : 'Año'}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>

              {/* Tab Content */}
              {["day", "week", "month", "year"].map((period) => {
                const data = getProgressData(period);
                if (!data) return null;
                return (
                  <TabsContent key={period} value={period} className="mt-0 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                      {/* Charts */}
                      <div className="bg-slate-50 dark:bg-slate-950/50 rounded-2xl p-4 border border-slate-100 dark:border-slate-800">
                        <ProgressCharts childData={childData} selectedPeriod={period} />
                      </div>

                      {/* Text Stats */}
                      <div className="space-y-4">
                        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-2xl p-4 flex items-center gap-4 border border-blue-100 dark:border-blue-900/50">
                          <div className="w-12 h-12 bg-white dark:bg-blue-900 rounded-full flex items-center justify-center text-2xl shadow-sm border border-blue-100 dark:border-blue-800">
                            📚
                          </div>
                          <div>
                            <div className="text-2xl font-black text-slate-800 dark:text-white">{data.lessons} Lecciones</div>
                            <div className="text-sm font-medium text-slate-500 dark:text-slate-400">
                              {period === "day" ? "Meta diaria completada" :
                                period === "week" ? `${data.lessons} de 5 lecciones meta` :
                                  `${data.lessons} lecciones completadas`}
                            </div>
                          </div>
                        </div>

                        <div className="bg-green-50 dark:bg-green-900/20 rounded-2xl p-4 flex items-center gap-4 border border-green-100 dark:border-green-900/50">
                          <div className="w-12 h-12 bg-white dark:bg-green-900 rounded-full flex items-center justify-center text-2xl shadow-sm border border-green-100 dark:border-green-800">
                            ⏱️
                          </div>
                          <div>
                            <div className="text-2xl font-black text-slate-800 dark:text-white">{data.minutes} Minutos</div>
                            <div className="text-sm font-medium text-slate-500 dark:text-slate-400">
                              Tiempo total de estudio
                            </div>
                          </div>
                        </div>

                        <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-2xl p-4 flex items-center gap-4 border border-yellow-100 dark:border-yellow-900/50">
                          <div className="w-12 h-12 bg-white dark:bg-yellow-900 rounded-full flex items-center justify-center text-2xl shadow-sm border border-yellow-100 dark:border-yellow-800">
                            🌟
                          </div>
                          <div>
                            <div className="text-2xl font-black text-slate-800 dark:text-white">{data.points} Puntos</div>
                            <div className="text-sm font-medium text-slate-500 dark:text-slate-400">
                              XP ganado en este periodo
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </TabsContent>
                );
              })}
            </Tabs>
          </div>

          {/* Student Features Shortcut */}
          <div className="pt-4">
            <h3 className="text-xl font-extrabold text-slate-800 dark:text-white mb-4 px-1">
              Explora lo que ven tus hijos 🚀
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Link to="/lecciones" className="group bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 rounded-3xl p-1 shadow-sm hover:shadow-[0_6px_0_0_rgba(0,0,0,0.1)] hover:-translate-y-1 transition-all">
                <div className="bg-blue-500 rounded-2xl p-4 h-full flex flex-col items-center text-center justify-center gap-2 group-hover:bg-blue-600 transition-colors">
                  <BookOpen className="text-white w-8 h-8" />
                  <span className="font-bold text-white text-lg">Aprender</span>
                </div>
              </Link>
              <Link to="/lemonade-stand" className="group bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 rounded-3xl p-1 shadow-sm hover:shadow-[0_6px_0_0_rgba(0,0,0,0.1)] hover:-translate-y-1 transition-all">
                <div className="bg-orange-500 rounded-2xl p-4 h-full flex flex-col items-center text-center justify-center gap-2 group-hover:bg-orange-600 transition-colors">
                  <Lightbulb className="text-white w-8 h-8" />
                  <span className="font-bold text-white text-lg">Emprender</span>
                </div>
              </Link>
              <Link to="/growth" className="group bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 rounded-3xl p-1 shadow-sm hover:shadow-[0_6px_0_0_rgba(0,0,0,0.1)] hover:-translate-y-1 transition-all">
                <div className="bg-green-500 rounded-2xl p-4 h-full flex flex-col items-center text-center justify-center gap-2 group-hover:bg-green-600 transition-colors">
                  <CreditCard className="text-white w-8 h-8" />
                  <span className="font-bold text-white text-lg">Banca</span>
                </div>
              </Link>
            </div>
          </div>
        </div>

        {/* Right Column (Side Panel) */}
        <div className="xl:col-span-4 space-y-6">

          {/* Card: Metas */}
          <div className="bg-white/10 backdrop-blur-sm border-0 rounded-3xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-extrabold text-slate-800 dark:text-white text-lg flex items-center gap-2">
                <Target className="w-5 h-5 text-red-500" />
                Metas
              </h3>
              <Badge className="bg-red-100 text-red-600 hover:bg-red-200 border-transparent">
                Mensual
              </Badge>
            </div>

            <div className="space-y-6">
              <div>
                <div className="flex justify-between text-sm font-bold mb-2">
                  <span className="text-slate-600 dark:text-slate-400">Lecciones</span>
                  <span className="text-slate-800 dark:text-white">{childData.monthly_progress}/{childData.monthly_goal}</span>
                </div>
                <Progress value={(childData.monthly_progress / childData.monthly_goal) * 100} className="h-3 rounded-full bg-slate-100 dark:bg-slate-800 [&>div]:bg-red-500" />
              </div>

              <div>
                <div className="flex justify-between text-sm font-bold mb-2">
                  <span className="text-slate-600 dark:text-slate-400">Logros</span>
                  <span className="text-slate-800 dark:text-white">{childData.achievements_unlocked}/{childData.total_achievements}</span>
                </div>
                <Progress value={getAchievementProgress()} className="h-3 rounded-full bg-slate-100 dark:bg-slate-800 [&>div]:bg-yellow-400" />
              </div>
            </div>

            <Button variant="ghost" className="w-full mt-4 text-slate-500 hover:text-primary hover:bg-slate-50 dark:hover:bg-slate-800 font-bold justify-between group">
              Ver todas las metas
              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Button>
          </div>

          {/* Card: Perfil Aprendizaje */}
          <div className="bg-white/10 backdrop-blur-sm border-0 rounded-3xl p-6">
            <h3 className="font-extrabold text-slate-800 dark:text-white text-lg flex items-center gap-2 mb-6">
              <Briefcase className="w-5 h-5 text-purple-500" />
              Perfil de Estudiante
            </h3>

            <div className="space-y-4">
              <div className="flex items-center gap-4 p-3 rounded-2xl bg-purple-50 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-900/50">
                <div className="w-10 h-10 rounded-full bg-purple-200 dark:bg-purple-800 flex items-center justify-center text-purple-700 dark:text-purple-300 font-bold">
                  <Star className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Materia Favorita</div>
                  <div className="font-bold text-slate-800 dark:text-white">{childData.favorite_subject}</div>
                </div>
              </div>

              <div className="flex items-center gap-4 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 font-bold">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Ritmo</div>
                  <div className="font-bold text-slate-800 dark:text-white">{childData.learning_pace}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Call to Action Card */}
          <div className="bg-gradient-to-br from-primary to-primary-foreground dark:from-primary/20 dark:to-primary/10 rounded-3xl p-6 text-center border-2 border-primary/20 dark:border-primary/50 relative overflow-hidden">
            <div className="relative z-10">
              <Award className="w-12 h-12 text-primary mx-auto mb-4" />
              <h3 className="font-extrabold text-lg text-slate-800 dark:text-white mb-2">¡Celebra sus logros!</h3>
              <p className="text-sm text-slate-600 dark:text-slate-300 mb-4 px-2">
                Carlos ha tenido una excelente semana. ¿Por qué no enviarle una recompensa?
              </p>
              <Button className="w-full rounded-xl font-bold shadow-lg" variant="default">
                Enviar Recompensa
              </Button>
            </div>
          </div>

        </div>
      </div>

      {/* Footer / Additional Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
          <ExecutiveSummary childData={childData} userType={user?.user_type} />
        </div>
        <div className="bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
          <AdvancedMetrics childData={childData} />
        </div>
      </div>

    </div>
  );
}
