import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { 
  Shield, 
  Lock, 
  Unlock,
  Bell,
  Settings,
  CreditCard,
  PiggyBank,
  Eye,
  AlertTriangle,
  CheckCircle,
  Clock,
  DollarSign,
  Users,
  Calendar,
  Smartphone,
  Mail
} from "lucide-react";

interface ParentalSettings {
  cardControls: {
    freezeCard: boolean;
    dailyLimit: number;
    transactionLimit: number;
    allowedCategories: string[];
    requireApprovalAbove: number;
  };
  accountControls: {
    lockTransfers: boolean;
    requireApprovalForSavings: boolean;
    blockEmergencyAccess: boolean;
    spendingNotifications: boolean;
  };
  taskControls: {
    requireTaskApproval: boolean;
    autoApproveBelow: number;
    allowBonusTasks: boolean;
  };
  notifications: {
    realTimeTransactions: boolean;
    dailySummary: boolean;
    weeklyReport: boolean;
    goalMilestones: boolean;
    lowBalance: boolean;
    suspiciousActivity: boolean;
    parentEmail: string;
    parentPhone: string;
  };
}

const mockSettings: ParentalSettings = {
  cardControls: {
    freezeCard: false,
    dailyLimit: 25.00,
    transactionLimit: 10.00,
    allowedCategories: ['food', 'entertainment', 'books', 'education'],
    requireApprovalAbove: 15.00
  },
  accountControls: {
    lockTransfers: false,
    requireApprovalForSavings: true,
    blockEmergencyAccess: true,
    spendingNotifications: true
  },
  taskControls: {
    requireTaskApproval: true,
    autoApproveBelow: 5.00,
    allowBonusTasks: true
  },
  notifications: {
    realTimeTransactions: true,
    dailySummary: true,
    weeklyReport: true,
    goalMilestones: true,
    lowBalance: true,
    suspiciousActivity: true,
    parentEmail: "padre@email.com",
    parentPhone: "+1 234 567 8900"
  }
};

const spendingCategories = [
  { id: 'food', name: 'Comida y Bebidas', icon: '🍕' },
  { id: 'entertainment', name: 'Entretenimiento', icon: '🎮' },
  { id: 'books', name: 'Libros y Educación', icon: '📚' },
  { id: 'education', name: 'Cursos y Clases', icon: '🎓' },
  { id: 'clothing', name: 'Ropa', icon: '👕' },
  { id: 'toys', name: 'Juguetes', icon: '🧸' },
  { id: 'sports', name: 'Deportes', icon: '⚽' }
];

interface PendingApproval {
  id: string;
  type: 'task' | 'transaction' | 'goal' | 'withdrawal';
  title: string;
  amount?: number;
  description: string;
  timestamp: string;
  childName: string;
  status: 'pending' | 'approved' | 'denied';
}

const pendingApprovals: PendingApproval[] = [
  {
    id: "1",
    type: "task",
    title: "Organizar mi cuarto",
    amount: 8.00,
    description: "Juan completó la tarea de organizar su cuarto",
    timestamp: "2024-01-15T14:30:00",
    childName: "Juan",
    status: "pending"
  },
  {
    id: "2",
    type: "transaction",
    title: "Compra en videojuegos",
    amount: 19.99,
    description: "Solicitud para comprar un juego en Steam",
    timestamp: "2024-01-15T16:45:00",
    childName: "Juan",
    status: "pending"
  },
  {
    id: "3",
    type: "withdrawal",
    title: "Transferir a cuenta de ahorros",
    amount: 25.00,
    description: "Mover dinero de la cuenta de gastos a ahorros",
    timestamp: "2024-01-15T18:15:00",
    childName: "Juan",
    status: "pending"
  }
];

export function ParentalControls() {
  const [settings, setSettings] = useState<ParentalSettings>(mockSettings);
  const [approvals, setApprovals] = useState<PendingApproval[]>(pendingApprovals);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const updateCardControl = (key: keyof ParentalSettings['cardControls'], value: any) => {
    setSettings({
      ...settings,
      cardControls: {
        ...settings.cardControls,
        [key]: value
      }
    });
  };

  const updateAccountControl = (key: keyof ParentalSettings['accountControls'], value: boolean) => {
    setSettings({
      ...settings,
      accountControls: {
        ...settings.accountControls,
        [key]: value
      }
    });
  };

  const updateTaskControl = (key: keyof ParentalSettings['taskControls'], value: any) => {
    setSettings({
      ...settings,
      taskControls: {
        ...settings.taskControls,
        [key]: value
      }
    });
  };

  const updateNotification = (key: keyof ParentalSettings['notifications'], value: any) => {
    setSettings({
      ...settings,
      notifications: {
        ...settings.notifications,
        [key]: value
      }
    });
  };

  const toggleCategory = (categoryId: string) => {
    const categories = settings.cardControls.allowedCategories.includes(categoryId)
      ? settings.cardControls.allowedCategories.filter(id => id !== categoryId)
      : [...settings.cardControls.allowedCategories, categoryId];
    
    updateCardControl('allowedCategories', categories);
  };

  const handleApproval = (id: string, approved: boolean) => {
    const updatedApprovals = approvals.map(approval => 
      approval.id === id 
        ? { ...approval, status: (approved ? 'approved' : 'denied') as 'pending' | 'approved' | 'denied' }
        : approval
    );
    
    setApprovals(updatedApprovals);
    
    // Si se aprueba una tarea, sincronizar con la cuenta del niño
    if (approved) {
      const approvedApproval = updatedApprovals.find(approval => approval.id === id);
      if (approvedApproval && approvedApproval.type === 'task' && approvedApproval.amount) {
        syncTaskApprovalToChild(approvedApproval);
      }
    }
  };

  // Función para sincronizar aprobación de tarea con la cuenta del niño
  const syncTaskApprovalToChild = (approval: PendingApproval) => {
    try {
      // Obtener datos actuales del niño (usando el email del niño)
      const childEmail = "nino@demo.com"; // En un sistema real, esto vendría del approval
      const childId = "child001"; // En un sistema real, esto se obtendría del email
      
      const childCardData = getChildVirtualCardData(childId);
      const childTransactions = getChildTransactions(childId);
      
      // Actualizar tarjeta virtual del niño
      const updatedChildCard = {
        ...childCardData,
        balance: childCardData.balance + (approval.amount || 0)
      };
      saveChildVirtualCardData(updatedChildCard, childId);
      
      // Agregar transacción de ingreso al niño
      const newChildTransaction = {
        id: Date.now().toString(),
        type: "income",
        amount: approval.amount || 0,
        description: approval.title,
        date: new Date().toISOString().split('T')[0],
        category: "Tareas"
      };
      
      const updatedChildTransactions = [newChildTransaction, ...childTransactions];
      saveChildTransactions(updatedChildTransactions, childId);
      
      console.log(`Aprobación de tarea sincronizada con cuenta del niño ${childId}`);
    } catch (error) {
      console.error('Error sincronizando aprobación de tarea con cuenta del niño:', error);
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
      holderName: "NIÑO",
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

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('es-ES');
  };

  const getTypeIcon = (type: PendingApproval['type']) => {
    switch (type) {
      case 'task':
        return <CheckCircle className="h-5 w-5 text-blue-600" />;
      case 'transaction':
        return <CreditCard className="h-5 w-5 text-green-600" />;
      case 'goal':
        return <PiggyBank className="h-5 w-5 text-purple-600" />;
      case 'withdrawal':
        return <DollarSign className="h-5 w-5 text-orange-600" />;
    }
  };

  const getTypeLabel = (type: PendingApproval['type']) => {
    switch (type) {
      case 'task':
        return 'Tarea Completada';
      case 'transaction':
        return 'Solicitud de Compra';
      case 'goal':
        return 'Meta de Ahorro';
      case 'withdrawal':
        return 'Transferencia';
    }
  };

  const pendingCount = approvals.filter(a => a.status === 'pending').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Controles Parentales</h2>
          <p className="text-muted-foreground">
            Supervisa y controla las actividades financieras de tu hijo
          </p>
        </div>
        <Badge variant={pendingCount > 0 ? "destructive" : "secondary"}>
          {pendingCount} {pendingCount === 1 ? 'aprobación pendiente' : 'aprobaciones pendientes'}
        </Badge>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <Button
                variant={settings.cardControls.freezeCard ? "destructive" : "default"}
                size="sm"
                onClick={() => updateCardControl('freezeCard', !settings.cardControls.freezeCard)}
                className="w-full"
              >
                {settings.cardControls.freezeCard ? (
                  <>
                    <Unlock className="h-4 w-4 mr-2" />
                    Desbloquear Tarjeta
                  </>
                ) : (
                  <>
                    <Lock className="h-4 w-4 mr-2" />
                    Bloquear Tarjeta
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Bell className="h-5 w-5 text-blue-600" />
                <span className="font-medium">Notificaciones</span>
              </div>
              <Switch
                checked={settings.notifications.realTimeTransactions}
                onCheckedChange={(checked) => updateNotification('realTimeTransactions', checked)}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <PiggyBank className="h-5 w-5 text-green-600" />
                <span className="font-medium">Bloquear Ahorros</span>
              </div>
              <Switch
                checked={settings.accountControls.lockTransfers}
                onCheckedChange={(checked) => updateAccountControl('lockTransfers', checked)}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Controls */}
      <Tabs defaultValue="approvals" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="approvals" className="relative">
            Aprobaciones
            {pendingCount > 0 && (
              <Badge className="absolute -top-2 -right-2 h-5 w-5 p-0 text-xs">
                {pendingCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="card">Tarjeta</TabsTrigger>
          <TabsTrigger value="accounts">Cuentas</TabsTrigger>
          <TabsTrigger value="notifications">Notificaciones</TabsTrigger>
        </TabsList>

        {/* Approvals Tab */}
        <TabsContent value="approvals">
          <Card>
            <CardHeader>
              <CardTitle>Solicitudes Pendientes</CardTitle>
              <CardDescription>
                Revisa y aprueba las actividades de tu hijo
              </CardDescription>
            </CardHeader>
            <CardContent>
              {approvals.filter(a => a.status === 'pending').length > 0 ? (
                <div className="space-y-4">
                  {approvals.filter(a => a.status === 'pending').map((approval) => (
                    <div key={approval.id} className="p-4 border rounded-lg">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-3">
                          {getTypeIcon(approval.type)}
                          <div>
                            <div className="font-semibold flex items-center space-x-2">
                              <span>{approval.title}</span>
                              <Badge variant="outline">{getTypeLabel(approval.type)}</Badge>
                            </div>
                            <div className="text-sm text-muted-foreground mt-1">
                              {approval.description}
                            </div>
                            <div className="text-xs text-muted-foreground mt-2 flex items-center space-x-4">
                              <span>👦 {approval.childName}</span>
                              <span>{formatTimestamp(approval.timestamp)}</span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          {approval.amount && (
                            <div className="text-lg font-bold text-green-600 mb-3">
                              {formatCurrency(approval.amount)}
                            </div>
                          )}
                          <div className="flex space-x-2">
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleApproval(approval.id, false)}
                            >
                              Rechazar
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => handleApproval(approval.id, true)}
                            >
                              Aprobar
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle className="h-12 w-12 mx-auto mb-4" />
                  <p>No hay aprobaciones pendientes</p>
                  <p className="text-sm">Todas las actividades están al día</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Card Controls Tab */}
        <TabsContent value="card" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Control de Tarjeta</CardTitle>
              <CardDescription>
                Configura límites y permisos para la tarjeta virtual
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Limits */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label>Límite Diario</Label>
                  <Input
                    type="number"
                    value={settings.cardControls.dailyLimit}
                    onChange={(e) => updateCardControl('dailyLimit', parseFloat(e.target.value))}
                    className="mt-2"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Máximo que puede gastar por día
                  </p>
                </div>
                <div>
                  <Label>Límite por Transacción</Label>
                  <Input
                    type="number"
                    value={settings.cardControls.transactionLimit}
                    onChange={(e) => updateCardControl('transactionLimit', parseFloat(e.target.value))}
                    className="mt-2"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Máximo por compra individual
                  </p>
                </div>
              </div>

              <div>
                <Label>Requerir Aprobación para Compras Mayores a</Label>
                <Input
                  type="number"
                  value={settings.cardControls.requireApprovalAbove}
                  onChange={(e) => updateCardControl('requireApprovalAbove', parseFloat(e.target.value))}
                  className="mt-2 w-40"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Las compras por encima de este monto necesitarán tu aprobación
                </p>
              </div>

              {/* Allowed Categories */}
              <div>
                <Label>Categorías Permitidas</Label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-3">
                  {spendingCategories.map((category) => (
                    <div
                      key={category.id}
                      className={`p-3 border rounded-lg cursor-pointer transition-all ${
                        settings.cardControls.allowedCategories.includes(category.id)
                          ? 'border-primary bg-primary/5'
                          : 'border-muted hover:border-primary/50'
                      }`}
                      onClick={() => toggleCategory(category.id)}
                    >
                      <div className="flex items-center space-x-2">
                        <span className="text-lg">{category.icon}</span>
                        <span className="text-sm font-medium">{category.name}</span>
                      </div>
                      <div className="text-right mt-2">
                        {settings.cardControls.allowedCategories.includes(category.id) ? (
                          <CheckCircle className="h-4 w-4 text-primary" />
                        ) : (
                          <div className="h-4 w-4 border border-muted rounded-full" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Account Controls Tab */}
        <TabsContent value="accounts" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Control de Cuentas</CardTitle>
              <CardDescription>
                Administra el acceso a las subcuentas y transferencias
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <div className="font-medium">Bloquear Transferencias entre Cuentas</div>
                    <div className="text-sm text-muted-foreground">
                      Evita que mueva dinero entre Gastar, Ahorrar y Emergencia
                    </div>
                  </div>
                  <Switch
                    checked={settings.accountControls.lockTransfers}
                    onCheckedChange={(checked) => updateAccountControl('lockTransfers', checked)}
                  />
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <div className="font-medium">Requerir Aprobación para Retirar Ahorros</div>
                    <div className="text-sm text-muted-foreground">
                      Necesitará tu permiso para usar el dinero ahorrado
                    </div>
                  </div>
                  <Switch
                    checked={settings.accountControls.requireApprovalForSavings}
                    onCheckedChange={(checked) => updateAccountControl('requireApprovalForSavings', checked)}
                  />
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <div className="font-medium">Bloquear Acceso a Cuenta de Emergencia</div>
                    <div className="text-sm text-muted-foreground">
                      Solo los padres pueden autorizar el uso del fondo de emergencia
                    </div>
                  </div>
                  <Switch
                    checked={settings.accountControls.blockEmergencyAccess}
                    onCheckedChange={(checked) => updateAccountControl('blockEmergencyAccess', checked)}
                  />
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <div className="font-medium">Notificaciones de Gastos</div>
                    <div className="text-sm text-muted-foreground">
                      Recibe alertas en tiempo real de todas las transacciones
                    </div>
                  </div>
                  <Switch
                    checked={settings.accountControls.spendingNotifications}
                    onCheckedChange={(checked) => updateAccountControl('spendingNotifications', checked)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Task Controls */}
          <Card>
            <CardHeader>
              <CardTitle>Control de Tareas</CardTitle>
              <CardDescription>
                Configura la aprobación y pago de tareas
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <div className="font-medium">Requerir Aprobación para Tareas</div>
                  <div className="text-sm text-muted-foreground">
                    Todas las tareas necesitarán tu verificación antes del pago
                  </div>
                </div>
                <Switch
                  checked={settings.taskControls.requireTaskApproval}
                  onCheckedChange={(checked) => updateTaskControl('requireTaskApproval', checked)}
                />
              </div>

              <div>
                <Label>Auto-aprobar Tareas Menores a</Label>
                <Input
                  type="number"
                  value={settings.taskControls.autoApproveBelow}
                  onChange={(e) => updateTaskControl('autoApproveBelow', parseFloat(e.target.value))}
                  className="mt-2 w-40"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Tareas con recompensas menores se aprobarán automáticamente
                </p>
              </div>

              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <div className="font-medium">Permitir Tareas Bonus First-Dibs</div>
                  <div className="text-sm text-muted-foreground">
                    Permite que tome tareas extra con bonificaciones
                  </div>
                </div>
                <Switch
                  checked={settings.taskControls.allowBonusTasks}
                  onCheckedChange={(checked) => updateTaskControl('allowBonusTasks', checked)}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Configuración de Notificaciones</CardTitle>
              <CardDescription>
                Personaliza cómo y cuándo recibir actualizaciones
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Contact Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label>Email del Padre</Label>
                  <div className="flex items-center space-x-2 mt-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <Input
                      type="email"
                      value={settings.notifications.parentEmail}
                      onChange={(e) => updateNotification('parentEmail', e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <Label>Teléfono del Padre</Label>
                  <div className="flex items-center space-x-2 mt-2">
                    <Smartphone className="h-4 w-4 text-muted-foreground" />
                    <Input
                      type="tel"
                      value={settings.notifications.parentPhone}
                      onChange={(e) => updateNotification('parentPhone', e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Notification Types */}
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <div className="font-medium">Transacciones en Tiempo Real</div>
                    <div className="text-sm text-muted-foreground">
                      Notificación inmediata de cada compra o pago
                    </div>
                  </div>
                  <Switch
                    checked={settings.notifications.realTimeTransactions}
                    onCheckedChange={(checked) => updateNotification('realTimeTransactions', checked)}
                  />
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <div className="font-medium">Resumen Diario</div>
                    <div className="text-sm text-muted-foreground">
                      Email diario con el resumen de actividades
                    </div>
                  </div>
                  <Switch
                    checked={settings.notifications.dailySummary}
                    onCheckedChange={(checked) => updateNotification('dailySummary', checked)}
                  />
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <div className="font-medium">Reporte Semanal</div>
                    <div className="text-sm text-muted-foreground">
                      Análisis detallado de la actividad de la semana
                    </div>
                  </div>
                  <Switch
                    checked={settings.notifications.weeklyReport}
                    onCheckedChange={(checked) => updateNotification('weeklyReport', checked)}
                  />
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <div className="font-medium">Hitos de Metas de Ahorro</div>
                    <div className="text-sm text-muted-foreground">
                      Notifica cuando alcance objetivos de ahorro
                    </div>
                  </div>
                  <Switch
                    checked={settings.notifications.goalMilestones}
                    onCheckedChange={(checked) => updateNotification('goalMilestones', checked)}
                  />
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <div className="font-medium">Alertas de Saldo Bajo</div>
                    <div className="text-sm text-muted-foreground">
                      Aviso cuando el saldo esté por debajo de $5
                    </div>
                  </div>
                  <Switch
                    checked={settings.notifications.lowBalance}
                    onCheckedChange={(checked) => updateNotification('lowBalance', checked)}
                  />
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <div className="font-medium">Actividad Sospechosa</div>
                    <div className="text-sm text-muted-foreground">
                      Alertas de seguridad para transacciones inusuales
                    </div>
                  </div>
                  <Switch
                    checked={settings.notifications.suspiciousActivity}
                    onCheckedChange={(checked) => updateNotification('suspiciousActivity', checked)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}




