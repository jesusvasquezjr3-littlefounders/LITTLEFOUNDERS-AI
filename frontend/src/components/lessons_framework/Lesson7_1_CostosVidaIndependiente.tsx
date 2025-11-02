import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  StepBasedLesson,
  characters 
} from './LessonComponents';
import { ChevronRight, ChevronLeft, Home, Calculator, DollarSign, Building, GraduationCap } from 'lucide-react';

interface Lesson7_1Props {
  onComplete: (score: number, progress: any) => void;
  onExit: () => void;
}

const Lesson7_1_CostosVidaIndependiente: React.FC<Lesson7_1Props> = ({ onComplete, onExit }) => {
  const lucas = characters.lucas;
  const sol = characters.sol;
  const maestroDinero = characters.maestro_dinero;

  // Step-based lesson structure - each step shows one thing at a time
  const lessonSteps = [
    // Step 1: Hook/Introduction
    {
      id: 'hook',
      type: 'information' as const,
      title: 'El Sueño de la Independencia',
      character: lucas,
      content: {
        message: "¡Hola! Soy Lucas y tengo 16 años. Mi hermano mayor se va a la universidad el próximo año y me contó sobre todos los gastos que tiene que pagar: renta, comida, transporte, servicios... ¿Cómo puedo prepararme para cuando sea mi turno?",
        content: (
          <div className="text-center space-y-4">
            <div className="text-6xl">🏠🎓</div>
            <p className="text-lg font-medium text-gray-700">
              Lucas quiere prepararse para la vida independiente
            </p>
            <div className="bg-blue-100 p-4 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Misión:</strong> Entender los costos reales de la vida independiente
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
        message: "¡Hola joven planificador! Soy el Maestro Dinero, y hoy vamos a explorar los costos reales de la vida independiente. Es como crear un mapa detallado de tus futuros gastos.",
        content: (
          <div className="space-y-4">
            <div className="bg-purple-100 p-4 rounded-lg">
              <h3 className="font-bold text-purple-800 mb-2">¿Qué vamos a aprender hoy?</h3>
              <ul className="space-y-2 text-sm text-purple-700">
                <li>• Identificar los costos principales de la vida independiente</li>
                <li>• Crear un presupuesto universitario/laboral</li>
                <li>• Planificar la transición a la adultez financiera</li>
                <li>• Desarrollar estrategias para manejar los gastos</li>
              </ul>
            </div>
          </div>
        )
      }
    },

    // Step 3: Information about independent living costs
    {
      id: 'independent-costs-info',
      type: 'information' as const,
      title: 'Los Costos de la Vida Independiente',
      character: sol,
      content: {
        message: "¡Hola! Soy Sol y me encanta planificar. La vida independiente tiene muchos costos que debes conocer antes de dar el paso.",
        content: (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                <h4 className="font-bold text-red-800 mb-2">🏠 Vivienda</h4>
                <ul className="text-sm text-red-700 space-y-1">
                  <li>• Renta mensual</li>
                  <li>• Depósito de seguridad</li>
                  <li>• Servicios básicos (luz, agua, gas)</li>
                  <li>• Internet y telefonía</li>
                  <li>• Seguro de renters</li>
                </ul>
              </div>
              <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                <h4 className="font-bold text-green-800 mb-2">🍽️ Alimentación</h4>
                <ul className="text-sm text-green-700 space-y-1">
                  <li>• Comida diaria</li>
                  <li>• Productos de limpieza</li>
                  <li>• Artículos de higiene</li>
                  <li>• Comidas fuera de casa</li>
                  <li>• Snacks y bebidas</li>
                </ul>
              </div>
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <h4 className="font-bold text-blue-800 mb-2">🚗 Transporte</h4>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li>• Transporte público</li>
                  <li>• Gasolina (si tienes carro)</li>
                  <li>• Mantenimiento del vehículo</li>
                  <li>• Seguro de auto</li>
                  <li>• Estacionamiento</li>
                </ul>
              </div>
              <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                <h4 className="font-bold text-yellow-800 mb-2">📚 Educación</h4>
                <ul className="text-sm text-yellow-700 space-y-1">
                  <li>• Matrícula universitaria</li>
                  <li>• Libros y materiales</li>
                  <li>• Equipos tecnológicos</li>
                  <li>• Cursos adicionales</li>
                  <li>• Software y aplicaciones</li>
                </ul>
              </div>
            </div>
            <div className="bg-orange-100 p-4 rounded-lg">
              <p className="text-sm text-orange-800">
                <strong>Consejo:</strong> Estos costos varían según la ciudad, el estilo de vida y las opciones que elijas. Siempre investiga los precios locales.
              </p>
            </div>
          </div>
        )
      }
    },

    // Step 4: Activity - Cost identification
    {
      id: 'cost-identification-activity',
      type: 'activity' as const,
      title: 'Identifica los Costos',
      character: lucas,
      points: 25,
      content: {
        type: 'question',
        description: 'Ayuda a Lucas a identificar cuál es el costo más importante de la vida independiente',
        question: "¿Cuál de estos costos suele ser el más alto para una persona que vive independientemente?",
        options: [
          "Alimentación y comida",
          "Vivienda (renta y servicios)",
          "Transporte y movilidad",
          "Entretenimiento y ocio"
        ],
        correct: 1,
        feedback: "¡Correcto! La vivienda (renta y servicios) suele ser el costo más alto, representando entre 30-50% del presupuesto mensual de una persona independiente."
      }
    },

    // Step 5: Comment after activity
    {
      id: 'cost-identification-comment',
      type: 'comment' as const,
      title: '¡Buen Trabajo!',
      character: sol,
      content: {
        message: "¡Perfecto! Ya entiendes que la vivienda es el costo más importante. Ahora vamos a crear un presupuesto universitario/laboral.",
        content: (
          <div className="bg-green-100 p-4 rounded-lg">
            <p className="text-sm text-green-800">
              <strong>Recuerda:</strong> La regla general es que la vivienda no debe superar el 30% de tus ingresos mensuales.
            </p>
          </div>
        )
      }
    },

    // Step 6: Information about university budget
    {
      id: 'university-budget-info',
      type: 'information' as const,
      title: 'Presupuesto Universitario/Laboral',
      character: maestroDinero,
      content: {
        message: "Crear un presupuesto detallado es fundamental para manejar los costos de la vida independiente.",
        content: (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <h4 className="font-bold text-blue-800 mb-2">💰 Ingresos Mensuales</h4>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li>• Salario de trabajo de medio tiempo</li>
                  <li>• Beca universitaria</li>
                  <li>• Apoyo familiar</li>
                  <li>• Ingresos freelance</li>
                  <li>• Ahorros previos</li>
                </ul>
              </div>
              <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                <h4 className="font-bold text-red-800 mb-2">💸 Gastos Mensuales</h4>
                <ul className="text-sm text-red-700 space-y-1">
                  <li>• Vivienda: 30-40%</li>
                  <li>• Alimentación: 15-20%</li>
                  <li>• Transporte: 10-15%</li>
                  <li>• Educación: 10-15%</li>
                  <li>• Otros: 10-15%</li>
                </ul>
              </div>
            </div>
            <div className="bg-yellow-100 p-4 rounded-lg">
              <p className="text-sm text-yellow-800">
                <strong>Estrategia 50/30/20:</strong> 50% para necesidades, 30% para deseos, 20% para ahorro e inversión.
              </p>
            </div>
            <div className="bg-green-100 p-4 rounded-lg">
              <p className="text-sm text-green-800">
                <strong>Consejo:</strong> Siempre incluye un 10% para emergencias y gastos imprevistos en tu presupuesto.
              </p>
            </div>
          </div>
        )
      }
    },

    // Step 7: Activity - Budget planning
    {
      id: 'budget-planning-activity',
      type: 'activity' as const,
      title: 'Crea tu Presupuesto',
      character: lucas,
      points: 30,
      content: {
        type: 'question',
        description: 'Ayuda a Lucas a crear un presupuesto mensual realista',
        question: "Lucas tiene un ingreso mensual de $8,000. ¿Cuánto debería destinar para vivienda siguiendo la regla del 30%?",
        options: [
          "$1,500",
          "$2,400", 
          "$3,000",
          "$4,000"
        ],
        correct: 1,
        feedback: "¡Correcto! $2,400 es el 30% de $8,000. Esta es la cantidad máxima que Lucas debería gastar en vivienda para mantener un presupuesto saludable."
      }
    },

    // Step 8: Comment after budget activity
    {
      id: 'budget-comment',
      type: 'comment' as const,
      title: '¡Presupuesto Creado!',
      character: sol,
      content: {
        message: "¡Excelente! Ya sabes cómo crear un presupuesto realista. Ahora vamos a aprender sobre la transición a la adultez financiera.",
        content: (
          <div className="bg-yellow-100 p-4 rounded-lg">
            <p className="text-sm text-yellow-800">
              <strong>Consejo:</strong> Revisa y ajusta tu presupuesto mensualmente para mantener el control de tus finanzas.
            </p>
          </div>
        )
      }
    },

    // Step 9: Information about financial adulthood transition
    {
      id: 'financial-adulthood-info',
      type: 'information' as const,
      title: 'Transición a la Adultez Financiera',
      character: maestroDinero,
      content: {
        message: "La transición a la vida independiente requiere preparación financiera y cambios en tu mentalidad.",
        content: (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                <h4 className="font-bold text-green-800 mb-2">✅ Preparación Financiera</h4>
                <ul className="text-sm text-green-700 space-y-1">
                  <li>• Ahorrar para gastos iniciales</li>
                  <li>• Construir historial crediticio</li>
                  <li>• Aprender a presupuestar</li>
                  <li>• Investigar opciones de vivienda</li>
                  <li>• Comparar costos de diferentes ciudades</li>
                </ul>
              </div>
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <h4 className="font-bold text-blue-800 mb-2">🧠 Cambios de Mentalidad</h4>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li>• Tomar responsabilidad total</li>
                  <li>• Planificar a largo plazo</li>
                  <li>• Priorizar necesidades sobre deseos</li>
                  <li>• Desarrollar disciplina financiera</li>
                  <li>• Buscar oportunidades de ingreso</li>
                </ul>
              </div>
            </div>
            <div className="bg-purple-100 p-4 rounded-lg">
              <p className="text-sm text-purple-800">
                <strong>Timeline recomendado:</strong> Comienza a prepararte 1-2 años antes de tu independencia. Esto te da tiempo para ahorrar y aprender.
              </p>
            </div>
            <div className="bg-orange-100 p-4 rounded-lg">
              <p className="text-sm text-orange-800">
                <strong>Estrategia:</strong> Considera vivir con roommates o en residencias estudiantiles para reducir costos inicialmente.
              </p>
            </div>
          </div>
        )
      }
    },

    // Step 10: Activity - Transition planning
    {
      id: 'transition-planning-activity',
      type: 'activity' as const,
      title: 'Planifica tu Transición',
      character: lucas,
      points: 25,
      content: {
        type: 'question',
        description: 'Ayuda a Lucas a planificar su transición a la vida independiente',
        question: "Lucas tiene 16 años y planea ir a la universidad a los 18. ¿Cuál es el primer paso más importante para prepararse financieramente?",
        options: [
          "Pedir un préstamo grande para comprar un departamento",
          "Comenzar a ahorrar $500 mensuales para gastos iniciales",
          "Solicitar 10 tarjetas de crédito diferentes",
          "Gastar todo su dinero en equipos tecnológicos"
        ],
        correct: 1,
        feedback: "¡Excelente elección! Comenzar a ahorrar $500 mensuales es el primer paso más importante. En 2 años tendrá $12,000 para gastos iniciales como depósito, muebles y emergencias."
      }
    },

    // Step 11: Final reflection
    {
      id: 'final-reflection',
      type: 'comment' as const,
      title: '¡Vida Independiente Planificada!',
      character: maestroDinero,
      content: {
        message: "¡Felicitaciones! Has completado tu lección sobre los costos de la vida independiente. Ahora tienes las herramientas para planificar tu futuro financiero.",
        content: (
          <div className="space-y-4">
            <div className="bg-gradient-to-r from-green-100 to-blue-100 p-4 rounded-lg">
              <h3 className="font-bold text-green-800 mb-2">Lo que aprendiste hoy:</h3>
              <ul className="space-y-1 text-sm text-green-700">
                <li>✅ Identificar los costos principales de la vida independiente</li>
                <li>✅ Crear un presupuesto universitario/laboral realista</li>
                <li>✅ Planificar la transición a la adultez financiera</li>
                <li>✅ Desarrollar estrategias para manejar los gastos</li>
              </ul>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-600">
                ¡Ahora puedes prepararte para tu vida independiente con confianza y planificación!
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
        question: "¿Qué aspecto de la vida independiente te preocupa más y cómo planeas prepararte para ello?",
        message: "Antes de terminar, piensa en tu futuro. ¿Qué te preocupa más sobre los costos de la vida independiente? ¿Cómo planeas prepararte financieramente para esta transición?",
        rewards: {
          points: 50,
          badges: ["Planificador Independiente", "Adulto Financiero"],
          stickers: ["🏠", "💰", "⭐", "🎯"]
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

export default Lesson7_1_CostosVidaIndependiente;
