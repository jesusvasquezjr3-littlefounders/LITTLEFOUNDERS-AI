import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Gamepad2, 
  Trophy, 
  Star,
  TrendingUp,
  DollarSign,
  Target,
  Clock,
  Users,
  Zap,
  Play,
  BookOpen,
  Award
} from "lucide-react";
import { LemonadeStandGame } from "./LemonadeStand";

interface Game {
  id: string;
  title: string;
  description: string;
  icon: string;
  difficulty: 'Fácil' | 'Intermedio' | 'Avanzado';
  duration: string;
  category: 'Emprendimiento' | 'Bolsa' | 'Bienes Raíces' | 'Presupuesto';
  skills: string[];
  minAge: number;
  maxPlayers: number;
  points: number;
  unlocked: boolean;
  featured?: boolean;
}

const investmentGames: Game[] = [
  {
    id: 'lemonade-stand',
    title: 'Emprende tu Stand de Limonada 🍋',
    description: 'Administra tu propio negocio de limonada. Aprende sobre costos, precios, marketing y ganancias de manera divertida.',
    icon: '🍋',
    difficulty: 'Fácil',
    duration: '15-30 min',
    category: 'Emprendimiento',
    skills: ['Costos y Precios', 'Marketing', 'Servicio al Cliente', 'Gestión de Inventario'],
    minAge: 8,
    maxPlayers: 1,
    points: 100,
    unlocked: true,
    featured: true
  },
  {
    id: 'stock-simulator',
    title: 'Simulador Bursátil Junior',
    description: 'Invierte en acciones virtuales y aprende sobre el mercado de valores de forma segura.',
    icon: '📈',
    difficulty: 'Intermedio',
    duration: '20-40 min',
    category: 'Bolsa',
    skills: ['Análisis de Mercado', 'Diversificación', 'Riesgo vs Rendimiento'],
    minAge: 12,
    maxPlayers: 1,
    points: 150,
    unlocked: true
  },
  {
    id: 'property-tycoon',
    title: 'Magnate de Propiedades',
    description: 'Compra, mejora y vende propiedades para construir tu imperio inmobiliario.',
    icon: '🏠',
    difficulty: 'Avanzado',
    duration: '30-60 min',
    category: 'Bienes Raíces',
    skills: ['Inversión Inmobiliaria', 'Mejoras de Capital', 'Flujo de Efectivo'],
    minAge: 14,
    maxPlayers: 1,
    points: 200,
    unlocked: false
  },
  {
    id: 'budget-hero',
    title: 'Héroe del Presupuesto',
    description: 'Ayuda a familias virtuales a administrar sus finanzas y alcanzar sus metas.',
    icon: '🦸‍♀️',
    difficulty: 'Fácil',
    duration: '10-20 min',
    category: 'Presupuesto',
    skills: ['Presupuesto Personal', 'Ahorro', 'Prioridades Financieras'],
    minAge: 10,
    maxPlayers: 1,
    points: 75,
    unlocked: true
  },
  {
    id: 'crypto-explorer',
    title: 'Explorador Cripto',
    description: 'Descubre el mundo de las criptomonedas con explicaciones simples y simulaciones seguras.',
    icon: '₿',
    difficulty: 'Avanzado',
    duration: '25-45 min',
    category: 'Bolsa',
    skills: ['Tecnología Blockchain', 'Volatilidad', 'Monedas Digitales'],
    minAge: 16,
    maxPlayers: 1,
    points: 250,
    unlocked: false
  },
  {
    id: 'startup-challenge',
    title: 'Desafío Startup',
    description: 'Crea y lanza tu propia startup virtual. Desde la idea hasta la venta.',
    icon: '🚀',
    difficulty: 'Avanzado',
    duration: '45-90 min',
    category: 'Emprendimiento',
    skills: ['Plan de Negocios', 'Pitch de Inversores', 'Escalamiento'],
    minAge: 15,
    maxPlayers: 1,
    points: 300,
    unlocked: false
  }
];

interface UserStats {
  totalPoints: number;
  gamesCompleted: number;
  currentStreak: number;
  achievements: string[];
}

export default function InvestmentGames() {
  const [userStats] = useState<UserStats>({
    totalPoints: 425,
    gamesCompleted: 8,
    currentStreak: 5,
    achievements: ['first-game', 'entrepreneur-badge', 'streak-5']
  });

  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>('Todos');

  const categories = ['Todos', 'Emprendimiento', 'Bolsa', 'Bienes Raíces', 'Presupuesto'];
  
  const filteredGames = activeCategory === 'Todos' 
    ? investmentGames 
    : investmentGames.filter(game => game.category === activeCategory);

  const featuredGame = investmentGames.find(game => game.featured);

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'Fácil': return 'bg-green-100 text-green-700 border-green-200';
      case 'Intermedio': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'Avanzado': return 'bg-red-100 text-red-700 border-red-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'Emprendimiento': return 'bg-purple-100 text-purple-700';
      case 'Bolsa': return 'bg-blue-100 text-blue-700';
      case 'Bienes Raíces': return 'bg-emerald-100 text-emerald-700';
      case 'Presupuesto': return 'bg-orange-100 text-orange-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const startGame = (game: Game) => {
    if (!game.unlocked) return;
    
    if (game.id === 'lemonade-stand') {
      setSelectedGame(game);
    } else {
      // Para otros juegos, por ahora mostrar mensaje de "próximamente"
      alert(`🚧 "${game.title}" estará disponible próximamente. ¡Mantente atento!`);
    }
  };

  if (selectedGame?.id === 'lemonade-stand') {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="mb-6 flex items-center space-x-4">
          <Button 
            variant="outline" 
            onClick={() => setSelectedGame(null)}
            className="flex items-center space-x-2"
          >
            <span>←</span>
            <span>Volver a Juegos</span>
          </Button>
          <h1 className="text-2xl font-bold">🍋 {selectedGame.title}</h1>
        </div>
        <LemonadeStandGame />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 space-y-8">
      {/* Header */}
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent">
          🎮 Aprende a Invertir
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Descubre el mundo de las inversiones y el emprendimiento a través de juegos divertidos e interactivos
        </p>
      </div>

      {/* Stats Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-yellow-100 rounded-full">
                <Star className="h-6 w-6 text-yellow-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-yellow-600">
                  {userStats.totalPoints}
                </div>
                <div className="text-sm text-muted-foreground">Puntos Totales</div>
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
                  {userStats.gamesCompleted}
                </div>
                <div className="text-sm text-muted-foreground">Juegos Completados</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-100 rounded-full">
                <Zap className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-blue-600">
                  {userStats.currentStreak}
                </div>
                <div className="text-sm text-muted-foreground">Racha Actual</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-purple-100 rounded-full">
                <Award className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-purple-600">
                  {userStats.achievements.length}
                </div>
                <div className="text-sm text-muted-foreground">Logros Desbloqueados</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Featured Game */}
      {featuredGame && (
        <Card className="relative overflow-hidden bg-gradient-to-r from-pink-50 to-purple-50 border-pink-200">
          <div className="absolute top-4 right-4">
            <Badge className="bg-pink-500 hover:bg-pink-600">
              ⭐ Destacado
            </Badge>
          </div>
          <CardHeader>
            <div className="flex items-start space-x-4">
              <div className="text-6xl">{featuredGame.icon}</div>
              <div className="flex-1">
                <CardTitle className="text-2xl text-pink-700">{featuredGame.title}</CardTitle>
                <CardDescription className="text-base mt-2">
                  {featuredGame.description}
                </CardDescription>
                <div className="flex flex-wrap gap-2 mt-4">
                  <Badge variant="outline" className={getDifficultyColor(featuredGame.difficulty)}>
                    {featuredGame.difficulty}
                  </Badge>
                  <Badge variant="outline" className={getCategoryColor(featuredGame.category)}>
                    {featuredGame.category}
                  </Badge>
                  <Badge variant="outline" className="border-gray-300">
                    <Clock className="w-3 h-3 mr-1" />
                    {featuredGame.duration}
                  </Badge>
                  <Badge variant="outline" className="border-gray-300">
                    <Star className="w-3 h-3 mr-1" />
                    {featuredGame.points} pts
                  </Badge>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <p className="text-sm font-medium">Habilidades que desarrollarás:</p>
                <div className="flex flex-wrap gap-1">
                  {featuredGame.skills.slice(0, 3).map((skill, index) => (
                    <Badge key={index} variant="secondary" className="text-xs">
                      {skill}
                    </Badge>
                  ))}
                </div>
              </div>
              <Button 
                size="lg" 
                onClick={() => startGame(featuredGame)}
                className="bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600"
              >
                <Play className="w-5 h-5 mr-2" />
                ¡Jugar Ahora!
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Category Filter */}
      <div className="flex flex-wrap gap-2 justify-center">
        {categories.map((category) => (
          <Button
            key={category}
            variant={activeCategory === category ? "default" : "outline"}
            onClick={() => setActiveCategory(category)}
            className={`${activeCategory === category ? 
              'bg-gradient-to-r from-pink-500 to-purple-500' : 
              'hover:bg-pink-50'
            }`}
          >
            {category}
          </Button>
        ))}
      </div>

      {/* Games Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredGames.map((game) => (
          <Card key={game.id} className={`relative transition-all hover:shadow-lg ${
            game.unlocked ? 'hover:scale-[1.02] cursor-pointer' : 'opacity-60'
          } ${game.featured ? 'ring-2 ring-pink-200' : ''}`}>
            {!game.unlocked && (
              <div className="absolute inset-0 bg-black/5 rounded-lg flex items-center justify-center z-10">
                <Badge variant="secondary" className="bg-gray-600 text-white">
                  🔒 Próximamente
                </Badge>
              </div>
            )}
            
            <CardHeader className="text-center">
              <div className="text-5xl mb-2">{game.icon}</div>
              <CardTitle className="text-lg">{game.title}</CardTitle>
              <CardDescription className="text-sm">{game.description}</CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-4">
              {/* Game Info */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex items-center space-x-1">
                  <Users className="w-3 h-3" />
                  <span>{game.maxPlayers} jugador</span>
                </div>
                <div className="flex items-center space-x-1">
                  <Clock className="w-3 h-3" />
                  <span>{game.duration}</span>
                </div>
                <div className="flex items-center space-x-1">
                  <BookOpen className="w-3 h-3" />
                  <span>{game.minAge}+ años</span>
                </div>
                <div className="flex items-center space-x-1">
                  <Star className="w-3 h-3" />
                  <span>{game.points} pts</span>
                </div>
              </div>

              {/* Badges */}
              <div className="flex flex-wrap gap-1">
                <Badge variant="outline" className={getDifficultyColor(game.difficulty)}>
                  {game.difficulty}
                </Badge>
                <Badge variant="outline" className={getCategoryColor(game.category)}>
                  {game.category}
                </Badge>
              </div>

              {/* Skills Preview */}
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Aprenderás:</p>
                <div className="flex flex-wrap gap-1">
                  {game.skills.slice(0, 2).map((skill, index) => (
                    <Badge key={index} variant="secondary" className="text-xs">
                      {skill}
                    </Badge>
                  ))}
                  {game.skills.length > 2 && (
                    <Badge variant="secondary" className="text-xs">
                      +{game.skills.length - 2} más
                    </Badge>
                  )}
                </div>
              </div>

              {/* Play Button */}
              <Button 
                onClick={() => startGame(game)}
                disabled={!game.unlocked}
                className="w-full"
                variant={game.featured ? "default" : "outline"}
              >
                {game.unlocked ? (
                  <>
                    <Play className="w-4 h-4 mr-2" />
                    Jugar
                  </>
                ) : (
                  '🔒 Próximamente'
                )}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Coming Soon Section */}
      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center space-x-2 text-blue-700">
            <Gamepad2 className="w-6 h-6" />
            <span>¡Más Juegos en Camino!</span>
          </CardTitle>
          <CardDescription>
            Estamos desarrollando nuevos juegos educativos. ¿Qué tipo de inversión te gustaría aprender jugando?
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <div className="flex flex-wrap justify-center gap-2 mb-4">
            <Badge variant="outline" className="bg-blue-100 text-blue-700">🏪 Franquicias</Badge>
            <Badge variant="outline" className="bg-blue-100 text-blue-700">💎 Materias Primas</Badge>
            <Badge variant="outline" className="bg-blue-100 text-blue-700">🌍 Inversión Internacional</Badge>
            <Badge variant="outline" className="bg-blue-100 text-blue-700">🤖 Robo-Advisors</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            ¡Síguenos jugando para desbloquear nuevos contenidos!
          </p>
        </CardContent>
      </Card>
    </div>
  );
}