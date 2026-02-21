import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Rocket, ChevronRight, X, Sparkles, GraduationCap } from "lucide-react";
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
        targetId: "nav-lessons",
        title: "Lecciones Divertidas",
        description: "¡Aprende sobre finanzas y emprendimiento jugando! Lecciones interactivas que te convertirán en un experto.",
        position: "right"
    },
    {
        targetId: "nav-tasks",
        title: "Misiones y Tareas",
        description: "Tus papás te dejarán misiones aquí. ¡Complétalas todas para ganar recompensas reales!",
        position: "right"
    },
    {
        targetId: "nav-savings",
        title: "Tus Ahorros",
        description: "Aquí verás crecer tu dinero. ¡Define metas como esa bici nueva o el juguete que tanto quieres!",
        position: "right"
    },
    {
        targetId: "nav-games",
        title: "Aprende Jugando",
        description: "Conviértete en un experto en negocios con juegos divertidos como tu propio puesto de limonada.",
        position: "right"
    },
    {
        targetId: "nav-banking",
        title: "Tu Banco Digital",
        description: "¡Siéntete como un adulto! Aquí tendrás tu propia tarjeta y cuenta bancaria real.",
        position: "right"
    },
    {
        targetId: "nav-store",
        title: "La Tiendita",
        description: "¡Gana monedas cumpliendo tareas y úsalas aquí para comprar cosas geniales para tu avatar!",
        position: "right"
    },
    {
        title: "¡Misión Cumplida! 🎉",
        description: "Ya conoces tu base. Ahora eres libre de explorar todo. Recuerda: ¡Sigue aprendiendo!",
        position: "center"
    }
];

const parentSteps: TourStep[] = [
    {
        title: "Bienvenido a LittleFounders",
        description: "Esta plataforma está diseñada para empoderar a los niños en su educación financiera. Aquí te mostramos cómo puedes supervisar y guiar.",
        position: "center"
    },
    {
        targetId: "nav-lessons",
        title: "Currículo Educativo",
        description: "Revisa el progreso académico. Las lecciones están diseñadas pedagógicamente para distintas edades.",
        position: "right"
    },
    {
        targetId: "nav-tasks",
        title: "Gestión de Tareas",
        description: "La herramienta principal para enseñar el valor del trabajo. Asigna tareas domésticas o retos con recompensas.",
        position: "right"
    },
    {
        targetId: "nav-savings",
        title: "Supervisión de Ahorros",
        description: "Monitorea las metas de ahorro de tus hijos. Puedes incentivar el ahorro con aportaciones extras (intereses parentales).",
        position: "right"
    },
    {
        targetId: "nav-games",
        title: "Simuladores de Negocios",
        description: "Monitorea su desempeño en los juegos de emprendimiento y utiliza los reportes para guiar su aprendizaje.",
        position: "right"
    },
    {
        targetId: "nav-banking",
        title: "Control Parental Bancario",
        description: "Define límites de gasto, bloquea tarjetas y monitorea transacciones en tiempo real.",
        position: "right"
    },
    {
        targetId: "nav-store",
        title: "Control de Recompensas",
        description: "Configura qué pueden 'comprar' con sus puntos. Desde tiempo en pantalla hasta salidas especiales.",
        position: "right"
    },
    {
        title: "Todo Listo 🌟",
        description: "Explore libremente la plataforma. Recuerde que su rol es clave para la educación financiera de sus hijos.",
        position: "center"
    }
];

export function UserTour() {
    const [currentStep, setCurrentStep] = useState(0);
    const [isOpen, setIsOpen] = useState(false);
    const [userRole, setUserRole] = useState<'child' | 'parent'>('child'); // Default to child just in case
    const [coords, setCoords] = useState({ top: 0, left: 0, arrowTop: 60 });
    const [userKey, setUserKey] = useState("userTourCompleted");

    // Initialize user data
    useEffect(() => {
        try {
            const user = JSON.parse(localStorage.getItem('user') || '{}');
            if (user && (user.public_id || user.id)) {
                setUserKey(`userTourCompleted_${user.public_id || user.id}`);
            }
            // Logic updated: Universal user gets Child tour
            if (user.user_type === 'child' || user.user_type === 'universal') {
                setUserRole('child');
            } else {
                setUserRole('parent');
            }
        } catch (e) {
            console.error("Error reading user from localStorage", e);
        }
    }, [isOpen]); // Check role when opening too, in case login changed without full reload (unlikely but safe)

    // Handle Auto-start and Restart
    useEffect(() => {
        // Define key to avoid closure stale state, though effect deps should handle it
        let currentKey = "userTourCompleted";
        try {
            const user = JSON.parse(localStorage.getItem('user') || '{}');
            if (user && (user.public_id || user.id)) currentKey = `userTourCompleted_${user.public_id || user.id}`;
        } catch (e) { }

        // Auto-start check - Only for UNIVERSAL users
        const completed = localStorage.getItem(currentKey);

        let isUniversal = false;
        try {
            const user = JSON.parse(localStorage.getItem('user') || '{}');
            if (user.user_type === 'universal') isUniversal = true;
        } catch (e) { }

        if (!completed && isUniversal) {
            const timer = setTimeout(() => setIsOpen(true), 1000);
            return () => clearTimeout(timer);
        }

        // Listener
        const handleRestart = () => {
            console.log("Reiniciando tutorial usuario...");
            // Re-read role just to be sure
            try {
                const user = JSON.parse(localStorage.getItem('user') || '{}');
                if (user.user_type === 'child') setUserRole('child');
                else setUserRole('parent');
            } catch (e) { }

            setIsOpen(true);
            setCurrentStep(0);
            localStorage.removeItem(currentKey);
        };

        window.addEventListener('restartUserTour', handleRestart);
        return () => window.removeEventListener('restartUserTour', handleRestart);
    }, []);

    const activeSteps = userRole === 'child' ? childSteps : parentSteps;

    useEffect(() => {
        if (!isOpen) return;

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
    }, [currentStep, isOpen, userRole]);

    const handleNext = () => {
        if (currentStep < activeSteps.length - 1) {
            setCurrentStep(currentStep + 1);
        } else {
            handleClose();
        }
    };

    const handleClose = () => {
        setIsOpen(false);
        localStorage.setItem(userKey, "true");
    };

    if (!isOpen) return null;

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
                                    userRole === 'child' ? <Rocket className="w-8 h-8 text-orange-500 animate-bounce" /> : <GraduationCap className="w-8 h-8 text-orange-500" />
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
