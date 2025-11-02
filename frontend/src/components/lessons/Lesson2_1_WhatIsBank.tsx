import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  StepBasedLesson,
  characters 
} from './LessonComponents';
import { ChevronRight, ChevronLeft, Home, Building, Shield, CreditCard, PiggyBank, Users } from 'lucide-react';

interface Lesson2_1Props {
  onComplete: (score: number, progress: any) => void;
  onExit: () => void;
}

const Lesson2_1_WhatIsBank: React.FC<Lesson2_1Props> = ({ onComplete, onExit }) => {
  const lucas = characters.lucas;
  const sol = characters.sol;
  const maestroDinero = characters.maestro_dinero;

  // Step-based lesson structure - each step shows one thing at a time
  const lessonSteps = [
    // Step 1: Hook/Introduction
    {
      id: 'hook',
      type: 'information' as const,
      title: 'La Aventura de Carlos: Mi Primera Visita al Banco',
      character: lucas,
      content: {
        message: "¡Hola! Soy Carlos, tengo 12 años y hoy voy a hacer algo muy emocionante: ¡ir al banco por primera vez! Mi papá dice que es hora de que tenga mi propia cuenta de ahorros. ¿Me puedes ayudar a entender qué es un banco y por qué es importante?",
        content: (
          <div className="text-center space-y-4">
            <div className="text-6xl">🏦👦💰</div>
            <p className="text-lg font-medium text-gray-700">
              Carlos va a abrir su primera cuenta bancaria
            </p>
            <div className="bg-yellow-100 p-4 rounded-lg">
              <p className="text-sm text-yellow-800">
                <strong>Objetivo:</strong> Entender qué es un banco y cómo puede ayudar a Carlos a manejar su dinero
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
        message: "¡Hola jóvenes banqueros! Soy el Maestro Dinero, y hoy vamos a explorar el fascinante mundo de los bancos. Los bancos son como superhéroes del dinero que nos ayudan a proteger y hacer crecer nuestros ahorros.",
        content: (
          <div className="space-y-4">
            <div className="bg-blue-100 p-4 rounded-lg">
              <h3 className="font-bold text-blue-800 mb-2">¿Qué vamos a aprender hoy?</h3>
              <ul className="space-y-2 text-sm text-blue-700">
                <li>• ¿Qué es un banco y cuáles son sus funciones principales?</li>
                <li>• Por qué los bancos son seguros y confiables</li>
                <li>• Los servicios básicos que ofrecen los bancos</li>
                <li>• Cómo los bancos protegen nuestro dinero</li>
                <li>• Ayudar a Carlos a entender el mundo bancario</li>
              </ul>
            </div>
          </div>
        )
      }
    },

    // Step 3: Information about what is a bank
    {
      id: 'bank-definition-info',
      type: 'information' as const,
      title: '¿Qué es un Banco?',
      character: sol,
      content: {
        message: "¡Hola! Soy Sol y me encanta explicar cosas de manera clara. Un banco es como una caja fuerte gigante y súper segura donde las personas guardan su dinero. Te voy a explicar qué es y cómo funciona.",
        content: (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-4 bg-green-100 rounded-lg">
                <div className="text-4xl mb-2">🏦</div>
                <p className="text-sm font-medium">Institución Financiera</p>
                <p className="text-xs text-gray-600">Autorizada por el gobierno</p>
              </div>
              <div className="text-center p-4 bg-blue-100 rounded-lg">
                <div className="text-4xl mb-2">🛡️</div>
                <p className="text-sm font-medium">Protector del Dinero</p>
                <p className="text-xs text-gray-600">Seguro y confiable</p>
              </div>
              <div className="text-center p-4 bg-purple-100 rounded-lg">
                <div className="text-4xl mb-2">💼</div>
                <p className="text-sm font-medium">Servicios Financieros</p>
                <p className="text-xs text-gray-600">Cuentas, préstamos, etc.</p>
              </div>
            </div>
            <div className="bg-purple-100 p-4 rounded-lg">
              <p className="text-sm text-purple-800">
                <strong>Un banco es:</strong> Una institución financiera autorizada que guarda dinero de forma segura y ofrece servicios financieros como cuentas de ahorro, préstamos y más.
              </p>
            </div>
          </div>
        )
      }
    },

    // Step 4: Activity - Bank recognition
    {
      id: 'bank-recognition-activity',
      type: 'activity' as const,
      title: '¿Qué es un Banco?',
      character: lucas,
      points: 20,
      content: {
        type: 'question',
        description: 'Ayuda a Carlos a entender qué es un banco',
        question: "¿Cuál de estas opciones describe mejor qué es un banco?",
        options: [
          "Una institución financiera autorizada que guarda dinero de forma segura y ofrece servicios financieros",
          "Un lugar donde solo los adultos pueden ir",
          "Una tienda donde se vende dinero",
          "Un lugar donde se fabrica dinero"
        ],
        correct: 0,
        feedback: "¡Excelente! Un banco es exactamente eso: una institución financiera autorizada que guarda dinero de forma segura y ofrece servicios financieros."
      }
    },

    // Step 5: Comment after activity
    {
      id: 'bank-recognition-comment',
      type: 'comment' as const,
      title: '¡Perfecto!',
      character: sol,
      content: {
        message: "¡Muy bien! Ya entiendes qué es un banco. Ahora vamos a ver por qué los bancos son tan importantes y seguros.",
        content: (
          <div className="bg-green-100 p-4 rounded-lg">
            <p className="text-sm text-green-800">
              <strong>Recuerda:</strong> Los bancos son instituciones autorizadas y reguladas por el gobierno para proteger tu dinero.
            </p>
          </div>
        )
      }
    },

    // Step 6: Information about bank functions
    {
      id: 'bank-functions-info',
      type: 'information' as const,
      title: 'Funciones Principales de un Banco',
      character: maestroDinero,
      content: {
        message: "Ahora vamos a explorar las funciones principales que tiene un banco. Es como un centro comercial del dinero con muchos servicios útiles.",
        content: (
          <div className="space-y-4">
            <div className="bg-gradient-to-r from-green-50 to-blue-50 p-4 rounded-lg border border-green-200">
              <h3 className="font-bold text-green-800 mb-3">🏦 Funciones Principales</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-semibold text-green-700 mb-2">💰 Guardar Dinero</h4>
                  <ul className="text-sm text-green-600 space-y-1">
                    <li>• Cuentas de ahorro</li>
                    <li>• Cuentas corrientes</li>
                    <li>• Cajas de seguridad</li>
                    <li>• Protección del dinero</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold text-blue-700 mb-2">💳 Servicios Financieros</h4>
                  <ul className="text-sm text-blue-600 space-y-1">
                    <li>• Tarjetas de débito y crédito</li>
                    <li>• Transferencias de dinero</li>
                    <li>• Pagos de servicios</li>
                    <li>• Préstamos</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold text-purple-700 mb-2">📈 Hacer Crecer el Dinero</h4>
                  <ul className="text-sm text-purple-600 space-y-1">
                    <li>• Intereses en ahorros</li>
                    <li>• Inversiones</li>
                    <li>• Certificados de depósito</li>
                    <li>• Fondos de inversión</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold text-orange-700 mb-2">🛡️ Seguridad</h4>
                  <ul className="text-sm text-orange-600 space-y-1">
                    <li>• Protección contra robos</li>
                    <li>• Seguro de depósitos</li>
                    <li>• Transacciones seguras</li>
                    <li>• Privacidad bancaria</li>
                  </ul>
                </div>
              </div>
            </div>
            <div className="bg-purple-100 p-4 rounded-lg">
              <p className="text-sm text-purple-800">
                <strong>Los bancos son centros financieros:</strong> Ofrecen múltiples servicios para ayudarte a manejar, proteger y hacer crecer tu dinero.
              </p>
            </div>
          </div>
        )
      }
    },

    // Step 7: Activity - Bank functions
    {
      id: 'bank-functions-activity',
      type: 'activity' as const,
      title: 'Funciones del Banco',
      character: lucas,
      points: 25,
      content: {
        type: 'question',
        description: 'Ayuda a Carlos a identificar las funciones principales de un banco',
        question: "¿Cuál es la función más importante de un banco?",
        options: [
          "Guardar dinero de forma segura y ofrecer servicios financieros",
          "Solo prestar dinero a las personas",
          "Imprimir billetes y monedas",
          "Vender productos como una tienda"
        ],
        correct: 0,
        feedback: "¡Exacto! La función más importante de un banco es guardar dinero de forma segura y ofrecer servicios financieros a sus clientes."
      }
    },

    // Step 8: Comment after functions
    {
      id: 'functions-comment',
      type: 'comment' as const,
      title: '¡Excelente Comprensión!',
      character: sol,
      content: {
        message: "¡Perfecto! Ya entiendes las funciones principales de un banco. Ahora vamos a ver por qué los bancos son tan seguros y confiables.",
        content: (
          <div className="bg-orange-100 p-4 rounded-lg">
            <p className="text-sm text-orange-800">
              <strong>Próximo paso:</strong> Vamos a explorar la seguridad bancaria y por qué puedes confiar en los bancos.
            </p>
          </div>
        )
      }
    },

    // Step 9: Information about bank security
    {
      id: 'bank-security-info',
      type: 'information' as const,
      title: '¿Por Qué los Bancos son Seguros?',
      character: maestroDinero,
      content: {
        message: "Ahora vamos a ver por qué los bancos son tan seguros y por qué puedes confiar en ellos con tu dinero. Es como tener un guardaespaldas súper poderoso para tu dinero.",
        content: (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                <h4 className="font-bold text-green-800 mb-2">🛡️ Medidas de Seguridad</h4>
                <ul className="text-sm text-green-700 space-y-1">
                  <li>• <strong>Regulación gubernamental:</strong> Supervisados por autoridades</li>
                  <li>• <strong>Seguro de depósitos:</strong> Tu dinero está protegido</li>
                  <li>• <strong>Seguridad física:</strong> Cajas fuertes y alarmas</li>
                  <li>• <strong>Seguridad digital:</strong> Encriptación y protección cibernética</li>
                  <li>• <strong>Auditorías regulares:</strong> Verificaciones constantes</li>
                </ul>
              </div>
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <h4 className="font-bold text-blue-800 mb-2">🔒 Protecciones Específicas</h4>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li>• <strong>IPAB:</strong> Instituto para la Protección al Ahorro Bancario</li>
                  <li>• <strong>CONDUSEF:</strong> Protección al usuario financiero</li>
                  <li>• <strong>BANXICO:</strong> Supervisión del Banco de México</li>
                  <li>• <strong>Leyes bancarias:</strong> Marco legal de protección</li>
                  <li>• <strong>Reservas bancarias:</strong> Fondos de respaldo</li>
                </ul>
              </div>
            </div>
            <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
              <h4 className="font-bold text-yellow-800 mb-2">💡 ¿Por Qué Confiar?</h4>
              <ul className="text-sm text-yellow-700 space-y-1">
                <li>• <strong>Historia probada:</strong> Los bancos han existido por siglos</li>
                <li>• <strong>Regulación estricta:</strong> Múltiples niveles de supervisión</li>
                <li>• <strong>Transparencia:</strong> Información pública disponible</li>
                <li>• <strong>Responsabilidad:</strong> Los bancos responden por tu dinero</li>
              </ul>
            </div>
            <div className="bg-purple-100 p-4 rounded-lg">
              <p className="text-sm text-purple-800">
                <strong>Los bancos son como fortalezas:</strong> Tienen múltiples capas de seguridad para proteger tu dinero.
              </p>
            </div>
          </div>
        )
      }
    },

    // Step 10: Activity - Bank security
    {
      id: 'bank-security-activity',
      type: 'activity' as const,
      title: 'Seguridad Bancaria',
      character: lucas,
      points: 30,
      content: {
        type: 'question',
        description: 'Ayuda a Carlos a entender por qué los bancos son seguros',
        question: "¿Cuál es la razón principal por la que puedes confiar en un banco con tu dinero?",
        options: [
          "Están regulados por el gobierno y tienen múltiples medidas de seguridad",
          "Porque son edificios grandes y bonitos",
          "Porque solo los adultos pueden usar bancos",
          "Porque imprimen dinero"
        ],
        correct: 0,
        feedback: "¡Correcto! Los bancos son confiables porque están regulados por el gobierno y tienen múltiples medidas de seguridad para proteger tu dinero."
      }
    },

    // Step 11: Comment after security
    {
      id: 'security-comment',
      type: 'comment' as const,
      title: '¡Buen Trabajo!',
      character: sol,
      content: {
        message: "¡Excelente! Ya entiendes por qué los bancos son seguros. Ahora vamos a ver los servicios básicos que ofrecen los bancos.",
        content: (
          <div className="bg-blue-100 p-4 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>Vamos a explorar:</strong> Los servicios que Carlos puede usar en su banco.
            </p>
          </div>
        )
      }
    },

    // Step 12: Information about bank services
    {
      id: 'bank-services-info',
      type: 'information' as const,
      title: 'Servicios Básicos del Banco',
      character: maestroDinero,
      content: {
        message: "Ahora vamos a ver los servicios básicos que ofrecen los bancos. Es como un menú de opciones para manejar tu dinero.",
        content: (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                <h4 className="font-bold text-green-800 mb-2">💰 Cuentas Bancarias</h4>
                <ul className="text-sm text-green-700 space-y-2">
                  <li>• <strong>Cuenta de ahorro:</strong> Para guardar dinero y ganar intereses</li>
                  <li>• <strong>Cuenta corriente:</strong> Para gastos diarios y pagos</li>
                  <li>• <strong>Cuenta para jóvenes:</strong> Diseñada específicamente para adolescentes</li>
                  <li>• <strong>Cuenta digital:</strong> Manejo desde tu teléfono</li>
                </ul>
              </div>
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <h4 className="font-bold text-blue-800 mb-2">💳 Tarjetas y Pagos</h4>
                <ul className="text-sm text-blue-700 space-y-2">
                  <li>• <strong>Tarjeta de débito:</strong> Usar tu dinero sin efectivo</li>
                  <li>• <strong>Transferencias:</strong> Enviar dinero a otros</li>
                  <li>• <strong>Pagos en línea:</strong> Pagar servicios desde casa</li>
                  <li>• <strong>Banca móvil:</strong> Manejar tu cuenta desde tu teléfono</li>
                </ul>
              </div>
              <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                <h4 className="font-bold text-purple-800 mb-2">📈 Crecimiento del Dinero</h4>
                <ul className="text-sm text-purple-700 space-y-2">
                  <li>• <strong>Intereses:</strong> Tu dinero crece con el tiempo</li>
                  <li>• <strong>Inversiones:</strong> Opciones para hacer crecer tu dinero</li>
                  <li>• <strong>Metas de ahorro:</strong> Programas para alcanzar objetivos</li>
                  <li>• <strong>Educación financiera:</strong> Recursos para aprender</li>
                </ul>
              </div>
              <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
                <h4 className="font-bold text-orange-800 mb-2">🛡️ Seguridad y Protección</h4>
                <ul className="text-sm text-orange-700 space-y-2">
                  <li>• <strong>Seguro de depósitos:</strong> Protección automática</li>
                  <li>• <strong>Fraude:</strong> Protección contra robos</li>
                  <li>• <strong>Privacidad:</strong> Tu información está segura</li>
                  <li>• <strong>Soporte:</strong> Ayuda cuando la necesites</li>
                </ul>
              </div>
            </div>
            <div className="bg-purple-100 p-4 rounded-lg">
              <p className="text-sm text-purple-800">
                <strong>Los bancos ofrecen soluciones completas:</strong> Desde guardar dinero hasta hacerlo crecer, todo en un solo lugar.
              </p>
            </div>
          </div>
        )
      }
    },

    // Step 13: Activity - Bank services
    {
      id: 'bank-services-activity',
      type: 'activity' as const,
      title: 'Servicios del Banco',
      character: lucas,
      points: 25,
      content: {
        type: 'question',
        description: 'Ayuda a Carlos a identificar los servicios básicos de un banco',
        question: "Carlos quiere guardar su dinero de forma segura y poder usarlo cuando lo necesite. ¿Qué servicio bancario es el más apropiado para él?",
        options: [
          "Una cuenta de ahorro (guarda dinero de forma segura y puede retirarlo cuando quiera)",
          "Un préstamo (pedir dinero prestado al banco)",
          "Una tarjeta de crédito (gastar dinero que no tiene)",
          "Una caja de seguridad (solo para joyas y documentos)"
        ],
        correct: 0,
        feedback: "¡Excelente elección! Una cuenta de ahorro es perfecta para Carlos: guarda su dinero de forma segura y puede retirarlo cuando lo necesite."
      }
    },

    // Step 14: Comment after services
    {
      id: 'services-comment',
      type: 'comment' as const,
      title: '¡Buena Elección!',
      character: sol,
      content: {
        message: "¡Perfecto! Carlos ya sabe qué servicio necesita. Ahora vamos a ver cómo los bancos protegen específicamente el dinero de los jóvenes.",
        content: (
          <div className="bg-green-100 p-4 rounded-lg">
            <p className="text-sm text-green-800">
              <strong>Vamos a explorar:</strong> Las protecciones específicas para cuentas de jóvenes.
            </p>
          </div>
        )
      }
    },

    // Step 15: Information about youth banking
    {
      id: 'youth-banking-info',
      type: 'information' as const,
      title: 'Bancos y Jóvenes',
      character: maestroDinero,
      content: {
        message: "Ahora vamos a ver cómo los bancos se adaptan específicamente a las necesidades de los jóvenes como Carlos. Los bancos tienen servicios especiales para adolescentes.",
        content: (
          <div className="space-y-4">
            <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
              <h3 className="font-bold text-yellow-800 mb-3">👦 Servicios para Jóvenes</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-semibold text-yellow-700 mb-2">🎯 Cuentas Especiales</h4>
                  <ul className="text-sm text-yellow-600 space-y-1">
                    <li>• Sin comisiones mensuales</li>
                    <li>• Depósitos mínimos bajos</li>
                    <li>• Intereses especiales</li>
                    <li>• Sin penalizaciones</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold text-blue-700 mb-2">📱 Tecnología</h4>
                  <ul className="text-sm text-blue-600 space-y-1">
                    <li>• Apps fáciles de usar</li>
                    <li>• Notificaciones en tiempo real</li>
                    <li>• Controles parentales</li>
                    <li>• Educación financiera</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold text-green-700 mb-2">🛡️ Protecciones</h4>
                  <ul className="text-sm text-green-600 space-y-1">
                    <li>• Límites de gasto</li>
                    <li>• Alertas de seguridad</li>
                    <li>• Bloqueo de tarjeta</li>
                    <li>• Supervisión parental</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold text-purple-700 mb-2">🎓 Educación</h4>
                  <ul className="text-sm text-purple-600 space-y-1">
                    <li>• Recursos educativos</li>
                    <li>• Juegos financieros</li>
                    <li>• Consejos personalizados</li>
                    <li>• Metas de ahorro</li>
                  </ul>
                </div>
              </div>
            </div>
            <div className="bg-green-100 p-4 rounded-lg">
              <p className="text-sm text-green-800">
                <strong>Los bancos se adaptan a los jóvenes:</strong> Ofrecen servicios especiales que son seguros, educativos y fáciles de usar.
              </p>
            </div>
          </div>
        )
      }
    },

    // Step 16: Activity - Youth banking
    {
      id: 'youth-banking-activity',
      type: 'activity' as const,
      title: 'Bancos para Jóvenes',
      character: lucas,
      points: 35,
      content: {
        type: 'question',
        description: 'Ayuda a Carlos a entender los beneficios de las cuentas para jóvenes',
        question: "¿Cuál es la ventaja principal de las cuentas bancarias diseñadas para jóvenes?",
        options: [
          "Están diseñadas específicamente para las necesidades de adolescentes con menos comisiones y más educación",
          "Solo permiten ahorrar dinero, no gastarlo",
          "Son más caras que las cuentas normales",
          "Solo están disponibles para adultos jóvenes"
        ],
        correct: 0,
        feedback: "¡Exacto! Las cuentas para jóvenes están diseñadas específicamente para adolescentes con menos comisiones, más educación financiera y controles de seguridad apropiados."
      }
    },

    // Step 17: Comment after youth banking
    {
      id: 'youth-banking-comment',
      type: 'comment' as const,
      title: '¡Análisis Excelente!',
      character: sol,
      content: {
        message: "¡Perfecto! Carlos ahora entiende cómo los bancos pueden ayudarlo. Vamos a darle algunos consejos finales para su primera visita al banco.",
        content: (
          <div className="bg-blue-100 p-4 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>Próximo paso:</strong> Consejos para la primera visita de Carlos al banco.
            </p>
          </div>
        )
      }
    },

    // Step 18: Information about first bank visit
    {
      id: 'first-bank-visit-info',
      type: 'information' as const,
      title: 'Consejos para tu Primera Visita al Banco',
      character: maestroDinero,
      content: {
        message: "Ahora te voy a dar algunos consejos súper útiles para cuando vayas al banco por primera vez, como Carlos.",
        content: (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <h4 className="font-bold text-blue-800 mb-2">📋 Antes de Ir</h4>
                <ul className="text-sm text-blue-700 space-y-2">
                  <li>• <strong>Investiga:</strong> Compara diferentes bancos</li>
                  <li>• <strong>Documentos:</strong> Lleva identificación válida</li>
                  <li>• <strong>Preguntas:</strong> Prepara una lista de dudas</li>
                  <li>• <strong>Acompañante:</strong> Ve con un adulto responsable</li>
                </ul>
              </div>
              <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                <h4 className="font-bold text-green-800 mb-2">🏦 En el Banco</h4>
                <ul className="text-sm text-green-700 space-y-2">
                  <li>• <strong>Pregunta todo:</strong> No tengas miedo de preguntar</li>
                  <li>• <strong>Lee cuidadosamente:</strong> Revisa todos los documentos</li>
                  <li>• <strong>Comisiones:</strong> Pregunta sobre cargos ocultos</li>
                  <li>• <strong>Servicios:</strong> Conoce todas las opciones disponibles</li>
                </ul>
              </div>
            </div>
            <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
              <h4 className="font-bold text-yellow-800 mb-2">🎯 Preguntas Importantes</h4>
              <ul className="text-sm text-yellow-700 space-y-1">
                <li>• <strong>¿Hay comisiones mensuales?</strong> Evita cargos innecesarios</li>
                <li>• <strong>¿Cuál es el depósito mínimo?</strong> Asegúrate de poder cumplirlo</li>
                <li>• <strong>¿Qué servicios incluye?</strong> Conoce todo lo que obtienes</li>
                <li>• <strong>¿Cómo funciona la banca en línea?</strong> Aprende a usar la tecnología</li>
                <li>• <strong>¿Hay límites de retiro?</strong> Entiende las restricciones</li>
              </ul>
            </div>
            <div className="bg-purple-100 p-4 rounded-lg">
              <p className="text-sm text-purple-800">
                <strong>Recuerda:</strong> Tu primera visita al banco es el inicio de una relación financiera importante. ¡Tómate tu tiempo para hacerlo bien!
              </p>
            </div>
          </div>
        )
      }
    },

    // Step 19: Final activity - Bank visit preparation
    {
      id: 'final-bank-activity',
      type: 'activity' as const,
      title: 'Prepara tu Visita al Banco',
      character: lucas,
      points: 40,
      content: {
        type: 'question',
        description: 'Ayuda a Carlos a prepararse para su primera visita al banco',
        question: "Carlos va a ir al banco por primera vez. ¿Cuál es la cosa más importante que debe hacer antes de ir?",
        options: [
          "Investigar diferentes bancos y preparar una lista de preguntas",
          "Llevar todo su dinero en efectivo",
          "Ir solo para ser independiente",
          "Firmar todos los documentos sin leerlos"
        ],
        correct: 0,
        feedback: "¡Perfecto! Investigar diferentes bancos y preparar preguntas es lo más importante. Esto le ayudará a tomar la mejor decisión."
      }
    },

    // Step 20: Final reflection
    {
      id: 'final-reflection',
      type: 'comment' as const,
      title: '¡Lección Completada!',
      character: maestroDinero,
      content: {
        message: "¡Felicitaciones! Has completado tu lección sobre bancos. Ahora entiendes cómo los bancos pueden ayudarte a manejar tu dinero de forma segura y profesional.",
        content: (
          <div className="space-y-4">
            <div className="bg-gradient-to-r from-green-100 to-blue-100 p-4 rounded-lg">
              <h3 className="font-bold text-green-800 mb-2">Lo que aprendiste hoy:</h3>
              <ul className="space-y-1 text-sm text-green-700">
                <li>✅ Qué es un banco y sus funciones principales</li>
                <li>✅ Por qué los bancos son seguros y confiables</li>
                <li>✅ Los servicios básicos que ofrecen los bancos</li>
                <li>✅ Servicios especiales para jóvenes</li>
                <li>✅ Cómo prepararte para tu primera visita al banco</li>
                <li>✅ Ayudar a Carlos a entender el mundo bancario</li>
              </ul>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-600">
                ¡Ahora puedes tomar decisiones informadas sobre servicios bancarios y ayudar a otros como Carlos!
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
        question: "¿Qué fue lo más interesante que aprendiste sobre los bancos hoy?",
        message: "Antes de terminar, tómate un momento para pensar en lo que aprendiste. ¿Qué te pareció más interesante o sorprendente sobre los bancos?",
        rewards: {
          points: 50,
          badges: ["Experto Bancario", "Ayudante de Carlos"],
          stickers: ["🏦", "🛡️", "💰", "⭐"]
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

export default Lesson2_1_WhatIsBank;
