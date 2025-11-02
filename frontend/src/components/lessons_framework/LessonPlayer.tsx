import React, { useState, useEffect } from 'react';
// FRAMEWORK DE BERNHEIM - Lecciones científicamente validadas (framework)
import Lesson1_1_WhatIsMoney_Bernheim from './Lesson1_1_WhatIsMoney_Bernheim';
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Trophy, 
  Star, 
  Award, 
  CheckCircle,
  PlayCircle,
  Clock,
  ArrowLeft,
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

  // Datos de las lecciones disponibles según el rango de edad
  const getLessonsByAgeRange = (ageRange: string) => {
    switch (ageRange) {
      case "8-10":
        return [
          {
            id: '1.1',
            title: '¿Qué es el Dinero? (framework)',
            description: 'Herramienta práctica de equivalencia monetaria - Framework científico de Bernheim',
            duration: '30 min',
            difficulty: 'Fácil',
            component: Lesson1_1_WhatIsMoney_Bernheim,
            emoji: '💰',
            unlocked: true
          },
          {
            id: '1.2',
            title: 'De Dónde Viene el Dinero (framework)',
            description: 'Herramienta de comprensión del trabajo y ingresos - Framework científico de Bernheim',
            duration: '25 min',
            difficulty: 'Fácil',
            component: Lesson1_2_WhereMoneyComesFrom_Bernheim,
            emoji: '💼',
            unlocked: completedLessons.some(p => p.lessonId === '1.1')
          },
          {
            id: '1.3',
            title: 'Necesidades vs Deseos (framework)',
            description: 'Herramienta de evaluación de prioridades - Framework científico de Bernheim',
            duration: '35 min',
            difficulty: 'Fácil',
            component: Lesson1_3_NeedsVsWants_Bernheim,
            emoji: '🛒',
            unlocked: completedLessons.some(p => p.lessonId === '1.2')
          },
          {
            id: '2.1',
            title: 'Tareas y Mesada (framework)',
            description: 'Herramienta de responsabilidad y recompensas - Framework científico de Bernheim',
            duration: '35 min',
            difficulty: 'Fácil',
            component: Lesson2_1_TasksAndAllowance_Bernheim,
            emoji: '⭐',
            unlocked: completedLessons.some(p => p.lessonId === '1.3')
          },
          {
            id: '2.2',
            title: 'Decisiones Inteligentes de Compra (framework)',
            description: 'Herramienta de análisis de decisiones de compra - Framework científico de Bernheim',
            duration: '40 min',
            difficulty: 'Intermedio',
            component: Lesson2_2_SmartPurchaseDecisions_Bernheim,
            emoji: '🧠',
            unlocked: completedLessons.some(p => p.lessonId === '2.1')
          },
          {
            id: '2.3',
            title: 'El Ahorro (framework)',
            description: 'Herramienta de planificación de ahorros - Framework científico de Bernheim',
            duration: '45 min',
            difficulty: 'Intermedio',
            component: Lesson2_3_Saving_Bernheim,
            emoji: '💰',
            unlocked: completedLessons.some(p => p.lessonId === '2.2')
          },
          {
            id: '2.4',
            title: 'Mis Primeras Metas de Ahorro (framework)',
            description: 'Herramienta de establecimiento de metas de ahorro - Framework científico de Bernheim',
            duration: '50 min',
            difficulty: 'Intermedio',
            component: Lesson2_4_MyFirstSavingGoals_Bernheim,
            emoji: '🎯',
            unlocked: completedLessons.some(p => p.lessonId === '2.3')
          },
          {
            id: '3.1',
            title: 'Metas de Ahorro Avanzadas (framework)',
            description: 'Herramienta especializada de planificación de ahorros - Framework científico de Bernheim',
            duration: '45 min',
            difficulty: 'Intermedio',
            component: Lesson_Ages8to10_SavingsGoals_Bernheim,
            emoji: '💰',
            unlocked: completedLessons.some(p => p.lessonId === '2.4')
          },
          {
            id: '3.2',
            title: 'Comparación de Valores (framework)',
            description: 'Herramienta de análisis de valor y comparación - Framework científico de Bernheim',
            duration: '40 min',
            difficulty: 'Intermedio',
            component: Lesson_Ages8to10_ValueComparison_Bernheim,
            emoji: '⚖️',
            unlocked: completedLessons.some(p => p.lessonId === '3.1')
          }
        ];
      case "11-13":
        return [
          {
            id: '1.1',
            title: '¿Qué es un Presupuesto? (framework)',
            description: 'Herramienta práctica 50/30/20 - Framework científico de Bernheim',
            duration: '45 min',
            difficulty: 'Intermedio',
            component: Lesson1_1_WhatIsBudget_Bernheim,
            emoji: '📊',
            unlocked: true
          },
          {
            id: '1.2',
            title: 'Seguimiento de Gastos (framework)',
            description: 'Herramienta de análisis de patrones de gasto - Framework científico de Bernheim',
            duration: '50 min',
            difficulty: 'Intermedio',
            component: Lesson1_2_ExpenseTracking_Bernheim,
            emoji: '📝',
            unlocked: completedLessons.some(p => p.lessonId === '1.1')
          },
          {
            id: '2.1',
            title: '¿Qué es un Banco? (framework)',
            description: 'Herramienta de comprensión del sistema bancario - Framework científico de Bernheim',
            duration: '40 min',
            difficulty: 'Intermedio',
            component: Lesson2_1_WhatIsBank_Bernheim,
            emoji: '🏦',
            unlocked: completedLessons.some(p => p.lessonId === '1.2')
          },
          {
            id: '2.2',
            title: 'Cuentas de Ahorro (framework)',
            description: 'Herramienta de comprensión de intereses y crecimiento - Framework científico de Bernheim',
            duration: '45 min',
            difficulty: 'Intermedio',
            component: Lesson2_2_SavingsAccounts_Bernheim,
            emoji: '💰',
            unlocked: completedLessons.some(p => p.lessonId === '2.1')
          },
          {
            id: '3.1',
            title: 'Comparando Precios y Calidad (framework)',
            description: 'Herramienta de valor por unidad - Framework científico de Bernheim',
            duration: '50 min',
            difficulty: 'Intermedio',
            component: Lesson3_1_PriceQualityComparison_Bernheim,
            emoji: '🔍',
            unlocked: completedLessons.some(p => p.lessonId === '2.2')
          },
          {
            id: '3.2',
            title: 'Ofertas y Descuentos (framework)',
            description: 'Herramienta de análisis de ofertas y descuentos - Framework científico de Bernheim',
            duration: '45 min',
            difficulty: 'Intermedio',
            component: Lesson3_2_OffersAndDiscounts_Bernheim,
            emoji: '🏷️',
            unlocked: completedLessons.some(p => p.lessonId === '3.1')
          },
          {
            id: '4.1',
            title: 'Herramienta de Presupuesto Avanzada (framework)',
            description: 'Herramienta especializada de presupuestación - Framework científico de Bernheim',
            duration: '55 min',
            difficulty: 'Intermedio',
            component: Lesson_Ages11to13_BudgetingTool_Bernheim,
            emoji: '📊',
            unlocked: completedLessons.some(p => p.lessonId === '3.2')
          },
          {
            id: '4.2',
            title: 'Gastos Inteligentes (framework)',
            description: 'Herramienta de análisis de gastos inteligentes - Framework científico de Bernheim',
            duration: '50 min',
            difficulty: 'Intermedio',
            component: Lesson_Ages11to13_SmartSpending_Bernheim,
            emoji: '🧠',
            unlocked: completedLessons.some(p => p.lessonId === '4.1')
          }
        ];
      case "14-16":
        return [
          {
            id: '4.1',
            title: 'Planificación Financiera a Largo Plazo (framework)',
            description: 'Herramienta de planificación financiera estructurada - Framework científico de Bernheim',
            duration: '60 min',
            difficulty: 'Avanzado',
            component: Lesson4_1_PlanificacionFinanciera_Bernheim,
            emoji: '🎯',
            unlocked: true
          },
          {
            id: '4.2',
            title: 'Ingresos y Trabajos de Medio Tiempo (framework)',
            description: 'Herramienta de gestión de ingresos y oportunidades laborales - Framework científico de Bernheim',
            duration: '55 min',
            difficulty: 'Avanzado',
            component: Lesson4_2_IngresosTrabajos_Bernheim,
            emoji: '💼',
            unlocked: completedLessons.some(p => p.lessonId === '4.1')
          },
          {
            id: '5.1',
            title: '¿Qué es el Crédito? (framework)',
            description: 'Herramienta de comprensión del crédito y sus fundamentos - Framework científico de Bernheim',
            duration: '50 min',
            difficulty: 'Avanzado',
            component: Lesson5_1_QueEsCredito_Bernheim,
            emoji: '💳',
            unlocked: completedLessons.some(p => p.lessonId === '4.2')
          },
          {
            id: '5.2',
            title: 'Historial Crediticio y Score (framework)',
            description: 'Herramienta de gestión del historial crediticio - Framework científico de Bernheim',
            duration: '55 min',
            difficulty: 'Avanzado',
            component: Lesson5_2_HistorialCrediticio_Bernheim,
            emoji: '📊',
            unlocked: completedLessons.some(p => p.lessonId === '5.1')
          },
          {
            id: '6.1',
            title: '¿Qué son las Inversiones? (framework)',
            description: 'Herramienta de comprensión de inversiones y activos - Framework científico de Bernheim',
            duration: '60 min',
            difficulty: 'Avanzado',
            component: Lesson6_1_QueSonInversiones_Bernheim,
            emoji: '📈',
            unlocked: completedLessons.some(p => p.lessonId === '5.2')
          },
          {
            id: '6.2',
            title: 'Riesgo y Rendimiento (framework)',
            description: 'Herramienta de análisis de riesgo-rendimiento y diversificación - Framework científico de Bernheim',
            duration: '65 min',
            difficulty: 'Avanzado',
            component: Lesson6_2_RiesgoRendimiento_Bernheim,
            emoji: '⚖️',
            unlocked: completedLessons.some(p => p.lessonId === '6.1')
          },
          {
            id: '7.1',
            title: 'Costos de la Vida Independiente (framework)',
            description: 'Herramienta de planificación de costos de vida independiente - Framework científico de Bernheim',
            duration: '70 min',
            difficulty: 'Avanzado',
            component: Lesson7_1_CostosVidaIndependiente_Bernheim,
            emoji: '🏠',
            unlocked: completedLessons.some(p => p.lessonId === '6.2')
          },
          {
            id: '7.2',
            title: 'Seguros y Protección Financiera (framework)',
            description: 'Herramienta de comprensión de seguros y protección financiera - Framework científico de Bernheim',
            duration: '60 min',
            difficulty: 'Avanzado',
            component: Lesson7_2_SegurosProteccion_Bernheim,
            emoji: '🛡️',
            unlocked: completedLessons.some(p => p.lessonId === '7.1')
          },
          {
            id: '8.1',
            title: 'Interés Compuesto Avanzado (framework)',
            description: 'Herramienta especializada de análisis de interés compuesto - Framework científico de Bernheim',
            duration: '65 min',
            difficulty: 'Avanzado',
            component: Lesson_Ages14to16_CompoundInterest_Bernheim,
            emoji: '📈',
            unlocked: completedLessons.some(p => p.lessonId === '7.2')
          }
        ];
      default:
        return [];
    }
  };

  const lessons = getLessonsByAgeRange(ageRange);

  const handleLessonComplete = (lessonId: string, score: number, progressData: any) => {
    const newProgress: LessonProgress = {
      lessonId,
      score,
      completed: true,
      completedAt: new Date(),
      timeSpent: progressData.endTime - progressData.startTime,
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
        setCurrentLessonId(lessons[nextLessonIndex].id);
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

  const getLessonProgress = (lessonId: string) => {
    return completedLessons.find(p => p.lessonId === lessonId);
  };

  const getTotalPoints = () => {
    return completedLessons.reduce((total, lesson) => total + lesson.score, 0);
  };

  const getCompletionPercentage = () => {
    const completedCount = completedLessons.length;
    return Math.round((completedCount / lessons.length) * 100);
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
            Preparándote para la siguiente aventura...
          </p>
        </div>
      </div>
    );
  }

  // Mostrar lección actual
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

  // Mostrar menú de lecciones
  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">






      {/* Lista de lecciones */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {lessons.map((lesson) => {
          const progress = getLessonProgress(lesson.id);
          const isUnlocked = lesson.unlocked || lesson.id === '1.1';
          
          return (
            <Card 
              key={lesson.id} 
              className={`transition-all duration-200 hover:shadow-lg ${
                !isUnlocked ? 'opacity-60 grayscale' : ''
              } ${progress?.completed ? 'ring-2 ring-green-400 bg-green-50' : ''}`}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center text-2xl ${
                      progress?.completed 
                        ? 'bg-green-100' 
                        : isUnlocked 
                          ? 'bg-blue-100'
                          : 'bg-gray-100'
                    }`}>
                      {progress?.completed ? '✅' : lesson.emoji}
                    </div>
                    <div>
                      <CardTitle className="text-lg">Lección {lesson.id}</CardTitle>
                      <h3 className="font-semibold text-gray-900">{lesson.title}</h3>
                    </div>
                  </div>
                  <Badge 
                    variant="outline" 
                    className={
                      lesson.difficulty === 'Fácil' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-yellow-100 text-yellow-800'
                    }
                  >
                    {lesson.difficulty}
                  </Badge>
                </div>
                <p className="text-gray-600 text-sm">{lesson.description}</p>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {progress?.completed && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-green-800">Completada</span>
                        <div className="flex items-center space-x-2">
                          <Star className="w-4 h-4 text-yellow-500" />
                          <span className="font-bold">{progress.score}/100</span>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <div className="flex items-center justify-between text-sm text-gray-500">
                    <div className="flex items-center space-x-2">
                      <Clock className="w-4 h-4" />
                      <span>{lesson.duration}</span>
                    </div>
                  </div>
                  
                  <Button 
                    className="w-full"
                    disabled={!isUnlocked}
                    onClick={() => startLesson(lesson.id)}
                  >
                    {progress?.completed ? (
                      <>
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Repasar
                      </>
                    ) : !isUnlocked ? (
                      <>
                        🔒 Bloqueada
                      </>
                    ) : (
                      <>
                        <PlayCircle className="w-4 h-4 mr-2" />
                        Comenzar
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Mensaje motivacional */}
      {completedLessons.length === 0 && (
        <Card className="bg-gradient-to-r from-yellow-50 to-orange-50 border-yellow-200">
          <CardContent className="p-6 text-center">
            <div className="text-4xl mb-4">🌟</div>
            <h3 className="text-xl font-bold text-orange-800 mb-2">
              ¡Comienza tu Aventura Financiera!
            </h3>
            <p className="text-orange-700">
              Únete a Lucas, Sol, Mila y Max en emocionantes aventuras donde aprenderás 
              todo sobre el dinero de manera divertida e interactiva.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Certificado virtual si completa todo */}
      {completedLessons.length === lessons.length && (
        <Card className="bg-gradient-to-r from-yellow-50 via-orange-50 to-red-50 border-yellow-300">
          <CardContent className="p-6 text-center">
            <div className="text-6xl mb-4">🏆</div>
            <h3 className="text-2xl font-bold text-yellow-800 mb-2">
              ¡Explorador Financiero Certificado!
            </h3>
            <p className="text-yellow-700 mb-4">
              Has completado todas las lecciones del Nivel 1. 
              ¡Ahora entiendes los conceptos básicos del dinero!
            </p>
            <div className="flex justify-center">
              <Badge className="bg-yellow-100 text-yellow-800 text-lg px-4 py-2">
                <Award className="w-5 h-5 mr-2" />
                Certificado Ganado
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default LessonPlayer;
