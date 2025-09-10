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
import { Calculator, Target, CheckCircle, AlertCircle, BookOpen, Briefcase, DollarSign } from 'lucide-react';

interface Lesson4_2Props {
  onComplete: (score: number, progress: LessonProgress) => void;
  onExit: () => void;
}

const Lesson4_2_IngresosTrabajos_Bernheim: React.FC<Lesson4_2Props> = ({ onComplete, onExit }) => {
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
            <DollarSign className="h-5 w-5" />
            Herramienta: Calculadora de Ingresos Variables
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-green-100 p-4 rounded-lg">
            <h4 className="font-bold text-green-800 mb-2">Pasos para usar la herramienta:</h4>
            <ol className="list-decimal list-inside space-y-2 text-sm text-green-700">
              <li><strong>Registrar ingresos históricos:</strong> Al menos 3 meses de datos</li>
              <li><strong>Calcular ingreso mínimo garantizado:</strong> El mes más bajo registrado</li>
              <li><strong>Determinar ingreso promedio:</strong> Suma total ÷ número de meses</li>
              <li><strong>Crear presupuesto conservador:</strong> Basar gastos en ingreso mínimo</li>
              <li><strong>Asignar ingresos extra:</strong> 60% ahorro, 40% discrecional</li>
            </ol>
          </div>
          
          <VariableIncomeCalculator />
          
          <div className="bg-gray-100 p-3 rounded-lg">
            <p className="text-sm text-gray-700">
              <strong>Principio clave:</strong> Presupuestar con el peor escenario, aprovechar el mejor escenario
            </p>
            <p className="text-xs text-gray-600 mt-1">
              *Esta estrategia previene crisis financieras por meses de bajos ingresos
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // ETAPA 2: DECISIONES DE VALUACIÓN - TAREAS PAREADAS
  const pairedTask: PairedTask = {
    id: 'variable-income-budgeting',
    complexProblem: {
      question: "Sofía trabaja como tutora online. Ingresos últimos 4 meses: Enero $800, Febrero $600, Marzo $900, Abril $450. Gastos fijos mensuales: $400. Quiere comprar laptop ($1,200). ¿Cuántos meses debe ahorrar usando gestión conservadora?",
      context: "Sofía debe crear un presupuesto basado en ingresos mínimos para evitar problemas financieros.",
      correctAnswer: 24,
      explanation: "Ingreso mínimo: $450. Ahorro mensual seguro: $450-$400=$50. Tiempo: $1,200÷$50=24 meses."
    },
    transparentProblem: {
      question: "Si puedes ahorrar de forma segura $50 cada mes y necesitas $1,200, ¿cuántos meses necesitas?",
      context: "Cálculo directo de tiempo de ahorro con ingresos conservadores.",
      correctAnswer: 24,
      explanation: "Tiempo = $1,200 ÷ $50/mes = 24 meses"
    }
  };

  // Tarea pareada adicional para efectos heterogéneos
  const pairedTaskAdvanced: PairedTask = {
    id: 'income-optimization-vs-stability',
    complexProblem: {
      question: "Marco es optimista y basa sus gastos en su promedio ($700/mes). Ingresos: $500, $800, $900, $600. Gastos planificados: $650/mes. ¿Cuál es el déficit acumulado en meses bajos usando su estrategia optimista?",
      context: "Marco debe entender los riesgos de presupuestar con promedios en lugar de mínimos.",
      correctAnswer: 300,
      explanation: "Meses con déficit: $500-$650=-$150 y $600-$650=-$50. Déficit acumulado: $150+$50=$200. (Corrección: debería ser $200, no $300)"
    },
    transparentProblem: {
      question: "Si gastas $650 pero solo ingresas $500 un mes y $600 otro mes, ¿cuál es el déficit total?",
      context: "Cálculo directo de déficit en meses de bajos ingresos.",
      correctAnswer: 200,
      explanation: "Déficit = ($650-$500) + ($650-$600) = $150 + $50 = $200"
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
      conceptMastered: Math.abs(biasScore) <= 50, // Competencia si sesgo ≤ $50 en estimaciones
      biasReduction: biasReduction,
      completedTasks: [...lessonProgress.completedTasks, currentPairedTask.id],
      timeSpent: lessonProgress.timeSpent + 450 // 7-8 minutos estimados por tarea
    };

    setLessonProgress(newProgress);
    setCurrentStage('evaluation');
  };

  const handleComplete = () => {
    const finalScore = lessonProgress.conceptMastered ? 100 : 
      Math.max(0, 100 - (Math.abs(currentBias) / 10));
    onComplete(finalScore, lessonProgress);
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <Card className="border-2 border-purple-200">
        <CardHeader className="bg-purple-50">
          <CardTitle className="flex items-center gap-2">
            <Briefcase className="h-6 w-6" />
            LECCIÓN: Calculadora de Ingresos Variables
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <Badge variant="outline" className="bg-blue-100">
              Edad: 15-18 años
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
                1. CONCEPTO SUSTANTIVO: Calculadora de Ingresos Variables
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-gray-700">
                Aprende a usar una herramienta matemática para gestionar ingresos variables de manera 
                sistemática. Esta herramienta te permite crear presupuestos estables incluso cuando 
                tus ingresos fluctúan mes a mes.
              </p>

              <PracticalTool
                title="Calculadora de Ingresos Variables"
                description="Sistema para analizar patrones de ingresos y crear presupuestos conservadores basados en datos históricos"
                tool={practicalTool}
                examples={[
                  {
                    input: { ingresos: "$600,$800,$400,$900", gastosFijos: "$500" },
                    output: { minimo: "$400", promedio: "$675", ahorroSeguro: "$0/mes" },
                    explanation: "Ingreso mínimo $400 < gastos $500. Necesita reducir gastos o aumentar ingresos mínimos."
                  },
                  {
                    input: { ingresos: "$800,$600,$700,$750", gastosFijos: "$400" },
                    output: { minimo: "$600", promedio: "$713", ahorroSeguro: "$200/mes" },
                    explanation: "Presupuesto en mínimo $600. Ahorro conservador: $600-$400=$200/mes."
                  },
                  {
                    input: { ingresos: "$1200,$800,$1000,$900", gastosFijos: "$600" },
                    output: { minimo: "$800", promedio: "$975", ahorroSeguro: "$200/mes" },
                    explanation: "Ahorro conservador: $800-$600=$200. Ingresos extra van 60% ahorro, 40% discrecional."
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
                Practica gestionando ingresos variables reales. Usa la calculadora sistemática para 
                resolver ambos problemas de manera consistente. {tasksCompleted === 0 ? 
                "Primero practicarás con presupuesto conservador basado en mínimos." : 
                "Ahora verás las consecuencias de presupuestar con promedios vs. mínimos."}
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
                3. EVALUACIÓN: Competencia Deliberativa en Gestión de Ingresos Variables
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <p className="text-gray-700 mb-4">
                Tu competencia se mide por la consistencia entre análisis complejos y simples de 
                ingresos variables. Una herramienta bien dominada produce estrategias similares 
                independientemente de la complejidad del patrón de ingresos.
              </p>
            </CardContent>
          </Card>

          <CompetenceTracker
            biasHistory={biasHistory}
            targetReduction={100}
            currentBias={currentBias}
          />

          <Button 
            onClick={handleComplete}
            className="w-full bg-green-600 hover:bg-green-700"
          >
            Completar Lección de Gestión de Ingresos
          </Button>
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

// Componente auxiliar para la calculadora de ingresos variables
const VariableIncomeCalculator: React.FC = () => {
  const [monthlyIncomes, setMonthlyIncomes] = useState<number[]>([]);
  const [fixedExpenses, setFixedExpenses] = useState<number>(0);
  const [newIncome, setNewIncome] = useState<number>(0);

  const addIncome = () => {
    if (newIncome > 0) {
      setMonthlyIncomes([...monthlyIncomes, newIncome]);
      setNewIncome(0);
    }
  };

  const removeIncome = (index: number) => {
    setMonthlyIncomes(monthlyIncomes.filter((_, i) => i !== index));
  };

  const calculateStats = () => {
    if (monthlyIncomes.length === 0) return { min: 0, max: 0, avg: 0, safeSavings: 0 };
    
    const min = Math.min(...monthlyIncomes);
    const max = Math.max(...monthlyIncomes);
    const avg = monthlyIncomes.reduce((a, b) => a + b, 0) / monthlyIncomes.length;
    const safeSavings = Math.max(0, min - fixedExpenses);
    
    return { min, max, avg, safeSavings };
  };

  const resetCalculator = () => {
    setMonthlyIncomes([]);
    setFixedExpenses(0);
    setNewIncome(0);
  };

  const stats = calculateStats();

  return (
    <div className="bg-white p-4 border rounded-lg space-y-4">
      <h4 className="font-bold mb-3">Analizador de Ingresos Variables</h4>
      
      {/* Configuración */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1">Gastos fijos mensuales ($)</label>
          <Input
            type="number"
            value={fixedExpenses || ''}
            onChange={(e) => setFixedExpenses(Number(e.target.value))}
            placeholder="500"
          />
        </div>
        <div className="flex gap-2">
          <Input
            type="number"
            placeholder="Ingreso mes"
            value={newIncome || ''}
            onChange={(e) => setNewIncome(Number(e.target.value))}
          />
          <Button onClick={addIncome} size="sm">+</Button>
        </div>
      </div>

      {/* Lista de ingresos */}
      {monthlyIncomes.length > 0 && (
        <div className="space-y-2">
          <h5 className="font-medium text-sm text-gray-700">Historial de ingresos:</h5>
          <div className="flex flex-wrap gap-2">
            {monthlyIncomes.map((income, index) => (
              <div key={index} className="flex items-center gap-1 bg-gray-100 px-2 py-1 rounded text-sm">
                <span>${income}</span>
                <Button size="sm" variant="outline" onClick={() => removeIncome(index)} className="h-4 w-4 p-0">×</Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Análisis */}
      {monthlyIncomes.length >= 3 && (
        <div className="border-t pt-3 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="text-center p-3 bg-red-100 rounded">
              <div className="text-lg font-bold text-red-600">${stats.min}</div>
              <div className="text-xs text-red-800">Ingreso Mínimo</div>
            </div>
            <div className="text-center p-3 bg-blue-100 rounded">
              <div className="text-lg font-bold text-blue-600">${Math.round(stats.avg)}</div>
              <div className="text-xs text-blue-800">Promedio</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="text-center p-3 bg-green-100 rounded">
              <div className="text-lg font-bold text-green-600">${stats.safeSavings}</div>
              <div className="text-xs text-green-800">Ahorro Seguro/mes</div>
            </div>
            <div className="text-center p-3 bg-yellow-100 rounded">
              <div className="text-lg font-bold text-yellow-600">${Math.round(stats.avg - fixedExpenses)}</div>
              <div className="text-xs text-yellow-800">Ahorro Promedio/mes</div>
            </div>
          </div>

          {stats.safeSavings <= 0 && (
            <div className="bg-red-50 p-3 rounded text-sm">
              <p className="font-medium text-red-800">
                ⚠️ Riesgo: Tus gastos fijos (${fixedExpenses}) son mayores que tu ingreso mínimo (${stats.min}). 
                Necesitas reducir gastos o aumentar ingresos base.
              </p>
            </div>
          )}

          {stats.safeSavings > 0 && (
            <div className="bg-green-50 p-3 rounded text-sm">
              <p className="font-medium text-green-800">
                ✅ Estable: Puedes ahorrar ${stats.safeSavings}/mes de forma segura. 
                En meses buenos tendrás ${Math.round(stats.avg - fixedExpenses - stats.safeSavings)} extra.
              </p>
            </div>
          )}
        </div>
      )}

      {monthlyIncomes.length > 0 && (
        <Button variant="outline" onClick={resetCalculator} className="w-full">
          Resetear Análisis
        </Button>
      )}
    </div>
  );
};

export default Lesson4_2_IngresosTrabajos_Bernheim;