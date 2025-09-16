import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { 
  DollarSign, 
  Thermometer,
  Cloud,
  Sun,
  CloudRain,
  Users,
  TrendingUp,
  TrendingDown,
  ShoppingCart,
  Package,
  Star,
  Award,
  Zap,
  Target,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  Play,
  Pause,
  RotateCcw,
  Lightbulb,
  Heart,
  Timer,
  Trophy,
  Gift
} from "lucide-react";

// Interfaces del juego
interface Weather {
  type: 'sunny' | 'cloudy' | 'rainy' | 'hot';
  temperature: number;
  icon: JSX.Element;
  demandMultiplier: number;
  description: string;
}

interface Customer {
  id: string;
  name: string;
  satisfaction: number;
  willBuy: boolean;
  priceToleranceMin: number;
  priceToleranceMax: number;
  emoji: string;
}

interface Recipe {
  id: string;
  name: string;
  cost: number;
  quality: number;
  popularity: number;
  ingredients: { [key: string]: number };
}

interface Upgrade {
  id: string;
  name: string;
  description: string;
  cost: number;
  effect: string;
  purchased: boolean;
  icon: string;
}

interface GameEvent {
  id: string;
  type: 'good' | 'bad' | 'neutral';
  title: string;
  description: string;
  effect: string;
  duration: number;
}

interface GameState {
  day: number;
  money: number;
  reputation: number;
  inventory: {
    lemons: number;
    sugar: number;
    ice: number;
    cups: number;
  };
  recipe: Recipe;
  price: number;
  weather: Weather;
  customersServed: number;
  totalRevenue: number;
  satisfaction: number;
  competition: number;
  upgrades: Upgrade[];
  activeEvents: GameEvent[];
  achievements: string[];
  isPlaying: boolean;
  isPaused: boolean;
  timeRemaining: number;
  currentLevel: number;
}

// Datos del juego
const weatherTypes: Weather[] = [
  {
    type: 'sunny',
    temperature: 85,
    icon: <Sun className="w-6 h-6 text-yellow-500" />,
    demandMultiplier: 1.4,
    description: 'Día soleado perfecto para limonada'
  },
  {
    type: 'hot',
    temperature: 95,
    icon: <Thermometer className="w-6 h-6 text-red-500" />,
    demandMultiplier: 1.8,
    description: '¡Calor extremo! La gente busca refrescarse'
  },
  {
    type: 'cloudy',
    temperature: 72,
    icon: <Cloud className="w-6 h-6 text-gray-500" />,
    demandMultiplier: 0.8,
    description: 'Día nublado, menos demanda'
  },
  {
    type: 'rainy',
    temperature: 65,
    icon: <CloudRain className="w-6 h-6 text-blue-500" />,
    demandMultiplier: 0.3,
    description: '¡Lluvia! Muy pocos clientes'
  }
];

const baseRecipe: Recipe = {
  id: 'basic',
  name: 'Limonada Clásica',
  cost: 0.25,
  quality: 50,
  popularity: 60,
  ingredients: { lemons: 1, sugar: 1, ice: 2, cups: 1 }
};

const possibleEvents: GameEvent[] = [
  {
    id: 'festival',
    type: 'good',
    title: '🎉 ¡Festival en el Barrio!',
    description: 'Hay un festival y llegan muchos clientes',
    effect: '+50% clientes por 2 días',
    duration: 2
  },
  {
    id: 'competition',
    type: 'bad',
    title: '🏪 Nueva Competencia',
    description: 'Abrió otro stand de limonada cerca',
    effect: '-25% clientes por 3 días',
    duration: 3
  },
  {
    id: 'celebrity',
    type: 'good',
    title: '⭐ ¡Visita una Celebridad!',
    description: 'Una celebridad compró tu limonada y la recomendó',
    effect: '+100% reputación por 1 día',
    duration: 1
  },
  {
    id: 'supply-shortage',
    type: 'bad',
    title: '📦 Escasez de Suministros',
    description: 'Los precios de los ingredientes subieron',
    effect: '+50% costo ingredientes por 2 días',
    duration: 2
  }
];

const availableUpgrades: Upgrade[] = [
  {
    id: 'better-cups',
    name: 'Vasos Premium',
    description: 'Vasos más atractivos que mejoran la satisfacción',
    cost: 50,
    effect: '+10% satisfacción',
    purchased: false,
    icon: '🥤'
  },
  {
    id: 'umbrella',
    name: 'Sombrilla',
    description: 'Protege a los clientes del sol y la lluvia',
    cost: 75,
    effect: 'Menos efecto del clima',
    purchased: false,
    icon: '☂️'
  },
  {
    id: 'marketing',
    name: 'Cartel Llamativo',
    description: 'Atrae más clientes a tu stand',
    cost: 100,
    effect: '+20% clientes',
    purchased: false,
    icon: '📢'
  },
  {
    id: 'ice-machine',
    name: 'Máquina de Hielo',
    description: 'Reduce el costo del hielo significativamente',
    cost: 150,
    effect: '-50% costo del hielo',
    purchased: false,
    icon: '🧊'
  }
];

export function LemonadeStandGame() {
  const [gameState, setGameState] = useState<GameState>({
    day: 1,
    money: 50,
    reputation: 50,
    inventory: {
      lemons: 10,
      sugar: 10,
      ice: 20,
      cups: 15
    },
    recipe: baseRecipe,
    price: 1.0,
    weather: weatherTypes[0],
    customersServed: 0,
    totalRevenue: 0,
    satisfaction: 50,
    competition: 30,
    upgrades: availableUpgrades,
    activeEvents: [],
    achievements: [],
    isPlaying: false,
    isPaused: false,
    timeRemaining: 60,
    currentLevel: 1
  });

  const [showTutorial, setShowTutorial] = useState(true);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [notifications, setNotifications] = useState<string[]>([]);
  const [dayResults, setDayResults] = useState<any>(null);

  // Generar cliente aleatorio
  const generateCustomer = useCallback((): Customer => {
    const names = ['Ana', 'Carlos', 'María', 'Luis', 'Sofia', 'Diego', 'Camila', 'Pedro'];
    const emojis = ['😊', '🙂', '😋', '🤔', '😎', '👧', '👦', '👩'];
    
    return {
      id: Math.random().toString(36),
      name: names[Math.floor(Math.random() * names.length)],
      satisfaction: Math.floor(Math.random() * 100),
      willBuy: Math.random() > 0.3,
      priceToleranceMin: 0.5,
      priceToleranceMax: 2.0 + Math.random() * 1.5,
      emoji: emojis[Math.floor(Math.random() * emojis.length)]
    };
  }, []);

  // Agregar notificación
  const addNotification = useCallback((message: string) => {
    setNotifications(prev => [...prev.slice(-2), message]);
    setTimeout(() => {
      setNotifications(prev => prev.slice(1));
    }, 3000);
  }, []);

  // Generar clima aleatorio
  const generateWeather = useCallback((): Weather => {
    const random = Math.random();
    if (random < 0.4) return weatherTypes[0]; // Sunny
    if (random < 0.6) return weatherTypes[1]; // Hot
    if (random < 0.8) return weatherTypes[2]; // Cloudy
    return weatherTypes[3]; // Rainy
  }, []);

  // Generar evento aleatorio
  const generateRandomEvent = useCallback((): GameEvent | null => {
    if (Math.random() < 0.15) { // 15% de probabilidad
      return possibleEvents[Math.floor(Math.random() * possibleEvents.length)];
    }
    return null;
  }, []);

  // Lógica de simulación de ventas
  const simulateDay = useCallback(() => {
    const baseCustomers = 30;
    const weatherEffect = gameState.weather.demandMultiplier;
    const reputationEffect = gameState.reputation / 100;
    const competitionEffect = (100 - gameState.competition) / 100;
    const eventEffect = gameState.activeEvents.reduce((acc, event) => 
      event.effect.includes('clientes') ? acc * 1.5 : acc, 1);

    const totalCustomersPotential = Math.floor(
      baseCustomers * weatherEffect * reputationEffect * competitionEffect * eventEffect
    );

    let revenue = 0;
    let served = 0;
    let totalSatisfaction = 0;

    for (let i = 0; i < totalCustomersPotential; i++) {
      const customer = generateCustomer();
      
      // Verificar si el cliente puede pagar el precio
      if (gameState.price <= customer.priceToleranceMax && gameState.price >= customer.priceToleranceMin) {
        // Verificar inventario
        if (gameState.inventory.lemons >= 1 && 
            gameState.inventory.sugar >= 1 && 
            gameState.inventory.ice >= 2 && 
            gameState.inventory.cups >= 1) {
          
          served++;
          revenue += gameState.price;
          
          // Calcular satisfacción basada en precio-calidad
          const priceQualityRatio = (gameState.recipe.quality / 100) / (gameState.price / 1.0);
          const customerSatisfaction = Math.min(100, priceQualityRatio * 80 + Math.random() * 20);
          totalSatisfaction += customerSatisfaction;

          // Reducir inventario
          setGameState(prev => ({
            ...prev,
            inventory: {
              lemons: prev.inventory.lemons - 1,
              sugar: prev.inventory.sugar - 1,
              ice: prev.inventory.ice - 2,
              cups: prev.inventory.cups - 1
            }
          }));
        } else {
          addNotification("❌ ¡Sin inventario! Perdiste clientes");
          break;
        }
      }
    }

    const avgSatisfaction = served > 0 ? totalSatisfaction / served : gameState.satisfaction;
    const profitMargin = ((revenue - (served * gameState.recipe.cost)) / revenue) * 100;

    // Actualizar estado del juego
    setGameState(prev => ({
      ...prev,
      money: prev.money + revenue - (served * gameState.recipe.cost),
      customersServed: prev.customersServed + served,
      totalRevenue: prev.totalRevenue + revenue,
      satisfaction: Math.floor((prev.satisfaction + avgSatisfaction) / 2),
      reputation: Math.min(100, prev.reputation + (avgSatisfaction > 70 ? 2 : avgSatisfaction < 40 ? -1 : 0))
    }));

    // Mostrar resultados del día
    setDayResults({
      served,
      revenue,
      profit: revenue - (served * gameState.recipe.cost),
      avgSatisfaction,
      profitMargin
    });

    // Verificar logros
    checkAchievements(served, revenue, avgSatisfaction);

  }, [gameState, generateCustomer, addNotification]);

  // Verificar logros
  const checkAchievements = (served: number, revenue: number, satisfaction: number) => {
    const newAchievements = [];

    if (served >= 20 && !gameState.achievements.includes('busy-day')) {
      newAchievements.push('busy-day');
      addNotification("🏆 ¡Logro desbloqueado: Día Ocupado!");
    }

    if (satisfaction >= 90 && !gameState.achievements.includes('excellent-service')) {
      newAchievements.push('excellent-service');
      addNotification("🏆 ¡Logro desbloqueado: Servicio Excelente!");
    }

    if (revenue >= 50 && !gameState.achievements.includes('big-earner')) {
      newAchievements.push('big-earner');
      addNotification("🏆 ¡Logro desbloqueado: Gran Vendedor!");
    }

    if (newAchievements.length > 0) {
      setGameState(prev => ({
        ...prev,
        achievements: [...prev.achievements, ...newAchievements]
      }));
    }
  };

  // Siguiente día
  const nextDay = () => {
    const newWeather = generateWeather();
    const randomEvent = generateRandomEvent();
    
    setGameState(prev => ({
      ...prev,
      day: prev.day + 1,
      weather: newWeather,
      activeEvents: [
        ...prev.activeEvents.map(event => ({ ...event, duration: event.duration - 1 }))
                             .filter(event => event.duration > 0),
        ...(randomEvent ? [randomEvent] : [])
      ],
      timeRemaining: 60
    }));

    setDayResults(null);

    if (randomEvent) {
      addNotification(`📅 ${randomEvent.title}`);
    }
  };

  // Comprar suministros
  const buySupplies = (item: string, quantity: number) => {
    const costs = { lemons: 0.1, sugar: 0.05, ice: 0.02, cups: 0.03 };
    const totalCost = costs[item as keyof typeof costs] * quantity;

    if (gameState.money >= totalCost) {
      setGameState(prev => ({
        ...prev,
        money: prev.money - totalCost,
        inventory: {
          ...prev.inventory,
          [item]: prev.inventory[item as keyof typeof prev.inventory] + quantity
        }
      }));
      addNotification(`✅ Compraste ${quantity} ${item}`);
    } else {
      addNotification("❌ No tienes suficiente dinero");
    }
  };

  // Comprar mejora
  const buyUpgrade = (upgrade: Upgrade) => {
    if (gameState.money >= upgrade.cost && !upgrade.purchased) {
      setGameState(prev => ({
        ...prev,
        money: prev.money - upgrade.cost,
        upgrades: prev.upgrades.map(u => 
          u.id === upgrade.id ? { ...u, purchased: true } : u
        )
      }));
      addNotification(`🎉 ¡Compraste: ${upgrade.name}!`);
    }
  };

  // Calcular estadísticas
  const profitMargin = gameState.totalRevenue > 0 
    ? ((gameState.totalRevenue - (gameState.customersServed * gameState.recipe.cost)) / gameState.totalRevenue) * 100 
    : 0;

  const averageCustomersPerDay = gameState.day > 1 ? Math.floor(gameState.customersServed / (gameState.day - 1)) : 0;

  if (showTutorial) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <Card className="bg-gradient-to-r from-yellow-50 to-orange-50 border-yellow-200">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">🍋 ¡Bienvenido a tu Stand de Limonada! 🍋</CardTitle>
            <CardDescription className="text-base">
              Aprende los fundamentos del emprendimiento administrando tu propio negocio
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <h4 className="font-semibold text-orange-700">🎯 Tu Objetivo:</h4>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center space-x-2">
                    <DollarSign className="w-4 h-4 text-green-600" />
                    <span>Ganar dinero vendiendo limonada</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <Users className="w-4 h-4 text-blue-600" />
                    <span>Mantener felices a tus clientes</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <Star className="w-4 h-4 text-yellow-600" />
                    <span>Construir una buena reputación</span>
                  </li>
                </ul>
              </div>
              <div className="space-y-3">
                <h4 className="font-semibold text-orange-700">📚 Aprenderás:</h4>
                <ul className="space-y-2 text-sm">
                  <li>💰 Costos y ganancias</li>
                  <li>💲 Estrategias de precios</li>
                  <li>📦 Gestión de inventario</li>
                  <li>😊 Servicio al cliente</li>
                  <li>🌤️ Adaptarse a cambios</li>
                </ul>
              </div>
            </div>
            
            <div className="bg-blue-50 p-4 rounded-lg">
              <h5 className="font-semibold text-blue-700 mb-2">💡 Consejos para Empezar:</h5>
              <ul className="text-sm space-y-1 text-blue-600">
                <li>• Empieza con un precio razonable (alrededor de $1.00)</li>
                <li>• Mantén suficiente inventario para todo el día</li>
                <li>• Presta atención al clima - afecta las ventas</li>
                <li>• Los clientes felices regresarán y recomendarán tu stand</li>
              </ul>
            </div>

            <div className="text-center space-y-4">
              <Button 
                size="lg" 
                onClick={() => setShowTutorial(false)}
                className="bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600"
              >
                <Play className="w-5 h-5 mr-2" />
                ¡Comenzar mi Negocio!
              </Button>
              <p className="text-xs text-muted-foreground">
                ¡Puedes revisar el tutorial en cualquier momento desde el menú!
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (dayResults) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <Card className="bg-gradient-to-r from-green-50 to-blue-50 border-green-200">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">📊 Resultados del Día {gameState.day - 1}</CardTitle>
            <CardDescription>¿Qué tal lo hiciste hoy?</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-white rounded-lg">
                <Users className="w-8 h-8 mx-auto mb-2 text-blue-600" />
                <div className="text-2xl font-bold text-blue-600">{dayResults.served}</div>
                <div className="text-sm text-muted-foreground">Clientes Atendidos</div>
              </div>
              <div className="text-center p-4 bg-white rounded-lg">
                <DollarSign className="w-8 h-8 mx-auto mb-2 text-green-600" />
                <div className="text-2xl font-bold text-green-600">${dayResults.revenue.toFixed(2)}</div>
                <div className="text-sm text-muted-foreground">Ingresos</div>
              </div>
              <div className="text-center p-4 bg-white rounded-lg">
                <TrendingUp className="w-8 h-8 mx-auto mb-2 text-purple-600" />
                <div className="text-2xl font-bold text-purple-600">${dayResults.profit.toFixed(2)}</div>
                <div className="text-sm text-muted-foreground">Ganancia</div>
              </div>
              <div className="text-center p-4 bg-white rounded-lg">
                <Heart className="w-8 h-8 mx-auto mb-2 text-pink-600" />
                <div className="text-2xl font-bold text-pink-600">{dayResults.avgSatisfaction.toFixed(0)}%</div>
                <div className="text-sm text-muted-foreground">Satisfacción</div>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="font-semibold">📈 Análisis del Día:</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-white rounded-lg">
                  <div className="flex items-center space-x-2 mb-2">
                    <Target className="w-5 h-5 text-orange-600" />
                    <span className="font-medium">Margen de Ganancia</span>
                  </div>
                  <div className="text-xl font-bold text-orange-600">
                    {dayResults.profitMargin.toFixed(1)}%
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {dayResults.profitMargin > 50 ? 'Excelente margen' : 
                     dayResults.profitMargin > 30 ? 'Buen margen' : 
                     'Considera ajustar precios'}
                  </div>
                </div>
                <div className="p-4 bg-white rounded-lg">
                  <div className="flex items-center space-x-2 mb-2">
                    <Award className="w-5 h-5 text-yellow-600" />
                    <span className="font-medium">Calificación del Día</span>
                  </div>
                  <div className="text-xl font-bold text-yellow-600">
                    {dayResults.avgSatisfaction >= 80 ? '🌟 Excelente' :
                     dayResults.avgSatisfaction >= 60 ? '👍 Bueno' :
                     dayResults.avgSatisfaction >= 40 ? '⚠️ Regular' : '😔 Mejorable'}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Basado en satisfacción del cliente
                  </div>
                </div>
              </div>
            </div>

            <div className="text-center">
              <Button 
                size="lg" 
                onClick={nextDay}
                className="bg-gradient-to-r from-blue-500 to-purple-500"
              >
                Continuar al Día {gameState.day}
                <span className="ml-2">→</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header del Juego */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-green-600">
                  ${gameState.money.toFixed(2)}
                </div>
                <div className="text-sm text-muted-foreground">Dinero Total</div>
              </div>
              <DollarSign className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-blue-600">
                  Día {gameState.day}
                </div>
                <div className="text-sm text-muted-foreground flex items-center space-x-1">
                  {gameState.weather.icon}
                  <span>{gameState.weather.description}</span>
                </div>
              </div>
              <Timer className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-purple-600">
                  {gameState.reputation}
                </div>
                <div className="text-sm text-muted-foreground">Reputación</div>
                <Progress value={gameState.reputation} className="mt-1" />
              </div>
              <Star className="w-8 h-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Notificaciones */}
      {notifications.length > 0 && (
        <div className="space-y-2">
          {notifications.map((notification, index) => (
            <div key={index} className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-sm text-blue-700">{notification}</p>
            </div>
          ))}
        </div>
      )}

      {/* Eventos Activos */}
      {gameState.activeEvents.length > 0 && (
        <Card className="bg-yellow-50 border-yellow-200">
          <CardHeader>
            <CardTitle className="text-yellow-700">📅 Eventos Activos</CardTitle>
          </CardHeader>
          <CardContent>
            {gameState.activeEvents.map((event) => (
              <div key={event.id} className="flex items-center justify-between p-2 bg-white rounded-lg mb-2 last:mb-0">
                <div>
                  <div className="font-medium">{event.title}</div>
                  <div className="text-sm text-muted-foreground">{event.description}</div>
                </div>
                <Badge variant="secondary">
                  {event.duration} día{event.duration > 1 ? 's' : ''} restante{event.duration > 1 ? 's' : ''}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Panel Principal - Configuración del Stand */}
        <div className="lg:col-span-2 space-y-6">
          {/* Configuración de Precios */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <DollarSign className="w-5 h-5" />
                <span>Configurar Precios</span>
              </CardTitle>
              <CardDescription>
                El precio afecta tanto las ventas como la satisfacción del cliente
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span>Precio por Vaso</span>
                  <span className="font-bold text-green-600">${gameState.price.toFixed(2)}</span>
                </div>
                <Slider
                  value={[gameState.price]}
                  onValueChange={([value]) => setGameState(prev => ({ ...prev, price: value }))}
                  min={0.25}
                  max={3.0}
                  step={0.05}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>$0.25</span>
                  <span>$3.00</span>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div className="text-center p-3 bg-blue-50 rounded-lg">
                  <div className="text-sm text-blue-600">Costo por Vaso</div>
                  <div className="font-bold text-blue-700">${gameState.recipe.cost.toFixed(2)}</div>
                </div>
                <div className="text-center p-3 bg-green-50 rounded-lg">
                  <div className="text-sm text-green-600">Ganancia por Vaso</div>
                  <div className="font-bold text-green-700">
                    ${(gameState.price - gameState.recipe.cost).toFixed(2)}
                  </div>
                </div>
              </div>

              <div className="p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-2 mb-2">
                  <Lightbulb className="w-4 h-4 text-yellow-600" />
                  <span className="text-sm font-medium">Consejo de Precios</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {gameState.price < 0.75 ? 'Precio muy bajo - podrías ganar más' :
                   gameState.price > 2.0 ? 'Precio alto - podrías perder clientes' :
                   'Precio equilibrado para maximizar ventas y ganancias'}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Gestión de Inventario */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Package className="w-5 h-5" />
                <span>Inventario</span>
              </CardTitle>
              <CardDescription>
                Asegúrate de tener suficientes suministros para el día
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {Object.entries(gameState.inventory).map(([item, quantity]) => {
                  const lowStock = quantity < 10;
                  const icons = { lemons: '🍋', sugar: '🍯', ice: '🧊', cups: '🥤' };
                  const costs = { lemons: 0.1, sugar: 0.05, ice: 0.02, cups: 0.03 };
                  
                  return (
                    <div key={item} className={`p-4 rounded-lg border ${
                      lowStock ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200'
                    }`}>
                      <div className="text-center mb-3">
                        <div className="text-2xl mb-1">{icons[item as keyof typeof icons]}</div>
                        <div className="font-bold text-lg">{quantity}</div>
                        <div className="text-xs capitalize text-muted-foreground">
                          {item}
                          {lowStock && <span className="text-red-500 ml-1">⚠️</span>}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => buySupplies(item, 10)}
                        className="w-full"
                        variant="outline"
                      >
                        +10 (${(costs[item as keyof typeof costs] * 10).toFixed(2)})
                      </Button>
                    </div>
                  );
                })}
              </div>

              <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                <div className="text-sm text-blue-700">
                  <strong>Receta actual:</strong> {gameState.recipe.name}
                </div>
                <div className="text-xs text-blue-600 mt-1">
                  Por vaso necesitas: 1 limón, 1 azúcar, 2 hielo, 1 vaso
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Botón de Simular Día */}
          <Card className="bg-gradient-to-r from-orange-50 to-pink-50">
            <CardContent className="p-6 text-center">
              <h3 className="text-xl font-bold mb-2">¿Listo para vender?</h3>
              <p className="text-muted-foreground mb-4">
                ¡Abre tu stand y empieza a atender clientes!
              </p>
              <Button 
                size="lg" 
                onClick={simulateDay}
                className="bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600"
                disabled={!gameState.inventory.lemons || !gameState.inventory.sugar || !gameState.inventory.ice || !gameState.inventory.cups}
              >
                <Play className="w-5 h-5 mr-2" />
                ¡Abrir Stand!
              </Button>
              {(!gameState.inventory.lemons || !gameState.inventory.sugar || !gameState.inventory.ice || !gameState.inventory.cups) && (
                <p className="text-sm text-red-600 mt-2">
                  ⚠️ Necesitas todos los ingredientes para abrir
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Panel Lateral */}
        <div className="space-y-6">
          {/* Estadísticas */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Trophy className="w-5 h-5" />
                <span>Estadísticas</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm">Clientes Servidos</span>
                  <span className="font-bold">{gameState.customersServed}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Ingresos Totales</span>
                  <span className="font-bold text-green-600">${gameState.totalRevenue.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Promedio Clientes/Día</span>
                  <span className="font-bold">{averageCustomersPerDay}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Margen de Ganancia</span>
                  <span className="font-bold text-purple-600">{profitMargin.toFixed(1)}%</span>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm">Satisfacción Promedio</span>
                  <span className="font-bold">{gameState.satisfaction}%</span>
                </div>
                <Progress value={gameState.satisfaction} />
              </div>
            </CardContent>
          </Card>

          {/* Mejoras */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Zap className="w-5 h-5" />
                <span>Mejoras</span>
              </CardTitle>
              <CardDescription>
                Invierte en tu negocio para mejores resultados
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {gameState.upgrades.map((upgrade) => (
                  <div key={upgrade.id} className={`p-3 rounded-lg border ${
                    upgrade.purchased ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'
                  }`}>
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <span className="text-lg">{upgrade.icon}</span>
                        <div>
                          <div className="font-medium text-sm">{upgrade.name}</div>
                          {upgrade.purchased && (
                            <Badge size="sm" className="bg-green-500">✅ Comprado</Badge>
                          )}
                        </div>
                      </div>
                      <div className="text-xs text-right">
                        <div className="text-green-600 font-bold">${upgrade.cost}</div>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">{upgrade.description}</p>
                    <div className="text-xs text-blue-600 font-medium">{upgrade.effect}</div>
                    {!upgrade.purchased && (
                      <Button
                        size="sm"
                        onClick={() => buyUpgrade(upgrade)}
                        disabled={gameState.money < upgrade.cost}
                        className="w-full mt-2"
                        variant="outline"
                      >
                        Comprar
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Logros */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Award className="w-5 h-5" />
                <span>Logros</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className={`p-2 rounded-lg ${
                  gameState.achievements.includes('busy-day') ? 'bg-yellow-50' : 'bg-gray-50'
                }`}>
                  <div className="flex items-center space-x-2">
                    <span>🏆</span>
                    <span className="text-sm">Día Ocupado</span>
                    {gameState.achievements.includes('busy-day') && <CheckCircle className="w-4 h-4 text-green-600" />}
                  </div>
                  <p className="text-xs text-muted-foreground ml-6">Servir 20+ clientes en un día</p>
                </div>
                
                <div className={`p-2 rounded-lg ${
                  gameState.achievements.includes('excellent-service') ? 'bg-yellow-50' : 'bg-gray-50'
                }`}>
                  <div className="flex items-center space-x-2">
                    <span>⭐</span>
                    <span className="text-sm">Servicio Excelente</span>
                    {gameState.achievements.includes('excellent-service') && <CheckCircle className="w-4 h-4 text-green-600" />}
                  </div>
                  <p className="text-xs text-muted-foreground ml-6">Alcanzar 90% de satisfacción</p>
                </div>
                
                <div className={`p-2 rounded-lg ${
                  gameState.achievements.includes('big-earner') ? 'bg-yellow-50' : 'bg-gray-50'
                }`}>
                  <div className="flex items-center space-x-2">
                    <span>💰</span>
                    <span className="text-sm">Gran Vendedor</span>
                    {gameState.achievements.includes('big-earner') && <CheckCircle className="w-4 h-4 text-green-600" />}
                  </div>
                  <p className="text-xs text-muted-foreground ml-6">Ganar $50 en un día</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}