import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  PairedTaskComponent, 
  PracticalTool, 
  CompetenceTracker,
  characters,
  PairedTask,
  BiasMetric,
  LessonProgress 
} from './BernheimFrameworkComponents';
import { Calculator, Target, CheckCircle, AlertCircle, BookOpen, TrendingUp, BarChart3, Tag } from 'lucide-react';

interface Lesson1_2Props {
  onComplete: (score: number, progress: LessonProgress) => void;
  onExit: () => void;
}

const Lesson1_2_ExpenseTracking_Bernheim: React.FC<Lesson1_2Props> = ({ onComplete, onExit }) => {
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
            <Tag className="h-5 w-5" />
            Herramienta: Sistema de Categorización de Gastos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-green-100 p-4 rounded-lg">
            <h4 className="font-bold text-green-800 mb-2">Pasos para usar la herramienta:</h4>
            <ol className="list-decimal list-inside space-y-2 text-sm text-green-700">
              <li><strong>Identificar el gasto:</strong> ¿Qué se compró y cuánto costó?</li>
              <li><strong>Aplicar matriz de categorización:</strong> Necesario vs. Deseado</li>
              <li><strong>Asignar categoría específica:</strong> Usar etiquetas precisas</li>
              <li><strong>Registrar con fecha:</strong> Anotar cuándo ocurrió el gasto</li>
              <li><strong>Analizar patrones:</strong> Revisar distribución por categorías</li>
            </ol>
          </div>
          
          <ExpenseTracker />
          
          <div className="bg-gray-100 p-3 rounded-lg">
            <p className="text-sm text-gray-700">
              <strong>Categorías principales:</strong> 
            </p>
            <ul className="text-xs text-gray-600 mt-1 space-y-1">
              <li>• <strong>Necesarios:</strong> Comida, transporte, materiales escolares</li>
              <li>• <strong>Deseados:</strong> Entretenimiento, dulces, juguetes</li>
              <li>• <strong>Ahorro:</strong> Dinero destinado para metas futuras</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // ETAPA 2: DECISIONES DE VALUACIÓN - TAREAS PAREADAS
  const pairedTask: PairedTask = {
    id: 'expense-categorization-task',
    complexProblem: {
      question: "Ana fue de compras y gastó: $25 en una camiseta muy bonita que vio en ofertas, $8 en el almuerzo porque su mamá no pudo preparar comida ese día, $15 en dulces y sodas para compartir con sus amigas durante el recreo, y $12 en cuadernos porque se le acabaron las hojas. ¿Cuánto gastó Ana en la categoría 'Necesarios' usando el sistema de categorización?",
      context: "Ana debe evaluar cada gasto considerando si realmente es necesario o es un deseo, sin dejarse influir por las justificaciones emocionales.",
      correctAnswer: 20,
      explanation: "Necesarios: Almuerzo $8 (comida esencial) + Cuadernos $12 (material escolar) = $20. La camiseta y dulces son 'Deseados'."
    },
    transparentProblem: {
      question: "¿Cuánto dinero se gasta en categoría 'Necesarios' si compras: almuerzo $8 y cuadernos $12?",
      context: "Suma directa de gastos ya identificados como necesarios.",
      correctAnswer: 20,
      explanation: "$8 + $12 = $20 en gastos necesarios."
    }
  };

  // Tarea pareada adicional para efectos heterogéneos
  const pairedTaskAdvanced: PairedTask = {
    id: 'expense-pattern-analysis-task',
    complexProblem: {
      question: "Mario lleva un mes registrando sus gastos. Gastó: $150 en videojuegos premium (dice que los necesita para relajarse después de estudiar), $80 en comida porque no le gusta la de la cafetería, $40 en transporte extra porque prefiere llegar cómodo, y $30 en útiles escolares esenciales. Su amigo dice que Mario gasta demasiado en 'caprichos'. ¿Cuánto gastó Mario realmente en 'Deseados' según el sistema de categorización?",
      context: "Mario debe aplicar la categorización objetiva sin dejarse influir por sus justificaciones personales.",
      correctAnswer: 190,
      explanation: "Deseados: Videojuegos $150 + Comida de preferencia $80 - comida básica necesaria + Transporte extra $40 - transporte básico = $190. Solo útiles $30 son necesarios."
    },
    transparentProblem: {
      question: "¿Cuánto se gasta en 'Deseados' si tienes: entretenimiento $150, comida de lujo $80, y transporte cómodo $40?",
      context: "Suma directa de gastos ya identificados como deseados.",
      correctAnswer: 270,
      explanation: "$150 + $80 + $40 = $270 en gastos deseados."
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
      conceptMastered: Math.abs(biasScore) <= 10, // Competencia si sesgo ≤ $10 en categorización
      biasReduction: biasReduction,
      completedTasks: [...lessonProgress.completedTasks, currentPairedTask.id],
      timeSpent: lessonProgress.timeSpent + 480 // 8-9 minutos estimados por tarea
    };

    setLessonProgress(newProgress);
    setCurrentStage('evaluation');
  };

  const handleComplete = () => {
    const finalScore = lessonProgress.conceptMastered ? 100 : 
      Math.max(0, 100 - Math.abs(currentBias) * 2);
    onComplete(finalScore, lessonProgress);
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <Card className="border-2 border-purple-200">
        <CardHeader className="bg-purple-50">
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-6 w-6" />
            LECCIÓN: Sistema de Categorización de Gastos
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <Badge variant="outline" className="bg-blue-100">
              Edad: 10-14 años
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
                1. CONCEPTO SUSTANTIVO: Sistema de Categorización de Gastos
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-gray-700">
                Aprende a clasificar cada gasto usando un sistema objetivo que distingue entre 
                necesidades reales y deseos personales. Esta herramienta te permite analizar 
                tus patrones de gasto y tomar decisiones más informadas sobre tu dinero.
              </p>

              <PracticalTool
                title="Sistema de Categorización de Gastos"
                description="Método sistemático para clasificar gastos en categorías objetivas"
                tool={practicalTool}
                examples={[
                  {
                    input: { gasto: "Almuerzo $15, videojuego $40" },
                    output: { necesarios: "$15", deseados: "$40" },
                    explanation: "Almuerzo = necesario (alimentación básica), Videojuego = deseado (entretenimiento)"
                  },
                  {
                    input: { gastos: "Cuadernos $8, dulces $5, transporte $10" },
                    output: { necesarios: "$18", deseados: "$5" },
                    explanation: "Cuadernos + transporte = $18 necesarios, dulces = $5 deseados"
                  },
                  {
                    input: { compras: "Ropa básica $25, ropa de marca $60" },
                    output: { necesarios: "$25", deseados: "$60" },
                    explanation: "Ropa básica = necesario, ropa de marca = deseado (preferencia personal)"
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
                Practica aplicando el sistema de categorización en situaciones reales donde las 
                justificaciones personales pueden influir en la clasificación. Usa criterios objetivos 
                para resolver ambos problemas de manera consistente. {tasksCompleted === 0 ? 
                "Completarás 2 ejercicios que muestran diferentes tipos de sesgos en la categorización." : 
                "Este es tu segundo ejercicio con análisis de patrones de gasto más complejos."}
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
                3. EVALUACIÓN: Competencia Deliberativa en Categorización de Gastos
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <p className="text-gray-700 mb-4">
                Tu competencia se mide por la consistencia en clasificar gastos usando criterios 
                objetivos, sin dejarse influir por justificaciones emocionales o preferencias personales. 
                Una herramienta bien dominada produce categorizaciones coherentes.
              </p>
            </CardContent>
          </Card>

          <CompetenceTracker
            biasHistory={biasHistory}
            targetReduction={15}
            currentBias={currentBias}
          />

          {/* Métricas específicas de categorización de gastos */}
          <Card className="border-purple-200">
            <CardHeader className="bg-purple-50">
              <CardTitle>Métricas de Competencia en Categorización de Gastos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-4 bg-blue-100 rounded-lg">
                  <p className="text-2xl font-bold text-blue-600">
                    {lessonProgress.conceptMastered ? 'DOMINADO' : 'EN PROGRESO'}
                  </p>
                  <p className="text-sm text-blue-800">Sistema de Categorización</p>
                </div>
                <div className="text-center p-4 bg-green-100 rounded-lg">
                  <p className="text-2xl font-bold text-green-600">
                    ${Math.abs(currentBias)}
                  </p>
                  <p className="text-sm text-green-800">Sesgo de Categorización</p>
                </div>
                <div className="text-center p-4 bg-orange-100 rounded-lg">
                  <p className="text-2xl font-bold text-orange-600">
                    {tasksCompleted}/2
                  </p>
                  <p className="text-sm text-orange-800">Escenarios Practicados</p>
                </div>
              </div>

              {/* Interpretación del sesgo específica para categorización */}
              {Math.abs(currentBias) <= 10 && (
                <Alert className="border-green-200 bg-green-50">
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>¡Excelente dominio de la categorización de gastos!</strong> Clasificas 
                    gastos de manera consistente usando criterios objetivos. Puedes analizar 
                    tus patrones de gasto con confianza.
                  </AlertDescription>
                </Alert>
              )}

              {Math.abs(currentBias) > 10 && Math.abs(currentBias) <= 25 && (
                <Alert className="border-yellow-200 bg-yellow-50">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Buen progreso en categorización de gastos.</strong> Tienes diferencias 
                    menores al clasificar gastos complejos. Practica más para mantener objetividad 
                    ante justificaciones emocionales.
                  </AlertDescription>
                </Alert>
              )}

              {Math.abs(currentBias) > 25 && (
                <Alert className="border-red-200 bg-red-50">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Necesita más práctica con la herramienta.</strong> Las variaciones en 
                    tus categorizaciones sugieren que debes revisar los criterios objetivos para 
                    distinguir necesidades de deseos.
                  </AlertDescription>
                </Alert>
              )}

              {/* Efectos heterogéneos - consejos personalizados */}
              <Card className="bg-blue-50 border-blue-200">
                <CardContent className="p-4">
                  <h4 className="font-bold text-blue-800 mb-2">Perfil de Categorización Personalizado:</h4>
                  {currentBias > 15 && (
                    <p className="text-sm text-blue-700">
                      Tiendes a clasificar más gastos como "necesarios" cuando hay justificaciones 
                      emocionales. El sistema te ayudará a mantener criterios objetivos y distinguir 
                      verdaderas necesidades de preferencias personales.
                    </p>
                  )}
                  {currentBias < -15 && (
                    <p className="text-sm text-blue-700">
                      Tiendes a ser muy estricto clasificando gastos como "deseados". El sistema te ayudará 
                      a reconocer gastos que sí son necesidades legítimas, incluso si no parecen esenciales.
                    </p>
                  )}
                  {Math.abs(currentBias) <= 15 && (
                    <p className="text-sm text-blue-700">
                      ¡Tienes un excelente equilibrio en la categorización! Puedes clasificar gastos 
                      de manera objetiva y usar esta información para optimizar tu presupuesto.
                    </p>
                  )}
                </CardContent>
              </Card>

              <Button 
                onClick={handleComplete}
                className="w-full bg-green-600 hover:bg-green-700"
              >
                Completar Lección de Categorización de Gastos
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

// Componente auxiliar para el rastreador de gastos
const ExpenseTracker: React.FC = () => {
  const [expenses, setExpenses] = useState<Array<{
    description: string;
    amount: number;
    category: string;
    date: string;
  }>>([]);
  const [newExpense, setNewExpense] = useState({
    description: '',
    amount: 0,
    category: 'necesarios',
    date: new Date().toISOString().split('T')[0]
  });

  const addExpense = () => {
    if (newExpense.description && newExpense.amount > 0) {
      setExpenses([...expenses, { ...newExpense }]);
      setNewExpense({
        description: '',
        amount: 0,
        category: 'necesarios',
        date: new Date().toISOString().split('T')[0]
      });
    }
  };

  const getTotalByCategory = (category: string) => {
    return expenses
      .filter(expense => expense.category === category)
      .reduce((total, expense) => total + expense.amount, 0);
  };

  const resetTracker = () => {
    setExpenses([]);
  };

  return (
    <div className="bg-white p-4 border rounded-lg space-y-4">
      <h4 className="font-bold mb-3">Rastreador Práctico de Gastos</h4>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Descripción del gasto</label>
          <Input
            type="text"
            value={newExpense.description}
            onChange={(e) => setNewExpense({...newExpense, description: e.target.value})}
            placeholder="Ej: Almuerzo"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Cantidad ($)</label>
          <Input
            type="number"
            value={newExpense.amount || ''}
            onChange={(e) => setNewExpense({...newExpense, amount: Number(e.target.value)})}
            placeholder="0"
            min="0"
            step="0.01"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Categoría</label>
          <Select 
            value={newExpense.category} 
            onValueChange={(value) => setNewExpense({...newExpense, category: value})}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="necesarios">Necesarios</SelectItem>
              <SelectItem value="deseados">Deseados</SelectItem>
              <SelectItem value="ahorro">Ahorro</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Fecha</label>
          <Input
            type="date"
            value={newExpense.date}
            onChange={(e) => setNewExpense({...newExpense, date: e.target.value})}
          />
        </div>
      </div>

      <Button onClick={addExpense} className="w-full">
        Agregar Gasto
      </Button>

      {expenses.length > 0 && (
        <div className="border-t pt-4">
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="text-center p-3 bg-red-100 rounded-lg">
              <div className="text-sm font-medium mb-1">Necesarios</div>
              <div className="text-xl font-bold text-red-600">
                ${getTotalByCategory('necesarios')}
              </div>
            </div>
            <div className="text-center p-3 bg-blue-100 rounded-lg">
              <div className="text-sm font-medium mb-1">Deseados</div>
              <div className="text-xl font-bold text-blue-600">
                ${getTotalByCategory('deseados')}
              </div>
            </div>
            <div className="text-center p-3 bg-green-100 rounded-lg">
              <div className="text-sm font-medium mb-1">Ahorro</div>
              <div className="text-xl font-bold text-green-600">
                ${getTotalByCategory('ahorro')}
              </div>
            </div>
          </div>
          
          <div className="max-h-32 overflow-y-auto">
            <div className="space-y-2">
              {expenses.map((expense, index) => (
                <div key={index} className="flex justify-between items-center p-2 bg-gray-50 rounded text-sm">
                  <span>{expense.description}</span>
                  <span className="font-medium">${expense.amount}</span>
                  <Badge variant="outline" className={
                    expense.category === 'necesarios' ? 'bg-red-100' :
                    expense.category === 'deseados' ? 'bg-blue-100' : 'bg-green-100'
                  }>
                    {expense.category}
                  </Badge>
                </div>
              ))}
            </div>
          </div>

          <Button variant="outline" onClick={resetTracker} className="w-full mt-3">
            Resetear Lista
          </Button>
        </div>
      )}
    </div>
  );
};

export default Lesson1_2_ExpenseTracking_Bernheim;