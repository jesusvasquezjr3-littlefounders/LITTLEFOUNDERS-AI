import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  FileText, 
  Download,
  Calendar,
  DollarSign,
  TrendingUp,
  TrendingDown,
  User,
  CreditCard,
  Filter,
  RefreshCw
} from "lucide-react";

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

// Función para obtener transacciones del niño
const getChildTransactions = (childId: string) => {
  try {
    const savedTransactions = localStorage.getItem(`transactions_${childId}`);
    if (savedTransactions) {
      return JSON.parse(savedTransactions);
    }
  } catch (error) {
    console.error('Error cargando transacciones del niño:', error);
  }
  
  return [];
};

// Función para obtener datos de la tarjeta virtual del niño
const getChildVirtualCardData = (childId: string) => {
  try {
    const savedCard = localStorage.getItem(`virtualCard_${childId}`);
    if (savedCard) {
      return JSON.parse(savedCard);
    }
  } catch (error) {
    console.error('Error cargando datos de tarjeta virtual del niño:', error);
  }
  
  return {
    balance: 0,
    dailyLimit: 25.00,
    transactionLimit: 10.00,
    allowedCategories: ['food', 'entertainment', 'books'],
    isFrozen: false
  };
};

interface StatementData {
  period: string;
  startDate: string;
  endDate: string;
  openingBalance: number;
  closingBalance: number;
  totalIncome: number;
  totalExpenses: number;
  transactions: any[];
  summary: {
    incomeByCategory: Record<string, number>;
    expenseByCategory: Record<string, number>;
    transactionCount: number;
  };
}

export function AccountStatement() {
  const [user, setUser] = useState<any>(null);
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [statementData, setStatementData] = useState<StatementData | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    const currentUser = getCurrentUser();
    setUser(currentUser);
    
    // Establecer el mes actual por defecto
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    setSelectedMonth(currentMonth);
  }, []);

  useEffect(() => {
    if (selectedMonth && user?.user_type === 'child') {
      generateStatement();
    }
  }, [selectedMonth, user]);

  const generateStatement = () => {
    if (!user || user.user_type !== 'child') return;

    const childId = user.id || 'child001';
    const allTransactions = getChildTransactions(childId);
    const cardData = getChildVirtualCardData(childId);

    // Filtrar transacciones del mes seleccionado
    const [year, month] = selectedMonth.split('-');
    const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
    const endDate = new Date(parseInt(year), parseInt(month), 0);

    const monthTransactions = allTransactions.filter((transaction: any) => {
      const transactionDate = new Date(transaction.date);
      return transactionDate >= startDate && transactionDate <= endDate;
    });

    // Calcular totales
    const incomeTransactions = monthTransactions.filter((t: any) => t.type === 'income');
    const expenseTransactions = monthTransactions.filter((t: any) => t.type === 'expense');

    const totalIncome = incomeTransactions.reduce((sum: number, t: any) => sum + t.amount, 0);
    const totalExpenses = expenseTransactions.reduce((sum: number, t: any) => sum + t.amount, 0);

    // Calcular balance de apertura (simulado)
    const openingBalance = Math.max(0, cardData.balance - totalIncome + totalExpenses);
    const closingBalance = cardData.balance;

    // Agrupar por categorías
    const incomeByCategory = incomeTransactions.reduce((acc: Record<string, number>, t: any) => {
      acc[t.category] = (acc[t.category] || 0) + t.amount;
      return acc;
    }, {});

    const expenseByCategory = expenseTransactions.reduce((acc: Record<string, number>, t: any) => {
      acc[t.category] = (acc[t.category] || 0) + t.amount;
      return acc;
    }, {});

    const statement: StatementData = {
      period: `${month}/${year}`,
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      openingBalance,
      closingBalance,
      totalIncome,
      totalExpenses,
      transactions: monthTransactions.sort((a: any, b: any) => 
        new Date(b.date).getTime() - new Date(a.date).getTime()
      ),
      summary: {
        incomeByCategory,
        expenseByCategory,
        transactionCount: monthTransactions.length
      }
    };

    setStatementData(statement);
  };

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

  const generatePDF = () => {
    if (!statementData) return;

    setIsGenerating(true);

    // Crear contenido HTML para el PDF
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Estado de Cuenta - ${user?.name}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          .header { text-align: center; margin-bottom: 30px; }
          .header h1 { color: #2563eb; margin: 0; }
          .header p { margin: 5px 0; color: #666; }
          .summary { display: flex; justify-content: space-between; margin-bottom: 30px; }
          .summary-card { border: 1px solid #ddd; padding: 15px; border-radius: 8px; text-align: center; }
          .summary-card h3 { margin: 0 0 10px 0; color: #333; }
          .summary-card .amount { font-size: 24px; font-weight: bold; }
          .income { color: #16a34a; }
          .expense { color: #dc2626; }
          .balance { color: #2563eb; }
          .transactions { margin-top: 30px; }
          .transactions h3 { color: #333; border-bottom: 2px solid #2563eb; padding-bottom: 10px; }
          .transaction { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; }
          .transaction:last-child { border-bottom: none; }
          .transaction-info { flex: 1; }
          .transaction-date { color: #666; font-size: 12px; }
          .transaction-amount { font-weight: bold; }
          .income-amount { color: #16a34a; }
          .expense-amount { color: #dc2626; }
          .categories { margin-top: 30px; }
          .category-section { margin-bottom: 20px; }
          .category-item { display: flex; justify-content: space-between; padding: 5px 0; }
          .footer { margin-top: 40px; text-align: center; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>LITTLE FOUNDERS</h1>
          <h2>Estado de Cuenta</h2>
          <p><strong>Cliente:</strong> ${user?.name}</p>
          <p><strong>Período:</strong> ${statementData.period}</p>
          <p><strong>Fecha de emisión:</strong> ${new Date().toLocaleDateString('es-ES')}</p>
        </div>

        <div class="summary">
          <div class="summary-card">
            <h3>Balance de Apertura</h3>
            <div class="amount balance">${formatCurrency(statementData.openingBalance)}</div>
          </div>
          <div class="summary-card">
            <h3>Total Ingresos</h3>
            <div class="amount income">${formatCurrency(statementData.totalIncome)}</div>
          </div>
          <div class="summary-card">
            <h3>Total Gastos</h3>
            <div class="amount expense">${formatCurrency(statementData.totalExpenses)}</div>
          </div>
          <div class="summary-card">
            <h3>Balance de Cierre</h3>
            <div class="amount balance">${formatCurrency(statementData.closingBalance)}</div>
          </div>
        </div>

        <div class="transactions">
          <h3>Movimientos del Período (${statementData.transactions.length} transacciones)</h3>
          ${statementData.transactions.map(transaction => `
            <div class="transaction">
              <div class="transaction-info">
                <div>${transaction.description}</div>
                <div class="transaction-date">${formatDate(transaction.date)} - ${transaction.category}</div>
              </div>
              <div class="transaction-amount ${transaction.type === 'income' ? 'income-amount' : 'expense-amount'}">
                ${transaction.type === 'income' ? '+' : '-'}${formatCurrency(transaction.amount)}
              </div>
            </div>
          `).join('')}
        </div>

        <div class="categories">
          <div class="category-section">
            <h3>Resumen por Categorías - Ingresos</h3>
            ${Object.entries(statementData.summary.incomeByCategory).map(([category, amount]) => `
              <div class="category-item">
                <span>${category}</span>
                <span class="income-amount">${formatCurrency(amount)}</span>
              </div>
            `).join('')}
          </div>

          <div class="category-section">
            <h3>Resumen por Categorías - Gastos</h3>
            ${Object.entries(statementData.summary.expenseByCategory).map(([category, amount]) => `
              <div class="category-item">
                <span>${category}</span>
                <span class="expense-amount">${formatCurrency(amount)}</span>
              </div>
            `).join('')}
          </div>
        </div>

        <div class="footer">
          <p>Este estado de cuenta ha sido generado automáticamente por Little Founders</p>
          <p>Para consultas, contacta a tus padres o tutores</p>
        </div>
      </body>
      </html>
    `;

    // Crear ventana nueva para imprimir
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      printWindow.focus();
      
      // Esperar un momento y luego imprimir
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
        setIsGenerating(false);
      }, 500);
    } else {
      setIsGenerating(false);
    }
  };

  const getMonthOptions = () => {
    const options = [];
    const now = new Date();
    
    // Generar opciones para los últimos 12 meses
    for (let i = 0; i < 12; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const label = date.toLocaleDateString('es-ES', { 
        year: 'numeric', 
        month: 'long' 
      });
      options.push({ value, label });
    }
    
    return options;
  };

  if (!user || user.user_type !== 'child') {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">
            <User className="h-12 w-12 mx-auto mb-4" />
            <p>Este componente es solo para usuarios tipo "child"</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Estado de Cuenta</h2>
          <p className="text-muted-foreground">
            Genera un reporte detallado de tus movimientos mensuales
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button onClick={generateStatement} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualizar
          </Button>
        </div>
      </div>

      {/* Selector de mes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Calendar className="h-5 w-5" />
            <span>Seleccionar Período</span>
          </CardTitle>
          <CardDescription>
            Elige el mes para generar el estado de cuenta
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-4">
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-64">
                <SelectValue placeholder="Seleccionar mes" />
              </SelectTrigger>
              <SelectContent>
                {getMonthOptions().map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button 
              onClick={generatePDF} 
              disabled={!statementData || isGenerating}
              className="flex items-center space-x-2"
            >
              <Download className="h-4 w-4" />
              <span>{isGenerating ? 'Generando...' : 'Descargar PDF'}</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Resumen del estado de cuenta */}
      {statementData && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-blue-100 rounded-full">
                  <CreditCard className="h-6 w-6 text-blue-600" />
                </div>
                <div className="flex-1">
                  <div className="text-2xl font-bold text-blue-600">
                    {formatCurrency(statementData.openingBalance)}
                  </div>
                  <div className="text-sm text-muted-foreground">Balance Inicial</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-green-100 rounded-full">
                  <TrendingUp className="h-6 w-6 text-green-600" />
                </div>
                <div className="flex-1">
                  <div className="text-2xl font-bold text-green-600">
                    {formatCurrency(statementData.totalIncome)}
                  </div>
                  <div className="text-sm text-muted-foreground">Total Ingresos</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-red-100 rounded-full">
                  <TrendingDown className="h-6 w-6 text-red-600" />
                </div>
                <div className="flex-1">
                  <div className="text-2xl font-bold text-red-600">
                    {formatCurrency(statementData.totalExpenses)}
                  </div>
                  <div className="text-sm text-muted-foreground">Total Gastos</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-purple-100 rounded-full">
                  <DollarSign className="h-6 w-6 text-purple-600" />
                </div>
                <div className="flex-1">
                  <div className="text-2xl font-bold text-purple-600">
                    {formatCurrency(statementData.closingBalance)}
                  </div>
                  <div className="text-sm text-muted-foreground">Balance Final</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Detalle de transacciones */}
      {statementData && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <FileText className="h-5 w-5" />
              <span>Movimientos del Período</span>
            </CardTitle>
            <CardDescription>
              {statementData.transactions.length} transacciones en {statementData.period}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {statementData.transactions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No hay transacciones para este período</p>
              </div>
            ) : (
              <div className="space-y-3">
                {statementData.transactions.map((transaction) => (
                  <div key={transaction.id} className="flex items-center justify-between p-4 rounded-lg border">
                    <div className="flex items-center space-x-4">
                      <div className={`p-3 rounded-full ${
                        transaction.type === 'income' 
                          ? 'bg-green-100 text-green-600' 
                          : 'bg-red-100 text-red-600'
                      }`}>
                        {transaction.type === 'income' ? (
                          <TrendingUp className="h-5 w-5" />
                        ) : (
                          <TrendingDown className="h-5 w-5" />
                        )}
                      </div>
                      <div>
                        <div className="font-medium">{transaction.description}</div>
                        <div className="text-sm text-muted-foreground flex items-center space-x-2">
                          <Badge variant="outline">{transaction.category}</Badge>
                          <span>•</span>
                          <span>{formatDate(transaction.date)}</span>
                        </div>
                      </div>
                    </div>
                    <div className={`font-semibold ${
                      transaction.type === 'income' ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {transaction.type === 'income' ? '+' : '-'}{formatCurrency(transaction.amount)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Resumen por categorías */}
      {statementData && (Object.keys(statementData.summary.incomeByCategory).length > 0 || Object.keys(statementData.summary.expenseByCategory).length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Ingresos por categoría */}
          {Object.keys(statementData.summary.incomeByCategory).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                  <span>Ingresos por Categoría</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(statementData.summary.incomeByCategory).map(([category, amount]) => (
                    <div key={category} className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                      <span className="font-medium">{category}</span>
                      <span className="font-bold text-green-600">
                        {formatCurrency(amount)}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Gastos por categoría */}
          {Object.keys(statementData.summary.expenseByCategory).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <TrendingDown className="h-5 w-5 text-red-600" />
                  <span>Gastos por Categoría</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(statementData.summary.expenseByCategory).map(([category, amount]) => (
                    <div key={category} className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                      <span className="font-medium">{category}</span>
                      <span className="font-bold text-red-600">
                        {formatCurrency(amount)}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
