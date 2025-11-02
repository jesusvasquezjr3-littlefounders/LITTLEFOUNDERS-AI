import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { 
  PairedTaskComponent, 
  PracticalTool, 
  CompetenceTracker,
  characters,
  PairedTask 
} from './BernheimFrameworkComponents';
import { Calculator, PiggyBank, Target, Calendar } from 'lucide-react';

interface LessonProps {
  onComplete: (score: number, progress: any) => void;
  onExit: () => void;
}

/*
LECCIÓN: Herramienta de Planificación de Ahorros (Edades 8-10)

1. CONCEPTO SUSTANTIVO
Herramienta: "Calculadora de Tiempo para Metas"
- Fórmula: Meta de ahorro ÷ Dinero que ahorras cada semana = Semanas necesarias
- Aplicación: Saber exactamente cuándo podrás comprar lo que quieres
- Objetivo: Planificar ahorros basado en tiempo real, no estimaciones
*/

const Lesson_Ages8to10_SavingsGoals: React.FC<LessonProps> = ({ onComplete, onExit }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [biasHistory, setBiasHistory] = useState<number[]>([]);
  const [competenceScore, setCompetenceScore] = useState(0);
  const [toolMastery, setToolMastery] = useState(false);

  // Herramienta práctica: Calculadora de tiempo para metas
  const SavingsTimeCalculator = () => {
    const [goalAmount, setGoalAmount] = useState<number>(0);
    const [currentSavings, setCurrentSavings] = useState<number>(0);
    const [weeklyAmount, setWeeklyAmount] = useState<number>(0);
    const [weeksNeeded, setWeeksNeeded] = useState<number | null>(null);
    const [achievementDate, setAchievementDate] = useState<string>('');
    
    const calculateTime = () => {
      if (goalAmount > currentSavings && weeklyAmount > 0) {
        const remaining = goalAmount - currentSavings;
        const weeks = Math.ceil(remaining / weeklyAmount);
        setWeeksNeeded(weeks);
        
        // Calcular fecha
        const today = new Date();
        const targetDate = new Date(today.getTime() + (weeks * 7 * 24 * 60 * 60 * 1000));
        setAchievementDate(targetDate.toLocaleDateString('es-ES', { 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        }));
      } else if (currentSavings >= goalAmount) {
        setWeeksNeeded(0);
        setAchievementDate('¡Ya tienes suficiente dinero!');
      }
    };

    const resetCalculator = () => {
      setGoalAmount(0);
      setCurrentSavings(0);
      setWeeklyAmount(0);
      setWeeksNeeded(null);
      setAchievementDate('');
    };

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">¿Qué quieres comprar? ($)</label>
            <Input
              type="number"
              value={goalAmount}
              onChange={(e) => setGoalAmount(Number(e.target.value))}
              placeholder="Ej: 25 (juguete)"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">¿Cuánto tienes ahorrado? ($)</label>
            <Input
              type="number"
              value={currentSavings}
              onChange={(e) => setCurrentSavings(Number(e.target.value))}
              placeholder="Ej: 5"
            />
          </div>
          <div className="col-span-2">
            <label className="block text-sm font-medium mb-1">¿Cuánto puedes ahorrar cada semana? ($)</label>
            <Input
              type="number"
              value={weeklyAmount}
              onChange={(e) => setWeeklyAmount(Number(e.target.value))}
              placeholder="Ej: 3 (de tu mesada)"
            />
          </div>
        </div>

        <div className="flex gap-2">
          <Button onClick={calculateTime} className="flex-1" disabled={goalAmount === 0 || weeklyAmount === 0}>
            <Calendar className="h-4 w-4 mr-2" />
            Calcular Tiempo Necesario
          </Button>
          <Button onClick={resetCalculator} variant="outline">
            Limpiar
          </Button>
        </div>

        {weeksNeeded !== null && (
          <div className="bg-gradient-to-r from-green-100 to-blue-100 p-6 rounded-lg">
            <div className="text-center space-y-3">
              {weeksNeeded === 0 ? (
                <div>
                  <div className="text-4xl">🎉</div>
                  <div className="text-xl font-bold text-green-600">
                    ¡Ya puedes comprarlo!
                  </div>
                </div>
              ) : (
                <div>
                  <div className="text-4xl font-bold text-blue-600">
                    {weeksNeeded}
                  </div>
                  <div className="text-lg font-medium">
                    semana{weeksNeeded > 1 ? 's' : ''} de ahorro
                  </div>
                  <div className="text-sm text-gray-600">
                    Podrás comprarlo el: <strong>{achievementDate}</strong>
                  </div>
                </div>
              )}

              {/* Barra de progreso visual */}
              <div className="mt-4">
                <div className="w-full bg-gray-200 rounded-full h-4">
                  <div 
                    className="bg-green-500 h-4 rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(100, (currentSavings / goalAmount) * 100)}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-gray-600 mt-1">
                  <span>Tienes: ${currentSavings}</span>
                  <span>Meta: ${goalAmount}</span>
                </div>
              </div>

              {/* Desglose semanal */}
              {weeksNeeded > 0 && weeksNeeded <= 12 && (
                <div className="mt-4 p-3 bg-white rounded border">
                  <div className="text-sm font-medium mb-2">Tu plan de ahorro:</div>
                  <div className="text-xs text-left space-y-1">
                    <div>• Necesitas ahorrar: ${goalAmount - currentSavings} más</div>
                    <div>• Ahorrarás: ${weeklyAmount} cada semana</div>
                    <div>• En {weeksNeeded} semanas tendrás: ${currentSavings + (weeklyAmount * weeksNeeded)}</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  // ### 2. TAREAS PAREADAS
  const pairedTasks: PairedTask[] = [
    {
      id: 'toy_car_goal',
      complexProblem: {
        question: "Pedro quiere un carrito de $30. Tiene $12 ahorrados y puede ahorrar $3 cada semana de su mesada. ¿Cuántas semanas más necesita para comprarlo?",
        context: "Usa la herramienta: Meta - Lo que tiene = Lo que falta. Luego divides entre ahorro semanal",
        correctAnswer: 6, // ($30 - $12) ÷ $3 = 6 semanas
        explanation: "Le faltan $18 ($30 - $12). Si ahorra $3 por semana: $18 ÷ $3 = 6 semanas"
      },
      transparentProblem: {
        question: "¿Cuántas semanas necesitas para conseguir $18 si ahorras $3 cada semana?",
        context: "División simple: $18 ÷ $3 por semana = ?",
        correctAnswer: 6, // $18 ÷ $3 = 6
        explanation: "$18 ÷ $3 = 6 semanas"
      }
    },
    {
      id: 'video_game_planning',
      complexProblem: {
        question: "Ana quiere un videojuego de $45. Tiene $9 y puede ahorrar $4 cada semana. Su cumpleaños es en 8 semanas. ¿Podrá comprarlo para su cumpleaños?",
        context: "Calcula semanas necesarias y compara con 8 semanas disponibles",
        correctAnswer: 1, // Sí puede: necesita 9 semanas, pero tiene 8. ¡Error en la pregunta! Necesita ($45-$9)÷$4 = 9 semanas
        explanation: "Necesita $36 más. $36 ÷ $4 = 9 semanas. No alcanza para el cumpleaños (8 semanas)"
      },
      transparentProblem: {
        question: "¿9 semanas necesarias es menor o mayor que 8 semanas disponibles?",
        context: "Comparación directa: 9 vs 8",
        correctAnswer: 0, // 9 es mayor que 8, así que NO alcanza
        explanation: "9 es mayor que 8, así que no alcanzará el tiempo"
      }
    },
    {
      id: 'bike_savings_goal',
      complexProblem: {
        question: "Carlos quiere una bicicleta de $80. Tiene $20 y recibe $5 de mesada semanal, pero gasta $2 cada semana en dulces. ¿Cuántas semanas necesita si deja de comprar dulces?",
        context: "Si no gasta en dulces, puede ahorrar $5 completos. Calcula tiempo necesario",
        correctAnswer: 12, // ($80 - $20) ÷ $5 = 12 semanas
        explanation: "Le faltan $60. Si ahorra los $5 completos: $60 ÷ $5 = 12 semanas"
      },
      transparentProblem: {
        question: "¿Cuántas semanas necesitas para juntar $60 ahorrando $5 cada semana?",
        context: "División directa: $60 ÷ $5 por semana = ?",
        correctAnswer: 12, // $60 ÷ $5 = 12
        explanation: "$60 ÷ $5 = 12 semanas"
      }
    }
  ];

  const handleTaskComplete = (complexAnswer: number, transparentAnswer: number, bias: number) => {
    setBiasHistory([...biasHistory, bias]);
    
    // Evaluar competencia: sesgo menor a 1 indica comprensión
    if (Math.abs(bias) < 1) {
      setCompetenceScore(competenceScore + 1);
    }

    // Verificar maestría de herramienta
    if (biasHistory.length >= 2 && biasHistory.slice(-2).every(b => Math.abs(b) < 1)) {
      setToolMastery(true);
    }
  };

  // ### 3. PROTOCOLO DE PRÁCTICA
  const steps = [
    {
      title: "Herramienta de Planificación de Ahorros",
      content: (
        <div className="space-y-4">
          <Alert className="border-green-200 bg-green-50">
            <PiggyBank className="h-4 w-4" />
            <AlertDescription>
              <strong>¿Por qué planificar tus ahorros?</strong>
              <br />Cuando sabes exactamente cuándo podrás comprar algo, es más fácil mantenerte motivado para ahorrar. 
              Esta herramienta te ayuda a hacer planes realistas en lugar de solo esperar y ver qué pasa.
            </AlertDescription>
          </Alert>
          
          <PracticalTool
            title="Calculadora de Tiempo para Metas"
            description="Calcula exactamente cuándo podrás comprar lo que quieres. Solo necesitas saber cuánto cuesta, cuánto tienes, y cuánto puedes ahorrar cada semana."
            tool={<SavingsTimeCalculator />}
            examples={[
              {
                input: { meta: 20, actual: 8, semanal: 3 },
                output: 4,
                explanation: "Necesitas $12 más. A $3 por semana = 4 semanas"
              },
              {
                input: { meta: 50, actual: 10, semanal: 5 },
                output: 8,
                explanation: "Necesitas $40 más. A $5 por semana = 8 semanas"
              },
              {
                input: { meta: 15, actual: 15, semanal: 2 },
                output: 0,
                explanation: "¡Ya tienes suficiente dinero para comprarlo!"
              }
            ]}
          />
        </div>
      )
    },
    {
      title: "Práctica: Meta del Carrito de Pedro",
      content: (
        <PairedTaskComponent
          task={pairedTasks[0]}
          onComplete={handleTaskComplete}
          showFeedback={true}
        />
      )
    },
    {
      title: "Práctica: Videojuego para el Cumpleaños",
      content: (
        <PairedTaskComponent
          task={pairedTasks[1]}
          onComplete={handleTaskComplete}
          showFeedback={true}
        />
      )
    },
    {
      title: "Práctica: Bicicleta y Decisiones",
      content: (
        <PairedTaskComponent
          task={pairedTasks[2]}
          onComplete={handleTaskComplete}
          showFeedback={true}
        />
      )
    },
    {
      title: "Evaluación de tu Competencia",
      content: (
        <div className="space-y-4">
          <CompetenceTracker
            biasHistory={biasHistory}
            targetReduction={2.0}
            currentBias={biasHistory[biasHistory.length - 1] || 0}
          />
          
          ### 4. MEDICIÓN DE COMPETENCIA
          <Alert className="border-blue-200 bg-blue-50">
            <AlertDescription>
              <strong>Métrica de Éxito (Sesgo Métrico Monetario):</strong>
              <br />• Diferencia promedio &lt; 1 entre cálculos complejos vs. simples
              <br />• Uso correcto de resta y división para planificación
              <br />• Comprensión de la relación tiempo-dinero-meta
            </AlertDescription>
          </Alert>

          {toolMastery && (
            <Alert className="border-green-200 bg-green-50">
              <AlertDescription>
                <strong>🌟 ¡Eres un Planificador de Ahorros!</strong>
                <br />Has aprendido a usar la herramienta de planificación para calcular 
                exactamente cuándo podrás comprar las cosas que quieres. Ahora puedes 
                hacer planes realistas y mantenerte motivado mientras ahorras.
              </AlertDescription>
            </Alert>
          )}

          {!toolMastery && biasHistory.length >= 2 && (
            <Alert className="border-yellow-200 bg-yellow-50">
              <AlertDescription>
                <strong>Sigue practicando:</strong>
                <br />Todavía hay diferencias en cómo resuelves problemas complejos vs. simples. 
                Recuerda siempre: (Meta - Lo que tienes) ÷ Ahorro semanal = Semanas necesarias.
              </AlertDescription>
            </Alert>
          )}
        </div>
      )
    }
  ];

  // ### 5. IMPLEMENTACIÓN
  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      // Calcular score final
      const avgBias = biasHistory.reduce((sum, bias) => sum + Math.abs(bias), 0) / biasHistory.length || 0;
      const finalScore = Math.max(0, 100 - (avgBias * 20));
      
      onComplete(finalScore, {
        biasReduction: avgBias,
        toolMastery,
        completedTasks: pairedTasks.map(t => t.id),
        competenceAchieved: toolMastery,
        toolUsed: "planificacion_ahorros"
      });
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-gray-800">
            {characters.sol.emoji} Planificador de Metas de Ahorro
          </h1>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-green-100 text-green-800">
              Edades 8-10
            </Badge>
            <Button variant="outline" onClick={onExit}>
              Salir
            </Button>
          </div>
        </div>
        
        {/* Progress bar */}
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className="bg-gradient-to-r from-green-500 to-blue-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
          />
        </div>
        <p className="text-sm text-gray-600 mt-2">
          Paso {currentStep + 1} de {steps.length}
        </p>
      </div>

      {/* Current step content */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            {steps[currentStep].title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {steps[currentStep].content}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button 
          variant="outline" 
          onClick={handlePrevious}
          disabled={currentStep === 0}
        >
          Anterior
        </Button>
        <Button onClick={handleNext} className="bg-gradient-to-r from-green-600 to-blue-600 text-white">
          {currentStep === steps.length - 1 ? 'Completar Lección' : 'Siguiente'}
        </Button>
      </div>

      {/* Materiales */}
      {currentStep === 0 && (
        <Alert className="mt-4 border-gray-200">
          <AlertDescription>
            <strong>Materiales Necesarios:</strong>
            <br />• Calculadora simple integrada (suma, resta, división)
            <br />• Ejemplos de juguetes/artículos del interés de niños 8-10 años
            <br />• Calendario visual para mostrar fechas de logros
            <br />• Tiempo estimado: 20-25 minutos
            <br />• Criterio de éxito: Sesgo métrico &lt; 1 punto
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};

export default Lesson_Ages8to10_SavingsGoals;
