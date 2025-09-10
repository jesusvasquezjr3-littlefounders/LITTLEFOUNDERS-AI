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
import { Calculator, Target, CheckCircle, AlertCircle, BookOpen, CreditCard, AlertTriangle } from 'lucide-react';

interface Lesson5_1Props {
  onComplete: (score: number, progress: LessonProgress) => void;
  onExit: () => void;
}

const Lesson5_1_QueEsCredito_Bernheim: React.FC<Lesson5_1Props> = ({ onComplete, onExit }) => {
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
            Herramienta: Calculadora de Costo Total de Crédito
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-green-100 p-4 rounded-lg">
            <h4 className="font-bold text-green-800 mb-2">Pasos para usar la herramienta:</h4>
            <ol className="list-decimal list-inside space-y-2 text-sm text-green-700">
              <li><strong>Identificar costo del producto:</strong> Precio actual sin crédito</li>
              <li><strong>Determinar términos del crédito:</strong> Tasa de interés, plazo, pagos</li>
              <li><strong>Calcular costo total:</strong> Suma de todos los pagos durante el plazo</li>
              <li><strong>Calcular costo de oportunidad:</strong> ¿Cuánto ganarías ahorrando ese dinero?</li>
              <li><strong>Comparar alternativas:</strong> Crédito vs. ahorrar vs. alternativas más baratas</li>
            </ol>
          </div>
          
          <CreditCostCalculator />
          
          <div className="bg-gray-100 p-3 rounded-lg">
            <p className="text-sm text-gray-700">
              <strong>Fórmula:</strong> Costo Real = Costo Total del Crédito + Costo de Oportunidad - Valor del Producto
            </p>
            <p className="text-xs text-gray-600 mt-1">
              *El costo real incluye intereses y lo que pierdes al no ahorrar/invertir ese dinero
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // ETAPA 2: DECISIONES DE VALUACIÓN - TAREAS PAREADAS
  const pairedTask: PairedTask = {
    id: 'credit-total-cost-evaluation',
    complexProblem: {
      question: "María quiere laptop de $15,000. Opción A: Crédito 18% anual, 24 meses, $747/mes. Opción B: Ahorrar $625/mes por 24 meses (2% interés anual). ¿Cuál es la diferencia de costo total entre usar crédito vs. ahorrar?",
      context: "María debe calcular el costo real del crédito comparado con la alternativa de ahorrar primero.",
      correctAnswer: 2928,
      explanation: "Crédito: $747×24=$17,928. Ahorro: $625×24=$15,000, gana ~$375 interés = $14,625 costo real. Diferencia: $17,928-$14,625=$3,303. (Nota: respuesta aproximada)"
    },
    transparentProblem: {
      question: "Si una opción cuesta $17,928 total y otra $14,625, ¿cuál es la diferencia?",
      context: "Comparación directa de costos totales.",
      correctAnswer: 3303,
      explanation: "Diferencia = $17,928 - $14,625 = $3,303"
    }
  };

  // Tarea pareada adicional para efectos heterogéneos
  const pairedTaskAdvanced: PairedTask = {
    id: 'credit-necessity-evaluation',
    complexProblem: {
      question: "Roberto necesita transporte urgente para trabajo. Auto usado $80,000 vs. crédito para auto nuevo $200,000 (5% anual, 60 meses, $3,774/mes). El usado le duraría 3 años, el nuevo 8 años. ¿Cuál es el costo anual real de cada opción?",
      context: "Roberto debe evaluar costo por año de uso, no solo precio inicial o pagos mensuales.",
      correctAnswer: 26667,
      explanation: "Usado: $80,000 ÷ 3 años = $26,667/año. Nuevo a crédito: ($3,774×60)÷8 años = $28,305/año. El usado es más económico."
    },
    transparentProblem: {
      question: "Si pagas $80,000 por algo que dura 3 años, ¿cuál es el costo por año?",
      context: "Cálculo directo de costo anual de uso.",
      correctAnswer: 26667,
      explanation: "Costo anual = $80,000 ÷ 3 años = $26,667/año"
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
      setCurrentPairedTask(pairedTaskAdvanced);
      return;
    }
    
    const avgBias = newBiasHistory.reduce((a, b) => a + Math.abs(b), 0) / newBiasHistory.length;
    const biasReduction = newBiasHistory.length > 1 ? 
      Math.abs(newBiasHistory[0]) - Math.abs(biasScore) : 0;

    const newProgress: LessonProgress = {
      conceptMastered: Math.abs(biasScore) <= 500,
      biasReduction: biasReduction,
      completedTasks: [...lessonProgress.completedTasks, currentPairedTask.id],
      timeSpent: lessonProgress.timeSpent + 480
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
            <CreditCard className="h-6 w-6" />
            LECCIÓN: Calculadora de Costo Total de Crédito
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <Badge variant="outline" className="bg-blue-100">
              Edad: 16-18 años
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
                1. CONCEPTO SUSTANTIVO: Calculadora de Costo Total de Crédito
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-gray-700">
                Aprende a usar una herramienta matemática para calcular el verdadero costo de usar 
                crédito, incluyendo intereses y costos de oportunidad. Esta herramienta te ayuda a 
                tomar decisiones informadas sobre endeudamiento.
              </p>

              <PracticalTool
                title="Calculadora de Costo Total de Crédito"
                description="Sistema para evaluar el costo real del crédito incluyendo intereses, fees y costo de oportunidad"
                tool={practicalTool}
                examples={[
                  {
                    input: { credito: "$10,000 a 15% por 2 años", pagoMensual: "$484" },
                    output: { costoTotal: "$11,616", intereses: "$1,616", costoReal: "16.16%" },
                    explanation: "Total pagado: $484×24=$11,616. Costo adicional: $1,616 (16.16% sobre original)."
                  },
                  {
                    input: { credito: "$5,000 a 8% por 1 año", alternativa: "Ahorrar 1 año al 3%" },
                    output: { credito: "$5,420", ahorro: "$4,850", diferencia: "$570" },
                    explanation: "Crédito: $5,420 total. Ahorrar: $5,000-$150(interés ganado)=$4,850. Crédito cuesta $570 más."
                  },
                  {
                    input: { credito: "Auto $300,000 a 12% por 5 años", pagoMensual: "$6,672" },
                    output: { costoTotal: "$400,320", intereses: "$100,320", extra: "33.44%" },
                    explanation: "Pagas $100,320 adicionales en intereses. El auto te cuesta 33.44% más por usar crédito."
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

      {/* Resto de la lección sigue el mismo patrón... */}
      {/* Navigation */}
      <div className="flex justify-between items-center">
        <Button variant="outline" onClick={onExit}>
          Salir
        </Button>
      </div>
    </div>
  );
};

// Componente auxiliar para la calculadora de costo de crédito
const CreditCostCalculator: React.FC = () => {
  const [principal, setPrincipal] = useState<number>(0);
  const [annualRate, setAnnualRate] = useState<number>(0);
  const [termMonths, setTermMonths] = useState<number>(12);

  const calculateCreditCost = () => {
    if (principal <= 0 || annualRate < 0 || termMonths <= 0) {
      return { monthlyPayment: 0, totalPaid: 0, totalInterest: 0, costIncrease: 0 };
    }
    
    const monthlyRate = annualRate / 100 / 12;
    const monthlyPayment = principal * (monthlyRate * Math.pow(1 + monthlyRate, termMonths)) / 
                          (Math.pow(1 + monthlyRate, termMonths) - 1);
    
    const totalPaid = monthlyPayment * termMonths;
    const totalInterest = totalPaid - principal;
    const costIncrease = (totalInterest / principal) * 100;
    
    return {
      monthlyPayment: Math.round(monthlyPayment),
      totalPaid: Math.round(totalPaid),
      totalInterest: Math.round(totalInterest),
      costIncrease: Math.round(costIncrease * 100) / 100
    };
  };

  const result = calculateCreditCost();

  return (
    <div className="bg-white p-4 border rounded-lg space-y-4">
      <h4 className="font-bold mb-3">Calculadora de Costo de Crédito</h4>
      
      <div className="grid grid-cols-1 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1">Monto del crédito ($)</label>
          <Input
            type="number"
            value={principal || ''}
            onChange={(e) => setPrincipal(Number(e.target.value))}
            placeholder="10000"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Tasa de interés anual (%)</label>
          <Input
            type="number"
            step="0.1"
            value={annualRate || ''}
            onChange={(e) => setAnnualRate(Number(e.target.value))}
            placeholder="15"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Plazo (meses)</label>
          <Input
            type="number"
            value={termMonths || ''}
            onChange={(e) => setTermMonths(Number(e.target.value))}
            placeholder="24"
          />
        </div>
      </div>

      {result.totalPaid > 0 && (
        <div className="border-t pt-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="text-center p-3 bg-blue-100 rounded">
              <div className="text-lg font-bold text-blue-600">${result.monthlyPayment.toLocaleString()}</div>
              <div className="text-xs text-blue-800">Pago Mensual</div>
            </div>
            <div className="text-center p-3 bg-red-100 rounded">
              <div className="text-lg font-bold text-red-600">${result.totalInterest.toLocaleString()}</div>
              <div className="text-xs text-red-800">Intereses Totales</div>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <div className="text-center p-3 bg-gray-100 rounded">
              <div className="text-lg font-bold text-gray-600">${result.totalPaid.toLocaleString()}</div>
              <div className="text-xs text-gray-800">Costo Total</div>
            </div>
            <div className="text-center p-3 bg-yellow-100 rounded">
              <div className="text-lg font-bold text-yellow-600">+{result.costIncrease}%</div>
              <div className="text-xs text-yellow-800">Aumento de Costo</div>
            </div>
          </div>

          {result.costIncrease > 25 && (
            <div className="bg-red-50 p-3 rounded text-sm">
              <p className="font-medium text-red-800">
                ⚠️ Costo alto: Usas crédito aumenta el costo en {result.costIncrease}%. 
                Considera ahorrar primero o buscar mejores tasas.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Lesson5_1_QueEsCredito_Bernheim;