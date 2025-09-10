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
import { Calculator, Target, CheckCircle, AlertCircle, BookOpen, TrendingUp, FileText } from 'lucide-react';

interface Lesson5_2Props {
  onComplete: (score: number, progress: LessonProgress) => void;
  onExit: () => void;
}

const Lesson5_2_HistorialCrediticio_Bernheim: React.FC<Lesson5_2Props> = ({ onComplete, onExit }) => {
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
            <TrendingUp className="h-5 w-5" />
            Herramienta: Calculadora de Score Crediticio
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-green-100 p-4 rounded-lg">
            <h4 className="font-bold text-green-800 mb-2">Pasos para usar la herramienta:</h4>
            <ol className="list-decimal list-inside space-y-2 text-sm text-green-700">
              <li><strong>Evaluar historial de pagos (35%):</strong> % de pagos a tiempo últimos 24 meses</li>
              <li><strong>Calcular utilización de crédito (30%):</strong> Saldo usado ÷ límite total</li>
              <li><strong>Medir antigüedad promedio (15%):</strong> Edad de todas las cuentas</li>
              <li><strong>Contar consultas recientes (10%):</strong> Solicitudes últimos 12 meses</li>
              <li><strong>Evaluar mix crediticio (10%):</strong> Variedad de tipos de crédito</li>
            </ol>
          </div>
          
          <CreditScoreCalculator />
          
          <div className="bg-gray-100 p-3 rounded-lg">
            <p className="text-sm text-gray-700">
              <strong>Fórmula:</strong> Score = (35%×Pagos) + (30%×Utilización) + (15%×Antigüedad) + (10%×Consultas) + (10%×Mix)
            </p>
            <p className="text-xs text-gray-600 mt-1">
              *Rango: 300-850 puntos. 700+ es considerado bueno
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // ETAPA 2: DECISIONES DE VALUACIÓN - TAREAS PAREADAS
  const pairedTask: PairedTask = {
    id: 'credit-score-impact-calculation',
    complexProblem: {
      question: "Ana tiene 98% pagos a tiempo, utilización 15%, antigüedad 2 años, 1 consulta reciente, mix básico (tarjeta+préstamo). Carlos tiene 85% pagos a tiempo, utilización 45%, antigüedad 6 años, 0 consultas, mix diverso. ¿Cuál es la diferencia aproximada en sus scores?",
      context: "Debes calcular los componentes principales del score para ambas personas.",
      correctAnswer: 720,
      explanation: "Ana≈720: (35×0.98)+(30×0.85)+(15×0.4)+(10×0.9)+(10×0.6). Carlos≈680: (35×0.85)+(30×0.55)+(15×1)+(10×1)+(10×1). Diferencia≈40 puntos."
    },
    transparentProblem: {
      question: "Si una persona tiene score de 720 y otra de 680, ¿cuál es la diferencia?",
      context: "Comparación directa de scores crediticios.",
      correctAnswer: 40,
      explanation: "Diferencia = 720 - 680 = 40 puntos de score crediticio"
    }
  };

  // Tarea pareada adicional para efectos heterogéneos
  const pairedTaskAdvanced: PairedTask = {
    id: 'credit-behavior-impact-analysis',
    complexProblem: {
      question: "Luis tiene score 650. Está considerando: A) Pagar su tarjeta completamente (reducir utilización de 60% a 0%), B) Cerrar 2 tarjetas viejas que no usa, C) Pedir nueva tarjeta para emergencias. ¿Cuál acción mejora más su score?",
      context: "Luis debe entender qué acciones tienen mayor impacto positivo o negativo en su score.",
      correctAnswer: 0,
      explanation: "Opción A (pagar tarjeta) tiene mayor impacto positivo: utilización baja aumenta 30% del score. Cerrar tarjetas reduce antigüedad promedio (negativo). Nueva tarjeta añade consulta (negativo menor)."
    },
    transparentProblem: {
      question: "¿Qué tiene más impacto en el score: utilización (30%) o consultas recientes (10%)?",
      context: "Comparación directa de factores de peso en el score.",
      correctAnswer: 30,
      explanation: "La utilización tiene 30% de peso vs. 10% de las consultas. Mayor peso = mayor impacto."
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
      setCurrentPairedTask(pairedTaskAdvanced);
      return;
    }
    
    const avgBias = newBiasHistory.reduce((a, b) => a + Math.abs(b), 0) / newBiasHistory.length;
    const biasReduction = newBiasHistory.length > 1 ? 
      Math.abs(newBiasHistory[0]) - Math.abs(biasScore) : 0;

    const newProgress: LessonProgress = {
      conceptMastered: Math.abs(biasScore) <= 25,
      biasReduction: biasReduction,
      completedTasks: [...lessonProgress.completedTasks, currentPairedTask.id],
      timeSpent: lessonProgress.timeSpent + 450
    };

    setLessonProgress(newProgress);
    setCurrentStage('evaluation');
  };

  const handleComplete = () => {
    const finalScore = lessonProgress.conceptMastered ? 100 : 
      Math.max(0, 100 - (Math.abs(currentBias) / 5));
    onComplete(finalScore, lessonProgress);
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <Card className="border-2 border-purple-200">
        <CardHeader className="bg-purple-50">
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-6 w-6" />
            LECCIÓN: Calculadora de Score Crediticio
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <Badge variant="outline" className="bg-blue-100">
              Edad: 16-18 años
            </Badge>
            <Badge variant="outline" className="bg-green-100">
              Duración: 30-35 minutos
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between items-center">
        <Button variant="outline" onClick={onExit}>
          Salir
        </Button>
      </div>
    </div>
  );
};

// Componente auxiliar para la calculadora de score crediticio
const CreditScoreCalculator: React.FC = () => {
  const [paymentHistory, setPaymentHistory] = useState<number>(100); // Porcentaje de pagos a tiempo
  const [creditUtilization, setCreditUtilization] = useState<number>(0); // Porcentaje de utilización
  const [creditAge, setCreditAge] = useState<number>(0); // Años de antigüedad promedio
  const [recentInquiries, setRecentInquiries] = useState<number>(0); // Número de consultas
  const [creditMix, setCreditMix] = useState<number>(1); // 1-3 tipos de crédito

  const calculateScore = () => {
    // Factores normalizados a escala 0-1
    const paymentScore = paymentHistory / 100;
    const utilizationScore = Math.max(0, (100 - creditUtilization) / 100);
    const ageScore = Math.min(1, creditAge / 10); // 10 años = score perfecto
    const inquiryScore = Math.max(0, (6 - recentInquiries) / 6); // 0 consultas = score perfecto
    const mixScore = Math.min(1, creditMix / 3); // 3 tipos = score perfecto

    // Aplicar pesos: 35%, 30%, 15%, 10%, 10%
    const weightedScore = (paymentScore * 0.35) + 
                         (utilizationScore * 0.30) + 
                         (ageScore * 0.15) + 
                         (inquiryScore * 0.10) + 
                         (mixScore * 0.10);

    // Convertir a escala 300-850
    const score = 300 + (weightedScore * 550);
    
    return Math.round(score);
  };

  const getScoreCategory = (score: number) => {
    if (score >= 800) return { category: 'Excelente', color: 'green', description: 'Acceso a las mejores tasas' };
    if (score >= 740) return { category: 'Muy Bueno', color: 'blue', description: 'Buenas tasas de interés' };
    if (score >= 670) return { category: 'Bueno', color: 'yellow', description: 'Tasas promedio del mercado' };
    if (score >= 580) return { category: 'Regular', color: 'orange', description: 'Tasas más altas, menos opciones' };
    return { category: 'Malo', color: 'red', description: 'Difícil obtener crédito' };
  };

  const score = calculateScore();
  const category = getScoreCategory(score);

  return (
    <div className="bg-white p-4 border rounded-lg space-y-4">
      <h4 className="font-bold mb-3">Simulador de Score Crediticio</h4>
      
      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium mb-1">Pagos a tiempo (%)</label>
          <Input
            type="number"
            min="0"
            max="100"
            value={paymentHistory}
            onChange={(e) => setPaymentHistory(Number(e.target.value))}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Utilización de crédito (%)</label>
          <Input
            type="number"
            min="0"
            max="100"
            value={creditUtilization}
            onChange={(e) => setCreditUtilization(Number(e.target.value))}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Antigüedad promedio (años)</label>
          <Input
            type="number"
            min="0"
            step="0.5"
            value={creditAge}
            onChange={(e) => setCreditAge(Number(e.target.value))}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Consultas recientes (últimos 12 meses)</label>
          <Input
            type="number"
            min="0"
            value={recentInquiries}
            onChange={(e) => setRecentInquiries(Number(e.target.value))}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Tipos de crédito (1-3)</label>
          <select 
            value={creditMix}
            onChange={(e) => setCreditMix(Number(e.target.value))}
            className="w-full border rounded px-3 py-2 text-sm"
          >
            <option value={1}>1 tipo (solo tarjetas)</option>
            <option value={2}>2 tipos (tarjetas + préstamo)</option>
            <option value={3}>3+ tipos (tarjetas + préstamo + hipoteca/auto)</option>
          </select>
        </div>
      </div>

      <div className="border-t pt-4">
        <div className="text-center p-4 bg-gray-50 rounded-lg">
          <div className={`text-3xl font-bold text-${category.color}-600 mb-2`}>
            {score}
          </div>
          <div className={`text-sm font-medium text-${category.color}-800 mb-1`}>
            {category.category}
          </div>
          <div className={`text-xs text-${category.color}-700`}>
            {category.description}
          </div>
        </div>

        <div className="mt-3 text-xs text-gray-600 space-y-1">
          <div className="grid grid-cols-2 gap-2">
            <span>Pagos a tiempo: {(paymentHistory * 0.35).toFixed(0)} pts</span>
            <span>Utilización: {((100-creditUtilization) * 0.30).toFixed(0)} pts</span>
            <span>Antigüedad: {((Math.min(creditAge, 10)/10) * 15 * 10).toFixed(0)} pts</span>
            <span>Consultas: {((Math.max(0, 6-recentInquiries)/6) * 10 * 10).toFixed(0)} pts</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Lesson5_2_HistorialCrediticio_Bernheim;