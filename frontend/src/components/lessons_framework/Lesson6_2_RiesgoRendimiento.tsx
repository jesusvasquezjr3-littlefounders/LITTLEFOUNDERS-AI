import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  StepBasedLesson,
  characters 
} from './LessonComponents';
import { ChevronRight, ChevronLeft, Home, TrendingUp, TrendingDown, AlertTriangle, Target } from 'lucide-react';

interface Lesson6_2Props {
  onComplete: (score: number, progress: any) => void;
  onExit: () => void;
}

const Lesson6_2_RiesgoRendimiento: React.FC<Lesson6_2Props> = ({ onComplete, onExit }) => {
  const lucas = characters.lucas;
  const sol = characters.sol;
  const maestroDinero = characters.maestro_dinero;

  // Step-based lesson structure - each step shows one thing at a time
  const lessonSteps = [
    // Step 1: Hook/Introduction
    {
      id: 'hook',
      type: 'information' as const,
      title: 'La Montaña Rusa de las Inversiones',
      character: lucas,
      content: {
        message: "¡Hola! Soy Lucas y tengo 16 años. Mi papá me dijo que las inversiones son como una montaña rusa: a veces suben, a veces bajan. ¿Cómo puedo entender el riesgo y el rendimiento para tomar mejores decisiones?",
        content: (
          <div className="text-center space-y-4">
            <div className="text-6xl">🎢📊</div>
            <p className="text-lg font-medium text-gray-700">
              Lucas quiere entender riesgo y rendimiento
            </p>
            <div className="bg-orange-100 p-4 rounded-lg">
              <p className="text-sm text-orange-800">
                <strong>Desafío:</strong> Equilibrar riesgo y rendimiento en inversiones
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
        message: "¡Hola joven analista financiero! Soy el Maestro Dinero, y hoy vamos a aprender sobre la relación entre riesgo y rendimiento. Es como entender el clima antes de salir de viaje.",
        content: (
          <div className="space-y-4">
            <div className="bg-blue-100 p-4 rounded-lg">
              <h3 className="font-bold text-blue-800 mb-2">¿Qué vamos a aprender hoy?</h3>
              <ul className="space-y-2 text-sm text-blue-700">
                <li>• Entender la relación riesgo-rendimiento</li>
                <li>• Identificar tu tolerancia personal al riesgo</li>
                <li>• Aprender sobre diversificación</li>
                <li>• Tomar decisiones informadas sobre inversiones</li>
              </ul>
            </div>
          </div>
        )
      }
    },

    // Step 3: Information about risk and return relationship
    {
      id: 'risk-return-info',
      type: 'information' as const,
      title: 'La Relación Riesgo-Rendimiento',
      character: sol,
      content: {
        message: "¡Hola! Soy Sol y me encanta explicar conceptos importantes. La relación riesgo-rendimiento es como una regla fundamental de las inversiones.",
        content: (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="text-center p-4 bg-green-100 rounded-lg">
                <div className="text-4xl mb-2">📈</div>
                <p className="text-sm font-medium">Mayor Rendimiento</p>
                <p className="text-xs text-gray-600">Más ganancias potenciales</p>
              </div>
              <div className="text-center p-4 bg-red-100 rounded-lg">
                <div className="text-4xl mb-2">⚠️</div>
                <p className="text-sm font-medium">Mayor Riesgo</p>
                <p className="text-xs text-gray-600">Más posibilidades de pérdida</p>
              </div>
            </div>
            <div className="bg-purple-100 p-4 rounded-lg">
              <p className="text-sm text-purple-800">
                <strong>Principio fundamental:</strong> A mayor riesgo, mayor rendimiento potencial. A menor riesgo, menor rendimiento potencial.
              </p>
            </div>
            <div className="bg-yellow-100 p-4 rounded-lg">
              <p className="text-sm text-yellow-800">
                <strong>Ejemplo:</strong> Las acciones de empresas nuevas tienen alto riesgo pero alto potencial de ganancia. Los bonos del gobierno tienen bajo riesgo pero bajo rendimiento.
              </p>
            </div>
          </div>
        )
      }
    },

    // Step 4: Activity - Understanding risk-return relationship
    {
      id: 'risk-return-activity',
      type: 'activity' as const,
      title: 'Riesgo vs Rendimiento',
      character: lucas,
      points: 25,
      content: {
        type: 'question',
        description: 'Ayuda a Lucas a entender la relación entre riesgo y rendimiento',
        question: "¿Cuál de estas inversiones tiene la combinación más alta de riesgo y rendimiento potencial?",
        options: [
          "Bonos del gobierno (bajo riesgo, bajo rendimiento)",
          "Acciones de empresas establecidas (riesgo moderado, rendimiento moderado)",
          "Acciones de empresas nuevas (alto riesgo, alto rendimiento)",
          "Cuenta de ahorros (muy bajo riesgo, muy bajo rendimiento)"
        ],
        correct: 2,
        feedback: "¡Correcto! Las acciones de empresas nuevas tienen la combinación más alta de riesgo y rendimiento potencial. Son más volátiles pero pueden generar grandes ganancias."
      }
    },

    // Step 5: Comment after activity
    {
      id: 'risk-return-comment',
      type: 'comment' as const,
      title: '¡Buen Trabajo!',
      character: sol,
      content: {
        message: "¡Perfecto! Ya entiendes la relación entre riesgo y rendimiento. Ahora vamos a aprender sobre tu tolerancia personal al riesgo.",
        content: (
          <div className="bg-green-100 p-4 rounded-lg">
            <p className="text-sm text-green-800">
              <strong>Recuerda:</strong> No existe una inversión perfecta. Siempre hay un equilibrio entre riesgo y rendimiento.
            </p>
          </div>
        )
      }
    },

    // Step 6: Information about personal risk tolerance
    {
      id: 'risk-tolerance-info',
      type: 'information' as const,
      title: 'Tu Tolerancia Personal al Riesgo',
      character: maestroDinero,
      content: {
        message: "Cada persona tiene una tolerancia diferente al riesgo. Es importante conocerte a ti mismo antes de invertir.",
        content: (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                <h4 className="font-bold text-green-800 mb-2">🟢 Conservador</h4>
                <ul className="text-sm text-green-700 space-y-1">
                  <li>• Prefiere seguridad</li>
                  <li>• Acepta rendimientos bajos</li>
                  <li>• No le gusta la volatilidad</li>
                  <li>• Inversiones: bonos, cuentas de ahorro</li>
                </ul>
              </div>
              <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                <h4 className="font-bold text-yellow-800 mb-2">🟡 Moderado</h4>
                <ul className="text-sm text-yellow-700 space-y-1">
                  <li>• Equilibrio entre riesgo y rendimiento</li>
                  <li>• Acepta algo de volatilidad</li>
                  <li>• Busca crecimiento estable</li>
                  <li>• Inversiones: fondos mixtos, acciones estables</li>
                </ul>
              </div>
              <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                <h4 className="font-bold text-red-800 mb-2">🔴 Agresivo</h4>
                <ul className="text-sm text-red-700 space-y-1">
                  <li>• Busca altos rendimientos</li>
                  <li>• Acepta alta volatilidad</li>
                  <li>• Tiene horizonte largo</li>
                  <li>• Inversiones: acciones, criptomonedas</li>
                </ul>
              </div>
            </div>
            <div className="bg-blue-100 p-4 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Consejo:</strong> Tu tolerancia al riesgo puede cambiar con la edad. Los jóvenes pueden ser más agresivos porque tienen más tiempo para recuperarse.
              </p>
            </div>
          </div>
        )
      }
    },

    // Step 7: Activity - Risk tolerance assessment
    {
      id: 'risk-tolerance-activity',
      type: 'activity' as const,
      title: '¿Cuál es tu Perfil de Riesgo?',
      character: lucas,
      points: 30,
      content: {
        type: 'question',
        description: 'Ayuda a Lucas a identificar su perfil de riesgo',
        question: "Lucas tiene 16 años y puede esperar 10 años antes de necesitar su dinero. ¿Qué perfil de riesgo sería más apropiado?",
        options: [
          "Conservador - Solo bonos del gobierno",
          "Moderado - Mezcla de acciones y bonos",
          "Agresivo - Principalmente acciones de crecimiento",
          "Muy conservador - Solo cuenta de ahorros"
        ],
        correct: 2,
        feedback: "¡Excelente elección! Con 16 años y un horizonte de 10 años, Lucas puede ser más agresivo. Tiene tiempo para recuperarse de las caídas del mercado."
      }
    },

    // Step 8: Comment after risk tolerance activity
    {
      id: 'risk-tolerance-comment',
      type: 'comment' as const,
      title: '¡Perfil Identificado!',
      character: sol,
      content: {
        message: "¡Perfecto! Ya entiendes cómo identificar tu perfil de riesgo. Ahora vamos a aprender sobre la diversificación.",
        content: (
          <div className="bg-yellow-100 p-4 rounded-lg">
            <p className="text-sm text-yellow-800">
              <strong>Consejo:</strong> Tu perfil de riesgo debe considerar tu edad, horizonte de tiempo y situación financiera.
            </p>
          </div>
        )
      }
    },

    // Step 9: Information about diversification
    {
      id: 'diversification-info',
      type: 'information' as const,
      title: 'La Diversificación: No Pongas Todos los Huevos en una Canasta',
      character: maestroDinero,
      content: {
        message: "La diversificación es una de las estrategias más importantes para manejar el riesgo en las inversiones.",
        content: (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                <h4 className="font-bold text-green-800 mb-2">✅ Con Diversificación</h4>
                <ul className="text-sm text-green-700 space-y-1">
                  <li>• Inviertes en diferentes tipos de activos</li>
                  <li>• Reduces el riesgo total</li>
                  <li>• Mantienes rendimientos estables</li>
                  <li>• Proteges tu portafolio</li>
                </ul>
              </div>
              <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                <h4 className="font-bold text-red-800 mb-2">❌ Sin Diversificación</h4>
                <ul className="text-sm text-red-700 space-y-1">
                  <li>• Todo tu dinero en una inversión</li>
                  <li>• Alto riesgo de pérdida total</li>
                  <li>• Rendimientos muy volátiles</li>
                  <li>• Vulnerable a cambios del mercado</li>
                </ul>
              </div>
            </div>
            <div className="bg-purple-100 p-4 rounded-lg">
              <p className="text-sm text-purple-800">
                <strong>Estrategia de diversificación:</strong> Distribuye tu dinero entre acciones, bonos, bienes raíces y otros activos para reducir el riesgo.
              </p>
            </div>
            <div className="bg-orange-100 p-4 rounded-lg">
              <p className="text-sm text-orange-800">
                <strong>Ejemplo:</strong> En lugar de invertir $10,000 en una sola empresa, invierte $2,000 en 5 empresas diferentes de diferentes industrias.
              </p>
            </div>
          </div>
        )
      }
    },

    // Step 10: Activity - Diversification strategy
    {
      id: 'diversification-activity',
      type: 'activity' as const,
      title: 'Construye un Portafolio Diversificado',
      character: lucas,
      points: 25,
      content: {
        type: 'question',
        description: 'Ayuda a Lucas a crear una estrategia de diversificación',
        question: "Lucas tiene $5,000 para invertir. ¿Cuál sería la mejor estrategia de diversificación para un principiante?",
        options: [
          "Invertir todo en acciones de Apple",
          "Dividir entre 5 empresas tecnológicas diferentes",
          "Invertir en un fondo mutuo que incluya acciones, bonos y bienes raíces",
          "Comprar solo bonos del gobierno"
        ],
        correct: 2,
        feedback: "¡Excelente elección! Un fondo mutuo diversificado es perfecto para principiantes. Ofrece diversificación automática y gestión profesional."
      }
    },

    // Step 11: Final reflection
    {
      id: 'final-reflection',
      type: 'comment' as const,
      title: '¡Riesgo y Rendimiento Comprendidos!',
      character: maestroDinero,
      content: {
        message: "¡Felicitaciones! Has completado tu lección sobre riesgo y rendimiento. Ahora entiendes cómo tomar decisiones informadas sobre inversiones.",
        content: (
          <div className="space-y-4">
            <div className="bg-gradient-to-r from-green-100 to-blue-100 p-4 rounded-lg">
              <h3 className="font-bold text-green-800 mb-2">Lo que aprendiste hoy:</h3>
              <ul className="space-y-1 text-sm text-green-700">
                <li>✅ Entender la relación riesgo-rendimiento</li>
                <li>✅ Identificar tu tolerancia personal al riesgo</li>
                <li>✅ Aprender sobre diversificación</li>
                <li>✅ Tomar decisiones informadas sobre inversiones</li>
              </ul>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-600">
                ¡Ahora puedes construir un portafolio de inversiones que se adapte a tu perfil de riesgo!
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
        question: "¿Qué tipo de perfil de riesgo crees que tienes y cómo planeas diversificar tus inversiones?",
        message: "Antes de terminar, piensa en tu personalidad y situación financiera. ¿Eres conservador, moderado o agresivo? ¿Cómo planeas aplicar la diversificación en tus futuras inversiones?",
        rewards: {
          points: 50,
          badges: ["Analista de Riesgo", "Diversificador Experto"],
          stickers: ["📊", "🎯", "⭐", "🛡️"]
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

export default Lesson6_2_RiesgoRendimiento;
