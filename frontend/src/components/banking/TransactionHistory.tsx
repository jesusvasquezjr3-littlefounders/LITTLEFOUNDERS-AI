import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { 
  Search,
  Filter,
  Download,
  Calendar,
  ArrowDownToLine,
  ArrowUpFromLine,
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShoppingBag,
  PiggyBank,
  Gift,
  Home,
  BookOpen,
  Gamepad2,
  Utensils,
  Star,
  ChevronLeft,
  ChevronRight,
  FileText,
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
      explanation: "Este es el dinero que tus papás te dan regularmente para que aprendas a administrarlo. ¡Es como tu 'sueldo'!",
      tip: "Intenta ahorrar una parte de tu mesada cada semana."
    };
  }
  if (desc.includes('TAREA') || desc.includes('COMPLETADA')) {
    return {
      title: "✅ Recompensa por Tarea",
      explanation: "Ganaste este dinero por completar una tarea en casa. ¡Buen trabajo! Así es como los adultos ganan dinero trabajando.",
      tip: "Mientras más tareas completes, más podrás ahorrar."
    };
  }
  if (desc.includes('BONO') || desc.includes('CALIFICACIONES')) {
    return {
      title: "🌟 Bono Especial",
      explanation: "¡Felicidades! Este es un premio extra por hacer algo muy bien, como sacar buenas calificaciones.",
      tip: "Los bonos son especiales, considera guardar parte de ellos."
    };
  }
  if (desc.includes('REGALO') || desc.includes('CUMPLEAÑOS')) {
    return {
      title: "🎁 Regalo",
      explanation: "Alguien especial te dio este dinero como regalo. Puede ser por tu cumpleaños u otra ocasión especial.",
      tip: "Es buena idea ahorrar parte de los regalos para algo que realmente quieras."
    };
  }
  if (desc.includes('TRANSFERENCIA') && desc.includes('AHORRO')) {
    return {
      title: "🐷 Transferencia a Ahorros",
      explanation: "Moviste dinero a tu cuenta de ahorros. ¡Excelente decisión! Este dinero está guardado para el futuro.",
      tip: "El ahorro te ayuda a comprar cosas más grandes después."
    };
  }

  // Gastos - Tiendas y comercios
  if (desc.includes('NINTENDO') || desc.includes('ESHOP')) {
    return {
      title: "🎮 Nintendo eShop",
      explanation: "Compraste algo en la tienda digital de Nintendo. Puede ser un juego, contenido extra o monedas virtuales.",
      tip: "Antes de comprar juegos, pregúntate si realmente lo vas a jugar mucho."
    };
  }
  if (desc.includes('OXXO')) {
    return {
      title: "🏪 OXXO",
      explanation: "OXXO es una tienda de conveniencia. El número que ves es el código de la sucursal donde compraste.",
      tip: "Los snacks pequeños pueden sumar mucho dinero si los compras seguido."
    };
  }
  if (desc.includes('SPOTIFY')) {
    return {
      title: "🎵 Spotify",
      explanation: "Es un servicio de música por suscripción. Pagas cada mes para escuchar música sin anuncios.",
      tip: "Las suscripciones se cobran automáticamente cada mes, ¡no lo olvides!"
    };
  }
  if (desc.includes('CINÉPOLIS') || desc.includes('CINEPOLIS') || desc.includes('CINE')) {
    return {
      title: "🎬 Cine",
      explanation: "Fuiste al cine a ver una película. El cargo incluye tu boleto y quizás palomitas o dulces.",
      tip: "Ir al cine es divertido, pero puedes ahorrar viendo películas en casa a veces."
    };
  }
  if (desc.includes('MCDONALD') || desc.includes('ARCOS DORADOS')) {
    return {
      title: "🍔 McDonald's",
      explanation: "'Arcos Dorados' es el nombre oficial de McDonald's en México. El número es el código del restaurante.",
      tip: "La comida rápida está rica, pero cocinar en casa es más económico y saludable."
    };
  }
  if (desc.includes('AMAZON')) {
    return {
      title: "📦 Amazon",
      explanation: "Amazon es una tienda en internet donde puedes comprar casi cualquier cosa. El código raro es el número de tu pedido.",
      tip: "Compara precios antes de comprar, a veces encuentras lo mismo más barato."
    };
  }
  if (desc.includes('7-ELEVEN') || desc.includes('SEVEN')) {
    return {
      title: "🏪 7-Eleven",
      explanation: "Es una tienda de conveniencia abierta las 24 horas. El número es el código de la tienda.",
      tip: "Las tiendas de conveniencia son prácticas pero a veces más caras."
    };
  }
  if (desc.includes('GANDHI') || desc.includes('LIBRERÍA')) {
    return {
      title: "📚 Librería Gandhi",
      explanation: "Gandhi es una cadena de librerías. ¡Compraste algo para leer o aprender!",
      tip: "Los libros son una excelente inversión para tu mente."
    };
  }
  if (desc.includes('ROBLOX')) {
    return {
      title: "🎮 Roblox",
      explanation: "Roblox es una plataforma de juegos. Probablemente compraste Robux, que es la moneda virtual del juego.",
      tip: "Piensa bien antes de gastar en monedas virtuales, no se pueden recuperar."
    };
  }
  if (desc.includes('STARBUCKS')) {
    return {
      title: "☕ Starbucks",
      explanation: "Starbucks es una cafetería famosa. El número es el código de la tienda donde compraste.",
      tip: "Las bebidas de cafetería cuestan más que hacerlas en casa."
    };
  }
  if (desc.includes('ZARA')) {
    return {
      title: "👕 Zara",
      explanation: "Zara es una tienda de ropa. 'Inditex' es el nombre de la empresa dueña de Zara.",
      tip: "La ropa de calidad dura más, a veces vale la pena esperar ofertas."
    };
  }
  if (desc.includes('APPLE') || desc.includes('APP STORE')) {
    return {
      title: "📱 App Store",
      explanation: "Es la tienda de aplicaciones de Apple. Compraste una app, juego o suscripción para tu iPhone/iPad.",
      tip: "Revisa las apps gratuitas primero, muchas son muy buenas."
    };
  }
  if (desc.includes('DOMINO')) {
    return {
      title: "🍕 Domino's Pizza",
      explanation: "'Alsea' es la empresa que opera Domino's en México. El número es el código de la sucursal.",
      tip: "Compartir una pizza grande con familia o amigos sale más económico."
    };
  }
  if (desc.includes('STEAM')) {
    return {
      title: "🎮 Steam",
      explanation: "Steam es una tienda de videojuegos para computadora. Aquí puedes comprar y descargar juegos.",
      tip: "Steam tiene ofertas muy buenas, vale la pena esperar las rebajas."
    };
  }
  if (desc.includes('SUBWAY')) {
    return {
      title: "🥪 Subway",
      explanation: "Subway es un restaurante de sándwiches. El número es el código de la sucursal.",
      tip: "Puedes hacer sándwiches similares en casa por menos dinero."
    };
  }
  if (desc.includes('TOYS') || desc.includes('JUGUETE')) {
    return {
      title: "🧸 Tienda de Juguetes",
      explanation: "Compraste un juguete en una tienda física o en línea.",
      tip: "Antes de comprar un juguete, pregúntate si lo usarás por mucho tiempo."
    };
  }
  if (desc.includes('MINISO')) {
    return {
      title: "🎀 Miniso",
      explanation: "Miniso es una tienda de accesorios, juguetes pequeños y artículos variados.",
      tip: "Las cosas pequeñas y baratas pueden sumar mucho si compras muchas."
    };
  }
  if (desc.includes('NETFLIX')) {
    return {
      title: "📺 Netflix",
      explanation: "Netflix es un servicio de streaming para ver películas y series. Se cobra cada mes automáticamente.",
      tip: "Revisa si realmente usas todas tus suscripciones de streaming."
    };
  }

  // Explicaciones genéricas por categoría
  if (desc.includes('COMPRA TDC') || desc.includes('COMPRA INT')) {
    return {
      title: "💳 Compra con Tarjeta",
      explanation: "'TDC' significa Tarjeta de Crédito/Débito. 'INT' significa que fue una compra por Internet.",
      tip: "Siempre guarda tus recibos para saber en qué gastaste."
    };
  }
  if (desc.includes('CARGO RECURRENTE')) {
    return {
      title: "🔄 Suscripción",
      explanation: "Este es un cargo que se repite automáticamente cada mes por un servicio al que estás suscrito.",
      tip: "Revisa tus suscripciones regularmente, cancela las que no uses."
    };
  }
  if (desc.includes('TRANSFERENCIA') || desc.includes('SPEI')) {
    return {
      title: "💸 Transferencia",
      explanation: "'SPEI' es el sistema que usan los bancos para enviar dinero entre cuentas de forma rápida.",
      tip: "Las transferencias son una forma segura de mover dinero."
    };
  }

  // Explicación por defecto
  return {
    title: "📋 Movimiento",
    explanation: "Este es un movimiento en tu cuenta. El nombre puede parecer extraño porque los bancos usan códigos especiales.",
    tip: "Si no entiendes un cargo, pregunta a tus papás para que te expliquen."
  };
};

// Funciones de utilidad
const getCurrentUser = () => {
  try {
    const userData = localStorage.getItem('user');
    if (userData) return JSON.parse(userData);
  } catch (error) {}
  return null;
};

// Datos de ejemplo realistas (como aparecerían en un estado de cuenta real)
const getDummyTransactions = (): any[] => {
  const today = new Date();
  const formatDate = (daysAgo: number) => {
    const date = new Date(today);
    date.setDate(date.getDate() - daysAgo);
    return date.toISOString().split('T')[0];
  };

  return [
    // Ingresos
    {
      id: "demo_1",
      type: "income",
      amount: 25.00,
      description: "TRANSFERENCIA - MESADA SEMANAL",
      date: formatDate(0),
      category: "Mesada"
    },
    {
      id: "demo_2",
      type: "income",
      amount: 8.00,
      description: "TAREA COMPLETADA - ORDENAR HABITACIÓN",
      date: formatDate(1),
      category: "Tareas"
    },
    {
      id: "demo_3",
      type: "income",
      amount: 15.00,
      description: "BONO - CALIFICACIONES EXCELENTES",
      date: formatDate(3),
      category: "Bonificación"
    },
    {
      id: "demo_4",
      type: "income",
      amount: 50.00,
      description: "REGALO CUMPLEAÑOS - ABUELA MARÍA",
      date: formatDate(5),
      category: "Regalo"
    },
    {
      id: "demo_5",
      type: "income",
      amount: 5.00,
      description: "TAREA COMPLETADA - LAVAR PLATOS",
      date: formatDate(6),
      category: "Tareas"
    },
    {
      id: "demo_6",
      type: "income",
      amount: 25.00,
      description: "TRANSFERENCIA - MESADA SEMANAL",
      date: formatDate(7),
      category: "Mesada"
    },
    {
      id: "demo_7",
      type: "income",
      amount: 10.00,
      description: "TAREA COMPLETADA - AYUDAR EN JARDÍN",
      date: formatDate(8),
      category: "Tareas"
    },
    // Gastos (descripciones realistas como en extracto bancario)
    {
      id: "demo_8",
      type: "expense",
      amount: 12.99,
      description: "NINTENDO ESHOP *GAME PURCHASE",
      date: formatDate(0),
      category: "Entretenimiento"
    },
    {
      id: "demo_9",
      type: "expense",
      amount: 4.50,
      description: "OXXO TIENDA #4521 SNACKS",
      date: formatDate(1),
      category: "Comida"
    },
    {
      id: "demo_10",
      type: "expense",
      amount: 8.99,
      description: "SPOTIFY PREMIUM FAMILY",
      date: formatDate(2),
      category: "Entretenimiento"
    },
    {
      id: "demo_11",
      type: "expense",
      amount: 15.50,
      description: "CINÉPOLIS PLAZA CENTRAL",
      date: formatDate(3),
      category: "Entretenimiento"
    },
    {
      id: "demo_12",
      type: "expense",
      amount: 6.75,
      description: "MCDONALD'S REST #8832",
      date: formatDate(4),
      category: "Comida"
    },
    {
      id: "demo_13",
      type: "expense",
      amount: 24.99,
      description: "AMAZON.COM*RT5K29X JUGUETE",
      date: formatDate(5),
      category: "Compra"
    },
    {
      id: "demo_14",
      type: "expense",
      amount: 3.25,
      description: "7-ELEVEN STORE #156 DULCES",
      date: formatDate(6),
      category: "Comida"
    },
    {
      id: "demo_15",
      type: "expense",
      amount: 18.90,
      description: "GANDHI LIBRERÍA CHAPULTEPEC",
      date: formatDate(7),
      category: "Educación"
    },
    {
      id: "demo_16",
      type: "expense",
      amount: 9.99,
      description: "ROBLOX CORPORATION *ROBUX",
      date: formatDate(8),
      category: "Entretenimiento"
    },
    {
      id: "demo_17",
      type: "expense",
      amount: 5.00,
      description: "TRANSFERENCIA A AHORRO",
      date: formatDate(9),
      category: "Ahorro"
    },
    {
      id: "demo_18",
      type: "expense",
      amount: 7.50,
      description: "STARBUCKS STORE #2143",
      date: formatDate(10),
      category: "Comida"
    },
    {
      id: "demo_19",
      type: "expense",
      amount: 35.00,
      description: "ZARA KIDS STORE #892",
      date: formatDate(12),
      category: "Compra"
    },
    {
      id: "demo_20",
      type: "expense",
      amount: 14.99,
      description: "APPLE.COM/BILL APP STORE",
      date: formatDate(14),
      category: "Entretenimiento"
    },
    {
      id: "demo_21",
      type: "income",
      amount: 25.00,
      description: "TRANSFERENCIA - MESADA SEMANAL",
      date: formatDate(14),
      category: "Mesada"
    },
    {
      id: "demo_22",
      type: "expense",
      amount: 11.25,
      description: "DOMINO'S PIZZA #4412",
      date: formatDate(15),
      category: "Comida"
    },
    {
      id: "demo_23",
      type: "income",
      amount: 12.00,
      description: "TAREA COMPLETADA - LAVAR AUTO",
      date: formatDate(16),
      category: "Tareas"
    },
    {
      id: "demo_24",
      type: "expense",
      amount: 19.99,
      description: "STEAM GAMES *PURCHASE",
      date: formatDate(18),
      category: "Entretenimiento"
    },
    {
      id: "demo_25",
      type: "income",
      amount: 25.00,
      description: "TRANSFERENCIA - MESADA SEMANAL",
      date: formatDate(21),
      category: "Mesada"
    },
    {
      id: "demo_26",
      type: "expense",
      amount: 8.50,
      description: "SUBWAY SANDWICHES #7821",
      date: formatDate(22),
      category: "Comida"
    },
    {
      id: "demo_27",
      type: "expense",
      amount: 42.00,
      description: "TOYS R US ONLINE ORDER",
      date: formatDate(25),
      category: "Compra"
    },
    {
      id: "demo_28",
      type: "income",
      amount: 25.00,
      description: "TRANSFERENCIA - MESADA SEMANAL",
      date: formatDate(28),
      category: "Mesada"
    },
    {
      id: "demo_29",
      type: "expense",
      amount: 16.75,
      description: "MINISO STORE ACCESORIOS",
      date: formatDate(29),
      category: "Compra"
    },
    {
      id: "demo_30",
      type: "expense",
      amount: 5.99,
      description: "NETFLIX.COM SUSCRIPCIÓN",
      date: formatDate(30),
      category: "Entretenimiento"
    }
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
};

const getTransactions = (userId: string) => {
  try {
    const saved = localStorage.getItem(`transactions_${userId}`);
    if (saved) {
      const transactions = JSON.parse(saved);
      if (transactions.length > 0) return transactions;
    }
  } catch (error) {}
  // Retornar datos de ejemplo si no hay transacciones reales
  return getDummyTransactions();
};

// Iconos por categoría
const categoryIcons: Record<string, any> = {
  "Mesada": PiggyBank,
  "Tareas": Home,
  "Regalos": Gift,
  "Regalo": Gift,
  "Educación": BookOpen,
  "Bonificación": Star,
  "Transferencia": ArrowDownToLine,
  "Ahorro": PiggyBank,
  "Dulces": Star,
  "Juguetes": Gamepad2,
  "Libros": BookOpen,
  "Comida": Utensils,
  "Entretenimiento": Gamepad2,
  "Compra": ShoppingBag,
  "Gastos": ShoppingBag,
  "Suscripción": DollarSign,
  "Digital": Gamepad2,
  "Ropa": ShoppingBag,
  "Tienda": ShoppingBag,
  "Restaurante": Utensils,
  "Cine": Star
};

// Colores por categoría
const categoryColors: Record<string, string> = {
  "Mesada": "bg-blue-100 text-blue-700",
  "Tareas": "bg-green-100 text-green-700",
  "Regalos": "bg-purple-100 text-purple-700",
  "Regalo": "bg-purple-100 text-purple-700",
  "Educación": "bg-yellow-100 text-yellow-700",
  "Bonificación": "bg-orange-100 text-orange-700",
  "Transferencia": "bg-gray-100 text-gray-700",
  "Ahorro": "bg-cyan-100 text-cyan-700",
  "Dulces": "bg-pink-100 text-pink-700",
  "Juguetes": "bg-indigo-100 text-indigo-700",
  "Libros": "bg-emerald-100 text-emerald-700",
  "Comida": "bg-amber-100 text-amber-700",
  "Entretenimiento": "bg-violet-100 text-violet-700",
  "Compra": "bg-rose-100 text-rose-700",
  "Gastos": "bg-red-100 text-red-700",
  "Suscripción": "bg-purple-100 text-purple-700",
  "Digital": "bg-indigo-100 text-indigo-700",
  "Ropa": "bg-pink-100 text-pink-700",
  "Tienda": "bg-slate-100 text-slate-700",
  "Restaurante": "bg-orange-100 text-orange-700",
  "Cine": "bg-fuchsia-100 text-fuchsia-700"
};

interface TransactionHistoryProps {
  onBack?: () => void;
}

export function TransactionHistory({ onBack }: TransactionHistoryProps) {
  const [user, setUser] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'income' | 'expense'>('all');
  const [selectedPeriod, setSelectedPeriod] = useState<'week' | 'month' | 'year' | 'all'>('month');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    const currentUser = getCurrentUser();
    if (currentUser) {
      setUser(currentUser);
      const txs = getTransactions(currentUser.id);
      setTransactions(txs);
      setFilteredTransactions(txs);
    }
  }, []);

  // Filtrar transacciones
  useEffect(() => {
    let filtered = [...transactions];

    // Filtrar por tipo
    if (activeFilter !== 'all') {
      filtered = filtered.filter(t => t.type === activeFilter);
    }

    // Filtrar por período
    if (selectedPeriod !== 'all') {
      const now = new Date();
      let startDate = new Date();
      
      switch (selectedPeriod) {
        case 'week':
          startDate.setDate(now.getDate() - 7);
          break;
        case 'month':
          startDate.setMonth(now.getMonth() - 1);
          break;
        case 'year':
          startDate.setFullYear(now.getFullYear() - 1);
          break;
      }
      
      filtered = filtered.filter(t => new Date(t.date) >= startDate);
    }

    // Filtrar por búsqueda
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(t => 
        t.description?.toLowerCase().includes(query) ||
        t.category?.toLowerCase().includes(query)
      );
    }

    setFilteredTransactions(filtered);
    setCurrentPage(1);
  }, [transactions, activeFilter, selectedPeriod, searchQuery]);

  // Calcular estadísticas
  const totalIncome = filteredTransactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);
  
  const totalExpenses = filteredTransactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

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
    return date.toLocaleDateString('es-ES', { 
      day: 'numeric', 
      month: 'short',
      year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined
    });
  };

  // Agrupar transacciones por fecha
  const groupTransactionsByDate = (txs: any[]) => {
    const groups: Record<string, any[]> = {};
    
    txs.forEach(tx => {
      const date = tx.date.split('T')[0];
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(tx);
    });

    return Object.entries(groups)
      .sort(([a], [b]) => new Date(b).getTime() - new Date(a).getTime());
  };

  // Paginación
  const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage);
  const paginatedTransactions = filteredTransactions.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );
  const groupedTransactions = groupTransactionsByDate(paginatedTransactions);

  const getCategoryIcon = (category: string) => {
    return categoryIcons[category] || ShoppingBag;
  };

  const getCategoryColor = (category: string) => {
    return categoryColors[category] || "bg-gray-100 text-gray-700";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {onBack && (
            <Button variant="ghost" size="icon" onClick={onBack}>
              <ChevronLeft className="h-5 w-5" />
            </Button>
          )}
          <div>
            <h2 className="text-2xl font-bold">Historial de Movimientos</h2>
            <p className="text-muted-foreground">
              {filteredTransactions.length} transacciones encontradas
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm">
          <Download className="h-4 w-4 mr-2" />
          Exportar
        </Button>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-green-600 text-sm font-medium">Total Ingresos</div>
                <div className="text-2xl font-bold text-green-700">{formatCurrency(totalIncome)}</div>
              </div>
              <div className="p-3 bg-green-100 rounded-full">
                <TrendingUp className="h-5 w-5 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-50 to-orange-50 border-red-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-red-600 text-sm font-medium">Total Gastos</div>
                <div className="text-2xl font-bold text-red-700">{formatCurrency(totalExpenses)}</div>
              </div>
              <div className="p-3 bg-red-100 rounded-full">
                <TrendingDown className="h-5 w-5 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-blue-600 text-sm font-medium">Balance Neto</div>
                <div className={`text-2xl font-bold ${totalIncome - totalExpenses >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                  {formatCurrency(totalIncome - totalExpenses)}
                </div>
              </div>
              <div className="p-3 bg-blue-100 rounded-full">
                <DollarSign className="h-5 w-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Búsqueda */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar transacciones..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Filtro por tipo */}
            <div className="flex gap-2">
              <Button
                variant={activeFilter === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveFilter('all')}
              >
                Todos
              </Button>
              <Button
                variant={activeFilter === 'income' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveFilter('income')}
                className={activeFilter === 'income' ? 'bg-green-600 hover:bg-green-700' : ''}
              >
                <TrendingUp className="h-4 w-4 mr-1" />
                Ingresos
              </Button>
              <Button
                variant={activeFilter === 'expense' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveFilter('expense')}
                className={activeFilter === 'expense' ? 'bg-red-600 hover:bg-red-700' : ''}
              >
                <TrendingDown className="h-4 w-4 mr-1" />
                Gastos
              </Button>
            </div>

            {/* Filtro por período */}
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value as any)}
              className="px-3 py-2 border rounded-lg text-sm"
            >
              <option value="week">Esta semana</option>
              <option value="month">Este mes</option>
              <option value="year">Este año</option>
              <option value="all">Todo el tiempo</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Lista de transacciones */}
      <Card>
        <CardContent className="p-0">
          {filteredTransactions.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="font-medium">No hay transacciones</p>
              <p className="text-sm">No se encontraron movimientos con los filtros seleccionados</p>
            </div>
          ) : (
            <div className="divide-y">
              {groupedTransactions.map(([date, txs]) => (
                <div key={date}>
                  <div className="px-4 py-2 bg-muted/30 text-sm font-medium text-muted-foreground sticky top-0">
                    {formatDate(date)}
                  </div>
                  <div className="divide-y">
                    {txs.map((transaction) => {
                      const CategoryIcon = getCategoryIcon(transaction.category);
                      const explanation = getTransactionExplanation(transaction.description);
                      return (
                        <div
                          key={transaction.id}
                          className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div className={`p-2.5 rounded-full ${
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
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{transaction.description}</span>
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <button className="p-1 rounded-full hover:bg-blue-100 text-blue-500 hover:text-blue-700 transition-colors">
                                      <HelpCircle className="h-4 w-4" />
                                    </button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-80" side="top">
                                    <div className="space-y-3">
                                      <div className="flex items-center gap-2">
                                        <span className="text-lg">{explanation.title.split(' ')[0]}</span>
                                        <h4 className="font-semibold">{explanation.title.split(' ').slice(1).join(' ')}</h4>
                                      </div>
                                      <p className="text-sm text-muted-foreground">
                                        {explanation.explanation}
                                      </p>
                                      <div className="flex items-start gap-2 p-2 bg-amber-50 rounded-lg border border-amber-200">
                                        <Lightbulb className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                                        <p className="text-xs text-amber-700">
                                          <strong>Tip:</strong> {explanation.tip}
                                        </p>
                                      </div>
                                    </div>
                                  </PopoverContent>
                                </Popover>
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge variant="outline" className={getCategoryColor(transaction.category)}>
                                  <CategoryIcon className="h-3 w-3 mr-1" />
                                  {transaction.category}
                                </Badge>
                              </div>
                            </div>
                          </div>
                          <div className={`text-lg font-semibold ${
                            transaction.type === 'income' ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {transaction.type === 'income' ? '+' : '-'}{formatCurrency(transaction.amount)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Paginación */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <div className="text-sm text-muted-foreground">
                Página {currentPage} de {totalPages}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
