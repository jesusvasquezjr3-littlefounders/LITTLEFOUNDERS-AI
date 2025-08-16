import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  StepBasedLesson,
  characters 
} from './LessonComponents';
import { ChevronRight, ChevronLeft, Home, Target, Calendar, TrendingUp, Calculator, Goal } from 'lucide-react';

interface Lesson4_1Props {
  onComplete: (score: number, progress: any) => void;
  onExit: () => void;
}

const Lesson4_1_PlanificacionFinanciera: React.FC<Lesson4_1Props> = ({ onComplete, onExit }) => {
  const lucas = characters.lucas;
  const sol = characters.sol;
  const maestroDinero = characters.maestro_dinero;

  // Step-based lesson structure - each step shows one thing at a time
  const lessonSteps = [
    // Step 1: Hook/Introduction
    {
      id: 'hook',
      type: 'information' as const,
      title: 'El Sueño de la Universidad',
      character: lucas,
      content: {
        message: "¡Hola! Soy Lucas y tengo 15 años. Mi sueño es estudiar ingeniería en la universidad, pero mis papás me dijeron que necesito empezar a planificar desde ahora. ¿Me puedes ayudar a crear un plan financiero para mi futuro?",
        content: (
          <div className="text-center space-y-4">
            <div className="text-6xl">🎓💭</div>
            <p className="text-lg font-medium text-gray-700">
              Lucas quiere estudiar ingeniería en la universidad
            </p>
            <div className="bg-blue-100 p-4 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Desafío:</strong> Planificar financieramente para la universidad desde los 15 años
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
        message: "¡Hola joven planificador! Soy el Maestro Dinero, y hoy vamos a aprender sobre planificación financiera a largo plazo. Es como crear un mapa para tu futuro financiero.",
        content: (
          <div className="space-y-4">
            <div className="bg-purple-100 p-4 rounded-lg">
              <h3 className="font-bold text-purple-800 mb-2">¿Qué vamos a aprender hoy?</h3>
              <ul className="space-y-2 text-sm text-purple-700">
                <li>• Crear metas financieras a mediano y largo plazo</li>
                <li>• Desarrollar planes financieros estructurados</li>
                <li>• Evaluar y ajustar estrategias financieras</li>
                <li>• Usar herramientas digitales para planificación</li>
              </ul>
            </div>
          </div>
        )
      }
    },

    // Step 3: Information about long-term planning
    {
      id: 'planning-info',
      type: 'information' as const,
      title: '¿Qué es la Planificación Financiera a Largo Plazo?',
      character: sol,
      content: {
        message: "¡Hola! Soy Sol y me encanta planificar. La planificación financiera a largo plazo es como crear un mapa para tu futuro económico.",
        content: (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-4 bg-green-100 rounded-lg">
                <div className="text-4xl mb-2">🎯</div>
                <p className="text-sm font-medium">Metas Claras</p>
                <p className="text-xs text-gray-600">Definir objetivos específicos</p>
              </div>
              <div className="text-center p-4 bg-blue-100 rounded-lg">
                <div className="text-4xl mb-2">📅</div>
                <p className="text-sm font-medium">Timeline</p>
                <p className="text-xs text-gray-600">Plazos realistas</p>
              </div>
              <div className="text-center p-4 bg-yellow-100 rounded-lg">
                <div className="text-4xl mb-2">💰</div>
                <p className="text-sm font-medium">Recursos</p>
                <p className="text-xs text-gray-600">Presupuesto y ahorro</p>
              </div>
            </div>
            <div className="bg-orange-100 p-4 rounded-lg">
              <p className="text-sm text-orange-800">
                <strong>Beneficio:</strong> Comenzar temprano te da más tiempo para alcanzar tus metas y aprovechar el interés compuesto.
              </p>
            </div>
          </div>
        )
      }
    },

    // Step 4: Activity - Goal setting
    {
      id: 'goal-setting-activity',
      type: 'activity' as const,
      title: 'Define Tus Metas Financieras',
      character: lucas,
      points: 25,
      content: {
        type: 'question',
        description: 'Ayuda a Lucas a definir sus metas financieras a largo plazo',
        question: "Lucas tiene 15 años y quiere estudiar ingeniería. ¿Cuál es la mejor estrategia para planificar financieramente?",
        options: [
          "Empezar a ahorrar $100 mensuales para la universidad",
          "Esperar hasta los 18 años para pensar en el dinero",
          "Pedir un préstamo grande cuando llegue el momento",
          "Confiar solo en becas y no ahorrar nada"
        ],
        correct: 0,
        feedback: "¡Excelente! Empezar a ahorrar temprano es la mejor estrategia. $100 mensuales durante 3 años pueden generar más de $3,600, sin contar intereses."
      }
    },

    // Step 5: Comment after activity
    {
      id: 'goal-setting-comment',
      type: 'comment' as const,
      title: '¡Buen Trabajo!',
      character: sol,
      content: {
        message: "¡Perfecto! Ya entiendes la importancia de empezar temprano. Ahora vamos a aprender sobre las herramientas de planificación.",
        content: (
          <div className="bg-green-100 p-4 rounded-lg">
            <p className="text-sm text-green-800">
              <strong>Recuerda:</strong> El tiempo es tu mejor aliado en la planificación financiera. Mientras más temprano empieces, más opciones tendrás.
            </p>
          </div>
        )
      }
    },

    // Step 6: Information about planning tools
    {
      id: 'planning-tools-info',
      type: 'information' as const,
      title: 'Herramientas de Planificación Financiera',
      character: maestroDinero,
      content: {
        message: "Ahora vamos a conocer las herramientas que puedes usar para planificar tu futuro financiero.",
        content: (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <h4 className="font-bold text-blue-800 mb-2">📱 Apps de Planificación</h4>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li>• Mint - Seguimiento de gastos</li>
                  <li>• YNAB - Presupuesto por categorías</li>
                  <li>• Acorns - Ahorro automático</li>
                  <li>• GoalSetter - Metas financieras</li>
                </ul>
              </div>
              <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                <h4 className="font-bold text-green-800 mb-2">📊 Calculadoras Financieras</h4>
                <ul className="text-sm text-green-700 space-y-1">
                  <li>• Calculadora de interés compuesto</li>
                  <li>• Simulador de ahorro</li>
                  <li>• Planificador de metas</li>
                  <li>• Calculadora de inflación</li>
                </ul>
              </div>
            </div>
            <div className="bg-purple-100 p-4 rounded-lg">
              <p className="text-sm text-purple-800">
                <strong>Consejo:</strong> Usa estas herramientas para hacer seguimiento regular de tu progreso y ajustar tu plan cuando sea necesario.
              </p>
            </div>
          </div>
        )
      }
    },

    // Step 7: Activity - Planning simulation
    {
      id: 'planning-simulation-activity',
      type: 'activity' as const,
      title: 'Simulador: Mi Vida a los 25 Años',
      character: lucas,
      points: 30,
      content: {
        type: 'question',
        description: 'Ayuda a Lucas a simular su situación financiera a los 25 años',
        question: "Si Lucas ahorra $150 mensuales desde los 15 años con un interés del 5% anual, ¿cuánto tendrá a los 25 años?",
        options: [
          "$18,000",
          "$22,500", 
          "$25,800",
          "$30,200"
        ],
        correct: 2,
        feedback: "¡Correcto! Con interés compuesto, Lucas tendría aproximadamente $25,800. Esto demuestra el poder del ahorro temprano y el interés compuesto."
      }
    },

    // Step 8: Comment after simulation
    {
      id: 'simulation-comment',
      type: 'comment' as const,
      title: '¡El Poder del Interés Compuesto!',
      character: sol,
      content: {
        message: "¡Increíble! El interés compuesto es como una bola de nieve que crece mientras rueda. Mientras más temprano empieces, más grande será tu bola de nieve.",
        content: (
          <div className="bg-yellow-100 p-4 rounded-lg">
            <p className="text-sm text-yellow-800">
              <strong>Fórmula del éxito:</strong> Ahorro regular + Tiempo + Interés compuesto = Futuro financiero sólido
            </p>
          </div>
        )
      }
    },

    // Step 9: Information about strategy evaluation
    {
      id: 'strategy-evaluation-info',
      type: 'information' as const,
      title: 'Evaluación y Ajuste de Estrategias',
      character: maestroDinero,
      content: {
        message: "La planificación financiera no es estática. Necesitas revisar y ajustar tu plan regularmente.",
        content: (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                <h4 className="font-bold text-red-800 mb-2">⚠️ Cuándo Revisar</h4>
                <ul className="text-sm text-red-700 space-y-1">
                  <li>• Cambios en ingresos</li>
                  <li>• Nuevas metas o prioridades</li>
                  <li>• Cambios en la economía</li>
                  <li>• Cada 6 meses mínimo</li>
                </ul>
              </div>
              <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                <h4 className="font-bold text-green-800 mb-2">✅ Cómo Ajustar</h4>
                <ul className="text-sm text-green-700 space-y-1">
                  <li>• Aumentar ahorro si es posible</li>
                  <li>• Cambiar estrategias de inversión</li>
                  <li>• Revisar metas y prioridades</li>
                  <li>• Buscar nuevas oportunidades</li>
                </ul>
              </div>
            </div>
            <div className="bg-blue-100 p-4 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Flexibilidad:</strong> Un buen plan financiero debe ser flexible para adaptarse a los cambios de la vida.
              </p>
            </div>
          </div>
        )
      }
    },

    // Step 10: Final activity - Strategy planning
    {
      id: 'strategy-planning-activity',
      type: 'activity' as const,
      title: 'Crea Tu Plan Financiero',
      character: lucas,
      points: 25,
      content: {
        type: 'question',
        description: 'Ayuda a Lucas a crear un plan financiero completo',
        question: "Lucas quiere crear un plan financiero para la universidad. ¿Cuál es el primer paso más importante?",
        options: [
          "Investigar costos de universidades y carreras",
          "Abrir una cuenta de ahorros con alto interés",
          "Buscar trabajos de medio tiempo",
          "Pedir consejos a familiares y amigos"
        ],
        correct: 0,
        feedback: "¡Excelente! Investigar los costos reales es fundamental. Necesitas saber cuánto dinero necesitas para crear un plan realista y alcanzable."
      }
    },

    // Step 11: Final reflection
    {
      id: 'final-reflection',
      type: 'comment' as const,
      title: '¡Planificación Completada!',
      character: maestroDinero,
      content: {
        message: "¡Felicitaciones! Has completado tu primera lección sobre planificación financiera a largo plazo. Ahora tienes las herramientas para crear tu propio plan financiero.",
        content: (
          <div className="space-y-4">
            <div className="bg-gradient-to-r from-green-100 to-blue-100 p-4 rounded-lg">
              <h3 className="font-bold text-green-800 mb-2">Lo que aprendiste hoy:</h3>
              <ul className="space-y-1 text-sm text-green-700">
                <li>✅ Crear metas financieras específicas y medibles</li>
                <li>✅ Usar herramientas digitales para planificación</li>
                <li>✅ Entender el poder del interés compuesto</li>
                <li>✅ Evaluar y ajustar estrategias regularmente</li>
              </ul>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-600">
                ¡Ahora puedes crear tu propio plan financiero para alcanzar tus sueños!
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
        question: "¿Cuál es tu meta financiera más importante para los próximos 5 años?",
        message: "Antes de terminar, piensa en tu futuro. ¿Qué meta financiera te gustaría alcanzar? ¿Cómo puedes empezar a planificar para ella hoy mismo?",
        rewards: {
          points: 50,
          badges: ["Planificador Financiero", "Visionario del Futuro"],
          stickers: ["🎯", "📈", "⭐", "🚀"]
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

export default Lesson4_1_PlanificacionFinanciera;
