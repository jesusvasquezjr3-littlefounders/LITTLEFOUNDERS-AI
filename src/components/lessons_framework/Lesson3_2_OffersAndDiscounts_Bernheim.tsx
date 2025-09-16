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
import { Calculator, Target, CheckCircle, AlertCircle, BookOpen, Percent, Tag } from 'lucide-react';

interface Lesson3_2Props {
  onComplete: (score: number, progress: LessonProgress) => void;
  onExit: () => void;
}

const Lesson3_2_OffersAndDiscounts_Bernheim: React.FC<Lesson3_2Props> = ({ onComplete, onExit }) => {
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
            <Percent className="h-5 w-5" />
            Herramienta: Calculadora de Valor Real de Ofertas
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-green-100 p-4 rounded-lg">
            <h4 className="font-bold text-green-800 mb-2">Pasos para usar la herramienta:</h4>
            <ol className="list-decimal list-inside space-y-2 text-sm text-green-700">
              <li><strong>Verificar precio base:</strong> Investigar precio "normal" en 3+ tiendas</li>
              <li><strong>Calcular descuento real:</strong> (Precio normal - Precio oferta) ÷ Precio normal</li>
              <li><strong>Evaluar necesidad genuina:</strong> ¿Lo comprarías sin descuento?</li>
              <li><strong>Considerar costos ocultos:</strong> Envío, impuestos, membresías</li>
              <li><strong>Aplicar filtro temporal:</strong> ¿Sigue siendo necesario después de 24h?</li>
            </ol>
          </div>
          
          <OfferAnalyzer />
          
          <div className="bg-gray-100 p-3 rounded-lg">
            <p className="text-sm text-gray-700">
              <strong>Fórmula:</strong> Valor Real = (Ahorro genuino - Costos ocultos) × Factor necesidad
            </p>
            <p className="text-xs text-gray-600 mt-1">
              *Solo es ahorro real si ibas a comprar el producto de todas formas
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // ETAPA 2: DECISIONES DE VALUACIÓN - TAREAS PAREADAS
  const pairedTask: PairedTask = {
    id: 'offer-value-assessment',
    complexProblem: {
      question: "Laura ve una 'oferta especial': Audífonos que 'normalmente cuestan $150' ahora por $75. Investigando encuentra que en otras 3 tiendas cuestan $80-90. Los quería comprar la próxima semana. ¿Cuál es el descuento REAL que obtiene Laura?",
      context: "Laura debe calcular el ahorro real basado en precios de mercado, no en el precio inflado de la tienda.",
      correctAnswer: 6,
      explanation: "Precio real de mercado ≈ $85. Descuento real: ($85 - $75) ÷ $85 = 12% ≈ $10, no los $75 publicitados."
    },
    transparentProblem: {
      question: "Si algo cuesta normalmente $85 y lo compras por $75, ¿cuánto ahorras realmente?",
      context: "Cálculo directo de ahorro real sin marketing inflado.",
      correctAnswer: 10,
      explanation: "Ahorro real = $85 - $75 = $10"
    }
  };

  // Tarea pareada adicional para efectos heterogéneos
  const pairedTaskAdvanced: PairedTask = {
    id: 'impulse-resistance-evaluation',
    complexProblem: {
      question: "Mario ve ropa con '70% descuento, solo hoy'. Precio tachado $200, precio oferta $60. No necesita ropa, pero 'es muy barata'. Membership anual $30 requerida. ¿Cuál es el costo REAL de comprar esta ropa?",
      context: "Mario debe considerar todos los costos y evaluar si realmente es una compra inteligente.",
      correctAnswer: 90,
      explanation: "Costo real = $60 + $30 (membresía) = $90. Como no la necesita, no es ahorro sino gasto innecesario de $90."
    },
    transparentProblem: {
      question: "Si pagas $60 por algo que no necesitas, más $30 de membresía, ¿cuánto gastaste en total?",
      context: "Cálculo directo del costo total de una compra innecesaria.",
      correctAnswer: 90,
      explanation: "Gasto total = $60 + $30 = $90 en algo innecesario."
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
      conceptMastered: Math.abs(biasScore) <= 8, // Competencia si sesgo ≤ $8 en valoraciones
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
            <Tag className="h-6 w-6" />
            LECCIÓN: Calculadora de Valor Real de Ofertas
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <Badge variant="outline" className="bg-blue-100">
              Edad: 12-17 años
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
                1. CONCEPTO SUSTANTIVO: Calculadora de Valor Real de Ofertas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-gray-700">
                Aprende a usar una herramienta matemática para evaluar objetivamente el valor real 
                de ofertas y descuentos. Esta herramienta te protege del marketing manipulativo y 
                te ayuda a identificar ahorros genuinos.
              </p>

              <PracticalTool
                title="Calculadora de Valor Real de Ofertas"
                description="Sistema para evaluar ofertas considerando precios reales de mercado, costos ocultos y necesidad genuina"
                tool={practicalTool}
                examples={[
                  {
                    input: { oferta: "70% desc, precio tachado $100, oferta $30", mercado: "$35" },
                    output: { descuentoReal: "14%", ahorro: "$5", valoración: "Legítima" },
                    explanation: "Precio real $35, no $100. Ahorro real: ($35-$30)÷$35 = 14%"
                  },
                  {
                    input: { oferta: "50% desc, $200→$100", mercado: "$120", necesidad: "No" },
                    output: { descuentoReal: "17%", ahorro: "$0", valoración: "Gasto innecesario" },
                    explanation: "Aunque ahorro $20, no lo necesito = $100 de gasto innecesario"
                  },
                  {
                    input: { oferta: "2x1, pago $50 por 2", mercado: "$30 c/u", costoOculto: "$10" },
                    output: { descuentoReal: "0%", ahorro: "$0", valoración: "Falsa oferta" },
                    explanation: "2×$30=$60, pago $50+$10=$60. No hay ahorro real."
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
                Practica evaluando ofertas reales usando la calculadora. Usa la herramienta sistemática 
                para resolver ambos problemas de manera consistente. {tasksCompleted === 0 ? 
                "Primero evaluarás una oferta con precio inflado artificial." : 
                "Ahora practicarás resistir compras impulsivas disfrazadas de 'ofertas'."}
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
                3. EVALUACIÓN: Competencia Deliberativa en Evaluación de Ofertas
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <p className="text-gray-700 mb-4">
                Tu competencia se mide por la consistencia entre análisis complejos y simples de ofertas. 
                Una herramienta bien dominada produce valoraciones similares independientemente de las 
                tácticas de marketing utilizadas.
              </p>
            </CardContent>
          </Card>

          <CompetenceTracker
            biasHistory={biasHistory}
            targetReduction={16}
            currentBias={currentBias}
          />

          {/* Métricas específicas de evaluación de ofertas */}
          <Card className="border-purple-200">
            <CardHeader className="bg-purple-50">
              <CardTitle>Métricas de Competencia en Evaluación de Ofertas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-4 bg-blue-100 rounded-lg">
                  <p className="text-2xl font-bold text-blue-600">
                    {lessonProgress.conceptMastered ? 'DOMINADO' : 'EN PROGRESO'}
                  </p>
                  <p className="text-sm text-blue-800">Resistencia Marketing</p>
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
                  <p className="text-sm text-orange-800">Ofertas Evaluadas</p>
                </div>
              </div>

              {/* Interpretación del sesgo específica para evaluación de ofertas */}
              {Math.abs(currentBias) <= 8 && (
                <Alert className="border-green-200 bg-green-50">
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>¡Excelente resistencia al marketing manipulativo!</strong> Tus evaluaciones son muy objetivas. 
                    Puedes identificar ofertas reales y evitar trampas de descuentos falsos.
                  </AlertDescription>
                </Alert>
              )}

              {Math.abs(currentBias) > 8 && Math.abs(currentBias) <= 25 && (
                <Alert className="border-yellow-200 bg-yellow-50">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Buen progreso en evaluación crítica de ofertas.</strong> Hay diferencias menores en tus análisis. 
                    Practica más para mejorar tu resistencia a técnicas de marketing.
                  </AlertDescription>
                </Alert>
              )}

              {Math.abs(currentBias) > 25 && (
                <Alert className="border-red-200 bg-red-50">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Necesita más práctica con la herramienta de evaluación.</strong> Las diferencias en tus 
                    valoraciones sugieren susceptibilidad a técnicas de marketing. Revisa los pasos sistemáticos.
                  </AlertDescription>
                </Alert>
              )}

              {/* Efectos heterogéneos - consejos personalizados */}
              <Card className="bg-blue-50 border-blue-200">
                <CardContent className="p-4">
                  <h4 className="font-bold text-blue-800 mb-2">Perfil de Resistencia al Marketing:</h4>
                  {currentBias > 20 && (
                    <p className="text-sm text-blue-700">
                      Eres vulnerable a ofertas con marketing agresivo. Tiendes a sobreestimar descuentos y 
                      subestimar costos ocultos. Usa siempre la regla de 24h antes de comprar "ofertas especiales".
                    </p>
                  )}
                  {currentBias < -20 && (
                    <p className="text-sm text-blue-700">
                      Eres muy escéptico con las ofertas, incluso las legítimas. Aunque esto te protege de estafas, 
                      podrías perder ahorros genuinos. La herramienta te ayuda a evaluar objetivamente.
                    </p>
                  )}
                  {Math.abs(currentBias) <= 20 && (
                    <p className="text-sm text-blue-700">
                      ¡Tienes un excelente equilibrio evaluando ofertas! Puedes aprovechar descuentos reales 
                      sin caer en trampas de marketing. Continúa usando la herramienta sistemática.
                    </p>
                  )}
                </CardContent>
              </Card>

              <Button 
                onClick={handleComplete}
                className="w-full bg-green-600 hover:bg-green-700"
              >
                Completar Lección de Evaluación de Ofertas
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

// Componente auxiliar para el analizador de ofertas
const OfferAnalyzer: React.FC = () => {
  const [offers, setOffers] = useState<{
    name: string;
    originalPrice: number;
    offerPrice: number;
    marketPrice: number;
    hiddenCosts: number;
    needLevel: number; // 1-10, 1=no necesario, 10=muy necesario
  }[]>([]);
  
  const [newOffer, setNewOffer] = useState({
    name: '',
    originalPrice: 0,
    offerPrice: 0,
    marketPrice: 0,
    hiddenCosts: 0,
    needLevel: 5
  });

  const addOffer = () => {
    if (newOffer.name.trim() && newOffer.offerPrice > 0) {
      setOffers([...offers, newOffer]);
      setNewOffer({
        name: '',
        originalPrice: 0,
        offerPrice: 0,
        marketPrice: 0,
        hiddenCosts: 0,
        needLevel: 5
      });
    }
  };

  const analyzeOffer = (offer: typeof newOffer) => {
    const marketPrice = offer.marketPrice || offer.offerPrice;
    const realDiscount = Math.max(0, marketPrice - offer.offerPrice);
    const realDiscountPercent = marketPrice > 0 ? (realDiscount / marketPrice) * 100 : 0;
    const totalCost = offer.offerPrice + offer.hiddenCosts;
    const realSavings = offer.needLevel >= 7 ? Math.max(0, marketPrice - totalCost) : 0;
    const isGoodDeal = realSavings > 0 && realDiscountPercent > 5;
    
    return {
      realDiscount,
      realDiscountPercent,
      totalCost,
      realSavings,
      isGoodDeal,
      verdict: isGoodDeal ? 'Buena oferta' : 
               offer.needLevel < 5 ? 'Gasto innecesario' :
               realSavings <= 0 ? 'No es ahorro' : 'Oferta menor'
    };
  };

  const resetAnalyzer = () => {
    setOffers([]);
  };

  // Ordenar ofertas por valor real (mayor ahorro primero)
  const rankedOffers = offers.map(offer => ({
    ...offer,
    analysis: analyzeOffer(offer)
  })).sort((a, b) => b.analysis.realSavings - a.analysis.realSavings);

  return (
    <div className="bg-white p-4 border rounded-lg space-y-4">
      <h4 className="font-bold mb-3">Analizador de Valor Real de Ofertas</h4>
      
      {/* Agregar nueva oferta */}
      <div className="grid grid-cols-6 gap-2 text-xs">
        <Input
          placeholder="Producto"
          value={newOffer.name}
          onChange={(e) => setNewOffer({...newOffer, name: e.target.value})}
        />
        <Input
          type="number"
          placeholder="Precio 'normal'"
          value={newOffer.originalPrice || ''}
          onChange={(e) => setNewOffer({...newOffer, originalPrice: Number(e.target.value)})}
        />
        <Input
          type="number"
          placeholder="Precio oferta"
          value={newOffer.offerPrice || ''}
          onChange={(e) => setNewOffer({...newOffer, offerPrice: Number(e.target.value)})}
        />
        <Input
          type="number"
          placeholder="Precio mercado"
          value={newOffer.marketPrice || ''}
          onChange={(e) => setNewOffer({...newOffer, marketPrice: Number(e.target.value)})}
        />
        <Input
          type="number"
          placeholder="Costos extra"
          value={newOffer.hiddenCosts || ''}
          onChange={(e) => setNewOffer({...newOffer, hiddenCosts: Number(e.target.value)})}
        />
        <Button onClick={addOffer} size="sm">+</Button>
      </div>

      <div className="grid grid-cols-1 gap-1">
        <select 
          value={newOffer.needLevel}
          onChange={(e) => setNewOffer({...newOffer, needLevel: Number(e.target.value)})}
          className="border rounded px-2 py-1 text-xs"
        >
          {[...Array(10)].map((_, i) => (
            <option key={i} value={i + 1}>
              Necesidad {i + 1}/10 {i < 3 ? '(No necesario)' : i < 7 ? '(Deseable)' : '(Necesario)'}
            </option>
          ))}
        </select>
      </div>

      {/* Lista de ofertas analizadas */}
      {rankedOffers.length > 0 && (
        <div className="space-y-2">
          <h5 className="font-medium text-sm text-gray-700">Análisis de ofertas (mejor valor primero):</h5>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {rankedOffers.map((offer, index) => (
              <div key={`${offer.name}-${index}`} className="p-2 bg-gray-50 rounded text-sm">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-medium">{offer.name}</span>
                  <span className={`font-bold ${offer.analysis.isGoodDeal ? 'text-green-600' : 'text-red-600'}`}>
                    {offer.analysis.verdict}
                  </span>
                </div>
                <div className="text-xs text-gray-600 grid grid-cols-2 gap-2">
                  <span>Descuento real: {offer.analysis.realDiscountPercent.toFixed(1)}%</span>
                  <span>Ahorro real: ${offer.analysis.realSavings.toFixed(0)}</span>
                  <span>Costo total: ${offer.analysis.totalCost}</span>
                  <span>Necesidad: {offer.needLevel}/10</span>
                </div>
              </div>
            ))}
          </div>
          
          <div className="bg-yellow-50 p-2 rounded text-xs">
            <strong>Recomendación:</strong> Solo considera ofertas marcadas como "Buena oferta" 
            y que realmente necesitas (nivel 7+).
          </div>
        </div>
      )}

      {offers.length > 0 && (
        <Button variant="outline" onClick={resetAnalyzer} className="w-full">
          Resetear Analizador
        </Button>
      )}
    </div>
  );
};

export default Lesson3_2_OffersAndDiscounts_Bernheim;
