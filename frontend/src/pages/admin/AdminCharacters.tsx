import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAdminCharacters } from '@/hooks/useAdminCharacters';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Play, Sparkles } from 'lucide-react';
import { normalizeGesture } from '@/utils/gestureMapper';
import { GlassPanel } from '@/components/ui/GlassPanel';

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
      <div className="p-8">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Error loading characters: {(error as Error).message}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-8 p-8 dark:bg-slate-950 dark:text-slate-50 min-h-screen">
      {/* Premium Admin Header */}
      <div className="relative rounded-3xl overflow-hidden liquid-glass-strong px-5 py-5 md:px-7 md:py-6 flex flex-col md:flex-row items-center justify-between gap-5 border border-purple-500/10 dark:border-purple-500/5 shadow-2xl">
          {/* Ambient Glows */}
          <div className="absolute -top-10 -right-10 w-48 h-48 bg-gradient-to-br from-purple-500/15 to-pink-600/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-gradient-to-tr from-blue-500/10 to-purple-600/10 rounded-full blur-3xl pointer-events-none" />
          
          <div className="flex flex-row items-center gap-4 md:gap-5 relative z-10 w-full md:w-auto">
              <div className="p-2 md:p-3 bg-gradient-to-br from-purple-500 via-pink-500 to-indigo-600 rounded-xl md:rounded-[1.25rem] shadow-xl shadow-purple-500/25 transform -rotate-3 transition-transform hover:rotate-0 duration-300 shrink-0">
                  <Sparkles className="w-5 h-5 md:w-7 md:h-7 text-white" />
              </div>
              <div className="text-left">
                  <div className="flex items-center gap-2 mb-0.5">
                      {/* Branding removed as per user request */}
                  </div>
                  <h1 className="text-xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight uppercase md:normal-case leading-tight mb-1">
                      {t('characters.title')}
                  </h1>
                  <p className="text-[10px] md:text-sm text-slate-500 dark:text-slate-400 font-bold md:font-medium leading-tight">
                      {t('characters.subtitle')}
                  </p>
              </div>
          </div>
      </div>

      {/* Characters Grid */}
      {isLoading ? (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-[500px] rounded-xl dark:bg-slate-800" />
          ))}
        </div>
      ) : typedCharacters.length > 0 ? (
        <div className="grid gap-8 md:grid-cols-2 xl:grid-cols-2">
          {typedCharacters.map((character) => {
            const currentGesture = activeGestures[character.public_id];

            return (
              <Card key={character.public_id} className="overflow-hidden border-2 dark:bg-slate-800 dark:border-slate-700 flex flex-col h-full">
                <CardHeader className="bg-slate-50 dark:bg-slate-900/50 border-b dark:border-slate-700 pb-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-xl font-bold dark:text-white">{character.name}</CardTitle>
                      <CardDescription className="font-mono text-xs mt-1 dark:text-slate-400">
                        {character.code}
                      </CardDescription>
                    </div>
                    <Badge className={`border-none text-white ${character.is_active
                        ? 'bg-emerald-500 hover:bg-emerald-600'
                        : 'bg-rose-500 hover:bg-rose-600'
                      }`}>
                      {character.is_active ? t('characters.active') : t('characters.inactive')}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="p-0 flex-1 flex flex-col md:flex-row">
                  {/* Left: Character Preview Area */}
                  <div className="w-full md:w-1/2 bg-slate-100/50 dark:bg-slate-900 p-6 flex items-center justify-center min-h-[300px] relative">
                    <div className="w-full max-w-[280px] aspect-square relative z-10">
                      {renderCharacter(character.code, currentGesture)}
                    </div>

                    {/* Background Pattern */}
                    <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05] pointer-events-none"
                      style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, currentColor 1px, transparent 0)', backgroundSize: '24px 24px' }}
                    />

                    {/* Current Gesture Label */}
                    <div className="absolute bottom-4 left-0 right-0 text-center">
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border shadow-sm text-slate-600 dark:text-slate-300">
                        {t('characters.currentGesture')}: <span className="ml-1 font-bold text-blue-600 dark:text-blue-400">{currentGesture || t('characters.defaultAppearance')}</span>
                      </span>
                    </div>
                  </div>

                  {/* Right: Gesture Controls */}
                  <div className="w-full md:w-1/2 p-6 border-t md:border-t-0 md:border-l dark:border-slate-700 bg-white dark:bg-slate-800 flex flex-col">
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-4 flex items-center gap-2">
                      <Play className="w-4 h-4" />
                      {t('characters.testAnimation')}
                    </h3>

                    <div className="flex-1 overflow-y-auto max-h-[300px] pr-2 custom-scrollbar">
                      {character.gestures && character.gestures.length > 0 ? (
                        <div className="grid grid-cols-2 gap-3">
                          {character.gestures.map((gesture: any) => (
                            <Button
                              key={gesture.id}
                              variant={currentGesture === gesture.gesture_code ? "default" : "outline"}
                              size="sm"
                              onClick={() => handleGestureClick(character.public_id, gesture.gesture_code)}
                              className={`justify-start h-auto py-3 px-4 transition-all w-full text-left
                                ${currentGesture === gesture.gesture_code
                                  ? 'bg-blue-600 hover:bg-blue-700 shadow-md ring-2 ring-blue-200 dark:ring-blue-900'
                                  : 'hover:bg-slate-50 dark:hover:bg-slate-700 dark:border-slate-600 dark:text-slate-300'
                                }`}
                            >
                              <div className="flex flex-col items-start gap-1 w-full min-w-0">
                                <span className="font-medium truncate w-full">{gesture.gesture_code}</span>
                                <span className="text-[10px] opacity-70 font-normal">
                                  {gesture.duration_ms}ms
                                </span>
                              </div>
                            </Button>
                          ))}
                        </div>
                      ) : (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 italic p-4 text-center border-2 border-dashed rounded-lg border-slate-200 dark:border-slate-700">
                          <p>{t('characters.noGestures')}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="dark:bg-slate-800 dark:border-slate-700">
          <CardContent className="py-12 text-center text-slate-500 dark:text-slate-400">
            {t('characters.noCharacters')}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AdminCharacters;
