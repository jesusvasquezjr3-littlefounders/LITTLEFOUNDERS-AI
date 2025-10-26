import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { VirtualStore } from "@/components/banking/VirtualStore";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, AlertTriangle } from "lucide-react";

interface Transaction {
  id: string;
  type: 'income' | 'expense';
  amount: number;
  description: string;
  date: string;
  category: string;
}

interface CartItem {
  product: {
    id: string;
    name: string;
    price: number;
    description: string;
    category: string;
    image: string;
    rating: number;
    inStock: number;
  };
  quantity: number;
}

interface VirtualCard {
  balance: number;
  dailyLimit: number;
  transactionLimit: number;
  allowedCategories: string[];
  isFrozen: boolean;
}

// Obtener datos de la tarjeta virtual del localStorage o usar datos mock
const getVirtualCardData = (): VirtualCard => {
  try {
    const savedCard = localStorage.getItem('virtualCard');
    if (savedCard) {
      return JSON.parse(savedCard);
    }
  } catch (error) {
    console.error('Error cargando datos de tarjeta virtual:', error);
  }
  
  // Datos mock por defecto en pesos mexicanos
  return {
    balance: 1000,
    dailyLimit: 500,
    transactionLimit: 200,
    allowedCategories: ['food', 'entertainment', 'books'],
    isFrozen: false
  };
};

// Obtener transacciones del localStorage
const getTransactions = (): Transaction[] => {
  try {
    const savedTransactions = localStorage.getItem('transactions');
    if (savedTransactions) {
      return JSON.parse(savedTransactions);
    }
  } catch (error) {
    console.error('Error cargando transacciones:', error);
  }
  
  return [];
};

// Guardar transacciones en localStorage
const saveTransactions = (transactions: Transaction[]) => {
  try {
    localStorage.setItem('transactions', JSON.stringify(transactions));
  } catch (error) {
    console.error('Error guardando transacciones:', error);
  }
};

// Guardar datos de la tarjeta virtual
const saveVirtualCardData = (cardData: VirtualCard) => {
  try {
    localStorage.setItem('virtualCard', JSON.stringify(cardData));
  } catch (error) {
    console.error('Error guardando datos de tarjeta virtual:', error);
  }
};

const Store = () => {
  const [virtualCard, setVirtualCard] = useState<VirtualCard>(getVirtualCardData());
  const [transactions, setTransactions] = useState<Transaction[]>(getTransactions());
  const [purchaseNotification, setPurchaseNotification] = useState<{success: boolean, message: string} | null>(null);
  const [hasVirtualCard, setHasVirtualCard] = useState<boolean>(false);
  const [user, setUser] = useState<any>(null);

  // Verificar si el usuario tiene tarjeta virtual
  useEffect(() => {
    const checkCardStatus = async () => {
      const userData = localStorage.getItem('user');
      if (userData) {
        const parsedUser = JSON.parse(userData);
        setUser(parsedUser);
        
        if (parsedUser.user_type === 'child') {
          try {
            const response = await fetch(`http://localhost:8000/virtual-cards/status/${parsedUser.id}`);
            if (response.ok) {
              const data = await response.json();
              setHasVirtualCard(data.has_card);
            }
          } catch (error) {
            console.error('Error checking card status:', error);
          }
        } else {
          // Si no es child, permitir acceso
          setHasVirtualCard(true);
        }
      }
    };
    
    checkCardStatus();
  }, []);

  // Función para procesar compras
  const handlePurchase = async (items: CartItem[], total: number): Promise<{success: boolean, message: string}> => {
    // Verificar si tiene tarjeta virtual
    if (user?.user_type === 'child' && !hasVirtualCard) {
      return {
        success: false,
        message: 'No tienes una tarjeta virtual activa. Habla con tu tutor o patrocinador.'
      };
    }
    try {
      // Validaciones adicionales
      if (virtualCard.isFrozen) {
        return {success: false, message: "Tu tarjeta está bloqueada. Pídele a tus padres que la desbloquee."};
      }

      if (total > virtualCard.balance) {
        return {success: false, message: `Saldo insuficiente. Tu saldo actual es de $${virtualCard.balance.toFixed(2)}.`};
      }

      if (total > virtualCard.dailyLimit) {
        return {success: false, message: `Esta compra excede tu límite diario de $${virtualCard.dailyLimit.toFixed(2)}.`};
      }

      if (total > virtualCard.transactionLimit) {
        return {success: false, message: `Esta compra excede tu límite por transacción de $${virtualCard.transactionLimit.toFixed(2)}.`};
      }

      // Simular procesamiento de pago (en la vida real, esto sería una llamada a la API)
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Actualizar balance de la tarjeta
      const newBalance = virtualCard.balance - total;
      const updatedCard = { ...virtualCard, balance: newBalance };
      setVirtualCard(updatedCard);
      saveVirtualCardData(updatedCard);

      // Crear nuevas transacciones para cada producto
      const newTransactions: Transaction[] = items.map((item, index) => ({
        id: `purchase-${Date.now()}-${index}`,
        type: 'expense',
        amount: item.product.price * item.quantity,
        description: `Compra: ${item.product.name}${item.quantity > 1 ? ` (x${item.quantity})` : ''}`,
        date: new Date().toISOString().split('T')[0],
        category: item.product.category
      }));

      // Agregar las transacciones al historial
      const updatedTransactions = [...newTransactions, ...transactions];
      setTransactions(updatedTransactions);
      saveTransactions(updatedTransactions);

      // Mostrar notificación de éxito
      const purchaseItems = items.map(item => 
        `${item.product.name}${item.quantity > 1 ? ` (x${item.quantity})` : ''}`
      ).join(', ');
      
      const successMessage = `¡Compra exitosa! Has comprado: ${purchaseItems}. Nuevo saldo: $${newBalance.toFixed(2)}`;
      
      setPurchaseNotification({success: true, message: successMessage});
      
      // Limpiar notificación después de 5 segundos
      setTimeout(() => setPurchaseNotification(null), 5000);

      return {success: true, message: successMessage};

    } catch (error) {
      console.error('Error procesando compra:', error);
      const errorMessage = "Error al procesar la compra. Por favor, inténtalo de nuevo.";
      setPurchaseNotification({success: false, message: errorMessage});
      setTimeout(() => setPurchaseNotification(null), 5000);
      return {success: false, message: errorMessage};
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Notificación de compra */}
        {purchaseNotification && (
          <Alert className={`${purchaseNotification.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'} mb-6`}>
            {purchaseNotification.success ? (
              <CheckCircle className="h-4 w-4 text-green-500" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-red-500" />
            )}
            <AlertDescription className={purchaseNotification.success ? 'text-green-700' : 'text-red-700'}>
              {purchaseNotification.message}
            </AlertDescription>
          </Alert>
        )}

        {/* Componente de la tienda virtual */}
        <VirtualStore
          virtualCard={virtualCard}
          onPurchase={handlePurchase}
        />
      </div>
    </DashboardLayout>
  );
};

export default Store;
