import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  StepBasedLesson,
  characters 
} from './LessonComponents';
import { ChevronRight, ChevronLeft, Home, Briefcase, DollarSign, Clock, Users, TrendingUp } from 'lucide-react';

interface Lesson4_2Props {
  onComplete: (score: number, progress: any) => void;
  onExit: () => void;
}

const Lesson4_2_IngresosTrabajos: React.FC<Lesson4_2Props> = ({ onComplete, onExit }) => {
  const lucas = characters.lucas;
  const sol = characters.sol;
  const maestroDinero = characters.maestro_dinero;

  // Step-based lesson structure - each step shows one thing at a time
  const lessonSteps = [
    // Step 1: Hook/Introduction
    {
      id: 'hook',
      type: 'information' as const,
      title: 'El Primer Trabajo de Lucas',
      character: lucas,
      content: {
        message: "¡Hola! Soy Lucas y tengo 15 años. Quiero ganar mi propio dinero para ahorrar para la universidad, pero no sé qué trabajos puedo hacer a mi edad. ¿Me puedes ayudar a encontrar oportunidades laborales?",
        content: (
          <div className="text-center space-y-4">
            <div className="text-6xl">💼🤔</div>
            <p className="text-lg font-medium text-gray-700">
              Lucas busca su primer trabajo de medio tiempo
            </p>
            <div className="bg-green-100 p-4 rounded-lg">
              <p className="text-sm text-green-800">
                <strong>Objetivo:</strong> Encontrar oportunidades laborales apropiadas para adolescentes
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
        message: "¡Hola joven emprendedor! Soy el Maestro Dinero, y hoy vamos a explorar el mundo de los trabajos de medio tiempo para adolescentes. Es una excelente manera de ganar experiencia y dinero.",
        content: (
          <div className="space-y-4">
            <div className="bg-blue-100 p-4 rounded-lg">
              <h3 className="font-bold text-blue-800 mb-2">¿Qué vamos a aprender hoy?</h3>
              <ul className="space-y-2 text-sm text-blue-700">
                <li>• Identificar oportunidades laborales para adolescentes</li>
                <li>• Entender derechos y responsabilidades laborales</li>
                <li>• Gestionar ingresos variables de manera inteligente</li>
                <li>• Balancear trabajo, estudios y vida personal</li>
              </ul>
            </div>
          </div>
        )
      }
    },

    // Step 3: Information about teen job opportunities
    {
      id: 'job-opportunities-info',
      type: 'information' as const,
      title: 'Oportunidades Laborales para Adolescentes',
      character: sol,
      content: {
        message: "¡Hola! Soy Sol y me encanta investigar. Hay muchas oportunidades laborales apropiadas para adolescentes. Te voy a mostrar las mejores opciones.",
        content: (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                <h4 className="font-bold text-yellow-800 mb-2">🏪 Trabajos Tradicionales</h4>
                <ul className="text-sm text-yellow-700 space-y-1">
                  <li>• Cajero en tiendas locales</li>
                  <li>• Ayudante en restaurantes</li>
                  <li>• Asistente en bibliotecas</li>
                  <li>• Cuidador de mascotas</li>
                </ul>
              </div>
              <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                <h4 className="font-bold text-green-800 mb-2">💻 Trabajos Digitales</h4>
                <ul className="text-sm text-green-700 space-y-1">
                  <li>• Tutoría en línea</li>
                  <li>• Creación de contenido</li>
                  <li>• Asistente virtual</li>
                  <li>• Programación freelance</li>
                </ul>
              </div>
            </div>
            <div className="bg-purple-100 p-4 rounded-lg">
              <p className="text-sm text-purple-800">
                <strong>Consejo:</strong> Busca trabajos que te permitan aprender nuevas habilidades y que sean flexibles con tu horario escolar.
              </p>
            </div>
          </div>
        )
      }
    },

    // Step 4: Activity - Job matching
    {
      id: 'job-matching-activity',
      type: 'activity' as const,
      title: 'Encuentra el Trabajo Ideal',
      character: lucas,
      points: 25,
      content: {
        type: 'question',
        description: 'Ayuda a Lucas a identificar el mejor trabajo para sus habilidades y horario',
        question: "Lucas es bueno con las computadoras y tiene tiempo libre los fines de semana. ¿Cuál sería el mejor trabajo para él?",
        options: [
          "Tutoría en línea de matemáticas",
          "Trabajo de tiempo completo en una fábrica",
          "Cuidar niños de 2 años sin experiencia",
          "Trabajo nocturno en un bar"
        ],
        correct: 0,
        feedback: "¡Excelente elección! La tutoría en línea es perfecta para Lucas porque aprovecha sus habilidades tecnológicas, es flexible con su horario escolar y puede ganar buen dinero."
      }
    },

    // Step 5: Comment after activity
    {
      id: 'job-matching-comment',
      type: 'comment' as const,
      title: '¡Buen Trabajo!',
      character: sol,
      content: {
        message: "¡Perfecto! Ya entiendes cómo elegir un trabajo apropiado. Ahora vamos a aprender sobre tus derechos y responsabilidades como trabajador.",
        content: (
          <div className="bg-green-100 p-4 rounded-lg">
            <p className="text-sm text-green-800">
              <strong>Recuerda:</strong> Siempre elige trabajos que sean seguros, legales y apropiados para tu edad.
            </p>
          </div>
        )
      }
    },

    // Step 6: Information about labor rights
    {
      id: 'labor-rights-info',
      type: 'information' as const,
      title: 'Derechos y Responsabilidades Laborales',
      character: maestroDinero,
      content: {
        message: "Como trabajador adolescente, tienes derechos importantes que debes conocer y responsabilidades que debes cumplir.",
        content: (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <h4 className="font-bold text-blue-800 mb-2">✅ Tus Derechos</h4>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li>• Salario mínimo legal</li>
                  <li>• Horarios apropiados para tu edad</li>
                  <li>• Condiciones de trabajo seguras</li>
                  <li>• Pago puntual de tu salario</li>
                  <li>• Descansos según la ley</li>
                </ul>
              </div>
              <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
                <h4 className="font-bold text-orange-800 mb-2">📋 Tus Responsabilidades</h4>
                <ul className="text-sm text-orange-700 space-y-1">
                  <li>• Llegar a tiempo al trabajo</li>
                  <li>• Cumplir con tus tareas asignadas</li>
                  <li>• Seguir las reglas de la empresa</li>
                  <li>• Mantener un buen comportamiento</li>
                  <li>• Comunicar problemas a tu supervisor</li>
                </ul>
              </div>
            </div>
            <div className="bg-red-100 p-4 rounded-lg">
              <p className="text-sm text-red-800">
                <strong>Importante:</strong> Conoce las leyes laborales de tu país. En México, los menores de 16 años tienen restricciones especiales sobre horarios y tipos de trabajo.
              </p>
            </div>
          </div>
        )
      }
    },

    // Step 7: Activity - Rights and responsibilities
    {
      id: 'rights-responsibilities-activity',
      type: 'activity' as const,
      title: '¿Derecho o Responsabilidad?',
      character: lucas,
      points: 30,
      content: {
        type: 'question',
        description: 'Ayuda a Lucas a identificar si algo es un derecho o una responsabilidad laboral',
        question: "Lucas trabaja como cajero en una tienda. Su jefe le pide que trabaje 12 horas seguidas sin descanso. ¿Qué debe hacer Lucas?",
        options: [
          "Aceptar porque necesita el dinero",
          "Negarse y reportar la situación a las autoridades laborales",
          "Trabajar las 12 horas pero quejarse después",
          "Renunciar inmediatamente sin explicación"
        ],
        correct: 1,
        feedback: "¡Correcto! Lucas tiene derecho a descansos y horarios apropiados. Debe negarse respetuosamente y reportar la situación a las autoridades laborales si es necesario."
      }
    },

    // Step 8: Comment after rights activity
    {
      id: 'rights-comment',
      type: 'comment' as const,
      title: '¡Protege Tus Derechos!',
      character: sol,
      content: {
        message: "¡Excelente! Conocer tus derechos te protege de abusos laborales. Ahora vamos a aprender cómo gestionar tus ingresos variables.",
        content: (
          <div className="bg-yellow-100 p-4 rounded-lg">
            <p className="text-sm text-yellow-800">
              <strong>Consejo:</strong> Siempre documenta tus horas trabajadas y mantén copias de tus recibos de pago.
            </p>
          </div>
        )
      }
    },

    // Step 9: Information about variable income management
    {
      id: 'income-management-info',
      type: 'information' as const,
      title: 'Gestión de Ingresos Variables',
      character: maestroDinero,
      content: {
        message: "Los trabajos de medio tiempo suelen tener ingresos variables. Aprender a gestionarlos es clave para tu estabilidad financiera.",
        content: (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-4 bg-green-100 rounded-lg">
                <div className="text-4xl mb-2">💰</div>
                <p className="text-sm font-medium">Presupuesto Base</p>
                <p className="text-xs text-gray-600">Gastar solo lo mínimo necesario</p>
              </div>
              <div className="text-center p-4 bg-blue-100 rounded-lg">
                <div className="text-4xl mb-2">🏦</div>
                <p className="text-sm font-medium">Fondo de Emergencia</p>
                <p className="text-xs text-gray-600">Ahorrar para imprevistos</p>
              </div>
              <div className="text-center p-4 bg-purple-100 rounded-lg">
                <div className="text-4xl mb-2">🎯</div>
                <p className="text-sm font-medium">Metas Específicas</p>
                <p className="text-xs text-gray-600">Universidad, tecnología, etc.</p>
              </div>
            </div>
            <div className="bg-orange-100 p-4 rounded-lg">
              <p className="text-sm text-orange-800">
                <strong>Estrategia 50/30/20:</strong> 50% para necesidades, 30% para deseos, 20% para ahorro e inversión.
              </p>
            </div>
          </div>
        )
      }
    },

    // Step 10: Activity - Income planning
    {
      id: 'income-planning-activity',
      type: 'activity' as const,
      title: 'Planifica Tus Ingresos',
      character: lucas,
      points: 25,
      content: {
        type: 'question',
        description: 'Ayuda a Lucas a crear un plan para gestionar sus ingresos variables',
        question: "Lucas gana $800 por semana como tutor, pero algunas semanas solo trabaja 3 días. ¿Cuál es la mejor estrategia para gestionar sus ingresos variables?",
        options: [
          "Gastar todo lo que gane cada semana",
          "Crear un presupuesto basado en sus ingresos mínimos semanales",
          "Pedir prestado cuando no tenga suficiente dinero",
          "Trabajar más horas cuando necesite dinero"
        ],
        correct: 1,
        feedback: "¡Excelente! Crear un presupuesto basado en ingresos mínimos es la mejor estrategia. Esto te permite vivir dentro de tus posibilidades y ahorrar cuando tengas ingresos extra."
      }
    },

    // Step 11: Final reflection
    {
      id: 'final-reflection',
      type: 'comment' as const,
      title: '¡Trabajo y Finanzas Completadas!',
      character: maestroDinero,
      content: {
        message: "¡Felicitaciones! Has completado tu lección sobre ingresos y trabajos de medio tiempo. Ahora tienes las herramientas para encontrar trabajo y gestionar tus ingresos de manera inteligente.",
        content: (
          <div className="space-y-4">
            <div className="bg-gradient-to-r from-green-100 to-blue-100 p-4 rounded-lg">
              <h3 className="font-bold text-green-800 mb-2">Lo que aprendiste hoy:</h3>
              <ul className="space-y-1 text-sm text-green-700">
                <li>✅ Identificar oportunidades laborales apropiadas para adolescentes</li>
                <li>✅ Conocer tus derechos y responsabilidades laborales</li>
                <li>✅ Gestionar ingresos variables con inteligencia</li>
                <li>✅ Crear un presupuesto que funcione para ti</li>
              </ul>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-600">
                ¡Ahora puedes buscar trabajo con confianza y gestionar tu dinero de manera responsable!
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
        question: "¿Qué tipo de trabajo te gustaría tener y cómo planeas gestionar tus ingresos?",
        message: "Antes de terminar, piensa en tus habilidades y pasiones. ¿Qué trabajo te gustaría tener? ¿Cómo planeas balancear trabajo, estudios y vida personal?",
        rewards: {
          points: 50,
          badges: ["Trabajador Responsable", "Gestor de Ingresos"],
          stickers: ["💼", "💰", "⭐", "🎯"]
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

export default Lesson4_2_IngresosTrabajos;
