import { DemoDashboardLayout } from "@/components/demo/DemoDashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { PiggyBank, Plus, Bike, Lock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { DemoLockOverlay } from "@/components/demo/DemoLockOverlay";
import { useState } from "react";

export function DemoSavings() {
    const navigate = useNavigate();
    const [showLock, setShowLock] = useState(false);

    return (
        <DemoDashboardLayout>
            <div className="space-y-6 relative">
                {showLock && (
                    <div className="fixed inset-0 z-50" onClick={() => setShowLock(false)}>
                        <DemoLockOverlay
                            title="Tus Sueños, Tus Metas"
                            description="Visualiza el progreso de tus ahorros. Regístrate para crear múltiples metas personalizadas y alcanzarlas más rápido."
                            onClose={() => setShowLock(false)}
                        />
                    </div>
                )}

                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold">Mis Ahorros (DEMO)</h1>
                        <p className="text-muted-foreground">
                            Visualiza tus metas y alcanza tus sueños
                        </p>
                    </div>
                    <Button onClick={() => setShowLock(true)}>
                        <Plus className="w-4 h-4 mr-2" />
                        Nueva Meta
                    </Button>
                </div>

                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {/* Sample Goal */}
                    <Card className="relative overflow-hidden border-2 border-primary/20">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">
                                Bicicleta Nueva
                            </CardTitle>
                            <Bike className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">$1,250.00</div>
                            <p className="text-xs text-muted-foreground">
                                de $2,500.00 meta
                            </p>
                            <Progress value={50} className="mt-4" />
                            <p className="text-xs text-muted-foreground mt-2">
                                50% completado
                            </p>
                        </CardContent>
                    </Card>

                    {/* Locked Goal Placeholder */}
                    <Card className="relative overflow-hidden border-dashed border-2 flex items-center justify-center h-[180px] bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors group" onClick={() => setShowLock(true)}>
                        <div className="text-center text-muted-foreground group-hover:text-primary transition-colors">
                            <Plus className="w-8 h-8 mx-auto mb-2 opacity-50 group-hover:opacity-100" />
                            <p className="font-medium">Crea tu propia meta</p>
                        </div>
                    </Card>

                    {/* Locked Goal Placeholder */}
                    <Card className="relative overflow-hidden border-dashed border-2 flex items-center justify-center h-[180px] bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors group" onClick={() => setShowLock(true)}>
                        <div className="text-center text-muted-foreground group-hover:text-primary transition-colors">
                            <Plus className="w-8 h-8 mx-auto mb-2 opacity-50 group-hover:opacity-100" />
                            <p className="font-medium">Crea tu propia meta</p>
                        </div>
                    </Card>
                </div>
            </div>
        </DemoDashboardLayout>
    );
}
