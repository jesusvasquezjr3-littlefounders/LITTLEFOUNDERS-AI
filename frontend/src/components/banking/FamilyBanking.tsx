import { API_URL } from "@/config/api";
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ThreeDCard } from "@/components/demo/ThreeDCard";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { 
  Users,
  CreditCard,
  Plus,
  Send,
  DollarSign,
  Calendar,
  CheckCircle,
  AlertTriangle,
  Clock,
  Gift,
  TrendingUp,
  TrendingDown,
  Eye,
  EyeOff,
  Settings,
  ChevronRight,
  Wallet,
  PiggyBank,
  Shield,
  Lock,
  Unlock,
  Bell
} from "lucide-react";

// Funciones de utilidad
const getCurrentUser = () => {
  try {
    const userData = localStorage.getItem('user');
    if (userData) return JSON.parse(userData);
  } catch (error) {}
  return null;
};

interface FamilyBankingProps {
  onBack?: () => void;
}

export function FamilyBanking({ onBack }: FamilyBankingProps) {
  const [user, setUser] = useState<any>(null);
  const [children, setChildren] = useState<any[]>([]);
  const [selectedChild, setSelectedChild] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showTransferDialog, setShowTransferDialog] = useState(false);
  const [showGenerateCardDialog, setShowGenerateCardDialog] = useState(false);
  const [transferAmount, setTransferAmount] = useState('');
  const [transferDescription, setTransferDescription] = useState('');
  const [transferType, setTransferType] = useState<'manual' | 'allowance' | 'bonus'>('manual');
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasOwnCard, setHasOwnCard] = useState(false);
  const [showCardDetails, setShowCardDetails] = useState(false);

  // Cargar datos
  useEffect(() => {
    const loadData = async () => {
      try {
        const currentUser = getCurrentUser();
        if (!currentUser) return;
        
        setUser(currentUser);

        // Cargar hijos desde el backend
        const response = await fetch(`${API_URL}/virtual-cards/status/${currentUser.id}`);
        if (response.ok) {
          const data = await response.json();
          setChildren(data.children || []);
          setHasOwnCard(data.has_card || false);
        }
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, []);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  // Generar tarjeta para hijo
  const handleGenerateCard = async (childId: number) => {
    if (!user?.id) return;
    
    try {
      setIsProcessing(true);
      
      const response = await fetch(`${API_URL}/virtual-cards/generate/${user.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ child_id: childId })
      });

      if (response.ok) {
        const data = await response.json();
        
        // Actualizar lista de hijos
        const statusResponse = await fetch(`${API_URL}/virtual-cards/status/${user.id}`);
        if (statusResponse.ok) {
          const statusData = await statusResponse.json();
          setChildren(statusData.children || []);
        }

        // Notificar éxito
        window.dispatchEvent(new CustomEvent('virtualCardActivated', {
          detail: { childId, childName: data.child_name }
        }));

        setShowGenerateCardDialog(false);
      } else {
        const error = await response.json();
        alert(`Error: ${error.detail}`);
      }
    } catch (error) {
      console.error('Error generating card:', error);
      alert('Error al generar la tarjeta');
    } finally {
      setIsProcessing(false);
    }
  };

  // Generar tarjeta propia
  const handleGenerateOwnCard = async () => {
    if (!user?.id) return;
    
    try {
      setIsProcessing(true);
      
      const response = await fetch(`${API_URL}/virtual-cards/generate-for-self/${user.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.ok) {
        setHasOwnCard(true);
        window.dispatchEvent(new CustomEvent('virtualCardActivated', {
          detail: { userId: user.id, userName: user.name }
        }));
      } else {
        const error = await response.json();
        alert(`Error: ${error.detail}`);
      }
    } catch (error) {
      console.error('Error generating own card:', error);
      alert('Error al generar la tarjeta');
    } finally {
      setIsProcessing(false);
    }
  };

  // Transferir dinero a hijo
  const handleTransfer = async () => {
    if (!selectedChild || !transferAmount || parseFloat(transferAmount) <= 0) return;

    setIsProcessing(true);

    try {
      // Actualizar balance del hijo en localStorage
      const childId = selectedChild.id;
      const currentCard = JSON.parse(localStorage.getItem(`virtualCard_${childId}`) || '{}');
      const amount = parseFloat(transferAmount);
      
      const updatedCard = {
        ...currentCard,
        balance: (currentCard.balance || 0) + amount
      };
      localStorage.setItem(`virtualCard_${childId}`, JSON.stringify(updatedCard));

      // Actualizar balances
      const currentBalances = JSON.parse(localStorage.getItem(`balances_${childId}`) || '{}');
      const updatedBalances = {
        ...currentBalances,
        available: (currentBalances.available || 0) + amount,
        total: (currentBalances.total || 0) + amount
      };
      localStorage.setItem(`balances_${childId}`, JSON.stringify(updatedBalances));

      // Registrar transacción
      const transactions = JSON.parse(localStorage.getItem(`transactions_${childId}`) || '[]');
      const newTransaction = {
        id: Date.now().toString(),
        type: 'income',
        amount: amount,
        description: transferDescription || (
          transferType === 'allowance' ? 'Mesada' : 
          transferType === 'bonus' ? 'Bono' : 'Transferencia de tutor'
        ),
        date: new Date().toISOString().split('T')[0],
        category: transferType === 'allowance' ? 'Mesada' : 
                 transferType === 'bonus' ? 'Bonificación' : 'Transferencia'
      };
      localStorage.setItem(`transactions_${childId}`, JSON.stringify([newTransaction, ...transactions]));

      // Actualizar lista local
      setChildren(prev => prev.map(c => 
        c.id === childId ? { ...c, balance: (c.balance || 0) + amount } : c
      ));

      setShowTransferDialog(false);
      setTransferAmount('');
      setTransferDescription('');
      setSelectedChild(null);
    } catch (error) {
      console.error('Error transferring:', error);
      alert('Error al realizar la transferencia');
    } finally {
      setIsProcessing(false);
    }
  };

  // Calcular totales
  const totalBalance = children.reduce((sum, c) => sum + (c.balance || 0), 0);
  const childrenWithCards = children.filter(c => c.has_virtual_card || c.banking_activated).length;
  const childrenWithoutCards = children.filter(c => !c.has_virtual_card && !c.banking_activated);

  if (isLoading) {
    return (
      <Card className="p-8">
        <div className="flex items-center justify-center">
          <div className="animate-pulse flex items-center gap-2">
            <Users className="h-6 w-6 text-muted-foreground" />
            <span className="text-muted-foreground">Cargando información familiar...</span>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Gestión Familiar</h2>
          <p className="text-muted-foreground">
            Administra las cuentas y tarjetas de tu familia
          </p>
        </div>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-muted-foreground mb-1">Balance Total Familiar</div>
                <div className="text-2xl font-bold text-primary">{formatCurrency(totalBalance)}</div>
              </div>
              <div className="p-3 bg-primary/10 rounded-full">
                <Wallet className="h-6 w-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-muted-foreground mb-1">Miembros con Tarjeta</div>
                <div className="text-2xl font-bold text-green-600">{childrenWithCards}</div>
              </div>
              <div className="p-3 bg-green-100 rounded-full">
                <CreditCard className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-muted-foreground mb-1">Pendientes de Activar</div>
                <div className="text-2xl font-bold text-orange-600">{childrenWithoutCards.length}</div>
              </div>
              <div className="p-3 bg-orange-100 rounded-full">
                <AlertTriangle className="h-6 w-6 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alerta si hay hijos sin tarjeta */}
      {childrenWithoutCards.length > 0 && (
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-orange-600 mt-0.5" />
              <div className="flex-1">
                <div className="font-medium text-orange-800">
                  {childrenWithoutCards.length === 1 
                    ? 'Tienes 1 hijo sin tarjeta virtual'
                    : `Tienes ${childrenWithoutCards.length} hijos sin tarjeta virtual`
                  }
                </div>
                <p className="text-sm text-orange-700 mt-1">
                  Activa sus tarjetas para que puedan usar la banca digital y aprender sobre finanzas.
                </p>
              </div>
              <Button 
                size="sm" 
                className="bg-orange-600 hover:bg-orange-700"
                onClick={() => setShowGenerateCardDialog(true)}
              >
                <Plus className="h-4 w-4 mr-1" />
                Activar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs principales */}
      <Tabs defaultValue="members" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="members">
            <Users className="h-4 w-4 mr-2" />
            Miembros
          </TabsTrigger>
          <TabsTrigger value="cards">
            <CreditCard className="h-4 w-4 mr-2" />
            Tarjetas
          </TabsTrigger>
        </TabsList>

        {/* Miembros */}
        <TabsContent value="members" className="space-y-4">
          {/* Cuenta del tutor */}
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                    <Shield className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <div className="font-semibold flex items-center gap-2">
                      {user?.name}
                      <Badge variant="outline" className="text-xs">Tutor</Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">{user?.email}</div>
                  </div>
                </div>
                <div className="text-right">
                  {hasOwnCard ? (
                    <Badge className="bg-green-100 text-green-700">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Tarjeta Activa
                    </Badge>
                  ) : (
                    <Button size="sm" onClick={handleGenerateOwnCard} disabled={isProcessing}>
                      <CreditCard className="h-4 w-4 mr-2" />
                      Activar Mi Tarjeta
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Lista de hijos */}
          {children.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <h3 className="font-semibold mb-2">No hay hijos registrados</h3>
                <p className="text-sm text-muted-foreground">
                  Los hijos que registres aparecerán aquí
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {children.map((child) => (
                <Card key={child.id} className="hover:border-primary/50 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                          child.has_virtual_card || child.banking_activated
                            ? 'bg-green-100'
                            : 'bg-gray-100'
                        }`}>
                          <Users className={`h-6 w-6 ${
                            child.has_virtual_card || child.banking_activated
                              ? 'text-green-600'
                              : 'text-gray-400'
                          }`} />
                        </div>
                        <div>
                          <div className="font-semibold">{child.name}</div>
                          <div className="text-sm text-muted-foreground">{child.email}</div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4">
                        {child.has_virtual_card || child.banking_activated ? (
                          <>
                            <div className="text-right">
                              <div className="text-lg font-bold text-green-600">
                                {formatCurrency(child.balance || 0)}
                              </div>
                              <div className="text-xs text-muted-foreground">Balance</div>
                            </div>
                            <Button 
                              size="sm" 
                              onClick={() => {
                                setSelectedChild(child);
                                setShowTransferDialog(true);
                              }}
                            >
                              <Send className="h-4 w-4 mr-1" />
                              Enviar
                            </Button>
                          </>
                        ) : (
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => handleGenerateCard(child.id)}
                            disabled={isProcessing}
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            Activar Tarjeta
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Tarjetas */}
        <TabsContent value="cards" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Tarjeta del tutor */}
            {hasOwnCard && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    Mi Tarjeta
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  <ErrorBoundary>
                    <div className="h-[300px]">
                      <ThreeDCard
                        cardNumber="4532 •••• •••• 1234"
                        holderName={user?.name?.toUpperCase() || "TUTOR"}
                        expiryDate="12/28"
                        cvv="•••"
                        theme="gradient-purple"
                        isFlipped={false}
                        showDetails={showCardDetails}
                        isFrozen={false}
                      />
                    </div>
                  </ErrorBoundary>
                </CardContent>
              </Card>
            )}

            {/* Tarjetas de hijos */}
            {children.filter(c => c.has_virtual_card || c.banking_activated).map((child) => (
              <Card key={child.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Tarjeta de {child.name}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  <ErrorBoundary>
                    <div className="h-[300px]">
                      <ThreeDCard
                        cardNumber="4532 •••• •••• 5678"
                        holderName={child.name?.toUpperCase() || "NIÑO"}
                        expiryDate="12/28"
                        cvv="•••"
                        theme="gradient-blue"
                        isFlipped={false}
                        showDetails={false}
                        isFrozen={false}
                      />
                    </div>
                  </ErrorBoundary>
                  <div className="flex justify-between items-center mt-4">
                    <div>
                      <div className="text-sm text-muted-foreground">Balance</div>
                      <div className="text-lg font-bold text-green-600">
                        {formatCurrency(child.balance || 0)}
                      </div>
                    </div>
                    <Button 
                      size="sm"
                      onClick={() => {
                        setSelectedChild(child);
                        setShowTransferDialog(true);
                      }}
                    >
                      <Send className="h-4 w-4 mr-1" />
                      Enviar Dinero
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Dialog de Transferencia */}
      <Dialog open={showTransferDialog} onOpenChange={setShowTransferDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-5 w-5 text-primary" />
              Enviar Dinero a {selectedChild?.name}
            </DialogTitle>
            <DialogDescription>
              Transfiere fondos a la cuenta de tu hijo
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label>Tipo de transferencia</Label>
              <div className="grid grid-cols-3 gap-2 mt-2">
                <Button
                  variant={transferType === 'manual' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setTransferType('manual')}
                  className="w-full"
                >
                  <DollarSign className="h-4 w-4 mr-1" />
                  Manual
                </Button>
                <Button
                  variant={transferType === 'allowance' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setTransferType('allowance')}
                  className="w-full"
                >
                  <Calendar className="h-4 w-4 mr-1" />
                  Mesada
                </Button>
                <Button
                  variant={transferType === 'bonus' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setTransferType('bonus')}
                  className="w-full"
                >
                  <Gift className="h-4 w-4 mr-1" />
                  Bono
                </Button>
              </div>
            </div>

            <div>
              <Label>Cantidad</Label>
              <div className="relative mt-1">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="number"
                  placeholder="0.00"
                  value={transferAmount}
                  onChange={(e) => setTransferAmount(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>

            <div>
              <Label>Descripción (opcional)</Label>
              <Input
                placeholder={
                  transferType === 'allowance' ? 'Mesada semanal' :
                  transferType === 'bonus' ? 'Bono por buen comportamiento' :
                  'Ej: Para el cine'
                }
                value={transferDescription}
                onChange={(e) => setTransferDescription(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setShowTransferDialog(false)}>
              Cancelar
            </Button>
            <Button 
              className="flex-1" 
              onClick={handleTransfer}
              disabled={!transferAmount || parseFloat(transferAmount) <= 0 || isProcessing}
            >
              {isProcessing ? (
                <span className="flex items-center gap-2">
                  <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Enviando...
                </span>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Enviar {transferAmount && parseFloat(transferAmount) > 0 ? formatCurrency(parseFloat(transferAmount)) : ''}
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog de Generar Tarjeta */}
      <Dialog open={showGenerateCardDialog} onOpenChange={setShowGenerateCardDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" />
              Activar Tarjeta Virtual
            </DialogTitle>
            <DialogDescription>
              Selecciona el hijo para activar su tarjeta virtual
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-4">
            {childrenWithoutCards.map((child) => (
              <div
                key={child.id}
                className="flex items-center justify-between p-4 border rounded-lg hover:border-primary/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                    <Users className="h-5 w-5 text-gray-500" />
                  </div>
                  <div>
                    <div className="font-medium">{child.name}</div>
                    <div className="text-sm text-muted-foreground">{child.email}</div>
                  </div>
                </div>
                <Button 
                  size="sm"
                  onClick={() => handleGenerateCard(child.id)}
                  disabled={isProcessing}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Activar
                </Button>
              </div>
            ))}

            {childrenWithoutCards.length === 0 && (
              <div className="text-center py-6 text-muted-foreground">
                <CheckCircle className="h-12 w-12 mx-auto mb-3 text-green-500" />
                <p>¡Todos los hijos tienen tarjeta activa!</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
