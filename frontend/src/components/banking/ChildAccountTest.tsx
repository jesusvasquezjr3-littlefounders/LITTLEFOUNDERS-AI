import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  CreditCard, 
  DollarSign,
  TrendingUp,
  Users,
  RefreshCw,
  CheckCircle,
  AlertTriangle
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

export function ChildAccountTest() {
  const [user, setUser] = useState<any>(null);
  const [childData, setChildData] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [lastUpdate, setLastUpdate] = useState<string>('');

  useEffect(() => {
    const currentUser = getCurrentUser();
    setUser(currentUser);
    
    if (currentUser?.user_type === 'child') {
      const childId = currentUser.id || 'child001';
      const cardData = getChildVirtualCardData(childId);
      const transactionData = getChildTransactions(childId);
      
      setChildData(cardData);
      setTransactions(transactionData);
      setLastUpdate(new Date().toLocaleTimeString());
    }
  }, []);

  const refreshData = () => {
    if (user?.user_type === 'child') {
      const childId = user.id || 'child001';
      const cardData = getChildVirtualCardData(childId);
      const transactionData = getChildTransactions(childId);
      
      setChildData(cardData);
      setTransactions(transactionData);
      setLastUpdate(new Date().toLocaleTimeString());
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  if (!user) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">
            <AlertTriangle className="h-12 w-12 mx-auto mb-4" />
            <p>No se pudo cargar la información del usuario</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (user.user_type !== 'child') {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-4" />
            <p>Este componente es solo para usuarios tipo "child"</p>
            <p className="text-sm">Tipo de usuario actual: {user.user_type}</p>
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
          <h2 className="text-2xl font-bold">Prueba de Cuenta de Niño</h2>
          <p className="text-muted-foreground">
            Verificación de sincronización de datos para: {user.name}
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Badge variant="outline">
            ID: {user.id || 'child001'}
          </Badge>
          <Button onClick={refreshData} size="sm" variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualizar
          </Button>
        </div>
      </div>

      {/* Información de la cuenta */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <CreditCard className="h-5 w-5" />
              <span>Balance Actual</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">
              {childData ? formatCurrency(childData.balance) : '$0.00'}
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              Saldo en tarjeta virtual
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <TrendingUp className="h-5 w-5" />
              <span>Transacciones</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">
              {transactions.length}
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              Total de transacciones
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <CheckCircle className="h-5 w-5" />
              <span>Última Actualización</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-semibold">
              {lastUpdate}
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              Hora de la última verificación
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Transacciones recientes */}
      <Card>
        <CardHeader>
          <CardTitle>Transacciones Recientes</CardTitle>
          <CardDescription>
            Últimas transacciones registradas en la cuenta del niño
          </CardDescription>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No hay transacciones registradas</p>
              <p className="text-sm">Las transferencias del padre aparecerán aquí</p>
            </div>
          ) : (
            <div className="space-y-3">
              {transactions.slice(0, 10).map((transaction) => (
                <div key={transaction.id} className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="flex items-center space-x-3">
                    <div className={`p-2 rounded-full ${
                      transaction.type === 'income' 
                        ? 'bg-green-100 text-green-600' 
                        : 'bg-red-100 text-red-600'
                    }`}>
                      {transaction.type === 'income' ? (
                        <TrendingUp className="h-4 w-4" />
                      ) : (
                        <DollarSign className="h-4 w-4" />
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
          )}
        </CardContent>
      </Card>

      {/* Información de debug */}
      <Card>
        <CardHeader>
          <CardTitle>Información de Debug</CardTitle>
          <CardDescription>
            Datos técnicos para verificar la sincronización
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Clave de tarjeta virtual:</span>
              <code className="bg-muted px-2 py-1 rounded">
                virtualCard_{user.id || 'child001'}
              </code>
            </div>
            <div className="flex justify-between">
              <span>Clave de transacciones:</span>
              <code className="bg-muted px-2 py-1 rounded">
                transactions_{user.id || 'child001'}
              </code>
            </div>
            <div className="flex justify-between">
              <span>Tipo de usuario:</span>
              <Badge variant="outline">{user.user_type}</Badge>
            </div>
            <div className="flex justify-between">
              <span>Email:</span>
              <span>{user.email}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
