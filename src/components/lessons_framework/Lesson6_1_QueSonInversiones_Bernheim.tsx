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
import { Calculator, Target, CheckCircle, AlertCircle, BookOpen, TrendingUp, BarChart } from 'lucide-react';

interface Lesson6_1Props {
  onComplete: (score: number, progress: LessonProgress) => void;
  onExit: () => void;
}

const Lesson6_1_QueSonInversiones_Bernheim: React.FC<Lesson6_1Props> = ({ onComplete, onExit }) => {
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
            <BarChart className="h-5 w-5" />
            Herramienta: Calculadora de Retorno de Inversión
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-green-100 p-4 rounded-lg">
            <h4 className="font-bold text-green-800 mb-2">Pasos para usar la herramienta:</h4>
            <ol className="list-decimal list-inside space-y-2 text-sm text-green-700">
              <li><strong>Determinar inversión inicial:</strong> ¿Cuánto dinero vas a invertir?</li>
              <li><strong>Establecer horizonte temporal:</strong> ¿Por cuántos años?</li>
              <li><strong>Estimar retorno anual esperado:</strong> Basado en datos históricos</li>
              <li><strong>Calcular valor futuro:</strong> Usar fórmula de interés compuesto</li>
              <li><strong>Evaluar vs. alternativas:</strong> ¿Es mejor que ahorrar o gastar?</li>
            </ol>
          </div>
          
          <InvestmentReturnCalculator />
          
          <div className="bg-gray-100 p-3 rounded-lg">
            <p className="text-sm text-gray-700">
              <strong>Fórmula:</strong> Valor Futuro = Principal × (1 + tasa_anual)^años
            </p>
            <p className="text-xs text-gray-600 mt-1">
              *Los retornos pasados no garantizan retornos futuros
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // ETAPA 2: DECISIONES DE VALUACIÓN - TAREAS PAREADAS
  const pairedTask: PairedTask = {
    id: 'investment-return-comparison',
    complexProblem: {
      question: "Elena tiene $10,000. Opción A: Invertir en fondo de acciones (retorno histórico 8% anual). Opción B: Cuenta de ahorros (2% anual). Ambas por 10 años. ¿Cuánto dinero adicional tendría Elena con la inversión vs. la cuenta de ahorros?",
      context: "Elena debe comparar el valor futuro de ambas opciones para entender el beneficio real de invertir.",
      correctAnswer: 21589,
      explanation: "Inversión: $10,000×(1.08)^10=$21,589. Ahorro: $10,000×(1.02)^10=$12,190. Diferencia: $21,589-$12,190=$9,399."
    },
    transparentProblem: {
      question: "Si una opción te da $21,589 y otra $12,190 después de 10 años, ¿cuál es la diferencia?",
      context: "Comparación directa de valores futuros.",
      correctAnswer: 9399,
      explanation: "Diferencia = $21,589 - $12,190 = $9,399"
    }
  };

  // Tarea pareada adicional para efectos heterogéneos
  const pairedTaskAdvanced: PairedTask = {
    id: 'risk-tolerance-evaluation',
    complexProblem: {
      question: "Pablo es conservador y le preocupa perder dinero. Tiene $5,000 para 5 años. Opción A: Bonos gubernamentales (4% anual, sin riesgo). Opción B: Fondo mixto (7% esperado, puede bajar -20% algunos años). ¿Cuál es el PEOR escenario posible con cada opción?",
      context: "Pablo debe evaluar el peor escenario de cada inversión para su perfil conservador.",
      correctAnswer: 4000,
      explanation: "Bonos (peor escenario): $5,000×(1.04)^5=$6,083. Fondo mixto (peor escenario): $5,000×0.8=$4,000 si baja 20%. El peor caso de bonos es mejor que el peor caso del fondo."
    },
    transparentProblem: {
      question: "¿Cuál es el peor resultado: perder 20% de $5,000 o ganar 4% anual por 5 años?",
      context: "Comparación directa entre pérdida y ganancia mínima garantizada.",
      correctAnswer: 4000,
      explanation: "Perder 20% de $5,000 = $4,000 (peor). Ganar 4% por 5 años da al menos $6,083 (mejor)."
    }
  };

  const [currentPairedTask, setCurrentPairedTask] = useState<PairedTask>(pairedTask);
  const [tasksCompleted, setTasksCompleted] = useState<number>(0);

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
      conceptMastered: Math.abs(biasScore) <= 1000,
      biasReduction: biasReduction,
      completedTasks: [...lessonProgress.completedTasks, currentPairedTask.id],
      timeSpent: lessonProgress.timeSpent + 450
    };

    setLessonProgress(newProgress);
    setCurrentStage('evaluation');
  };

  const handleComplete = () => {
    const finalScore = lessonProgress.conceptMastered ? 100 : 
      Math.max(0, 100 - (Math.abs(currentBias) / 200));
    onComplete(finalScore, lessonProgress);
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header y resto de la lección siguen el patrón estándar... */}
      <Card className="border-2 border-purple-200">
        <CardHeader className="bg-purple-50">
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-6 w-6" />
            LECCIÓN: Calculadora de Retorno de Inversión
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
          </div>
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between items-center">
        <Button variant="outline" onClick={onExit}>
          Salir
        </Button>
      </div>
    </div>
  );
};

// Componente auxiliar para la calculadora de retorno de inversión
const InvestmentReturnCalculator: React.FC = () => {
  const [principal, setPrincipal] = useState<number>(0);
  const [annualReturn, setAnnualReturn] = useState<number>(0);
  const [years, setYears] = useState<number>(0);
  const [monthlyContribution, setMonthlyContribution] = useState<number>(0);

  const calculateReturns = () => {
    if (principal < 0 || years <= 0) return { futureValue: 0, totalContributions: 0, gains: 0 };
    
    // Valor futuro del principal
    const principalFV = principal * Math.pow(1 + annualReturn/100, years);
    
    // Valor futuro de contribuciones mensuales (si las hay)
    const monthlyFV = monthlyContribution > 0 ? 
      monthlyContribution * 12 * ((Math.pow(1 + annualReturn/100, years) - 1) / (annualReturn/100)) : 0;
    
    const futureValue = principalFV + monthlyFV;
    const totalContributions = principal + (monthlyContribution * 12 * years);
    const gains = futureValue - totalContributions;
    
    return {
      futureValue: Math.round(futureValue),
      totalContributions: Math.round(totalContributions),
      gains: Math.round(gains)
    };
  };

  const result = calculateReturns();

  return (
    <div className="bg-white p-4 border rounded-lg space-y-4">
      <h4 className="font-bold mb-3">Calculadora de Retorno de Inversión</h4>
      
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1">Inversión inicial ($)</label>
          <Input
            type="number"
            value={principal || ''}
            onChange={(e) => setPrincipal(Number(e.target.value))}
            placeholder="1000"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Contribución mensual ($)</label>
          <Input
            type="number"
            value={monthlyContribution || ''}
            onChange={(e) => setMonthlyContribution(Number(e.target.value))}
            placeholder="100"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Retorno esperado (%/año)</label>
          <Input
            type="number"
            step="0.1"
            value={annualReturn || ''}
            onChange={(e) => setAnnualReturn(Number(e.target.value))}
            placeholder="7"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Años de inversión</label>
          <Input
            type="number"
            value={years || ''}
            onChange={(e) => setYears(Number(e.target.value))}
            placeholder="10"
          />
        </div>
      </div>

      {result.futureValue > 0 && (
        <div className="border-t pt-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center p-3 bg-blue-100 rounded">
              <div className="text-lg font-bold text-blue-600">${result.futureValue.toLocaleString()}</div>
              <div className="text-xs text-blue-800">Valor Final</div>
            </div>
            <div className="text-center p-3 bg-gray-100 rounded">
              <div className="text-lg font-bold text-gray-600">${result.totalContributions.toLocaleString()}</div>
              <div className="text-xs text-gray-800">Invertido Total</div>
            </div>
            <div className="text-center p-3 bg-green-100 rounded">
              <div className="text-lg font-bold text-green-600">${result.gains.toLocaleString()}</div>
              <div className="text-xs text-green-800">Ganancias</div>
            </div>
          </div>

          {result.gains > 0 && (
            <div className="mt-3 bg-yellow-50 p-3 rounded text-sm">
              <p className="font-medium text-yellow-800">
                ROI: {((result.gains / result.totalContributions) * 100).toFixed(1)}% ganancia total 
                ({(result.gains / result.totalContributions / years * 100).toFixed(1)}% anualizado)
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Lesson6_1_QueSonInversiones_Bernheim;