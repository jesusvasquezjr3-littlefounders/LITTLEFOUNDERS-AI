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
import { Calculator, Target, CheckCircle, AlertCircle, BookOpen, ListOrdered, Priority } from 'lucide-react';

interface Lesson1_3Props {
  onComplete: (score: number, progress: LessonProgress) => void;
  onExit: () => void;
}

const Lesson1_3_NeedsVsWants_Bernheim: React.FC<Lesson1_3Props> = ({ onComplete, onExit }) => {
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
            <ListOrdered className="h-5 w-5" />
            Herramienta: Calculadora de Priorización de Gastos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-green-100 p-4 rounded-lg">
            <h4 className="font-bold text-green-800 mb-2">Pasos para usar la herramienta:</h4>
            <ol className="list-decimal list-inside space-y-2 text-sm text-green-700">
              <li><strong>Clasificar por impacto:</strong> ¿Qué pasa si NO lo compro?</li>
              <li><strong>Asignar nivel de prioridad:</strong> Alta, Media, o Baja</li>
              <li><strong>Calcular presupuesto disponible:</strong> Total de dinero disponible</li>
              <li><strong>Aplicar regla 70/20/10:</strong> 70% prioridad alta, 20% media, 10% baja</li>
              <li><strong>Verificar y ajustar:</strong> ¿Puedes cubrir todas las prioridades altas?</li>
            </ol>
          </div>
          
          <PriorityCalculator />
          
          <div className="bg-gray-100 p-3 rounded-lg">
            <p className="text-sm text-gray-700">
              <strong>Criterios de clasificación:</strong>
            </p>
            <ul className="text-xs text-gray-600 mt-1 space-y-1">
              <li>• <strong>Alta:</strong> Impacto negativo inmediato si no se compra</li>
              <li>• <strong>Media:</strong> Mejora significativa de calidad de vida</li>
              <li>• <strong>Baja:</strong> Deseable pero no necesario</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // ETAPA 2: DECISIONES DE VALUACIÓN - TAREAS PAREADAS
  const pairedTask: PairedTask = {
    id: 'expense-prioritization-task',
    complexProblem: {
      question: "Mila tiene $60 para la semana. Necesita: almuerzo escolar ($20), cuadernos ($8), medicinas para alergia ($12). Quiere: película con amigos ($15), nueva mochila bonita ($18), videojuego ($25). Usando la herramienta de priorización, ¿cuánto dinero debería asignar a gastos de prioridad ALTA?",
      context: "Mila debe usar criterios objetivos para clasificar y distribuir su dinero entre diferentes tipos de gastos.",
      correctAnswer: 40,
      explanation: "Gastos prioridad alta: almuerzo ($20), cuadernos ($8), medicinas ($12) = $40 total. Los otros son prioridad media/baja."
    },
    transparentProblem: {
      question: "Si tienes $60 y clasificas gastos en: prioridad alta ($40), media ($15), baja ($25), ¿cuánto asignas a prioridad alta?",
      context: "Aplicación directa de asignación por prioridades.",
      correctAnswer: 40,
      explanation: "La prioridad alta recibe $40 del presupuesto total de $60."
    }
  };

  // Tarea pareada adicional para efectos heterogéneos 
  const pairedTaskAdvanced: PairedTask = {
    id: 'priority-flexibility-task',
    complexProblem: {
      question: "Carlos es muy cuidadoso con el dinero. Tiene $80. Clasifica como alta prioridad: comida ($25), libros escolares ($15), transporte ($10). También quiere: ropa nueva ($35), salida con amigos ($20). Si Carlos tiende a ser muy conservador, ¿cuánto debería asignar realmente a prioridad alta usando la herramienta sistemática?",
      context: "Carlos debe balancear su naturaleza conservadora con asignaciones presupuestarias sistemáticas.",
      correctAnswer: 50,
      explanation: "Prioridad alta = $25 + $15 + $10 = $50. La herramienta sistemática dice asignar exactamente esta cantidad, sin ser excesivamente conservador."
    },
    transparentProblem: {
      question: "Con un presupuesto de $80, si los gastos de prioridad alta suman $50, ¿cuánto asignas a prioridad alta?",
      context: "Asignación directa según suma de gastos prioritarios.",
      correctAnswer: 50,
      explanation: "Se asignan exactamente $50 a la prioridad alta según la suma de gastos clasificados."
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
      // Mostrar segunda tarea pareada para efectos heterogéneos
      setCurrentPairedTask(pairedTaskAdvanced);
      return;
    }
    
    // Calcular reducción de sesgo
    const avgBias = newBiasHistory.reduce((a, b) => a + Math.abs(b), 0) / newBiasHistory.length;
    const biasReduction = newBiasHistory.length > 1 ? 
      Math.abs(newBiasHistory[0]) - Math.abs(biasScore) : 0;

    const newProgress: LessonProgress = {
      conceptMastered: Math.abs(biasScore) <= 4, // Competencia si sesgo ≤ $4 en priorización
      biasReduction: biasReduction,
      completedTasks: [...lessonProgress.completedTasks, currentPairedTask.id],
      timeSpent: lessonProgress.timeSpent + 350 // 6 minutos estimados por tarea
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
            <Priority className="h-6 w-6" />
            LECCIÓN: Calculadora de Priorización de Gastos
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <Badge variant="outline" className="bg-blue-100">
              Edad: 9-13 años
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
                1. CONCEPTO SUSTANTIVO: Calculadora de Priorización de Gastos
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-gray-700">
                Aprende a usar una herramienta sistemática para clasificar gastos según su impacto 
                y asignar dinero usando criterios objetivos. Esta herramienta elimina la confusión 
                sobre qué comprar primero cuando el dinero es limitado.
              </p>

              <PracticalTool
                title="Calculadora de Priorización de Gastos"
                description="Sistema objetivo para clasificar gastos por impacto y asignar presupuesto según prioridad"
                tool={practicalTool}
                examples={[
                  {
                    input: { gastos: "Comida $20, Videojuego $30, Medicinas $15" },
                    output: { alta: "$35 (Comida+Medicinas)", media: "$30 (Videojuego)" },
                    explanation: "Criterio: impacto si NO se compra. Comida y medicinas tienen impacto inmediato negativo."
                  },
                  {
                    input: { gastos: "Libros escolares $25, Ropa nueva $40, Transporte $15" },
                    output: { alta: "$40 (Libros+Transporte)", media: "$40 (Ropa nueva)" },
                    explanation: "Libros y transporte son necesarios para funcionar. Ropa nueva mejora pero no es crítica."
                  },
                  {
                    input: { gastos: "Almuerzo $10, Película $12, Cuadernos $8" },
                    output: { alta: "$18 (Almuerzo+Cuadernos)", baja: "$12 (Película)" },
                    explanation: "Almuerzo y cuadernos son funcionales. Película es deseable pero opcional."
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
                Practica clasificando gastos reales usando criterios objetivos. Usa la calculadora de 
                priorización para resolver ambos problemas de manera consistente. {tasksCompleted === 0 ? 
                "Verás dos escenarios con diferentes personalidades financieras." : 
                "Este ejercicio muestra cómo la herramienta funciona con personas muy conservadoras."}
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
                3. EVALUACIÓN: Competencia Deliberativa en Priorización
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <p className="text-gray-700 mb-4">
                Tu competencia se mide por la consistencia en clasificar gastos usando criterios objetivos, 
                independientemente de la complejidad del escenario. Una herramienta bien dominada 
                produce priorizaciones similares.
              </p>
            </CardContent>
          </Card>

          <CompetenceTracker
            biasHistory={biasHistory}
            targetReduction={8}
            currentBias={currentBias}
          />

          {/* Métricas específicas de priorización */}
          <Card className="border-purple-200">
            <CardHeader className="bg-purple-50">
              <CardTitle>Métricas de Competencia en Priorización de Gastos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-4 bg-blue-100 rounded-lg">
                  <p className="text-2xl font-bold text-blue-600">
                    {lessonProgress.conceptMastered ? 'DOMINADO' : 'EN PROGRESO'}
                  </p>
                  <p className="text-sm text-blue-800">Dominio de Criterios</p>
                </div>
                <div className="text-center p-4 bg-green-100 rounded-lg">
                  <p className="text-2xl font-bold text-green-600">
                    ${Math.abs(currentBias)}
                  </p>
                  <p className="text-sm text-green-800">Sesgo de Priorización</p>
                </div>
                <div className="text-center p-4 bg-orange-100 rounded-lg">
                  <p className="text-2xl font-bold text-orange-600">
                    {tasksCompleted}/2
                  </p>
                  <p className="text-sm text-orange-800">Escenarios Resueltos</p>
                </div>
              </div>

              {/* Interpretación del sesgo específica para priorización */}
              {Math.abs(currentBias) <= 4 && (
                <Alert className="border-green-200 bg-green-50">
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>¡Excelente dominio de la priorización sistemática!</strong> Usas criterios objetivos 
                    de manera consistente. Puedes tomar decisiones de gasto con confianza.
                  </AlertDescription>
                </Alert>
              )}

              {Math.abs(currentBias) > 4 && Math.abs(currentBias) <= 12 && (
                <Alert className="border-yellow-200 bg-yellow-50">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Buen progreso en clasificación de gastos.</strong> Hay pequeñas variaciones en cómo 
                    aplicas los criterios. Practica más para mejorar la objetividad.
                  </AlertDescription>
                </Alert>
              )}

              {Math.abs(currentBias) > 12 && (
                <Alert className="border-red-200 bg-red-50">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Necesita más práctica con los criterios objetivos.</strong> Las diferencias en tus 
                    clasificaciones sugieren que debes revisar los pasos de la herramienta sistemática.
                  </AlertDescription>
                </Alert>
              )}

              {/* Efectos heterogéneos - consejos personalizados */}
              <Card className="bg-blue-50 border-blue-200">
                <CardContent className="p-4">
                  <h4 className="font-bold text-blue-800 mb-2">Perfil de Gastos Personalizado:</h4>
                  {currentBias > 8 && (
                    <p className="text-sm text-blue-700">
                      Tiendes a clasificar más gastos como "prioritarios" de lo que sugiere la herramienta. 
                      Esto puede llevarte a justificar gastos innecesarios. Usa los criterios objetivos 
                      para ser más selectivo.
                    </p>
                  )}
                  {currentBias < -8 && (
                    <p className="text-sm text-blue-700">
                      Eres muy estricto clasificando prioridades. Aunque esto puede ser bueno para ahorrar, 
                      la herramienta te ayuda a balancear necesidades reales con calidad de vida.
                    </p>
                  )}
                  {Math.abs(currentBias) <= 8 && (
                    <p className="text-sm text-blue-700">
                      ¡Tienes un excelente balance en la priorización! Puedes usar esta herramienta 
                      con confianza para tomar decisiones objetivas de gasto.
                    </p>
                  )}
                </CardContent>
              </Card>

              <Button 
                onClick={handleComplete}
                className="w-full bg-green-600 hover:bg-green-700"
              >
                Completar Lección de Priorización
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

// Componente auxiliar para la calculadora de prioridades
const PriorityCalculator: React.FC = () => {
  const [expenses, setExpenses] = useState<{name: string, amount: number, priority: 'alta' | 'media' | 'baja'}[]>([]);
  const [newExpense, setNewExpense] = useState({name: '', amount: 0, priority: 'media' as 'alta' | 'media' | 'baja'});

  const addExpense = () => {
    if (newExpense.name && newExpense.amount > 0) {
      setExpenses([...expenses, newExpense]);
      setNewExpense({name: '', amount: 0, priority: 'media'});
    }
  };

  const removeExpense = (index: number) => {
    setExpenses(expenses.filter((_, i) => i !== index));
  };

  const calculateByPriority = () => {
    const alta = expenses.filter(e => e.priority === 'alta').reduce((sum, e) => sum + e.amount, 0);
    const media = expenses.filter(e => e.priority === 'media').reduce((sum, e) => sum + e.amount, 0);
    const baja = expenses.filter(e => e.priority === 'baja').reduce((sum, e) => sum + e.amount, 0);
    
    return { alta, media, baja, total: alta + media + baja };
  };

  const resetCalculator = () => {
    setExpenses([]);
    setNewExpense({name: '', amount: 0, priority: 'media'});
  };

  const priorities = calculateByPriority();

  return (
    <div className="bg-white p-4 border rounded-lg space-y-4">
      <h4 className="font-bold mb-3">Calculadora Práctica de Prioridades</h4>
      
      {/* Agregar nuevo gasto */}
      <div className="grid grid-cols-4 gap-2">
        <Input
          placeholder="Nombre del gasto"
          value={newExpense.name}
          onChange={(e) => setNewExpense({...newExpense, name: e.target.value})}
        />
        <Input
          type="number"
          placeholder="$0"
          value={newExpense.amount || ''}
          onChange={(e) => setNewExpense({...newExpense, amount: Number(e.target.value)})}
        />
        <select 
          value={newExpense.priority}
          onChange={(e) => setNewExpense({...newExpense, priority: e.target.value as any})}
          className="border rounded px-2 py-1 text-sm"
        >
          <option value="alta">Alta</option>
          <option value="media">Media</option>
          <option value="baja">Baja</option>
        </select>
        <Button onClick={addExpense} size="sm">Agregar</Button>
      </div>

      {/* Lista de gastos */}
      <div className="space-y-2 max-h-32 overflow-y-auto">
        {expenses.map((expense, index) => (
          <div key={index} className="flex justify-between items-center p-2 bg-gray-50 rounded text-sm">
            <span>{expense.name}</span>
            <span>${expense.amount}</span>
            <Badge 
              variant="outline" 
              className={
                expense.priority === 'alta' ? 'bg-red-100' :
                expense.priority === 'media' ? 'bg-yellow-100' : 'bg-green-100'
              }
            >
              {expense.priority}
            </Badge>
            <Button size="sm" variant="outline" onClick={() => removeExpense(index)}>×</Button>
          </div>
        ))}
      </div>

      {/* Resumen por prioridades */}
      {expenses.length > 0 && (
        <div className="border-t pt-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center p-2 bg-red-100 rounded">
              <div className="text-sm font-medium">Prioridad Alta</div>
              <div className="text-lg font-bold text-red-600">${priorities.alta}</div>
            </div>
            <div className="text-center p-2 bg-yellow-100 rounded">
              <div className="text-sm font-medium">Prioridad Media</div>
              <div className="text-lg font-bold text-yellow-600">${priorities.media}</div>
            </div>
            <div className="text-center p-2 bg-green-100 rounded">
              <div className="text-sm font-medium">Prioridad Baja</div>
              <div className="text-lg font-bold text-green-600">${priorities.baja}</div>
            </div>
          </div>
          
          <div className="mt-3 p-2 bg-gray-100 rounded text-center">
            <span className="text-sm font-medium">Total: ${priorities.total}</span>
          </div>

          <Button variant="outline" onClick={resetCalculator} className="w-full mt-3">
            Resetear
          </Button>
        </div>
      )}
    </div>
  );
};

export default Lesson1_3_NeedsVsWants_Bernheim;