import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  StepBasedLesson,
  characters 
} from './LessonComponents';
import { ChevronRight, ChevronLeft, Home, Shield, AlertTriangle, DollarSign, Heart } from 'lucide-react';

interface Lesson7_2Props {
  onComplete: (score: number, progress: any) => void;
  onExit: () => void;
}

const Lesson7_2_SegurosProteccion: React.FC<Lesson7_2Props> = ({ onComplete, onExit }) => {
  const lucas = characters.lucas;
  const sol = characters.sol;
  const maestroDinero = characters.maestro_dinero;

  // Step-based lesson structure - each step shows one thing at a time
  const lessonSteps = [
    // Step 1: Hook/Introduction
    {
      id: 'hook',
      type: 'information' as const,
      title: 'El Escudo Financiero',
      character: lucas,
      content: {
        message: "¡Hola! Soy Lucas y tengo 16 años. Mi papá me contó que cuando era joven, tuvo un accidente en su carro y tuvo que pagar $50,000 en reparaciones. Pero como tenía seguro, solo pagó $500. ¿Qué son los seguros y cómo me protegen?",
        content: (
          <div className="text-center space-y-4">
            <div className="text-6xl">🛡️🚗</div>
            <p className="text-lg font-medium text-gray-700">
              Lucas quiere entender los seguros y la protección financiera
            </p>
            <div className="bg-green-100 p-4 rounded-lg">
              <p className="text-sm text-green-800">
                <strong>Descubrimiento:</strong> Los seguros protegen contra pérdidas financieras
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
        message: "¡Hola joven protector financiero! Soy el Maestro Dinero, y hoy vamos a aprender sobre seguros y protección financiera. Es como construir un escudo para tu futuro económico.",
        content: (
          <div className="space-y-4">
            <div className="bg-blue-100 p-4 rounded-lg">
              <h3 className="font-bold text-blue-800 mb-2">¿Qué vamos a aprender hoy?</h3>
              <ul className="space-y-2 text-sm text-blue-700">
                <li>• Entender la importancia de los seguros</li>
                <li>• Identificar diferentes tipos de riesgos financieros</li>
                <li>• Conocer opciones de protección financiera</li>
                <li>• Tomar decisiones informadas sobre seguros</li>
              </ul>
            </div>
          </div>
        )
      }
    },

    // Step 3: Information about insurance importance
    {
      id: 'insurance-importance-info',
      type: 'information' as const,
      title: '¿Por Qué son Importantes los Seguros?',
      character: sol,
      content: {
        message: "¡Hola! Soy Sol y me encanta explicar conceptos de protección. Los seguros son como un paraguas que te protege cuando llueve.",
        content: (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-4 bg-green-100 rounded-lg">
                <div className="text-4xl mb-2">🛡️</div>
                <p className="text-sm font-medium">Protección</p>
                <p className="text-xs text-gray-600">Te protege de pérdidas grandes</p>
              </div>
              <div className="text-center p-4 bg-blue-100 rounded-lg">
                <div className="text-4xl mb-2">💪</div>
                <p className="text-sm font-medium">Paz Mental</p>
                <p className="text-xs text-gray-600">Te sientes más seguro</p>
              </div>
              <div className="text-center p-4 bg-yellow-100 rounded-lg">
                <div className="text-4xl mb-2">💰</div>
                <p className="text-sm font-medium">Estabilidad</p>
                <p className="text-xs text-gray-600">Mantiene tu estabilidad financiera</p>
              </div>
            </div>
            <div className="bg-orange-100 p-4 rounded-lg">
              <p className="text-sm text-orange-800">
                <strong>Principio:</strong> Los seguros transfieren el riesgo de una pérdida grande a una pequeña (la prima mensual).
              </p>
            </div>
            <div className="bg-purple-100 p-4 rounded-lg">
              <p className="text-sm text-purple-800">
                <strong>Ejemplo:</strong> Sin seguro de auto, un accidente puede costarte $50,000. Con seguro, solo pagas $500 de deducible.
              </p>
            </div>
          </div>
        )
      }
    },

    // Step 4: Activity - Understanding insurance
    {
      id: 'insurance-understanding-activity',
      type: 'activity' as const,
      title: '¿Cuándo Necesitas Seguro?',
      character: lucas,
      points: 25,
      content: {
        type: 'question',
        description: 'Ayuda a Lucas a entender cuándo necesita seguro',
        question: "¿En cuál de estas situaciones sería más importante tener seguro?",
        options: [
          "Comprar un helado de $50",
          "Comprar un carro de $200,000",
          "Comprar ropa de $1,000",
          "Comprar un libro de $200"
        ],
        correct: 1,
        feedback: "¡Correcto! Comprar un carro de $200,000 es la situación donde más necesitas seguro. Es un bien valioso que puede sufrir daños costosos."
      }
    },

    // Step 5: Comment after activity
    {
      id: 'insurance-understanding-comment',
      type: 'comment' as const,
      title: '¡Buen Trabajo!',
      character: sol,
      content: {
        message: "¡Perfecto! Ya entiendes cuándo necesitas seguro. Ahora vamos a conocer los diferentes tipos de riesgos financieros.",
        content: (
          <div className="bg-green-100 p-4 rounded-lg">
            <p className="text-sm text-green-800">
              <strong>Recuerda:</strong> Los seguros son más importantes para bienes valiosos y situaciones de alto riesgo.
            </p>
          </div>
        )
      }
    },

    // Step 6: Information about financial risks
    {
      id: 'financial-risks-info',
      type: 'information' as const,
      title: 'Tipos de Riesgos Financieros',
      character: maestroDinero,
      content: {
        message: "Existen diferentes tipos de riesgos financieros que pueden afectar tu estabilidad económica.",
        content: (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                <h4 className="font-bold text-red-800 mb-2">🚗 Riesgos de Propiedad</h4>
                <ul className="text-sm text-red-700 space-y-1">
                  <li>• Daños a tu carro</li>
                  <li>• Robo de tus pertenencias</li>
                  <li>• Daños a tu casa/apartamento</li>
                  <li>• Incendios o desastres naturales</li>
                  <li>• Seguro: Auto, hogar, renters</li>
                </ul>
              </div>
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <h4 className="font-bold text-blue-800 mb-2">🏥 Riesgos de Salud</h4>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li>• Enfermedades o accidentes</li>
                  <li>• Cirugías costosas</li>
                  <li>• Medicamentos caros</li>
                  <li>• Tratamientos especializados</li>
                  <li>• Seguro: Médico, dental, vida</li>
                </ul>
              </div>
              <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                <h4 className="font-bold text-green-800 mb-2">💼 Riesgos de Responsabilidad</h4>
                <ul className="text-sm text-green-700 space-y-1">
                  <li>• Daños a otras personas</li>
                  <li>• Demandas legales</li>
                  <li>• Errores profesionales</li>
                  <li>• Accidentes que causas</li>
                  <li>• Seguro: Responsabilidad civil</li>
                </ul>
              </div>
              <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                <h4 className="font-bold text-yellow-800 mb-2">💀 Riesgos de Vida</h4>
                <ul className="text-sm text-yellow-700 space-y-1">
                  <li>• Muerte prematura</li>
                  <li>• Incapacidad permanente</li>
                  <li>• Pérdida de ingresos</li>
                  <li>• Deudas pendientes</li>
                  <li>• Seguro: Vida, incapacidad</li>
                </ul>
              </div>
            </div>
            <div className="bg-purple-100 p-4 rounded-lg">
              <p className="text-sm text-purple-800">
                <strong>Consejo:</strong> Cada tipo de riesgo requiere un tipo específico de seguro. No existe un seguro que cubra todo.
              </p>
            </div>
          </div>
        )
      }
    },

    // Step 7: Activity - Risk identification
    {
      id: 'risk-identification-activity',
      type: 'activity' as const,
      title: 'Identifica el Tipo de Riesgo',
      character: lucas,
      points: 30,
      content: {
        type: 'question',
        description: 'Ayuda a Lucas a identificar el tipo de riesgo financiero',
        question: "Lucas va a conducir un carro por primera vez. ¿Qué tipo de riesgo financiero enfrenta principalmente?",
        options: [
          "Riesgo de salud (enfermedades)",
          "Riesgo de propiedad (daños al carro)",
          "Riesgo de responsabilidad (accidentes a otros)",
          "Riesgo de vida (muerte)"
        ],
        correct: 2,
        feedback: "¡Correcto! Como conductor principiante, Lucas enfrenta principalmente riesgo de responsabilidad. Si causa un accidente, puede ser responsable de daños a otros."
      }
    },

    // Step 8: Comment after risk activity
    {
      id: 'risk-comment',
      type: 'comment' as const,
      title: '¡Riesgo Identificado!',
      character: sol,
      content: {
        message: "¡Excelente! Ya entiendes los diferentes tipos de riesgos. Ahora vamos a conocer las opciones de protección financiera.",
        content: (
          <div className="bg-yellow-100 p-4 rounded-lg">
            <p className="text-sm text-yellow-800">
              <strong>Consejo:</strong> Identificar el tipo de riesgo te ayuda a elegir el seguro correcto.
            </p>
          </div>
        )
      }
    },

    // Step 9: Information about protection options
    {
      id: 'protection-options-info',
      type: 'information' as const,
      title: 'Opciones de Protección Financiera',
      character: maestroDinero,
      content: {
        message: "Existen diferentes opciones para protegerte financieramente, cada una con sus propias características.",
        content: (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <h4 className="font-bold text-blue-800 mb-2">🛡️ Seguros Tradicionales</h4>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li>• Seguro de auto</li>
                  <li>• Seguro de hogar/renters</li>
                  <li>• Seguro médico</li>
                  <li>• Seguro de vida</li>
                  <li>• Seguro de responsabilidad</li>
                </ul>
              </div>
              <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                <h4 className="font-bold text-green-800 mb-2">💰 Fondos de Emergencia</h4>
                <ul className="text-sm text-green-700 space-y-1">
                  <li>• Ahorro de 3-6 meses de gastos</li>
                  <li>• Para gastos inesperados</li>
                  <li>• Acceso inmediato al dinero</li>
                  <li>• No requiere pagos mensuales</li>
                  <li>• Complementa los seguros</li>
                </ul>
              </div>
              <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                <h4 className="font-bold text-purple-800 mb-2">🏦 Seguros Bancarios</h4>
                <ul className="text-sm text-purple-700 space-y-1">
                  <li>• Seguro de depósitos bancarios</li>
                  <li>• Protección de cuentas</li>
                  <li>• Seguro de tarjetas de crédito</li>
                  <li>• Protección contra fraudes</li>
                  <li>• Automático con cuentas bancarias</li>
                </ul>
              </div>
              <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                <h4 className="font-bold text-yellow-800 mb-2">📱 Seguros Digitales</h4>
                <ul className="text-sm text-yellow-700 space-y-1">
                  <li>• Seguro de dispositivos móviles</li>
                  <li>• Protección de datos</li>
                  <li>• Seguro de viajes</li>
                  <li>• Seguros por suscripción</li>
                  <li>• Cobertura temporal</li>
                </ul>
              </div>
            </div>
            <div className="bg-orange-100 p-4 rounded-lg">
              <p className="text-sm text-orange-800">
                <strong>Estrategia:</strong> Combina diferentes tipos de protección. Los seguros cubren riesgos específicos, mientras que los fondos de emergencia te dan flexibilidad.
              </p>
            </div>
          </div>
        )
      }
    },

    // Step 10: Activity - Protection strategy
    {
      id: 'protection-strategy-activity',
      type: 'activity' as const,
      title: 'Elige tu Estrategia de Protección',
      character: lucas,
      points: 25,
      content: {
        type: 'question',
        description: 'Ayuda a Lucas a elegir la mejor estrategia de protección financiera',
        question: "Lucas tiene 16 años y va a empezar a conducir. ¿Cuál sería la mejor estrategia de protección financiera?",
        options: [
          "Solo ahorrar dinero para emergencias",
          "Solo contratar seguro de auto",
          "Contratar seguro de auto Y ahorrar para emergencias",
          "No hacer nada, los accidentes no pasan"
        ],
        correct: 2,
        feedback: "¡Excelente elección! Combinar seguro de auto con ahorros para emergencias es la mejor estrategia. El seguro cubre daños grandes y los ahorros cubren deducibles y gastos menores."
      }
    },

    // Step 11: Final reflection
    {
      id: 'final-reflection',
      type: 'comment' as const,
      title: '¡Protección Financiera Comprendida!',
      character: maestroDinero,
      content: {
        message: "¡Felicitaciones! Has completado tu lección sobre seguros y protección financiera. Ahora entiendes cómo proteger tu futuro económico.",
        content: (
          <div className="space-y-4">
            <div className="bg-gradient-to-r from-green-100 to-blue-100 p-4 rounded-lg">
              <h3 className="font-bold text-green-800 mb-2">Lo que aprendiste hoy:</h3>
              <ul className="space-y-1 text-sm text-green-700">
                <li>✅ Entender la importancia de los seguros</li>
                <li>✅ Identificar diferentes tipos de riesgos financieros</li>
                <li>✅ Conocer opciones de protección financiera</li>
                <li>✅ Tomar decisiones informadas sobre seguros</li>
              </ul>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-600">
                ¡Ahora puedes construir un escudo financiero para proteger tu futuro!
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
        question: "¿Qué tipo de protección financiera crees que necesitarás más en tu futuro y por qué?",
        message: "Antes de terminar, piensa en tu futuro. ¿Qué riesgos financieros te preocupan más? ¿Qué tipo de protección planeas tener cuando seas mayor?",
        rewards: {
          points: 50,
          badges: ["Protector Financiero", "Escudo de Seguridad"],
          stickers: ["🛡️", "💰", "⭐", "🎯"]
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

export default Lesson7_2_SegurosProteccion;
