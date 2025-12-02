import { DemoDashboardLayout } from "@/components/demo/DemoDashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Circle, Trophy, Lock } from "lucide-react";
import { DemoLockOverlay } from "@/components/demo/DemoLockOverlay";
import { useState } from "react";

export function DemoTasks() {
    const [showLock, setShowLock] = useState(false);

    const tasks = [
        { id: 1, title: "Hacer la cama", reward: 50, completed: true },
        { id: 2, title: "Lavar los platos", reward: 100, completed: false },
        { id: 3, title: "Leer 20 minutos", reward: 150, completed: false },
    ];

    return (
        <DemoDashboardLayout>
            <div className="space-y-6 relative">
                {showLock && (
                    <div className="fixed inset-0 z-50" onClick={() => setShowLock(false)}>
                        <DemoLockOverlay
                            title="Gana Recompensas"
                            description="Convierte tus deberes en diversión. Regístrate para asignar tareas reales, seguir tu progreso y ganar premios."
                            onClose={() => setShowLock(false)}
                        />
                    </div>
                )}

                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold">Mis Tareas (DEMO)</h1>
                        <p className="text-muted-foreground">
                            Completa tus deberes y gana recompensas
                        </p>
                    </div>
                    <div className="flex items-center bg-green-100 text-green-800 px-4 py-2 rounded-full font-bold">
                        <Trophy className="w-5 h-5 mr-2" />
                        Nivel 1
                    </div>
                </div>

                <div className="grid gap-4">
                    {tasks.map((task) => (
                        <Card key={task.id} className={`transition-all ${task.completed ? 'bg-muted/50' : 'hover:shadow-md'}`}>
                            <CardContent className="flex items-center justify-between p-6">
                                <div className="flex items-center space-x-4">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className={task.completed ? "text-green-500" : "text-muted-foreground"}
                                        onClick={() => !task.completed && setShowLock(true)}
                                    >
                                        {task.completed ? <CheckCircle2 className="w-6 h-6" /> : <Circle className="w-6 h-6" />}
                                    </Button>
                                    <div>
                                        <h3 className={`font-medium ${task.completed ? 'line-through text-muted-foreground' : ''}`}>
                                            {task.title}
                                        </h3>
                                        <p className="text-sm text-yellow-600 font-medium">
                                            +{task.reward} monedas
                                        </p>
                                    </div>
                                </div>
                                {task.completed && (
                                    <span className="text-xs font-medium bg-green-100 text-green-800 px-2 py-1 rounded">
                                        Completada
                                    </span>
                                )}
                            </CardContent>
                        </Card>
                    ))}

                    {/* Locked Task Placeholder */}
                    <Card className="border-dashed border-2 flex items-center justify-center p-6 bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors group" onClick={() => setShowLock(true)}>
                        <div className="flex items-center text-muted-foreground group-hover:text-primary transition-colors">
                            <Trophy className="w-4 h-4 mr-2" />
                            <span className="font-medium">Personaliza tus tareas...</span>
                        </div>
                    </Card>
                </div>
            </div>
        </DemoDashboardLayout>
    );
}
