import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Rocket, ChevronRight, X, CheckCircle2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface TourStep {
    targetId?: string;
    title: string;
    description: string;
    position?: "right" | "bottom" | "center";
}

const steps: TourStep[] = [
    {
        title: "¡Bienvenido a LittleFounders! 🚀",
        description: "Estás a punto de iniciar una misión especial. Vamos a explorar tu nuevo centro de comando financiero.",
        position: "center"
    },
    {
        targetId: "demo-nav-savings",
        title: "Tus Ahorros",
        description: "Aquí verás crecer tu dinero. ¡Define metas como esa bici nueva o el juguete que tanto quieres!",
        position: "right"
    },
    {
        targetId: "demo-nav-store",
        title: "La Tiendita",
        description: "¡Gana monedas cumpliendo tareas y úsalas aquí para comprar cosas geniales para tu avatar!",
        position: "right"
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
        title: "¡Misión Cumplida! 🎉",
        description: "Ya conoces tu base. Ahora eres libre de explorar todo. Recuerda: ¡Regístrate para guardar tu progreso!",
        position: "center"
    }
];

export function DemoTour() {
    const [currentStep, setCurrentStep] = useState(0);
    const [isOpen, setIsOpen] = useState(false);
    const [coords, setCoords] = useState({ top: 0, left: 0, arrowTop: 60 });

    useEffect(() => {
        // Check if tour was already completed
        const completed = localStorage.getItem("demoTourCompleted");
        if (!completed) {
            // Small delay to ensure UI is ready
            const timer = setTimeout(() => setIsOpen(true), 1000);
            return () => clearTimeout(timer);
        }

        // Listen for restart event
        const handleRestart = () => {
            setIsOpen(true);
            setCurrentStep(0);
            localStorage.removeItem("demoTourCompleted");
        };

        window.addEventListener('restartDemoTour', handleRestart);
        return () => window.removeEventListener('restartDemoTour', handleRestart);
    }, []);

    useEffect(() => {
        if (!isOpen) return;

        const step = steps[currentStep];
        if (step.targetId) {
            const element = document.getElementById(step.targetId);
            if (element) {
                const rect = element.getBoundingClientRect();
                const viewportHeight = window.innerHeight;
                const cardHeight = 300; // Approximate height
                const arrowOffsetBase = 60; // Where the arrow is normally located relative to card top

                // Calculate ideal top to center the arrow on the element
                let top = rect.top + (rect.height / 2) - arrowOffsetBase;

                // Clamp top to prevent going off screen bottom
                // Leave 20px margin
                if (top + cardHeight > viewportHeight - 20) {
                    top = viewportHeight - cardHeight - 20;
                }

                // Clamp top to prevent going off screen top
                if (top < 20) {
                    top = 20;
                }

                // Calculate where the arrow should be to point to the element
                // Arrow Y relative to card = Element Center Y - Card Top
                const arrowTop = (rect.top + (rect.height / 2)) - top;

                setCoords({
                    top,
                    left: rect.right + 20, // Offset to the right
                    arrowTop
                });

                // Add highlight class
                element.classList.add('ring-2', 'ring-primary', 'ring-offset-2', 'bg-accent');

                // Cleanup function to remove highlight
                return () => {
                    element.classList.remove('ring-2', 'ring-primary', 'ring-offset-2', 'bg-accent');
                };
            }
        }
    }, [currentStep, isOpen]);

    const handleNext = () => {
        if (currentStep < steps.length - 1) {
            setCurrentStep(currentStep + 1);
        } else {
            handleClose();
        }
    };

    const handleClose = () => {
        setIsOpen(false);
        localStorage.setItem("demoTourCompleted", "true");
    };

    if (!isOpen) return null;

    const step = steps[currentStep];
    const isCenter = step.position === "center";

    return (
        <div className="fixed inset-0 z-[100] pointer-events-none">
            {/* Backdrop for center steps */}
            {isCenter && (
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm pointer-events-auto transition-opacity duration-500" />
            )}

            {/* Tour Card */}
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

                    {/* Close button */}
                    <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-2 right-2 h-6 w-6 text-muted-foreground hover:text-foreground"
                        onClick={handleClose}
                    >
                        <X className="w-4 h-4" />
                    </Button>

                    {/* Content */}
                    <div className="relative z-10">
                        <div className={cn("mb-4 flex", isCenter ? "justify-center" : "justify-start")}>
                            <div className="p-3 bg-gradient-to-br from-orange-100 to-yellow-100 rounded-full shadow-sm">
                                {currentStep === 0 ? (
                                    <Rocket className="w-8 h-8 text-orange-500 animate-bounce" />
                                ) : currentStep === steps.length - 1 ? (
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
                                {steps.map((_, idx) => (
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
                                {currentStep === steps.length - 1 ? "¡Empezar!" : "Siguiente"}
                                {currentStep !== steps.length - 1 && (
                                    <ChevronRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                                )}
                            </Button>
                        </div>
                    </div>

                    {/* Arrow for non-center steps */}
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
