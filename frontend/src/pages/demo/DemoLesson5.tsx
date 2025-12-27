import { useState, useRef, useEffect } from "react";
import { DemoDashboardLayout } from "@/components/demo/DemoDashboardLayout";
import { DinoCharacter, DinoMood } from "@/components/demo/DinoCharacter";
import { Button } from "@/components/ui/button";
import { Play, PartyPopper, ArrowRight, CheckCircle, Search, Scale, Timer, ShieldCheck, Heart, Sparkles, Gem } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Link } from "react-router-dom";
import confetti from 'canvas-confetti';
import { cn } from "@/lib/utils";

// --- Types & Constants ---
type StageParams = {
    id: number;
    startTime: number;
    pauseTime: number;
    title: string;
    instruction: string;
};

const SCRIPT = [
    { time: 0, text: "¡Excelente verte de nuevo! 👋" },
    { time: 2, text: "Me da mucho gusto que sigas esta aventura. 🌟" },
    { time: 5, text: "Soy Liruf. 🦖" },
    { time: 7, text: "En lecciones pasadas aprendimos a ganar dinero. 💪" },
    { time: 12, text: "Ahora viene la parte más poderosa: ⚡" },
    { time: 15, text: "cómo usarlo sabiamente. 🧠" },
    { time: 18, text: "Hoy: Decisiones Inteligentes. 🛍️" },
    { time: 26, text: "Imagina que eres un explorador en una isla de tesoros. 🏝️" },
    { time: 30, text: "¿Agarras lo primero que ves? ¡No! 🙅‍♂️" },
    { time: 33, text: "Observas, comparas y eliges el mejor. 💎" },
    { time: 36, text: "Con el dinero pasa igual." },
    { time: 39, text: "Hacemos una pausa y nos hacemos Tres Preguntas Mágicas. ✨" },
    { time: 42, text: "Pregunta 1: ¿Lo necesito o solo lo deseo? 🤔" },
    { time: 47, text: "¿Es como el agua, o es como ese dulce? 🍬" },
    { time: 50, text: "Ya conoces la diferencia." },
    { time: 52, text: "Pregunta 2: ¿He buscado otras opciones? 🔍" },
    { time: 55, text: "Si quieres un juguete, mira si otro cuesta menos," },
    { time: 60, text: "o si hay uno mejor." },
    { time: 62, text: "Esto se llama comparar. ⚖️" },
    { time: 64, text: "Pregunta 3: ¿Qué voy a dejar de tener? 📉" },
    { time: 68, text: "Tu dinero es limitado. 💰" },
    { time: 70, text: "Si gastas en cromos hoy," },
    { time: 73, text: "tal vez no alcance para los colores de la escuela. ✏️" },
    { time: 78, text: "Te comparto un truco secreto: el 'tiempo de espera'. ⏳" },
    { time: 82, text: "Si ves algo que quieres, espera un día." },
    { time: 86, text: "Muchas veces, la emoción baja" },
    { time: 88, text: "y te das cuenta que no era importante. 📉" },
    { time: 90, text: "También, observa la calidad. ⭐" },
    { time: 93, text: "Algo barato que se rompe rápido," },
    { time: 95, text: "es más caro que algo que dura mucho. 🛡️" },
    { time: 100, text: "Recuerda: la publicidad quiere que compres YA. 📺" },
    { time: 107, text: "Tu superpoder es detenerte y pensar. 🛑" },
    { time: 111, text: "Esto te convierte en consumidor inteligente. 🤓" },
    { time: 119, text: "La próxima vez, hazte las Tres Preguntas. 🪄" },
    { time: 127, text: "Te sentirás orgulloso y tu alcancía feliz. 🐷" },
    { time: 133, text: "¡Sigue practicando! 🚀" },
    { time: 137, text: "¡Nos vemos! 👋" }
];

const STAGES: StageParams[] = [
    { id: 1, startTime: 0, pauseTime: 35, title: "Modo Explorador", instruction: "¡No agarres el primero!" },
    { id: 2, startTime: 35, pauseTime: 51, title: "¿Necesidad o Deseo?", instruction: "Clasifica correctamente" },
    { id: 3, startTime: 51, pauseTime: 63, title: "Comparando Precios", instruction: "Busca la mejor opción" },
    { id: 4, startTime: 63, pauseTime: 77, title: "Decisiones Difíciles", instruction: "Elige sabiamente" },
    { id: 5, startTime: 77, pauseTime: 89, title: "El Truco de Esperar", instruction: "¡Enfría tu emoción!" },
    { id: 6, startTime: 89, pauseTime: 99, title: "Prueba de Calidad", instruction: "¡Toca para probar!" },
    { id: 7, startTime: 99, pauseTime: 999, title: "Experto", instruction: "¡Felicidades!" }
];

export function DemoLesson5() {
    const [currentStage, setCurrentStage] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [audioReady, setAudioReady] = useState(false);
    const [interactionActive, setInteractionActive] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [currentText, setCurrentText] = useState("");
    const [showSuccess, setShowSuccess] = useState(false);
    const [dinoMood, setDinoMood] = useState<DinoMood>('happy');

    // --- Minigame States ---
    const [explorerState, setExplorerState] = useState<'searching' | 'found' | 'analyzing' | 'done'>('searching');
    const [game1Selection, setGame1Selection] = useState<string[]>([]);
    const [game1Done, setGame1Done] = useState(false);
    const [game2Selection, setGame2Selection] = useState<number | null>(null);
    const [game2Done, setGame2Done] = useState(false);
    const [game3Selection, setGame3Selection] = useState<'cromos' | 'colores' | null>(null);
    const [game3Done, setGame3Done] = useState(false);
    const [impulseLevel, setImpulseLevel] = useState(100);
    const [waitGameDone, setWaitGameDone] = useState(false);
    const [qualityTested, setQualityTested] = useState<string[]>([]);
    const [qualityGameDone, setQualityGameDone] = useState(false);

    const audioRef = useRef<HTMLAudioElement>(null);

    // --- Audio Logic ---
    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        const handleTimeUpdate = () => {
            const time = audio.currentTime;
            setCurrentTime(time);

            // Subtitles
            const activeLine = SCRIPT.slice().reverse().find(s => time >= s.time);
            setCurrentText(activeLine ? activeLine.text : "");

            // Pause Logic
            const stage = STAGES[currentStage];
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

    // --- Dino Mood Logic ---
    useEffect(() => {
        if (interactionActive) {
            setDinoMood('excited');
        } else {
            // Keep him mostly happy to be friendly!
            // Only 'thinking' when posing a specific hard question.
            if (currentTime >= 40 && currentTime < 45) setDinoMood('thinking'); // "Pregunta 1..."
            else if (currentTime >= 52 && currentTime < 55) setDinoMood('thinking'); // "Pregunta 2..."
            else if (currentTime >= 64 && currentTime < 67) setDinoMood('thinking'); // "Pregunta 3..."
            else if (currentTime >= 93 && currentTime < 96) setDinoMood('shocked'); // "Se rompe..."
            else setDinoMood('happy'); // Default happy
        }
    }, [currentTime, interactionActive]);

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
            audioRef.current?.play();
            setIsPlaying(true);
        } else {
            handleLessonFinish();
        }
    };

    const handleLessonFinish = () => {
        localStorage.setItem('demo_lesson_5_completed', 'true');
        triggerConfetti(150);
        setTimeout(() => setShowSuccess(true), 1500);
    };

    const triggerConfetti = (count = 100) => {
        confetti({ particleCount: count, spread: 70, origin: { y: 0.6 }, zIndex: 100 });
    };

    // --- Handlers ---

    // Game 1: Explorer
    const handleExplorerClick = () => {
        if (explorerState === 'searching') {
            setExplorerState('found'); // "Found chest!"
            setTimeout(() => setExplorerState('analyzing'), 1000); // "Wait, look closer"
        } else if (explorerState === 'analyzing') {
            setExplorerState('done');
            triggerConfetti(50);
            setTimeout(nextStage, 2000);
        }
    };

    // Game 2: Needs vs Wants
    const handleGame1Select = (item: string, type: 'need' | 'want') => {
        if (game1Done) return;
        if (type === 'want') return; // Shake effect handled by CSS potentially

        if (!game1Selection.includes(item)) {
            const newSel = [...game1Selection, item];
            setGame1Selection(newSel);
            if (newSel.length >= 2) { // 2 needs
                setGame1Done(true);
                triggerConfetti();
                setTimeout(nextStage, 1500);
            }
        }
    };

    // Game 3: Comparison
    const handleGame2Select = (id: number, isBest: boolean) => {
        if (game2Done) return;
        setGame2Selection(id);
        if (isBest) {
            setGame2Done(true);
            triggerConfetti();
            setTimeout(nextStage, 1500);
        } else {
            setTimeout(() => setGame2Selection(null), 1000);
        }
    };

    // Game 4: Opportunity Cost
    const handleGame3Select = (item: 'cromos' | 'colores') => {
        if (game3Done) return;
        if (item === 'colores') {
            setGame3Selection('colores');
            setGame3Done(true);
            triggerConfetti();
            setTimeout(nextStage, 2000);
        } else {
            // Show feedback
            setGame3Selection('cromos');
            setTimeout(() => setGame3Selection(null), 1500);
        }
    };

    // Game 5: Waiting Trick
    useEffect(() => {
        if (interactionActive && currentStage === 4) {
            const timer = setInterval(() => {
                if (!waitGameDone && impulseLevel > 80) {
                    // Auto-increase impulse if not waiting (simulating temptation)
                    // setImpulseLevel(p => Math.min(100, p + 1));
                }
            }, 100);
            return () => clearInterval(timer);
        }
    }, [interactionActive, currentStage, waitGameDone, impulseLevel]);

    const handleWaitClick = () => {
        if (waitGameDone) return;
        let p = impulseLevel;
        const interval = setInterval(() => {
            p -= 5;
            setImpulseLevel(p);
            if (p <= 0) {
                clearInterval(interval);
                setWaitGameDone(true);
                triggerConfetti();
                setTimeout(nextStage, 1500);
            }
        }, 50);
    };

    // Game 6: Quality
    const handleQualityTest = (item: string, isGood: boolean) => {
        if (qualityGameDone || qualityTested.includes(item)) return;

        if (!isGood) {
            setQualityTested([...qualityTested, item]);
            // Logic handled in render: item breaks
        } else {
            setQualityTested([...qualityTested, item]);
            setQualityGameDone(true);
            triggerConfetti();
            setTimeout(nextStage, 2000);
        }
    };

    const progress = Math.min(100, (currentStage / (STAGES.length - 1)) * 100);

    return (
        <DemoDashboardLayout>
            <div className="flex flex-col min-h-[calc(100vh-100px)] h-full relative max-w-6xl mx-auto p-4 font-sans text-slate-800">
                <audio ref={audioRef} src="/audio/1_8-10_DECISIONES-INTELIGENTES.mp3" preload="auto" />

                {/* --- HEADER --- */}
                <div className="flex justify-between items-center mb-6 bg-white p-4 rounded-3xl shadow-sm border border-indigo-50">
                    <div className="flex items-center gap-4">
                        <Link to="/demo/lecciones">
                            <Button variant="ghost" className="rounded-full w-12 h-12 p-0 hover:bg-indigo-50">←</Button>
                        </Link>
                        <div>
                            <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600">
                                Decisiones Inteligentes
                            </h1>
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-indigo-500 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100 uppercase tracking-wide">
                                    Lección 5
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* CORRECTED PROGRESS BAR */}
                    <div className="flex-1 max-w-md mx-8 hidden md:block">
                        <div className="flex justify-between text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">
                            <span>Progreso</span>
                            <span>{Math.round(progress)}%</span>
                        </div>
                        <div className="h-4 bg-gray-100 rounded-full overflow-hidden shadow-inner ring-1 ring-black/5">
                            <div
                                className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-1000 ease-out rounded-full relative overflow-hidden"
                                style={{ width: `${progress}%` }}
                            >
                                <div className="absolute inset-0 bg-white/30 w-full h-full animate-[shimmer_2s_infinite] skew-x-[-20deg]" />
                            </div>
                        </div>
                    </div>

                    <div className="bg-gradient-to-r from-yellow-100 to-orange-100 px-6 py-2 rounded-2xl font-bold text-yellow-700 border-2 border-yellow-200 shadow-[0_4px_0_rgb(234,179,8)] flex items-center gap-2 transform transition-transform hover:scale-105">
                        <span className="text-xl">⭐</span>
                        <span>{currentStage * 15} XP</span>
                    </div>
                </div>

                {/* --- CONTENT --- */}
                <div className="flex-1 relative flex flex-col md:flex-row gap-6">

                    {/* CHARACTER */}
                    <div className={cn(
                        "relative transition-all duration-500 flex items-center justify-center min-h-[350px]",
                        interactionActive ? "md:w-1/3 scale-90" : "md:w-1/2 scale-100"
                    )}>
                        <div className={cn(
                            "absolute z-20 bg-white border-2 border-slate-200 px-6 py-4 rounded-3xl shadow-xl transition-all duration-500 md:-top-16 -top-10 max-w-xs text-center transform",
                            interactionActive ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-4 scale-95"
                        )}>
                            <p className="font-bold text-slate-700 text-lg">{STAGES[currentStage]?.instruction}</p>
                            <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-6 h-6 bg-white border-b-2 border-r-2 border-slate-200 rotate-45 rounded-sm"></div>
                        </div>

                        <DinoCharacter
                            className="w-full max-w-[450px] drop-shadow-2xl"
                            showBubble={!interactionActive && isPlaying && !!currentText}
                            currentText={currentText}
                            mood={dinoMood}
                            bubblePosition="demo"
                        />
                    </div>

                    {/* INTERACTIVE AREA */}
                    <div className="flex-1 flex flex-col justify-center">

                        {/* START SCREEN */}
                        {currentStage === 0 && !isPlaying && !interactionActive && (
                            <div className="text-center animate-in zoom-in duration-500 bg-white/50 backdrop-blur-sm p-8 rounded-3xl border border-white shadow-sm">
                                <h1 className="text-4xl font-extrabold text-indigo-700 mb-4">Decisiones Inteligentes</h1>
                                <p className="text-xl text-gray-500 mb-8">Lección 5</p>
                                <Button
                                    onClick={startLesson}
                                    disabled={!audioReady}
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white text-xl font-bold px-12 py-6 rounded-2xl shadow-[0_4px_0_rgb(79,70,229)] hover:shadow-[0_2px_0_rgb(79,70,229)] hover:translate-y-[2px] transition-all"
                                >
                                    {audioReady ? <><Play className="mr-2 w-6 h-6" /> ¡EMPEZAR!</> : "Cargando..."}
                                </Button>
                            </div>
                        )}

                        {/* STAGE 1: EXPLORER GAME (NEW) */}
                        {currentStage === 0 && interactionActive && (
                            <div className="bg-white rounded-[2rem] p-8 border-4 border-amber-100 shadow-2xl text-center relative overflow-hidden">
                                <h2 className="text-2xl font-bold text-amber-900 mb-6 font-fredoka">¡Eres un Explorador!</h2>

                                {explorerState === 'searching' && (
                                    <div className="flex flex-col items-center gap-4 animate-in fade-in">
                                        <div className="text-8xl cursor-pointer hover:scale-110 transition-transform" onClick={handleExplorerClick}>📦</div>
                                        <p className="text-amber-700 font-bold bg-amber-50 px-4 py-2 rounded-lg animate-pulse">¡Encontraste algo! ¿Lo agarras?</p>
                                    </div>
                                )}

                                {explorerState === 'found' && (
                                    <div className="flex flex-col items-center gap-4">
                                        <div className="text-8xl scale-125 transition-transform">📦</div>
                                        <p className="text-red-500 text-2xl font-bold animate-bounce">¡ESPERA! 🛑</p>
                                        <p className="text-gray-500">Primero obsérvalo...</p>
                                    </div>
                                )}

                                {explorerState === 'analyzing' && (
                                    <div className="flex flex-col items-center gap-4 animate-in zoom-in">
                                        <div className="relative cursor-pointer group" onClick={handleExplorerClick}>
                                            <div className="text-8xl group-hover:opacity-0 transition-opacity">📦</div>
                                            <div className="text-8xl absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity animate-pulse">💎</div>
                                            <Search className="absolute -right-4 -bottom-4 w-12 h-12 text-indigo-600 animate-bounce" />
                                        </div>
                                        <p className="text-indigo-600 font-bold">¡Usa la lupa! (Toca la caja)</p>
                                    </div>
                                )}

                                {explorerState === 'done' && (
                                    <div className="text-green-600 font-bold text-2xl animate-in zoom-in">¡Es un Diamante Real! 💎</div>
                                )}
                            </div>
                        )}

                        {/* STAGE 2: NEEDS vs WANTS */}
                        {currentStage === 1 && interactionActive && (
                            <div className="bg-white rounded-[2rem] p-8 border-4 border-indigo-50 shadow-2xl">
                                <h2 className="text-2xl font-bold text-indigo-900 mb-6 text-center">Toca solo lo que NECESITAS</h2>
                                <div className="grid grid-cols-2 gap-4">
                                    {[
                                        { id: 'water', icon: '💧', name: 'Agua', type: 'need' },
                                        { id: 'candy', icon: '🍬', name: 'Dulce', type: 'want' },
                                        { id: 'food', icon: '🍎', name: 'Comida', type: 'need' },
                                        { id: 'toy', icon: '🤖', name: 'Robot', type: 'want' }
                                    ].map(item => (
                                        <button
                                            key={item.id}
                                            onClick={() => handleGame1Select(item.name, item.type as any)}
                                            className={cn(
                                                "p-4 rounded-2xl border-2 flex flex-col items-center transition-all bg-gray-50",
                                                game1Selection.includes(item.name)
                                                    ? "bg-green-100 border-green-500 scale-95 ring-2 ring-green-300"
                                                    : "hover:scale-105 hover:bg-white hover:shadow-lg border-gray-200"
                                            )}
                                        >
                                            <span className="text-5xl mb-2 filter drop-shadow-sm">{item.icon}</span>
                                            <span className="font-bold text-gray-600">{item.name}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* STAGE 3: PRICE COMPARISON */}
                        {currentStage === 2 && interactionActive && (
                            <div className="bg-white rounded-[2rem] p-6 border-4 border-blue-50 shadow-2xl">
                                <h2 className="text-xl font-bold text-blue-900 mb-4 text-center">¡Mismo juguete, diferente precio!</h2>
                                <div className="flex gap-4 justify-center items-stretch">
                                    <button
                                        onClick={() => handleGame2Select(1, false)}
                                        className={cn(
                                            "flex-1 p-4 rounded-2xl border-2 flex flex-col items-center transition-all",
                                            game2Selection === 1 ? "bg-red-50 border-red-400 shake" : "hover:shadow-lg hover:-translate-y-1 bg-white border-gray-100"
                                        )}
                                    >
                                        <div className="text-5xl mb-2">🏎️</div>
                                        <div className="font-bold text-gray-500">Tienda Loca</div>
                                        <div className="text-3xl font-black text-red-500 mt-2">$20</div>
                                    </button>

                                    <button
                                        onClick={() => handleGame2Select(2, true)}
                                        className={cn(
                                            "flex-1 p-4 rounded-2xl border-2 flex flex-col items-center transition-all relative overflow-hidden",
                                            game2Selection === 2 ? "bg-green-50 border-green-500 ring-4 ring-green-200" : "hover:shadow-lg hover:-translate-y-1 bg-white border-gray-100"
                                        )}
                                    >
                                        <div className="absolute top-0 right-0 bg-yellow-400 text-yellow-900 text-xs font-bold px-2 py-1 rounded-bl-lg">¡OFERTA!</div>
                                        <div className="text-5xl mb-2">🏎️</div>
                                        <div className="font-bold text-gray-500">Tienda Justa</div>
                                        <div className="text-3xl font-black text-green-600 mt-2">$12</div>
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* STAGE 4: OPPORTUNITY COST */}
                        {currentStage === 3 && interactionActive && (
                            <div className="bg-white rounded-[2rem] p-6 border-4 border-purple-50 shadow-2xl text-center">
                                <div className="inline-flex items-center gap-2 bg-yellow-100 px-4 py-2 rounded-full text-yellow-800 font-bold mb-6">
                                    <span>👛 Tu Presupuesto:</span>
                                    <span className="text-2xl">$5</span>
                                </div>
                                <h2 className="text-xl font-bold text-purple-900 mb-4">Solo te alcanza para uno. <br />¿Cuál es MÁS importante?</h2>

                                <div className="flex justify-center gap-6">
                                    <button
                                        onClick={() => handleGame3Select('cromos')}
                                        className={cn(
                                            "relative group p-4 rounded-2xl border-2 transition-all w-32",
                                            game3Selection === 'cromos' ? "border-red-400 bg-red-50" : "border-gray-100 hover:border-purple-200 bg-white"
                                        )}
                                    >
                                        <div className="text-5xl mb-2 grayscale group-hover:grayscale-0 transition-all">🃏</div>
                                        <div className="font-bold text-sm text-gray-600">Cromos</div>
                                        <div className="text-lg font-bold text-purple-600">$3</div>
                                        {game3Selection === 'cromos' && <span className="absolute -bottom-8 left-0 right-0 text-xs text-red-500 font-bold">¡No es urgente!</span>}
                                    </button>

                                    <button
                                        onClick={() => handleGame3Select('colores')}
                                        className={cn(
                                            "relative group p-4 rounded-2xl border-2 transition-all w-32",
                                            game3Done ? "border-green-500 bg-green-50 ring-4 ring-green-100" : "border-gray-100 hover:border-green-300 bg-white"
                                        )}
                                    >
                                        <div className="absolute -top-3 -right-3 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full animate-bounce">ESCUELA</div>
                                        <div className="text-5xl mb-2">✏️</div>
                                        <div className="font-bold text-sm text-gray-600">Colores</div>
                                        <div className="text-lg font-bold text-purple-600">$4</div>
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* STAGE 5: WAITING TRICK (NEW) */}
                        {currentStage === 4 && interactionActive && (
                            <div className="bg-white rounded-[2rem] p-8 border-4 border-orange-50 shadow-2xl text-center relative overflow-hidden">
                                <h2 className="text-2xl font-bold text-orange-900 mb-2">¡Lo quiero AHORA! 😡</h2>
                                <p className="text-sm text-gray-500 mb-6">Tu emoción está muy alta. ¡Bájala!</p>

                                <div className="flex items-center justify-center gap-8">
                                    {/* Thermometer */}
                                    <div className="h-40 w-8 bg-gray-200 rounded-full relative overflow-hidden border-2 border-gray-300">
                                        <div
                                            className={cn("absolute bottom-0 w-full transition-all duration-300",
                                                impulseLevel > 50 ? "bg-red-500" : "bg-green-500"
                                            )}
                                            style={{ height: `${impulseLevel}%` }}
                                        />
                                    </div>

                                    {/* Button */}
                                    <button
                                        onClick={handleWaitClick}
                                        disabled={waitGameDone}
                                        className="bg-indigo-600 active:bg-indigo-800 hover:bg-indigo-700 text-white p-6 rounded-full shadow-lg hover:shadow-xl hover:scale-105 transition-all disabled:opacity-50 disabled:scale-100"
                                    >
                                        <Timer className={cn("w-12 h-12", waitGameDone ? "" : "animate-spin-slow")} />
                                        <span className="block text-xs font-bold mt-1">
                                            {waitGameDone ? "¡Listo!" : "ESPERAR"}
                                        </span>
                                    </button>
                                </div>
                                {waitGameDone && <p className="mt-4 text-green-600 font-bold animate-in zoom-in">¡Uff! Ahora pienso mejor 🧠</p>}
                            </div>
                        )}

                        {/* STAGE 6: QUALITY CHECK (NEW) */}
                        {currentStage === 5 && interactionActive && (
                            <div className="bg-white rounded-[2rem] p-6 border-4 border-teal-50 shadow-2xl text-center">
                                <h2 className="text-xl font-bold text-teal-900 mb-6">Toca para probar la CALIDAD</h2>
                                <div className="flex gap-8 justify-center">
                                    {/* Cheap Item */}
                                    <button
                                        onClick={() => handleQualityTest('cheap', false)}
                                        className="group relative"
                                    >
                                        <div className={cn("text-7xl transition-all duration-300", qualityTested.includes('cheap') ? "scale-90 opacity-50 grayscale blur-sm" : "hover:scale-110")}>
                                            🚲
                                        </div>
                                        <div className="font-bold text-gray-400 mt-2">$5</div>
                                        {qualityTested.includes('cheap') && (
                                            <div className="absolute inset-0 flex items-center justify-center text-red-600 font-extrabold rotate-12 text-xl animate-in zoom-in">
                                                ¡ROTO! 💥
                                            </div>
                                        )}
                                    </button>

                                    {/* Quality Item */}
                                    <button
                                        onClick={() => handleQualityTest('good', true)}
                                        className="group relative"
                                    >
                                        <div className={cn("text-7xl transition-all duration-300", qualityGameDone ? "scale-125 drop-shadow-[0_0_15px_rgba(34,197,94,0.5)]" : "hover:scale-110")}>
                                            🚲
                                        </div>
                                        <div className="font-bold text-gray-400 mt-2">$15</div>
                                        {qualityGameDone && (
                                            <div className="absolute -top-4 -right-4 bg-green-500 text-white p-2 rounded-full animate-in zoom-in">
                                                <ShieldCheck size={24} />
                                            </div>
                                        )}
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* OUTRO ANIMATIONS */}
                        {currentStage > 5 && isPlaying && !interactionActive && (
                            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                                <div className="flex gap-4">
                                    <Heart className="text-pink-500 w-16 h-16 animate-bounce" style={{ animationDelay: '0s' }} />
                                    <Sparkles className="text-yellow-400 w-16 h-16 animate-pulse" style={{ animationDelay: '0.5s' }} />
                                    <Gem className="text-blue-500 w-16 h-16 animate-bounce" style={{ animationDelay: '1s' }} />
                                </div>
                            </div>
                        )}

                    </div>
                </div>

                {/* --- END SCREEN --- */}
                <Dialog open={showSuccess} onOpenChange={setShowSuccess}>
                    <DialogContent className="sm:max-w-lg bg-white/95 backdrop-blur-xl border-2 border-indigo-100 p-8 rounded-[2rem]">
                        <div className="text-center pt-4">
                            <div className="w-24 h-24 bg-gradient-to-br from-yellow-300 to-orange-400 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg animate-[bounce_2s_infinite]">
                                <span className="text-5xl">🎓</span>
                            </div>
                            <DialogTitle className="text-3xl font-bold bg-gradient-to-r from-yellow-500 to-orange-500 bg-clip-text text-transparent mb-2">
                                ¡Graduado en Compras!
                            </DialogTitle>
                            <DialogDescription className="text-center text-lg text-slate-500 mb-8 leading-relaxed">
                                Has aprendido a detenerte, comparar y elegir lo mejor. <br />
                                <strong className="text-indigo-600">¡Tu dinero está seguro contigo!</strong>
                            </DialogDescription>
                            <Link to="/demo/lecciones">
                                <Button className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xl font-bold py-6 rounded-2xl shadow-lg hover:scale-[1.02] transition-all">
                                    Volver al Mapa 🗺️
                                </Button>
                            </Link>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>
        </DemoDashboardLayout>
    );
}
