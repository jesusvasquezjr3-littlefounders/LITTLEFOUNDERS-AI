import { useRef, useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface DinoCharacterProps {
    className?: string;
    currentText?: string;
    showBubble?: boolean;
    isSpeaking?: boolean; // Unused prop kept for interface compatibility, logic is derived
}

export function DinoCharacter({ className, currentText, showBubble }: DinoCharacterProps) {
    const headGroupRef = useRef<SVGGElement>(null);
    const bubbleRef = useRef<HTMLDivElement>(null);
    const [randomMsg, setRandomMsg] = useState("¡Hola!");
    const [isInteracting, setIsInteracting] = useState(false);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!headGroupRef.current) return;

            const x = e.clientX / window.innerWidth;
            const y = e.clientY / window.innerHeight;

            // Pupil movement
            const pupils = document.querySelectorAll('.pupil-group');
            const pupilX = (x - 0.5) * 15;
            const pupilY = (y - 0.5) * 15;

            pupils.forEach((pupil) => {
                (pupil as HTMLElement).style.transform = `translate(${pupilX}px, ${pupilY}px)`;
            });

            // Head movement
            const headRotate = (x - 0.5) * 20;
            const headX = (x - 0.5) * 10;
            const headY = (y - 0.5) * 10;

            // Base transform: translate(200, 140)
            headGroupRef.current.setAttribute('transform', `translate(${200 + headX}, ${140 + headY}) rotate(${headRotate})`);
        };

        window.addEventListener('mousemove', handleMouseMove);
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, []);

    const handleClick = () => {
        // Simple "jump" effect
        const svg = document.getElementById('dino-svg');
        if (svg) {
            svg.style.transition = "transform 0.1s";
            svg.style.transform = "scale(1.05)";
            setTimeout(() => svg.style.transform = "scale(1)", 150);
        }

        // If not controlled externally, show random message
        if (!showBubble) {
            const messages = [
                "¡Hola amigo!",
                "¿Jugamos?",
                "¡Me gusta tu estilo!",
                "¡Rawr! (Es 'hola' en dino)",
                "Tengo hambre...",
                "¡Mira mi racha!",
                "¿Dónde está mi comida?"
            ];
            setRandomMsg(messages[Math.floor(Math.random() * messages.length)]);
            setIsInteracting(true);
            setTimeout(() => setIsInteracting(false), 3000);
        }
    };

    return (
        <div className={cn("relative w-full h-full flex justify-center items-center transition-opacity duration-500", className)}>
            {/* Speech Bubble */}
            <div
                ref={bubbleRef}
                className={cn(
                    "absolute top-[15%] left-1/2 -translate-x-1/2 md:left-[20%] md:translate-x-0 bg-white p-6 rounded-[2rem] shadow-lg max-w-[200px] text-center transition-all duration-500 ease-out z-10 pointer-events-none",
                    (showBubble || isInteracting) ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-0 translate-y-4"
                )}
            >
                <p className="text-gray-700 font-bold text-lg leading-tight font-fredoka">
                    {currentText || randomMsg}
                </p>
                {/* Bubble Tail */}
                <div className="absolute -bottom-2 right-8 w-6 h-6 bg-white rotate-45"></div>
            </div>

            <svg
                id="dino-svg"
                viewBox="0 0 400 400"
                xmlns="http://www.w3.org/2000/svg"
                className="w-full max-w-[500px] h-auto cursor-pointer overflow-visible"
                onClick={handleClick}
            >
                <defs>
                    <linearGradient id="bodyGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" style={{ stopColor: "#4ADE80", stopOpacity: 1 }} />
                        <stop offset="100%" style={{ stopColor: "#22C55E", stopOpacity: 1 }} />
                    </linearGradient>
                    <linearGradient id="bellyGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" style={{ stopColor: "#dcfce7", stopOpacity: 1 }} />
                        <stop offset="100%" style={{ stopColor: "#bbf7d0", stopOpacity: 1 }} />
                    </linearGradient>
                    <style>{`
                        @import url('https://fonts.googleapis.com/css2?family=Fredoka:wght@400;600&display=swap');
                        .font-fredoka { font-family: 'Fredoka', sans-serif; }
                        .breathe { animation: breatheAnim 3s ease-in-out infinite; transform-origin: bottom center; }
                        @keyframes breatheAnim { 0%, 100% { transform: scaleY(1); } 50% { transform: scaleY(1.02); } }
                        .tail-anim { animation: tailWag 3s ease-in-out infinite alternate; transform-origin: 150px 350px; }
                        @keyframes tailWag { 0% { transform: rotate(0deg); } 100% { transform: rotate(10deg); } }
                        .mouth-anim { animation: talk 1.5s infinite; transform-origin: 20px 20px; }
                        @keyframes talk { 
                            0%, 10% { transform: scaleY(1); } 
                            20% { transform: scaleY(0.6); } 
                            35% { transform: scaleY(1); } 
                            45% { transform: scaleY(1); } 
                            55% { transform: scaleY(0.7); } 
                            70% { transform: scaleY(1); } 
                            100% { transform: scaleY(1); } 
                        }
                    `}</style>
                </defs>

                <g className="breathe">
                    {/* TAIL */}
                    <path className="tail-anim" d="M120 280 Q 80 280 60 220 Q 50 190 40 180 Q 80 220 110 240 Z" fill="#22C55E" />
                    <g className="tail-anim">
                        <path d="M50 200 L60 190 L70 205 Z" fill="#15803d" />
                        <path d="M70 215 L80 205 L90 220 Z" fill="#15803d" />
                        <path d="M90 230 L100 220 L110 235 Z" fill="#15803d" />
                    </g>

                    {/* BACK LEG (Behind) */}
                    <ellipse cx="230" cy="330" rx="30" ry="20" fill="#16a34a" />
                    <path d="M200 330 Q 200 350 210 350 L 250 350 Q 260 350 260 330" fill="#16a34a" />

                    {/* BODY */}
                    <path d="M130 200 Q 130 150 180 140 L 200 140 Q 250 140 250 200 Q 260 300 220 340 Q 180 360 140 330 Q 110 300 130 200 Z" fill="url(#bodyGradient)" />

                    {/* SPINES */}
                    <path d="M125 220 L110 210 L128 200 Z" fill="#15803d" />
                    <path d="M135 190 L120 180 L140 170 Z" fill="#15803d" />
                    <path d="M155 160 L145 145 L165 145 Z" fill="#15803d" />

                    {/* BELLY */}
                    <path d="M170 180 Q 240 180 235 320 Q 190 345 155 320 Q 140 250 170 180 Z" fill="url(#bellyGradient)" opacity="0.9" />
                    <path d="M170 220 Q 200 230 220 220" stroke="#86efac" strokeWidth="4" strokeLinecap="round" fill="none" />
                    <path d="M165 250 Q 200 260 225 250" stroke="#86efac" strokeWidth="4" strokeLinecap="round" fill="none" />
                    <path d="M170 280 Q 200 290 220 280" stroke="#86efac" strokeWidth="4" strokeLinecap="round" fill="none" />

                    {/* FRONT LEG (Right) */}
                    <g transform="translate(140, 310)">
                        <ellipse cx="30" cy="10" rx="35" ry="35" fill="url(#bodyGradient)" />
                        <path d="M10 30 Q 10 45 20 45 L 50 45 Q 60 45 60 30" fill="#22C55E" />
                        <circle cx="20" cy="45" r="5" fill="#f0fdf4" />
                        <circle cx="35" cy="45" r="5" fill="#f0fdf4" />
                        <circle cx="50" cy="45" r="5" fill="#f0fdf4" />
                    </g>

                    {/* ARM */}
                    <g transform="translate(180, 220) rotate(-20)">
                        <path d="M0 0 Q 30 10 40 40 Q 10 40 0 0" fill="#22C55E" />
                        <circle cx="40" cy="40" r="4" fill="#f0fdf4" />
                        <circle cx="32" cy="42" r="4" fill="#f0fdf4" />
                    </g>

                    {/* HEAD GROUP */}
                    <g id="head-group" ref={headGroupRef} transform="translate(200, 140)">
                        {/* Neck */}
                        <path d="M-40 20 Q -20 50 10 40 L 10 0 L -40 0 Z" fill="#4ADE80" />

                        {/* Head Base */}
                        <path d="M-60 -60 L 40 -60 Q 90 -60 90 0 Q 90 60 20 60 L -20 60 Q -70 60 -70 0 Q -70 -60 -60 -60 Z" fill="#4ADE80" />

                        {/* Snout */}
                        <ellipse cx="20" cy="-10" rx="60" ry="45" fill="#4ADE80" />

                        {/* MOUTH GROUP */}
                        <g className={cn("mouth-group", showBubble ? "mouth-anim" : "")} transform="translate(0, 0)">
                            <path d="M-30 10 Q 20 10 60 0 Q 60 40 0 40 Q -30 40 -30 10 Z" fill="#374151" />
                            <path d="M0 40 Q 30 40 40 25 Q 20 20 0 40 Z" fill="#f87171" />
                            <path d="M40 5 L 45 15 L 50 5 Z" fill="white" />
                        </g>

                        {/* CHEEK */}
                        <ellipse cx="-40" cy="15" rx="12" ry="8" fill="#fca5a5" opacity="0.6" />

                        {/* LEFT EYE */}
                        <g transform="translate(-10, -50) scale(0.9)">
                            <circle cx="0" cy="0" r="20" fill="white" stroke="#22c55e" strokeWidth="2" />
                            <g className="pupil-group">
                                <circle cx="5" cy="0" r="8" fill="#111827" />
                                <circle cx="8" cy="-3" r="3" fill="white" />
                            </g>
                            <path d="M-15 -15 Q 0 -25 15 -15" stroke="#166534" strokeWidth="3" fill="none" />
                        </g>

                        {/* RIGHT EYE */}
                        <g transform="translate(35, -45)">
                            <circle cx="0" cy="0" r="22" fill="white" stroke="#22c55e" strokeWidth="2" />
                            <g className="pupil-group">
                                <circle cx="5" cy="0" r="9" fill="#111827" />
                                <circle cx="8" cy="-3" r="3" fill="white" />
                            </g>
                            <path d="M-15 -18 Q 0 -28 15 -18" stroke="#166534" strokeWidth="3" fill="none" />
                        </g>

                        {/* NOSTRILS */}
                        <ellipse cx="50" cy="-15" rx="3" ry="5" fill="#166534" />
                        <ellipse cx="60" cy="-12" rx="3" ry="5" fill="#166534" />
                    </g>
                </g>
            </svg>
        </div>
    );
}
