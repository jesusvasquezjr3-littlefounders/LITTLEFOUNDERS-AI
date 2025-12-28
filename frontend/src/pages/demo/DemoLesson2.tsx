import { useState, useRef, useEffect } from "react";
import { DemoDashboardLayout } from "@/components/demo/DemoDashboardLayout";
import { DinoCharacter } from "@/components/demo/DinoCharacter";
import { Button } from "@/components/ui/button";
import { Play, PartyPopper, ArrowRight, Hammer, Coins } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Link } from "react-router-dom";
import confetti from 'canvas-confetti';
import { cn } from "@/lib/utils";

// --- Script & Stages ---
const SCRIPT = [
    { time: 0, text: "¡Hola, de nuevo, pequeños exploradores! 👋" },
    { time: 3, text: "Soy Liruf, su dinosaurio guía. 🦖" },
    { time: 6, text: "En la última aventura aprendimos qué es el dinero. 💰" },
    { time: 9, text: "¡Hoy responderemos una pregunta aún mejor! ✨" },
    { time: 11, text: "¿De dónde viene el dinero? 🤔" },
    { time: 13, text: "¿Lo planta el banco como un árbol? 🌳" },
    { time: 15, text: "¡Ja! No exactamente. 😂" },
    { time: 17, text: "Hace mucho tiempo, antes que yo, ⏳" },
    { time: 20, text: "la gente intercambiaba cosas directamente. 🔄" },
    { time: 22, text: "Pero eso era complicado. 😓" },
    { time: 24, text: "Así que empezamos a usar objetos especiales: ✨" },
    { time: 27, text: "conchas, sal o piedras bonitas. 🐚🧂🪨" },
    { time: 30, text: "Con el tiempo, para que fuera más fácil, 👍" },
    { time: 32, text: "los reyes y gobiernos crearon algo genial: 👑" },
    { time: 35, text: "¡las monedas y billetes! 🪙💵" },
    { time: 38, text: "Hoy, ese es un trabajo muy importante. 🏦" },
    { time: 41, text: "Una fábrica especial llamada Casa de la Moneda 🏭" },
    { time: 44, text: "los crea con máquinas súper seguras. ⚙️" },
    { time: 46, text: "Es como hacer galletas, 🍪" },
    { time: 48, text: "pero con diseños únicos y materiales 💎" },
    { time: 50, text: "que son muy difíciles de copiar. 🔐" },
    { time: 52, text: "Así que el dinero no crece en árboles... 🚫🌳" },
    { time: 54, text: "¡sale de una fábrica supervisada y protegida! 🛡️" },
    { time: 57, text: "¡Nos vemos en la próxima aventura aquí! 👋" }
];

type StageParams = {
    id: number;
    startTime: number;
    pauseTime: number;
    title: string;
    instruction: string;
};

const STAGES: StageParams[] = [
    { id: 1, startTime: 0, pauseTime: 28, title: "Historia", instruction: "¡Escucha la historia!" }, // 0-28s
    { id: 2, startTime: 28, pauseTime: 45, title: "Objetos Antiguos", instruction: "Toca lo que se usaba como dinero" }, // 28-45s
    { id: 3, startTime: 45, pauseTime: 60, title: "La Fábrica", instruction: "¡Ayuda a fabricar una moneda!" }, // 45-60s
    { id: 4, startTime: 60, pauseTime: 999, title: "¡Fin!", instruction: "¡Muy bien!" }
];

export function DemoLesson2() {
    // State
    const [currentStage, setCurrentStage] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [audioReady, setAudioReady] = useState(false);
    const [interactionActive, setInteractionActive] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [currentText, setCurrentText] = useState("");
    const [isCompleted, setIsCompleted] = useState(false);

    // Minigame States
    const [ancientSelection, setAncientSelection] = useState<string[]>([]);
    const [ancientComplete, setAncientComplete] = useState(false);
    const [mintProgress, setMintProgress] = useState(0); // 0-100 for tapping
    const [mintComplete, setMintComplete] = useState(false);
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
        localStorage.setItem('demo_lesson_2_completed', 'true');
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

    // Stage 1: Ancient Objects
    const handleAncientSelect = (item: string) => {
        if (ancientComplete) return;

        const newSelection = ancientSelection.includes(item)
            ? ancientSelection.filter(i => i !== item)
            : [...ancientSelection, item];

        setAncientSelection(newSelection);

        // Required: Shell, Salt, Stone. Wrong: Toy, Phone.
        const required = ['shell', 'salt', 'stone'];
        const hasRequired = required.every(r => newSelection.includes(r));
        const noWrong = !newSelection.some(s => ['toy', 'phone'].includes(s));

        if (hasRequired && noWrong) {
            setAncientComplete(true);
            triggerConfetti();
            setTimeout(nextStage, 2000);
        }
    };

    // Stage 2: Minting
    // Stage 2: Minting
    const handleMintTap = () => {
        if (mintComplete) return;
        const newProgress = mintProgress + 20;
        setMintProgress(newProgress);

        // Trigger animations
        const hammer = document.getElementById('hammer-icon');
        const coin = document.getElementById('coin-target');
        const flash = document.getElementById('impact-flash');

        if (hammer) {
            hammer.classList.remove('animate-smash');
            void hammer.offsetWidth; // trigger reflow
            hammer.classList.add('animate-smash');
        }

        if (coin) {
            coin.classList.remove('animate-shake');
            void coin.offsetWidth;
            coin.classList.add('animate-shake');
        }

        if (flash) {
            flash.classList.remove('animate-impact');
            void flash.offsetWidth;
            flash.classList.add('animate-impact');
        }

        // Add container shake for feel
        const container = document.getElementById('minting-game-container');
        if (container) {
            container.classList.remove('game-hit-shake');
            void container.offsetWidth;
            container.classList.add('game-hit-shake');
        }

        if (newProgress >= 100) {
            setMintComplete(true);
            triggerConfetti(); // Big finish
            // Add a bigger blast for the 100%
            confetti({
                particleCount: 100,
                spread: 160,
                origin: { y: 0.6 },
                colors: ['#FFD700', '#FFFFFF', '#FFA500']
            });
            setTimeout(nextStage, 2500);
        } else {
            // Impact sparkles
            confetti({
                particleCount: 15,
                angle: 60,
                spread: 55,
                origin: { x: 0.6, y: 0.7 },
                colors: ['#FFD700', '#FFA500']
            });
            confetti({
                particleCount: 15,
                angle: 120,
                spread: 55,
                origin: { x: 0.4, y: 0.7 },
                colors: ['#FFD700', '#FFA500']
            });
        }
    };

    // Progress Calculation
    const progress = isCompleted ? 100 : Math.min(100, ((currentStage + (interactionActive ? 1 : 0)) / STAGES.length) * 100);

    return (
        <DemoDashboardLayout>
            <div className="flex flex-col min-h-[calc(100vh-100px)] h-full relative max-w-6xl mx-auto p-4 font-sans">
                <audio ref={audioRef} src="/audio/1_8-10_DE-DONDE-VIENE-DINERO.mp3" preload="auto" />

                {/* Header */}
                <div className="flex justify-between items-center mb-6 bg-white p-4 rounded-3xl shadow-sm border border-indigo-50">
                    <div className="flex items-center gap-4">
                        <Link to="/demo/lecciones">
                            <Button variant="ghost" className="rounded-full w-12 h-12 p-0 hover:bg-indigo-50">←</Button>
                        </Link>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-800">De Dónde Viene el Dinero</h1>
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-bold text-indigo-500 bg-indigo-50 px-3 py-1 rounded-full">
                                    Lección 2
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
                        <div className={cn(
                            "absolute z-20 bg-white border-2 border-gray-200 px-6 py-3 rounded-2xl shadow-xl transition-all duration-300 md:-top-12 -top-6",
                            interactionActive ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
                        )}>
                            <p className="font-bold text-gray-700">{STAGES[currentStage]?.instruction}</p>
                            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-white border-b-2 border-r-2 border-gray-200 rotate-45"></div>
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
                                <h1 className="text-4xl font-extrabold text-indigo-700 mb-4">¿De Dónde Viene?</h1>
                                <p className="text-xl text-gray-500 mb-8">Lección 2</p>
                                <Button
                                    onClick={startLesson}
                                    disabled={!audioReady}
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white text-xl font-bold px-12 py-6 rounded-2xl shadow-[0_4px_0_rgb(79,70,229)] hover:shadow-[0_2px_0_rgb(79,70,229)] hover:translate-y-[2px] transition-all"
                                >
                                    {audioReady ? <><Play className="mr-2 w-6 h-6" /> ¡EMPEZAR!</> : "Cargando..."}
                                </Button>
                            </div>
                        )}

                        {/* Stage 1: Ancient Objects */}
                        {currentStage === 0 && interactionActive && (
                            <div className="bg-white rounded-3xl p-6 border-2 border-gray-100 shadow-xl">
                                <h2 className="text-xl font-bold text-gray-800 mb-6 text-center">Toca lo que se usaba antes como dinero:</h2>
                                <div className="grid grid-cols-2 gap-4">
                                    {[
                                        { id: 'shell', icon: '🐚', name: 'Conchas' },
                                        { id: 'toy', icon: '🤖', name: 'Juguetes' },
                                        { id: 'salt', icon: '🧂', name: 'Sal' },
                                        { id: 'stone', icon: '🪨', name: 'Piedras' }
                                    ].map((item) => (
                                        <button
                                            key={item.id}
                                            onClick={() => handleAncientSelect(item.id)}
                                            className={cn(
                                                "p-4 rounded-xl border-2 flex flex-col items-center gap-2 transition-all hover:scale-105 active:scale-95",
                                                ancientSelection.includes(item.id)
                                                    ? (['shell', 'salt', 'stone'].includes(item.id) ? "bg-green-100 border-green-500" : "bg-red-100 border-red-500")
                                                    : "bg-gray-50 border-gray-200"
                                            )}
                                        >
                                            <span className="text-4xl">{item.icon}</span>
                                            <span className="font-bold text-gray-600">{item.name}</span>
                                        </button>
                                    ))}
                                </div>
                                {ancientComplete && (
                                    <div className="mt-4 text-center text-green-600 font-bold text-xl animate-in fade-in">¡Correcto!</div>
                                )}
                            </div>
                        )}

                        {/* Stage 2: Minting (Redesigned) */}
                        {currentStage === 1 && interactionActive && (
                            <div id="minting-game-container" className="bg-slate-900 rounded-3xl p-8 border-4 border-slate-700 shadow-2xl text-center relative overflow-hidden transition-all duration-75 min-h-[500px] flex flex-col justify-between">
                                <style>{`
                                    @keyframes smash {
                                        0% { transform: rotate(0deg) scale(1); }
                                        40% { transform: rotate(-45deg) scale(1.2); } /* Wind up */
                                        100% { transform: rotate(0deg) scale(1); } /* Slam */
                                    }
                                    @keyframes shake {
                                        0%, 100% { transform: translateX(0) rotate(0deg); }
                                        25% { transform: translateX(-5px) rotate(-5deg); filter: brightness(1.5); }
                                        75% { transform: translateX(5px) rotate(5deg); }
                                    }
                                    @keyframes impact-glow {
                                        0% { box-shadow: 0 0 0 0 rgba(255, 200, 0, 0); }
                                        50% { box-shadow: 0 0 50px 20px rgba(255, 100, 0, 0.8); }
                                        100% { box-shadow: 0 0 0 0 rgba(255, 200, 0, 0); }
                                    }
                                    .animate-smash { animation: smash 0.15s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
                                    .animate-shake { animation: shake 0.2s ease-in-out; }
                                    .animate-impact { animation: impact-glow 0.2s ease-out; }
                                    .game-hit-shake { animation: game-shake 0.1s ease-in-out; }
                                    @keyframes game-shake {
                                        0%, 100% { transform: translate(0,0); }
                                        25% { transform: translate(-4px, 4px); }
                                        75% { transform: translate(4px, -4px); }
                                    }
                                `}</style>

                                {/* Header & Progress Gauge */}
                                <div className="z-10 relative">
                                    <h2 className="text-3xl font-black text-white mb-2 drop-shadow-md tracking-wider uppercase">
                                        <span className="text-yellow-400">⚡</span> Fábrica de Monedas <span className="text-yellow-400">⚡</span>
                                    </h2>
                                    <div className="flex items-center justify-center gap-4">
                                        <span className="text-xs text-slate-400 font-mono uppercase">Presión</span>
                                        <div className="w-64 h-6 bg-slate-800 rounded-full border border-slate-600 p-1 relative overflow-hidden shadow-inner">
                                            {/* Striped Background for Gauge */}
                                            <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 10px, #000 10px, #000 20px)' }}></div>

                                            <div
                                                className="h-full bg-gradient-to-r from-yellow-600 via-orange-500 to-red-600 rounded-full transition-all duration-200 shadow-[0_0_15px_rgba(249,115,22,0.6)]"
                                                style={{ width: `${mintProgress}%` }}
                                            />
                                        </div>
                                        <span className="text-xs font-bold text-orange-400 font-mono">{Math.round(mintProgress)}%</span>
                                    </div>
                                </div>

                                {/* Main Game Area */}
                                <div className="flex-1 relative flex items-center justify-center mt-8">

                                    {/* Anvil Base */}
                                    <div className="absolute bottom-10 w-48 h-20 bg-slate-600 rounded-lg transform perspective-[500px] rotateX(20deg) shadow-2xl border-t-4 border-slate-500"></div>

                                    {/* Coin Blank -> Coin */}
                                    <div className="relative z-20 mb-8">
                                        {/* Impact Flash under coin */}
                                        <div id="impact-flash" className="absolute inset-0 rounded-full bg-white opacity-0 transition-opacity duration-75 pointer-events-none blur-xl scale-150"></div>

                                        <div id="coin-target" className={cn(
                                            "w-32 h-32 rounded-full transition-all duration-300 flex items-center justify-center border-[6px] relative shadow-[0_10px_20px_rgba(0,0,0,0.5)]",
                                            mintComplete
                                                ? "bg-yellow-400 border-yellow-600 shadow-[0_0_50px_rgba(250,204,21,0.8)] scale-110 rotate-[360deg]"
                                                : "bg-slate-300 border-slate-400"
                                        )}>
                                            {/* Coin Details */}
                                            {mintComplete ? (
                                                <div className="text-center animate-bounce">
                                                    <span className="text-5xl font-black text-yellow-900 drop-shadow-sm">$1</span>
                                                    <div className="text-[10px] text-yellow-800 font-bold tracking-widest uppercase mt-1">LittleFounders</div>
                                                </div>
                                            ) : (
                                                <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-black/10 rounded-full" />
                                            )}
                                        </div>
                                    </div>

                                    {/* Giant Hammer */}
                                    <div className="absolute top-0 right-10 z-30 pointer-events-none">
                                        <div id="hammer-icon" className="origin-top-right transform transition-transform duration-75">
                                            {/* Drawing a big vector hammer looks better than icon due to pivot */}
                                            <svg width="200" height="200" viewBox="0 0 100 100" className="drop-shadow-2xl">
                                                {/* Handle */}
                                                <rect x="60" y="10" width="10" height="80" rx="2" fill="#8B4513" stroke="#5D4037" strokeWidth="2" />
                                                {/* Head */}
                                                <rect x="20" y="5" width="50" height="30" rx="4" fill="#555" stroke="#333" strokeWidth="2" />
                                                <rect x="22" y="7" width="46" height="26" rx="2" fill="url(#metal-grad)" opacity="0.5" />
                                                <defs>
                                                    <linearGradient id="metal-grad" x1="0" x2="0" y1="0" y2="1">
                                                        <stop offset="0%" stopColor="#999" />
                                                        <stop offset="50%" stopColor="#555" />
                                                        <stop offset="100%" stopColor="#333" />
                                                    </linearGradient>
                                                </defs>
                                            </svg>
                                        </div>
                                    </div>

                                    {/* Flying Sparks (CSS Particles) - Can be triggered by JS logic adding classes or just rely on canvas-confetti from parent */}
                                </div>

                                {/* Controls */}
                                <div className="z-20 relative px-12 pb-4">
                                    {!mintComplete ? (
                                        <Button
                                            size="lg"
                                            className="w-full text-2xl font-black py-8 bg-orange-600 hover:bg-orange-500 text-white shadow-[0_6px_0_rgb(154,52,18)] active:shadow-none active:translate-y-[6px] transition-all rounded-2xl border-2 border-orange-400 uppercase tracking-widest"
                                            onClick={handleMintTap}
                                        >
                                            <Hammer className="mr-3 w-8 h-8 animate-pulse" /> ¡GOLPEA!
                                        </Button>
                                    ) : (
                                        <div className="bg-green-500/20 backdrop-blur-sm border-2 border-green-500 text-green-400 font-bold text-3xl py-4 rounded-xl animate-in zoom-in slide-in-from-bottom-5">
                                            ✨ ¡MONEDA LISTA! ✨
                                        </div>
                                    )}
                                </div>
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
                                ¡Increíble!
                            </DialogTitle>
                            <DialogDescription className="text-lg text-gray-600">
                                ¡Sigue así! Estás a punto de desbloquear todo el mundo.
                            </DialogDescription>

                            <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 mt-4">
                                <p className="font-medium text-blue-800 mb-4">
                                    ¡Siguiente Aventura Desbloqueada!
                                </p>
                                <Button asChild className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-lg py-6 shadow-lg hover:scale-[1.02] transition-transform">
                                    <Link to="/demo/lecciones/3">Ir a Lección 3: Necesidades vs Deseos</Link>
                                </Button>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>
        </DemoDashboardLayout >
    );
}
