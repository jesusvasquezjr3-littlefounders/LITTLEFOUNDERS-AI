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
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Eficiencia de Aprendizaje</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold">{calculateLearningEfficiency()}</span>
                <Badge variant="outline" className="text-green-600">
                  <ArrowUpRight className="w-3 h-3 mr-1" />
                  +15%
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">Puntos por minuto</p>
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${performanceLevel.bg}`}></div>
                <span className={`text-xs font-medium ${performanceLevel.color}`}>
                  {performanceLevel.level}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Puntuación de Consistencia</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold">{Math.round(calculateConsistencyScore())}%</span>
                <Badge variant="outline" className="text-blue-600">
                  <Target className="w-3 h-3 mr-1" />
                  Meta
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">Cumplimiento de objetivos</p>
              <Progress value={calculateConsistencyScore()} className="h-2" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Tasa de Crecimiento</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold">+{calculateGrowthRate()}%</span>
                <Badge variant="outline" className="text-green-600">
                  <TrendingUp className="w-3 h-3 mr-1" />
                  Mensual
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">Mejora en rendimiento</p>
              <div className="flex items-center text-xs text-green-600">
                <ArrowUpRight className="w-3 h-3 mr-1" />
                +2.3% vs mes anterior
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Análisis de Racha</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold">{childData?.current_streak || 0}</span>
                <Badge variant="outline" className="text-purple-600">
                  <Zap className="w-3 h-3 mr-1" />
                  Días
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">Días consecutivos</p>
              <div className="flex items-center space-x-2">
                <streakAnalysis.icon className={`w-3 h-3 ${streakAnalysis.status === 'excellent' ? 'text-green-600' : 
                                                   streakAnalysis.status === 'good' ? 'text-blue-600' : 
                                                   streakAnalysis.status === 'average' ? 'text-yellow-600' : 'text-red-600'}`} />
                <span className="text-xs font-medium">{streakAnalysis.message}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Análisis Comparativo */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <BarChart3 className="h-5 w-5 text-blue-600" />
              <span>Comparación con Promedio</span>
            </CardTitle>
            <CardDescription>
              Rendimiento vs otros estudiantes de la misma edad
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <BookOpen className="h-4 w-4 text-blue-600" />
                  <div>
                    <p className="text-sm font-medium">Lecciones Completadas</p>
                    <p className="text-xs text-muted-foreground">Este mes</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold">{childData?.monthly_progress || 15}</p>
                  <div className="flex items-center text-xs text-green-600">
                    <ArrowUpRight className="w-3 h-3 mr-1" />
                    +25% vs promedio
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <Clock className="h-4 w-4 text-green-600" />
                  <div>
                    <p className="text-sm font-medium">Tiempo de Estudio</p>
                    <p className="text-xs text-muted-foreground">Minutos diarios</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold">{Math.round((childData?.minutes_studied || 320) / 30)}</p>
                  <div className="flex items-center text-xs text-green-600">
                    <ArrowUpRight className="w-3 h-3 mr-1" />
                    +18% vs promedio
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <Star className="h-4 w-4 text-yellow-600" />
                  <div>
                    <p className="text-sm font-medium">Puntos Ganados</p>
                    <p className="text-xs text-muted-foreground">Por sesión</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold">{Math.round((childData?.points_earned || 750) / (childData?.lessons_completed || 15))}</p>
                  <div className="flex items-center text-xs text-green-600">
                    <ArrowUpRight className="w-3 h-3 mr-1" />
                    +32% vs promedio
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Brain className="h-5 w-5 text-purple-600" />
              <span>Insights de Aprendizaje</span>
            </CardTitle>
            <CardDescription>
              Análisis de patrones y recomendaciones
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-start space-x-3 p-3 bg-purple-50 rounded-lg">
                <Lightbulb className="h-4 w-4 text-purple-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Mejor Rendimiento en Mañanas</p>
                  <p className="text-xs text-muted-foreground">
                    El 75% de las lecciones completadas fueron entre 9:00 AM y 11:00 AM
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3 p-3 bg-green-50 rounded-lg">
                <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Excelente Comprensión</p>
                  <p className="text-xs text-muted-foreground">
                    Promedio de 92% en evaluaciones de comprensión
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3 p-3 bg-blue-50 rounded-lg">
                <Target className="h-4 w-4 text-blue-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Área de Oportunidad</p>
                  <p className="text-xs text-muted-foreground">
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
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <TrendingUp className="h-5 w-5 text-green-600" />
              <span>Proyecciones</span>
            </CardTitle>
            <CardDescription>
              Estimaciones basadas en el rendimiento actual
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <p className="text-sm font-medium">Lecciones para fin de año</p>
                  <p className="text-xs text-muted-foreground">Proyección anual</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold">85</p>
                  <p className="text-xs text-green-600">+15% vs meta</p>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <p className="text-sm font-medium">Puntos totales proyectados</p>
                  <p className="text-xs text-muted-foreground">Para diciembre</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold">2,450</p>
                  <p className="text-xs text-green-600">+22% vs meta</p>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <p className="text-sm font-medium">Nivel esperado</p>
                  <p className="text-xs text-muted-foreground">Basado en progreso</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold">Avanzado</p>
                  <p className="text-xs text-blue-600">2 meses antes</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Award className="h-5 w-5 text-yellow-600" />
              <span>Próximos Logros</span>
            </CardTitle>
            <CardDescription>
              Logros que están cerca de ser desbloqueados
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center space-x-3 p-3 bg-yellow-50 rounded-lg">
                <Trophy className="h-4 w-4 text-yellow-600" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Estudiante Avanzado</p>
                  <p className="text-xs text-muted-foreground">Completar 20 lecciones</p>
                  <Progress value={75} className="h-1 mt-2" />
                </div>
                <Badge variant="outline">5 más</Badge>
              </div>

              <div className="flex items-center space-x-3 p-3 bg-green-50 rounded-lg">
                <Clock className="h-4 w-4 text-green-600" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Dedicación Constante</p>
                  <p className="text-xs text-muted-foreground">10 días consecutivos</p>
                  <Progress value={70} className="h-1 mt-2" />
                </div>
                <Badge variant="outline">3 más</Badge>
              </div>

              <div className="flex items-center space-x-3 p-3 bg-blue-50 rounded-lg">
                <Star className="h-4 w-4 text-blue-600" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Puntos Dorados</p>
                  <p className="text-xs text-muted-foreground">Ganar 1000 puntos</p>
                  <Progress value={75} className="h-1 mt-2" />
                </div>
                <Badge variant="outline">250 más</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
