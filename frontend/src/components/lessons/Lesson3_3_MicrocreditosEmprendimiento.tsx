import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Trophy, 
  Star, 
  Award, 
  CheckCircle,
  PlayCircle,
  Clock,
  ArrowLeft,
  Home,
  Lightbulb,
  DollarSign,
  TrendingUp,
  Users,
  Calculator,
  Target
} from 'lucide-react';

// Importar personajes (asumiendo que están definidos en otro archivo)
const characters = {
  lucas: { name: "Lucas", avatar: "👦", color: "blue" },
  sol: { name: "Sol", avatar: "👧", color: "yellow" },
  maestro_dinero: { name: "Maestro Dinero", avatar: "🎓", color: "green" }
};

interface Lesson3_3Props {
  onComplete: (score: number) => void;
  onExit: () => void;
}

const Lesson3_3_MicrocreditosEmprendimiento: React.FC<Lesson3_3Props> = ({ onComplete, onExit }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [score, setScore] = useState(0);
  const [showCelebration, setShowCelebration] = useState(false);
  const [userAnswers, setUserAnswers] = useState<{ [key: string]: number }>({});

  const lucas = characters.lucas;
  const sol = characters.sol;
  const maestroDinero = characters.maestro_dinero;

  const lessonSteps = [
    // Step 1: Hook/Introduction
    {
      id: 'hook',
      type: 'information' as const,
      title: 'La Idea de Negocio de Maya',
      character: lucas,
      content: {
        message: "¡Hola! Soy Maya, tengo 12 años y tengo una idea genial: quiero hacer pulseras artesanales y venderlas en mi escuela. Mi mamá dice que necesito dinero para comprar materiales, pero no tengo suficiente ahorrado. ¿Existe alguna forma de conseguir dinero para empezar mi negocio?",
        content: (
          <div className="text-center space-y-4">
            <div className="text-6xl">💡💍💰</div>
            <p className="text-lg font-medium text-gray-700">
              Maya tiene una idea de negocio pero necesita financiamiento
            </p>
            <div className="bg-purple-100 p-4 rounded-lg">
              <p className="text-sm text-purple-800">
                <strong>Desafío:</strong> ¿Cómo puede Maya conseguir dinero para empezar su emprendimiento?
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
      title: 'Objetivo de la Lección',
      character: maestroDinero,
      content: {
        message: "En esta lección aprenderás sobre los microcréditos y cómo pueden ayudar a jóvenes emprendedores como Maya a hacer realidad sus ideas de negocio.",
        content: (
          <div className="bg-green-100 p-4 rounded-lg space-y-3">
            <h3 className="font-bold text-green-800">Lo que aprenderás:</h3>
            <ul className="text-sm text-green-700 space-y-1">
              <li>• Qué son los microcréditos</li>
              <li>• Cómo funcionan para jóvenes emprendedores</li>
              <li>• Ventajas y responsabilidades de pedir dinero prestado</li>
              <li>• Cómo planificar un negocio pequeño</li>
            </ul>
          </div>
        )
      }
    },

    // Step 3: What are microcredits
    {
      id: 'what-are-microcredits',
      type: 'information' as const,
      title: '¿Qué son los Microcréditos?',
      character: maestroDinero,
      content: {
        message: "Los microcréditos son préstamos pequeños que se otorgan a personas que quieren empezar un negocio pequeño, especialmente cuando no tienen acceso a préstamos tradicionales de los bancos.",
        content: (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-blue-100 p-4 rounded-lg">
                <h4 className="font-bold text-blue-800 mb-2">Características:</h4>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li>• Cantidades pequeñas de dinero</li>
                  <li>• Para negocios pequeños</li>
                  <li>• Proceso más simple</li>
                  <li>• Ayuda a emprendedores</li>
                </ul>
              </div>
              <div className="bg-yellow-100 p-4 rounded-lg">
                <h4 className="font-bold text-yellow-800 mb-2">Ejemplo:</h4>
                <p className="text-sm text-yellow-700">
                  Maya podría pedir $500 pesos para comprar hilos, cuentas y herramientas para hacer pulseras.
                </p>
              </div>
            </div>
          </div>
        )
      }
    },

    // Step 4: How microcredits work
    {
      id: 'how-microcredits-work',
      type: 'information' as const,
      title: '¿Cómo Funcionan los Microcréditos?',
      character: sol,
      content: {
        message: "Te explico el proceso paso a paso de cómo Maya podría conseguir un microcrédito para su negocio de pulseras.",
        content: (
          <div className="space-y-4">
            <div className="bg-gradient-to-r from-purple-100 to-pink-100 p-4 rounded-lg">
              <h4 className="font-bold text-purple-800 mb-3">Proceso del Microcrédito:</h4>
              <div className="space-y-3">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-purple-500 text-white rounded-full flex items-center justify-center text-sm font-bold">1</div>
                  <p className="text-sm text-purple-700">Maya presenta su idea de negocio</p>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-purple-500 text-white rounded-full flex items-center justify-center text-sm font-bold">2</div>
                  <p className="text-sm text-purple-700">Explica cómo va a usar el dinero</p>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-purple-500 text-white rounded-full flex items-center justify-center text-sm font-bold">3</div>
                  <p className="text-sm text-purple-700">Muestra cómo va a pagar el préstamo</p>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-purple-500 text-white rounded-full flex items-center justify-center text-sm font-bold">4</div>
                  <p className="text-sm text-purple-700">Recibe el dinero y empieza su negocio</p>
                </div>
              </div>
            </div>
          </div>
        )
      }
    },

    // Step 5: Activity - Business Plan
    {
      id: 'business-plan-activity',
      type: 'activity' as const,
      title: 'Plan de Negocio de Maya',
      character: lucas,
      points: 25,
      content: {
        type: 'question',
        description: 'Ayuda a Maya a completar su plan de negocio',
        question: "Maya quiere pedir $500 pesos para su negocio de pulseras. ¿Cuál es la mejor forma de explicar cómo va a usar este dinero?",
        options: [
          "Comprar materiales: hilos $200, cuentas $150, herramientas $100, publicidad $50",
          "Gastar todo en materiales sin planificar",
          "Usar el dinero para otras cosas además del negocio",
          "No explicar para qué necesita el dinero"
        ],
        correct: 0,
        feedback: "¡Excelente! Un buen plan de negocio detalla exactamente cómo se va a usar cada peso del préstamo."
      }
    },

    // Step 6: Responsibilities
    {
      id: 'responsibilities',
      type: 'information' as const,
      title: 'Responsabilidades del Microcrédito',
      character: maestroDinero,
      content: {
        message: "Pedir dinero prestado es una gran responsabilidad. Maya debe entender que tiene que devolver el dinero con intereses.",
        content: (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-red-100 p-4 rounded-lg">
                <h4 className="font-bold text-red-800 mb-2">Responsabilidades:</h4>
                <ul className="text-sm text-red-700 space-y-1">
                  <li>• Devolver el dinero prestado</li>
                  <li>• Pagar intereses</li>
                  <li>• Cumplir con los plazos</li>
                  <li>• Usar el dinero para el negocio</li>
                </ul>
              </div>
              <div className="bg-green-100 p-4 rounded-lg">
                <h4 className="font-bold text-green-800 mb-2">Ejemplo Maya:</h4>
                <p className="text-sm text-green-700">
                  Si pide $500 y debe pagar 10% de interés, tendrá que devolver $550 pesos en total.
                </p>
              </div>
            </div>
          </div>
        )
      }
    },

    // Step 7: Activity - Interest calculation
    {
      id: 'interest-calculation',
      type: 'activity' as const,
      title: 'Calculando Intereses',
      character: sol,
      points: 30,
      content: {
        type: 'question',
        description: 'Practica calculando intereses',
        question: "Maya pide prestados $300 pesos con un interés del 15%. ¿Cuánto dinero tendrá que devolver en total?",
        options: [
          "$345 pesos ($300 + $45 de interés)",
          "$300 pesos (sin interés)",
          "$450 pesos",
          "$315 pesos"
        ],
        correct: 0,
        feedback: "¡Correcto! $300 + (15% de $300) = $300 + $45 = $345 pesos total."
      }
    },

    // Step 8: Advantages and disadvantages
    {
      id: 'advantages-disadvantages',
      type: 'information' as const,
      title: 'Ventajas y Desventajas',
      character: lucas,
      content: {
        message: "Como todo en la vida, los microcréditos tienen ventajas y desventajas. Es importante conocerlas antes de decidir.",
        content: (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-green-100 p-4 rounded-lg">
                <h4 className="font-bold text-green-800 mb-2">✅ Ventajas:</h4>
                <ul className="text-sm text-green-700 space-y-1">
                  <li>• Te ayuda a empezar tu negocio</li>
                  <li>• Proceso más fácil que un banco</li>
                  <li>• Cantidades pequeñas</li>
                  <li>• Te enseña responsabilidad</li>
                </ul>
              </div>
              <div className="bg-orange-100 p-4 rounded-lg">
                <h4 className="font-bold text-orange-800 mb-2">⚠️ Desventajas:</h4>
                <ul className="text-sm text-orange-700 space-y-1">
                  <li>• Tienes que pagar intereses</li>
                  <li>• Es una deuda que debes pagar</li>
                  <li>• Si no pagas, puede afectar tu historial</li>
                  <li>• Requiere planificación cuidadosa</li>
                </ul>
              </div>
            </div>
          </div>
        )
      }
    },

    // Step 9: Activity - Decision making
    {
      id: 'decision-making',
      type: 'activity' as const,
      title: '¿Debería Maya Pedir el Microcrédito?',
      character: maestroDinero,
      points: 35,
      content: {
        type: 'question',
        description: 'Analiza si Maya debería pedir el microcrédito',
        question: "Maya ha calculado que puede vender 20 pulseras al mes a $30 pesos cada una. Sus costos son $15 pesos por pulsera. ¿Debería pedir el microcrédito de $500?",
        options: [
          "Sí, porque ganará $300 al mes y puede pagar el préstamo",
          "No, porque es muy arriesgado",
          "Sí, sin importar los números",
          "No, porque los microcréditos son malos"
        ],
        correct: 0,
        feedback: "¡Excelente análisis! Maya ganará $300 al mes (20 × $15 de ganancia), así que puede pagar el préstamo y aún le sobra dinero."
      }
    },

    // Step 10: Alternative funding
    {
      id: 'alternative-funding',
      type: 'information' as const,
      title: 'Otras Formas de Conseguir Dinero',
      character: sol,
      content: {
        message: "Los microcréditos no son la única opción. Hay otras formas de conseguir dinero para un negocio.",
        content: (
          <div className="space-y-4">
            <div className="bg-blue-100 p-4 rounded-lg">
              <h4 className="font-bold text-blue-800 mb-3">Alternativas al Microcrédito:</h4>
              <div className="space-y-3">
                <div className="flex items-start space-x-3">
                  <div className="text-2xl">💰</div>
                  <div>
                    <p className="font-medium text-blue-800">Ahorro personal</p>
                    <p className="text-sm text-blue-700">Usar dinero que ya tienes ahorrado</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="text-2xl">👨‍👩‍👧‍👦</div>
                  <div>
                    <p className="font-medium text-blue-800">Préstamo familiar</p>
                    <p className="text-sm text-blue-700">Pedir dinero a familiares</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="text-2xl">🤝</div>
                  <div>
                    <p className="font-medium text-blue-800">Socio inversionista</p>
                    <p className="text-sm text-blue-700">Alguien que invierta en tu negocio</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="text-2xl">🎯</div>
                  <div>
                    <p className="font-medium text-blue-800">Venta anticipada</p>
                    <p className="text-sm text-blue-700">Vender productos antes de hacerlos</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )
      }
    },

    // Step 11: Final activity
    {
      id: 'final-activity',
      type: 'activity' as const,
      title: 'Plan Completo de Maya',
      character: lucas,
      points: 40,
      content: {
        type: 'question',
        description: 'Ayuda a Maya a tomar la mejor decisión',
        question: "Después de analizar todas las opciones, ¿cuál es la mejor estrategia para Maya?",
        options: [
          "Empezar con ahorro personal y pedir microcrédito solo si es necesario",
          "Pedir microcrédito inmediatamente sin pensar",
          "No hacer nada y abandonar la idea",
          "Pedir prestado a todos sus familiares"
        ],
        correct: 0,
        feedback: "¡Perfecto! Es mejor empezar con lo que tienes y usar microcréditos solo cuando realmente los necesites y tengas un plan sólido."
      }
    },

    // Step 12: Conclusion
    {
      id: 'conclusion',
      type: 'information' as const,
      title: '¡Felicidades! Has Aprendido sobre Microcréditos',
      character: maestroDinero,
      content: {
        message: "Has aprendido conceptos importantes sobre financiamiento para emprendedores jóvenes. Recuerda que pedir dinero prestado es una responsabilidad seria que requiere planificación cuidadosa.",
        content: (
          <div className="text-center space-y-4">
            <div className="text-6xl">🎉💡💰</div>
            <div className="bg-green-100 p-4 rounded-lg">
              <h3 className="font-bold text-green-800 mb-2">Lo que has aprendido:</h3>
              <ul className="text-sm text-green-700 space-y-1 text-left">
                <li>• Qué son los microcréditos y cómo funcionan</li>
                <li>• Cómo calcular intereses</li>
                <li>• Las responsabilidades de pedir dinero prestado</li>
                <li>• Alternativas al microcrédito</li>
                <li>• Cómo tomar decisiones financieras inteligentes</li>
              </ul>
            </div>
            <p className="text-lg font-medium text-gray-700">
              ¡Ahora estás listo para ser un emprendedor financieramente inteligente!
            </p>
          </div>
        )
      }
    }
  ];

  const handleAnswer = (questionId: string, answerIndex: number, isCorrect: boolean, points: number) => {
    setUserAnswers(prev => ({ ...prev, [questionId]: answerIndex }));
    if (isCorrect) {
      setScore(prev => prev + points);
    }
  };

  const handleNext = () => {
    if (currentStep < lessonSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      setShowCelebration(true);
      setTimeout(() => {
        onComplete(score);
      }, 2000);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const currentStepData = lessonSteps[currentStep];
  const progress = ((currentStep + 1) / lessonSteps.length) * 100;

  if (showCelebration) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-400 via-pink-500 to-red-500 flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="p-8">
            <div className="text-6xl mb-4">🎉</div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">¡Lección Completada!</h2>
            <p className="text-gray-600 mb-4">Has aprendido sobre microcréditos y emprendimiento</p>
            <div className="bg-yellow-100 p-4 rounded-lg mb-4">
              <p className="text-lg font-bold text-yellow-800">Puntuación: {score} puntos</p>
            </div>
            <div className="flex justify-center space-x-2">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="w-6 h-6 text-yellow-400 fill-current" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button variant="ghost" size="sm" onClick={onExit}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Salir
              </Button>
              <div>
                <h1 className="text-xl font-bold text-gray-800">Microcréditos y Emprendimiento</h1>
                <p className="text-sm text-gray-600">Lección 3.3 - Para jóvenes emprendedores</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <Badge variant="secondary" className="flex items-center space-x-1">
                <Trophy className="w-3 h-3" />
                <span>{score} pts</span>
              </Badge>
              <Badge variant="outline" className="flex items-center space-x-1">
                <Clock className="w-3 h-3" />
                <span>45 min</span>
              </Badge>
            </div>
          </div>
          <div className="mt-4">
            <Progress value={progress} className="h-2" />
            <p className="text-xs text-gray-500 mt-1">
              Paso {currentStep + 1} de {lessonSteps.length}
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center space-x-3">
              <div className="text-3xl">{currentStepData.character.avatar}</div>
              <div>
                <CardTitle className="text-xl">{currentStepData.title}</CardTitle>
                <p className="text-sm text-gray-600">
                  {currentStepData.character.name}
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <p className="text-lg text-gray-700 leading-relaxed">
                {currentStepData.content.message}
              </p>
              
              {currentStepData.content.content && (
                <div className="mt-6">
                  {currentStepData.content.content}
                </div>
              )}

              {currentStepData.type === 'activity' && currentStepData.content.type === 'question' && (
                <div className="bg-blue-50 p-6 rounded-lg space-y-4">
                  <div className="flex items-center space-x-2">
                    <Target className="w-5 h-5 text-blue-600" />
                    <span className="font-medium text-blue-800">
                      {currentStepData.content.description}
                    </span>
                    <Badge variant="secondary">
                      {currentStepData.points} puntos
                    </Badge>
                  </div>
                  
                  <p className="text-lg font-medium text-gray-800">
                    {currentStepData.content.question}
                  </p>
                  
                  <div className="space-y-3">
                    {currentStepData.content.options.map((option, index) => (
                      <Button
                        key={index}
                        variant={userAnswers[currentStepData.id] === index ? "default" : "outline"}
                        className="w-full justify-start text-left h-auto p-4"
                        onClick={() => {
                          const isCorrect = index === currentStepData.content.correct;
                          handleAnswer(currentStepData.id, index, isCorrect, currentStepData.points);
                        }}
                      >
                        <div className="flex items-center space-x-3">
                          <div className="w-6 h-6 rounded-full border-2 border-gray-300 flex items-center justify-center text-xs font-bold">
                            {String.fromCharCode(65 + index)}
                          </div>
                          <span>{option}</span>
                        </div>
                      </Button>
                    ))}
                  </div>

                  {userAnswers[currentStepData.id] !== undefined && (
                    <div className={`p-4 rounded-lg ${
                      userAnswers[currentStepData.id] === currentStepData.content.correct 
                        ? 'bg-green-100 border border-green-300' 
                        : 'bg-red-100 border border-red-300'
                    }`}>
                      <div className="flex items-center space-x-2">
                        {userAnswers[currentStepData.id] === currentStepData.content.correct ? (
                          <CheckCircle className="w-5 h-5 text-green-600" />
                        ) : (
                          <div className="w-5 h-5 rounded-full bg-red-600 flex items-center justify-center">
                            <span className="text-white text-xs">✕</span>
                          </div>
                        )}
                        <span className={`font-medium ${
                          userAnswers[currentStepData.id] === currentStepData.content.correct 
                            ? 'text-green-800' 
                            : 'text-red-800'
                        }`}>
                          {userAnswers[currentStepData.id] === currentStepData.content.correct 
                            ? '¡Correcto!' 
                            : 'Incorrecto'}
                        </span>
                      </div>
                      <p className={`text-sm mt-2 ${
                        userAnswers[currentStepData.id] === currentStepData.content.correct 
                          ? 'text-green-700' 
                          : 'text-red-700'
                      }`}>
                        {currentStepData.content.feedback}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Navigation */}
        <div className="flex justify-between">
          <Button 
            variant="outline" 
            onClick={handlePrevious}
            disabled={currentStep === 0}
          >
            Anterior
          </Button>
          
          <Button 
            onClick={handleNext}
            className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
          >
            {currentStep === lessonSteps.length - 1 ? 'Finalizar' : 'Siguiente'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Lesson3_3_MicrocreditosEmprendimiento;
