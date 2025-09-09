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
import { Calculator, ShoppingCart, Scale, AlertTriangle } from 'lucide-react';

interface LessonProps {
  onComplete: (score: number, progress: any) => void;
  onExit: () => void;
}

/*
LECCIÓN: Herramienta de Costo por Uso (Edades 11-13)

1. CONCEPTO SUSTANTIVO
Herramienta: "Cálculo de Costo por Uso"
- Fórmula: Precio ÷ Veces que lo usarás = Costo real por uso
- Aplicación: Evaluar si una compra vale la pena basado en uso real
- Objetivo: Eliminar sesgo de precio inicial y enfocarse en valor verdadero
*/

const Lesson_Ages11to13_SmartSpending: React.FC<LessonProps> = ({ onComplete, onExit }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [biasHistory, setBiasHistory] = useState<number[]>([]);
  const [competenceScore, setCompetenceScore] = useState(0);
  const [toolMastery, setToolMastery] = useState(false);

  // Herramienta práctica: Calculadora de costo por uso
  const CostPerUseCalculator = () => {
    const [itemPrice, setItemPrice] = useState<number>(0);
    const [expectedUses, setExpectedUses] = useState<number>(0);
    const [timeframe, setTimeframe] = useState<string>('mes');
    const [costPerUse, setCostPerUse] = useState<number | null>(null);
    const [comparison, setComparison] = useState<{item: string, cost: number}[]>([]);

    const calculateCostPerUse = () => {
      if (itemPrice > 0 && expectedUses > 0) {
        const cost = itemPrice / expectedUses;
        setCostPerUse(Math.round(cost * 100) / 100);
        
        // Agregar a comparación
        const newItem = `Artículo $${itemPrice}`;
        setComparison(prev => [...prev, {item: newItem, cost}].slice(-3));
      }
    };

    const resetCalculator = () => {
      setItemPrice(0);
      setExpectedUses(0);
      setCostPerUse(null);
    };

    // Ejemplos de referencia comunes
    const referenceItems = [
      { name: "Película en cine", cost: 12, note: "2 horas de entretenimiento" },
      { name: "Libro", cost: 0.5, note: "Si lo lees 20 veces, $10÷20" },
      { name: "Videojuego", cost: 1, note: "Si juegas 60 horas, $60÷60" },
      { name: "Zapatos deportivos", cost: 0.25, note: "Si los usas 200 días, $50÷200" }
    ];

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Precio del Artículo ($)</label>
            <Input
              type="number"
              value={itemPrice}
              onChange={(e) => setItemPrice(Number(e.target.value))}
              placeholder="Ej: 45"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">¿Cuántas veces lo usarás?</label>
            <Input
              type="number"
              value={expectedUses}
              onChange={(e) => setExpectedUses(Number(e.target.value))}
              placeholder="Ej: 30"
            />
          </div>
        </div>
        
        <div className="flex gap-2">
          <Button onClick={calculateCostPerUse} className="flex-1" disabled={itemPrice === 0 || expectedUses === 0}>
            <Calculator className="h-4 w-4 mr-2" />
            Calcular Costo por Uso
          </Button>
          <Button onClick={resetCalculator} variant="outline">
            Limpiar
          </Button>
        </div>

        {costPerUse !== null && (
          <div className="bg-blue-100 p-4 rounded-lg">
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600">
                ${costPerUse}
              </div>
              <p className="text-sm text-blue-800">
                por cada vez que lo uses
              </p>
            </div>
            
            {costPerUse < 1 && (
              <Badge className="mt-2 bg-green-100 text-green-800">
                ¡Buen valor! Menos de $1 por uso
              </Badge>
            )}
            {costPerUse > 5 && (
              <Badge className="mt-2 bg-red-100 text-red-800">
                Caro: Más de $5 por uso
              </Badge>
            )}
          </div>
        )}

        {/* Tabla de comparación */}
        {comparison.length > 0 && (
          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="font-medium mb-2">Tus cálculos recientes:</h4>
            <div className="space-y-2">
              {comparison.map((item, index) => (
                <div key={index} className="flex justify-between text-sm">
                  <span>{item.item}</span>
                  <span className="font-medium">${item.cost.toFixed(2)}/uso</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Referencias de comparación */}
        <div className="bg-yellow-50 p-4 rounded-lg">
          <h4 className="font-medium mb-2 flex items-center gap-2">
            <Scale className="h-4 w-4" />
            Referencias para comparar:
          </h4>
          <div className="grid grid-cols-2 gap-3 text-xs">
            {referenceItems.map((ref, index) => (
              <div key={index} className="bg-white p-2 rounded border">
                <div className="font-medium">{ref.name}</div>
                <div className="text-green-600">${ref.cost}/uso</div>
                <div className="text-gray-500">{ref.note}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // ### 2. TAREAS PAREADAS
  const pairedTasks: PairedTask[] = [
    {
      id: 'headphones_decision',
      complexProblem: {
        question: "Laura quiere audífonos. Opción A: $80, los usará 2 horas diarias por 6 meses. Opción B: $35, los usará 1 hora diaria por 4 meses. ¿Cuál tiene mejor costo por hora de uso?",
        context: "Calcula costo por hora: Opción A = $80 ÷ (2h×180días) = ? vs Opción B = $35 ÷ (1h×120días) = ?",
        correctAnswer: 1, // A: $0.22/hora vs B: $0.29/hora, A es mejor
        explanation: "Opción A: $80 ÷ 360 horas = $0.22/hora. Opción B: $35 ÷ 120 horas = $0.29/hora"
      },
      transparentProblem: {
        question: "¿Cuál es menor: $0.22 por hora o $0.29 por hora?",
        context: "Comparación directa de costos por hora",
        correctAnswer: 1, // $0.22 es menor (Opción A)
        explanation: "$0.22 es menor que $0.29, así que la Opción A es mejor"
      }
    },
    {
      id: 'video_game_value',
      complexProblem: {
        question: "Martín considera dos videojuegos: Juego X cuesta $60 y espera jugarlo 40 horas. Juego Y cuesta $25 y espera jugarlo 15 horas. ¿Cuál le da más entretenimiento por su dinero?",
        context: "Compara costo por hora de entretenimiento usando la herramienta",
        correctAnswer: 1, // X: $1.50/hora vs Y: $1.67/hora, X es mejor
        explanation: "Juego X: $60 ÷ 40 horas = $1.50/hora. Juego Y: $25 ÷ 15 horas = $1.67/hora"
      },
      transparentProblem: {
        question: "¿Cuál es menor: $1.50 por hora o $1.67 por hora?",
        context: "Comparación directa de costos por hora de uso",
        correctAnswer: 1, // $1.50 es menor (Juego X)
        explanation: "$1.50 es menor que $1.67, así que el Juego X da más valor"
      }
    },
    {
      id: 'clothing_investment',
      complexProblem: {
        question: "Ana ve una chaqueta cara ($120) que usará 3 veces por semana durante todo el año escolar (36 semanas). Su mamá sugiere una más barata ($45) que usará igual. ¿La chaqueta cara vale la diferencia de precio?",
        context: "Calcula si la diferencia en costo por uso justifica el precio extra",
        correctAnswer: 0, // Cara: $1.11/uso vs Barata: $0.42/uso, diferencia no se justifica
        explanation: "Cara: $120 ÷ 108 usos = $1.11/uso. Barata: $45 ÷ 108 usos = $0.42/uso. Diferencia: $0.69/uso extra"
      },
      transparentProblem: {
        question: "¿Vale la pena pagar $0.69 extra por cada vez que uses una chaqueta?",
        context: "¿$0.69 adicional por uso justifica la compra más cara?",
        correctAnswer: 0, // Generalmente no vale la diferencia
        explanation: "$0.69 extra por uso es significativo para una chaqueta que se usa igual"
      }
    }
  ];

  const handleTaskComplete = (complexAnswer: number, transparentAnswer: number, bias: number) => {
    setBiasHistory([...biasHistory, bias]);
    
    // Evaluar competencia: sesgo menor a 0.3 indica comprensión
    if (Math.abs(bias) < 0.3) {
      setCompetenceScore(competenceScore + 1);
    }

    // Verificar maestría de herramienta
    if (biasHistory.length >= 2 && biasHistory.slice(-2).every(b => Math.abs(b) < 0.3)) {
      setToolMastery(true);
    }
  };

  // ### 3. PROTOCOLO DE PRÁCTICA
  const steps = [
    {
      title: "Herramienta de Costo por Uso",
      content: (
        <div className="space-y-4">
          <Alert className="border-orange-200 bg-orange-50">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>¿Por qué funciona el Costo por Uso?</strong>
              <br />Esta herramienta elimina el sesgo del "precio ancla" - cuando solo vemos el precio inicial. 
              Te ayuda a enfocarte en el valor real basado en cuánto realmente usarás el artículo.
            </AlertDescription>
          </Alert>
          
          <PracticalTool
            title="Calculadora de Costo por Uso"
            description="Divide el precio entre las veces que usarás algo para ver su costo real. Compara con actividades que ya conoces para tomar mejores decisiones."
            tool={<CostPerUseCalculator />}
            examples={[
              {
                input: { precio: 60, usos: 60 },
                output: 1,
                explanation: "Como ir al cine - $1 por hora de entretenimiento"
              },
              {
                input: { precio: 100, usos: 20 },
                output: 5,
                explanation: "Muy caro - $5 por uso es como comer en restaurante cada vez"
              },
              {
                input: { precio: 25, usos: 100 },
                output: 0.25,
                explanation: "¡Excelente valor! Solo 25 centavos por uso"
              }
            ]}
          />
        </div>
      )
    },
    {
      title: "Práctica: Decisión de Audífonos",
      content: (
        <PairedTaskComponent
          task={pairedTasks[0]}
          onComplete={handleTaskComplete}
          showFeedback={true}
        />
      )
    },
    {
      title: "Práctica: Valor de Videojuegos",
      content: (
        <PairedTaskComponent
          task={pairedTasks[1]}
          onComplete={handleTaskComplete}
          showFeedback={true}
        />
      )
    },
    {
      title: "Práctica: Inversión en Ropa",
      content: (
        <PairedTaskComponent
          task={pairedTasks[2]}
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
            targetReduction={0.8}
            currentBias={biasHistory[biasHistory.length - 1] || 0}
          />
          
          ### 4. MEDICIÓN DE COMPETENCIA
          <Alert className="border-blue-200 bg-blue-50">
            <AlertDescription>
              <strong>Métrica de Éxito (Sesgo Métrico Monetario):</strong>
              <br />• Diferencia promedio &lt; 0.3 entre evaluaciones complejas vs. simples
              <br />• Uso correcto de división precio÷usos en al menos 3 escenarios
              <br />• Reconocimiento de valores de referencia (cine, comida, etc.)
            </AlertDescription>
          </Alert>

          {toolMastery && (
            <Alert className="border-green-200 bg-green-50">
              <AlertDescription>
                <strong>🎯 Competencia en Decisiones Inteligentes!</strong>
                <br />Has demostrado que puedes usar el costo por uso para evaluar 
                compras complejas de manera consistente. Esta herramienta te protegerá 
                de compras impulsivas y te ayudará a maximizar el valor de tu dinero.
              </AlertDescription>
            </Alert>
          )}

          {!toolMastery && biasHistory.length >= 2 && (
            <Alert className="border-yellow-200 bg-yellow-50">
              <AlertDescription>
                <strong>Continúa practicando:</strong>
                <br />Tu sesgo métrico indica diferencias en cómo evalúas problemas 
                complejos vs. simples. Practica más aplicando directamente precio÷usos.
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
      const finalScore = Math.max(0, 100 - (avgBias * 25));
      
      onComplete(finalScore, {
        biasReduction: avgBias,
        toolMastery,
        completedTasks: pairedTasks.map(t => t.id),
        competenceAchieved: toolMastery,
        toolUsed: "costo_por_uso"
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
            {characters.lucas.emoji} Herramienta de Gasto Inteligente
          </h1>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-orange-100 text-orange-800">
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
            className="bg-gradient-to-r from-orange-500 to-red-500 h-2 rounded-full transition-all duration-300"
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
            <ShoppingCart className="h-5 w-5" />
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
        <Button onClick={handleNext} className="bg-gradient-to-r from-orange-600 to-red-600 text-white">
          {currentStep === steps.length - 1 ? 'Completar Lección' : 'Siguiente'}
        </Button>
      </div>

      {/* Materiales */}
      {currentStep === 0 && (
        <Alert className="mt-4 border-gray-200">
          <AlertDescription>
            <strong>Materiales Necesarios:</strong>
            <br />• Calculadora integrada para divisiones
            <br />• Ejemplos de productos reales que los adolescentes compran
            <br />• Referencias de costos conocidos (cine, comida, transporte)
            <br />• Tiempo estimado: 25-30 minutos
            <br />• Criterio de éxito: Sesgo métrico &lt; 0.3 puntos
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};

export default Lesson_Ages11to13_SmartSpending;
