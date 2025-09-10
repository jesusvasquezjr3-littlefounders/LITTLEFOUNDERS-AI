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
import { Calculator, Target, CheckCircle, AlertCircle, BookOpen, Building2, Shield } from 'lucide-react';

interface Lesson2_1Props {
  onComplete: (score: number, progress: LessonProgress) => void;
  onExit: () => void;
}

const Lesson2_1_WhatIsBank_Bernheim: React.FC<Lesson2_1Props> = ({ onComplete, onExit }) => {
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
            <Shield className="h-5 w-5" />
            Herramienta: Calculadora de Evaluación de Servicios Bancarios
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-green-100 p-4 rounded-lg">
            <h4 className="font-bold text-green-800 mb-2">Pasos para usar la herramienta:</h4>
            <ol className="list-decimal list-inside space-y-2 text-sm text-green-700">
              <li><strong>Identificar necesidades:</strong> ¿Qué servicios bancarios necesitas?</li>
              <li><strong>Comparar comisiones:</strong> Calcular costo total anual de servicios</li>
              <li><strong>Evaluar beneficios:</strong> Intereses, protecciones, conveniencia</li>
              <li><strong>Calcular valor neto:</strong> Beneficios - costos = valor real</li>
              <li><strong>Tomar decisión:</strong> Elegir la opción con mayor valor neto</li>
            </ol>
          </div>
          
          <BankServiceEvaluator />
          
          <div className="bg-gray-100 p-3 rounded-lg">
            <p className="text-sm text-gray-700">
              <strong>Fórmula:</strong> Valor Bancario = (Beneficios anuales + Conveniencia) - Costos anuales
            </p>
            <p className="text-xs text-gray-600 mt-1">
              *Incluye intereses ganados, servicios gratuitos, y costos de comisiones
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // ETAPA 2: DECISIONES DE VALUACIÓN - TAREAS PAREADAS
  const pairedTask: PairedTask = {
    id: 'bank-service-evaluation',
    complexProblem: {
      question: "Sara puede elegir entre Banco Alpha y Banco Beta. Alpha cobra $5/mes pero da 2% de interés en ahorros y servicios gratuitos (transferencias, pagos). Beta no cobra comisiones pero da 0.5% interés y cobra $2 por transferencia. Sara maneja $500 en ahorros y hace 4 transferencias al mes. ¿Cuál banco le da mayor valor neto anual?",
      context: "Sara debe calcular el valor total considerando ingresos por intereses menos todos los costos.",
      correctAnswer: 4,
      explanation: "Alpha: (500×2%=10) + servicios gratis - (5×12=60) = -$50/año. Beta: (500×0.5%=2.5) - (2×4×12=96) = -$93.5/año. Alpha da $43.5 más de valor."
    },
    transparentProblem: {
      question: "Si una opción te cuesta $50 al año y otra te cuesta $94 al año, ¿cuál es la diferencia de valor a favor de la primera opción?",
      context: "Comparación directa de valores anuales.",
      correctAnswer: 44,
      explanation: "Diferencia = $94 - $50 = $44 a favor de la primera opción."
    }
  };

  // Tarea pareada adicional para efectos heterogéneos
  const pairedTaskAdvanced: PairedTask = {
    id: 'bank-convenience-valuation',
    complexProblem: {
      question: "Luis valora mucho la conveniencia. Banco Simple tiene cajeros cerca de su casa (+$20 valor por conveniencia), cobra $3/mes, da 1% interés en $300 ahorrados. Banco Lejano no cobra comisiones, da 3% interés, pero está lejos (-$15 valor por inconveniencia). ¿Cuál da mayor valor total anual para Luis?",
      context: "Luis debe incluir el valor subjetivo de conveniencia en su cálculo.",
      correctAnswer: 24,
      explanation: "Simple: (300×1%=3) + 20 - (3×12=36) = -$13/año. Lejano: (300×3%=9) - 15 = -$6/año. Diferencia: $7 a favor de Lejano, pero Luis puede preferir Simple por conveniencia personal."
    },
    transparentProblem: {
      question: "Si una opción te da valor neto de -$13 al año y otra de -$6 al año, ¿cuál es mejor financieramente?",
      context: "Comparación directa de valores netos anuales.",
      correctAnswer: -6,
      explanation: "La opción con -$6 es mejor porque cuesta menos dinero al año."
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
      conceptMastered: Math.abs(biasScore) <= 6, // Competencia si sesgo ≤ $6 anuales
      biasReduction: biasReduction,
      completedTasks: [...lessonProgress.completedTasks, currentPairedTask.id],
      timeSpent: lessonProgress.timeSpent + 400 // 6-7 minutos estimados por tarea
    };

    setLessonProgress(newProgress);
    setCurrentStage('evaluation');
  };

  const handleComplete = () => {
    const finalScore = lessonProgress.conceptMastered ? 100 : 
      Math.max(0, 100 - Math.abs(currentBias));
    onComplete(finalScore, lessonProgress);
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <Card className="border-2 border-purple-200">
        <CardHeader className="bg-purple-50">
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-6 w-6" />
            LECCIÓN: Calculadora de Evaluación de Servicios Bancarios
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <Badge variant="outline" className="bg-blue-100">
              Edad: 11-15 años
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
                1. CONCEPTO SUSTANTIVO: Calculadora de Evaluación de Servicios Bancarios
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-gray-700">
                Aprende a usar una herramienta matemática para evaluar objetivamente diferentes opciones 
                bancarias. Esta herramienta te permite calcular el valor real que obtienes considerando 
                costos, beneficios y conveniencia.
              </p>

              <PracticalTool
                title="Calculadora de Evaluación de Servicios Bancarios"
                description="Sistema para comparar bancos calculando valor neto anual (beneficios - costos)"
                tool={practicalTool}
                examples={[
                  {
                    input: { banco: "A: 2% interés, $3/mes", ahorros: "$200" },
                    output: { beneficios: "$4", costos: "$36", valorNeto: "-$32/año" },
                    explanation: "Interés: $200×2%=$4. Costos: $3×12=$36. Valor neto: $4-$36=-$32/año"
                  },
                  {
                    input: { banco: "B: 0% interés, $0/mes", ahorros: "$200" },
                    output: { beneficios: "$0", costos: "$0", valorNeto: "$0/año" },
                    explanation: "Sin interés ni comisiones. Valor neto: $0-$0=$0/año (neutro)"
                  },
                  {
                    input: { banco: "C: 4% interés, $5/mes", ahorros: "$200" },
                    output: { beneficios: "$8", costos: "$60", valorNeto: "-$52/año" },
                    explanation: "Interés: $200×4%=$8. Costos: $5×12=$60. Valor neto: $8-$60=-$52/año"
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
                Practica evaluando opciones bancarias reales usando la calculadora. Usa la herramienta 
                sistemática para resolver ambos problemas de manera consistente. {tasksCompleted === 0 ? 
                "Primero evaluarás opciones con diferentes estructuras de costos." : 
                "Ahora considerarás factores subjetivos como la conveniencia."}
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
                3. EVALUACIÓN: Competencia Deliberativa en Evaluación Bancaria
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <p className="text-gray-700 mb-4">
                Tu competencia se mide por la consistencia entre evaluaciones complejas y simples. 
                Una herramienta bien dominada produce valoraciones similares independientemente 
                de la complejidad del escenario bancario.
              </p>
            </CardContent>
          </Card>

          <CompetenceTracker
            biasHistory={biasHistory}
            targetReduction={12}
            currentBias={currentBias}
          />

          {/* Métricas específicas de evaluación bancaria */}
          <Card className="border-purple-200">
            <CardHeader className="bg-purple-50">
              <CardTitle>Métricas de Competencia en Evaluación Bancaria</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-4 bg-blue-100 rounded-lg">
                  <p className="text-2xl font-bold text-blue-600">
                    {lessonProgress.conceptMastered ? 'DOMINADO' : 'EN PROGRESO'}
                  </p>
                  <p className="text-sm text-blue-800">Evaluación Objetiva</p>
                </div>
                <div className="text-center p-4 bg-green-100 rounded-lg">
                  <p className="text-2xl font-bold text-green-600">
                    ${Math.abs(currentBias)}/año
                  </p>
                  <p className="text-sm text-green-800">Sesgo de Valoración</p>
                </div>
                <div className="text-center p-4 bg-orange-100 rounded-lg">
                  <p className="text-2xl font-bold text-orange-600">
                    {tasksCompleted}/2
                  </p>
                  <p className="text-sm text-orange-800">Evaluaciones</p>
                </div>
              </div>

              {/* Interpretación del sesgo específica para evaluación bancaria */}
              {Math.abs(currentBias) <= 6 && (
                <Alert className="border-green-200 bg-green-50">
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>¡Excelente dominio de la evaluación bancaria!</strong> Tus análisis son muy consistentes. 
                    Puedes elegir servicios bancarios con objetividad y precisión matemática.
                  </AlertDescription>
                </Alert>
              )}

              {Math.abs(currentBias) > 6 && Math.abs(currentBias) <= 20 && (
                <Alert className="border-yellow-200 bg-yellow-50">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Buen progreso en evaluación sistemática.</strong> Hay diferencias menores en tus análisis. 
                    Practica más para mejorar la consistencia en escenarios complejos.
                  </AlertDescription>
                </Alert>
              )}

              {Math.abs(currentBias) > 20 && (
                <Alert className="border-red-200 bg-red-50">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Necesita más práctica con la calculadora bancaria.</strong> Las diferencias en tus evaluaciones 
                    sugieren que debes revisar los pasos para calcular valor neto anual.
                  </AlertDescription>
                </Alert>
              )}

              {/* Efectos heterogéneos - consejos personalizados */}
              <Card className="bg-blue-50 border-blue-200">
                <CardContent className="p-4">
                  <h4 className="font-bold text-blue-800 mb-2">Perfil de Evaluación Bancaria:</h4>
                  {currentBias > 15 && (
                    <p className="text-sm text-blue-700">
                      Tiendes a sobrevalorar servicios bancarios en situaciones complejas. Esto puede llevarte 
                      a pagar más por servicios innecesarios. Usa la herramienta para ser más objetivo.
                    </p>
                  )}
                  {currentBias < -15 && (
                    <p className="text-sm text-blue-700">
                      Tiendes a subvalorar servicios bancarios complejos. Podrías perder beneficios valiosos 
                      por enfocarte solo en costos. Considera todos los factores sistemáticamente.
                    </p>
                  )}
                  {Math.abs(currentBias) <= 15 && (
                    <p className="text-sm text-blue-700">
                      ¡Tienes un excelente balance en la evaluación bancaria! Puedes usar esta herramienta 
                      para elegir servicios financieros que realmente te convengan.
                    </p>
                  )}
                </CardContent>
              </Card>

              <Button 
                onClick={handleComplete}
                className="w-full bg-green-600 hover:bg-green-700"
              >
                Completar Lección de Evaluación Bancaria
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

// Componente auxiliar para la evaluación de servicios bancarios
const BankServiceEvaluator: React.FC = () => {
  const [bankOptions, setBankOptions] = useState<{
    name: string;
    monthlyFee: number;
    interestRate: number;
    transactionFee: number;
    convenientScore: number; // 1-10 scale
  }[]>([]);
  
  const [userProfile, setUserProfile] = useState({
    savings: 0,
    monthlyTransactions: 0
  });

  const [newBank, setNewBank] = useState({
    name: '',
    monthlyFee: 0,
    interestRate: 0,
    transactionFee: 0,
    convenientScore: 5
  });

  const addBank = () => {
    if (newBank.name.trim()) {
      setBankOptions([...bankOptions, newBank]);
      setNewBank({
        name: '',
        monthlyFee: 0,
        interestRate: 0,
        transactionFee: 0,
        convenientScore: 5
      });
    }
  };

  const calculateBankValue = (bank: typeof newBank) => {
    const annualInterest = userProfile.savings * (bank.interestRate / 100);
    const annualFees = bank.monthlyFee * 12;
    const annualTransactionFees = bank.transactionFee * userProfile.monthlyTransactions * 12;
    const convenienceValue = bank.convenientScore * 2; // $2 per convenience point
    
    const totalValue = annualInterest + convenienceValue - annualFees - annualTransactionFees;
    
    return {
      benefits: annualInterest + convenienceValue,
      costs: annualFees + annualTransactionFees,
      netValue: totalValue
    };
  };

  const resetCalculator = () => {
    setBankOptions([]);
    setUserProfile({ savings: 0, monthlyTransactions: 0 });
  };

  // Ordenar bancos por valor neto (mayor a menor)
  const rankedBanks = bankOptions.map(bank => ({
    ...bank,
    evaluation: calculateBankValue(bank)
  })).sort((a, b) => b.evaluation.netValue - a.evaluation.netValue);

  return (
    <div className="bg-white p-4 border rounded-lg space-y-4">
      <h4 className="font-bold mb-3">Evaluador de Servicios Bancarios</h4>
      
      {/* Perfil del usuario */}
      <div className="grid grid-cols-2 gap-3 p-3 bg-gray-50 rounded">
        <div>
          <label className="block text-xs font-medium mb-1">Ahorros ($)</label>
          <Input
            type="number"
            value={userProfile.savings || ''}
            onChange={(e) => setUserProfile(prev => ({...prev, savings: Number(e.target.value)}))}
            placeholder="500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Transacciones/mes</label>
          <Input
            type="number"
            value={userProfile.monthlyTransactions || ''}
            onChange={(e) => setUserProfile(prev => ({...prev, monthlyTransactions: Number(e.target.value)}))}
            placeholder="8"
          />
        </div>
      </div>

      {/* Agregar nuevo banco */}
      <div className="grid grid-cols-5 gap-2">
        <Input
          placeholder="Nombre banco"
          value={newBank.name}
          onChange={(e) => setNewBank({...newBank, name: e.target.value})}
        />
        <Input
          type="number"
          placeholder="$/mes"
          value={newBank.monthlyFee || ''}
          onChange={(e) => setNewBank({...newBank, monthlyFee: Number(e.target.value)})}
        />
        <Input
          type="number"
          step="0.1"
          placeholder="% interés"
          value={newBank.interestRate || ''}
          onChange={(e) => setNewBank({...newBank, interestRate: Number(e.target.value)})}
        />
        <Input
          type="number"
          step="0.5"
          placeholder="$/trans"
          value={newBank.transactionFee || ''}
          onChange={(e) => setNewBank({...newBank, transactionFee: Number(e.target.value)})}
        />
        <Button onClick={addBank} size="sm">Agregar</Button>
      </div>

      {/* Lista de bancos evaluados */}
      {rankedBanks.length > 0 && (
        <div className="space-y-2">
          <h5 className="font-medium text-sm text-gray-700">Evaluación (ordenado por valor):</h5>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {rankedBanks.map((bank, index) => (
              <div key={`${bank.name}-${index}`} className="p-2 bg-gray-50 rounded text-sm">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-medium">{bank.name}</span>
                  <span className={`font-bold ${bank.evaluation.netValue >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    ${bank.evaluation.netValue.toFixed(2)}/año
                  </span>
                </div>
                <div className="text-xs text-gray-600">
                  Beneficios: ${bank.evaluation.benefits.toFixed(2)} - Costos: ${bank.evaluation.costs.toFixed(2)}
                </div>
              </div>
            ))}
          </div>
          
          {rankedBanks.length > 1 && (
            <div className="bg-blue-50 p-2 rounded text-xs">
              <strong>Recomendación:</strong> {rankedBanks[0].name} ofrece el mejor valor neto 
              (${(rankedBanks[0].evaluation.netValue - rankedBanks[1].evaluation.netValue).toFixed(2)} 
              más que la segunda opción)
            </div>
          )}
        </div>
      )}

      {bankOptions.length > 0 && (
        <Button variant="outline" onClick={resetCalculator} className="w-full">
          Resetear Evaluación
        </Button>
      )}
    </div>
  );
};

export default Lesson2_1_WhatIsBank_Bernheim;