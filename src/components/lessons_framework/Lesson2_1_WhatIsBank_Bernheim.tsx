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
import { Calculator, Target, CheckCircle, AlertCircle, BookOpen, TrendingUp, Building } from 'lucide-react';

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
            <Building className="h-5 w-5" />
            Herramienta: Evaluador de Servicios Bancarios
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-green-100 p-4 rounded-lg">
            <h4 className="font-bold text-green-800 mb-2">Pasos para usar la herramienta:</h4>
            <ol className="list-decimal list-inside space-y-2 text-sm text-green-700">
              <li><strong>Identificar la necesidad:</strong> ¿Qué servicio financiero necesitas?</li>
              <li><strong>Evaluar costos totales:</strong> Comisiones + requisitos + costos ocultos</li>
              <li><strong>Verificar beneficios reales:</strong> ¿Qué ganas vs. otras opciones?</li>
              <li><strong>Confirmar seguridad y regulación:</strong> ¿Es una institución confiable?</li>
              <li><strong>Calcular valor neto:</strong> Beneficios - costos = valor real del servicio</li>
            </ol>
          </div>
          
          <BankServiceEvaluator />
          
          <div className="bg-gray-100 p-3 rounded-lg">
            <p className="text-sm text-gray-700">
              <strong>Criterios de evaluación:</strong> 
            </p>
            <ul className="text-xs text-gray-600 mt-1 space-y-1">
              <li>• <strong>EXCELENTE:</strong> Bajo costo + alta seguridad + beneficios claros</li>
              <li>• <strong>BUENO:</strong> Costo razonable + seguro + algunos beneficios</li>
              <li>• <strong>MALO:</strong> Alto costo + pocos beneficios + poca transparencia</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // ETAPA 2: DECISIONES DE VALUACIÓN - TAREAS PAREADAS
  const pairedTask: PairedTask = {
    id: 'bank-service-evaluation-task',
    complexProblem: {
      question: "Carmen quiere abrir su primera cuenta bancaria. El Banco A le ofrece: 'Cuenta Joven Premium' con 0% de comisión mensual los primeros 6 meses, luego $45/mes, tarjeta dorada con diseño exclusivo, app muy moderna, y 0.1% de interés anual. El Banco B ofrece: 'Cuenta Básica' con $15/mes siempre, tarjeta sencilla, app funcional, y 0.3% de interés anual, más $50 de regalo por abrir la cuenta. ¿Cuál es el costo total anual real de la opción del Banco A?",
      context: "Carmen debe calcular costos reales anuales sin dejarse influir por beneficios cosméticos o promociones temporales.",
      correctAnswer: 270,
      explanation: "Banco A costo anual: 6 meses gratis + 6 meses × $45 = $0 + $270 = $270. Los beneficios estéticos no tienen valor monetario real."
    },
    transparentProblem: {
      question: "¿Cuánto cuesta anualmente una cuenta que es gratis 6 meses y luego cuesta $45 mensuales?",
      context: "Cálculo directo del costo anual de un servicio bancario.",
      correctAnswer: 270,
      explanation: "6 meses gratis + 6 meses × $45 = $270 anuales."
    }
  };

  // Tarea pareada adicional para efectos heterogéneos
  const pairedTaskAdvanced: PairedTask = {
    id: 'bank-service-comparison-task',
    complexProblem: {
      question: "Luis compara cuentas de ahorro: El Banco X ofrece 2% de interés anual pero requiere mantener $5,000 mínimos y cobra $100 si el saldo baja, más $20/mes de comisión. El Banco Y ofrece 0.5% de interés, sin saldo mínimo, sin comisiones, y te da una tablet 'gratis' al abrir la cuenta. Luis tiene $1,500 para empezar. Su papá le da $200 mensuales y él gasta $150/mes. ¿Cuál banco le conviene más a Luis en términos de beneficio neto anual?",
      context: "Luis debe evaluar qué banco realmente le conviene considerando sus circunstancias específicas, no las condiciones ideales.",
      correctAnswer: 9,
      explanation: "Con $1,500 inicial + $50 ahorro/mes, Luis llegará a $2,100 al año. Banco X: no puede mantener $5,000, pagaría penalizaciones. Banco Y: $2,100 × 0.5% = $10.50 interés anual. Beneficio neto ≈ $9-10."
    },
    transparentProblem: {
      question: "¿Cuánto interés anual gana Luis si tiene $2,100 en una cuenta que paga 0.5% anual sin comisiones?",
      context: "Cálculo directo de interés anual ganado.",
      correctAnswer: 10.5,
      explanation: "$2,100 × 0.5% = $10.50 de interés anual."
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
      conceptMastered: Math.abs(biasScore) <= 25, // Competencia si sesgo ≤ $25 en evaluación bancaria
      biasReduction: biasReduction,
      completedTasks: [...lessonProgress.completedTasks, currentPairedTask.id],
      timeSpent: lessonProgress.timeSpent + 450 // 7-8 minutos estimados por tarea
    };

    setLessonProgress(newProgress);
    setCurrentStage('evaluation');
  };

  const handleComplete = () => {
    const finalScore = lessonProgress.conceptMastered ? 100 : 
      Math.max(0, 100 - Math.abs(currentBias) / 5);
    onComplete(finalScore, lessonProgress);
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <Card className="border-2 border-purple-200">
        <CardHeader className="bg-purple-50">
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-6 w-6" />
            LECCIÓN: Evaluador de Servicios Bancarios
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <Badge variant="outline" className="bg-blue-100">
              Edad: 12-16 años
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
                1. CONCEPTO SUSTANTIVO: Evaluador de Servicios Bancarios
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-gray-700">
                Aprende a evaluar servicios bancarios usando criterios objetivos que consideran 
                costos reales, beneficios tangibles y tu situación específica. Esta herramienta 
                te permite comparar opciones sin dejarte influir por marketing o beneficios cosméticos.
              </p>

              <PracticalTool
                title="Evaluador de Servicios Bancarios"
                description="Sistema para evaluar objetivamente servicios financieros considerando costos totales y beneficios reales"
                tool={practicalTool}
                examples={[
                  {
                    input: { servicio: "Cuenta con $20/mes + 0.5% interés" },
                    output: { evaluacion: "Depende del saldo promedio" },
                    explanation: "Si tienes $5,000: ganas $25/año - pagas $240/año = -$215 neto"
                  },
                  {
                    input: { servicio: "Cuenta gratis + 0.1% interés" },
                    output: { evaluacion: "Buena para saldos bajos" },
                    explanation: "Con $1,000: ganas $1/año - pagas $0 = +$1 neto"
                  },
                  {
                    input: { servicio: "Cuenta 'premium' $50/mes + beneficios" },
                    output: { evaluacion: "Solo si usas beneficios activamente" },
                    explanation: "Costo $600/año debe compensarse con uso real de beneficios"
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
                Practica evaluando servicios bancarios en situaciones reales donde las promociones 
                atractivas y beneficios cosméticos pueden distraer del análisis objetivo de costos 
                y beneficios reales. {tasksCompleted === 0 ? 
                "Completarás 2 ejercicios que muestran diferentes tipos de ofertas bancarias." : 
                "Este es tu segundo ejercicio con comparación personalizada de servicios."}
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
                3. EVALUACIÓN: Competencia Deliberativa en Servicios Bancarios
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <p className="text-gray-700 mb-4">
                Tu competencia se mide por la consistencia en evaluar servicios bancarios usando 
                cálculos objetivos de costos totales y beneficios reales, sin dejarse influir por 
                marketing, promociones temporales o beneficios cosméticos.
              </p>
            </CardContent>
          </Card>

          <CompetenceTracker
            biasHistory={biasHistory}
            targetReduction={50}
            currentBias={currentBias}
          />

          {/* Métricas específicas de evaluación de servicios bancarios */}
          <Card className="border-purple-200">
            <CardHeader className="bg-purple-50">
              <CardTitle>Métricas de Competencia en Servicios Bancarios</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-4 bg-blue-100 rounded-lg">
                  <p className="text-2xl font-bold text-blue-600">
                    {lessonProgress.conceptMastered ? 'DOMINADO' : 'EN PROGRESO'}
                  </p>
                  <p className="text-sm text-blue-800">Evaluación Bancaria</p>
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

              {/* Interpretación del sesgo específica para servicios bancarios */}
              {Math.abs(currentBias) <= 25 && (
                <Alert className="border-green-200 bg-green-50">
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>¡Excelente dominio de la evaluación bancaria!</strong> Evalúas servicios 
                    financieros de manera consistente usando cálculos objetivos. Puedes tomar decisiones 
                    bancarias informadas sin dejarte influir por marketing.
                  </AlertDescription>
                </Alert>
              )}

              {Math.abs(currentBias) > 25 && Math.abs(currentBias) <= 75 && (
                <Alert className="border-yellow-200 bg-yellow-50">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Buen progreso en evaluación bancaria.</strong> Tienes diferencias menores 
                    al calcular costos y beneficios reales. Practica más para mantener objetividad 
                    ante ofertas atractivas y promociones temporales.
                  </AlertDescription>
                </Alert>
              )}

              {Math.abs(currentBias) > 75 && (
                <Alert className="border-red-200 bg-red-50">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Necesita más práctica con la herramienta.</strong> Las variaciones en tus 
                    evaluaciones sugieren que debes revisar los métodos para calcular costos totales 
                    y beneficios reales de servicios bancarios.
                  </AlertDescription>
                </Alert>
              )}

              {/* Efectos heterogéneos - consejos personalizados */}
              <Card className="bg-blue-50 border-blue-200">
                <CardContent className="p-4">
                  <h4 className="font-bold text-blue-800 mb-2">Perfil de Evaluación Personalizado:</h4>
                  {currentBias > 40 && (
                    <p className="text-sm text-blue-700">
                      Tiendes a subestimar los costos totales de servicios bancarios atractivos o 
                      sobreestimar el valor de beneficios promocionales. El evaluador te ayudará a 
                      mantener cálculos objetivos y considerar costos a largo plazo.
                    </p>
                  )}
                  {currentBias < -40 && (
                    <p className="text-sm text-blue-700">
                      Tiendes a ser muy conservador evaluando servicios bancarios, posiblemente 
                      subestimando beneficios reales. El sistema te ayudará a reconocer cuando 
                      un servicio sí ofrece valor neto positivo.
                    </p>
                  )}
                  {Math.abs(currentBias) <= 40 && (
                    <p className="text-sm text-blue-700">
                      ¡Tienes un excelente equilibrio en la evaluación bancaria! Puedes analizar 
                      ofertas de manera objetiva y tomar decisiones financieras informadas.
                    </p>
                  )}
                </CardContent>
              </Card>

              <Button 
                onClick={handleComplete}
                className="w-full bg-green-600 hover:bg-green-700"
              >
                Completar Lección de Servicios Bancarios
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

// Componente auxiliar para el evaluador de servicios bancarios
const BankServiceEvaluator: React.FC = () => {
  const [selectedService, setSelectedService] = useState<string>('');
  const [userSaldo, setUserSaldo] = useState<number>(1000);
  const [evaluation, setEvaluation] = useState<{
    costAnual: number;
    beneficioAnual: number;
    valorNeto: number;
    calificacion: string;
    explanation: string;
  }>({
    costAnual: 0,
    beneficioAnual: 0,
    valorNeto: 0,
    calificacion: '',
    explanation: ''
  });

  const bankServices = [
    {
      name: 'Cuenta Básica Gratis',
      comisionMensual: 0,
      interesAnual: 0.001,
      description: 'Sin comisiones, interés muy bajo'
    },
    {
      name: 'Cuenta Joven $15/mes',
      comisionMensual: 15,
      interesAnual: 0.003,
      description: 'Comisión baja, interés moderado'
    },
    {
      name: 'Cuenta Premium $50/mes',
      comisionMensual: 50,
      interesAnual: 0.005,
      description: 'Comisión alta, mejores beneficios'
    },
    {
      name: 'Cuenta VIP $100/mes',
      comisionMensual: 100,
      interesAnual: 0.008,
      description: 'Máxima comisión, máximos beneficios'
    }
  ];

  const evaluateService = (serviceName: string, saldo: number) => {
    const service = bankServices.find(s => s.name === serviceName);
    
    if (service && saldo > 0) {
      const costAnual = service.comisionMensual * 12;
      const beneficioAnual = saldo * service.interesAnual;
      const valorNeto = beneficioAnual - costAnual;
      
      let calificacion = '';
      let explanation = '';
      
      if (valorNeto > 100) {
        calificacion = 'EXCELENTE';
        explanation = 'Genera valor neto positivo significativo';
      } else if (valorNeto > 0) {
        calificacion = 'BUENO';
        explanation = 'Genera valor neto positivo moderado';
      } else if (valorNeto > -100) {
        calificacion = 'REGULAR';
        explanation = 'Valor neto ligeramente negativo';
      } else {
        calificacion = 'MALO';
        explanation = 'Valor neto muy negativo';
      }
      
      setEvaluation({
        costAnual,
        beneficioAnual,
        valorNeto,
        calificacion,
        explanation
      });
    }
  };

  const resetEvaluator = () => {
    setSelectedService('');
    setUserSaldo(1000);
    setEvaluation({
      costAnual: 0,
      beneficioAnual: 0,
      valorNeto: 0,
      calificacion: '',
      explanation: ''
    });
  };

  return (
    <div className="bg-white p-4 border rounded-lg space-y-4">
      <h4 className="font-bold mb-3">Evaluador Práctico de Servicios Bancarios</h4>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-2">Servicio Bancario</label>
          <Select 
            value={selectedService} 
            onValueChange={(value) => { 
              setSelectedService(value); 
              evaluateService(value, userSaldo); 
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Elige un servicio..." />
            </SelectTrigger>
            <SelectContent>
              {bankServices.map((service, index) => (
                <SelectItem key={index} value={service.name}>{service.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">Tu Saldo Promedio ($)</label>
          <Input
            type="number"
            value={userSaldo || ''}
            onChange={(e) => {
              const newSaldo = Number(e.target.value);
              setUserSaldo(newSaldo);
              if (selectedService) evaluateService(selectedService, newSaldo);
            }}
            placeholder="1000"
            min="0"
          />
        </div>
      </div>

      {selectedService && userSaldo > 0 && (
        <div className="border-t pt-4">
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="text-center p-3 bg-red-100 rounded-lg">
              <div className="text-sm font-medium mb-1">Costo Anual</div>
              <div className="text-xl font-bold text-red-600">
                -${evaluation.costAnual}
              </div>
            </div>
            <div className="text-center p-3 bg-green-100 rounded-lg">
              <div className="text-sm font-medium mb-1">Beneficio Anual</div>
              <div className="text-xl font-bold text-green-600">
                +${evaluation.beneficioAnual.toFixed(2)}
              </div>
            </div>
            <div className={`text-center p-3 rounded-lg ${
              evaluation.valorNeto > 0 ? 'bg-green-100' : 'bg-red-100'
            }`}>
              <div className="text-sm font-medium mb-1">Valor Neto</div>
              <div className={`text-xl font-bold ${
                evaluation.valorNeto > 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                ${evaluation.valorNeto.toFixed(2)}
              </div>
            </div>
          </div>
          
          <div className={`text-center p-4 rounded-lg ${
            evaluation.calificacion === 'EXCELENTE' ? 'bg-green-100' :
            evaluation.calificacion === 'BUENO' ? 'bg-blue-100' :
            evaluation.calificacion === 'REGULAR' ? 'bg-yellow-100' : 'bg-red-100'
          }`}>
            <div className="text-lg font-bold mb-1">
              Calificación: {evaluation.calificacion}
            </div>
            <div className="text-sm">
              {evaluation.explanation}
            </div>
          </div>
          
          <div className="mt-3 p-2 bg-gray-100 rounded text-center text-sm">
            <span className="font-medium">Cálculo: </span>
            <span>
              Beneficio (${userSaldo} × {bankServices.find(s => s.name === selectedService)?.interesAnual}%) 
              - Costo (${bankServices.find(s => s.name === selectedService)?.comisionMensual} × 12) 
              = ${evaluation.valorNeto.toFixed(2)}
            </span>
          </div>

          <Button variant="outline" onClick={resetEvaluator} className="w-full mt-3">
            Evaluar Otro Servicio
          </Button>
        </div>
      )}
    </div>
  );
};

export default Lesson2_1_WhatIsBank_Bernheim;