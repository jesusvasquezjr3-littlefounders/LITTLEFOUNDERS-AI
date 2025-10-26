import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  CreditCard, 
  Lock, 
  Unlock,
  Settings,
  Palette,
  Shield,
  Eye,
  EyeOff,
  AlertTriangle,
  CheckCircle,
  Upload,
  RotateCcw,
  Bell,
  DollarSign,
  Calendar,
  RotateCw
} from "lucide-react";

interface VirtualCard {
  id: string;
  cardNumber: string;
  holderName: string;
  expiryDate: string;
  cvv: string;
  balance: number;
  isActive: boolean;
  isFrozen: boolean;
  theme: 'gradient-blue' | 'gradient-purple' | 'gradient-green' | 'custom';
  customImage?: string;
  dailyLimit: number;
  transactionLimit: number;
  allowedCategories: string[];
  notifications: {
    transactions: boolean;
    dailyLimit: boolean;
    lowBalance: boolean;
  };
}

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

// Función para obtener datos de la tarjeta virtual desde localStorage
const getVirtualCardData = (): VirtualCard => {
  try {
    const user = getCurrentUser();
    let cardKey = 'virtualCard';
    
    // Si es un niño, usar la clave específica del niño
    if (user?.user_type === 'child') {
      // Obtener el ID del niño desde el usuario o usar un ID por defecto
      const childId = user.id || 'child001';
      cardKey = `virtualCard_${childId}`;
    }
    
    const savedCard = localStorage.getItem(cardKey);
    if (savedCard) {
      const cardData = JSON.parse(savedCard);
      // Asegurar que tenga todas las propiedades necesarias
      return {
        id: cardData.id || "1",
        cardNumber: cardData.cardNumber || "4532 1234 5678 9012",
        holderName: cardData.holderName || "JUAN PÉREZ",
        expiryDate: cardData.expiryDate || "12/28",
        cvv: cardData.cvv || "123",
        balance: cardData.balance || 62.75,
        isActive: cardData.isActive !== undefined ? cardData.isActive : true,
        isFrozen: cardData.isFrozen || false,
        theme: cardData.theme || 'gradient-blue',
        dailyLimit: cardData.dailyLimit || 25.00,
        transactionLimit: cardData.transactionLimit || 10.00,
        allowedCategories: cardData.allowedCategories || ['food', 'entertainment', 'books'],
        notifications: cardData.notifications || {
          transactions: true,
          dailyLimit: true,
          lowBalance: false
        }
      };
    }
  } catch (error) {
    console.error('Error cargando datos de tarjeta virtual:', error);
  }
  
  // Datos por defecto si no hay datos guardados
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

// Función para guardar datos de la tarjeta virtual
const saveVirtualCardData = (cardData: VirtualCard) => {
  try {
    const user = getCurrentUser();
    let cardKey = 'virtualCard';
    
    // Si es un niño, usar la clave específica del niño
    if (user?.user_type === 'child') {
      // Obtener el ID del niño desde el usuario o usar un ID por defecto
      const childId = user.id || 'child001';
      cardKey = `virtualCard_${childId}`;
    }
    
    localStorage.setItem(cardKey, JSON.stringify(cardData));
  } catch (error) {
    console.error('Error guardando datos de tarjeta virtual:', error);
  }
};

const cardThemes = {
  'gradient-blue': {
    name: 'Océano Azul',
    gradient: 'from-blue-600 to-cyan-500',
    accent: 'text-blue-100'
  },
  'gradient-purple': {
    name: 'Galaxia Púrpura',
    gradient: 'from-purple-600 to-pink-500',
    accent: 'text-purple-100'
  },
  'gradient-green': {
    name: 'Bosque Verde',
    gradient: 'from-green-600 to-emerald-500',
    accent: 'text-green-100'
  },
  'custom': {
    name: 'Personalizada',
    gradient: 'from-gray-600 to-gray-800',
    accent: 'text-gray-100'
  }
};

const spendingCategories = [
  { id: 'food', name: 'Comida y Bebidas', icon: '🍕' },
  { id: 'entertainment', name: 'Entretenimiento', icon: '🎮' },
  { id: 'books', name: 'Libros y Educación', icon: '📚' },
  { id: 'clothing', name: 'Ropa', icon: '👕' },
  { id: 'toys', name: 'Juguetes', icon: '🧸' },
  { id: 'sports', name: 'Deportes', icon: '⚽' }
];

export function VirtualCard() {
  const [card, setCard] = useState<VirtualCard>(getVirtualCardData());
  const [showCardDetails, setShowCardDetails] = useState(false);
  const [isCustomizing, setIsCustomizing] = useState(false);
  const [customImage, setCustomImage] = useState<string | null>(null);
  const [isFlipped, setIsFlipped] = useState(false);
  const [hasVirtualCard, setHasVirtualCard] = useState<boolean>(false);
  const [bankingActivated, setBankingActivated] = useState<boolean>(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState(true);

  // Función para verificar estado real de la tarjeta virtual desde el backend
  const checkVirtualCardStatus = async () => {
    try {
      const user = getCurrentUser();
      if (!user?.id) return;
      
      const response = await fetch(`http://localhost:8000/virtual-cards/status/${user.id}?t=${Date.now()}`);
      if (response.ok) {
        const data = await response.json();
        setHasVirtualCard(data.has_card || false);
        setBankingActivated(data.banking_activated || false);
      } else {
        setHasVirtualCard(false);
        setBankingActivated(false);
      }
    } catch (error) {
      console.error('Error checking virtual card status:', error);
      setHasVirtualCard(false);
      setBankingActivated(false);
    } finally {
      setIsCheckingStatus(false);
    }
  };

  // Verificar estado al montar el componente
  useEffect(() => {
    checkVirtualCardStatus();
  }, []);

  // Escuchar eventos de activación de tarjeta virtual
  useEffect(() => {
    const handleVirtualCardActivated = () => {
      // Refrescar el estado cuando se active una tarjeta virtual
      checkVirtualCardStatus();
    };

    window.addEventListener('virtualCardActivated', handleVirtualCardActivated);
    
    return () => {
      window.removeEventListener('virtualCardActivated', handleVirtualCardActivated);
    };
  }, []);

  // Actualizar datos cuando cambie el localStorage
  useEffect(() => {
    const updateCardData = () => {
      const newCardData = getVirtualCardData();
      setCard(newCardData);
    };

    // Actualizar datos inmediatamente
    updateCardData();

    // Escuchar cambios en localStorage
    window.addEventListener('storage', updateCardData);
    
    // También podemos usar un intervalo para comprobar cambios regulares
    const interval = setInterval(updateCardData, 1000);

    return () => {
      window.removeEventListener('storage', updateCardData);
      clearInterval(interval);
    };
  }, []);

  // Sincronización automática para niños
  useEffect(() => {
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

    const user = getCurrentUser();
    if (user?.user_type === 'child') {
      // Importar y inicializar la sincronización
      import('@/utils/accountSync').then(({ initializeAccountSync }) => {
        const cleanup = initializeAccountSync();
        return cleanup;
      }).catch(error => {
        console.error('Error inicializando sincronización:', error);
      });
    }
  }, []);

  const formatCardNumber = (number: string) => {
    return number.replace(/\s/g, '').replace(/(\d{4})/g, '$1 ').trim();
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const toggleCardStatus = () => {
    const updatedCard = {
      ...card,
      isFrozen: !card.isFrozen
    };
    setCard(updatedCard);
    saveVirtualCardData(updatedCard);
  };

  const updateTheme = (theme: VirtualCard['theme']) => {
    const updatedCard = {
      ...card,
      theme: theme
    };
    setCard(updatedCard);
    saveVirtualCardData(updatedCard);
  };

  const updateLimit = (type: 'daily' | 'transaction', value: number) => {
    let updatedCard;
    if (type === 'daily') {
      updatedCard = { ...card, dailyLimit: value };
    } else {
      updatedCard = { ...card, transactionLimit: value };
    }
    setCard(updatedCard);
    saveVirtualCardData(updatedCard);
  };

  const toggleCategory = (categoryId: string) => {
    const categories = card.allowedCategories.includes(categoryId)
      ? card.allowedCategories.filter(id => id !== categoryId)
      : [...card.allowedCategories, categoryId];
    
    const updatedCard = { ...card, allowedCategories: categories };
    setCard(updatedCard);
    saveVirtualCardData(updatedCard);
  };

  const updateNotifications = (type: keyof VirtualCard['notifications'], enabled: boolean) => {
    const updatedCard = {
      ...card,
      notifications: {
        ...card.notifications,
        [type]: enabled
      }
    };
    setCard(updatedCard);
    saveVirtualCardData(updatedCard);
  };

  const currentTheme = cardThemes[card.theme];

  // Si está verificando el estado, mostrar loading
  if (isCheckingStatus) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <div className="flex flex-col items-center space-y-4">
            <CreditCard className="h-12 w-12 text-muted-foreground animate-pulse" />
            <p className="text-muted-foreground">Verificando estado de la tarjeta...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Si no tiene banca activada, mostrar mensaje
  if (!bankingActivated) {
    const user = getCurrentUser();
    const isChild = user?.user_type === 'child';
    
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <div className="flex flex-col items-center space-y-4">
            <Lock className="h-12 w-12 text-muted-foreground" />
            <h3 className="text-lg font-semibold">Tarjeta Virtual no Disponible</h3>
            <p className="text-muted-foreground text-sm">
              {isChild 
                ? 'Tu tutor o patrocinador debe activar tu tarjeta virtual para que puedas usarla.'
                : 'Genera tu tarjeta virtual desde la sección de Gestión Familiar para empezar a usarla.'
              }
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Card Display */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Mi Tarjeta Virtual</CardTitle>
              <CardDescription>Controla tu dinero de forma segura</CardDescription>
            </div>
            <div className="flex items-center space-x-2">
              <Badge variant={card.isFrozen ? "destructive" : "default"}>
                {card.isFrozen ? "Bloqueada" : "Activa"}
              </Badge>
              <Button
                variant={card.isFrozen ? "default" : "destructive"}
                size="sm"
                onClick={toggleCardStatus}
              >
                {card.isFrozen ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                {card.isFrozen ? "Desbloquear" : "Bloquear"}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Virtual Card Visual */}
            <div className="relative mx-auto max-w-md">
              <div className="relative h-64 perspective-1000">
                {/* Card Container with 3D Transform */}
                <div 
                  className={`relative w-full h-full transition-transform duration-700 ease-in-out transform-style-preserve-3d ${
                    isFlipped ? 'rotate-y-180' : ''
                  }`}
                  style={{
                    transformStyle: 'preserve-3d',
                    transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)'
                  }}
                >
                  {/* Front of Card */}
                  <div 
                    className="absolute inset-0 w-full h-full backface-hidden"
                    style={{ backfaceVisibility: 'hidden' }}
                  >
                    <div className={`relative bg-gradient-to-r ${currentTheme.gradient} rounded-lg p-6 text-white aspect-[1.6/1] shadow-xl h-full`}>
                      {card.isFrozen && (
                        <div className="absolute inset-0 bg-black/50 rounded-lg flex items-center justify-center">
                          <div className="text-center">
                            <Lock className="h-8 w-8 mx-auto mb-2" />
                            <div className="text-sm font-medium">Tarjeta Bloqueada</div>
                          </div>
                        </div>
                      )}
                      
                      <div className="absolute top-4 left-4">
                        <div className="text-xs opacity-80">LITTLE FOUNDERS</div>
                      </div>
                      
                      <div className="absolute top-4 right-4">
                        <div className="w-8 h-8 bg-white/20 rounded-full"></div>
                      </div>
                      
                      <div className="absolute bottom-16 left-4 right-4">
                        <div className="text-lg font-mono tracking-wider">
                          {showCardDetails 
                            ? formatCardNumber(card.cardNumber)
                            : "•••• •••• •••• " + card.cardNumber.slice(-4)
                          }
                        </div>
                      </div>
                      
                      <div className="absolute bottom-4 left-4 right-4 flex justify-between items-end">
                        <div>
                          <div className="text-xs opacity-80 mb-1">DUEÑO</div>
                          <div className="text-sm font-semibold">{card.holderName}</div>
                        </div>
                        <div>
                          <div className="text-xs opacity-80 mb-1">EXPIRA</div>
                          <div className="text-sm font-semibold">
                            {showCardDetails ? card.expiryDate : "••/••"}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Back of Card */}
                  <div 
                    className="absolute inset-0 w-full h-full backface-hidden rotate-y-180"
                    style={{ 
                      backfaceVisibility: 'hidden',
                      transform: 'rotateY(180deg)'
                    }}
                  >
                    <div className={`relative bg-gradient-to-r ${currentTheme.gradient} rounded-lg p-6 text-white aspect-[1.6/1] shadow-xl h-full`}>
                      {card.isFrozen && (
                        <div className="absolute inset-0 bg-black/50 rounded-lg flex items-center justify-center">
                          <div className="text-center">
                            <Lock className="h-8 w-8 mx-auto mb-2" />
                            <div className="text-sm font-medium">Tarjeta Bloqueada</div>
                          </div>
                        </div>
                      )}
                      
                      {/* Magnetic Strip */}
                      <div className="absolute top-0 left-0 right-0 h-12 bg-black/60 rounded-t-lg"></div>
                      
                      {/* CVV Section */}
                      <div className="absolute top-20 left-4 right-4">
                        <div className="bg-white/20 rounded-lg p-4">
                          <div className="text-xs opacity-80 mb-2">CÓDIGO DE SEGURIDAD</div>
                          <div className="flex justify-between items-center">
                            <div className="bg-white/30 rounded px-3 py-2 min-w-[60px] text-center">
                              <span className="text-lg font-mono font-bold">
                                {showCardDetails ? card.cvv : "•••"}
                              </span>
                            </div>
                            <div className="text-xs opacity-80 text-right">
                              <div>CVV</div>
                              <div>3 dígitos</div>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Signature Strip */}
                      <div className="absolute bottom-4 left-4 right-4">
                        <div className="bg-white/10 rounded p-2 h-8 flex items-center">
                          <div className="text-xs opacity-60 flex-1">Firma del portador</div>
                          <div className="text-xs opacity-40 italic">
                            {card.holderName}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Card Actions */}
              <div className="flex justify-center mt-4 space-x-2 flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowCardDetails(!showCardDetails)}
                >
                  {showCardDetails ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  {showCardDetails ? "Ocultar" : "Mostrar"} Detalles
                </Button>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsFlipped(!isFlipped)}
                >
                  {isFlipped ? <RotateCcw className="h-4 w-4" /> : <RotateCw className="h-4 w-4" />}
                  {isFlipped ? "Ver Frente" : "Ver Reverso"}
                </Button>
                
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Palette className="h-4 w-4 mr-2" />
                      Personalizar
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>Personalizar Tarjeta</DialogTitle>
                      <DialogDescription>
                        Cambia el diseño y configuración de tu tarjeta
                      </DialogDescription>
                    </DialogHeader>
                    
                    <Tabs defaultValue="design" className="w-full">
                      <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="design">Diseño</TabsTrigger>
                        <TabsTrigger value="limits">Límites</TabsTrigger>
                        <TabsTrigger value="security">Seguridad</TabsTrigger>
                      </TabsList>
                      
                      <TabsContent value="design" className="space-y-4">
                        <div>
                          <Label>Temas Disponibles</Label>
                          <div className="grid grid-cols-2 gap-4 mt-2">
                            {Object.entries(cardThemes).map(([key, theme]) => (
                              <div
                                key={key}
                                className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                                  card.theme === key ? 'border-primary' : 'border-muted'
                                }`}
                                onClick={() => updateTheme(key as VirtualCard['theme'])}
                              >
                                <div className={`h-16 bg-gradient-to-r ${theme.gradient} rounded mb-2`}></div>
                                <div className="text-sm font-medium">{theme.name}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                        
                        <div>
                          <Label>Imagen Personalizada</Label>
                          <div className="flex items-center space-x-4 mt-2">
                            <Button variant="outline" size="sm">
                              <Upload className="h-4 w-4 mr-2" />
                              Subir Imagen
                            </Button>
                            <Button variant="outline" size="sm">
                              <RotateCcw className="h-4 w-4 mr-2" />
                              Restablecer
                            </Button>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            Formatos: JPG, PNG. Máximo 2MB.
                          </p>
                        </div>
                      </TabsContent>
                      
                      <TabsContent value="limits" className="space-y-4">
                        <div className="space-y-4">
                          <div>
                            <Label>Límite Diario</Label>
                            <div className="flex items-center space-x-4 mt-2">
                              <Input
                                type="number"
                                value={card.dailyLimit}
                                onChange={(e) => updateLimit('daily', parseFloat(e.target.value))}
                                className="w-32"
                              />
                              <span className="text-sm text-muted-foreground">
                                Máximo por día
                              </span>
                            </div>
                          </div>
                          
                          <div>
                            <Label>Límite por Transacción</Label>
                            <div className="flex items-center space-x-4 mt-2">
                              <Input
                                type="number"
                                value={card.transactionLimit}
                                onChange={(e) => updateLimit('transaction', parseFloat(e.target.value))}
                                className="w-32"
                              />
                              <span className="text-sm text-muted-foreground">
                                Máximo por compra
                              </span>
                            </div>
                          </div>
                          
                          <div>
                            <Label>Categorías Permitidas</Label>
                            <div className="grid grid-cols-2 gap-2 mt-2">
                              {spendingCategories.map((category) => (
                                <div
                                  key={category.id}
                                  className="flex items-center space-x-2 p-2 border rounded cursor-pointer"
                                  onClick={() => toggleCategory(category.id)}
                                >
                                  <input
                                    type="checkbox"
                                    checked={card.allowedCategories.includes(category.id)}
                                    readOnly
                                  />
                                  <span className="mr-2">{category.icon}</span>
                                  <span className="text-sm">{category.name}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </TabsContent>
                      
                      <TabsContent value="security" className="space-y-4">
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="font-medium">Notificaciones de Transacciones</div>
                              <div className="text-sm text-muted-foreground">
                                Recibe alertas por cada compra
                              </div>
                            </div>
                            <Switch
                              checked={card.notifications.transactions}
                              onCheckedChange={(checked) => updateNotifications('transactions', checked)}
                            />
                          </div>
                          
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="font-medium">Alertas de Límite Diario</div>
                              <div className="text-sm text-muted-foreground">
                                Notifica cuando te acerques al límite
                              </div>
                            </div>
                            <Switch
                              checked={card.notifications.dailyLimit}
                              onCheckedChange={(checked) => updateNotifications('dailyLimit', checked)}
                            />
                          </div>
                          
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="font-medium">Alertas de Saldo Bajo</div>
                              <div className="text-sm text-muted-foreground">
                                Avisa cuando el saldo sea menor a $5
                              </div>
                            </div>
                            <Switch
                              checked={card.notifications.lowBalance}
                              onCheckedChange={(checked) => updateNotifications('lowBalance', checked)}
                            />
                          </div>
                        </div>
                      </TabsContent>
                    </Tabs>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            {/* Card Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-green-100 rounded-full">
                      <DollarSign className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <div className="text-lg font-bold text-green-600">
                        {formatCurrency(card.balance)}
                      </div>
                      <div className="text-sm text-muted-foreground">Saldo disponible</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-blue-100 rounded-full">
                      <Calendar className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <div className="text-lg font-bold text-blue-600">
                        {formatCurrency(card.dailyLimit)}
                      </div>
                      <div className="text-sm text-muted-foreground">Límite diario</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-purple-100 rounded-full">
                      <Shield className="h-5 w-5 text-purple-600" />
                    </div>
                    <div>
                      <div className="text-lg font-bold text-purple-600">
                        {card.allowedCategories.length}
                      </div>
                      <div className="text-sm text-muted-foreground">Categorías permitidas</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </CardContent>
      </Card>

    </div>
  );
}




