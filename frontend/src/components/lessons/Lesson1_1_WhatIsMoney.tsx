import React, { useState, useRef, useEffect } from "react";
import { DinoCharacter } from "./character/DinoCharacter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Play, RotateCcw, CheckCircle, ArrowRight, ShoppingCart, Repeat } from "lucide-react";
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
  { time: 1, text: "¡Hola, exploradores curiosos!" },
  { time: 3, text: "¿Listos para una aventura?" },
  { time: 5, text: "Hoy descubriremos un gran misterio:" },
  { time: 7, text: "¿Qué es el dinero?" },
  { time: 9, text: "Imagina que tienes un juguete que ya no usas" },
  { time: 12, text: "y tu amigo tiene unos lápices increíbles." },
  { time: 15, text: "Si cambian, ¡los dos ganan!" },
  { time: 18, text: "¡Eso se llama trueque!" },
  { time: 21, text: "Pero, ¿y si tu amigo no quiere el juguete?" },
  { time: 25, text: "Necesitamos algo que a todos les guste." },
  { time: 28, text: "¡El dinero es un superpoder de intercambio!" },
  { time: 32, text: "Es algo especial (como monedas o billetes)" },
  { time: 35, text: "que usamos para comprar cosas." },
  { time: 38, text: "Con dinero cambias lápices por helado," },
  { time: 43, text: "No se come, pero vale mucho." },
  { time: 47, text: "Es una herramienta mágica" },
  { time: 50, text: "que nos ayuda a conseguir cosas." }
];

const STAGES: StageParams[] = [
  { id: 1, startTime: 0, pauseTime: 20, title: "El Trueque", instruction: "Analiza con atención!" }, // 0-20s (Merged Intro + Barter)
  { id: 2, startTime: 20, pauseTime: 36, title: "¿Qué es Dinero?", instruction: "Selecciona las formas de dinero" }, // 20-36s
  { id: 3, startTime: 36, pauseTime: 54, title: "Comprando", instruction: "¡Compra el helado!" }, // 36-54s
  { id: 4, startTime: 55, pauseTime: 999, title: "¡Esoo!", instruction: "¡Bien hecho!" } // Outro
];

interface LessonProps {
  onComplete: (score: number, progress: any) => void;
  onExit: () => void;
}

const Lesson1_1_WhatIsMoney: React.FC<LessonProps> = ({ onComplete, onExit }) => {
  // State
  const [currentStage, setCurrentStage] = useState(0); // Index of STAGES
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioReady, setAudioReady] = useState(false);
  const [interactionActive, setInteractionActive] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentText, setCurrentText] = useState("");

  // Minigame States
  const [barterComplete, setBarterComplete] = useState(false);
  const [quizSelection, setQuizSelection] = useState<string[]>([]);
  const [quizComplete, setQuizComplete] = useState(false);
  const [shopComplete, setShopComplete] = useState(false);

  const audioRef = useRef<HTMLAudioElement>(null);

  // --- Audio Logic ---
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      const time = audio.currentTime;
      const stage = STAGES[currentStage];

      // Update progress bar (approximate based on total 57s)
      setProgress((time / 57) * 100);

      // Update Text
      const activeLine = SCRIPT.slice().reverse().find(s => time >= s.time);
      setCurrentText(activeLine ? activeLine.text : "");

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

  // --- Handlers ---

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
    triggerConfetti();
    setTimeout(() => {
      onComplete(100, { endTime: Date.now() });
    }, 2000);
  };

  const triggerConfetti = () => {
    confetti({
      particleCount: 150,
      spread: 70,
      origin: { y: 0.6 },
      zIndex: 100 // Ensure it's above everything
    });
  };

  // --- Minigame Handlers ---

  // Stage 2: Barter
  const handleBarterSwap = () => {
    setBarterComplete(true);
    triggerConfetti();
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
      triggerConfetti();
      // Wait a bit then show button or auto advance
    }
  };

  // Stage 4: Shop
  const handleBuyIceCream = () => {
    if (shopComplete) return;
    setShopComplete(true);
    triggerConfetti();
    setTimeout(nextStage, 2000);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-100px)] w-full max-w-4xl mx-auto font-sans">

      {/* Audio Element Hidden */}
      <audio ref={audioRef} src="/audio/1_8-10_QUE-ES-EL-DINERO.mp3" preload="auto" />

      {/* --- Top Bar: Progress --- */}
      <div className="flex items-center gap-4 mb-6 px-4">
        <Button variant="ghost" size="icon" onClick={onExit} className="text-gray-400 hover:text-gray-600">
          <span className="text-2xl">✕</span>
        </Button>
        <div className="flex-1 h-3 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-green-500 transition-all duration-1000 ease-out rounded-full"
            style={{ width: `${Math.min(100, (currentStage / (STAGES.length - 1)) * 100)}%` }} // Stage based progress
          />
        </div>
        <div className="flex items-center gap-2 text-yellow-500 font-bold">
          <span>💎</span>
          <span>{currentStage * 20} XP</span>
        </div>
      </div>

      {/* --- Main Content Area --- */}
      <div className="flex-1 relative flex flex-col md:flex-row gap-6 p-4">

        {/* Left: Liruf Character (Coach) */}
        <div className={cn(
          "relative transition-all duration-500 flex items-center justify-center",
          interactionActive ? "md:w-1/3 scale-90" : "md:w-1/2 scale-100"
        )}>
          {/* Liruf's Speech Bubble (Instruction) */}
          <div className={cn(
            "absolute -top-12 z-20 bg-white border-2 border-gray-200 px-6 py-3 rounded-2xl shadow-sm transition-all duration-300",
            interactionActive ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          )}>
            <p className="font-bold text-gray-700">{STAGES[currentStage].instruction}</p>
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-white border-b-2 border-r-2 border-gray-200 rotate-45"></div>
          </div>

          <DinoCharacter
            className="w-full max-w-[400px]"
            showBubble={!interactionActive && isPlaying && !!currentText} // Show bubble when playing and not in minigame
            currentText={currentText}
            mood={interactionActive ? 'excited' : 'happy'}
          />
        </div>

        {/* Right: Interactive Stage */}
        <div className="flex-1 flex flex-col justify-center">

          {/* STAGE 0: Start Screen */}
          {currentStage === 0 && !isPlaying && !interactionActive && (
            <div className="text-center animate-in zoom-in duration-500">
              <h1 className="text-4xl font-extrabold text-blue-600 mb-4">¿Qué es el Dinero?</h1>
              <p className="text-xl text-gray-500 mb-8">Lección 1.1</p>
              <Button
                onClick={startLesson}
                disabled={!audioReady}
                className="bg-green-500 hover:bg-green-600 text-white text-xl font-bold px-12 py-6 rounded-2xl shadow-[0_4px_0_rgb(21,128,61)] hover:shadow-[0_2px_0_rgb(21,128,61)] hover:translate-y-[2px] transition-all"
              >
                {audioReady ? "¡EMPEZAR!" : "Cargando..."}
              </Button>
            </div>
          )}

          {/* STAGE 1: Passive Listening (No UI needed, just Liruf speaking) */}
          {currentStage === 0 && isPlaying && (
            <div className="hidden"></div> // Hidden because Liruf speaks now
          )}

          {/* STAGE 1: Barter Game */}
          {currentStage === 0 && interactionActive && (
            <div className="bg-white rounded-3xl p-8 border-2 border-gray-100 shadow-xl text-center">
              <h2 className="text-2xl font-bold text-gray-800 mb-8">¡Haz un Trueque!</h2>

              <div className="flex items-center justify-between gap-4 mb-8">
                {/* Player Item */}
                <div className={cn(
                  "w-24 h-24 rounded-2xl flex items-center justify-center text-4xl border-4 transition-all duration-500 bg-blue-50 border-blue-200 cursor-pointer hover:scale-110",
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
                <Button onClick={nextStage} className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-4 rounded-xl shadow-[0_4px_0_rgb(21,128,61)] active:shadow-none active:translate-y-[4px]">
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

      {/* Bottom Check Button (Optional, if needed for manual advance flows) */}
      {/* <div className="h-24 border-t bg-white flex items-center justify-between px-8">
          <div className="hidden md:block text-gray-400 font-bold uppercase tracking-wider">
              {isPlaying ? "Escucha con atención..." : "¡Es tu turno!"}
          </div>
      </div> */}

    </div>
  );
};

export default Lesson1_1_WhatIsMoney;
