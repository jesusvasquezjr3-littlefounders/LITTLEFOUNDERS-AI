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
import { Calculator, Target, CheckCircle, AlertCircle, BookOpen, Clock, Briefcase } from 'lucide-react';

interface Lesson1_2Props {
  onComplete: (score: number, progress: LessonProgress) => void;
  onExit: () => void;
}

const Lesson1_2_WhereMoneyComesFrom_Bernheim: React.FC<Lesson1_2Props> = ({ onComplete, onExit }) => {
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
            <Clock className="h-5 w-5" />
            Herramienta: Calculadora de Valor por Tiempo de Trabajo
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-green-100 p-4 rounded-lg">
            <h4 className="font-bold text-green-800 mb-2">Pasos para usar la herramienta:</h4>
            <ol className="list-decimal list-inside space-y-2 text-sm text-green-700">
              <li><strong>Identificar salario por hora:</strong> ¿Cuánto gana la persona por hora?</li>
              <li><strong>Calcular costo del objeto:</strong> ¿Cuánto cuesta lo que quiere comprar?</li>
              <li><strong>Aplicar fórmula:</strong> Horas necesarias = Costo ÷ Salario por hora</li>
              <li><strong>Considerar gastos básicos:</strong> Restar % destinado a necesidades</li>
              <li><strong>Calcular tiempo real:</strong> Ajustar por gastos obligatorios</li>
            </ol>
          </div>
          
          <WorkValueCalculator />
          
          <div className="bg-gray-100 p-3 rounded-lg">
            <p className="text-sm text-gray-700">
              <strong>Fórmula básica:</strong> Tiempo de trabajo = Costo del objeto ÷ Salario por hora neto
            </p>
            <p className="text-xs text-gray-600 mt-1">
              *Salario por hora neto = Salario - gastos obligatorios por hora
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // ETAPA 2: DECISIONES DE VALUACIÓN - TAREAS PAREADAS
  const pairedTask: PairedTask = {
    id: 'work-value-calculation-task',
    complexProblem: {
      question: "María trabaja medio tiempo ganando $15 por hora. Trabaja 20 horas a la semana. Quiere comprar unos zapatos de $90, pero debe destinar 60% de sus ingresos a gastos familiares (comida, transporte). ¿Cuántas horas de trabajo necesita para poder comprar los zapatos?",
      context: "María debe calcular cuántas horas reales de trabajo libre necesita para costear los zapatos.",
      correctAnswer: 15,
      explanation: "Salario neto por hora = $15 × 40% = $6/hora disponible. Tiempo = $90 ÷ $6 = 15 horas de trabajo."
    },
    transparentProblem: {
      question: "Si tienes $6 disponibles por cada hora de trabajo y quieres comprar algo que cuesta $90, ¿cuántas horas necesitas trabajar?",
      context: "Cálculo directo de tiempo de trabajo necesario.",
      correctAnswer: 15,
      explanation: "Tiempo de trabajo = $90 ÷ $6 por hora = 15 horas."
    }
  };

  // Tarea pareada adicional para efectos heterogéneos
  const pairedTaskAdvanced: PairedTask = {
    id: 'work-appreciation-task',
    complexProblem: {
      question: "Carlos piensa que $50 'no es mucho dinero' para un videojuego. Su hermano mayor trabaja en un restaurante ganando $12 por hora y destina 70% a gastos necesarios. Usando la herramienta, ¿cuántas horas debe trabajar su hermano para ganar los $50 'disponibles' para el videojuego?",
      context: "Carlos debe entender el valor real del trabajo detrás del dinero 'disponible'.",
      correctAnswer: 14,
      explanation: "Dinero disponible por hora = $12 × 30% = $3.60/hora. Tiempo = $50 ÷ $3.60 ≈ 14 horas."
    },
    transparentProblem: {
      question: "Si alguien tiene $3.60 disponibles por cada hora de trabajo, ¿cuántas horas debe trabajar para tener $50 disponibles?",
      context: "Cálculo directo del esfuerzo laboral.",
      correctAnswer: 14,
      explanation: "Tiempo = $50 ÷ $3.60 por hora ≈ 14 horas de trabajo."
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
      conceptMastered: Math.abs(biasScore) <= 3, // Competencia si sesgo ≤ 3 horas
      biasReduction: biasReduction,
      completedTasks: [...lessonProgress.completedTasks, currentPairedTask.id],
      timeSpent: lessonProgress.timeSpent + 380 // 6 minutos estimados por tarea
    };

    setLessonProgress(newProgress);
    setCurrentStage('evaluation');
  };

  const handleComplete = () => {
    const finalScore = lessonProgress.conceptMastered ? 100 : 
      Math.max(0, 100 - Math.abs(currentBias) * 4);
    onComplete(finalScore, lessonProgress);
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <Card className="border-2 border-purple-200">
        <CardHeader className="bg-purple-50">
          <CardTitle className="flex items-center gap-2">
            <Briefcase className="h-6 w-6" />
            LECCIÓN: Calculadora de Valor por Tiempo de Trabajo
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
                1. CONCEPTO SUSTANTIVO: Calculadora de Valor por Tiempo de Trabajo
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-gray-700">
                Aprende a usar una herramienta matemática para calcular exactamente cuántas horas de trabajo 
                se necesitan para comprar diferentes cosas. Esta herramienta te ayuda a entender el valor 
                real del dinero en términos de esfuerzo y tiempo.
              </p>

              <PracticalTool
                title="Calculadora de Valor por Tiempo de Trabajo"
                description="Sistema para convertir precios de objetos en horas de trabajo necesarias, considerando gastos obligatorios"
                tool={practicalTool}
                examples={[
                  {
                    input: { salario: "$10/hora", costo: "$30", gastosObligatorios: "50%" },
                    output: { horasNecesarias: "6 horas", salarioDisponible: "$5/hora" },
                    explanation: "Salario disponible = $10 × 50% = $5/hora. Tiempo = $30 ÷ $5 = 6 horas."
                  },
                  {
                    input: { salario: "$8/hora", costo: "$60", gastosObligatorios: "70%" },
                    output: { horasNecesarias: "25 horas", salarioDisponible: "$2.40/hora" },
                    explanation: "Salario disponible = $8 × 30% = $2.40/hora. Tiempo = $60 ÷ $2.40 = 25 horas."
                  },
                  {
                    input: { salario: "$12/hora", costo: "$24", gastosObligatorios: "40%" },
                    output: { horasNecesarias: "3.3 horas", salarioDisponible: "$7.20/hora" },
                    explanation: "Salario disponible = $12 × 60% = $7.20/hora. Tiempo = $24 ÷ $7.20 = 3.3 horas."
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
                Practica calculando el valor real del dinero en términos de tiempo de trabajo. Usa la 
                calculadora para resolver ambos problemas de manera consistente. {tasksCompleted === 0 ? 
                "Primero practicarás con un caso de compra personal." : 
                "Este ejercicio ayuda a valorar mejor el esfuerzo detrás del dinero."}
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
                3. EVALUACIÓN: Competencia Deliberativa en Valoración del Trabajo
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <p className="text-gray-700 mb-4">
                Tu competencia se mide por la consistencia entre cálculos complejos y simples sobre 
                el valor del trabajo. Una herramienta bien dominada produce estimaciones similares 
                independientemente de la complejidad del escenario.
              </p>
            </CardContent>
          </Card>

          <CompetenceTracker
            biasHistory={biasHistory}
            targetReduction={6}
            currentBias={currentBias}
          />

          {/* Métricas específicas de valoración del trabajo */}
          <Card className="border-purple-200">
            <CardHeader className="bg-purple-50">
              <CardTitle>Métricas de Competencia en Valoración del Trabajo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-4 bg-blue-100 rounded-lg">
                  <p className="text-2xl font-bold text-blue-600">
                    {lessonProgress.conceptMastered ? 'DOMINADO' : 'EN PROGRESO'}
                  </p>
                  <p className="text-sm text-blue-800">Concepto de Valor</p>
                </div>
                <div className="text-center p-4 bg-green-100 rounded-lg">
                  <p className="text-2xl font-bold text-green-600">
                    {Math.abs(currentBias)} hrs
                  </p>
                  <p className="text-sm text-green-800">Sesgo de Cálculo</p>
                </div>
                <div className="text-center p-4 bg-orange-100 rounded-lg">
                  <p className="text-2xl font-bold text-orange-600">
                    {tasksCompleted}/2
                  </p>
                  <p className="text-sm text-orange-800">Cálculos Realizados</p>
                </div>
              </div>

              {/* Interpretación del sesgo específica para valoración del trabajo */}
              {Math.abs(currentBias) <= 3 && (
                <Alert className="border-green-200 bg-green-50">
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>¡Excelente comprensión del valor del trabajo!</strong> Tus cálculos son muy precisos. 
                    Entiendes bien la relación entre tiempo de trabajo y valor de las cosas.
                  </AlertDescription>
                </Alert>
              )}

              {Math.abs(currentBias) > 3 && Math.abs(currentBias) <= 8 && (
                <Alert className="border-yellow-200 bg-yellow-50">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Buen progreso en entender el valor del trabajo.</strong> Hay diferencias menores en tus cálculos. 
                    Practica más para mejorar la precisión en situaciones complejas.
                  </AlertDescription>
                </Alert>
              )}

              {Math.abs(currentBias) > 8 && (
                <Alert className="border-red-200 bg-red-50">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Necesita más práctica con la herramienta de valoración.</strong> Las diferencias en tus cálculos 
                    sugieren que debes revisar los pasos para convertir dinero en tiempo de trabajo.
                  </AlertDescription>
                </Alert>
              )}

              {/* Efectos heterogéneos - consejos personalizados */}
              <Card className="bg-blue-50 border-blue-200">
                <CardContent className="p-4">
                  <h4 className="font-bold text-blue-800 mb-2">Perfil de Valoración Personal:</h4>
                  {currentBias > 5 && (
                    <p className="text-sm text-blue-700">
                      Tiendes a sobrestimar el tiempo de trabajo necesario en casos complejos. Esto te puede 
                      hacer valorar demasiado el dinero, pero también ser excesivamente cauteloso. La herramienta 
                      te ayuda a ser más preciso.
                    </p>
                  )}
                  {currentBias < -5 && (
                    <p className="text-sm text-blue-700">
                      Tiendes a subestimar el trabajo necesario para ganar dinero. Esto puede llevarte a gastar 
                      sin considerar completamente el esfuerzo. Usa la herramienta para valorar mejor el trabajo.
                    </p>
                  )}
                  {Math.abs(currentBias) <= 5 && (
                    <p className="text-sm text-blue-700">
                      ¡Tienes una excelente comprensión del valor del trabajo! Puedes usar esta herramienta 
                      para tomar decisiones de gasto más conscientes del esfuerzo que representan.
                    </p>
                  )}
                </CardContent>
              </Card>

              <Button 
                onClick={handleComplete}
                className="w-full bg-green-600 hover:bg-green-700"
              >
                Completar Lección de Valoración del Trabajo
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

// Componente auxiliar para la calculadora de valor por trabajo
const WorkValueCalculator: React.FC = () => {
  const [hourlyWage, setHourlyWage] = useState<number>(0);
  const [itemCost, setItemCost] = useState<number>(0);
  const [obligatoryExpenses, setObligatoryExpenses] = useState<number>(50); // Porcentaje

  const calculateWorkTime = () => {
    if (hourlyWage <= 0) return { availablePerHour: 0, hoursNeeded: 0 };
    
    const availablePercentage = (100 - obligatoryExpenses) / 100;
    const availablePerHour = hourlyWage * availablePercentage;
    
    if (availablePerHour <= 0) return { availablePerHour: 0, hoursNeeded: Infinity };
    
    const hoursNeeded = itemCost / availablePerHour;
    
    return { 
      availablePerHour: Math.round(availablePerHour * 100) / 100,
      hoursNeeded: Math.round(hoursNeeded * 10) / 10 
    };
  };

  const resetCalculator = () => {
    setHourlyWage(0);
    setItemCost(0);
    setObligatoryExpenses(50);
  };

  const calculation = calculateWorkTime();

  return (
    <div className="bg-white p-4 border rounded-lg space-y-4">
      <h4 className="font-bold mb-3">Calculadora de Valor por Trabajo</h4>
      
      <div className="grid grid-cols-1 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Salario por hora ($)</label>
          <Input
            type="number"
            value={hourlyWage || ''}
            onChange={(e) => setHourlyWage(Number(e.target.value))}
            placeholder="Ej: 12"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Costo del objeto ($)</label>
          <Input
            type="number"
            value={itemCost || ''}
            onChange={(e) => setItemCost(Number(e.target.value))}
            placeholder="Ej: 60"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Gastos obligatorios (%)</label>
          <Input
            type="number"
            min="0"
            max="100"
            value={obligatoryExpenses}
            onChange={(e) => setObligatoryExpenses(Number(e.target.value))}
            placeholder="Ej: 70"
          />
          <p className="text-xs text-gray-600 mt-1">Porcentaje del salario que va a gastos necesarios</p>
        </div>
      </div>

      <div className="border-t pt-4">
        <div className="grid grid-cols-2 gap-4 mb-3">
          <div className="text-center p-3 bg-green-100 rounded">
            <span className="text-sm font-medium">Dinero disponible/hora</span>
            <p className="text-lg font-bold text-green-600">
              ${calculation.availablePerHour}
            </p>
          </div>
          <div className="text-center p-3 bg-blue-100 rounded">
            <span className="text-sm font-medium">Horas de trabajo</span>
            <p className="text-lg font-bold text-blue-600">
              {calculation.hoursNeeded === Infinity ? '∞' : calculation.hoursNeeded} hrs
            </p>
          </div>
        </div>
        
        {calculation.hoursNeeded < Infinity && calculation.hoursNeeded > 0 && (
          <div className="bg-yellow-50 p-3 rounded text-sm">
            <p className="font-medium text-yellow-800">
              Para comprar esto necesitas trabajar {calculation.hoursNeeded} horas
              {calculation.hoursNeeded > 8 && ` (más de ${Math.ceil(calculation.hoursNeeded / 8)} días de trabajo)`}
            </p>
          </div>
        )}

        <Button variant="outline" onClick={resetCalculator} className="w-full mt-3">
          Resetear
        </Button>
      </div>
    </div>
  );
};

export default Lesson1_2_WhereMoneyComesFrom_Bernheim;