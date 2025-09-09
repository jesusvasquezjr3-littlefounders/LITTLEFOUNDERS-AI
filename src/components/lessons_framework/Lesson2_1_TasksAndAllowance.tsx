import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  StepBasedLesson,
  characters 
} from './LessonComponents';
import { ChevronRight, ChevronLeft, Home, Star, DollarSign, CheckCircle, Clock } from 'lucide-react';

interface Lesson2_1Props {
  onComplete: (score: number, progress: any) => void;
  onExit: () => void;
}

const Lesson2_1_TasksAndAllowance: React.FC<Lesson2_1Props> = ({ onComplete, onExit }) => {
  const lucas = characters.lucas;
  const sol = characters.sol;
  const maestroDinero = characters.maestro_dinero;

  // Step-based lesson structure - each step shows one thing at a time
  const lessonSteps = [
    // Step 1: Hook/Introduction
    {
      id: 'hook',
      type: 'information' as const,
      title: 'El Deseo de Lucas por un Nuevo Videojuego',
      character: lucas,
      content: {
        message: "¡Hola! Soy Lucas y tengo un nuevo desafío. Quiero comprar un videojuego que cuesta $80, pero no tengo dinero. Mis papás me dijeron que puedo ganar dinero haciendo tareas en casa. ¿Me puedes ayudar a entender cómo funciona esto?",
        content: (
          <div className="text-center space-y-4">
            <div className="text-6xl">🎮❓</div>
            <p className="text-lg font-medium text-gray-700">
              Lucas quiere comprar un videojuego por $80
            </p>
            <div className="bg-blue-100 p-4 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Nuevo concepto:</strong> Ganar dinero a través de responsabilidades
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
        message: "¡Hola pequeño administrador! Soy el Maestro Dinero, y hoy vamos a aprender algo muy importante sobre cómo ganar dinero de manera responsable.",
        content: (
          <div className="space-y-4">
            <div className="bg-green-100 p-4 rounded-lg">
              <h3 className="font-bold text-green-800 mb-2">¿Qué vamos a aprender hoy?</h3>
              <ul className="space-y-2 text-sm text-green-700">
                <li>• Relacionar esfuerzo con recompensa económica</li>
                <li>• Cumplir responsabilidades para ganar dinero</li>
                <li>• Gestionar una mesada de manera responsable</li>
                <li>• Ayudar a Lucas a crear un plan para ganar su dinero</li>
              </ul>
            </div>
          </div>
        )
      }
    },

    // Step 3: Information about tasks and money
    {
      id: 'tasks-money-info',
      type: 'information' as const,
      title: '¿Qué son las Tareas y la Mesada?',
      character: sol,
      content: {
        message: "¡Hola! Soy Sol y me encanta organizar. Te voy a explicar qué son las tareas y la mesada.",
        content: (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-4 bg-yellow-100 rounded-lg">
                <div className="text-4xl mb-2">🧹</div>
                <p className="text-sm font-medium">Tareas</p>
                <p className="text-xs text-gray-600">Responsabilidades en casa</p>
              </div>
              <div className="text-center p-4 bg-green-100 rounded-lg">
                <div className="text-4xl mb-2">💰</div>
                <p className="text-sm font-medium">Mesada</p>
                <p className="text-xs text-gray-600">Dinero por completar tareas</p>
              </div>
            </div>
            <div className="bg-purple-100 p-4 rounded-lg">
              <p className="text-sm text-purple-800">
                <strong>La conexión:</strong> Cuando haces tus tareas bien, puedes ganar dinero como recompensa.
              </p>
            </div>
          </div>
        )
      }
    },

    // Step 4: Activity - Task identification
    {
      id: 'task-identification-activity',
      type: 'activity' as const,
      title: '¿Cuáles son Tareas Responsables?',
      character: lucas,
      points: 20,
      content: {
        type: 'question',
        description: 'Ayuda a Lucas a identificar qué actividades son tareas responsables',
        question: "Lucas está pensando en qué tareas puede hacer. ¿Cuáles crees que son tareas responsables que podrían ganar dinero?",
        options: [
          "🧹 Limpiar su habitación y hacer la cama",
          "🎮 Jugar videojuegos todo el día", 
          "📚 Hacer la tarea de la escuela",
          "🍪 Comer dulces sin parar"
        ],
        correct: 0, // Limpiar habitación es correcto
        feedback: "¡Excelente! Limpiar su habitación es una tarea responsable. También hacer la tarea de la escuela es importante, aunque no siempre se paga por ella."
      }
    },

    // Step 5: Comment after activity
    {
      id: 'task-identification-comment',
      type: 'comment' as const,
      title: '¡Muy Bien!',
      character: sol,
      content: {
        message: "¡Perfecto! Ya sabes identificar tareas responsables. Las tareas son actividades que ayudan a mantener la casa ordenada y funcionando bien.",
        content: (
          <div className="bg-green-100 p-4 rounded-lg">
            <p className="text-sm text-green-800">
              <strong>Recuerda:</strong> Las tareas responsables son actividades que benefician a toda la familia y mantienen la casa en orden.
            </p>
          </div>
        )
      }
    },

    // Step 6: Information about allowance system
    {
      id: 'allowance-system-info',
      type: 'information' as const,
      title: 'El Sistema de Mesada',
      character: maestroDinero,
      content: {
        message: "Ahora vamos a aprender cómo funciona un sistema de mesada justo y responsable.",
        content: (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center p-3 bg-yellow-100 rounded-lg">
                <div className="text-2xl mb-1">⭐</div>
                <p className="text-xs font-bold">Tarea Completa</p>
                <p className="text-xs text-gray-600">$2-5</p>
              </div>
              <div className="text-center p-3 bg-green-100 rounded-lg">
                <div className="text-2xl mb-1">🎯</div>
                <p className="text-xs font-bold">Semana Completa</p>
                <p className="text-xs text-gray-600">$10-20</p>
              </div>
              <div className="text-center p-3 bg-blue-100 rounded-lg">
                <div className="text-2xl mb-1">🏆</div>
                <p className="text-xs font-bold">Bonus Especial</p>
                <p className="text-xs text-gray-600">$5-10</p>
              </div>
            </div>
            <div className="bg-blue-100 p-4 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Importante:</strong> La cantidad de dinero depende de la dificultad de la tarea y qué tan bien la hagas.
              </p>
            </div>
          </div>
        )
      }
    },

    // Step 7: Activity - Calculating earnings
    {
      id: 'calculating-earnings-activity',
      type: 'activity' as const,
      title: 'Calcula las Ganancias de Lucas',
      character: lucas,
      points: 30,
      content: {
        type: 'question',
        description: 'Ayuda a Lucas a calcular cuánto dinero puede ganar',
        question: "Lucas hizo estas tareas esta semana: Limpiar su habitación ($3), Lavar los platos ($2), Sacar la basura ($1), y Hacer la cama todos los días ($5). ¿Cuánto dinero ganó en total?",
        options: [
          "$8",
          "$11", 
          "$15",
          "$20"
        ],
        correct: 1, // $11 es correcto
        feedback: "¡Excelente! Lucas ganó $11 esta semana. Ahora tiene un buen comienzo para su videojuego de $80."
      }
    },

    // Step 8: Comment after calculation
    {
      id: 'calculation-comment',
      type: 'comment' as const,
      title: '¡Buen Trabajo Calculando!',
      character: sol,
      content: {
        message: "¡Muy bien! Ya sabes calcular ganancias. Lucas ganó $11 esta semana, pero necesita $80 para su videojuego.",
        content: (
          <div className="bg-orange-100 p-4 rounded-lg">
            <p className="text-sm text-orange-800">
              <strong>Lucas necesita:</strong> $80 - $11 = $69 más para comprar su videojuego.
            </p>
          </div>
        )
      }
    },

    // Step 9: Information about responsibility
    {
      id: 'responsibility-info',
      type: 'information' as const,
      title: 'La Responsabilidad es Clave',
      character: maestroDinero,
      content: {
        message: "Ahora vamos a entender algo muy importante: la responsabilidad es la base para ganar dinero de manera justa.",
        content: (
          <div className="space-y-4">
            <div className="flex items-center justify-center space-x-4">
              <div className="text-center">
                <div className="text-3xl mb-2">✅</div>
                <p className="text-sm font-medium">Responsabilidad</p>
              </div>
              <div className="text-2xl">→</div>
              <div className="text-center">
                <div className="text-3xl mb-2">💰</div>
                <p className="text-sm font-medium">Recompensa</p>
              </div>
            </div>
            <div className="bg-purple-100 p-4 rounded-lg">
              <p className="text-sm text-purple-800">
                <strong>La regla:</strong> Primero cumples con tus responsabilidades, luego recibes tu recompensa.
              </p>
            </div>
          </div>
        )
      }
    },

    // Step 10: Final activity - Planning
    {
      id: 'planning-activity',
      type: 'activity' as const,
      title: '¿Cuál es el Mejor Plan para Lucas?',
      character: lucas,
      points: 25,
      content: {
        type: 'question',
        description: 'Ayuda a Lucas a crear un plan para ganar el dinero que necesita',
        question: "Lucas necesita $69 más para su videojuego. ¿Cuál es el mejor plan para ganar este dinero?",
        options: [
          "Hacer todas sus tareas por 7 semanas ($11 x 7 = $77)",
          "Pedirle dinero prestado a sus amigos",
          "Gastar todo su dinero en dulces",
          "No hacer nada y esperar que sus papás le den el dinero"
        ],
        correct: 0, // Hacer tareas es la mejor opción
        feedback: "¡Excelente plan! Hacer todas sus tareas por 7 semanas le dará a Lucas $77, que es suficiente para su videojuego. Es un plan responsable y realista."
      }
    },

    // Step 11: Final reflection
    {
      id: 'final-reflection',
      type: 'comment' as const,
      title: '¡Lección Completada!',
      character: maestroDinero,
      content: {
        message: "¡Felicitaciones! Has completado tu lección sobre tareas y mesada. Ahora sabes cómo ganar dinero de manera responsable.",
        content: (
          <div className="space-y-4">
            <div className="bg-gradient-to-r from-green-100 to-blue-100 p-4 rounded-lg">
              <h3 className="font-bold text-green-800 mb-2">Lo que aprendiste hoy:</h3>
              <ul className="space-y-1 text-sm text-green-700">
                <li>✅ Identificar tareas responsables</li>
                <li>✅ Entender cómo funciona la mesada</li>
                <li>✅ Calcular ganancias por tareas</li>
                <li>✅ Crear planes para alcanzar metas financieras</li>
              </ul>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-600">
                ¡Ahora puedes ayudar a Lucas y a otros amigos a ganar dinero de manera responsable!
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
        question: "¿Qué tareas te gustaría hacer en casa para ganar dinero?",
        message: "Antes de terminar, piensa en qué tareas podrías hacer en tu casa para ganar dinero. ¿Cuáles te parecen más interesantes o importantes?",
        rewards: {
          points: 50,
          badges: ["Administrador Responsable", "Amigo de Lucas"],
          stickers: ["💰", "🧹", "⭐", "🎯"]
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

export default Lesson2_1_TasksAndAllowance;
