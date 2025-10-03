import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  CreditCard, 
  Users, 
  Plus,
  ArrowUpRight,
  ArrowDownLeft,
  Settings,
  PiggyBank,
  DollarSign,
  Calendar,
  Clock,
  AlertTriangle,
  CheckCircle,
  UserPlus,
  Trash2,
  Edit
} from "lucide-react";

interface ChildAccount {
  id: string;
  name: string;
  email: string;
  balance: number;
  spendBalance: number;
  saveBalance: number;
  emergencyBalance: number;
  isActive: boolean;
  lastActivity: string;
  monthlyAllowance: number;
  allowanceFrequency: 'weekly' | 'biweekly' | 'monthly';
  nextAllowanceDate: string;
}

interface Transfer {
  id: string;
  fromAccount: string;
  toAccount: string;
  amount: number;
  description: string;
  date: string;
  status: 'completed' | 'pending' | 'failed';
  type: 'manual' | 'allowance' | 'bonus';
}

interface AllowanceSchedule {
  id: string;
  childId: string;
  amount: number;
  frequency: 'weekly' | 'biweekly' | 'monthly';
  nextDate: string;
  isActive: boolean;
  description: string;
}

// Función para obtener datos de cuentas de hijos desde localStorage
const getChildAccounts = (): ChildAccount[] => {
  try {
    const savedAccounts = localStorage.getItem('childAccounts');
    if (savedAccounts) {
      return JSON.parse(savedAccounts);
    }
  } catch (error) {
    console.error('Error cargando cuentas de hijos:', error);
  }
  
  // Datos por defecto
  return [
    {
      id: "child001",
      name: "Carlos González",
      email: "nino@demo.com",
      balance: 125.50,
      spendBalance: 62.75,
      saveBalance: 50.20,
      emergencyBalance: 12.55,
      isActive: true,
      lastActivity: "2024-01-15T14:30:00",
      monthlyAllowance: 50.00,
      allowanceFrequency: 'weekly',
      nextAllowanceDate: "2024-01-22"
    }
  ];
};

// Función para obtener transferencias desde localStorage
const getTransfers = (): Transfer[] => {
  try {
    const savedTransfers = localStorage.getItem('parentTransfers');
    if (savedTransfers) {
      return JSON.parse(savedTransfers);
    }
  } catch (error) {
    console.error('Error cargando transferencias:', error);
  }
  
  return [
    {
      id: "1",
      fromAccount: "parent",
      toAccount: "child001",
      amount: 25.00,
      description: "Mesada semanal",
      date: "2024-01-15",
      status: "completed",
      type: "allowance"
    },
    {
      id: "2",
      fromAccount: "parent",
      toAccount: "child001",
      amount: 10.00,
      description: "Bono por buen comportamiento",
      date: "2024-01-14",
      status: "completed",
      type: "bonus"
    }
  ];
};

// Función para guardar datos
const saveChildAccounts = (accounts: ChildAccount[]) => {
  try {
    localStorage.setItem('childAccounts', JSON.stringify(accounts));
  } catch (error) {
    console.error('Error guardando cuentas de hijos:', error);
  }
};

const saveTransfers = (transfers: Transfer[]) => {
  try {
    localStorage.setItem('parentTransfers', JSON.stringify(transfers));
  } catch (error) {
    console.error('Error guardando transferencias:', error);
  }
};

export function ParentAccountManagement() {
  const [childAccounts, setChildAccounts] = useState<ChildAccount[]>(getChildAccounts());
  const [transfers, setTransfers] = useState<Transfer[]>(getTransfers());
  const [selectedChild, setSelectedChild] = useState<string | null>(null);
  const [showTransferDialog, setShowTransferDialog] = useState(false);
  const [showAddChildDialog, setShowAddChildDialog] = useState(false);
  const [transferForm, setTransferForm] = useState({
    toAccount: '',
    amount: 0,
    description: '',
    type: 'manual' as 'manual' | 'allowance' | 'bonus'
  });

  // Actualizar datos cuando cambie el localStorage
  useEffect(() => {
    const updateData = () => {
      const newAccounts = getChildAccounts();
      const newTransfers = getTransfers();
      setChildAccounts(newAccounts);
      setTransfers(newTransfers);
    };

    updateData();
    const interval = setInterval(updateData, 1000);

    return () => {
      clearInterval(interval);
    };
  }, []);

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

  const handleTransfer = () => {
    if (transferForm.toAccount && transferForm.amount > 0) {
      const newTransfer: Transfer = {
        id: Date.now().toString(),
        fromAccount: "parent",
        toAccount: transferForm.toAccount,
        amount: transferForm.amount,
        description: transferForm.description,
        date: new Date().toISOString().split('T')[0],
        status: "completed",
        type: transferForm.type
      };

      // Actualizar balance del hijo
      const updatedAccounts = childAccounts.map(account => {
        if (account.id === transferForm.toAccount) {
          return {
            ...account,
            balance: account.balance + transferForm.amount,
            spendBalance: account.spendBalance + transferForm.amount,
            lastActivity: new Date().toISOString()
          };
        }
        return account;
      });

      setChildAccounts(updatedAccounts);
      setTransfers([newTransfer, ...transfers]);
      saveChildAccounts(updatedAccounts);
      saveTransfers([newTransfer, ...transfers]);
      
      // Sincronizar con la cuenta del niño
      syncTransferToChild(transferForm.toAccount, newTransfer);
      
      setShowTransferDialog(false);
      setTransferForm({ toAccount: '', amount: 0, description: '', type: 'manual' });
    }
  };

  // Función para sincronizar transferencia con la cuenta del niño
  const syncTransferToChild = (childId: string, transfer: Transfer) => {
    try {
      // Obtener datos actuales del niño
      const childCardData = getChildVirtualCardData(childId);
      const childTransactions = getChildTransactions(childId);
      
      // Actualizar tarjeta virtual del niño
      const updatedChildCard = {
        ...childCardData,
        balance: childCardData.balance + transfer.amount
      };
      saveChildVirtualCardData(updatedChildCard, childId);
      
      // Agregar transacción de ingreso al niño
      const newChildTransaction = {
        id: Date.now().toString(),
        type: "income",
        amount: transfer.amount,
        description: transfer.description,
        date: transfer.date,
        category: transfer.type === 'allowance' ? 'Mesada' : 
                 transfer.type === 'bonus' ? 'Bono' : 'Transferencia'
      };
      
      const updatedChildTransactions = [newChildTransaction, ...childTransactions];
      saveChildTransactions(updatedChildTransactions, childId);
      
      console.log(`Transferencia sincronizada con cuenta del niño ${childId}`);
    } catch (error) {
      console.error('Error sincronizando transferencia con cuenta del niño:', error);
    }
  };

  // Funciones auxiliares para manejar datos del niño
  const getChildVirtualCardData = (childId: string) => {
    try {
      const savedCard = localStorage.getItem(`virtualCard_${childId}`);
      if (savedCard) {
        return JSON.parse(savedCard);
      }
    } catch (error) {
      console.error('Error cargando datos de tarjeta virtual del niño:', error);
    }
    
    // Datos por defecto para el niño
    return {
      id: childId,
      cardNumber: "4532 1234 5678 9012",
      holderName: childAccounts.find(acc => acc.id === childId)?.name || "NIÑO",
      expiryDate: "12/28",
      cvv: "123",
      balance: 0,
      isActive: true,
      isFrozen: false,
      theme: 'gradient-blue',
      dailyLimit: 25.00,
      transactionLimit: 10.00,
      allowedCategories: ['food', 'entertainment', 'books'],
      notifications: {
        transactions: true,
        dailyLimit: true,
        lowBalance: false
      }
    };
  };

  const saveChildVirtualCardData = (cardData: any, childId: string) => {
    try {
      localStorage.setItem(`virtualCard_${childId}`, JSON.stringify(cardData));
    } catch (error) {
      console.error('Error guardando datos de tarjeta virtual del niño:', error);
    }
  };

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

  const saveChildTransactions = (transactions: any[], childId: string) => {
    try {
      localStorage.setItem(`transactions_${childId}`, JSON.stringify(transactions));
    } catch (error) {
      console.error('Error guardando transacciones del niño:', error);
    }
  };

  // Función para manejar pago de mesada
  const handleAllowancePayment = (childId: string, amount: number, description: string) => {
    try {
      // Crear transferencia de mesada
      const newTransfer: Transfer = {
        id: Date.now().toString(),
        fromAccount: "parent",
        toAccount: childId,
        amount: amount,
        description: description,
        date: new Date().toISOString().split('T')[0],
        status: "completed",
        type: "allowance"
      };

      // Actualizar balance del hijo
      const updatedAccounts = childAccounts.map(account => {
        if (account.id === childId) {
          return {
            ...account,
            balance: account.balance + amount,
            spendBalance: account.spendBalance + amount,
            lastActivity: new Date().toISOString(),
            nextAllowanceDate: calculateNextAllowanceDate(account.allowanceFrequency)
          };
        }
        return account;
      });

      setChildAccounts(updatedAccounts);
      setTransfers([newTransfer, ...transfers]);
      saveChildAccounts(updatedAccounts);
      saveTransfers([newTransfer, ...transfers]);
      
      // Sincronizar con la cuenta del niño
      syncTransferToChild(childId, newTransfer);
      
      console.log(`Mesada pagada a ${childId}: ${amount}`);
    } catch (error) {
      console.error('Error pagando mesada:', error);
    }
  };

  // Función para calcular la próxima fecha de mesada
  const calculateNextAllowanceDate = (frequency: 'weekly' | 'biweekly' | 'monthly') => {
    const now = new Date();
    let nextDate = new Date(now);
    
    switch (frequency) {
      case 'weekly':
        nextDate.setDate(now.getDate() + 7);
        break;
      case 'biweekly':
        nextDate.setDate(now.getDate() + 14);
        break;
      case 'monthly':
        nextDate.setMonth(now.getMonth() + 1);
        break;
    }
    
    return nextDate.toISOString().split('T')[0];
  };

  const getStatusColor = (status: Transfer['status']) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-700';
      case 'pending': return 'bg-yellow-100 text-yellow-700';
      case 'failed': return 'bg-red-100 text-red-700';
    }
  };

  const getStatusLabel = (status: Transfer['status']) => {
    switch (status) {
      case 'completed': return 'Completado';
      case 'pending': return 'Pendiente';
      case 'failed': return 'Fallido';
    }
  };

  const getTypeIcon = (type: Transfer['type']) => {
    switch (type) {
      case 'manual': return <DollarSign className="h-4 w-4" />;
      case 'allowance': return <Calendar className="h-4 w-4" />;
      case 'bonus': return <CheckCircle className="h-4 w-4" />;
    }
  };

  const getTypeLabel = (type: Transfer['type']) => {
    switch (type) {
      case 'manual': return 'Transferencia Manual';
      case 'allowance': return 'Mesada';
      case 'bonus': return 'Bono';
    }
  };

  const totalBalance = childAccounts.reduce((sum, account) => sum + account.balance, 0);
  const activeChildren = childAccounts.filter(account => account.isActive).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Gestión de Cuentas Familiares</h2>
          <p className="text-muted-foreground">
            Administra las cuentas de tus hijos y realiza transferencias
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Dialog open={showAddChildDialog} onOpenChange={setShowAddChildDialog}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="h-4 w-4 mr-2" />
                Agregar Hijo
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Agregar Nueva Cuenta de Hijo</DialogTitle>
                <DialogDescription>
                  Crea una nueva cuenta para uno de tus hijos
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Nombre del Hijo</Label>
                  <Input placeholder="Nombre completo" />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input type="email" placeholder="email@ejemplo.com" />
                </div>
                <div>
                  <Label>Mesada Inicial</Label>
                  <Input type="number" placeholder="0.00" />
                </div>
                <div className="flex justify-end space-x-2">
                  <Button variant="outline" onClick={() => setShowAddChildDialog(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={() => setShowAddChildDialog(false)}>
                    Crear Cuenta
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          
          <Dialog open={showTransferDialog} onOpenChange={setShowTransferDialog}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <ArrowUpRight className="h-4 w-4 mr-2" />
                Transferir
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Realizar Transferencia</DialogTitle>
                <DialogDescription>
                  Envía dinero a la cuenta de uno de tus hijos
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Destinatario</Label>
                  <select 
                    value={transferForm.toAccount}
                    onChange={(e) => setTransferForm({...transferForm, toAccount: e.target.value})}
                    className="w-full p-2 border rounded-md"
                  >
                    <option value="">Seleccionar hijo</option>
                    {childAccounts.map(account => (
                      <option key={account.id} value={account.id}>
                        {account.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label>Cantidad</Label>
                  <Input 
                    type="number" 
                    value={transferForm.amount}
                    onChange={(e) => setTransferForm({...transferForm, amount: parseFloat(e.target.value) || 0})}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <Label>Descripción</Label>
                  <Input 
                    value={transferForm.description}
                    onChange={(e) => setTransferForm({...transferForm, description: e.target.value})}
                    placeholder="Motivo de la transferencia"
                  />
                </div>
                <div>
                  <Label>Tipo de Transferencia</Label>
                  <select 
                    value={transferForm.type}
                    onChange={(e) => setTransferForm({...transferForm, type: e.target.value as 'manual' | 'allowance' | 'bonus'})}
                    className="w-full p-2 border rounded-md"
                  >
                    <option value="manual">Transferencia Manual</option>
                    <option value="allowance">Mesada</option>
                    <option value="bonus">Bono</option>
                  </select>
                </div>
                <div className="flex justify-end space-x-2">
                  <Button variant="outline" onClick={() => setShowTransferDialog(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleTransfer}>
                    Transferir
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Resumen General */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-100 rounded-full">
                <DollarSign className="h-6 w-6 text-blue-600" />
              </div>
              <div className="flex-1">
                <div className="text-2xl font-bold text-blue-600">
                  {formatCurrency(totalBalance)}
                </div>
                <div className="text-sm text-muted-foreground">Total en Cuentas</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-green-100 rounded-full">
                <Users className="h-6 w-6 text-green-600" />
              </div>
              <div className="flex-1">
                <div className="text-2xl font-bold text-green-600">
                  {activeChildren}
                </div>
                <div className="text-sm text-muted-foreground">Hijos Activos</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-purple-100 rounded-full">
                <Calendar className="h-6 w-6 text-purple-600" />
              </div>
              <div className="flex-1">
                <div className="text-2xl font-bold text-purple-600">
                  {childAccounts.filter(a => a.allowanceFrequency === 'weekly').length}
                </div>
                <div className="text-sm text-muted-foreground">Mesadas Semanales</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-orange-100 rounded-full">
                <Clock className="h-6 w-6 text-orange-600" />
              </div>
              <div className="flex-1">
                <div className="text-2xl font-bold text-orange-600">
                  {transfers.filter(t => t.status === 'pending').length}
                </div>
                <div className="text-sm text-muted-foreground">Transferencias Pendientes</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Contenido Principal */}
      <Tabs defaultValue="accounts" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="accounts">Cuentas de Hijos</TabsTrigger>
          <TabsTrigger value="transfers">Transferencias</TabsTrigger>
          <TabsTrigger value="allowances">Mesadas</TabsTrigger>
        </TabsList>

        {/* Cuentas de Hijos */}
        <TabsContent value="accounts">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {childAccounts.map((account) => (
              <Card key={account.id} className="relative">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center space-x-2">
                        <Users className="h-5 w-5" />
                        <span>{account.name}</span>
                      </CardTitle>
                      <CardDescription>{account.email}</CardDescription>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge variant={account.isActive ? "default" : "secondary"}>
                        {account.isActive ? "Activo" : "Inactivo"}
                      </Badge>
                      <Button variant="ghost" size="sm">
                        <Settings className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* Balance Principal */}
                    <div className="p-4 bg-gradient-to-r from-primary/10 to-customers/10 border border-primary/20 rounded-lg">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-primary">
                          {formatCurrency(account.balance)}
                        </div>
                        <div className="text-sm text-muted-foreground">Balance Total</div>
                      </div>
                    </div>

                    {/* Sub-cuentas */}
                    <div className="grid grid-cols-3 gap-3">
                      <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-center">
                        <div className="text-lg font-bold text-green-700">
                          {formatCurrency(account.spendBalance)}
                        </div>
                        <div className="text-xs text-green-600">Gastar</div>
                      </div>
                      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-center">
                        <div className="text-lg font-bold text-blue-700">
                          {formatCurrency(account.saveBalance)}
                        </div>
                        <div className="text-xs text-blue-600">Ahorrar</div>
                      </div>
                      <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg text-center">
                        <div className="text-lg font-bold text-orange-700">
                          {formatCurrency(account.emergencyBalance)}
                        </div>
                        <div className="text-xs text-orange-600">Emergencia</div>
                      </div>
                    </div>

                    {/* Información Adicional */}
                    <div className="space-y-2 text-sm text-muted-foreground">
                      <div className="flex justify-between">
                        <span>Última actividad:</span>
                        <span>{formatDate(account.lastActivity)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Mesada:</span>
                        <span>{formatCurrency(account.monthlyAllowance)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Próxima mesada:</span>
                        <span>{formatDate(account.nextAllowanceDate)}</span>
                      </div>
                    </div>

                    {/* Acciones Rápidas */}
                    <div className="flex space-x-2 pt-2">
                      <Button 
                        size="sm" 
                        className="flex-1"
                        onClick={() => {
                          setTransferForm({
                            toAccount: account.id,
                            amount: 0,
                            description: '',
                            type: 'manual'
                          });
                          setShowTransferDialog(true);
                        }}
                      >
                        <ArrowUpRight className="h-4 w-4 mr-1" />
                        Transferir
                      </Button>
                      <Button size="sm" variant="outline" className="flex-1">
                        <Edit className="h-4 w-4 mr-1" />
                        Editar
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Transferencias */}
        <TabsContent value="transfers">
          <Card>
            <CardHeader>
              <CardTitle>Historial de Transferencias</CardTitle>
              <CardDescription>
                Registro de todas las transferencias realizadas
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {transfers.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <ArrowUpRight className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No hay transferencias registradas</p>
                  </div>
                ) : (
                  transfers.map((transfer) => {
                    const childAccount = childAccounts.find(acc => acc.id === transfer.toAccount);
                    return (
                      <div key={transfer.id} className="flex items-center justify-between p-4 rounded-lg border">
                        <div className="flex items-center space-x-4">
                          <div className="p-3 bg-blue-100 rounded-full">
                            {getTypeIcon(transfer.type)}
                          </div>
                          <div>
                            <div className="font-medium">{transfer.description}</div>
                            <div className="text-sm text-muted-foreground flex items-center space-x-2">
                              <span>Para: {childAccount?.name || 'Cuenta desconocida'}</span>
                              <span>•</span>
                              <span>{formatDate(transfer.date)}</span>
                              <span>•</span>
                              <Badge className={getStatusColor(transfer.status)}>
                                {getStatusLabel(transfer.status)}
                              </Badge>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold text-green-600">
                            +{formatCurrency(transfer.amount)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {getTypeLabel(transfer.type)}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Mesadas */}
        <TabsContent value="allowances">
          <Card>
            <CardHeader>
              <CardTitle>Configuración de Mesadas</CardTitle>
              <CardDescription>
                Administra las mesadas automáticas para tus hijos
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {childAccounts.map((account) => (
                  <div key={account.id} className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">{account.name}</div>
                        <div className="text-sm text-muted-foreground">
                          Mesada: {formatCurrency(account.monthlyAllowance)} • 
                          Frecuencia: {account.allowanceFrequency === 'weekly' ? 'Semanal' : 
                                     account.allowanceFrequency === 'biweekly' ? 'Quincenal' : 'Mensual'}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Próxima: {formatDate(account.nextAllowanceDate)}
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button size="sm" variant="outline">
                          <Edit className="h-4 w-4 mr-1" />
                          Editar
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => handleAllowancePayment(account.id, account.monthlyAllowance, `Mesada ${account.allowanceFrequency}`)}
                        >
                          <Calendar className="h-4 w-4 mr-1" />
                          Pagar Ahora
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
