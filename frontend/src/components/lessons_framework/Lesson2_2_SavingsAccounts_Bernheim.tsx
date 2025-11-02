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
import { Calculator, Target, CheckCircle, AlertCircle, BookOpen, TrendingUp, PiggyBank } from 'lucide-react';

interface Lesson2_2Props {
  onComplete: (score: number, progress: LessonProgress) => void;
  onExit: () => void;
}

const Lesson2_2_SavingsAccounts_Bernheim: React.FC<Lesson2_2Props> = ({ onComplete, onExit }) => {
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
            <TrendingUp className="h-5 w-5" />
            Herramienta: Calculadora de Interés Compuesto
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-green-100 p-4 rounded-lg">
            <h4 className="font-bold text-green-800 mb-2">Pasos para usar la herramienta:</h4>
            <ol className="list-decimal list-inside space-y-2 text-sm text-green-700">
              <li><strong>Establecer variables:</strong> Monto inicial, ahorro mensual, tasa anual</li>
              <li><strong>Determinar periodo:</strong> ¿Cuántos años vas a ahorrar?</li>
              <li><strong>Aplicar fórmula compuesta:</strong> A = P(1+r/12)^(12t) + PMT[(1+r/12)^(12t)-1]/(r/12)</li>
              <li><strong>Calcular interés ganado:</strong> Monto final - Total depositado</li>
              <li><strong>Comparar escenarios:</strong> Evaluar diferentes tasas y periodos</li>
            </ol>
          </div>
          
          <CompoundInterestCalculator />
          
          <div className="bg-gray-100 p-3 rounded-lg">
            <p className="text-sm text-gray-700">
              <strong>Principio clave:</strong> El interés compuesto hace que ganes intereses sobre tus intereses
            </p>
            <p className="text-xs text-gray-600 mt-1">
              *Cuanto más tiempo ahorres, más exponencial se vuelve el crecimiento
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // ETAPA 2: DECISIONES DE VALUACIÓN - TAREAS PAREADAS
  const pairedTask: PairedTask = {
    id: 'compound-interest-calculation',
    complexProblem: {
      question: "Elena tiene $200 inicial y puede ahorrar $50 mensuales. Banco A ofrece 3% anual compuesto mensualmente, Banco B ofrece 4.5% anual compuesto anualmente. ¿Cuánto más dinero tendrá Elena en Banco A después de 2 años?",
      context: "Elena debe calcular el valor futuro con interés compuesto considerando diferentes frecuencias de capitalización.",
      correctAnswer: 1348,
      explanation: "Banco A (3% mensual): FV ≈ $1,348. Banco B (4.5% anual): FV ≈ $1,340. Banco A da $8 más por la capitalización mensual."
    },
    transparentProblem: {
      question: "Si una cuenta te da $1,348 después de 2 años y otra te da $1,340, ¿cuál es la diferencia a favor de la primera?",
      context: "Comparación directa de valores finales.",
      correctAnswer: 8,
      explanation: "Diferencia = $1,348 - $1,340 = $8 a favor de la primera cuenta."
    }
  };

  // Tarea pareada adicional para efectos heterogéneos
  const pairedTaskAdvanced: PairedTask = {
    id: 'time-value-comparison',
    complexProblem: {
      question: "Roberto puede empezar a ahorrar ahora ($30/mes a 2.5% por 5 años) o esperar 2 años y ahorrar más ($50/mes a 2.5% por 3 años). ¿Cuánto dinero extra tendrá si empieza ahora vs. si espera?",
      context: "Roberto debe entender el valor del tiempo en el interés compuesto.",
      correctAnswer: 1896,
      explanation: "Empezar ahora: FV ≈ $1,896. Esperar 2 años: FV ≈ $1,863. Empezar ahora da $33 más por el efecto del tiempo compuesto."
    },
    transparentProblem: {
      question: "Si empezar ahora te da $1,896 y esperar te da $1,863, ¿cuánto pierdes por esperar?",
      context: "Comparación directa del costo de oportunidad del tiempo.",
      correctAnswer: 33,
      explanation: "Costo de esperar = $1,896 - $1,863 = $33 perdidos por no empezar antes."
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
      conceptMastered: Math.abs(biasScore) <= 8, // Competencia si sesgo ≤ $8 en cálculos
      biasReduction: biasReduction,
      completedTasks: [...lessonProgress.completedTasks, currentPairedTask.id],
      timeSpent: lessonProgress.timeSpent + 420 // 7 minutos estimados por tarea
    };

    setLessonProgress(newProgress);
    setCurrentStage('evaluation');
  };

  const handleComplete = () => {
    const finalScore = lessonProgress.conceptMastered ? 100 : 
      Math.max(0, 100 - Math.abs(currentBias));
    onComplete(finalScore, lessonProgress);
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <Card className="border-2 border-purple-200">
        <CardHeader className="bg-purple-50">
          <CardTitle className="flex items-center gap-2">
            <PiggyBank className="h-6 w-6" />
            LECCIÓN: Calculadora de Interés Compuesto
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
                1. CONCEPTO SUSTANTIVO: Calculadora de Interés Compuesto
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-gray-700">
                Aprende a usar una herramienta matemática para calcular exactamente cómo crecerán 
                tus ahorros con interés compuesto. Esta herramienta te permite comparar diferentes 
                escenarios y entender el verdadero poder del tiempo en las inversiones.
              </p>

              <PracticalTool
                title="Calculadora de Interés Compuesto"
                description="Sistema matemático para proyectar crecimiento de ahorros con capitalización de intereses"
                tool={practicalTool}
                examples={[
                  {
                    input: { inicial: "$100", mensual: "$20", tasa: "3%", años: "2" },
                    output: { final: "$562", intereses: "$82", total_depositado: "$580" },
                    explanation: "Con $100 inicial + $20×24 meses = $580 depositados. Interés compuesto genera $82 extra."
                  },
                  {
                    input: { inicial: "$0", mensual: "$50", tasa: "4%", años: "5" },
                    output: { final: "$3,306", intereses: "$306", total_depositado: "$3,000" },
                    explanation: "$50×60 meses = $3,000 depositados. Interés compuesto añade $306 de crecimiento."
                  },
                  {
                    input: { inicial: "$500", mensual: "$0", tasa: "5%", años: "10" },
                    output: { final: "$814", intereses: "$314", total_depositado: "$500" },
                    explanation: "Solo $500 inicial. En 10 años con 5% compuesto crece a $814 (+$314 de intereses)."
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
                Practica con cálculos reales de interés compuesto. Usa la calculadora para resolver 
                ambos problemas de manera consistente. {tasksCompleted === 0 ? 
                "Primero compararás diferentes opciones de cuentas de ahorro." : 
                "Ahora evaluarás el costo de esperar vs. empezar a ahorrar inmediatamente."}
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
                3. EVALUACIÓN: Competencia Deliberativa en Interés Compuesto
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <p className="text-gray-700 mb-4">
                Tu competencia se mide por la consistencia entre cálculos complejos y simples de 
                interés compuesto. Una herramienta bien dominada produce estimaciones similares 
                independientemente de la complejidad de las variables.
              </p>
            </CardContent>
          </Card>

          <CompetenceTracker
            biasHistory={biasHistory}
            targetReduction={15}
            currentBias={currentBias}
          />

          {/* Métricas específicas del interés compuesto */}
          <Card className="border-purple-200">
            <CardHeader className="bg-purple-50">
              <CardTitle>Métricas de Competencia en Interés Compuesto</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-4 bg-blue-100 rounded-lg">
                  <p className="text-2xl font-bold text-blue-600">
                    {lessonProgress.conceptMastered ? 'DOMINADO' : 'EN PROGRESO'}
                  </p>
                  <p className="text-sm text-blue-800">Cálculos Compuestos</p>
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
                  <p className="text-sm text-orange-800">Cálculos Realizados</p>
                </div>
              </div>

              {/* Interpretación del sesgo específica para interés compuesto */}
              {Math.abs(currentBias) <= 8 && (
                <Alert className="border-green-200 bg-green-50">
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>¡Excelente dominio del interés compuesto!</strong> Tus cálculos son muy precisos. 
                    Entiendes perfectamente cómo el tiempo y las tasas afectan el crecimiento del dinero.
                  </AlertDescription>
                </Alert>
              )}

              {Math.abs(currentBias) > 8 && Math.abs(currentBias) <= 25 && (
                <Alert className="border-yellow-200 bg-yellow-50">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Buen progreso con cálculos de interés compuesto.</strong> Hay diferencias menores en tus estimaciones. 
                    Practica más para mejorar la precisión en escenarios complejos.
                  </AlertDescription>
                </Alert>
              )}

              {Math.abs(currentBias) > 25 && (
                <Alert className="border-red-200 bg-red-50">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Necesita más práctica con la calculadora de interés compuesto.</strong> Las diferencias en tus 
                    cálculos sugieren que debes revisar las fórmulas de capitalización.
                  </AlertDescription>
                </Alert>
              )}

              {/* Efectos heterogéneos - consejos personalizados */}
              <Card className="bg-blue-50 border-blue-200">
                <CardContent className="p-4">
                  <h4 className="font-bold text-blue-800 mb-2">Perfil de Ahorro Personal:</h4>
                  {currentBias > 20 && (
                    <p className="text-sm text-blue-700">
                      Tiendes a sobrestimar los beneficios del interés compuesto en casos complejos. Aunque 
                      es bueno ser optimista sobre el ahorro, usa cálculos precisos para planificar metas realistas.
                    </p>
                  )}
                  {currentBias < -20 && (
                    <p className="text-sm text-blue-700">
                      Tiendes a subestimar el poder del interés compuesto. Esto podría desanimarte a ahorrar 
                      a largo plazo. La herramienta te muestra el verdadero potencial del tiempo y la paciencia.
                    </p>
                  )}
                  {Math.abs(currentBias) <= 20 && (
                    <p className="text-sm text-blue-700">
                      ¡Tienes una comprensión realista del interés compuesto! Puedes usar esta herramienta 
                      para planificar metas de ahorro alcanzables y emocionantes.
                    </p>
                  )}
                </CardContent>
              </Card>

              <Button 
                onClick={handleComplete}
                className="w-full bg-green-600 hover:bg-green-700"
              >
                Completar Lección de Interés Compuesto
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

// Componente auxiliar para la calculadora de interés compuesto
const CompoundInterestCalculator: React.FC = () => {
  const [principal, setPrincipal] = useState<number>(0);
  const [monthlyDeposit, setMonthlyDeposit] = useState<number>(0);
  const [annualRate, setAnnualRate] = useState<number>(0);
  const [years, setYears] = useState<number>(0);
  const [compoundFrequency, setCompoundFrequency] = useState<number>(12); // Monthly by default

  const calculateCompoundInterest = () => {
    if (years <= 0 || annualRate < 0) return { futureValue: 0, totalDeposited: 0, interestEarned: 0 };
    
    const r = annualRate / 100;
    const n = compoundFrequency;
    const t = years;
    
    // Future value of principal
    const principalFV = principal * Math.pow(1 + r/n, n*t);
    
    // Future value of annuity (monthly deposits)
    const annuityFV = monthlyDeposit * 12 * (Math.pow(1 + r/n, n*t) - 1) / (r/n);
    
    const futureValue = principalFV + annuityFV;
    const totalDeposited = principal + (monthlyDeposit * 12 * years);
    const interestEarned = futureValue - totalDeposited;
    
    return {
      futureValue: Math.round(futureValue),
      totalDeposited: Math.round(totalDeposited), 
      interestEarned: Math.round(interestEarned)
    };
  };

  const resetCalculator = () => {
    setPrincipal(0);
    setMonthlyDeposit(0);
    setAnnualRate(0);
    setYears(0);
    setCompoundFrequency(12);
  };

  const result = calculateCompoundInterest();

  return (
    <div className="bg-white p-4 border rounded-lg space-y-4">
      <h4 className="font-bold mb-3">Calculadora de Interés Compuesto</h4>
      
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1">Monto inicial ($)</label>
          <Input
            type="number"
            value={principal || ''}
            onChange={(e) => setPrincipal(Number(e.target.value))}
            placeholder="100"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Ahorro mensual ($)</label>
          <Input
            type="number"
            value={monthlyDeposit || ''}
            onChange={(e) => setMonthlyDeposit(Number(e.target.value))}
            placeholder="50"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Tasa anual (%)</label>
          <Input
            type="number"
            step="0.1"
            value={annualRate || ''}
            onChange={(e) => setAnnualRate(Number(e.target.value))}
            placeholder="3.5"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Años</label>
          <Input
            type="number"
            value={years || ''}
            onChange={(e) => setYears(Number(e.target.value))}
            placeholder="5"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Frecuencia de capitalización</label>
        <select 
          value={compoundFrequency}
          onChange={(e) => setCompoundFrequency(Number(e.target.value))}
          className="w-full border rounded px-3 py-2 text-sm"
        >
          <option value={1}>Anualmente</option>
          <option value={4}>Trimestralmente</option>
          <option value={12}>Mensualmente</option>
          <option value={365}>Diariamente</option>
        </select>
      </div>

      {result.futureValue > 0 && (
        <div className="border-t pt-4 space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center p-3 bg-blue-100 rounded">
              <div className="text-lg font-bold text-blue-600">${result.futureValue.toLocaleString()}</div>
              <div className="text-xs text-blue-800">Valor Final</div>
            </div>
            <div className="text-center p-3 bg-gray-100 rounded">
              <div className="text-lg font-bold text-gray-600">${result.totalDeposited.toLocaleString()}</div>
              <div className="text-xs text-gray-800">Total Depositado</div>
            </div>
            <div className="text-center p-3 bg-green-100 rounded">
              <div className="text-lg font-bold text-green-600">${result.interestEarned.toLocaleString()}</div>
              <div className="text-xs text-green-800">Interés Ganado</div>
            </div>
          </div>

          {result.interestEarned > 0 && (
            <div className="bg-yellow-50 p-3 rounded text-sm">
              <p className="font-medium text-yellow-800">
                El poder del interés compuesto: Tu dinero creció un {((result.interestEarned / result.totalDeposited) * 100).toFixed(1)}% extra
              </p>
            </div>
          )}
        </div>
      )}

      <Button variant="outline" onClick={resetCalculator} className="w-full">
        Resetear Calculadora
      </Button>
    </div>
  );
};

export default Lesson2_2_SavingsAccounts_Bernheim;
