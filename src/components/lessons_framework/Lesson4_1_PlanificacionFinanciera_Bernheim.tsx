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
import { Calculator, Target, CheckCircle, AlertCircle, BookOpen, Calendar, Map } from 'lucide-react';

interface Lesson4_1Props {
  onComplete: (score: number, progress: LessonProgress) => void;
  onExit: () => void;
}

const Lesson4_1_PlanificacionFinanciera_Bernheim: React.FC<Lesson4_1Props> = ({ onComplete, onExit }) => {
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
            <Map className="h-5 w-5" />
            Herramienta: Calculadora de Valor Presente de Metas Futuras
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-green-100 p-4 rounded-lg">
            <h4 className="font-bold text-green-800 mb-2">Pasos para usar la herramienta:</h4>
            <ol className="list-decimal list-inside space-y-2 text-sm text-green-700">
              <li><strong>Definir meta futura específica:</strong> Costo exacto y fecha objetivo</li>
              <li><strong>Estimar inflación:</strong> Ajustar costo futuro por inflación anual (3-5%)</li>
              <li><strong>Calcular valor presente necesario:</strong> ¿Cuánto ahorrar hoy?</li>
              <li><strong>Determinar contribución mensual:</strong> Dividir entre meses disponibles</li>
              <li><strong>Ajustar por capacidad real:</strong> Considerar ingresos y gastos actuales</li>
            </ol>
          </div>
          
          <FuturePlanningCalculator />
          
          <div className="bg-gray-100 p-3 rounded-lg">
            <p className="text-sm text-gray-700">
              <strong>Principio clave:</strong> El dinero vale menos en el futuro (inflación), pero el tiempo te da ventaja (interés compuesto)
            </p>
            <p className="text-xs text-gray-600 mt-1">
              *Planificar temprano = menor contribución mensual requerida
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // ETAPA 2: DECISIONES DE VALUACIÓN - TAREAS PAREADAS
  const pairedTask: PairedTask = {
    id: 'future-planning-calculation',
    complexProblem: {
      question: "Diego, 15 años, quiere estudiar medicina (costo estimado hoy: $500,000). La universidad será en 3 años. Con inflación del 4% anual, el costo será $562,500. Si puede conseguir 3% interés anual y ahorrar mensualmente, ¿cuánto debe ahorrar cada mes para llegar a la meta?",
      context: "Diego debe calcular contribuciones mensuales considerando tanto inflación como interés compuesto.",
      correctAnswer: 14800,
      explanation: "Valor futuro necesario: $562,500. Con 3% anual por 36 meses, necesita ahorrar aproximadamente $14,800/mes. (Nota: cantidad muy alta, necesitará estrategias adicionales)"
    },
    transparentProblem: {
      question: "Si necesitas $562,500 en 3 años ahorrando mensualmente sin interés, ¿cuánto ahorras cada mes?",
      context: "Cálculo directo sin considerar interés compuesto.",
      correctAnswer: 15625,
      explanation: "Ahorro mensual = $562,500 ÷ 36 meses = $15,625/mes"
    }
  };

  // Tarea pareada más realista para efectos heterogéneos
  const pairedTaskRealistic: PairedTask = {
    id: 'realistic-planning-assessment',
    complexProblem: {
      question: "Ana, 14 años, quiere ahorrar para universidad. Meta realista: $50,000 en 4 años. Puede ahorrar $600/mes trabajando medio tiempo. Con 2% de interés anual, ¿tendrá suficiente dinero para su meta universitaria?",
      context: "Ana debe evaluar si su plan de ahorro realista le permitirá alcanzar su meta educativa.",
      correctAnswer: 31500,
      explanation: "En 4 años ahorrando $600/mes con 2% interés ≈ $31,500. No es suficiente para $50,000. Necesita ajustar la meta o aumentar ahorros."
    },
    transparentProblem: {
      question: "Si ahorras $600 cada mes por 48 meses, ¿cuánto dinero tendrás?",
      context: "Cálculo directo de ahorros sin interés.",
      correctAnswer: 28800,
      explanation: "$600/mes × 48 meses = $28,800"
    }
  };

  const [currentPairedTask, setCurrentPairedTask] = useState<PairedTask>(pairedTaskRealistic);
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
      setCurrentPairedTask(pairedTask);
      return;
    }
    
    // Calcular reducción de sesgo
    const avgBias = newBiasHistory.reduce((a, b) => a + Math.abs(b), 0) / newBiasHistory.length;
    const biasReduction = newBiasHistory.length > 1 ? 
      Math.abs(newBiasHistory[0]) - Math.abs(biasScore) : 0;

    const newProgress: LessonProgress = {
      conceptMastered: Math.abs(biasScore) <= 2000, // Competencia si sesgo ≤ $2000 en planificación
      biasReduction: biasReduction,
      completedTasks: [...lessonProgress.completedTasks, currentPairedTask.id],
      timeSpent: lessonProgress.timeSpent + 480 // 8 minutos estimados por tarea
    };

    setLessonProgress(newProgress);
    setCurrentStage('evaluation');
  };

  const handleComplete = () => {
    const finalScore = lessonProgress.conceptMastered ? 100 : 
      Math.max(0, 100 - (Math.abs(currentBias) / 100));
    onComplete(finalScore, lessonProgress);
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <Card className="border-2 border-purple-200">
        <CardHeader className="bg-purple-50">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-6 w-6" />
            LECCIÓN: Calculadora de Valor Presente de Metas Futuras
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <Badge variant="outline" className="bg-blue-100">
              Edad: 14-18 años
            </Badge>
            <Badge variant="outline" className="bg-green-100">
              Duración: 30-35 minutos
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
                1. CONCEPTO SUSTANTIVO: Calculadora de Valor Presente de Metas Futuras
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-gray-700">
                Aprende a usar una herramienta matemática avanzada para planificar metas financieras 
                a largo plazo considerando inflación e interés compuesto. Esta herramienta te permite 
                calcular exactamente cuánto necesitas ahorrar hoy para lograr objetivos futuros.
              </p>

              <PracticalTool
                title="Calculadora de Valor Presente de Metas Futuras"
                description="Sistema para calcular contribuciones mensuales necesarias para metas de largo plazo ajustadas por inflación"
                tool={practicalTool}
                examples={[
                  {
                    input: { meta: "$10,000 en 5 años", inflacion: "3%", interes: "4%", inicio: "Hoy" },
                    output: { metaAjustada: "$11,593", ahorroMensual: "$179", totalDepositado: "$10,740" },
                    explanation: "Meta ajustada por inflación. Con 4% interés, necesitas $179/mes durante 60 meses."
                  },
                  {
                    input: { meta: "$20,000 en 2 años", inflacion: "4%", interes: "2%", inicio: "Hoy" },
                    output: { metaAjustada: "$21,632", ahorroMensual: "$875", totalDepositado: "$21,000" },
                    explanation: "Con baja tasa de interés, necesitas ahorrar casi todo el monto ($875×24≈$21,000)."
                  },
                  {
                    input: { meta: "$5,000 en 10 años", inflacion: "5%", interes: "6%", inicio: "Hoy" },
                    output: { metaAjustada: "$8,144", ahorroMensual: "$55", totalDepositado: "$6,600" },
                    explanation: "Tiempo largo + buen interés = menor contribución mensual requerida."
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
                Practica con planificación financiera real a largo plazo. Usa la calculadora para 
                resolver ambos problemas de manera consistente. {tasksCompleted === 0 ? 
                "Primero evaluarás un plan de ahorro realista para universidad." : 
                "Ahora trabajarás con cálculos más complejos incluyendo inflación."}
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
                3. EVALUACIÓN: Competencia Deliberativa en Planificación Financiera
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <p className="text-gray-700 mb-4">
                Tu competencia se mide por la consistencia entre análisis complejos y simples de 
                planificación. Una herramienta bien dominada produce estimaciones similares 
                independientemente de la complejidad de variables como inflación e interés.
              </p>
            </CardContent>
          </Card>

          <CompetenceTracker
            biasHistory={biasHistory}
            targetReduction={4000}
            currentBias={currentBias}
          />

          {/* Métricas específicas de planificación financiera */}
          <Card className="border-purple-200">
            <CardHeader className="bg-purple-50">
              <CardTitle>Métricas de Competencia en Planificación Financiera</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-4 bg-blue-100 rounded-lg">
                  <p className="text-2xl font-bold text-blue-600">
                    {lessonProgress.conceptMastered ? 'DOMINADO' : 'EN PROGRESO'}
                  </p>
                  <p className="text-sm text-blue-800">Planificación a Largo Plazo</p>
                </div>
                <div className="text-center p-4 bg-green-100 rounded-lg">
                  <p className="text-2xl font-bold text-green-600">
                    ${Math.abs(currentBias).toLocaleString()}
                  </p>
                  <p className="text-sm text-green-800">Sesgo de Estimación</p>
                </div>
                <div className="text-center p-4 bg-orange-100 rounded-lg">
                  <p className="text-2xl font-bold text-orange-600">
                    {tasksCompleted}/2
                  </p>
                  <p className="text-sm text-orange-800">Planes Evaluados</p>
                </div>
              </div>

              {/* Interpretación del sesgo específica para planificación financiera */}
              {Math.abs(currentBias) <= 2000 && (
                <Alert className="border-green-200 bg-green-50">
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>¡Excelente dominio de la planificación financiera!</strong> Tus cálculos son muy precisos. 
                    Puedes crear planes realistas para metas a largo plazo considerando múltiples variables.
                  </AlertDescription>
                </Alert>
              )}

              {Math.abs(currentBias) > 2000 && Math.abs(currentBias) <= 6000 && (
                <Alert className="border-yellow-200 bg-yellow-50">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Buen progreso en planificación a largo plazo.</strong> Hay diferencias en tus estimaciones. 
                    Practica más para mejorar la precisión con variables complejas como inflación.
                  </AlertDescription>
                </Alert>
              )}

              {Math.abs(currentBias) > 6000 && (
                <Alert className="border-red-200 bg-red-50">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Necesita más práctica con planificación compleja.</strong> Las diferencias en tus cálculos 
                    sugieren dificultad con conceptos de valor temporal del dinero.
                  </AlertDescription>
                </Alert>
              )}

              {/* Efectos heterogéneos - consejos personalizados */}
              <Card className="bg-blue-50 border-blue-200">
                <CardContent className="p-4">
                  <h4 className="font-bold text-blue-800 mb-2">Perfil de Planificador Personal:</h4>
                  {currentBias > 4000 && (
                    <p className="text-sm text-blue-700">
                      Tiendes a ser optimista con la planificación a largo plazo, subestimando costos futuros. 
                      Esto puede llevar a planes poco realistas. Usa la herramienta para ser más conservador.
                    </p>
                  )}
                  {currentBias < -4000 && (
                    <p className="text-sm text-blue-700">
                      Eres muy conservador/pesimista en planificación, sobrestimando dificultades futuras. 
                      Aunque la prudencia es buena, no subestimes el poder del tiempo y interés compuesto.
                    </p>
                  )}
                  {Math.abs(currentBias) <= 4000 && (
                    <p className="text-sm text-blue-700">
                      ¡Tienes un excelente balance en planificación financiera! Puedes crear planes realistas 
                      pero ambiciosos para metas importantes como educación o independencia financiera.
                    </p>
                  )}
                </CardContent>
              </Card>

              <Button 
                onClick={handleComplete}
                className="w-full bg-green-600 hover:bg-green-700"
              >
                Completar Lección de Planificación Financiera
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

// Componente auxiliar para la calculadora de planificación futura
const FuturePlanningCalculator: React.FC = () => {
  const [goalAmount, setGoalAmount] = useState<number>(0);
  const [yearsToGoal, setYearsToGoal] = useState<number>(0);
  const [inflationRate, setInflationRate] = useState<number>(3);
  const [interestRate, setInterestRate] = useState<number>(4);
  const [currentAge, setCurrentAge] = useState<number>(15);

  const calculatePlan = () => {
    if (goalAmount <= 0 || yearsToGoal <= 0) {
      return { futureValue: 0, monthlyRequired: 0, totalDeposits: 0, interestEarned: 0 };
    }
    
    // Ajustar meta por inflación
    const inflationAdjustedGoal = goalAmount * Math.pow(1 + inflationRate/100, yearsToGoal);
    
    // Calcular ahorro mensual necesario con interés compuesto
    const monthlyRate = interestRate / 100 / 12;
    const totalMonths = yearsToGoal * 12;
    
    let monthlyRequired;
    if (monthlyRate === 0) {
      monthlyRequired = inflationAdjustedGoal / totalMonths;
    } else {
      monthlyRequired = (inflationAdjustedGoal * monthlyRate) / 
                       (Math.pow(1 + monthlyRate, totalMonths) - 1);
    }
    
    const totalDeposits = monthlyRequired * totalMonths;
    const interestEarned = inflationAdjustedGoal - totalDeposits;
    
    return {
      futureValue: Math.round(inflationAdjustedGoal),
      monthlyRequired: Math.round(monthlyRequired),
      totalDeposits: Math.round(totalDeposits),
      interestEarned: Math.round(interestEarned),
      ageAtGoal: currentAge + yearsToGoal
    };
  };

  const resetCalculator = () => {
    setGoalAmount(0);
    setYearsToGoal(0);
    setInflationRate(3);
    setInterestRate(4);
    setCurrentAge(15);
  };

  const plan = calculatePlan();

  return (
    <div className="bg-white p-4 border rounded-lg space-y-4">
      <h4 className="font-bold mb-3">Planificador de Metas a Largo Plazo</h4>
      
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1">Meta financiera ($)</label>
          <Input
            type="number"
            value={goalAmount || ''}
            onChange={(e) => setGoalAmount(Number(e.target.value))}
            placeholder="50000"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Años para lograrla</label>
          <Input
            type="number"
            value={yearsToGoal || ''}
            onChange={(e) => setYearsToGoal(Number(e.target.value))}
            placeholder="5"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Inflación anual (%)</label>
          <Input
            type="number"
            step="0.1"
            value={inflationRate}
            onChange={(e) => setInflationRate(Number(e.target.value))}
            placeholder="3"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Interés anual (%)</label>
          <Input
            type="number"
            step="0.1"
            value={interestRate}
            onChange={(e) => setInterestRate(Number(e.target.value))}
            placeholder="4"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Tu edad actual</label>
        <Input
          type="number"
          value={currentAge || ''}
          onChange={(e) => setCurrentAge(Number(e.target.value))}
          placeholder="15"
        />
      </div>

      {plan.futureValue > 0 && (
        <div className="border-t pt-4 space-y-3">
          <div className="bg-yellow-50 p-3 rounded">
            <h5 className="font-medium text-yellow-800 mb-1">Plan de Ahorro:</h5>
            <p className="text-sm text-yellow-700">
              Para tener <strong>${plan.futureValue.toLocaleString()}</strong> a los {plan.ageAtGoal} años
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="text-center p-3 bg-blue-100 rounded">
              <div className="text-lg font-bold text-blue-600">${plan.monthlyRequired.toLocaleString()}</div>
              <div className="text-xs text-blue-800">Ahorro Mensual Requerido</div>
            </div>
            <div className="text-center p-3 bg-green-100 rounded">
              <div className="text-lg font-bold text-green-600">${plan.interestEarned.toLocaleString()}</div>
              <div className="text-xs text-green-800">Interés Ganado</div>
            </div>
          </div>

          {plan.monthlyRequired > 1000 && (
            <div className="bg-red-50 p-3 rounded text-sm">
              <p className="font-medium text-red-800">
                ⚠️ Alerta: $${plan.monthlyRequired}/mes puede ser muy alto. Considera ajustar la meta, 
                extender el tiempo, o buscar mejores tasas de interés.
              </p>
            </div>
          )}

          {plan.monthlyRequired <= 1000 && plan.interestEarned > 0 && (
            <div className="bg-green-50 p-3 rounded text-sm">
              <p className="font-medium text-green-800">
                ✅ Plan realista: ${plan.monthlyRequired}/mes es alcanzable. El interés compuesto 
                te ayudará con ${plan.interestEarned.toLocaleString()}.
              </p>
            </div>
          )}
        </div>
      )}

      <Button variant="outline" onClick={resetCalculator} className="w-full">
        Resetear Planificador
      </Button>
    </div>
  );
};

export default Lesson4_1_PlanificacionFinanciera_Bernheim;