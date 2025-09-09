import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  PairedTaskComponent, 
  PracticalTool, 
  CompetenceTracker,
  characters,
  PairedTask,
  BiasMetric 
} from './BernheimFrameworkComponents';
import { Calculator, Coins, DollarSign, ShoppingCart } from 'lucide-react';

interface LessonProps {
  onComplete: (score: number, progress: any) => void;
  onExit: () => void;
}

/*
LECCIÓN: Herramienta de Comparación de Valor (Edades 8-10)

1. CONCEPTO SUSTANTIVO
Herramienta: "Cálculo de Valor por Unidad"
- Formula práctica: Precio ÷ Cantidad = Valor por unidad
- Aplicación inmediata: Comparar ofertas reales de productos
- Objetivo: Eliminar sesgo intuitivo en comparaciones de precios
*/

const Lesson_Ages8to10_ValueComparison: React.FC<LessonProps> = ({ onComplete, onExit }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [biasHistory, setBiasHistory] = useState<number[]>([]);
  const [competenceScore, setCompetenceScore] = useState(0);
  const [toolMastery, setToolMastery] = useState(false);

  // Herramienta práctica: Calculadora de valor por unidad
  const ValueCalculatorTool = () => {
    const [price, setPrice] = useState<number>(0);
    const [quantity, setQuantity] = useState<number>(0);
    const [valuePerUnit, setValuePerUnit] = useState<number | null>(null);

    const calculate = () => {
      if (quantity > 0) {
        setValuePerUnit(price / quantity);
      }
    };

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Precio Total ($)</label>
            <Input
              type="number"
              value={price}
              onChange={(e) => setPrice(Number(e.target.value))}
              placeholder="Ej: 12"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Cantidad</label>
            <Input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              placeholder="Ej: 4"
            />
          </div>
        </div>
        <Button onClick={calculate} className="w-full">
          <Calculator className="h-4 w-4 mr-2" />
          Calcular Valor por Unidad
        </Button>
        {valuePerUnit !== null && (
          <div className="bg-green-100 p-4 rounded-lg text-center">
            <p className="text-lg font-bold text-green-800">
              Valor por unidad: ${valuePerUnit.toFixed(2)}
            </p>
            <p className="text-sm text-green-700 mt-1">
              Cada item cuesta ${valuePerUnit.toFixed(2)}
            </p>
          </div>
        )}
      </div>
    );
  };

  // ### 2. TAREAS PAREADAS
  const pairedTasks: PairedTask[] = [
    {
      id: 'cookies_comparison',
      complexProblem: {
        question: "María quiere comprar galletas. ¿Cuál opción le da más galletas por su dinero?",
        context: "Opción A: Caja de 12 galletas por $6. Opción B: Caja de 8 galletas por $3.50",
        correctAnswer: 8, // Opción B (0.44 por galleta vs 0.50)
        explanation: "Opción B: $3.50 ÷ 8 = $0.44 por galleta. Opción A: $6 ÷ 12 = $0.50 por galleta"
      },
      transparentProblem: {
        question: "¿Cuál cuesta menos por galleta?",
        context: "Opción A: $0.50 por galleta. Opción B: $0.44 por galleta",
        correctAnswer: 8, // Opción B
        explanation: "$0.44 es menor que $0.50, así que la Opción B es mejor"
      }
    },
    {
      id: 'juice_comparison',
      complexProblem: {
        question: "Luis quiere comprar jugo. ¿Cuál opción le da más jugo por su dinero?",
        context: "Opción A: Botella de 500ml por $2. Opción B: Botella de 750ml por $2.70",
        correctAnswer: 1, // Opción A (0.004 por ml vs 0.0036)
        explanation: "Opción A: $2 ÷ 500ml = $0.004 por ml. Opción B: $2.70 ÷ 750ml = $0.0036 por ml"
      },
      transparentProblem: {
        question: "¿Cuál cuesta menos por mililitro?",
        context: "Opción A: $0.004 por ml. Opción B: $0.0036 por ml",
        correctAnswer: 2, // Opción B
        explanation: "$0.0036 es menor que $0.004, así que la Opción B es mejor"
      }
    }
  ];

  const handleTaskComplete = (complexAnswer: number, transparentAnswer: number, bias: number) => {
    setBiasHistory([...biasHistory, bias]);
    
    // Evaluar competencia: sesgo menor a 0.1 indica comprensión
    if (Math.abs(bias) < 0.1) {
      setCompetenceScore(competenceScore + 1);
    }

    // Verificar maestría de herramienta
    if (biasHistory.length >= 2 && biasHistory.slice(-2).every(b => Math.abs(b) < 0.1)) {
      setToolMastery(true);
    }
  };

  // ### 3. PROTOCOLO DE PRÁCTICA
  const steps = [
    {
      title: "Presentación de la Herramienta",
      content: (
        <PracticalTool
          title="Calculadora de Valor por Unidad"
          description="Esta herramienta te ayuda a comparar precios dividiendo el costo total entre la cantidad de items. Así puedes ver cuál opción te da más por tu dinero."
          tool={<ValueCalculatorTool />}
          examples={[
            {
              input: { precio: 12, cantidad: 4 },
              output: 3,
              explanation: "Cada item cuesta $3"
            },
            {
              input: { precio: 15, cantidad: 5 },
              output: 3,
              explanation: "También $3 por item - ¡mismo valor!"
            },
            {
              input: { precio: 10, cantidad: 5 },
              output: 2,
              explanation: "$2 por item - ¡mejor valor!"
            }
          ]}
        />
      )
    },
    {
      title: "Práctica con Retroalimentación - Galletas",
      content: (
        <PairedTaskComponent
          task={pairedTasks[0]}
          onComplete={handleTaskComplete}
          showFeedback={true}
        />
      )
    },
    {
      title: "Práctica con Retroalimentación - Jugo",
      content: (
        <PairedTaskComponent
          task={pairedTasks[1]}
          onComplete={handleTaskComplete}
          showFeedback={true}
        />
      )
    },
    {
      title: "Evaluación de Competencia",
      content: (
        <div className="space-y-4">
          <CompetenceTracker
            biasHistory={biasHistory}
            targetReduction={0.5}
            currentBias={biasHistory[biasHistory.length - 1] || 0}
          />
          
          ### 4. MEDICIÓN DE COMPETENCIA
          <Alert className="border-blue-200 bg-blue-50">
            <AlertDescription>
              <strong>Métrica de Éxito:</strong>
              <br />• Sesgo métrico monetario promedio &lt; 0.1 puntos
              <br />• Consistencia en al menos 2 tareas pareadas consecutivas
              <br />• Uso correcto de la herramienta división precio/cantidad
            </AlertDescription>
          </Alert>

          {toolMastery && (
            <Alert className="border-green-200 bg-green-50">
              <AlertDescription>
                <strong>¡Competencia Deliberativa Lograda!</strong>
                <br />Has demostrado que puedes usar la herramienta de valor por unidad 
                para tomar decisiones consistentes entre problemas complejos y simples.
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
      const avgBiasReduction = biasHistory.reduce((sum, bias) => sum + Math.abs(bias), 0) / biasHistory.length;
      const finalScore = Math.max(0, 100 - (avgBiasReduction * 20));
      
      onComplete(finalScore, {
        biasReduction: avgBiasReduction,
        toolMastery,
        completedTasks: pairedTasks.map(t => t.id),
        competenceAchieved: toolMastery
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
            {characters.maestro_dinero.emoji} Herramienta de Comparación de Valor
          </h1>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Edades 8-10</span>
            <Button variant="outline" onClick={onExit}>
              Salir
            </Button>
          </div>
        </div>
        
        {/* Progress bar */}
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
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
          <CardTitle>{steps[currentStep].title}</CardTitle>
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

      {/* Materiales necesarios */}
      {currentStep === 0 && (
        <Alert className="mt-4 border-gray-200">
          <AlertDescription>
            <strong>Materiales Necesarios:</strong>
            <br />• Calculadora (integrada en la herramienta)
            <br />• Ejemplos de productos reales para práctica adicional
            <br />• Tiempo estimado: 20-25 minutos
            <br />• Criterio de éxito: Reducir sesgo métrico a &lt;0.1 puntos
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};

export default Lesson_Ages8to10_ValueComparison;
