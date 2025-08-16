import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  StepBasedLesson,
  characters 
} from './LessonComponents';
import { ChevronRight, ChevronLeft, Home, Heart, ShoppingCart, Star } from 'lucide-react';

interface Lesson1_3Props {
  onComplete: (score: number, progress: any) => void;
  onExit: () => void;
}

const Lesson1_3_NeedsVsWants: React.FC<Lesson1_3Props> = ({ onComplete, onExit }) => {
  const lucas = characters.lucas;
  const sol = characters.sol;
  const mila = characters.mila;
  const maestroDinero = characters.maestro_dinero;

  // Step-based lesson structure - each step shows one thing at a time
  const lessonSteps = [
    // Step 1: Hook/Introduction
    {
      id: 'hook',
      type: 'information' as const,
      title: 'El Dilema de Mila',
      character: mila,
      content: {
        message: "¡Hola! Soy Mila y tengo un problema muy difícil. Tengo $20 y quiero comprar muchas cosas, pero no sé cuáles son más importantes. ¿Me puedes ayudar a decidir?",
        content: (
          <div className="text-center space-y-4">
            <div className="text-6xl">🐱❓</div>
            <p className="text-lg font-medium text-gray-700">
              Mila tiene $20 y muchas cosas que quiere comprar
            </p>
            <div className="bg-yellow-100 p-4 rounded-lg">
              <p className="text-sm text-yellow-800">
                <strong>Problema:</strong> ¿Qué debería comprar primero?
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
        message: "¡Excelente pregunta, Mila! Hoy vamos a aprender a diferenciar entre lo que necesitamos y lo que queremos. Esto te ayudará a tomar mejores decisiones con tu dinero.",
        content: (
          <div className="space-y-4">
            <div className="bg-blue-100 p-4 rounded-lg">
              <h3 className="font-bold text-blue-800 mb-2">¿Qué vamos a aprender hoy?</h3>
              <ul className="space-y-2 text-sm text-blue-700">
                <li>• Diferenciar entre necesidades y deseos</li>
                <li>• Priorizar lo que es más importante</li>
                <li>• Tomar decisiones inteligentes con el dinero</li>
                <li>• Ayudar a Mila con su dilema</li>
              </ul>
            </div>
          </div>
        )
      }
    },

    // Step 3: Information about needs
    {
      id: 'needs-info',
      type: 'information' as const,
      title: '¿Qué Son las Necesidades?',
      character: sol,
      content: {
        message: "¡Hola! Soy Sol y te voy a explicar qué son las necesidades. Son las cosas que realmente necesitamos para vivir bien.",
        content: (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-4 bg-red-100 rounded-lg">
                <div className="text-4xl mb-2">🍽️</div>
                <p className="text-sm font-medium">Comida</p>
                <p className="text-xs text-gray-600">Para vivir</p>
              </div>
              <div className="text-center p-4 bg-blue-100 rounded-lg">
                <div className="text-4xl mb-2">🏠</div>
                <p className="text-sm font-medium">Casa</p>
                <p className="text-xs text-gray-600">Para protegernos</p>
              </div>
            </div>
            <div className="bg-green-100 p-4 rounded-lg">
              <p className="text-sm text-green-800">
                <strong>Las necesidades son:</strong> Cosas que necesitamos para vivir y estar saludables.
              </p>
            </div>
          </div>
        )
      }
    },

    // Step 4: Activity - Identify needs
    {
      id: 'needs-activity',
      type: 'activity' as const,
      title: '¿Cuáles Son Necesidades?',
      character: lucas,
      points: 20,
      content: {
        type: 'question',
        description: 'Ayuda a Lucas a identificar qué cosas son necesidades',
        question: "Lucas está confundido sobre qué son necesidades. ¿Cuáles de estas cosas son necesidades?",
        options: [
          "🍽️ Comida para alimentarse",
          "🎮 Videojuego nuevo", 
          "👕 Ropa para vestirse",
          "🍭 Dulces y golosinas"
        ],
        correct: 0, // Comida y ropa son necesidades
        feedback: "¡Excelente! La comida y la ropa son necesidades porque las necesitamos para vivir. Los videojuegos y dulces son deseos."
      }
    },

    // Step 5: Comment after needs activity
    {
      id: 'needs-comment',
      type: 'comment' as const,
      title: '¡Muy Bien!',
      character: sol,
      content: {
        message: "¡Perfecto! Ya entiendes qué son las necesidades. Son las cosas básicas que necesitamos para vivir.",
        content: (
          <div className="bg-green-100 p-4 rounded-lg">
            <p className="text-sm text-green-800">
              <strong>Recuerda:</strong> Las necesidades son cosas básicas como comida, ropa, casa y salud.
            </p>
          </div>
        )
      }
    },

    // Step 6: Information about wants
    {
      id: 'wants-info',
      type: 'information' as const,
      title: '¿Qué Son los Deseos?',
      character: mila,
      content: {
        message: "Ahora vamos a hablar de los deseos. Son las cosas que nos gustaría tener, pero no necesitamos para vivir.",
        content: (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="text-center p-3 bg-purple-100 rounded-lg">
                <div className="text-2xl mb-1">🎮</div>
                <p className="text-xs font-bold">Videojuegos</p>
                <p className="text-xs text-gray-600">Para divertirse</p>
              </div>
              <div className="text-center p-3 bg-pink-100 rounded-lg">
                <div className="text-2xl mb-1">🧸</div>
                <p className="text-xs font-bold">Juguetes</p>
                <p className="text-xs text-gray-600">Para jugar</p>
              </div>
              <div className="text-center p-3 bg-yellow-100 rounded-lg">
                <div className="text-2xl mb-1">🍭</div>
                <p className="text-xs font-bold">Dulces</p>
                <p className="text-xs text-gray-600">Para disfrutar</p>
              </div>
              <div className="text-center p-3 bg-orange-100 rounded-lg">
                <div className="text-2xl mb-1">🎬</div>
                <p className="text-xs font-bold">Películas</p>
                <p className="text-xs text-gray-600">Para entretenerse</p>
              </div>
            </div>
            <div className="bg-blue-100 p-4 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Los deseos son:</strong> Cosas que nos gustaría tener pero no necesitamos para vivir.
              </p>
            </div>
          </div>
        )
      }
    },

    // Step 7: Activity - Identify wants
    {
      id: 'wants-activity',
      type: 'activity' as const,
      title: '¿Cuáles Son Deseos?',
      character: lucas,
      points: 30,
      content: {
        type: 'question',
        description: 'Ayuda a Lucas a entender la diferencia entre necesidades y deseos',
        question: "¿Cuál de estas cosas es un deseo (algo que queremos pero no necesitamos)?",
        options: [
          "🍽️ Comida para alimentarse",
          "🎮 Videojuego para divertirse",
          "👕 Ropa para vestirse",
          "🏠 Casa para vivir"
        ],
        correct: 1,
        feedback: "¡Excelente! Ya sabes diferenciar entre necesidades (comida, ropa, casa) y deseos (videojuegos)."
      }
    },

    // Step 8: Comment after wants activity
    {
      id: 'wants-comment',
      type: 'comment' as const,
      title: '¡Buen Trabajo!',
      character: mila,
      content: {
        message: "¡Muy bien! Ya entiendes la diferencia entre necesidades y deseos. Esto me ayudará a tomar mejores decisiones.",
        content: (
          <div className="bg-orange-100 p-4 rounded-lg">
            <p className="text-sm text-orange-800">
              <strong>Regla importante:</strong> Primero las necesidades, después los deseos
            </p>
          </div>
        )
      }
    },

    // Step 9: Information about prioritizing
    {
      id: 'prioritizing-info',
      type: 'information' as const,
      title: '¿Cómo Priorizar?',
      character: maestroDinero,
      content: {
        message: "Ahora vamos a aprender cómo decidir qué comprar primero cuando tenemos dinero limitado.",
        content: (
          <div className="space-y-4">
            <div className="flex items-center justify-center space-x-4">
              <div className="text-center">
                <div className="text-3xl mb-2">1️⃣</div>
                <p className="text-sm font-medium">Necesidades</p>
              </div>
              <div className="text-2xl">→</div>
              <div className="text-center">
                <div className="text-3xl mb-2">2️⃣</div>
                <p className="text-sm font-medium">Deseos</p>
              </div>
            </div>
            <div className="bg-purple-100 p-4 rounded-lg">
              <p className="text-sm text-purple-800">
                <strong>La regla:</strong> Siempre compra las necesidades primero, luego los deseos si te queda dinero.
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
      title: 'Ayuda a Mila a Decidir',
      character: mila,
      points: 25,
      content: {
        type: 'question',
        description: 'Ayuda a Mila a decidir qué comprar con sus $20',
        question: "Mila tiene $20. ¿Qué debería comprar primero?",
        options: [
          "🍽️ Comida ($15) y 🎮 videojuego ($10)",
          "🍽️ Comida ($15) y 👕 ropa ($8)",
          "🎮 Videojuego ($10) y 🍭 dulces ($5)",
          "🍭 Dulces ($5) y 🧸 juguete ($20)"
        ],
        correct: 1, // Comida y ropa son necesidades
        feedback: "¡Excelente decisión! Mila compró comida y ropa, que son necesidades. Es mejor comprar necesidades que deseos."
      }
    },

    // Step 11: Final reflection
    {
      id: 'final-reflection',
      type: 'comment' as const,
      title: '¡Lección Completada!',
      character: maestroDinero,
      content: {
        message: "¡Felicitaciones! Ahora sabes cómo diferenciar entre necesidades y deseos, y cómo tomar decisiones inteligentes con tu dinero.",
        content: (
          <div className="space-y-4">
            <div className="bg-gradient-to-r from-green-100 to-blue-100 p-4 rounded-lg">
              <h3 className="font-bold text-green-800 mb-2">Lo que aprendiste hoy:</h3>
              <ul className="space-y-1 text-sm text-green-700">
                <li>✅ Diferenciar entre necesidades y deseos</li>
                <li>✅ Priorizar lo que es más importante</li>
                <li>✅ Tomar decisiones inteligentes con el dinero</li>
                <li>✅ Ayudar a otros con sus decisiones financieras</li>
              </ul>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-600">
                ¡Ahora puedes ayudar a Mila y a otros amigos a tomar mejores decisiones con su dinero!
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
        question: "¿Qué aprendiste sobre cómo tomar decisiones inteligentes con el dinero?",
        message: "Antes de terminar, tómate un momento para pensar en lo que aprendiste. ¿Cómo te ayudará esta lección a tomar mejores decisiones?",
        rewards: {
          points: 50,
          badges: ["Decisor Inteligente", "Amigo de Mila"],
          stickers: ["🧠", "💡", "⭐", "🎉"]
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

export default Lesson1_3_NeedsVsWants;
