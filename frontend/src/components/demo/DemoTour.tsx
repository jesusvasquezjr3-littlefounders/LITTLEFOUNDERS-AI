import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Rocket, ChevronRight, X, CheckCircle2, Sparkles, User, GraduationCap } from "lucide-react";
import { cn } from "@/lib/utils";

interface TourStep {
    targetId?: string;
    title: string;
    description: string;
    position?: "right" | "bottom" | "center";
}

const childSteps: TourStep[] = [
    {
        title: "¡Bienvenido a LittleFounders! 🚀",
        description: "Estás a punto de iniciar una misión especial. Vamos a explorar tu nuevo centro de comando financiero.",
        position: "center"
    },
    {
        targetId: "demo-nav-lessons",
        title: "Lecciones Divertidas",
        description: "¡Aprende sobre finanzas y emprendimiento jugando! Lecciones interactivas que te convertirán en un experto.",
        position: "right"
    },
    {
        targetId: "demo-nav-tasks",
        title: "Misiones y Tareas",
        description: "Tus papás te dejarán misiones aquí. ¡Complétalas todas para ganar recompensas reales!",
        position: "right"
    },
    {
        targetId: "demo-nav-savings",
        title: "Tus Ahorros",
        description: "Aquí verás crecer tu dinero. ¡Define metas como esa bici nueva o el juguete que tanto quieres!",
        position: "right"
    },
    {
        targetId: "demo-nav-games",
        title: "Aprende Jugando",
        description: "Conviértete en un experto en negocios con juegos divertidos como tu propio puesto de limonada.",
        position: "right"
    },
    {
        targetId: "demo-nav-banking",
        title: "Tu Banco Digital",
        description: "¡Siéntete como un adulto! Aquí tendrás tu propia tarjeta y cuenta bancaria real.",
        position: "right"
    },
    {
        targetId: "demo-nav-store",
        title: "La Tiendita",
        description: "¡Gana monedas cumpliendo tareas y úsalas aquí para comprar cosas geniales para tu avatar!",
        position: "right"
    },
    {
        title: "¡Misión Cumplida! 🎉",
        description: "Ya conoces tu base. Ahora eres libre de explorar todo. Recuerda: ¡Regístrate para guardar tu progreso!",
        position: "center"
    }
];

const tutorSteps: TourStep[] = [
    {
        title: "Bienvenido a LittleFounders - Modo Tutor 🎓",
        description: "Esta plataforma está diseñada para empoderar a los niños en su educación financiera. Aquí te mostramos cómo puedes supervisar y guiar.",
        position: "center"
    },
    {
        targetId: "demo-nav-lessons",
        title: "Currículo Educativo",
        description: "Revisa el progreso académico. Las lecciones están diseñadas pedagógicamente para distintas edades.",
        position: "right"
    },
    {
        targetId: "demo-nav-tasks",
        title: "Asignación de Tareas",
        description: "La herramienta principal para enseñar el valor del trabajo. Asigna tareas domésticas o retos con recompensas reales o virtuales.",
        position: "right"
    },
    {
        targetId: "demo-nav-savings",
        title: "Supervisión de Ahorros",
        description: "Monitorea las metas de ahorro de tus hijos. Puedes incentivar el ahorro con aportaciones extras (intereses parentales).",
        position: "right"
    },
    {
        targetId: "demo-nav-games",
        title: "Simuladores de Negocios",
        description: "Espacios seguros donde pueden fallar y aprender. Simulaciones de emprendimiento sin riesgo real.",
        position: "right"
    },
    {
        targetId: "demo-nav-banking",
        title: "Control Parental Bancario",
        description: "Define límites de gasto, bloquea tarjetas y monitorea transacciones en tiempo real.",
        position: "right"
    },
    {
        targetId: "demo-nav-store",
        title: "Control de Recompensas",
        description: "Configura qué pueden 'comprar' con sus puntos. Desde tiempo en pantalla hasta salidas especiales.",
        position: "right"
    },
    {
        title: "Todo Listo 🌟",
        description: "Ha recorrido las funciones clave. Explore libremente la plataforma para ver el potencial educativo.",
        position: "center"
    }
];

export function DemoTour() {
    const [currentStep, setCurrentStep] = useState(0);
    const [isOpen, setIsOpen] = useState(false);
    const [role, setRole] = useState<'child' | 'tutor' | null>(null);
    const [coords, setCoords] = useState({ top: 0, left: 0, arrowTop: 60 });

    useEffect(() => {
        // En un escenario real podríamos persistir esto, pero para el demo
        // queremos que siempre pregunten o al menos permitan reiniciar fácil
        const completed = localStorage.getItem("demoTourCompleted");

        if (!completed) {
            const timer = setTimeout(() => setIsOpen(true), 1000);
            return () => clearTimeout(timer);
        }

        const handleRestart = () => {
            setIsOpen(true);
            setCurrentStep(0);
            setRole(null); // Reset role on restart
            localStorage.removeItem("demoTourCompleted");
        };

        window.addEventListener('restartDemoTour', handleRestart);
        return () => window.removeEventListener('restartDemoTour', handleRestart);
    }, []);

    const activeSteps = role === 'tutor' ? tutorSteps : childSteps;

    useEffect(() => {
        if (!isOpen || !role) return;

        const step = activeSteps[currentStep];
        if (step.targetId) {
            const element = document.getElementById(step.targetId);
            if (element) {
                const rect = element.getBoundingClientRect();
                const viewportHeight = window.innerHeight;
                const cardHeight = 300;
                const arrowOffsetBase = 60;

                let top = rect.top + (rect.height / 2) - arrowOffsetBase;

                if (top + cardHeight > viewportHeight - 20) {
                    top = viewportHeight - cardHeight - 20;
                }

                if (top < 20) {
                    top = 20;
                }

                const arrowTop = (rect.top + (rect.height / 2)) - top;

                setCoords({
                    top,
                    left: rect.right + 20,
                    arrowTop
                });

                element.classList.add('ring-2', 'ring-primary', 'ring-offset-2', 'bg-accent');

                return () => {
                    element.classList.remove('ring-2', 'ring-primary', 'ring-offset-2', 'bg-accent');
                };
            }
        }
    }, [currentStep, isOpen, role]);

    const handleNext = () => {
        if (currentStep < activeSteps.length - 1) {
            setCurrentStep(currentStep + 1);
        } else {
            handleClose();
        }
    };

    const handleClose = () => {
        setIsOpen(false);
        localStorage.setItem("demoTourCompleted", "true");
    };

    const handleRoleSelect = (selectedRole: 'child' | 'tutor') => {
        setRole(selectedRole);
        setCurrentStep(0);
    };

    if (!isOpen) return null;

    // --- RENDER ROLE SELECTION ---
    if (!role) {
        return (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
                <Card className="w-[400px] p-8 shadow-2xl border-2 border-white/50 bg-white/95 relative overflow-hidden text-center space-y-6">
                    <div className="space-y-2">
                        <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                            ¡Hola! ¿Quién eres?
                        </h2>
                        <p className="text-muted-foreground">
                            Selecciona tu perfil para personalizar tu experiencia
                        </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <button
                            onClick={() => handleRoleSelect('child')}
                            className="group relative flex flex-col items-center p-4 rounded-xl border-2 border-transparent bg-blue-50 hover:bg-blue-100 hover:border-blue-500 transition-all duration-300 transform hover:-translate-y-1"
                        >
                            <div className="w-16 h-16 bg-blue-200 rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                                <Rocket className="w-8 h-8 text-blue-600" />
                            </div>
                            <span className="font-bold text-blue-900">Soy niño</span>
                            <span className="text-xs text-blue-600 mt-1">¡Quiero jugar!</span>
                        </button>

                        <button
                            onClick={() => handleRoleSelect('tutor')}
                            className="group relative flex flex-col items-center p-4 rounded-xl border-2 border-transparent bg-orange-50 hover:bg-orange-100 hover:border-orange-500 transition-all duration-300 transform hover:-translate-y-1"
                        >
                            <div className="w-16 h-16 bg-orange-200 rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                                <GraduationCap className="w-8 h-8 text-orange-600" />
                            </div>
                            <span className="font-bold text-orange-900">Soy Tutor</span>
                            <span className="text-xs text-orange-600 mt-1">Quiero supervisar</span>
                        </button>
                    </div>

                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleClose}
                        className="text-muted-foreground hover:text-foreground"
                    >
                        Saltar introducción
                    </Button>
                </Card>
            </div>
        );
    }

    // --- RENDER TOUR STEPS ---
    const step = activeSteps[currentStep];
    const isCenter = step.position === "center";

    return (
        <div className="fixed inset-0 z-[100] pointer-events-none">
            {isCenter && (
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm pointer-events-auto transition-opacity duration-500" />
            )}

            <div
                className={cn(
                    "absolute transition-all duration-500 ease-in-out pointer-events-auto",
                    isCenter
                        ? "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
                        : "transition-[top,left]"
                )}
                style={!isCenter ? { top: `${coords.top}px`, left: `${coords.left}px` } : {}}
            >
                <Card className={cn(
                    "w-[320px] p-6 shadow-2xl border-2 relative overflow-hidden",
                    isCenter ? "text-center border-primary/20 scale-110" : "border-primary animate-in fade-in slide-in-from-left-4"
                )}>
                    {/* Background decoration */}
                    <div className="absolute -top-10 -right-10 w-32 h-32 bg-primary/10 rounded-full blur-3xl" />
                    <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-yellow-500/10 rounded-full blur-3xl" />

                    <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-2 right-2 h-6 w-6 text-muted-foreground hover:text-foreground"
                        onClick={handleClose}
                    >
                        <X className="w-4 h-4" />
                    </Button>

                    <div className="relative z-10">
                        <div className={cn("mb-4 flex", isCenter ? "justify-center" : "justify-start")}>
                            <div className="p-3 bg-gradient-to-br from-orange-100 to-yellow-100 rounded-full shadow-sm">
                                {currentStep === 0 ? (
                                    role === 'child' ? <Rocket className="w-8 h-8 text-orange-500 animate-bounce" /> : <GraduationCap className="w-8 h-8 text-orange-500" />
                                ) : currentStep === activeSteps.length - 1 ? (
                                    <Sparkles className="w-8 h-8 text-yellow-500 animate-pulse" />
                                ) : (
                                    <span className="text-xl font-bold text-orange-600 w-8 h-8 flex items-center justify-center">
                                        {currentStep}
                                    </span>
                                )}
                            </div>
                        </div>

                        <h3 className="text-xl font-bold mb-2 bg-gradient-to-r from-orange-600 to-yellow-600 bg-clip-text text-transparent">
                            {step.title}
                        </h3>
                        <p className="text-muted-foreground mb-6 text-sm leading-relaxed">
                            {step.description}
                        </p>

                        <div className="flex items-center justify-between">
                            <div className="flex gap-1">
                                {activeSteps.map((_, idx) => (
                                    <div
                                        key={idx}
                                        className={cn(
                                            "w-2 h-2 rounded-full transition-colors duration-300",
                                            idx === currentStep ? "bg-primary" : "bg-muted"
                                        )}
                                    />
                                ))}
                            </div>
                            <Button onClick={handleNext} size="sm" className="bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 text-white shadow-md group">
                                {currentStep === activeSteps.length - 1 ? "¡Empezar!" : "Siguiente"}
                                {currentStep !== activeSteps.length - 1 && (
                                    <ChevronRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                                )}
                            </Button>
                        </div>
                    </div>

                    {!isCenter && (
                        <div
                            className="absolute -left-2 w-4 h-4 bg-background border-l-2 border-b-2 border-primary transform rotate-45 transition-[top] duration-300"
                            style={{ top: `${coords.arrowTop}px` }}
                        />
                    )}
                </Card>
            </div>
        </div>
    );
}
