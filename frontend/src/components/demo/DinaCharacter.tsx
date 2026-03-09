import React, { useEffect, useRef, useState } from 'react';

interface DinaCharacterProps {
    expression?: 'neutral' | 'happy' | 'surprised' | 'wink';
    className?: string;
    enableMouseTracking?: boolean;
}

export const DinaCharacter: React.FC<DinaCharacterProps> = ({
    expression = 'neutral',
    className = '',
    enableMouseTracking = true
}) => {
    const headRef = useRef<SVGGElement>(null);
    const pupilLRef = useRef<SVGGElement>(null);
    const pupilRRef = useRef<SVGGElement>(null);

    // Initial state for refs can be handled via direct manipulation or effect
    // Since we also have expression based attribute changes, we can use derived state variables
    // But given the "setExpression" imperative style in the source, let's map expression to attributes.

    const [currentExpression, setCurrentExpression] = useState(expression);

    useEffect(() => {
        setCurrentExpression(expression);
    }, [expression]);

    // Expression Logic configuration
    const getExpressionconfig = (expr: string) => {
        // Defaults (neutral)
        const config = {
            eyeOpacity: 1,
            eyeClosedOpacity: 0,
            pupilOpacity: 1,
            lashesTransform: "translate(0,0)",
            eyeRadius: 20,
            eyeClosedPath: "M-18 0 Q 0 6 18 0", // neutral/surprised blink base
            mouthPath: "M5 25 Q 15 32 25 25",
            browLTransform: "translate(0, 0)",
            browRTransform: "translate(0, 0)",
            surprisedLashes: false
        };

        switch (expr) {
            case 'happy':
                return {
                    ...config,
                    eyeOpacity: 0,
                    eyeClosedOpacity: 1,
                    pupilOpacity: 0,
                    eyeClosedPath: "M-18 0 Q 0 -14 18 0",
                    mouthPath: "M-5 25 Q 15 42 35 25",
                    browLTransform: "translate(0, -6)",
                    browRTransform: "translate(0, -6)",
                    lashesTransform: "translate(-2, 6) rotate(-15)", // Lashes logic differs per eye in source, will handle in render
                };
            case 'surprised':
                return {
                    ...config,
                    eyeRadius: 24,
                    mouthPath: "M10 38 A 8 8 0 1 0 20 38 A 8 8 0 1 0 10 38",
                    browLTransform: "translate(0, -12) rotate(-10)",
                    browRTransform: "translate(0, -12) rotate(10)",
                    surprisedLashes: true
                };
            case 'wink':
                // Left eye normal, right eye wink
                return {
                    ...config,
                    // Special handling in render for wink as it's asymmetric
                    mouthPath: "M5 25 Q 15 35 20 28",
                    blinkRight: true // flag to force right eye closed similar to blink but permanent
                };
            default:
                return config;
        }
    };

    const config = getExpressionconfig(currentExpression);

    // Blinking Logic
    useEffect(() => {
        const interval = setInterval(() => {
            if (currentExpression === 'neutral' || currentExpression === 'surprised') {
                const eyeLWhite = document.getElementById('dina-eye-l-white');
                const eyeRWhite = document.getElementById('dina-eye-r-white');
                const pupilL = document.getElementById('dina-pupil-l');
                const pupilR = document.getElementById('dina-pupil-r');
                const eyeLClosed = document.getElementById('dina-eye-l-closed');
                const eyeRClosed = document.getElementById('dina-eye-r-closed');
                const lashesL = document.getElementById('dina-lashes-l');
                const lashesR = document.getElementById('dina-lashes-r');

                if (eyeLWhite && eyeRWhite && pupilL && pupilR && eyeLClosed && eyeRClosed && lashesL && lashesR) {
                    // Close eyes
                    eyeLWhite.setAttribute('opacity', '0');
                    eyeRWhite.setAttribute('opacity', '0');
                    pupilL.setAttribute('opacity', '0');
                    pupilR.setAttribute('opacity', '0');
                    eyeLClosed.setAttribute('opacity', '1');
                    eyeRClosed.setAttribute('opacity', '1');
                    // For blink
                    eyeLClosed.setAttribute('d', 'M-18 0 Q 0 6 18 0');
                    eyeRClosed.setAttribute('d', 'M-18 0 Q 0 6 18 0');

                    lashesL.setAttribute('transform', 'translate(0, 10)');
                    lashesR.setAttribute('transform', 'translate(0, 10)');

                    setTimeout(() => {
                        // Check if expression changed during blink
                        // We'd ideally use a ref to track current expression in timeout or verify state, 
                        // but here we just restore to what the props say or re-render handles it.
                        // Actually, forcing re-render via state might be cleaner, but let's stick to DOM specific restore for performance/smoothness of this loop
                        // Or simpler: let the component re-render handle it? No, interval runs outside render cycle.
                        // We will just restore attributes based on "neutral/surprised" assumption or let React reconciliation handle it if we trigger update.
                        // But simpler: just restore "open" state variables if we were in neutral/surprised.
                        // Given the complexity of mixing React render and manual DOM manipulation (setInterval), 
                        // let's do this: Use a state 'isBlinking' and let React render the blink state.
                    }, 150);
                }
            }
        }, 4000);
        return () => clearInterval(interval);
    }, [currentExpression]);

    // Actually, let's use the pure React 'isBlinking' approach for the specific 'neutral'/'surprised' blink
    const [isBlinking, setIsBlinking] = useState(false);

    useEffect(() => {
        const interval = setInterval(() => {
            if (currentExpression === 'neutral' || currentExpression === 'surprised') {
                setIsBlinking(true);
                setTimeout(() => setIsBlinking(false), 150);
            }
        }, 4000);
        return () => clearInterval(interval);
    }, [currentExpression]);

    // Mouse Movement
    useEffect(() => {
        if (!enableMouseTracking) return;

        const handleMouseMove = (e: MouseEvent) => {
            if (!headRef.current || !pupilLRef.current || !pupilRRef.current) return;

            const x = (e.clientX / window.innerWidth) - 0.5;
            const y = (e.clientY / window.innerHeight) - 0.5;

            const pupilX = x * 15;
            const pupilY = y * 15;
            const headRot = x * 8;

            pupilLRef.current.style.transform = `translate(${pupilX}px, ${pupilY}px)`;
            pupilRRef.current.style.transform = `translate(${pupilX}px, ${pupilY}px)`;
            headRef.current.style.transform = `translate(360px, 110px) rotate(${headRot}deg)`;
        };

        window.addEventListener('mousemove', handleMouseMove);
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, [enableMouseTracking]);

    // Reset head position if tracking disabled
    useEffect(() => {
        if (!enableMouseTracking && headRef.current) {
            headRef.current.style.transform = `translate(360px, 110px) rotate(0deg)`;
        }
    }, [enableMouseTracking]);

    // Helpers for asymmetric logic
    const leftLashTransform = (() => {
        if (isBlinking) return 'translate(0, 10)';
        if (currentExpression === 'happy') return 'translate(-2, 6) rotate(-15)';
        if (currentExpression === 'surprised') return 'scale(1.15) translate(-3, -3)';
        return 'translate(0,0)';
    })();

    const rightLashTransform = (() => {
        if (isBlinking) return 'translate(0, 10)';
        if (currentExpression === 'happy') return 'translate(2, 6) rotate(15)';
        if (currentExpression === 'wink') return 'translate(0, 10)';
        if (currentExpression === 'surprised') return 'scale(1.15) translate(3, -3)';
        return 'translate(0,0)';
    })();

    // Wink specific override
    const rightEyeOpen = isBlinking ? false : (currentExpression === 'wink' ? false : (config.eyeOpacity === 1));
    const rightEyeClosed = isBlinking ? true : (currentExpression === 'wink' ? true : (config.eyeClosedOpacity === 1));

    // Closed eye path (wink uses different path than sleep/blink?)
    // Provided code: wink -> M-18 0 Q 0 10 18 0
    // Blink -> M-18 0 Q 0 6 18 0
    const rightEyeClosedPath = currentExpression === 'wink' ? 'M-18 0 Q 0 10 18 0' : (isBlinking ? 'M-18 0 Q 0 6 18 0' : config.eyeClosedPath);
    const leftEyeClosedPath = isBlinking ? 'M-18 0 Q 0 6 18 0' : config.eyeClosedPath;

    const leftEyeOpen = isBlinking ? false : (config.eyeOpacity === 1);
    const leftEyeClosed = isBlinking ? true : (config.eyeClosedOpacity === 1);

    const handleClick = () => {
        const svg = document.getElementById('dina-svg');
        if (svg) {
            svg.style.transition = "transform 0.1s";
            svg.style.transform = "scale(1.05)";
            setTimeout(() => svg.style.transform = "scale(1)", 150);
        }
    };

    return (
        <div className={`scene relative w-full h-full flex justify-center items-center cursor-pointer ${className}`} style={{ willChange: "transform" }} onClick={handleClick}>
            {/* We can inline the styles or rely on className. 
            The user provided specific keyframes. We inject them here scoped or globally. 
            Using a style tag for the keyframes. */}
            <style>{`
            @import url('https://fonts.googleapis.com/css2?family=Fredoka:wght@400;600&display=swap');
            .dina-breathe { animation: breatheAnim 4s ease-in-out infinite; transform-origin: center bottom; }
            @keyframes breatheAnim { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.015); } }
            .dina-tail-anim { animation: tailWag 3.5s ease-in-out infinite alternate; transform-origin: 150px 300px; }
            @keyframes tailWag { 0% { transform: rotate(-8deg); } 100% { transform: rotate(12deg); } }
            .dina-neck-sway { animation: neckSway 5s ease-in-out infinite alternate; transform-origin: 280px 280px; }
            @keyframes neckSway { 0% { transform: rotate(-2deg); } 100% { transform: rotate(4deg); } }
            .dina-face-element { transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
        `}</style>

            <svg id="dina-svg" viewBox="0 0 550 500" xmlns="http://www.w3.org/2000/svg" className="w-full h-full object-contain drop-shadow-2xl">
                <defs>
                    <linearGradient id="skinGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" style={{ stopColor: "#fb923c" }} />
                        <stop offset="100%" style={{ stopColor: "#f97316" }} />
                    </linearGradient>
                    <radialGradient id="blushGrad">
                        <stop offset="0%" style={{ stopColor: "#fb7185", stopOpacity: 0.5 }} />
                        <stop offset="100%" style={{ stopColor: "#fb7185", stopOpacity: 0 }} />
                    </radialGradient>
                    <linearGradient id="plateGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" style={{ stopColor: "#fef3c7" }} />
                        <stop offset="100%" style={{ stopColor: "#fde047" }} />
                    </linearGradient>
                </defs>

                <g className="dina-breathe">

                    {/* GRUPO COLA */}
                    <g className="dina-tail-anim">
                        <path d="M40 160 Q 30 130 50 145" fill="url(#plateGrad)" stroke="#eab308" strokeWidth="1" />
                        <path d="M65 200 Q 55 170 80 185" fill="url(#plateGrad)" stroke="#eab308" strokeWidth="1" />
                        <path d="M95 250 Q 85 220 115 240" fill="url(#plateGrad)" stroke="#eab308" strokeWidth="1" />
                        <path d="M140 310 Q 20 290 30 180 Q 35 130 65 130 Q 60 180 85 220 Q 110 280 150 300 Z" fill="#f97316" />
                    </g>

                    {/* PATAS FONDO */}
                    <g transform="translate(150, 315)">
                        <rect x="0" y="0" width="42" height="80" rx="21" fill="#c2410c" />
                        <circle cx="10" cy="74" r="4" fill="#fdba74" opacity="0.6" />
                        <circle cx="21" cy="77" r="4" fill="#fdba74" opacity="0.6" />
                        <circle cx="32" cy="74" r="4" fill="#fdba74" opacity="0.6" />
                    </g>
                    <g transform="translate(290, 315)">
                        <rect x="0" y="0" width="40" height="80" rx="20" fill="#c2410c" />
                        <circle cx="10" cy="74" r="4" fill="#fdba74" opacity="0.6" />
                        <circle cx="20" cy="77" r="4" fill="#fdba74" opacity="0.6" />
                        <circle cx="30" cy="74" r="4" fill="#fdba74" opacity="0.6" />
                    </g>

                    {/* CUERPO PRINCIPAL */}
                    <path d="M175 250 Q 190 210 215 245" fill="url(#plateGrad)" stroke="#eab308" strokeWidth="1.5" />
                    <path d="M225 240 Q 245 200 270 235" fill="url(#plateGrad)" stroke="#eab308" strokeWidth="1.5" />

                    <ellipse cx="240" cy="320" rx="105" ry="90" fill="url(#skinGrad)" />

                    <circle cx="185" cy="295" r="12" fill="#fdba74" opacity="0.4" />
                    <circle cx="215" cy="275" r="9" fill="#fdba74" opacity="0.4" />
                    <circle cx="170" cy="330" r="7" fill="#fdba74" opacity="0.3" />
                    <circle cx="270" cy="285" r="10" fill="#fdba74" opacity="0.3" />
                    <circle cx="240" cy="265" r="6" fill="#fdba74" opacity="0.4" />

                    {/* PANZA */}
                    <ellipse cx="240" cy="340" rx="80" ry="60" fill="#ffedd5" opacity="0.4" />

                    {/* PATAS FRENTE */}
                    <g transform="translate(170, 335)">
                        <rect x="0" y="0" width="55" height="90" rx="27.5" fill="#fb923c" />
                        <circle cx="13" cy="82" r="6" fill="#ffedd5" />
                        <circle cx="27" cy="85" r="6" fill="#ffedd5" />
                        <circle cx="41" cy="82" r="6" fill="#ffedd5" />
                    </g>
                    <g transform="translate(260, 335)">
                        <rect x="0" y="0" width="52" height="90" rx="26" fill="#fb923c" />
                        <circle cx="13" cy="82" r="6" fill="#ffedd5" />
                        <circle cx="26" cy="85" r="6" fill="#ffedd5" />
                        <circle cx="39" cy="82" r="6" fill="#ffedd5" />
                    </g>

                    {/* CUELLO Y CABEZA */}
                    <g className="dina-neck-sway">
                        <path d="M315 240 Q 335 210 345 235" fill="url(#plateGrad)" stroke="#eab308" strokeWidth="1" />
                        <path d="M340 190 Q 365 160 375 195" fill="url(#plateGrad)" stroke="#eab308" strokeWidth="1" />

                        <path d="M290 280 Q 350 250 360 140" stroke="#fb923c" strokeWidth="55" fill="none" strokeLinecap="round" />

                        <g id="dina-head-group" ref={headRef} transform="translate(360, 110)">
                            <path d="M-10 -48 Q 15 -75 40 -48" fill="url(#plateGrad)" stroke="#eab308" strokeWidth="1.5" />

                            <ellipse cx="15" cy="0" rx="65" ry="55" fill="#fb923c" />

                            <circle cx="-28" cy="20" r="16" fill="url(#blushGrad)" />
                            <circle cx="58" cy="20" r="16" fill="url(#blushGrad)" />

                            <g id="eyebrows">
                                <path id="eyebrow-l" d="M-30 -35 Q -15 -42 0 -35" stroke="#7c2d12" strokeWidth="3" fill="none" strokeLinecap="round" className="dina-face-element" transform={config.browLTransform} />
                                <path id="eyebrow-r" d="M30 -35 Q 45 -42 60 -35" stroke="#7c2d12" strokeWidth="3" fill="none" strokeLinecap="round" className="dina-face-element" transform={config.browRTransform} />
                            </g>

                            <g id="eyes">
                                {/* Ojo Izquierdo */}
                                <g id="eye-l-group" transform="translate(-15, -10)" className="dina-face-element">
                                    <g id="lashes-l" className="dina-face-element" transform={leftLashTransform}>
                                        <path d="M-16 -8 Q-22 -12 -25 -5" stroke="#7c2d12" strokeWidth="2.5" fill="none" strokeLinecap="round" />
                                        <path d="M-14 -12 Q-18 -18 -20 -10" stroke="#7c2d12" strokeWidth="2.5" fill="none" strokeLinecap="round" />
                                        <path d="M-10 -15 Q-12 -22 -10 -15" stroke="#7c2d12" strokeWidth="2.5" fill="none" strokeLinecap="round" />
                                    </g>
                                    <circle id="dina-eye-l-white" cx="0" cy="0" r={config.eyeRadius} fill="white" opacity={leftEyeOpen ? 1 : 0} className="dina-face-element" />
                                    <g id="dina-pupil-l" ref={pupilLRef} className="dina-face-element" opacity={leftEyeOpen ? 1 : 0}>
                                        <circle cx="2" cy="2" r="11" fill="#1e293b" />
                                        <circle cx="-3" cy="-3" r="5" fill="white" />
                                        <circle cx="4" cy="5" r="2" fill="white" opacity="0.6" />
                                    </g>
                                    <path id="dina-eye-l-closed" d={leftEyeClosedPath} stroke="#7c2d12" strokeWidth="4" fill="none" strokeLinecap="round" opacity={leftEyeClosed ? 1 : 0} className="dina-face-element" />
                                </g>

                                {/* Ojo Derecho */}
                                <g id="eye-r-group" transform="translate(45, -10)" className="dina-face-element">
                                    <g id="lashes-r" className="dina-face-element" transform={rightLashTransform}>
                                        <path d="M16 -8 Q22 -12 25 -5" stroke="#7c2d12" strokeWidth="2.5" fill="none" strokeLinecap="round" />
                                        <path d="M14 -12 Q18 -18 20 -10" stroke="#7c2d12" strokeWidth="2.5" fill="none" strokeLinecap="round" />
                                        <path d="M10 -15 Q12 -22 10 -15" stroke="#7c2d12" strokeWidth="2.5" fill="none" strokeLinecap="round" />
                                    </g>
                                    <circle id="dina-eye-r-white" cx="0" cy="0" r={config.eyeRadius} fill="white" opacity={rightEyeOpen ? 1 : 0} />
                                    <g id="dina-pupil-r" ref={pupilRRef} className="dina-face-element" opacity={rightEyeOpen ? 1 : 0}>
                                        <circle cx="2" cy="2" r="11" fill="#1e293b" />
                                        <circle cx="-3" cy="-3" r="5" fill="white" />
                                        <circle cx="4" cy="5" r="2" fill="white" opacity="0.6" />
                                    </g>
                                    <path id="dina-eye-r-closed" d={rightEyeClosedPath} stroke="#7c2d12" strokeWidth="4" fill="none" strokeLinecap="round" opacity={rightEyeClosed ? 1 : 0} className="dina-face-element" />
                                </g>
                            </g>

                            {/* BOCA */}
                            <path id="mouth-path" d={config.mouthPath} stroke="#7c2d12" strokeWidth="3" fill="none" strokeLinecap="round" className="dina-face-element" />

                            {/* NARIZ */}
                            <circle cx="25" cy="15" r="2" fill="#7c2d12" opacity="0.2" />
                            <circle cx="35" cy="15" r="2" fill="#7c2d12" opacity="0.2" />
                        </g>
                    </g>
                </g>
            </svg>
        </div>
    );
};
