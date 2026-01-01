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
            lottieSrc: "https://lottie.host/fd6ae247-34b4-4c56-9b11-f2f3687210a5/ydEAxkmQs0.lottie",
            color: "text-blue-600",
            bgColor: "bg-blue-50",
            description: "¡Sigue así!"
        },
        {
            title: "Minutos Estudiados",
            value: 15,
            lottieSrc: "https://lottie.host/1452b96d-4f8d-4b34-b1ed-88a5e16ff3c3/oM0u7NQXQy.lottie",
            color: "text-green-600",
            bgColor: "bg-green-50",
            description: "Tiempo bien invertido"
        },
        {
            title: "Puntos Ganados",
            value: 50,
            lottieSrc: "https://lottie.host/670784f8-65c7-4b8b-a506-3da5403c7a3f/bpw4bs7R0M.lottie",
            color: "text-yellow-600",
            bgColor: "bg-yellow-50",
            description: "¡Eres un experto!"
        },
        {
            title: "Racha Actual",
            value: currentStreak,
            lottieSrc: "https://lottie.host/3edaf8fb-44e9-43da-b623-1836120273cf/9pmK4xn6MU.lottie",
            color: "text-purple-600",
            bgColor: "bg-purple-50",
            description: "¡Días seguidos!"
        }
    ];

    return (
        <DemoDashboardLayout>
            <div className="space-y-6">
                {/* Welcome Header */}
                <div className="text-center space-y-2">
                    <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                        ¡Hola, Pequeño Fundador! 👋
                    </h1>
                    <p className="text-lg text-muted-foreground">
                        ¡Bienvenido a la sesión DEMO de Little Founders!
                    </p>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {stats.map((stat, index) => (
                        <Card key={index} className="border-2 border-transparent hover:border-primary/20 transition-all overflow-hidden relative">
                            <CardContent className="p-6">
                                <div className="flex flex-col items-center text-center space-y-2 relative z-10">
                                    <div className={`p-2 rounded-full ${stat.bgColor} mb-2`}>
                                        {/* @ts-ignore */}
                                        <dotlottie-wc
                                            src={stat.lottieSrc}
                                            style={{ width: '120px', height: '120px' }}
                                            autoplay
                                            loop
                                        ></dotlottie-wc>
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-muted-foreground">{stat.title}</p>
                                        <p className="text-3xl font-bold my-1">{stat.value}</p>
                                        <p className="text-xs text-muted-foreground">{stat.description}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                <div className="space-y-4">
                    <h2 className="text-2xl font-bold text-gray-800 dark:text-white px-1">Explora las Funcionalidades 🚀</h2>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Interactive Lessons Card */}
                        <Link to="/demo/lecciones" className="group relative overflow-hidden rounded-2xl transition-all duration-300 hover:scale-105 hover:shadow-xl">
                            <div className="absolute inset-0 bg-gradient-to-br from-blue-400 to-blue-600"></div>
                            <div className="relative p-6 flex flex-col items-center justify-center h-48 text-center space-y-3">
                                <div className="p-4 bg-white/20 backdrop-blur-sm rounded-full shadow-inner group-hover:scale-110 transition-transform duration-300">
                                    <BookOpen className="h-10 w-10 text-white" />
                                </div>
                                <div>
                                    <h3 className="text-2xl font-bold text-white mb-1">Aprender</h3>
                                    <p className="text-blue-100 font-medium text-sm">Lecciones Interactivas</p>
                                </div>
                            </div>
                        </Link>

                        {/* Lemonade Stand Card */}
                        <Link to="/demo/lemonade-stand" className="group relative overflow-hidden rounded-2xl transition-all duration-300 hover:scale-105 hover:shadow-xl">
                            <div className="absolute inset-0 bg-gradient-to-br from-orange-400 to-red-500"></div>
                            <div className="relative p-6 flex flex-col items-center justify-center h-48 text-center space-y-3">
                                <div className="p-4 bg-white/20 backdrop-blur-sm rounded-full shadow-inner group-hover:scale-110 transition-transform duration-300">
                                    <Lightbulb className="h-10 w-10 text-white" />
                                </div>
                                <div>
                                    <h3 className="text-2xl font-bold text-white mb-1">Emprender</h3>
                                    <p className="text-orange-100 font-medium text-sm">Puesto de Limonada</p>
                                </div>
                            </div>
                        </Link>

                        {/* Virtual Card Card */}
                        <Link to="/demo/growth" className="group relative overflow-hidden rounded-2xl transition-all duration-300 hover:scale-105 hover:shadow-xl">
                            <div className="absolute inset-0 bg-gradient-to-br from-emerald-400 to-green-600"></div>
                            <div className="relative p-6 flex flex-col items-center justify-center h-48 text-center space-y-3">
                                <div className="p-4 bg-white/20 backdrop-blur-sm rounded-full shadow-inner group-hover:scale-110 transition-transform duration-300">
                                    <CreditCard className="h-10 w-10 text-white" />
                                </div>
                                <div>
                                    <h3 className="text-2xl font-bold text-white mb-1">Tarjeta Virtual</h3>
                                    <p className="text-green-100 font-medium text-sm">Personaliza tu Tarjeta Virtual</p>
                                </div>
                            </div>
                        </Link>
                    </div>
                </div>
            </div>
        </DemoDashboardLayout>
    );
}
