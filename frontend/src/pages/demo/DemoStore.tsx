import { DemoDashboardLayout } from "@/components/demo/DemoDashboardLayout";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShoppingBag, Star, Lock } from "lucide-react";
import { DemoLockOverlay } from "@/components/demo/DemoLockOverlay";
import { useState } from "react";

export function DemoStore() {
    const [showLock, setShowLock] = useState(false);

    const items = [
        { id: 1, name: "Avatar Espacial", price: 500, image: "👨‍🚀" },
        { id: 2, name: "Tema Oscuro", price: 1000, image: "🌙" },
        { id: 3, name: "Mascota Virtual", price: 2500, image: "🐕" },
        { id: 4, name: "Pack de Stickers", price: 300, image: "⭐" },
    ];

    return (
        <DemoDashboardLayout>
            <div className="space-y-6 relative">
                {showLock && (
                    <div className="fixed inset-0 z-50" onClick={() => setShowLock(false)}>
                        <DemoLockOverlay
                            title="Personaliza tu Experiencia"
                            description="¡Hazlo único! Regístrate para ganar monedas reales y canjearlas por increíbles artículos para tu perfil."
                            onClose={() => setShowLock(false)}
                        />
                    </div>
                )}

                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold">Tiendita (DEMO)</h1>
                        <p className="text-muted-foreground">
                            Usa tus monedas para personalizar tu experiencia
                        </p>
                    </div>
                    <div className="flex items-center bg-yellow-100 text-yellow-800 px-4 py-2 rounded-full font-bold">
                        <Star className="w-5 h-5 mr-2 fill-yellow-500" />
                        1,000 Monedas Demo
                    </div>
                </div>

                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                    {items.map((item) => (
                        <Card key={item.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                            <div className="h-32 bg-muted flex items-center justify-center text-6xl">
                                {item.image}
                            </div>
                            <CardHeader>
                                <CardTitle className="text-lg">{item.name}</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="flex items-center text-yellow-600 font-bold">
                                    <Star className="w-4 h-4 mr-1 fill-yellow-500" />
                                    {item.price}
                                </div>
                            </CardContent>
                            <CardFooter>
                                <Button className="w-full" onClick={() => setShowLock(true)}>
                                    <ShoppingBag className="w-4 h-4 mr-2" />
                                    Comprar
                                </Button>
                            </CardFooter>
                        </Card>
                    ))}
                </div>
            </div>
        </DemoDashboardLayout>
    );
}
