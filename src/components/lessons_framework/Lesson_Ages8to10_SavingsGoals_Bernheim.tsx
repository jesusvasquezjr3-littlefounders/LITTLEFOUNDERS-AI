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
import { Calculator, Target, CheckCircle, AlertCircle, BookOpen, PiggyBank, Calendar } from 'lucide-react';

interface LessonProps {
  onComplete: (score: number, progress: LessonProgress) => void;
  onExit: () => void;
}

const Lesson_Ages8to10_SavingsGoals_Bernheim: React.FC<LessonProps> = ({ onComplete, onExit }) => {
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
            <Calendar className="h-5 w-5" />
            Herramienta: Calculadora de Tiempo para Metas
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-green-100 p-4 rounded-lg">
            <h4 className="font-bold text-green-800 mb-2">Pasos para usar la herramienta:</h4>
            <ol className="list-decimal list-inside space-y-2 text-sm text-green-700">
              <li><strong>Identificar tu meta:</strong> ¿Qué quieres comprar y cuánto cuesta?</li>
              <li><strong>Calcular dinero faltante:</strong> Meta - Ahorros actuales</li>
              <li><strong>Determinar ahorro semanal:</strong> ¿Cuánto puedes ahorrar cada semana?</li>
              <li><strong>Aplicar fórmula:</strong> Dinero faltante ÷ Ahorro semanal = Semanas</li>
              <li><strong>Verificar fecha real:</strong> Contar semanas en calendario</li>
            </ol>
          </div>
          
          <SavingsTimeCalculator />
          
          <div className="bg-gray-100 p-3 rounded-lg">
            <p className="text-sm text-gray-700">
              <strong>Fórmula:</strong> Semanas necesarias = (Meta - Dinero actual) ÷ Ahorro semanal
            </p>
            <p className="text-xs text-gray-600 mt-1">
              *Siempre redondea hacia arriba para estar seguro de tener suficiente dinero
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // ETAPA 2: DECISIONES DE VALUACIÓN - TAREAS PAREADAS
  const pairedTask: PairedTask = {
    id: 'savings_time_calculation',
    complexProblem: {
      question: "Pedro quiere un carrito de $30. Tiene $12 ahorrados y recibe $5 de mesada semanal, pero gasta $2 en dulces cada semana. ¿Cuántas semanas necesita si sigue comprando dulces?",
      context: "Pedro debe calcular su ahorro real semanal y luego el tiempo necesario para su meta.",
      correctAnswer: 6,
      explanation: "Pedro ahorra $5 - $2 = $3 netos por semana. Necesita $30 - $12 = $18 más. Tiempo: $18 ÷ $3 = 6 semanas."
    },
    transparentProblem: {
      question: "Si necesitas $18 más y ahorras $3 cada semana, ¿cuántas semanas necesitas?",
      context: "División directa de dinero faltante entre ahorro semanal.",
      correctAnswer: 6,
      explanation: "$18 ÷ $3 por semana = 6 semanas"
    }
  };

  // Tarea pareada adicional
  const pairedTaskAdvanced: PairedTask = {
    id: 'goal_urgency_evaluation',
    complexProblem: {
      question: "Ana quiere un videojuego de $45 para su cumpleaños en 8 semanas. Tiene $9 y puede ahorrar $4 semanales. ¿Podrá comprarlo a tiempo, y si no, cuántas semanas más necesita?",
      context: "Ana debe evaluar si su plan de ahorro le permite alcanzar su meta en el tiempo límite.",
      correctAnswer: 9,
      explanation: "Necesita $45 - $9 = $36 más. A $4/semana = $36 ÷ $4 = 9 semanas. No alcanza en 8 semanas, necesita 1 semana más."
    },
    transparentProblem: {
      question: "¿9 semanas necesarias es mayor o menor que 8 semanas disponibles?",
      context: "Comparación directa de tiempo necesario vs. tiempo disponible.",
      correctAnswer: 9,
      explanation: "9 semanas es mayor que 8 semanas, por lo que no alcanzará el tiempo."
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
      conceptMastered: Math.abs(biasScore) <= 1,
      biasReduction: biasReduction,
      completedTasks: [...lessonProgress.completedTasks, currentPairedTask.id],
      timeSpent: lessonProgress.timeSpent + 300
    };

    setLessonProgress(newProgress);
    setCurrentStage('evaluation');
  };

  const handleComplete = () => {
    const finalScore = lessonProgress.conceptMastered ? 100 : 
      Math.max(0, 100 - (Math.abs(currentBias) * 20));
    onComplete(finalScore, lessonProgress);
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <Card className="border-2 border-purple-200">
        <CardHeader className="bg-purple-50">
          <CardTitle className="flex items-center gap-2">
            <PiggyBank className="h-6 w-6" />
            LECCIÓN: Calculadora de Tiempo para Metas
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <Badge variant="outline" className="bg-blue-100">Edad: 8-10 años</Badge>
        </CardContent>
      </Card>

      {/* ETAPA 1: INTERVENCIÓN EDUCATIVA */}
      {currentStage === 'intervention' && (
        <PracticalTool
          title="Calculadora de Tiempo para Metas"
          description="Herramienta para calcular exactamente cuándo podrás comprar lo que quieres"
          tool={practicalTool}
          examples={[
            { input: { meta: "$20", tienes: "$8", semanal: "$3" }, output: { semanas: "4" }, explanation: "Necesitas $12 más. $12 ÷ $3 = 4 semanas" },
            { input: { meta: "$50", tienes: "$10", semanal: "$5" }, output: { semanas: "8" }, explanation: "Necesitas $40 más. $40 ÷ $5 = 8 semanas" }
          ]}
        />
      )}

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
          targetReduction={2}
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

// Componente auxiliar simplificado
const SavingsTimeCalculator: React.FC = () => {
  const [goal, setGoal] = useState<number>(0);
  const [current, setCurrent] = useState<number>(0);
  const [weekly, setWeekly] = useState<number>(0);

  const weeksNeeded = weekly > 0 ? Math.ceil((goal - current) / weekly) : 0;

  return (
    <div className="bg-white p-4 border rounded-lg space-y-3">
      <div className="grid grid-cols-3 gap-3">
        <Input type="number" value={goal || ''} onChange={(e) => setGoal(Number(e.target.value))} placeholder="Meta ($)" />
        <Input type="number" value={current || ''} onChange={(e) => setCurrent(Number(e.target.value))} placeholder="Tienes ($)" />
        <Input type="number" value={weekly || ''} onChange={(e) => setWeekly(Number(e.target.value))} placeholder="Ahorras $/semana" />
      </div>
      {goal > 0 && weekly > 0 && (
        <div className="text-center p-3 bg-green-100 rounded">
          <div className="text-2xl font-bold text-green-600">{weeksNeeded}</div>
          <div className="text-sm text-green-800">semanas necesarias</div>
        </div>
      )}
    </div>
  );
};

export default Lesson_Ages8to10_SavingsGoals_Bernheim;
