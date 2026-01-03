import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  TrendingUp,
  TrendingDown,
  Target,
  Clock,
  BookOpen,
  Star,
  Award,
  Brain,
  Zap,
  Calendar,
  BarChart3,
  Lightbulb,
  Trophy,
  CheckCircle,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Minus
} from "lucide-react";

interface AdvancedMetricsProps {
  childData: any;
}

export function AdvancedMetrics({ childData }: AdvancedMetricsProps) {
  // Calcular métricas avanzadas
  const calculateLearningEfficiency = () => {
    const pointsPerMinute = childData?.points_earned / childData?.minutes_studied || 0;
    return pointsPerMinute.toFixed(2);
  };

  const calculateConsistencyScore = () => {
    const weeklyGoal = childData?.weekly_goal || 5;
    const weeklyProgress = childData?.weekly_progress || 4;
    return (weeklyProgress / weeklyGoal) * 100;
  };

  const calculateGrowthRate = () => {
    // Simular tasa de crecimiento basada en datos históricos
    return 12.5; // Porcentaje de crecimiento
  };

  const getPerformanceLevel = () => {
    const efficiency = parseFloat(calculateLearningEfficiency());
    if (efficiency >= 3.0) return { level: "Excelente", color: "text-green-600", bg: "bg-green-100" };
    if (efficiency >= 2.0) return { level: "Bueno", color: "text-blue-600", bg: "bg-blue-100" };
    if (efficiency >= 1.0) return { level: "Promedio", color: "text-yellow-600", bg: "bg-yellow-100" };
    return { level: "Necesita Mejora", color: "text-red-600", bg: "bg-red-100" };
  };

  const getStreakAnalysis = () => {
    const streak = childData?.current_streak || 0;
    if (streak >= 7) return { status: "excellent", message: "¡Racha excepcional!", icon: Trophy };
    if (streak >= 3) return { status: "good", message: "¡Buen hábito de estudio!", icon: CheckCircle };
    if (streak >= 1) return { status: "average", message: "¡Sigue así!", icon: Lightbulb };
    return { status: "needs_improvement", message: "Necesita más constancia", icon: AlertTriangle };
  };

  const performanceLevel = getPerformanceLevel();
  const streakAnalysis = getStreakAnalysis();

  return (
    <div className="space-y-6">
      {/* Métricas de Rendimiento */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="rounded-3xl border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm transition-all hover:shadow-md">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">Eficiencia</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-3xl font-black text-slate-800 dark:text-white">{calculateLearningEfficiency()}</span>
                <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50 dark:bg-green-900/20 dark:border-green-800">
                  <ArrowUpRight className="w-3 h-3 mr-1" />
                  +15%
                </Badge>
              </div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Puntos por minuto</p>
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${performanceLevel.bg}`}></div>
                <span className={`text-xs font-bold ${performanceLevel.color}`}>
                  {performanceLevel.level}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm transition-all hover:shadow-md">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">Consistencia</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-3xl font-black text-slate-800 dark:text-white">{Math.round(calculateConsistencyScore())}%</span>
                <Badge variant="outline" className="text-blue-600 border-blue-200 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-800">
                  <Target className="w-3 h-3 mr-1" />
                  Meta
                </Badge>
              </div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Cumplimiento</p>
              <Progress value={calculateConsistencyScore()} className="h-2 bg-slate-100 dark:bg-slate-800" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm transition-all hover:shadow-md">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">Crecimiento</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-3xl font-black text-slate-800 dark:text-white">+{calculateGrowthRate()}%</span>
                <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50 dark:bg-green-900/20 dark:border-green-800">
                  <TrendingUp className="w-3 h-3 mr-1" />
                  Mensual
                </Badge>
              </div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Mejora continua</p>
              <div className="flex items-center text-xs font-bold text-green-600">
                <ArrowUpRight className="w-3 h-3 mr-1" />
                +2.3% vs mes anterior
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm transition-all hover:shadow-md">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">Racha</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-3xl font-black text-slate-800 dark:text-white">{childData?.current_streak || 0}</span>
                <Badge variant="outline" className="text-purple-600 border-purple-200 bg-purple-50 dark:bg-purple-900/20 dark:border-purple-800">
                  <Zap className="w-3 h-3 mr-1" />
                  Días
                </Badge>
              </div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Días consecutivos</p>
              <div className="flex items-center space-x-2">
                <streakAnalysis.icon className={`w-3 h-3 ${streakAnalysis.status === 'excellent' ? 'text-green-600' :
                  streakAnalysis.status === 'good' ? 'text-blue-600' :
                    streakAnalysis.status === 'average' ? 'text-yellow-600' : 'text-red-600'}`} />
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{streakAnalysis.message}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Análisis Comparativo */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="rounded-3xl border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm transition-all hover:shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <BarChart3 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <span className="text-slate-800 dark:text-white">Comparación con Promedio</span>
            </CardTitle>
            <CardDescription className="text-slate-500 dark:text-slate-400">
              Rendimiento vs otros estudiantes
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/10 rounded-2xl border border-blue-100 dark:border-blue-900/30">
                <div className="flex items-center space-x-3">
                  <BookOpen className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <div>
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Lecciones</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Este mes</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-black text-slate-800 dark:text-white">{childData?.monthly_progress || 15}</p>
                  <div className="flex items-center text-xs font-bold text-green-600">
                    <ArrowUpRight className="w-3 h-3 mr-1" />
                    +25%
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/10 rounded-2xl border border-green-100 dark:border-green-900/30">
                <div className="flex items-center space-x-3">
                  <Clock className="h-4 w-4 text-green-600 dark:text-green-400" />
                  <div>
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Tiempo</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Minutos diarios</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-black text-slate-800 dark:text-white">{Math.round((childData?.minutes_studied || 320) / 30)}</p>
                  <div className="flex items-center text-xs font-bold text-green-600">
                    <ArrowUpRight className="w-3 h-3 mr-1" />
                    +18%
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 bg-yellow-50 dark:bg-yellow-900/10 rounded-2xl border border-yellow-100 dark:border-yellow-900/30">
                <div className="flex items-center space-x-3">
                  <Star className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                  <div>
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Puntos</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Por sesión</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-black text-slate-800 dark:text-white">{Math.round((childData?.points_earned || 750) / (childData?.lessons_completed || 15))}</p>
                  <div className="flex items-center text-xs font-bold text-green-600">
                    <ArrowUpRight className="w-3 h-3 mr-1" />
                    +32%
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm transition-all hover:shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Brain className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              <span className="text-slate-800 dark:text-white">Insights de Aprendizaje</span>
            </CardTitle>
            <CardDescription className="text-slate-500 dark:text-slate-400">
              Análisis de patrones
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-start space-x-3 p-3 bg-purple-50 dark:bg-purple-900/10 rounded-2xl border border-purple-100 dark:border-purple-900/30">
                <Lightbulb className="h-4 w-4 text-purple-600 dark:text-purple-400 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Mejor Rendimiento en Mañanas</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    El 75% de las lecciones completadas fueron entre 9:00 AM y 11:00 AM
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3 p-3 bg-green-50 dark:bg-green-900/10 rounded-2xl border border-green-100 dark:border-green-900/30">
                <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Excelente Comprensión</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Promedio de 92% en evaluaciones de comprensión
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3 p-3 bg-blue-50 dark:bg-blue-900/10 rounded-2xl border border-blue-100 dark:border-blue-900/30">
                <Target className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Área de Oportunidad</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Considera aumentar el tiempo de estudio los fines de semana
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Proyecciones y Metas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="rounded-3xl border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm transition-all hover:shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />
              <span className="text-slate-800 dark:text-white">Proyecciones</span>
            </CardTitle>
            <CardDescription className="text-slate-500 dark:text-slate-400">
              Estimaciones basadas en rendimiento actual
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 border border-slate-100 dark:border-slate-800 dark:bg-slate-950/20 rounded-2xl">
                <div>
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Lecciones (Anual)</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Proyección</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-black text-slate-800 dark:text-white">85</p>
                  <p className="text-xs font-bold text-green-600">+15%</p>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 border border-slate-100 dark:border-slate-800 dark:bg-slate-950/20 rounded-2xl">
                <div>
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Puntos Totales</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Proyección Dic</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-black text-slate-800 dark:text-white">2,450</p>
                  <p className="text-xs font-bold text-green-600">+22%</p>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 border border-slate-100 dark:border-slate-800 dark:bg-slate-950/20 rounded-2xl">
                <div>
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Nivel Esperado</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Basado en progreso</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-black text-slate-800 dark:text-white">Avanzado</p>
                  <p className="text-xs font-bold text-blue-600 dark:text-blue-400">2 meses antes</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm transition-all hover:shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Award className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
              <span className="text-slate-800 dark:text-white">Próximos Logros</span>
            </CardTitle>
            <CardDescription className="text-slate-500 dark:text-slate-400">
              Cerca de desbloquear
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center space-x-3 p-3 bg-yellow-50 dark:bg-yellow-900/10 rounded-2xl border border-yellow-100 dark:border-yellow-900/30">
                <Trophy className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                <div className="flex-1">
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Estudiante Avanzado</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Completar 20 lecciones</p>
                  <Progress value={75} className="h-1.5 mt-2 bg-yellow-200 dark:bg-yellow-900/50" />
                </div>
                <Badge variant="outline" className="border-yellow-200 text-yellow-700 dark:text-yellow-400">5+</Badge>
              </div>

              <div className="flex items-center space-x-3 p-3 bg-green-50 dark:bg-green-900/10 rounded-2xl border border-green-100 dark:border-green-900/30">
                <Clock className="h-4 w-4 text-green-600 dark:text-green-400" />
                <div className="flex-1">
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Dedicación Constante</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">10 días consecutivos</p>
                  <Progress value={70} className="h-1.5 mt-2 bg-green-200 dark:bg-green-900/50" />
                </div>
                <Badge variant="outline" className="border-green-200 text-green-700 dark:text-green-400">3+</Badge>
              </div>

              <div className="flex items-center space-x-3 p-3 bg-blue-50 dark:bg-blue-900/10 rounded-2xl border border-blue-100 dark:border-blue-900/30">
                <Star className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <div className="flex-1">
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Puntos Dorados</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Ganar 1000 puntos</p>
                  <Progress value={75} className="h-1.5 mt-2 bg-blue-200 dark:bg-blue-900/50" />
                </div>
                <Badge variant="outline" className="border-blue-200 text-blue-700 dark:text-blue-400">250+</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
