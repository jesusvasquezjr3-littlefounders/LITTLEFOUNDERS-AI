import React, { useState, useEffect, useCallback } from "react";
import { DemoDashboardLayout } from "@/components/demo/DemoDashboardLayout";
import {
    FloatingMoney,
    BouncingCustomer,
    WeatherAnimation,
    StandAnimation,
    PulsingIcon,
    SuccessAnimation
} from "@/components/lemonade/GameEffects";
import { DragDropStand } from "@/components/lemonade/DragDropStand";
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

export function DemoLemonadeStand() {
    const [gameState, setGameState] = useState<GameState>({
        day: 1,
        money: 20,
        inventory: { lemons: 10, sugar: 10, cups: 20, ice: 15 },
        recipe: { lemonsPerCup: 2, sugarPerCup: 1, icePerCup: 1, price: 1.0 },
        weather: 'sunny',
        temperature: 24,
        location: 'park',
        customers: [],
        dailyStats: { cupsSold: 0, revenue: 0, profit: 0, customersServed: 0 },
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
    const [isStandBuilt, setIsStandBuilt] = useState(false);
    const [showDragDropMode, setShowDragDropMode] = useState(false);

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
    const generateWeather = useCallback((): GameState['weather'] => {
        const weathers: GameState['weather'][] = ['sunny', 'cloudy', 'rainy', 'cold'];
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

    // Manejar cambios en la receta desde el drag and drop
    const handleRecipeChange = useCallback((recipe: { lemons: number; sugar: number; ice: number; cups: number }) => {
        setGameState(prev => ({
            ...prev,
            recipe: {
                ...prev.recipe,
                lemonsPerCup: recipe.lemons,
                sugarPerCup: recipe.sugar,
                icePerCup: recipe.ice,
                price: Math.max(0.5, recipe.lemons * 0.3 + recipe.sugar * 0.1 + recipe.ice * 0.05 + 0.2) // Precio basado en ingredientes
            }
        }));
    }, []);

    // Manejar construcción del stand
    const handleStandComplete = useCallback((isComplete: boolean) => {
        setIsStandBuilt(isComplete);
    }, []);

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
    const nextDay = useCallback(async () => {
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
            temperature: Math.round(Math.random() * 11 + 18), // 18-29°C
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
        <DemoDashboardLayout>
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
                        {!showDragDropMode ? (
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
                                            {gameState.temperature}°C
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
                        ) : (
                            <DragDropStand
                                onStandComplete={handleStandComplete}
                                onRecipeChange={handleRecipeChange}
                            />
                        )}

                        {/* Controls */}
                        <div className="mt-4 flex space-x-4">
                            <Button
                                onClick={startSelling}
                                disabled={isSellingMode || gameState.day > 7}
                                className="flex-1 bg-green-600 hover:bg-green-700"
                            >
                                {isSellingMode ? "Vendiendo..." : "¡Abrir Puesto!"}
                            </Button>

                            <Button
                                onClick={nextDay}
                                disabled={isSellingMode || gameState.day > 7}
                                variant="outline"
                            >
                                Siguiente Día
                            </Button>

                            <Button
                                variant="outline"
                                onClick={() => setShowDragDropMode(!showDragDropMode)}
                            >
                                {showDragDropMode ? "Ver Stand" : "Editar Stand"}
                            </Button>
                        </div>
                    </div>

                    {/* Sidebar Controls */}
                    <div className="space-y-6">
                        {/* Inventory */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Inventario</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex justify-between items-center">
                                    <span>🍋 Limones: {gameState.inventory.lemons}</span>
                                    <Button size="sm" onClick={() => buyIngredient('lemons', 10, 2)} disabled={gameState.money < 2}>
                                        +10 ($2)
                                    </Button>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span>🍬 Azúcar: {gameState.inventory.sugar}</span>
                                    <Button size="sm" onClick={() => buyIngredient('sugar', 10, 1)} disabled={gameState.money < 1}>
                                        +10 ($1)
                                    </Button>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span>🥤 Vasos: {gameState.inventory.cups}</span>
                                    <Button size="sm" onClick={() => buyIngredient('cups', 20, 2)} disabled={gameState.money < 2}>
                                        +20 ($2)
                                    </Button>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span>🧊 Hielo: {gameState.inventory.ice}</span>
                                    <Button size="sm" onClick={() => buyIngredient('ice', 20, 1)} disabled={gameState.money < 1}>
                                        +20 ($1)
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Recipe */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Receta Actual</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between">
                                        <span>Limones por vaso:</span>
                                        <span className="font-bold">{gameState.recipe.lemonsPerCup}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Azúcar por vaso:</span>
                                        <span className="font-bold">{gameState.recipe.sugarPerCup}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Hielo por vaso:</span>
                                        <span className="font-bold">{gameState.recipe.icePerCup}</span>
                                    </div>
                                    <div className="flex justify-between pt-2 border-t">
                                        <span>Precio de venta:</span>
                                        <span className="font-bold text-green-600">${gameState.recipe.price.toFixed(2)}</span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </DemoDashboardLayout>
    );
}
