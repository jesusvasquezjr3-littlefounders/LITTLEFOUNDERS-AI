import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  TrendingDown,
  ArrowDownLeft,
  DollarSign,
  Calendar,
  Filter,
  Download,
  Eye,
  EyeOff,
  ShoppingBag,
  Gamepad2,
  BookOpen,
  Utensils,
  Car,
  Home,
  Heart,
  Star
} from "lucide-react";
import { useState, useEffect } from "react";

interface ExpenseTransaction {
  id: string;
  amount: number;
  description: string;
  date: string;
  category: string;
  location: string;
  status: 'completed' | 'pending' | 'cancelled';
}

// Función para obtener el usuario actual
const getCurrentUser = () => {
  try {
    const userData = localStorage.getItem('user');
    if (userData) {
      return JSON.parse(userData);
    }
  } catch (error) {
    console.error('Error obteniendo usuario actual:', error);
  }
  return null;
};

// Función para obtener transacciones de gastos del localStorage
const getExpenseTransactions = (): ExpenseTransaction[] => {
  try {
    const user = getCurrentUser();
    let transactionKey = 'expenseTransactions';
    
    // Si es un niño, usar la clave específica del niño
    if (user?.user_type === 'child') {
      // Obtener el ID del niño desde el usuario o usar un ID por defecto
      const childId = user.id || 'child001';
      transactionKey = `transactions_${childId}`;
      
      // Obtener todas las transacciones del niño y filtrar solo las de gasto
      const savedTransactions = localStorage.getItem(transactionKey);
      if (savedTransactions) {
        const allTransactions = JSON.parse(savedTransactions);
        return allTransactions.filter((t: any) => t.type === 'expense').map((t: any) => ({
          id: t.id,
          amount: t.amount,
          description: t.description,
          date: t.date,
          category: t.category,
          location: t.location || 'Tienda',
          status: "completed"
        }));
      }
    } else {
      // Para usuarios que no son niños, usar la clave original
      const savedTransactions = localStorage.getItem(transactionKey);
      if (savedTransactions) {
        return JSON.parse(savedTransactions);
      }
    }
  } catch (error) {
    console.error('Error cargando transacciones de gastos:', error);
  }
  
  // Transacciones por defecto si no hay datos guardados
  return [
    {
      id: "1",
      amount: 5.50,
      description: "Compra de dulces",
      date: "2024-01-15",
      category: "Dulces",
      location: "Tienda de la esquina",
      status: "completed"
    },
    {
      id: "2",
      amount: 12.00,
      description: "Juguete nuevo",
      date: "2024-01-14",
      category: "Juguetes",
      location: "Tienda de juguetes",
      status: "completed"
    },
    {
      id: "3",
      amount: 8.75,
      description: "Libro de aventuras",
      date: "2024-01-13",
      category: "Libros",
      location: "Librería",
      status: "completed"
    },
    {
      id: "4",
      amount: 3.25,
      description: "Refresco y papas",
      date: "2024-01-12",
      category: "Comida",
      location: "Cafetería escolar",
      status: "completed"
    },
    {
      id: "5",
      amount: 15.00,
      description: "Videojuego",
      date: "2024-01-11",
      category: "Entretenimiento",
      location: "Tienda digital",
      status: "completed"
    },
    {
      id: "6",
      amount: 6.50,
      description: "Material escolar",
      date: "2024-01-10",
      category: "Educación",
      location: "Papelería",
      status: "completed"
    },
    {
      id: "7",
      amount: 4.00,
      description: "Helado",
      date: "2024-01-09",
      category: "Dulces",
      location: "Heladería",
      status: "completed"
    },
    {
      id: "8",
      amount: 9.99,
      description: "Aplicación móvil",
      date: "2024-01-08",
      category: "Entretenimiento",
      location: "App Store",
      status: "completed"
    }
  ];
};

// Función para calcular estadísticas de gastos
const calculateExpenseStats = (transactions: ExpenseTransaction[]) => {
  const totalExpenses = transactions.reduce((sum, transaction) => sum + transaction.amount, 0);
  const thisMonth = transactions.filter(t => {
    const transactionDate = new Date(t.date);
    const now = new Date();
    return transactionDate.getMonth() === now.getMonth() && 
           transactionDate.getFullYear() === now.getFullYear();
  });
  const thisMonthTotal = thisMonth.reduce((sum, transaction) => sum + transaction.amount, 0);
  
  const categoryTotals = transactions.reduce((acc, transaction) => {
    acc[transaction.category] = (acc[transaction.category] || 0) + transaction.amount;
    return acc;
  }, {} as Record<string, number>);

  return {
    totalExpenses,
    thisMonthTotal,
    thisMonthCount: thisMonth.length,
    categoryTotals,
    averagePerTransaction: transactions.length > 0 ? totalExpenses / transactions.length : 0
  };
};

const categoryIcons = {
  "Dulces": Star,
  "Juguetes": Gamepad2,
  "Libros": BookOpen,
  "Comida": Utensils,
  "Entretenimiento": Heart,
  "Educación": BookOpen,
  "Transporte": Car,
  "Otros": ShoppingBag
};

const categoryColors = {
  "Dulces": "bg-yellow-100 text-yellow-700",
  "Juguetes": "bg-purple-100 text-purple-700",
  "Libros": "bg-blue-100 text-blue-700",
  "Comida": "bg-green-100 text-green-700",
  "Entretenimiento": "bg-pink-100 text-pink-700",
  "Educación": "bg-indigo-100 text-indigo-700",
  "Transporte": "bg-gray-100 text-gray-700",
  "Otros": "bg-orange-100 text-orange-700"
};

const statusColors = {
  "completed": "bg-green-100 text-green-700",
  "pending": "bg-yellow-100 text-yellow-700",
  "cancelled": "bg-red-100 text-red-700"
};

export function ExpenseHistory() {
  const [showAmounts, setShowAmounts] = useState(true);
  const [transactions, setTransactions] = useState<ExpenseTransaction[]>(getExpenseTransactions());
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedPeriod, setSelectedPeriod] = useState<string>("all");
  
  // Actualizar datos cuando cambie el localStorage
  useEffect(() => {
    const updateData = () => {
      const newTransactions = getExpenseTransactions();
      setTransactions(newTransactions);
    };

    updateData();
    const interval = setInterval(updateData, 1000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  const stats = calculateExpenseStats(transactions);
  
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  // Filtrar transacciones
  const filteredTransactions = transactions.filter(transaction => {
    const categoryMatch = selectedCategory === "all" || transaction.category === selectedCategory;
    
    let periodMatch = true;
    if (selectedPeriod === "month") {
      const transactionDate = new Date(transaction.date);
      const now = new Date();
      periodMatch = transactionDate.getMonth() === now.getMonth() && 
                   transactionDate.getFullYear() === now.getFullYear();
    } else if (selectedPeriod === "week") {
      const transactionDate = new Date(transaction.date);
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      periodMatch = transactionDate >= weekAgo;
    }
    
    return categoryMatch && periodMatch;
  });

  const categories = Array.from(new Set(transactions.map(t => t.category)));

  return (
    <div className="space-y-6">
      {/* Header con estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-red-100 rounded-full">
                <DollarSign className="h-6 w-6 text-red-600" />
              </div>
              <div className="flex-1">
                <div className="text-2xl font-bold text-red-600">
                  {showAmounts ? formatCurrency(stats.totalExpenses) : "••••"}
                </div>
                <div className="text-sm text-muted-foreground">Total Gastos</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-orange-100 rounded-full">
                <Calendar className="h-6 w-6 text-orange-600" />
              </div>
              <div className="flex-1">
                <div className="text-2xl font-bold text-orange-600">
                  {showAmounts ? formatCurrency(stats.thisMonthTotal) : "••••"}
                </div>
                <div className="text-sm text-muted-foreground">Este Mes</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-purple-100 rounded-full">
                <TrendingDown className="h-6 w-6 text-purple-600" />
              </div>
              <div className="flex-1">
                <div className="text-2xl font-bold text-purple-600">
                  {stats.thisMonthCount}
                </div>
                <div className="text-sm text-muted-foreground">Compras</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-100 rounded-full">
                <ShoppingBag className="h-6 w-6 text-blue-600" />
              </div>
              <div className="flex-1">
                <div className="text-2xl font-bold text-blue-600">
                  {showAmounts ? formatCurrency(stats.averagePerTransaction) : "••••"}
                </div>
                <div className="text-sm text-muted-foreground">Promedio</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros y controles */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center space-x-2">
                <TrendingDown className="h-5 w-5 text-red-600" />
                <span>Historial de Gastos</span>
              </CardTitle>
              <CardDescription>Registro de todos tus gastos y compras</CardDescription>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAmounts(!showAmounts)}
              >
                {showAmounts ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </Button>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Exportar
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filtros */}
          <div className="flex flex-wrap gap-4 mb-6">
            <div className="flex items-center space-x-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <select 
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-3 py-1 border rounded-md text-sm"
              >
                <option value="all">Todas las categorías</option>
                {categories.map(category => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center space-x-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <select 
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value)}
                className="px-3 py-1 border rounded-md text-sm"
              >
                <option value="all">Todo el tiempo</option>
                <option value="month">Este mes</option>
                <option value="week">Esta semana</option>
              </select>
            </div>
          </div>

          {/* Lista de transacciones */}
          <div className="space-y-3">
            {filteredTransactions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <TrendingDown className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No hay gastos registrados para los filtros seleccionados</p>
              </div>
            ) : (
              filteredTransactions.map((transaction) => {
                const CategoryIcon = categoryIcons[transaction.category as keyof typeof categoryIcons] || ShoppingBag;
                return (
                  <div key={transaction.id} className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 transition-colors">
                    <div className="flex items-center space-x-4">
                      <div className="p-3 bg-red-100 rounded-full">
                        <CategoryIcon className="h-5 w-5 text-red-600" />
                      </div>
                      <div className="flex-1">
                        <div className="font-medium">{transaction.description}</div>
                        <div className="text-sm text-muted-foreground flex items-center space-x-2">
                          <Badge variant="outline" className={categoryColors[transaction.category as keyof typeof categoryColors]}>
                            {transaction.category}
                          </Badge>
                          <span>•</span>
                          <span>{transaction.location}</span>
                          <span>•</span>
                          <span>{formatDate(transaction.date)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <Badge className={statusColors[transaction.status]}>
                        {transaction.status === 'completed' ? 'Completado' : 
                         transaction.status === 'pending' ? 'Pendiente' : 'Cancelado'}
                      </Badge>
                      <div className="text-right">
                        <div className="text-lg font-bold text-red-600">
                          {showAmounts ? `-${formatCurrency(transaction.amount)}` : "-••••"}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Resumen por categorías */}
          {Object.keys(stats.categoryTotals).length > 0 && (
            <div className="mt-6 pt-6 border-t">
              <h4 className="font-medium mb-4">Resumen por Categorías</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.entries(stats.categoryTotals).map(([category, total]) => {
                  const CategoryIcon = categoryIcons[category as keyof typeof categoryIcons] || ShoppingBag;
                  return (
                    <div key={category} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                      <div className="flex items-center space-x-2">
                        <CategoryIcon className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">{category}</span>
                      </div>
                      <span className="text-sm font-bold text-red-600">
                        {showAmounts ? formatCurrency(total) : "••••"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
