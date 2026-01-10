import { useState, useRef, useEffect } from "react";
import { DemoDashboardLayout } from "@/components/demo/DemoDashboardLayout";
import { DinoCharacter } from "@/components/demo/DinoCharacter";
import { Button } from "@/components/ui/button";
import { Play, PartyPopper } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Link } from "react-router-dom";
import confetti from 'canvas-confetti';
import { cn } from "@/lib/utils";

// --- Script & Stages ---
const SCRIPT = [
    { time: 0, text: "¡Hola, pequeños planificadores! Soy Liruf. 🦖" },
    { time: 4, text: "De vuelta para otra misión financiera. 🚀" },
    { time: 7, text: "Ya sabemos qué es el dinero y de dónde viene. 💰" },
    { time: 9, text: "Pero, ¿cómo decidimos en qué gastarlo? 🤔" },
    { time: 11, text: "Hoy aprenderemos la diferencia más importante: ✨" },
    { time: 14, text: "Necesidades vs. Deseos. 🆚" },
    { time: 18, text: "Las Necesidades son cosas sin las que no podemos vivir. 🏠" },
    { time: 22, text: "Son como el agua para una planta. 💧🌱" },
    { time: 25, text: "Por ejemplo: comida saludable, 🍎" },
    { time: 26, text: "una casa donde vivir, 🏡" },
    { time: 28, text: "ropa para abrigarnos 👕" },
    { time: 29, text: "y la medicina si nos enfermamos. 💊" },
    { time: 31, text: "Son lo primero en lo que debemos usar ☝️" },
    { time: 33, text: "nuestro dinero o el de nuestra familia. 👨‍👩‍👧‍👦" },
    { time: 36, text: "Luego están los Deseos. 🎁" },
    { time: 38, text: "¡Son súper divertidos, pero no son esenciales! 🎈" },
    { time: 42, text: "Como ese videojuego nuevo, 🎮" },
    { time: 43, text: "unos zapatos brillantes que ya tienes 5 pares, 👟" },
    { time: 47, text: "o un juguete gigante. 🧸" },
    { time: 49, text: "Nos hacen felices, pero podemos vivir sin ellos. 😊" },
    { time: 53, text: "Aquí está el truco de sabiduría: 🧠" },
    { time: 56, text: "Después de cubrir las necesidades, ✅" },
    { time: 58, text: "podemos ahorrar poco a poco para nuestros deseos. 🐖" },
    { time: 61, text: "Imagina que tu dinero es una pizza. 🍕" },
    { time: 64, text: "Primero, repartes los pedazos grandes para las necesidades 🍰" },
    { time: 68, text: "(comida, casa). 🏠🍎" },
    { time: 70, text: "Si sobra un pedacito, lo puedes guardar 🤏" },
    { time: 72, text: "en la alcancía para, con calma, 🏦" },
    { time: 75, text: "comprar ese deseo especial. 💖" },
    { time: 77, text: "Así aprendemos a ser inteligentes con el dinero: 💡" },
    { time: 80, text: "primero lo esencial, luego lo divertido. ⚖️" },
    { time: 84, text: "¡Recuerda esta lección la próxima vez 📝" },
    { time: 86, text: "que quieras comprar algo! 🛒" },
    { time: 88, text: "¡Nos vemos en la próxima aventura aquí! 👋" }
];

const STAGES = [
    { id: 1, startTime: 0, pauseTime: 36, title: "Necesidades", instruction: "Selecciona lo que NECESITAMOS para vivir." },
    { id: 2, startTime: 36, pauseTime: 50, title: "Deseos", instruction: "Selecciona lo que son solo DESEOS." },
    { id: 3, startTime: 50, pauseTime: 77, title: "Presupuesto Pizza", instruction: "Reparte la pizza: ¡Necesidades primero!" },
    { id: 4, startTime: 77, pauseTime: 999, title: "¡Fin!", instruction: "¡Excelente Planificador!" }
];

export function DemoLesson3() {
    // State
    const [currentStage, setCurrentStage] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [audioReady, setAudioReady] = useState(false);
    const [interactionActive, setInteractionActive] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [currentText, setCurrentText] = useState("");
    const [isCompleted, setIsCompleted] = useState(false);

    // Minigame States
    const [needsSelection, setNeedsSelection] = useState<string[]>([]);
    const [needsComplete, setNeedsComplete] = useState(false);

    const [wantsSelection, setWantsSelection] = useState<string[]>([]);
    const [wantsComplete, setWantsComplete] = useState(false);

    const [pizzaSlices, setPizzaSlices] = useState<{ type: 'need' | 'want' | 'empty' }[]>(Array(6).fill({ type: 'empty' }));
    const [pizzaComplete, setPizzaComplete] = useState(false);

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
        setIsCompleted(true);
        localStorage.setItem('demo_lesson_3_completed', 'true');
        triggerConfetti();
        setTimeout(() => {
            setShowSuccess(true);
        }, 1500);
    };

    const triggerConfetti = () => {
        confetti({
            particleCount: 150,
            spread: 70,
            origin: { y: 0.6 },
            zIndex: 100
        });
    };

    // --- Minigame Handlers ---

    // Stage 1: Identify Needs
    const handleNeedSelect = (id: string) => {
        if (needsComplete) return;
        const newSelection = needsSelection.includes(id)
            ? needsSelection.filter(i => i !== id)
            : [...needsSelection, id];
        setNeedsSelection(newSelection);

        const required = ['food', 'home', 'meds'];
        const hasRequired = required.every(r => newSelection.includes(r));
        const noWrong = !newSelection.some(s => ['toy', 'game'].includes(s));

        if (hasRequired && noWrong) {
            setNeedsComplete(true);
            triggerConfetti();
            setTimeout(nextStage, 2000);
        }
    };

    // Stage 2: Identify Wants
    const handleWantSelect = (id: string) => {
        if (wantsComplete) return;
        const newSelection = wantsSelection.includes(id)
            ? wantsSelection.filter(i => i !== id)
            : [...wantsSelection, id];
        setWantsSelection(newSelection);

        const required = ['game', 'shoes'];
        const hasRequired = required.every(r => newSelection.includes(r));
        const noWrong = !newSelection.some(s => ['food', 'meds'].includes(s));

        if (hasRequired && noWrong) {
            setWantsComplete(true);
            triggerConfetti();
            setTimeout(nextStage, 2000);
        }
    };

    // Stage 3: Pizza Budget
    const handleAddSlice = (type: 'need' | 'want') => {
        if (pizzaComplete) return;

        // Find first empty slice
        const emptyIndex = pizzaSlices.findIndex(s => s.type === 'empty');
        if (emptyIndex === -1) return;

        const newSlices = [...pizzaSlices];
        newSlices[emptyIndex] = { type };
        setPizzaSlices(newSlices);

        // Check if full
        if (emptyIndex === 5) {
            // Validate: Should have mostly needs (e.g. at least 4 needs)
            const needsCount = newSlices.filter(s => s.type === 'need').length;
            if (needsCount >= 4) {
                setPizzaComplete(true);
                triggerConfetti();
                setTimeout(nextStage, 2500);
            } else {
                // Reset if bad budget (too many wants)
                setTimeout(() => {
                    setPizzaSlices(Array(6).fill({ type: 'empty' }));
                    // Optional: Show "Try again, prioritize needs!" toast/text
                }, 1000);
            }
        }
    };


    // Progress Calculation
    const progress = isCompleted ? 100 : Math.min(100, (currentStage / (STAGES.length - 1)) * 100);

    return (
        <DemoDashboardLayout>
            <div className="flex flex-col min-h-[calc(100vh-100px)] h-full relative max-w-6xl mx-auto p-4 font-sans">
                <audio ref={audioRef} src="/audio/1_8-10_NECESIDADES-VS-DESEOS.mp3" preload="auto" />

                {/* Header */}
                <div className="flex justify-between items-center mb-6 bg-white p-4 rounded-3xl shadow-sm border border-indigo-50">
                    <div className="flex items-center gap-4">
                        <Link to="/demo/lecciones">
                            <Button variant="ghost" className="rounded-full w-12 h-12 p-0 hover:bg-indigo-50">←</Button>
                        </Link>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-800">Necesidades vs Deseos</h1>
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-bold text-indigo-500 bg-indigo-50 px-3 py-1 rounded-full">
                                    Lección 3
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

                <div className="flex-1 relative flex flex-col md:flex-row gap-6">
                    {/* Character */}
                    <div className={cn(
                        "relative transition-all duration-500 flex items-center justify-center min-h-[300px]",
                        interactionActive ? "md:w-1/3 scale-90" : "md:w-1/2 scale-100"
                    )}>
                        {/* Instruction Bubble - Modern pill design */}
                        <div className={cn(
                            "absolute z-20 transition-all duration-300 ease-out md:-top-8 -top-4 left-1/2 -translate-x-1/2",
                            interactionActive ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 translate-y-2 pointer-events-none"
                        )}>
                            <div className="relative bg-white rounded-full shadow-lg px-6 py-3 md:px-8 md:py-4 text-center">
                                <p className="font-bold text-slate-700 text-sm md:text-base whitespace-nowrap">
                                    {STAGES[currentStage]?.instruction}
                                </p>
                                <svg className="absolute left-1/2 -translate-x-1/2 -bottom-2 w-6 h-3" viewBox="0 0 24 12" fill="none">
                                    <path d="M0 0C4 0 8 8 12 12C16 8 20 0 24 0H0Z" fill="white" />
                                </svg>
                            </div>
                        </div>

                        <DinoCharacter
                            className="w-full max-w-[400px]"
                            showBubble={!interactionActive && isPlaying && !!currentText}
                            currentText={currentText}
                            mood={interactionActive ? 'excited' : 'happy'}
                            bubblePosition="demo"
                        />
                    </div>

                    {/* Interactive Area */}
                    <div className="flex-1 flex flex-col justify-center">

                        {/* Start Screen */}
                        {currentStage === 0 && !isPlaying && !interactionActive && (
                            <div className="text-center animate-in zoom-in duration-500 bg-white/50 backdrop-blur-sm p-8 rounded-3xl border border-white shadow-sm">
                                <h1 className="text-4xl font-extrabold text-indigo-700 mb-4">Necesidades vs Deseos</h1>
                                <p className="text-xl text-gray-500 mb-8">Lección 3</p>
                                <Button
                                    onClick={startLesson}
                                    disabled={!audioReady}
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white text-xl font-bold px-12 py-6 rounded-2xl shadow-[0_4px_0_rgb(79,70,229)] hover:shadow-[0_2px_0_rgb(79,70,229)] hover:translate-y-[2px] transition-all"
                                >
                                    {audioReady ? <><Play className="mr-2 w-6 h-6" /> ¡EMPEZAR!</> : "Cargando..."}
                                </Button>
                            </div>
                        )}

                        {/* Stage 1: NEEDS */}
                        {currentStage === 0 && interactionActive && (
                            <div className="bg-white rounded-3xl p-6 border-2 border-gray-100 shadow-xl">
                                <h2 className="text-xl font-bold text-gray-800 mb-6 text-center">Selecciona solo lo que NECESITAMOS:</h2>
                                <div className="grid grid-cols-2 gap-4">
                                    {[
                                        { id: 'home', icon: '🏠', name: 'Casa', correct: true },
                                        { id: 'toy', icon: '🧸', name: 'Juguetes', correct: false },
                                        { id: 'food', icon: '🍎', name: 'Comida', correct: true },
                                        { id: 'meds', icon: '💊', name: 'Medicina', correct: true }
                                    ].map((item) => (
                                        <button
                                            key={item.id}
                                            onClick={() => handleNeedSelect(item.id)}
                                            className={cn(
                                                "p-4 rounded-xl border-2 flex flex-col items-center gap-2 transition-all hover:scale-105 active:scale-95",
                                                needsSelection.includes(item.id)
                                                    ? (item.correct ? "bg-green-100 border-green-500" : "bg-red-100 border-red-500")
                                                    : "bg-gray-50 border-gray-200"
                                            )}
                                        >
                                            <span className="text-4xl">{item.icon}</span>
                                            <span className="font-bold text-gray-600">{item.name}</span>
                                        </button>
                                    ))}
                                </div>
                                {needsComplete && <div className="mt-4 text-center text-green-600 font-bold text-xl animate-in fade-in">¡Correcto!</div>}
                            </div>
                        )}

                        {/* Stage 2: WANTS */}
                        {currentStage === 1 && interactionActive && (
                            <div className="bg-white rounded-3xl p-6 border-2 border-gray-100 shadow-xl">
                                <h2 className="text-xl font-bold text-gray-800 mb-6 text-center">Selecciona los DESEOS (Divertidos pero no esenciales):</h2>
                                <div className="grid grid-cols-2 gap-4">
                                    {[
                                        { id: 'game', icon: '🎮', name: 'Videojuego', correct: true },
                                        { id: 'food', icon: '🍎', name: 'Comida', correct: false },
                                        { id: 'shoes', icon: '👟', name: 'Zapatos Extra', correct: true },
                                        { id: 'meds', icon: '💊', name: 'Medicina', correct: false }
                                    ].map((item) => (
                                        <button
                                            key={item.id}
                                            onClick={() => handleWantSelect(item.id)}
                                            className={cn(
                                                "p-4 rounded-xl border-2 flex flex-col items-center gap-2 transition-all hover:scale-105 active:scale-95",
                                                wantsSelection.includes(item.id)
                                                    ? (item.correct ? "bg-green-100 border-green-500" : "bg-red-100 border-red-500")
                                                    : "bg-gray-50 border-gray-200"
                                            )}
                                        >
                                            <span className="text-4xl">{item.icon}</span>
                                            <span className="font-bold text-gray-600">{item.name}</span>
                                        </button>
                                    ))}
                                </div>
                                {wantsComplete && <div className="mt-4 text-center text-green-600 font-bold text-xl animate-in fade-in">¡Correcto!</div>}
                            </div>
                        )}

                        {/* Stage 3: PIZZA BUDGET */}
                        {currentStage === 2 && interactionActive && (
                            <div className="bg-white rounded-3xl p-6 border-2 border-gray-100 shadow-xl text-center">
                                <h2 className="text-xl font-bold text-gray-800 mb-6">Reparte la Pizza del Dinero</h2>

                                {/* Pizza Visual */}
                                <div className="relative w-48 h-48 mx-auto mb-6 rounded-full border-4 border-yellow-200 bg-yellow-50 overflow-hidden flex flex-wrap">
                                    {pizzaSlices.map((slice, idx) => (
                                        <div key={idx} className={cn(
                                            "w-1/2 h-1/3 border border-white flex items-center justify-center transition-all",
                                            slice.type === 'need' ? "bg-blue-400" :
                                                slice.type === 'want' ? "bg-pink-400" : "bg-transparent"
                                        )}>
                                            {slice.type === 'need' && <span className="text-2xl">🏠</span>}
                                            {slice.type === 'want' && <span className="text-2xl">🎮</span>}
                                        </div>
                                    ))}
                                </div>

                                {!pizzaComplete ? (
                                    <div className="flex gap-4 justify-center">
                                        <Button
                                            onClick={() => handleAddSlice('need')}
                                            className="bg-blue-500 hover:bg-blue-600 h-20 w-32 flex-col gap-1 text-lg"
                                        >
                                            <span className="text-2xl">🏠</span>
                                            Necesidad
                                        </Button>
                                        <Button
                                            onClick={() => handleAddSlice('want')}
                                            className="bg-pink-500 hover:bg-pink-600 h-20 w-32 flex-col gap-1 text-lg"
                                        >
                                            <span className="text-2xl">🎮</span>
                                            Deseo
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="text-green-500 font-bold text-2xl animate-in zoom-in">¡Buen Presupuesto!</div>
                                )}
                                <p className="text-sm text-gray-400 mt-4">Tip: ¡Llena la mayoría con necesidades!</p>
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
                                ¡Misión Cumplida!
                            </DialogTitle>
                            <DialogDescription className="text-lg text-gray-600">
                                ¡Eres un experto diferenciando Necesidades y Deseos!
                            </DialogDescription>

                            <div className="bg-purple-50 p-4 rounded-xl border border-purple-100 mt-4">
                                <p className="font-medium text-purple-800 mb-4">
                                    ¡Siguiente Aventura Desbloqueada!
                                </p>
                                <Button asChild className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-lg py-6 shadow-lg hover:scale-[1.02] transition-transform">
                                    <Link to="/demo/lecciones/4">Ir a Lección 4: ¡Ganando mis Monedas!</Link>
                                </Button>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>
        </DemoDashboardLayout>
    );
}
