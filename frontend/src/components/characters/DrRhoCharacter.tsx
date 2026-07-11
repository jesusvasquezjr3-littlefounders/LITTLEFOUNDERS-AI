import React, {useId, useEffect, useRef, useState, useCallback} from "react";
import { cn } from "@/lib/utils";

export type RhoMood = 'neutral' | 'wise' | 'mysterious' | 'explaining' | 'surprised';

interface DrRhoCharacterProps {
    className?: string;
    mood?: RhoMood;
    showBubble?: boolean;
    currentText?: string;
    bubblePosition?: 'top' | 'right';
    isTalking?: boolean;
}

const COLORS = {
    skin: "#FBD3B6",
    hair: "#4A3728",
    vest: "#FF9F43",
    shirt: "#FFF5E1",
    pants: "#57606F",
    stroke: "#2F3542",
    magic: "#00D2D3",
    gold: "#FECA57",
};

/**
 * Dr. Rho — The wise time-traveling cartographer.
 * Original SVG artwork preserved. Enhanced with Lottie-style animations:
 * smooth blink, spring-physics mouse tracking, idle floating, spring bounce.
 */
export const DrRhoCharacter: React.FC<DrRhoCharacterProps> = ({
    className,
    mood = 'neutral',
    showBubble = false,
    currentText = "",
    bubblePosition = 'top',
    isTalking = false
}) => {
    const [isBlinking, setIsBlinking] = useState(false);
    const [_clickPulse, setClickPulse] = useState(0);
    const [isSurprised, setIsSurprised] = useState(false);

    // Smooth mouse tracking
    const targetHead = useRef({ x: 0, y: 0, rot: 0 });
    const currentHead = useRef({ x: 0, y: 0, rot: 0 });
    const rafId = useRef<number | null>(null);

    // Blinking — randomized per-blink for natural rhythm
    const uid = useId().replace(/:/g, "");
    const blinkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    useEffect(() => {
        const doBlink = () => {
            setIsBlinking(true);
            setTimeout(() => {
                setIsBlinking(false);
                blinkTimerRef.current = setTimeout(doBlink, 2000 + Math.random() * 2000);
            }, 160);
        };
        blinkTimerRef.current = setTimeout(doBlink, 800 + Math.random() * 1200);
        return () => { if (blinkTimerRef.current) clearTimeout(blinkTimerRef.current); };
    }, []);

    // Mouse tracking
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            const x = (e.clientX / window.innerWidth) - 0.5;
            const y = (e.clientY / window.innerHeight) - 0.5;
            targetHead.current = { x: x * 6, y: y * 4, rot: x * 4 };
        };
        window.addEventListener('mousemove', handleMouseMove);
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, []);

    // Animation loop
    useEffect(() => {
        const animate = () => {
            const spring = 0.08;
            currentHead.current.x += (targetHead.current.x - currentHead.current.x) * spring;
            currentHead.current.y += (targetHead.current.y - currentHead.current.y) * spring;
            currentHead.current.rot += (targetHead.current.rot - currentHead.current.rot) * spring;

            const headGroup = document.getElementById('dr-rho-head-group');
            if (headGroup) {
                headGroup.style.transform = `translate(${currentHead.current.x}px, ${currentHead.current.y}px) rotate(${currentHead.current.rot}deg)`;
            }
            rafId.current = requestAnimationFrame(animate);
        };
        rafId.current = requestAnimationFrame(animate);
        return () => { if (rafId.current) cancelAnimationFrame(rafId.current); };
    }, []);

    const moodConfig = {
        neutral: { eyebrowsY: -2, eyebrowsRot: 0, eyesType: "relaxed", mouth: "soft_smile", mustacheY: -1 },
        wise: { eyebrowsY: -5, eyebrowsRot: -5, eyesType: "happy", mouth: "smile", mustacheY: -3 },
        mysterious: { eyebrowsY: 3, eyebrowsRot: 5, eyesType: "squint", mouth: "small", mustacheY: 0 },
        explaining: { eyebrowsY: -8, eyebrowsRot: 0, eyesType: "relaxed", mouth: "open", mustacheY: -2 },
        surprised: { eyebrowsY: -15, eyebrowsRot: 0, eyesType: "wide", mouth: "o", mustacheY: -8 }
    };

    const currentMood = isSurprised ? 'surprised' : mood;
    const current = moodConfig[currentMood];

    const handleClick = useCallback(() => {
        setClickPulse(p => p + 1);
        setIsSurprised(true);
    }, []);

    useEffect(() => {
        if (!isSurprised) return;
        const timer = setTimeout(() => setIsSurprised(false), 800);
        return () => clearTimeout(timer);
    }, [isSurprised]);

    return (
        <div className={cn("relative w-full h-full flex items-end justify-center cursor-pointer select-none", className)}
            style={{ willChange: "transform" }}
            onClick={handleClick}>

            {/* Burbuja */}
            <div className={cn(
                "absolute z-30 transition-all duration-300 ease-out",
                bubblePosition === 'top' && "-top-14 sm:-top-10 left-1/2 -translate-x-1/2",
                bubblePosition === 'right' && "top-8 -right-2",
                showBubble ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-50 translate-y-4 pointer-events-none"
            )}>
                <div className="bg-white border-2 border-slate-200 rounded-2xl px-4 py-2 shadow-lg relative min-w-[180px] max-w-[240px]">
                    <p className="font-bold text-slate-600 text-xs leading-snug text-center">
                        {currentText}
                    </p>
                    <div className="absolute w-3 h-3 bg-white border-b-2 border-r-2 border-slate-200 transform rotate-45 left-1/2 -translate-x-1/2 -bottom-[7px] rounded-br-sm"></div>
                </div>
            </div>

            <style>{`
                .rho-face-transition { transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1); }
                .rho-mouth-talk { animation: rhoTalkAnim 0.3s ease-in-out infinite; transform-box: fill-box; transform-origin: center; }
                @keyframes rhoTalkAnim {
                    0%, 100% { transform: scaleY(0.6) scaleX(0.9); }
                    50% { transform: scaleY(1.8) scaleX(1.06); }
                }
                @media (prefers-reduced-motion: reduce) { .rho-mouth-talk { animation: none; } }
                .rho-idle-float { animation: rhoFloat 4s ease-in-out infinite; transform-origin: center bottom; }
                @keyframes rhoFloat { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
                .rho-spring-bounce { animation: rhoSpring 0.5s cubic-bezier(0.34, 1.5, 0.64, 1); transform-origin: center bottom; }
                @keyframes rhoSpring {
                    0% { transform: scale(1); }
                    40% { transform: scale(1.08); }
                    100% { transform: scale(1); }
                }
            `}</style>

            <svg
                id={`drrho-svg-${uid}`}
                viewBox="-175 -125 750 750"
                className={cn(
                    "w-full h-full object-contain transition-transform duration-500",
                    "rho-idle-float",
                    isSurprised && "rho-spring-bounce"
                )}
                xmlns="http://www.w3.org/2000/svg"
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                <defs>
                    <pattern id={`plaidPattern-${uid}`} patternUnits="userSpaceOnUse" width="20" height="20" patternTransform="rotate(45)">
                        <rect width="20" height="20" fill="#7f8c8d" />
                        <line x1="0" y1="0" x2="0" y2="20" stroke="#e74c3c" strokeWidth="3" />
                        <line x1="10" y1="0" x2="10" y2="20" stroke="#e74c3c" strokeWidth="1.5" />
                        <line x1="0" y1="0" x2="20" y2="0" stroke="#3498db" strokeWidth="3" />
                        <line x1="0" y1="10" x2="20" y2="10" stroke="#3498db" strokeWidth="1.5" />
                    </pattern>
                    {/* Form-shading gradients (light from top-left) */}
                    <radialGradient id={`rhoSkin-${uid}`} cx="38%" cy="30%" r="78%">
                        <stop offset="0%" stopColor="#FFE2C8" />
                        <stop offset="58%" stopColor="#FBD3B6" />
                        <stop offset="100%" stopColor="#E7B795" />
                    </radialGradient>
                    <linearGradient id={`rhoHair-${uid}`} x1="20%" y1="0%" x2="80%" y2="100%">
                        <stop offset="0%" stopColor="#5C4838" />
                        <stop offset="100%" stopColor="#392A1E" />
                    </linearGradient>
                    <linearGradient id={`rhoPants-${uid}`} x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#69727F" />
                        <stop offset="100%" stopColor="#474F5B" />
                    </linearGradient>
                    <linearGradient id={`rhoShirt-${uid}`} x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#FFFBF0" />
                        <stop offset="100%" stopColor="#F2E4C9" />
                    </linearGradient>
                    <linearGradient id={`rhoFormShade-${uid}`} x1="20%" y1="0%" x2="80%" y2="100%">
                        <stop offset="0%" stopColor="#ffffff" stopOpacity="0.22" />
                        <stop offset="50%" stopColor="#ffffff" stopOpacity="0" />
                        <stop offset="100%" stopColor="#2a2018" stopOpacity="0.20" />
                    </linearGradient>
                    <filter id={`rhoShadow-${uid}`} x="-30%" y="-30%" width="160%" height="160%">
                        <feOffset in="SourceAlpha" dx="0" dy="16" result="dropOffset" />
                        <feGaussianBlur in="dropOffset" stdDeviation="12" result="dropBlur" />
                        <feFlood floodColor="#2A2117" floodOpacity="0.22" result="dropColor" />
                        <feComposite in="dropColor" in2="dropBlur" operator="in" result="dropShadow" />

                        <feOffset in="SourceAlpha" dx="7" dy="9" result="hlOffset" />
                        <feGaussianBlur in="hlOffset" stdDeviation="7" result="hlBlur" />
                        <feComposite in="SourceAlpha" in2="hlBlur" operator="out" result="hlMask" />
                        <feFlood floodColor="#ffffff" floodOpacity="0.30" result="hlColor" />
                        <feComposite in="hlColor" in2="hlMask" operator="in" result="highlight" />

                        <feOffset in="SourceAlpha" dx="2" dy="2" result="rimOffset" />
                        <feGaussianBlur in="rimOffset" stdDeviation="2" result="rimBlur" />
                        <feComposite in="SourceAlpha" in2="rimBlur" operator="out" result="rimMask" />
                        <feFlood floodColor="#ffffff" floodOpacity="0.34" result="rimColor" />
                        <feComposite in="rimColor" in2="rimMask" operator="in" result="rimLight" />

                        <feOffset in="SourceAlpha" dx="-9" dy="-11" result="isOffset" />
                        <feGaussianBlur in="isOffset" stdDeviation="7" result="isBlur" />
                        <feComposite in="SourceAlpha" in2="isBlur" operator="out" result="isMask" />
                        <feFlood floodColor="#3D3229" floodOpacity="0.26" result="isColor" />
                        <feComposite in="isColor" in2="isMask" operator="in" result="innerShadow" />

                        <feOffset in="SourceAlpha" dx="-2" dy="-3" result="edgeShadowOffset" />
                        <feGaussianBlur in="edgeShadowOffset" stdDeviation="3" result="edgeShadowBlur" />
                        <feComposite in="SourceAlpha" in2="edgeShadowBlur" operator="out" result="edgeShadowMask" />
                        <feFlood floodColor="#241b14" floodOpacity="0.20" result="edgeShadowColor" />
                        <feComposite in="edgeShadowColor" in2="edgeShadowMask" operator="in" result="edgeShadow" />

                        <feMerge>
                            <feMergeNode in="dropShadow" />
                            <feMergeNode in="SourceGraphic" />
                            <feMergeNode in="innerShadow" />
                            <feMergeNode in="edgeShadow" />
                            <feMergeNode in="highlight" />
                            <feMergeNode in="rimLight" />
                        </feMerge>
                    </filter>
                    <filter id={`innerDropShadow-${uid}`} x="-20%" y="-20%" width="140%" height="140%">
                        <feOffset in="SourceAlpha" dx="0" dy="4" result="offset" />
                        <feGaussianBlur in="offset" stdDeviation="3" result="blur" />
                        <feFlood floodColor="#3D3229" floodOpacity="0.25" result="color" />
                        <feComposite in="color" in2="blur" operator="in" result="shadow" />
                        <feMerge>
                            <feMergeNode in="shadow" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>
                </defs>

                <g filter={`url(#rhoShadow-${uid})`}>
                {/* Piernas */}
                <g transform="translate(0, 40)">
                    <ellipse cx="165" cy="410" rx="20" ry="45" fill={`url(#rhoPants-${uid})`} />
                    <ellipse cx="235" cy="410" rx="20" ry="45" fill={`url(#rhoPants-${uid})`} />
                    <ellipse cx="165" cy="450" rx="24" ry="12" fill={COLORS.stroke} />
                    <ellipse cx="235" cy="450" rx="24" ry="12" fill={COLORS.stroke} />
                </g>

                {/* Cuerpo */}
                <g transform="translate(0, 40)" filter={`url(#innerDropShadow-${uid})`}>
                    <rect x="130" y="270" width="140" height="150" rx="40" fill={`url(#plaidPattern-${uid})`} />
                    <rect x="130" y="270" width="140" height="150" rx="40" fill={`url(#rhoFormShade-${uid})`} />
                    <path d="M160 270 Q 200 340 240 270" fill={`url(#rhoShirt-${uid})`} />
                    <path d="M200 300 L 185 330 L 200 350 L 215 330 Z" fill="#EF5777" />
                </g>

                {/* Brazos */}
                <g transform="translate(0, 40)" filter={`url(#innerDropShadow-${uid})`}>
                    <path d="M135 290 Q 110 350 145 370" stroke="url(#rhoShirt)" strokeWidth="24" fill="none" />
                    <circle cx="145" cy="370" r="14" fill={`url(#rhoSkin-${uid})`} />
                    <path d="M265 290 Q 290 350 255 370" stroke="url(#rhoShirt)" strokeWidth="24" fill="none" />
                    <circle cx="255" cy="370" r="14" fill={`url(#rhoSkin-${uid})`} />
                </g>

                {/* Cabeza */}
                <g id={`dr-rho-head-group-${uid}`} style={{ transformOrigin: '200px 200px', transition: 'transform 0.1s linear' }} filter={`url(#innerDropShadow-${uid})`}>
                    <g transform="translate(0, 25)">
                        <circle cx="120" cy="200" r="18" fill={`url(#rhoSkin-${uid})`} />
                        <circle cx="280" cy="200" r="18" fill={`url(#rhoSkin-${uid})`} />
                        <rect x="125" y="100" width="150" height="180" rx="60" fill={`url(#rhoSkin-${uid})`} />

                        {/* Pelo */}
                        <path d="M125 150 C 125 80, 275 80, 275 150 L 275 160 C 275 160, 260 160, 250 140 C 200 140, 150 140, 150 160 L 125 160 Z" fill={`url(#rhoHair-${uid})`} />

                        {/* Rostro */}
                        <g className="rho-face-transition">
                            {/* Cejas */}
                            <g transform={`translate(0, ${current.eyebrowsY})`}>
                                <rect x="145" y="165" width="30" height="10" rx="5" fill={COLORS.hair} transform={`rotate(${current.eyebrowsRot}, 160, 170)`} />
                                <rect x="225" y="165" width="30" height="10" rx="5" fill={COLORS.hair} transform={`rotate(${-current.eyebrowsRot}, 240, 170)`} />
                            </g>

                            {/* Ojos */}
                            <g transform="translate(0, 10)">
                                {isBlinking ? (
                                    <>
                                        <line x1="145" y1="195" x2="175" y2="195" stroke={COLORS.stroke} strokeWidth="5" />
                                        <line x1="225" y1="195" x2="255" y2="195" stroke={COLORS.stroke} strokeWidth="5" />
                                    </>
                                ) : (
                                    <>
                                        {current.eyesType === 'wide' && (
                                            <>
                                                <circle cx="160" cy="195" r="16" fill="white" stroke={COLORS.stroke} strokeWidth="4" />
                                                <circle cx="160" cy="195" r="4" fill={COLORS.stroke} />
                                                <circle cx="240" cy="195" r="16" fill="white" stroke={COLORS.stroke} strokeWidth="4" />
                                                <circle cx="240" cy="195" r="4" fill={COLORS.stroke} />
                                            </>
                                        )}
                                        {current.eyesType === 'relaxed' && (
                                            <>
                                                <circle cx="160" cy="195" r="14" fill="white" stroke={COLORS.stroke} strokeWidth="4" />
                                                <circle cx="160" cy="197" r="6" fill={COLORS.stroke} />
                                                <path d="M142 190 H 178 V 175 H 142 Z" fill={`url(#rhoSkin-${uid})`} stroke="none" />
                                                <line x1="143" y1="190" x2="177" y2="190" stroke={COLORS.stroke} strokeWidth="4" />

                                                <circle cx="240" cy="195" r="14" fill="white" stroke={COLORS.stroke} strokeWidth="4" />
                                                <circle cx="240" cy="197" r="6" fill={COLORS.stroke} />
                                                <path d="M222 190 H 258 V 175 H 222 Z" fill={`url(#rhoSkin-${uid})`} stroke="none" />
                                                <line x1="223" y1="190" x2="257" y2="190" stroke={COLORS.stroke} strokeWidth="4" />
                                            </>
                                        )}
                                        {current.eyesType === 'happy' && (
                                            <>
                                                <path d="M145 195 Q 160 180 175 195" stroke={COLORS.stroke} strokeWidth="5" fill="none" />
                                                <path d="M225 195 Q 240 180 255 195" stroke={COLORS.stroke} strokeWidth="5" fill="none" />
                                            </>
                                        )}
                                        {current.eyesType === 'squint' && (
                                            <>
                                                <line x1="145" y1="195" x2="175" y2="195" stroke={COLORS.stroke} strokeWidth="5" />
                                                <line x1="225" y1="195" x2="255" y2="195" stroke={COLORS.stroke} strokeWidth="5" />
                                            </>
                                        )}
                                    </>
                                )}
                            </g>

                            {/* Bigote */}
                            <g transform={`translate(0, ${current.mustacheY})`} className="rho-face-transition">
                                <path d="M200 240 Q 220 230 240 240 Q 250 245 245 255 Q 230 265 200 255 Q 170 265 155 255 Q 150 245 160 240 Q 180 230 200 240" fill={COLORS.hair} />
                            </g>

                            {/* Boca — translate externo + animación de habla interna (la boca no desaparece) */}
                            <g transform="translate(200, 260)">
                                <g className={cn(isTalking ? "rho-mouth-talk" : "")}>
                                    {current.mouth === 'smile' && <path d="M-10 0 Q 0 10 10 0" stroke={COLORS.stroke} strokeWidth="4" fill="none" />}
                                    {current.mouth === 'soft_smile' && <path d="M-8 0 Q 0 5 8 0" stroke={COLORS.stroke} strokeWidth="4" fill="none" />}
                                    {current.mouth === 'open' && <path d="M-8 0 Q 0 8 8 0 Z" fill="#4B3621" />}
                                    {current.mouth === 'o' && <circle cx="0" cy="0" r="6" fill="#4B3621" />}
                                    {current.mouth === 'small' && <circle cx="0" cy="0" r="2" fill={COLORS.stroke} />}
                                </g>
                            </g>
                        </g>
                    </g>
                </g>

                {/* Mapa Rúnico Flotante */}
                <g transform="translate(280, 340) rotate(10)" filter={`url(#innerDropShadow-${uid})`}>
                    <g className="animate-[pulse_3s_infinite]">
                        <rect x="-25" y="-35" width="50" height="70" rx="8" fill="#F8EFBA" stroke={COLORS.gold} strokeWidth="4" />
                        <circle cx="0" cy="-10" r="10" fill="none" stroke={COLORS.magic} strokeWidth="3" strokeDasharray="3 3" />
                        <path d="M-10 15 L10 15" stroke={COLORS.vest} strokeWidth="3" />
                    </g>
                </g>
                </g>
            </svg>
        </div>
    );
};

export default DrRhoCharacter;
