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
    { time: 0, text: "¡Hola, pequeños emprendedores! 👋" },
    { time: 2, text: "Liruf aquí, con una pregunta importante. 🦖" },
    { time: 5, text: "Si el dinero nos ayuda con las necesidades y los deseos... 🤔" },
    { time: 8, text: "¿cómo conseguimos el nuestro? 💰" },
    { time: 11, text: "Hoy hablaremos de Tareas y Mesada: ✨" },
    { time: 14, text: "formas amigables de ganar dinero siendo niños. 👶" },
    { time: 17, text: "Primero, hablemos de las Tareas. 🧹" },
    { time: 20, text: "Son pequeñas responsabilidades en casa que ayudan a todos. 🏠" },
    { time: 24, text: "Por ejemplo: poner la mesa, regar las plantas, 🍽️🪴" },
    { time: 28, text: "guardar tus juguetes o alimentar a la mascota. 🧸🐶" },
    { time: 31, text: "Hacerlas sin que te lo pidan muestra que eres responsable ✅" },
    { time: 35, text: "y que formas parte de un equipo. 🤝" },
    { time: 37, text: "Muchas familias vinculan estas tareas con una Mesada 💵" },
    { time: 40, text: "semanal o mensual. 📅" },
    { time: 42, text: "La mesada no es un regalo mágico. ✨" },
    { time: 45, text: "¡Es como un pequeño salario por tu esfuerzo y colaboración! 💼" },
    { time: 49, text: "Es una forma de practicar: tú ayudas en casa, 🏠" },
    { time: 53, text: "y a cambio recibes una cantidad de dinero 💰" },
    { time: 55, text: "para aprender a administrarlo. 📉" },
    { time: 60, text: "Pero también hay otras formas creativas. 🎨" },
    { time: 63, text: "¿Tienes juguetes o libros en buen estado que ya no uses? 📚" },
    { time: 68, text: "Puedes organizar un mercado de garage con tus papás. 🏷️" },
    { time: 72, text: "¡Vender lo que ya no necesitas es genial! ♻️" },
    { time: 75, text: "En tu cumpleaños o en Navidad, puedes pedir dinero 🎁" },
    { time: 78, text: "en lugar de un regalo para ahorrar para algo más grande. 🐖" },
    { time: 81, text: "O, si eres más grande, puedes ofrecer ayuda a vecinos de confianza, 🏘️" },
    { time: 86, text: "como pasear perritos o regar sus plantas. 🐕" },
    { time: 89, text: "La clave es ganarlo con esfuerzo. 💪" },
    { time: 92, text: "Así, cuando tengas ese dinero en tus manos, lo valorarás mucho más. ❤️" },
    { time: 96, text: "Aprenderás a pensar: “¿Lo gasto en un dulce ahora, 🍬" },
    { time: 100, text: "o lo guardo para ese juego que tanto quiero?”. 🎮" },
    { time: 103, text: "Es tu primera práctica para ser el jefe de tu propio dinero. 👔" },
    { time: 106, text: "¡Tú decides, tú aprendes! 🧠" },
    { time: 109, text: "Así que, ¡a ayudar en casa y a usar la imaginación! 🚀" },
    { time: 113, text: "El esfuerzo tiene su recompensa. 🏆" },
    { time: 115, text: "¡Nos vemos en la próxima aventura aquí! 👋" }
];

const STAGES = [
    { id: 1, startTime: 0, pauseTime: 17, title: "Intro", instruction: "¡Escucha con atención!" },
    { id: 2, startTime: 17, pauseTime: 37, title: "Tareas Responsables", instruction: "Selecciona las tareas que ayudan en casa." },
    { id: 3, startTime: 37, pauseTime: 60, title: "Tu Mesada", instruction: "¿Qué hacer con tu mesada?" },
    { id: 4, startTime: 60, pauseTime: 89, title: "Formas Creativas", instruction: "Selecciona formas de ganar dinero." },
    { id: 5, startTime: 89, pauseTime: 999, title: "¡Esoo!", instruction: "¡Genial!" }
];

export function DemoLesson4() {
    // State
    const [currentStage, setCurrentStage] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [audioReady, setAudioReady] = useState(false);
    const [interactionActive, setInteractionActive] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [currentText, setCurrentText] = useState("");
    const [isCompleted, setIsCompleted] = useState(false);

    // Minigame States
    const [choresSelection, setChoresSelection] = useState<string[]>([]);
    const [choresComplete, setChoresComplete] = useState(false);

    const [mesadaSelection, setMesadaSelection] = useState<string[]>([]);
    const [mesadaComplete, setMesadaComplete] = useState(false);

    const [creativeSelection, setCreativeSelection] = useState<string[]>([]);
    const [creativeComplete, setCreativeComplete] = useState(false);

    const [showSuccess, setShowSuccess] = useState(false);

    const audioRef = useRef<HTMLAudioElement | null>(null);

    // Audio Setup
    // UseRef pattern to avoid re-binding listeners on every render
    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        const handleTimeUpdate = () => {
            const time = audio.currentTime;
            setCurrentTime(time);

            // Update subtitles
            const currentLine = SCRIPT.slice().reverse().find(s => time >= s.time);
            if (currentLine) setCurrentText(currentLine.text);

            // Check Stage Pauses
            const stage = STAGES[currentStage];

            // STRICT PAUSE LOGIC:
            // If we hit the pause time, we MUST pause if the stage is not complete.
            // We adding a small buffer (0.5s) to ensure we don't pause prematurely but definitely stops at the limit.
            if (time >= stage.pauseTime && isPlaying && !interactionActive) {

                let isStageComplete = false;
                if (currentStage === 1) isStageComplete = choresComplete;
                if (currentStage === 2) isStageComplete = mesadaComplete;
                if (currentStage === 3) isStageComplete = creativeComplete;
                if (currentStage === 0 || currentStage === 4) isStageComplete = true; // Auto-pass stages

                if (!isStageComplete) {
                    audio.pause();
                    setIsPlaying(false);
                    setInteractionActive(true);
                } else {
                    // If stage IS complete, we can auto-advance if we are at the boundary
                    // But to be safe and avoid skipping, we usually let the user 'complete' the game to trigger advance.
                    // If it's a non-interactive stage (Intro/Outro), we auto-advance.
                    if (currentStage === 0 || currentStage === 4) {
                        if (currentStage < STAGES.length - 1) {
                            setCurrentStage(prev => prev + 1);
                        } else if (currentStage === STAGES.length - 1) {
                            // End of lesson
                        }
                    }
                }
            }
        };

        const handleEnded = () => {
            handleLessonFinish();
        };

        audio.addEventListener('timeupdate', handleTimeUpdate);
        audio.addEventListener('loadedmetadata', () => setAudioReady(true));
        audio.addEventListener('ended', handleEnded);

        return () => {
            audio.removeEventListener('timeupdate', handleTimeUpdate);
            audio.removeEventListener('loadedmetadata', () => setAudioReady(true));
            audio.removeEventListener('ended', handleEnded);
        };
    }, [currentStage, isPlaying, interactionActive, choresComplete, mesadaComplete, creativeComplete]);

    const startLesson = () => {
        if (audioRef.current) {
            audioRef.current.play().catch(e => console.log("Audio autoplay blocked", e));
            setIsPlaying(true);
        }
    };

    const nextStage = () => {
        setInteractionActive(false);
        const nextIdx = currentStage + 1;

        if (nextIdx < STAGES.length) {
            setCurrentStage(nextIdx);

            // Critical: Ensure audio plays from the correct spot/resumes
            if (audioRef.current) {
                // If we paused exactly at the limit, playing resumes naturally.
                // If we want to be safe, we can bump usage slightly? No, standard play is fine.
                const promise = audioRef.current.play();
                if (promise !== undefined) {
                    promise.then(() => {
                        setIsPlaying(true);
                    }).catch(error => {
                        console.log("Play prevented", error);
                    });
                }
            }
        } else {
            handleLessonFinish();
        }
    };

    const handleLessonFinish = () => {
        setIsPlaying(false);
        setIsCompleted(true);
        localStorage.setItem('demo_lesson_4_completed', 'true');
        triggerConfettiLimit();
        setTimeout(() => setShowSuccess(true), 1500);
    };

    const triggerConfettiLimit = () => {
        const count = 200;
        const defaults = { origin: { y: 0.7 } };
        function fire(particleRatio: number, opts: any) {
            confetti({ ...defaults, ...opts, particleCount: Math.floor(count * particleRatio) });
        }
        fire(0.25, { spread: 26, startVelocity: 55 });
        fire(0.2, { spread: 60 });
        fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8 });
        fire(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 });
        fire(0.1, { spread: 120, startVelocity: 45 });
    };

    // --- Interaction Handlers ---

    // Stage 1: Chores Selection
    const handleChoreSelect = (id: string) => {
        if (choresComplete) return;

        const newSelection = choresSelection.includes(id)
            ? choresSelection.filter(i => i !== id)
            : [...choresSelection, id];

        setChoresSelection(newSelection);

        const correct = ['plants', 'pet'];
        const incorrect = ['candy', 'sleep'];

        const hasAllCorrect = correct.every(c => newSelection.includes(c));
        const hasNoIncorrect = !newSelection.some(i => incorrect.includes(i));

        if (hasAllCorrect && hasNoIncorrect) {
            setChoresComplete(true);
            triggerConfettiLimit();
            setTimeout(nextStage, 2000);
        }
    };

    // Stage 2: Mesada (NEW)
    const handleMesadaSelect = (id: string) => {
        if (mesadaComplete) return;

        const newSelection = mesadaSelection.includes(id)
            ? mesadaSelection.filter(i => i !== id)
            : [...mesadaSelection, id];

        setMesadaSelection(newSelection);

        const correct = ['save', 'plan'];
        const incorrect = ['waste', 'lose'];

        const hasAllCorrect = correct.every(c => newSelection.includes(c));
        const hasNoIncorrect = !newSelection.some(i => incorrect.includes(i));

        if (hasAllCorrect && hasNoIncorrect) {
            setMesadaComplete(true);
            triggerConfettiLimit();
            setTimeout(nextStage, 2000);
        }
    };


    // Stage 3: Creative Ways
    const handleCreativeSelect = (id: string) => {
        if (creativeComplete) return;

        const newSelection = creativeSelection.includes(id)
            ? creativeSelection.filter(i => i !== id)
            : [...creativeSelection, id];

        setCreativeSelection(newSelection);

        const goodIdeas = ['garage', 'walkdog', 'gift'];
        const badIdea = 'floor';

        // Simplify win condition: Found at least 2 good ideas and no bad ones
        const foundGood = newSelection.filter(i => goodIdeas.includes(i)).length;
        const hasBad = newSelection.includes(badIdea);

        if (foundGood >= 3 && !hasBad) {
            setCreativeComplete(true);
            triggerConfettiLimit();
            setTimeout(nextStage, 2000);
        }
    };

    // Progress Calculation
    const progress = isCompleted ? 100 : Math.min(100, (currentStage / (STAGES.length - 1)) * 100);

    return (
        <DemoDashboardLayout>
            <div className="max-w-6xl mx-auto p-6 h-[calc(100vh-100px)] flex flex-col">
                <audio ref={audioRef} src="/audio/1_8-10_TAREAS-Y-MESADAS.mp3" preload="auto" />

                {/* Header */}
                <div className="flex justify-between items-center mb-6 bg-white p-4 rounded-3xl shadow-sm border border-indigo-50">
                    <div className="flex items-center gap-4">
                        <Link to="/demo/lecciones">
                            <Button variant="ghost" className="rounded-full w-12 h-12 p-0 hover:bg-indigo-50">←</Button>
                        </Link>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-800">¡Ganando mis Monedas!</h1>
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-bold text-indigo-500 bg-indigo-50 px-3 py-1 rounded-full">
                                    Lección 4
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

                {/* Main Content Area */}
                <div className="flex-1 relative flex flex-col md:flex-row gap-6">

                    {/* Left: Liruf */}
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

                    {/* Right: Interactive Stage */}
                    <div className="flex-1 flex flex-col justify-center">

                        {/* Start Screen */}
                        {currentStage === 0 && !isPlaying && !interactionActive && (
                            <div className="text-center animate-in zoom-in duration-500 bg-white/50 backdrop-blur-sm p-8 rounded-3xl border border-white shadow-sm">
                                <h1 className="text-4xl font-extrabold text-indigo-700 mb-4">¿Cómo Ganar Dinero?</h1>
                                <p className="text-xl text-gray-500 mb-8">Lección 4</p>
                                <Button
                                    onClick={startLesson}
                                    disabled={!audioReady}
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white text-xl font-bold px-12 py-6 rounded-2xl shadow-[0_4px_0_rgb(79,70,229)] hover:shadow-[0_2px_0_rgb(79,70,229)] hover:translate-y-[2px] transition-all"
                                >
                                    {audioReady ? <><Play className="mr-2 w-6 h-6" /> ¡EMPEZAR!</> : "Cargando..."}
                                </Button>
                            </div>
                        )}

                        {/* Stage 1: Chores */}
                        {currentStage === 1 && interactionActive && (
                            <div className="bg-white rounded-3xl p-6 border-2 border-gray-100 shadow-xl">
                                <h2 className="text-xl font-bold text-gray-800 mb-6 text-center">Selecciona las tareas responsables:</h2>
                                <div className="grid grid-cols-2 gap-4">
                                    {[
                                        { id: 'plants', icon: '🪴', name: 'Regar Plantas', correct: true },
                                        { id: 'candy', icon: '🍬', name: 'Comer Dulces', correct: false },
                                        { id: 'pet', icon: '🐶', name: 'Cuidar Mascota', correct: true },
                                        { id: 'sleep', icon: '😴', name: 'Dormir Todo el Día', correct: false }
                                    ].map((item) => (
                                        <button
                                            key={item.id}
                                            onClick={() => handleChoreSelect(item.id)}
                                            className={cn(
                                                "p-4 rounded-xl border-2 flex flex-col items-center gap-2 transition-all hover:scale-105 active:scale-95",
                                                choresSelection.includes(item.id)
                                                    ? (item.correct ? "bg-green-100 border-green-500" : "bg-red-100 border-red-500")
                                                    : "bg-gray-50 border-gray-200"
                                            )}
                                        >
                                            <span className="text-4xl">{item.icon}</span>
                                            <span className="font-bold text-gray-600">{item.name}</span>
                                        </button>
                                    ))}
                                </div>
                                {choresComplete && <div className="mt-4 text-center text-green-600 font-bold text-xl animate-in fade-in">¡Muy Responsable!</div>}
                            </div>
                        )}

                        {/* Stage 2: Mesada (NEW) */}
                        {currentStage === 2 && interactionActive && (
                            <div className="bg-white rounded-3xl p-6 border-2 border-gray-100 shadow-xl">
                                <h2 className="text-xl font-bold text-gray-800 mb-6 text-center">¿Qué hacemos con la mesada?</h2>
                                <div className="grid grid-cols-2 gap-4">
                                    {[
                                        { id: 'save', icon: '🐖', name: 'Ahorrar', correct: true },
                                        { id: 'waste', icon: '🍬', name: 'Gastar Todo', correct: false },
                                        { id: 'plan', icon: '📉', name: 'Planear', correct: true },
                                        { id: 'lose', icon: '💸', name: 'Perderlo', correct: false }
                                    ].map((item) => (
                                        <button
                                            key={item.id}
                                            onClick={() => handleMesadaSelect(item.id)}
                                            className={cn(
                                                "p-4 rounded-xl border-2 flex flex-col items-center gap-2 transition-all hover:scale-105 active:scale-95",
                                                mesadaSelection.includes(item.id)
                                                    ? (item.correct ? "bg-green-100 border-green-500" : "bg-red-100 border-red-500")
                                                    : "bg-gray-50 border-gray-200"
                                            )}
                                        >
                                            <span className="text-4xl">{item.icon}</span>
                                            <span className="font-bold text-gray-600">{item.name}</span>
                                        </button>
                                    ))}
                                </div>
                                {mesadaComplete && <div className="mt-4 text-center text-green-600 font-bold text-xl animate-in fade-in">¡Experto en Finanzas!</div>}
                            </div>
                        )}


                        {/* Stage 3: Creative Ways */}
                        {currentStage === 3 && interactionActive && (
                            <div className="bg-white rounded-3xl p-6 border-2 border-gray-100 shadow-xl">
                                <h2 className="text-xl font-bold text-gray-800 mb-6 text-center">Selecciona formas de ganar dinero extra:</h2>
                                <div className="grid grid-cols-2 gap-4">
                                    {[
                                        { id: 'garage', icon: '🏷️', name: 'Venta de Garage', correct: true },
                                        { id: 'floor', icon: '👀', name: 'Buscar en el Suelo', correct: false },
                                        { id: 'walkdog', icon: '🐕', name: 'Pasear Perros', correct: true },
                                        { id: 'gift', icon: '🎁', name: 'Pedir en Cumpleaños', correct: true }
                                    ].map((item) => (
                                        <button
                                            key={item.id}
                                            onClick={() => handleCreativeSelect(item.id)}
                                            className={cn(
                                                "p-4 rounded-xl border-2 flex flex-col items-center gap-2 transition-all hover:scale-105 active:scale-95",
                                                creativeSelection.includes(item.id)
                                                    ? (item.correct ? "bg-green-100 border-green-500" : "bg-red-100 border-red-500")
                                                    : "bg-gray-50 border-gray-200"
                                            )}
                                        >
                                            <span className="text-4xl">{item.icon}</span>
                                            <span className="font-bold text-gray-600">{item.name}</span>
                                        </button>
                                    ))}
                                </div>
                                {creativeComplete && <div className="mt-4 text-center text-green-600 font-bold text-xl animate-in fade-in">¡Excelentes Ideas!</div>}
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
                                ¡Bien Hecho!
                            </DialogTitle>
                            <DialogDescription className="text-lg text-gray-600">
                                ¡Ya sabes cómo ganar tus propias monedas con esfuerzo!
                            </DialogDescription>

                            <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 mt-4">
                                <p className="font-medium text-blue-800 mb-4">
                                    ¡Siguiente Aventura Desbloqueada!
                                </p>
                                <Button asChild className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-lg py-6 shadow-lg hover:scale-[1.02] transition-transform">
                                    <Link to="/demo/lecciones/5">Ir a Lección 5: Decisiones Inteligentes</Link>
                                </Button>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>

            </div>
        </DemoDashboardLayout>
    );
}
