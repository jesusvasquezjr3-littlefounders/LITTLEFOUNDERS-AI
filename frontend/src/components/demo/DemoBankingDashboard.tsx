import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ThreeDCard } from "@/components/demo/ThreeDCard";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import {
    CreditCard,
    Eye,
    EyeOff,
    Lock,
    Unlock,
    Send,
    PiggyBank,
    ArrowDownToLine,
    ArrowUpFromLine,
    TrendingUp,
    TrendingDown,
    DollarSign,
    RotateCw,
    Wallet,
    ShoppingBag,
    Receipt,
    HelpCircle,
    Lightbulb,
    AlertTriangle
} from "lucide-react";

// Datos Hardcoded para Demo
const DEMO_CARD_DATA = {
    cardNumber: "4532 8821 4567 9012",
    holderName: "CARLOS MARTINEZ",
    expiryDate: "09/27",
    cvv: "847",
    balance: 87.50,
    isActive: true,
    isFrozen: false,
    theme: 'gradient-blue', // Asegurar que coincida con los tipos de ThreeDCard
    dailyLimit: 50.00
};

const DEMO_TRANSACTIONS = [
    {
        id: "dash_1",
        type: "expense",
        amount: 12.99,
        description: "NINTENDO ESHOP *GAME PURCHASE",
        date: new Date().toISOString(),
        category: "Entretenimiento"
    },
    {
        id: "dash_2",
        type: "income",
        amount: 25.00,
        description: "TRANSFERENCIA - MESADA SEMANAL",
        date: new Date(Date.now() - 86400000).toISOString(),
        category: "Mesada"
    },
    {
        id: "dash_3",
        type: "expense",
        amount: 4.50,
        description: "OXXO TIENDA #4521 SNACKS",
        date: new Date(Date.now() - 172800000).toISOString(),
        category: "Comida"
    }
];

interface DemoBankingDashboardProps {
    onRestrictedAction: (actionName: string) => void;
}

export function DemoBankingDashboard({ onRestrictedAction }: DemoBankingDashboardProps) {
    const [cardData, setCardData] = useState(DEMO_CARD_DATA);
    const [showCardDetails, setShowCardDetails] = useState(false);
    const [isFlipped, setIsFlipped] = useState(false);
    const [showBalances, setShowBalances] = useState(true);

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('es-MX', {
            style: 'currency',
            currency: 'USD'
        }).format(amount);
    };

    const toggleCardFreeze = () => {
        setCardData(prev => ({ ...prev, isFrozen: !prev.isFrozen }));
    };

    return (
        <div className="space-y-6">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                <div>
                    <h4 className="font-semibold text-yellow-800 text-sm">Funcionalidad en Desarrollo</h4>
                    <p className="text-yellow-700 text-xs mt-1">
                        Esta sección de Banca Digital es una demostración. Algunas funciones no están disponibles por el momento pero lo estarán en futuras actualizaciones profesionales.
                    </p>
                </div>
            </div>

            {/* Tarjeta Virtual Principal */}
            <Card className="overflow-hidden bg-gradient-to-br from-slate-900 to-slate-800 border-none shadow-xl">
                <CardContent className="p-0">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">
                        {/* Tarjeta 3D */}
                        <div className="p-6 flex flex-col items-center justify-center min-h-[400px] relative">
                            {/* Background decoration */}
                            <div className="absolute inset-0 bg-blue-500/5 z-0" />

                            <div className="relative z-10 w-full max-w-[340px]">
                                <ErrorBoundary>
                                    {/* @ts-ignore - Theme mismatch might occur but strictly handled above */}
                                    <ThreeDCard
                                        cardNumber={cardData.cardNumber}
                                        holderName={cardData.holderName}
                                        expiryDate={cardData.expiryDate}
                                        cvv={cardData.cvv}
                                        theme={cardData.theme as any}
                                        isFlipped={isFlipped}
                                        showDetails={showCardDetails}
                                        isFrozen={cardData.isFrozen}
                                    />
                                </ErrorBoundary>
                            </div>

                            {/* Controles de tarjeta - FUNCTIONAL */}
                            <div className="flex items-center gap-2 mt-6 relative z-10">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="bg-white/10 border-white/20 text-white hover:bg-white/20 transition-all hover:scale-105"
                                    onClick={() => setShowCardDetails(!showCardDetails)}
                                >
                                    {showCardDetails ? <EyeOff className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
                                    {showCardDetails ? "Ocultar" : "Ver datos"}
                                </Button>

                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="bg-white/10 border-white/20 text-white hover:bg-white/20 transition-all hover:scale-105"
                                    onClick={() => setIsFlipped(!isFlipped)}
                                >
                                    <RotateCw className="h-4 w-4 mr-2" />
                                    Voltear
                                </Button>

                                <Button
                                    variant={cardData.isFrozen ? "default" : "destructive"}
                                    size="sm"
                                    onClick={toggleCardFreeze}
                                    className={`transition-all hover:scale-105 ${cardData.isFrozen ? "bg-green-600 hover:bg-green-700" : ""}`}
                                >
                                    {cardData.isFrozen ? <Unlock className="h-4 w-4 mr-2" /> : <Lock className="h-4 w-4 mr-2" />}
                                    {cardData.isFrozen ? "Desbloquear" : "Bloquear"}
                                </Button>
                            </div>
                        </div>

                        {/* Panel de Balance */}
                        <div className="p-8 bg-white/5 flex flex-col justify-center backdrop-blur-sm">
                            <div className="space-y-8">
                                {/* Balance principal */}
                                <div className="text-center lg:text-left">
                                    <div className="flex items-center justify-center lg:justify-start gap-2 mb-2">
                                        <span className="text-white/60 text-sm font-medium tracking-wide">Balance Disponible</span>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="text-white/60 hover:text-white p-1 h-auto rounded-full hover:bg-white/10"
                                            onClick={() => setShowBalances(!showBalances)}
                                        >
                                            {showBalances ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                                        </Button>
                                    </div>
                                    <div className="text-5xl font-bold text-white mb-3 tracking-tight">
                                        {showBalances ? formatCurrency(cardData.balance) : "••••••"}
                                    </div>
                                    <Badge variant={cardData.isFrozen ? "destructive" : "default"} className="px-3 py-1">
                                        {cardData.isFrozen ? "🔒 Tarjeta Bloqueada" : "✓ Tarjeta Activa"}
                                    </Badge>
                                </div>

                                {/* Distribución de fondos */}
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="text-center p-4 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors">
                                        <Wallet className="h-6 w-6 text-green-400 mx-auto mb-2" />
                                        <div className="text-white font-bold text-lg">
                                            {showBalances ? formatCurrency(cardData.balance) : "••••"}
                                        </div>
                                        <div className="text-white/60 text-xs font-medium">Disponible</div>
                                    </div>
                                    <div className="text-center p-4 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors">
                                        <PiggyBank className="h-6 w-6 text-blue-400 mx-auto mb-2" />
                                        <div className="text-white font-bold text-lg">
                                            {showBalances ? formatCurrency(0) : "••••"}
                                        </div>
                                        <div className="text-white/60 text-xs font-medium">Ahorros</div>
                                    </div>
                                    <div className="text-center p-4 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors">
                                        <DollarSign className="h-6 w-6 text-orange-400 mx-auto mb-2" />
                                        <div className="text-white font-bold text-lg">
                                            {showBalances ? formatCurrency(0) : "••••"}
                                        </div>
                                        <div className="text-white/60 text-xs font-medium">Emergencia</div>
                                    </div>
                                </div>

                                {/* Límite diario */}
                                <div className="space-y-3">
                                    <div className="flex justify-between text-sm text-white/60 font-medium">
                                        <span>Límite diario usado</span>
                                        <span>{showBalances ? `${formatCurrency(0)} / ${formatCurrency(cardData.dailyLimit)}` : "••••"}</span>
                                    </div>
                                    <Progress
                                        value={0}
                                        className="h-2 bg-white/10"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Acciones Rápidas - RESTRINGIDAS */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Button
                    variant="outline"
                    className="h-auto py-6 flex flex-col gap-3 hover:bg-primary/5 hover:border-primary hover:scale-[1.02] transition-all rounded-xl border-dashed"
                    onClick={() => onRestrictedAction('transferir')}
                >
                    <div className="p-3 bg-primary/10 rounded-full">
                        <Send className="h-6 w-6 text-primary" />
                    </div>
                    <span className="text-sm font-bold text-primary">Transferir</span>
                </Button>

                <Button
                    variant="outline"
                    className="h-auto py-6 flex flex-col gap-3 hover:bg-blue-500/5 hover:border-blue-500 hover:scale-[1.02] transition-all rounded-xl border-dashed"
                    onClick={() => onRestrictedAction('ahorrar')}
                >
                    <div className="p-3 bg-blue-100 rounded-full">
                        <PiggyBank className="h-6 w-6 text-blue-500" />
                    </div>
                    <span className="text-sm font-bold text-blue-600">Ahorrar</span>
                </Button>

                <Button
                    variant="outline"
                    className="h-auto py-6 flex flex-col gap-3 hover:bg-green-500/5 hover:border-green-500 hover:scale-[1.02] transition-all rounded-xl border-dashed"
                    onClick={() => onRestrictedAction('depositar')}
                >
                    <div className="p-3 bg-green-100 rounded-full">
                        <ArrowDownToLine className="h-6 w-6 text-green-500" />
                    </div>
                    <span className="text-sm font-bold text-green-600">Depositar</span>
                </Button>

                <Button
                    variant="outline"
                    className="h-auto py-6 flex flex-col gap-3 hover:bg-orange-500/5 hover:border-orange-500 hover:scale-[1.02] transition-all rounded-xl border-dashed"
                    onClick={() => onRestrictedAction('historial')}
                >
                    <div className="p-3 bg-orange-100 rounded-full">
                        <Receipt className="h-6 w-6 text-orange-500" />
                    </div>
                    <span className="text-sm font-bold text-orange-600">Historial</span>
                </Button>
            </div>

            {/* Estadísticas del mes */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="text-green-700 text-sm font-medium mb-1 uppercase tracking-wide">Ingresos este mes</div>
                                <div className="text-3xl font-bold text-green-800">
                                    {showBalances ? formatCurrency(25.00) : "••••••"}
                                </div>
                            </div>
                            <div className="p-4 bg-green-200/50 rounded-2xl">
                                <TrendingUp className="h-8 w-8 text-green-700" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-red-50 to-orange-50 border-red-200">
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="text-red-700 text-sm font-medium mb-1 uppercase tracking-wide">Gastos este mes</div>
                                <div className="text-3xl font-bold text-red-800">
                                    {showBalances ? formatCurrency(17.49) : "••••••"}
                                </div>
                            </div>
                            <div className="p-4 bg-red-200/50 rounded-2xl">
                                <TrendingDown className="h-8 w-8 text-red-700" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Últimos Movimientos - RESTRINGIDO al hacer clic en ver todos */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-4 border-b">
                    <CardTitle className="text-lg font-bold flex items-center gap-2">
                        <ShoppingBag className="h-5 w-5 text-gray-500" />
                        Últimos Movimientos
                    </CardTitle>
                    <Button variant="ghost" size="sm" onClick={() => onRestrictedAction('ver_todos')} className="text-primary hover:bg-primary/10">
                        Ver todos
                    </Button>
                </CardHeader>
                <CardContent className="pt-4">
                    <div className="space-y-3">
                        {DEMO_TRANSACTIONS.map((transaction) => {
                            return (
                                <div
                                    key={transaction.id}
                                    className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100 group"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className={`p-3 rounded-full transition-transform group-hover:scale-110 ${transaction.type === 'income'
                                            ? 'bg-green-100 text-green-600'
                                            : 'bg-red-100 text-red-600'
                                            }`}>
                                            {transaction.type === 'income' ? (
                                                <ArrowDownToLine className="h-5 w-5" />
                                            ) : (
                                                <ArrowUpFromLine className="h-5 w-5" />
                                            )}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold text-sm text-slate-700">{transaction.description}</span>
                                            </div>
                                            <div className="text-xs text-slate-500 font-medium">
                                                {transaction.category} • {new Date(transaction.date).toLocaleDateString()}
                                            </div>
                                        </div>
                                    </div>
                                    <div className={`font-bold text-base ${transaction.type === 'income' ? 'text-green-600' : 'text-red-600'
                                        }`}>
                                        {transaction.type === 'income' ? '+' : '-'}{formatCurrency(transaction.amount)}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
