import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  StepBasedLesson,
  characters 
} from './LessonComponents';
import { ChevronRight, ChevronLeft, Home, Calculator, TrendingUp, DollarSign, ShoppingCart, PiggyBank } from 'lucide-react';

interface Lesson1_1Props {
  onComplete: (score: number, progress: any) => void;
  onExit: () => void;
}

const Lesson1_1_WhatIsBudget: React.FC<Lesson1_1Props> = ({ onComplete, onExit }) => {
  const lucas = characters.lucas;
  const sol = characters.sol;
  const maestroDinero = characters.maestro_dinero;

  // Step-based lesson structure - each step shows one thing at a time
  const lessonSteps = [
    // Step 1: Hook/Introduction
    {
      id: 'hook',
      type: 'information' as const,
      title: 'El Desafío de Alex: ¿Cómo Gastar su Mesada?',
      character: lucas,
      content: {
        message: "¡Hola! Soy Alex, tengo 12 años y acabo de recibir mi mesada de $200. Quiero comprar un videojuego de $150, ir al cine con mis amigos ($50), y ahorrar para un teléfono nuevo. Pero no sé si puedo hacer todo eso. ¿Me puedes ayudar a organizar mi dinero?",
        content: (
          <div className="text-center space-y-4">
            <div className="text-6xl">🎮💰📱</div>
            <p className="text-lg font-medium text-gray-700">
              Alex tiene $200 y muchos deseos
            </p>
            <div className="bg-yellow-100 p-4 rounded-lg">
              <p className="text-sm text-yellow-800">
                <strong>Problema:</strong> Alex no sabe cómo distribuir su dinero para cumplir todos sus objetivos
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
        message: "¡Hola jóvenes administradores! Soy el Maestro Dinero, y hoy vamos a aprender una herramienta súper poderosa que te ayudará a tomar el control de tu dinero: ¡El Presupuesto!",
        content: (
          <div className="space-y-4">
            <div className="bg-blue-100 p-4 rounded-lg">
              <h3 className="font-bold text-blue-800 mb-2">¿Qué vamos a aprender hoy?</h3>
              <ul className="space-y-2 text-sm text-blue-700">
                <li>• ¿Qué es un presupuesto y por qué es importante?</li>
                <li>• Cómo crear tu primer presupuesto personal</li>
                <li>• Categorizar ingresos y gastos</li>
                <li>• Tomar decisiones inteligentes sobre el dinero</li>
                <li>• Ayudar a Alex a resolver su problema financiero</li>
              </ul>
            </div>
          </div>
        )
      }
    },

    // Step 3: Information about what is a budget
    {
      id: 'budget-definition-info',
      type: 'information' as const,
      title: '¿Qué es un Presupuesto?',
      character: sol,
      content: {
        message: "¡Hola! Soy Sol y me encanta organizar todo. Un presupuesto es como un plan maestro para tu dinero. Te voy a explicar qué es y por qué es tan útil.",
        content: (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-4 bg-green-100 rounded-lg">
                <div className="text-4xl mb-2">📋</div>
                <p className="text-sm font-medium">Plan</p>
                <p className="text-xs text-gray-600">Organizar tu dinero</p>
              </div>
              <div className="text-center p-4 bg-blue-100 rounded-lg">
                <div className="text-4xl mb-2">🎯</div>
                <p className="text-sm font-medium">Objetivos</p>
                <p className="text-xs text-gray-600">Alcanzar tus metas</p>
              </div>
              <div className="text-center p-4 bg-purple-100 rounded-lg">
                <div className="text-4xl mb-2">⚖️</div>
                <p className="text-sm font-medium">Equilibrio</p>
                <p className="text-xs text-gray-600">Gastos vs ingresos</p>
              </div>
            </div>
            <div className="bg-purple-100 p-4 rounded-lg">
              <p className="text-sm text-purple-800">
                <strong>Un presupuesto es:</strong> Un plan que te ayuda a decidir cómo gastar, ahorrar y usar tu dinero de manera inteligente.
              </p>
            </div>
          </div>
        )
      }
    },

    // Step 4: Activity - Budget recognition
    {
      id: 'budget-recognition-activity',
      type: 'activity' as const,
      title: '¿Qué es un Presupuesto?',
      character: lucas,
      points: 20,
      content: {
        type: 'question',
        description: 'Ayuda a Alex a entender qué es un presupuesto',
        question: "¿Cuál de estas opciones describe mejor qué es un presupuesto?",
        options: [
          "Un plan para organizar cómo gastar y ahorrar tu dinero",
          "Una lista de cosas que quieres comprar",
          "Un documento que solo usan los adultos",
          "Una forma de gastar todo tu dinero rápido"
        ],
        correct: 0,
        feedback: "¡Excelente! Un presupuesto es exactamente eso: un plan para organizar cómo gastar y ahorrar tu dinero de manera inteligente."
      }
    },

    // Step 5: Comment after activity
    {
      id: 'budget-recognition-comment',
      type: 'comment' as const,
      title: '¡Perfecto!',
      character: sol,
      content: {
        message: "¡Muy bien! Ya entiendes que un presupuesto es un plan. Ahora vamos a ver por qué es tan importante tener uno.",
        content: (
          <div className="bg-green-100 p-4 rounded-lg">
            <p className="text-sm text-green-800">
              <strong>Recuerda:</strong> Un presupuesto te da control sobre tu dinero y te ayuda a tomar mejores decisiones.
            </p>
          </div>
        )
      }
    },

    // Step 6: Information about budget benefits
    {
      id: 'budget-benefits-info',
      type: 'information' as const,
      title: '¿Por Qué Necesitas un Presupuesto?',
      character: maestroDinero,
      content: {
        message: "Ahora vamos a ver todas las ventajas que tiene crear y seguir un presupuesto. ¡Te vas a sorprender de lo poderoso que es!",
        content: (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                <h4 className="font-bold text-green-800 mb-2">✅ Beneficios</h4>
                <ul className="text-sm text-green-700 space-y-1">
                  <li>• Control total de tu dinero</li>
                  <li>• Evitas gastos innecesarios</li>
                  <li>• Alcanzas tus metas de ahorro</li>
                  <li>• Tomas decisiones más inteligentes</li>
                  <li>• Reduces el estrés financiero</li>
                </ul>
              </div>
              <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                <h4 className="font-bold text-red-800 mb-2">❌ Sin Presupuesto</h4>
                <ul className="text-sm text-red-700 space-y-1">
                  <li>• Gastas sin pensar</li>
                  <li>• No sabes dónde va tu dinero</li>
                  <li>• No alcanzas tus metas</li>
                  <li>• Decisiones impulsivas</li>
                  <li>• Estrés por falta de dinero</li>
                </ul>
              </div>
            </div>
            <div className="bg-blue-100 p-4 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>El presupuesto es tu superpoder financiero:</strong> Te convierte en el jefe de tu dinero en lugar de que el dinero te controle a ti.
              </p>
            </div>
          </div>
        )
      }
    },

    // Step 7: Activity - Budget benefits
    {
      id: 'budget-benefits-activity',
      type: 'activity' as const,
      title: 'Beneficios del Presupuesto',
      character: lucas,
      points: 25,
      content: {
        type: 'question',
        description: 'Ayuda a Alex a identificar los beneficios de tener un presupuesto',
        question: "¿Cuál es el beneficio más importante de tener un presupuesto?",
        options: [
          "Tener control total sobre tu dinero y tomar decisiones inteligentes",
          "Gastar todo tu dinero en lo que quieras",
          "No tener que pensar en el dinero",
          "Comprar cosas más caras"
        ],
        correct: 0,
        feedback: "¡Exacto! El control total sobre tu dinero es el beneficio más importante. Un presupuesto te da el poder de decidir sabiamente."
      }
    },

    // Step 8: Comment after benefits
    {
      id: 'benefits-comment',
      type: 'comment' as const,
      title: '¡Excelente Comprensión!',
      character: sol,
      content: {
        message: "¡Perfecto! Ya entiendes los beneficios. Ahora vamos a aprender cómo crear tu primer presupuesto paso a paso.",
        content: (
          <div className="bg-orange-100 p-4 rounded-lg">
            <p className="text-sm text-orange-800">
              <strong>Próximo paso:</strong> Vamos a crear el presupuesto de Alex para resolver su problema con los $200.
            </p>
          </div>
        )
      }
    },

    // Step 9: Information about budget structure
    {
      id: 'budget-structure-info',
      type: 'information' as const,
      title: 'Estructura de un Presupuesto',
      character: maestroDinero,
      content: {
        message: "Ahora vamos a ver cómo se estructura un presupuesto. Es como armar un rompecabezas con tu dinero.",
        content: (
          <div className="space-y-4">
            <div className="bg-gradient-to-r from-green-50 to-blue-50 p-4 rounded-lg border border-green-200">
              <h3 className="font-bold text-green-800 mb-3">📊 Estructura del Presupuesto</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-semibold text-green-700 mb-2">💰 INGRESOS</h4>
                  <ul className="text-sm text-green-600 space-y-1">
                    <li>• Mesada</li>
                    <li>• Dinero de cumpleaños</li>
                    <li>• Trabajos pequeños</li>
                    <li>• Regalos en efectivo</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold text-red-700 mb-2">💸 GASTOS</h4>
                  <ul className="text-sm text-red-600 space-y-1">
                    <li>• Entretenimiento</li>
                    <li>• Comida y snacks</li>
                    <li>• Ropa y accesorios</li>
                    <li>• Ahorro</li>
                  </ul>
                </div>
              </div>
            </div>
            <div className="bg-purple-100 p-4 rounded-lg">
              <p className="text-sm text-purple-800">
                <strong>Fórmula mágica:</strong> Ingresos - Gastos = Ahorro (o deuda si es negativo)
              </p>
            </div>
          </div>
        )
      }
    },

    // Step 10: Activity - Budget structure
    {
      id: 'budget-structure-activity',
      type: 'activity' as const,
      title: 'Clasifica los Gastos',
      character: lucas,
      points: 30,
      content: {
        type: 'question',
        description: 'Ayuda a Alex a clasificar diferentes tipos de gastos',
        question: "Alex quiere comprar un videojuego. ¿En qué categoría del presupuesto debería clasificar este gasto?",
        options: [
          "Entretenimiento (porque es para divertirse)",
          "Ahorro (porque es una inversión)",
          "Comida (porque es necesario)",
          "Ropa (porque es un producto)"
        ],
        correct: 0,
        feedback: "¡Correcto! Los videojuegos van en la categoría de entretenimiento porque son para divertirse, no son necesidades básicas."
      }
    },

    // Step 11: Comment after structure
    {
      id: 'structure-comment',
      type: 'comment' as const,
      title: '¡Buen Trabajo Clasificando!',
      character: sol,
      content: {
        message: "¡Excelente! Ya sabes cómo clasificar gastos. Ahora vamos a crear el presupuesto real de Alex con sus $200.",
        content: (
          <div className="bg-blue-100 p-4 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>Vamos a practicar:</strong> Crearemos el presupuesto de Alex paso a paso.
            </p>
          </div>
        )
      }
    },

    // Step 12: Information about Alex's budget
    {
      id: 'alex-budget-info',
      type: 'information' as const,
      title: 'El Presupuesto de Alex',
      character: maestroDinero,
      content: {
        message: "Ahora vamos a resolver el problema de Alex. Tiene $200 y quiere: videojuego ($150), cine ($50), y ahorrar para un teléfono. Vamos a crear su presupuesto.",
        content: (
          <div className="space-y-4">
            <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
              <h3 className="font-bold text-yellow-800 mb-3">💰 Presupuesto de Alex - $200</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center p-2 bg-white rounded">
                  <span className="font-medium">Videojuego:</span>
                  <span className="text-red-600">$150</span>
                </div>
                <div className="flex justify-between items-center p-2 bg-white rounded">
                  <span className="font-medium">Cine con amigos:</span>
                  <span className="text-red-600">$50</span>
                </div>
                <div className="flex justify-between items-center p-2 bg-white rounded">
                  <span className="font-medium">Ahorro para teléfono:</span>
                  <span className="text-green-600">$0</span>
                </div>
                <div className="border-t pt-2">
                  <div className="flex justify-between items-center font-bold">
                    <span>Total gastos:</span>
                    <span className="text-red-600">$200</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-red-100 p-4 rounded-lg">
              <p className="text-sm text-red-800">
                <strong>Problema:</strong> Alex no puede ahorrar nada si gasta todo en entretenimiento. ¡Necesita ajustar su presupuesto!
              </p>
            </div>
          </div>
        )
      }
    },

    // Step 13: Activity - Budget decision
    {
      id: 'budget-decision-activity',
      type: 'activity' as const,
      title: '¿Qué Debería Hacer Alex?',
      character: lucas,
      points: 35,
      content: {
        type: 'question',
        description: 'Ayuda a Alex a tomar una decisión inteligente sobre su presupuesto',
        question: "Alex tiene $200. ¿Cuál es la mejor opción para su presupuesto?",
        options: [
          "Ajustar sus gastos: videojuego más barato ($100) + cine ($50) + ahorro ($50)",
          "Comprar el videojuego completo ($150) y no ir al cine",
          "Gastar todo en entretenimiento y no ahorrar nada",
          "Ahorrar todo el dinero y no divertirse"
        ],
        correct: 0,
        feedback: "¡Excelente decisión! Alex puede divertirse Y ahorrar si ajusta sus gastos. Es un presupuesto equilibrado."
      }
    },

    // Step 14: Comment after decision
    {
      id: 'decision-comment',
      type: 'comment' as const,
      title: '¡Decisión Inteligente!',
      character: sol,
      content: {
        message: "¡Perfecto! Alex ahora tiene un presupuesto equilibrado. Puede divertirse y ahorrar al mismo tiempo.",
        content: (
          <div className="bg-green-100 p-4 rounded-lg">
            <p className="text-sm text-green-800">
              <strong>Resultado:</strong> Alex logra sus objetivos: diversión + ahorro = presupuesto exitoso.
            </p>
          </div>
        )
      }
    },

    // Step 15: Information about budget tips
    {
      id: 'budget-tips-info',
      type: 'information' as const,
      title: 'Consejos para tu Presupuesto',
      character: maestroDinero,
      content: {
        message: "Ahora te voy a dar algunos consejos súper útiles para crear y mantener tu propio presupuesto.",
        content: (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <h4 className="font-bold text-blue-800 mb-2">💡 Consejos Principales</h4>
                <ul className="text-sm text-blue-700 space-y-2">
                  <li>• <strong>Regla 50/30/20:</strong> 50% necesidades, 30% deseos, 20% ahorro</li>
                  <li>• <strong>Revisa semanalmente:</strong> Mantén tu presupuesto actualizado</li>
                  <li>• <strong>Se realista:</strong> No seas demasiado estricto contigo mismo</li>
                  <li>• <strong>Planifica emergencias:</strong> Guarda algo para imprevistos</li>
                </ul>
              </div>
              <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                <h4 className="font-bold text-green-800 mb-2">🚀 Herramientas Útiles</h4>
                <ul className="text-sm text-green-700 space-y-2">
                  <li>• <strong>Apps de presupuesto:</strong> Mint, YNAB, o una simple hoja de cálculo</li>
                  <li>• <strong>Envelopes virtuales:</strong> Divide tu dinero en categorías</li>
                  <li>• <strong>Recordatorios:</strong> Configura alertas para revisar tu presupuesto</li>
                  <li>• <strong>Metas visuales:</strong> Usa gráficos para ver tu progreso</li>
                </ul>
              </div>
            </div>
            <div className="bg-purple-100 p-4 rounded-lg">
              <p className="text-sm text-purple-800">
                <strong>Recuerda:</strong> Un presupuesto exitoso es flexible y se adapta a tus necesidades cambiantes.
              </p>
            </div>
          </div>
        )
      }
    },

    // Step 16: Final activity - Budget creation
    {
      id: 'final-budget-activity',
      type: 'activity' as const,
      title: 'Crea tu Primer Presupuesto',
      character: lucas,
      points: 40,
      content: {
        type: 'question',
        description: 'Ayuda a Alex a aplicar lo aprendido creando un presupuesto',
        question: "Si tuvieras $300 de mesada, ¿cómo distribuirías tu presupuesto siguiendo la regla 50/30/20?",
        options: [
          "Necesidades: $150, Deseos: $90, Ahorro: $60",
          "Necesidades: $100, Deseos: $150, Ahorro: $50",
          "Necesidades: $200, Deseos: $50, Ahorro: $50",
          "Necesidades: $50, Deseos: $200, Ahorro: $50"
        ],
        correct: 0,
        feedback: "¡Perfecto! Has aplicado correctamente la regla 50/30/20: 50% necesidades ($150), 30% deseos ($90), 20% ahorro ($60)."
      }
    },

    // Step 17: Final reflection
    {
      id: 'final-reflection',
      type: 'comment' as const,
      title: '¡Lección Completada!',
      character: maestroDinero,
      content: {
        message: "¡Felicitaciones! Has completado tu primera lección sobre presupuestos. Ahora tienes el poder de controlar tu dinero.",
        content: (
          <div className="space-y-4">
            <div className="bg-gradient-to-r from-green-100 to-blue-100 p-4 rounded-lg">
              <h3 className="font-bold text-green-800 mb-2">Lo que aprendiste hoy:</h3>
              <ul className="space-y-1 text-sm text-green-700">
                <li>✅ Qué es un presupuesto y por qué es importante</li>
                <li>✅ Cómo estructurar ingresos y gastos</li>
                <li>✅ La regla 50/30/20 para distribución</li>
                <li>✅ Cómo tomar decisiones financieras inteligentes</li>
                <li>✅ Consejos prácticos para mantener tu presupuesto</li>
              </ul>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-600">
                ¡Ahora puedes crear tu propio presupuesto y ayudar a otros como Alex!
              </p>
            </div>
          </div>
        )
      }
    },

    // Step 18: Reflection moment
    {
      id: 'reflection-moment',
      type: 'reflection' as const,
      title: 'Momento de Reflexión',
      character: maestroDinero,
      content: {
        question: "¿Qué fue lo más útil que aprendiste sobre presupuestos hoy?",
        message: "Antes de terminar, tómate un momento para pensar en lo que aprendiste. ¿Qué te pareció más útil o sorprendente sobre los presupuestos?",
        rewards: {
          points: 50,
          badges: ["Maestro del Presupuesto", "Ayudante de Alex"],
          stickers: ["💰", "📊", "🎯", "⭐"]
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

export default Lesson1_1_WhatIsBudget;
