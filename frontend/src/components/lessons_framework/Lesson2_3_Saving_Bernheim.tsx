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
import { Calculator, Target, CheckCircle, AlertCircle, BookOpen, Clock, PiggyBank } from 'lucide-react';

interface Lesson2_3Props {
  onComplete: (score: number, progress: LessonProgress) => void;
  onExit: () => void;
}

const Lesson2_3_Saving_Bernheim: React.FC<Lesson2_3Props> = ({ onComplete, onExit }) => {
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
            <Clock className="h-5 w-5" />
            Herramienta: Calculadora de Ahorro Temporal
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-green-100 p-4 rounded-lg">
            <h4 className="font-bold text-green-800 mb-2">Pasos para usar la herramienta:</h4>
            <ol className="list-decimal list-inside space-y-2 text-sm text-green-700">
              <li><strong>Identificar meta:</strong> ¿Cuánto dinero necesitas?</li>
              <li><strong>Calcular ahorro mensual:</strong> ¿Cuánto puedes ahorrar cada mes?</li>
              <li><strong>Aplicar fórmula:</strong> Meses = Meta ÷ Ahorro mensual</li>
              <li><strong>Ajustar por gastos:</strong> Considera gastos imprevistos</li>
              <li><strong>Redondear hacia arriba:</strong> Siempre planifica tiempo extra</li>
            </ol>
          </div>
          
          <SavingsCalculator />
          
          <div className="bg-gray-100 p-3 rounded-lg">
            <p className="text-sm text-gray-700">
              <strong>Fórmula básica:</strong> Tiempo de ahorro = Meta financiera ÷ Ahorro mensual neto
            </p>
            <p className="text-xs text-gray-600 mt-1">
              *Ahorro mensual neto = Ingresos - Gastos fijos mensuales
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // ETAPA 2: DECISIONES DE VALUACIÓN - TAREAS PAREADAS
  const pairedTask: PairedTask = {
    id: 'saving-time-calculation-task',
    complexProblem: {
      question: "Lucas quiere una bicicleta que cuesta $120. Recibe $20 de mesada mensual, pero gasta $5 en dulces y $3 en el autobús cada mes. Además, algunos meses gastará $2 extra en materiales escolares. ¿Cuántos meses necesita ahorrar para comprar la bicicleta?",
      context: "Lucas debe calcular su ahorro real considerando todos sus gastos mensuales variables.",
      correctAnswer: 12,
      explanation: "Ahorro mensual neto = $20 - $5 - $3 - $2 = $10. Tiempo = $120 ÷ $10 = 12 meses."
    },
    transparentProblem: {
      question: "Si necesitas $120 y puedes ahorrar $10 cada mes, ¿cuántos meses necesitas para tener el dinero?",
      context: "Cálculo directo de tiempo de ahorro.",
      correctAnswer: 12,
      explanation: "Tiempo = $120 ÷ $10 por mes = 12 meses."
    }
  };

  // Tarea pareada adicional para efectos heterogéneos
  const pairedTaskAdvanced: PairedTask = {
    id: 'saving-flexibility-task',
    complexProblem: {
      question: "Ana quiere ahorrar $80 para un videojuego. Puede ahorrar $15 al mes, pero también le gusta comprar libros ($8 cada dos meses). Si ya tiene $20 ahorrados, ¿cuántos meses necesita?",
      context: "Ana debe balancear el ahorro con otros gastos ocasionales que disfruta.",
      correctAnswer: 5,
      explanation: "Necesita $60 más ($80-$20). Ahorro neto mensual = $15 - ($8÷2) = $11. Tiempo = $60 ÷ $11 ≈ 5.5, redondeado a 6 meses, pero considerando que ya tiene $20, son 5 meses."
    },
    transparentProblem: {
      question: "Si necesitas $60 más y ahorras $12 cada mes, ¿cuántos meses necesitas?",
      context: "Versión simplificada del mismo cálculo.",
      correctAnswer: 5,
      explanation: "Tiempo = $60 ÷ $12 por mes = 5 meses."
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
      // Mostrar segunda tarea pareada
      setCurrentPairedTask(pairedTaskAdvanced);
      return;
    }
    
    // Calcular reducción de sesgo
    const avgBias = newBiasHistory.reduce((a, b) => a + Math.abs(b), 0) / newBiasHistory.length;
    const biasReduction = newBiasHistory.length > 1 ? 
      Math.abs(newBiasHistory[0]) - Math.abs(biasScore) : 0;

    const newProgress: LessonProgress = {
      conceptMastered: Math.abs(biasScore) <= 3, // Competencia si sesgo ≤ 3 para ahorro
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
            <PiggyBank className="h-6 w-6" />
            LECCIÓN: Calculadora de Ahorro Temporal
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <Badge variant="outline" className="bg-blue-100">
              Edad: 10-14 años
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
                1. CONCEPTO SUSTANTIVO: Calculadora de Ahorro Temporal
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-gray-700">
                Aprende a usar una herramienta matemática para calcular exactamente cuánto tiempo 
                necesitas para ahorrar dinero, considerando ingresos regulares y gastos variables.
              </p>

              <PracticalTool
                title="Calculadora de Ahorro Temporal"
                description="Método sistemático para calcular tiempo de ahorro considerando ingresos y gastos"
                tool={practicalTool}
                examples={[
                  {
                    input: { meta: "$100", ahorroMensual: "$20", gastos: "$5" },
                    output: { tiempoMeses: "6.7 meses", redondeado: "7 meses" },
                    explanation: "Ahorro neto = $20-$5 = $15. Tiempo = $100÷$15 = 6.7, redondeado a 7 meses."
                  },
                  {
                    input: { meta: "$150", ahorroMensual: "$25", gastos: "$0" },
                    output: { tiempoMeses: "6 meses", redondeado: "6 meses" },
                    explanation: "Ahorro neto = $25. Tiempo = $150÷$25 = 6 meses exactos."
                  },
                  {
                    input: { meta: "$80", ahorroMensual: "$15", gastos: "$3" },
                    output: { tiempoMeses: "6.7 meses", redondeado: "7 meses" },
                    explanation: "Ahorro neto = $15-$3 = $12. Tiempo = $80÷$12 = 6.7, redondeado a 7 meses."
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
                Practica con problemas reales de ahorro. Usa la calculadora de ahorro temporal para 
                resolver ambos problemas de forma consistente. {tasksCompleted === 0 ? 
                "Completarás 2 ejercicios para dominar la herramienta." : 
                "Este es tu segundo ejercicio, ¡casi terminas!"}
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
                3. EVALUACIÓN: Competencia Deliberativa en Ahorro
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <p className="text-gray-700 mb-4">
                Tu competencia se mide por la consistencia entre cálculos complejos y simples. 
                Una herramienta bien dominada produce resultados similares independientemente 
                de la complejidad del problema.
              </p>
            </CardContent>
          </Card>

          <CompetenceTracker
            biasHistory={biasHistory}
            targetReduction={6}
            currentBias={currentBias}
          />

          {/* Métricas específicas del ahorro */}
          <Card className="border-purple-200">
            <CardHeader className="bg-purple-50">
              <CardTitle>Métricas de Competencia en Cálculos de Ahorro</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-4 bg-blue-100 rounded-lg">
                  <p className="text-2xl font-bold text-blue-600">
                    {lessonProgress.conceptMastered ? 'DOMINADO' : 'EN PROGRESO'}
                  </p>
                  <p className="text-sm text-blue-800">Estado del Concepto</p>
                </div>
                <div className="text-center p-4 bg-green-100 rounded-lg">
                  <p className="text-2xl font-bold text-green-600">
                    {Math.abs(currentBias)} meses
                  </p>
                  <p className="text-sm text-green-800">Sesgo Temporal</p>
                </div>
                <div className="text-center p-4 bg-orange-100 rounded-lg">
                  <p className="text-2xl font-bold text-orange-600">
                    {tasksCompleted}/2
                  </p>
                  <p className="text-sm text-orange-800">Tareas Completadas</p>
                </div>
              </div>

              {/* Interpretación del sesgo específica para ahorro */}
              {Math.abs(currentBias) <= 3 && (
                <Alert className="border-green-200 bg-green-50">
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>¡Excelente dominio de la herramienta de ahorro!</strong> Tus cálculos son muy consistentes. 
                    Puedes planificar metas de ahorro con confianza y precisión.
                  </AlertDescription>
                </Alert>
              )}

              {Math.abs(currentBias) > 3 && Math.abs(currentBias) <= 8 && (
                <Alert className="border-yellow-200 bg-yellow-50">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Buen progreso en planificación de ahorro.</strong> Hay diferencias menores en tus cálculos. 
                    Practica más para mejorar la consistencia en situaciones complejas.
                  </AlertDescription>
                </Alert>
              )}

              {Math.abs(currentBias) > 8 && (
                <Alert className="border-red-200 bg-red-50">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Necesita más práctica con la calculadora.</strong> Las diferencias en tus cálculos sugieren 
                    que debes revisar los pasos de la herramienta sistemática.
                  </AlertDescription>
                </Alert>
              )}

              {/* Efectos heterogéneos - consejos personalizados */}
              <Card className="bg-blue-50 border-blue-200">
                <CardContent className="p-4">
                  <h4 className="font-bold text-blue-800 mb-2">Consejo Personalizado:</h4>
                  {currentBias > 5 && (
                    <p className="text-sm text-blue-700">
                      Tus cálculos tienden a sobrestimar el tiempo. Esto puede ser bueno para crear planes conservadores, 
                      pero asegúrate de no desanimarte. La herramienta te dará cálculos más precisos.
                    </p>
                  )}
                  {currentBias < -5 && (
                    <p className="text-sm text-blue-700">
                      Tus cálculos tienden a subestimar el tiempo. Ten cuidado de no crear expectativas irreales. 
                      Usa la herramienta sistemática para ser más realista.
                    </p>
                  )}
                  {Math.abs(currentBias) <= 5 && (
                    <p className="text-sm text-blue-700">
                      ¡Tienes un buen balance en tus cálculos! Puedes usar esta herramienta con confianza 
                      para planificar metas de ahorro realistas.
                    </p>
                  )}
                </CardContent>
              </Card>

              <Button 
                onClick={handleComplete}
                className="w-full bg-green-600 hover:bg-green-700"
              >
                Completar Lección de Ahorro
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

// Componente auxiliar para la calculadora de ahorro
const SavingsCalculator: React.FC = () => {
  const [goal, setGoal] = useState<number>(0);
  const [monthlyIncome, setMonthlyIncome] = useState<number>(0);
  const [monthlyExpenses, setMonthlyExpenses] = useState<number>(0);
  const [currentSavings, setCurrentSavings] = useState<number>(0);

  const calculateSavingTime = () => {
    const netSavings = monthlyIncome - monthlyExpenses;
    if (netSavings <= 0) return "Imposible ahorrar con gastos mayores a ingresos";
    
    const remainingGoal = Math.max(0, goal - currentSavings);
    const months = remainingGoal / netSavings;
    
    return `${Math.ceil(months)} meses`;
  };

  const resetCalculator = () => {
    setGoal(0);
    setMonthlyIncome(0);
    setMonthlyExpenses(0);
    setCurrentSavings(0);
  };

  return (
    <div className="bg-white p-4 border rounded-lg space-y-4">
      <h4 className="font-bold mb-3">Calculadora Práctica de Ahorro</h4>
      
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Meta de ahorro ($)</label>
          <Input
            type="number"
            value={goal || ''}
            onChange={(e) => setGoal(Number(e.target.value))}
            placeholder="Ej: 120"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Ahorro actual ($)</label>
          <Input
            type="number"
            value={currentSavings || ''}
            onChange={(e) => setCurrentSavings(Number(e.target.value))}
            placeholder="Ej: 20"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Ingresos mensuales ($)</label>
          <Input
            type="number"
            value={monthlyIncome || ''}
            onChange={(e) => setMonthlyIncome(Number(e.target.value))}
            placeholder="Ej: 25"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Gastos mensuales ($)</label>
          <Input
            type="number"
            value={monthlyExpenses || ''}
            onChange={(e) => setMonthlyExpenses(Number(e.target.value))}
            placeholder="Ej: 10"
          />
        </div>
      </div>

      <div className="border-t pt-4">
        <div className="grid grid-cols-2 gap-4 mb-3">
          <div className="text-center p-2 bg-green-100 rounded">
            <span className="text-sm font-medium">Ahorro mensual neto</span>
            <p className="text-lg font-bold text-green-600">
              ${Math.max(0, monthlyIncome - monthlyExpenses)}
            </p>
          </div>
          <div className="text-center p-2 bg-blue-100 rounded">
            <span className="text-sm font-medium">Tiempo necesario</span>
            <p className="text-lg font-bold text-blue-600">
              {calculateSavingTime()}
            </p>
          </div>
        </div>
        <Button variant="outline" onClick={resetCalculator} className="w-full">
          Resetear
        </Button>
      </div>
    </div>
  );
};

export default Lesson2_3_Saving_Bernheim;
