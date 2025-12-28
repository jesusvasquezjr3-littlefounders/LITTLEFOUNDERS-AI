import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ThreeDCard } from "@/components/demo/ThreeDCard";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { 
  CreditCard, 
  Eye, 
  EyeOff, 
  Lock, 
  Unlock,
  Send,
  PiggyBank,
  ArrowDownToLine,
  ArrowUpFromLine,
  TrendingUp,
  TrendingDown,
  DollarSign,
  RotateCw,
  RotateCcw,
  Wallet,
  ShoppingBag,
  Receipt,
  HelpCircle,
  Lightbulb
} from "lucide-react";

// Explicaciones sencillas para niños sobre cada tipo de movimiento
const getTransactionExplanation = (description: string): { title: string; explanation: string; tip: string } => {
  const desc = description.toUpperCase();
  
  // Ingresos
  if (desc.includes('MESADA') || desc.includes('NÓMINA')) {
    return {
      title: "💰 Mesada",
      explanation: "Este es el dinero que tus papás te dan regularmente para que aprendas a administrarlo.",
      tip: "Intenta ahorrar una parte de tu mesada cada semana."
    };
  }
  if (desc.includes('TAREA') || desc.includes('COMPLETADA') || desc.includes('ORDENAR')) {
    return {
      title: "✅ Recompensa por Tarea",
      explanation: "Ganaste este dinero por completar una tarea en casa. ¡Buen trabajo!",
      tip: "Mientras más tareas completes, más podrás ahorrar."
    };
  }
  if (desc.includes('BONO') || desc.includes('CALIFICACIONES')) {
    return {
      title: "🌟 Bono Especial",
      explanation: "¡Felicidades! Este es un premio extra por hacer algo muy bien.",
      tip: "Los bonos son especiales, considera guardar parte de ellos."
    };
  }
  if (desc.includes('REGALO')) {
    return {
      title: "🎁 Regalo",
      explanation: "Alguien especial te dio este dinero como regalo.",
      tip: "Es buena idea ahorrar parte de los regalos."
    };
  }

  // Gastos
  if (desc.includes('NINTENDO') || desc.includes('ESHOP')) {
    return {
      title: "🎮 Nintendo eShop",
      explanation: "Compraste algo en la tienda digital de Nintendo, como un juego o monedas virtuales.",
      tip: "Antes de comprar, pregúntate si realmente lo vas a jugar mucho."
    };
  }
  if (desc.includes('OXXO')) {
    return {
      title: "🏪 OXXO",
      explanation: "OXXO es una tienda de conveniencia. El número es el código de la sucursal.",
      tip: "Los snacks pequeños pueden sumar mucho dinero."
    };
  }
  if (desc.includes('SPOTIFY')) {
    return {
      title: "🎵 Spotify",
      explanation: "Servicio de música. Pagas cada mes para escuchar sin anuncios.",
      tip: "Las suscripciones se cobran automáticamente cada mes."
    };
  }
  if (desc.includes('CINÉPOLIS') || desc.includes('CINE')) {
    return {
      title: "🎬 Cine",
      explanation: "Fuiste al cine. El cargo incluye boleto y quizás palomitas.",
      tip: "Ver películas en casa a veces es más económico."
    };
  }
  if (desc.includes('MCDONALD')) {
    return {
      title: "🍔 McDonald's",
      explanation: "Comida rápida. El número es el código del restaurante.",
      tip: "Cocinar en casa es más económico y saludable."
    };
  }
  if (desc.includes('ROBLOX')) {
    return {
      title: "🎮 Roblox",
      explanation: "Probablemente compraste Robux, la moneda del juego.",
      tip: "Las monedas virtuales no se pueden recuperar."
    };
  }
  if (desc.includes('STARBUCKS')) {
    return {
      title: "☕ Starbucks",
      explanation: "Cafetería. El número es el código de la tienda.",
      tip: "Las bebidas de cafetería cuestan más que hacerlas en casa."
    };
  }

  return {
    title: "📋 Movimiento",
    explanation: "El nombre puede parecer extraño porque los bancos usan códigos especiales.",
    tip: "Si no entiendes un cargo, pregunta a tus papás."
  };
};

// Tipos
interface VirtualCardData {
  id: string;
  cardNumber: string;
  holderName: string;
  expiryDate: string;
  cvv: string;
  balance: number;
  isActive: boolean;
  isFrozen: boolean;
  theme: 'gradient-blue' | 'gradient-purple' | 'gradient-green' | 'custom';
  dailyLimit: number;
  transactionLimit: number;
}

interface Transaction {
  id: string;
  type: 'income' | 'expense';
  amount: number;
  description: string;
  date: string;
  category: string;
}

interface AccountBalances {
  available: number;
  savings: number;
  emergency: number;
  total: number;
}

// Funciones de utilidad
const getCurrentUser = () => {
  try {
    const userData = localStorage.getItem('user');
    if (userData) {
      return JSON.parse(userData);
    }
  } catch (error) {
    console.error('Error obteniendo usuario:', error);
  }
  return null;
};

const getCardData = (userId: string): VirtualCardData => {
  try {
    const savedCard = localStorage.getItem(`virtualCard_${userId}`);
    if (savedCard) {
      return JSON.parse(savedCard);
    }
  } catch (error) {
    console.error('Error cargando tarjeta:', error);
  }
  
  // Datos de ejemplo realistas para la tarjeta
  return {
    id: userId,
    cardNumber: "4532 8821 4567 9012",
    holderName: "CARLOS MARTINEZ",
    expiryDate: "09/27",
    cvv: "847",
    balance: 87.50,
    isActive: true,
    isFrozen: false,
    theme: 'gradient-blue',
    dailyLimit: 50.00,
    transactionLimit: 25.00
  };
};

const saveCardData = (userId: string, cardData: VirtualCardData) => {
  try {
    localStorage.setItem(`virtualCard_${userId}`, JSON.stringify(cardData));
  } catch (error) {
    console.error('Error guardando tarjeta:', error);
  }
};

// Datos de ejemplo realistas para el dashboard
const getDummyTransactions = (): Transaction[] => {
  const today = new Date();
  const formatDate = (daysAgo: number) => {
    const date = new Date(today);
    date.setDate(date.getDate() - daysAgo);
    return date.toISOString().split('T')[0];
  };

  return [
    {
      id: "dash_1",
      type: "expense",
      amount: 12.99,
      description: "NINTENDO ESHOP *GAME PURCHASE",
      date: formatDate(0),
      category: "Entretenimiento"
    },
    {
      id: "dash_2",
      type: "income",
      amount: 25.00,
      description: "TRANSFERENCIA - MESADA SEMANAL",
      date: formatDate(0),
      category: "Mesada"
    },
    {
      id: "dash_3",
      type: "expense",
      amount: 4.50,
      description: "OXXO TIENDA #4521 SNACKS",
      date: formatDate(1),
      category: "Comida"
    },
    {
      id: "dash_4",
      type: "income",
      amount: 8.00,
      description: "TAREA COMPLETADA - ORDENAR CUARTO",
      date: formatDate(1),
      category: "Tareas"
    },
    {
      id: "dash_5",
      type: "expense",
      amount: 8.99,
      description: "SPOTIFY PREMIUM FAMILY",
      date: formatDate(2),
      category: "Entretenimiento"
    },
    {
      id: "dash_6",
      type: "expense",
      amount: 15.50,
      description: "CINÉPOLIS PLAZA CENTRAL",
      date: formatDate(3),
      category: "Entretenimiento"
    },
    {
      id: "dash_7",
      type: "income",
      amount: 15.00,
      description: "BONO - CALIFICACIONES EXCELENTES",
      date: formatDate(3),
      category: "Bonificación"
    },
    {
      id: "dash_8",
      type: "expense",
      amount: 6.75,
      description: "MCDONALD'S REST #8832",
      date: formatDate(4),
      category: "Comida"
    }
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
};

const getTransactions = (userId: string): Transaction[] => {
  try {
    const savedTransactions = localStorage.getItem(`transactions_${userId}`);
    if (savedTransactions) {
      const transactions = JSON.parse(savedTransactions);
      if (transactions.length > 0) return transactions;
    }
  } catch (error) {
    console.error('Error cargando transacciones:', error);
  }
  // Retornar datos de ejemplo si no hay transacciones reales
  return getDummyTransactions();
};

const getBalances = (userId: string): AccountBalances => {
  try {
    const savedBalances = localStorage.getItem(`balances_${userId}`);
    if (savedBalances) {
      return JSON.parse(savedBalances);
    }
    const cardData = getCardData(userId);
    if (cardData.balance > 0) {
      return {
        available: cardData.balance,
        savings: 0,
        emergency: 0,
        total: cardData.balance
      };
    }
  } catch (error) {
    console.error('Error cargando balances:', error);
  }
  // Balances de ejemplo realistas
  return { 
    available: 87.50, 
    savings: 45.00, 
    emergency: 15.00, 
    total: 147.50 
  };
};

interface BankingDashboardProps {
  onAction?: (action: string) => void;
}

export function BankingDashboard({ onAction }: BankingDashboardProps) {
  const [user, setUser] = useState<any>(null);
  const [cardData, setCardData] = useState<VirtualCardData | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [balances, setBalances] = useState<AccountBalances>({ available: 0, savings: 0, emergency: 0, total: 0 });
  const [showCardDetails, setShowCardDetails] = useState(false);
  const [isFlipped, setIsFlipped] = useState(false);
  const [showBalances, setShowBalances] = useState(true);

  // Cargar datos
  useEffect(() => {
    const currentUser = getCurrentUser();
    if (currentUser) {
      setUser(currentUser);
      const userId = currentUser.id;
      
      setCardData(getCardData(userId));
      setTransactions(getTransactions(userId));
      setBalances(getBalances(userId));
    }
  }, []);

  // Actualizar datos periódicamente
  useEffect(() => {
    if (!user?.id) return;

    const updateData = () => {
      setCardData(getCardData(user.id));
      setTransactions(getTransactions(user.id));
      setBalances(getBalances(user.id));
    };

    const interval = setInterval(updateData, 2000);
    return () => clearInterval(interval);
  }, [user?.id]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Hoy';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Ayer';
    }
    return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  };

  const toggleCardFreeze = () => {
    if (!cardData || !user?.id) return;
    const updated = { ...cardData, isFrozen: !cardData.isFrozen };
    setCardData(updated);
    saveCardData(user.id, updated);
  };

  // Calcular estadísticas
  const thisMonthIncome = transactions
    .filter(t => {
      const tDate = new Date(t.date);
      const now = new Date();
      return t.type === 'income' && tDate.getMonth() === now.getMonth() && tDate.getFullYear() === now.getFullYear();
    })
    .reduce((sum, t) => sum + t.amount, 0);

  const thisMonthExpenses = transactions
    .filter(t => {
      const tDate = new Date(t.date);
      const now = new Date();
      return t.type === 'expense' && tDate.getMonth() === now.getMonth() && tDate.getFullYear() === now.getFullYear();
    })
    .reduce((sum, t) => sum + t.amount, 0);

  const recentTransactions = transactions.slice(0, 5);

  if (!cardData || !user) {
    return (
      <Card className="p-8">
        <div className="flex items-center justify-center">
          <div className="animate-pulse flex items-center gap-2">
            <CreditCard className="h-6 w-6 text-muted-foreground" />
            <span className="text-muted-foreground">Cargando tu cuenta...</span>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Tarjeta Virtual Principal */}
      <Card className="overflow-hidden bg-gradient-to-br from-slate-900 to-slate-800">
        <CardContent className="p-0">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">
            {/* Tarjeta 3D */}
            <div className="p-6 flex flex-col items-center justify-center min-h-[400px]">
              <ErrorBoundary>
                <ThreeDCard
                  cardNumber={cardData.cardNumber}
                  holderName={cardData.holderName}
                  expiryDate={cardData.expiryDate}
                  cvv={cardData.cvv}
                  theme={cardData.theme}
                  isFlipped={isFlipped}
                  showDetails={showCardDetails}
                  isFrozen={cardData.isFrozen}
                />
              </ErrorBoundary>
              
              {/* Controles de tarjeta */}
              <div className="flex items-center gap-2 mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-white/10 border-white/20 text-white hover:bg-white/20"
                  onClick={() => setShowCardDetails(!showCardDetails)}
                >
                  {showCardDetails ? <EyeOff className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
                  {showCardDetails ? "Ocultar" : "Ver datos"}
                </Button>
                
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-white/10 border-white/20 text-white hover:bg-white/20"
                  onClick={() => setIsFlipped(!isFlipped)}
                >
                  <RotateCw className="h-4 w-4 mr-2" />
                  Voltear
                </Button>
                
                <Button
                  variant={cardData.isFrozen ? "default" : "destructive"}
                  size="sm"
                  onClick={toggleCardFreeze}
                  className={cardData.isFrozen ? "bg-green-600 hover:bg-green-700" : ""}
                >
                  {cardData.isFrozen ? <Unlock className="h-4 w-4 mr-2" /> : <Lock className="h-4 w-4 mr-2" />}
                  {cardData.isFrozen ? "Desbloquear" : "Bloquear"}
                </Button>
              </div>
            </div>

            {/* Panel de Balance */}
            <div className="p-6 bg-white/5 flex flex-col justify-center">
              <div className="space-y-6">
                {/* Balance principal */}
                <div className="text-center lg:text-left">
                  <div className="flex items-center justify-center lg:justify-start gap-2 mb-2">
                    <span className="text-white/60 text-sm">Balance Disponible</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-white/60 hover:text-white p-1 h-auto"
                      onClick={() => setShowBalances(!showBalances)}
                    >
                      {showBalances ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                    </Button>
                  </div>
                  <div className="text-4xl font-bold text-white mb-1">
                    {showBalances ? formatCurrency(balances.available) : "••••••"}
                  </div>
                  <Badge variant={cardData.isFrozen ? "destructive" : "default"} className="mt-2">
                    {cardData.isFrozen ? "🔒 Tarjeta Bloqueada" : "✓ Tarjeta Activa"}
                  </Badge>
                </div>

                {/* Distribución de fondos */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-3 rounded-lg bg-white/5">
                    <Wallet className="h-5 w-5 text-green-400 mx-auto mb-1" />
                    <div className="text-white font-semibold">
                      {showBalances ? formatCurrency(balances.available) : "••••"}
                    </div>
                    <div className="text-white/60 text-xs">Disponible</div>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-white/5">
                    <PiggyBank className="h-5 w-5 text-blue-400 mx-auto mb-1" />
                    <div className="text-white font-semibold">
                      {showBalances ? formatCurrency(balances.savings) : "••••"}
                    </div>
                    <div className="text-white/60 text-xs">Ahorros</div>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-white/5">
                    <DollarSign className="h-5 w-5 text-orange-400 mx-auto mb-1" />
                    <div className="text-white font-semibold">
                      {showBalances ? formatCurrency(balances.emergency) : "••••"}
                    </div>
                    <div className="text-white/60 text-xs">Emergencia</div>
                  </div>
                </div>

                {/* Límite diario */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm text-white/60">
                    <span>Límite diario usado</span>
                    <span>{showBalances ? `${formatCurrency(thisMonthExpenses / 30)} / ${formatCurrency(cardData.dailyLimit)}` : "••••"}</span>
                  </div>
                  <Progress 
                    value={Math.min((thisMonthExpenses / 30 / cardData.dailyLimit) * 100, 100)} 
                    className="h-2 bg-white/10" 
                  />
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Acciones Rápidas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Button 
          variant="outline" 
          className="h-auto py-4 flex flex-col gap-2 hover:bg-primary/5 hover:border-primary"
          onClick={() => onAction?.('transfer')}
        >
          <Send className="h-6 w-6 text-primary" />
          <span className="text-sm font-medium">Transferir</span>
        </Button>
        
        <Button 
          variant="outline" 
          className="h-auto py-4 flex flex-col gap-2 hover:bg-blue-500/5 hover:border-blue-500"
          onClick={() => onAction?.('save')}
        >
          <PiggyBank className="h-6 w-6 text-blue-500" />
          <span className="text-sm font-medium">Ahorrar</span>
        </Button>
        
        <Button 
          variant="outline" 
          className="h-auto py-4 flex flex-col gap-2 hover:bg-green-500/5 hover:border-green-500"
          onClick={() => onAction?.('deposit')}
        >
          <ArrowDownToLine className="h-6 w-6 text-green-500" />
          <span className="text-sm font-medium">Depositar</span>
        </Button>
        
        <Button 
          variant="outline" 
          className="h-auto py-4 flex flex-col gap-2 hover:bg-orange-500/5 hover:border-orange-500"
          onClick={() => onAction?.('history')}
        >
          <Receipt className="h-6 w-6 text-orange-500" />
          <span className="text-sm font-medium">Historial</span>
        </Button>
      </div>

      {/* Estadísticas del mes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-green-600 text-sm font-medium mb-1">Ingresos este mes</div>
                <div className="text-2xl font-bold text-green-700">
                  {showBalances ? formatCurrency(thisMonthIncome) : "••••••"}
                </div>
              </div>
              <div className="p-3 bg-green-100 rounded-full">
                <TrendingUp className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-50 to-orange-50 border-red-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-red-600 text-sm font-medium mb-1">Gastos este mes</div>
                <div className="text-2xl font-bold text-red-700">
                  {showBalances ? formatCurrency(thisMonthExpenses) : "••••••"}
                </div>
              </div>
              <div className="p-3 bg-red-100 rounded-full">
                <TrendingDown className="h-6 w-6 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Últimos Movimientos */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-lg font-semibold">Últimos Movimientos</CardTitle>
          <Button variant="ghost" size="sm" onClick={() => onAction?.('history')}>
            Ver todos
          </Button>
        </CardHeader>
        <CardContent>
          {recentTransactions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <ShoppingBag className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No hay movimientos recientes</p>
              <p className="text-sm">Tus transacciones aparecerán aquí</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentTransactions.map((transaction) => {
                const explanation = getTransactionExplanation(transaction.description);
                return (
                  <div 
                    key={transaction.id} 
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-full ${
                        transaction.type === 'income' 
                          ? 'bg-green-100 text-green-600' 
                          : 'bg-red-100 text-red-600'
                      }`}>
                        {transaction.type === 'income' ? (
                          <ArrowDownToLine className="h-4 w-4" />
                        ) : (
                          <ArrowUpFromLine className="h-4 w-4" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-sm">{transaction.description}</span>
                          <Popover>
                            <PopoverTrigger asChild>
                              <button className="p-0.5 rounded-full hover:bg-blue-100 text-blue-500 hover:text-blue-700 transition-colors">
                                <HelpCircle className="h-3.5 w-3.5" />
                              </button>
                            </PopoverTrigger>
                            <PopoverContent className="w-72" side="top">
                              <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-base">{explanation.title.split(' ')[0]}</span>
                                  <h4 className="font-semibold text-sm">{explanation.title.split(' ').slice(1).join(' ')}</h4>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  {explanation.explanation}
                                </p>
                                <div className="flex items-start gap-2 p-2 bg-amber-50 rounded-lg border border-amber-200">
                                  <Lightbulb className="h-3.5 w-3.5 text-amber-500 mt-0.5 flex-shrink-0" />
                                  <p className="text-xs text-amber-700">
                                    <strong>Tip:</strong> {explanation.tip}
                                  </p>
                                </div>
                              </div>
                            </PopoverContent>
                          </Popover>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {transaction.category} • {formatDate(transaction.date)}
                        </div>
                      </div>
                    </div>
                    <div className={`font-semibold ${
                      transaction.type === 'income' ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {transaction.type === 'income' ? '+' : '-'}{formatCurrency(transaction.amount)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
