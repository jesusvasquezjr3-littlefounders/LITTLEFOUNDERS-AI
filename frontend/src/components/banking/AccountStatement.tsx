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

// Datos de ejemplo realistas para el estado de cuenta
const getDummyTransactionsForStatement = (): any[] => {
  const today = new Date();
  const formatDate = (daysAgo: number) => {
    const date = new Date(today);
    date.setDate(date.getDate() - daysAgo);
    return date.toISOString().split('T')[0];
  };

  return [
    // Ingresos con descripciones bancarias reales
    {
      id: "stmt_1",
      type: "income",
      amount: 25.00,
      description: "ABONO NÓMINA - MESADA SEMANAL",
      date: formatDate(0),
      category: "Mesada"
    },
    {
      id: "stmt_2",
      type: "income",
      amount: 8.00,
      description: "TRANSFERENCIA SPEI - TAREA ORDENAR",
      date: formatDate(1),
      category: "Tareas"
    },
    {
      id: "stmt_3",
      type: "income",
      amount: 15.00,
      description: "DEPÓSITO EFECTIVO - BONO ESCOLAR",
      date: formatDate(3),
      category: "Bonificación"
    },
    {
      id: "stmt_4",
      type: "income",
      amount: 50.00,
      description: "TRANSFERENCIA - REGALO CUMPLEAÑOS",
      date: formatDate(5),
      category: "Regalo"
    },
    {
      id: "stmt_5",
      type: "income",
      amount: 5.00,
      description: "TRANSFERENCIA SPEI - TAREA PLATOS",
      date: formatDate(6),
      category: "Tareas"
    },
    {
      id: "stmt_6",
      type: "income",
      amount: 25.00,
      description: "ABONO NÓMINA - MESADA SEMANAL",
      date: formatDate(7),
      category: "Mesada"
    },
    // Gastos con descripciones de comercios reales
    {
      id: "stmt_7",
      type: "expense",
      amount: 12.99,
      description: "COMPRA TDC NINTENDO ESHOP*DIGITAL",
      date: formatDate(0),
      category: "Entretenimiento"
    },
    {
      id: "stmt_8",
      type: "expense",
      amount: 4.50,
      description: "COMPRA TDC OXXO SUC 4521",
      date: formatDate(1),
      category: "Comida"
    },
    {
      id: "stmt_9",
      type: "expense",
      amount: 8.99,
      description: "CARGO RECURRENTE SPOTIFY AB",
      date: formatDate(2),
      category: "Entretenimiento"
    },
    {
      id: "stmt_10",
      type: "expense",
      amount: 15.50,
      description: "COMPRA TDC CINEPOLIS PLAZA CTR",
      date: formatDate(3),
      category: "Entretenimiento"
    },
    {
      id: "stmt_11",
      type: "expense",
      amount: 6.75,
      description: "COMPRA TDC ARCOS DORADOS REST 8832",
      date: formatDate(4),
      category: "Comida"
    },
    {
      id: "stmt_12",
      type: "expense",
      amount: 24.99,
      description: "COMPRA INT AMAZON.COM.MX*RT5K29X",
      date: formatDate(5),
      category: "Compra"
    },
    {
      id: "stmt_13",
      type: "expense",
      amount: 3.25,
      description: "COMPRA TDC 7-ELEVEN #156",
      date: formatDate(6),
      category: "Comida"
    },
    {
      id: "stmt_14",
      type: "expense",
      amount: 18.90,
      description: "COMPRA TDC GANDHI SA DE CV",
      date: formatDate(7),
      category: "Educación"
    },
    {
      id: "stmt_15",
      type: "expense",
      amount: 9.99,
      description: "COMPRA INT ROBLOX CORPORATION",
      date: formatDate(8),
      category: "Entretenimiento"
    },
    {
      id: "stmt_16",
      type: "expense",
      amount: 5.00,
      description: "TRASPASO ENTRE CTAS - A AHORRO",
      date: formatDate(9),
      category: "Ahorro"
    },
    {
      id: "stmt_17",
      type: "expense",
      amount: 7.50,
      description: "COMPRA TDC STARBUCKS #2143",
      date: formatDate(10),
      category: "Comida"
    },
    {
      id: "stmt_18",
      type: "expense",
      amount: 35.00,
      description: "COMPRA TDC INDITEX ZARA KIDS",
      date: formatDate(12),
      category: "Compra"
    },
    {
      id: "stmt_19",
      type: "expense",
      amount: 14.99,
      description: "CARGO RECURRENTE APPLE.COM/BILL",
      date: formatDate(14),
      category: "Entretenimiento"
    },
    {
      id: "stmt_20",
      type: "income",
      amount: 25.00,
      description: "ABONO NÓMINA - MESADA SEMANAL",
      date: formatDate(14),
      category: "Mesada"
    },
    {
      id: "stmt_21",
      type: "expense",
      amount: 11.25,
      description: "COMPRA TDC ALSEA DOMINOS #4412",
      date: formatDate(15),
      category: "Comida"
    },
    {
      id: "stmt_22",
      type: "income",
      amount: 12.00,
      description: "TRANSFERENCIA SPEI - TAREA AUTO",
      date: formatDate(16),
      category: "Tareas"
    },
    {
      id: "stmt_23",
      type: "expense",
      amount: 19.99,
      description: "COMPRA INT STEAM PURCHASE",
      date: formatDate(18),
      category: "Entretenimiento"
    },
    {
      id: "stmt_24",
      type: "income",
      amount: 25.00,
      description: "ABONO NÓMINA - MESADA SEMANAL",
      date: formatDate(21),
      category: "Mesada"
    },
    {
      id: "stmt_25",
      type: "expense",
      amount: 8.50,
      description: "COMPRA TDC SUBWAY REST #7821",
      date: formatDate(22),
      category: "Comida"
    },
    {
      id: "stmt_26",
      type: "expense",
      amount: 42.00,
      description: "COMPRA INT TOYS R US ONLINE",
      date: formatDate(25),
      category: "Compra"
    },
    {
      id: "stmt_27",
      type: "income",
      amount: 25.00,
      description: "ABONO NÓMINA - MESADA SEMANAL",
      date: formatDate(28),
      category: "Mesada"
    },
    {
      id: "stmt_28",
      type: "expense",
      amount: 16.75,
      description: "COMPRA TDC MINISO ACCESSORIES",
      date: formatDate(29),
      category: "Compra"
    },
    {
      id: "stmt_29",
      type: "expense",
      amount: 5.99,
      description: "CARGO RECURRENTE NETFLIX.COM",
      date: formatDate(30),
      category: "Entretenimiento"
    }
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
};

// Función para obtener transacciones del niño
const getChildTransactions = (childId: string) => {
  try {
    const savedTransactions = localStorage.getItem(`transactions_${childId}`);
    if (savedTransactions) {
      const transactions = JSON.parse(savedTransactions);
      if (transactions.length > 0) return transactions;
    }
  } catch (error) {
    console.error('Error cargando transacciones del niño:', error);
  }
  
  // Retornar datos de ejemplo si no hay transacciones reales
  return getDummyTransactionsForStatement();
};

// Función para obtener datos de la tarjeta virtual del niño
const getChildVirtualCardData = (childId: string) => {
  try {
    const savedCard = localStorage.getItem(`virtualCard_${childId}`);
    if (savedCard) {
      const card = JSON.parse(savedCard);
      if (card.balance > 0) return card;
    }
  } catch (error) {
    console.error('Error cargando datos de tarjeta virtual del niño:', error);
  }
  
  // Datos de ejemplo realistas
  return {
    balance: 87.50,
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
    if (selectedMonth && user) {
      generateStatement();
    }
  }, [selectedMonth, user]);

  const generateStatement = () => {
    if (!user) return;

    const userId = user.id || (user.user_type === 'child' ? 'child001' : 'tutor001');
    const allTransactions = getChildTransactions(userId);
    const cardData = getChildVirtualCardData(userId);

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

    // Crear contenido HTML para el PDF con formato estilo BBVA
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Estado de Cuenta - ${user?.name}</title>
        <style>
          body { 
            font-family: Arial, sans-serif; 
            margin: 0; 
            padding: 20px; 
            font-size: 12px;
            line-height: 1.4;
          }
          
          /* Header estilo BBVA */
          .header { 
            display: flex; 
            justify-content: space-between; 
            align-items: flex-start;
            margin-bottom: 20px;
            border-bottom: 2px solid #2563eb;
            padding-bottom: 15px;
          }
          
          .header-left {
            flex: 1;
          }
          
          .header-right {
            text-align: right;
            flex: 1;
          }
          
          .bank-name { 
            font-size: 24px; 
            font-weight: bold; 
            color: #2563eb; 
            margin: 0 0 5px 0;
          }
          
          .account-title {
            font-size: 18px;
            font-weight: bold;
            color: #333;
            margin: 0;
          }
          
          .page-info {
            font-size: 14px;
            color: #666;
            margin: 0;
          }
          
          /* Información del cliente */
          .client-info {
            display: flex;
            justify-content: space-between;
            margin-bottom: 20px;
            padding: 15px;
            background-color: #f8f9fa;
            border: 1px solid #dee2e6;
          }
          
          .client-details {
            flex: 1;
          }
          
          .account-details {
            flex: 1;
            text-align: right;
          }
          
          .info-row {
            display: flex;
            margin-bottom: 5px;
            font-size: 11px;
          }
          
          .info-label {
            font-weight: bold;
            width: 120px;
            color: #333;
          }
          
          .info-value {
            color: #666;
          }
          
          /* Información financiera estilo BBVA */
          .financial-info {
            margin-bottom: 20px;
          }
          
          .financial-title {
            font-size: 14px;
            font-weight: bold;
            color: #333;
            margin-bottom: 10px;
            border-bottom: 1px solid #2563eb;
            padding-bottom: 5px;
          }
          
          .financial-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin-bottom: 20px;
          }
          
          .financial-section {
            border: 1px solid #dee2e6;
            padding: 10px;
          }
          
          .section-title {
            font-weight: bold;
            color: #333;
            margin-bottom: 8px;
            font-size: 12px;
          }
          
          .financial-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 3px;
            font-size: 11px;
          }
          
          .financial-label {
            color: #666;
          }
          
          .financial-value {
            font-weight: bold;
            color: #333;
          }
          
          .income-value {
            color: #16a34a;
          }
          
          .expense-value {
            color: #dc2626;
          }
          
          .balance-value {
            color: #2563eb;
          }
          
          /* Comisiones */
          .commissions {
            margin-bottom: 20px;
          }
          
          .commissions-title {
            font-size: 14px;
            font-weight: bold;
            color: #333;
            margin-bottom: 10px;
            border-bottom: 1px solid #2563eb;
            padding-bottom: 5px;
          }
          
          .commissions-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
          }
          
          .commission-section {
            border: 1px solid #dee2e6;
            padding: 10px;
          }
          
          /* Movimientos */
          .movements {
            margin-bottom: 20px;
          }
          
          .movements-title {
            font-size: 14px;
            font-weight: bold;
            color: #333;
            margin-bottom: 10px;
            border-bottom: 1px solid #2563eb;
            padding-bottom: 5px;
          }
          
          .movements-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 10px;
          }
          
          .movements-table th {
            background-color: #2563eb;
            color: white;
            padding: 8px 4px;
            text-align: left;
            font-weight: bold;
            border: 1px solid #1d4ed8;
          }
          
          .movements-table td {
            padding: 6px 4px;
            border: 1px solid #dee2e6;
            vertical-align: top;
          }
          
          .movements-table tr:nth-child(even) {
            background-color: #f8f9fa;
          }
          
          .date-cell {
            width: 80px;
            text-align: center;
          }
          
          .description-cell {
            width: 200px;
          }
          
          .reference-cell {
            width: 100px;
            text-align: center;
            font-family: monospace;
          }
          
          .charges-cell {
            width: 80px;
            text-align: right;
            color: #dc2626;
            font-weight: bold;
          }
          
          .credits-cell {
            width: 80px;
            text-align: right;
            color: #16a34a;
            font-weight: bold;
          }
          
          .balance-cell {
            width: 80px;
            text-align: right;
            font-weight: bold;
            color: #2563eb;
          }
          
          /* Resumen por categorías */
          .categories {
            margin-bottom: 20px;
          }
          
          .categories-title {
            font-size: 14px;
            font-weight: bold;
            color: #333;
            margin-bottom: 10px;
            border-bottom: 1px solid #2563eb;
            padding-bottom: 5px;
          }
          
          .categories-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
          }
          
          .category-section {
            border: 1px solid #dee2e6;
            padding: 10px;
          }
          
          .category-title {
            font-weight: bold;
            color: #333;
            margin-bottom: 8px;
            font-size: 12px;
          }
          
          .category-item {
            display: flex;
            justify-content: space-between;
            margin-bottom: 3px;
            font-size: 11px;
          }
          
          .category-name {
            color: #666;
          }
          
          .category-amount {
            font-weight: bold;
          }
          
          .category-income {
            color: #16a34a;
          }
          
          .category-expense {
            color: #dc2626;
          }
          
          /* Footer */
          .footer {
            margin-top: 30px;
            text-align: center;
            color: #666;
            font-size: 10px;
            border-top: 1px solid #dee2e6;
            padding-top: 15px;
          }
          
          .footer p {
            margin: 2px 0;
          }
        </style>
      </head>
      <body>
        <!-- Header estilo BBVA -->
        <div class="header">
          <div class="header-left">
            <div class="bank-name">LITTLE FOUNDERS</div>
            <div class="account-title">Estado de Cuenta</div>
          </div>
          <div class="header-right">
            <div class="page-info">PÁGINA 1/1</div>
            <div class="page-info">${new Date().toLocaleDateString('es-ES')}</div>
          </div>
        </div>

        <!-- Información del cliente -->
        <div class="client-info">
          <div class="client-details">
            <div class="info-row">
              <span class="info-label">Cliente:</span>
              <span class="info-value">${user?.name}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Período:</span>
              <span class="info-value">DEL ${statementData.startDate} AL ${statementData.endDate}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Fecha de Corte:</span>
              <span class="info-value">${statementData.endDate}</span>
            </div>
          </div>
          <div class="account-details">
            <div class="info-row">
              <span class="info-label">No. de Cuenta:</span>
              <span class="info-value">LF${user?.id || '001'}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Tipo de Cuenta:</span>
              <span class="info-value">Cuenta Digital Infantil</span>
            </div>
            <div class="info-row">
              <span class="info-label">Moneda:</span>
              <span class="info-value">USD</span>
            </div>
          </div>
        </div>

        <!-- Información Financiera -->
        <div class="financial-info">
          <div class="financial-title">Información Financiera</div>
          <div class="financial-grid">
            <div class="financial-section">
              <div class="section-title">Rendimiento</div>
              <div class="financial-row">
                <span class="financial-label">Saldo Promedio:</span>
                <span class="financial-value">${formatCurrency((statementData.openingBalance + statementData.closingBalance) / 2)}</span>
              </div>
              <div class="financial-row">
                <span class="financial-label">Días del Período:</span>
                <span class="financial-value">${Math.ceil((new Date(statementData.endDate).getTime() - new Date(statementData.startDate).getTime()) / (1000 * 60 * 60 * 24))}</span>
              </div>
              <div class="financial-row">
                <span class="financial-label">Tasa Bruta Anual %:</span>
                <span class="financial-value">0.000</span>
              </div>
              <div class="financial-row">
                <span class="financial-label">Intereses a Favor (+):</span>
                <span class="financial-value">$0.00</span>
              </div>
            </div>
            <div class="financial-section">
              <div class="section-title">Comportamiento</div>
              <div class="financial-row">
                <span class="financial-label">Saldo Anterior:</span>
                <span class="financial-value">${formatCurrency(statementData.openingBalance)}</span>
              </div>
              <div class="financial-row">
                <span class="financial-label">Depósitos/Abonos (+):</span>
                <span class="financial-value">${statementData.transactions.filter(t => t.type === 'income').length} ${formatCurrency(statementData.totalIncome)}</span>
              </div>
              <div class="financial-row">
                <span class="financial-label">Retiros/Cargos (-):</span>
                <span class="financial-value">${statementData.transactions.filter(t => t.type === 'expense').length} ${formatCurrency(statementData.totalExpenses)}</span>
              </div>
              <div class="financial-row">
                <span class="financial-label">Saldo Final:</span>
                <span class="financial-value">${formatCurrency(statementData.closingBalance)}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Comisiones -->
        <div class="commissions">
          <div class="commissions-title">Comisiones</div>
          <div class="commissions-grid">
            <div class="commission-section">
              <div class="section-title">Comisiones Principales</div>
              <div class="financial-row">
                <span class="financial-label">Manejo de Cuenta:</span>
                <span class="financial-value">$0.00</span>
              </div>
              <div class="financial-row">
                <span class="financial-label">Total Comisiones:</span>
                <span class="financial-value">$0.00</span>
              </div>
            </div>
            <div class="commission-section">
              <div class="section-title">Resumen de Movimientos</div>
              <div class="financial-row">
                <span class="financial-label">Total Transacciones:</span>
                <span class="financial-value">${statementData.transactions.length}</span>
              </div>
              <div class="financial-row">
                <span class="financial-label">Promedio por Transacción:</span>
                <span class="financial-value">${formatCurrency(statementData.transactions.length > 0 ? (statementData.totalIncome + statementData.totalExpenses) / statementData.transactions.length : 0)}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Detalle de Movimientos -->
        <div class="movements">
          <div class="movements-title">Detalle de Movimientos Realizados</div>
          <table class="movements-table">
            <thead>
              <tr>
                <th class="date-cell">FECHA</th>
                <th class="description-cell">DESCRIPCIÓN</th>
                <th class="reference-cell">REFERENCIA</th>
                <th class="charges-cell">CARGOS</th>
                <th class="credits-cell">ABONOS</th>
                <th class="balance-cell">SALDO</th>
              </tr>
            </thead>
            <tbody>
              ${statementData.transactions.map((transaction, index) => {
                const date = new Date(transaction.date);
                const formattedDate = date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }).toUpperCase();
                const runningBalance = statementData.openingBalance + 
                  statementData.transactions.slice(0, index + 1).reduce((sum, t) => 
                    sum + (t.type === 'income' ? t.amount : -t.amount), 0);
                
                return `
                  <tr>
                    <td class="date-cell">${formattedDate}</td>
                    <td class="description-cell">${transaction.description}</td>
                    <td class="reference-cell">LF${String(index + 1).padStart(6, '0')}</td>
                    <td class="charges-cell">${transaction.type === 'expense' ? formatCurrency(transaction.amount) : ''}</td>
                    <td class="credits-cell">${transaction.type === 'income' ? formatCurrency(transaction.amount) : ''}</td>
                    <td class="balance-cell">${formatCurrency(runningBalance)}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>

        <!-- Resumen por Categorías -->
        <div class="categories">
          <div class="categories-title">Resumen por Categorías</div>
          <div class="categories-grid">
            <div class="category-section">
              <div class="category-title">Ingresos por Categoría</div>
              ${Object.entries(statementData.summary.incomeByCategory).length > 0 ? 
                Object.entries(statementData.summary.incomeByCategory).map(([category, amount]) => `
                  <div class="category-item">
                    <span class="category-name">${category}</span>
                    <span class="category-amount category-income">${formatCurrency(amount)}</span>
                  </div>
                `).join('') : 
                '<div class="category-item"><span class="category-name">Sin ingresos</span><span class="category-amount">$0.00</span></div>'
              }
            </div>
            <div class="category-section">
              <div class="category-title">Gastos por Categoría</div>
              ${Object.entries(statementData.summary.expenseByCategory).length > 0 ? 
                Object.entries(statementData.summary.expenseByCategory).map(([category, amount]) => `
                  <div class="category-item">
                    <span class="category-name">${category}</span>
                    <span class="category-amount category-expense">${formatCurrency(amount)}</span>
                  </div>
                `).join('') : 
                '<div class="category-item"><span class="category-name">Sin gastos</span><span class="category-amount">$0.00</span></div>'
              }
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="footer">
          <p><strong>LITTLE FOUNDERS - Plataforma de Educación Financiera Infantil</strong></p>
          <p>Este estado de cuenta ha sido generado automáticamente por Little Founders</p>
          <p>Para consultas, contacta a tus padres o tutores</p>
          <p>Fecha de generación: ${new Date().toLocaleString('es-ES')}</p>
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

  if (!user) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">
            <User className="h-12 w-12 mx-auto mb-4" />
            <p>Cargando información...</p>
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
