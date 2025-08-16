import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  StepBasedLesson,
  characters 
} from './LessonComponents';
import { ChevronRight, ChevronLeft, Home, PiggyBank, TrendingUp, Calculator, Percent, Target } from 'lucide-react';

interface Lesson2_2Props {
  onComplete: (score: number, progress: any) => void;
  onExit: () => void;
}

const Lesson2_2_SavingsAccounts: React.FC<Lesson2_2Props> = ({ onComplete, onExit }) => {
  const lucas = characters.lucas;
  const sol = characters.sol;
  const maestroDinero = characters.maestro_dinero;

  // Step-based lesson structure - each step shows one thing at a time
  const lessonSteps = [
    // Step 1: Hook/Introduction
    {
      id: 'hook',
      type: 'information' as const,
      title: 'El Poder Mágico de los Intereses: La Historia de Ana',
      character: lucas,
      content: {
        message: "¡Hola! Soy Ana, tengo 13 años y tengo una pregunta súper importante. Mi mamá dice que si pongo $100 en una cuenta de ahorros, el banco me dará más dinero solo por guardarlo ahí. ¿Es verdad? ¿Cómo funciona eso?",
        content: (
          <div className="text-center space-y-4">
            <div className="text-6xl">💰📈🎯</div>
            <p className="text-lg font-medium text-gray-700">
              Ana quiere entender cómo crece su dinero
            </p>
            <div className="bg-yellow-100 p-4 rounded-lg">
              <p className="text-sm text-yellow-800">
                <strong>Pregunta:</strong> ¿Cómo puede Ana hacer que su dinero crezca automáticamente?
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
        message: "¡Hola jóvenes inversores! Soy el Maestro Dinero, y hoy vamos a descubrir uno de los secretos más poderosos del mundo financiero: ¡Los Intereses! Es como tener un árbol mágico que hace crecer tu dinero.",
        content: (
          <div className="space-y-4">
            <div className="bg-blue-100 p-4 rounded-lg">
              <h3 className="font-bold text-blue-800 mb-2">¿Qué vamos a aprender hoy?</h3>
              <ul className="space-y-2 text-sm text-blue-700">
                <li>• ¿Qué es una cuenta de ahorro y cómo funciona?</li>
                <li>• ¿Qué son los intereses y cómo te hacen ganar dinero?</li>
                <li>• Cómo calcular el crecimiento de tus ahorros</li>
                <li>• Cómo comparar diferentes opciones de cuentas</li>
                <li>• Ayudar a Ana a entender el poder de los intereses</li>
              </ul>
            </div>
          </div>
        )
      }
    },

    // Step 3: Information about savings accounts
    {
      id: 'savings-account-info',
      type: 'information' as const,
      title: '¿Qué es una Cuenta de Ahorro?',
      character: sol,
      content: {
        message: "¡Hola! Soy Sol y me encanta explicar cosas de manera clara. Una cuenta de ahorro es como una alcancía súper inteligente que no solo guarda tu dinero, sino que también lo hace crecer.",
        content: (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-4 bg-green-100 rounded-lg">
                <div className="text-4xl mb-2">🏦</div>
                <p className="text-sm font-medium">Seguridad</p>
                <p className="text-xs text-gray-600">Dinero protegido</p>
              </div>
              <div className="text-center p-4 bg-blue-100 rounded-lg">
                <div className="text-4xl mb-2">📈</div>
                <p className="text-sm font-medium">Crecimiento</p>
                <p className="text-xs text-gray-600">Intereses automáticos</p>
              </div>
              <div className="text-center p-4 bg-purple-100 rounded-lg">
                <div className="text-4xl mb-2">💳</div>
                <p className="text-sm font-medium">Acceso</p>
                <p className="text-xs text-gray-600">Usar cuando necesites</p>
              </div>
            </div>
            <div className="bg-purple-100 p-4 rounded-lg">
              <p className="text-sm text-purple-800">
                <strong>Una cuenta de ahorro es:</strong> Una cuenta bancaria especial que guarda tu dinero de forma segura y te paga intereses por dejarlo ahí.
              </p>
            </div>
          </div>
        )
      }
    },

    // Step 4: Activity - Savings account recognition
    {
      id: 'savings-account-activity',
      type: 'activity' as const,
      title: '¿Qué es una Cuenta de Ahorro?',
      character: lucas,
      points: 20,
      content: {
        type: 'question',
        description: 'Ayuda a Ana a entender qué es una cuenta de ahorro',
        question: "¿Cuál de estas opciones describe mejor una cuenta de ahorro?",
        options: [
          "Una cuenta bancaria que guarda tu dinero de forma segura y te paga intereses",
          "Una cuenta donde solo puedes gastar dinero",
          "Un lugar donde el banco te presta dinero",
          "Una cuenta que solo los adultos pueden usar"
        ],
        correct: 0,
        feedback: "¡Excelente! Una cuenta de ahorro es exactamente eso: una cuenta bancaria que guarda tu dinero de forma segura y te paga intereses por dejarlo ahí."
      }
    },

    // Step 5: Comment after activity
    {
      id: 'savings-account-comment',
      type: 'comment' as const,
      title: '¡Perfecto!',
      character: sol,
      content: {
        message: "¡Muy bien! Ya entiendes qué es una cuenta de ahorro. Ahora vamos a descubrir el ingrediente mágico: ¡Los Intereses!",
        content: (
          <div className="bg-green-100 p-4 rounded-lg">
            <p className="text-sm text-green-800">
              <strong>Recuerda:</strong> Una cuenta de ahorro es tu aliada para hacer crecer tu dinero de forma segura.
            </p>
          </div>
        )
      }
    },

    // Step 6: Information about interest
    {
      id: 'interest-info',
      type: 'information' as const,
      title: '¿Qué son los Intereses?',
      character: maestroDinero,
      content: {
        message: "Ahora vamos a descubrir el poder mágico de los intereses. Es como tener un pequeño trabajador que trabaja para ti las 24 horas del día.",
        content: (
          <div className="space-y-4">
            <div className="bg-gradient-to-r from-green-50 to-blue-50 p-4 rounded-lg border border-green-200">
              <h3 className="font-bold text-green-800 mb-3">💰 ¿Qué son los Intereses?</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-semibold text-green-700 mb-2">🎁 Regalo del Banco</h4>
                  <ul className="text-sm text-green-600 space-y-1">
                    <li>• El banco te paga por guardar tu dinero</li>
                    <li>• Es como una recompensa por ahorrar</li>
                    <li>• Se calcula como un porcentaje</li>
                    <li>• Se paga regularmente (mensual o anual)</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold text-blue-700 mb-2">📊 Ejemplo Práctico</h4>
                  <ul className="text-sm text-blue-600 space-y-1">
                    <li>• Depositas $100</li>
                    <li>• Tasa de interés: 5% anual</li>
                    <li>• Después de 1 año: $105</li>
                    <li>• Ganaste $5 sin hacer nada</li>
                  </ul>
                </div>
              </div>
            </div>
            <div className="bg-purple-100 p-4 rounded-lg">
              <p className="text-sm text-purple-800">
                <strong>Los intereses son:</strong> El dinero que el banco te paga por dejar tu dinero en una cuenta de ahorro.
              </p>
            </div>
          </div>
        )
      }
    },

    // Step 7: Activity - Interest understanding
    {
      id: 'interest-activity',
      type: 'activity' as const,
      title: 'Entendiendo los Intereses',
      character: lucas,
      points: 25,
      content: {
        type: 'question',
        description: 'Ayuda a Ana a entender qué son los intereses',
        question: "Ana tiene $200 en una cuenta de ahorro con 3% de interés anual. ¿Cuánto dinero tendrá después de un año?",
        options: [
          "$206 (los $200 originales + $6 de intereses)",
          "$200 (el dinero no cambia)",
          "$194 (pierde dinero)",
          "$300 (el banco le da $100 extra)"
        ],
        correct: 0,
        feedback: "¡Exacto! Ana tendrá $206: sus $200 originales más $6 de intereses (3% de $200 = $6). ¡Su dinero creció sin hacer nada!"
      }
    },

    // Step 8: Comment after interest
    {
      id: 'interest-comment',
      type: 'comment' as const,
      title: '¡Excelente Comprensión!',
      character: sol,
      content: {
        message: "¡Perfecto! Ya entiendes cómo funcionan los intereses. Ahora vamos a ver cómo calcular el crecimiento de tus ahorros a lo largo del tiempo.",
        content: (
          <div className="bg-orange-100 p-4 rounded-lg">
            <p className="text-sm text-orange-800">
              <strong>Próximo paso:</strong> Vamos a ver cómo el tiempo hace que tus ahorros crezcan aún más.
            </p>
          </div>
        )
      }
    },

    // Step 9: Information about compound interest
    {
      id: 'compound-interest-info',
      type: 'information' as const,
      title: 'El Poder del Interés Compuesto',
      character: maestroDinero,
      content: {
        message: "Ahora vamos a descubrir el superpoder más increíble de las finanzas: ¡El Interés Compuesto! Es como una bola de nieve que se hace más grande mientras rueda.",
        content: (
          <div className="space-y-4">
            <div className="bg-gradient-to-r from-green-50 to-blue-50 p-4 rounded-lg border border-green-200">
              <h3 className="font-bold text-green-800 mb-3">🎯 Interés Compuesto</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-semibold text-green-700 mb-2">📈 Crecimiento Exponencial</h4>
                  <ul className="text-sm text-green-600 space-y-1">
                    <li>• Los intereses generan más intereses</li>
                    <li>• El crecimiento se acelera con el tiempo</li>
                    <li>• Cuanto más tiempo, más ganancias</li>
                    <li>• Es el secreto de los grandes ahorradores</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold text-blue-700 mb-2">📊 Ejemplo de Ana</h4>
                  <ul className="text-sm text-blue-600 space-y-1">
                    <li>• Año 1: $200 → $206</li>
                    <li>• Año 2: $206 → $212.18</li>
                    <li>• Año 3: $212.18 → $218.55</li>
                    <li>• ¡Cada año gana más!</li>
                  </ul>
                </div>
              </div>
            </div>
            <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
              <h4 className="font-bold text-yellow-800 mb-2">💡 ¿Por Qué es Poderoso?</h4>
              <ul className="text-sm text-yellow-700 space-y-1">
                <li>• <strong>El tiempo es tu aliado:</strong> Cuanto más tiempo, más ganancias</li>
                <li>• <strong>No necesitas hacer nada:</strong> El dinero trabaja por ti</li>
                <li>• <strong>Crecimiento acelerado:</strong> Cada año ganas más que el anterior</li>
                <li>• <strong>Poder de la paciencia:</strong> Los resultados se ven a largo plazo</li>
              </ul>
            </div>
            <div className="bg-purple-100 p-4 rounded-lg">
              <p className="text-sm text-purple-800">
                <strong>El interés compuesto es:</strong> El octavo maravilla del mundo financiero. ¡Hace que tu dinero crezca exponencialmente!
              </p>
            </div>
          </div>
        )
      }
    },

    // Step 10: Activity - Compound interest
    {
      id: 'compound-interest-activity',
      type: 'activity' as const,
      title: 'El Poder del Tiempo',
      character: lucas,
      points: 30,
      content: {
        type: 'question',
        description: 'Ayuda a Ana a entender el poder del interés compuesto',
        question: "Ana puede ahorrar $50 al mes. ¿Cuál es la ventaja de empezar a ahorrar ahora en lugar de esperar 5 años?",
        options: [
          "El interés compuesto hará que su dinero crezca mucho más en 5 años adicionales",
          "No hay diferencia, el dinero crece igual",
          "Es mejor esperar hasta tener más dinero",
          "Los bancos solo aceptan ahorros grandes"
        ],
        correct: 0,
        feedback: "¡Exacto! Empezar ahora significa 5 años más de interés compuesto, lo que hará que su dinero crezca exponencialmente más."
      }
    },

    // Step 11: Comment after compound interest
    {
      id: 'compound-interest-comment',
      type: 'comment' as const,
      title: '¡Buen Trabajo!',
      character: sol,
      content: {
        message: "¡Excelente! Ya entiendes el poder del interés compuesto. Ahora vamos a ver cómo comparar diferentes cuentas de ahorro.",
        content: (
          <div className="bg-blue-100 p-4 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>Vamos a explorar:</strong> Cómo elegir la mejor cuenta de ahorro para Ana.
            </p>
          </div>
        )
      }
    },

    // Step 12: Information about comparing accounts
    {
      id: 'comparing-accounts-info',
      type: 'information' as const,
      title: '¿Cómo Elegir tu Cuenta de Ahorro?',
      character: maestroDinero,
      content: {
        message: "Ahora vamos a ver cómo comparar diferentes cuentas de ahorro para encontrar la mejor opción. Es como comparar diferentes tipos de semillas para tu jardín financiero.",
        content: (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                <h4 className="font-bold text-green-800 mb-2">📊 Factores Importantes</h4>
                <ul className="text-sm text-green-700 space-y-2">
                  <li>• <strong>Tasa de interés:</strong> Porcentaje que te paga el banco</li>
                  <li>• <strong>Comisiones:</strong> Cargos por mantener la cuenta</li>
                  <li>• <strong>Depósito mínimo:</strong> Cantidad mínima requerida</li>
                  <li>• <strong>Acceso al dinero:</strong> Fácil retiro cuando lo necesites</li>
                </ul>
              </div>
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <h4 className="font-bold text-blue-800 mb-2">🎯 Cuentas para Jóvenes</h4>
                <ul className="text-sm text-blue-700 space-y-2">
                  <li>• <strong>Sin comisiones:</strong> No pagas por mantener la cuenta</li>
                  <li>• <strong>Depósitos mínimos bajos:</strong> Puedes empezar con poco</li>
                  <li>• <strong>Apps fáciles:</strong> Manejo desde tu teléfono</li>
                  <li>• <strong>Educación financiera:</strong> Recursos para aprender</li>
                </ul>
              </div>
            </div>
            <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
              <h4 className="font-bold text-yellow-800 mb-2">🔍 Comparación de Ejemplo</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div className="bg-white p-3 rounded">
                  <h5 className="font-semibold text-green-700">Banco A</h5>
                  <p>Interés: 2.5%</p>
                  <p>Comisión: $0</p>
                  <p>Mínimo: $10</p>
                </div>
                <div className="bg-white p-3 rounded">
                  <h5 className="font-semibold text-blue-700">Banco B</h5>
                  <p>Interés: 3.0%</p>
                  <p>Comisión: $5/mes</p>
                  <p>Mínimo: $100</p>
                </div>
                <div className="bg-white p-3 rounded">
                  <h5 className="font-semibold text-purple-700">Banco C</h5>
                  <p>Interés: 1.5%</p>
                  <p>Comisión: $0</p>
                  <p>Mínimo: $5</p>
                </div>
              </div>
            </div>
            <div className="bg-purple-100 p-4 rounded-lg">
              <p className="text-sm text-purple-800">
                <strong>Consejo:</strong> Compara siempre la tasa de interés, las comisiones y los requisitos mínimos para encontrar la mejor opción.
              </p>
            </div>
          </div>
        )
      }
    },

    // Step 13: Activity - Compare accounts
    {
      id: 'compare-accounts-activity',
      type: 'activity' as const,
      title: 'Compara las Cuentas',
      character: lucas,
      points: 25,
      content: {
        type: 'question',
        description: 'Ayuda a Ana a elegir la mejor cuenta de ahorro',
        question: "Ana tiene $50 para empezar. ¿Cuál cuenta sería mejor para ella?",
        options: [
          "Banco A (2.5% interés, sin comisiones, mínimo $10)",
          "Banco B (3.0% interés, $5 comisión mensual, mínimo $100)",
          "Banco C (1.5% interés, sin comisiones, mínimo $5)",
          "Esperar hasta tener más dinero"
        ],
        correct: 0,
        feedback: "¡Excelente elección! Banco A es perfecto para Ana: puede empezar con $50, no paga comisiones, y tiene una buena tasa de interés."
      }
    },

    // Step 14: Comment after comparison
    {
      id: 'comparison-comment',
      type: 'comment' as const,
      title: '¡Buena Elección!',
      character: sol,
      content: {
        message: "¡Perfecto! Ana ya sabe qué cuenta elegir. Ahora vamos a ver cómo calcular exactamente cuánto crecerá su dinero.",
        content: (
          <div className="bg-green-100 p-4 rounded-lg">
            <p className="text-sm text-green-800">
              <strong>Vamos a practicar:</strong> Calcularemos el crecimiento del dinero de Ana paso a paso.
            </p>
          </div>
        )
      }
    },

    // Step 15: Information about Ana's savings calculation
    {
      id: 'ana-savings-calculation-info',
      type: 'information' as const,
      title: 'El Crecimiento del Dinero de Ana',
      character: maestroDinero,
      content: {
        message: "Ahora vamos a calcular exactamente cuánto crecerá el dinero de Ana usando su nueva cuenta de ahorro. Es como ver el futuro de su dinero.",
        content: (
          <div className="space-y-4">
            <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
              <h3 className="font-bold text-yellow-800 mb-3">💰 Plan de Ahorro de Ana</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center p-2 bg-white rounded">
                  <span className="font-medium">Depósito inicial:</span>
                  <span className="text-green-600">$50</span>
                </div>
                <div className="flex justify-between items-center p-2 bg-white rounded">
                  <span className="font-medium">Ahorro mensual:</span>
                  <span className="text-green-600">$30</span>
                </div>
                <div className="flex justify-between items-center p-2 bg-white rounded">
                  <span className="font-medium">Tasa de interés:</span>
                  <span className="text-blue-600">2.5% anual</span>
                </div>
                <div className="flex justify-between items-center p-2 bg-white rounded">
                  <span className="font-medium">Comisiones:</span>
                  <span className="text-green-600">$0</span>
                </div>
              </div>
            </div>
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <h4 className="font-bold text-blue-800 mb-2">📈 Proyección de Crecimiento</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div className="text-center">
                  <h5 className="font-semibold text-blue-700">1 Año</h5>
                  <p className="text-lg font-bold text-green-600">$410</p>
                  <p className="text-xs text-gray-600">+$10 de intereses</p>
                </div>
                <div className="text-center">
                  <h5 className="font-semibold text-blue-700">2 Años</h5>
                  <p className="text-lg font-bold text-green-600">$770</p>
                  <p className="text-xs text-gray-600">+$20 de intereses</p>
                </div>
                <div className="text-center">
                  <h5 className="font-semibold text-blue-700">5 Años</h5>
                  <p className="text-lg font-bold text-green-600">$1,850</p>
                  <p className="text-xs text-gray-600">+$50 de intereses</p>
                </div>
              </div>
            </div>
            <div className="bg-green-100 p-4 rounded-lg">
              <p className="text-sm text-green-800">
                <strong>¡Increíble!</strong> En 5 años, Ana tendrá $1,850, incluyendo $50 de intereses ganados sin hacer nada más que ahorrar.
              </p>
            </div>
          </div>
        )
      }
    },

    // Step 16: Activity - Savings calculation
    {
      id: 'savings-calculation-activity',
      type: 'activity' as const,
      title: 'Calcula el Crecimiento',
      character: lucas,
      points: 35,
      content: {
        type: 'question',
        description: 'Ayuda a Ana a entender el crecimiento de sus ahorros',
        question: "Ana ahorra $30 al mes con 2.5% de interés anual. ¿Cuánto dinero tendrá después de 1 año?",
        options: [
          "$370 (los $360 ahorrados + $10 de intereses)",
          "$360 (solo lo que ahorró)",
          "$400 (el banco le da dinero extra)",
          "$350 (pierde dinero por comisiones)"
        ],
        correct: 0,
        feedback: "¡Exacto! Ana tendrá $370: $360 de sus ahorros mensuales más $10 de intereses. ¡Su dinero creció automáticamente!"
      }
    },

    // Step 17: Comment after calculation
    {
      id: 'calculation-comment',
      type: 'comment' as const,
      title: '¡Análisis Excelente!',
      character: sol,
      content: {
        message: "¡Perfecto! Ana ahora puede ver exactamente cómo crecerá su dinero. Vamos a darle algunos consejos finales para maximizar sus ahorros.",
        content: (
          <div className="bg-blue-100 p-4 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>Próximo paso:</strong> Consejos para maximizar los ahorros de Ana.
            </p>
          </div>
        )
      }
    },

    // Step 18: Information about savings tips
    {
      id: 'savings-tips-info',
      type: 'information' as const,
      title: 'Consejos para Maximizar tus Ahorros',
      character: maestroDinero,
      content: {
        message: "Ahora te voy a dar algunos consejos súper útiles para hacer que tus ahorros crezcan aún más rápido.",
        content: (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <h4 className="font-bold text-blue-800 mb-2">💡 Estrategias Principales</h4>
                <ul className="text-sm text-blue-700 space-y-2">
                  <li>• <strong>Ahorra regularmente:</strong> Pequeñas cantidades constantes</li>
                  <li>• <strong>Empieza temprano:</strong> El tiempo es tu mejor aliado</li>
                  <li>• <strong>Busca las mejores tasas:</strong> Compara diferentes bancos</li>
                  <li>• <strong>Evita comisiones:</strong> Elige cuentas sin cargos</li>
                </ul>
              </div>
              <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                <h4 className="font-bold text-green-800 mb-2">🚀 Estrategias Avanzadas</h4>
                <ul className="text-sm text-green-700 space-y-2">
                  <li>• <strong>Ahorro automático:</strong> Configura transferencias automáticas</li>
                  <li>• <strong>Metas específicas:</strong> Define objetivos claros</li>
                  <li>• <strong>Revisa regularmente:</strong> Monitorea tu progreso</li>
                  <li>• <strong>Reinvierte intereses:</strong> Déjalos en la cuenta</li>
                </ul>
              </div>
            </div>
            <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
              <h4 className="font-bold text-yellow-800 mb-2">🎯 Hábitos Exitosos</h4>
              <ul className="text-sm text-yellow-700 space-y-1">
                <li>• <strong>Regla del 10%:</strong> Ahorra al menos 10% de tus ingresos</li>
                <li>• <strong>Paga primero:</strong> Ahorra antes de gastar</li>
                <li>• <strong>Celebra el progreso:</strong> Recompénsate por alcanzar metas</li>
                <li>• <strong>Educación continua:</strong> Aprende sobre finanzas</li>
              </ul>
            </div>
            <div className="bg-purple-100 p-4 rounded-lg">
              <p className="text-sm text-purple-800">
                <strong>Recuerda:</strong> Los pequeños ahorros regulares se convierten en grandes sumas con el tiempo y el interés compuesto.
              </p>
            </div>
          </div>
        )
      }
    },

    // Step 19: Final activity - Savings strategy
    {
      id: 'final-savings-activity',
      type: 'activity' as const,
      title: 'Crea tu Estrategia de Ahorro',
      character: lucas,
      points: 40,
      content: {
        type: 'question',
        description: 'Ayuda a Ana a crear su estrategia de ahorro',
        question: "Ana quiere maximizar sus ahorros. ¿Cuál es la mejor estrategia para ella?",
        options: [
          "Ahorrar $30 al mes automáticamente y dejar los intereses en la cuenta para que crezcan",
          "Ahorrar solo cuando tenga dinero extra",
          "Retirar los intereses cada mes para gastarlos",
          "Esperar hasta tener un trabajo para empezar a ahorrar"
        ],
        correct: 0,
        feedback: "¡Perfecto! Ahorrar regularmente y dejar los intereses en la cuenta es la mejor estrategia. El interés compuesto hará que su dinero crezca exponencialmente."
      }
    },

    // Step 20: Final reflection
    {
      id: 'final-reflection',
      type: 'comment' as const,
      title: '¡Lección Completada!',
      character: maestroDinero,
      content: {
        message: "¡Felicitaciones! Has completado tu lección sobre cuentas de ahorro. Ahora entiendes el poder mágico de los intereses y cómo hacer crecer tu dinero.",
        content: (
          <div className="space-y-4">
            <div className="bg-gradient-to-r from-green-100 to-blue-100 p-4 rounded-lg">
              <h3 className="font-bold text-green-800 mb-2">Lo que aprendiste hoy:</h3>
              <ul className="space-y-1 text-sm text-green-700">
                <li>✅ Qué es una cuenta de ahorro y cómo funciona</li>
                <li>✅ Qué son los intereses y cómo te hacen ganar dinero</li>
                <li>✅ El poder mágico del interés compuesto</li>
                <li>✅ Cómo comparar diferentes cuentas de ahorro</li>
                <li>✅ Cómo calcular el crecimiento de tus ahorros</li>
                <li>✅ Estrategias para maximizar tus ahorros</li>
                <li>✅ Ayudar a Ana a entender el poder de los intereses</li>
              </ul>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-600">
                ¡Ahora puedes hacer que tu dinero trabaje para ti y crezca automáticamente!
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
        question: "¿Qué fue lo más sorprendente que aprendiste sobre las cuentas de ahorro hoy?",
        message: "Antes de terminar, tómate un momento para pensar en lo que aprendiste. ¿Qué te pareció más sorprendente o útil sobre las cuentas de ahorro y los intereses?",
        rewards: {
          points: 50,
          badges: ["Maestro del Ahorro", "Ayudante de Ana"],
          stickers: ["💰", "📈", "🎯", "⭐"]
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

export default Lesson2_2_SavingsAccounts;
