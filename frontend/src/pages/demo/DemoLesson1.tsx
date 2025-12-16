import { useState, useRef, useEffect } from "react";
import { DemoDashboardLayout } from "@/components/demo/DemoDashboardLayout";
import { DinoCharacter } from "@/components/demo/DinoCharacter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Play, RotateCcw, PartyPopper } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Link } from "react-router-dom";
import confetti from 'canvas-confetti';

interface ScriptSegment {
    time: number;
    text: string;
    visual?: string; // Emoji or visual cue
}

export function DemoLesson1() {
    const [started, setStarted] = useState(false);
    const [currentText, setCurrentText] = useState("");
    const [currentVisual, setCurrentVisual] = useState<string | undefined>(undefined);
    const [isPlaying, setIsPlaying] = useState(false);
    const [showQuiz, setShowQuiz] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [quizError, setQuizError] = useState<string | null>(null);
    const [currentTime, setCurrentTime] = useState(0);
    const audioRef = useRef<HTMLAudioElement>(null);

    const script: ScriptSegment[] = [
        { time: 1, text: "¡Hola, exploradores curiosos!", visual: "👋" },
        { time: 2, text: "¿Listos para una aventura?", visual: "🎒" },
        { time: 4, text: "Hoy descubriremos un gran misterio:", visual: "🕵️‍♂️" },
        { time: 7, text: "¿Qué es el dinero?", visual: "❓" },
        { time: 8, text: "Imagina que tienes un juguete que ya no usas", visual: "🧸" },
        { time: 11, text: "y tu amigo tiene unos lápices de colores increíbles.", visual: "✏️" },
        { time: 15, text: "Si intercambian, los dos ganan algo nuevo.", visual: "🔄" },
        { time: 18, text: "¡Eso se llama trueque!", visual: "🤝" },
        { time: 20, text: "Pero, ¿y si tu amigo no quiere el juguete?", visual: "🤔" },
        { time: 24, text: "Ahí necesitamos algo que a todos les guste.", visual: "✨" },
        { time: 27, text: "¡El dinero es como un superpoder de intercambio!", visual: "🦸‍♂️" },
        { time: 31, text: "Es algo especial (como monedas o billetes)", visual: "🪙" },
        { time: 34, text: "que todos aceptamos para comprar lo que necesitamos.", visual: "🛒" },
        { time: 37, text: "Con dinero puedes cambiar esos lápices por un helado,", visual: "🍦" },
        { time: 40, text: "un libro o un regalo para mamá.", visual: "🎁" },
        { time: 43, text: "No se come, pero vale", visual: "🚫" },
        { time: 44, text: "porque todos estamos de acuerdo en que vale.", visual: "✅" },
        { time: 47, text: "Así que el dinero es una herramienta mágica", visual: "🪄" },
        { time: 50, text: "que nos ayuda a compartir y conseguir cosas", visual: "🤲" },
        { time: 53, text: "de forma fácil y justa.", visual: "⚖️" },
        { time: 55, text: "¡Nos vemos en la próxima aventura aquí!", visual: "🚀" },
    ];

    useEffect(() => {
        const handleTimeUpdate = () => {
            if (audioRef.current) {
                const time = audioRef.current.currentTime;
                setCurrentTime(time);

                // Find active segment
                const activeSegment = [...script].reverse().find(s => time >= s.time);

                if (activeSegment) {
                    setCurrentText(activeSegment.text);
                    setCurrentVisual(activeSegment.visual);
                } else if (time < 1) {
                    setCurrentText("");
                    setCurrentVisual(undefined);
                }

                // End of lesson check (approx 57s)
                if (time >= 57) {
                    handleLessonEnd();
                }
            }
        };

        const audio = audioRef.current;
        if (audio) {
            audio.addEventListener('timeupdate', handleTimeUpdate);
            audio.addEventListener('ended', handleLessonEnd);
            return () => {
                audio.removeEventListener('timeupdate', handleTimeUpdate);
                audio.removeEventListener('ended', handleLessonEnd);
            };
        }
    }, [started]);

    const handleLessonEnd = () => {
        setIsPlaying(false);
        if (!showQuiz && !showSuccess) {
            setShowQuiz(true);
        }
    };

    const handleStart = () => {
        setStarted(true);
        setIsPlaying(true);
        audioRef.current?.play();
    };

    const handleReplay = () => {
        if (audioRef.current) {
            audioRef.current.currentTime = 0;
            audioRef.current.play();
            setIsPlaying(true);
            setShowQuiz(false);
            setShowSuccess(false);
            setQuizError(null);
            setCurrentText("");
        }
    };

    const handleQuizAnswer = (isCorrect: boolean) => {
        if (isCorrect) {
            setShowQuiz(false);
            triggerConfetti();
            setShowSuccess(true);
        } else {
            setQuizError("¡Inténtalo de nuevo! Pista: El dinero sirve para obtener cosas, ¡no para comer!");
        }
    };

    const triggerConfetti = () => {
        confetti({
            particleCount: 150,
            spread: 80,
            origin: { y: 0.6 }
        });
    };

    return (
        <DemoDashboardLayout>
            <div className="flex flex-col min-h-[calc(100vh-100px)] h-full relative max-w-5xl mx-auto p-4">
                {/* Header */}
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <Link to="/demo/lecciones" className="text-sm text-blue-600 hover:underline mb-1 inline-block">
                            &larr; Volver a Lecciones
                        </Link>
                        <h1 className="text-3xl font-bold text-gray-800">Lección 1: ¿Qué es el Dinero?</h1>
                    </div>
                </div>

                {/* Main Stage */}
                <Card className="flex-1 bg-gradient-to-b from-blue-50 to-white relative overflow-hidden border-2 border-blue-100 flex flex-col">
                    <CardContent className="p-0 flex-1 relative">
                        {/* Audio Element */}
                        <audio ref={audioRef} src="/audio/1_8-10_QUE-ES-EL-DINERO.mp3" preload="auto" />

                        {/* Interactive Dino Scene */}
                        <div className="w-full h-full relative z-10 min-h-[500px]">
                            {/* Visual Aid Overlay */}
                            {currentVisual && isPlaying && (
                                <div className="absolute top-[20%] right-[15%] text-9xl animate-in zoom-in slide-in-from-bottom-10 fade-in duration-700 pointer-events-none drop-shadow-2xl z-0">
                                    {currentVisual}
                                </div>
                            )}

                            <DinoCharacter
                                currentText={currentText}
                                showBubble={isPlaying && !!currentText}
                                bubblePosition="demo"
                            />
                        </div>

                        {/* Overlay Controls (Start) */}
                        {!started && (
                            <div className="absolute inset-0 z-20 bg-black/10 backdrop-blur-[2px] flex items-center justify-center">
                                <Button
                                    size="lg"
                                    className="text-2xl py-8 px-12 rounded-full shadow-2xl animate-bounce bg-gradient-to-r from-green-500 to-emerald-600 hover:scale-105 transition-transform"
                                    onClick={handleStart}
                                >
                                    <Play className="w-8 h-8 mr-4 fill-current" />
                                    ¡COMENZAR!
                                </Button>
                            </div>
                        )}

                        {/* Replay Button (Floating) */}
                        {started && !isPlaying && !showQuiz && !showSuccess && (
                            <div className="absolute top-4 right-4 z-20">
                                <Button variant="outline" size="icon" onClick={handleReplay} title="Repetir">
                                    <RotateCcw className="w-6 h-6 text-blue-600" />
                                </Button>
                            </div>
                        )}

                    </CardContent>

                    {/* Bottom Progress Bar */}
                    {started && (
                        <div className="bg-white border-t p-4 z-20 flex gap-4 items-center">
                            <Button variant="ghost" size="icon" onClick={handleReplay} title="Reiniciar" className="shrink-0">
                                <RotateCcw className="w-5 h-5 text-gray-500" />
                            </Button>
                            <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden border border-gray-200">
                                <div
                                    className="h-full bg-gradient-to-r from-blue-400 to-blue-600 transition-all duration-500 ease-linear rounded-full"
                                    style={{ width: `${(currentTime / 57) * 100}%` }}
                                />
                            </div>
                            <span className="text-sm font-mono text-gray-500 w-12 text-center">
                                {Math.floor(currentTime)}s
                            </span>
                        </div>
                    )}
                </Card>

                {/* Quiz Dialog */}
                <Dialog open={showQuiz} onOpenChange={(open) => !open && setShowQuiz(false)}>
                    <DialogContent className="sm:max-w-md" onInteractOutside={(e) => e.preventDefault()}>
                        <DialogHeader>
                            <DialogTitle className="text-2xl text-center">¡Pregunta Rápida! 🧠</DialogTitle>
                            <DialogDescription className="text-center text-lg pt-2">
                                ¿El dinero se puede comer? 😋
                            </DialogDescription>
                        </DialogHeader>

                        {/* Error Feedback Area */}
                        {quizError && (
                            <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-center animate-in shake duration-300">
                                {quizError}
                            </div>
                        )}

                        <div className="flex gap-4 justify-center py-4">
                            <Button
                                variant="outline"
                                className="flex-1 h-24 text-lg hover:bg-red-50 hover:border-red-200 hover:text-red-700 transition-all"
                                onClick={() => handleQuizAnswer(false)}
                            >
                                <div className="flex flex-col items-center gap-2">
                                    <span className="text-4xl">🍕</span>
                                    <span>¡Sí!</span>
                                </div>
                            </Button>
                            <Button
                                variant="outline"
                                className="flex-1 h-24 text-lg hover:bg-green-50 hover:border-green-200 hover:text-green-700 transition-all"
                                onClick={() => handleQuizAnswer(true)}
                            >
                                <div className="flex flex-col items-center gap-2">
                                    <span className="text-4xl">🚫</span>
                                    <span>¡No!</span>
                                </div>
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>

                {/* Success Dialog */}
                <Dialog open={showSuccess} onOpenChange={setShowSuccess}>
                    <DialogContent className="sm:max-w-lg">
                        <div className="text-center space-y-4 pt-4">
                            <div className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
                                <PartyPopper className="w-10 h-10 text-yellow-600" />
                            </div>
                            <DialogTitle className="text-3xl font-bold bg-gradient-to-r from-yellow-500 to-orange-500 bg-clip-text text-transparent">
                                ¡Felicidades!
                            </DialogTitle>
                            <DialogDescription className="text-lg text-gray-600">
                                ¡Respuesta Correcta! Ya sabes para qué sirve el dinero. 🌟
                            </DialogDescription>

                            <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 mt-4">
                                <p className="font-medium text-blue-800 mb-4">
                                    ¡Únete a LittleFounders para más aventuras!
                                </p>
                                <div className="flex flex-col gap-3">
                                    <Button asChild className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-lg py-6 shadow-lg hover:scale-[1.02] transition-transform">
                                        <Link to="/register">Crear mi Cuenta Gratis</Link>
                                    </Button>
                                    <Button asChild variant="ghost" className="text-gray-500">
                                        <Link to="/login">Ya tengo cuenta</Link>
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>
        </DemoDashboardLayout>
    );
}
