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
import { Calculator, Target, CheckCircle, AlertCircle, BookOpen, BarChart3, AlertTriangle } from 'lucide-react';

interface Lesson6_2Props {
  onComplete: (score: number, progress: LessonProgress) => void;
  onExit: () => void;
}

const Lesson6_2_RiesgoRendimiento_Bernheim: React.FC<Lesson6_2Props> = ({ onComplete, onExit }) => {
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
            <BarChart3 className="h-5 w-5" />
            Herramienta: Calculadora de Ratio Riesgo-Rendimiento
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-green-100 p-4 rounded-lg">
            <h4 className="font-bold text-green-800 mb-2">Pasos para usar la herramienta:</h4>
            <ol className="list-decimal list-inside space-y-2 text-sm text-green-700">
              <li><strong>Identificar rendimiento esperado:</strong> % ganancia promedio anual histórica</li>
              <li><strong>Calcular volatilidad (riesgo):</strong> Desviación estándar de rendimientos anuales</li>
              <li><strong>Determinar ratio Sharpe:</strong> (Rendimiento - tasa libre riesgo) ÷ Volatilidad</li>
              <li><strong>Evaluar vs. alternativas:</strong> ¿Qué opción da mejor ratio riesgo-rendimiento?</li>
              <li><strong>Ajustar por tolerancia personal:</strong> Considerar perfil de riesgo individual</li>
            </ol>
          </div>
          
          <RiskReturnCalculator />
          
          <div className="bg-gray-100 p-3 rounded-lg">
            <p className="text-sm text-gray-700">
              <strong>Fórmula Sharpe:</strong> (Rendimiento - 3%) ÷ Volatilidad = Eficiencia riesgo-ajustada
            </p>
            <p className="text-xs text-gray-600 mt-1">
              *Mayor ratio Sharpe = mejor rendimiento por unidad de riesgo asumido
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // ETAPA 2: DECISIONES DE VALUACIÓN - TAREAS PAREADAS
  const pairedTask: PairedTask = {
    id: 'risk-adjusted-return-comparison',
    complexProblem: {
      question: "Carmen evalúa Fondo A (12% rendimiento esperado, 18% volatilidad) vs. Fondo B (7% rendimiento, 8% volatilidad). Tasa libre riesgo 3%. ¿Cuál fondo tiene mejor ratio Sharpe (eficiencia riesgo-ajustada)?",
      context: "Carmen debe calcular qué inversión da mejor rendimiento por cada unidad de riesgo asumido.",
      correctAnswer: 50,
      explanation: "Fondo A: (12%-3%)÷18% = 0.50. Fondo B: (7%-3%)÷8% = 0.50. Ambos tienen el mismo ratio Sharpe (0.50)."
    },
    transparentProblem: {
      question: "¿Cuál ratio es mayor: 0.50 o 0.50?",
      context: "Comparación directa de ratios Sharpe calculados.",
      correctAnswer: 0,
      explanation: "0.50 = 0.50, son iguales. Ambas inversiones son igualmente eficientes en términos riesgo-ajustados."
    }
  };

  // Tarea pareada adicional para efectos heterogéneos
  const pairedTaskAdvanced: PairedTask = {
    id: 'risk-tolerance-personalization',
    complexProblem: {
      question: "Roberto es muy conservador y se estresa con volatilidad >10%. Opciones: Fondo Conservador (5% rendimiento, 6% volatilidad) vs. Fondo Balanceado (8% rendimiento, 12% volatilidad). ¿Cuál debería elegir considerando su perfil?",
      context: "Roberto debe balancear eficiencia matemática con su tolerancia personal al riesgo y estrés.",
      correctAnswer: 5,
      explanation: "Aunque el Fondo Balanceado tiene mejor ratio Sharpe, Roberto debe elegir el Conservador (5% rendimiento) porque su volatilidad (6%) está dentro de su tolerancia personal."
    },
    transparentProblem: {
      question: "Si tu límite de comodidad es 10% de volatilidad, ¿eliges 6% volatilidad o 12% volatilidad?",
      context: "Elección directa basada en límites de tolerancia personal.",
      correctAnswer: 6,
      explanation: "6% volatilidad está dentro del límite de comodidad de 10%, mientras que 12% lo excede."
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
      conceptMastered: Math.abs(biasScore) <= 0.1,
      biasReduction: biasReduction,
      completedTasks: [...lessonProgress.completedTasks, currentPairedTask.id],
      timeSpent: lessonProgress.timeSpent + 480
    };

    setLessonProgress(newProgress);
    setCurrentStage('evaluation');
  };

  const handleComplete = () => {
    const finalScore = lessonProgress.conceptMastered ? 100 : 
      Math.max(0, 100 - (Math.abs(currentBias) * 100));
    onComplete(finalScore, lessonProgress);
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <Card className="border-2 border-purple-200">
        <CardHeader className="bg-purple-50">
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-6 w-6" />
            LECCIÓN: Calculadora de Ratio Riesgo-Rendimiento
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
                1. CONCEPTO SUSTANTIVO: Calculadora de Ratio Riesgo-Rendimiento
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-gray-700">
                Aprende a usar una herramienta matemática profesional (ratio Sharpe) para evaluar 
                la eficiencia de inversiones considerando tanto rendimiento como riesgo. Esta herramienta 
                te permite comparar opciones de manera objetiva.
              </p>

              <PracticalTool
                title="Calculadora de Ratio Riesgo-Rendimiento"
                description="Sistema profesional para evaluar inversiones usando el ratio Sharpe: rendimiento ajustado por riesgo"
                tool={practicalTool}
                examples={[
                  {
                    input: { rendimiento: "10%", volatilidad: "15%", libreRiesgo: "3%" },
                    output: { ratioSharpe: "0.47", calificacion: "Moderado" },
                    explanation: "Ratio Sharpe = (10%-3%)÷15% = 0.47. Rendimiento decente ajustado por riesgo."
                  },
                  {
                    input: { rendimiento: "8%", volatilidad: "10%", libreRiesgo: "3%" },
                    output: { ratioSharpe: "0.50", calificacion: "Bueno" },
                    explanation: "Ratio Sharpe = (8%-3%)÷10% = 0.50. Mejor eficiencia que el anterior."
                  },
                  {
                    input: { rendimiento: "15%", volatilidad: "25%", libreRiesgo: "3%" },
                    output: { ratioSharpe: "0.48", calificacion: "Moderado" },
                    explanation: "Ratio Sharpe = (15%-3%)÷25% = 0.48. Alto rendimiento pero muy riesgoso."
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

      {/* Navigation */}
      <div className="flex justify-between items-center">
        <Button variant="outline" onClick={onExit}>
          Salir
        </Button>
      </div>
    </div>
  );
};

// Componente auxiliar simplificado
const RiskReturnCalculator: React.FC = () => {
  const [return1, setReturn1] = useState<number>(8);
  const [volatility1, setVolatility1] = useState<number>(12);
  const [return2, setReturn2] = useState<number>(10);
  const [volatility2, setVolatility2] = useState<number>(18);
  const [riskFreeRate] = useState<number>(3); // Fijo para simplificar

  const calculateSharpe = (returnRate: number, volatility: number) => {
    return (returnRate - riskFreeRate) / volatility;
  };

  const sharpe1 = calculateSharpe(return1, volatility1);
  const sharpe2 = calculateSharpe(return2, volatility2);

  return (
    <div className="bg-white p-4 border rounded-lg space-y-4">
      <h4 className="font-bold mb-3">Comparador de Eficiencia Riesgo-Rendimiento</h4>
      
      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-3 p-3 bg-blue-50 rounded">
          <h5 className="font-medium text-blue-800">Opción A</h5>
          <div>
            <label className="block text-xs font-medium mb-1">Rendimiento esperado (%)</label>
            <Input
              type="number"
              step="0.1"
              value={return1}
              onChange={(e) => setReturn1(Number(e.target.value))}
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Volatilidad (%)</label>
            <Input
              type="number"
              step="0.1"
              value={volatility1}
              onChange={(e) => setVolatility1(Number(e.target.value))}
            />
          </div>
          <div className="text-center p-2 bg-white rounded">
            <div className="text-lg font-bold text-blue-600">{sharpe1.toFixed(3)}</div>
            <div className="text-xs text-blue-800">Ratio Sharpe</div>
          </div>
        </div>

        <div className="space-y-3 p-3 bg-green-50 rounded">
          <h5 className="font-medium text-green-800">Opción B</h5>
          <div>
            <label className="block text-xs font-medium mb-1">Rendimiento esperado (%)</label>
            <Input
              type="number"
              step="0.1"
              value={return2}
              onChange={(e) => setReturn2(Number(e.target.value))}
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Volatilidad (%)</label>
            <Input
              type="number"
              step="0.1"
              value={volatility2}
              onChange={(e) => setVolatility2(Number(e.target.value))}
            />
          </div>
          <div className="text-center p-2 bg-white rounded">
            <div className="text-lg font-bold text-green-600">{sharpe2.toFixed(3)}</div>
            <div className="text-xs text-green-800">Ratio Sharpe</div>
          </div>
        </div>
      </div>

      <div className="border-t pt-3">
        {sharpe1 > sharpe2 && (
          <div className="bg-blue-100 p-3 rounded text-sm">
            <strong>Recomendación:</strong> Opción A es más eficiente (ratio {sharpe1.toFixed(3)} vs {sharpe2.toFixed(3)})
          </div>
        )}
        {sharpe2 > sharpe1 && (
          <div className="bg-green-100 p-3 rounded text-sm">
            <strong>Recomendación:</strong> Opción B es más eficiente (ratio {sharpe2.toFixed(3)} vs {sharpe1.toFixed(3)})
          </div>
        )}
        {Math.abs(sharpe1 - sharpe2) < 0.05 && (
          <div className="bg-yellow-100 p-3 rounded text-sm">
            <strong>Resultado:</strong> Ambas opciones son igualmente eficientes (diferencia &lt; 0.05)
          </div>
        )}
      </div>
    </div>
  );
};

export default Lesson6_2_RiesgoRendimiento_Bernheim;