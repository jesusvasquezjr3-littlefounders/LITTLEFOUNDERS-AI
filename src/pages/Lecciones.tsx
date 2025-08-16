import { useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import LessonPlayer from "@/components/lessons/LessonPlayer";
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
  Building
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

const Lecciones = () => {
  const [showInteractiveLessons, setShowInteractiveLessons] = useState(false);
  const [selectedLevel, setSelectedLevel] = useState<string>("nivel-1");
  const [userProgress, setUserProgress] = useState<any[]>([]);

  const levels: Level[] = [
    {
      id: "nivel-1",
      title: "Exploradores Financieros",
      ageRange: "7-8 años",
      description: "Transición hacia el pensamiento concreto con experiencias tangibles",
      cognitiveApproach: "Enfoque visual y táctil con narrativas interactivas",
      sublevels: ["1A: Reconocimiento básico", "1B: Valores simples", "1C: Primeras elecciones"],
      modules: [
        {
          id: "1.1",
          title: "¿Qué es el Dinero?",
          description: "Identificación de monedas y billetes, comprensión de valores básicos",
          duration: "30 min",
          difficulty: "Fácil",
          progress: 100,
          completed: true,
          locked: false,
          icon: Coins,
          activities: [
            "Identificación de monedas y billetes",
            "Comprensión de valores numéricos básicos", 
            "Juegos de reconocimiento visual y táctil",
            "Concepto: 'El dinero representa valor'"
          ]
        },
        {
          id: "1.2", 
          title: "De Dónde Viene el Dinero",
          description: "Introducción al concepto de trabajo y recompensas",
          duration: "25 min",
          difficulty: "Fácil",
          progress: 75,
          completed: false,
          locked: false,
          icon: Users,
          activities: [
            "Introducción al concepto de trabajo",
            "Las personas trabajan para ganar dinero",
            "Diferentes tipos de trabajos y recompensas",
            "Actividad: Tareas domésticas por recompensas"
          ]
        },
        {
          id: "1.3",
          title: "Necesidades vs Deseos", 
          description: "Diferenciación básica entre lo que necesitamos y queremos",
          duration: "35 min",
          difficulty: "Fácil",
          progress: 0,
          completed: false,
          locked: false,
          icon: Package,
          activities: [
            "Diferenciación entre necesidades y deseos",
            "Ejemplos concretos: comida vs juguetes",
            "Actividades de clasificación visual", 
            "Historia interactiva: 'Las decisiones de compra'"
          ]
        },
        {
          id: "1.4",
          title: "Mis Primeras Decisiones de Gasto",
          description: "Elecciones simples con dinero real y comparación básica",
          duration: "40 min", 
          difficulty: "Intermedio",
          progress: 0,
          completed: false,
          locked: true,
          icon: ShoppingCart,
          activities: [
            "Elecciones simples con dinero real",
            "Comparación de precios básica",
            "Concepto de intercambio: dar dinero para recibir algo",
            "Juego: 'El mercado de los pequeños compradores'"
          ]
        }
      ]
    },
    {
      id: "nivel-2",
      title: "Administradores Junior", 
      ageRange: "8-9 años",
      description: "Operaciones concretas establecidas con mejores habilidades matemáticas",
      cognitiveApproach: "Matemáticas aplicadas y planificación visual",
      sublevels: ["2A: Divisiones básicas del dinero", "2B: Comparaciones de precios", "2C: Metas de ahorro"],
      modules: [
        {
          id: "2.1",
          title: "Ganando Mi Dinero",
          description: "Concepto de ganar a través de tareas específicas",
          duration: "35 min",
          difficulty: "Fácil", 
          progress: 0,
          completed: false,
          locked: true,
          icon: Star,
          activities: [
            "Concepto de 'ganar' a través de tareas específicas",
            "Introducción a la 'mesada' por responsabilidades",
            "Relación trabajo-recompensa más compleja",
            "Actividad: Sistema de puntos por tareas domésticas"
          ]
        },
        {
          id: "2.2",
          title: "El Método Dividir y Vencer",
          description: "Sistema 'Gastar, Ahorrar, Compartir' con visualización",
          duration: "45 min",
          difficulty: "Intermedio",
          progress: 0,
          completed: false,
          locked: true,
          icon: PiggyBank,
          activities: [
            "Sistema 'Gastar, Ahorrar, Compartir'",
            "Uso de frascos transparentes para visualizar división",
            "Porcentajes simples (50% gastar, 30% ahorrar, 20% compartir)",
            "Juego: 'Los tres frascos mágicos'"
          ]
        },
        {
          id: "2.3",
          title: "Soy un Comprador Inteligente",
          description: "Comparación de precios y concepto de mejor valor",
          duration: "40 min",
          difficulty: "Intermedio",
          progress: 0,
          completed: false,
          locked: true,
          icon: Search,
          activities: [
            "Comparación de precios entre diferentes tiendas",
            "Concepto de 'mejor valor por dinero'",
            "Introducción a ofertas y descuentos",
            "Actividad: 'La misión del mejor precio'"
          ]
        },
        {
          id: "2.4",
          title: "Mis Primeras Metas de Ahorro",
          description: "Establecimiento de objetivos y seguimiento del progreso",
          duration: "50 min",
          difficulty: "Intermedio",
          progress: 0,
          completed: false,
          locked: true,
          icon: Trophy,
          activities: [
            "Establecimiento de objetivos de ahorro a corto plazo",
            "Cálculo simple de tiempo necesario para ahorrar",
            "Seguimiento visual del progreso",
            "Proyecto: 'Mi alcancía de sueños'"
          ]
        }
      ]
    },
    {
      id: "nivel-3",
      title: "Pequeños Empresarios",
      ageRange: "9-10 años", 
      description: "Preparación para conceptos abstractos con pensamiento más complejo",
      cognitiveApproach: "Pensamiento crítico y proyectos prácticos",
      sublevels: ["3A: Conceptos bancarios básicos", "3B: Emprendimiento simple", "3C: Consumidor crítico"],
      modules: [
        {
          id: "3.1",
          title: "Mi Cuenta Bancaria",
          description: "Introducción a conceptos bancarios y el interés",
          duration: "45 min",
          difficulty: "Intermedio",
          progress: 0,
          completed: false,
          locked: true,
          icon: Building,
          activities: [
            "Introducción a conceptos bancarios básicos",
            "Cómo funciona una cuenta de ahorros",
            "Concepto básico de interés: 'El dinero que crece'",
            "Visita virtual o real a un banco"
          ]
        },
        {
          id: "3.2",
          title: "Pequeño Emprendedor",
          description: "Ideas básicas de negocios y conceptos de ganancia",
          duration: "60 min",
          difficulty: "Avanzado",
          progress: 0,
          completed: false, 
          locked: true,
          icon: Star,
          activities: [
            "Ideas básicas de negocios para niños",
            "Conceptos de ganancia y pérdida",
            "Planificación de un pequeño negocio",
            "Proyecto: 'Mi primer negocio'"
          ]
        },
        {
          id: "3.3",
          title: "Publicidad y Decisiones Inteligentes",
          description: "Comprensión de la influencia publicitaria",
          duration: "40 min",
          difficulty: "Avanzado",
          progress: 0,
          completed: false,
          locked: true,
          icon: Search,
          activities: [
            "Comprensión de cómo la publicidad influye",
            "Desarrollo de pensamiento crítico sobre compras",
            "Identificación de técnicas de marketing",
            "Actividad: 'Detective de anuncios'"
          ]
        },
        {
          id: "3.4",
          title: "Ayudando a Mi Comunidad",
          description: "Conceptos de donación y responsabilidad social",
          duration: "50 min",
          difficulty: "Avanzado",
          progress: 0,
          completed: false,
          locked: true,
          icon: Users,
          activities: [
            "Conceptos de donación y caridad",
            "Impacto de las decisiones en la comunidad",
            "Introducción a conceptos de comercio justo",
            "Proyecto: 'Pequeños filántropos'"
          ]
        }
      ]
    }
  ];

  const currentLevel = levels.find(level => level.id === selectedLevel);
  const totalModules = levels.reduce((sum, level) => sum + level.modules.length, 0);
  const completedModules = levels.reduce((sum, level) => 
    sum + level.modules.filter(module => module.completed).length, 0
  );
  const overallProgress = (completedModules / totalModules) * 100;

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case "Fácil": return "bg-green-100 text-green-800 border-green-200";
      case "Intermedio": return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "Avanzado": return "bg-red-100 text-red-800 border-red-200";
      default: return "bg-gray-100 text-gray-800 border-gray-200";
    }
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
        {/* Header mejorado */}
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-6">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Educación Financiera LittleFounders</h1>
          <p className="text-gray-600 mb-4">Programa completo de educación financiera adaptado al desarrollo cognitivo (7-10 años)</p>
          
          {/* Nuevo botón para acceder a lecciones interactivas */}
          <div className="bg-white rounded-lg p-4 border border-blue-200">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-blue-800">🌟 Nuevas Lecciones Interactivas</h3>
                <p className="text-blue-600 text-sm">Experimenta nuestras lecciones con narrativa, personajes y actividades mejoradas</p>
              </div>
              <Button 
                onClick={() => setShowInteractiveLessons(true)}
                className="bg-blue-500 hover:bg-blue-600"
              >
                <PlayCircle className="w-4 h-4 mr-2" />
                ¡Probar Ahora!
              </Button>
            </div>
          </div>
        </div>
        {/* Progress Overview */}
        <Card className="bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Trophy className="w-6 h-6 text-yellow-600" />
              <span>Tu Progreso General</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-lg font-medium">Módulos Completados</span>
                <span className="text-2xl font-bold text-blue-600">{completedModules}/{totalModules}</span>
              </div>
              <Progress value={overallProgress} className="h-3" />
              <div className="flex items-center justify-between text-sm text-gray-600">
                <span>{Math.round(overallProgress)}% completado</span>
                <span>¡Sigue así!</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Level Selection */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {levels.map((level) => (
            <Card 
              key={level.id}
              className={`cursor-pointer transition-all duration-200 hover:shadow-lg ${
                selectedLevel === level.id 
                  ? "ring-2 ring-blue-500 bg-blue-50" 
                  : "hover:bg-gray-50"
              }`}
              onClick={() => setSelectedLevel(level.id)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{level.title}</CardTitle>
                  <Badge variant="outline" className="text-xs">
                    {level.ageRange}
                  </Badge>
                </div>
                <p className="text-sm text-gray-600">{level.description}</p>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>Módulos:</span>
                    <span className="font-medium">{level.modules.length}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span>Completados:</span>
                    <span className="font-medium text-green-600">
                      {level.modules.filter(m => m.completed).length}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Current Level Details */}
        {currentLevel && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl">{currentLevel.title}</CardTitle>
                <p className="text-gray-600">{currentLevel.cognitiveApproach}</p>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold mb-2">Subniveles:</h4>
                    <div className="flex flex-wrap gap-2">
                      {currentLevel.sublevels.map((sublevel, index) => (
                        <Badge key={index} variant="outline" className="bg-purple-50 text-purple-700">
                          {sublevel}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Modules Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {currentLevel.modules.map((module) => (
                <Card key={module.id} className={`${module.locked ? 'opacity-60' : ''}`}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                          module.completed 
                            ? 'bg-green-100' 
                            : module.locked 
                              ? 'bg-gray-100'
                              : 'bg-blue-100'
                        }`}>
                          {module.completed ? (
                            <CheckCircle className="w-6 h-6 text-green-600" />
                          ) : module.locked ? (
                            <Lock className="w-6 h-6 text-gray-400" />
                          ) : (
                            <module.icon className="w-6 h-6 text-blue-600" />
                          )}
                        </div>
                        <div>
                          <CardTitle className="text-lg">Módulo {module.id}</CardTitle>
                          <h3 className="font-semibold text-gray-900">{module.title}</h3>
                        </div>
                      </div>
                      <Badge className={getDifficultyColor(module.difficulty)}>
                        {module.difficulty}
                      </Badge>
                    </div>
                    <p className="text-gray-600 text-sm">{module.description}</p>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {!module.locked && module.progress > 0 && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span>Progreso</span>
                            <span className="font-medium">{module.progress}%</span>
                          </div>
                          <Progress value={module.progress} className="h-2" />
                        </div>
                      )}
                      
                      <div className="space-y-2">
                        <h4 className="font-medium text-sm">Actividades:</h4>
                        <ul className="text-sm text-gray-600 space-y-1">
                          {module.activities.slice(0, 2).map((activity, index) => (
                            <li key={index} className="flex items-start space-x-2">
                              <span className="w-1.5 h-1.5 bg-blue-400 rounded-full mt-2 flex-shrink-0"></span>
                              <span>{activity}</span>
                            </li>
                          ))}
                          {module.activities.length > 2 && (
                            <li className="text-blue-600 text-xs">
                              +{module.activities.length - 2} actividades más
                            </li>
                          )}
                        </ul>
                      </div>
                      
                      <div className="flex items-center justify-between pt-2">
                        <div className="flex items-center space-x-2 text-sm text-gray-500">
                          <Clock className="w-4 h-4" />
                          <span>{module.duration}</span>
                        </div>
                        <Button 
                          size="sm" 
                          disabled={module.locked}
                          className={module.completed ? "bg-green-600 hover:bg-green-700" : ""}
                        >
                          {module.completed ? (
                            <>
                              <CheckCircle className="w-4 h-4 mr-2" />
                              Completado
                            </>
                          ) : module.locked ? (
                            <>
                              <Lock className="w-4 h-4 mr-2" />
                              Bloqueado
                            </>
                          ) : (
                            <>
                              <PlayCircle className="w-4 h-4 mr-2" />
                              {module.progress > 0 ? 'Continuar' : 'Comenzar'}
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Lecciones;
