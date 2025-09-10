import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  PairedTaskComponent, 
  PracticalTool, 
  CompetenceTracker,
  characters,
  PairedTask,
  BiasMetric,
  LessonProgress 
} from './BernheimFrameworkComponents';
import { Calculator, Target, CheckCircle, AlertCircle, BookOpen, TrendingUp, Briefcase } from 'lucide-react';

interface Lesson1_2Props {
  onComplete: (score: number, progress: LessonProgress) => void;
  onExit: () => void;
}

const Lesson1_2_WhereMoneyComesFrom_Bernheim: React.FC<Lesson1_2Props> = ({ onComplete, onExit }) => {
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
            <Briefcase className="h-5 w-5" />
            Herramienta: Evaluador de Fuentes de Ingresos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-green-100 p-4 rounded-lg">
            <h4 className="font-bold text-green-800 mb-2">Pasos para usar la herramienta:</h4>
            <ol className="list-decimal list-inside space-y-2 text-sm text-green-700">
              <li><strong>Identificar la actividad:</strong> ¿Qué se está haciendo?</li>
              <li><strong>Evaluar intercambio de valor:</strong> ¿Provee algo útil a otros?</li>
              <li><strong>Verificar reciprocidad:</strong> ¿Hay intercambio justo de trabajo por dinero?</li>
              <li><strong>Confirmar legalidad y ética:</strong> ¿Es legal y éticamente correcto?</li>
              <li><strong>Calcular sostenibilidad:</strong> ¿Es una fuente de ingresos real y sostenible?</li>
            </ol>
          </div>
          
          <IncomeSourceEvaluator />
          
          <div className="bg-gray-100 p-3 rounded-lg">
            <p className="text-sm text-gray-700">
              <strong>Criterios de evaluación:</strong> 
            </p>
            <ul className="text-xs text-gray-600 mt-1 space-y-1">
              <li>• <strong>VÁLIDA:</strong> Trabajo útil + Reciprocidad + Legal + Sostenible</li>
              <li>• <strong>NO VÁLIDA:</strong> Sin valor para otros, ilegal, insostenible</li>
              <li>• <strong>INCIERTA:</strong> Depende de circunstancias específicas</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // ETAPA 2: DECISIONES DE VALUACIÓN - TAREAS PAREADAS
  const pairedTask: PairedTask = {
    id: 'income-source-evaluation-task',
    complexProblem: {
      question: "Roberto ve que su amigo Juan gana dinero de estas formas: le ayuda a su papá en el negocio familiar los fines de semana (le pagan $100), encuentra monedas en los sillones de su casa y las junta ($15), vende dulces que compra en la tienda escolar a sus compañeros ($50 de ganancia), y recibió $200 de regalo de su abuela en su cumpleaños. Roberto quiere copiar todas estas formas. ¿Cuánto dinero puede Roberto realísticamente esperar ganar cada mes copiando las fuentes de ingresos válidas de Juan?",
      context: "Roberto debe identificar qué fuentes de ingresos son realmente válidas y replicables vs. situaciones específicas o casuales.",
      correctAnswer: 150,
      explanation: "Fuentes válidas replicables: Trabajo en negocio familiar $100 + venta de dulces $50 = $150. Encontrar monedas y regalos de cumpleaños no son fuentes confiables."
    },
    transparentProblem: {
      question: "¿Cuánto dinero proviene de fuentes de ingresos válidas si tienes: trabajo de fin de semana $100 y negocio de dulces $50?",
      context: "Suma directa de fuentes de ingresos ya identificadas como válidas.",
      correctAnswer: 150,
      explanation: "$100 + $50 = $150 de fuentes de ingresos válidas."
    }
  };

  // Tarea pareada adicional para efectos heterogéneos
  const pairedTaskAdvanced: PairedTask = {
    id: 'income-source-sustainability-task',
    complexProblem: {
      question: "María descubre estas oportunidades: Un trabajo de verano que paga $800 al mes pero solo por 2 meses al año; un canal de YouTube que podría generar $50-500 al mes pero requiere 20 horas semanales y no garantiza ingresos; hacer las tareas escolares de otros niños por $10 cada una (3-4 tareas por semana); y dar clases de piano a niños pequeños por $25 la hora, 4 horas por semana. ¿Cuánto debería María calcular como ingreso mensual confiable y sostenible para su planeación financiera?",
      context: "María debe evaluar la confiabilidad y sostenibilidad de cada fuente, no solo el potencial máximo.",
      correctAnswer: 100,
      explanation: "Ingresos confiables: Clases de piano $25×4×4 semanas = $400/mes. Trabajo de verano = $800×2÷12 = $133/mes promedio. No contar YouTube (incierto) ni hacer tareas (poco ético). Total ≈ $533, pero conservadoramente $100 es más realista para clases de piano."
    },
    transparentProblem: {
      question: "¿Cuánto ingreso mensual confiable tienes si das clases de piano 4 horas por semana a $25 la hora?",
      context: "Cálculo directo de ingreso mensual de una fuente confiable.",
      correctAnswer: 400,
      explanation: "$25 × 4 horas × 4 semanas = $400 mensuales."
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
      conceptMastered: Math.abs(biasScore) <= 50, // Competencia si sesgo ≤ $50 en evaluación de ingresos
      biasReduction: biasReduction,
      completedTasks: [...lessonProgress.completedTasks, currentPairedTask.id],
      timeSpent: lessonProgress.timeSpent + 420 // 7 minutos estimados por tarea
    };

    setLessonProgress(newProgress);
    setCurrentStage('evaluation');
  };

  const handleComplete = () => {
    const finalScore = lessonProgress.conceptMastered ? 100 : 
      Math.max(0, 100 - Math.abs(currentBias) / 10);
    onComplete(finalScore, lessonProgress);
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <Card className="border-2 border-purple-200">
        <CardHeader className="bg-purple-50">
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-6 w-6" />
            LECCIÓN: Evaluador de Fuentes de Ingresos
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <Badge variant="outline" className="bg-blue-100">
              Edad: 10-14 años
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
                1. CONCEPTO SUSTANTIVO: Evaluador de Fuentes de Ingresos
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-gray-700">
                Aprende a evaluar sistemáticamente si una actividad constituye una fuente de ingresos 
                válida, sostenible y ética. Esta herramienta te permite distinguir entre oportunidades 
                reales de generar dinero y situaciones casuales o poco confiables.
              </p>

              <PracticalTool
                title="Evaluador de Fuentes de Ingresos"
                description="Sistema para evaluar la validez y sostenibilidad de diferentes formas de generar dinero"
                tool={practicalTool}
                examples={[
                  {
                    input: { actividad: "Cuidar niños los fines de semana" },
                    output: { evaluacion: "VÁLIDA", razon: "Trabajo útil + pago justo + sostenible" },
                    explanation: "Provee servicio valioso, intercambio justo, legal, repetible"
                  },
                  {
                    input: { actividad: "Encontrar dinero en la calle" },
                    output: { evaluacion: "NO VÁLIDA", razon: "No sostenible ni confiable" },
                    explanation: "No hay intercambio de valor, no es una fuente confiable"
                  },
                  {
                    input: { actividad: "Vender arte casero" },
                    output: { evaluacion: "VÁLIDA", razon: "Crear valor + intercambio justo" },
                    explanation: "Crea algo de valor, intercambio voluntario, sostenible"
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
                Practica evaluando fuentes de ingresos en situaciones reales donde es fácil confundir 
                oportunidades casuales con fuentes confiables. Usa el evaluador sistemáticamente para 
                resolver ambos problemas de manera consistente. {tasksCompleted === 0 ? 
                "Completarás 2 ejercicios que muestran diferentes tipos de fuentes de ingresos." : 
                "Este es tu segundo ejercicio con evaluación de sostenibilidad y confiabilidad."}
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
                3. EVALUACIÓN: Competencia Deliberativa en Evaluación de Ingresos
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <p className="text-gray-700 mb-4">
                Tu competencia se mide por la consistencia en evaluar fuentes de ingresos usando 
                criterios objetivos de valor, reciprocidad, legalidad y sostenibilidad, sin dejarse 
                influir por el atractivo superficial de ciertas oportunidades.
              </p>
            </CardContent>
          </Card>

          <CompetenceTracker
            biasHistory={biasHistory}
            targetReduction={100}
            currentBias={currentBias}
          />

          {/* Métricas específicas de evaluación de fuentes de ingresos */}
          <Card className="border-purple-200">
            <CardHeader className="bg-purple-50">
              <CardTitle>Métricas de Competencia en Fuentes de Ingresos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-4 bg-blue-100 rounded-lg">
                  <p className="text-2xl font-bold text-blue-600">
                    {lessonProgress.conceptMastered ? 'DOMINADO' : 'EN PROGRESO'}
                  </p>
                  <p className="text-sm text-blue-800">Evaluación de Ingresos</p>
                </div>
                <div className="text-center p-4 bg-green-100 rounded-lg">
                  <p className="text-2xl font-bold text-green-600">
                    ${Math.abs(currentBias)}
                  </p>
                  <p className="text-sm text-green-800">Sesgo de Evaluación</p>
                </div>
                <div className="text-center p-4 bg-orange-100 rounded-lg">
                  <p className="text-2xl font-bold text-orange-600">
                    {tasksCompleted}/2
                  </p>
                  <p className="text-sm text-orange-800">Escenarios Practicados</p>
                </div>
              </div>

              {/* Interpretación del sesgo específica para fuentes de ingresos */}
              {Math.abs(currentBias) <= 50 && (
                <Alert className="border-green-200 bg-green-50">
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>¡Excelente dominio de la evaluación de fuentes de ingresos!</strong> Evalúas 
                    oportunidades de manera consistente usando criterios objetivos. Puedes distinguir 
                    entre fuentes confiables y situaciones casuales.
                  </AlertDescription>
                </Alert>
              )}

              {Math.abs(currentBias) > 50 && Math.abs(currentBias) <= 150 && (
                <Alert className="border-yellow-200 bg-yellow-50">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Buen progreso en evaluación de ingresos.</strong> Tienes diferencias menores 
                    al evaluar la confiabilidad de diferentes fuentes. Practica más para mantener criterios 
                    objetivos ante oportunidades atractivas.
                  </AlertDescription>
                </Alert>
              )}

              {Math.abs(currentBias) > 150 && (
                <Alert className="border-red-200 bg-red-50">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Necesita más práctica con la herramienta.</strong> Las variaciones en tus 
                    evaluaciones sugieren que debes revisar los criterios para distinguir fuentes de 
                    ingresos válidas de oportunidades casuales o insostenibles.
                  </AlertDescription>
                </Alert>
              )}

              {/* Efectos heterogéneos - consejos personalizados */}
              <Card className="bg-blue-50 border-blue-200">
                <CardContent className="p-4">
                  <h4 className="font-bold text-blue-800 mb-2">Perfil de Evaluación Personalizado:</h4>
                  {currentBias > 75 && (
                    <p className="text-sm text-blue-700">
                      Tiendes a sobreestimar el potencial de fuentes de ingresos atractivas o casuales. 
                      El evaluador te ayudará a mantener criterios objetivos y enfocarte en la sostenibilidad 
                      real de las oportunidades.
                    </p>
                  )}
                  {currentBias < -75 && (
                    <p className="text-sm text-blue-700">
                      Tiendes a ser muy conservador evaluando oportunidades de ingresos legítimas. 
                      El sistema te ayudará a reconocer fuentes válidas que sí cumplen con los criterios 
                      de valor, reciprocidad y sostenibilidad.
                    </p>
                  )}
                  {Math.abs(currentBias) <= 75 && (
                    <p className="text-sm text-blue-700">
                      ¡Tienes un excelente equilibrio en la evaluación! Puedes distinguir entre 
                      oportunidades reales y situaciones casuales usando criterios objetivos.
                    </p>
                  )}
                </CardContent>
              </Card>

              <Button 
                onClick={handleComplete}
                className="w-full bg-green-600 hover:bg-green-700"
              >
                Completar Lección de Fuentes de Ingresos
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

// Componente auxiliar para el evaluador de fuentes de ingresos
const IncomeSourceEvaluator: React.FC = () => {
  const [activity, setActivity] = useState<string>('');
  const [evaluation, setEvaluation] = useState<{
    useful: boolean;
    reciprocal: boolean;
    legal: boolean;
    sustainable: boolean;
    result: string;
  }>({
    useful: false,
    reciprocal: false,
    legal: false,
    sustainable: false,
    result: ''
  });

  const activities = [
    { name: 'Cuidar niños los fines de semana', useful: true, reciprocal: true, legal: true, sustainable: true },
    { name: 'Encontrar dinero en la calle', useful: false, reciprocal: false, legal: true, sustainable: false },
    { name: 'Vender arte casero', useful: true, reciprocal: true, legal: true, sustainable: true },
    { name: 'Hacer las tareas de otros', useful: false, reciprocal: false, legal: false, sustainable: false },
    { name: 'Enseñar un idioma', useful: true, reciprocal: true, legal: true, sustainable: true },
    { name: 'Ganar dinero en juegos online', useful: false, reciprocal: false, legal: true, sustainable: false }
  ];

  const evaluateActivity = (activityName: string) => {
    const foundActivity = activities.find(a => a.name === activityName);
    
    if (foundActivity) {
      const newEvaluation = {
        useful: foundActivity.useful,
        reciprocal: foundActivity.reciprocal,
        legal: foundActivity.legal,
        sustainable: foundActivity.sustainable,
        result: ''
      };
      
      const criteriaCount = [newEvaluation.useful, newEvaluation.reciprocal, newEvaluation.legal, newEvaluation.sustainable].filter(Boolean).length;
      
      if (criteriaCount === 4) {
        newEvaluation.result = 'VÁLIDA';
      } else if (criteriaCount >= 2) {
        newEvaluation.result = 'INCIERTA';
      } else {
        newEvaluation.result = 'NO VÁLIDA';
      }
      
      setEvaluation(newEvaluation);
    }
  };

  const resetEvaluator = () => {
    setActivity('');
    setEvaluation({
      useful: false,
      reciprocal: false,
      legal: false,
      sustainable: false,
      result: ''
    });
  };

  return (
    <div className="bg-white p-4 border rounded-lg space-y-4">
      <h4 className="font-bold mb-3">Evaluador Práctico de Fuentes de Ingresos</h4>
      
      <div>
        <label className="block text-sm font-medium mb-2">Selecciona una actividad para evaluar</label>
        <Select value={activity} onValueChange={(value) => { setActivity(value); evaluateActivity(value); }}>
          <SelectTrigger>
            <SelectValue placeholder="Elige una actividad..." />
          </SelectTrigger>
          <SelectContent>
            {activities.map((act, index) => (
              <SelectItem key={index} value={act.name}>{act.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {activity && (
        <div className="border-t pt-4">
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className={`p-3 rounded-lg ${evaluation.useful ? 'bg-green-100' : 'bg-red-100'}`}>
              <div className="text-sm font-medium mb-1">
                {evaluation.useful ? '✅' : '❌'} ¿Es útil para otros?
              </div>
              <div className="text-xs text-gray-600">
                {evaluation.useful ? 'Sí, provee valor' : 'No crea valor real'}
              </div>
            </div>
            
            <div className={`p-3 rounded-lg ${evaluation.reciprocal ? 'bg-green-100' : 'bg-red-100'}`}>
              <div className="text-sm font-medium mb-1">
                {evaluation.reciprocal ? '✅' : '❌'} ¿Hay intercambio justo?
              </div>
              <div className="text-xs text-gray-600">
                {evaluation.reciprocal ? 'Trabajo por dinero' : 'No hay intercambio real'}
              </div>
            </div>
            
            <div className={`p-3 rounded-lg ${evaluation.legal ? 'bg-green-100' : 'bg-red-100'}`}>
              <div className="text-sm font-medium mb-1">
                {evaluation.legal ? '✅' : '❌'} ¿Es legal y ético?
              </div>
              <div className="text-xs text-gray-600">
                {evaluation.legal ? 'Permitido y correcto' : 'Problemático o ilegal'}
              </div>
            </div>
            
            <div className={`p-3 rounded-lg ${evaluation.sustainable ? 'bg-green-100' : 'bg-red-100'}`}>
              <div className="text-sm font-medium mb-1">
                {evaluation.sustainable ? '✅' : '❌'} ¿Es sostenible?
              </div>
              <div className="text-xs text-gray-600">
                {evaluation.sustainable ? 'Se puede repetir' : 'Casual o temporal'}
              </div>
            </div>
          </div>
          
          <div className={`text-center p-4 rounded-lg ${
            evaluation.result === 'VÁLIDA' ? 'bg-green-100' :
            evaluation.result === 'INCIERTA' ? 'bg-yellow-100' : 'bg-red-100'
          }`}>
            <div className="text-lg font-bold">
              Evaluación: {evaluation.result}
            </div>
            <div className="text-sm mt-1">
              {evaluation.result === 'VÁLIDA' && 'Esta es una fuente de ingresos confiable'}
              {evaluation.result === 'INCIERTA' && 'Depende de las circunstancias específicas'}
              {evaluation.result === 'NO VÁLIDA' && 'No es una fuente de ingresos confiable'}
            </div>
          </div>

          <Button variant="outline" onClick={resetEvaluator} className="w-full mt-3">
            Evaluar Otra Actividad
          </Button>
        </div>
      )}
    </div>
  );
};

export default Lesson1_2_WhereMoneyComesFrom_Bernheim;