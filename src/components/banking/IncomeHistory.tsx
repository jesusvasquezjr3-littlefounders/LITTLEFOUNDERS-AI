import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  TrendingUp,
  ArrowUpRight,
  DollarSign,
  Calendar,
  Filter,
  Download,
  Eye,
  EyeOff,
  Gift,
  Trophy,
  Star,
  Target,
  PiggyBank,
  BookOpen,
  Users,
  Home
} from "lucide-react";
import { useState, useEffect } from "react";

interface IncomeTransaction {
  id: string;
  amount: number;
  description: string;
  date: string;
  category: string;
  source: string;
  status: 'completed' | 'pending' | 'approved';
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

// Función para obtener transacciones de ingresos del localStorage
const getIncomeTransactions = (): IncomeTransaction[] => {
  try {
    const user = getCurrentUser();
    let transactionKey = 'incomeTransactions';
    
    // Si es un niño, usar la clave específica del niño
    if (user?.user_type === 'child') {
      // Obtener el ID del niño desde el usuario o usar un ID por defecto
      const childId = user.id || 'child001';
      transactionKey = `transactions_${childId}`;
      
      // Obtener todas las transacciones del niño y filtrar solo las de ingreso
      const savedTransactions = localStorage.getItem(transactionKey);
      if (savedTransactions) {
        const allTransactions = JSON.parse(savedTransactions);
        return allTransactions.filter((t: any) => t.type === 'income').map((t: any) => ({
          id: t.id,
          amount: t.amount,
          description: t.description,
          date: t.date,
          category: t.category,
          source: t.category === 'Mesada' ? 'Padres' : 
                  t.category === 'Tareas' ? 'Sistema de tareas' : 'Otros',
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
    console.error('Error cargando transacciones de ingresos:', error);
  }
  
  // Transacciones por defecto si no hay datos guardados
  return [
    {
      id: "1",
      amount: 15.00,
      description: "Mesada semanal",
      date: "2024-01-15",
      category: "Mesada",
      source: "Padres",
      status: "completed"
    },
    {
      id: "2",
      amount: 10.00,
      description: "Tarea completada: Lavar los platos",
      date: "2024-01-14",
      category: "Tareas",
      source: "Sistema de tareas",
      status: "completed"
    },
    {
      id: "3",
      amount: 8.00,
      description: "Tarea completada: Hacer la cama",
      date: "2024-01-13",
      category: "Tareas",
      source: "Sistema de tareas",
      status: "completed"
    },
    {
      id: "4",
      amount: 25.00,
      description: "Regalo de cumpleaños",
      date: "2024-01-12",
      category: "Regalos",
      source: "Abuelos",
      status: "completed"
    },
    {
      id: "5",
      amount: 5.00,
      description: "Tarea completada: Estudiar matemáticas",
      date: "2024-01-11",
      category: "Educación",
      source: "Sistema de tareas",
      status: "completed"
    },
    {
      id: "6",
      amount: 12.00,
      description: "Tarea completada: Ayudar en casa",
      date: "2024-01-10",
      category: "Tareas",
      source: "Sistema de tareas",
      status: "completed"
    },
    {
      id: "7",
      amount: 20.00,
      description: "Pago por buen comportamiento",
      date: "2024-01-09",
      category: "Bonificación",
      source: "Padres",
      status: "completed"
    },
    {
      id: "8",
      amount: 7.00,
      description: "Tarea completada: Leer libro",
      date: "2024-01-08",
      category: "Educación",
      source: "Sistema de tareas",
      status: "completed"
    }
  ];
};

// Función para calcular estadísticas de ingresos
const calculateIncomeStats = (transactions: IncomeTransaction[]) => {
  const totalIncome = transactions.reduce((sum, transaction) => sum + transaction.amount, 0);
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
    totalIncome,
    thisMonthTotal,
    thisMonthCount: thisMonth.length,
    categoryTotals,
    averagePerTransaction: transactions.length > 0 ? totalIncome / transactions.length : 0
  };
};

const categoryIcons = {
  "Mesada": PiggyBank,
  "Tareas": Home,
  "Regalos": Gift,
  "Educación": BookOpen,
  "Bonificación": Trophy,
  "Otros": Star
};

const categoryColors = {
  "Mesada": "bg-blue-100 text-blue-700",
  "Tareas": "bg-green-100 text-green-700",
  "Regalos": "bg-purple-100 text-purple-700",
  "Educación": "bg-yellow-100 text-yellow-700",
  "Bonificación": "bg-orange-100 text-orange-700",
  "Otros": "bg-gray-100 text-gray-700"
};

const statusColors = {
  "completed": "bg-green-100 text-green-700",
  "pending": "bg-yellow-100 text-yellow-700",
  "approved": "bg-blue-100 text-blue-700"
};

export function IncomeHistory() {
  const [showAmounts, setShowAmounts] = useState(true);
  const [transactions, setTransactions] = useState<IncomeTransaction[]>(getIncomeTransactions());
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedPeriod, setSelectedPeriod] = useState<string>("all");
  
  // Actualizar datos cuando cambie el localStorage
  useEffect(() => {
    const updateData = () => {
      const newTransactions = getIncomeTransactions();
      setTransactions(newTransactions);
    };

    updateData();
    const interval = setInterval(updateData, 1000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  // Sincronización automática para niños
  useEffect(() => {
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

    const user = getCurrentUser();
    if (user?.user_type === 'child') {
      // Importar y inicializar la sincronización
      import('@/utils/accountSync').then(({ initializeAccountSync }) => {
        const cleanup = initializeAccountSync();
        return cleanup;
      }).catch(error => {
        console.error('Error inicializando sincronización:', error);
      });
    }
  }, []);

  const stats = calculateIncomeStats(transactions);
  
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
              <div className="p-2 bg-green-100 rounded-full">
                <DollarSign className="h-6 w-6 text-green-600" />
              </div>
              <div className="flex-1">
                <div className="text-2xl font-bold text-green-600">
                  {showAmounts ? formatCurrency(stats.totalIncome) : "••••"}
                </div>
                <div className="text-sm text-muted-foreground">Total Ingresos</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-100 rounded-full">
                <Calendar className="h-6 w-6 text-blue-600" />
              </div>
              <div className="flex-1">
                <div className="text-2xl font-bold text-blue-600">
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
                <TrendingUp className="h-6 w-6 text-purple-600" />
              </div>
              <div className="flex-1">
                <div className="text-2xl font-bold text-purple-600">
                  {stats.thisMonthCount}
                </div>
                <div className="text-sm text-muted-foreground">Transacciones</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-orange-100 rounded-full">
                <Target className="h-6 w-6 text-orange-600" />
              </div>
              <div className="flex-1">
                <div className="text-2xl font-bold text-orange-600">
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
                <TrendingUp className="h-5 w-5 text-green-600" />
                <span>Historial de Ingresos</span>
              </CardTitle>
              <CardDescription>Registro de todos tus ingresos y ganancias</CardDescription>
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
                <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No hay ingresos registrados para los filtros seleccionados</p>
              </div>
            ) : (
              filteredTransactions.map((transaction) => {
                const CategoryIcon = categoryIcons[transaction.category as keyof typeof categoryIcons] || Star;
                return (
                  <div key={transaction.id} className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 transition-colors">
                    <div className="flex items-center space-x-4">
                      <div className="p-3 bg-green-100 rounded-full">
                        <CategoryIcon className="h-5 w-5 text-green-600" />
                      </div>
                      <div className="flex-1">
                        <div className="font-medium">{transaction.description}</div>
                        <div className="text-sm text-muted-foreground flex items-center space-x-2">
                          <Badge variant="outline" className={categoryColors[transaction.category as keyof typeof categoryColors]}>
                            {transaction.category}
                          </Badge>
                          <span>•</span>
                          <span>{transaction.source}</span>
                          <span>•</span>
                          <span>{formatDate(transaction.date)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <Badge className={statusColors[transaction.status]}>
                        {transaction.status === 'completed' ? 'Completado' : 
                         transaction.status === 'pending' ? 'Pendiente' : 'Aprobado'}
                      </Badge>
                      <div className="text-right">
                        <div className="text-lg font-bold text-green-600">
                          {showAmounts ? `+${formatCurrency(transaction.amount)}` : "+••••"}
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
                  const CategoryIcon = categoryIcons[category as keyof typeof categoryIcons] || Star;
                  return (
                    <div key={category} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                      <div className="flex items-center space-x-2">
                        <CategoryIcon className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">{category}</span>
                      </div>
                      <span className="text-sm font-bold text-green-600">
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
