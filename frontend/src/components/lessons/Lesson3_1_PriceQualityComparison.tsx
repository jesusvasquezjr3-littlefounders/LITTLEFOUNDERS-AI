import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  StepBasedLesson,
  characters 
} from './LessonComponents';
import { ChevronRight, ChevronLeft, Home, Search, Scale, Star, ShoppingCart, TrendingUp } from 'lucide-react';

interface Lesson3_1Props {
  onComplete: (score: number, progress: any) => void;
  onExit: () => void;
}

const Lesson3_1_PriceQualityComparison: React.FC<Lesson3_1Props> = ({ onComplete, onExit }) => {
  const lucas = characters.lucas;
  const sol = characters.sol;
  const maestroDinero = characters.maestro_dinero;

  // Step-based lesson structure - each step shows one thing at a time
  const lessonSteps = [
    // Step 1: Hook/Introduction
    {
      id: 'hook',
      type: 'information' as const,
      title: 'El Dilema de David: ¿Cuál Zapatilla Comprar?',
      character: lucas,
      content: {
        message: "¡Hola! Soy David, tengo 12 años y tengo un problema. Quiero comprar unas zapatillas deportivas, pero hay muchas opciones: unas cuestan $80, otras $120, y otras $150. ¿Cómo sé cuál es la mejor opción? ¿La más cara es siempre la mejor?",
        content: (
          <div className="text-center space-y-4">
            <div className="text-6xl">👟💰🤔</div>
            <p className="text-lg font-medium text-gray-700">
               David no sabe cómo elegir la mejor zapatilla
            </p>
            <div className="bg-yellow-100 p-4 rounded-lg">
              <p className="text-sm text-yellow-800">
                <strong>Problema:</strong> David no sabe cómo comparar precio y calidad para tomar la mejor decisión
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
        message: "¡Hola compradores inteligentes! Soy el Maestro Dinero, y hoy vamos a convertirte en un detective de compras. Aprenderás a investigar antes de comprar y a encontrar el mejor valor por tu dinero.",
        content: (
          <div className="space-y-4">
            <div className="bg-blue-100 p-4 rounded-lg">
              <h3 className="font-bold text-blue-800 mb-2">¿Qué vamos a aprender hoy?</h3>
              <ul className="space-y-2 text-sm text-blue-700">
                <li>• ¿Por qué es importante investigar antes de comprar?</li>
                <li>• Cómo evaluar la relación precio-calidad</li>
                <li>• Herramientas para comparar productos</li>
                <li>• Cómo tomar decisiones de compra inteligentes</li>
                <li>• Ayudar a David a elegir las mejores zapatillas</li>
              </ul>
            </div>
          </div>
        )
      }
    },

    // Step 3: Information about research before buying
    {
      id: 'research-info',
      type: 'information' as const,
      title: '¿Por Qué Investigar Antes de Comprar?',
      character: sol,
      content: {
        message: "¡Hola! Soy Sol y me encanta tomar decisiones inteligentes. Investigar antes de comprar es como ser un detective que busca pistas para encontrar la mejor opción.",
        content: (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-4 bg-green-100 rounded-lg">
                <div className="text-4xl mb-2">🔍</div>
                <p className="text-sm font-medium">Investigar</p>
                <p className="text-xs text-gray-600">Buscar información</p>
              </div>
              <div className="text-center p-4 bg-blue-100 rounded-lg">
                <div className="text-4xl mb-2">⚖️</div>
                <p className="text-sm font-medium">Comparar</p>
                <p className="text-xs text-gray-600">Evaluar opciones</p>
              </div>
              <div className="text-center p-4 bg-purple-100 rounded-lg">
                <div className="text-4xl mb-2">🎯</div>
                <p className="text-sm font-medium">Decidir</p>
                <p className="text-xs text-gray-600">Elegir lo mejor</p>
              </div>
            </div>
            <div className="bg-purple-100 p-4 rounded-lg">
              <p className="text-sm text-purple-800">
                <strong>Investigar antes de comprar es:</strong> Recolectar información sobre productos para tomar la mejor decisión de compra.
              </p>
            </div>
          </div>
        )
      }
    },

    // Step 4: Activity - Research importance
    {
      id: 'research-activity',
      type: 'activity' as const,
      title: '¿Por Qué Investigar?',
      character: lucas,
      points: 20,
      content: {
        type: 'question',
        description: 'Ayuda a David a entender por qué es importante investigar antes de comprar',
        question: "¿Cuál es la razón principal para investigar antes de comprar?",
        options: [
          "Tomar decisiones informadas y obtener el mejor valor por tu dinero",
          "Gastar más tiempo en la decisión",
          "Comprar siempre lo más barato",
          "Comprar siempre lo más caro"
        ],
        correct: 0,
        feedback: "¡Excelente! Investigar te ayuda a tomar decisiones informadas y obtener el mejor valor por tu dinero."
      }
    },

    // Step 5: Comment after research
    {
      id: 'research-comment',
      type: 'comment' as const,
      title: '¡Perfecto!',
      character: sol,
      content: {
        message: "¡Muy bien! Ya entiendes por qué es importante investigar. Ahora vamos a ver cómo evaluar la relación precio-calidad.",
        content: (
          <div className="bg-green-100 p-4 rounded-lg">
            <p className="text-sm text-green-800">
              <strong>Recuerda:</strong> La investigación te da el poder de tomar decisiones inteligentes.
            </p>
          </div>
        )
      }
    },

    // Step 6: Information about price-quality relationship
    {
      id: 'price-quality-info',
      type: 'information' as const,
      title: '¿Qué es la Relación Precio-Calidad?',
      character: maestroDinero,
      content: {
        message: "Ahora vamos a descubrir uno de los conceptos más importantes en las compras inteligentes: la relación precio-calidad. Es como encontrar el equilibrio perfecto.",
        content: (
          <div className="space-y-4">
            <div className="bg-gradient-to-r from-green-50 to-blue-50 p-4 rounded-lg border border-green-200">
              <h3 className="font-bold text-green-800 mb-3">⚖️ Relación Precio-Calidad</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-semibold text-green-700 mb-2">💰 Precio</h4>
                  <ul className="text-sm text-green-600 space-y-1">
                    <li>• Cuánto cuesta el producto</li>
                    <li>• Si está dentro de tu presupuesto</li>
                    <li>• Si es una buena oferta</li>
                    <li>• Comparación con otros precios</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold text-blue-700 mb-2">⭐ Calidad</h4>
                  <ul className="text-sm text-blue-600 space-y-1">
                    <li>• Qué tan bien funciona</li>
                    <li>• Durabilidad del producto</li>
                    <li>• Características y beneficios</li>
                    <li>• Satisfacción del usuario</li>
                  </ul>
                </div>
              </div>
            </div>
            <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
              <h4 className="font-bold text-yellow-800 mb-2">🎯 ¿Qué Buscar?</h4>
              <ul className="text-sm text-yellow-700 space-y-1">
                <li>• <strong>Mejor valor:</strong> Buena calidad a un precio razonable</li>
                <li>• <strong>No siempre lo más barato:</strong> A veces cuesta más a largo plazo</li>
                <li>• <strong>No siempre lo más caro:</strong> El precio alto no garantiza calidad</li>
                <li>• <strong>Equilibrio:</strong> Encuentra el punto medio perfecto</li>
              </ul>
            </div>
            <div className="bg-purple-100 p-4 rounded-lg">
              <p className="text-sm text-purple-800">
                <strong>La relación precio-calidad es:</strong> Encontrar el producto que ofrece la mejor calidad por el precio que pagas.
              </p>
            </div>
          </div>
        )
      }
    },

    // Step 7: Activity - Price-quality understanding
    {
      id: 'price-quality-activity',
      type: 'activity' as const,
      title: 'Entendiendo Precio vs Calidad',
      character: lucas,
      points: 25,
      content: {
        type: 'question',
        description: 'Ayuda a David a entender la relación precio-calidad',
        question: "David ve dos zapatillas: unas cuestan $50 y duran 6 meses, otras cuestan $100 y duran 2 años. ¿Cuál tiene mejor relación precio-calidad?",
        options: [
          "Las de $100 (cuestan $50 por año vs $100 por año de las baratas)",
          "Las de $50 (son más baratas)",
          "Las de $100 (son más caras, por eso son mejores)",
          "No hay diferencia, ambas son iguales"
        ],
        correct: 0,
        feedback: "¡Exacto! Las de $100 tienen mejor relación precio-calidad: $50 por año vs $100 por año de las baratas. ¡Más durabilidad por menos dinero!"
      }
    },

    // Step 8: Comment after price-quality
    {
      id: 'price-quality-comment',
      type: 'comment' as const,
      title: '¡Excelente Comprensión!',
      character: sol,
      content: {
        message: "¡Perfecto! Ya entiendes la relación precio-calidad. Ahora vamos a ver las herramientas que puedes usar para comparar productos.",
        content: (
          <div className="bg-orange-100 p-4 rounded-lg">
            <p className="text-sm text-orange-800">
              <strong>Próximo paso:</strong> Vamos a explorar las herramientas de comparación.
            </p>
          </div>
        )
      }
    },

    // Step 9: Information about comparison tools
    {
      id: 'comparison-tools-info',
      type: 'information' as const,
      title: 'Herramientas para Comparar Productos',
      character: maestroDinero,
      content: {
        message: "Ahora vamos a ver las diferentes herramientas que puedes usar para comparar productos. Es como tener un kit de detective de compras.",
        content: (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <h4 className="font-bold text-blue-800 mb-2">📱 Herramientas Digitales</h4>
                <ul className="text-sm text-blue-700 space-y-2">
                  <li>• <strong>Apps de comparación:</strong> Compara precios entre tiendas</li>
                  <li>• <strong>Reseñas en línea:</strong> Lee opiniones de otros usuarios</li>
                  <li>• <strong>Sitios web especializados:</strong> Información técnica detallada</li>
                  <li>• <strong>Redes sociales:</strong> Recomendaciones de amigos</li>
                </ul>
              </div>
              <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                <h4 className="font-bold text-green-800 mb-2">🏪 Métodos Tradicionales</h4>
                <ul className="text-sm text-green-700 space-y-2">
                  <li>• <strong>Visitar tiendas:</strong> Ver productos en persona</li>
                  <li>• <strong>Preguntar a expertos:</strong> Consejos de vendedores</li>
                  <li>• <strong>Comparar catálogos:</strong> Revisar folletos y ofertas</li>
                  <li>• <strong>Probar productos:</strong> Usar antes de comprar</li>
                </ul>
              </div>
            </div>
            <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
              <h4 className="font-bold text-yellow-800 mb-2">🔍 Qué Buscar en las Comparaciones</h4>
              <ul className="text-sm text-yellow-700 space-y-1">
                <li>• <strong>Especificaciones:</strong> Características técnicas del producto</li>
                <li>• <strong>Garantía:</strong> Tiempo de cobertura y condiciones</li>
                <li>• <strong>Reseñas:</strong> Opiniones de usuarios reales</li>
                <li>• <strong>Precio total:</strong> Incluyendo envío, impuestos, etc.</li>
                <li>• <strong>Servicio al cliente:</strong> Soporte post-venta</li>
              </ul>
            </div>
            <div className="bg-purple-100 p-4 rounded-lg">
              <p className="text-sm text-purple-800">
                <strong>Consejo:</strong> Usa múltiples herramientas para obtener una visión completa antes de decidir.
              </p>
            </div>
          </div>
        )
      }
    },

    // Step 10: Activity - Choose comparison tool
    {
      id: 'comparison-tool-activity',
      type: 'activity' as const,
      title: 'Elige tu Herramienta',
      character: lucas,
      points: 30,
      content: {
        type: 'question',
        description: 'Ayuda a David a elegir la mejor herramienta para comparar zapatillas',
        question: "David quiere comparar zapatillas deportivas. ¿Cuál sería la mejor herramienta para empezar?",
        options: [
          "Leer reseñas en línea y comparar precios en diferentes tiendas",
          "Comprar la primera zapatilla que vea",
          "Solo mirar el precio sin considerar calidad",
          "Pedirle a alguien que compre por él"
        ],
        correct: 0,
        feedback: "¡Excelente elección! Leer reseñas y comparar precios te da la información más completa para tomar una decisión inteligente."
      }
    },

    // Step 11: Comment after comparison tool
    {
      id: 'comparison-tool-comment',
      type: 'comment' as const,
      title: '¡Buena Elección!',
      character: sol,
      content: {
        message: "¡Perfecto! David tiene herramientas para comparar. Ahora vamos a ver cómo aplicar esto al caso específico de las zapatillas.",
        content: (
          <div className="bg-blue-100 p-4 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>Vamos a practicar:</strong> Aplicaremos lo aprendido al caso de David.
            </p>
          </div>
        )
      }
    },

    // Step 12: Information about David's shoe comparison
    {
      id: 'david-shoes-info',
      type: 'information' as const,
      title: 'El Caso de las Zapatillas de David',
      character: maestroDinero,
      content: {
        message: "Ahora vamos a resolver el dilema de David aplicando todo lo que hemos aprendido. Vamos a comparar las tres opciones de zapatillas.",
        content: (
          <div className="space-y-4">
            <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
              <h3 className="font-bold text-yellow-800 mb-3">👟 Opciones de Zapatillas</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-3 rounded border">
                  <h5 className="font-semibold text-green-700">Opción A</h5>
                  <p className="text-sm"><strong>Precio:</strong> $80</p>
                  <p className="text-sm"><strong>Durabilidad:</strong> 8 meses</p>
                  <p className="text-sm"><strong>Comodidad:</strong> ⭐⭐⭐</p>
                  <p className="text-sm"><strong>Garantía:</strong> 3 meses</p>
                </div>
                <div className="bg-white p-3 rounded border">
                  <h5 className="font-semibold text-blue-700">Opción B</h5>
                  <p className="text-sm"><strong>Precio:</strong> $120</p>
                  <p className="text-sm"><strong>Durabilidad:</strong> 18 meses</p>
                  <p className="text-sm"><strong>Comodidad:</strong> ⭐⭐⭐⭐⭐</p>
                  <p className="text-sm"><strong>Garantía:</strong> 12 meses</p>
                </div>
                <div className="bg-white p-3 rounded border">
                  <h5 className="font-semibold text-purple-700">Opción C</h5>
                  <p className="text-sm"><strong>Precio:</strong> $150</p>
                  <p className="text-sm"><strong>Durabilidad:</strong> 24 meses</p>
                  <p className="text-sm"><strong>Comodidad:</strong> ⭐⭐⭐⭐⭐</p>
                  <p className="text-sm"><strong>Garantía:</strong> 24 meses</p>
                </div>
              </div>
            </div>
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <h4 className="font-bold text-blue-800 mb-2">📊 Análisis de Valor</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div className="text-center">
                  <h5 className="font-semibold text-green-700">Opción A</h5>
                  <p className="text-lg font-bold text-green-600">$10/mes</p>
                  <p className="text-xs text-gray-600">($80 ÷ 8 meses)</p>
                </div>
                <div className="text-center">
                  <h5 className="font-semibold text-blue-700">Opción B</h5>
                  <p className="text-lg font-bold text-blue-600">$6.67/mes</p>
                  <p className="text-xs text-gray-600">($120 ÷ 18 meses)</p>
                </div>
                <div className="text-center">
                  <h5 className="font-semibold text-purple-700">Opción C</h5>
                  <p className="text-lg font-bold text-purple-600">$6.25/mes</p>
                  <p className="text-xs text-gray-600">($150 ÷ 24 meses)</p>
                </div>
              </div>
            </div>
            <div className="bg-green-100 p-4 rounded-lg">
              <p className="text-sm text-green-800">
                <strong>¡Análisis completo!</strong> Ahora David puede ver el costo por mes de cada opción y considerar la comodidad y garantía.
              </p>
            </div>
          </div>
        )
      }
    },

    // Step 13: Activity - Analyze David's options
    {
      id: 'analyze-david-options-activity',
      type: 'activity' as const,
      title: 'Analiza las Opciones de David',
      character: lucas,
      points: 35,
      content: {
        type: 'question',
        description: 'Ayuda a David a analizar sus opciones de zapatillas',
        question: "Mirando el análisis de las zapatillas, ¿cuál opción ofrece el mejor valor considerando precio, durabilidad y comodidad?",
        options: [
          "Opción B ($120) - buen balance de precio, durabilidad y comodidad",
          "Opción A ($80) - la más barata",
          "Opción C ($150) - la más cara",
          "Todas son iguales"
        ],
        correct: 0,
        feedback: "¡Exacto! Opción B ofrece el mejor balance: buen precio por mes ($6.67), durabilidad de 18 meses, máxima comodidad y garantía de 12 meses."
      }
    },

    // Step 14: Comment after analysis
    {
      id: 'analysis-comment',
      type: 'comment' as const,
      title: '¡Análisis Excelente!',
      character: sol,
      content: {
        message: "¡Perfecto! David ahora puede tomar una decisión informada. Vamos a ver algunos consejos adicionales para compras inteligentes.",
        content: (
          <div className="bg-blue-100 p-4 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>Próximo paso:</strong> Consejos para maximizar el valor de tus compras.
            </p>
          </div>
        )
      }
    },

    // Step 15: Information about smart shopping tips
    {
      id: 'smart-shopping-tips-info',
      type: 'information' as const,
      title: 'Consejos para Compras Inteligentes',
      character: maestroDinero,
      content: {
        message: "Ahora te voy a dar algunos consejos súper útiles para convertirte en un comprador experto y siempre obtener el mejor valor.",
        content: (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <h4 className="font-bold text-blue-800 mb-2">💡 Estrategias Principales</h4>
                <ul className="text-sm text-blue-700 space-y-2">
                  <li>• <strong>Investiga siempre:</strong> Nunca compres sin comparar</li>
                  <li>• <strong>Lee reseñas:</strong> Opiniones de usuarios reales</li>
                  <li>• <strong>Considera el costo total:</strong> Incluye envío, impuestos, etc.</li>
                  <li>• <strong>Piensa a largo plazo:</strong> Durabilidad vs precio inicial</li>
                </ul>
              </div>
              <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                <h4 className="font-bold text-green-800 mb-2">🚀 Estrategias Avanzadas</h4>
                <ul className="text-sm text-green-700 space-y-2">
                  <li>• <strong>Espera ofertas:</strong> Black Friday, rebajas, etc.</li>
                  <li>• <strong>Usa cupones:</strong> Descuentos y promociones</li>
                  <li>• <strong>Compra en temporada:</strong> Productos fuera de temporada</li>
                  <li>• <strong>Considera marcas genéricas:</strong> A veces igual calidad, menor precio</li>
                </ul>
              </div>
            </div>
            <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
              <h4 className="font-bold text-yellow-800 mb-2">🎯 Preguntas Clave</h4>
              <ul className="text-sm text-yellow-700 space-y-1">
                <li>• <strong>¿Realmente lo necesito?</strong> Evita compras impulsivas</li>
                <li>• <strong>¿Cuánto tiempo lo usaré?</strong> Durabilidad vs frecuencia de uso</li>
                <li>• <strong>¿Hay alternativas más baratas?</strong> Explora todas las opciones</li>
                <li>• <strong>¿Puedo esperar?</strong> A veces la paciencia ahorra dinero</li>
                <li>• <strong>¿Cuál es el costo por uso?</strong> Divide el precio entre usos esperados</li>
              </ul>
            </div>
            <div className="bg-purple-100 p-4 rounded-lg">
              <p className="text-sm text-purple-800">
                <strong>Recuerda:</strong> Ser un comprador inteligente no significa comprar lo más barato, sino obtener el mejor valor por tu dinero.
              </p>
            </div>
          </div>
        )
      }
    },

    // Step 16: Activity - Smart shopping strategy
    {
      id: 'smart-shopping-activity',
      type: 'activity' as const,
      title: 'Estrategia de Compra Inteligente',
      character: lucas,
      points: 25,
      content: {
        type: 'question',
        description: 'Ayuda a David a crear una estrategia de compra inteligente',
        question: "David quiere comprar un videojuego. ¿Cuál es la mejor estrategia para obtener el mejor valor?",
        options: [
          "Investigar reseñas, comparar precios en diferentes tiendas y esperar ofertas",
          "Comprar inmediatamente en la primera tienda que vea",
          "Solo mirar el precio sin considerar la calidad del juego",
          "Pedirle a alguien que compre por él sin investigar"
        ],
        correct: 0,
        feedback: "¡Perfecto! Investigar, comparar y esperar ofertas es la estrategia más inteligente para obtener el mejor valor por tu dinero."
      }
    },

    // Step 17: Comment after smart shopping
    {
      id: 'smart-shopping-comment',
      type: 'comment' as const,
      title: '¡Buena Estrategia!',
      character: sol,
      content: {
        message: "¡Excelente! David ya tiene una estrategia de compra inteligente. Vamos a ver cómo aplicar todo esto en situaciones reales.",
        content: (
          <div className="bg-green-100 p-4 rounded-lg">
            <p className="text-sm text-green-800">
              <strong>Vamos a practicar:</strong> Aplicaremos todo lo aprendido en un caso real.
            </p>
          </div>
        )
      }
    },

    // Step 18: Information about real-world application
    {
      id: 'real-world-application-info',
      type: 'information' as const,
      title: 'Aplicación en el Mundo Real',
      character: maestroDinero,
      content: {
        message: "Ahora vamos a ver cómo aplicar todo lo que hemos aprendido en situaciones reales de compra. Es como tener un manual de compras inteligentes.",
        content: (
          <div className="space-y-4">
            <div className="bg-gradient-to-r from-green-50 to-blue-50 p-4 rounded-lg border border-green-200">
              <h3 className="font-bold text-green-800 mb-3">🛒 Proceso de Compra Inteligente</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-semibold text-green-700 mb-2">📋 Paso 1: Investigar</h4>
                  <ul className="text-sm text-green-600 space-y-1">
                    <li>• Define qué necesitas</li>
                    <li>• Busca opciones disponibles</li>
                    <li>• Lee reseñas y opiniones</li>
                    <li>• Compara especificaciones</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold text-blue-700 mb-2">💰 Paso 2: Comparar Precios</h4>
                  <ul className="text-sm text-blue-600 space-y-1">
                    <li>• Revisa diferentes tiendas</li>
                    <li>• Considera envío e impuestos</li>
                    <li>• Busca cupones y descuentos</li>
                    <li>• Calcula costo total</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold text-purple-700 mb-2">⭐ Paso 3: Evaluar Calidad</h4>
                  <ul className="text-sm text-purple-600 space-y-1">
                    <li>• Durabilidad del producto</li>
                    <li>• Garantía y servicio</li>
                    <li>• Satisfacción del usuario</li>
                    <li>• Relación precio-calidad</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold text-orange-700 mb-2">🎯 Paso 4: Decidir</h4>
                  <ul className="text-sm text-orange-600 space-y-1">
                    <li>• Balancea todos los factores</li>
                    <li>• Considera tu presupuesto</li>
                    <li>• Piensa a largo plazo</li>
                    <li>• Toma la decisión final</li>
                  </ul>
                </div>
              </div>
            </div>
            <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
              <h4 className="font-bold text-yellow-800 mb-2">💡 Consejos Prácticos</h4>
              <ul className="text-sm text-yellow-700 space-y-1">
                <li>• <strong>Usa apps de comparación:</strong> Te ahorran tiempo y dinero</li>
                <li>• <strong>Guarda enlaces:</strong> Para revisar más tarde</li>
                <li>• <strong>Configura alertas:</strong> Para ofertas y descuentos</li>
                <li>• <strong>Documenta tus decisiones:</strong> Para aprender de la experiencia</li>
              </ul>
            </div>
            <div className="bg-purple-100 p-4 rounded-lg">
              <p className="text-sm text-purple-800">
                <strong>El proceso de compra inteligente es:</strong> Un hábito que se mejora con la práctica y te convierte en un consumidor experto.
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
        description: 'Ayuda a David a aplicar todo lo aprendido',
        question: "David quiere comprar un teléfono. ¿Cuál es el primer paso más importante en el proceso de compra inteligente?",
        options: [
          "Investigar qué características necesita y leer reseñas de diferentes modelos",
          "Ir directamente a la tienda y comprar el más caro",
          "Pedirle a un amigo que elija por él",
          "Comprar el primer teléfono que vea"
        ],
        correct: 0,
        feedback: "¡Perfecto! Investigar necesidades y leer reseñas es el primer paso fundamental para tomar una decisión informada."
      }
    },

    // Step 20: Final reflection
    {
      id: 'final-reflection',
      type: 'comment' as const,
      title: '¡Lección Completada!',
      character: maestroDinero,
      content: {
        message: "¡Felicitaciones! Has completado tu lección sobre comparación de precios y calidad. Ahora eres un detective de compras experto.",
        content: (
          <div className="space-y-4">
            <div className="bg-gradient-to-r from-green-100 to-blue-100 p-4 rounded-lg">
              <h3 className="font-bold text-green-800 mb-2">Lo que aprendiste hoy:</h3>
              <ul className="space-y-1 text-sm text-green-700">
                <li>✅ Por qué es importante investigar antes de comprar</li>
                <li>✅ Cómo evaluar la relación precio-calidad</li>
                <li>✅ Herramientas para comparar productos</li>
                <li>✅ Cómo calcular el valor real de un producto</li>
                <li>✅ Estrategias para compras inteligentes</li>
                <li>✅ Proceso completo de compra informada</li>
                <li>✅ Ayudar a David a elegir las mejores zapatillas</li>
              </ul>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-600">
                ¡Ahora puedes tomar decisiones de compra inteligentes y obtener el mejor valor por tu dinero!
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
        question: "¿Qué fue lo más útil que aprendiste sobre comparación de precios y calidad hoy?",
        message: "Antes de terminar, tómate un momento para pensar en lo que aprendiste. ¿Qué te pareció más útil o sorprendente sobre la comparación de productos?",
        rewards: {
          points: 50,
          badges: ["Detective de Compras", "Ayudante de David"],
          stickers: ["🔍", "⚖️", "💰", "⭐"]
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

export default Lesson3_1_PriceQualityComparison;
