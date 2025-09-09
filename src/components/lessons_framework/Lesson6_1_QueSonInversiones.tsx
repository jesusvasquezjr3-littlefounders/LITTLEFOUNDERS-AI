import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  StepBasedLesson,
  characters 
} from './LessonComponents';
import { ChevronRight, ChevronLeft, Home, TrendingUp, TrendingDown, DollarSign, BarChart3 } from 'lucide-react';

interface Lesson6_1Props {
  onComplete: (score: number, progress: any) => void;
  onExit: () => void;
}

const Lesson6_1_QueSonInversiones: React.FC<Lesson6_1Props> = ({ onComplete, onExit }) => {
  const lucas = characters.lucas;
  const sol = characters.sol;
  const maestroDinero = characters.maestro_dinero;

  // Step-based lesson structure - each step shows one thing at a time
  const lessonSteps = [
    // Step 1: Hook/Introduction
    {
      id: 'hook',
      type: 'information' as const,
      title: 'El Dinero que Trabaja',
      character: lucas,
      content: {
        message: "¡Hola! Soy Lucas y tengo 16 años. Mi papá me dijo que en lugar de solo guardar mi dinero en una alcancía, podría hacer que 'trabaje' para mí a través de inversiones. ¿Qué significa eso y cómo funciona?",
        content: (
          <div className="text-center space-y-4">
            <div className="text-6xl">💰📈</div>
            <p className="text-lg font-medium text-gray-700">
              Lucas quiere que su dinero trabaje para él
            </p>
            <div className="bg-green-100 p-4 rounded-lg">
              <p className="text-sm text-green-800">
                <strong>Descubrimiento:</strong> El dinero puede generar más dinero
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
        message: "¡Hola joven inversionista! Soy el Maestro Dinero, y hoy vamos a explorar el fascinante mundo de las inversiones. Es como plantar semillas que crecen y dan frutos.",
        content: (
          <div className="space-y-4">
            <div className="bg-purple-100 p-4 rounded-lg">
              <h3 className="font-bold text-purple-800 mb-2">¿Qué vamos a aprender hoy?</h3>
              <ul className="space-y-2 text-sm text-purple-700">
                <li>• Entender qué son las inversiones y cómo funcionan</li>
                <li>• Diferenciar entre ahorrar e invertir</li>
                <li>• Conocer los diferentes tipos de inversiones</li>
                <li>• Comprender el concepto de rendimiento</li>
              </ul>
            </div>
          </div>
        )
      }
    },

    // Step 3: Information about what investments are
    {
      id: 'investment-definition-info',
      type: 'information' as const,
      title: '¿Qué son las Inversiones?',
      character: sol,
      content: {
        message: "¡Hola! Soy Sol y me encanta explicar conceptos financieros. Las inversiones son como plantar semillas de dinero que crecen con el tiempo.",
        content: (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-4 bg-green-100 rounded-lg">
                <div className="text-4xl mb-2">🌱</div>
                <p className="text-sm font-medium">Plantar</p>
                <p className="text-xs text-gray-600">Poner dinero en algo</p>
              </div>
              <div className="text-center p-4 bg-blue-100 rounded-lg">
                <div className="text-4xl mb-2">⏰</div>
                <p className="text-sm font-medium">Esperar</p>
                <p className="text-xs text-gray-600">Dar tiempo para crecer</p>
              </div>
              <div className="text-center p-4 bg-yellow-100 rounded-lg">
                <div className="text-4xl mb-2">📈</div>
                <p className="text-sm font-medium">Cosechar</p>
                <p className="text-xs text-gray-600">Obtener más dinero</p>
              </div>
            </div>
            <div className="bg-orange-100 p-4 rounded-lg">
              <p className="text-sm text-orange-800">
                <strong>Definición:</strong> Una inversión es usar dinero para comprar algo que esperas que aumente de valor con el tiempo, generando ganancias.
              </p>
            </div>
          </div>
        )
      }
    },

    // Step 4: Activity - Understanding investments
    {
      id: 'investment-understanding-activity',
      type: 'activity' as const,
      title: '¿Es Inversión o No?',
      character: lucas,
      points: 25,
      content: {
        type: 'question',
        description: 'Ayuda a Lucas a identificar qué actividades son inversiones',
        question: "¿Cuál de estas actividades es una inversión?",
        options: [
          "Comprar acciones de una empresa",
          "Gastar dinero en videojuegos",
          "Pagar la renta mensual",
          "Comprar comida para la semana"
        ],
        correct: 0,
        feedback: "¡Correcto! Comprar acciones de una empresa es una inversión porque esperas que las acciones aumenten de valor. Los otros gastos no generan retornos."
      }
    },

    // Step 5: Comment after activity
    {
      id: 'investment-understanding-comment',
      type: 'comment' as const,
      title: '¡Buen Trabajo!',
      character: sol,
      content: {
        message: "¡Perfecto! Ya entiendes la diferencia entre gastos e inversiones. Ahora vamos a aprender la diferencia entre ahorrar e invertir.",
        content: (
          <div className="bg-green-100 p-4 rounded-lg">
            <p className="text-sm text-green-800">
              <strong>Recuerda:</strong> Las inversiones buscan generar ganancias, mientras que los gastos solo consumen dinero.
            </p>
          </div>
        )
      }
    },

    // Step 6: Information about saving vs investing
    {
      id: 'saving-vs-investing-info',
      type: 'information' as const,
      title: 'Ahorrar vs Invertir',
      character: maestroDinero,
      content: {
        message: "Ahorrar e invertir son diferentes estrategias para hacer crecer tu dinero. Cada una tiene su propósito y momento.",
        content: (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <h4 className="font-bold text-blue-800 mb-2">🏦 Ahorrar</h4>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li>• Guardar dinero de forma segura</li>
                  <li>• Acceso inmediato al dinero</li>
                  <li>• Bajo riesgo, bajo rendimiento</li>
                  <li>• Para emergencias y metas cortas</li>
                  <li>• Cuenta de ahorros, alcancía</li>
                </ul>
              </div>
              <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                <h4 className="font-bold text-green-800 mb-2">📈 Invertir</h4>
                <ul className="text-sm text-green-700 space-y-1">
                  <li>• Hacer crecer el dinero con el tiempo</li>
                  <li>• Acceso limitado al dinero</li>
                  <li>• Mayor riesgo, mayor rendimiento</li>
                  <li>• Para metas a largo plazo</li>
                  <li>• Acciones, bonos, fondos</li>
                </ul>
              </div>
            </div>
            <div className="bg-yellow-100 p-4 rounded-lg">
              <p className="text-sm text-yellow-800">
                <strong>Estrategia:</strong> Primero ahorra para emergencias, luego invierte para el futuro. Es como construir una base sólida antes de construir arriba.
              </p>
            </div>
          </div>
        )
      }
    },

    // Step 7: Activity - Saving vs investing decision
    {
      id: 'saving-investing-activity',
      type: 'activity' as const,
      title: '¿Ahorrar o Invertir?',
      character: lucas,
      points: 30,
      content: {
        type: 'question',
        description: 'Ayuda a Lucas a decidir si debería ahorrar o invertir su dinero',
        question: "Lucas tiene $2,000 y quiere comprar una laptop en 6 meses. ¿Qué debería hacer?",
        options: [
          "Invertir todo en acciones de alto riesgo",
          "Ahorrar en una cuenta bancaria",
          "Invertir en bonos del gobierno",
          "Gastar la mitad y ahorrar la otra mitad"
        ],
        correct: 1,
        feedback: "¡Excelente decisión! Para una meta a corto plazo (6 meses), ahorrar en una cuenta bancaria es la mejor opción. Las inversiones son para metas a largo plazo."
      }
    },

    // Step 8: Comment after saving vs investing activity
    {
      id: 'saving-investing-comment',
      type: 'comment' as const,
      title: '¡Decisión Inteligente!',
      character: sol,
      content: {
        message: "¡Perfecto! Ya entiendes cuándo ahorrar y cuándo invertir. Ahora vamos a conocer los diferentes tipos de inversiones.",
        content: (
          <div className="bg-yellow-100 p-4 rounded-lg">
            <p className="text-sm text-yellow-800">
              <strong>Consejo:</strong> El tiempo es clave. Metas cortas = ahorro, metas largas = inversión.
            </p>
          </div>
        )
      }
    },

    // Step 9: Information about types of investments
    {
      id: 'investment-types-info',
      type: 'information' as const,
      title: 'Tipos de Inversiones',
      character: maestroDinero,
      content: {
        message: "Existen diferentes tipos de inversiones, cada una con sus propias características de riesgo y rendimiento.",
        content: (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                <h4 className="font-bold text-green-800 mb-2">📊 Acciones</h4>
                <ul className="text-sm text-green-700 space-y-1">
                  <li>• Ser dueño de una parte de una empresa</li>
                  <li>• Alto riesgo, alto potencial de ganancia</li>
                  <li>• Puedes ganar por dividendos y crecimiento</li>
                  <li>• Mercado de valores</li>
                </ul>
              </div>
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <h4 className="font-bold text-blue-800 mb-2">🏛️ Bonos</h4>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li>• Prestar dinero a gobiernos o empresas</li>
                  <li>• Riesgo bajo a moderado</li>
                  <li>• Pagos de interés regulares</li>
                  <li>• Más estables que las acciones</li>
                </ul>
              </div>
              <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                <h4 className="font-bold text-purple-800 mb-2">🏠 Bienes Raíces</h4>
                <ul className="text-sm text-purple-700 space-y-1">
                  <li>• Comprar propiedades</li>
                  <li>• Puedes ganar por renta y apreciación</li>
                  <li>• Requiere más capital inicial</li>
                  <li>• Menos líquido que otras inversiones</li>
                </ul>
              </div>
              <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                <h4 className="font-bold text-yellow-800 mb-2">💰 Fondos Mutuos</h4>
                <ul className="text-sm text-yellow-700 space-y-1">
                  <li>• Inversión colectiva en múltiples activos</li>
                  <li>• Diversificación automática</li>
                  <li>• Gestionado por profesionales</li>
                  <li>• Bueno para principiantes</li>
                </ul>
              </div>
            </div>
            <div className="bg-red-100 p-4 rounded-lg">
              <p className="text-sm text-red-800">
                <strong>Importante:</strong> Cada tipo de inversión tiene diferentes niveles de riesgo. Nunca inviertas dinero que no puedas permitirte perder.
              </p>
            </div>
          </div>
        )
      }
    },

    // Step 10: Activity - Investment type selection
    {
      id: 'investment-type-activity',
      type: 'activity' as const,
      title: 'Elige tu Tipo de Inversión',
      character: lucas,
      points: 25,
      content: {
        type: 'question',
        description: 'Ayuda a Lucas a elegir el tipo de inversión apropiado para su situación',
        question: "Lucas tiene 16 años y $1,000 para invertir a largo plazo. ¿Qué tipo de inversión sería más apropiado para un principiante?",
        options: [
          "Comprar acciones individuales de empresas tecnológicas",
          "Invertir en un fondo mutuo diversificado",
          "Comprar una propiedad para rentar",
          "Invertir en criptomonedas de alto riesgo"
        ],
        correct: 1,
        feedback: "¡Excelente elección! Un fondo mutuo diversificado es perfecto para principiantes. Ofrece diversificación, gestión profesional y es menos riesgoso que invertir en acciones individuales."
      }
    },

    // Step 11: Final reflection
    {
      id: 'final-reflection',
      type: 'comment' as const,
      title: '¡Inversiones Comprendidas!',
      character: maestroDinero,
      content: {
        message: "¡Felicitaciones! Has completado tu primera lección sobre inversiones. Ahora entiendes cómo hacer que tu dinero trabaje para ti.",
        content: (
          <div className="space-y-4">
            <div className="bg-gradient-to-r from-green-100 to-blue-100 p-4 rounded-lg">
              <h3 className="font-bold text-green-800 mb-2">Lo que aprendiste hoy:</h3>
              <ul className="space-y-1 text-sm text-green-700">
                <li>✅ Entender qué son las inversiones y cómo funcionan</li>
                <li>✅ Diferenciar entre ahorrar e invertir</li>
                <li>✅ Conocer los diferentes tipos de inversiones</li>
                <li>✅ Tomar decisiones inteligentes sobre inversiones</li>
              </ul>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-600">
                ¡Ahora puedes empezar a hacer que tu dinero trabaje para ti!
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
        question: "¿Qué tipo de inversión te interesa más y por qué?",
        message: "Antes de terminar, piensa en tu futuro financiero. ¿Qué tipo de inversión te parece más interesante? ¿Cómo planeas empezar a invertir cuando tengas la oportunidad?",
        rewards: {
          points: 50,
          badges: ["Inversionista Joven", "Hacedor de Dinero"],
          stickers: ["📈", "💰", "⭐", "🚀"]
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

export default Lesson6_1_QueSonInversiones;
