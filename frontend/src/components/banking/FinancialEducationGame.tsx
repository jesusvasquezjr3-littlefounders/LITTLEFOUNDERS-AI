import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { 
  Gamepad2, 
  Trophy, 
  Star,
  Target,
  BookOpen,
  CheckCircle,
  XCircle,
  ArrowRight,
  RotateCcw,
  Zap,
  Brain,
  Gift,
  PiggyBank,
  TrendingUp,
  DollarSign,
  Clock
} from "lucide-react";

interface GameQuestion {
  id: string;
  type: 'multiple-choice' | 'true-false' | 'scenario' | 'calculation';
  category: 'saving' | 'spending' | 'earning' | 'investing' | 'budgeting';
  difficulty: 'easy' | 'medium' | 'hard';
  question: string;
  options?: string[];
  correctAnswer: string | number;
  explanation: string;
  points: number;
}

interface GameLevel {
  id: string;
  name: string;
  description: string;
  requiredPoints: number;
  unlocked: boolean;
  completed: boolean;
  questions: GameQuestion[];
  badge: string;
}

const gameQuestions: GameQuestion[] = [
  {
    id: "1",
    type: "multiple-choice",
    category: "saving",
    difficulty: "easy",
    question: "¿Cuál es la mejor manera de ahorrar dinero?",
    options: [
      "Gastar todo lo que gano",
      "Guardar una parte de cada dinero que recibo",
      "Solo ahorrar cuando me sobra mucho dinero",
      "Pedir dinero prestado a mis padres"
    ],
    correctAnswer: "Guardar una parte de cada dinero que recibo",
    explanation: "La mejor estrategia es ahorrar un porcentaje fijo de cada ingreso que recibas, aunque sea pequeño. ¡La constancia es clave!",
    points: 10
  },
  {
    id: "2",
    type: "scenario",
    category: "spending",
    difficulty: "medium",
    question: "Tienes $20 y quieres comprar un juego de $15 y dulces de $8. ¿Qué deberías hacer?",
    options: [
      "Comprar ambos usando dinero de emergencia",
      "Comprar solo el juego y ahorrar $5",
      "Comprar solo los dulces y ahorrar $12",
      "No comprar nada y ahorrar todo"
    ],
    correctAnswer: "Comprar solo el juego y ahorrar $5",
    explanation: "Es mejor comprar la cosa más importante (el juego) y guardar el resto. Los dulces son un capricho que puedes posponer.",
    points: 15
  },
  {
    id: "3",
    type: "calculation",
    category: "saving",
    difficulty: "medium",
    question: "Si ahorras $5 cada semana, ¿cuánto dinero tendrás después de 2 meses?",
    correctAnswer: 40,
    explanation: "2 meses = 8 semanas. $5 × 8 semanas = $40. ¡Ahorrar poco pero constante da grandes resultados!",
    points: 20
  },
  {
    id: "4",
    type: "true-false",
    category: "investing",
    difficulty: "hard",
    question: "El dinero siempre vale lo mismo a través del tiempo",
    correctAnswer: "false",
    explanation: "Falso. El dinero puede perder valor por la inflación. Por eso es importante hacer que nuestro dinero crezca a través del ahorro e inversión.",
    points: 25
  },
  {
    id: "5",
    type: "multiple-choice",
    category: "earning",
    difficulty: "easy",
    question: "¿Cuáles son formas de ganar dinero siendo niño?",
    options: [
      "Solo pedirlo a los padres",
      "Hacer tareas domésticas, vender limonada, cuidar mascotas",
      "Encontrarlo en la calle",
      "Tomarlo prestado sin permiso"
    ],
    correctAnswer: "Hacer tareas domésticas, vender limonada, cuidar mascotas",
    explanation: "¡Hay muchas formas creativas de ganar dinero! Lo importante es trabajar por él de manera honesta y segura.",
    points: 10
  }
];

const gameLevels: GameLevel[] = [
  {
    id: "1",
    name: "Explorador Financiero",
    description: "Aprende los conceptos básicos sobre el dinero",
    requiredPoints: 0,
    unlocked: true,
    completed: false,
    questions: gameQuestions.filter(q => q.difficulty === 'easy'),
    badge: "🏅"
  },
  {
    id: "2",
    name: "Ahorrador Inteligente",
    description: "Domina las estrategias de ahorro y gasto responsable",
    requiredPoints: 50,
    unlocked: false,
    completed: false,
    questions: gameQuestions.filter(q => q.difficulty === 'medium'),
    badge: "🎯"
  },
  {
    id: "3",
    name: "Maestro del Dinero",
    description: "Conceptos avanzados de inversión y planificación",
    requiredPoints: 150,
    unlocked: false,
    completed: false,
    questions: gameQuestions.filter(q => q.difficulty === 'hard'),
    badge: "👑"
  }
];

interface UserProgress {
  totalPoints: number;
  currentStreak: number;
  completedLevels: string[];
  unlockedLevels: string[];
  achievements: string[];
}

const achievements = [
  { id: 'first-correct', name: 'Primera Respuesta Correcta', icon: '🎉', description: 'Respondiste tu primera pregunta correctamente' },
  { id: 'streak-5', name: 'Racha de 5', icon: '🔥', description: 'Respondiste 5 preguntas seguidas correctamente' },
  { id: 'level-1', name: 'Nivel 1 Completado', icon: '⭐', description: 'Completaste el primer nivel' },
  { id: 'saving-master', name: 'Maestro del Ahorro', icon: '🐷', description: 'Respondiste todas las preguntas de ahorro correctamente' },
  { id: 'quick-learner', name: 'Aprendiz Rápido', icon: '⚡', description: 'Completaste un nivel en menos de 5 minutos' }
];

export function FinancialEducationGame() {
  const [userProgress, setUserProgress] = useState<UserProgress>({
    totalPoints: 75,
    currentStreak: 2,
    completedLevels: ['1'],
    unlockedLevels: ['1', '2'],
    achievements: ['first-correct', 'level-1']
  });

  const [levels, setLevels] = useState<GameLevel[]>(gameLevels);
  const [currentGame, setCurrentGame] = useState<{
    levelId: string;
    questionIndex: number;
    questions: GameQuestion[];
    answers: (string | number)[];
    startTime: number;
  } | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<string | number>("");
  const [showResult, setShowResult] = useState<boolean>(false);
  const [isCorrect, setIsCorrect] = useState<boolean>(false);

  useEffect(() => {
    // Update level unlock status based on points
    setLevels(levels.map(level => ({
      ...level,
      unlocked: userProgress.totalPoints >= level.requiredPoints || userProgress.unlockedLevels.includes(level.id),
      completed: userProgress.completedLevels.includes(level.id)
    })));
  }, [userProgress]);

  const startLevel = (levelId: string) => {
    const level = levels.find(l => l.id === levelId);
    if (!level || !level.unlocked) return;

    setCurrentGame({
      levelId: levelId,
      questionIndex: 0,
      questions: level.questions,
      answers: [],
      startTime: Date.now()
    });
    setSelectedAnswer("");
    setShowResult(false);
  };

  const submitAnswer = () => {
    if (!currentGame || selectedAnswer === "") return;

    const currentQuestion = currentGame.questions[currentGame.questionIndex];
    const correct = selectedAnswer === currentQuestion.correctAnswer;
    
    setIsCorrect(correct);
    setShowResult(true);

    // Update progress
    if (correct) {
      setUserProgress(prev => ({
        ...prev,
        totalPoints: prev.totalPoints + currentQuestion.points,
        currentStreak: prev.currentStreak + 1
      }));
    } else {
      setUserProgress(prev => ({
        ...prev,
        currentStreak: 0
      }));
    }
  };

  const nextQuestion = () => {
    if (!currentGame) return;

    const newAnswers = [...currentGame.answers, selectedAnswer];
    
    if (currentGame.questionIndex < currentGame.questions.length - 1) {
      // Continue to next question
      setCurrentGame({
        ...currentGame,
        questionIndex: currentGame.questionIndex + 1,
        answers: newAnswers
      });
      setSelectedAnswer("");
      setShowResult(false);
    } else {
      // Level completed
      const correctAnswers = newAnswers.filter((answer, index) => 
        answer === currentGame.questions[index].correctAnswer
      ).length;
      
      const levelCompleted = correctAnswers >= currentGame.questions.length * 0.7; // 70% to pass
      
      if (levelCompleted) {
        setUserProgress(prev => ({
          ...prev,
          completedLevels: [...prev.completedLevels, currentGame.levelId],
          unlockedLevels: prev.totalPoints >= 150 ? ['1', '2', '3'] : ['1', '2']
        }));
      }
      
      setCurrentGame(null);
      setShowResult(false);
    }
  };

  const resetGame = () => {
    setCurrentGame(null);
    setSelectedAnswer("");
    setShowResult(false);
  };

  const renderQuestion = (question: GameQuestion) => {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <Badge className="mb-4">
            {question.category === 'saving' ? '💰 Ahorro' :
             question.category === 'spending' ? '🛍️ Gasto' :
             question.category === 'earning' ? '💼 Ganar Dinero' :
             question.category === 'investing' ? '📈 Inversión' : '📊 Presupuesto'}
          </Badge>
          <h3 className="text-xl font-semibold mb-2">{question.question}</h3>
        </div>

        {question.type === 'multiple-choice' && question.options && (
          <div className="space-y-3">
            {question.options.map((option, index) => (
              <button
                key={index}
                onClick={() => setSelectedAnswer(option)}
                className={`w-full p-4 text-left rounded-lg border-2 transition-all ${
                  selectedAnswer === option 
                    ? 'border-primary bg-primary/10 text-primary' 
                    : 'border-muted hover:border-primary/50'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <div className={`w-4 h-4 rounded-full border-2 ${
                    selectedAnswer === option ? 'bg-primary border-primary' : 'border-muted'
                  }`} />
                  <span>{option}</span>
                </div>
              </button>
            ))}
          </div>
        )}

        {question.type === 'true-false' && (
          <div className="flex space-x-4">
            <button
              onClick={() => setSelectedAnswer("true")}
              className={`flex-1 p-6 rounded-lg border-2 transition-all ${
                selectedAnswer === "true" 
                  ? 'border-green-500 bg-green-50 text-green-700' 
                  : 'border-muted hover:border-green-300'
              }`}
            >
              <CheckCircle className="h-8 w-8 mx-auto mb-2" />
              <div className="text-center font-semibold">Verdadero</div>
            </button>
            <button
              onClick={() => setSelectedAnswer("false")}
              className={`flex-1 p-6 rounded-lg border-2 transition-all ${
                selectedAnswer === "false" 
                  ? 'border-red-500 bg-red-50 text-red-700' 
                  : 'border-muted hover:border-red-300'
              }`}
            >
              <XCircle className="h-8 w-8 mx-auto mb-2" />
              <div className="text-center font-semibold">Falso</div>
            </button>
          </div>
        )}

        {question.type === 'calculation' && (
          <div className="text-center">
            <input
              type="number"
              value={selectedAnswer}
              onChange={(e) => setSelectedAnswer(parseInt(e.target.value) || 0)}
              className="w-32 p-4 text-center text-2xl font-bold border-2 border-primary rounded-lg"
              placeholder="?"
            />
            <div className="text-sm text-muted-foreground mt-2">
              Escribe tu respuesta (solo números)
            </div>
          </div>
        )}

        {question.type === 'scenario' && question.options && (
          <div className="space-y-3">
            {question.options.map((option, index) => (
              <button
                key={index}
                onClick={() => setSelectedAnswer(option)}
                className={`w-full p-4 text-left rounded-lg border-2 transition-all ${
                  selectedAnswer === option 
                    ? 'border-primary bg-primary/10 text-primary' 
                    : 'border-muted hover:border-primary/50'
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  if (currentGame) {
    const currentQuestion = currentGame.questions[currentGame.questionIndex];
    const progress = ((currentGame.questionIndex + 1) / currentGame.questions.length) * 100;

    return (
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Pregunta {currentGame.questionIndex + 1} de {currentGame.questions.length}</CardTitle>
                <CardDescription>+{currentQuestion.points} puntos</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={resetGame}>
                <XCircle className="h-4 w-4 mr-2" />
                Salir
              </Button>
            </div>
            <Progress value={progress} className="mt-4" />
          </CardHeader>
          <CardContent>
            {!showResult ? (
              <div className="space-y-6">
                {renderQuestion(currentQuestion)}
                <Button 
                  onClick={submitAnswer}
                  disabled={selectedAnswer === ""}
                  className="w-full"
                >
                  Enviar Respuesta
                </Button>
              </div>
            ) : (
              <div className="text-center space-y-6">
                <div className={`text-6xl ${isCorrect ? 'text-green-600' : 'text-red-600'}`}>
                  {isCorrect ? '🎉' : '😔'}
                </div>
                <div>
                  <h3 className={`text-2xl font-bold ${isCorrect ? 'text-green-600' : 'text-red-600'}`}>
                    {isCorrect ? '¡Correcto!' : 'Incorrecto'}
                  </h3>
                  {isCorrect && <p className="text-green-600">+{currentQuestion.points} puntos</p>}
                </div>
                <div className="p-4 bg-blue-50 rounded-lg">
                  <p className="text-sm"><strong>Explicación:</strong></p>
                  <p>{currentQuestion.explanation}</p>
                </div>
                <Button onClick={nextQuestion} className="w-full">
                  {currentGame.questionIndex < currentGame.questions.length - 1 ? (
                    <>
                      Siguiente Pregunta
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </>
                  ) : (
                    'Ver Resultados'
                  )}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-3xl font-bold mb-2">🎮 Academia Financiera</h2>
        <p className="text-muted-foreground">
          Aprende sobre finanzas jugando y gana puntos por cada respuesta correcta
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-yellow-100 rounded-full">
                <Star className="h-6 w-6 text-yellow-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-yellow-600">
                  {userProgress.totalPoints}
                </div>
                <div className="text-sm text-muted-foreground">Puntos totales</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-orange-100 rounded-full">
                <Zap className="h-6 w-6 text-orange-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-orange-600">
                  {userProgress.currentStreak}
                </div>
                <div className="text-sm text-muted-foreground">Racha actual</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-green-100 rounded-full">
                <Trophy className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">
                  {userProgress.completedLevels.length}
                </div>
                <div className="text-sm text-muted-foreground">Niveles completados</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Levels */}
      <div className="space-y-4">
        <h3 className="text-xl font-semibold">Niveles Disponibles</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {levels.map((level) => (
            <Card key={level.id} className={`relative ${
              level.completed ? 'bg-green-50 border-green-200' :
              level.unlocked ? 'hover:shadow-lg transition-shadow cursor-pointer' : 
              'opacity-50'
            }`}>
              {level.completed && (
                <div className="absolute -top-2 -right-2 bg-green-500 text-white rounded-full p-2">
                  <CheckCircle className="h-4 w-4" />
                </div>
              )}
              <CardHeader>
                <div className="text-center">
                  <div className="text-4xl mb-2">{level.badge}</div>
                  <CardTitle className="text-lg">{level.name}</CardTitle>
                  <CardDescription>{level.description}</CardDescription>
                </div>
                <div className="text-center space-y-2">
                  <div className="text-sm text-muted-foreground">
                    {level.questions.length} preguntas • {level.questions.reduce((sum, q) => sum + q.points, 0)} puntos máximos
                  </div>
                  {!level.unlocked && (
                    <Badge variant="secondary">
                      Requiere {level.requiredPoints} puntos
                    </Badge>
                  )}
                  {level.completed && (
                    <Badge className="bg-green-500">
                      ✅ Completado
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <Button 
                  onClick={() => startLevel(level.id)}
                  disabled={!level.unlocked}
                  className="w-full"
                  variant={level.completed ? "outline" : "default"}
                >
                  {level.completed ? 'Jugar de Nuevo' : 
                   level.unlocked ? 'Comenzar Nivel' : 
                   'Bloqueado'}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Achievements */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Trophy className="h-5 w-5" />
            <span>Logros</span>
          </CardTitle>
          <CardDescription>
            Desbloquea logros completando desafíos especiales
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {achievements.map((achievement) => (
              <div key={achievement.id} className={`p-4 rounded-lg border ${
                userProgress.achievements.includes(achievement.id) 
                  ? 'bg-yellow-50 border-yellow-200' 
                  : 'bg-muted border-muted'
              }`}>
                <div className="flex items-center space-x-3">
                  <div className="text-2xl">{achievement.icon}</div>
                  <div>
                    <div className={`font-semibold ${
                      userProgress.achievements.includes(achievement.id) ? 'text-yellow-700' : 'text-muted-foreground'
                    }`}>
                      {achievement.name}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {achievement.description}
                    </div>
                  </div>
                  {userProgress.achievements.includes(achievement.id) && (
                    <CheckCircle className="h-5 w-5 text-yellow-600" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Daily Challenge */}
      <Card className="bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Target className="h-5 w-5 text-purple-600" />
            <span>Desafío Diario</span>
          </CardTitle>
          <CardDescription>
            ¡Completa el desafío del día para ganar puntos extra!
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-semibold">Maestro del Presupuesto</h4>
              <p className="text-sm text-muted-foreground">
                Responde 5 preguntas sobre presupuesto correctamente
              </p>
              <div className="flex items-center space-x-2 mt-2">
                <Progress value={60} className="flex-1" />
                <span className="text-sm">3/5</span>
              </div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-purple-600">+50 pts</div>
              <Button size="sm" className="mt-2">
                Continuar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}




