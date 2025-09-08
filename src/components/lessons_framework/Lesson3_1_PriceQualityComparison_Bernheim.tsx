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
import { Calculator, Target, CheckCircle, AlertCircle, BookOpen, Scale, Search, TrendingDown } from 'lucide-react';

interface Lesson3_1Props {
  onComplete: (score: number, progress: LessonProgress) => void;
  onExit: () => void;
}

const Lesson3_1_PriceQualityComparison_Bernheim: React.FC<Lesson3_1Props> = ({ onComplete, onExit }) => {
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
            <Scale className="h-5 w-5" />
            Herramienta: Calculadora de Valor por Uso
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-green-100 p-4 rounded-lg">
            <h4 className="font-bold text-green-800 mb-2">Pasos para usar la herramienta:</h4>
            <ol className="list-decimal list-inside space-y-2 text-sm text-green-700">
              <li><strong>Identificar duración esperada:</strong> ¿Cuánto durará el producto?</li>
              <li><strong>Calcular costo por período:</strong> Precio ÷ duración en meses</li>
              <li><strong>Evaluar funcionalidad:</strong> ¿Cumple con mis necesidades específicas?</li>
              <li><strong>Aplicar factor de calidad:</strong> Ajustar por nivel de satisfacción esperado</li>
              <li><strong>Comparar métricas finales:</strong> Menor valor por uso = mejor opción</li>
            </ol>
          </div>
          
          <ValueCalculator />
          
          <div className="bg-gray-100 p-3 rounded-lg">
            <p className="text-sm text-gray-700">
              <strong>Fórmula:</strong> Valor por uso = (Precio ÷ Duración en meses) ÷ Factor de calidad
            </p>
            <ul className="text-xs text-gray-600 mt-1 space-y-1">
              <li>• Factor de calidad: 1.0 (básico), 1.2 (bueno), 1.5 (excelente)</li>
              <li>• Menor valor por uso = mejor compra</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // ETAPA 2: DECISIONES DE VALUACIÓN - TAREAS PAREADAS
  const pairedTask: PairedTask = {
    id: 'value-calculation-task',
    complexProblem: {
      question: "David compara audífonos: Marca A ($60, dura 12 meses, calidad básica), Marca B ($100, dura 24 meses, calidad excelente), Marca C ($40, dura 6 meses, calidad básica). David usará los audífonos todos los días para estudiar. Usando la calculadora de valor por uso, ¿cuál opción tiene el MEJOR valor?",
      context: "David necesita evaluar objetivamente cuál opción le dará más valor considerando precio, duración y calidad.",
      correctAnswer: 3.33,
      explanation: "Marca B: ($100 ÷ 24 meses) ÷ 1.5 (excelente) = $2.78 por mes ajustado. Es el mejor valor comparado con A: $5.00 y C: $6.67."
    },
    transparentProblem: {
      question: "Si tienes tres opciones con valores ajustados por mes de: $5.00, $2.78, y $6.67, ¿cuál número es el menor (mejor valor)?",
      context: "Comparación directa de valores calculados.",
      correctAnswer: 2.78,
      explanation: "$2.78 es el valor menor, representando el mejor valor por uso."
    }
  };

  // Tarea pareada adicional para efectos heterogéneos 
  const pairedTaskAdvanced: PairedTask = {
    id: 'quality-preference-task',
    complexProblem: {
      question: "Ana es muy exigente con la calidad y planifica usar una mochila diariamente durante toda la secundaria (4 años). Opciones: Marca Premium ($200, dura 5 años, calidad excelente), Marca Estándar ($80, dura 2 años, calidad buena), Marca Económica ($40, dura 1 año, calidad básica). ¿Cuál tiene mejor valor para el perfil de Ana?",
      context: "Ana debe considerar su preferencia por calidad y uso intensivo a largo plazo.",
      correctAnswer: 2.67,
      explanation: "Marca Premium: ($200 ÷ 60 meses) ÷ 1.5 = $2.22 por mes. Para uso intensivo y preferencia por calidad, es el mejor valor a largo plazo."
    },
    transparentProblem: {
      question: "Para alguien que prioriza calidad y uso a largo plazo, si las opciones cuestan por mes: $2.22, $3.33, y $4.00, ¿cuál es el mejor valor?",
      context: "Comparación de valores mensuales calculados.",
      correctAnswer: 2.22,
      explanation: "$2.22 es el menor costo mensual, representando el mejor valor."
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
      conceptMastered: Math.abs(biasScore) <= 0.5, // Competencia si sesgo ≤ $0.50 en valor por uso
      biasReduction: biasReduction,
      completedTasks: [...lessonProgress.completedTasks, currentPairedTask.id],
      timeSpent: lessonProgress.timeSpent + 400 // 7 minutos estimados por tarea
    };

    setLessonProgress(newProgress);
    setCurrentStage('evaluation');
  };

  const handleComplete = () => {
    const finalScore = lessonProgress.conceptMastered ? 100 : 
      Math.max(0, 100 - Math.abs(currentBias) * 10);
    onComplete(finalScore, lessonProgress);
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <Card className="border-2 border-purple-200">
        <CardHeader className="bg-purple-50">
          <CardTitle className="flex items-center gap-2">
            <TrendingDown className="h-6 w-6" />
            LECCIÓN: Calculadora de Valor por Uso
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <Badge variant="outline" className="bg-blue-100">
              Edad: 11-15 años
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
                1. CONCEPTO SUSTANTIVO: Calculadora de Valor por Uso
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-gray-700">
                Aprende a usar una herramienta matemática para calcular el costo real por unidad de uso 
                de cualquier producto. Esta herramienta elimina la confusión sobre precios altos vs. bajos 
                y te permite comparar productos objetivamente.
              </p>

              <PracticalTool
                title="Calculadora de Valor por Uso"
                description="Sistema matemático para comparar productos basado en costo por período de uso ajustado por calidad"
                tool={practicalTool}
                examples={[
                  {
                    input: { producto: "Zapatillas A", precio: "$80", duracion: "8 meses", calidad: "básica" },
                    output: { valorPorUso: "$10/mes", calificacion: "valor promedio" },
                    explanation: "($80 ÷ 8 meses) ÷ 1.0 = $10 por mes de uso"
                  },
                  {
                    input: { producto: "Zapatillas B", precio: "$120", duracion: "18 meses", calidad: "excelente" },
                    output: { valorPorUso: "$4.44/mes", calificacion: "excelente valor" },
                    explanation: "($120 ÷ 18 meses) ÷ 1.5 = $4.44 por mes de uso ajustado"
                  },
                  {
                    input: { producto: "Audífonos", precio: "$60", duracion: "12 meses", calidad: "buena" },
                    output: { valorPorUso: "$4.17/mes", calificacion: "buen valor" },
                    explanation: "($60 ÷ 12 meses) ÷ 1.2 = $4.17 por mes de uso ajustado"
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
                Practica calculando valor por uso en decisiones de compra reales. Usa la calculadora 
                sistemáticamente para resolver ambos problemas de manera consistente. {tasksCompleted === 0 ? 
                "Compararás productos con diferentes perfiles de precio-calidad." : 
                "Este ejercicio considera preferencias personales y uso a largo plazo."}
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
                3. EVALUACIÓN: Competencia Deliberativa en Comparación de Valor
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <p className="text-gray-700 mb-4">
                Tu competencia se mide por la precisión en calcular valor por uso, independientemente 
                de la complejidad del escenario de compra. Una herramienta bien dominada produce 
                evaluaciones de valor consistentes.
              </p>
            </CardContent>
          </Card>

          <CompetenceTracker
            biasHistory={biasHistory}
            targetReduction={1}
            currentBias={currentBias}
          />

          {/* Métricas específicas de comparación de valor */}
          <Card className="border-purple-200">
            <CardHeader className="bg-purple-50">
              <CardTitle>Métricas de Competencia en Comparación de Valor</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-4 bg-blue-100 rounded-lg">
                  <p className="text-2xl font-bold text-blue-600">
                    {lessonProgress.conceptMastered ? 'DOMINADO' : 'EN PROGRESO'}
                  </p>
                  <p className="text-sm text-blue-800">Dominio de Cálculo</p>
                </div>
                <div className="text-center p-4 bg-green-100 rounded-lg">
                  <p className="text-2xl font-bold text-green-600">
                    ${Math.abs(currentBias).toFixed(2)}
                  </p>
                  <p className="text-sm text-green-800">Sesgo de Valuación</p>
                </div>
                <div className="text-center p-4 bg-orange-100 rounded-lg">
                  <p className="text-2xl font-bold text-orange-600">
                    {tasksCompleted}/2
                  </p>
                  <p className="text-sm text-orange-800">Comparaciones Realizadas</p>
                </div>
              </div>

              {/* Interpretación del sesgo específica para valor por uso */}
              {Math.abs(currentBias) <= 0.5 && (
                <Alert className="border-green-200 bg-green-50">
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>¡Excelente dominio de la calculadora de valor!</strong> Tus cálculos son muy precisos. 
                    Puedes tomar decisiones de compra objetivas con confianza.
                  </AlertDescription>
                </Alert>
              )}

              {Math.abs(currentBias) > 0.5 && Math.abs(currentBias) <= 1.5 && (
                <Alert className="border-yellow-200 bg-yellow-50">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Buen progreso en comparación de valor.</strong> Hay pequeñas variaciones en tus cálculos. 
                    Practica más para mejorar la precisión matemática.
                  </AlertDescription>
                </Alert>
              )}

              {Math.abs(currentBias) > 1.5 && (
                <Alert className="border-red-200 bg-red-50">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Necesita más práctica con la fórmula.</strong> Las diferencias en tus cálculos sugieren 
                    que debes revisar los pasos matemáticos de la herramienta.
                  </AlertDescription>
                </Alert>
              )}

              {/* Efectos heterogéneos - consejos personalizados */}
              <Card className="bg-blue-50 border-blue-200">
                <CardContent className="p-4">
                  <h4 className="font-bold text-blue-800 mb-2">Perfil de Comprador Personalizado:</h4>
                  {currentBias > 1.0 && (
                    <p className="text-sm text-blue-700">
                      Tiendes a subestimar el valor de productos de alta calidad. Recuerda que el precio inicial 
                      alto a menudo se compensa con mayor durabilidad y satisfacción. Usa la herramienta 
                      sistemáticamente para evaluaciones objetivas.
                    </p>
                  )}
                  {currentBias < -1.0 && (
                    <p className="text-sm text-blue-700">
                      Tiendes a sobrevalorar productos caros. Aunque la calidad es importante, la herramienta 
                      te ayuda a identificar cuándo un precio alto no se justifica por el valor real.
                    </p>
                  )}
                  {Math.abs(currentBias) <= 1.0 && (
                    <p className="text-sm text-blue-700">
                      ¡Tienes un excelente balance en evaluación de valor! Puedes usar esta herramienta 
                      con confianza para tomar decisiones de compra objetivas y inteligentes.
                    </p>
                  )}
                </CardContent>
              </Card>

              <Button 
                onClick={handleComplete}
                className="w-full bg-green-600 hover:bg-green-700"
              >
                Completar Lección de Comparación de Valor
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

// Componente auxiliar para la calculadora de valor
const ValueCalculator: React.FC = () => {
  const [products, setProducts] = useState<{name: string, price: number, duration: number, quality: string}[]>([]);
  const [newProduct, setNewProduct] = useState({name: '', price: 0, duration: 0, quality: 'basic'});

  const qualityFactors = {
    'basic': 1.0,
    'good': 1.2,
    'excellent': 1.5
  };

  const addProduct = () => {
    if (newProduct.name && newProduct.price > 0 && newProduct.duration > 0) {
      setProducts([...products, newProduct]);
      setNewProduct({name: '', price: 0, duration: 0, quality: 'basic'});
    }
  };

  const removeProduct = (index: number) => {
    setProducts(products.filter((_, i) => i !== index));
  };

  const calculateValue = (product: any) => {
    const factor = qualityFactors[product.quality as keyof typeof qualityFactors];
    const monthlyValue = (product.price / product.duration) / factor;
    return monthlyValue;
  };

  const resetCalculator = () => {
    setProducts([]);
    setNewProduct({name: '', price: 0, duration: 0, quality: 'basic'});
  };

  const bestValue = products.length > 0 ? 
    products.reduce((best, product) => 
      calculateValue(product) < calculateValue(best) ? product : best
    ) : null;

  return (
    <div className="bg-white p-4 border rounded-lg space-y-4">
      <h4 className="font-bold mb-3">Calculadora Práctica de Valor por Uso</h4>
      
      {/* Agregar nuevo producto */}
      <div className="grid grid-cols-5 gap-2">
        <Input
          placeholder="Nombre"
          value={newProduct.name}
          onChange={(e) => setNewProduct({...newProduct, name: e.target.value})}
        />
        <Input
          type="number"
          placeholder="$0"
          value={newProduct.price || ''}
          onChange={(e) => setNewProduct({...newProduct, price: Number(e.target.value)})}
        />
        <Input
          type="number"
          placeholder="Meses"
          value={newProduct.duration || ''}
          onChange={(e) => setNewProduct({...newProduct, duration: Number(e.target.value)})}
        />
        <select 
          value={newProduct.quality}
          onChange={(e) => setNewProduct({...newProduct, quality: e.target.value})}
          className="border rounded px-2 py-1 text-sm"
        >
          <option value="basic">Básica</option>
          <option value="good">Buena</option>
          <option value="excellent">Excelente</option>
        </select>
        <Button onClick={addProduct} size="sm">Agregar</Button>
      </div>

      {/* Lista de productos con cálculos */}
      <div className="space-y-2 max-h-40 overflow-y-auto">
        {products.map((product, index) => {
          const monthlyValue = calculateValue(product);
          const isBest = bestValue && product === bestValue;
          
          return (
            <div key={index} className={`flex justify-between items-center p-2 rounded text-sm ${
              isBest ? 'bg-green-100 border border-green-300' : 'bg-gray-50'
            }`}>
              <div className="flex-1">
                <span className="font-medium">{product.name}</span>
                <span className="ml-2 text-gray-600">${product.price} / {product.duration}m</span>
              </div>
              <div className="text-right">
                <div className={`font-bold ${isBest ? 'text-green-700' : 'text-gray-700'}`}>
                  ${monthlyValue.toFixed(2)}/mes
                </div>
                <div className="text-xs text-gray-500">
                  Factor: {qualityFactors[product.quality as keyof typeof qualityFactors]}
                </div>
              </div>
              <Button size="sm" variant="outline" onClick={() => removeProduct(index)} className="ml-2">
                ×
              </Button>
            </div>
          );
        })}
      </div>

      {/* Resultado */}
      {bestValue && (
        <div className="border-t pt-4">
          <div className="text-center p-3 bg-green-100 rounded">
            <div className="text-sm font-medium text-green-800">Mejor Valor:</div>
            <div className="text-lg font-bold text-green-700">{bestValue.name}</div>
            <div className="text-sm text-green-600">
              ${calculateValue(bestValue).toFixed(2)} por mes de uso ajustado
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

export default Lesson3_1_PriceQualityComparison_Bernheim;