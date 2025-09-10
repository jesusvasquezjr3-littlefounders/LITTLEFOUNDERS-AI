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
import { Calculator, Target, CheckCircle, AlertCircle, BookOpen, Home, GraduationCap } from 'lucide-react';

interface Lesson7_1Props {
  onComplete: (score: number, progress: LessonProgress) => void;
  onExit: () => void;
}

const Lesson7_1_CostosVidaIndependiente_Bernheim: React.FC<Lesson7_1Props> = ({ onComplete, onExit }) => {
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
            Herramienta: Calculadora de Costo de Vida Independiente
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-green-100 p-4 rounded-lg">
            <h4 className="font-bold text-green-800 mb-2">Pasos para usar la herramienta:</h4>
            <ol className="list-decimal list-inside space-y-2 text-sm text-green-700">
              <li><strong>Catalogar gastos obligatorios:</strong> Vivienda, servicios, comida básica, transporte</li>
              <li><strong>Estimar gastos variables:</strong> Entretenimiento, ropa, comidas fuera</li>
              <li><strong>Aplicar regla 50/30/20:</strong> Calcular ingreso mínimo necesario</li>
              <li><strong>Añadir margen de seguridad:</strong> +15% para imprevistos y inflación</li>
              <li><strong>Comparar con ingreso disponible:</strong> ¿Es factible la independencia?</li>
            </ol>
          </div>
          
          <IndependenceCostCalculator />
          
          <div className="bg-gray-100 p-3 rounded-lg">
            <p className="text-sm text-gray-700">
              <strong>Fórmula:</strong> Ingreso Mínimo Necesario = (Gastos Totales ÷ 0.85) ÷ 0.50
            </p>
            <p className="text-xs text-gray-600 mt-1">
              *Incluye margen de seguridad (15%) y regla 50% para necesidades básicas
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // ETAPA 2: DECISIONES DE VALUACIÓN - TAREAS PAREADAS
  const pairedTask: PairedTask = {
    id: 'independence-feasibility-calculation',
    complexProblem: {
      question: "Alex, 17 años, planea independizarse. Gastos estimados: renta $8,000, servicios $2,000, comida $3,000, transporte $1,500, otros $1,500. Total $16,000. Con regla 50/30/20 + 15% margen seguridad, ¿qué ingreso mínimo necesita?",
      context: "Alex debe calcular el ingreso real necesario para sostener estos gastos de manera responsable.",
      correctAnswer: 37647,
      explanation: "Gastos con margen: $16,000 × 1.15 = $18,400. Si es 50% del ingreso: $18,400 ÷ 0.50 = $36,800 ≈ $37,647 con redondeo conservador."
    },
    transparentProblem: {
      question: "Si tus necesidades básicas cuestan $18,400 y deben ser solo 50% de tu ingreso, ¿cuál debe ser tu ingreso total?",
      context: "Cálculo directo: si $18,400 = 50% del ingreso, entonces ingreso total = ?",
      correctAnswer: 36800,
      explanation: "Ingreso total = $18,400 ÷ 0.50 = $36,800"
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
    
    const avgBias = newBiasHistory.reduce((a, b) => a + Math.abs(b), 0) / newBiasHistory.length;
    const biasReduction = newBiasHistory.length > 1 ? 
      Math.abs(newBiasHistory[0]) - Math.abs(biasScore) : 0;

    const newProgress: LessonProgress = {
      conceptMastered: Math.abs(biasScore) <= 2000,
      biasReduction: biasReduction,
      completedTasks: [...lessonProgress.completedTasks, currentPairedTask.id],
      timeSpent: lessonProgress.timeSpent + 500
    };

    setLessonProgress(newProgress);
    setCurrentStage('evaluation');
  };

  const handleComplete = () => {
    const finalScore = lessonProgress.conceptMastered ? 100 : 
      Math.max(0, 100 - (Math.abs(currentBias) / 500));
    onComplete(finalScore, lessonProgress);
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <Card className="border-2 border-purple-200">
        <CardHeader className="bg-purple-50">
          <CardTitle className="flex items-center gap-2">
            <Home className="h-6 w-6" />
            LECCIÓN: Calculadora de Costo de Vida Independiente
          </CardTitle>
        </CardHeader>
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

// Componente auxiliar simplificado
const IndependenceCostCalculator: React.FC = () => {
  const [housing, setHousing] = useState<number>(8000);
  const [utilities, setUtilities] = useState<number>(2000);
  const [food, setFood] = useState<number>(3000);
  const [transport, setTransport] = useState<number>(1500);
  const [other, setOther] = useState<number>(1500);

  const totalCosts = housing + utilities + food + transport + other;
  const withMargin = Math.round(totalCosts * 1.15);
  const requiredIncome = Math.round(withMargin / 0.5);

  return (
    <div className="bg-white p-4 border rounded-lg space-y-4">
      <h4 className="font-bold mb-3">Calculadora de Independencia</h4>
      
      <div className="grid grid-cols-1 gap-3">
        <Input type="number" value={housing} onChange={(e) => setHousing(Number(e.target.value))} placeholder="Vivienda" />
        <Input type="number" value={utilities} onChange={(e) => setUtilities(Number(e.target.value))} placeholder="Servicios" />
        <Input type="number" value={food} onChange={(e) => setFood(Number(e.target.value))} placeholder="Alimentación" />
        <Input type="number" value={transport} onChange={(e) => setTransport(Number(e.target.value))} placeholder="Transporte" />
        <Input type="number" value={other} onChange={(e) => setOther(Number(e.target.value))} placeholder="Otros gastos" />
      </div>

      <div className="border-t pt-3">
        <div className="text-center space-y-2">
          <div>Gastos base: ${totalCosts.toLocaleString()}</div>
          <div>Con margen (+15%): ${withMargin.toLocaleString()}</div>
          <div className="text-lg font-bold text-red-600">
            Ingreso necesario: ${requiredIncome.toLocaleString()}/mes
          </div>
        </div>
      </div>
    </div>
  );
};

export default Lesson7_1_CostosVidaIndependiente_Bernheim;