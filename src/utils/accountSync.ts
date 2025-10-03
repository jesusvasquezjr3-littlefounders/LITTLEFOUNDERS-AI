// Sistema de sincronización de cuentas entre padre e hijos
// Este archivo maneja la sincronización de transferencias, aprobaciones de tareas y mesadas

export interface ChildAccount {
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

export interface Transfer {
  id: string;
  fromAccount: string;
  toAccount: string;
  amount: number;
  description: string;
  date: string;
  status: 'completed' | 'pending' | 'failed';
  type: 'manual' | 'allowance' | 'bonus' | 'task_reward';
}

export interface TaskReward {
  id: string;
  taskId: string;
  childId: string;
  amount: number;
  description: string;
  date: string;
  status: 'pending' | 'approved' | 'paid';
}

// Función para obtener el usuario actual
export const getCurrentUser = () => {
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
export const getChildVirtualCardData = (childId?: string) => {
  try {
    const user = getCurrentUser();
    const cardKey = childId ? `virtualCard_${childId}` : 'virtualCard';
    const savedCard = localStorage.getItem(cardKey);
    if (savedCard) {
      return JSON.parse(savedCard);
    }
  } catch (error) {
    console.error('Error cargando datos de tarjeta virtual del niño:', error);
  }
  
  // Datos por defecto
  return {
    id: "1",
    cardNumber: "4532 1234 5678 9012",
    holderName: "JUAN PÉREZ",
    expiryDate: "12/28",
    cvv: "123",
    balance: 62.75,
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

// Función para guardar datos de la tarjeta virtual del niño
export const saveChildVirtualCardData = (cardData: any, childId?: string) => {
  try {
    const user = getCurrentUser();
    const cardKey = childId ? `virtualCard_${childId}` : 'virtualCard';
    localStorage.setItem(cardKey, JSON.stringify(cardData));
  } catch (error) {
    console.error('Error guardando datos de tarjeta virtual del niño:', error);
  }
};

// Función para obtener transacciones del niño
export const getChildTransactions = (childId?: string) => {
  try {
    const user = getCurrentUser();
    const transactionKey = childId ? `transactions_${childId}` : 'transactions';
    const savedTransactions = localStorage.getItem(transactionKey);
    if (savedTransactions) {
      return JSON.parse(savedTransactions);
    }
  } catch (error) {
    console.error('Error cargando transacciones del niño:', error);
  }
  
  // Transacciones por defecto
  return [
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
};

// Función para guardar transacciones del niño
export const saveChildTransactions = (transactions: any[], childId?: string) => {
  try {
    const user = getCurrentUser();
    const transactionKey = childId ? `transactions_${childId}` : 'transactions';
    localStorage.setItem(transactionKey, JSON.stringify(transactions));
  } catch (error) {
    console.error('Error guardando transacciones del niño:', error);
  }
};

// Función para sincronizar transferencia del padre al hijo
export const syncParentTransfer = (transfer: Transfer) => {
  try {
    const user = getCurrentUser();
    
    // Si es un niño, actualizar su cuenta
    if (user?.user_type === 'child') {
      // Actualizar tarjeta virtual
      const cardData = getChildVirtualCardData();
      const updatedCard = {
        ...cardData,
        balance: cardData.balance + transfer.amount
      };
      saveChildVirtualCardData(updatedCard);
      
      // Agregar transacción de ingreso
      const transactions = getChildTransactions();
      const newTransaction = {
        id: Date.now().toString(),
        type: "income",
        amount: transfer.amount,
        description: transfer.description,
        date: transfer.date,
        category: transfer.type === 'allowance' ? 'Mesada' : 
                 transfer.type === 'bonus' ? 'Bono' : 'Transferencia'
      };
      
      const updatedTransactions = [newTransaction, ...transactions];
      saveChildTransactions(updatedTransactions);
      
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Error sincronizando transferencia:', error);
    return false;
  }
};

// Función para sincronizar aprobación de tarea
export const syncTaskApproval = (taskReward: TaskReward) => {
  try {
    const user = getCurrentUser();
    
    // Si es un niño, actualizar su cuenta
    if (user?.user_type === 'child') {
      // Actualizar tarjeta virtual
      const cardData = getChildVirtualCardData();
      const updatedCard = {
        ...cardData,
        balance: cardData.balance + taskReward.amount
      };
      saveChildVirtualCardData(updatedCard);
      
      // Agregar transacción de ingreso
      const transactions = getChildTransactions();
      const newTransaction = {
        id: Date.now().toString(),
        type: "income",
        amount: taskReward.amount,
        description: taskReward.description,
        date: taskReward.date,
        category: "Tareas"
      };
      
      const updatedTransactions = [newTransaction, ...transactions];
      saveChildTransactions(updatedTransactions);
      
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Error sincronizando aprobación de tarea:', error);
    return false;
  }
};

// Función para sincronizar mesada automática
export const syncAllowancePayment = (childId: string, amount: number, description: string) => {
  try {
    const user = getCurrentUser();
    
    // Si es un niño, actualizar su cuenta
    if (user?.user_type === 'child') {
      // Actualizar tarjeta virtual
      const cardData = getChildVirtualCardData();
      const updatedCard = {
        ...cardData,
        balance: cardData.balance + amount
      };
      saveChildVirtualCardData(updatedCard);
      
      // Agregar transacción de ingreso
      const transactions = getChildTransactions();
      const newTransaction = {
        id: Date.now().toString(),
        type: "income",
        amount: amount,
        description: description,
        date: new Date().toISOString().split('T')[0],
        category: "Mesada"
      };
      
      const updatedTransactions = [newTransaction, ...transactions];
      saveChildTransactions(updatedTransactions);
      
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Error sincronizando mesada:', error);
    return false;
  }
};

// Función para escuchar cambios en localStorage y sincronizar
export const setupAccountSyncListener = () => {
  const handleStorageChange = (e: StorageEvent) => {
    if (e.key === 'parentTransfers' && e.newValue) {
      try {
        const transfers = JSON.parse(e.newValue);
        const latestTransfer = transfers[0]; // El más reciente
        
        if (latestTransfer && latestTransfer.status === 'completed') {
          syncParentTransfer(latestTransfer);
        }
      } catch (error) {
        console.error('Error procesando cambio de transferencias:', error);
      }
    }
    
    if (e.key === 'taskApprovals' && e.newValue) {
      try {
        const approvals = JSON.parse(e.newValue);
        const latestApproval = approvals[0]; // El más reciente
        
        if (latestApproval && latestApproval.status === 'approved') {
          syncTaskApproval(latestApproval);
        }
      } catch (error) {
        console.error('Error procesando aprobación de tarea:', error);
      }
    }
    
    if (e.key === 'allowancePayments' && e.newValue) {
      try {
        const payments = JSON.parse(e.newValue);
        const latestPayment = payments[0]; // El más reciente
        
        if (latestPayment) {
          syncAllowancePayment(latestPayment.childId, latestPayment.amount, latestPayment.description);
        }
      } catch (error) {
        console.error('Error procesando pago de mesada:', error);
      }
    }
  };
  
  window.addEventListener('storage', handleStorageChange);
  
  // También usar un intervalo para comprobar cambios regulares
  const interval = setInterval(() => {
    try {
      // Verificar transferencias del padre
      const parentTransfers = localStorage.getItem('parentTransfers');
      if (parentTransfers) {
        const transfers = JSON.parse(parentTransfers);
        const latestTransfer = transfers[0];
        
        if (latestTransfer && latestTransfer.status === 'completed') {
          syncParentTransfer(latestTransfer);
        }
      }
      
      // Verificar aprobaciones de tareas
      const taskApprovals = localStorage.getItem('taskApprovals');
      if (taskApprovals) {
        const approvals = JSON.parse(taskApprovals);
        const latestApproval = approvals[0];
        
        if (latestApproval && latestApproval.status === 'approved') {
          syncTaskApproval(latestApproval);
        }
      }
      
      // Verificar pagos de mesadas
      const allowancePayments = localStorage.getItem('allowancePayments');
      if (allowancePayments) {
        const payments = JSON.parse(allowancePayments);
        const latestPayment = payments[0];
        
        if (latestPayment) {
          syncAllowancePayment(latestPayment.childId, latestPayment.amount, latestPayment.description);
        }
      }
    } catch (error) {
      console.error('Error en verificación periódica:', error);
    }
  }, 2000); // Verificar cada 2 segundos
  
  return () => {
    window.removeEventListener('storage', handleStorageChange);
    clearInterval(interval);
  };
};

// Función para inicializar la sincronización
export const initializeAccountSync = () => {
  const user = getCurrentUser();
  
  if (user?.user_type === 'child') {
    return setupAccountSyncListener();
  }
  
  return () => {}; // No hacer nada si no es un niño
};
