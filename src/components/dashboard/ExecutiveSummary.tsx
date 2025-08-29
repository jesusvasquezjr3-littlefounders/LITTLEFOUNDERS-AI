import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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
  const isSponsor = userType === 'sponsor';

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
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              {isSponsor ? 'Resumen Ejecutivo - Patrocinador' : 'Resumen Ejecutivo - Padre/Tutor'}
            </h2>
            <p className="text-gray-600 mt-1">
              Resumen de alto nivel del progreso de {childData?.name}
            </p>
          </div>
          <div className="text-right">
            <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${performanceGrade.bg} ${performanceGrade.color}`}>
              <Trophy className="w-4 h-4 mr-2" />
              Calificación: {performanceGrade.grade}
            </div>
          </div>
        </div>
      </div>

      {/* Métricas Clave */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="border-2 border-blue-200 bg-blue-50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center space-x-2">
              <Target className="h-4 w-4 text-blue-600" />
              <span>Progreso General</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-3xl font-bold text-blue-600">{overallProgress}%</span>
                <Badge variant="outline" className="text-blue-600">
                  <ArrowUpRight className="w-3 h-3 mr-1" />
                  +12%
                </Badge>
              </div>
              <Progress value={overallProgress} className="h-2" />
              <p className="text-xs text-muted-foreground">
                Meta general de aprendizaje
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 border-green-200 bg-green-50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center space-x-2">
              <BookOpen className="h-4 w-4 text-green-600" />
              <span>Lecciones Completadas</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-3xl font-bold text-green-600">{childData?.lessons_completed || 0}</span>
                <Badge variant="outline" className="text-green-600">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Total
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {childData?.monthly_progress || 0} este mes
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 border-purple-200 bg-purple-50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center space-x-2">
              <Zap className="h-4 w-4 text-purple-600" />
              <span>Racha de Estudio</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-3xl font-bold text-purple-600">{childData?.current_streak || 0}</span>
                <Badge variant="outline" className="text-purple-600">
                  <Activity className="w-3 h-3 mr-1" />
                  Días
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Días consecutivos estudiando
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 border-yellow-200 bg-yellow-50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center space-x-2">
              <Star className="h-4 w-4 text-yellow-600" />
              <span>Puntos Ganados</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-3xl font-bold text-yellow-600">{childData?.points_earned || 0}</span>
                <Badge variant="outline" className="text-yellow-600">
                  <TrendingUp className="w-3 h-3 mr-1" />
                  Total
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Puntos acumulados
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Análisis de Rendimiento */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <BarChart3 className="h-5 w-5 text-blue-600" />
              <span>Análisis de Rendimiento</span>
            </CardTitle>
            <CardDescription>
              Evaluación integral del progreso educativo
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <BookOpen className="h-4 w-4 text-blue-600" />
                  <div>
                    <p className="text-sm font-medium">Compromiso Académico</p>
                    <p className="text-xs text-muted-foreground">Participación en lecciones</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-blue-600">Excelente</p>
                  <p className="text-xs text-green-600">+25% vs promedio</p>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <Clock className="h-4 w-4 text-green-600" />
                  <div>
                    <p className="text-sm font-medium">Consistencia</p>
                    <p className="text-xs text-muted-foreground">Regularidad en el estudio</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-green-600">Buena</p>
                  <p className="text-xs text-green-600">+18% vs promedio</p>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <Brain className="h-4 w-4 text-purple-600" />
                  <div>
                    <p className="text-sm font-medium">Comprensión</p>
                    <p className="text-xs text-muted-foreground">Asimilación de conceptos</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-purple-600">Excelente</p>
                  <p className="text-xs text-green-600">+32% vs promedio</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <TrendingUp className="h-5 w-5 text-green-600" />
              <span>Proyecciones y Metas</span>
            </CardTitle>
            <CardDescription>
              Estimaciones basadas en el rendimiento actual
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <p className="text-sm font-medium">Meta Anual</p>
                  <p className="text-xs text-muted-foreground">Lecciones completadas</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold">{childData?.yearly_progress || 0} / {childData?.yearly_goal || 100}</p>
                  <p className="text-xs text-green-600">+15% vs meta</p>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <p className="text-sm font-medium">Nivel Esperado</p>
                  <p className="text-xs text-muted-foreground">Para fin de año</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold">Avanzado</p>
                  <p className="text-xs text-blue-600">2 meses antes</p>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <p className="text-sm font-medium">Logros Proyectados</p>
                  <p className="text-xs text-muted-foreground">Para diciembre</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold">15/20</p>
                  <p className="text-xs text-green-600">75% completado</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sección específica para patrocinadores */}
      {isSponsor && (
        <Card className="border-2 border-green-200 bg-green-50">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2 text-green-800">
              <DollarSign className="h-5 w-5" />
              <span>Análisis de Inversión Educativa</span>
            </CardTitle>
            <CardDescription className="text-green-700">
              ROI y valor de la inversión en educación financiera
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-4 bg-white rounded-lg">
                <div className="text-2xl font-bold text-green-600">{roi}%</div>
                <div className="text-sm text-green-700">ROI Educativo</div>
                <div className="text-xs text-green-600 mt-1">Retorno de inversión</div>
              </div>
              
              <div className="text-center p-4 bg-white rounded-lg">
                <div className="text-2xl font-bold text-blue-600">$2,450</div>
                <div className="text-sm text-blue-700">Valor Futuro</div>
                <div className="text-xs text-blue-600 mt-1">Proyección de beneficios</div>
              </div>
              
              <div className="text-center p-4 bg-white rounded-lg">
                <div className="text-2xl font-bold text-purple-600">85%</div>
                <div className="text-sm text-purple-700">Eficiencia</div>
                <div className="text-xs text-purple-600 mt-1">Tasa de aprovechamiento</div>
              </div>
            </div>
            
            <div className="mt-4 p-4 bg-white rounded-lg">
              <h4 className="font-medium text-green-800 mb-2">Beneficios de la Inversión</h4>
              <ul className="text-sm text-green-700 space-y-1">
                <li>• Desarrollo de habilidades financieras desde temprana edad</li>
                <li>• Formación de hábitos de ahorro e inversión</li>
                <li>• Preparación para independencia financiera futura</li>
                <li>• Reducción del riesgo de problemas financieros en la adultez</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recomendaciones */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Lightbulb className="h-5 w-5 text-yellow-600" />
            <span>Recomendaciones Estratégicas</span>
          </CardTitle>
          <CardDescription>
            Acciones recomendadas para optimizar el aprendizaje
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div className="flex items-start space-x-3 p-3 bg-blue-50 rounded-lg">
                <CheckCircle className="h-4 w-4 text-blue-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Mantener el Ritmo Actual</p>
                  <p className="text-xs text-muted-foreground">
                    El progreso es excelente, continuar con la misma dedicación
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3 p-3 bg-green-50 rounded-lg">
                <Target className="h-4 w-4 text-green-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Aumentar Metas Semanales</p>
                  <p className="text-xs text-muted-foreground">
                    Considerar incrementar de 5 a 6 lecciones por semana
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-start space-x-3 p-3 bg-purple-50 rounded-lg">
                <Brain className="h-4 w-4 text-purple-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Explorar Temas Avanzados</p>
                  <p className="text-xs text-muted-foreground">
                    Está listo para conceptos más complejos de inversión
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3 p-3 bg-yellow-50 rounded-lg">
                <Award className="h-4 w-4 text-yellow-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Reconocer Logros</p>
                  <p className="text-xs text-muted-foreground">
                    Celebrar los hitos alcanzados para mantener la motivación
                  </p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
