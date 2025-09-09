import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  StepBasedLesson,
  characters 
} from './LessonComponents';
import { ChevronRight, ChevronLeft, Home, TrendingUp, TrendingDown, FileText, Calculator } from 'lucide-react';

interface Lesson5_2Props {
  onComplete: (score: number, progress: any) => void;
  onExit: () => void;
}

const Lesson5_2_HistorialCrediticio: React.FC<Lesson5_2Props> = ({ onComplete, onExit }) => {
  const lucas = characters.lucas;
  const sol = characters.sol;
  const maestroDinero = characters.maestro_dinero;

  // Step-based lesson structure - each step shows one thing at a time
  const lessonSteps = [
    // Step 1: Hook/Introduction
    {
      id: 'hook',
      type: 'information' as const,
      title: 'El Reporte Misterioso',
      character: lucas,
      content: {
        message: "¡Hola! Soy Lucas y tengo 16 años. Mi papá me dijo que cuando sea mayor, los bancos van a revisar mi 'historial crediticio' y mi 'score' para decidir si me prestan dinero. ¿Qué son esas cosas y cómo puedo empezar a construirlos bien?",
        content: (
          <div className="text-center space-y-4">
            <div className="text-6xl">📊🔍</div>
            <p className="text-lg font-medium text-gray-700">
              Lucas quiere entender su historial crediticio
            </p>
            <div className="bg-purple-100 p-4 rounded-lg">
              <p className="text-sm text-purple-800">
                <strong>Misión:</strong> Construir un historial crediticio sólido desde joven
              </p>
            </div>
          </div>
        )
      }
    },

    // Step 2: Learning Objective
    {
      id: 'objective',
      type: 'information' as const,
      title: 'Nuestra Misión de Hoy',
      character: maestroDinero,
      content: {
        message: "¡Hola joven constructor de crédito! Soy el Maestro Dinero, y hoy vamos a aprender sobre el historial crediticio y el score. Es como tu 'reporte de calificaciones' financiero.",
        content: (
          <div className="space-y-4">
            <div className="bg-blue-100 p-4 rounded-lg">
              <h3 className="font-bold text-blue-800 mb-2">¿Qué vamos a aprender hoy?</h3>
              <ul className="space-y-2 text-sm text-blue-700">
                <li>• Entender qué es el historial crediticio</li>
                <li>• Comprender cómo funciona el score crediticio</li>
                <li>• Aprender hábitos para construir buen crédito</li>
                <li>• Evitar errores que dañan tu historial</li>
              </ul>
            </div>
          </div>
        )
      }
    },

    // Step 3: Information about credit history
    {
      id: 'credit-history-info',
      type: 'information' as const,
      title: '¿Qué es el Historial Crediticio?',
      character: sol,
      content: {
        message: "¡Hola! Soy Sol y me encanta explicar conceptos importantes. El historial crediticio es como tu 'libro de vida' financiero.",
        content: (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-4 bg-green-100 rounded-lg">
                <div className="text-4xl mb-2">📝</div>
                <p className="text-sm font-medium">Registro</p>
                <p className="text-xs text-gray-600">Todas tus actividades crediticias</p>
              </div>
              <div className="text-center p-4 bg-blue-100 rounded-lg">
                <div className="text-4xl mb-2">⏰</div>
                <p className="text-sm font-medium">Historial</p>
                <p className="text-xs text-gray-600">Se mantiene por muchos años</p>
              </div>
              <div className="text-center p-4 bg-yellow-100 rounded-lg">
                <div className="text-4xl mb-2">👁️</div>
                <p className="text-sm font-medium">Visibilidad</p>
                <p className="text-xs text-gray-600">Los bancos pueden verlo</p>
              </div>
            </div>
            <div className="bg-orange-100 p-4 rounded-lg">
              <p className="text-sm text-orange-800">
                <strong>Definición:</strong> El historial crediticio es un registro detallado de cómo has manejado el crédito en el pasado, incluyendo préstamos, tarjetas de crédito y pagos.
              </p>
            </div>
          </div>
        )
      }
    },

    // Step 4: Activity - Understanding credit history
    {
      id: 'credit-history-activity',
      type: 'activity' as const,
      title: '¿Qué Incluye tu Historial?',
      character: lucas,
      points: 25,
      content: {
        type: 'question',
        description: 'Ayuda a Lucas a entender qué información incluye su historial crediticio',
        question: "¿Cuál de estas actividades NO aparece en tu historial crediticio?",
        options: [
          "Pagos de tarjeta de crédito",
          "Préstamos estudiantiles",
          "Pagos de servicios públicos",
          "Compras con dinero en efectivo"
        ],
        correct: 3,
        feedback: "¡Correcto! Las compras con dinero en efectivo NO aparecen en tu historial crediticio porque no involucran crédito. Solo las actividades que usan crédito se registran."
      }
    },

    // Step 5: Comment after activity
    {
      id: 'credit-history-comment',
      type: 'comment' as const,
      title: '¡Buen Trabajo!',
      character: sol,
      content: {
        message: "¡Perfecto! Ya entiendes qué se incluye en tu historial crediticio. Ahora vamos a aprender sobre el score crediticio.",
        content: (
          <div className="bg-green-100 p-4 rounded-lg">
            <p className="text-sm text-green-800">
              <strong>Recuerda:</strong> Solo las actividades que involucran crédito aparecen en tu historial.
            </p>
          </div>
        )
      }
    },

    // Step 6: Information about credit score
    {
      id: 'credit-score-info',
      type: 'information' as const,
      title: '¿Qué es el Score Crediticio?',
      character: maestroDinero,
      content: {
        message: "El score crediticio es como una calificación que resume tu historial crediticio en un número. Es tu 'nota' financiera.",
        content: (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                <h4 className="font-bold text-green-800 mb-2">📈 Score Alto (700-850)</h4>
                <ul className="text-sm text-green-700 space-y-1">
                  <li>• Pagos siempre a tiempo</li>
                  <li>• Bajo uso de crédito disponible</li>
                  <li>• Historial crediticio largo</li>
                  <li>• Mejores tasas de interés</li>
                  <li>• Más opciones de crédito</li>
                </ul>
              </div>
              <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                <h4 className="font-bold text-red-800 mb-2">📉 Score Bajo (300-600)</h4>
                <ul className="text-sm text-red-700 space-y-1">
                  <li>• Pagos atrasados o faltantes</li>
                  <li>• Alto uso de crédito disponible</li>
                  <li>• Historial crediticio corto</li>
                  <li>• Tasas de interés más altas</li>
                  <li>• Menos opciones de crédito</li>
                </ul>
              </div>
            </div>
            <div className="bg-blue-100 p-4 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Rango típico:</strong> Los scores van de 300 a 850. Un score de 700 o más se considera bueno.
              </p>
            </div>
          </div>
        )
      }
    },

    // Step 7: Activity - Credit score factors
    {
      id: 'credit-score-activity',
      type: 'activity' as const,
      title: 'Factores del Score Crediticio',
      character: lucas,
      points: 30,
      content: {
        type: 'question',
        description: 'Ayuda a Lucas a entender qué factores afectan su score crediticio',
        question: "¿Cuál de estos factores tiene el mayor impacto en tu score crediticio?",
        options: [
          "Historial de pagos (35%)",
          "Cantidad de deuda (30%)",
          "Antigüedad del crédito (15%)",
          "Nuevas solicitudes de crédito (10%)"
        ],
        correct: 0,
        feedback: "¡Correcto! El historial de pagos tiene el mayor impacto (35%). Pagar siempre a tiempo es la forma más importante de mantener un buen score."
      }
    },

    // Step 8: Comment after score activity
    {
      id: 'score-comment',
      type: 'comment' as const,
      title: '¡Score Comprendido!',
      character: sol,
      content: {
        message: "¡Excelente! Ya entiendes cómo funciona el score crediticio. Ahora vamos a aprender hábitos para construir un buen historial.",
        content: (
          <div className="bg-yellow-100 p-4 rounded-lg">
            <p className="text-sm text-yellow-800">
              <strong>Consejo:</strong> Tu score crediticio se construye con el tiempo. Comenzar temprano te da ventaja.
            </p>
          </div>
        )
      }
    },

    // Step 9: Information about building good credit
    {
      id: 'building-credit-info',
      type: 'information' as const,
      title: 'Hábitos para Construir Buen Crédito',
      character: maestroDinero,
      content: {
        message: "Construir un buen historial crediticio es como construir una reputación. Toma tiempo y consistencia.",
        content: (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                <h4 className="font-bold text-green-800 mb-2">✅ Hábitos Positivos</h4>
                <ul className="text-sm text-green-700 space-y-1">
                  <li>• Pagar siempre a tiempo</li>
                  <li>• Mantener saldos bajos</li>
                  <li>• No solicitar mucho crédito</li>
                  <li>• Mantener cuentas abiertas</li>
                  <li>• Revisar tu reporte regularmente</li>
                </ul>
              </div>
              <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                <h4 className="font-bold text-red-800 mb-2">❌ Errores a Evitar</h4>
                <ul className="text-sm text-red-700 space-y-1">
                  <li>• Pagos atrasados</li>
                  <li>• Usar todo tu límite de crédito</li>
                  <li>• Solicitar muchas tarjetas</li>
                  <li>• Cerrar cuentas antiguas</li>
                  <li>• Ignorar tu reporte crediticio</li>
                </ul>
              </div>
            </div>
            <div className="bg-purple-100 p-4 rounded-lg">
              <p className="text-sm text-purple-800">
                <strong>Estrategia:</strong> Comienza con una tarjeta de crédito asegurada o una cuenta bancaria con línea de crédito para construir historial.
              </p>
            </div>
          </div>
        )
      }
    },

    // Step 10: Activity - Building credit habits
    {
      id: 'building-credit-activity',
      type: 'activity' as const,
      title: 'Construye tu Score Crediticio',
      character: lucas,
      points: 25,
      content: {
        type: 'question',
        description: 'Ayuda a Lucas a elegir la mejor estrategia para construir su historial crediticio',
        question: "Lucas tiene 16 años y quiere empezar a construir su historial crediticio. ¿Cuál es la mejor opción para él?",
        options: [
          "Solicitar 5 tarjetas de crédito diferentes",
          "Abrir una cuenta bancaria y usar una tarjeta de débito",
          "Pedir un préstamo grande para comprar un carro",
          "Ser usuario autorizado en la tarjeta de sus padres"
        ],
        correct: 3,
        feedback: "¡Excelente elección! Ser usuario autorizado en la tarjeta de sus padres es la mejor opción. Lucas puede construir historial sin responsabilidad legal y aprender buenos hábitos."
      }
    },

    // Step 11: Final reflection
    {
      id: 'final-reflection',
      type: 'comment' as const,
      title: '¡Historial Crediticio Comprendido!',
      character: maestroDinero,
      content: {
        message: "¡Felicitaciones! Has completado tu lección sobre historial crediticio y score. Ahora entiendes cómo construir un futuro financiero sólido.",
        content: (
          <div className="space-y-4">
            <div className="bg-gradient-to-r from-green-100 to-blue-100 p-4 rounded-lg">
              <h3 className="font-bold text-green-800 mb-2">Lo que aprendiste hoy:</h3>
              <ul className="space-y-1 text-sm text-green-700">
                <li>✅ Entender qué es el historial crediticio</li>
                <li>✅ Comprender cómo funciona el score crediticio</li>
                <li>✅ Aprender hábitos para construir buen crédito</li>
                <li>✅ Evitar errores que dañan tu historial</li>
              </ul>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-600">
                ¡Ahora puedes construir un historial crediticio sólido desde joven!
              </p>
            </div>
          </div>
        )
      }
    },

    // Step 12: Reflection moment
    {
      id: 'reflection-moment',
      type: 'reflection' as const,
      title: 'Momento de Reflexión',
      character: maestroDinero,
      content: {
        question: "¿Qué hábitos financieros quieres desarrollar para construir un buen historial crediticio?",
        message: "Antes de terminar, piensa en tu futuro financiero. ¿Qué pasos puedes dar ahora para construir un historial crediticio sólido? ¿Cómo te asegurarás de mantener buenos hábitos?",
        rewards: {
          points: 50,
          badges: ["Constructor de Crédito", "Score Master"],
          stickers: ["📊", "📈", "⭐", "🎯"]
        }
      }
    }
  ];

  const handleStepComplete = (stepId: string, points?: number) => {
    console.log(`Step ${stepId} completed with ${points} points`);
  };

  const handleLessonComplete = (score: number, progress: any) => {
    onComplete(score, progress);
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <StepBasedLesson
        steps={lessonSteps}
        onStepComplete={handleStepComplete}
        onLessonComplete={handleLessonComplete}
        onExit={onExit}
      />
    </div>
  );
};

export default Lesson5_2_HistorialCrediticio;
