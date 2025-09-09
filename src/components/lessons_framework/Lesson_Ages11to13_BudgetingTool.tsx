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
import { Calculator, TrendingUp, PieChart, AlertCircle } from 'lucide-react';

interface LessonProps {
  onComplete: (score: number, progress: any) => void;
  onExit: () => void;
}

/*
LECCIÓN: Herramienta de Presupuestación 50/30/20 (Edades 11-13)

1. CONCEPTO SUSTANTIVO
Herramienta: "Regla Presupuestaria 50/30/20"
- 50% para necesidades básicas (comida, transporte, etc.)
- 30% para deseos (entretenimiento, compras opcionales)
- 20% para ahorros y metas futuras
- Aplicación: Evaluar si una decisión de gasto sigue la regla
*/

const Lesson_Ages11to13_BudgetingTool: React.FC<LessonProps> = ({ onComplete, onExit }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [biasHistory, setBiasHistory] = useState<number[]>([]);
  const [competenceScore, setCompetenceScore] = useState(0);
  const [toolMastery, setToolMastery] = useState(false);

  // Herramienta práctica: Calculadora de presupuesto 50/30/20
  const BudgetCalculatorTool = () => {
    const [income, setIncome] = useState<number>(0);
    const [needs, setNeeds] = useState<number>(0);
    const [wants, setWants] = useState<number>(0);
    const [savings, setSavings] = useState<number>(0);
    const [budget, setBudget] = useState<{needs: number, wants: number, savings: number} | null>(null);
    const [analysis, setAnalysis] = useState<string>('');

    const calculateBudget = () => {
      const needsAllocation = income * 0.5;
      const wantsAllocation = income * 0.3;
      const savingsAllocation = income * 0.2;
      
      setBudget({
        needs: needsAllocation,
        wants: wantsAllocation,
        savings: savingsAllocation
      });

      // Análisis de adherencia a la regla
      const totalSpent = needs + wants + savings;
      const needsPercentage = (needs / income) * 100;
      const wantsPercentage = (wants / income) * 100;
      const savingsPercentage = (savings / income) * 100;

      let analysisText = '';
      if (needsPercentage > 55) analysisText += '⚠️ Gastas demasiado en necesidades. ';
      if (wantsPercentage > 35) analysisText += '⚠️ Gastas demasiado en deseos. ';
      if (savingsPercentage < 15) analysisText += '⚠️ Ahorras muy poco. ';
      if (analysisText === '') analysisText = '✅ ¡Excelente! Sigues bien la regla 50/30/20.';

      setAnalysis(analysisText);
    };

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="block text-sm font-medium mb-1">Ingresos Mensuales ($)</label>
            <Input
              type="number"
              value={income}
              onChange={(e) => setIncome(Number(e.target.value))}
              placeholder="Ej: 100 (mesada + trabajos)"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Gastas en Necesidades ($)</label>
            <Input
              type="number"
              value={needs}
              onChange={(e) => setNeeds(Number(e.target.value))}
              placeholder="Comida, transporte..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Gastas en Deseos ($)</label>
            <Input
              type="number"
              value={wants}
              onChange={(e) => setWants(Number(e.target.value))}
              placeholder="Videojuegos, dulces..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Ahorras ($)</label>
            <Input
              type="number"
              value={savings}
              onChange={(e) => setSavings(Number(e.target.value))}
              placeholder="Para metas futuras"
            />
          </div>
        </div>
        
        <Button onClick={calculateBudget} className="w-full" disabled={income === 0}>
          <PieChart className="h-4 w-4 mr-2" />
          Analizar Mi Presupuesto
        </Button>

        {budget && (
          <div className="space-y-4">
            <div className="bg-gray-100 p-4 rounded-lg">
              <h4 className="font-medium mb-3">Presupuesto Recomendado (Regla 50/30/20):</h4>
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">${budget.needs}</div>
                  <div>Necesidades (50%)</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">${budget.wants}</div>
                  <div>Deseos (30%)</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">${budget.savings}</div>
                  <div>Ahorros (20%)</div>
                </div>
              </div>
            </div>

            <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
              <p className="text-sm text-yellow-800">
                <strong>Análisis de tu presupuesto actual:</strong><br />
                {analysis}
              </p>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ### 2. TAREAS PAREADAS
  const pairedTasks: PairedTask[] = [
    {
      id: 'weekend_spending',
      complexProblem: {
        question: "Ana recibe $80 de mesada. Quiere: nueva app de juegos ($15), almuerzo con amigos ($25), ahorrar para una bicicleta ($30), y necesita dinero para transporte escolar ($10). ¿Sigue la regla 50/30/20?",
        context: "Analiza si la distribución de Ana cumple con: 50% necesidades, 30% deseos, 20% ahorros",
        correctAnswer: 0, // No la sigue (necesidades: 12.5%, deseos: 50%, ahorros: 37.5%)
        explanation: "No sigue la regla: Necesidades $10 (12.5%), Deseos $40 (50%), Ahorros $30 (37.5%)"
      },
      transparentProblem: {
        question: "¿Una distribución de 12.5% necesidades, 50% deseos, 37.5% ahorros sigue la regla 50/30/20?",
        context: "Compara directamente: 12.5/50/37.5 vs 50/30/20",
        correctAnswer: 0, // No
        explanation: "No, porque los porcentajes no coinciden con 50/30/20"
      }
    },
    {
      id: 'monthly_allowance',
      complexProblem: {
        question: "Miguel recibe $120 mensuales. Planea: $60 para comida y transporte, $25 para videojuegos, $35 para su fondo de emergencia. ¿Su plan sigue la regla 50/30/20?",
        context: "Evalúa si Miguel distribuye correctamente según la herramienta presupuestaria",
        correctAnswer: 1, // Sí la sigue (50%, 20.8%, 29.2% - aproximadamente correcto)
        explanation: "Sí: Necesidades $60 (50%), Deseos $25 (20.8%), Ahorros $35 (29.2%) - muy cerca de 50/30/20"
      },
      transparentProblem: {
        question: "¿Una distribución de 50% necesidades, 21% deseos, 29% ahorros sigue aproximadamente la regla 50/30/20?",
        context: "Compara: 50/21/29 vs 50/30/20 (tolerancia ±5%)",
        correctAnswer: 1, // Sí
        explanation: "Sí, está dentro del rango aceptable de ±5% de la regla ideal"
      }
    }
  ];

  const handleTaskComplete = (complexAnswer: number, transparentAnswer: number, bias: number) => {
    setBiasHistory([...biasHistory, bias]);
    
    // Evaluar competencia: sesgo menor a 0.5 indica comprensión
    if (Math.abs(bias) < 0.5) {
      setCompetenceScore(competenceScore + 1);
    }

    // Verificar maestría de herramienta
    if (biasHistory.length >= 2 && biasHistory.slice(-2).every(b => Math.abs(b) < 0.5)) {
      setToolMastery(true);
    }
  };

  // ### 3. PROTOCOLO DE PRÁCTICA
  const steps = [
    {
      title: "Presentación de la Herramienta Presupuestaria",
      content: (
        <div className="space-y-4">
          <Alert className="border-blue-200 bg-blue-50">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>¿Por qué funciona la regla 50/30/20?</strong>
              <br />Esta herramienta está basada en décadas de investigación sobre finanzas personales exitosas. 
              Te ayuda a tomar decisiones consistentes sobre dinero sin emociones del momento.
            </AlertDescription>
          </Alert>
          
          <PracticalTool
            title="Calculadora de Presupuesto 50/30/20"
            description="Esta herramienta divide tu dinero en tres categorías según porcentajes probados científicamente. Úsala antes de tomar cualquier decisión de gasto importante."
            tool={<BudgetCalculatorTool />}
            examples={[
              {
                input: { ingresos: 100, necesidades: 50, deseos: 30, ahorros: 20 },
                output: "✅ Perfecto",
                explanation: "Sigue exactamente la regla científicamente validada"
              },
              {
                input: { ingresos: 100, necesidades: 40, deseos: 50, desahorros: 10 },
                output: "⚠️ Problema",
                explanation: "Gastas demasiado en deseos, muy poco en ahorros"
              }
            ]}
          />
        </div>
      )
    },
    {
      title: "Práctica: Caso de Ana (Decisión Compleja)",
      content: (
        <PairedTaskComponent
          task={pairedTasks[0]}
          onComplete={handleTaskComplete}
          showFeedback={true}
        />
      )
    },
    {
      title: "Práctica: Caso de Miguel (Validación)",
      content: (
        <PairedTaskComponent
          task={pairedTasks[1]}
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
            targetReduction={1.0}
            currentBias={biasHistory[biasHistory.length - 1] || 0}
          />
          
          ### 4. MEDICIÓN DE COMPETENCIA
          <Alert className="border-purple-200 bg-purple-50">
            <AlertDescription>
              <strong>Métrica de Éxito (Sesgo Métrico Monetario):</strong>
              <br />• Diferencia promedio &lt; 0.5 entre decisiones complejas vs. simples
              <br />• Aplicación correcta de porcentajes 50/30/20 en al menos 2 escenarios
              <br />• Reconocimiento de cuándo NO seguir la regla (casos especiales)
            </AlertDescription>
          </Alert>

          {toolMastery && (
            <Alert className="border-green-200 bg-green-50">
              <AlertDescription>
                <strong>🎉 Competencia Deliberativa Lograda!</strong>
                <br />Has demostrado que puedes usar la regla 50/30/20 para evaluar 
                decisiones de presupuesto complejas de manera consistente con evaluaciones simples.
                Esta herramienta te ayudará a evitar sesgos emocionales en decisiones de dinero.
              </AlertDescription>
            </Alert>
          )}

          {!toolMastery && biasHistory.length >= 2 && (
            <Alert className="border-yellow-200 bg-yellow-50">
              <AlertDescription>
                <strong>Necesitas más práctica</strong>
                <br />Tu sesgo métrico indica que aún hay diferencias entre cómo evalúas 
                problemas complejos vs. simples. Practica más con la herramienta.
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
      // Calcular score final basado en reducción de sesgo
      const avgBias = biasHistory.reduce((sum, bias) => sum + Math.abs(bias), 0) / biasHistory.length || 0;
      const finalScore = Math.max(0, 100 - (avgBias * 15));
      
      onComplete(finalScore, {
        biasReduction: avgBias,
        toolMastery,
        completedTasks: pairedTasks.map(t => t.id),
        competenceAchieved: toolMastery,
        toolUsed: "regla_50_30_20"
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
            {characters.sol.emoji} Herramienta de Presupuestación 50/30/20
          </h1>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-blue-100 text-blue-800">
              Edades 11-13
            </Badge>
            <Button variant="outline" onClick={onExit}>
              Salir
            </Button>
          </div>
        </div>
        
        {/* Progress bar */}
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className="bg-gradient-to-r from-blue-500 to-purple-600 h-2 rounded-full transition-all duration-300"
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
            <TrendingUp className="h-5 w-5" />
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
        <Button onClick={handleNext}>
          {currentStep === steps.length - 1 ? 'Completar Lección' : 'Siguiente'}
        </Button>
      </div>

      {/* Materiales y criterios */}
      {currentStep === 0 && (
        <Alert className="mt-4 border-gray-200">
          <AlertDescription>
            <strong>Materiales Necesarios:</strong>
            <br />• Calculadora integrada para porcentajes
            <br />• Ejemplos de ingresos reales para adolescentes
            <br />• Tiempo estimado: 25-30 minutos
            <br />• Criterio de éxito: Sesgo métrico &lt; 0.5 puntos
            <br />• Objetivo: Aplicar regla 50/30/20 consistentemente
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};

export default Lesson_Ages11to13_BudgetingTool;
