import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Rocket, ChevronRight, X, Sparkles, GraduationCap } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import ZaraVexCharacter from "@/components/demo/ZaraVexCharacter";
import DrRhoCharacter from "@/components/demo/DrRhoCharacter";

interface TourStep {
    targetId?: string;
    title: string;
    description: string;
    position?: "right" | "bottom" | "center";
    mood?: any; // To hold ZaraMood or RhoMood
}

// Unused hardcoded arrays removed for i18n cleanliness

export function DemoTour() {
    const { t } = useTranslation('demo');
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

    const getChildSteps = (): TourStep[] => [
        {
            title: t('tour.child.step1.title'),
            description: t('tour.child.step1.desc'),
            position: "center",
            mood: "excited"
        },
        {
            targetId: "demo-nav-lessons",
            title: t('tour.child.step2.title'),
            description: t('tour.child.step2.desc'),
            position: "right",
            mood: "happy"
        },
        {
            targetId: "demo-nav-ai",
            title: t('tour.child.step_ai.title'),
            description: t('tour.child.step_ai.desc'),
            position: "right",
            mood: "curious"
        },
        {
            targetId: "demo-nav-tasks",
            title: t('tour.child.step3.title'),
            description: t('tour.child.step3.desc'),
            position: "right",
            mood: "excited"
        },
        {
            targetId: "demo-nav-savings",
            title: t('tour.child.step4.title'),
            description: t('tour.child.step4.desc'),
            position: "right",
            mood: "happy"
        },
        {
            targetId: "demo-nav-games",
            title: t('tour.child.step5.title'),
            description: t('tour.child.step5.desc'),
            position: "right",
            mood: "curious"
        },
        {
            targetId: "demo-nav-banking",
            title: t('tour.child.step6.title'),
            description: t('tour.child.step6.desc'),
            position: "right",
            mood: "flirty"
        },
        {
            targetId: "demo-nav-store",
            title: t('tour.child.step7.title'),
            description: t('tour.child.step7.desc'),
            position: "right",
            mood: "excited"
        },
        {
            title: t('tour.child.step8.title'),
            description: t('tour.child.step8.desc'),
            position: "center",
            mood: "happy"
        }
    ];

    const getTutorSteps = (): TourStep[] => [
        {
            title: t('tour.tutor.step1.title'),
            description: t('tour.tutor.step1.desc'),
            position: "center",
            mood: "explaining"
        },
        {
            targetId: "demo-nav-lessons",
            title: t('tour.tutor.step2.title'),
            description: t('tour.tutor.step2.desc'),
            position: "right",
            mood: "wise"
        },
        {
            targetId: "demo-nav-ai",
            title: t('tour.tutor.step_ai.title'),
            description: t('tour.tutor.step_ai.desc'),
            position: "right",
            mood: "mysterious"
        },
        {
            targetId: "demo-nav-tasks",
            title: t('tour.tutor.step3.title'),
            description: t('tour.tutor.step3.desc'),
            position: "right",
            mood: "explaining"
        },
        {
            targetId: "demo-nav-savings",
            title: t('tour.tutor.step4.title'),
            description: t('tour.tutor.step4.desc'),
            position: "right",
            mood: "wise"
        },
        {
            targetId: "demo-nav-games",
            title: t('tour.tutor.step5.title'),
            description: t('tour.tutor.step5.desc'),
            position: "right",
            mood: "surprised"
        },
        {
            targetId: "demo-nav-banking",
            title: t('tour.tutor.step6.title'),
            description: t('tour.tutor.step6.desc'),
            position: "right",
            mood: "neutral"
        },
        {
            targetId: "demo-nav-store",
            title: t('tour.tutor.step7.title'),
            description: t('tour.tutor.step7.desc'),
            position: "right",
            mood: "explaining"
        },
        {
            title: t('tour.tutor.step8.title'),
            description: t('tour.tutor.step8.desc'),
            position: "center",
            mood: "wise"
        }
    ];

    const activeSteps = role === 'tutor' ? getTutorSteps() : getChildSteps();

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
                <Card className="w-[400px] p-8 shadow-2xl border-2 border-border/50 bg-background/95 relative overflow-hidden text-center space-y-6">
                    <div className="space-y-2">
                        <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400 bg-clip-text text-transparent">
                            {t('tour.role_selection.title')}
                        </h2>
                        <p className="text-muted-foreground">
                            {t('tour.role_selection.subtitle')}
                        </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <button
                            onClick={() => handleRoleSelect('child')}
                            className="group relative flex flex-col items-center p-4 rounded-xl border-2 border-transparent bg-accent/30 dark:bg-accent/10 hover:bg-accent/50 dark:hover:bg-accent/30 hover:border-blue-500/50 transition-all duration-300 transform hover:-translate-y-1"
                        >
                            <div className="w-16 h-16 bg-blue-500/10 dark:bg-blue-500/20 rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                                <Rocket className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                            </div>
                            <span className="font-bold text-foreground">{t('tour.role_selection.child_btn')}</span>
                            <span className="text-xs text-muted-foreground mt-1">{t('tour.role_selection.child_desc')}</span>
                        </button>

                        <button
                            onClick={() => handleRoleSelect('tutor')}
                            className="group relative flex flex-col items-center p-4 rounded-xl border-2 border-transparent bg-accent/30 dark:bg-accent/10 hover:bg-accent/50 dark:hover:bg-accent/30 hover:border-orange-500/50 transition-all duration-300 transform hover:-translate-y-1"
                        >
                            <div className="w-16 h-16 bg-orange-500/10 dark:bg-orange-500/20 rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                                <GraduationCap className="w-8 h-8 text-orange-600 dark:text-orange-400" />
                            </div>
                            <span className="font-bold text-foreground">{t('tour.role_selection.tutor_btn')}</span>
                            <span className="text-xs text-muted-foreground mt-1">{t('tour.role_selection.tutor_desc')}</span>
                        </button>
                    </div>

                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleClose}
                        className="text-muted-foreground hover:text-foreground"
                    >
                        {t('tour.role_selection.skip')}
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
                {/* Character Float Container */}
                <div className="absolute -top-20 -left-20 w-48 h-48 z-20 pointer-events-none drop-shadow-2xl animate-in zoom-in slide-in-from-bottom-6 duration-700">
                    {role === 'child' ? (
                        <ZaraVexCharacter mood={step.mood || "happy"} />
                    ) : (
                        <DrRhoCharacter mood={step.mood || "explaining"} />
                    )}
                </div>

                <Card className={cn(
                    "w-[340px] p-6 pt-10 shadow-2xl border-2 relative overflow-visible bg-background/95 backdrop-blur-xl",
                    isCenter ? "text-center border-primary/30 scale-110" : "border-primary/50 animate-in fade-in zoom-in-95 slide-in-from-left-4"
                )}>
                    {/* Background decoration */}
                    <div className="absolute -top-10 -right-10 w-32 h-32 bg-primary/20 rounded-full blur-3xl pointer-events-none" />
                    <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-yellow-500/20 rounded-full blur-3xl pointer-events-none" />

                    <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-2 right-2 h-8 w-8 rounded-full bg-accent/50 text-muted-foreground hover:text-foreground hover:bg-destructive hover:text-destructive-foreground transition-colors z-30"
                        onClick={handleClose}
                    >
                        <X className="w-4 h-4" />
                    </Button>

                    <div className="relative z-10 pl-4">
                        <h3 className={cn(
                            "text-xl font-bold mb-3 bg-clip-text text-transparent",
                            role === 'child' ? "bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400" : "bg-gradient-to-r from-orange-600 to-yellow-600 dark:from-orange-400 dark:to-yellow-400"
                        )}>
                            {step.title}
                        </h3>
                        <p className="text-muted-foreground mb-6 text-sm leading-relaxed font-medium">
                            {step.description}
                        </p>

                        <div className="flex items-center justify-between mt-2">
                            <div className="flex gap-1.5">
                                {activeSteps.map((_, idx) => (
                                    <div
                                        key={idx}
                                        className={cn(
                                            "w-2 h-2 rounded-full transition-all duration-300",
                                            idx === currentStep
                                                ? (role === 'child' ? "bg-blue-500 w-4" : "bg-orange-500 w-4")
                                                : "bg-muted-foreground/30"
                                        )}
                                    />
                                ))}
                            </div>
                            <Button onClick={handleNext} size="sm" className={cn(
                                "text-white shadow-lg shadow-black/10 group transition-all duration-300 transform hover:-translate-y-0.5",
                                role === 'child'
                                    ? "bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600"
                                    : "bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600"
                            )}>
                                {currentStep === activeSteps.length - 1 ? t('tour.buttons.start') : t('tour.buttons.next')}
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
