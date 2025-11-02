import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  StepBasedLesson,
  characters 
} from './LessonComponents';
import { ChevronRight, ChevronLeft, Home, PiggyBank, DollarSign, CheckCircle, Clock, Star } from 'lucide-react';

interface Lesson2_3Props {
  onComplete: (score: number, progress: any) => void;
  onExit: () => void;
}

const Lesson2_3_Saving: React.FC<Lesson2_3Props> = ({ onComplete, onExit }) => {
  const lucas = characters.lucas;
  const sol = characters.sol;
  const maestroDinero = characters.maestro_dinero;

  // Step-based lesson structure - each step shows one thing at a time
  const lessonSteps = [
    // Step 1: Hook/Introduction
    {
      id: 'hook',
      type: 'information' as const,
      title: 'El Sueño de Lucas por una Bicicleta',
      character: lucas,
      content: {
        message: "¡Hola! Soy Lucas y tengo un sueño muy especial. Quiero una bicicleta nueva que cuesta $120, pero solo tengo $20. Mis papás me dijeron que necesito ahorrar. ¿Me puedes ayudar a entender qué es ahorrar?",
        content: (
          <div className="text-center space-y-4">
            <div className="text-6xl">🚲❓</div>
            <p className="text-lg font-medium text-gray-700">
              Lucas quiere una bicicleta por $120
            </p>
            <div className="bg-blue-100 p-4 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Nuevo concepto:</strong> El ahorro para alcanzar metas
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
        message: "¡Hola pequeño ahorrador! Soy el Maestro Dinero, y hoy vamos a aprender uno de los conceptos más importantes de las finanzas: el ahorro.",
        content: (
          <div className="space-y-4">
            <div className="bg-green-100 p-4 rounded-lg">
              <h3 className="font-bold text-green-800 mb-2">¿Qué vamos a aprender hoy?</h3>
              <ul className="space-y-2 text-sm text-green-700">
                <li>• Comprender la importancia del ahorro</li>
                <li>• Establecer metas de ahorro simples</li>
                <li>• Desarrollar paciencia para gratificación diferida</li>
                <li>• Ayudar a Lucas a crear un plan de ahorro</li>
              </ul>
            </div>
          </div>
        )
      }
    },

    // Step 3: Information about saving
    {
      id: 'saving-info',
      type: 'information' as const,
      title: '¿Qué es el Ahorro?',
      character: sol,
      content: {
        message: "¡Hola! Soy Sol y me encanta planificar. Te voy a explicar qué es el ahorro y por qué es tan importante.",
        content: (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-4 bg-red-100 rounded-lg">
                <div className="text-4xl mb-2">💸</div>
                <p className="text-sm font-medium">Gastar Todo</p>
                <p className="text-xs text-gray-600">Dinero se acaba rápido</p>
              </div>
              <div className="text-center p-4 bg-green-100 rounded-lg">
                <div className="text-4xl mb-2">💰</div>
                <p className="text-sm font-medium">Ahorrar</p>
                <p className="text-xs text-gray-600">Dinero crece con el tiempo</p>
              </div>
            </div>
            <div className="bg-purple-100 p-4 rounded-lg">
              <p className="text-sm text-purple-800">
                <strong>El ahorro:</strong> Es guardar parte de tu dinero para usarlo en el futuro para algo importante.
              </p>
            </div>
          </div>
        )
      }
    },

    // Step 4: Activity - Understanding saving
    {
      id: 'understanding-saving-activity',
      type: 'activity' as const,
      title: '¿Qué es Ahorrar?',
      character: lucas,
      points: 20,
      content: {
        type: 'question',
        description: 'Ayuda a Lucas a entender qué significa ahorrar',
        question: "Lucas está pensando en qué significa ahorrar. ¿Cuál de estas opciones describe mejor el ahorro?",
        options: [
          "💰 Guardar parte de tu dinero para usarlo después",
          "💸 Gastar todo tu dinero en cosas que quieres ahora", 
          "🎁 Pedirle dinero a otras personas",
          "🚫 No usar dinero nunca"
        ],
        correct: 0, // Guardar dinero es correcto
        feedback: "¡Excelente! Ahorrar significa guardar parte de tu dinero para usarlo en el futuro para algo importante."
      }
    },

    // Step 5: Comment after activity
    {
      id: 'understanding-saving-comment',
      type: 'comment' as const,
      title: '¡Muy Bien!',
      character: sol,
      content: {
        message: "¡Perfecto! Ya entiendes qué es el ahorro. Es como guardar tesoros para usarlos cuando realmente los necesites.",
        content: (
          <div className="bg-green-100 p-4 rounded-lg">
            <p className="text-sm text-green-800">
              <strong>Recuerda:</strong> El ahorro te permite alcanzar metas más grandes en el futuro.
            </p>
          </div>
        )
      }
    },

    // Step 6: Information about saving goals
    {
      id: 'saving-goals-info',
      type: 'information' as const,
      title: 'Metas de Ahorro',
      character: maestroDinero,
      content: {
        message: "Ahora vamos a aprender cómo establecer metas de ahorro que sean realistas y motivadoras.",
        content: (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center p-3 bg-yellow-100 rounded-lg">
                <div className="text-2xl mb-1">🎯</div>
                <p className="text-xs font-bold">Meta Clara</p>
                <p className="text-xs text-gray-600">¿Qué quieres?</p>
              </div>
              <div className="text-center p-3 bg-green-100 rounded-lg">
                <div className="text-2xl mb-1">💰</div>
                <p className="text-xs font-bold">Cantidad</p>
                <p className="text-xs text-gray-600">¿Cuánto cuesta?</p>
              </div>
              <div className="text-center p-3 bg-blue-100 rounded-lg">
                <div className="text-2xl mb-1">⏰</div>
                <p className="text-xs font-bold">Tiempo</p>
                <p className="text-xs text-gray-600">¿Cuándo lo quieres?</p>
              </div>
            </div>
            <div className="bg-blue-100 p-4 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Una buena meta:</strong> Es específica, realista y te motiva a ahorrar.
              </p>
            </div>
          </div>
        )
      }
    },

    // Step 7: Activity - Setting saving goals
    {
      id: 'setting-goals-activity',
      type: 'activity' as const,
      title: '¿Cuál es una Buena Meta de Ahorro?',
      character: lucas,
      points: 30,
      content: {
        type: 'question',
        description: 'Ayuda a Lucas a identificar una buena meta de ahorro',
        question: "Lucas está pensando en diferentes metas de ahorro. ¿Cuál crees que es una buena meta?",
        options: [
          "🚲 Ahorrar $120 para una bicicleta en 6 meses",
          "🏠 Ahorrar $1,000,000 para una casa mañana", 
          "🍭 Ahorrar $5 para dulces la próxima semana",
          "🚀 Ahorrar $50,000 para un viaje al espacio"
        ],
        correct: 0, // Bicicleta es una buena meta
        feedback: "¡Excelente! Ahorrar $120 para una bicicleta en 6 meses es una meta realista y específica. Lucas puede lograrla ahorrando $20 por mes."
      }
    },

    // Step 8: Comment after goals
    {
      id: 'goals-comment',
      type: 'comment' as const,
      title: '¡Buen Trabajo con las Metas!',
      character: sol,
      content: {
        message: "¡Muy bien! Ya sabes identificar buenas metas de ahorro. Una meta debe ser realista y específica.",
        content: (
          <div className="bg-orange-100 p-4 rounded-lg">
            <p className="text-sm text-orange-800">
              <strong>La meta de Lucas:</strong> $120 para una bicicleta. Necesita ahorrar $20 por mes durante 6 meses.
            </p>
          </div>
        )
      }
    },

    // Step 9: Information about delayed gratification
    {
      id: 'delayed-gratification-info',
      type: 'information' as const,
      title: 'La Paciencia es Importante',
      character: maestroDinero,
      content: {
        message: "Ahora vamos a aprender algo muy importante: la gratificación diferida, que significa esperar para obtener algo mejor.",
        content: (
          <div className="space-y-4">
            <div className="flex items-center justify-center space-x-4">
              <div className="text-center">
                <div className="text-3xl mb-2">🍭</div>
                <p className="text-sm font-medium">Dulce Ahora</p>
                <p className="text-xs text-gray-600">$2</p>
              </div>
              <div className="text-2xl">vs</div>
              <div className="text-center">
                <div className="text-3xl mb-2">🚲</div>
                <p className="text-sm font-medium">Bicicleta Después</p>
                <p className="text-xs text-gray-600">$120</p>
              </div>
            </div>
            <div className="bg-purple-100 p-4 rounded-lg">
              <p className="text-sm text-purple-800">
                <strong>La lección:</strong> A veces es mejor esperar y ahorrar para algo más grande y especial.
              </p>
            </div>
          </div>
        )
      }
    },

    // Step 10: Final activity - Saving plan
    {
      id: 'saving-plan-activity',
      type: 'activity' as const,
      title: '¿Cuál es el Mejor Plan de Ahorro?',
      character: lucas,
      points: 25,
      content: {
        type: 'question',
        description: 'Ayuda a Lucas a crear el mejor plan de ahorro para su bicicleta',
        question: "Lucas tiene $20 y quiere ahorrar $120 para su bicicleta. ¿Cuál es el mejor plan de ahorro?",
        options: [
          "Ahorrar $20 por mes durante 5 meses ($20 x 5 = $100 + $20 inicial = $120)",
          "Gastar todo su dinero en dulces y esperar que sus papás le compren la bicicleta",
          "Ahorrar $5 por mes durante 20 meses",
          "Pedirle dinero prestado a sus amigos"
        ],
        correct: 0, // $20 por mes es el mejor plan
        feedback: "¡Excelente plan! Ahorrar $20 por mes durante 5 meses le dará a Lucas exactamente los $120 que necesita para su bicicleta."
      }
    },

    // Step 11: Final reflection
    {
      id: 'final-reflection',
      type: 'comment' as const,
      title: '¡Lección Completada!',
      character: maestroDinero,
      content: {
        message: "¡Felicitaciones! Has completado tu lección sobre el ahorro. Ahora sabes cómo guardar dinero para alcanzar tus metas.",
        content: (
          <div className="space-y-4">
            <div className="bg-gradient-to-r from-green-100 to-blue-100 p-4 rounded-lg">
              <h3 className="font-bold text-green-800 mb-2">Lo que aprendiste hoy:</h3>
              <ul className="space-y-1 text-sm text-green-700">
                <li>✅ Entender qué es el ahorro</li>
                <li>✅ Establecer metas de ahorro realistas</li>
                <li>✅ Desarrollar paciencia para gratificación diferida</li>
                <li>✅ Crear planes de ahorro efectivos</li>
              </ul>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-600">
                ¡Ahora puedes ayudar a Lucas y a otros amigos a alcanzar sus metas de ahorro!
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
        question: "¿Qué te gustaría ahorrar para en el futuro?",
        message: "Antes de terminar, piensa en algo que te gustaría ahorrar para comprar. ¿Qué es y cuánto dinero necesitarías?",
        rewards: {
          points: 50,
          badges: ["Ahorrador Inteligente", "Amigo de Lucas"],
          stickers: ["💰", "🚲", "🎯", "⭐"]
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

export default Lesson2_3_Saving;
