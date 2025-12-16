import React, { useState, useEffect, useRef } from 'react';
import './LemonadeGame.css';

// --- Icons Components ---
const IconDollar = ({ size = 24, className = "" }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
);
const IconUsers = ({ size = 24, className = "" }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
);
const IconSun = ({ size = 24, className = "", style = {} }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={style}><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
);
const IconCloud = ({ size = 24, className = "", style = {} }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={style}><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"></path></svg>
);
const IconRain = ({ size = 24, className = "", style = {} }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={style}><line x1="16" y1="13" x2="16" y2="21"></line><line x1="8" y1="13" x2="8" y2="21"></line><line x1="12" y1="15" x2="12" y2="23"></line><path d="M20 16.58A5 5 0 0 0 18 7h-1.26A8 8 0 1 0 4 15.25"></path></svg>
);
const IconBook = ({ size = 24 }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path></svg>
);
const IconLogOut = ({ size = 24 }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
);
const IconStar = ({ size = 24, className = "" }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
);
const IconLock = ({ size = 24 }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
);
const IconMegaphone = ({ size = 24 }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 11l18-5v12L3 14v-3z"></path><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"></path></svg>
);
const IconRefresh = ({ size = 24 }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
);

// --- Constants & Data ---
type StandType = 'basic' | 'improved' | 'premium' | 'deluxe' | 'ultimate';
type BannerType = 'basic' | 'improved' | 'premium';
type WeatherType = 'sunny' | 'cloudy' | 'rainy';

// Game Levels Configuration
const LEVELS = [
    {
        id: 1,
        goal: 20,
        unlock: [],
        egg: 'jumping',
        title: "El Comienzo",
        standType: 'basic' as StandType,
        bannerType: 'basic' as BannerType,
        marketingUnlock: false,
        completionMessage: "¡Increíble comienzo! 🚀 Ya diste el primer paso para ser un gran emprendedor."
    },
    {
        id: 2,
        goal: 40,
        unlock: [],
        egg: 'rolling',
        title: "¡Sigue así!",
        standType: 'improved' as StandType,
        bannerType: 'basic' as BannerType,
        marketingUnlock: false,
        completionMessage: "¡Tu negocio está creciendo! 🌱 Cada vez tienes más clientes felices."
    },
    {
        id: 3,
        goal: 60,
        unlock: ['ice'],
        egg: 'raining',
        title: "¡Hielo Fresco!",
        standType: 'improved' as StandType,
        bannerType: 'improved' as BannerType,
        marketingUnlock: true,
        completionMessage: "¡Excelente inversión! 🧊 El hielo hizo que a todos les encantara tu limonada."
    },
    {
        id: 4,
        goal: 80,
        unlock: ['ice', 'orange'],
        egg: 'spinning',
        title: "Naranjadas",
        standType: 'premium' as StandType,
        bannerType: 'improved' as BannerType,
        marketingUnlock: true,
        completionMessage: "¡Naranjadas y Limonadas! 🍹 Eres un maestro de los sabores y las ventas."
    },
    {
        id: 5,
        goal: 120, // Final challenge
        unlock: ['ice', 'orange', 'sugar'],
        egg: 'confetti',
        title: "Imperio de Limonada",
        standType: 'premium' as StandType,
        bannerType: 'premium' as BannerType,
        marketingUnlock: true,
        completionMessage: "¡Eres el REY de la limonada! 👑 Has completado el juego. ¡Felicidades, Founder!"
    }
];

const STAND_TYPES: Record<StandType, any> = {
    basic: {
        name: "Básico",
        description: "Un puesto simple pero funcional",
        priceMultiplier: 1.0,
        customerBonus: 0,
        emoji: "🛒"
    },
    improved: {
        name: "Mejorado",
        description: "¡Más colorido y atractivo!",
        priceMultiplier: 1.1,
        customerBonus: 5,
        emoji: "🎪"
    },
    premium: {
        name: "Premium",
        description: "¡Tu puesto se ve profesional!",
        priceMultiplier: 1.2,
        customerBonus: 10,
        emoji: "🏪"
    },
    deluxe: {
        name: "De Lujo",
        description: "¡El mejor puesto del vecindario!",
        priceMultiplier: 1.3,
        customerBonus: 15,
        emoji: "🏰"
    },
    ultimate: {
        name: "Ultimate",
        description: "¡Increíble! Todos querrán visitarte",
        priceMultiplier: 1.5,
        customerBonus: 25,
        emoji: "🏆"
    }
};

const BANNER_TYPES: Record<BannerType, any> = {
    basic: {
        name: "Simple",
        description: "Un letrero básico",
        marketingEffect: 0,
        emoji: "📝"
    },
    improved: {
        name: "Colorido",
        description: "¡Llamativo y divertido!",
        marketingEffect: 10,
        emoji: "🎨"
    },
    premium: {
        name: "Animado",
        description: "¡Se mueve y brilla!",
        marketingEffect: 20,
        emoji: "✨"
    }
};

const MARKETING_ACTIONS = [
    {
        id: 'flyers',
        name: "Repartir Volantes",
        description: "Anuncia tu puesto en el vecindario",
        cost: 5,
        customerBonus: 15,
        effectDuration: 2,
        emoji: "📢"
    },
    {
        id: 'music',
        name: "Música Alegre",
        description: "Pon música para atraer clientes",
        cost: 3,
        customerBonus: 10,
        effectDuration: 1,
        emoji: "🎵"
    },
    {
        id: 'special',
        name: "Oferta Especial",
        description: "¡2x1 en tu producto!",
        cost: 8,
        customerBonus: 25,
        effectDuration: 1,
        emoji: "🏷️"
    },
    {
        id: 'costume',
        name: "Disfraz Divertido",
        description: "Vístete para llamar la atención",
        cost: 10,
        customerBonus: 20,
        effectDuration: 3,
        emoji: "🎭"
    }
];

const WEATHER_TYPES = [
    { type: 'sunny' as WeatherType, multiplier: 1.5, emoji: '☀️', color: '#FDB813', name: 'Soleado' },
    { type: 'cloudy' as WeatherType, multiplier: 1.0, emoji: '☁️', color: '#95A5A6', name: 'Nublado' },
    { type: 'rainy' as WeatherType, multiplier: 0.6, emoji: '🌧️', color: '#3498DB', name: 'Lluvioso' }
];

const PRICES = {
    lemon: 0.5,
    orange: 0.6,
    sugar: 0.3,
    cup: 0.1,
    ice: 0.2
};

// --- Imports ---
// --- Imports ---
import { DinoCharacter, DinoMood } from '@/components/demo/DinoCharacter';

// Tutorial Interface Extension
interface Lesson {
    title: string;
    text: string;
    action: string;
    highlightId?: string; // ID of the element to highlight
}

const LESSONS: Record<string, Lesson> = {
    intro: {
        title: "¡Hola Amigo!",
        text: "¡Soy Liruf! 🦖 Me encanta la limonada. ¿Me ayudas a vender mucha? ¡Seremos el mejor equipo!",
        action: "¡Sí, vamos!"
    },
    ice: {
        title: "¡Hielo Fresco!",
        text: "¡Brrr! 🧊 Con hielo la limonada sabe mejor. ¡A mis amigos les encanta fría! Compremos un poco.",
        action: "¡Comprar Hielo!",
        highlightId: "buy-ice-btn"
    },
    orange: {
        title: "¡Naranjadas!",
        text: "¡Mmm! 🍊 ¿Y si vendemos naranjadas también? ¡A algunos dinos les gustan más! ¡Probemos!",
        action: "¡Vender Naranjadas!",
        highlightId: "product-selector"
    },
    investment: {
        title: "Invertir es Crecer",
        text: "Gastamos dinero en limones... ¡pero es para ganar MÁS dinero luego! 💰 ¡Eso es ser muy listo!",
        action: "¡Soy listo!",
        highlightId: "buy-lemon-btn"
    },
    profit: {
        title: "¡Ganamos!",
        text: "¡Mira cuántas monedas! 🌟 Ganamos más de lo que gastamos. ¡Eso es tener éxito!",
        action: "¡Yupii!"
    },
    loss: {
        title: "¡Ups!",
        text: "Hoy no ganamos mucho... 🦖 Pero no importa. ¡Mañana lo haremos mejor! Quizás bajemos el precio.",
        action: "¡A intentar de nuevo!",
        highlightId: "price-control"
    },
    savings: {
        title: "Guardar Monedas",
        text: "¡No gastemos todo! 🏦 Guardemos un poco porsiacaso. ¡Los dinos precavidos valen por dos!",
        action: "¡Ahorrar!"
    },
    quality: {
        title: "¿Rico o Barato?",
        text: "Si ponemos muchos ingredientes sabe rico 😋, pero cuesta más. ¡Hay que buscar el punto medio!",
        action: "¡Entendido!",
        highlightId: "recipe-lemons"
    },
    marketing: {
        title: "¡Que todos sepan!",
        text: "¡Gritemos fuerte! 📢 O usemos disfraces. Si nos ven, ¡vendrán a comprar!",
        action: "¡Hacer ruido!",
        highlightId: "marketing-section"
    },
    stand: {
        title: "¡Puesto Nuevo!",
        text: "¡Wow! Podemos hacer que el puesto se vea genial. 🎪 ¡Así vendrán más amigos!",
        action: "¡Decorar!",
        highlightId: "stand-selector"
    },
    pricing: {
        title: "El Precio Justo",
        text: "Si es muy caro, nadie compra. 📉 Si es muy barato, no ganamos. ¡Busquemos el precio perfecto!",
        action: "¡A probar!",
        highlightId: "price-control"
    }
};

// --- Components ---

const Mascot = ({ lesson, onClose }: { lesson: any, onClose: () => void }) => {
    if (!lesson) return null;

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
            <div className="bg-white rounded-[3rem] shadow-2xl max-w-4xl w-full overflow-hidden mascot-enter relative flex flex-col md:flex-row border-4 border-green-400">
                {/* Visual Side */}
                <div className="md:w-1/2 bg-gradient-to-b from-blue-100 to-green-100 p-8 flex items-center justify-center relative overflow-hidden">
                    <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>
                    <div className="w-64 h-64 relative z-10">
                        <DinoCharacter showBubble={false} className="transform scale-125" />
                    </div>
                </div>

                {/* Content Side */}
                <div className="md:w-1/2 p-8 flex flex-col justify-center bg-white relative">
                    <div className="absolute top-4 right-4 text-green-200">
                        <IconMegaphone size={48} />
                    </div>

                    <h4 className="text-3xl font-extrabold text-green-600 mb-4 font-fredoka">{lesson.title}</h4>

                    <div className="bg-green-50 p-6 rounded-2xl border-l-4 border-green-500 mb-8 relative">
                        <div className="absolute -top-3 -left-3 bg-green-500 rounded-full p-1">
                            <span className="text-xl">💬</span>
                        </div>
                        <p className="text-gray-700 text-lg leading-relaxed italic">"{lesson.text}"</p>
                    </div>

                    <button onClick={onClose}
                        className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white text-xl font-bold py-4 rounded-xl shadow-lg transition-all hover:scale-[1.02] hover:shadow-xl flex items-center justify-center gap-2">
                        <span>{lesson.action}</span>
                        <span className="text-2xl">➔</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

const RulesModal = ({ onClose }: { onClose: () => void }) => (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-8">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-3xl font-bold text-blue-800">📜 Reglas del Juego</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">✕</button>
                </div>

                <div className="space-y-6 text-lg text-gray-700">
                    <div className="bg-gradient-to-r from-yellow-50 to-orange-50 p-4 rounded-xl">
                        <h3 className="font-bold text-yellow-700 mb-2">🏆 Objetivo</h3>
                        <p>Avanza por los <strong>5 Niveles</strong> alcanzando la meta de dinero en cada uno.</p>
                    </div>

                    <div className="bg-gradient-to-r from-red-50 to-pink-50 p-4 rounded-xl">
                        <h3 className="font-bold text-red-700 mb-2">⚠️ Cuidado</h3>
                        <p>Si te quedas sin dinero para comprar ingredientes, ¡pierdes el nivel!</p>
                    </div>

                    {/* ... */}

                    <button onClick={onClose} className="mt-8 w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white text-xl font-bold py-4 rounded-xl">
                        ¡Entendido! Vamos a jugar
                    </button>
                </div>
            </div>
        </div>
    </div>
);

const ConfirmationModal = ({ isOpen, onClose, onConfirm, title, message }: any) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 text-center">
                <div className="text-5xl mb-4">⚠️</div>
                <h3 className="text-2xl font-bold text-gray-800 mb-2">{title}</h3>
                <p className="text-gray-600 mb-6">{message}</p>
                <div className="flex gap-4">
                    <button onClick={onClose} className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-3 rounded-xl transition-colors">
                        No, cancelar
                    </button>
                    <button onClick={onConfirm} className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold py-3 rounded-xl transition-colors">
                        Sí, salir
                    </button>
                </div>
            </div>
        </div>
    );
};

// Tutorial Steps
const TUTORIAL_STEPS = [
    {
        text: "¡Hola! Soy Liruf 🦖 Te mostraré cómo jugar al juego de limonada.",
        highlightId: null,
        position: 'center'
    },
    {
        text: "Aquí ves tu dinero 💰 Úsalo para comprar ingredientes.",
        highlightId: "money-display",
        position: 'bottom'
    },
    {
        text: "Compra limones, azúcar y vasos aquí 🍋 ¡Necesitas ingredientes para hacer limonada!",
        highlightId: "ingredients-section",
        position: 'top'
    },
    {
        text: "Ajusta tu receta aquí 🥤 Más limones = mejor sabor, pero cuesta más.",
        highlightId: "recipe-section",
        position: 'top'
    },
    {
        text: "Elige el precio de venta 💵 No muy caro, no muy barato.",
        highlightId: "price-control",
        position: 'top'
    },
    {
        text: "¡Presiona aquí para empezar a vender! 🚀",
        highlightId: "start-day-btn",
        position: 'top'
    },
    {
        text: "¡Ahora sabes jugar! 🎉 ¡Diviértete vendiendo limonada!",
        highlightId: null,
        position: 'center'
    }
];

const TutorialOverlay = ({ step, onNext, onSkip }: { step: number, onNext: () => void, onSkip: () => void }) => {
    const currentStep = TUTORIAL_STEPS[step];
    if (!currentStep) return null;

    // Get highlighted element position
    const highlightedElement = currentStep.highlightId ? document.getElementById(currentStep.highlightId) : null;
    const rect = highlightedElement?.getBoundingClientRect();

    return (
        <div className="fixed inset-0 z-[200]">
            {/* Dark overlay */}
            <div className="absolute inset-0 bg-black/70" onClick={onNext} />

            {/* Spotlight on highlighted element */}
            {rect && (
                <div
                    className="absolute bg-white/10 ring-4 ring-yellow-400 rounded-2xl animate-pulse"
                    style={{
                        top: `${rect.top - 8}px`,
                        left: `${rect.left - 8}px`,
                        width: `${rect.width + 16}px`,
                        height: `${rect.height + 16}px`,
                        boxShadow: '0 0 0 9999px rgba(0,0,0,0.7)'
                    }}
                />
            )}

            {/* Liruf with message */}
            <div className="fixed bottom-4 right-4 w-64 h-64 pointer-events-auto z-[201]">
                <DinoCharacter
                    currentText={currentStep.text}
                    showBubble={true}
                    mood="happy"
                    bubblePosition="tutorial"
                />
            </div>

            {/* Navigation buttons */}
            <div className="fixed bottom-8 left-1/2 -translate-x-1/2 flex gap-4 pointer-events-auto z-[201]">
                <button
                    onClick={onSkip}
                    className="bg-gray-500 hover:bg-gray-600 text-white px-6 py-3 rounded-xl font-bold transition-all"
                >
                    Saltar Tutorial
                </button>
                <button
                    onClick={onNext}
                    className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white px-8 py-3 rounded-xl font-bold transition-all shadow-lg"
                >
                    {step < TUTORIAL_STEPS.length - 1 ? 'Siguiente →' : '¡Entendido!'}
                </button>
            </div>
        </div>
    );
};

const EasterEgg = ({ type }: { type: any }) => {
    if (!type) return null;

    if (type === 'rolling') {
        return <div className="rolling-lemon">🍋</div>;
    }
    if (type === 'raining') {
        return (
            <>
                {[...Array(15)].map((_, i) => (
                    <div key={i} className="raining-lemon"
                        style={{
                            left: `${Math.random() * 100}%`,
                            animationDuration: `${2 + Math.random()}s`,
                            animationDelay: `${Math.random()}s`
                        }}>
                        🍋
                    </div>
                ))}
            </>
        );
    }
    return null;
};

// Placeholder for main component to be filled in next step
export const LemonadeGame = () => {
    const [screen, setScreen] = useState<'menu' | 'shop' | 'selling' | 'results'>('menu');
    const [currentLevel, setCurrentLevel] = useState(1);
    const [money, setMoney] = useState(20);
    const [day, setDay] = useState(1);
    const [inventory, setInventory] = useState({ lemons: 0, oranges: 0, sugar: 0, cups: 0, ice: 0 });
    const [recipe, setRecipe] = useState({ lemons: 2, oranges: 0, sugar: 2, ice: 0 });
    const [product, setProduct] = useState<'lemonade' | 'orangeade'>('lemonade');
    const [price, setPrice] = useState(1);
    const [weather, setWeather] = useState('sunny');
    const [customers, setCustomers] = useState<any[]>([]);
    const [dailyStats, setDailyStats] = useState({ sold: 0, revenue: 0, cost: 0 });
    const [notification, setNotification] = useState('');
    const [lirufMood, setLirufMood] = useState<DinoMood>('happy');
    const [lirufAdvice, setLirufAdvice] = useState('');

    // Tutorial System
    const [showTutorial, setShowTutorial] = useState(false);
    const [tutorialStep, setTutorialStep] = useState(0);

    // Educational & UI State
    const [currentLesson, setCurrentLesson] = useState<any>(null);
    const [showRules, setShowRules] = useState(false);
    const [showQuitConfirm, setShowQuitConfirm] = useState(false);
    const [hasShownIntro, setHasShownIntro] = useState(false);
    const [activeEasterEgg, setActiveEasterEgg] = useState<any>(null);

    // New State for Stand Customization and Marketing
    const [activeMarketing, setActiveMarketing] = useState<any[]>([]);
    const [standType, setStandType] = useState<StandType>('basic');
    const [bannerType, setBannerType] = useState<BannerType>('basic');
    const [marketingBudget, setMarketingBudget] = useState(0);

    const currentLevelData = LEVELS.find(l => l.id === currentLevel) || LEVELS[0];

    // --- Smart Coaching System (Liruf's Brain) ---
    useEffect(() => {
        if (screen === 'shop') {
            const getAdvice = () => {
                const canBuyIce = currentLevelData.unlock.includes('ice');

                // 1. Weather-specific advice
                if (weather === 'rainy') {
                    if (canBuyIce && inventory.ice > 5) {
                        setLirufMood('thinking');
                        return "¡Llueve! 🌧️ Mejor no compremos mucho hielo, nadie querrá cosas frías.";
                    }
                    setLirufMood('thinking');
                    return "Está lloviendo 🌧️ La gente no saldrá mucho hoy. Cuidado con comprar demasiado.";
                }

                if (weather === 'sunny') {
                    if (canBuyIce && inventory.ice < 5) {
                        setLirufMood('excited');
                        return "¡Hace calor! ☀️ Si compramos hielo venderemos muchísimo más.";
                    }
                    setLirufMood('happy');
                    return canBuyIce
                        ? "¡Día soleado! ☀️ Perfecto para vender limonada fría."
                        : "¡Día soleado! ☀️ Perfecto para vender limonada refrescante.";
                }

                if (weather === 'hot') {
                    if (canBuyIce && inventory.ice < 10) {
                        setLirufMood('excited');
                        return "¡Hace MUCHO calor! 🔥 ¡Compremos hielo! La gente querrá limonada helada.";
                    }
                    setLirufMood('happy');
                    return "¡Día perfecto! 🔥 Con este calor venderemos mucho.";
                }

                if (weather === 'cloudy') {
                    setLirufMood('thinking');
                    return "Está nublado ☁️ El clima está bien, ni muy caliente ni muy frío.";
                }

                // 2. Price Logic
                if (price > 2.5) {
                    setLirufMood('sad');
                    return "¡Cuidado! 💰 El precio está muy alto. La gente no comprará.";
                }
                if (price < 0.75) {
                    setLirufMood('thinking');
                    return "El precio está muy bajo 📉 Ganaremos poco dinero así.";
                }

                // 3. Inventory warnings
                if (inventory.lemons < 5 && inventory.oranges < 5) {
                    setLirufMood('shocked');
                    return "¡No tenemos ingredientes! 🍋 Compremos limones o naranjas.";
                }

                // 4. Money management
                if (money < 5) {
                    setLirufMood('sad');
                    return "Nos queda poco dinero 💵 Cuidado con los gastos.";
                }

                // 5. Default encouragement
                setLirufMood('happy');
                return "¡Todo listo! 🦖 Compremos lo que necesitemos y empecemos a vender.";
            };

            setLirufAdvice(getAdvice());
        }

        // Results screen advice
        if (screen === 'results') {
            const profit = dailyStats.revenue - dailyStats.cost;
            const isLevelComplete = money >= currentLevelData.goal;

            if (isLevelComplete) {
                setLirufMood('excited');
                // Use the special completion message
                const msg = currentLevelData.completionMessage || "¡Nivel Completado! 🎉";
                setLirufAdvice(`${msg}`);
            } else if (profit > 5) {
                setLirufMood('excited');
                setLirufAdvice(`¡Excelente! 🎉 Ganamos $${profit.toFixed(2)}. ¡Sigamos así!`);
            } else if (profit > 0) {
                setLirufMood('happy');
                setLirufAdvice(`Bien hecho 👍 Ganamos $${profit.toFixed(2)}. Podemos mejorar.`);
            } else {
                setLirufMood('sad');
                setLirufAdvice(`Perdimos dinero 😔 Ajustemos el precio o la receta para el próximo día.`);
            }
        }
    }, [screen, weather, price, inventory, money, dailyStats]);

    // Helper to show notifications (Feed into Liruf)
    const showNotification = (message: string) => {
        setNotification(message);
        setLirufMood('excited');
        setTimeout(() => {
            setNotification('');
            setLirufMood('happy');
        }, 3000);
    };

    // Tutorial handlers
    const startTutorial = () => {
        setShowTutorial(true);
        setTutorialStep(0);
    };

    const nextTutorialStep = () => {
        if (tutorialStep < TUTORIAL_STEPS.length - 1) {
            setTutorialStep(prev => prev + 1);
        } else {
            setShowTutorial(false);
            setTutorialStep(0);
        }
    };

    const skipTutorial = () => {
        setShowTutorial(false);
        setTutorialStep(0);
    };

    // Trigger Easter Egg on Level Start
    useEffect(() => {
        if (currentLevelData.egg && screen === 'shop' && day === 1) {
            setActiveEasterEgg(currentLevelData.egg);
            setTimeout(() => setActiveEasterEgg(null), 5000);
        }

        // Update stand and banner when level changes
        setStandType(currentLevelData.standType);
        setBannerType(currentLevelData.bannerType);
    }, [currentLevel, screen, day, currentLevelData]);

    // --- Game Logic ---

    const buyItem = (item: string, amount: number) => {
        const cost = PRICES[item as keyof typeof PRICES] * amount;
        if (money >= cost) {
            setMoney(prev => prev - cost);
            const itemKey = item === 'lemon' ? 'lemons' : item === 'orange' ? 'oranges' : item === 'sugar' ? 'sugar' : item === 'ice' ? 'ice' : 'cups';
            setInventory(prev => ({ ...prev, [itemKey]: prev[itemKey as keyof typeof inventory] + amount }));
            showNotification(`¡Compraste ${amount} ${item === 'lemon' ? 'limones' : item === 'orange' ? 'naranjas' : item === 'sugar' ? 'azúcar' : item === 'ice' ? 'hielos' : 'vasos'}!`);

            // Show investment lesson on first purchase
            if (money > 0 && money - cost > 0 && day === 1) {
                setTimeout(() => setCurrentLesson(LESSONS.investment), 1000);
            }
        } else {
            showNotification('¡No tienes suficiente dinero! 💸');
        }
    };

    const applyMarketing = (marketingAction: any) => {
        if (money >= marketingAction.cost) {
            setMoney(prev => prev - marketingAction.cost);
            setMarketingBudget(prev => prev + marketingAction.cost);

            // Add marketing effect
            setActiveMarketing(prev => [
                ...prev,
                {
                    ...marketingAction,
                    activeUntil: day + marketingAction.effectDuration
                }
            ]);

            showNotification(`¡${marketingAction.name} activado! +${marketingAction.customerBonus}% clientes`);

            // Show marketing lesson if first time
            if (currentLevelData.marketingUnlock && !hasShownIntro) {
                setTimeout(() => setCurrentLesson(LESSONS.marketing), 500);
            }
        } else {
            showNotification('¡No tienes dinero para publicidad!');
        }
    };

    const removeMarketing = (index: number) => {
        setActiveMarketing(prev => prev.filter((_, i) => i !== index));
    };

    const startDay = () => {
        // Check ingredients based on product
        let maxGlasses = 0;
        if (product === 'lemonade') {
            maxGlasses = Math.min(
                recipe.lemons > 0 ? Math.floor(inventory.lemons / recipe.lemons) : 0,
                recipe.sugar > 0 ? Math.floor(inventory.sugar / recipe.sugar) : 0,
                recipe.ice > 0 ? Math.floor(inventory.ice / recipe.ice) : Infinity,
                inventory.cups
            );
        } else {
            maxGlasses = Math.min(
                recipe.oranges > 0 ? Math.floor(inventory.oranges / recipe.oranges) : 0,
                recipe.sugar > 0 ? Math.floor(inventory.sugar / recipe.sugar) : 0,
                recipe.ice > 0 ? Math.floor(inventory.ice / recipe.ice) : Infinity,
                inventory.cups
            );
        }

        if (maxGlasses === 0) {
            showNotification(`¡Necesitas ingredientes para hacer ${product === 'lemonade' ? 'limonada' : 'naranjada'}!`);
            return;
        }

        setScreen('selling');
    };

    // Simulation Effect
    useEffect(() => {
        if (screen !== 'selling') return;

        let isMounted = true;

        const runSimulation = async () => {
            const currentWeather = WEATHER_TYPES.find(w => w.type === weather) || WEATHER_TYPES[0];

            const fruitCount = product === 'lemonade' ? recipe.lemons : recipe.oranges;
            const qualityFactor = (fruitCount + recipe.sugar) / 6;
            const priceFactor = Math.max(0, 2.5 - price);

            // Ice Bonus
            let iceBonus = 1.0;
            if (recipe.ice > 0) {
                if (weather === 'sunny') iceBonus = 1.3; // Huge bonus on sunny days
                else if (weather === 'rainy') iceBonus = 0.8; // Penalty on rainy days
            }

            // Orangeade Bonus (Diversification)
            let productBonus = product === 'orangeade' ? 1.2 : 1.0;

            // Stand Bonus
            const standBonus = STAND_TYPES[standType].priceMultiplier;
            const standCustomerBonus = STAND_TYPES[standType].customerBonus / 100;

            // Banner Bonus
            const bannerBonus = BANNER_TYPES[bannerType].marketingEffect / 100;

            // Marketing Bonus
            let marketingBonus = 0;
            activeMarketing.forEach(action => {
                if (day <= action.activeUntil) {
                    marketingBonus += action.customerBonus / 100;
                }
            });

            const baseCustomers = 15;
            const variation = 0.8 + Math.random() * 0.4;

            let potentialCustomers = Math.floor(
                baseCustomers *
                currentWeather.multiplier *
                qualityFactor *
                priceFactor *
                iceBonus *
                productBonus *
                (1 + standCustomerBonus + bannerBonus + marketingBonus) *
                variation
            );

            let maxGlasses = 0;
            if (product === 'lemonade') {
                maxGlasses = Math.min(
                    Math.floor(inventory.lemons / recipe.lemons),
                    Math.floor(inventory.sugar / recipe.sugar),
                    recipe.ice > 0 ? Math.floor(inventory.ice / recipe.ice) : Infinity,
                    inventory.cups
                );
            } else {
                maxGlasses = Math.min(
                    Math.floor(inventory.oranges / recipe.oranges),
                    Math.floor(inventory.sugar / recipe.sugar),
                    recipe.ice > 0 ? Math.floor(inventory.ice / recipe.ice) : Infinity,
                    inventory.cups
                );
            }

            const actualSales = Math.min(potentialCustomers, maxGlasses);

            const customerDelay = 500;
            for (let i = 0; i < actualSales; i++) {
                if (!isMounted) return;
                await new Promise(r => setTimeout(r, customerDelay));
                const customer = { id: Date.now() + i, satisfaction: 'happy', x: -100 };
                setCustomers(prev => [...prev, customer]);
                setTimeout(() => {
                    if (isMounted) setCustomers(prev => prev.filter(c => c.id !== customer.id));
                }, 2000);
            }

            await new Promise(r => setTimeout(r, 1000));
            if (!isMounted) return;

            const revenue = actualSales * price * standBonus; // Apply stand price multiplier
            let costPerGlass = 0;
            if (product === 'lemonade') {
                costPerGlass = recipe.lemons * PRICES.lemon + recipe.sugar * PRICES.sugar + PRICES.cup + recipe.ice * PRICES.ice;
            } else {
                costPerGlass = recipe.oranges * PRICES.orange + recipe.sugar * PRICES.sugar + PRICES.cup + recipe.ice * PRICES.ice;
            }
            const cost = actualSales * costPerGlass;
            const profit = revenue - cost;

            setInventory(prev => ({
                ...prev,
                lemons: product === 'lemonade' ? prev.lemons - (actualSales * recipe.lemons) : prev.lemons,
                oranges: product === 'orangeade' ? prev.oranges - (actualSales * recipe.oranges) : prev.oranges,
                sugar: prev.sugar - (actualSales * recipe.sugar),
                ice: prev.ice - (actualSales * recipe.ice),
                cups: prev.cups - actualSales
            }));

            setMoney(prev => prev + revenue);
            setDailyStats({ sold: actualSales, revenue, cost });

            setScreen('results');

            // Post-Game Analysis by Liruf
            if (profit > 0) {
                setLirufMood('excited');
                setLirufAdvice(`¡Genial! Ganamos $${profit.toFixed(2)}. 🎉 ¡Buen precio y buenos ingredientes!`);
            } else {
                setLirufMood('sad');
                if (price > 4) setLirufAdvice("¡Demasiado caro! 💸 Nadie quiso comprar.");
                else if (actualSales === 0) setLirufAdvice("¡Oh no! No vendimos nada. 🤔 Revisa el precio o la receta.");
                else setLirufAdvice("Gastamos mucho en ingredientes... 📉 ¡Intentemos gastar menos mañana!");
            }

            // Trigger Result Lessons
            setTimeout(() => {
                if (profit > 0) {
                    const randomLesson = Math.random();
                    if (randomLesson > 0.8) setCurrentLesson(LESSONS.savings);
                    else if (randomLesson > 0.6) setCurrentLesson(LESSONS.profit);
                    else if (randomLesson > 0.4) setCurrentLesson(LESSONS.pricing);
                } else {
                    setCurrentLesson(LESSONS.loss);
                }
            }, 1000);
        };

        runSimulation();

        return () => { isMounted = false; };
    }, [screen, activeMarketing, bannerType, currentLevelData, day, inventory, price, product, recipe, standType, weather]);

    const nextDay = () => {
        setDay(prev => prev + 1);
        setScreen('shop');
        setCustomers([]);

        // New Weather for the next day
        const randomWeather = WEATHER_TYPES[Math.floor(Math.random() * WEATHER_TYPES.length)];
        setWeather(randomWeather.type);

        // Remove expired marketing
        setActiveMarketing(prev => prev.filter(action => day < action.activeUntil));
    };

    const nextLevel = () => {
        if (currentLevel < 5) {
            setCurrentLevel(prev => prev + 1);
            setMoney(20); // Reset money for balance
            setDay(1);
            setInventory({ lemons: 0, oranges: 0, sugar: 0, cups: 0, ice: 0 });
            setRecipe({ lemons: 2, oranges: 0, sugar: 2, ice: 0 });
            setProduct('lemonade');
            setActiveMarketing([]);
            setMarketingBudget(0);
            setMarketingBudget(0);
            setScreen('shop');

            // New Weather for the level
            const randomWeather = WEATHER_TYPES[Math.floor(Math.random() * WEATHER_TYPES.length)];
            setWeather(randomWeather.type);

            // Check for unlocks
            const nextLvl = LEVELS.find(l => l.id === currentLevel + 1);
            if (nextLvl) {
                if (nextLvl.unlock.includes('ice')) setTimeout(() => setCurrentLesson(LESSONS.ice), 500);
                if (nextLvl.unlock.includes('orange')) setTimeout(() => setCurrentLesson(LESSONS.orange), 500);
                setTimeout(() => setCurrentLesson(LESSONS.stand), 1000);
            }
        } else {
            // Game Complete
            setScreen('menu');
        }
    };

    const resetGame = () => {
        setMoney(20);
        setDay(1);
        setCurrentLevel(1);
        setInventory({ lemons: 0, oranges: 0, sugar: 0, cups: 0, ice: 0 });
        setRecipe({ lemons: 2, oranges: 0, sugar: 2, ice: 0 });
        setProduct('lemonade');
        setPrice(1);
        setActiveMarketing([]);
        setMarketingBudget(0);
        setScreen('menu');
        setHasShownIntro(false);
        setShowQuitConfirm(false);
    };

    const startGame = () => {
        setScreen('shop');

        // Initial Weather
        const randomWeather = WEATHER_TYPES[Math.floor(Math.random() * WEATHER_TYPES.length)];
        setWeather(randomWeather.type);

        if (!hasShownIntro) {
            setTimeout(() => {
                setCurrentLesson(LESSONS.intro);
                setHasShownIntro(true);
            }, 500);
        }
    };

    // --- Render Components ---

    const RenderStand = ({ type, bannerType, size = 'medium' }: { type: StandType, bannerType: BannerType, size?: 'small' | 'medium' | 'large' }) => {
        const sizeClass = size === 'small' ? 'w-16 h-16' : size === 'medium' ? 'w-32 h-32' : 'w-64 h-64';
        const bannerSize = size === 'small' ? 'text-xs' : size === 'medium' ? 'text-lg' : 'text-3xl';

        return (
            <div className={`relative ${sizeClass}`}>
                {/* Stand Base */}
                <div className={`absolute inset-0 rounded-xl stand-${type}`}>
                    <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-4xl">🏪</span>
                    </div>

                    {/* Banner */}
                    <div className={`absolute -top-6 left-1/2 transform -translate-x-1/2 px-4 py-1 rounded-full ${bannerType === 'basic' ? 'banner-basic' : bannerType === 'improved' ? 'banner-improved' : 'banner-premium'} ${bannerSize} font-bold whitespace-nowrap`}>
                        {product === 'lemonade' ? 'LIMONADA' : 'NARANJADA'}
                    </div>

                    {/* Decorative Elements */}
                    {type === 'improved' && (
                        <>
                            <div className="absolute -top-2 -left-2 text-2xl">🎈</div>
                            <div className="absolute -top-2 -right-2 text-2xl">🎈</div>
                        </>
                    )}
                    {type === 'premium' && (
                        <>
                            <div className="absolute -top-4 left-1/4 text-3xl">✨</div>
                            <div className="absolute -top-4 right-1/4 text-3xl">✨</div>
                        </>
                    )}
                    {type === 'deluxe' && (
                        <>
                            <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 text-4xl">👑</div>
                            <div className="absolute bottom-2 left-2 text-2xl">💎</div>
                            <div className="absolute bottom-2 right-2 text-2xl">💎</div>
                        </>
                    )}
                </div>
            </div>
        );
    };

    // --- Main Render ---

    if (screen === 'menu') {
        return (
            <div className="lemonade-game-container min-h-screen bg-gradient-to-b from-yellow-300 via-yellow-200 to-green-200 flex items-center justify-center p-4 relative overflow-hidden">
                <div className="max-w-6xl w-full grid md:grid-cols-2 gap-8 items-center z-10">

                    {/* Left Column: Title & Actions */}
                    <div className="flex flex-col items-center md:items-start pl-4">
                        <div className="bg-white/90 backdrop-blur-sm rounded-3xl shadow-2xl p-8 w-full text-center md:text-left border-4 border-yellow-400 hover:scale-[1.02] transition-transform duration-500 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                <div className="text-9xl transform rotate-12">🍋</div>
                            </div>

                            <div className="relative z-10">
                                <div className="text-6xl mb-2 animate-bounce-custom inline-block">🍋</div>
                                <h1 className="text-4xl md:text-5xl font-bold text-yellow-600 mb-2 leading-tight">Puesto de<br />Limonada</h1>
                                <p className="text-gray-600 mb-6 text-lg font-medium">¡Conviértete en un magnate!</p>

                                <div className="space-y-3">
                                    <button onClick={startGame}
                                        className="w-full bg-gradient-to-r from-yellow-400 to-orange-500 text-white text-xl font-bold py-4 rounded-xl shadow-lg hover:scale-[1.02] transition-transform animate-pulse-slow flex items-center justify-center gap-2">
                                        {currentLevel > 1 ? '▶️ Continuar Aventura' : '🎮 Jugar Ahora'}
                                    </button>
                                    <button onClick={() => setShowRules(true)}
                                        className="w-full bg-white border-2 border-blue-400 text-blue-500 hover:bg-blue-50 font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2">
                                        <IconBook size={20} /> Reglas del Juego
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Progress & Status */}
                    <div className="space-y-6">
                        {/* Level Map */}
                        <div className="bg-white/80 rounded-2xl p-6 shadow-xl backdrop-blur-sm">
                            <h3 className="font-bold text-gray-700 mb-4 flex items-center gap-2">
                                <span className="text-xl">🗺️</span> Mapa de Niveles
                            </h3>
                            <div className="flex justify-between items-center relative px-2">
                                {/* Line */}
                                <div className="absolute top-1/2 left-4 right-4 h-1 bg-gray-300 -z-10 rounded-full">
                                    <div className="h-full bg-gradient-to-r from-yellow-400 to-orange-400 transition-all duration-1000" style={{ width: `${((currentLevel - 1) / 4) * 100}%` }}></div>
                                </div>

                                {LEVELS.map((lvl) => {
                                    const isUnlocked = lvl.id <= currentLevel;
                                    const isCurrent = lvl.id === currentLevel;
                                    return (
                                        <div key={lvl.id} className="relative group">
                                            <div className={`w-12 h-12 rounded-full flex items-center justify-center border-2 font-bold transition-all duration-300 z-10 relative
                                                ${isCurrent ? 'bg-orange-500 border-orange-600 text-white scale-125 shadow-lg' :
                                                    isUnlocked ? 'bg-yellow-400 border-yellow-500 text-white' : 'bg-gray-200 border-gray-300 text-gray-400'}`}>
                                                {isUnlocked ? lvl.id : <IconLock size={14} />}
                                            </div>
                                            {/* Tooltip */}
                                            <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 text-[10px] font-bold bg-white px-2 py-1 rounded shadow opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-20 pointer-events-none">
                                                {lvl.title}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Current Stand Preview */}
                        <div className="bg-white/80 rounded-2xl p-6 shadow-xl backdrop-blur-sm flex items-center gap-6">
                            <div className="flex-shrink-0">
                                <RenderStand
                                    type={currentLevelData.standType}
                                    bannerType={currentLevelData.bannerType}
                                    size="medium"
                                />
                            </div>
                            <div className="flex-grow">
                                <div className="flex justify-between items-start mb-2">
                                    <div>
                                        <h3 className="font-bold text-lg text-gray-800">Nivel {currentLevel}</h3>
                                        <p className="text-sm text-yellow-700 font-bold">{STAND_TYPES[currentLevelData.standType].name}</p>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-xs text-gray-500">Meta</div>
                                        <div className="font-bold text-green-600">${currentLevelData.goal}</div>
                                    </div>
                                </div>

                                <p className="text-xs text-gray-600 mb-3 line-clamp-2">{STAND_TYPES[currentLevelData.standType].description}</p>

                                <div className="flex flex-wrap gap-2">
                                    <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-[10px] font-bold flex items-center gap-1">
                                        <IconUsers size={12} /> +{STAND_TYPES[currentLevelData.standType].customerBonus}%
                                    </span>
                                    <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-[10px] font-bold flex items-center gap-1">
                                        <IconDollar size={12} /> x{STAND_TYPES[currentLevelData.standType].priceMultiplier}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {notification && (
                    <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 bg-gray-900/90 text-white px-6 py-3 rounded-full shadow-lg z-50 animate-in slide-in-from-bottom-5">
                        {notification}
                    </div>
                )}

                {showRules && <RulesModal onClose={() => setShowRules(false)} />}
                {showTutorial && <TutorialOverlay step={tutorialStep} onNext={nextTutorialStep} onSkip={skipTutorial} />}

                {/* Background Decor */}
                <div className="absolute bottom-0 w-full h-1/3 bg-gradient-to-t from-green-300/30 to-transparent pointer-events-none"></div>
            </div>
        );
    }

    if (screen === 'shop') {
        const canBuyIce = currentLevelData.unlock.includes('ice');
        const canBuyOrange = currentLevelData.unlock.includes('orange');
        const canUseMarketing = currentLevelData.marketingUnlock;

        return (
            <div className="lemonade-game-container min-h-screen bg-gradient-to-b from-blue-50 to-cyan-50 p-4">
                <EasterEgg type={activeEasterEgg} />
                <div className="max-w-6xl mx-auto">
                    {/* Header */}
                    <div className="flex flex-col md:flex-row justify-between items-center mb-6 bg-white p-4 rounded-2xl shadow-md">
                        <div className="flex items-center gap-4 mb-4 md:mb-0">
                            <button onClick={() => setShowQuitConfirm(true)} className="p-2 bg-red-100 text-red-600 rounded-full hover:bg-red-200" title="Abandonar Partida">
                                <IconLogOut />
                            </button>
                            <div>
                                <h2 className="text-2xl font-bold text-gray-800">Nivel {currentLevel} - Día {day}</h2>
                                <p className="text-gray-500">Meta: ${currentLevelData.goal} | {currentLevelData.title}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <button onClick={startTutorial} className="px-4 py-2 bg-purple-100 text-purple-600 rounded-xl hover:bg-purple-200 font-bold flex items-center gap-2 transition-transform hover:scale-105" title="Ver Tutorial">
                                <IconMegaphone size={20} />
                                <span className="hidden md:inline">Ver Tutorial</span>
                            </button>
                            <div id="money-display" className="flex items-center gap-2 text-green-600 font-bold text-3xl">
                                <IconDollar /> {money.toFixed(2)}
                            </div>
                        </div>
                    </div>

                    <div className="grid lg:grid-cols-3 gap-6 mb-6">
                        {/* Tienda */}
                        <div id="ingredients-section" className="bg-white p-6 rounded-3xl shadow-lg">
                            <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">🛒 Tienda de Ingredientes</h3>
                            <div className="space-y-4">
                                <div className="flex items-center justify-between bg-gradient-to-r from-yellow-50 to-orange-50 p-3 rounded-xl hover:scale-[1.02] transition-transform">
                                    <div className="text-center">
                                        <div className="text-3xl">🍋</div>
                                        <div className="font-bold text-yellow-700">{inventory.lemons}</div>
                                    </div>
                                    <div className="flex gap-2">
                                        {[5, 10].map(amt => (
                                            <button key={amt} onClick={() => buyItem('lemon', amt)}
                                                className="bg-gradient-to-r from-yellow-400 to-orange-400 hover:from-yellow-500 hover:to-orange-500 text-white px-3 py-2 rounded-lg font-bold text-sm transition-colors">
                                                +{amt} (${(amt * PRICES.lemon).toFixed(2)})
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                {canBuyOrange && (
                                    <div className="flex items-center justify-between bg-gradient-to-r from-orange-50 to-red-50 p-3 rounded-xl hover:scale-[1.02] transition-transform animate-pulse">
                                        <div className="text-center">
                                            <div className="text-3xl">🍊</div>
                                            <div className="font-bold text-orange-700">{inventory.oranges}</div>
                                        </div>
                                        <div className="flex gap-2">
                                            {[5, 10].map(amt => (
                                                <button key={amt} onClick={() => buyItem('orange', amt)}
                                                    className="bg-gradient-to-r from-orange-400 to-red-400 hover:from-orange-500 hover:to-red-500 text-white px-3 py-2 rounded-lg font-bold text-sm transition-colors">
                                                    +{amt} (${(amt * PRICES.orange).toFixed(2)})
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                <div className="flex items-center justify-between bg-gradient-to-r from-pink-50 to-rose-50 p-3 rounded-xl hover:scale-[1.02] transition-transform">
                                    <div className="text-center">
                                        <div className="text-3xl">🍬</div>
                                        <div className="font-bold text-pink-700">{inventory.sugar}</div>
                                    </div>
                                    <div className="flex gap-2">
                                        {[10, 20].map(amt => (
                                            <button key={amt} onClick={() => buyItem('sugar', amt)}
                                                className="bg-gradient-to-r from-pink-400 to-rose-400 hover:from-pink-500 hover:to-rose-500 text-white px-3 py-2 rounded-lg font-bold text-sm transition-colors">
                                                +{amt} (${(amt * PRICES.sugar).toFixed(2)})
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="flex items-center justify-between bg-gradient-to-r from-blue-50 to-cyan-50 p-3 rounded-xl hover:scale-[1.02] transition-transform">
                                    <div className="text-center">
                                        <div className="text-3xl">🥤</div>
                                        <div className="font-bold text-blue-700">{inventory.cups}</div>
                                    </div>
                                    <div className="flex gap-2">
                                        {[10, 20].map(amt => (
                                            <button key={amt} onClick={() => buyItem('cup', amt)}
                                                className="bg-gradient-to-r from-blue-400 to-cyan-400 hover:from-blue-500 hover:to-cyan-500 text-white px-3 py-2 rounded-lg font-bold text-sm transition-colors">
                                                +{amt} (${(amt * PRICES.cup).toFixed(2)})
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                {canBuyIce && (
                                    <div className="flex items-center justify-between bg-gradient-to-r from-cyan-50 to-teal-50 p-3 rounded-xl hover:scale-[1.02] transition-transform animate-pulse">
                                        <div className="text-center">
                                            <div className="text-3xl">🧊</div>
                                            <div className="font-bold text-cyan-700">{inventory.ice}</div>
                                        </div>
                                        <div className="flex gap-2">
                                            {[10, 20].map(amt => (
                                                <button key={amt} onClick={() => buyItem('ice', amt)}
                                                    className="bg-gradient-to-r from-cyan-400 to-teal-400 hover:from-cyan-500 hover:to-teal-500 text-white px-3 py-2 rounded-lg font-bold text-sm transition-colors">
                                                    +{amt} (${(amt * PRICES.ice).toFixed(2)})
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Receta y Precio */}
                        <div id="recipe-section" className="bg-white p-6 rounded-3xl shadow-lg">
                            <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">📝 Receta y Precio</h3>

                            {canBuyOrange && (
                                <div className="flex gap-2 mb-4">
                                    <button onClick={() => setProduct('lemonade')}
                                        className={`flex-1 py-2 rounded-lg font-bold ${product === 'lemonade' ? 'bg-gradient-to-r from-yellow-400 to-orange-400 text-white' : 'bg-gray-100 hover:bg-gray-200'}`}>
                                        🍋 Limonada
                                    </button>
                                    <button onClick={() => setProduct('orangeade')}
                                        className={`flex-1 py-2 rounded-lg font-bold ${product === 'orangeade' ? 'bg-gradient-to-r from-orange-400 to-red-400 text-white' : 'bg-gray-100 hover:bg-gray-200'}`}>
                                        🍊 Naranjada
                                    </button>
                                </div>
                            )}

                            <div className="space-y-6">
                                {product === 'lemonade' ? (
                                    <div>
                                        <label className="block text-sm font-bold text-gray-600 mb-2">🍋 Limones por vaso: {recipe.lemons}</label>
                                        <input type="range" min="1" max="5" value={recipe.lemons} onChange={(e) => setRecipe(p => ({ ...p, lemons: parseInt(e.target.value) }))} className="w-full accent-yellow-500" />
                                        <div className="flex justify-between text-xs text-gray-400 mt-1">
                                            <span>Poca Calidad</span>
                                            <span>Muy Deliciosa</span>
                                        </div>
                                    </div>
                                ) : (
                                    <div>
                                        <label className="block text-sm font-bold text-gray-600 mb-2">🍊 Naranjas por vaso: {recipe.oranges}</label>
                                        <input type="range" min="1" max="5" value={recipe.oranges} onChange={(e) => setRecipe(p => ({ ...p, oranges: parseInt(e.target.value) }))} className="w-full accent-orange-500" />
                                        <div className="flex justify-between text-xs text-gray-400 mt-1">
                                            <span>Poca Calidad</span>
                                            <span>Muy Deliciosa</span>
                                        </div>
                                    </div>
                                )}

                                <div>
                                    <label className="block text-sm font-bold text-gray-600 mb-2">🍬 Azúcar por vaso: {recipe.sugar}</label>
                                    <input type="range" min="1" max="5" value={recipe.sugar} onChange={(e) => setRecipe(p => ({ ...p, sugar: parseInt(e.target.value) }))} className="w-full accent-pink-500" />
                                    <div className="flex justify-between text-xs text-gray-400 mt-1">
                                        <span>Poco Dulce</span>
                                        <span>Muy Dulce</span>
                                    </div>
                                </div>
                                {canBuyIce && (
                                    <div>
                                        <label className="block text-sm font-bold text-gray-600 mb-2">🧊 Hielo por vaso: {recipe.ice}</label>
                                        <input type="range" min="0" max="3" value={recipe.ice} onChange={(e) => setRecipe(p => ({ ...p, ice: parseInt(e.target.value) }))} className="w-full accent-cyan-500" />
                                        <div className="flex justify-between text-xs text-gray-400 mt-1">
                                            <span>Sin Hielo</span>
                                            <span>Muy Fría</span>
                                        </div>
                                    </div>
                                )}
                                <div className="pt-4 border-t">
                                    <label className="block text-sm font-bold text-gray-600 mb-2">💰 Precio por vaso: ${price.toFixed(2)}</label>
                                    <input type="range" min="0.5" max="4" step="0.1" value={price} onChange={(e) => setPrice(parseFloat(e.target.value))} className="w-full accent-green-500" />
                                    <div className="flex justify-between text-xs text-gray-400 mt-1">
                                        <span>Barato ($0.50)</span>
                                        <span>Caro ($4.00)</span>
                                    </div>
                                    <div className="mt-2 text-sm text-gray-600">
                                        <span className="font-bold">Consejo:</span> Encuentra el precio perfecto para maximizar ganancias.
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Marketing y Puesto */}
                        <div className="bg-white p-6 rounded-3xl shadow-lg">
                            <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">🎪 Tu Puesto y Marketing</h3>

                            {/* Stand Display */}
                            <div className="mb-6">
                                <div className="flex items-center justify-center mb-4">
                                    <RenderStand
                                        type={standType}
                                        bannerType={bannerType}
                                        size="medium"
                                    />
                                </div>
                                <div className="text-center">
                                    <h4 className="font-bold text-lg text-yellow-700">{STAND_TYPES[standType].name}</h4>
                                    <p className="text-sm text-gray-600">{STAND_TYPES[standType].description}</p>
                                    <div className="mt-2 flex justify-center gap-2">
                                        <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs">+{STAND_TYPES[standType].customerBonus}% clientes</span>
                                        <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">x{STAND_TYPES[standType].priceMultiplier} precios</span>
                                    </div>
                                </div>
                            </div>

                            {/* Marketing Actions */}
                            {canUseMarketing && (
                                <>
                                    <h4 className="font-bold text-gray-700 mb-3 flex items-center gap-2">
                                        <IconMegaphone /> Acciones de Marketing
                                    </h4>
                                    <div className="space-y-3 mb-4">
                                        {activeMarketing.map((action, index) => (
                                            <div key={index} className="bg-gradient-to-r from-purple-50 to-pink-50 p-3 rounded-lg flex justify-between items-center">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-2xl">{action.emoji}</span>
                                                    <div>
                                                        <div className="font-bold">{action.name}</div>
                                                        <div className="text-xs text-gray-500">Hasta día {action.activeUntil}</div>
                                                    </div>
                                                </div>
                                                <button onClick={() => removeMarketing(index)} className="text-red-500 hover:text-red-700">
                                                    ✕
                                                </button>
                                            </div>
                                        ))}
                                    </div>

                                    <h5 className="font-bold text-gray-600 mb-2 text-sm">Nuevas Campañas:</h5>
                                    <div className={`grid grid-cols-2 md:grid-cols-4 gap-4 mb-8 ${currentLesson?.highlightId === 'marketing-section' ? 'ring-4 ring-yellow-400 rounded-xl p-2 animate-pulse bg-yellow-50' : ''}`}>
                                        {MARKETING_ACTIONS.map(action => (
                                            <button
                                                key={action.id}
                                                onClick={() => applyMarketing(action)}
                                                disabled={money < action.cost}
                                                className={`p-3 rounded-lg text-center transition-all ${money >= action.cost ? 'bg-gradient-to-r from-blue-50 to-cyan-50 hover:from-blue-100 hover:to-cyan-100 hover:scale-105' : 'bg-gray-100 opacity-50'}`}
                                            >
                                                <div className="text-2xl mb-1">{action.emoji}</div>
                                                <div className="font-bold text-xs mb-1">{action.name}</div>
                                                <div className="text-xs text-gray-500">${action.cost}</div>
                                            </button>
                                        ))}
                                    </div>
                                    <div className="mt-3 text-sm text-gray-600">
                                        <span className="font-bold">Presupuesto Marketing:</span> ${marketingBudget.toFixed(2)}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    <button id="start-day-btn" onClick={startDay}
                        className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white text-2xl font-bold py-4 rounded-2xl shadow-xl transition-transform hover:scale-[1.02] animate-pulse-slow">
                        🚀 ¡Empezar el Día de Venta!
                    </button>
                </div>

                {notification && (
                    <div className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-yellow-500 to-orange-500 text-white px-6 py-3 rounded-full shadow-lg animate-bounce z-50">
                        {notification}
                    </div>
                )}
                <Mascot lesson={currentLesson} onClose={() => setCurrentLesson(null)} />
                {showRules && <RulesModal onClose={() => setShowRules(false)} />}
                {showTutorial && <TutorialOverlay step={tutorialStep} onNext={nextTutorialStep} onSkip={skipTutorial} />}
                <ConfirmationModal
                    isOpen={showQuitConfirm}
                    onClose={() => setShowQuitConfirm(false)}
                    onConfirm={resetGame}
                    title="¿Salir del Juego?"
                    message="Perderás tu progreso actual. ¿Estás seguro?"
                />
            </div>
        );
    }

    if (screen === 'selling') {
        const currentWeather = WEATHER_TYPES.find(w => w.type === weather) || WEATHER_TYPES[0];
        const WeatherIcon = currentWeather.type === 'sunny' ? IconSun : currentWeather.type === 'cloudy' ? IconCloud : IconRain;

        return (
            <div className={`lemonade-game-container min-h-screen p-4 transition-colors duration-1000 ${weather === 'sunny' ? 'bg-gradient-to-b from-yellow-100 to-orange-50' : weather === 'rainy' ? 'bg-gradient-to-b from-blue-200 to-cyan-100' : 'bg-gradient-to-b from-gray-200 to-gray-100'}`}>
                <div className="max-w-4xl mx-auto text-center pt-10">
                    <div className="inline-block bg-white p-4 rounded-full shadow-xl mb-8 animate-pulse">
                        <WeatherIcon size={64} style={{ color: currentWeather.color }} />
                    </div>
                    <h2 className="text-4xl font-bold text-gray-800 mb-2">¡Vendiendo {product === 'lemonade' ? 'Limonada' : 'Naranjada'}!</h2>
                    <p className="text-xl text-gray-600">Clima: {currentWeather.name} {currentWeather.emoji}</p>

                    {/* Active Marketing Effects */}
                    {activeMarketing.length > 0 && (
                        <div className="mt-4 flex flex-wrap justify-center gap-2">
                            {activeMarketing.map((action, index) => (
                                <div key={index} className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-3 py-1 rounded-full text-sm font-bold animate-pulse">
                                    {action.emoji} {action.name}
                                    ```
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Persistent Companion Liruf (Bottom Right) */}
                    <div className="fixed bottom-4 right-4 z-40 w-56 h-56 md:w-72 md:h-72 pointer-events-none">
                        <div className="relative w-full h-full pointer-events-auto transition-all duration-500 hover:scale-110 filter drop-shadow-2xl">
                            <DinoCharacter
                                currentText={notification || lirufAdvice}
                                showBubble={!!notification || !!lirufAdvice}
                                mood={lirufMood}
                            />
                        </div>
                    </div>

                    {/* Customer Walking Area */}
                    <div className="mt-8 h-48 relative overflow-hidden bg-gradient-to-r from-white/70 to-white/50 rounded-3xl border-b-4 border-gray-300">
                        {customers.map(c => (
                            <div key={c.id} className="absolute bottom-8 text-6xl transition-all duration-[2000ms] ease-linear"
                                style={{
                                    left: '50%',
                                    transform: 'translateX(-50%)',
                                    animation: 'walkBy 2s linear forwards'
                                }}>
                                {Math.random() > 0.5 ? '🚶‍♀️' : '🚶‍♂️'}
                            </div>
                        ))}
                    </div>
                    <style>{`
            @keyframes walkBy {
              0% { transform: translateX(-400px) scaleX(-1); opacity: 0; }
              10% { opacity: 1; }
              45% { transform: translateX(-60px) scaleX(-1); }
              55% { transform: translateX(60px) scaleX(-1); }
              90% { opacity: 1; }
              100% { transform: translateX(400px) scaleX(-1); opacity: 0; }
            }
          `}</style>

                    {/* Stats */}
                    <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-md mx-auto">
                        <div className="bg-white/80 p-4 rounded-xl shadow backdrop-blur-sm">
                            <div className="text-gray-500 text-sm">Dinero</div>
                            <div className="font-bold text-green-600">${money.toFixed(2)}</div>
                        </div>
                        <div className="bg-white/80 p-4 rounded-xl shadow backdrop-blur-sm">
                            <div className="text-gray-500 text-sm">Vasos</div>
                            <div className="font-bold text-blue-600">{inventory.cups}</div>
                        </div>
                        <div className="bg-white/80 p-4 rounded-xl shadow backdrop-blur-sm">
                            <div className="text-gray-500 text-sm">{product === 'lemonade' ? 'Limones' : 'Naranjas'}</div>
                            <div className="font-bold text-yellow-600">{product === 'lemonade' ? inventory.lemons : inventory.oranges}</div>
                        </div>
                        <div className="bg-white/80 p-4 rounded-xl shadow backdrop-blur-sm">
                            <div className="text-gray-500 text-sm">Clientes Hoy</div>
                            <div className="font-bold text-purple-600 animate-pulse">{customers.length}</div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (screen === 'results') {
        const profit = dailyStats.revenue - dailyStats.cost;
        const isLevelComplete = money >= currentLevelData.goal;

        // Refined Lose Condition
        const minCost = Math.min(PRICES.lemon, PRICES.sugar, PRICES.cup);
        const canMakeProduct = (inventory.lemons > 0 || inventory.oranges > 0) && inventory.sugar > 0 && inventory.cups > 0;
        const isLose = money < minCost && !canMakeProduct;

        // Kahoot Style Win for Level 5
        if (isLevelComplete && currentLevel === 5) {
            return (
                <div className="lemonade-game-container min-h-screen kahoot-bg flex items-center justify-center p-4 text-white overflow-hidden relative">
                    <div className="text-center z-10 max-w-2xl">
                        <h1 className="text-5xl md:text-6xl font-bold mb-8 animate-bounce">🏆 ¡GANADOR SUPREMO! 🏆</h1>
                        <div className="text-8xl mb-8 animate-bounce-custom">👑</div>
                        <p className="text-2xl md:text-3xl font-bold mb-8">¡Completaste todos los niveles!</p>
                        <p className="text-xl mb-4">Eres un verdadero magnate de los negocios.</p>
                        <p className="text-lg mb-12">Has aprendido sobre emprendimiento, precios y marketing.</p>

                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-12">
                            <div className="bg-white/20 p-4 rounded-xl backdrop-blur-sm">
                                <div className="text-3xl">💰</div>
                                <div className="font-bold">Ganancia Total</div>
                                <div className="text-2xl">${(money - 20).toFixed(2)}</div>
                            </div>
                            <div className="bg-white/20 p-4 rounded-xl backdrop-blur-sm">
                                <div className="text-3xl">📈</div>
                                <div className="font-bold">Marketing</div>
                                <div className="text-2xl">${marketingBudget.toFixed(2)}</div>
                            </div>
                            <div className="bg-white/20 p-4 rounded-xl backdrop-blur-sm">
                                <div className="text-3xl">⭐</div>
                                <div className="font-bold">Nivel Máximo</div>
                                <div className="text-2xl">5</div>
                            </div>
                        </div>

                        <button onClick={resetGame} className="bg-white text-purple-800 text-2xl font-bold py-4 px-12 rounded-full shadow-2xl hover:scale-110 transition-transform">
                            Jugar Otra Vez
                        </button>
                    </div>

                    {/* Confetti */}
                    {[...Array(30)].map((_, i) => (
                        <div key={i} className="absolute text-4xl animate-float"
                            style={{
                                left: `${Math.random() * 100}%`,
                                top: `${Math.random() * 100}%`,
                                animationDuration: `${2 + Math.random() * 3}s`,
                                opacity: 0.5 + Math.random() * 0.5
                            }}>
                            {['🎉', '🎊', '⭐', '✨', '🏆'][Math.floor(Math.random() * 5)]}
                        </div>
                    ))}
                </div>
            );
        }

        return (
            <div className="lemonade-game-container min-h-screen bg-gradient-to-b from-purple-100 to-pink-100 flex items-center justify-center p-4">
                <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-lg w-full text-center relative">
                    {!(isLevelComplete || isLose) && (
                        <button onClick={() => setShowQuitConfirm(true)} className="absolute top-4 left-4 p-2 bg-red-100 text-red-600 rounded-full hover:bg-red-200" title="Abandonar Partida">
                            <IconLogOut />
                        </button>
                    )}

                    <h2 className="text-3xl font-bold text-gray-800 mb-6">Resultados del Día {day}</h2>

                    {/* Daily Results */}
                    <div className="grid grid-cols-2 gap-4 mb-8">
                        <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-4 rounded-xl">
                            <div className="text-sm text-green-800">Ingresos</div>
                            <div className="text-2xl font-bold text-green-600">+${dailyStats.revenue.toFixed(2)}</div>
                        </div>
                        <div className="bg-gradient-to-r from-red-50 to-pink-50 p-4 rounded-xl">
                            <div className="text-sm text-red-800">Costos</div>
                            <div className="text-2xl font-bold text-red-600">-${dailyStats.cost.toFixed(2)}</div>
                        </div>
                    </div>

                    {/* Profit/Loss */}
                    <div className={`p-4 rounded-xl mb-8 ${profit >= 0 ? 'bg-gradient-to-r from-green-100 to-emerald-100 text-green-800' : 'bg-gradient-to-r from-red-100 to-pink-100 text-red-800'}`}>
                        <div className="text-sm font-bold uppercase tracking-wide">Beneficio Neto</div>
                        <div className="text-4xl font-bold">{profit >= 0 ? '+' : ''}{profit.toFixed(2)}</div>
                        <div className="text-sm mt-1">{profit >= 0 ? '¡Excelente trabajo!' : '¡Sigue intentando!'}</div>
                    </div>

                    {/* Level Progress */}
                    <div className="mb-8">
                        <div className="text-sm text-gray-500 mb-1">Progreso del Nivel {currentLevel}</div>
                        <div className="w-full bg-gray-200 rounded-full h-6 overflow-hidden">
                            <div className="bg-gradient-to-r from-yellow-400 to-orange-500 h-full transition-all duration-1000"
                                style={{ width: `${Math.min(100, (money / currentLevelData.goal) * 100)}%` }}></div>
                        </div>
                        <div className="flex justify-between text-sm mt-1 font-bold text-gray-600">
                            <span>${money.toFixed(2)}</span>
                            <span>Meta: ${currentLevelData.goal}</span>
                        </div>
                    </div>

                    {/* Next Actions */}
                    {isLevelComplete ? (
                        <div className="mb-8 animate-bounce">
                            <div className="flex justify-center gap-2 mb-2">
                                <IconStar size={48} className="text-yellow-400 fill-current" />
                                <IconStar size={48} className="text-yellow-400 fill-current" />
                                <IconStar size={48} className="text-yellow-400 fill-current" />
                            </div>
                            <h3 className="text-2xl font-bold text-yellow-600">¡NIVEL COMPLETADO!</h3>
                            <p className="mb-4">Has superado la meta de ${currentLevelData.goal}.</p>

                            {/* Unlock Preview */}
                            {currentLevel < 5 && (
                                <div className="bg-gradient-to-r from-blue-50 to-cyan-50 p-3 rounded-lg mb-4">
                                    <h4 className="font-bold text-blue-700">¡Próximo Nivel!</h4>
                                    <p className="text-sm">Desbloquearás: {STAND_TYPES[LEVELS[currentLevel].standType].name}</p>
                                </div>
                            )}

                            <button onClick={nextLevel} className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white text-xl font-bold py-4 rounded-xl shadow-lg transition-transform hover:scale-105">
                                Siguiente Nivel ➡️
                            </button>
                        </div>
                    ) : isLose ? (
                        <div className="mb-8">
                            <div className="text-6xl mb-2">💸</div>
                            <h3 className="text-2xl font-bold text-red-600">¡BANCARROTA!</h3>
                            <p className="mb-4">No tienes dinero ni ingredientes para seguir.</p>
                            <button onClick={resetGame} className="w-full bg-gradient-to-r from-gray-200 to-gray-300 hover:from-gray-300 hover:to-gray-400 text-gray-800 font-bold py-3 rounded-xl flex items-center justify-center gap-2">
                                <IconRefresh size={20} /> Reiniciar Nivel
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <button onClick={nextDay} className="w-full bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white text-xl font-bold py-4 rounded-xl shadow-lg transition-transform hover:scale-105">
                                Siguiente Día ➡️
                            </button>
                            <div className="text-sm text-gray-500">
                                Recuerda: ¡Puedes ajustar precios y marketing para ganar más!
                            </div>
                        </div>
                    )}
                    {/* Persistent Companion Liruf (Bottom Right) */}
                    <div className="fixed bottom-0 right-4 z-30 w-48 h-48 md:w-64 md:h-64 pointer-events-none">
                        <div className="relative w-full h-full pointer-events-auto transition-all duration-500 hover:scale-110">
                            <DinoCharacter
                                currentText={notification || lirufAdvice}
                                showBubble={!!(notification || lirufAdvice)}
                                mood={lirufMood}
                                className="drop-shadow-2xl"
                            />
                        </div>
                    </div>
                </div>
                <Mascot lesson={currentLesson} onClose={() => setCurrentLesson(null)} />
                <ConfirmationModal
                    isOpen={showQuitConfirm}
                    onClose={() => setShowQuitConfirm(false)}
                    onConfirm={resetGame}
                    title="¿Abandonar Partida?"
                    message="Si sales ahora, perderás todo tu progreso. ¿Estás seguro?"
                />
            </div>
        );
    }

    return <div>Loading...</div>;
};
