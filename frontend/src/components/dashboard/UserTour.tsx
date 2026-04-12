import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Rocket, ChevronRight, X, Sparkles, GraduationCap } from "lucide-react";
import { cn } from "@/lib/utils";
import ZaraVexCharacter from "@/components/characters/ZaraVexCharacter";
import DrRhoCharacter from "@/components/characters/DrRhoCharacter";

interface TourStep {
    targetId?: string;
    title: string;
    description: string;
    position?: "right" | "bottom" | "center";
    mood?: any; // To hold ZaraMood or RhoMood
}

// Hardcoded step arrays have been removed in favor of i18n
export function UserTour() {
    const { t } = useTranslation('dashboard');
    const [currentStep, setCurrentStep] = useState(0);
    const [isOpen, setIsOpen] = useState(false);
    const [userRole, setUserRole] = useState<'child' | 'parent'>('child'); // Default to child just in case

    const getChildSteps = (): TourStep[] => [
        {
            title: t('tour.child.step1.title'),
            description: t('tour.child.step1.desc'),
            position: "center",
            mood: "excited"
        },
        {
            targetId: "nav-lessons",
            title: t('tour.child.step2.title'),
            description: t('tour.child.step2.desc'),
            position: "right",
            mood: "happy"
        },
        {
            targetId: "nav-ai",
            title: t('tour.child.step_ai.title'),
            description: t('tour.child.step_ai.desc'),
            position: "right",
            mood: "curious"
        },
        {
            targetId: "nav-tasks",
            title: t('tour.child.step3.title'),
            description: t('tour.child.step3.desc'),
            position: "right",
            mood: "excited"
        },
        {
            targetId: "nav-savings",
            title: t('tour.child.step4.title'),
            description: t('tour.child.step4.desc'),
            position: "right",
            mood: "happy"
        },
        {
            targetId: "nav-games",
            title: t('tour.child.step5.title'),
            description: t('tour.child.step5.desc'),
            position: "right",
            mood: "curious"
        },
        {
            targetId: "nav-banking",
            title: t('tour.child.step6.title'),
            description: t('tour.child.step6.desc'),
            position: "right",
            mood: "flirty"
        },
        {
            targetId: "nav-store",
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
            targetId: "nav-lessons",
            title: t('tour.tutor.step2.title'),
            description: t('tour.tutor.step2.desc'),
            position: "right",
            mood: "wise"
        },
        {
            targetId: "nav-ai",
            title: t('tour.tutor.step_ai.title'),
            description: t('tour.tutor.step_ai.desc'),
            position: "right",
            mood: "mysterious"
        },
        {
            targetId: "nav-tasks",
            title: t('tour.tutor.step3.title'),
            description: t('tour.tutor.step3.desc'),
            position: "right",
            mood: "explaining"
        },
        {
            targetId: "nav-savings",
            title: t('tour.tutor.step4.title'),
            description: t('tour.tutor.step4.desc'),
            position: "right",
            mood: "wise"
        },
        {
            targetId: "nav-games",
            title: t('tour.tutor.step5.title'),
            description: t('tour.tutor.step5.desc'),
            position: "right",
            mood: "surprised"
        },
        {
            targetId: "nav-banking",
            title: t('tour.tutor.step6.title'),
            description: t('tour.tutor.step6.desc'),
            position: "right",
            mood: "neutral"
        },
        {
            targetId: "nav-store",
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
    const [coords, setCoords] = useState({ top: 0, left: 0, arrowTop: 60 });
    const [userKey, setUserKey] = useState("userTourCompleted");

    // Initialize user data
    useEffect(() => {
        try {
            const user = JSON.parse(localStorage.getItem('user') || '{}');
            if (user && user.public_id) {
                setUserKey(`userTourCompleted_${user.public_id}`);
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
            if (user && user.public_id) currentKey = `userTourCompleted_${user.public_id}`;
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

    const activeSteps = userRole === 'child' ? getChildSteps() : getTutorSteps();

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
                {/* Character Float Container */}
                <div className="absolute -top-20 -left-20 w-48 h-48 z-20 pointer-events-none drop-shadow-2xl animate-in zoom-in slide-in-from-bottom-6 duration-700">
                    {userRole === 'child' ? (
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
                            userRole === 'child' ? "bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400" : "bg-gradient-to-r from-orange-600 to-yellow-600 dark:from-orange-400 dark:to-yellow-400"
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
                                                ? (userRole === 'child' ? "bg-blue-500 w-4" : "bg-orange-500 w-4")
                                                : "bg-muted-foreground/30"
                                        )}
                                    />
                                ))}
                            </div>
                            <Button onClick={handleNext} size="sm" className={cn(
                                "text-white shadow-lg shadow-black/10 group transition-all duration-300 transform hover:-translate-y-0.5",
                                userRole === 'child'
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
