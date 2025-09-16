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

const Lecciones = () => {
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
              }
            ]
          },
          {
            id: "nivel-2",
            title: "Administradores Junior", 
            ageRange: "8-9 años",
            description: "Operaciones concretas establecidas con mejores habilidades matemáticas",
            cognitiveApproach: "Matemáticas aplicadas y planificación visual",
            sublevels: ["2A: Tareas y mesada", "2B: Decisiones inteligentes", "2C: Ahorro básico"],
            modules: [
              {
                id: "2.1",
                title: "Tareas y Mesada",
                description: "Formas amigables de ganar dinero a su edad",
                duration: "35 min",
                difficulty: "Fácil", 
                progress: 0,
                completed: false,
                locked: false,
                icon: Star,
                activities: [
                  "Relacionar esfuerzo con recompensa económica",
                  "Cumplir responsabilidades para ganar dinero",
                  "Gestionar una mesada de manera responsable",
                  "Actividad: Sistema de puntos por tareas domésticas"
                ]
              },
              {
                id: "2.2",
                title: "Decisiones Inteligentes de Compra",
                description: "Tomar decisiones inteligentes al momento de comprar",
                duration: "40 min",
                difficulty: "Intermedio",
                progress: 0,
                completed: false,
                locked: true,
                icon: Search,
                activities: [
                  "Evaluar opciones antes de comprar",
                  "Comparar precios de productos similares",
                  "Resistir compras impulsivas",
                  "Actividad: 'La misión del mejor precio'"
                ]
              },
              {
                id: "2.3",
                title: "El Ahorro",
                description: "Introducción amigable al concepto de ahorro",
                duration: "45 min",
                difficulty: "Intermedio",
                progress: 0,
                completed: false,
                locked: true,
                icon: PiggyBank,
                activities: [
                  "Comprender la importancia del ahorro",
                  "Establecer metas de ahorro simples",
                  "Desarrollar paciencia para gratificación diferida",
                  "Juego: 'Los tres frascos mágicos'"
                ]
              },
              {
                id: "2.4",
                title: "Mis Primeras Metas de Ahorro",
                description: "Establecer objetivos de ahorro realistas",
                duration: "50 min",
                difficulty: "Intermedio",
                progress: 0,
                completed: false,
                locked: true,
                icon: Trophy,
                activities: [
                  "Establecer objetivos de ahorro realistas y específicos",
                  "Calcular cuánto tiempo necesitan para lograr sus metas",
                  "Mantener motivación durante el proceso de ahorro",
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
      case "11-13":
        return [
          {
            id: "nivel-1",
            title: "Mi Primer Presupuesto",
            ageRange: "11-12 años",
            description: "Conceptos intermedios de finanzas personales y planificación",
            cognitiveApproach: "Análisis crítico y planificación estratégica",
            sublevels: ["1A: ¿Qué es un Presupuesto?", "1B: Seguimiento de Gastos", "1C: Análisis de Patrones"],
            modules: [
              {
                id: "1.1",
                title: "¿Qué es un Presupuesto?",
                description: "Crear y mantener un presupuesto personal",
                duration: "45 min",
                difficulty: "Intermedio",
                progress: 0,
                completed: false,
                locked: false,
                icon: Coins,
                activities: [
                  "Entender qué es un presupuesto y por qué es importante",
                  "Aprender la regla 50/30/20 para distribución",
                  "Crear tu primer presupuesto personal",
                  "Tomar decisiones financieras inteligentes"
                ]
              },
              {
                id: "1.2",
                title: "Seguimiento de Gastos",
                description: "Registrar y analizar patrones de gasto",
                duration: "50 min",
                difficulty: "Intermedio",
                progress: 0,
                completed: false,
                locked: false,
                icon: BarChart3,
                activities: [
                  "Registrar y categorizar cada gasto",
                  "Analizar patrones de gasto",
                  "Identificar oportunidades de ahorro",
                  "Crear un sistema de seguimiento personal"
                ]
              }
            ]
          },
          {
            id: "nivel-2",
            title: "El Mundo Bancario",
            ageRange: "12-13 años",
            description: "Introducción al sistema bancario y servicios financieros",
            cognitiveApproach: "Comprensión de sistemas complejos y toma de decisiones informadas",
            sublevels: ["2A: ¿Qué es un Banco?", "2B: Cuentas de Ahorro", "2C: Servicios Bancarios"],
            modules: [
              {
                id: "2.1",
                title: "¿Qué es un Banco?",
                description: "Entender el sistema bancario y sus funciones",
                duration: "40 min",
                difficulty: "Intermedio",
                progress: 0,
                completed: false,
                locked: false,
                icon: Building,
                activities: [
                  "Comprender qué es un banco y sus funciones principales",
                  "Entender por qué los bancos son seguros y confiables",
                  "Conocer los servicios básicos bancarios",
                  "Prepararse para la primera visita al banco"
                ]
              },
              {
                id: "2.2",
                title: "Cuentas de Ahorro",
                description: "Funcionamiento de cuentas de ahorro e intereses",
                duration: "45 min",
                difficulty: "Intermedio",
                progress: 0,
                completed: false,
                locked: true,
                icon: PiggyBank,
                activities: [
                  "Entender cómo funcionan las cuentas de ahorro",
                  "Calcular intereses y crecimiento del dinero",
                  "Comparar diferentes opciones de cuentas",
                  "Elegir la mejor cuenta para tus necesidades"
                ]
              }
            ]
          },
          {
            id: "nivel-3",
            title: "Comprando de Forma Inteligente",
            ageRange: "13 años",
            description: "Desarrollo de habilidades de consumo crítico",
            cognitiveApproach: "Pensamiento crítico y análisis de valor",
            sublevels: ["3A: Comparando Precios", "3B: Ofertas y Descuentos", "3C: Decisiones de Compra"],
            modules: [
              {
                id: "3.1",
                title: "Comparando Precios y Calidad",
                description: "Evaluar precio y calidad antes de comprar",
                duration: "50 min",
                difficulty: "Intermedio",
                progress: 0,
                completed: false,
                locked: true,
                icon: Search,
                activities: [
                  "Investigar antes de comprar",
                  "Evaluar relación precio-calidad",
                  "Usar herramientas de comparación",
                  "Tomar decisiones de compra informadas"
                ]
              },
              {
                id: "3.2",
                title: "Ofertas y Descuentos",
                description: "Calcular descuentos y distinguir ofertas reales",
                duration: "45 min",
                difficulty: "Intermedio",
                progress: 0,
                completed: false,
                locked: true,
                icon: ShoppingCart,
                activities: [
                  "Calcular porcentajes de descuento",
                  "Distinguir ofertas reales de falsas",
                  "Planificar compras aprovechando promociones",
                  "Maximizar el valor de tu dinero"
                ]
              }
            ]
          },
          {
            id: "nivel-4",
            title: "Emprendimiento Juvenil",
            ageRange: "13 años",
            description: "Introducción a conceptos básicos de emprendimiento",
            cognitiveApproach: "Pensamiento creativo y planificación de proyectos",
            sublevels: ["4A: Mi Primera Idea de Negocio", "4B: Costos y Ganancias", "4C: Plan de Negocio"],
            modules: [
              {
                id: "4.1",
                title: "Mi Primera Idea de Negocio",
                description: "Desarrollar ideas de negocio y evaluar viabilidad",
                duration: "55 min",
                difficulty: "Avanzado",
                progress: 0,
                completed: false,
                locked: true,
                icon: Star,
                activities: [
                  "Identificar oportunidades de negocio",
                  "Desarrollar creatividad empresarial",
                  "Evaluar viabilidad de ideas",
                  "Crear un plan básico de negocio"
                ]
              },
              {
                id: "4.2",
                title: "Costos y Ganancias Básicos",
                description: "Calcular costos, ganancias y fijar precios",
                duration: "50 min",
                difficulty: "Avanzado",
                progress: 0,
                completed: false,
                locked: true,
                icon: Calculator,
                activities: [
                  "Calcular costos simples de producción",
                  "Entender el concepto de ganancia",
                  "Fijar precios competitivos",
                  "Analizar rentabilidad básica"
                ]
              }
            ]
          }
        ];
      case "14-16":
        return [
          {
            id: "nivel-1",
            title: "Finanzas Personales Avanzadas",
            ageRange: "14-15 años",
            description: "Conceptos avanzados de planificación financiera y gestión de ingresos",
            cognitiveApproach: "Pensamiento estratégico y análisis complejo",
            sublevels: ["1A: Planificación a largo plazo", "1B: Gestión de ingresos", "1C: Herramientas digitales"],
            modules: [
              {
                id: "4.1",
                title: "Planificación Financiera a Largo Plazo",
                description: "Crear metas financieras y planes estructurados para el futuro",
                duration: "60 min",
                difficulty: "Avanzado",
                progress: 0,
                completed: false,
                locked: false,
                icon: Target,
                activities: [
                  "Metas financieras a mediano/largo plazo",
                  "Planes financieros estructurados",
                  "Evaluación y ajuste de estrategias",
                  "Simulador 'Mi vida a los 25 años'"
                ]
              },
              {
                id: "4.2",
                title: "Ingresos y Trabajos de Medio Tiempo",
                description: "Oportunidades laborales y gestión de ingresos variables",
                duration: "55 min",
                difficulty: "Avanzado",
                progress: 0,
                completed: false,
                locked: true,
                icon: Briefcase,
                activities: [
                  "Oportunidades laborales para adolescentes",
                  "Derechos y responsabilidades laborales",
                  "Gestión de ingresos variables",
                  "Portal de empleos para adolescentes"
                ]
              }
            ]
          },
          {
            id: "nivel-2",
            title: "Introducción al Crédito",
            ageRange: "15-16 años",
            description: "Fundamentos del crédito y construcción de historial crediticio",
            cognitiveApproach: "Análisis de responsabilidades y consecuencias",
            sublevels: ["2A: Conceptos básicos de crédito", "2B: Historial crediticio", "2C: Uso responsable"],
            modules: [
              {
                id: "5.1",
                title: "¿Qué es el Crédito?",
                description: "Entender los fundamentos del crédito y tipos disponibles",
                duration: "50 min",
                difficulty: "Avanzado",
                progress: 0,
                completed: false,
                locked: true,
                icon: CreditCard,
                activities: [
                  "Crédito básico y tipos de crédito",
                  "Responsabilidad del endeudamiento",
                  "Simulador de tarjeta de crédito",
                  "Comparador de opciones crediticias"
                ]
              },
              {
                id: "5.2",
                title: "Historial Crediticio y Score",
                description: "Construir y mantener un buen historial crediticio",
                duration: "55 min",
                difficulty: "Avanzado",
                progress: 0,
                completed: false,
                locked: true,
                icon: TrendingUp,
                activities: [
                  "Importancia del historial crediticio",
                  "Factores del score crediticio",
                  "Constructor de score crediticio",
                  "Timeline 'Mi futuro crediticio'"
                ]
              }
            ]
          },
          {
            id: "nivel-3",
            title: "Inversiones Básicas",
            ageRange: "15-16 años",
            description: "Introducción al mundo de las inversiones y gestión de riesgo",
            cognitiveApproach: "Análisis de riesgo-rendimiento y diversificación",
            sublevels: ["3A: Conceptos de inversión", "3B: Riesgo y rendimiento", "3C: Diversificación"],
            modules: [
              {
                id: "6.1",
                title: "¿Qué son las Inversiones?",
                description: "Fundamentos de inversión y tipos de activos",
                duration: "60 min",
                difficulty: "Avanzado",
                progress: 0,
                completed: false,
                locked: true,
                icon: BarChart3,
                activities: [
                  "Inversión básica y diferencia ahorrar/invertir",
                  "Tipos de inversiones",
                  "Simulador bursátil estudiantil",
                  "Comparador de opciones de inversión"
                ]
              },
              {
                id: "6.2",
                title: "Riesgo y Rendimiento",
                description: "Entender la relación riesgo-rendimiento y diversificación",
                duration: "65 min",
                difficulty: "Avanzado",
                progress: 0,
                completed: false,
                locked: true,
                icon: AlertTriangle,
                activities: [
                  "Relación riesgo-rendimiento",
                  "Tolerancia personal al riesgo",
                  "Simulador portafolio de inversiones",
                  "Análisis de casos de inversión"
                ]
              }
            ]
          },
          {
            id: "nivel-4",
            title: "Preparándose para la Vida Adulta",
            ageRange: "16 años",
            description: "Transición a la independencia financiera y protección",
            cognitiveApproach: "Planificación integral y responsabilidad adulta",
            sublevels: ["4A: Costos de vida independiente", "4B: Protección financiera", "4C: Transición adulta"],
            modules: [
              {
                id: "7.1",
                title: "Costos de la Vida Independiente",
                description: "Entender y planificar los costos de la vida independiente",
                duration: "70 min",
                difficulty: "Avanzado",
                progress: 0,
                completed: false,
                locked: true,
                icon: Home,
                activities: [
                  "Costos de vida independiente",
                  "Presupuesto universitario/laboral",
                  "Simulador 'Viviendo solo'",
                  "Planificador de independencia financiera"
                ]
              },
              {
                id: "7.2",
                title: "Seguros y Protección Financiera",
                description: "Entender la importancia de los seguros y protección",
                duration: "60 min",
                difficulty: "Avanzado",
                progress: 0,
                completed: false,
                locked: true,
                icon: Shield,
                activities: [
                  "Importancia de los seguros",
                  "Riesgos financieros",
                  "Simulador de riesgos y seguros",
                  "Casos prácticos de protección financiera"
                ]
              }
            ]
          }
        ];
      default:
        return [];
    }
  };

  const levels = getLevelsByAgeRange(selectedAgeRange);

  // Función para verificar si una lección está desbloqueada
  const isLessonUnlocked = (lessonId: string) => {
    if (lessonId === '1.1') return true; // Primera lección siempre desbloqueada
    if (lessonId === '2.1') return true; // Lección 2.1 desbloqueada para demostración
    if (lessonId === '4.1') return true; // Primera lección 14-16 años desbloqueada
    
    // Lógica de desbloqueo secuencial
    const lessonOrder = ['1.1', '1.2', '1.3', '2.1', '2.2', '2.3', '2.4', '4.1', '4.2', '5.1', '5.2', '6.1', '6.2', '7.1', '7.2'];
    const currentIndex = lessonOrder.indexOf(lessonId);
    if (currentIndex === -1) return false;
    
    // Verificar si la lección anterior está completada
    const previousLessonId = lessonOrder[currentIndex - 1];
    if (!previousLessonId) return true;
    
    // Aquí podrías verificar contra el progreso real del usuario
    // Por ahora, desbloqueamos las primeras lecciones para demostración
    return ['1.1', '1.2', '1.3', '2.1', '4.1'].includes(lessonId);
  };

  // Aplicar el estado de desbloqueo a los módulos
  const levelsWithUnlockStatus = levels.map(level => ({
    ...level,
    modules: level.modules.map(module => ({
      ...module,
      locked: !isLessonUnlocked(module.id)
    }))
  }));

  const currentLevel = levelsWithUnlockStatus.find(level => level.id === selectedLevel);
  const totalModules = levelsWithUnlockStatus.reduce((sum, level) => sum + level.modules.length, 0);
  const completedModules = levelsWithUnlockStatus.reduce((sum, level) => 
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
        {/* Header mejorado */}
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-6">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Educación Financiera LittleFounders</h1>
          <p className="text-gray-600 mb-4">Programa completo de educación financiera adaptado al desarrollo cognitivo</p>
          
          {/* Selector de Edad */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center">
              <Calendar className="w-5 h-5 mr-2" />
              Selecciona tu rango de edad:
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {ageRanges.map((ageRange) => (
                <Card 
                  key={ageRange.id}
                  className={`cursor-pointer transition-all duration-200 hover:shadow-lg ${
                    selectedAgeRange === ageRange.id 
                      ? "ring-2 ring-blue-500 bg-blue-50" 
                      : "hover:bg-gray-50"
                  }`}
                  onClick={() => setSelectedAgeRange(ageRange.id)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        selectedAgeRange === ageRange.id ? 'bg-blue-100' : 'bg-gray-100'
                      }`}>
                        <ageRange.icon className={`w-5 h-5 ${
                          selectedAgeRange === ageRange.id ? 'text-blue-600' : 'text-gray-600'
                        }`} />
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-900">{ageRange.label}</h4>
                        <p className="text-sm text-gray-600">{ageRange.description}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
          
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
        {levelsWithUnlockStatus.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {levelsWithUnlockStatus.map((level) => (
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
        ) : (
          <Card className="bg-gradient-to-r from-yellow-50 to-orange-50 border-yellow-200">
            <CardContent className="p-8 text-center">
              <div className="text-6xl mb-4">🚧</div>
              <h3 className="text-xl font-bold text-yellow-800 mb-2">
                Lecciones en Desarrollo
              </h3>
              <p className="text-yellow-700 mb-4">
                Estamos trabajando en las lecciones para el rango de edad {selectedAgeRange === "11-13" ? "11-13 años" : "14-16 años"}. 
                ¡Pronto tendremos contenido emocionante para ti!
              </p>
              <p className="text-sm text-yellow-600">
                Por ahora, te invitamos a explorar las lecciones disponibles para 8-10 años.
              </p>
            </CardContent>
          </Card>
        )}

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
                          onClick={() => {
                            if (!module.locked && !module.completed) {
                              setShowInteractiveLessons(true);
                            }
                          }}
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
