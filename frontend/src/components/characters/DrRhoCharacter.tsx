import React from "react";
import { cn } from "@/lib/utils";

/**
 * Estados de ánimo para Dr. Rho.
 * Controlan las expresiones faciales y animaciones del personaje.
 */
export type RhoMood = 'neutral' | 'wise' | 'mysterious' | 'explaining' | 'surprised';

interface DrRhoCharacterProps {
    /** Clases adicionales para el contenedor (ej. tamaño o posición) */
    className?: string;
    /** El estado de ánimo actual que dicta su expresión */
    mood?: RhoMood;
    /** Si debe mostrar la burbuja de diálogo */
    showBubble?: boolean;
    /** El texto dentro de la burbuja */
    currentText?: string;
    /** Posición de la burbuja relativa al personaje */
    bubblePosition?: 'top' | 'right';
}

// Paleta de colores consistente con el estilo Duolingo/LittleFounders
const COLORS = {
    skin: "#FBD3B6",       // Piel durazno suave
    hair: "#4A3728",       // Café chocolate
    vest: "#FF9F43",       // Naranja brillante (aventurero)
    shirt: "#FFF5E1",      // Crema
    pants: "#57606F",      // Gris plomo suave
    stroke: "#2F3542",     // Trazo gris oscuro (suave)
    magic: "#00D2D3",      // Cian brillante (runas)
    gold: "#FECA57",       // Amarillo oro (borde mapa)
};

/**
 * Dr. Talis Rho
 * Historia: El Dr. Rho pertenecía a la Orden de los Cronógrafos, una hermandad secreta dedicada a mapear líneas temporales alternas. En su expedición al Jurásico Tardío, su brújula temporal se rompió, dejándolo atrapado. Desde entonces, ha estado dibujando mapas no solo del terreno, sino del "tiempo emocional" del planeta: zonas donde el miedo de los presas se acumula como niebla, o donde la alegría de los herbívoros jóvenes hace florecer helechos gigantes. Sus mapas son codificados en runas luminosas que solo pueden leerse bajo la luz de ciertas lunas.
 */
export const DrRhoCharacter: React.FC<DrRhoCharacterProps> = ({
    className,
    mood = 'neutral',
    showBubble = false,
    currentText = "",
    bubblePosition = 'top'
}) => {

    // Configuración de micro-animaciones y formas según el Mood
    const moodConfig = {
        neutral: {
            eyebrowsY: -2,
            eyebrowsRot: 0,
            eyesType: "relaxed",
            mouth: "soft_smile",
            mustacheY: -1
        },
        wise: {
            eyebrowsY: -5,
            eyebrowsRot: -5,
            eyesType: "happy",
            mouth: "smile",
            mustacheY: -3
        },
        mysterious: {
            eyebrowsY: 3,
            eyebrowsRot: 5,
            eyesType: "squint",
            mouth: "small",
            mustacheY: 0
        },
        explaining: {
            eyebrowsY: -8,
            eyebrowsRot: 0,
            eyesType: "relaxed",
            mouth: "open",
            mustacheY: -2
        },
        surprised: {
            eyebrowsY: -15,
            eyebrowsRot: 0,
            eyesType: "wide",
            mouth: "o",
            mustacheY: -8
        }
    };

    const current = moodConfig[mood];

    const handleClick = () => {
        const svg = document.getElementById('drrho-svg');
        if (svg) {
            svg.style.transition = "transform 0.1s";
            svg.style.transform = "scale(1.05)";
            setTimeout(() => svg.style.transform = "scale(1)", 150);
        }
    };

    return (
        <div className={cn("relative w-full h-full flex items-end justify-center cursor-pointer", className)} style={{ willChange: "transform" }} onClick={handleClick}>

            {/* --- Burbuja de Diálogo --- */}
            <div className={cn(
                "absolute z-30 transition-all duration-400 ease-out",
                bubblePosition === 'top' && "-top-4 left-1/2 -translate-x-1/2",
                bubblePosition === 'right' && "top-10 -right-2",
                showBubble ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-50 translate-y-8 pointer-events-none"
            )}>
                <div className="bg-white border-[3px] border-slate-200 rounded-[2rem] px-6 py-4 shadow-lg relative">
                    <p className="font-black text-slate-600 text-sm leading-snug text-center whitespace-pre-wrap">
                        {currentText}
                    </p>
                    {/* Puntero de la burbuja */}
                    <div className="absolute w-4 h-4 bg-white border-b-[3px] border-r-[3px] border-slate-200 transform rotate-45 left-1/2 -translate-x-1/2 -bottom-2.5 rounded-br-sm"></div>
                </div>
            </div>

            {/* --- SVG del Personaje --- */}
            <svg
                id="drrho-svg"
                viewBox="-175 -125 750 750"
                className="w-full h-full object-contain transition-transform duration-500"
                xmlns="http://www.w3.org/2000/svg"
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                {/* Definición del patrón de cuadrícula diagonal (Tartán/Plaid) */}
                <defs>
                    <pattern id="plaidPattern" patternUnits="userSpaceOnUse" width="20" height="20" patternTransform="rotate(45)">
                        {/* Fondo gris */}
                        <rect width="20" height="20" fill="#7f8c8d" />
                        {/* Líneas rojas */}
                        <line x1="0" y1="0" x2="0" y2="20" stroke="#e74c3c" strokeWidth="3" />
                        <line x1="10" y1="0" x2="10" y2="20" stroke="#e74c3c" strokeWidth="1.5" />
                        {/* Líneas azules */}
                        <line x1="0" y1="0" x2="20" y2="0" stroke="#3498db" strokeWidth="3" />
                        <line x1="0" y1="10" x2="20" y2="10" stroke="#3498db" strokeWidth="1.5" />
                    </pattern>
                </defs>

                {/* Piernas - DETRÁS del torso (dibujadas primero) */}
                <g transform="translate(0, 40)">
                    {/* Pierna izquierda - estilo cápsula simple */}
                    <ellipse cx="165" cy="410" rx="20" ry="45" fill={COLORS.pants} />
                    {/* Pierna derecha */}
                    <ellipse cx="235" cy="410" rx="20" ry="45" fill={COLORS.pants} />
                    {/* Zapatos - óvalos simples y lindos */}
                    <ellipse cx="165" cy="450" rx="24" ry="12" fill={COLORS.stroke} />
                    <ellipse cx="235" cy="450" rx="24" ry="12" fill={COLORS.stroke} />
                </g>

                {/* Cuerpo (Estructura unificada) - ENCIMA de las piernas */}
                <g transform="translate(0, 40)">
                    {/* Torso / Chaleco con patrón tartán */}
                    <rect x="130" y="270" width="140" height="150" rx="40" fill="url(#plaidPattern)" />
                    <path d="M160 270 Q 200 340 240 270" fill={COLORS.shirt} />
                    {/* Pañuelo distintivo de la hermandad */}
                    <path d="M200 300 L 185 330 L 200 350 L 215 330 Z" fill="#EF5777" />
                </g>

                {/* Brazos (Estilo "Noodle") */}
                <g transform="translate(0, 40)">
                    <path d="M135 290 Q 110 350 145 370" stroke={COLORS.shirt} strokeWidth="24" fill="none" />
                    <circle cx="145" cy="370" r="14" fill={COLORS.skin} />
                    <path d="M265 290 Q 290 350 255 370" stroke={COLORS.shirt} strokeWidth="24" fill="none" />
                    <circle cx="255" cy="370" r="14" fill={COLORS.skin} />
                </g>

                {/* Cabeza - separada del cuerpo */}
                <g transform="translate(0, 25)">
                    <circle cx="120" cy="200" r="18" fill={COLORS.skin} />
                    <circle cx="280" cy="200" r="18" fill={COLORS.skin} />
                    <rect x="125" y="100" width="150" height="180" rx="60" fill={COLORS.skin} />

                    {/* Pelo y Peinado */}
                    <path d="M125 150 C 125 80, 275 80, 275 150 L 275 160 C 275 160, 260 160, 250 140 C 200 140, 150 140, 150 160 L 125 160 Z" fill={COLORS.hair} />

                    {/* Rostro Animado */}
                    <g className="transition-transform duration-300">
                        {/* Cejas */}
                        <g transform={`translate(0, ${current.eyebrowsY})`}>
                            <rect x="145" y="165" width="30" height="10" rx="5" fill={COLORS.hair} transform={`rotate(${current.eyebrowsRot}, 160, 170)`} />
                            <rect x="225" y="165" width="30" height="10" rx="5" fill={COLORS.hair} transform={`rotate(${-current.eyebrowsRot}, 240, 170)`} />
                        </g>

                        {/* Ojos Interactivos */}
                        <g transform="translate(0, 10)">
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
                                    <path d="M142 190 H 178 V 175 H 142 Z" fill={COLORS.skin} stroke="none" />
                                    <line x1="143" y1="190" x2="177" y2="190" stroke={COLORS.stroke} strokeWidth="4" />

                                    <circle cx="240" cy="195" r="14" fill="white" stroke={COLORS.stroke} strokeWidth="4" />
                                    <circle cx="240" cy="197" r="6" fill={COLORS.stroke} />
                                    <path d="M222 190 H 258 V 175 H 222 Z" fill={COLORS.skin} stroke="none" />
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
                        </g>

                        {/* Bigote (Rasgo icónico) */}
                        <g transform={`translate(0, ${current.mustacheY})`} className="transition-transform duration-300">
                            <path d="M200 240 Q 220 230 240 240 Q 250 245 245 255 Q 230 265 200 255 Q 170 265 155 255 Q 150 245 160 240 Q 180 230 200 240" fill={COLORS.hair} />
                        </g>

                        {/* Boca */}
                        <g transform="translate(200, 260)">
                            {current.mouth === 'smile' && <path d="M-10 0 Q 0 10 10 0" stroke={COLORS.stroke} strokeWidth="4" fill="none" />}
                            {current.mouth === 'soft_smile' && <path d="M-8 0 Q 0 5 8 0" stroke={COLORS.stroke} strokeWidth="4" fill="none" />}
                            {current.mouth === 'open' && <path d="M-8 0 Q 0 8 8 0 Z" fill="#4B3621" />}
                            {current.mouth === 'o' && <circle cx="0" cy="0" r="6" fill="#4B3621" />}
                            {current.mouth === 'small' && <circle cx="0" cy="0" r="2" fill={COLORS.stroke} />}
                        </g>
                    </g>
                </g>

                {/* Mapa Rúnico Flotante */}
                <g transform="translate(280, 340) rotate(10)">
                    <g className="animate-[pulse_3s_infinite]">
                        <rect x="-25" y="-35" width="50" height="70" rx="8" fill="#F8EFBA" stroke={COLORS.gold} strokeWidth="4" />
                        <circle cx="0" cy="-10" r="10" fill="none" stroke={COLORS.magic} strokeWidth="3" strokeDasharray="3 3" />
                        <path d="M-10 15 L10 15" stroke={COLORS.vest} strokeWidth="3" />
                    </g>
                </g>
            </svg>
        </div>
    );
};

export default DrRhoCharacter;