import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Star, 
  CheckCircle, 
  Gift, 
  Heart,
  Lightbulb,
  Users,
  Play,
  ArrowRight,
  RotateCcw,
  Trophy,
  Medal,
  Coins,
  Home,
  ChevronLeft,
  ChevronRight
} from "lucide-react";

// Interfaces para los componentes
interface Character {
  id: string;
  name: string;
  avatar: string;
  personality: string;
  catchphrase: string;
}

interface Activity {
  id: string;
  type: 'question' | 'game' | 'sorting' | 'counting' | 'decision';
  title: string;
  description: string;
  content: any;
  points: number;
  completed?: boolean;
}

interface LessonSegment {
  id: string;
  title: string;
  duration: number; // minutos
  narrative: string;
  character: Character;
  activities: Activity[];
  hook: string; // gancho inicial
  reflection: string; // pregunta de reflexión final
}

// Personajes principales del universo LittleFounders
export const characters: Record<string, Character> = {
  lucas: {
    id: 'lucas',
    name: 'Lucas',
    avatar: '👦',
    personality: 'Curioso y aventurero, siempre hace preguntas',
    catchphrase: '¡Vamos a descubrir algo nuevo!'
  },
  sol: {
    id: 'sol',
    name: 'Sol',
    avatar: '👧',
    personality: 'Muy organizada y le gusta contar',
    catchphrase: '¡Cada moneda cuenta!'
  },
  max: {
    id: 'max',
    name: 'Max el Perrito',
    avatar: '🐕',
    personality: 'Juguetón y siempre hambriento',
    catchphrase: '¡Guau! ¿Eso se puede comer?'
  },
  mila: {
    id: 'mila',
    name: 'Mila',
    avatar: '🐱',
    personality: 'Inteligente y le gusta hacer planes',
    catchphrase: 'Pensemos bien antes de decidir'
  },
  maestro_dinero: {
    id: 'maestro_dinero',
    name: 'Maestro Dinero',
    avatar: '🧙‍♂️',
    personality: 'Sabio guía financiero',
    catchphrase: '¡El conocimiento es la mejor inversión!'
  }
};

// Componente para mostrar personajes hablando
interface CharacterDialogProps {
  character: Character;
  message: string;
  isNarrator?: boolean;
  className?: string;
}

export const CharacterDialog: React.FC<CharacterDialogProps> = ({ 
  character, 
  message, 
  isNarrator = false,
  className = ""
}) => {
  return (
    <Card className={`relative bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200 ${className}`}>
      <CardContent className="p-4">
        <div className="flex items-start space-x-4">
          <div className="text-4xl">{character.avatar}</div>
          <div className="flex-1">
            <div className="flex items-center space-x-2 mb-2">
              <h3 className="font-bold text-purple-800">{character.name}</h3>
              {!isNarrator && (
                <Badge variant="outline" className="text-xs bg-purple-100">
                  {character.catchphrase}
                </Badge>
              )}
            </div>
            <p className="text-gray-700 text-sm leading-relaxed">{message}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// Componente para ganchos visuales/narrativos
interface LessonHookProps {
  title: string;
  question: string;
  visual: React.ReactNode;
  character: Character;
  onStart: () => void;
}

export const LessonHook: React.FC<LessonHookProps> = ({
  title,
  question,
  visual,
  character,
  onStart
}) => {
  return (
    <Card className="bg-gradient-to-br from-yellow-50 via-orange-50 to-red-50 border-orange-200">
      <CardHeader className="text-center">
        <div className="text-6xl mb-4">{visual}</div>
        <CardTitle className="text-2xl text-orange-800">{title}</CardTitle>
        <p className="text-lg text-orange-700 font-medium">{question}</p>
      </CardHeader>
      <CardContent>
        <CharacterDialog 
          character={character}
          message={`¡Hola! Soy ${character.name} y voy a acompañarte en esta aventura. ${question} ¡Vamos a descubrirlo juntos!`}
          className="mb-4"
        />
        <div className="text-center">
          <Button 
            onClick={onStart}
            size="lg"
            className="bg-orange-500 hover:bg-orange-600 text-white font-bold px-8 py-3"
          >
            <Play className="w-5 h-5 mr-2" />
            ¡Comenzar Aventura!
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

// Componente para objetivos de lección
interface LessonObjectiveProps {
  objective: string;
  learningGoals: string[];
}

export const LessonObjective: React.FC<LessonObjectiveProps> = ({
  objective,
  learningGoals
}) => {
  return (
    <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2 text-blue-800">
          <Lightbulb className="w-6 h-6" />
          <span>¿Qué vamos a aprender hoy?</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-blue-700 font-medium mb-4">{objective}</p>
        <div className="space-y-2">
          {learningGoals.map((goal, index) => (
            <div key={index} className="flex items-start space-x-2">
              <Star className="w-4 h-4 text-yellow-500 mt-0.5 flex-shrink-0" />
              <span className="text-sm text-blue-600">{goal}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

// Componente para actividades interactivas
interface InteractiveActivityProps {
  activity: Activity;
  onComplete: (points: number) => void;
  character: Character;
}

export const InteractiveActivity: React.FC<InteractiveActivityProps> = ({
  activity,
  onComplete,
  character
}) => {
  const [isCompleted, setIsCompleted] = useState(false);
  const [userAnswer, setUserAnswer] = useState<any>(null);

  const handleComplete = (answer: any) => {
    setUserAnswer(answer);
    setIsCompleted(true);
    onComplete(activity.points);
  };

  return (
    <Card className="bg-gradient-to-r from-green-50 to-teal-50 border-green-200">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2 text-green-800">
          <Gift className="w-6 h-6" />
          <span>Actividad: {activity.title}</span>
        </CardTitle>
        <p className="text-green-700">{activity.description}</p>
      </CardHeader>
      <CardContent>
        <CharacterDialog 
          character={character}
          message={`¡Es hora de poner en práctica lo que aprendimos! ${activity.description}`}
          className="mb-4"
        />
        
        {/* Aquí se renderizará el contenido específico según el tipo de actividad */}
        <div className="min-h-[200px] bg-white rounded-lg p-4 border-2 border-dashed border-green-300">
          {activity.type === 'question' && (
            <QuestionActivity 
              content={activity.content} 
              onAnswer={handleComplete}
              isCompleted={isCompleted}
            />
          )}
          {activity.type === 'sorting' && (
            <SortingActivity 
              content={activity.content} 
              onComplete={handleComplete}
              isCompleted={isCompleted}
            />
          )}
          {activity.type === 'counting' && (
            <CountingActivity 
              content={activity.content} 
              onComplete={handleComplete}
              isCompleted={isCompleted}
            />
          )}
        </div>

        {isCompleted && (
          <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-center space-x-2">
              <Trophy className="w-6 h-6 text-yellow-600" />
              <span className="font-bold text-yellow-800">¡Excelente trabajo!</span>
              <Badge className="bg-yellow-100 text-yellow-800">
                +{activity.points} puntos
              </Badge>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// Actividad de pregunta simple
interface QuestionActivityProps {
  content: {
    question: string;
    options: string[];
    correct: number;
    feedback: string;
  };
  onAnswer: (answer: number) => void;
  isCompleted: boolean;
}

const QuestionActivity: React.FC<QuestionActivityProps> = ({
  content,
  onAnswer,
  isCompleted
}) => {
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);

  const handleAnswer = (optionIndex: number) => {
    setSelectedOption(optionIndex);
    setShowFeedback(true);
    
    // Only call onAnswer if the answer is correct
    if (optionIndex === content.correct) {
      onAnswer(optionIndex);
    } else {
      // For wrong answers, we still need to mark as completed but with 0 points
      // We'll pass a special value to indicate wrong answer
      onAnswer(-1); // -1 indicates wrong answer
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-800">{content.question}</h3>
      <div className="grid grid-cols-1 gap-3">
        {content.options.map((option, index) => (
          <Button
            key={index}
            variant={selectedOption === index ? "default" : "outline"}
            className={`p-4 text-left justify-start h-auto ${
              showFeedback && index === content.correct 
                ? "bg-green-100 border-green-500 text-green-800" 
                : showFeedback && selectedOption === index && index !== content.correct
                  ? "bg-red-100 border-red-500 text-red-800"
                  : ""
            }`}
            onClick={() => !showFeedback && handleAnswer(index)}
            disabled={showFeedback}
          >
            {option}
          </Button>
        ))}
      </div>
      {showFeedback && (
        <div className={`p-3 border rounded-lg ${
          selectedOption === content.correct 
            ? "bg-green-50 border-green-200" 
            : "bg-red-50 border-red-200"
        }`}>
          <p className={selectedOption === content.correct ? "text-green-800" : "text-red-800"}>
            {selectedOption === content.correct 
              ? content.feedback 
              : `Incorrecto. La respuesta correcta es: "${content.options[content.correct]}"`
            }
          </p>
        </div>
      )}
    </div>
  );
};

// Actividad de clasificación
interface SortingActivityProps {
  content: {
    instructions: string;
    items: { id: string; name: string; category: 'needs' | 'wants'; emoji: string }[];
    categories: { id: string; name: string; description: string }[];
  };
  onComplete: (result: any) => void;
  isCompleted: boolean;
}

const SortingActivity: React.FC<SortingActivityProps> = ({
  content,
  onComplete,
  isCompleted
}) => {
  const [sortedItems, setSortedItems] = useState<Record<string, string[]>>({});
  const [remainingItems, setRemainingItems] = useState(content.items);

  const handleSort = (itemId: string, categoryId: string) => {
    const item = content.items.find(i => i.id === itemId);
    if (!item || isCompleted) return;

    const newRemainingItems = remainingItems.filter(i => i.id !== itemId);
    const newSortedItems = {
      ...sortedItems,
      [categoryId]: [...(sortedItems[categoryId] || []), itemId]
    };

    setRemainingItems(newRemainingItems);
    setSortedItems(newSortedItems);

    // Si se clasificaron todos los elementos
    if (newRemainingItems.length === 0) {
      onComplete(newSortedItems);
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-800">{content.instructions}</h3>
      
      {/* Elementos para clasificar */}
      {remainingItems.length > 0 && (
        <div className="mb-4">
          <h4 className="font-medium mb-2">Haz clic en los elementos para clasificarlos:</h4>
          <div className="flex flex-wrap gap-2">
            {remainingItems.map(item => (
              <div
                key={item.id}
                className="bg-white border-2 border-gray-300 rounded-lg p-3 cursor-pointer hover:border-blue-400 transition-colors"
                onClick={() => handleSort(item.id, item.category)}
              >
                <div className="text-2xl text-center">{item.emoji}</div>
                <div className="text-sm text-center mt-1">{item.name}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Categorías */}
      <div className="grid grid-cols-2 gap-4">
        {content.categories.map(category => (
          <div 
            key={category.id}
            className="border-2 border-dashed border-gray-300 rounded-lg p-4 min-h-[120px]"
          >
            <h4 className="font-semibold text-center mb-2">{category.name}</h4>
            <p className="text-xs text-gray-600 text-center mb-3">{category.description}</p>
            <div className="space-y-2">
              {(sortedItems[category.id] || []).map(itemId => {
                const item = content.items.find(i => i.id === itemId);
                return item ? (
                  <div key={itemId} className="bg-blue-50 border border-blue-200 rounded p-2 text-center">
                    <div className="text-xl">{item.emoji}</div>
                    <div className="text-xs">{item.name}</div>
                  </div>
                ) : null;
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Actividad de conteo
interface CountingActivityProps {
  content: {
    instructions: string;
    coins: { value: number; count: number; emoji: string }[];
    target: number;
  };
  onComplete: (result: any) => void;
  isCompleted: boolean;
}

const CountingActivity: React.FC<CountingActivityProps> = ({
  content,
  onComplete,
  isCompleted
}) => {
  const [total, setTotal] = useState(0);
  const [selectedCoins, setSelectedCoins] = useState<Record<number, number>>({});

  const handleCoinClick = (coinValue: number) => {
    if (isCompleted) return;
    
    const currentCount = selectedCoins[coinValue] || 0;
    const maxCount = content.coins.find(c => c.value === coinValue)?.count || 0;
    
    if (currentCount < maxCount) {
      const newCount = currentCount + 1;
      const newSelectedCoins = { ...selectedCoins, [coinValue]: newCount };
      const newTotal = total + coinValue;
      
      setSelectedCoins(newSelectedCoins);
      setTotal(newTotal);
      
      if (newTotal === content.target) {
        onComplete({ total: newTotal, coins: newSelectedCoins });
      }
    }
  };

  const resetCount = () => {
    setSelectedCoins({});
    setTotal(0);
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-800">{content.instructions}</h3>
      
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="text-center">
          <div className="text-2xl font-bold text-yellow-800">Total: ${total}</div>
          <div className="text-sm text-yellow-700">Meta: ${content.target}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {content.coins.map(coin => (
          <div key={coin.value} className="text-center">
            <Button
              variant="outline"
              className="w-full h-20 flex flex-col items-center justify-center hover:bg-yellow-50"
              onClick={() => handleCoinClick(coin.value)}
              disabled={isCompleted}
            >
              <div className="text-2xl">{coin.emoji}</div>
              <div className="text-sm font-semibold">${coin.value}</div>
            </Button>
            <div className="text-xs mt-1 text-gray-600">
              Usadas: {selectedCoins[coin.value] || 0}/{coin.count}
            </div>
          </div>
        ))}
      </div>

      <div className="text-center">
        <Button 
          variant="outline" 
          onClick={resetCount} 
          className="text-sm"
          disabled={isCompleted}
        >
          <RotateCcw className="w-4 h-4 mr-2" />
          Reiniciar
        </Button>
      </div>
    </div>
  );
};

// Componente para reflexión y cierre
interface LessonReflectionProps {
  question: string;
  character: Character;
  onAnswer: (answer: string) => void;
  rewards: { points: number; badges: string[]; stickers: string[] };
}

export const LessonReflection: React.FC<LessonReflectionProps> = ({
  question,
  character,
  onAnswer,
  rewards
}) => {
  const [answer, setAnswer] = useState('');
  const [showRewards, setShowRewards] = useState(false);

  const handleSubmit = () => {
    if (answer.trim()) {
      onAnswer(answer);
      setShowRewards(true);
    }
  };

  return (
    <Card className="bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2 text-purple-800">
          <Heart className="w-6 h-6" />
          <span>Momento de Reflexión</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <CharacterDialog 
          character={character}
          message={`¡Qué gran trabajo hiciste hoy! ${question}`}
          className="mb-4"
        />

        {!showRewards ? (
          <div className="space-y-4">
            <textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Escribe tu respuesta aquí..."
              className="w-full p-3 border border-gray-300 rounded-lg resize-none h-24"
            />
            <Button onClick={handleSubmit} className="w-full">
              <ArrowRight className="w-4 h-4 mr-2" />
              Compartir mi respuesta
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="text-center">
              <h3 className="text-xl font-bold text-purple-800 mb-4">¡Felicidades!</h3>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
                <div className="text-4xl mb-4">🎉</div>
                <div className="space-y-3">
                  <div className="flex items-center justify-center space-x-2">
                    <Coins className="w-5 h-5 text-yellow-600" />
                    <span className="font-semibold">+{rewards.points} puntos</span>
                  </div>
                  {rewards.badges.length > 0 && (
                    <div className="flex items-center justify-center space-x-2">
                      <Medal className="w-5 h-5 text-blue-600" />
                      <span>Insignias: {rewards.badges.join(', ')}</span>
                    </div>
                  )}
                  {rewards.stickers.length > 0 && (
                    <div className="flex justify-center space-x-2">
                      {rewards.stickers.map((sticker, index) => (
                        <span key={index} className="text-2xl">{sticker}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// Componente para progreso de segmento
interface SegmentProgressProps {
  currentSegment: number;
  totalSegments: number;
  segmentTitles: string[];
}

export const SegmentProgress: React.FC<SegmentProgressProps> = ({
  currentSegment,
  totalSegments,
  segmentTitles
}) => {
  const progress = (currentSegment / totalSegments) * 100;

  return (
    <Card className="bg-gradient-to-r from-indigo-50 to-blue-50 border-indigo-200">
      <CardContent className="p-4">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-indigo-800">
              Progreso de la Lección
            </span>
            <span className="text-sm text-indigo-600">
              {currentSegment}/{totalSegments}
            </span>
          </div>
          <Progress value={progress} className="h-2" />
          <div className="text-xs text-indigo-600">
            Segmento actual: {segmentTitles[currentSegment - 1]}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// New interfaces for step-by-step learning
interface LessonStep {
  id: string;
  type: 'information' | 'activity' | 'comment' | 'reflection';
  title: string;
  content: any;
  character?: Character;
  duration?: number;
  points?: number;
}

interface StepBasedLessonProps {
  steps: LessonStep[];
  onStepComplete: (stepId: string, points?: number) => void;
  onLessonComplete: (score: number, progress: any) => void;
  onExit: () => void;
}

// Component for step-by-step lesson progression
export const StepBasedLesson: React.FC<StepBasedLessonProps> = ({
  steps,
  onStepComplete,
  onLessonComplete,
  onExit
}) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);
  const [totalPoints, setTotalPoints] = useState(0);
  const [lessonProgress, setLessonProgress] = useState({
    startTime: Date.now(),
    stepTimes: [] as number[],
    interactions: 0,
    correctAnswers: 0,
    totalQuestions: 0
  });

  const currentStep = steps[currentStepIndex];
  const progress = (currentStepIndex / steps.length) * 100;

  const handleStepComplete = (points: number = 0) => {
    setCompletedSteps(prev => [...prev, currentStep.id]);
    setTotalPoints(prev => prev + points);
    setLessonProgress(prev => ({
      ...prev,
      stepTimes: [...prev.stepTimes, Date.now()],
      interactions: prev.interactions + 1
    }));
    onStepComplete(currentStep.id, points);
  };

  const nextStep = () => {
    if (currentStepIndex < steps.length - 1) {
      setCurrentStepIndex(prev => prev + 1);
    } else {
      // Lesson completed
      const finalScore = Math.round((totalPoints / (steps.length * 10)) * 100);
      const progress = {
        ...lessonProgress,
        endTime: Date.now(),
        finalScore,
        completedSteps
      };
      onLessonComplete(finalScore, progress);
    }
  };

  const prevStep = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(prev => prev - 1);
    }
  };

  const renderStep = () => {
    switch (currentStep.type) {
      case 'information':
        return (
          <InformationStep
            step={currentStep}
            onNext={nextStep}
            onPrev={prevStep}
            isFirst={currentStepIndex === 0}
            isLast={currentStepIndex === steps.length - 1}
          />
        );
      case 'activity':
        return (
          <ActivityStep
            step={currentStep}
            onComplete={handleStepComplete}
            onNext={nextStep}
            onPrev={prevStep}
            isFirst={currentStepIndex === 0}
            isLast={currentStepIndex === steps.length - 1}
          />
        );
      case 'comment':
        return (
          <CommentStep
            step={currentStep}
            onNext={nextStep}
            onPrev={prevStep}
            isFirst={currentStepIndex === 0}
            isLast={currentStepIndex === steps.length - 1}
          />
        );
      case 'reflection':
        return (
          <ReflectionStep
            step={currentStep}
            onNext={nextStep}
            onPrev={prevStep}
            isFirst={currentStepIndex === 0}
            isLast={currentStepIndex === steps.length - 1}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm text-gray-600">
          <span>Paso {currentStepIndex + 1} de {steps.length}</span>
          <span>{Math.round(progress)}% completado</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      {/* Current Step */}
      {renderStep()}

      {/* Navigation */}
      <div className="flex justify-between items-center pt-4">
        <Button
          variant="outline"
          onClick={onExit}
          className="flex items-center space-x-2"
        >
          <Home className="w-4 h-4" />
          <span>Salir</span>
        </Button>
        
        <div className="flex space-x-2">
          {currentStepIndex > 0 && (
            <Button variant="outline" onClick={prevStep}>
              <ChevronLeft className="w-4 h-4 mr-2" />
              Anterior
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

// Information Step Component
interface InformationStepProps {
  step: LessonStep;
  onNext: () => void;
  onPrev: () => void;
  isFirst: boolean;
  isLast: boolean;
}

const InformationStep: React.FC<InformationStepProps> = ({
  step,
  onNext,
  onPrev,
  isFirst,
  isLast
}) => {
  return (
    <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2 text-blue-800">
          <Lightbulb className="w-6 h-6" />
          <span>{step.title}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {step.character && (
          <CharacterDialog
            character={step.character}
            message={step.content.message}
            className="mb-4"
          />
        )}
        
        <div className="bg-white rounded-lg p-4 border border-blue-200">
          {step.content.content}
        </div>

        <div className="text-center pt-4">
          <Button onClick={onNext} size="lg" className="bg-blue-500 hover:bg-blue-600">
            <ChevronRight className="w-5 h-5 mr-2" />
            Continuar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

// Activity Step Component
interface ActivityStepProps {
  step: LessonStep;
  onComplete: (points: number) => void;
  onNext: () => void;
  onPrev: () => void;
  isFirst: boolean;
  isLast: boolean;
}

const ActivityStep: React.FC<ActivityStepProps> = ({
  step,
  onComplete,
  onNext,
  onPrev,
  isFirst,
  isLast
}) => {
  const [isCompleted, setIsCompleted] = useState(false);
  const [userAnswer, setUserAnswer] = useState<any>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);

  const handleComplete = (answer: any) => {
    setUserAnswer(answer);
    setIsCompleted(true);
    
    // Check if answer is correct (for question activities)
    if (step.content.type === 'question') {
      const correct = answer === step.content.correct;
      setIsCorrect(correct);
      // Only give points for correct answers
      onComplete(correct ? (step.points || 10) : 0);
    } else {
      // For other activity types, give full points
      onComplete(step.points || 10);
    }
  };

  return (
    <Card className="bg-gradient-to-r from-green-50 to-teal-50 border-green-200">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2 text-green-800">
          <Gift className="w-6 h-6" />
          <span>{step.title}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {step.character && (
          <CharacterDialog
            character={step.character}
            message={step.content.description}
            className="mb-4"
          />
        )}

        <div className="min-h-[200px] bg-white rounded-lg p-4 border-2 border-dashed border-green-300">
          {step.content.type === 'question' && (
            <QuestionActivity
              content={step.content}
              onAnswer={handleComplete}
              isCompleted={isCompleted}
            />
          )}
          {step.content.type === 'sorting' && (
            <SortingActivity
              content={step.content}
              onComplete={handleComplete}
              isCompleted={isCompleted}
            />
          )}
          {step.content.type === 'counting' && (
            <CountingActivity
              content={step.content}
              onComplete={handleComplete}
              isCompleted={isCompleted}
            />
          )}
        </div>

        {isCompleted && (
          <div className={`mt-4 p-4 border rounded-lg ${
            isCorrect 
              ? "bg-yellow-50 border-yellow-200" 
              : "bg-orange-50 border-orange-200"
          }`}>
            <div className="flex items-center space-x-2">
              {isCorrect ? (
                <>
                  <Trophy className="w-6 h-6 text-yellow-600" />
                  <span className="font-bold text-yellow-800">¡Excelente trabajo!</span>
                  <Badge className="bg-yellow-100 text-yellow-800">
                    +{step.points || 10} puntos
                  </Badge>
                </>
              ) : (
                <>
                  <Trophy className="w-6 h-6 text-orange-600" />
                  <span className="font-bold text-orange-800">¡Buen intento!</span>
                  <Badge className="bg-orange-100 text-orange-800">
                    +0 puntos
                  </Badge>
                </>
              )}
            </div>
            <div className="text-center pt-4">
              <Button onClick={onNext} size="lg" className="bg-green-500 hover:bg-green-600">
                <ChevronRight className="w-5 h-5 mr-2" />
                Continuar
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// Comment Step Component
interface CommentStepProps {
  step: LessonStep;
  onNext: () => void;
  onPrev: () => void;
  isFirst: boolean;
  isLast: boolean;
}

const CommentStep: React.FC<CommentStepProps> = ({
  step,
  onNext,
  onPrev,
  isFirst,
  isLast
}) => {
  return (
    <Card className="bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2 text-purple-800">
          <Star className="w-6 h-6" />
          <span>{step.title}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {step.character && (
          <CharacterDialog
            character={step.character}
            message={step.content.message}
            className="mb-4"
          />
        )}

        <div className="bg-white rounded-lg p-4 border border-purple-200">
          {step.content.content}
        </div>

        <div className="text-center pt-4">
          <Button onClick={onNext} size="lg" className="bg-purple-500 hover:bg-purple-600">
            <ChevronRight className="w-5 h-5 mr-2" />
            {isLast ? 'Finalizar Lección' : 'Continuar'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

// Reflection Step Component
interface ReflectionStepProps {
  step: LessonStep;
  onNext: () => void;
  onPrev: () => void;
  isFirst: boolean;
  isLast: boolean;
}

const ReflectionStep: React.FC<ReflectionStepProps> = ({
  step,
  onNext,
  onPrev,
  isFirst,
  isLast
}) => {
  const [answer, setAnswer] = useState('');
  const [showRewards, setShowRewards] = useState(false);

  const handleSubmit = () => {
    if (answer.trim()) {
      setShowRewards(true);
    }
  };

  return (
    <Card className="bg-gradient-to-r from-indigo-50 to-purple-50 border-indigo-200">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2 text-indigo-800">
          <Heart className="w-6 h-6" />
          <span>{step.title}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {step.character && (
          <CharacterDialog
            character={step.character}
            message={step.content.message}
            className="mb-4"
          />
        )}

        {!showRewards ? (
          <div className="space-y-4">
            <div className="bg-white rounded-lg p-4 border border-indigo-200">
              <h3 className="text-lg font-semibold text-indigo-800 mb-3">
                {step.content.question}
              </h3>
              <textarea
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="Escribe tu respuesta aquí..."
                className="w-full p-3 border border-gray-300 rounded-lg resize-none h-24 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400"
              />
            </div>
            <div className="text-center">
              <Button onClick={handleSubmit} size="lg" className="bg-indigo-500 hover:bg-indigo-600">
                <ArrowRight className="w-5 h-5 mr-2" />
                Compartir mi respuesta
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="text-center">
              <h3 className="text-xl font-bold text-indigo-800 mb-4">¡Felicidades!</h3>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
                <div className="text-4xl mb-4">🎉</div>
                <div className="space-y-3">
                  <div className="flex items-center justify-center space-x-2">
                    <Coins className="w-5 h-5 text-yellow-600" />
                    <span className="font-semibold">+{step.content.rewards.points} puntos</span>
                  </div>
                  {step.content.rewards.badges.length > 0 && (
                    <div className="flex items-center justify-center space-x-2">
                      <Medal className="w-5 h-5 text-blue-600" />
                      <span>Insignias: {step.content.rewards.badges.join(', ')}</span>
                    </div>
                  )}
                  {step.content.rewards.stickers.length > 0 && (
                    <div className="flex justify-center space-x-2">
                      {step.content.rewards.stickers.map((sticker: string, index: number) => (
                        <span key={index} className="text-2xl">{sticker}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="text-center">
              <Button onClick={onNext} size="lg" className="bg-indigo-500 hover:bg-indigo-600">
                <ChevronRight className="w-5 h-5 mr-2" />
                Finalizar Lección
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
