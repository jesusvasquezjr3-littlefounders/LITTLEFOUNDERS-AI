import React, { useState, useEffect, useCallback } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { 
  FloatingMoney, 
  BouncingCustomer, 
  WeatherAnimation, 
  StandAnimation,
  PulsingIcon,
  SuccessAnimation 
} from "@/components/lemonade/GameEffects";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Sun, 
  Cloud, 
  CloudRain, 
  Snowflake,
  DollarSign, 
  ShoppingCart,
  Users,
  TrendingUp,
  AlertTriangle,
  Trophy,
  Star,
  Target,
  Zap,
  Timer,
  Settings,
  BarChart3,
  Package,
  MapPin,
  Lightbulb,
  Gift,
  Calendar
} from "lucide-react";

// Tipos de datos del juego
interface GameState {
  day: number;
  money: number;
  inventory: {
    lemons: number;
    sugar: number;
    cups: number;
    ice: number;
  };
  recipe: {
    lemonsPerCup: number;
    sugarPerCup: number;
    icePerCup: number;
    price: number;
  };
  weather: 'sunny' | 'cloudy' | 'rainy' | 'cold';
  temperature: number;
  location: 'park' | 'school' | 'mall' | 'beach';
  customers: Customer[];
  dailyStats: {
    cupsSold: number;
    revenue: number;
    profit: number;
    customersServed: number;
  };
  achievements: string[];
  reputation: number;
  experience: number;
  level: number;
}

interface Customer {
  id: string;
  name: string;
  emoji: string;
  patience: number;
  pricePreference: 'cheap' | 'value' | 'premium';
  tasteBudget: number;
  satisfaction: number;
  willBuy: boolean;
}

interface WeatherEffect {
  icon: any;
  color: string;
  multiplier: number;
  description: string;
}

interface Location {
  name: string;
  emoji: string;
  footTraffic: number;
  rentCost: number;
  description: string;
}

// Datos del juego
const weatherEffects: Record<string, WeatherEffect> = {
  sunny: {
    icon: Sun,
    color: "text-yellow-500",
    multiplier: 1.3,
    description: "¡Perfecto para limonada!"
  },
  cloudy: {
    icon: Cloud,
    color: "text-gray-500",
    multiplier: 1.0,
    description: "Día normal para ventas"
  },
  rainy: {
    icon: CloudRain,
    color: "text-blue-500",
    multiplier: 0.6,
    description: "Pocas personas salen"
  },
  cold: {
    icon: Snowflake,
    color: "text-cyan-500",
    multiplier: 0.4,
    description: "Nadie quiere limonada fría"
  }
};

const locations: Record<string, Location> = {
  park: {
    name: "Parque Central",
    emoji: "🌳",
    footTraffic: 1.0,
    rentCost: 0,
    description: "Gratis, tráfico moderado"
  },
  school: {
    name: "Escuela",
    emoji: "🏫",
    footTraffic: 1.2,
    rentCost: 5,
    description: "Muchos niños, cuesta $5"
  },
  mall: {
    name: "Centro Comercial",
    emoji: "🏬",
    footTraffic: 1.5,
    rentCost: 15,
    description: "Mucho tráfico, cuesta $15"
  },
  beach: {
    name: "Playa",
    emoji: "🏖️",
    footTraffic: 2.0,
    rentCost: 25,
    description: "Máximo tráfico, cuesta $25"
  }
};

const customerNames = [
  { name: "Sofía", emoji: "👧" },
  { name: "Miguel", emoji: "👦" },
  { name: "Ana", emoji: "👩" },
  { name: "Carlos", emoji: "👨" },
  { name: "Lucía", emoji: "👧🏻" },
  { name: "Diego", emoji: "👦🏻" },
  { name: "María", emoji: "👩🏻" },
  { name: "José", emoji: "👨🏻" }
];

const achievements = [
  { id: 'first-sale', name: 'Primera Venta', icon: '🎉', description: '¡Vendiste tu primera limonada!' },
  { id: 'profit-day', name: 'Día Rentable', icon: '💰', description: 'Ganaste dinero en un día' },
  { id: 'perfect-recipe', name: 'Receta Perfecta', icon: '👨‍🍳', description: 'Todos los clientes amaron tu receta' },
  { id: 'weather-master', name: 'Maestro del Clima', icon: '🌟', description: 'Adaptaste tu estrategia al clima' },
  { id: 'business-tycoon', name: 'Magnate de Negocios', icon: '👑', description: 'Llegaste a $100 en ganancias' },
  { id: 'efficient-seller', name: 'Vendedor Eficiente', icon: '⚡', description: 'Vendiste 20+ vasos en un día' },
  { id: 'customer-favorite', name: 'Favorito de Clientes', icon: '⭐', description: 'Alcanzaste 90+ de reputación' },
  { id: 'strategic-thinker', name: 'Pensador Estratégico', icon: '🧠', description: 'Cambiaste de ubicación exitosamente' },
  { id: 'week-survivor', name: 'Superviviente Semanal', icon: '📅', description: 'Completaste 7 días consecutivos' }
];

const specialEvents = [
  {
    id: 'competition',
    day: 3,
    title: '🏪 ¡Competencia!',
    description: 'Otro niño abrió un puesto cerca. Los clientes son más exigentes hoy.',
    effect: { reputationMultiplier: 0.8 }
  },
  {
    id: 'festival',
    day: 5,
    title: '🎉 ¡Festival Local!',
    description: 'Hay un festival en el pueblo. ¡Muchas más personas caminan por aquí!',
    effect: { customerMultiplier: 1.5 }
  },
  {
    id: 'supplier-discount',
    day: 7,
    title: '💸 Oferta Especial',
    description: 'Tu proveedor ofrece ingredientes con 30% de descuento por hoy.',
    effect: { ingredientDiscount: 0.3 }
  },
  {
    id: 'tv-interview',
    day: 10,
    title: '📺 ¡Entrevista en TV!',
    description: 'Te entrevistaron en las noticias locales. Tu reputación aumenta.',
    effect: { reputationBonus: 20 }
  }
];

export function LemonadeStand() {
  const [gameState, setGameState] = useState<GameState>({
    day: 1,
    money: 20, // Dinero inicial
    inventory: {
      lemons: 10,
      sugar: 10,
      cups: 20,
      ice: 15
    },
    recipe: {
      lemonsPerCup: 2,
      sugarPerCup: 1,
      icePerCup: 1,
      price: 1.0
    },
    weather: 'sunny',
    temperature: 75,
    location: 'park',
    customers: [],
    dailyStats: {
      cupsSold: 0,
      revenue: 0,
      profit: 0,
      customersServed: 0
    },
    achievements: [],
    reputation: 50,
    experience: 0,
    level: 1
  });

  const [isShopOpen, setIsShopOpen] = useState(false);
  const [showRecipeDialog, setShowRecipeDialog] = useState(false);
  const [showStatsDialog, setShowStatsDialog] = useState(false);
  const [customerQueue, setCustomerQueue] = useState<Customer[]>([]);
  const [currentCustomer, setCurrentCustomer] = useState<Customer | null>(null);
  const [isSellingMode, setIsSellingMode] = useState(false);
  const [animatedMoney, setAnimatedMoney] = useState(0);
  const [currentEvent, setCurrentEvent] = useState<any>(null);
  const [showAchievement, setShowAchievement] = useState<any>(null);

  // Generar cliente aleatorio
  const generateCustomer = useCallback((): Customer => {
    const customer = customerNames[Math.floor(Math.random() * customerNames.length)];
    return {
      id: Date.now().toString() + Math.random(),
      name: customer.name,
      emoji: customer.emoji,
      patience: Math.random() * 10 + 5, // 5-15 segundos
      pricePreference: Math.random() < 0.6 ? 'cheap' : Math.random() < 0.8 ? 'value' : 'premium',
      tasteBudget: Math.random() * 10 + 5,
      satisfaction: 0,
      willBuy: true
    };
  }, []);

  // Generar clima aleatorio
  const generateWeather = useCallback(() => {
    const weathers: (keyof typeof weatherEffects)[] = ['sunny', 'cloudy', 'rainy', 'cold'];
    const weights = [0.4, 0.3, 0.2, 0.1]; // 40% soleado, 30% nublado, etc.
    
    const random = Math.random();
    let acc = 0;
    for (let i = 0; i < weights.length; i++) {
      acc += weights[i];
      if (random < acc) {
        return weathers[i];
      }
    }
    return 'sunny';
  }, []);

  // Calcular satisfacción del cliente
  const calculateSatisfaction = useCallback((customer: Customer) => {
    const { recipe } = gameState;
    let satisfaction = 0;

    // Satisfacción por precio
    if (customer.pricePreference === 'cheap' && recipe.price < 1.0) satisfaction += 30;
    else if (customer.pricePreference === 'value' && recipe.price >= 1.0 && recipe.price <= 1.5) satisfaction += 30;
    else if (customer.pricePreference === 'premium' && recipe.price > 1.5) satisfaction += 30;

    // Satisfacción por receta
    const recipeScore = (recipe.lemonsPerCup * 2 + recipe.sugarPerCup + recipe.icePerCup) * 10;
    satisfaction += Math.min(recipeScore, 70);

    // Factor clima
    satisfaction *= weatherEffects[gameState.weather].multiplier;

    return Math.max(0, Math.min(100, satisfaction));
  }, [gameState]);

  // Servir al cliente
  const serveCustomer = useCallback(() => {
    if (!currentCustomer) return;

    const satisfaction = calculateSatisfaction(currentCustomer);
    const willBuy = satisfaction > 60;

    if (willBuy) {
      const cost = gameState.recipe.lemonsPerCup * 0.1 + 
                   gameState.recipe.sugarPerCup * 0.05 + 
                   gameState.recipe.icePerCup * 0.02 + 0.1; // Costo del vaso

      setGameState(prev => ({
        ...prev,
        money: prev.money + prev.recipe.price,
        inventory: {
          ...prev.inventory,
          lemons: prev.inventory.lemons - prev.recipe.lemonsPerCup,
          sugar: prev.inventory.sugar - prev.recipe.sugarPerCup,
          cups: prev.inventory.cups - 1,
          ice: prev.inventory.ice - prev.recipe.icePerCup
        },
        dailyStats: {
          ...prev.dailyStats,
          cupsSold: prev.dailyStats.cupsSold + 1,
          revenue: prev.dailyStats.revenue + prev.recipe.price,
          profit: prev.dailyStats.profit + (prev.recipe.price - cost),
          customersServed: prev.dailyStats.customersServed + 1
        },
        reputation: Math.min(100, prev.reputation + (satisfaction > 80 ? 2 : 1)),
        experience: prev.experience + 10
      }));

      setAnimatedMoney(prev => prev + gameState.recipe.price);
    } else {
      setGameState(prev => ({
        ...prev,
        reputation: Math.max(0, prev.reputation - 1),
        dailyStats: {
          ...prev.dailyStats,
          customersServed: prev.dailyStats.customersServed + 1
        }
      }));
    }

    // Actualizar nivel basado en experiencia
    setGameState(prev => {
      const newLevel = Math.floor(prev.experience / 50) + 1; // Nuevo nivel cada 50 puntos de experiencia
      return {
        ...prev,
        level: newLevel
      };
    });

    // Remover cliente actual y continuar con la cola
    setCurrentCustomer(null);
    setCustomerQueue(prev => prev.slice(1));
  }, [currentCustomer, gameState, calculateSatisfaction]);

  // Iniciar modo venta
  const startSelling = useCallback(() => {
    if (gameState.inventory.cups === 0 || gameState.inventory.lemons < gameState.recipe.lemonsPerCup) {
      alert("¡No tienes suficientes ingredientes para hacer limonada!");
      return;
    }

    setIsSellingMode(true);
    
    // Generar clientes
    const numberOfCustomers = Math.floor(
      Math.random() * 8 + 3 * 
      locations[gameState.location].footTraffic * 
      weatherEffects[gameState.weather].multiplier
    );

    const customers = Array.from({ length: numberOfCustomers }, generateCustomer);
    setCustomerQueue(customers);
  }, [gameState, generateCustomer]);

  // Comprar ingredientes
  const buyIngredient = useCallback((ingredient: keyof GameState['inventory'], amount: number, cost: number) => {
    if (gameState.money >= cost) {
      setGameState(prev => ({
        ...prev,
        money: prev.money - cost,
        inventory: {
          ...prev.inventory,
          [ingredient]: prev.inventory[ingredient] + amount
        }
      }));
    }
  }, [gameState.money]);

  // Verificar logros
  const checkAchievements = useCallback((stats: any) => {
    const newAchievements = [];
    
    // Primera venta
    if (stats.cupsSold >= 1 && !gameState.achievements.includes('first-sale')) {
      newAchievements.push('first-sale');
    }
    
    // Día rentable
    if (stats.profit > 0 && !gameState.achievements.includes('profit-day')) {
      newAchievements.push('profit-day');
    }
    
    // Vendedor eficiente
    if (stats.cupsSold >= 20 && !gameState.achievements.includes('efficient-seller')) {
      newAchievements.push('efficient-seller');
    }
    
    // Magnate de negocios
    if (gameState.money >= 100 && !gameState.achievements.includes('business-tycoon')) {
      newAchievements.push('business-tycoon');
    }
    
    // Cliente favorito
    if (gameState.reputation >= 90 && !gameState.achievements.includes('customer-favorite')) {
      newAchievements.push('customer-favorite');
    }
    
    // Superviviente semanal
    if (gameState.day >= 7 && !gameState.achievements.includes('week-survivor')) {
      newAchievements.push('week-survivor');
    }
    
    if (newAchievements.length > 0) {
      setGameState(prev => ({
        ...prev,
        achievements: [...prev.achievements, ...newAchievements]
      }));
      
      // Mostrar el primer logro desbloqueado
      const achievement = achievements.find(a => a.id === newAchievements[0]);
      if (achievement) {
        setShowAchievement(achievement);
        setTimeout(() => setShowAchievement(null), 3000);
      }
    }
  }, [gameState.achievements, gameState.money, gameState.reputation, gameState.day]);

  // Siguiente día
  const nextDay = useCallback(() => {
    const locationCost = locations[gameState.location].rentCost;
    const nextDayNumber = gameState.day + 1;
    
    // Verificar logros antes de cambiar de día
    checkAchievements(gameState.dailyStats);
    
    // Verificar evento especial
    const dayEvent = specialEvents.find(event => event.day === nextDayNumber);
    if (dayEvent) {
      setCurrentEvent(dayEvent);
    }
    
    setGameState(prev => ({
      ...prev,
      day: nextDayNumber,
      weather: generateWeather(),
      temperature: Math.random() * 20 + 65, // 65-85°F
      money: prev.money - locationCost,
      dailyStats: {
        cupsSold: 0,
        revenue: 0,
        profit: 0,
        customersServed: 0
      }
    }));

    setIsSellingMode(false);
    setCustomerQueue([]);
    setCurrentCustomer(null);
  }, [gameState, generateWeather, checkAchievements]);

  // Efectos
  useEffect(() => {
    if (customerQueue.length > 0 && !currentCustomer && isSellingMode) {
      setCurrentCustomer(customerQueue[0]);
    }
  }, [customerQueue, currentCustomer, isSellingMode]);

  useEffect(() => {
    if (animatedMoney > 0) {
      const timer = setTimeout(() => setAnimatedMoney(0), 1000);
      return () => clearTimeout(timer);
    }
  }, [animatedMoney]);

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-gradient-to-br from-yellow-50 to-orange-50 p-6">
        {/* Header */}
        <div className="mb-6 text-center">
          <h1 className="text-4xl font-bold text-orange-600 mb-2">
            🍋 Tu Stand de Limonada 🍋
          </h1>
          <p className="text-lg text-gray-600">
            ¡Aprende a ser un emprendedor exitoso vendiendo limonada!
          </p>
        </div>

        {/* Stats Bar */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <Card className="bg-green-50 border-green-200">
            <CardContent className="p-4 text-center">
              <DollarSign className="h-8 w-8 text-green-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-green-700">
                ${gameState.money.toFixed(2)}
                {animatedMoney > 0 && (
                  <span className="text-sm text-green-500 block animate-bounce">
                    +${animatedMoney.toFixed(2)}
                  </span>
                )}
              </div>
              <div className="text-sm text-gray-600">Dinero</div>
            </CardContent>
          </Card>

          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="p-4 text-center">
              <Calendar className="h-8 w-8 text-blue-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-blue-700">
                Día {gameState.day}
              </div>
              <div className="text-sm text-gray-600">Jornada</div>
            </CardContent>
          </Card>

          <Card className="bg-purple-50 border-purple-200">
            <CardContent className="p-4 text-center">
              <Star className="h-8 w-8 text-purple-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-purple-700">
                {gameState.reputation}
              </div>
              <div className="text-sm text-gray-600">Reputación</div>
            </CardContent>
          </Card>

          <Card className="bg-orange-50 border-orange-200">
            <CardContent className="p-4 text-center">
              <Trophy className="h-8 w-8 text-orange-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-orange-700">
                Nivel {gameState.level}
              </div>
              <div className="text-sm text-gray-600">Experiencia</div>
            </CardContent>
          </Card>

          <Card className="bg-yellow-50 border-yellow-200">
            <CardContent className="p-4 text-center">
              <MapPin className="h-8 w-8 text-yellow-600 mx-auto mb-2" />
              <div className="text-lg font-bold text-yellow-700">
                {locations[gameState.location].emoji}
              </div>
              <div className="text-sm text-gray-600">
                {locations[gameState.location].name}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Game Area */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Stand Visualization */}
          <div className="lg:col-span-2">
            <Card className="h-96 relative overflow-hidden bg-gradient-to-b from-sky-200 to-green-200">
              <CardContent className="p-6 h-full relative">
                {/* Weather Animation */}
                <WeatherAnimation weather={gameState.weather} />
                
                {/* Weather Badge */}
                <div className="absolute top-4 right-4">
                  <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${weatherEffects[gameState.weather].color} bg-white shadow-sm`}>
                    {React.createElement(weatherEffects[gameState.weather].icon, { 
                      className: `h-5 w-5 mr-2 ${weatherEffects[gameState.weather].color}` 
                    })}
                    {gameState.temperature}°F
                  </div>
                </div>

                {/* Floating Money Animation */}
                <FloatingMoney amount={animatedMoney} isVisible={animatedMoney > 0} />

                {/* Stand with Animation */}
                <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2">
                  <StandAnimation isActive={isSellingMode}>
                    <div className="bg-orange-300 w-48 h-32 rounded-t-lg border-4 border-orange-600 relative hover:shadow-lg transition-shadow duration-300">
                      <div className="absolute -top-4 left-4 right-4 bg-red-500 h-6 rounded-full animate-pulse"></div>
                      <div className="p-4 text-center">
                        <h3 className="text-xl font-bold text-orange-900 mb-2">
                          🍋 Limonada Fresca 🍋
                        </h3>
                        <div className="text-2xl font-bold text-green-700">
                          ${gameState.recipe.price.toFixed(2)}
                        </div>
                      </div>
                    </div>
                  </StandAnimation>
                </div>

                {/* Customer with Enhanced Animation */}
                {currentCustomer && (
                  <div className="absolute bottom-32 right-8">
                    <BouncingCustomer 
                      emoji={currentCustomer.emoji}
                      name={currentCustomer.name}
                      mood={calculateSatisfaction(currentCustomer) > 80 ? 'happy' : 
                            calculateSatisfaction(currentCustomer) > 50 ? 'neutral' : 'sad'}
                    />
                    <div className="bg-yellow-100 px-2 py-1 rounded text-xs mt-2 text-center animate-pulse">
                      {currentCustomer.pricePreference === 'cheap' && '💰 Busca barato'}
                      {currentCustomer.pricePreference === 'value' && '⚖️ Busca valor'}
                      {currentCustomer.pricePreference === 'premium' && '👑 Busca premium'}
                    </div>
                  </div>
                )}

                {/* Queue with Animation */}
                {customerQueue.length > 1 && (
                  <div className="absolute bottom-40 left-8 flex space-x-2 items-center">
                    <div className="text-sm font-semibold text-gray-700 mb-2 animate-pulse">Cola:</div>
                    {customerQueue.slice(1, 4).map((customer, index) => (
                      <PulsingIcon key={customer.id} isActive={true}>
                        <div className="text-2xl">
                          {customer.emoji}
                        </div>
                      </PulsingIcon>
                    ))}
                    {customerQueue.length > 4 && (
                      <div className="text-sm text-gray-600 bg-white px-2 py-1 rounded-full animate-bounce">
                        +{customerQueue.length - 4}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Controls */}
          <div className="space-y-4">
            {/* Recipe Card */}
            <Card className="bg-gradient-to-r from-yellow-100 to-orange-100 border-yellow-300">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <span>👨‍🍳</span>
                  <span>Tu Receta</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center">
                  <span>🍋 Limones:</span>
                  <span className="font-bold">{gameState.recipe.lemonsPerCup}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>🍯 Azúcar:</span>
                  <span className="font-bold">{gameState.recipe.sugarPerCup}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>🧊 Hielo:</span>
                  <span className="font-bold">{gameState.recipe.icePerCup}</span>
                </div>
                <div className="flex justify-between items-center border-t pt-2">
                  <span>💰 Precio:</span>
                  <span className="font-bold text-green-600">
                    ${gameState.recipe.price.toFixed(2)}
                  </span>
                </div>
                <Button 
                  onClick={() => setShowRecipeDialog(true)}
                  className="w-full"
                  variant="outline"
                >
                  <Settings className="h-4 w-4 mr-2" />
                  Cambiar Receta
                </Button>
              </CardContent>
            </Card>

            {/* Inventory Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Package className="h-5 w-5" />
                  <span>Inventario</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between">
                  <span>🍋 Limones:</span>
                  <span className={gameState.inventory.lemons < 5 ? 'text-red-600 font-bold' : ''}>
                    {gameState.inventory.lemons}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>🍯 Azúcar:</span>
                  <span className={gameState.inventory.sugar < 5 ? 'text-red-600 font-bold' : ''}>
                    {gameState.inventory.sugar}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>🥤 Vasos:</span>
                  <span className={gameState.inventory.cups < 5 ? 'text-red-600 font-bold' : ''}>
                    {gameState.inventory.cups}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>🧊 Hielo:</span>
                  <span className={gameState.inventory.ice < 5 ? 'text-red-600 font-bold' : ''}>
                    {gameState.inventory.ice}
                  </span>
                </div>
                <Button 
                  onClick={() => setIsShopOpen(true)}
                  className="w-full mt-3"
                  variant="outline"
                >
                  <ShoppingCart className="h-4 w-4 mr-2" />
                  Comprar Ingredientes
                </Button>
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <div className="space-y-2">
              {!isSellingMode ? (
                <>
                  <Button 
                    onClick={startSelling}
                    className="w-full bg-green-600 hover:bg-green-700 text-white py-3"
                    size="lg"
                  >
                    <Zap className="h-5 w-5 mr-2" />
                    ¡Empezar a Vender!
                  </Button>
                  
                  <Button 
                    onClick={nextDay}
                    variant="outline"
                    className="w-full"
                  >
                    <Timer className="h-4 w-4 mr-2" />
                    Terminar Día
                  </Button>
                </>
              ) : (
                <div className="space-y-2">
                  {currentCustomer ? (
                    <Button 
                      onClick={serveCustomer}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3"
                      size="lg"
                    >
                      <Users className="h-5 w-5 mr-2" />
                      Servir a {currentCustomer.name}
                    </Button>
                  ) : (
                    <div className="text-center p-4">
                      <p className="text-gray-600">
                        {customerQueue.length > 0 
                          ? "Preparando al siguiente cliente..." 
                          : "¡Ya no hay más clientes por hoy!"
                        }
                      </p>
                      {customerQueue.length === 0 && (
                        <Button 
                          onClick={() => setIsSellingMode(false)}
                          className="w-full mt-2"
                          variant="outline"
                        >
                          Parar Ventas
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Daily Stats */}
        {gameState.dailyStats.customersServed > 0 && (
          <div className="mt-6 space-y-4">
            <Card className="bg-gradient-to-r from-green-50 to-blue-50 border-green-200">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <BarChart3 className="h-5 w-5" />
                  <span>Estadísticas del Día {gameState.day}</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {gameState.dailyStats.cupsSold}
                    </div>
                    <div className="text-sm text-gray-600">Vasos Vendidos</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      ${gameState.dailyStats.revenue.toFixed(2)}
                    </div>
                    <div className="text-sm text-gray-600">Ingresos</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">
                      ${gameState.dailyStats.profit.toFixed(2)}
                    </div>
                    <div className="text-sm text-gray-600">Ganancia</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-600">
                      {gameState.dailyStats.customersServed}
                    </div>
                    <div className="text-sm text-gray-600">Clientes Atendidos</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Educational Content */}
            <Card className="bg-gradient-to-r from-orange-50 to-yellow-50 border-orange-200">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Lightbulb className="h-5 w-5 text-orange-600" />
                  <span>💡 ¡Aprende Emprendimiento!</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Daily Lesson */}
                  <div className="bg-white p-4 rounded-lg border-l-4 border-orange-400">
                    <h4 className="font-bold text-orange-800 mb-2">
                      📚 Concepto del Día {gameState.day}:
                    </h4>
                    <p className="text-gray-700">
                      {gameState.day === 1 && "Los INGRESOS son todo el dinero que entra a tu negocio cuando vendes productos. Los GASTOS son el dinero que gastas en ingredientes y otros costos."}
                      {gameState.day === 2 && "La GANANCIA (o utilidad) es la diferencia entre tus ingresos y gastos. Si vendes por $10 pero gastas $6 en ingredientes, tu ganancia es $4."}
                      {gameState.day === 3 && "El PRECIO afecta las ventas. Si tu precio es muy alto, pocos comprarán. Si es muy bajo, ganarás menos dinero por cada vaso."}
                      {gameState.day === 4 && "La UBICACIÓN importa mucho en los negocios. Lugares con más personas (tráfico) usualmente generan más ventas, pero pueden costar más."}
                      {gameState.day === 5 && "Los factores EXTERNOS como el clima pueden afectar tu negocio. Un buen emprendedor se adapta a estas situaciones."}
                      {gameState.day > 5 && "La REPUTACIÓN es clave para el éxito a largo plazo. Clientes felices regresan y recomiendan tu negocio a otros."}
                    </p>
                  </div>

                  {/* Performance Analysis */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-blue-50 p-3 rounded-lg">
                      <h5 className="font-semibold text-blue-800 mb-1">📊 Tu Rendimiento:</h5>
                      <p className="text-sm text-blue-700">
                        {gameState.dailyStats.profit > 5 ? 
                          "¡Excelente! Tienes buenas ganancias. Sigue así." :
                          gameState.dailyStats.profit > 0 ?
                          "Bien, estás ganando dinero. Trata de optimizar costos." :
                          "Cuidado, estás perdiendo dinero. Revisa tus precios y gastos."
                        }
                      </p>
                    </div>
                    
                    <div className="bg-green-50 p-3 rounded-lg">
                      <h5 className="font-semibold text-green-800 mb-1">💡 Consejo:</h5>
                      <p className="text-sm text-green-700">
                        {gameState.weather === 'sunny' ? 
                          "Días soleados = más ventas. Considera subir el precio ligeramente." :
                          gameState.weather === 'rainy' ?
                          "Días lluviosos = menos clientes. Tal vez baja el precio para atraer más." :
                          gameState.weather === 'cold' ?
                          "Hace frío, pocos querrán limonada. Considera otras estrategias." :
                          "El clima está normal, mantén tu estrategia actual."
                        }
                      </p>
                    </div>
                  </div>

                  {/* Business Concepts */}
                  <div className="bg-purple-50 p-4 rounded-lg">
                    <h5 className="font-semibold text-purple-800 mb-2">🏆 Conceptos Importantes:</h5>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                      <div className="text-center">
                        <div className="text-xl mb-1">💰</div>
                        <div className="font-semibold">Punto de Equilibrio</div>
                        <div className="text-xs text-gray-600">Vender suficiente para cubrir gastos</div>
                      </div>
                      <div className="text-center">
                        <div className="text-xl mb-1">📈</div>
                        <div className="font-semibold">Oferta y Demanda</div>
                        <div className="text-xs text-gray-600">Más clientes = puedes subir precios</div>
                      </div>
                      <div className="text-center">
                        <div className="text-xl mb-1">⚖️</div>
                        <div className="font-semibold">Calidad vs Precio</div>
                        <div className="text-xs text-gray-600">Mejores ingredientes = precios más altos</div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Achievements Section */}
            <Card className="bg-gradient-to-r from-yellow-50 to-amber-50 border-yellow-200">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Trophy className="h-5 w-5 text-yellow-600" />
                  <span>🏆 Logros Desbloqueados</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {achievements.map((achievement) => (
                    <div 
                      key={achievement.id} 
                      className={`p-3 rounded-lg border transition-all duration-300 ${
                        gameState.achievements.includes(achievement.id)
                          ? 'bg-yellow-100 border-yellow-300 shadow-md transform scale-105'
                          : 'bg-gray-100 border-gray-200 opacity-50'
                      }`}
                    >
                      <div className="text-center">
                        <div className={`text-2xl mb-1 ${
                          gameState.achievements.includes(achievement.id) ? 'animate-bounce' : 'grayscale'
                        }`}>
                          {achievement.icon}
                        </div>
                        <div className={`font-semibold text-sm ${
                          gameState.achievements.includes(achievement.id) ? 'text-yellow-700' : 'text-gray-400'
                        }`}>
                          {achievement.name}
                        </div>
                        <div className={`text-xs ${
                          gameState.achievements.includes(achievement.id) ? 'text-yellow-600' : 'text-gray-400'
                        }`}>
                          {achievement.description}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                
                <div className="mt-4 text-center">
                  <div className="text-sm text-gray-600">
                    Progreso: {gameState.achievements.length}/{achievements.length} logros desbloqueados
                  </div>
                  <Progress 
                    value={(gameState.achievements.length / achievements.length) * 100} 
                    className="mt-2"
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Event Notification */}
        {currentEvent && (
          <Card className="fixed top-4 right-4 z-50 max-w-sm bg-gradient-to-r from-purple-500 to-pink-500 text-white animate-bounce">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-bold">{currentEvent.title}</h3>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setCurrentEvent(null)}
                  className="text-white hover:bg-white/20"
                >
                  ✕
                </Button>
              </div>
              <p className="text-sm">{currentEvent.description}</p>
            </CardContent>
          </Card>
        )}

        {/* Achievement Notification */}
        {showAchievement && (
          <SuccessAnimation 
            isVisible={!!showAchievement}
            message={`${showAchievement.icon} ${showAchievement.name} Desbloqueado!`}
          />
        )}

        {/* Shop Dialog */}
        <Dialog open={isShopOpen} onOpenChange={setIsShopOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>🛒 Tienda de Ingredientes</DialogTitle>
              <DialogDescription>
                Compra ingredientes para hacer más limonada. ¡Los precios pueden cambiar!
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <span className="text-2xl">🍋</span>
                  <div>
                    <div className="font-semibold">Limones (x10)</div>
                    <div className="text-sm text-gray-600">Ingrediente principal</div>
                  </div>
                </div>
                <Button
                  onClick={() => buyIngredient('lemons', 10, 5)}
                  disabled={gameState.money < 5}
                  size="sm"
                >
                  $5.00
                </Button>
              </div>

              <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <span className="text-2xl">🍯</span>
                  <div>
                    <div className="font-semibold">Azúcar (x10)</div>
                    <div className="text-sm text-gray-600">Para endulzar</div>
                  </div>
                </div>
                <Button
                  onClick={() => buyIngredient('sugar', 10, 3)}
                  disabled={gameState.money < 3}
                  size="sm"
                >
                  $3.00
                </Button>
              </div>

              <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <span className="text-2xl">🥤</span>
                  <div>
                    <div className="font-semibold">Vasos (x20)</div>
                    <div className="text-sm text-gray-600">Para servir</div>
                  </div>
                </div>
                <Button
                  onClick={() => buyIngredient('cups', 20, 4)}
                  disabled={gameState.money < 4}
                  size="sm"
                >
                  $4.00
                </Button>
              </div>

              <div className="flex items-center justify-between p-3 bg-cyan-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <span className="text-2xl">🧊</span>
                  <div>
                    <div className="font-semibold">Hielo (x15)</div>
                    <div className="text-sm text-gray-600">Para refrescar</div>
                  </div>
                </div>
                <Button
                  onClick={() => buyIngredient('ice', 15, 2)}
                  disabled={gameState.money < 2}
                  size="sm"
                >
                  $2.00
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Recipe Dialog */}
        <Dialog open={showRecipeDialog} onOpenChange={setShowRecipeDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>👨‍🍳 Ajustar Receta</DialogTitle>
              <DialogDescription>
                Cambia los ingredientes y el precio para satisfacer a diferentes clientes
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-6 py-4">
              <div>
                <Label>🍋 Limones por vaso</Label>
                <div className="flex items-center space-x-4 mt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setGameState(prev => ({
                      ...prev,
                      recipe: { ...prev.recipe, lemonsPerCup: Math.max(1, prev.recipe.lemonsPerCup - 1) }
                    }))}
                  >
                    -
                  </Button>
                  <span className="text-xl font-bold w-12 text-center">
                    {gameState.recipe.lemonsPerCup}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setGameState(prev => ({
                      ...prev,
                      recipe: { ...prev.recipe, lemonsPerCup: Math.min(5, prev.recipe.lemonsPerCup + 1) }
                    }))}
                  >
                    +
                  </Button>
                </div>
              </div>

              <div>
                <Label>🍯 Azúcar por vaso</Label>
                <div className="flex items-center space-x-4 mt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setGameState(prev => ({
                      ...prev,
                      recipe: { ...prev.recipe, sugarPerCup: Math.max(0, prev.recipe.sugarPerCup - 1) }
                    }))}
                  >
                    -
                  </Button>
                  <span className="text-xl font-bold w-12 text-center">
                    {gameState.recipe.sugarPerCup}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setGameState(prev => ({
                      ...prev,
                      recipe: { ...prev.recipe, sugarPerCup: Math.min(4, prev.recipe.sugarPerCup + 1) }
                    }))}
                  >
                    +
                  </Button>
                </div>
              </div>

              <div>
                <Label>🧊 Hielo por vaso</Label>
                <div className="flex items-center space-x-4 mt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setGameState(prev => ({
                      ...prev,
                      recipe: { ...prev.recipe, icePerCup: Math.max(0, prev.recipe.icePerCup - 1) }
                    }))}
                  >
                    -
                  </Button>
                  <span className="text-xl font-bold w-12 text-center">
                    {gameState.recipe.icePerCup}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setGameState(prev => ({
                      ...prev,
                      recipe: { ...prev.recipe, icePerCup: Math.min(4, prev.recipe.icePerCup + 1) }
                    }))}
                  >
                    +
                  </Button>
                </div>
              </div>

              <div>
                <Label>💰 Precio por vaso</Label>
                <div className="flex items-center space-x-4 mt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setGameState(prev => ({
                      ...prev,
                      recipe: { ...prev.recipe, price: Math.max(0.25, prev.recipe.price - 0.25) }
                    }))}
                  >
                    -$0.25
                  </Button>
                  <span className="text-xl font-bold w-20 text-center">
                    ${gameState.recipe.price.toFixed(2)}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setGameState(prev => ({
                      ...prev,
                      recipe: { ...prev.recipe, price: Math.min(5.00, prev.recipe.price + 0.25) }
                    }))}
                  >
                    +$0.25
                  </Button>
                </div>
              </div>

              <div className="bg-blue-50 p-4 rounded-lg">
                <h4 className="font-semibold text-blue-800 mb-2">💡 Consejos:</h4>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li>• Más limones = mejor sabor pero más caro</li>
                  <li>• Los días calurosos necesitan más hielo</li>
                  <li>• Ajusta el precio según el clima</li>
                  <li>• Observa las preferencias de los clientes</li>
                </ul>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}