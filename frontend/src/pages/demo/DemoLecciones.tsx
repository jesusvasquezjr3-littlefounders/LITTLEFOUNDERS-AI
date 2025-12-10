import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { DemoDashboardLayout } from "@/components/demo/DemoDashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Link } from "react-router-dom";
import { LessonPath } from "@/components/lessons/LessonPath"; // Use the shared LessonPath component
import { Button } from "@/components/ui/button";
import {
    Calendar,
    Coins,
    Users,
    Package,
    Star,
    Search,
    PiggyBank,
    Trophy
} from "lucide-react";

export function DemoLecciones() {
    const navigate = useNavigate();
    const [showLockedDialog, setShowLockedDialog] = useState(false);

    // Hardcoded demo modules formatted for LessonPath
    const demoModules = [
        {
            id: "1.1",
            title: "¿Qué es el Dinero?",
            description: "Identificación de monedas y billetes, comprensión de valores básicos",
            duration: "30 min",
            difficulty: "Fácil" as const,
            progress: 0,
            completed: false,
            locked: false,
            icon: Coins,
            activities: ["Conceptos básicos"]
        },
        {
            id: "1.2",
            title: "De Dónde Viene el Dinero",
            description: "Introducción al concepto de trabajo y recompensas",
            duration: "25 min",
            difficulty: "Fácil" as const,
            progress: 0,
            completed: false,
            locked: true, // Locked for demo
            icon: Users,
            activities: ["Trabajo", "Ingresos"]
        },
        {
            id: "1.3",
            title: "Necesidades vs Deseos",
            description: "Diferenciación básica entre lo que necesitamos y queremos",
            duration: "35 min",
            difficulty: "Fácil" as const,
            progress: 0,
            completed: false,
            locked: true,
            icon: Package,
            activities: ["Prioridades"]
        },
        {
            id: "2.1",
            title: "Tareas y Mesada",
            description: "Formas amigables de ganar dinero a su edad",
            duration: "35 min",
            difficulty: "Fácil" as const,
            progress: 0,
            completed: false,
            locked: true,
            icon: Star,
            activities: ["Responsabilidad"]
        },
        {
            id: "2.2",
            title: "Decisiones Inteligentes",
            description: "Tomar decisiones inteligentes al momento de comprar",
            duration: "40 min",
            difficulty: "Intermedio" as const,
            progress: 0,
            completed: false,
            locked: true,
            icon: Search,
            activities: ["Decisión"]
        },
        {
            id: "2.3",
            title: "El Ahorro",
            description: "Introducción amigable al concepto de ahorro",
            duration: "45 min",
            difficulty: "Intermedio" as const,
            progress: 0,
            completed: false,
            locked: true,
            icon: PiggyBank,
            activities: ["Ahorro"]
        },
        {
            id: "2.4",
            title: "Mis Primeras Metas",
            description: "Establecer objetivos de ahorro realistas",
            duration: "50 min",
            difficulty: "Intermedio" as const,
            progress: 0,
            completed: false,
            locked: true,
            icon: Trophy,
            activities: ["Metas"]
        }
    ];

    const handleModuleClick = (module: any) => {
        if (module.locked) {
            setShowLockedDialog(true);
        } else {
            navigate("/demo/lecciones/1");
        }
    };

    return (
        <DemoDashboardLayout>
            <div className="space-y-6 mb-20">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-gray-800 mb-2">Aventura Financiera</h1>
                    <p className="text-gray-600">Completa la primera lección para ver cómo funciona</p>

                    <div className="flex justify-center mt-4">
                        <Badge variant="outline" className="px-4 py-2 bg-blue-50 text-blue-700 border-blue-200 flex items-center gap-2">
                            <Calendar className="w-4 h-4" />
                            Modo Demo: 8-10 años
                        </Badge>
                    </div>
                </div>

                {/* New Gamified Path Component */}
                <LessonPath
                    modules={demoModules}
                    onModuleClick={handleModuleClick}
                />

                {/* Coming Soon / Upsell Card at the bottom handled by LessonPath (built-in footer) or we add specific demo upsell here */}
                <div className="mt-12 text-center max-w-2xl mx-auto">
                    <Card className="bg-gradient-to-r from-purple-100 to-blue-100 border-purple-200 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-10">
                            <Trophy className="w-24 h-24" />
                        </div>
                        <CardContent className="p-8 relative z-10">
                            <h3 className="text-2xl font-bold text-purple-900 mb-2"> ¿Te gusta lo que ves?</h3>
                            <p className="text-purple-700 mb-6">
                                Desbloquea el camino completo de aprendizaje y todas las aventuras financieras registrándote hoy.
                            </p>
                            <Link to="/register">
                                <Button size="lg" className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
                                    ¡Comenzar Aventura Completa! 🚀
                                </Button>
                            </Link>
                        </CardContent>
                    </Card>
                </div>

                {/* Dialog for locked content */}
                <Dialog open={showLockedDialog} onOpenChange={setShowLockedDialog}>
                    <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                            <DialogTitle className="text-center text-2xl">🔒 Contenido Bloqueado</DialogTitle>
                            <DialogDescription className="text-center pt-4 text-lg">
                                Esta lección forma parte del programa completo.
                                <br /><br />
                                ¡Regístrate ahora para desbloquear todo el mapa de aventuras financieras!
                            </DialogDescription>
                        </DialogHeader>
                        <DialogFooter className="flex flex-col sm:flex-row gap-2 mt-4">
                            <Button variant="outline" onClick={() => setShowLockedDialog(false)}>
                                Seguir Explorando
                            </Button>
                            <Button asChild className="bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600">
                                <Link to="/register">Crear Cuenta Gratis</Link>
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </DemoDashboardLayout>
    );
}
