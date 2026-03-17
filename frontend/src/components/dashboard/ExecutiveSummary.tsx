import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { GlassPanel } from "@/components/ui/GlassPanel";
import {
  TrendingUp,
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
  DollarSign,
  Users,
  Activity
} from "lucide-react";

interface ExecutiveSummaryProps {
  childData: any;
  userType: string;
}

export function ExecutiveSummary({ childData, userType }: ExecutiveSummaryProps) {

  // Calcular métricas clave para el resumen ejecutivo
  const calculateOverallProgress = () => {
    const weeklyProgress = (childData?.weekly_progress / childData?.weekly_goal) * 100 || 0;
    const monthlyProgress = (childData?.monthly_progress / childData?.monthly_goal) * 100 || 0;
    const yearlyProgress = (childData?.yearly_progress / childData?.yearly_goal) * 100 || 0;

    return Math.round((weeklyProgress + monthlyProgress + yearlyProgress) / 3);
  };

  const getPerformanceGrade = () => {
    const progress = calculateOverallProgress();
    if (progress >= 90) return { grade: "A+", color: "text-green-600", bg: "bg-green-100" };
    if (progress >= 80) return { grade: "A", color: "text-green-600", bg: "bg-green-100" };
    if (progress >= 70) return { grade: "B+", color: "text-blue-600", bg: "bg-blue-100" };
    if (progress >= 60) return { grade: "B", color: "text-blue-600", bg: "bg-blue-100" };
    if (progress >= 50) return { grade: "C+", color: "text-yellow-600", bg: "bg-yellow-100" };
    return { grade: "C", color: "text-orange-600", bg: "bg-orange-100" };
  };

  const getROI = () => {
    // Simular ROI basado en el progreso educativo
    const baseROI = 150; // ROI base del 150%
    const progressBonus = calculateOverallProgress() * 2; // Bonus por progreso
    return baseROI + progressBonus;
  };

  const performanceGrade = getPerformanceGrade();
  const overallProgress = calculateOverallProgress();
  const roi = getROI();

  return (
    <div className="space-y-6">
      {/* Header del Resumen Ejecutivo */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border border-blue-200 dark:border-blue-900/50 rounded-3xl p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-black text-slate-800 dark:text-white">
              Resumen Ejecutivo - Padre/Tutor
            </h2>
            <p className="text-slate-600 dark:text-slate-400 mt-1 font-medium">
              Resumen de alto nivel del progreso de {childData?.name}
            </p>
          </div>
          <div className="text-right">
            <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-bold shadow-sm border border-transparent ${performanceGrade.bg} ${performanceGrade.color} dark:bg-opacity-20`}>
              <Trophy className="w-4 h-4 mr-2" />
              Calificación: {performanceGrade.grade}
            </div>
          </div>
        </div>
      </div>

      {/* Métricas Clave */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <GlassPanel variant="default" className="rounded-3xl border-2 border-blue-200 dark:border-blue-900/30 shadow-sm transition-all hover:shadow-md">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold flex items-center space-x-2 text-blue-700 dark:text-blue-300 uppercase tracking-wide">
              <Target className="h-4 w-4" />
              <span>Progreso General</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-3xl font-black text-blue-600 dark:text-blue-400">{overallProgress}%</span>
                <Badge variant="outline" className="text-blue-600 border-blue-200 dark:border-blue-800 dark:bg-blue-900/50">
                  <ArrowUpRight className="w-3 h-3 mr-1" />
                  +12%
                </Badge>
              </div>
              <Progress value={overallProgress} className="h-2 bg-blue-200 dark:bg-blue-900/50" />
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Meta general de aprendizaje
              </p>
            </div>
          </CardContent>
        </GlassPanel>

        <GlassPanel variant="default" className="rounded-3xl border-2 border-green-200 dark:border-green-900/30 shadow-sm transition-all hover:shadow-md">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold flex items-center space-x-2 text-green-700 dark:text-green-300 uppercase tracking-wide">
              <BookOpen className="h-4 w-4" />
              <span>Lecciones</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-3xl font-black text-green-600 dark:text-green-400">{childData?.lessons_completed || 0}</span>
                <Badge variant="outline" className="text-green-600 border-green-200 dark:border-green-800 dark:bg-green-900/50">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Total
                </Badge>
              </div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                {childData?.monthly_progress || 0} este mes
              </p>
            </div>
          </CardContent>
        </GlassPanel>

        <GlassPanel variant="default" className="rounded-3xl border-2 border-purple-200 dark:border-purple-900/30 shadow-sm transition-all hover:shadow-md">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold flex items-center space-x-2 text-purple-700 dark:text-purple-300 uppercase tracking-wide">
              <Zap className="h-4 w-4" />
              <span>Racha</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-3xl font-black text-purple-600 dark:text-purple-400">{childData?.current_streak || 0}</span>
                <Badge variant="outline" className="text-purple-600 border-purple-200 dark:border-purple-800 dark:bg-purple-900/50">
                  <Activity className="w-3 h-3 mr-1" />
                  Días
                </Badge>
              </div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Días consecutivos estudiando
              </p>
            </div>
          </CardContent>
        </GlassPanel>

        <GlassPanel variant="default" className="rounded-3xl border-2 border-yellow-200 dark:border-yellow-900/30 shadow-sm transition-all hover:shadow-md">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold flex items-center space-x-2 text-yellow-700 dark:text-yellow-400 uppercase tracking-wide">
              <Star className="h-4 w-4" />
              <span>Puntos</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-3xl font-black text-yellow-600 dark:text-yellow-400">{childData?.points_earned || 0}</span>
                <Badge variant="outline" className="text-yellow-600 border-yellow-200 dark:border-yellow-800 dark:bg-yellow-900/50">
                  <TrendingUp className="w-3 h-3 mr-1" />
                  Total
                </Badge>
              </div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Puntos acumulados
              </p>
            </div>
          </CardContent>
        </GlassPanel>
      </div>

      {/* Análisis de Rendimiento */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <GlassPanel variant="default" className="rounded-3xl border-2 border-slate-200 dark:border-slate-800 shadow-sm transition-all hover:shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <BarChart3 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <span className="text-slate-800 dark:text-white">Análisis de Rendimiento</span>
            </CardTitle>
            <CardDescription className="text-slate-500 dark:text-slate-400">
              Evaluación integral del progreso
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/10 rounded-2xl border border-blue-100 dark:border-blue-900/30">
                <div className="flex items-center space-x-3">
                  <BookOpen className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <div>
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Compromiso Académico</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Participación</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-black text-blue-600 dark:text-blue-400">Excelente</p>
                  <p className="text-xs font-bold text-green-600">+25% promedio</p>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/10 rounded-2xl border border-green-100 dark:border-green-900/30">
                <div className="flex items-center space-x-3">
                  <Clock className="h-4 w-4 text-green-600 dark:text-green-400" />
                  <div>
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Consistencia</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Regularidad</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-black text-green-600 dark:text-green-400">Buena</p>
                  <p className="text-xs font-bold text-green-600">+18% promedio</p>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 bg-purple-50 dark:bg-purple-900/10 rounded-2xl border border-purple-100 dark:border-purple-900/30">
                <div className="flex items-center space-x-3">
                  <Brain className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                  <div>
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Comprensión</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Asimilación</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-black text-purple-600 dark:text-purple-400">Excelente</p>
                  <p className="text-xs font-bold text-green-600">+32% promedio</p>
                </div>
              </div>
            </div>
          </CardContent>
        </GlassPanel>

        <GlassPanel variant="default" className="rounded-3xl border-2 border-slate-200 dark:border-slate-800 shadow-sm transition-all hover:shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />
              <span className="text-slate-800 dark:text-white">Proyecciones y Metas</span>
            </CardTitle>
            <CardDescription className="text-slate-500 dark:text-slate-400">
              Estimaciones futuras
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 border border-slate-100 dark:border-slate-800 dark:bg-slate-950/20 rounded-2xl">
                <div>
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Meta Anual</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Lecciones</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-black text-slate-800 dark:text-white">{childData?.yearly_progress || 0} / {childData?.yearly_goal || 100}</p>
                  <p className="text-xs font-bold text-green-600">+15% vs meta</p>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 border border-slate-100 dark:border-slate-800 dark:bg-slate-950/20 rounded-2xl">
                <div>
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Nivel Esperado</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Fin de año</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-black text-slate-800 dark:text-white">Avanzado</p>
                  <p className="text-xs font-bold text-blue-600 dark:text-blue-400">2 meses antes</p>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 border border-slate-100 dark:border-slate-800 dark:bg-slate-950/20 rounded-2xl">
                <div>
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Logros Proyectados</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Diciembre</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-black text-slate-800 dark:text-white">15/20</p>
                  <p className="text-xs font-bold text-green-600">75% complete</p>
                </div>
              </div>
            </div>
          </CardContent>
        </GlassPanel>
      </div>

      {/* Recomendaciones */}
      <GlassPanel variant="default" className="rounded-3xl border-2 border-slate-200 dark:border-slate-800 shadow-sm transition-all hover:shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Lightbulb className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
            <span className="text-slate-800 dark:text-white">Recomendaciones Estratégicas</span>
          </CardTitle>
          <CardDescription className="text-slate-500 dark:text-slate-400">
            Acciones recomendadas
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div className="flex items-start space-x-3 p-3 bg-blue-50 dark:bg-blue-900/10 rounded-2xl border border-blue-100 dark:border-blue-900/30">
                <CheckCircle className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Mantener el Ritmo Actual</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    El progreso es excelente, continuar con la misma dedicación
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3 p-3 bg-green-50 dark:bg-green-900/10 rounded-2xl border border-green-100 dark:border-green-900/10">
                <Target className="h-4 w-4 text-green-600 dark:text-green-400 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Aumentar Metas Semanales</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Considerar incrementar de 5 a 6 lecciones por semana
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-start space-x-3 p-3 bg-purple-50 dark:bg-purple-900/10 rounded-2xl border border-purple-100 dark:border-purple-900/30">
                <Brain className="h-4 w-4 text-purple-600 dark:text-purple-400 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Explorar Temas Avanzados</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Está listo para conceptos más complejos de inversión
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3 p-3 bg-yellow-50 dark:bg-yellow-900/10 rounded-2xl border border-yellow-100 dark:border-yellow-900/30">
                <Award className="h-4 w-4 text-yellow-600 dark:text-yellow-400 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Reconocer Logros</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Celebrar los hitos alcanzados para mantener la motivación
                  </p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </GlassPanel>
    </div>
  );
}
