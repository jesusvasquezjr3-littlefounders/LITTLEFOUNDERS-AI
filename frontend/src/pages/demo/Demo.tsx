import { DemoDashboardLayout } from "@/components/demo/DemoDashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    BookOpen,
    Clock,
    Star,
    Zap,
    Lightbulb,
    CreditCard
} from "lucide-react";
import { Link } from "react-router-dom";

export default function Demo() {
    const currentStreak = 5;

    const stats = [
        {
            title: "Lecciones Completadas",
            value: 1,
            icon: BookOpen,
            color: "text-blue-600",
            bgColor: "bg-blue-100",
            description: "¡Sigue así!"
        },
        {
            title: "Minutos Estudiados",
            value: 15,
            icon: Clock,
            color: "text-green-600",
            bgColor: "bg-green-100",
            description: "Tiempo bien invertido"
        },
        {
            title: "Puntos Ganados",
            value: 50,
            icon: Star,
            color: "text-yellow-600",
            bgColor: "bg-yellow-100",
            description: "¡Eres un experto!"
        },
        {
            title: "Racha Actual",
            value: currentStreak,
            icon: Zap,
            color: "text-purple-600",
            bgColor: "bg-purple-100",
            description: "¡Días seguidos!"
        }
    ];

    return (
        <DemoDashboardLayout>
            <div className="space-y-6">
                {/* Welcome Header */}
                <div className="text-center space-y-2">
                    <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                        ¡Hola, Explorador! 👋
                    </h1>
                    <p className="text-lg text-muted-foreground">
                        ¡Bienvenido a la versión DEMO de Little Founders!
                    </p>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {stats.map((stat, index) => (
                        <Card key={index} className="border-2 border-transparent hover:border-primary/20 transition-all">
                            <CardContent className="p-6">
                                <div className="flex items-center space-x-4">
                                    <div className={`p-3 rounded-full ${stat.bgColor}`}>
                                        <stat.icon className={`h-6 w-6 ${stat.color}`} />
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-sm font-medium text-muted-foreground">{stat.title}</p>
                                        <p className="text-2xl font-bold">{stat.value}</p>
                                        <p className="text-xs text-muted-foreground">{stat.description}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                <div className="grid grid-cols-1 gap-6">
                    {/* Quick Links to Demo Features */}
                    <Card className="bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200">
                        <CardHeader>
                            <CardTitle className="flex items-center space-x-2 text-purple-800">
                                <Star className="h-5 w-5" />
                                <span>Explora las Funcionalidades</span>
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <Button asChild className="h-32 bg-white hover:bg-gray-50 text-black border-2 border-blue-200 hover:border-blue-400 shadow-sm group">
                                    <Link to="/demo/lecciones" className="flex flex-col items-center justify-center space-y-2">
                                        <div className="p-3 bg-blue-100 rounded-full group-hover:bg-blue-200 transition-colors">
                                            <BookOpen className="h-8 w-8 text-blue-600" />
                                        </div>
                                        <span className="font-bold text-lg">Lecciones Interactivas</span>
                                        <span className="text-xs text-gray-500">Aprende jugando</span>
                                    </Link>
                                </Button>
                                <Button asChild className="h-32 bg-white hover:bg-gray-50 text-black border-2 border-orange-200 hover:border-orange-400 shadow-sm group">
                                    <Link to="/demo/lemonade-stand" className="flex flex-col items-center justify-center space-y-2">
                                        <div className="p-3 bg-orange-100 rounded-full group-hover:bg-orange-200 transition-colors">
                                            <Lightbulb className="h-8 w-8 text-orange-600" />
                                        </div>
                                        <span className="font-bold text-lg">Puesto de Limonada</span>
                                        <span className="text-xs text-gray-500">Simulador de Negocios</span>
                                    </Link>
                                </Button>
                                <Button asChild className="h-32 bg-white hover:bg-gray-50 text-black border-2 border-green-200 hover:border-green-400 shadow-sm group">
                                    <Link to="/demo/card" className="flex flex-col items-center justify-center space-y-2">
                                        <div className="p-3 bg-green-100 rounded-full group-hover:bg-green-200 transition-colors">
                                            <CreditCard className="h-8 w-8 text-green-600" />
                                        </div>
                                        <span className="font-bold text-lg">Tarjeta Virtual</span>
                                        <span className="text-xs text-gray-500">Personaliza tu tarjeta</span>
                                    </Link>
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </DemoDashboardLayout>
    );
}
