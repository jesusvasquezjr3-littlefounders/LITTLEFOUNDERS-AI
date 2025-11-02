import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  StepBasedLesson,
  characters 
} from './LessonComponents';
import { ChevronRight, ChevronLeft, Home, Calculator, TrendingUp, DollarSign, ShoppingCart, PiggyBank, BarChart3 } from 'lucide-react';

interface Lesson1_2Props {
  onComplete: (score: number, progress: any) => void;
  onExit: () => void;
}

const Lesson1_2_ExpenseTracking: React.FC<Lesson1_2Props> = ({ onComplete, onExit }) => {
  const lucas = characters.lucas;
  const sol = characters.sol;
  const maestroDinero = characters.maestro_dinero;

  // Step-based lesson structure - each step shows one thing at a time
  const lessonSteps = [
    // Step 1: Hook/Introduction
    {
      id: 'hook',
      type: 'information' as const,
      title: 'El Misterio del Dinero Desaparecido',
      character: lucas,
      content: {
        message: "¡Hola! Soy María, tengo 13 años y tengo un problema. Recibí mi mesada de $300 hace una semana, pero ahora solo me quedan $50. ¡No sé en qué gasté $250! ¿Me puedes ayudar a descubrir dónde se fue mi dinero?",
        content: (
          <div className="text-center space-y-4">
            <div className="text-6xl">🔍💰❓</div>
            <p className="text-lg font-medium text-gray-700">
              María perdió $250 y no sabe dónde
            </p>
            <div className="bg-yellow-100 p-4 rounded-lg">
              <p className="text-sm text-yellow-800">
                <strong>Problema:</strong> María no lleva un registro de sus gastos y no sabe en qué se fue su dinero
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
        message: "¡Hola detectives financieros! Soy el Maestro Dinero, y hoy vamos a aprender una habilidad súper importante: ¡El Seguimiento de Gastos! Esto te ayudará a nunca más perder el rastro de tu dinero.",
        content: (
          <div className="space-y-4">
            <div className="bg-blue-100 p-4 rounded-lg">
              <h3 className="font-bold text-blue-800 mb-2">¿Qué vamos a aprender hoy?</h3>
              <ul className="space-y-2 text-sm text-blue-700">
                <li>• ¿Por qué es importante registrar tus gastos?</li>
                <li>• Cómo categorizar y registrar cada gasto</li>
                <li>• Herramientas para el seguimiento de gastos</li>
                <li>• Analizar patrones de gasto</li>
                <li>• Ayudar a María a resolver el misterio de su dinero</li>
              </ul>
            </div>
          </div>
        )
      }
    },

    // Step 3: Information about expense tracking
    {
      id: 'expense-tracking-info',
      type: 'information' as const,
      title: '¿Qué es el Seguimiento de Gastos?',
      character: sol,
      content: {
        message: "¡Hola! Soy Sol y me encanta organizar todo. El seguimiento de gastos es como ser un detective de tu propio dinero. Te voy a explicar qué es y por qué es tan útil.",
        content: (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-4 bg-green-100 rounded-lg">
                <div className="text-4xl mb-2">📝</div>
                <p className="text-sm font-medium">Registrar</p>
                <p className="text-xs text-gray-600">Anotar cada gasto</p>
              </div>
              <div className="text-center p-4 bg-blue-100 rounded-lg">
                <div className="text-4xl mb-2">🏷️</div>
                <p className="text-sm font-medium">Categorizar</p>
                <p className="text-xs text-gray-600">Clasificar gastos</p>
              </div>
              <div className="text-center p-4 bg-purple-100 rounded-lg">
                <div className="text-4xl mb-2">📊</div>
                <p className="text-sm font-medium">Analizar</p>
                <p className="text-xs text-gray-600">Ver patrones</p>
              </div>
            </div>
            <div className="bg-purple-100 p-4 rounded-lg">
              <p className="text-sm text-purple-800">
                <strong>El seguimiento de gastos es:</strong> Registrar cada vez que gastas dinero, categorizarlo y analizar tus patrones de gasto para tomar mejores decisiones.
              </p>
            </div>
          </div>
        )
      }
    },

    // Step 4: Activity - Expense tracking recognition
    {
      id: 'expense-tracking-activity',
      type: 'activity' as const,
      title: '¿Qué es el Seguimiento de Gastos?',
      character: lucas,
      points: 20,
      content: {
        type: 'question',
        description: 'Ayuda a María a entender qué es el seguimiento de gastos',
        question: "¿Cuál de estas opciones describe mejor el seguimiento de gastos?",
        options: [
          "Registrar y categorizar cada gasto para entender en qué se va tu dinero",
          "Gastar todo tu dinero sin pensar",
          "Solo anotar los gastos grandes",
          "Olvidarse de los gastos pequeños"
        ],
        correct: 0,
        feedback: "¡Excelente! El seguimiento de gastos es registrar y categorizar cada gasto para entender exactamente en qué se va tu dinero."
      }
    },

    // Step 5: Comment after activity
    {
      id: 'expense-tracking-comment',
      type: 'comment' as const,
      title: '¡Perfecto!',
      character: sol,
      content: {
        message: "¡Muy bien! Ya entiendes qué es el seguimiento de gastos. Ahora vamos a ver por qué es tan importante hacerlo.",
        content: (
          <div className="bg-green-100 p-4 rounded-lg">
            <p className="text-sm text-green-800">
              <strong>Recuerda:</strong> El seguimiento de gastos te da control total sobre tu dinero y te ayuda a tomar decisiones más inteligentes.
            </p>
          </div>
        )
      }
    },

    // Step 6: Information about why track expenses
    {
      id: 'why-track-expenses-info',
      type: 'information' as const,
      title: '¿Por Qué Registrar tus Gastos?',
      character: maestroDinero,
      content: {
        message: "Ahora vamos a ver todas las ventajas que tiene registrar tus gastos. ¡Te vas a sorprender de lo poderoso que es!",
        content: (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                <h4 className="font-bold text-green-800 mb-2">✅ Beneficios</h4>
                <ul className="text-sm text-green-700 space-y-1">
                  <li>• Sabes exactamente en qué gastas</li>
                  <li>• Identificas gastos innecesarios</li>
                  <li>• Encuentras oportunidades de ahorro</li>
                  <li>• Tomas decisiones más informadas</li>
                  <li>• Evitas sorpresas desagradables</li>
                  <li>• Alcanzas tus metas financieras</li>
                </ul>
              </div>
              <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                <h4 className="font-bold text-red-800 mb-2">❌ Sin Seguimiento</h4>
                <ul className="text-sm text-red-700 space-y-1">
                  <li>• No sabes dónde va tu dinero</li>
                  <li>• Gastos sorpresa constantes</li>
                  <li>• Difícil alcanzar metas</li>
                  <li>• Decisiones basadas en suposiciones</li>
                  <li>• Estrés financiero</li>
                  <li>• Pérdida de control</li>
                </ul>
              </div>
            </div>
            <div className="bg-blue-100 p-4 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>El seguimiento es tu radar financiero:</strong> Te muestra exactamente dónde está tu dinero y te ayuda a navegar hacia tus metas.
              </p>
            </div>
          </div>
        )
      }
    },

    // Step 7: Activity - Why track expenses
    {
      id: 'why-track-expenses-activity',
      type: 'activity' as const,
      title: 'Beneficios del Seguimiento',
      character: lucas,
      points: 25,
      content: {
        type: 'question',
        description: 'Ayuda a María a identificar los beneficios de registrar gastos',
        question: "¿Cuál es el beneficio más importante de registrar tus gastos?",
        options: [
          "Saber exactamente en qué gastas tu dinero y tomar decisiones informadas",
          "Gastar más dinero sin preocuparte",
          "No tener que pensar en el dinero",
          "Comprar cosas más caras"
        ],
        correct: 0,
        feedback: "¡Exacto! Saber exactamente en qué gastas te permite tomar decisiones informadas y controlar tu dinero."
      }
    },

    // Step 8: Comment after benefits
    {
      id: 'benefits-comment',
      type: 'comment' as const,
      title: '¡Excelente Comprensión!',
      character: sol,
      content: {
        message: "¡Perfecto! Ya entiendes los beneficios. Ahora vamos a aprender cómo registrar y categorizar gastos paso a paso.",
        content: (
          <div className="bg-orange-100 p-4 rounded-lg">
            <p className="text-sm text-orange-800">
              <strong>Próximo paso:</strong> Vamos a crear un sistema de seguimiento para María.
            </p>
          </div>
        )
      }
    },

    // Step 9: Information about expense categories
    {
      id: 'expense-categories-info',
      type: 'information' as const,
      title: 'Categorías de Gastos',
      character: maestroDinero,
      content: {
        message: "Ahora vamos a aprender cómo categorizar tus gastos. Es como organizar tu ropa en el clóset, pero con tu dinero.",
        content: (
          <div className="space-y-4">
            <div className="bg-gradient-to-r from-green-50 to-blue-50 p-4 rounded-lg border border-green-200">
              <h3 className="font-bold text-green-800 mb-3">📂 Categorías Principales</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-semibold text-green-700 mb-2">🍕 Necesidades Básicas</h4>
                  <ul className="text-sm text-green-600 space-y-1">
                    <li>• Comida y snacks</li>
                    <li>• Transporte</li>
                    <li>• Material escolar</li>
                    <li>• Ropa esencial</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold text-blue-700 mb-2">🎮 Entretenimiento</h4>
                  <ul className="text-sm text-blue-600 space-y-1">
                    <li>• Videojuegos</li>
                    <li>• Cine y salidas</li>
                    <li>• Apps y suscripciones</li>
                    <li>• Hobbies</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold text-purple-700 mb-2">💅 Personales</h4>
                  <ul className="text-sm text-purple-600 space-y-1">
                    <li>• Ropa y accesorios</li>
                    <li>• Productos de belleza</li>
                    <li>• Regalos</li>
                    <li>• Tratamientos</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold text-orange-700 mb-2">💰 Ahorro</h4>
                  <ul className="text-sm text-orange-600 space-y-1">
                    <li>• Metas de ahorro</li>
                    <li>• Fondo de emergencia</li>
                    <li>• Inversiones</li>
                    <li>• Futuro</li>
                  </ul>
                </div>
              </div>
            </div>
            <div className="bg-purple-100 p-4 rounded-lg">
              <p className="text-sm text-purple-800">
                <strong>Consejo:</strong> Puedes crear categorías personalizadas según tus necesidades y preferencias.
              </p>
            </div>
          </div>
        )
      }
    },

    // Step 10: Activity - Categorize expenses
    {
      id: 'categorize-expenses-activity',
      type: 'activity' as const,
      title: 'Categoriza los Gastos',
      character: lucas,
      points: 30,
      content: {
        type: 'question',
        description: 'Ayuda a María a categorizar diferentes tipos de gastos',
        question: "María compró un nuevo par de zapatos deportivos. ¿En qué categoría debería clasificar este gasto?",
        options: [
          "Personales (ropa y accesorios)",
          "Necesidades básicas (transporte)",
          "Entretenimiento (hobbies)",
          "Ahorro (inversión)"
        ],
        correct: 0,
        feedback: "¡Correcto! Los zapatos deportivos van en la categoría de Personales, específicamente en ropa y accesorios."
      }
    },

    // Step 11: Comment after categorization
    {
      id: 'categorization-comment',
      type: 'comment' as const,
      title: '¡Buen Trabajo Categorizando!',
      character: sol,
      content: {
        message: "¡Excelente! Ya sabes cómo categorizar gastos. Ahora vamos a ver las herramientas para registrar tus gastos.",
        content: (
          <div className="bg-blue-100 p-4 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>Vamos a explorar:</strong> Las diferentes herramientas para el seguimiento de gastos.
            </p>
          </div>
        )
      }
    },

    // Step 12: Information about tracking tools
    {
      id: 'tracking-tools-info',
      type: 'information' as const,
      title: 'Herramientas para el Seguimiento',
      character: maestroDinero,
      content: {
        message: "Ahora vamos a ver las diferentes herramientas que puedes usar para registrar tus gastos. Hay opciones para todos los gustos.",
        content: (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <h4 className="font-bold text-blue-800 mb-2">📱 Aplicaciones Digitales</h4>
                <ul className="text-sm text-blue-700 space-y-2">
                  <li>• <strong>Mint:</strong> Seguimiento automático y categorización</li>
                  <li>• <strong>YNAB:</strong> Presupuesto basado en cero</li>
                  <li>• <strong>PocketGuard:</strong> Enfoque en ahorro</li>
                  <li>• <strong>Spendee:</strong> Interfaz amigable para jóvenes</li>
                </ul>
              </div>
              <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                <h4 className="font-bold text-green-800 mb-2">📝 Métodos Tradicionales</h4>
                <ul className="text-sm text-green-700 space-y-2">
                  <li>• <strong>Libreta:</strong> Anotar manualmente cada gasto</li>
                  <li>• <strong>Hoja de cálculo:</strong> Excel o Google Sheets</li>
                  <li>• <strong>Envelopes físicos:</strong> Dividir dinero en categorías</li>
                  <li>• <strong>App de notas:</strong> Notas rápidas en el teléfono</li>
                </ul>
              </div>
            </div>
            <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
              <h4 className="font-bold text-yellow-800 mb-2">🎯 Consejos para Empezar</h4>
              <ul className="text-sm text-yellow-700 space-y-1">
                <li>• <strong>Empieza simple:</strong> No te compliques al principio</li>
                <li>• <strong>Se consistente:</strong> Registra cada gasto inmediatamente</li>
                <li>• <strong>Revisa semanalmente:</strong> Analiza tus patrones</li>
                <li>• <strong>Usa recordatorios:</strong> Configura alertas en tu teléfono</li>
              </ul>
            </div>
            <div className="bg-purple-100 p-4 rounded-lg">
              <p className="text-sm text-purple-800">
                <strong>Recuerda:</strong> La mejor herramienta es la que realmente vas a usar. ¡Prueba diferentes opciones!
              </p>
            </div>
          </div>
        )
      }
    },

    // Step 13: Activity - Choose tracking tool
    {
      id: 'choose-tool-activity',
      type: 'activity' as const,
      title: 'Elige tu Herramienta',
      character: lucas,
      points: 25,
      content: {
        type: 'question',
        description: 'Ayuda a María a elegir la mejor herramienta para registrar gastos',
        question: "María quiere empezar a registrar sus gastos. ¿Cuál sería la mejor opción para principiantes?",
        options: [
          "Una aplicación simple como Spendee o empezar con una libreta",
          "Una aplicación compleja con muchas funciones",
          "No registrar nada y confiar en la memoria",
          "Solo registrar gastos grandes"
        ],
        correct: 0,
        feedback: "¡Excelente elección! Para principiantes, es mejor empezar con algo simple y fácil de usar."
      }
    },

    // Step 14: Comment after tool selection
    {
      id: 'tool-selection-comment',
      type: 'comment' as const,
      title: '¡Buena Elección!',
      character: sol,
      content: {
        message: "¡Perfecto! María tiene una herramienta para registrar gastos. Ahora vamos a resolver el misterio de sus $250 desaparecidos.",
        content: (
          <div className="bg-green-100 p-4 rounded-lg">
            <p className="text-sm text-green-800">
              <strong>Vamos a investigar:</strong> Revisaremos los gastos de María para encontrar el dinero perdido.
            </p>
          </div>
        )
      }
    },

    // Step 15: Information about María's expenses
    {
      id: 'maria-expenses-info',
      type: 'information' as const,
      title: 'El Caso de los $250 Desaparecidos',
      character: maestroDinero,
      content: {
        message: "Ahora vamos a investigar el caso de María. Vamos a revisar sus gastos de la semana para encontrar dónde se fueron sus $250.",
        content: (
          <div className="space-y-4">
            <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
              <h3 className="font-bold text-yellow-800 mb-3">🔍 Gastos de María - Semana Pasada</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center p-2 bg-white rounded">
                  <span className="font-medium">Lunes - Almuerzo con amigos:</span>
                  <span className="text-red-600">$45</span>
                </div>
                <div className="flex justify-between items-center p-2 bg-white rounded">
                  <span className="font-medium">Martes - Videojuego nuevo:</span>
                  <span className="text-red-600">$80</span>
                </div>
                <div className="flex justify-between items-center p-2 bg-white rounded">
                  <span className="font-medium">Miércoles - Snacks en la escuela:</span>
                  <span className="text-red-600">$15</span>
                </div>
                <div className="flex justify-between items-center p-2 bg-white rounded">
                  <span className="font-medium">Jueves - Ropa nueva:</span>
                  <span className="text-red-600">$60</span>
                </div>
                <div className="flex justify-between items-center p-2 bg-white rounded">
                  <span className="font-medium">Viernes - Cine con amigos:</span>
                  <span className="text-red-600">$50</span>
                </div>
                <div className="border-t pt-2">
                  <div className="flex justify-between items-center font-bold">
                    <span>Total gastos:</span>
                    <span className="text-red-600">$250</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-green-100 p-4 rounded-lg">
              <p className="text-sm text-green-800">
                <strong>¡Misterio resuelto!</strong> María gastó $250 en entretenimiento, comida y ropa. Ahora puede ver exactamente en qué se fue su dinero.
              </p>
            </div>
          </div>
        )
      }
    },

    // Step 16: Activity - Analyze expenses
    {
      id: 'analyze-expenses-activity',
      type: 'activity' as const,
      title: 'Analiza los Gastos de María',
      character: lucas,
      points: 35,
      content: {
        type: 'question',
        description: 'Ayuda a María a analizar sus patrones de gasto',
        question: "Mirando los gastos de María, ¿en qué categoría gastó más dinero?",
        options: [
          "Entretenimiento (videojuego $80 + cine $50 = $130)",
          "Comida (almuerzo $45 + snacks $15 = $60)",
          "Ropa ($60)",
          "Ahorro ($0)"
        ],
        correct: 0,
        feedback: "¡Exacto! María gastó $130 en entretenimiento (videojuego + cine), que es más de la mitad de su dinero. Esto le muestra que puede reducir gastos en esta categoría."
      }
    },

    // Step 17: Comment after analysis
    {
      id: 'analysis-comment',
      type: 'comment' as const,
      title: '¡Análisis Excelente!',
      character: sol,
      content: {
        message: "¡Perfecto! Ahora María puede ver exactamente en qué gastó su dinero. Esto le ayudará a tomar mejores decisiones en el futuro.",
        content: (
          <div className="bg-blue-100 p-4 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>Lección aprendida:</strong> El seguimiento de gastos te da el poder de ver y controlar tu dinero.
            </p>
          </div>
        )
      }
    },

    // Step 18: Information about expense tracking tips
    {
      id: 'tracking-tips-info',
      type: 'information' as const,
      title: 'Consejos para el Seguimiento de Gastos',
      character: maestroDinero,
      content: {
        message: "Ahora te voy a dar algunos consejos súper útiles para mantener un seguimiento efectivo de tus gastos.",
        content: (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <h4 className="font-bold text-blue-800 mb-2">💡 Consejos Principales</h4>
                <ul className="text-sm text-blue-700 space-y-2">
                  <li>• <strong>Registra inmediatamente:</strong> No dejes para después</li>
                  <li>• <strong>Se específico:</strong> Anota detalles de cada gasto</li>
                  <li>• <strong>Revisa regularmente:</strong> Analiza tus patrones semanalmente</li>
                  <li>• <strong>No te juzgues:</strong> El objetivo es aprender, no castigarte</li>
                </ul>
              </div>
              <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                <h4 className="font-bold text-green-800 mb-2">🚀 Estrategias Avanzadas</h4>
                <ul className="text-sm text-green-700 space-y-2">
                  <li>• <strong>Fotos de recibos:</strong> Guarda evidencia de tus gastos</li>
                  <li>• <strong>Metas de categoría:</strong> Establece límites por categoría</li>
                  <li>• <strong>Alertas de presupuesto:</strong> Configura notificaciones</li>
                  <li>• <strong>Análisis mensual:</strong> Revisa tendencias a largo plazo</li>
                </ul>
              </div>
            </div>
            <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
              <h4 className="font-bold text-yellow-800 mb-2">🎯 Hábitos Exitosos</h4>
              <ul className="text-sm text-yellow-700 space-y-1">
                <li>• <strong>Hazlo un hábito:</strong> Registra gastos como lavarte los dientes</li>
                <li>• <strong>Usa recordatorios:</strong> Configura alertas en tu teléfono</li>
                <li>• <strong>Celebra el progreso:</strong> Recompénsate por mantener el hábito</li>
                <li>• <strong>Comparte con amigos:</strong> Motívate mutuamente</li>
              </ul>
            </div>
            <div className="bg-purple-100 p-4 rounded-lg">
              <p className="text-sm text-purple-800">
                <strong>Recuerda:</strong> El seguimiento de gastos es un hábito que se construye con el tiempo. ¡Sé paciente contigo mismo!
              </p>
            </div>
          </div>
        )
      }
    },

    // Step 19: Final activity - Create tracking system
    {
      id: 'final-tracking-activity',
      type: 'activity' as const,
      title: 'Crea tu Sistema de Seguimiento',
      character: lucas,
      points: 40,
      content: {
        type: 'question',
        description: 'Ayuda a María a crear su sistema de seguimiento de gastos',
        question: "María quiere empezar a registrar sus gastos. ¿Cuál sería el primer paso más importante?",
        options: [
          "Elegir una herramienta (app o libreta) y empezar a registrar cada gasto inmediatamente",
          "Comprar una aplicación cara y complicada",
          "Esperar hasta el final del mes para registrar todo",
          "Solo registrar gastos grandes y olvidar los pequeños"
        ],
        correct: 0,
        feedback: "¡Perfecto! El primer paso es elegir una herramienta simple y empezar a registrar cada gasto inmediatamente. La consistencia es clave."
      }
    },

    // Step 20: Final reflection
    {
      id: 'final-reflection',
      type: 'comment' as const,
      title: '¡Lección Completada!',
      character: maestroDinero,
      content: {
        message: "¡Felicitaciones! Has completado tu lección sobre seguimiento de gastos. Ahora tienes el poder de nunca más perder el rastro de tu dinero.",
        content: (
          <div className="space-y-4">
            <div className="bg-gradient-to-r from-green-100 to-blue-100 p-4 rounded-lg">
              <h3 className="font-bold text-green-800 mb-2">Lo que aprendiste hoy:</h3>
              <ul className="space-y-1 text-sm text-green-700">
                <li>✅ Qué es el seguimiento de gastos y por qué es importante</li>
                <li>✅ Cómo categorizar diferentes tipos de gastos</li>
                <li>✅ Herramientas digitales y tradicionales para el seguimiento</li>
                <li>✅ Cómo analizar patrones de gasto</li>
                <li>✅ Consejos prácticos para mantener el hábito</li>
                <li>✅ Ayudar a María a resolver el misterio de sus $250</li>
              </ul>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-600">
                ¡Ahora puedes crear tu propio sistema de seguimiento y nunca más perder el rastro de tu dinero!
              </p>
            </div>
          </div>
        )
      }
    },

    // Step 21: Reflection moment
    {
      id: 'reflection-moment',
      type: 'reflection' as const,
      title: 'Momento de Reflexión',
      character: maestroDinero,
      content: {
        question: "¿Qué fue lo más sorprendente que aprendiste sobre el seguimiento de gastos hoy?",
        message: "Antes de terminar, tómate un momento para pensar en lo que aprendiste. ¿Qué te pareció más sorprendente o útil sobre el seguimiento de gastos?",
        rewards: {
          points: 50,
          badges: ["Detective Financiero", "Ayudante de María"],
          stickers: ["🔍", "📊", "💰", "⭐"]
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

export default Lesson1_2_ExpenseTracking;
