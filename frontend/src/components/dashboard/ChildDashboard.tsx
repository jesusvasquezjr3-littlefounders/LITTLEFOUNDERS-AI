import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  BookOpen,
  Clock,
  Star,
  Trophy,
  Target,
  TrendingUp,
  Play,
  Award,
  Zap,
  Heart,
  CreditCard,
  Lightbulb
} from "lucide-react";
import { Link } from "react-router-dom";

interface ChildDashboardProps {
  user: any;
}

export function ChildDashboard({ user }: ChildDashboardProps) {
  const [currentStreak, setCurrentStreak] = useState(5);
  const [weeklyGoal, setWeeklyGoal] = useState(3);
  const [weeklyProgress, setWeeklyProgress] = useState(2);

  const stats = [
    {
      title: "Lecciones Completadas",
      value: user?.lessons_completed || 0,
      lottieSrc: "https://lottie.host/fd6ae247-34b4-4c56-9b11-f2f3687210a5/ydEAxkmQs0.lottie",
      color: "text-blue-600",
      bgColor: "bg-blue-50",
      description: "¡Sigue así!"
    },
    {
      title: "Minutos Estudiados",
      value: user?.minutes_studied || 0,
      lottieSrc: "https://lottie.host/1452b96d-4f8d-4b34-b1ed-88a5e16ff3c3/oM0u7NQXQy.lottie",
      color: "text-green-600",
      bgColor: "bg-green-50",
      description: "Tiempo bien invertido"
    },
    {
      title: "Puntos Ganados",
      value: user?.points_earned || 0,
      lottieSrc: "https://lottie.host/670784f8-65c7-4b8b-a506-3da5403c7a3f/bpw4bs7R0M.lottie",
      color: "text-yellow-600",
      bgColor: "bg-yellow-50",
      description: "¡Eres un experto!"
    },
    {
      title: "Racha Actual",
      value: currentStreak,
      lottieSrc: "https://lottie.host/3edaf8fb-44e9-43da-b623-1836120273cf/9pmK4xn6MU.lottie",
      color: "text-purple-600",
      bgColor: "bg-purple-50",
      description: "¡Días seguidos!"
    }
  ];

  const achievements = [
    {
      title: "Primera Lección",
      description: "Completaste tu primera lección",
      icon: Trophy,
      unlocked: user?.lessons_completed >= 1,
      color: "text-yellow-600"
    },
    {
      title: "Estudiante Dedicado",
      description: "Estudiaste 60 minutos",
      icon: Clock,
      unlocked: user?.minutes_studied >= 60,
      color: "text-blue-600"
    },
    {
      title: "Puntos Dorados",
      description: "Ganaste 100 puntos",
      icon: Star,
      unlocked: user?.points_earned >= 100,
      color: "text-yellow-600"
    },
    {
      title: "Racha de 7 Días",
      description: "7 días seguidos estudiando",
      icon: Zap,
      unlocked: currentStreak >= 7,
      color: "text-purple-600"
    }
  ];

  const nextLessons = [
    {
      title: "¿Qué es el Dinero?",
      difficulty: "Fácil",
      duration: "15 min",
      points: 50,
      completed: false
    },
    {
      title: "Ahorrar es Divertido",
      difficulty: "Fácil",
      duration: "20 min",
      points: 75,
      completed: false
    },
    {
      title: "Necesidades vs Deseos",
      difficulty: "Medio",
      duration: "25 min",
      points: 100,
      completed: false
    }
  ];

  return (
    <div className="space-y-6 p-6">
      {/* Welcome Header */}
      <div className="text-center space-y-2">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
          ¡Hola, {user?.name}! 👋
        </h1>
        <p className="text-lg text-muted-foreground">
          ¡Prepárate para una nueva aventura de aprendizaje!
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, index) => (
          <Card key={index} className="border-2 border-transparent hover:border-primary/20 transition-all overflow-hidden relative">
            <CardContent className="p-6">
              <div className="flex flex-col items-center text-center space-y-2 relative z-10">
                <div className={`p-2 rounded-full ${stat.bgColor} mb-2`}>
                  {/* @ts-ignore */}
                  <dotlottie-wc
                    src={stat.lottieSrc}
                    style={{ width: '120px', height: '120px' }}
                    autoplay
                    loop
                  ></dotlottie-wc>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{stat.title}</p>
                  <p className="text-3xl font-bold my-1">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.description}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Weekly Goal Progress */}
      <Card className="border-2 border-blue-200 bg-gradient-to-r from-blue-50 to-purple-50">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2 text-blue-800">
            <Target className="h-5 w-5" />
            <span>Meta Semanal</span>
          </CardTitle>
          <CardDescription>
            {weeklyProgress} de {weeklyGoal} lecciones completadas esta semana
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Progress value={(weeklyProgress / weeklyGoal) * 100} className="h-3" />
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Progreso</span>
              <span className="font-medium">{Math.round((weeklyProgress / weeklyGoal) * 100)}%</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Next Lessons */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Play className="h-5 w-5 text-green-600" />
              <span>Próximas Lecciones</span>
            </CardTitle>
            <CardDescription>
              ¡Continúa tu aprendizaje con estas lecciones emocionantes!
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {nextLessons.map((lesson, index) => (
              <div key={index} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                <div className="flex-1">
                  <h4 className="font-medium">{lesson.title}</h4>
                  <div className="flex items-center space-x-4 mt-1">
                    <Badge variant="outline" className="text-xs">
                      {lesson.difficulty}
                    </Badge>
                    <span className="text-sm text-muted-foreground flex items-center">
                      <Clock className="h-3 w-3 mr-1" />
                      {lesson.duration}
                    </span>
                    <span className="text-sm text-muted-foreground flex items-center">
                      <Star className="h-3 w-3 mr-1" />
                      {lesson.points} pts
                    </span>
                  </div>
                </div>
                <Button size="sm" className="bg-gradient-to-r from-green-500 to-blue-500 hover:opacity-90">
                  <Play className="h-4 w-4 mr-1" />
                  Empezar
                </Button>
              </div>
            ))}
            <Button asChild className="w-full mt-4 bg-gradient-to-r from-primary to-purple-600">
              <Link to="/lecciones">
                Ver Todas las Lecciones
              </Link>
            </Button>
          </CardContent>
        </Card>

        {/* Achievements */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Award className="h-5 w-5 text-yellow-600" />
              <span>Logros</span>
            </CardTitle>
            <CardDescription>
              ¡Desbloquea logros especiales mientras aprendes!
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {achievements.map((achievement, index) => (
              <div key={index} className={`flex items-center space-x-4 p-3 rounded-lg border-2 transition-all ${achievement.unlocked
                ? 'border-green-200 bg-green-50'
                : 'border-gray-200 bg-gray-50'
                }`}>
                <div className={`p-2 rounded-full ${achievement.unlocked ? 'bg-green-100' : 'bg-gray-100'
                  }`}>
                  <achievement.icon className={`h-5 w-5 ${achievement.unlocked ? achievement.color : 'text-gray-400'
                    }`} />
                </div>
                <div className="flex-1">
                  <h4 className={`font-medium ${achievement.unlocked ? 'text-green-800' : 'text-gray-500'
                    }`}>
                    {achievement.title}
                  </h4>
                  <p className={`text-sm ${achievement.unlocked ? 'text-green-600' : 'text-gray-400'
                    }`}>
                    {achievement.description}
                  </p>
                </div>
                {achievement.unlocked && (
                  <Badge className="bg-green-100 text-green-800 border-green-200">
                    ¡Logrado!
                  </Badge>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Explore Features Section */}
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-white px-1">Explora las Funcionalidades 🚀</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Interactive Lessons Card */}
          <Link to="/lecciones" className="group relative overflow-hidden rounded-2xl transition-all duration-300 hover:scale-105 hover:shadow-xl">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-400 to-blue-600"></div>
            <div className="relative p-6 flex flex-col items-center justify-center h-48 text-center space-y-3">
              <div className="p-4 bg-white/20 backdrop-blur-sm rounded-full shadow-inner group-hover:scale-110 transition-transform duration-300">
                <BookOpen className="h-10 w-10 text-white" />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-white mb-1">Aprender</h3>
                <p className="text-blue-100 font-medium text-sm">Lecciones Interactivas</p>
              </div>
            </div>
          </Link>

          {/* Lemonade Stand Card */}
          <Link to="/investment-games" className="group relative overflow-hidden rounded-2xl transition-all duration-300 hover:scale-105 hover:shadow-xl">
            <div className="absolute inset-0 bg-gradient-to-br from-orange-400 to-red-500"></div>
            <div className="relative p-6 flex flex-col items-center justify-center h-48 text-center space-y-3">
              <div className="p-4 bg-white/20 backdrop-blur-sm rounded-full shadow-inner group-hover:scale-110 transition-transform duration-300">
                <Lightbulb className="h-10 w-10 text-white" />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-white mb-1">Emprender</h3>
                <p className="text-orange-100 font-medium text-sm">Juegos de Inversión</p>
              </div>
            </div>
          </Link>

          {/* Virtual Card Card */}
          <Link to="/growth" className="group relative overflow-hidden rounded-2xl transition-all duration-300 hover:scale-105 hover:shadow-xl">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-400 to-green-600"></div>
            <div className="relative p-6 flex flex-col items-center justify-center h-48 text-center space-y-3">
              <div className="p-4 bg-white/20 backdrop-blur-sm rounded-full shadow-inner group-hover:scale-110 transition-transform duration-300">
                <CreditCard className="h-10 w-10 text-white" />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-white mb-1">Tarjeta Virtual</h3>
                <p className="text-green-100 font-medium text-sm">Banca Digital</p>
              </div>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
