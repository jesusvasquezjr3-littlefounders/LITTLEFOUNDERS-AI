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
import { Calculator, Target, CheckCircle, AlertCircle, BookOpen, ShoppingCart, Search } from 'lucide-react';

interface Lesson2_2Props {
  onComplete: (score: number, progress: LessonProgress) => void;
  onExit: () => void;
}

const Lesson2_2_SmartPurchaseDecisions_Bernheim: React.FC<Lesson2_2Props> = ({ onComplete, onExit }) => {
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
            <Search className="h-5 w-5" />
            Herramienta: Calculadora de Optimización de Compras
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-green-100 p-4 rounded-lg">
            <h4 className="font-bold text-green-800 mb-2">Pasos para usar la herramienta:</h4>
            <ol className="list-decimal list-inside space-y-2 text-sm text-green-700">
              <li><strong>Definir necesidad:</strong> ¿Qué problema específico necesitas resolver?</li>
              <li><strong>Establecer presupuesto máximo:</strong> ¿Cuál es tu límite de gasto?</li>
              <li><strong>Comparar opciones:</strong> Precio, calidad, durabilidad, características</li>
              <li><strong>Calcular valor por peso:</strong> Beneficios totales ÷ Costo total</li>
              <li><strong>Aplicar regla de espera:</strong> ¿Sigue siendo necesario después de 24h?</li>
            </ol>
          </div>
          
          <PurchaseOptimizer />
          
          <div className="bg-gray-100 p-3 rounded-lg">
            <p className="text-sm text-gray-700">
              <strong>Fórmula:</strong> Valor de Compra = (Utilidad × Durabilidad × Satisfacción) ÷ Precio
            </p>
            <p className="text-xs text-gray-600 mt-1">
              *Mayor puntaje = mejor valor por dinero invertido
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // ETAPA 2: DECISIONES DE VALUACIÓN - TAREAS PAREADAS
  const pairedTask: PairedTask = {
    id: 'purchase-optimization-analysis',
    complexProblem: {
      question: "Marco tiene $80 y necesita auriculares para estudiar. Opción A: Auriculares premium ($75, duran 4 años, excelente calidad). Opción B: Auriculares básicos ($25, duran 1.5 años, calidad media) + quedan $55 para ahorros. ¿Cuál opción da mejor valor considerando costo por año de uso?",
      context: "Marco debe calcular el costo anual real y considerar el dinero restante para decidir objetivamente.",
      correctAnswer: 19,
      explanation: "Opción A: $75 ÷ 4 años = $18.75/año. Opción B: $25 ÷ 1.5 años = $16.67/año + $55 ahorrados. Opción B da mejor valor y flexibilidad financiera."
    },
    transparentProblem: {
      question: "¿Cuál es el costo anual de algo que cuesta $25 y dura 1.5 años?",
      context: "Cálculo directo de costo por año de uso.",
      correctAnswer: 17,
      explanation: "Costo anual = $25 ÷ 1.5 años = $16.67 por año ≈ $17"
    }
  };

  // Tarea pareada adicional para efectos heterogéneos
  const pairedTaskAdvanced: PairedTask = {
    id: 'impulse-vs-planned-purchase',
    complexProblem: {
      question: "Sofia ve una oferta 'limitada' de mochila por $60 (precio normal $80). No la había planeado comprar, pero se ve útil. Tiene $90 totales. También necesita $40 para un regalo de cumpleaños la próxima semana. Usando la regla de espera 24h, ¿debería comprar la mochila ahora?",
      context: "Sofia debe resistir la presión de venta y evaluar objetivamente si la compra es realmente necesaria.",
      correctAnswer: 50,
      explanation: "Después de comprar mochila ($60), le quedan $30, pero necesita $40 para el regalo. No tiene suficiente dinero para ambas cosas. Debería esperar."
    },
    transparentProblem: {
      question: "Si tienes $90, gastas $60 en algo, ¿te quedan suficientes $40 para otra cosa necesaria?",
      context: "Cálculo simple de dinero restante vs. necesidades.",
      correctAnswer: 30,
      explanation: "$90 - $60 = $30 restantes, que es menos que los $40 necesarios."
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
      conceptMastered: Math.abs(biasScore) <= 5, // Competencia si sesgo ≤ $5 en valoraciones
      biasReduction: biasReduction,
      completedTasks: [...lessonProgress.completedTasks, currentPairedTask.id],
      timeSpent: lessonProgress.timeSpent + 390 // 6.5 minutos estimados por tarea
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
            <ShoppingCart className="h-6 w-6" />
            LECCIÓN: Calculadora de Optimización de Compras
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <Badge variant="outline" className="bg-blue-100">
              Edad: 11-16 años
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
                1. CONCEPTO SUSTANTIVO: Calculadora de Optimización de Compras
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-gray-700">
                Aprende a usar una herramienta sistemática para evaluar decisiones de compra 
                considerando precio, calidad, durabilidad y necesidad real. Esta herramienta 
                te ayuda a maximizar el valor que obtienes por cada peso gastado.
              </p>

              <PracticalTool
                title="Calculadora de Optimización de Compras"
                description="Sistema para comparar opciones de compra usando criterios objetivos de valor"
                tool={practicalTool}
                examples={[
                  {
                    input: { producto: "Zapatos A: $80, duran 2 años", alternativa: "Zapatos B: $40, duran 8 meses" },
                    output: { costoAnualA: "$40/año", costoAnualB: "$60/año", mejorOpcion: "Zapatos A" },
                    explanation: "A: $80÷2=$40/año. B: $40÷(8/12)=$60/año. A da mejor valor a largo plazo."
                  },
                  {
                    input: { producto: "Juego $60 vs. Libro $15", presupuesto: "$50" },
                    output: { disponible: "Solo libro", alternativa: "Esperar para el juego" },
                    explanation: "Con $50 solo puedes comprar el libro. Para el juego necesitas ahorrar $10 más."
                  },
                  {
                    input: { producto: "Teléfono premium $500 vs básico $150", necesidad: "Llamadas y mensajes" },
                    output: { recomendacion: "Básico", razon: "Cumple la necesidad real" },
                    explanation: "El básico cumple la función necesaria. El premium tiene características innecesarias."
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
                Practica optimizando decisiones de compra reales. Usa la calculadora sistemática 
                para resolver ambos problemas de manera consistente. {tasksCompleted === 0 ? 
                "Primero compararás opciones considerando durabilidad y costo por uso." : 
                "Ahora practicarás resistir compras impulsivas usando criterios objetivos."}
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
                3. EVALUACIÓN: Competencia Deliberativa en Compras Inteligentes
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <p className="text-gray-700 mb-4">
                Tu competencia se mide por la consistencia entre análisis complejos y simples de 
                compras. Una herramienta bien dominada produce decisiones similares independientemente 
                de la presión emocional o complejidad del escenario.
              </p>
            </CardContent>
          </Card>

          <CompetenceTracker
            biasHistory={biasHistory}
            targetReduction={10}
            currentBias={currentBias}
          />

          {/* Métricas específicas de optimización de compras */}
          <Card className="border-purple-200">
            <CardHeader className="bg-purple-50">
              <CardTitle>Métricas de Competencia en Decisiones de Compra</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-4 bg-blue-100 rounded-lg">
                  <p className="text-2xl font-bold text-blue-600">
                    {lessonProgress.conceptMastered ? 'DOMINADO' : 'EN PROGRESO'}
                  </p>
                  <p className="text-sm text-blue-800">Decisiones Objetivas</p>
                </div>
                <div className="text-center p-4 bg-green-100 rounded-lg">
                  <p className="text-2xl font-bold text-green-600">
                    ${Math.abs(currentBias)}
                  </p>
                  <p className="text-sm text-green-800">Sesgo de Valoración</p>
                </div>
                <div className="text-center p-4 bg-orange-100 rounded-lg">
                  <p className="text-2xl font-bold text-orange-600">
                    {tasksCompleted}/2
                  </p>
                  <p className="text-sm text-orange-800">Decisiones Evaluadas</p>
                </div>
              </div>

              {/* Interpretación del sesgo específica para compras inteligentes */}
              {Math.abs(currentBias) <= 5 && (
                <Alert className="border-green-200 bg-green-50">
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>¡Excelente dominio de las compras inteligentes!</strong> Tus evaluaciones son muy consistentes. 
                    Puedes resistir impulsos y tomar decisiones objetivas basadas en valor real.
                  </AlertDescription>
                </Alert>
              )}

              {Math.abs(currentBias) > 5 && Math.abs(currentBias) <= 15 && (
                <Alert className="border-yellow-200 bg-yellow-50">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Buen progreso en optimización de compras.</strong> Hay diferencias menores en tus análisis. 
                    Practica más para mejorar la resistencia a presiones de venta y compras emocionales.
                  </AlertDescription>
                </Alert>
              )}

              {Math.abs(currentBias) > 15 && (
                <Alert className="border-red-200 bg-red-50">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Necesita más práctica con la herramienta de optimización.</strong> Las diferencias en tus 
                    evaluaciones sugieren vulnerabilidad a compras impulsivas o análisis incompletos.
                  </AlertDescription>
                </Alert>
              )}

              {/* Efectos heterogéneos - consejos personalizados */}
              <Card className="bg-blue-50 border-blue-200">
                <CardContent className="p-4">
                  <h4 className="font-bold text-blue-800 mb-2">Perfil de Compra Personal:</h4>
                  {currentBias > 10 && (
                    <p className="text-sm text-blue-700">
                      Tiendes a sobrevalorar productos en situaciones complejas o emocionales. Esto puede llevarte 
                      a gastar más de lo necesario. Usa siempre la regla de espera 24h antes de compras grandes.
                    </p>
                  )}
                  {currentBias < -10 && (
                    <p className="text-sm text-blue-700">
                      Eres muy conservador en tus evaluaciones de compra. Aunque esto previene gastos innecesarios, 
                      a veces podrías perder oportunidades de valor real. Balancea ahorro con necesidades genuinas.
                    </p>
                  )}
                  {Math.abs(currentBias) <= 10 && (
                    <p className="text-sm text-blue-700">
                      ¡Tienes un excelente equilibrio en las decisiones de compra! Puedes usar esta herramienta 
                      para maximizar valor sin caer en gastos impulsivos o excesiva restricción.
                    </p>
                  )}
                </CardContent>
              </Card>

              <Button 
                onClick={handleComplete}
                className="w-full bg-green-600 hover:bg-green-700"
              >
                Completar Lección de Compras Inteligentes
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

// Componente auxiliar para el optimizador de compras
const PurchaseOptimizer: React.FC = () => {
  const [products, setProducts] = useState<{
    name: string;
    price: number;
    durabilityMonths: number;
    qualityScore: number; // 1-10
    necessityScore: number; // 1-10
  }[]>([]);
  
  const [budget, setBudget] = useState<number>(0);
  const [newProduct, setNewProduct] = useState({
    name: '',
    price: 0,
    durabilityMonths: 12,
    qualityScore: 5,
    necessityScore: 5
  });

  const addProduct = () => {
    if (newProduct.name.trim() && newProduct.price > 0) {
      setProducts([...products, newProduct]);
      setNewProduct({
        name: '',
        price: 0,
        durabilityMonths: 12,
        qualityScore: 5,
        necessityScore: 5
      });
    }
  };

  const calculateProductValue = (product: typeof newProduct) => {
    const monthlyCost = product.price / product.durabilityMonths;
    const valueScore = (product.qualityScore * product.necessityScore * product.durabilityMonths) / product.price;
    const annualCost = monthlyCost * 12;
    
    return {
      monthlyCost: monthlyCost.toFixed(2),
      annualCost: annualCost.toFixed(0),
      valueScore: valueScore.toFixed(3),
      affordable: product.price <= budget
    };
  };

  const resetOptimizer = () => {
    setProducts([]);
    setBudget(0);
  };

  // Ordenar productos por puntaje de valor (mayor a menor)
  const rankedProducts = products.map(product => ({
    ...product,
    analysis: calculateProductValue(product)
  })).sort((a, b) => parseFloat(b.analysis.valueScore) - parseFloat(a.analysis.valueScore));

  return (
    <div className="bg-white p-4 border rounded-lg space-y-4">
      <h4 className="font-bold mb-3">Optimizador de Decisiones de Compra</h4>
      
      {/* Presupuesto */}
      <div className="p-3 bg-gray-50 rounded">
        <label className="block text-sm font-medium mb-1">Presupuesto disponible ($)</label>
        <Input
          type="number"
          value={budget || ''}
          onChange={(e) => setBudget(Number(e.target.value))}
          placeholder="100"
        />
      </div>

      {/* Agregar nuevo producto */}
      <div className="grid grid-cols-5 gap-2">
        <Input
          placeholder="Producto"
          value={newProduct.name}
          onChange={(e) => setNewProduct({...newProduct, name: e.target.value})}
        />
        <Input
          type="number"
          placeholder="Precio $"
          value={newProduct.price || ''}
          onChange={(e) => setNewProduct({...newProduct, price: Number(e.target.value)})}
        />
        <Input
          type="number"
          placeholder="Meses"
          value={newProduct.durabilityMonths || ''}
          onChange={(e) => setNewProduct({...newProduct, durabilityMonths: Number(e.target.value)})}
        />
        <select 
          value={newProduct.qualityScore}
          onChange={(e) => setNewProduct({...newProduct, qualityScore: Number(e.target.value)})}
          className="border rounded px-2 py-1 text-sm"
        >
          {[...Array(10)].map((_, i) => (
            <option key={i} value={i + 1}>Calidad {i + 1}</option>
          ))}
        </select>
        <Button onClick={addProduct} size="sm">+</Button>
      </div>

      {/* Lista de productos evaluados */}
      {rankedProducts.length > 0 && (
        <div className="space-y-2">
          <h5 className="font-medium text-sm text-gray-700">Análisis de opciones (ordenado por valor):</h5>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {rankedProducts.map((product, index) => (
              <div key={`${product.name}-${index}`} className="p-2 bg-gray-50 rounded text-sm">
                <div className="flex justify-between items-center mb-1">
                  <span className={`font-medium ${product.analysis.affordable ? 'text-black' : 'text-red-600'}`}>
                    {product.name} - ${product.price}
                    {!product.analysis.affordable && ' (Fuera de presupuesto)'}
                  </span>
                  <span className="font-bold text-green-600">
                    Valor: {product.analysis.valueScore}
                  </span>
                </div>
                <div className="text-xs text-gray-600">
                  Costo: ${product.analysis.monthlyCost}/mes • ${product.analysis.annualCost}/año
                </div>
              </div>
            ))}
          </div>

          {rankedProducts.some(p => p.analysis.affordable) && (
            <div className="bg-green-50 p-2 rounded text-xs">
              <strong>Recomendación:</strong>{' '}
              {rankedProducts.find(p => p.analysis.affordable)?.name} ofrece el mejor valor 
              dentro de tu presupuesto
            </div>
          )}
        </div>
      )}

      {products.length > 0 && (
        <Button variant="outline" onClick={resetOptimizer} className="w-full">
          Resetear Optimizador
        </Button>
      )}
    </div>
  );
};

export default Lesson2_2_SmartPurchaseDecisions_Bernheim;
