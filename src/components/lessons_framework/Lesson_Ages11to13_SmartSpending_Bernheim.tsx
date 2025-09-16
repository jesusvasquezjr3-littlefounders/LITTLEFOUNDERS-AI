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
import { Calculator, Target, CheckCircle, AlertCircle, BookOpen, Scale, ShoppingCart } from 'lucide-react';

interface LessonProps {
  onComplete: (score: number, progress: LessonProgress) => void;
  onExit: () => void;
}

const Lesson_Ages11to13_SmartSpending_Bernheim: React.FC<LessonProps> = ({ onComplete, onExit }) => {
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
    id: 'cost_per_use_analysis',
    complexProblem: {
      question: "Laura evalúa audífonos. Opción A: $80, usará 2 horas diarias por 6 meses (180 días). Opción B: $35, usará 1 hora diaria por 4 meses (120 días). ¿Cuál tiene menor costo por hora?",
      context: "Laura debe calcular el costo por hora de uso para ambas opciones y comparar valor real.",
      correctAnswer: 22,
      explanation: "Opción A: $80 ÷ (2h × 180d) = $80 ÷ 360h = $0.22/h. Opción B: $35 ÷ (1h × 120d) = $35 ÷ 120h = $0.29/h. A es mejor."
    },
    transparentProblem: {
      question: "¿Cuál es menor: $0.22 por hora o $0.29 por hora?",
      context: "Comparación directa de costos por hora calculados.",
      correctAnswer: 22,
      explanation: "$0.22 es menor que $0.29, así que la primera opción da mejor valor."
    }
  };

  const [currentPairedTask, setCurrentPairedTask] = useState<PairedTask>(pairedTask);
  const [tasksCompleted, setTasksCompleted] = useState<number>(0);

  const handleTaskComplete = (complexAnswer: number, transparentAnswer: number, biasScore: number) => {
    const newBiasHistory = [...biasHistory, biasScore];
    setBiasHistory(newBiasHistory);
    setCurrentBias(biasScore);
    
    const newProgress: LessonProgress = {
      conceptMastered: Math.abs(biasScore) <= 0.05,
      biasReduction: 0,
      completedTasks: [...lessonProgress.completedTasks, currentPairedTask.id],
      timeSpent: lessonProgress.timeSpent + 350
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
      <Card className="border-2 border-purple-200">
        <CardHeader className="bg-purple-50">
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="h-6 w-6" />
            LECCIÓN: Herramienta de Costo por Uso
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
          targetReduction={0.1}
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

export default Lesson_Ages11to13_SmartSpending_Bernheim;
