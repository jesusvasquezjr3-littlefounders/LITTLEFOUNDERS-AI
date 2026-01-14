import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, ChevronRight } from 'lucide-react';
import { AdventureCard } from './AdventureCard';

// Datos estáticos de aventuras (mock para frontend, luego vendrá del backend)
const ADVENTURES = [
    {
        id: 1,
        title: "El Archipiélago del Trueque",
        ageRange: "5-7 años",
        description: "Sensorial, valores básicos y aritmética simple",
        theme: "archipelago",
        status: "available" as const,
        progress: 35,
        totalLessons: 50,
        completedLessons: 18,
    },
    {
        id: 2,
        title: "El Bosque de la Abundancia",
        ageRange: "8-9 años",
        description: "Planificación, matemáticas financieras y consumo inteligente",
        theme: "forest",
        status: "locked" as const,
        progress: 0,
        totalLessons: 40,
        completedLessons: 0,
    },
    {
        id: 3,
        title: "La Ciudad Digital",
        ageRange: "10-12 años",
        description: "Banca, mundo digital, seguridad y economía",
        theme: "city",
        status: "locked" as const,
        progress: 0,
        totalLessons: 29,
        completedLessons: 0,
    },
    {
        id: 4,
        title: "El Valle de los Inventores",
        ageRange: "13-14 años",
        description: "Emprendimiento, marketing y finanzas intermedias",
        theme: "valley",
        status: "locked" as const,
        progress: 0,
        totalLessons: 40,
        completedLessons: 0,
    },
    {
        id: 5,
        title: "El Reino de los Titanes",
        ageRange: "15-17 años",
        description: "Vida adulta, impuestos, crédito y libertad financiera",
        theme: "kingdom",
        status: "locked" as const,
        progress: 0,
        totalLessons: 65,
        completedLessons: 0,
    },
    {
        id: 6,
        title: "Proyecto Omega",
        ageRange: "Graduación",
        description: "El Cosmos: La Tesis del Fundador y Retos Finales",
        theme: "cosmos" as any, // Cast to any to avoid strict type issues if not imported, or just string. Ideally strictly typed.
        status: "locked" as const,
        progress: 0,
        totalLessons: 8,
        completedLessons: 0,
    },
];

interface AdventuresProps {
    onSelectAdventure?: (adventureId: number) => void;
}

export const Adventures: React.FC<AdventuresProps> = ({ onSelectAdventure }) => {
    const navigate = useNavigate();
    const [selectedAdventure, setSelectedAdventure] = useState<number | null>(null);

    const handleAdventureClick = (adventure: typeof ADVENTURES[0]) => {
        if (adventure.status === 'locked') return;

        setSelectedAdventure(adventure.id);
        if (onSelectAdventure) {
            onSelectAdventure(adventure.id);
        }
    };

    return (
        <div className="adventures-container w-full max-w-6xl mx-auto px-4 py-8">
            {/* Header */}
            <div className="text-center mb-10">
                <h1 className="text-4xl font-black text-gray-900 dark:text-white mb-2 tracking-tight">
                    AVENTURAS
                </h1>
                <p className="text-gray-600 dark:text-gray-400 text-lg">
                    Elige tu mundo y comienza a aprender sobre finanzas
                </p>
            </div>

            {/* Lista de Aventuras */}
            <div className="flex flex-col gap-12">
                {ADVENTURES.map((adventure) => (
                    <div
                        key={adventure.id}
                        className={`adventure-wrapper relative transition-all duration-300 ${adventure.status === 'locked'
                            ? 'opacity-70 grayscale cursor-not-allowed'
                            : 'cursor-pointer hover:scale-[1.02]'
                            }`}
                        onClick={() => handleAdventureClick(adventure)}
                    >
                        <AdventureCard
                            title={adventure.title}
                            theme={adventure.theme as any}
                            status={adventure.status}
                            progress={adventure.progress}
                            ageRange={adventure.ageRange}
                        />

                        {/* Overlay para bloqueados */}
                        {adventure.status === 'locked' && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-[32px] backdrop-blur-sm z-[60]">
                                <div className="flex flex-col items-center text-white">
                                    <Lock size={48} className="mb-2" />
                                    <span className="font-bold text-lg">Bloqueado</span>
                                    <span className="text-sm opacity-80">Completa la aventura anterior</span>
                                </div>
                            </div>
                        )}

                        {/* Botón de continuar para disponibles */}
                        {adventure.status === 'available' && (
                            <div className="absolute bottom-6 right-6 z-50">
                                <button className="flex items-center gap-2 px-6 py-3 bg-white/90 dark:bg-gray-900/90 rounded-full font-bold text-gray-900 dark:text-white shadow-lg hover:bg-white dark:hover:bg-gray-800 transition-all">
                                    Continuar
                                    <ChevronRight size={20} />
                                </button>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Estilos CSS embebidos */}
            <style>{`
        .adventures-container {
          font-family: 'Nunito', -apple-system, BlinkMacSystemFont, sans-serif;
        }
        
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
        
        @keyframes float-h {
          0%, 100% { transform: translateX(0); }
          50% { transform: translateX(10px); }
        }
        
        @keyframes wave {
          0%, 100% { transform: scaleY(1); }
          50% { transform: scaleY(1.05); }
        }
      `}</style>
        </div>
    );
};

export default Adventures;
