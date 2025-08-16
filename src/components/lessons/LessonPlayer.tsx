import React, { useState, useEffect } from 'react';
import Lesson1_1_WhatIsMoney from './Lesson1_1_WhatIsMoney';
import Lesson1_2_WhereMoneyComesFrom from './Lesson1_2_WhereMoneyComesFrom';
import Lesson1_3_NeedsVsWants from './Lesson1_3_NeedsVsWants';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Trophy, 
  Star, 
  Award, 
  CheckCircle,
  PlayCircle,
  Clock,
  ArrowLeft,
  Home
} from 'lucide-react';

interface LessonProgress {
  lessonId: string;
  score: number;
  completed: boolean;
  completedAt: Date;
  timeSpent: number;
  progressData: any;
}

interface LessonPlayerProps {
  initialLessonId?: string;
  onExit: () => void;
  userProgress?: LessonProgress[];
  onProgressUpdate: (progress: LessonProgress) => void;
}

const LessonPlayer: React.FC<LessonPlayerProps> = ({
  initialLessonId,
  onExit,
  userProgress = [],
  onProgressUpdate
}) => {
  const [currentLessonId, setCurrentLessonId] = useState<string | null>(initialLessonId || null);
  const [completedLessons, setCompletedLessons] = useState<LessonProgress[]>(userProgress);
  const [showCelebration, setShowCelebration] = useState(false);
  const [lastCompletedLesson, setLastCompletedLesson] = useState<LessonProgress | null>(null);

  // Datos de las lecciones disponibles
  const lessons = [
    {
      id: '1.1',
      title: '¿Qué es el Dinero?',
      description: 'Descubre qué es el dinero y cómo reconocer monedas y billetes',
      duration: '30 min',
      difficulty: 'Fácil',
      component: Lesson1_1_WhatIsMoney,
      emoji: '💰',
      unlocked: true
    },
    {
      id: '1.2',
      title: 'De Dónde Viene el Dinero',
      description: 'Aprende sobre el trabajo y cómo las personas ganan dinero',
      duration: '25 min',
      difficulty: 'Fácil',
      component: Lesson1_2_WhereMoneyComesFrom,
      emoji: '💼',
      unlocked: completedLessons.some(p => p.lessonId === '1.1')
    },
    {
      id: '1.3',
      title: 'Necesidades vs Deseos',
      description: 'Distingue entre lo que necesitas y lo que quieres',
      duration: '35 min',
      difficulty: 'Fácil',
      component: Lesson1_3_NeedsVsWants,
      emoji: '🛒',
      unlocked: completedLessons.some(p => p.lessonId === '1.2')
    }
  ];

  const handleLessonComplete = (lessonId: string, score: number, progressData: any) => {
    const newProgress: LessonProgress = {
      lessonId,
      score,
      completed: true,
      completedAt: new Date(),
      timeSpent: progressData.endTime - progressData.startTime,
      progressData
    };

    setCompletedLessons(prev => {
      const filtered = prev.filter(p => p.lessonId !== lessonId);
      return [...filtered, newProgress];
    });

    setLastCompletedLesson(newProgress);
    setShowCelebration(true);
    onProgressUpdate(newProgress);

    // Auto-avanzar a la siguiente lección después de 3 segundos
    setTimeout(() => {
      setShowCelebration(false);
      const nextLessonIndex = lessons.findIndex(l => l.id === lessonId) + 1;
      if (nextLessonIndex < lessons.length) {
        setCurrentLessonId(lessons[nextLessonIndex].id);
      } else {
        setCurrentLessonId(null); // Volver al menú principal
      }
    }, 3000);
  };

  const handleLessonExit = () => {
    setCurrentLessonId(null);
  };

  const startLesson = (lessonId: string) => {
    setCurrentLessonId(lessonId);
  };

  const getLessonProgress = (lessonId: string) => {
    return completedLessons.find(p => p.lessonId === lessonId);
  };

  const getTotalPoints = () => {
    return completedLessons.reduce((total, lesson) => total + lesson.score, 0);
  };

  const getCompletionPercentage = () => {
    const completedCount = completedLessons.length;
    return Math.round((completedCount / lessons.length) * 100);
  };

  // Mostrar celebración cuando se completa una lección
  if (showCelebration && lastCompletedLesson) {
    return (
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        <div className="text-center space-y-6">
          <div className="text-8xl animate-bounce">🎉</div>
          <h1 className="text-4xl font-bold text-yellow-600">¡Felicidades!</h1>
          <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200 rounded-lg p-6">
            <h2 className="text-2xl font-bold text-yellow-800 mb-4">
              ¡Completaste la lección!
            </h2>
            <div className="space-y-3">
              <div className="flex items-center justify-center space-x-4">
                <Trophy className="w-8 h-8 text-yellow-600" />
                <span className="text-xl font-bold">Puntuación: {lastCompletedLesson.score}/100</span>
              </div>
              <div className="flex items-center justify-center space-x-4">
                <Clock className="w-6 h-6 text-blue-600" />
                <span>Tiempo: {Math.round(lastCompletedLesson.timeSpent / 1000 / 60)} minutos</span>
              </div>
            </div>
          </div>
          <p className="text-lg text-gray-600">
            Preparándote para la siguiente aventura...
          </p>
        </div>
      </div>
    );
  }

  // Mostrar lección actual
  if (currentLessonId) {
    const lesson = lessons.find(l => l.id === currentLessonId);
    if (lesson) {
      const LessonComponent = lesson.component;
      return (
        <LessonComponent
          onComplete={(score, progress) => handleLessonComplete(lesson.id, score, progress)}
          onExit={handleLessonExit}
        />
      );
    }
  }

  // Mostrar menú de lecciones
  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="outline" onClick={onExit}>
            <Home className="w-4 h-4 mr-2" />
            Volver al Dashboard
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Exploradores Financieros</h1>
            <p className="text-gray-600">Nivel 1: Primeros Pasos con el Dinero</p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-blue-600">🏆 {getTotalPoints()} puntos</div>
          <div className="text-sm text-gray-600">
            {completedLessons.length}/{lessons.length} lecciones completadas
          </div>
        </div>
      </div>

      {/* Progreso general */}
      <Card className="bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Trophy className="w-6 h-6 text-yellow-600" />
            <span>Tu Progreso en Exploradores Financieros</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-lg font-medium">Progreso General</span>
              <span className="text-2xl font-bold text-blue-600">
                {getCompletionPercentage()}%
              </span>
            </div>
            <Progress value={getCompletionPercentage()} className="h-3" />
            <div className="grid grid-cols-3 gap-4 text-center text-sm">
              <div>
                <div className="font-bold text-green-600">{completedLessons.length}</div>
                <div className="text-gray-600">Completadas</div>
              </div>
              <div>
                <div className="font-bold text-yellow-600">{getTotalPoints()}</div>
                <div className="text-gray-600">Puntos Totales</div>
              </div>
              <div>
                <div className="font-bold text-blue-600">
                  {Math.round(completedLessons.reduce((sum, l) => sum + l.timeSpent, 0) / 1000 / 60)}
                </div>
                <div className="text-gray-600">Minutos Aprendiendo</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de lecciones */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {lessons.map((lesson) => {
          const progress = getLessonProgress(lesson.id);
          const isUnlocked = lesson.unlocked || lesson.id === '1.1';
          
          return (
            <Card 
              key={lesson.id} 
              className={`transition-all duration-200 hover:shadow-lg ${
                !isUnlocked ? 'opacity-60 grayscale' : ''
              } ${progress?.completed ? 'ring-2 ring-green-400 bg-green-50' : ''}`}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center text-2xl ${
                      progress?.completed 
                        ? 'bg-green-100' 
                        : isUnlocked 
                          ? 'bg-blue-100'
                          : 'bg-gray-100'
                    }`}>
                      {progress?.completed ? '✅' : lesson.emoji}
                    </div>
                    <div>
                      <CardTitle className="text-lg">Lección {lesson.id}</CardTitle>
                      <h3 className="font-semibold text-gray-900">{lesson.title}</h3>
                    </div>
                  </div>
                  <Badge 
                    variant="outline" 
                    className={
                      lesson.difficulty === 'Fácil' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-yellow-100 text-yellow-800'
                    }
                  >
                    {lesson.difficulty}
                  </Badge>
                </div>
                <p className="text-gray-600 text-sm">{lesson.description}</p>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {progress?.completed && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-green-800">Completada</span>
                        <div className="flex items-center space-x-2">
                          <Star className="w-4 h-4 text-yellow-500" />
                          <span className="font-bold">{progress.score}/100</span>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <div className="flex items-center justify-between text-sm text-gray-500">
                    <div className="flex items-center space-x-2">
                      <Clock className="w-4 h-4" />
                      <span>{lesson.duration}</span>
                    </div>
                  </div>
                  
                  <Button 
                    className="w-full"
                    disabled={!isUnlocked}
                    onClick={() => startLesson(lesson.id)}
                  >
                    {progress?.completed ? (
                      <>
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Repasar
                      </>
                    ) : !isUnlocked ? (
                      <>
                        🔒 Bloqueada
                      </>
                    ) : (
                      <>
                        <PlayCircle className="w-4 h-4 mr-2" />
                        Comenzar
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Mensaje motivacional */}
      {completedLessons.length === 0 && (
        <Card className="bg-gradient-to-r from-yellow-50 to-orange-50 border-yellow-200">
          <CardContent className="p-6 text-center">
            <div className="text-4xl mb-4">🌟</div>
            <h3 className="text-xl font-bold text-orange-800 mb-2">
              ¡Comienza tu Aventura Financiera!
            </h3>
            <p className="text-orange-700">
              Únete a Lucas, Sol, Mila y Max en emocionantes aventuras donde aprenderás 
              todo sobre el dinero de manera divertida e interactiva.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Certificado virtual si completa todo */}
      {completedLessons.length === lessons.length && (
        <Card className="bg-gradient-to-r from-yellow-50 via-orange-50 to-red-50 border-yellow-300">
          <CardContent className="p-6 text-center">
            <div className="text-6xl mb-4">🏆</div>
            <h3 className="text-2xl font-bold text-yellow-800 mb-2">
              ¡Explorador Financiero Certificado!
            </h3>
            <p className="text-yellow-700 mb-4">
              Has completado todas las lecciones del Nivel 1. 
              ¡Ahora entiendes los conceptos básicos del dinero!
            </p>
            <div className="flex justify-center">
              <Badge className="bg-yellow-100 text-yellow-800 text-lg px-4 py-2">
                <Award className="w-5 h-5 mr-2" />
                Certificado Ganado
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default LessonPlayer;
