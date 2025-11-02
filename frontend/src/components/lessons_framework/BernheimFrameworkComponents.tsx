import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, AlertCircle, Calculator, BookOpen, Target } from 'lucide-react';

// Tipos para el framework de Bernheim
export interface PairedTask {
  id: string;
  complexProblem: {
    question: string;
    context: string;
    correctAnswer: number;
    explanation: string;
  };
  transparentProblem: {
    question: string;
    context: string;
    correctAnswer: number;
    explanation: string;
  };
}

export interface BiasMetric {
  complexAnswer: number | null;
  transparentAnswer: number | null;
  biasScore: number | null; // Diferencia entre respuestas complejas y transparentes
}

export interface LessonProgress {
  conceptMastered: boolean;
  biasReduction: number;
  completedTasks: string[];
  timeSpent: number;
}

// Componente para tareas pareadas
export const PairedTaskComponent: React.FC<{
  task: PairedTask;
  onComplete: (complexAnswer: number, transparentAnswer: number, biasScore: number) => void;
  showFeedback?: boolean;
}> = ({ task, onComplete, showFeedback = true }) => {
  const [complexAnswer, setComplexAnswer] = useState<number | null>(null);
  const [transparentAnswer, setTransparentAnswer] = useState<number | null>(null);
  const [showResults, setShowResults] = useState(false);

  const calculateBias = () => {
    if (complexAnswer !== null && transparentAnswer !== null) {
      const bias = complexAnswer - transparentAnswer;
      setShowResults(true);
      onComplete(complexAnswer, transparentAnswer, bias);
      return bias;
    }
    return null;
  };

  const getBiasInterpretation = (bias: number) => {
    const absBias = Math.abs(bias);
    if (absBias < 5) return { type: 'success', message: '¡Excelente! Tus respuestas son muy consistentes.' };
    if (absBias < 15) return { type: 'warning', message: 'Pequeña diferencia. Revisemos por qué.' };
    return { type: 'error', message: 'Gran diferencia. Necesitamos practicar más este concepto.' };
  };

  return (
    <div className="space-y-6">
      {/* Problema Complejo */}
      <Card className="border-2 border-orange-200">
        <CardHeader className="bg-orange-50">
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Problema Aplicado
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-orange-100 p-4 rounded-lg">
            <p className="text-sm text-orange-800 mb-2">{task.complexProblem.context}</p>
            <p className="font-medium">{task.complexProblem.question}</p>
          </div>
          <Input
            type="number"
            placeholder="Tu respuesta..."
            value={complexAnswer || ''}
            onChange={(e) => setComplexAnswer(Number(e.target.value))}
            className="text-lg"
          />
        </CardContent>
      </Card>

      {/* Problema Transparente */}
      <Card className="border-2 border-blue-200">
        <CardHeader className="bg-blue-50">
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Problema Simple Equivalente
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-blue-100 p-4 rounded-lg">
            <p className="text-sm text-blue-800 mb-2">{task.transparentProblem.context}</p>
            <p className="font-medium">{task.transparentProblem.question}</p>
          </div>
          <Input
            type="number"
            placeholder="Tu respuesta..."
            value={transparentAnswer || ''}
            onChange={(e) => setTransparentAnswer(Number(e.target.value))}
            className="text-lg"
          />
        </CardContent>
      </Card>

      {/* Botón de evaluación */}
      <Button 
        onClick={calculateBias}
        disabled={complexAnswer === null || transparentAnswer === null}
        className="w-full"
      >
        Evaluar Consistencia
      </Button>

      {/* Retroalimentación */}
      {showResults && showFeedback && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Card className="border-orange-200">
              <CardContent className="p-4">
                <h4 className="font-medium mb-2">Respuesta Correcta (Aplicado)</h4>
                <p className="text-2xl font-bold text-orange-600">{task.complexProblem.correctAnswer}</p>
                <p className="text-sm text-gray-600 mt-2">{task.complexProblem.explanation}</p>
              </CardContent>
            </Card>
            <Card className="border-blue-200">
              <CardContent className="p-4">
                <h4 className="font-medium mb-2">Respuesta Correcta (Simple)</h4>
                <p className="text-2xl font-bold text-blue-600">{task.transparentProblem.correctAnswer}</p>
                <p className="text-sm text-gray-600 mt-2">{task.transparentProblem.explanation}</p>
              </CardContent>
            </Card>
          </div>

          {/* Análisis de sesgo */}
          {complexAnswer !== null && transparentAnswer !== null && (
            <Alert className={`border-2 ${
              getBiasInterpretation(complexAnswer - transparentAnswer).type === 'success' 
                ? 'border-green-200 bg-green-50' 
                : getBiasInterpretation(complexAnswer - transparentAnswer).type === 'warning'
                ? 'border-yellow-200 bg-yellow-50'
                : 'border-red-200 bg-red-50'
            }`}>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Tu sesgo métrico:</strong> {Math.abs(complexAnswer - transparentAnswer)} puntos<br />
                {getBiasInterpretation(complexAnswer - transparentAnswer).message}
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}
    </div>
  );
};

// Componente para herramientas prácticas
export const PracticalTool: React.FC<{
  title: string;
  description: string;
  tool: React.ReactNode;
  examples: { input: any; output: any; explanation: string }[];
}> = ({ title, description, tool, examples }) => {
  const [showExamples, setShowExamples] = useState(false);

  return (
    <div className="space-y-4">
      <Card className="border-2 border-green-200">
        <CardHeader className="bg-green-50">
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-gray-700">{description}</p>
          
          {/* Herramienta interactiva */}
          <div className="bg-gray-50 p-4 rounded-lg">
            {tool}
          </div>

          {/* Ejemplos */}
          <Button 
            variant="outline" 
            onClick={() => setShowExamples(!showExamples)}
            className="w-full"
          >
            {showExamples ? 'Ocultar Ejemplos' : 'Ver Ejemplos de Uso'}
          </Button>

          {showExamples && (
            <div className="space-y-3">
              {examples.map((example, index) => (
                <div key={index} className="bg-white p-3 border rounded-lg">
                  <div className="grid grid-cols-3 gap-3 text-sm">
                    <div>
                      <strong>Entrada:</strong> {JSON.stringify(example.input)}
                    </div>
                    <div>
                      <strong>Resultado:</strong> {JSON.stringify(example.output)}
                    </div>
                    <div>
                      <strong>Por qué:</strong> {example.explanation}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

// Componente para medición de progreso en competencia deliberativa
export const CompetenceTracker: React.FC<{
  biasHistory: number[];
  targetReduction: number;
  currentBias: number;
}> = ({ biasHistory, targetReduction, currentBias }) => {
  const averageBias = biasHistory.reduce((a, b) => a + Math.abs(b), 0) / biasHistory.length;
  const reductionAchieved = averageBias - Math.abs(currentBias);
  const progressPercentage = Math.min(100, (reductionAchieved / targetReduction) * 100);

  return (
    <Card className="border-2 border-purple-200">
      <CardHeader className="bg-purple-50">
        <CardTitle className="flex items-center gap-2">
          <CheckCircle className="h-5 w-5" />
          Progreso en Competencia Deliberativa
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-2xl font-bold text-purple-600">{Math.abs(currentBias)}</p>
            <p className="text-sm text-gray-600">Sesgo Actual</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-green-600">{reductionAchieved.toFixed(1)}</p>
            <p className="text-sm text-gray-600">Reducción Lograda</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-blue-600">{progressPercentage.toFixed(0)}%</p>
            <p className="text-sm text-gray-600">Progreso al Objetivo</p>
          </div>
        </div>

        {/* Barra de progreso */}
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className="bg-purple-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>

        {/* Interpretación */}
        <div className="text-sm text-gray-600">
          {progressPercentage >= 80 && (
            <Badge variant="outline" className="bg-green-100 text-green-800">
              ¡Excelente competencia deliberativa!
            </Badge>
          )}
          {progressPercentage >= 50 && progressPercentage < 80 && (
            <Badge variant="outline" className="bg-yellow-100 text-yellow-800">
              Progreso sólido, sigue practicando
            </Badge>
          )}
          {progressPercentage < 50 && (
            <Badge variant="outline" className="bg-red-100 text-red-800">
              Necesita más práctica con herramientas
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

// Personajes para mantener continuidad con las lecciones existentes
export const characters = {
  lucas: {
    name: "Lucas",
    emoji: "👦",
    color: "blue",
    role: "estudiante"
  },
  sol: {
    name: "Sol",
    emoji: "👧", 
    color: "pink",
    role: "estudiante"
  },
  maestro_dinero: {
    name: "Maestro Dinero",
    emoji: "👨‍🏫",
    color: "green", 
    role: "instructor"
  }
};
