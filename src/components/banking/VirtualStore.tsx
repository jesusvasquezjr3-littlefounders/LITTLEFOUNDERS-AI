import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Store,
  ShoppingCart,
  Plus,
  Minus,
  Search,
  Filter,
  Star,
  Heart,
  CreditCard,
  CheckCircle,
  XCircle,
  AlertTriangle
} from "lucide-react";

// Tipos de datos
interface Product {
  id: string;
  name: string;
  price: number;
  description: string;
  category: string;
  image: string;
  rating: number;
  inStock: number;
  isPopular?: boolean;
  isNew?: boolean;
}

interface CartItem {
  product: Product;
  quantity: number;
}

interface VirtualCard {
  balance: number;
  dailyLimit: number;
  transactionLimit: number;
  allowedCategories: string[];
  isFrozen: boolean;
}

// Datos mock de productos organizados por categoría
const products: Product[] = [
  // Comida y Bebidas
  {
    id: "food-1",
    name: "Pizza Margarita",
    price: 12.99,
    description: "Deliciosa pizza con queso mozzarella y albahaca fresca",
    category: "food",
    image: "🍕",
    rating: 4.5,
    inStock: 15,
    isPopular: true
  },
  {
    id: "food-2",
    name: "Hamburguesa Clásica",
    price: 8.99,
    description: "Hamburguesa de carne con lechuga, tomate y queso",
    category: "food",
    image: "🍔",
    rating: 4.3,
    inStock: 20
  },
  {
    id: "food-3",
    name: "Smoothie de Frutas",
    price: 5.99,
    description: "Batido natural de frutas mixtas",
    category: "food",
    image: "🥤",
    rating: 4.7,
    inStock: 12
  },
  {
    id: "food-4",
    name: "Donut Glaseada",
    price: 2.50,
    description: "Donut suave con glaseado de azúcar",
    category: "food",
    image: "🍩",
    rating: 4.1,
    inStock: 25
  },

  // Entretenimiento
  {
    id: "entertainment-1",
    name: "Videojuego Aventura",
    price: 29.99,
    description: "Emocionante juego de aventuras para todas las edades",
    category: "entertainment",
    image: "🎮",
    rating: 4.8,
    inStock: 8,
    isPopular: true,
    isNew: true
  },
  {
    id: "entertainment-2",
    name: "Entrada al Cine",
    price: 10.50,
    description: "Boleto para película en cines locales",
    category: "entertainment",
    image: "🎬",
    rating: 4.4,
    inStock: 50
  },
  {
    id: "entertainment-3",
    name: "Revista de Cómics",
    price: 4.99,
    description: "Última edición de tu cómic favorito",
    category: "entertainment",
    image: "📚",
    rating: 4.2,
    inStock: 30
  },

  // Libros y Educación
  {
    id: "books-1",
    name: "Libro de Ciencias",
    price: 15.99,
    description: "Libro educativo sobre experimentos científicos",
    category: "books",
    image: "📖",
    rating: 4.6,
    inStock: 18
  },
  {
    id: "books-2",
    name: "Set de Lápices de Colores",
    price: 12.50,
    description: "Pack de 24 lápices de colores profesionales",
    category: "books",
    image: "✏️",
    rating: 4.4,
    inStock: 22
  },
  {
    id: "books-3",
    name: "Cuaderno Premium",
    price: 7.99,
    description: "Cuaderno de hojas puntadas para tus apuntes",
    category: "books",
    image: "📓",
    rating: 4.3,
    inStock: 35
  },

  // Ropa
  {
    id: "clothing-1",
    name: "Camiseta Cool",
    price: 18.99,
    description: "Camiseta de algodón con diseño moderno",
    category: "clothing",
    image: "👕",
    rating: 4.2,
    inStock: 16
  },
  {
    id: "clothing-2",
    name: "Gorra Deportiva",
    price: 14.50,
    description: "Gorra ajustable para deportes",
    category: "clothing",
    image: "🧢",
    rating: 4.5,
    inStock: 12
  },
  {
    id: "clothing-3",
    name: "Sudadera Cómoda",
    price: 25.99,
    description: "Sudadera suave y cálida para el invierno",
    category: "clothing",
    image: "🧥",
    rating: 4.7,
    inStock: 8
  },

  // Juguetes
  {
    id: "toys-1",
    name: "Robot Interactivo",
    price: 35.99,
    description: "Robot programable con funciones interactivas",
    category: "toys",
    image: "🤖",
    rating: 4.9,
    inStock: 5,
    isPopular: true
  },
  {
    id: "toys-2",
    name: "Peluche Unicornio",
    price: 16.99,
    description: "Suave peluche de unicornio multicolor",
    category: "toys",
    image: "🦄",
    rating: 4.6,
    inStock: 14
  },
  {
    id: "toys-3",
    name: "Puzzle 1000 Piezas",
    price: 19.99,
    description: "Desafiante puzzle de paisajes naturales",
    category: "toys",
    image: "🧩",
    rating: 4.3,
    inStock: 10
  },

  // Deportes
  {
    id: "sports-1",
    name: "Balón de Fútbol",
    price: 22.99,
    description: "Balón oficial para fútbol",
    category: "sports",
    image: "⚽",
    rating: 4.4,
    inStock: 20
  },
  {
    id: "sports-2",
    name: "Raqueta de Tenis",
    price: 45.50,
    description: "Raqueta de tenis junior profesional",
    category: "sports",
    image: "🎾",
    rating: 4.7,
    inStock: 7
  },
  {
    id: "sports-3",
    name: "Cuerda para Saltar",
    price: 8.99,
    description: "Cuerda ajustable para ejercicios",
    category: "sports",
    image: "🪢",
    rating: 4.1,
    inStock: 25
  }
];

const categories = [
  { id: 'all', name: 'Todos', icon: '🛍️' },
  { id: 'food', name: 'Comida y Bebidas', icon: '🍕' },
  { id: 'entertainment', name: 'Entretenimiento', icon: '🎮' },
  { id: 'books', name: 'Libros y Educación', icon: '📚' },
  { id: 'clothing', name: 'Ropa', icon: '👕' },
  { id: 'toys', name: 'Juguetes', icon: '🧸' },
  { id: 'sports', name: 'Deportes', icon: '⚽' }
];

interface VirtualStoreProps {
  virtualCard: VirtualCard;
  onPurchase: (items: CartItem[], total: number) => Promise<{success: boolean, message: string}>;
}

export function VirtualStore({ virtualCard, onPurchase }: VirtualStoreProps) {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCart, setShowCart] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [purchaseResult, setPurchaseResult] = useState<{success: boolean, message: string} | null>(null);

  // Filtrar productos
  const filteredProducts = products.filter(product => {
    const matchesCategory = selectedCategory === 'all' || product.category === selectedCategory;
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         product.description.toLowerCase().includes(searchTerm.toLowerCase());
    const categoryAllowed = virtualCard.allowedCategories.includes(product.category);
    return matchesCategory && matchesSearch && categoryAllowed;
  });

  // Funciones del carrito
  const addToCart = (product: Product) => {
    setCart(prevCart => {
      const existingItem = prevCart.find(item => item.product.id === product.id);
      if (existingItem) {
        return prevCart.map(item =>
          item.product.id === product.id 
            ? { ...item, quantity: Math.min(item.quantity + 1, product.inStock) }
            : item
        );
      }
      return [...prevCart, { product, quantity: 1 }];
    });
  };

  const removeFromCart = (productId: string) => {
    setCart(prevCart => prevCart.filter(item => item.product.id !== productId));
  };

  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }
    setCart(prevCart =>
      prevCart.map(item =>
        item.product.id === productId ? { ...item, quantity } : item
      )
    );
  };

  const getCartTotal = () => {
    return cart.reduce((total, item) => total + (item.product.price * item.quantity), 0);
  };

  const getCartItemCount = () => {
    return cart.reduce((total, item) => total + item.quantity, 0);
  };

  // Función para procesar compra
  const handlePurchase = async () => {
    const total = getCartTotal();
    
    // Validaciones
    if (cart.length === 0) {
      setPurchaseResult({success: false, message: "Tu carrito está vacío"});
      return;
    }

    if (virtualCard.isFrozen) {
      setPurchaseResult({success: false, message: "Tu tarjeta está bloqueada"});
      return;
    }

    if (total > virtualCard.balance) {
      setPurchaseResult({success: false, message: "Saldo insuficiente"});
      return;
    }

    if (total > virtualCard.dailyLimit) {
      setPurchaseResult({success: false, message: "Excede el límite diario"});
      return;
    }

    if (total > virtualCard.transactionLimit) {
      setPurchaseResult({success: false, message: "Excede el límite por transacción"});
      return;
    }

    // Procesar compra
    const result = await onPurchase(cart, total);
    setPurchaseResult(result);
    
    if (result.success) {
      setCart([]); // Limpiar carrito después de compra exitosa
      setShowCart(false);
    }
  };

  // Función para alternar favoritos
  const toggleFavorite = (productId: string) => {
    setFavorites(prev => 
      prev.includes(productId) 
        ? prev.filter(id => id !== productId)
        : [...prev, productId]
    );
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  return (
    <div className="space-y-6">
      {/* Header de la tienda */}
      <Card className="bg-gradient-to-r from-purple-100 to-pink-100 border-purple-200">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Store className="h-6 w-6 text-purple-600" />
            <span>Tiendita Virtual</span>
          </CardTitle>
          <CardDescription>
            Compra productos reales usando tu tarjeta virtual
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Badge variant="outline" className="bg-green-100">
                Saldo: {formatCurrency(virtualCard.balance)}
              </Badge>
              <Badge variant="outline" className="bg-blue-100">
                Límite diario: {formatCurrency(virtualCard.dailyLimit)}
              </Badge>
            </div>
            <Button onClick={() => setShowCart(true)} className="relative">
              <ShoppingCart className="h-4 w-4 mr-2" />
              Carrito ({getCartItemCount()})
              {getCartItemCount() > 0 && (
                <Badge className="absolute -top-2 -right-2 bg-red-500 text-white px-1 py-0 text-xs">
                  {getCartItemCount()}
                </Badge>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Filtros y búsqueda */}
      <Card>
        <CardContent className="p-4">
          <div className="space-y-4">
            {/* Búsqueda */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Buscar productos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Categorías */}
            <div className="flex flex-wrap gap-2">
              {categories.map(category => (
                <Button
                  key={category.id}
                  variant={selectedCategory === category.id ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedCategory(category.id)}
                  className="flex items-center space-x-1"
                >
                  <span>{category.icon}</span>
                  <span>{category.name}</span>
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Productos */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filteredProducts.map(product => (
          <Card key={product.id} className="relative overflow-hidden hover:shadow-lg transition-shadow">
            {product.isNew && (
              <Badge className="absolute top-2 left-2 bg-blue-500 text-white z-10">
                Nuevo
              </Badge>
            )}
            {product.isPopular && (
              <Badge className="absolute top-2 right-2 bg-orange-500 text-white z-10">
                Destacado
              </Badge>
            )}
            
            <CardContent className="p-4">
              <div className="space-y-3">
                {/* Imagen del producto */}
                <div className="text-center">
                  <div className="text-6xl mb-2">{product.image}</div>
                  <h3 className="font-semibold text-lg">{product.name}</h3>
                </div>

                {/* Descripción y rating */}
                <div>
                  <p className="text-sm text-gray-600 mb-2">{product.description}</p>
                  <div className="flex items-center space-x-2">
                    <div className="flex items-center">
                      <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                      <span className="text-sm ml-1">{product.rating}</span>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      Disponible: {product.inStock}
                    </Badge>
                  </div>
                </div>

                {/* Precio y acciones */}
                <div className="flex items-center justify-between">
                  <div className="text-xl font-bold text-green-600">
                    {formatCurrency(product.price)}
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleFavorite(product.id)}
                      className="p-2"
                    >
                      <Heart 
                        className={`h-4 w-4 ${
                          favorites.includes(product.id) 
                            ? 'fill-red-500 text-red-500' 
                            : 'text-gray-400'
                        }`} 
                      />
                    </Button>
                    <Button
                      onClick={() => addToCart(product)}
                      disabled={product.inStock === 0}
                      size="sm"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Mensaje si no hay productos */}
      {filteredProducts.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <div className="text-4xl mb-4">🛍️</div>
            <h3 className="text-lg font-semibold mb-2">No se encontraron productos</h3>
            <p className="text-gray-600">
              {selectedCategory !== 'all' 
                ? `No hay productos disponibles en la categoría ${categories.find(c => c.id === selectedCategory)?.name}.`
                : 'No hay productos que coincidan con tu búsqueda.'
              }
            </p>
            {virtualCard.allowedCategories.length === 0 && (
              <Alert className="mt-4">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  No tienes categorías de compra habilitadas. Pídele a tus padres que configuren tu tarjeta.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* Modal del carrito */}
      <Dialog open={showCart} onOpenChange={setShowCart}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <ShoppingCart className="h-5 w-5" />
              <span>Mi Carrito de Compras</span>
            </DialogTitle>
            <DialogDescription>
              Revisa tus productos antes de realizar la compra
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 max-h-96 overflow-y-auto">
            {cart.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-4xl mb-4">🛒</div>
                <p className="text-gray-600">Tu carrito está vacío</p>
              </div>
            ) : (
              <>
                {cart.map(item => (
                  <div key={item.product.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="text-3xl">{item.product.image}</div>
                      <div>
                        <div className="font-semibold">{item.product.name}</div>
                        <div className="text-sm text-gray-600">
                          {formatCurrency(item.product.price)} c/u
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-3">
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                        <span className="w-8 text-center">{item.quantity}</span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                          disabled={item.quantity >= item.product.inStock}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                      
                      <div className="font-bold text-green-600">
                        {formatCurrency(item.product.price * item.quantity)}
                      </div>
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => removeFromCart(item.product.id)}
                        className="text-red-500"
                      >
                        <XCircle className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}

                {/* Total y botones */}
                <div className="border-t pt-4">
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-lg font-semibold">Total:</span>
                    <span className="text-2xl font-bold text-green-600">
                      {formatCurrency(getCartTotal())}
                    </span>
                  </div>

                  {/* Validaciones de compra */}
                  {getCartTotal() > virtualCard.balance && (
                    <Alert className="mb-4 border-red-200 bg-red-50">
                      <AlertTriangle className="h-4 w-4 text-red-500" />
                      <AlertDescription className="text-red-700">
                        Saldo insuficiente. Necesitas {formatCurrency(getCartTotal() - virtualCard.balance)} más.
                      </AlertDescription>
                    </Alert>
                  )}

                  {getCartTotal() > virtualCard.dailyLimit && (
                    <Alert className="mb-4 border-yellow-200 bg-yellow-50">
                      <AlertTriangle className="h-4 w-4 text-yellow-500" />
                      <AlertDescription className="text-yellow-700">
                        Esta compra excede tu límite diario de {formatCurrency(virtualCard.dailyLimit)}.
                      </AlertDescription>
                    </Alert>
                  )}

                  {getCartTotal() > virtualCard.transactionLimit && (
                    <Alert className="mb-4 border-yellow-200 bg-yellow-50">
                      <AlertTriangle className="h-4 w-4 text-yellow-500" />
                      <AlertDescription className="text-yellow-700">
                        Esta compra excede tu límite por transacción de {formatCurrency(virtualCard.transactionLimit)}.
                      </AlertDescription>
                    </Alert>
                  )}

                  <div className="flex space-x-3">
                    <Button variant="outline" onClick={() => setShowCart(false)} className="flex-1">
                      Seguir Comprando
                    </Button>
                    <Button 
                      onClick={handlePurchase}
                      disabled={
                        cart.length === 0 || 
                        virtualCard.isFrozen ||
                        getCartTotal() > virtualCard.balance ||
                        getCartTotal() > virtualCard.dailyLimit ||
                        getCartTotal() > virtualCard.transactionLimit
                      }
                      className="flex-1"
                    >
                      <CreditCard className="h-4 w-4 mr-2" />
                      Pagar con Tarjeta
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Resultado de la compra */}
          {purchaseResult && (
            <Alert className={purchaseResult.success ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}>
              {purchaseResult.success ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : (
                <XCircle className="h-4 w-4 text-red-500" />
              )}
              <AlertDescription className={purchaseResult.success ? "text-green-700" : "text-red-700"}>
                {purchaseResult.message}
              </AlertDescription>
            </Alert>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
