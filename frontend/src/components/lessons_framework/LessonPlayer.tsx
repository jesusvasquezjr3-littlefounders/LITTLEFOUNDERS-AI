import React, { useState, useEffect } from 'react';
// FRAMEWORK DE BERNHEIM - Lecciones científicamente validadas (framework)
import Lesson1_1_WhatIsMoney from '../lessons/Lesson1_1_WhatIsMoney';
import Lesson1_2_WhereMoneyComesFrom_Bernheim from './Lesson1_2_WhereMoneyComesFrom_Bernheim';
import Lesson1_3_NeedsVsWants_Bernheim from './Lesson1_3_NeedsVsWants_Bernheim';
import Lesson2_1_TasksAndAllowance_Bernheim from './Lesson2_1_TasksAndAllowance_Bernheim';
import Lesson2_2_SmartPurchaseDecisions_Bernheim from './Lesson2_2_SmartPurchaseDecisions_Bernheim';
import Lesson2_3_Saving_Bernheim from './Lesson2_3_Saving_Bernheim';
import Lesson2_4_MyFirstSavingGoals_Bernheim from './Lesson2_4_MyFirstSavingGoals_Bernheim';
// Lecciones para 11-13 años (framework)
import Lesson1_1_WhatIsBudget_Bernheim from './Lesson1_1_WhatIsBudget_Bernheim';
import Lesson1_2_ExpenseTracking_Bernheim from './Lesson1_2_ExpenseTracking_Bernheim';
import Lesson2_1_WhatIsBank_Bernheim from './Lesson2_1_WhatIsBank_Bernheim';
import Lesson2_2_SavingsAccounts_Bernheim from './Lesson2_2_SavingsAccounts_Bernheim';
import Lesson3_1_PriceQualityComparison_Bernheim from './Lesson3_1_PriceQualityComparison_Bernheim';
import Lesson3_2_OffersAndDiscounts_Bernheim from './Lesson3_2_OffersAndDiscounts_Bernheim';
// Lecciones para 14-16 años (framework)
import Lesson4_1_PlanificacionFinanciera_Bernheim from './Lesson4_1_PlanificacionFinanciera_Bernheim';
import Lesson4_2_IngresosTrabajos_Bernheim from './Lesson4_2_IngresosTrabajos_Bernheim';
import Lesson5_1_QueEsCredito_Bernheim from './Lesson5_1_QueEsCredito_Bernheim';
import Lesson5_2_HistorialCrediticio_Bernheim from './Lesson5_2_HistorialCrediticio_Bernheim';
import Lesson6_1_QueSonInversiones_Bernheim from './Lesson6_1_QueSonInversiones_Bernheim';
import Lesson6_2_RiesgoRendimiento_Bernheim from './Lesson6_2_RiesgoRendimiento_Bernheim';
import Lesson7_1_CostosVidaIndependiente_Bernheim from './Lesson7_1_CostosVidaIndependiente_Bernheim';
import Lesson7_2_SegurosProteccion_Bernheim from './Lesson7_2_SegurosProteccion_Bernheim';
// Lecciones por edad específica (framework)
import Lesson_Ages8to10_SavingsGoals_Bernheim from './Lesson_Ages8to10_SavingsGoals_Bernheim';
import Lesson_Ages8to10_ValueComparison_Bernheim from './Lesson_Ages8to10_ValueComparison_Bernheim';
import Lesson_Ages11to13_BudgetingTool_Bernheim from './Lesson_Ages11to13_BudgetingTool_Bernheim';
import Lesson_Ages11to13_SmartSpending_Bernheim from './Lesson_Ages11to13_SmartSpending_Bernheim';
import Lesson_Ages14to16_CompoundInterest_Bernheim from './Lesson_Ages14to16_CompoundInterest_Bernheim';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LessonPath } from '../lessons/LessonPath';
import {
  Trophy,
  Clock,
  Coins,
  Briefcase,
  ShoppingCart,
  Star,
  Brain,
  PiggyBank,
  Target,
  Scale,
  BarChart3,
  ListTodo,
  Building,
  Tags,
  Percent,
  TrendingUp,
  CreditCard,
  Shield,
  Home
} from 'lucide-react';

interface LessonProgress {
  lessonId: string;
  score: number;
  completed: boolean;
  completedAt: Date;
  timeSpent: number;
  progressData: any;
}

interface LessonPlayerProps {
  initialLessonId?: string;
  ageRange?: string;
  onExit: () => void;
  userProgress?: LessonProgress[];
  onProgressUpdate: (progress: LessonProgress) => void;
}

const LessonPlayer: React.FC<LessonPlayerProps> = ({
  initialLessonId,
  ageRange = "8-10",
  onExit,
  userProgress = [],
  onProgressUpdate
}) => {
  const [currentLessonId, setCurrentLessonId] = useState<string | null>(initialLessonId || null);
  const [completedLessons, setCompletedLessons] = useState<LessonProgress[]>(userProgress);
  const [showCelebration, setShowCelebration] = useState(false);
  const [lastCompletedLesson, setLastCompletedLesson] = useState<LessonProgress | null>(null);

  // Sync state with props
  useEffect(() => {
    setCompletedLessons(userProgress);
  }, [userProgress]);

  // Datos de las lecciones disponibles según el rango de edad
  const getLessonsByAgeRange = (ageRange: string) => {
    switch (ageRange) {
      case "8-10":
        return [
          {
            id: '1.1',
            title: '¿Qué es el Dinero?',
            description: 'Explora el origen y usos del dinero con Dino - Lección Interactiva',
            duration: '30 min',
            difficulty: 'Fácil',
            component: Lesson1_1_WhatIsMoney,
            icon: Coins,
            unlocked: true,
            activities: ['Conceptos básicos']
          },
          {
            id: '1.2',
            title: 'De Dónde Viene el Dinero',
            description: 'Herramienta de comprensión del trabajo y ingresos',
            duration: '25 min',
            difficulty: 'Fácil',
            component: Lesson1_2_WhereMoneyComesFrom_Bernheim,
            icon: Briefcase,
            unlocked: completedLessons.some(p => p.lessonId === '1.1') || false,
            activities: ['Trabajo', 'Ingresos']
          },
          {
            id: '1.3',
            title: 'Necesidades vs Deseos',
            description: 'Herramienta de evaluación de prioridades',
            duration: '35 min',
            difficulty: 'Fácil',
            component: Lesson1_3_NeedsVsWants_Bernheim,
            icon: ShoppingCart,
            unlocked: completedLessons.some(p => p.lessonId === '1.2') || false,
            activities: ['Prioridades']
          },
          {
            id: '2.1',
            title: 'Tareas y Mesada',
            description: 'Herramienta de responsabilidad y recompensas',
            duration: '35 min',
            difficulty: 'Fácil',
            component: Lesson2_1_TasksAndAllowance_Bernheim,
            icon: Star,
            unlocked: completedLessons.some(p => p.lessonId === '1.3') || false,
            activities: ['Responsabilidad']
          },
          {
            id: '2.2',
            title: 'Decisiones de Compra',
            description: 'Herramienta de análisis de decisiones de compra',
            duration: '40 min',
            difficulty: 'Intermedio',
            component: Lesson2_2_SmartPurchaseDecisions_Bernheim,
            icon: Brain,
            unlocked: completedLessons.some(p => p.lessonId === '2.1') || false,
            activities: ['Decisiones']
          },
          {
            id: '2.3',
            title: 'El Ahorro',
            description: 'Herramienta de planificación de ahorros',
            duration: '45 min',
            difficulty: 'Intermedio',
            component: Lesson2_3_Saving_Bernheim,
            icon: PiggyBank,
            unlocked: completedLessons.some(p => p.lessonId === '2.2') || false,
            activities: ['Ahorro']
          },
          {
            id: '2.4',
            title: 'Mis Metas de Ahorro',
            description: 'Herramienta de establecimiento de metas',
            duration: '50 min',
            difficulty: 'Intermedio',
            component: Lesson2_4_MyFirstSavingGoals_Bernheim,
            icon: Target,
            unlocked: completedLessons.some(p => p.lessonId === '2.3') || false,
            activities: ['Metas']
          },
          {
            id: '3.1',
            title: 'Metas Avanzadas',
            description: 'Planificación especializada de ahorros',
            duration: '45 min',
            difficulty: 'Intermedio',
            component: Lesson_Ages8to10_SavingsGoals_Bernheim,
            icon: TrendingUp,
            unlocked: completedLessons.some(p => p.lessonId === '2.4') || false,
            activities: ['Planificación']
          },
          {
            id: '3.2',
            title: 'Comparación de Valores',
            description: 'Análisis de valor y comparación',
            duration: '40 min',
            difficulty: 'Intermedio',
            component: Lesson_Ages8to10_ValueComparison_Bernheim,
            icon: Scale,
            unlocked: completedLessons.some(p => p.lessonId === '3.1') || false,
            activities: ['Valor']
          }
        ];
      case "11-13":
        return [
          {
            id: '1.1',
            title: '¿Qué es un Presupuesto?',
            description: 'Herramienta práctica 50/30/20',
            duration: '45 min',
            difficulty: 'Intermedio',
            component: Lesson1_1_WhatIsBudget_Bernheim,
            icon: BarChart3,
            unlocked: true,
            activities: ['Presupuesto']
          },
          {
            id: '1.2',
            title: 'Seguimiento de Gastos',
            description: 'Análisis de patrones de gasto',
            duration: '50 min',
            difficulty: 'Intermedio',
            component: Lesson1_2_ExpenseTracking_Bernheim,
            icon: ListTodo,
            unlocked: completedLessons.some(p => p.lessonId === '1.1') || false,
            activities: ['Gastos']
          },
          {
            id: '2.1',
            title: '¿Qué es un Banco?',
            description: 'Comprensión del sistema bancario',
            duration: '40 min',
            difficulty: 'Intermedio',
            component: Lesson2_1_WhatIsBank_Bernheim,
            icon: Building,
            unlocked: completedLessons.some(p => p.lessonId === '1.2') || false,
            activities: ['Banca']
          },
          {
            id: '2.2',
            title: 'Cuentas de Ahorro',
            description: 'Comprensión de intereses y crecimiento',
            duration: '45 min',
            difficulty: 'Intermedio',
            component: Lesson2_2_SavingsAccounts_Bernheim,
            icon: PiggyBank,
            unlocked: completedLessons.some(p => p.lessonId === '2.1') || false,
            activities: ['Interés']
          },
          {
            id: '3.1',
            title: 'Precios y Calidad',
            description: 'Herramienta de valor por unidad',
            duration: '50 min',
            difficulty: 'Intermedio',
            component: Lesson3_1_PriceQualityComparison_Bernheim,
            icon: Scale,
            unlocked: completedLessons.some(p => p.lessonId === '2.2') || false,
            activities: ['Comparación']
          },
          {
            id: '3.2',
            title: 'Ofertas y Descuentos',
            description: 'Análisis de ofertas y descuentos',
            duration: '45 min',
            difficulty: 'Intermedio',
            component: Lesson3_2_OffersAndDiscounts_Bernheim,
            icon: Tags,
            unlocked: completedLessons.some(p => p.lessonId === '3.1') || false,
            activities: ['Descuentos']
          },
          {
            id: '4.1',
            title: 'Presupuesto Avanzado',
            description: 'Herramienta especializada de presupuestación',
            duration: '55 min',
            difficulty: 'Intermedio',
            component: Lesson_Ages11to13_BudgetingTool_Bernheim,
            icon: Percent,
            unlocked: completedLessons.some(p => p.lessonId === '3.2') || false,
            activities: ['Finanzas']
          },
          {
            id: '4.2',
            title: 'Gastos Inteligentes',
            description: 'Análisis de gastos inteligentes',
            duration: '50 min',
            difficulty: 'Intermedio',
            component: Lesson_Ages11to13_SmartSpending_Bernheim,
            icon: Brain,
            unlocked: completedLessons.some(p => p.lessonId === '4.1') || false,
            activities: ['Inteligencia']
          }
        ];
      case "14-16":
        return [
          {
            id: '4.1',
            title: 'Planificación a Largo Plazo',
            description: 'Planificación financiera estructurada',
            duration: '60 min',
            difficulty: 'Avanzado',
            component: Lesson4_1_PlanificacionFinanciera_Bernheim,
            icon: Target,
            unlocked: true,
            activities: ['Futuro']
          },
          {
            id: '4.2',
            title: 'Ingresos y Trabajos',
            description: 'Gestión de ingresos y oportunidades',
            duration: '55 min',
            difficulty: 'Avanzado',
            component: Lesson4_2_IngresosTrabajos_Bernheim,
            icon: Briefcase,
            unlocked: completedLessons.some(p => p.lessonId === '4.1') || false,
            activities: ['Carrera']
          },
          {
            id: '5.1',
            title: '¿Qué es el Crédito?',
            description: 'Comprensión del crédito y sus fundamentos',
            duration: '50 min',
            difficulty: 'Avanzado',
            component: Lesson5_1_QueEsCredito_Bernheim,
            icon: CreditCard,
            unlocked: completedLessons.some(p => p.lessonId === '4.2') || false,
            activities: ['Crédito']
          },
          {
            id: '5.2',
            title: 'Historial Crediticio',
            description: 'Gestión del historial crediticio',
            duration: '55 min',
            difficulty: 'Avanzado',
            component: Lesson5_2_HistorialCrediticio_Bernheim,
            icon: BarChart3,
            unlocked: completedLessons.some(p => p.lessonId === '5.1') || false,
            activities: ['Score']
          },
          {
            id: '6.1',
            title: '¿Qué son las Inversiones?',
            description: 'Comprensión de inversiones y activos',
            duration: '60 min',
            difficulty: 'Avanzado',
            component: Lesson6_1_QueSonInversiones_Bernheim,
            icon: TrendingUp,
            unlocked: completedLessons.some(p => p.lessonId === '5.2') || false,
            activities: ['Inversión']
          },
          {
            id: '6.2',
            title: 'Riesgo y Rendimiento',
            description: 'Análisis de riesgo-rendimiento',
            duration: '65 min',
            difficulty: 'Avanzado',
            component: Lesson6_2_RiesgoRendimiento_Bernheim,
            icon: Scale,
            unlocked: completedLessons.some(p => p.lessonId === '6.1') || false,
            activities: ['Riesgo']
          },
          {
            id: '7.1',
            title: 'Vida Independiente',
            description: 'Costos de vida independiente',
            duration: '70 min',
            difficulty: 'Avanzado',
            component: Lesson7_1_CostosVidaIndependiente_Bernheim,
            icon: Home,
            unlocked: completedLessons.some(p => p.lessonId === '6.2') || false,
            activities: ['Independencia']
          },
          {
            id: '7.2',
            title: 'Seguros y Protección',
            description: 'Comprensión de seguros',
            duration: '60 min',
            difficulty: 'Avanzado',
            component: Lesson7_2_SegurosProteccion_Bernheim,
            icon: Shield,
            unlocked: completedLessons.some(p => p.lessonId === '7.1') || false,
            activities: ['Seguros']
          },
          {
            id: '8.1',
            title: 'Interés Compuesto',
            description: 'Análisis de interés compuesto',
            duration: '65 min',
            difficulty: 'Avanzado',
            component: Lesson_Ages14to16_CompoundInterest_Bernheim,
            icon: TrendingUp,
            unlocked: completedLessons.some(p => p.lessonId === '7.2') || false,
            activities: ['Matemáticas']
          }
        ];
      default:
        return [];
    }
  };

  const lessons = getLessonsByAgeRange(ageRange);

  // Transform internal lesson structure to LessonPath module structure
  const pathModules = lessons.map(lesson => ({
    id: lesson.id,
    title: lesson.title,
    description: lesson.description,
    duration: lesson.duration,
    difficulty: lesson.difficulty as "Fácil" | "Intermedio" | "Avanzado",
    progress: completedLessons.find(p => p.lessonId === lesson.id)?.score || 0,
    completed: completedLessons.some(p => p.lessonId === lesson.id),
    locked: !lesson.unlocked, // Note: unlocked logic is already calculated above
    icon: lesson.icon,
    activities: lesson.activities
  }));

  const handleLessonComplete = (lessonId: string, score: number, progressData: any) => {
    // Check if simplified or full score
    const newProgress: LessonProgress = {
      lessonId,
      score,
      completed: true,
      completedAt: new Date(),
      timeSpent: progressData && progressData.endTime ? progressData.endTime - progressData.startTime : 0,
      progressData
    };

    setCompletedLessons(prev => {
      const filtered = prev.filter(p => p.lessonId !== lessonId);
      return [...filtered, newProgress];
    });

    setLastCompletedLesson(newProgress);
    setShowCelebration(true);
    onProgressUpdate(newProgress);

    // Auto-avanzar a la siguiente lección después de 3 segundos
    setTimeout(() => {
      setShowCelebration(false);
      const nextLessonIndex = lessons.findIndex(l => l.id === lessonId) + 1;
      if (nextLessonIndex < lessons.length) {
        // En lugar de auto-iniciar, volvemos al mapa para que el usuario vea su progreso
        setCurrentLessonId(null);
      } else {
        setCurrentLessonId(null); // Volver al menú principal
      }
    }, 3000);
  };

  const handleLessonExit = () => {
    setCurrentLessonId(null);
  };

  const startLesson = (lessonId: string) => {
    setCurrentLessonId(lessonId);
  };

  // Mostrar celebración cuando se completa una lección
  if (showCelebration && lastCompletedLesson) {
    return (
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        <div className="text-center space-y-6">
          <div className="text-8xl animate-bounce">🎉</div>
          <h1 className="text-4xl font-bold text-yellow-600">¡Felicidades!</h1>
          <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200 rounded-lg p-6">
            <h2 className="text-2xl font-bold text-yellow-800 mb-4">
              ¡Completaste la lección!
            </h2>
            <div className="space-y-3">
              <div className="flex items-center justify-center space-x-4">
                <Trophy className="w-8 h-8 text-yellow-600" />
                <span className="text-xl font-bold">Puntuación: {lastCompletedLesson.score}/100</span>
              </div>
              <div className="flex items-center justify-center space-x-4">
                <Clock className="w-6 h-6 text-blue-600" />
                <span>Tiempo: {Math.round(lastCompletedLesson.timeSpent / 1000 / 60)} minutos</span>
              </div>
            </div>
          </div>
          <p className="text-lg text-gray-600">
            ¡Sigue así, estás construyendo un gran futuro!
          </p>
        </div>
      </div>
    );
  }

  // Mostrar lección actual (Player Mode)
  if (currentLessonId) {
    const lesson = lessons.find(l => l.id === currentLessonId);
    if (lesson) {
      const LessonComponent = lesson.component;
      return (
        <LessonComponent
          onComplete={(score, progress) => handleLessonComplete(lesson.id, score, progress)}
          onExit={handleLessonExit}
        />
      );
    }
  }

  // Mostrar mapa de lecciones (Map Mode)
  return (
    <div className="w-full max-w-5xl mx-auto p-4 md:p-6 mb-20">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-800">Tu Camino de Aprendizaje</h2>
        <p className="text-gray-500">Completa las lecciones para desbloquear nuevos retos</p>
      </div>

      <LessonPath
        modules={pathModules}
        onModuleClick={(module) => startLesson(module.id)}
      />

      {completedLessons.length === lessons.length && (
        <div className="mt-12 text-center animate-in fade-in duration-700">
          <Card className="bg-gradient-to-r from-yellow-50 via-orange-50 to-red-50 border-yellow-300 max-w-2xl mx-auto">
            <CardContent className="p-8">
              <div className="text-6xl mb-4">🏆</div>
              <h3 className="text-2xl font-bold text-yellow-800 mb-2">
                ¡Nivel Completado!
              </h3>
              <p className="text-yellow-700 mb-6">
                Has completado todas las lecciones de este nivel.
                ¡Eres un verdadero experto financiero!
              </p>
              <div className="flex justify-center">
                <Badge className="bg-yellow-100 text-yellow-800 text-lg px-6 py-3">
                  <Trophy className="w-5 h-5 mr-2" />
                  Certificado de Excelencia
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default LessonPlayer;
