import { useState, useRef, useEffect } from "react";
import { DemoDashboardLayout } from "@/components/demo/DemoDashboardLayout";
import { DinoCharacter, DinoMood } from "@/components/demo/DinoCharacter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Play, RotateCcw, PartyPopper, CheckCircle, ArrowRight, ShoppingCart, Repeat } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Link } from "react-router-dom";
import confetti from 'canvas-confetti';
import { cn } from "@/lib/utils";

// --- Types & Constants ---
type StageParams = {
    id: number;
    startTime: number;
    pauseTime: number; // When to pause audio for interaction
    title: string;
    instruction: string;
};

const SCRIPT = [
    { time: 1, text: "¡Hola, exploradores curiosos! 👋" },
    { time: 3, text: "¿Listos para una aventura? 🚀" },
    { time: 5, text: "Hoy descubriremos un gran misterio: 🔍" },
    { time: 7, text: "¿Qué es el dinero? 💰" },
    { time: 9, text: "Imagina que tienes un juguete que ya no usas 🧸" },
    { time: 12, text: "y tu amigo tiene unos lápices increíbles. ✏️" },
    { time: 15, text: "Si cambian, ¡los dos ganan! 🤝" },
    { time: 18, text: "¡Eso se llama trueque! 🔄" },
    { time: 21, text: "Pero, ¿y si tu amigo no quiere el juguete? 🤔" },
    { time: 25, text: "Necesitamos algo que a todos les guste. ✨" },
    { time: 28, text: "¡El dinero es un superpoder de intercambio! ⚡" },
    { time: 32, text: "Es algo especial (como monedas o billetes) 🪙💵" },
    { time: 35, text: "que usamos para comprar cosas. 🛍️" },
    { time: 38, text: "Con dinero cambias lápices por helado, 🍦" },
    { time: 43, text: "No se come, pero vale mucho. 💎" },
    { time: 47, text: "Es una herramienta mágica 🪄" },
    { time: 50, text: "que nos ayuda a conseguir cosas. 🎁" }
];

const STAGES: StageParams[] = [
    { id: 1, startTime: 0, pauseTime: 20, title: "El Trueque", instruction: "Analiza con atención!" }, // 0-20s (Merged Intro + Barter)
    { id: 2, startTime: 20, pauseTime: 36, title: "¿Qué es Dinero?", instruction: "Selecciona las formas de dinero" }, // 20-36s
    { id: 3, startTime: 36, pauseTime: 54, title: "Comprando", instruction: "¡Compra el helado!" }, // 36-54s
    { id: 4, startTime: 55, pauseTime: 999, title: "¡Esoo!", instruction: "¡Bien hecho!" } // Outro
];

export function DemoLesson1() {
    // State
    const [currentStage, setCurrentStage] = useState(0); // Index of STAGES
    const [isPlaying, setIsPlaying] = useState(false);
    const [audioReady, setAudioReady] = useState(false);
    const [interactionActive, setInteractionActive] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [currentText, setCurrentText] = useState("");
    const [isCompleted, setIsCompleted] = useState(false);

    // Minigame States
    const [barterComplete, setBarterComplete] = useState(false);
    const [quizSelection, setQuizSelection] = useState<string[]>([]);
    const [quizComplete, setQuizComplete] = useState(false);
    const [shopComplete, setShopComplete] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);

    const audioRef = useRef<HTMLAudioElement>(null);

    // --- Audio Logic ---
    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        const handleTimeUpdate = () => {
            const time = audio.currentTime;
            setCurrentTime(time);

            // Update Text
            const activeLine = SCRIPT.slice().reverse().find(s => time >= s.time);
            setCurrentText(activeLine ? activeLine.text : "");

            const stage = STAGES[currentStage];

            // Check for pause point
            if (time >= stage.pauseTime && isPlaying && !interactionActive) {
                audio.pause();
                setIsPlaying(false);
                setInteractionActive(true);
            }
        };

        audio.addEventListener('timeupdate', handleTimeUpdate);
        audio.addEventListener('loadedmetadata', () => setAudioReady(true));
        audio.addEventListener('ended', handleLessonFinish);

        return () => {
            audio.removeEventListener('timeupdate', handleTimeUpdate);
            audio.removeEventListener('loadedmetadata', () => setAudioReady(true));
            audio.removeEventListener('ended', handleLessonFinish);
        };
    }, [currentStage, isPlaying, interactionActive]);

    const startLesson = () => {
        if (audioRef.current) {
            audioRef.current.play();
            setIsPlaying(true);
        }
    };

    const nextStage = () => {
        setInteractionActive(false);

        // Move to next stage
        const nextIdx = currentStage + 1;
        if (nextIdx < STAGES.length) {
            setCurrentStage(nextIdx);
            if (audioRef.current) {
                audioRef.current.play();
                setIsPlaying(true);
            }
        } else {
            handleLessonFinish();
        }
    };

    const handleLessonFinish = () => {
        // Save progress for demo unlock
        localStorage.setItem('demo_lesson_1_completed', 'true');

        triggerConfettiLimit();
        setTimeout(() => {
            setShowSuccess(true);
        }, 1500);
    };

    const triggerConfettiLimit = () => {
        confetti({
            particleCount: 150,
            spread: 70,
            origin: { y: 0.6 },
            zIndex: 100
        });
    };

    // --- Minigame Handlers ---

    // Stage 2: Barter
    const handleBarterSwap = () => {
        setBarterComplete(true);
        triggerConfettiLimit();
        setTimeout(nextStage, 1500); // Auto advance after success
    };

    // Stage 3: Quiz (Identify Money)
    const handleQuizSelect = (item: string) => {
        if (quizComplete) return;

        const newSelection = quizSelection.includes(item)
            ? quizSelection.filter(i => i !== item)
            : [...quizSelection, item];

        setQuizSelection(newSelection);

        // Check answers (Coin + Bill)
        const required = ['coin', 'bill'];
        const hasRequired = required.every(r => newSelection.includes(r));
        const noWrong = !newSelection.some(s => ['toy', 'apple'].includes(s));

        if (hasRequired && noWrong) {
            setQuizComplete(true);
            triggerConfettiLimit();
            // Wait a bit then show button or auto advance
        }
    };

    // Stage 4: Shop
    const handleBuyIceCream = () => {
        if (shopComplete) return;
        setShopComplete(true);
        triggerConfettiLimit();
        setTimeout(nextStage, 2000);
    };

    // Progress Calculation
    const progress = isCompleted ? 100 : Math.min(100, (currentStage / (STAGES.length - 1)) * 100);

    return (
        <DemoDashboardLayout>
            <div className="flex flex-col min-h-[calc(100vh-100px)] h-full relative max-w-6xl mx-auto p-4 font-sans">

                {/* Audio Element Hidden */}
                <audio ref={audioRef} src="/audio/1_8-10_QUE-ES-EL-DINERO.mp3" preload="auto" />

                {/* header */}
                <div className="flex justify-between items-center mb-6 bg-white p-4 rounded-3xl shadow-sm border border-indigo-50">
                    <div className="flex items-center gap-4">
                        <Link to="/demo/lecciones">
                            <Button variant="ghost" className="rounded-full w-12 h-12 p-0 hover:bg-indigo-50">←</Button>
                        </Link>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-800">¿Qué es el Dinero?</h1>
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-bold text-indigo-500 bg-indigo-50 px-3 py-1 rounded-full">
                                    Lección 1
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="flex-1 max-w-md mx-8">
                        <div className="flex justify-between text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">
                            <span>Progreso</span>
                            <span>{Math.round(progress)}%</span>
                        </div>
                        <div className="h-4 bg-gray-100 rounded-full overflow-hidden shadow-inner">
                            <div
                                className="h-full bg-indigo-500 transition-all duration-1000 ease-out rounded-full relative overflow-hidden"
                                style={{ width: `${progress}%` }}
                            >
                                <div className="absolute inset-0 bg-white/30 w-full h-full animate-[shimmer_2s_infinite] skew-x-[-20deg]" />
                            </div>
                        </div>
                    </div>

                    <div className="bg-yellow-100 px-6 py-2 rounded-2xl font-bold text-yellow-700 border-2 border-yellow-200 shadow-[0_4px_0_rgb(234,179,8)] flex items-center gap-2">
                        <span>⭐</span>
                        <span>{currentStage * 20} XP</span>
                    </div>
                </div>

                {/* --- Main Content Area --- */}
                <div className="flex-1 relative flex flex-col md:flex-row gap-6">

                    {/* Left: Liruf Character (Coach) */}
                    <div className={cn(
                        "relative transition-all duration-500 flex items-center justify-center min-h-[300px]",
                        interactionActive ? "md:w-1/3 scale-90" : "md:w-1/2 scale-100"
                    )}>
                        {/* Liruf's Speech Bubble (Instruction) - Modern pill design */}
                        <div className={cn(
                            "absolute z-20 transition-all duration-300 ease-out md:-top-8 -top-4 left-1/2 -translate-x-1/2",
                            interactionActive ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 translate-y-2 pointer-events-none"
                        )}>
                            <div className="relative bg-white rounded-full shadow-lg px-6 py-3 md:px-8 md:py-4 text-center">
                                <p className="font-bold text-slate-700 text-base md:text-lg whitespace-nowrap">
                                    {STAGES[currentStage]?.instruction}
                                </p>
                                {/* Tail/Pointer */}
                                <svg
                                    className="absolute left-1/2 -translate-x-1/2 -bottom-2 w-6 h-3"
                                    viewBox="0 0 24 12"
                                    fill="none"
                                >
                                    <path d="M0 0C4 0 8 8 12 12C16 8 20 0 24 0H0Z" fill="white" />
                                </svg>
                            </div>
                        </div>

                        <DinoCharacter
                            className="w-full max-w-[400px]"
                            showBubble={!interactionActive && isPlaying && !!currentText} // Show bubble when playing
                            currentText={currentText}
                            mood={interactionActive ? 'excited' : 'happy'}
                            bubblePosition="demo"
                        />
                    </div>

                    {/* Right: Interactive Stage */}
                    <div className="flex-1 flex flex-col justify-center">

                        {/* STAGE 0: Start Screen */}
                        {currentStage === 0 && !isPlaying && !interactionActive && (
                            <div className="text-center animate-in zoom-in duration-500 bg-white/50 backdrop-blur-sm p-8 rounded-3xl border border-white shadow-sm">
                                <h1 className="text-4xl font-extrabold text-indigo-700 mb-4">¿Qué es el Dinero?</h1>
                                <p className="text-xl text-gray-500 mb-8">Lección 1</p>
                                <Button
                                    onClick={startLesson}
                                    disabled={!audioReady}
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white text-xl font-bold px-12 py-6 rounded-2xl shadow-[0_4px_0_rgb(79,70,229)] hover:shadow-[0_2px_0_rgb(79,70,229)] hover:translate-y-[2px] transition-all"
                                >
                                    {audioReady ? <><Play className="mr-2 w-6 h-6" /> ¡EMPEZAR!</> : "Cargando..."}
                                </Button>
                            </div>
                        )}

                        {/* STAGE 1: Passive Listening (No UI needed, just Liruf speaking) */}
                        {currentStage === 0 && isPlaying && (
                            <div className="hidden"></div>
                        )}

                        {/* STAGE 1: Barter Game */}
                        {currentStage === 0 && interactionActive && (
                            <div className="bg-white rounded-3xl p-8 border-2 border-gray-100 shadow-xl text-center">
                                <h2 className="text-2xl font-bold text-gray-800 mb-8">¡Haz un Trueque!</h2>

                                <div className="flex items-center justify-between gap-4 mb-8">
                                    {/* Player Item */}
                                    <div className={cn(
                                        "w-24 h-24 rounded-2xl flex items-center justify-center text-4xl border-4 transition-all duration-500 bg-indigo-50 border-indigo-200 cursor-pointer hover:scale-110",
                                        barterComplete ? "translate-x-[150%] opacity-0" : ""
                                    )} onClick={!barterComplete ? handleBarterSwap : undefined}>
                                        🧸
                                    </div>

                                    {/* Exchange Icon */}
                                    <div className="text-gray-300">
                                        <Repeat size={32} />
                                    </div>

                                    {/* Friend Item */}
                                    <div className={cn(
                                        "w-24 h-24 rounded-2xl flex items-center justify-center text-4xl border-4 transition-all duration-500 bg-orange-50 border-orange-200",
                                        barterComplete ? "-translate-x-[150%] scale-125 rotate-12 bg-green-100 border-green-400" : ""
                                    )}>
                                        {barterComplete ? "🧸" : "✏️"}
                                    </div>
                                </div>

                                {!barterComplete ? (
                                    <p className="text-gray-500 animate-bounce">👇 ¡Toca el oso para cambiarlo!</p>
                                ) : (
                                    <div className="text-green-500 font-bold text-xl animate-in slide-in-from-bottom">+ ¡Conseguiste Lápices!</div>
                                )}
                            </div>
                        )}

                        {/* STAGE 2: Money ID Quiz */}
                        {currentStage === 1 && interactionActive && (
                            <div className="bg-white rounded-3xl p-6 border-2 border-gray-100 shadow-xl">
                                <h2 className="text-xl font-bold text-gray-800 mb-6 text-center">Toca TODO lo que sea dinero:</h2>

                                <div className="grid grid-cols-2 gap-4 mb-6">
                                    {[
                                        { id: 'toy', icon: '🚗', name: 'Juguete' },
                                        { id: 'coin', icon: '🪙', name: 'Moneda' },
                                        { id: 'bill', icon: '💵', name: 'Billete' },
                                        { id: 'apple', icon: '🍎', name: 'Manzana' }
                                    ].map((item) => (
                                        <button
                                            key={item.id}
                                            onClick={() => handleQuizSelect(item.id)}
                                            className={cn(
                                                "p-4 rounded-xl border-2 flex flex-col items-center gap-2 transition-all hover:scale-105 active:scale-95",
                                                quizSelection.includes(item.id)
                                                    ? (['coin', 'bill'].includes(item.id) ? "bg-green-100 border-green-500" : "bg-red-100 border-red-500")
                                                    : "bg-gray-50 border-gray-200"
                                            )}
                                        >
                                            <span className="text-4xl">{item.icon}</span>
                                            <span className="font-bold text-gray-600">{item.name}</span>
                                        </button>
                                    ))}
                                </div>

                                {quizComplete && (
                                    <Button onClick={nextStage} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-xl shadow-[0_4px_0_rgb(79,70,229)] active:shadow-none active:translate-y-[4px]">
                                        ¡Correcto! Continuar <ArrowRight className="ml-2 w-5 h-5" />
                                    </Button>
                                )}
                            </div>
                        )}

                        {/* STAGE 3: Shopping */}
                        {currentStage === 2 && interactionActive && (
                            <div className="bg-white rounded-3xl p-8 border-2 border-gray-100 shadow-xl text-center relative overflow-hidden">
                                <h2 className="text-2xl font-bold text-gray-800 mb-8">¡Compra un helado!</h2>

                                <div className="flex items-center justify-around mb-12">
                                    {/* Wallet */}
                                    <div className="flex flex-col items-center">
                                        <span className="text-sm font-bold text-gray-400 mb-2">TÚ</span>
                                        <div
                                            className={cn(
                                                "w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center text-4xl border-4 border-yellow-300 cursor-grab active:cursor-grabbing transition-all hover:scale-110 shadow-md z-10",
                                                shopComplete ? "scale-0 opacity-0" : ""
                                            )}
                                            onClick={handleBuyIceCream}
                                        >
                                            🪙
                                        </div>
                                    </div>

                                    <ArrowRight className="text-gray-300" />

                                    {/* Shop */}
                                    <div className="flex flex-col items-center">
                                        <span className="text-sm font-bold text-gray-400 mb-2">TIENDA</span>
                                        <div className={cn(
                                            "w-24 h-24 bg-pink-50 rounded-2xl flex items-center justify-center text-5xl border-4 border-pink-200 transition-all",
                                            shopComplete ? "scale-125 rotate-6 bg-green-100 border-green-500 shadow-none" : ""
                                        )}>
                                            {shopComplete ? "😋" : "🍦"}
                                        </div>
                                    </div>
                                </div>

                                {!shopComplete ? (
                                    <p className="text-gray-500 animate-pulse">👆 ¡Toca la moneda para pagar!</p>
                                ) : (
                                    <div className="text-green-500 font-bold text-2xl animate-in zoom-in">¡Qué rico!</div>
                                )}
                            </div>
                        )}

                    </div>
                </div>

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
                                ¡Completaste tu primera lección! 🌟
                            </DialogDescription>

                            <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 mt-4">
                                <p className="font-medium text-blue-800 mb-4">
                                    ¡Siguiente Aventura Desbloqueada!
                                </p>
                                <Button asChild className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-lg py-6 shadow-lg hover:scale-[1.02] transition-transform">
                                    <Link to="/demo/lecciones/2">Ir a Lección 2: ¿De dónde viene?</Link>
                                </Button>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>
        </DemoDashboardLayout>
    );
}
