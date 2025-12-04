import { useState } from "react";

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
    Palette,
    Shield,
    Eye,
    EyeOff,
    RotateCcw,
    DollarSign,
    Calendar,
    RotateCw,
    Upload
} from "lucide-react";
import { ThreeDCard } from "@/components/demo/ThreeDCard";
import { ErrorBoundary } from "@/components/ui/error-boundary";

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

export function DemoVirtualCard() {
    const [card, setCard] = useState<VirtualCard>({
        id: "1",
        cardNumber: "4532 1234 5678 9012",
        holderName: "TU NOMBRE",
        expiryDate: "12/28",
        cvv: "123",
        balance: 100.00,
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
    });

    const [showCardDetails, setShowCardDetails] = useState(false);
    const [isFlipped, setIsFlipped] = useState(false);

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
        setCard({
            ...card,
            isFrozen: !card.isFrozen
        });
    };

    const updateTheme = (theme: VirtualCard['theme']) => {
        setCard({
            ...card,
            theme: theme
        });
    };

    const updateLimit = (type: 'daily' | 'transaction', value: number) => {
        if (type === 'daily') {
            setCard({ ...card, dailyLimit: value });
        } else {
            setCard({ ...card, transactionLimit: value });
        }
    };

    const toggleCategory = (categoryId: string) => {
        const categories = card.allowedCategories.includes(categoryId)
            ? card.allowedCategories.filter(id => id !== categoryId)
            : [...card.allowedCategories, categoryId];

        setCard({ ...card, allowedCategories: categories });
    };

    const updateNotifications = (type: keyof VirtualCard['notifications'], enabled: boolean) => {
        setCard({
            ...card,
            notifications: {
                ...card.notifications,
                [type]: enabled
            }
        });
    };

    const currentTheme = cardThemes[card.theme];

    return (
        <div className="space-y-6">
            {/* Card Display */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>Mi Tarjeta Virtual (DEMO)</CardTitle>
                            <CardDescription>Personaliza tu tarjeta y mira cómo se ve</CardDescription>
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
                            <ErrorBoundary>
                                <ThreeDCard
                                    cardNumber={card.cardNumber}
                                    holderName={card.holderName}
                                    expiryDate={card.expiryDate}
                                    cvv={card.cvv}
                                    theme={card.theme}
                                    isFlipped={isFlipped}
                                    showDetails={showCardDetails}
                                    isFrozen={card.isFrozen}
                                />
                            </ErrorBoundary>
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
                                                            className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${card.theme === key ? 'border-primary' : 'border-muted'
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
