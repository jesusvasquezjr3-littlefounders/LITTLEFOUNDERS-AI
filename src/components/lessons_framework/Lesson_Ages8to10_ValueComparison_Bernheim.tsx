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
import { Calculator, Target, CheckCircle, AlertCircle, BookOpen, Coins, DollarSign } from 'lucide-react';

interface LessonProps {
  onComplete: (score: number, progress: LessonProgress) => void;
  onExit: () => void;
}

const Lesson_Ages8to10_ValueComparison_Bernheim: React.FC<LessonProps> = ({ onComplete, onExit }) => {
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
            Herramienta: Calculadora de Valor por Unidad
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-green-100 p-4 rounded-lg">
            <h4 className="font-bold text-green-800 mb-2">Pasos para usar la herramienta:</h4>
            <ol className="list-decimal list-inside space-y-2 text-sm text-green-700">
              <li><strong>Identificar precio total:</strong> ¿Cuánto cuesta el paquete completo?</li>
              <li><strong>Contar cantidad total:</strong> ¿Cuántos items incluye?</li>
              <li><strong>Dividir precio ÷ cantidad:</strong> Esto da el costo por unidad</li>
              <li><strong>Comparar entre opciones:</strong> ¿Cuál tiene menor costo por unidad?</li>
              <li><strong>Elegir la mejor:</strong> El menor costo por unidad es el mejor valor</li>
            </ol>
          </div>
          
          <ValuePerUnitCalculator />
          
          <div className="bg-gray-100 p-3 rounded-lg">
            <p className="text-sm text-gray-700">
              <strong>Fórmula:</strong> Valor por unidad = Precio total ÷ Cantidad de items
            </p>
            <p className="text-xs text-gray-600 mt-1">
              *El menor número significa mejor valor por tu dinero
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // ETAPA 2: DECISIONES DE VALUACIÓN - TAREAS PAREADAS
  const pairedTask: PairedTask = {
    id: 'cookies_value_comparison',
    complexProblem: {
      question: "María quiere comprar galletas. Opción A: Caja de 12 galletas por $6. Opción B: Caja de 8 galletas por $3.50. ¿Cuál opción le da mejor valor (menor costo por galleta)?",
      context: "María debe usar la calculadora para determinar el costo por galleta de cada opción.",
      correctAnswer: 8,
      explanation: "Opción A: $6 ÷ 12 = $0.50 por galleta. Opción B: $3.50 ÷ 8 = $0.44 por galleta. B es mejor valor."
    },
    transparentProblem: {
      question: "¿Cuál es menor: $0.50 por galleta o $0.44 por galleta?",
      context: "Comparación directa de costos por unidad calculados.",
      correctAnswer: 44,
      explanation: "$0.44 es menor que $0.50, así que la segunda opción es mejor valor."
    }
  };

  // Tarea pareada adicional
  const pairedTaskAdvanced: PairedTask = {
    id: 'juice_volume_comparison',
    complexProblem: {
      question: "Luis compara jugos. Botella A: 500ml por $2.00. Botella B: 750ml por $2.70. ¿Cuál le da más jugo por cada peso gastado?",
      context: "Luis debe calcular cuántos mililitros obtiene por cada peso para comparar valor real.",
      correctAnswer: 750,
      explanation: "Botella A: 500ml ÷ $2.00 = 250ml por peso. Botella B: 750ml ÷ $2.70 = 278ml por peso. B da más."
    },
    transparentProblem: {
      question: "¿Cuál es mayor: 250ml por peso o 278ml por peso?",
      context: "Comparación directa de cantidad por peso gastado.",
      correctAnswer: 278,
      explanation: "278ml por peso es mayor que 250ml por peso, así que la segunda es mejor."
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
    const newProgress: LessonProgress = {
      conceptMastered: Math.abs(biasScore) <= 0.1,
      biasReduction: avgBias,
      completedTasks: [...lessonProgress.completedTasks, currentPairedTask.id],
      timeSpent: lessonProgress.timeSpent + 250
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
            <Coins className="h-6 w-6" />
            LECCIÓN: Calculadora de Valor por Unidad
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <Badge variant="outline" className="bg-blue-100">Edad: 8-10 años</Badge>
        </CardContent>
      </Card>

      {/* ETAPA 1: INTERVENCIÓN EDUCATIVA */}
      {currentStage === 'intervention' && (
        <PracticalTool
          title="Calculadora de Valor por Unidad"
          description="Herramienta para encontrar cuál opción te da más por tu dinero"
          tool={practicalTool}
          examples={[
            { input: { precio: "$12", cantidad: "4 items" }, output: { valorPorUnidad: "$3 por item" }, explanation: "$12 ÷ 4 = $3 por cada item" },
            { input: { precio: "$10", cantidad: "5 items" }, output: { valorPorUnidad: "$2 por item" }, explanation: "$10 ÷ 5 = $2 por cada item (mejor valor)" }
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
          targetReduction={0.5}
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
const ValuePerUnitCalculator: React.FC = () => {
  const [price, setPrice] = useState<number>(0);
  const [quantity, setQuantity] = useState<number>(0);
  const valuePerUnit = quantity > 0 ? (price / quantity).toFixed(2) : '0';

  return (
    <div className="bg-white p-4 border rounded-lg space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Input type="number" value={price || ''} onChange={(e) => setPrice(Number(e.target.value))} placeholder="Precio ($)" />
        <Input type="number" value={quantity || ''} onChange={(e) => setQuantity(Number(e.target.value))} placeholder="Cantidad" />
      </div>
      {quantity > 0 && (
        <div className="text-center p-3 bg-blue-100 rounded">
          <div className="text-xl font-bold text-blue-600">${valuePerUnit}</div>
          <div className="text-sm text-blue-800">por unidad</div>
        </div>
      )}
    </div>
  );
};

export default Lesson_Ages8to10_ValueComparison_Bernheim;
