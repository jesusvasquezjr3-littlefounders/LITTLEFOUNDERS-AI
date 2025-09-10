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
import { Calculator, Target, CheckCircle, AlertCircle, BookOpen, TrendingUp, Zap } from 'lucide-react';

interface LessonProps {
  onComplete: (score: number, progress: LessonProgress) => void;
  onExit: () => void;
}

const Lesson_Ages14to16_CompoundInterest_Bernheim: React.FC<LessonProps> = ({ onComplete, onExit }) => {
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
            <Zap className="h-5 w-5" />
            Herramienta: La Regla del 72
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-green-100 p-4 rounded-lg">
            <h4 className="font-bold text-green-800 mb-2">Pasos para usar la herramienta:</h4>
            <ol className="list-decimal list-inside space-y-2 text-sm text-green-700">
              <li><strong>Identificar tasa de interés:</strong> % anual de rendimiento esperado</li>
              <li><strong>Aplicar fórmula:</strong> 72 ÷ tasa de interés = años para duplicar</li>
              <li><strong>Calcular múltiples duplicaciones:</strong> En X años, ¿cuántas duplicaciones?</li>
              <li><strong>Determinar crecimiento total:</strong> 2^(duplicaciones) = factor multiplicador</li>
              <li><strong>Comparar opciones:</strong> Evaluar diferentes tasas o plazos</li>
            </ol>
          </div>
          
          <Rule72Calculator />
          
          <div className="bg-gray-100 p-3 rounded-lg">
            <p className="text-sm text-gray-700">
              <strong>Fórmula profesional:</strong> 72 ÷ tasa anual = años para duplicar dinero
            </p>
            <p className="text-xs text-gray-600 mt-1">
              *Precisión: ~99% para tasas entre 5-20%. Usado por asesores financieros profesionales
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // ETAPA 2: DECISIONES DE VALUACIÓN - TAREAS PAREADAS
  const pairedTask: PairedTask = {
    id: 'investment_doubling_comparison',
    complexProblem: {
      question: "Sofia evalúa inversiones. Opción A: 9% anual. Opción B: 6% anual. Ambas por 24 años. Usando la Regla del 72, ¿cuántas veces más dinero tendría con A vs. B después de 24 años?",
      context: "Sofia debe calcular cuántas duplicaciones ocurren con cada tasa en 24 años y comparar el resultado final.",
      correctAnswer: 2,
      explanation: "A (9%): 72÷9=8 años/duplicación. En 24 años: 3 duplicaciones = 8x crecimiento. B (6%): 72÷6=12 años. En 24 años: 2 duplicaciones = 4x. A da 8÷4=2 veces más."
    },
    transparentProblem: {
      question: "Si una opción multiplica tu dinero por 8 y otra por 4, ¿cuántas veces más da la primera?",
      context: "División simple de factores multiplicadores.",
      correctAnswer: 2,
      explanation: "8 ÷ 4 = 2 veces más dinero con la primera opción."
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
      timeSpent: lessonProgress.timeSpent + 400
    };

    setLessonProgress(newProgress);
    setCurrentStage('evaluation');
  };

  const handleComplete = () => {
    const finalScore = lessonProgress.conceptMastered ? 100 : 
      Math.max(0, 100 - (Math.abs(currentBias) * 50));
    onComplete(finalScore, lessonProgress);
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <Card className="border-2 border-purple-200">
        <CardHeader className="bg-purple-50">
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-6 w-6" />
            LECCIÓN: La Regla del 72
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <Badge variant="outline" className="bg-blue-100">Edad: 14-16 años</Badge>
            <Badge variant="outline" className="bg-green-100">Nivel Profesional</Badge>
          </div>
        </CardContent>
      </Card>

      {/* ETAPA 1: INTERVENCIÓN EDUCATIVA */}
      {currentStage === 'intervention' && (
        <PracticalTool
          title="La Regla del 72"
          description="Herramienta profesional para calcular rápidamente duplicación de dinero"
          tool={practicalTool}
          examples={[
            { input: { tasa: "9%" }, output: { años: "8" }, explanation: "72 ÷ 9 = 8 años para duplicar" },
            { input: { años: "12" }, output: { tasa: "6%" }, explanation: "72 ÷ 12 = 6% tasa necesaria" }
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

// Componente auxiliar
const Rule72Calculator: React.FC = () => {
  const [rate, setRate] = useState<number>(7);
  const yearsToDouble = rate > 0 ? (72 / rate).toFixed(1) : '0';

  return (
    <div className="bg-white p-4 border rounded-lg space-y-3">
      <div>
        <label className="block text-sm font-medium mb-1">Tasa de interés anual (%)</label>
        <Input
          type="number"
          step="0.1"
          value={rate || ''}
          onChange={(e) => setRate(Number(e.target.value))}
          placeholder="7.2"
        />
      </div>
      
      {rate > 0 && (
        <div className="text-center p-4 bg-blue-100 rounded">
          <div className="text-2xl font-bold text-blue-600">{yearsToDouble} años</div>
          <div className="text-sm text-blue-800">para duplicar tu dinero</div>
        </div>
      )}
    </div>
  );
};

export default Lesson_Ages14to16_CompoundInterest_Bernheim;