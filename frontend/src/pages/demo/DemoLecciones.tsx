import { useState } from "react";
import { DemoDashboardLayout } from "@/components/demo/DemoDashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Link } from "react-router-dom";
import {
    Search,
    Users,
    Package,
    Star,
    Clock,
    PlayCircle,
    CheckCircle,
    Lock,
    Trophy,
    Coins,
    ShoppingCart,
    PiggyBank,
    Building,
    Calendar,
    BarChart3,
    Calculator,
    Target,
    Briefcase,
    CreditCard,
    TrendingUp,
    AlertTriangle,
    Home,
    Shield
} from "lucide-react";

interface Module {
    id: string;
    title: string;
    description: string;
    duration: string;
    difficulty: "Fácil" | "Intermedio" | "Avanzado";
    progress: number;
    completed: boolean;
    locked: boolean;
    icon: any;
    activities: string[];
}

interface Level {
    id: string;
    title: string;
    ageRange: string;
    description: string;
    cognitiveApproach: string;
    modules: Module[];
    sublevels: string[];
}

interface AgeRange {
    id: string;
    label: string;
    description: string;
    icon: any;
}

export function DemoLecciones() {
    const [selectedLevel, setSelectedLevel] = useState<string>("nivel-1");
    const [selectedAgeRange, setSelectedAgeRange] = useState<string>("8-10");
    const [showLockedDialog, setShowLockedDialog] = useState(false);

    // Definir los rangos de edad disponibles
    const ageRanges: AgeRange[] = [
        {
            id: "8-10",
            label: "8-10 años",
            description: "Exploradores Financieros - Conceptos básicos y actividades interactivas",
            icon: Calendar
        },
        {
            id: "11-13",
            label: "11-13 años",
            description: "Administradores Junior - Conceptos intermedios y planificación",
            icon: Calendar
        },
        {
            id: "14-16",
            label: "14-16 años",
            description: "Financieros Avanzados - Planificación, crédito, inversiones y vida independiente",
            icon: Calendar
        }
    ];

    // Función para obtener los niveles según el rango de edad seleccionado
    const getLevelsByAgeRange = (ageRange: string): Level[] => {
        switch (ageRange) {
            case "8-10":
                return [
                    {
                        id: "nivel-1",
                        title: "Exploradores Financieros",
                        ageRange: "7-8 años",
                        description: "Transición hacia el pensamiento concreto con experiencias tangibles",
                        cognitiveApproach: "Enfoque visual y táctil con narrativas interactivas",
                        sublevels: ["1A: Reconocimiento básico", "1B: Valores simples", "1C: Primeras elecciones"],
                        modules: [
                            {
                                id: "1.1",
                                title: "¿Qué es el Dinero?",
                                description: "Identificación de monedas y billetes, comprensión de valores básicos",
                                duration: "30 min",
                                difficulty: "Fácil",
                                progress: 0,
                                completed: false,
                                locked: false,
                                icon: Coins,
                                activities: [
                                    "Identificación de monedas y billetes",
                                    "Comprensión de valores numéricos básicos",
                                    "Juegos de reconocimiento visual y táctil",
                                    "Concepto: 'El dinero representa valor'"
                                ]
                            },
                            {
                                id: "1.2",
                                title: "De Dónde Viene el Dinero",
                                description: "Introducción al concepto de trabajo y recompensas",
                                duration: "25 min",
                                difficulty: "Fácil",
                                progress: 0,
                                completed: false,
                                locked: true,
                                icon: Users,
                                activities: [
                                    "Introducción al concepto de trabajo",
                                    "Las personas trabajan para ganar dinero",
                                    "Diferentes tipos de trabajos y recompensas",
                                    "Actividad: Tareas domésticas por recompensas"
                                ]
                            },
                            {
                                id: "1.3",
                                title: "Necesidades vs Deseos",
                                description: "Diferenciación básica entre lo que necesitamos y queremos",
                                duration: "35 min",
                                difficulty: "Fácil",
                                progress: 0,
                                completed: false,
                                locked: true,
                                icon: Package,
                                activities: [
                                    "Diferenciación entre necesidades y deseos",
                                    "Ejemplos concretos: comida vs juguetes",
                                    "Actividades de clasificación visual",
                                    "Historia interactiva: 'Las decisiones de compra'"
                                ]
                            }
                        ]
                    }
                ];
            default:
                return [];
        }
    };

    const levels = getLevelsByAgeRange(selectedAgeRange);

    // Función para verificar si una lección está desbloqueada
    // En DEMO solo la 1.1 está desbloqueada
    const isLessonUnlocked = (lessonId: string) => {
        return lessonId === '1.1';
    };

    // Aplicar el estado de desbloqueo a los módulos
    const levelsWithUnlockStatus = levels.map(level => ({
        ...level,
        modules: level.modules.map(module => ({
            ...module,
            locked: !isLessonUnlocked(module.id)
        }))
    }));

    const currentLevel = levelsWithUnlockStatus.find(level => level.id === selectedLevel) || levelsWithUnlockStatus[0];

    const getDifficultyColor = (difficulty: string) => {
        switch (difficulty) {
            case "Fácil": return "bg-green-100 text-green-800 border-green-200";
            case "Intermedio": return "bg-yellow-100 text-yellow-800 border-yellow-200";
            case "Avanzado": return "bg-red-100 text-red-800 border-red-200";
            default: return "bg-gray-100 text-gray-800 border-gray-200";
        }
    };

    const handleLessonClick = (module: Module) => {
        if (module.locked) {
            setShowLockedDialog(true);
        } else {
            // In a real implementation, this would open the lesson player
            // For demo, we can just show an alert or maybe simulate opening it
            alert("¡Esta es la lección de demostración! Aquí se abriría el reproductor de lecciones.");
        }
    }

    return (
        <DemoDashboardLayout>
            <div className="space-y-6">
                {/* Header mejorado */}
                <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-6">
                    <h1 className="text-3xl font-bold text-gray-800 mb-2">Educación Financiera LittleFounders (DEMO)</h1>
                    <p className="text-gray-600 mb-4">Prueba nuestra primera lección y descubre cómo aprenden los niños.</p>

                    {/* Selector de Edad */}
                    <div className="mb-6">
                        <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center">
                            <Calendar className="w-5 h-5 mr-2" />
                            Selecciona tu rango de edad:
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {ageRanges.map((ageRange) => (
                                <Card
                                    key={ageRange.id}
                                    className={`cursor-pointer transition-all duration-200 hover:shadow-lg ${selectedAgeRange === ageRange.id
                                            ? "ring-2 ring-blue-500 bg-blue-50"
                                            : "hover:bg-gray-50 opacity-60"
                                        }`}
                                    onClick={() => {
                                        if (ageRange.id !== "8-10") {
                                            setShowLockedDialog(true);
                                        } else {
                                            setSelectedAgeRange(ageRange.id);
                                        }
                                    }}
                                >
                                    <CardContent className="p-4 flex items-center space-x-4">
                                        <div className={`p-3 rounded-full ${selectedAgeRange === ageRange.id ? "bg-blue-100 text-blue-600" : "bg-gray-100 text-gray-500"
                                            }`}>
                                            <ageRange.icon className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-gray-900">{ageRange.label}</h4>
                                            <p className="text-xs text-gray-500 mt-1 line-clamp-2">{ageRange.description}</p>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Lista de Módulos */}
                <div className="space-y-4">
                    <h2 className="text-2xl font-bold text-gray-800">Módulos Disponibles</h2>
                    {currentLevel?.modules.map((module) => (
                        <Card
                            key={module.id}
                            className={`transition-all duration-200 hover:shadow-md cursor-pointer ${module.locked ? 'opacity-75 bg-gray-50' : 'hover:border-blue-300'
                                }`}
                            onClick={() => handleLessonClick(module)}
                        >
                            <CardContent className="p-6">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-4">
                                        <div className={`p-3 rounded-full ${module.locked ? 'bg-gray-200 text-gray-500' : 'bg-blue-100 text-blue-600'
                                            }`}>
                                            {module.locked ? <Lock className="w-6 h-6" /> : <module.icon className="w-6 h-6" />}
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-bold text-gray-900 flex items-center">
                                                {module.title}
                                                {module.locked && <Badge variant="outline" className="ml-2 text-xs">Bloqueado</Badge>}
                                            </h3>
                                            <p className="text-gray-500">{module.description}</p>
                                            <div className="flex items-center space-x-4 mt-2">
                                                <Badge variant="secondary" className={getDifficultyColor(module.difficulty)}>
                                                    {module.difficulty}
                                                </Badge>
                                                <span className="text-sm text-gray-500 flex items-center">
                                                    <Clock className="w-4 h-4 mr-1" />
                                                    {module.duration}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <div>
                                        <Button variant={module.locked ? "outline" : "default"} disabled={module.locked}>
                                            {module.locked ? "Bloqueado" : "Comenzar"}
                                        </Button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>

            <Dialog open={showLockedDialog} onOpenChange={setShowLockedDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>¡Continúa tu Aventura!</DialogTitle>
                        <DialogDescription>
                            Esta lección está disponible solo para usuarios registrados. ¡Crea tu cuenta gratis para acceder a todo el contenido!
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="flex flex-col sm:flex-row gap-2">
                        <Button variant="outline" onClick={() => setShowLockedDialog(false)}>
                            Cerrar
                        </Button>
                        <Button asChild className="bg-gradient-to-r from-pink-500 to-purple-600 text-white">
                            <Link to="/register">¡Empezar Ahora!</Link>
                        </Button>
                        <Button asChild variant="ghost">
                            <Link to="/login">Iniciar Sesión</Link>
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </DemoDashboardLayout>
    );
}
