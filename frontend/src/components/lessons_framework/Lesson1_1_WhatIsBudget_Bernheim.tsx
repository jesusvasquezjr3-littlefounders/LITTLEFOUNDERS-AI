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
import { Calculator, Target, CheckCircle, AlertCircle, BookOpen, TrendingUp, PieChart } from 'lucide-react';

interface Lesson1_1Props {
  onComplete: (score: number, progress: LessonProgress) => void;
  onExit: () => void;
}

const Lesson1_1_WhatIsBudget_Bernheim: React.FC<Lesson1_1Props> = ({ onComplete, onExit }) => {
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
            <PieChart className="h-5 w-5" />
            Herramienta: Calculadora de Distribución Presupuestaria
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-green-100 p-4 rounded-lg">
            <h4 className="font-bold text-green-800 mb-2">Pasos para usar la herramienta:</h4>
            <ol className="list-decimal list-inside space-y-2 text-sm text-green-700">
              <li><strong>Identificar ingresos totales:</strong> ¿Cuánto dinero tienes?</li>
              <li><strong>Aplicar regla 50/30/20:</strong> 50% necesidades, 30% deseos, 20% ahorro</li>
              <li><strong>Calcular cada categoría:</strong> Multiplica total × porcentaje</li>
              <li><strong>Verificar suma:</strong> Las tres categorías deben sumar el total</li>
              <li><strong>Ajustar si es necesario:</strong> Respeta las prioridades básicas</li>
            </ol>
          </div>
          
          <BudgetCalculator />
          
          <div className="bg-gray-100 p-3 rounded-lg">
            <p className="text-sm text-gray-700">
              <strong>Regla 50/30/20:</strong> 
            </p>
            <ul className="text-xs text-gray-600 mt-1 space-y-1">
              <li>• 50% Necesidades (comida, transporte, gastos básicos)</li>
              <li>• 30% Deseos (entretenimiento, compras opcionales)</li>
              <li>• 20% Ahorro (para metas futuras)</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // ETAPA 2: DECISIONES DE VALUACIÓN - TAREAS PAREADAS
  const pairedTask: PairedTask = {
    id: 'budget-distribution-task',
    complexProblem: {
      question: "Alex tiene $300 de mesada mensual. Gasta $80 en comida y transporte (necesidades), quiere un videojuego de $120 y ropa de $60 (deseos), y sus papás insisten en que ahorre al menos $50. Usando la regla 50/30/20, ¿cuánto debería asignar Alex a 'deseos' para mantener un presupuesto balanceado?",
      context: "Alex debe balancear sus deseos reales con un presupuesto estructurado.",
      correctAnswer: 90,
      explanation: "Con $300 total: Necesidades $150 (50%), Deseos $90 (30%), Ahorro $60 (20%). Alex debe asignar $90 a deseos, no los $180 que quiere gastar."
    },
    transparentProblem: {
      question: "Si tienes $300 y sigues la regla 50/30/20, ¿cuánto destinas a la categoría de 'deseos' (30%)?",
      context: "Aplicación directa de la regla de distribución presupuestaria.",
      correctAnswer: 90,
      explanation: "$300 × 30% = $90 para la categoría de deseos."
    }
  };

  // Tarea pareada adicional para efectos heterogéneos 
  const pairedTaskAdvanced: PairedTask = {
    id: 'budget-flexibility-task',
    complexProblem: {
      question: "María recibe $200 mensuales. Sus gastos básicos son solo $60 (transporte y materiales escolares). Le gusta ahorrar mucho y normalmente guarda $100 al mes, gastando solo $40 en entretenimiento. Si aplica la regla 50/30/20 estricta, ¿cuánto debería destinar al ahorro?",
      context: "María es una ahorradora natural que debe considerar también el balance en su vida financiera.",
      correctAnswer: 40,
      explanation: "Con $200 total usando regla 50/30/20: Ahorro = $200 × 20% = $40. Aunque María prefiere ahorrar más, la regla sugiere balance con entretenimiento ($60)."
    },
    transparentProblem: {
      question: "Con $200 total siguiendo la regla 50/30/20, ¿cuánto corresponde al ahorro (20%)?",
      context: "Cálculo directo del ahorro según la regla presupuestaria.",
      correctAnswer: 40,
      explanation: "$200 × 20% = $40 para ahorro."
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
      conceptMastered: Math.abs(biasScore) <= 5, // Competencia si sesgo ≤ $5 en presupuesto
      biasReduction: biasReduction,
      completedTasks: [...lessonProgress.completedTasks, currentPairedTask.id],
      timeSpent: lessonProgress.timeSpent + 450 // 7-8 minutos estimados por tarea
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
            <TrendingUp className="h-6 w-6" />
            LECCIÓN: Calculadora de Distribución Presupuestaria
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <Badge variant="outline" className="bg-blue-100">
              Edad: 12-16 años
            </Badge>
            <Badge variant="outline" className="bg-green-100">
              Duración: 25-30 minutos
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
                1. CONCEPTO SUSTANTIVO: Calculadora de Distribución Presupuestaria
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-gray-700">
                Aprende a usar la regla matemática 50/30/20 para distribuir cualquier cantidad de dinero 
                de forma balanceada entre necesidades, deseos y ahorro. Esta herramienta te da control 
                total sobre tu dinero usando proporciones específicas.
              </p>

              <PracticalTool
                title="Calculadora de Distribución Presupuestaria (Regla 50/30/20)"
                description="Sistema matemático para distribuir ingresos en proporciones balanceadas"
                tool={practicalTool}
                examples={[
                  {
                    input: { ingresoTotal: "$400" },
                    output: { necesidades: "$200", deseos: "$120", ahorro: "$80" },
                    explanation: "50% = $400×0.5 = $200 | 30% = $400×0.3 = $120 | 20% = $400×0.2 = $80"
                  },
                  {
                    input: { ingresoTotal: "$150" },
                    output: { necesidades: "$75", deseos: "$45", ahorro: "$30" },
                    explanation: "50% = $150×0.5 = $75 | 30% = $150×0.3 = $45 | 20% = $150×0.2 = $30"
                  },
                  {
                    input: { ingresoTotal: "$250" },
                    output: { necesidades: "$125", deseos: "$75", ahorro: "$50" },
                    explanation: "50% = $250×0.5 = $125 | 30% = $250×0.3 = $75 | 20% = $250×0.2 = $50"
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
                Practica aplicando la regla 50/30/20 en situaciones reales. Usa la calculadora de distribución 
                presupuestaria para resolver ambos problemas de manera consistente. {tasksCompleted === 0 ? 
                "Completarás 2 ejercicios que muestran diferentes personalidades financieras." : 
                "Este es tu segundo ejercicio con un perfil de ahorro diferente."}
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
                3. EVALUACIÓN: Competencia Deliberativa en Presupuestos
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <p className="text-gray-700 mb-4">
                Tu competencia se mide por la consistencia en aplicar la regla 50/30/20, 
                independientemente de la complejidad del escenario financiero. Una herramienta 
                bien dominada produce distribuciones coherentes.
              </p>
            </CardContent>
          </Card>

          <CompetenceTracker
            biasHistory={biasHistory}
            targetReduction={10}
            currentBias={currentBias}
          />

          {/* Métricas específicas del presupuesto */}
          <Card className="border-purple-200">
            <CardHeader className="bg-purple-50">
              <CardTitle>Métricas de Competencia en Distribución Presupuestaria</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-4 bg-blue-100 rounded-lg">
                  <p className="text-2xl font-bold text-blue-600">
                    {lessonProgress.conceptMastered ? 'DOMINADO' : 'EN PROGRESO'}
                  </p>
                  <p className="text-sm text-blue-800">Dominio de la Regla</p>
                </div>
                <div className="text-center p-4 bg-green-100 rounded-lg">
                  <p className="text-2xl font-bold text-green-600">
                    ${Math.abs(currentBias)}
                  </p>
                  <p className="text-sm text-green-800">Sesgo de Distribución</p>
                </div>
                <div className="text-center p-4 bg-orange-100 rounded-lg">
                  <p className="text-2xl font-bold text-orange-600">
                    {tasksCompleted}/2
                  </p>
                  <p className="text-sm text-orange-800">Escenarios Practicados</p>
                </div>
              </div>

              {/* Interpretación del sesgo específica para presupuesto */}
              {Math.abs(currentBias) <= 5 && (
                <Alert className="border-green-200 bg-green-50">
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>¡Excelente dominio de la distribución presupuestaria!</strong> Aplicas la regla 50/30/20 
                    de manera consistente. Puedes crear presupuestos balanceados con confianza.
                  </AlertDescription>
                </Alert>
              )}

              {Math.abs(currentBias) > 5 && Math.abs(currentBias) <= 15 && (
                <Alert className="border-yellow-200 bg-yellow-50">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Buen progreso en presupuestación.</strong> Tienes diferencias menores al aplicar la regla. 
                    Practica más para mantener consistencia en escenarios complejos.
                  </AlertDescription>
                </Alert>
              )}

              {Math.abs(currentBias) > 15 && (
                <Alert className="border-red-200 bg-red-50">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Necesita más práctica con la herramienta.</strong> Las variaciones en tus distribuciones 
                    sugieren que debes revisar los pasos matemáticos de la regla 50/30/20.
                  </AlertDescription>
                </Alert>
              )}

              {/* Efectos heterogéneos - consejos personalizados */}
              <Card className="bg-blue-50 border-blue-200">
                <CardContent className="p-4">
                  <h4 className="font-bold text-blue-800 mb-2">Perfil Financiero Personalizado:</h4>
                  {currentBias > 10 && (
                    <p className="text-sm text-blue-700">
                      Tiendes a asignar más dinero a deseos de lo que sugiere la regla. La herramienta te ayudará 
                      a mantener balance y lograr tus metas de ahorro a largo plazo.
                    </p>
                  )}
                  {currentBias < -10 && (
                    <p className="text-sm text-blue-700">
                      Tiendes a ser muy conservador con los gastos. Aunque ahorrar es importante, la regla 50/30/20 
                      también permite disfrutar la vida de manera balanceada.
                    </p>
                  )}
                  {Math.abs(currentBias) <= 10 && (
                    <p className="text-sm text-blue-700">
                      ¡Tienes un excelente balance financiero natural! Puedes usar la regla 50/30/20 
                      como guía confiable para cualquier nivel de ingresos.
                    </p>
                  )}
                </CardContent>
              </Card>

              <Button 
                onClick={handleComplete}
                className="w-full bg-green-600 hover:bg-green-700"
              >
                Completar Lección de Presupuestos
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

// Componente auxiliar para la calculadora de presupuesto
const BudgetCalculator: React.FC = () => {
  const [totalIncome, setTotalIncome] = useState<number>(0);

  const calculateBudget = () => {
    const needs = totalIncome * 0.5;
    const wants = totalIncome * 0.3;
    const savings = totalIncome * 0.2;
    
    return { needs, wants, savings };
  };

  const resetCalculator = () => {
    setTotalIncome(0);
  };

  const budget = calculateBudget();

  return (
    <div className="bg-white p-4 border rounded-lg space-y-4">
      <h4 className="font-bold mb-3">Calculadora Práctica de Presupuesto</h4>
      
      <div>
        <label className="block text-sm font-medium mb-2">Ingresos Totales ($)</label>
        <Input
          type="number"
          value={totalIncome || ''}
          onChange={(e) => setTotalIncome(Number(e.target.value))}
          placeholder="Ej: 300"
          className="text-lg"
        />
      </div>

      <div className="border-t pt-4">
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-3 bg-red-100 rounded-lg">
            <div className="text-sm font-medium mb-1">Necesidades (50%)</div>
            <div className="text-xl font-bold text-red-600">
              ${budget.needs.toFixed(0)}
            </div>
            <div className="text-xs text-gray-600">Gastos básicos</div>
          </div>
          <div className="text-center p-3 bg-blue-100 rounded-lg">
            <div className="text-sm font-medium mb-1">Deseos (30%)</div>
            <div className="text-xl font-bold text-blue-600">
              ${budget.wants.toFixed(0)}
            </div>
            <div className="text-xs text-gray-600">Entretenimiento</div>
          </div>
          <div className="text-center p-3 bg-green-100 rounded-lg">
            <div className="text-sm font-medium mb-1">Ahorro (20%)</div>
            <div className="text-xl font-bold text-green-600">
              ${budget.savings.toFixed(0)}
            </div>
            <div className="text-xs text-gray-600">Metas futuras</div>
          </div>
        </div>
        
        <div className="mt-4 p-2 bg-gray-100 rounded text-center">
          <span className="text-sm font-medium">Verificación: </span>
          <span className="text-sm">
            ${budget.needs.toFixed(0)} + ${budget.wants.toFixed(0)} + ${budget.savings.toFixed(0)} = ${totalIncome}
          </span>
        </div>

        <Button variant="outline" onClick={resetCalculator} className="w-full mt-3">
          Resetear
        </Button>
      </div>
    </div>
  );
};

export default Lesson1_1_WhatIsBudget_Bernheim;
