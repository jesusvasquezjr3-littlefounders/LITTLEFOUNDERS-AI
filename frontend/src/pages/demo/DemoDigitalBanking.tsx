import { useState } from "react";
import { DemoDashboardLayout } from "@/components/demo/DemoDashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DemoVirtualCard } from "./DemoVirtualCard";
import { DemoLockOverlay } from "@/components/demo/DemoLockOverlay";
import {
    CreditCard,
    TrendingUp,
    TrendingDown,
    FileText,
    Users
} from "lucide-react";

export function DemoDigitalBanking() {
    const [activeTab, setActiveTab] = useState("accounts");

    return (
        <DemoDashboardLayout>
            <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold">Banca Digital (DEMO)</h1>
                        <p className="text-muted-foreground">
                            Administra tu dinero virtual, ahorra y aprende sobre finanzas
                        </p>
                    </div>
                </div>

                {/* Main Content */}
                <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                    <TabsList className="grid w-full grid-cols-5">
                        <TabsTrigger value="accounts">
                            <CreditCard className="h-4 w-4 mr-2" />
                            Cuentas
                        </TabsTrigger>
                        <TabsTrigger value="income">
                            <TrendingUp className="h-4 w-4 mr-2" />
                            Ingresos
                        </TabsTrigger>
                        <TabsTrigger value="expenses">
                            <TrendingDown className="h-4 w-4 mr-2" />
                            Gastos
                        </TabsTrigger>
                        <TabsTrigger value="statement">
                            <FileText className="h-4 w-4 mr-2" />
                            Estado de Cuenta
                        </TabsTrigger>
                        <TabsTrigger value="test">
                            <Users className="h-4 w-4 mr-2" />
                            Prueba
                        </TabsTrigger>
                    </TabsList>

                    {/* Accounts Tab - Unlocked (Virtual Card only) */}
                    <TabsContent value="accounts">
                        <div className="space-y-6">
                            {/* Mi Tarjeta Virtual */}
                            <DemoVirtualCard />
                        </div>
                    </TabsContent>

                    {/* Locked Tabs */}
                    <TabsContent value="income" className="relative min-h-[400px]">
                        <DemoLockOverlay
                            title="Visualiza tus Ingresos"
                            description="Descubre cómo crecen tus ahorros. Regístrate para ver el historial detallado de tus ingresos y mesadas."
                        />
                    </TabsContent>

                    <TabsContent value="expenses" className="relative min-h-[400px]">
                        <DemoLockOverlay
                            title="Controla tus Gastos"
                            description="Aprende a gestionar tu dinero. Regístrate para monitorear tus gastos y crear presupuestos inteligentes."
                        />
                    </TabsContent>

                    <TabsContent value="statement" className="relative min-h-[400px]">
                        <DemoLockOverlay
                            title="Tu Estado de Cuenta"
                            description="Mantén el control total. Regístrate para acceder y descargar tus estados de cuenta mensuales detallados."
                        />
                    </TabsContent>

                    <TabsContent value="test" className="relative min-h-[400px]">
                        <DemoLockOverlay
                            title="Simulador de Transferencias"
                            description="Practica sin riesgos. Regístrate para simular transferencias y aprender cómo funciona el movimiento de dinero."
                        />
                    </TabsContent>
                </Tabs>
            </div>
        </DemoDashboardLayout>
    );
}
