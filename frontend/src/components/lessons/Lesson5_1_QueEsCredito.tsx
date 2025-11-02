import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  StepBasedLesson,
  characters 
} from './LessonComponents';
import { ChevronRight, ChevronLeft, Home, CreditCard, Calculator, AlertTriangle, CheckCircle } from 'lucide-react';

interface Lesson5_1Props {
  onComplete: (score: number, progress: any) => void;
  onExit: () => void;
}

const Lesson5_1_QueEsCredito: React.FC<Lesson5_1Props> = ({ onComplete, onExit }) => {
  const lucas = characters.lucas;
  const sol = characters.sol;
  const maestroDinero = characters.maestro_dinero;

  // Step-based lesson structure - each step shows one thing at a time
  const lessonSteps = [
    // Step 1: Hook/Introduction
    {
      id: 'hook',
      type: 'information' as const,
      title: 'La Laptop de Lucas',
      character: lucas,
      content: {
        message: "¡Hola! Soy Lucas y tengo 16 años. Necesito una laptop para la universidad, pero cuesta $15,000 y solo tengo $5,000 ahorrados. Mi papá me habló sobre el crédito, pero no entiendo bien qué es. ¿Me puedes explicar?",
        content: (
          <div className="text-center space-y-4">
            <div className="text-6xl">💻💳</div>
            <p className="text-lg font-medium text-gray-700">
              Lucas necesita una laptop para la universidad
            </p>
            <div className="bg-blue-100 p-4 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Dilema:</strong> ¿Debería usar crédito para comprar la laptop ahora?
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
        message: "¡Hola joven financiero! Soy el Maestro Dinero, y hoy vamos a explorar el mundo del crédito. Es una herramienta poderosa, pero debes usarla con sabiduría.",
        content: (
          <div className="space-y-4">
            <div className="bg-purple-100 p-4 rounded-lg">
              <h3 className="font-bold text-purple-800 mb-2">¿Qué vamos a aprender hoy?</h3>
              <ul className="space-y-2 text-sm text-purple-700">
                <li>• Entender qué es el crédito y cómo funciona</li>
                <li>• Conocer los diferentes tipos de crédito</li>
                <li>• Comprender la responsabilidad del endeudamiento</li>
                <li>• Tomar decisiones inteligentes sobre el crédito</li>
              </ul>
            </div>
          </div>
        )
      }
    },

    // Step 3: Information about what credit is
    {
      id: 'credit-definition-info',
      type: 'information' as const,
      title: '¿Qué es el Crédito?',
      character: sol,
      content: {
        message: "¡Hola! Soy Sol y me encanta explicar conceptos complejos de manera simple. El crédito es como un préstamo de confianza.",
        content: (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-4 bg-green-100 rounded-lg">
                <div className="text-4xl mb-2">🤝</div>
                <p className="text-sm font-medium">Confianza</p>
                <p className="text-xs text-gray-600">Te prestan dinero porque confían en ti</p>
              </div>
              <div className="text-center p-4 bg-blue-100 rounded-lg">
                <div className="text-4xl mb-2">⏰</div>
                <p className="text-sm font-medium">Tiempo</p>
                <p className="text-xs text-gray-600">Pagas después de un tiempo</p>
              </div>
              <div className="text-center p-4 bg-yellow-100 rounded-lg">
                <div className="text-4xl mb-2">💰</div>
                <p className="text-sm font-medium">Costo</p>
                <p className="text-xs text-gray-600">Pagas intereses por el préstamo</p>
              </div>
            </div>
            <div className="bg-orange-100 p-4 rounded-lg">
              <p className="text-sm text-orange-800">
                <strong>Definición simple:</strong> El crédito es la capacidad de obtener dinero, bienes o servicios ahora, con la promesa de pagarlos en el futuro.
              </p>
            </div>
          </div>
        )
      }
    },

    // Step 4: Activity - Understanding credit
    {
      id: 'credit-understanding-activity',
      type: 'activity' as const,
      title: '¿Es Crédito o No?',
      character: lucas,
      points: 25,
      content: {
        type: 'question',
        description: 'Ayuda a Lucas a identificar situaciones que involucran crédito',
        question: "¿Cuál de estas situaciones NO involucra crédito?",
        options: [
          "Comprar una laptop y pagarla en 12 meses",
          "Usar una tarjeta de crédito para comprar ropa",
          "Pagar en efectivo por un helado",
          "Pedir un préstamo para comprar un carro"
        ],
        correct: 2,
        feedback: "¡Correcto! Pagar en efectivo por un helado NO es crédito porque pagas inmediatamente. Las otras opciones sí involucran pagar en el futuro."
      }
    },

    // Step 5: Comment after activity
    {
      id: 'credit-understanding-comment',
      type: 'comment' as const,
      title: '¡Buen Trabajo!',
      character: sol,
      content: {
        message: "¡Perfecto! Ya entiendes la diferencia entre pagar inmediatamente y usar crédito. Ahora vamos a conocer los diferentes tipos de crédito.",
        content: (
          <div className="bg-green-100 p-4 rounded-lg">
            <p className="text-sm text-green-800">
              <strong>Recuerda:</strong> El crédito siempre implica pagar en el futuro, no en el presente.
            </p>
          </div>
        )
      }
    },

    // Step 6: Information about types of credit
    {
      id: 'credit-types-info',
      type: 'information' as const,
      title: 'Tipos de Crédito',
      character: maestroDinero,
      content: {
        message: "Existen diferentes tipos de crédito, cada uno con sus propias características y usos específicos.",
        content: (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <h4 className="font-bold text-blue-800 mb-2">💳 Tarjeta de Crédito</h4>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li>• Línea de crédito renovable</li>
                  <li>• Pagas solo lo que usas</li>
                  <li>• Intereses altos si no pagas completo</li>
                  <li>• Útil para emergencias</li>
                </ul>
              </div>
              <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                <h4 className="font-bold text-green-800 mb-2">🏦 Préstamo Personal</h4>
                <ul className="text-sm text-green-700 space-y-1">
                  <li>• Cantidad fija prestada</li>
                  <li>• Pagos mensuales fijos</li>
                  <li>• Intereses más bajos</li>
                  <li>• Para compras grandes</li>
                </ul>
              </div>
              <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                <h4 className="font-bold text-purple-800 mb-2">🏠 Préstamo Hipotecario</h4>
                <ul className="text-sm text-purple-700 space-y-1">
                  <li>• Para comprar una casa</li>
                  <li>• Plazos muy largos (15-30 años)</li>
                  <li>• Intereses más bajos</li>
                  <li>• La casa es garantía</li>
                </ul>
              </div>
              <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                <h4 className="font-bold text-yellow-800 mb-2">🚗 Préstamo Automotriz</h4>
                <ul className="text-sm text-yellow-700 space-y-1">
                  <li>• Para comprar un carro</li>
                  <li>• Plazos de 3-7 años</li>
                  <li>• El carro es garantía</li>
                  <li>• Intereses moderados</li>
                </ul>
              </div>
            </div>
            <div className="bg-red-100 p-4 rounded-lg">
              <p className="text-sm text-red-800">
                <strong>Importante:</strong> Cada tipo de crédito tiene diferentes tasas de interés y condiciones. Siempre compara antes de decidir.
              </p>
            </div>
          </div>
        )
      }
    },

    // Step 7: Activity - Credit type matching
    {
      id: 'credit-type-activity',
      type: 'activity' as const,
      title: 'Elige el Tipo de Crédito Correcto',
      character: lucas,
      points: 30,
      content: {
        type: 'question',
        description: 'Ayuda a Lucas a elegir el tipo de crédito apropiado para su situación',
        question: "Lucas necesita $10,000 para comprar una laptop para la universidad. ¿Qué tipo de crédito sería más apropiado?",
        options: [
          "Tarjeta de crédito con 25% de interés anual",
          "Préstamo personal con 12% de interés anual",
          "Préstamo hipotecario a 30 años",
          "Préstamo automotriz a 5 años"
        ],
        correct: 1,
        feedback: "¡Excelente elección! Un préstamo personal con 12% de interés es la mejor opción para Lucas. Tiene intereses más bajos que la tarjeta de crédito y es apropiado para este tipo de compra."
      }
    },

    // Step 8: Comment after credit type activity
    {
      id: 'credit-type-comment',
      type: 'comment' as const,
      title: '¡Elección Inteligente!',
      character: sol,
      content: {
        message: "¡Perfecto! Ya sabes cómo elegir el tipo de crédito apropiado. Ahora vamos a aprender sobre la responsabilidad del endeudamiento.",
        content: (
          <div className="bg-yellow-100 p-4 rounded-lg">
            <p className="text-sm text-yellow-800">
              <strong>Consejo:</strong> Siempre compara las tasas de interés y lee los términos y condiciones antes de firmar cualquier crédito.
            </p>
          </div>
        )
      }
    },

    // Step 9: Information about debt responsibility
    {
      id: 'debt-responsibility-info',
      type: 'information' as const,
      title: 'La Responsabilidad del Endeudamiento',
      character: maestroDinero,
      content: {
        message: "El crédito es una herramienta poderosa, pero conlleva grandes responsabilidades. Debes entender que estás comprometiendo tu futuro.",
        content: (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                <h4 className="font-bold text-red-800 mb-2">⚠️ Riesgos del Crédito</h4>
                <ul className="text-sm text-red-700 space-y-1">
                  <li>• Deudas que pueden crecer rápidamente</li>
                  <li>• Intereses que aumentan el costo total</li>
                  <li>• Impacto negativo en tu historial crediticio</li>
                  <li>• Estrés financiero y emocional</li>
                  <li>• Limitación de opciones futuras</li>
                </ul>
              </div>
              <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                <h4 className="font-bold text-green-800 mb-2">✅ Uso Responsable</h4>
                <ul className="text-sm text-green-700 space-y-1">
                  <li>• Solo pedir lo que realmente necesitas</li>
                  <li>• Asegurarte de poder pagar las cuotas</li>
                  <li>• Pagar siempre a tiempo</li>
                  <li>• Mantener un buen historial crediticio</li>
                  <li>• Tener un plan de pago claro</li>
                </ul>
              </div>
            </div>
            <div className="bg-blue-100 p-4 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Regla de oro:</strong> Si no puedes pagar en efectivo, piensa dos veces antes de usar crédito. El crédito debe ser una herramienta, no un estilo de vida.
              </p>
            </div>
          </div>
        )
      }
    },

    // Step 10: Activity - Debt responsibility
    {
      id: 'debt-responsibility-activity',
      type: 'activity' as const,
      title: '¿Debería Usar Crédito?',
      character: lucas,
      points: 25,
      content: {
        type: 'question',
        description: 'Ayuda a Lucas a decidir si debería usar crédito para la laptop',
        question: "Lucas tiene $5,000 ahorrados y puede ahorrar $500 mensuales. La laptop cuesta $15,000. ¿Debería usar crédito?",
        options: [
          "Sí, pedir un préstamo de $10,000 ahora",
          "No, ahorrar $500 mensuales por 20 meses",
          "Sí, usar tarjeta de crédito con 25% de interés",
          "No, comprar una laptop más barata de $5,000"
        ],
        correct: 1,
        feedback: "¡Excelente decisión! Ahorrar $500 mensuales por 20 meses es la mejor opción. Lucas evita deudas, intereses y desarrolla disciplina financiera."
      }
    },

    // Step 11: Final reflection
    {
      id: 'final-reflection',
      type: 'comment' as const,
      title: '¡Crédito Comprendido!',
      character: maestroDinero,
      content: {
        message: "¡Felicitaciones! Has completado tu primera lección sobre crédito. Ahora entiendes qué es, los diferentes tipos y la responsabilidad que conlleva.",
        content: (
          <div className="space-y-4">
            <div className="bg-gradient-to-r from-green-100 to-blue-100 p-4 rounded-lg">
              <h3 className="font-bold text-green-800 mb-2">Lo que aprendiste hoy:</h3>
              <ul className="space-y-1 text-sm text-green-700">
                <li>✅ Entender qué es el crédito y cómo funciona</li>
                <li>✅ Identificar diferentes tipos de crédito</li>
                <li>✅ Comprender los riesgos y responsabilidades</li>
                <li>✅ Tomar decisiones inteligentes sobre el endeudamiento</li>
              </ul>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-600">
                ¡Ahora puedes usar el crédito de manera responsable y evitar las trampas del endeudamiento!
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
        question: "¿Cuándo crees que sería apropiado usar crédito y cuándo no?",
        message: "Antes de terminar, piensa en tu futuro. ¿En qué situaciones usarías crédito? ¿Cómo te asegurarías de usarlo de manera responsable?",
        rewards: {
          points: 50,
          badges: ["Experto en Crédito", "Deudor Responsable"],
          stickers: ["💳", "📊", "⭐", "🎯"]
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

export default Lesson5_1_QueEsCredito;
