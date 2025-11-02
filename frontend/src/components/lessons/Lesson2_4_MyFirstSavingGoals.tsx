import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  StepBasedLesson,
  characters 
} from './LessonComponents';
import { ChevronRight, ChevronLeft, Home, Trophy, DollarSign, CheckCircle, Clock, Star } from 'lucide-react';

interface Lesson2_4Props {
  onComplete: (score: number, progress: any) => void;
  onExit: () => void;
}

const Lesson2_4_MyFirstSavingGoals: React.FC<Lesson2_4Props> = ({ onComplete, onExit }) => {
  const lucas = characters.lucas;
  const sol = characters.sol;
  const maestroDinero = characters.maestro_dinero;

  // Step-based lesson structure - each step shows one thing at a time
  const lessonSteps = [
    // Step 1: Hook/Introduction
    {
      id: 'hook',
      type: 'information' as const,
      title: 'Los Múltiples Sueños de Lucas',
      character: lucas,
      content: {
        message: "¡Hola! Soy Lucas y tengo muchos sueños. Quiero una bicicleta ($120), un videojuego ($80), y también ahorrar para mi cumpleaños ($50). Pero solo tengo $30. ¿Me puedes ayudar a organizar mis metas de ahorro?",
        content: (
          <div className="text-center space-y-4">
            <div className="text-6xl">🎯❓</div>
            <p className="text-lg font-medium text-gray-700">
              Lucas tiene múltiples metas de ahorro
            </p>
            <div className="bg-blue-100 p-4 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Nuevo desafío:</strong> Organizar y priorizar metas de ahorro
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
        message: "¡Hola pequeño planificador! Soy el Maestro Dinero, y hoy vamos a aprender cómo establecer y organizar metas de ahorro de manera efectiva.",
        content: (
          <div className="space-y-4">
            <div className="bg-green-100 p-4 rounded-lg">
              <h3 className="font-bold text-green-800 mb-2">¿Qué vamos a aprender hoy?</h3>
              <ul className="space-y-2 text-sm text-green-700">
                <li>• Establecer objetivos de ahorro realistas y específicos</li>
                <li>• Calcular cuánto tiempo necesitan para lograr sus metas</li>
                <li>• Mantener motivación durante el proceso de ahorro</li>
                <li>• Ayudar a Lucas a crear un plan de metas múltiples</li>
              </ul>
            </div>
          </div>
        )
      }
    },

    // Step 3: Information about multiple goals
    {
      id: 'multiple-goals-info',
      type: 'information' as const,
      title: '¿Cómo Organizar Múltiples Metas?',
      character: sol,
      content: {
        message: "¡Hola! Soy Sol y me encanta organizar. Te voy a explicar cómo manejar múltiples metas de ahorro de manera inteligente.",
        content: (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-4 bg-yellow-100 rounded-lg">
                <div className="text-4xl mb-2">🚲</div>
                <p className="text-sm font-medium">Meta Grande</p>
                <p className="text-xs text-gray-600">$120 - Bicicleta</p>
              </div>
              <div className="text-center p-4 bg-green-100 rounded-lg">
                <div className="text-4xl mb-2">🎮</div>
                <p className="text-sm font-medium">Meta Mediana</p>
                <p className="text-xs text-gray-600">$80 - Videojuego</p>
              </div>
              <div className="text-center p-4 bg-blue-100 rounded-lg">
                <div className="text-4xl mb-2">🎂</div>
                <p className="text-sm font-medium">Meta Pequeña</p>
                <p className="text-xs text-gray-600">$50 - Cumpleaños</p>
              </div>
            </div>
            <div className="bg-purple-100 p-4 rounded-lg">
              <p className="text-sm text-purple-800">
                <strong>La estrategia:</strong> Organizar metas por tamaño y prioridad para crear un plan efectivo.
              </p>
            </div>
          </div>
        )
      }
    },

    // Step 4: Activity - Goal prioritization
    {
      id: 'goal-prioritization-activity',
      type: 'activity' as const,
      title: '¿Cuál Debería ser la Prioridad?',
      character: lucas,
      points: 20,
      content: {
        type: 'question',
        description: 'Ayuda a Lucas a priorizar sus metas de ahorro',
        question: "Lucas tiene $30 y estas metas: Bicicleta ($120), Videojuego ($80), Ahorro para cumpleaños ($50). ¿Cuál debería ser su primera prioridad?",
        options: [
          "🚲 Bicicleta - porque es lo más caro y útil",
          "🎮 Videojuego - porque es lo más divertido", 
          "🎂 Ahorro para cumpleaños - porque es lo más fácil de lograr",
          "💸 Gastar todo en dulces ahora"
        ],
        correct: 2, // Cumpleaños es lo más fácil de lograr
        feedback: "¡Excelente! Empezar con la meta más pequeña ($50) es inteligente porque Lucas puede lograrla más rápido y mantenerse motivado."
      }
    },

    // Step 5: Comment after prioritization
    {
      id: 'prioritization-comment',
      type: 'comment' as const,
      title: '¡Muy Bien!',
      character: sol,
      content: {
        message: "¡Perfecto! Ya sabes priorizar metas. Empezar con metas pequeñas te ayuda a mantener la motivación y crear el hábito de ahorrar.",
        content: (
          <div className="bg-green-100 p-4 rounded-lg">
            <p className="text-sm text-green-800">
              <strong>Recuerda:</strong> Las metas pequeñas te dan victorias rápidas que te motivan a seguir ahorrando.
            </p>
          </div>
        )
      }
    },

    // Step 6: Information about time calculation
    {
      id: 'time-calculation-info',
      type: 'information' as const,
      title: 'Calculando el Tiempo Necesario',
      character: maestroDinero,
      content: {
        message: "Ahora vamos a aprender cómo calcular cuánto tiempo necesitas para alcanzar cada meta.",
        content: (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center p-3 bg-yellow-100 rounded-lg">
                <div className="text-2xl mb-1">🎯</div>
                <p className="text-xs font-bold">Meta</p>
                <p className="text-xs text-gray-600">$50</p>
              </div>
              <div className="text-center p-3 bg-green-100 rounded-lg">
                <div className="text-2xl mb-1">💰</div>
                <p className="text-xs font-bold">Ahorro Mensual</p>
                <p className="text-xs text-gray-600">$10</p>
              </div>
              <div className="text-center p-3 bg-blue-100 rounded-lg">
                <div className="text-2xl mb-1">⏰</div>
                <p className="text-xs font-bold">Tiempo</p>
                <p className="text-xs text-gray-600">5 meses</p>
              </div>
            </div>
            <div className="bg-blue-100 p-4 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>La fórmula:</strong> Meta ÷ Ahorro mensual = Tiempo necesario
              </p>
            </div>
          </div>
        )
      }
    },

    // Step 7: Activity - Time calculation
    {
      id: 'time-calculation-activity',
      type: 'activity' as const,
      title: 'Calcula el Tiempo para Cada Meta',
      character: lucas,
      points: 30,
      content: {
        type: 'question',
        description: 'Ayuda a Lucas a calcular cuánto tiempo necesita para cada meta',
        question: "Lucas puede ahorrar $15 por mes. ¿Cuántos meses necesita para ahorrar $80 para su videojuego?",
        options: [
          "4 meses ($15 x 4 = $60)",
          "5 meses ($15 x 5 = $75)", 
          "6 meses ($15 x 6 = $90)",
          "8 meses ($15 x 8 = $120)"
        ],
        correct: 2, // 6 meses es correcto
        feedback: "¡Excelente! Lucas necesita 6 meses para ahorrar $90, que es suficiente para su videojuego de $80."
      }
    },

    // Step 8: Comment after calculation
    {
      id: 'calculation-comment',
      type: 'comment' as const,
      title: '¡Buen Trabajo Calculando!',
      character: sol,
      content: {
        message: "¡Muy bien! Ya sabes calcular el tiempo necesario para tus metas. Esto te ayuda a planificar mejor tu ahorro.",
        content: (
          <div className="bg-orange-100 p-4 rounded-lg">
            <p className="text-sm text-orange-800">
              <strong>El plan de Lucas:</strong> $15 por mes = 6 meses para el videojuego, 4 meses para cumpleaños, 8 meses para la bicicleta.
            </p>
          </div>
        )
      }
    },

    // Step 9: Information about motivation
    {
      id: 'motivation-info',
      type: 'information' as const,
      title: 'Mantener la Motivación',
      character: maestroDinero,
      content: {
        message: "Ahora vamos a aprender cómo mantenerse motivado durante todo el proceso de ahorro.",
        content: (
          <div className="space-y-4">
            <div className="flex items-center justify-center space-x-4">
              <div className="text-center">
                <div className="text-3xl mb-2">📊</div>
                <p className="text-sm font-medium">Seguimiento</p>
              </div>
              <div className="text-2xl">→</div>
              <div className="text-center">
                <div className="text-3xl mb-2">🎉</div>
                <p className="text-sm font-medium">Celebración</p>
              </div>
              <div className="text-2xl">→</div>
              <div className="text-center">
                <div className="text-3xl mb-2">🚀</div>
                <p className="text-sm font-medium">Continuar</p>
              </div>
            </div>
            <div className="bg-purple-100 p-4 rounded-lg">
              <p className="text-sm text-purple-800">
                <strong>El ciclo de motivación:</strong> Seguimiento visual + celebración de logros = motivación para continuar.
              </p>
            </div>
          </div>
        )
      }
    },

    // Step 10: Final activity - Complete plan
    {
      id: 'complete-plan-activity',
      type: 'activity' as const,
      title: '¿Cuál es el Mejor Plan Completo?',
      character: lucas,
      points: 25,
      content: {
        type: 'question',
        description: 'Ayuda a Lucas a crear el mejor plan para todas sus metas',
        question: "Lucas tiene $30 y puede ahorrar $15 por mes. ¿Cuál es el mejor plan para sus metas?",
        options: [
          "Empezar con cumpleaños ($50), luego videojuego ($80), finalmente bicicleta ($120)",
          "Ahorrar todo para la bicicleta primero porque es lo más caro",
          "Gastar $30 en dulces y olvidarse de ahorrar",
          "Pedirle dinero prestado a todos sus amigos"
        ],
        correct: 0, // Plan progresivo es el mejor
        feedback: "¡Excelente plan! Empezar con metas pequeñas y progresar hacia metas más grandes es la estrategia más efectiva y motivadora."
      }
    },

    // Step 11: Final reflection
    {
      id: 'final-reflection',
      type: 'comment' as const,
      title: '¡Lección Completada!',
      character: maestroDinero,
      content: {
        message: "¡Felicitaciones! Has completado tu lección sobre metas de ahorro. Ahora sabes cómo establecer, organizar y alcanzar múltiples metas financieras.",
        content: (
          <div className="space-y-4">
            <div className="bg-gradient-to-r from-green-100 to-blue-100 p-4 rounded-lg">
              <h3 className="font-bold text-green-800 mb-2">Lo que aprendiste hoy:</h3>
              <ul className="space-y-1 text-sm text-green-700">
                <li>✅ Establecer metas de ahorro realistas y específicas</li>
                <li>✅ Calcular el tiempo necesario para cada meta</li>
                <li>✅ Priorizar metas por tamaño y facilidad</li>
                <li>✅ Mantener motivación durante el proceso</li>
              </ul>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-600">
                ¡Ahora puedes ayudar a Lucas y a otros amigos a crear planes de ahorro efectivos!
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
        question: "¿Cuáles son tus metas de ahorro más importantes?",
        message: "Antes de terminar, piensa en 2-3 metas de ahorro que te gustaría alcanzar. ¿Cuáles son y cuánto tiempo crees que necesitarías para lograrlas?",
        rewards: {
          points: 50,
          badges: ["Planificador de Metas", "Amigo de Lucas"],
          stickers: ["🎯", "💰", "📊", "⭐"]
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

export default Lesson2_4_MyFirstSavingGoals;
