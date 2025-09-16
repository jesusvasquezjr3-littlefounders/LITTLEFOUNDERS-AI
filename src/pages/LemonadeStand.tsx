import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Store, 
  Sun, 
  Cloud, 
  CloudRain,
  TrendingUp,
  TrendingDown,
  ArrowLeft,
  Calendar,
  DollarSign,
  Package
} from "lucide-react";
import { cn } from "@/lib/utils";

// Tipos para el juego
type Weather = "sunny" | "cloudy" | "rainy";
type GamePhase = "setup" | "results" | "gameover";

interface Inventory {
  lemons: number;
  sugar: number;
  cups: number;
}

interface DayResult {
  day: number;
  weather: Weather;
  investment: number;
  revenue: number;
  profit: number;
  cupsSold: number;
}

// Constantes del juego
const PRICES = {
  lemon: 0.5,   // $0.50 por limón
  sugar: 0.25,  // $0.25 por azúcar
  cup: 0.1      // $0.10 por vaso
};

const WEATHER_EFFECTS = {
  sunny: { multiplier: 1.5, description: "¡Día soleado! Mucha gente quiere limonada" },
  cloudy: { multiplier: 1.0, description: "Día nublado. Ventas normales" },
  rainy: { multiplier: 0.3, description: "Lluvia... Pocas ventas hoy" }
};

const WEATHER_ICONS = {
  sunny: Sun,
  cloudy: Cloud,
  rainy: CloudRain
};

const LemonadeStand = () => {
  const navigate = useNavigate();
  
  // Estados del juego
  const [money, setMoney] = useState(100);
  const [day, setDay] = useState(1);
  const [phase, setPhase] = useState<GamePhase>("setup");
  const [inventory, setInventory] = useState<Inventory>({ lemons: 0, sugar: 0, cups: 0 });
  const [purchases, setPurchases] = useState<Inventory>({ lemons: 0, sugar: 0, cups: 0 });
  const [weather, setWeather] = useState<Weather>("sunny");
  const [dayResults, setDayResults] = useState<DayResult[]>([]);
  const [lastDayResult, setLastDayResult] = useState<DayResult | null>(null);

  // Generar clima aleatorio
  const generateWeather = (): Weather => {
    const random = Math.random();
    if (random < 0.5) return "sunny";
    if (random < 0.8) return "cloudy";
    return "rainy";
  };

  // Calcular costo total de compras
  const getTotalCost = () => {
    return (purchases.lemons * PRICES.lemon) + 
           (purchases.sugar * PRICES.sugar) + 
           (purchases.cups * PRICES.cup);
  };

  // Manejar cambios en las compras
  const handlePurchaseChange = (item: keyof Inventory, value: string) => {
    const numValue = Math.max(0, parseInt(value) || 0);
    setPurchases(prev => ({
      ...prev,
      [item]: numValue
    }));
  };

  // Iniciar día (fase de venta)
  const startDay = () => {
    const totalCost = getTotalCost();
    
    if (totalCost > money) {
      alert("¡No tienes suficiente dinero para esas compras!");
      return;
    }

    if (purchases.lemons === 0 || purchases.sugar === 0 || purchases.cups === 0) {
      alert("¡Necesitas comprar al menos 1 de cada ingrediente!");
      return;
    }

    // Actualizar inventario y dinero
    const newInventory = {
      lemons: inventory.lemons + purchases.lemons,
      sugar: inventory.sugar + purchases.sugar,
      cups: inventory.cups + purchases.cups
    };
    
    setInventory(newInventory);
    setMoney(prev => prev - totalCost);
    
    // Generar clima y simular ventas
    const todayWeather = generateWeather();
    setWeather(todayWeather);
    
    // Calcular ventas
    const maxCups = Math.min(newInventory.lemons, newInventory.sugar, newInventory.cups);
    const baseCustomers = Math.floor(Math.random() * 20) + 10; // 10-30 clientes base
    const weatherMultiplier = WEATHER_EFFECTS[todayWeather].multiplier;
    const actualCustomers = Math.floor(baseCustomers * weatherMultiplier);
    const cupsSold = Math.min(maxCups, actualCustomers);
    
    // Precio de venta: $1 por vaso
    const revenue = cupsSold * 1.0;
    const profit = revenue - totalCost;
    
    // Actualizar inventario después de las ventas
    const remainingInventory = {
      lemons: newInventory.lemons - cupsSold,
      sugar: newInventory.sugar - cupsSold,
      cups: newInventory.cups - cupsSold
    };
    
    setInventory(remainingInventory);
    setMoney(prev => prev + revenue);
    
    // Guardar resultado del día
    const dayResult: DayResult = {
      day,
      weather: todayWeather,
      investment: totalCost,
      revenue,
      profit,
      cupsSold
    };
    
    setLastDayResult(dayResult);
    setDayResults(prev => [...prev, dayResult]);
    setPurchases({ lemons: 0, sugar: 0, cups: 0 });
    setPhase("results");
  };

  // Continuar al siguiente día
  const nextDay = () => {
    if (money < 1) {
      setPhase("gameover");
      return;
    }
    
    setDay(prev => prev + 1);
    setPhase("setup");
    setLastDayResult(null);
  };

  // Reiniciar juego
  const resetGame = () => {
    setMoney(100);
    setDay(1);
    setPhase("setup");
    setInventory({ lemons: 0, sugar: 0, cups: 0 });
    setPurchases({ lemons: 0, sugar: 0, cups: 0 });
    setDayResults([]);
    setLastDayResult(null);
  };

  // Renderizado según la fase del juego
  if (phase === "gameover") {
    const totalProfit = dayResults.reduce((sum, result) => sum + result.profit, 0);
    const totalRevenue = dayResults.reduce((sum, result) => sum + result.revenue, 0);
    
    return (
      <DashboardLayout>
        <div className="container mx-auto p-6 max-w-4xl">
          <div className="text-center space-y-6">
            <div className="space-y-4">
              <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                <h1 className="text-3xl font-bold text-red-700 mb-2">¡Juego Terminado!</h1>
                <p className="text-red-600">Te quedaste sin suficiente dinero para continuar</p>
              </div>
              
              <div className="grid md:grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="text-center pb-2">
                    <CardTitle className="text-lg">Días Jugados</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-center">{day - 1}</div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader className="text-center pb-2">
                    <CardTitle className="text-lg">Ingresos Totales</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600 text-center">
                      ${totalRevenue.toFixed(2)}
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader className="text-center pb-2">
                    <CardTitle className="text-lg">Ganancia Neta</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className={cn(
                      "text-2xl font-bold text-center",
                      totalProfit >= 0 ? "text-green-600" : "text-red-600"
                    )}>
                      ${totalProfit.toFixed(2)}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
            
            <div className="space-x-4">
              <Button onClick={resetGame} size="lg">
                Jugar de Nuevo
              </Button>
              <Button onClick={() => navigate("/investment-games")} variant="outline" size="lg">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Volver al Menú
              </Button>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="container mx-auto p-6 space-y-6 max-w-6xl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Button 
              onClick={() => navigate("/investment-games")} 
              variant="outline" 
              size="sm"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Volver
            </Button>
            <div className="flex items-center space-x-3">
              <Store className="w-8 h-8 text-yellow-600" />
              <h1 className="text-3xl font-bold">Stand de Limonada</h1>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <Badge variant="outline" className="text-lg px-3 py-1">
              <Calendar className="w-4 h-4 mr-1" />
              Día {day}
            </Badge>
            <Badge variant="default" className="text-lg px-3 py-1">
              <DollarSign className="w-4 h-4 mr-1" />
              ${money.toFixed(2)}
            </Badge>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Panel Principal */}
          <div className="lg:col-span-2 space-y-6">
            {phase === "setup" && (
              <>
                {/* Inventario Actual */}
                {(inventory.lemons > 0 || inventory.sugar > 0 || inventory.cups > 0) && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center">
                        <Package className="w-5 h-5 mr-2" />
                        Inventario Actual
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-3 gap-4">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-yellow-600">{inventory.lemons}</div>
                          <div className="text-sm text-muted-foreground">Limones</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-white">{inventory.sugar}</div>
                          <div className="text-sm text-muted-foreground">Azúcar (kg)</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-blue-600">{inventory.cups}</div>
                          <div className="text-sm text-muted-foreground">Vasos</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Compras */}
                <Card>
                  <CardHeader>
                    <CardTitle>Comprar Suministros</CardTitle>
                    <CardDescription>
                      Decide cuánto comprar para el día de hoy
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="text-sm font-medium">
                          Limones (${PRICES.lemon} c/u)
                        </label>
                        <Input
                          type="number"
                          min="0"
                          value={purchases.lemons}
                          onChange={(e) => handlePurchaseChange('lemons', e.target.value)}
                          placeholder="0"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium">
                          Azúcar (${PRICES.sugar} por kg)
                        </label>
                        <Input
                          type="number"
                          min="0"
                          value={purchases.sugar}
                          onChange={(e) => handlePurchaseChange('sugar', e.target.value)}
                          placeholder="0"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium">
                          Vasos (${PRICES.cup} c/u)
                        </label>
                        <Input
                          type="number"
                          min="0"
                          value={purchases.cups}
                          onChange={(e) => handlePurchaseChange('cups', e.target.value)}
                          placeholder="0"
                        />
                      </div>
                    </div>
                    
                    <div className="border-t pt-4">
                      <div className="flex justify-between items-center text-lg font-semibold">
                        <span>Costo Total:</span>
                        <span>${getTotalCost().toFixed(2)}</span>
                      </div>
                      <Button 
                        onClick={startDay} 
                        className="w-full mt-4" 
                        size="lg"
                        disabled={getTotalCost() > money}
                      >
                        Abrir Stand del Día
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}

            {phase === "results" && lastDayResult && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Resultados del Día {lastDayResult.day}</CardTitle>
                    <div className="flex items-center space-x-2">
                      {(() => {
                        const WeatherIcon = WEATHER_ICONS[lastDayResult.weather];
                        return (
                          <>
                            <WeatherIcon className="w-6 h-6" />
                            <Badge variant="outline">
                              {WEATHER_EFFECTS[lastDayResult.weather].description}
                            </Badge>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center">
                      <div className="text-xl font-bold text-blue-600">
                        {lastDayResult.cupsSold}
                      </div>
                      <div className="text-sm text-muted-foreground">Vasos Vendidos</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xl font-bold text-red-600">
                        ${lastDayResult.investment.toFixed(2)}
                      </div>
                      <div className="text-sm text-muted-foreground">Inversión</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xl font-bold text-green-600">
                        ${lastDayResult.revenue.toFixed(2)}
                      </div>
                      <div className="text-sm text-muted-foreground">Ingresos</div>
                    </div>
                    <div className="text-center">
                      <div className={cn(
                        "text-xl font-bold flex items-center justify-center",
                        lastDayResult.profit >= 0 ? "text-green-600" : "text-red-600"
                      )}>
                        {lastDayResult.profit >= 0 ? (
                          <TrendingUp className="w-4 h-4 mr-1" />
                        ) : (
                          <TrendingDown className="w-4 h-4 mr-1" />
                        )}
                        ${lastDayResult.profit.toFixed(2)}
                      </div>
                      <div className="text-sm text-muted-foreground">Ganancia</div>
                    </div>
                  </div>
                  
                  <Button onClick={nextDay} className="w-full" size="lg">
                    Continuar al Día {day + 1}
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Panel Lateral */}
          <div className="space-y-6">
            {/* Historial */}
            {dayResults.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Historial</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {dayResults.slice(-5).reverse().map((result) => {
                      const WeatherIcon = WEATHER_ICONS[result.weather];
                      return (
                        <div key={result.day} className="flex items-center justify-between text-sm border-b pb-2">
                          <div className="flex items-center space-x-2">
                            <span className="font-medium">Día {result.day}</span>
                            <WeatherIcon className="w-4 h-4" />
                          </div>
                          <div className={cn(
                            "font-semibold",
                            result.profit >= 0 ? "text-green-600" : "text-red-600"
                          )}>
                            {result.profit >= 0 ? "+" : ""}${result.profit.toFixed(2)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Tips */}
            <Card>
              <CardHeader>
                <CardTitle>💡 Consejos</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="text-sm space-y-2 text-muted-foreground">
                  <li>• Los días soleados aumentan las ventas</li>
                  <li>• Los días lluviosos reducen la demanda</li>
                  <li>• Necesitas los 3 ingredientes para hacer limonada</li>
                  <li>• Cada vaso se vende a $1.00</li>
                  <li>• Administra bien tu dinero para no quebrar</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default LemonadeStand;