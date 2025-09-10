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
import { Calculator, Target, CheckCircle, AlertCircle, BookOpen, PieChart, TrendingUp } from 'lucide-react';

interface LessonProps {
  onComplete: (score: number, progress: LessonProgress) => void;
  onExit: () => void;
}

const Lesson_Ages11to13_BudgetingTool_Bernheim: React.FC<LessonProps> = ({ onComplete, onExit }) => {
  const [currentStage, setCurrentStage] = useState<'intervention' | 'valuation' | 'evaluation'>('intervention');
  const [biasHistory, setBiasHistory] = useState<number[]>([]);
  const [currentBias, setCurrentBias] = useState<number>(0);
  const [lessonProgress, setLessonProgress] = useState<LessonProgress>({
    conceptMastered: false,
    biasReduction: 0,
    completedTasks: [],
    timeSpent: 0
  });

  // ETAPA 2: DECISIONES DE VALUACIÓN - TAREAS PAREADAS
  const pairedTask: PairedTask = {
    id: 'budget_rule_evaluation',
    complexProblem: {
      question: "Ana recibe $80 mensuales. Planea: transporte escolar $10, almuerzo $25, videojuego $15, ropa $25, ahorro para bicicleta $30. ¿Su distribución sigue la regla 50/30/20?",
      context: "Ana debe clasificar cada gasto y calcular si cumple con los porcentajes de la regla presupuestaria.",
      correctAnswer: 0,
      explanation: "Necesidades: $35 (44%), Deseos: $40 (50%), Ahorros: $30 (37%). No sigue 50/30/20. Gastos en deseos exceden 30%."
    },
    transparentProblem: {
      question: "¿Una distribución de 44% necesidades, 50% deseos, 37% ahorros sigue la regla 50/30/20?",
      context: "Comparación directa de porcentajes con la regla estándar.",
      correctAnswer: 0,
      explanation: "No, porque 50% deseos excede el 30% recomendado por la regla."
    }
  };

  const [currentPairedTask, setCurrentPairedTask] = useState<PairedTask>(pairedTask);
  const [tasksCompleted, setTasksCompleted] = useState<number>(0);

  const handleTaskComplete = (complexAnswer: number, transparentAnswer: number, biasScore: number) => {
    const newBiasHistory = [...biasHistory, biasScore];
    setBiasHistory(newBiasHistory);
    setCurrentBias(biasScore);
    
    const newProgress: LessonProgress = {
      conceptMastered: Math.abs(biasScore) <= 0.5,
      biasReduction: 0,
      completedTasks: [...lessonProgress.completedTasks, currentPairedTask.id],
      timeSpent: lessonProgress.timeSpent + 360
    };

    setLessonProgress(newProgress);
    setCurrentStage('evaluation');
  };

  const handleComplete = () => {
    const finalScore = lessonProgress.conceptMastered ? 100 : 
      Math.max(0, 100 - (Math.abs(currentBias) * 40));
    onComplete(finalScore, lessonProgress);
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <Card className="border-2 border-purple-200">
        <CardHeader className="bg-purple-50">
          <CardTitle className="flex items-center gap-2">
            <PieChart className="h-6 w-6" />
            LECCIÓN: Herramienta de Presupuestación 50/30/20
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <Badge variant="outline" className="bg-blue-100">Edad: 11-13 años</Badge>
        </CardContent>
      </Card>

      {/* ETAPA 2: DECISIONES DE VALUACIÓN */}
      {currentStage === 'valuation' && (
        <PairedTaskComponent
          task={currentPairedTask}
          onComplete={handleTaskComplete}
          showFeedback={true}
        />
      )}

      {/* ETAPA 3: EVALUACIÓN */}
      {currentStage === 'evaluation' && (
        <CompetenceTracker
          biasHistory={biasHistory}
          targetReduction={1}
          currentBias={currentBias}
        />
      )}

      {/* Navigation */}
      <div className="flex justify-between items-center">
        <Button variant="outline" onClick={onExit}>Salir</Button>
        {currentStage === 'intervention' && (
          <Button onClick={() => setCurrentStage('valuation')}>Continuar a Práctica</Button>
        )}
        {currentStage === 'evaluation' && (
          <Button onClick={handleComplete}>Completar Lección</Button>
        )}
      </div>
    </div>
  );
};

export default Lesson_Ages11to13_BudgetingTool_Bernheim;