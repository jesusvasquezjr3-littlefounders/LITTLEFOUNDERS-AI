import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { 
  CreditCard, 
  PiggyBank, 
  Target,
  AlertTriangle,
  TrendingUp,
  ArrowUpRight,
  ArrowDownLeft,
  Eye,
  EyeOff
} from "lucide-react";
import { useState } from "react";

interface AccountData {
  main: {
    balance: number;
    currency: string;
  };
  subAccounts: {
    spend: {
      balance: number;
      percentage: number;
      limit: number;
    };
    save: {
      balance: number;
      percentage: number;
      goal: number;
    };
    emergency: {
      balance: number;
      percentage: number;
    };
  };
}

const mockAccountData: AccountData = {
  main: {
    balance: 125.50,
    currency: "USD"
  },
  subAccounts: {
    spend: {
      balance: 62.75,
      percentage: 50,
      limit: 100
    },
    save: {
      balance: 50.20,
      percentage: 40,
      goal: 200
    },
    emergency: {
      balance: 12.55,
      percentage: 10
    }
  }
};

interface Transaction {
  id: string;
  type: 'income' | 'expense';
  amount: number;
  description: string;
  date: string;
  category: string;
}

const recentTransactions: Transaction[] = [
  {
    id: "1",
    type: "income",
    amount: 10.00,
    description: "Tarea completada: Lavar los platos",
    date: "2024-01-15",
    category: "Tareas"
  },
  {
    id: "2",
    type: "expense",
    amount: 5.50,
    description: "Compra de dulces",
    date: "2024-01-14",
    category: "Gastos"
  },
  {
    id: "3",
    type: "income",
    amount: 15.00,
    description: "Mesada semanal",
    date: "2024-01-13",
    category: "Mesada"
  }
];

export function AccountOverview() {
  const [showBalance, setShowBalance] = useState(true);
  const { main, subAccounts } = mockAccountData;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-US', {
      style: 'currency',
      currency: main.currency
    }).format(amount);
  };

  return (
    <div className="space-y-6">
      {/* Main Account Card */}
      <Card className="bg-gradient-to-r from-primary/10 to-customers/10 border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <CreditCard className="h-6 w-6 text-primary" />
              <span>Mi Cuenta Principal</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowBalance(!showBalance)}
            >
              {showBalance ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            </Button>
          </CardTitle>
          <CardDescription>Tu balance total disponible</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center space-y-6">
            <div className="space-y-2">
              <div className="text-4xl font-bold text-primary">
                {showBalance ? formatCurrency(main.balance) : "••••••"}
              </div>
              <div className="text-sm text-muted-foreground">
                Última actualización: hace 2 minutos
              </div>
            </div>

            {/* Sub-accounts */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Spend Account */}
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center space-x-2 mb-3">
                  <Target className="h-5 w-5 text-green-600" />
                  <span className="font-semibold text-green-700">Gastar</span>
                </div>
                <div className="space-y-2">
                  <div className="text-2xl font-bold text-green-700">
                    {showBalance ? formatCurrency(subAccounts.spend.balance) : "••••"}
                  </div>
                  <div className="text-xs text-green-600">
                    {subAccounts.spend.percentage}% del total
                  </div>
                  <Progress 
                    value={(subAccounts.spend.balance / subAccounts.spend.limit) * 100} 
                    className="h-2"
                  />
                  <div className="text-xs text-muted-foreground">
                    Límite: {formatCurrency(subAccounts.spend.limit)}
                  </div>
                </div>
              </div>

              {/* Save Account */}
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center space-x-2 mb-3">
                  <PiggyBank className="h-5 w-5 text-blue-600" />
                  <span className="font-semibold text-blue-700">Ahorrar</span>
                </div>
                <div className="space-y-2">
                  <div className="text-2xl font-bold text-blue-700">
                    {showBalance ? formatCurrency(subAccounts.save.balance) : "••••"}
                  </div>
                  <div className="text-xs text-blue-600">
                    {subAccounts.save.percentage}% del total
                  </div>
                  <Progress 
                    value={(subAccounts.save.balance / subAccounts.save.goal) * 100} 
                    className="h-2"
                  />
                  <div className="text-xs text-muted-foreground">
                    Meta: {formatCurrency(subAccounts.save.goal)}
                  </div>
                </div>
              </div>

              {/* Emergency Account */}
              <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                <div className="flex items-center space-x-2 mb-3">
                  <AlertTriangle className="h-5 w-5 text-orange-600" />
                  <span className="font-semibold text-orange-700">Emergencia</span>
                </div>
                <div className="space-y-2">
                  <div className="text-2xl font-bold text-orange-700">
                    {showBalance ? formatCurrency(subAccounts.emergency.balance) : "••••"}
                  </div>
                  <div className="text-xs text-orange-600">
                    {subAccounts.emergency.percentage}% del total
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Fondo de emergencia
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex justify-center space-x-4 pt-4 border-t">
              <Button size="sm" className="flex-1">
                <ArrowUpRight className="h-4 w-4 mr-2" />
                Transferir
              </Button>
              <Button size="sm" variant="outline" className="flex-1">
                <TrendingUp className="h-4 w-4 mr-2" />
                Ver Historial
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Transactions */}
      <Card>
        <CardHeader>
          <CardTitle>Actividad Reciente</CardTitle>
          <CardDescription>Tus últimas transacciones</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {recentTransactions.map((transaction) => (
              <div key={transaction.id} className="flex items-center justify-between p-3 rounded-lg border">
                <div className="flex items-center space-x-3">
                  <div className={`p-2 rounded-full ${
                    transaction.type === 'income' 
                      ? 'bg-green-100 text-green-600' 
                      : 'bg-red-100 text-red-600'
                  }`}>
                    {transaction.type === 'income' ? (
                      <ArrowUpRight className="h-4 w-4" />
                    ) : (
                      <ArrowDownLeft className="h-4 w-4" />
                    )}
                  </div>
                  <div>
                    <div className="font-medium">{transaction.description}</div>
                    <div className="text-sm text-muted-foreground">
                      {transaction.category} • {new Date(transaction.date).toLocaleDateString('es-ES')}
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
          <Button variant="outline" className="w-full mt-4">
            Ver Todas las Transacciones
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}