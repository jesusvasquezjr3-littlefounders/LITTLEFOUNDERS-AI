import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { 
  Send,
  PiggyBank,
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowLeftRight,
  Target,
  Plus,
  Minus,
  Check,
  AlertCircle,
  Wallet,
  DollarSign,
  Sparkles,
  Trophy
} from "lucide-react";

// Funciones de utilidad
const getCurrentUser = () => {
  try {
    const userData = localStorage.getItem('user');
    if (userData) return JSON.parse(userData);
  } catch (error) {}
  return null;
};

const getCardData = (userId: string) => {
  try {
    const saved = localStorage.getItem(`virtualCard_${userId}`);
    if (saved) return JSON.parse(saved);
  } catch (error) {}
  return { balance: 0 };
};

const saveCardData = (userId: string, data: any) => {
  try {
    localStorage.setItem(`virtualCard_${userId}`, JSON.stringify(data));
  } catch (error) {}
};

const getBalances = (userId: string) => {
  try {
    const saved = localStorage.getItem(`balances_${userId}`);
    if (saved) return JSON.parse(saved);
    const card = getCardData(userId);
    return { available: card.balance || 0, savings: 0, emergency: 0, total: card.balance || 0 };
  } catch (error) {}
  return { available: 0, savings: 0, emergency: 0, total: 0 };
};

const saveBalances = (userId: string, balances: any) => {
  try {
    localStorage.setItem(`balances_${userId}`, JSON.stringify(balances));
  } catch (error) {}
};

const getTransactions = (userId: string) => {
  try {
    const saved = localStorage.getItem(`transactions_${userId}`);
    if (saved) return JSON.parse(saved);
  } catch (error) {}
  return [];
};

const saveTransactions = (userId: string, transactions: any[]) => {
  try {
    localStorage.setItem(`transactions_${userId}`, JSON.stringify(transactions));
  } catch (error) {}
};

const getSavingsGoals = (userId: string) => {
  try {
    const saved = localStorage.getItem(`savingsGoals_${userId}`);
    if (saved) return JSON.parse(saved);
  } catch (error) {}
  return [];
};

const saveSavingsGoals = (userId: string, goals: any[]) => {
  try {
    localStorage.setItem(`savingsGoals_${userId}`, JSON.stringify(goals));
  } catch (error) {}
};

interface BankingActionsProps {
  action: 'transfer' | 'save' | 'deposit' | 'withdraw' | null;
  onClose: () => void;
  onSuccess?: () => void;
}

export function BankingActions({ action, onClose, onSuccess }: BankingActionsProps) {
  const [user, setUser] = useState<any>(null);
  const [balances, setBalances] = useState({ available: 0, savings: 0, emergency: 0, total: 0 });
  const [savingsGoals, setSavingsGoals] = useState<any[]>([]);
  
  // Estados para formularios
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [fromAccount, setFromAccount] = useState<'available' | 'savings' | 'emergency'>('available');
  const [toAccount, setToAccount] = useState<'available' | 'savings' | 'emergency'>('savings');
  const [newGoalName, setNewGoalName] = useState('');
  const [newGoalTarget, setNewGoalTarget] = useState('');
  const [selectedGoal, setSelectedGoal] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    const currentUser = getCurrentUser();
    if (currentUser) {
      setUser(currentUser);
      setBalances(getBalances(currentUser.id));
      setSavingsGoals(getSavingsGoals(currentUser.id));
    }
  }, [action]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const handleTransfer = () => {
    if (!user?.id || !amount || parseFloat(amount) <= 0) return;
    
    const transferAmount = parseFloat(amount);
    const currentBalance = balances[fromAccount];
    
    if (transferAmount > currentBalance) {
      alert('No tienes suficiente saldo para esta transferencia');
      return;
    }

    setIsProcessing(true);

    setTimeout(() => {
      const newBalances = {
        ...balances,
        [fromAccount]: balances[fromAccount] - transferAmount,
        [toAccount]: balances[toAccount] + transferAmount
      };
      newBalances.total = newBalances.available + newBalances.savings + newBalances.emergency;

      // Guardar balances
      saveBalances(user.id, newBalances);
      setBalances(newBalances);

      // Registrar transacción
      const transactions = getTransactions(user.id);
      const newTransaction = {
        id: Date.now().toString(),
        type: 'expense',
        amount: transferAmount,
        description: description || `Transferencia a ${toAccount === 'savings' ? 'Ahorros' : toAccount === 'emergency' ? 'Emergencia' : 'Disponible'}`,
        date: new Date().toISOString().split('T')[0],
        category: 'Transferencia'
      };
      saveTransactions(user.id, [newTransaction, ...transactions]);

      setIsProcessing(false);
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        resetForm();
        onSuccess?.();
        onClose();
      }, 1500);
    }, 1000);
  };

  const handleSaveToGoal = () => {
    if (!user?.id || !amount || !selectedGoal || parseFloat(amount) <= 0) return;
    
    const saveAmount = parseFloat(amount);
    
    if (saveAmount > balances.available) {
      alert('No tienes suficiente saldo disponible');
      return;
    }

    setIsProcessing(true);

    setTimeout(() => {
      // Actualizar meta de ahorro
      const updatedGoals = savingsGoals.map(goal => {
        if (goal.id === selectedGoal) {
          return { ...goal, current: Math.min(goal.current + saveAmount, goal.target) };
        }
        return goal;
      });
      saveSavingsGoals(user.id, updatedGoals);
      setSavingsGoals(updatedGoals);

      // Actualizar balances
      const newBalances = {
        ...balances,
        available: balances.available - saveAmount,
        savings: balances.savings + saveAmount
      };
      newBalances.total = newBalances.available + newBalances.savings + newBalances.emergency;
      saveBalances(user.id, newBalances);
      setBalances(newBalances);

      // Registrar transacción
      const transactions = getTransactions(user.id);
      const goal = savingsGoals.find(g => g.id === selectedGoal);
      const newTransaction = {
        id: Date.now().toString(),
        type: 'expense',
        amount: saveAmount,
        description: `Ahorro para: ${goal?.name || 'Meta'}`,
        date: new Date().toISOString().split('T')[0],
        category: 'Ahorro'
      };
      saveTransactions(user.id, [newTransaction, ...transactions]);

      setIsProcessing(false);
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        resetForm();
        onSuccess?.();
        onClose();
      }, 1500);
    }, 1000);
  };

  const handleCreateGoal = () => {
    if (!user?.id || !newGoalName || !newGoalTarget || parseFloat(newGoalTarget) <= 0) return;

    const newGoal = {
      id: Date.now().toString(),
      name: newGoalName,
      target: parseFloat(newGoalTarget),
      current: 0,
      icon: '🎯',
      createdAt: new Date().toISOString()
    };

    const updatedGoals = [...savingsGoals, newGoal];
    saveSavingsGoals(user.id, updatedGoals);
    setSavingsGoals(updatedGoals);
    setNewGoalName('');
    setNewGoalTarget('');
  };

  const resetForm = () => {
    setAmount('');
    setDescription('');
    setSelectedGoal(null);
    setFromAccount('available');
    setToAccount('savings');
  };

  const accountLabels = {
    available: 'Disponible',
    savings: 'Ahorros',
    emergency: 'Emergencia'
  };

  const accountIcons = {
    available: <Wallet className="h-4 w-4" />,
    savings: <PiggyBank className="h-4 w-4" />,
    emergency: <DollarSign className="h-4 w-4" />
  };

  if (!action) return null;

  return (
    <Dialog open={!!action} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        {showSuccess ? (
          <div className="py-12 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="h-8 w-8 text-green-600" />
            </div>
            <h3 className="text-xl font-semibold text-green-600 mb-2">¡Operación Exitosa!</h3>
            <p className="text-muted-foreground">Tu transacción ha sido procesada</p>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {action === 'transfer' && <><ArrowLeftRight className="h-5 w-5 text-primary" /> Transferir Entre Cuentas</>}
                {action === 'save' && <><PiggyBank className="h-5 w-5 text-blue-500" /> Ahorrar</>}
                {action === 'deposit' && <><ArrowDownToLine className="h-5 w-5 text-green-500" /> Depositar</>}
                {action === 'withdraw' && <><ArrowUpFromLine className="h-5 w-5 text-orange-500" /> Retirar</>}
              </DialogTitle>
              <DialogDescription>
                {action === 'transfer' && 'Mueve dinero entre tus cuentas de forma rápida'}
                {action === 'save' && 'Ahorra para tus metas y objetivos'}
                {action === 'deposit' && 'Agrega fondos a tu cuenta'}
                {action === 'withdraw' && 'Retira dinero de tus ahorros'}
              </DialogDescription>
            </DialogHeader>

            {/* Saldos actuales */}
            <div className="grid grid-cols-3 gap-2 p-3 bg-muted/50 rounded-lg">
              <div className="text-center">
                <div className="text-xs text-muted-foreground mb-1">Disponible</div>
                <div className="font-semibold text-green-600">{formatCurrency(balances.available)}</div>
              </div>
              <div className="text-center border-x">
                <div className="text-xs text-muted-foreground mb-1">Ahorros</div>
                <div className="font-semibold text-blue-600">{formatCurrency(balances.savings)}</div>
              </div>
              <div className="text-center">
                <div className="text-xs text-muted-foreground mb-1">Emergencia</div>
                <div className="font-semibold text-orange-600">{formatCurrency(balances.emergency)}</div>
              </div>
            </div>

            {/* Transferir */}
            {action === 'transfer' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Desde</Label>
                    <select
                      value={fromAccount}
                      onChange={(e) => setFromAccount(e.target.value as any)}
                      className="w-full p-2 border rounded-lg mt-1"
                    >
                      <option value="available">💳 Disponible ({formatCurrency(balances.available)})</option>
                      <option value="savings">🐷 Ahorros ({formatCurrency(balances.savings)})</option>
                      <option value="emergency">💰 Emergencia ({formatCurrency(balances.emergency)})</option>
                    </select>
                  </div>
                  <div>
                    <Label>Hacia</Label>
                    <select
                      value={toAccount}
                      onChange={(e) => setToAccount(e.target.value as any)}
                      className="w-full p-2 border rounded-lg mt-1"
                    >
                      {fromAccount !== 'available' && <option value="available">💳 Disponible</option>}
                      {fromAccount !== 'savings' && <option value="savings">🐷 Ahorros</option>}
                      {fromAccount !== 'emergency' && <option value="emergency">💰 Emergencia</option>}
                    </select>
                  </div>
                </div>

                <div>
                  <Label>Cantidad</Label>
                  <div className="relative mt-1">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="number"
                      placeholder="0.00"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="pl-8"
                    />
                  </div>
                </div>

                <div>
                  <Label>Descripción (opcional)</Label>
                  <Input
                    placeholder="Ej: Ahorro mensual"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="mt-1"
                  />
                </div>

                <Button 
                  className="w-full" 
                  onClick={handleTransfer}
                  disabled={!amount || parseFloat(amount) <= 0 || isProcessing}
                >
                  {isProcessing ? (
                    <span className="flex items-center gap-2">
                      <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Procesando...
                    </span>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Transferir {amount && parseFloat(amount) > 0 ? formatCurrency(parseFloat(amount)) : ''}
                    </>
                  )}
                </Button>
              </div>
            )}

            {/* Ahorrar */}
            {action === 'save' && (
              <Tabs defaultValue="goals" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="goals">Mis Metas</TabsTrigger>
                  <TabsTrigger value="new">Nueva Meta</TabsTrigger>
                </TabsList>

                <TabsContent value="goals" className="space-y-4 mt-4">
                  {savingsGoals.length === 0 ? (
                    <div className="text-center py-6 text-muted-foreground">
                      <Target className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p>No tienes metas de ahorro</p>
                      <p className="text-sm">Crea una meta para empezar a ahorrar</p>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-3 max-h-48 overflow-y-auto">
                        {savingsGoals.map((goal) => {
                          const progress = (goal.current / goal.target) * 100;
                          const isCompleted = goal.current >= goal.target;
                          
                          return (
                            <div
                              key={goal.id}
                              className={`p-3 border rounded-lg cursor-pointer transition-all ${
                                selectedGoal === goal.id 
                                  ? 'border-primary bg-primary/5' 
                                  : 'hover:border-muted-foreground/50'
                              } ${isCompleted ? 'bg-green-50 border-green-200' : ''}`}
                              onClick={() => !isCompleted && setSelectedGoal(goal.id)}
                            >
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-xl">{goal.icon || '🎯'}</span>
                                  <span className="font-medium">{goal.name}</span>
                                  {isCompleted && (
                                    <Badge className="bg-green-100 text-green-700">
                                      <Trophy className="h-3 w-3 mr-1" />
                                      ¡Completada!
                                    </Badge>
                                  )}
                                </div>
                                <span className="text-sm text-muted-foreground">
                                  {formatCurrency(goal.current)} / {formatCurrency(goal.target)}
                                </span>
                              </div>
                              <Progress value={Math.min(progress, 100)} className="h-2" />
                            </div>
                          );
                        })}
                      </div>

                      {selectedGoal && (
                        <div className="space-y-3 pt-3 border-t">
                          <Label>Cantidad a ahorrar</Label>
                          <div className="relative">
                            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                              type="number"
                              placeholder="0.00"
                              value={amount}
                              onChange={(e) => setAmount(e.target.value)}
                              className="pl-8"
                            />
                          </div>
                          <Button 
                            className="w-full" 
                            onClick={handleSaveToGoal}
                            disabled={!amount || parseFloat(amount) <= 0 || isProcessing}
                          >
                            {isProcessing ? (
                              <span className="flex items-center gap-2">
                                <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                Procesando...
                              </span>
                            ) : (
                              <>
                                <Sparkles className="h-4 w-4 mr-2" />
                                Ahorrar {amount && parseFloat(amount) > 0 ? formatCurrency(parseFloat(amount)) : ''}
                              </>
                            )}
                          </Button>
                        </div>
                      )}
                    </>
                  )}
                </TabsContent>

                <TabsContent value="new" className="space-y-4 mt-4">
                  <div>
                    <Label>Nombre de la meta</Label>
                    <Input
                      placeholder="Ej: Bicicleta nueva, Videojuego..."
                      value={newGoalName}
                      onChange={(e) => setNewGoalName(e.target.value)}
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label>Meta de ahorro</Label>
                    <div className="relative mt-1">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="number"
                        placeholder="100.00"
                        value={newGoalTarget}
                        onChange={(e) => setNewGoalTarget(e.target.value)}
                        className="pl-8"
                      />
                    </div>
                  </div>

                  <Button 
                    className="w-full" 
                    onClick={handleCreateGoal}
                    disabled={!newGoalName || !newGoalTarget || parseFloat(newGoalTarget) <= 0}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Crear Meta de Ahorro
                  </Button>
                </TabsContent>
              </Tabs>
            )}

            {/* Depositar - Solo disponible para tutores */}
            {action === 'deposit' && (
              <div className="text-center py-6">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <AlertCircle className="h-8 w-8 text-blue-600" />
                </div>
                <h3 className="text-lg font-semibold mb-2">Depósitos</h3>
                <p className="text-muted-foreground text-sm mb-4">
                  Los depósitos son realizados por tu tutor o patrocinador cuando completas tareas o recibes tu mesada.
                </p>
                <Button variant="outline" onClick={onClose}>
                  Entendido
                </Button>
              </div>
            )}

            {/* Retirar */}
            {action === 'withdraw' && (
              <div className="space-y-4">
                <div>
                  <Label>Retirar de</Label>
                  <select
                    value={fromAccount}
                    onChange={(e) => setFromAccount(e.target.value as any)}
                    className="w-full p-2 border rounded-lg mt-1"
                  >
                    <option value="savings">🐷 Ahorros ({formatCurrency(balances.savings)})</option>
                    <option value="emergency">💰 Emergencia ({formatCurrency(balances.emergency)})</option>
                  </select>
                </div>

                <div>
                  <Label>Cantidad</Label>
                  <div className="relative mt-1">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="number"
                      placeholder="0.00"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="pl-8"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    El dinero se moverá a tu cuenta disponible
                  </p>
                </div>

                <Button 
                  className="w-full" 
                  variant="outline"
                  onClick={() => {
                    setToAccount('available');
                    handleTransfer();
                  }}
                  disabled={!amount || parseFloat(amount) <= 0 || isProcessing}
                >
                  {isProcessing ? (
                    <span className="flex items-center gap-2">
                      <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      Procesando...
                    </span>
                  ) : (
                    <>
                      <ArrowUpFromLine className="h-4 w-4 mr-2" />
                      Retirar {amount && parseFloat(amount) > 0 ? formatCurrency(parseFloat(amount)) : ''}
                    </>
                  )}
                </Button>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
