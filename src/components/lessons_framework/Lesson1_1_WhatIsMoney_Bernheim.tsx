import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  PairedTaskComponent, 
  PracticalTool, 
  CompetenceTracker,
  characters,
  PairedTask,
  BiasMetric,
  LessonProgress 
} from './BernheimFrameworkComponents';
import { Calculator, Target, CheckCircle, AlertCircle, BookOpen } from 'lucide-react';

interface Lesson1_1Props {
  onComplete: (score: number, progress: LessonProgress) => void;
  onExit: () => void;
}

const Lesson1_1_WhatIsMoney_Bernheim: React.FC<Lesson1_1Props> = ({ onComplete, onExit }) => {
  const [currentStage, setCurrentStage] = useState<'intervention' | 'valuation' | 'evaluation'>('intervention');
  const [biasHistory, setBiasHistory] = useState<number[]>([]);
  const [currentBias, setCurrentBias] = useState<number>(0);
  const [lessonProgress, setLessonProgress] = useState<LessonProgress>({
    conceptMastered: false,
    biasReduction: 0,
    completedTasks: [],
    timeSpent: 0
  });

  // ETAPA 1: INTERVENCIÓN EDUCATIVA - HERRAMIENTA PRÁCTICA
  const practicalTool = (
    <div className="space-y-4">
      <Card className="border-green-200">
        <CardHeader className="bg-green-50">
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Herramienta: Calculadora de Equivalencia Monetaria
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-green-100 p-4 rounded-lg">
            <h4 className="font-bold text-green-800 mb-2">Pasos para usar la herramienta:</h4>
            <ol className="list-decimal list-inside space-y-2 text-sm text-green-700">
              <li><strong>Identificar:</strong> Reconoce todas las monedas y billetes que tienes</li>
              <li><strong>Calcular:</strong> Suma el valor de cada moneda y billete</li>
              <li><strong>Comparar:</strong> Compara tu total con el precio del objeto</li>
              <li><strong>Decidir:</strong> Si tu total ≥ precio, tienes suficiente dinero</li>
            </ol>
          </div>
          
          <MoneyCalculator />
          
          <div className="bg-gray-100 p-3 rounded-lg">
            <p className="text-sm text-gray-700">
              <strong>Fórmula:</strong> Total de dinero ≥ Precio del objeto = ¿Puedes comprarlo?
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // ETAPA 2: DECISIONES DE VALUACIÓN - TAREAS PAREADAS
  const pairedTask: PairedTask = {
    id: 'money-valuation-task',
    complexProblem: {
      question: "Lucas quiere comprar un juguete que cuesta $50. Él tiene: 2 billetes de $20, 1 moneda de $5, 3 monedas de $1, y 1 moneda de $2. ¿Cuánto dinero tiene Lucas y puede comprar el juguete?",
      context: "Lucas está en la juguetería con su dinero. Necesita saber si puede comprar el juguete antes de ir a la caja.",
      correctAnswer: 50,
      explanation: "Lucas tiene: $20+$20+$5+$1+$1+$1+$2 = $50. Como $50 = $50, sí puede comprar el juguete."
    },
    transparentProblem: {
      question: "Si tienes exactamente $50 y un objeto cuesta $50, ¿puedes comprarlo?",
      context: "Problema equivalente pero con números simples.",
      correctAnswer: 50,
      explanation: "Si tienes $50 y algo cuesta $50, tienes exactamente lo suficiente para comprarlo."
    }
  };

  // ETAPA 3: EVALUACIÓN - MEDICIÓN DE COMPETENCIA DELIBERATIVA
  const handleTaskComplete = (complexAnswer: number, transparentAnswer: number, biasScore: number) => {
    const newBiasHistory = [...biasHistory, biasScore];
    setBiasHistory(newBiasHistory);
    setCurrentBias(biasScore);
    
    // Calcular reducción de sesgo
    const avgBias = newBiasHistory.reduce((a, b) => a + Math.abs(b), 0) / newBiasHistory.length;
    const biasReduction = newBiasHistory.length > 1 ? 
      Math.abs(newBiasHistory[0]) - Math.abs(biasScore) : 0;

    const newProgress: LessonProgress = {
      conceptMastered: Math.abs(biasScore) <= 5, // Competencia si sesgo ≤ 5
      biasReduction: biasReduction,
      completedTasks: [...lessonProgress.completedTasks, 'money-valuation-task'],
      timeSpent: lessonProgress.timeSpent + 300 // 5 minutos estimados por tarea
    };

    setLessonProgress(newProgress);
    setCurrentStage('evaluation');
  };

  const handleComplete = () => {
    const finalScore = lessonProgress.conceptMastered ? 100 : 
      Math.max(0, 100 - Math.abs(currentBias) * 2);
    onComplete(finalScore, lessonProgress);
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <Card className="border-2 border-purple-200">
        <CardHeader className="bg-purple-50">
          <CardTitle className="flex items-center gap-2">
            <Target className="h-6 w-6" />
            LECCIÓN: Herramienta de Valuación Monetaria
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <Badge variant="outline" className="bg-blue-100">
              Edad: 8-12 años
            </Badge>
            <Badge variant="outline" className="bg-green-100">
              Duración: 15-20 minutos
            </Badge>
            <Badge variant="outline" className="bg-purple-100">
              Etapa: {currentStage === 'intervention' ? '1. Herramienta' : 
                      currentStage === 'valuation' ? '2. Práctica' : '3. Evaluación'}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* ETAPA 1: INTERVENCIÓN EDUCATIVA */}
      {currentStage === 'intervention' && (
        <div className="space-y-6">
          <Card className="border-blue-200">
            <CardHeader className="bg-blue-50">
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                1. CONCEPTO SUSTANTIVO: Calculadora de Equivalencia Monetaria
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-gray-700">
                Aprende a usar una herramienta práctica para determinar si tienes suficiente dinero 
                para comprar algo. Esta herramienta te ayuda a contar dinero de forma sistemática y 
                comparar con precios.
              </p>

              <PracticalTool
                title="Calculadora de Equivalencia Monetaria"
                description="Herramienta sistemática para contar dinero mixto y comparar con precios"
                tool={practicalTool}
                examples={[
                  {
                    input: { monedas: "2×$10, 1×$5", precio: "$25" },
                    output: { total: "$25", puedoComprar: "Sí" },
                    explanation: "2×$10 + 1×$5 = $25. Como $25 = $25, puedes comprar."
                  },
                  {
                    input: { monedas: "1×$20, 3×$1", precio: "$25" },
                    output: { total: "$23", puedoComprar: "No" },
                    explanation: "1×$20 + 3×$1 = $23. Como $23 < $25, no puedes comprar."
                  },
                  {
                    input: { monedas: "1×$50", precio: "$30" },
                    output: { total: "$50", puedoComprar: "Sí" },
                    explanation: "1×$50 = $50. Como $50 > $30, puedes comprar y te sobra dinero."
                  }
                ]}
              />

              <Button 
                onClick={() => setCurrentStage('valuation')}
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                Continuar a Práctica con Tareas Pareadas
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ETAPA 2: DECISIONES DE VALUACIÓN */}
      {currentStage === 'valuation' && (
        <div className="space-y-6">
          <Card className="border-orange-200">
            <CardHeader className="bg-orange-50">
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                2. PRÁCTICA CON RETROALIMENTACIÓN: Tareas Pareadas
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <p className="text-gray-700 mb-4">
                Ahora vas a practicar con dos problemas equivalentes. Usa la herramienta que acabas 
                de aprender para resolver ambos problemas de la forma más consistente posible.
              </p>
            </CardContent>
          </Card>

          <PairedTaskComponent
            task={pairedTask}
            onComplete={handleTaskComplete}
            showFeedback={true}
          />
        </div>
      )}

      {/* ETAPA 3: EVALUACIÓN */}
      {currentStage === 'evaluation' && (
        <div className="space-y-6">
          <Card className="border-green-200">
            <CardHeader className="bg-green-50">
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5" />
                3. EVALUACIÓN: Competencia Deliberativa
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <p className="text-gray-700 mb-4">
                Tu desempeño se mide por qué tan consistentes son tus respuestas entre problemas 
                complejos y simples. Menor diferencia = mayor competencia deliberativa.
              </p>
            </CardContent>
          </Card>

          <CompetenceTracker
            biasHistory={biasHistory}
            targetReduction={10}
            currentBias={currentBias}
          />

          {/* Métricas específicas al concepto */}
          <Card className="border-purple-200">
            <CardHeader className="bg-purple-50">
              <CardTitle>Métricas de Competencia en Valuación Monetaria</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-4 bg-blue-100 rounded-lg">
                  <p className="text-2xl font-bold text-blue-600">
                    {lessonProgress.conceptMastered ? 'SÍ' : 'NO'}
                  </p>
                  <p className="text-sm text-blue-800">Concepto Dominado</p>
                </div>
                <div className="text-center p-4 bg-green-100 rounded-lg">
                  <p className="text-2xl font-bold text-green-600">
                    {Math.abs(currentBias)} pts
                  </p>
                  <p className="text-sm text-green-800">Sesgo Métrico</p>
                </div>
              </div>

              {/* Interpretación del sesgo */}
              {Math.abs(currentBias) <= 5 && (
                <Alert className="border-green-200 bg-green-50">
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>¡Excelente competencia deliberativa!</strong> Tus respuestas son muy consistentes. 
                    Dominas la herramienta de valuación monetaria.
                  </AlertDescription>
                </Alert>
              )}

              {Math.abs(currentBias) > 5 && Math.abs(currentBias) <= 15 && (
                <Alert className="border-yellow-200 bg-yellow-50">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Competencia en desarrollo.</strong> Hay una pequeña diferencia en tus respuestas. 
                    Practica más con la herramienta sistemática.
                  </AlertDescription>
                </Alert>
              )}

              {Math.abs(currentBias) > 15 && (
                <Alert className="border-red-200 bg-red-50">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Necesita más práctica.</strong> Gran diferencia entre tus respuestas complejas y simples. 
                    Vuelve a practicar con la herramienta paso a paso.
                  </AlertDescription>
                </Alert>
              )}

              <Button 
                onClick={handleComplete}
                className="w-full bg-green-600 hover:bg-green-700"
              >
                Completar Lección
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between items-center">
        <Button variant="outline" onClick={onExit}>
          Salir
        </Button>
        <div className="text-sm text-gray-600">
          Tiempo estimado: {lessonProgress.timeSpent} minutos
        </div>
      </div>
    </div>
  );
};

// Componente auxiliar para la calculadora interactiva
const MoneyCalculator: React.FC = () => {
  const [coins, setCoins] = useState<{[key: string]: number}>({
    '1': 0,
    '2': 0,
    '5': 0,
    '10': 0,
    '20': 0,
    '50': 0,
    '100': 0
  });

  const calculateTotal = () => {
    return Object.entries(coins).reduce((total, [value, count]) => {
      return total + (parseInt(value) * count);
    }, 0);
  };

  const resetCalculator = () => {
    setCoins({
      '1': 0,
      '2': 0,
      '5': 0,
      '10': 0,
      '20': 0,
      '50': 0,
      '100': 0
    });
  };

  return (
    <div className="bg-white p-4 border rounded-lg">
      <h4 className="font-bold mb-3">Calculadora Práctica</h4>
      
      <div className="grid grid-cols-4 gap-3 mb-4">
        {Object.entries(coins).map(([value, count]) => (
          <div key={value} className="text-center">
            <div className="text-sm font-medium mb-1">${value}</div>
            <div className="flex items-center justify-center gap-1">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setCoins(prev => ({
                  ...prev,
                  [value]: Math.max(0, prev[value] - 1)
                }))}
              >
                -
              </Button>
              <span className="w-8 text-center">{count}</span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setCoins(prev => ({
                  ...prev,
                  [value]: prev[value] + 1
                }))}
              >
                +
              </Button>
            </div>
          </div>
        ))}
      </div>

      <div className="border-t pt-3">
        <div className="flex justify-between items-center mb-2">
          <span className="font-bold">Total:</span>
          <span className="text-lg font-bold text-green-600">${calculateTotal()}</span>
        </div>
        <Button variant="outline" onClick={resetCalculator} className="w-full">
          Resetear
        </Button>
      </div>
    </div>
  );
};

export default Lesson1_1_WhatIsMoney_Bernheim;
