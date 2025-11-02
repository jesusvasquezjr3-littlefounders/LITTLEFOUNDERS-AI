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
import { Calculator, TrendingUp, Clock, DollarSign, Zap } from 'lucide-react';

interface LessonProps {
  onComplete: (score: number, progress: any) => void;
  onExit: () => void;
}

/*
LECCIÓN: La Regla del 72 - Herramienta de Interés Compuesto (Edades 14-16)

1. CONCEPTO SUSTANTIVO
Herramienta: "La Regla del 72"
- Fórmula: 72 ÷ tasa de interés = años para duplicar dinero
- Aplicación: Evaluar oportunidades de inversión reales
- Objetivo: Cuantificar el poder del tiempo en las finanzas
*/

const Lesson_Ages14to16_CompoundInterest: React.FC<LessonProps> = ({ onComplete, onExit }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [biasHistory, setBiasHistory] = useState<number[]>([]);
  const [competenceScore, setCompetenceScore] = useState(0);
  const [toolMastery, setToolMastery] = useState(false);

  // Herramienta práctica: Calculadora de la Regla del 72
  const Rule72Calculator = () => {
    const [interestRate, setInterestRate] = useState<number>(0);
    const [yearsToDouble, setYearsToDouble] = useState<number | null>(null);
    const [initialAmount, setInitialAmount] = useState<number>(1000);
    const [timeline, setTimeline] = useState<{year: number, amount: number}[]>([]);
    
    const calculateDoubling = () => {
      if (interestRate > 0) {
        const years = 72 / interestRate;
        setYearsToDouble(Math.round(years * 10) / 10);
        
        // Generar timeline de crecimiento
        const timelineData = [];
        for (let year = 0; year <= years * 2; year += Math.max(1, Math.round(years / 4))) {
          const amount = initialAmount * Math.pow(1 + interestRate/100, year);
          timelineData.push({ year, amount: Math.round(amount) });
        }
        setTimeline(timelineData);
      }
    };

    const [manualYears, setManualYears] = useState<number>(0);
    const [manualRate, setManualRate] = useState<number | null>(null);
    
    const calculateRateFromYears = () => {
      if (manualYears > 0) {
        const rate = 72 / manualYears;
        setManualRate(Math.round(rate * 10) / 10);
      }
    };

    return (
      <div className="space-y-6">
        {/* Calculadora principal */}
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-4 rounded-lg">
          <h4 className="font-medium mb-3 flex items-center gap-2">
            <Calculator className="h-4 w-4" />
            ¿En cuántos años se duplica mi dinero?
          </h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Tasa de Interés Anual (%)</label>
              <Input
                type="number"
                step="0.1"
                value={interestRate}
                onChange={(e) => setInterestRate(Number(e.target.value))}
                placeholder="Ej: 7.2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Cantidad Inicial ($)</label>
              <Input
                type="number"
                value={initialAmount}
                onChange={(e) => setInitialAmount(Number(e.target.value))}
                placeholder="1000"
              />
            </div>
          </div>
          <Button onClick={calculateDoubling} className="w-full mt-3" disabled={interestRate === 0}>
            <Clock className="h-4 w-4 mr-2" />
            Aplicar Regla del 72
          </Button>

          {yearsToDouble && (
            <div className="mt-4 p-4 bg-white rounded-lg border-2 border-green-200">
              <div className="text-center mb-3">
                <div className="text-3xl font-bold text-green-600">
                  {yearsToDouble} años
                </div>
                <p className="text-sm text-gray-600">
                  Tu dinero se duplicará de ${initialAmount.toLocaleString()} a ${(initialAmount * 2).toLocaleString()}
                </p>
              </div>

              {timeline.length > 0 && (
                <div className="mt-4">
                  <h5 className="text-sm font-medium mb-2">Proyección de crecimiento:</h5>
                  <div className="grid grid-cols-4 gap-2 text-xs">
                    {timeline.map((point, index) => (
                      <div key={index} className="text-center p-2 bg-gray-50 rounded">
                        <div className="font-medium">Año {point.year}</div>
                        <div className="text-green-600">${point.amount.toLocaleString()}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Calculadora inversa */}
        <div className="bg-gradient-to-r from-orange-50 to-yellow-50 p-4 rounded-lg">
          <h4 className="font-medium mb-3 flex items-center gap-2">
            <Zap className="h-4 w-4" />
            ¿Qué rendimiento necesito para duplicar en X años?
          </h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Años Deseados</label>
              <Input
                type="number"
                value={manualYears}
                onChange={(e) => setManualYears(Number(e.target.value))}
                placeholder="Ej: 10"
              />
            </div>
            <div>
              <Button onClick={calculateRateFromYears} className="mt-6" disabled={manualYears === 0}>
                Calcular Tasa Necesaria
              </Button>
            </div>
          </div>

          {manualRate && (
            <div className="mt-3 p-3 bg-white rounded border-2 border-orange-200">
              <p className="text-center">
                <span className="text-2xl font-bold text-orange-600">{manualRate}%</span>
                <span className="text-sm text-gray-600 block">
                  tasa anual necesaria para duplicar en {manualYears} años
                </span>
              </p>
            </div>
          )}
        </div>
      </div>
    );
  };

  // ### 2. TAREAS PAREADAS
  const pairedTasks: PairedTask[] = [
    {
      id: 'investment_comparison',
      complexProblem: {
        question: "Sofia tiene $2,000 y dos opciones: Inversión A ofrece 9% anual, Inversión B ofrece 6% anual. ¿Cuántos años menos tarda la Opción A en duplicar su dinero?",
        context: "Usa la Regla del 72 para comparar cuál inversión duplica el dinero más rápido",
        correctAnswer: 4, // A: 72/9=8 años, B: 72/6=12 años, diferencia=4
        explanation: "Opción A: 72÷9 = 8 años. Opción B: 72÷6 = 12 años. Diferencia: 4 años menos"
      },
      transparentProblem: {
        question: "¿Cuántos años menos tarda 8 años comparado con 12 años?",
        context: "Resta simple: 12 - 8 = ?",
        correctAnswer: 4, // 12-8=4
        explanation: "12 - 8 = 4 años menos"
      }
    },
    {
      id: 'savings_goal_planning',
      complexProblem: {
        question: "Diego quiere tener $10,000 para la universidad en 8 años. Si puede conseguir 9% anual, ¿cuánto necesita invertir hoy? (Usa Regla del 72: en 8 años el dinero se duplica)",
        context: "La Regla del 72 dice que a 9%, el dinero se duplica en 8 años (72÷9=8)",
        correctAnswer: 5000, // Si se duplica, necesita $5,000 hoy
        explanation: "Si el dinero se duplica en 8 años, necesita $5,000 hoy para tener $10,000"
      },
      transparentProblem: {
        question: "Si una cantidad se duplica, ¿cuánto necesitas hoy para tener $10,000?",
        context: "Si X × 2 = $10,000, entonces X = ?",
        correctAnswer: 5000, // $10,000 ÷ 2 = $5,000
        explanation: "$10,000 ÷ 2 = $5,000"
      }
    },
    {
      id: 'retirement_planning',
      complexProblem: {
        question: "María, de 16 años, quiere ser millonaria a los 65. Si invierte en un fondo que da 7.2% anual, ¿cuánto necesita invertir hoy? (Pista: 49 años, y el dinero se duplica cada 10 años)",
        context: "Tiene 49 años para invertir. A 7.2%, el dinero se duplica cada 10 años (72÷7.2=10)",
        correctAnswer: 31250, // En 49 años: ~5 duplicaciones = 32x, $1M÷32=$31,250
        explanation: "49 años ≈ 5 duplicaciones (32x crecimiento). $1,000,000 ÷ 32 = $31,250"
      },
      transparentProblem: {
        question: "Si una cantidad se multiplica por 32, ¿cuánto necesitas hoy para tener $1,000,000?",
        context: "Si X × 32 = $1,000,000, entonces X = ?",
        correctAnswer: 31250, // $1,000,000 ÷ 32
        explanation: "$1,000,000 ÷ 32 = $31,250"
      }
    }
  ];

  const handleTaskComplete = (complexAnswer: number, transparentAnswer: number, bias: number) => {
    setBiasHistory([...biasHistory, bias]);
    
    // Evaluar competencia: sesgo menor a 100 indica comprensión (números más grandes)
    if (Math.abs(bias) < 100) {
      setCompetenceScore(competenceScore + 1);
    }

    // Verificar maestría de herramienta
    if (biasHistory.length >= 2 && biasHistory.slice(-2).every(b => Math.abs(b) < 100)) {
      setToolMastery(true);
    }
  };

  // ### 3. PROTOCOLO DE PRÁCTICA
  const steps = [
    {
      title: "La Regla del 72: Herramienta Profesional",
      content: (
        <div className="space-y-4">
          <Alert className="border-purple-200 bg-purple-50">
            <DollarSign className="h-4 w-4" />
            <AlertDescription>
              <strong>¿Por qué la Regla del 72 es científicamente válida?</strong>
              <br />Esta herramienta aproxima matemáticamente el logaritmo natural usado en finanzas profesionales. 
              Es usada por asesores financieros para cálculos rápidos y precisos. Error típico: &lt;1%.
            </AlertDescription>
          </Alert>
          
          <PracticalTool
            title="Calculadora de la Regla del 72"
            description="Herramienta usada por profesionales financieros para calcular rápidamente el tiempo de duplicación o la tasa requerida para metas específicas."
            tool={<Rule72Calculator />}
            examples={[
              {
                input: { tasa: 7.2 },
                output: 10,
                explanation: "A 7.2% anual, tu dinero se duplica en exactamente 10 años"
              },
              {
                input: { años: 12 },
                output: 6,
                explanation: "Necesitas 6% anual para duplicar tu dinero en 12 años"
              },
              {
                input: { tasa: 12 },
                output: 6,
                explanation: "A 12% anual (muy optimista), se duplica en 6 años"
              }
            ]}
          />
        </div>
      )
    },
    {
      title: "Práctica: Comparación de Inversiones",
      content: (
        <PairedTaskComponent
          task={pairedTasks[0]}
          onComplete={handleTaskComplete}
          showFeedback={true}
        />
      )
    },
    {
      title: "Práctica: Planificación de Metas",
      content: (
        <PairedTaskComponent
          task={pairedTasks[1]}
          onComplete={handleTaskComplete}
          showFeedback={true}
        />
      )
    },
    {
      title: "Práctica Avanzada: Planificación de Jubilación",
      content: (
        <PairedTaskComponent
          task={pairedTasks[2]}
          onComplete={handleTaskComplete}
          showFeedback={true}
        />
      )
    },
    {
      title: "Evaluación de Competencia Deliberativa",
      content: (
        <div className="space-y-4">
          <CompetenceTracker
            biasHistory={biasHistory}
            targetReduction={200}
            currentBias={biasHistory[biasHistory.length - 1] || 0}
          />
          
          ### 4. MEDICIÓN DE COMPETENCIA
          <Alert className="border-purple-200 bg-purple-50">
            <AlertDescription>
              <strong>Métrica de Éxito (Sesgo Métrico Monetario):</strong>
              <br />• Diferencia promedio &lt; 100 puntos entre cálculos complejos vs. simples
              <br />• Aplicación correcta de la Regla del 72 en al menos 3 escenarios diferentes
              <br />• Comprensión de cuándo usar cada variante de la herramienta
            </AlertDescription>
          </Alert>

          {toolMastery && (
            <Alert className="border-green-200 bg-green-50">
              <AlertDescription>
                <strong>🚀 Competencia Deliberativa Profesional Lograda!</strong>
                <br />Has demostrado maestría en la Regla del 72. Puedes usar esta herramienta 
                para tomar decisiones financieras complejas con la misma precisión que cálculos simples.
                <br /><br />
                <strong>Próximos pasos profesionales:</strong> Estudiar tasas de inflación, diversificación de riesgo.
              </AlertDescription>
            </Alert>
          )}

          {!toolMastery && biasHistory.length >= 3 && (
            <div className="space-y-3">
              <Alert className="border-orange-200 bg-orange-50">
                <AlertDescription>
                  <strong>Análisis de tu sesgo métrico:</strong>
                  <br />Tu diferencia promedio es {(biasHistory.reduce((a,b) => a + Math.abs(b), 0) / biasHistory.length).toFixed(0)} puntos.
                  <br />Objetivo: &lt; 100 puntos para competencia profesional.
                </AlertDescription>
              </Alert>
              
              <Alert className="border-blue-200 bg-blue-50">
                <AlertDescription>
                  <strong>Recomendación:</strong>
                  <br />Practica más la aplicación directa de 72÷tasa o 72÷años antes de 
                  intentar problemas más complejos. La herramienta debe ser automática.
                </AlertDescription>
              </Alert>
            </div>
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
      // Calcular score final basado en reducción de sesgo y competencia profesional
      const avgBias = biasHistory.reduce((sum, bias) => sum + Math.abs(bias), 0) / biasHistory.length || 0;
      const professionalLevel = avgBias < 100 ? 25 : 0; // Bonus por nivel profesional
      const finalScore = Math.max(0, Math.min(100, 100 - (avgBias * 0.3) + professionalLevel));
      
      onComplete(finalScore, {
        biasReduction: avgBias,
        toolMastery,
        completedTasks: pairedTasks.map(t => t.id),
        competenceAchieved: toolMastery,
        professionalLevel: avgBias < 100,
        toolUsed: "regla_del_72"
      });
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-3xl font-bold text-gray-800">
            {characters.maestro_dinero.emoji} La Regla del 72
          </h1>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-purple-100 text-purple-800">
              Edades 14-16
            </Badge>
            <Badge variant="outline" className="bg-green-100 text-green-800">
              Nivel Profesional
            </Badge>
            <Button variant="outline" onClick={onExit}>
              Salir
            </Button>
          </div>
        </div>
        
        {/* Progress bar */}
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div 
            className="bg-gradient-to-r from-purple-500 via-blue-500 to-green-500 h-3 rounded-full transition-all duration-500"
            style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
          />
        </div>
        <p className="text-sm text-gray-600 mt-2 flex items-center justify-between">
          <span>Paso {currentStep + 1} de {steps.length}</span>
          {toolMastery && (
            <span className="text-green-600 font-medium">✨ Competencia Profesional</span>
          )}
        </p>
      </div>

      {/* Current step content */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-6 w-6" />
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
        <Button onClick={handleNext} className="bg-gradient-to-r from-purple-600 to-blue-600 text-white">
          {currentStep === steps.length - 1 ? '🎯 Completar Lección' : 'Siguiente →'}
        </Button>
      </div>

      {/* Materiales y criterios */}
      {currentStep === 0 && (
        <Alert className="mt-4 border-purple-200 bg-purple-50">
          <AlertDescription>
            <strong>Materiales Necesarios (Nivel Profesional):</strong>
            <br />• Calculadora científica (integrada)
            <br />• Ejemplos de tasas reales del mercado financiero
            <br />• Tiempo estimado: 35-45 minutos
            <br />• Criterio de éxito: Sesgo métrico &lt; 100 puntos
            <br />• Meta: Aplicar Regla del 72 con precisión profesional
            <br />• Validación: Comparar con cálculos de interés compuesto real
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};

export default Lesson_Ages14to16_CompoundInterest;
