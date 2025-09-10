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
import { Calculator, Target, CheckCircle, AlertCircle, BookOpen, Shield, AlertTriangle } from 'lucide-react';

interface Lesson7_2Props {
  onComplete: (score: number, progress: LessonProgress) => void;
  onExit: () => void;
}

const Lesson7_2_SegurosProteccion_Bernheim: React.FC<Lesson7_2Props> = ({ onComplete, onExit }) => {
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
            Herramienta: Calculadora de Valor Esperado de Protección
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-green-100 p-4 rounded-lg">
            <h4 className="font-bold text-green-800 mb-2">Pasos para usar la herramienta:</h4>
            <ol className="list-decimal list-inside space-y-2 text-sm text-green-700">
              <li><strong>Identificar riesgo específico:</strong> ¿Qué evento podría costarte dinero?</li>
              <li><strong>Estimar probabilidad anual:</strong> % de que ocurra en un año</li>
              <li><strong>Calcular costo potencial:</strong> ¿Cuánto te costaría si ocurre?</li>
              <li><strong>Determinar valor esperado del riesgo:</strong> Probabilidad × Costo</li>
              <li><strong>Comparar con costo del seguro:</strong> ¿Vale la pena la protección?</li>
            </ol>
          </div>
          
          <InsuranceValueCalculator />
          
          <div className="bg-gray-100 p-3 rounded-lg">
            <p className="text-sm text-gray-700">
              <strong>Fórmula:</strong> Valor Esperado = Probabilidad de pérdida × Monto de pérdida
            </p>
            <p className="text-xs text-gray-600 mt-1">
              *Si valor esperado > prima de seguro, el seguro es una buena compra
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // ETAPA 2: DECISIONES DE VALUACIÓN - TAREAS PAREADAS
  const pairedTask: PairedTask = {
    id: 'insurance-expected-value-analysis',
    complexProblem: {
      question: "Luis maneja un auto de $150,000. Probabilidad de accidente total: 0.5% anual. Seguro cuesta $3,500/año con deducible $5,000. Sin seguro, perdería $150,000 completos. ¿Cuál es el valor esperado anual de tener el seguro?",
      context: "Luis debe comparar el valor esperado de pérdida con seguro vs. sin seguro para evaluar si vale la pena.",
      correctAnswer: 725,
      explanation: "Sin seguro: 0.5% × $150,000 = $750 pérdida esperada. Con seguro: $3,500 prima + (0.5% × $5,000) = $3,525. Valor del seguro: $750 - $25 = $725 ahorro esperado anual."
    },
    transparentProblem: {
      question: "Si una opción te cuesta $750 en promedio anual y otra $25, ¿cuánto ahorras eligiendo la segunda?",
      context: "Comparación directa de costos esperados anuales.",
      correctAnswer: 725,
      explanation: "Ahorro = $750 - $25 = $725 anuales"
    }
  };

  const [currentPairedTask, setCurrentPairedTask] = useState<PairedTask>(pairedTask);
  const [tasksCompleted, setTasksCompleted] = useState<number>(0);

  const handleTaskComplete = (complexAnswer: number, transparentAnswer: number, biasScore: number) => {
    const newBiasHistory = [...biasHistory, biasScore];
    setBiasHistory(newBiasHistory);
    setCurrentBias(biasScore);
    
    const newProgress: LessonProgress = {
      conceptMastered: Math.abs(biasScore) <= 100,
      biasReduction: 0,
      completedTasks: [...lessonProgress.completedTasks, currentPairedTask.id],
      timeSpent: lessonProgress.timeSpent + 450
    };

    setLessonProgress(newProgress);
    setCurrentStage('evaluation');
  };

  const handleComplete = () => {
    const finalScore = lessonProgress.conceptMastered ? 100 : 
      Math.max(0, 100 - (Math.abs(currentBias) / 20));
    onComplete(finalScore, lessonProgress);
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <Card className="border-2 border-purple-200">
        <CardHeader className="bg-purple-50">
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-6 w-6" />
            LECCIÓN: Calculadora de Valor Esperado de Protección
          </CardTitle>
        </CardHeader>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between items-center">
        <Button variant="outline" onClick={onExit}>Salir</Button>
      </div>
    </div>
  );
};

// Componente auxiliar simplificado
const InsuranceValueCalculator: React.FC = () => {
  const [probability, setProbability] = useState<number>(1);
  const [potentialLoss, setPotentialLoss] = useState<number>(50000);
  const [insuranceCost, setInsuranceCost] = useState<number>(500);
  const [deductible, setDeductible] = useState<number>(1000);

  const expectedValueWithoutInsurance = (probability / 100) * potentialLoss;
  const expectedValueWithInsurance = insuranceCost + ((probability / 100) * deductible);
  const netValue = expectedValueWithoutInsurance - expectedValueWithInsurance;

  return (
    <div className="bg-white p-4 border rounded-lg space-y-4">
      <h4 className="font-bold mb-3">Analizador de Valor de Seguros</h4>
      
      <div className="grid grid-cols-2 gap-3">
        <Input 
          type="number" 
          step="0.1"
          placeholder="Probabilidad (%)"
          value={probability} 
          onChange={(e) => setProbability(Number(e.target.value))} 
        />
        <Input 
          type="number" 
          placeholder="Pérdida potencial ($)"
          value={potentialLoss} 
          onChange={(e) => setPotentialLoss(Number(e.target.value))} 
        />
        <Input 
          type="number" 
          placeholder="Costo seguro anual ($)"
          value={insuranceCost} 
          onChange={(e) => setInsuranceCost(Number(e.target.value))} 
        />
        <Input 
          type="number" 
          placeholder="Deducible ($)"
          value={deductible} 
          onChange={(e) => setDeductible(Number(e.target.value))} 
        />
      </div>

      <div className="border-t pt-3 space-y-2">
        <div className="text-sm">Sin seguro: ${expectedValueWithoutInsurance.toFixed(0)} pérdida esperada</div>
        <div className="text-sm">Con seguro: ${expectedValueWithInsurance.toFixed(0)} costo esperado</div>
        <div className={`text-lg font-bold ${netValue > 0 ? 'text-green-600' : 'text-red-600'}`}>
          Valor del seguro: ${netValue.toFixed(0)}/año
        </div>
      </div>
    </div>
  );
};

export default Lesson7_2_SegurosProteccion_Bernheim;