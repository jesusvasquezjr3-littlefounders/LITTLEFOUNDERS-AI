import { Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";

interface DemoLockOverlayProps {
    title?: string;
    description?: string;
    onClose?: () => void;
}

export function DemoLockOverlay({
    title = "Descubre la Experiencia Completa",
    description = "Lleva tu aprendizaje al siguiente nivel. Regístrate para desbloquear todas las herramientas y guardar tu progreso.",
    onClose
}: DemoLockOverlayProps) {
    const navigate = useNavigate();

    return (
        <div className="absolute inset-0 bg-background/60 backdrop-blur-[2px] flex items-center justify-center z-50 p-4 transition-all duration-300">
            <Card className="max-w-md w-full p-8 text-center shadow-2xl border-none bg-gradient-to-b from-white to-orange-50/50 dark:from-slate-950 dark:to-slate-900/50 ring-1 ring-orange-100 dark:ring-orange-900/20 relative">
                {onClose && (
                    <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-2 right-2 h-8 w-8 text-muted-foreground hover:text-foreground"
                        onClick={(e) => {
                            e.stopPropagation();
                            onClose();
                        }}
                    >
                        <X className="h-4 w-4" />
                    </Button>
                )}
                <div className="flex justify-center mb-6">
                    <div className="p-4 bg-gradient-to-br from-orange-100 to-yellow-100 dark:from-orange-900/30 dark:to-yellow-900/30 rounded-full shadow-inner">
                        <Sparkles className="w-8 h-8 text-orange-500 animate-pulse" />
                    </div>
                </div>
                <h3 className="text-2xl font-bold mb-3 bg-gradient-to-r from-orange-600 to-yellow-600 bg-clip-text text-transparent">
                    {title}
                </h3>
                <p className="text-muted-foreground mb-8 leading-relaxed">
                    {description}
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <Button
                        onClick={() => navigate("/register")}
                        className="w-full sm:w-auto bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 text-white shadow-lg hover:shadow-xl transition-all duration-200"
                        size="lg"
                    >
                        Comenzar Ahora
                    </Button>
                    <Button
                        variant="ghost"
                        onClick={() => navigate("/login")}
                        className="w-full sm:w-auto hover:bg-orange-50 text-orange-600 hover:text-orange-700"
                    >
                        Ya tengo cuenta
                    </Button>
                </div>
            </Card>
        </div>
    );
}
