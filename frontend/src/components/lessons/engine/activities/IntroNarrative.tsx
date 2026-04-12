import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';
import { DinoCharacter } from '@/components/characters/DinoCharacter';
import { DinaCharacter } from '@/components/characters/DinaCharacter';
import DrRhoCharacter from '@/components/characters/DrRhoCharacter';
import ZaraVexCharacter from '@/components/characters/ZaraVexCharacter';

interface IntroNarrativeProps {
    exercise?: any;
    onNext: () => void;
    isAudioPlaying: boolean;
}

export const IntroNarrative = ({ exercise, onNext, isAudioPlaying }: IntroNarrativeProps) => {
    const { t } = useTranslation('lessons');

    // Character code mapping - normalize all variations
    const CHARACTER_CODE_MAP: Record<string, string> = {
        'liruf': 'liruf',
        'dina': 'dina',
        'dr_rho': 'dr_rho',
        'zara_vex': 'zara_vex',
        'drrho': 'dr_rho',
        'zaravex': 'zara_vex',
        'DrRho': 'dr_rho',
        'ZaraVex': 'zara_vex',
        'dr rho': 'dr_rho',
        'zara vex': 'zara_vex'
    };

    // Get character code from exercise with normalization
    const rawCode = exercise?.character_code || 'liruf';
    const characterCode = CHARACTER_CODE_MAP[rawCode.toLowerCase().trim()] || CHARACTER_CODE_MAP[rawCode] || 'liruf';

    // Get narrative text
    const narrativeText = exercise?.content?.transcript
        || exercise?.content?.instruction
        || exercise?.content?.context
        || t('intro.welcome');

    // Render the correct character
    const renderCharacter = () => {
        switch (characterCode) {
            case 'dina':
                return (
                    <DinaCharacter
                        className="w-full max-w-[280px] mx-auto"
                        expression="happy"
                    />
                );
            case 'dr_rho':
                return (
                    <DrRhoCharacter
                        className="w-full max-w-[280px] mx-auto"
                        mood="wise"
                    />
                );
            case 'zara_vex':
                return (
                    <ZaraVexCharacter
                        className="w-full max-w-[280px] mx-auto"
                        mood="happy"
                    />
                );
            default:
                return (
                    <DinoCharacter
                        className="w-full max-w-[280px] mx-auto"
                        showBubble={false}
                        mood="excited"
                    />
                );
        }
    };

    return (
        <div className="w-full max-w-lg animate-slide-in-bottom flex flex-col items-center gap-6">
            {/* Character */}
            <div className="flex-shrink-0 mb-4">
                {renderCharacter()}
            </div>

            {/* Speech Bubble with Narrative */}
            <div className="w-full flex justify-center">
                <div className="relative liquid-glass-strong rounded-xl shadow-xl border border-white/20 dark:border-white/10 px-6 py-4 max-w-md">
                    <p className="text-center font-medium text-foreground leading-snug">
                        {narrativeText}
                    </p>
                    {/* Speech bubble arrow */}
                    <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-card border-l border-t border-border rotate-45" />
                </div>
            </div>

            {/* Audio indicator */}
            {isAudioPlaying && (
                <div className="flex items-center justify-center gap-2 text-muted-foreground">
                    <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                    <span className="text-sm font-medium">{t('status.speaking')}</span>
                </div>
            )}

            {/* Continue Button */}
            <Button
                onClick={onNext}
                disabled={isAudioPlaying}
                className="relative overflow-hidden w-full h-14 text-lg font-bold bg-purple-600 hover:bg-purple-700 text-white rounded-2xl shadow-[0_4px_0_rgb(107,33,168)] hover:shadow-[0_2px_0_rgb(107,33,168)] hover:translate-y-[2px] active:shadow-none active:translate-y-1 transition-all disabled:opacity-50"
            >
                <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent pointer-events-none" />
                <span className="relative flex items-center justify-center">{t('actions.continue')}</span>
            </Button>
        </div>
    );
};
