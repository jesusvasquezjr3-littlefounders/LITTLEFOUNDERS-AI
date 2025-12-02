import { DemoDashboardLayout } from "@/components/demo/DemoDashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Lightbulb, Clock, Gamepad2, Lock } from "lucide-react";
import { DemoLockOverlay } from "@/components/demo/DemoLockOverlay";

export function DemoInvestmentGames() {
    const navigate = useNavigate();

    const games = [
        {
            id: "lemonade-stand",
            title: "Emprende tu stand de limonada",
            description: "Aprende conceptos básicos de emprendimiento administrando tu propio puesto de limonadas. Gestiona ingredientes, precios y marketing.",
            icon: <Lightbulb className="w-8 h-8 text-yellow-500" />,
            available: true,
            route: "/demo/lemonade-stand"
        },
        {
            id: "stock-market",
            title: "Simulador de Bolsa",
            description: "Aprende a invertir en el mercado de valores con dinero virtual. Compra y vende acciones de tus empresas favoritas.",
            icon: <TrendingUpIcon className="w-8 h-8 text-blue-500" />,
            available: false,
            locked: true
        },
        {
            id: "coming-soon",
            title: "Próximamente...",
            description: "Nuevo juego educativo financiero en desarrollo. ¡Mantente atento para descubrir nuevas aventuras de aprendizaje!",
            icon: <Clock className="w-8 h-8 text-gray-400" />,
            available: false,
            locked: false
        }
    ];

    return (
        <DemoDashboardLayout>
            <div className="p-6 space-y-6">
                {/* Header */}
                <div className="text-center space-y-4">
                    <div className="flex justify-center">
                        <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-yellow-500 rounded-2xl flex items-center justify-center shadow-lg">
                            <Gamepad2 className="w-8 h-8 text-white" />
                        </div>
                    </div>
                    <h1 className="text-4xl font-bold bg-gradient-to-r from-orange-600 to-yellow-600 bg-clip-text text-transparent">
                        Aprende a Emprender (DEMO)
                    </h1>
                    <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
                        Descubre el mundo del emprendimiento a través de juegos educativos divertidos e interactivos.
                    </p>
                </div>

                {/* Games Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
                    {games.map((game) => (
                        <Card
                            key={game.id}
                            className={`group transition-all duration-300 hover:shadow-xl relative overflow-hidden ${game.available
                                ? 'hover:scale-[1.02] cursor-pointer border-border hover:border-orange-200'
                                : 'opacity-90'
                                }`}
                        >
                            {game.locked && (
                                <div className="absolute inset-0 bg-background/60 backdrop-blur-[2px] z-10 flex flex-col items-center justify-center p-4 text-center transition-all duration-300">
                                    <Lock className="w-8 h-8 text-orange-500 mb-2" />
                                    <p className="font-bold text-foreground text-lg">Nivel Avanzado</p>
                                    <p className="text-sm text-muted-foreground mb-4">Desbloquea esta experiencia</p>
                                    <Button
                                        size="sm"
                                        onClick={() => navigate("/register")}
                                        className="bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 text-white shadow-md"
                                    >
                                        Obtener Acceso
                                    </Button>
                                </div>
                            )}

                            <CardHeader className="text-center space-y-4">
                                <div className="flex justify-center">
                                    <div className={`w-16 h-16 rounded-xl flex items-center justify-center ${game.available
                                        ? 'bg-gradient-to-br from-orange-100 to-yellow-100'
                                        : 'bg-gray-100'
                                        }`}>
                                        {game.icon}
                                    </div>
                                </div>
                                <div>
                                    <CardTitle className={`text-xl ${game.available ? 'text-foreground' : 'text-gray-500'
                                        }`}>
                                        {game.title}
                                    </CardTitle>
                                    <CardDescription className="mt-2 text-sm leading-relaxed">
                                        {game.description}
                                    </CardDescription>
                                </div>
                            </CardHeader>
                            <CardContent className="text-center">
                                <Button
                                    onClick={() => game.available && game.route && navigate(game.route)}
                                    disabled={!game.available}
                                    className={`w-full transition-all duration-200 ${game.available
                                        ? 'bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 text-white shadow-lg hover:shadow-xl'
                                        : 'bg-gray-100 text-gray-400'
                                        }`}
                                    size="lg"
                                >
                                    {game.available ? (
                                        <>
                                            <Gamepad2 className="w-4 h-4 mr-2" />
                                            ¡Jugar Demo!
                                        </>
                                    ) : (
                                        <>
                                            <Clock className="w-4 h-4 mr-2" />
                                            {game.locked ? "Versión Completa" : "Próximamente"}
                                        </>
                                    )}
                                </Button>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>
        </DemoDashboardLayout >
    );
}

function TrendingUpIcon(props: any) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
            <polyline points="17 6 23 6 23 12" />
        </svg>
    )
}
