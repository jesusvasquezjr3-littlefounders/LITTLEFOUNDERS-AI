import { useState, useEffect } from "react";
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
    Trophy
} from "lucide-react";

export function DemoLecciones() {
    const navigate = useNavigate();
    const [showLockedDialog, setShowLockedDialog] = useState(false);
    const [lesson1Completed, setLesson1Completed] = useState(false);
    const [lesson2Completed, setLesson2Completed] = useState(false);
    const [lesson3Completed, setLesson3Completed] = useState(false);
    const [lesson4Completed, setLesson4Completed] = useState(false);

    useEffect(() => {
        setLesson1Completed(localStorage.getItem('demo_lesson_1_completed') === 'true');
        setLesson2Completed(localStorage.getItem('demo_lesson_2_completed') === 'true');
        setLesson3Completed(localStorage.getItem('demo_lesson_3_completed') === 'true');
        setLesson4Completed(localStorage.getItem('demo_lesson_4_completed') === 'true');
    }, []);

    // Hardcoded demo modules formatted for LessonPath
    const demoModules = [
        {
            id: "1",
            title: "¿Qué es el Dinero?",
            description: "Del trueque al dinero",
            duration: "30 min",
            difficulty: "Fácil" as const,
            progress: lesson1Completed ? 100 : 0,
            completed: lesson1Completed,
            locked: false,
            icon: Coins,
            activities: ["Conceptos básicos"]
        },
        {
            id: "2",
            title: "De Dónde Viene el Dinero",
            description: "Introducción al concepto del dinero",
            duration: "25 min",
            difficulty: "Fácil" as const,
            progress: lesson2Completed ? 100 : 0,
            completed: lesson2Completed,
            locked: !lesson1Completed, // Unlocks if L1 is done
            icon: Users,
            activities: ["Trabajo", "Ingresos"]
        },
        {
            id: "3",
            title: "Necesidades vs Deseos",
            description: "Diferenciación básica",
            duration: "35 min",
            difficulty: "Fácil" as const,
            progress: lesson3Completed ? 100 : 0,
            completed: lesson3Completed,
            locked: !lesson2Completed,
            icon: Package,
            activities: ["Prioridades"]
        },
        {
            id: "4",
            title: "¡Ganando mis Monedas!",
            description: "El valor del esfuerzo y la colaboración",
            duration: "35 min",
            difficulty: "Fácil" as const,
            progress: lesson4Completed ? 100 : 0,
            completed: lesson4Completed,
            locked: !lesson3Completed,
            icon: Star,
            activities: ["Responsabilidad", "Creatividad"]
        },

        {
            id: "5",
            title: "Decisiones Inteligentes",
            description: "Tomar decisiones inteligentes al momento de comprar",
            duration: "40 min",
            difficulty: "Intermedio" as const,
            progress: 0,
            completed: false,
            locked: !lesson4Completed,
            icon: Search,
            activities: ["Decisión"]
        }
    ];

    const handleModuleClick = (module: any) => {
        if (module.locked) {
            setShowLockedDialog(true);
        } else if (module.id === "1") {
            navigate("/demo/lecciones/1");
        } else if (module.id === "2") {
            navigate("/demo/lecciones/2");
        } else if (module.id === "3") {
            navigate("/demo/lecciones/3");
        } else if (module.id === "4") {
            navigate("/demo/lecciones/4");
        } else if (module.id === "5") {
            navigate("/demo/lecciones/5"); // Navigate to the new lesson
        }
    };

    return (
        <DemoDashboardLayout>
            <div className="space-y-6 mb-20">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-gray-800 mb-2">Aventura Financiera</h1>
                    <p className="text-gray-600">Completa la primera lección para ver cómo funciona</p>
                </div>

                {/* New Gamified Path Component */}
                <LessonPath
                    modules={demoModules}
                    onModuleClick={handleModuleClick}
                />

                {/* Coming Soon / Upsell Card at the bottom handled by LessonPath (built-in footer) or we add specific demo upsell here */}
                {/* Scribd-style Blurred Paywall */}
                {/* Scribd-style Blurred Paywall */}
                {/* Scribd-style Blurred Paywall */}
                <div className="relative mt-0 -top-24 text-center max-w-2xl mx-auto h-[900px] flex items-center justify-center overflow-hidden">

                    {/* Background Nodes - Layer 0 - Explicit Colors and Animation */}
                    <div className="absolute inset-0 z-0 select-none pointer-events-none w-full h-full">
                        <div className="flex flex-col items-center space-y-12 pt-12 w-full h-full">
                            {/* Line connecting them */}
                            <div className="absolute top-12 bottom-0 left-1/2 w-2 border-l-4 border-dashed border-gray-200 -translate-x-1/2 h-full -z-10 opacity-30"></div>

                            {/* Fake Lesson Nodes - Sequence continues after Index 4 (Center) -> Index 5 (Left) -> Index 6 (Center) -> Index 7 (Right) */}

                            {/* Node 1: LEFT (-translate-x-24) */}
                            <div className="relative transform -translate-x-12 md:-translate-x-24 transition-all duration-1000">
                                <div className="w-24 h-24 rounded-full bg-indigo-300 border-8 border-indigo-100 flex items-center justify-center shadow-xl animate-pulse">
                                    <div className="w-12 h-12 bg-indigo-500 rounded-full opacity-50" />
                                </div>
                            </div>

                            {/* Node 2: CENTER (0) */}
                            <div className="relative transform translate-x-0 transition-all duration-1000 delay-100">
                                <div className="w-24 h-24 rounded-full bg-yellow-300 border-8 border-yellow-100 flex items-center justify-center shadow-xl animate-pulse">
                                    <div className="w-12 h-12 bg-yellow-500 rounded-full opacity-50" />
                                </div>
                            </div>

                            {/* Node 3: RIGHT (translate-x-24) */}
                            <div className="relative transform translate-x-12 md:translate-x-24 transition-all duration-1000 delay-200">
                                <div className="w-24 h-24 rounded-full bg-pink-300 border-8 border-pink-100 flex items-center justify-center shadow-xl animate-pulse">
                                    <div className="w-12 h-12 bg-pink-500 rounded-full opacity-50" />
                                </div>
                            </div>

                            {/* Node 4: CENTER (0) */}
                            <div className="relative transform translate-x-0 transition-all duration-1000 delay-300">
                                <div className="w-20 h-20 rounded-full bg-green-300 border-8 border-green-100 flex items-center justify-center shadow-xl animate-pulse">
                                    <div className="w-10 h-10 bg-green-500 rounded-full opacity-50" />
                                </div>
                            </div>

                            {/* Node 5: LEFT */}
                            <div className="relative transform -translate-x-12 md:-translate-x-24 transition-all duration-1000 delay-500">
                                <div className="w-24 h-24 rounded-full bg-blue-300 border-8 border-blue-100 flex items-center justify-center shadow-xl animate-pulse">
                                    <div className="w-12 h-12 bg-blue-500 rounded-full opacity-50" />
                                </div>
                            </div>

                            {/* Node 6: CENTER */}
                            <div className="relative transform translate-x-0 transition-all duration-1000 delay-700">
                                <div className="w-20 h-20 rounded-full bg-purple-300 border-8 border-purple-100 flex items-center justify-center shadow-xl animate-pulse">
                                    <div className="w-10 h-10 bg-purple-500 rounded-full opacity-50" />
                                </div>
                            </div>

                            {/* Node 7: RIGHT */}
                            <div className="relative transform translate-x-12 md:translate-x-24 transition-all duration-1000 delay-900">
                                <div className="w-24 h-24 rounded-full bg-orange-300 border-8 border-orange-100 flex items-center justify-center shadow-xl animate-pulse">
                                    <div className="w-12 h-12 bg-orange-500 rounded-full opacity-50" />
                                </div>
                            </div>

                            {/* Node 8: CENTER */}
                            <div className="relative transform translate-x-0 transition-all duration-1000 delay-1000">
                                <div className="w-24 h-24 rounded-full bg-teal-300 border-8 border-teal-100 flex items-center justify-center shadow-xl animate-pulse">
                                    <div className="w-12 h-12 bg-teal-500 rounded-full opacity-50" />
                                </div>
                            </div>

                            {/* Node 9: LEFT */}
                            <div className="relative transform -translate-x-12 md:-translate-x-24 transition-all duration-1000 delay-1100">
                                <div className="w-20 h-20 rounded-full bg-red-300 border-8 border-red-100 flex items-center justify-center shadow-xl animate-pulse">
                                    <div className="w-10 h-10 bg-red-500 rounded-full opacity-50" />
                                </div>
                            </div>

                            {/* Node 10: CENTER */}
                            <div className="relative transform translate-x-0 transition-all duration-1000 delay-1200">
                                <div className="w-24 h-24 rounded-full bg-indigo-200 border-8 border-indigo-50 flex items-center justify-center shadow-xl animate-pulse">
                                    <div className="w-12 h-12 bg-indigo-500 rounded-full opacity-50" />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Gradient Overlay to fade them out at the bottom */}
                    <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-slate-50 to-transparent z-10 pointer-events-none"></div>

                    {/* Paywall Card - Layer 20 - Transparent BG */}
                    <div className="relative z-20 px-4 w-full max-w-md">
                        <div className="bg-white/40 backdrop-blur-md p-8 rounded-3xl shadow-2xl border border-white/60 mx-auto">
                            <div className="w-12 h-12 bg-white/80 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
                                <Trophy className="w-6 h-6 text-indigo-600" />
                            </div>
                            <h3 className="text-xl font-bold text-gray-900 mb-2 drop-shadow-sm">¡Continúa tu Aventura!</h3>
                            <p className="text-gray-700 mb-6 text-sm font-medium drop-shadow-sm" style={{ textShadow: "0 1px 1px rgba(255,255,255,0.8)" }}>
                                Regístrate gratis para desbloquear el resto de las lecciones, minijuegos y recompensas.
                            </p>

                            <Link to="/register">
                                <Button size="lg" className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold py-6 rounded-xl shadow-lg hover:shadow-xl hover:scale-105 transition-all">
                                    Registrarse Gratis ✨
                                </Button>
                            </Link>

                            <p className="text-[10px] text-gray-500 mt-4 font-bold uppercase tracking-wide">
                                No se requiere Tarjeta de Crédito para seguir disfrutando
                            </p>
                        </div>
                    </div>
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
