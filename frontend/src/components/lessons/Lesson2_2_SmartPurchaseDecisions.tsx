import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  StepBasedLesson,
  characters 
} from './LessonComponents';
import { ChevronRight, ChevronLeft, Home, Search, DollarSign, CheckCircle, Clock, ShoppingCart } from 'lucide-react';

interface Lesson2_2Props {
  onComplete: (score: number, progress: any) => void;
  onExit: () => void;
}

const Lesson2_2_SmartPurchaseDecisions: React.FC<Lesson2_2Props> = ({ onComplete, onExit }) => {
  const lucas = characters.lucas;
  const sol = characters.sol;
  const maestroDinero = characters.maestro_dinero;

  // Step-based lesson structure - each step shows one thing at a time
  const lessonSteps = [
    // Step 1: Hook/Introduction
    {
      id: 'hook',
      type: 'information' as const,
      title: 'La Decisión Difícil de Lucas',
      character: lucas,
      content: {
        message: "¡Hola! Soy Lucas y tengo un problema complicado. Tengo $25 y quiero comprar algo, pero hay tantas opciones en la tienda que no sé qué elegir. ¿Me puedes ayudar a tomar una decisión inteligente?",
        content: (
          <div className="text-center space-y-4">
            <div className="text-6xl">🛒❓</div>
            <p className="text-lg font-medium text-gray-700">
              Lucas tiene $25 y no sabe qué comprar
            </p>
            <div className="bg-blue-100 p-4 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Nuevo desafío:</strong> Tomar decisiones inteligentes de compra
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
        message: "¡Hola pequeño comprador inteligente! Soy el Maestro Dinero, y hoy vamos a aprender cómo tomar decisiones inteligentes cuando compramos cosas.",
        content: (
          <div className="space-y-4">
            <div className="bg-green-100 p-4 rounded-lg">
              <h3 className="font-bold text-green-800 mb-2">¿Qué vamos a aprender hoy?</h3>
              <ul className="space-y-2 text-sm text-green-700">
                <li>• Evaluar opciones antes de comprar</li>
                <li>• Comparar precios de productos similares</li>
                <li>• Resistir compras impulsivas</li>
                <li>• Ayudar a Lucas a tomar la mejor decisión</li>
              </ul>
            </div>
          </div>
        )
      }
    },

    // Step 3: Information about smart shopping
    {
      id: 'smart-shopping-info',
      type: 'information' as const,
      title: '¿Qué es Comprar de Forma Inteligente?',
      character: sol,
      content: {
        message: "¡Hola! Soy Sol y me encanta investigar. Te voy a explicar qué significa comprar de forma inteligente.",
        content: (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-4 bg-red-100 rounded-lg">
                <div className="text-4xl mb-2">💸</div>
                <p className="text-sm font-medium">Compra Impulsiva</p>
                <p className="text-xs text-gray-600">Comprar sin pensar</p>
              </div>
              <div className="text-center p-4 bg-green-100 rounded-lg">
                <div className="text-4xl mb-2">🧠</div>
                <p className="text-sm font-medium">Compra Inteligente</p>
                <p className="text-xs text-gray-600">Pensar antes de comprar</p>
              </div>
            </div>
            <div className="bg-purple-100 p-4 rounded-lg">
              <p className="text-sm text-purple-800">
                <strong>La diferencia:</strong> Los compradores inteligentes piensan, comparan y eligen lo mejor para su dinero.
              </p>
            </div>
          </div>
        )
      }
    },

    // Step 4: Activity - Identifying smart vs impulsive
    {
      id: 'smart-vs-impulsive-activity',
      type: 'activity' as const,
      title: '¿Compra Inteligente o Impulsiva?',
      character: lucas,
      points: 20,
      content: {
        type: 'question',
        description: 'Ayuda a Lucas a identificar qué tipo de compra es cada situación',
        question: "Lucas está pensando en diferentes situaciones de compra. ¿Cuál crees que es una compra inteligente?",
        options: [
          "🛒 Comparar precios de juguetes en 3 tiendas antes de comprar",
          "💸 Comprar el primer juguete que ve porque se ve bonito", 
          "🎯 Investigar si un videojuego es bueno antes de comprarlo",
          "🚫 Comprar algo solo porque todos sus amigos lo tienen"
        ],
        correct: 0, // Comparar precios es inteligente
        feedback: "¡Excelente! Comparar precios es una compra inteligente. También investigar antes de comprar es muy inteligente."
      }
    },

    // Step 5: Comment after activity
    {
      id: 'smart-vs-impulsive-comment',
      type: 'comment' as const,
      title: '¡Muy Bien!',
      character: sol,
      content: {
        message: "¡Perfecto! Ya sabes identificar compras inteligentes. Los compradores inteligentes siempre piensan antes de gastar su dinero.",
        content: (
          <div className="bg-green-100 p-4 rounded-lg">
            <p className="text-sm text-green-800">
              <strong>Recuerda:</strong> Una compra inteligente es aquella donde piensas, comparas y eliges lo mejor para tu dinero.
            </p>
          </div>
        )
      }
    },

    // Step 6: Information about price comparison
    {
      id: 'price-comparison-info',
      type: 'information' as const,
      title: 'Comparar Precios es Clave',
      character: maestroDinero,
      content: {
        message: "Ahora vamos a aprender por qué es importante comparar precios antes de comprar.",
        content: (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center p-3 bg-yellow-100 rounded-lg">
                <div className="text-2xl mb-1">🏪</div>
                <p className="text-xs font-bold">Tienda A</p>
                <p className="text-xs text-gray-600">$15</p>
              </div>
              <div className="text-center p-3 bg-green-100 rounded-lg">
                <div className="text-2xl mb-1">🏪</div>
                <p className="text-xs font-bold">Tienda B</p>
                <p className="text-xs text-gray-600">$12</p>
              </div>
              <div className="text-center p-3 bg-blue-100 rounded-lg">
                <div className="text-2xl mb-1">🏪</div>
                <p className="text-xs font-bold">Tienda C</p>
                <p className="text-xs text-gray-600">$18</p>
              </div>
            </div>
            <div className="bg-blue-100 p-4 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>El mejor precio:</strong> La Tienda B tiene el mejor precio. ¡Comparar te puede ahorrar dinero!
              </p>
            </div>
          </div>
        )
      }
    },

    // Step 7: Activity - Price comparison
    {
      id: 'price-comparison-activity',
      type: 'activity' as const,
      title: 'Encuentra el Mejor Precio',
      character: lucas,
      points: 30,
      content: {
        type: 'question',
        description: 'Ayuda a Lucas a encontrar el mejor precio para un juguete',
        question: "Lucas quiere comprar un robot de juguete. Encontró estos precios: Tienda A = $20, Tienda B = $18, Tienda C = $25. ¿En qué tienda debería comprar?",
        options: [
          "Tienda A ($20)",
          "Tienda B ($18)", 
          "Tienda C ($25)",
          "No comprar nada"
        ],
        correct: 1, // Tienda B es la más barata
        feedback: "¡Excelente! La Tienda B tiene el mejor precio con $18. Lucas ahorrará $2 comparado con la Tienda A y $7 comparado con la Tienda C."
      }
    },

    // Step 8: Comment after price comparison
    {
      id: 'price-comment',
      type: 'comment' as const,
      title: '¡Buen Trabajo Comparando!',
      character: sol,
      content: {
        message: "¡Muy bien! Ya sabes comparar precios. Lucas ahorró dinero al elegir la tienda con el mejor precio.",
        content: (
          <div className="bg-orange-100 p-4 rounded-lg">
            <p className="text-sm text-orange-800">
              <strong>El ahorro:</strong> Al comparar precios, Lucas ahorró $7 que puede usar para comprar algo más.
            </p>
          </div>
        )
      }
    },

    // Step 9: Information about resisting impulses
    {
      id: 'resisting-impulses-info',
      type: 'information' as const,
      title: 'Resistir Compras Impulsivas',
      character: maestroDinero,
      content: {
        message: "Ahora vamos a aprender cómo resistir la tentación de comprar cosas sin pensar.",
        content: (
          <div className="space-y-4">
            <div className="flex items-center justify-center space-x-4">
              <div className="text-center">
                <div className="text-3xl mb-2">⏰</div>
                <p className="text-sm font-medium">Esperar</p>
              </div>
              <div className="text-2xl">→</div>
              <div className="text-center">
                <div className="text-3xl mb-2">🤔</div>
                <p className="text-sm font-medium">Pensar</p>
              </div>
              <div className="text-2xl">→</div>
              <div className="text-center">
                <div className="text-3xl mb-2">✅</div>
                <p className="text-sm font-medium">Decidir</p>
              </div>
            </div>
            <div className="bg-purple-100 p-4 rounded-lg">
              <p className="text-sm text-purple-800">
                <strong>La regla de oro:</strong> Antes de comprar, espera un momento, piensa si realmente lo necesitas, y luego decide.
              </p>
            </div>
          </div>
        )
      }
    },

    // Step 10: Final activity - Decision making
    {
      id: 'decision-making-activity',
      type: 'activity' as const,
      title: '¿Qué Debería Comrar Lucas?',
      character: lucas,
      points: 25,
      content: {
        type: 'question',
        description: 'Ayuda a Lucas a tomar la mejor decisión de compra con su $25',
        question: "Lucas tiene $25 y estas opciones: Un videojuego ($25), Un libro ($15), Un juguete ($20), o Ahorrar el dinero. ¿Qué debería hacer?",
        options: [
          "Comprar el videojuego ($25) - se ve muy divertido",
          "Comprar el libro ($15) y ahorrar $10", 
          "Comprar el juguete ($20) y ahorrar $5",
          "Ahorrar todo el dinero para algo más importante"
        ],
        correct: 1, // Libro + ahorro es una buena opción
        feedback: "¡Excelente decisión! Comprar el libro y ahorrar $10 es inteligente. Lucas obtiene algo que quiere y guarda dinero para el futuro."
      }
    },

    // Step 11: Final reflection
    {
      id: 'final-reflection',
      type: 'comment' as const,
      title: '¡Lección Completada!',
      character: maestroDinero,
      content: {
        message: "¡Felicitaciones! Has completado tu lección sobre decisiones inteligentes de compra. Ahora sabes cómo gastar tu dinero de manera sabia.",
        content: (
          <div className="space-y-4">
            <div className="bg-gradient-to-r from-green-100 to-blue-100 p-4 rounded-lg">
              <h3 className="font-bold text-green-800 mb-2">Lo que aprendiste hoy:</h3>
              <ul className="space-y-1 text-sm text-green-700">
                <li>✅ Identificar compras inteligentes vs impulsivas</li>
                <li>✅ Comparar precios entre diferentes tiendas</li>
                <li>✅ Resistir la tentación de compras impulsivas</li>
                <li>✅ Tomar decisiones que incluyen ahorro</li>
              </ul>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-600">
                ¡Ahora puedes ayudar a Lucas y a otros amigos a tomar decisiones inteligentes de compra!
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
        question: "¿Cuál fue la última vez que hiciste una compra inteligente?",
        message: "Antes de terminar, piensa en la última vez que comparaste precios o pensaste bien antes de comprar algo. ¿Qué aprendiste de esa experiencia?",
        rewards: {
          points: 50,
          badges: ["Comprador Inteligente", "Amigo de Lucas"],
          stickers: ["🧠", "🛒", "💰", "✅"]
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

export default Lesson2_2_SmartPurchaseDecisions;
