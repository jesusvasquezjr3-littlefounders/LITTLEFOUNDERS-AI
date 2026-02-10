import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, ChevronRight } from 'lucide-react';
import { AdventureCard } from './AdventureCard';
import { useAdventuresAPI, Adventure } from './hooks/useAdventures';
import { useTranslation } from 'react-i18next';
import { LessonsLoadingScreen } from '../ui/LoadingScreen';

interface AdventuresProps {
    onSelectAdventure?: (adventureId: number) => void;
    userId?: number;
}

export const Adventures: React.FC<AdventuresProps> = ({ onSelectAdventure, userId }) => {
    const navigate = useNavigate();
    const [selectedAdventure, setSelectedAdventure] = useState<number | null>(null);
    const { adventures, isLoading } = useAdventuresAPI(userId);
    const { t } = useTranslation('adventures');

    const handleAdventureClick = (adventure: Adventure) => {
        if (adventure.status === 'locked') return;

        setSelectedAdventure(adventure.id);
        if (onSelectAdventure) {
            onSelectAdventure(adventure.id);
        }
    };

    if (isLoading) {
        return <LessonsLoadingScreen />;
    }

    return (
        <div className="adventures-container w-full max-w-6xl mx-auto px-4 py-8">
            {/* Header */}
            <div className="text-center mb-10">
                <h1 className="text-4xl font-black text-gray-900 dark:text-white mb-2 tracking-tight">
                    {t('general.title')}
                </h1>
                <p className="text-gray-600 dark:text-gray-400 text-lg">
                    {t('general.subtitle')}
                </p>
            </div>

            {/* Lista de Aventuras */}
            <div className="flex flex-col gap-12">
                {adventures.map((adventure) => (
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
                            theme={adventure.theme}
                            status={adventure.status}
                            progress={adventure.progress}
                            ageRange={adventure.ageRange}
                        />

                        {/* Overlay para bloqueados */}
                        {adventure.status === 'locked' && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-[32px] backdrop-blur-sm z-[60]">
                                <div className="flex flex-col items-center text-white">
                                    <Lock size={48} className="mb-2" />
                                    <span className="font-bold text-lg">{t('general.locked')}</span>
                                    <span className="text-sm opacity-80">{t('general.locked_desc')}</span>
                                </div>
                            </div>
                        )}

                        {/* Botón de continuar para disponibles */}
                        {adventure.status === 'available' && (
                            <div className="absolute bottom-6 right-6 z-50">
                                <button className="flex items-center gap-2 px-6 py-3 bg-white/90 dark:bg-gray-900/90 rounded-full font-bold text-gray-900 dark:text-white shadow-lg hover:bg-white dark:hover:bg-gray-800 transition-all">
                                    {t('general.continue')}
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
