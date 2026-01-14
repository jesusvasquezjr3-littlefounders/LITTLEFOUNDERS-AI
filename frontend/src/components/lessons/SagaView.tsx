import React from 'react';
import { ArrowLeft, BookOpen, Lock } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { TopicNode, Topic } from './TopicNode';
import { AdventureCard } from './AdventureCard';

// ============== FULL CONTENT DATA (Adventure 1) ==============

interface SagaData {
    id: number;
    title: string;
    subtitle: string;
    theme: 'amber' | 'blue' | 'emerald' | 'rose' | 'purple';
    description: string;
    topics: Topic[];
}

const ADVENTURE_1_FULL: SagaData[] = [
    {
        id: 1,
        title: "Saga 1: Detectives del Tesoro",
        subtitle: "Reconocimiento Financiero",
        theme: "amber",
        description: "Aprende a identificar el dinero y sus formas básicas.",
        topics: [
            { id: 1, title: "Lecciones Introductorias", description: "Demo Lecciones", isCompleted: true, isLocked: false, type: 'lesson' },
            { id: 2, title: "Formas y colores", description: "Círculos brillantes vs Rectángulos", isCompleted: true, isLocked: false, type: 'lesson' },
            { id: 3, title: "El sonido del dinero", description: "El clinc de las monedas", isCompleted: true, isLocked: false, type: 'lesson' },
            { id: 4, title: "Toque y siente", description: "Texturas y relieves", isCompleted: false, isLocked: false, type: 'lesson' },
            { id: 5, title: "Números en el dinero", description: "Identificar el 1, 2, 5, 10", isCompleted: false, isLocked: true, type: 'lesson' },
            { id: 6, title: "Grande no es más valioso", description: "Valor vs Tamaño", isCompleted: false, isLocked: true, type: 'lesson' },
            { id: 7, title: "Caras famosas", description: "¿Quiénes son?", isCompleted: false, isLocked: true, type: 'lesson' },
            { id: 8, title: "El símbolo mágico", description: "Qué significa el signo $", isCompleted: false, isLocked: true, type: 'lesson' },
            { id: 9, title: "Dinero de juguete vs. Real", description: "Cómo notar la diferencia", isCompleted: false, isLocked: true, type: 'lesson' },
            { id: 10, title: "Cuidando el tesoro", description: "No rayar, no romper", isCompleted: false, isLocked: true, type: 'lesson' },
            { id: 11, title: "La casa del dinero", description: "La alcancía y la billetera", isCompleted: false, isLocked: true, type: 'milestone' },
        ]
    },
    {
        id: 2,
        title: "Saga 2: El Origen de las Cosas",
        subtitle: "Valor y Trabajo",
        theme: "blue",
        description: "Entiende de dónde vienen las cosas y el valor del trabajo.",
        topics: [
            { id: 12, title: "Todo tiene un dueño", description: "Respetar lo ajeno", isCompleted: false, isLocked: true, type: 'lesson' },
            { id: 13, title: "Antes de la tienda", description: "El granjero, el constructor", isCompleted: false, isLocked: true, type: 'lesson' },
            { id: 14, title: "¿De dónde viene la leche?", description: "Cadena de valor simple", isCompleted: false, isLocked: true, type: 'lesson' },
            { id: 15, title: "El dinero no es mágico", description: "No aparece en los bolsillos", isCompleted: false, isLocked: true, type: 'lesson' },
            { id: 16, title: "Trabajo visible", description: "El cajero, el policía", isCompleted: false, isLocked: true, type: 'lesson' },
            { id: 17, title: "Trabajo invisible", description: "El programador, el contador", isCompleted: false, isLocked: true, type: 'lesson' },
            { id: 18, title: "El esfuerzo cansa", description: "Valorar el descanso", isCompleted: false, isLocked: true, type: 'lesson' },
            { id: 19, title: "Tareas de equipo", description: "Ayudar en casa", isCompleted: false, isLocked: true, type: 'lesson' },
            { id: 20, title: "Ganar vs. Encontrar", description: "Sueldo vs Suerte", isCompleted: false, isLocked: true, type: 'lesson' },
            { id: 21, title: "El regalo", description: "Ingreso extraordinario", isCompleted: false, isLocked: true, type: 'milestone' },
        ]
    },
    {
        id: 3,
        title: "Saga 3: El Mercado de la Selva",
        subtitle: "Intercambio Básico",
        theme: "emerald",
        description: "Descubre cómo funciona el intercambio y la compra.",
        topics: [
            { id: 22, title: "El cuento del Trueque", description: "Cambiar canicas por estampas", isCompleted: false, isLocked: true, type: 'lesson' },
            { id: 23, title: "Cuando el trueque falla", description: "\"No quiero tus canicas\"", isCompleted: false, isLocked: true, type: 'lesson' },
            { id: 24, title: "La moneda facilita todo", description: "Solución al trueque", isCompleted: false, isLocked: true, type: 'lesson' },
            { id: 25, title: "Comprar es elegir", description: "Tomar una cosa y dejar otra", isCompleted: false, isLocked: true, type: 'lesson' },
            { id: 26, title: "La etiqueta de precio", description: "Cuánto dar", isCompleted: false, isLocked: true, type: 'lesson' },
            { id: 27, title: "Pagar en caja", description: "Hacer fila y turno", isCompleted: false, isLocked: true, type: 'lesson' },
            { id: 28, title: "Entregar el dinero", description: "Despedirse de las monedas", isCompleted: false, isLocked: true, type: 'lesson' },
            { id: 29, title: "El ticket", description: "Prueba de compra", isCompleted: false, isLocked: true, type: 'lesson' },
            { id: 30, title: "El cambio (vuelto)", description: "Si doy de más", isCompleted: false, isLocked: true, type: 'lesson' },
            { id: 31, title: "Revisar el cambio", description: "Contar antes de guardar", isCompleted: false, isLocked: true, type: 'milestone' },
        ]
    },
    {
        id: 4,
        title: "Saga 4: La Balanza de los Deseos",
        subtitle: "Necesidad vs. Deseo",
        theme: "rose",
        description: "Aprende a diferenciar lo que necesitas de lo que quieres.",
        topics: [
            { id: 32, title: "El rugido de la panza", description: "Hambre es Necesidad", isCompleted: false, isLocked: true, type: 'lesson' },
            { id: 33, title: "El antojo dulce", description: "Chocolate es Deseo", isCompleted: false, isLocked: true, type: 'lesson' },
            { id: 34, title: "Tener sed", description: "Agua es Necesidad", isCompleted: false, isLocked: true, type: 'lesson' },
            { id: 35, title: "Bebidas de colores", description: "Refresco es Deseo", isCompleted: false, isLocked: true, type: 'lesson' },
            { id: 36, title: "Protección", description: "Zapatos (Necesidad)", isCompleted: false, isLocked: true, type: 'lesson' },
            { id: 37, title: "Moda", description: "Zapatos de luces (Deseo)", isCompleted: false, isLocked: true, type: 'lesson' },
            { id: 38, title: "Techo y cama", description: "Dónde dormir", isCompleted: false, isLocked: true, type: 'lesson' },
            { id: 39, title: "Juguetes y pantallas", description: "Diversión (Deseo)", isCompleted: false, isLocked: true, type: 'lesson' },
            { id: 40, title: "Medicina", description: "Curarse es Necesidad", isCompleted: false, isLocked: true, type: 'lesson' },
            { id: 41, title: "Prioridades", description: "Primero lo necesario", isCompleted: false, isLocked: true, type: 'lesson' },
            { id: 42, title: "¡Se acabó!", description: "Cuando el dinero termina", isCompleted: false, isLocked: true, type: 'lesson' },
            { id: 43, title: "La rabieta no paga", description: "Llorar no sirve", isCompleted: false, isLocked: true, type: 'milestone' },
        ]
    },
    {
        id: 5,
        title: "Saga 5: El Cofre del Futuro",
        subtitle: "Ahorro Inicial",
        theme: "purple",
        description: "Iníciate en el hábito del ahorro.",
        topics: [
            { id: 44, title: "¿Qué es ahorrar?", description: "Guardar hoy para mañana", isCompleted: false, isLocked: true, type: 'lesson' },
            { id: 45, title: "La alcancía transparente", description: "Ver subir el nivel", isCompleted: false, isLocked: true, type: 'lesson' },
            { id: 46, title: "El objetivo", description: "Dibujar lo que quiero", isCompleted: false, isLocked: true, type: 'lesson' },
            { id: 47, title: "Paciencia", description: "Esperar vale la pena", isCompleted: false, isLocked: true, type: 'lesson' },
            { id: 48, title: "La tentación", description: "No gastarlo en dulces", isCompleted: false, isLocked: true, type: 'lesson' },
            { id: 49, title: "El guardián", description: "Pedir ayuda para guardar", isCompleted: false, isLocked: true, type: 'lesson' },
            { id: 50, title: "Sumando monedas", description: "1+1 = 2", isCompleted: false, isLocked: true, type: 'lesson' },
            { id: 51, title: "¡Lo logré!", description: "Romper el cochinito", isCompleted: false, isLocked: true, type: 'milestone' },
        ]
    }
];

const ADVENTURE_6_FULL: SagaData[] = [
    {
        id: 60,
        title: "Proyecto Omega",
        subtitle: "La Tesis del Fundador",
        theme: "purple", // Use purple for space theme
        description: "Retos prácticos obligatorios para la graduación final.",
        topics: [
            { id: 247, title: "Auditoría de Vida", description: "Tracking de gastos de 90 días", isCompleted: false, isLocked: true, type: 'milestone' },
            { id: 248, title: "Simulador de Bolsa", description: "Gestionar portafolio por 6 meses", isCompleted: false, isLocked: true, type: 'milestone' },
            { id: 249, title: "Plan de Negocio", description: "Canvas + Proyecciones financieras", isCompleted: false, isLocked: true, type: 'milestone' },
            { id: 250, title: "Presupuesto", description: "Costos de vida reales", isCompleted: false, isLocked: true, type: 'milestone' },
            { id: 251, title: "Declaración Simulada", description: "Cálculo de impuestos", isCompleted: false, isLocked: true, type: 'milestone' },
            { id: 252, title: "Pitch de Inversión", description: "Video vendiendo mi proyecto", isCompleted: false, isLocked: true, type: 'milestone' },
            { id: 253, title: "Ensayo de Libertad", description: "Definir 'Riqueza'", isCompleted: false, isLocked: true, type: 'milestone' },
            { id: 254, title: "Examen Final", description: "100 preguntas de todos los niveles", isCompleted: false, isLocked: true, type: 'milestone' },
        ]
    }
];

// ============== COMPONENTS ==============

const SagaHeader: React.FC<{ saga: SagaData }> = ({ saga }) => {
    const getThemeColor = (theme: string) => {
        switch (theme) {
            case 'amber': return 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800';
            case 'blue': return 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800';
            case 'emerald': return 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800';
            case 'rose': return 'bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-900/30 dark:text-rose-300 dark:border-rose-800';
            default: return 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800';
        }
    };

    return (
        <div className={`p-6 mb-8 rounded-3xl border-2 ${getThemeColor(saga.theme)} flex items-center justify-between`}>
            <div>
                <h2 className="text-xl font-black uppercase tracking-wider opacity-80 mb-1">{saga.title}</h2>
                <p className="font-medium opacity-90">{saga.description}</p>
            </div>
            <div className="hidden sm:block p-3 bg-white/50 dark:bg-black/20 rounded-2xl">
                <BookOpen size={32} />
            </div>
        </div>
    );
};

interface SagaMapProps {
    saga: SagaData;
    startTopicIndex: number;
}

const SagaMap: React.FC<SagaMapProps> = ({ saga }) => {
    const topics = saga.topics;
    const ROW_HEIGHT = 100;
    const TOPIC_WIDTH = 120; // Used for spacing calculations
    const CONTAINER_WIDTH = 400; // Estimated center column width

    // Calculate Node Positions
    // Pattern: Center (0), Left (-1), Center (0), Right (1)... simplified
    // Better pattern: gentle curve snake
    const getPosition = (index: number) => {
        const y = index * ROW_HEIGHT + ROW_HEIGHT / 2;
        // Snake pattern: sin wave
        // index 0 -> x=0 (center)
        // index 1 -> x=-80
        // index 2 -> x=0
        // index 3 -> x=80
        // index 4 -> x=0
        const amplitude = 90;
        const x = Math.sin(index * 1.5) * amplitude; // Simple ripple
        // Alternatively: Hardcoded snake: right, right, down, left, left, down?
        // Let's stick to sine wave for "Path" feel
        return { x: x + 200, y }; // +200 to center in 400px container
    };

    const pathD = topics.map((_, i) => {
        if (i === topics.length - 1) return '';
        const start = getPosition(i);
        const end = getPosition(i + 1);

        // Curved SVG path between nodes
        return `M ${start.x} ${start.y} C ${start.x} ${start.y + 50}, ${end.x} ${end.y - 50}, ${end.x} ${end.y}`;
    }).join(' ');

    return (
        <div className="relative w-full max-w-[400px] mx-auto mb-16 px-4">
            {/* Connector Line */}
            <svg className="absolute top-0 left-0 w-full h-full pointer-events-none z-0 overflow-visible">
                <path
                    d={pathD}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="10"
                    strokeLinecap="round"
                    className="text-slate-200 dark:text-slate-700"
                />
            </svg>

            {/* Topics */}
            <div className="relative z-10" style={{ height: topics.length * ROW_HEIGHT }}>
                {topics.map((topic, i) => {
                    const pos = getPosition(i);
                    return (
                        <TopicNode
                            key={topic.id}
                            topic={topic}
                            index={i}
                            totalInSaga={topics.length}
                            x={pos.x}
                            y={pos.y}
                            colorTheme={saga.theme}
                        />
                    );
                })}
            </div>
        </div>
    );
};

// ============== NEXT ADVENTURE DATA ==============

interface NextAdventureData {
    id: number;
    title: string;
    theme: 'archipelago' | 'forest' | 'city' | 'valley' | 'kingdom' | 'cosmos';
    description: string;
}

const NEXT_ADVENTURES: Record<number, NextAdventureData | null> = {
    1: { id: 2, title: "El Bosque de la Abundancia", theme: "forest", description: "Planificación, matemáticas financieras y consumo inteligente" },
    2: { id: 3, title: "La Ciudad Digital", theme: "city", description: "Banca, mundo digital, seguridad y economía" },
    3: { id: 4, title: "El Valle de los Inventores", theme: "valley", description: "Emprendimiento, marketing y finanzas intermedias" },
    4: { id: 5, title: "El Reino de los Titanes", theme: "kingdom", description: "Vida adulta, impuestos, crédito y libertad financiera" },
    5: { id: 6, title: "Proyecto Omega: El Cosmos", theme: "cosmos", description: "La Tesis del Fundador y Retos Finales" },
    6: null, // Final adventure, no next
};

interface NextAdventurePreviewProps {
    currentAdventureId: number;
    isCurrentCompleted?: boolean; // Would come from actual progress tracking
}

const NextAdventurePreview: React.FC<NextAdventurePreviewProps> = ({
    currentAdventureId,
    isCurrentCompleted = false // Default to locked for now
}) => {
    const nextAdventure = NEXT_ADVENTURES[currentAdventureId];

    // If no next adventure (final adventure completed)
    if (!nextAdventure) {
        return (
            <div className="text-center py-12">
                <div className="inline-block p-6 rounded-full bg-gradient-to-br from-amber-100 to-amber-200 dark:from-amber-900 dark:to-amber-800 mb-4 text-5xl shadow-lg">
                    🏆
                </div>
                <p className="font-bold text-2xl text-slate-800 dark:text-white mb-2">¡Felicidades, Gran Fundador!</p>
                <p className="text-slate-500 dark:text-slate-400">Has completado todas las aventuras</p>
            </div>
        );
    }

    return (
        <div className="mt-8 mb-4">
            {/* Section Header */}
            <div className="text-center mb-6">
                <p className="text-sm font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">
                    Próxima Aventura
                </p>
                <div className="flex items-center justify-center gap-2 text-slate-500 dark:text-slate-400">
                    <div className="h-px w-12 bg-slate-300 dark:bg-slate-600"></div>
                    <Lock size={16} />
                    <div className="h-px w-12 bg-slate-300 dark:bg-slate-600"></div>
                </div>
            </div>

            {/* Next Adventure Card - Locked State */}
            <div className="relative transform scale-90 opacity-80 hover:opacity-95 transition-all duration-300">
                <AdventureCard
                    title={nextAdventure.title}
                    theme={nextAdventure.theme}
                    status={isCurrentCompleted ? "available" : "locked"}
                    progress={0}
                />

                {/* Lock Overlay */}
                {!isCurrentCompleted && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-[32px] backdrop-blur-sm z-[60]">
                        <div className="flex flex-col items-center text-white text-center px-4">
                            <Lock size={48} className="mb-3" />
                            <span className="font-bold text-xl mb-1">Bloqueado</span>
                            <span className="text-sm opacity-90">Completa esta aventura para desbloquear</span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

// ============== MAIN EXPORT ==============

interface SagaViewProps {
    adventureId?: number;
    onBack?: () => void;
}

export const SagaView: React.FC<SagaViewProps> = ({ adventureId = 1, onBack }) => {
    return (
        <div className="w-full h-full relative">

            {/* Simple Header Title - Static like "AVENTURAS" */}
            <div className="max-w-xl mx-auto px-4 py-8">
                <div className="flex items-center gap-4 mb-6">
                    <Button variant="ghost" size="icon" onClick={onBack} className="text-slate-500 hover:text-slate-900 dark:text-slate-400">
                        <ArrowLeft size={24} />
                    </Button>
                    <h1 className="text-2xl font-bold text-slate-800 dark:text-white tracking-wide uppercase">
                        {adventureId === 6 ? "Proyecto Omega" : "El Archipiélago del Trueque"}
                    </h1>
                </div>
                {(adventureId === 6 ? ADVENTURE_6_FULL : ADVENTURE_1_FULL).map((saga) => (
                    <div key={saga.id} className="mb-8">
                        <SagaHeader saga={saga} />
                        <SagaMap saga={saga} startTopicIndex={0} />
                    </div>
                ))}

                {/* Next Adventure Preview */}
                <NextAdventurePreview currentAdventureId={adventureId} />

            </div>
        </div>
    );
};

export default SagaView;
