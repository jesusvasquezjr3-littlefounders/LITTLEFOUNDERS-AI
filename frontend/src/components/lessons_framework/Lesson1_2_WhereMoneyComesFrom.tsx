import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  StepBasedLesson,
  characters 
} from './LessonComponents';
import { ChevronRight, ChevronLeft, Home, Users, Briefcase, Gift } from 'lucide-react';

interface Lesson1_2Props {
  onComplete: (score: number, progress: any) => void;
  onExit: () => void;
}

const Lesson1_2_WhereMoneyComesFrom: React.FC<Lesson1_2Props> = ({ onComplete, onExit }) => {
  const lucas = characters.lucas;
  const sol = characters.sol;
  const max = characters.max;
  const maestroDinero = characters.maestro_dinero;

  // Step-based lesson structure - each step shows one thing at a time
  const lessonSteps = [
    // Step 1: Hook/Introduction
    {
      id: 'hook',
      type: 'information' as const,
      title: 'El Misterio del Dinero de Max',
      character: max,
      content: {
        message: "¡Guau! Soy Max y tengo una pregunta muy importante. ¿De dónde viene todo el dinero que veo? ¿Crece en los árboles? ¿Lo regala el viento?",
        content: (
          <div className="text-center space-y-4">
            <div className="text-6xl">🐕❓</div>
            <p className="text-lg font-medium text-gray-700">
              Max quiere saber de dónde viene el dinero
            </p>
            <div className="bg-yellow-100 p-4 rounded-lg">
              <p className="text-sm text-yellow-800">
                <strong>Pregunta:</strong> ¿Cómo conseguimos dinero?
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
        message: "¡Excelente pregunta, Max! Hoy vamos a descubrir de dónde viene el dinero y cómo las personas lo consiguen.",
        content: (
          <div className="space-y-4">
            <div className="bg-blue-100 p-4 rounded-lg">
              <h3 className="font-bold text-blue-800 mb-2">¿Qué vamos a aprender hoy?</h3>
              <ul className="space-y-2 text-sm text-blue-700">
                <li>• Que el dinero viene del trabajo</li>
                <li>• Diferentes tipos de trabajos y recompensas</li>
                <li>• Cómo las personas ganan dinero</li>
                <li>• Por qué es importante trabajar</li>
              </ul>
            </div>
          </div>
        )
      }
    },

    // Step 3: Information about work
    {
      id: 'work-info',
      type: 'information' as const,
      title: 'El Dinero Viene del Trabajo',
      character: sol,
      content: {
        message: "¡Hola! Soy Sol y te voy a explicar algo muy importante: el dinero no crece en los árboles, ¡viene del trabajo!",
        content: (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-4 bg-green-100 rounded-lg">
                <div className="text-4xl mb-2">💼</div>
                <p className="text-sm font-medium">Trabajo</p>
                <p className="text-xs text-gray-600">Hacer algo útil</p>
              </div>
              <div className="text-center p-4 bg-yellow-100 rounded-lg">
                <div className="text-4xl mb-2">💰</div>
                <p className="text-sm font-medium">Dinero</p>
                <p className="text-xs text-gray-600">Recompensa</p>
              </div>
            </div>
            <div className="bg-purple-100 p-4 rounded-lg">
              <p className="text-sm text-purple-800">
                <strong>La regla:</strong> Trabajamos → Ganamos dinero → Compramos lo que necesitamos
              </p>
            </div>
          </div>
        )
      }
    },

    // Step 4: Activity - Identify work
    {
      id: 'work-activity',
      type: 'activity' as const,
      title: '¿Cuáles Son Trabajos?',
      character: lucas,
      points: 20,
      content: {
        type: 'question',
        description: 'Ayuda a Lucas a identificar qué actividades son trabajos',
        question: "Lucas está confundido sobre qué es trabajo. ¿Cuáles de estas actividades son trabajos?",
        options: [
          "👨‍⚕️ El doctor cura a las personas",
          "🎮 Jugar videojuegos todo el día", 
          "👨‍🍳 El cocinero prepara comida",
          "😴 Dormir hasta tarde"
        ],
        correct: 0, // Doctor y cocinero son trabajos
        feedback: "¡Excelente! El doctor y el cocinero son trabajos porque ayudan a otras personas y reciben dinero por su trabajo."
      }
    },

    // Step 5: Comment after work activity
    {
      id: 'work-comment',
      type: 'comment' as const,
      title: '¡Muy Bien!',
      character: sol,
      content: {
        message: "¡Perfecto! Ya entiendes que el trabajo es hacer algo útil para otros y recibir dinero como recompensa.",
        content: (
          <div className="bg-green-100 p-4 rounded-lg">
            <p className="text-sm text-green-800">
              <strong>Recuerda:</strong> El trabajo es hacer algo útil para otros y recibir dinero como recompensa.
            </p>
          </div>
        )
      }
    },

    // Step 6: Information about different jobs
    {
      id: 'jobs-info',
      type: 'information' as const,
      title: 'Diferentes Tipos de Trabajos',
      character: maestroDinero,
      content: {
        message: "Hay muchos tipos diferentes de trabajos. Cada uno es importante y ayuda a la comunidad de diferentes maneras.",
        content: (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="text-center p-3 bg-blue-100 rounded-lg">
                <div className="text-2xl mb-1">👨‍⚕️</div>
                <p className="text-xs font-bold">Doctor</p>
                <p className="text-xs text-gray-600">Cura personas</p>
              </div>
              <div className="text-center p-3 bg-green-100 rounded-lg">
                <div className="text-2xl mb-1">👨‍🍳</div>
                <p className="text-xs font-bold">Cocinero</p>
                <p className="text-xs text-gray-600">Prepara comida</p>
              </div>
              <div className="text-center p-3 bg-yellow-100 rounded-lg">
                <div className="text-2xl mb-1">👨‍🏫</div>
                <p className="text-xs font-bold">Maestro</p>
                <p className="text-xs text-gray-600">Enseña</p>
              </div>
              <div className="text-center p-3 bg-purple-100 rounded-lg">
                <div className="text-2xl mb-1">👨‍🔧</div>
                <p className="text-xs font-bold">Mecánico</p>
                <p className="text-xs text-gray-600">Arregla cosas</p>
              </div>
            </div>
            <div className="bg-blue-100 p-4 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Importante:</strong> Todos los trabajos son valiosos y necesarios para la comunidad.
              </p>
            </div>
          </div>
        )
      }
    },

    // Step 7: Activity - Match jobs with rewards
    {
      id: 'jobs-activity',
      type: 'activity' as const,
      title: '¿Qué Recibe Cada Trabajo?',
      character: lucas,
      points: 30,
      content: {
        type: 'question',
        description: 'Ayuda a Lucas a entender qué recompensas recibe cada trabajo',
        question: "¿Qué reciben las personas cuando trabajan?",
        options: [
          "Dinero como recompensa por su trabajo",
          "Nada, trabajan gratis",
          "Solo felicitaciones",
          "Regalos de cumpleaños"
        ],
        correct: 0,
        feedback: "¡Excelente! Cada trabajo recibe dinero como recompensa por hacer algo útil para otros."
      }
    },

    // Step 8: Comment after jobs activity
    {
      id: 'jobs-comment',
      type: 'comment' as const,
      title: '¡Buen Trabajo!',
      character: sol,
      content: {
        message: "¡Muy bien! Ya entiendes que cada trabajo recibe dinero como recompensa por hacer algo útil.",
        content: (
          <div className="bg-orange-100 p-4 rounded-lg">
            <p className="text-sm text-orange-800">
              <strong>Regla importante:</strong> Trabajo útil = Dinero como recompensa
            </p>
          </div>
        )
      }
    },

    // Step 9: Information about earning money
    {
      id: 'earning-info',
      type: 'information' as const,
      title: 'Cómo Ganamos Dinero',
      character: maestroDinero,
      content: {
        message: "Ahora vamos a ver cómo las personas realmente ganan dinero en la vida cotidiana.",
        content: (
          <div className="space-y-4">
            <div className="flex items-center justify-center space-x-4">
              <div className="text-center">
                <div className="text-3xl mb-2">💼</div>
                <p className="text-sm font-medium">Trabajo</p>
              </div>
              <div className="text-2xl">→</div>
              <div className="text-center">
                <div className="text-3xl mb-2">💰</div>
                <p className="text-sm font-medium">Salario</p>
              </div>
              <div className="text-2xl">→</div>
              <div className="text-center">
                <div className="text-3xl mb-2">🛒</div>
                <p className="text-sm font-medium">Compras</p>
              </div>
            </div>
            <div className="bg-purple-100 p-4 rounded-lg">
              <p className="text-sm text-purple-800">
                <strong>El ciclo:</strong> Trabajamos → Recibimos salario → Compramos lo que necesitamos
              </p>
            </div>
          </div>
        )
      }
    },

    // Step 10: Final activity - Understanding earning
    {
      id: 'earning-activity',
      type: 'activity' as const,
      title: '¿Cómo Gana Dinero tu Familia?',
      character: max,
      points: 25,
      content: {
        type: 'question',
        description: 'Ayuda a Max a entender cómo las familias ganan dinero',
        question: "Max quiere entender cómo las familias consiguen dinero. ¿Cuál es la forma más común?",
        options: [
          "Trabajando en un empleo",
          "Encontrando dinero en la calle",
          "Pidiendo dinero prestado",
          "Esperando que llueva dinero"
        ],
        correct: 0, // Trabajando es la forma más común
        feedback: "¡Excelente! La forma más común de ganar dinero es trabajando en un empleo. Es la forma honesta y responsable."
      }
    },

    // Step 11: Final reflection
    {
      id: 'final-reflection',
      type: 'comment' as const,
      title: '¡Lección Completada!',
      character: maestroDinero,
      content: {
        message: "¡Felicitaciones! Ahora sabes de dónde viene el dinero y por qué es importante trabajar.",
        content: (
          <div className="space-y-4">
            <div className="bg-gradient-to-r from-green-100 to-blue-100 p-4 rounded-lg">
              <h3 className="font-bold text-green-800 mb-2">Lo que aprendiste hoy:</h3>
              <ul className="space-y-1 text-sm text-green-700">
                <li>✅ El dinero viene del trabajo</li>
                <li>✅ Hay diferentes tipos de trabajos</li>
                <li>✅ Cada trabajo recibe dinero como recompensa</li>
                <li>✅ Trabajar es importante y valioso</li>
              </ul>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-600">
                ¡Ahora entiendes por qué el trabajo es tan importante para conseguir dinero!
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
        question: "¿Qué te pareció más interesante sobre cómo las personas ganan dinero?",
        message: "Antes de terminar, tómate un momento para pensar en lo que aprendiste. ¿Qué te sorprendió más sobre el trabajo y el dinero?",
        rewards: {
          points: 50,
          badges: ["Trabajador Responsable", "Amigo de Max"],
          stickers: ["💼", "💰", "⭐", "🎉"]
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

export default Lesson1_2_WhereMoneyComesFrom;
