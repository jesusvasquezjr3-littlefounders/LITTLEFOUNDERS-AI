import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAdminCharacters } from '@/hooks/useAdminCharacters';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Play, Sparkles } from 'lucide-react';
import { normalizeGesture } from '@/utils/gestureMapper';

// Character Components
import { DinoCharacter } from '@/components/characters/DinoCharacter';
import { DinaCharacter } from '@/components/characters/DinaCharacter';
import DrRhoCharacter from '@/components/characters/DrRhoCharacter';
import ZaraVexCharacter from '@/components/characters/ZaraVexCharacter';

export const AdminCharacters: React.FC = () => {
  const { t } = useTranslation('admin');
  const { data: characters, isLoading, error } = useAdminCharacters();

  // Track current gesture/mood per character ID
  // Map<characterId, gestureCode>
  const [activeGestures, setActiveGestures] = useState<Record<string, string>>({});

  const handleGestureClick = (charPublicId: string, gestureCode: string) => {
    setActiveGestures(prev => ({
      ...prev,
      [charPublicId]: gestureCode
    }));
  };

  const typedCharacters = (characters as any[] | undefined) || [];

  // Helper to render the correct character component
  const renderCharacter = (code: string, rawGesture: string) => {
    // Normalize code
    const normalizedCode = code.toLowerCase().trim();

    // Normalize gesture using equivalence mappings for backward compatibility
    const normalizedGesture = normalizeGesture(normalizedCode, rawGesture);

    // Map gesture codes to component props
    // Liruf: mood={happy|sad|excited|thinking|shocked}
    // Dina: expression={neutral|happy|surprised|wink}
    // Dr. Rho: mood={neutral|wise|mysterious|explaining|surprised}
    // Zara Vex: mood={neutral|happy|flirty|curious|excited}

    switch (normalizedCode) {
      case 'dina':
        return (
          <DinaCharacter
            className="w-full h-full max-h-[300px]"
            expression={normalizedGesture as any}
          />
        );
      case 'dr_rho':
      case 'drrho':
        return (
          <DrRhoCharacter
            className="w-full h-full max-h-[300px]"
            mood={normalizedGesture as any}
            showBubble={false}
          />
        );
      case 'zara_vex':
      case 'zaravex':
        return (
          <ZaraVexCharacter
            className="w-full h-full max-h-[300px]"
            mood={normalizedGesture as any}
          />
        );
      case 'liruf':
      default:
        return (
          <DinoCharacter
            className="w-full h-full max-h-[300px]"
            mood={normalizedGesture as any}
            showBubble={false}
          />
        );
    }
  };

  if (error) {
    return (
      <div className="p-4 md:p-8">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {t('characters.loadError', 'Error loading characters')}: {(error as Error).message}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-8 p-4 md:p-8">
      {/* Admin Header */}
      <div className="corp-panel p-6 md:p-8 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4 md:gap-5">
              <div className="corp-icon-chip w-11 h-11 md:w-12 md:h-12 shrink-0">
                  <Sparkles className="w-5 h-5 md:w-6 md:h-6" />
              </div>
              <div>
                  <h1 className="corp-display mt-1 text-2xl md:text-3xl font-bold text-slate-900 dark:text-white leading-tight">
                      {t('characters.title')}
                  </h1>
                  <p className="mt-1 corp-body-sm">
                      {t('characters.subtitle')}
                  </p>
              </div>
          </div>
      </div>

      {/* Characters Grid */}
      {isLoading ? (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-[500px] rounded-2xl" />
          ))}
        </div>
      ) : typedCharacters.length > 0 ? (
        <div className="grid gap-8 md:grid-cols-2 xl:grid-cols-2">
          {typedCharacters.map((character) => {
            const currentGesture = activeGestures[character.public_id];

            return (
              <div key={character.public_id} className="corp-card overflow-hidden flex flex-col h-full p-0">
                <div className="px-6 pt-6 pb-4 border-b border-slate-200 dark:border-white/10">
                  <div className="flex justify-between items-start gap-3">
                    <div>
                      <h2 className="corp-display text-xl font-bold text-slate-900 dark:text-white">{character.name}</h2>
                      <p className="font-mono text-xs mt-1 text-slate-500 dark:text-slate-400">
                        {character.code}
                      </p>
                    </div>
                    <span className={`corp-badge ${character.is_active ? 'corp-badge--success' : 'corp-badge--danger'}`}>
                      {character.is_active ? t('characters.active') : t('characters.inactive')}
                    </span>
                  </div>
                </div>

                <div className="flex-1 flex flex-col md:flex-row">
                  {/* Left: Character Preview Area */}
                  <div className="w-full md:w-1/2 bg-slate-100/50 dark:bg-[#0a0e1a] p-6 flex items-center justify-center min-h-[300px] relative">
                    <div className="w-full max-w-[280px] aspect-square relative z-10">
                      {renderCharacter(character.code, currentGesture)}
                    </div>

                    {/* Background Pattern */}
                    <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05] pointer-events-none"
                      style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, currentColor 1px, transparent 0)', backgroundSize: '24px 24px' }}
                    />

                    {/* Current Gesture Label */}
                    <div className="absolute bottom-4 left-0 right-0 text-center">
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-white/80 dark:bg-[#0d1426]/80 backdrop-blur-sm border border-slate-200 dark:border-white/10 shadow-sm text-slate-600 dark:text-slate-300">
                        {t('characters.currentGesture')}: <span className="ml-1 font-bold text-indigo-600 dark:text-indigo-300">{currentGesture || t('characters.defaultAppearance')}</span>
                      </span>
                    </div>
                  </div>

                  {/* Right: Gesture Controls */}
                  <div className="w-full md:w-1/2 p-6 border-t md:border-t-0 md:border-l border-slate-200 dark:border-white/10 flex flex-col">
                    <h3 className="corp-eyebrow mb-4 flex items-center gap-2">
                      <Play className="w-4 h-4" />
                      {t('characters.testAnimation')}
                    </h3>

                    <div className="flex-1 overflow-y-auto max-h-[300px] pr-2 custom-scrollbar">
                      {character.gestures && character.gestures.length > 0 ? (
                        <div className="grid grid-cols-2 gap-3">
                          {character.gestures.map((gesture: any) => (
                            <button
                              key={gesture.id}
                              type="button"
                              onClick={() => handleGestureClick(character.public_id, gesture.gesture_code)}
                              className={`${currentGesture === gesture.gesture_code ? 'corp-btn-primary' : 'corp-btn-secondary'} justify-start h-auto py-3 px-4 rounded-xl w-full text-left`}
                            >
                              <div className="flex flex-col items-start gap-1 w-full min-w-0">
                                <span className="font-medium truncate w-full">{gesture.gesture_code}</span>
                                <span className="text-[10px] opacity-70 font-normal">
                                  {gesture.duration_ms}ms
                                </span>
                              </div>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="corp-empty h-full p-4 text-center">
                          <p>{t('characters.noGestures')}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="corp-panel py-12">
          <div className="corp-empty">
            {t('characters.noCharacters')}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminCharacters;
