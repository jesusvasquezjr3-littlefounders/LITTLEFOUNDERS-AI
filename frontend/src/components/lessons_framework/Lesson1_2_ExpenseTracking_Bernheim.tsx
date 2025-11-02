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
import { Calculator, Target, CheckCircle, AlertCircle, BookOpen, BarChart3, TrendingUp } from 'lucide-react';

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
            <BarChart3 className="h-5 w-5" />
            Herramienta: Calculadora de Análisis de Gastos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-green-100 p-4 rounded-lg">
            <h4 className="font-bold text-green-800 mb-2">Pasos para usar la herramienta:</h4>
            <ol className="list-decimal list-inside space-y-2 text-sm text-green-700">
              <li><strong>Registrar cada gasto:</strong> Anota monto y categoría inmediatamente</li>
              <li><strong>Categorizar sistemáticamente:</strong> Necesidades, Deseos, Ahorro, Emergencias</li>
              <li><strong>Calcular porcentajes:</strong> % de cada categoría del total</li>
              <li><strong>Aplicar regla 50/30/20:</strong> 50% necesidades, 30% deseos, 20% ahorro</li>
              <li><strong>Identificar desviaciones:</strong> ¿Dónde hay mayor diferencia con la regla?</li>
            </ol>
          </div>
          
          <ExpenseAnalyzer />
          
          <div className="bg-gray-100 p-3 rounded-lg">
            <p className="text-sm text-gray-700">
              <strong>Fórmula:</strong> % Categoría = (Gasto Categoría ÷ Gasto Total) × 100
            </p>
            <p className="text-xs text-gray-600 mt-1">
              *Regla 50/30/20: Referencia para distribución balanceada
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // ETAPA 2: DECISIONES DE VALUACIÓN - TAREAS PAREADAS
  const pairedTask: PairedTask = {
    id: 'expense-analysis-task',
    complexProblem: {
      question: "Ana recibe $200 mensuales de mesada. Esta semana gastó: almuerzo escolar ($35), videojuego nuevo ($45), ahorros para bicicleta ($25), útiles escolares ($15), cine con amigos ($30), ropa ($25), snacks ($20). Usando la calculadora de análisis, ¿qué porcentaje gastó en DESEOS?",
      context: "Ana debe clasificar todos sus gastos y calcular qué porcentaje corresponde a deseos vs necesidades.",
      correctAnswer: 38,
      explanation: "Deseos: videojuego ($45) + cine ($30) + ropa ($25) = $100. Porcentaje = ($100 ÷ $195) × 100 = 38%"
    },
    transparentProblem: {
      question: "Si gastaste $100 en deseos de un total de $195, ¿qué porcentaje gastaste en deseos?",
      context: "Cálculo directo de porcentaje de gastos en deseos.",
      correctAnswer: 38,
      explanation: "Porcentaje = ($100 ÷ $195) × 100 = 38%"
    }
  };

  // Tarea pareada adicional para efectos heterogéneos
  const pairedTaskAdvanced: PairedTask = {
    id: 'spending-pattern-task',
    complexProblem: {
      question: "Carlos es muy cuidadoso con el dinero. Tiene $150 semanales. Gastó: transporte ($20), comida ($40), libro escolar ($15), videojuego ($30), ahorro ($35). Carlos piensa que sus gastos están 'mal' porque gastó en entretenimiento. Usando la herramienta sistemática, ¿qué porcentaje gastó en necesidades reales?",
      context: "Carlos debe usar criterios objetivos, no juicios emocionales sobre sus gastos.",
      correctAnswer: 53,
      explanation: "Necesidades: transporte ($20) + comida ($40) + libro ($15) = $75. Porcentaje = ($75 ÷ $140) × 100 = 53%"
    },
    transparentProblem: {
      question: "Si gastaste $75 en necesidades de un total de $140, ¿qué porcentaje gastaste en necesidades?",
      context: "Cálculo objetivo sin juicios emocionales.",
      correctAnswer: 53,
      explanation: "Porcentaje = ($75 ÷ $140) × 100 = 53%"
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
      conceptMastered: Math.abs(biasScore) <= 5, // Competencia si sesgo ≤ 5% en análisis
      biasReduction: biasReduction,
      completedTasks: [...lessonProgress.completedTasks, currentPairedTask.id],
      timeSpent: lessonProgress.timeSpent + 420 // 7 minutos estimados por tarea
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
            LECCIÓN: Calculadora de Análisis de Gastos
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
                1. CONCEPTO SUSTANTIVO: Calculadora de Análisis de Gastos
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-gray-700">
                Aprende a usar una herramienta matemática para analizar objetivamente tus patrones 
                de gasto. Esta herramienta te permite clasificar gastos por categorías y calcular 
                distribuciones precisas para tomar decisiones informadas.
              </p>

              <PracticalTool
                title="Calculadora de Análisis de Gastos"
                description="Sistema para registrar, categorizar y analizar gastos usando criterios objetivos y cálculos precisos"
                tool={practicalTool}
                examples={[
                  {
                    input: { gastos: "Comida $40, Juego $30, Ahorro $20", total: "$90" },
                    output: { necesidades: "44%", deseos: "33%", ahorro: "22%" },
                    explanation: "Necesidades: $40/$90=44%. Deseos: $30/$90=33%. Ahorro: $20/$90=22%"
                  },
                  {
                    input: { gastos: "Transporte $25, Cine $15, Libros $10", total: "$50" },
                    output: { necesidades: "70%", deseos: "30%", ahorro: "0%" },
                    explanation: "Necesidades: ($25+$10)/$50=70%. Deseos: $15/$50=30%"
                  },
                  {
                    input: { gastos: "Ropa $60, Comida $30, Ahorro $30", total: "$120" },
                    output: { necesidades: "25%", deseos: "50%", ahorro: "25%" },
                    explanation: "Necesidades: $30/$120=25%. Deseos: $60/$120=50%. Ahorro: $30/$120=25%"
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
                Practica analizando gastos reales usando la calculadora. Usa la herramienta sistemática 
                para resolver ambos problemas de manera consistente. {tasksCompleted === 0 ? 
                "Primero practicarás con un caso típico." : 
                "Este ejercicio ayuda a personas muy autocríticas a usar criterios objetivos."}
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
                3. EVALUACIÓN: Competencia Deliberativa en Análisis de Gastos
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <p className="text-gray-700 mb-4">
                Tu competencia se mide por la consistencia entre análisis complejos y simples. 
                Una herramienta bien dominada produce cálculos similares independientemente 
                de la complejidad del escenario de gastos.
              </p>
            </CardContent>
          </Card>

          <CompetenceTracker
            biasHistory={biasHistory}
            targetReduction={10}
            currentBias={currentBias}
          />

          {/* Métricas específicas del análisis de gastos */}
          <Card className="border-purple-200">
            <CardHeader className="bg-purple-50">
              <CardTitle>Métricas de Competencia en Análisis de Gastos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-4 bg-blue-100 rounded-lg">
                  <p className="text-2xl font-bold text-blue-600">
                    {lessonProgress.conceptMastered ? 'DOMINADO' : 'EN PROGRESO'}
                  </p>
                  <p className="text-sm text-blue-800">Estado del Análisis</p>
                </div>
                <div className="text-center p-4 bg-green-100 rounded-lg">
                  <p className="text-2xl font-bold text-green-600">
                    {Math.abs(currentBias)}%
                  </p>
                  <p className="text-sm text-green-800">Sesgo de Cálculo</p>
                </div>
                <div className="text-center p-4 bg-orange-100 rounded-lg">
                  <p className="text-2xl font-bold text-orange-600">
                    {tasksCompleted}/2
                  </p>
                  <p className="text-sm text-orange-800">Análisis Completados</p>
                </div>
              </div>

              {/* Interpretación del sesgo específica para análisis de gastos */}
              {Math.abs(currentBias) <= 5 && (
                <Alert className="border-green-200 bg-green-50">
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>¡Excelente dominio del análisis de gastos!</strong> Tus cálculos son muy consistentes. 
                    Puedes analizar tus patrones de gasto con precisión y objetividad.
                  </AlertDescription>
                </Alert>
              )}

              {Math.abs(currentBias) > 5 && Math.abs(currentBias) <= 15 && (
                <Alert className="border-yellow-200 bg-yellow-50">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Buen progreso en el análisis sistemático.</strong> Hay diferencias menores en tus cálculos. 
                    Practica más para mejorar la consistencia en la clasificación de gastos.
                  </AlertDescription>
                </Alert>
              )}

              {Math.abs(currentBias) > 15 && (
                <Alert className="border-red-200 bg-red-50">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Necesita más práctica con la herramienta sistemática.</strong> Las diferencias en tus análisis 
                    sugieren que debes revisar los criterios de clasificación y cálculo.
                  </AlertDescription>
                </Alert>
              )}

              {/* Efectos heterogéneos - consejos personalizados */}
              <Card className="bg-blue-50 border-blue-200">
                <CardContent className="p-4">
                  <h4 className="font-bold text-blue-800 mb-2">Perfil de Análisis Personalizado:</h4>
                  {currentBias > 10 && (
                    <p className="text-sm text-blue-700">
                      Tiendes a sobrestimar ciertos tipos de gastos en análisis complejos. Esto puede llevar 
                      a decisiones sesgadas. Usa la herramienta sistemática para mayor objetividad.
                    </p>
                  )}
                  {currentBias < -10 && (
                    <p className="text-sm text-blue-700">
                      Tiendes a subestimar gastos en situaciones complejas. Podrías pasar por alto patrones 
                      importantes. La herramienta te ayuda a ser más preciso y completo.
                    </p>
                  )}
                  {Math.abs(currentBias) <= 10 && (
                    <p className="text-sm text-blue-700">
                      ¡Tienes un excelente balance en el análisis! Puedes usar esta herramienta con confianza 
                      para analizar y mejorar tus patrones de gasto.
                    </p>
                  )}
                </CardContent>
              </Card>

              <Button 
                onClick={handleComplete}
                className="w-full bg-green-600 hover:bg-green-700"
              >
                Completar Lección de Análisis de Gastos
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

// Componente auxiliar para la calculadora de análisis de gastos
const ExpenseAnalyzer: React.FC = () => {
  const [expenses, setExpenses] = useState<{name: string, amount: number, category: 'necesidad' | 'deseo' | 'ahorro'}[]>([]);
  const [newExpense, setNewExpense] = useState({name: '', amount: 0, category: 'necesidad' as 'necesidad' | 'deseo' | 'ahorro'});

  const addExpense = () => {
    if (newExpense.name && newExpense.amount > 0) {
      setExpenses([...expenses, newExpense]);
      setNewExpense({name: '', amount: 0, category: 'necesidad'});
    }
  };

  const removeExpense = (index: number) => {
    setExpenses(expenses.filter((_, i) => i !== index));
  };

  const calculateAnalysis = () => {
    const total = expenses.reduce((sum, e) => sum + e.amount, 0);
    if (total === 0) return { necesidades: 0, deseos: 0, ahorro: 0, total: 0 };

    const necesidades = expenses.filter(e => e.category === 'necesidad').reduce((sum, e) => sum + e.amount, 0);
    const deseos = expenses.filter(e => e.category === 'deseo').reduce((sum, e) => sum + e.amount, 0);
    const ahorro = expenses.filter(e => e.category === 'ahorro').reduce((sum, e) => sum + e.amount, 0);
    
    return { 
      necesidades: Math.round((necesidades / total) * 100),
      deseos: Math.round((deseos / total) * 100),
      ahorro: Math.round((ahorro / total) * 100),
      total 
    };
  };

  const resetCalculator = () => {
    setExpenses([]);
    setNewExpense({name: '', amount: 0, category: 'necesidad'});
  };

  const analysis = calculateAnalysis();

  return (
    <div className="bg-white p-4 border rounded-lg space-y-4">
      <h4 className="font-bold mb-3">Analizador Práctico de Gastos</h4>
      
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
          value={newExpense.category}
          onChange={(e) => setNewExpense({...newExpense, category: e.target.value as any})}
          className="border rounded px-2 py-1 text-sm"
        >
          <option value="necesidad">Necesidad</option>
          <option value="deseo">Deseo</option>
          <option value="ahorro">Ahorro</option>
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
                expense.category === 'necesidad' ? 'bg-red-100' :
                expense.category === 'deseo' ? 'bg-yellow-100' : 'bg-green-100'
              }
            >
              {expense.category}
            </Badge>
            <Button size="sm" variant="outline" onClick={() => removeExpense(index)}>×</Button>
          </div>
        ))}
      </div>

      {/* Análisis por categorías */}
      {expenses.length > 0 && (
        <div className="border-t pt-4">
          <div className="grid grid-cols-3 gap-3 mb-3">
            <div className="text-center p-2 bg-red-100 rounded">
              <div className="text-sm font-medium">Necesidades</div>
              <div className="text-lg font-bold text-red-600">{analysis.necesidades}%</div>
            </div>
            <div className="text-center p-2 bg-yellow-100 rounded">
              <div className="text-sm font-medium">Deseos</div>
              <div className="text-lg font-bold text-yellow-600">{analysis.deseos}%</div>
            </div>
            <div className="text-center p-2 bg-green-100 rounded">
              <div className="text-sm font-medium">Ahorro</div>
              <div className="text-lg font-bold text-green-600">{analysis.ahorro}%</div>
            </div>
          </div>
          
          <div className="p-2 bg-gray-100 rounded text-center mb-3">
            <span className="text-sm font-medium">Total: ${analysis.total}</span>
          </div>

          {/* Comparación con regla 50/30/20 */}
          <div className="bg-blue-50 p-2 rounded text-xs">
            <p className="font-medium text-blue-800 mb-1">Comparación con regla 50/30/20:</p>
            <div className="grid grid-cols-3 gap-2 text-blue-700">
              <span>Necesidades: {analysis.necesidades}% (ideal: 50%)</span>
              <span>Deseos: {analysis.deseos}% (ideal: 30%)</span>
              <span>Ahorro: {analysis.ahorro}% (ideal: 20%)</span>
            </div>
          </div>

          <Button variant="outline" onClick={resetCalculator} className="w-full mt-3">
            Resetear
          </Button>
        </div>
      )}
    </div>
  );
};

export default Lesson1_2_ExpenseTracking_Bernheim;