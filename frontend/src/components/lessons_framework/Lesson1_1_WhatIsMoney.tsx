import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  StepBasedLesson,
  characters 
} from './LessonComponents';
import { ChevronRight, ChevronLeft, Home, Coins, DollarSign, ShoppingCart } from 'lucide-react';

interface Lesson1_1Props {
  onComplete: (score: number, progress: any) => void;
  onExit: () => void;
}

const Lesson1_1_WhatIsMoney: React.FC<Lesson1_1Props> = ({ onComplete, onExit }) => {
  const lucas = characters.lucas;
  const sol = characters.sol;
  const maestroDinero = characters.maestro_dinero;

  // Step-based lesson structure - each step shows one thing at a time
  const lessonSteps = [
    // Step 1: Hook/Introduction
    {
      id: 'hook',
      type: 'information' as const,
      title: 'El Misterio del Juguete de Lucas',
      character: lucas,
      content: {
        message: "¡Hola! Soy Lucas y tengo un problema. Quiero comprar mi juguete favorito que cuesta $50, pero cuando conté mi dinero, no tengo suficiente. ¿Me puedes ayudar a entender qué está pasando?",
        content: (
          <div className="text-center space-y-4">
            <div className="text-6xl">🧸❓</div>
            <p className="text-lg font-medium text-gray-700">
              Lucas quiere comprar su juguete favorito por $50
            </p>
            <div className="bg-yellow-100 p-4 rounded-lg">
              <p className="text-sm text-yellow-800">
                <strong>Problema:</strong> Lucas no sabe si tiene suficiente dinero
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
        message: "¡Hola pequeño explorador! Soy el Maestro Dinero, y he venido a ayudarte y a Lucas a resolver este misterio. Pero primero, necesitamos entender algo muy importante...",
        content: (
          <div className="space-y-4">
            <div className="bg-blue-100 p-4 rounded-lg">
              <h3 className="font-bold text-blue-800 mb-2">¿Qué vamos a aprender hoy?</h3>
              <ul className="space-y-2 text-sm text-blue-700">
                <li>• Identificar diferentes tipos de monedas y billetes</li>
                <li>• Comprender que cada moneda tiene un valor diferente</li>
                <li>• Entender que el dinero se usa para intercambiar por cosas que queremos</li>
                <li>• Ayudar a Lucas a contar su dinero correctamente</li>
              </ul>
            </div>
          </div>
        )
      }
    },

    // Step 3: Information about money recognition
    {
      id: 'money-recognition-info',
      type: 'information' as const,
      title: '¿Qué es el Dinero?',
      character: sol,
      content: {
        message: "¡Hola! Soy Sol y me encanta contar. Te voy a enseñar qué es el dinero y cómo reconocerlo.",
        content: (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-4 bg-yellow-100 rounded-lg">
                <div className="text-4xl mb-2">🪙</div>
                <p className="text-sm font-medium">Monedas</p>
                <p className="text-xs text-gray-600">Metálicas, redondas</p>
              </div>
              <div className="text-center p-4 bg-green-100 rounded-lg">
                <div className="text-4xl mb-2">💵</div>
                <p className="text-sm font-medium">Billetes</p>
                <p className="text-xs text-gray-600">De papel, rectangulares</p>
              </div>
            </div>
            <div className="bg-purple-100 p-4 rounded-lg">
              <p className="text-sm text-purple-800">
                <strong>El dinero es especial porque:</strong> Lo usamos para comprar cosas que necesitamos y queremos.
              </p>
            </div>
          </div>
        )
      }
    },

    // Step 4: Activity - Money recognition
    {
      id: 'money-recognition-activity',
      type: 'activity' as const,
      title: 'Encuentra el Dinero',
      character: lucas,
      points: 20,
      content: {
        type: 'question',
        description: 'Ayuda a Lucas a identificar qué objetos son dinero',
        question: "Lucas encontró estas cosas en su alcancía. ¿Cuáles son dinero?",
        options: [
          "🪙 Monedas brillantes",
          "🧸 Su juguete favorito", 
          "💵 Billetes verdes",
          "🍭 Dulces"
        ],
        correct: 0, // Monedas son correctas
        feedback: "¡Excelente! Las monedas son dinero. También los billetes son dinero. ¡Ambos se usan para comprar cosas!"
      }
    },

    // Step 5: Comment after activity
    {
      id: 'money-recognition-comment',
      type: 'comment' as const,
      title: '¡Muy Bien!',
      character: sol,
      content: {
        message: "¡Perfecto! Ya sabes reconocer el dinero. Las monedas y billetes son las formas más comunes de dinero.",
        content: (
          <div className="bg-green-100 p-4 rounded-lg">
            <p className="text-sm text-green-800">
              <strong>Recuerda:</strong> El dinero puede ser monedas (🪙) o billetes (💵). Ambos tienen valor y se usan para comprar cosas.
            </p>
          </div>
        )
      }
    },

    // Step 6: Information about values
    {
      id: 'money-values-info',
      type: 'information' as const,
      title: 'Cada Moneda Tiene un Valor',
      character: maestroDinero,
      content: {
        message: "Ahora vamos a aprender algo muy importante: cada moneda y billete tiene un valor diferente.",
        content: (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center p-3 bg-yellow-100 rounded-lg">
                <div className="text-2xl mb-1">🪙</div>
                <p className="text-xs font-bold">$1</p>
              </div>
              <div className="text-center p-3 bg-yellow-100 rounded-lg">
                <div className="text-2xl mb-1">🪙</div>
                <p className="text-xs font-bold">$5</p>
              </div>
              <div className="text-center p-3 bg-yellow-100 rounded-lg">
                <div className="text-2xl mb-1">🪙</div>
                <p className="text-xs font-bold">$10</p>
              </div>
            </div>
            <div className="bg-blue-100 p-4 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Importante:</strong> Los números en las monedas y billetes nos dicen cuánto valen.
              </p>
            </div>
          </div>
        )
      }
    },

    // Step 7: Activity - Counting money
    {
      id: 'counting-activity',
      type: 'activity' as const,
      title: 'Cuenta el Dinero de Lucas',
      character: lucas,
      points: 30,
      content: {
        type: 'question',
        description: 'Ayuda a Lucas a contar cuánto dinero tiene',
        question: "Lucas tiene: 1 moneda de $1, 1 moneda de $5, 1 moneda de $10 y 1 billete de $20. ¿Cuánto dinero tiene en total?",
        options: [
          "$30",
          "$36", 
          "$40",
          "$45"
        ],
        correct: 1,
        feedback: "¡Excelente! Lucas tiene $36 en total. Ahora sabemos que necesita $14 más para su juguete de $50."
      }
    },

    // Step 8: Comment after counting
    {
      id: 'counting-comment',
      type: 'comment' as const,
      title: '¡Buen Trabajo Contando!',
      character: sol,
      content: {
        message: "¡Muy bien! Ya sabes contar dinero. Lucas tiene $36, pero necesita $50 para su juguete.",
        content: (
          <div className="bg-orange-100 p-4 rounded-lg">
            <p className="text-sm text-orange-800">
              <strong>Lucas necesita:</strong> $50 - $36 = $14 más para comprar su juguete.
            </p>
          </div>
        )
      }
    },

    // Step 9: Information about exchange
    {
      id: 'exchange-info',
      type: 'information' as const,
      title: 'El Dinero es Intercambio',
      character: maestroDinero,
      content: {
        message: "Ahora vamos a entender algo muy importante: el dinero nos permite intercambiar por cosas que queremos.",
        content: (
          <div className="space-y-4">
            <div className="flex items-center justify-center space-x-4">
              <div className="text-center">
                <div className="text-3xl mb-2">💵</div>
                <p className="text-sm font-medium">Dinero</p>
              </div>
              <div className="text-2xl">↔️</div>
              <div className="text-center">
                <div className="text-3xl mb-2">🧸</div>
                <p className="text-sm font-medium">Juguete</p>
              </div>
            </div>
            <div className="bg-purple-100 p-4 rounded-lg">
              <p className="text-sm text-purple-800">
                <strong>El intercambio:</strong> Damos dinero y recibimos algo que queremos a cambio.
              </p>
            </div>
          </div>
        )
      }
    },

    // Step 10: Final activity - Decision making
    {
      id: 'decision-activity',
      type: 'activity' as const,
      title: '¿Qué Debería Hacer Lucas?',
      character: lucas,
      points: 25,
      content: {
        type: 'question',
        description: 'Ayuda a Lucas a decidir qué hacer con su dinero',
        question: "Lucas tiene $36 pero su juguete cuesta $50. ¿Qué debería hacer?",
        options: [
          "Ahorrar más dinero hasta tener $50",
          "Comprar un juguete más barato por $30",
          "Pedirle dinero prestado a sus amigos",
          "No comprar nada"
        ],
        correct: 0, // Ahorrar es la mejor opción
        feedback: "¡Excelente decisión! Ahorrar más dinero es la mejor opción. Lucas puede guardar su dinero hasta tener los $50 que necesita."
      }
    },

    // Step 11: Final reflection
    {
      id: 'final-reflection',
      type: 'comment' as const,
      title: '¡Lección Completada!',
      character: maestroDinero,
      content: {
        message: "¡Felicitaciones! Has completado tu primera lección sobre el dinero. Ahora sabes qué es el dinero, cómo reconocerlo, contarlo y usarlo.",
        content: (
          <div className="space-y-4">
            <div className="bg-gradient-to-r from-green-100 to-blue-100 p-4 rounded-lg">
              <h3 className="font-bold text-green-800 mb-2">Lo que aprendiste hoy:</h3>
              <ul className="space-y-1 text-sm text-green-700">
                <li>✅ Reconocer monedas y billetes</li>
                <li>✅ Contar dinero correctamente</li>
                <li>✅ Entender que el dinero es para intercambiar</li>
                <li>✅ Tomar buenas decisiones financieras</li>
              </ul>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-600">
                ¡Ahora puedes ayudar a Lucas y a otros amigos con sus problemas de dinero!
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
        question: "¿Qué fue lo más interesante que aprendiste sobre el dinero hoy?",
        message: "Antes de terminar, tómate un momento para pensar en lo que aprendiste. ¿Qué te pareció más interesante o sorprendente sobre el dinero?",
        rewards: {
          points: 50,
          badges: ["Explorador del Dinero", "Amigo de Lucas"],
          stickers: ["💰", "🧸", "⭐", "🎉"]
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

export default Lesson1_1_WhatIsMoney;
