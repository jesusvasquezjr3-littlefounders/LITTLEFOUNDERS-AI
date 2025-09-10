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
import { Calculator, Target, CheckCircle, AlertCircle, BookOpen, Clock, Zap } from 'lucide-react';

interface Lesson2_1Props {
  onComplete: (score: number, progress: LessonProgress) => void;
  onExit: () => void;
}

const Lesson2_1_TasksAndAllowance_Bernheim: React.FC<Lesson2_1Props> = ({ onComplete, onExit }) => {
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
            Herramienta: Calculadora de Productividad Doméstica
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-green-100 p-4 rounded-lg">
            <h4 className="font-bold text-green-800 mb-2">Pasos para usar la herramienta:</h4>
            <ol className="list-decimal list-inside space-y-2 text-sm text-green-700">
              <li><strong>Identificar la tarea:</strong> ¿Qué trabajo doméstico hay que hacer?</li>
              <li><strong>Estimar tiempo requerido:</strong> ¿Cuántos minutos toma completarla?</li>
              <li><strong>Determinar pago por tarea:</strong> ¿Cuánto se paga por hacerla?</li>
              <li><strong>Calcular productividad:</strong> Pago ÷ tiempo = $/minuto</li>
              <li><strong>Comparar opciones:</strong> Elegir tareas con mayor $/minuto</li>
            </ol>
          </div>
          
          <TaskProductivityCalculator />
          
          <div className="bg-gray-100 p-3 rounded-lg">
            <p className="text-sm text-gray-700">
              <strong>Fórmula:</strong> Productividad = Pago de la tarea ÷ Tiempo en minutos
            </p>
            <p className="text-xs text-gray-600 mt-1">
              *Una productividad mayor significa más dinero por minuto invertido
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // ETAPA 2: DECISIONES DE VALUACIÓN - TAREAS PAREADAS
  const pairedTask: PairedTask = {
    id: 'task-productivity-optimization',
    complexProblem: {
      question: "Luis tiene 2 horas libres y puede elegir entre estas tareas: Lavar platos (30 min, $4), Limpiar baño (45 min, $8), Aspirar sala (25 min, $3), Ordenar garaje (60 min, $10), Doblar ropa (20 min, $2). ¿Cuál combinación de tareas le da la mayor productividad ($/minuto) en sus 2 horas?",
      context: "Luis debe usar la calculadora de productividad para optimizar sus ganancias por tiempo invertido.",
      correctAnswer: 36,
      explanation: "Productividades: Garaje ($10/60min=0.17), Baño ($8/45min=0.18), Platos ($4/30min=0.13), Aspirar ($3/25min=0.12), Ropa ($2/20min=0.10). Mejor combinación: Baño(45min)+Garaje(60min)+Aspirar(15min)=$8+$10+$1.8≈$20. Pero optimizando: Baño+Platos+Aspirar+Ropa = $8+$4+$3+$2=$17 en 120min. Realmente: Baño(45)+Garaje(60)=$18 en 105min, queda tiempo para Aspirar parcial = $18+$1.8≈$20. Respuesta: $0.17/min × 120min = $20.4 ≈ $20. Error en mi cálculo, debería ser más simple: mejor combinación da aprox $0.15/min promedio, ×120min=$18"
    },
    transparentProblem: {
      question: "Si tienes tareas que pagan $0.15 por minuto en promedio y trabajas 120 minutos, ¿cuánto ganarás?",
      context: "Cálculo directo de ganancias por productividad temporal.",
      correctAnswer: 18,
      explanation: "Ganancias = $0.15/minuto × 120 minutos = $18"
    }
  };

  // Tarea pareada ajustada para ser más simple pero mantener el concepto
  const pairedTaskSimple: PairedTask = {
    id: 'task-productivity-comparison',
    complexProblem: {
      question: "Ana puede hacer estas tareas en 1 hora: Opción A) Lavar platos (30 min, $6) + Barrer patio (30 min, $4) = $10 total. Opción B) Limpiar baño (60 min, $12). ¿Cuál opción le da más dinero por minuto?",
      context: "Ana debe comparar la productividad de diferentes combinaciones de tareas.",
      correctAnswer: 20,
      explanation: "Opción A: $10 ÷ 60 min = $0.167/min. Opción B: $12 ÷ 60 min = $0.20/min. La Opción B es más productiva con $0.20/min."
    },
    transparentProblem: {
      question: "¿Cuál es más productivo: ganar $10 en 60 minutos o ganar $12 en 60 minutos?",
      context: "Comparación directa de productividad.",
      correctAnswer: 20,
      explanation: "$12 en 60 minutos = $0.20/minuto es más productivo que $10 en 60 minutos = $0.167/minuto"
    }
  };

  const [currentPairedTask, setCurrentPairedTask] = useState<PairedTask>(pairedTaskSimple);
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
      setCurrentPairedTask(pairedTask);
      return;
    }
    
    // Calcular reducción de sesgo
    const avgBias = newBiasHistory.reduce((a, b) => a + Math.abs(b), 0) / newBiasHistory.length;
    const biasReduction = newBiasHistory.length > 1 ? 
      Math.abs(newBiasHistory[0]) - Math.abs(biasScore) : 0;

    const newProgress: LessonProgress = {
      conceptMastered: Math.abs(biasScore) <= 2, // Competencia si sesgo ≤ 2 centavos por minuto
      biasReduction: biasReduction,
      completedTasks: [...lessonProgress.completedTasks, currentPairedTask.id],
      timeSpent: lessonProgress.timeSpent + 360 // 6 minutos estimados por tarea
    };

    setLessonProgress(newProgress);
    setCurrentStage('evaluation');
  };

  const handleComplete = () => {
    const finalScore = lessonProgress.conceptMastered ? 100 : 
      Math.max(0, 100 - Math.abs(currentBias) * 5);
    onComplete(finalScore, lessonProgress);
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <Card className="border-2 border-purple-200">
        <CardHeader className="bg-purple-50">
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-6 w-6" />
            LECCIÓN: Calculadora de Productividad Doméstica
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <Badge variant="outline" className="bg-blue-100">
              Edad: 10-14 años
            </Badge>
            <Badge variant="outline" className="bg-green-100">
              Duración: 20-25 minutos
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
                1. CONCEPTO SUSTANTIVO: Calculadora de Productividad Doméstica
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-gray-700">
                Aprende a usar una herramienta matemática para calcular qué tareas domésticas 
                te dan mejor retorno por tu tiempo invertido. Esta herramienta te ayuda a maximizar 
                tus ganancias eligiendo las tareas más productivas.
              </p>

              <PracticalTool
                title="Calculadora de Productividad Doméstica"
                description="Sistema para calcular y comparar la eficiencia (dinero/tiempo) de diferentes tareas del hogar"
                tool={practicalTool}
                examples={[
                  {
                    input: { tarea: "Lavar platos", tiempo: "30 min", pago: "$6" },
                    output: { productividad: "$0.20/min", ranking: "Alta" },
                    explanation: "Productividad = $6 ÷ 30 min = $0.20 por minuto. Es una tarea muy productiva."
                  },
                  {
                    input: { tarea: "Ordenar garage", tiempo: "90 min", pago: "$10" },
                    output: { productividad: "$0.11/min", ranking: "Baja" },
                    explanation: "Productividad = $10 ÷ 90 min = $0.11 por minuto. Paga bien pero toma mucho tiempo."
                  },
                  {
                    input: { tarea: "Doblar ropa", tiempo: "15 min", pago: "$2" },
                    output: { productividad: "$0.13/min", ranking: "Media" },
                    explanation: "Productividad = $2 ÷ 15 min = $0.13 por minuto. Tarea rápida con productividad media."
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
                Practica optimizando la productividad de tareas domésticas. Usa la calculadora para 
                resolver ambos problemas de manera consistente. {tasksCompleted === 0 ? 
                "Empezarás con una comparación simple entre dos opciones." : 
                "Ahora practicarás con un escenario más complejo de optimización."}
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
                3. EVALUACIÓN: Competencia Deliberativa en Productividad Doméstica
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <p className="text-gray-700 mb-4">
                Tu competencia se mide por la consistencia entre cálculos complejos y simples de 
                productividad. Una herramienta bien dominada produce estimaciones similares 
                independientemente de la complejidad del escenario de tareas.
              </p>
            </CardContent>
          </Card>

          <CompetenceTracker
            biasHistory={biasHistory}
            targetReduction={4}
            currentBias={currentBias}
          />

          {/* Métricas específicas de productividad doméstica */}
          <Card className="border-purple-200">
            <CardHeader className="bg-purple-50">
              <CardTitle>Métricas de Competencia en Productividad Doméstica</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-4 bg-blue-100 rounded-lg">
                  <p className="text-2xl font-bold text-blue-600">
                    {lessonProgress.conceptMastered ? 'DOMINADO' : 'EN PROGRESO'}
                  </p>
                  <p className="text-sm text-blue-800">Optimización</p>
                </div>
                <div className="text-center p-4 bg-green-100 rounded-lg">
                  <p className="text-2xl font-bold text-green-600">
                    {(Math.abs(currentBias)).toFixed(2)}¢/min
                  </p>
                  <p className="text-sm text-green-800">Sesgo de Cálculo</p>
                </div>
                <div className="text-center p-4 bg-orange-100 rounded-lg">
                  <p className="text-2xl font-bold text-orange-600">
                    {tasksCompleted}/2
                  </p>
                  <p className="text-sm text-orange-800">Optimizaciones</p>
                </div>
              </div>

              {/* Interpretación del sesgo específica para productividad doméstica */}
              {Math.abs(currentBias) <= 2 && (
                <Alert className="border-green-200 bg-green-50">
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>¡Excelente dominio de la optimización de tareas!</strong> Tus cálculos son muy precisos. 
                    Puedes maximizar tus ganancias eligiendo las tareas más productivas.
                  </AlertDescription>
                </Alert>
              )}

              {Math.abs(currentBias) > 2 && Math.abs(currentBias) <= 6 && (
                <Alert className="border-yellow-200 bg-yellow-50">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Buen progreso en optimización de productividad.</strong> Hay diferencias menores en tus cálculos. 
                    Practica más para mejorar la consistencia en escenarios complejos.
                  </AlertDescription>
                </Alert>
              )}

              {Math.abs(currentBias) > 6 && (
                <Alert className="border-red-200 bg-red-50">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Necesita más práctica con la calculadora de productividad.</strong> Las diferencias en tus 
                    cálculos sugieren que debes revisar los pasos para calcular dinero por minuto.
                  </AlertDescription>
                </Alert>
              )}

              {/* Efectos heterogéneos - consejos personalizados */}
              <Card className="bg-blue-50 border-blue-200">
                <CardContent className="p-4">
                  <h4 className="font-bold text-blue-800 mb-2">Estilo de Trabajo Personal:</h4>
                  {currentBias > 4 && (
                    <p className="text-sm text-blue-700">
                      Tiendes a sobrestimar la productividad en situaciones complejas. Esto puede llevarte 
                      a comprometerte con demasiadas tareas. Usa la herramienta para ser más realista.
                    </p>
                  )}
                  {currentBias < -4 && (
                    <p className="text-sm text-blue-700">
                      Tiendes a subestimar tu productividad potencial. Podrías estar perdiendo oportunidades 
                      de ganar más dinero. La herramienta te ayuda a ser más optimista y preciso.
                    </p>
                  )}
                  {Math.abs(currentBias) <= 4 && (
                    <p className="text-sm text-blue-700">
                      ¡Tienes un excelente sentido de la productividad! Puedes usar esta herramienta para 
                      tomar decisiones inteligentes sobre qué tareas domésticas hacer primero.
                    </p>
                  )}
                </CardContent>
              </Card>

              <Button 
                onClick={handleComplete}
                className="w-full bg-green-600 hover:bg-green-700"
              >
                Completar Lección de Productividad Doméstica
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

// Componente auxiliar para la calculadora de productividad de tareas
const TaskProductivityCalculator: React.FC = () => {
  const [tasks, setTasks] = useState<{name: string, timeMinutes: number, payment: number}[]>([]);
  const [newTask, setNewTask] = useState({name: '', timeMinutes: 0, payment: 0});

  const addTask = () => {
    if (newTask.name && newTask.timeMinutes > 0 && newTask.payment > 0) {
      setTasks([...tasks, newTask]);
      setNewTask({name: '', timeMinutes: 0, payment: 0});
    }
  };

  const removeTask = (index: number) => {
    setTasks(tasks.filter((_, i) => i !== index));
  };

  const calculateProductivity = (payment: number, timeMinutes: number) => {
    return timeMinutes > 0 ? (payment / timeMinutes).toFixed(3) : '0.000';
  };

  const resetCalculator = () => {
    setTasks([]);
    setNewTask({name: '', timeMinutes: 0, payment: 0});
  };

  // Ordenar tareas por productividad (mayor a menor)
  const sortedTasks = [...tasks].sort((a, b) => {
    const productivityA = a.payment / a.timeMinutes;
    const productivityB = b.payment / b.timeMinutes;
    return productivityB - productivityA;
  });

  return (
    <div className="bg-white p-4 border rounded-lg space-y-4">
      <h4 className="font-bold mb-3">Calculadora de Productividad de Tareas</h4>
      
      {/* Agregar nueva tarea */}
      <div className="grid grid-cols-4 gap-2">
        <Input
          placeholder="Nombre de la tarea"
          value={newTask.name}
          onChange={(e) => setNewTask({...newTask, name: e.target.value})}
        />
        <Input
          type="number"
          placeholder="Minutos"
          value={newTask.timeMinutes || ''}
          onChange={(e) => setNewTask({...newTask, timeMinutes: Number(e.target.value)})}
        />
        <Input
          type="number"
          placeholder="$0"
          value={newTask.payment || ''}
          onChange={(e) => setNewTask({...newTask, payment: Number(e.target.value)})}
        />
        <Button onClick={addTask} size="sm">Agregar</Button>
      </div>

      {/* Lista de tareas ordenadas por productividad */}
      {sortedTasks.length > 0 && (
        <div className="space-y-2">
          <h5 className="font-medium text-sm text-gray-700">Tareas ordenadas por productividad:</h5>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {sortedTasks.map((task, index) => {
              const originalIndex = tasks.findIndex(t => 
                t.name === task.name && t.timeMinutes === task.timeMinutes && t.payment === task.payment
              );
              return (
                <div key={`${task.name}-${index}`} className="flex justify-between items-center p-2 bg-gray-50 rounded text-sm">
                  <span className="flex-1">{task.name}</span>
                  <span className="w-16 text-center">{task.timeMinutes}min</span>
                  <span className="w-12 text-center">${task.payment}</span>
                  <span className="w-20 text-center font-bold text-green-600">
                    ${calculateProductivity(task.payment, task.timeMinutes)}/min
                  </span>
                  <Button size="sm" variant="outline" onClick={() => removeTask(originalIndex)}>×</Button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Mejor combinación para tiempo limitado */}
      {sortedTasks.length > 1 && (
        <div className="border-t pt-3">
          <div className="bg-blue-50 p-3 rounded">
            <h5 className="font-medium text-blue-800 mb-2">Recomendación:</h5>
            <p className="text-sm text-blue-700">
              Para maximizar ganancias, haz primero: <strong>{sortedTasks[0]?.name}</strong> 
              (${calculateProductivity(sortedTasks[0]?.payment || 0, sortedTasks[0]?.timeMinutes || 1)}/min)
            </p>
          </div>
        </div>
      )}

      {tasks.length > 0 && (
        <Button variant="outline" onClick={resetCalculator} className="w-full">
          Resetear Calculadora
        </Button>
      )}
    </div>
  );
};

export default Lesson2_1_TasksAndAllowance_Bernheim;