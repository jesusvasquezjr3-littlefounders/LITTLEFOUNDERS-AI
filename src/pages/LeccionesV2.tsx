import { useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import LessonPlayer from "@/components/lessons_framework/LessonPlayer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Search, 
  Users, 
  Package, 
  Star, 
  Clock,
  PlayCircle,
  CheckCircle,
  Lock,
  Trophy,
  Coins,
  ShoppingCart,
  PiggyBank,
  Building,
  Calendar,
  BarChart3,
  Calculator,
  Target,
  Briefcase,
  CreditCard,
  TrendingUp,
  AlertTriangle,
  Home,
  Shield
} from "lucide-react";

interface Module {
  id: string;
  title: string;
  description: string;
  duration: string;
  difficulty: "Fácil" | "Intermedio" | "Avanzado";
  progress: number;
  completed: boolean;
  locked: boolean;
  icon: any;
  activities: string[];
}

interface Level {
  id: string;
  title: string;
  ageRange: string;
  description: string;
  cognitiveApproach: string;
  modules: Module[];
  sublevels: string[];
}

interface AgeRange {
  id: string;
  label: string;
  description: string;
  icon: any;
}

const LeccionesV2 = () => {
  const [showInteractiveLessons, setShowInteractiveLessons] = useState(false);
  const [selectedLevel, setSelectedLevel] = useState<string>("nivel-1");
  const [selectedAgeRange, setSelectedAgeRange] = useState<string>("8-10");
  const [userProgress, setUserProgress] = useState<any[]>([]);

  // Definir los rangos de edad disponibles
  const ageRanges: AgeRange[] = [
    {
      id: "8-10",
      label: "8-10 años",
      description: "Exploradores Financieros - Conceptos básicos y actividades interactivas",
      icon: Calendar
    },
    {
      id: "11-13",
      label: "11-13 años", 
      description: "Administradores Junior - Conceptos intermedios y planificación",
      icon: Calendar
    },
    {
      id: "14-16",
      label: "14-16 años",
      description: "Financieros Avanzados - Planificación, crédito, inversiones y vida independiente",
      icon: Calendar
    }
  ];

  // Función para obtener los niveles según el rango de edad seleccionado
  const getLevelsByAgeRange = (ageRange: string): Level[] => {
    switch (ageRange) {
      case "8-10":
        return [
          {
            id: "nivel-1",
            title: "Exploradores Financieros",
            ageRange: "7-8 años",
            description: "Introducción al dinero y conceptos básicos",
            cognitiveApproach: "Aprendizaje a través de juegos y actividades visuales",
            sublevels: ["Dinero Básico", "Tareas y Recompensas", "Ahorro Inicial"],
            modules: [
              {
                id: "modulo-1",
                title: "¿Qué es el Dinero?",
                description: "Descubre qué es el dinero y cómo reconocer monedas y billetes",
                duration: "30 min",
                difficulty: "Fácil",
                progress: 0,
                completed: false,
                locked: false,
                icon: Coins,
                activities: ["Reconocimiento de monedas", "Juego de cambio", "Dibujo de billetes"]
              },
              {
                id: "modulo-2",
                title: "De Dónde Viene el Dinero",
                description: "Aprende sobre el trabajo y cómo las personas ganan dinero",
                duration: "25 min",
                difficulty: "Fácil",
                progress: 0,
                completed: false,
                locked: true,
                icon: Briefcase,
                activities: ["Simulación de trabajos", "Historia del dinero", "Actividad de roles"]
              },
              {
                id: "modulo-3",
                title: "Necesidades vs Deseos",
                description: "Distingue entre lo que necesitas y lo que quieres",
                duration: "35 min",
                difficulty: "Fácil",
                progress: 0,
                completed: false,
                locked: true,
                icon: ShoppingCart,
                activities: ["Clasificación de necesidades", "Juego de decisiones", "Lista de deseos"]
              }
            ]
          },
          {
            id: "nivel-2",
            title: "Pequeños Ahorradores",
            ageRange: "9-10 años",
            description: "Conceptos de ahorro y planificación básica",
            cognitiveApproach: "Aprendizaje práctico con metas y recompensas",
            sublevels: ["Primeros Ahorros", "Metas Financieras", "Decisiones Inteligentes"],
            modules: [
              {
                id: "modulo-4",
                title: "Tareas y Mesada",
                description: "Aprende sobre responsabilidades y recompensas",
                duration: "40 min",
                difficulty: "Fácil",
                progress: 0,
                completed: false,
                locked: true,
                icon: Trophy,
                activities: ["Lista de tareas", "Sistema de puntos", "Calculadora de mesada"]
              },
              {
                id: "modulo-5",
                title: "¿Qué es un Banco?",
                description: "Introducción a los bancos y servicios financieros",
                duration: "35 min",
                difficulty: "Fácil",
                progress: 0,
                completed: false,
                locked: true,
                icon: Building,
                activities: ["Visita virtual al banco", "Juego de cajero", "Simulación de depósito"]
              },
              {
                id: "modulo-6",
                title: "Mi Primera Cuenta de Ahorros",
                description: "Aprende sobre cuentas de ahorro y cómo funcionan",
                duration: "30 min",
                difficulty: "Fácil",
                progress: 0,
                completed: false,
                locked: true,
                icon: PiggyBank,
                activities: ["Crear cuenta virtual", "Simulación de depósitos", "Cálculo de intereses"]
              }
            ]
          }
        ];
      case "11-13":
        return [
          {
            id: "nivel-3",
            title: "Administradores Junior",
            ageRange: "11-12 años",
            description: "Planificación financiera y toma de decisiones",
            cognitiveApproach: "Aprendizaje basado en proyectos y casos reales",
            sublevels: ["Planificación Básica", "Presupuestos", "Inversiones Iniciales"],
            modules: [
              {
                id: "modulo-7",
                title: "Planificación Financiera",
                description: "Aprende a planificar tus finanzas personales",
                duration: "45 min",
                difficulty: "Intermedio",
                progress: 0,
                completed: false,
                locked: false,
                icon: Target,
                activities: ["Crear presupuesto", "Establecer metas", "Seguimiento de gastos"]
              },
              {
                id: "modulo-8",
                title: "Ingresos y Trabajos",
                description: "Explora diferentes formas de generar ingresos",
                duration: "40 min",
                difficulty: "Intermedio",
                progress: 0,
                completed: false,
                locked: true,
                icon: Briefcase,
                activities: ["Simulación de trabajos", "Cálculo de ingresos", "Plan de carrera"]
              }
            ]
          }
        ];
      case "14-16":
        return [
          {
            id: "nivel-4",
            title: "Financieros Avanzados",
            ageRange: "14-16 años",
            description: "Conceptos avanzados de finanzas personales",
            cognitiveApproach: "Aprendizaje crítico y análisis de casos complejos",
            sublevels: ["Crédito y Deuda", "Inversiones", "Vida Independiente"],
            modules: [
              {
                id: "modulo-9",
                title: "¿Qué es el Crédito?",
                description: "Comprende el concepto de crédito y cómo usarlo responsablemente",
                duration: "50 min",
                difficulty: "Avanzado",
                progress: 0,
                completed: false,
                locked: false,
                icon: CreditCard,
                activities: ["Simulación de crédito", "Cálculo de intereses", "Análisis de historial"]
              },
              {
                id: "modulo-10",
                title: "Historial Crediticio",
                description: "Aprende sobre la importancia del historial crediticio",
                duration: "45 min",
                difficulty: "Avanzado",
                progress: 0,
                completed: false,
                locked: true,
                icon: BarChart3,
                activities: ["Simulación de historial", "Análisis de reportes", "Mejora de puntaje"]
              },
              {
                id: "modulo-11",
                title: "¿Qué son las Inversiones?",
                description: "Introducción al mundo de las inversiones",
                duration: "55 min",
                difficulty: "Avanzado",
                progress: 0,
                completed: false,
                locked: true,
                icon: TrendingUp,
                activities: ["Simulador de inversiones", "Análisis de riesgo", "Portafolio virtual"]
              },
              {
                id: "modulo-12",
                title: "Riesgo y Rendimiento",
                description: "Comprende la relación entre riesgo y rendimiento",
                duration: "50 min",
                difficulty: "Avanzado",
                progress: 0,
                completed: false,
                locked: true,
                icon: AlertTriangle,
                activities: ["Análisis de riesgo", "Simulación de escenarios", "Optimización de portafolio"]
              },
              {
                id: "modulo-13",
                title: "Costos de Vida Independiente",
                description: "Preparación para la vida independiente",
                duration: "60 min",
                difficulty: "Avanzado",
                progress: 0,
                completed: false,
                locked: true,
                icon: Home,
                activities: ["Presupuesto de vida independiente", "Cálculo de costos", "Planificación financiera"]
              },
              {
                id: "modulo-14",
                title: "Seguros y Protección",
                description: "Importancia de los seguros en la planificación financiera",
                duration: "45 min",
                difficulty: "Avanzado",
                progress: 0,
                completed: false,
                locked: true,
                icon: Shield,
                activities: ["Tipos de seguros", "Cálculo de primas", "Evaluación de necesidades"]
              }
            ]
          }
        ];
      default:
        return [];
    }
  };

  const levels = getLevelsByAgeRange(selectedAgeRange);

  const handleStartLessons = () => {
    setShowInteractiveLessons(true);
  };

  const handleProgressUpdate = (progress: any) => {
    setUserProgress(prev => {
      const filtered = prev.filter(p => p.lessonId !== progress.lessonId);
      return [...filtered, progress];
    });
  };

  // Si se activan las lecciones interactivas, mostrar el nuevo sistema
  if (showInteractiveLessons) {
    return (
      <DashboardLayout>
        <LessonPlayer
          ageRange={selectedAgeRange}
          onExit={() => setShowInteractiveLessons(false)}
          userProgress={userProgress}
          onProgressUpdate={handleProgressUpdate}
        />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Lecciones V.2 (framework)</h1>
            <p className="text-gray-600 mt-2">Framework científico de B. Douglas Bernheim - Competencia deliberativa</p>
          </div>
          <div className="flex items-center space-x-4">
            <Badge variant="secondary" className="text-sm">
              <Star className="w-4 h-4 mr-1" />
              Framework Científico
            </Badge>
          </div>
        </div>

        {/* Age Range Selector */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Users className="w-5 h-5 mr-2" />
              Selecciona tu Rango de Edad
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {ageRanges.map((range) => (
                <Card
                  key={range.id}
                  className={`cursor-pointer transition-all duration-200 hover:shadow-md ${
                    selectedAgeRange === range.id
                      ? "ring-2 ring-primary bg-primary/5"
                      : "hover:bg-gray-50"
                  }`}
                  onClick={() => setSelectedAgeRange(range.id)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-3">
                      <range.icon className="w-8 h-8 text-primary" />
                      <div>
                        <h3 className="font-semibold text-lg">{range.label}</h3>
                        <p className="text-sm text-gray-600 mt-1">{range.description}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Levels and Modules */}
        <div className="space-y-6">
          {levels.map((level) => (
            <Card key={level.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-xl">{level.title}</CardTitle>
                    <p className="text-gray-600 mt-1">{level.description}</p>
                    <p className="text-sm text-blue-600 mt-2">
                      <strong>Enfoque Cognitivo:</strong> {level.cognitiveApproach}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-sm">
                    {level.ageRange}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {level.modules.map((module) => (
                    <Card
                      key={module.id}
                      className={`relative transition-all duration-200 ${
                        module.locked
                          ? "opacity-60 cursor-not-allowed"
                          : "hover:shadow-md cursor-pointer"
                      }`}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          <module.icon className="w-8 h-8 text-primary" />
                          {module.locked ? (
                            <Lock className="w-5 h-5 text-gray-400" />
                          ) : module.completed ? (
                            <CheckCircle className="w-5 h-5 text-green-500" />
                          ) : (
                            <PlayCircle className="w-5 h-5 text-blue-500" />
                          )}
                        </div>
                        
                        <h3 className="font-semibold text-lg mb-2">{module.title}</h3>
                        <p className="text-sm text-gray-600 mb-3">{module.description}</p>
                        
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center space-x-2">
                            <Clock className="w-4 h-4 text-gray-400" />
                            <span className="text-sm text-gray-600">{module.duration}</span>
                          </div>
                          <Badge
                            variant="outline"
                            className={`text-xs ${getDifficultyColor(module.difficulty)}`}
                          >
                            {module.difficulty}
                          </Badge>
                        </div>
                        
                        {module.progress > 0 && (
                          <div className="mb-3">
                            <div className="flex items-center justify-between text-sm mb-1">
                              <span>Progreso</span>
                              <span>{module.progress}%</span>
                            </div>
                            <Progress value={module.progress} className="h-2" />
                          </div>
                        )}
                        
                        <div className="text-xs text-gray-500">
                          <strong>Actividades:</strong> {module.activities.join(", ")}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Start Button */}
        <div className="flex justify-center">
          <Button
            onClick={handleStartLessons}
            size="lg"
            className="px-8 py-3 text-lg"
          >
            <PlayCircle className="w-5 h-5 mr-2" />
            Comenzar Lecciones V.2 (framework)
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
};

// Helper function for difficulty colors
const getDifficultyColor = (difficulty: string) => {
  switch (difficulty) {
    case "Fácil": return "bg-green-100 text-green-800 border-green-200";
    case "Intermedio": return "bg-yellow-100 text-yellow-800 border-yellow-200";
    case "Avanzado": return "bg-red-100 text-red-800 border-red-200";
    default: return "bg-gray-100 text-gray-800 border-gray-200";
  }
};

export default LeccionesV2;
