import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  StepBasedLesson,
  characters 
} from './LessonComponents';
import { ChevronRight, ChevronLeft, Home, Percent, ShoppingCart, AlertTriangle, Calculator, TrendingDown } from 'lucide-react';

interface Lesson3_2Props {
  onComplete: (score: number, progress: any) => void;
  onExit: () => void;
}

const Lesson3_2_OffersAndDiscounts: React.FC<Lesson3_2Props> = ({ onComplete, onExit }) => {
  const lucas = characters.lucas;
  const sol = characters.sol;
  const maestroDinero = characters.maestro_dinero;

  // Step-based lesson structure - each step shows one thing at a time
  const lessonSteps = [
    // Step 1: Hook/Introduction
    {
      id: 'hook',
      type: 'information' as const,
      title: 'El Desafío de Elena: ¿Es Realmente una Oferta?',
      character: lucas,
      content: {
        message: "¡Hola! Soy Elena, tengo 13 años y tengo una pregunta importante. Veo ofertas por todas partes: '50% de descuento', '2x1', 'Liquidación'. ¿Cómo sé si realmente estoy ahorrando dinero o si me están engañando?",
        content: (
          <div className="text-center space-y-4">
            <div className="text-6xl">🏷️💰🤔</div>
            <p className="text-lg font-medium text-gray-700">
               Elena quiere saber si las ofertas son reales
            </p>
            <div className="bg-yellow-100 p-4 rounded-lg">
              <p className="text-sm text-yellow-800">
                <strong>Problema:</strong> Elena no sabe cómo distinguir ofertas reales de falsas
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
        message: "¡Hola cazadores de ofertas! Soy el Maestro Dinero, y hoy vamos a convertirte en un detective de descuentos. Aprenderás a calcular descuentos, distinguir ofertas reales y maximizar el valor de tu dinero.",
        content: (
          <div className="space-y-4">
            <div className="bg-blue-100 p-4 rounded-lg">
              <h3 className="font-bold text-blue-800 mb-2">¿Qué vamos a aprender hoy?</h3>
              <ul className="space-y-2 text-sm text-blue-700">
                <li>• ¿Cómo calcular porcentajes de descuento?</li>
                <li>• Cómo distinguir ofertas reales de falsas</li>
                <li>• Estrategias para aprovechar promociones</li>
                <li>• Cómo planificar compras con ofertas</li>
                <li>• Ayudar a Elena a tomar decisiones inteligentes</li>
              </ul>
            </div>
          </div>
        )
      }
    },

    // Step 3: Information about discounts
    {
      id: 'discounts-info',
      type: 'information' as const,
      title: '¿Qué son los Descuentos?',
      character: sol,
      content: {
        message: "¡Hola! Soy Sol y me encanta explicar cosas de manera clara. Los descuentos son como regalos que te hace la tienda para que compres sus productos.",
        content: (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-4 bg-green-100 rounded-lg">
                <div className="text-4xl mb-2">🏷️</div>
                <p className="text-sm font-medium">Descuento</p>
                <p className="text-xs text-gray-600">Reducción del precio</p>
              </div>
              <div className="text-center p-4 bg-blue-100 rounded-lg">
                <div className="text-4xl mb-2">💰</div>
                <p className="text-sm font-medium">Ahorro</p>
                <p className="text-xs text-gray-600">Dinero que no gastas</p>
              </div>
              <div className="text-center p-4 bg-purple-100 rounded-lg">
                <div className="text-4xl mb-2">🎯</div>
                <p className="text-sm font-medium">Oportunidad</p>
                <p className="text-xs text-gray-600">Momento para comprar</p>
              </div>
            </div>
            <div className="bg-purple-100 p-4 rounded-lg">
              <p className="text-sm text-purple-800">
                <strong>Un descuento es:</strong> Una reducción del precio original de un producto que te permite ahorrar dinero.
              </p>
            </div>
          </div>
        )
      }
    },

    // Step 4: Activity - Discount understanding
    {
      id: 'discount-activity',
      type: 'activity' as const,
      title: '¿Qué son los Descuentos?',
      character: lucas,
      points: 20,
      content: {
        type: 'question',
        description: 'Ayuda a Elena a entender qué son los descuentos',
        question: "¿Cuál de estas opciones describe mejor qué es un descuento?",
        options: [
          "Una reducción del precio original que te permite ahorrar dinero",
          "Un aumento del precio para ganar más dinero",
          "Un cambio en el color del producto",
          "Un regalo adicional sin costo"
        ],
        correct: 0,
        feedback: "¡Excelente! Un descuento es exactamente eso: una reducción del precio original que te permite ahorrar dinero."
      }
    },

    // Step 5: Comment after discount
    {
      id: 'discount-comment',
      type: 'comment' as const,
      title: '¡Perfecto!',
      character: sol,
      content: {
        message: "¡Muy bien! Ya entiendes qué son los descuentos. Ahora vamos a aprender cómo calcularlos.",
        content: (
          <div className="bg-green-100 p-4 rounded-lg">
            <p className="text-sm text-green-800">
              <strong>Recuerda:</strong> Los descuentos son oportunidades para ahorrar dinero.
            </p>
          </div>
        )
      }
    },

    // Step 6: Information about calculating discounts
    {
      id: 'calculating-discounts-info',
      type: 'information' as const,
      title: '¿Cómo Calcular Descuentos?',
      character: maestroDinero,
      content: {
        message: "Ahora vamos a aprender a calcular descuentos. Es como ser un matemático que descubre cuánto dinero puedes ahorrar.",
        content: (
          <div className="space-y-4">
            <div className="bg-gradient-to-r from-green-50 to-blue-50 p-4 rounded-lg border border-green-200">
              <h3 className="font-bold text-green-800 mb-3">🧮 Cálculo de Descuentos</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-semibold text-green-700 mb-2">📊 Fórmula Básica</h4>
                  <ul className="text-sm text-green-600 space-y-1">
                    <li>• Descuento = Precio Original × % Descuento</li>
                    <li>• Precio Final = Precio Original - Descuento</li>
                    <li>• Ahorro = Precio Original - Precio Final</li>
                    <li>• % Ahorro = (Descuento ÷ Precio Original) × 100</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold text-blue-700 mb-2">📝 Ejemplo Práctico</h4>
                  <ul className="text-sm text-blue-600 space-y-1">
                    <li>• Producto: $100</li>
                    <li>• Descuento: 25%</li>
                    <li>• Descuento: $100 × 0.25 = $25</li>
                    <li>• Precio Final: $100 - $25 = $75</li>
                    <li>• Ahorro: $25</li>
                  </ul>
                </div>
              </div>
            </div>
            <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
              <h4 className="font-bold text-yellow-800 mb-2">💡 Consejos de Cálculo</h4>
              <ul className="text-sm text-yellow-700 space-y-1">
                <li>• <strong>Convierte el porcentaje:</strong> 25% = 0.25</li>
                <li>• <strong>Usa tu calculadora:</strong> No te avergüences de usarla</li>
                <li>• <strong>Redondea:</strong> Para cálculos rápidos</li>
                <li>• <strong>Verifica:</strong> Siempre revisa tus cálculos</li>
              </ul>
            </div>
            <div className="bg-purple-100 p-4 rounded-lg">
              <p className="text-sm text-purple-800">
                <strong>Calcular descuentos es:</strong> Una habilidad que te ayuda a tomar decisiones informadas sobre tus compras.
              </p>
            </div>
          </div>
        )
      }
    },

    // Step 7: Activity - Calculate discount
    {
      id: 'calculate-discount-activity',
      type: 'activity' as const,
      title: 'Calcula el Descuento',
      character: lucas,
      points: 25,
      content: {
        type: 'question',
        description: 'Ayuda a Elena a calcular un descuento',
        question: "Elena ve una camiseta que cuesta $80 con 30% de descuento. ¿Cuánto pagará finalmente?",
        options: [
          "$56 (descuento de $24)",
          "$80 (sin descuento)",
          "$104 (más caro)",
          "$50 (descuento de $30)"
        ],
        correct: 0,
        feedback: "¡Exacto! Elena pagará $56: $80 - ($80 × 0.30) = $80 - $24 = $56. ¡Ahorrará $24!"
      }
    },

    // Step 8: Comment after calculation
    {
      id: 'calculation-comment',
      type: 'comment' as const,
      title: '¡Excelente Cálculo!',
      character: sol,
      content: {
        message: "¡Perfecto! Ya sabes calcular descuentos. Ahora vamos a ver cómo distinguir ofertas reales de falsas.",
        content: (
          <div className="bg-orange-100 p-4 rounded-lg">
            <p className="text-sm text-orange-800">
              <strong>Próximo paso:</strong> Vamos a aprender a detectar ofertas falsas.
            </p>
          </div>
        )
      }
    },

    // Step 9: Information about real vs fake offers
    {
      id: 'real-fake-offers-info',
      type: 'information' as const,
      title: '¿Ofertas Reales o Falsas?',
      character: maestroDinero,
      content: {
        message: "Ahora vamos a convertirte en un detective de ofertas. Aprenderás a distinguir entre ofertas reales y trucos de marketing.",
        content: (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                <h4 className="font-bold text-green-800 mb-2">✅ Ofertas Reales</h4>
                <ul className="text-sm text-green-700 space-y-2">
                  <li>• <strong>Precio reducido:</strong> Menor al precio normal</li>
                  <li>• <strong>Comparación clara:</strong> Muestra precio anterior</li>
                  <li>• <strong>Tiempo limitado:</strong> Ofertas temporales reales</li>
                  <li>• <strong>Producto de calidad:</strong> No es defectuoso</li>
                  <li>• <strong>Sin condiciones ocultas:</strong> Transparencia total</li>
                </ul>
              </div>
              <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                <h4 className="font-bold text-red-800 mb-2">❌ Ofertas Falsas</h4>
                <ul className="text-sm text-red-700 space-y-2">
                  <li>• <strong>Precio inflado:</strong> Aumentan precio antes del descuento</li>
                  <li>• <strong>Comparación engañosa:</strong> Precio 'normal' falso</li>
                  <li>• <strong>Ofertas permanentes:</strong> 'Liquidación' que nunca termina</li>
                  <li>• <strong>Producto defectuoso:</strong> Calidad inferior</li>
                  <li>• <strong>Condiciones ocultas:</strong> Cargos adicionales</li>
                </ul>
              </div>
            </div>
            <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
              <h4 className="font-bold text-yellow-800 mb-2">🔍 Señales de Alerta</h4>
              <ul className="text-sm text-yellow-700 space-y-1">
                <li>• <strong>'Liquidación' permanente:</strong> Si siempre está en oferta, no es real</li>
                <li>• <strong>Precio 'normal' muy alto:</strong> Compara con otras tiendas</li>
                <li>• <strong>Urgencia falsa:</strong> 'Solo hoy' que se repite</li>
                <li>• <strong>Descuentos excesivos:</strong> 90% de descuento es sospechoso</li>
                <li>• <strong>Condiciones pequeñas:</strong> Lee la letra pequeña</li>
              </ul>
            </div>
            <div className="bg-purple-100 p-4 rounded-lg">
              <p className="text-sm text-purple-800">
                <strong>Recuerda:</strong> Si una oferta parece demasiado buena para ser verdad, probablemente lo sea.
              </p>
            </div>
          </div>
        )
      }
    },

    // Step 10: Activity - Identify real vs fake offers
    {
      id: 'identify-offers-activity',
      type: 'activity' as const,
      title: 'Identifica Ofertas Reales',
      character: lucas,
      points: 30,
      content: {
        type: 'question',
        description: 'Ayuda a Elena a identificar ofertas reales',
        question: "Elena ve una oferta que dice '90% de descuento, precio normal $500, ahora $50'. ¿Qué debería hacer?",
        options: [
          "Investigar si el precio normal de $500 es real comparando con otras tiendas",
          "Comprar inmediatamente porque es una gran oferta",
          "Ignorar la oferta porque es muy barata",
          "Pedirle a alguien que decida por ella"
        ],
        correct: 0,
        feedback: "¡Excelente! Elena debe investigar si el precio 'normal' de $500 es real. Un 90% de descuento es muy sospechoso."
      }
    },

    // Step 11: Comment after identification
    {
      id: 'identification-comment',
      type: 'comment' as const,
      title: '¡Buen Trabajo!',
      character: sol,
      content: {
        message: "¡Perfecto! Elena ya sabe identificar ofertas sospechosas. Ahora vamos a ver estrategias para aprovechar ofertas reales.",
        content: (
          <div className="bg-blue-100 p-4 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>Vamos a explorar:</strong> Estrategias para maximizar el valor de ofertas reales.
            </p>
          </div>
        )
      }
    },

    // Step 12: Information about offer strategies
    {
      id: 'offer-strategies-info',
      type: 'information' as const,
      title: 'Estrategias para Aprovechar Ofertas',
      character: maestroDinero,
      content: {
        message: "Ahora vamos a ver cómo convertirte en un maestro de las ofertas. Aprenderás a planificar y maximizar tus ahorros.",
        content: (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <h4 className="font-bold text-blue-800 mb-2">📅 Planificación</h4>
                <ul className="text-sm text-blue-700 space-y-2">
                  <li>• <strong>Lista de deseos:</strong> Anota lo que necesitas</li>
                  <li>• <strong>Investigación de precios:</strong> Conoce precios normales</li>
                  <li>• <strong>Calendario de ofertas:</strong> Black Friday, rebajas, etc.</li>
                  <li>• <strong>Presupuesto:</strong> No gastes más de lo planeado</li>
                </ul>
              </div>
              <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                <h4 className="font-bold text-green-800 mb-2">🎯 Estrategias de Compra</h4>
                <ul className="text-sm text-green-700 space-y-2">
                  <li>• <strong>Compara siempre:</strong> Múltiples tiendas</li>
                  <li>• <strong>Combina ofertas:</strong> Descuento + cupón</li>
                  <li>• <strong>Compra en volumen:</strong> Ofertas por cantidad</li>
                  <li>• <strong>Espera el momento:</strong> No compres por impulso</li>
                </ul>
              </div>
            </div>
            <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
              <h4 className="font-bold text-yellow-800 mb-2">💡 Consejos Avanzados</h4>
              <ul className="text-sm text-yellow-700 space-y-1">
                <li>• <strong>Apps de ofertas:</strong> Recibe alertas de descuentos</li>
                <li>• <strong>Programas de fidelidad:</strong> Puntos y descuentos adicionales</li>
                <li>• <strong>Compras fuera de temporada:</strong> Ropa de verano en invierno</li>
                <li>• <strong>Negociación:</strong> Pregunta por descuentos adicionales</li>
                <li>• <strong>Compras grupales:</strong> Descuentos por comprar con amigos</li>
              </ul>
            </div>
            <div className="bg-purple-100 p-4 rounded-lg">
              <p className="text-sm text-purple-800">
                <strong>La clave es:</strong> Planificar, investigar y no dejarse llevar por la emoción de una oferta.
              </p>
            </div>
          </div>
        )
      }
    },

    // Step 13: Activity - Offer strategy
    {
      id: 'offer-strategy-activity',
      type: 'activity' as const,
      title: 'Estrategia de Ofertas',
      character: lucas,
      points: 25,
      content: {
        type: 'question',
        description: 'Ayuda a Elena a crear una estrategia de ofertas',
        question: "Elena quiere comprar ropa para el próximo año escolar. ¿Cuál es la mejor estrategia?",
        options: [
          "Hacer una lista de lo que necesita, investigar precios normales y esperar ofertas de fin de temporada",
          "Comprar todo inmediatamente en la primera tienda que vea",
          "Esperar hasta el último momento para comprar",
          "Comprar solo lo más barato sin considerar calidad"
        ],
        correct: 0,
        feedback: "¡Perfecto! Planificar, investigar precios y esperar ofertas de fin de temporada es la estrategia más inteligente."
      }
    },

    // Step 14: Comment after strategy
    {
      id: 'strategy-comment',
      type: 'comment' as const,
      title: '¡Buena Estrategia!',
      character: sol,
      content: {
        message: "¡Excelente! Elena ya tiene una estrategia de ofertas. Vamos a ver cómo aplicar todo esto en un caso real.",
        content: (
          <div className="bg-green-100 p-4 rounded-lg">
            <p className="text-sm text-green-800">
              <strong>Vamos a practicar:</strong> Aplicaremos todo lo aprendido en un caso real.
            </p>
          </div>
        )
      }
    },

    // Step 15: Information about Elena's real case
    {
      id: 'elena-real-case-info',
      type: 'information' as const,
      title: 'El Caso Real de Elena',
      character: maestroDinero,
      content: {
        message: "Ahora vamos a resolver el caso real de Elena aplicando todo lo que hemos aprendido. Vamos a analizar diferentes ofertas.",
        content: (
          <div className="space-y-4">
            <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
              <h3 className="font-bold text-yellow-800 mb-3">🛒 Análisis de Ofertas</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-3 rounded border">
                  <h5 className="font-semibold text-green-700">Oferta A</h5>
                  <p className="text-sm"><strong>Producto:</strong> Zapatillas</p>
                  <p className="text-sm"><strong>Precio normal:</strong> $120</p>
                  <p className="text-sm"><strong>Oferta:</strong> 25% descuento</p>
                  <p className="text-sm"><strong>Precio final:</strong> $90</p>
                  <p className="text-sm"><strong>Ahorro:</strong> $30</p>
                </div>
                <div className="bg-white p-3 rounded border">
                  <h5 className="font-semibold text-blue-700">Oferta B</h5>
                  <p className="text-sm"><strong>Producto:</strong> Mochila</p>
                  <p className="text-sm"><strong>Precio normal:</strong> $200</p>
                  <p className="text-sm"><strong>Oferta:</strong> 50% descuento</p>
                  <p className="text-sm"><strong>Precio final:</strong> $100</p>
                  <p className="text-sm"><strong>Ahorro:</strong> $100</p>
                </div>
                <div className="bg-white p-3 rounded border">
                  <h5 className="font-semibold text-purple-700">Oferta C</h5>
                  <p className="text-sm"><strong>Producto:</strong> Calculadora</p>
                  <p className="text-sm"><strong>Precio normal:</strong> $80</p>
                  <p className="text-sm"><strong>Oferta:</strong> 2x1</p>
                  <p className="text-sm"><strong>Precio final:</strong> $80</p>
                  <p className="text-sm"><strong>Ahorro:</strong> $80</p>
                </div>
              </div>
            </div>
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <h4 className="font-bold text-blue-800 mb-2">📊 Análisis de Valor</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div className="text-center">
                  <h5 className="font-semibold text-green-700">Oferta A</h5>
                  <p className="text-lg font-bold text-green-600">25% ahorro</p>
                  <p className="text-xs text-gray-600">Buena oferta</p>
                </div>
                <div className="text-center">
                  <h5 className="font-semibold text-blue-700">Oferta B</h5>
                  <p className="text-lg font-bold text-blue-600">50% ahorro</p>
                  <p className="text-xs text-gray-600">Excelente oferta</p>
                </div>
                <div className="text-center">
                  <h5 className="font-semibold text-purple-700">Oferta C</h5>
                  <p className="text-lg font-bold text-purple-600">100% ahorro</p>
                  <p className="text-xs text-gray-600">Mejor oferta</p>
                </div>
              </div>
            </div>
            <div className="bg-green-100 p-4 rounded-lg">
              <p className="text-sm text-green-800">
                <strong>¡Análisis completo!</strong> Elena puede ver claramente cuál oferta le da más valor por su dinero.
              </p>
            </div>
          </div>
        )
      }
    },

    // Step 16: Activity - Analyze Elena's offers
    {
      id: 'analyze-elena-offers-activity',
      type: 'activity' as const,
      title: 'Analiza las Ofertas de Elena',
      character: lucas,
      points: 35,
      content: {
        type: 'question',
        description: 'Ayuda a Elena a analizar sus opciones de ofertas',
        question: "Mirando las tres ofertas, ¿cuál le da a Elena el mayor ahorro porcentual?",
        options: [
          "Oferta C (2x1) - obtiene 2 calculadoras por el precio de 1, 100% de ahorro en la segunda",
          "Oferta B (50% descuento) - ahorra la mitad del precio",
          "Oferta A (25% descuento) - ahorra un cuarto del precio",
          "Todas son iguales"
        ],
        correct: 0,
        feedback: "¡Exacto! La oferta 2x1 le da a Elena el mayor ahorro: obtiene 2 productos por el precio de 1, lo que significa 100% de ahorro en el segundo producto."
      }
    },

    // Step 17: Comment after analysis
    {
      id: 'analysis-comment',
      type: 'comment' as const,
      title: '¡Análisis Excelente!',
      character: sol,
      content: {
        message: "¡Perfecto! Elena ahora puede tomar decisiones informadas sobre ofertas. Vamos a darle algunos consejos finales.",
        content: (
          <div className="bg-blue-100 p-4 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>Próximo paso:</strong> Consejos finales para maximizar ahorros con ofertas.
            </p>
          </div>
        )
      }
    },

    // Step 18: Information about final tips
    {
      id: 'final-tips-info',
      type: 'information' as const,
      title: 'Consejos Finales para Ofertas',
      character: maestroDinero,
      content: {
        message: "Ahora te voy a dar algunos consejos súper útiles para convertirte en un maestro de las ofertas y siempre obtener el mejor valor.",
        content: (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <h4 className="font-bold text-blue-800 mb-2">💡 Consejos Principales</h4>
                <ul className="text-sm text-blue-700 space-y-2">
                  <li>• <strong>Investiga siempre:</strong> Compara precios antes y después</li>
                  <li>• <strong>Lee la letra pequeña:</strong> Condiciones y restricciones</li>
                  <li>• <strong>Calcula el ahorro real:</strong> No te dejes engañar</li>
                  <li>• <strong>Pregunta por más:</strong> Descuentos adicionales</li>
                </ul>
              </div>
              <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                <h4 className="font-bold text-green-800 mb-2">🚀 Estrategias Avanzadas</h4>
                <ul className="text-sm text-green-700 space-y-2">
                  <li>• <strong>Combina ofertas:</strong> Descuento + cupón + puntos</li>
                  <li>• <strong>Compra estratégicamente:</strong> Planifica tus compras</li>
                  <li>• <strong>Usa tecnología:</strong> Apps de ofertas y comparación</li>
                  <li>• <strong>Construye relaciones:</strong> Vendedores pueden dar mejores ofertas</li>
                </ul>
              </div>
            </div>
            <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
              <h4 className="font-bold text-yellow-800 mb-2">🎯 Reglas de Oro</h4>
              <ul className="text-sm text-yellow-700 space-y-1">
                <li>• <strong>No compres por impulso:</strong> Si no lo necesitas, no lo compres</li>
                <li>• <strong>Establece límites:</strong> No gastes más de tu presupuesto</li>
                <li>• <strong>Prioriza calidad:</strong> Mejor producto con descuento que producto barato</li>
                <li>• <strong>Documenta tus ahorros:</strong> Lleva un registro de cuánto ahorras</li>
                <li>• <strong>Comparte conocimiento:</strong> Ayuda a otros a encontrar buenas ofertas</li>
              </ul>
            </div>
            <div className="bg-purple-100 p-4 rounded-lg">
              <p className="text-sm text-purple-800">
                <strong>Recuerda:</strong> Ser inteligente con las ofertas no significa comprar todo lo que está en descuento, sino obtener el mejor valor por tu dinero.
              </p>
            </div>
          </div>
        )
      }
    },

    // Step 19: Final activity - Apply knowledge
    {
      id: 'final-application-activity',
      type: 'activity' as const,
      title: 'Aplica tu Conocimiento',
      character: lucas,
      points: 40,
      content: {
        type: 'question',
        description: 'Ayuda a Elena a aplicar todo lo aprendido',
        question: "Elena ve una oferta que dice 'Liquidación total, 70% de descuento, solo hoy'. ¿Qué debería hacer primero?",
        options: [
          "Investigar si realmente es una liquidación y comparar con precios normales de otras tiendas",
          "Comprar inmediatamente porque es una gran oferta",
          "Ignorar la oferta porque es muy sospechosa",
          "Llamar a un amigo para que decida"
        ],
        correct: 0,
        feedback: "¡Perfecto! Elena debe investigar si realmente es una liquidación y comparar precios. Las 'liquidaciones' permanentes suelen ser falsas."
      }
    },

    // Step 20: Final reflection
    {
      id: 'final-reflection',
      type: 'comment' as const,
      title: '¡Lección Completada!',
      character: maestroDinero,
      content: {
        message: "¡Felicitaciones! Has completado tu lección sobre ofertas y descuentos. Ahora eres un detective de ofertas experto.",
        content: (
          <div className="space-y-4">
            <div className="bg-gradient-to-r from-green-100 to-blue-100 p-4 rounded-lg">
              <h3 className="font-bold text-green-800 mb-2">Lo que aprendiste hoy:</h3>
              <ul className="space-y-1 text-sm text-green-700">
                <li>✅ Cómo calcular porcentajes de descuento</li>
                <li>✅ Cómo distinguir ofertas reales de falsas</li>
                <li>✅ Estrategias para aprovechar promociones</li>
                <li>✅ Cómo planificar compras con ofertas</li>
                <li>✅ Consejos para maximizar ahorros</li>
                <li>✅ Reglas de oro para ofertas inteligentes</li>
                <li>✅ Ayudar a Elena a tomar decisiones informadas</li>
              </ul>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-600">
                ¡Ahora puedes identificar ofertas reales y maximizar el valor de tu dinero!
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
        question: "¿Qué fue lo más sorprendente que aprendiste sobre ofertas y descuentos hoy?",
        message: "Antes de terminar, tómate un momento para pensar en lo que aprendiste. ¿Qué te pareció más sorprendente o útil sobre las ofertas y descuentos?",
        rewards: {
          points: 50,
          badges: ["Cazador de Ofertas", "Ayudante de Elena"],
          stickers: ["🏷️", "💰", "🎯", "⭐"]
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

export default Lesson3_2_OffersAndDiscounts;
