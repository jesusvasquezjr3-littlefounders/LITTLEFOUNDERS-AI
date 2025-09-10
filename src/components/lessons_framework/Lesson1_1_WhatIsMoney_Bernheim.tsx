import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { 
  PairedTaskComponent, 
  PracticalTool, 
  CompetenceTracker,
  characters,
  PairedTask,
  BiasMetric,
  LessonProgress 
} from './BernheimFrameworkComponents';
import { Calculator, Target, CheckCircle, AlertCircle, BookOpen, TrendingUp, Coins } from 'lucide-react';

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
            <Coins className="h-5 w-5" />
            Herramienta: Calculadora de Valor Monetario
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-green-100 p-4 rounded-lg">
            <h4 className="font-bold text-green-800 mb-2">Pasos para usar la herramienta:</h4>
            <ol className="list-decimal list-inside space-y-2 text-sm text-green-700">
              <li><strong>Identificar cada denominación:</strong> Reconoce monedas y billetes</li>
              <li><strong>Leer el valor numérico:</strong> Cada moneda/billete tiene su valor impreso</li>
              <li><strong>Sumar metodicamente:</strong> Agrupa por denominación y suma</li>
              <li><strong>Verificar el total:</strong> Revisa que hayas contado todo</li>
              <li><strong>Aplicar el valor de intercambio:</strong> Usa el total para evaluar compras</li>
            </ol>
          </div>
          
          <MoneyCalculator />
          
          <div className="bg-gray-100 p-3 rounded-lg">
            <p className="text-sm text-gray-700">
              <strong>Denominaciones básicas mexicanas:</strong> 
            </p>
            <ul className="text-xs text-gray-600 mt-1 space-y-1">
              <li>• Monedas: $0.50, $1, $2, $5, $10</li>
              <li>• Billetes: $20, $50, $100, $200, $500</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // ETAPA 2: DECISIONES DE VALUACIÓN - TAREAS PAREADAS
  const pairedTask: PairedTask = {
    id: 'money-value-recognition-task',
    complexProblem: {
      question: "Sofía va a la tienda con su alcancía que tiene: 3 monedas doradas grandes, 5 monedas plateadas medianas, 2 papeles verdes, y 4 monedas cobrizas pequeñas. El tendero le dice que las monedas doradas grandes valen $10 cada una, las plateadas $2, los papeles verdes $20, y las cobrizas $1. Sofía quiere comprar un juguete que cuesta $67. ¿Cuánto dinero tiene Sofía en total?",
      context: "Sofía debe identificar el valor real de diferentes tipos de dinero sin dejarse confundir por las descripciones físicas.",
      correctAnswer: 67,
      explanation: "Sofía tiene: 3×$10 + 5×$2 + 2×$20 + 4×$1 = $30 + $10 + $40 + $4 = $84 total."
    },
    transparentProblem: {
      question: "¿Cuánto dinero tiene Diego si cuenta: 3 monedas de $10, 5 monedas de $2, 2 billetes de $20, y 4 monedas de $1?",
      context: "Cálculo directo del valor total usando denominaciones claramente identificadas.",
      correctAnswer: 84,
      explanation: "3×$10 + 5×$2 + 2×$20 + 4×$1 = $30 + $10 + $40 + $4 = $84."
    }
  };

  // Tarea pareada adicional para efectos heterogéneos
  const pairedTaskAdvanced: PairedTask = {
    id: 'money-exchange-value-task',
    complexProblem: {
      question: "Carlos encuentra estas cosas en su mochila: una moneda redonda que dice '10', dos papeles rectangulares que dicen '50', tres moneditas que dicen '5', y cinco monedas pequeñas que dicen '1'. Su hermana le ofrece cambiarle todo eso por un solo billete de $100. ¿Debería Carlos aceptar el intercambio?",
      context: "Carlos debe calcular el valor total de su dinero para evaluar si el intercambio es justo.",
      correctAnswer: 0, // No debería aceptar (el valor real es $126, mayor que $100)
      explanation: "Carlos tiene: 1×$10 + 2×$50 + 3×$5 + 5×$1 = $10 + $100 + $15 + $5 = $130. No debería aceptar $100 por $130."
    },
    transparentProblem: {
      question: "¿Es justo intercambiar $130 por $100?",
      context: "Comparación directa entre dos valores monetarios claros.",
      correctAnswer: 0, // No es justo
      explanation: "$130 es mayor que $100, por lo que no es un intercambio justo."
    }
  };

  const [currentPairedTask, setCurrentPairedTask] = useState<PairedTask>(pairedTask);
  const [tasksCompleted, setTasksCompleted] = useState<number>(0);

  // ETAPA 3: EVALUACIÓN - MEDICIÓN DE COMPETENCIA DELIBERATIVA
  const handleTaskComplete = (complexAnswer: number, transparentAnswer: number, biasScore: number) => {
    const newBiasHistory = [...biasHistory, biasScore];
    setBiasHistory(newBiasHistory);
    setCurrentBias(biasScore);
    
    const newTasksCompleted = tasksCompleted + 1;
    setTasksCompleted(newTasksCompleted);
    
    if (newTasksCompleted === 1) {
      // Mostrar segunda tarea pareada para efectos heterogéneos
      setCurrentPairedTask(pairedTaskAdvanced);
      return;
    }
    
    // Calcular reducción de sesgo
    const avgBias = newBiasHistory.reduce((a, b) => a + Math.abs(b), 0) / newBiasHistory.length;
    const biasReduction = newBiasHistory.length > 1 ? 
      Math.abs(newBiasHistory[0]) - Math.abs(biasScore) : 0;

    const newProgress: LessonProgress = {
      conceptMastered: Math.abs(biasScore) <= 3, // Competencia si sesgo ≤ $3 en reconocimiento monetario
      biasReduction: biasReduction,
      completedTasks: [...lessonProgress.completedTasks, currentPairedTask.id],
      timeSpent: lessonProgress.timeSpent + 400 // 6-7 minutos estimados por tarea
    };

    setLessonProgress(newProgress);
    setCurrentStage('evaluation');
  };

  const handleComplete = () => {
    const finalScore = lessonProgress.conceptMastered ? 100 : 
      Math.max(0, 100 - Math.abs(currentBias) * 3);
    onComplete(finalScore, lessonProgress);
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <Card className="border-2 border-purple-200">
        <CardHeader className="bg-purple-50">
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-6 w-6" />
            LECCIÓN: Calculadora de Valor Monetario
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <Badge variant="outline" className="bg-blue-100">
              Edad: 8-12 años
            </Badge>
            <Badge variant="outline" className="bg-green-100">
              Duración: 20-25 minutos
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
                1. CONCEPTO SUSTANTIVO: Calculadora de Valor Monetario
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-gray-700">
                Aprende a identificar y calcular el valor total de diferentes combinaciones de monedas y billetes 
                usando un método sistemático y preciso. Esta herramienta te permite determinar exactamente 
                cuánto dinero tienes y evaluar si es suficiente para tus compras.
              </p>

              <PracticalTool
                title="Calculadora de Valor Monetario"
                description="Sistema para identificar, contar y sumar el valor de dinero en efectivo"
                tool={practicalTool}
                examples={[
                  {
                    input: { monedas: "2 de $10, 3 de $5" },
                    output: { total: "$35" },
                    explanation: "2×$10 + 3×$5 = $20 + $15 = $35"
                  },
                  {
                    input: { dinero: "1 billete de $50, 4 monedas de $2" },
                    output: { total: "$58" },
                    explanation: "1×$50 + 4×$2 = $50 + $8 = $58"
                  },
                  {
                    input: { combinado: "1 de $20, 2 de $10, 5 de $1" },
                    output: { total: "$45" },
                    explanation: "1×$20 + 2×$10 + 5×$1 = $20 + $20 + $5 = $45"
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
                2. PRÁCTICA CON RETROALIMENTACIÓN: Tareas Pareadas ({tasksCompleted + 1}/2)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <p className="text-gray-700 mb-4">
                Practica identificando y calculando valores monetarios en situaciones reales. Usa la calculadora 
                de valor monetario para resolver ambos problemas de manera consistente. {tasksCompleted === 0 ? 
                "Completarás 2 ejercicios que muestran diferentes formas de describir el dinero." : 
                "Este es tu segundo ejercicio con evaluación de intercambios."}
              </p>
            </CardContent>
          </Card>

          <PairedTaskComponent
            task={currentPairedTask}
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
                3. EVALUACIÓN: Competencia Deliberativa en Reconocimiento Monetario
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <p className="text-gray-700 mb-4">
                Tu competencia se mide por la consistencia en calcular valores monetarios, 
                independientemente de cómo se presente la información. Una herramienta bien 
                dominada produce cálculos coherentes sin importar la complejidad de la descripción.
              </p>
            </CardContent>
          </Card>

          <CompetenceTracker
            biasHistory={biasHistory}
            targetReduction={5}
            currentBias={currentBias}
          />

          {/* Métricas específicas del reconocimiento monetario */}
          <Card className="border-purple-200">
            <CardHeader className="bg-purple-50">
              <CardTitle>Métricas de Competencia en Valor Monetario</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-4 bg-blue-100 rounded-lg">
                  <p className="text-2xl font-bold text-blue-600">
                    {lessonProgress.conceptMastered ? 'DOMINADO' : 'EN PROGRESO'}
                  </p>
                  <p className="text-sm text-blue-800">Identificación de Dinero</p>
                </div>
                <div className="text-center p-4 bg-green-100 rounded-lg">
                  <p className="text-2xl font-bold text-green-600">
                    ${Math.abs(currentBias)}
                  </p>
                  <p className="text-sm text-green-800">Sesgo de Cálculo</p>
                </div>
                <div className="text-center p-4 bg-orange-100 rounded-lg">
                  <p className="text-2xl font-bold text-orange-600">
                    {tasksCompleted}/2
                  </p>
                  <p className="text-sm text-orange-800">Escenarios Practicados</p>
                </div>
              </div>

              {/* Interpretación del sesgo específica para reconocimiento monetario */}
              {Math.abs(currentBias) <= 3 && (
                <Alert className="border-green-200 bg-green-50">
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>¡Excelente dominio del reconocimiento monetario!</strong> Calculas valores 
                    de manera consistente sin importar cómo se presente la información. Puedes identificar 
                    y contar dinero con confianza.
                  </AlertDescription>
                </Alert>
              )}

              {Math.abs(currentBias) > 3 && Math.abs(currentBias) <= 10 && (
                <Alert className="border-yellow-200 bg-yellow-50">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Buen progreso en reconocimiento monetario.</strong> Tienes diferencias menores 
                    al calcular valores. Practica más para mantener consistencia con diferentes descripciones del dinero.
                  </AlertDescription>
                </Alert>
              )}

              {Math.abs(currentBias) > 10 && (
                <Alert className="border-red-200 bg-red-50">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Necesita más práctica con la herramienta.</strong> Las variaciones en tus cálculos 
                    sugieren que debes revisar los pasos para identificar y sumar el valor del dinero.
                  </AlertDescription>
                </Alert>
              )}

              {/* Efectos heterogéneos - consejos personalizados */}
              <Card className="bg-blue-50 border-blue-200">
                <CardContent className="p-4">
                  <h4 className="font-bold text-blue-800 mb-2">Perfil de Reconocimiento Personalizado:</h4>
                  {currentBias > 5 && (
                    <p className="text-sm text-blue-700">
                      Tiendes a sobrestimar el valor del dinero cuando se presenta de manera compleja. 
                      La herramienta te ayudará a mantener cálculos precisos independientemente de cómo se describa el dinero.
                    </p>
                  )}
                  {currentBias < -5 && (
                    <p className="text-sm text-blue-700">
                      Tiendes a subestimar el valor del dinero en escenarios complejos. Usa la calculadora 
                      paso a paso para asegurar que no pases por alto ninguna denominación.
                    </p>
                  )}
                  {Math.abs(currentBias) <= 5 && (
                    <p className="text-sm text-blue-700">
                      ¡Tienes un excelente reconocimiento monetario natural! Puedes identificar y calcular 
                      el valor del dinero de manera confiable en cualquier situación.
                    </p>
                  )}
                </CardContent>
              </Card>

              <Button 
                onClick={handleComplete}
                className="w-full bg-green-600 hover:bg-green-700"
              >
                Completar Lección de Reconocimiento Monetario
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
          Tiempo estimado: {Math.ceil(lessonProgress.timeSpent / 60)} minutos
        </div>
      </div>
    </div>
  );
};

// Componente auxiliar para la calculadora de dinero
const MoneyCalculator: React.FC = () => {
  const [coins10, setCoins10] = useState<number>(0);
  const [coins5, setCoins5] = useState<number>(0);
  const [coins2, setCoins2] = useState<number>(0);
  const [coins1, setCoins1] = useState<number>(0);
  const [bills20, setBills20] = useState<number>(0);
  const [bills50, setBills50] = useState<number>(0);

  const calculateTotal = () => {
    return (coins10 * 10) + (coins5 * 5) + (coins2 * 2) + (coins1 * 1) + (bills20 * 20) + (bills50 * 50);
  };

  const resetCalculator = () => {
    setCoins10(0);
    setCoins5(0);
    setCoins2(0);
    setCoins1(0);
    setBills20(0);
    setBills50(0);
  };

  const total = calculateTotal();

  return (
    <div className="bg-white p-4 border rounded-lg space-y-4">
      <h4 className="font-bold mb-3">Calculadora Práctica de Dinero</h4>
      
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Monedas $10</label>
          <Input
            type="number"
            value={coins10 || ''}
            onChange={(e) => setCoins10(Number(e.target.value))}
            placeholder="0"
            min="0"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Monedas $5</label>
          <Input
            type="number"
            value={coins5 || ''}
            onChange={(e) => setCoins5(Number(e.target.value))}
            placeholder="0"
            min="0"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Monedas $2</label>
          <Input
            type="number"
            value={coins2 || ''}
            onChange={(e) => setCoins2(Number(e.target.value))}
            placeholder="0"
            min="0"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Monedas $1</label>
          <Input
            type="number"
            value={coins1 || ''}
            onChange={(e) => setCoins1(Number(e.target.value))}
            placeholder="0"
            min="0"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Billetes $20</label>
          <Input
            type="number"
            value={bills20 || ''}
            onChange={(e) => setBills20(Number(e.target.value))}
            placeholder="0"
            min="0"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Billetes $50</label>
          <Input
            type="number"
            value={bills50 || ''}
            onChange={(e) => setBills50(Number(e.target.value))}
            placeholder="0"
            min="0"
          />
        </div>
      </div>

      <div className="border-t pt-4">
        <div className="text-center p-4 bg-green-100 rounded-lg">
          <div className="text-sm font-medium mb-1">Total Calculado</div>
          <div className="text-3xl font-bold text-green-600">
            ${total}
          </div>
        </div>
        
        <div className="mt-3 p-2 bg-gray-100 rounded text-center text-sm">
          <span className="font-medium">Cálculo: </span>
          <span>
            ({coins10}×$10) + ({coins5}×$5) + ({coins2}×$2) + ({coins1}×$1) + ({bills20}×$20) + ({bills50}×$50) = ${total}
          </span>
        </div>

        <Button variant="outline" onClick={resetCalculator} className="w-full mt-3">
          Resetear
        </Button>
      </div>
    </div>
  );
};

export default Lesson1_1_WhatIsMoney_Bernheim;