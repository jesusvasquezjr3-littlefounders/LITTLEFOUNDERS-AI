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
import { Calculator, Target, CheckCircle, AlertCircle, BookOpen, Goal, Trophy } from 'lucide-react';

interface Lesson2_4Props {
  onComplete: (score: number, progress: LessonProgress) => void;
  onExit: () => void;
}

const Lesson2_4_MyFirstSavingGoals_Bernheim: React.FC<Lesson2_4Props> = ({ onComplete, onExit }) => {
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
            <Goal className="h-5 w-5" />
            Herramienta: Calculadora de Secuenciación de Metas
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-green-100 p-4 rounded-lg">
            <h4 className="font-bold text-green-800 mb-2">Pasos para usar la herramienta:</h4>
            <ol className="list-decimal list-inside space-y-2 text-sm text-green-700">
              <li><strong>Listar todas las metas:</strong> Con costos específicos y fechas límite</li>
              <li><strong>Calcular tiempo necesario:</strong> Meta ÷ ahorro mensual = meses</li>
              <li><strong>Aplicar regla de momentum:</strong> Ordenar por tiempo, empezar por la más rápida</li>
              <li><strong>Considerar urgencia:</strong> Ajustar por fechas límite críticas</li>
              <li><strong>Optimizar secuencia:</strong> Minimizar tiempo total o maximizar probabilidad de éxito</li>
            </ol>
          </div>
          
          <GoalSequencer />
          
          <div className="bg-gray-100 p-3 rounded-lg">
            <p className="text-sm text-gray-700">
              <strong>Principio clave:</strong> Logros tempranos generan momentum psicológico para metas más difíciles
            </p>
            <p className="text-xs text-gray-600 mt-1">
              *Secuencia óptima = maximizar probabilidad de completar todas las metas
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // ETAPA 2: DECISIONES DE VALUACIÓN - TAREAS PAREADAS
  const pairedTask: PairedTask = {
    id: 'goal-sequencing-optimization',
    complexProblem: {
      question: "Ana tiene $20 iniciales y ahorra $25/mes. Metas: Bicicleta ($180, flexible), Regalo cumpleaños mamá ($60, en 2 meses), Videojuego ($75, flexible), Curso verano ($120, en 4 meses). ¿Cuál secuencia le permite completar todas las metas a tiempo?",
      context: "Ana debe optimizar la secuencia considerando restricciones de tiempo y momentum psicológico.",
      correctAnswer: 60,
      explanation: "Secuencia óptima: Regalo ($60, 2 meses) → Videojuego ($75, +3 meses) → Curso ($120, cumple 4 meses) → Bicicleta ($180). Primera meta en 2 meses."
    },
    transparentProblem: {
      question: "Si necesitas $60 y ya tienes $20, ahorrando $25/mes, ¿cuántos meses necesitas?",
      context: "Cálculo directo de tiempo para una meta específica.",
      correctAnswer: 2,
      explanation: "Necesitas $40 más. $40 ÷ $25/mes = 1.6 meses ≈ 2 meses."
    }
  };

  // Tarea pareada adicional para efectos heterogéneos
  const pairedTaskAdvanced: PairedTask = {
    id: 'motivation-vs-efficiency-tradeoff',
    complexProblem: {
      question: "Carlos es impaciente y se desanima fácilmente. Metas: Guitarra ($300, 12 meses), Libro ($25, inmediato), Tablet ($200, 8 meses). Ahorra $30/mes. ¿Qué secuencia maximiza la probabilidad de que complete todas las metas?",
      context: "Carlos necesita considerar su perfil psicológico además de la eficiencia matemática.",
      correctAnswer: 25,
      explanation: "Para Carlos impaciente: Libro ($25, 1 mes) → Tablet ($200, 7 meses) → Guitarra ($300). El éxito temprano lo motiva a continuar."
    },
    transparentProblem: {
      question: "¿Cuál es la meta más rápida de completar: $25, $200, o $300, ahorrando $30/mes?",
      context: "Identificación directa de la meta más rápida.",
      correctAnswer: 25,
      explanation: "$25 es la meta más rápida: $25 ÷ $30/mes < 1 mes."
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
      // Mostrar segunda tarea pareada
      setCurrentPairedTask(pairedTaskAdvanced);
      return;
    }
    
    // Calcular reducción de sesgo
    const avgBias = newBiasHistory.reduce((a, b) => a + Math.abs(b), 0) / newBiasHistory.length;
    const biasReduction = newBiasHistory.length > 1 ? 
      Math.abs(newBiasHistory[0]) - Math.abs(biasScore) : 0;

    const newProgress: LessonProgress = {
      conceptMastered: Math.abs(biasScore) <= 5, // Competencia si sesgo ≤ $5 en valoraciones
      biasReduction: biasReduction,
      completedTasks: [...lessonProgress.completedTasks, currentPairedTask.id],
      timeSpent: lessonProgress.timeSpent + 400 // 6-7 minutos estimados por tarea
    };

    setLessonProgress(newProgress);
    setCurrentStage('evaluation');
  };

  const handleComplete = () => {
    const finalScore = lessonProgress.conceptMastered ? 100 : 
      Math.max(0, 100 - Math.abs(currentBias) * 3);
    onComplete(finalScore, lessonProgress);
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <Card className="border-2 border-purple-200">
        <CardHeader className="bg-purple-50">
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-6 w-6" />
            LECCIÓN: Calculadora de Secuenciación de Metas
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <Badge variant="outline" className="bg-blue-100">
              Edad: 10-15 años
            </Badge>
            <Badge variant="outline" className="bg-green-100">
              Duración: 25-30 minutos
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
                1. CONCEPTO SUSTANTIVO: Calculadora de Secuenciación de Metas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-gray-700">
                Aprende a usar una herramienta sistemática para organizar múltiples metas de ahorro 
                de manera óptima. Esta herramienta combina matemáticas con psicología para maximizar 
                la probabilidad de completar todas tus metas.
              </p>

              <PracticalTool
                title="Calculadora de Secuenciación de Metas"
                description="Sistema para ordenar metas de ahorro considerando tiempo, urgencia y momentum psicológico"
                tool={practicalTool}
                examples={[
                  {
                    input: { metas: "A:$50(2 meses), B:$100(flexible), C:$30(inmediato)", ahorro: "$25/mes" },
                    output: { secuencia: "C→A→B", razon: "Momentum: rápida→urgente→grande" },
                    explanation: "C(1.2 meses) → A(2 meses) → B(4 meses). Momentum psicológico óptimo."
                  },
                  {
                    input: { metas: "Libro:$20, Bici:$200, Curso:$80(3 meses)", ahorro: "$40/mes" },
                    output: { secuencia: "Libro→Curso→Bici", razon: "Urgencia antes que eficiencia" },
                    explanation: "Libro(0.5 mes) → Curso(2.5 meses, deadline) → Bici(5 meses)."
                  },
                  {
                    input: { metas: "Meta1:$150, Meta2:$60, Meta3:$90", ahorro: "$30/mes" },
                    output: { secuencia: "Meta2→Meta3→Meta1", razon: "Orden ascendente por tiempo" },
                    explanation: "Meta2(2 meses) → Meta3(3 meses) → Meta1(5 meses). Progresión natural."
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

      {/* ETAPA 2: DECISIONES DE VALUACIÓN */}
      {currentStage === 'valuation' && (
        <div className="space-y-6">
          <Card className="border-orange-200">
            <CardHeader className="bg-orange-50">
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                2. PRÁCTICA CON RETROALIMENTACIÓN: Tareas Pareadas ({tasksCompleted + 1}/2)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <p className="text-gray-700 mb-4">
                Practica optimizando secuencias de metas múltiples. Usa la calculadora sistemática 
                para resolver ambos problemas de manera consistente. {tasksCompleted === 0 ? 
                "Primero optimizarás una secuencia con restricciones de tiempo." : 
                "Ahora considerarás factores psicológicos en la secuenciación."}
              </p>
            </CardContent>
          </Card>

          <PairedTaskComponent
            task={currentPairedTask}
            onComplete={handleTaskComplete}
            showFeedback={true}
          />
        </div>
      )}

      {/* ETAPA 3: EVALUACIÓN */}
      {currentStage === 'evaluation' && (
        <div className="space-y-6">
          <Card className="border-green-200">
            <CardHeader className="bg-green-50">
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5" />
                3. EVALUACIÓN: Competencia Deliberativa en Secuenciación de Metas
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <p className="text-gray-700 mb-4">
                Tu competencia se mide por la consistencia entre análisis complejos y simples de 
                secuenciación de metas. Una herramienta bien dominada produce estrategias similares 
                independientemente de la complejidad del escenario.
              </p>
            </CardContent>
          </Card>

          <CompetenceTracker
            biasHistory={biasHistory}
            targetReduction={10}
            currentBias={currentBias}
          />

          {/* Métricas específicas de secuenciación de metas */}
          <Card className="border-purple-200">
            <CardHeader className="bg-purple-50">
              <CardTitle>Métricas de Competencia en Secuenciación de Metas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-4 bg-blue-100 rounded-lg">
                  <p className="text-2xl font-bold text-blue-600">
                    {lessonProgress.conceptMastered ? 'DOMINADO' : 'EN PROGRESO'}
                  </p>
                  <p className="text-sm text-blue-800">Planificación Óptima</p>
                </div>
                <div className="text-center p-4 bg-green-100 rounded-lg">
                  <p className="text-2xl font-bold text-green-600">
                    ${Math.abs(currentBias)}
                  </p>
                  <p className="text-sm text-green-800">Sesgo de Secuencia</p>
                </div>
                <div className="text-center p-4 bg-orange-100 rounded-lg">
                  <p className="text-2xl font-bold text-orange-600">
                    {tasksCompleted}/2
                  </p>
                  <p className="text-sm text-orange-800">Secuencias Evaluadas</p>
                </div>
              </div>

              {/* Interpretación del sesgo específica para secuenciación de metas */}
              {Math.abs(currentBias) <= 5 && (
                <Alert className="border-green-200 bg-green-50">
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>¡Excelente dominio de la secuenciación de metas!</strong> Tus estrategias son muy consistentes. 
                    Puedes planificar múltiples metas considerando factores matemáticos y psicológicos.
                  </AlertDescription>
                </Alert>
              )}

              {Math.abs(currentBias) > 5 && Math.abs(currentBias) <= 15 && (
                <Alert className="border-yellow-200 bg-yellow-50">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Buen progreso en planificación de metas múltiples.</strong> Hay diferencias menores en tus estrategias. 
                    Practica más para mejorar la consistencia en escenarios complejos.
                  </AlertDescription>
                </Alert>
              )}

              {Math.abs(currentBias) > 15 && (
                <Alert className="border-red-200 bg-red-50">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Necesita más práctica con la herramienta de secuenciación.</strong> Las diferencias en tus estrategias 
                    sugieren que debes revisar los criterios de optimización.
                  </AlertDescription>
                </Alert>
              )}

              {/* Efectos heterogéneos - consejos personalizados */}
              <Card className="bg-blue-50 border-blue-200">
                <CardContent className="p-4">
                  <h4 className="font-bold text-blue-800 mb-2">Perfil de Planificación Personal:</h4>
                  {currentBias > 10 && (
                    <p className="text-sm text-blue-700">
                      Tiendes a sobrecomplicar las secuencias en casos complejos. A veces la solución más simple 
                      es la mejor. Enfócate en los principios básicos: momentum y urgencia.
                    </p>
                  )}
                  {currentBias < -10 && (
                    <p className="text-sm text-blue-700">
                      Tiendes a simplificar demasiado las secuencias complejas. Considera más factores como 
                      fechas límite y tu personalidad. La herramienta te ayuda a ser más comprehensivo.
                    </p>
                  )}
                  {Math.abs(currentBias) <= 10 && (
                    <p className="text-sm text-blue-700">
                      ¡Tienes un excelente balance en la planificación de metas! Puedes usar esta herramienta 
                      para organizar múltiples objetivos de manera sistemática y motivadora.
                    </p>
                  )}
                </CardContent>
              </Card>

              <Button 
                onClick={handleComplete}
                className="w-full bg-green-600 hover:bg-green-700"
              >
                Completar Lección de Secuenciación de Metas
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
        <div className="text-sm text-gray-600">
          Tiempo estimado: {Math.ceil(lessonProgress.timeSpent / 60)} minutos
        </div>
      </div>
    </div>
  );
};

// Componente auxiliar para la secuenciación de metas
const GoalSequencer: React.FC = () => {
  const [goals, setGoals] = useState<{
    name: string;
    cost: number;
    monthsDeadline: number; // 0 = flexible
    priority: number; // 1-10
  }[]>([]);
  
  const [monthlySavings, setMonthlySavings] = useState<number>(0);
  const [currentSavings, setCurrentSavings] = useState<number>(0);
  
  const [newGoal, setNewGoal] = useState({
    name: '',
    cost: 0,
    monthsDeadline: 0,
    priority: 5
  });

  const addGoal = () => {
    if (newGoal.name.trim() && newGoal.cost > 0) {
      setGoals([...goals, newGoal]);
      setNewGoal({
        name: '',
        cost: 0,
        monthsDeadline: 0,
        priority: 5
      });
    }
  };

  const calculateOptimalSequence = () => {
    if (monthlySavings <= 0) return [];
    
    return goals.map(goal => {
      const timeToComplete = (goal.cost - currentSavings) / monthlySavings;
      const urgencyScore = goal.monthsDeadline > 0 ? (1 / goal.monthsDeadline) * 10 : 0;
      const momentumScore = goal.cost < 100 ? 10 : goal.cost < 300 ? 5 : 1;
      const totalScore = urgencyScore + momentumScore + (goal.priority / 10);
      
      return {
        ...goal,
        timeToComplete: Math.max(0, timeToComplete),
        score: totalScore,
        feasible: goal.monthsDeadline === 0 || timeToComplete <= goal.monthsDeadline
      };
    }).sort((a, b) => {
      // Primero por factibilidad, luego por score
      if (a.feasible !== b.feasible) return a.feasible ? -1 : 1;
      if (a.timeToComplete !== b.timeToComplete) return a.timeToComplete - b.timeToComplete;
      return b.score - a.score;
    });
  };

  const resetSequencer = () => {
    setGoals([]);
    setMonthlySavings(0);
    setCurrentSavings(0);
  };

  const optimalSequence = calculateOptimalSequence();

  return (
    <div className="bg-white p-4 border rounded-lg space-y-4">
      <h4 className="font-bold mb-3">Secuenciador de Metas de Ahorro</h4>
      
      {/* Configuración inicial */}
      <div className="grid grid-cols-2 gap-3 p-3 bg-gray-50 rounded">
        <div>
          <label className="block text-xs font-medium mb-1">Ahorro mensual ($)</label>
          <Input
            type="number"
            value={monthlySavings || ''}
            onChange={(e) => setMonthlySavings(Number(e.target.value))}
            placeholder="50"
          />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Ahorros actuales ($)</label>
          <Input
            type="number"
            value={currentSavings || ''}
            onChange={(e) => setCurrentSavings(Number(e.target.value))}
            placeholder="20"
          />
        </div>
      </div>

      {/* Agregar nueva meta */}
      <div className="grid grid-cols-4 gap-2">
        <Input
          placeholder="Nombre meta"
          value={newGoal.name}
          onChange={(e) => setNewGoal({...newGoal, name: e.target.value})}
        />
        <Input
          type="number"
          placeholder="$0"
          value={newGoal.cost || ''}
          onChange={(e) => setNewGoal({...newGoal, cost: Number(e.target.value)})}
        />
        <Input
          type="number"
          placeholder="Meses límite (0=flexible)"
          value={newGoal.monthsDeadline || ''}
          onChange={(e) => setNewGoal({...newGoal, monthsDeadline: Number(e.target.value)})}
        />
        <Button onClick={addGoal} size="sm">+Meta</Button>
      </div>

      {/* Secuencia óptima */}
      {optimalSequence.length > 0 && monthlySavings > 0 && (
        <div className="space-y-2">
          <h5 className="font-medium text-sm text-gray-700">Secuencia Óptima:</h5>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {optimalSequence.map((goal, index) => (
              <div key={`${goal.name}-${index}`} className="p-2 bg-gray-50 rounded text-sm">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-medium">
                    #{index + 1} {goal.name}
                    {!goal.feasible && <span className="text-red-500 ml-1">(No factible)</span>}
                  </span>
                  <span className="text-green-600 font-bold">
                    {goal.timeToComplete.toFixed(1)} meses
                  </span>
                </div>
                <div className="text-xs text-gray-600">
                  ${goal.cost} • Límite: {goal.monthsDeadline || 'Flexible'} meses 
                  • Score: {goal.score.toFixed(1)}
                </div>
              </div>
            ))}
          </div>
          
          <div className="bg-blue-50 p-2 rounded text-xs">
            <strong>Recomendación:</strong> Esta secuencia maximiza la probabilidad de completar todas las metas 
            considerando momentum psicológico y restricciones de tiempo.
          </div>
        </div>
      )}

      {goals.length > 0 && (
        <Button variant="outline" onClick={resetSequencer} className="w-full">
          Resetear Secuenciador
        </Button>
      )}
    </div>
  );
};

export default Lesson2_4_MyFirstSavingGoals_Bernheim;
